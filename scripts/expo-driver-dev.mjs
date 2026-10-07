import { spawn, spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const backendRoot = join(root, "backend");
const mobileRoot = join(root, "mobile");
const cloudflared = join(root, ".tools", "cloudflared.exe");
const backendPort = Number(process.env.MOBILE_BACKEND_PORT || 3101);
const localApi = `http://127.0.0.1:${backendPort}`;
const expoConnection = process.argv.includes("--tunnel") ? "--tunnel" : "--lan";
const children = [];
let stopping = false;

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
  children.push(child);
  if (!inherit) {
    child.stdout.on("data", (chunk) => { onOutput?.(String(chunk)); process.stdout.write(`[${label}] ${chunk}`); });
    child.stderr.on("data", (chunk) => { onOutput?.(String(chunk)); process.stderr.write(`[${label}] ${chunk}`); });
  }
  child.on("exit", (code) => {
    if (!stopping) {
      console.error(`\n${label} se ha detenido (código ${code ?? "desconocido"}).`);
      stop(code || 1);
    }
  });
  return child;
}

async function waitFor(url, label, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { const response = await fetch(url); if (response.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${label} no responde en ${url}`);
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  console.log("\nCerrando Expo, túnel y backend...");
  for (const child of [...children].reverse()) {
    if (!child.pid || child.exitCode !== null) continue;
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    else child.kill("SIGTERM");
  }
  process.exit(code);
}

process.once("SIGINT", () => stop(0));
process.once("SIGTERM", () => stop(0));

try {
  console.log("Iniciando API privada para Transport Copilot Driver...");
  start("backend", process.execPath, [join(backendRoot, "node_modules", "tsx", "dist", "cli.mjs"), "src/server.ts"], {
    cwd: backendRoot,
    env: { NODE_ENV: "production", HOST: "127.0.0.1", PORT: String(backendPort) },
  });
  await waitFor(`${localApi}/ready`, "backend y PostgreSQL");

  let output = "";
  let resolveTunnel;
  let rejectTunnel;
  const tunnelReady = new Promise((resolve, reject) => { resolveTunnel = resolve; rejectTunnel = reject; });
  const tunnel = start("https", cloudflared, ["tunnel", "--no-autoupdate", "--url", localApi], {
    onOutput(chunk) {
      output = `${output}${chunk}`.slice(-16_384);
      const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (match) resolveTunnel(match[0]);
      if (/failed to request quick Tunnel|ERR /i.test(chunk)) rejectTunnel(new Error("Cloudflare Quick Tunnel no ha podido iniciarse."));
    },
  });
  tunnel.once("exit", (code) => rejectTunnel(new Error(`cloudflared terminó con código ${code ?? "desconocido"}`)));
  const publicApi = await Promise.race([tunnelReady, new Promise((_, reject) => setTimeout(() => reject(new Error("No se recibió una URL HTTPS en 30 segundos.")), 30_000))]);
  await waitFor(`${publicApi}/ready`, "API pública y PostgreSQL");
  writeFileSync(join(root, ".expo-driver-preview.json"), `${JSON.stringify({ publicApi, expoConnection, startedAt: new Date().toISOString() }, null, 2)}\n`);

  console.log("\n============================================================");
  console.log("TRANSPORT COPILOT DRIVER — EXPO GO");
  console.log(`API URL: ${publicApi}`);
  console.log(`Expo: ${expoConnection === "--lan" ? "LAN (iPhone y Windows en la misma Wi-Fi)" : "túnel"}`);
  console.log("Escanea el QR que aparecerá a continuación con Expo Go.");
  console.log("Mantén esta terminal abierta. Ctrl+C cierra todo.");
  console.log("============================================================\n");

  start("expo", process.execPath, [join(mobileRoot, "node_modules", "expo", "bin", "cli"), "start", expoConnection], {
    cwd: mobileRoot,
    env: { EXPO_PUBLIC_API_URL: publicApi },
    inherit: true,
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  stop(1);
}
