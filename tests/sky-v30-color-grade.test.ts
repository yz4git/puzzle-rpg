import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("V30 reference color grade is mounted in both runtimes below the HUD", () => {
  const grade = readFileSync(new URL("../app/SkyDancerColorGradeV30.tsx", import.meta.url), "utf8");
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const pagesEntry = readFileSync(new URL("../pages-entry.tsx", import.meta.url), "utf8");
  assert.match(grade, /skyDancerV30ColorGrade/);
  assert.match(grade, /mix-blend-mode: multiply/);
  assert.match(grade, /z-index: 4/);
  assert.match(page, /SkyDancerColorGradeV30/);
  assert.match(pagesEntry, /SkyDancerColorGradeV30/);
});
