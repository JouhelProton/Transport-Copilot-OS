# NEXO Copilot — Auditoría funcional v0.6

Fecha: 2026-10-09  
Rama: `feat/documents-pod`

## Resumen

La base v0.6 ya tenía API, persistencia y un formulario POD embebido en el detalle del servicio. La validación de producto mostró que esa capacidad no era suficientemente descubrible desde NEXO Driver: no había una entrada documental dedicada y la barra de navegación usaba el `SafeAreaView` nativo obsoleto sin un `SafeAreaProvider` raíz. Se añadió una pantalla accesible de «Entrega y documentos», un acceso desde el servicio y una estructura de safe areas para iOS.

## Matriz de funciones

| Función | Backend | Pantalla | API real | Persistencia | Estado v0.6 |
|---|---|---|---|---|---|
| Listar documentos de un servicio | Sí, Fastify + Prisma | NEXO Driver, transportista y cliente | Sí | Sí | Funcional y accesible |
| Subir foto desde Driver | Sí, multipart privado | «Añadir fotografía» en documentos | Sí | Sí, hash SHA-256 | Funcional y accesible |
| Subir documento del transportista | Sí | Panel documental del servicio | Sí | Sí | Funcional y accesible |
| Consultar estado e historial | Sí | Paneles y pantalla Driver | Sí | Sí | Funcional y accesible |
| Crear y enviar POD | Sí | Formulario en detalle del servicio + acceso documental | Sí | Sí | Funcional y accesible |
| Revisar/aprobar/rechazar POD | Sí | Panel transportista | Sí | Sí, historial/auditoría | Funcional y accesible |
| Visibilidad cliente | Sí, solo `SHARED + APPROVED` | Portal cliente | Sí | Sí | Funcional y accesible |
| Descargar archivos | Sí, stream autenticado | Portal web | Sí | Archivo privado | Funcional en web |
| Generar albarán/POD PDF | Sí, generación backend | Acción de generación en panel | Endpoint real | Sí, hash y metadatos | Implementado en esta reparación |
| Notificación POD | Sí, `InternalNotification` idempotente | API de notificaciones existente | Sí | Sí | Implementado en esta reparación |
| Factura real | No por alcance | No | No | No | Fuera de v0.6 |
| DECA completo/firma cualificada | No por alcance | No | No | No | Reservado para v0.8 |
| Tracking background | No por alcance | No | No | No | Reservado para v0.6.5 |

## Defectos encontrados y resolución

1. **Driver sin entrada documental dedicada.** La lógica estaba incrustada en `services/[id].tsx`, por lo que era posible no verla al probar el flujo. Se creó `services/[id]/documents.tsx` y se añadió el botón «Abrir documentos del servicio».
2. **Safe areas incompletas.** La raíz no montaba `SafeAreaProvider` y se usaba el `SafeAreaView` de React Native. Ahora la raíz usa `react-native-safe-area-context`; las pantallas afectadas usan safe areas en los bordes superior e inferior. No se añadieron offsets mágicos.
3. **Generación documental inexistente.** Se añadió `POST /api/v1/services/:id/documents/generate`, que genera un PDF operativo en backend, lo guarda privado, calcula hash y registra evento/auditoría. El PDF incluye una nota expresa de que no es por sí solo firma electrónica cualificada.
4. **Automatizaciones documentales incompletas.** La validación de POD ahora crea notificaciones internas idempotentes para enviado, aprobado y rechazado, y una notificación «listo para facturación» sin emitir facturas.

## Incidencia posterior: «Servicio no disponible» en iPhone

La causa reproducible no era una asignación incorrecta. El detalle ejecutaba `driverApi.service()` y `driverApi.pod()` dentro de un único `Promise.all`. Si el backend móvil todavía no tenía publicada la ruta opcional de POD, el segundo request devolvía 404 y se descartaban también los datos correctos del servicio. Además, `useLocalSearchParams` podía entregar `string[]` en rutas anidadas.

La reparación normaliza el parámetro con `routeParam`, carga primero el servicio y trata documentos/POD como capacidades secundarias. Un 403, 404, timeout o error de red ahora se muestra con un mensaje distinto. Las comprobaciones RBAC del backend no se han relajado.

Evidencia local comprobada contra `127.0.0.1:3001`:

- Login móvil: correcto.
- `GET /api/v1/driver/services`: 1 servicio.
- Detalle de `svc_nv_24081_real`: 200, referencia `NV-24081-REAL`.
- Documentos del servicio: 200, lista vacía.
- POD del servicio: 200, todavía no creado.
- Identificador inexistente: 404.

## Automatizaciones activas

- POD enviado: evento, historial, documentos en revisión y notificación interna.
- POD aprobado: documentos aprobados, acceso del cliente y notificación de documentación lista.
- POD rechazado: motivo obligatorio, historial, notificación y posibilidad de reenvío.
- Deduplificación por `organizationId + dedupeKey`.

## Limitaciones verificadas

- La prueba física de cámara, notch/Dynamic Island y navegación en un iPhone real debe realizarla el propietario del dispositivo; no se declara hecha desde este entorno.
- Expo Go mantiene el límite de tracking foreground; el background tracking sigue planificado para v0.6.5.
- Tests Vitest/Vite y el motor Prisma pueden quedar bloqueados en este entorno por `spawn EPERM`; ese error ocurre al arrancar las herramientas, antes de ejecutar assertions.
- La migración de nuevos valores de `NotificationType` queda en `backend/prisma/migrations/20261009130000_v06_pod_notifications/migration.sql` y debe aplicarse en el entorno PostgreSQL con `prisma migrate deploy` fuera del sandbox.
