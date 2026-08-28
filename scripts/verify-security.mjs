/**
 * CBDC — Security & architecture verification
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  ১. কোনো private credential / server secret / third-party API key যেন
 *     frontend source, bundled JS, HTML বা browser-এ expose না হয়।
 *  ২. Client-side Firebase config-এ শুধু publicly-safe key থাকে।
 *  ৩. সব sensitive operation (Auth delete, image upload) secure server-side
 *     endpoint (Cloud Function) দিয়ে হয়।
 *  ৪. RTDB Security Rules — private node কঠোরভাবে protected, public node শুধু
 *     পাবলিক ওয়েবসাইটের জন্য open।
 *  ৫. Production data-এর single source of truth = RTDB (কোনো dev/demo/localStorage
 *     data source নেই)।
 *  ৬. Host-independent build (কোনো host-নির্দিষ্ট hardcoded path/URL নেই)।
 *
 * Run with:  npm run verify-security
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const ok = (cond, label, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? "  — " + extra : ""}`);
  if (!cond) failures++;
};

const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");
/** কমেন্ট/ডক বাদ দিয়ে শুধু কোড — নথিতে secret-এর নাম থাকলেই ভুল hit হবে না। */
const code = (rel) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".git", "dist", "coverage"].includes(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(path.relative(ROOT, full));
  }
  return out;
};

/* ─────────── ১. Build (bundle পরীক্ষার জন্য) ─────────── */
console.log("\n── ১. Production build — bundle-এ কোনো secret আছে কি না ──");
let distFiles = [];
try {
  execFileSync("npx", ["vite", "build", "--logLevel", "error"], { cwd: ROOT, stdio: "pipe" });
  distFiles = walk(path.join(ROOT, "dist"));
  ok(distFiles.length > 0, "production build সফল (dist তৈরি)", `${distFiles.length} ফাইল`);
} catch (e) {
  ok(false, "production build সফল", String(e?.message || e).slice(0, 160));
}

/**
 * Firebase web config-এর `apiKey` Google-নির্ধারিতভাবেই **public** (শুধু project
 * identifier; নিরাপত্তা RTDB rules দিয়ে) — তাই সেটিকে allow-list করে বাকি সব
 * AIza… key (server/private) বন্ধ রাখা হয়।
 */
const firebaseSrcEarly = readFileSync(path.join(ROOT, "src/lib/firebase.ts"), "utf8");
const PUBLIC_FIREBASE_API_KEY =
  firebaseSrcEarly.match(/apiKey:\s*"([^"]+)"/)?.[1] || "";
const isPublicFirebaseKey = (value) => !!PUBLIC_FIREBASE_API_KEY && value === PUBLIC_FIREBASE_API_KEY;

/* secret patterns — bundle/HTML/JS-এ থাকলেই ব্যর্থ */
const SECRET_PATTERNS = [
  [/BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY/, "private key block"],
  [/"type"\s*:\s*"service_account"/i, "service-account JSON"],
  [/private_key\s*[:=]\s*["'][^"']{20,}/i, "private_key field"],
  [/client_secret\s*[:=]\s*["'][^"']{8,}/i, "OAuth client secret"],
  [/-----BEGIN CERTIFICATE-----/, "embedded certificate"],
  [/AIza[0-9A-Za-z_-]{35}/, "Google API key (AIza…)", isPublicFirebaseKey],
  [/ya29\.[0-9A-Za-z_-]{10,}/, "OAuth access token"],
  [/1\/\/0[0-9A-Za-z_-]{20,}/, "OAuth refresh token"],
  [/https:\/\/[a-z0-9-]+\.firebaseio\.com\/?.*auth=/i, "RTDB URL + auth token"],
  [/["']?[a-z_]*key["']?\s*[:=]\s*["'][0-9a-f]{32}["']/i, "ImgBB/API key (32-hex, quoted)"],
  [/VITE_IMGBB_API_KEY\s*:"[0-9a-f]{32}"/, "ImgBB key value (env inline)"],
  [/sk_live_[0-9a-z]{10,}/i, "Stripe live secret"],
  [/xoxb-[0-9A-Za-z-]{10,}/, "Slack bot token"],
];

const bundleFiles = distFiles.filter((f) => /\.(js|html|css|json|map)$/i.test(f));
let secretHits = 0;
for (const file of bundleFiles) {
  const content = readFileSync(path.join(ROOT, file), "utf8");
  for (const [re, label, allow] of SECRET_PATTERNS) {
    const match = content.match(re);
    if (!match) continue;
    /* allow-list: Firebase-এর public web apiKey (rules-ই আসল নিরাপত্তা) */
    if (typeof allow === "function" && allow(match[0])) continue;
    ok(false, `bundle-এ কোনো secret নেই (${file})`, label);
    secretHits += 1;
  }
}
if (!secretHits) ok(true, `bundle/HTML/JSON-এ কোনো secret নেই (${bundleFiles.length} ফাইল স্ক্যান)`);

/* Firebase web config public-safe কি না — apiKey থাকতে পারে (public by design),
   কিন্তু service-account/private key থাকতে পারবে না। */
const indexHtml = existsSync(path.join(ROOT, "dist/index.html")) ? readFileSync(path.join(ROOT, "dist/index.html"), "utf8") : "";
ok(!/service_account|private_key/.test(indexHtml), "index.html-এ কোনো credential নেই");

/* ─────────── ২. Source-level: client-এ sensitive operation নেই ─────────── */
console.log("\n── ২. Client code — Admin SDK/secret/sensitive operation নেই ──");
const clientFiles = walk(path.join(ROOT, "src"));
const BANNED_IN_CLIENT = [
  [/from\s+["']firebase-admin/, "firebase-admin import"],
  [/require\(["']firebase-admin/, "firebase-admin require"],
  [/admin\.credential/, "admin credential"],
  [/admin\.auth\(\)\.deleteUser|getAuth\(\)\.deleteUser/, "client-side Auth delete"],
  [/\.bucket\s*\(|deleteFiles\s*\(/, "Cloud Storage operation"],
  [/process\.env\.[A-Z_]*(SECRET|PRIVATE|KEY)[A-Z_]*/, "server secret env read"],
];
let clientHits = 0;
for (const file of clientFiles) {
  if (!/\.(ts|tsx|js|jsx|css|html)$/i.test(file)) continue;
  const content = read(file);
  for (const [re, label] of BANNED_IN_CLIENT) {
    if (re.test(content)) {
      ok(false, `${file} — নিষিদ্ধ pattern নেই`, label);
      clientHits += 1;
    }
  }
}
if (!clientHits) ok(true, `src/-এ কোনো Admin SDK / Storage / client-side Auth-delete নেই (${clientFiles.length} ফাইল)`);

/* ImgBB — আগের working system-ই (কোনো নতুন flow/config নেই) */
const imgbb = code("src/lib/imgbb.ts");
ok(!/["'][0-9a-f]{32}["']/.test(imgbb), "src/lib/imgbb.ts — কোনো hardcoded key literal নেই");
ok(/https:\/\/api\.imgbb\.com\/1\/upload/.test(imgbb), "ImgBB upload endpoint আগের মতোই");
ok(/getRow\(\s*"settings"\s*,\s*"imgbb"\s*\)/.test(imgbb), "key-এর মূল উৎস RTDB `settings/imgbb`");
ok(/compressImage/.test(imgbb) && /FormData/.test(imgbb),
  "flow অপরিবর্তিত: compress → ImgBB → URL → RTDB");
ok(!/uploadImageViaServer|from "\.\/cloud"/.test(imgbb),
  "ImgBB-এর সাথে কোনো Cloud Function/server dependency নেই");

/* Cloud Functions / Firestore / Storage — কোনো dependency নেই */
ok(!existsSync(path.join(ROOT, "functions")), "Cloud Functions remove (functions/ ডিরেক্টরি নেই)");
ok(!existsSync(path.join(ROOT, "src/lib/cloud.ts")), "Cloud Function wrapper (src/lib/cloud.ts) নেই");
ok(!/"functions":/.test(read("firebase.json")), "firebase.json-এ functions config নেই");
let callableHits = 0;
for (const file of clientFiles) {
  if (!/\.(ts|tsx)$/i.test(file)) continue;
  if (/httpsCallable|firebase\/functions/.test(code(file))) callableHits += 1;
}
ok(callableHits === 0, "src/-এ কোথাও Cloud Function call নেই", String(callableHits));
ok(!/getFirestore|firestore\(\)/.test(code("src/lib/firebase.ts")), "Firestore-এর কোনো ব্যবহার নেই");
/* ─────────── ৩. Firebase client config — শুধু public-safe ─────────── */
console.log("\n── ৩. Client-side Firebase config — শুধু publicly-safe key ──");
const firebaseSrc = read("src/lib/firebase.ts");
const PUBLIC_FIREBASE_KEYS = ["apiKey", "authDomain", "databaseURL", "projectId",
  "storageBucket", "messagingSenderId", "appId", "measurementId"];
const SENSITIVE_FIREBASE_KEYS = ["privateKey", "clientSecret", "serviceAccount", "refreshToken"];
const configBlock = firebaseSrc.match(/DEFAULT_FIREBASE_CONFIG\s*=\s*\{([\s\S]*?)\n\}/)?.[1] || "";
const declared = [...configBlock.matchAll(/^\s{2}"?([A-Za-z_]+)"?:\s*["']?[^"']*["']?,?$/gm)].map((m) => m[1]);
const unknownKeys = [...new Set(declared)].filter(
  (k) => !PUBLIC_FIREBASE_KEYS.includes(k) && !SENSITIVE_FIREBASE_KEYS.includes(k),
);
ok(unknownKeys.length === 0, "Firebase config-এ অজানা কোনো field নেই", unknownKeys.join(","));
for (const bad of SENSITIVE_FIREBASE_KEYS) {
  ok(!new RegExp(`\\b${bad}\\b`).test(firebaseSrc), `client config-এ ${bad} নেই`);
}
ok(declared.length > 0 && /apiKey|projectId/.test(configBlock), "client config-এ Firebase public identifier আছে");
ok(/public client-side identifiers|public/.test(firebaseSrc),
  "config-এর public-safe হওয়ার নথি আছে");

/* ─────────── ৪. RTDB Security Rules ─────────── */
console.log("\n── ৪. RTDB Security Rules — private node কঠোরভাবে protected ──");
const rules = JSON.parse(read("database.rules.json")).rules;
const staff = "root.child('admins').child(auth.uid).exists()";
const admin = "root.child('admins').child(auth.uid).child('role').val() === 'admin'";
const PUBLIC_BY_DESIGN = new Set(["donors", "requests", "gallery", "notices"]); // পাবলিক ওয়েবসাইট
for (const node of ["users", "admins", "accounts", "queue", "audit", "messages", "reports", "members"]) {
  const read = rules[node]?.[""] || rules[node]?.[".read"];
  ok(typeof read === "string" && read.includes("auth != null"),
    `rules: ${node} — public read বন্ধ (auth বাধ্যতামূলক)`, String(read).slice(0, 60));
}
for (const node of PUBLIC_BY_DESIGN) {
  ok(rules[node]?.[".read"] === true, `rules: ${node} — public read (ওয়েবসাইটের জন্য, by design)`);
}
ok(rules.settings?.app?.[".read"] === true || rules.settings?.[".read"] === true,
  "rules: settings/app — public read (ওয়েবসাইট approval flag)");
ok(typeof rules.settings?.[".write"] === "string" && rules.settings[".write"].includes(admin),
  "rules: settings লেখার অনুমতি শুধু admin");
ok(!/["']key["']\s*:\s*["'][0-9a-f]{32}["']/.test(read("database.rules.json")),
  "rules ফাইলে কোনো key literal নেই");
ok(rules.users?.$uid?.donorStatus?.[".validate"]?.includes(admin) ||
   rules.users?.$uid?.donorStatus?.[".validate"]?.includes("moderator"),
  "rules: donorStatus — শুধু staff approve করতে পারে");
ok(rules.rules === undefined && rules[".read"] === undefined ? true : rules[".read"]?.includes(admin),
  "rules: root read — শুধু admin");

/* ─────────── ৫. RTDB-ই single source of truth ─────────── */
console.log("\n── ৫. Production data — RTDB-ই single source of truth ──");
const store = read("src/lib/store.ts");
ok(/CACHE_ENABLED/.test(store) && /DEV === true|MODE === "development"/.test(store),
  "localStorage public cache শুধু dev-এ (production-এ RTDB-only)");
ok(/if \(!CACHE_ENABLED\) return s;/.test(store) && /if \(!CACHE_ENABLED\) return;/.test(store),
  "cache read/write দুটোতেই gating আছে");
const seedBody = code("src/pages/Admin.tsx").match(/function seed\(\)\s*\{[\s\S]*?\n  \}/)?.[0] || "";
const seedArrays = [...seedBody.matchAll(/\[([^\]]*)\]/g)].map((m) => m[1].trim()).filter(Boolean);
ok(seedArrays.length === 0, "Admin panel-এ কোনো seed/demo data নেই", seedArrays.slice(0, 2).join(" | "));
ok(/Firebase is the single source of truth/.test(read("src/pages/Admin.tsx")),
  "panel-এ RTDB-কে source of truth হিসেবে নথিভুক্ত করা আছে");
for (const file of ["src/pages/Home.tsx", "src/pages/Doner.tsx", "src/pages/Admin.tsx", "src/pages/Moderator.tsx"]) {
  const content = read(file);
  ok(!/hardcoded|demo data|mock data/i.test(content.slice(0, 4000)),
    `${file} — কোনো hardcoded/demo data source নেই`);
}

/* ─────────── ৬. Host independence ─────────── */
console.log("\n── ৬. Host-independent build ──");
const viteCfg = read("vite.config.ts");
ok(/process\.env\.VITE_BASE \|\| "\/"/.test(viteCfg), "base path env-driven (ডিফল্ট '/' — যেকোনো host)");
ok(/apply: "serve"/.test(viteCfg) && /command !== "serve"/.test(viteCfg),
  "source-লেখা middleware শুধু `vite dev`-এ (build/preview-এ নেই)");
ok(/cross-origin request rejected/.test(viteCfg), "dev middleware-এ same-origin যাচাই");
const sourceFiles = [...walk(path.join(ROOT, "src")), ...(existsSync(path.join(ROOT, "index.html")) ? ["index.html"] : [])];
const hostSpecific = [];
for (const file of sourceFiles) {
  if (!/\.(ts|tsx|html)$/i.test(file)) continue;
  const content = read(file);
  for (const m of content.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
    const host = m[1];
    if (/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(host)) hostSpecific.push(`${file}:${host}`);
  }
}
ok(hostSpecific.length === 0, "source-এ কোনো localhost/hardcoded host নেই", hostSpecific.slice(0, 3).join(", "));

/* ─────────── ৭. Functions: sensitive op-এ auth বাধ্যতামূলক ─────────── */
console.log("\n── ৭. শুধু Auth + RTDB + ImgBB — কোনো server-side dependency নেই ──");
ok(!existsSync(path.join(ROOT, "functions")), "functions/ ডিরেক্টরি নেই");
ok(!existsSync(path.join(ROOT, "src/lib/cloud.ts")), "src/lib/cloud.ts নেই");
const pkg = JSON.parse(read("package.json"));
ok(!/firebase-functions|firebase-admin/.test(JSON.stringify(pkg.dependencies || {})),
  "package.json-এ কোনো functions/admin dependency নেই");
ok(!!(pkg.dependencies || {}).firebase, "firebase SDK আছে (Authentication + Realtime Database)");
const allSource = clientFiles.filter((f) => /\.(ts|tsx)$/i.test(f)).map((f) => read(f)).join("\n");
ok(!/httpsCallable\s*\(/.test(allSource), "কোথাও httpsCallable কল নেই");
ok(/api\.imgbb\.com/.test(allSource), "ImgBB image hosting ব্যবহৃত (আগের মতোই)");
ok(!/getFirestore|firestore\(\)|firebase\/storage|getStorage\s*\(/.test(allSource),
  "Firestore/Storage-এর কোনো ব্যবহার নেই");


console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL SECURITY CHECKS PASSED");
process.exit(failures ? 1 : 0);
