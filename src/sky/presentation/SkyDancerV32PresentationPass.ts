import type { CartArenaSessionSnapshot } from "../../cart/CartArenaSession";
import type { SkyDancerFxRuntime } from "../SkyDancerAirCombatFxV2";
import { SkyDancerReferencePolishV32 } from "../SkyDancerReferencePolishV32";
import { SkyDancerReferenceWorldV32 } from "../SkyDancerReferenceWorldV32";
import { scheduleSkyDancerV32CameraBalance } from "./SkyDancerCameraPresentation";

/** V32 reference-match world and final polish extracted from the version subclass. */
export class SkyDancerV32PresentationPass {
  private readonly referencePresentation: SkyDancerReferenceWorldV32;
  private readonly referencePolish: SkyDancerReferencePolishV32;

  constructor(runtime: SkyDancerFxRuntime) {
    this.referencePresentation = new SkyDancerReferenceWorldV32(runtime);
    this.referencePolish = new SkyDancerReferencePolishV32(runtime);
    scheduleSkyDancerV32CameraBalance(runtime);
  }

  update(snapshot: CartArenaSessionSnapshot): void {
    this.referencePresentation.update(snapshot);
    this.referencePolish.update(snapshot);
  }
}
