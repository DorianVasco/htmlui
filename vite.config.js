import { defineConfig } from "vite";
import { coverageConfigDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import eslint from "vite-plugin-eslint";

// Dev only: serve the new UI (app.html) for /ui and /ui/*, so deep links and
// reloads work. The old UI keeps the root paths; the production build is unchanged.
const newUiDevServer = {
  name: "new-ui-dev-server",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const path = (req.url || "").split("?")[0];
      const accept = req.headers.accept || "";
      if ((path === "/ui" || path.startsWith("/ui/")) && accept.includes("text/html")) {
        req.url = "/app.html";
      }
      next();
    });
  },
};

export default defineConfig(() => {
  return {
    build: {
      outDir: "build",
      chunkSizeWarningLimit: 1000,
    },
    plugins: [react(), eslint(), newUiDevServer],
    test: {
      globals: true,
      environment: "jsdom",
      coverage: {
        exclude: ["**/build/**", ...coverageConfigDefaults.exclude],
      },
    },
    server: {
      port: 3000,
      host: "localhost",
      https: false,
      strictPort: true,
      open: true,
      proxy: {
        "/api": {
          target: "http://localhost:51515",
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
