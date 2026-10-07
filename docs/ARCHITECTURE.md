# Arquitectura del producto

## Objetivo

Transport Copilot OS conecta cliente, transportista y conductor en un flujo operativo compartido. El principio de producto es: **el operador decide; el sistema ejecuta las acciones autorizadas y deja trazabilidad**.

## Estructura actual

```text
/frontend  React 19 + TanStack Start/Vite + Capacitor 8; web, iOS y Android
/backend   Node.js 24 + TypeScript + Fastify + Prisma + PostgreSQL
/docs      contratos, arquitectura, seguridad y roadmap
/          demo Node/HTML/JavaScript anterior, conservada como legacy
```

`/backend` es la fuente de verdad de la primera vertical real:

```text
cliente crea Order
  → PostgreSQL
  → transportista consulta y acepta
  → se crea Service
  → se crea Assignment con Driver y Vehicle
  → el Driver autenticado acepta su Assignment
  → Service pasa a DRIVER_ACCEPTED con evento y auditoría
  → eventos y auditoría en la misma transacción
  → ambos portales consultan el nuevo estado
```

El frontend conserva los componentes y la navegación de Lovable. Pedidos, servicios, conductores, vehículos, asignaciones y aceptación del conductor consumen el API real. Tracking, mapas como fuente de posición, incidencias, documentos, POD, facturas, mensajería y automatizaciones siguen siendo DEMO.

`/conductor` es una interfaz mobile-first compartida por web y la Driver App. Capacitor usa un build SPA de la misma base React; `frontend/ios` y `frontend/android` son contenedores nativos versionados. `PlatformService`, `AuthTransport` y la capa de conectividad centralizan las diferencias de plataforma. La superficie nativa bloquea en el router cualquier ruta fuera de `/conductor` y `/login/conductor`; la autorización definitiva permanece en el backend.

La aplicación raíz (`server.mjs`, HTML y `src/`) sigue disponible como referencia legacy. Su JSON local y endpoints `/api/workflow`, `/api/tracking` y `/api/integrations` no forman parte del backend productivo.

## Backend

```text
backend/
  src/
    app/                 composición Fastify y errores
    config/              entorno validado con Zod
    generated/prisma/    cliente generado, no versionado
    modules/
      auth/              passwords, sesiones, cookies, RBAC y tenant activo
      orders/            creación, lectura y aceptación
      services/          lectura y asignaciones
      resources/         conductores y vehículos
      driver/            consulta aislada y aceptación idempotente
    plugins/             Prisma/PostgreSQL
    shared/              errores y presenters del API
  prisma/
    schema.prisma
    migrations/
    seed.ts
  tests/                 integración de la vertical y aislamiento
```

Las mutaciones compuestas usan transacciones Prisma. El cambio de dominio, `ServiceEvent` y `AuditLog` se escriben juntos. No existe todavía cola/outbox ni trabajadores asíncronos.

## Identidad, sesión y tenant

`User` representa identidad y conserva únicamente un hash `scrypt` de la contraseña. Un login válido crea un token opaco aleatorio; el navegador recibe el token en una cookie `HttpOnly` y PostgreSQL guarda solo su hash SHA-256. `Session` controla expiración, revocación, último uso y la `Membership` activa.

La organización y el rol se derivan siempre de `Session.currentMembershipId`. Cambiar de organización requiere seleccionar una membership perteneciente al usuario. Las antiguas cabeceras `x-dev-user-id` y `x-organization-id` ya no participan en la autenticación. RBAC se centraliza en permisos como `orders:create`, `orders:accept` y `services:assign`.

El navegador usa cookie `HttpOnly`. La Driver App usa el mismo token opaco de `Session` como Bearer porque el WebView y el API remoto no comparten un contexto same-site fiable para la cookie actual. El token móvil se guarda únicamente en Keychain/Android Keystore mediante el adaptador de almacenamiento seguro; PostgreSQL conserva solo su hash. Expiración, revocación, organización activa y RBAC son comunes.

`Order.organizationId` identifica a la organización cliente propietaria del pedido y `carrierOrganizationId` al transportista destinatario. `Service.organizationId` identifica al transportista ejecutor y `customerOrganizationId` al cliente participante. Solo esos participantes explícitos acceden al recurso; un tercer tenant recibe `404`.

## Ejecución local

1. Copiar `backend/.env.example` a `backend/.env`.
2. Ejecutar `docker compose -f backend/docker-compose.yml up -d --wait`.
3. En `/backend`: generar Prisma, aplicar migraciones y ejecutar el seed.
4. Iniciar el backend en `127.0.0.1:3001`.
5. Configurar `VITE_API_BASE_URL=http://127.0.0.1:3001` en `frontend/.env` e iniciar `/frontend`.

El seed local crea usuarios ficticios `*@demo.nexo.local` con contraseña `Demo-Transport-2026!`. Estas credenciales son solo para desarrollo.

Node.js 24 es obligatorio para el backend. PostgreSQL solo se publica en `127.0.0.1:5434` durante desarrollo local.
