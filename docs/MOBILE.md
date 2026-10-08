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
- `src/api`: cliente central con base URL HTTPS, Bearer, JSON, timeout y errores seguros.
- `src/auth`: ciclo de sesión y abstracción `AuthStorage` sobre `expo-secure-store`.
- `src/hooks`: conectividad con `expo-network`.
- `src/tracking`: controlador de GPS foreground, estados visibles y cola segura limitada.
- `src/components`: componentes React Native con safe areas y controles táctiles grandes.

`EXPO_PUBLIC_API_URL` se inyecta al arrancar; nunca se versiona `localhost`, una IP personal o una URL temporal. Consulta `docs/EXPO_DRIVER_APP.md` para comandos y prueba física.

La dependencia `expo-location` está declarada en `mobile/package.json` y fijada en `mobile/pnpm-lock.yaml`. La validación se realizó con `pnpm install --frozen-lockfile --ignore-scripts`; en el dispositivo se debe instalar el proyecto antes de iniciar Expo Go.

## Capacitor anterior

La implementación Capacitor en `/frontend` queda **DEPRECATED para Driver App** y se conserva temporalmente como referencia/fallback. Ya no es la arquitectura móvil elegida. Sus portales React web, contratos API y lógica compartible siguen siendo válidos.

## Límites

Expo Go es un cliente de desarrollo. v0.4 implementa GPS foreground con `expo-location`, pero no promete ejecución continua en segundo plano. EAS y Development Build se evaluarán cuando una capacidad nativa lo exija. ETA, geofences, push, cámara, POD y firma siguen fuera de alcance.
