# Integraciones

Mantener interfaces por proveedor y traducir el formato externo al modelo interno de eventos. Evitar lógica específica de GES, GPS o correo dentro del dominio de servicios.

## GEStracking

No se presupone API pública disponible. La demo acepta posiciones verificadas en un webhook y ofrece un conector HTTP configurable, pendiente de documentación y autorización del proveedor. El botón de posición incluido en un correo no se automatiza por navegación de navegador; se necesita endpoint, webhook o flujo autorizado que entregue coordenadas.

## Google Maps

Maps Embed API representa la ubicación recibida por el backend y permite las vistas geográfica y satélite. Mantener la clave restringida por HTTP referrer y por API. Las coordenadas no deben considerarse reales si su origen es el simulador.

## Conectores futuros

Definir adaptadores separados para email, ERP/TMS, telemática, almacenamiento, facturación, mensajería y proveedor de IA. Usar secretos de servidor para tokens de servicio y registrar el estado de sincronización sin exponer credenciales.
