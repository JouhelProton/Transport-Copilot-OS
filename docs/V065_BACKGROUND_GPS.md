# v0.6.5 — Background GPS Tracking

## Estado

La Fase A está implementada en `feat/background-gps`. El código, la configuración nativa y el perfil EAS están preparados. La versión **no está cerrada**: el seguimiento con el iPhone bloqueado requiere una Development Build firmada y una prueba física posterior.

Expo Go continúa siendo útil para login, servicios, documentos, POD y el seguimiento de prueba en primer plano. Expo Go no valida Background Location en iOS.

## Arquitectura

```text
Acción explícita del conductor
  → permisos foreground y background
  → POST tracking/start
  → contexto {serviceId, trackingSessionId} en SecureStore
  → Location.startLocationUpdatesAsync

TaskManager global (sin React ni navegación)
  → normaliza la muestra
  → cola persistente, acotada e idempotente
  → token opaco leído de SecureStore
  → POST tracking/positions
  → PostgreSQL: LocationHistory + CurrentPosition
  → portal: posición real, histórico y diagnóstico

Parada / POD / logout / revocación
  → detiene la captura nativa
  → vacía la cola cuando hay conexión
  → POST tracking/stop o revocación por logout
  → elimina el contexto local
```

La tarea se define en `mobile/src/tracking/background-task.ts` y se importa desde el layout raíz. No depende de una pantalla montada. Primer plano y segundo plano comparten `engine.ts`, `queue.ts`, `synchronizer.ts` y los endpoints existentes.

## Dependencias y compatibilidad

- Expo `~57.0.27`.
- React Native `0.86.3`.
- `expo-location ~57.0.17` (lock resuelto en 57.0.20).
- `expo-task-manager ~57.0.21`.
- `expo-dev-client ~57.0.19`.
- `expo-secure-store ~57.0.4`.

Las versiones se tomaron de `expo/bundledNativeModules.json` para SDK 57. No se ejecutó `prebuild` ni se inició una compilación EAS.

## Configuración iOS

`mobile/app.json` declara:

- `UIBackgroundModes: ["location"]`.
- permiso de ubicación durante el uso.
- permiso de ubicación siempre y durante el uso.
- Background Location de iOS.
- indicador visible de ubicación en segundo plano.
- `expo-dev-client`.

La aplicación solicita primero el permiso foreground y solo solicita el permiso background cuando el conductor pulsa iniciar. En Development Build, si no se concede «Siempre», el seguimiento no se presenta como activo. En Expo Go se identifica expresamente el modo de prueba foreground.

## Ciclo de vida

- No se inicia al abrir la aplicación.
- Solo se inicia para el servicio elegido por el conductor y después de la autorización del backend.
- Solo puede existir un contexto local activo; una sesión anterior no puede publicar bajo otra.
- La reapertura normal reconstruye el estado desde SecureStore, verifica el permiso, la tarea nativa y la sesión remota.
- Cada minuto, mientras la interfaz está activa, se reconcilia la sesión con el backend.
- Una respuesta 401, 403 o `TRACKING_NOT_ACTIVE` detiene la tarea y aísla las muestras pendientes.
- Logout detiene la captura antes de borrar el token; el backend revoca además las sesiones activas asociadas a la sesión autenticada.
- El envío correcto del POD solicita la parada del seguimiento del servicio.
- Si el permiso background fue revocado, la próxima ejecución disponible detiene la sesión local y remota.

iOS puede suspender el proceso. Una revocación remota no puede observarse hasta que el sistema vuelva a ejecutar la tarea o la app. Si el usuario fuerza el cierre, no se garantiza ninguna actualización ni parada inmediata; al abrir de nuevo se exige reconciliación y se informa si la tarea nativa quedó interrumpida.

## Frecuencia y batería

La configuración tiene un objetivo aproximado de 30 segundos o 50 metros, `BestForNavigation`, actividad `AutomotiveNavigation`, lotes diferidos y pausa automática desactivada durante el servicio. iOS decide el intervalo real según movimiento, señal, batería y presión del sistema. No hay temporizadores JavaScript para mantener viva la app.

Antes de producción deben medirse trayectos de 30 minutos, 2 horas y 8 horas. La frecuencia puede ajustarse después de observar precisión, consumo y continuidad reales.

## Cola offline

La cola existente se conserva en `expo-secure-store` con acceso `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`, necesario para una tarea que puede ejecutarse con la pantalla bloqueada. El token no se copia en cada muestra.

- Máximo 100 posiciones pendientes y 50 diagnósticos rechazados.
- Orden de captura conservado.
- `sampleId` estable en reintentos.
- Backoff acotado de 2 a 30 segundos cuando la app ejecuta sincronización.
- Eliminación solo tras confirmación HTTP.
- Separación por servicio y `trackingSessionId`.
- Las muestras de una sesión obsoleta se archivan y no se reetiquetan.
- Hora capturada (`recordedAt`) y recibida (`receivedAt`) permanecen separadas.

SecureStore es adecuado para esta cola pequeña, no para un histórico extenso. Tras reiniciar el iPhone, el llavero vuelve a estar disponible después del primer desbloqueo. Si se requiere una cola mayor, deberá usarse almacenamiento cifrado diseñado para volumen antes de producción.

## Seguridad y privacidad

El backend sigue validando Bearer opaco, rol DRIVER, organización, asignación activa, servicio, sesión, coordenadas, antigüedad, orden e idempotencia. No se registran coordenadas, tokens ni contraseñas en logs ordinarios. El portal consulta únicamente recursos autorizados.

El indicador de iOS y el estado de NEXO Driver hacen visible el seguimiento. No existe inicio oculto. Antes de producción deben aprobarse la información al conductor, base jurídica, acceso, borrado y una retención configurable. Esta fase no ejecuta borrados automáticos ni altera históricos existentes.

## Portal transportista

El mapa conserva la última posición recibida y no interpola movimiento. Muestra estado de sesión, hora capturada, hora recibida, antigüedad, retraso de envío, precisión, sesión e histórico. La etiqueta «desactualizado» se basa en la edad de captura. La ausencia de una muestra no se etiqueta como pérdida de cobertura sin evidencia adicional.

## Preparación EAS desde Windows

`mobile/eas.json` contiene el perfil `development`. Cuando se disponga de Apple Developer Program y se autorice registrar el dispositivo:

```powershell
cd "C:\Users\JouHel\Documents\ChatGPT\Software Transportista\mobile"
npx eas-cli login
npx eas-cli device:create
npx eas-cli build --platform ios --profile development
```

Después de instalar la build firmada en el iPhone, iniciar backend, Quick Tunnel y Metro para Development Build:

```powershell
cd "C:\Users\JouHel\Documents\ChatGPT\Software Transportista"
pnpm mobile:dev-client
```

No se necesitan VPS ni App Store para la prueba de desarrollo, pero una instalación física firmada por EAS requiere los requisitos vigentes de Apple. En esta fase no se han solicitado credenciales ni registrado dispositivos.

## Lista de comprobación física pendiente

- [ ] Inicio explícito con el iPhone desbloqueado.
- [ ] Confirmar indicador de ubicación del sistema.
- [ ] Recibir posiciones con NEXO Driver visible.
- [ ] Recibir posiciones con el iPhone bloqueado.
- [ ] Recibir posiciones con otra aplicación abierta.
- [ ] Perder Internet y comprobar el aumento de pendientes.
- [ ] Recuperar Internet y comprobar sincronización sin duplicados.
- [ ] Confirmar en el portal hora capturada y recibida.
- [ ] Detener el servicio y verificar que cesan las posiciones.
- [ ] Cerrar sesión y verificar la revocación.
- [ ] Revocar «Siempre» y comprobar la parada al volver a ejecutar la app.
- [ ] Forzar el cierre, documentar el comportamiento real y no asumir continuidad.
- [ ] Medir batería y precisión en rutas de 30 min, 2 h y 8 h.

## Criterios de aceptación

La implementación técnica exige tests, typechecks, builds y configuración válida. El cierre de v0.6.5 exige además completar la lista física con una Development Build en un iPhone real. Hasta entonces el estado es **implementada técnicamente, validación física pendiente**.
