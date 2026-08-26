import type { RallyInputState } from "../rally/RallyTypes";
import { CartArenaSession, type CartArenaSessionSnapshot } from "../cart/CartArenaSession";
import type { CartEnemyState } from "../cart/CartCombat";
import {
  CART_TURBO_HUNT_SNAPSHOT_EVENT,
  getCartTurboHuntSnapshot,
  isCartTurboHuntEnabled,
  setCartTurboHuntExternalProgressionEnabled,
  type CartTurboHuntSnapshot,
} from "../cart/CartRoguePhase67TurboHunt";

export type SkyDancerStageCyclePhase = "reinforcements" | "cleanup" | "boss" | "stage-clear";

export interface SkyDancerStageCycleSnapshot {
  stage: number;
  phase: SkyDancerStageCyclePhase;
  stageKills: number;
  reinforcementTarget: number;
  remainingEnemies: number;
  bossHp: number;
  bossMaxHp: number;
  clearSeconds: number;
}

interface StageSession {
  car: CartArenaSession["car"];
  enemies: CartEnemyState[];
  obstacles: unknown[];
  gas: number;
  rewardTimer: number;
  lastReward: string | null;
  step(input: RallyInputState, fixedDelta?: number): void;
  snapshot(): CartArenaSessionSnapshot;
}

interface StageCycleState {
  initialized: boolean;
  stage: number;
  stageElapsed: number;
  stageKills: number;
  reinforcementTarget: number;
  reinforcementsComplete: boolean;
  cleanupInitialRemaining: number;
  bossActive: boolean;
  bossWasAlive: boolean;
  clearTimer: number;
  spawnSerial: number;
  nonBossTemplates: CartEnemyState[];
  bossTemplate: CartEnemyState | null;
  lastAliveNonBoss: Set<string>;
}

const PATCHED_KEY = "__skyDancerStageCycleInstalled__";
const STAGE_CLEAR_SECONDS = 2.4;
const stateBySession = new WeakMap<object, StageCycleState>();
let latestStageSnapshot: SkyDancerStageCycleSnapshot | null = null;

export const SKY_DANCER_STAGE_CYCLE_EVENT = "sky-dancer-stage-cycle";
export const SKY_DANCER_STAGE_BASE_KILLS = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function skyDancerStageKillTarget(stage: number): number {
  return Math.min(28, SKY_DANCER_STAGE_BASE_KILLS + Math.max(0, stage - 1) * 4);
}

export function skyDancerStageActiveEnemyTarget(stage: number): number {
  return Math.min(10, 6 + Math.floor(Math.max(0, stage - 1) / 2));
}

function stateFor(session: StageSession): StageCycleState {
  const key = session as unknown as object;
  const existing = stateBySession.get(key);
  if (existing) return existing;
  const created: StageCycleState = {
    initialized: false,
    stage: 1,
    stageElapsed: 0,
    stageKills: 0,
    reinforcementTarget: skyDancerStageKillTarget(1),
    reinforcementsComplete: false,
    cleanupInitialRemaining: 0,
    bossActive: false,
    bossWasAlive: false,
    clearTimer: 0,
    spawnSerial: 0,
    nonBossTemplates: [],
    bossTemplate: null,
    lastAliveNonBoss: new Set<string>(),
  };
  stateBySession.set(key, created);
  return created;
}

function copyTemplate(enemy: CartEnemyState): CartEnemyState {
  return { ...enemy };
}

function liveNonBoss(session: StageSession): CartEnemyState[] {
  return session.enemies.filter((enemy) => enemy.kind !== "boss" && enemy.alive);
}

function bossEnemy(session: StageSession): CartEnemyState | null {
  return session.enemies.find((enemy) => enemy.kind === "boss") ?? null;
}

function setReward(session: StageSession, label: string, seconds = 1.8): void {
  session.lastReward = label;
  session.rewardTimer = Math.max(session.rewardTimer, seconds);
}

function removeDeadNonBoss(session: StageSession): void {
  for (let index = session.enemies.length - 1; index >= 0; index -= 1) {
    const enemy = session.enemies[index];
    if (enemy.kind !== "boss" && !enemy.alive) session.enemies.splice(index, 1);
  }
}

function resetBossToDormant(session: StageSession, state: StageCycleState): void {
  let boss = bossEnemy(session);
  if (!boss && state.bossTemplate) {
    boss = copyTemplate(state.bossTemplate);
    session.enemies.push(boss);
  }
  if (!boss) return;
  const template = state.bossTemplate ?? boss;
  Object.assign(boss, template);
  boss.alive = false;
  boss.hp = boss.maxHp;
  boss.aiClock = 0;
  boss.armorSegments = boss.maxArmorSegments ?? 3;
  boss.maxArmorSegments = boss.maxArmorSegments ?? 3;
  boss.weakPointExposed = false;
}

function spawnFromTemplate(session: StageSession, state: StageCycleState, template: CartEnemyState): CartEnemyState {
  const serial = state.spawnSerial++;
  const slotOffsets = [-0.92, -0.58, -0.26, 0.22, 0.56, 0.9, 1.28, -1.28] as const;
  const angle = session.car.heading + slotOffsets[serial % slotOffsets.length] + ((state.stage + serial) % 3 - 1) * 0.07;
  const distance = 25 + (serial % 4) * 5.5;
  const hpScale = 1 + Math.min(0.55, Math.max(0, state.stage - 1) * 0.055);
  const maxHp = Math.max(1, Math.round(template.maxHp * hpScale));
  return {
    ...template,
    x: session.car.position.x + Math.sin(angle) * distance,
    z: session.car.position.z + Math.cos(angle) * distance,
    heading: angle + Math.PI,
    maxHp,
    hp: maxHp,
    alive: true,
    aiClock: 0,
    chargeCooldown: template.archetype === "striker"
      ? 0.78 + (serial % 4) * 0.13
      : template.chargeCooldown,
    chargeTime: template.archetype === "striker" ? 0 : template.chargeTime,
    armorSegments: template.kind === "heavy" ? template.armorSegments : undefined,
    maxArmorSegments: template.kind === "heavy" ? template.maxArmorSegments : undefined,
    weakPointExposed: template.kind === "heavy" ? template.weakPointExposed : undefined,
  };
}

function chooseTemplate(session: StageSession, state: StageCycleState): CartEnemyState | null {
  if (state.nonBossTemplates.length === 0) return null;
  const present = new Set(session.enemies.map((enemy) => enemy.id));
  for (let offset = 0; offset < state.nonBossTemplates.length; offset += 1) {
    const index = (state.spawnSerial + offset) % state.nonBossTemplates.length;
    const candidate = state.nonBossTemplates[index];
    if (!present.has(candidate.id)) return candidate;
  }
  return null;
}

function fillReinforcements(session: StageSession, state: StageCycleState): void {
  if (state.reinforcementsComplete || state.bossActive || state.clearTimer > 0) return;
  const desired = skyDancerStageActiveEnemyTarget(state.stage);
  let active = liveNonBoss(session).length;
  while (active < desired) {
    const template = chooseTemplate(session, state);
    if (!template) break;
    session.enemies.push(spawnFromTemplate(session, state, template));
    active += 1;
  }
}

function spawnBoss(session: StageSession, state: StageCycleState): void {
  let boss = bossEnemy(session);
  if (!boss && state.bossTemplate) {
    boss = copyTemplate(state.bossTemplate);
    session.enemies.push(boss);
  }
  if (!boss) return;
  const template = state.bossTemplate ?? boss;
  const hpScale = Math.min(2.6, 1 + Math.max(0, state.stage - 1) * 0.18);
  const maxHp = Math.max(1, Math.round(template.maxHp * hpScale));
  Object.assign(boss, template);
  boss.x = session.car.position.x + Math.sin(session.car.heading) * (46 + Math.min(14, state.stage * 2));
  boss.z = session.car.position.z + Math.cos(session.car.heading) * (46 + Math.min(14, state.stage * 2));
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
  state.bossActive = true;
  state.bossWasAlive = true;
  setReward(session, `STAGE ${state.stage} · BOSS INBOUND`, 2.4);
}

function initializeStageCycle(session: StageSession, state: StageCycleState): void {
  if (state.initialized) return;
  state.initialized = true;
  state.nonBossTemplates = session.enemies
    .filter((enemy) => enemy.kind !== "boss")
    .map(copyTemplate);
  const boss = session.enemies.find((enemy) => enemy.kind === "boss");
  state.bossTemplate = boss ? copyTemplate(boss) : null;

  session.obstacles.splice(0);
  const desired = skyDancerStageActiveEnemyTarget(state.stage);
  const initialActive = session.enemies
    .filter((enemy) => enemy.kind !== "boss" && enemy.alive)
    .slice(0, desired);
  const dormantBoss = boss ? [boss] : [];
  session.enemies.splice(0, session.enemies.length, ...initialActive, ...dormantBoss);
  resetBossToDormant(session, state);
  fillReinforcements(session, state);
  state.lastAliveNonBoss = new Set(liveNonBoss(session).map((enemy) => enemy.id));
  state.bossWasAlive = Boolean(bossEnemy(session)?.alive);
  setReward(session, `STAGE ${state.stage} · ENGAGE`, 1.8);
}

function enterStageClear(session: StageSession, state: StageCycleState): void {
  state.bossActive = false;
  state.bossWasAlive = false;
  state.clearTimer = STAGE_CLEAR_SECONDS;
  setReward(session, `STAGE ${state.stage} CLEAR`, STAGE_CLEAR_SECONDS);
}

function startNextStage(session: StageSession, state: StageCycleState): void {
  state.stage += 1;
  state.stageElapsed = 0;
  state.stageKills = 0;
  state.reinforcementTarget = skyDancerStageKillTarget(state.stage);
  state.reinforcementsComplete = false;
  state.cleanupInitialRemaining = 0;
  state.bossActive = false;
  state.bossWasAlive = false;
  state.clearTimer = 0;

  session.obstacles.splice(0);
  for (let index = session.enemies.length - 1; index >= 0; index -= 1) {
    if (session.enemies[index].kind !== "boss") session.enemies.splice(index, 1);
  }
  resetBossToDormant(session, state);
  fillReinforcements(session, state);
  state.lastAliveNonBoss = new Set(liveNonBoss(session).map((enemy) => enemy.id));
  setReward(session, `STAGE ${state.stage} · ENGAGE`, 2);
}

function stageSnapshot(session: StageSession, state: StageCycleState): SkyDancerStageCycleSnapshot {
  const boss = bossEnemy(session);
  const remaining = liveNonBoss(session).length;
  const phase: SkyDancerStageCyclePhase = state.clearTimer > 0
    ? "stage-clear"
    : state.bossActive
      ? "boss"
      : state.reinforcementsComplete
        ? "cleanup"
        : "reinforcements";
  return {
    stage: state.stage,
    phase,
    stageKills: state.stageKills,
    reinforcementTarget: state.reinforcementTarget,
    remainingEnemies: remaining,
    bossHp: state.bossActive && boss ? Math.max(0, boss.hp) : 0,
    bossMaxHp: state.bossActive && boss ? Math.max(0, boss.maxHp) : 0,
    clearSeconds: state.clearTimer,
  };
}

function publishStageHud(session: StageSession, state: StageCycleState): void {
  const concrete = session as unknown as CartArenaSession;
  const base = getCartTurboHuntSnapshot(concrete);
  const stage = stageSnapshot(session, state);
  latestStageSnapshot = { ...stage };
  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent<SkyDancerStageCycleSnapshot>(SKY_DANCER_STAGE_CYCLE_EVENT, { detail: stage }));
  if (!base) return;

  let label: string;
  let progress: number;
  let target: number;
  let huntPhase: CartTurboHuntSnapshot["huntPhase"] = "hunt";
  let bossSpawned = false;

  if (stage.phase === "stage-clear") {
    label = `STAGE ${stage.stage} CLEAR`;
    progress = 1;
    target = 1;
    huntPhase = "clear";
  } else if (stage.phase === "boss") {
    label = `STAGE ${stage.stage} · DESTROY BOSS`;
    progress = Math.max(0, stage.bossMaxHp - stage.bossHp);
    target = Math.max(1, stage.bossMaxHp);
    huntPhase = "boss-arrival";
    bossSpawned = true;
  } else if (stage.phase === "cleanup") {
    label = `STAGE ${stage.stage} · WIPE OUT ${stage.remainingEnemies} REMAINING`;
    target = Math.max(1, state.cleanupInitialRemaining);
    progress = Math.max(0, target - stage.remainingEnemies);
  } else {
    label = `STAGE ${stage.stage} · DESTROY ${stage.reinforcementTarget} FIGHTERS`;
    progress = Math.min(stage.reinforcementTarget, stage.stageKills);
    target = stage.reinforcementTarget;
  }

  const intensity = stage.phase === "boss"
    ? 100
    : stage.phase === "cleanup"
      ? 82
      : clamp(stage.stageKills / Math.max(1, stage.reinforcementTarget) * 72, 0, 72);

  const synthetic: CartTurboHuntSnapshot = {
    ...base,
    huntPhase,
    huntElapsedSeconds: state.stageElapsed,
    huntHeat: intensity,
    huntHeatLevel: Math.min(5, 1 + Math.floor(intensity / 20)),
    huntKills: stage.stageKills,
    huntObjectiveKind: "HUNT",
    huntObjectiveLabel: label,
    huntObjectiveProgress: progress,
    huntObjectiveTarget: target,
    huntOrdersCompleted: Math.max(0, stage.stage - 1),
    huntBossSpawned: bossSpawned,
  };
  window.dispatchEvent(new CustomEvent<CartTurboHuntSnapshot>(CART_TURBO_HUNT_SNAPSHOT_EVENT, { detail: synthetic }));
}

export function getSkyDancerStageCycleSnapshot(session: CartArenaSession): SkyDancerStageCycleSnapshot | null {
  const raw = session as unknown as StageSession;
  const state = stateBySession.get(raw as unknown as object);
  return state?.initialized ? stageSnapshot(raw, state) : null;
}

export function getLatestSkyDancerStageCycleSnapshot(): SkyDancerStageCycleSnapshot | null {
  return latestStageSnapshot ? { ...latestStageSnapshot } : null;
}

export function installSkyDancerStageCycle(): void {
  setCartTurboHuntExternalProgressionEnabled(true);
  const prototype = CartArenaSession.prototype as unknown as StageSession & Record<string, unknown>;
  if (prototype[PATCHED_KEY]) return;
  prototype[PATCHED_KEY] = true;
  const previous = prototype.step;

  prototype.step = function skyDancerStageCycleStep(
    this: StageSession,
    input: RallyInputState,
    fixedDelta?: number,
  ): void {
    const concrete = this as unknown as CartArenaSession;
    if (!isCartTurboHuntEnabled(concrete)) {
      previous.call(this, input, fixedDelta);
      return;
    }

    const state = stateFor(this);
    initializeStageCycle(this, state);
    this.obstacles.splice(0);
    const delta = clamp(fixedDelta ?? 1 / 60, 0.001, 0.05);

    previous.call(this, input, fixedDelta);
    state.stageElapsed += delta;
    this.obstacles.splice(0);

    const aliveAfterOriginal = new Set(liveNonBoss(this).map((enemy) => enemy.id));
    let newKills = 0;
    for (const id of state.lastAliveNonBoss) {
      if (!aliveAfterOriginal.has(id)) newKills += 1;
    }
    if (newKills > 0 && !state.bossActive && state.clearTimer <= 0) {
      state.stageKills += newKills;
    }

    const boss = bossEnemy(this);
    const bossAlive = Boolean(boss?.alive);
    const bossDefeated = state.bossActive && state.bossWasAlive && !bossAlive;

    removeDeadNonBoss(this);

    if (bossDefeated) {
      enterStageClear(this, state);
    } else if (state.clearTimer > 0) {
      state.clearTimer = Math.max(0, state.clearTimer - delta);
      if (state.clearTimer <= 0) startNextStage(this, state);
    } else if (!state.bossActive) {
      if (!state.reinforcementsComplete && state.stageKills >= state.reinforcementTarget) {
        state.reinforcementsComplete = true;
        state.cleanupInitialRemaining = liveNonBoss(this).length;
        setReward(this, "REINFORCEMENTS ENDED · WIPE OUT REMAINING", 2);
      }

      if (!state.reinforcementsComplete) {
        fillReinforcements(this, state);
      } else if (liveNonBoss(this).length === 0) {
        spawnBoss(this, state);
      }
    }

    state.lastAliveNonBoss = new Set(liveNonBoss(this).map((enemy) => enemy.id));
    state.bossWasAlive = Boolean(bossEnemy(this)?.alive);
    publishStageHud(this, state);
  };

  const previousSnapshot = prototype.snapshot;
  prototype.snapshot = function skyDancerStageCycleSnapshot(this: StageSession): CartArenaSessionSnapshot {
    const base = previousSnapshot.call(this);
    const concrete = this as unknown as CartArenaSession;
    if (!isCartTurboHuntEnabled(concrete)) return base;
    const state = stateBySession.get(this as unknown as object);
    if (!state?.initialized) return base;
    const boss = bossEnemy(this);
    const active = this.enemies.filter((enemy) => enemy.alive).length;
    Object.assign(base, {
      nodeKind: state.bossActive ? "boss" : "arena",
      encounter: state.bossActive ? "boss" : "combat",
      enemiesAlive: active,
      enemiesTotal: this.enemies.length,
      bossHp: state.bossActive && boss ? Math.max(0, boss.hp) : 0,
      bossMaxHp: state.bossActive && boss ? Math.max(0, boss.maxHp) : 0,
      runComplete: false,
      obstacles: [],
    });
    return base;
  };
}
