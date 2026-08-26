import type { RallyInputState } from "../rally/RallyTypes";
import { CartArenaSession } from "../cart/CartArenaSession";
import type { CartEnemyState } from "../cart/CartCombat";
import { installSkyDancerFlightCombat } from "./SkyDancerFlightCombat";
import {
  SKY_DANCER_ENEMY_PREFERRED_STANDOFF,
  skyDancerAvoidanceHeading,
  skyDancerClamp,
  skyDancerEnemySafetyRadius,
  skyDancerNormalizeAngle,
  skyDancerRotateToward,
} from "./SkyDancerFlightAvoidanceMath";
import {
  SKY_DANCER_VERTICAL_COLLISION_CLEARANCE_METERS,
  getSkyDancerEnemyAltitudeMetersV43,
} from "./SkyDancerVerticalFlightV43";

export {
  SKY_DANCER_ENEMY_HARD_CLEARANCE,
  SKY_DANCER_ENEMY_PREFERRED_STANDOFF,
  skyDancerAvoidanceHeading,
  skyDancerEnemySafetyRadius,
} from "./SkyDancerFlightAvoidanceMath";

interface AvoidanceSessionView {
  enemies: CartEnemyState[];
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
  };
  step(input: RallyInputState, fixedDelta?: number): void;
}

const PATCHED_KEY = "__skyDancerFlightAvoidanceInstalled__";

function stableSide(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2 === 0 ? -1 : 1;
}

function cruiseSpeed(enemy: CartEnemyState): number {
  if (enemy.kind === "boss") return 10.4;
  if (enemy.kind === "heavy") return 8.8;
  if (enemy.archetype === "striker") return 13.2;
  if (enemy.archetype === "drifter") return 12.4;
  if (enemy.archetype === "orbiter") return 11.6;
  if (enemy.archetype === "bomber") return 10.8;
  return enemy.kind === "blocker" ? 10.2 : 11.4;
}

function turnRate(enemy: CartEnemyState): number {
  if (enemy.kind === "boss") return 0.9;
  if (enemy.kind === "heavy") return 1.0;
  if (enemy.archetype === "drifter") return 1.5;
  if (enemy.archetype === "striker") return 1.34;
  return 1.2;
}

function applyCollisionAvoidance(session: AvoidanceSessionView, delta: number): void {
  const nodeId = session.location.node.id;
  const bounds = session.location.node.rect;
  const px = session.car.position.x;
  const pz = session.car.position.z;
  const playerHeading = session.car.heading;
  const playerSpeed = Math.abs(session.car.forwardVelocity);

  for (const enemy of session.enemies) {
    if (!enemy.alive || enemy.nodeId !== nodeId) continue;

    let awayX = enemy.x - px;
    let awayZ = enemy.z - pz;
    let distance = Math.hypot(awayX, awayZ);
    const side = stableSide(enemy.id);
    const safetyRadius = skyDancerEnemySafetyRadius(enemy.radius);
    const preferred = enemy.kind === "boss" ? 30 : enemy.kind === "heavy" ? 28 : 26;
    const altitudeSeparation = Math.abs(getSkyDancerEnemyAltitudeMetersV43(enemy));
    const verticallyClear = altitudeSeparation >= SKY_DANCER_VERTICAL_COLLISION_CLEARANCE_METERS;

    const desired = skyDancerAvoidanceHeading(
      enemy.x,
      enemy.z,
      px,
      pz,
      playerHeading,
      distance,
      side,
    );
    // Once vertical separation is established, keep only normal combat spacing.
    // The emergency horizontal dodge is no longer needed: the aircraft can pass
    // above/below the player instead of being shoved sideways like a 2D token.
    const urgency = verticallyClear
      ? (distance < preferred ? 1.08 : 0.72)
      : distance < 15.5
        ? 2.45
        : distance < preferred
          ? 1.95
          : distance < 34
            ? 1.35
            : 0.82;
    enemy.heading = skyDancerRotateToward(enemy.heading, desired, turnRate(enemy) * urgency * delta);

    const lookAhead = 0.95;
    const playerTravel = Math.min(15, playerSpeed * lookAhead);
    const predictedPlayerX = px + Math.sin(playerHeading) * playerTravel;
    const predictedPlayerZ = pz + Math.cos(playerHeading) * playerTravel;
    const enemyTravel = cruiseSpeed(enemy) * lookAhead;
    const predictedEnemyX = enemy.x + Math.sin(enemy.heading) * enemyTravel;
    const predictedEnemyZ = enemy.z + Math.cos(enemy.heading) * enemyTravel;
    const predictedDistance = Math.hypot(predictedEnemyX - predictedPlayerX, predictedEnemyZ - predictedPlayerZ);
    if (!verticallyClear && predictedDistance < safetyRadius + 5.4 && distance < 36) {
      const awayHeading = skyDancerNormalizeAngle(Math.atan2(px - enemy.x, pz - enemy.z) + Math.PI + side * 0.78);
      enemy.heading = skyDancerRotateToward(enemy.heading, awayHeading, turnRate(enemy) * 2.35 * delta);
    }

    // Only the actual collision bubble is position-corrected, and V43 disables
    // that radial correction after a safe altitude difference has been created.
    // This makes climb/dive avoidance materially useful to aircraft motion.
    if (!verticallyClear && distance < safetyRadius) {
      if (distance < 0.001) {
        awayX = Math.cos(playerHeading) * side;
        awayZ = -Math.sin(playerHeading) * side;
        distance = 1;
      }
      const inv = 1 / distance;
      enemy.x = px + awayX * inv * safetyRadius;
      enemy.z = pz + awayZ * inv * safetyRadius;
      const awayHeading = Math.atan2(enemy.x - px, enemy.z - pz);
      enemy.heading = skyDancerRotateToward(enemy.heading, awayHeading, turnRate(enemy) * 2.8 * delta);
    }

    const margin = 2.4;
    enemy.x = skyDancerClamp(enemy.x, bounds.centerX - bounds.halfWidth + margin, bounds.centerX + bounds.halfWidth - margin);
    enemy.z = skyDancerClamp(enemy.z, bounds.centerZ - bounds.halfDepth + margin, bounds.centerZ + bounds.halfDepth - margin);
  }
}

export function installSkyDancerFlightAvoidance(): void {
  installSkyDancerFlightCombat();
  const prototype = CartArenaSession.prototype as unknown as AvoidanceSessionView & Record<string, unknown>;
  if (prototype[PATCHED_KEY]) return;
  prototype[PATCHED_KEY] = true;
  const baseStep = prototype.step;

  prototype.step = function skyDancerAvoidanceStep(input: RallyInputState, fixedDelta?: number): void {
    baseStep.call(this, input, fixedDelta);
    const delta = Math.max(0.001, Math.min(0.05, fixedDelta ?? 1 / 60));
    applyCollisionAvoidance(this as unknown as AvoidanceSessionView, delta);
  };
}
