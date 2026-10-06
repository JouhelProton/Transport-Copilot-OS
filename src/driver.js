const serviceId = 'NV-24081';
const statusNode = document.querySelector('#driverStatus');
const actionNode = document.querySelector('#driverPrimaryAction');
const eventsNode = document.querySelector('#driverWorkflowEvents');
const toastNode = document.querySelector('#driverToast');
let workflow = null;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
function toast(message) {
  toastNode.textContent = message;
  toastNode.classList.add('visible');
  setTimeout(() => toastNode.classList.remove('visible'), 2600);
}
function localTime(value) {
  return new Date(value).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}
function eventIcon(type) {
  if (type.includes('INCIDENT')) return '⚑';
  if (type.includes('POD')) return '▧';
  if (type.includes('INVOICE')) return '€';
  if (type.includes('ARRIVED')) return '⌖';
  if (type.includes('DELIVERED')) return '✓';
  return '↗';
}
function render() {
  if (!workflow) return;
  const labels = { IN_TRANSIT: 'En ruta', ARRIVED: 'En destino', DELIVERED: 'Entregado' };
  statusNode.textContent = labels[workflow.status] || 'Servicio asignado';
  statusNode.className = `driver-status ${workflow.status === 'ARRIVED' ? 'arrived' : workflow.status === 'DELIVERED' ? 'delivered' : ''}`;
  if (workflow.status === 'IN_TRANSIT') {
    actionNode.innerHTML = '<button class="driver-action-button" data-workflow-action="driver_arrive">He llegado al destino</button>';
  } else if (workflow.status === 'ARRIVED') {
    actionNode.innerHTML = '<button class="driver-action-button" data-workflow-action="driver_deliver">Entrega completada · Subir POD demo</button>';
  } else {
    const podLabel = workflow.podStatus === 'VALIDATED' ? 'POD validado · servicio listo para facturar' : 'Entrega registrada · POD enviado a operaciones';
    actionNode.innerHTML = `<div class="driver-done-panel"><span>✓</span><span>${podLabel}</span></div>`;
  }
  const events = workflow.events.slice(0, 7);
  eventsNode.innerHTML = events.map(event => `<div class="driver-event"><span class="driver-event-icon">${eventIcon(event.type)}</span><span class="driver-event-copy"><b>${escapeHtml(event.label)}</b><small>${escapeHtml(event.role)}</small></span><time class="driver-event-time">${localTime(event.at)}</time></div>`).join('');
  actionNode.querySelector('[data-workflow-action]')?.addEventListener('click', event => submitAction(event.currentTarget.dataset.workflowAction));
}
async function loadWorkflow() {
  try {
    const response = await fetch(`/api/workflow/${serviceId}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('No se pudo sincronizar el servicio.');
    workflow = await response.json();
    render();
  } catch (error) {
    eventsNode.innerHTML = `<div class="driver-loading">${escapeHtml(error.message)} Comprueba que el servidor local está iniciado.</div>`;
  }
}
async function submitAction(action, extra = {}) {
  const button = actionNode.querySelector('button');
  if (button) button.disabled = true;
  try {
    const response = await fetch(`/api/workflow/${serviceId}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ action, ...extra }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo registrar la acción.');
    workflow = result;
    render();
    toast(action === 'driver_arrive' ? 'Llegada compartida con operaciones y cliente.' : 'Entrega y POD de demo enviados a operaciones.');
  } catch (error) {
    if (button) button.disabled = false;
    toast(error.message);
  }
}
document.querySelector('[data-driver-incident]').addEventListener('click', () => {
  const existing = document.querySelector('#driverIncidentForm');
  if (existing) { existing.remove(); return; }
  document.querySelector('.driver-quick-actions').insertAdjacentHTML('afterend', `<form id="driverIncidentForm" class="driver-incident-form"><label for="driverIncidentKind">Tipo de incidencia</label><select id="driverIncidentKind"><option>Retraso o espera</option><option>Avería</option><option>Mercancía dañada</option><option>Cliente ausente</option><option>Problema documental</option><option>Otra</option></select><label for="driverIncidentDescription">Descripción</label><textarea id="driverIncidentDescription" rows="3" required placeholder="Indica brevemente qué ha ocurrido…"></textarea><button class="driver-action-button" type="submit">Enviar incidencia a operaciones</button></form>`);
  const form = document.querySelector('#driverIncidentForm');
  form.addEventListener('submit', event => {
    event.preventDefault();
    const description = form.querySelector('#driverIncidentDescription').value.trim();
    const kind = form.querySelector('#driverIncidentKind').value;
    if (!description) return;
    form.remove();
    submitAction('driver_incident', { kind, description });
  });
});
document.querySelector('[data-driver-docs]').addEventListener('click', () => document.querySelector('#driverDocuments').scrollIntoView({ behavior: 'smooth', block: 'center' }));
document.querySelectorAll('[data-driver-document]').forEach(button => button.addEventListener('click', () => toast(`${button.dataset.driverDocument} · vista de documento simulada.`)));
loadWorkflow();
setInterval(loadWorkflow, 12000);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/driver-sw.js').catch(() => {});
