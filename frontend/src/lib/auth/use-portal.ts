import { useDemoState } from "@/lib/domain/demo-backend";
import { carrierServices, customerServices, driverServices } from "@/lib/domain/projections";
import { useSession, type Session } from "./session";

export function usePortalSession(): Session {
  const s = useSession();
  if (!s) throw new Error("Sesión no disponible");
  return s;
}
export function useCustomerServices() {
  const s = usePortalSession();
  return useDemoState((st) => customerServices(st, s));
}
export function useCarrierServices() {
  const s = usePortalSession();
  return useDemoState((st) => carrierServices(st, s));
}
export function useDriverServices() {
  const s = usePortalSession();
  return useDemoState((st) => driverServices(st, s));
}
