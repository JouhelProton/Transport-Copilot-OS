import { z } from "zod";

export const assignServiceSchema = z.object({
  driverId: z.string().min(1),
  vehicleId: z.string().min(1),
});
