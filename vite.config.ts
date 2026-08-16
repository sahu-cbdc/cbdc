import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
//
// `base: "./"` — relative asset paths, so the built `dist/` runs from ANY
// static hosting site (GitHub Pages, Netlify, Vercel, shared cPanel, Apache,
// Nginx, S3, Cloudflare Workers/Pages, Firebase Hosting, ...) even when served
// from a sub-directory.
//
// Single-page build — শুধুমাত্র index.html। সব পেজ (Home / Doner / Admin /
// Moderator) .tsx কম্পোনেন্ট হিসেবে একই entry থেকে বুট হয়
// (src/main.tsx + src/lib/router.ts)। প্যানেলগুলো lazy-loaded chunk হিসেবে আসে।
export default defineConfig({
  plugins: [react()],
  base: "./",
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
