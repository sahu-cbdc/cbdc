/**
 * CBDC — Secure server-side image upload (ImgBB proxy)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  সমস্যা: আগে browser সরাসরি ImgBB-তে আপলোড করত — তাই ImgBB API key
 *  (`VITE_IMGBB_API_KEY`) client bundle-এ ও public RTDB `settings/imgbb`
 *  node-এ থাকত। যেকোনো visitor সেই key পড়ে upload quota/account ব্যবহার করতে
 *  পারত। এটা একটি **private API secret leak**।
 *
 *  সমাধান: আপলোড এখন **শুধুই server** করে।
 *   • Browser শুধু `POST <base>api/images/upload`-এ authenticated অনুরোধ পাঠায়
 *     (যাজ্ঞা: `Authorization: Bearer <Firebase ID token>` + raw image bytes),
 *   • Server caller-এর ID token যাচাই করে (Identity Toolkit),
 *   • তারপর **server-side secret** (`IMGBB_API_KEY` env, অথবা privileged RTDB
 *     `settings/imgbb` read — service-account token) দিয়ে ImgBB-তে আপলোড করে,
 *   • শুধু প্রাপ্ত URL/metadata ফেরত দেয় — key কখনোই browser-এ যায় না।
 *
 *  মডিউলটি pure (I/O injected) — `ImagesIo` inject করে যেকোনো পরিবেশে (Worker,
 *  dev middleware, verification harness) একই logic চালানো যায়।
 */

import { ApiError } from "./deleteApi.ts";

/** I/O seam — Worker/dev-middleware/পরীক্ষা সবাই নিজের fetch দিয়ে inject করে। */
export type ImagesIo = {
  /** Firebase ID token যাচাই → { uid }; invalid হলে null। */
  verifyToken(idToken: string): Promise<{ uid: string } | null>;
  /** Server-side ImgBB API key — ক্লায়েন্টকে কখনো দেওয়া হয় না। */
  getImgbbKey(): Promise<string>;
};

export type ImageUploadResult = {
  ok: boolean;
  url: string;
  thumbUrl: string;
  deleteUrl: string;
  width: number;
  height: number;
};

const IMGBB_URL = "https://api.imgbb.com/1/upload";
/** ৮ MB — ছবির সর্বোচ্চ আকার; এর বড় ফাইল বাদ। */
const MAX_BYTES = 8 * 1024 * 1024;
/** সর্বোচ্চ MIME-length (জাল/দীর্ঘ header প্রতিরোধ)। */
const MAX_MIME_LEN = 80;

/** ছবির filename নিরাপদ করা — path-traversal/নিয়ন্ত্রণ-অক্ষর বাদ। */
function safeFilename(value: unknown): string {
  const s = String(value || "image.jpg")
    .replace(/[\u0000-\u001f\u007f\\/]+/g, "")
    .trim();
  if (!s) return "image.jpg";
  return s.length > 120 ? s.slice(-120) : s;
}

/**
 * Secure image upload handler।
 *
 * @param input  `{ idToken }` — Authorization header থেকে আসা token।
 * @param bytes  raw image bytes (browser `fetch` body)।
 * @param mime   Image MIME type (headers থেকে; খালি হলে JPEG ধরা হয়)।
 * @param filename  Client-পাঠানো filename (X-Filename header; ঐচ্ছিক)।
 * @param io     I/O seam।
 */
export async function handleImageUpload(
  input: { idToken?: string } | null | undefined,
  bytes: Uint8Array,
  mime: string,
  filename: string,
  io: ImagesIo,
  fetchImpl: typeof fetch = fetch,
): Promise<ImageUploadResult> {
  const idToken = String(input?.idToken ?? "").trim();
  if (!idToken) throw new ApiError(401, "অনুমোদন প্রয়োজন — লগইন করে আবার চেষ্টা করুন।");

  const caller = await io.verifyToken(idToken).catch(() => null);
  if (!caller || !caller.uid) {
    throw new ApiError(401, "টোকেন যাচাই ব্যর্থ হয়েছে — আবার লগইন করুন।");
  }

  const data = bytes && bytes.length ? bytes : new Uint8Array(0);
  if (!data.length) throw new ApiError(400, "ছবি ফাইল খালি।");
  if (data.length > MAX_BYTES) throw new ApiError(413, "ছবির আকার ৮ MB-র বেশি — ছোট ছবি দিন।");

  /* server-side key — ক্লায়েন্ট/বান্ডলে কখনো যায় না */
  const key = await io.getImgbbKey().catch(() => "");
  if (!key) {
    throw new ApiError(
      503,
      "সার্ভারে ImgBB API key কনফিগার করা নেই — অ্যাডমিন প্যানেলের সেটিংসে key দিন (বা সার্ভার secret সেট করুন)।",
    );
  }

  const type = String(mime || "image/jpeg").trim().slice(0, MAX_MIME_LEN) || "image/jpeg";
  const name = safeFilename(filename);
  const fd = new FormData();
  /* `data` একটি Uint8Array — BlobPart টাইপ-সামঞ্জস্যের জন্য cast; runtime একই। */
  fd.append("key", key);
  fd.append("image", new Blob([data as unknown as BlobPart], { type }), name);

  const res = await fetchImpl(IMGBB_URL, { method: "POST", body: fd }).catch(() => null);
  if (!res) throw new ApiError(502, "ImgBB-তে আপলোড করা যায়নি — কিছুক্ষণ পর আবার চেষ্টা করুন।");

  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json?.success) {
    /* ImgBB-র অভ্যন্তরীণ ত্রুটি বাইরে পাঠানো হয় না — শুধু সাধারণ বার্তা */
    throw new ApiError(502, "ImgBB-তে আপলোড ব্যর্থ হয়েছে — আবার চেষ্টা করুন।");
  }
  const d = json.data || {};
  const url = String(d.url || "").trim();
  if (!url) throw new ApiError(502, "ImgBB আপলোডের উত্তর অসম্পূর্ণ।");

  return {
    ok: true,
    url,
    thumbUrl: String((d.thumb && d.thumb.url) || d.display_url || url),
    deleteUrl: String(d.delete_url || "").trim(),
    width: Number(d.width) || 0,
    height: Number(d.height) || 0,
  };
}

/** default export — existing call-site convention */
export default handleImageUpload;
