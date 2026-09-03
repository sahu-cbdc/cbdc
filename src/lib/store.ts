

import { getAuthUser, subscribeAuthUser } from "./authState";
import { NODES, getAuthInstance } from "./firebase";
import { watchList, setRow, removeRow } from "./rtdb";
import { resolveAge } from "./age";
import {
  cacheGet,
  cacheSet,
  clearPrivateCache,
  clearForeignCache,
} from "./idbCache";

const KEY = "cbdc.shared.v1"; 
const CHANNEL = "cbdc-sync";

/** Legacy localStorage cache key — removed on boot, IndexedDB replaces it. */
const LEGACY_CACHE_KEY = "cbdc.shared.rtdb.public-cache.v2";

/** IndexedDB namespaces. Public data and per-user private data are separate. */
const IDB_PUBLIC_NS = "shared.public";
const IDB_PRIVATE_NS = "shared.private";


const COLLECTION_NAMES = ["donors", "requests", "queue", "gallery", "notices", "accounts", "donations"] as const;
type CollectionName = (typeof COLLECTION_NAMES)[number];


const PUBLIC_COLLECTIONS = new Set<CollectionName>(["donors", "requests", "gallery", "notices"]);

const clone = (v: any): any => {
  try {
    return structuredClone(v);
  } catch (e) {
    return JSON.parse(JSON.stringify(v));
  }
};


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

/** Drop the old localStorage blob — IndexedDB is the cache now. */
function dropLegacyLocalStorageCache(): void {
  try {
    localStorage.removeItem(LEGACY_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

/** Server sentinels must not be written to the cache as objects. */
function cacheSafe(value: any, stamp: string): any {
  if (value && typeof value === "object") {
    if ((value as any).__sv__ === "timestamp") return stamp;
    if (Array.isArray(value)) return value.map((v) => cacheSafe(v, stamp));
    const out: any = {};
    for (const k of Object.keys(value)) out[k] = cacheSafe(value[k], stamp);
    return out;
  }
  return value;
}

/**
 * Persist the current snapshot to IndexedDB.
 *  • public collections  → owner "public"  (safe for anyone)
 *  • private collections → owner <uid>     (never readable by another user)
 * Writes are fire-and-forget so no UI path ever waits on the cache.
 */
let persistTimer: ReturnType<typeof setTimeout> | null = null;
function persistCache(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const stamp = cache.updatedAt || new Date().toISOString();
    const pub: Record<string, any> = { updatedAt: stamp };
    for (const k of PUBLIC_COLLECTIONS) pub[k] = cacheSafe(cache[k] || [], stamp);
    void cacheSet(IDB_PUBLIC_NS, null, pub);
    if (currentAuthUid) {
      const priv: Record<string, any> = { updatedAt: stamp };
      for (const k of COLLECTION_NAMES) {
        if (PUBLIC_COLLECTIONS.has(k)) continue;
        priv[k] = cacheSafe(cache[k] || [], stamp);
      }
      void cacheSet(IDB_PRIVATE_NS, currentAuthUid, priv);
    }
  }, 120);
}

/**
 * Hydrate the in-memory snapshot from IndexedDB BEFORE Firebase answers, so a
 * refresh paints immediately. Cached data is never treated as authoritative:
 * the realtime listeners overwrite it as soon as the server replies.
 */
async function hydrateFromCache(): Promise<boolean> {
  let changed = false;
  try {
    const pub = await cacheGet<Record<string, any>>(IDB_PUBLIC_NS, null);
    if (pub) {
      for (const k of PUBLIC_COLLECTIONS) {
        if (Array.isArray(pub[k]) && pub[k].length && !cache[k]?.length) {
          cache[k] = clone(pub[k]);
          changed = true;
          if (!loadedNodes.has(k)) {
            loadedNodes.add(k);
            notifyNodeLoaded(k);
          }
        }
      }
    }
    // Private data is only ever hydrated for the *currently signed-in* uid.
    if (currentAuthUid) {
      const priv = await cacheGet<Record<string, any>>(IDB_PRIVATE_NS, currentAuthUid);
      if (priv) {
        for (const k of COLLECTION_NAMES) {
          if (PUBLIC_COLLECTIONS.has(k)) continue;
          if (Array.isArray(priv[k]) && priv[k].length && !cache[k]?.length) {
            cache[k] = clone(priv[k]);
            changed = true;
            if (!loadedNodes.has(k)) {
              loadedNodes.add(k);
              notifyNodeLoaded(k);
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn("store cache hydrate:", (e as Error)?.message);
  }
  if (changed) {
    cache.source = "idb-cache";
    notify({ source: "cache:hydrate", fromCache: true });
  }
  return changed;
}


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





let cache: any = fresh();


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


function load(): any {
  return clean(clone(cache));
}


const rtdbUnsubs: Array<() => void> = [];
let rtdbStarted = false;
let authUnsub: (() => void) | null = null;
let currentAuthUid: string | null = null;


const loadedNodes = new Set<CollectionName>();
const nodeLoadedSubs = new Set<(name: string) => void>();


export function onNodeLoaded(cb: (name: string) => void): () => void {
  nodeLoadedSubs.add(cb);
  return () => {
    nodeLoadedSubs.delete(cb);
  };
}


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
 * Attach realtime listeners INCREMENTALLY.
 *
 * Public collections are attached once at boot and are never torn down on an
 * auth change — only the private ones come and go. Combined with the shared
 * listener registry in rtdb.ts this guarantees exactly one Firebase listener
 * per node for the whole app, with no re-download on login/logout.
 */
const attached = new Map<CollectionName, () => void>();

function attachCollection(name: CollectionName): void {
  if (attached.has(name)) return;
  try {
    const un = watchList((NODES as any)[name] || name, (rows) => {
      const items = (filters[name] || ((x: any[]) => x))(rows.map((r) => normalizeDoc(r)));

      if (!loadedNodes.has(name)) {
        loadedNodes.add(name);
        notifyNodeLoaded(name);
      }

      // Firebase is authoritative: whatever it says replaces cache + UI state.
      if (JSON.stringify(items) === JSON.stringify(cache[name])) return;
      cache[name] = clone(items);
      cache.version = 1;
      cache.source = "rtdb";
      cache.updatedAt = new Date().toISOString();
      persistCache();
      notify({ source: "rtdb", node: name });
    });
    attached.set(name, un);
  } catch (e) {
    console.warn("store listener setup failed:", name, (e as Error)?.message);
  }
}

function detachCollection(name: CollectionName): void {
  const un = attached.get(name);
  if (!un) return;
  attached.delete(name);
  loadedNodes.delete(name);
  try {
    un();
  } catch {
    /* ignore */
  }
}

function startRealtimeSync() {
  rtdbStarted = true;
  for (const name of COLLECTION_NAMES) {
    if (canAttachCollection(name)) attachCollection(name);
    else detachCollection(name);
  }
}

function restartRealtimeSync(meta?: any) {
  // NOT a teardown: attach what is now allowed, detach what no longer is.
  startRealtimeSync();
  if (meta) notify(meta);
}

function watchAuthForPrivateNodes() {
  if (authUnsub) return;
  try {
    
    currentAuthUid = getAuthUser()?.uid || null;
    authUnsub = subscribeAuthUser((user) => {
      const au = getAuthInstance();
      const authCurrent = au ? au.currentUser : null;
      
      if (!user && authCurrent && authCurrent.uid && currentAuthUid === authCurrent.uid) return;
      const nextUid = (user && user.uid) ? user.uid : (authCurrent ? authCurrent.uid : null);
      if (nextUid === currentAuthUid && rtdbStarted) return;
      const prevUid = currentAuthUid;
      currentAuthUid = nextUid;
      let cleared = false;
      if (!nextUid) {
        // Logout — wipe private state from memory AND from IndexedDB.
        cleared = clearPrivateCacheOnLogout();
        void clearPrivateCache();
      } else if (prevUid && prevUid !== nextUid) {
        // A different user signed in — never let them see the previous
        // account's private cache.
        cleared = clearPrivateCacheOnLogout();
        void clearForeignCache(nextUid);
      }
      restartRealtimeSync({ source: nextUid ? "auth:login" : "auth:logout", privateCleared: cleared });
      if (nextUid && nextUid !== prevUid) void hydrateFromCache();
    });
  } catch (e) {
    console.warn("store auth watcher:", (e as Error)?.message);
  }
}


export function stopRealtimeSync(): void {
  for (const name of Array.from(attached.keys())) detachCollection(name);
  while (rtdbUnsubs.length) {
    try {
      (rtdbUnsubs.pop() as () => void)();
    } catch {
      /* ignore */
    }
  }
  rtdbStarted = false;
}

/** Number of realtime collections currently subscribed (test/debug). */
export function attachedCollectionCount(): number {
  return attached.size;
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
  persistCache();
  notify({ source });
  try {
    bc && bc.postMessage({ revision: next.revision, source });
  } catch (e) {
    
  }
}

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
  
}

function subscribe(fn: (state: any, meta?: any) => void): () => void {
  subscribers.add(fn);
  
  
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
  
  photo: d.photo || d.photoURL || "",
  ownerUid: d.ownerUid || d.uid || "",
});

const fromAdminDonor = (d: any) => {
  const out: any = { ...d };
  delete out.age; 
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

/* ───────────────────────── Optimistic write helper ─────────────────────────
 * Apply a change to the shared snapshot immediately (so the button feels
 * instant), then run the real Firebase write. If the write fails the snapshot
 * is rolled back to exactly what it was and the error is re-thrown so the
 * caller can toast it. Firebase remains the source of truth: its next realtime
 * event overwrites whatever we optimistically painted.
 */
async function optimistic<T>(
  mutateFn: (s: any) => any,
  commitFn: () => Promise<T>,
  source = "optimistic"
): Promise<T> {
  const before = clean(clone(cache));
  const draft = load();
  const next = clean(mutateFn(draft) || draft);
  next.revision = (Number(before.revision) || 0) + 1;
  next.updatedAt = new Date().toISOString();
  next.source = source;
  cache = clean(clone(next));
  persistCache();
  notify({ source, optimistic: true });
  try {
    const out = await commitFn();
    // Success — keep the optimistic view; the realtime listener will replace
    // it with the authoritative server value momentarily.
    persistCache();
    return out;
  } catch (e) {
    // Rollback. The UI returns to the last known-good state.
    cache = clean(clone(before));
    persistCache();
    notify({ source: source + ":rollback", rolledBack: true });
    throw e;
  }
}

/** Resolves once the IndexedDB hydration attempt has completed. */
let hydrateDone: Promise<boolean> = Promise.resolve(false);
const whenHydrated = () => hydrateDone;

/** True when we already hold data for `name` (cache or live) — no skeleton. */
function hasData(name: string): boolean {
  return Array.isArray(cache[name]) && cache[name].length > 0;
}

const store = {
  KEY,
  load,
  commit,
  updateAsync,
  optimistic,
  subscribe,
  onNodeLoaded,
  isNodeLoaded,
  hasData,
  whenHydrated,
  clone,
  toAdminDonor,
  fromAdminDonor,
  toDonerDonor,
  fromDonerDonor,
};


window.CBDCShared = store;
globalThis.CBDCShared = store;



dropLegacyLocalStorageCache();
watchAuthForPrivateNodes();

// 1) Paint from the IndexedDB cache as early as possible (non-blocking).
// 2) Attach the Firebase listeners in parallel — they are authoritative and
//    will overwrite the cached values the moment the server answers.
hydrateDone = hydrateFromCache().catch(() => false);
startRealtimeSync();

// Network flaps: on reconnect just make sure every allowed collection still
// has its (shared, de-duplicated) listener. Cached data stays on screen while
// offline — the UI never blanks out.
try {
  window.addEventListener("online", () => {
    startRealtimeSync();
    notify({ source: "network:online" });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") startRealtimeSync();
  });
} catch {
  /* non-browser environment */
}

export default store;
