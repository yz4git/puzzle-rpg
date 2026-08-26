import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../cart/CartArenaSession";
import type { SkyDancerMissileState } from "./SkyDancerFlightCombat";
import { SkyDancerAirCombatFxV11 } from "./SkyDancerAirCombatFxV11";
import type { SkyDancerFxRuntime } from "./SkyDancerAirCombatFxV2";
import { installSkyDancerLongRangeStandoff } from "./SkyDancerLongRangeStandoff";

const GROUND_Y = -34;

/** Final density/readability pass derived from the V11 real-WebGL review. */
export class SkyDancerAirCombatFxV12 extends SkyDancerAirCombatFxV11 {
  private readonly runtimeV12: SkyDancerFxRuntime;
  private builtV12 = false;

  constructor(runtime: SkyDancerFxRuntime) {
    super(runtime);
    this.runtimeV12 = runtime;
    installSkyDancerLongRangeStandoff();
  }

  override update(snapshot: CartArenaSessionSnapshot, missiles: SkyDancerMissileState, delta: number): void {
    super.update(snapshot, missiles, delta);
    if (!this.builtV12) {
      this.builtV12 = true;
      this.buildRegionalMosaic();
      this.buildRiverSystem();
      this.buildCropRows();
    }
    this.enhanceMissileReadability();
    this.rebalanceTurboPlume();
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

  private buildRegionalMosaic(): void {
    const columns = 12;
    const rows = 24;
    const count = columns * rows;
    const geometry = new THREE.BoxGeometry(1, 0.035, 1);
    const material = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.name = "sky-dancer-q12-regional-mosaic";
    const dummy = new THREE.Object3D();
    const colors = [
      0x6d8253, 0x82915a, 0x8d7e4f, 0x9b9062,
      0x71895f, 0xa08b5d, 0x647b56, 0x8b9d67,
    ].map((value) => new THREE.Color(value));

    let index = 0;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const x = -176 + column * 32 + Math.sin((row + 1) * (column + 2)) * 3.2;
        const z = -70 + row * 31 + Math.cos((column + 1) * (row + 3)) * 2.8;
        const sx = 13.2 + ((row + column) % 4) * 1.4;
        const sz = 12.2 + ((row * 2 + column) % 4) * 1.35;
        dummy.position.set(x, this.groundAt(x, z, 0.22), z);
        dummy.rotation.set(0, ((row + column) % 5 - 2) * 0.012, 0);
        dummy.scale.set(sx, 1, sz);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        mesh.setColorAt(index, colors[(row * 3 + column * 5) % colors.length]);
        index += 1;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    this.runtimeV12.scene.add(mesh);
  }

  private buildRiverSystem(): void {
    const root = new THREE.Group();
    root.name = "sky-dancer-q12-river-system";
    const material = new THREE.MeshBasicMaterial({
      color: 0x4c8ca3,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    let previousX = -96;
    let previousZ = -55;
    for (let index = 0; index < 38; index += 1) {
      const z = -55 + index * 19.5;
      const x = -62 + Math.sin(index * 0.47) * 58 + Math.sin(index * 0.13) * 24;
      const dx = x - previousX;
      const dz = z - previousZ;
      const length = Math.hypot(dx, dz) + 3;
      const segment = new THREE.Mesh(new THREE.BoxGeometry(12 + (index % 4) * 1.8, 0.045, length), material.clone());
      segment.position.set((x + previousX) * 0.5, this.groundAt(x, z, 0.42), (z + previousZ) * 0.5);
      segment.rotation.y = Math.atan2(dx, dz);
      root.add(segment);
      previousX = x;
      previousZ = z;
    }
    this.runtimeV12.scene.add(root);
  }

  private buildCropRows(): void {
    const root = new THREE.Group();
    root.name = "sky-dancer-q12-crop-rows";
    const material = new THREE.MeshBasicMaterial({ color: 0xd0be83, transparent: true, opacity: 0.22, depthWrite: false });
    for (let index = 0; index < 110; index += 1) {
      const region = index % 11;
      const row = Math.floor(index / 11);
      const x = -155 + region * 31 + (row % 2) * 7;
      const z = -5 + row * 58 + (region % 3) * 8;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.025, 23 + (index % 4) * 4.5), material.clone());
      stripe.position.set(x, this.groundAt(x, z, 0.31), z);
      stripe.rotation.y = (region % 4 - 1.5) * 0.055;
      root.add(stripe);
    }
    this.runtimeV12.scene.add(root);
  }

  private enhanceMissileReadability(): void {
    this.runtimeV12.scene.traverse((object) => {
      if (object.name !== "sky-dancer-q10-player-missile") return;
      if (!object.userData.skyDancerQ12Enhanced) {
        object.userData.skyDancerQ12Enhanced = true;
        const glow = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.30, 0),
          new THREE.MeshBasicMaterial({
            color: 0xb7f8ff,
            transparent: true,
            opacity: 0.72,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          }),
        );
        glow.name = "sky-dancer-q12-missile-bloom";
        glow.position.z = -0.58;
        object.add(glow);

        const streak = new THREE.Mesh(
          new THREE.BoxGeometry(0.055, 0.055, 4.8),
          new THREE.MeshBasicMaterial({
            color: 0x5ce6ff,
            transparent: true,
            opacity: 0.38,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          }),
        );
        streak.name = "sky-dancer-q12-missile-streak";
        streak.position.z = -2.55;
        object.add(streak);
      }
      object.scale.setScalar(1.62);
    });
  }

  private rebalanceTurboPlume(): void {
    this.runtimeV12.playerVisual.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshBasicMaterial)) return;
      if (object.name === "sky-dancer-q9-turbo-core") {
        object.material.opacity *= 0.28;
      } else if (object.name === "sky-dancer-q9-turbo-plume") {
        object.material.opacity *= 0.46;
      } else if (object.name === "sky-dancer-q11-turbo-ribbon") {
        object.material.blending = THREE.NormalBlending;
        object.material.opacity = Math.max(object.material.opacity, 0.26);
        object.material.color.setHex(0x36b9df);
        object.material.needsUpdate = true;
      }
    });
  }
}

export { SkyDancerAirCombatFxV12 as SkyDancerAirCombatFx };
