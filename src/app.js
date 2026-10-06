import { initialServices, initialActivity, initialAlerts, demoOrder, docs, automationRules, customers, vehicles } from './data.js';
import { simulateOrderExtraction } from './services/aiMock.js';

const state = {
  services: structuredClone(initialServices),
  activity: structuredClone(initialActivity),
  alerts: structuredClone(initialAlerts),
  documents: structuredClone(docs),
  page: 'dashboard',
  newServiceCreated: false,
  demoProgress: 0,
  demoMode: false
};

const content = document.querySelector('#content');
const modalRoot = document.querySelector('#modalRoot');
const toastRoot = document.querySelector('#toastRoot');
const labels = { dashboard: 'Dashboard', servicios: 'Servicios', pedidos: 'Pedidos', documentos: 'Documentos', incidencias: 'Incidencias', facturacion: 'Facturación', automatizaciones: 'Automatizaciones', clientes: 'Clientes', vehiculos: 'Vehículos', configuracion: 'Configuración' };
const euros = value => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function statusClass(value) {
  if (/facturado|recibido|activo|entregado|al día|validado/i.test(value)) return 'green';
  if (/curso|tránsito|espera|revisión/i.test(value)) return 'blue';
  if (/listo|pendiente|revisar|falta|abierta/i.test(value)) return 'orange';
  return 'gray';
}
function statusPill(value) { return `<span class="status ${statusClass(value)}">${escapeHtml(value)}</span>`; }
function pageHeader(title, description, action = '') {
  return `<div class="page-header"><div><div class="eyebrow">Transport AI OS <span style="color:#c0c8d3">/</span> ${escapeHtml(labels[state.page] || '')}</div><h1>${title}</h1><p>${description}</p></div><div class="header-actions">${action}</div></div>`;
}
function card(title, contentHtml, right = '', extra = '') {
  return `<section class="panel ${extra}"><div class="panel-head"><div><div class="panel-title">${title}</div></div>${right}</div>${contentHtml}</section>`;
}
function serviceRows(rows) {
  return rows.map(s => `<tr><td><a class="id-link" data-service="${s.id}">${s.id}</a></td><td class="customer-cell">${escapeHtml(s.customer)}</td><td><span class="route-line">${escapeHtml(s.origin)} <span>→</span> ${escapeHtml(s.destination)}</span></td><td>${escapeHtml(s.date)}</td><td class="amount-cell">${euros(s.price)}</td><td>${statusPill(s.status)}</td><td>${statusPill(s.invoiceStatus)}</td></tr>`).join('');
}
function serviceTable(rows = state.services.slice(0, 5), invoice = false) {
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>SERVICIO</th><th>CLIENTE</th>${invoice ? '<th>REFERENCIA</th>' : '<th>RUTA</th>'}<th>${invoice ? 'FECHA' : 'FECHA'}</th><th>IMPORTE</th><th>OPERATIVA</th><th>FACTURACIÓN</th></tr></thead><tbody>${serviceRows(rows)}</tbody></table></div>`;
}
function activityRows() {
  return state.activity.slice(0, 5).map(a => `<div class="activity-row"><div class="activity-icon ${a.color}">${a.icon}</div><div class="activity-copy"><b>${escapeHtml(a.title)}</b><span>${escapeHtml(a.detail)}</span></div><div class="activity-time">${escapeHtml(a.time)}</div></div>`).join('');
}
function attentionRows() {
  if (!state.alerts.length) return '<div class="empty-state"><span>✓</span><strong>Todo al día</strong>No hay alertas que requieran atención.</div>';
  return state.alerts.slice(0, 4).map(a => `<div class="attention-item"><i class="priority-dot ${a.priority === 'medium' ? 'medium' : a.priority === 'low' ? 'low' : ''}"></i><div class="attention-copy"><b>${escapeHtml(a.title)}</b><small>${escapeHtml(a.description)}</small></div><a class="attention-action" data-alert="${a.id}">${escapeHtml(a.action)} →</a></div>`).join('');
}
function automationRows() {
  return automationRules.map(a => `<div class="automation-row"><div class="automation-symbol">${a.icon}</div><div class="automation-copy"><b>${escapeHtml(a.title)}</b><small>${escapeHtml(a.runs)}</small></div><span class="toggle" aria-label="Activa"></span></div>`).join('');
}
function kpi(label, value, sub, icon, color = '', extra = '') {
  return `<div class="kpi-card ${extra}"><div class="kpi-top"><span class="kpi-label">${label}</span><span class="kpi-icon ${color}">${icon}</span></div><div class="kpi-value ${value.includes('€') ? 'money' : ''}">${value}</div><div class="kpi-foot">${sub}</div></div>`;
}

function dashboardPage() {
  const pendingAmount = 18420 + (state.newServiceCreated && state.services.find(s => s.id === demoOrder.id)?.invoiceStatus !== 'Facturado' ? demoOrder.price : 0);
  const serviceCount = 128 + (state.newServiceCreated ? 1 : 0);
  const activityMarkup = card('Actividad reciente', `<div class="activity-list">${activityRows()}</div>`, '<a class="text-link" data-page="servicios">Ver actividad →</a>');
  const alertMarkup = card('Requieren atención', `<div class="attention-list">${attentionRows()}</div>`, `<span class="nav-count">${state.alerts.length} alertas</span>`, 'attention-panel');
  const actions = '<button class="btn" data-demo-tour><span class="btn-icon">▷</span> Modo demo</button><button class="btn btn-primary" data-simulate><span class="btn-icon">＋</span> Simular nuevo pedido</button>';
  return `${pageHeader('Buenos días, Carlos', 'Aquí tienes el estado operativo de tu empresa.', actions)}
    <div class="welcome-strip"><p><strong>Resumen operativo</strong> · Martes, 6 de octubre de 2026</p><span class="sync-indicator"><i></i> Última sincronización hace 2 min</span></div>
    <section class="kpi-grid">
      ${kpi('Servicios de hoy', String(serviceCount), '<span class="trend">↑ 12 %</span> frente a ayer', '⇄')}
      ${kpi('Pendientes de documentación', '7', '3 requieren seguimiento', '▧', 'orange')}
      ${kpi('Incidencias abiertas', String(state.alerts.filter(a => a.priority !== 'low').length), '1 nueva desde esta mañana', '⚑', 'orange')}
      ${kpi('Servicios pendientes de facturar', String(13 + (state.newServiceCreated ? 1 : 0)), '4 listos para emitir', '€', 'green')}
      ${kpi('Importe pendiente de facturación', euros(pendingAmount), 'Servicios completados sin factura', '↗', 'green', 'kpi-highlight')}
      ${kpi('Automatizaciones ejecutadas', '342', '<span class="trend">↑ 8,4 %</span> esta semana', '✳', 'purple')}
      ${kpi('Horas administrativas ahorradas', '26,5 h', 'Estimación acumulada este mes', '◷', 'blue')}
      ${kpi('Errores detectados', '17', '5 resueltos automáticamente', '✓', 'green')}
    </section>
    <section class="overview-grid">${activityMarkup}${alertMarkup}</section>
    <section class="bottom-grid">${card('Servicios recientes', serviceTable(state.services.slice(0, 4)), '<a class="text-link" data-page="servicios">Ver todos →</a>')}${card('Automatizaciones activas', `<div class="automation-content">${automationRows()}</div>`, '<a class="text-link" data-page="automatizaciones">Gestionar →</a>')}</section>
    <section class="panel workflow-operations-panel" id="sharedWorkflowPanel"><div class="panel-head"><div><div class="panel-title">Flujo compartido · NV-24081</div><div class="panel-subtitle">Conductor, operaciones y cliente · una única actividad del servicio</div></div><span class="workflow-live-badge"><i></i> Evento en tiempo real</span></div><div class="workflow-events" id="transporterWorkflowEvents"><div class="driver-loading">Sincronizando actividad del servicio…</div></div><div class="workflow-operations-actions"><a class="btn" href="/driver.html">Abrir panel del conductor →</a><button class="btn btn-primary" data-workflow-action="transport_validate_pod">Validar POD y habilitar facturación</button></div><div id="workflowActionError" class="workflow-action-error" hidden></div></section>
    <div class="lower-note"><span class="note-icon">✦</span><span><strong>El trabajo repetitivo, bajo control.</strong> Los indicadores de esta demo utilizan datos ficticios para mostrar el flujo del producto.</span></div>`;
}

function toolbar(searchPlaceholder = 'Buscar…', filter = 'Todos los estados') {
  return `<div class="page-toolbar"><label class="search-box"><span>⌕</span><input data-search placeholder="${searchPlaceholder}" /></label><div class="toolbar-right"><select class="filter-select" data-filter><option>${filter}</option><option>Pendiente</option><option>En curso</option><option>Entregado</option></select><button class="btn btn-small" data-toast="Filtros aplicados">☷ Filtrar</button></div></div>`;
}
function servicesPage() {
  const actions = '<button class="btn" data-toast="Exportación de demo preparada">↓ Exportar</button><button class="btn btn-primary" data-simulate>＋ Nuevo pedido</button>';
  return `${pageHeader('Servicios', 'Sigue cada operación desde la recepción del pedido hasta su facturación.', actions)}<div class="page-metrics"><span class="mini-metric">Hoy <b>${128 + (state.newServiceCreated ? 1 : 0)} servicios</b></span><span class="mini-metric">En curso <b>24</b></span><span class="mini-metric">Requieren atención <b>${state.alerts.length}</b></span></div><section class="panel" style="margin-top:14px">${toolbar('Buscar por servicio, cliente o ruta')}${serviceTable(state.services)}<div class="table-foot">Mostrando ${state.services.length} operaciones recientes · Datos ficticios para demostración</div></section>`;
}
function ordersPage() {
  const cards = state.services.slice(0, 4).map(s => `<article class="order-card"><div class="order-card-head"><h3>Pedido ${s.id}</h3>${statusPill(s.status)}</div><p>Recibido por email · ${s.date} a las ${s.time}</p><div class="extract-fields"><div><span>Cliente</span><b>${escapeHtml(s.customer)}</b></div><div><span>Trayecto</span><b>${escapeHtml(s.origin)} → ${escapeHtml(s.destination)}</b></div><div><span>Precio acordado</span><b>${euros(s.price)}</b></div><div><span>Validación</span><b>${s.pod === 'Recibido' ? 'Datos completos' : 'Revisar documentación'}</b></div></div><div style="margin-top:12px"><button class="btn btn-small" data-service="${s.id}">Abrir pedido →</button></div></article>`).join('');
  return `${pageHeader('Pedidos', 'Entrada centralizada y validación de solicitudes de transporte.', '<button class="btn btn-primary" data-simulate>＋ Simular nuevo pedido</button>')}<div class="panel"><div class="panel-head"><div><div class="panel-title">Bandeja de pedidos</div><div class="panel-subtitle">Email · PDF · Excel</div></div><span class="status blue">IA asistida</span></div>${toolbar('Buscar pedido o remitente','Todos los estados')}<div class="order-cards">${cards}</div></div>`;
}
function documentRows() {
  return state.documents.map(d => `<tr><td><div style="display:flex;align-items:center;gap:8px"><span class="doc-file ${d.status === 'Recibido' ? 'green' : ''}">PDF</span><span><b style="color:#425067">${escapeHtml(d.name)}</b><small style="display:block;color:#99a4b1;font-size:9px;margin-top:3px">${escapeHtml(d.type)}</small></span></div></td><td><a class="id-link" data-service="${d.serviceId}">${d.serviceId}</a></td><td>${statusPill(d.status)}</td><td>${escapeHtml(d.date)}</td><td>${escapeHtml(d.origin)}</td><td><button class="btn btn-small" data-open-document="${escapeHtml(d.name)}">Abrir</button></td></tr>`).join('');
}
function documentsPage() {
  return `${pageHeader('Documentos', 'Documentación relacionada automáticamente con cada operación.', '<button class="btn btn-primary" data-toast="Carga simulada: selecciona un PDF en una versión conectada">↑ Subir documento</button>')}<div class="page-metrics"><span class="mini-metric">Documentos recibidos <b>${state.documents.filter(d => d.status === 'Recibido').length}</b></span><span class="mini-metric">Pendientes <b>${state.documents.filter(d => d.status !== 'Recibido').length}</b></span><span class="mini-metric">Tipo destacado <b>DeCA · POD</b></span></div><section class="panel" style="margin-top:14px">${toolbar('Buscar archivo, tipo o servicio','Todos los tipos')}<div class="table-wrap"><table class="data-table"><thead><tr><th>DOCUMENTO</th><th>SERVICIO</th><th>ESTADO</th><th>FECHA</th><th>ORIGEN</th><th></th></tr></thead><tbody>${documentRows()}</tbody></table></div><div class="table-foot">Los enlaces y documentos mostrados pertenecen a la demo y no contienen información real.</div></section>`;
}
function invoicePageRows() {
  return state.services.map(s => `<tr><td><a class="id-link" data-service="${s.id}">${s.id}</a></td><td class="customer-cell">${escapeHtml(s.customer)}</td><td>${escapeHtml(s.reference || 'CLI-78452')}</td><td>${escapeHtml(s.date)}</td><td class="amount-cell">${euros(s.price)}</td><td>${statusPill(s.invoiceStatus)}</td><td>${s.invoiceStatus === 'Listo para facturar' ? `<button class="btn btn-small btn-primary" data-invoice="${s.id}">Preparar</button>` : `<button class="btn btn-small" data-invoice="${s.id}">Revisar</button>`}</td></tr>`).join('');
}
function billingPage() {
  const amount = 18420 + (state.newServiceCreated && state.services.find(s => s.id === demoOrder.id)?.invoiceStatus !== 'Facturado' ? demoOrder.price : 0);
  return `${pageHeader('Control de facturación', 'Detecta servicios completados que todavía no han llegado a factura.', '<button class="btn" data-toast="Informe descargado (simulación)">↓ Descargar informe</button>')}<div class="billing-hero"><div><span class="eyebrow">OPORTUNIDAD DETECTADA</span><div class="billing-amount">${euros(amount)}</div><p>Servicios realizados que todavía no han sido facturados</p></div><div class="billing-hero-right"><span class="billing-hero-icon">€</span><span>13 servicios requieren revisión</span><small>4 listos para preparar factura</small></div></div><section class="panel" style="margin-top:13px"><div class="panel-head"><div><div class="panel-title">Servicios y estado de facturación</div><div class="panel-subtitle">La automatización cruza operación, documentación y precio</div></div><span class="status green">Control activo</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>SERVICIO</th><th>CLIENTE</th><th>REFERENCIA</th><th>FECHA</th><th>IMPORTE</th><th>ESTADO</th><th>ACCIÓN</th></tr></thead><tbody>${invoicePageRows()}</tbody></table></div><div class="table-foot">La preparación y emisión real de facturas no está conectada en esta demo.</div></section>`;
}
function incidentsPage() {
  const rows = state.alerts.map(a => `<tr><td><i class="priority-dot ${a.priority === 'medium' ? 'medium' : a.priority === 'low' ? 'low' : ''}" style="display:inline-block;vertical-align:middle;margin-right:8px"></i><b style="color:#46536a">${escapeHtml(a.title)}</b></td><td><a class="id-link" data-service="${a.serviceId}">${a.serviceId}</a></td><td>${escapeHtml(a.description)}</td><td>${statusPill(a.priority === 'high' ? 'Abierta' : 'Pendiente')}</td><td><div style="display:flex;gap:6px"><button class="btn btn-small" data-alert="${a.id}">${escapeHtml(a.action)}</button><button class="btn btn-small btn-communicate" data-communicate="${a.id}">↗ Comunicar</button></div></td></tr>`).join('');
  return `${pageHeader('Incidencias y alertas', 'Excepciones operativas que necesitan seguimiento y comunicación.', '<button class="btn btn-primary" data-toast="Nueva incidencia creada (simulación)">＋ Registrar incidencia</button>')}<div class="page-metrics"><span class="mini-metric">Abiertas <b>${state.alerts.length}</b></span><span class="mini-metric">Prioridad alta <b>${state.alerts.filter(a => a.priority === 'high').length}</b></span><span class="mini-metric">Tiempo medio de resolución <b>1 h 24 min</b></span><span class="mini-metric">Canal de contacto <b>Configurable</b></span></div><section class="panel" style="margin-top:14px"><div class="panel-head"><div><div class="panel-title">Seguimiento y comunicación</div><div class="panel-subtitle">Elige el canal adecuado para informar al cliente o al equipo responsable.</div></div><span class="status blue">WhatsApp · Chatbot · Responsable</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>INCIDENCIA</th><th>SERVICIO</th><th>DETALLE</th><th>ESTADO</th><th>ACCIÓN</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No hay incidencias abiertas</td></tr>'}</tbody></table></div></section>`;
}
function automationsPage() {
  const cards = automationRules.map(a => `<article class="automation-card"><div class="automation-card-head"><span class="automation-symbol">${a.icon}</span><span class="status green">ACTIVA</span></div><h3 style="margin-top:13px">${escapeHtml(a.title)}</h3><p>${escapeHtml(a.subtitle)}</p><div class="alert-detail"><b>Trigger:</b> ${escapeHtml(a.trigger)}</div><div style="padding:11px 0 5px;color:#9aa5b4;font-size:9px">ACCIONES</div>${a.steps.map((step,i)=>`<div class="automation-row" style="padding:5px 0"><span class="check-mark">${i+1}</span><div class="automation-copy"><b style="font-size:9px">${escapeHtml(step)}</b></div></div>`).join('')}<div class="table-foot" style="padding:10px 0 0;margin-top:7px">${escapeHtml(a.runs)} · Última ejecución hace 4 min</div></article>`).join('');
  return `${pageHeader('Automatizaciones', 'Reglas activas que conectan documentos, operaciones y tareas administrativas.', '<button class="btn btn-primary" data-toast="Constructor de reglas disponible en el producto futuro">＋ Nueva automatización</button>')}<div class="page-metrics"><span class="mini-metric">Activas <b>3</b></span><span class="mini-metric">Ejecuciones hoy <b>342</b></span><span class="mini-metric">Tareas manuales evitadas <b>86</b></span></div><div class="automation-grid panel" style="margin-top:14px">${cards}</div>`;
}
function customersPage() {
  const rows=customers.map(c=>`<tr><td class="customer-cell"><span class="customer-avatar">${c.initials}</span>${escapeHtml(c.name)}</td><td>${c.services} servicios este mes</td><td class="amount-cell">${euros(c.revenue)}</td><td>${statusPill(c.status)}</td><td><button class="btn btn-small" data-toast="Ficha de ${escapeHtml(c.name)}">Ver ficha</button></td></tr>`).join('');
  return `${pageHeader('Clientes', 'Cartera de clientes y actividad operativa.', '<button class="btn btn-primary" data-toast="Alta de cliente simulada">＋ Añadir cliente</button>')}<section class="panel">${toolbar('Buscar cliente','Todos los clientes')}<div class="table-wrap"><table class="data-table"><thead><tr><th>CLIENTE</th><th>ACTIVIDAD</th><th>FACTURACIÓN MES</th><th>ESTADO</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}
function vehiclesPage() {
  const rows=vehicles.map(v=>`<tr><td class="customer-cell">${v.plate}</td><td>${escapeHtml(v.type)}</td><td>${escapeHtml(v.driver)}</td><td>${statusPill(v.status)}</td><td>${escapeHtml(v.location)}</td><td>${statusPill(v.docs)}</td></tr>`).join('');
  return `${pageHeader('Vehículos', 'Disponibilidad y documentación de la flota.', '<button class="btn" data-toast="Sincronización con GESS simulada">↻ Sincronizar</button><button class="btn btn-primary" data-toast="Alta de vehículo simulada">＋ Añadir vehículo</button>')}<div class="page-metrics"><span class="mini-metric">Vehículos <b>24</b></span><span class="mini-metric">En ruta <b>18</b></span><span class="mini-metric">Disponibles <b>4</b></span><span class="mini-metric">Revisión documental <b>2</b></span></div><section class="panel" style="margin-top:14px"><div class="panel-head"><div class="panel-title">Estado de flota</div><span class="sync-indicator"><i></i> Datos de demo</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>MATRÍCULA</th><th>VEHÍCULO</th><th>CONDUCTOR</th><th>ESTADO</th><th>UBICACIÓN / RUTA</th><th>DOCUMENTOS</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}
function settingsPage() {
  const rows=[['Procesamiento de pedidos','Extraer datos de emails y adjuntos'],['Avisos a clientes','Revisar antes de enviar notificaciones'],['Control de POD','Solicitar documentos pendientes automáticamente'],['Conector GPS','GESS · pendiente de credenciales y API']];
  return `${pageHeader('Configuración', 'Preferencias de la demo y conexiones del espacio de trabajo.')}<div class="split-layout"><section class="panel"><div class="panel-head"><div class="panel-title">Preferencias de automatización</div></div>${rows.map((r,i)=>`<div class="switch-row"><div><b>${r[0]}</b><small>${r[1]}</small></div><span class="toggle"></span></div>`).join('')}</section><section class="panel"><div class="panel-head"><div class="panel-title">Integraciones</div></div><div class="doc-list"><div class="doc-row"><span class="automation-symbol">G</span><span class="doc-name"><b>GESS Geolocalización</b><small>Conexión futura · API por confirmar</small></span><span class="status orange">Pendiente</span></div><div class="doc-row"><span class="automation-symbol">▤</span><span class="doc-name"><b>TMS / ERP</b><small>Importación de datos simulada</small></span><span class="status gray">Demo</span></div><div class="doc-row"><span class="automation-symbol">✉</span><span class="doc-name"><b>Email</b><small>Pedidos simulados</small></span><span class="status gray">Demo</span></div></div></section></div>`;
}
function serviceDetailPage(id) {
  const s=state.services.find(item=>item.id===id) || state.services[0];
  const isNew=s.id===demoOrder.id;
  const timeline=[['Pedido recibido',true,'06 oct · 07:42'],['Datos extraídos y validados',true,'06 oct · 07:43'],['Servicio creado',true,'06 oct · 07:44'],['Vehículo asignado',true,'06 oct · 07:46'],['Carga iniciada',true,'06 oct · 08:02'],['En tránsito',s.status!=='En curso','06 oct · 08:18'],['Entrega',s.status==='Entregado','Pendiente'],['POD',s.pod==='Recibido','Pendiente'],['Facturación',s.invoiceStatus==='Facturado','Pendiente']];
  const action = s.status === 'En curso' ? `<button class="btn btn-primary" data-service-action="deliver" data-id="${s.id}">Marcar como entregado</button>` : s.pod !== 'Recibido' ? `<button class="btn btn-primary" data-service-action="pod" data-id="${s.id}">Simular recepción de POD</button>` : s.invoiceStatus !== 'Facturado' ? `<button class="btn btn-primary" data-invoice="${s.id}">Preparar para facturar</button>` : '';
  const timelineMarkup=timeline.map(([label,done,time])=>`<div class="timeline-item"><span class="timeline-point ${done?'':'pending'}">${done?'✓':'·'}</span><div class="timeline-copy"><b>${label}</b><small>${time}</small></div></div>`).join('');
  return `${pageHeader(`Servicio ${s.id}`, `${s.customer} · ${s.date}`, `<button class="btn" data-page="servicios">← Volver a servicios</button>${action}`)}<div class="split-layout"><section class="panel"><div class="panel-head"><div class="panel-title">Detalle de la operación</div>${statusPill(s.status)}</div><div class="service-detail"><div class="detail-grid"><div><div class="detail-label">CLIENTE</div><div class="detail-value">${escapeHtml(s.customer)}</div></div><div><div class="detail-label">ORIGEN</div><div class="detail-value">${escapeHtml(s.origin)}</div></div><div><div class="detail-label">DESTINO</div><div class="detail-value">${escapeHtml(s.destination)}</div></div><div><div class="detail-label">FECHA / CARGA</div><div class="detail-value">${escapeHtml(s.date)} · ${s.time}</div></div><div><div class="detail-label">VEHÍCULO</div><div class="detail-value">${escapeHtml(s.vehicle)}</div></div><div><div class="detail-label">CONDUCTOR</div><div class="detail-value">${escapeHtml(s.driver)}</div></div></div><div class="detail-grid"><div><div class="detail-label">PRECIO ACORDADO</div><div class="detail-value">${euros(s.price)}</div></div><div><div class="detail-label">COSTE ESTIMADO</div><div class="detail-value">${euros(s.cost)}</div></div><div><div class="detail-label">MARGEN ESTIMADO</div><div class="detail-value" style="color:#138b74">${euros(s.price-s.cost)}</div></div></div><div class="timeline"><div class="panel-title" style="margin-bottom:15px">Timeline del servicio</div>${timelineMarkup}</div></div></section><div style="display:flex;flex-direction:column;gap:12px">${card('Documentos del servicio', `<div class="doc-list">${state.documents.filter(d=>d.serviceId===s.id).map(d=>`<div class="doc-row"><span class="doc-file ${d.status==='Recibido'?'green':''}">PDF</span><span class="doc-name"><b>${escapeHtml(d.type)}</b><small>${escapeHtml(d.name)}</small></span>${statusPill(d.status)}</div>`).join('') || `<div class="doc-row"><span class="doc-file">PDF</span><span class="doc-name"><b>DeCA / carta de porte</b><small>QR disponible · Demo</small></span>${statusPill('Recibido')}</div><div class="doc-row"><span class="doc-file ${s.pod==='Recibido'?'green':''}">PDF</span><span class="doc-name"><b>POD</b><small>${s.pod==='Recibido'?'Recibido y validado':'Pendiente de entrega'}</small></span>${statusPill(s.pod)}</div>`}</div>`)}${card('Control de facturación', `<div class="service-detail"><div style="display:flex;justify-content:space-between;align-items:center"><span class="detail-label">ESTADO</span>${statusPill(s.invoiceStatus)}</div><div style="font:700 20px Manrope;margin-top:10px">${euros(s.price)}</div><div class="detail-label" style="margin-top:4px">Importe acordado con el cliente</div>${s.pod!=='Recibido'?'<div class="warning-row">⚠ Falta el POD para preparar la factura.</div>':'<div class="success-banner" style="margin-top:10px">✓ La documentación está completa.</div>'}</div>`)}</div></div>`;
}

function render() {
  if (state.page === 'detalle-servicio') { content.innerHTML = serviceDetailPage(state.currentServiceId); }
  else {
    const pages = { dashboard: dashboardPage, servicios: servicesPage, pedidos: ordersPage, documentos: documentsPage, incidencias: incidentsPage, facturacion: billingPage, automatizaciones: automationsPage, clientes: customersPage, vehiculos: vehiclesPage, configuracion: settingsPage };
    content.innerHTML = (pages[state.page] || dashboardPage)();
  }
  document.querySelector('#breadcrumbPage').textContent = state.page === 'detalle-servicio' ? 'Servicio' : labels[state.page];
  document.querySelectorAll('[data-page]').forEach(link => link.classList.toggle('active', link.dataset.page === state.page));
  document.querySelectorAll('.nav-count.alert-count').forEach(el => el.textContent = state.alerts.length);
  bindContentActions();
  if (state.page === 'dashboard') refreshSharedWorkflowPanel();
}

async function refreshSharedWorkflowPanel() {
  const panel = document.querySelector('#sharedWorkflowPanel');
  const list = document.querySelector('#transporterWorkflowEvents');
  if (!panel || !list) return;
  try {
    const response = await fetch('/api/workflow/NV-24081', { headers: { Accept: 'application/json' } });
    const workflow = await response.json();
    if (!response.ok) throw new Error(workflow.error || 'No se pudo cargar el flujo compartido.');
    const service = state.services.find(item => item.id === workflow.tripId);
    if (service) {
      if (workflow.status === 'DELIVERED') service.status = 'Entregado';
      service.pod = workflow.podStatus === 'VALIDATED' ? 'Validado' : workflow.podStatus === 'RECEIVED' ? 'Recibido' : 'Pendiente';
      service.invoiceStatus = workflow.invoiceReady ? 'Listo para facturar' : workflow.podStatus === 'RECEIVED' ? 'Validar POD' : service.invoiceStatus;
    }
    list.innerHTML = workflow.events.slice(0, 4).map(event => `<div class="workflow-event-row"><span class="driver-event-icon">${event.type.includes('POD')?'▧':event.type.includes('INCIDENT')?'⚑':event.type.includes('INVOICE')?'€':'↗'}</span><span><b>${escapeHtml(event.label)}</b><small>${escapeHtml(event.role)} · ${new Date(event.at).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}</small></span></div>`).join('');
    const validate = panel.querySelector('[data-workflow-action="transport_validate_pod"]');
    if (validate) validate.disabled = workflow.podStatus !== 'RECEIVED';
  } catch (error) { list.innerHTML = `<div class="workflow-action-error">${escapeHtml(error.message)}</div>`; }
  const previousButton = panel.querySelector('[data-workflow-action="transport_validate_pod"]');
  const actionButton = previousButton?.cloneNode(true);
  if (previousButton && actionButton) previousButton.replaceWith(actionButton);
  actionButton?.addEventListener('click', async event => {
    const button = event.currentTarget; button.disabled = true;
    const errorNode = panel.querySelector('#workflowActionError'); errorNode.hidden = true;
    try {
      const response = await fetch('/api/workflow/NV-24081', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'transport_validate_pod' }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo validar el POD.');
      toast('POD validado · el servicio ya puede pasar a facturación.');
      render();
    } catch (error) { errorNode.textContent = error.message; errorNode.hidden = false; button.disabled = false; }
  }, { once: true });
}
setInterval(() => { if (state.page === 'dashboard') refreshSharedWorkflowPanel(); }, 10000);

function navigate(page, id = '') {
  state.page = page;
  if (page === 'detalle-servicio') state.currentServiceId = id;
  document.querySelector('#sidebar').classList.remove('open');
  document.querySelector('.mobile-overlay')?.classList.remove('visible');
  if (page === 'detalle-servicio') history.replaceState({}, '', `#servicio/${id}`);
  else history.replaceState({}, '', `#${page}`);
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="toast-mark">✓</span><span>${escapeHtml(message)}</span>`;
  toastRoot.append(el);
  setTimeout(() => el.remove(), 3200);
}

function modalShell(title, subtitle, body, footer = '') {
  modalRoot.innerHTML = `<div class="modal-backdrop" data-backdrop><section class="modal ${title.includes('pedido')?'modal-wide':''}" role="dialog" aria-modal="true"><header class="modal-head"><div><h2>${title}</h2><p>${subtitle}</p></div><button class="modal-close" data-close aria-label="Cerrar">×</button></header>${body}${footer}</section></div>`;
  modalRoot.querySelector('[data-close]')?.addEventListener('click', closeModal);
  modalRoot.querySelector('[data-backdrop]')?.addEventListener('click', e => { if (e.target.dataset.backdrop !== undefined) closeModal(); });
  document.addEventListener('keydown', escClose, { once: true });
}
function escClose(event) { if (event.key === 'Escape') closeModal(); }
function closeModal() { modalRoot.innerHTML = ''; state.demoMode = false; }

function showProcessing(progress = 0, label = 'Esperando documento…') {
  const steps = ['Recibir', 'Extraer', 'Validar', 'Crear servicio', 'Completar'];
  const activeIndex = Math.min(4, Math.floor(progress / 22));
  const stepHtml = steps.map((s,i)=>`<span class="process-step ${i < activeIndex ? 'done' : i === activeIndex ? 'current' : ''}">${s}</span>`).join('');
  const result = progress >= 100;
  const fields = [['Cliente',demoOrder.customer],['Origen',demoOrder.origin],['Destino',demoOrder.destination],['Fecha / carga',`${demoOrder.date} · ${demoOrder.time}`],['Tipo / mercancía',`${demoOrder.type} · ${demoOrder.goods}`],['Peso',demoOrder.weight],['Vehículo',demoOrder.vehicle],['Precio acordado',euros(demoOrder.price)],['Referencia',demoOrder.reference]];
  const body = `<div class="modal-body"><div class="file-upload"><div class="pdf-badge">PDF</div><div class="file-copy"><b>pedido_transporte_10483.pdf</b><small>Recibido desde email@cliente-demo.es · 248 KB</small></div><span class="file-source">✉ Email</span></div><div class="process-progress"><div class="progress-top"><span>${result?'Procesamiento completado':label+'…'}</span><b>${progress}%</b></div><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div></div><div class="step-list">${stepHtml}</div>${result?`<div class="extracted-box"><div class="extracted-head"><b>Datos extraídos del documento</b><span class="confidence">✓ 98 % confianza</span></div><div class="checks">${fields.map(([k,v])=>`<div class="check-row"><span class="check-mark">✓</span><span><b>${escapeHtml(k)}:</b> ${escapeHtml(v)}</span></div>`).join('')}</div></div><div class="warning-row"><span>⚠</span><span><strong>Validación automática</strong><br>Cliente existente · Ruta válida · Fecha correcta · Precio en rango habitual<br>Revisar documentación del vehículo y POD tras la entrega.</span></div>`:`<div class="alert-detail" style="background:#f7f9fc;border-color:#edf0f4;color:#8290a4">El sistema está leyendo el PDF, extrayendo campos y comparándolos con los datos de la empresa…</div>`}</div>`;
  let footer;
  if (!result) footer = `<footer class="modal-actions"><span class="mock-note">Simulación con documento ficticio</span><button class="btn" data-close>Cancelar</button></footer>`;
  else if (!state.newServiceCreated) footer = `<footer class="modal-actions"><span class="mock-note">Revisa los datos antes de crear la operación.</span><button class="btn btn-primary" data-create-service>Crear servicio <span>→</span></button></footer>`;
  else footer = `<footer class="modal-actions"><span class="mock-note">Servicio creado · TR-10483</span><button class="btn btn-primary" data-continue-demo>${state.demoProgress===1?'Simular entrega y POD':'Ver servicio'} <span>→</span></button></footer>`;
  modalShell('Nuevo pedido recibido', 'Email · PDF · Procesamiento asistido', body, footer);
  modalRoot.querySelector('[data-create-service]')?.addEventListener('click', createDemoService);
  modalRoot.querySelector('[data-continue-demo]')?.addEventListener('click', continueDemo);
}
async function startSimulation(auto = false) {
  if (state.newServiceCreated) {
    if (!auto) { showCreatedModal(); return; }
    state.demoMode = true;
    if (state.demoProgress < 1) continueDemo(true);
    await new Promise(resolve => setTimeout(resolve, 550));
    if (state.demoProgress < 2) continueDemo(true);
    else showBillingReadyModal();
    return;
  }
  state.demoMode = auto;
  showProcessing(0, 'Esperando documento');
  await simulateOrderExtraction(stage => showProcessing(stage.progress, stage.label));
  if (state.demoMode) {
    await new Promise(resolve => setTimeout(resolve, 550));
    createDemoService(true);
    await new Promise(resolve => setTimeout(resolve, 700));
    continueDemo(true);
    await new Promise(resolve => setTimeout(resolve, 700));
    continueDemo(true);
  }
}
function createDemoService(automatic = false) {
  if (!state.newServiceCreated) {
    state.services.unshift({ ...demoOrder, date: demoOrder.date.toLowerCase(), status: 'En curso', invoiceStatus: 'Pendiente de entrega', pod: 'Falta', reference: demoOrder.reference });
    state.documents.unshift({ name: 'pedido_transporte_10483.pdf', type: 'Pedido cliente', status: 'Recibido', date: '06 oct · 07:42', origin: 'Email · email@cliente-demo.es', serviceId: demoOrder.id }, { name: 'deca_10483_qr.pdf', type: 'DeCA', status: 'Recibido', date: '06 oct · 07:44', origin: 'Sistema · QR disponible', serviceId: demoOrder.id }, { name: 'pod_10483.pdf', type: 'POD', status: 'Falta', date: 'Pendiente de entrega', origin: 'Sistema · Solicitud automática', serviceId: demoOrder.id });
    state.activity.unshift({ icon: '✳', color: 'green', title: 'Servicio creado automáticamente', detail: 'TR-10483 · Mercadona Demo', time: 'Ahora' });
    state.newServiceCreated = true;
    state.demoProgress = 0;
  }
  if (automatic) { showProcessing(100, 'Pedido procesado'); return; }
  showCreatedModal();
}
function showCreatedModal() {
  const body = `<div class="modal-body"><div class="success-banner"><span>✓</span><span><b>Servicio creado automáticamente</b>El pedido TR-10483 ya está en la operación.</span></div><div class="created-summary"><div class="summary-cell"><span>CLIENTE</span><b>${demoOrder.customer}</b></div><div class="summary-cell"><span>RUTA</span><b>${demoOrder.origin} → ${demoOrder.destination}</b></div><div class="summary-cell"><span>PRECIO</span><b>${euros(demoOrder.price)}</b></div><div class="summary-cell"><span>VEHÍCULO</span><b>${demoOrder.vehicle}</b></div><div class="summary-cell"><span>CONDUCTOR</span><b>${demoOrder.driver}</b></div><div class="summary-cell"><span>ESTADO</span><b>En curso · POD pendiente</b></div></div><div class="warning-row" style="margin-bottom:0"><span>↳</span><span><strong>Siguiente paso de la demo:</strong> marca la entrega, simula el POD y observa cómo el servicio queda listo para facturar.</span></div></div>`;
  modalShell('Servicio TR-10483 creado', 'La información del PDF se convirtió en una operación', body, `<footer class="modal-actions"><button class="btn" data-view-service>Ver ficha del servicio</button><button class="btn btn-primary" data-continue-demo>Continuar el flujo demo →</button></footer>`);
  modalRoot.querySelector('[data-view-service]').addEventListener('click',()=>{closeModal();navigate('detalle-servicio',demoOrder.id);});
  modalRoot.querySelector('[data-continue-demo]').addEventListener('click',()=>continueDemo(false));
}
function continueDemo(automatic = false) {
  const service=state.services.find(s=>s.id===demoOrder.id);
  if (!service) return;
  if (state.demoProgress===0) {
    service.status='Entregado';
    service.invoiceStatus='Falta POD';
    state.demoProgress=1;
    state.alerts.unshift({id:'demo-pod',priority:'high',title:'Servicio entregado sin POD',description:'TR-10483 · Entrega confirmada hace unos minutos',action:'Solicitar POD',serviceId:demoOrder.id});
    state.activity.unshift({icon:'⚑',color:'orange',title:'Entrega confirmada · POD pendiente',detail:'TR-10483 · Se inicia seguimiento documental',time:'Ahora'});
    toast('Entrega confirmada. El sistema ha detectado que falta el POD.');
  } else if (state.demoProgress===1) {
    service.pod='Recibido';
    service.invoiceStatus='Listo para facturar';
    state.demoProgress=2;
    state.documents=state.documents.map(d=>d.serviceId===demoOrder.id&&d.type==='POD'?{...d,status:'Recibido',date:'06 oct · 10:12',origin:'App conductor · Validado'}:d);
    state.alerts=state.alerts.filter(a=>a.id!=='demo-pod');
    state.activity.unshift({icon:'€',color:'green',title:'Servicio listo para facturar',detail:'TR-10483 · POD recibido y validado',time:'Ahora'});
    toast('POD recibido. TR-10483 está listo para facturar.');
  } else {
    if (automatic) showBillingReadyModal();
    else { closeModal(); navigate('detalle-servicio',demoOrder.id); }
    return;
  }
  render();
  if (automatic) {
    state.demoMode=state.demoProgress<2;
    if (state.demoProgress===2) showBillingReadyModal();
    return;
  }
  if (state.demoProgress===2) {
    showBillingReadyModal();
  } else {
    showCreatedModal();
  }
}
function showBillingReadyModal() {
  const body=`<div class="modal-body"><div class="success-banner"><span>✓</span><span><b>Documentación validada</b>El servicio TR-10483 ya está listo para facturar.</span></div><div class="created-summary"><div class="summary-cell"><span>SERVICIO</span><b>TR-10483</b></div><div class="summary-cell"><span>POD</span><b>Recibido y validado</b></div><div class="summary-cell"><span>IMPORTE A FACTURAR</span><b>${euros(demoOrder.price)}</b></div></div><div class="alert-detail" style="margin-top:13px;background:#eff5ff;border-color:#dce7fb;color:#526b9c">La tarjeta de facturación del dashboard refleja ahora el servicio detectado. La cifra total de la demo es ficticia.</div></div>`;
  modalShell('Servicio listo para facturar', 'Pedido → servicio → entrega → POD → facturación', body, `<footer class="modal-actions"><button class="btn" data-view-service>Ver servicio</button><button class="btn btn-primary" data-view-billing>Ver control de facturación →</button></footer>`);
  modalRoot.querySelector('[data-view-service]').addEventListener('click',()=>{closeModal();navigate('detalle-servicio',demoOrder.id);});
  modalRoot.querySelector('[data-view-billing]').addEventListener('click',()=>{closeModal();navigate('facturacion');});
}

function openAlert(id) {
  const alert=state.alerts.find(a=>a.id===id);
  if (!alert) { toast('La alerta se ha resuelto.'); return; }
  const body=`<div class="modal-body"><div class="alert-detail"><b>${escapeHtml(alert.title)}</b><br>${escapeHtml(alert.description)}<br>Servicio relacionado: <a class="id-link" data-alert-service="${alert.serviceId}">${alert.serviceId}</a></div><p style="font-size:10px;color:#78859a;line-height:1.6">Acción recomendada: ${escapeHtml(alert.action)}. La acción se simula en esta demo; no se enviarán correos ni mensajes reales.</p></div>`;
  modalShell('Alerta operativa', 'Requiere revisión del equipo de tráfico', body, `<footer class="modal-actions"><button class="btn" data-close>Volver</button><button class="btn btn-primary" data-resolve-alert="${alert.id}">${alert.id==='demo-pod'?'Simular recepción de POD':'Marcar como resuelta'}</button></footer>`);
  modalRoot.querySelector('[data-resolve-alert]').addEventListener('click',()=>{
    if (alert.id==='demo-pod') { closeModal(); state.demoProgress=1; continueDemo(); }
    else { state.alerts=state.alerts.filter(a=>a.id!==alert.id); closeModal(); render(); toast('Alerta marcada como resuelta.'); }
  });
  modalRoot.querySelector('[data-alert-service]')?.addEventListener('click',()=>{closeModal();navigate('detalle-servicio',alert.serviceId);});
}
function openCommunication(id) {
  const alert=state.alerts.find(a=>a.id===id);
  if (!alert) { toast('La incidencia ya está resuelta.'); return; }
  let selected='whatsapp';
  const messageFor = channel => channel === 'whatsapp'
    ? `Hola, te informamos de una incidencia en el servicio ${alert.serviceId}: ${alert.title.toLowerCase()}. ${alert.description}. Estamos realizando el seguimiento.`
    : channel === 'chatbot'
      ? `Actualización del servicio ${alert.serviceId}: ${alert.title}. ${alert.description}. Puedes consultar el estado actualizado en el portal.`
      : `Incidencia ${alert.serviceId}: ${alert.title}. ${alert.description}. Por favor, revisa y registra la siguiente acción.`;
  const channels=[['whatsapp','WhatsApp','↗','Aviso al contacto del cliente'],['chatbot','Chatbot','✳','Respuesta en el portal de seguimiento'],['responsable','Responsable','♙','Tarea asignada al equipo interno']];
  const body=`<div class="modal-body"><div class="communication-context"><span class="priority-dot ${alert.priority==='medium'?'medium':alert.priority==='low'?'low':''}"></span><div><b>${escapeHtml(alert.title)}</b><small>${escapeHtml(alert.serviceId)} · ${escapeHtml(alert.description)}</small></div></div><div class="channel-label">CANAL DE COMUNICACIÓN</div><div class="channel-options">${channels.map(([key,label,icon,caption])=>`<button class="channel-option ${key===selected?'selected':''}" data-channel="${key}"><span class="channel-icon">${icon}</span><span><b>${label}</b><small>${caption}</small></span><span class="channel-check">${key===selected?'✓':''}</span></button>`).join('')}</div><label class="message-label" for="communicationMessage">MENSAJE</label><textarea id="communicationMessage" class="message-preview" rows="3">${escapeHtml(messageFor(selected))}</textarea><div class="communication-footnote">Vista previa de demo. No se enviará ningún WhatsApp ni mensaje real.</div></div>`;
  modalShell('Comunicar incidencia', 'Selecciona cómo informar y quién debe actuar.', body, `<footer class="modal-actions"><span class="mock-note">Canal configurable por empresa</span><button class="btn btn-primary" data-send-communication>Simular comunicación →</button></footer>`);
  modalRoot.querySelectorAll('[data-channel]').forEach(button=>button.addEventListener('click',()=>{
    selected=button.dataset.channel;
    modalRoot.querySelectorAll('[data-channel]').forEach(option=>{option.classList.toggle('selected',option.dataset.channel===selected);option.querySelector('.channel-check').textContent=option.dataset.channel===selected?'✓':'';});
    modalRoot.querySelector('#communicationMessage').value=messageFor(selected);
  }));
  modalRoot.querySelector('[data-send-communication]').addEventListener('click',()=>{
    const labels={whatsapp:'WhatsApp',chatbot:'chatbot del portal',responsable:'persona responsable'};
    state.activity.unshift({icon:selected==='whatsapp'?'↗':selected==='chatbot'?'✳':'♙',color:selected==='responsable'?'orange':'blue',title:`Comunicación preparada · ${labels[selected]}`,detail:`${alert.serviceId} · ${alert.title}`,time:'Ahora'});
    closeModal();
    if(state.page==='dashboard') render();
    toast(`Comunicación simulada mediante ${labels[selected]}.`);
  });
}
function markInvoice(id) {
  const s=state.services.find(item=>item.id===id);
  if (!s) return;
  const canPrepare=s.pod==='Recibido';
  const body=`<div class="modal-body"><div class="created-summary"><div class="summary-cell"><span>SERVICIO</span><b>${s.id}</b></div><div class="summary-cell"><span>CLIENTE</span><b>${escapeHtml(s.customer)}</b></div><div class="summary-cell"><span>IMPORTE</span><b>${euros(s.price)}</b></div></div>${canPrepare?'<div class="success-banner" style="margin-top:12px">✓ Documentación disponible para preparar la factura.</div>':'<div class="warning-row"><span>⚠</span><span>Falta documentación obligatoria de esta operación (POD). Puedes revisar el servicio, pero no marcarlo listo para facturar.</span></div>'}</div>`;
  modalShell('Revisión de facturación', 'Comprobación previa · No se emite ninguna factura real', body, `<footer class="modal-actions"><button class="btn" data-close>Cancelar</button><button class="btn btn-primary" ${canPrepare?'data-mark-ready':''}>${canPrepare?'Marcar facturado (demo)':'Revisar documentación'}</button></footer>`);
  modalRoot.querySelector('[data-mark-ready]')?.addEventListener('click',()=>{s.invoiceStatus='Facturado';closeModal();render();toast(`${s.id} marcada como facturada en la demo.`);});
}
function bindContentActions() {
  content.querySelectorAll('[data-page]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();navigate(el.dataset.page);}));
  content.querySelectorAll('[data-simulate]').forEach(el=>el.addEventListener('click',()=>startSimulation(false)));
  content.querySelectorAll('[data-demo-tour]').forEach(el=>el.addEventListener('click',()=>startSimulation(true)));
  content.querySelectorAll('[data-service]').forEach(el=>el.addEventListener('click',()=>navigate('detalle-servicio',el.dataset.service)));
  content.querySelectorAll('[data-alert]').forEach(el=>el.addEventListener('click',()=>openAlert(el.dataset.alert)));
  content.querySelectorAll('[data-communicate]').forEach(el=>el.addEventListener('click',()=>openCommunication(el.dataset.communicate)));
  content.querySelectorAll('[data-invoice]').forEach(el=>el.addEventListener('click',()=>markInvoice(el.dataset.invoice)));
  content.querySelectorAll('[data-service-action]').forEach(el=>el.addEventListener('click',()=>{
    const s=state.services.find(item=>item.id===el.dataset.id);
    if (el.dataset.serviceAction==='deliver') { state.demoProgress=0; continueDemo(); }
    else if(el.dataset.serviceAction==='pod') { state.demoProgress=1; continueDemo(); }
  }));
  content.querySelectorAll('[data-toast]').forEach(el=>el.addEventListener('click',()=>toast(el.dataset.toast)));
  content.querySelectorAll('[data-open-document]').forEach(el=>el.addEventListener('click',()=>toast(`Documento de demostración: ${el.dataset.openDocument}`)));
  content.querySelectorAll('[data-search]').forEach(input=>input.addEventListener('input',()=>{
    const q=input.value.toLowerCase();
    content.querySelectorAll('.data-table tbody tr').forEach(row=>row.style.display=row.textContent.toLowerCase().includes(q)?'':'none');
  }));
}

document.querySelector('#sidebar').insertAdjacentHTML('afterend','<div class="mobile-overlay"></div>');
document.querySelector('#mobileMenu').addEventListener('click',()=>{document.querySelector('#sidebar').classList.toggle('open');document.querySelector('.mobile-overlay').classList.toggle('visible');});
document.querySelector('.mobile-overlay').addEventListener('click',()=>{document.querySelector('#sidebar').classList.remove('open');document.querySelector('.mobile-overlay').classList.remove('visible');});
document.querySelector('#helpButton').addEventListener('click',()=>toast('Demo comercial · Todos los datos mostrados son ficticios.'));
window.addEventListener('hashchange',()=>{const route=location.hash.slice(1);if(route.startsWith('servicio/'))navigate('detalle-servicio',route.split('/')[1]);else if(labels[route])navigate(route);});
const startingRoute=location.hash.slice(1);
if (startingRoute.startsWith('servicio/')) { state.page='detalle-servicio';state.currentServiceId=startingRoute.split('/')[1]; }
else if(labels[startingRoute]) state.page=startingRoute;
render();
