import { z } from "zod";

const locationSchema = z.object({
  name: z.string().trim().min(2).max(160),
  address: z.string().trim().min(3).max(300),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const createOrderSchema = z
  .object({
    carrierOrganizationId: z.string().min(1),
    customerId: z.string().min(1).optional(),
    reference: z.string().trim().min(2).max(80),
    origin: locationSchema,
    destination: locationSchema,
    cargo: z.string().trim().min(2).max(300),
    pallets: z.number().int().min(1).max(1000),
    tempMin: z.number().min(-100).max(100).optional(),
    tempMax: z.number().min(-100).max(100).optional(),
    plannedPickup: z.iso.datetime(),
    plannedDelivery: z.iso.datetime(),
  })
  .superRefine((value, context) => {
    if (new Date(value.plannedDelivery) <= new Date(value.plannedPickup))
      context.addIssue({
        code: "custom",
        path: ["plannedDelivery"],
        message: "La entrega debe ser posterior a la recogida",
      });
    if (
      value.tempMin !== undefined &&
      value.tempMax !== undefined &&
      value.tempMax < value.tempMin
    )
      context.addIssue({
        code: "custom",
        path: ["tempMax"],
        message: "La temperatura máxima no puede ser inferior a la mínima",
      });
  });

export const idParamsSchema = z.object({ id: z.string().min(1) });
