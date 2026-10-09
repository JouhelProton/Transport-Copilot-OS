# Driver Mobile

## Arquitectura oficial candidata

Desde v0.3.5 la Driver App vive en `/mobile` y usa React Native, Expo SDK 57, Expo Router y TypeScript. Es exclusivamente DRIVER: login, lista de servicios, detalle, aceptación y logout. Cliente y transportista permanecen en `/frontend` como portales React web.

```text
Expo Driver → Bearer opaco → Fastify /api/v1/driver/* → PostgreSQL
User → Membership DRIVER → Driver → Assignment → Service
```

La app no envía `driverId`. Fastify lo deriva de la sesión, aplica RBAC, organización y Assignment activo. La aceptación reutiliza la transición idempotente `ASSIGNED → DRIVER_ACCEPTED`, `ServiceEvent`, `AuditLog` y transacción existentes.

## Implementación

- `src/app`: rutas Expo Router `login`, `services` y `services/[id]`.
- `src/api`: cliente central con base URL HTTPS, Bearer, JSON/multipart, timeout y errores seguros.
- `src/auth`: ciclo de sesión y abstracción `AuthStorage` sobre `expo-secure-store`.
- `src/hooks`: conectividad con `expo-network`.
- `src/tracking`: controlador de GPS foreground, estados visibles y cola segura limitada.
- `src/components`: componentes React Native con safe areas y controles táctiles grandes.

`EXPO_PUBLIC_API_URL` se inyecta al arrancar; nunca se versiona `localhost`, una IP personal o una URL temporal. Consulta `docs/EXPO_DRIVER_APP.md` para comandos y prueba física.

La dependencia `expo-location` está declarada en `mobile/package.json` y fijada en `mobile/pnpm-lock.yaml`. La validación se realizó con `pnpm install --frozen-lockfile --ignore-scripts`; en el dispositivo se debe instalar el proyecto antes de iniciar Expo Go.

## POD v0.6

NEXO Driver usa `expo-image-picker` para tomar una fotografía o seleccionar imágenes cuando el conductor pulsa la acción correspondiente. Los permisos se solicitan en ese momento, no al arrancar. El formulario admite receptor opcional, observaciones y hasta cuatro evidencias; muestra éxito solo después de recibir el POD persistido por Fastify.

Desde el detalle de cada servicio existe también la pantalla accesible `Entrega y documentos`, donde el conductor consulta los archivos compartidos, añade una fotografía documental y revisa el estado del POD sin introducir rutas ni usar endpoints manualmente.

El archivo viaja como multipart con el token Bearer opaco. El backend valida asignación, tamaño, MIME, contenido, duplicados y tenant. La app muestra `SUBMITTED`, `IN_REVIEW`, `APPROVED` o `REJECTED`, incluido el motivo disponible. No se ha implementado firma dibujada en v0.6.

## Capacitor anterior

La implementación Capacitor en `/frontend` queda **DEPRECATED para Driver App** y se conserva temporalmente como referencia/fallback. Ya no es la arquitectura móvil elegida. Sus portales React web, contratos API y lógica compartible siguen siendo válidos.

## Límites

Expo Go es un cliente de desarrollo. v0.4 implementa GPS foreground con `expo-location`, pero no promete ejecución continua en segundo plano. La cámara/galería y el POD están implementados; la firma, push y tracking background siguen fuera. El siguiente paso nativo está definido en `BACKGROUND_TRACKING_PLAN.md` para v0.6.5.
# Hotfix de transporte POD (v0.6)

El envío de POD usa XMLHttpRequest nativo para el multipart con archivos locales `{ uri, name, type }`. El conversor de Expo fetch instalado no admite esas entradas; el fallo ocurría antes de emitir una petición HTTP. Se conserva HTTPS, Bearer y el contrato multipart existente. Todas las peticiones FormData usan automáticamente este transporte, incluidas las subidas documentales independientes. No requieren una opción por endpoint. El timeout de archivos es de 120 segundos; las demás peticiones mantienen 12 segundos.

Validación física: el reintento del iPhone devolvió HTTP 201 (`req-v`); el usuario confirmó `SUBMITTED` y el operador pudo consultar la evidencia persistida. La lectura fallida de una respuesta HTTP se distingue de un error de transporte.
