import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("V13 remains the cinematic base for the active quality pass", () => {
  const entry = readFileSync(new URL("../src/sky/SkyDancerAirCombatFx.ts", import.meta.url), "utf8");
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV13.ts", import.meta.url), "utf8");

  assert.match(entry, /SkyDancerAirCombatFxV14/);
  assert.match(source, /extends SkyDancerAirCombatFxV12/);
  assert.match(source, /new THREE\.Fog\(0xcfe1e5, 150, 520\)/);
  assert.match(source, /sky-dancer-q13-near-fields/);
  assert.match(source, /sky-dancer-q13-tree-belts/);
  assert.match(source, /sky-dancer-q13-near-settlements/);
});

test("V13 replaces rectangular Turbo columns with crossed tapered ribbons", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV13.ts", import.meta.url), "utf8");
  assert.match(source, /sky-dancer-q13-tapered-afterburner/);
  assert.match(source, /taperedRibbonGeometry/);
  assert.match(source, /tailHalfWidth/);
  assert.match(source, /object\.name === "sky-dancer-q9-turbo-plume"/);
  assert.match(source, /object\.name === "sky-dancer-q11-turbo-ribbon"/);
  assert.match(source, /object\.visible = false/);
});

test("V13 gives Shot a chase-camera-readable muzzle flash and missile halo", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV13.ts", import.meta.url), "utf8");
  assert.match(source, /sky-dancer-q13-shot-flash/);
  assert.match(source, /this\.shotFlashLife = 0\.32/);
  assert.match(source, /object\.scale\.setScalar\(2\.05\)/);
  assert.match(source, /sky-dancer-q13-missile-halo/);
  assert.match(source, /sky-dancer-q13-missile-flare/);
});

test("missile doctrine disables inherited ram charge and pushes fighters outward", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerCombatDoctrine.ts", import.meta.url), "utf8");
  const canvas = readFileSync(new URL("../src/sky/SkyDancerCanvasPreviewV4.ts", import.meta.url), "utf8");

  assert.match(source, /SKY_DANCER_TACTICAL_STANDOFF = 26/);
  assert.match(source, /enemy\.kind === "boss" \? 30 : enemy\.kind === "heavy" \? 28/);
  assert.match(source, /enemy\.chargeTime = 0/);
  assert.match(source, /enemy\.chargeCooldown = Math\.max\(enemy\.chargeCooldown, 4\.0\)/);
  assert.match(source, /const outwardSpeed = Math\.min\(24, 7\.5 \+ deficit \* 1\.55\)/);
  assert.match(source, /cart-threat-dodge-snapshot/);
  assert.match(source, /threatActive: false/);
  assert.match(canvas, /installSkyDancerCombatDoctrine/);
});
