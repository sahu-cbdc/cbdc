/**
 * ImgBB configuration — THE one central, server-side-only file.
 *
 * Put the ImgBB API key here; the /api/media gateway resolves it
 * exclusively from this module (with an optional IMGBB_API_KEY environment
 * override for rotation without a code change). No client path can reach
 * this file, so the key can never enter the browser bundle, a page, or
 * src/config — browsers upload through /api/media only.
 */
export const IMGBB_API_KEY = "3c3dc9b98e063feb28ce6e1931582d51";

export const IMGBB_UPLOAD_ENDPOINT = "https://api.imgbb.com/1/upload";

/** Hard upload ceiling enforced by the /api/media gateway (bytes). */
export const IMGBB_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
