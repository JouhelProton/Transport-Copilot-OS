import { spawn, spawnSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  acquireRunLock,
  inspectBackendPort,
  isCompatibleReady,
  OwnedProcessRegistry,
} from "./lib/expo-driver-runtime.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const backendRoot = join(root, "backend");
const mobileRoot = join(root, "mobile");
const cloudflared = join(root, ".tools", "cloudflared.exe");
const backendPort = Number(process.env.MOBILE_BACKEND_PORT || 3101);
const localApi = `http://127.0.0.1:${backendPort}`;
const expoConnection = process.argv.includes("--lan") ? "--lan" : "--tunnel";
const developmentClient = process.argv.includes("--dev-client");
const previewMetadata = join(root, ".expo-driver-preview.json");
const runLockPath = join(root, ".expo-driver-dev.lock");
const children = new OwnedProcessRegistry();
let runLock = null;
let stopping = false;
let ownsBackend = false;

if (!Number.isInteger(backendPort) || backendPort < 1 || backendPort > 65_535) {
  console.error("MOBILE_BACKEND_PORT no contiene un puerto válido.");
  process.exit(1);
}
if (!existsSync(cloudflared)) {
  console.error("Falta cloudflared. Ejecuta una vez: pnpm iphone:setup");
  process.exit(1);
}
if (!existsSync(join(mobileRoot, "node_modules", "expo", "bin", "cli"))) {
  console.error("Faltan dependencias Mobile. Ejecuta: cd mobile; pnpm install");
  process.exit(1);
}

function start(label, command, args, { cwd = root, env = {}, inherit = false, onOutput } = {}) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  children.add(child, label);
  if (!inherit) {
    child.stdout.on("data", (chunk) => {
      onOutput?.(String(chunk));
      process.stdout.write(`[${label}] ${chunk}`);
    });
    child.stderr.on("data", (chunk) => {
      onOutput?.(String(chunk));
      process.stderr.write(`[${label}] ${chunk}`);
    });
  }
  child.on("exit", (code) => {
    if (!stopping) {
      console.error(`\n${label} se ha detenido (código ${code ?? "desconocido"}).`);
      stop(code ?? 1);
    }
  });
  return child;
}

async function readReady(url, requestId) {
  const response = await fetch(url, { headers: { "x-request-id": requestId } });
  const body = await response.json().catch(() => null);
  return { ok: response.ok && isCompatibleReady(body), body };
}

async function waitForReady(url, label, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const result = await readReady(url, `mobile-dev-${attempt}`);
      if (result.ok) return result.body;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${label} no responde como backend NEXO saludable en ${url}`);
}

function terminateOwnedChild(child) {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
  } else {
    child.kill("SIGTERM");
  }
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  console.log(`\nCerrando Expo y túnel${ownsBackend ? ", además del backend iniciado por esta ejecución" : ""}...`);
  children.terminateAll(terminateOwnedChild);
  runLock?.release();
  process.exit(code);
}

process.once("SIGINT", () => stop(0));
process.once("SIGTERM", () => stop(0));

try {
  runLock = acquireRunLock(runLockPath);
  rmSync(previewMetadata, { force: true });

  const backendPlan = await inspectBackendPort({ port: backendPort });
  if (backendPlan.action === "CONFLICT") {
    const pidText = backendPlan.pid ? ` PID detectado: ${backendPlan.pid}.` : " No se pudo determinar el PID.";
    throw new Error(`El puerto ${backendPort} está ocupado por un proceso ajeno o incompatible.${pidText} ${backendPlan.reason} No se ha detenido ningún proceso.`);
  }

  if (backendPlan.action === "REUSE") {
    console.log(`Reutilizando backend NEXO saludable en ${localApi}${backendPlan.pid ? ` (PID ${backendPlan.pid})` : ""}.`);
  } else {
    console.log(`Puerto ${backendPort} libre. Iniciando API privada para Transport Copilot Driver...`);
    ownsBackend = true;
    start(
      "backend",
      process.execPath,
      [join(backendRoot, "node_modules", "tsx", "dist", "cli.mjs"), "src/server.ts"],
      {
        cwd: backendRoot,
        env: { NODE_ENV: "production", HOST: "127.0.0.1", PORT: String(backendPort) },
      },
    );
    await waitForReady(`${localApi}/ready`, "backend y PostgreSQL");
  }

  await waitForReady(`${localApi}/ready`, "backend local antes de crear el túnel");

  let output = "";
  let resolveTunnel;
  let rejectTunnel;
  const tunnelReady = new Promise((resolve, reject) => {
    resolveTunnel = resolve;
    rejectTunnel = reject;
  });
  const tunnel = start("https", cloudflared, ["tunnel", "--no-autoupdate", "--url", localApi], {
    onOutput(chunk) {
      output = `${output}${chunk}`.slice(-16_384);
      const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (match) resolveTunnel(match[0]);
      if (/failed to request quick Tunnel|ERR /i.test(chunk)) rejectTunnel(new Error("Cloudflare Quick Tunnel no ha podido iniciarse."));
    },
  });
  tunnel.once("exit", (code) => rejectTunnel(new Error(`cloudflared terminó con código ${code ?? "desconocido"}`)));
  const publicApi = await Promise.race([
    tunnelReady,
    new Promise((_, reject) => setTimeout(() => reject(new Error("No se recibió una URL HTTPS en 30 segundos.")), 30_000)),
  ]);
  await waitForReady(`${publicApi}/ready`, "túnel al backend NEXO");
  writeFileSync(previewMetadata, `${JSON.stringify({
    publicApi,
    localApi,
    backend: backendPlan.action === "REUSE" ? "reused" : "started",
    backendPid: backendPlan.pid ?? null,
    expoConnection,
    developmentClient,
    readyVerifiedAt: new Date().toISOString(),
  }, null, 2)}\n`);

  console.log("\n============================================================");
  console.log(`NEXO DRIVER — ${developmentClient ? "DEVELOPMENT BUILD" : "EXPO GO"}`);
  console.log(`API local: ${localApi}`);
  console.log(`API URL: ${publicApi}`);
  console.log("Túnel verificado contra el mismo backend NEXO: /ready = ok, PostgreSQL = ready");
  console.log(`Backend: ${backendPlan.action === "REUSE" ? "reutilizado; no se cerrará al salir" : "iniciado por este proceso"}`);
  console.log(`Expo: ${expoConnection === "--lan" ? "LAN (iPhone y Windows en la misma Wi-Fi)" : "túnel"}`);
  console.log(`EXPO_PUBLIC_API_URL: ${publicApi}`);
  console.log(`Escanea el QR con ${developmentClient ? "la Development Build de NEXO Driver" : "Expo Go"}.`);
  console.log("Mantén esta terminal abierta. Ctrl+C cierra únicamente los procesos propios.");
  console.log("============================================================\n");

  start("expo", process.execPath, [join(mobileRoot, "node_modules", "expo", "bin", "cli"), "start", expoConnection, ...(developmentClient ? ["--dev-client"] : [])], {
    cwd: mobileRoot,
    env: { EXPO_PUBLIC_API_URL: publicApi },
    inherit: true,
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  stop(1);
}
