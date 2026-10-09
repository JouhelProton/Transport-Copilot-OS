import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  acquireRunLock,
  inspectBackendPort,
  OwnedProcessRegistry,
} from "../lib/expo-driver-runtime.mjs";

const healthyReady = {
  status: "ok",
  service: "transport-copilot-backend",
  database: "ready",
  features: { documentsPod: true },
};

test("propone arrancar el backend cuando el puerto está libre", async () => {
  const result = await inspectBackendPort({
    port: 3101,
    portIsOpenImpl: async () => false,
    findPidImpl: () => {
      throw new Error("No debe consultar el PID de un puerto libre");
    },
  });
  assert.deepEqual(result, { action: "START", pid: null });
});

test("reutiliza un backend NEXO saludable y conserva su PID", async () => {
  const result = await inspectBackendPort({
    port: 3101,
    portIsOpenImpl: async () => true,
    findPidImpl: () => 4242,
    fetchImpl: async () => new Response(JSON.stringify(healthyReady), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  });
  assert.equal(result.action, "REUSE");
  assert.equal(result.pid, 4242);
  assert.deepEqual(result.ready, healthyReady);
});

test("declara conflicto y muestra el PID si el puerto pertenece a otro servicio", async () => {
  const result = await inspectBackendPort({
    port: 3101,
    portIsOpenImpl: async () => true,
    findPidImpl: () => 9876,
    fetchImpl: async () => new Response(JSON.stringify({ status: "ok", service: "otro-servicio" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  });
  assert.equal(result.action, "CONFLICT");
  assert.equal(result.pid, 9876);
  assert.match(result.reason, /no expone un \/ready compatible/i);
});

test("el bloqueo impide dos ejecuciones y se elimina al liberar", () => {
  const directory = mkdtempSync(join(tmpdir(), "nexo-mobile-dev-"));
  const lockPath = join(directory, "run.lock");
  try {
    const lock = acquireRunLock(lockPath, { pid: 111, isAlive: (pid) => pid === 111 });
    assert.throws(
      () => acquireRunLock(lockPath, { pid: 222, isAlive: (pid) => pid === 111 }),
      (error) => error.code === "MOBILE_DEV_ALREADY_RUNNING" && error.pid === 111,
    );
    lock.release();
    assert.equal(existsSync(lockPath), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("recupera un bloqueo obsoleto y limpia solo procesos propios activos", () => {
  const directory = mkdtempSync(join(tmpdir(), "nexo-mobile-dev-stale-"));
  const lockPath = join(directory, "run.lock");
  try {
    writeFileSync(lockPath, JSON.stringify({ pid: 333 }));
    const lock = acquireRunLock(lockPath, { pid: 444, isAlive: () => false });
    const registry = new OwnedProcessRegistry();
    registry.add({ pid: 10, exitCode: null }, "tunnel");
    registry.add({ pid: 20, exitCode: 0 }, "expo detenido");
    const terminated = [];
    registry.terminateAll((child, label) => terminated.push([child.pid, label]));
    assert.deepEqual(terminated, [[10, "tunnel"]]);
    lock.release();
    assert.equal(existsSync(lockPath), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
