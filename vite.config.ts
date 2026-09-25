import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const bffToken = env.LIQUID_BFF_DEMO_TOKEN || process.env.LIQUID_BFF_DEMO_TOKEN;

  return {
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
  };
});
