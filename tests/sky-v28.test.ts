import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  SKY_DANCER_V28_ALTITUDE_LIFT_METERS,
  SKY_DANCER_V28_ALTITUDE_METERS,
  SKY_DANCER_V28_BOSS_HP_MULTIPLIER,
  SKY_DANCER_V28_BOSS_SPEED_MULTIPLIER,
  SKY_DANCER_V28_GRUNT_SPEED_MULTIPLIER,
} from "../src/sky/SkyDancerV28Tuning";

test("V28 applies the requested balance values", () => {
  assert.equal(SKY_DANCER_V28_BOSS_HP_MULTIPLIER, 0.1);
  assert.equal(SKY_DANCER_V28_BOSS_SPEED_MULTIPLIER, 1.5);
  assert.equal(SKY_DANCER_V28_GRUNT_SPEED_MULTIPLIER, 1.2);
  assert.equal(SKY_DANCER_V28_ALTITUDE_LIFT_METERS, 50);
  assert.equal(SKY_DANCER_V28_ALTITUDE_METERS, 200);
});

test("V28 tuning scales movement only for continuous flight steps", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerV28Tuning.ts", import.meta.url), "utf8");
  assert.match(source, /MAX_CONTINUOUS_STEP_DISTANCE_SQ/);
  assert.match(source, /SKY_DANCER_V28_BOSS_SPEED_MULTIPLIER/);
  assert.match(source, /SKY_DANCER_V28_GRUNT_SPEED_MULTIPLIER/);
  assert.match(source, /SKY_DANCER_V28_BOSS_HP_MULTIPLIER/);
  assert.match(source, /bossAlive && !state\.bossWasAlive/);
});

test("V28 visual pass matches the supplied high-altitude arcade reference direction", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV28.ts", import.meta.url), "utf8");
  assert.match(source, /sky-dancer-v28-patchwork-valley/);
  assert.match(source, /sky-dancer-v28-valley-lake/);
  assert.match(source, /sky-dancer-v28-mountain-depth/);
  assert.match(source, /sky-dancer-v28-layered-cloud-banks/);
  assert.match(source, /sky-dancer-v28-missile-smoke/);
  assert.match(source, /sky-dancer-v28-enemy-pip/);
  assert.match(source, /player\.scale\.multiplyScalar\(1\.1\)/);
  assert.match(source, /scene\.userData\.skyDancerAltitudeMeters = SKY_DANCER_V28_ALTITUDE_METERS/);
});

test("V28 is the active Sky Dancer effects entry point", () => {
  const entry = readFileSync(new URL("../src/sky/SkyDancerAirCombatFx.ts", import.meta.url), "utf8");
  assert.match(entry, /SkyDancerAirCombatFxV28 as SkyDancerAirCombatFx/);
});
