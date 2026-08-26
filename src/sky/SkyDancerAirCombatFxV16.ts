import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../cart/CartArenaSession";
import type { SkyDancerMissileState } from "./SkyDancerFlightCombat";
import { SkyDancerAirCombatFxV15 } from "./SkyDancerAirCombatFxV15";
import type { SkyDancerFxRuntime } from "./SkyDancerAirCombatFxV2";

const GROUND_Y = -25.5;
const CHUNK_X = 120;
const CHUNK_Z = 180;

/**
 * V16 keeps high-detail ground scenery around the actual flight coordinates.
 * Turbo Hunt can move the player hundreds of units away from the original
 * Cart world graph, so fixed x≈0 scenery was often outside the camera frustum.
 */
export class SkyDancerAirCombatFxV16 extends SkyDancerAirCombatFxV15 {
  private readonly runtimeV16: SkyDancerFxRuntime;
  private readonly streamedRoot = new THREE.Group();
  private builtV16 = false;
  private chunkX = Number.NaN;
  private chunkZ = Number.NaN;

  constructor(runtime: SkyDancerFxRuntime) {
    super(runtime);
    this.runtimeV16 = runtime;
    this.streamedRoot.name = "sky-dancer-q16-streamed-scenery";
  }

  override update(snapshot: CartArenaSessionSnapshot, missiles: SkyDancerMissileState, delta: number): void {
    super.update(snapshot, missiles, delta);
    if (!this.builtV16) {
      this.builtV16 = true;
      this.buildStreamedScenery();
      this.tuneEngineShockCells();
      this.runtimeV16.scene.add(this.streamedRoot);
    }
    this.updateStreamedPosition(snapshot);
  }

  private elevation(x: number, z: number): number {
    return Math.sin(x * 0.011) * 0.72
      + Math.cos(z * 0.0105) * 0.66
      + Math.sin((x + z) * 0.0062) * 0.48
      + Math.cos((x - z) * 0.0051) * 0.36;
  }

  private buildStreamedScenery(): void {
    this.buildDistrictBuildings();
    this.buildDistrictRoofs();
    this.buildRoadGrid();
    this.buildIndustrialStrip();
    this.buildTreeParks();
    this.buildLocalFields();
    this.buildCanal();
  }

  private buildDistrictBuildings(): void {
    const count = 192;
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.7,
        metalness: 0.06,
        flatShading: true,
      }),
      count,
    );
    mesh.name = "sky-dancer-q16-city-blocks";
    const palette = [
      0xe1d5bd, 0xc8c2b5, 0xb47e65, 0x9ba8a8,
      0xd0aa82, 0xd9d2c2, 0xa97461, 0xb8b4aa,
    ].map((value) => new THREE.Color(value));
    const dummy = new THREE.Object3D();

    for (let index = 0; index < count; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const strip = Math.floor(index / 24);
      const local = index % 24;
      const lane = local % 6;
      const row = Math.floor(local / 6);
      const x = side * (18 + lane * 10.2) + Math.sin(index * 1.17) * 2.1;
      const z = -72 + strip * 39 + row * 8.2 + Math.cos(index * 0.71) * 2.8;
      const h = 6.5 + (index % 11) * 1.25;
      const sx = 3.2 + (index % 4) * 0.72;
      const sz = 3.0 + ((index + 2) % 5) * 0.61;
      dummy.position.set(x, GROUND_Y + h * 0.5 + 0.7, z);
      dummy.rotation.set(0, side * 0.035 + (row - 1.5) * 0.018, 0);
      dummy.scale.set(sx, h, sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, palette[(index * 3 + strip) % palette.length]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    this.streamedRoot.add(mesh);
  }

  private buildDistrictRoofs(): void {
    const count = 96;
    const mesh = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1, 0.85, 4),
      new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
      count,
    );
    mesh.name = "sky-dancer-q16-city-roofs";
    const palette = [0xb95747, 0xcf7652, 0x8f5c51, 0x6f7180].map((value) => new THREE.Color(value));
    const dummy = new THREE.Object3D();
    for (let index = 0; index < count; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const strip = Math.floor(index / 12);
      const local = index % 12;
      const lane = local % 6;
      const row = Math.floor(local / 6);
      const x = side * (19 + lane * 10.2) + Math.sin(index * 1.17) * 2.1;
      const z = -68 + strip * 39 + row * 8.2;
      const h = 10 + (index % 8) * 1.35;
      dummy.position.set(x, GROUND_Y + h + 0.9, z);
      dummy.rotation.set(0, Math.PI / 4 + side * 0.035, 0);
      dummy.scale.set(2.4 + (index % 3) * 0.36, 1, 2.2 + ((index + 1) % 3) * 0.34);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, palette[index % palette.length]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    this.streamedRoot.add(mesh);
  }

  private buildRoadGrid(): void {
    const root = new THREE.Group();
    root.name = "sky-dancer-q16-road-grid";
    const asphalt = new THREE.MeshBasicMaterial({ color: 0x444e52, transparent: true, opacity: 0.92, depthWrite: false });
    const lane = new THREE.MeshBasicMaterial({ color: 0xf0ddb1, transparent: true, opacity: 0.76, depthWrite: false });

    for (const x of [-8, 8, -58, 58]) {
      const road = new THREE.Mesh(new THREE.BoxGeometry(x === -8 || x === 8 ? 5.4 : 3.6, 0.07, 390), asphalt.clone());
      road.position.set(x, GROUND_Y + 0.62, 55);
      root.add(road);
      if (Math.abs(x) === 8) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 390), lane.clone());
        stripe.position.set(x, GROUND_Y + 0.68, 55);
        root.add(stripe);
      }
    }
    for (let index = -2; index <= 5; index += 1) {
      const z = index * 48;
      const cross = new THREE.Mesh(new THREE.BoxGeometry(154, 0.07, 4.4), asphalt.clone());
      cross.position.set(0, GROUND_Y + 0.62, z);
      root.add(cross);
    }
    this.streamedRoot.add(root);
  }

  private buildIndustrialStrip(): void {
    const root = new THREE.Group();
    root.name = "sky-dancer-q16-industrial-strip";
    const metal = new THREE.MeshStandardMaterial({ color: 0xaeb9b8, roughness: 0.54, metalness: 0.18, flatShading: true });
    const dark = new THREE.MeshStandardMaterial({ color: 0x687478, roughness: 0.64, metalness: 0.14, flatShading: true });
    const beacon = new THREE.MeshBasicMaterial({ color: 0xff675c, toneMapped: false });

    for (let index = 0; index < 18; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const x = side * (78 + (index % 3) * 11);
      const z = -42 + index * 20;
      const h = 12 + (index % 5) * 2.2;
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.7, h, 8), metal.clone());
      tower.position.set(x, GROUND_Y + h * 0.5 + 0.65, z);
      root.add(tower);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.42, 7, 5), beacon.clone());
      cap.position.set(x, GROUND_Y + h + 0.9, z);
      root.add(cap);
    }

    for (let index = 0; index < 16; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const x = side * (68 + (index % 4) * 9);
      const z = -15 + Math.floor(index / 2) * 42;
      const hangar = new THREE.Mesh(new THREE.BoxGeometry(12, 4.8 + (index % 3), 9), dark.clone());
      const h = 4.8 + (index % 3);
      hangar.position.set(x, GROUND_Y + h * 0.5 + 0.55, z);
      root.add(hangar);
    }
    this.streamedRoot.add(root);
  }

  private buildTreeParks(): void {
    const count = 240;
    const mesh = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
      count,
    );
    mesh.name = "sky-dancer-q16-tree-parks";
    const palette = [0x234b34, 0x315b39, 0x416c43, 0x2d5838, 0x507948].map((value) => new THREE.Color(value));
    const dummy = new THREE.Object3D();
    for (let index = 0; index < count; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const band = Math.floor(index / 20);
      const lane = index % 20;
      const x = side * (12 + (lane % 10) * 9.5) + Math.sin(index * 1.93) * 3.8;
      const z = -88 + band * 33 + Math.cos(index * 1.17) * 6.5;
      const s = 1.45 + (index % 6) * 0.22;
      dummy.position.set(x, GROUND_Y + 1.5 + s * 0.45, z);
      dummy.rotation.set(index * 0.05, index * 0.39, 0);
      dummy.scale.set(s * 1.15, s * 0.78, s);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, palette[index % palette.length]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    this.streamedRoot.add(mesh);
  }

  private buildLocalFields(): void {
    const count = 72;
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 0.05, 1),
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
      count,
    );
    mesh.name = "sky-dancer-q16-local-fields";
    const palette = [0x6f8b4e, 0x88a05c, 0xa58b57, 0x78965a, 0xb09a67, 0x607c50].map((value) => new THREE.Color(value));
    const dummy = new THREE.Object3D();
    for (let index = 0; index < count; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const row = Math.floor(index / 8);
      const lane = index % 8;
      const x = side * (105 + lane * 18);
      const z = -95 + row * 52;
      dummy.position.set(x, GROUND_Y + 0.35, z);
      dummy.rotation.set(0, (lane % 4 - 1.5) * 0.04, 0);
      dummy.scale.set(8 + (index % 4) * 2.4, 1, 13 + ((index + 1) % 4) * 3.1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, palette[index % palette.length]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    this.streamedRoot.add(mesh);
  }

  private buildCanal(): void {
    const root = new THREE.Group();
    root.name = "sky-dancer-q16-canal";
    const water = new THREE.MeshBasicMaterial({ color: 0x4389a8, transparent: true, opacity: 0.82, depthWrite: false });
    for (let index = 0; index < 14; index += 1) {
      const z = -95 + index * 34;
      const x = 96 + Math.sin(index * 0.72) * 18;
      const segment = new THREE.Mesh(new THREE.BoxGeometry(10, 0.06, 40), water.clone());
      segment.position.set(x, GROUND_Y + 0.46, z);
      segment.rotation.y = Math.sin(index * 0.72) * 0.16;
      root.add(segment);
    }
    this.streamedRoot.add(root);
  }

  private tuneEngineShockCells(): void {
    this.runtimeV16.playerVisual.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object.name === "sky-dancer-q15-engine-shock-cell" && !object.userData.skyDancerQ16Tuned) {
        object.userData.skyDancerQ16Tuned = true;
        object.scale.x *= 0.72;
        object.scale.y *= 0.72;
        object.scale.z *= 0.92;
        if (object.material instanceof THREE.MeshBasicMaterial) object.material.opacity *= 0.74;
      } else if (object.name === "sky-dancer-q15-nozzle-glow" && !object.userData.skyDancerQ16Tuned) {
        object.userData.skyDancerQ16Tuned = true;
        object.scale.setScalar(0.78);
      } else if (object.name === "sky-dancer-q15-heat-ring" && !object.userData.skyDancerQ16Tuned) {
        object.userData.skyDancerQ16Tuned = true;
        if (object.material instanceof THREE.MeshBasicMaterial) object.material.opacity *= 0.68;
      }
    });
  }

  private updateStreamedPosition(snapshot: CartArenaSessionSnapshot): void {
    const nextX = Math.round(snapshot.x / CHUNK_X) * CHUNK_X;
    const nextZ = Math.round(snapshot.z / CHUNK_Z) * CHUNK_Z;
    if (nextX === this.chunkX && nextZ === this.chunkZ) return;
    this.chunkX = nextX;
    this.chunkZ = nextZ;
    this.streamedRoot.position.set(nextX, 0, nextZ);
  }
}

export { SkyDancerAirCombatFxV16 as SkyDancerAirCombatFx };
