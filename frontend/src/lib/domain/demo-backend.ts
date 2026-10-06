/**
 * Backend DEMO compartido.
 * Única fuente de verdad para los tres portales en modo demo: todos leen y
 * mutan el mismo estado a través de este módulo (persistido en el navegador y
 * sincronizado entre pestañas). Sustituible por el backend real (Lovable Cloud)
 * implementando la misma interfaz `ServiceBackend`.
 */
import { useSyncExternalStore } from "react";
import { createSeed } from "./seed";
import type { DemoState } from "./types";

const KEY = "nexo-demo-state-v1";
type Listener = () => void;
const listeners = new Set<Listener>();
let state: DemoState | null = null;
const SERVER_SNAPSHOT = createSeed();

function load(): DemoState {
  if (state) return state;
  if (typeof window === "undefined") return SERVER_SNAPSHOT;
  try {
    const raw = window.localStorage.getItem(KEY);
    state = raw ? (JSON.parse(raw) as DemoState) : createSeed();
  } catch {
    state = createSeed();
  }
  return state;
}

function emit() {
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      state = null;
      load();
      emit();
    }
  });
}

export function getState(): DemoState {
  return load();
}

export function commit(mutator: (draft: DemoState) => void) {
  const next = structuredClone(load());
  mutator(next);
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* almacenamiento no disponible */
  }
  emit();
}

export function resetDemo() {
  state = createSeed();
  window.localStorage.setItem(KEY, JSON.stringify(state));
  emit();
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useDemoState<T>(selector: (s: DemoState) => T): T {
  const s = useSyncExternalStore(subscribe, load, () => SERVER_SNAPSHOT);
  return selector(s);
}
