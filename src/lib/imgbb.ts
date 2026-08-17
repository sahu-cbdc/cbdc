/**
 * CBDC — ImgBB image hosting helper
 *
 * ছবি Firebase Storage-এ নয়, **ImgBB API**-তে সংরক্ষণ করা হয়:
 *   1. ImgBB API key দিয়ে ছবি upload করা হয়,
 *   2. ImgBB থেকে পাওয়া image URL (link) সংগ্রহ করা হয়,
 *   3. সেই link + metadata শুধু ডাটাবেসে (Realtime Database) সেভ হয়,
 *   4. UI-তে ওই link দিয়ে সরাসরি ছবি দেখানো হয়।
 *
 * API key-এর উৎস (priority ক্রমে):
 *   - localStorage cache (`cbdc.imgbb.key`)
 *   - Realtime Database `settings/imgbb` node (Admin Settings থেকে save হয়)
 *   - build-time env `VITE_IMGBB_API_KEY` (fallback)
 */

import { getRow, setRow } from "./rtdb";

const UPLOAD_URL = "https://api.imgbb.com/1/upload";
const KEY_CACHE = "cbdc.imgbb.key";

/** Build-time ImgBB API key (VITE_IMGBB_API_KEY). */
function getEnvImgbbKey(): string {
  try {
    const env = (import.meta as any).env;
    return String(env?.VITE_IMGBB_API_KEY || "").trim();
  } catch {
    return "";
  }
}

/** ImgBB API key পড়া (cache → RTDB settings → env)। */
export async function getImgbbKey(): Promise<string> {
  try {
    const c = localStorage.getItem(KEY_CACHE);
    if (c) return c;
  } catch {
    /* ignore */
  }
  try {
    const row = await getRow("settings", "imgbb");
    const k = String(row?.key || "").trim();
    if (k) {
      try {
        localStorage.setItem(KEY_CACHE, k);
      } catch {
        /* ignore */
      }
      return k;
    }
  } catch {
    /* ignore */
  }
  return getEnvImgbbKey();
}

/** ImgBB API key সংরক্ষণ (Admin Settings থেকে; RTDB `settings/imgbb`)। */
export async function saveImgbbKey(key: string): Promise<void> {
  const k = String(key || "").trim();
  try {
    if (k) localStorage.setItem(KEY_CACHE, k);
    else localStorage.removeItem(KEY_CACHE);
  } catch {
    /* ignore */
  }
  try {
    await setRow("settings", "imgbb", { key: k, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.warn("imgbb key save:", (e as Error)?.message);
  }
}

export interface ImgbbResult {
  url: string;
  thumbUrl: string;
  deleteUrl: string;
  width: number;
  height: number;
}

/** বড় ছবিকে web-friendly সাইজে compress/resize (canvas)। */
function compressImage(file: File, maxDim = 1600, quality = 0.85): Promise<Blob> {
  return new Promise((resolve) => {
    let objectUrl = "";
    try {
      objectUrl = URL.createObjectURL(file);
    } catch {
      resolve(file);
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => resolve(blob || file),
          "image/jpeg",
          quality
        );
      } catch {
        resolve(file);
      } finally {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {
          /* ignore */
        }
      }
    };
    img.onerror = () => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        /* ignore */
      }
      resolve(file);
    };
    img.src = objectUrl;
  });
}

/**
 * একটি image file ImgBB-তে upload করে hosted URL গুলো ফেরত দেয়।
 * এই URL গুলোই ডাটাবেসে (Realtime Database) সংরক্ষণ করা হয় — image file নয়।
 */
export async function uploadImage(
  file: File,
  opts: { key?: string } = {}
): Promise<ImgbbResult> {
  const key = opts.key || (await getImgbbKey());
  if (!key) {
    throw new Error("ImgBB API কী নেই। অ্যাডমিন সেটিংসে কী দিন।");
  }

  const image = await compressImage(file);
  const fd = new FormData();
  fd.append("key", key);
  fd.append("image", image, file.name || "image.jpg");

  const resp = await fetch(UPLOAD_URL, { method: "POST", body: fd });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || !json?.success) {
    throw new Error(String(json?.error?.message || "ImgBB আপলোড ব্যর্থ হয়েছে"));
  }

  const d = json.data || {};
  return {
    url: String(d.url || ""),
    thumbUrl: String((d.thumb && d.thumb.url) || d.display_url || d.url || ""),
    deleteUrl: String(d.delete_url || ""),
    width: Number(d.width) || 0,
    height: Number(d.height) || 0,
  };
}
