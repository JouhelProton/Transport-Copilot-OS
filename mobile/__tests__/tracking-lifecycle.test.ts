import { backgroundRecoveryProblem, decideTrackingMode, shouldInvalidateForFailure } from "@/tracking/lifecycle";

describe("background tracking lifecycle policy", () => {
  test("keeps Expo Go in its explicit foreground compatibility mode", () => {
    expect(decideTrackingMode({ expoGo: true, taskManagerAvailable: false, backgroundPermissionGranted: false })).toEqual({ mode: "FOREGROUND_EXPO_GO", reason: null });
  });

  test("requires TaskManager in a native development build", () => {
    expect(decideTrackingMode({ expoGo: false, taskManagerAvailable: false, backgroundPermissionGranted: true }).reason).toBe("BACKGROUND_UNAVAILABLE");
  });

  test("does not claim active background tracking without Always permission", () => {
    expect(decideTrackingMode({ expoGo: false, taskManagerAvailable: true, backgroundPermissionGranted: false }).reason).toBe("PERMISSION_DENIED");
  });

  test("selects background mode only when native capability and permission are ready", () => {
    expect(decideTrackingMode({ expoGo: false, taskManagerAvailable: true, backgroundPermissionGranted: true }).mode).toBe("BACKGROUND");
  });

  test("detects revoked permission on application recovery", () => {
    expect(backgroundRecoveryProblem({ mode: "BACKGROUND", permissionGranted: false, taskRegistered: true })).toBe("BACKGROUND_PERMISSION_REVOKED");
  });

  test("detects an interrupted native task on application recovery", () => {
    expect(backgroundRecoveryProblem({ mode: "BACKGROUND", permissionGranted: true, taskRegistered: false })).toBe("NATIVE_TASK_INTERRUPTED");
  });

  test("accepts a registered and authorized background task after reopening", () => {
    expect(backgroundRecoveryProblem({ mode: "BACKGROUND", permissionGranted: true, taskRegistered: true })).toBeNull();
  });

  test("invalidates tracking for authentication, authorization and ended sessions", () => {
    expect(shouldInvalidateForFailure("AUTHENTICATION")).toBe(true);
    expect(shouldInvalidateForFailure("AUTHORIZATION")).toBe(true);
    expect(shouldInvalidateForFailure("SESSION_EXPIRED")).toBe(true);
    expect(shouldInvalidateForFailure("TEMPORARY")).toBe(false);
  });
});
