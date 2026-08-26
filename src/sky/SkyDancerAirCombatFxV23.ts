import * as THREE from "three";
import type { CartArenaSession, CartArenaSessionSnapshot } from "../cart/CartArenaSession";
import type { SkyDancerMissileState } from "./SkyDancerFlightCombat";
import { SkyDancerAirCombatFxV22 } from "./SkyDancerAirCombatFxV22";
import type { SkyDancerFxRuntime } from "./SkyDancerAirCombatFxV2";
import { getSkyDancerTurboState } from "./SkyDancerTurboModel";

const GROUND_Y = -28.45;
const WORLD_CHUNK = 210;

interface V23Runtime extends SkyDancerFxRuntime {
  renderer?: THREE.WebGLRenderer;
}

/**
 * V23 is a cleanup/polish pass rather than another density-only layer.
 * It removes overlapping legacy boost FX and oversized translucent clouds,
 * restores contrast, and adds facade/roof detail while preserving the camera.
 */
export class SkyDancerAirCombatFxV23 extends SkyDancerAirCombatFxV22 {
  private readonly runtimeV23: V23Runtime;
  private readonly detailRoot = new THREE.Group();
  private builtV23 = false;
  private chunkX = Number.NaN;
  private chunkZ = Number.NaN;
  private elapsedV23 = 0;

  constructor(runtime: SkyDancerFxRuntime) {
    super(runtime);
    this.runtimeV23 = runtime as V23Runtime;
    this.detailRoot.name = "sky-dancer-v23-refined-world-detail";
  }

  override update(snapshot: CartArenaSessionSnapshot, missiles: SkyDancerMissileState, delta: number): void {
    super.update(snapshot, missiles, delta);
    this.elapsedV23 += delta;
    if (!this.builtV23) {
      this.builtV23 = true;
      this.applyContrastGrade();
      this.hideLowQualityClouds();
      this.buildFacadeBands();
      this.buildRoofMarkers();
      this.buildRefinedClouds();
      this.buildRiverHighlights();
      this.runtimeV23.scene.add(this.detailRoot);
    }

    this.suppressOverlappingTurboFx();
    this.updateTurboPresentation();
    this.updateWorldAnchor(snapshot);
  }

  private applyContrastGrade(): void {
    if (this.runtimeV23.renderer) {
      this.runtimeV23.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.runtimeV23.renderer.toneMappingExposure = 0.92;
      this.runtimeV23.renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    this.runtimeV23.scene.background = new THREE.Color(0x5eb7e8);
    this.runtimeV23.scene.fog = new THREE.Fog(0xb8dce9, 235, 760);

    for (const light of this.runtimeV23.scene.children) {
      if (light instanceof THREE.HemisphereLight) light.intensity = Math.min(light.intensity, 1.05);
      if (light instanceof THREE.DirectionalLight) light.intensity = Math.min(light.intensity, 1.22);
    }
  }

  private hideLowQualityClouds(): void {
    for (const name of ["sky-dancer-v19-cloud-volume", "sky-dancer-v22-cloud-banks"]) {
      const cloud = this.runtimeV23.scene.getObjectByName(name);
      if (cloud) cloud.visible = false;
    }
    const industrial = this.runtimeV23.scene.getObjectByName("sky-dancer-v22-industrial-landmarks");
    if (industrial) industrial.visible = false;
  }

  private suppressOverlappingTurboFx(): void {
    const names = [
      "sky-dancer-v19-cinematic-boost",
      "sky-dancer-q13-tapered-afterburner",
      "sky-dancer-q11-turbo-ribbons",
      "sky-dancer-q9-afterburner-system",
    ];
    for (const name of names) {
      const object = this.runtimeV23.scene.getObjectByName(name)
        ?? this.runtimeV23.playerVisual.getObjectByName(name);
      if (object) object.visible = false;
    }
  }

  private buildFacadeBands(): void {
    const count = 144;
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({
        color: 0x5d7882,
        emissive: 0x183b4b,
        emissiveIntensity: 0.15,
        roughness: 0.3,
        metalness: 0.28,
        transparent: true,
        opacity: 0.78,
      }),
      count,
    );
    mesh.name = "sky-dancer-v23-facade-window-bands";
    const dummy = new THREE.Object3D();

    for (let index = 0; index < count; index += 1) {
      const building = index % 72;
      const side = building % 2 === 0 ? -1 : 1;
      const row = Math.floor(building / 13);
      const lane = building % 13;
      const x = side * (24 + (lane % 7) * 10.8) + Math.sin(building * 1.39) * 3.2;
      const z = -142 + row * 27 + Math.cos(building * 0.73) * 4.5;
      const skyline = lane % 6 === 0;
      const height = skyline ? 17 + (building % 7) * 2.2 : 5.5 + (building % 8) * 1.35;
      const width = 3.4 + (building % 4) * 0.85;
      const depth = 3.2 + ((building + 2) % 5) * 0.72;
      const level = Math.floor(index / 72);
      const y = GROUND_Y + height * (level === 0 ? 0.42 : 0.68);

      if (building % 2 === 0) {
        dummy.position.set(x, y, z - depth * 0.505);
        dummy.scale.set(width * 0.72, 0.14, 0.055);
      } else {
        dummy.position.set(x + side * width * 0.505, y, z);
        dummy.scale.set(0.055, 0.14, depth * 0.72);
      }
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    this.detailRoot.add(mesh);
  }

  private buildRoofMarkers(): void {
    const root = new THREE.Group();
    root.name = "sky-dancer-v23-roof-markers";
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x91dff2,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      toneMapped: false,
    });
    const barMaterial = new THREE.MeshBasicMaterial({ color: 0x61747b, transparent: true, opacity: 0.78 });

    for (let index = 0; index < 12; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const x = side * (43 + (index % 4) * 19);
      const z = -108 + Math.floor(index / 2) * 43;
      const y = GROUND_Y + 15 + (index % 5) * 1.7;
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.48, 20), ringMaterial.clone());
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, y, z);
      root.add(ring);
      const barA = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.13), barMaterial.clone());
      barA.position.set(x, y + 0.02, z);
      root.add(barA);
      const barB = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.06, 1.5), barMaterial.clone());
      barB.position.set(x, y + 0.02, z);
      root.add(barB);
    }
    this.detailRoot.add(root);
  }

  private buildRefinedClouds(): void {
    const count = 28;
    const mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshLambertMaterial({
        color: 0xf0f8fb,
        transparent: true,
        opacity: 0.17,
        depthWrite: false,
        flatShading: true,
      }),
      count,
    );
    mesh.name = "sky-dancer-v23-refined-clouds";
    const dummy = new THREE.Object3D();
    for (let index = 0; index < count; index += 1) {
      const x = -180 + (index % 7) * 58 + Math.sin(index * 1.3) * 14;
      const z = -220 + Math.floor(index / 7) * 145 + Math.cos(index * 0.8) * 22;
      const y = 8 + (index % 4) * 3.4;
      dummy.position.set(x, y, z);
      dummy.rotation.set(index * 0.05, index * 0.17, 0);
      dummy.scale.set(7 + (index % 4) * 1.7, 1.7 + (index % 3) * 0.48, 4.5 + ((index + 2) % 4) * 1.15);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    this.detailRoot.add(mesh);
  }

  private buildRiverHighlights(): void {
    const root = new THREE.Group();
    root.name = "sky-dancer-v23-river-highlights";
    const material = new THREE.MeshBasicMaterial({
      color: 0x9eeaff,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    for (let index = 0; index < 13; index += 1) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(14 + (index % 3) * 2.5, 0.018, 0.12), material.clone());
      strip.position.set(98 + Math.sin(index * 1.7) * 3, GROUND_Y + 0.19, -178 + index * 30);
      strip.rotation.y = 0.05 + Math.sin(index) * 0.04;
      root.add(strip);
    }
    this.detailRoot.add(root);
  }

  private updateTurboPresentation(): void {
    const turbo = getSkyDancerTurboState(this.runtimeV23.session as unknown as CartArenaSession);
    const engine = this.runtimeV23.playerVisual.getObjectByName("sky-dancer-v22-engine-system");
    if (engine) {
      if (turbo.held) {
        // Charge phase stays compact: it should not look like the aircraft is
        // already accelerating before the release event.
        engine.scale.set(0.72, 0.72, 0.58 + turbo.charge * 0.12);
      } else if (turbo.releaseAgeSeconds < 0.9) {
        const burst = 1 - THREE.MathUtils.clamp(turbo.releaseAgeSeconds / 0.9, 0, 1);
        engine.scale.set(1 + burst * 0.18, 1 + burst * 0.18, 1 + burst * 0.48);
      } else {
        engine.scale.set(1, 1, 1);
      }
    }

    const streaks = this.runtimeV23.camera.getObjectByName("sky-dancer-v22-speed-streaks");
    if (streaks && turbo.held) {
      for (const child of streaks.children) {
        if (!(child instanceof THREE.Mesh) || !(child.material instanceof THREE.MeshBasicMaterial)) continue;
        child.material.opacity *= 0.22;
      }
    }
  }

  private updateWorldAnchor(snapshot: CartArenaSessionSnapshot): void {
    const nextX = Math.round(snapshot.x / WORLD_CHUNK) * WORLD_CHUNK;
    const nextZ = Math.round(snapshot.z / WORLD_CHUNK) * WORLD_CHUNK;
    if (nextX === this.chunkX && nextZ === this.chunkZ) return;
    this.chunkX = nextX;
    this.chunkZ = nextZ;
    this.detailRoot.position.set(nextX, 0, nextZ);
  }
}

export { SkyDancerAirCombatFxV23 as SkyDancerAirCombatFx };
