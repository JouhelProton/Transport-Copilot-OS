# Arquitectura del producto

## Objetivo

Transport Copilot OS conecta cliente, transportista y conductor en un flujo operativo compartido. El principio de producto es: **el operador decide; el sistema ejecuta las acciones autorizadas y deja trazabilidad**.

## Estructura actual

```text
/frontend  React 19 + TanStack Start/Vite; frontend migrado de Lovable
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
  → eventos y auditoría en la misma transacción
  → ambos portales consultan el nuevo estado
```

El frontend conserva los componentes y la navegación de Lovable. Solo pedidos, servicios, conductores, vehículos y asignaciones consumen el API real. Tracking, mapas como fuente de posición, incidencias, documentos, POD, facturas, mensajería y automatizaciones siguen siendo DEMO.

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

El transporte actual usa cookie para navegador. El núcleo de sesión opaca y revocable es independiente del transporte, por lo que un futuro cliente Capacitor podrá incorporar un canal móvil protegido sin modificar el modelo de identidad o permisos.

`Order.organizationId` identifica a la organización cliente propietaria del pedido y `carrierOrganizationId` al transportista destinatario. `Service.organizationId` identifica al transportista ejecutor y `customerOrganizationId` al cliente participante. Solo esos participantes explícitos acceden al recurso; un tercer tenant recibe `404`.

## Ejecución local

1. Copiar `backend/.env.example` a `backend/.env`.
2. Ejecutar `docker compose -f backend/docker-compose.yml up -d --wait`.
3. En `/backend`: generar Prisma, aplicar migraciones y ejecutar el seed.
4. Iniciar el backend en `127.0.0.1:3001`.
5. Configurar `VITE_API_BASE_URL=http://127.0.0.1:3001` en `frontend/.env` e iniciar `/frontend`.

El seed local crea usuarios ficticios `*@demo.nexo.local` con contraseña `Demo-Transport-2026!`. Estas credenciales son solo para desarrollo.

Node.js 24 es obligatorio para el backend. PostgreSQL solo se publica en `127.0.0.1:5434` durante desarrollo local.
