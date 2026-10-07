import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { platform } from "./runtime";

const TOKEN_KEY = "session";
let storageReady: Promise<void> | undefined;

async function prepareStorage() {
  if (!platform.isDriverNativeApp) return;
  storageReady ??= SecureStorage.setKeyPrefix("transport_copilot_driver_");
  await storageReady;
}

async function nativeToken() {
  if (!platform.isDriverNativeApp) return null;
  await prepareStorage();
  return SecureStorage.getItem(TOKEN_KEY);
}

export const authTransport = {
  loginPath: platform.isDriverNativeApp ? "/mobile-login" : "/login",
  unauthenticatedInit(init?: RequestInit): RequestInit {
    return {
      ...init,
      credentials: platform.isDriverNativeApp ? "omit" : "include",
    };
  },
  async authenticatedInit(init?: RequestInit): Promise<RequestInit> {
    if (!platform.isDriverNativeApp) return { ...init, credentials: "include" };
    const token = await nativeToken();
    return {
      ...init,
      credentials: "omit",
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    };
  },
  async persistLoginToken(token: string | undefined) {
    if (!platform.isDriverNativeApp) return;
    if (!token) throw new Error("El backend no devolvió una sesión móvil válida");
    await prepareStorage();
    await SecureStorage.setItem(TOKEN_KEY, token);
  },
  async clear() {
    if (!platform.isDriverNativeApp) return;
    await prepareStorage();
    await SecureStorage.removeItem(TOKEN_KEY);
  },
};
