import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("V14 is the active visual quality pass", () => {
  const entry = readFileSync(new URL("../src/sky/SkyDancerAirCombatFx.ts", import.meta.url), "utf8");
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV14.ts", import.meta.url), "utf8");
  assert.match(entry, /SkyDancerAirCombatFxV14/);
  assert.match(source, /extends SkyDancerAirCombatFxV13/);
  assert.match(source, /sky-dancer-q14-visible-city-belts/);
  assert.match(source, /sky-dancer-q14-visible-roofs/);
  assert.match(source, /sky-dancer-q14-landmarks/);
  assert.match(source, /sky-dancer-q14-tree-masses/);
  assert.match(source, /sky-dancer-q14-distant-ridges/);
});

test("normal exhaust no longer uses the old cone meshes", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV14.ts", import.meta.url), "utf8");
  assert.match(source, /sky-dancer-q14-engine-exhaust/);
  assert.match(source, /sky-dancer-q14-engine-ribbon/);
  assert.match(source, /sky-dancer-q14-engine-diamond/);
  assert.match(source, /object\.name === "sky-dancer-jet-flame-v2"/);
  assert.match(source, /object\.name === "sky-dancer-jet-core-v2"/);
  assert.match(source, /object\.visible = false/);
});

test("Shot launches synchronously and touch capture cannot block firing", () => {
  const weapons = readFileSync(new URL("../src/sky/SkyDancerPlayerWeapons.ts", import.meta.url), "utf8");
  const control = readFileSync(new URL("../app/SkyDancerShotControl.tsx", import.meta.url), "utf8");
  const audit = readFileSync(new URL("../scripts/webgl-visual-audit.mjs", import.meta.url), "utf8");
  assert.match(weapons, /state\.requestedShots = 1/);
  assert.match(weapons, /return launchRequestedShot\(view, state\)/);
  assert.match(control, /fireWithRuntimeRetry\(\);/);
  assert.match(control, /setPointerCapture/);
  assert.match(control, /catch \{/);
  assert.match(audit, /page\.touchscreen\.tap/);
  assert.match(audit, /weaponAfter\.shotSerial <= weaponBefore\.shotSerial/);
});

test("Sky Dancer enemy population is reduced by roughly half and keeps bosses", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerEnemyPopulation.ts", import.meta.url), "utf8");
  const canvas = readFileSync(new URL("../src/sky/SkyDancerCanvasPreviewV4.ts", import.meta.url), "utf8");
  assert.match(source, /Math\.ceil\(regular\.length \* 0\.5\)/);
  assert.match(source, /enemy\.kind === "boss"/);
  assert.match(source, /session\.enemies\.splice/);
  assert.match(source, /reduceNewSpawns/);
  assert.match(canvas, /installSkyDancerEnemyPopulation/);
});
