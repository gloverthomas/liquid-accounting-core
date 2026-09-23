import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const bffToken = process.env.LIQUID_BFF_DEMO_TOKEN;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        headers: bffToken ? { Authorization: `Bearer ${bffToken}` } : {},
      },
    },
  },
});
