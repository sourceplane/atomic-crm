import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import createHtmlPlugin from "vite-plugin-simple-html";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 5174,
    host: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    createHtmlPlugin({
      minify: true,
      inject: {
        data: {
          mainScript: `demo/main.tsx`,
        },
      },
    }),
  ],
  define: {
    "import.meta.env.VITE_IS_DEMO": JSON.stringify("true"),
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
      process.env.VITE_SUPABASE_URL ?? "https://demo.example.org",
    ),
    "import.meta.env.VITE_SB_PUBLISHABLE_KEY": JSON.stringify(
      process.env.VITE_SB_PUBLISHABLE_KEY ?? "https://demo.example.org",
    ),
  },
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
    preserveSymlinks: false,
    dedupe: ["react-router", "react-router-dom"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
