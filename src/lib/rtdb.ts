

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


export const serverTime = rtdbServerTimestamp;


export const nowIso = (): string => new Date().toISOString();

function db(): Database | null {
  return getRtdb();
}


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


export const DONOR_COUNTER_NODE = "_meta/donorCounter";

export const DONOR_SERIALS_NODE = "_meta/donorSerials";

const DONOR_ID_RE = /^CBDC-(\d{4})-(\d{4})$/i;

const CLAIM_FRESH_MS = 45_000;


export function formatDonorId(seq: number | string, year: number = new Date().getFullYear()): string {
  const n = Math.max(0, Math.floor(Number(seq) || 0));
  return `CBDC-${year}-${String(n).padStart(4, "0")}`;
}


export function parseDonorSerial(id: unknown): number {
  const m = String(id || "").trim().match(DONOR_ID_RE);
  if (!m) return 0;
  const n = Number(m[2]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function serialKey(seq: number): string {
  return String(seq).padStart(4, "0");
}

function parseClaimKey(k: string): number {
  const s = String(k || "").trim();
  if (/^\d{1,6}$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  return parseDonorSerial(s);
}

function isFreshClaim(val: any): boolean {
  if (!val) return false;
  const at = Date.parse(String((val && (val.at || val.claimedAt)) || ""));
  if (!Number.isFinite(at)) return false; 
  return Date.now() - at < CLAIM_FRESH_MS;
}


function collectSerialsFromDonors(rows: Row[]): { used: Set<number>; malformed: string[]; duplicates: string[] } {
  const used = new Set<number>();
  const seen = new Map<number, string>();
  const malformed: string[] = [];
  const duplicates: string[] = [];
  for (const r of rows || []) {
    const a = String(r.donorId || "").trim();
    const b = String(r.id || "").trim();
    const candidates = a && b && a !== b ? [a, b] : [a || b];
    for (const raw of candidates) {
      if (!raw) continue;
      const serial = parseDonorSerial(raw);
      if (!serial) {
        if (raw) malformed.push(raw);
        continue;
      }
      if (seen.has(serial) && seen.get(serial) !== raw) duplicates.push(raw);
      seen.set(serial, raw);
      used.add(serial);
    }
  }
  return { used, malformed, duplicates };
}

async function readDonorsOrThrow(): Promise<Row[]> {
  const d = db();
  if (!d) throw new Error("Realtime Database সংযোগ নেই।");
  const snap = await get(ref(d, "donors"));
  return snapToList(snap.val());
}


export async function auditDonorIds(): Promise<{ used: number[]; gaps: number[]; malformed: string[]; duplicates: string[] }> {
  const rows = await readDonorsOrThrow();
  const { used, malformed, duplicates } = collectSerialsFromDonors(rows);
  const nums = [...used].sort((a, b) => a - b);
  const max = nums.length ? nums[nums.length - 1] : 0;
  const gaps: number[] = [];
  for (let i = 1; i <= max; i++) if (!used.has(i)) gaps.push(i);
  try {
    console.info("[donor-id audit]", {
      count: nums.length,
      max,
      gaps: gaps.slice(0, 80),
      gapCount: gaps.length,
      malformed,
      duplicates,
    });
  } catch {  }
  return { used: nums, gaps, malformed, duplicates };
}

function smallestFreeSerial(used: Set<number>): number {
  const max = used.size ? Math.max(...used) : 0;
  for (let i = 1; i <= max; i++) if (!used.has(i)) return i;
  return max + 1;
}

function mergeFreshClaims(used: Set<number>, claims: any): void {
  if (!claims || typeof claims !== "object") return;
  for (const k of Object.keys(claims)) {
    const n = parseClaimKey(k);
    if (n > 0 && isFreshClaim(claims[k])) used.add(n);
  }
}


export async function nextDonorId(year: number = new Date().getFullYear()): Promise<string> {
  const d = db();
  if (!d) throw new Error("Realtime Database সংযোগ নেই।");
  try {
    await auditDonorIds();
  } catch (e) {
    console.warn("donor-id audit:", (e as Error)?.message);
  }

  for (let attempt = 0; attempt < 32; attempt++) {
    let donors: Row[];
    try {
      donors = await readDonorsOrThrow();
    } catch (e) {
      throw new Error("Donor তালিকা পড়া যায়নি — নতুন ID ইস্যু করা হয়নি, যাতে duplicate না হয়।");
    }
    const { used } = collectSerialsFromDonors(donors);
    let claims: any = null;
    try {
      const snap = await get(ref(d, DONOR_SERIALS_NODE));
      claims = snap.val();
    } catch (e) {
      console.warn("donorSerials read:", (e as Error)?.message);
    }
    mergeFreshClaims(used, claims);

    const seq = smallestFreeSerial(used);
    if (seq < 1) continue;
    const key = serialKey(seq);
    const claimRef = ref(d, `${DONOR_SERIALS_NODE}/${key}`);
    try {
      const res = await runTransaction(claimRef, (current) => {
        if (current && isFreshClaim(current)) return undefined;
        return { at: nowIso(), year, seq };
      }, { applyLocally: false });
      if (!res?.committed) continue;

      
      const again = collectSerialsFromDonors(await readDonorsOrThrow());
      if (again.used.has(seq)) {
        try { await remove(claimRef); } catch {  }
        continue;
      }
      return formatDonorId(seq, year);
    } catch (e) {
      console.warn("nextDonorId claim failed:", (e as Error)?.message);
      continue;
    }
  }
  throw new Error("Donor UID তৈরি করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।");
}


export async function releaseDonorSerial(id: unknown): Promise<void> {
  const serial = parseDonorSerial(id);
  if (!serial) return;
  const d = db();
  if (!d) return;
  try {
    await remove(ref(d, `${DONOR_SERIALS_NODE}/${serialKey(serial)}`));
  } catch (e) {
    console.warn("releaseDonorSerial:", (e as Error)?.message);
  }
}


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


export async function addRow(node: string, data: Record<string, any>): Promise<string> {
  const d = db();
  if (!d) throw new Error("Realtime Database সংযোগ নেই।");
  const r = push(ref(d, node));
  const id = r.key as string;
  await set(r, { ...stripUndefined(data), id, createdAt: data.createdAt || nowIso(), updatedAt: nowIso() });
  return id;
}


export async function setRow(node: string, id: string, data: Record<string, any>): Promise<void> {
  const d = db();
  if (!d) throw new Error("Realtime Database সংযোগ নেই।");
  await set(child(ref(d, node), String(id)), {
    ...stripUndefined(data),
    id: String(id),
    updatedAt: nowIso(),
  });
}


export async function updateRow(node: string, id: string, patch: Record<string, any>): Promise<void> {
  const d = db();
  if (!d) throw new Error("Realtime Database সংযোগ নেই।");
  await rtdbUpdate(child(ref(d, node), String(id)), { ...stripUndefined(patch), updatedAt: nowIso() });
}


export async function removeRow(node: string, id: string): Promise<void> {
  const d = db();
  if (!d) throw new Error("Realtime Database সংযোগ নেই।");
  await remove(child(ref(d, node), String(id)));
}


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


export async function updatePaths(paths: Record<string, any>): Promise<void> {
  const d = db();
  if (!d) throw new Error("Realtime Database সংযোগ নেই।");
  await rtdbUpdate(ref(d), paths);
}



export async function getPath(path: string): Promise<any> {
  const d = db();
  if (!d) throw new Error("Realtime Database সংযোগ নেই।");
  const p = String(path || "").replace(/^\/+/, "");
  const snap = await get(ref(d, p));
  return snap.val();
}


export async function setPath(path: string, value: any): Promise<void> {
  const d = db();
  if (!d) throw new Error("Realtime Database সংযোগ নেই।");
  const p = String(path || "").replace(/^\/+/, "");
  await set(ref(d, p), value === undefined ? null : value);
}


export async function removePath(path: string): Promise<void> {
  const d = db();
  if (!d) throw new Error("Realtime Database সংযোগ নেই।");
  const p = String(path || "").replace(/^\/+/, "");
  await remove(ref(d, p));
}


export function watchPath(
  path: string,
  cb: (value: any) => void,
  onErr?: (err: Error) => void
): () => void {
  
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
  const target = p ? ref(d, p) : ref(d);   
  try {
    return onValue(
      target,
      (snap) => {
        try {
          cb(snap.val());
        } catch (e) {
          
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
      try { onErr(err); } catch (_) {  }
    }
    return () => undefined;
  }
}


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
    
    if (isPermissionDenied(e)) {
      console.warn("rtdb findBy denied:", node, field, (e as Error)?.message);
      return null;
    }
    
    console.warn("rtdb findBy:", node, field, (e as Error)?.message);
    const all = await listOnce(node);
    return all.find((r) => r[field] === value) || null;
  }
}


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
