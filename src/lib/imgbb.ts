/**
 * CBDC — ImgBB image hosting helper (secure, server-side)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  ছবি Firebase Storage-এ নয়, **ImgBB API**-তে সংরক্ষণ করা হয়:
 *   ১. ব্রাউজার শুধু ইনপুট image-কে compress/resize করে,
 *   ২. তারপর **secure server endpoint**-এ (`POST <base>api/images/upload`)
 *      authenticated অনুরোধ পাঠায়,
 *   ৩. সার্ভার (Cloudflare Worker / dev middleware) তার **server-side ImgBB
 *      key** দিয়ে ImgBB-তে আপলোড করে,
 *   ৪. পাওয়া URL + metadata ক্লায়েন্ট পায় এবং সেটি ডাটাবেসে সেভ হয়।
 *
 *  ⚠️ **নিরাপত্তা**: ImgBB API key আর **কখনোই** browser-এ আসে না —
 *    • build-time env-var ও localStorage cache-ভিত্তিক client-key পড়া সরানো হয়েছে;
 *    • Realtime Database `settings/imgbb` node admin-only read (rules) — তাই
 *      non-admin ব্যবহারকারী key পড়তে পারে না;
 *    • key-এর একমাত্র প্রাপ্তিস্থান server-side (`env.IMGBB_API_KEY` অথবা
 *      privileged RTDB read)। Client-supplied `opts.key` **ইচ্ছাকৃতভাবে উপেক্ষা** করা হয়।
 */

import { getAuthInstance } from "./firebase";
import { appBase } from "./router";
import { getRow, setRow } from "./rtdb";

const ENDPOINT = "api/images/upload";
const TIMEOUT_MS = 25000;

/** ImgBB API key পড়া — শুধু RTDB `settings/imgbb` (admin), localStorage/env নয়।
 *  মূলত Admin panel-এর সংযোগ-অবস্থা দেখানোর জন্য; upload-এ ব্যবহৃত হয় না। */
export async function getImgbbKey(): Promise<string> {
  try {
    const row = await getRow("settings", "imgbb");
    return String(row?.key || "").trim();
  } catch {
    /* rules non-admin / নেটওয়ার্ক — key জানা যায় না; upload server-এ যায় */
    return "";
  }
}

/** ImgBB API key সংরক্ষণ (Admin Settings থেকে; RTDB `settings/imgbb`)।
 *  localStorage-এ আর key রাখা হয় না — একটি private secret-কে browser storage-এ
 *  না রেখে কেবল server-এর কাছে রেখে দেওয়া হয়। */
export async function saveImgbbKey(key: string): Promise<void> {
  const k = String(key || "").trim();
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
 * একটি image file secure server endpoint-এর মাধ্যমে ImgBB-তে upload করে hosted
 * URL গুলো ফেরত দেয়। এই URL গুলোই ডাটাবেসে (Realtime Database) সংরক্ষণ করা হয়।
 *
 * `opts.key` (client-supplied) ইচ্ছাকৃতভাবে উপেক্ষা করা হয় — ক্লায়েন্ট-পাঠানো
 * key কখনো বিশ্বাস করা হয় না; server-ই secret key ব্যবহার করে।
 */
export async function uploadImage(
  file: File,
  opts: { key?: string } = {},
): Promise<ImgbbResult> {
  /* `opts.key` ইচ্ছাকৃতভাবে অগ্রাহ্য — server-ই key রাখে। */
  void opts;

  const image = await compressImage(file);
  const auth = getAuthInstance();
  const user = (auth?.currentUser ?? null) as any;
  if (!user || typeof user.getIdToken !== "function") {
    throw new Error("লগইন করা নেই — ছবি আপলোড করা যায় না।");
  }
  let token = "";
  try {
    token = await user.getIdToken();
  } catch (e) {
    throw new Error(`লগইন সেশন নবায়ন করা যায়নি — ${(e as Error)?.message || "আবার লগইন করুন।"}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let resp: Response | null = null;
  try {
    resp = await fetch(`${appBase()}${ENDPOINT}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": image.type || "image/jpeg",
        "X-Filename": file.name || "image.jpg",
      },
      body: image,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  let data: any = null;
  try {
    data = await resp.json();
  } catch {
    data = null;
  }
  if (!resp || !resp.ok || !data || data.ok === false) {
    const message = String((data && data.error) || `সার্ভার আপলোড ব্যর্থ (HTTP ${resp ? resp.status : "—"})`);
    throw new Error(message.includes("abort") ? "আপলোডের সময়সীমা পেরিয়ে গেছে — আবার চেষ্টা করুন।" : message);
  }
  const url = String(data.url || "");
  if (!url) throw new Error("সার্ভার থেকে ছবির লিংক পাওয়া যায়নি।");
  return {
    url,
    thumbUrl: String(data.thumbUrl || data.url || url),
    deleteUrl: String(data.deleteUrl || ""),
    width: Number(data.width) || 0,
    height: Number(data.height) || 0,
  };
}
