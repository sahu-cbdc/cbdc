/**
 * Cache-first realtime list.
 *
 * Panels watch a handful of nodes that are NOT part of the shared public store
 * (users, admins, audit, messages, reports, …). Previously every panel entry /
 * page refresh had to wait for Firebase before it could paint anything, which
 * is exactly what produced the skeletons.
 *
 * `watchListCached` fixes that without changing any UI:
 *   1. Immediately replays the last known rows from IndexedDB (if any) — the
 *      callback fires with `fromCache: true`.
 *   2. Attaches the shared (de-duplicated) Firebase listener; the first server
 *      snapshot overwrites the cached rows and refreshes the cache.
 *
 * Firebase always wins. The cache is scoped to the signed-in uid so one user
 * can never be shown another user's private rows.
 */
import { watchList, type Row } from "./rtdb";
import { cacheGet, cacheSet } from "./idbCache";

export type CachedListMeta = { fromCache: boolean };

const NS = (node: string) => `list:${node}`;

export function watchListCached(
  node: string,
  ownerUid: string | null | undefined,
  cb: (rows: Row[], meta: CachedListMeta) => void,
  opts: { orderBy?: string; equals?: string | number | boolean; limit?: number } = {}
): () => void {
  let stopped = false;
  let gotServer = false;

  // 1) cache-first paint (non-blocking, never authoritative)
  void cacheGet<Row[]>(NS(node), ownerUid)
    .then((rows) => {
      if (stopped || gotServer || !Array.isArray(rows) || !rows.length) return;
      try {
        cb(rows, { fromCache: true });
      } catch (e) {
        console.warn("watchListCached replay:", node, (e as Error)?.message);
      }
    })
    .catch(() => undefined);

  // 2) authoritative realtime stream
  const un = watchList(
    node,
    (rows) => {
      gotServer = true;
      if (stopped) return;
      void cacheSet(NS(node), ownerUid, rows);
      cb(rows, { fromCache: false });
    },
    opts
  );

  return () => {
    stopped = true;
    try {
      un();
    } catch {
      /* ignore */
    }
  };
}
