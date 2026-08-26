import type { CartArenaSession } from "../cart/CartArenaSession";
import { SkyDancerCanvasPreviewV4 } from "./SkyDancerCanvasPreviewV4";
import { SkyDancerWebGLDemo } from "./SkyDancerWebGLDemo";
import {
  cancelSkyDancerTurboHold,
  getSkyDancerTurboState,
  setSkyDancerTurboHeld,
} from "./SkyDancerTurboModel";

interface TurboDemoRuntime {
  session: CartArenaSession;
  setBoost(active: boolean): void;
  pause(): void;
}

const WEBGL_PATCHED = "__skyDancerTurboInputIsolationWebGL__";
const CANVAS_PATCHED = "__skyDancerTurboInputIsolationCanvas__";
const DEBUG_KEY = "__skyDancerGetTurboState";

function exposeDebug(session: CartArenaSession): void {
  if (typeof window === "undefined") return;
  const globals = window as unknown as Record<string, unknown>;
  globals[DEBUG_KEY] = () => getSkyDancerTurboState(session);
}

function patchDemoPrototype(prototype: TurboDemoRuntime & Record<string, unknown>, key: string): void {
  if (prototype[key]) return;
  prototype[key] = true;

  const inheritedSetBoost = prototype.setBoost;
  prototype.setBoost = function skyDancerIsolatedSetBoost(this: TurboDemoRuntime, active: boolean): void {
    // Never expose a held Turbo input to the inherited Cart Rogue phase stack.
    // That stack contains many later Turbo wrappers whose charge/attack logic
    // was designed for a ground vehicle. Base flight therefore always sees
    // boost=false while the button is held; normal throttle/drag/steering stay intact.
    inheritedSetBoost.call(this, false);
    setSkyDancerTurboHeld(this.session, active);
    exposeDebug(this.session);
  };

  const inheritedPause = prototype.pause;
  prototype.pause = function skyDancerIsolatedPause(this: TurboDemoRuntime): void {
    cancelSkyDancerTurboHold(this.session);
    inheritedSetBoost.call(this, false);
    inheritedPause.call(this);
  };
}

export function installSkyDancerTurboInputIsolation(): void {
  patchDemoPrototype(
    SkyDancerWebGLDemo.prototype as unknown as TurboDemoRuntime & Record<string, unknown>,
    WEBGL_PATCHED,
  );
  patchDemoPrototype(
    SkyDancerCanvasPreviewV4.prototype as unknown as TurboDemoRuntime & Record<string, unknown>,
    CANVAS_PATCHED,
  );
}

installSkyDancerTurboInputIsolation();
