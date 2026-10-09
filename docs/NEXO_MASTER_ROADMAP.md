# NEXO — Transport Copilot OS

## Alcance del documento

Este roadmap describe la planificación de producto y negocio. No significa que todas las fases estén implementadas ni que exista disponibilidad comercial.

## Decisiones de producto

- Marca: **NEXO — Transport Copilot OS**.
- Web comercial prevista: `nexocopilot.es`.
- Portal operativo previsto: `portal.nexocopilot.es`.
- Aplicación de conductor: NEXO Driver con Expo.
- Producto SaaS multiempresa: cada transportista contrata y autoriza a sus empleados, conductores y clientes cargadores.
- Modelo comercial: suscripción por empresa, volumen y funcionalidades.
- Los clientes cargadores invitados no necesitan una licencia individual obligatoria.
- La implantación incluye configuración, formación, transportes piloto, soporte y seguimiento.
- Futuro NEXO Continuity: offline ampliado, recuperación operativa y posible servidor local con UPS.

## Roadmap técnico y comercial

### v0.1 — Foundation

Backend Fastify/Prisma/PostgreSQL, tenants, pedidos, servicios, asignaciones, eventos y frontend base.

### v0.2 — Auth & Security

Sesiones opacas, `scrypt`, cookies seguras, Bearer móvil, RBAC, aislamiento y auditoría.

### v0.3 / v0.3.5 — NEXO Driver

Migración a Expo, login de conductor, servicios, aceptación idempotente, SecureStore, conectividad y validación física pendiente de cierre formal.

### v0.4 — Live Tracking GPS

GPS foreground explícito, sesiones de tracking, `CurrentPosition`, `LocationHistory`, cola móvil limitada, API autorizada y portal transportista con Google Maps. Background, ETA y geofences quedan fuera.

### v0.5 — Operations

Implementación técnica disponible: ETA con proveedor sustituible, retrasos, GPS desactualizado, geofences, incidencias del conductor, gestión por operador, notificaciones internas y panel de excepciones. La integración real con Google Routes requiere una clave de servidor y validación de facturación/API.

### v0.5.1 — GPS end-to-end correction

Corrección técnica de compatibilidad con sensores iOS, entrega idempotente, cola offline y visibilidad diagnóstica. La prueba física en iPhone sigue siendo condición para cerrar v0.3.5 y v0.4.

### v0.6 — Documents & POD

Documentos privados, DECA tras validación legal, cámara/firma, POD y validación.

### v0.7 — Automation Core

Outbox, cola durable, workers y reglas `EVENT → RULE → ACTION`.

### v0.8 — Integrations

Integraciones verificadas con TMS, telemática, GES y correo, con contratos, firmas, reintentos e idempotencia.

### v0.9 — Billing & Hardening

Facturación, suscripciones, observabilidad, backups, recuperación y endurecimiento.

### v0.95 — SaaS Admin Control Center

Panel separado para organizaciones, usuarios, planes, consumo, servicios, conductores online, integraciones, automatizaciones, errores, sesiones, auditoría, salud, alertas y soporte.

### v1.0 — Production MVP

Vertical productiva operada con clientes reales, formación, soporte, monitorización y runbooks.

### v2.0 — NEXO Continuity

Offline ampliado, recuperación ante cortes, posible servidor local con UPS y operación degradada controlada.

## Criterio de avance

Cada fase requiere pruebas técnicas, revisión de seguridad y validación del usuario antes del merge a `master`. Este documento no autoriza por sí mismo contratos, compras, despliegues ni declaraciones de funcionalidad productiva.
