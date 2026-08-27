/**
 * CBDC — কেন্দ্রীয় Location (জেলা → থানা/এলাকা) ডেটা
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  চট্টগ্রাম জেলা — ২১টি এলাকা/থানা, বান্দরবান জেলা — ৭টি এলাকা/থানা।
 *
 *  নিয়ম:
 *   • নতুন Account তৈরি ও Donor হিসেবে Apply করার সময় নির্বাচন হয়
 *     **জেলা → থানা/এলাকা** — একটি জেলা বেছে নিলে শুধু সেই জেলার এলাকা দেখায়।
 *   • **রক্তদাতা খুঁজুন** (Donor Search) অংশে দুই জেলার সব এলাকা একসাথে থাকে।
 *   • Main Website, Doner Panel, Admin/Moderator Panel — সব জায়গায় একই
 *     তালিকা ব্যবহৃত হয় (এক জেলার এলাকা অন্য জেলার তালিকায় যায় না)।
 *
 *  পুরোনো ডোনার রেকর্ডে থাকা এলাকার মান (যেমন "কেরানী হাট", "বাজালিয়া")
 *  কখনো মুছে ফেলা হয় না — donor search dropdown-এ legacy মানগুলোও যুক্ত
 *  হয় যাতে আগের ডোনাররা ফিল্টারে হারিয়ে না যায় (দেখুন: searchAreas())।
 */

/** জেলা → থানা/এলাকার নির্ভরশীল তালিকা। */
export const DISTRICT_AREAS: Record<string, readonly string[]> = {
  "চট্টগ্রাম": [
    "কোতোয়ালি",
    "চকবাজার",
    "পাঁচলাইশ",
    "খুলশী",
    "বায়েজিদ বোস্তামী",
    "পাহাড়তলী",
    "আকবরশাহ",
    "হালিশহর",
    "ডবলমুরিং",
    "পতেঙ্গা",
    "ইপিজেড",
    "বন্দর",
    "কর্ণফুলী",
    "বাকলিয়া",
    "সদরঘাট",
    "চান্দগাঁও",
    "পটিয়া",
    "চন্দনাইশ",
    "কেরানিহাট",
    "সাতকানিয়া",
    "লোহাগাড়া",
  ],
  "বান্দরবান": [
    "বান্দরবান সদর",
    "রোয়াংছড়ি",
    "রুমা",
    "থানচি",
    "লামা",
    "আলীকদম",
    "নাইক্ষ্যংছড়ি",
  ],
} as const;

/** নির্বাচনযোগ্য জেলার তালিকা (ক্রম গুরুত্বপূর্ণ)। */
export const DISTRICTS: readonly string[] = Object.keys(DISTRICT_AREAS);

/** ডিফল্ট জেলা। */
export const DEFAULT_DISTRICT = "চট্টগ্রাম";

/** দুই জেলার সব এলাকা একসাথে — শুধুমাত্র রক্তদাতা খোঁজার ফিল্টারের জন্য। */
export const ALL_AREAS: readonly string[] = DISTRICTS.flatMap((d) => DISTRICT_AREAS[d]);

/**
 * একটি জেলার থানা/এলাকার তালিকা। অজানা জেলা দিলে ডিফল্ট জেলার তালিকা ফেরে,
 * যাতে কোনো ফর্মে কখনো খালি/ভুল তালিকা না দেখায়।
 */
export function areasForDistrict(district: string): string[] {
  const key = String(district || "").trim();
  return (DISTRICT_AREAS[key] || DISTRICT_AREAS[DEFAULT_DISTRICT]).slice();
}

/** একটি এলাকা কোন জেলার — খুঁজে না পেলে ডিফল্ট জেলা। */
export function districtOfArea(area: string): string {
  const a = String(area || "").trim();
  if (!a) return DEFAULT_DISTRICT;
  for (const d of DISTRICTS) {
    if (DISTRICT_AREAS[d].includes(a)) return d;
  }
  /* পুরোনো বানান (যেমন "কেরানী হাট") — কাছাকাছি মিল দেখে জেলা ধরে রাখি */
  if (/বান্দরবান|রোয়াংছড়ি|রুমা|থানচি|লামা|আলীকদম|নাইক্ষ্যংছড়ি/.test(a)) return "বান্দরবান";
  return DEFAULT_DISTRICT;
}

/**
 * Donor Search dropdown-এর এলাকা তালিকা — দুই জেলার সব এলাকা, সাথে লাইভ
 * ডোনার ডেটায় থাকা পুরোনো/অতিরিক্ত এলাকাও (যাতে কোনো বিদ্যমান ডোনার
 * ফিল্টারের বাইরে চলে না যায়)।
 */
export function searchAreas(existingAreas: Array<string | null | undefined> = []): string[] {
  const out = ALL_AREAS.slice();
  const seen = new Set(out);
  for (const raw of existingAreas || []) {
    const a = String(raw || "").trim();
    if (a && !seen.has(a)) {
      seen.add(a);
      out.push(a);
    }
  }
  return out;
}

/**
 * একটি `<select>`-এ জেলা-নির্ভর এলাকার অপশন ভরাট করে।
 *  - `selected` মিললে সেটি নির্বাচিত থাকে;
 *  - নির্বাচিত মান তালিকায় না থাকলেও (পুরোনো ডেটা) অপশন হিসেবে যোগ হয়,
 *    যাতে আগের মান হারিয়ে না যায়।
 */
export function fillAreaSelect(
  sel: HTMLSelectElement | null,
  district: string,
  selected = ""
): void {
  if (!sel) return;
  const areas = areasForDistrict(district);
  const selectedTrimmed = String(selected || "").trim();
  const hasSelected = !!selectedTrimmed && areas.includes(selectedTrimmed);
  sel.innerHTML =
    `<option value="">থানা / এলাকা নির্বাচন করুন</option>` +
    areas.map((a) => `<option${a === selectedTrimmed ? " selected" : ""}>${a}</option>`).join("") +
    (selectedTrimmed && !hasSelected ? `<option selected>${selectedTrimmed}</option>` : "");
  if (selectedTrimmed) sel.value = selectedTrimmed;
}
