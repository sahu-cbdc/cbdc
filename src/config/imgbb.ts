/**
 * ImgBB configuration — the ONE central file (client + server).
 *
 *   • IMGBB_PUBLIC_CONFIG — used by the browser (pre-upload compression).
 *   • IMGBB_API_KEY / IMGBB_UPLOAD_ENDPOINT / IMGBB_UPLOAD_MAX_BYTES —
 *     SERVER-ONLY exports. No browser code imports them, so Vite
 *     tree-shakes them out of dist/ and they reach only the Worker bundle.
 *     IMPORTANT: client files must never reference IMGBB_API_KEY.
 *
 * Key rotation without a code change: set the IMGBB_API_KEY Worker secret —
 * it overrides the key below (server/config.ts).
 */
export const IMGBB_PUBLIC_CONFIG = {
  /** Pre-upload downscaling applied in the browser before POST /api/media. */
  compression: {
    maxDimension: 1600,
    quality: 0.85,
    mimeType: "image/jpeg",
  },
} as const;

/** SERVER-ONLY — never import this from browser code. */
export const IMGBB_API_KEY = "3c3dc9b98e063feb28ce6e1931582d51";

/** SERVER-ONLY — the upstream ImgBB URL used by the /api/media gateway. */
export const IMGBB_UPLOAD_ENDPOINT = "https://api.imgbb.com/1/upload";

/** SERVER-ONLY — hard upload ceiling (bytes) enforced by the /api/media gateway. */
export const IMGBB_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
