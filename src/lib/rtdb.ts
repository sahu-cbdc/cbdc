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
  if (!d) return;
  await remove(child(ref(d, node), String(id)));
}

/** একাধিক path একসাথে (atomic) আপডেট — যেমন `{"users/u1/role":"admin"}`। */
export async function updatePaths(paths: Record<string, any>): Promise<void> {
  const d = db();
  if (!d) return;
  await rtdbUpdate(ref(d), paths);
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
  watchList,
  watchRow,
  addRow,
  setRow,
  updateRow,
  removeRow,
  updatePaths,
  findBy,
  snapToList,
  stripUndefined,
  serverTime,
  nowIso,
};
