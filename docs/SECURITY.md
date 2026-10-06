# Seguridad y multi-tenancy

## Estado actual
Demo local: Node escucha en `127.0.0.1`; no hay login, sesión, autorización de servidor ni separación multiempresa. Workflow único en `.local-data/workflow-demo.json`; otras pantallas tienen datos ficticios JavaScript. No desplegar a Internet ni cargar información real. La clave de Google Maps Embed llega al navegador: restringir por referrer y API, no considerarla secreto de servidor.

El webhook GES de demo usa secreto compartido y recibe un evento normalizado de un futuro conector. Un `authResults` declarado por el emisor no acredita por sí solo autenticación del correo; validar origen con el proveedor de email de confianza. No automatizar clics en enlaces autenticados sin autorización.

## Requisitos antes de producción
1. Autenticación segura, recuperación, revocación y MFA para privilegios.
2. RBAC y políticas por organización/recurso en servidor para toda petición; denegar por defecto y probar accesos cruzados.
3. Derivar `organizationId` de membresía autenticada, no del body. Aplicar filtros también a exportaciones, búsquedas y trabajos en background.
4. Gestor de secretos, rotación y privilegio mínimo; secretos nunca en frontend, logs, URLs ni commits.
5. HTTPS, validación, límites de tasa/cuerpo, CORS estricto, CSRF si se usan cookies, cabeceras y errores seguros.
6. Webhooks autenticados con firma, timestamp, protección replay, idempotencia y esquema validado.
7. Documentos privados con permisos, URLs temporales, límites/checksum, antivirus y política de retención.
8. Ubicación/contactos con finalidad, consentimiento/base aplicable, acceso mínimo, retención/borrado y auditoría.
9. Auditoría durable, copias cifradas, restauración probada, monitorización y respuesta a incidentes.
10. Validar requisitos legales aplicables a DECA, documentos y facturación con asesoría competente.

## Multi-tenancy objetivo
Validar organización en cada relación entre servicio, cliente, conductor, vehículo y documento. Contexto de tenant procede de identidad/membresía autenticada. Usar restricciones/RLS en DB como segunda barrera, además de autorización de aplicación. Tokens de tracking de cliente: aleatorios, solo lectura, por servicio y revocables.
