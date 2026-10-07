# Expo Driver App

## Arquitectura v0.3.5

`/mobile` es la aplicación oficial candidata del conductor: React Native, Expo SDK 57, Expo Router y TypeScript. `/frontend` continúa sirviendo los portales web de cliente y transportista. Los tres clientes usan el mismo backend Fastify y las mismas sesiones, permisos y entidades PostgreSQL.

```text
iPhone / Expo Go
  → bundle Expo (LAN o túnel Expo)
  → API HTTPS efímera (Cloudflare Quick Tunnel)
  → Fastify 127.0.0.1:3101
  → PostgreSQL 127.0.0.1:5434
```

La conexión del bundle Expo y la conexión al API son independientes. El túnel Cloudflare solo publica Fastify; PostgreSQL permanece en loopback.

## Preparación

Requiere Node.js 24, pnpm 11, dependencias instaladas, `backend/.env`, PostgreSQL migrado y seed ejecutado. Una vez:

```powershell
pnpm iphone:setup
cd mobile
pnpm install --frozen-lockfile
cd ..
```

Cada sesión, con Windows y iPhone en la misma Wi-Fi:

```powershell
pnpm mobile:dev
```

El comando arranca backend, espera a que `/ready` confirme PostgreSQL, crea una URL HTTPS efímera para `EXPO_PUBLIC_API_URL` e inicia Expo en LAN. Mantener la terminal abierta. Si la red local bloquea Metro:

```powershell
pnpm mobile:dev:tunnel
```

El modo túnel de Expo puede requerir iniciar sesión con la misma cuenta de Expo en CLI y Expo Go. No confundirlo con el túnel HTTPS del API.

## Prueba en iPhone

1. Instalar y abrir Expo Go.
2. Escanear el QR mostrado por la terminal.
3. Abrir **Transport Copilot Driver**.
4. Iniciar sesión con `conductor@demo.nexo.local` / `Demo-Transport-2026!` solo en el seed local.
5. Abrir **Mis servicios**, entrar en el servicio, pulsar **Aceptar servicio** y comprobar **Servicio aceptado**.
6. Cerrar sesión y pulsar `Ctrl+C` en Windows.

## Seguridad y sesión

- `POST /auth/mobile-login` entrega una credencial opaca una sola vez.
- Se verifica `/auth/me`, el rol `DRIVER` y `driverId` antes de persistir la credencial.
- `expo-secure-store` conserva únicamente esa credencial en Keychain/Keystore; nunca la contraseña.
- Las llamadas usan Bearer, HTTPS, timeout y mensajes de error seguros.
- Logout intenta revocar la sesión y siempre elimina la copia local.
- Fastify deriva `Driver` desde User/Membership y filtra por organización y Assignment; la app no envía `driverId`.

## Expo Go y límites

Expo Go permite validar navegación, UI nativa, `SecureStore`, conectividad y el flujo API actual. Es una herramienta de desarrollo y no una distribución final. No se han configurado EAS, Development Build, TestFlight, App Store Connect ni Apple Developer Program.

No existen todavía GPS, tracking, background location, ETA, geofences, push, POD, cámara o firma. Estas capacidades se evaluarán en v0.4 y posteriores; background location probablemente exigirá Development Build/EAS y configuración nativa.

## Estado de sustitución

Capacitor queda **DEPRECATED para Driver App** tras la validación técnica automatizada de login, lista, detalle, aceptación y logout en Expo. Sus fuentes se conservan temporalmente como referencia y fallback. v0.3.5 permanece **EN CURSO** hasta que una persona valide físicamente el flujo en iPhone.
