import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  SKY_DANCER_STAGE_BASE_KILLS,
  skyDancerStageActiveEnemyTarget,
  skyDancerStageKillTarget,
} from "../src/sky/SkyDancerStageCycle";

test("V27 stage cycle raises the reinforcement quota gradually", () => {
  assert.equal(SKY_DANCER_STAGE_BASE_KILLS, 12);
  assert.equal(skyDancerStageKillTarget(1), 12);
  assert.equal(skyDancerStageKillTarget(2), 16);
  assert.equal(skyDancerStageKillTarget(5), 28);
  assert.equal(skyDancerStageKillTarget(99), 28);
  assert.equal(skyDancerStageActiveEnemyTarget(1), 6);
  assert.equal(skyDancerStageActiveEnemyTarget(3), 7);
  assert.equal(skyDancerStageActiveEnemyTarget(9), 10);
});

test("V27 owns reinforcement shutdown, cleanup, boss and next-stage flow", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerStageCycle.ts", import.meta.url), "utf8");
  assert.match(source, /setCartTurboHuntExternalProgressionEnabled\(true\)/);
  assert.match(source, /reinforcementsComplete/);
  assert.match(source, /REINFORCEMENTS ENDED · WIPE OUT REMAINING/);
  assert.match(source, /spawnBoss\(this, state\)/);
  assert.match(source, /STAGE \$\{state\.stage\} CLEAR/);
  assert.match(source, /startNextStage\(this, state\)/);
  assert.match(source, /session\.obstacles\.splice\(0\)/);
});

test("V27 removes airborne obstacle visuals and preloads a fog-hidden city ring", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV27.ts", import.meta.url), "utf8");
  assert.match(source, /CITY_TILE_RADIUS = 2/);
  assert.match(source, /sky-dancer-v25-landmark-city/);
  assert.match(source, /sky-dancer-v27-landmark-city-ring/);
  assert.match(source, /object\.frustumCulled = false/);
  assert.match(source, /group\.visible = false/);
});

test("V27 is the active Sky Dancer effects entry point", () => {
  const entry = readFileSync(new URL("../src/sky/SkyDancerAirCombatFx.ts", import.meta.url), "utf8");
  assert.match(entry, /SkyDancerAirCombatFxV27 as SkyDancerAirCombatFx/);
});
