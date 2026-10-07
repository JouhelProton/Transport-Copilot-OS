# Eventos de negocio

Los eventos describen hechos persistidos, no órdenes futuras. Cada evento objetivo incluye `eventId`, `type`, `occurredAt`, `recordedAt`, `organizationId`, entidad/`entityId`, actor, `correlationId`, `schemaVersion` y payload mínimo. No incluir secretos ni datos personales innecesarios.

| Evento | Significado |
|---|---|
| `ORDER_CREATED` | Solicitud creada. |
| `ORDER_ACCEPTED` | Pedido aceptado por la organización transportista. |
| `DECA_CREATED` | DECA asociado creado/emitido. |
| `SERVICE_CREATED` | Ejecución creada desde el pedido. |
| `DRIVER_ASSIGNED` | Conductor asignado. |
| `VEHICLE_ASSIGNED` | Vehículo asignado. |
| `DRIVER_ACCEPTED` | Conductor acepta servicio. |
| `TRIP_STARTED` | Ejecución iniciada. |
| `LOCATION_UPDATED` | Posición normalizada recibida. |
| `ETA_CHANGED` | ETA revisada. |
| `ETA_DELAYED` | Retraso detectado con regla configurada. |
| `ARRIVED_AT_PICKUP` | Llegada al punto de carga. |
| `ARRIVED_AT_DELIVERY` | Llegada a destino. |
| `POD_UPLOADED` | Evidencia POD recibida. |
| `POD_VALIDATED` | POD validado por actor autorizado. |
| `INCIDENT_CREATED` | Incidencia registrada. |
| `TRIP_READY_TO_INVOICE` | Requisitos para preparar factura satisfechos. |
| `INVOICE_CREATED` | Factura/borrador creado según estado fiscal acordado. |

## Garantías
- El backend ya persiste `ORDER_CREATED`, `ORDER_ACCEPTED`, `SERVICE_CREATED`, `DRIVER_ASSIGNED` y `VEHICLE_ASSIGNED` junto al cambio de dominio y al registro de auditoría dentro de una transacción.
- El resto del catálogo es objetivo y todavía no está implementado. La demo raíz conserva nombres heredados como `ORDER.ACCEPTED`, `TRIP.ARRIVED`, `TRIP.DELIVERED`, `POD.UPLOADED`, `POD.VALIDATED`, `INVOICE.READY` e `INCIDENT.CREATED`; no forman parte del contrato del backend nuevo.
- “Listo para facturar” no significa factura emitida. Separar preparación, borrador, emisión fiscal y envío.
- Persistir evento y cambio de dominio en una transacción; usar outbox para consumidores asíncronos.
- Consumidores idempotentes, reintentables y monitorizados.
- Proyecciones cliente ocultan campos internos y respetan acceso al servicio.
- `AuditLog` registra acceso/cambio y actor; no sustituirlo por el timeline de negocio.
