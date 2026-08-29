/**
 * CBDC — নিরাপদ সার্ভার-ভিত্তিক ডিলিট (Account / Donor ID — independent)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  **ব্রাউজার আর নিজে কোনো ডেটা মোছে না।** এই মডিউল শুধু:
 *    ১. লগইন করা অ্যাডমিনের Firebase **ID token** নেয়,
 *    ২. secure server endpoint-এ (`POST <base>api/admin/delete`)
 *       authenticated অনুরোধ পাঠায়,
 *    ৩. সার্ভারের ফলাফল দেখে স্পষ্ট বাংলা বার্তা তৈরি করে।
 *
 *  সার্ভার (`server/deleteApi.ts` → Cloudflare Worker `server/index.ts` বা
 *  Vite dev middleware) নিজে token যাচাই করে, অ্যাডমিন role নিশ্চিত করে এবং
 *  Realtime Database থেকে **শুধু নির্ধারিত entity** মোছে:
 *
 *      scope "account" → users/{uid} · admins/{uid} · accounts/*
 *                        (ডোনার আইডি অক্ষত থাকে)
 *      scope "donor"   → donors/{donorId} · members/* · queue/*
 *                        (অ্যাকাউন্ট অক্ষত থাকে)
 *
 *  ⚠️ **ব্রাউজার-কোডে কোনো Firebase Admin SDK / service-account key / private
 *  key / গোপন secret নেই** — এখানে শুধু public web API key-ভিত্তিক ক্লায়েন্ট
 *  Firebase আর সার্ভারের প্রতিক্রিয়া ব্যবহৃত হয়।
 *
 *  সফল ডিলিটের পর RTDB বদলায় — বিদ্যমান live listener-ই (store.ts/watchAccounts
 *  ইত্যাদি) সব সম্পর্কিত UI প্রতিফলিত করে; কোনো page reload/full reload/loading
 *  লাগে না, কোনো নতুন listener-ও যোগ হয় না।
 */

import { getAuthInstance } from "./firebase";
import { appBase } from "./router";
import { toBanglaDigits } from "./age";

/* ═══════════════════════════════════════════════════════════════════
   Duplicate প্রতিরোধ — legacy মেলানো ও অ্যাডমিন স্ক্যান
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Google লগইনে ইমেইলের পুরোনো (legacy) users রেকর্ড অন্য UID-এ থাকলে
 * duplicate না বানিয়ে সেটি বর্তমান UID-এ নিরাপদে মেলানো — সার্ভারের
 * secure endpoint-এ (নিজের ইমেইলের রেকর্ডই শুধু মেলানো যায়)।
 */
export async function resolveLegacyAccount(): Promise<{
  ok: boolean;
  merged: boolean;
  uid: string;
  email: string;
  profile?: Record<string, any>;
  donorId?: string;
  /** merge সম্ভব নয় (সার্ভার কনফিগারেশন নেই) — duplicate তৈরি করা যাবে না */
  unconfigured?: boolean;
  error?: string;
}> {
  try {
    const auth = getAuthInstance();
    const user = (auth?.currentUser ?? null) as any;
    if (!user || typeof user.getIdToken !== "function") {
      return { ok: false, merged: false, uid: "", email: "", error: "লগইন করা নেই।" };
    }
    const token = await user.getIdToken();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response | null = null;
    try {
      res = await fetch(`${appBase()}api/account/resolve-legacy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.ok === false) {
      const message = String((data && data.error) || `সার্ভার অনুরোধ ব্যর্থ (HTTP ${res ? res.status : "—"})`);
      return {
        ok: false, merged: false, uid: "", email: "",
        unconfigured: res.status === 503 || /কনফিগার/i.test(message),
        error: message,
      };
    }
    return {
      ok: true,
      merged: data.merged === true,
      uid: String(data.uid || ""),
      email: String(data.email || ""),
      profile: (data.profile && typeof data.profile === "object") ? data.profile : undefined,
      donorId: data.donorId ? String(data.donorId) : undefined,
    };
  } catch (e) {
    const message = (e as Error)?.message || "পুরোনো রেকর্ড মেলানো যায়নি।";
    return {
      ok: false, merged: false, uid: "", email: "",
      unconfigured: /কনফিগার/i.test(message),
      error: message.includes("abort") ? "অনুরোধের সময়সীমা পেরিয়ে গেছে।" : message,
    };
  }
}

export type DedupeGroupInfo = {
  kind: "user-email" | "donor-owner" | "donor-phone";
  key: string;
  keep: { id: string; name: string; email?: string; donorId?: string; uid?: string };
  remove: Array<{ id: string; name: string; email?: string; uid?: string }>;
  filledFields: string[];
};

export type DedupeReportInfo = {
  ok: boolean;
  applied: boolean;
  scanned: { users: number; donors: number; emailsIndexed: number };
  groups: DedupeGroupInfo[];
  notes: string[];
  changedPaths: number;
  error?: string;
};

/**
 * অ্যাডমিন duplicate স্ক্যান — প্রথমে preview (apply:false), নিশ্চিত হলে
 * apply:true। সার্ভারে অ্যাডমিন যাচাই হয়; ফল RTDB-তে লেখা হলে live
 * listener-ই সব প্যানেলে realtime আপডেট করে।
 */
export async function runDedupeScan(apply: boolean): Promise<DedupeReportInfo> {
  const fail = (error: string): DedupeReportInfo => ({
    ok: false, applied: false, scanned: { users: 0, donors: 0, emailsIndexed: 0 },
    groups: [], notes: [], changedPaths: 0, error,
  });
  try {
    const auth = getAuthInstance();
    const user = (auth?.currentUser ?? null) as any;
    if (!user || typeof user.getIdToken !== "function") return fail("লগইন করা নেই — অ্যাডমিন হিসেবে লগইন করুন।");
    const token = await user.getIdToken();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    let res: Response | null = null;
    try {
      res = await fetch(`${appBase()}api/admin/dedupe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ apply }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.ok === false) {
      return fail(String((data && data.error) || `সার্ভার অনুরোধ ব্যর্থ (HTTP ${res ? res.status : "—"})`));
    }
    return {
      ok: true,
      applied: data.applied === true,
      scanned: {
        users: Number(data.scanned?.users) || 0,
        donors: Number(data.scanned?.donors) || 0,
        emailsIndexed: Number(data.scanned?.emailsIndexed) || 0,
      },
      groups: Array.isArray(data.groups) ? data.groups : [],
      notes: Array.isArray(data.notes) ? data.notes.map(String) : [],
      changedPaths: Number(data.changedPaths) || 0,
    };
  } catch (e) {
    return fail((e as Error)?.message || "স্ক্যান করা যায়নি।");
  }
}

/** দুটি স্বাধীন entity — Account ও Donor ID। */
export type DeleteScope = "account" | "donor";

export type DeletionStep = {
  id: string;
  label: string;
  ok: boolean;
  /** রেকর্ডই ছিল না — এটি failure নয়। */
  skipped?: boolean;
  error?: string;
};

/** Admin.tsx-এর সাথে সামঞ্জস্যপূর্ণ result shape (সার্ভারের ফলাফল normalize)। */
export type DonorDeletionResult = {
  ok: boolean;
  scope: DeleteScope;
  donorId: string;
  uid: string;
  name: string;
  /** Realtime Database অংশ */
  rtdb: "ok" | "failed" | "skipped";
  /** সংশ্লিষ্ট লগইন (Firebase Authentication) অংশ — সার্ভারের secret দিয়ে মোছা হয় */
  auth: "deleted" | "missing" | "failed" | "skipped";
  /** যে uid-এর লগইন অ্যাকাউন্ট মোছা/বাদ হলো (খালি = লিংকড অ্যাকাউন্ট নেই) */
  authUid?: string;
  /** সার্ভার endpoint-এর অবস্থা */
  server: "ok" | "failed" | "not-possible";
  steps: DeletionStep[];
  failed: DeletionStep[];
  /** মোছা হয়েছে এমন RTDB path-এর সংখ্যা */
  removed: number;
  /** গ্লোবাল node-এ পাওয়া orphan রেফারেন্স (মোছা হয়নি) */
  references: Record<string, string[]>;
  warnings: string[];
  /** ব্যর্থ হলে স্পষ্ট কারণ */
  error?: string;
};

/** Firebase Auth-এর UID: ২০–৬৪টি URL-safe অক্ষর (ভুল UID অনুরোধ আটকাতে)। */
const AUTH_UID_RE = /^[A-Za-z0-9_-]{20,64}$/;

/** একটি মান Firebase Auth UID-এর মতো দেখতে কি না। */
export function isAuthUid(value: unknown): boolean {
  return AUTH_UID_RE.test(String(value ?? "").trim());
}

const ENDPOINT = "api/admin/delete";
const TIMEOUT_MS = 20000;

/**
 * Secure server-side delete — ব্রাউজার শুধু token-সহ অনুরোধ পাঠায়।
 *
 * @param req.scope  "account" (ডোনার ব্যবস্থাপনা) বা "donor" (ডোনার আইডি ব্যবস্থাপনা)
 */
export async function serverDeleteEntity(req: {
  scope: DeleteScope;
  donorId?: string;
  uid?: string;
  name?: string;
}): Promise<DonorDeletionResult> {
  const scope = req.scope === "account" ? "account" : "donor";
  const donorId = String(req.donorId ?? "").trim();
  const uid = String(req.uid ?? "").trim();
  const name = String(req.name ?? "").trim();
  try {
    const auth = getAuthInstance();
    const user = (auth?.currentUser ?? null) as any;
    if (!user || typeof user.getIdToken !== "function") {
      return clientFailure(scope, donorId, uid, name, "লগইন করা নেই — নিরাপদ সার্ভার ডিলিটের অনুমোদন পাওয়া যায়নি।");
    }
    let token = "";
    try {
      token = await user.getIdToken();
    } catch (e) {
      return clientFailure(scope, donorId, uid, name, `ID token পাওয়া যায়নি — ${(e as Error)?.message || "আবার লগইন করুন।"}`);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response | null = null;
    try {
      res = await fetch(`${appBase()}${ENDPOINT}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ scope, donorId, uid, name }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res || !res.ok) {
      const message = String((data && data.error) || `সার্ভার অনুরোধ ব্যর্থ (HTTP ${res ? res.status : "—"})`);
      return clientFailure(scope, donorId, uid, name, message);
    }
    if (!data || data.ok === false) {
      return clientFailure(scope, donorId, uid, name, String((data && data.error) || "সার্ভার delete ব্যর্থ হয়েছে।"));
    }
    return normalize(data, scope, donorId, uid, name);
  } catch (e) {
    const message = (e as Error)?.message || "নিরাপদ সার্ভার ডিলিট করা যায়নি।";
    return clientFailure(scope, donorId, uid, name, message.includes("abort") ? "অনুরোধের সময়সীমা পেরিয়ে গেছে — আবার চেষ্টা করুন।" : message);
  }
}

/**
 * পুরোনো নামের সাথে সামঞ্জস্য — এখন `scope: "donor"` সার্ভার অনুরোধ।
 * Admin.tsx-এর কলগুলো scope স্পষ্ট করে দেয়; এই wrapper শুধু পিছনের সামঞ্জস্য।
 */
export function deleteDonorCompletely(
  seed: { donorId?: string; uid?: string; name?: string },
  _sources?: unknown,
  opts?: { scope?: DeleteScope },
): Promise<DonorDeletionResult> {
  return serverDeleteEntity({
    scope: opts?.scope === "account" ? "account" : "donor",
    donorId: seed?.donorId,
    uid: seed?.uid,
    name: seed?.name,
  });
}

/** সার্ভার result → client result shape (Admin.tsx-এর বার্তা/UI অপরিবর্তিত)। */
function normalize(data: any, scope: DeleteScope, donorId: string, uid: string, name: string): DonorDeletionResult {
  const failed: DeletionStep[] = [];
  return {
    ok: data.ok !== false,
    scope: data.scope === "account" ? "account" : scope,
    donorId: String(data.donorId || donorId),
    uid: String(data.uid || uid),
    name: String(data.name || name),
    rtdb: data.rtdb === "ok" ? "ok" : data.rtdb === "failed" ? "failed" : "skipped",
    auth:
      data.auth === "deleted" ? "deleted"
      : data.auth === "failed" ? "failed"
      : data.auth === "missing" ? "missing"
      : "skipped",
    authUid: String(data.authUid || ""),
    server: data.server === "ok" ? "ok" : "failed",
    steps: Array.isArray(data.steps) ? data.steps : [],
    failed,
    removed: Number(data.removed) || 0,
    references: (data.references && typeof data.references === "object") ? data.references : {},
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
    error: data.ok === false ? String(data.error || "") : undefined,
  };
}

function clientFailure(scope: DeleteScope, donorId: string, uid: string, name: string, message: string): DonorDeletionResult {
  const step: DeletionStep = { id: "server", label: "নিরাপদ সার্ভার অনুরোধ", ok: false, error: message };
  return {
    ok: false,
    scope,
    donorId,
    uid,
    name,
    rtdb: "skipped",
    auth: "skipped",
    server: "failed",
    steps: [step],
    failed: [step],
    removed: 0,
    references: {},
    warnings: [],
    error: message,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   বার্তা — সাফল্য/ব্যর্থতা (ডোনার আইডি ও অ্যাকাউন্ট আলাদা)
   ═══════════════════════════════════════════════════════════════════ */

/**
 * একক entity — সাফল্য বা ব্যর্থতার বাংলা বার্তা।
 * সাফল্যে জানানো হয় লগইন (Firebase Authentication) অংশের অবস্থাসহ:
 *   deleted  → লগইন অ্যাকাউন্টসহ সম্পূর্ণ মুছেছে
 *   missing  → মুছেছে; সংশ্লিষ্ট কোনো লগইন ছিলই না
 *   skipped  → মুছেছে; লগইন মোছা হয়নি (সার্ভারে secret কনফিগার নেই / নিজের রেকর্ড)
 *   failed   → সাফল্য নয় — নিচের ব্যর্থতার শাখায় যায়
 */
export function deletionMessage(result: DonorDeletionResult): string {
  const isAccount = result.scope === "account";
  if (result.ok) {
    const authPart =
      result.auth === "deleted"
        ? "লগইন অ্যাকাউন্ট (Firebase Authentication) সহ সম্পূর্ণ মুছে গেছে"
        : result.auth === "missing"
          ? "সংশ্লিষ্ট কোনো লগইন অ্যাকাউন্ট ছিল না — তাই কোনো লগইন মোছা হয়নি"
          : result.auth === "failed"
            ? "লগইন অ্যাকাউন্ট মোছা যায়নি"
            : "লগইন অ্যাকাউন্ট মোছা হয়নি — সার্ভার কনফিগারেশন প্রয়োজন";
    return isAccount
      ? `অ্যাকাউন্ট সফলভাবে মুছে ফেলা হয়েছে — ${authPart}; ডোনার আইডি অক্ষত আছে`
      : `ডোনার আইডি সফলভাবে মুছে ফেলা হয়েছে — ${authPart}`;
  }
  if (result.error) return result.error;
  const detail = result.failed.find((f) => f.error)?.error;
  return `${isAccount ? "অ্যাকাউন্ট" : "ডোনার আইডি"} মুছে ফেলা যায়নি${detail ? ` — ${detail}` : "।"}`;
}

/**
 * একাধিক (bulk) সফল entity-র বাংলা সারসংক্ষেপ — লগইন অ্যাকাউন্ট অংশের
 * অবস্থা অনুযায়ী সঠিক বার্তা (কোনো মিথ্যে সাফল্য নয়)।
 */
export function bulkDeletionMessage(results: DonorDeletionResult[]): string {
  const n = Math.max(1, results.length);
  const isAccount = results[0]?.scope === "account";
  const what = isAccount ? "অ্যাকাউন্ট" : "ডোনার আইডি";
  const title = n > 1 ? `নির্বাচিত ${toBanglaDigits(n)}টি ${what} মুছে ফেলা হয়েছে` : `${what} মুছে ফেলা হয়েছে`;
  const deleted = results.filter((r) => r.auth === "deleted").length;
  const missing = results.filter((r) => r.auth === "missing").length;
  const skipped = results.filter((r) => r.auth === "skipped").length;
  let authTxt: string;
  if (deleted && !skipped) {
    authTxt = isAccount
      ? " — লগইন (Firebase Authentication) সহ; ডোনার আইডি অক্ষত আছে"
      : " — সংশ্লিষ্ট লগইন অ্যাকাউন্টসহ (Firebase Authentication)";
  } else if (!deleted && missing && !skipped) {
    authTxt = isAccount
      ? " — সংশ্লিষ্ট কোনো লগইন অ্যাকাউন্ট ছিল না; ডোনার আইডি অক্ষত আছে"
      : " — সংশ্লিষ্ট কোনো লগইন অ্যাকাউন্ট ছিল না";
  } else if (skipped && deleted) {
    authTxt = ` — ${toBanglaDigits(deleted)} জনের লগইন মুছেছে, ${toBanglaDigits(skipped)} জনের মোছা হয়নি (সার্ভার কনফিগারেশন দেখুন)`;
  } else if (skipped) {
    authTxt = " — লগইন অ্যাকাউন্ট মোছা হয়নি (সার্ভার কনফিগারেশন দেখুন)";
  } else {
    authTxt = "";
  }
  return title + authTxt;
}

/** পুরোনো API-র সাথে সামঞ্জস্য — ব্যর্থতার সারসংক্ষেপ। */
export function describeDeletionFailure(name: string, failed: DeletionStep[]): string {
  const target = String(name || "").trim() || "ডোনার";
  const parts = failed
    .map((f) => f.label + (f.error ? ` (${f.error})` : ""))
    .filter(Boolean)
    .join(", ");
  return `${target} মুছে ফেলা যায়নি — ${parts || "অজানা সমস্যা"}।`;
}
