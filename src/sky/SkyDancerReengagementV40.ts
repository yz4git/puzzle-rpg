import type { CartEnemyState } from "../cart/CartCombat";
import { CartArenaSession } from "../cart/CartArenaSession";
import {
  CART_TURBO_HUNT_WORLD_DEPTH,
  CART_TURBO_HUNT_WORLD_WIDTH,
  cartTurboHuntNearestCoordinate,
} from "../cart/CartTurboHuntTrack";
import type { RallyInputState } from "../rally/RallyTypes";
import {
  isSkyDancerCombatTargetableV42,
  setSkyDancerCleanupHeldV42,
} from "./SkyDancerCombatEligibilityV42";
import { SKY_DANCER_PLAYER_MISSILE_LOCK_DISTANCE } from "./SkyDancerPlayerWeapons";
import { getSkyDancerStageCycleSnapshot } from "./SkyDancerStageCycle";

interface ReengagementSession {
  enemies: CartEnemyState[];
  location: { node: { id: string } };
  car: { position: { x: number; z: number }; heading: number };
  step(input: RallyInputState, fixedDelta?: number): void;
}

interface CleanupHoldOffset {
  x: number;
  z: number;
}

interface ReengagementState {
  cleanupElapsed: number;
  lastCleanupDuration: number;
  previousCleanup: boolean;
  cleanupSlots: Map<string, number>;
  cleanupHoldOffsets: Map<string, CleanupHoldOffset>;
}

export interface SkyDancerReengagementSnapshotV40 {
  phase: "reinforcements" | "cleanup" | "boss" | "stage-clear" | "unknown";
  correctedEnemies: number;
  maxEnemyDistance: number;
  maxLockAngle: number;
  lockConeCandidates: number;
  cleanupActive: boolean;
  cleanupElapsed: number;
  lastCleanupDuration: number;
  cleanupScheduledEnemies: number;
  cleanupHoldingEnemies: number;
}

const PATCHED_KEY = "__skyDancerReengagementV40Installed__";
const GLOBAL_DEBUG_KEY = "__skyDancerGetReengagementV40";
const latestBySession = new WeakMap<object, SkyDancerReengagementSnapshotV40>();
const stateBySession = new WeakMap<object, ReengagementState>();

export const SKY_DANCER_V40_LOCK_RANGE = SKY_DANCER_PLAYER_MISSILE_LOCK_DISTANCE;
export const SKY_DANCER_V40_LOCK_HALF_ANGLE = 0.78;
export const SKY_DANCER_V40_REENGAGE_TRIGGER = 53;
export const SKY_DANCER_V40_REENGAGE_TARGET = 43;
export const SKY_DANCER_V40_REENGAGE_ANGLE_TRIGGER = 0.72;
export const SKY_DANCER_V40_CLEANUP_TRIGGER = 49;
export const SKY_DANCER_V40_CLEANUP_TARGET = 39;
export const SKY_DANCER_V40_CLEANUP_ANGLE_TRIGGER = 0.62;
// V42 keeps the five-survivor cleanup cadence inside the intended 20-30 s
// window and leaves enough radial headroom for a held aircraft to follow a
// Turbo-speed player through a turn without crossing the 58 m lock envelope.
export const SKY_DANCER_V40_CLEANUP_SLOT_DELAY = 5.25;
export const SKY_DANCER_V40_CLEANUP_HOLD_ANGLE = 1.12;
export const SKY_DANCER_V40_CLEANUP_HOLD_DISTANCE = 40;
export const SKY_DANCER_V42_CLEANUP_HOLD_FOLLOW_SPEED = 40;
// The first released aircraft must be immediately reachable. The two-metre
// margin absorbs one inherited-AI step before the re-engagement correction.
export const SKY_DANCER_V42_CLEANUP_RELEASE_MAX_DISTANCE = 56;

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

function reengagementStateFor(session: object): ReengagementState {
  const existing = stateBySession.get(session);
  if (existing) return existing;
  const created: ReengagementState = {
    cleanupElapsed: 0,
    lastCleanupDuration: 0,
    previousCleanup: false,
    cleanupSlots: new Map<string, number>(),
    cleanupHoldOffsets: new Map<string, CleanupHoldOffset>(),
  };
  stateBySession.set(session, created);
  return created;
}

function enemySlotSeed(enemy: CartEnemyState): number {
  let seed = 0;
  for (let index = 0; index < enemy.id.length; index += 1) seed = (seed * 31 + enemy.id.charCodeAt(index)) | 0;
  return Math.abs(seed);
}

/**
 * Closing speed applied after the inherited flight AI has stepped.
 * Cleanup deliberately closes faster than the player's sustained cruise so a
 * survivor cannot sit outside the 58 m missile lock range for tens of seconds.
 */
export function skyDancerReengagementClosingSpeedV40(distance: number, cleanup: boolean): number {
  const target = cleanup ? SKY_DANCER_V40_CLEANUP_TARGET : SKY_DANCER_V40_REENGAGE_TARGET;
  const excess = Math.max(0, distance - target);
  return cleanup
    ? clamp(42 + excess * 1.05, 42, 60)
    : clamp(25 + excess * 0.72, 25, 44);
}

/** Returns a world-space intercept slot in the player's forward lock cone. */
export function skyDancerReengagementInterceptV40(
  px: number,
  pz: number,
  playerHeading: number,
  enemy: CartEnemyState,
  cleanup: boolean,
  order: number,
): { x: number; z: number } {
  const seed = enemySlotSeed(enemy);
  const sidePattern = [-1, 1, -0.52, 0.52, 0, -0.78, 0.78] as const;
  const side = sidePattern[(seed + order) % sidePattern.length];
  const forward = cleanup ? 31 + (order % 3) * 3.3 : 38 + (seed % 4) * 2.4;
  const lateral = side * (cleanup ? 9.5 + (order % 2) * 2.2 : 12.5 + (seed % 3) * 1.8);
  const sin = Math.sin(playerHeading);
  const cos = Math.cos(playerHeading);
  return {
    x: px + sin * forward + cos * lateral,
    z: pz + cos * forward - sin * lateral,
  };
}

/**
 * Returns the initial flank offset for a cleanup survivor. V42 stores this
 * offset once when cleanup starts. Later player yaw changes therefore move the
 * target across the screen naturally instead of rotating the enemy around the
 * camera and pinning it to a screen edge.
 */
export function skyDancerCleanupHoldingPositionV40(
  px: number,
  pz: number,
  playerHeading: number,
  slot: number,
): { x: number; z: number } {
  const side = slot % 2 === 0 ? 1 : -1;
  const angle = playerHeading + side * (SKY_DANCER_V40_CLEANUP_HOLD_ANGLE + (slot % 3) * 0.08);
  const distance = SKY_DANCER_V40_CLEANUP_HOLD_DISTANCE + (slot % 2) * 2;
  return {
    x: px + Math.sin(angle) * distance,
    z: pz + Math.cos(angle) * distance,
  };
}

function liveNonBossEnemies(session: ReengagementSession, nodeId: string): CartEnemyState[] {
  return session.enemies
    .filter((enemy) => enemy.alive && enemy.kind !== "boss" && enemy.nodeId === nodeId)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * V42.1 makes the first CLEANUP release the survivor that is already nearest
 * to the player. The other survivors can enter their holding slots while the
 * released aircraft keeps its existing bearing.
 */
export function skyDancerCleanupSlotOrderV42(
  enemies: readonly CartEnemyState[],
  px: number,
  pz: number,
): CartEnemyState[] {
  const distanceToPlayer = (enemy: CartEnemyState): number => {
    const ex = cartTurboHuntNearestCoordinate(enemy.x, px, CART_TURBO_HUNT_WORLD_WIDTH);
    const ez = cartTurboHuntNearestCoordinate(enemy.z, pz, CART_TURBO_HUNT_WORLD_DEPTH);
    return Math.hypot(ex - px, ez - pz);
  };
  return [...enemies].sort((a, b) => {
    const distanceDelta = distanceToPlayer(a) - distanceToPlayer(b);
    return Math.abs(distanceDelta) > 0.0001 ? distanceDelta : a.id.localeCompare(b.id);
  });
}

/**
 * At the CLEANUP handoff the closest survivor may still be just outside the
 * missile envelope because WAVE flight deliberately allows wider passes. Keep
 * its bearing and only pull the radius inward when necessary, rather than
 * snapping it to a camera-relative intercept slot.
 */
export function skyDancerCleanupReleasePositionV42(
  px: number,
  pz: number,
  enemyX: number,
  enemyZ: number,
): { x: number; z: number } {
  const x = cartTurboHuntNearestCoordinate(enemyX, px, CART_TURBO_HUNT_WORLD_WIDTH);
  const z = cartTurboHuntNearestCoordinate(enemyZ, pz, CART_TURBO_HUNT_WORLD_DEPTH);
  const dx = x - px;
  const dz = z - pz;
  const distance = Math.hypot(dx, dz);
  if (distance <= SKY_DANCER_V42_CLEANUP_RELEASE_MAX_DISTANCE || distance < 0.001) return { x, z };
  const scale = SKY_DANCER_V42_CLEANUP_RELEASE_MAX_DISTANCE / distance;
  return { x: px + dx * scale, z: pz + dz * scale };
}

export function installSkyDancerReengagementV40(): void {
  const prototype = CartArenaSession.prototype as unknown as ReengagementSession & Record<string, unknown>;
  if (prototype[PATCHED_KEY]) return;
  prototype[PATCHED_KEY] = true;
  const previous = prototype.step;

  prototype.step = function skyDancerReengagementV40Step(
    this: ReengagementSession,
    input: RallyInputState,
    fixedDelta?: number,
  ): void {
    previous.call(this, input, fixedDelta);
    const concrete = this as unknown as CartArenaSession;
    const stage = getSkyDancerStageCycleSnapshot(concrete);
    const phase = stage?.phase ?? "unknown";
    const cleanup = phase === "cleanup";
    const delta = clamp(fixedDelta ?? 1 / 60, 0.001, 0.05);
    const localState = reengagementStateFor(this as unknown as object);
    const px = this.car.position.x;
    const pz = this.car.position.z;
    const playerHeading = this.car.heading;
    const nodeId = this.location.node.id;

    if (cleanup && !localState.previousCleanup) {
      localState.cleanupElapsed = 0;
      localState.lastCleanupDuration = 0;
      localState.cleanupSlots.clear();
      localState.cleanupHoldOffsets.clear();
      const initialSurvivors = skyDancerCleanupSlotOrderV42(liveNonBossEnemies(this, nodeId), px, pz);
      initialSurvivors.forEach((enemy, index) => {
        localState.cleanupSlots.set(enemy.id, index);
        const hold = skyDancerCleanupHoldingPositionV40(px, pz, playerHeading, index);
        localState.cleanupHoldOffsets.set(enemy.id, { x: hold.x - px, z: hold.z - pz });
        setSkyDancerCleanupHeldV42(enemy, index > 0);
        if (index <= 0) {
          const release = skyDancerCleanupReleasePositionV42(px, pz, enemy.x, enemy.z);
          enemy.x = release.x;
          enemy.z = release.z;
          return;
        }
        enemy.x = cartTurboHuntNearestCoordinate(hold.x, px, CART_TURBO_HUNT_WORLD_WIDTH);
        enemy.z = cartTurboHuntNearestCoordinate(hold.z, pz, CART_TURBO_HUNT_WORLD_DEPTH);
        const offset = localState.cleanupHoldOffsets.get(enemy.id)!;
        const radial = Math.atan2(offset.x, offset.z);
        const side = index % 2 === 0 ? 1 : -1;
        enemy.heading = normalizeAngle(radial + side * Math.PI * 0.5);
      });
    } else if (cleanup) {
      localState.cleanupElapsed += delta;
    } else if (localState.previousCleanup) {
      localState.lastCleanupDuration = localState.cleanupElapsed;
      localState.cleanupElapsed = 0;
      localState.cleanupHoldOffsets.clear();
      for (const enemy of this.enemies) setSkyDancerCleanupHeldV42(enemy, false);
    }
    localState.previousCleanup = cleanup;

    const trigger = cleanup ? SKY_DANCER_V40_CLEANUP_TRIGGER : SKY_DANCER_V40_REENGAGE_TRIGGER;
    const target = cleanup ? SKY_DANCER_V40_CLEANUP_TARGET : SKY_DANCER_V40_REENGAGE_TARGET;
    const angleTrigger = cleanup ? SKY_DANCER_V40_CLEANUP_ANGLE_TRIGGER : SKY_DANCER_V40_REENGAGE_ANGLE_TRIGGER;
    let correctedEnemies = 0;
    let maxEnemyDistance = 0;
    let maxLockAngle = 0;
    let lockConeCandidates = 0;
    let cleanupHoldingEnemies = 0;

    if (phase !== "boss" && phase !== "stage-clear") {
      const live = liveNonBossEnemies(this, nodeId);
      for (let order = 0; order < live.length; order += 1) {
        const enemy = live[order];
        enemy.x = cartTurboHuntNearestCoordinate(enemy.x, px, CART_TURBO_HUNT_WORLD_WIDTH);
        enemy.z = cartTurboHuntNearestCoordinate(enemy.z, pz, CART_TURBO_HUNT_WORLD_DEPTH);

        const cleanupSlot = localState.cleanupSlots.get(enemy.id) ?? order;
        const cleanupSlotReady = !cleanup || localState.cleanupElapsed >= cleanupSlot * SKY_DANCER_V40_CLEANUP_SLOT_DELAY;
        setSkyDancerCleanupHeldV42(enemy, cleanup && !cleanupSlotReady);

        // V42.3: once a CLEANUP slot is live, keep only its radial distance
        // inside the missile envelope. This preserves the aircraft's world
        // bearing and therefore avoids the old camera-edge stickiness while
        // preventing inherited AI from expanding a released target beyond
        // lock range on the very next fixed step.
        if (cleanup && cleanupSlotReady) {
          const leashed = skyDancerCleanupReleasePositionV42(px, pz, enemy.x, enemy.z);
          if (Math.abs(leashed.x - enemy.x) > 0.001 || Math.abs(leashed.z - enemy.z) > 0.001) {
            enemy.x = leashed.x;
            enemy.z = leashed.z;
            correctedEnemies += 1;
          }
        }

        let fromPlayerX = enemy.x - px;
        let fromPlayerZ = enemy.z - pz;
        let distance = Math.hypot(fromPlayerX, fromPlayerZ);
        let targetHeadingFromPlayer = Math.atan2(fromPlayerX, fromPlayerZ);
        let lockAngle = Math.abs(normalizeAngle(targetHeadingFromPlayer - playerHeading));

        if (cleanup && !cleanupSlotReady) {
          cleanupHoldingEnemies += 1;
          const fallback = skyDancerCleanupHoldingPositionV40(px, pz, playerHeading, cleanupSlot);
          const offset = localState.cleanupHoldOffsets.get(enemy.id)
            ?? { x: fallback.x - px, z: fallback.z - pz };
          if (!localState.cleanupHoldOffsets.has(enemy.id)) localState.cleanupHoldOffsets.set(enemy.id, offset);
          const holdX = px + offset.x;
          const holdZ = pz + offset.z;
          const correctionX = holdX - enemy.x;
          const correctionZ = holdZ - enemy.z;
          const correctionDistance = Math.hypot(correctionX, correctionZ);
          if (correctionDistance > 0.001) {
            const correction = Math.min(correctionDistance, SKY_DANCER_V42_CLEANUP_HOLD_FOLLOW_SPEED * delta);
            enemy.x += correctionX / correctionDistance * correction;
            enemy.z += correctionZ / correctionDistance * correction;
            correctedEnemies += 1;
          }
          const radial = Math.atan2(offset.x, offset.z);
          const side = cleanupSlot % 2 === 0 ? 1 : -1;
          const tangentHeading = normalizeAngle(radial + side * Math.PI * 0.5);
          enemy.heading = rotateToward(enemy.heading, tangentHeading, 1.12 * delta);

          // Held formation aircraft are deliberately not weapon targets, so
          // exclude them from lock-envelope diagnostics. cleanupHoldingEnemies
          // tracks their presence separately until the scheduled slot release.
          continue;
        }

        const needsDistanceCorrection = distance > trigger;
        // V42: during normal WAVE flight, an angle-only correction made enemies
        // chase the player's live yaw and sit at the edge of the camera. Keep
        // angular re-engagement for CLEANUP pacing, but in normal combat only
        // use the player-relative intercept when the aircraft is also too far
        // away. Inside the range envelope, V41 owns natural turn/acceleration.
        const needsAngleCorrection = cleanup
          ? lockAngle > angleTrigger
          : needsDistanceCorrection && lockAngle > angleTrigger;

        if (needsDistanceCorrection || needsAngleCorrection) {
          let destinationX: number;
          let destinationZ: number;
          if (needsAngleCorrection) {
            const intercept = skyDancerReengagementInterceptV40(px, pz, playerHeading, enemy, cleanup, cleanupSlot);
            destinationX = intercept.x;
            destinationZ = intercept.z;
          } else {
            const inv = distance > 0.001 ? 1 / distance : 0;
            destinationX = px + fromPlayerX * inv * target;
            destinationZ = pz + fromPlayerZ * inv * target;
          }

          const correctionX = destinationX - enemy.x;
          const correctionZ = destinationZ - enemy.z;
          const correctionDistance = Math.hypot(correctionX, correctionZ);
          if (correctionDistance > 0.001) {
            const closingSpeed = skyDancerReengagementClosingSpeedV40(Math.max(distance, correctionDistance), cleanup);
            const correction = Math.min(correctionDistance, closingSpeed * delta);
            enemy.x += correctionX / correctionDistance * correction;
            enemy.z += correctionZ / correctionDistance * correction;
            const desiredHeading = Math.atan2(px - enemy.x, pz - enemy.z);
            enemy.heading = rotateToward(enemy.heading, desiredHeading, (cleanup ? 3.4 : 2.35) * delta);
            correctedEnemies += 1;
          }
        }

        // Snapshot the post-correction position. This is the actual state that
        // weapon targeting sees after the fixed step, not the inherited AI's
        // transient pre-correction distance.
        fromPlayerX = enemy.x - px;
        fromPlayerZ = enemy.z - pz;
        distance = Math.hypot(fromPlayerX, fromPlayerZ);
        targetHeadingFromPlayer = Math.atan2(fromPlayerX, fromPlayerZ);
        lockAngle = Math.abs(normalizeAngle(targetHeadingFromPlayer - playerHeading));
        maxEnemyDistance = Math.max(maxEnemyDistance, distance);
        maxLockAngle = Math.max(maxLockAngle, lockAngle);
        if (
          isSkyDancerCombatTargetableV42(enemy)
          && distance <= SKY_DANCER_V40_LOCK_RANGE
          && lockAngle <= SKY_DANCER_V40_LOCK_HALF_ANGLE
        ) lockConeCandidates += 1;
      }
    }

    const snapshot: SkyDancerReengagementSnapshotV40 = {
      phase,
      correctedEnemies,
      maxEnemyDistance,
      maxLockAngle,
      lockConeCandidates,
      cleanupActive: cleanup,
      cleanupElapsed: localState.cleanupElapsed,
      lastCleanupDuration: localState.lastCleanupDuration,
      cleanupScheduledEnemies: localState.cleanupSlots.size,
      cleanupHoldingEnemies,
    };
    latestBySession.set(this as unknown as object, snapshot);
    if (typeof window !== "undefined" && navigator.webdriver) {
      (window as unknown as Record<string, unknown>)[GLOBAL_DEBUG_KEY] = () => ({ ...snapshot });
    }
  };
}

export function getSkyDancerReengagementSnapshotV40(session: CartArenaSession): SkyDancerReengagementSnapshotV40 | null {
  const current = latestBySession.get(session as unknown as object);
  return current ? { ...current } : null;
}
