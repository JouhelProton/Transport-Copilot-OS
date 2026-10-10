import app from "../app.json";
import pkg from "../package.json";
import eas from "../eas.json";

describe("v0.6.5 background location configuration", () => {
  test("declares the iOS location background mode", () => {
    expect(app.expo.ios.infoPlist.UIBackgroundModes).toContain("location");
  });

  test("declares foreground and always permission explanations", () => {
    const plugin = app.expo.plugins.find((entry: unknown) => Array.isArray(entry) && entry[0] === "expo-location") as [string, { locationWhenInUsePermission: string; locationAlwaysAndWhenInUsePermission: string }] | undefined;
    expect(plugin?.[1].locationWhenInUsePermission).toContain("servicio");
    expect(plugin?.[1].locationAlwaysAndWhenInUsePermission).toContain("segundo plano");
  });

  test("uses SDK-compatible task manager and development client", () => {
    expect(pkg.dependencies["expo-task-manager"]).toBe("~57.0.21");
    expect(pkg.dependencies["expo-dev-client"]).toBe("~57.0.19");
  });

  test("defines a development client profile without triggering a build", () => {
    expect(eas.build.development.developmentClient).toBe(true);
    expect(eas.build.development.distribution).toBe("internal");
  });
});
