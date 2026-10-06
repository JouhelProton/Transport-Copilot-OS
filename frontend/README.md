# Nexo · Transport AI OS (modo DEMO)

Plataforma B2B de transporte con portada pública y tres portales separados:
- `/login/cliente` → `/cliente` (rol CUSTOMER)
- `/login/transportista` → `/transportista` (TRANSPORT_ADMIN, DISPATCHER, OPERATIONS, ACCOUNTING)
- `/login/conductor` → `/conductor` (DRIVER)

## Qué es real y qué es DEMO
- **Real:** separación de rutas, guardas por sesión + rol + organización, validación de formularios, proyección de datos por rol (el cliente nunca recibe precio/coste/notas internas).
- **DEMO:** la autenticación (`src/lib/auth/session.ts`, contraseña `demo-1234`, sesión en sessionStorage) y los datos (`src/lib/domain/demo-backend.ts`, guardados en localStorage y sincronizados entre pestañas). Llamadas, WhatsApp, email, GPS, facturas, IA y GES son simulados: no se envía nada.

## Usuarios DEMO
cliente@demo.nexo.local · admin@ / trafico@ / operaciones@ / contabilidad@demo.nexo.local · conductor@demo.nexo.local

## Flujo NV-24081
Conductor: llegada → entrega + POD → Transportista: validar POD → listo para facturar (borrador) → Cliente ve POD y factura pendiente.

## Pasar a producción
1. Activar Lovable Cloud (base de datos + auth). No se requieren variables secretas en el código.
2. Implementar `AuthProvider` con el proveedor real; roles en tabla `user_roles` separada.
3. Sustituir `demo-backend` por tablas con políticas de acceso por organización.
