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

**STATUS: IMPLEMENTADO TÉCNICAMENTE — VALIDACIÓN FÍSICA PENDIENTE**

GPS foreground consentido con Expo Location, sesiones explícitas, posiciones actuales e histórico PostgreSQL, validación server-side, deduplicación, cola móvil limitada, polling del portal transportista y Google Maps cuando la clave está configurada. No incluye background fiable en Expo Go, ETA, geofences ni proveedor GES. La prueba final en iPhone todavía no está validada.

## v0.5 — Operations

**STATUS: IMPLEMENTADO TÉCNICAMENTE — VALIDACIÓN VISUAL PENDIENTE**

ETA mediante proveedor sustituible, estado de retraso, geofences con histéresis, incidencias operativas, notificaciones internas y panel de excepciones. Sin clave servidor de Google Routes la ETA se muestra como no disponible. La llegada GPS no completa la entrega.

### v0.5.1 — Corrección GPS end-to-end

**STATUS: IMPLEMENTADO TÉCNICAMENTE — VALIDACIÓN FÍSICA PENDIENTE**

Corrige los centinelas negativos de sensores iOS, la clasificación de errores y los reintentos de la cola móvil, refuerza la idempotencia concurrente y añade diagnóstico en móvil, backend y portal. La verificación automatizada y por API local no sustituye la prueba del GPS de un iPhone real.

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

Cada rama se revisa antes de fusionarse. Los módulos marcados DEMO no reciben datos reales. Las validaciones físicas pendientes de v0.3.5/v0.4 no se consideran cerradas por implementar v0.5.
