import type { CartArenaSession } from "../cart/CartArenaSession";

export interface SkyDancerTurboState {
  held: boolean;
  charge: number;
  holdSeconds: number;
  releaseSerial: number;
  releaseCharge: number;
  releaseAgeSeconds: number;
  preReleaseForwardSpeed: number;
  postReleaseForwardSpeed: number;
}

interface InternalTurboState {
  held: boolean;
  holdStartedMs: number;
  releaseSerial: number;
  releaseCharge: number;
  releaseAtMs: number;
  preReleaseForwardSpeed: number;
  postReleaseForwardSpeed: number;
}

const stateBySession = new WeakMap<object, InternalTurboState>();

export const SKY_DANCER_TURBO_FULL_CHARGE_SECONDS = 0.78;
export const SKY_DANCER_TURBO_RELEASE_BASE_KICK = 6.4;
export const SKY_DANCER_TURBO_RELEASE_CHARGE_KICK = 12.8;
export const SKY_DANCER_TURBO_RELEASE_DURATION_BASE = 1.18;
export const SKY_DANCER_TURBO_RELEASE_DURATION_CHARGE = 0.82;

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function stateFor(session: CartArenaSession): InternalTurboState {
  const key = session as unknown as object;
  const current = stateBySession.get(key);
  if (current) return current;
  const created: InternalTurboState = {
    held: false,
    holdStartedMs: 0,
    releaseSerial: 0,
    releaseCharge: 0,
    releaseAtMs: -1,
    preReleaseForwardSpeed: 0,
    postReleaseForwardSpeed: 0,
  };
  stateBySession.set(key, created);
  return created;
}

function syncHorizontalVelocity(session: CartArenaSession): void {
  const car = session.car;
  const forwardX = Math.sin(car.heading);
  const forwardZ = Math.cos(car.heading);
  const rightX = Math.cos(car.heading);
  const rightZ = -Math.sin(car.heading);
  car.velocity.x = forwardX * car.forwardVelocity + rightX * car.lateralVelocity;
  car.velocity.z = forwardZ * car.forwardVelocity + rightZ * car.lateralVelocity;
  car.speed = Math.hypot(car.velocity.x, car.velocity.z);
}

function releaseTurbo(session: CartArenaSession, state: InternalTurboState, charge: number): boolean {
  const car = session.car;
  state.preReleaseForwardSpeed = Math.abs(car.forwardVelocity);
  state.releaseCharge = charge;
  state.releaseAtMs = nowMs();

  if (!car.consumeBoostCharge()) {
    state.postReleaseForwardSpeed = state.preReleaseForwardSpeed;
    return false;
  }

  const direction = car.forwardVelocity < -0.2 ? -1 : 1;
  const launch = SKY_DANCER_TURBO_RELEASE_BASE_KICK + charge * SKY_DANCER_TURBO_RELEASE_CHARGE_KICK;
  const cap = car.definition.maxSpeed * (1.76 + charge * 0.22);
  car.forwardVelocity = direction * Math.min(cap, Math.abs(car.forwardVelocity) + launch);
  car.lateralVelocity *= 0.62 - charge * 0.18;
  car.boostActive = true;
  car.boostTimeRemaining = Math.max(
    car.boostTimeRemaining,
    SKY_DANCER_TURBO_RELEASE_DURATION_BASE + charge * SKY_DANCER_TURBO_RELEASE_DURATION_CHARGE,
  );
  car.boostCount += 1;
  car.boostChainCount = Math.max(1, Math.min(9, car.boostChainCount + 1));
  car.collisionImpact = Math.max(car.collisionImpact, 0.42 + charge * 0.24);
  syncHorizontalVelocity(session);

  state.releaseSerial += 1;
  state.postReleaseForwardSpeed = Math.abs(car.forwardVelocity);
  return true;
}

/**
 * Records the user's Turbo button state without touching aircraft motion while held.
 * The hold phase is intentionally physics-neutral; only button release applies a dash.
 */
export function setSkyDancerTurboHeld(session: CartArenaSession, active: boolean): boolean {
  const state = stateFor(session);
  const now = nowMs();

  if (active) {
    if (!state.held) {
      state.held = true;
      state.holdStartedMs = now;
    }
    return false;
  }

  if (!state.held) return false;
  const holdSeconds = Math.max(0, (now - state.holdStartedMs) / 1000);
  const charge = clamp(holdSeconds / SKY_DANCER_TURBO_FULL_CHARGE_SECONDS, 0, 1);
  state.held = false;
  state.holdStartedMs = 0;
  return releaseTurbo(session, state, charge);
}

export function cancelSkyDancerTurboHold(session: CartArenaSession): void {
  const state = stateFor(session);
  state.held = false;
  state.holdStartedMs = 0;
}

export function getSkyDancerTurboState(session: CartArenaSession): SkyDancerTurboState {
  const state = stateFor(session);
  const now = nowMs();
  const holdSeconds = state.held && state.holdStartedMs > 0
    ? Math.max(0, (now - state.holdStartedMs) / 1000)
    : 0;
  return {
    held: state.held,
    charge: state.held ? clamp(holdSeconds / SKY_DANCER_TURBO_FULL_CHARGE_SECONDS, 0, 1) : 0,
    holdSeconds,
    releaseSerial: state.releaseSerial,
    releaseCharge: state.releaseCharge,
    releaseAgeSeconds: state.releaseAtMs >= 0 ? Math.max(0, (now - state.releaseAtMs) / 1000) : Number.POSITIVE_INFINITY,
    preReleaseForwardSpeed: state.preReleaseForwardSpeed,
    postReleaseForwardSpeed: state.postReleaseForwardSpeed,
  };
}
