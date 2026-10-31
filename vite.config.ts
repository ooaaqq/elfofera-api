import { defineConfig } from "vite";

const statusBackend = process.env.STATUS_BACKEND_URL;
export default defineConfig({
  server: {
    proxy: statusBackend
      ? {
          "/status-api": {
            target: statusBackend,
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/status-api/, "/api/v1"),
          },
        }
      : {},
  },
  build: { target: "es2022", cssCodeSplit: false },
});
