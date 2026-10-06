# Integraciones

Mantener interfaces por proveedor y traducir el formato externo al modelo interno de eventos. Evitar lógica específica de GES, GPS o correo dentro del dominio de servicios.

## GEStracking

No se presupone API pública disponible. La demo acepta posiciones verificadas en un webhook y ofrece un conector HTTP configurable, pendiente de documentación y autorización del proveedor. El botón de posición incluido en un correo no se automatiza por navegación de navegador; se necesita endpoint, webhook o flujo autorizado que entregue coordenadas.

## Google Maps

El frontend React utiliza Maps JavaScript API para representar ubicaciones recibidas por la plataforma, rutas origen-destino y vistas geográfica y satélite. La configuración local vive en `frontend/.env` como `VITE_GOOGLE_MAPS_API_KEY`; el archivo está excluido de Git y `frontend/.env.example` documenta la variable. La clave llega al navegador por diseño, por lo que debe restringirse por HTTP referrer y limitarse exclusivamente a Maps JavaScript API. En local se debe autorizar `http://127.0.0.1:4176/*` y el puerto utilizado por Vite; en despliegue, solo el dominio real.

Google Maps es únicamente la capa visual. Las coordenadas no deben considerarse reales si su origen es el simulador, y conectar el mapa no equivale a disponer de tracking GPS.

## Conectores futuros

Definir adaptadores separados para email, ERP/TMS, telemática, almacenamiento, facturación, mensajería y proveedor de IA. Usar secretos de servidor para tokens de servicio y registrar el estado de sincronización sin exponer credenciales.
