import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as THREE from "three";
import { CartArenaSession } from "../src/cart/CartArenaSession";
import {
  SKY_DANCER_ENEMY_PREFERRED_STANDOFF,
  skyDancerAvoidanceHeading,
  skyDancerEnemySafetyRadius,
  skyDancerNormalizeAngle,
} from "../src/sky/SkyDancerFlightAvoidanceMath";

const FIXED_STEP = 1 / 60;
const DRIVE_INPUT = { throttle: 0.84, brake: 0, steer: 0, boost: false } as const;

test("Sky Dancer starts from the Cart Rogue arena contract", () => {
  const session = new CartArenaSession();
  const snapshot = session.snapshot();
  assert.equal(snapshot.nodeId, "arena-01");
  assert.equal(snapshot.gas, 1);
  assert.equal(snapshot.boostCharges, 2);
  assert.ok(snapshot.enemiesTotal > 0);
  assert.ok(snapshot.obstacles.length > 0);
});

test("the original arcade steering and forward drive remain active", () => {
  const session = new CartArenaSession();
  const before = session.snapshot();
  for (let index = 0; index < 10; index += 1) session.advance(FIXED_STEP, { ...DRIVE_INPUT, steer: 1 });
  const after = session.snapshot();
  assert.notEqual(after.x, before.x);
  assert.ok(after.speed > 0);
});

test("the first airborne conversion keeps the route graph and enemy targets intact", () => {
  const session = new CartArenaSession();
  for (let index = 0; index < 30; index += 1) session.advance(FIXED_STEP, DRIVE_INPUT);
  const snapshot = session.snapshot();
  assert.equal(snapshot.nodeKind, "arena");
  assert.ok(snapshot.enemies.some((enemy) => enemy.kind === "blocker" || enemy.kind === "chaser"));
});

test("aircraft exhaust geometry points backward on the -Z flight axis", () => {
  const geometry = new THREE.ConeGeometry(0.22, 1.7, 10, 1, true);
  geometry.rotateX(-Math.PI / 2);
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  assert.ok(bounds);
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const epsilon = 0.002;
  let rearRadius = 0;
  let frontRadius = 0;
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const radius = Math.hypot(x, y);
    if (Math.abs(z - bounds.min.z) < epsilon) rearRadius = Math.max(rearRadius, radius);
    if (Math.abs(z - bounds.max.z) < epsilon) frontRadius = Math.max(frontRadius, radius);
  }
  assert.ok(frontRadius > 0.18);
  assert.ok(rearRadius < frontRadius * 0.25);
});

test("WebGL air combat FX records wing and enemy missile trails in world space", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV2.ts", import.meta.url), "utf8");
  assert.match(source, /class WorldRibbonTrail/);
  assert.match(source, /leftTrailPoint\.set\(-state\.wingSpan/);
  assert.match(source, /rightTrailPoint\.set\(state\.wingSpan/);
  assert.match(source, /localToWorld\(this\.leftTrailPoint\)/);
  assert.match(source, /localToWorld\(this\.rightTrailPoint\)/);
  assert.match(source, /sky-dancer-missile-smoke-\$\{missile\.id\}/);
  assert.match(source, /geometry\.rotateX\(-Math\.PI \/ 2\)/);
  assert.match(source, /flame\.mesh\.scale\.z = flame\.baseLength/);
});

test("Canvas fallback stores historical world positions instead of fighter-attached vapor sticks", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerCanvasPreviewV2.ts", import.meta.url), "utf8");
  assert.match(source, /interface TrailPoint/);
  assert.match(source, /localPoint\(x, z, heading, -wingSpan, -0\.58\)/);
  assert.match(source, /trail\.points\.push\(\{ x: missile\.x, z: missile\.z, age: 0 \}\)/);
  assert.match(source, /drawAircraftTrails/);
  assert.match(source, /drawMissileTrails/);
});

test("enemy guidance breaks away early without nonphysical standoff sliding", () => {
  const safety = skyDancerEnemySafetyRadius(1.75);
  assert.equal(SKY_DANCER_ENEMY_PREFERRED_STANDOFF, 21);
  assert.ok(safety > 5.8);
  const direct = 0;
  const close = skyDancerAvoidanceHeading(0, 0, 0, 12, 0, 12, 1);
  assert.ok(Math.abs(skyDancerNormalizeAngle(close - direct)) > 2.3);
  const missileZone = skyDancerAvoidanceHeading(0, 0, 0, 22, 0, 22, 1);
  const crank = Math.abs(skyDancerNormalizeAngle(missileZone - direct));
  assert.ok(crank >= 0.5 && crank <= 0.8);

  const avoidance = readFileSync(new URL("../src/sky/SkyDancerFlightAvoidance.ts", import.meta.url), "utf8");
  assert.match(avoidance, /const lookAhead = 0\.95/);
  assert.match(avoidance, /predictedDistance < safetyRadius \+ 5\.4/);
  assert.match(avoidance, /distance < 36/);
  assert.doesNotMatch(avoidance, /outwardSpeed/);
  assert.match(avoidance, /Only the actual collision bubble is position-corrected/);

  const standoff = readFileSync(new URL("../src/sky/SkyDancerLongRangeStandoff.ts", import.meta.url), "utf8");
  assert.match(standoff, /SKY_DANCER_COMBAT_STANDOFF = 26/);
  assert.match(standoff, /enemy\.kind === "boss" \? 30 : enemy\.kind === "heavy" \? 28/);
  assert.match(standoff, /enemy\.heading = rotateToward/);
  assert.doesNotMatch(standoff, /enemy\.x \+=/);
  assert.doesNotMatch(standoff, /enemy\.z \+=/);
});

test("Turbo hold keeps base throttle and drift behavior", () => {
  const source = readFileSync(new URL("../src/cart/CartRoguePhase15Turbo.ts", import.meta.url), "utf8");
  assert.match(source, /throttle: input\.throttle/);
  assert.doesNotMatch(source, /Math\.min\(input\.throttle, 0\.24\)/);
  assert.doesNotMatch(source, /const damping = Math\.pow/);
  assert.match(source, /const yawRate =/);
  assert.match(source, /const targetSlip =/);
  assert.match(source, /applyTurboDriftHold/);
  assert.match(source, /applyReleaseDash/);
});

test("Turbo hold has no Sky Dancer speed authority and release dash stays original", () => {
  const phase15 = readFileSync(new URL("../src/cart/CartRoguePhase15Turbo.ts", import.meta.url), "utf8");
  const dynamics = readFileSync(new URL("../src/sky/SkyDancerFlightDynamics.ts", import.meta.url), "utf8");
  const v20 = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV20.ts", import.meta.url), "utf8");
  const entry = readFileSync(new URL("../app/CartRogueGamePhase13.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(dynamics, /SKY_DANCER_TURBO_HOLD_ACCEL/);
  assert.doesNotMatch(dynamics, /SKY_DANCER_TURBO_HOLD_SPEED_CAP/);
  assert.doesNotMatch(dynamics, /preserveTurboForwardSpeed/);
  assert.doesNotMatch(v20, /TURBO_MIN_SPEED|TURBO_ACCEL|TURBO_SPEED_CAP|enforceTurboAfterSimulation/);
  assert.doesNotMatch(entry, /SkyDancerRuntimeControlPatch/);
  assert.match(phase15, /const launch = 1\.8 \+ charge \* 3\.35/);
  assert.match(phase15, /const cap = car\.definition\.maxSpeed \* \(1\.43 \+ charge \* 0\.07\)/);
  assert.match(phase15, /car\.boostTimeRemaining = Math\.min\(3\.2, car\.boostTimeRemaining \+ 0\.1 \+ charge \* 0\.3\)/);
});

test("enemy flight is slightly faster while keeping inertial turn limits", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerFlightDynamics.ts", import.meta.url), "utf8");
  assert.match(source, /SKY_DANCER_ENEMY_SPEED_MULTIPLIER = 1\.12/);
  assert.match(source, /rawDistance \/ Math\.max\(delta, 0\.001\) \* SKY_DANCER_ENEMY_SPEED_MULTIPLIER/);
  assert.match(source, /if \(enemy\.archetype === "striker"\) return 20/);
  assert.match(source, /lateral = clamp\(lateral, -Math\.abs\(forward\) \* 0\.16/);
});

test("player missiles support swept hits and one-shot standard fighters", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerPlayerWeapons.ts", import.meta.url), "utf8");
  assert.match(source, /SKY_DANCER_PLAYER_MISSILE_COOLDOWN = 0\.34/);
  assert.match(source, /SKY_DANCER_PLAYER_MISSILE_MAX_ACTIVE = 5/);
  assert.match(source, /SKY_DANCER_PLAYER_MISSILE_LOCK_DISTANCE = 58/);
  assert.match(source, /function pointSegmentDistanceSquared/);
  assert.match(source, /function missileDamage/);
  assert.match(source, /if \(enemy\.kind === "boss"\) return 24/);
  assert.match(source, /if \(enemy\.kind === "heavy"\) return 30/);
  assert.match(source, /return Math\.max\(enemy\.maxHp, enemy\.hp, 1\)/);
  assert.match(source, /hit\.hp = Math\.max\(0, hit\.hp - damage\)/);
  assert.match(source, /MISSILE SPLASH · TARGET DOWN/);
  assert.match(source, /lastClockMs/);
  assert.match(source, /function advanceFromClock/);
  assert.match(source, /getSkyDancerPlayerWeaponState/);
  assert.match(source, /advanceFromClock\(view, state\)/);
});

test("V7 drives fighter roll from actual turn rate and lowers presentation altitude", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV7.ts", import.meta.url), "utf8");
  assert.match(source, /SKY_DANCER_PRESENTATION_ALTITUDE_METERS = 105/);
  assert.match(source, /previousPlayerHeading/);
  assert.match(source, /turnRate = normalizeAngle/);
  assert.match(source, /turnBank = THREE\.MathUtils\.clamp\(-turnRate \* 0\.78, -0\.98, 0\.98\)/);
  assert.match(source, /targetBank = THREE\.MathUtils\.clamp\(-angularRate \* 0\.68, -0\.98, 0\.98\)/);
  assert.match(source, /LOW_ALTITUDE_GROUND_SHIFT = 12/);
});

test("V8 removes residual scene-level player-underfoot radial rings", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV8.ts", import.meta.url), "utf8");
  assert.match(source, /geometryType !== "TorusGeometry" && geometryType !== "RingGeometry"/);
  assert.match(source, /dx \* dx \+ dz \* dz > 5\.2 \* 5\.2/);
  assert.match(source, /sky-dancer-air-gate-/);
});

test("V9 replaces the cheap Turbo cone with layered jet structure", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV9.ts", import.meta.url), "utf8");
  assert.match(source, /sky-dancer-q9-shock-diamond/);
  assert.match(source, /sky-dancer-q9-exhaust-ring/);
  assert.match(source, /sky-dancer-q9-turbo-plume/);
  assert.match(source, /object\.name === "sky-dancer-jet-flame-v2"/);
});

test("V10 renders player missiles and exposes the active renderer fire callback", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV10.ts", import.meta.url), "utf8");
  assert.match(source, /sky-dancer-q10-player-missiles/);
  assert.match(source, /bindSkyDancerWeaponSession/);
  assert.match(source, /GLOBAL_FIRE_KEY/);
  assert.match(source, /requestSkyDancerPlayerMissile\(runtime\.session\)/);
  assert.match(source, /getSkyDancerPlayerWeaponState/);
});

test("V11 quality remains in the active V21 inheritance chain", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV11.ts", import.meta.url), "utf8");
  const entry = readFileSync(new URL("../src/sky/SkyDancerAirCombatFx.ts", import.meta.url), "utf8");
  assert.match(source, /sky-dancer-q11-route-parcels/);
  assert.match(source, /sky-dancer-q11-route-towns/);
  assert.match(source, /sky-dancer-q11-highways/);
  assert.match(entry, /SkyDancerAirCombatFxV21/);
});

test("Canvas V4 binds Shot to the active session and draws player missiles", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerCanvasPreviewV4.ts", import.meta.url), "utf8");
  assert.match(source, /bindSkyDancerWeaponSession/);
  assert.match(source, /installSkyDancerFlightDynamics/);
  assert.match(source, /drawPlayerMissiles/);
  assert.match(source, /globalCompositeOperation = "lighter"/);
});

test("V18 restores city clearance and gives enemies visible three-dimensional maneuvers", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV18.ts", import.meta.url), "utf8");
  assert.match(source, /STREAMED_SCENERY_DROP = 3\.2/);
  assert.match(source, /HIGHRISE_SCALE = 0\.9/);
  assert.match(source, /sky-dancer-q16-streamed-scenery/);
  assert.match(source, /sky-dancer-q16-city-blocks/);
  assert.match(source, /updateEnemyThreeDimensionalFlight/);
  assert.match(source, /closeManeuver/);
  assert.match(source, /breakClimb/);
  assert.match(source, /enemyVerticalSpread/);
  assert.match(source, /sky-dancer-v18-missile-warning/);
});

test("V19 moves graphics toward the midpoint reference without changing chase-camera distance", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV19.ts", import.meta.url), "utf8");
  assert.match(source, /sky-dancer-v19-readable-city/);
  assert.match(source, /sky-dancer-v19-skyline/);
  assert.match(source, /sky-dancer-v19-river-bridges/);
  assert.match(source, /sky-dancer-v19-wind-farm/);
  assert.match(source, /sky-dancer-v19-cloud-volume/);
  assert.match(source, /sky-dancer-v19-cinematic-boost/);
  assert.match(source, /sky-dancer-v19-player-missile-trail/);
  assert.match(source, /chase-camera distance unchanged/);
  assert.doesNotMatch(source, /camera\.position\.set/);
  assert.doesNotMatch(source, /camera\.fov\s*=/);
});

test("V20 keeps large visible player shots without Turbo speed overrides", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV20.ts", import.meta.url), "utf8");
  assert.match(source, /sky-dancer-v20-visible-player-shots/);
  assert.match(source, /new THREE\.BoxGeometry\(0\.13, 0\.13, 7\.4\)/);
  assert.match(source, /lateralOffset = launchSide \* 1\.05 \* wingBlend/);
  assert.doesNotMatch(source, /enforceTurboAfterSimulation/);
  assert.doesNotMatch(source, /TURBO_MIN_SPEED|TURBO_ACCEL|TURBO_SPEED_CAP/);
});

test("V21 makes missile hits unmistakable", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV21.ts", import.meta.url), "utf8");
  assert.match(source, /sky-dancer-v21-missile-hit-confirm/);
  assert.match(source, /sky-dancer-v21-player-missile-impact/);
  assert.match(source, /emitImpactSparks\(this\.hitPoint, 20\)/);
  assert.match(source, /cameraShake = Math\.max/);
  assert.match(source, /impactFlash = Math\.max/);
  assert.match(source, /new THREE\.PointLight\(0xffa43d, 7\.5, 18, 2\)/);
});

test("V19 HUD uses compact translucent flight instrumentation styling", () => {
  const source = readFileSync(new URL("../app/SkyDancerHudQualityPass.tsx", import.meta.url), "utf8");
  assert.match(source, /rgba\(10,43,66,\.76\)/);
  assert.match(source, /backdrop-filter: blur\(6px\)/);
  assert.match(source, /rgba\(42,199,248,\.92\)/);
  assert.match(source, /itemStrip/);
});

test("the half-density opening formation avoids spawning a large fighter on top of the player", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerEnemyPopulation.ts", import.meta.url), "utf8");
  assert.match(source, /OPENING_MIN_DISTANCE = 32/);
  assert.match(source, /Math\.ceil\(regular\.length \* 0\.5\)/);
  assert.match(source, /if \(enemy\.kind === "heavy"\) return 4/);
  assert.match(source, /spreadOpeningFormation/);
});

test("SHOT control prefers the active renderer callback and falls back to the session bridge", () => {
  const ui = readFileSync(new URL("../app/SkyDancerShotControl.tsx", import.meta.url), "utf8");
  const bridge = readFileSync(new URL("../src/sky/SkyDancerWeaponBridge.ts", import.meta.url), "utf8");
  assert.match(ui, /DIRECT_FIRE_KEY = "__skyDancerFireMissile"/);
  assert.match(ui, /typeof direct === "function"/);
  assert.match(ui, /fireSkyDancerActiveWeapon/);
  assert.match(ui, /active renderer's/);
  assert.match(bridge, /activeSession/);
  assert.match(bridge, /requestSkyDancerPlayerMissile\(activeSession\)/);
});

test("WebGL audit validates neutral Turbo hold then restored release dash", () => {
  const source = readFileSync(new URL("../scripts/webgl-visual-audit.mjs", import.meta.url), "utf8");
  const shotIndex = source.indexOf("Primary regression #1");
  const turboIndex = source.indexOf("Primary regression #2");
  const spacingIndex = source.indexOf("Secondary opening spacing");
  assert.ok(shotIndex >= 0 && turboIndex > shotIndex && spacingIndex > turboIndex);
  assert.match(source, /waitForTimeout\(80\)/);
  assert.match(source, /missileTravel300/);
  assert.match(source, /duringForward < beforeForward \* 0\.96/);
  assert.match(source, /releasedForward < duringForward \+ 1\.2/);
  assert.match(source, /Turbo release dash did not restore its acceleration/);
});

test("Sky Dancer combat polish removes vehicle phrasing and uses flight terminology", () => {
  const source = readFileSync(new URL("../app/SkyDancerCombatPolish.tsx", import.meta.url), "utf8");
  assert.match(source, /WALL RIDE.*LOW PASS/);
  assert.match(source, /TURBO RAM.*BOOST STRIKE/);
  assert.match(source, /HOLD DRIFT · RELEASE DASH.*HOLD BOOST · RELEASE DASH/);
  assert.match(source, /ARCADE TURN.*FLIGHT CONTROL/);
  assert.match(source, /GATE OPEN.*ROUTE OPEN/);
  assert.match(source, /MISSILE WARNING/);
  assert.match(source, /SKY_DANCER_MISSILE_EVENT/);
});
