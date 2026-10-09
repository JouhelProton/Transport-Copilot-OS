import { routeParam } from "@/lib/route-params";

describe("Expo Router service parameters", () => {
  test("normalizes string and array parameters without changing the real id", () => {
    expect(routeParam("svc_nv_24081_real")).toBe("svc_nv_24081_real");
    expect(routeParam(["svc_nv_24081_real"])).toBe("svc_nv_24081_real");
    expect(routeParam(undefined)).toBeUndefined();
  });
});
