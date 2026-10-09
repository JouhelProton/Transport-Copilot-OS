import { randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AppConfig } from "../../config/env.js";
import type { Database } from "../../plugins/prisma.js";
import { badRequest, conflict, forbidden, notFound } from "../../shared/errors.js";
import { createAuthenticate, requirePermission, type AuthContext } from "../auth/auth.js";
import { idParamsSchema } from "../orders/schemas.js";
import {
  documentParamsSchema,
  documentStatusBodySchema,
  documentTypeSchema,
  documentVisibilitySchema,
  podFieldsSchema,
  podStatusBodySchema,
} from "./schemas.js";
import { createLocalDocumentStorage, type PrivateDocumentStorage } from "./storage.js";

const documentInclude = {
  uploadedBy: { select: { id: true, name: true } },
  history: {
    include: { changedBy: { select: { id: true, name: true } } },
    orderBy: { changedAt: "asc" as const },
  },
} as const;

const podInclude = {
  driver: { select: { id: true, name: true } },
  submittedBy: { select: { id: true, name: true } },
  documents: { include: documentInclude, orderBy: { uploadedAt: "asc" as const } },
  history: {
    include: { changedBy: { select: { id: true, name: true } } },
    orderBy: { changedAt: "asc" as const },
  },
} as const;

type UploadFile = { bytes: Buffer; filename: string; mimetype: string };

function pdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[\r\n]+/g, " ").slice(0, 180);
}

function createSimplePdf(lines: string[]) {
  const content = ["BT", "/F1 18 Tf", "72 760 Td", ...lines.flatMap((line, index) => [index === 0 ? `(${pdfText(line)}) Tj` : "0 -28 Td", index === 0 ? "" : `(${pdfText(line)}) Tj`]), "ET"].filter(Boolean).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf, "latin1")); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index++) pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

function cleanFilename(filename: string | undefined) {
  const cleaned = (filename ?? "documento")
    .split(/[\\/]/)
    .at(-1)!
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  return (cleaned || "documento").slice(0, 255);
}

async function parseMultipart(request: FastifyRequest, maxFiles: number) {
  if (!request.isMultipart())
    throw badRequest("MULTIPART_REQUIRED", "La petición debe enviarse como multipart/form-data");
  const fields: Record<string, string> = {};
  const files: UploadFile[] = [];
  for await (const part of request.parts()) {
    if (part.type === "file") {
      if (files.length >= maxFiles)
        throw badRequest("TOO_MANY_FILES", `Solo se permiten ${maxFiles} archivos`);
      files.push({
        bytes: await part.toBuffer(),
        filename: cleanFilename(part.filename),
        mimetype: part.mimetype,
      });
    } else {
      fields[part.fieldname] = String(part.value);
    }
  }
  return { fields, files };
}

function accessWhere(auth: AuthContext, serviceId?: string) {
  const id = serviceId ? { id: serviceId } : {};
  if (auth.actorKind === "transport") return { ...id, organizationId: auth.organizationId };
  if (auth.actorKind === "customer")
    return {
      ...id,
      customerOrganizationId: auth.organizationId,
      customerId: auth.customerId ?? "__none__",
    };
  if (auth.actorKind === "driver")
    return {
      ...id,
      organizationId: auth.organizationId,
      assignments: { some: { driverId: auth.driverId ?? "__none__", status: "ACTIVE" as const } },
    };
  throw forbidden();
}

async function accessibleService(database: Database, auth: AuthContext, serviceId: string) {
  const service = await database.service.findFirst({
    where: accessWhere(auth, serviceId),
    include: {
      order: { select: { id: true, reference: true, originName: true, destinationName: true, cargo: true, pallets: true, plannedDelivery: true } },
      assignments: {
        where: { status: "ACTIVE" },
        include: { driver: { select: { id: true, name: true } } },
      },
    },
  });
  if (!service) throw notFound("Servicio");
  return service;
}

function documentReadWhere(auth: AuthContext) {
  if (auth.actorKind === "customer")
    return { visibility: "SHARED" as const, status: "APPROVED" as const };
  if (auth.actorKind === "driver") return { visibility: "SHARED" as const };
  return {};
}

function presentDocument(document: any) {
  return {
    id: document.id,
    serviceId: document.serviceId,
    podId: document.podId,
    type: document.type,
    visibility: document.visibility,
    originalName: document.originalName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    sha256: document.sha256,
    status: document.status,
    uploadedAt: document.uploadedAt,
    uploadedBy: document.uploadedBy,
    history: document.history,
    downloadUrl: `/api/v1/services/${document.serviceId}/documents/${document.id}/download`,
  };
}

function presentPod(pod: any, customerView = false) {
  return {
    id: pod.id,
    serviceId: pod.serviceId,
    driver: pod.driver,
    submittedBy: pod.submittedBy,
    deliveredAt: pod.deliveredAt,
    serverSubmittedAt: pod.serverSubmittedAt,
    receiverName: pod.receiverName,
    observations: pod.observations,
    status: pod.status,
    verificationCode: pod.verificationCode,
    documents: pod.documents
      .filter((document: any) => !customerView || (document.visibility === "SHARED" && document.status === "APPROVED"))
      .map(presentDocument),
    history: pod.history,
  };
}

async function saveFiles(
  storage: PrivateDocumentStorage,
  files: UploadFile[],
) {
  const stored: Array<UploadFile & Awaited<ReturnType<PrivateDocumentStorage["put"]>>> = [];
  try {
    for (const file of files)
      stored.push({ ...file, ...(await storage.put({ bytes: file.bytes, declaredMimeType: file.mimetype })) });
    return stored;
  } catch (error) {
    await Promise.all(stored.map((file) => storage.delete(file.storageKey)));
    throw error;
  }
}

export async function registerDocumentRoutes(
  app: FastifyInstance,
  database: Database,
  config: AppConfig,
) {
  const authenticate = createAuthenticate(database, config);
  const storage = createLocalDocumentStorage(config.DOCUMENT_STORAGE_ROOT, config.DOCUMENT_MAX_BYTES);

  app.get("/documents", { preHandler: authenticate }, async (request) => {
    const auth = requirePermission(request, "documents:read");
    const services = await database.service.findMany({
      where: accessWhere(auth),
      select: { id: true },
    });
    const documents = await database.document.findMany({
      where: { serviceId: { in: services.map(({ id }) => id) }, ...documentReadWhere(auth) },
      include: documentInclude,
      orderBy: { uploadedAt: "desc" },
    });
    return { data: documents.map(presentDocument) };
  });

  app.get("/services/:id/documents", { preHandler: authenticate }, async (request) => {
    const auth = requirePermission(request, "documents:read");
    const { id } = idParamsSchema.parse(request.params);
    await accessibleService(database, auth, id);
    const documents = await database.document.findMany({
      where: { serviceId: id, ...documentReadWhere(auth) },
      include: documentInclude,
      orderBy: { uploadedAt: "desc" },
    });
    return { data: documents.map(presentDocument) };
  });

  app.post("/services/:id/documents", { preHandler: authenticate }, async (request, reply) => {
    const auth = requirePermission(request, "documents:write");
    if (auth.actorKind !== "transport") throw forbidden();
    const { id } = idParamsSchema.parse(request.params);
    const service = await accessibleService(database, auth, id);
    const { fields, files } = await parseMultipart(request, 1);
    if (files.length !== 1) throw badRequest("FILE_REQUIRED", "Debes adjuntar un archivo");
    const type = documentTypeSchema.parse(fields.type);
    const visibility = documentVisibilitySchema.parse(fields.visibility ?? "SHARED");
    const [stored] = await saveFiles(storage, files);
    try {
      const duplicate = await database.document.findUnique({
        where: { serviceId_sha256: { serviceId: id, sha256: stored!.sha256 } },
      });
      if (duplicate) throw conflict("DUPLICATE_DOCUMENT", "Este archivo ya está asociado al servicio");
      const document = await database.$transaction(async (tx) => {
        const created = await tx.document.create({
          data: {
            organizationId: auth.organizationId,
            serviceId: id,
            type,
            visibility,
            originalName: stored!.filename,
            mimeType: stored!.mimeType,
            sizeBytes: stored!.sizeBytes,
            storageKey: stored!.storageKey,
            sha256: stored!.sha256,
            status: "UPLOADED",
            uploadedByUserId: auth.userId,
            history: { create: { organizationId: auth.organizationId, changedByUserId: auth.userId, toStatus: "UPLOADED" } },
          },
          include: documentInclude,
        });
        await tx.serviceEvent.create({
          data: { organizationId: auth.organizationId, serviceId: id, orderId: service.orderId, type: "DOCUMENT_UPLOADED", entityType: "Document", entityId: created.id, actorUserId: auth.userId, correlationId: request.id, payload: { type, visibility, sha256: created.sha256 } },
        });
        await tx.auditLog.create({ data: { organizationId: auth.organizationId, actorUserId: auth.userId, action: "DOCUMENT_UPLOADED", entityType: "Document", entityId: created.id, requestId: request.id, metadata: { serviceId: id, type, visibility } } });
        return created;
      });
      return reply.code(201).send({ data: presentDocument(document) });
    } catch (error) {
      await storage.delete(stored!.storageKey);
      throw error;
    }
  });

  app.post("/services/:id/documents/generate", { preHandler: authenticate }, async (request, reply) => {
    const auth = requirePermission(request, "documents:write");
    if (auth.actorKind !== "transport") throw forbidden();
    const { id } = idParamsSchema.parse(request.params);
    const service = await accessibleService(database, auth, id);
    const input = z.object({ type: z.enum(["DELIVERY_NOTE", "POD"]) }).parse(request.body);
    const pod = input.type === "POD" ? await database.proofOfDelivery.findUnique({ where: { serviceId: id }, include: { driver: { select: { name: true } } } }) : null;
    if (input.type === "POD" && !pod) throw badRequest("POD_REQUIRED", "No existe un POD para generar el justificante");
    const originalName = `${service.order.reference}-${input.type === "POD" ? "justificante-entrega" : "albaran"}.pdf`;
    const existing = await database.document.findFirst({ where: { serviceId: id, type: input.type, originalName }, include: documentInclude });
    if (existing) return { data: presentDocument(existing) };
    const lines = [input.type === "POD" ? "JUSTIFICANTE DE ENTREGA" : "ALBARAN DE TRANSPORTE", `Referencia: ${service.order.reference}`, `Ruta: ${service.order.originName} -> ${service.order.destinationName}`, `Mercancia: ${service.order.cargo} · ${service.order.pallets} palets`, `Entrega planificada: ${service.order.plannedDelivery.toISOString()}`, input.type === "POD" ? `Estado POD: ${pod!.status}` : "Documento generado por NEXO Copilot", input.type === "POD" ? `Conductor: ${pod!.driver.name}` : "Pendiente de validacion comercial", "Este documento es una representacion operativa y no constituye por si solo una firma electronica cualificada."];
    const stored = await storage.put({ bytes: createSimplePdf(lines), declaredMimeType: "application/pdf" });
    try {
      const document = await database.$transaction(async (tx) => {
        const created = await tx.document.create({ data: { organizationId: auth.organizationId, serviceId: id, type: input.type, visibility: "SHARED", originalName, mimeType: stored.mimeType, sizeBytes: stored.sizeBytes, storageKey: stored.storageKey, sha256: stored.sha256, status: "APPROVED", uploadedByUserId: auth.userId, history: { create: { organizationId: auth.organizationId, changedByUserId: auth.userId, toStatus: "APPROVED", reason: "Generado por NEXO Copilot" } } }, include: documentInclude });
        await tx.serviceEvent.create({ data: { organizationId: auth.organizationId, serviceId: id, orderId: service.orderId, type: "DOCUMENT_UPLOADED", entityType: "Document", entityId: created.id, actorUserId: auth.userId, correlationId: request.id, payload: { generated: true, type: input.type, sha256: created.sha256 } } });
        await tx.auditLog.create({ data: { organizationId: auth.organizationId, actorUserId: auth.userId, action: "DOCUMENT_GENERATED", entityType: "Document", entityId: created.id, requestId: request.id, metadata: { serviceId: id, type: input.type } } });
        return created;
      });
      return reply.code(201).send({ data: presentDocument(document) });
    } catch (error) { await storage.delete(stored.storageKey); throw error; }
  });

  app.get("/services/:serviceId/documents/:documentId", { preHandler: authenticate }, async (request) => {
    const auth = requirePermission(request, "documents:read");
    const { serviceId, documentId } = documentParamsSchema.parse(request.params);
    await accessibleService(database, auth, serviceId);
    const document = await database.document.findFirst({ where: { id: documentId, serviceId, ...documentReadWhere(auth) }, include: documentInclude });
    if (!document) throw notFound("Documento");
    return { data: presentDocument(document) };
  });

  app.get("/services/:serviceId/documents/:documentId/history", { preHandler: authenticate }, async (request) => {
    const auth = requirePermission(request, "documents:read");
    const { serviceId, documentId } = documentParamsSchema.parse(request.params);
    await accessibleService(database, auth, serviceId);
    const document = await database.document.findFirst({ where: { id: documentId, serviceId, ...documentReadWhere(auth) }, select: { id: true } });
    if (!document) throw notFound("Documento");
    const history = await database.documentValidationHistory.findMany({ where: { documentId }, include: { changedBy: { select: { id: true, name: true } } }, orderBy: { changedAt: "asc" } });
    return { data: history };
  });

  app.get("/services/:serviceId/documents/:documentId/download", { preHandler: authenticate }, async (request, reply) => {
    const auth = requirePermission(request, "documents:read");
    const { serviceId, documentId } = documentParamsSchema.parse(request.params);
    await accessibleService(database, auth, serviceId);
    const document = await database.document.findFirst({ where: { id: documentId, serviceId, ...documentReadWhere(auth) } });
    if (!document) throw notFound("Documento");
    const bytes = await storage.read(document.storageKey);
    const filename = encodeURIComponent(document.originalName);
    return reply
      .header("content-type", document.mimeType)
      .header("content-length", String(bytes.length))
      .header("content-disposition", `attachment; filename*=UTF-8''${filename}`)
      .header("cache-control", "private, no-store")
      .send(bytes);
  });

  app.patch("/services/:serviceId/documents/:documentId/status", { preHandler: authenticate }, async (request) => {
    const auth = requirePermission(request, "documents:validate");
    if (auth.actorKind !== "transport") throw forbidden();
    const { serviceId, documentId } = documentParamsSchema.parse(request.params);
    const input = documentStatusBodySchema.parse(request.body);
    const service = await accessibleService(database, auth, serviceId);
    const current = await database.document.findFirst({ where: { id: documentId, serviceId, organizationId: auth.organizationId } });
    if (!current) throw notFound("Documento");
    if (current.status === input.status) throw conflict("DOCUMENT_STATUS_UNCHANGED", "El documento ya tiene ese estado");
    const document = await database.$transaction(async (tx) => {
      const updated = await tx.document.update({ where: { id: documentId }, data: { status: input.status }, include: documentInclude });
      await tx.documentValidationHistory.create({ data: { organizationId: auth.organizationId, documentId, changedByUserId: auth.userId, fromStatus: current.status, toStatus: input.status, reason: input.reason ?? null } });
      await tx.serviceEvent.create({ data: { organizationId: auth.organizationId, serviceId, orderId: service.orderId, type: "DOCUMENT_STATUS_CHANGED", entityType: "Document", entityId: documentId, actorUserId: auth.userId, correlationId: request.id, payload: { fromStatus: current.status, toStatus: input.status, reason: input.reason ?? null } } });
      await tx.auditLog.create({ data: { organizationId: auth.organizationId, actorUserId: auth.userId, action: "DOCUMENT_STATUS_CHANGED", entityType: "Document", entityId: documentId, requestId: request.id, metadata: { serviceId, fromStatus: current.status, toStatus: input.status, reason: input.reason ?? null } } });
      return updated;
    });
    return { data: presentDocument({ ...document, history: [...document.history, { fromStatus: current.status, toStatus: input.status, reason: input.reason, changedAt: new Date(), changedBy: { id: auth.userId, name: auth.name } }] }) };
  });

  app.get("/services/:id/pod", { preHandler: authenticate }, async (request) => {
    const auth = requirePermission(request, "pod:read");
    const { id } = idParamsSchema.parse(request.params);
    await accessibleService(database, auth, id);
    const pod = await database.proofOfDelivery.findFirst({ where: { serviceId: id, ...(auth.actorKind === "customer" ? { status: "APPROVED" as const } : {}) }, include: podInclude });
    return { data: pod ? presentPod(pod, auth.actorKind === "customer") : null };
  });

  app.patch("/services/:id/pod/status", { preHandler: authenticate }, async (request) => {
    const auth = requirePermission(request, "pod:validate");
    if (auth.actorKind !== "transport") throw forbidden();
    const { id } = idParamsSchema.parse(request.params);
    const input = podStatusBodySchema.parse(request.body);
    const service = await accessibleService(database, auth, id);
    const current = await database.proofOfDelivery.findFirst({ where: { serviceId: id, organizationId: auth.organizationId } });
    if (!current) throw notFound("POD");
    if (current.status === input.status) throw conflict("POD_STATUS_UNCHANGED", "El POD ya tiene ese estado");
    const pod = await database.$transaction(async (tx) => {
      await tx.podValidationHistory.create({ data: { organizationId: auth.organizationId, podId: current.id, changedByUserId: auth.userId, fromStatus: current.status, toStatus: input.status, reason: input.reason ?? null } });
      const evidence = await tx.document.findMany({ where: { podId: current.id }, select: { id: true, status: true } });
      const evidenceStatus = input.status === "APPROVED" ? "APPROVED" : input.status === "REJECTED" ? "REJECTED" : "IN_REVIEW";
      for (const document of evidence) {
        if (document.status === evidenceStatus) continue;
        await tx.document.update({ where: { id: document.id }, data: { status: evidenceStatus } });
        await tx.documentValidationHistory.create({ data: { organizationId: auth.organizationId, documentId: document.id, changedByUserId: auth.userId, fromStatus: document.status, toStatus: evidenceStatus, reason: input.reason ?? null } });
      }
      const updated = await tx.proofOfDelivery.update({ where: { id: current.id }, data: { status: input.status }, include: podInclude });
      await tx.serviceEvent.create({ data: { organizationId: auth.organizationId, serviceId: id, orderId: service.orderId, type: "POD_STATUS_CHANGED", entityType: "ProofOfDelivery", entityId: current.id, actorUserId: auth.userId, correlationId: request.id, payload: { fromStatus: current.status, toStatus: input.status, reason: input.reason ?? null } } });
      await tx.auditLog.create({ data: { organizationId: auth.organizationId, actorUserId: auth.userId, action: "POD_STATUS_CHANGED", entityType: "ProofOfDelivery", entityId: current.id, requestId: request.id, metadata: { serviceId: id, fromStatus: current.status, toStatus: input.status, reason: input.reason ?? null } } });
      return updated;
    });
    const notificationType = input.status === "APPROVED" ? "POD_APPROVED" : input.status === "REJECTED" ? "POD_REJECTED" : "POD_SUBMITTED";
    try {
      await database.internalNotification.upsert({ where: { organizationId_dedupeKey: { organizationId: auth.organizationId, dedupeKey: `pod:${current.id}:${input.status}` } }, update: {}, create: { organizationId: auth.organizationId, serviceId: id, type: notificationType, title: input.status === "APPROVED" ? "POD aprobado" : input.status === "REJECTED" ? "POD rechazado" : "POD en revisión", message: input.reason ?? `El POD del servicio ${id} ha cambiado a ${input.status}.`, dedupeKey: `pod:${current.id}:${input.status}` } });
      if (input.status === "APPROVED") await database.internalNotification.upsert({ where: { organizationId_dedupeKey: { organizationId: auth.organizationId, dedupeKey: `documentation-ready:${id}` } }, update: {}, create: { organizationId: auth.organizationId, serviceId: id, type: "DOCUMENTATION_READY", title: "Servicio listo para facturación", message: "La entrega está validada documentalmente. La facturación todavía requiere un proceso posterior.", dedupeKey: `documentation-ready:${id}` } });
    } catch (error) {
      request.log.error({ err: error, requestId: request.id, serviceId: id, podId: current.id }, "POD persistido pero no se pudo crear la notificación");
    }
    return { data: presentPod(pod) };
  });

  app.get("/services/:id/pod/history", { preHandler: authenticate }, async (request) => {
    const auth = requirePermission(request, "pod:read");
    const { id } = idParamsSchema.parse(request.params);
    await accessibleService(database, auth, id);
    const pod = await database.proofOfDelivery.findFirst({ where: { serviceId: id, ...(auth.actorKind === "customer" ? { status: "APPROVED" as const } : {}) }, select: { id: true } });
    if (!pod) throw notFound("POD");
    const history = await database.podValidationHistory.findMany({ where: { podId: pod.id }, include: { changedBy: { select: { id: true, name: true } } }, orderBy: { changedAt: "asc" } });
    return { data: history };
  });

  app.get("/driver/services/:id/documents", { preHandler: authenticate }, async (request) => {
    const auth = requirePermission(request, "driver:documents:read");
    if (auth.actorKind !== "driver") throw forbidden();
    const { id } = idParamsSchema.parse(request.params);
    await accessibleService(database, auth, id);
    const documents = await database.document.findMany({ where: { serviceId: id, visibility: "SHARED" }, include: documentInclude, orderBy: { uploadedAt: "desc" } });
    return { data: documents.map(presentDocument) };
  });

  app.post("/driver/services/:id/documents", { preHandler: authenticate }, async (request, reply) => {
    const auth = requirePermission(request, "driver:documents:write");
    if (auth.actorKind !== "driver") throw forbidden();
    const { id } = idParamsSchema.parse(request.params);
    const service = await accessibleService(database, auth, id);
    const { fields, files } = await parseMultipart(request, 1);
    if (files.length !== 1) throw badRequest("FILE_REQUIRED", "Debes adjuntar un archivo");
    const type = documentTypeSchema.parse(fields.type ?? "SERVICE_ATTACHMENT");
    const [stored] = await saveFiles(storage, files);
    try {
      const duplicate = await database.document.findUnique({ where: { serviceId_sha256: { serviceId: id, sha256: stored!.sha256 } } });
      if (duplicate) throw conflict("DUPLICATE_DOCUMENT", "Este archivo ya está asociado al servicio");
      const document = await database.$transaction(async (tx) => {
        const created = await tx.document.create({ data: { organizationId: auth.organizationId, serviceId: id, type, visibility: "SHARED", originalName: stored!.filename, mimeType: stored!.mimeType, sizeBytes: stored!.sizeBytes, storageKey: stored!.storageKey, sha256: stored!.sha256, status: "IN_REVIEW", uploadedByUserId: auth.userId, history: { create: { organizationId: auth.organizationId, changedByUserId: auth.userId, toStatus: "IN_REVIEW" } } }, include: documentInclude });
        await tx.serviceEvent.create({ data: { organizationId: auth.organizationId, serviceId: id, orderId: service.orderId, type: "DOCUMENT_UPLOADED", entityType: "Document", entityId: created.id, actorUserId: auth.userId, correlationId: request.id, payload: { type, visibility: "SHARED", sha256: created.sha256 } } });
        await tx.auditLog.create({ data: { organizationId: auth.organizationId, actorUserId: auth.userId, action: "DRIVER_DOCUMENT_UPLOADED", entityType: "Document", entityId: created.id, requestId: request.id, metadata: { serviceId: id, type } } });
        return created;
      });
      return reply.code(201).send({ data: presentDocument(document) });
    } catch (error) {
      await storage.delete(stored!.storageKey);
      throw error;
    }
  });

  app.get("/driver/services/:id/pod", { preHandler: authenticate }, async (request) => {
    const auth = requirePermission(request, "driver:documents:read");
    if (auth.actorKind !== "driver") throw forbidden();
    const { id } = idParamsSchema.parse(request.params);
    await accessibleService(database, auth, id);
    const pod = await database.proofOfDelivery.findFirst({ where: { serviceId: id, driverId: auth.driverId ?? "__none__" }, include: podInclude });
    return { data: pod ? presentPod(pod) : null };
  });

  app.post("/driver/services/:id/pod", { preHandler: authenticate }, async (request, reply) => {
    const auth = requirePermission(request, "driver:pod:submit");
    if (auth.actorKind !== "driver" || !auth.driverId) throw forbidden();
    const { id } = idParamsSchema.parse(request.params);
    const service = await accessibleService(database, auth, id);
    const { fields, files } = await parseMultipart(request, 4);
    if (!files.length) throw badRequest("POD_EVIDENCE_REQUIRED", "Debes adjuntar al menos una fotografía o justificante");
    const input = podFieldsSchema.parse(fields);
    const existing = await database.proofOfDelivery.findUnique({ where: { serviceId: id } });
    if (existing && existing.status !== "REJECTED")
      throw conflict("POD_ALREADY_SUBMITTED", "El POD ya se ha enviado para este servicio");
    const stored = await saveFiles(storage, files);
    const temporaryKeys = new Set(stored.map((file) => file.storageKey));
    try {
      const pod = await database.$transaction(async (tx) => {
        const podRecord = existing
          ? await tx.proofOfDelivery.update({ where: { id: existing.id }, data: { deliveredAt: input.deliveredAt, receiverName: input.receiverName || null, observations: input.observations || null, status: "SUBMITTED", serverSubmittedAt: new Date(), submittedByUserId: auth.userId } })
          : await tx.proofOfDelivery.create({ data: { organizationId: auth.organizationId, serviceId: id, driverId: auth.driverId!, submittedByUserId: auth.userId, deliveredAt: input.deliveredAt, receiverName: input.receiverName || null, observations: input.observations || null, status: "SUBMITTED", verificationCode: randomBytes(16).toString("hex") } });
        await tx.podValidationHistory.create({ data: { organizationId: auth.organizationId, podId: podRecord.id, changedByUserId: auth.userId, fromStatus: existing?.status ?? null, toStatus: "SUBMITTED", reason: existing ? "Reenvío tras rechazo" : null } });
        for (const file of stored) {
          const duplicate = await tx.document.findUnique({ where: { serviceId_sha256: { serviceId: id, sha256: file.sha256 } } });
          if (duplicate) {
            if (duplicate.podId && duplicate.podId !== podRecord.id) throw conflict("DUPLICATE_DOCUMENT", "Una evidencia ya está asociada a otro POD del servicio");
            await tx.document.update({ where: { id: duplicate.id }, data: { podId: podRecord.id, status: "IN_REVIEW" } });
            await tx.documentValidationHistory.create({ data: { organizationId: auth.organizationId, documentId: duplicate.id, changedByUserId: auth.userId, fromStatus: duplicate.status, toStatus: "IN_REVIEW", reason: "Evidencia asociada al POD" } });
          } else {
            await tx.document.create({ data: { organizationId: auth.organizationId, serviceId: id, podId: podRecord.id, type: file.mimeType === "application/pdf" ? "POD" : "DELIVERY_PHOTO", visibility: "SHARED", originalName: file.filename, mimeType: file.mimeType, sizeBytes: file.sizeBytes, storageKey: file.storageKey, sha256: file.sha256, status: "IN_REVIEW", uploadedByUserId: auth.userId, history: { create: { organizationId: auth.organizationId, changedByUserId: auth.userId, toStatus: "IN_REVIEW" } } } });
            temporaryKeys.delete(file.storageKey);
          }
        }
        await tx.serviceEvent.create({ data: { organizationId: auth.organizationId, serviceId: id, orderId: service.orderId, type: "POD_SUBMITTED", entityType: "ProofOfDelivery", entityId: podRecord.id, actorUserId: auth.userId, correlationId: request.id, payload: { evidenceCount: stored.length, deliveredAt: input.deliveredAt.toISOString() } } });
        await tx.auditLog.create({ data: { organizationId: auth.organizationId, actorUserId: auth.userId, action: "POD_SUBMITTED", entityType: "ProofOfDelivery", entityId: podRecord.id, requestId: request.id, metadata: { serviceId: id, evidenceCount: stored.length } } });
        return tx.proofOfDelivery.findUniqueOrThrow({ where: { id: podRecord.id }, include: podInclude });
      });
      try {
        await database.internalNotification.upsert({ where: { organizationId_dedupeKey: { organizationId: auth.organizationId, dedupeKey: `pod:${pod.id}:SUBMITTED` } }, update: {}, create: { organizationId: auth.organizationId, serviceId: id, type: "POD_SUBMITTED", title: "Nuevo POD pendiente de revisión", message: `El conductor ha enviado la prueba de entrega del servicio ${service.orderId}.`, dedupeKey: `pod:${pod.id}:SUBMITTED` } });
      } catch (error) {
        request.log.error({ err: error, requestId: request.id, serviceId: id, podId: pod.id }, "POD persistido pero no se pudo crear la notificación");
      }
      await Promise.all([...temporaryKeys].map((storageKey) => storage.delete(storageKey)));
      return reply.code(201).send({ data: presentPod(pod) });
    } catch (error) {
      await Promise.all([...temporaryKeys].map((storageKey) => storage.delete(storageKey)));
      throw error;
    }
  });
}
