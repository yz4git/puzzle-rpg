import type { RallyInputState } from "../rally/RallyTypes";
import { CartArenaSession } from "../cart/CartArenaSession";
import type { CartEnemyState } from "../cart/CartCombat";
import { isCartTurboHuntEnabled } from "../cart/CartRoguePhase67TurboHunt";
import { getSkyDancerStageCycleSnapshot } from "./SkyDancerStageCycle";

export type SkyDancerBossPhaseV34 = 1 | 2 | 3;
export type SkyDancerBossModeV34 = "orbit" | "strike" | "break";

export interface SkyDancerBossQualitySnapshotV34 {
  active: boolean;
  phase: SkyDancerBossPhaseV34;
  mode: SkyDancerBossModeV34;
  coreOpen: boolean;
  hp: number;
  maxHp: number;
  distance: number;
}

interface BossSessionView {
  enemies: CartEnemyState[];
  gas: number;
  car: {
    position: { x: number; z: number };
    heading: number;
  };
  location: {
    node: {
      id: string;
      rect: { centerX: number; centerZ: number; halfWidth: number; halfDepth: number };
    };
  };
  step(input: RallyInputState, fixedDelta?: number): void;
}

interface BossCombatState {
  clock: number;
  bossWasAlive: boolean;
  previousBossHp: number;
  side: number;
  broadcastClock: number;
}

const PATCHED_KEY = "__skyDancerBossCombatV34Installed__";
const stateBySession = new WeakMap<object, BossCombatState>();
let latestSnapshot: SkyDancerBossQualitySnapshotV34 | null = null;
let auditForceBoss = false;

export const SKY_DANCER_BOSS_QUALITY_EVENT_V34 = "sky-dancer-boss-quality-v34";
export const SKY_DANCER_V34_BOSS_BASE_HP = 192;
export const SKY_DANCER_V34_BOSS_STAGE_HP_STEP = 24;
export const SKY_DANCER_V34_BOSS_MAX_HP = 312;
export const SKY_DANCER_V34_BOSS_MISSILE_DAMAGE_CAP = 0.085;

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

function stableSide(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2 === 0 ? -1 : 1;
}

function stateFor(session: BossSessionView): BossCombatState {
  const key = session as unknown as object;
  const existing = stateBySession.get(key);
  if (existing) return existing;
  const boss = session.enemies.find((enemy) => enemy.kind === "boss") ?? null;
  const created: BossCombatState = {
    clock: 0,
    bossWasAlive: Boolean(boss?.alive),
    previousBossHp: boss?.hp ?? 0,
    side: stableSide(boss?.id ?? "sky-dancer-boss"),
    broadcastClock: 0,
  };
  stateBySession.set(key, created);
  return created;
}

export function skyDancerBossPhaseV34(enemy: Pick<CartEnemyState, "hp" | "maxHp">): SkyDancerBossPhaseV34 {
  const ratio = enemy.hp / Math.max(1, enemy.maxHp);
  if (ratio > 0.66) return 1;
  if (ratio > 0.33) return 2;
  return 3;
}

export function skyDancerBossDurabilityV34(stage: number): number {
  return Math.min(SKY_DANCER_V34_BOSS_MAX_HP, SKY_DANCER_V34_BOSS_BASE_HP + Math.max(0, stage - 1) * SKY_DANCER_V34_BOSS_STAGE_HP_STEP);
}

export function skyDancerBossModeV34(phase: SkyDancerBossPhaseV34, clock: number): SkyDancerBossModeV34 {
  const cycle = phase === 1 ? 7.2 : phase === 2 ? 6.2 : 5.4;
  const strikeStart = phase === 1 ? 3.8 : phase === 2 ? 2.8 : 2.2;
  const breakStart = phase === 1 ? 5.05 : phase === 2 ? 4.25 : 3.75;
  const t = ((clock % cycle) + cycle) % cycle;
  if (t < strikeStart) return "orbit";
  if (t < breakStart) return "strike";
  return "break";
}

export function skyDancerBossCoreOpenV34(phase: SkyDancerBossPhaseV34, clock: number): boolean {
  return skyDancerBossModeV34(phase, clock) === "break";
}

function routeEnemiesToCurrentAirspace(session: BossSessionView): void {
  const nodeId = session.location.node.id;
  for (const enemy of session.enemies) {
    if (enemy.alive) enemy.nodeId = nodeId;
  }
}

function bossSnapshot(session: BossSessionView, state: BossCombatState): SkyDancerBossQualitySnapshotV34 {
  const boss = session.enemies.find((enemy) => enemy.kind === "boss" && enemy.alive) ?? null;
  if (!boss) return { active: false, phase: 1, mode: "orbit", coreOpen: false, hp: 0, maxHp: 0, distance: 0 };
  const phase = skyDancerBossPhaseV34(boss);
  const mode = skyDancerBossModeV34(phase, state.clock);
  return {
    active: true,
    phase,
    mode,
    coreOpen: Boolean(boss.weakPointExposed),
    hp: boss.hp,
    maxHp: boss.maxHp,
    distance: Math.hypot(boss.x - session.car.position.x, boss.z - session.car.position.z),
  };
}

function publish(session: BossSessionView, state: BossCombatState): void {
  latestSnapshot = bossSnapshot(session, state);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<SkyDancerBossQualitySnapshotV34>(SKY_DANCER_BOSS_QUALITY_EVENT_V34, { detail: latestSnapshot }));
  }
}

/** Webdriver-only: activate the actual dormant stage boss instead of fabricating a test double. */
function forceBossForAudit(session: BossSessionView): void {
  if (!auditForceBoss) return;
  for (const enemy of session.enemies) {
    if (enemy.kind === "boss" || !enemy.alive) continue;
    enemy.hp = 0;
    enemy.alive = false;
  }

  const boss = session.enemies.find((enemy) => enemy.kind === "boss") ?? null;
  if (!boss) return;
  const stage = getSkyDancerStageCycleSnapshot(session as unknown as CartArenaSession)?.stage ?? 1;
  const maxHp = skyDancerBossDurabilityV34(stage);
  const arrivalDistance = 46 + Math.min(14, stage * 2);
  boss.nodeId = session.location.node.id;
  boss.x = session.car.position.x + Math.sin(session.car.heading) * arrivalDistance;
  boss.z = session.car.position.z + Math.cos(session.car.heading) * arrivalDistance;
  boss.heading = session.car.heading + Math.PI;
  boss.maxHp = maxHp;
  boss.hp = maxHp;
  boss.alive = true;
  boss.aiClock = 0;
  boss.armorSegments = 3;
  boss.maxArmorSegments = 3;
  boss.weakPointExposed = false;
  boss.chargeCooldown = 1.4;
  boss.chargeTime = 0;
  auditForceBoss = false;
}

function updateBossFlight(
  session: BossSessionView,
  state: BossCombatState,
  boss: CartEnemyState,
  beforeX: number,
  beforeZ: number,
  delta: number,
): void {
  const px = session.car.position.x;
  const pz = session.car.position.z;
  const dx = px - beforeX;
  const dz = pz - beforeZ;
  const distance = Math.max(0.001, Math.hypot(dx, dz));
  const direct = Math.atan2(dx, dz);
  const phase = skyDancerBossPhaseV34(boss);
  const mode = skyDancerBossModeV34(phase, state.clock);
  const cycle = phase === 1 ? 7.2 : phase === 2 ? 6.2 : 5.4;
  const cycleIndex = Math.floor(state.clock / cycle);
  const side = state.side * (cycleIndex % 2 === 0 ? 1 : -1);
  const idealDistance = phase === 1 ? 29 : phase === 2 ? 25 : 22;
  let targetHeading = direct;
  if (mode === "orbit") {
    const radial = clamp((distance - idealDistance) * 0.045, -0.42, 0.42);
    targetHeading = normalizeAngle(direct + side * (1.05 - radial));
  } else if (mode === "strike") {
    targetHeading = normalizeAngle(direct + side * (phase === 3 ? 0.06 : 0.12));
  } else {
    targetHeading = normalizeAngle(direct + side * (2.0 + (phase - 1) * 0.1));
  }

  const turnRate = phase === 1 ? 1.02 : phase === 2 ? 1.22 : 1.42;
  boss.heading = rotateToward(boss.heading, targetHeading, turnRate * delta);
  const cruise = phase === 1 ? 5.8 : phase === 2 ? 6.4 : 7.0;
  const modeScale = mode === "strike" ? 1.2 : mode === "break" ? 1.08 : 1;
  const speed = cruise * modeScale;
  boss.x = beforeX + Math.sin(boss.heading) * speed * delta;
  boss.z = beforeZ + Math.cos(boss.heading) * speed * delta;

  const bounds = session.location.node.rect;
  const margin = 2.5;
  boss.x = clamp(boss.x, bounds.centerX - bounds.halfWidth + margin, bounds.centerX + bounds.halfWidth - margin);
  boss.z = clamp(boss.z, bounds.centerZ - bounds.halfDepth + margin, bounds.centerZ + bounds.halfDepth - margin);
  boss.weakPointExposed = skyDancerBossCoreOpenV34(phase, state.clock);
}

function tuneBossDurability(session: BossSessionView, state: BossCombatState, boss: CartEnemyState): void {
  const stage = getSkyDancerStageCycleSnapshot(session as unknown as CartArenaSession)?.stage ?? 1;
  const targetMaxHp = skyDancerBossDurabilityV34(stage);
  if (!state.bossWasAlive) {
    boss.maxHp = targetMaxHp;
    boss.hp = targetMaxHp;
    state.clock = 0;
    state.previousBossHp = targetMaxHp;
  }
}

function applyBossDamageWindow(state: BossCombatState, boss: CartEnemyState): void {
  if (!state.bossWasAlive) return;
  const beforeHp = state.previousBossHp;
  if (!(beforeHp > boss.hp)) return;
  const rawDamage = beforeHp - boss.hp;
  const scale = boss.weakPointExposed ? 1.45 : 0.72;
  boss.hp = Math.max(0, beforeHp - rawDamage * scale);
  boss.alive = boss.hp > 0;
}

export function getLatestSkyDancerBossQualityV34(): SkyDancerBossQualitySnapshotV34 | null {
  return latestSnapshot ? { ...latestSnapshot } : null;
}

export function installSkyDancerBossCombatV34(): void {
  const prototype = CartArenaSession.prototype as unknown as BossSessionView & Record<string, unknown>;
  if (prototype[PATCHED_KEY]) return;
  prototype[PATCHED_KEY] = true;
  const previous = prototype.step;

  prototype.step = function skyDancerBossCombatV34Step(
    this: BossSessionView,
    input: RallyInputState,
    fixedDelta?: number,
  ): void {
    const concrete = this as unknown as CartArenaSession;
    if (!isCartTurboHuntEnabled(concrete)) {
      previous.call(this, input, fixedDelta);
      return;
    }

    const state = stateFor(this);
    const delta = clamp(fixedDelta ?? 1 / 60, 0.001, 0.05);
    const beforeGas = this.gas;
    const beforeBoss = this.enemies.find((enemy) => enemy.kind === "boss" && enemy.alive) ?? null;
    const beforeX = beforeBoss?.x ?? 0;
    const beforeZ = beforeBoss?.z ?? 0;
    state.previousBossHp = beforeBoss?.hp ?? state.previousBossHp;

    previous.call(this, input, fixedDelta);
    routeEnemiesToCurrentAirspace(this);
    forceBossForAudit(this);

    const boss = this.enemies.find((enemy) => enemy.kind === "boss" && enemy.alive) ?? null;
    if (boss) {
      tuneBossDurability(this, state, boss);
      if (beforeBoss && beforeBoss.id === boss.id) {
        applyBossDamageWindow(state, boss);
        updateBossFlight(this, state, boss, beforeX, beforeZ, delta);
      }
      // Legacy boss missiles dealt 10.5% each. Preserve danger while preventing
      // a short homing sequence from deleting the player before a counter-pass.
      if (this.gas < beforeGas) this.gas = Math.max(this.gas, beforeGas - SKY_DANCER_V34_BOSS_MISSILE_DAMAGE_CAP);
      state.clock += delta;
      state.previousBossHp = boss.hp;
    } else {
      state.clock = 0;
      state.previousBossHp = 0;
    }

    state.bossWasAlive = Boolean(boss?.alive);
    state.broadcastClock += delta;
    if (state.broadcastClock >= 0.08) {
      state.broadcastClock = 0;
      publish(this, state);
    }
  };

  if (typeof window !== "undefined") {
    const globals = window as unknown as Record<string, unknown>;
    globals.__skyDancerGetBossQualityV34 = () => getLatestSkyDancerBossQualityV34();
    if (typeof navigator !== "undefined" && navigator.webdriver) {
      globals.__skyDancerForceBossAuditV34 = () => {
        auditForceBoss = true;
        return true;
      };
    }
  }
}
