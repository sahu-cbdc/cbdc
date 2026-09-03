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

/* ─────────────────────────────────────────────────────────────────────────
 * Shared listener registry
 *
 * Several panels (and the shared store) subscribe to the very same RTDB
 * query. Without de-duplication every subscriber opened its own onValue()
 * — duplicate sockets, duplicate downloads, duplicate re-renders.
 *
 * Every watch* helper below now goes through this registry: identical query
 * signatures share ONE Firebase listener, the last value is replayed
 * synchronously-ish to late subscribers, and the underlying listener is
 * detached only when the last subscriber unsubscribes.
 * ───────────────────────────────────────────────────────────────────────── */

type Entry = {
  detach: () => void;
  subs: Set<{ next: (v: any) => void; error?: (e: Error) => void }>;
  last: any;
  hasValue: boolean;
};

const registry = new Map<string, Entry>();

function sharedWatch(
  key: string,
  build: () => Query | null,
  next: (value: any) => void,
  error?: (err: Error) => void
): () => void {
  let entry = registry.get(key);
  const sub = { next, error };
  if (!entry) {
    const target = build();
    if (!target) {
      const err = new Error("Firebase Realtime Database প্রস্তুত নয় (init হয়নি)।");
      if (error) {
        try {
          error(err);
        } catch {
          /* ignore */
        }
      }
      return () => undefined;
    }
    const created: Entry = { detach: () => undefined, subs: new Set(), last: null, hasValue: false };
    entry = created;
    registry.set(key, created);
    try {
      created.detach = onValue(
        target,
        (snap) => {
          created.last = snap.val();
          created.hasValue = true;
          for (const s of Array.from(created.subs)) {
            try {
              s.next(created.last);
            } catch (e) {
              console.warn("rtdb watch callback:", key, (e as Error)?.message);
            }
          }
        },
        (err) => {
          for (const s of Array.from(created.subs)) {
            if (s.error) {
              try {
                s.error(err as Error);
              } catch (e) {
                console.warn("rtdb watch onErr:", key, (e as Error)?.message);
              }
            } else console.warn("rtdb watch:", key, err && err.message);
          }
        }
      );
    } catch (e) {
      registry.delete(key);
      console.warn("rtdb watch setup:", key, (e as Error)?.message);
      if (error) {
        try {
          error(e as Error);
        } catch {
          /* ignore */
        }
      }
      return () => undefined;
    }
  }
  const active = entry;
  active.subs.add(sub);
  // Replay the value we already hold so a late subscriber paints immediately
  // instead of waiting for the next server event.
  if (active.hasValue) {
    queueMicrotask(() => {
      if (!active.subs.has(sub)) return;
      try {
        sub.next(active.last);
      } catch (e) {
        console.warn("rtdb watch replay:", key, (e as Error)?.message);
      }
    });
  }
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    active.subs.delete(sub);
    if (!active.subs.size) {
      registry.delete(key);
      try {
        active.detach();
      } catch {
        /* ignore */
      }
    }
  };
}

/** How many distinct Firebase listeners are currently attached (test/debug). */
export function activeListenerCount(): number {
  return registry.size;
}

/** Signatures of the currently attached listeners (test/debug). */
export function activeListenerKeys(): string[] {
  return Array.from(registry.keys());
}

export function watchList(
  node: string,
  cb: (rows: Row[]) => void,
  opts: { orderBy?: string; equals?: string | number | boolean; limit?: number } = {}
): () => void {
  const key = `list:${node}|${opts.orderBy || ""}|${String(opts.equals ?? "")}|${opts.limit || 0}`;
  return sharedWatch(
    key,
    () => {
      const d = db();
      if (!d) return null;
      try {
        if (opts.orderBy) {
          const parts: any[] = [orderByChild(opts.orderBy)];
          if (opts.equals !== undefined) parts.push(equalTo(opts.equals as any));
          if (opts.limit) parts.push(limitToFirst(opts.limit));
          return query(ref(d, node), ...parts);
        }
        if (opts.limit) return query(ref(d, node), limitToFirst(opts.limit));
      } catch (e) {
        console.warn("rtdb query build:", node, (e as Error)?.message);
      }
      return ref(d, node);
    },
    (value) => cb(snapToList(value))
  );
}

export function watchRow(node: string, id: string, cb: (row: Row | null) => void): () => void {
  if (!id) return () => undefined;
  return sharedWatch(
    `row:${node}/${id}`,
    () => {
      const d = db();
      return d ? (child(ref(d, node), String(id)) as unknown as Query) : null;
    },
    (v) => cb(v && typeof v === "object" ? ({ ...v, id: v.id || id } as Row) : null)
  );
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
  const p = String(path || "").replace(/^\/+/, "");
  return sharedWatch(
    `path:${p}`,
    () => {
      const d = db();
      if (!d) return null;
      return (p ? ref(d, p) : ref(d)) as unknown as Query;
    },
    cb,
    onErr
  );
}

/**
 * Shallow listing of a path — keys plus a cheap descriptor of each child,
 * WITHOUT downloading whole sub-trees.
 *
 * RTDB has no server-side "shallow" mode over the web SDK, so for the tree
 * browser we read the node once and describe its immediate children; the
 * caller only ever asks for nodes the user actually expanded, which is the
 * point: the root of the database is never downloaded whole.
 */
export type ChildDescriptor = {
  key: string;
  type: "object" | "array" | "string" | "number" | "boolean" | "null";
  count: number;
  value: any;
  truncated: boolean;
};

function describe(key: string, v: any, includeValue: boolean): ChildDescriptor {
  const isObj = v !== null && typeof v === "object";
  const type: ChildDescriptor["type"] = v === null
    ? "null"
    : Array.isArray(v)
      ? "array"
      : isObj
        ? "object"
        : (typeof v as any);
  const count = isObj ? Object.keys(v).length : 0;
  return {
    key,
    type,
    count,
    value: isObj ? (includeValue ? v : undefined) : v,
    truncated: isObj && !includeValue,
  };
}

/**
 * Read the immediate children of `path` (paginated). Children that are
 * themselves containers are returned as descriptors only — their contents are
 * fetched lazily when the user expands them.
 */
export async function listChildren(
  path: string,
  opts: { limit?: number; startAfter?: string } = {}
): Promise<{ children: ChildDescriptor[]; hasMore: boolean; total: number }> {
  const d = db();
  if (!d) return { children: [], hasMore: false, total: 0 };
  const p = String(path || "").replace(/^\/+/, "");
  const snap = await get(p ? ref(d, p) : ref(d));
  const v = snap.val();
  if (!v || typeof v !== "object") return { children: [], hasMore: false, total: 0 };
  let keys = Object.keys(v).sort((a, b) => {
    const an = /^\d+$/.test(a);
    const bn = /^\d+$/.test(b);
    if (an && bn) return Number(a) - Number(b);
    if (an) return 1;
    if (bn) return -1;
    return a.localeCompare(b, "en", { numeric: true });
  });
  const total = keys.length;
  if (opts.startAfter) {
    const i = keys.indexOf(opts.startAfter);
    if (i >= 0) keys = keys.slice(i + 1);
  }
  const limit = Math.max(1, opts.limit || 100);
  const page = keys.slice(0, limit);
  return {
    children: page.map((k) => describe(k, v[k], false)),
    hasMore: keys.length > limit,
    total,
  };
}

/** Top-level node names only — used for the first paint of the DB browser. */
export async function listRootKeys(): Promise<string[]> {
  const res = await listChildren("", { limit: 500 });
  return res.children.map((c) => c.key);
}

/** Bounded server-side query used by the DB browser's search box. */
export async function queryChildrenByField(
  node: string,
  field: string,
  value: string | number | boolean,
  limit = 50
): Promise<Row[]> {
  const d = db();
  if (!d) return [];
  try {
    const snap = await get(
      query(ref(d, node), orderByChild(field), equalTo(value as any), limitToFirst(limit))
    );
    return snapToList(snap.val());
  } catch (e) {
    console.warn("rtdb queryChildrenByField:", node, field, (e as Error)?.message);
    return [];
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



/** One-shot read of an arbitrary path (used by the lazy DB browser editors). */
export async function getPathOnce(path: string): Promise<any> {
  const d = db();
  if (!d) return null;
  const p = String(path || "").replace(/^\/+/, "");
  const snap = await get(p ? ref(d, p) : ref(d));
  return snap.val();
}
