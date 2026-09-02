

import { apiPostRaw } from "./api";
import { getAuthInstance } from "./firebase";
import { appBase } from "./router";
import { API_GATEWAYS, API_TIMEOUTS } from "../config/api";
import { IMGBB_PUBLIC_CONFIG } from "../config/imgbb";

/** Public compression settings; key/endpoint/limit stay server-side only. */
const CLIENT_COMPRESSION = IMGBB_PUBLIC_CONFIG.compression;

const ENDPOINT = API_GATEWAYS.media;
const CONFIG_ENDPOINT = API_GATEWAYS.admin;
const TIMEOUT_MS = API_TIMEOUTS.upload;


export async function getImgbbStatus(): Promise<boolean> {
  try {
    const res = await apiPostRaw(CONFIG_ENDPOINT, { op: "config-check" }, {
      timeoutMs: API_TIMEOUTS.statusCheck,
    });
    const data: any = res.data;
    return !!(data && data.ok === true && data.imgbbConfigured === true);
  } catch {
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


function compressImage(
  file: File,
  maxDim: number = CLIENT_COMPRESSION.maxDimension,
  quality: number = CLIENT_COMPRESSION.quality
): Promise<Blob> {
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
          CLIENT_COMPRESSION.mimeType,
          quality
        );
      } catch {
        resolve(file);
      } finally {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {
          
        }
      }
    };
    img.onerror = () => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        
      }
      resolve(file);
    };
    img.src = objectUrl;
  });
}


export async function uploadImage(file: File): Promise<ImgbbResult> {
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
