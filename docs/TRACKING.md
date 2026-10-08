# Tracking

La posición de un camión debe proceder del backend de tracking, un proveedor telemático autorizado o la app del conductor con permisos explícitos. Google Maps solo dibuja la posición recibida; no localiza vehículos por sí mismo.

Las vistas web heredadas pueden mostrar un punto fijo de demostración en Tarancón para NV-24081 y lo identifican como DEMO. La app Driver v0.3 no consume esa posición simulada, no solicita permisos de ubicación y no implementa GPS del dispositivo, histórico, ETA ni transmisión en segundo plano.

La integración de tracking pertenece a v0.4. Expo es compatible con una futura evaluación de `expo-location`, pero el tracking en segundo plano probablemente requerirá Expo Development Build/EAS y configuración nativa; no forma parte de Expo Go en este hito. Antes de activarla hay que definir el consentimiento del conductor, la retención, la frecuencia, la precisión, el tratamiento offline y el contrato de un proveedor real. La posición nunca se aceptará desde parámetros libres del cliente.

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

El conductor inicia y detiene el seguimiento desde el detalle del servicio. La app usa `expo-location` en primer plano con una muestra cada 15 segundos o 100 metros, envía por HTTPS Bearer y conserva una cola limitada de hasta 100 posiciones en `expo-secure-store` cuando hay un corte breve. La cola no almacena tokens dentro de sus registros y se limpia al detener o cerrar sesión.

El backend persiste `TrackingSession`, `CurrentPosition` y `LocationHistory`, valida coordenadas, precisión, timestamp, antigüedad, orden temporal y duplicados. El transportista consulta el current y el histórico mediante polling cada 10 segundos. Google Maps dibuja únicamente posiciones recibidas del backend.

El mapa distingue `GPS REAL`, `SIN POSICIÓN` y `POSICIÓN DESACTUALIZADA`. Sin `VITE_GOOGLE_MAPS_API_KEY` muestra una vista de configuración con las coordenadas recibidas, sin inventar un marcador.

## Límites físicos

Esta versión es foreground. Expo Go no garantiza ejecución continua cuando iOS suspende la aplicación; tracking fiable en segundo plano requiere una development build, configuración nativa, revisión de permisos y validación de batería. La implementación no afirma background tracking ni protección absoluta contra spoofing. La prueba física final debe hacerla el usuario en un iPhone.
