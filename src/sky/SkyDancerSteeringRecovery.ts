export interface SkyDancerSteeringRuntime {
  steer: number;
}

interface SteeringRecoveryHost extends Window {
  __skyDancerV29SteeringCleanup?: () => void;
  __skyDancerGetSteeringRecoveryDebug?: () => { activePointerId: number | null; steer: number };
}

const STEERING_SELECTOR = '[aria-label="Steering"]';
const STEERING_TRAVEL_PX = 44;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function steeringZoneFrom(target: EventTarget | null): Element | null {
  return target instanceof Element ? target.closest(STEERING_SELECTOR) : null;
}

/**
 * Safari can occasionally leave a captured PointerEvent alive after a long
 * touch session. The React steering zone then believes the old pointer still
 * owns the control and rejects every later pointerdown. This capture-phase
 * guard deliberately treats every fresh steering-zone pointerdown as the new
 * owner and mirrors its steering value directly into the live WebGL runtime.
 */
export function installSkyDancerSteeringRecovery(runtime: SkyDancerSteeringRuntime): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const host = window as SteeringRecoveryHost;
  host.__skyDancerV29SteeringCleanup?.();

  let activePointerId: number | null = null;
  let originX = 0;

  const reset = (): void => {
    activePointerId = null;
    runtime.steer = 0;
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (!steeringZoneFrom(event.target)) return;
    // Always reclaim ownership. A stale pointer id must never permanently
    // lock the steering control after an interrupted iPhone gesture.
    activePointerId = event.pointerId;
    originX = event.clientX;
    runtime.steer = 0;
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (activePointerId !== event.pointerId) return;
    runtime.steer = clamp((event.clientX - originX) / STEERING_TRAVEL_PX, -1, 1);
  };

  const onPointerEnd = (event: PointerEvent): void => {
    if (activePointerId !== event.pointerId) return;
    reset();
  };

  const onVisibilityChange = (): void => {
    if (document.visibilityState !== "visible") reset();
  };

  window.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("pointermove", onPointerMove, true);
  window.addEventListener("pointerup", onPointerEnd, true);
  window.addEventListener("pointercancel", onPointerEnd, true);
  window.addEventListener("blur", reset);
  document.addEventListener("visibilitychange", onVisibilityChange);

  // Lightweight runtime telemetry lets the real-browser audit deliberately
  // strand one pointer and verify that the next touch takes ownership again.
  host.__skyDancerGetSteeringRecoveryDebug = () => ({ activePointerId, steer: runtime.steer });

  host.__skyDancerV29SteeringCleanup = () => {
    window.removeEventListener("pointerdown", onPointerDown, true);
    window.removeEventListener("pointermove", onPointerMove, true);
    window.removeEventListener("pointerup", onPointerEnd, true);
    window.removeEventListener("pointercancel", onPointerEnd, true);
    window.removeEventListener("blur", reset);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    reset();
    delete host.__skyDancerGetSteeringRecoveryDebug;
    delete host.__skyDancerV29SteeringCleanup;
  };
}
