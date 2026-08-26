import type { CartEnemyState } from "../cart/CartCombat";
import { CartArenaSession } from "../cart/CartArenaSession";
import {
  CART_TURBO_HUNT_WORLD_DEPTH,
  CART_TURBO_HUNT_WORLD_WIDTH,
  cartTurboHuntNearestCoordinate,
  cartTurboHuntWrappedDelta,
} from "../cart/CartTurboHuntTrack";
import type { RallyInputState } from "../rally/RallyTypes";
import {
  getSkyDancerReengagementSnapshotV40,
  skyDancerReengagementInterceptV40,
  SKY_DANCER_V40_CLEANUP_ANGLE_TRIGGER,
  SKY_DANCER_V40_CLEANUP_SLOT_DELAY,
  SKY_DANCER_V40_CLEANUP_TRIGGER,
} from "./SkyDancerReengagementV40";

interface NaturalMotionSession {
  enemies: CartEnemyState[];
  location: { node: { id: string } };
  car: {
    position: { x: number; z: number };
    heading: number;
    forwardVelocity: number;
    lateralVelocity?: number;
  };
  step(input: RallyInputState, fixedDelta?: number): void;
}

interface EnemyBeforeFrame {
  x: number;
  z: number;
  heading: number;
  speed: number;
}

interface NaturalMotionState {
  before: Map<string, EnemyBeforeFrame>;
  cleanupSlots: Map<string, number>;
  cleanupActive: boolean;
  cleanupElapsed: number;
  minEnemyDistance: number;
  maxStepSpeed: number;
  maxTurnRate: number;
  constrainedEnemies: number;
  emergencyBreakaways: number;
}

export interface SkyDancerNaturalMotionSnapshotV41 {
  minEnemyDistance: number;
  maxStepSpeed: number;
  maxTurnRate: number;
  constrainedEnemies: number;
  emergencyBreakaways: number;
}

const PATCHED_KEY = "__skyDancerFlightNaturalMotionV41Installed__";
const GLOBAL_DEBUG_KEY = "__skyDancerGetNaturalMotionV41";
const stateBySession = new WeakMap<object, NaturalMotionState>();
const latestBySession = new WeakMap<object, SkyDancerNaturalMotionSnapshotV41>();

export const SKY_DANCER_V41_MIN_PASS_DISTANCE = 16;
export const SKY_DANCER_V41_BREAKAWAY_DISTANCE = 30;
export const SKY_DANCER_V41_APPROACH_BUFFER = 55;
export const SKY_DANCER_V41_MAX_CRUISE_SPEED = 24;
export const SKY_DANCER_V41_MAX_CLEANUP_SPEED = 26;
export const SKY_DANCER_V41_MAX_CLEANUP_INTERCEPT_SPEED = 36;
export const SKY_DANCER_V41_CLEANUP_CATCHUP_MARGIN = 4.5;
export const SKY_DANCER_V41_MAX_ESCAPE_SPEED = 40;
export const SKY_DANCER_V41_ESCAPE_SPEED_MARGIN = 6.5;
export const SKY_DANCER_V41_MAX_ACCELERATION = 18;
export const SKY_DANCER_V41_EMERGENCY_ACCELERATION = 28;
export const SKY_DANCER_V41_MAX_TURN_RATE = 1.12;
export const SKY_DANCER_V41_EMERGENCY_TURN_RATE = 1.65;
export const SKY_DANCER_V41_PREDICTIVE_DISTANCE = 72;
export const SKY_DANCER_V41_PREDICTIVE_MISS_DISTANCE = 24;
export const SKY_DANCER_V41_PREDICTIVE_LOOKAHEAD = 4;
const PREDICTIVE_MIN_CLOSING_RATE = 0.5;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeAngle(value: number): number {
  let angle = value;
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function rotateToward(current: number, target: number, maxTurn: number): number {
  const delta = normalizeAngle(target - current);
  return normalizeAngle(current + clamp(delta, -maxTurn, maxTurn));
}

function moveToward(current: number, target: number, maxDelta: number): number {
  if (target > current) return Math.min(target, current + maxDelta);
  return Math.max(target, current - maxDelta);
}

function stableSide(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2 === 0 ? -1 : 1;
}

function stateFor(session: object): NaturalMotionState {
  const existing = stateBySession.get(session);
  if (existing) return existing;
  const created: NaturalMotionState = {
    before: new Map(),
    cleanupSlots: new Map(),
    cleanupActive: false,
    cleanupElapsed: 0,
    minEnemyDistance: Number.POSITIVE_INFINITY,
    maxStepSpeed: 0,
    maxTurnRate: 0,
    constrainedEnemies: 0,
    emergencyBreakaways: 0,
  };
  stateBySession.set(session, created);
  return created;
}

/**
 * Final kinematic guard for non-boss aircraft.
 *
 * Older directors are still allowed to choose *where* an enemy wants to go,
 * but their post-step displacement is converted back into aircraft motion:
 * bounded turn rate, acceleration-limited forward speed and no sideways
 * teleport correction. Relative velocity is also projected several seconds
 * ahead so a fighter starts a fly-by before its flight path intersects the
 * player's camera bubble instead of reacting only after it is already close.
 * V40 cleanup holding slots remain owned by V40 until their release time; V41
 * takes over only once a survivor is actually released into the engagement.
 */
export function installSkyDancerFlightNaturalMotionV41(): void {
  const prototype = CartArenaSession.prototype as unknown as NaturalMotionSession & Record<string, unknown>;
  if (prototype[PATCHED_KEY]) return;
  prototype[PATCHED_KEY] = true;
  const previous = prototype.step;

  prototype.step = function skyDancerFlightNaturalMotionV41Step(
    this: NaturalMotionSession,
    input: RallyInputState,
    fixedDelta?: number,
  ): void {
    const key = this as unknown as object;
    const state = stateFor(key);
    const delta = clamp(fixedDelta ?? 1 / 60, 0.001, 0.05);
    const nodeIdBefore = this.location.node.id;

    for (const enemy of this.enemies) {
      if (!enemy.alive || enemy.kind === "boss" || enemy.nodeId !== nodeIdBefore) continue;
      const before = state.before.get(enemy.id);
      if (before) {
        before.x = enemy.x;
        before.z = enemy.z;
        before.heading = enemy.heading;
      } else {
        state.before.set(enemy.id, { x: enemy.x, z: enemy.z, heading: enemy.heading, speed: 16 });
      }
    }

    previous.call(this, input, fixedDelta);

    const director = getSkyDancerReengagementSnapshotV40(this as unknown as CartArenaSession);
    const cleanupPhase = director?.phase === "cleanup";
    if (cleanupPhase) {
      if (!state.cleanupActive) {
        state.cleanupSlots.clear();
        const ids = this.enemies
          .filter((enemy) => enemy.alive && enemy.kind !== "boss" && enemy.nodeId === this.location.node.id)
          .map((enemy) => enemy.id)
          .sort();
        ids.forEach((id, index) => state.cleanupSlots.set(id, index * SKY_DANCER_V40_CLEANUP_SLOT_DELAY));
      }
      state.cleanupActive = true;
      state.cleanupElapsed = Math.max(0, director?.cleanupElapsed ?? 0);
    } else {
      state.cleanupActive = false;
      state.cleanupElapsed = 0;
      state.cleanupSlots.clear();
    }

    const nodeId = this.location.node.id;
    const px = this.car.position.x;
    const pz = this.car.position.z;
    const playerHeading = this.car.heading;
    const forwardVelocity = Number.isFinite(this.car.forwardVelocity) ? this.car.forwardVelocity : 0;
    const lateralVelocity = Number.isFinite(this.car.lateralVelocity ?? 0) ? (this.car.lateralVelocity ?? 0) : 0;
    const playerSpeed = Math.hypot(forwardVelocity, lateralVelocity);
    const playerVelocityX = Math.sin(playerHeading) * forwardVelocity + Math.cos(playerHeading) * lateralVelocity;
    const playerVelocityZ = Math.cos(playerHeading) * forwardVelocity - Math.sin(playerHeading) * lateralVelocity;
    let minEnemyDistance = Number.POSITIVE_INFINITY;
    let maxStepSpeed = 0;
    let maxTurnRate = 0;
    let constrainedEnemies = 0;
    let emergencyBreakaways = 0;

    for (const enemy of this.enemies) {
      if (!enemy.alive || enemy.kind === "boss" || enemy.nodeId !== nodeId) continue;
      const before = state.before.get(enemy.id);
      if (!before) continue;

      const cleanupReadyAt = state.cleanupSlots.get(enemy.id);
      const cleanupHeld = cleanupPhase
        && cleanupReadyAt !== undefined
        && state.cleanupElapsed + 0.001 < cleanupReadyAt;
      if (cleanupHeld) {
        // V40 owns not-yet-released cleanup survivors and keeps them on a
        // bounded flank orbit. Do not convert that pacing correction into V41
        // forward motion or the held aircraft can drift outside lock range.
        before.x = enemy.x;
        before.z = enemy.z;
        before.heading = enemy.heading;
        before.speed = Math.min(before.speed, SKY_DANCER_V41_MAX_CLEANUP_SPEED);
        const heldX = cartTurboHuntWrappedDelta(enemy.x, px, CART_TURBO_HUNT_WORLD_WIDTH);
        const heldZ = cartTurboHuntWrappedDelta(enemy.z, pz, CART_TURBO_HUNT_WORLD_DEPTH);
        minEnemyDistance = Math.min(minEnemyDistance, Math.hypot(heldX, heldZ));
        continue;
      }

      const proposedDx = cartTurboHuntWrappedDelta(enemy.x, before.x, CART_TURBO_HUNT_WORLD_WIDTH);
      const proposedDz = cartTurboHuntWrappedDelta(enemy.z, before.z, CART_TURBO_HUNT_WORLD_DEPTH);
      const proposedDistance = Math.hypot(proposedDx, proposedDz);
      const proposedSpeed = proposedDistance / delta;
      let desiredHeading = proposedDistance > 0.0001
        ? Math.atan2(proposedDx, proposedDz)
        : enemy.heading;

      const fromPlayerX = cartTurboHuntWrappedDelta(before.x, px, CART_TURBO_HUNT_WORLD_WIDTH);
      const fromPlayerZ = cartTurboHuntWrappedDelta(before.z, pz, CART_TURBO_HUNT_WORLD_DEPTH);
      const distanceBefore = Math.max(0.001, Math.hypot(fromPlayerX, fromPlayerZ));
      const outwardHeading = Math.atan2(fromPlayerX, fromPlayerZ);
      const lockAngle = Math.abs(normalizeAngle(outwardHeading - playerHeading));
      const side = stableSide(enemy.id);

      const enemyVelocityX = Math.sin(before.heading) * before.speed;
      const enemyVelocityZ = Math.cos(before.heading) * before.speed;
      const relativeVelocityX = enemyVelocityX - playerVelocityX;
      const relativeVelocityZ = enemyVelocityZ - playerVelocityZ;
      const relativeSpeedSquared = relativeVelocityX * relativeVelocityX + relativeVelocityZ * relativeVelocityZ;
      const radialDot = fromPlayerX * relativeVelocityX + fromPlayerZ * relativeVelocityZ;
      const closingRate = -radialDot / distanceBefore;
      const closestTime = relativeSpeedSquared > 0.001
        ? clamp(-radialDot / relativeSpeedSquared, 0, SKY_DANCER_V41_PREDICTIVE_LOOKAHEAD)
        : 0;
      const closestX = fromPlayerX + relativeVelocityX * closestTime;
      const closestZ = fromPlayerZ + relativeVelocityZ * closestTime;
      const predictedMissDistance = Math.hypot(closestX, closestZ);
      const predictiveRisk = !cleanupPhase
        && distanceBefore < SKY_DANCER_V41_PREDICTIVE_DISTANCE
        && closingRate > PREDICTIVE_MIN_CLOSING_RATE
        && closestTime > 0.05
        && predictedMissDistance < SKY_DANCER_V41_PREDICTIVE_MISS_DISTANCE;

      const cleanupOrder = cleanupReadyAt !== undefined
        ? Math.max(0, Math.round(cleanupReadyAt / SKY_DANCER_V40_CLEANUP_SLOT_DELAY))
        : 0;
      const cleanupNeedsIntercept = cleanupPhase
        && (distanceBefore > SKY_DANCER_V40_CLEANUP_TRIGGER || lockAngle > SKY_DANCER_V40_CLEANUP_ANGLE_TRIGGER);

      let turnRate = SKY_DANCER_V41_MAX_TURN_RATE;
      let minSpeed = 9.5;
      let maxSpeed = proposedSpeed > SKY_DANCER_V41_MAX_CRUISE_SPEED
        ? SKY_DANCER_V41_MAX_CLEANUP_SPEED
        : SKY_DANCER_V41_MAX_CRUISE_SPEED;
      let acceleration = SKY_DANCER_V41_MAX_ACCELERATION;

      if (cleanupPhase && distanceBefore >= SKY_DANCER_V41_MIN_PASS_DISTANCE) {
        // Once V40 releases a cleanup survivor, guide it toward the same
        // forward lock-cone slot V40 intended, but get there only through
        // aircraft heading + acceleration. A temporary catch-up allowance is
        // required because the player's Turbo cruise can exceed the normal
        // 26 m/s cleanup cap; otherwise the last survivor can orbit forever.
        turnRate = SKY_DANCER_V41_EMERGENCY_TURN_RATE;
        if (cleanupNeedsIntercept) {
          const intercept = skyDancerReengagementInterceptV40(
            px,
            pz,
            playerHeading,
            enemy,
            true,
            cleanupOrder,
          );
          const interceptDx = cartTurboHuntWrappedDelta(intercept.x, before.x, CART_TURBO_HUNT_WORLD_WIDTH);
          const interceptDz = cartTurboHuntWrappedDelta(intercept.z, before.z, CART_TURBO_HUNT_WORLD_DEPTH);
          desiredHeading = Math.atan2(interceptDx, interceptDz);
          const catchupSpeed = clamp(
            playerSpeed + SKY_DANCER_V41_CLEANUP_CATCHUP_MARGIN,
            SKY_DANCER_V41_MAX_CLEANUP_SPEED,
            SKY_DANCER_V41_MAX_CLEANUP_INTERCEPT_SPEED,
          );
          minSpeed = catchupSpeed;
          maxSpeed = SKY_DANCER_V41_MAX_CLEANUP_INTERCEPT_SPEED;
          acceleration = SKY_DANCER_V41_EMERGENCY_ACCELERATION;
        } else {
          minSpeed = 12;
          maxSpeed = SKY_DANCER_V41_MAX_CLEANUP_SPEED;
        }
      } else if (distanceBefore < SKY_DANCER_V41_BREAKAWAY_DISTANCE || predictiveRisk) {
        const escapeFloor = clamp(
          playerSpeed + SKY_DANCER_V41_ESCAPE_SPEED_MARGIN,
          22,
          SKY_DANCER_V41_MAX_ESCAPE_SPEED - 1,
        );
        const avoidanceBias = distanceBefore < SKY_DANCER_V41_BREAKAWAY_DISTANCE ? 0.20 : 0.12;
        desiredHeading = normalizeAngle(outwardHeading + side * avoidanceBias);
        turnRate = SKY_DANCER_V41_EMERGENCY_TURN_RATE;
        minSpeed = Math.max(18, escapeFloor);
        maxSpeed = SKY_DANCER_V41_MAX_ESCAPE_SPEED;
        acceleration = SKY_DANCER_V41_EMERGENCY_ACCELERATION;
        emergencyBreakaways += 1;
      } else if (!cleanupPhase && distanceBefore < SKY_DANCER_V41_APPROACH_BUFFER) {
        desiredHeading = normalizeAngle(outwardHeading + side * 1.02);
        turnRate = SKY_DANCER_V41_EMERGENCY_TURN_RATE;
        minSpeed = 14;
      }

      const nextHeading = rotateToward(before.heading, desiredHeading, turnRate * delta);
      const headingDelta = Math.abs(normalizeAngle(nextHeading - before.heading));
      const observedTurnRate = headingDelta / delta;
      const targetSpeed = clamp(Number.isFinite(proposedSpeed) ? proposedSpeed : minSpeed, minSpeed, maxSpeed);
      let speed = moveToward(before.speed, targetSpeed, acceleration * delta);
      if (distanceBefore < SKY_DANCER_V41_MIN_PASS_DISTANCE) {
        const emergencyFloor = clamp(
          playerSpeed + SKY_DANCER_V41_ESCAPE_SPEED_MARGIN,
          22,
          SKY_DANCER_V41_MAX_ESCAPE_SPEED,
        );
        speed = moveToward(speed, emergencyFloor, SKY_DANCER_V41_EMERGENCY_ACCELERATION * delta);
      }
      before.speed = speed;

      enemy.heading = nextHeading;
      enemy.x = before.x + Math.sin(nextHeading) * speed * delta;
      enemy.z = before.z + Math.cos(nextHeading) * speed * delta;
      enemy.x = cartTurboHuntNearestCoordinate(enemy.x, px, CART_TURBO_HUNT_WORLD_WIDTH);
      enemy.z = cartTurboHuntNearestCoordinate(enemy.z, pz, CART_TURBO_HUNT_WORLD_DEPTH);

      const afterX = cartTurboHuntWrappedDelta(enemy.x, px, CART_TURBO_HUNT_WORLD_WIDTH);
      const afterZ = cartTurboHuntWrappedDelta(enemy.z, pz, CART_TURBO_HUNT_WORLD_DEPTH);
      minEnemyDistance = Math.min(minEnemyDistance, Math.hypot(afterX, afterZ));
      maxStepSpeed = Math.max(maxStepSpeed, speed);
      maxTurnRate = Math.max(maxTurnRate, observedTurnRate);
      if (Math.abs(proposedSpeed - speed) > 0.2 || headingDelta > 0.0001) constrainedEnemies += 1;
    }

    state.minEnemyDistance = minEnemyDistance;
    state.maxStepSpeed = maxStepSpeed;
    state.maxTurnRate = maxTurnRate;
    state.constrainedEnemies = constrainedEnemies;
    state.emergencyBreakaways = emergencyBreakaways;
    const snapshot: SkyDancerNaturalMotionSnapshotV41 = {
      minEnemyDistance: Number.isFinite(minEnemyDistance) ? minEnemyDistance : 0,
      maxStepSpeed,
      maxTurnRate,
      constrainedEnemies,
      emergencyBreakaways,
    };
    latestBySession.set(key, snapshot);
    if (typeof window !== "undefined" && navigator.webdriver) {
      (window as unknown as Record<string, unknown>)[GLOBAL_DEBUG_KEY] = () => ({ ...snapshot });
    }
  };
}

export function getSkyDancerNaturalMotionSnapshotV41(session: CartArenaSession): SkyDancerNaturalMotionSnapshotV41 | null {
  const snapshot = latestBySession.get(session as unknown as object);
  return snapshot ? { ...snapshot } : null;
}
