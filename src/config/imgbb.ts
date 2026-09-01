/**
 * ImgBB configuration — THE central place (edit the key here).
 *
 *   • IMGBB_SERVER holds everything server-only: the PRIVATE API key and
 *     the ImgBB upload endpoint. Only server-side code may import this
 *     file: server/config.ts resolves the key for the /api/media gateway,
 *     with an optional IMGBB_API_KEY environment override for rotation
 *     without a code change.
 *   • Browser-safe settings (upload ceiling, compression) live in
 *     `./imgbb.public.ts` and are re-exported here so this file remains the
 *     single ImgBB reference. Client code imports them from
 *     `../config/imgbb.public` — NEVER from this file, so the key can never
 *     enter the client bundle.
 */
import { IMGBB_PUBLIC_CONFIG } from "./imgbb.public.ts";

export { IMGBB_PUBLIC_CONFIG };

export const IMGBB_SERVER = {
  apiKey: "8a5458f04438f111f2150bb73ee7499d",
  uploadEndpoint: "https://api.imgbb.com/1/upload",
} as const;
