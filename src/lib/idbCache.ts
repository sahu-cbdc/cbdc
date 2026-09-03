/**
 * IndexedDB persistent cache — local, non-authoritative mirror of the data the
 * panels already read from Firebase Realtime Database.
 *
 *   Firebase RTDB  = SOURCE OF TRUTH (always authoritative)
 *   IndexedDB here = fast "first paint" cache so a refresh never shows a
 *                    full-page skeleton when we already have valid data.
 *
 * Design rules enforced by this module:
 *   • Schema/cache versioning — bumping CACHE_SCHEMA_VERSION silently drops
 *     every older record, so a future data-structure change can never be
 *     served from a stale cache.
 *   • Owner scoping — every record is stored under `${namespace}::${ownerKey}`
 *     where ownerKey is the Firebase Auth uid (or "public"). A record written
 *     for user A is therefore never readable as user B.
 *   • Private data is wiped on logout (`clearPrivateCache`).
 *   • Nothing here is ever used for authentication/authorization decisions;
 *     Firebase Auth + Security Rules stay the only authority.
 */

export const CACHE_SCHEMA_VERSION = 3;

const DB_NAME = "cbdc-cache";
const DB_VERSION = 1;
const STORE_NAME = "kv";
const PUBLIC_OWNER = "public";

/** Records older than this are ignored (still authoritative data comes from RTDB). */
export const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

export type CacheRecord<T = any> = {
  key: string;
  namespace: string;
  ownerKey: string;
  schema: number;
  savedAt: number;
  data: T;
};

function hasIndexedDb(): boolean {
  try {
    return typeof indexedDB !== "undefined" && !!indexedDB;
  } catch {
    return false;
  }
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    if (!hasIndexedDb()) return resolve(null);
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      return resolve(null);
    }
    req.onupgradeneeded = () => {
      try {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const os = db.createObjectStore(STORE_NAME, { keyPath: "key" });
          os.createIndex("ownerKey", "ownerKey", { unique: false });
        }
      } catch {
        /* ignore — cache is optional */
      }
    };
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore | null {
  try {
    return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
  } catch {
    return null;
  }
}

function keyOf(namespace: string, ownerKey: string): string {
  return `v${CACHE_SCHEMA_VERSION}::${namespace}::${ownerKey || PUBLIC_OWNER}`;
}

export function normalizeOwnerKey(uid?: string | null): string {
  const v = String(uid || "").trim();
  return v || PUBLIC_OWNER;
}

/** Read one cache record. Returns null on miss, schema mismatch, or expiry. */
export async function cacheGet<T = any>(
  namespace: string,
  ownerKey?: string | null,
  maxAgeMs: number = CACHE_MAX_AGE_MS
): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  const store = tx(db, "readonly");
  if (!store) return null;
  const rec = await new Promise<CacheRecord<T> | null>((resolve) => {
    try {
      const r = store.get(keyOf(namespace, normalizeOwnerKey(ownerKey)));
      r.onsuccess = () => resolve((r.result as CacheRecord<T>) || null);
      r.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  if (!rec) return null;
  if (rec.schema !== CACHE_SCHEMA_VERSION) return null;
  if (!Number.isFinite(rec.savedAt) || Date.now() - rec.savedAt > maxAgeMs) return null;
  return rec.data ?? null;
}

/** Write/replace one cache record. Never throws. */
export async function cacheSet<T = any>(
  namespace: string,
  ownerKey: string | null | undefined,
  data: T
): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const store = tx(db, "readwrite");
  if (!store) return;
  const owner = normalizeOwnerKey(ownerKey);
  const rec: CacheRecord<T> = {
    key: keyOf(namespace, owner),
    namespace,
    ownerKey: owner,
    schema: CACHE_SCHEMA_VERSION,
    savedAt: Date.now(),
    data,
  };
  await new Promise<void>((resolve) => {
    try {
      const r = store.put(rec);
      r.onsuccess = () => resolve();
      r.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function cacheDelete(namespace: string, ownerKey?: string | null): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const store = tx(db, "readwrite");
  if (!store) return;
  await new Promise<void>((resolve) => {
    try {
      const r = store.delete(keyOf(namespace, normalizeOwnerKey(ownerKey)));
      r.onsuccess = () => resolve();
      r.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function allRecords(): Promise<CacheRecord[]> {
  const db = await openDb();
  if (!db) return [];
  const store = tx(db, "readonly");
  if (!store) return [];
  return new Promise<CacheRecord[]>((resolve) => {
    try {
      const r = store.getAll();
      r.onsuccess = () => resolve((r.result as CacheRecord[]) || []);
      r.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function deleteKeys(keys: string[]): Promise<void> {
  if (!keys.length) return;
  const db = await openDb();
  if (!db) return;
  const store = tx(db, "readwrite");
  if (!store) return;
  await Promise.all(
    keys.map(
      (k) =>
        new Promise<void>((resolve) => {
          try {
            const r = store.delete(k);
            r.onsuccess = () => resolve();
            r.onerror = () => resolve();
          } catch {
            resolve();
          }
        })
    )
  );
}

/**
 * Drop every record that is NOT public (i.e. everything owned by a signed-in
 * uid) plus any record left over from an older schema version. Called on
 * logout so another user of the same browser can never see private data.
 */
export async function clearPrivateCache(): Promise<void> {
  const recs = await allRecords();
  const kill = recs
    .filter((r) => r.ownerKey !== PUBLIC_OWNER || r.schema !== CACHE_SCHEMA_VERSION)
    .map((r) => r.key);
  await deleteKeys(kill);
}

/** Drop everything owned by someone other than `ownerKey` (plus stale schemas). */
export async function clearForeignCache(ownerKey: string | null | undefined): Promise<void> {
  const owner = normalizeOwnerKey(ownerKey);
  const recs = await allRecords();
  const kill = recs
    .filter(
      (r) =>
        r.schema !== CACHE_SCHEMA_VERSION ||
        (r.ownerKey !== PUBLIC_OWNER && r.ownerKey !== owner)
    )
    .map((r) => r.key);
  await deleteKeys(kill);
}

export async function clearAllCache(): Promise<void> {
  const recs = await allRecords();
  await deleteKeys(recs.map((r) => r.key));
}

/** Test helper — forget the memoised connection. */
export function __resetCacheForTests(): void {
  dbPromise = null;
}
