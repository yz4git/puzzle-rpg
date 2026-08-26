import type { CartArenaSession } from "../cart/CartArenaSession";
import { requestSkyDancerPlayerMissile } from "./SkyDancerPlayerWeapons";

let activeSession: CartArenaSession | null = null;

/** Keep the SHOT control bound to the renderer that is actually on screen. */
export function bindSkyDancerWeaponSession(session: CartArenaSession): void {
  activeSession = session;
}

export function unbindSkyDancerWeaponSession(session: CartArenaSession): void {
  if (activeSession === session) activeSession = null;
}

export function fireSkyDancerActiveWeapon(): boolean {
  if (!activeSession) return false;
  return requestSkyDancerPlayerMissile(activeSession);
}

export function getSkyDancerActiveWeaponSession(): CartArenaSession | null {
  return activeSession;
}
