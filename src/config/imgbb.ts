/**
 * PUBLIC image settings — the client-safe ImgBB configuration.
 *
 * Only browser-side concerns live here (pre-upload downscaling). The
 * PRIVATE ImgBB API key, the upload endpoint and the server-enforced
 * upload ceiling live exclusively in server/config/imgbb.ts — the one
 * central server-side file /api/media resolves them from — so no client
 * path can ever reach the key.
 */
export const IMGBB_PUBLIC_CONFIG = {
  /** Client-side pre-upload downscaling (keeps payloads small and fast). */
  compression: {
    maxDimension: 1600,
    quality: 0.85,
    mimeType: "image/jpeg",
  },
} as const;
