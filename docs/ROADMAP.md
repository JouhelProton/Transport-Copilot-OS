# Roadmap oficial

## v0.1 — Foundation

**STATUS: COMPLETADO**

Backend Node/Fastify/Prisma/PostgreSQL, multi-tenancy, `Order → Service → Assignment`, eventos, auditoría, frontend conectado y Google Maps como visualización.

## v0.2 — Auth & Security Foundation

**STATUS: COMPLETADO**

Contraseñas `scrypt`, sesiones opacas revocables, cookie `HttpOnly`, organización activa, RBAC, aislamiento server-side, `/auth/me` y logout.

## v0.3 — Driver Mobile

**STATUS: IMPLEMENTADO**

Autenticación móvil segura, servicios reales del conductor y aceptación idempotente `DRIVER_ACCEPTED` implementados. La base Capacitor anterior queda deprecada para Driver App.

- **Mobile web/PWA:** se conserva como referencia y fallback temporal.
- **Driver nativa:** migrada a React Native + Expo en v0.3.5.

## v0.3.5 — Expo Driver App Migration

**STATUS: EN CURSO**

Expo SDK 57, Expo Router, SecureStore, conectividad, login DRIVER, servicios, detalle, aceptación y logout están implementados y validados técnicamente. Pasa a **COMPLETADO** cuando el flujo se confirme físicamente en un iPhone mediante Expo Go.

## v0.4 — Live Tracking

GPS consentido, background location, historial, proveedor de tracking, ETA y geofences. No iniciado.

## v0.5 — Operations

Estados de viaje, incidencias, comunicación y gestión por excepciones.

## v0.6 — Documents & POD

Almacenamiento privado, cámara/firma, POD y validación.

## v0.7 — Automation Core

Outbox, cola durable, workers y reglas `EVENT → RULE → ACTION`.

## v0.8 — DECA & Document Workflows

Flujos documentales y DECA tras validación legal y técnica.

## v0.9 — Billing, Integrations & Hardening

Facturación, conectores oficiales, observabilidad y endurecimiento.

## v0.95 — SaaS Admin Control Center

**REQUISITO FORMAL.** Panel separado para propietarios del SaaS, conceptualmente `admin.dominio.com`, con organizaciones, usuarios, planes, consumo, servicios, conductores online, integraciones, automatizaciones, errores, sesiones, auditoría, salud, alertas y soporte. Debe responder: “¿Está funcionando correctamente mi SaaS?” y gestionar por excepciones.

## v0.99 — Production Readiness

RLS, recuperación/MFA, seguridad operativa, backups/restauración, despliegue, pruebas de carga y runbooks.

## v1.0 — Production MVP

Vertical productiva aprobada, operada y monitorizada con clientes reales.

## Condición de avance

Cada rama se revisa antes de fusionarse. Los módulos marcados DEMO no reciben datos reales. v0.4 no comienza en esta rama; requiere cerrar la validación física de v0.3.5 en Expo Go. No se necesita Mac para esta comprobación.
