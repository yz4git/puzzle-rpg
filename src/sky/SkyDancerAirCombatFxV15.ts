import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../cart/CartArenaSession";
import type { SkyDancerMissileState } from "./SkyDancerFlightCombat";
import { SkyDancerAirCombatFxV14 } from "./SkyDancerAirCombatFxV14";
import type { SkyDancerFxRuntime } from "./SkyDancerAirCombatFxV2";

const BASE_GROUND_Y = -34;
const WORLD_LIFT = 8.5;
const GROUND_Y = BASE_GROUND_Y + WORLD_LIFT;

interface ShockCell {
  mesh: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshBasicMaterial>;
  phase: number;
  baseOpacity: number;
  baseZ: number;
}

/**
 * V15 lowers the visual flight level and focuses the scenery/exhaust pass on
 * what the chase camera actually sees. It deliberately avoids texture maps.
 */
export class SkyDancerAirCombatFxV15 extends SkyDancerAirCombatFxV14 {
  private readonly runtimeV15: SkyDancerFxRuntime;
  private builtV15 = false;
  private elapsedV15 = 0;
  private readonly jetRoot = new THREE.Group();
  private readonly shockCells: ShockCell[] = [];

  constructor(runtime: SkyDancerFxRuntime) {
    super(runtime);
    this.runtimeV15 = runtime;
    this.jetRoot.name = "sky-dancer-q15-engine-shock-plume";
  }

  override update(snapshot: CartArenaSessionSnapshot, missiles: SkyDancerMissileState, delta: number): void {
    super.update(snapshot, missiles, delta);
    this.elapsedV15 += delta;

    if (!this.builtV15) {
      this.builtV15 = true;
      this.raiseExistingLandscape();
      this.buildCloseCityscape();
      this.buildGroundInfrastructure();
      this.buildNormalJetPlume();
      this.runtimeV15.scene.userData.skyDancerAltitudeMeters = 78;
    }

    this.suppressOlderNormalExhaust();
    this.updateNormalJetPlume(snapshot);
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

  private raiseExistingLandscape(): void {
    const prefixes = [
      "sky-dancer-q5-",
      "sky-dancer-q9-",
      "sky-dancer-q11-",
      "sky-dancer-q12-",
      "sky-dancer-q13-",
      "sky-dancer-q14-",
    ];
    for (const object of this.runtimeV15.scene.children) {
      if (!prefixes.some((prefix) => object.name.startsWith(prefix))) continue;
      if (object.name === "sky-dancer-q5-cloud-banks") continue;
      object.position.y += WORLD_LIFT;
    }
    this.runtimeV15.scene.fog = new THREE.Fog(0xd6e6e9, 205, 650);
  }

  private buildCloseCityscape(): void {
    const count = 168;
    const buildings = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.72,
        metalness: 0.05,
        flatShading: true,
      }),
      count,
    );
    buildings.name = "sky-dancer-q15-close-cityscape";
    const colors = [
      0xe0d3b9, 0xc8c3b7, 0xb7896b, 0xa8b0ad,
      0xd2b08d, 0x9ca5a4, 0xc8785e, 0xe2d9c8,
    ].map((value) => new THREE.Color(value));
    const dummy = new THREE.Object3D();

    for (let index = 0; index < count; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const band = Math.floor(index / 12);
      const lane = index % 12;
      const x = side * (18 + (lane % 6) * 8.2) + Math.sin(index * 1.37) * 2.2;
      const z = -8 + band * 42 + Math.cos(index * 0.73) * 6;
      const h = 7.5 + (index % 10) * 1.45;
      const sx = 3.2 + (index % 4) * 0.75;
      const sz = 3.0 + ((index + 2) % 4) * 0.7;
      dummy.position.set(x, this.groundAt(x, z, h * 0.5 + 0.6), z);
      dummy.rotation.set(0, side * 0.035 + (lane % 3 - 1) * 0.04, 0);
      dummy.scale.set(sx, h, sz);
      dummy.updateMatrix();
      buildings.setMatrixAt(index, dummy.matrix);
      buildings.setColorAt(index, colors[(index * 3 + band) % colors.length]);
    }
    buildings.instanceMatrix.needsUpdate = true;
    if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true;
    buildings.frustumCulled = false;
    this.runtimeV15.scene.add(buildings);

    const roofCount = 84;
    const roofs = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1, 1, 4),
      new THREE.MeshLambertMaterial({ color: 0xb85f4d, flatShading: true }),
      roofCount,
    );
    roofs.name = "sky-dancer-q15-close-roofs";
    const roofDummy = new THREE.Object3D();
    for (let index = 0; index < roofCount; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const row = Math.floor(index / 6);
      const lane = index % 6;
      const x = side * (20 + lane * 8.8) + Math.sin(index * 1.2) * 1.8;
      const z = 2 + row * 42 + Math.cos(index * 0.81) * 5;
      const baseHeight = 9.5 + (index % 7) * 1.5;
      roofDummy.position.set(x, this.groundAt(x, z, baseHeight + 0.9), z);
      roofDummy.rotation.set(0, Math.PI / 4 + side * 0.04, 0);
      roofDummy.scale.set(2.4 + (index % 3) * 0.45, 1.0, 2.2 + ((index + 1) % 3) * 0.42);
      roofDummy.updateMatrix();
      roofs.setMatrixAt(index, roofDummy.matrix);
    }
    roofs.instanceMatrix.needsUpdate = true;
    roofs.frustumCulled = false;
    this.runtimeV15.scene.add(roofs);
  }

  private buildGroundInfrastructure(): void {
    const scene = this.runtimeV15.scene;
    const root = new THREE.Group();
    root.name = "sky-dancer-q15-ground-infrastructure";
    const asphalt = new THREE.MeshBasicMaterial({ color: 0x4f595b, transparent: true, opacity: 0.9, depthWrite: false });
    const lane = new THREE.MeshBasicMaterial({ color: 0xf2e6c5, transparent: true, opacity: 0.72, depthWrite: false });

    for (const x of [-12, 12]) {
      const road = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.06, 720), asphalt.clone());
      road.position.set(x, this.groundAt(x, 300, 0.58), 300);
      root.add(road);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.07, 720), lane.clone());
      stripe.position.set(x, this.groundAt(x, 300, 0.64), 300);
      root.add(stripe);
    }

    for (let index = 0; index < 12; index += 1) {
      const z = 18 + index * 52;
      const cross = new THREE.Mesh(new THREE.BoxGeometry(138, 0.06, 4.4), asphalt.clone());
      cross.position.set(0, this.groundAt(0, z, 0.58), z);
      root.add(cross);
    }

    const towerMaterial = new THREE.MeshStandardMaterial({ color: 0xc4ccca, roughness: 0.55, metalness: 0.2, flatShading: true });
    const red = new THREE.MeshBasicMaterial({ color: 0xff5e56, toneMapped: false });
    for (let index = 0; index < 20; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const x = side * (54 + (index % 4) * 10);
      const z = 24 + index * 29;
      const h = 15 + (index % 5) * 2.5;
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.4, h, 7), towerMaterial.clone());
      tower.position.set(x, this.groundAt(x, z, h * 0.5 + 0.55), z);
      root.add(tower);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 7, 5), red.clone());
      beacon.position.set(x, this.groundAt(x, z, h + 0.85), z);
      root.add(beacon);
    }
    scene.add(root);
  }

  private buildNormalJetPlume(): void {
    this.runtimeV15.playerVisual.add(this.jetRoot);
    for (const side of [-1, 1]) {
      const nozzleGlow = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 9, 6),
        new THREE.MeshBasicMaterial({
          color: 0xd8ffff,
          transparent: true,
          opacity: 0.78,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      nozzleGlow.name = "sky-dancer-q15-nozzle-glow";
      nozzleGlow.position.set(side * 0.34, 0.35, -1.93);
      this.jetRoot.add(nozzleGlow);

      for (let index = 0; index < 8; index += 1) {
        const opacity = 0.58 * (1 - index / 10);
        const cell = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.13 - index * 0.006, 0),
          new THREE.MeshBasicMaterial({
            color: index < 2 ? 0xecffff : index < 5 ? 0x72e5ff : 0x318fc7,
            transparent: true,
            opacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          }),
        );
        cell.name = "sky-dancer-q15-engine-shock-cell";
        const z = -2.15 - index * 0.29;
        cell.position.set(side * 0.34, 0.35, z);
        cell.scale.set(0.88 + index * 0.05, 0.72 + index * 0.035, 1.5 + index * 0.13);
        this.jetRoot.add(cell);
        this.shockCells.push({ mesh: cell, phase: index * 0.67 + (side > 0 ? 0.43 : 0), baseOpacity: opacity, baseZ: z });
      }

      for (let index = 0; index < 3; index += 1) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.14 + index * 0.045, 0.012, 4, 18),
          new THREE.MeshBasicMaterial({
            color: 0x68dfff,
            transparent: true,
            opacity: 0.22 - index * 0.04,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          }),
        );
        ring.name = "sky-dancer-q15-heat-ring";
        ring.rotation.x = Math.PI / 2;
        ring.position.set(side * 0.34, 0.35, -2.55 - index * 0.56);
        this.jetRoot.add(ring);
      }
    }
  }

  private suppressOlderNormalExhaust(): void {
    this.runtimeV15.playerVisual.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (
        object.name === "sky-dancer-jet-flame-v2"
        || object.name === "sky-dancer-jet-core-v2"
        || object.name === "sky-dancer-q14-engine-ribbon"
        || object.name === "sky-dancer-q14-engine-diamond"
      ) {
        object.visible = false;
      }
    });
  }

  private updateNormalJetPlume(snapshot: CartArenaSessionSnapshot): void {
    const turbo = this.runtimeV15.playerVisual.getObjectByName("sky-dancer-q13-tapered-afterburner");
    const turboActive = Boolean(turbo?.visible || snapshot.boostActive);
    this.jetRoot.visible = !turboActive;
    if (!this.jetRoot.visible) return;

    const speed = THREE.MathUtils.clamp(Math.abs(snapshot.speed) / 20, 0.2, 1);
    for (const state of this.shockCells) {
      const pulse = 0.84 + Math.sin(this.elapsedV15 * 30 + state.phase) * 0.16;
      state.mesh.material.opacity = state.baseOpacity * (0.6 + speed * 0.4) * pulse;
      state.mesh.position.z = state.baseZ - Math.sin(this.elapsedV15 * 21 + state.phase) * 0.025;
    }
  }
}

export { SkyDancerAirCombatFxV15 as SkyDancerAirCombatFx };
