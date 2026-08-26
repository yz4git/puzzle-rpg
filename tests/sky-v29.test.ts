import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  SKY_DANCER_V29_ALTITUDE_LIFT_METERS,
  SKY_DANCER_V29_ALTITUDE_METERS,
  SKY_DANCER_V29_BOSS_HP_MULTIPLIER,
  SKY_DANCER_V29_BOSS_SPEED_MULTIPLIER,
} from "../src/sky/SkyDancerV29Tuning";

test("V29 raises the flight level to 300 m", () => {
  assert.equal(SKY_DANCER_V29_ALTITUDE_METERS, 300);
  assert.equal(SKY_DANCER_V29_ALTITUDE_LIFT_METERS, 100);
});

test("V29 applies the requested second boss reductions and speed increase", () => {
  assert.equal(SKY_DANCER_V29_BOSS_HP_MULTIPLIER, 0.1);
  assert.equal(SKY_DANCER_V29_BOSS_SPEED_MULTIPLIER, 1.5);
  const source = readFileSync(new URL("../src/sky/SkyDancerV29Tuning.ts", import.meta.url), "utf8");
  assert.match(source, /boss\.x = before\.x \+ dx \* SKY_DANCER_V29_BOSS_SPEED_MULTIPLIER/);
  assert.match(source, /currentMaxHp \* SKY_DANCER_V29_BOSS_HP_MULTIPLIER/);
  assert.match(source, /!state\.bossWasAlive/);
  assert.match(source, /MAX_CONTINUOUS_STEP_DISTANCE_SQ/);
});

test("V29 steering recovery reclaims stale iPhone pointers", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerSteeringRecovery.ts", import.meta.url), "utf8");
  assert.match(source, /\[aria-label="Steering"\]/);
  assert.match(source, /pointercancel/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /activePointerId = event\.pointerId/);
  assert.match(source, /runtime\.steer = clamp/);
  assert.match(source, /__skyDancerV29SteeringCleanup/);
});

test("V29 visual pass keeps V28 scenery and adds skyline depth", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV29.ts", import.meta.url), "utf8");
  assert.match(source, /sky-dancer-v28-reference-scenery/);
  assert.match(source, /TOTAL_ALTITUDE_SHIFT_UNITS/);
  assert.match(source, /sky-dancer-v29-reference-skyline/);
  assert.match(source, /sky-dancer-v29-reference-cloud-bank/);
  assert.match(source, /sky-dancer-v29-river-highlights/);
  assert.match(source, /toneMappingExposure = 1\.12/);
});

test("V29 is the active Sky Dancer effects entry point", () => {
  const entry = readFileSync(new URL("../src/sky/SkyDancerAirCombatFx.ts", import.meta.url), "utf8");
  assert.match(entry, /SkyDancerAirCombatFxV29 as SkyDancerAirCombatFx/);
});
