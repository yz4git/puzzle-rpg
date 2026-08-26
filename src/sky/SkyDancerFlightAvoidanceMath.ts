export const SKY_DANCER_ENEMY_PREFERRED_STANDOFF = 21;
export const SKY_DANCER_ENEMY_HARD_CLEARANCE = 3.2;
export const SKY_DANCER_PLAYER_BODY_RADIUS = 1.45;

export function skyDancerClamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function skyDancerNormalizeAngle(value: number): number {
  let angle = value;
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

export function skyDancerRotateToward(current: number, target: number, maxTurn: number): number {
  const delta = skyDancerNormalizeAngle(target - current);
  return skyDancerNormalizeAngle(current + skyDancerClamp(delta, -maxTurn, maxTurn));
}

export function skyDancerEnemySafetyRadius(enemyRadius: number): number {
  return SKY_DANCER_PLAYER_BODY_RADIUS + Math.max(0.5, enemyRadius) + SKY_DANCER_ENEMY_HARD_CLEARANCE;
}

export function skyDancerAvoidanceHeading(
  enemyX: number,
  enemyZ: number,
  playerX: number,
  playerZ: number,
  playerHeading: number,
  distance: number,
  side: number,
): number {
  const direct = Math.atan2(playerX - enemyX, playerZ - enemyZ);

  // Begin the fighter peel well before the two airframes become visually close.
  if (distance < 15.5) return skyDancerNormalizeAngle(direct + Math.PI + side * 0.58);
  // Remain in a missile-capable crank rather than flying a head-on intercept.
  if (distance < 27) return skyDancerNormalizeAngle(direct + side * 0.64);

  const lead = skyDancerClamp(distance * 0.18, 3.5, 9.5);
  const targetX = playerX + Math.sin(playerHeading) * lead;
  const targetZ = playerZ + Math.cos(playerHeading) * lead;
  const intercept = Math.atan2(targetX - enemyX, targetZ - enemyZ);
  return skyDancerNormalizeAngle(intercept + side * (distance < 38 ? 0.24 : 0.12));
}