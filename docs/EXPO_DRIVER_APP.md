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

Cada sesión:

```powershell
pnpm mobile:dev
```

El comando arranca backend, exige que `/ready` confirme PostgreSQL tanto en local como a través de la URL HTTPS efímera, configura `EXPO_PUBLIC_API_URL` e inicia Expo mediante túnel. Mantener la terminal abierta.

```powershell
pnpm mobile:dev:lan
```

El modo LAN es opcional y solo conviene cuando Windows y el iPhone comparten una red que permite acceder a Metro. El túnel de Expo y el Quick Tunnel HTTPS del API son conexiones distintas.

## Prueba en iPhone

1. Instalar y abrir Expo Go.
2. Escanear el QR mostrado por la terminal.
3. Abrir **Transport Copilot Driver**.
4. Iniciar sesión con `conductor@demo.nexo.local` / `Demo-Transport-2026!` solo en el seed local.
5. Abrir **Mis servicios**, entrar en el servicio y pulsar **Aceptar servicio**.
6. En **Seguimiento GPS**, pulsar **Iniciar seguimiento GPS** y conceder permiso **mientras se usa la app**.
7. Mantener la pantalla activa y desplazarse de forma segura como peatón o acompañante; confirmar **GPS activo y sincronizado**, hora del último intento y de la última confirmación, precisión, sesión y cola pendiente igual a cero.
8. Abrir el portal transportista y confirmar que el panel de recepción y el mapa muestran la misma muestra.
9. Pulsar **Detener seguimiento**, cerrar sesión y pulsar `Ctrl+C` en Windows.

## Seguridad y sesión

- `POST /auth/mobile-login` entrega una credencial opaca una sola vez.
- Se verifica `/auth/me`, el rol `DRIVER` y `driverId` antes de persistir la credencial.
- `expo-secure-store` conserva únicamente esa credencial en Keychain/Keystore; nunca la contraseña.
- Las llamadas usan Bearer, HTTPS, timeout y mensajes de error seguros.
- Logout intenta revocar la sesión y siempre elimina la copia local.
- Fastify deriva `Driver` desde User/Membership y filtra por organización y Assignment; la app no envía `driverId`.

## Expo Go y límites

Expo Go permite validar navegación, UI nativa, `SecureStore`, conectividad y el flujo API actual. Es una herramienta de desarrollo y no una distribución final. No se han configurado EAS, Development Build, TestFlight, App Store Connect ni Apple Developer Program.

v0.4 implementa GPS foreground, histórico y cola limitada de posiciones. La corrección v0.5.1 normaliza los valores `-1` de velocidad y rumbo que iOS usa cuando no hay lectura, conserva muestras ante fallos temporales y separa errores HTTP de falta de conectividad. Expo Go no garantiza tracking cuando iOS suspende la app; background location fiable probablemente exigirá Development Build/EAS y configuración nativa. Push, POD, cámara y firma siguen fuera de esta versión.

## Estado de sustitución

Capacitor queda **DEPRECATED para Driver App** tras la validación técnica automatizada de login, lista, detalle, aceptación y logout en Expo. Sus fuentes se conservan temporalmente como referencia y fallback. v0.3.5 permanece **EN CURSO** hasta que una persona valide físicamente el flujo en iPhone.
