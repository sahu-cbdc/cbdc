/**
 * Public ImgBB settings for the browser bundle.
 *
 * ONLY client-side image compression lives here. The API key, the upload
 * endpoint and the upload size ceiling are server-side concerns and live
 * exclusively in the server-side config, never in the client bundle.
 */
export const IMGBB_PUBLIC_CONFIG = {
  /** Pre-upload downscaling applied in the browser before POST /api/media. */
  compression: {
    maxDimension: 1600,
    quality: 0.85,
    mimeType: "image/jpeg",
  },
} as const;
