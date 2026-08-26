import type { RallyInputState } from "../rally/RallyTypes";
import { CartArenaSession } from "../cart/CartArenaSession";
import type { CartEnemyState } from "../cart/CartCombat";
import { isCartTurboHuntEnabled } from "../cart/CartRoguePhase67TurboHunt";

interface V29Session {
  enemies: CartEnemyState[];
  step(input: RallyInputState, fixedDelta?: number): void;
}

interface BossPositionSample {
  x: number;
  z: number;
}

interface V29TuningState {
  bossBefore: BossPositionSample | null;
  bossWasAlive: boolean;
}

const PATCHED_KEY = "__skyDancerV29TuningInstalled__";
const stateBySession = new WeakMap<object, V29TuningState>();
const MAX_CONTINUOUS_STEP_DISTANCE_SQ = 64;

export const SKY_DANCER_V29_ALTITUDE_METERS = 300;
export const SKY_DANCER_V29_ALTITUDE_LIFT_METERS = 100;
export const SKY_DANCER_V29_BOSS_SPEED_MULTIPLIER = 1.5;
export const SKY_DANCER_V29_BOSS_HP_MULTIPLIER = 0.1;

function stateFor(session: V29Session): V29TuningState {
  const key = session as unknown as object;
  const existing = stateBySession.get(key);
  if (existing) return existing;
  const created: V29TuningState = { bossBefore: null, bossWasAlive: false };
  stateBySession.set(key, created);
  return created;
}

function captureBossPosition(session: V29Session, state: V29TuningState): void {
  const boss = session.enemies.find((enemy) => enemy.kind === "boss" && enemy.alive) ?? null;
  if (!boss) {
    state.bossBefore = null;
    return;
  }
  state.bossBefore = { x: boss.x, z: boss.z };
}

function amplifyBossMovement(session: V29Session, state: V29TuningState): void {
  const boss = session.enemies.find((enemy) => enemy.kind === "boss" && enemy.alive) ?? null;
  const before = state.bossBefore;
  if (!boss || !before) return;
  const dx = boss.x - before.x;
  const dz = boss.z - before.z;
  const distanceSq = dx * dx + dz * dz;
  // Spawn/repeated-world retile jumps are not velocity and must not be scaled.
  if (distanceSq > MAX_CONTINUOUS_STEP_DISTANCE_SQ) return;
  boss.x = before.x + dx * SKY_DANCER_V29_BOSS_SPEED_MULTIPLIER;
  boss.z = before.z + dz * SKY_DANCER_V29_BOSS_SPEED_MULTIPLIER;
}

function tuneBossLifeOnSpawn(session: V29Session, state: V29TuningState): void {
  const boss = session.enemies.find((enemy) => enemy.kind === "boss") ?? null;
  const bossAlive = Boolean(boss?.alive);
  if (boss && bossAlive && !state.bossWasAlive) {
    // V28 has already applied its requested 1/10 at this point. V29 applies
    // another 1/10 exactly once for each boss spawn, for 1/100 total vs V27.
    const currentMaxHp = Math.max(1, boss.maxHp);
    const healthRatio = Math.max(0, Math.min(1, boss.hp / currentMaxHp));
    const tunedMaxHp = Math.max(1, Math.round(currentMaxHp * SKY_DANCER_V29_BOSS_HP_MULTIPLIER));
    boss.maxHp = tunedMaxHp;
    boss.hp = Math.max(1, Math.min(tunedMaxHp, Math.round(tunedMaxHp * healthRatio)));
  }
  state.bossWasAlive = bossAlive;
}

/**
 * V29 layers only the newly requested boss changes on top of V28. The normal
 * fighter multiplier remains V28's 1.2x, while boss displacement receives a
 * second 1.5x pass (2.25x total relative to the pre-V28 movement).
 */
export function installSkyDancerV29Tuning(): void {
  const prototype = CartArenaSession.prototype as unknown as V29Session & Record<string, unknown>;
  if (prototype[PATCHED_KEY]) return;
  prototype[PATCHED_KEY] = true;
  const previous = prototype.step;

  prototype.step = function skyDancerV29TunedStep(
    this: V29Session,
    input: RallyInputState,
    fixedDelta?: number,
  ): void {
    const concrete = this as unknown as CartArenaSession;
    if (!isCartTurboHuntEnabled(concrete)) {
      previous.call(this, input, fixedDelta);
      return;
    }

    const state = stateFor(this);
    captureBossPosition(this, state);
    previous.call(this, input, fixedDelta);
    amplifyBossMovement(this, state);
    tuneBossLifeOnSpawn(this, state);
  };
}
