import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
//
// `base: "/"` — absolute asset paths are required for SPA deep links.
// Cloudflare/Firebase rewrites `/doner/req`, `/admin/...` etc. to `index.html`;
// if assets are emitted as `./assets/...`, a browser refresh from `/doner/req`
// tries to load `/doner/req/assets/...` and the app never boots. Root-relative
// assets always load from `/assets/...` on the deployed root domain.
//
// Single-page build — শুধুমাত্র index.html। সব পেজ (Home / Doner / Admin /
// Moderator) .tsx কম্পোনেন্ট হিসেবে একই entry থেকে বুট হয়
// (src/main.tsx + src/lib/router.ts)। প্যানেলগুলো lazy-loaded chunk হিসেবে আসে।
export default defineConfig({
  plugins: [react()],
  base: "/",
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
