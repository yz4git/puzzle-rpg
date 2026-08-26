import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../cart/CartArenaSession";
import type { SkyDancerFxRuntime } from "./SkyDancerAirCombatFxV2";

const WORLD_SNAP = 420;
const GROUND_Y = -66.77;
const MAX_CITY_LOW = 180;
const MAX_CITY_MID = 120;
const MAX_CITY_HIGH = 48;

function hash2(x: number, z: number, salt = 0): number {
  let n = Math.imul(x + 0x7f4a7c15 + salt * 977, 0x1b873593) ^ Math.imul(z - salt * 631, 0x85ebca6b);
  n ^= n >>> 15;
  n = Math.imul(n, 0x2c1b3c6d);
  n ^= n >>> 12;
  return (n >>> 0) / 0xffffffff;
}

/**
 * V32 reference-driven presentation.
 *
 * V31 owns ground integrity and the inexpensive field/road/forest layer. V32
 * only adds what the supplied reference is still missing: coherent city
 * districts, shallow layered mountain ranges, compact cumulus banks, a richer
 * blue atmosphere and a stronger hero-aircraft silhouette. Gameplay/collision
 * and the 300 m flight model remain untouched.
 */
export class SkyDancerReferenceWorldV32 {
  private readonly groundRoot = new THREE.Group();
  private readonly atmosphereRoot = new THREE.Group();
  private readonly cityLow: THREE.InstancedMesh;
  private readonly cityMid: THREE.InstancedMesh;
  private readonly cityHigh: THREE.InstancedMesh;
  private readonly ridgeNear: THREE.InstancedMesh;
  private readonly ridgeFar: THREE.InstancedMesh;
  private readonly cloudMain: THREE.InstancedMesh;
  private readonly cloudShade: THREE.InstancedMesh;
  private readonly skyDome: THREE.Mesh;
  private readonly referenceFog = new THREE.Fog(0x78abc3, 700, 1680);
  private tileX = Number.NaN;
  private tileZ = Number.NaN;

  constructor(private readonly runtime: SkyDancerFxRuntime) {
    this.groundRoot.name = "sky-dancer-v32-reference-ground";
    this.atmosphereRoot.name = "sky-dancer-v32-reference-atmosphere";

    this.cityLow = this.makeCityMesh("sky-dancer-v32-city-low", 0x889fa7, MAX_CITY_LOW);
    this.cityMid = this.makeCityMesh("sky-dancer-v32-city-mid", 0xa6b7bc, MAX_CITY_MID);
    this.cityHigh = this.makeCityMesh("sky-dancer-v32-city-high", 0xc5d0d3, MAX_CITY_HIGH);
    this.groundRoot.add(this.cityLow, this.cityMid, this.cityHigh);

    this.ridgeNear = this.makeRidge("sky-dancer-v32-ridge-near", 0x426a73, 30, 0.92);
    this.ridgeFar = this.makeRidge("sky-dancer-v32-ridge-far", 0x6c8d99, 36, 0.72);
    this.cloudMain = this.makeCloudMesh("sky-dancer-v32-hero-clouds", 0xf1f7fa, 84, 0.93, false);
    this.cloudShade = this.makeCloudMesh("sky-dancer-v32-hero-cloud-shade", 0xb8cfda, 84, 0.54, true);
    this.skyDome = this.makeSkyDome();
    this.atmosphereRoot.add(this.skyDome, this.ridgeFar, this.ridgeNear, this.cloudShade, this.cloudMain);

    runtime.scene.add(this.groundRoot, this.atmosphereRoot);
    this.installHeroAircraftDetail();
    this.hideLegacyComposition();
    runtime.camera.far = Math.max(runtime.camera.far, 1850);
    runtime.camera.updateProjectionMatrix();
  }

  update(snapshot: CartArenaSessionSnapshot): void {
    this.restoreOwnPresentation();
    this.hideLegacyComposition();
    this.updateEnemyReadability(snapshot);

    const nextTileX = Math.floor(snapshot.x / WORLD_SNAP);
    const nextTileZ = Math.floor(snapshot.z / WORLD_SNAP);
    if (nextTileX !== this.tileX || nextTileZ !== this.tileZ) {
      this.tileX = nextTileX;
      this.tileZ = nextTileZ;
      this.groundRoot.position.set(nextTileX * WORLD_SNAP, 0, nextTileZ * WORLD_SNAP);
      this.rebuildGround(nextTileX, nextTileZ);
    }

    // Distant layers follow translation only, producing stable parallax without
    // obvious world-edge popping while the player can fly indefinitely.
    this.atmosphereRoot.position.set(snapshot.x, 0, snapshot.z);
    this.skyDome.position.y = this.runtime.camera.position.y;
  }

  private restoreOwnPresentation(): void {
    this.groundRoot.visible = true;
    this.atmosphereRoot.visible = true;
    this.skyDome.visible = true;
    this.ridgeNear.visible = true;
    this.ridgeFar.visible = true;
    this.cloudMain.visible = true;
    this.cloudShade.visible = true;
    if (this.runtime.scene.fog !== this.referenceFog) this.runtime.scene.fog = this.referenceFog;
  }

  private hideLegacyComposition(): void {
    // Keep V31 fields/roads/forest because they are useful high-altitude detail,
    // but remove older mountain/city/cloud stacks that compete with V32.
    const hideNames = [
      "sky-dancer-v30-mountain-belt",
      "sky-dancer-v24-horizon-silhouettes",
      "sky-dancer-v31-settlement-buildings",
      "sky-dancer-v31-landmark-towers",
      "sky-dancer-v31-low-clouds",
      "sky-dancer-v31-mid-clouds",
      "sky-dancer-v24-far-cloud-layer",
      "sky-dancer-v24-sky-dome",
      "sky-dancer-v30-sky",
      "sky-dancer-v25-horizon-cloud-banks",
      "sky-dancer-v28-layered-cloud-banks",
      "sky-dancer-v29-reference-cloud-bank",
      "sky-dancer-v25-landmark-city",
      "sky-dancer-v29-reference-skyline",
      "sky-dancer-v27-landmark-city-ring",
    ];
    for (const name of hideNames) {
      const object = this.runtime.scene.getObjectByName(name);
      if (object) object.visible = false;
    }
  }

  private updateEnemyReadability(snapshot: CartArenaSessionSnapshot): void {
    for (const enemy of snapshot.enemies) {
      if (!enemy.alive) continue;
      const group = this.runtime.enemyGroups.get(enemy.id);
      if (!group || group.userData.skyDancerV32ScaleApplied === true) continue;
      group.scale.multiplyScalar(enemy.kind === "boss" ? 1.13 : 1.08);
      group.userData.skyDancerV32ScaleApplied = true;
    }
  }

  private rebuildGround(tileX: number, tileZ: number): void {
    const dummy = new THREE.Object3D();
    let low = 0;
    let mid = 0;
    let high = 0;

    const districtCount = 7;
    const heroDistrict = 0;
    for (let district = 0; district < districtCount; district += 1) {
      const hero = district === heroDistrict;
      let cx: number;
      let cz: number;
      if (hero) {
        // A recognisable forward/right skyline for the common north-facing
        // opening view, with deterministic jitter so repeated tiles differ.
        cx = 270 + (hash2(tileX, tileZ, 701) - 0.5) * 54;
        cz = 255 + (hash2(tileX, tileZ, 702) - 0.5) * 54;
      } else {
        const angle = (district - 1) / (districtCount - 1) * Math.PI * 2
          + hash2(tileX, tileZ, 710 + district) * 0.24;
        const radius = 250 + hash2(tileX, tileZ, 760 + district) * 235;
        cx = Math.cos(angle) * radius;
        cz = Math.sin(angle) * radius;
      }

      const buildingCount = hero
        ? 44
        : 20 + Math.floor(hash2(tileX, tileZ, 840 + district) * 8);

      for (let i = 0; i < buildingCount; i += 1) {
        const a = hash2(tileX, tileZ, 900 + district * 53 + i) * Math.PI * 2;
        const clusterRadius = hero ? 54 : 40;
        const r = 7 + hash2(tileX, tileZ, 1200 + district * 47 + i) * clusterRadius;
        const x = cx + Math.cos(a) * r;
        const z = cz + Math.sin(a) * r;
        const footprint = 4.2 + hash2(tileX, tileZ, 1500 + district * 41 + i) * (hero ? 6.2 : 4.8);
        const heightNoise = hash2(tileX, tileZ, 1800 + district * 37 + i);
        const coreBoost = hero ? Math.max(0, 1 - r / 58) : 0;
        let height = 7 + heightNoise * 14 + coreBoost * (21 + heightNoise * 31);

        // One unmistakable skyline landmark, equivalent to the visual role of
        // the tall tower in the reference without needing a texture asset.
        if (hero && i === 0) height = 68;

        dummy.position.set(x, GROUND_Y + 0.75 + height * 0.5, z);
        dummy.rotation.set(0, a * 0.14, 0);
        dummy.scale.set(
          hero && i === 0 ? 6.2 : footprint,
          height,
          hero && i === 0 ? 6.2 : footprint * (0.82 + hash2(tileX, tileZ, 2100 + i) * 0.32),
        );
        dummy.updateMatrix();

        if (height > 29 && high < MAX_CITY_HIGH) this.cityHigh.setMatrixAt(high++, dummy.matrix);
        else if (height > 15 && mid < MAX_CITY_MID) this.cityMid.setMatrixAt(mid++, dummy.matrix);
        else if (low < MAX_CITY_LOW) this.cityLow.setMatrixAt(low++, dummy.matrix);
      }
    }

    this.finish(this.cityLow, low);
    this.finish(this.cityMid, mid);
    this.finish(this.cityHigh, high);
  }

  private makeCityMesh(name: string, color: number, maxCount: number): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.48,
        metalness: 0.12,
        flatShading: true,
        fog: true,
      }),
      maxCount,
    );
    mesh.name = name;
    mesh.frustumCulled = false;
    return mesh;
  }

  private makeRidge(name: string, color: number, count: number, opacity: number): THREE.InstancedMesh {
    // Very wide, shallow cones read as a continuous low-poly mountain chain
    // rather than the tall isolated pyramids visible in V31/V32 first pass.
    const mesh = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1, 1, 9),
      new THREE.MeshBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        depthWrite: false,
        fog: true,
        toneMapped: false,
      }),
      count,
    );
    mesh.name = name;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i += 1) {
      const angle = i / count * Math.PI * 2 + Math.sin(i * 1.71) * 0.04;
      const far = name.includes("far");
      const radius = far ? 790 + (i % 7) * 30 : 520 + (i % 6) * 24;
      const height = far ? 25 + (i % 7) * 2.8 : 18 + (i % 6) * 2.6;
      const width = far ? 135 + (i % 5) * 20 : 92 + (i % 5) * 16;
      dummy.position.set(
        Math.cos(angle) * radius,
        GROUND_Y + height * 0.46,
        Math.sin(angle) * radius,
      );
      dummy.rotation.set(0, -angle + i * 0.045, 0);
      dummy.scale.set(width, height, width * (0.36 + (i % 3) * 0.055));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    return mesh;
  }

  private makeCloudMesh(name: string, color: number, count: number, opacity: number, shade: boolean): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        depthTest: true,
        fog: true,
        toneMapped: false,
      }),
      count,
    );
    mesh.name = name;
    const dummy = new THREE.Object3D();
    let index = 0;
    const clusters = 6;
    const lobes = 14;
    for (let c = 0; c < clusters; c += 1) {
      const angle = c / clusters * Math.PI * 2 + (c % 2 ? 0.08 : -0.055);
      const radius = 250 + (c % 3) * 72;
      const cx = Math.cos(angle) * radius;
      const cz = Math.sin(angle) * radius;
      const cy = 19 + (c % 3) * 7;

      for (let l = 0; l < lobes; l += 1) {
        const seed = c * 97 + l * 31;
        const a = hash2(c, l, seed) * Math.PI * 2;
        const upper = l >= 9;
        const ring = l === 0 ? 0 : 2 + hash2(l, c, seed + 1) * (upper ? 7 : 10);
        const size = (upper ? 9 : 11) + hash2(c, l, seed + 2) * (upper ? 7 : 9);
        const lift = upper ? 8 + hash2(c, l, seed + 6) * 9 : 0;
        dummy.position.set(
          cx + Math.cos(a) * ring,
          cy + lift + (hash2(c, l, seed + 3) - 0.45) * size * 0.42 - (shade ? size * 0.17 : 0),
          cz + Math.sin(a) * ring * 0.72,
        );
        dummy.rotation.set(hash2(c, l, seed + 4) * 0.14, a, hash2(l, c, seed + 5) * 0.12);
        dummy.scale.set(size * 1.22, size * (shade ? 0.64 : 0.92), size);
        dummy.updateMatrix();
        mesh.setMatrixAt(index++, dummy.matrix);
      }
    }
    mesh.count = index;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    return mesh;
  }

  private makeSkyDome(): THREE.Mesh {
    const material = new THREE.ShaderMaterial({
      name: "sky-dancer-v32-sky-material",
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec3 vDir;
        void main() {
          float h = normalize(vDir).y;
          vec3 zenith = vec3(0.020, 0.185, 0.415);
          vec3 midSky = vec3(0.055, 0.390, 0.675);
          vec3 horizon = vec3(0.475, 0.720, 0.845);
          vec3 sky = mix(horizon, midSky, smoothstep(-0.16, 0.34, h));
          sky = mix(sky, zenith, smoothstep(0.30, 0.96, h));
          float haze = pow(max(0.0, 1.0 - abs(h + 0.025)), 10.0);
          sky += vec3(0.055, 0.070, 0.080) * haze;
          gl_FragColor = vec4(sky, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1150, 28, 14), material);
    dome.name = "sky-dancer-v32-sky-dome";
    dome.renderOrder = -3000;
    dome.frustumCulled = false;
    return dome;
  }

  private installHeroAircraftDetail(): void {
    const player = this.runtime.playerVisual;
    if (player.userData.skyDancerV32HeroDetail === true) return;
    // Visual-only scale. Collision/radius remain unchanged.
    player.scale.multiplyScalar(1.32);
    player.userData.skyDancerV32HeroDetail = true;

    const root = new THREE.Group();
    root.name = "sky-dancer-v32-player-detail";
    const dark = new THREE.MeshStandardMaterial({ color: 0x15384f, roughness: 0.30, metalness: 0.52, flatShading: true });
    const blue = new THREE.MeshStandardMaterial({ color: 0x176fb1, roughness: 0.32, metalness: 0.30, flatShading: true });
    const white = new THREE.MeshStandardMaterial({ color: 0xdcecf2, roughness: 0.34, metalness: 0.22, flatShading: true });
    const rim = new THREE.MeshBasicMaterial({ color: 0x9cf0ff, toneMapped: false });

    for (const x of [-0.43, 0.43]) {
      const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.34, 0.98, 8), dark);
      nacelle.rotation.x = Math.PI / 2;
      nacelle.position.set(x, 0.95, -1.74);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.045, 5, 10), rim);
      ring.position.set(x, 0.95, -2.22);
      root.add(nacelle, ring);
    }

    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.07, 0.17), blue);
      rail.position.set(side * 1.48, 0.99, -0.47);
      const wingTip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.72), white);
      wingTip.position.set(side * 2.42, 1.02, -0.52);
      wingTip.rotation.z = side * -0.08;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.78, 0.66), dark);
      fin.position.set(side * 0.62, 1.44, -1.42);
      fin.rotation.z = side * -0.09;
      root.add(rail, wingTip, fin);
    }

    const canopySpine = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 1.02), dark);
    canopySpine.position.set(0, 1.46, 0.54);
    const tailDeck = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.08, 0.46), white);
    tailDeck.position.set(0, 1.02, -1.55);
    root.add(canopySpine, tailDeck);
    player.add(root);
  }

  private finish(mesh: THREE.InstancedMesh, count: number): void {
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  }
}
