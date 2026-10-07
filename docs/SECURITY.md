# Seguridad y multi-tenancy

## Estado actual

El backend de `backend/` aplica autorización y aislamiento de organización en servidor para pedidos, servicios, asignaciones, conductores, vehículos y aceptación del conductor. La pertenencia, el rol y la organización se validan contra PostgreSQL antes de ejecutar cada operación. Los eventos y cambios auditables de este flujo se persisten en la misma transacción.

La identidad usa email y contraseña. Las contraseñas se almacenan con `scrypt` y salt aleatorio. Las sesiones tienen token opaco de 256 bits, hash persistido, caducidad absoluta y revocación server-side. La cookie es `HttpOnly`, `SameSite=Lax`, limitada a `/` y añade `Secure` en producción. El frontend no guarda tokens en `localStorage` ni `sessionStorage`.

El login limita intentos por IP y email durante una ventana de 15 minutos y devuelve el mismo error para email inexistente o contraseña incorrecta. Los logs redactan cookies, autorización y passwords. CORS acepta el origen web y la lista exacta de orígenes internos de Capacitor. Las mutaciones web rechazan peticiones `cross-site`; mobile-login y peticiones Bearer solo se admiten desde esos orígenes permitidos. No se usan comodines. Las cabeceras DEV ya no autentican ni cambian usuario, rol u organización.

La clave de Google Maps llega al navegador por diseño: restringirla por referrer y API en Google Cloud. No debe otorgar acceso a APIs adicionales ni reutilizarse como secreto de servidor.

El webhook GES de demo usa secreto compartido y recibe un evento normalizado de un futuro conector. Un `authResults` declarado por el emisor no acredita por sí solo autenticación del correo; validar origen con el proveedor de email de confianza. No automatizar clics en enlaces autenticados sin autorización.

## Requisitos antes de producción

1. Recuperación de contraseña, rotación de credenciales comprometidas y MFA para privilegios.
2. RBAC y políticas por organización/recurso en servidor para toda petición; denegar por defecto y probar accesos cruzados.
3. Derivar `organizationId` de membresía autenticada, no del body. Aplicar filtros también a exportaciones, búsquedas y trabajos en background.
4. Gestor de secretos, rotación y privilegio mínimo; secretos nunca en frontend, logs, URLs ni commits.
5. HTTPS extremo a extremo, cabeceras de seguridad y un rate limiter compartido para despliegues con varias réplicas.
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

Ampliar las mismas reglas a documentos, tracking, facturación, notificaciones y procesos en background. Añadir restricciones/RLS en DB como segunda barrera. Los tokens futuros de tracking de cliente deberán ser aleatorios, solo lectura, por servicio y revocables.

## Cliente móvil Expo implementado

La Driver App Expo usa Bearer sin cambiar el modelo de sesión. El token sigue siendo opaco y revocable, el backend guarda solo el hash y `/auth/me` no lo expone.

`expo-secure-store` lo almacena en Keychain en iOS y almacenamiento cifrado respaldado por Android Keystore en Android. Nunca se guarda la contraseña. La API se configura con `EXPO_PUBLIC_API_URL`, no contiene secretos y solo acepta HTTPS.

La app restringe su navegación a conductor, pero esta medida es UX y reducción de superficie. El backend valida rol, membership, organización, vínculo `Driver.userId` y `Assignment` activo en cada petición. Logout intenta revocar la sesión y siempre borra el token local; sin conectividad, la sesión remota conserva su caducidad o puede revocarse administrativamente.

`pnpm mobile:dev` publica temporalmente solo Fastify mediante Quick Tunnel HTTPS; PostgreSQL permanece en loopback. El bundle de Expo viaja por LAN o por el túnel propio de Expo. La URL efímera se ignora en Git y no sustituye autenticación ni autorización.

El cliente PostgreSQL limita el tiempo de conexión y consulta. Esto evita acumular peticiones de autenticación pendientes si Docker/PostgreSQL deja de responder; no altera `scrypt`, sesiones, RBAC ni aislamiento. `/ready` no expone datos y devuelve únicamente disponibilidad del servicio y la base.

## Preview HTTPS de iPhone desde Windows

`pnpm iphone:dev` publica únicamente Vite mediante una URL aleatoria de Cloudflare Quick Tunnel. Fastify y PostgreSQL permanecen en `127.0.0.1`; Vite reenvía `/api` en el mismo origen HTTPS de Safari. El backend se ejecuta con cookie `Secure`, valida el origen fijo del proxy local y conserva `HttpOnly`/`SameSite=Lax`. No se añade un origen dinámico ni un comodín CORS.

La superficie de frontend se limita al portal Driver y no muestra accesos rápidos de seed. El túnel sí deja accesibles la pantalla de login, assets y proxy API mientras el proceso está activo. La URL no es un control de autorización: toda operación sigue dependiendo de sesión, RBAC, tenant y vínculo del conductor. Es un entorno efímero de demostración, sin datos reales ni garantía de disponibilidad; `Ctrl+C` elimina el acceso. El binario y `.iphone-preview.json` se ignoran en Git.
