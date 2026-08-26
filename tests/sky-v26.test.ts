import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CartArenaSession } from "../src/cart/CartArenaSession";
import { enableCartTurboHunt } from "../src/cart/CartRoguePhase67TurboHunt";
import {
  CART_TURBO_HUNT_FIELD,
  CART_TURBO_HUNT_WORLD_DEPTH,
  CART_TURBO_HUNT_WORLD_WIDTH,
  cartTurboHuntNearestCoordinate,
  cartTurboHuntTileCenter,
  cartTurboHuntWrapCoordinate,
  cartTurboHuntWrappedDelta,
} from "../src/cart/CartTurboHuntTrack";
import { installSkyDancerInfiniteWorld } from "../src/sky/SkyDancerInfiniteWorld";

test("Turbo Hunt repeats continuously across all four airspace seams", () => {
  const eastEdge = CART_TURBO_HUNT_FIELD.centerX + CART_TURBO_HUNT_FIELD.halfWidth;
  const northEdge = CART_TURBO_HUNT_FIELD.centerZ + CART_TURBO_HUNT_FIELD.halfDepth;
  assert.equal(
    cartTurboHuntWrapCoordinate(eastEdge, CART_TURBO_HUNT_FIELD.centerX, CART_TURBO_HUNT_WORLD_WIDTH),
    CART_TURBO_HUNT_FIELD.centerX - CART_TURBO_HUNT_FIELD.halfWidth,
  );
  assert.equal(
    cartTurboHuntWrapCoordinate(northEdge, CART_TURBO_HUNT_FIELD.centerZ, CART_TURBO_HUNT_WORLD_DEPTH),
    CART_TURBO_HUNT_FIELD.centerZ - CART_TURBO_HUNT_FIELD.halfDepth,
  );
  assert.equal(cartTurboHuntNearestCoordinate(469, 651, CART_TURBO_HUNT_WORLD_WIDTH), 653);
  assert.equal(cartTurboHuntWrappedDelta(469, 651, CART_TURBO_HUNT_WORLD_WIDTH), 2);
  assert.equal(cartTurboHuntTileCenter(653, 560, CART_TURBO_HUNT_WORLD_WIDTH), 744);
});

test("the aircraft physically crosses a Hunt seam without wall sliding or a position teleport", () => {
  installSkyDancerInfiniteWorld();
  const session = new CartArenaSession();
  enableCartTurboHunt(session);
  const eastEdge = CART_TURBO_HUNT_FIELD.centerX + CART_TURBO_HUNT_FIELD.halfWidth;
  session.car.position.x = eastEdge - 0.08;
  session.car.position.z = CART_TURBO_HUNT_FIELD.centerZ;
  session.car.heading = Math.PI / 2;
  session.car.forwardVelocity = 22;
  session.car.velocity.set(22, 0, 0);
  session.step({ throttle: 1, brake: 0, steer: 0, boost: false }, 1 / 60);
  const snapshot = session.snapshot();
  assert.ok(snapshot.x > eastEdge, `expected continuous eastbound coordinate, got ${snapshot.x}`);
  assert.equal(snapshot.wallSliding, false);
  assert.ok(session.enemies.some((enemy) => enemy.alive && Math.abs(enemy.x - snapshot.x) < CART_TURBO_HUNT_FIELD.halfWidth));
});

test("the active flight runtime uses an unbounded repeated tile instead of boundary collision", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerInfiniteWorld.ts", import.meta.url), "utf8");
  const hunt = readFileSync(new URL("../src/cart/CartRoguePhase67TurboHunt.ts", import.meta.url), "utf8");
  const webgl = readFileSync(new URL("../src/sky/SkyDancerWebGLDemo.ts", import.meta.url), "utf8");
  assert.match(source, /installPeriodicTrackQueries/);
  assert.match(source, /tileDynamicWorld/);
  assert.match(source, /LOGICAL_AIRSPACE_HALF_SIZE/);
  assert.match(source, /cartTurboHuntNearestCoordinate/);
  assert.match(webgl, /installSkyDancerInfiniteWorld\(\)/);
  assert.doesNotMatch(hunt, /boundaryMaterial/);
  assert.doesNotMatch(hunt, /strokeRect/);
});

test("combat visuals are warmed and pooled before the first gameplay frame", () => {
  const webgl = readFileSync(new URL("../src/sky/SkyDancerWebGLDemo.ts", import.meta.url), "utf8");
  const v2 = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV2.ts", import.meta.url), "utf8");
  const v10 = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV10.ts", import.meta.url), "utf8");
  const v21 = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV21.ts", import.meta.url), "utf8");
  const v24 = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV24.ts", import.meta.url), "utf8");
  const v25 = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV25.ts", import.meta.url), "utf8");
  const dynamics = readFileSync(new URL("../src/sky/SkyDancerFlightDynamics.ts", import.meta.url), "utf8");
  assert.match(webgl, /prewarmVisualPipeline/);
  assert.match(webgl, /renderer\.compile/);
  assert.match(webgl, /normalMissilePool/);
  assert.match(webgl, /activeMissileIds\.clear\(\)/);
  assert.match(v2, /pointPool/);
  assert.match(v2, /prewarmMissileTrails/);
  assert.match(v2, /prewarmAirBursts/);
  assert.match(v10, /missilePool/);
  assert.match(v10, /activeMissileIds\.clear\(\)/);
  assert.match(v21, /prewarmHitBursts/);
  assert.match(v24, /prewarmImpactResidues/);
  assert.match(v24, /releaseImpactResidue/);
  assert.doesNotMatch(v24, /disposeImpactResidue/);
  assert.match(v25, /prewarmMissileHeat/);
  assert.match(v25, /activeMissileHeatIds\.clear\(\)/);
  assert.match(dynamics, /posesBySession/);
});

test("V26 is active and couples the stronger Turbo dash to a one-allocation warp pass", () => {
  const entry = readFileSync(new URL("../src/sky/SkyDancerAirCombatFx.ts", import.meta.url), "utf8");
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV26.ts", import.meta.url), "utf8");
  const turbo = readFileSync(new URL("../src/sky/SkyDancerTurboModel.ts", import.meta.url), "utf8");
  const webgl = readFileSync(new URL("../src/sky/SkyDancerWebGLDemo.ts", import.meta.url), "utf8");
  assert.match(entry, /SkyDancerAirCombatFxV26 as SkyDancerAirCombatFx/);
  assert.match(source, /extends SkyDancerAirCombatFxV25/);
  assert.match(source, /sky-dancer-v26-turbo-warp/);
  assert.match(source, /uBurst/);
  assert.match(source, /releaseSerial/);
  assert.match(turbo, /SKY_DANCER_TURBO_RELEASE_BASE_KICK = 6\.4/);
  assert.match(turbo, /SKY_DANCER_TURBO_RELEASE_CHARGE_KICK = 12\.8/);
  assert.match(webgl, /releaseFov/);
  assert.match(webgl, /Math\.min\(96/);
});
