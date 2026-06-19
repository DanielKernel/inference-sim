import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During development the React app proxies /api to the Go apiserver on :8080.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8080",
    },
  },
});
