import type { CartArenaSessionSnapshot } from "../../cart/CartArenaSession";
import type { SkyDancerFxRuntime } from "../SkyDancerAirCombatFxV2";
import { SkyDancerGroundDetailV30 } from "../SkyDancerGroundDetailV30";
import { SkyDancerLegacySceneryCleanupV30 } from "../SkyDancerLegacySceneryCleanupV30";
import { installSkyDancerOpeningSpacingV30 } from "../SkyDancerOpeningSpacingV30";
import { SkyDancerReferencePolishV30 } from "../SkyDancerReferencePolishV30";
import { SkyDancerWorldPresentationV30 } from "../SkyDancerWorldPresentationV30";

/** V30 world-composition responsibilities extracted from the version subclass. */
export class SkyDancerV30PresentationPass {
  private readonly legacyCleanup: SkyDancerLegacySceneryCleanupV30;
  private readonly groundDetail: SkyDancerGroundDetailV30;
  private readonly worldPresentation: SkyDancerWorldPresentationV30;
  private readonly referencePolish: SkyDancerReferencePolishV30;

  constructor(runtime: SkyDancerFxRuntime) {
    installSkyDancerOpeningSpacingV30();
    this.legacyCleanup = new SkyDancerLegacySceneryCleanupV30(runtime);
    this.groundDetail = new SkyDancerGroundDetailV30(runtime);
    this.worldPresentation = new SkyDancerWorldPresentationV30(runtime);
    this.referencePolish = new SkyDancerReferencePolishV30(runtime);
  }

  update(snapshot: CartArenaSessionSnapshot): void {
    this.legacyCleanup.update();
    this.groundDetail.update(snapshot);
    this.worldPresentation.update(snapshot);
    this.referencePolish.update();
  }
}
