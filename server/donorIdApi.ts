/**
 * Staff-only donor-id allocation.
 *
 *   POST /api/donor/id {action:"next"}                → CBDC-YYYY-NNNN
 *   POST /api/donor/id {action:"release", donorId}    → free the serial
 *
 * Serial allocation used to run in the browser with an RTDB transaction;
 * it now runs on the server so _meta claims stay privileged and ids stay
 * unique no matter who calls (website or a future mobile app).
 */
import { ApiError } from "./deleteApi.ts";

export type DonorIdIo = {
  verifyToken(idToken: string): Promise<{ uid: string; email: string } | null>;
  getAdminRow(uid: string): Promise<any>;
  get(path: string): Promise<any>;
  list(node: string): Promise<any>;
  patch(paths: Record<string, any>): Promise<void>;
};

const SERIALS_NODE = "_meta/donorSerials";
const DONOR_ID_RE = /^CBDC-(\d{4})-(\d{4})$/i;
const CLAIM_FRESH_MS = 45_000;
const MAX_ATTEMPTS = 32;

function parseDonorSerial(id: unknown): number {
  const m = String(id || "").trim().match(DONOR_ID_RE);
  if (!m) return 0;
  const n = Number(m[2]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function serialKey(seq: number): string {
  return String(seq).padStart(4, "0");
}

function parseClaimKey(k: string): number {
  const s = String(k || "").trim();
  if (/^\d{1,6}$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  return parseDonorSerial(s);
}

function isFreshClaim(val: any): boolean {
  if (!val) return false;
  const at = Date.parse(String((val && (val.at || val.claimedAt)) || ""));
  if (!Number.isFinite(at)) return false;
  return Date.now() - at < CLAIM_FRESH_MS;
}

function collectSerials(donors: Record<string, any> | null): Set<number> {
  const used = new Set<number>();
  if (!donors || typeof donors !== "object") return used;
  for (const row of Object.values(donors || {})) {
    const a = String((row as any)?.donorId || "").trim();
    const b = String((row as any)?.id || "").trim();
    for (const raw of a && b && a !== b ? [a, b] : [a || b]) {
      const serial = parseDonorSerial(raw);
      if (serial) used.add(serial);
    }
  }
  return used;
}

function smallestFreeSerial(used: Set<number>): number {
  const max = used.size ? Math.max(...used) : 0;
  for (let i = 1; i <= max; i++) if (!used.has(i)) return i;
  return max + 1;
}

async function requireStaff(io: DonorIdIo, idToken: string): Promise<void> {
  const token = String(idToken || "").trim();
  if (!token) throw new ApiError(401, "অনুমোদন প্রয়োজন — লগইন করে আবার চেষ্টা করুন।");
  const verified = await io.verifyToken(token).catch(() => null);
  if (!verified || !verified.uid) {
    throw new ApiError(401, "টোকেন যাচাই ব্যর্থ হয়েছে — আবার লগইন করুন।");
  }
  const adminRow = await io.getAdminRow(verified.uid).catch(() => null);
  const role = String((adminRow && adminRow.role) || "").toLowerCase();
  const status = String((adminRow && adminRow.status) || "active").toLowerCase();
  const staff = (role === "admin" || role === "moderator" || role === "mod") && status !== "disabled";
  if (!staff) {
    throw new ApiError(403, "শুধু অ্যাডমিন/মডারেটর নতুন ডোনার আইডি ইস্যু করতে পারেন।");
  }
}

export async function handleDonorIdAction(
  input: Record<string, unknown> | null | undefined,
  io: DonorIdIo
): Promise<{ ok: true; donorId: string; released?: boolean }> {
  await requireStaff(io, String(input?.idToken ?? ""));
  const action = String(input?.action ?? "next").trim();

  if (action === "release") {
    const donorId = String(input?.donorId ?? "").trim();
    const serial = parseDonorSerial(donorId);
    if (serial) {
      await io.patch({ [`${SERIALS_NODE}/${serialKey(serial)}`]: null }).catch(() => undefined);
    }
    return { ok: true, donorId, released: true };
  }
  if (action !== "next") {
    throw new ApiError(400, "অজানা action — শুধু next বা release।");
  }

  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const donors = (await io.list("donors").catch(() => null)) as Record<string, any> | null;
    const used = collectSerials(donors);
    const claims = (await io.get(SERIALS_NODE).catch(() => null)) as Record<string, any> | null;
    if (claims && typeof claims === "object") {
      for (const k of Object.keys(claims)) {
        const n = parseClaimKey(k);
        if (n > 0 && isFreshClaim(claims[k])) used.add(n);
      }
    }
    const seq = smallestFreeSerial(used);
    if (seq < 1) continue;
    const key = serialKey(seq);
    const claimPath = `${SERIALS_NODE}/${key}`;
    const claim = { at: new Date().toISOString(), year, seq };
    await io.patch({ [claimPath]: claim }).catch(() => undefined);

    const verify = (await io.get(claimPath).catch(() => null)) as any;
    if (!verify || String(verify.at || "") !== claim.at) continue;

    const donorsAgain = (await io.list("donors").catch(() => null)) as Record<string, any> | null;
    if (collectSerials(donorsAgain).has(seq)) {
      await io.patch({ [claimPath]: null }).catch(() => undefined);
      continue;
    }
    return { ok: true, donorId: `CBDC-${year}-${String(seq).padStart(4, "0")}` };
  }
  throw new ApiError(502, "Donor UID তৈরি করা যায়নি। একটু পর আবার চেষ্টা করুন।");
}
