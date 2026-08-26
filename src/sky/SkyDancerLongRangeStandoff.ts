import type { RallyInputState } from "../rally/RallyTypes";
import { CartArenaSession } from "../cart/CartArenaSession";
import type { CartEnemyState } from "../cart/CartCombat";
import { installSkyDancerFlightAvoidance } from "./SkyDancerFlightAvoidance";

interface StandoffSession {
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

const PATCHED_KEY = "__skyDancerLongRangeStandoffInstalled__";
export const SKY_DANCER_COMBAT_STANDOFF = 26;

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

export function installSkyDancerLongRangeStandoff(): void {
  installSkyDancerFlightAvoidance();
  const prototype = CartArenaSession.prototype as unknown as StandoffSession & Record<string, unknown>;
  if (prototype[PATCHED_KEY]) return;
  prototype[PATCHED_KEY] = true;
  const previous = prototype.step;

  prototype.step = function skyDancerLongRangeStandoffStep(input: RallyInputState, fixedDelta?: number): void {
    previous.call(this, input, fixedDelta);
    const delta = Math.max(0.001, Math.min(0.05, fixedDelta ?? 1 / 60));
    const px = this.car.position.x;
    const pz = this.car.position.z;
    const node = this.location.node;

    for (const enemy of this.enemies) {
      if (!enemy.alive || enemy.nodeId !== node.id) continue;
      const dx = enemy.x - px;
      const dz = enemy.z - pz;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.001) continue;
      const preferred = enemy.kind === "boss" ? 30 : enemy.kind === "heavy" ? 28 : SKY_DANCER_COMBAT_STANDOFF;
      if (distance >= preferred) continue;

      // Do not push aircraft sideways. Turn into a banked break-away and let the
      // inertial flight layer create the separation through forward motion.
      const deficit = preferred - distance;
      const side = stableSide(enemy.id);
      const awayHeading = Math.atan2(dx, dz);
      const crank = side * clamp(0.2 + deficit * 0.018, 0.2, 0.52);
      const targetHeading = normalizeAngle(awayHeading + crank);
      const turnRate = clamp(1.05 + deficit * 0.055, 1.05, 1.9);
      enemy.heading = rotateToward(enemy.heading, targetHeading, turnRate * delta);
    }
  };
}
