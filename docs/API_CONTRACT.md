# Contrato conceptual de API

Frontera entre frontend y backend. Especificación inicial, **no implica que los endpoints objetivo existan**. La API local `/api/workflow`, `/api/tracking` y `/api/integrations` no cumple aún este contrato productivo.

## Convenciones
- Base `/api/v1`, HTTPS, JSON UTF-8, fechas RFC 3339 UTC e importes decimales con moneda.
- Sesión/bearer gestionada por backend. Cada petición aplica rol, organización y permisos.
- Error: `{ "error": { "code": "...", "message": "...", "details": [], "requestId": "..." } }`.
- Listas paginadas, filtros con allowlist; validar mutaciones y usar `Idempotency-Key` en operaciones reintentables.
- Nunca aceptar actor, rol u organización del body como fuente de autoridad.

## Endpoints objetivo
| Método / ruta | Uso y permiso |
|---|---|
| `GET /me` | Perfil, membresías y roles propios. |
| `GET /orders`; `POST /orders`; `GET /orders/{id}` | Listar, crear y consultar pedidos accesibles. |
| `POST /orders/{id}/approve` | Aprobar según rol/regla. |
| `POST /orders/{id}/services` | Crear ejecución de pedido aprobado. |
| `GET /services`; `GET /services/{id}` | Listado y detalle autorizado. |
| `POST /services/{id}/assignments` | Asignar transportista/vehículo/conductor. |
| `POST /services/{id}/acceptance` | Aceptar/rechazar asignación. |
| `POST /services/{id}/start` | Iniciar viaje. |
| `GET /services/{id}/tracking` | Última posición/historial compartible. |
| `POST /services/{id}/locations` | Ingesta autenticada de proveedor/app. |
| `GET/POST /services/{id}/documents` | Listar y registrar metadatos/subida segura. |
| `POST /services/{id}/pod`; `POST /services/{id}/pod/validate` | Registrar y validar evidencia POD. |
| `GET/POST /services/{id}/incidents` | Listar o crear incidencia/no conformidad. |
| `POST /services/{id}/invoices` | Crear borrador conforme a permisos y validaciones. |
| `GET /invoices`; `GET /invoices/{id}` | Consultar facturas autorizadas. |
| `GET /services/{id}/events` | Timeline filtrado por rol/visibilidad. |
| `GET /notifications` | Notificaciones del usuario. |

URLs de descarga deben ser breves y autorizadas. Webhooks con firma/mecanismo oficial, timestamp, replay protection e idempotencia. No filtrar costes internos ni datos personales por rol cliente/conductor.

## API que existe en demo local
- `GET/POST /api/workflow/{tripId}`: un único workflow de demo; sin autenticación/autorización.
- `GET /api/tracking/{shipmentId}`: ubicación de demo o proveedor configurado.
- `GET /api/integrations/gestracking`: estado/configuración resumida.
- `POST /api/integrations/gestracking/email`: webhook demo con secreto compartido para evento normalizado.
- `GET /api/integrations/maps`: devuelve al navegador la clave de Maps Embed configurada; restringir por referrer/API.

El workflow altera JSON local y no debe exponerse a Internet ni usarse con datos reales. Rutas de negocio objetivo pendientes.
