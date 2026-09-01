/**
 * PUBLIC ImgBB configuration — the single place image-service settings live.
 *
 * The PRIVATE ImgBB API key is NOT here and never can be: it is a server
 * secret, resolved exclusively server-side (server/config.ts reads it from
 * the Cloudflare Worker secret store in production, or the process
 * environment for local dev). The browser only ever talks to /api/media,
 * which performs the upload with the server-held key.
 */
export const IMGBB_PUBLIC_CONFIG = {
  /** Hard upload ceiling enforced by the API gateway (bytes). */
  uploadMaxBytes: 8 * 1024 * 1024,
  /** Client-side pre-upload compression (keeps payloads small and fast). */
  compression: {
    maxDimension: 1600,
    quality: 0.85,
    mimeType: "image/jpeg",
  },
} as const;
