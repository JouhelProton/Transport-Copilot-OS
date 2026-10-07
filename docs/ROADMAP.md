# Roadmap priorizado

## Fase 0 — Preparación completada

- Repositorio canónico y documentación base.
- Frontend de Lovable migrado a `/frontend`.
- Demo Node anterior conservada como legacy.
- Google Maps integrado como capa visual, sin atribuirle tracking real.

## Fase 1A — Primera vertical backend completada en `feat/backend-foundation`

- Backend Node.js 24, TypeScript, Fastify, Prisma, PostgreSQL y Zod.
- Organizaciones, usuarios, membresías/roles, clientes, pedidos, servicios, asignaciones, conductores y vehículos.
- Eventos persistidos y auditoría transaccional.
- Autenticación DEV sustituible, RBAC y aislamiento server-side.
- Flujo cliente crea pedido → transportista acepta → servicio → asignación.
- Frontend conectado únicamente para esta vertical.

## Fase 1B — Siguiente paso recomendado

- Sustituir autenticación DEV por proveedor de identidad, sesiones seguras y MFA para privilegios.
- Añadir políticas PostgreSQL/RLS como segunda barrera de tenant.
- Acordar despliegue, secretos, observabilidad, copias y restauración.
- Añadir paginación, idempotencia y contrato OpenAPI antes de ampliar endpoints.

## Fase 2 — Ejecución operativa

- Aceptación real del conductor y estados del viaje.
- Almacenamiento documental privado y DECA tras validar requisitos legales.
- Incidencias, comentarios y comunicaciones auditables.
- POD con evidencias y validación operacional.

## Fase 3 — Tracking y visibilidad

- Integración oficial GES/telemática o app de conductor.
- Historial de posiciones con consentimiento y retención.
- ETA, detección de retrasos y alertas medibles.

## Fase 4 — Automatización y facturación

- Outbox, cola durable, workers e idempotencia.
- Motor `EVENT → RULE → ACTION` con aprobaciones.
- Preparación y emisión fiscal mediante proveedor validado.

## Condición de avance

La rama de esta fase no se fusiona automáticamente. Antes de producción se debe reemplazar la autenticación DEV y completar infraestructura, RLS, seguridad y operación. Los módulos marcados DEMO no deben recibir datos reales.
