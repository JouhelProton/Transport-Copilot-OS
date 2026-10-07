import * as SecureStore from "expo-secure-store";

const SESSION_KEY = "transport_copilot_driver_session";

export interface AuthStorage {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}

export const authStorage: AuthStorage = {
  get: () => SecureStore.getItemAsync(SESSION_KEY),
  set: (token) =>
    SecureStore.setItemAsync(SESSION_KEY, token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
  clear: () => SecureStore.deleteItemAsync(SESSION_KEY),
};
