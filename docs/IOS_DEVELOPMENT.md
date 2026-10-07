# Desarrollo iOS e instalación en iPhone

> **DEPRECATED para Driver App:** esta guía describe el contenedor Capacitor anterior. La arquitectura móvil candidata es Expo; usa `docs/EXPO_DRIVER_APP.md`. Se conserva temporalmente como referencia.

## Estado y requisitos

El proyecto SPM está generado en `frontend/ios/App/App.xcodeproj`, con bundle id temporal `com.transportcopilot.driver`, nombre `Transport Copilot Driver` y deployment target iOS 15. La generación y sincronización estática se hizo en Windows. Compilar, firmar e instalar iOS requiere un Mac con macOS, Xcode 26 o superior para Capacitor 8, Xcode Command Line Tools y un iPhone compatible.

Un Apple Account gratuito permite usar el equipo personal de Xcode para pruebas directas en dispositivos propios, con límites y firmas de desarrollo de corta duración. Apple Developer Program es necesario para App Store Connect/TestFlight, distribución sostenida y capacidades de equipo. Comprueba siempre las condiciones vigentes de Apple antes de distribuir.

Apple Developer Program, TestFlight y App Store Connect quedan fuera de la fase actual. No son necesarios para validar desde Windows la web móvil HTTPS. Usa `docs/IPHONE_WINDOWS_DEVELOPMENT.md` para probar inmediatamente Safari y pantalla de inicio. Cuando exista acceso puntual a un Mac, este proyecto permanece preparado para una compilación de desarrollo con Xcode y Personal Team si las condiciones vigentes lo permiten.

## Instalación paso a paso

1. Usa un Mac compatible con la versión de Xcode requerida.
2. Instala Xcode desde App Store y ábrelo una vez para aceptar licencia/componentes.
3. Instala Command Line Tools con `xcode-select --install` y verifica `xcode-select -p`.
4. Inicia sesión en Xcode → Settings → Accounts con tu Apple Account. Para una prueba local puede bastar el Personal Team gratuito.
5. Clona este repositorio en el Mac y cambia a la rama integrada que contenga v0.3.
6. Instala Node.js 24 y pnpm 11; verifica `node --version` y `pnpm --version`.
7. En `frontend`, ejecuta `pnpm install --frozen-lockfile`.
8. Copia `.env.mobile.example` como `.env.mobile.local`. Define una URL HTTPS que el iPhone pueda alcanzar; no uses `127.0.0.1` ni guardes secretos.
9. Prepara el backend y añade sus orígenes Capacitor exactos. Comprueba `/health` desde Safari del iPhone.
10. Ejecuta `pnpm mobile:build` y confirma `.output/public/index.html`.
11. Ejecuta `pnpm exec cap sync ios`. Repite build + sync después de cada cambio web que quieras instalar.
12. Ejecuta `pnpm ios:open` o abre `frontend/ios/App/App.xcodeproj` en Xcode.
13. Conecta el iPhone por cable, desbloquéalo y acepta “Confiar en este ordenador” si aparece. Activa Developer Mode en Ajustes si iOS lo solicita y reinicia cuando corresponda.
14. En Xcode selecciona el proyecto **App**, target **App**, pestaña **Signing & Capabilities**.
15. Activa **Automatically manage signing** y elige tu Team/Personal Team.
16. Si `com.transportcopilot.driver` no es único para tu equipo, usa un Bundle Identifier propio y actualiza después `capacitor.config.ts` para mantener una fuente coherente.
17. Selecciona el iPhone físico como destino, no un simulador.
18. Pulsa Run. Xcode compilará, firmará e instalará la app. La primera vez puede requerir autorizar al desarrollador en Ajustes del iPhone.
19. Inicia sesión como DRIVER y verifica lista, detalle, aceptación, cierre de sesión y reconexión. Confirma en backend un único evento/auditoría.
20. Si la app no llega al API, prueba la URL desde Safari, revisa HTTPS/DNS/firewall y CORS. No habilites `NSAllowsArbitraryLoads` como solución global.

## Firma: errores frecuentes

- **No matching provisioning profile / Signing requires a development team:** elegir Team y activar firma automática.
- **Bundle identifier unavailable:** cambiarlo por uno único y coherente en Capacitor/Xcode.
- **Developer Mode disabled:** activarlo en el iPhone.
- **Untrusted developer:** autorizar el certificado de desarrollo en Ajustes cuando iOS lo muestre.
- **Dependencias SPM:** File → Packages → Reset Package Caches y resolver paquetes con red disponible.
- **App gratuita deja de abrir:** volver a compilar/firmar con Xcode; el Personal Team no sustituye la distribución del programa de pago.
- **API bloqueada:** usar HTTPS válido. Si se necesita HTTP local, crear una excepción ATS Debug mínima para el host concreto; no incluirla en Release.

No versionar certificados, claves privadas, perfiles de provisioning, credenciales de App Store Connect ni archivos `.env.mobile.local`.

## Camino futuro y opcional a TestFlight y App Store

1. Inscribirse en Apple Developer Program y crear la app en App Store Connect.
2. Fijar bundle id definitivo, versión/build, iconos, privacidad y datos de soporte.
3. En Xcode seleccionar **Any iOS Device**, Product → Archive y validar el archivo.
4. Subir a App Store Connect, resolver export compliance y activar TestFlight.
5. Añadir testers internos; para externos, completar información y revisión beta cuando Apple la exija.
6. Tras validar la beta, preparar ficha, revisión y publicación en App Store.

Nada de esta sección se ha publicado ni compilado en Xcode durante v0.3 en Windows. Solo debe iniciarse cuando se decida distribuir y se autorice expresamente la membresía correspondiente.
