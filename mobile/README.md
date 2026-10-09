# Transport Copilot Driver

Aplicación React Native + Expo exclusiva para conductores. Consulta [docs/EXPO_DRIVER_APP.md](../docs/EXPO_DRIVER_APP.md) para arquitectura, seguridad y prueba en iPhone.

```powershell
# desde la raíz, con backend y base preparados
pnpm mobile:dev
```

Incluye tracking GPS foreground con `expo-location`, sesión explícita, cola local limitada, reintento idempotente y diagnóstico de sincronización. Expo Go no garantiza tracking cuando iOS suspende la aplicación; la validación física final continúa pendiente.
