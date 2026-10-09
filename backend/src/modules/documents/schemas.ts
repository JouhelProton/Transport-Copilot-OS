import { z } from "zod";

export const documentTypeSchema = z.enum([
  "DELIVERY_NOTE",
  "CMR",
  "POD",
  "DELIVERY_PHOTO",
  "SERVICE_ATTACHMENT",
]);
export const documentVisibilitySchema = z.enum(["SHARED", "INTERNAL"]);
export const documentStatusSchema = z.enum(["IN_REVIEW", "APPROVED", "REJECTED"]);
export const podStatusSchema = z.enum(["IN_REVIEW", "APPROVED", "REJECTED"]);

export const documentParamsSchema = z.object({
  serviceId: z.string().min(1),
  documentId: z.string().min(1),
});

export const documentStatusBodySchema = z
  .object({
    status: documentStatusSchema,
    reason: z.string().trim().min(3).max(500).optional(),
  })
  .superRefine((value, context) => {
    if (value.status === "REJECTED" && !value.reason)
      context.addIssue({ code: "custom", path: ["reason"], message: "El rechazo requiere un motivo" });
  });

export const podStatusBodySchema = z
  .object({
    status: podStatusSchema,
    reason: z.string().trim().min(3).max(500).optional(),
  })
  .superRefine((value, context) => {
    if (value.status === "REJECTED" && !value.reason)
      context.addIssue({ code: "custom", path: ["reason"], message: "El rechazo requiere un motivo" });
  });

export const podFieldsSchema = z.object({
  deliveredAt: z.coerce.date().refine((value) => value <= new Date(), "La entrega no puede estar en el futuro"),
  receiverName: z.string().trim().max(160).optional(),
  observations: z.string().trim().max(2_000).optional(),
});
