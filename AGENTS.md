# Guía del proyecto

## Objetivo y estado
Transport Copilot OS conecta los portales de cliente, transportista y conductor para coordinar pedidos, ejecución, documentos, tracking e incidencias. Este repositorio es una demo local HTML/CSS/JavaScript con un servidor Node.js; el flujo compartido y los datos son de demostración. No contiene el backend multiempresa de producción.

## Arquitectura
La demo usa `server.mjs` para servir las páginas y exponer API locales; las vistas viven en HTML y `src/`. La arquitectura objetivo es `Frontend → API → lógica de negocio → base de datos`. La documentación normativa está en `docs/`; frontend y backend deben respetar `docs/API_CONTRACT.md`.

## Seguridad y cambios
- No publicar ni usar la demo con datos reales: carece de autenticación, autorización y aislamiento multiempresa en servidor.
- En el producto, toda entidad operativa debe quedar delimitada por organización y cada petición debe autorizar actor, rol y organización en servidor.
- No introducir datos mock en producción ni incluir secretos en el repositorio o en el cliente.
- Documentar cambios incompatibles del API antes de coordinar cambios de frontend y backend; no cambiar ambos lados simultáneamente sin actualizar el contrato.
- Verificar cambios con los typechecks, tests y builds que ofrezca el proyecto. No instalar dependencias sin necesidad y autorización.

## Frontera de demo
Son simulados el workflow compartido, datos de clientes/viajes, POD/documentos, facturación y ubicación cuando no hay proveedor configurado. El servidor Node, páginas y endpoints locales sí existen; su persistencia es JSON local y no equivale a una base de datos de producción. Consultar `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/API_CONTRACT.md`, `docs/EVENTS.md`, `docs/AUTOMATIONS.md`, `docs/SECURITY.md` y `docs/ROADMAP.md` antes de implementar.
