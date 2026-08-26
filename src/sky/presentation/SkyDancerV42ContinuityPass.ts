import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../../cart/CartArenaSession";
import type { SkyDancerFxRuntime } from "../SkyDancerAirCombatFxV2";

const CITY_SNAP = 420;
const GROUND_Y = -66.30;
const RIVER_SEGMENTS = 24;
const RIVER_SEGMENT_LENGTH = 10.5;
const DEBUG_KEY = "__skyDancerGetV42Continuity";

function hash2(x: number, z: number, salt = 0): number {
  let n = Math.imul(x + 0x5bd1e995 + salt * 809, 0x27d4eb2d) ^ Math.imul(z - salt * 617, 0x165667b1);
  n ^= n >>> 15;
  n = Math.imul(n, 0x85ebca6b);
  n ^= n >>> 13;
  return (n >>> 0) / 0xffffffff;
}

/**
 * Final V42 render continuity owner.
 *
 * V41 already owns the rolling terrain surface. Older reference passes still
 * moved a few visible ground/terrain-adjacent layers on independent 210/420 m
 * snaps, which made only part of the world disappear in a single frame. V42
 * removes those remaining snap owners from the final frame: the old V35 river
 * and street grid are replaced by one world-anchored river beside the V36 city,
 * the faint V31 forest belt is suppressed, and the distant V38 ridge follows
 * player translation continuously rather than jumping by a whole 420 m tile.
 */
export class SkyDancerV42ContinuityPass {
  private readonly riverRoot = new THREE.Group();
  private readonly river: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private anchored = false;
  private initialTileX = 0;
  private initialTileZ = 0;

  constructor(private readonly runtime: SkyDancerFxRuntime) {
    this.riverRoot.name = "sky-dancer-v42-stable-river-root";
    this.riverRoot.userData.skyDancerV42StableGroundAnchor = true;
    this.river = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({
        color: 0x2d84ad,
        transparent: true,
        opacity: 0.78,
        depthWrite: true,
        depthTest: true,
        fog: true,
        toneMapped: false,
      }),
      RIVER_SEGMENTS,
    );
    this.river.name = "sky-dancer-v42-stable-river";
    this.river.frustumCulled = false;
    this.riverRoot.add(this.river);
    runtime.scene.add(this.riverRoot);
    runtime.scene.userData.skyDancerV42ContinuityOwner = true;
  }

  update(snapshot: CartArenaSessionSnapshot): void {
    if (!this.anchored) this.anchorRiver(snapshot);
    this.riverRoot.visible = true;
    this.river.visible = true;

    const legacyStreets = this.runtime.scene.getObjectByName("sky-dancer-v35-focus-streets");
    const legacyRiver = this.runtime.scene.getObjectByName("sky-dancer-v35-focus-river");
    const legacyForest = this.runtime.scene.getObjectByName("sky-dancer-v31-forest-belts");
    if (legacyStreets) legacyStreets.visible = false;
    if (legacyRiver) legacyRiver.visible = false;
    if (legacyForest) legacyForest.visible = false;

    // The ridge is distant backdrop geometry. Keeping its origin centered on
    // the aircraft by continuous translation preserves parallax-free horizon
    // coverage without the old whole-tile jump at 420 m boundaries.
    const ridgeRoot = this.runtime.scene.getObjectByName("sky-dancer-v38-ridge-root");
    if (ridgeRoot) {
      ridgeRoot.position.set(snapshot.x, 0, snapshot.z);
      ridgeRoot.visible = true;
    }

    if (typeof window !== "undefined" && navigator.webdriver) {
      (window as unknown as Record<string, unknown>)[DEBUG_KEY] = () => ({
        stableRiver: this.anchored && this.river.visible,
        riverRootPosition: { x: this.riverRoot.position.x, z: this.riverRoot.position.z },
        initialTileX: this.initialTileX,
        initialTileZ: this.initialTileZ,
        legacyStreetHidden: legacyStreets ? !legacyStreets.visible : true,
        legacyRiverHidden: legacyRiver ? !legacyRiver.visible : true,
        legacyForestHidden: legacyForest ? !legacyForest.visible : true,
        ridgePosition: ridgeRoot ? { x: ridgeRoot.position.x, z: ridgeRoot.position.z } : null,
      });
    }
  }

  private anchorRiver(snapshot: CartArenaSessionSnapshot): void {
    this.initialTileX = Math.floor(snapshot.x / CITY_SNAP);
    this.initialTileZ = Math.floor(snapshot.z / CITY_SNAP);
    this.riverRoot.position.set(
      this.initialTileX * CITY_SNAP + 140,
      0,
      this.initialTileZ * CITY_SNAP + 300,
    );
    const seed = Math.floor(hash2(this.initialTileX, this.initialTileZ, 400) * 1000);
    for (let segment = 0; segment < RIVER_SEGMENTS; segment += 1) {
      const z = 24 + segment * RIVER_SEGMENT_LENGTH;
      const x = -10 + Math.sin((z + seed) * 0.023) * 17;
      const nextX = -10 + Math.sin((z + RIVER_SEGMENT_LENGTH + seed) * 0.023) * 17;
      this.dummy.position.set((x + nextX) * 0.5, GROUND_Y + 0.80, z + RIVER_SEGMENT_LENGTH * 0.5);
      this.dummy.rotation.set(0, Math.atan2(nextX - x, RIVER_SEGMENT_LENGTH), 0);
      this.dummy.scale.set(
        7.0 + hash2(this.initialTileX, this.initialTileZ, 1700 + segment) * 2.2,
        0.055,
        RIVER_SEGMENT_LENGTH * 1.18,
      );
      this.dummy.updateMatrix();
      this.river.setMatrixAt(segment, this.dummy.matrix);
    }
    this.river.count = RIVER_SEGMENTS;
    this.river.instanceMatrix.needsUpdate = true;
    this.anchored = true;
  }
}
