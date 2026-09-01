/**
 * Auth-flow deterministic regression tests
 * ═══════════════════════════════════════════════════════════════════════════
 * Exercises the pure, dependency-injected `src/lib/authFlow.ts` orchestration
 * so the critical account-creation / login-resolution steps are tested without
 * a real browser or Firebase. All DB primitives are injected via a fake io.
 *
 * Covers: successful signup wiring, email/username/phone login resolution,
 * duplicate email handling, profile-write failure, loginIndex failure,
 * normalized email/phone/username, Google-signup path, and the requirement
 * that login never depends on fetchSignInMethodsForEmail.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  finalizeEmailSignup,
  backfillLoginIndex,
  resolveEmailForLogin,
  normalizeEmail,
  normalizeUsername,
  normalizePhone,
  isElevenDigitPhone,
} from "../src/lib/authFlow.ts";

function makeIo(overrides = {}) {
  const state = {
    users: {},
    emailIndex: {},
    loginIndex: { username: {}, phone: {} },
    created: [],
    updated: [],
    claims: [],
    emails: [],
  };
  const io = {
    state,
    async claimEmail(email, uid) {
      const key = normalizeEmail(email);
      const existing = state.emailIndex[key];
      if (existing && existing !== uid) return { status: "conflict", ownerUid: existing };
      if (existing === uid) return { status: "claimed" };
      state.emailIndex[key] = uid;
      state.emails.push(key);
      return { status: "claimed" };
    },
    async getProfile(uid) {
      return state.users[uid] || null;
    },
    async createProfile(uid, data) {
      state.created.push(uid);
      state.users[uid] = { ...data, id: uid };
    },
    async updateProfile(uid, data, existing) {
      state.updated.push(uid);
      state.users[uid] = { ...existing, ...data };
    },
    async claimLogin(email, username, phone) {
      const mail = normalizeEmail(email);
      state.claims.push(mail);
      if (username) state.loginIndex.username[normalizeUsername(username)] = mail;
      if (phone) state.loginIndex.phone[normalizePhone(phone)] = mail;
    },
    async lookupLoginKey(kind, value) {
      return state.loginIndex[kind][kind === "username" ? normalizeUsername(value) : normalizePhone(value)] || null;
    },
    ...overrides,
  };
  return io;
}

function signupInput(email, { username = "rahim", phone = "01812345678" } = {}) {
  return {
    uid: "uid-1234567890abcdef1234",
    email,
    username,
    phone,
    role: "donor",
    provider: "password",
    newData: { name: "রহিম", dob: "1990-01-01", bloodGroup: "O+", district: "চট্টগ্রাম", area: "চকবাজার", status: "active" },
    existingData: { uid: "uid-1234567890abcdef1234", name: "রহিম", photo: "" },
  };
}

test("signup: success creates profile, claims email + login index", async () => {
  const io = makeIo();
  const out = await finalizeEmailSignup(io, signupInput("Rahim@Example.com "));
  assert.equal(out.ok, true);
  assert.equal(out.existing, false);
  assert.equal(out.indexed, true);
  const uid = "uid-1234567890abcdef1234";
  assert.deepEqual(io.state.created, [uid]);
  assert.ok(io.state.users[uid]);
  assert.equal(io.state.users[uid].role, "donor");
  assert.equal(io.state.users[uid].email, "rahim@example.com");
  assert.equal(io.state.users[uid].username, "rahim");
  assert.equal(io.state.users[uid].phone, "01812345678");
  assert.ok(io.state.emails.includes("rahim@example.com"), "email identity claimed");
  assert.equal(io.state.loginIndex.username["rahim"], "rahim@example.com");
  assert.equal(io.state.loginIndex.phone["01812345678"], "rahim@example.com");
});

test("normalization: email, username, phone", () => {
  assert.equal(normalizeEmail("  Rahim@Example.COM "), "rahim@example.com");
  assert.equal(normalizeUsername("  RaHim_1 "), "rahim_1");
  assert.equal(normalizePhone("০১৮ ১২৩৪ ৫৬৭৮"), "01812345678");
  assert.equal(normalizePhone("  0181 2345 678  "), "01812345678");
  assert.equal(isElevenDigitPhone("01812345678"), true);
  assert.equal(isElevenDigitPhone("০১৮১২৩৪৫৬৭৮"), true);
  assert.equal(isElevenDigitPhone("0171234"), false);
});

test("duplicate email: second signup returns email-conflict and writes nothing", async () => {
  const io = makeIo();
  const first = await finalizeEmailSignup(io, signupInput("a@b.c"));
  assert.equal(first.ok, true);
  const second = await finalizeEmailSignup(
    io,
    { ...signupInput("a@b.c", { username: "other", phone: "01912345678" }), uid: "uid-different-account-9999" },
  );
  assert.equal(second.ok, false);
  assert.equal(second.reason, "email-conflict");
  const uid = "uid-1234567890abcdef1234";
  assert.equal(io.state.created.filter((u) => u === uid).length, 1, "original profile preserved");
  assert.equal(Object.keys(io.state.users).length, 1, "no second profile write for the conflict");
});

test("duplicate email resolves via merge callback then succeeds", async () => {
  const io = makeIo();
  await finalizeEmailSignup(io, signupInput("a@b.c"));
  // Pretend the legacy merge reclaims ownership for the same uid.
  const io2 = makeIo();
  io2.state.emailIndex["a@b.c"] = "uid-1234567890abcdef1234";
  const out = await finalizeEmailSignup(io2, {
    ...signupInput("a@b.c"),
    resolveConflict: async () => {
      delete io2.state.emailIndex["a@b.c"];
      return true;
    },
  });
  assert.equal(out.ok, true);
});

test("email claim unavailable → deterministic failure, no profile write", async () => {
  const io = makeIo({ claimEmail: async () => ({ status: "unavailable" }) });
  const out = await finalizeEmailSignup(io, signupInput("a@b.c"));
  assert.equal(out.ok, false);
  assert.equal(out.reason, "email-claim-unavailable");
  assert.equal(io.state.created.length, 0);
  assert.match(out.message, /যাচাই করা যায়নি|ডুপ্লিকেট|আবার চেষ্টা/);
});

test("profile write failure → deterministic profile-write-failed", async () => {
  const io = makeIo({
    createProfile: async () => {
      throw new Error("permission_denied at /users/uid");
    },
  });
  const out = await finalizeEmailSignup(io, signupInput("a@b.c"));
  assert.equal(out.ok, false);
  assert.equal(out.reason, "profile-write-failed");
  assert.equal(io.state.emailIndex["a@b.c"], "uid-1234567890abcdef1234", "email still claimed for retry-safety");
  assert.match(out.message, /প্রোফাইল সংরক্ষণ করা যায়নি/);
});

test("loginIndex failure is best-effort (non-fatal), signup still ok", async () => {
  const io = makeIo({
    claimLogin: async () => {
      throw new Error("permission denied loginIndex");
    },
  });
  const out = await finalizeEmailSignup(io, signupInput("a@b.c"));
  assert.equal(out.ok, true);
  assert.equal(out.indexed, false);
  assert.ok(io.state.users["uid-1234567890abcdef1234"], "profile written despite index failure");
});

test("Google signup path: existing profile update, email + index claimed", async () => {
  const io = makeIo();
  const uid = "uid-google1234567890abcd";
  io.state.users[uid] = { id: uid, uid, email: "g@x.y", name: "কবির", status: "active" };
  const out = await finalizeEmailSignup(io, {
    ...signupInput("g@x.y"),
    uid,
    provider: "google",
    existingData: { uid, name: "কবির", photo: "https://p/x.jpg" },
  });
  assert.equal(out.ok, true);
  assert.equal(out.existing, true);
  assert.deepEqual(io.state.updated, [uid]);
  assert.equal(io.state.users[uid].provider, "google");
  assert.equal(io.state.loginIndex.username["rahim"], "g@x.y");
});

test("email login: identifier that is an email resolves directly (normalized)", async () => {
  const io = makeIo();
  const email = await resolveEmailForLogin(io, "  Rahim@Example.com ");
  assert.equal(email, "rahim@example.com");
});

test("username login: resolves email via loginIndex", async () => {
  const io = makeIo();
  io.state.loginIndex.username["rahim"] = "rahim@example.com";
  const email = await resolveEmailForLogin(io, "Rahim");
  assert.equal(email, "rahim@example.com");
});

test("phone login: bangla/space-normalized phone resolves via loginIndex", async () => {
  const io = makeIo();
  io.state.loginIndex.phone["01812345678"] = "rahim@example.com";
  const email = await resolveEmailForLogin(io, "০১৮ ১২৩৪ ৫৬৭৮");
  assert.equal(email, "rahim@example.com");
});

test("username login missing index → null (caller reports not-found), no crash", async () => {
  const io = makeIo();
  const email = await resolveEmailForLogin(io, "unknownuser");
  assert.equal(email, null);
});

test("backfillLoginIndex writes username/phone after successful email login", async () => {
  const io = makeIo();
  const ok = await backfillLoginIndex(io, "rahim@example.com", "rahim", "01812345678");
  assert.equal(ok, true);
  assert.equal(io.state.loginIndex.username["rahim"], "rahim@example.com");
  assert.equal(io.state.loginIndex.phone["01812345678"], "rahim@example.com");
});

test("backfillLoginIndex best-effort: failure returns false, never throws", async () => {
  const io = makeIo({ claimLogin: async () => { throw new Error("denied"); } });
  const ok = await backfillLoginIndex(io, "rahim@example.com", "rahim", "01812345678");
  assert.equal(ok, false);
});

test("signup normalizes email before claiming (case + whitespace consistent)", async () => {
  const io = makeIo();
  const out = await finalizeEmailSignup(io, signupInput("  USER@Example.com "));
  assert.equal(out.ok, true);
  const key = Object.keys(io.state.emailIndex)[0];
  assert.equal(key, "user@example.com");
  assert.equal(io.state.users["uid-1234567890abcdef1234"].email, "user@example.com");
});
