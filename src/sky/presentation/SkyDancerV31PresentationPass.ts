import type { CartArenaSessionSnapshot } from "../../cart/CartArenaSession";
import type { SkyDancerFxRuntime } from "../SkyDancerAirCombatFxV2";
import { SkyDancerCloudQualityV31 } from "../SkyDancerCloudQualityV31";
import { SkyDancerGroundDensityV31 } from "../SkyDancerGroundDensityV31";
import { SkyDancerGroundReadabilityV31 } from "../SkyDancerGroundReadabilityV31";
import { hideSkyDancerBossWorldGauge } from "./SkyDancerBossGaugePresentation";
import { scheduleSkyDancerV31CameraPitch } from "./SkyDancerCameraPresentation";

const V31_OWNED_PRESENTATION_ROOTS = [
  "sky-dancer-v30-valley-detail",
  "sky-dancer-v30-world-presentation",
  "sky-dancer-v30-sky",
  "sky-dancer-v31-ground-density",
  "sky-dancer-v31-cloud-system",
] as const;

/** V31 density/readability/cloud/HUD-world responsibilities as one ordered pass. */
export class SkyDancerV31PresentationPass {
  private readonly groundDensity: SkyDancerGroundDensityV31;
  private readonly groundReadability: SkyDancerGroundReadabilityV31;
  private readonly cloudQuality: SkyDancerCloudQualityV31;

  constructor(private readonly runtime: SkyDancerFxRuntime) {
    this.groundDensity = new SkyDancerGroundDensityV31(runtime);
    this.groundReadability = new SkyDancerGroundReadabilityV31(runtime);
    this.cloudQuality = new SkyDancerCloudQualityV31(runtime);
    scheduleSkyDancerV31CameraPitch(runtime);
  }

  update(snapshot: CartArenaSessionSnapshot): void {
    this.restoreOwnedPresentationRoots();
    this.groundDensity.update(snapshot);
    this.groundReadability.update();
    this.cloudQuality.update(snapshot);
    hideSkyDancerBossWorldGauge(this.runtime, snapshot);
  }

  private restoreOwnedPresentationRoots(): void {
    for (const name of V31_OWNED_PRESENTATION_ROOTS) {
      const object = this.runtime.scene.getObjectByName(name);
      if (object) object.visible = true;
    }
  }
}
