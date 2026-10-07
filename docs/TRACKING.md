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
