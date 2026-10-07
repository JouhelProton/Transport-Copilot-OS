# Driver Mobile

## Alcance v0.3

La Driver App reutiliza `/frontend` y `/conductor` con Capacitor 8. El build web continúa con TanStack Start/Nitro; `pnpm mobile:build` activa SPA mode y genera `.output/public/index.html` para los contenedores nativos. La aplicación de teléfono queda en orientación vertical para favorecer el uso con una mano; iPad conserva las orientaciones generadas.

```text
React /conductor
  ├─ Web: cookie HttpOnly
  └─ Capacitor iOS/Android: sesión opaca Bearer + almacenamiento seguro
            ↓
Fastify /api/v1/driver/*
            ↓
User → Membership DRIVER → Driver → Assignment → Service
```

## Componentes de plataforma

- `PlatformService`: detecta el runtime, expone la URL API, configura barras/safe areas y limita la superficie nativa a conductor.
- `AuthTransport`: conserva cookies en web y usa Keychain/Android Keystore en nativo. No usa `localStorage`.
- `api-client`: unifica errores y adjunta credenciales sin dispersar condicionales Capacitor.
- conectividad: usa `@capacitor/network`; v0.3 solo muestra online/offline y desactiva acciones. No existe cola ni sincronización offline.

## Configuración y comandos

Requiere Node.js 24 y pnpm. Copiar `frontend/.env.mobile.example` como `.env.mobile.local` y cambiar únicamente valores locales:

```dotenv
VITE_API_BASE_URL=https://api-desarrollo.example.com
VITE_APP_SURFACE=driver
```

Un teléfono físico no puede acceder al PC mediante `127.0.0.1`. Usar un hostname HTTPS accesible por el dispositivo, por ejemplo un entorno de desarrollo o un túnel autenticado. No guardar una IP privada personal en Git. El backend debe escuchar en una interfaz apropiada solo cuando la red esté controlada, y `CORS_ORIGIN`/`MOBILE_CORS_ORIGINS` deben conservar listas exactas.

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm mobile:build
pnpm exec cap sync
pnpm ios:open       # solo macOS con Xcode
pnpm android:open   # Android Studio
```

Producción exige HTTPS. No se ha habilitado cleartext global ni una excepción ATS general. Para desarrollo local se recomienda HTTPS; cualquier excepción HTTP temporal debe limitarse a una configuración Debug y a un host concreto, y eliminarse de Release.

## Validación desde iPhone sin Mac

Windows puede exponer temporalmente la superficie Driver mediante un único Cloudflare Quick Tunnel. Safari usa el mismo origen HTTPS para UI y `/api`; Vite reenvía el API a Fastify en loopback. La web mantiene cookie `HttpOnly` y la configuración nativa conserva Bearer con almacenamiento seguro.

```powershell
# una sola vez
pnpm iphone:setup

# cada sesión, desde la raíz
pnpm iphone:dev
```

La URL aparece en la terminal. La guía completa, límites y pasos de **Añadir a pantalla de inicio** están en `docs/IPHONE_WINDOWS_DEVELOPMENT.md`. El manifest y los iconos son mínimos; no hay Service Worker ni funcionamiento offline de la aplicación.

## Cambiar identidad y marca

1. Cambiar `appId` y `appName` en `frontend/capacitor.config.ts` antes de publicar.
2. Ejecutar `cap sync`. Un proyecto ya creado puede exigir ajustar también `PRODUCT_BUNDLE_IDENTIFIER` en Xcode y `applicationId`/`namespace` en Gradle.
3. Sustituir AppIcon/Splash en los catálogos iOS y recursos Android; los actuales son placeholders generados por Capacitor.
4. Cambiar dominio/API mediante archivos `.env.<mode>.local`; nunca incrustar secretos.
5. Revisar universal links/app links cuando exista dominio definitivo. No están configurados en v0.3.

## Límites

No hay GPS, tracking en segundo plano, ETA, geofences, push, cámara, POD, documentos, incidencias completas ni sincronización offline. La app no solicita sus permisos. `DRIVER_ACCEPTED` solo se muestra después de la confirmación del backend. La PWA/Safari valida la experiencia web móvil; no sustituye la validación nativa en iPhone.
