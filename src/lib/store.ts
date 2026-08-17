/**
 * CBDC — shared application state store (Realtime Database-backed)
 *
 * This is the React + TypeScript replacement for the original
 * `window.CBDCShared` IIFE that every HTML page shipped with.
 *
 * DATA SOURCE (single source of truth):
 *   - **Firebase Realtime Database** — donors / requests / queue / gallery /
 *     notices / accounts. Cloud Firestore is no longer used anywhere.
 *   - কোনো dummy / demo / seed data নেই — ডাটাবেস খালি থাকলে UI-ও খালি দেখায়।
 *   - localStorage-এ shared data রাখা হয় না। স্টোরটি শুধু একটি in-memory cache
 *     রাখে যা RTDB `onValue` listener থেকে লাইভ ভরে ওঠে এবং পরিবর্তন হলে
 *     আবার RTDB-তে লেখা হয়।
 *   - তাই কোথাও Add / Edit / Delete করলে সেটি সঙ্গে সঙ্গে **সব dashboard-এ**
 *     (Home, Doner, Admin, Moderator) live আপডেট হয়ে যায়।
 *
 * The public API (`load`, `save`, `update`, `subscribe`, `clone`, and the
 * donor converters) is kept byte-for-byte compatible with the original so the
 * ported page logic works unchanged.
 */

import { NODES } from "./firebase";
import { watchList, setRow, removeRow } from "./rtdb";
import { resolveAge } from "./age";

const KEY = "cbdc.shared.v1"; // kept for API compatibility only
const CHANNEL = "cbdc-sync";

/** The six collections that make up the shared aggregate state. */
const COLLECTION_NAMES = ["donors", "requests", "queue", "gallery", "notices", "accounts"] as const;

const clone = (v: any): any => {
  try {
    return structuredClone(v);
  } catch (e) {
    return JSON.parse(JSON.stringify(v));
  }
};

/** Empty state shape — no seed data of any kind. */
function fresh(): any {
  return {
    version: 1,
    revision: 0,
    updatedAt: new Date().toISOString(),
    source: "rtdb",
    donors: [],
    requests: [],
    queue: [],
    gallery: [],
    notices: [],
    accounts: [],
  };
}

function clean(s: any): any {
  if (!s || typeof s !== "object") s = fresh();
  for (const k of COLLECTION_NAMES) {
    if (!Array.isArray(s[k])) s[k] = [];
  }
  s.version = 1;
  return s;
}

/** RTDB থেকে আসা মান JSON-নিরাপদ করা (numeric timestamp → ISO)। */
function normalizeDoc(data: any): any {
  const fix = (v: any): any => {
    if (v && typeof v === "object") {
      const out: any = Array.isArray(v) ? [] : {};
      for (const k of Object.keys(v)) out[k] = fix(v[k]);
      return out;
    }
    return v;
  };
  return fix(data);
}

// ── in-memory cache (fed by Realtime Database, mutated optimistically on write) ──
let cache: any = fresh();

// ── subscribers ──
const subscribers = new Set<(state: any, meta?: any) => void>();

function notify(meta?: any) {
  const snapshot = clean(clone(cache));
  subscribers.forEach((fn) => {
    try {
      fn(snapshot, meta);
    } catch (e) {
      console.warn("store subscriber error:", (e as Error)?.message);
    }
  });
}

/** Synchronous read of the current cached state (no seeding). */
function load(): any {
  return clean(clone(cache));
}

// ── Realtime Database live sync ──
const rtdbUnsubs: Array<() => void> = [];
let rtdbStarted = false;

/**
 * প্রতিটি node-এ একটি করে live listener বসায়। RTDB-তে কিছু বদলালেই
 * cache আপডেট হয় এবং সব subscriber (প্রতিটি dashboard) সাথে সাথে re-render হয়।
 */
function startRealtimeSync() {
  if (rtdbStarted) return;
  rtdbStarted = true;

  /* কোন node-এ কী filter হবে — পাবলিক তালিকায় শুধু অনুমোদিত ডেটা যায়। */
  const filters: Record<string, (rows: any[]) => any[]> = {
    donors: (rows) => rows.filter((r) => (r.status || "approved") === "approved"),
    requests: (rows) => rows.filter((r) => (r.status || "approved") === "approved"),
    queue: (rows) => rows,
    gallery: (rows) => rows.slice().sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)),
    notices: (rows) => rows,
    accounts: (rows) => rows,
  };

  for (const name of COLLECTION_NAMES) {
    try {
      const un = watchList((NODES as any)[name] || name, (rows) => {
        const items = (filters[name] || ((x: any[]) => x))(rows.map((r) => normalizeDoc(r)));
        // Skip no-op echoes (e.g. our own write coming back unchanged).
        if (JSON.stringify(items) === JSON.stringify(cache[name])) return;
        cache[name] = clone(items);
        cache.version = 1;
        notify({ source: "rtdb" });
      });
      rtdbUnsubs.push(un);
    } catch (e) {
      console.warn("store listener setup failed:", name, (e as Error)?.message);
    }
  }
}

/** সব live listener বন্ধ করা (সাধারণত দরকার হয় না — অ্যাপ-জীবনভর চলে)। */
export function stopRealtimeSync(): void {
  while (rtdbUnsubs.length) {
    try {
      (rtdbUnsubs.pop() as () => void)();
    } catch {
      /* ignore */
    }
  }
  rtdbStarted = false;
}

/** Incrementally push the diff between two lists of a node to the Realtime Database. */
async function writeDiff(name: string, oldList: any[], newList: any[]) {
  const node = (NODES as any)[name] || name;
  const oldById = new Map<string, any>(oldList.map((x) => [String(x.id), x]));
  const newById = new Map<string, any>(newList.map((x) => [String(x.id), x]));
  const tasks: Array<Promise<void>> = [];

  for (const [id, item] of newById) {
    const prev = oldById.get(id);
    if (!prev || JSON.stringify(prev) !== JSON.stringify(item)) {
      tasks.push(
        setRow(node, id, clone(item))
          .catch((e) => console.warn("store write:", node, id, (e as Error)?.message))
          .then(() => undefined)
      );
    }
  }
  for (const id of oldById.keys()) {
    if (!newById.has(id)) {
      tasks.push(
        removeRow(node, id)
          .catch((e) => console.warn("store delete:", node, id, (e as Error)?.message))
          .then(() => undefined)
      );
    }
  }
  if (tasks.length) await Promise.all(tasks);
}

/** Persist a state snapshot: update cache, broadcast, and write diffs to Realtime Database. */
function save(state: any, source = "unknown"): any {
  const prev = load();
  const s = clean(clone(state));
  s.revision = (Number(prev.revision) || 0) + 1;
  s.updatedAt = new Date().toISOString();
  s.source = source;

  // optimistic local update
  cache = clean(clone(s));

  // background RTDB sync (diff-based, so unchanged collections cost nothing)
  for (const name of COLLECTION_NAMES) {
    void writeDiff(name, prev[name], s[name]);
  }

  // cross-tab notification (BroadcastChannel)
  try {
    bc && bc.postMessage({ revision: s.revision, source });
  } catch (e) {
    /* ignore */
  }
  return s;
}

function update(fn: (s: any) => any, source?: string): any {
  const s = load();
  const out = fn(s) || s;
  return save(out, source);
}

let bc: BroadcastChannel | null = null;
try {
  bc = new BroadcastChannel(CHANNEL);
} catch (e) {
  /* BroadcastChannel unavailable */
}

function subscribe(fn: (state: any, meta?: any) => void): () => void {
  subscribers.add(fn);
  const onBC = (e: MessageEvent) => {
    const meta = e.data && typeof e.data === "object" ? e.data : {};
    notify({ source: meta.source || "broadcast" });
  };
  if (bc) bc.addEventListener("message", onBC);
  return () => {
    subscribers.delete(fn);
    if (bc) bc.removeEventListener("message", onBC);
  };
}

// ── donor converters ──
// বয়স আর সংরক্ষণ করা হয় না: ডাটাবেসে থাকে `dob` (জন্ম তারিখ), আর `age`
// প্রতিবার সেখান থেকে হিসাব করে দেওয়া হয় (src/lib/age.ts)।
const toAdminDonor = (d: any) => ({
  id: d.id || d.donorId,
  name: d.name || "",
  group: d.bloodGroup || d.group || "",
  area: d.area || "",
  phone: d.phone || "",
  gender: d.gender || "",
  dob: d.dob || "",
  age: resolveAge(d),
  last: d.lastDonationDate || d.last || "",
  available: d.available !== false,
  verified: d.verified !== false,
  suspended: !!d.suspended,
  joined: d.joined || "",
  donations: Number(d.donations ?? d.totalDonations) || 0,
  whatsapp: d.whatsapp || "",
  ownerUid: d.ownerUid || d.uid || "",
});

const fromAdminDonor = (d: any) => ({
  id: d.id,
  donorId: d.id,
  uid: d.ownerUid || d.uid || d.id,
  name: d.name || "",
  bloodGroup: d.group || "",
  gender: d.gender || "",
  dob: d.dob || "",
  phone: d.phone || "",
  whatsapp: d.whatsapp || d.phone || "",
  area: d.area || "",
  lastDonationDate: d.last || "",
  donations: Number(d.donations) || 0,
  totalDonations: Number(d.donations) || 0,
  status: "approved",
  available: d.available !== false,
  verified: d.verified !== false,
  suspended: !!d.suspended,
  joined: d.joined || "",
  occupation: d.occupation || "",
  ownerUid: d.ownerUid || "",
});

const toDonerDonor = (d: any) => ({
  uid: d.uid || d.ownerUid || d.id,
  donorId: d.id || d.donorId,
  name: d.name || "",
  gender: d.gender || "",
  photo: d.photo || "",
  group: d.bloodGroup || d.group || "",
  area: d.area || "",
  dob: d.dob || "",
  age: resolveAge(d),
  occupation: d.occupation || "",
  phone: d.phone || "",
  whatsapp: !!d.whatsapp,
  lastDonation: d.lastDonationDate || d.last || "",
  totalDonations: Number(d.totalDonations ?? d.donations) || 0,
  joined: d.joined || "",
  verified: d.verified !== false,
  privacy: { showArea: true, showGroup: true, showWhatsapp: !!d.whatsapp },
});

const fromDonerDonor = (d: any) => ({
  id: d.donorId || d.id,
  donorId: d.donorId || d.id,
  uid: d.uid || d.donorId || d.id,
  name: d.name || "",
  bloodGroup: d.group || d.bloodGroup || "",
  gender: d.gender || "",
  dob: d.dob || "",
  phone: d.phone || "",
  whatsapp: d.whatsapp === false ? "" : typeof d.whatsapp === "string" ? d.whatsapp : d.phone || "",
  area: d.area || "",
  lastDonationDate: d.lastDonation || d.lastDonationDate || "",
  donations: Number(d.totalDonations ?? d.donations) || 0,
  totalDonations: Number(d.totalDonations ?? d.donations) || 0,
  status: "approved",
  available: d.available !== false,
  verified: d.verified !== false,
  suspended: !!d.suspended,
  joined: d.joined || "",
  occupation: d.occupation || "",
  ownerUid: d.ownerUid || d.uid || "",
});

const store = {
  KEY,
  load,
  save,
  update,
  subscribe,
  clone,
  toAdminDonor,
  fromAdminDonor,
  toDonerDonor,
  fromDonerDonor,
};

// Expose the same `window.CBDCShared` global the ported pages expect.
window.CBDCShared = store;
globalThis.CBDCShared = store;

// Start Realtime Database live sync immediately (idempotent).
startRealtimeSync();

export default store;
