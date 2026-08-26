import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { CartEnemyState } from "../src/cart/CartCombat";
import { pointSegmentDistanceSquared3DV43 } from "../src/sky/SkyDancerPlayerWeapons";
import {
  SKY_DANCER_ENEMY_ALTITUDE_LIMIT_METERS,
  SKY_DANCER_VERTICAL_COLLISION_CLEARANCE_METERS,
  SKY_DANCER_VERTICAL_MAX_PITCH_RADIANS,
  getSkyDancerEnemyVerticalSnapshotV43,
  shouldSuppressSkyDancerLegacy2DContactV43,
  skyDancerDistance3DV43,
  stepSkyDancerEnemyVerticalFlightV43,
} from "../src/sky/SkyDancerVerticalFlightV43";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");

function enemy(id: string, x: number, z: number, heading = 0): CartEnemyState {
  return {
    id,
    nodeId: "arena-01",
    kind: "chaser",
    archetype: "striker",
    x,
    z,
    radius: 1.4,
    maxHp: 40,
    hp: 40,
    alive: true,
    heading,
    moveSpeed: 11,
  } as CartEnemyState;
}

test("V43 enemies fly freely inside the +/-10m altitude envelope with aircraft pitch", () => {
  const fighter = enemy("v43-free-flight", 22, 14, 0.4);
  let maxAbsAltitude = 0;
  let maxAbsPitch = 0;
  for (let frame = 0; frame < 900; frame += 1) {
    stepSkyDancerEnemyVerticalFlightV43([fighter], {
      nodeId: "arena-01",
      playerX: 0,
      playerZ: 0,
      playerHeading: 0,
      playerSpeed: 12,
      delta: 1 / 60,
    });
    const vertical = getSkyDancerEnemyVerticalSnapshotV43(fighter);
    maxAbsAltitude = Math.max(maxAbsAltitude, Math.abs(vertical.altitudeOffsetMeters));
    maxAbsPitch = Math.max(maxAbsPitch, Math.abs(vertical.pitchRadians));
    assert.ok(Math.abs(vertical.altitudeOffsetMeters) <= SKY_DANCER_ENEMY_ALTITUDE_LIMIT_METERS + 0.0001);
    assert.ok(Math.abs(vertical.pitchRadians) <= SKY_DANCER_VERTICAL_MAX_PITCH_RADIANS + 0.0001);
  }
  assert.ok(maxAbsAltitude > 2, `expected meaningful vertical flight, saw ${maxAbsAltitude.toFixed(2)}m`);
  assert.ok(maxAbsPitch > 0.02, `expected aircraft pitch, saw ${maxAbsPitch.toFixed(3)}rad`);
});

test("V43 uses opposite altitude lanes to separate converging aircraft", () => {
  const left = enemy("v43-pair-a", -1.2, 5, Math.PI);
  const right = enemy("v43-pair-b", 1.2, 5, Math.PI);
  for (let frame = 0; frame < 150; frame += 1) {
    stepSkyDancerEnemyVerticalFlightV43([left, right], {
      nodeId: "arena-01",
      playerX: 50,
      playerZ: 50,
      playerHeading: 0,
      playerSpeed: 10,
      delta: 1 / 60,
    });
  }
  const a = getSkyDancerEnemyVerticalSnapshotV43(left);
  const b = getSkyDancerEnemyVerticalSnapshotV43(right);
  assert.ok(a.altitudeOffsetMeters * b.altitudeOffsetMeters < 0, "pair should split above and below");
  assert.ok(
    Math.abs(a.altitudeOffsetMeters - b.altitudeOffsetMeters) >= SKY_DANCER_VERTICAL_COLLISION_CLEARANCE_METERS,
    `expected vertical clearance, got ${Math.abs(a.altitudeOffsetMeters - b.altitudeOffsetMeters).toFixed(2)}m`,
  );
});

test("V43 player collision prediction triggers a climb or dive instead of only a horizontal shove", () => {
  const fighter = enemy("v43-player-avoid", 0.8, 6, Math.PI);
  let sawAvoidance = false;
  for (let frame = 0; frame < 120; frame += 1) {
    stepSkyDancerEnemyVerticalFlightV43([fighter], {
      nodeId: "arena-01",
      playerX: 0,
      playerZ: 0,
      playerHeading: 0,
      playerSpeed: 12,
      delta: 1 / 60,
    });
    sawAvoidance ||= getSkyDancerEnemyVerticalSnapshotV43(fighter).avoiding;
  }
  const vertical = getSkyDancerEnemyVerticalSnapshotV43(fighter);
  assert.equal(sawAvoidance, true);
  assert.ok(Math.abs(vertical.altitudeOffsetMeters) >= 3.0);
});

test("V43 safe altitude clearance disables inherited 2D player contact", () => {
  const fighter = enemy("v43-legacy-contact-filter", 0.5, 5.5, Math.PI);
  for (let frame = 0; frame < 210; frame += 1) {
    stepSkyDancerEnemyVerticalFlightV43([fighter], {
      nodeId: "arena-01",
      playerX: 0,
      playerZ: 0,
      playerHeading: 0,
      playerSpeed: 12,
      delta: 1 / 60,
    });
  }
  const altitude = Math.abs(getSkyDancerEnemyVerticalSnapshotV43(fighter).altitudeOffsetMeters);
  assert.ok(altitude >= SKY_DANCER_VERTICAL_COLLISION_CLEARANCE_METERS, `expected safe altitude clearance, got ${altitude.toFixed(2)}m`);
  assert.equal(shouldSuppressSkyDancerLegacy2DContactV43(fighter), true);

  const source = read("../src/sky/SkyDancerVerticalFlightV43.ts");
  assert.match(source, /skyDancerV43LegacyContactFilteredStep/);
  assert.match(source, /legacyStep\.call\(this, input, fixedDelta\)/);
  assert.match(source, /installSkyDancerLegacy2DContactFilterV43\(\);/);
});

test("V43 3D distance and swept collision distinguish altitude-separated targets", () => {
  assert.equal(skyDancerDistance3DV43(0, 0, 0, 3, 4, 0), 5);
  const directHit = pointSegmentDistanceSquared3DV43(5, 0, 0, 0, 0, 0, 10, 0, 0);
  const overflight = pointSegmentDistanceSquared3DV43(5, 5, 0, 0, 0, 0, 10, 0, 0);
  assert.ok(directHit < 0.0001);
  assert.ok(overflight >= 25);
});

test("V43 missiles use rate-limited pitch, thrust acceleration and 3D target altitude", () => {
  const enemyMissiles = read("../src/sky/SkyDancerFlightCombat.ts");
  const playerMissiles = read("../src/sky/SkyDancerPlayerWeapons.ts");
  const presentation = read("../src/sky/presentation/SkyDancerV43VerticalCombatPass.ts");

  for (const source of [enemyMissiles, playerMissiles]) {
    assert.match(source, /altitudeOffsetMeters/);
    assert.match(source, /pitchRate/);
    assert.match(source, /acceleration/);
    assert.match(source, /Math\.sin\(missile\.pitch\) \* missile\.speed/);
    assert.match(source, /Math\.cos\(missile\.pitch\) \* missile\.speed/);
  }
  assert.match(playerMissiles, /getSkyDancerEnemyAltitudeMetersV43/);
  assert.match(playerMissiles, /pointSegmentDistanceSquared3DV43/);
  assert.match(presentation, /SKY_DANCER_VERTICAL_RENDER_METERS_PER_UNIT/);
  assert.match(presentation, /child\.rotation\.x = -missile\.pitch/);
  assert.match(presentation, /__skyDancerGetV43VerticalFlight/);
});
