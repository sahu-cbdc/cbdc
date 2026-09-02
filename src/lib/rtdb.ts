/**
 * Data layer — realtime READS stay on the Firebase SDK (listeners keep the
 * live UI), while every WRITE goes through the secure API:
 *
 *   UI → rtdb.ts write helpers → /api/data op=write (server-side authz) → RTDB
 *
 * The browser never performs privileged writes against Firebase directly;
 * role/ownership checks run on the server for each requested path.
 */
import {
  ref,
  child,
  get,
  onValue,
  query,
  orderByChild,
  equalTo,
  limitToFirst,
  type Database,
  type Query,
} from "firebase/database";
import { getRtdb } from "./firebase";
import {
  apiWritePaths,
  apiIncrementField,
  apiEnsureFieldAtLeast,
  apiNextDonorId,
  apiReleaseDonorSerial,
  SERVER_TIMESTAMP,
} from "./api";

export type Row = Record<string, any> & { id: string };

/**
 * Server-timestamp sentinel for writes. Returned as a marker the API
 * translates to RTDB's {".sv":"timestamp"} — identical clock semantics.
 */
export const serverTime = () => SERVER_TIMESTAMP;

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

export function formatDonorId(seq: number | string, year: number = new Date().getFullYear()): string {
  const n = Math.max(0, Math.floor(Number(seq) || 0));
  return `CBDC-${year}-${String(n).padStart(4, "0")}`;
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

const PUSH_CHARS = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
let lastPushTime = 0;
const lastRandChars: number[] = [];

/**
 * Firebase-compatible push id, generated locally (exactly like the SDK did)
 * so addRow() keeps returning the new key before the server write settles.
 */
function pushId(): string {
  let now = Date.now();
  const dupTime = now === lastPushTime;
  lastPushTime = now;
  const timeStampChars: string[] = new Array(8);
  let remaining = now;
  for (let i = 7; i >= 0; i--) {
    timeStampChars[i] = PUSH_CHARS.charAt(remaining % 64);
    remaining = Math.floor(remaining / 64);
  }
  let id = timeStampChars.join("");
  if (!dupTime) {
    for (let i = 0; i < 12; i++) lastRandChars[i] = Math.floor(Math.random() * 64);
  } else {
    let i = 11;
    for (; i >= 0 && lastRandChars[i] === 63; i--) lastRandChars[i] = 0;
    lastRandChars[i]++;
  }
  for (let i = 0; i < 12; i++) id += PUSH_CHARS.charAt(lastRandChars[i]);
  return id;
}

export async function addRow(node: string, data: Record<string, any>): Promise<string> {
  const id = pushId();
  await apiWritePaths({
    [`${node}/${id}`]: { ...stripUndefined(data), id, createdAt: data.createdAt || nowIso(), updatedAt: nowIso() },
  });
  return id;
}

export async function setRow(node: string, id: string, data: Record<string, any>): Promise<void> {
  await apiWritePaths({
    [`${node}/${String(id)}`]: { ...stripUndefined(data), id: String(id), updatedAt: nowIso() },
  });
}

export async function updateRow(node: string, id: string, patch: Record<string, any>): Promise<void> {
  await apiWritePaths({
    [`${node}/${String(id)}`]: { ...stripUndefined(patch), updatedAt: nowIso() },
  });
}

export async function removeRow(node: string, id: string): Promise<void> {
  await apiWritePaths({ [`${node}/${String(id)}`]: null });
}

export async function incrementField(node: string, id: string, field: string, amount = 1): Promise<number> {
  if (!id || !field) throw new Error("RTDB field is required.");
  return apiIncrementField(node, String(id), field, amount);
}

export async function ensureFieldAtLeast(node: string, id: string, field: string, minimum: number): Promise<number> {
  if (!id || !field) throw new Error("RTDB field is required.");
  return apiEnsureFieldAtLeast(node, String(id), field, minimum);
}

export async function updatePaths(paths: Record<string, any>): Promise<void> {
  await apiWritePaths(paths);
}

export async function setPath(path: string, value: any): Promise<void> {
  const p = String(path || "").replace(/^\/+/, "");
  await apiWritePaths({ [p]: value === undefined ? null : value });
}

export async function removePath(path: string): Promise<void> {
  const p = String(path || "").replace(/^\/+/, "");
  await apiWritePaths({ [p]: null });
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
      try { onErr(err); } catch { }
    }
    return () => undefined;
  }
}

/**
 * Allocate the next donor id (CBDC-YYYY-NNNN). Serial allocation runs on the
 * server (staff-only) so ids stay unique and _meta claims stay privileged.
 */
export async function nextDonorId(year: number = new Date().getFullYear()): Promise<string> {
  void year;
  return apiNextDonorId();
}

export async function releaseDonorSerial(id: unknown): Promise<void> {
  const donorId = String(id || "").trim();
  if (!donorId) return;
  try {
    await apiReleaseDonorSerial(donorId);
  } catch (e) {
    console.warn("releaseDonorSerial:", (e as Error)?.message);
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


