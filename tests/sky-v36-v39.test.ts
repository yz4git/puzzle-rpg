import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");

test("V36 through V38 run after the V35 reference owner in explicit order", () => {
  const pipeline = read("../src/sky/presentation/SkyDancerPresentationPipeline.ts");
  assert.match(pipeline, /SkyDancerV36WorldGeometryPass/);
  assert.match(pipeline, /SkyDancerV37AircraftCombatPass/);
  assert.match(pipeline, /SkyDancerV38AtmospherePass/);
  assert.match(pipeline, /this\.v35\.update\(snapshot\);\n    this\.v36\.update\(snapshot\);\n    this\.v37\.update\(snapshot\);\n    this\.v38\.update\(snapshot\);/);
});

test("V36 replaces box city and board-flat foreground with render-only faceted geometry", () => {
  const source = read("../src/sky/presentation/SkyDancerV36WorldGeometryPass.ts");
  assert.match(source, /ARCHETYPE_COUNT = 6/);
  assert.match(source, /stackedGeometry/);
  assert.match(source, /appendPyramid/);
  assert.match(source, /appendPyramid\(\s*positions,\s*normals,/);
  assert.match(source, /sky-dancer-v36-faceted-terrain/);
  assert.match(source, /sky-dancer-v36-city-archetype-/);
  assert.match(source, /sky-dancer-v35-focus-buildings/);
  assert.match(source, /legacyBuildings\.visible = false/);
  assert.match(source, /legacyFields\.visible = false/);
  assert.match(source, /GROUND_Y \+ this\.terrainHeight/);
  assert.doesNotMatch(source, /SKY_DANCER_V29_ALTITUDE_METERS\s*=/);
});

test("V37 upgrades player enemy missile and Turbo presentation without combat rules", () => {
  const source = read("../src/sky/presentation/SkyDancerV37AircraftCombatPass.ts");
  assert.match(source, /sky-dancer-v37-player-surface-kit/);
  assert.match(source, /sky-dancer-v37-turbo-speed-lines/);
  assert.match(source, /sky-dancer-v37-missile-long-plume/);
  assert.match(source, /decorateEnemies/);
  assert.match(source, /snapshot\.boostActive/);
  assert.match(source, /attachBankedPlayerPresentation/);
  assert.match(source, /runtime\.playerVisual/);
  assert.doesNotMatch(source, /const flightRoot = this\.runtime\.session\.car\.group/);
  assert.doesNotMatch(source, /damage\s*=|hp\s*=|bossHp\s*=/);
});

test("V38 owns four-band sky continuous ridges and clustered below-flight clouds", () => {
  const source = read("../src/sky/presentation/SkyDancerV38AtmospherePass.ts");
  assert.match(source, /sky-dancer-v38-four-band-sky/);
  assert.match(source, /makeRidge/);
  assert.match(source, /sky-dancer-v38-ridge-far/);
  assert.match(source, /sky-dancer-v38-ridge-near/);
  assert.match(source, /CLOUD_CLUSTERS = 24/);
  assert.match(source, /PUFFS_PER_CLUSTER = 4/);
  assert.match(source, /sky-dancer-v38-cloud-cluster-main/);
  assert.match(source, /baseY = -50/);
  assert.match(source, /this\.farRidge\.visible = true/);
  assert.match(source, /this\.cloudMain\.visible = true/);
  assert.match(source, /this\.cloudShade\.visible = true/);
  assert.match(source, /fog\.near = 540/);
  assert.match(source, /fog\.far = 1840/);
});

test("V39 is the final HUD layer and does not fabricate score radar or inventory", () => {
  const hud = read("../app/SkyDancerHudV39.tsx");
  const game = read("../app/CartRogueGamePhase13.tsx");
  assert.match(game, /<SkyDancerHudV35 \/>\n        <SkyDancerHudV39 \/>/);
  assert.match(hud, /skyDancerV39HudFrame/);
  assert.match(hud, /aria-label="Missile warning"/);
  assert.match(hud, /skyDancerBossV34/);
  assert.match(hud, /existing real telemetry only/i);
  assert.doesNotMatch(hud, /1,250|x2\.4|VX-23|RADAR|AMMO 24/);
});

test("V39 webdriver gate validates the new scene owners instead of the superseded V35 box city", () => {
  const bridge = read("../src/sky/presentation/SkyDancerV39VisualAuditBridge.ts");
  const audit = read("../scripts/webgl-v39-reference-audit.mjs");
  assert.match(bridge, /v36CityCount/);
  assert.match(bridge, /v35CityVisible/);
  assert.match(bridge, /v38CloudCount/);
  assert.match(audit, /v36CityCount\) < 800/);
  assert.match(audit, /Superseded V35 box city/);
  assert.match(audit, /V39 HUD frame is not visible/);
});
