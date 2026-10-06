export const initialServices = [
  { id: 'NV-24081', customer: 'Nova Distribución', origin: 'Valencia', destination: 'Madrid', date: '05 oct 2026', vehicle: '1234 ABC', driver: 'Miguel García', price: 1280, cost: 980, status: 'En curso', invoiceStatus: 'Pendiente de entrega', pod: 'Pendiente', time: '08:00' },
  { id: 'TR-10481', customer: 'Carrefour Demo', origin: 'Madrid', destination: 'Barcelona', date: '06 oct 2026', vehicle: '5678 DEF', driver: 'Javier Martínez', price: 980, cost: 790, status: 'Entregado', invoiceStatus: 'Facturado', pod: 'Recibido', time: '07:30' },
  { id: 'TR-10480', customer: 'DHL Demo', origin: 'Alicante', destination: 'Madrid', date: '06 oct 2026', vehicle: '9012 GHI', driver: 'Antonio López', price: 1480, cost: 1150, status: 'Entregado', invoiceStatus: 'Falta POD', pod: 'Pendiente', time: '06:45' },
  { id: 'TR-10479', customer: 'SEUR Demo', origin: 'Valencia', destination: 'Zaragoza', date: '05 oct 2026', vehicle: '3456 JKL', driver: 'David Sánchez', price: 870, cost: 710, status: 'Entregado', invoiceStatus: 'Revisar precio', pod: 'Recibido', time: '16:20' },
  { id: 'TR-10478', customer: 'Consum Demo', origin: 'Barcelona', destination: 'Valencia', date: '05 oct 2026', vehicle: '1234 ABC', driver: 'Miguel García', price: 1120, cost: 905, status: 'Entregado', invoiceStatus: 'Facturado', pod: 'Recibido', time: '15:10' },
  { id: 'TR-10477', customer: 'Mercadona Demo', origin: 'Madrid', destination: 'Alicante', date: '05 oct 2026', vehicle: '5678 DEF', driver: 'Javier Martínez', price: 1380, cost: 1090, status: 'Entregado', invoiceStatus: 'Pendiente de cierre', pod: 'Pendiente', time: '13:45' },
  { id: 'TR-10476', customer: 'DHL Demo', origin: 'Zaragoza', destination: 'Valencia', date: '05 oct 2026', vehicle: '9012 GHI', driver: 'Antonio López', price: 940, cost: 760, status: 'En tránsito', invoiceStatus: 'Pendiente de entrega', pod: 'Pendiente', time: '12:10' }
];

export const initialActivity = [
  { icon: '✳', color: 'green', title: 'Servicio listo para facturar', detail: 'TR-10482 · Mercadona Demo', time: 'Hace 4 min' },
  { icon: '▧', color: 'purple', title: 'POD recibido y validado', detail: 'TR-10481 · Carrefour Demo', time: 'Hace 18 min' },
  { icon: '✉', color: 'blue', title: 'Pedido recibido por email', detail: 'TR-10482 · Datos extraídos automáticamente', time: 'Hace 32 min' },
  { icon: '⚑', color: 'orange', title: 'Documento solicitado automáticamente', detail: 'TR-10480 · POD pendiente', time: 'Hace 1 h' }
];

export const initialAlerts = [
  { id: 'a1', priority: 'high', title: 'Servicio entregado sin POD', description: 'TR-10480 · Hace 18 horas', action: 'Solicitar POD', serviceId: 'TR-10480' },
  { id: 'a2', priority: 'medium', title: 'Revisar precio del servicio', description: 'TR-10479 · Diferencia de 8,5 %', action: 'Revisar', serviceId: 'TR-10479' },
  { id: 'a3', priority: 'medium', title: 'Pendiente de cierre operativo', description: 'TR-10477 · Documentación incompleta', action: 'Ver servicio', serviceId: 'TR-10477' },
  { id: 'a4', priority: 'low', title: 'Factura próxima a vencer', description: 'Carrefour Demo · 1.240 € · 3 días', action: 'Ver factura', serviceId: 'TR-10481' }
];

export const demoOrder = {
  id: 'TR-10483', customer: 'Mercadona Demo', origin: 'Valencia', destination: 'Madrid', date: '06 oct 2026', time: '08:00', type: 'Carga completa', goods: 'Alimentación', weight: '18.500 kg', vehicle: '1234 ABC', driver: 'Miguel García', price: 1250, cost: 980, reference: 'CLI-78452'
};

export const docs = [
  { name: 'pedido_transporte_10482.pdf', type: 'Pedido cliente', status: 'Recibido', date: '06 oct · 07:42', origin: 'Email · compras@mercadona-demo.es', serviceId: 'TR-10482' },
  { name: 'deca_10482_qr.pdf', type: 'DeCA', status: 'Recibido', date: '06 oct · 07:49', origin: 'Sistema · QR disponible', serviceId: 'TR-10482' },
  { name: 'pod_10481_firmado.pdf', type: 'POD', status: 'Recibido', date: '06 oct · 09:16', origin: 'App conductor · Validado', serviceId: 'TR-10481' },
  { name: 'pod_10480_pendiente.pdf', type: 'POD', status: 'Falta', date: 'Entrega · 05 oct · 14:22', origin: 'Sistema · Solicitud pendiente', serviceId: 'TR-10480' },
  { name: 'factura_10481.pdf', type: 'Factura', status: 'Recibido', date: '06 oct · 09:32', origin: 'Sistema · Enviada al cliente', serviceId: 'TR-10481' },
  { name: 'albaran_10479.pdf', type: 'Albarán', status: 'Pendiente', date: '05 oct · 16:20', origin: 'Email · Validación necesaria', serviceId: 'TR-10479' }
];

export const automationRules = [
  { icon: '✉', title: 'Procesamiento de pedidos', subtitle: 'Lee emails y extrae datos del transporte', trigger: 'Cuando llega un email con un PDF de transporte', steps: ['Leer documento', 'Extraer información', 'Validar datos', 'Crear servicio', 'Avisar si falta información'], runs: '184 ejecuciones hoy' },
  { icon: '▧', title: 'Control de POD', subtitle: 'Persigue y valida pruebas de entrega', trigger: 'Cuando un servicio se marca como entregado', steps: ['Buscar POD', 'Solicitar si falta', 'Validar documento', 'Actualizar servicio'], runs: '96 ejecuciones hoy' },
  { icon: '€', title: 'Control de facturación', subtitle: 'Detecta operaciones que pueden facturarse', trigger: 'Cuando un servicio se completa', steps: ['Verificar POD', 'Comprobar precio', 'Validar documentos', 'Marcar como facturable'], runs: '62 ejecuciones hoy' }
];

export const customers = [
  { name: 'Mercadona Demo', initials: 'M', services: 42, revenue: 24860, status: 'Activo' },
  { name: 'Carrefour Demo', initials: 'C', services: 31, revenue: 19420, status: 'Activo' },
  { name: 'DHL Demo', initials: 'D', services: 28, revenue: 21780, status: 'Activo' },
  { name: 'SEUR Demo', initials: 'S', services: 19, revenue: 12350, status: 'Activo' },
  { name: 'Consum Demo', initials: 'Co', services: 8, revenue: 6840, status: 'Activo' }
];

export const vehicles = [
  { plate: '1234 ABC', type: 'Tractora · Volvo FH', driver: 'Miguel García', status: 'En ruta', location: 'Valencia → Madrid', docs: 'Al día' },
  { plate: '5678 DEF', type: 'Tractora · Scania R450', driver: 'Javier Martínez', status: 'Disponible', location: 'Madrid', docs: 'Al día' },
  { plate: '9012 GHI', type: 'Tractora · MAN TGX', driver: 'Antonio López', status: 'En ruta', location: 'Alicante → Madrid', docs: 'Al día' },
  { plate: '3456 JKL', type: 'Tractora · Renault T', driver: 'David Sánchez', status: 'En revisión', location: 'Valencia', docs: 'Revisar ITV' }
];
