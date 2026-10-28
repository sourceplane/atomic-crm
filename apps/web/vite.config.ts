import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import createHtmlPlugin from "vite-plugin-simple-html";
import { supabaseBuildEnv } from "./build-env.ts";

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  // A build inlines the Supabase project it is for (build-env.ts); the dev
  // server reads .env.development / .env.local as upstream's does.
  const supabase =
    command === "build"
      ? supabaseBuildEnv(process.env, path.join(__dirname, "wrangler.jsonc"))
      : {};
  return {
    server: {
      port: 5173,
      host: true,
      // The edge functions are the Worker's routes: `pnpm dev:worker` serves
      // them (wrangler dev, port 8787) beside the Vite dev server.
      proxy: { "/functions": "http://127.0.0.1:8787" },
    },
    plugins: [
      react(),
      tailwindcss(),
      createHtmlPlugin({
        minify: true,
        inject: {
          data: {
            mainScript: `src/main.tsx`,
          },
        },
      }),
      VitePWA({
        registerType: "autoUpdate",
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB
          // The Worker's routes are never the app shell.
          navigateFallbackDenylist: [/^\/functions\//, /^\/api\//],
        },
        manifest: false, // Use existing manifest.json from public/
      }),
    ],
    define: Object.fromEntries(
      Object.entries({
        ...supabase,
        VITE_IS_DEMO: process.env.VITE_IS_DEMO,
        VITE_INBOUND_EMAIL: process.env.VITE_INBOUND_EMAIL,
        VITE_ATTACHMENTS_BUCKET: process.env.VITE_ATTACHMENTS_BUCKET,
      })
        .filter(([, value]) => command === "build" && value !== undefined)
        .map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
    ),
    base: "./",
    build: {
      rolldownOptions: {
        output: {
          keepNames: true,
        },
      },
      sourcemap: true,
    },
    resolve: {
      // Upstream preserves symlinks (an npm tree, where it changes nothing);
      // under pnpm a package's dependencies sit beside its real path, so the
      // real path is what resolves.
      preserveSymlinks: false,
      dedupe: ["react-router", "react-router-dom"],
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
