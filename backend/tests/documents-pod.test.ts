import "dotenv/config";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app/build-app.js";
import { loadConfig } from "../src/config/env.js";
import { createPrismaClient } from "../src/plugins/prisma.js";

const storageRoot = resolve(".local-data/test-documents");
const config = loadConfig({ ...process.env, NODE_ENV: "test", DOCUMENT_STORAGE_ROOT: storageRoot, DOCUMENT_MAX_BYTES: "1048576" });
const database = createPrismaClient(config.DATABASE_URL);
const app = await buildApp(config, database);
const serviceId = "svc_nv_24081_real";
const password = "Demo-Transport-2026!";

async function login(email: string) {
  const response = await app.inject({ method: "POST", url: "/api/v1/auth/mobile-login", payload: { email, password } });
  expect(response.statusCode).toBe(200);
  return { authorization: `Bearer ${response.json().data.sessionToken}` };
}

function multipart(fields: Record<string, string>, files: Array<{ name?: string; filename: string; mime: string; bytes: Buffer }>) {
  const boundary = `nexo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const chunks: Buffer[] = [];
  for (const [name, value] of Object.entries(fields))
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  for (const file of files) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.name ?? "file"}"; filename="${file.filename}"\r\nContent-Type: ${file.mime}\r\n\r\n`));
    chunks.push(file.bytes, Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { payload: Buffer.concat(chunks), headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
}

const pdf = (suffix: string) => Buffer.from(`%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n% ${suffix}`);
const png = (suffix: string) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(suffix)]);

async function cleanup() {
  await database.documentValidationHistory.deleteMany({ where: { document: { serviceId } } });
  await database.document.deleteMany({ where: { serviceId } });
  await database.podValidationHistory.deleteMany({ where: { pod: { serviceId } } });
  await database.proofOfDelivery.deleteMany({ where: { serviceId } });
  await database.internalNotification.deleteMany({ where: { serviceId } });
  await database.serviceEvent.deleteMany({ where: { serviceId, type: { in: ["DOCUMENT_UPLOADED", "DOCUMENT_STATUS_CHANGED", "POD_SUBMITTED", "POD_STATUS_CHANGED"] } } });
  await database.auditLog.deleteMany({ where: { entityType: { in: ["Document", "ProofOfDelivery"] } } });
  await rm(storageRoot, { recursive: true, force: true });
}

beforeAll(async () => { await app.ready(); await cleanup(); });
afterAll(async () => { await cleanup(); await app.close(); await database.$disconnect(); });

describe("documents and proof of delivery", () => {
  it("stores, hashes, rejects duplicates and authorizes downloads", async () => {
    const carrier = await login("admin@demo.nexo.local");
    const sharedUpload = multipart({ type: "DELIVERY_NOTE", visibility: "SHARED" }, [{ filename: "albaran.pdf", mime: "application/pdf", bytes: pdf("shared") }]);
    const uploaded = await app.inject({ method: "POST", url: `/api/v1/services/${serviceId}/documents`, headers: { ...carrier, ...sharedUpload.headers }, payload: sharedUpload.payload });
    expect(uploaded.statusCode, uploaded.body).toBe(201);
    expect(uploaded.json().data.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(uploaded.json().data).not.toHaveProperty("storageKey");

    const duplicate = await app.inject({ method: "POST", url: `/api/v1/services/${serviceId}/documents`, headers: { ...carrier, ...sharedUpload.headers }, payload: sharedUpload.payload });
    expect(duplicate.statusCode).toBe(409);

    const documentId = uploaded.json().data.id as string;
    const approved = await app.inject({ method: "PATCH", url: `/api/v1/services/${serviceId}/documents/${documentId}/status`, headers: carrier, payload: { status: "APPROVED" } });
    expect(approved.statusCode).toBe(200);

    const customer = await login("cliente@demo.nexo.local");
    const list = await app.inject({ method: "GET", url: `/api/v1/services/${serviceId}/documents`, headers: customer });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.map((item: { id: string }) => item.id)).toContain(documentId);
    const download = await app.inject({ method: "GET", url: `/api/v1/services/${serviceId}/documents/${documentId}/download`, headers: customer });
    expect(download.statusCode).toBe(200);
    expect(download.headers["cache-control"]).toBe("private, no-store");

    const otherTenant = await login("norte@demo.nexo.local");
    const hidden = await app.inject({ method: "GET", url: `/api/v1/services/${serviceId}/documents/${documentId}`, headers: otherTenant });
    expect(hidden.statusCode).toBe(404);
  });

  it("keeps internal documents hidden from the customer and validates content", async () => {
    const carrier = await login("admin@demo.nexo.local");
    const internalUpload = multipart({ type: "CMR", visibility: "INTERNAL" }, [{ filename: "cmr.pdf", mime: "application/pdf", bytes: pdf("internal") }]);
    const uploaded = await app.inject({ method: "POST", url: `/api/v1/services/${serviceId}/documents`, headers: { ...carrier, ...internalUpload.headers }, payload: internalUpload.payload });
    expect(uploaded.statusCode).toBe(201);
    const approved = await app.inject({ method: "PATCH", url: `/api/v1/services/${serviceId}/documents/${uploaded.json().data.id}/status`, headers: carrier, payload: { status: "APPROVED" } });
    expect(approved.statusCode).toBe(200);

    const customer = await login("cliente@demo.nexo.local");
    const hidden = await app.inject({ method: "GET", url: `/api/v1/services/${serviceId}/documents/${uploaded.json().data.id}`, headers: customer });
    expect(hidden.statusCode).toBe(404);

    const invalidUpload = multipart({ type: "SERVICE_ATTACHMENT", visibility: "SHARED" }, [{ filename: "malware.pdf", mime: "application/pdf", bytes: Buffer.from("not a pdf") }]);
    const invalid = await app.inject({ method: "POST", url: `/api/v1/services/${serviceId}/documents`, headers: { ...carrier, ...invalidUpload.headers }, payload: invalidUpload.payload });
    expect(invalid.statusCode).toBe(400);
  });

  it("submits POD from the assigned driver and exposes it only after approval", async () => {
    const driver = await login("conductor@demo.nexo.local");
    const evidence = png("evidence");
    const photoUpload = multipart({ type: "DELIVERY_PHOTO" }, [{ filename: "entrega.png", mime: "image/png", bytes: evidence }]);
    const uploadedPhoto = await app.inject({ method: "POST", url: `/api/v1/driver/services/${serviceId}/documents`, headers: { ...driver, ...photoUpload.headers }, payload: photoUpload.payload });
    expect(uploadedPhoto.statusCode, uploadedPhoto.body).toBe(201);

    const podUpload = multipart({ deliveredAt: new Date().toISOString(), observations: "Entrega sin daños visibles" }, [{ filename: "entrega.png", mime: "image/png", bytes: evidence }]);
    const submitted = await app.inject({ method: "POST", url: `/api/v1/driver/services/${serviceId}/pod`, headers: { ...driver, ...podUpload.headers }, payload: podUpload.payload });
    expect(submitted.statusCode, submitted.body).toBe(201);
    expect(submitted.json().data).toMatchObject({ status: "SUBMITTED", receiverName: null });
    expect(submitted.json().data.verificationCode).toMatch(/^[a-f0-9]{32}$/);
    expect(submitted.json().data.documents).toHaveLength(1);
    expect(submitted.json().data.documents[0].id).toBe(uploadedPhoto.json().data.id);
    const receivedNotification = await database.internalNotification.findFirst({ where: { serviceId, type: "POD_SUBMITTED" } });
    expect(receivedNotification).not.toBeNull();

    const customer = await login("cliente@demo.nexo.local");
    const beforeApproval = await app.inject({ method: "GET", url: `/api/v1/services/${serviceId}/pod`, headers: customer });
    expect(beforeApproval.statusCode).toBe(200);
    expect(beforeApproval.json().data).toBeNull();

    const carrier = await login("admin@demo.nexo.local");
    const rejectedWithoutReason = await app.inject({ method: "PATCH", url: `/api/v1/services/${serviceId}/pod/status`, headers: carrier, payload: { status: "REJECTED" } });
    expect(rejectedWithoutReason.statusCode).toBe(400);
    const approved = await app.inject({ method: "PATCH", url: `/api/v1/services/${serviceId}/pod/status`, headers: carrier, payload: { status: "APPROVED" } });
    expect(approved.statusCode, approved.body).toBe(200);
    expect(approved.json().data.history.length).toBeGreaterThanOrEqual(2);

    const visible = await app.inject({ method: "GET", url: `/api/v1/services/${serviceId}/pod`, headers: customer });
    expect(visible.statusCode).toBe(200);
    expect(visible.json().data.status).toBe("APPROVED");
    expect(await database.internalNotification.findFirst({ where: { serviceId, type: "POD_APPROVED" } })).not.toBeNull();
    expect(await database.internalNotification.findFirst({ where: { serviceId, type: "DOCUMENTATION_READY" } })).not.toBeNull();
  });
});
