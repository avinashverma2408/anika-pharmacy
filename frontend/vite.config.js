import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2020",
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (id.includes("react-dom") || id.includes("/react/")) {
            return "vendor-react";
          }
          if (id.includes("axios") || id.includes("zustand")) {
            return "vendor-data";
          }
          if (
            id.includes("jspdf") ||
            id.includes("html2canvas") ||
            id.includes("html2pdf")
          ) {
            return "vendor-pdf";
          }
        },
      },
    },
  },
  server: {
    fs: {
      allow: [".", "../shared"],
    },
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom", "axios", "zustand"],
  },
});
