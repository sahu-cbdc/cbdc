/**
 * CBDC — shared application state store (Firestore-backed)
 *
 * This is the React + TypeScript replacement for the original
 * `window.CBDCShared` IIFE that every HTML page shipped with.
 *
 * IMPORTANT CHANGE (Firebase integration):
 *   - Firestore is now the single source of truth for all app data
 *     (donors / requests / queue / gallery / notices / accounts).
 *   - All dummy / static seed data has been removed — a fresh browser shows an
 *     empty list until real data exists in Firestore.
 *   - localStorage is no longer used for the shared data (it previously held
 *     the demo dataset). The store keeps an in-memory cache that is fed by
 *     Firestore `onSnapshot` listeners and pushed back to Firestore on change.
 *
 * The public API (`load`, `save`, `update`, `subscribe`, `clone`, and the
 * donor converters) is kept byte-for-byte compatible with the original so the
 * ported page logic works unchanged.
 */

import { getDb, COLLECTIONS } from "./firebase";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  setDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";

const KEY = "cbdc.shared.v1"; // kept for API compatibility only
const CHANNEL = "cbdc-demo-sync";

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
    source: "firebase",
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

/** Firestore Timestamp → ISO string, recursively (keeps JSON round-trips safe). */
function normalizeDoc(data: any): any {
  const fix = (v: any): any => {
    if (v && typeof v === "object") {
      // Firestore Timestamp instances
      if (typeof v.toDate === "function" && typeof v.seconds === "number") {
        return v.toDate().toISOString();
      }
      // Timestamps that already survived a JSON round-trip
      if (typeof v.seconds === "number" && typeof v.nanoseconds === "number" && Object.keys(v).length <= 2) {
        return new Date(v.seconds * 1000 + v.nanoseconds / 1e6).toISOString();
      }
      const out: any = Array.isArray(v) ? [] : {};
      for (const k of Object.keys(v)) out[k] = fix(v[k]);
      return out;
    }
    return v;
  };
  return fix(data);
}

// ── in-memory cache (fed by Firestore, mutated optimistically on write) ──
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

// ── Firestore live sync ──
const firestoreUnsubs: Array<() => void> = [];
let firestoreStarted = false;

function startFirestoreSync() {
  if (firestoreStarted) return;
  firestoreStarted = true;
  const db = getDb();
  if (!db) return;

  const specs: Record<string, any> = {
    donors: query(collection(db, COLLECTIONS.donors), where("status", "==", "approved")),
    requests: query(collection(db, COLLECTIONS.requests), where("status", "==", "approved")),
    queue: collection(db, COLLECTIONS.queue),
    gallery: query(collection(db, COLLECTIONS.gallery), orderBy("order", "asc")),
    notices: collection(db, COLLECTIONS.notices),
    accounts: collection(db, COLLECTIONS.accounts),
  };

  for (const name of COLLECTION_NAMES) {
    try {
      const un = onSnapshot(
        specs[name],
        (snap) => {
          const items = snap.docs.map((d) => normalizeDoc({ id: d.id, ...d.data() }));
          // Skip no-op echoes (e.g. our own write coming back unchanged).
          if (JSON.stringify(items) === JSON.stringify(cache[name])) return;
          cache[name] = clone(items);
          cache.version = 1;
          notify({ source: "firestore" });
        },
        (err) => console.warn("store listener:", name, err && err.message)
      );
      firestoreUnsubs.push(un);
    } catch (e) {
      console.warn("store listener setup failed:", name, (e as Error)?.message);
    }
  }
}

/** Incrementally push the diff between two lists of a collection to Firestore. */
async function writeDiff(name: string, oldList: any[], newList: any[]) {
  const db = getDb();
  if (!db) return;
  const oldById = new Map<string, any>(oldList.map((x) => [String(x.id), x]));
  const newById = new Map<string, any>(newList.map((x) => [String(x.id), x]));
  const tasks: Array<Promise<void>> = [];

  for (const [id, item] of newById) {
    const prev = oldById.get(id);
    if (!prev || JSON.stringify(prev) !== JSON.stringify(item)) {
      tasks.push(
        setDoc(doc(db, name, id), clone(item))
          .catch((e) => console.warn("store write:", name, id, (e as Error)?.message))
          .then(() => undefined)
      );
    }
  }
  for (const id of oldById.keys()) {
    if (!newById.has(id)) {
      tasks.push(
        deleteDoc(doc(db, name, id))
          .catch((e) => console.warn("store delete:", name, id, (e as Error)?.message))
          .then(() => undefined)
      );
    }
  }
  if (tasks.length) await Promise.all(tasks);
}

/** Persist a state snapshot: update cache, broadcast, and write diffs to Firestore. */
function save(state: any, source = "unknown"): any {
  const prev = load();
  const s = clean(clone(state));
  s.revision = (Number(prev.revision) || 0) + 1;
  s.updatedAt = new Date().toISOString();
  s.source = source;

  // optimistic local update
  cache = clean(clone(s));

  // background Firestore sync (diff-based, so unchanged collections cost nothing)
  for (const name of COLLECTION_NAMES) {
    void writeDiff(name, prev[name], s[name]);
  }

  // cross-tab notification (same mechanism as the original demo)
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

// ── donor converters (unchanged from the original shared store) ──
const toAdminDonor = (d: any) => ({
  id: d.id || d.donorId,
  name: d.name || "",
  group: d.bloodGroup || d.group || "",
  area: d.area || "",
  phone: d.phone || "",
  gender: d.gender || "",
  age: Number(d.age) || 20,
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
  age: Number(d.age) || "",
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
  age: Number(d.age) || "",
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
  age: Number(d.age) || "",
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

// Start Firestore live sync immediately (idempotent).
startFirestoreSync();

export default store;
