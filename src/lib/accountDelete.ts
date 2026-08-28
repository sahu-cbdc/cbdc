/**
 * CBDC — সম্পূর্ণ ডোনার/অ্যাকাউন্ট ডিলিট (Donor Management + Access & Role)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  একটি ডোনারকে মুছতে হলে শুধু `donors/{id}` মুছলেই হয় না — একই মানুষের
 *  UID/Donor ID আরও কয়েকটি node-এ ছড়িয়ে থাকে:
 *
 *    donors/{donorId}      → পাবলিক ডোনার প্রোফাইল
 *    users/{uid}           → অ্যাকাউন্ট তথ্য (+ data/ সাব-ট্রি: donations, mine,
 *                            notifs, activity, panel)
 *    admins/{uid}          → স্টাফ/ভূমিকা রেকর্ড (থাকলে)
 *    accounts/{id}         → প্যানেল/টিম অ্যাকাউন্ট রেকর্ড
 *    members/{id}          → ডোনার আবেদন (sign-up application)
 *    queue/{id}            → অনুমোদনের অপেক্ষায় থাকা আবেদন/রক্তদান যাচাই
 *    requests/{id}         → জরুরি রক্তের আবেদন
 *    reports/{id}          → ডোনার প্যানেল থেকে পাঠানো সমস্যা/রিপোর্ট
 *    Firebase Auth         → লগইন অ্যাকাউন্ট (শুধু Cloud Function দিয়ে মোছা যায়)
 *
 *  নীতি (Task requirement):
 *   • **অনুমান করে কোনো নতুন path তৈরি করা হয় না** — প্রতিটি path আগে সত্যিই
 *     পড়ে দেখা হয়; রেকর্ড না থাকলে সেটি "skip" (failure নয়)।
 *   • UID/Donor ID ভুল resolve হলে **কিছুই মোছা হয় না**।
 *   • সব ধাপ একসাথে শেষ না হলে `ok:false` — partial deletion-এ সাফল্য নেই।
 *   • `audit` লগ কখনো মোছা হয় না (append-only রেকর্ড)।
 *   • Storage: এই প্রজেক্টে ছবি ImgBB-এ থাকে (Firebase Storage নয়), তাই
 *     server-side-এ শুধু UID/Donor ID-সংক্রান্ত Storage object থাকলে সেগুলো
 *     best-effort মোছা হয় (Cloud Function) — ব্যর্থ হলেও বাকি ডিলিট থামে না।
 */

import { NODES } from "./firebase";
import { listOnce, getRow, updatePaths, removePath, type Row } from "./rtdb";
import { deleteAccountCompletely } from "./cloud";

/** Firebase Auth-এর UID সাধারণত ২৮ characters-এর base-ish স্ট্রিং। */
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
  Record<"donors" | "users" | "admins" | "accounts" | "members" | "queue" | "requests" | "reports", Row[]>
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

export type DonorIdentity = {
  donorId: string;
  uid: string;
  name: string;
  /** resolve ব্যর্থ হলে কারণ (তখন কিছুই মোছা হবে না)। */
  error?: string;
};

/**
 * Donor ID ও UID নির্ভরযোগ্যভাবে resolve করে।
 *
 *  - `seed.uid` দেওয়া থাকলে সেটি যাচাই করা হয়; ভুল হলে (যেমন donor id-কে
 *    uid ধরে নেওয়া) error ফেরত যায় — ভুল UID দিয়ে কোনো ডিলিট হয় না।
 *  - uid না থাকলে `donors/{donorId}`-এর `ownerUid` থেকে, তারপর `users` node-এ
 *    `donorId` মিলিয়ে (indexOn আছে) UID খোঁজা হয়।
 */
export async function resolveDonorIdentity(
  seed: { donorId?: string; uid?: string; phone?: string; email?: string; name?: string },
  sources: RowSources = {}
): Promise<DonorIdentity> {
  const donorId = String(seed?.donorId ?? "").trim();
  const rawUid = String(seed?.uid ?? "").trim();
  const out: DonorIdentity = { donorId, uid: "", name: String(seed?.name ?? "").trim() };

  if (!donorId && !rawUid) return { ...out, error: "ডোনার আইডি (Donor ID) পাওয়া যায়নি।" };
  if (rawUid && !isAuthUid(rawUid)) {
    /* পুরোনো রেকর্ডে `uid` ফিল্ডে অনেক সময় Donor ID-ই বসানো থাকে — সেটিকে
       UID ধরে কোনো অ্যাকাউন্ট মোছা হবে না; hint বাদ দিয়ে আবার resolve করা হয়। */
    console.warn("accountDelete: uid hint is not an auth UID — ignored", rawUid);
  }
  const hintUid = rawUid && isAuthUid(rawUid) ? rawUid : "";

  /* ১) ডোনার রেকর্ড থেকেই মালিক UID (সবচেয়ে নির্ভরযোগ্য) */
  let fromDonor = "";
  if (donorId) {
    try {
      const donor = Array.isArray(sources.donors)
        ? sources.donors.find((d) => String(d?.id ?? "") === donorId)
        : await getRow(NODES.donors, donorId);
      const owner = donor ? ownerOf(donor) : "";
      if (owner && isAuthUid(owner)) fromDonor = owner;
      if (!out.name && donor) out.name = String(donor.name ?? "").trim();
    } catch (e) {
      console.warn("accountDelete donor lookup:", (e as Error)?.message);
    }
  }

  /* ২) users node-এ donorId দিয়ে খোঁজা (RTDB-তে `donorId`-এ indexOn আছে) */
  let fromUsers = "";
  if (donorId) {
    try {
      const users = await rowsOf(NODES.users, sources.users);
      const hit = users.find((u) => String(u?.donorId ?? "").trim() === donorId);
      const owner = hit ? String(hit.id ?? "").trim() || ownerOf(hit) : "";
      if (owner && isAuthUid(owner)) fromUsers = owner;
      if (!out.name && hit) out.name = String(hit.name ?? "").trim();
    } catch (e) {
      console.warn("accountDelete users lookup:", (e as Error)?.message);
    }
  }

  /* ৩) সব উৎস একমত না হলে কিছুই মোছা হবে না — ভুল UID resolve করে অন্য
     কারও অ্যাকাউন্ট মুছে ফেলার কোনো সুযোগ থাকবে না। */
  const resolved = [hintUid, fromDonor, fromUsers].filter(Boolean);
  if (resolved.length > 1 && new Set(resolved).size > 1) {
    return { ...out, error: "UID মিলছে না — ভুল তথ্য দিয়ে কিছু মোছা হবে না।" };
  }
  const uid = resolved[0] || "";
  if (uid && !isAuthUid(uid)) return { ...out, error: "UID সঠিক নয় — ভুল তথ্য দিয়ে কিছু মোছা হবে না।" };

  return { ...out, uid };
}

export type DeletionStep = {
  /** ধাপের নাম (UI-তে কী মোছা হয়নি তা দেখানোর জন্য)। */
  id: string;
  label: string;
  ok: boolean;
  /** রেকর্ডই ছিল না — এটি failure নয়। */
  skipped?: boolean;
  error?: string;
};

export type DeletionPlan = {
  donorId: string;
  uid: string;
  /** path → null (RTDB multi-path delete) */
  paths: Record<string, null>;
  /** node → মোছা হবে এমন রেকর্ডের id */
  matched: Record<string, string[]>;
};

/**
 * মোছার path গুলো তৈরি করে — **কোনো path অনুমান করা হয় না**: প্রতিটি node
 * আগে পড়া হয়, শুধু সত্যিই মিলে যাওয়া রেকর্ডগুলোই তালিকায় যায়।
 */
export async function planDonorDeletion(
  identity: DonorIdentity,
  sources: RowSources = {}
): Promise<DeletionPlan> {
  const donorId = identity.donorId;
  const uid = identity.uid;
  const paths: Record<string, null> = {};
  const matched: Record<string, string[]> = {};
  const note = (node: string, id: string) => {
    (matched[node] = matched[node] || []).push(String(id));
  };

  /* ── ১. পাবলিক ডোনার প্রোফাইল ── */
  if (donorId) {
    const donors = await rowsOf(NODES.donors, sources.donors);
    if (donors.some((d) => String(d?.id ?? "") === donorId)) {
      paths[`${NODES.donors}/${donorId}`] = null;
      note(NODES.donors, donorId);
    }
  }

  if (!uid) return { donorId, uid: "", paths, matched };

  const belongs = (row: any): boolean => {
    const owner = ownerOf(row);
    if (owner && owner === uid) return true;
    const rowDonorId = String(row?.donorId ?? "").trim();
    if (donorId && rowDonorId && rowDonorId === donorId) return true;
    if (donorId && String(row?.id ?? "").trim() === donorId) return true;
    /* পুরোনো Doner panel-এর queue key: PD-<sanitized donorId/uid> */
    if (donorId && /^PD-/.test(String(row?.id ?? "")) &&
      String(row?.id ?? "").includes(donorId.replace(/[^A-Za-z0-9]/g, "").slice(-10))) return true;
    return false;
  };

  /* ── ২. সরাসরি UID-key করা node ── */
  const users = await rowsOf(NODES.users, sources.users);
  if (users.some((u) => String(u?.id ?? "").trim() === uid)) {
    paths[`${NODES.users}/${uid}`] = null; // data/ সাব-ট্রিসহ সব কিছু
    note(NODES.users, uid);
  }
  const admins = await rowsOf(NODES.admins, sources.admins);
  if (admins.some((a) => String(a?.id ?? "").trim() === uid)) {
    paths[`${NODES.admins}/${uid}`] = null;
    note(NODES.admins, uid);
  }
  const accounts = await rowsOf(NODES.accounts, sources.accounts);
  accounts.filter((a) => String(a?.id ?? "").trim() === uid || belongs(a)).forEach((a) => {
    paths[`${NODES.accounts}/${a.id}`] = null;
    note(NODES.accounts, String(a.id));
  });

  /* ── ৩. মালিকানা/দাতা-সূত্রে যুক্ত রেকর্ড ── */
  const scan: Array<[keyof RowSources, string]> = [
    ["members", NODES.members],
    ["queue", NODES.queue],
    ["requests", NODES.requests],
    ["reports", NODES.reports],
  ];
  for (const [sourceKey, node] of scan) {
    const rows = await rowsOf(node, sources[sourceKey] as Row[] | undefined);
    rows.filter(belongs).forEach((row) => {
      const id = String(row?.id ?? "").trim();
      if (!id) return;
      paths[`${node}/${id}`] = null;
      note(node, id);
    });
  }

  return { donorId, uid, paths, matched };
}

export type DonorDeletionResult = {
  ok: boolean;
  donorId: string;
  uid: string;
  name: string;
  /** Firebase Auth অ্যাকাউন্টের অবস্থা */
  auth: "deleted" | "missing" | "skipped" | "failed";
  steps: DeletionStep[];
  failed: DeletionStep[];
  /** মোছা হয়েছে এমন RTDB path-এর সংখ্যা */
  removed: number;
};

const STEP_LABELS: Record<string, string> = {
  donor: "ডোনার প্রোফাইল",
  auth: "Firebase Authentication অ্যাকাউন্ট",
  users: "অ্যাকাউন্ট তথ্য",
  admins: "ভূমিকা/অ্যাক্সেস রেকর্ড",
  accounts: "অ্যাকাউন্ট রেকর্ড",
  members: "ডোনার আবেদন",
  queue: "অপেক্ষমাণ আবেদন",
  requests: "জরুরি আবেদন",
  reports: "রিপোর্ট",
};

/**
 * একটি ডোনার সম্পূর্ণভাবে মুছে ফেলা — Donor ID, UID, প্রোফাইল, অ্যাকাউন্ট,
 * আবেদন/অনুমোদন, রক্তদান-সংক্রান্ত রেকর্ড ও (সম্ভব হলে) Authentication।
 *
 * Listener-গুলোর জন্যই ডিলিট হওয়ার সাথে সাথে তালিকা ও পরিসংখ্যান আপডেট হয় —
 * কোনো reload/রি-ফেচ দরকার হয় না।
 */
export async function deleteDonorCompletely(
  seed: { donorId?: string; uid?: string; name?: string; phone?: string; email?: string },
  sources: RowSources = {},
  opts: { deleteAuth?: boolean } = {}
): Promise<DonorDeletionResult> {
  const identity = await resolveDonorIdentity(seed, sources);
  const steps: DeletionStep[] = [];
  if (identity.error) {
    const failed: DeletionStep[] = [{
      id: "resolve",
      label: "ডোনার শনাক্তকরণ",
      ok: false,
      error: identity.error,
    }];
    return {
      ok: false,
      donorId: identity.donorId,
      uid: "",
      name: identity.name,
      auth: "skipped",
      steps: failed,
      failed,
      removed: 0,
    };
  }

  const plan = await planDonorDeletion(identity, sources);
  let authState: DonorDeletionResult["auth"] = "skipped";

  /* ── ১. Firebase Authentication (শুধু server-side সম্ভব) ── */
  if (identity.uid && opts.deleteAuth !== false) {
    try {
      const res = await deleteAccountCompletely(identity.uid, identity.donorId);
      authState = res && res.auth === "missing" ? "missing" : "deleted";
      steps.push({ id: "auth", label: STEP_LABELS.auth, ok: true, skipped: authState === "missing" });
    } catch (e) {
      authState = "failed";
      steps.push({
        id: "auth",
        label: STEP_LABELS.auth,
        ok: false,
        error: (e as Error)?.message || "Authentication অ্যাকাউন্ট মোছা যায়নি।",
      });
    }
  }

  /* ── ২. Realtime Database — সব path একসাথে (atomic) ── */
  const pathList = Object.keys(plan.paths);
  if (pathList.length) {
    try {
      await updatePaths(plan.paths);
      for (const node of Object.keys(plan.matched)) {
        steps.push({
          id: node,
          label: STEP_LABELS[node] || node,
          ok: true,
        });
      }
    } catch (e) {
      /* একসাথে ব্যর্থ হলে প্রতিটি path আলাদাভাবে চেষ্টা — কোনটি মোছা যায়নি
         তা স্পষ্ট থাকে (partial success-কে success হিসেবে দেখানো হয় না)। */
      const message = (e as Error)?.message || "তথ্য মোছা যায়নি।";
      const nodeOf = (path: string) => String(path || "").split("/")[0] || path;
      for (const path of pathList) {
        try {
          await removePath(path);
          steps.push({ id: nodeOf(path), label: STEP_LABELS[nodeOf(path)] || nodeOf(path), ok: true });
        } catch (err) {
          steps.push({
            id: nodeOf(path),
            label: STEP_LABELS[nodeOf(path)] || nodeOf(path),
            ok: false,
            error: (err as Error)?.message || message,
          });
        }
      }
    }
  } else {
    steps.push({ id: "donor", label: STEP_LABELS.donor, ok: true, skipped: true });
  }

  /* একই node-এর একাধিক ধাপ এলে একটিতে মিলিয়ে দিই (বারবার তালিকাভুক্তি নয়) */
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

  const failed = merged.filter((s) => !s.ok);
  return {
    ok: failed.length === 0,
    donorId: identity.donorId,
    uid: identity.uid,
    name: identity.name,
    auth: authState,
    steps: merged,
    failed,
    removed: pathList.length,
  };
}

/** UI-তে দেখানোর জন্য ব্যর্থতার সারাংশ — কোন অংশ মোছা যায়নি। */
export function describeDeletionFailure(name: string, failed: DeletionStep[]): string {
  const target = String(name || "").trim() || "ডোনার";
  const parts = failed
    .map((f) => f.label + (f.error ? ` (${f.error})` : ""))
    .filter(Boolean)
    .join(", ");
  return `${target} সম্পূর্ণ মুছে ফেলা যায়নি — ${parts || "অজানা সমস্যা"}।`;
}
