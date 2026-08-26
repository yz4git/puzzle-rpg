import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  SKY_DANCER_V41_APPROACH_BUFFER,
  SKY_DANCER_V41_BREAKAWAY_DISTANCE,
  SKY_DANCER_V41_CLEANUP_CATCHUP_MARGIN,
  SKY_DANCER_V41_EMERGENCY_ACCELERATION,
  SKY_DANCER_V41_EMERGENCY_TURN_RATE,
  SKY_DANCER_V41_ESCAPE_SPEED_MARGIN,
  SKY_DANCER_V41_MAX_ACCELERATION,
  SKY_DANCER_V41_MAX_CLEANUP_INTERCEPT_SPEED,
  SKY_DANCER_V41_MAX_CLEANUP_SPEED,
  SKY_DANCER_V41_MAX_CRUISE_SPEED,
  SKY_DANCER_V41_MAX_ESCAPE_SPEED,
  SKY_DANCER_V41_MAX_TURN_RATE,
  SKY_DANCER_V41_MIN_PASS_DISTANCE,
  SKY_DANCER_V41_PREDICTIVE_DISTANCE,
  SKY_DANCER_V41_PREDICTIVE_LOOKAHEAD,
  SKY_DANCER_V41_PREDICTIVE_MISS_DISTANCE,
} from "../src/sky/SkyDancerFlightNaturalMotionV41";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");

test("V41 aircraft motion uses predictive separation and bounded kinematics", () => {
  assert.ok(SKY_DANCER_V41_MIN_PASS_DISTANCE >= 14);
  assert.ok(SKY_DANCER_V41_BREAKAWAY_DISTANCE > SKY_DANCER_V41_MIN_PASS_DISTANCE);
  assert.ok(SKY_DANCER_V41_APPROACH_BUFFER > SKY_DANCER_V41_BREAKAWAY_DISTANCE);
  assert.ok(SKY_DANCER_V41_PREDICTIVE_DISTANCE >= SKY_DANCER_V41_APPROACH_BUFFER);
  assert.ok(SKY_DANCER_V41_PREDICTIVE_MISS_DISTANCE >= SKY_DANCER_V41_MIN_PASS_DISTANCE);
  assert.ok(SKY_DANCER_V41_PREDICTIVE_LOOKAHEAD >= 3);
  assert.ok(SKY_DANCER_V41_MAX_CRUISE_SPEED <= 24);
  assert.ok(SKY_DANCER_V41_MAX_CLEANUP_SPEED <= 26);
  assert.ok(SKY_DANCER_V41_MAX_CLEANUP_INTERCEPT_SPEED > SKY_DANCER_V41_MAX_CLEANUP_SPEED);
  assert.ok(SKY_DANCER_V41_MAX_CLEANUP_INTERCEPT_SPEED <= 36);
  assert.ok(SKY_DANCER_V41_CLEANUP_CATCHUP_MARGIN >= 4 && SKY_DANCER_V41_CLEANUP_CATCHUP_MARGIN <= 6);
  assert.ok(SKY_DANCER_V41_MAX_ESCAPE_SPEED >= 36 && SKY_DANCER_V41_MAX_ESCAPE_SPEED <= 40);
  assert.ok(SKY_DANCER_V41_ESCAPE_SPEED_MARGIN >= 5 && SKY_DANCER_V41_ESCAPE_SPEED_MARGIN <= 8);
  assert.ok(SKY_DANCER_V41_MAX_ACCELERATION <= 18);
  assert.ok(SKY_DANCER_V41_EMERGENCY_ACCELERATION <= 28);
  assert.ok(SKY_DANCER_V41_MAX_TURN_RATE <= 1.12);
  assert.ok(SKY_DANCER_V41_EMERGENCY_TURN_RATE <= 1.65);
  const source = read("../src/sky/SkyDancerFlightNaturalMotionV41.ts");
  assert.match(source, /previous\.call\(this, input, fixedDelta\)/);
  assert.match(source, /cartTurboHuntWrappedDelta\(enemy\.x, before\.x/);
  assert.match(source, /predictedMissDistance/);
  assert.match(source, /closingRate > PREDICTIVE_MIN_CLOSING_RATE/);
  assert.match(source, /moveToward\(before\.speed, targetSpeed, acceleration \* delta\)/);
  assert.match(source, /playerSpeed \+ SKY_DANCER_V41_ESCAPE_SPEED_MARGIN/);
  assert.match(source, /enemy\.x = before\.x \+ Math\.sin\(nextHeading\) \* speed \* delta/);
  assert.match(source, /enemy\.z = before\.z \+ Math\.cos\(nextHeading\) \* speed \* delta/);
  assert.doesNotMatch(source, /72 \* delta/);
});

test("V41 leaves unreleased V40 cleanup holding slots under V40 ownership", () => {
  const source = read("../src/sky/SkyDancerFlightNaturalMotionV41.ts");
  assert.match(source, /SKY_DANCER_V40_CLEANUP_SLOT_DELAY/);
  assert.match(source, /state\.cleanupSlots\.set\(id, index \* SKY_DANCER_V40_CLEANUP_SLOT_DELAY\)/);
  assert.match(source, /const cleanupHeld = cleanupPhase/);
  assert.match(source, /if \(cleanupHeld\) \{/);
  assert.match(source, /before\.x = enemy\.x/);
  assert.match(source, /before\.speed = Math\.min\(before\.speed, SKY_DANCER_V41_MAX_CLEANUP_SPEED\)/);
});

test("V41 guides released cleanup survivors into the V40 lock slot without teleporting", () => {
  const source = read("../src/sky/SkyDancerFlightNaturalMotionV41.ts");
  assert.match(source, /skyDancerReengagementInterceptV40/);
  assert.match(source, /const cleanupNeedsIntercept = cleanupPhase/);
  assert.match(source, /distanceBefore > SKY_DANCER_V40_CLEANUP_TRIGGER/);
  assert.match(source, /lockAngle > SKY_DANCER_V40_CLEANUP_ANGLE_TRIGGER/);
  assert.match(source, /playerSpeed \+ SKY_DANCER_V41_CLEANUP_CATCHUP_MARGIN/);
  assert.match(source, /maxSpeed = SKY_DANCER_V41_MAX_CLEANUP_INTERCEPT_SPEED/);
  assert.match(source, /acceleration = SKY_DANCER_V41_EMERGENCY_ACCELERATION/);
  assert.match(source, /const nextHeading = rotateToward/);
});

test("V41 is installed outside V40 in WebGL and Canvas runtimes", () => {
  const webgl = read("../src/sky/SkyDancerAirCombatFx.ts");
  const canvas = read("../src/sky/SkyDancerCanvasPreviewV4.ts");
  assert.match(webgl, /installSkyDancerReengagementV40\(\);\n    installSkyDancerFlightNaturalMotionV41\(\);/);
  assert.match(canvas, /installSkyDancerReengagementV40\(\);\n    installSkyDancerFlightNaturalMotionV41\(\);/);
});

test("V41 replaces snapping V36 terrain with a persistent 5x5 world-space ring", () => {
  const terrain = read("../src/sky/presentation/SkyDancerTerrainContinuityV41.ts");
  const pipeline = read("../src/sky/presentation/SkyDancerPresentationPipeline.ts");
  assert.match(terrain, /const TILE_RADIUS = 2/);
  assert.match(terrain, /worldHeight\(worldX, worldZ\)/);
  assert.match(terrain, /sky-dancer-v36-faceted-terrain/);
  assert.match(terrain, /legacyTerrain\.visible = false/);
  assert.match(terrain, /sky-dancer-v41-continuous-terrain-/);
  assert.match(pipeline, /SkyDancerTerrainContinuityV41/);
  assert.match(pipeline, /this\.v40\.update\(snapshot\);\n    this\.v41Terrain\.update\(snapshot\);/);
});
