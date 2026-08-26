import type { RallyInputState } from "../rally/RallyTypes";
import { CartArenaSession } from "../cart/CartArenaSession";
import type { CartEnemyState } from "../cart/CartCombat";
import { installSkyDancerLongRangeStandoff } from "./SkyDancerLongRangeStandoff";

interface DoctrineSession {
  enemies: CartEnemyState[];
  location: {
    node: {
      id: string;
      rect: { centerX: number; centerZ: number; halfWidth: number; halfDepth: number };
    };
  };
  car: { position: { x: number; z: number } };
  step(input: RallyInputState, fixedDelta?: number): void;
}

const PATCHED_KEY = "__skyDancerCombatDoctrineInstalled__";
const threatBroadcastClock = new WeakMap<object, number>();
export const SKY_DANCER_TACTICAL_STANDOFF = 26;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clearLegacyChargeThreat(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("cart-threat-dodge-snapshot", {
    detail: {
      threatActive: false,
      threatKind: null,
      threatDistance: 999,
      lastDodgeGrade: "NONE",
      dodgeFlashSeconds: 0,
      counterSeconds: 0,
    },
  }));
}

export function installSkyDancerCombatDoctrine(): void {
  installSkyDancerLongRangeStandoff();
  const prototype = CartArenaSession.prototype as unknown as DoctrineSession & Record<string, unknown>;
  if (prototype[PATCHED_KEY]) return;
  prototype[PATCHED_KEY] = true;
  const previous = prototype.step;

  prototype.step = function skyDancerCombatDoctrineStep(input: RallyInputState, fixedDelta?: number): void {
    previous.call(this, input, fixedDelta);
    const session = this as unknown as DoctrineSession;
    const delta = Math.max(0.001, Math.min(0.05, fixedDelta ?? 1 / 60));
    const node = session.location.node;
    const px = session.car.position.x;
    const pz = session.car.position.z;

    for (const enemy of session.enemies) {
      if (!enemy.alive || enemy.nodeId !== node.id) continue;

      // Sky Dancer enemies fight with missiles. Ground-game striker/boss charge
      // states are invalid here because they deliberately steer the body into
      // the player and also drive the old CHARGE warning UI.
      if (enemy.chargeTime !== undefined) enemy.chargeTime = 0;
      if (enemy.chargeCooldown !== undefined) enemy.chargeCooldown = Math.max(enemy.chargeCooldown, 4.0);

      const dx = enemy.x - px;
      const dz = enemy.z - pz;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.001) continue;
      const preferred = enemy.kind === "boss" ? 30 : enemy.kind === "heavy" ? 28 : SKY_DANCER_TACTICAL_STANDOFF;
      if (distance >= preferred) continue;

      // Strong post-step separation defeats any inherited intercept impulse while
      // staying continuous enough to read as an early break-away rather than a
      // collision bounce.
      const deficit = preferred - distance;
      const outwardSpeed = Math.min(24, 7.5 + deficit * 1.55);
      enemy.x += dx / distance * outwardSpeed * delta;
      enemy.z += dz / distance * outwardSpeed * delta;

      // Keep the aircraft inside the authored airspace with only a small margin.
      const margin = 1.2;
      enemy.x = clamp(enemy.x, node.rect.centerX - node.rect.halfWidth + margin, node.rect.centerX + node.rect.halfWidth - margin);
      enemy.z = clamp(enemy.z, node.rect.centerZ - node.rect.halfDepth + margin, node.rect.centerZ + node.rect.halfDepth - margin);
    }

    const key = session as unknown as object;
    const clock = (threatBroadcastClock.get(key) ?? 0) + delta;
    if (clock >= 0.08) {
      threatBroadcastClock.set(key, 0);
      clearLegacyChargeThreat();
    } else {
      threatBroadcastClock.set(key, clock);
    }
  };
}
