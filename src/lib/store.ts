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
 *   - Realtime Database-ই single source of truth। দ্রুত first paint-এর জন্য শুধু
 *     public nodes (donors/requests/gallery/notices)-এর short-lived browser cache
 *     পড়া হয়; RTDB snapshot এলেই সেটি live data দিয়ে replace হয়। Private/admin
 *     data (queue/accounts) browser cache-এ রাখা হয় না।
 *   - তাই কোথাও Add / Edit / Delete করলে সেটি সঙ্গে সঙ্গে **সব dashboard-এ**
 *     (Home, Doner, Admin, Moderator) live আপডেট হয়ে যায়।
 *
 * The public API (`load`, `save`, `update`, `subscribe`, `clone`, and the
 * donor converters) is kept byte-for-byte compatible with the original so the
 * ported page logic works unchanged.
 */

import { onAuthStateChanged, type Unsubscribe as AuthUnsubscribe } from "firebase/auth";
import { NODES, getAuthInstance } from "./firebase";
import { watchList, setRow, removeRow } from "./rtdb";
import { resolveAge } from "./age";

const KEY = "cbdc.shared.v1"; // kept for API compatibility only
const CHANNEL = "cbdc-sync";
const CACHE_KEY = "cbdc.shared.rtdb.public-cache.v2";
const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24 hours — just a fast first-paint cache

/** The six collections that make up the shared aggregate state. */
const COLLECTION_NAMES = ["donors", "requests", "queue", "gallery", "notices", "accounts"] as const;
type CollectionName = (typeof COLLECTION_NAMES)[number];

/**
 * RTDB rules allow these nodes to be read without login. Private nodes are
 * attached only after Firebase Auth has a user; otherwise the listener is
 * rejected once with permission_denied and never recovers until a full reload.
 */
const PUBLIC_COLLECTIONS = new Set<CollectionName>(["donors", "requests", "gallery", "notices"]);

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

function restorePublicCache(): any {
  const s = fresh();
  try {
    // The cache is only for public website first paint. Admin/Moderator/Doner
    // panels call persist() during boot, so they must never treat browser cache
    // as authoritative input and accidentally re-write stale records to RTDB.
    const path = window.location.pathname || "/";
    if (/\/(admin|moderator|doner)(?:\.|\/|$)/i.test(path)) return s;
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return s;
    const parsed = JSON.parse(raw);
    const savedAt = Date.parse(parsed?.savedAt || parsed?.updatedAt || "");
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > CACHE_MAX_AGE_MS) return s;
    for (const k of PUBLIC_COLLECTIONS) {
      if (Array.isArray(parsed[k])) s[k] = parsed[k];
    }
    s.updatedAt = parsed.updatedAt || s.updatedAt;
    s.source = "rtdb-cache";
  } catch {
    /* localStorage may be unavailable; cache is only an optimisation */
  }
  return clean(s);
}

function persistPublicCache() {
  try {
    const payload: Record<string, any> = {
      version: 1,
      updatedAt: cache.updatedAt || new Date().toISOString(),
      savedAt: new Date().toISOString(),
    };
    for (const k of PUBLIC_COLLECTIONS) payload[k] = cache[k] || [];
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota/private-mode errors */
  }
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
// Public RTDB data is restored from a short-lived browser cache first so the
// home page can paint useful content immediately, then live RTDB snapshots
// replace it as soon as they arrive. Private/admin data is never persisted here.
let cache: any = restorePublicCache();

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
let authUnsub: AuthUnsubscribe | null = null;
let currentAuthUid: string | null = null;

/* কোন node-এ কী filter হবে — পাবলিক তালিকায় শুধু অনুমোদিত ডেটা যায়। */
const filters: Record<CollectionName, (rows: any[]) => any[]> = {
  donors: (rows) => rows.filter((r) => (r.status || "approved") === "approved"),
  requests: (rows) => rows.filter((r) => (r.status || "approved") === "approved"),
  queue: (rows) => rows,
  gallery: (rows) => rows.slice().sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)),
  notices: (rows) => rows,
  accounts: (rows) => rows,
};

function canAttachCollection(name: CollectionName): boolean {
  return PUBLIC_COLLECTIONS.has(name) || !!currentAuthUid;
}

function clearPrivateCacheOnLogout(): boolean {
  let changed = false;
  for (const name of COLLECTION_NAMES) {
    if (PUBLIC_COLLECTIONS.has(name)) continue;
    if (cache[name]?.length) {
      cache[name] = [];
      changed = true;
    }
  }
  return changed;
}

/**
 * প্রতিটি অনুমোদিত node-এ একটি করে live listener বসায়। Public nodes সাথে সাথে
 * attach হয়; private/admin nodes Firebase Auth ready হওয়ার পর attach/re-attach
 * হয়। এতে page import-এর সময় permission_denied হয়ে queue/accounts আটকে যাওয়ার
 * পুরোনো সমস্যা থাকে না।
 */
function startRealtimeSync() {
  if (rtdbStarted) return;
  rtdbStarted = true;

  for (const name of COLLECTION_NAMES) {
    if (!canAttachCollection(name)) continue;
    try {
      const un = watchList((NODES as any)[name] || name, (rows) => {
        const items = (filters[name] || ((x: any[]) => x))(rows.map((r) => normalizeDoc(r)));
        // Skip no-op echoes (e.g. our own write coming back unchanged).
        if (JSON.stringify(items) === JSON.stringify(cache[name])) return;
        cache[name] = clone(items);
        cache.version = 1;
        cache.updatedAt = new Date().toISOString();
        if (PUBLIC_COLLECTIONS.has(name)) persistPublicCache();
        notify({ source: "rtdb", node: name });
      });
      rtdbUnsubs.push(un);
    } catch (e) {
      console.warn("store listener setup failed:", name, (e as Error)?.message);
    }
  }
}

function restartRealtimeSync(meta?: any) {
  stopRealtimeSync();
  startRealtimeSync();
  if (meta) notify(meta);
}

function watchAuthForPrivateNodes() {
  if (authUnsub) return;
  try {
    const auth = getAuthInstance();
    if (!auth) return;
    currentAuthUid = auth.currentUser?.uid || null;
    authUnsub = onAuthStateChanged(auth, (user) => {
      const nextUid = user?.uid || null;
      if (nextUid === currentAuthUid && rtdbStarted) return;
      currentAuthUid = nextUid;
      const cleared = !nextUid && clearPrivateCacheOnLogout();
      restartRealtimeSync({ source: nextUid ? "auth:login" : "auth:logout", privateCleared: cleared });
    });
  } catch (e) {
    console.warn("store auth watcher:", (e as Error)?.message);
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
  persistPublicCache();
  notify({ source });

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
  // Give new screens the current cached snapshot immediately instead of waiting
  // for the next RTDB event. This removes unnecessary blank/loading states.
  queueMicrotask(() => {
    if (!subscribers.has(fn)) return;
    try {
      fn(clean(clone(cache)), { source: cache.source || "cache" });
    } catch (e) {
      console.warn("store subscriber error:", (e as Error)?.message);
    }
  });
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

// Start Realtime Database live sync immediately (idempotent). Public data is
// available at once; private/admin nodes are retried automatically on login.
watchAuthForPrivateNodes();
startRealtimeSync();

export default store;
