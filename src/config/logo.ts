/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  CBDC — কেন্দ্রীয় লোগো সিস্টেম (Single source of truth)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  পুরো ওয়েবসাইটের লোগো **শুধু এখান থেকেই** আসে — Home, Doner Dashboard,
 *  Admin Panel, Moderator Panel, ডোনার কার্ড, ইমেইল টেমপ্লেট — সব জায়গায়।
 *
 *  লোগো বদলাতে চাইলে দুটি উপায়:
 *    ১) সবচেয়ে সহজ — `public/img/logo.png` ফাইলটি নতুন ছবি দিয়ে replace করুন।
 *    ২) অন্য কোনো URL (যেমন ImgBB link) ব্যবহার করতে চাইলে নিচের
 *       `LOGO_FILE` মানটি সেই পূর্ণ URL দিয়ে বদলে দিন।
 *
 *  কোনো page/component-এ আলাদা করে logo path হার্ডকোড করা নিষেধ —
 *  সবাইকে `logoUrl()` অথবা `LOGO_URL` ব্যবহার করতে হবে।
 *
 *  ── কেন এই ফাইলটা দরকার ছিল ──────────────────────────────────────────────
 *  আগে প্রতিটি পেজে `"./img/logo.png"` লেখা ছিল। এটি **relative** path,
 *  তাই `/doner`, `/doner/find/profile` বা `/admin/people` এর মতো deep URL-এ
 *  ব্রাউজার ভুল ঠিকানায় (`/doner/img/logo.png`) খুঁজত এবং Doner Dashboard-এ
 *  লোগো লোড হতো না। এখানে সাইটের base path ধরে সবসময় সঠিক absolute URL
 *  তৈরি করা হয়, তাই যেকোনো পেজ/সাব-পেজ থেকেই লোগো ঠিকভাবে লোড হয়।
 */

import { appBase } from "../lib/router";

/** লোগো ফাইল — সাইটের base-এর সাপেক্ষে, অথবা সম্পূর্ণ http(s) URL। */
const LOGO_FILE = "img/logo.png";

/** এটি কি ইতিমধ্যেই একটি সম্পূর্ণ URL / data URI? */
function isAbsolute(src: string): boolean {
  return /^(https?:)?\/\//i.test(src) || src.startsWith("data:");
}

/**
 * সাইটের লোগোর কার্যকর URL।
 *
 * যেকোনো পাথ থেকে ডাকা যায় (`/`, `/doner`, `/admin/people/…`) — সবসময়
 * base-অনুযায়ী সঠিক ঠিকানা ফেরত দেয়।
 */
export function logoUrl(): string {
  if (isAbsolute(LOGO_FILE)) return LOGO_FILE;
  let base = "/";
  try {
    base = appBase() || "/";
  } catch {
    base = "/";
  }
  if (!base.endsWith("/")) base += "/";
  return base + LOGO_FILE.replace(/^\.?\//, "");
}

/** সুবিধার জন্য module-load সময়ের মান (অধিকাংশ ব্যবহারে এটাই যথেষ্ট)। */
export const LOGO_URL = /*#__PURE__*/ logoUrl();

/**
 * ডকুমেন্টে থাকা সব `[data-logo]` element-এ কেন্দ্রীয় লোগো বসিয়ে দেয়।
 * (Home পেজের static markup এই hook ব্যবহার করে।)
 */
export function applyLogo(root: ParentNode = document): void {
  const src = logoUrl();
  root.querySelectorAll<HTMLImageElement>("[data-logo]").forEach((img) => {
    if (img.getAttribute("src") !== src) img.src = src;
  });
}

export default LOGO_URL;
