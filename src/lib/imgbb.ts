/**
 * CBDC — ImgBB image hosting helper (নিরাপদ, server-side)
 *
 * ছবি Firebase Storage-এ নয়, **ImgBB API**-তে সংরক্ষণ করা হয়:
 *   1. ব্রাউজারে ছবিটি compress করা হয় (আগের মতোই),
 *   2. এরপর এটি **নিরাপদ server-side Cloud Function** (`uploadImage`)-এ যায়,
 *   3. সেই ফাংশন—যার কাছেই শুধু ImgBB API key থাকে—ImgBB-এ upload করে,
 *   4. ফেরত আসা hosted URL + metadata RTDB-তে সেভ হয় (কোনো key নয়)।
 *
 * ⚠️ নিরাপত্তা: ImgBB API key একটি third-party secret। এটি কখনো
 *    • frontend source / bundled JS (`VITE_IMGBB_API_KEY` inlined হয়),
 *    • localStorage cache, বা
 *    • public-readable RTDB node (`settings/imgbb`)
 *   — কোথাও থাকতে পারবে না। তাই key শুধু Cloud Function-এর server env-এ
 *   (`IMGBB_API_KEY`) থাকে এবং client কেবল authenticated proxy কল করে।
 */

import { uploadImage as uploadImageViaServer, getImgbbStatus } from "./cloud";

/**
 * ImgBB কনফিগার করা আছে কি না (UI-তে শুধু অবস্থা দেখানোর জন্য)।
 * **কখনো key-এর মান ফেরত দেয় না** — শুধু `true/false`।
 */
export async function isImgbbConfigured(): Promise<boolean> {
  try {
    const status = await getImgbbStatus();
    return !!status?.configured;
  } catch (e) {
    console.warn("imgbb status:", (e as Error)?.message);
    return false;
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
export async function uploadImage(file: File): Promise<ImgbbResult> {
  const image = await compressImage(file);
  const dataUrl = await blobToDataUrl(image);
  return uploadImageViaServer({ image: dataUrl, name: (file.name || "cbdc-image").slice(0, 120) });
}

/** Blob/File → data URL (server proxy-এ পাঠানোর জন্য)। */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("ছবি পড়া যায়নি।"));
      reader.readAsDataURL(blob);
    } catch (e) {
      reject(e as Error);
    }
  });
}
