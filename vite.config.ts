import type { IncomingMessage, ServerResponse } from "node:http";
import { copyFileSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { handleApi } from "./server/router.ts";

function githubPagesFallback(): Plugin {
  return {
    name: "github-pages-fallback",
    apply: "build",
    closeBundle() {
      copyFileSync("dist/index.html", "dist/404.html");
    },
  };
}

function riskApi(): Plugin {
  const attach = (server: { middlewares: { use: (handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void } }) => {
    server.middlewares.use((req, res, next) => {
      void handleApi(req, res).then((handled) => {
        if (!handled) next();
      }).catch(() => {
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ error: "The scan service failed." }));
        }
      });
    });
  };
  return {
    name: "risk-api",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

export default defineConfig({
  base: "/Scanner/",
  build: {
    rollupOptions: {
      input: {
        main: resolve("index.html"),
        risk: resolve("risk/index.html"),
      },
    },
  },
  plugins: [react(), riskApi(), githubPagesFallback()],
});
