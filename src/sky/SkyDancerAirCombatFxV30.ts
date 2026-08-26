import type { CartArenaSessionSnapshot } from "../cart/CartArenaSession";
import type { SkyDancerMissileState } from "./SkyDancerFlightCombat";
import { SkyDancerAirCombatFxV29 } from "./SkyDancerAirCombatFxV29";
import type { SkyDancerFxRuntime } from "./SkyDancerAirCombatFxV2";
import { SkyDancerV30PresentationPass } from "./presentation/SkyDancerV30PresentationPass";

/** Compatibility wrapper for the historical V30 checkpoint. */
export class SkyDancerAirCombatFxV30 extends SkyDancerAirCombatFxV29 {
  private readonly presentationPass: SkyDancerV30PresentationPass;

  constructor(runtime: SkyDancerFxRuntime) {
    super(runtime);
    this.presentationPass = new SkyDancerV30PresentationPass(runtime);
  }

  override update(snapshot: CartArenaSessionSnapshot, missiles: SkyDancerMissileState, delta: number): void {
    super.update(snapshot, missiles, delta);
    this.presentationPass.update(snapshot);
  }
}

export { SkyDancerAirCombatFxV30 as SkyDancerAirCombatFx };
