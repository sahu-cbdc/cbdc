/**
 * CBDC — Cross-Origin Resource Sharing (CORS) policy
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  নিয়ম (নিরাপত্তা):
 *   • CORS **কখনোই authentication নয়** — প্রতিটি protected API অনুরোধকে
 *     `Authorization: Bearer <Firebase ID token>` দিয়ে সার্ভার-সাইড যাচাই করা
 *     হয় (Identity Toolkit)। CORS শুধু ব্রাউজারকে cross-origin request পাঠানোর
 *     অনুমতি দেয়; token ছাড়া যেকোনো অনুরোধই 401।
 *   • Blindly `Access-Control-Allow-Origin: *` ব্যবহার করা হয় না — কারণ এটি সব
 *     origin-কে অনুমতি দেয় (এবং `Authorization` header-সহ credentials-এর জন্য
 *     `*` সর্বোপরি অবৈধ/অনিরাপদ)। বদলে একটি **allowlist** ব্যবহার হয়:
 *     সাইটের নিজস্ব origin + `ALLOWED_ORIGINS` env-এ দেওয়া ভবিষ্যতের App-এর
 *     authorized origin-গুলো।
 *   • same-origin (আজকের Website → Worker) অনুরোধে কোনো CORS header-ই লাগে না —
 *     শুধু cross-origin (ভবিষ্যতের Android/iOS App) preflight/response-এ লাগে।
 *
 *  এই মডিউলটি pure (কোনো env/fetch dependency নেই) — তাই যেকোনো পরিবেশে
 *  (Worker, dev middleware, verification harness) একই logic চালানো যায় এবং
 *  সরাসরি unit-test করা যায়।
 */

/** ডিফল্ট অনুমোদিত origin — সাইটের নিজস্ব production domain। */
export const DEFAULT_CORS_ORIGINS = [
  "https://chawkbazarbloodclub.com",
  "https://www.chawkbazarbloodclub.com",
] as const;

/**
 * env-তে `ALLOWED_ORIGINS` (comma-separated) + ডিফল্ট origin গুলো → সাজানো
 * allowlist। খালি/null টুকরা বাদ। তুলনা সর্বদা case-insensitive, trailing
 * slash-মুক্ত।
 */
export function parseAllowedOrigins(raw?: string | null): string[] {
  const set = new Set<string>();
  for (const o of DEFAULT_CORS_ORIGINS) set.add(normalizeOrigin(o));
  if (raw && typeof raw === "string") {
    for (const piece of raw.split(",")) {
      const o = normalizeOrigin(piece);
      if (o) set.add(o);
    }
  }
  return [...set];
}

/** origin string → lowercase, no scheme-hash, no trailing slash; invalid → "". */
export function normalizeOrigin(value: string): string {
  let v = String(value || "").trim();
  if (!v) return "";
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return (u.protocol + "//" + u.host).toLowerCase().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

/** একটি Origin header এই allowlist-এ আছে কি না (case-insensitive)। */
export function isAllowedOrigin(origin: string | null | undefined, allowed: string[]): boolean {
  const o = normalizeOrigin(origin || "");
  if (!o) return false;
  return allowed.some((a) => normalizeOrigin(a) === o);
}

export type CorsPolicy = {
  /** এই অনুরোধের জন্য CORS header গুলো (খালি = কোনো CORS নেই — same-origin/অ-ব্রাউজার)। */
  headers: Record<string, string>;
  /** Preflight (OPTIONS) request কিনা — responder-কে 204 দিতে বলে। */
  preflight: boolean;
};

/**
 * একটি অনুরোধের Origin + allowlist থেকে CORS policy তৈরি।
 *
 *  - Origin অনুপস্থিত → same-origin (বা curl/server-to-server): কোনো CORS নেই।
 *  - Origin allowlist-এ নেই → শুধু preflight-এ 403-মতো ভাবা হয় না; আপত্তিকর
 *    origin-কে CORS header-ই দেওয়া হয় না, ফলে ব্রাউজার response blocked করে।
 *    (আমরা এখানে allowlisted origin-এই header দিই।)
 *  - Preflight (OPTIONS + Origin + Access-Control-Request-Method) → 204।
 */
export function corsForRequest(
  origin: string | null | undefined,
  method: string | null | undefined,
  allowedOrigins: string[] = parseAllowedOrigins(),
  requestMethod: string | null | undefined = undefined,
): CorsPolicy {
  const o = normalizeOrigin(origin || "");
  const headers: Record<string, string> = {};
  let preflight = false;
  /* `method` হল actual HTTP method; preflight হলে সেটি "OPTIONS"। `requestMethod`
     (Access-Control-Request-Method) শুধু অনুরোধ-করা method জানায় — এটি CORS-headers-এ
     Allow-Methods হিসেবে ব্যবহার করা যেতে পারে, কিন্তু preflight সনাক্তকরণে নয়। */
  const actual = String(method || "").toUpperCase();
  const requested = String(requestMethod || "").toUpperCase();

  if (o && isAllowedOrigin(o, allowedOrigins)) {
    headers["Access-Control-Allow-Origin"] = o;
    headers["Vary"] = "Origin";
    headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
    headers["Access-Control-Allow-Methods"] = requested
      ? `${requested}, OPTIONS`
      : "POST, OPTIONS";
    if (actual === "OPTIONS") {
      headers["Access-Control-Max-Age"] = "600";
      preflight = true;
    }
  }
  return { headers, preflight };
}
