/**
 * CBDC — Realtime Database access layer
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  অ্যাপের **একমাত্র** ডাটাবেস হলো Firebase Realtime Database। Firestore আর
 *  ব্যবহার হয় না। পেজগুলো সরাসরি `firebase/database` আমদানি না করে এখানকার
 *  ছোট, টাইপ-করা helper গুলো ব্যবহার করে — ফলে:
 *
 *    • সব জায়গায় একই data source ও একই normalisation নিয়ম থাকে,
 *    • Add / Edit / Delete করলে `watchList()` এর মাধ্যমে যুক্ত সব স্ক্রিনে
 *      সঙ্গে সঙ্গে Live Update হয় (কোনো manual refresh বা দ্বিতীয়বার লেখা লাগে না),
 *    • কোনো hardcoded / demo data নেই — যা দেখা যায়, তার সবই ডাটাবেসের বাস্তব তথ্য।
 *
 *  Data shape: প্রতিটি top-level node একটি map — `donors/{id} = {...}`।
 *  পড়ার সময় সেটি `{ id, ...value }` অবজেক্টের array-তে রূপান্তরিত হয়, যাতে
 *  পুরোনো (Firestore-যুগের) কোড অপরিবর্তিত থাকে।
 */

import {
  ref,
  child,
  push,
  get,
  set,
  update as rtdbUpdate,
  remove,
  onValue,
  query,
  orderByChild,
  equalTo,
  limitToFirst,
  runTransaction,
  serverTimestamp as rtdbServerTimestamp,
  type Database,
  type Query,
} from "firebase/database";
import { getRtdb } from "./firebase";

export type Row = Record<string, any> & { id: string };

/** সার্ভার-সময় (RTDB placeholder) — createdAt/updatedAt-এ ব্যবহার করুন। */
export const serverTime = rtdbServerTimestamp;

/** ISO string — RTDB-তে টাইমস্ট্যাম্প পড়া সহজ রাখতে অনেক জায়গায় এটাই যথেষ্ট। */
export const nowIso = (): string => new Date().toISOString();

function db(): Database | null {
  return getRtdb();
}

/**
 * RTDB Security Rules-এর কারণে read ব্লক হয়েছে কি না।
 * SDK-তে error.code = "PERMISSION_DENIED" (v8-style) অথবা "database/permission-denied"
 * (modular) — দুটোই ধরা হয়। Denied read আবার চেষ্টা করা নিরর্থক — ফলে অপ্রয়োজনীয়
 * network round-trip ও দীর্ঘ loading এড়ানো যায়।
 */
export function isPermissionDenied(err: unknown): boolean {
  try {
    const anyErr = err as any;
    const code = String(anyErr?.code || "").toLowerCase();
    const msg = String(anyErr?.message || "").toLowerCase();
    return (
      code.includes("permission-denied") ||
      code.includes("permission_denied") ||
      msg.includes("permission_denied") ||
      msg.includes("permission denied")
    );
  } catch {
    return false;
  }
}

/**
 * `getRow`-এর মতোই একটি রেকর্ড পড়া, কিন্তু error গিলে ফেলে না —
 * `{ row, denied }` ফেরত দেয়। এতে caller জানতে পারে রেকর্ড সত্যিই নেই,
 * নাকি rules-এর কারণে পড়াই যায়নি (তখন পরবর্তী fallback query বাদ দেওয়া যায়)।
 */
export async function probeRow(
  node: string,
  id: string
): Promise<{ row: Row | null; denied: boolean }> {
  const d = db();
  if (!d || !id) return { row: null, denied: false };
  try {
    const snap = await get(child(ref(d, node), String(id)));
    const v = snap.val();
    if (!v) return { row: null, denied: false };
    const row =
      typeof v === "object" ? ({ ...v, id: v.id || id } as Row) : ({ id, value: v } as Row);
    return { row, denied: false };
  } catch (e) {
    console.warn("rtdb probeRow:", node, id, (e as Error)?.message);
    return { row: null, denied: isPermissionDenied(e) };
  }
}

/** Donor UID-এর serial counter node — `_meta/donorCounter/<year>`-এ ধারাবাহিক নম্বর। */
export const DONOR_COUNTER_NODE = "_meta/donorCounter";

/** RTDB-তে ফরম্যাট করা Donor UID: CBDC-<year>-<0001> */
export function formatDonorId(seq: number | string, year: number = new Date().getFullYear()): string {
  return `CBDC-${year}-${String(Number(seq) || 0).padStart(4, "0")}`;
}

/**
 * পরবর্তী ধারাবাহিক Donor UID তৈরি করে (যেমন CBDC-2026-0001, CBDC-2026-0002 …)।
 * Realtime Database-এ atomic transaction (`_meta/donorCounter/<year>`) ব্যবহার করা হয়,
 * তাই একসাথে অনেকগুলো Account তৈরি হলেও কোনো নম্বর duplicate হয় না।
 * কোথাও random/number-from-uid ব্যবহার হয় না।
 */
export async function nextDonorId(year: number = new Date().getFullYear()): Promise<string> {
  const d = db();
  if (!d) throw new Error("Realtime Database সংযোগ নেই।");
  const counterRef = ref(d, `${DONOR_COUNTER_NODE}/${year}`);
  let seq = 1;
  try {
    const res = await runTransaction(counterRef, (current) => {
      const n = Number(current ?? 0) || 0;
      return n + 1;
    }, { applyLocally: false });
    const val = res?.snapshot?.val();
    seq = Math.max(1, Number(val ?? 1) || 1);
  } catch (e) {
    console.warn("nextDonorId transaction failed:", (e as Error)?.message);
    // Transaction ব্যর্থ হলে আমরা কখনোই random UID তৈরি করি না —
    // কারণ সিরিয়াল ভেঙে যাবে। স্পষ্ট error দিয়ে ফিরে আসি।
    throw new Error("Donor UID তৈরি করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।");
  }
  return formatDonorId(seq, year);
}

/** RTDB snapshot map → `{id, ...value}` array (নাল-নিরাপদ)। */
export function snapToList(value: any): Row[] {
  if (!value || typeof value !== "object") return [];
  return Object.keys(value)
    .map((k) => {
      const v = value[k];
      if (v && typeof v === "object") return { ...v, id: v.id || k } as Row;
      return { id: k, value: v } as Row;
    })
    .filter(Boolean);
}

/** এক-বার পড়া: পুরো node → array। */
export async function listOnce(node: string): Promise<Row[]> {
  const d = db();
  if (!d) return [];
  try {
    const snap = await get(ref(d, node));
    return snapToList(snap.val());
  } catch (e) {
    console.warn("rtdb listOnce:", node, (e as Error)?.message);
    return [];
  }
}

/** এক-বার পড়া: একটি রেকর্ড। */
export async function getRow(node: string, id: string): Promise<Row | null> {
  const d = db();
  if (!d || !id) return null;
  try {
    const snap = await get(child(ref(d, node), String(id)));
    const v = snap.val();
    if (!v) return null;
    return typeof v === "object" ? ({ ...v, id: v.id || id } as Row) : ({ id, value: v } as Row);
  } catch (e) {
    console.warn("rtdb getRow:", node, id, (e as Error)?.message);
    return null;
  }
}

/**
 * Live listener — node-এর ডেটা বদলালেই callback আবার চলে।
 * রিটার্ন করা function ডাকলে listener বন্ধ হয়।
 */
export function watchList(
  node: string,
  cb: (rows: Row[]) => void,
  opts: { orderBy?: string; equals?: string | number | boolean; limit?: number } = {}
): () => void {
  const d = db();
  if (!d) return () => undefined;
  let q: Query = ref(d, node);
  try {
    if (opts.orderBy) {
      const parts: any[] = [orderByChild(opts.orderBy)];
      if (opts.equals !== undefined) parts.push(equalTo(opts.equals as any));
      if (opts.limit) parts.push(limitToFirst(opts.limit));
      q = query(ref(d, node), ...parts);
    } else if (opts.limit) {
      q = query(ref(d, node), limitToFirst(opts.limit));
    }
  } catch (e) {
    console.warn("rtdb query build:", node, (e as Error)?.message);
    q = ref(d, node);
  }
  try {
    return onValue(
      q,
      (snap) => {
        try {
          cb(snapToList(snap.val()));
        } catch (e) {
          console.warn("rtdb watch callback:", node, (e as Error)?.message);
        }
      },
      (err) => console.warn("rtdb watch:", node, err && err.message)
    );
  } catch (e) {
    console.warn("rtdb watch setup:", node, (e as Error)?.message);
    return () => undefined;
  }
}

/** একটি রেকর্ডে live listener। */
export function watchRow(node: string, id: string, cb: (row: Row | null) => void): () => void {
  const d = db();
  if (!d || !id) return () => undefined;
  try {
    return onValue(
      child(ref(d, node), String(id)),
      (snap) => {
        const v = snap.val();
        cb(v && typeof v === "object" ? ({ ...v, id: v.id || id } as Row) : null);
      },
      (err) => console.warn("rtdb watchRow:", node, id, err && err.message)
    );
  } catch (e) {
    console.warn("rtdb watchRow setup:", node, (e as Error)?.message);
    return () => undefined;
  }
}

/** নতুন রেকর্ড — key নিজে তৈরি হয়; নতুন id ফেরত দেয়। */
export async function addRow(node: string, data: Record<string, any>): Promise<string> {
  const d = db();
  if (!d) throw new Error("Realtime Database সংযোগ নেই।");
  const r = push(ref(d, node));
  const id = r.key as string;
  await set(r, { ...stripUndefined(data), id, createdAt: data.createdAt || nowIso(), updatedAt: nowIso() });
  return id;
}

/** নির্দিষ্ট id-তে রেকর্ড লেখা / সম্পূর্ণ প্রতিস্থাপন। */
export async function setRow(node: string, id: string, data: Record<string, any>): Promise<void> {
  const d = db();
  if (!d) throw new Error("Realtime Database সংযোগ নেই।");
  await set(child(ref(d, node), String(id)), {
    ...stripUndefined(data),
    id: String(id),
    updatedAt: nowIso(),
  });
}

/** আংশিক আপডেট (merge) — অন্য ফিল্ড অক্ষত থাকে। */
export async function updateRow(node: string, id: string, patch: Record<string, any>): Promise<void> {
  const d = db();
  if (!d) throw new Error("Realtime Database সংযোগ নেই।");
  await rtdbUpdate(child(ref(d, node), String(id)), { ...stripUndefined(patch), updatedAt: nowIso() });
}

/** রেকর্ড মুছে ফেলা — যুক্ত সব স্ক্রিন থেকেই সঙ্গে সঙ্গে চলে যায়। */
export async function removeRow(node: string, id: string): Promise<void> {
  const d = db();
  if (!d) throw new Error("Realtime Database সংযোগ নেই।");
  await remove(child(ref(d, node), String(id)));
}

/** একটি রেকর্ডের numeric field atomic ভাবে বাড়ায় — যেমন applicationCount। */
export async function incrementField(node: string, id: string, field: string, amount = 1): Promise<number> {
  const d = db();
  if (!d) throw new Error("Realtime Database সংযোগ নেই。");
  if (!id || !field) throw new Error("RTDB field is required.");
  const target = child(child(ref(d, node), String(id)), field);
  const result = await runTransaction(target, (current) => {
    const value = Number(current ?? 0);
    return (Number.isFinite(value) ? value : 0) + amount;
  }, { applyLocally: false });
  return Number(result.snapshot.val() ?? 0) || 0;
}

/** numeric field-কে কমপক্ষে নির্দিষ্ট মানে atomic ভাবে আনে। */
export async function ensureFieldAtLeast(node: string, id: string, field: string, minimum: number): Promise<number> {
  const d = db();
  if (!d) throw new Error("Realtime Database সংযোগ নেই。");
  if (!id || !field) throw new Error("RTDB field is required.");
  const target = child(child(ref(d, node), String(id)), field);
  const floor = Math.max(0, Number(minimum) || 0);
  const result = await runTransaction(target, (current) => {
    const value = Number(current ?? 0);
    return Math.max(floor, Number.isFinite(value) ? value : 0);
  }, { applyLocally: false });
  return Number(result.snapshot.val() ?? 0) || 0;
}

/** একাধিক path একসাথে (atomic) আপডেট — যেমন `{"users/u1/role":"admin"}`। */
export async function updatePaths(paths: Record<string, any>): Promise<void> {
  const d = db();
  if (!d) throw new Error("Realtime Database সংযোগ নেই।");
  await rtdbUpdate(ref(d), paths);
}

/* ══════════ Generic path helpers (Database Manager) ══════════
   উপরের helper গুলো node/id-ভিত্তিক; এগুলো যেকোনো root-relative path-এ
   কাজ করে। অ্যাডমিন প্যানেলের Database Manager-এ ব্যবহৃত হয়। Security Rules
   যথারীতি প্রযোজ্য — permission না থাকলে Firebase সরাসরি error ফেরত দেয়,
   কোনো bypass নয়। */
/** যেকোনো path একবার পড়া — সম্পূর্ণ raw মান (object/array/scalar/null)। */
export async function getPath(path: string): Promise<any> {
  const d = db();
  if (!d) throw new Error("Realtime Database সংযোগ নেই।");
  const p = String(path || "").replace(/^\/+/, "");
  const snap = await get(ref(d, p));
  return snap.val();
}

/** যেকোনো path-এ মান লেখা (সম্পূর্ণ প্রতিস্থাপন)। value যেকোনো JSON-compatible।
 *  null লিখলে সেই পথ মুছে যায় (RTDB-এ null = অস্তিত্বহীন)। */
export async function setPath(path: string, value: any): Promise<void> {
  const d = db();
  if (!d) throw new Error("Realtime Database সংযোগ নেই।");
  const p = String(path || "").replace(/^\/+/, "");
  await set(ref(d, p), value === undefined ? null : value);
}

/** যেকোনো path মুছে ফেলা (সহ সব child)। */
export async function removePath(path: string): Promise<void> {
  const d = db();
  if (!d) throw new Error("Realtime Database সংযোগ নেই।");
  const p = String(path || "").replace(/^\/+/, "");
  await remove(ref(d, p));
}

/**
 * যেকোনো path-এ live listener — raw মান বদলালেই callback চলে; unsubscribe ফেরত দেয়।
 *
 * `onErr` দিলে permission/rules-এর error সরাসরি caller-এর কাছে যায় (যেমন Database
 * Manager যাতে "অ্যাক্সেস নেই" অবস্থা দেখাতে পারে); না দিলে আগের মতো console.warn।
 */
export function watchPath(
  path: string,
  cb: (value: any) => void,
  onErr?: (err: Error) => void
): () => void {
  /* কোনো silent failure নয় — যদি database instance না থাকে বা setup ব্যর্থ হয়,
     caller-কে সরাসরি error জানানো হয়, যাতে UI "লোড হচ্ছে…"-এ চিরকাল আটকে না থাকে। */
  const d = db();
  if (!d) {
    const err = new Error("Firebase Realtime Database প্রস্তুত নয় (init হয়নি)।");
    console.error("watchPath: db not ready for", path);
    if (typeof onErr === "function") {
      try { onErr(err); } catch (e) { console.error("watchPath onErr:", e); }
    }
    return () => undefined;
  }
  const p = String(path || "").replace(/^\/+/, "");
  const target = p ? ref(d, p) : ref(d);   /* "" → নির্দিষ্ট root reference (path edge-case এড়াতে) */
  try {
    return onValue(
      target,
      (snap) => {
        try {
          cb(snap.val());
        } catch (e) {
          /* caller-এর render error লুকিয়ে রাখা হয় না — console-এ দৃশ্যমান */
          console.error("watchPath cb (" + p + "):", (e as Error)?.message);
        }
      },
      (err) => {
        if (typeof onErr === "function") {
          try { onErr(err as Error); } catch (e) { console.error("watchPath onErr:", (err as Error)?.message, e); }
        } else console.error("watchPath (" + p + "):", err && err.message);
      }
    );
  } catch (e) {
    const err = new Error("watchPath setup failed: " + ((e as Error)?.message || e));
    console.error(err.message);
    if (typeof onErr === "function") {
      try { onErr(err); } catch (_) { /* ignore */ }
    }
    return () => undefined;
  }
}

/** একটি ফিল্ডের মান দিয়ে প্রথম মিলে যাওয়া রেকর্ড খোঁজা (index দরকার)। */
export async function findBy(
  node: string,
  field: string,
  value: string | number | boolean
): Promise<Row | null> {
  const d = db();
  if (!d) return null;
  try {
    const snap = await get(query(ref(d, node), orderByChild(field), equalTo(value as any), limitToFirst(1)));
    const rows = snapToList(snap.val());
    return rows[0] || null;
  } catch (e) {
    /* Rules-এ read ব্লক হলে fallback full-node read-ও অবশ্যই denied হবে —
       নিরর্থক দ্বিতীয় round-trip এড়িয়ে সাথে সাথেই ফিরে আসি (দ্রুত loading)। */
    if (isPermissionDenied(e)) {
      console.warn("rtdb findBy denied:", node, field, (e as Error)?.message);
      return null;
    }
    // index না থাকলে RTDB warning দেয় — তখন client-side filter-এ fallback
    console.warn("rtdb findBy:", node, field, (e as Error)?.message);
    const all = await listOnce(node);
    return all.find((r) => r[field] === value) || null;
  }
}

/** `undefined` মান RTDB গ্রহণ করে না — লেখার আগে সেগুলো বাদ দেওয়া হয়। */
export function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const out: Record<string, any> = Array.isArray(obj) ? [] : {};
  for (const k of Object.keys(obj || {})) {
    const v = (obj as any)[k];
    if (v === undefined) continue;
    out[k] = v && typeof v === "object" && !(v instanceof Date) ? stripUndefined(v) : v;
  }
  return out as T;
}

export default {
  listOnce,
  getRow,
  probeRow,
  isPermissionDenied,
  watchList,
  watchRow,
  addRow,
  setRow,
  updateRow,
  removeRow,
  incrementField,
  ensureFieldAtLeast,
  updatePaths,
  findBy,
  snapToList,
  stripUndefined,
  serverTime,
  nowIso,
  getPath,
  setPath,
  removePath,
  watchPath,
};
