import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../../cart/CartArenaSession";
import type { SkyDancerFxRuntime } from "../SkyDancerAirCombatFxV2";
import { scheduleSkyDancerV35ReferenceFraming } from "./SkyDancerCameraPresentation";

const CITY_SNAP = 420;
const GROUND_Y = -66.30;
const MAX_FOCUS_BUILDINGS = 880;
const MAX_FOCUS_STREETS = 36;
const MAX_FOCUS_RIVER = 24;
const FRONT_MOUNTAIN_FAR_COUNT = 22;
const FRONT_MOUNTAIN_NEAR_COUNT = 20;
const FRONT_CLOUD_COUNT = 32;
const FOCUS_CITY_LOCAL_CENTER_Z = 145;
const LEGACY_DYNAMIC_LAYER_NAMES = [
  "sky-dancer-v32-polish-ridge-near",
  "sky-dancer-v32-polish-ridge-far",
  "sky-dancer-v32-ridge-near",
  "sky-dancer-v32-ridge-far",
  "sky-dancer-v32-polish-cloud-main",
  "sky-dancer-v32-polish-cloud-shade",
  "sky-dancer-v32-hero-clouds",
  "sky-dancer-v32-hero-cloud-shade",
] as const;

function hash2(x: number, z: number, salt = 0): number {
  let n = Math.imul(x + 0x5bd1e995 + salt * 809, 0x27d4eb2d) ^ Math.imul(z - salt * 617, 0x165667b1);
  n ^= n >>> 15;
  n = Math.imul(n, 0x85ebca6b);
  n ^= n >>> 13;
  return (n >>> 0) / 0xffffffff;
}

/**
 * Capture-driven V35 presentation owner.
 *
 * The supplied reference reads as a city flyover rather than a city wall: the
 * aircraft stays prominent, dense urban detail occupies the center midground,
 * patchwork terrain remains readable on both sides, and a low faceted ridge
 * anchors the horizon. This owner keeps that hierarchy in fixed draw calls and
 * never changes the 300 m gameplay flight model.
 */
export class SkyDancerV35ReferencePass {
  private readonly focusRoot = new THREE.Group();
  private readonly focusBuildings: THREE.InstancedMesh;
  private readonly focusStreets: THREE.InstancedMesh;
  private readonly focusRiver: THREE.InstancedMesh;
  private readonly frontMountainsFar: THREE.InstancedMesh;
  private readonly frontMountainsNear: THREE.InstancedMesh;
  private readonly frontClouds: THREE.InstancedMesh;
  private readonly instanceDummy = new THREE.Object3D();
  private readonly cityPalette = [0x6d838e, 0x7c9199, 0x8ea0a5, 0xa4b0b3, 0x617984, 0xb4bdbe, 0x8799a0, 0x98a8ac]
    .map((value) => new THREE.Color(value));
  private readonly atmosphereColor = new THREE.Color(0x68acd2);
  private readonly legacyDynamicLayers: THREE.Object3D[];
  private readonly fields: THREE.Object3D | undefined;
  private readonly forest: THREE.Object3D | undefined;
  private readonly settlements: THREE.Object3D | undefined;
  private readonly towers: THREE.Object3D | undefined;
  private readonly roads: THREE.Object3D | undefined;
  private readonly v34Masses: THREE.Object3D | undefined;
  private focusTileX = Number.NaN;
  private focusTileZ = Number.NaN;
  private hierarchyTuned = false;
  private heroTuned = false;

  constructor(private readonly runtime: SkyDancerFxRuntime) {
    this.focusRoot.name = "sky-dancer-v35-reference-focus-city";
    this.focusRoot.userData.skyDancerV35LocalCenterZ = FOCUS_CITY_LOCAL_CENTER_Z;
    this.focusBuildings = this.makeFocusBuildings();
    this.focusStreets = this.makeFocusStreets();
    this.focusRiver = this.makeFocusRiver();
    this.frontMountainsFar = this.makeFrontMountainBelt(
      "sky-dancer-v35-front-mountains-far",
      FRONT_MOUNTAIN_FAR_COUNT,
      true,
    );
    this.frontMountainsNear = this.makeFrontMountainBelt(
      "sky-dancer-v35-front-mountains-near",
      FRONT_MOUNTAIN_NEAR_COUNT,
      false,
    );
    this.frontClouds = this.makeFrontClouds();
    this.focusRoot.add(
      this.focusStreets,
      this.focusRiver,
      this.focusBuildings,
      this.frontMountainsFar,
      this.frontMountainsNear,
      this.frontClouds,
    );

    this.legacyDynamicLayers = LEGACY_DYNAMIC_LAYER_NAMES
      .map((name) => runtime.scene.getObjectByName(name))
      .filter((object): object is THREE.Object3D => object !== undefined);
    this.fields = runtime.scene.getObjectByName("sky-dancer-v31-patchwork-fields");
    this.forest = runtime.scene.getObjectByName("sky-dancer-v31-forest-belts");
    this.settlements = runtime.scene.getObjectByName("sky-dancer-v31-settlement-buildings");
    this.towers = runtime.scene.getObjectByName("sky-dancer-v31-landmark-towers");
    this.roads = runtime.scene.getObjectByName("sky-dancer-v31-road-network");
    this.v34Masses = runtime.scene.getObjectByName("sky-dancer-v34-irregular-terrain-masses");

    this.hideStaticLegacyLayers();
    runtime.scene.add(this.focusRoot);
    runtime.scene.userData.skyDancerV35ReferenceOwner = "single-pass";
    runtime.camera.far = Math.max(runtime.camera.far, 1900);
    runtime.camera.updateProjectionMatrix();
    scheduleSkyDancerV35ReferenceFraming(runtime);
  }

  update(snapshot: CartArenaSessionSnapshot): void {
    this.restoreOwnPresentation();
    for (const object of this.legacyDynamicLayers) object.visible = false;
    if (!this.hierarchyTuned) this.tuneFinalHierarchy();
    this.updateFocusCity(snapshot);
    this.tuneAtmosphere();
    this.tuneHeroAircraft();
  }

  private restoreOwnPresentation(): void {
    this.focusRoot.visible = true;
    this.focusBuildings.visible = true;
    this.focusStreets.visible = true;
    this.focusRiver.visible = true;
    this.frontMountainsFar.visible = true;
    this.frontMountainsNear.visible = true;
    this.frontClouds.visible = true;
  }

  private hideStaticLegacyLayers(): void {
    if (this.settlements) this.settlements.visible = false;
    if (this.towers) this.towers.visible = false;
    if (this.roads) this.roads.visible = false;
    if (this.v34Masses) this.v34Masses.visible = false;
  }

  private tuneFinalHierarchy(): void {
    this.hierarchyTuned = true;
    this.hideStaticLegacyLayers();

    if (this.fields instanceof THREE.InstancedMesh && this.fields.material instanceof THREE.MeshBasicMaterial) {
      this.fields.visible = true;
      this.fields.material.transparent = true;
      this.fields.material.opacity = 0.70;
      this.fields.material.depthWrite = true;
      this.fields.material.fog = true;
      this.fields.material.needsUpdate = true;
    }

    if (this.forest instanceof THREE.InstancedMesh && this.forest.material instanceof THREE.MeshLambertMaterial) {
      this.forest.visible = true;
      this.forest.material.transparent = true;
      this.forest.material.opacity = 0.06;
      this.forest.material.color.setHex(0x3f704d);
      this.forest.material.fog = true;
      this.forest.material.needsUpdate = true;
    }
  }

  private tuneAtmosphere(): void {
    const fog = this.runtime.scene.fog;
    if (fog instanceof THREE.Fog) {
      fog.color.setHex(0x92c4d8);
      fog.near = 620;
      fog.far = 1760;
    }
    if (this.runtime.scene.background !== this.atmosphereColor) {
      this.runtime.scene.background = this.atmosphereColor;
    }
  }

  private tuneHeroAircraft(): void {
    if (this.heroTuned) return;
    this.heroTuned = true;
    this.runtime.playerVisual.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        material.roughness = Math.min(material.roughness, 0.32);
        material.metalness = Math.max(material.metalness, 0.24);
        material.needsUpdate = true;
      }
    });
  }

  private updateFocusCity(snapshot: CartArenaSessionSnapshot): void {
    const tileX = Math.floor(snapshot.x / CITY_SNAP);
    const tileZ = Math.floor(snapshot.z / CITY_SNAP);
    if (tileX === this.focusTileX && tileZ === this.focusTileZ) return;
    this.focusTileX = tileX;
    this.focusTileZ = tileZ;

    this.focusRoot.position.set(tileX * CITY_SNAP + 140, 0, tileZ * CITY_SNAP + 300);
    this.focusRoot.userData.skyDancerV35WorldCenterZ = this.focusRoot.position.z + FOCUS_CITY_LOCAL_CENTER_Z;
    this.rebuildFocusCity(tileX, tileZ);
  }

  private rebuildFocusCity(tileX: number, tileZ: number): void {
    const dummy = this.instanceDummy;
    const palette = this.cityPalette;
    let buildingIndex = 0;
    let streetIndex = 0;
    let riverIndex = 0;
    const seed = Math.floor(hash2(tileX, tileZ, 400) * 1000);
    const spacing = 7.2;
    const startZ = 28;

    for (let row = 0; row < 32; row += 1) {
      const z = startZ + row * spacing;
      const riverX = -10 + Math.sin((z + seed) * 0.023) * 17;
      for (let column = -20; column <= 20 && buildingIndex < MAX_FOCUS_BUILDINGS; column += 1) {
        const x = column * spacing;
        const roadColumn = (column + 20) % 7 === 0;
        const roadRow = row % 6 === 0;
        if (roadColumn || roadRow || Math.abs(x - riverX) < 6.2) continue;

        const noise = hash2(tileX + column, tileZ + row, 800 + seed);
        const centerDistance = Math.hypot(x * 0.82, (z - FOCUS_CITY_LOCAL_CENTER_Z) * 0.54);
        const core = THREE.MathUtils.clamp(1 - centerDistance / 158, 0, 1);
        const depthGain = THREE.MathUtils.clamp((z - startZ) / 92, 0.08, 1);
        const blockType = hash2(column, row, 920 + seed);
        let height = 3.5 + noise * 6.3 + core * depthGain * (4.2 + noise * 16.0);
        let width = 2.7 + hash2(column, row, 1000 + seed) * 2.0;
        let depth = 2.7 + hash2(row, column, 1100 + seed) * 2.2;

        if (blockType > 0.86 && row > 6) {
          height *= 1.22;
          width *= 0.87;
          depth *= 0.87;
        } else if (blockType < 0.16) {
          height *= 0.72;
          width *= 1.20;
          depth *= 1.18;
        }

        const landmark = (row === 13 && column === -8)
          || (row === 18 && column === 8)
          || (row === 23 && column === 1)
          || (row === 27 && column === 13);
        if (landmark) {
          height = 47 + hash2(column, row, 1200 + seed) * 29;
          width = 4.5;
          depth = 4.5;
        }

        dummy.position.set(
          x + (hash2(column, row, 1300 + seed) - 0.5) * 0.7,
          GROUND_Y + 0.72 + height * 0.5,
          z + (hash2(row, column, 1400 + seed) - 0.5) * 0.7,
        );
        dummy.rotation.set(0, (hash2(column, row, 1500 + seed) - 0.5) * 0.035, 0);
        dummy.scale.set(width, height, depth);
        dummy.updateMatrix();
        this.focusBuildings.setMatrixAt(buildingIndex, dummy.matrix);
        this.focusBuildings.setColorAt(buildingIndex, palette[(row * 3 + column + palette.length * 16) % palette.length]);
        buildingIndex += 1;
      }
    }

    for (let column = -20; column <= 20 && streetIndex < MAX_FOCUS_STREETS; column += 7) {
      dummy.position.set(column * spacing, GROUND_Y + 0.78, 146);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(0.50, 0.045, 238);
      dummy.updateMatrix();
      this.focusStreets.setMatrixAt(streetIndex++, dummy.matrix);
    }
    for (let row = 0; row < 32 && streetIndex < MAX_FOCUS_STREETS; row += 6) {
      dummy.position.set(0, GROUND_Y + 0.79, startZ + row * spacing);
      dummy.rotation.set(0, Math.PI / 2, 0);
      dummy.scale.set(0.48, 0.045, 292);
      dummy.updateMatrix();
      this.focusStreets.setMatrixAt(streetIndex++, dummy.matrix);
    }

    const riverSegmentLength = 10.5;
    for (let segment = 0; segment < MAX_FOCUS_RIVER; segment += 1) {
      const z = 24 + segment * riverSegmentLength;
      const x = -10 + Math.sin((z + seed) * 0.023) * 17;
      const nextX = -10 + Math.sin((z + riverSegmentLength + seed) * 0.023) * 17;
      dummy.position.set((x + nextX) * 0.5, GROUND_Y + 0.80, z + riverSegmentLength * 0.5);
      dummy.rotation.set(0, Math.atan2(nextX - x, riverSegmentLength), 0);
      dummy.scale.set(7.0 + hash2(tileX, tileZ, 1700 + segment) * 2.2, 0.055, riverSegmentLength * 1.18);
      dummy.updateMatrix();
      this.focusRiver.setMatrixAt(riverIndex++, dummy.matrix);
    }

    this.focusBuildings.count = buildingIndex;
    this.focusBuildings.instanceMatrix.needsUpdate = true;
    if (this.focusBuildings.instanceColor) this.focusBuildings.instanceColor.needsUpdate = true;
    this.focusStreets.count = streetIndex;
    this.focusStreets.instanceMatrix.needsUpdate = true;
    this.focusRiver.count = riverIndex;
    this.focusRiver.instanceMatrix.needsUpdate = true;
  }

  private makeFocusBuildings(): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, fog: true }),
      MAX_FOCUS_BUILDINGS,
    );
    mesh.name = "sky-dancer-v35-focus-buildings";
    mesh.frustumCulled = false;
    return mesh;
  }

  private makeFocusStreets(): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({
        color: 0x768587,
        transparent: true,
        opacity: 0.42,
        fog: true,
        toneMapped: false,
      }),
      MAX_FOCUS_STREETS,
    );
    mesh.name = "sky-dancer-v35-focus-streets";
    mesh.frustumCulled = false;
    return mesh;
  }

  private makeFocusRiver(): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({
        color: 0x3b92b4,
        transparent: true,
        opacity: 0.95,
        fog: true,
        toneMapped: false,
      }),
      MAX_FOCUS_RIVER,
    );
    mesh.name = "sky-dancer-v35-focus-river";
    mesh.frustumCulled = false;
    return mesh;
  }

  private makeFrontMountainBelt(name: string, count: number, far: boolean): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1, 1, 5),
      new THREE.MeshBasicMaterial({
        color: far ? 0x718fa0 : 0x56798a,
        transparent: true,
        opacity: far ? 0.23 : 0.38,
        depthWrite: false,
        depthTest: true,
        fog: true,
        toneMapped: false,
      }),
      count,
    );
    mesh.name = name;
    const dummy = new THREE.Object3D();
    for (let index = 0; index < count; index += 1) {
      const x = -540 + index * (1080 / Math.max(1, count - 1));
      const height = far
        ? 30 + (index % 6) * 3.8 + Math.sin(index * 1.57) * 2.8
        : 41 + (index % 6) * 4.5 + Math.sin(index * 1.79) * 3.6;
      const width = far ? 112 + (index % 5) * 16 : 92 + (index % 5) * 15;
      const z = far ? 550 + (index % 4) * 22 : 480 + (index % 4) * 20;
      dummy.position.set(x, GROUND_Y + height * 0.47, z);
      dummy.rotation.set(0, (index % 3 - 1) * 0.10, 0);
      dummy.scale.set(width, height, width * (far ? 0.58 : 0.52));
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    return mesh;
  }

  private makeFrontClouds(): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        color: 0xf6f9fa,
        transparent: true,
        opacity: 0.20,
        depthWrite: false,
        depthTest: true,
        fog: true,
        toneMapped: false,
      }),
      FRONT_CLOUD_COUNT,
    );
    mesh.name = "sky-dancer-v35-front-cloud-patches";
    const dummy = new THREE.Object3D();
    for (let index = 0; index < FRONT_CLOUD_COUNT; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const lane = Math.floor(index / 2) % 8;
      const z = 105 + lane * 34 + Math.sin(index * 1.31) * 12;
      const x = side * (54 + (index % 6) * 29) + Math.cos(index * 1.87) * 12;
      const size = 13 + (index % 5) * 2.2;
      dummy.position.set(x, -47 - (index % 4) * 1.4, z);
      dummy.rotation.set(0.02 * (index % 3), index * 0.27, 0.015 * (index % 5));
      dummy.scale.set(size * 1.86, size * 0.095, size * 1.12);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    return mesh;
  }
}
