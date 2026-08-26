import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isSkyDancerCombatTargetableV42,
  setSkyDancerCleanupHeldV42,
} from "../src/sky/SkyDancerCombatEligibilityV42";
import {
  SKY_DANCER_V40_CLEANUP_HOLD_DISTANCE,
  SKY_DANCER_V40_CLEANUP_SLOT_DELAY,
  SKY_DANCER_V40_LOCK_HALF_ANGLE,
  SKY_DANCER_V40_LOCK_RANGE,
  SKY_DANCER_V42_CLEANUP_HOLD_FOLLOW_SPEED,
  SKY_DANCER_V42_CLEANUP_RELEASE_MAX_DISTANCE,
  skyDancerCleanupReleasePositionV42,
  skyDancerCleanupSlotOrderV42,
} from "../src/sky/SkyDancerReengagementV40";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");

test("V42 player surface kit shares the banked player visual root", () => {
  const source = read("../src/sky/presentation/SkyDancerV37AircraftCombatPass.ts");
  assert.match(source, /attachBankedPlayerPresentation/);
  assert.match(source, /const bankedVisualRoot = this\.runtime\.playerVisual/);
  assert.match(source, /bankedVisualRoot\.add\(this\.playerKit\)/);
  assert.match(source, /bankedVisualRoot\.add\(this\.speedLines\)/);
  assert.doesNotMatch(source, /const flightRoot = this\.runtime\.session\.car\.group/);
  assert.match(source, /__skyDancerGetV42AircraftAttachment/);
});

test("V42 cleanup holding aircraft do not rotate with live player yaw", () => {
  const source = read("../src/sky/SkyDancerReengagementV40.ts");
  assert.ok(SKY_DANCER_V42_CLEANUP_HOLD_FOLLOW_SPEED >= 36);
  assert.ok(SKY_DANCER_V42_CLEANUP_HOLD_FOLLOW_SPEED <= 40);
  assert.match(source, /cleanupHoldOffsets: new Map/);
  assert.match(source, /cleanupHoldOffsets\.set\(enemy\.id, \{ x: hold\.x - px, z: hold\.z - pz \}\)/);
  assert.match(source, /const holdX = px \+ offset\.x/);
  assert.match(source, /const holdZ = pz \+ offset\.z/);
  assert.match(source, /const tangentHeading = normalizeAngle\(radial \+ side \* Math\.PI \* 0\.5\)/);
  assert.match(source, /SKY_DANCER_V42_CLEANUP_HOLD_FOLLOW_SPEED \* delta/);
  assert.ok(SKY_DANCER_V40_LOCK_HALF_ANGLE < 1.0);
});

test("V42 cleanup releases the nearest survivor first and keeps live slots inside the radial lock envelope", () => {
  const survivors = [
    { id: "enemy-far", x: 63, z: 0 },
    { id: "enemy-near", x: 46, z: 0 },
    { id: "enemy-mid", x: 54, z: 0 },
  ] as unknown as Parameters<typeof skyDancerCleanupSlotOrderV42>[0];
  const ordered = skyDancerCleanupSlotOrderV42(survivors, 0, 0);
  assert.deepEqual(ordered.map((enemy) => enemy.id), ["enemy-near", "enemy-mid", "enemy-far"]);

  const alreadyReachable = skyDancerCleanupReleasePositionV42(0, 0, 46, 0);
  assert.deepEqual(alreadyReachable, { x: 46, z: 0 });
  const pulled = skyDancerCleanupReleasePositionV42(0, 0, 64, 0);
  assert.ok(Math.hypot(pulled.x, pulled.z) <= SKY_DANCER_V42_CLEANUP_RELEASE_MAX_DISTANCE + 0.001);
  assert.ok(SKY_DANCER_V42_CLEANUP_RELEASE_MAX_DISTANCE < SKY_DANCER_V40_LOCK_RANGE);

  const source = read("../src/sky/SkyDancerReengagementV40.ts");
  assert.match(source, /const initialSurvivors = skyDancerCleanupSlotOrderV42\(liveNonBossEnemies\(this, nodeId\), px, pz\)/);
  assert.match(source, /const release = skyDancerCleanupReleasePositionV42\(px, pz, enemy\.x, enemy\.z\)/);
  assert.match(source, /if \(cleanup && cleanupSlotReady\)/);
  assert.match(source, /const leashed = skyDancerCleanupReleasePositionV42\(px, pz, enemy\.x, enemy\.z\)/);
  assert.match(source, /preserves the aircraft's world/);
});

test("V42 unreleased cleanup slots are visible formation aircraft but not missile targets or lock-envelope samples", () => {
  const enemy = { id: "held-cleanup-aircraft" } as unknown as Parameters<typeof setSkyDancerCleanupHeldV42>[0];
  assert.equal(isSkyDancerCombatTargetableV42(enemy), true);
  setSkyDancerCleanupHeldV42(enemy, true);
  assert.equal(isSkyDancerCombatTargetableV42(enemy), false);
  setSkyDancerCleanupHeldV42(enemy, false);
  assert.equal(isSkyDancerCombatTargetableV42(enemy), true);

  const reengagement = read("../src/sky/SkyDancerReengagementV40.ts");
  const weapons = read("../src/sky/SkyDancerPlayerWeapons.ts");
  assert.match(reengagement, /setSkyDancerCleanupHeldV42\(enemy, index > 0\)/);
  assert.match(reengagement, /setSkyDancerCleanupHeldV42\(enemy, cleanup && !cleanupSlotReady\)/);
  assert.match(reengagement, /exclude them from lock-envelope diagnostics/);
  const heldBlock = reengagement.match(/if \(cleanup && !cleanupSlotReady\) \{([\s\S]*?)continue;\n        \}/)?.[1];
  assert.ok(heldBlock);
  assert.doesNotMatch(heldBlock, /maxEnemyDistance/);
  assert.doesNotMatch(heldBlock, /maxLockAngle/);
  assert.match(weapons, /enemy\.alive && enemy\.nodeId === nodeId && isSkyDancerCombatTargetableV42\(enemy\)/);
  assert.match(weapons, /Held CLEANUP aircraft are deliberately omitted/);
});

test("V42 cleanup cadence cannot collapse below the target window and keeps radial headroom", () => {
  const lastFiveSurvivorRelease = SKY_DANCER_V40_CLEANUP_SLOT_DELAY * 4;
  assert.ok(lastFiveSurvivorRelease >= 20);
  assert.ok(lastFiveSurvivorRelease <= 22);
  assert.ok(SKY_DANCER_V40_CLEANUP_HOLD_DISTANCE <= 40);
  assert.ok(SKY_DANCER_V40_LOCK_RANGE - (SKY_DANCER_V40_CLEANUP_HOLD_DISTANCE + 2) >= 16);
});

test("V42 normal wave flight never uses angle-only screen-edge correction", () => {
  const source = read("../src/sky/SkyDancerReengagementV40.ts");
  assert.match(source, /const needsDistanceCorrection = distance > trigger/);
  assert.match(source, /const needsAngleCorrection = cleanup\s*\? lockAngle > angleTrigger\s*:\s*needsDistanceCorrection && lockAngle > angleTrigger/);
  assert.match(source, /Inside the range envelope, V41 owns natural turn\/acceleration/);
});

test("V42 ground scenery stays world anchored instead of snapping every 420m", () => {
  const v36 = read("../src/sky/presentation/SkyDancerV36WorldGeometryPass.ts");
  const v40 = read("../src/sky/presentation/SkyDancerV40CityExpansionPass.ts");
  const v42 = read("../src/sky/presentation/SkyDancerV42ContinuityPass.ts");
  const pipeline = read("../src/sky/presentation/SkyDancerPresentationPipeline.ts");
  for (const source of [v36, v40]) {
    assert.match(source, /skyDancerV42StableGroundAnchor/);
    assert.match(source, /if \(this\.anchored\) return/);
  }
  assert.match(v36, /__skyDancerGetV36WorldDebug/);
  assert.match(v40, /rootPosition:/);
  assert.doesNotMatch(v36, /if \(tileX === this\.tileX && tileZ === this\.tileZ\) return/);
  assert.doesNotMatch(v40, /if \(tileX === this\.tileX && tileZ === this\.tileZ\) return/);
  assert.match(v42, /sky-dancer-v42-stable-river-root/);
  assert.match(v42, /sky-dancer-v35-focus-streets/);
  assert.match(v42, /sky-dancer-v35-focus-river/);
  assert.match(v42, /sky-dancer-v31-forest-belts/);
  assert.match(v42, /ridgeRoot\.position\.set\(snapshot\.x, 0, snapshot\.z\)/);
  assert.match(v42, /__skyDancerGetV42Continuity/);
  assert.match(pipeline, /SkyDancerV42ContinuityPass/);
  assert.match(pipeline, /this\.v41Terrain\.update\(snapshot\);\n    this\.v42\.update\(snapshot\);/);
});
