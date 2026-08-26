import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../cart/CartArenaSession";
import type { SkyDancerMissileState } from "./SkyDancerFlightCombat";
import { SkyDancerAirCombatFxV26 } from "./SkyDancerAirCombatFxV26";
import type { SkyDancerFxRuntime } from "./SkyDancerAirCombatFxV2";
import { installSkyDancerStageCycle } from "./SkyDancerStageCycle";

interface CityTile {
  root: THREE.Group;
  offsetX: number;
  offsetZ: number;
}

const WORLD_CHUNK = 210;
const CITY_TILE_RADIUS = 2;

/**
 * V27 keeps the reference city alive in a five-by-five ring around the player,
 * so landmark buildings are already present before they enter the camera.
 * The outer ring is deep in scene fog when it is recycled, hiding tile swaps.
 * It also removes the inherited airborne rock obstacles from the visible scene.
 */
export class SkyDancerAirCombatFxV27 extends SkyDancerAirCombatFxV26 {
  private readonly runtimeV27: SkyDancerFxRuntime;
  private cityRing: THREE.Group | null = null;
  private readonly cityTiles: CityTile[] = [];
  private cityChunkX = Number.NaN;
  private cityChunkZ = Number.NaN;

  constructor(runtime: SkyDancerFxRuntime) {
    super(runtime);
    this.runtimeV27 = runtime;
    installSkyDancerStageCycle();
  }

  override update(snapshot: CartArenaSessionSnapshot, missiles: SkyDancerMissileState, delta: number): void {
    super.update(snapshot, missiles, delta);
    this.hideAirborneObstacles();
    this.syncEnemyVisibility();
    this.ensureCityTileRing();
    this.updateCityTileRing(snapshot);
  }

  private hideAirborneObstacles(): void {
    for (const group of this.runtimeV27.obstacleGroups.values()) {
      group.visible = false;
    }
  }

  private syncEnemyVisibility(): void {
    const aliveIds = new Set(
      this.runtimeV27.session.enemies
        .filter((enemy) => enemy.alive)
        .map((enemy) => enemy.id),
    );
    for (const [id, group] of this.runtimeV27.enemyGroups) {
      group.visible = aliveIds.has(id);
    }
  }

  private ensureCityTileRing(): void {
    if (this.cityRing) return;
    const source = this.runtimeV27.scene.getObjectByName("sky-dancer-v25-landmark-city");
    if (!(source instanceof THREE.Group)) return;

    source.parent?.remove(source);
    const ring = new THREE.Group();
    ring.name = "sky-dancer-v27-landmark-city-ring";

    for (let offsetZ = -CITY_TILE_RADIUS; offsetZ <= CITY_TILE_RADIUS; offsetZ += 1) {
      for (let offsetX = -CITY_TILE_RADIUS; offsetX <= CITY_TILE_RADIUS; offsetX += 1) {
        const tile = source.clone(true);
        tile.name = `sky-dancer-v27-city-tile-${offsetX}-${offsetZ}`;
        tile.traverse((object) => {
          object.frustumCulled = false;
        });
        ring.add(tile);
        this.cityTiles.push({ root: tile, offsetX, offsetZ });
      }
    }

    this.runtimeV27.scene.add(ring);
    this.cityRing = ring;
  }

  private updateCityTileRing(snapshot: CartArenaSessionSnapshot): void {
    if (!this.cityRing) return;
    const centerX = Math.floor(snapshot.x / WORLD_CHUNK) * WORLD_CHUNK;
    const centerZ = Math.floor(snapshot.z / WORLD_CHUNK) * WORLD_CHUNK;
    if (centerX === this.cityChunkX && centerZ === this.cityChunkZ) return;

    this.cityChunkX = centerX;
    this.cityChunkZ = centerZ;
    for (const tile of this.cityTiles) {
      tile.root.position.set(
        centerX + tile.offsetX * WORLD_CHUNK,
        0,
        centerZ + tile.offsetZ * WORLD_CHUNK,
      );
    }
  }
}

export { SkyDancerAirCombatFxV27 as SkyDancerAirCombatFx };
