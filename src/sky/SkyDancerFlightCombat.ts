import type { RallyInputState } from "../rally/RallyTypes";
import { CartArenaSession } from "../cart/CartArenaSession";
import type { CartEnemyState } from "../cart/CartCombat";
import {
  CART_TURBO_HUNT_WORLD_DEPTH,
  CART_TURBO_HUNT_WORLD_WIDTH,
  cartTurboHuntNearestCoordinate,
  cartTurboHuntWrappedDelta,
} from "../cart/CartTurboHuntTrack";
import {
  CART_RAID_HAZARD_SNAPSHOT_EVENT,
  cancelCartRaidHazards,
  getCartRaidHazardState,
} from "../cart/CartRoguePhase88RaidHazards";
import {
  getSkyDancerEnemyVerticalSnapshotV43,
  skyDancerDistance3DV43,
  stepSkyDancerEnemyVerticalFlightV43,
} from "./SkyDancerVerticalFlightV43";

export interface SkyDancerMissileSnapshot {
  id: number;
  sourceEnemyId: string;
  sourceKind: CartEnemyState["kind"];
  x: number;
  z: number;
  altitudeOffsetMeters: number;
  heading: number;
  pitch: number;
  speed: number;
  life: number;
  maxLife: number;
  distanceToPlayer: number;
}

export interface SkyDancerMissileState {
  missiles: SkyDancerMissileSnapshot[];
  hitSerial: number;
  lastHitX: number;
  lastHitZ: number;
  lastHitSourceEnemyId: string | null;
  incomingCount: number;
}

interface MissileInternal extends SkyDancerMissileSnapshot {
  turnRate: number;
  pitchRate: number;
  maxSpeed: number;
  acceleration: number;
  damage: number;
  armedSeconds: number;
  active: boolean;
}

interface FlightEnemyMemory {
  clock: number;
  side: number;
  cooldown: number;
}

interface FlightCombatState {
  missiles: MissileInternal[];
  enemyMemory: Map<string, FlightEnemyMemory>;
  nextMissileId: number;
  hitSerial: number;
  hitCooldown: number;
  lastHitX: number;
  lastHitZ: number;
  lastHitSourceEnemyId: string | null;
  lastNodeId: string;
  broadcastClock: number;
  savedEnemySpeeds: number[];
}

interface FlightSessionView {
  enemies: CartEnemyState[];
  gas: number;
  rewardTimer: number;
  lastReward: string | null;
  location: {
    node: {
      id: string;
      rect: { centerX: number; centerZ: number; halfWidth: number; halfDepth: number };
    };
  };
  car: {
    position: { x: number; z: number };
    heading: number;
    forwardVelocity: number;
    lateralVelocity: number;
    collisionImpact: number;
    boostActive: boolean;
  };
  step(input: RallyInputState, fixedDelta?: number): void;
}

const PATCHED_KEY = "__skyDancerFlightCombatInstalled__";
const stateBySession = new WeakMap<object, FlightCombatState>();
let latestState: SkyDancerMissileState | null = null;

export const SKY_DANCER_MISSILE_EVENT = "sky-dancer-missile-snapshot";
export const SKY_DANCER_ALTITUDE_METERS = 150;
export const SKY_DANCER_MAX_ACTIVE_MISSILES = 8;
export const SKY_DANCER_V43_MISSILE_MAX_PITCH = 0.62;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function moveToward(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(target, current + maxDelta);
  if (current > target) return Math.max(target, current - maxDelta);
  return current;
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

function stableSide(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2 === 0 ? -1 : 1;
}

function initialCooldown(enemy: CartEnemyState): number {
  const base = enemy.kind === "boss" ? 1.1 : enemy.kind === "heavy" ? 1.75 : enemy.kind === "chaser" ? 2.15 : 2.55;
  return base + (Math.abs(enemy.id.length * 37) % 9) * 0.11;
}

function stateFor(session: FlightSessionView): FlightCombatState {
  const key = session as unknown as object;
  const existing = stateBySession.get(key);
  if (existing) return existing;
  const created: FlightCombatState = {
    missiles: [],
    enemyMemory: new Map(),
    nextMissileId: 1,
    hitSerial: 0,
    hitCooldown: 0,
    lastHitX: 0,
    lastHitZ: 0,
    lastHitSourceEnemyId: null,
    lastNodeId: session.location.node.id,
    broadcastClock: 0,
    savedEnemySpeeds: [],
  };
  stateBySession.set(key, created);
  return created;
}

function publicState(session: FlightSessionView, state: FlightCombatState): SkyDancerMissileState {
  const px = session.car.position.x;
  const pz = session.car.position.z;
  const missiles = state.missiles
    .filter((missile) => missile.active)
    .map((missile) => ({
      id: missile.id,
      sourceEnemyId: missile.sourceEnemyId,
      sourceKind: missile.sourceKind,
      x: missile.x,
      z: missile.z,
      altitudeOffsetMeters: missile.altitudeOffsetMeters,
      heading: missile.heading,
      pitch: missile.pitch,
      speed: missile.speed,
      life: missile.life,
      maxLife: missile.maxLife,
      distanceToPlayer: skyDancerDistance3DV43(
        missile.x,
        missile.altitudeOffsetMeters,
        missile.z,
        px,
        0,
        pz,
      ),
    }));
  return {
    missiles,
    hitSerial: state.hitSerial,
    lastHitX: state.lastHitX,
    lastHitZ: state.lastHitZ,
    lastHitSourceEnemyId: state.lastHitSourceEnemyId,
    incomingCount: missiles.filter((missile) => missile.distanceToPlayer < 16).length,
  };
}

function broadcast(session: FlightSessionView, state: FlightCombatState): void {
  const snapshot = publicState(session, state);
  latestState = snapshot;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<SkyDancerMissileState>(SKY_DANCER_MISSILE_EVENT, { detail: snapshot }));
  }
}

export function getSkyDancerMissileState(session: CartArenaSession): SkyDancerMissileState {
  const view = session as unknown as FlightSessionView;
  return publicState(view, stateFor(view));
}

export function getLatestSkyDancerMissileState(): SkyDancerMissileState | null {
  if (!latestState) return null;
  return { ...latestState, missiles: latestState.missiles.map((missile) => ({ ...missile })) };
}

function enemyCruiseSpeed(enemy: CartEnemyState): number {
  if (enemy.kind === "boss") return 10.4;
  if (enemy.kind === "heavy") return 8.8;
  if (enemy.archetype === "striker") return 13.2;
  if (enemy.archetype === "drifter") return 12.4;
  if (enemy.archetype === "orbiter") return 11.6;
  if (enemy.archetype === "bomber") return 10.8;
  return enemy.kind === "blocker" ? 10.2 : 11.4;
}

function enemyTurnRate(enemy: CartEnemyState): number {
  if (enemy.kind === "boss") return 0.82;
  if (enemy.kind === "heavy") return 0.92;
  if (enemy.archetype === "drifter") return 1.42;
  if (enemy.archetype === "striker") return 1.26;
  return 1.12;
}

function updateAircraftEnemies(session: FlightSessionView, delta: number, state: FlightCombatState): void {
  const nodeId = session.location.node.id;
  const bounds = session.location.node.rect;
  const px = session.car.position.x;
  const pz = session.car.position.z;
  const playerHeading = session.car.heading;

  for (const enemy of session.enemies) {
    if (!enemy.alive || enemy.nodeId !== nodeId) continue;
    let memory = state.enemyMemory.get(enemy.id);
    if (!memory) {
      memory = { clock: 0, side: stableSide(enemy.id), cooldown: initialCooldown(enemy) };
      state.enemyMemory.set(enemy.id, memory);
    }
    memory.clock += delta;
    memory.cooldown = Math.max(0, memory.cooldown - delta);

    const dx = px - enemy.x;
    const dz = pz - enemy.z;
    const distance = Math.max(0.001, Math.hypot(dx, dz));
    const direct = Math.atan2(dx, dz);
    const side = memory.side;

    // Aircraft never stop and pivot in place. They make attack passes, overshoot,
    // break away, then curve back into another intercept.
    let targetHeading = direct;
    if (distance < 7.5) {
      targetHeading = normalizeAngle(direct + side * (1.55 + Math.sin(memory.clock * 1.7) * 0.18));
    } else if (distance < 15) {
      targetHeading = normalizeAngle(direct + side * (0.42 + Math.sin(memory.clock * 1.35) * 0.24));
    } else {
      const lead = clamp(distance * 0.22, 2.5, 8.5);
      const targetX = px + Math.sin(playerHeading) * lead;
      const targetZ = pz + Math.cos(playerHeading) * lead;
      targetHeading = Math.atan2(targetX - enemy.x, targetZ - enemy.z);
      targetHeading = normalizeAngle(targetHeading + Math.sin(memory.clock * 0.82 + (side > 0 ? 0 : Math.PI)) * 0.16);
    }

    const edgeMargin = 6.5;
    const minX = bounds.centerX - bounds.halfWidth + edgeMargin;
    const maxX = bounds.centerX + bounds.halfWidth - edgeMargin;
    const minZ = bounds.centerZ - bounds.halfDepth + edgeMargin;
    const maxZ = bounds.centerZ + bounds.halfDepth - edgeMargin;
    if (enemy.x < minX || enemy.x > maxX || enemy.z < minZ || enemy.z > maxZ) {
      const centerHeading = Math.atan2(bounds.centerX - enemy.x, bounds.centerZ - enemy.z);
      targetHeading = normalizeAngle(centerHeading + side * 0.2);
    }

    enemy.heading = rotateToward(enemy.heading, targetHeading, enemyTurnRate(enemy) * delta);
    const attackBoost = distance > 10 && distance < 26 ? 1.12 : distance < 6 ? 1.18 : 1;
    const speed = enemyCruiseSpeed(enemy) * attackBoost;
    enemy.x += Math.sin(enemy.heading) * speed * delta;
    enemy.z += Math.cos(enemy.heading) * speed * delta;

    // Soft containment keeps the inherited arena graph intact without making
    // aircraft look like they hit an invisible wall.
    const hardMinX = bounds.centerX - bounds.halfWidth + 1.5;
    const hardMaxX = bounds.centerX + bounds.halfWidth - 1.5;
    const hardMinZ = bounds.centerZ - bounds.halfDepth + 1.5;
    const hardMaxZ = bounds.centerZ + bounds.halfDepth - 1.5;
    enemy.x = clamp(enemy.x, hardMinX, hardMaxX);
    enemy.z = clamp(enemy.z, hardMinZ, hardMaxZ);
  }
}

interface MissileSpecV43 {
  launchSpeed: number;
  maxSpeed: number;
  acceleration: number;
  turnRate: number;
  pitchRate: number;
  damage: number;
  cooldown: number;
}

function missileSpec(enemy: CartEnemyState): MissileSpecV43 {
  if (enemy.kind === "boss") return { launchSpeed: 19.5, maxSpeed: 29.5, acceleration: 18, turnRate: 1.72, pitchRate: 1.28, damage: 0.105, cooldown: 1.2 };
  if (enemy.kind === "heavy") return { launchSpeed: 17.5, maxSpeed: 25.5, acceleration: 15, turnRate: 1.48, pitchRate: 1.12, damage: 0.085, cooldown: 2.0 };
  if (enemy.archetype === "bomber") return { launchSpeed: 16.0, maxSpeed: 23.5, acceleration: 14, turnRate: 1.2, pitchRate: 0.98, damage: 0.078, cooldown: 2.15 };
  if (enemy.archetype === "striker") return { launchSpeed: 18.5, maxSpeed: 28.0, acceleration: 17, turnRate: 1.62, pitchRate: 1.22, damage: 0.068, cooldown: 2.35 };
  return { launchSpeed: 17.5, maxSpeed: 26.5, acceleration: 16, turnRate: 1.5, pitchRate: 1.16, damage: 0.062, cooldown: 2.7 };
}

function tryLaunchMissiles(session: FlightSessionView, state: FlightCombatState): void {
  if (state.missiles.filter((missile) => missile.active).length >= SKY_DANCER_MAX_ACTIVE_MISSILES) return;
  const nodeId = session.location.node.id;
  const px = session.car.position.x;
  const pz = session.car.position.z;

  for (const enemy of session.enemies) {
    if (!enemy.alive || enemy.nodeId !== nodeId) continue;
    const memory = state.enemyMemory.get(enemy.id);
    if (!memory || memory.cooldown > 0) continue;
    const vertical = getSkyDancerEnemyVerticalSnapshotV43(enemy);
    const dx = px - enemy.x;
    const dz = pz - enemy.z;
    const horizontalDistance = Math.hypot(dx, dz);
    const distance = skyDancerDistance3DV43(enemy.x, vertical.altitudeOffsetMeters, enemy.z, px, 0, pz);
    if (distance < 8 || distance > (enemy.kind === "boss" ? 52 : 43)) continue;
    const direct = Math.atan2(dx, dz);
    const aimError = Math.abs(normalizeAngle(direct - enemy.heading));
    if (aimError > (enemy.kind === "boss" ? 0.82 : 0.58)) continue;

    const spec = missileSpec(enemy);
    const muzzle = enemy.radius + 1.15;
    const desiredPitch = clamp(
      Math.atan2(-vertical.altitudeOffsetMeters, Math.max(0.001, horizontalDistance)),
      -SKY_DANCER_V43_MISSILE_MAX_PITCH,
      SKY_DANCER_V43_MISSILE_MAX_PITCH,
    );
    const missile: MissileInternal = {
      id: state.nextMissileId++,
      sourceEnemyId: enemy.id,
      sourceKind: enemy.kind,
      x: enemy.x + Math.sin(enemy.heading) * muzzle,
      z: enemy.z + Math.cos(enemy.heading) * muzzle,
      altitudeOffsetMeters: vertical.altitudeOffsetMeters,
      heading: enemy.heading,
      pitch: clamp(vertical.pitchRadians * 0.7 + desiredPitch * 0.3, -0.34, 0.34),
      speed: spec.launchSpeed,
      life: enemy.kind === "boss" ? 4.4 : 3.8,
      maxLife: enemy.kind === "boss" ? 4.4 : 3.8,
      distanceToPlayer: distance,
      turnRate: spec.turnRate,
      pitchRate: spec.pitchRate,
      maxSpeed: spec.maxSpeed,
      acceleration: spec.acceleration,
      damage: spec.damage,
      armedSeconds: 0,
      active: true,
    };
    state.missiles.push(missile);
    memory.cooldown = spec.cooldown + (Math.abs(enemy.id.length * 13) % 5) * 0.13;
    if (state.missiles.filter((candidate) => candidate.active).length >= SKY_DANCER_MAX_ACTIVE_MISSILES) break;
  }
}

function updateMissiles(session: FlightSessionView, delta: number, state: FlightCombatState): void {
  const px = session.car.position.x;
  const pz = session.car.position.z;
  state.hitCooldown = Math.max(0, state.hitCooldown - delta);

  for (const missile of state.missiles) {
    if (!missile.active) continue;
    missile.life -= delta;
    missile.armedSeconds += delta;
    if (missile.life <= 0) {
      missile.active = false;
      continue;
    }

    missile.x = cartTurboHuntNearestCoordinate(missile.x, px, CART_TURBO_HUNT_WORLD_WIDTH);
    missile.z = cartTurboHuntNearestCoordinate(missile.z, pz, CART_TURBO_HUNT_WORLD_DEPTH);
    const dx = px - missile.x;
    const dz = pz - missile.z;
    const horizontalDistance = Math.hypot(dx, dz);
    const distance = skyDancerDistance3DV43(missile.x, missile.altitudeOffsetMeters, missile.z, px, 0, pz);
    missile.distanceToPlayer = distance;

    const direct = Math.atan2(dx, dz);
    const desiredPitch = clamp(
      Math.atan2(-missile.altitudeOffsetMeters, Math.max(0.001, horizontalDistance)),
      -SKY_DANCER_V43_MISSILE_MAX_PITCH,
      SKY_DANCER_V43_MISSILE_MAX_PITCH,
    );
    // Real missiles do not instantly snap to the line of sight. Steering authority
    // builds after launch while thrust accelerates the body along its current axis.
    const authority = clamp(missile.armedSeconds / 0.42, 0.38, 1);
    missile.heading = rotateToward(missile.heading, direct, missile.turnRate * authority * delta);
    missile.pitch = moveToward(missile.pitch, desiredPitch, missile.pitchRate * authority * delta);
    missile.speed = moveToward(missile.speed, missile.maxSpeed, missile.acceleration * delta);

    const horizontalSpeed = Math.cos(missile.pitch) * missile.speed;
    missile.x += Math.sin(missile.heading) * horizontalSpeed * delta;
    missile.z += Math.cos(missile.heading) * horizontalSpeed * delta;
    missile.altitudeOffsetMeters += Math.sin(missile.pitch) * missile.speed * delta;

    const postDistance = skyDancerDistance3DV43(missile.x, missile.altitudeOffsetMeters, missile.z, px, 0, pz);
    missile.distanceToPlayer = postDistance;
    if (missile.armedSeconds > 0.2 && postDistance < 1.55) {
      missile.active = false;
      if (state.hitCooldown <= 0) {
        state.hitCooldown = 0.42;
        session.gas = Math.max(0, session.gas - missile.damage);
        session.car.forwardVelocity *= 0.72;
        session.car.lateralVelocity *= 0.74;
        session.car.collisionImpact = Math.max(session.car.collisionImpact, 1);
        session.lastReward = "MISSILE HIT · BREAK LOCK";
        session.rewardTimer = Math.max(session.rewardTimer, 1.35);
        state.hitSerial += 1;
        state.lastHitX = missile.x;
        state.lastHitZ = missile.z;
        state.lastHitSourceEnemyId = missile.sourceEnemyId;
      }
    }
  }

  if (state.missiles.length > 18) state.missiles = state.missiles.filter((missile) => missile.active);
}

function suppressAoe(session: CartArenaSession): void {
  const before = getCartRaidHazardState(session);
  if (before.activeCount <= 0) return;
  cancelCartRaidHazards(session);
  const cleared = getCartRaidHazardState(session);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CART_RAID_HAZARD_SNAPSHOT_EVENT, { detail: cleared }));
  }
}

export function installSkyDancerFlightCombat(): void {
  const prototype = CartArenaSession.prototype as unknown as FlightSessionView & Record<string, unknown>;
  if (prototype[PATCHED_KEY]) return;
  prototype[PATCHED_KEY] = true;
  const baseStep = prototype.step;

  prototype.step = function skyDancerFlightStep(input: RallyInputState, fixedDelta?: number): void {
    const session = this as unknown as FlightSessionView;
    const delta = Math.max(0.001, Math.min(0.05, fixedDelta ?? 1 / 60));
    const state = stateFor(session);

    // Neutralize the inherited ground-vehicle movement pass without touching
    // collision, progression, Turbo RAM, drops, boss HP or run flow.
    const savedSpeeds = state.savedEnemySpeeds;
    savedSpeeds.length = session.enemies.length;
    for (let index = 0; index < session.enemies.length; index += 1) {
      savedSpeeds[index] = session.enemies[index].moveSpeed;
      session.enemies[index].moveSpeed = 0;
    }
    suppressAoe(session as unknown as CartArenaSession);
    baseStep.call(this, input, fixedDelta);
    for (let index = 0; index < session.enemies.length; index += 1) {
      session.enemies[index].moveSpeed = savedSpeeds[index] ?? 0;
    }
    suppressAoe(session as unknown as CartArenaSession);

    if (state.lastNodeId !== session.location.node.id) {
      state.lastNodeId = session.location.node.id;
      for (const missile of state.missiles) missile.active = false;
    }

    updateAircraftEnemies(session, delta, state);
    stepSkyDancerEnemyVerticalFlightV43(session.enemies, {
      nodeId: session.location.node.id,
      playerX: session.car.position.x,
      playerZ: session.car.position.z,
      playerHeading: session.car.heading,
      playerSpeed: session.car.forwardVelocity,
      delta,
    });
    tryLaunchMissiles(session, state);
    updateMissiles(session, delta, state);

    state.broadcastClock += delta;
    if (state.broadcastClock >= 0.08) {
      state.broadcastClock = 0;
      broadcast(session, state);
    }
  };
}
