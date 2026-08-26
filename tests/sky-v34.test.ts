import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  SKY_DANCER_V34_BOSS_BASE_HP,
  SKY_DANCER_V34_BOSS_MAX_HP,
  SKY_DANCER_V34_BOSS_MISSILE_DAMAGE_CAP,
  skyDancerBossCoreOpenV34,
  skyDancerBossDurabilityV34,
  skyDancerBossModeV34,
  skyDancerBossPhaseV34,
} from "../src/sky/SkyDancerBossCombatV34";

test("V34 replaces one-shot boss durability with a short multi-pass fight", () => {
  assert.equal(SKY_DANCER_V34_BOSS_BASE_HP, 192);
  assert.equal(skyDancerBossDurabilityV34(1), 192);
  assert.equal(skyDancerBossDurabilityV34(2), 216);
  assert.equal(skyDancerBossDurabilityV34(99), SKY_DANCER_V34_BOSS_MAX_HP);
  assert.ok(SKY_DANCER_V34_BOSS_MISSILE_DAMAGE_CAP < 0.105);
});

test("V34 boss has three HP phases and readable orbit strike break cadence", () => {
  assert.equal(skyDancerBossPhaseV34({ hp: 100, maxHp: 100 }), 1);
  assert.equal(skyDancerBossPhaseV34({ hp: 60, maxHp: 100 }), 2);
  assert.equal(skyDancerBossPhaseV34({ hp: 30, maxHp: 100 }), 3);
  assert.equal(skyDancerBossModeV34(1, 1), "orbit");
  assert.equal(skyDancerBossModeV34(1, 4.2), "strike");
  assert.equal(skyDancerBossModeV34(1, 5.6), "break");
  assert.equal(skyDancerBossCoreOpenV34(1, 5.6), true);
  assert.equal(skyDancerBossCoreOpenV34(2, 3.2), false);
});

test("V34 boss director owns final motion, durability, airspace routing and webdriver audit control", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerBossCombatV34.ts", import.meta.url), "utf8");
  const guard = readFileSync(new URL("../src/sky/SkyDancerBossDurabilityGuardV34.ts", import.meta.url), "utf8");
  const entry = readFileSync(new URL("../src/sky/SkyDancerAirCombatFx.ts", import.meta.url), "utf8");
  const canvas = readFileSync(new URL("../src/sky/SkyDancerCanvasPreviewV4.ts", import.meta.url), "utf8");
  assert.match(entry, /installSkyDancerBossDurabilityGuardV34\(\);\n    installSkyDancerBossCombatV34\(\)/);
  assert.match(canvas, /installSkyDancerBossDurabilityGuardV34\(\);\n    installSkyDancerBossCombatV34\(\)/);
  assert.match(guard, /targetMaxHp = skyDancerBossDurabilityV34/);
  assert.match(guard, /V28\/V29 each own a historical one-time 1\/10 spawn reduction/);
  assert.match(source, /routeEnemiesToCurrentAirspace/);
  assert.match(source, /enemy\.nodeId = nodeId/);
  assert.match(source, /updateBossFlight/);
  assert.match(source, /weakPointExposed = skyDancerBossCoreOpenV34/);
  assert.match(source, /__skyDancerForceBossAuditV34/);
  assert.match(source, /navigator\.webdriver/);
});

test("V34 is an ordered presentation pass after the V32 reference owner", () => {
  const pipeline = readFileSync(new URL("../src/sky/presentation/SkyDancerPresentationPipeline.ts", import.meta.url), "utf8");
  const quality = readFileSync(new URL("../src/sky/presentation/SkyDancerV34QualityPass.ts", import.meta.url), "utf8");
  assert.match(pipeline, /SkyDancerV34QualityPass/);
  assert.match(pipeline, /this\.v32\.update\(snapshot\);\n    this\.v34\.update\(snapshot\);/);
  assert.match(quality, /sky-dancer-v34-sky-gradient/);
  assert.match(quality, /sky-dancer-v34-irregular-terrain-masses/);
  assert.match(quality, /sky-dancer-v31-patchwork-fields/);
  assert.match(quality, /fields\.visible = false/);
  assert.match(quality, /scale\.y \*= 1\.36/);
  assert.match(quality, /tuneRidgeSilhouettes/);
  assert.match(quality, /scale\.y \*= 1\.72/);
  assert.match(quality, /sky-dancer-v32-polish-city-high/);
  assert.match(quality, /sky-dancer-v18-missile-warning/);
  assert.match(quality, /warning\.scale\.multiplyScalar\(0\.42\)/);
  assert.match(quality, /sky-dancer-v34-boss-core/);
});

test("V34 HUD exposes boss phase/core state and moves missile warning out of the objective lane", () => {
  const hud = readFileSync(new URL("../app/SkyDancerHudV34.tsx", import.meta.url), "utf8");
  const game = readFileSync(new URL("../app/CartRogueGamePhase13.tsx", import.meta.url), "utf8");
  assert.match(hud, /aria-label="Missile warning"/);
  assert.match(hud, /left: max\(18px, env\(safe-area-inset-left\)\)/);
  assert.match(hud, /max-width: min\(34vw, 290px\)/);
  assert.match(hud, /Boss phase status/);
  assert.match(hud, /CORE OPEN/);
  assert.match(game, /<SkyDancerHudV34 \/>/);
});
