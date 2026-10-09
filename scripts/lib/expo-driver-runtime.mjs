import net from "node:net";
import { closeSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

export const NEXO_BACKEND_SERVICE = "transport-copilot-backend";

export function portIsOpen(port, host = "127.0.0.1", timeoutMs = 750) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const finish = (open) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

export function findListeningPid(port, platform = process.platform) {
  if (platform === "win32") {
    const command = `(Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess)`;
    const result = spawnSync("powershell", ["-NoProfile", "-Command", command], {
      encoding: "utf8",
      windowsHide: true,
    });
    const pid = Number(String(result.stdout ?? "").trim());
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  }
  const result = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], {
    encoding: "utf8",
  });
  const pid = Number(String(result.stdout ?? "").trim().split(/\s+/)[0]);
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

export function isCompatibleReady(body) {
  return body?.status === "ok" && body?.service === NEXO_BACKEND_SERVICE && body?.database === "ready";
}

export async function inspectBackendPort({
  port,
  host = "127.0.0.1",
  fetchImpl = fetch,
  portIsOpenImpl = portIsOpen,
  findPidImpl = findListeningPid,
  timeoutMs = 2_500,
}) {
  if (!(await portIsOpenImpl(port, host))) return { action: "START", pid: null };
  const pid = findPidImpl(port);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`http://${host}:${port}/ready`, {
      signal: controller.signal,
      headers: { "x-request-id": "mobile-dev-port-check" },
    });
    const body = await response.json().catch(() => null);
    if (response.ok && isCompatibleReady(body)) return { action: "REUSE", pid, ready: body };
    return { action: "CONFLICT", pid, reason: "El proceso no expone un /ready compatible y saludable." };
  } catch {
    return { action: "CONFLICT", pid, reason: "El puerto responde, pero /ready no identifica un backend NEXO saludable." };
  } finally {
    clearTimeout(timer);
  }
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function acquireRunLock(lockPath, { pid = process.pid, isAlive = processIsAlive } = {}) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const descriptor = openSync(lockPath, "wx");
      writeFileSync(descriptor, `${JSON.stringify({ pid, startedAt: new Date().toISOString() })}\n`);
      closeSync(descriptor);
      let released = false;
      return {
        release() {
          if (released) return;
          released = true;
          rmSync(lockPath, { force: true });
        },
      };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      let ownerPid = null;
      try {
        ownerPid = Number(JSON.parse(readFileSync(lockPath, "utf8")).pid) || null;
      } catch {}
      if (ownerPid && isAlive(ownerPid)) {
        const conflict = new Error(`Ya existe una ejecución de pnpm mobile:dev (PID ${ownerPid}).`);
        conflict.code = "MOBILE_DEV_ALREADY_RUNNING";
        conflict.pid = ownerPid;
        throw conflict;
      }
      rmSync(lockPath, { force: true });
    }
  }
  throw new Error("No se pudo adquirir el bloqueo de pnpm mobile:dev.");
}

export class OwnedProcessRegistry {
  #children = [];

  add(child, label) {
    this.#children.push({ child, label });
    return child;
  }

  entries() {
    return [...this.#children];
  }

  terminateAll(terminate) {
    for (const entry of [...this.#children].reverse()) {
      if (!entry.child.pid || entry.child.exitCode !== null) continue;
      terminate(entry.child, entry.label);
    }
  }
}
