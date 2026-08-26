import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("V30 applies the final reference polish after world presentation", () => {
  const fx = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV30.ts", import.meta.url), "utf8");
  const polish = readFileSync(new URL("../src/sky/SkyDancerReferencePolishV30.ts", import.meta.url), "utf8");
  assert.match(fx, /SkyDancerReferencePolishV30/);
  assert.match(fx, /worldPresentation\.update\(snapshot\);[\s\S]*referencePolish\.update\(\)/);
  assert.match(polish, /skyline\.position\.set\(-24, 0, 205\)/);
  assert.match(polish, /skyline\.scale\.setScalar\(1\.12\)/);
  assert.match(polish, /Fog\(0x4b9fc4, 700, 1650\)/);
  assert.match(polish, /DodecahedronGeometry/);
  assert.match(polish, /sky-dancer-v30-base-cloud-deck/);
  assert.match(polish, /sky-dancer-v28-layered-cloud-banks/);
  assert.match(polish, /sky-dancer-v29-reference-cloud-bank/);
  assert.match(polish, /toneMapped = false/);
});
