import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../cart/CartArenaSession";
import type { SkyDancerMissileState } from "./SkyDancerFlightCombat";
import { SkyDancerAirCombatFxV13 } from "./SkyDancerAirCombatFxV13";
import type { SkyDancerFxRuntime } from "./SkyDancerAirCombatFxV2";
import { installSkyDancerEnemyPopulation } from "./SkyDancerEnemyPopulation";

const GROUND_Y = -34;

interface EngineRibbon {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  phase: number;
  baseOpacity: number;
}

/**
 * V14 production-quality pass based on the V13 real-WebGL review.
 * - brings architecture into the actual chase-camera sight line,
 * - adds readable roofs, towers, tree masses and distant ridges,
 * - replaces the always-on cone exhaust with layered ribbon/heat-plume jets,
 * - keeps the cinematic V13 Turbo plume for boost,
 * - installs the reduced Sky Dancer enemy population.
 */
export class SkyDancerAirCombatFxV14 extends SkyDancerAirCombatFxV13 {
  private readonly runtimeV14: SkyDancerFxRuntime;
  private builtV14 = false;
  private elapsedV14 = 0;
  private readonly engineRoot = new THREE.Group();
  private readonly engineRibbons: EngineRibbon[] = [];

  constructor(runtime: SkyDancerFxRuntime) {
    super(runtime);
    this.runtimeV14 = runtime;
    installSkyDancerEnemyPopulation();
    this.engineRoot.name = "sky-dancer-q14-engine-exhaust";
  }

  override update(snapshot: CartArenaSessionSnapshot, missiles: SkyDancerMissileState, delta: number): void {
    super.update(snapshot, missiles, delta);
    this.elapsedV14 += delta;

    if (!this.builtV14) {
      this.builtV14 = true;
      this.tuneLightingAndAtmosphere();
      this.buildVisibleCityBelts();
      this.buildRoofsAndLandmarks();
      this.buildTreeMasses();
      this.buildDistantRidges();
      this.buildEngineExhaust();
    }

    this.suppressLegacyConeExhaust();
    this.updateEngineExhaust(snapshot);
  }

  private elevation(x: number, z: number): number {
    return Math.sin(x * 0.011) * 0.72
      + Math.cos(z * 0.0105) * 0.66
      + Math.sin((x + z) * 0.0062) * 0.48
      + Math.cos((x - z) * 0.0051) * 0.36;
  }

  private groundAt(x: number, z: number, lift = 0): number {
    return GROUND_Y + this.elevation(x, z) + lift;
  }

  private tuneLightingAndAtmosphere(): void {
    const scene = this.runtimeV14.scene;
    scene.background = new THREE.Color(0x72bce7);
    scene.fog = new THREE.Fog(0xd4e5e8, 185, 610);

    const hemi = new THREE.HemisphereLight(0xccecff, 0x435535, 0.42);
    hemi.name = "sky-dancer-q14-hemi-light";
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffefd2, 0.46);
    sun.name = "sky-dancer-q14-sun-fill";
    sun.position.set(-80, 130, -45);
    scene.add(sun);
  }

  private buildVisibleCityBelts(): void {
    const count = 196;
    const buildings = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.78,
        metalness: 0.04,
        flatShading: true,
      }),
      count,
    );
    buildings.name = "sky-dancer-q14-visible-city-belts";
    const colors = [
      0xd6c8ad, 0xc0bbb0, 0xb99376, 0x9fa7a6,
      0xc7a887, 0xd7d0bd, 0x909b9d, 0xb98269,
    ].map((value) => new THREE.Color(value));
    const dummy = new THREE.Object3D();

    for (let index = 0; index < count; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const band = Math.floor(index / 14);
      const lane = index % 14;
      const nearLane = lane % 7;
      const x = side * (26 + nearLane * 8.4) + Math.sin(index * 1.61) * 3.5;
      const z = -30 + band * 48 + Math.cos(index * 0.77) * 8;
      const h = 5.4 + (index % 9) * 1.15;
      const sx = 3.0 + (index % 4) * 0.72;
      const sz = 2.7 + ((index + 2) % 5) * 0.64;
      dummy.position.set(x, this.groundAt(x, z, h * 0.5 + 0.72), z);
      dummy.rotation.set(0, side * 0.035 + (lane % 4 - 1.5) * 0.025, 0);
      dummy.scale.set(sx, h, sz);
      dummy.updateMatrix();
      buildings.setMatrixAt(index, dummy.matrix);
      buildings.setColorAt(index, colors[(index * 5 + band) % colors.length]);
    }
    buildings.instanceMatrix.needsUpdate = true;
    if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true;
    buildings.frustumCulled = false;
    this.runtimeV14.scene.add(buildings);
  }

  private buildRoofsAndLandmarks(): void {
    const scene = this.runtimeV14.scene;
    const roofCount = 98;
    const roofs = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1, 0.9, 4),
      new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
      roofCount,
    );
    roofs.name = "sky-dancer-q14-visible-roofs";
    const roofColors = [0xb65f4f, 0x9c5848, 0xc17a55, 0x7d6870].map((value) => new THREE.Color(value));
    const dummy = new THREE.Object3D();

    for (let index = 0; index < roofCount; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const row = Math.floor(index / 7);
      const lane = index % 7;
      const x = side * (28 + lane * 9.1) + Math.sin(index * 1.3) * 3;
      const z = -18 + row * 54 + Math.cos(index * 0.9) * 6;
      const y = this.groundAt(x, z, 6.5 + (index % 4) * 1.0);
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, Math.PI / 4 + side * 0.04, 0);
      dummy.scale.set(2.0 + (index % 3) * 0.38, 1.0, 1.8 + ((index + 1) % 3) * 0.35);
      dummy.updateMatrix();
      roofs.setMatrixAt(index, dummy.matrix);
      roofs.setColorAt(index, roofColors[index % roofColors.length]);
    }
    roofs.instanceMatrix.needsUpdate = true;
    if (roofs.instanceColor) roofs.instanceColor.needsUpdate = true;
    roofs.frustumCulled = false;
    scene.add(roofs);

    const landmarkRoot = new THREE.Group();
    landmarkRoot.name = "sky-dancer-q14-landmarks";
    const towerMaterial = new THREE.MeshStandardMaterial({ color: 0xc9d0cf, roughness: 0.56, metalness: 0.16, flatShading: true });
    const beaconMaterial = new THREE.MeshBasicMaterial({ color: 0xff7768, transparent: true, opacity: 0.85, toneMapped: false });
    for (let index = 0; index < 24; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const x = side * (68 + (index % 5) * 12);
      const z = 18 + index * 27;
      const h = 13 + (index % 6) * 2.2;
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.7, h, 8), towerMaterial.clone());
      tower.position.set(x, this.groundAt(x, z, h * 0.5 + 0.65), z);
      landmarkRoot.add(tower);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), beaconMaterial.clone());
      beacon.position.set(x, this.groundAt(x, z, h + 1.0), z);
      landmarkRoot.add(beacon);
    }
    scene.add(landmarkRoot);
  }

  private buildTreeMasses(): void {
    const count = 360;
    const trees = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
      count,
    );
    trees.name = "sky-dancer-q14-tree-masses";
    const colors = [0x285037, 0x35613d, 0x476f43, 0x31563b, 0x547b4b].map((value) => new THREE.Color(value));
    const dummy = new THREE.Object3D();

    for (let index = 0; index < count; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const band = Math.floor(index / 18);
      const lane = index % 18;
      const x = side * (18 + (lane % 9) * 11.5) + Math.sin(index * 1.91) * 5.2;
      const z = -55 + band * 37 + Math.cos(index * 1.14) * 9;
      const scale = 1.3 + (index % 6) * 0.24;
      dummy.position.set(x, this.groundAt(x, z, 1.5 + scale * 0.42), z);
      dummy.rotation.set(index * 0.08, index * 0.41, 0);
      dummy.scale.set(scale * 1.15, scale * 0.78, scale);
      dummy.updateMatrix();
      trees.setMatrixAt(index, dummy.matrix);
      trees.setColorAt(index, colors[index % colors.length]);
    }
    trees.instanceMatrix.needsUpdate = true;
    if (trees.instanceColor) trees.instanceColor.needsUpdate = true;
    trees.frustumCulled = false;
    this.runtimeV14.scene.add(trees);
  }

  private buildDistantRidges(): void {
    const count = 42;
    const ridges = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1, 1, 5),
      new THREE.MeshLambertMaterial({ color: 0x6f8876, flatShading: true }),
      count,
    );
    ridges.name = "sky-dancer-q14-distant-ridges";
    const dummy = new THREE.Object3D();
    for (let index = 0; index < count; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const x = side * (155 + (index % 7) * 28);
      const z = -80 + Math.floor(index / 2) * 36;
      const h = 12 + (index % 8) * 2.8;
      dummy.position.set(x, this.groundAt(x, z, h * 0.45 - 0.6), z);
      dummy.rotation.set(0, index * 0.33, 0);
      dummy.scale.set(18 + (index % 5) * 5, h, 13 + ((index + 2) % 5) * 4);
      dummy.updateMatrix();
      ridges.setMatrixAt(index, dummy.matrix);
    }
    ridges.instanceMatrix.needsUpdate = true;
    ridges.frustumCulled = false;
    this.runtimeV14.scene.add(ridges);
  }

  private exhaustGeometry(width: number, tailWidth: number, length: number): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([
      -width, 0, 0,
      width, 0, 0,
      -tailWidth, 0, -length,
      width, 0, 0,
      tailWidth, 0, -length,
      -tailWidth, 0, -length,
    ], 3));
    return geometry;
  }

  private buildEngineExhaust(): void {
    this.runtimeV14.playerVisual.add(this.engineRoot);
    const layers = [
      { width: 0.055, tail: 0.18, length: 1.55, color: 0xeaffff, opacity: 0.64 },
      { width: 0.11, tail: 0.34, length: 2.35, color: 0x55dfff, opacity: 0.34 },
      { width: 0.17, tail: 0.48, length: 3.05, color: 0x1b78ba, opacity: 0.16 },
    ] as const;

    for (const side of [-1, 1]) {
      for (let layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
        const layer = layers[layerIndex];
        for (const crossed of [false, true]) {
          const mesh = new THREE.Mesh(
            this.exhaustGeometry(layer.width, layer.tail, layer.length),
            new THREE.MeshBasicMaterial({
              color: layer.color,
              transparent: true,
              opacity: layer.opacity,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
              toneMapped: false,
              side: THREE.DoubleSide,
            }),
          );
          mesh.name = "sky-dancer-q14-engine-ribbon";
          mesh.position.set(side * 0.34, 0.35, -1.95);
          if (crossed) mesh.rotation.z = Math.PI / 2;
          this.engineRoot.add(mesh);
          this.engineRibbons.push({ mesh, phase: layerIndex * 0.8 + (crossed ? 0.43 : 0) + (side > 0 ? 0.57 : 0), baseOpacity: layer.opacity });
        }
      }

      for (let index = 0; index < 3; index += 1) {
        const diamond = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.09 - index * 0.012, 0),
          new THREE.MeshBasicMaterial({
            color: index === 0 ? 0xeaffff : 0x6de6ff,
            transparent: true,
            opacity: 0.52 - index * 0.1,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          }),
        );
        diamond.name = "sky-dancer-q14-engine-diamond";
        diamond.position.set(side * 0.34, 0.35, -2.35 - index * 0.5);
        diamond.scale.z = 1.5;
        this.engineRoot.add(diamond);
      }
    }
  }

  private suppressLegacyConeExhaust(): void {
    this.runtimeV14.playerVisual.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object.name === "sky-dancer-jet-flame-v2" || object.name === "sky-dancer-jet-core-v2") {
        object.visible = false;
      }
    });
  }

  private updateEngineExhaust(snapshot: CartArenaSessionSnapshot): void {
    const turbo = this.runtimeV14.playerVisual.getObjectByName("sky-dancer-q13-tapered-afterburner");
    const turboActive = Boolean(turbo?.visible || snapshot.boostActive);
    this.engineRoot.visible = !turboActive;
    if (!this.engineRoot.visible) return;

    const speed = THREE.MathUtils.clamp(Math.abs(snapshot.speed) / 20, 0.15, 1);
    for (const state of this.engineRibbons) {
      const flutter = 0.84 + Math.sin(this.elapsedV14 * 27 + state.phase) * 0.12;
      state.mesh.material.opacity = state.baseOpacity * (0.56 + speed * 0.44) * flutter;
      state.mesh.scale.z = 0.82 + speed * 0.25 + flutter * 0.08;
      state.mesh.scale.x = 0.92 + Math.sin(this.elapsedV14 * 19 + state.phase) * 0.07;
      state.mesh.scale.y = 0.92 + Math.cos(this.elapsedV14 * 17 + state.phase) * 0.07;
    }
  }
}

export { SkyDancerAirCombatFxV14 as SkyDancerAirCombatFx };
