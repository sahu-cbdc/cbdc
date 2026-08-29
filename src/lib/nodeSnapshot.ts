/**
 * CBDC — per-UID RTDB snapshot cache for panel-only nodes
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Admin/Moderator panels keep some networks live with **direct RTDB listeners**
 * (users / admins / audit / messages / reports). Those listeners are the source
 * of truth, but before their first snapshot arrives a refreshed/new page would
 * have to show a skeleton or an empty list — exactly what "no loading, data
 * retained everywhere" forbids.
 *
 * This module stores the LAST snapshot each direct listener delivered, scoped by
 * Firebase Auth UID (staff-only nodes — `users`, `queue`, `admins`, … are read-
 * protected by RTDB rules, so only staff ever get data to cache). On boot the
 * panel restores these snapshots synchronously and paints its screens instantly;
 * the live listener replaces them as soon as RTDB answers. It is a *read-only*
 * first-paint cache — it is never written back to RTDB.
 */

import { getAuthInstance } from "./firebase";

const PREFIX = "cbdc.rtdb.snapshot.v1.";
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days — last-known snapshot

function currentUid(): string {
  try {
    const auth = getAuthInstance();
    return String(auth?.currentUser?.uid || "").trim();
  } catch {
    return "";
  }
}

function keyFor(name: string, uid: string): string {
  return PREFIX + uid + "." + name;
}

/** এই UID-র শেষ দেখা snapshot — না থাকলে/মেয়াদোত্তীর্ণ হলে null। */
export function restoreNodeSnapshot(name: string): any[] | null {
  const uid = currentUid();
  if (!uid || !name) return null;
  try {
    const raw = localStorage.getItem(keyFor(name, uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (String(parsed?.uid || "") !== uid || String(parsed?.name || "") !== name) return null;
    const savedAt = Date.parse(parsed?.savedAt || "");
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > MAX_AGE_MS) return null;
    const rows = parsed?.rows;
    if (!Array.isArray(rows)) return null;
    return rows;
  } catch {
    /* localStorage may be unavailable */
    return null;
  }
}

/** প্রতিটি live snapshot-এর পরে সার্ভ করা (সবসময় current UID-এ)। */
export function saveNodeSnapshot(name: string, rows: any[]): void {
  const uid = currentUid();
  if (!uid || !name || !Array.isArray(rows)) return;
  try {
    localStorage.setItem(
      keyFor(name, uid),
      JSON.stringify({ version: 1, uid, name, savedAt: new Date().toISOString(), rows }),
    );
  } catch {
    /* ignore quota/private-mode errors */
  }
}

/** Logout/account-switch — এই UID-এর সংরক্ষিত snapshot মুছে ফেলা। */
export function clearNodeSnapshot(name: string): void {
  const uid = currentUid();
  if (!uid || !name) return;
  try {
    localStorage.removeItem(keyFor(name, uid));
  } catch {
    /* ignore */
  }
}

/** সব সংরক্ষিত panel snapshot মুছে ফেলা (logout flow-এর জন্য)। */
export function clearAllNodeSnapshots(): void {
  const uid = currentUid();
  if (!uid) return;
  try {
    const prefix = PREFIX + uid + ".";
    const drop: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) drop.push(k);
    }
    drop.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
