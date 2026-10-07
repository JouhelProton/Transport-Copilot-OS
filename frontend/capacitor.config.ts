import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.transportcopilot.driver",
  appName: "Transport Copilot Driver",
  webDir: ".output/public",
  loggingBehavior: "debug",
  plugins: {
    SystemBars: {
      insetsHandling: "css",
      style: "LIGHT",
      hidden: false,
      animation: "FADE",
    },
  },
};

export default config;
