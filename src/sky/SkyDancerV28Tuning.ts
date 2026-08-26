import type { RallyInputState } from "../rally/RallyTypes";
import { CartArenaSession } from "../cart/CartArenaSession";
import type { CartEnemyState } from "../cart/CartCombat";
import { isCartTurboHuntEnabled } from "../cart/CartRoguePhase67TurboHunt";

interface V28Session {
  enemies: CartEnemyState[];
  step(input: RallyInputState, fixedDelta?: number): void;
}

interface PositionSample {
  x: number;
  z: number;
}

interface V28TuningState {
  readonly beforePositions: Map<string, PositionSample>;
  bossWasAlive: boolean;
}

const PATCHED_KEY = "__skyDancerV28TuningInstalled__";
const stateBySession = new WeakMap<object, V28TuningState>();
const MAX_CONTINUOUS_STEP_DISTANCE_SQ = 64;

export const SKY_DANCER_V28_ALTITUDE_METERS = 200;
export const SKY_DANCER_V28_ALTITUDE_LIFT_METERS = 50;
export const SKY_DANCER_V28_GRUNT_SPEED_MULTIPLIER = 1.2;
export const SKY_DANCER_V28_BOSS_SPEED_MULTIPLIER = 1.5;
export const SKY_DANCER_V28_BOSS_HP_MULTIPLIER = 0.1;

function stateFor(session: V28Session): V28TuningState {
  const key = session as unknown as object;
  const existing = stateBySession.get(key);
  if (existing) return existing;
  const created: V28TuningState = {
    beforePositions: new Map(),
    bossWasAlive: false,
  };
  stateBySession.set(key, created);
  return created;
}

function captureEnemyPositions(session: V28Session, state: V28TuningState): void {
  for (const enemy of session.enemies) {
    if (!enemy.alive) continue;
    let sample = state.beforePositions.get(enemy.id);
    if (!sample) {
      sample = { x: enemy.x, z: enemy.z };
      state.beforePositions.set(enemy.id, sample);
    } else {
      sample.x = enemy.x;
      sample.z = enemy.z;
    }
  }
}

function applyFlightSpeedMultipliers(session: V28Session, state: V28TuningState): void {
  for (const enemy of session.enemies) {
    if (!enemy.alive) continue;
    const sample = state.beforePositions.get(enemy.id);
    if (!sample) continue;
    const dx = enemy.x - sample.x;
    const dz = enemy.z - sample.z;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq > MAX_CONTINUOUS_STEP_DISTANCE_SQ) continue;
    const multiplier = enemy.kind === "boss"
      ? SKY_DANCER_V28_BOSS_SPEED_MULTIPLIER
      : SKY_DANCER_V28_GRUNT_SPEED_MULTIPLIER;
    enemy.x = sample.x + dx * multiplier;
    enemy.z = sample.z + dz * multiplier;
  }
}

function tuneBossLifeOnSpawn(session: V28Session, state: V28TuningState): void {
  const boss = session.enemies.find((enemy) => enemy.kind === "boss") ?? null;
  const bossAlive = Boolean(boss?.alive);
  if (boss && bossAlive && !state.bossWasAlive) {
    const originalMaxHp = Math.max(1, boss.maxHp);
    const healthRatio = Math.max(0, Math.min(1, boss.hp / originalMaxHp));
    const tunedMaxHp = Math.max(1, Math.round(originalMaxHp * SKY_DANCER_V28_BOSS_HP_MULTIPLIER));
    boss.maxHp = tunedMaxHp;
    boss.hp = Math.max(1, Math.min(tunedMaxHp, Math.round(tunedMaxHp * healthRatio)));
  }
  state.bossWasAlive = bossAlive;
}

/**
 * V28 keeps the existing flight AI and steering behavior intact, then scales
 * only the distance each aircraft actually traveled during the fixed step.
 * Large coordinate jumps (spawn/re-tile events) are intentionally ignored.
 */
export function installSkyDancerV28Tuning(): void {
  const prototype = CartArenaSession.prototype as unknown as V28Session & Record<string, unknown>;
  if (prototype[PATCHED_KEY]) return;
  prototype[PATCHED_KEY] = true;
  const previous = prototype.step;

  prototype.step = function skyDancerV28TunedStep(
    this: V28Session,
    input: RallyInputState,
    fixedDelta?: number,
  ): void {
    const concrete = this as unknown as CartArenaSession;
    if (!isCartTurboHuntEnabled(concrete)) {
      previous.call(this, input, fixedDelta);
      return;
    }

    const state = stateFor(this);
    captureEnemyPositions(this, state);
    previous.call(this, input, fixedDelta);
    applyFlightSpeedMultipliers(this, state);
    tuneBossLifeOnSpawn(this, state);
  };
}
