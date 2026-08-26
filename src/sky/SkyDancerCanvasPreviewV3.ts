import type { CartRogueSnapshotHandler } from "../cart/CartRogueDemo";
import { installSkyDancerFlightAvoidance } from "./SkyDancerFlightAvoidance";
import { SkyDancerCanvasPreviewV2 } from "./SkyDancerCanvasPreviewV2";

export class SkyDancerCanvasPreviewV3 extends SkyDancerCanvasPreviewV2 {
  constructor(mount: HTMLElement, onSnapshot: CartRogueSnapshotHandler) {
    super(mount, onSnapshot);
    installSkyDancerFlightAvoidance();
  }
}

export { SkyDancerCanvasPreviewV3 as SkyDancerCanvasPreview };
