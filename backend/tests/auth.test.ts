import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app/build-app.js";
import { loadConfig } from "../src/config/env.js";
import { createPrismaClient } from "../src/plugins/prisma.js";
import { hashSessionToken } from "../src/modules/auth/session-cookie.js";

const config = loadConfig({ ...process.env, NODE_ENV: "test" });
const database = createPrismaClient(config.DATABASE_URL);
const app = await buildApp(config, database);
const PASSWORD = "Demo-Transport-2026!";

function cookieFrom(response: {
  headers: Record<string, string | number | string[] | undefined>;
}): string {
  const value = response.headers["set-cookie"];
  const cookie = Array.isArray(value) ? value[0] : value;
  if (typeof cookie !== "string")
    throw new Error("El login no devolvió cookie");
  return cookie.split(";")[0]!;
}

async function login(email: string, password = PASSWORD) {
  return app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password },
  });
}

beforeAll(async () => {
  await app.ready();
});
afterAll(async () => {
  await database.session.deleteMany();
  await database.auditLog.deleteMany({ where: { entityType: "Session" } });
  await database.membership.deleteMany({
    where: { id: "mem_auth_switch_test" },
  });
  await app.close();
  await database.$disconnect();
});

describe("autenticación, sesiones y tenant", () => {
  it("acepta credenciales correctas y /auth/me devuelve identidad segura", async () => {
    const response = await login("cliente@demo.nexo.local");
    expect(response.statusCode).toBe(200);
    expect(response.headers["set-cookie"]).toContain("HttpOnly");
    expect(response.headers["set-cookie"]).toContain("SameSite=Lax");
    expect(response.json().data).not.toHaveProperty("passwordHash");

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: cookieFrom(response) },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().data).toMatchObject({
      user: { email: "cliente@demo.nexo.local" },
      activeMembership: { role: "CUSTOMER", organization: { id: "org_nova" } },
    });
    expect(me.json().data.permissions).toContain("orders:create");
  });

  it("rechaza credenciales incorrectas sin enumerar usuarios", async () => {
    const known = await login("cliente@demo.nexo.local", "incorrecta-123");
    const unknown = await login(
      "desconocido@demo.nexo.local",
      "incorrecta-123",
    );
    expect(known.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(known.json()).toMatchObject({
      error: {
        code: "UNAUTHORIZED",
        details: [],
      },
    });
    expect(known.json().error.message).toBe(unknown.json().error.message);
  });

  it("limita intentos reiterados de login", async () => {
    let response;
    for (let index = 0; index < 5; index += 1)
      response = await login("brute-force@demo.nexo.local", "incorrecta-123");
    expect(response?.statusCode).toBe(429);
  });

  it("revoca la sesión en logout", async () => {
    const signedIn = await login("cliente@demo.nexo.local");
    const cookie = cookieFrom(signedIn);
    const logout = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { cookie },
    });
    expect(logout.statusCode).toBe(204);
    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie },
    });
    expect(me.statusCode).toBe(401);
  });

  it("rechaza sesiones expiradas", async () => {
    const signedIn = await login("cliente@demo.nexo.local");
    const cookie = cookieFrom(signedIn);
    const token = cookie.slice(cookie.indexOf("=") + 1);
    await database.session.update({
      where: { tokenHash: hashSessionToken(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie },
    });
    expect(me.statusCode).toBe(401);
  });

  it("rechaza sesiones revocadas", async () => {
    const signedIn = await login("cliente@demo.nexo.local");
    const cookie = cookieFrom(signedIn);
    const token = cookie.slice(cookie.indexOf("=") + 1);
    await database.session.update({
      where: { tokenHash: hashSessionToken(token) },
      data: { revokedAt: new Date() },
    });
    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie },
    });
    expect(me.statusCode).toBe(401);
  });

  it("cambia de organización solo mediante una membership del usuario", async () => {
    await database.membership.upsert({
      where: { id: "mem_auth_switch_test" },
      update: {},
      create: {
        id: "mem_auth_switch_test",
        userId: "u_admin",
        organizationId: "org_other",
        role: "TRANSPORT_ADMIN",
      },
    });
    const signedIn = await login("admin@demo.nexo.local");
    const cookie = cookieFrom(signedIn);
    const switched = await app.inject({
      method: "POST",
      url: "/api/v1/auth/switch-organization",
      headers: { cookie },
      payload: { membershipId: "mem_auth_switch_test" },
    });
    expect(switched.statusCode).toBe(200);
    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie },
    });
    expect(me.json().data.activeMembership.organization.id).toBe("org_other");

    const forbidden = await app.inject({
      method: "POST",
      url: "/api/v1/auth/switch-organization",
      headers: { cookie },
      payload: { membershipId: "membership-ajena" },
    });
    expect(forbidden.statusCode).toBe(403);
  });

  it("rechaza usuarios sin membership", async () => {
    const response = await login("sin-organizacion@demo.nexo.local");
    expect(response.statusCode).toBe(403);
  });

  it("aplica RBAC a un rol no autorizado", async () => {
    const signedIn = await login("cliente@demo.nexo.local");
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/orders/ord_nv_24081_real/accept",
      headers: { cookie: cookieFrom(signedIn) },
    });
    expect(response.statusCode).toBe(403);
  });

  it("mantiene aislamiento y no permite suplantación mediante headers DEV", async () => {
    const noCookie = await app.inject({
      method: "GET",
      url: "/api/v1/orders",
      headers: { "x-dev-user-id": "u_admin", "x-organization-id": "org_tvd" },
    });
    expect(noCookie.statusCode).toBe(401);

    const other = await login("norte@demo.nexo.local");
    const spoofed = await app.inject({
      method: "GET",
      url: "/api/v1/orders/ord_nv_24081_real",
      headers: {
        cookie: cookieFrom(other),
        "x-dev-user-id": "u_admin",
        "x-organization-id": "org_tvd",
      },
    });
    expect(spoofed.statusCode).toBe(404);
  });
});
