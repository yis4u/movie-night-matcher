import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  base: "/movie-night-matcher/",
  plugins: [react()],
  build: { chunkSizeWarningLimit: 700 },
});
