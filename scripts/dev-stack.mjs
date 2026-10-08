import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const backendRoot = join(root, "backend");
const frontendRoot = join(root, "frontend");
const backendPort = Number(process.env.NEXO_BACKEND_PORT || 3001);
const frontendPort = Number(process.env.NEXO_FRONTEND_PORT || 3000);
const backendUrl = `http://127.0.0.1:${backendPort}`;
const frontendUrl = `http://127.0.0.1:${frontendPort}`;
const prismaCli = join(backendRoot, "node_modules", "prisma", "build", "index.js");
const viteCli = join(frontendRoot, "node_modules", "vite", "bin", "vite.js");
const children = [];
let stopping = false;

if (!existsSync(prismaCli) || !existsSync(viteCli)) {
  console.error("Faltan dependencias locales. Instala backend y frontend antes de ejecutar pnpm dev:stack.");
  process.exit(1);
}

function command(command, args, cwd, label) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", windowsHide: true });
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${label} falló${detail ? `:\n${detail}` : "."}`);
  }
  return result.stdout.trim();
}

function start(label, commandName, args, cwd, env = {}) {
  const child = spawn(commandName, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["inherit", "pipe", "pipe"],
    windowsHide: true,
  });
  children.push(child);
  child.stdout.on("data", (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${label}] ${chunk}`));
  child.on("exit", (code) => {
    if (!stopping) {
      console.error(`\n${label} se ha detenido (código ${code ?? "desconocido"}).`);
      stop(code || 1);
    }
  });
  return child;
}

async function portAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

async function waitFor(url, label, attempts = 80) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${label} no responde en ${url}`);
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  console.log("\nCerrando frontend y backend. PostgreSQL permanece levantado para conservar el entorno local.");
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
  if (!(await portAvailable(backendPort))) throw new Error(`El puerto ${backendPort} ya está ocupado. Define NEXO_BACKEND_PORT o detén el proceso existente.`);
  if (!(await portAvailable(frontendPort))) throw new Error(`El puerto ${frontendPort} ya está ocupado. Define NEXO_FRONTEND_PORT o detén el proceso existente.`);

  console.log("Iniciando PostgreSQL 17 con Docker Compose...");
  command("docker", ["compose", "up", "-d", "postgres"], backendRoot, "Docker/PostgreSQL");
  command("docker", ["compose", "ps", "--status", "running", "postgres"], backendRoot, "Comprobación de PostgreSQL");
  console.log("Aplicando migraciones pendientes sin borrar datos...");
  command(process.execPath, [prismaCli, "migrate", "deploy"], backendRoot, "Prisma migrate deploy");

  start("backend", process.execPath, [join(backendRoot, "node_modules", "tsx", "dist", "cli.mjs"), "watch", "src/server.ts"], backendRoot, {
    HOST: "127.0.0.1",
    PORT: String(backendPort),
    CORS_ORIGIN: frontendUrl,
  });
  await waitFor(`${backendUrl}/ready`, "Backend y PostgreSQL");
  console.log("Backend listo y PostgreSQL accesible.");

  start("frontend", process.execPath, [viteCli, "--host", "127.0.0.1", "--port", String(frontendPort), "--strictPort"], frontendRoot, {
    VITE_API_BASE_URL: backendUrl,
  });
  await waitFor(frontendUrl, "Portal web");

  console.log("\n============================================================");
  console.log("NEXO — ENTORNO LOCAL LISTO");
  console.log(`Portal:     ${frontendUrl}`);
  console.log(`Backend:    ${backendUrl}`);
  console.log(`Ready:      ${backendUrl}/ready`);
  console.log("PostgreSQL: 127.0.0.1:5434 (solo loopback)");
  console.log("Mantén esta terminal abierta. Ctrl+C cierra frontend y backend.");
  console.log("============================================================\n");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  stop(1);
}
