import { shipments, documents, incidents, invoices } from './portalData.js';

const state={page:'inicio',tripId:null,mapLayer:'geographic',googleMapsEmbedKey:null,shipments:structuredClone(shipments),documents:structuredClone(documents),incidents:structuredClone(incidents)};
let trackingPoller=null;
let mapsConfigPromise=null;
const content=document.querySelector('#portalContent');
const modalRoot=document.querySelector('#portalModal');
const toastRoot=document.querySelector('#portalToast');
const pageNames={inicio:'Resumen',seguimiento:'Seguimiento',pedidos:'Pedidos',documentos:'Documentación',incidencias:'Incidencias',facturacion:'Facturación'};
const money=value=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(value);
const safe=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const route=s=>`<span class="route-points"><b>${safe(s.origin)}</b><i>→</i><b>${safe(s.destination)}</b></span>`;

function pill(text){
  const key=/entregado|pagada|disponible|resuelta/i.test(text)?'good':/tránsito|carga iniciada|revisión|pendiente de pago/i.test(text)?'blue':/incidencia|retraso|dañad|atención/i.test(text)?'warn':'neutral';
  return `<span class="state-pill ${key}"><i></i>${safe(text)}</span>`;
}
function head(eyebrow,title,description,actions=''){
  return `<div class="portal-page-head"><div><div class="portal-eyebrow">PORTAL DE CLIENTE <span>/</span> ${safe(pageNames[state.page]||'Seguimiento')}</div><h1>${title}</h1><p>${description}</p></div><div class="portal-head-actions">${actions}</div></div>`;
}
function btn(label,attrs='',primary=false,icon=''){
  return `<button class="portal-btn ${primary?'portal-btn-primary':''}" ${attrs}>${icon?`<span>${icon}</span>`:''}${label}</button>`;
}
function actionButtons(s){
  return `<div class="trip-actions" aria-label="Acciones para ${safe(s.id)}"><button class="trip-action" title="Llamar al conductor" aria-label="Llamar al conductor" data-contact="${s.id}" data-channel="call">☎</button><button class="trip-action" title="Añadir incidencia o comentario" aria-label="Añadir incidencia o comentario" data-add-incident="${s.id}">＋</button><button class="trip-action whatsapp-action" title="WhatsApp" aria-label="WhatsApp" data-contact="${s.id}" data-channel="whatsapp">◉</button><button class="trip-action" title="Email" aria-label="Email" data-contact="${s.id}" data-channel="email">✉</button></div>`;
}
function updateNav(){
  document.querySelector('#portalBreadcrumb').textContent=pageNames[state.page]||'Detalle del viaje';
  document.querySelectorAll('.portal-nav-item').forEach(a=>a.classList.toggle('active',a.dataset.page===state.page));
  document.querySelector('#incidentCount').textContent=state.incidents.filter(i=>i.status!=='Resuelta').length;
}
function metric(label,value,detail,icon,color=''){
  return `<article class="portal-metric"><div class="portal-metric-head"><span>${label}</span><i class="metric-icon ${color}">${icon}</i></div><strong>${value}</strong><small>${detail}</small></article>`;
}
function card(title,body,aside=''){
  return `<section class="portal-card"><header class="portal-card-head"><div><h2>${title}</h2></div>${aside}</header>${body}</section>`;
}
function tripTimeline(s){
  const completed=s.status==='Entregado';
  const steps=[
    {title:'Recogida planificada',time:s.plannedPickup,done:true,sub:'Hora confirmada por el transportista'},
    {title:'Recogida real',time:s.actualPickup,done:true,sub:'Registro del conductor'},
    {title:completed?'Entrega planificada':'Entrega prevista',time:s.plannedDelivery,done:true,sub:'Plan de transporte'},
    {title:completed?'Entrega real · Servicio finalizado':`ETA actual · ${s.eta}`,time:completed?s.actualDelivery:`Última posición: ${s.lastPosition}`,done:completed,sub:completed?'Servicio finalizado':`Actualizado a las ${s.updated}`}
  ];
  return `<div class="trip-timeline">${steps.map((step,i)=>`<div class="timeline-stage ${step.done?'stage-done':''} ${i===3&&!completed?'stage-current':''}"><span class="timeline-node">${step.done?'✓':i+1}</span><div class="timeline-stage-copy"><b ${i===3&&!completed?'data-track-eta':''}>${safe(step.title)}</b><small>${step.sub}</small></div><time ${i===3?'data-track-time':''}>${safe(step.time)}</time></div>`).join('')}</div>`;
}
function tripCard(s){
  return `<article class="shipment-card"><div class="shipment-card-top"><div><div class="reference-line"><span class="route-glyph">↗</span><span>Referencia <b>${safe(s.reference)}</b></span><span class="separator">·</span><a data-trip="${s.id}">${safe(s.id)}</a></div><div class="shipment-route">${route(s)}</div></div><div class="shipment-status">${pill(s.status)}</div></div><div class="shipment-card-meta"><span><i class="meta-icon">◷</i> Entrega prevista <b>${safe(s.plannedDelivery)}</b></span><span><i class="meta-icon">⌖</i> ${safe(s.lastPosition)}</span>${s.temperature?`<span><i class="meta-icon temp-icon">⌁</i> ${safe(s.temperature)}</span>`:''}</div><div class="shipment-progress"><div class="progress-track"><i style="width:${s.progress}%"></i></div><small>${s.progress}% del trayecto</small></div><div class="shipment-card-footer"><button class="portal-text-action" data-trip="${s.id}">Ver seguimiento completo <span>→</span></button>${actionButtons(s)}</div></article>`;
}
function homePage(){
  const active=state.shipments.filter(s=>s.status!=='Entregado');
  const awaiting=state.documents.filter(d=>d.status==='Pendiente').length;
  const recent=state.shipments.slice(0,4).map(s=>`<div class="recent-trip"><span class="recent-route-icon">${s.status==='Entregado'?'✓':'↗'}</span><div class="recent-copy"><a data-trip="${s.id}">${safe(s.id)} · ${safe(s.reference)}</a><small>${safe(s.origin)} → ${safe(s.destination)}</small></div><div class="recent-status">${pill(s.status)}</div><time>${s.actualDelivery?`Entregado ${s.actualDelivery}`:`ETA ${s.eta}`}</time></div>`).join('');
  return `${head('Hola, Laura','Tus transportes, siempre localizados','Consulta el estado, los documentos y cualquier novedad de tus envíos.')}
    <div class="portal-welcome-row"><div><b>Resumen de operaciones</b><span> · Lunes, 5 de octubre de 2026</span></div><span class="api-sync-pill"><i></i> Actualización automática · hoy ${state.shipments[0].updated}</span></div>
    <div class="portal-metrics-grid">${metric('En curso',String(active.length),'Viajes con seguimiento activo','↗','blue')}${metric('Entregados hoy','2','Última entrega a las 11:42','✓','green')}${metric('Documentos disponibles',String(state.documents.filter(d=>d.status==='Disponible').length),'DeCA, POD y facturas','▧','purple')}${metric('Incidencias abiertas',String(state.incidents.filter(i=>i.status!=='Resuelta').length),'En viajes de este mes','⚑','amber')}</div>
    <div class="home-layout"><div class="home-main">${card('Envíos en seguimiento',`<div class="shipment-list">${active.map(tripCard).join('')}</div>`,`<a class="portal-link" data-page="seguimiento">Ver todos <span>→</span></a>`)}${card('Actividad reciente',`<div class="recent-list">${recent}</div>`,`<a class="portal-link" data-page="pedidos">Todos los pedidos <span>→</span></a>`)}</div>
    <aside class="home-side">${card('Atención y documentos',`<div class="attention-block"><span class="attention-symbol ${awaiting?'warn':''}">${awaiting?'!':'✓'}</span><div><b>${awaiting?`${awaiting} documento pendiente`:'Documentación al día'}</b><small>${awaiting?'POD pendiente del viaje NV-24081':'Tienes disponibles los documentos de tus viajes.'}</small></div></div><div class="attention-block"><span class="attention-symbol">⚑</span><div><b>${state.incidents.filter(i=>i.status!=='Resuelta').length} incidencias en seguimiento</b><small>Consulta observaciones y no conformidades.</small></div></div>`,`<a class="portal-link" data-page="documentos">Ir a documentos <span>→</span></a>`)}<div class="api-info-card"><div class="api-info-icon">⌁</div><div><b>Conector de seguimiento</b><p>El portal está preparado para recibir posiciones y temperatura desde GEStracking.</p><span><i></i> Datos de demostración · conexión pendiente</span></div></div><div class="customer-help-card"><div class="customer-help-icon">✦</div><b>¿Necesitas más información?</b><p>Contacta con el conductor o con nuestro equipo desde cada viaje.</p><button data-contact-support>Contactar con soporte <span>→</span></button></div></aside></div>`;
}
function trackingPage(){
  const list=state.shipments.map(s=>`<article class="tracking-row"><div class="tracking-main"><div class="tracking-ref"><b>${safe(s.id)}</b><span>Ref. ${safe(s.reference)}</span></div><div class="tracking-route">${route(s)}<small>${safe(s.goods)} · ${safe(s.weight)} ${s.temperature?`· <b class="temperature-value">${safe(s.temperature)}</b>`:''}</small></div><div class="tracking-time"><span>${s.status==='Entregado'?'ENTREGA REAL':'ETA ACTUAL'}</span><b>${s.actualDelivery||s.eta}</b><small>Planificada ${s.plannedDelivery}</small></div><div class="tracking-state">${pill(s.status)}</div><button class="portal-small-link" data-trip="${s.id}">Detalle →</button></div><div class="tracking-row-bottom"><div class="mini-timeline"><span class="mini-step complete"><i>✓</i> Recogida ${s.actualPickup}</span><span class="mini-line ${s.status==='Entregado'?'complete':''}"></span><span class="mini-step ${s.status==='Entregado'?'complete':'current'}"><i>${s.status==='Entregado'?'✓':'•'}</i> ${s.status==='Entregado'?`Entregado ${s.actualDelivery}`:`En ruta · ${s.updated}`}</span><span class="mini-line ${s.status==='Entregado'?'complete':''}"></span><span class="mini-step ${s.status==='Entregado'?'complete':'future'}"><i>${s.status==='Entregado'?'✓':'○'}</i> Entrega ${s.plannedDelivery}</span></div>${actionButtons(s)}</div></article>`).join('');
  return `${head('Seguimiento de viajes','Consulta los horarios planificados y las actualizaciones en tiempo real.','La hora actualizada, la ubicación y el estado proceden del sistema de transporte conectado.',`<span class="api-sync-pill"><i></i> API sincronizada · ${state.shipments[0].updated}</span>`)}<div class="tracking-summary"><span>En curso <b>${state.shipments.filter(s=>s.status!=='Entregado').length}</b></span><span>Entregados hoy <b>${state.shipments.filter(s=>s.status==='Entregado').length}</b></span><span>Con temperatura controlada <b>${state.shipments.filter(s=>s.temperature).length}</b></span></div><section class="portal-card tracking-card"><header class="portal-card-head"><div><h2>Todos tus viajes</h2><p>Selecciona un viaje para consultar referencias, mercancía, horarios y documentos.</p></div><label class="portal-search"><span>⌕</span><input data-search placeholder="Buscar referencia o destino" /></label></header><div class="tracking-list">${list}</div><div class="portal-table-foot">Mostrando ${state.shipments.length} viajes · Horarios en hora local</div></section>`;
}
function ordersPage(){
  const rows=state.shipments.map(s=>`<tr><td><a class="table-main-link" data-trip="${s.id}">${safe(s.order)}</a><small>${safe(s.reference)}</small></td><td><a class="table-main-link" data-trip="${s.id}">${safe(s.id)}</a><small>${safe(s.cargo)}</small></td><td>${route(s)}</td><td>${safe(s.plannedPickup)}<small>Real ${safe(s.actualPickup)}</small></td><td>${s.actualDelivery||s.eta}<small>${s.actualDelivery?'Entrega real':`Plan ${s.plannedDelivery}`}</small></td><td>${pill(s.status)}</td><td><button class="portal-small-link" data-trip="${s.id}">Abrir pedido →</button></td></tr>`).join('');
  return `${head('Pedidos','Todos tus pedidos de transporte en un solo lugar.','Consulta cada referencia, el estado actual y la acción disponible.') }<div class="order-statline"><span class="api-sync-pill"><i></i> Pedidos recibidos automáticamente por API</span><span class="data-note">Actualizado hoy a las ${state.shipments[0].updated}</span></div><section class="portal-card"><header class="portal-card-head"><div><h2>Historial de pedidos</h2><p>De la recogida a la entrega o cierre del servicio.</p></div><label class="portal-search"><span>⌕</span><input data-search placeholder="Buscar pedido o referencia" /></label></header><div class="portal-table-wrap"><table class="portal-table"><thead><tr><th>PEDIDO / REFERENCIA</th><th>VIAJE / MERCANCÍA</th><th>RUTA</th><th>RECOGIDA</th><th>ENTREGA</th><th>ESTADO</th><th>ACCIÓN</th></tr></thead><tbody>${rows}</tbody></table></div><div class="portal-table-foot">Los datos de pedido los facilita automáticamente el transportista mediante API.</div></section>`;
}
function documentsPage(){
  const rows=state.documents.map(d=>`<tr><td><div class="doc-cell"><span class="doc-type-icon ${d.kind.includes('Factura')?'invoice-doc':''}">PDF</span><span><b>${safe(d.name)}</b><small>${safe(d.kind)}</small></span></div></td><td><a class="table-main-link" data-trip="${d.trip}">${safe(d.trip)}</a></td><td>${safe(d.date)}</td><td>${pill(d.status)}</td><td><button class="portal-small-link" data-document="${d.id}">Ver documento ↗</button></td></tr>`).join('');
  return `${head('Documentación','Documentos asociados a tus pedidos y servicios.','Consulta DeCA, cartas de porte, pruebas de entrega, incidencias y facturas.') }<div class="portal-filter-row"><span class="filter-chip selected">Todos <b>${state.documents.length}</b></span><span class="filter-chip">DeCA y cartas de porte</span><span class="filter-chip">POD</span><span class="filter-chip">Facturas</span><span class="filter-chip">Incidencias</span></div><section class="portal-card"><header class="portal-card-head"><div><h2>Documentos disponibles</h2><p>Compartidos por el transportista para tus operaciones.</p></div><label class="portal-search"><span>⌕</span><input data-search placeholder="Buscar documento o viaje" /></label></header><div class="portal-table-wrap"><table class="portal-table"><thead><tr><th>DOCUMENTO</th><th>VIAJE</th><th>FECHA</th><th>ESTADO</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="portal-table-foot">Los documentos se publican automáticamente al recibirse en el sistema del transportista.</div></section>`;
}
function incidentsPage(){
  const rows=state.incidents.map(i=>`<article class="incident-card"><div class="incident-card-top"><div class="incident-kind"><span class="incident-icon ${i.status==='Resuelta'?'done':''}">${i.kind.includes('No conformidad')?'⚑':'ⓘ'}</span><div><span class="incident-type-label">${safe(i.kind)} · ${safe(i.id)}</span><h3>${safe(i.title)}</h3></div></div>${pill(i.status)}</div><div class="incident-description">${safe(i.detail)}</div><div class="incident-card-bottom"><span><a class="table-main-link" data-trip="${i.trip}">${safe(i.trip)}</a> <span class="muted">· ${safe(i.time)} · ${safe(i.owner)}</span></span><button class="portal-small-link" data-trip="${i.trip}">Ver viaje asociado →</button></div></article>`).join('')||'<div class="empty-portal"><b>No hay incidencias registradas</b><span>Si se genera una incidencia durante el transporte, aparecerá aquí.</span></div>';
  return `${head('Incidencias por viaje','Consulta no conformidades y problemas derivados del transporte.','Las incidencias se vinculan al servicio y se actualizan cuando el transportista registra una novedad.',btn('Añadir comentario','data-add-incident="NV-24081"',true,'＋'))}<div class="incident-info"><span class="incident-info-icon">i</span><p>Las incidencias incluyen observaciones de recogida, retrasos, daños, esperas y no conformidades comunicadas durante o después del servicio.</p></div><div class="incident-list">${rows}</div>`;
}
function billingPage(){
  const rows=invoices.map(inv=>`<tr><td><a class="table-main-link" data-invoice="${inv.id}">${safe(inv.id)}</a><small>Servicio ${safe(inv.trip)}</small></td><td>${safe(inv.date)}</td><td>${safe(inv.due)}</td><td class="invoice-amount">${money(inv.amount)}</td><td>${pill(inv.status)}</td><td><button class="portal-small-link" data-invoice="${inv.id}">Ver factura ↗</button></td></tr>`).join('');
  const openAmount=invoices.filter(i=>i.status!=='Pagada').reduce((sum,i)=>sum+i.amount,0);
  return `${head('Facturación','Consulta las facturas relacionadas con tus transportes.','Revisa importes, vencimientos y facturas disponibles.') }<div class="billing-overview">${metric('Facturas pendientes',String(invoices.filter(i=>i.status!=='Pagada').length),'Con fecha de vencimiento','◷','amber')}${metric('Importe pendiente',money(openAmount),'Total por pagar','€','blue')}${metric('Última factura','F-2026-1842','Emitida hoy · NV-24079','▤','green')}</div><section class="portal-card invoice-card"><header class="portal-card-head"><div><h2>Facturas</h2><p>Facturación de servicios de transporte.</p></div><label class="portal-search"><span>⌕</span><input data-search placeholder="Buscar factura o servicio" /></label></header><div class="portal-table-wrap"><table class="portal-table"><thead><tr><th>FACTURA / SERVICIO</th><th>EMISIÓN</th><th>VENCIMIENTO</th><th>IMPORTE</th><th>ESTADO</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="portal-table-foot">Para dudas sobre una factura, contacta con el transportista e indica el número de factura.</div></section>`;
}
function tripDetailPage(){
  const s=state.shipments.find(item=>item.id===state.tripId)||state.shipments[0];
  const docs=state.documents.filter(d=>d.trip===s.id);
  const tripIncidents=state.incidents.filter(i=>i.trip===s.id);
  const cargoTemperature=`<div class="detail-tile ${s.temperature?'temperature-tile':''}"><span>TEMPERATURA ${s.temperature?'ACTUAL':'DEL VEHÍCULO'}</span><b data-track-temp>${s.temperature?`⌁ ${safe(s.temperature)}`:'Sin dato de sensor'}</b><small>${s.temperature?'Lectura del sistema de transporte':'Se mostrará si GEStracking facilita el dato'}</small></div>`;
  const docRows=docs.map(d=>`<div class="detail-document"><span class="doc-type-icon">PDF</span><span><b>${safe(d.name)}</b><small>${safe(d.kind)} · ${safe(d.date)}</small></span><button class="portal-small-link" data-document="${d.id}">Abrir</button></div>`).join('')||'<div class="muted">Aún no hay documentos publicados para este viaje.</div>';
  const incidentRows=tripIncidents.map(i=>`<div class="detail-incident"><span class="incident-icon ${i.status==='Resuelta'?'done':''}">⚑</span><span><b>${safe(i.title)}</b><small>${safe(i.kind)} · ${safe(i.time)}</small></span>${pill(i.status)}</div>`).join('')||'<div class="no-incident-note">No se han registrado incidencias para este viaje.</div>';
  const actionButtons=s.status==='Entregado'?`<button class="portal-btn" data-add-incident="${s.id}">＋ Añadir incidencia o comentario</button>`:'';
  return `${head(`Viaje ${safe(s.id)}`,`Referencia ${safe(s.reference)} · ${safe(s.order)}`,`${s.origin} → ${s.destination} · ${safe(s.goods)}`,`<button class="portal-btn" data-page="seguimiento">← Volver al seguimiento</button>`)}<div class="trip-detail-layout"><div class="trip-detail-main"><section class="portal-card detail-summary-card"><div class="detail-summary-top"><div><div class="trip-route-title">${route(s)}</div><div class="detail-reference">Referencia cliente <b>${safe(s.reference)}</b> <span>· Pedido ${safe(s.order)}</span></div></div><span data-workflow-status>${pill(s.status)}</span></div><div class="detail-tiles"><div class="detail-tile"><span>MERCANCÍA</span><b>${safe(s.cargo)}</b><small>${safe(s.goods)} · ${safe(s.weight)}</small></div>${cargoTemperature}<div class="detail-tile"><span>VEHÍCULO / CONDUCTOR</span><b>${safe(s.vehicle)}</b><small>${safe(s.driver)}</small></div></div></section>${card('Horarios y estado del viaje',`<div class="detail-timeline-heading"><span>PLANIFICADO</span><span>REGISTRO REAL / ACTUALIZACIÓN</span></div>${tripTimeline(s)}<div class="last-location-box"><span class="location-pin">⌖</span><span><b data-track-location>${s.status==='Entregado'?'Servicio finalizado':`Última ubicación · ${safe(s.lastPosition)}`}</b><small data-track-updated>${s.status==='Entregado'?`Entrega real ${s.actualDelivery} · actualizado ${s.updated}`:`Posición de demostración · ${s.updated}`}</small></span><span class="live-tag" data-live-tag><i></i>${s.status==='Entregado'?'FINALIZADO':'DEMO'}</span></div><div class="ges-tracking-panel" id="gesTrackingPanel"><span class="ges-status-dot"></span><span><b>Conector GEStracking</b><small>Consultando el servidor de la demo…</small></span><button type="button" data-refresh-tracking>Actualizar</button></div><div class="ges-tracking-map" id="gesTrackingMap"><div class="ges-map-empty"><span>⌖</span><b>Esperando una coordenada válida</b><small>El mapa aparecerá cuando llegue el correo de posición.</small></div></div>`)}<section class="portal-card shared-workflow-card"><header class="portal-card-head"><div><h2>Actividad compartida del servicio</h2><p>Eventos visibles según los permisos de cada panel.</p></div><span class="workflow-live-badge"><i></i> Flujo conectado</span></header><div class="shared-workflow-events" id="sharedWorkflowFeed"><span class="muted">Cargando actividad…</span></div></section>${card('Incidencias y comentarios',`<div class="detail-incident-list">${incidentRows}</div>`,`<span class="detail-card-action">${actionButtons}</span>`)}</div><aside class="trip-detail-side">${card('Contactar por este viaje',`<p class="contact-explainer">¿Necesitas confirmar un horario o comunicar una incidencia?</p><div class="contact-driver"><span class="driver-avatar">${safe(s.driver.split(' ').map(x=>x[0]).slice(0,2).join(''))}</span><span><b>${safe(s.driver)}</b><small>Conductor asignado</small></span></div><div class="contact-actions">${actionButtonsFor(s)}</div><p class="contact-disclaimer">La llamada y los mensajes se habilitarán según los datos y canales que configure el transportista.</p>`)}${card('Documentos del viaje',`<div class="detail-doc-list">${docRows}</div>`,`<a class="portal-link" data-page="documentos">Ver todos <span>→</span></a>`)}<div class="api-side-note"><span>⌁</span><div><b>Conector GEStracking</b><small>La conexión se activa al cargar credenciales y el formato API acordado con el proveedor.</small></div></div></aside></div>`;
}
function actionButtonsFor(s){
  return `<button class="contact-action-button call-contact" aria-label="Llamar al conductor" title="Llamar al conductor" data-contact="${s.id}" data-channel="call">☎</button><button class="contact-action-button" aria-label="Añadir incidencia o comentario" title="Añadir incidencia o comentario" data-add-incident="${s.id}">＋</button><button class="contact-action-button whatsapp-action" aria-label="WhatsApp" title="WhatsApp" data-contact="${s.id}" data-channel="whatsapp">◉</button><button class="contact-action-button" aria-label="Enviar email" title="Email" data-contact="${s.id}" data-channel="email">✉</button>`;
}
function render(){
  if(trackingPoller){clearInterval(trackingPoller);trackingPoller=null;}
  if(state.page==='detalle')content.innerHTML=tripDetailPage();
  else{
    const pages={inicio:homePage,seguimiento:trackingPage,pedidos:ordersPage,documentos:documentsPage,incidencias:incidentsPage,facturacion:billingPage};
    content.innerHTML=(pages[state.page]||homePage)();
  }
  updateNav();
  bindActions();
  if(state.page==='detalle'){
    refreshTracking();
    trackingPoller=setInterval(refreshTracking,15000);
  }
}
async function refreshSharedWorkflow(){
  const feed=document.querySelector('#sharedWorkflowFeed');
  if(!feed||state.tripId!=='NV-24081')return;
  try{
    const response=await fetch('/api/workflow/NV-24081',{headers:{Accept:'application/json'}});
    if(!response.ok)return;
    const workflow=await response.json();
    feed.innerHTML=workflow.events.slice(0,4).map(event=>`<div class="shared-event"><span class="shared-event-dot"></span><span><b>${safe(event.label)}</b><small>${safe(event.role)} · ${new Date(event.at).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}</small></span></div>`).join('');
    const sharedTrip=state.shipments.find(item=>item.id===workflow.tripId);
    if(workflow.status==='DELIVERED'&&sharedTrip){
      sharedTrip.status='Entregado';
      const deliveredAt=workflow.events.find(event=>event.type==='TRIP.DELIVERED')?.at;
      const deliveryTime=deliveredAt?new Date(deliveredAt).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}):'Confirmada';
      const statusNode=document.querySelector('[data-workflow-status]');if(statusNode)statusNode.innerHTML=pill('Entregado');
      const location=document.querySelector('[data-track-location]');if(location)location.textContent='Servicio entregado · Madrid';
      const updated=document.querySelector('[data-track-updated]');if(updated)updated.textContent=`Entrega real · ${deliveryTime} · servicio finalizado`;
      const liveTag=document.querySelector('[data-live-tag]');if(liveTag)liveTag.innerHTML='<i></i>FINALIZADO';
      const eta=document.querySelector('[data-track-eta]');if(eta)eta.textContent='Entrega real · Servicio finalizado';
      const timeNode=document.querySelector('[data-track-time]');if(timeNode)timeNode.textContent=deliveryTime;
      const finalStage=document.querySelector('.trip-timeline .timeline-stage:last-child');if(finalStage){finalStage.classList.remove('stage-current');finalStage.classList.add('stage-done');finalStage.querySelector('.timeline-node').textContent='✓';const small=finalStage.querySelector('small');if(small)small.textContent='Servicio finalizado';}
    }
  }catch{/* El panel de eventos es auxiliar al seguimiento GPS. */}
}
async function syncClientWorkflow(){
  try{
    const response=await fetch('/api/workflow/NV-24081',{headers:{Accept:'application/json'}});
    if(!response.ok)return;
    const workflow=await response.json();
    const shipment=state.shipments.find(item=>item.id===workflow.tripId);
    if(!shipment)return;
    let changed=false;
    if(workflow.status==='DELIVERED'&&shipment.status!=='Entregado'){
      shipment.status='Entregado';
      const deliveredAt=workflow.events.find(event=>event.type==='TRIP.DELIVERED')?.at;
      shipment.actualDelivery=deliveredAt?new Date(deliveredAt).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}):'Confirmada';
      changed=true;
    }
    if(changed&&state.page!=='detalle')render();
  }catch{/* sincronización opcional entre los paneles demo */}
}
async function refreshTracking(){
  if(state.page!=='detalle'||!state.tripId)return;
  const panel=document.querySelector('#gesTrackingPanel');
  if(!panel)return;
  try{
    await getMapsConfig();
    const response=await fetch(`/api/tracking/${encodeURIComponent(state.tripId)}`,{headers:{Accept:'application/json'}});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'Error consultando el seguimiento.');
    const shipment=state.shipments.find(item=>item.id===state.tripId);
    if(shipment){
      shipment.lastPosition=data.location||shipment.lastPosition;
      shipment.updated=data.updatedAt||shipment.updated;
      shipment.eta=data.eta||shipment.eta;
      if(data.temperature!==undefined)shipment.temperature=data.temperature;
    }
    const location=document.querySelector('[data-track-location]');
    const updated=document.querySelector('[data-track-updated]');
    const tag=document.querySelector('[data-live-tag]');
    const temperature=document.querySelector('[data-track-temp]');
    const eta=document.querySelector('[data-track-eta]');
    if(location)location.textContent=`Última ubicación · ${data.location||'Sin dato'}`;
    const dataSource=data.source==='gestracking'?'Posición GEStracking':data.source==='gestracking-email'?'Posición recibida por correo GEStracking':'Posición de demostración';
    if(updated)updated.textContent=`${dataSource} · ${data.updatedAt||'sin marca temporal'}`;
    if(tag)tag.innerHTML=`<i></i>${data.connected?'EN DIRECTO':'DEMO'}`;
    if(eta&&data.eta)eta.textContent=`ETA actual · ${data.eta}`;
    const coords=Number.isFinite(data.latitude)&&Number.isFinite(data.longitude)?` · Coordenadas ${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)}`:'';
    if(temperature&&data.temperature)temperature.textContent=`⌁ ${data.temperature}`;
    const tempLine=data.temperature?` · Temperatura ${safe(data.temperature)}`:'';
    const liveSource=data.source==='gestracking-email'?'Correo GEStracking':data.source==='gestracking'?'API GEStracking':'Datos de demostración';
    panel.innerHTML=`<span class="ges-status-dot ${data.connected?'connected':''}"></span><span><b>${data.connected?'Seguimiento actualizado':'Conector GEStracking listo'}</b><small>${liveSource} · ${safe(data.updatedAt||'')}${tempLine}${coords}</small></span><button type="button" data-refresh-tracking>Actualizar</button>`;
    const map=document.querySelector('#gesTrackingMap');
    if(map){
      if(Number.isFinite(data.latitude)&&Number.isFinite(data.longitude)){
        const lat=data.latitude,lon=data.longitude;
        if(map.dataset.latitude!==String(lat)||map.dataset.longitude!==String(lon)||!map.querySelector('[data-map-layer]'))renderTrackingMap(map,lat,lon);
      }else map.innerHTML='<div class="ges-map-empty"><span>⌖</span><b>El mapa aparecerá cuando llegue una coordenada válida</b><small>Se actualizará al recibir un correo de posición de GEStracking.</small></div>';
    }
    await refreshSharedWorkflow();
  }catch(error){
    panel.innerHTML=`<span class="ges-status-dot error"></span><span><b>No se pudo actualizar el seguimiento</b><small>${safe(error.message)}</small></span><button type="button" data-refresh-tracking>Reintentar</button>`;
    await refreshSharedWorkflow();
  }
  panel.querySelector('[data-refresh-tracking]')?.addEventListener('click',refreshTracking,{once:true});
}
function navigate(page,id=null){
  state.page=page;
  if(page==='detalle')state.tripId=id;
  closeSidebar();
  history.replaceState({},'',page==='detalle'?`#viaje/${id}`:`#${page}`);
  render();
  window.scrollTo({top:0,behavior:'smooth'});
}
function toast(message){
  const div=document.createElement('div');div.className='portal-toast';div.innerHTML=`<span>✓</span>${safe(message)}`;toastRoot.append(div);setTimeout(()=>div.remove(),3300);
}
async function getMapsConfig(){
  if(!mapsConfigPromise)mapsConfigPromise=fetch('/api/integrations/maps').then(response=>response.ok?response.json():{}).catch(()=>({}));
  const config=await mapsConfigPromise;
  state.googleMapsEmbedKey=config.googleMapsEmbedKey||null;
}
function renderTrackingMap(map,lat,lon){
  const key=state.googleMapsEmbedKey;
  const googleUrl=`https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key||'')}&q=${lat},${lon}&zoom=15&maptype=${state.mapLayer==='satellite'?'satellite':'roadmap'}&language=es`;
  const mapFrame=key?`<iframe title="Ubicación actual del camión en Google Maps" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen src="${googleUrl}"></iframe>`:`<div class="ges-map-empty"><span>⌖</span><b>Falta configurar Google Maps Embed API</b><small>Añade GOOGLE_MAPS_EMBED_API_KEY al archivo .env. La ubicación no se enviará a otro mapa.</small></div>`;
  map.innerHTML=`<div class="map-toolbar"><div class="map-layer-toggle" role="group" aria-label="Vista de Google Maps"><button type="button" data-map-layer="geographic" class="${state.mapLayer==='geographic'?'selected':''}">Geográfica</button><button type="button" data-map-layer="satellite" class="${state.mapLayer==='satellite'?'selected':''}">Satélite</button></div><span class="map-provider-name">Google Maps</span></div><div class="map-frame">${mapFrame}</div>`;
  map.dataset.latitude=String(lat);map.dataset.longitude=String(lon);
  map.querySelectorAll('[data-map-layer]').forEach(button=>button.addEventListener('click',()=>{state.mapLayer=button.dataset.mapLayer;renderTrackingMap(map,lat,lon);}));
}
function modal(title,subtitle,body,footer=''){
  modalRoot.innerHTML=`<div class="portal-modal-backdrop" data-backdrop><section class="portal-modal" role="dialog" aria-modal="true"><header class="portal-modal-head"><div><h2>${title}</h2><p>${subtitle}</p></div><button class="portal-modal-close" data-close aria-label="Cerrar">×</button></header>${body}${footer}</section></div>`;
  modalRoot.querySelector('[data-close]').addEventListener('click',closeModal);
  modalRoot.querySelector('[data-backdrop]').addEventListener('click',e=>{if(e.target.dataset.backdrop!==undefined)closeModal();});
  document.addEventListener('keydown',escClose,{once:true});
}
function escClose(e){if(e.key==='Escape')closeModal();}
function closeModal(){modalRoot.innerHTML='';}
function openContact(id,channel){
  const s=state.shipments.find(x=>x.id===id)||state.shipments[0];
  const captions={call:'Llamar al conductor',whatsapp:'Contactar por WhatsApp',email:'Enviar email'};
  const contactValue=channel==='call'?s.phone:channel==='whatsapp'?s.phone:'logistica@novadistribucion.es';
  const draft=channel==='call'?`Contactar con ${s.driver} para consultar el viaje ${s.id} (${s.reference}).`:`Hola, consulto el estado del transporte ${s.id}, referencia ${s.reference}, ruta ${s.origin}–${s.destination}.`;
  const body=`<div class="portal-modal-body"><div class="contact-trip-context"><span class="route-glyph">↗</span><span><b>${safe(s.id)} · ${safe(s.reference)}</b><small>${safe(s.origin)} → ${safe(s.destination)} · ${safe(s.status)}</small></span></div><div class="contact-person-row"><span class="driver-avatar">${safe(s.driver.split(' ').map(x=>x[0]).slice(0,2).join(''))}</span><span><b>${channel==='email'?'Equipo de logística':safe(s.driver)}</b><small>${channel==='email'?'Contacto de la cuenta · Cliente':channel==='call'?'Conductor asignado · '+safe(s.vehicle):'Conductor asignado · '+safe(s.vehicle)}</small></span></div><label class="contact-field-label">${channel==='email'?'DESTINATARIO':'TELÉFONO'}</label><div class="contact-destination">${safe(contactValue)}</div>${channel!=='call'?`<label class="contact-field-label" for="contactMessage">${channel==='whatsapp'?'MENSAJE DE WHATSAPP':'MENSAJE DE EMAIL'}</label><textarea id="contactMessage" class="contact-message" rows="3">${safe(draft)}</textarea>`:`<div class="call-info-box">La llamada real se conectará cuando el transportista habilite el número del conductor en la integración.</div>`}<div class="demo-disclaimer">Acción de demostración. No se realizará ninguna llamada ni se enviará un mensaje real.</div></div>`;
  modal(captions[channel],`Viaje ${s.id} · Comunicación asociada al transporte`,body,`<footer class="portal-modal-footer"><span>Canal facilitado por el transportista</span><button class="portal-btn portal-btn-primary" data-confirm-contact>Simular acción →</button></footer>`);
  modalRoot.querySelector('[data-confirm-contact]').addEventListener('click',()=>{closeModal();toast(channel==='call'?`Contacto de ${s.driver} preparado.`:`${channel==='whatsapp'?'WhatsApp':'Email'} preparado para ${s.id}.`);});
}
function openIncident(id){
  const s=state.shipments.find(x=>x.id===id)||state.shipments[0];
  const body=`<div class="portal-modal-body"><div class="contact-trip-context"><span class="incident-icon">⚑</span><span><b>${safe(s.id)} · ${safe(s.reference)}</b><small>${safe(s.origin)} → ${safe(s.destination)}</small></span></div><label class="contact-field-label" for="incidentKind">TIPO DE INCIDENCIA</label><select id="incidentKind" class="portal-select"><option>No conformidad</option><option>Problema de transporte</option><option>Retraso o espera</option><option>Comentario sobre el servicio</option><option>Daño en mercancía</option></select><label class="contact-field-label" for="incidentDetail">DESCRIPCIÓN</label><textarea id="incidentDetail" class="contact-message" rows="4" placeholder="Describe qué ha ocurrido o qué información necesitas…"></textarea><div class="demo-disclaimer">La incidencia se añadirá al historial de este viaje en la demo.</div></div>`;
  modal('Añadir incidencia o comentario',`Quedará asociado al viaje ${s.id}`,body,`<footer class="portal-modal-footer"><span>Revisado por el equipo de transporte</span><button class="portal-btn portal-btn-primary" data-save-incident>Registrar incidencia →</button></footer>`);
  modalRoot.querySelector('[data-save-incident]').addEventListener('click',()=>{
    const text=modalRoot.querySelector('#incidentDetail').value.trim();
    if(!text){toast('Escribe una descripción antes de registrar.');return;}
    const kind=modalRoot.querySelector('#incidentKind').value;
    state.incidents.unshift({id:`INC-${Math.floor(400+Math.random()*500)}`,trip:s.id,kind,title:text,detail:'Registrada desde el portal de cliente · Pendiente de revisión por el transportista',time:'05 oct · ahora',status:'Pendiente',owner:'Nova Distribución · Laura Martín'});
    if(s.id==='NV-24081')fetch(`/api/workflow/${s.id}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'client_incident',kind,description:text})}).catch(()=>{});
    closeModal();render();toast(`Incidencia registrada para ${s.id}.`);
  });
}
function openDocument(id){const d=state.documents.find(x=>x.id===id);if(!d)return;toast(`Documento disponible en la demo: ${d.name}`);}
function openInvoice(id){toast(`Vista de factura ${id} · PDF de ejemplo no conectado.`);}
function contactSupport(){openContact(state.shipments[0].id,'email');}
function closeSidebar(){document.querySelector('#portalSidebar').classList.remove('open');document.querySelector('#portalOverlay').classList.remove('visible');}
function bindActions(){
  content.querySelectorAll('[data-page]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();navigate(el.dataset.page);}));
  content.querySelectorAll('[data-trip]').forEach(el=>el.addEventListener('click',()=>navigate('detalle',el.dataset.trip)));
  content.querySelectorAll('[data-contact]').forEach(el=>el.addEventListener('click',()=>openContact(el.dataset.contact,el.dataset.channel)));
  content.querySelectorAll('[data-add-incident]').forEach(el=>el.addEventListener('click',()=>openIncident(el.dataset.addIncident)));
  content.querySelectorAll('[data-document]').forEach(el=>el.addEventListener('click',()=>openDocument(el.dataset.document)));
  content.querySelectorAll('[data-invoice]').forEach(el=>el.addEventListener('click',()=>openInvoice(el.dataset.invoice)));
  content.querySelectorAll('[data-search]').forEach(input=>input.addEventListener('input',()=>{const q=input.value.toLowerCase();content.querySelectorAll('tbody tr,.tracking-row').forEach(row=>row.style.display=row.textContent.toLowerCase().includes(q)?'':'none');}));
}
document.querySelectorAll('[data-contact-support]').forEach(el=>el.addEventListener('click',contactSupport));
document.querySelector('#portalMenuButton').addEventListener('click',()=>{document.querySelector('#portalSidebar').classList.toggle('open');document.querySelector('#portalOverlay').classList.toggle('visible');});
document.querySelector('#portalOverlay').addEventListener('click',closeSidebar);
document.querySelector('#portalNotifications').addEventListener('click',()=>toast('No tienes notificaciones nuevas.'));
window.addEventListener('hashchange',()=>{const r=location.hash.slice(1);if(r.startsWith('viaje/'))navigate('detalle',r.split('/')[1]);else if(pageNames[r])navigate(r);});
const routeAtStart=location.hash.slice(1);
if(routeAtStart.startsWith('viaje/')){state.page='detalle';state.tripId=routeAtStart.split('/')[1];}
else if(pageNames[routeAtStart])state.page=routeAtStart;
render();
syncClientWorkflow();
setInterval(syncClientWorkflow,15000);
