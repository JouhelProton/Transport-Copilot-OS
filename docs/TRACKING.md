# Tracking

La posición de un camión debe proceder del backend de tracking, un proveedor telemático autorizado o la app del conductor con permisos explícitos. Google Maps solo dibuja la posición recibida; no localiza vehículos por sí mismo.

En desarrollo se utiliza un punto fijo de demostración en Tarancón para NV-24081 y se muestra como DEMO. El panel del conductor actualiza acciones del servicio, pero esta iteración no implementa GPS del dispositivo ni transmisión en segundo plano.

Interfaz objetivo:

```ts
interface TrackingProvider {
  getCurrentPosition(vehicleId: string): Promise<VehiclePosition | null>;
  getHistory(vehicleId: string, from: Date, to: Date): Promise<VehiclePosition[]>;
}
```

Adaptadores previstos: `MockTrackingProvider`, `GesProvider` cuando exista acceso documentado, proveedor webhook, telemática y `MobileGPSProvider`. El acceso del cliente se limita al servicio autorizado y a un token aleatorio revocable.
