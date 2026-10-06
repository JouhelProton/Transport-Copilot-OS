# Núcleo de automatización

## Modelo
```text
EVENT → RULE (filtros, permisos, versión) → ACTION → AutomationExecution
```
Un evento confirmado activa reglas habilitadas. Una regla declara organización, evento, condiciones, versión, acciones permitidas, aprobación humana, timeout, reintentos e idempotencia. Registrar inicio/éxito/fallo y resultado; secretos desde vault. Acciones críticas requieren confirmación autorizada. El operador decide; el sistema ejecuta solo acciones permitidas.

## Flujos objetivo
| Evento | Regla | Acción candidata |
|---|---|---|
| `ORDER_CREATED` | Validar datos, duplicados y requisitos. | Marcar incompleto o proponer DECA para aprobación; no emitir sin regla aprobada. |
| `DRIVER_ACCEPTED` | Asignación vigente y servicio listo. | Iniciar proveedor de tracking y calcular ETA inicial. |
| `LOCATION_UPDATED` | Posición nueva, válida y no repetida. | Recalcular ETA y detectar retraso. |
| `ETA_DELAYED` | Umbral y deduplicación satisfechos. | Avisar a operaciones; proponer comunicación o crear incidencia según política. |
| `POD_VALIDATED` | Requisitos operativos/documentales satisfechos. | Marcar `TRIP_READY_TO_INVOICE`; crear borrador si está autorizado. Emisión fiscal va aparte. |
| `INCIDENT_CREATED` | Prioridad/categoría según configuración. | Asignar responsable, notificar por canales activos y escalar con trazabilidad. |

## Estado de demo
No hay motor genérico, cola, scheduler ni ejecuciones durables. NV-24081 usa un flujo fijo de acciones y guarda JSON; validar POD marca `invoiceReady`. Paneles de automatización son UI/datos de ejemplo. No hay generación real de DECA, ETA, notificaciones, POD documental ni facturación fiscal.
