/**
 * CBDC — সম্পূর্ণ ডোনার/অ্যাকাউন্ট ডিলিট (Donor Management + Access & Role)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  ওয়েবসাইটে শুধু দুটোই Firebase service ব্যবহৃত হয়:
 *    ১. **Firebase Realtime Database**
 *    ২. **Firebase Authentication**
 *
 *  ⚠️ **Firebase Storage ব্যবহার করা হয় না** — ছবি ImgBB-এ থাকে (শুধু link
 *  ডাটাবেজে), তাই এই মডিউলে কোনো Storage dependency নেই।
 *
 *  একটি ডোনার মুছতে হলে শুধু `donors/{id}` মুছলেই হয় না — একই মানুষের
 *  UID/Donor ID আরও কয়েকটি node-এ ছড়িয়ে থাকে:
 *
 *    donors/{donorId}      → পাবলিক ডোনার প্রোফাইল
 *    users/{uid}           → অ্যাকাউন্ট তথ্য + data/ সাব-ট্রি
 *                            (donations, mine, notifs, activity, panel, groupChange)
 *    admins/{uid}          → স্টাফ/ভূমিকা রেকর্ড (থাকলে)
 *    accounts/{id}         → প্যানেল/টিম অ্যাকাউন্ট রেকর্ড
 *    members/{id}          → ডোনার আবেদন (sign-up application)
 *    queue/{id}            → approval/রক্তদান যাচাই/গ্রুপ বদল/রিপোর্ট—সব অপেক্ষমাণ কাজ
 *    requests/{id}         → জরুরি রক্তের আবেদন
 *    reports/{id}          → ডোনার প্যানেলের সমস্যা/রিপোর্ট
 *    messages/{id}         → যোগাযোগ বার্তা (UID রেফারেন্স থাকলে)
 *    Firebase Auth         → লগইন অ্যাকাউন্ট (শুধু সার্ভার দিয়ে মোছা যায়)
 *
 *  ══ নিরাপত্তা মডেল ══
 *   • ব্রাউজারে কোনো **Firebase Admin SDK নেই**, কোনো service-account key/secret
 *     নেই — কোনো Cloud Function বা server endpoint ছাড়াই সব কাজ হয়
 *     (Firebase Authentication + Realtime Database + ImgBB)।
 *   • **RTDB data deletion সবসময় সম্পূর্ণ** — admin-এর RTDB access Security
 *     Rules-এ অনুমোদিত; কোনো privileged operation ছাড়াই সব node মোছা যায়।
 *   • **Authentication account**: Firebase-এর নিরাপত্তা নিয়মে ব্রাউজার থেকে
 *     অন্য কারও Auth account মোছা সম্ভব নয় (Admin SDK প্রয়োজন)। তাই
 *       – নিজের অ্যাকাউন্ট → client SDK (`deleteUser`) দিয়ে মোছা হয়,
 *       – অন্য কারও → RTDB ডেটা মোছার পর `auth:"skipped"` + স্পষ্ট warning
 *         (Firebase Console/Admin থেকে Auth account মুছতে হবে)।
 *     কখনো চুপচাপ “সম্পূর্ণ মুছে গেছে” দাবি করা হয় না।
 *
 *  ══ ক্রম (order matters) ══
 *    identity resolve → identity verify → RTDB delete → Auth delete → report
 *  RTDB সফল না হলে Auth-এ যাওয়া হয় না; RTDB সফল কিন্তু Auth ব্যর্থ হলে
 *  সেটি success নয় — "RTDB তথ্য মুছে গেছে, কিন্তু Authentication account
 *  মোছা যায়নি" বার্তা দেখা যায়।
 */

import { deleteUser } from "firebase/auth";
import { NODES, getAuthInstance } from "./firebase";
import { listOnce, getRow, updatePaths, removePath, type Row } from "./rtdb";

/** Firebase Auth-এর UID: ২০–৬৪টি URL-safe অক্ষর (Firebase সাধারণত ২৮টি দেয়)। */
const AUTH_UID_RE = /^[A-Za-z0-9_-]{20,64}$/;

/** একটি মান Firebase Auth UID-এর মতো দেখতে কি না (ভুল resolve আটকাতে)। */
export function isAuthUid(value: unknown): boolean {
  return AUTH_UID_RE.test(String(value ?? "").trim());
}

/** একই রেকর্ডের মালিক UID বের করার ক্ষেত্রগুলো (পুরোনো/নতুন সব বানান)। */
const OWNER_KEYS = ["ownerUid", "uid", "userId", "ownerId", "user"] as const;

function ownerOf(row: any): string {
  if (!row || typeof row !== "object") return "";
  for (const key of OWNER_KEYS) {
    const value = String((row as any)[key] ?? "").trim();
    if (value) return value;
  }
  return "";
}

/** প্যানেলে ইতিমধ্যে লোড করা তালিকা থাকলে সেটি reuse করা হয় (নতুন read নয়)। */
export type RowSources = Partial<
  Record<"donors" | "users" | "admins" | "accounts" | "members" | "queue" | "requests" | "reports" | "messages", Row[]>
>;

async function rowsOf(node: string, cached?: Row[]): Promise<Row[]> {
  if (Array.isArray(cached)) return cached;
  try {
    return await listOnce(node);
  } catch (e) {
    console.warn("accountDelete read:", node, (e as Error)?.message);
    return [];
  }
}

/**
 * ডোনার-সম্পর্কিত রেকর্ড যে সব node-এ থাকতে পারে — existing RTDB structure
 * (`src/lib/firebase.ts` → NODES + docs/FIREBASE.md) থেকে নেওয়া।
 * **কোনো নতুন path অনুমান করা হয় না**: প্রতিটি node পড়ে, সত্যিই মেলে এমন
 * রেকর্ডই মোছা হয়।
 */
export const DONOR_NODES = [
  "users", "admins", "accounts", "donors", "members", "queue", "requests", "reports", "messages",
] as const;

/**
 * গ্লোবাল/সাংগঠনিক node — এখানে UID/Donor ID রেফারেন্স থাকলেও সেটি মোছা হয় না
 * (সংগঠনের কনটেন্ট নষ্ট করা যাবে না); শুধু রিপোর্ট করা হয় যাতে কিছু লুক্কায়িত
 * orphan থেকে না যায়।
 */
const REFERENCE_ONLY_NODES = ["gallery", "notices"] as const;

/* ═══════════════════════════════════════════════════════════════════
   ১. Identity chain — Donor ID → UID → account/profile
   ═══════════════════════════════════════════════════════════════════ */

export type IdentityChain = {
  donorId: string;
  uid: string;
  name: string;
  /** donors/{donorId} রেকর্ড আছে কি না */
  donorRow: boolean;
  /** users/{uid} রেকর্ড আছে কি না */
  userRow: boolean;
  /** admins/{uid} রেকর্ড আছে কি না (admin/moderator রেফারেন্স) */
  adminRow: boolean;
  /** accounts node-এ মেলা রেকর্ডের key */
  accountIds: string[];
  /** members node-এ মেলা ডোনার আবেদনের key */
  memberIds: string[];
  /** resolve ব্যর্থ/অমিল হলে কারণ (তখন কিছুই মোছা হবে না) */
  error?: string;
  warnings?: string[];
};

const pickFirst = (...values: unknown[]): string => {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
};

/**
 * Donor ID → UID → existing account/profile — এই chain যাচাই না হওয়া পর্যন্ত
 * কোনো deletion শুরু হয় না। শুধু Donor ID দেখে কখনো blindly মোছা হয় না।
 */
export async function resolveDonorIdentity(
  seed: { donorId?: string; uid?: string; name?: string; phone?: string; email?: string },
  sources: RowSources = {}
): Promise<IdentityChain> {
  const donorId = String(seed?.donorId ?? "").trim();
  const rawUid = String(seed?.uid ?? "").trim();
  const warnings: string[] = [];
  const out: IdentityChain = {
    donorId,
    uid: "",
    name: String(seed?.name ?? "").trim(),
    donorRow: false,
    userRow: false,
    adminRow: false,
    accountIds: [],
    memberIds: [],
    warnings,
  };

  if (!donorId && !rawUid) return { ...out, error: "ডোনার আইডি (Donor ID) পাওয়া যায়নি।" };
  if (rawUid && !isAuthUid(rawUid)) {
    /* পুরোনো রেকর্ডে `uid` ফিল্ডে অনেক সময় Donor ID-ই বসানো থাকে — সেটিকে UID
       ধরে কোনো অ্যাকাউন্ট মোছা হবে না; hint বাদ দিয়ে আবার resolve করা হয়। */
    warnings.push("uid হিসেবে দেওয়া মানটি Auth UID নয় — উপেক্ষা করা হয়েছে।");
  }
  const hintUid = rawUid && isAuthUid(rawUid) ? rawUid : "";

  /* ── ১. donors/{donorId} → মালিক UID ── */
  let donorOwner = "";
  if (donorId) {
    const donor = Array.isArray(sources.donors)
      ? sources.donors.find((d) => String(d?.id ?? "") === donorId)
      : await getRow(NODES.donors, donorId).catch(() => null);
    if (donor) {
      out.donorRow = true;
      donorOwner = ownerOf(donor);
      if (!out.name) out.name = String(donor.name ?? "").trim();
    }
  }

  /* ── ২. users node — UID দিয়ে এবং Donor ID দিয়ে ── */
  const users = await rowsOf(NODES.users, sources.users);
  const userByUid = hintUid ? users.find((u) => String(u?.id ?? "").trim() === hintUid) : undefined;
  const userByDonor = donorId ? users.find((u) => String(u?.donorId ?? "").trim() === donorId) : undefined;
  const uidFromDonor = userByDonor ? String(userByDonor.id ?? "").trim() || ownerOf(userByDonor) : "";

  /* ── ৩. সব সূত্র একমত? না হলে কিছুই মোছা হবে না ── */
  const candidates = [hintUid, donorOwner, uidFromDonor].filter((v) => v && isAuthUid(v));
  if (candidates.length && new Set(candidates).size > 1) {
    return { ...out, error: "UID মিলছে না — ভুল তথ্য দিয়ে কিছু মোছা হবে না।" };
  }
  const uid = candidates[0] || "";
  if (uid && !isAuthUid(uid)) return { ...out, error: "UID সঠিক নয় — ভুল তথ্য দিয়ে কিছু মোছা হবে না।" };
  out.uid = uid;

  /* ── ৪. Donor ID ↔ UID ক্রস-চেক (stale রেফারেন্সে ভুল বন্ধ করা যাবে না) ── */
  if (uid) {
    const userRow = userByUid || users.find((u) => String(u?.id ?? "").trim() === uid);
    if (userRow) {
      out.userRow = true;
      if (!out.name) out.name = String(userRow.name ?? "").trim();
      const savedDonorId = String(userRow.donorId ?? "").trim();
      if (donorId && savedDonorId && savedDonorId !== donorId) {
        const other = Array.isArray(sources.donors)
          ? sources.donors.find((d) => String(d?.id ?? "") === savedDonorId)
          : await getRow(NODES.donors, savedDonorId).catch(() => null);
        if (other) {
          return { ...out, error: "এই Donor ID ওই অ্যাকাউন্টের সাথে মেলে না — কিছু মোছা হবে না।" };
        }
        warnings.push(`users/${uid}/donorId (${savedDonorId}) পুরোনো — ডোনার রেকর্ড নেই, এগিয়ে যাওয়া হচ্ছে।`);
      }
    }
  }

  /* ── ৫. অ্যাকাউন্ট/প্রোফাইল রেফারেন্স (accounts, members, admins) ── */
  const accounts = await rowsOf(NODES.accounts, sources.accounts);
  out.accountIds = accounts
    .filter((row) => belongsTo(row, uid, donorId))
    .map((row) => String(row?.id ?? "").trim())
    .filter(Boolean);
  const members = await rowsOf(NODES.members, sources.members);
  out.memberIds = members
    .filter((row) => belongsTo(row, uid, donorId))
    .map((row) => String(row?.id ?? "").trim())
    .filter(Boolean);
  if (uid) {
    const admins = Array.isArray(sources.admins)
      ? sources.admins.find((a) => String(a?.id ?? "").trim() === uid)
      : await getRow(NODES.admins, uid).catch(() => null);
    out.adminRow = !!admins;
  }
  return out;
}

/** একটি রেকর্ড এই UID/Donor ID-এর কি না। */
function belongsTo(row: any, uid: string, donorId: string): boolean {
  if (!row || typeof row !== "object") return false;
  const owner = ownerOf(row);
  if (uid && owner === uid) return true;
  if (uid && String(row?.id ?? "").trim() === uid) return true;
  if (donorId) {
    if (String(row?.donorId ?? "").trim() === donorId) return true;
    if (String(row?.id ?? "").trim() === donorId) return true;
    /* Doner panel-এর পুরোনো queue key: PD-<sanitized donorId/uid> */
    const short = donorId.replace(/[^A-Za-z0-9]/g, "").slice(-10);
    if (short && /^PD-/.test(String(row?.id ?? "")) && String(row?.id ?? "").includes(short)) return true;
  }
  return false;
}

/* ═══════════════════════════════════════════════════════════════════
   ২. মোছার path সংগ্রহ — কেবল সত্যিই থাকা রেকর্ড
   ═══════════════════════════════════════════════════════════════════ */

export type DeletionPlan = {
  donorId: string;
  uid: string;
  /** path → null (RTDB multi-path delete) */
  paths: Record<string, null>;
  /** node → মোছা হবে এমন রেকর্ডের id */
  matched: Record<string, string[]>;
  /** গ্লোবাল node-এ পাওয়া orphan রেফারেন্স (মোছা হয় না, শুধু জানানো হয়) */
  references: Record<string, string[]>;
};

/**
 * মোছার path গুলো তৈরি করে — **কোনো path অনুমান করা হয় না**: প্রতিটি node
 * আগে পড়া হয়, শুধু সত্যিই মিলে যাওয়া রেকর্ডগুলোই তালিকায় যায়।
 * বিদ্যমান database structure-এ কোনো পরিবর্তন করা হয় না।
 */
export async function planDonorDeletion(
  identity: IdentityChain,
  sources: RowSources = {}
): Promise<DeletionPlan> {
  const donorId = identity.donorId;
  const uid = identity.uid;
  const paths: Record<string, null> = {};
  const matched: Record<string, string[]> = {};
  const references: Record<string, string[]> = {};
  const note = (node: string, id: string) => {
    (matched[node] = matched[node] || []).push(String(id));
  };
  const add = (node: string, id: string) => {
    paths[`${node}/${id}`] = null;
    note(node, id);
  };

  /* প্রতিটি node একবার পড়ে নেওয়া হয় — এরপর **যাচাই করেই** path যোগ করা হয়,
     তাই কোনো path অনুমান করা হয় না (রেকর্ড থেকে গেলে আর চেষ্টাও করা হয় না)। */
  const rowsByNode: Record<string, Row[]> = {};
  for (const node of DONOR_NODES) {
    rowsByNode[node] = await rowsOf(node, sources[node as keyof RowSources] as Row[] | undefined);
  }
  const exists = (node: string, id: string) =>
    (rowsByNode[node] || []).some((row) => String(row?.id ?? "").trim() === String(id).trim());

  /* সরাসরি UID/Donor ID-key করা রেকর্ড (থাকলেই শুধু) */
  if (donorId && exists(NODES.donors, donorId)) add(NODES.donors, donorId);
  if (uid) {
    if (exists(NODES.users, uid)) add(NODES.users, uid);
    if (exists(NODES.admins, uid)) add(NODES.admins, uid);
  }
  for (const id of identity.accountIds) if (exists(NODES.accounts, id)) add(NODES.accounts, id);

  /* বাকি সব node — UID/Donor ID রেফারেন্স অনুযায়ী (orphan রাখা যাবে না) */
  for (const node of DONOR_NODES) {
    for (const row of rowsByNode[node] || []) {
      const id = String(row?.id ?? "").trim();
      if (!id || !belongsTo(row, uid, donorId)) continue;
      if (paths[`${node}/${id}`] !== undefined) continue;
      add(node, id);
    }
  }

  /* গ্লোবাল node — শুধু orphan রেফারেন্স শনাক্ত (মোছা হয় না) */
  for (const node of REFERENCE_ONLY_NODES) {
    const rows = await rowsOf(node, sources[node as keyof RowSources] as Row[] | undefined);
    const hits = rows.filter((row) => belongsTo(row, uid, donorId)).map((row) => String(row?.id ?? "").trim());
    if (hits.length) references[node] = hits;
  }

  return { donorId, uid, paths, matched, references };
}

/* ═══════════════════════════════════════════════════════════════════
   ৩. সম্পূর্ণ ডিলিট — RTDB → Auth → Report
   ═══════════════════════════════════════════════════════════════════ */

export type DeletionStep = {
  id: string;
  label: string;
  ok: boolean;
  /** রেকর্ডই ছিল না — এটি failure নয়। */
  skipped?: boolean;
  error?: string;
};

export type DonorDeletionResult = {
  ok: boolean;
  donorId: string;
  uid: string;
  name: string;
  /** Realtime Database অংশ */
  rtdb: "ok" | "failed" | "skipped";
  /** Firebase Authentication অংশ */
  auth: "deleted" | "missing" | "failed" | "skipped";
  steps: DeletionStep[];
  failed: DeletionStep[];
  /** মোছা হয়েছে এমন RTDB path-এর সংখ্যা */
  removed: number;
  /** Authentication deletion-এর উৎস (self-only — Firebase নিরাপত্তা সীমা) */
  server: "self" | "not-possible" | "failed";
  /** গ্লোবাল node-এ পাওয়া orphan রেফারেন্স (মোছা হয়নি) */
  references: Record<string, string[]>;
  warnings: string[];
};

const STEP_LABELS: Record<string, string> = {
  donor: "ডোনার প্রোফাইল",
  auth: "Firebase Authentication অ্যাকাউন্ট",
  rtdb: "Realtime Database তথ্য",
  server: "নিরাপদ সার্ভার অনুরোধ",
  users: "অ্যাকাউন্ট তথ্য",
  admins: "ভূমিকা/অ্যাক্সেস রেকর্ড",
  accounts: "অ্যাকাউন্ট রেকর্ড",
  members: "ডোনার আবেদন",
  queue: "অনুমোদন/অপেক্ষমাণ আবেদন",
  requests: "জরুরি আবেদন",
  reports: "রিপোর্ট",
  messages: "বার্তা",
  donors: "ডোনার প্রোফাইল",
};

/**
 * একটি ডোনার সম্পূর্ণভাবে মুছে ফেলা — RTDB-এর সব সংশ্লিষ্ট তথ্য + Firebase
 * Authentication account (কোনো Storage dependency নেই)।
 *
 *   1. identity chain resolve + verify (মেলে না → কিছুই মোছা হবে না)
 *   2. **RTDB delete** — client RTDB security rules-এর মধ্যেই (admin অনুমোদিত)
 *   3. **Auth delete** — সব RTDB কাজ সফল হবার পর; নিজের অ্যাকাউন্ট হলে
 *      client SDK দিয়ে, অন্য কারও হলে সম্ভব নয় (warning সহ রিপোর্ট)
 *   4. report — কোন অংশ মুছেছে/মুছেনি তা স্পষ্টভাবে
 *
 * Listener-গুলোর জন্যই তালিকা/পরিসংখ্যান realtime-এ আপডেট হয় — কোনো reload বা
 * পুরো ডেটাবেস রিলোড লাগে না।
 */
export async function deleteDonorCompletely(
  seed: { donorId?: string; uid?: string; name?: string; phone?: string; email?: string },
  sources: RowSources = {},
  opts: { verify?: boolean } = {}
): Promise<DonorDeletionResult> {
  const identity = await resolveDonorIdentity(seed, sources);
  const empty = (over: Partial<DonorDeletionResult>): DonorDeletionResult => ({
    ok: false,
    donorId: identity.donorId,
    uid: identity.uid,
    name: identity.name,
    rtdb: "skipped",
    auth: "skipped",
    steps: [],
    failed: [],
    removed: 0,
    server: "not-possible",
    references: {},
    warnings: identity.warnings || [],
    ...over,
  });

  /* ── ১. identity verify ── */
  if (identity.error) {
    const failed: DeletionStep[] = [{
      id: "resolve",
      label: "ডোনার শনাক্তকরণ (Donor ID → UID → অ্যাকাউন্ট)",
      ok: false,
      error: identity.error,
    }];
    return empty({ steps: failed, failed, rtdb: "failed" });
  }

  const steps: DeletionStep[] = [];
  const warnings: string[] = [...(identity.warnings || [])];
  let removed = 0;
  let rtdbState: DonorDeletionResult["rtdb"] = "skipped";
  let authState: DonorDeletionResult["auth"] = "skipped";
  let serverState: DonorDeletionResult["server"] = "not-possible";

  /* ── ২. Realtime Database — client security rules-এর মধ্যেই (admin অনুমোদিত) ── */
  const plan = await planDonorDeletion(identity, sources);
  const rtdbOk = await deletePaths(plan.paths, steps);
  rtdbState = rtdbOk ? "ok" : "failed";
  removed = rtdbOk ? Object.keys(plan.paths).length : 0;
  steps.push({
    id: "rtdb",
    label: STEP_LABELS.rtdb,
    ok: rtdbOk,
    error: rtdbOk ? undefined : "Realtime Database-এর সব রেকর্ড মোছা যায়নি।",
  });

  /* ── ৩. Firebase Authentication — RTDB সফল হবার পরেই ──
     Firebase নিরাপত্তা নিয়ম: ব্রাউজার থেকে অন্য কারও Auth account মোছা যায় না
     (Admin SDK/Cloud Function প্রয়োজন)। তাই শুধু নিজের অ্যাকাউন্ট (যেমন
     Doner panel-এর "অ্যাকাউন্ট মুছুন") client SDK দিয়ে মোছা হয়; অন্য ক্ষেত্রে
     `skipped` + স্পষ্ট warning — কোনো মিথ্যে সাফল্য নয়। */
  if (!rtdbOk) {
    authState = "skipped";
    serverState = "failed";
    steps.push({
      id: "auth",
      label: STEP_LABELS.auth,
      ok: false,
      error: "RTDB তথ্য মোছা যায়নি, তাই Authentication অ্যাকাউন্ট মোছা হয়নি।",
    });
  } else {
    const auth = getAuthInstance();
    const currentUid = String(auth?.currentUser?.uid || "").trim();
    if (identity.uid && currentUid && identity.uid === currentUid) {
      const user = auth?.currentUser;
      try {
        if (user) await deleteUser(user);
        authState = "deleted";
        serverState = "self";
        steps.push({ id: "auth", label: STEP_LABELS.auth, ok: true });
      } catch (e) {
        authState = "failed";
        serverState = "failed";
        steps.push({
          id: "auth",
          label: STEP_LABELS.auth,
          ok: false,
          error: (e as Error)?.message || "Authentication অ্যাকাউন্ট মোছা যায়নি।",
        });
      }
    } else if (identity.uid) {
      authState = "skipped";
      serverState = "not-possible";
      warnings.push(
        "Firebase Authentication অ্যাকাউন্টটি রয়ে গেছে — অন্য ব্যবহারকারীর Auth account শুধু " +
        "server-side (Admin SDK) দিয়ে মোছা যায়; Firebase Console → Authentication থেকে মুছুন।",
      );
      steps.push({
        id: "auth",
        label: STEP_LABELS.auth,
        ok: false,
        skipped: true,
        error: "অন্য ব্যবহারকারীর Authentication অ্যাকাউন্ট ব্রাউজার থেকে মোছা যায় না।",
      });
    } else {
      authState = "skipped";
      serverState = "not-possible";
      steps.push({
        id: "auth",
        label: STEP_LABELS.auth,
        ok: false,
        skipped: true,
        error: "এই ডোনার রেকর্ডের সাথে কোনো Authentication UID যুক্ত ছিল না।",
      });
    }
  }


  /* ── ৩. যাচাই (read-only) — কোনো রেকর্ড থেকে গেলে rules-এর মধ্যেই মোছা ──
     সাধারণত কিছুই থাকে না; সার্ভার পুরোনো build-এ থাকলেও কাজ সম্পূর্ণ হয়। */
  if (opts.verify !== false) {
    let leftovers: DeletionPlan = { donorId: identity.donorId, uid: identity.uid, paths: {}, matched: {}, references: {} };
    try {
      leftovers = await planDonorDeletion(identity, {});
    } catch (e) {
      console.warn("accountDelete verify:", (e as Error)?.message);
    }
    const pending = Object.keys(leftovers.paths);
    if (pending.length) {
      const okCleanup = await deletePaths(leftovers.paths, steps);
      removed += okCleanup ? pending.length : 0;
      if (!okCleanup) rtdbState = "failed";
      else if (rtdbState !== "ok") rtdbState = "ok";
    }
    if (Object.keys(leftovers.references).length) {
      for (const [node, ids] of Object.entries(leftovers.references)) {
        warnings.push(`${node} node-এ ${ids.length}টি রেফারেন্স রয়ে গেছে (সাংগঠনিক কনটেন্ট — মোছা হয়নি)।`);
      }
    }
  }

  /* একই node-এর একাধিক ধাপ এলে একটিতে মিলিয়ে দিই */
  const merged: DeletionStep[] = [];
  for (const step of steps) {
    const prev = merged.find((s) => s.id === step.id);
    if (!prev) {
      merged.push({ ...step });
      continue;
    }
    prev.ok = prev.ok && step.ok;
    prev.skipped = prev.skipped && step.skipped;
    if (!step.ok && step.error) prev.error = prev.error ? `${prev.error}; ${step.error}` : step.error;
  }

  /* অন্য ব্যবহারকারীর Auth account মোছা Firebase নিরাপত্তা নিয়মেই সম্ভব নয়
     (`skipped`) — সেটিকে hard failure ধরা হয় না, কিন্তু warning-এ জানানো হয়।
     RTDB বা নিজের Auth delete ব্যর্থ হলেই কেবল সত্যিকারের ব্যর্থতা। */
  const failed = merged.filter((s) => !s.ok && !(s.id === "auth" && authState === "skipped"));
  return {
    ok: rtdbState === "ok" && failed.length === 0,
    donorId: identity.donorId,
    uid: identity.uid,
    name: identity.name,
    rtdb: rtdbState,
    auth: authState,
    steps: merged,
    failed,
    removed,
    server: serverState,
    references: plan.references || {},
    warnings,
  };
}

/** path গুলো একটি atomic multi-path update-এ মোছা; ব্যর্থ হলে একে একে চেষ্টা। */
async function deletePaths(paths: Record<string, null>, steps: DeletionStep[]): Promise<boolean> {
  const list = Object.keys(paths);
  if (!list.length) return true;
  try {
    await updatePaths(paths);
    return true;
  } catch (e) {
    const message = (e as Error)?.message || "তথ্য মোছা যায়নি।";
    let okAll = true;
    for (const path of list) {
      const node = String(path || "").split("/")[0] || path;
      try {
        await removePath(path);
      } catch (err) {
        okAll = false;
        steps.push({
          id: node,
          label: STEP_LABELS[node] || node,
          ok: false,
          error: (err as Error)?.message || message,
        });
      }
    }
    return okAll;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   ৪. বার্তা — সাফল্য/আংশিক ব্যর্থতা
   ═══════════════════════════════════════════════════════════════════ */

/** একক ডোনার — সাফল্য বা আংশিক/পূর্ণ ব্যর্থতার বার্তা। */
export function deletionMessage(result: DonorDeletionResult): string {
  if (result.ok) return "ডোনার সফলভাবে সম্পূর্ণ মুছে ফেলা হয়েছে";
  const identityError = result.failed.find((f) => f.id === "resolve");
  if (identityError) return identityError.error || "ডোনার শনাক্ত করা যায়নি।";
  if (result.rtdb === "ok" && result.auth === "failed") {
    return "ডোনারের RTDB তথ্য মুছে ফেলা হয়েছে, কিন্তু Authentication account মুছে ফেলা যায়নি।";
  }
  if (result.rtdb === "ok" && result.auth === "skipped") {
    /* অন্য ব্যবহারকারীর Auth account — server-side প্রিভিলেজ ছাড়া মোছা যায় না */
    return "ডোনারের RTDB তথ্য মুছে ফেলা হয়েছে, কিন্তু Authentication account মুছা সম্ভব হয়নি " +
      "(Firebase Console → Authentication থেকে মুছুন)।";
  }
  if (result.rtdb === "failed") {
    const detail = result.failed.find((f) => f.id === "rtdb" || f.id === "server" || f.id === "auth");
    return "ডোনারের RTDB তথ্য মুছে ফেলা যায়নি" + (detail?.error ? ` — ${detail.error}` : "।");
  }
  return "ডোনার সম্পূর্ণ মুছে ফেলা যায়নি — " +
    (result.failed.map((f) => f.label + (f.error ? ` (${f.error})` : "")).join(", ") || "অজানা সমস্যা") + "।";
}

/** পুরোনো API-র সাথে সামঞ্জস্য — ব্যর্থতার সারাংশ। */
export function describeDeletionFailure(name: string, failed: DeletionStep[]): string {
  const target = String(name || "").trim() || "ডোনার";
  const parts = failed
    .map((f) => f.label + (f.error ? ` (${f.error})` : ""))
    .filter(Boolean)
    .join(", ");
  return `${target} সম্পূর্ণ মুছে ফেলা যায়নি — ${parts || "অজানা সমস্যা"}।`;
}
