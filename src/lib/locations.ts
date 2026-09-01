


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
    "সদরঘাট",
    "চান্দগাঁও",
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


export const DISTRICTS: readonly string[] = Object.keys(DISTRICT_AREAS);


export const DEFAULT_DISTRICT = "চট্টগ্রাম";


export const ALL_AREAS: readonly string[] = DISTRICTS.flatMap((d) => DISTRICT_AREAS[d]);


export function areasForDistrict(district: string): string[] {
  const key = String(district || "").trim();
  return (DISTRICT_AREAS[key] || DISTRICT_AREAS[DEFAULT_DISTRICT]).slice();
}


export function districtOfArea(area: string): string {
  const a = String(area || "").trim();
  if (!a) return DEFAULT_DISTRICT;
  for (const d of DISTRICTS) {
    if (DISTRICT_AREAS[d].includes(a)) return d;
  }
  
  if (/বান্দরবান|রোয়াংছড়ি|রুমা|থানচি|লামা|আলীকদম|নাইক্ষ্যংছড়ি/.test(a)) return "বান্দরবান";
  return DEFAULT_DISTRICT;
}


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
