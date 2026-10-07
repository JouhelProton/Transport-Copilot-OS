# Seguridad y multi-tenancy

## Estado actual
El backend de `backend/` aplica autorización y aislamiento de organización en servidor para el primer flujo operativo: pedidos, servicios, asignaciones, conductores y vehículos. La pertenencia, el rol y la organización se validan contra PostgreSQL antes de ejecutar cada operación. Los eventos y cambios auditables de este flujo se persisten en la misma transacción.

La identidad sigue siendo exclusivamente de desarrollo: el cliente envía `x-dev-user-id` y `x-organization-id`. Estas cabeceras son falsificables y no constituyen autenticación de producción. No desplegar esta modalidad a Internet ni cargar datos reales. El frontend heredado y los módulos que no pertenecen al primer flujo siguen siendo demo. El servidor raíz conserva la demo JSON local y no forma parte del backend objetivo.

La clave de Google Maps llega al navegador por diseño: restringirla por referrer y API en Google Cloud. No debe otorgar acceso a APIs adicionales ni reutilizarse como secreto de servidor.

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

## Multi-tenancy implementado en la base actual
- `Membership` determina el rol de un usuario dentro de una organización.
- Los pedidos pertenecen a la organización cliente y señalan una organización transportista participante.
- Los servicios pertenecen a la organización transportista y conservan la organización cliente participante.
- Conductores, vehículos, asignaciones, eventos y auditoría quedan delimitados por organización.
- Las consultas filtran en servidor por organización participante; una organización ajena recibe `404` para no revelar la existencia del recurso.
- Los tests verifican el flujo completo y un intento de acceso cruzado.

## Multi-tenancy pendiente para producción
Sustituir las cabeceras DEV por una identidad autenticada y derivar el contexto de tenant de su sesión/token. Ampliar las mismas reglas a documentos, tracking, facturación, notificaciones y procesos en background. Añadir restricciones/RLS en DB como segunda barrera. Los tokens futuros de tracking de cliente deberán ser aleatorios, solo lectura, por servicio y revocables.
