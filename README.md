# Portal de cliente de transporte — demo

## Entorno canónico local

Con Docker Desktop iniciado y las dependencias instaladas, ejecuta desde la raíz:

```powershell
pnpm dev:stack
```

El comando conserva el volumen PostgreSQL, aplica migraciones pendientes, espera a que el backend esté listo y verifica el frontend por HTTP. Portal: `http://127.0.0.1:3000`; API: `http://127.0.0.1:3001`; readiness: `http://127.0.0.1:3001/ready`. Mantén la terminal abierta y usa `Ctrl+C` para cerrar frontend y backend.

> **Producto canónico:** `/frontend` contiene los portales React web de cliente y transportista, `/mobile` la Driver App React Native + Expo y `/backend` el API Fastify/PostgreSQL común. La aplicación HTML/JavaScript descrita debajo se conserva como demo legacy. Para probar la Driver App en iPhone desde Windows consulta [`docs/EXPO_DRIVER_APP.md`](docs/EXPO_DRIVER_APP.md) y ejecuta `pnpm mobile:dev`.

Demo navegable de tres perfiles conectados para un mismo flujo logístico: cliente, transportista y conductor. Los tres leen el servicio demo NV-24081 y su actividad compartida desde el mismo backend local. Los nombres, posiciones y acciones son ficticios; no se envían comunicaciones ni se transmite GPS real.

## Ejecutar

Requiere Node.js **24.21.0 LTS o posterior dentro de la rama 24** (versión indicada en `.nvmrc` y `package.json`). No requiere paquetes npm externos para ejecutar esta demo. Desde esta carpeta:

```powershell
npm run dev
```

Abre `http://127.0.0.1:4173/` para el cliente, `http://127.0.0.1:4173/transporter.html` para el transportista o `http://127.0.0.1:4173/driver.html` para la vista móvil del conductor (también se puede ejecutar con `npm start`). El servidor enlaza por defecto a `127.0.0.1` en el puerto `4173` (se puede cambiar con `PORT`). Esta dirección local es independiente de la preview remota de Lovable: dicha preview no redirige sus peticiones al servidor que corre en este equipo.

## Triángulo de automatización

La demo conecta Cliente ↔ Transportista ↔ Conductor mediante el mismo servicio y eventos compartidos:

1. El conductor confirma llegada a destino.
2. La acción queda registrada en `/api/workflow/NV-24081` y aparece en los paneles de operaciones y cliente.
3. El conductor completa la entrega y registra un POD de demostración.
4. Operaciones valida el POD; el evento de automatización prepara el servicio para facturación.
5. Cliente o conductor pueden crear una incidencia compartida.

El estado demo se guarda en `.local-data/workflow-demo.json`. La pantalla de conductor es una PWA mobile-first instalable desde el navegador; el GPS del dispositivo y el seguimiento en segundo plano todavía no están implementados. El endpoint está pensado solo para ejecutar la demo local y no tiene autenticación ni autorización multiempresa; no debe publicarse ni utilizarse con datos reales.

## Recorrido de la demo

1. **Resumen:** viajes activos, entregas, documentos e incidencias recientes.
2. **Seguimiento:** busca por pedido o referencia y abre un viaje para consultar mercancía, vehículo, conductor, ubicación recibida, temperatura cuando aplica y horarios planificados y reales.
3. **Acciones del viaje:** llamada al conductor, alta de incidencia/comentario, WhatsApp y email. La demo prepara el contenido y permite simular la acción, sin ejecutar comunicaciones reales.
4. **Pedidos:** pedidos y servicios con su estado y acciones disponibles.
5. **Documentación, Incidencias y Facturación:** vistas de consulta con documentos y facturas de ejemplo, así como no conformidades asociadas a los viajes.

## Sincronización con el transportista

El portal incluye el mapa interactivo y un conector backend que puede recibir posiciones ya extraídas y verificadas. El detalle consulta `/api/tracking/{id}` cada 15 segundos. Una posición nueva actualiza el mapa, la hora de lectura y la temperatura. Para la demo, el viaje NV-24081 muestra un punto fijo aproximado en Tarancón, claramente marcado como demostración; no corresponde a un camión real. Las posiciones recibidas reemplazan esa muestra y se guardan en `.local-data/gestracking-positions.json`.

El mapa del portal se muestra **dentro de la página con Google Maps**, con selector **Geográfica / Satélite**. No hay enlaces que saquen al cliente a otro mapa. Se requiere `GOOGLE_MAPS_EMBED_API_KEY`; sin ella, la app explica que falta configurarla en vez de ofrecer otro proveedor.

Para crearla: en Google Cloud crea/elige un proyecto, habilita **Maps Embed API**, configura una cuenta de facturación y crea una clave. Restringe la clave por HTTP referrer (en desarrollo, `http://127.0.0.1:4173/*`; en producción, el dominio real) y limita la API permitida a **Maps Embed API**. Copia `env.example` como `.env`, añade `GOOGLE_MAPS_EMBED_API_KEY=TU_CLAVE` y reinicia el servidor. No compartas la clave por chat ni la subas al repositorio. La clave de Embed se utiliza en el navegador, por eso las restricciones son esenciales. Google indica que el uso de Maps Embed es gratuito y sin límite de solicitudes, aunque el proyecto necesita una cuenta de facturación habilitada.

Para activar la conexión real:

1. Solicitar a GEStracking acceso API/sandbox, documentación del endpoint de posiciones, autenticación, ejemplo de respuesta y permisos para publicar ubicación y temperatura en un portal de terceros. Su web pública describe localización en tiempo real, datos del vehículo y opciones de control de temperatura, pero no publica la especificación API.
2. Copiar `env.example` como `.env` y completar `GESTRACKING_TRACKING_URL_TEMPLATE`, `GESTRACKING_API_TOKEN` y los datos de autenticación/mapeo conforme a la documentación del proveedor. Se aceptan `{vehicleId}` (matrícula configurada para la demo) y `{shipmentId}` en la URL.
3. Reiniciar el servidor. El backend consulta el endpoint configurado por HTTPS; el formato JSON se adapta con `GESTRACKING_RESPONSE_MAP`. `/api/integrations/gestracking` muestra si el servidor está en modo demo o tiene configuración live.

### Puente para posiciones derivadas del correo

El backend admite `POST /api/integrations/gestracking/email` con `x-gestracking-webhook-secret` para que un futuro conector autorizado envíe posiciones ya extraídas del flujo de GEStracking. **No procesa por sí solo el botón/enlace de un correo**: si el email solo contiene un botón que consulta la posición al pulsarlo, hay que identificar la petición autenticada que ejecuta dicho botón o pedir a GEStracking un endpoint/webhook. Repetir clics desde un robot del navegador sería frágil y podría exponer la sesión.

Una vez autorizada esa consulta, el conector de buzón (Gmail/Google Cloud, Microsoft Graph u otro) debe recibir el correo, verificarlo y relacionar el enlace con el viaje. El puente acepta un evento normalizado con `from`, `authResults`, `messageId`, `subject`, `text`, `latitude` y `longitude`, más `receivedAt`; opcionalmente recibe `temperature`, `location`, `eta` y `status`. Se asocia por ID/referencia/pedido/matrícula; rechaza dominios no permitidos, mensajes duplicados, fallos DKIM/DMARC y coordenadas fuera de rango.

Configura `GESTRACKING_EMAIL_WEBHOOK_SECRET` y `GESTRACKING_EMAIL_ALLOWED_DOMAINS` en `.env`; `GESTRACKING_EMAIL_LINK_DOMAINS` limita qué enlaces HTTPS inspeccionar para extraer coordenadas de sus parámetros. El receptor solo inspecciona dominios permitidos; no abre enlaces ni intenta leer sesiones de GEStracking. Para que un proveedor llame al webhook, el servidor de producción debe tener HTTPS y una URL pública. El servidor local enlaza solo a `127.0.0.1`, por lo que no recibe webhooks externos directamente.

Ejemplo de evento normalizado que enviaría el conector del buzón (no contiene ni persiste el enlace/token original):

```json
{
  "from": "avisos@gestracking.com",
  "authResults": "dkim=pass; dmarc=pass",
  "messageId": "id-unico-del-correo",
  "subject": "Posición NV-24081",
  "text": "NV-24081\nLatitud: 40.12345\nLongitud: -3.45678\nTemperatura: 4.2 C",
  "latitude": 40.12345,
  "longitude": -3.45678,
  "temperature": "4.2 °C",
  "receivedAt": "2026-10-05T12:42:00Z"
}
```

Como el correo se envía una sola vez, la cadencia del mapa dependerá de que podamos consultar de forma autorizada la acción del botón y de cada cuánto permite actualizar GEStracking (su web describe actualización estándar de unos 55 segundos). El webhook de correo actual no vuelve a pulsar ese botón ni consulta la página enlazada.

No he inventado un endpoint real: la URL, el método de autenticación y el esquema de respuesta dependen del acceso contratado con GEStracking. Las credenciales y los vehículos de esta demo son ficticios. Antes de publicar el portal, hay que limitar acceso a clientes autorizados y confirmar con el transportista/propietario del vehículo que puede compartir sus posiciones.

Antes de producción hay que confirmar API/sandbox y permisos de cada proveedor, definir qué eventos se comparten, proteger los datos por empresa/usuario y acordar consentimiento y acceso a ubicación/contactos. Los documentos, posiciones, horarios, facturas, conductores, clientes y KPI que aparecen aquí son ficticios.

## Estructura

- `index.html`: estructura de navegación del portal.
- `portal.css`: estilos responsive.
- `src/clientPortal.js`: vistas, navegación, consulta y actualización del seguimiento.
- `src/portalData.js`: conjunto de datos de ejemplo.
- `server.mjs`: servidor local y proxy seguro servidor-a-servidor para GEStracking.
- `env.example`: plantilla de configuración de integración, sin credenciales. El archivo `.env` local queda excluido de Git.

## Siguiente fase recomendada

1. Validar con dos o tres clientes qué estados, referencias y documentos necesitan.
2. Conseguir acceso técnico y documentación de los sistemas del transportista y GEStracking.
3. Diseñar backend, autenticación y permisos multiempresa; acordar retención y privacidad de datos.
4. Implementar primero una integración piloto de pedidos, estados y documentos; después sumar geolocalización y temperatura.
5. Conectar mensajería y facturación reales con responsables, trazabilidad y controles de acceso.
