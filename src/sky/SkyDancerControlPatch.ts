import { CartRogueCanvasPreview } from "../cart/CartRogueCanvasPreview";
import { CartRogueWebGLDemo } from "../cart/CartRogueWebGLDemo";

const PATCHED_KEY = "__skyDancerNoBrakeInstalled__";

type BrakePrototype = {
  setBrake(active: boolean): void;
  [PATCHED_KEY]?: boolean;
};

function patchBrake(prototype: BrakePrototype): void {
  if (prototype[PATCHED_KEY]) return;
  prototype[PATCHED_KEY] = true;
  const original = prototype.setBrake;
  prototype.setBrake = function skyDancerBrakeDisabled(this: BrakePrototype): void {
    original.call(this, false);
  };
}

export function installSkyDancerControlPatch(): void {
  patchBrake(CartRogueWebGLDemo.prototype as unknown as BrakePrototype);
  patchBrake(CartRogueCanvasPreview.prototype as unknown as BrakePrototype);
}

installSkyDancerControlPatch();
