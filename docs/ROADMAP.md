# Roadmap priorizado

## Fase 0 — Preparación (este hito)
- Demo arranca y rutas principales responden.
- Documentar arquitectura actual/objetivo, entidades, contrato API, eventos, automatizaciones y seguridad.
- Establecer frontera Frontend/Backend y registrar diferencias entre demo y producto.

## Fase 1 — Fundaciones de producto
- Acordar flujos reales, roles, estados, tenant, retención de datos y proveedor de identidad.
- Elegir despliegue, PostgreSQL/ORM, almacenamiento privado y migraciones; diseñar threat model.
- Implementar backend con organizaciones, usuarios/membresías, permisos, auditoría y tests de aislamiento.
- Separar `Order` de `Service/Trip`; implementar pedidos, aceptación, asignación y estados en API versionada.

## Fase 2 — MVP de ejecución
- Integrar portales al API según `API_CONTRACT.md` y eliminar dependencia de fixtures como fuente de negocio.
- Documentos privados, flujo DECA según requisitos legales confirmados, incidencias y comunicaciones.
- Aplicación móvil/conductor para aceptación, eventos de viaje y POD con validación operacional.

## Fase 3 — Tracking y visibilidad
- Confirmar permisos y documentación del proveedor GES/telemática; integrar adapter probado en sandbox.
- Definir consentimiento, frecuencia, precisión y retención; persistir historial; mapa solo representa posiciones recibidas.
- ETA, eventos de retraso y alertas medibles, con fuente de datos visible.

## Fase 4 — Automatizaciones y cobro
- Motor durable `EVENT → RULE → ACTION`, idempotencia, reintentos, bandeja de ejecución y aprobaciones.
- Notificaciones auditables con preferencias y consentimiento.
- Preparación de facturas; integrar proveedor/fiscalidad tras validar obligaciones y controles.

## Fase 5 — Integraciones y operación
- Adaptadores ERP/TMS, email, almacenamiento, mensajería, IA y GES con sandbox, rotación de credenciales y monitorización.
- Pruebas de carga, recuperación, observabilidad, seguridad y soporte antes de ampliar clientes.

## Condición de avance
No tratar mapa o automatización demo como tracking o ejecución real. Cada hito de producto necesita criterios de aceptación, datos de prueba aislados, seguridad revisada y pruebas de contrato/integración pertinentes.
