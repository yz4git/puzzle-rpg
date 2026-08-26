import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("V12 remains the terrain/readability base under the active pass", () => {
  const entry = readFileSync(new URL("../src/sky/SkyDancerAirCombatFx.ts", import.meta.url), "utf8");
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV12.ts", import.meta.url), "utf8");

  assert.match(entry, /SkyDancerAirCombatFxV12/);
  assert.match(source, /extends SkyDancerAirCombatFxV11/);
  assert.match(source, /sky-dancer-q12-regional-mosaic/);
  assert.match(source, /sky-dancer-q12-river-system/);
  assert.match(source, /sky-dancer-q12-crop-rows/);
  assert.match(source, /sky-dancer-q12-missile-bloom/);
  assert.match(source, /sky-dancer-q12-missile-streak/);
  assert.match(source, /object\.scale\.setScalar\(1\.62\)/);
  assert.match(source, /object\.material\.color\.setHex\(0x36b9df\)/);
});

test("long-range standoff remains underneath the final missile doctrine", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerLongRangeStandoff.ts", import.meta.url), "utf8");
  const canvas = readFileSync(new URL("../src/sky/SkyDancerCanvasPreviewV4.ts", import.meta.url), "utf8");

  assert.match(source, /SKY_DANCER_COMBAT_STANDOFF = 23/);
  assert.match(source, /enemy\.kind === "boss" \? 27 : enemy\.kind === "heavy" \? 25/);
  assert.match(source, /const outwardSpeed = Math\.min\(16, 3 \+ deficit \* 1\.15\)/);
  assert.match(source, /enemy\.x \+= dx \/ distance \* outwardSpeed \* delta/);
  assert.match(source, /enemy\.z \+= dz \/ distance \* outwardSpeed \* delta/);
  assert.match(canvas, /installSkyDancerCombatDoctrine/);
});

test("V12 keeps Turbo plume broad while suppressing the white rod core", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV12.ts", import.meta.url), "utf8");
  assert.match(source, /object\.name === "sky-dancer-q9-turbo-core"/);
  assert.match(source, /object\.material\.opacity \*= 0\.28/);
  assert.match(source, /object\.name === "sky-dancer-q9-turbo-plume"/);
  assert.match(source, /object\.material\.opacity \*= 0\.46/);
  assert.match(source, /object\.name === "sky-dancer-q11-turbo-ribbon"/);
  assert.match(source, /THREE\.NormalBlending/);
});
