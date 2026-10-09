# Arquitectura del producto

## Objetivo

NEXO Copilot, descrito como Transport Copilot OS y desarrollado por NEXO Technologies, conecta cliente, transportista y conductor en un flujo operativo compartido. El principio de producto es: **el operador decide; el sistema ejecuta las acciones autorizadas y deja trazabilidad**.

## Estructura actual

```text
/frontend  React 19 + TanStack Start/Vite; portales web de cliente y transportista
/mobile    React Native + Expo SDK 57; Driver App iOS/Android
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

El frontend conserva los componentes y la navegación de Lovable. Pedidos, servicios, conductores, vehículos, asignaciones, aceptación y tracking GPS consumen el API real. Incidencias, documentos, POD, facturas, mensajería y automatizaciones siguen siendo DEMO.

`/mobile` contiene la Driver App exclusiva creada con componentes React Native y Expo Router. Consume directamente los endpoints `/api/v1/driver/*`, guarda la sesión opaca en SecureStore y no contiene rutas de cliente, transportista o admin. La autorización definitiva permanece en el backend. La implementación Capacitor previa se conserva como referencia y queda deprecada para Driver App mientras se completa la validación física de Expo.

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
      tracking/          sesiones, posiciones, histórico y autorización GPS
      documents/         API, permisos y almacenamiento privado de documentos/POD
    plugins/             Prisma/PostgreSQL
    shared/              errores y presenters del API
  prisma/
    schema.prisma
    migrations/
    seed.ts
  tests/                 integración de la vertical y aislamiento
```

Las mutaciones compuestas usan transacciones Prisma. El cambio de dominio, `ServiceEvent` y `AuditLog` se escriben juntos. No existe todavía cola/outbox ni trabajadores asíncronos.

Tracking separa captura (Expo Location), envío (controlador con cola limitada), autorización (Fastify), persistencia (current/histórico), consulta y visualización (Google Maps). El portal usa polling de 10 segundos; no se introducen WebSockets en v0.4.

Operations Intelligence consume posiciones persistidas y mantiene proyecciones separadas: ETA, estado operativo, geofences, incidencias y notificaciones. `EtaProvider` desacopla Google Routes del dominio. El cálculo se limita por tiempo y distancia; los eventos de geofence usan precisión e histéresis. El panel web consulta `/operations/exceptions` cada 30 segundos.

El adaptador PostgreSQL aplica timeouts finitos de conexión y consulta para que una caída del motor no deje peticiones pendientes indefinidamente. `/health` comprueba el proceso y `/ready` comprueba además PostgreSQL; los orquestadores de desarrollo esperan readiness antes de publicar la API.

## Documents & POD v0.6

Los binarios se guardan fuera de PostgreSQL mediante `PrivateDocumentStorage`. El adaptador local escribe con identificadores UUID impredecibles, creación exclusiva y un directorio privado que no se sirve como contenido estático. PostgreSQL conserva metadatos, SHA-256, estado, visibilidad, actor e historial. La interfaz permite sustituir el adaptador por almacenamiento S3-compatible sin cambiar el contrato HTTP.

La autorización parte siempre de la sesión: el transportista accede solo a servicios de su organización; el conductor necesita una asignación activa; el cliente necesita ser la organización cliente participante y solo recibe documentos `SHARED + APPROVED` y POD aprobado. Las descargas atraviesan Fastify y nunca revelan rutas del disco.

## Identidad, sesión y tenant

`User` representa identidad y conserva únicamente un hash `scrypt` de la contraseña. Un login válido crea un token opaco aleatorio; el navegador recibe el token en una cookie `HttpOnly` y PostgreSQL guarda solo su hash SHA-256. `Session` controla expiración, revocación, último uso y la `Membership` activa.

La organización y el rol se derivan siempre de `Session.currentMembershipId`. Cambiar de organización requiere seleccionar una membership perteneciente al usuario. Las antiguas cabeceras `x-dev-user-id` y `x-organization-id` ya no participan en la autenticación. RBAC se centraliza en permisos como `orders:create`, `orders:accept` y `services:assign`.

El navegador usa cookie `HttpOnly`. La Driver App Expo usa el mismo token opaco de `Session` como Bearer. El token móvil se guarda únicamente en Keychain/Android Keystore mediante `expo-secure-store`; PostgreSQL conserva solo su hash. Expiración, revocación, organización activa y RBAC son comunes.

`Order.organizationId` identifica a la organización cliente propietaria del pedido y `carrierOrganizationId` al transportista destinatario. `Service.organizationId` identifica al transportista ejecutor y `customerOrganizationId` al cliente participante. Solo esos participantes explícitos acceden al recurso; un tercer tenant recibe `404`.

## Ejecución local

La ruta recomendada es ejecutar desde la raíz:

```powershell
pnpm dev:stack
```

El orquestador inicia PostgreSQL con Docker, aplica migraciones, espera `/ready`, inicia Fastify y Vite, verifica ambos por HTTP y mantiene los procesos en primer plano. Publica el portal en `http://127.0.0.1:3000` y el API en `http://127.0.0.1:3001`.

1. Copiar `backend/.env.example` a `backend/.env`.
2. Ejecutar `docker compose -f backend/docker-compose.yml up -d --wait`.
3. En `/backend`: generar Prisma, aplicar migraciones y ejecutar el seed.
4. Iniciar el backend en `127.0.0.1:3001`.
5. Configurar `VITE_API_BASE_URL=http://127.0.0.1:3001` en `frontend/.env` e iniciar `/frontend`.

El seed local crea usuarios ficticios `*@demo.nexo.local` con contraseña `Demo-Transport-2026!`. Estas credenciales son solo para desarrollo.

Node.js 24 es obligatorio para el backend. PostgreSQL solo se publica en `127.0.0.1:5434` durante desarrollo local.
