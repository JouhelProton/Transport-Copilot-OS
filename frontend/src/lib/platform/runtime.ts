import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";

const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, "");
const appSurface = import.meta.env.VITE_APP_SURFACE?.trim() || "web";

function apiBaseUrl() {
  const base =
    configuredApiBase === "same-origin" ? "" : configuredApiBase || "http://127.0.0.1:3001";
  if (platform.isDriverNativeApp) {
    if (!base) throw new Error("La app nativa necesita una VITE_API_BASE_URL HTTPS explícita.");
    const hostname = new URL(base).hostname;
    if (hostname === "127.0.0.1" || hostname === "localhost")
      throw new Error(
        "La app móvil necesita una VITE_API_BASE_URL accesible desde el dispositivo.",
      );
  }
  return base;
}

export const platform = {
  isNative: Capacitor.isNativePlatform(),
  nativePlatform: Capacitor.getPlatform(),
  isDriverSurface: appSurface === "driver",
  isDriverNativeApp: Capacitor.isNativePlatform() && appSurface === "driver",
  apiBaseUrl,
  canOpenPath(pathname: string) {
    if (!this.isDriverSurface) return true;
    return (
      pathname === "/conductor" ||
      pathname.startsWith("/conductor/") ||
      pathname === "/login/conductor"
    );
  },
  async configureNativeShell() {
    if (!this.isDriverSurface || typeof document === "undefined") return;
    document.documentElement.classList.add("driver-surface");
    if (!this.isDriverNativeApp) return;
    document.documentElement.classList.add("driver-native");
    await SystemBars.show();
    await SystemBars.setStyle({ style: SystemBarsStyle.Light });
  },
};
