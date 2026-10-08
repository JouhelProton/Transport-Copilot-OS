# Contrato API v1

## Convenciones

- Base: `/api/v1`; `GET /health` y `GET /ready` quedan fuera de la versión.
- JSON UTF-8 y fechas RFC 3339 UTC.
- Error: `{ "error": { "code": "...", "message": "...", "details": [], "requestId": "..." } }`.
- Validación de entrada con Zod y autorización de rol/tenant en servidor.
- La autenticación web usa la cookie de sesión `HttpOnly`; el frontend envía peticiones con credenciales incluidas.
- La Driver App Expo usa el mismo token opaco mediante `Authorization: Bearer`; solo `mobile-login` entrega el secreto y `/auth/me` nunca lo devuelve.
- La organización activa procede de la `Membership` guardada en la sesión. Los headers DEV se ignoran.
- Mutaciones desde navegador deben proceder del origen permitido; la cookie usa `SameSite=Lax` y `Secure` en producción.

## Endpoints implementados

| Método y ruta                             | Roles / alcance                                          | Resultado                                                            |
| ----------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------- |
| `GET /health`                             | Público                                                  | Estado del proceso.                                                  |
| `GET /ready`                              | Público                                                  | `200` solo cuando proceso y PostgreSQL responden; si no, `503`.      |
| `POST /api/v1/auth/login`                 | Público con rate limit                                   | Valida credenciales, crea sesión y cookie.                           |
| `POST /api/v1/auth/mobile-login`          | Público con rate limit                                   | Crea la misma sesión opaca y entrega el token una vez a la app.      |
| `POST /api/v1/auth/logout`                | Sesión opcional                                          | Revoca la sesión y elimina la cookie.                                |
| `GET /api/v1/auth/me`                     | Sesión                                                   | Identidad, memberships, organización activa, rol y permisos.         |
| `POST /api/v1/auth/switch-organization`   | Sesión                                                   | Cambia a una membership verificada del mismo usuario.                |
| `POST /api/v1/orders`                     | `CUSTOMER` o roles internos                              | Crea `Order`, `ORDER_CREATED` y auditoría.                           |
| `GET /api/v1/orders`                      | Cliente participante o transportista destinatario        | Lista aislada por tenant y relación.                                 |
| `GET /api/v1/orders/:id`                  | Igual que lista                                          | Detalle autorizado; `404` para terceros.                             |
| `POST /api/v1/orders/:id/accept`          | Admin, tráfico u operaciones del transportista           | Acepta pedido y crea `Service` de forma transaccional.               |
| `GET /api/v1/services`                    | Cliente participante o roles internos del transportista  | Lista de servicios autorizados.                                      |
| `GET /api/v1/services/:id`                | Igual que lista                                          | Detalle, asignación y eventos.                                       |
| `POST /api/v1/services/:id/assign`        | Admin o tráfico del transportista                        | Crea/reemplaza `Assignment`; valida conductor y vehículo del tenant. |
| `GET /api/v1/drivers`                     | Roles internos del transportista                         | Conductores de la organización actual.                               |
| `GET /api/v1/vehicles`                    | Roles internos del transportista                         | Vehículos de la organización actual.                                 |
| `GET /api/v1/driver/services`             | `DRIVER`, conductor vinculado                            | Solo servicios con Assignment activo del Driver autenticado.         |
| `GET /api/v1/driver/services/:id`         | `DRIVER`, conductor vinculado                            | Detalle propio; `404` para otro conductor o tenant.                  |
| `POST /api/v1/driver/services/:id/accept` | `driver:services:accept`                                 | `ASSIGNED → DRIVER_ACCEPTED`, evento y auditoría transaccionales.    |
| `POST /api/v1/driver/services/:id/tracking/start` | `DRIVER`, asignación activa                    | Inicia o devuelve la sesión GPS activa del conductor autenticado.    |
| `POST /api/v1/driver/services/:id/tracking/positions` | `DRIVER`, tracking activo                 | Valida y persiste una muestra GPS deduplicada.                       |
| `POST /api/v1/driver/services/:id/tracking/stop` | `DRIVER`, sesión propia                       | Detiene la sesión y registra el evento.                              |
| `GET /api/v1/driver/services/:id/tracking` | `DRIVER`, servicio propio                         | Devuelve sesión, posición actual e histórico limitado.              |
| `GET /api/v1/services/:id/tracking/current` | Transportista de la organización                  | Devuelve la última posición autorizada y estado de sesión.           |
| `GET /api/v1/services/:id/tracking/history` | Transportista de la organización                  | Devuelve histórico acotado por fecha y límite.                       |
| `POST /api/v1/driver/services/:id/incidents` | `DRIVER`, asignación activa | Crea una incidencia y notifica a operaciones. |
| `GET /api/v1/driver/services/:id/incidents` | `DRIVER`, asignación activa | Lista las incidencias del servicio propio. |
| `GET /api/v1/incidents` | Transportista con `incidents:read` | Lista incidencias del tenant. |
| `PATCH /api/v1/services/:serviceId/incidents/:incidentId` | Transportista con `incidents:manage` | Cambia estado/prioridad y conserva historial. |
| `GET /api/v1/services/:id/intelligence` | Transportista con `operations:read` | ETA, retraso, geofences e incidencias del servicio. |
| `GET /api/v1/operations/exceptions` | Transportista con `operations:read` | Resumen priorizable de servicios que requieren atención. |
| `GET /api/v1/notifications` | Transportista con `notifications:read` | Notificaciones internas del tenant. |
| `PATCH /api/v1/notifications/:id/read` | Transportista con `notifications:read` | Marca una notificación propia como leída. |

## Autenticación

```json
POST /api/v1/auth/login
{
  "email": "cliente@demo.nexo.local",
  "password": "Demo-Transport-2026!"
}
```

`GET /api/v1/auth/me` no devuelve hashes ni tokens. Incluye `user`, `activeMembership`, `memberships`, `permissions`, `expiresAt` y, cuando corresponde, `customerId` o `driverId`.

La respuesta de `mobile-login` añade `sessionToken`. El cliente nativo debe guardarlo en almacenamiento seguro, enviarlo como Bearer y eliminarlo al cerrar sesión. Logout revoca la misma fila `Session` para cookie o Bearer.

```json
POST /api/v1/auth/switch-organization
{ "membershipId": "membership-validada" }
```

## Crear pedido

```json
{
  "carrierOrganizationId": "org_tvd",
  "reference": "CLI-2026-001",
  "origin": {
    "name": "Valencia",
    "address": "Puerto",
    "lat": 39.4699,
    "lng": -0.3763
  },
  "destination": {
    "name": "Madrid",
    "address": "Getafe",
    "lat": 40.3057,
    "lng": -3.7329
  },
  "cargo": "Alimentación",
  "pallets": 24,
  "plannedPickup": "2026-10-08T08:00:00.000Z",
  "plannedDelivery": "2026-10-08T16:00:00.000Z"
}
```

Un usuario `CUSTOMER` no puede elegir arbitrariamente `customerId`: el backend lo deriva de su usuario y de la relación comercial con el transportista.

## Asignar servicio

```json
{
  "driverId": "drv_ana",
  "vehicleId": "veh_9012"
}
```

Conductor, vehículo y servicio deben pertenecer al mismo transportista. La reasignación conserva el historial marcando la asignación anterior como `REPLACED`.

## Aceptación del conductor

El body está vacío. El backend obtiene `driverId` desde el `User` autenticado y su relación `Driver`; nunca acepta ese identificador desde el cliente. Solo una asignación `ACTIVE` del mismo tenant es visible.

La primera petición válida cambia el estado a `DRIVER_ACCEPTED`, fija `Assignment.acceptedAt`, crea un `ServiceEvent DRIVER_ACCEPTED` y un `AuditLog SERVICE_DRIVER_ACCEPTED` en una transacción. Repetir la petición sobre la misma asignación devuelve el estado confirmado sin crear más eventos ni auditorías.

## Tracking GPS v0.4

El teléfono nunca envía `driverId` ni `organizationId` como autoridad. El backend los deriva de `Session → Membership → Driver → Assignment → Service`. Las posiciones exigen `sampleId`, coordenadas válidas, precisión, timestamp no futuro y antigüedad máxima de 24 horas. Una muestra repetida es idempotente y una muestra antigua no reemplaza `CurrentPosition`.

La respuesta separa `CurrentPosition` (lectura rápida) de `LocationHistory` (muestras aceptadas). La retención es configurable como decisión pendiente; no se borran posiciones automáticamente en v0.4.

## Operations Intelligence v0.5

Una posición GPS nueva puede actualizar geofences, ETA y estado operativo. Las consultas ETA se limitan por tiempo y desplazamiento; `GOOGLE_ROUTES_API_KEY` es una credencial de servidor separada de `VITE_GOOGLE_MAPS_API_KEY`. Si falta o el proveedor no responde, se persiste `UNAVAILABLE` sin inventar tiempos.

Las geofences usan precisión máxima e histéresis. `GEOFENCE_ENTERED` acredita llegada GPS, pero no completa entrega ni POD. Las alertas y notificaciones tienen claves de deduplicación por evento o ventana temporal.

## Fuera de esta versión

GES, DECA legal, documentos, POD, facturación, mensajería externa y automatizaciones durables no tienen todavía endpoints productivos. Los endpoints legacy de la raíz no pertenecen a `/api/v1`.
