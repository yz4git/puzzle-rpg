import { CartArenaSession } from "../cart/CartArenaSession";
import type { CartEnemyState } from "../cart/CartCombat";
import { isCartTurboHuntEnabled } from "../cart/CartRoguePhase67TurboHunt";
import type { RallyInputState } from "../rally/RallyTypes";

interface OpeningSession {
  enemies: CartEnemyState[];
  car: { position: { x: number; z: number } };
  step(input: RallyInputState, fixedDelta?: number): void;
}

const PATCHED_KEY = "__skyDancerOpeningSpacingV30Installed__";
const initialized = new WeakSet<object>();
const OPENING_DISTANCE = 52;

function hashAngle(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 4096) / 4096 * Math.PI * 2;
}

function spreadOnce(session: OpeningSession): void {
  const px = session.car.position.x;
  const pz = session.car.position.z;
  let order = 0;
  for (const enemy of session.enemies) {
    if (!enemy.alive || enemy.kind === "boss") continue;
    let dx = enemy.x - px;
    let dz = enemy.z - pz;
    let distance = Math.hypot(dx, dz);
    if (distance >= OPENING_DISTANCE) continue;
    if (distance < 0.001) {
      const angle = hashAngle(enemy.id) + order * 0.71;
      dx = Math.sin(angle);
      dz = Math.cos(angle);
      distance = 1;
    }
    const targetDistance = OPENING_DISTANCE + (order % 4) * 3.5;
    enemy.x = px + dx / distance * targetDistance;
    enemy.z = pz + dz / distance * targetDistance;
    enemy.heading = Math.atan2(px - enemy.x, pz - enemy.z);
    order += 1;
  }
}

/**
 * The old node-clamped opening spread was authored for a bounded ground arena.
 * V26 made the flight space unbounded, so V30 can safely place the first wave
 * farther out once, giving the chase camera a clean opening and preventing a
 * fighter from appearing almost on top of the player before controls settle.
 */
export function installSkyDancerOpeningSpacingV30(): void {
  const prototype = CartArenaSession.prototype as unknown as OpeningSession & Record<string, unknown>;
  if (prototype[PATCHED_KEY]) return;
  prototype[PATCHED_KEY] = true;
  const previous = prototype.step;

  prototype.step = function skyDancerOpeningSpacingV30Step(
    this: OpeningSession,
    input: RallyInputState,
    fixedDelta?: number,
  ): void {
    previous.call(this, input, fixedDelta);
    const concrete = this as unknown as CartArenaSession;
    if (!isCartTurboHuntEnabled(concrete)) return;
    const key = this as unknown as object;
    if (initialized.has(key)) return;
    initialized.add(key);
    spreadOnce(this);
  };
}
