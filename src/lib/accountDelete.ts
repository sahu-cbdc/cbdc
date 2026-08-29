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
  /** Firebase Authentication অংশ — সার্ভারে private key নেই, ফলে skipped */
  auth: "deleted" | "missing" | "failed" | "skipped";
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
    auth: data.auth === "deleted" ? "deleted" : data.auth === "failed" ? "failed" : "skipped",
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

/** একক entity — সাফল্য বা ব্যর্থতার বাংলা বার্তা। */
export function deletionMessage(result: DonorDeletionResult): string {
  const isAccount = result.scope === "account";
  if (result.ok) {
    return isAccount
      ? "অ্যাকাউন্ট সফলভাবে মুছে ফেলা হয়েছে — ডোনার আইডি অক্ষত আছে"
      : "ডোনার আইডি সফলভাবে মুছে ফেলা হয়েছে — অ্যাকাউন্ট অক্ষত আছে";
  }
  if (result.error) return result.error;
  const detail = result.failed.find((f) => f.error)?.error;
  return `${isAccount ? "অ্যাকাউন্ট" : "ডোনার আইডি"} মুছে ফেলা যায়নি${detail ? ` — ${detail}` : "।"}`;
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
