import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  publicDir: "public/assets",
  server: {
    proxy: {
      "/ollama": {
        target: "http://localhost:11434",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ollama/, ""),
        configure: (proxy, _options) => {
          proxy.on("proxyReq", (proxyReq, req, _res) => {
            try {
              // Strip SuperTokens headers that can trigger preflight/CORS at Ollama
              proxyReq.removeHeader?.("st-auth-mode");
              proxyReq.removeHeader?.("anti-csrf");
              proxyReq.removeHeader?.("rid");
            } catch {}
          });
        },
      },
    },
  },
});
