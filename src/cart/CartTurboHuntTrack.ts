import type { RallyTrackDefinition } from "../rally/tracks/TrackDefinition";

/**
 * Physics-only support surface for Turbo Hunt.
 *
 * Cart Rogue still delegates low-level suspension/surface queries to RallyTrack.
 * The Hunt field is deliberately one very wide flat road so the inherited car
 * physics remain stable while gameplay is free to use the whole 184×184 arena.
 */
export const CART_TURBO_HUNT_FIELD = {
  id: "hunt-field",
  centerX: 560,
  centerZ: 220,
  halfWidth: 92,
  halfDepth: 92,
  spawnX: 560,
  spawnZ: 162,
} as const;

export const CART_TURBO_HUNT_WORLD_WIDTH = CART_TURBO_HUNT_FIELD.halfWidth * 2;
export const CART_TURBO_HUNT_WORLD_DEPTH = CART_TURBO_HUNT_FIELD.halfDepth * 2;

/** Wrap a coordinate into the authored Turbo Hunt tile. */
export function cartTurboHuntWrapCoordinate(value: number, center: number, period: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(center) || !Number.isFinite(period) || period <= 0) return value;
  const half = period * 0.5;
  const wrapped = ((value - center + half) % period + period) % period;
  return center + wrapped - half;
}

/** Return the repeated image of value that is closest to reference. */
export function cartTurboHuntNearestCoordinate(value: number, reference: number, period: number): number {
  return reference + cartTurboHuntWrapCoordinate(value - reference, 0, period);
}

export function cartTurboHuntWrappedDelta(value: number, reference: number, period: number): number {
  return cartTurboHuntWrapCoordinate(value - reference, 0, period);
}

export function cartTurboHuntTileCenter(value: number, center: number, period: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(center) || !Number.isFinite(period) || period <= 0) return center;
  return center + Math.floor((value - center + period * 0.5) / period) * period;
}

export const CART_TURBO_HUNT_TRACK: RallyTrackDefinition = {
  id: "cart-turbo-hunt-field-01",
  name: "Turbo Hunt Field",
  roadWidth: 224,
  segments: 192,
  checkpoints: [0.25, 0.5, 0.75],
  medalTimes: { bronze: 300, silver: 240, gold: 190 },
  scenery: { count: 0, radiusX: 240, radiusZ: 240 },
  controlPoints: [
    { x: 560, z: 162, y: 0, width: 224 },
    { x: 610, z: 170, y: 0, width: 224 },
    { x: 638, z: 220, y: 0, width: 224 },
    { x: 610, z: 276, y: 0, width: 224 },
    { x: 560, z: 298, y: 0, width: 224 },
    { x: 510, z: 276, y: 0, width: 224 },
    { x: 482, z: 220, y: 0, width: 224 },
    { x: 510, z: 170, y: 0, width: 224 },
  ],
  surfaceZones: [
    { id: "hunt-surface", start: 0, end: 1, surface: "road" },
  ],
  pickups: [],
  obstacles: [],
};
