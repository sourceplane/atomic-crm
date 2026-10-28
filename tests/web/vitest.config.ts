import path from "node:path";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const app = path.resolve(__dirname, "../../apps/web");

// Two projects, as upstream's vitest.config.ts has (its "app" and "functions"):
//   - "app":    upstream's React/DOM tests and the Storybook stories they
//               render (src/upstream, mirroring apps/web/src), in a real
//               browser — Playwright's Chromium headless shell.
//   - "worker": the Worker — upstream's edge-function tests (src/functions)
//               and the port's own (the routes, the wiring, the build env),
//               in Node, `cloudflare:workers` stood in for (src/stubs).
export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        optimizeDeps: { exclude: ["playwright", "playwright-core"] },
        resolve: {
          dedupe: ["react", "react-dom", "react-router", "ra-core", "@tanstack/react-query"],
          alias: [
            { find: /^@\/test\/(.*)$/, replacement: path.resolve(__dirname, "src/upstream/test/$1") },
            { find: /^@\/(.*)$/, replacement: `${app}/src/$1` },
          ],
        },
        test: {
          name: "app",
          globals: true,
          include: ["src/upstream/**/*.test.{ts,tsx}"],
          browser: {
            headless: true,
            provider: playwright(),
            enabled: true,
            // Headless Chromium is Playwright's headless shell, which `pnpm test`
            // installs (as upstream's CI does).
            instances: [{ browser: "chromium" }],
            commands: {
              // Uses Chrome DevTools Protocol to override the timezone at runtime,
              // since process.env.TZ has no effect in a real browser environment.
              async setTimezone({ context, page }, timezoneId: string) {
                const session = await context.newCDPSession(page);
                await session.send("Emulation.setTimezoneOverride", { timezoneId });
                await session.detach();
              },
            },
          },
          server: { deps: { external: [/playwright/] } },
        },
      },
      {
        resolve: {
          alias: [
            { find: "cloudflare:workers", replacement: path.resolve(__dirname, "src/stubs/cloudflare-workers.ts") },
            { find: /^@worker\/(.*)$/, replacement: `${app}/worker/$1` },
            { find: /^@app\/(.*)$/, replacement: `${app}/$1` },
            { find: /^@\/(.*)$/, replacement: `${app}/src/$1` },
          ],
        },
        test: {
          name: "worker",
          globals: true,
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: ["src/upstream/**", "**/node_modules/**"],
          env: {
            SUPABASE_URL: "http://127.0.0.1:54321",
            SB_PUBLISHABLE_KEY: "sb_publishable_test",
            SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
          },
        },
      },
    ],
  },
});
