

import { ApiError } from "./deleteApi.ts";


export type ImagesIo = {
  
  verifyToken(idToken: string): Promise<{ uid: string } | null>;
  
  getImgbbKey(): Promise<string>;
  
  hasKey(): Promise<boolean>;
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

const MAX_BYTES = 8 * 1024 * 1024;

const MAX_MIME_LEN = 80;


function safeFilename(value: unknown): string {
  const s = String(value || "image.jpg")
    .replace(/[\u0000-\u001f\u007f\\/]+/g, "")
    .trim();
  if (!s) return "image.jpg";
  return s.length > 120 ? s.slice(-120) : s;
}


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
  
  fd.append("key", key);
  fd.append("image", new Blob([data as unknown as BlobPart], { type }), name);

  const res = await fetchImpl(IMGBB_URL, { method: "POST", body: fd }).catch(() => null);
  if (!res) throw new ApiError(502, "ImgBB-তে আপলোড করা যায়নি — কিছুক্ষণ পর আবার চেষ্টা করুন।");

  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json?.success) {
    
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


export default handleImageUpload;
