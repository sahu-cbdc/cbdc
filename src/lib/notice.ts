
import { updatePaths, watchRow } from "./rtdb";

export type NoticeTarget = "all" | "donor" | "moderator" | "website";

export type NoticeRecord = {
  id: string;
  title?: string;
  body?: string;
  status?: string;
  target?: string;
  audience?: string;
  from?: string;
  to?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
};

export function noticeTarget(value: unknown): NoticeTarget {
  const target = String(value || "all").trim().toLowerCase();
  if (target === "donor" || target === "moderator" || target === "website") return target;
  return "all";
}

export function noticeIsPublished(n: NoticeRecord | null | undefined): boolean {
  return !!n && String(n.status || "").toLowerCase() === "published";
}


export function noticeIsActive(n: NoticeRecord | null | undefined, at = new Date()): boolean {
  if (!n || !noticeIsPublished(n)) return false;
  const today = at.toISOString().slice(0, 10);
  return (!n.from || today >= String(n.from)) && (!n.to || today <= String(n.to));
}

export function noticeVisibleTo(
  n: NoticeRecord | null | undefined,
  audience: Exclude<NoticeTarget, "all">,
  at = new Date()
): boolean {
  if (!noticeIsActive(n, at)) return false;
  const target = noticeTarget(n?.target);
  return target === "all" || target === audience;
}


export function noticeReadKey(id: unknown): string {
  return String(id || "").replace(/[.#$\[\]/]/g, "_").slice(0, 120);
}

export function noticeReadsPath(uid: string): string {
  return `users/${String(uid)}/data/noticeReads`;
}

export async function markNoticeRead(uid: string, id: string): Promise<void> {
  if (!uid || !id) return;
  await updatePaths({ [`${noticeReadsPath(uid)}/${noticeReadKey(id)}`]: true });
}

export async function markAllNoticesRead(uid: string, ids: string[]): Promise<void> {
  if (!uid || !ids.length) return;
  const paths: Record<string, boolean> = {};
  ids.forEach((id) => {
    if (id) paths[`${noticeReadsPath(uid)}/${noticeReadKey(id)}`] = true;
  });
  if (Object.keys(paths).length) await updatePaths(paths);
}


export function watchNoticeReads(
  uid: string,
  callback: (reads: Record<string, boolean>) => void
): () => void {
  if (!uid) return () => undefined;
  return watchRow("users", uid, (row: any) => {
    const raw = row?.data?.noticeReads;
    const reads: Record<string, boolean> = {};
    if (raw && typeof raw === "object") {
      Object.entries(raw).forEach(([key, value]) => {
        if (value === true) reads[key] = true;
      });
    }
    callback(reads);
  });
}
