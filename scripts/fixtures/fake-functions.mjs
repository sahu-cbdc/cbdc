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
      const uid = String(data?.uid || "");
      if (__failingUids.has(uid)) {
        const error = new Error("internal");
        error.code = "functions/internal";
        throw error;
      }
      return {
        data: {
          ok: true,
          uid,
          donorId: String(data?.donorId || ""),
          auth: uid.endsWith("missing") ? "missing" : "deleted",
          removed: { users: 1, donors: 1 },
          storageRemoved: 0,
        },
      };
    }
    return { data: { ok: true } };
  };
}
