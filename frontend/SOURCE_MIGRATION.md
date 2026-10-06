# Procedencia y arranque de la interfaz

- Proyecto Lovable: `6f674295-6367-4bb7-8bab-59fb7417756e`
- Revisión fuente: `d7daeedb09b6d6a43298da6505caa2970dd6eacf`
- Fecha de extracción: 2026-10-07
- Los 120 archivos de texto se copiaron conservando sus rutas bajo `frontend/`. La demo Node de la raíz permanece separada.
- La lectura de archivos de Lovable no pudo recuperar los bytes de `public/favicon.ico` (la API devuelve texto con bytes sustituidos). El JPG original se incorporó desde el adjunto del usuario; SHA-256: `90a5c7fbf7d1520999b8fb58b8d4106f9baa0a870f71e9c6f1036736b0d90f8b`. El favicon sigue pendiente y su referencia puede producir un 404 visual menor, pero no bloquea la app.
- Se hizo una corrección de portabilidad en `src/components/nexo/PortalShell.tsx`: se añadió el import de `Navigate`, que se usaba sin importar.

## Entorno

La raíz recomienda Node `24.21.0` en `.nvmrc`. El runtime local disponible para esta extracción es Node `24.19.0`; no se cambió el Node global.

El proyecto frontend mantiene el `bun.lock` original. Con Node 24.21.0 y Bun instalado:

```powershell
cd frontend
bun install --frozen-lockfile
bun run dev
```

Se instalaron dependencias con Bun 1.4.2 usando `--frozen-lockfile`; se conservó el lockfile y no se modificaron las versiones declaradas. Verificaciones: `tsc --noEmit` pasa; el test de rutas pasa (1/1); `vite build` pasa. La ruta local `/transportista` responde correctamente después de iniciar sesión con el usuario ficticio del acceso DEMO. Sin sesión, redirige al login de transportista. Vite está disponible para la vista local en `http://127.0.0.1:4176/transportista`.

Google Maps se configura localmente mediante `frontend/.env` y `VITE_GOOGLE_MAPS_API_KEY`. La clave no se versiona. El mapa representa los puntos del estado DEMO; no obtiene una posición GPS por sí mismo.
