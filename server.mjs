import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { shipments } from './src/portalData.js';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

try {
  const envText = await readFile(resolve(root, '.env'), 'utf8');
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
} catch { /* local .env is optional */ }

const integrationDataDir = resolve(root, '.local-data');
const positionFile = resolve(integrationDataDir, 'gestracking-positions.json');
const workflowFile = resolve(integrationDataDir, 'workflow-demo.json');
const workflowDemo = {
  tripId: 'NV-24081', status: 'IN_TRANSIT', podStatus: 'PENDING', invoiceReady: false,
  incidents: [], events: [
    { id: 'evt-demo-1', type: 'ORDER.ACCEPTED', role: 'Transportista', label: 'Pedido aceptado y servicio confirmado', at: '2026-10-05T07:46:00.000Z' },
    { id: 'evt-demo-2', type: 'DRIVER.ASSIGNED', role: 'Transportista', label: 'Miguel García asignado al vehículo 1234 ABC', at: '2026-10-05T07:52:00.000Z' },
    { id: 'evt-demo-3', type: 'TRIP.STARTED', role: 'Conductor', label: 'Servicio iniciado · seguimiento activo', at: '2026-10-05T08:12:00.000Z' }
  ]
};
let workflowState = workflowDemo;
try { workflowState = { ...workflowDemo, ...JSON.parse(await readFile(workflowFile, 'utf8')) }; } catch { /* first demo run */ }
async function saveWorkflow() {
  await mkdir(integrationDataDir, { recursive: true });
  await writeFile(workflowFile, JSON.stringify(workflowState, null, 2), 'utf8');
}
function addWorkflowEvent(type, role, label) {
  workflowState.events.unshift({ id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, role, label, at: new Date().toISOString() });
}
async function handleWorkflow(req, res, tripId) {
  const json = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  if (tripId !== workflowState.tripId) return json(404, { error: 'Servicio compartido no encontrado.' });
  if (req.method === 'GET') return json(200, workflowState);
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido.' });
  try {
    const { action, description = '', kind = 'Incidencia de transporte' } = await readJsonBody(req, 10_000);
    const roleByAction = { driver_arrive: 'Conductor', driver_deliver: 'Conductor', transport_validate_pod: 'Transportista', client_incident: 'Cliente', driver_incident: 'Conductor' };
    const role = roleByAction[action];
    if (!role) return json(400, { error: 'Acción de demo no reconocida.' });
    if (action === 'driver_arrive') {
      workflowState.status = 'ARRIVED';
      addWorkflowEvent('TRIP.ARRIVED', role, 'Conductor en destino · esperando descarga');
    } else if (action === 'driver_deliver') {
      if (workflowState.status !== 'ARRIVED') return json(409, { error: 'Confirma primero la llegada a destino.' });
      workflowState.status = 'DELIVERED'; workflowState.podStatus = 'RECEIVED';
      addWorkflowEvent('TRIP.DELIVERED', role, 'Entrega completada por el conductor');
      addWorkflowEvent('POD.UPLOADED', role, 'POD de demostración recibido · pendiente de validar');
    } else if (action === 'transport_validate_pod') {
      if (workflowState.podStatus !== 'RECEIVED') return json(409, { error: 'El POD todavía no se ha recibido.' });
      workflowState.podStatus = 'VALIDATED'; workflowState.invoiceReady = true;
      addWorkflowEvent('POD.VALIDATED', role, 'POD validado por operaciones');
      addWorkflowEvent('INVOICE.READY', 'Automatización', 'Servicio listo para facturar · validación completada');
    } else {
      const safeDescription = String(description).trim().slice(0, 1000);
      if (!safeDescription) return json(400, { error: 'Añade una descripción para la incidencia.' });
      workflowState.incidents.unshift({ id: `INC-${Date.now()}`, kind: String(kind).slice(0, 80), description: safeDescription, createdAt: new Date().toISOString(), source: role });
      addWorkflowEvent('INCIDENT.CREATED', role, `${String(kind).slice(0, 50)} · ${safeDescription.slice(0, 110)}`);
    }
    await saveWorkflow();
    return json(200, workflowState);
  } catch (error) { return json(400, { error: error.message || 'Solicitud no válida.' }); }
}
let emailPositions = {};
let seenEmailIds = [];
try {
  const saved = JSON.parse(await readFile(positionFile, 'utf8'));
  emailPositions = saved.positions || {};
  seenEmailIds = saved.seen || [];
} catch { /* no email positions saved yet */ }

async function saveEmailState() {
  await mkdir(integrationDataDir, { recursive: true });
  await writeFile(positionFile, JSON.stringify({ positions: emailPositions, seen: seenEmailIds.slice(-1000) }, null, 2), 'utf8');
}

function timingSafeSecretMatches(received, expected) {
  if (!received || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readJsonBody(req, limit = 256 * 1024) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > limit) throw new Error('El mensaje supera el tamaño máximo permitido.');
  }
  return JSON.parse(body || '{}');
}

function parseEmailPosition(message, domains) {
  const html = String(message.html || '');
  const links = Array.from(html.matchAll(/href=["']([^"']+)["']/gi), match => match[1]);
  const text = `${message.subject || ''}\n${message.text || ''}\n${links.join('\n')}\n${html.replace(/<[^>]*>/g, ' ')}`;
  const senderMatch = String(message.from || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const sender = senderMatch?.[0]?.toLowerCase();
  const senderDomain = sender?.split('@')[1];
  if (!senderDomain || !domains.some(domain => senderDomain === domain || senderDomain.endsWith(`.${domain}`))) throw new Error('Remitente no autorizado.');
  const auth = String(message.authResults || '').toLowerCase();
  if (!/\bdkim=pass\b/.test(auth) || !/\bdmarc=pass\b/.test(auth)) throw new Error('El correo no supera la verificación DKIM/DMARC.');

  const messageId = String(message.messageId || '').trim();
  if (!messageId || messageId.length > 300) throw new Error('Falta un identificador de mensaje válido.');
  if (seenEmailIds.includes(messageId)) return { duplicate: true };

  const shipment = shipments.find(item => [item.id, item.reference, item.order, item.vehicle].some(ref => ref && text.toLowerCase().includes(ref.toLowerCase())));
  if (!shipment) throw new Error('No se encontró una referencia de viaje conocida en el correo.');

  let latitude = Number(message.latitude ?? NaN);
  let longitude = Number(message.longitude ?? NaN);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    const lat = text.match(/(?:lat(?:itud)?|latitude)\s*[:=]\s*(-?\d{1,2}(?:\.\d+)?)/i);
    const lon = text.match(/(?:lon(?:gitud)?|longitude|lng)\s*[:=]\s*(-?\d{1,3}(?:\.\d+)?)/i);
    latitude = lat ? Number(lat[1]) : NaN;
    longitude = lon ? Number(lon[1]) : NaN;
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    const linkDomains = (process.env.GESTRACKING_EMAIL_LINK_DOMAINS || process.env.GESTRACKING_EMAIL_ALLOWED_DOMAINS || '').toLowerCase().split(',').map(value => value.trim()).filter(Boolean);
    for (const candidate of text.match(/https?:\/\/[^\s"'<>]+/gi) || []) {
      try {
        const url = new URL(candidate.replace(/[),.;]+$/, ''));
        if (url.protocol !== 'https:' || !linkDomains.some(domain => url.hostname.toLowerCase() === domain || url.hostname.toLowerCase().endsWith(`.${domain}`))) continue;
        const lat = url.searchParams.get('lat') || url.searchParams.get('latitude');
        const lon = url.searchParams.get('lon') || url.searchParams.get('lng') || url.searchParams.get('longitude');
        if (lat !== null && lon !== null) { latitude = Number(lat); longitude = Number(lon); break; }
      } catch { /* ignore malformed or non-GES links */ }
    }
  }
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
    throw new Error('No se encontraron coordenadas válidas (latitud y longitud) en el correo.');
  }

  const receivedAt = new Date(message.receivedAt || Date.now());
  if (Number.isNaN(receivedAt.getTime()) || receivedAt.getTime() > Date.now() + 5 * 60 * 1000) throw new Error('La fecha del correo no es válida.');
  const temperature = message.temperature == null ? null : String(message.temperature).slice(0, 40);
  return {
    duplicate: false,
    shipmentId: shipment.id,
    vehicleId: shipment.vehicle,
    latitude,
    longitude,
    location: String(message.location || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`).slice(0, 240),
    temperature,
    eta: message.eta ? String(message.eta).slice(0, 50) : null,
    status: message.status ? String(message.status).slice(0, 80) : null,
    updatedAt: receivedAt.toISOString(),
    source: 'gestracking-email',
    connected: true,
    messageId
  };
}

async function ingestTrackingEmail(req, res) {
  const json = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  const secret = process.env.GESTRACKING_EMAIL_WEBHOOK_SECRET || '';
  const domains = (process.env.GESTRACKING_EMAIL_ALLOWED_DOMAINS || '').toLowerCase().split(',').map(value => value.trim()).filter(Boolean);
  if (!secret || domains.length === 0) return json(503, { error: 'La recepción de correo aún no está configurada.' });
  if (!timingSafeSecretMatches(req.headers['x-gestracking-webhook-secret'], secret)) return json(401, { error: 'Webhook no autorizado.' });
  let message;
  try { message = await readJsonBody(req); }
  catch (error) { return json(400, { error: error.message || 'JSON no válido.' }); }
  try {
    const update = parseEmailPosition(message, domains);
    if (update.duplicate) return json(200, { accepted: true, duplicate: true });
    const previous = emailPositions[update.shipmentId];
    if (!previous || new Date(update.updatedAt) >= new Date(previous.updatedAt)) emailPositions[update.shipmentId] = update;
    seenEmailIds.push(update.messageId);
    seenEmailIds = seenEmailIds.slice(-1000);
    await saveEmailState();
    return json(202, { accepted: true, shipmentId: update.shipmentId, updatedAt: update.updatedAt });
  } catch (error) { return json(422, { error: error.message || 'No se pudo validar el correo.' }); }
}

function getByPath(value, path) {
  if (!path) return undefined;
  return path.split('.').reduce((current, key) => current?.[key], value);
}

function getTrackingConfig() {
  const endpoint = process.env.GESTRACKING_TRACKING_URL_TEMPLATE || '';
  const token = process.env.GESTRACKING_API_TOKEN || '';
  let fieldMap = {};
  try { fieldMap = JSON.parse(process.env.GESTRACKING_RESPONSE_MAP || '{}'); } catch { /* invalid map handled as empty */ }
  return { endpoint, token, fieldMap };
}

function mockTracking(shipment) {
  return {
    shipmentId: shipment.id,
    vehicleId: shipment.vehicle,
    location: shipment.lastPosition,
    // Punto fijo de demostración en Tarancón; no representa la posición real de un vehículo.
    latitude: shipment.id === 'NV-24081' ? 40.0092 : null,
    longitude: shipment.id === 'NV-24081' ? -3.0066 : null,
    temperature: shipment.temperature,
    eta: shipment.eta,
    status: shipment.status,
    updatedAt: shipment.updated,
    source: 'demo',
    connected: false
  };
}

async function liveTracking(shipment) {
  const { endpoint, token, fieldMap } = getTrackingConfig();
  const emailUpdate = emailPositions[shipment.id];
  if (!endpoint || !token) {
    if (!emailUpdate) return mockTracking(shipment);
    const { messageId, ...publicUpdate } = emailUpdate;
    return publicUpdate;
  }
  const url = endpoint.replaceAll('{vehicleId}', encodeURIComponent(shipment.vehicle)).replaceAll('{shipmentId}', encodeURIComponent(shipment.id));
  let parsedUrl;
  try { parsedUrl = new URL(url); } catch { throw new Error('GESTRACKING_TRACKING_URL_TEMPLATE no es una URL válida.'); }
  if (parsedUrl.protocol !== 'https:') throw new Error('El endpoint de GEStracking debe usar HTTPS.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const authHeader = process.env.GESTRACKING_AUTH_HEADER || 'Authorization';
    const authPrefix = process.env.GESTRACKING_AUTH_PREFIX ?? 'Bearer';
    const authValue = `${authPrefix}${authPrefix && !authPrefix.endsWith(' ') ? ' ' : ''}${token}`;
    const response = await fetch(parsedUrl, { headers: { [authHeader]: authValue, Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) throw new Error(`GEStracking respondió HTTP ${response.status}.`);
    const raw = await response.json();
    const pick = (key, fallback) => fieldMap[key] ? getByPath(raw, fieldMap[key]) : fallback;
    const latitude = Number(pick('latitude', NaN));
    const longitude = Number(pick('longitude', NaN));
    if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
      throw new Error('La respuesta de GEStracking no incluye coordenadas válidas.');
    }
    const liveUpdate = {
      shipmentId: shipment.id,
      vehicleId: shipment.vehicle,
      location: String(pick('location', `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`)),
      latitude,
      longitude,
      temperature: pick('temperature', null),
      eta: pick('eta', null),
      status: pick('status', null),
      updatedAt: pick('updatedAt', new Date().toISOString()),
      source: 'gestracking',
      connected: true
    };
    if (emailUpdate && new Date(emailUpdate.updatedAt) > new Date(liveUpdate.updatedAt)) {
      const { messageId, ...publicUpdate } = emailUpdate;
      return publicUpdate;
    }
    return liveUpdate;
  } finally {
    clearTimeout(timeout);
  }
}

async function handleApi(req, res, url) {
  const json = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  if (req.method === 'POST' && url.pathname === '/api/integrations/gestracking/email') return ingestTrackingEmail(req, res);
  const workflowMatch = url.pathname.match(/^\/api\/workflow\/([A-Za-z0-9-]+)$/);
  if (workflowMatch) return handleWorkflow(req, res, workflowMatch[1]);
  if (req.method !== 'GET') return json(405, { error: 'Método no permitido.' });
  if (url.pathname === '/api/integrations/gestracking') {
    const { endpoint, token } = getTrackingConfig();
    const emailEnabled = Boolean(process.env.GESTRACKING_EMAIL_WEBHOOK_SECRET && process.env.GESTRACKING_EMAIL_ALLOWED_DOMAINS);
    return json(200, { provider: 'GEStracking', mode: endpoint && token ? 'live-configured' : Object.keys(emailPositions).length ? 'email-feed' : 'demo', configured: Boolean(endpoint && token), emailWebhookEnabled: emailEnabled, latestEmailUpdate: Object.values(emailPositions).sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt))[0]?.updatedAt || null, refreshSeconds: 15 });
  }
  if (url.pathname === '/api/integrations/maps') return json(200, { googleMapsEmbedKey: process.env.GOOGLE_MAPS_EMBED_API_KEY || null });
  const match = url.pathname.match(/^\/api\/tracking\/([A-Za-z0-9-]+)$/);
  if (!match) return json(404, { error: 'Ruta API no encontrada.' });
  const shipment = shipments.find(item => item.id === match[1]);
  if (!shipment) return json(404, { error: 'Viaje no encontrado.' });
  try { return json(200, await liveTracking(shipment)); }
  catch (error) { return json(502, { error: error.message || 'No se pudo consultar GEStracking.' }); }
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    const requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = resolve(root, `.${requested}`);
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Portal de cliente demo running at http://127.0.0.1:${port}`);
});
