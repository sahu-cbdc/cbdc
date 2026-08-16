import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// https://vitejs.dev/config/
//
// `base: "./"` — relative asset paths, so the built `dist/` runs from ANY
// static hosting site (GitHub Pages, Netlify, Vercel, shared cPanel, Apache,
// Nginx, S3, ...) even when served from a sub-directory.
//
// Multi-page build — index.html / doner.html / admin.html / moderator.html
// are real files, so no server-side rewrites (SPA fallback) are needed.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), "index.html"),
        doner: resolve(process.cwd(), "doner.html"),
        admin: resolve(process.cwd(), "admin.html"),
        moderator: resolve(process.cwd(), "moderator.html"),
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: false,
    // Preview environment proxies traffic under a generated e2b host.
    allowedHosts: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    allowedHosts: true,
  },
});
