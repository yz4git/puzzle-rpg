import type { CartArenaSessionSnapshot } from "../cart/CartArenaSession";
import type { SkyDancerMissileState } from "./SkyDancerFlightCombat";
import { SkyDancerAirCombatFxV30 } from "./SkyDancerAirCombatFxV30";
import type { SkyDancerFxRuntime } from "./SkyDancerAirCombatFxV2";
import { SkyDancerV31PresentationPass } from "./presentation/SkyDancerV31PresentationPass";

/** Compatibility wrapper for the historical V31 checkpoint. */
export class SkyDancerAirCombatFxV31 extends SkyDancerAirCombatFxV30 {
  private readonly presentationPassV31: SkyDancerV31PresentationPass;

  constructor(runtime: SkyDancerFxRuntime) {
    super(runtime);
    this.presentationPassV31 = new SkyDancerV31PresentationPass(runtime);
  }

  override update(snapshot: CartArenaSessionSnapshot, missiles: SkyDancerMissileState, delta: number): void {
    super.update(snapshot, missiles, delta);
    this.presentationPassV31.update(snapshot);
  }
}

export { SkyDancerAirCombatFxV31 as SkyDancerAirCombatFx };
