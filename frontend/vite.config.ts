// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const mobileBuild = process.argv.includes("mobile");
const iphonePreview = process.env.IPHONE_PREVIEW === "true";
const iphoneBackendUrl = process.env.IPHONE_BACKEND_URL || "http://127.0.0.1:3001";
const iphoneProxyOrigin = process.env.IPHONE_PROXY_ORIGIN || "http://127.0.0.1:4176";

export default defineConfig({
  vite: {
    server: {
      // The iPhone preview keeps the API private and forwards only /api over the
      // same HTTPS origin that Safari uses. The backend still validates this
      // exact local proxy origin; credentials never require wildcard CORS.
      proxy: {
        "/api": {
          target: iphoneBackendUrl,
          changeOrigin: true,
          headers: { origin: iphoneProxyOrigin },
        },
      },
      ...(iphonePreview
        ? {
            allowedHosts: [".trycloudflare.com"],
            hmr: false,
          }
        : {}),
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    ...(mobileBuild
      ? {
          spa: {
            enabled: true,
            prerender: { outputPath: "/index.html" },
          },
        }
      : {}),
  },
});
