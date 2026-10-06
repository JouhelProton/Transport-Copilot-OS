export const shipments = [
  {
    id: 'NV-24081', order: 'ND-78452', status: 'En tránsito', priority: 'normal',
    origin: 'Valencia', destination: 'Madrid', plannedPickup: '08:00', actualPickup: '08:12',
    plannedDelivery: '13:00', eta: '13:18', actualDelivery: null,
    reference: 'CLI-78452', cargo: 'Producto refrigerado', goods: '18 palets · alimentación', weight: '18.500 kg', temperature: '4,2 °C',
    vehicle: '1234 ABC', driver: 'Miguel García', phone: '+34 600 123 456', lastPosition: 'A-3 · Tarancón', updated: '12:42', progress: 78,
    documents: ['DeCA · QR disponible', 'Carta de porte', 'POD · Pendiente'], notes: 'Mantener cadena de frío entre 2 °C y 6 °C.'
  },
  {
    id: 'NV-24082', order: 'ND-78461', status: 'Carga iniciada', priority: 'normal',
    origin: 'Barcelona', destination: 'Zaragoza', plannedPickup: '13:45', actualPickup: '13:58',
    plannedDelivery: '17:30', eta: '17:38', actualDelivery: null,
    reference: 'CLI-78461', cargo: 'Material de exposición', goods: '8 palets · mobiliario', weight: '4.200 kg', temperature: null,
    vehicle: '5678 DEF', driver: 'Javier Martínez', phone: '+34 600 234 567', lastPosition: 'Barcelona · Plataforma logística', updated: '13:59', progress: 24,
    documents: ['DeCA · QR disponible', 'Carta de porte', 'POD · Pendiente'], notes: 'Entrega con cita previa.'
  },
  {
    id: 'NV-24079', order: 'ND-78391', status: 'Entregado', priority: 'normal',
    origin: 'Alicante', destination: 'Madrid', plannedPickup: '05:30', actualPickup: '05:26',
    plannedDelivery: '10:00', eta: '10:00', actualDelivery: '10:24',
    reference: 'CLI-78391', cargo: 'Bebidas y alimentación', goods: '24 palets · alimentación', weight: '21.200 kg', temperature: '5,1 °C',
    vehicle: '9012 GHI', driver: 'Antonio López', phone: '+34 600 345 678', lastPosition: 'Madrid · Centro de distribución', updated: '10:24', progress: 100,
    documents: ['DeCA · QR disponible', 'Carta de porte', 'POD · Firmado'], notes: 'Entrega completada. POD firmado disponible.'
  },
  {
    id: 'NV-24076', order: 'ND-78340', status: 'Entregado', priority: 'attention',
    origin: 'Valencia', destination: 'Zaragoza', plannedPickup: '07:00', actualPickup: '07:08',
    plannedDelivery: '11:15', eta: '11:15', actualDelivery: '11:42',
    reference: 'CLI-78340', cargo: 'Producto refrigerado', goods: '16 palets · lácteos', weight: '14.800 kg', temperature: '4,8 °C',
    vehicle: '3456 JKL', driver: 'David Sánchez', phone: '+34 600 456 789', lastPosition: 'Zaragoza · Plataforma norte', updated: '11:42', progress: 100,
    documents: ['DeCA · QR disponible', 'Carta de porte', 'POD · Firmado'], notes: 'Entrega finalizada. Incidencia de espera registrada.'
  }
];

export const documents = [
  { id: 'D-901', trip: 'NV-24081', name: 'DeCA_NV-24081.pdf', kind: 'Documento de control · QR', date: '05 oct · 08:05', status: 'Disponible' },
  { id: 'D-902', trip: 'NV-24081', name: 'Carta_porte_NV-24081.pdf', kind: 'Carta de porte', date: '05 oct · 08:06', status: 'Disponible' },
  { id: 'D-898', trip: 'NV-24079', name: 'POD_firmado_NV-24079.pdf', kind: 'Prueba de entrega', date: '05 oct · 10:25', status: 'Disponible' },
  { id: 'D-897', trip: 'NV-24079', name: 'Factura_F-2026-1842.pdf', kind: 'Factura', date: '05 oct · 10:28', status: 'Disponible' },
  { id: 'D-895', trip: 'NV-24076', name: 'POD_firmado_NV-24076.pdf', kind: 'Prueba de entrega', date: '05 oct · 11:43', status: 'Disponible' },
  { id: 'D-894', trip: 'NV-24076', name: 'Incidencia_NV-24076.pdf', kind: 'Parte de incidencia', date: '05 oct · 11:47', status: 'Disponible' }
];

export const incidents = [
  { id: 'INC-381', trip: 'NV-24076', kind: 'No conformidad', title: 'Espera superior a la prevista en destino', detail: 'Tiempo de espera: 27 min · Recepción informada', time: '05 oct · 11:42', status: 'Resuelta', owner: 'Operaciones · David Sánchez' },
  { id: 'INC-377', trip: 'NV-24079', kind: 'Observación de entrega', title: 'Descarga completada con 2 bultos dañados', detail: 'Anotación en POD y fotografías adjuntas', time: '05 oct · 10:24', status: 'En revisión', owner: 'Calidad · Equipo de operaciones' }
];

export const invoices = [
  { id: 'F-2026-1842', trip: 'NV-24079', date: '05 oct 2026', due: '04 nov 2026', amount: 1280, status: 'Pendiente de pago' },
  { id: 'F-2026-1798', trip: 'NV-24076', date: '02 oct 2026', due: '01 nov 2026', amount: 960, status: 'Pendiente de pago' },
  { id: 'F-2026-1681', trip: 'NV-24054', date: '22 sep 2026', due: '22 oct 2026', amount: 1540, status: 'Pagada' }
];
