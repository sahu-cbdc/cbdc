/**
<<<<<<< HEAD
 * Public ImgBB settings for the browser bundle.
 *
 * ONLY client-side image compression lives here. The API key, the upload
 * endpoint and the upload size ceiling are server-side concerns and live
 * exclusively in the server-side config, never in the client bundle.
 */
export const IMGBB_PUBLIC_CONFIG = {
  /** Pre-upload downscaling applied in the browser before POST /api/media. */
=======
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
>>>>>>> 69f665ef3c08d211cb53736a98d026fb8416fdf2
  compression: {
    maxDimension: 1600,
    quality: 0.85,
    mimeType: "image/jpeg",
  },
} as const;
