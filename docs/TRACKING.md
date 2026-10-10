# Tracking

La posición de un camión debe proceder del backend de tracking, un proveedor telemático autorizado o la app del conductor con permisos explícitos. Google Maps solo dibuja la posición recibida; no localiza vehículos por sí mismo.

Las vistas web heredadas pueden mostrar un punto fijo de demostración en Tarancón para NV-24081 y lo identifican como DEMO. El flujo de producto de `backend/`, `frontend/` y `mobile/` no utiliza esa posición simulada.

Interfaz objetivo:

```ts
interface TrackingProvider {
  getCurrentPosition(vehicleId: string): Promise<VehiclePosition | null>;
  getHistory(
    vehicleId: string,
    from: Date,
    to: Date,
  ): Promise<VehiclePosition[]>;
}
```

Adaptadores previstos: `MockTrackingProvider`, `GesProvider` cuando exista acceso documentado, proveedor webhook, telemática y `MobileGPSProvider`. El acceso del cliente se limita al servicio autorizado y a un token aleatorio revocable.

## v0.4 implementado

El conductor inicia y detiene el seguimiento desde el detalle del servicio. La app usa `expo-location` en primer plano con una muestra cada 15 segundos o 100 metros, envía por HTTPS Bearer y conserva una cola limitada de hasta 100 posiciones en `expo-secure-store`. Cada muestra queda ligada al servicio y a la sesión de tracking que la originó. Solo se elimina tras una respuesta satisfactoria; los fallos temporales conservan el mismo `sampleId` y usan backoff acotado, mientras que los rechazos permanentes se archivan como diagnóstico y dejan de reintentarse.

El backend persiste `TrackingSession`, `CurrentPosition` y `LocationHistory`, valida coordenadas, precisión, timestamp, antigüedad, orden temporal y duplicados. El transportista consulta el current y el histórico mediante polling cada 10 segundos. Google Maps dibuja únicamente posiciones recibidas del backend.

El mapa distingue `GPS REAL`, `SIN POSICIÓN` y `POSICIÓN DESACTUALIZADA`. Sin `VITE_GOOGLE_MAPS_API_KEY` muestra una vista de configuración con las coordenadas recibidas, sin inventar un marcador.

## Corrección v0.5.1

iOS puede entregar `-1` en `speed` o `heading` cuando el sensor no dispone de esos valores. La app normaliza esos centinelas a `null` y el backend aplica la misma normalización defensiva. Coordenadas, precisión y timestamps siguen sujetos a validación estricta.

La API registra el resultado de inicio, recepción y parada con `requestId`, organización, servicio, sesión y `sampleId`, sin registrar coordenadas, tokens ni credenciales. La inserción del histórico usa la restricción única de `sampleId` de forma atómica, de modo que reintentos concurrentes son idempotentes. El portal incluye un panel independiente del mapa con estado de sesión, última recepción, antigüedad, precisión y número de muestras.

## v0.6.5 — Background GPS preparado

La tarea global, el contexto persistente, la cola compartida, los permisos nativos y el perfil Development Build están implementados. Expo Go conserva el modo foreground y lo identifica como tal. La guía técnica y las pruebas físicas pendientes están en `docs/V065_BACKGROUND_GPS.md`.

El portal diferencia `recordedAt` y `receivedAt`, muestra el retraso de sincronización y no interpola movimiento. La frecuencia objetivo es aproximada; iOS mantiene el control efectivo de las entregas.

## Límites físicos

Expo Go no garantiza ejecución continua cuando iOS suspende la aplicación. La implementación background requiere una Development Build firmada y todavía no ha sido validada con un iPhone bloqueado. Tampoco afirma protección absoluta contra spoofing. La prueba física final debe hacerla el usuario.
