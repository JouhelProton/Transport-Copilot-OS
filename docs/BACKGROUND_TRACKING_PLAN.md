# v0.6.5 — Plan original de seguimiento GPS en segundo plano

> La implementación técnica se documenta en `docs/V065_BACKGROUND_GPS.md`. Este archivo se conserva como registro del diseño previo.

## Alcance

Este documento prepara el siguiente hito de NEXO Driver. v0.6 mantiene el seguimiento foreground actual. v0.6.5 añadirá background location visible, consentido y limitado a un servicio que el conductor haya iniciado expresamente.

No se promete una muestra exacta cada 30 segundos. iOS puede espaciar, agrupar o pausar actualizaciones por movimiento, precisión, batería, presión del sistema y política del dispositivo. Un cierre forzado por el usuario debe considerarse una parada efectiva hasta que vuelva a abrir la app.

## Requisitos de compilación

1. Crear un Expo Development Build para un iPhone físico; Expo Go no es la base de validación de esta capacidad nativa.
2. Añadir `expo-task-manager` en una versión compatible con el SDK Expo del proyecto.
3. Configurar el plugin de `expo-location` para background location y los textos de permisos iOS.
4. Generar una nueva build firmada cuando cambie la configuración nativa. EAS para dispositivo físico requiere cuenta Apple Developer, registro del dispositivo y Developer Mode.
5. Habilitar `UIBackgroundModes: location` mediante la configuración Expo/CNG. Omitir esta capacidad mientras se solicitan updates background puede terminar la app.

Referencias: [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/), [Expo TaskManager](https://docs.expo.dev/versions/latest/sdk/task-manager/), [Development Build para iOS](https://docs.expo.dev/tutorial/eas/ios-development-build-for-devices/) y [Core Location en segundo plano](https://developer.apple.com/documentation/corelocation/handling-location-updates-in-the-background).

## Permisos y experiencia del conductor

1. Mantener el permiso foreground actual como primer paso.
2. Mostrar una pantalla previa que explique finalidad, servicio activo, datos enviados, indicador del sistema, consumo estimado y cómo detenerlo.
3. Solicitar permiso background únicamente cuando el conductor active por primera vez el seguimiento background.
4. Mostrar siempre un estado persistente dentro de NEXO Driver: activo, pausado por sistema, sin permiso, offline, sincronizando o detenido.
5. Usar el indicador de ubicación background de iOS cuando corresponda. La app no debe rastrear de forma oculta.

## Diseño técnico

```text
Botón Iniciar seguimiento
  → valida Assignment y sesión API
  → crea TrackingSession en Fastify
  → persiste localmente solo {serviceId, trackingSessionId}
  → Location.startLocationUpdatesAsync(TASK_NAME, opciones)

TaskManager.defineTask (ámbito de módulo, cargado desde root layout)
  → valida muestra
  → añade a la cola local acotada, sin token
  → sincronizador obtiene token desde SecureStore al ejecutar
  → POST /driver/services/:id/tracking/positions
  → elimina solo las muestras confirmadas

Parar / finalizar servicio / logout / revocación
  → Location.stopLocationUpdatesAsync
  → POST tracking/stop cuando haya red
  → elimina vínculo local de sesión
```

`TaskManager.defineTask` debe declararse en ámbito de módulo y cargarse antes de la navegación. La cola existente seguirá limitada, separada por servicio y `trackingSessionId`, con deduplicación por `sampleId`. El token opaco permanecerá en SecureStore y nunca se escribirá dentro de cada muestra.

## Configuración inicial que se validará

- `accuracy`: equilibrar navegación de carretera y batería; probar `Balanced`/`High` con vehículos reales.
- `timeInterval`: objetivo orientativo de 30 segundos en Android, sin garantía en iOS.
- `distanceInterval`: mantener un umbral de movimiento para evitar ruido estacionario.
- `deferredUpdatesInterval` y `deferredUpdatesDistance`: evaluar lotes cuando la app esté en background.
- `activityType`: automoción/navegación cuando sea compatible.
- `pausesUpdatesAutomatically`: probar con paradas prolongadas y reanudación.
- `showsBackgroundLocationIndicator: true` en iOS para transparencia.

## Ciclo de vida y recuperación

- Al volver al foreground, consultar `hasStartedLocationUpdatesAsync`, la sesión local y el estado remoto antes de mostrar “activo”.
- Si iOS termina la app por recursos, reconstruir el estado solo cuando el sistema vuelva a ejecutarla y exista una sesión válida.
- Si el usuario fuerza el cierre, no afirmar que sigue el tracking. Mostrar “interrumpido” al siguiente arranque y exigir una acción explícita para reanudar.
- Al finalizar el servicio, detener la tarea local antes de cerrar la sesión remota.
- Logout debe intentar vaciar la cola, detener la tarea y revocar el tracking; si no hay red, borrar el token y conservar únicamente un marcador acotado de cierre pendiente sin coordenadas adicionales.

## Batería, privacidad y datos

- Medir consumo en rutas de 30 minutos, 2 horas y 8 horas, con pantalla bloqueada y cambios de cobertura.
- Reducir precisión/frecuencia cuando el vehículo permanezca detenido, sin falsear continuidad.
- Conservar solo las coordenadas necesarias para la finalidad operativa y aplicar la futura política de retención.
- No registrar coordenadas, tokens ni identificadores personales en logs generales.
- Documentar base jurídica, información al trabajador, acceso, retención y borrado antes de producción.

## Criterios de aceptación de v0.6.5

1. Development Build instalada en iPhone físico.
2. Inicio y parada explícitos y visibles.
3. Recepción de muestras con pantalla bloqueada y al cambiar de app, sin exigir un intervalo exacto.
4. Cola offline y reanudación sin duplicados.
5. Fin de servicio, logout y revocación detienen la tarea.
6. Reinicio normal recupera el estado autorizado; cierre forzado se muestra como interrupción.
7. Tests de permisos, lifecycle, cola, sesiones cruzadas y aislamiento.
8. Medición documentada de batería y validación de privacidad.
