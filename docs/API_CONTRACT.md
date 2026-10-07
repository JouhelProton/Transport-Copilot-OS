# Contrato API v1

## Convenciones

- Base: `/api/v1`; `GET /health` queda fuera de la versión.
- JSON UTF-8 y fechas RFC 3339 UTC.
- Error: `{ "error": { "code": "...", "message": "...", "details": [], "requestId": "..." } }`.
- Validación de entrada con Zod y autorización de rol/tenant en servidor.
- La autenticación DEV requiere `x-dev-user-id` y `x-organization-id`. Es reemplazable y no es apta para Internet.

## Endpoints implementados

| Método y ruta                      | Roles / alcance                                          | Resultado                                                            |
| ---------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------- |
| `GET /health`                      | Público                                                  | Estado del proceso.                                                  |
| `POST /api/v1/orders`              | `CUSTOMER` o roles internos                              | Crea `Order`, `ORDER_CREATED` y auditoría.                           |
| `GET /api/v1/orders`               | Cliente participante o transportista destinatario        | Lista aislada por tenant y relación.                                 |
| `GET /api/v1/orders/:id`           | Igual que lista                                          | Detalle autorizado; `404` para terceros.                             |
| `POST /api/v1/orders/:id/accept`   | Admin, tráfico u operaciones del transportista           | Acepta pedido y crea `Service` de forma transaccional.               |
| `GET /api/v1/services`             | Cliente participante, transportista o conductor asignado | Lista de servicios autorizados.                                      |
| `GET /api/v1/services/:id`         | Igual que lista                                          | Detalle, asignación y eventos.                                       |
| `POST /api/v1/services/:id/assign` | Admin o tráfico del transportista                        | Crea/reemplaza `Assignment`; valida conductor y vehículo del tenant. |
| `GET /api/v1/drivers`              | Roles internos del transportista                         | Conductores de la organización actual.                               |
| `GET /api/v1/vehicles`             | Roles internos del transportista                         | Vehículos de la organización actual.                                 |

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

## Fuera de esta versión

GPS/GES, ETA, DECA legal, documentos, POD, facturación, incidencias, mensajería, notificaciones y automatizaciones no tienen todavía endpoints productivos. Los endpoints legacy de la raíz no pertenecen a `/api/v1`.
