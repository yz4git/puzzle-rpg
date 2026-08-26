import { CartArenaSession } from "../cart/CartArenaSession";
import type { CartEnemyState } from "../cart/CartCombat";
import { isCartTurboHuntEnabled } from "../cart/CartRoguePhase67TurboHunt";
import type { RallyInputState } from "../rally/RallyTypes";
import { skyDancerBossDurabilityV34 } from "./SkyDancerBossCombatV34";
import { getSkyDancerStageCycleSnapshot } from "./SkyDancerStageCycle";

interface GuardSession {
  enemies: CartEnemyState[];
  step(input: RallyInputState, fixedDelta?: number): void;
}

const PATCHED_KEY = "__skyDancerBossDurabilityGuardV34Installed__";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeBossDurability(session: GuardSession): void {
  const boss = session.enemies.find((enemy) => enemy.kind === "boss" && enemy.alive) ?? null;
  if (!boss) return;

  const concrete = session as unknown as CartArenaSession;
  const stage = getSkyDancerStageCycleSnapshot(concrete)?.stage ?? 1;
  const targetMaxHp = skyDancerBossDurabilityV34(stage);
  if (Math.abs(boss.maxHp - targetMaxHp) < 0.001) return;

  // V28/V29 each own a historical one-time 1/10 spawn reduction. They sit
  // inside the V34 director and can therefore rewrite a newly activated boss
  // on the following fixed step. Convert that legacy ratio back into V34's
  // final durability domain before the outer V34 director observes the boss.
  const legacyMaxHp = Math.max(1, boss.maxHp);
  const healthRatio = clamp(boss.hp / legacyMaxHp, 0, 1);
  boss.maxHp = targetMaxHp;
  boss.hp = Math.max(1, Math.min(targetMaxHp, targetMaxHp * healthRatio));
}

/**
 * Installs immediately inside the V34 boss director. This keeps the historical
 * V28/V29 wrappers intact for compatibility while making V34 the final owner of
 * live boss durability in both WebGL and Canvas runtimes.
 */
export function installSkyDancerBossDurabilityGuardV34(): void {
  const prototype = CartArenaSession.prototype as unknown as GuardSession & Record<string, unknown>;
  if (prototype[PATCHED_KEY]) return;
  prototype[PATCHED_KEY] = true;
  const previous = prototype.step;

  prototype.step = function skyDancerBossDurabilityGuardV34Step(
    this: GuardSession,
    input: RallyInputState,
    fixedDelta?: number,
  ): void {
    previous.call(this, input, fixedDelta);
    const concrete = this as unknown as CartArenaSession;
    if (!isCartTurboHuntEnabled(concrete)) return;
    normalizeBossDurability(this);
  };
}
