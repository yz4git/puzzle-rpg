import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../cart/CartArenaSession";
import { getCartTurboHuntSnapshot } from "../cart/CartRoguePhase67TurboHunt";
import type { SkyDancerMissileState } from "./SkyDancerFlightCombat";
import { SkyDancerAirCombatFxV27 } from "./SkyDancerAirCombatFxV27";
import type { SkyDancerFxRuntime } from "./SkyDancerAirCombatFxV2";
import {
  SKY_DANCER_V28_ALTITUDE_LIFT_METERS,
  SKY_DANCER_V28_ALTITUDE_METERS,
  installSkyDancerV28Tuning,
} from "./SkyDancerV28Tuning";

interface V28Runtime extends SkyDancerFxRuntime {
  renderer?: THREE.WebGLRenderer;
}

interface SmokePuff {
  x: number;
  y: number;
  z: number;
  age: number;
  maxAge: number;
}

const WORLD_CHUNK = 210;
const BASE_ALTITUDE_METERS = 150;
const BASE_VERTICAL_RENDER_UNITS = 38;
const METERS_PER_RENDER_UNIT = BASE_ALTITUDE_METERS / BASE_VERTICAL_RENDER_UNITS;
const ALTITUDE_SHIFT_UNITS = SKY_DANCER_V28_ALTITUDE_LIFT_METERS / METERS_PER_RENDER_UNIT;
const REFERENCE_GROUND_Y = -28.45 - ALTITUDE_SHIFT_UNITS;
const FIELD_TILE_RADIUS = 2;
const FIELD_PATCHES_PER_TILE = 8;
const SMOKE_POOL_SIZE = 72;
const SMOKE_LIFETIME = 1.15;

/**
 * V28 pushes the live scene toward the supplied arcade-air-combat reference:
 * higher flight altitude, a broader green valley/lake read, denser skyline,
 * low-poly mountain depth, layered clouds, stronger hero presence and long
 * white missile smoke. Everything remains geometry/material driven for mobile.
 */
export class SkyDancerAirCombatFxV28 extends SkyDancerAirCombatFxV27 {
  private readonly runtimeV28: V28Runtime;
  private builtV28 = false;
  private readonly scenicRoot = new THREE.Group();
  private fieldMesh: THREE.InstancedMesh | null = null;
  private mountainMesh: THREE.InstancedMesh | null = null;
  private cloudMesh: THREE.InstancedMesh | null = null;
  private lake: THREE.Mesh | null = null;
  private smokeMesh: THREE.InstancedMesh | null = null;
  private readonly smokePuffs: SmokePuff[] = [];
  private smokeCursor = 0;
  private readonly missileSampleClocks = new Map<number, number>();
  private scenicChunkX = Number.NaN;
  private scenicChunkZ = Number.NaN;
  private readonly dummy = new THREE.Object3D();

  constructor(runtime: SkyDancerFxRuntime) {
    super(runtime);
    this.runtimeV28 = runtime as V28Runtime;
    this.scenicRoot.name = "sky-dancer-v28-reference-scenery";
    installSkyDancerV28Tuning();
  }

  override update(snapshot: CartArenaSessionSnapshot, missiles: SkyDancerMissileState, delta: number): void {
    super.update(snapshot, missiles, delta);
    if (!this.builtV28) {
      this.builtV28 = true;
      this.configureReferenceGrade();
      this.buildPatchworkValley();
      this.buildLake();
      this.buildMountainDepth();
      this.buildCloudBanks();
      this.buildMissileSmoke();
      this.decorateEnemyPips();
      this.enhanceHeroAndCity();
      this.runtimeV28.scene.add(this.scenicRoot);
    }

    this.applyHigherAltitude();
    this.updateSceneryAnchor(snapshot);
    this.updateEnemyPips();
    this.updateMissileSmoke(missiles, Math.max(0.001, Math.min(0.05, delta)));
  }

  private configureReferenceGrade(): void {
    const renderer = this.runtimeV28.renderer;
    if (renderer) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    this.runtimeV28.scene.background = new THREE.Color(0x2f91c8);
    this.runtimeV28.scene.fog = new THREE.Fog(0xa8d7ea, 275, 900);
    this.runtimeV28.camera.far = Math.max(this.runtimeV28.camera.far, 960);
    this.runtimeV28.camera.updateProjectionMatrix();
    this.runtimeV28.scene.userData.skyDancerAltitudeMeters = SKY_DANCER_V28_ALTITUDE_METERS;
    this.runtimeV28.scene.userData.verticalRenderScaleMetersPerUnit = METERS_PER_RENDER_UNIT;
  }

  private applyHigherAltitude(): void {
    const scene = this.runtimeV28.scene;
    scene.userData.skyDancerAltitudeMeters = SKY_DANCER_V28_ALTITUDE_METERS;
    scene.userData.verticalRenderScaleMetersPerUnit = METERS_PER_RENDER_UNIT;

    const referenceWorld = scene.getObjectByName("sky-dancer-v25-reference-world");
    if (referenceWorld) referenceWorld.position.y = -ALTITUDE_SHIFT_UNITS;
    const cityRing = scene.getObjectByName("sky-dancer-v27-landmark-city-ring");
    if (cityRing) cityRing.position.y = -ALTITUDE_SHIFT_UNITS;

    for (const object of scene.children) {
      if (object === this.scenicRoot || object === referenceWorld || object === cityRing) continue;
      if (object.userData.skyDancerV28AltitudeShifted === true) continue;
      const isBaseCloudDeck = object instanceof THREE.InstancedMesh
        && object.name === ""
        && object.geometry.type === "DodecahedronGeometry";
      const isLowEnvironmentObject = object.position.y < -5;
      if (!isBaseCloudDeck && !isLowEnvironmentObject) continue;
      object.position.y -= ALTITUDE_SHIFT_UNITS;
      object.userData.skyDancerV28AltitudeShifted = true;
    }
  }

  private buildPatchworkValley(): void {
    const tileCount = (FIELD_TILE_RADIUS * 2 + 1) ** 2;
    const count = tileCount * FIELD_PATCHES_PER_TILE;
    const material = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
    });
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, count);
    mesh.name = "sky-dancer-v28-patchwork-valley";
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    this.fieldMesh = mesh;
    this.scenicRoot.add(mesh);
  }

  private buildLake(): void {
    const material = new THREE.MeshStandardMaterial({
      color: 0x297fa8,
      emissive: 0x0c4768,
      emissiveIntensity: 0.22,
      roughness: 0.18,
      metalness: 0.16,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
    });
    const lake = new THREE.Mesh(new THREE.CircleGeometry(62, 40), material);
    lake.name = "sky-dancer-v28-valley-lake";
    lake.rotation.x = -Math.PI / 2;
    lake.scale.set(1.5, 0.72, 1);
    lake.position.set(34, REFERENCE_GROUND_Y + 0.46, 42);
    lake.renderOrder = -4;
    this.lake = lake;
    this.scenicRoot.add(lake);
  }

  private buildMountainDepth(): void {
    const count = 68;
    const material = new THREE.MeshLambertMaterial({
      color: 0x477b70,
      flatShading: true,
      transparent: true,
      opacity: 0.92,
    });
    const mesh = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), material, count);
    mesh.name = "sky-dancer-v28-mountain-depth";
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    this.mountainMesh = mesh;
    this.scenicRoot.add(mesh);
  }

  private buildCloudBanks(): void {
    const count = 52;
    const material = new THREE.MeshLambertMaterial({
      color: 0xf5fbff,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      flatShading: true,
    });
    const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), material, count);
    mesh.name = "sky-dancer-v28-layered-cloud-banks";
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    this.cloudMesh = mesh;
    this.scenicRoot.add(mesh);
  }

  private buildMissileSmoke(): void {
    const material = new THREE.MeshBasicMaterial({
      color: 0xf4f7f8,
      transparent: true,
      opacity: 0.23,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.34, 0), material, SMOKE_POOL_SIZE);
    mesh.name = "sky-dancer-v28-missile-smoke";
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    this.smokeMesh = mesh;
    for (let index = 0; index < SMOKE_POOL_SIZE; index += 1) {
      this.smokePuffs.push({ x: 0, y: -999, z: 0, age: 0, maxAge: SMOKE_LIFETIME });
      this.dummy.position.set(0, -999, 0);
      this.dummy.scale.setScalar(0.001);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(index, this.dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.runtimeV28.scene.add(mesh);
  }

  private decorateEnemyPips(): void {
    for (const group of this.runtimeV28.enemyGroups.values()) {
      if (group.getObjectByName("sky-dancer-v28-enemy-pip")) continue;
      const pip = new THREE.Mesh(
        new THREE.ConeGeometry(0.28, 0.54, 3),
        new THREE.MeshBasicMaterial({
          color: 0xff5365,
          transparent: true,
          opacity: 0.96,
          toneMapped: false,
          depthTest: false,
          depthWrite: false,
        }),
      );
      pip.name = "sky-dancer-v28-enemy-pip";
      pip.position.y = 4.25;
      pip.rotation.z = Math.PI;
      pip.renderOrder = 1500;
      group.add(pip);
    }
  }

  private enhanceHeroAndCity(): void {
    const player = this.runtimeV28.playerVisual;
    if (player.userData.skyDancerV28HeroScale !== true) {
      player.scale.multiplyScalar(1.1);
      player.userData.skyDancerV28HeroScale = true;
    }

    const cityRing = this.runtimeV28.scene.getObjectByName("sky-dancer-v27-landmark-city-ring");
    cityRing?.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        material.roughness = Math.min(material.roughness, 0.32);
        material.metalness = Math.max(material.metalness, 0.3);
      }
    });
  }

  private updateSceneryAnchor(snapshot: CartArenaSessionSnapshot): void {
    const centerX = Math.floor(snapshot.x / WORLD_CHUNK) * WORLD_CHUNK;
    const centerZ = Math.floor(snapshot.z / WORLD_CHUNK) * WORLD_CHUNK;
    if (centerX === this.scenicChunkX && centerZ === this.scenicChunkZ) return;
    this.scenicChunkX = centerX;
    this.scenicChunkZ = centerZ;
    this.scenicRoot.position.set(centerX, 0, centerZ);

    this.updateFieldMatrices();
    this.updateMountainMatrices();
    this.updateCloudMatrices();
  }

  private updateFieldMatrices(): void {
    if (!this.fieldMesh) return;
    const palette = [0x467e45, 0x59944a, 0x6ca04f, 0x83a95a, 0x7e9250, 0x4f8a61];
    let index = 0;
    for (let tileZ = -FIELD_TILE_RADIUS; tileZ <= FIELD_TILE_RADIUS; tileZ += 1) {
      for (let tileX = -FIELD_TILE_RADIUS; tileX <= FIELD_TILE_RADIUS; tileX += 1) {
        for (let patch = 0; patch < FIELD_PATCHES_PER_TILE; patch += 1) {
          const seed = (tileX + 7) * 97 + (tileZ + 9) * 53 + patch * 31;
          const x = tileX * WORLD_CHUNK + ((patch % 4) - 1.5) * 42 + Math.sin(seed * 0.73) * 11;
          const z = tileZ * WORLD_CHUNK + (Math.floor(patch / 4) - 0.5) * 72 + Math.cos(seed * 0.51) * 17;
          const width = 24 + Math.abs(seed % 5) * 5.2;
          const depth = 24 + Math.abs((seed + 3) % 4) * 7.5;
          this.dummy.position.set(x, REFERENCE_GROUND_Y + 0.16, z);
          this.dummy.rotation.set(0, ((seed % 7) - 3) * 0.035, 0);
          this.dummy.scale.set(width, 0.12, depth);
          this.dummy.updateMatrix();
          this.fieldMesh.setMatrixAt(index, this.dummy.matrix);
          this.fieldMesh.setColorAt(index, new THREE.Color(palette[Math.abs(seed) % palette.length]));
          index += 1;
        }
      }
    }
    this.fieldMesh.instanceMatrix.needsUpdate = true;
    if (this.fieldMesh.instanceColor) this.fieldMesh.instanceColor.needsUpdate = true;
  }

  private updateMountainMatrices(): void {
    if (!this.mountainMesh) return;
    const count = this.mountainMesh.count;
    for (let index = 0; index < count; index += 1) {
      const angle = index / count * Math.PI * 2 + (index % 5) * 0.031;
      const radius = 320 + (index % 9) * 25;
      const base = 24 + (index % 7) * 6.8;
      const height = 24 + (index % 8) * 7.5;
      this.dummy.position.set(
        Math.cos(angle) * radius,
        REFERENCE_GROUND_Y + height * 0.48 - 1.2,
        Math.sin(angle) * radius,
      );
      this.dummy.rotation.set(0, angle * 0.31, 0);
      this.dummy.scale.set(base * (1 + (index % 3) * 0.2), height, base);
      this.dummy.updateMatrix();
      this.mountainMesh.setMatrixAt(index, this.dummy.matrix);
    }
    this.mountainMesh.instanceMatrix.needsUpdate = true;
  }

  private updateCloudMatrices(): void {
    if (!this.cloudMesh) return;
    const count = this.cloudMesh.count;
    for (let index = 0; index < count; index += 1) {
      const angle = index / count * Math.PI * 2 + 0.17;
      const radius = 145 + (index % 11) * 22;
      const size = 5.5 + (index % 6) * 1.9;
      const y = -8 - (index % 5) * 2.7;
      this.dummy.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      this.dummy.rotation.set(index * 0.13, index * 0.19, index * 0.07);
      this.dummy.scale.set(size * (1.55 + (index % 3) * 0.22), size * 0.5, size);
      this.dummy.updateMatrix();
      this.cloudMesh.setMatrixAt(index, this.dummy.matrix);
    }
    this.cloudMesh.instanceMatrix.needsUpdate = true;
  }

  private updateEnemyPips(): void {
    const preferred = getCartTurboHuntSnapshot(this.runtimeV28.session)?.huntTargetEnemyId ?? null;
    for (const [id, group] of this.runtimeV28.enemyGroups) {
      const pip = group.getObjectByName("sky-dancer-v28-enemy-pip");
      if (!pip) continue;
      pip.visible = group.visible;
      const emphasized = id === preferred;
      pip.scale.setScalar(emphasized ? 1.5 : 1);
      if (pip instanceof THREE.Mesh && pip.material instanceof THREE.MeshBasicMaterial) {
        pip.material.opacity = emphasized ? 1 : 0.8;
      }
    }
  }

  private updateMissileSmoke(state: SkyDancerMissileState, delta: number): void {
    if (!this.smokeMesh) return;
    const activeIds = new Set<number>();
    for (const missile of state.missiles) {
      activeIds.add(missile.id);
      const clock = (this.missileSampleClocks.get(missile.id) ?? 0) + delta;
      if (clock >= 0.055) {
        this.missileSampleClocks.set(missile.id, clock % 0.055);
        const puff = this.smokePuffs[this.smokeCursor];
        this.smokeCursor = (this.smokeCursor + 1) % this.smokePuffs.length;
        puff.x = missile.x - Math.sin(missile.heading) * 1.4;
        puff.y = 1.16;
        puff.z = missile.z - Math.cos(missile.heading) * 1.4;
        puff.age = SMOKE_LIFETIME;
        puff.maxAge = SMOKE_LIFETIME;
      } else {
        this.missileSampleClocks.set(missile.id, clock);
      }
    }
    for (const id of [...this.missileSampleClocks.keys()]) {
      if (!activeIds.has(id)) this.missileSampleClocks.delete(id);
    }

    for (let index = 0; index < this.smokePuffs.length; index += 1) {
      const puff = this.smokePuffs[index];
      puff.age = Math.max(0, puff.age - delta);
      if (puff.age <= 0) {
        this.dummy.position.set(0, -999, 0);
        this.dummy.scale.setScalar(0.001);
      } else {
        const life = puff.age / puff.maxAge;
        const expansion = 0.45 + (1 - life) * 1.45;
        this.dummy.position.set(puff.x, puff.y + (1 - life) * 0.24, puff.z);
        this.dummy.scale.set(expansion * 1.35, expansion * 0.8, expansion * 1.35);
      }
      this.dummy.rotation.set(0, index * 0.37, 0);
      this.dummy.updateMatrix();
      this.smokeMesh.setMatrixAt(index, this.dummy.matrix);
    }
    this.smokeMesh.instanceMatrix.needsUpdate = true;
  }
}

export { SkyDancerAirCombatFxV28 as SkyDancerAirCombatFx };
