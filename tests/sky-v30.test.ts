import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("V30 owns final world composition in a dedicated controller", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerWorldPresentationV30.ts", import.meta.url), "utf8");
  assert.match(source, /sky-dancer-v30-world-presentation/);
  assert.match(source, /sky-dancer-v30-ground-foundation/);
  assert.match(source, /transparent: false/);
  assert.match(source, /depthWrite: true/);
  assert.match(source, /FOUNDATION_CHUNKS = 12/);
  assert.match(source, /sky-dancer-v27-landmark-city-ring/);
  assert.match(source, /sky-dancer-v28-mountain-depth/);
});

test("V30 removes inherited field conflicts and connects dedicated opaque valley detail", () => {
  const world = readFileSync(new URL("../src/sky/SkyDancerWorldPresentationV30.ts", import.meta.url), "utf8");
  const ground = readFileSync(new URL("../src/sky/SkyDancerGroundDetailV30.ts", import.meta.url), "utf8");
  const pass = readFileSync(new URL("../src/sky/presentation/SkyDancerV30PresentationPass.ts", import.meta.url), "utf8");
  assert.match(world, /sky-dancer-v25-valley-fields/);
  assert.match(world, /sky-dancer-v28-patchwork-valley/);
  assert.match(world, /foundationDepthWrite/);
  assert.match(world, /__skyDancerGetWorldPresentationDebug/);
  assert.match(ground, /sky-dancer-v30-patchwork-fields/);
  assert.match(ground, /sky-dancer-v30-river/);
  assert.match(ground, /transparent: false/);
  assert.match(ground, /depthWrite: true/);
  assert.match(ground, /fog: false/);
  assert.match(pass, /SkyDancerGroundDetailV30/);
  assert.match(pass, /groundDetail\.update\(snapshot\)/);
});

test("V30 suppresses accumulated low-altitude city and road worlds", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerLegacySceneryCleanupV30.ts", import.meta.url), "utf8");
  assert.match(source, /sky-dancer-q15-/);
  assert.match(source, /sky-dancer-q16-/);
  assert.match(source, /sky-dancer-v19-midpoint-world/);
  assert.match(source, /sky-dancer-v25-landmark-city/);
  assert.match(source, /scene\.getObjectByName/);
});

test("V30 replaces the oversized legacy mountain silhouettes with a lighter belt", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerWorldPresentationV30.ts", import.meta.url), "utf8");
  assert.match(source, /sky-dancer-v30-mountain-belt/);
  assert.match(source, /const count = 96/);
  assert.match(source, /radius = 420/);
  assert.match(source, /sky-dancer-v24-horizon-silhouettes/);
});

test("V30 final grade opens the valley and places one city in the right-front distance", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerWorldPresentationV30.ts", import.meta.url), "utf8");
  assert.match(source, /skyline\.position\.set\(0, 0, 260\)/);
  assert.match(source, /skyline\.scale\.setScalar\(0\.82\)/);
  assert.match(source, /Fog\(0x77b9d4, 560, 1460\)/);
  assert.match(source, /scene\.background = new THREE\.Color\(0x1676b7\)/);
  assert.match(source, /sky-dancer-v28-layered-cloud-banks/);
  assert.match(source, /sky-dancer-v29-reference-cloud-bank/);
});

test("V30 consolidates inherited Cart HUD into the flight reference hierarchy in both runtimes", () => {
  const hud = readFileSync(new URL("../app/SkyDancerHudV30.tsx", import.meta.url), "utf8");
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const pagesEntry = readFileSync(new URL("../pages-entry.tsx", import.meta.url), "utf8");
  assert.match(hud, /data-sd-gas-card/);
  assert.match(hud, /data-sd-item-strip/);
  assert.match(hud, /data-sd-hunt-objective/);
  assert.match(hud, /data-sd-hunt-heat/);
  assert.match(hud, /content: "HP"/);
  assert.match(hud, /HOLD · RELEASE/);
  assert.match(page, /SkyDancerHudV30/);
  assert.match(page, /<SkyDancerHudV30 \/>/);
  assert.match(pagesEntry, /SkyDancerHudV30/);
  assert.match(pagesEntry, /<SkyDancerHudV30 \/>/);
});

test("V30 remains a compatibility wrapper over the extracted presentation pass", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV30.ts", import.meta.url), "utf8");
  assert.match(source, /extends SkyDancerAirCombatFxV29/);
  assert.match(source, /SkyDancerV30PresentationPass/);
  assert.match(source, /presentationPass\.update\(snapshot\)/);
});
