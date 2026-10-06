# Arquitectura del producto

## Objetivo
Transport Copilot OS conecta cliente, transportista y conductor en un flujo operativo compartido: pedido → preparación documental/DECA → servicio → asignación → ejecución → seguimiento → incidencias → POD → facturación. Principio: **el operador decide; el sistema ejecuta las acciones autorizadas y deja trazabilidad**.

## Estado actual de este repositorio
Este repositorio es una demo local independiente, no el código fuente del proyecto Lovable preview. Usa HTML, CSS y JavaScript ES modules sin framework de interfaz ni dependencias declaradas. `server.mjs` usa módulos nativos de Node.js, sirve las vistas y actúa como backend de demostración. No hay ORM, base de datos transaccional, autenticación ni API productiva.

- `/` e `index.html`: portal cliente (`src/clientPortal.js`, `src/portalData.js`).
- `/transporter.html`: panel de operaciones (`src/app.js`, `src/data.js`).
- `/driver.html`: interfaz móvil del conductor (`src/driver.js`, `driver-sw.js`, `driver.webmanifest`).
- `server.mjs`: archivos estáticos, workflow compartido, tracking y configuración de integraciones de demo.
- `.local-data/`: persistencia JSON local fuera del control de versiones para workflow y datos recibidos de tracking.
- `docs/`: documentación de integraciones, tracking e IA, además de estos contratos.

El estado compartido NV-24081 se guarda en JSON; otras pantallas usan datos JavaScript ficticios en memoria. La PWA no implementa GPS real ni sincronización en segundo plano. El tracking puede mostrar posición fija de demo, lectura del webhook de correo o consulta HTTP configurada; no se asume que GES tenga una API accesible. Google Maps Embed dibuja coordenadas recibidas, no obtiene la posición.

## Arquitectura objetivo
```text
Portales web cliente / operaciones / conductor
                    ↓ HTTPS, API versionada y autorización
API (validación, autenticación, RBAC y contexto de organización)
                    ↓
Servicios de dominio y lógica de negocio
       ↙ eventos / reglas / adaptadores ↘
PostgreSQL + almacenamiento de documentos + cola durable
                    ↓
   GES/telemática · email · ERP · mensajería · facturación
```
El backend será la fuente de verdad. Los adaptadores normalizan formatos y no escriben directamente en datos de dominio. Los eventos se registran con la mutación; las acciones asíncronas son idempotentes, reintentables y auditables.

## Módulos de dominio
Auth, Organizations, Customers, Orders, DECA, Services/Trips, Assignments, Drivers, Vehicles, Tracking, ETA, Documents, POD, Incidents, Messages, Notifications, Automation, Billing, Integrations y Audit. `Order` representa lo solicitado; `Service/Trip` representa la ejecución. Un pedido podrá originar uno o más servicios según reglas de negocio.

## Trabajo paralelo
- **Frontend:** React/UI, componentes, UX, páginas, estado de interfaz, formularios y cliente API.
- **Backend:** API, persistencia, auth, RBAC/RLS, reglas de dominio, eventos, automatización e integraciones.
- **Frontera compartida:** `API_CONTRACT.md`. Documentar incompatibilidades y coordinarlas antes de editar ambas partes.

La migración a la arquitectura objetivo es futura; PostgreSQL, GPS, integración GES, facturación y autenticación reales no existen hoy en esta demo.
