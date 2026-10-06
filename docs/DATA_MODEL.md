# Modelo de datos

Modelo conceptual objetivo; **no se crean tablas en esta fase**. Cada entidad empresarial se delimita por `organizationId` y requiere autorización en cada consulta.

| Entidad | Responsabilidad / datos clave |
|---|---|
| `Organization` | Tenant/empresa, datos fiscales, configuración y estado. |
| `User` | Identidad autenticable y membresías; distinta de conductor/contacto. |
| `Role` | Permisos de usuario dentro de organización: admin, operaciones, cliente, conductor, facturación. |
| `Customer` | Cuenta comercial, contactos y condiciones. |
| `Driver` | Perfil operativo, contacto/estado; puede vincularse a User. |
| `Vehicle` | Matrícula/identificador, capacidades y dispositivo telemático. |
| `Order` | Solicitud del cliente: referencias, ruta, mercancía, ventanas y requisitos. No es ejecución. |
| `DECA` | Documento digital, número, estado, QR y referencias; validez normativa pendiente de confirmar. |
| `Service` | Ejecución del transporte, estados y tiempos planificados/reales. |
| `Assignment` | Asignación versionada de servicio a transportista, vehículo y conductor, con aceptación/vigencia. |
| `Location` | Posición, origen, precisión y marcas temporales de proveedor y recepción. |
| `Document` | Metadatos, tipo, servicio, estado, checksum y referencia a almacenamiento seguro. |
| `Incident` | Incidencia/no conformidad, severidad, estado, comentarios y responsable. |
| `POD` | Prueba de entrega, evidencias, receptor, fecha y validación/actor. |
| `Invoice` | Factura/cargo, importes, moneda, impuestos, estado y referencia fiscal externa. |
| `Message` | Conversación asociada a servicio/incidencia, actor, canal y entrega. |
| `Notification` | Destinatario, canal/plantilla, evento origen, reintentos y resultado. |
| `Automation` | Regla versionada por organización, filtros y acciones permitidas. |
| `AutomationExecution` | Ejecución idempotente, evento disparador, intentos, resultado y errores. |
| `Integration` | Proveedor, organización, configuración no secreta, permisos y estado; secretos en vault. |
| `ServiceEvent` | Hecho de negocio con servicio, tipo, actor, fecha, payload normalizado y correlación. |
| `AuditLog` | Quién accedió/cambió qué, organización, cuándo y resultado; registro inmutable. |

## Relaciones principales
```text
Organization 1─* User/Role, Customer, Driver, Vehicle, Integration, Automation
Customer 1─* Order; Order 1─* Service
Service 1─* Assignment, Location, Document, Incident, ServiceEvent
Service 0─1 DECA, 0─1 POD, 0─* Invoice
Assignment *─1 Driver + *─1 Vehicle (+ transportista/organización ejecutora)
Incident 1─* Message; Service/Incident 1─* Notification
ServiceEvent 1─* AutomationExecution; User/action 1─* AuditLog
```
Cardinalidad exacta de DECA, POD e invoices depende de requisitos operativos/fiscales. Preservar versiones y relaciones históricas.

## Diferencia demo/modelo
Hoy hay objetos de ejemplo de servicios, documentos, incidencias y facturas, y un `workflowState` para NV-24081. No son entidades normalizadas ni tablas persistentes. En pantallas se confunden a veces pedido y servicio; no hay asignación versionada, membresías, RLS ni almacenamiento documental seguro.
