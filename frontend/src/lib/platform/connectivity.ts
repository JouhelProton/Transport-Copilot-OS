import { Network } from "@capacitor/network";
import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
let online = typeof navigator === "undefined" ? true : navigator.onLine;
let initialized = false;

function publish(value: boolean) {
  if (online === value) return;
  online = value;
  listeners.forEach((listener) => listener());
}

function initialize() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  void Network.getStatus().then((status) => publish(status.connected));
  void Network.addListener("networkStatusChange", (status) => publish(status.connected));
}

export function useOnlineStatus() {
  return useSyncExternalStore(
    (listener) => {
      initialize();
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => online,
    () => true,
  );
}
