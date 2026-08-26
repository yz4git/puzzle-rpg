import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("V20 is active and keeps the chase camera untouched", () => {
  const entry = readFileSync(new URL("../src/sky/SkyDancerAirCombatFx.ts", import.meta.url), "utf8");
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV20.ts", import.meta.url), "utf8");
  assert.match(entry, /SkyDancerAirCombatFxV20/);
  assert.match(source, /does not touch the chase camera/);
  assert.doesNotMatch(source, /camera\.position\.set/);
  assert.doesNotMatch(source, /camera\.fov\s*=/);
});

test("V20 enforces Turbo after inherited simulation", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV20.ts", import.meta.url), "utf8");
  assert.match(source, /TURBO_MIN_SPEED = 18/);
  assert.match(source, /TURBO_ACCEL = 8\.5/);
  assert.match(source, /TURBO_SPEED_CAP = 26\.5/);
  assert.match(source, /this\.enforceTurboAfterSimulation\(snapshot, delta\)/);
  assert.match(source, /car\.forwardVelocity = sign \* this\.turboFloor/);
  assert.match(source, /car\.velocity\.x =/);
  assert.match(source, /car\.velocity\.z =/);
});

test("V20 renders large alternating wing-launch missile visuals", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV20.ts", import.meta.url), "utf8");
  assert.match(source, /sky-dancer-v20-visible-player-shots/);
  assert.match(source, /sky-dancer-v20-player-shot-/);
  assert.match(source, /new THREE\.BoxGeometry\(0\.13, 0\.13, 7\.4\)/);
  assert.match(source, /launchSide = missile\.id % 2 === 0 \? -1 : 1/);
  assert.match(source, /lateralOffset = launchSide \* 1\.05 \* wingBlend/);
  assert.match(source, /getSkyDancerPlayerWeaponState/);
});
