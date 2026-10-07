import { describe, expect, it } from "vitest";
import { authTransport } from "@/lib/platform/auth-transport";

describe("web auth transport", () => {
  it("includes credentials during unauthenticated web login", () => {
    expect(authTransport.unauthenticatedInit({ method: "POST" })).toMatchObject({
      method: "POST",
      credentials: "include",
    });
  });
});
