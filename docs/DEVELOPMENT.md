# Desarrollo local de NEXO

## Requisitos

- Node.js 24 según `.nvmrc`.
- pnpm y dependencias instaladas en `backend`, `frontend` y `mobile`.
- Docker Desktop iniciado.
- `backend/.env` basado en `backend/.env.example`.
- `frontend/.env` con `VITE_GOOGLE_MAPS_API_KEY` si se desea Google Maps.

La clave web de Maps debe restringirse por referrer y Maps JavaScript API. Para ETA se usa otra clave de servidor opcional, `GOOGLE_ROUTES_API_KEY`, limitada a Routes API y nunca versionada.

## Stack web

Desde la raíz:

```powershell
pnpm dev:stack
```

El comando inicia PostgreSQL sin borrar el volumen, aplica `prisma migrate deploy`, arranca Fastify y Vite, espera `GET /ready` y comprueba el HTML del portal. URLs por defecto:

- Portal: `http://127.0.0.1:3000`
- Backend: `http://127.0.0.1:3001`
- PostgreSQL: `127.0.0.1:5434`

Se pueden cambiar los puertos con `NEXO_FRONTEND_PORT` y `NEXO_BACKEND_PORT`. `Ctrl+C` detiene frontend y backend; PostgreSQL continúa ejecutándose para conservar el entorno.

## NEXO Driver

Con el stack preparado:

```powershell
pnpm mobile:dev
```

El comando verifica PostgreSQL y el API local, publica temporalmente Fastify mediante HTTPS, verifica también `/ready` desde el túnel y abre Metro con el túnel de Expo. El conductor demo es `conductor@demo.nexo.local` y la contraseña local está documentada en `docs/EXPO_DRIVER_APP.md`.

Para forzar Metro en red local:

```powershell
pnpm mobile:dev:lan
```

La terminal muestra la URL pública del API, la URL de Metro y el QR. Si cualquiera de las comprobaciones de readiness falla, el proceso se detiene antes de mostrar un QR inválido.

## Comprobaciones

```powershell
cd backend
pnpm typecheck
pnpm test
pnpm build

cd ..\frontend
pnpm typecheck
pnpm test
pnpm build

cd ..\mobile
pnpm typecheck
pnpm test
```

Las pruebas físicas de GPS, Google Maps y Google Routes se registran por separado. Un test automatizado no demuestra cobertura, precisión o facturación correcta de un proveedor externo.
