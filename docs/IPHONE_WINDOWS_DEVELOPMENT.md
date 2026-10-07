# Probar Transport Copilot Driver en iPhone desde Windows

## Qué se prueba

Esta vista usa el frontend React real, el backend Fastify real y PostgreSQL local. Safari accede a un único origen HTTPS temporal. Vite reenvía `/api` al backend privado, por lo que la sesión web conserva una cookie `HttpOnly`, `Secure` y `SameSite=Lax`.

```text
iPhone / Safari / icono de inicio
        ↓ HTTPS público temporal
Cloudflare Quick Tunnel
        ↓ HTTP en loopback
Vite Driver — 127.0.0.1:4276
        ↓ proxy /api en loopback
Fastify — 127.0.0.1:3101
        ↓
PostgreSQL — 127.0.0.1:5434
```

PostgreSQL y Fastify no se publican directamente. La URL cambia cada vez, no se guarda en código y deja de funcionar al cerrar el comando.

## Primera preparación

Se necesitan Node.js 24, pnpm 11, dependencias ya instaladas y la base local migrada y sembrada. Desde la raíz del repositorio:

```powershell
pnpm iphone:setup
```

Este comando descarga `cloudflared.exe` desde la distribución oficial de Cloudflare, valida su firma Authenticode y lo deja en `.tools/`, que Git ignora. Quick Tunnel no necesita cuenta para esta prueba temporal.

## Cada sesión de prueba

1. Arranca PostgreSQL si no está activo:

   ```powershell
   docker compose -f backend/docker-compose.yml up -d --wait
   ```

2. Desde la raíz ejecuta:

   ```powershell
   pnpm iphone:dev
   ```

3. Espera al bloque `URL PARA SAFARI EN IPHONE` y abre esa URL en Safari. El ordenador debe mantener conexión a Internet; el iPhone puede estar en otra red.
4. Inicia sesión con el usuario DRIVER del seed local indicado en `docs/API_CONTRACT.md`.
5. Abre **Mis servicios**, entra en el servicio asignado y pulsa **Aceptar servicio**. El estado debe pasar a `DRIVER_ACCEPTED` después de la respuesta del backend.
6. Para instalar la experiencia web: Safari → **Compartir** → **Añadir a pantalla de inicio** → **Añadir**. Ábrela con el icono **Copilot Driver**.
7. Comprueba el aviso online/offline desconectando y recuperando la red. v0.3 no guarda mutaciones para enviarlas más tarde.
8. Cierra sesión.
9. Pulsa `Ctrl+C` en Windows. Esto detiene frontend, backend y túnel; la URL pública caduca.

La URL activa también se escribe en `.iphone-preview.json` para herramientas locales. El archivo está ignorado por Git.

## Seguridad y límites del preview

- Queda público el servidor web temporal, sus assets, la pantalla de login DRIVER y el proxy `/api`. Los endpoints siguen protegidos por sesión, rol, membership, tenant y asignación en Fastify.
- Esta compilación limita la navegación visible a `/conductor` y `/login/conductor`, y oculta los accesos rápidos con credenciales de seed.
- El backend acepta únicamente el origen exacto del proxy local; no se habilita CORS con comodín.
- La URL aleatoria no incorpora secretos, pero debe tratarse como acceso temporal: no compartirla, no usar datos reales y cerrar el proceso al terminar.
- Quick Tunnel es una facilidad de desarrollo sin garantía de disponibilidad. No es infraestructura de producción.
- No hay caché offline, Service Worker, push, GPS, background location, geofences ni ETA.

## Safari/PWA y Capacitor no son lo mismo

Safari y la instalación en pantalla de inicio validan la experiencia web móvil, HTTPS, cookie y workflow. El contenedor Capacitor sigue siendo el objetivo nativo: usa Bearer más Keychain/Android Keystore y será necesario para capacidades nativas robustas. La compilación, firma e instalación iOS continúan pendientes de un Mac con Xcode; Apple Developer Program queda como opción futura para distribución.

## Resolución rápida de problemas

- **Falta cloudflared:** ejecuta `pnpm iphone:setup`.
- **Puerto ocupado:** cierra otra sesión `iphone:dev` o define `IPHONE_BACKEND_PORT` y `IPHONE_FRONTEND_PORT` antes de iniciar.
- **Backend no arranca:** confirma PostgreSQL, `backend/.env`, migraciones y seed.
- **La URL todavía no abre:** espera unos segundos y vuelve a cargar; si el túnel terminó, reinicia el comando y usa la nueva URL.
- **La sesión no persiste:** abre exactamente la URL HTTPS impresa, permite cookies y evita trasladar la sesión a otro hostname.
