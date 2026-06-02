import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // cho phép listen từ mọi IP
    port: 5173, // Đổi port để tránh cache
    allowedHosts: ["fhk-dev.quant-nexus.com", "aitranslate.torayhk.com", "multilanguage_translator_fe"], // cho phép domain truy cập
  },
  define: {
    global: "globalThis", // Fix for amazon-cognito-identity-js
  },
  optimizeDeps: {
    include: ["amazon-cognito-identity-js"],
  },
});
