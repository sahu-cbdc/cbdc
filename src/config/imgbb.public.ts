/**
 * PUBLIC ImgBB settings — the client-safe half of the ImgBB configuration.
 *
 * Everything here is safe to bundle. The private API key and the server
 * upload endpoint live in `src/config/imgbb.ts` (the central ImgBB config),
 * which ONLY server-side code may import — importing it from browser code
 * would put the key in the production bundle.
 */
export const IMGBB_PUBLIC_CONFIG = {
  /** Hard upload ceiling enforced by the /api/media gateway (bytes). */
  uploadMaxBytes: 8 * 1024 * 1024,
  /** Client-side pre-upload compression (keeps payloads small and fast). */
  compression: {
    maxDimension: 1600,
    quality: 0.85,
    mimeType: "image/jpeg",
  },
} as const;
