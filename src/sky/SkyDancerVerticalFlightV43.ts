import { CartArenaSession } from "../cart/CartArenaSession";
import type { CartEnemyState } from "../cart/CartCombat";
import type { RallyInputState } from "../rally/RallyTypes";

export const SKY_DANCER_ENEMY_ALTITUDE_LIMIT_METERS = 10;
export const SKY_DANCER_VERTICAL_COLLISION_CLEARANCE_METERS = 3.2;
export const SKY_DANCER_VERTICAL_RENDER_METERS_PER_UNIT = 150 / 38;
export const SKY_DANCER_VERTICAL_MAX_PITCH_RADIANS = 0.30;

interface VerticalState {
  altitudeOffsetMeters: number;
  verticalSpeedMetersPerSecond: number;
  pitchRadians: number;
  targetAltitudeMeters: number;
  wanderClock: number;
  avoidClock: number;
  avoidTargetMeters: number;
  tacticalClock: number;
  tacticalPhase: number;
}

export interface SkyDancerEnemyVerticalSnapshotV43 {
  altitudeOffsetMeters: number;
  verticalSpeedMetersPerSecond: number;
  pitchRadians: number;
  targetAltitudeMeters: number;
  avoiding: boolean;
  tacticalPhase: number;
}

export interface SkyDancerVerticalFlightContextV43 {
  nodeId: string;
  playerX: number;
  playerZ: number;
  playerHeading: number;
  playerSpeed: number;
  delta: number;
}

interface LegacyContactSessionV43 {
  enemies: CartEnemyState[];
  location: { node: { id: string } };
  car: { position: { x: number; z: number } };
  step(input: RallyInputState, fixedDelta?: number): void;
}

interface MaskedLegacyEnemyV43 {
  enemy: CartEnemyState;
  x: number;
  z: number;
  heading: number;
}

const stateByEnemy = new WeakMap<CartEnemyState, VerticalState>();
const LEGACY_CONTACT_FILTER_KEY = "__skyDancerV43Legacy2DContactFilterInstalled__";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function moveToward(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(target, current + maxDelta);
  if (current > target) return Math.max(target, current - maxDelta);
  return current;
}

function stableHash(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableSide(id: string): number {
  return stableHash(id) % 2 === 0 ? -1 : 1;
}

function stateFor(enemy: CartEnemyState): VerticalState {
  const current = stateByEnemy.get(enemy);
  if (current) return current;
  const hash = stableHash(enemy.id);
  const initialTarget = ((hash % 1801) / 100 - 9) * 0.92;
  const created: VerticalState = {
    altitudeOffsetMeters: 0,
    verticalSpeedMetersPerSecond: 0,
    pitchRadians: 0,
    targetAltitudeMeters: clamp(initialTarget, -8.7, 8.7),
    wanderClock: 1.2 + (hash % 170) / 100,
    avoidClock: 0,
    avoidTargetMeters: 0,
    tacticalClock: 0.5 + (hash % 140) / 100,
    tacticalPhase: hash % 4,
  };
  stateByEnemy.set(enemy, created);
  return created;
}

function maxClimbSpeed(enemy: CartEnemyState): number {
  if (enemy.kind === "boss") return 4.25;
  if (enemy.kind === "heavy") return 3.75;
  if (enemy.archetype === "striker") return 5.3;
  if (enemy.archetype === "orbiter") return 4.55;
  return 4.15;
}

function verticalAcceleration(enemy: CartEnemyState): number {
  if (enemy.kind === "boss") return 6.4;
  if (enemy.kind === "heavy") return 5.8;
  if (enemy.archetype === "striker") return 8.6;
  return 7.2;
}

function horizontalReferenceSpeed(enemy: CartEnemyState): number {
  if (enemy.kind === "boss") return 10.4;
  if (enemy.kind === "heavy") return 8.8;
  if (enemy.archetype === "striker") return 13.2;
  if (enemy.archetype === "drifter") return 12.4;
  if (enemy.archetype === "orbiter") return 11.6;
  return 11.2;
}

function chooseWanderTarget(enemy: CartEnemyState, state: VerticalState): void {
  const hash = stableHash(`${enemy.id}:${Math.floor(state.wanderClock * 1000)}:${Math.floor(state.altitudeOffsetMeters * 10)}`);
  const normalized = (hash % 2001) / 1000 - 1;
  state.targetAltitudeMeters = clamp(normalized * 8.9, -8.9, 8.9);
  state.wanderClock = 1.75 + ((hash >>> 8) % 1700) / 1000;
}

function requestAvoidance(state: VerticalState, targetMeters: number, holdSeconds: number): void {
  const clamped = clamp(targetMeters, -9.2, 9.2);
  if (state.avoidClock <= 0 || Math.abs(clamped - state.altitudeOffsetMeters) > Math.abs(state.avoidTargetMeters - state.altitudeOffsetMeters)) {
    state.avoidTargetMeters = clamped;
  }
  state.avoidClock = Math.max(state.avoidClock, holdSeconds);
}

/** V44 external hook for encounter-specific climb/dive attacks. */
export function requestSkyDancerVerticalManeuverV44(
  enemy: CartEnemyState,
  targetAltitudeMeters: number,
  holdSeconds = 0.9,
): void {
  requestAvoidance(stateFor(enemy), targetAltitudeMeters, holdSeconds);
}

function requestTacticalVerticalManeuverV44(
  enemy: CartEnemyState,
  state: VerticalState,
  context: SkyDancerVerticalFlightContextV43,
): void {
  state.tacticalClock -= context.delta;
  const distance = Math.hypot(enemy.x - context.playerX, enemy.z - context.playerZ);
  if (state.tacticalClock > 0) return;
  const side = stableSide(enemy.id);

  if (enemy.kind === "boss") {
    // Boss repeatedly climbs above the player, dives through the engagement
    // plane, then exits low before recovering. It makes the V43 altitude band
    // a readable boss mechanic instead of background wander.
    state.tacticalPhase = (state.tacticalPhase + 1) % 4;
    const bossTargets = [9.0, 8.2, -8.8, -6.8] as const;
    requestAvoidance(state, bossTargets[state.tacticalPhase], state.tacticalPhase === 2 ? 1.45 : 1.05);
    state.tacticalClock = state.tacticalPhase === 2 ? 1.5 : 1.1;
    return;
  }

  if (enemy.archetype === "striker" && distance < 52) {
    // A striker starts high, then crosses through/under the player's plane on
    // the actual attack pass. This is intentionally asymmetric and quick.
    state.tacticalPhase = (state.tacticalPhase + 1) % 3;
    const target = state.tacticalPhase === 0 ? side * 8.8 : state.tacticalPhase === 1 ? -side * 8.6 : side * 2.4;
    requestAvoidance(state, target, state.tacticalPhase === 1 ? 1.1 : 0.75);
    state.tacticalClock = state.tacticalPhase === 1 ? 1.05 : 0.8;
    return;
  }

  if (enemy.archetype === "orbiter" && distance < 64) {
    // Alternating altitude lanes turn the existing horizontal orbit into a
    // loose helix without requiring a new movement controller.
    state.tacticalPhase = (state.tacticalPhase + 1) % 4;
    const levels = [7.4, 2.0, -7.4, -2.0] as const;
    requestAvoidance(state, levels[state.tacticalPhase] * side, 1.0);
    state.tacticalClock = 1.0;
    return;
  }

  if (enemy.kind === "heavy" && distance < 58) {
    // Heavy aircraft act like high-cover missile platforms: they climb before
    // an attack window and descend slowly afterwards.
    state.tacticalPhase = (state.tacticalPhase + 1) % 2;
    requestAvoidance(state, state.tacticalPhase === 0 ? 7.8 : 3.2, 1.5);
    state.tacticalClock = 1.6;
    return;
  }

  state.tacticalClock = 0.9 + (stableHash(`${enemy.id}:${state.tacticalPhase}`) % 90) / 100;
}

function requestPlayerAvoidance(
  enemy: CartEnemyState,
  state: VerticalState,
  context: SkyDancerVerticalFlightContextV43,
): void {
  const lookAhead = 0.88;
  const enemySpeed = horizontalReferenceSpeed(enemy);
  const predictedEnemyX = enemy.x + Math.sin(enemy.heading) * enemySpeed * lookAhead;
  const predictedEnemyZ = enemy.z + Math.cos(enemy.heading) * enemySpeed * lookAhead;
  const playerTravel = Math.min(16, Math.abs(context.playerSpeed) * lookAhead);
  const predictedPlayerX = context.playerX + Math.sin(context.playerHeading) * playerTravel;
  const predictedPlayerZ = context.playerZ + Math.cos(context.playerHeading) * playerTravel;
  const predictedHorizontal = Math.hypot(predictedEnemyX - predictedPlayerX, predictedEnemyZ - predictedPlayerZ);
  const currentHorizontal = Math.hypot(enemy.x - context.playerX, enemy.z - context.playerZ);
  if (Math.min(predictedHorizontal, currentHorizontal) > 9.0) return;
  if (Math.abs(state.altitudeOffsetMeters) >= SKY_DANCER_VERTICAL_COLLISION_CLEARANCE_METERS + 0.8) return;

  const side = stableSide(enemy.id);
  const target = side > 0 ? 8.6 : -8.6;
  requestAvoidance(state, target, 1.35);
}

function requestEnemyPairAvoidance(enemies: readonly CartEnemyState[], nodeId: string): void {
  const live = enemies.filter((enemy) => enemy.alive && enemy.nodeId === nodeId);
  for (let leftIndex = 0; leftIndex < live.length; leftIndex += 1) {
    const left = live[leftIndex];
    const leftState = stateFor(left);
    for (let rightIndex = leftIndex + 1; rightIndex < live.length; rightIndex += 1) {
      const right = live[rightIndex];
      const rightState = stateFor(right);
      const horizontal = Math.hypot(left.x - right.x, left.z - right.z);
      if (horizontal > Math.max(6.8, left.radius + right.radius + 3.0)) continue;
      if (Math.abs(leftState.altitudeOffsetMeters - rightState.altitudeOffsetMeters) >= SKY_DANCER_VERTICAL_COLLISION_CLEARANCE_METERS) continue;

      const leftGoesUp = left.id.localeCompare(right.id) < 0;
      requestAvoidance(leftState, leftGoesUp ? 8.4 : -8.4, 1.1);
      requestAvoidance(rightState, leftGoesUp ? -8.4 : 8.4, 1.1);
    }
  }
}

function integrateEnemyVertical(enemy: CartEnemyState, state: VerticalState, delta: number): void {
  state.wanderClock -= delta;
  state.avoidClock = Math.max(0, state.avoidClock - delta);
  if (state.wanderClock <= 0 && state.avoidClock <= 0) chooseWanderTarget(enemy, state);

  const desiredAltitude = state.avoidClock > 0 ? state.avoidTargetMeters : state.targetAltitudeMeters;
  const maxClimb = maxClimbSpeed(enemy);
  const desiredVerticalSpeed = clamp((desiredAltitude - state.altitudeOffsetMeters) * 0.95, -maxClimb, maxClimb);
  state.verticalSpeedMetersPerSecond = moveToward(
    state.verticalSpeedMetersPerSecond,
    desiredVerticalSpeed,
    verticalAcceleration(enemy) * delta,
  );

  state.altitudeOffsetMeters += state.verticalSpeedMetersPerSecond * delta;
  if (state.altitudeOffsetMeters >= SKY_DANCER_ENEMY_ALTITUDE_LIMIT_METERS) {
    state.altitudeOffsetMeters = SKY_DANCER_ENEMY_ALTITUDE_LIMIT_METERS;
    state.verticalSpeedMetersPerSecond = Math.min(0, state.verticalSpeedMetersPerSecond);
    state.targetAltitudeMeters = Math.min(state.targetAltitudeMeters, 7.5);
  } else if (state.altitudeOffsetMeters <= -SKY_DANCER_ENEMY_ALTITUDE_LIMIT_METERS) {
    state.altitudeOffsetMeters = -SKY_DANCER_ENEMY_ALTITUDE_LIMIT_METERS;
    state.verticalSpeedMetersPerSecond = Math.max(0, state.verticalSpeedMetersPerSecond);
    state.targetAltitudeMeters = Math.max(state.targetAltitudeMeters, -7.5);
  }

  const desiredPitch = clamp(
    Math.atan2(state.verticalSpeedMetersPerSecond, Math.max(7.5, horizontalReferenceSpeed(enemy))),
    -SKY_DANCER_VERTICAL_MAX_PITCH_RADIANS,
    SKY_DANCER_VERTICAL_MAX_PITCH_RADIANS,
  );
  state.pitchRadians = moveToward(state.pitchRadians, desiredPitch, 0.92 * delta);
}

export function stepSkyDancerEnemyVerticalFlightV43(
  enemies: readonly CartEnemyState[],
  context: SkyDancerVerticalFlightContextV43,
): void {
  const delta = clamp(context.delta, 0.001, 0.05);
  requestEnemyPairAvoidance(enemies, context.nodeId);
  for (const enemy of enemies) {
    if (!enemy.alive || enemy.nodeId !== context.nodeId) continue;
    const state = stateFor(enemy);
    requestTacticalVerticalManeuverV44(enemy, state, context);
    requestPlayerAvoidance(enemy, state, context);
    integrateEnemyVertical(enemy, state, delta);
  }
}

export function getSkyDancerEnemyVerticalSnapshotV43(enemy: CartEnemyState): SkyDancerEnemyVerticalSnapshotV43 {
  const state = stateFor(enemy);
  return {
    altitudeOffsetMeters: state.altitudeOffsetMeters,
    verticalSpeedMetersPerSecond: state.verticalSpeedMetersPerSecond,
    pitchRadians: state.pitchRadians,
    targetAltitudeMeters: state.avoidClock > 0 ? state.avoidTargetMeters : state.targetAltitudeMeters,
    avoiding: state.avoidClock > 0,
    tacticalPhase: state.tacticalPhase,
  };
}

export function getSkyDancerEnemyAltitudeMetersV43(enemy: CartEnemyState): number {
  return stateFor(enemy).altitudeOffsetMeters;
}

export function shouldSuppressSkyDancerLegacy2DContactV43(enemy: CartEnemyState): boolean {
  return Math.abs(getSkyDancerEnemyAltitudeMetersV43(enemy)) >= SKY_DANCER_VERTICAL_COLLISION_CLEARANCE_METERS;
}

function installSkyDancerLegacy2DContactFilterV43(): void {
  const prototype = CartArenaSession.prototype as unknown as LegacyContactSessionV43 & Record<string, unknown>;
  if (prototype[LEGACY_CONTACT_FILTER_KEY]) return;
  prototype[LEGACY_CONTACT_FILTER_KEY] = true;
  const legacyStep = prototype.step;

  prototype.step = function skyDancerV43LegacyContactFilteredStep(input: RallyInputState, fixedDelta?: number): void {
    const session = this as unknown as LegacyContactSessionV43;
    const masked: MaskedLegacyEnemyV43[] = [];
    let slot = 0;

    for (const enemy of session.enemies) {
      if (!enemy.alive || enemy.nodeId !== session.location.node.id) continue;
      if (!shouldSuppressSkyDancerLegacy2DContactV43(enemy)) continue;
      masked.push({ enemy, x: enemy.x, z: enemy.z, heading: enemy.heading });
      const displacement = 5000 + slot * 173;
      enemy.x = session.car.position.x + displacement;
      enemy.z = session.car.position.z - displacement * 0.83;
      slot += 1;
    }

    try {
      legacyStep.call(this, input, fixedDelta);
    } finally {
      for (const saved of masked) {
        saved.enemy.x = saved.x;
        saved.enemy.z = saved.z;
        saved.enemy.heading = saved.heading;
      }
    }
  };
}

export function skyDancerDistance3DV43(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): number {
  return Math.hypot(ax - bx, ay - by, az - bz);
}

installSkyDancerLegacy2DContactFilterV43();
