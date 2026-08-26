import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../cart/CartArenaSession";
import type { SkyDancerFxRuntime } from "./SkyDancerAirCombatFxV2";

const WORLD_SNAP = 420;
const GROUND_Y = -66.77;
const MAX_CITY_LOW = 150;
const MAX_CITY_MID = 96;
const MAX_CITY_HIGH = 42;

function hash2(x: number, z: number, salt = 0): number {
  let n = Math.imul(x + 0x51ed270b + salt * 911, 0x1b873593) ^ Math.imul(z - salt * 593, 0x85ebca6b);
  n ^= n >>> 15;
  n = Math.imul(n, 0x2c1b3c6d);
  n ^= n >>> 12;
  return (n >>> 0) / 0xffffffff;
}

/** Final screenshot-driven composition owner for the V32 reference pass. */
export class SkyDancerReferencePolishV32 {
  private readonly groundRoot = new THREE.Group();
  private readonly atmosphereRoot = new THREE.Group();
  private readonly cityLow: THREE.InstancedMesh;
  private readonly cityMid: THREE.InstancedMesh;
  private readonly cityHigh: THREE.InstancedMesh;
  private readonly ridgeNear: THREE.InstancedMesh;
  private readonly ridgeFar: THREE.InstancedMesh;
  private readonly cloudMain: THREE.InstancedMesh;
  private readonly cloudShade: THREE.InstancedMesh;
  private tileX = Number.NaN;
  private tileZ = Number.NaN;

  constructor(private readonly runtime: SkyDancerFxRuntime) {
    this.groundRoot.name = "sky-dancer-v32-polish-ground";
    this.atmosphereRoot.name = "sky-dancer-v32-polish-atmosphere";

    this.cityLow = this.makeCity("sky-dancer-v32-polish-city-low", 0x617985, MAX_CITY_LOW);
    this.cityMid = this.makeCity("sky-dancer-v32-polish-city-mid", 0x7e929b, MAX_CITY_MID);
    this.cityHigh = this.makeCity("sky-dancer-v32-polish-city-high", 0xa0afb5, MAX_CITY_HIGH);
    this.groundRoot.add(this.cityLow, this.cityMid, this.cityHigh);

    this.ridgeNear = this.makeRidge("sky-dancer-v32-polish-ridge-near", 0x416b70, 26, false);
    this.ridgeFar = this.makeRidge("sky-dancer-v32-polish-ridge-far", 0x6e8c94, 30, true);
    this.cloudMain = this.makeCloudBank("sky-dancer-v32-polish-cloud-main", 0xf3f8fa, 64, false);
    this.cloudShade = this.makeCloudBank("sky-dancer-v32-polish-cloud-shade", 0xb9ced8, 64, true);
    this.atmosphereRoot.add(this.ridgeFar, this.ridgeNear, this.cloudShade, this.cloudMain);

    runtime.scene.add(this.groundRoot, this.atmosphereRoot);
    this.enlargeHeroAircraft();
    this.hideSupersededPresentation();
  }

  update(snapshot: CartArenaSessionSnapshot): void {
    this.groundRoot.visible = true;
    this.atmosphereRoot.visible = true;
    this.hideSupersededPresentation();
    if (!snapshot || !Number.isFinite(snapshot.x) || !Number.isFinite(snapshot.z)) return;

    this.refineEnemyScale(snapshot);
    const nextTileX = Math.floor(snapshot.x / WORLD_SNAP);
    const nextTileZ = Math.floor(snapshot.z / WORLD_SNAP);
    if (nextTileX !== this.tileX || nextTileZ !== this.tileZ) {
      this.tileX = nextTileX;
      this.tileZ = nextTileZ;
      this.groundRoot.position.set(nextTileX * WORLD_SNAP, 0, nextTileZ * WORLD_SNAP);
      this.rebuildCity(nextTileX, nextTileZ);
    }
    this.atmosphereRoot.position.set(snapshot.x, 0, snapshot.z);
  }

  private hideSupersededPresentation(): void {
    const names = [
      "sky-dancer-v24-horizon-silhouettes", "sky-dancer-v28-mountain-depth", "sky-dancer-v30-mountain-belt",
      "sky-dancer-v32-ridge-near", "sky-dancer-v32-ridge-far",
      "sky-dancer-v24-far-cloud-layer", "sky-dancer-v25-horizon-cloud-banks", "sky-dancer-v28-layered-cloud-banks",
      "sky-dancer-v29-reference-cloud-bank", "sky-dancer-v31-low-clouds", "sky-dancer-v31-mid-clouds",
      "sky-dancer-v32-hero-clouds", "sky-dancer-v32-hero-cloud-shade",
      "sky-dancer-v29-reference-skyline", "sky-dancer-v31-settlement-buildings", "sky-dancer-v31-landmark-towers",
      "sky-dancer-v32-city-low", "sky-dancer-v32-city-mid", "sky-dancer-v32-city-high",
    ];
    for (const name of names) {
      const object = this.runtime.scene.getObjectByName(name);
      if (object) object.visible = false;
    }
    this.runtime.scene.traverse((object) => {
      if (!object.name || !/cloud/i.test(object.name)) return;
      if (object === this.cloudMain || object === this.cloudShade) return;
      if (object.name.startsWith("sky-dancer-v32-polish-cloud-")) return;
      object.visible = false;
    });
    this.cloudMain.visible = true;
    this.cloudShade.visible = true;
  }

  private refineEnemyScale(snapshot: CartArenaSessionSnapshot): void {
    for (const enemy of snapshot.enemies) {
      if (!enemy.alive || enemy.kind === "boss") continue;
      const group = this.runtime.enemyGroups.get(enemy.id);
      if (!group || group.userData.skyDancerV32ReferenceDistanceScale === true) continue;
      // V32 first-pass applies 1.08; multiplying by .72 yields a calmer ~.78
      // visual scale so close AI does not eclipse the hero/reference horizon.
      group.scale.multiplyScalar(0.72);
      group.userData.skyDancerV32ReferenceDistanceScale = true;
    }
  }

  private rebuildCity(tileX: number, tileZ: number): void {
    const dummy = new THREE.Object3D();
    let low = 0;
    let mid = 0;
    let high = 0;
    const districts = [
      { x: -175, z: 345, count: 58, hero: true },
      { x: 430, z: 660, count: 12, hero: false },
      { x: -610, z: 720, count: 11, hero: false },
      { x: 120, z: 810, count: 10, hero: false },
    ] as const;

    for (let district = 0; district < districts.length; district += 1) {
      const spec = districts[district];
      const cx = spec.x + (hash2(tileX, tileZ, 20 + district) - 0.5) * 32;
      const cz = spec.z + (hash2(tileX, tileZ, 30 + district) - 0.5) * 36;
      for (let i = 0; i < spec.count; i += 1) {
        const a = hash2(tileX, tileZ, 120 + district * 71 + i) * Math.PI * 2;
        const r = 5 + hash2(tileX, tileZ, 400 + district * 67 + i) * (spec.hero ? 48 : 30);
        const density = Math.max(0, 1 - r / (spec.hero ? 54 : 36));
        const noise = hash2(tileX, tileZ, 700 + district * 59 + i);
        const footprint = 2.6 + hash2(tileX, tileZ, 940 + district * 47 + i) * (spec.hero ? 4.2 : 2.8);
        let height = 5 + noise * 11 + density * (spec.hero ? 25 : 6);
        if (spec.hero && i === 0) height = 68;
        if (spec.hero && i === 1) height = 49;
        if (spec.hero && i === 2) height = 38;
        dummy.position.set(cx + Math.cos(a) * r, GROUND_Y + 0.7 + height * 0.5, cz + Math.sin(a) * r);
        dummy.rotation.set(0, a * 0.10, 0);
        const width = spec.hero && i === 0 ? 5.0 : footprint;
        dummy.scale.set(width, height, width * (0.82 + hash2(tileX, tileZ, 1300 + i) * 0.30));
        dummy.updateMatrix();
        if (height > 27 && high < MAX_CITY_HIGH) this.cityHigh.setMatrixAt(high++, dummy.matrix);
        else if (height > 13 && mid < MAX_CITY_MID) this.cityMid.setMatrixAt(mid++, dummy.matrix);
        else if (low < MAX_CITY_LOW) this.cityLow.setMatrixAt(low++, dummy.matrix);
      }
    }
    this.finish(this.cityLow, low);
    this.finish(this.cityMid, mid);
    this.finish(this.cityHigh, high);
  }

  private makeCity(name: string, color: number, maxCount: number): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color, roughness: 0.56, metalness: 0.08, flatShading: true, fog: true }), maxCount);
    mesh.name = name;
    mesh.frustumCulled = false;
    return mesh;
  }

  private makeRidge(name: string, color: number, count: number, far: boolean): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color, transparent: far, opacity: far ? 0.58 : 0.88, depthWrite: false, fog: true, toneMapped: false }), count);
    mesh.name = name;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i += 1) {
      const angle = i / count * Math.PI * 2 + Math.sin(i * 1.37) * 0.045;
      const radius = far ? 840 + (i % 6) * 38 : 610 + (i % 5) * 31;
      const width = far ? 140 + (i % 5) * 20 : 96 + (i % 5) * 16;
      const height = far ? 25 + (i % 6) * 2.8 : 19 + (i % 5) * 2.7;
      dummy.position.set(Math.cos(angle) * radius, GROUND_Y - height * 0.18, Math.sin(angle) * radius);
      dummy.rotation.set((i % 3 - 1) * 0.05, -angle + i * 0.07, (i % 4 - 1.5) * 0.02);
      dummy.scale.set(width, height, width * (0.31 + (i % 3) * 0.05));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    return mesh;
  }

  private makeCloudBank(name: string, color: number, maxCount: number, shade: boolean): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: shade ? 0.13 : 0.94, depthWrite: false, depthTest: true, fog: true, toneMapped: false }),
      maxCount,
    );
    mesh.name = name;
    const dummy = new THREE.Object3D();
    let index = 0;
    const clusters = [
      { angle: -0.58, radius: 455, baseY: 12, tall: true },
      { angle: 0.18, radius: 540, baseY: 10, tall: false },
      { angle: 1.18, radius: 505, baseY: 9, tall: false },
      { angle: 2.58, radius: 565, baseY: 11, tall: false },
    ] as const;
    // Structured tiers rather than random rings: the lower lobes overlap into a
    // broad base while upper lobes stack vertically, reading as cumulus towers.
    const lobePattern = [
      [-15, 0, 12], [-8, -1, 14], [0, 0, 15], [8, 0, 14], [15, -1, 12],
      [-11, 7, 12], [-3, 8, 13], [6, 7, 12], [12, 6, 10],
      [-6, 15, 10], [2, 16, 11], [8, 14, 9],
      [-2, 23, 8], [4, 25, 7],
    ] as const;

    for (let c = 0; c < clusters.length; c += 1) {
      const spec = clusters[c];
      const cx = Math.cos(spec.angle) * spec.radius;
      const cz = Math.sin(spec.angle) * spec.radius;
      const tangentX = -Math.sin(spec.angle);
      const tangentZ = Math.cos(spec.angle);
      for (let l = 0; l < lobePattern.length && index < maxCount; l += 1) {
        const [side, liftBase, baseSize] = lobePattern[l];
        const size = baseSize * (0.92 + hash2(c, l, 2300) * 0.18);
        const lift = liftBase * (spec.tall ? 1.22 : 0.82);
        const depthJitter = (hash2(c, l, 2400) - 0.5) * 5;
        dummy.position.set(
          cx + tangentX * side + Math.cos(spec.angle) * depthJitter,
          spec.baseY + lift - (shade ? size * 0.15 : 0),
          cz + tangentZ * side + Math.sin(spec.angle) * depthJitter,
        );
        dummy.rotation.set(hash2(c, l, 2500) * 0.10, spec.angle + hash2(c, l, 2600) * 0.15, hash2(c, l, 2700) * 0.10);
        dummy.scale.set(size * 1.03, size * (shade ? 0.72 : 1.02), size);
        dummy.updateMatrix();
        mesh.setMatrixAt(index++, dummy.matrix);
      }
    }
    mesh.count = index;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    return mesh;
  }

  private enlargeHeroAircraft(): void {
    const player = this.runtime.playerVisual;
    if (player.userData.skyDancerV32PolishScale === true) return;
    // Combined with V32's 1.32 base factor this yields ~2.77x V31 visually.
    player.scale.multiplyScalar(2.10);
    player.userData.skyDancerV32PolishScale = true;
  }

  private finish(mesh: THREE.InstancedMesh, count: number): void {
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  }
}
