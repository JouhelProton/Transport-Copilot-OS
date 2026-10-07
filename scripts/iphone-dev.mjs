import { spawn, spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const backendRoot = join(repositoryRoot, "backend");
const frontendRoot = join(repositoryRoot, "frontend");
const cloudflared = join(repositoryRoot, ".tools", "cloudflared.exe");
const backendPort = Number(process.env.IPHONE_BACKEND_PORT || 3101);
const frontendPort = Number(process.env.IPHONE_FRONTEND_PORT || 4276);
const localFrontendOrigin = `http://127.0.0.1:${frontendPort}`;
const localBackendOrigin = `http://127.0.0.1:${backendPort}`;
const children = [];
let stopping = false;

if (!existsSync(cloudflared)) {
  console.error("Falta .tools/cloudflared.exe. Ejecuta primero: pnpm iphone:setup");
  process.exit(1);
}

function start(label, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd || repositoryRoot,
    env: { ...process.env, ...options.env },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  children.push(child);
  child.stdout.on("data", (chunk) => {
    options.onOutput?.(String(chunk));
    process.stdout.write(`[${label}] ${chunk}`);
  });
  child.stderr.on("data", (chunk) => {
    options.onOutput?.(String(chunk));
    process.stderr.write(`[${label}] ${chunk}`);
  });
  child.on("exit", (code) => {
    if (!stopping) {
      console.error(`\n${label} se ha detenido inesperadamente (código ${code ?? "desconocido"}).`);
      stop(1);
    }
  });
  return child;
}

async function waitFor(url, label, attempts = 60) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {
      // The child process can need a few seconds for TypeScript/Vite startup.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${label} no responde en ${url}`);
}

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  console.log("\nDeteniendo preview de iPhone...");
  for (const child of [...children].reverse()) {
    if (!child.pid || child.exitCode !== null) continue;
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } else {
      child.kill("SIGTERM");
    }
  }
  process.exit(exitCode);
}

process.once("SIGINT", () => stop(0));
process.once("SIGTERM", () => stop(0));

try {
  console.log("Iniciando backend privado, frontend Driver y túnel HTTPS...");
  start(
    "backend",
    process.execPath,
    [join(backendRoot, "node_modules", "tsx", "dist", "cli.mjs"), "src/server.ts"],
    {
      cwd: backendRoot,
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: String(backendPort),
        CORS_ORIGIN: localFrontendOrigin,
      },
    },
  );
  await waitFor(`${localBackendOrigin}/health`, "backend");

  start(
    "frontend",
    process.execPath,
    [
      join(frontendRoot, "node_modules", "vite", "bin", "vite.js"),
      "dev",
      "--host",
      "127.0.0.1",
      "--port",
      String(frontendPort),
      "--strictPort",
    ],
    {
      cwd: frontendRoot,
      env: {
        IPHONE_PREVIEW: "true",
        IPHONE_BACKEND_URL: localBackendOrigin,
        IPHONE_PROXY_ORIGIN: localFrontendOrigin,
        VITE_API_BASE_URL: "same-origin",
        VITE_APP_SURFACE: "driver",
        VITE_SHOW_DEV_ACCOUNTS: "false",
      },
    },
  );
  await waitFor(`${localFrontendOrigin}/login/conductor`, "frontend");

  let tunnelOutput = "";
  let resolveTunnel;
  let rejectTunnel;
  const tunnelReady = new Promise((resolve, reject) => {
    resolveTunnel = resolve;
    rejectTunnel = reject;
  });
  const tunnel = start(
    "https",
    cloudflared,
    ["tunnel", "--no-autoupdate", "--url", localFrontendOrigin],
    {
      onOutput(chunk) {
        tunnelOutput = `${tunnelOutput}${chunk}`.slice(-16_384);
        const match = tunnelOutput.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
        if (match) resolveTunnel(match[0]);
        if (/failed to request quick Tunnel|ERR /i.test(chunk))
          rejectTunnel(new Error("Cloudflare Quick Tunnel no ha podido iniciarse."));
      },
    },
  );
  tunnel.once("exit", (code) =>
    rejectTunnel(new Error(`cloudflared terminó con código ${code ?? "desconocido"}`)),
  );

  const publicOrigin = await Promise.race([
    tunnelReady,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("No se recibió una URL HTTPS en 30 segundos.")), 30_000),
    ),
  ]);
  const loginUrl = `${publicOrigin}/login/conductor`;
  writeFileSync(
    join(repositoryRoot, ".iphone-preview.json"),
    `${JSON.stringify({ publicOrigin, loginUrl, startedAt: new Date().toISOString() }, null, 2)}\n`,
  );
  console.log("\n============================================================");
  console.log("TRANSPORT COPILOT DRIVER — URL PARA SAFARI EN IPHONE");
  console.log(loginUrl);
  console.log("Mantén esta terminal abierta. Pulsa Ctrl+C para cerrar el acceso.");
  console.log("============================================================\n");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  stop(1);
}
