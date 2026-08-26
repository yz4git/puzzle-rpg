import type { CartArenaSessionSnapshot } from "../../cart/CartArenaSession";
import type { SkyDancerFxRuntime } from "../SkyDancerAirCombatFxV2";

interface CameraPresentationRuntime extends SkyDancerFxRuntime {
  applyCameraPresentation?(snapshot: CartArenaSessionSnapshot): void;
}

function scheduleInstall(install: () => void): void {
  if (typeof queueMicrotask === "function") queueMicrotask(install);
  else install();
}

/** Preserve V31's camera decorator while keeping it out of the FX inheritance chain. */
export function scheduleSkyDancerV31CameraPitch(runtime: SkyDancerFxRuntime): void {
  scheduleInstall(() => {
    const cameraRuntime = runtime as CameraPresentationRuntime;
    if (cameraRuntime.camera.userData.skyDancerV31PitchInstalled === true) return;
    const inherited = cameraRuntime.applyCameraPresentation;
    if (typeof inherited !== "function") return;
    const base = inherited.bind(cameraRuntime);
    cameraRuntime.applyCameraPresentation = (snapshot: CartArenaSessionSnapshot) => {
      base(snapshot);
      cameraRuntime.camera.rotateX(-0.08);
    };
    cameraRuntime.camera.userData.skyDancerV31PitchInstalled = true;
  });
}

/** Preserve V32's final horizon balance as the last historical camera decorator. */
export function scheduleSkyDancerV32CameraBalance(runtime: SkyDancerFxRuntime): void {
  scheduleInstall(() => {
    const cameraRuntime = runtime as CameraPresentationRuntime;
    if (cameraRuntime.camera.userData.skyDancerV32ReferenceCamera === true) return;
    const inherited = cameraRuntime.applyCameraPresentation;
    if (typeof inherited !== "function") return;
    const base = inherited.bind(cameraRuntime);
    cameraRuntime.applyCameraPresentation = (snapshot: CartArenaSessionSnapshot) => {
      base(snapshot);
      cameraRuntime.camera.rotateX(0.095);
    };
    cameraRuntime.camera.userData.skyDancerV32ReferenceCamera = true;
  });
}

/**
 * V35 keeps the aircraft in the lower-middle frame while preserving a broad sky
 * band above the city. Pass 7 eases the pass-6 pitch slightly so the aircraft
 * and skyline sit closer to the supplied reference instead of hugging the
 * bottom edge. Gameplay altitude and collision coordinates are untouched.
 */
export function scheduleSkyDancerV35ReferenceFraming(runtime: SkyDancerFxRuntime): void {
  scheduleInstall(() => {
    const cameraRuntime = runtime as CameraPresentationRuntime;
    if (cameraRuntime.camera.userData.skyDancerV35ReferenceFraming === true) return;
    const inherited = cameraRuntime.applyCameraPresentation;
    if (typeof inherited !== "function") return;
    const base = inherited.bind(cameraRuntime);
    cameraRuntime.applyCameraPresentation = (snapshot: CartArenaSessionSnapshot) => {
      base(snapshot);
      cameraRuntime.camera.rotateX(0.205);
    };
    cameraRuntime.camera.userData.skyDancerV35ReferenceFraming = true;
  });
}
