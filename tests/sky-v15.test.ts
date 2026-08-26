import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("V15 is active and lowers the visual flight level", () => {
  const entry = readFileSync(new URL("../src/sky/SkyDancerAirCombatFx.ts", import.meta.url), "utf8");
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV15.ts", import.meta.url), "utf8");
  assert.match(entry, /SkyDancerAirCombatFxV15/);
  assert.match(source, /extends SkyDancerAirCombatFxV14/);
  assert.match(source, /WORLD_LIFT = 8\.5/);
  assert.match(source, /skyDancerAltitudeMeters = 78/);
  assert.match(source, /raiseExistingLandscape/);
});

test("V15 places chase-camera-readable architecture and infrastructure", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV15.ts", import.meta.url), "utf8");
  assert.match(source, /sky-dancer-q15-close-cityscape/);
  assert.match(source, /sky-dancer-q15-close-roofs/);
  assert.match(source, /sky-dancer-q15-ground-infrastructure/);
  assert.match(source, /const h = 7\.5/);
  assert.match(source, /const h = 15/);
});

test("V15 replaces normal cone/ribbon exhaust with shock cells", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV15.ts", import.meta.url), "utf8");
  assert.match(source, /sky-dancer-q15-engine-shock-plume/);
  assert.match(source, /sky-dancer-q15-nozzle-glow/);
  assert.match(source, /sky-dancer-q15-engine-shock-cell/);
  assert.match(source, /sky-dancer-q15-heat-ring/);
  assert.match(source, /sky-dancer-q14-engine-ribbon/);
  assert.match(source, /object\.visible = false/);
});
