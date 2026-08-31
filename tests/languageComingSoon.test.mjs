/**
 * Preferences → ভাষা: English = Coming Soon placeholder (সব প্যানেলে)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  English আর selectable ভাষা নয় — click করলে শুধু «English ভাষা খুব শীঘ্রই
 *  আসছে…» বার্তা দেখায়; state/সংরক্ষণ/রেন্ডার কিছুই বদলায় না, প্যানেল সবসময়
 *  বাংলায় থাকে। বাংলা language system সম্পূর্ণ অপরিবর্তিত। অনুবাদ-অবকাঠামো
 *  (tp/dictionary/applyLang) ভবিষ্যতের জন্য রাখা আছে কিন্তু ব্যবহার হয় না।
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (p) => readFileSync(path.join(process.cwd(), p), "utf8");
const PANELS = ["src/pages/Admin.tsx", "src/pages/Moderator.tsx"];

test("Admin & Moderator: isEN is hard-disabled — English translation code can never run", () => {
  for (const f of PANELS) {
    const src = read(f);
    assert.match(src, /const isEN=\(\)=>false;/, f + ": isEN always false");
    assert.doesNotMatch(src, /const isEN=\(\)=>ME&&ME\.prefs&&ME\.prefs\.lang==="en";/, f + ": old check removed");
    /* the translation infrastructure stays for the future, but is gated on isEN */
    assert.match(src, /if\(isEN\(\)\)translateNode\(document\.body\);/, f + ": translate pass gated");
    assert.match(src, /if\(!isEN\(\)\)return;/, f + ": i18n observer gated");
  }
});

test("Admin & Moderator: language preference is normalised to bn at load AND after RTDB pull", () => {
  for (const f of PANELS) {
    const src = read(f);
    const forced = src.match(/ME\.prefs\.lang="bn";/g) || [];
    assert.ok(forced.length >= 3, f + ": forced-bn at load, after pull and in click handler (found " + forced.length + ")");
    assert.match(src, /ME=Object\.assign\(loadMe\(\),\{role:ME\.role\|\|PANEL\.role\}\);\s*\n\s*\/\*[\s\S]*?Coming Soon[\s\S]*?\*\/\s*\n\s*ME\.prefs\.lang="bn";/, f + ": normalised right after loadMe()");
  }
});

test("Admin & Moderator: English button is never active; click shows Coming-Soon toast only", () => {
  for (const f of PANELS) {
    const src = read(f);
    /* the button stays in the UI but has no active-state binding */
    assert.match(src, /<button data-lg="en" data-noi18n>English<\/button>/, f + ": English button kept, never 'on'");
    assert.doesNotMatch(src, /data-lg="en" class="\$\{ME\.prefs\.lang==="en"\?"on":""\}"/, f + ": old active binding removed");
    /* click on English: message only — no saveMe/applyLang, bn stays selected */
    assert.match(src, /if\(b\.dataset\.lg==="en"\)\{\s*\n\s*b\.classList\.remove\("on"\);/, f + ": English click never activates");
    assert.match(src, /toast\("English ভাষা খুব শীঘ্রই আসছে — বর্তমানে শুধু বাংলা ভাষা উপলব্ধ।"\);/, f + ": coming-soon message");
    assert.doesNotMatch(src, /ME\.prefs\.lang=b\.dataset\.lg;/, f + ": language can never be set from the button value");
    assert.doesNotMatch(src, /"Language changed to English"/, f + ": English-activation toast removed");
  }
});

test("Bangla stays fully intact in every panel (selected state, digits, re-render path)", () => {
  for (const f of PANELS) {
    const src = read(f);
    assert.match(src, /<button data-lg="bn" class="\$\{ME\.prefs\.lang==="bn"\?"on":""\}" data-noi18n>বাংলা<\/button>/, f + ": বাংলা button + active state unchanged");
    assert.match(src, /"ভাষা বাংলা করা হয়েছে"/, f + ": বাংলা confirm toast unchanged");
    assert.match(src, /function applyLang\(\)\{/, f + ": applyLang kept (future use + bn boot)");
    assert.match(src, /const bn=v=>String\(v\?\?""\)\.replace\(\/\\d\/g,d=>D9\[d\]\);/, f + ": Bangla digits untouched");
  }
});

test("Doner panel keeps its existing Coming-Soon behaviour (regression guard)", () => {
  const doner = read("src/pages/Doner.tsx");
  assert.match(doner, /STORE\.prefs\.lang="bn";/, "Doner forces bn at boot");
  assert.match(doner, /<button data-lg="en" data-noi18n>English<\/button>/, "Doner English button never active");
  assert.match(doner, /English — Coming Soon/, "Doner coming-soon note present");
});
