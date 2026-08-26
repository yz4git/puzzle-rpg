import type { CartEnemyState } from "../cart/CartCombat";

const CLEANUP_HELD_KEY = "__skyDancerCleanupHeldV42";
const OUT_OF_SEEKER_RANGE_KEY = "__skyDancerOutOfSeekerRangeV44";

type CleanupGatedEnemy = CartEnemyState & {
  __skyDancerCleanupHeldV42?: boolean;
  __skyDancerOutOfSeekerRangeV44?: boolean;
};

/**
 * CLEANUP formation aircraft remain visible and keep flying, but they are not
 * live combat targets until their scheduled slot is released. Keeping this as
 * enemy state (rather than camera-relative positioning) lets V42 preserve
 * natural screen motion without allowing the cleanup cadence to collapse when
 * the player turns through a holding aircraft.
 */
export function setSkyDancerCleanupHeldV42(enemy: CartEnemyState, held: boolean): void {
  const gated = enemy as CleanupGatedEnemy;
  if (held) gated[CLEANUP_HELD_KEY] = true;
  else delete gated[CLEANUP_HELD_KEY];
}

/**
 * V44 derives this flag strictly from the real player-to-aircraft seeker
 * distance. It is not a timed invulnerability gate: the flag clears on the
 * exact fixed step that the aircraft crosses back inside the 58 m engagement
 * envelope. PlayerWeapons already uses this eligibility list both for seeker
 * targets and swept missile collision, so WAVE carry-over missiles cannot hit
 * a physically out-of-range CLEANUP orbit before its attack run enters range.
 */
export function setSkyDancerCombatOutOfSeekerRangeV44(enemy: CartEnemyState, outOfRange: boolean): void {
  const gated = enemy as CleanupGatedEnemy;
  if (outOfRange) gated[OUT_OF_SEEKER_RANGE_KEY] = true;
  else delete gated[OUT_OF_SEEKER_RANGE_KEY];
}

export function isSkyDancerCombatTargetableV42(enemy: CartEnemyState): boolean {
  const gated = enemy as CleanupGatedEnemy;
  return gated[CLEANUP_HELD_KEY] !== true && gated[OUT_OF_SEEKER_RANGE_KEY] !== true;
}
