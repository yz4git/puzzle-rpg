import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../cart/CartArenaSession";
import type { SkyDancerMissileState } from "./SkyDancerFlightCombat";
import { SkyDancerAirCombatFxV28 } from "./SkyDancerAirCombatFxV28";
import type { SkyDancerFxRuntime } from "./SkyDancerAirCombatFxV2";
import { installSkyDancerSteeringRecovery } from "./SkyDancerSteeringRecovery";
import {
  SKY_DANCER_V29_ALTITUDE_LIFT_METERS,
  SKY_DANCER_V29_ALTITUDE_METERS,
  installSkyDancerV29Tuning,
} from "./SkyDancerV29Tuning";

interface V29Runtime extends SkyDancerFxRuntime {
  renderer?: THREE.WebGLRenderer;
  steer: number;
}

const BASE_ALTITUDE_METERS = 150;
const BASE_VERTICAL_RENDER_UNITS = 38;
const METERS_PER_RENDER_UNIT = BASE_ALTITUDE_METERS / BASE_VERTICAL_RENDER_UNITS;
const V28_ALTITUDE_LIFT_METERS = 50;
const TOTAL_ALTITUDE_LIFT_METERS = V28_ALTITUDE_LIFT_METERS + SKY_DANCER_V29_ALTITUDE_LIFT_METERS;
const TOTAL_ALTITUDE_SHIFT_UNITS = TOTAL_ALTITUDE_LIFT_METERS / METERS_PER_RENDER_UNIT;
const V29_EXTRA_SHIFT_UNITS = SKY_DANCER_V29_ALTITUDE_LIFT_METERS / METERS_PER_RENDER_UNIT;
const V28_LOCAL_GROUND_Y = -28.45 - V28_ALTITUDE_LIFT_METERS / METERS_PER_RENDER_UNIT;

/**
 * V29 keeps the V28 material/geometry direction but makes the view read much
 * closer to the supplied reference: a higher 300 m flight level, a stronger
 * skyline landmark, brighter water/terrain separation, fuller cloud banks,
 * clearer missile smoke and a larger hero silhouette.
 */
export class SkyDancerAirCombatFxV29 extends SkyDancerAirCombatFxV28 {
  private readonly runtimeV29: V29Runtime;
  private referencePolishBuilt = false;

  constructor(runtime: SkyDancerFxRuntime) {
    super(runtime);
    this.runtimeV29 = runtime as V29Runtime;
    installSkyDancerV29Tuning();
    installSkyDancerSteeringRecovery(this.runtimeV29);
  }

  override update(snapshot: CartArenaSessionSnapshot, missiles: SkyDancerMissileState, delta: number): void {
    super.update(snapshot, missiles, delta);
    this.applyV29FlightLevel();
    if (!this.referencePolishBuilt) {
      const scenicRoot = this.runtimeV29.scene.getObjectByName("sky-dancer-v28-reference-scenery");
      if (scenicRoot) {
        this.referencePolishBuilt = true;
        this.configureV29Grade();
        this.strengthenV28Layers();
        this.buildReferenceSkyline(scenicRoot);
        this.buildReferenceCloudBank(scenicRoot);
        this.buildReferenceRiverHighlights(scenicRoot);
        this.enlargeHeroPresence();
      }
    }
  }

  private configureV29Grade(): void {
    const renderer = this.runtimeV29.renderer;
    if (renderer) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    this.runtimeV29.scene.background = new THREE.Color(0x2b8fc8);
    this.runtimeV29.scene.fog = new THREE.Fog(0xa9d9eb, 340, 1100);
    this.runtimeV29.camera.far = Math.max(this.runtimeV29.camera.far, 1160);
    this.runtimeV29.camera.updateProjectionMatrix();
  }

  private applyV29FlightLevel(): void {
    const scene = this.runtimeV29.scene;
    scene.userData.skyDancerAltitudeMeters = SKY_DANCER_V29_ALTITUDE_METERS;
    scene.userData.verticalRenderScaleMetersPerUnit = METERS_PER_RENDER_UNIT;

    // V28 re-applies its own 50 m shift every update, so V29 writes the final
    // total after super.update(). This keeps 300 m stable across tile changes.
    const referenceWorld = scene.getObjectByName("sky-dancer-v25-reference-world");
    if (referenceWorld) referenceWorld.position.y = -TOTAL_ALTITUDE_SHIFT_UNITS;
    const cityRing = scene.getObjectByName("sky-dancer-v27-landmark-city-ring");
    if (cityRing) cityRing.position.y = -TOTAL_ALTITUDE_SHIFT_UNITS;
    const scenicRoot = scene.getObjectByName("sky-dancer-v28-reference-scenery");
    if (scenicRoot) scenicRoot.position.y = -V29_EXTRA_SHIFT_UNITS;

    // V11/V22 ground detail is authored with its elevation baked into child or
    // instance matrices, while the parent object itself sits at y=0. Earlier
    // altitude passes therefore missed it, leaving buildings visually at the
    // old flight level. Move those legacy layers by the complete +150 m lift.
    for (const name of [
      "sky-dancer-q11-route-parcels",
      "sky-dancer-q11-hedgerows",
      "sky-dancer-q11-route-towns",
      "sky-dancer-q11-highways",
      "sky-dancer-q11-landmarks",
      "sky-dancer-v22-quality-world",
    ]) {
      const object = scene.getObjectByName(name);
      if (object) object.position.y = -TOTAL_ALTITUDE_SHIFT_UNITS;
    }

    // The old Cart Hunt presentation draws its own ground at y≈0. It is a
    // vehicle-era duplicate of the Sky Dancer terrain and was the main reason
    // the real V29 capture still looked like the aircraft was inside a city.
    const legacyHuntWorld = scene.getObjectByName("phase67-turbo-hunt-world");
    if (legacyHuntWorld) legacyHuntWorld.visible = false;

    // At 300 m, roads and close warm town blocks should read as subtle ground
    // detail, not as giant flight-level obstacles. The V25/V28/V29 valley and
    // the dedicated right-side skyline now carry those visual roles instead.
    for (const name of [
      "sky-dancer-q11-route-towns",
      "sky-dancer-q11-highways",
      "sky-dancer-q11-landmarks",
      "sky-dancer-v22-road-grid",
      "sky-dancer-v22-rooftop-detail",
      "sky-dancer-v22-industrial-landmarks",
    ]) {
      const object = scene.getObjectByName(name);
      if (object) object.visible = false;
    }

    // Base environment objects that V28 already moved receive exactly one
    // additional 100 m shift. Player/enemy aircraft stay near y=0.
    for (const object of scene.children) {
      if (object === referenceWorld || object === cityRing || object === scenicRoot) continue;
      if (object.userData.skyDancerV28AltitudeShifted !== true) continue;
      if (object.userData.skyDancerV29AltitudeShifted === true) continue;
      object.position.y -= V29_EXTRA_SHIFT_UNITS;
      object.userData.skyDancerV29AltitudeShifted = true;
    }
  }

  private strengthenV28Layers(): void {
    const scene = this.runtimeV29.scene;
    const cloudBank = scene.getObjectByName("sky-dancer-v28-layered-cloud-banks");
    if (cloudBank instanceof THREE.InstancedMesh && cloudBank.material instanceof THREE.MeshLambertMaterial) {
      cloudBank.material.opacity = 0.34;
      cloudBank.material.color.setHex(0xf8fcff);
    }

    const smoke = scene.getObjectByName("sky-dancer-v28-missile-smoke");
    if (smoke instanceof THREE.InstancedMesh && smoke.material instanceof THREE.MeshBasicMaterial) {
      smoke.material.opacity = 0.32;
      smoke.material.color.setHex(0xffffff);
    }

    const lake = scene.getObjectByName("sky-dancer-v28-valley-lake");
    if (lake instanceof THREE.Mesh && lake.material instanceof THREE.MeshStandardMaterial) {
      lake.material.color.setHex(0x258db9);
      lake.material.emissive.setHex(0x0a496c);
      lake.material.emissiveIntensity = 0.3;
      lake.material.roughness = 0.12;
    }

    const patchwork = scene.getObjectByName("sky-dancer-v28-patchwork-valley");
    if (patchwork instanceof THREE.InstancedMesh && patchwork.material instanceof THREE.MeshLambertMaterial) {
      patchwork.material.opacity = 1;
    }
  }

  private enlargeHeroPresence(): void {
    const player = this.runtimeV29.playerVisual;
    if (player.userData.skyDancerV29HeroScale === true) return;
    player.scale.multiplyScalar(1.08);
    player.userData.skyDancerV29HeroScale = true;
  }

  private buildReferenceSkyline(parent: THREE.Object3D): void {
    if (parent.getObjectByName("sky-dancer-v29-reference-skyline")) return;
    const root = new THREE.Group();
    root.name = "sky-dancer-v29-reference-skyline";

    const bodyMaterials = [0xd6e1e6, 0xbcced8, 0xe3e8e7, 0x9fb8c6].map((color) => new THREE.MeshStandardMaterial({
      color,
      roughness: 0.28,
      metalness: 0.34,
      flatShading: true,
    }));
    const windowMaterial = new THREE.MeshStandardMaterial({
      color: 0x4e7f99,
      emissive: 0x153e55,
      emissiveIntensity: 0.3,
      roughness: 0.22,
      metalness: 0.4,
      flatShading: true,
    });

    for (let index = 0; index < 34; index += 1) {
      const lane = index % 6;
      const row = Math.floor(index / 6);
      const width = 2.6 + (index % 3) * 0.9;
      const depth = 2.8 + ((index + 1) % 4) * 0.65;
      const height = 3.6 + ((index * 7) % 9) * 1.15;
      const x = 42 + lane * 6.2 + Math.sin(index * 1.73) * 2.2;
      const z = 44 + row * 7.4 + Math.cos(index * 1.31) * 2.5;
      const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bodyMaterials[index % bodyMaterials.length]);
      building.position.set(x, V28_LOCAL_GROUND_Y + 0.7 + height * 0.5, z);
      building.rotation.y = (index % 5 - 2) * 0.035;
      building.castShadow = false;
      building.receiveShadow = false;
      root.add(building);

      if (index % 2 === 0) {
        const cap = new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, 0.18, depth * 0.72), windowMaterial);
        cap.position.set(x, V28_LOCAL_GROUND_Y + 0.8 + height, z);
        root.add(cap);
      }
    }

    // A single tall landmark makes the skyline read immediately at iPhone size,
    // matching the reference's strong city/tower silhouette without textures.
    const towerBase = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 5.4, 18, 8), bodyMaterials[2]);
    towerBase.position.set(64, V28_LOCAL_GROUND_Y + 9.5, 62);
    const towerMid = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.6, 12, 8), windowMaterial);
    towerMid.position.set(64, V28_LOCAL_GROUND_Y + 24.5, 62);
    const towerSpire = new THREE.Mesh(new THREE.ConeGeometry(1.15, 11, 8), new THREE.MeshStandardMaterial({
      color: 0xeaf6fa,
      emissive: 0x257da4,
      emissiveIntensity: 0.32,
      roughness: 0.2,
      metalness: 0.52,
      flatShading: true,
    }));
    towerSpire.position.set(64, V28_LOCAL_GROUND_Y + 36, 62);
    root.add(towerBase, towerMid, towerSpire);

    parent.add(root);
  }

  private buildReferenceCloudBank(parent: THREE.Object3D): void {
    if (parent.getObjectByName("sky-dancer-v29-reference-cloud-bank")) return;
    const count = 28;
    const geometry = new THREE.IcosahedronGeometry(1, 1);
    const material = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      flatShading: true,
    });
    const clouds = new THREE.InstancedMesh(geometry, material, count);
    clouds.name = "sky-dancer-v29-reference-cloud-bank";
    clouds.frustumCulled = false;
    const dummy = new THREE.Object3D();
    for (let index = 0; index < count; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const x = side * (42 + (index % 7) * 15) + Math.sin(index * 2.1) * 9;
      const z = 90 + Math.floor(index / 4) * 18 + Math.cos(index * 1.3) * 10;
      const y = -11 - (index % 4) * 2.4;
      const size = 6.2 + (index % 5) * 1.7;
      dummy.position.set(x, y, z);
      dummy.rotation.set(index * 0.11, index * 0.23, index * 0.07);
      dummy.scale.set(size * 1.65, size * 0.58, size);
      dummy.updateMatrix();
      clouds.setMatrixAt(index, dummy.matrix);
    }
    clouds.instanceMatrix.needsUpdate = true;
    parent.add(clouds);
  }

  private buildReferenceRiverHighlights(parent: THREE.Object3D): void {
    if (parent.getObjectByName("sky-dancer-v29-river-highlights")) return;
    const root = new THREE.Group();
    root.name = "sky-dancer-v29-river-highlights";
    const material = new THREE.MeshBasicMaterial({
      color: 0x5bc6e6,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      toneMapped: false,
    });
    for (let index = 0; index < 18; index += 1) {
      const z = -44 + index * 10.5;
      const x = -34 + Math.sin(index * 0.63) * 28;
      const segment = new THREE.Mesh(new THREE.BoxGeometry(3.2 + (index % 3), 0.08, 12.5), material);
      segment.position.set(x, V28_LOCAL_GROUND_Y + 0.72, z);
      segment.rotation.y = Math.sin(index * 0.63) * 0.42;
      root.add(segment);
    }
    parent.add(root);
  }
}

export { SkyDancerAirCombatFxV29 as SkyDancerAirCombatFx };
