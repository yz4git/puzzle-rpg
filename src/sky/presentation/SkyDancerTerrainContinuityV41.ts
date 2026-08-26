import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../../cart/CartArenaSession";
import type { SkyDancerFxRuntime } from "../SkyDancerAirCombatFxV2";

const TILE_SIZE = 360;
const TILE_RADIUS = 2;
const TILE_SEGMENTS = 12;
const GROUND_Y = -66.30;
const GLOBAL_DEBUG_KEY = "__skyDancerGetTerrainContinuityV41";

export interface SkyDancerTerrainContinuitySnapshotV41 {
  centerTileX: number;
  centerTileZ: number;
  visibleTiles: number;
  reliefSpan: number;
  legacyTerrainHidden: boolean;
}

interface TerrainTile {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshLambertMaterial>;
  positions: THREE.BufferAttribute;
  colors: THREE.BufferAttribute;
  tileX: number;
  tileZ: number;
}

function worldHeight(x: number, z: number): number {
  const broad = Math.sin(x * 0.0061) * Math.cos(z * 0.0053) * 1.65;
  const ridge = Math.sin((x + z) * 0.0107 + Math.cos(z * 0.0039)) * 0.92;
  const secondary = Math.cos((x - z * 0.72) * 0.0141) * 0.48;
  return GROUND_Y + 0.34 + broad + ridge + secondary;
}

function terrainColor(height: number, x: number, z: number): THREE.Color {
  const normalized = THREE.MathUtils.clamp((height - (GROUND_Y - 2.8)) / 6.0, 0, 1);
  const low = new THREE.Color(0x3f6946);
  const high = new THREE.Color(0x718451);
  const color = low.lerp(high, normalized);
  const variation = 0.93 + (Math.sin(x * 0.021) * Math.cos(z * 0.018) * 0.5 + 0.5) * 0.10;
  return color.multiplyScalar(variation);
}

/**
 * Persistent rolling terrain for the infinite flight world.
 *
 * V36 rebuilt one large mesh on a 420 m snap, so every snap replaced all of
 * the visible vertex heights at once. V41 keeps a 5x5 ring of deterministic
 * world-space tiles. Crossing a tile boundary only recycles the distant outer
 * row; overlapping tiles retain exactly the same world coordinates/heights.
 */
export class SkyDancerTerrainContinuityV41 {
  private readonly root = new THREE.Group();
  private readonly tiles: TerrainTile[] = [];
  private centerTileX = Number.NaN;
  private centerTileZ = Number.NaN;
  private latest: SkyDancerTerrainContinuitySnapshotV41 = {
    centerTileX: 0,
    centerTileZ: 0,
    visibleTiles: 0,
    reliefSpan: 0,
    legacyTerrainHidden: false,
  };

  constructor(private readonly runtime: SkyDancerFxRuntime) {
    this.root.name = "sky-dancer-v41-continuous-terrain-root";
    for (let index = 0; index < (TILE_RADIUS * 2 + 1) ** 2; index += 1) {
      const geometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE, TILE_SEGMENTS, TILE_SEGMENTS);
      geometry.rotateX(-Math.PI / 2);
      const position = geometry.getAttribute("position") as THREE.BufferAttribute;
      const colors = new Float32Array(position.count * 3);
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const material = new THREE.MeshLambertMaterial({
        vertexColors: true,
        flatShading: true,
        fog: true,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `sky-dancer-v41-continuous-terrain-${index}`;
      mesh.frustumCulled = false;
      mesh.renderOrder = -2;
      this.root.add(mesh);
      this.tiles.push({
        mesh,
        positions: position,
        colors: geometry.getAttribute("color") as THREE.BufferAttribute,
        tileX: Number.NaN,
        tileZ: Number.NaN,
      });
    }
    runtime.scene.add(this.root);
    runtime.scene.userData.skyDancerV41TerrainContinuity = true;
  }

  update(snapshot: CartArenaSessionSnapshot): void {
    const legacyTerrain = this.runtime.scene.getObjectByName("sky-dancer-v36-faceted-terrain");
    if (legacyTerrain) {
      legacyTerrain.visible = false;
      legacyTerrain.userData.skyDancerV41Superseded = true;
    }
    this.root.visible = true;
    const nextTileX = Math.floor((snapshot.x + TILE_SIZE * 0.5) / TILE_SIZE);
    const nextTileZ = Math.floor((snapshot.z + TILE_SIZE * 0.5) / TILE_SIZE);
    if (nextTileX !== this.centerTileX || nextTileZ !== this.centerTileZ) {
      this.centerTileX = nextTileX;
      this.centerTileZ = nextTileZ;
      this.rebuildRing();
    }
    this.latest.legacyTerrainHidden = legacyTerrain ? !legacyTerrain.visible : true;
    if (typeof window !== "undefined" && navigator.webdriver) {
      (window as unknown as Record<string, unknown>)[GLOBAL_DEBUG_KEY] = () => ({ ...this.latest });
    }
  }

  private rebuildRing(): void {
    let tileIndex = 0;
    let minHeight = Number.POSITIVE_INFINITY;
    let maxHeight = Number.NEGATIVE_INFINITY;
    for (let dz = -TILE_RADIUS; dz <= TILE_RADIUS; dz += 1) {
      for (let dx = -TILE_RADIUS; dx <= TILE_RADIUS; dx += 1) {
        const tile = this.tiles[tileIndex++];
        const tileX = this.centerTileX + dx;
        const tileZ = this.centerTileZ + dz;
        tile.tileX = tileX;
        tile.tileZ = tileZ;
        tile.mesh.position.set(tileX * TILE_SIZE, 0, tileZ * TILE_SIZE);
        const position = tile.positions;
        for (let index = 0; index < position.count; index += 1) {
          const localX = position.getX(index);
          const localZ = position.getZ(index);
          const worldX = tileX * TILE_SIZE + localX;
          const worldZ = tileZ * TILE_SIZE + localZ;
          const height = worldHeight(worldX, worldZ);
          position.setY(index, height);
          const color = terrainColor(height, worldX, worldZ);
          tile.colors.setXYZ(index, color.r, color.g, color.b);
          minHeight = Math.min(minHeight, height);
          maxHeight = Math.max(maxHeight, height);
        }
        position.needsUpdate = true;
        tile.colors.needsUpdate = true;
        tile.mesh.geometry.computeVertexNormals();
        tile.mesh.geometry.computeBoundingSphere();
        tile.mesh.visible = true;
      }
    }
    this.latest = {
      centerTileX: this.centerTileX,
      centerTileZ: this.centerTileZ,
      visibleTiles: this.tiles.filter((tile) => tile.mesh.visible).length,
      reliefSpan: maxHeight - minHeight,
      legacyTerrainHidden: true,
    };
  }
}
