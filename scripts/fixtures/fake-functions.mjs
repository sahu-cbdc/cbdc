/**
 * Verification fixture — Cloud Functions stub (see scripts/verify-admin-panel.mjs).
 * Records every callable invocation and answers `deleteAccountCompletely`
 * the same way the deployed function does.
 */

export const __calls = [];
/** uid-গুলোর জন্য ফাংশন ইচ্ছে করে ব্যর্থ হবে (failure path পরীক্ষা)। */
export const __failingUids = new Set();

export function getFunctions() {
  return { __fake: true };
}

export function httpsCallable(functions, name) {
  return async (data) => {
    __calls.push({ name, data });
    if (name === "deleteAccountCompletely") {
      const rtdb = await import("./fake-rtdb.mjs");
      const uid = String(data?.uid || "");
      const donorId = String(data?.donorId || "");
      if (__failingUids.has(uid)) {
        const error = new Error("internal");
        error.code = "functions/internal";
        throw error;
      }
      /* ডেপ্লয় করা Cloud Function যা করে — Auth (সিমুলেটেড) + RTDB + Storage
         সব সার্ভার-সাইডেই মোছা। Client-এর লেখার অনুমতি লক করা থাকলেও কাজ করে। */
      const nodes = ["users", "admins", "accounts", "donors", "members", "queue", "requests", "reports"];
      const ownerFields = ["ownerUid", "uid", "userId", "ownerId"];
      const removed = {};
      const paths = [];
      const dumps = {};
      for (const node of nodes) dumps[node] = rtdb.__at(node) || {};
      const mark = (node, id, exists) => {
        const path = `${node}/${id}`;
        if (paths.includes(path)) return;
        paths.push(path);
        if (exists) removed[node] = (removed[node] || 0) + 1;
      };
      [["users", uid], ["admins", uid], ["accounts", uid], ...(donorId ? [["donors", donorId]] : [])]
        .forEach(([node, id]) => mark(node, id, Object.prototype.hasOwnProperty.call(dumps[node] || {}, id)));
      for (const node of nodes) {
        for (const [id, row] of Object.entries(dumps[node] || {})) {
          if (!row || typeof row !== "object") continue;
          const owner = ownerFields.map((f) => String(row[f] ?? "").trim()).find(Boolean) || "";
          const ownerMatch = owner === uid;
          const donorMatch = !!donorId && (String(row.donorId ?? "").trim() === donorId || id === donorId);
          if (!ownerMatch && !donorMatch) continue;
          mark(node, id, true);
        }
      }
      rtdb.__serverUpdate(Object.fromEntries(paths.map((p) => [p, null])));
      return {
        data: {
          ok: true,
          uid,
          donorId,
          auth: uid.endsWith("missing") ? "missing" : "deleted",
          removed,
          removedPaths: paths.length,
          storageRemoved: 0,
        },
      };
    }
    return { data: { ok: true } };
  };
}
