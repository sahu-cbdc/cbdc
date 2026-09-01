/**
 * Guarded multi-path write endpoint.
 *
 *   POST /api/data {op:"write", writes: {"users/<uid>/name": "...", ...}}
 *
 * Auth: Firebase ID token required. Every path is authorized by the write
 * guard (role + ownership + protected fields) against current data; one
 * denied path rejects the entire atomic request.
 */
import { ApiError } from "./deleteApi.ts";
import { authorizeDataWrite, callerRoleFromAdminRow } from "./writeGuard.ts";

export type DataWriteIo = {
  verifyToken(idToken: string): Promise<{ uid: string; email: string } | null>;
  getAdminRow(uid: string): Promise<any>;
  get(path: string): Promise<any>;
  patch(paths: Record<string, any>): Promise<void>;
};

export type DataWriteResult = {
  ok: true;
  applied: number;
  values: Record<string, number>;
};

export async function handleDataWrite(
  input: Record<string, unknown> | null | undefined,
  io: DataWriteIo
): Promise<DataWriteResult> {
  const idToken = String(input?.idToken ?? "").trim();
  if (!idToken) throw new ApiError(401, "অনুমোদন প্রয়োজন — লগইন করে আবার চেষ্টা করুন।");
  const verified = await io.verifyToken(idToken).catch(() => null);
  if (!verified || !verified.uid) {
    throw new ApiError(401, "টোকেন যাচাই ব্যর্থ হয়েছে — আবার লগইন করুন।");
  }
  const uid = String(verified.uid);
  const email = String(verified.email || "").trim().toLowerCase();
  const adminRow = await io.getAdminRow(uid).catch(() => null);
  const caller = callerRoleFromAdminRow(adminRow, uid, email);

  const plan = await authorizeDataWrite(caller, { writes: (input as any)?.writes }, io);
  await io.patch(plan.patch);
  return {
    ok: true,
    applied: Object.keys(plan.patch).length,
    values: plan.values,
  };
}

export default handleDataWrite;
