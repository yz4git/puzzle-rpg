import type { CartEnemyState } from "../cart/CartCombat";
import { CartArenaSession } from "../cart/CartArenaSession";
import {
  CART_TURBO_HUNT_WORLD_DEPTH,
  CART_TURBO_HUNT_WORLD_WIDTH,
  cartTurboHuntNearestCoordinate,
} from "../cart/CartTurboHuntTrack";
import { isSkyDancerCombatTargetableV42 } from "./SkyDancerCombatEligibilityV42";
import {
  getSkyDancerEnemyAltitudeMetersV43,
  skyDancerDistance3DV43,
} from "./SkyDancerVerticalFlightV43";

export interface SkyDancerPlayerMissileSnapshot {
  id: number;
  x: number;
  z: number;
  altitudeOffsetMeters: number;
  heading: number;
  pitch: number;
  speed: number;
  life: number;
  maxLife: number;
  targetEnemyId: string | null;
  distanceToTarget: number;
}

export interface SkyDancerPlayerWeaponState {
  missiles: SkyDancerPlayerMissileSnapshot[];
  cooldownSeconds: number;
  shotSerial: number;
  hitSerial: number;
  lastHitEnemyId: string | null;
  lastHitX: number;
  lastHitZ: number;
}

interface PlayerMissileInternal extends SkyDancerPlayerMissileSnapshot {
  turnRate: number;
  pitchRate: number;
  maxSpeed: number;
  acceleration: number;
  ageSeconds: number;
  damage: number;
  active: boolean;
}

interface WeaponState {
  missiles: PlayerMissileInternal[];
  nextMissileId: number;
  cooldownSeconds: number;
  requestedShots: number;
  shotSerial: number;
  hitSerial: number;
  lastHitEnemyId: string | null;
  lastHitX: number;
  lastHitZ: number;
  lastClockMs: number;
}

interface WeaponSessionView {
  enemies: CartEnemyState[];
  rewardTimer: number;
  lastReward: string | null;
  location: { node: { id: string } };
  car: {
    position: { x: number; z: number };
    heading: number;
    forwardVelocity: number;
    collisionImpact: number;
    ramCount: number;
  };
}

const INSTALLED_KEY = "__skyDancerPlayerWeaponsInstalled__";
const stateBySession = new WeakMap<object, WeaponState>();
export const SKY_DANCER_PLAYER_MISSILE_COOLDOWN = 0.34;
export const SKY_DANCER_PLAYER_MISSILE_MAX_ACTIVE = 5;
export const SKY_DANCER_PLAYER_MISSILE_LOCK_DISTANCE = 58;
export const SKY_DANCER_PLAYER_MISSILE_MAX_PITCH_V43 = 0.68;

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

function weaponNowMs(): number {
  if (typeof performance !== "undefined" && Number.isFinite(performance.now())) return performance.now();
  return Date.now();
}

function stateFor(session: WeaponSessionView): WeaponState {
  const key = session as unknown as object;
  const current = stateBySession.get(key);
  if (current) return current;
  const created: WeaponState = {
    missiles: [],
    nextMissileId: 10001,
    cooldownSeconds: 0,
    requestedShots: 0,
    shotSerial: 0,
    hitSerial: 0,
    lastHitEnemyId: null,
    lastHitX: 0,
    lastHitZ: 0,
    lastClockMs: weaponNowMs(),
  };
  stateBySession.set(key, created);
  return created;
}

function currentEnemies(session: WeaponSessionView): CartEnemyState[] {
  const nodeId = session.location.node.id;
  return session.enemies.filter(
    (enemy) => enemy.alive && enemy.nodeId === nodeId && isSkyDancerCombatTargetableV42(enemy),
  );
}

function missileDamage(enemy: CartEnemyState | null): number {
  if (!enemy) return 38;
  if (enemy.kind === "boss") return 24;
  if (enemy.kind === "heavy") return 30;
  // Standard fighters are intentionally one-shot missile targets.
  return Math.max(enemy.maxHp, enemy.hp, 1);
}

function chooseTarget(session: WeaponSessionView): CartEnemyState | null {
  const px = session.car.position.x;
  const pz = session.car.position.z;
  const heading = session.car.heading;
  let best: CartEnemyState | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const enemy of currentEnemies(session)) {
    const dx = enemy.x - px;
    const dz = enemy.z - pz;
    const altitude = getSkyDancerEnemyAltitudeMetersV43(enemy);
    const distance = skyDancerDistance3DV43(px, 0, pz, enemy.x, altitude, enemy.z);
    if (distance > SKY_DANCER_PLAYER_MISSILE_LOCK_DISTANCE) continue;
    // V43 keeps lock acquisition simple on touch controls: the horizontal cone
    // is unchanged while the seeker handles altitude after launch.
    const targetHeading = Math.atan2(dx, dz);
    const angle = Math.abs(normalizeAngle(targetHeading - heading));
    if (angle > 0.78) continue;
    const verticalPenalty = Math.abs(altitude) * 0.12;
    const score = distance + angle * 18 + verticalPenalty - (enemy.kind === "boss" ? 3.5 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = enemy;
    }
  }
  return best;
}

function launchRequestedShot(session: WeaponSessionView, state: WeaponState): boolean {
  if (state.requestedShots <= 0 || state.cooldownSeconds > 0) return false;
  if (state.missiles.filter((missile) => missile.active).length >= SKY_DANCER_PLAYER_MISSILE_MAX_ACTIVE) return false;
  state.requestedShots -= 1;
  state.cooldownSeconds = SKY_DANCER_PLAYER_MISSILE_COOLDOWN;
  const target = chooseTarget(session);
  const heading = session.car.heading;
  const muzzle = 2.6;
  const launchSpeed = 24 + Math.min(4.5, Math.abs(session.car.forwardVelocity) * 0.14);
  const targetAltitude = target ? getSkyDancerEnemyAltitudeMetersV43(target) : 0;
  const horizontalDistance = target
    ? Math.hypot(target.x - session.car.position.x, target.z - session.car.position.z)
    : Number.POSITIVE_INFINITY;
  const initialPitch = target
    ? clamp(Math.atan2(targetAltitude, Math.max(8, horizontalDistance)) * 0.28, -0.18, 0.18)
    : 0;
  const missile: PlayerMissileInternal = {
    id: state.nextMissileId++,
    x: session.car.position.x + Math.sin(heading) * muzzle,
    z: session.car.position.z + Math.cos(heading) * muzzle,
    altitudeOffsetMeters: 0,
    heading,
    pitch: initialPitch,
    speed: launchSpeed,
    life: 4.6,
    maxLife: 4.6,
    targetEnemyId: target?.id ?? null,
    distanceToTarget: target
      ? skyDancerDistance3DV43(session.car.position.x, 0, session.car.position.z, target.x, targetAltitude, target.z)
      : Number.POSITIVE_INFINITY,
    turnRate: target ? 2.25 : 0,
    pitchRate: target ? 1.72 : 0,
    maxSpeed: 42.5,
    acceleration: 27,
    ageSeconds: 0,
    damage: missileDamage(target),
    active: true,
  };
  state.missiles.push(missile);
  state.shotSerial += 1;
  state.lastClockMs = weaponNowMs();
  session.lastReward = target ? "FOX TWO · 3D LOCK" : "FOX TWO";
  session.rewardTimer = Math.max(session.rewardTimer, 0.7);
  return true;
}

export function pointSegmentDistanceSquared3DV43(
  px: number,
  py: number,
  pz: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const lengthSq = abx * abx + aby * aby + abz * abz;
  if (lengthSq < 0.000001) return (px - ax) ** 2 + (py - ay) ** 2 + (pz - az) ** 2;
  const t = clamp(((px - ax) * abx + (py - ay) * aby + (pz - az) * abz) / lengthSq, 0, 1);
  const x = ax + abx * t;
  const y = ay + aby * t;
  const z = az + abz * t;
  return (px - x) ** 2 + (py - y) ** 2 + (pz - z) ** 2;
}

function chooseTargetFromMissile(missile: PlayerMissileInternal, enemies: readonly CartEnemyState[]): CartEnemyState | null {
  let best: CartEnemyState | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const enemy of enemies) {
    const dx = enemy.x - missile.x;
    const dz = enemy.z - missile.z;
    const altitude = getSkyDancerEnemyAltitudeMetersV43(enemy);
    const distance = skyDancerDistance3DV43(
      missile.x,
      missile.altitudeOffsetMeters,
      missile.z,
      enemy.x,
      altitude,
      enemy.z,
    );
    if (distance > 46) continue;
    const angle = Math.abs(normalizeAngle(Math.atan2(dx, dz) - missile.heading));
    if (angle > 0.98) continue;
    const score = distance + angle * 11;
    if (score < bestScore) {
      best = enemy;
      bestScore = score;
    }
  }
  return best;
}

function updateMissiles(session: WeaponSessionView, state: WeaponState, delta: number): void {
  // Held CLEANUP aircraft are deliberately omitted here as well as from the
  // initial lock query. Existing missiles therefore cannot accidentally hit a
  // formation aircraft after the phase transition and collapse the slot timer.
  const enemies = currentEnemies(session);
  for (const missile of state.missiles) {
    if (!missile.active) continue;
    missile.life -= delta;
    missile.ageSeconds += delta;
    if (missile.life <= 0) {
      missile.active = false;
      continue;
    }

    let target = missile.targetEnemyId ? enemies.find((enemy) => enemy.id === missile.targetEnemyId) ?? null : null;
    if (!target) {
      target = chooseTargetFromMissile(missile, enemies);
      missile.targetEnemyId = target?.id ?? null;
      missile.turnRate = target ? 2.15 : 0;
      missile.pitchRate = target ? 1.65 : 0;
      if (target) missile.damage = missileDamage(target);
    }

    if (target) {
      missile.x = cartTurboHuntNearestCoordinate(missile.x, target.x, CART_TURBO_HUNT_WORLD_WIDTH);
      missile.z = cartTurboHuntNearestCoordinate(missile.z, target.z, CART_TURBO_HUNT_WORLD_DEPTH);
      const dx = target.x - missile.x;
      const dz = target.z - missile.z;
      const targetAltitude = getSkyDancerEnemyAltitudeMetersV43(target);
      const horizontalDistance = Math.hypot(dx, dz);
      missile.distanceToTarget = skyDancerDistance3DV43(
        missile.x,
        missile.altitudeOffsetMeters,
        missile.z,
        target.x,
        targetAltitude,
        target.z,
      );
      const desiredPitch = clamp(
        Math.atan2(targetAltitude - missile.altitudeOffsetMeters, Math.max(0.001, horizontalDistance)),
        -SKY_DANCER_PLAYER_MISSILE_MAX_PITCH_V43,
        SKY_DANCER_PLAYER_MISSILE_MAX_PITCH_V43,
      );
      const authority = clamp(missile.ageSeconds / 0.34, 0.36, 1);
      missile.heading = rotateToward(missile.heading, Math.atan2(dx, dz), missile.turnRate * authority * delta);
      missile.pitch = moveToward(missile.pitch, desiredPitch, missile.pitchRate * authority * delta);
    } else {
      missile.x = cartTurboHuntNearestCoordinate(
        missile.x,
        session.car.position.x,
        CART_TURBO_HUNT_WORLD_WIDTH,
      );
      missile.z = cartTurboHuntNearestCoordinate(
        missile.z,
        session.car.position.z,
        CART_TURBO_HUNT_WORLD_DEPTH,
      );
      missile.distanceToTarget = Number.POSITIVE_INFINITY;
      missile.pitch = moveToward(missile.pitch, 0, 0.65 * delta);
    }

    missile.speed = moveToward(missile.speed, missile.maxSpeed, missile.acceleration * delta);
    const oldX = missile.x;
    const oldY = missile.altitudeOffsetMeters;
    const oldZ = missile.z;
    const horizontalSpeed = Math.cos(missile.pitch) * missile.speed;
    missile.x += Math.sin(missile.heading) * horizontalSpeed * delta;
    missile.z += Math.cos(missile.heading) * horizontalSpeed * delta;
    missile.altitudeOffsetMeters += Math.sin(missile.pitch) * missile.speed * delta;

    let hit: CartEnemyState | null = null;
    let bestDistanceSq = Number.POSITIVE_INFINITY;
    for (const enemy of enemies) {
      const radius = enemy.radius + 0.52;
      const altitude = getSkyDancerEnemyAltitudeMetersV43(enemy);
      const distanceSq = pointSegmentDistanceSquared3DV43(
        enemy.x,
        altitude,
        enemy.z,
        oldX,
        oldY,
        oldZ,
        missile.x,
        missile.altitudeOffsetMeters,
        missile.z,
      );
      if (distanceSq <= radius * radius && distanceSq < bestDistanceSq) {
        hit = enemy;
        bestDistanceSq = distanceSq;
      }
    }
    if (!hit) continue;

    missile.active = false;
    const damage = missileDamage(hit);
    hit.hp = Math.max(0, hit.hp - damage);
    const destroyed = hit.hp <= 0;
    hit.alive = !destroyed;
    if (destroyed) session.car.ramCount += 1;
    session.car.collisionImpact = Math.max(session.car.collisionImpact, destroyed ? 1 : 0.72);
    session.lastReward = destroyed ? "MISSILE SPLASH · TARGET DOWN" : `MISSILE HIT · ${Math.ceil(hit.hp)} HP`;
    session.rewardTimer = Math.max(session.rewardTimer, destroyed ? 1.45 : 1.0);
    state.hitSerial += 1;
    state.lastHitEnemyId = hit.id;
    state.lastHitX = missile.x;
    state.lastHitZ = missile.z;
  }

  if (state.missiles.length > 20) state.missiles = state.missiles.filter((missile) => missile.active);
}

function advanceFromClock(session: WeaponSessionView, state: WeaponState): void {
  const now = weaponNowMs();
  const elapsed = clamp((now - state.lastClockMs) / 1000, 0, 0.05);
  state.lastClockMs = now;
  if (elapsed < 0.001) return;
  state.cooldownSeconds = Math.max(0, state.cooldownSeconds - elapsed);
  updateMissiles(session, state, elapsed);
}

export function requestSkyDancerPlayerMissile(session: CartArenaSession): boolean {
  installSkyDancerPlayerWeapons();
  const view = session as unknown as WeaponSessionView;
  const state = stateFor(view);
  advanceFromClock(view, state);
  if (state.cooldownSeconds > 0 || state.missiles.filter((missile) => missile.active).length >= SKY_DANCER_PLAYER_MISSILE_MAX_ACTIVE) return false;
  state.requestedShots = 1;
  return launchRequestedShot(view, state);
}

/** Explicit fixed-step path. The wall-clock path in getState is a fail-safe for renderer/prototype ordering. */
export function stepSkyDancerPlayerWeapons(session: CartArenaSession, fixedDelta = 1 / 60): void {
  const view = session as unknown as WeaponSessionView;
  const state = stateFor(view);
  const delta = Math.max(0.001, Math.min(0.05, fixedDelta));
  state.cooldownSeconds = Math.max(0, state.cooldownSeconds - delta);
  updateMissiles(view, state, delta);
  state.lastClockMs = weaponNowMs();
}

export function getSkyDancerPlayerWeaponState(session: CartArenaSession): SkyDancerPlayerWeaponState {
  const view = session as unknown as WeaponSessionView;
  const state = stateFor(view);
  advanceFromClock(view, state);
  return {
    missiles: state.missiles.filter((missile) => missile.active).map((missile) => ({
      id: missile.id,
      x: missile.x,
      z: missile.z,
      altitudeOffsetMeters: missile.altitudeOffsetMeters,
      heading: missile.heading,
      pitch: missile.pitch,
      speed: missile.speed,
      life: missile.life,
      maxLife: missile.maxLife,
      targetEnemyId: missile.targetEnemyId,
      distanceToTarget: missile.distanceToTarget,
    })),
    cooldownSeconds: state.cooldownSeconds,
    shotSerial: state.shotSerial,
    hitSerial: state.hitSerial,
    lastHitEnemyId: state.lastHitEnemyId,
    lastHitX: state.lastHitX,
    lastHitZ: state.lastHitZ,
  };
}

export function installSkyDancerPlayerWeapons(): void {
  const prototype = CartArenaSession.prototype as unknown as Record<string, unknown>;
  if (prototype[INSTALLED_KEY]) return;
  prototype[INSTALLED_KEY] = true;
}

installSkyDancerPlayerWeapons();
