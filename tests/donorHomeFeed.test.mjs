import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const doner = readFileSync(path.join(process.cwd(), "src/pages/Doner.tsx"), "utf8");

test("Donor home notice section reuses website notice visibility logic", () => {
  assert.match(doner, /function homeWebsiteNotices\(\)\{[\s\S]*noticeVisibleTo\(n,"website"\)/);
  assert.match(doner, /const noticeBlock=\(websiteNotices\.length\?/);
});

test("Donor home live board only shows approved active website requests", () => {
  assert.match(doner, /function homeLiveRequests\(\)\{[\s\S]*sharedPublicState\(\)\.requests\|\|\[\][\s\S]*status\|\|""\)\.trim\(\)\.toLowerCase\(\)==="approved"&&!homeRequestExpired\(r\)/);
  assert.match(doner, /লাইভ সহায়তা বোর্ড/);
  assert.match(doner, /const liveBoardBlock=\(liveBoardRequests\.length\?/);
});
