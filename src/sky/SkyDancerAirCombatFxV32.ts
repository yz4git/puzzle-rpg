import type { CartArenaSessionSnapshot } from "../cart/CartArenaSession";
import type { SkyDancerMissileState } from "./SkyDancerFlightCombat";
import { SkyDancerAirCombatFxV31 } from "./SkyDancerAirCombatFxV31";
import type { SkyDancerFxRuntime } from "./SkyDancerAirCombatFxV2";
import { SkyDancerV32PresentationPass } from "./presentation/SkyDancerV32PresentationPass";

/** Compatibility wrapper for the historical V32 reference-match checkpoint. */
export class SkyDancerAirCombatFxV32 extends SkyDancerAirCombatFxV31 {
  private readonly presentationPassV32: SkyDancerV32PresentationPass;

  constructor(runtime: SkyDancerFxRuntime) {
    super(runtime);
    this.presentationPassV32 = new SkyDancerV32PresentationPass(runtime);
  }

  override update(snapshot: CartArenaSessionSnapshot, missiles: SkyDancerMissileState, delta: number): void {
    super.update(snapshot, missiles, delta);
    this.presentationPassV32.update(snapshot);
  }
}

export { SkyDancerAirCombatFxV32 as SkyDancerAirCombatFx };
