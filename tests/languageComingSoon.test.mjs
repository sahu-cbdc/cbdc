/**
 * ভাষা: শুধুই বাংলা — English text/translation সম্পূর্ণ সরানো (সব প্যানেলে)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  • English আর selectable ভাষা নয় — Preferences-এ বোতামটি শুধু Coming-Soon
 *    placeholder; click করলে «English ভাষা খুব শীঘ্রই আসছে…» বার্তা, কোনো
 *    state/সংরক্ষণ/রেন্ডার বদল নয়।
 *  • English dictionary (DICT_EN/TOKEN_EN/UNIT_EN/EN_MON/EN_NUM), DOM-translation
 *    স্তর (tText/translateNode/watchI18n/protectNames) ও tp()-এর English মান —
 *    সব `.tsx` থেকে সম্পূর্ণ remove; tp() এখন শুধু বাংলা ফেরত দেয়।
 *  • বাংলা language system সম্পূর্ণ অপরিবর্তিত।
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (p) => readFileSync(path.join(process.cwd(), p), "utf8");
const ALL = ["src/pages/Admin.tsx", "src/pages/Moderator.tsx", "src/pages/Doner.tsx"];
const PANELS = ["src/pages/Admin.tsx", "src/pages/Moderator.tsx"];

test("English dictionary and DOM-translation layer are fully removed from every panel", () => {
  for (const f of ALL) {
    const src = read(f);
    assert.doesNotMatch(src, /const DICT_EN=\{/, f + ": DICT_EN removed");
    assert.doesNotMatch(src, /const TOKEN_EN=|TOKEN_EN\.unshift/, f + ": TOKEN_EN removed");
    assert.doesNotMatch(src, /const UNIT_EN=|const EN_MON=\{|const EN_NUM=\{/, f + ": unit/month/digit maps removed");
    assert.doesNotMatch(src, /function tText\(|function translateNode\(|function watchI18n\(/, f + ": translation engine removed");
    assert.doesNotMatch(src, /function protectNames\(|const NO_TR=/, f + ": translation-guard helpers removed");
    assert.doesNotMatch(src, /Object\.assign\(DICT_EN/, f + ": dictionary extensions removed");
    assert.doesNotMatch(src, /data-noi18n/, f + ": i18n markup attributes removed");
    /* "বাংলা": "English text" ধাঁচের কোনো translation-pair অবশিষ্ট নেই */
    assert.doesNotMatch(src, /"[\u0980-\u09FF][^"\n]*":"[A-Za-z][^"\n]*",\n\s*"[\u0980-\u09FF]/, f + ": no bn→en pair lines remain");
  }
});

test("tp() no longer carries English values — Bangla is the only output", () => {
  for (const f of ALL) {
    const src = read(f);
    assert.match(src, /const tp=\(b\)=>b;/, f + ": tp is a Bangla identity helper");
    assert.doesNotMatch(src, /const tp=\(bn,en\)=>isEN\(\)\?en:bn;/, f + ": old bilingual tp removed");
    /* কোনো call-site-এ দ্বিতীয় (English) argument নেই */
    assert.doesNotMatch(src, /tp\("[^"]*",\s*"/, f + ": no two-string tp() calls");
    assert.doesNotMatch(src, /tp\(`[^`]*`,\s*[`"]/, f + ": no two-template tp() calls");
  }
});

test("isEN is hard-disabled and the document language is always bn", () => {
  for (const f of ALL) {
    const src = read(f);
    assert.match(src, /const isEN=\(\)=>false;/, f + ": isEN always false");
    assert.match(src, /document\.documentElement\.lang="bn";/, f + ": document language pinned to bn");
    assert.doesNotMatch(src, /documentElement\.lang=[^=\n]*==="en"\?"en":"bn"/, f + ": no en mapping left");
  }
});

test("Admin & Moderator: language preference is normalised to bn at load AND after RTDB pull", () => {
  for (const f of PANELS) {
    const src = read(f);
    const forced = src.match(/ME\.prefs\.lang="bn";/g) || [];
    assert.ok(forced.length >= 3, f + ": forced-bn at load, after pull and in click handler (found " + forced.length + ")");
  }
});

test("English button is a Coming-Soon placeholder: never active, click shows message only", () => {
  for (const f of ALL) {
    const src = read(f);
    assert.match(src, /<button data-lg="en">English<\/button>/, f + ": English button kept, never 'on'");
  }
  for (const f of PANELS) {
    const src = read(f);
    assert.match(src, /if\(b\.dataset\.lg==="en"\)\{\s*\n\s*b\.classList\.remove\("on"\);/, f + ": English click never activates");
    assert.match(src, /toast\("English ভাষা খুব শীঘ্রই আসছে — বর্তমানে শুধু বাংলা ভাষা উপলব্ধ।"\);/, f + ": coming-soon message");
    assert.doesNotMatch(src, /ME\.prefs\.lang=b\.dataset\.lg;/, f + ": language can never be set from the button value");
  }
  const doner = read("src/pages/Doner.tsx");
  assert.match(doner, /STORE\.prefs\.lang="bn";/, "Doner forces bn at boot");
  assert.match(doner, /English — Coming Soon/, "Doner coming-soon note present");
});

test("Bangla stays fully intact in every panel (selected state, digits, re-render path)", () => {
  for (const f of PANELS) {
    const src = read(f);
    assert.match(src, /<button data-lg="bn" class="\$\{ME\.prefs\.lang==="bn"\?"on":""\}">বাংলা<\/button>/, f + ": বাংলা button + active state");
    assert.match(src, /"ভাষা বাংলা করা হয়েছে"/, f + ": বাংলা confirm toast unchanged");
    assert.match(src, /function applyLang\(\)\{/, f + ": applyLang kept");
    assert.match(src, /const bn=v=>String\(v\?\?""\)\.replace\(\/\\d\/g,d=>D9\[d\]\);/, f + ": Bangla digits untouched");
  }
  const doner = read("src/pages/Doner.tsx");
  assert.match(doner, /const bn=v=>String\(v\?\?""\)\.replace\(\/\\d\/g,d=>D9\[d\]\);/, "Doner Bangla digits (en branch removed)");
  assert.match(doner, /const LOC=\(\)=>"bn-BD";/, "Doner locale pinned to bn-BD");
});
