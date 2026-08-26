import { CartArenaSession } from "../cart/CartArenaSession";
import type { CartEnemyState } from "../cart/CartCombat";
import type { CartObstacleState } from "../cart/CartObstacles";
import { isCartTurboHuntEnabled } from "../cart/CartRoguePhase67TurboHunt";
import { installCartRoguePhase67HuntRecoveryBounds } from "../cart/CartRoguePhase67HuntRecoveryBounds";
import type { CartResourcePickupState } from "../cart/CartResources";
import {
  CART_TURBO_HUNT_FIELD,
  CART_TURBO_HUNT_TRACK,
  CART_TURBO_HUNT_WORLD_DEPTH,
  CART_TURBO_HUNT_WORLD_WIDTH,
  cartTurboHuntNearestCoordinate,
  cartTurboHuntWrapCoordinate,
} from "../cart/CartTurboHuntTrack";
import { RallyTrack } from "../rally/RallyTrack";
import type { RallyInputState } from "../rally/RallyTypes";

interface InfiniteWorldSession {
  car: CartArenaSession["car"];
  enemies: CartEnemyState[];
  resources: CartResourcePickupState[];
  obstacles: CartObstacleState[];
  location: {
    node: {
      id: string;
      rect: { centerX: number; centerZ: number; halfWidth: number; halfDepth: number };
    };
    localX: number;
    localZ: number;
  };
  step(input: RallyInputState, fixedDelta?: number): void;
}

const SESSION_PATCHED_KEY = "__skyDancerInfiniteWorldInstalled__";
const TRACK_PATCHED_KEY = "__skyDancerInfiniteTrackInstalled__";
const LOGICAL_AIRSPACE_HALF_SIZE = 10_000_000;

function tilePointAroundPlayer(point: { x: number; z: number }, playerX: number, playerZ: number): void {
  point.x = cartTurboHuntNearestCoordinate(point.x, playerX, CART_TURBO_HUNT_WORLD_WIDTH);
  point.z = cartTurboHuntNearestCoordinate(point.z, playerZ, CART_TURBO_HUNT_WORLD_DEPTH);
}

function tileDynamicWorld(session: InfiniteWorldSession): void {
  const playerX = session.car.position.x;
  const playerZ = session.car.position.z;
  for (const enemy of session.enemies) tilePointAroundPlayer(enemy, playerX, playerZ);
  for (const pickup of session.resources) tilePointAroundPlayer(pickup, playerX, playerZ);
  for (const obstacle of session.obstacles) tilePointAroundPlayer(obstacle, playerX, playerZ);
}

function installPeriodicTrackQueries(): void {
  const prototype = RallyTrack.prototype as RallyTrack & Record<string, unknown>;
  if (prototype[TRACK_PATCHED_KEY]) return;
  prototype[TRACK_PATCHED_KEY] = true;
  const previousQuery = prototype.queryAt;

  prototype.queryAt = function skyDancerPeriodicTrackQuery(
    this: RallyTrack,
    x: number,
    z: number,
    hintSegment?: number,
  ) {
    if (this.id !== CART_TURBO_HUNT_TRACK.id) return previousQuery.call(this, x, z, hintSegment);
    return previousQuery.call(
      this,
      cartTurboHuntWrapCoordinate(x, CART_TURBO_HUNT_FIELD.centerX, CART_TURBO_HUNT_WORLD_WIDTH),
      cartTurboHuntWrapCoordinate(z, CART_TURBO_HUNT_FIELD.centerZ, CART_TURBO_HUNT_WORLD_DEPTH),
      hintSegment,
    );
  };
}

/**
 * Turns the authored Hunt tile into an unbounded, repeated airspace.
 *
 * The aircraft and camera retain continuous world coordinates. Enemies,
 * pickups and obstacles move to their nearest repeated image as the player
 * crosses a tile seam, so there is no teleport, collision wall or dead edge.
 */
export function installSkyDancerInfiniteWorld(): void {
  installCartRoguePhase67HuntRecoveryBounds();
  installPeriodicTrackQueries();
  const prototype = CartArenaSession.prototype as unknown as InfiniteWorldSession & Record<string, unknown>;
  if (prototype[SESSION_PATCHED_KEY]) return;
  prototype[SESSION_PATCHED_KEY] = true;
  const previousStep = prototype.step;

  prototype.step = function skyDancerInfiniteWorldStep(
    this: InfiniteWorldSession,
    input: RallyInputState,
    fixedDelta?: number,
  ): void {
    const session = this as unknown as CartArenaSession;
    if (!isCartTurboHuntEnabled(session)) {
      previousStep.call(this, input, fixedDelta);
      return;
    }

    tileDynamicWorld(this);
    const huntNode = this.location.node;
    const rect = huntNode.rect;
    const savedCenterX = rect.centerX;
    const savedCenterZ = rect.centerZ;
    const savedHalfWidth = rect.halfWidth;
    const savedHalfDepth = rect.halfDepth;
    rect.centerX = CART_TURBO_HUNT_FIELD.centerX;
    rect.centerZ = CART_TURBO_HUNT_FIELD.centerZ;
    rect.halfWidth = LOGICAL_AIRSPACE_HALF_SIZE;
    rect.halfDepth = LOGICAL_AIRSPACE_HALF_SIZE;

    try {
      previousStep.call(this, input, fixedDelta);
    } finally {
      rect.centerX = savedCenterX;
      rect.centerZ = savedCenterZ;
      rect.halfWidth = savedHalfWidth;
      rect.halfDepth = savedHalfDepth;
    }

    tileDynamicWorld(this);
    this.location = {
      node: huntNode,
      localX: cartTurboHuntWrapCoordinate(
        this.car.position.x,
        CART_TURBO_HUNT_FIELD.centerX,
        CART_TURBO_HUNT_WORLD_WIDTH,
      ) - CART_TURBO_HUNT_FIELD.centerX,
      localZ: cartTurboHuntWrapCoordinate(
        this.car.position.z,
        CART_TURBO_HUNT_FIELD.centerZ,
        CART_TURBO_HUNT_WORLD_DEPTH,
      ) - CART_TURBO_HUNT_FIELD.centerZ,
    };
  };
}
