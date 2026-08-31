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

import { getAuthUser, subscribeAuthUser } from "./authState";
import { NODES, getAuthInstance } from "./firebase";
import { watchList, setRow, removeRow } from "./rtdb";
import { resolveAge } from "./age";

const KEY = "cbdc.shared.v1"; // kept for API compatibility only
const CHANNEL = "cbdc-sync";
const CACHE_KEY = "cbdc.shared.rtdb.public-cache.v2";
const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24 hours — just a fast first-paint cache

/**
 * Production-এ **Realtime Database-ই একমাত্র source of truth**।
 *
 * localStorage cache শুধু local development-এ (fast HMR/first paint) চালু থাকে;
 * production build-এ কোনো browser storage production data-এর উৎস হয় না —
 * সব তথ্য সরাসরি RTDB listener থেকে আসে। ফলে dev/demo cache ভুল বা পুরোনো
 * ডেটা দেখাতে পারে না, আর কোনো host-এ deploy করেই আচরণ একই থাকে।
 */
/* শুধু DEV/MODE পড়া হয় (পুরো `import.meta.env` নয়) — তাই অন্য কোনো env মান
   bundle-এ ঢোকে না। */
const CACHE_ENABLED = (() => {
  try {
    const meta = (import.meta as any).env || {};
    return meta.DEV === true || meta.MODE === "development";
  } catch {
    return false;
  }
})();

/** The shared aggregate state collections. `donations` is the admin-maintained
 *  approved-donation log; it is private (not in PUBLIC_COLLECTIONS). */
const COLLECTION_NAMES = ["donors", "requests", "queue", "gallery", "notices", "accounts", "donations"] as const;
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
    donations: [],
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
  if (!CACHE_ENABLED) return s;
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
  if (!CACHE_ENABLED) return;
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
let authUnsub: (() => void) | null = null;
let currentAuthUid: string | null = null;

/* ── node readiness (loading/skeleton state) ─────────────────────────────────
   কোন node-এর **প্রথম** RTDB snapshot এসেছে কি না তার হিসাব। ডেটা না আসা
   পর্যন্ত UI skeleton দেখাতে পারে — ভুল "০" বা খালি placeholder দেখায় না।
   এটি শুধু readiness-এর সংকেত; পুরোনো `notify()`-এর মতো কোনো re-render
   ট্রিগার করে না, তাই অপ্রয়োজনীয় render হয় না। */
const loadedNodes = new Set<CollectionName>();
const nodeLoadedSubs = new Set<(name: string) => void>();

/** একটি node-এর প্রথম লোড শেষ হলে (একবার) callback চলে; unsubscribe ফেরত দেয়। */
export function onNodeLoaded(cb: (name: string) => void): () => void {
  nodeLoadedSubs.add(cb);
  return () => {
    nodeLoadedSubs.delete(cb);
  };
}

/** এই node-এর ডেটা অন্তত একবার এসেছে কি না। */
export function isNodeLoaded(name: string): boolean {
  return loadedNodes.has(name as CollectionName);
}

function notifyNodeLoaded(name: CollectionName): void {
  nodeLoadedSubs.forEach((fn) => {
    try {
      fn(name);
    } catch (e) {
      console.warn("store node-loaded subscriber:", (e as Error)?.message);
    }
  });
}

/* কোন node-এ কী filter হবে — পাবলিক তালিকায় শুধু অনুমোদিত ডেটা যায়। */
const filters: Record<CollectionName, (rows: any[]) => any[]> = {
  donors: (rows) => rows.filter((r) => (r.status || "approved") === "approved"),
  requests: (rows) => rows.filter((r) => (r.status || "approved") === "approved"),
  queue: (rows) => rows,
  gallery: (rows) => rows.slice().sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)),
  notices: (rows) => rows,
  accounts: (rows) => rows,
  donations: (rows) => rows.slice().sort((a, b) => String(b.date || b.approvedAt).localeCompare(String(a.date || a.approvedAt))),
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
        /* প্রথম snapshot = এই node-এর ডেটা লোড শেষ (ডেটা খালি হলেও সত্য) —
           তাই UI "লোড হচ্ছে…" থেকে বেরিয়ে আসতে পারে। */
        if (!loadedNodes.has(name)) {
          loadedNodes.add(name);
          notifyNodeLoaded(name);
        }
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
    /* একটাই `onAuthStateChanged` (src/lib/authState.ts) — এখানে শুধু তার
       shared subscriber হিসেবে private cache/sync সামলানো হয়। */
    currentAuthUid = getAuthUser()?.uid || null;
    authUnsub = subscribeAuthUser((user) => {
      const au = getAuthInstance();
      const authCurrent = au ? au.currentUser : null;
      // Prevent false logout when auth.currentUser exists but subscriber got null briefly
      if (!user && authCurrent && authCurrent.uid && currentAuthUid === authCurrent.uid) return;
      const nextUid = (user && user.uid) ? user.uid : (authCurrent ? authCurrent.uid : null);
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

async function writeDiffStrict(name: string, oldList: any[], newList: any[]) {
  const node = (NODES as any)[name] || name;
  const oldById = new Map<string, any>(oldList.map((x) => [String(x.id), x]));
  const newById = new Map<string, any>(newList.map((x) => [String(x.id), x]));
  const tasks: Array<Promise<void>> = [];
  for (const [id, item] of newById) {
    const prev = oldById.get(id);
    if (!prev || JSON.stringify(prev) !== JSON.stringify(item)) tasks.push(setRow(node, id, clone(item)));
  }
  for (const id of oldById.keys()) {
    if (!newById.has(id)) tasks.push(removeRow(node, id));
  }
  if (tasks.length) await Promise.all(tasks);
}

/** Persist a state snapshot: update cache, broadcast, and write diffs to Realtime Database. */
function makeNextState(state: any, source = "unknown"): { previous: any; next: any } {
  const previous = load();
  const next = clean(clone(state));
  next.revision = (Number(previous.revision) || 0) + 1;
  next.updatedAt = new Date().toISOString();
  next.source = source;
  return { previous, next };
}

function publishOptimistic(next: any, source: string): void {
  cache = clean(clone(next));
  persistPublicCache();
  notify({ source });
  try {
    bc && bc.postMessage({ revision: next.revision, source });
  } catch (e) {
    /* ignore */
  }
}

function save(state: any, source = "unknown"): any {
  const { previous, next } = makeNextState(state, source);
  // Keep the compatibility API synchronous for legacy callers. New user-action
  // handlers use commit/updateAsync below so UI success waits for RTDB.
  publishOptimistic(next, source);
  for (const name of COLLECTION_NAMES) {
    void writeDiff(name, previous[name], next[name]);
  }
  return next;
}

function update(fn: (s: any) => any, source?: string): any {
  const s = load();
  const out = fn(s) || s;
  return save(out, source);
}

/** Strict persistence API for user actions. It rejects on the first RTDB error
 * instead of silently leaving an optimistic local-only mutation behind. */
async function commit(state: any, source = "unknown"): Promise<any> {
  const { previous, next } = makeNextState(state, source);
  await Promise.all(COLLECTION_NAMES.map((name) => writeDiffStrict(name, previous[name], next[name])));
  publishOptimistic(next, source);
  return next;
}

async function updateAsync(fn: (s: any) => any, source?: string): Promise<any> {
  const s = load();
  const out = fn(s) || s;
  return commit(out, source);
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
/* ═══ Round-trip safe converters ═══
   Each converter spreads the source row first and then overrides the canonical
   keys. This guarantees a save → read → save round trip through the shared
   store never drops fields written by other panels (appliedAt, createdAt,
   health, fcmToken, cardTheme, updatedAt, email, username, privacy, …).
   Without this, an Admin/Moderator persist() that rewrote a donor record could
   silently erase data written by the Donor Panel — breaking single-source of
   truth (item 10). `age` is always computed (src/lib/age.ts) and is the only
   key explicitly excluded from the RTDB write (never stored). */
const toAdminDonor = (d: any) => ({
  ...d,
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
  totalBags: Number(d.totalBags ?? d.bags ?? 0) || 0,
  whatsapp: d.whatsapp || "",
  /* প্রোফাইল ছবি (ImgBB link) — admin round-trip-এ কখনো বাদ পড়ে না */
  photo: d.photo || d.photoURL || "",
  ownerUid: d.ownerUid || d.uid || "",
});

const fromAdminDonor = (d: any) => {
  const out: any = { ...d };
  delete out.age; // computed value — never written to RTDB
  Object.assign(out, {
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
    totalBags: Number(d.totalBags ?? d.bags ?? 0) || 0,
    status: "approved",
    available: d.available !== false,
    verified: d.verified !== false,
    suspended: !!d.suspended,
    joined: d.joined || "",
    occupation: d.occupation || "",
    photo: d.photo || d.photoURL || "",
    ownerUid: d.ownerUid || "",
  });
  return out;
};

const toDonerDonor = (d: any) => ({
  ...d,
  uid: d.uid || d.ownerUid || d.id,
  donorId: d.id || d.donorId,
  name: d.name || "",
  gender: d.gender || "",
  photo: d.photo || d.photoURL || "",
  group: d.bloodGroup || d.group || "",
  area: d.area || "",
  dob: d.dob || "",
  age: resolveAge(d),
  occupation: d.occupation || "",
  phone: d.phone || "",
  whatsapp: !!d.whatsapp,
  lastDonation: d.lastDonationDate || d.last || "",
  totalDonations: Number(d.totalDonations ?? d.donations) || 0,
  totalBags: Number(d.totalBags ?? d.bags ?? 0) || 0,
  joined: d.joined || "",
  verified: d.verified !== false,
  privacy: { showArea: true, showGroup: true, showWhatsapp: !!d.whatsapp },
});

const fromDonerDonor = (d: any) => ({
  ...d,
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
  totalBags: Number(d.totalBags ?? d.bags ?? 0) || 0,
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
  commit,
  updateAsync,
  subscribe,
  onNodeLoaded,
  isNodeLoaded,
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
