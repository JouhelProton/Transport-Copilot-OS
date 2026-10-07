# Desarrollo Android

> **DEPRECATED para Driver App:** esta guía describe el contenedor Capacitor anterior. La arquitectura móvil candidata es Expo; usa `docs/EXPO_DRIVER_APP.md`. Se conserva temporalmente como referencia.

## Estado y requisitos

El proyecto está en `frontend/android`, con package id `com.transportcopilot.driver`, min SDK 24 y target/compile SDK 36. Solo declara `android.permission.INTERNET`. No hay permisos de ubicación, cámara, fotos o notificaciones.

Instala Android Studio 2025.2.1 o superior, Android SDK 36 y las SDK Platform Tools. Android Studio incluye un JDK compatible; selecciona su Gradle JDK si el JDK del sistema no cumple los requisitos.

## Preparar e instalar

1. Instala Node.js 24 y pnpm 11.
2. Clona el repositorio y entra en `frontend`.
3. Ejecuta `pnpm install --frozen-lockfile`.
4. Copia `.env.mobile.example` a `.env.mobile.local` con una API HTTPS alcanzable por el dispositivo/emulador.
5. Ejecuta `pnpm mobile:build` y `pnpm exec cap sync android`.
6. Ejecuta `pnpm android:open`.
7. En Android Studio instala el SDK solicitado si aparece y espera a la sincronización Gradle.
8. Para emulador, crea un AVD API 24+; para dispositivo, activa Developer Options/USB debugging y acepta la huella RSA.
9. Selecciona el dispositivo y pulsa Run.
10. Verifica login DRIVER, servicios, aceptación, estado offline y logout.

`127.0.0.1` dentro de Android apunta al propio dispositivo. Usa HTTPS accesible. El proyecto no habilita `usesCleartextTraffic`; si se necesita HTTP local, usa una `network-security-config` exclusiva de Debug y limita los dominios. Release debe permanecer HTTPS.

## Build local

Desde `frontend/android`:

```bash
./gradlew assembleDebug      # macOS/Linux
gradlew.bat assembleDebug    # Windows
```

El APK Debug se genera bajo `android/app/build/outputs/apk/debug/`. Para distribución futura se configurará un keystore de release fuera de Git, Play App Signing y un Android App Bundle. No versionar keystores, passwords ni `local.properties`.

## Cambios de identidad y marca

Antes de publicar, actualizar `appId` en Capacitor, `namespace`/`applicationId` en Gradle, package de `MainActivity`, strings, iconos mipmap y splash. Ejecutar después `cap sync` y revisar deep links cuando exista dominio definitivo.
