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

## Fuera de esta versión

GPS/GES, ETA, DECA legal, documentos, POD, facturación, incidencias, mensajería, notificaciones y automatizaciones no tienen todavía endpoints productivos. Los endpoints legacy de la raíz no pertenecen a `/api/v1`.
