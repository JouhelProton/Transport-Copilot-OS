# Modelo de datos

El schema real vive en `backend/prisma/schema.prisma`. PostgreSQL es la persistencia de la primera vertical.

| Entidad implementada | Responsabilidad                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `Organization`       | Tenant cliente o transportista.                                                                     |
| `User`               | Identidad lógica independiente del rol.                                                             |
| `Membership`         | Rol de un usuario dentro de una organización.                                                       |
| `Customer`           | Relación comercial entre transportista y organización cliente; puede vincularse al usuario cliente. |
| `Order`              | Solicitud del cliente. Conserva organización propietaria y transportista destinatario.              |
| `Service`            | Ejecución creada al aceptar un pedido. No duplica ni sustituye a `Order`.                           |
| `Assignment`         | Historial de asignación de servicio a conductor y vehículo.                                         |
| `Driver`             | Recurso operativo delimitado por transportista; puede vincularse a un usuario.                      |
| `Vehicle`            | Recurso de flota delimitado por transportista.                                                      |
| `ServiceEvent`       | Evento persistido de pedido/servicio, con actor, correlación, versión y payload.                    |
| `AuditLog`           | Acción del usuario, entidad, tenant, request y metadatos.                                           |

## Relaciones

```text
Organization 1─* Membership *─1 User
Carrier Organization 1─* Customer *─1 Customer Organization
Customer 1─* Order 1─0..1 Service
Service 1─* Assignment *─1 Driver
                         *─1 Vehicle
Order/Service 1─* ServiceEvent
Organization/User 1─* AuditLog
```

## Separación Order / Service

`Order` contiene la solicitud: referencia, ruta, mercancía, ventanas y requisitos. Su estado inicial es `SUBMITTED`.

`Service` aparece únicamente cuando el transportista acepta el pedido. Representa la ejecución y pasa de `PLANNED` a `ASSIGNED`. Un índice único impide crear más de un servicio para el mismo pedido en esta primera vertical.

## Multi-tenancy

Todas las entidades operativas contienen `organizationId`. Los recursos compartidos entre cliente y transportista añaden la organización participante explícita:

- pedido: propietario cliente + transportista destinatario;
- servicio: transportista ejecutor + cliente participante;
- asignación, conductor y vehículo: organización transportista;
- evento y auditoría: organización bajo la que ocurrió la acción.

Las consultas nunca aceptan el tenant del body como autoridad. El contexto procede de la membresía autenticada. Los tests prueban que `org_other` no puede leer pedidos ni servicios de `org_tvd`/`org_nova`.

## Entidades todavía conceptuales o DEMO

`DECA`, `Location`, `Document`, `Incident`, `POD`, `Invoice`, `Message`, `Notification`, `Automation`, `AutomationExecution` e `Integration` no están todavía en el schema productivo. Sus pantallas y datos permanecen en el backend de demostración del navegador o en la demo legacy.
