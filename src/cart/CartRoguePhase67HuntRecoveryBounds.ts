import { RALLY_CONFIG } from "../rally/RallyConfig";
import { RallyCar } from "../rally/RallyCar";
import { CART_TURBO_HUNT_FIELD, CART_TURBO_HUNT_TRACK } from "./CartTurboHuntTrack";

interface RecoverableRallyCar {
  position: { x: number; y: number; z: number };
  track: { id: string };
  isFiniteAndInRecoverableBounds(): boolean;
}

const HUNT_RECOVERY_LIMIT = 10_000_000;
const RECOVERY_PATCHED_KEY = "__cartTurboHuntRecoveryBoundsInstalled__";

export function cartPointInTurboHuntRecoveryBounds(x: number, y: number, z: number): boolean {
  return Number.isFinite(x)
    && Number.isFinite(y)
    && Number.isFinite(z)
    && Math.abs(x - CART_TURBO_HUNT_FIELD.centerX) <= HUNT_RECOVERY_LIMIT
    && Math.abs(z - CART_TURBO_HUNT_FIELD.centerZ) <= HUNT_RECOVERY_LIMIT
    && y >= RALLY_CONFIG.vehicle.recoveryMinY
    && y <= RALLY_CONFIG.vehicle.recoveryMaxY;
}

export function installCartRoguePhase67HuntRecoveryBounds(): void {
  const prototype = RallyCar.prototype as unknown as RecoverableRallyCar & Record<string, unknown>;
  if (prototype[RECOVERY_PATCHED_KEY]) return;
  prototype[RECOVERY_PATCHED_KEY] = true;
  const previous = prototype.isFiniteAndInRecoverableBounds;
  prototype.isFiniteAndInRecoverableBounds = function turboHuntRecoveryBounds(this: RecoverableRallyCar): boolean {
    if (
      this.track.id === CART_TURBO_HUNT_TRACK.id
      && cartPointInTurboHuntRecoveryBounds(this.position.x, this.position.y, this.position.z)
    ) return true;
    return previous.call(this);
  };
}

installCartRoguePhase67HuntRecoveryBounds();
