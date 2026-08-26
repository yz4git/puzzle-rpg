import * as THREE from "three";
import type { CartArenaSession, CartArenaSessionSnapshot } from "../cart/CartArenaSession";
import type { SkyDancerMissileState } from "./SkyDancerFlightCombat";
import { SkyDancerAirCombatFxV21 } from "./SkyDancerAirCombatFxV21";
import type { SkyDancerFxRuntime } from "./SkyDancerAirCombatFxV2";
import { getSkyDancerTurboState } from "./SkyDancerTurboModel";

const GROUND_Y = -28.45;
const WORLD_CHUNK = 210;

interface EngineFx {
  root: THREE.Group;
  core: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>;
  outer: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>;
  diamonds: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshBasicMaterial>[];
  rings: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>[];
}

interface V22Runtime extends SkyDancerFxRuntime {
  renderer?: THREE.WebGLRenderer;
}

/**
 * V22 lifts the whole presentation toward the midpoint concept while preserving
 * the current chase camera. It adds a denser streamed city/river/forest layer,
 * cleaner aircraft materials and a dedicated charge/release jet presentation.
 */
export class SkyDancerAirCombatFxV22 extends SkyDancerAirCombatFxV21 {
  private readonly runtimeV22: V22Runtime;
  private readonly worldRoot = new THREE.Group();
  private readonly engineFx: EngineFx[] = [];
  private readonly engineFxRoot = new THREE.Group();
  private readonly speedStreaks = new THREE.Group();
  private builtV22 = false;
  private chunkX = Number.NaN;
  private chunkZ = Number.NaN;
  private elapsedV22 = 0;

  constructor(runtime: SkyDancerFxRuntime) {
    super(runtime);
    this.runtimeV22 = runtime as V22Runtime;
    this.worldRoot.name = "sky-dancer-v22-quality-world";
    this.engineFxRoot.name = "sky-dancer-v22-engine-system";
    this.speedStreaks.name = "sky-dancer-v22-speed-streaks";
  }

  override update(snapshot: CartArenaSessionSnapshot, missiles: SkyDancerMissileState, delta: number): void {
    super.update(snapshot, missiles, delta);
    this.elapsedV22 += delta;
    if (!this.builtV22) {
      this.builtV22 = true;
      this.tuneRendererAndAtmosphere();
      this.suppressLowestQualityLegacyScenery();
      this.buildStreamedWorld();
      this.buildEngineSystem();
      this.buildSpeedStreaks();
      this.polishAircraftMaterials();
      this.runtimeV22.scene.add(this.worldRoot);
      this.runtimeV22.playerVisual.add(this.engineFxRoot);
      this.runtimeV22.camera.add(this.speedStreaks);
    }
    this.updateWorldAnchor(snapshot);
    this.updateEngineSystem(delta);
    this.updateSpeedStreaks(delta);
  }

  private tuneRendererAndAtmosphere(): void {
    const renderer = this.runtimeV22.renderer;
    if (renderer) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    this.runtimeV22.scene.background = new THREE.Color(0x78c5ed);
    this.runtimeV22.scene.fog = new THREE.Fog(0xc6e2ed, 210, 710);

    const skyFill = new THREE.HemisphereLight(0xdff5ff, 0x425a48, 0.62);
    skyFill.name = "sky-dancer-v22-sky-fill";
    this.runtimeV22.scene.add(skyFill);

    const warmSun = new THREE.DirectionalLight(0xffefcf, 0.55);
    warmSun.name = "sky-dancer-v22-sun-key";
    warmSun.position.set(-120, 160, -70);
    this.runtimeV22.scene.add(warmSun);
  }

  private suppressLowestQualityLegacyScenery(): void {
    const hideNames = [
      "sky-dancer-q14-visible-city-belts",
      "sky-dancer-q14-visible-roofs",
      "sky-dancer-q14-tree-masses",
    ];
    for (const name of hideNames) {
      const object = this.runtimeV22.scene.getObjectByName(name);
      if (object) object.visible = false;
    }
  }

  private buildStreamedWorld(): void {
    this.buildDistrictGround();
    this.buildCityBlocks();
    this.buildRooftopDetail();
    this.buildRoadsAndBridges();
    this.buildRiver();
    this.buildGreenBelts();
    this.buildIndustrialLandmarks();
    this.buildCloudBanks();
  }

  private buildDistrictGround(): void {
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
      72,
    );
    mesh.name = "sky-dancer-v22-district-ground";
    const colors = [0x6f9259, 0x80945d, 0xa19562, 0x758654, 0x8f8158, 0x64845a]
      .map((value) => new THREE.Color(value));
    const dummy = new THREE.Object3D();
    for (let index = 0; index < 72; index += 1) {
      const row = Math.floor(index / 9);
      const col = index % 9;
      const x = (col - 4) * 31 + Math.sin(index * 1.7) * 2.5;
      const z = (row - 3.5) * 39 + Math.cos(index * 1.13) * 3.5;
      dummy.position.set(x, GROUND_Y - 0.08, z);
      dummy.scale.set(27 + (index % 3) * 3, 0.12, 34 + ((index + 1) % 3) * 4);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, colors[(index * 5) % colors.length]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    this.worldRoot.add(mesh);
  }

  private buildCityBlocks(): void {
    const count = 156;
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.48,
        metalness: 0.16,
        flatShading: true,
      }),
      count,
    );
    mesh.name = "sky-dancer-v22-city-blocks";
    const colors = [0xd9d8d1, 0xb9c8cc, 0xc8bca8, 0xa8b9bf, 0xe0d7c8, 0xb6aaa0, 0xcbd5d3]
      .map((value) => new THREE.Color(value));
    const dummy = new THREE.Object3D();

    for (let index = 0; index < count; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const row = Math.floor(index / 13);
      const lane = index % 13;
      const x = side * (24 + (lane % 7) * 10.8) + Math.sin(index * 1.39) * 3.2;
      const z = -142 + row * 27 + Math.cos(index * 0.73) * 4.5;
      const skyline = lane % 6 === 0;
      const height = skyline ? 17 + (index % 7) * 2.2 : 5.5 + (index % 8) * 1.35;
      const width = 3.4 + (index % 4) * 0.85;
      const depth = 3.2 + ((index + 2) % 5) * 0.72;
      dummy.position.set(x, GROUND_Y + height * 0.5 + 0.12, z);
      dummy.rotation.set(0, (index % 5 - 2) * 0.028, 0);
      dummy.scale.set(width, height, depth);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, colors[(index * 3 + row) % colors.length]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    this.worldRoot.add(mesh);
  }

  private buildRooftopDetail(): void {
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x78909a, roughness: 0.38, metalness: 0.3, flatShading: true }),
      84,
    );
    mesh.name = "sky-dancer-v22-rooftop-detail";
    const dummy = new THREE.Object3D();
    for (let index = 0; index < 84; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const lane = index % 7;
      const row = Math.floor(index / 7);
      const x = side * (28 + lane * 11.1);
      const z = -135 + row * 29.5;
      const y = GROUND_Y + 10.5 + (index % 6) * 1.6;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, index * 0.17, 0);
      dummy.scale.set(0.9 + (index % 3) * 0.28, 0.45 + (index % 2) * 0.24, 0.9 + ((index + 1) % 3) * 0.25);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    this.worldRoot.add(mesh);
  }

  private buildRoadsAndBridges(): void {
    const root = new THREE.Group();
    root.name = "sky-dancer-v22-road-grid";
    const asphalt = new THREE.MeshStandardMaterial({ color: 0x3f4c51, roughness: 0.86, metalness: 0.03 });
    const lane = new THREE.MeshBasicMaterial({ color: 0xf1ddb0, transparent: true, opacity: 0.78, depthWrite: false });

    for (const x of [-78, -19, 19, 78]) {
      const road = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x) < 30 ? 6.4 : 4.5, 0.08, 390), asphalt.clone());
      road.position.set(x, GROUND_Y + 0.16, 0);
      root.add(road);
      if (Math.abs(x) < 30) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.04, 390), lane.clone());
        stripe.position.set(x, GROUND_Y + 0.225, 0);
        root.add(stripe);
      }
    }
    for (let row = -4; row <= 4; row += 1) {
      const z = row * 42;
      const road = new THREE.Mesh(new THREE.BoxGeometry(190, 0.08, 4.8), asphalt.clone());
      road.position.set(0, GROUND_Y + 0.16, z);
      root.add(road);
    }

    const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x56646a, roughness: 0.62, metalness: 0.14 });
    for (const z of [-84, 42, 126]) {
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(46, 0.48, 5.6), bridgeMat.clone());
      bridge.position.set(98, GROUND_Y + 0.62, z);
      root.add(bridge);
      for (const x of [89, 107]) {
        const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.8, 7.5, 0.9), bridgeMat.clone());
        pylon.position.set(x, GROUND_Y + 4.2, z);
        root.add(pylon);
      }
    }
    this.worldRoot.add(root);
  }

  private buildRiver(): void {
    const water = new THREE.Mesh(
      new THREE.BoxGeometry(25, 0.08, 430),
      new THREE.MeshStandardMaterial({
        color: 0x338aa9,
        emissive: 0x0b3851,
        emissiveIntensity: 0.12,
        roughness: 0.2,
        metalness: 0.18,
        transparent: true,
        opacity: 0.9,
      }),
    );
    water.name = "sky-dancer-v22-river";
    water.position.set(98, GROUND_Y + 0.12, 0);
    this.worldRoot.add(water);

    const bank = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color: 0x506f4a }),
      28,
    );
    bank.name = "sky-dancer-v22-river-bank";
    const dummy = new THREE.Object3D();
    for (let index = 0; index < 28; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      dummy.position.set(98 + side * 15.4, GROUND_Y + 0.23, -188 + Math.floor(index / 2) * 29);
      dummy.scale.set(4.4, 0.24, 24);
      dummy.updateMatrix();
      bank.setMatrixAt(index, dummy.matrix);
    }
    bank.instanceMatrix.needsUpdate = true;
    bank.frustumCulled = false;
    this.worldRoot.add(bank);
  }

  private buildGreenBelts(): void {
    const mesh = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
      260,
    );
    mesh.name = "sky-dancer-v22-green-belts";
    const colors = [0x28533a, 0x356246, 0x416f48, 0x4b7650, 0x315b3f].map((value) => new THREE.Color(value));
    const dummy = new THREE.Object3D();
    for (let index = 0; index < 260; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const lane = index % 13;
      const row = Math.floor(index / 13);
      const x = side * (18 + (lane % 7) * 15.5) + Math.sin(index * 2.11) * 5.5;
      const z = -180 + row * 18.5 + Math.cos(index * 0.91) * 8;
      const s = 1.0 + (index % 5) * 0.24;
      dummy.position.set(x, GROUND_Y + 0.8 + s * 0.3, z);
      dummy.rotation.set(index * 0.13, index * 0.41, 0);
      dummy.scale.set(s * 1.15, s * 0.78, s);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, colors[index % colors.length]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    this.worldRoot.add(mesh);
  }

  private buildIndustrialLandmarks(): void {
    const root = new THREE.Group();
    root.name = "sky-dancer-v22-industrial-landmarks";
    const steel = new THREE.MeshStandardMaterial({ color: 0x87959a, roughness: 0.44, metalness: 0.34, flatShading: true });
    const accent = new THREE.MeshBasicMaterial({ color: 0xff8b5d, toneMapped: false });
    for (let index = 0; index < 16; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const x = side * (116 + (index % 4) * 11);
      const z = -150 + index * 21;
      const h = 13 + (index % 5) * 2.1;
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.8, h, 10), steel.clone());
      tower.position.set(x, GROUND_Y + h * 0.5, z);
      root.add(tower);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.32, 10), accent.clone());
      cap.position.set(x, GROUND_Y + h, z);
      root.add(cap);
    }
    this.worldRoot.add(root);
  }

  private buildCloudBanks(): void {
    const mesh = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1, 1),
      new THREE.MeshLambertMaterial({ color: 0xeaf6fa, transparent: true, opacity: 0.36, depthWrite: false, flatShading: true }),
      48,
    );
    mesh.name = "sky-dancer-v22-cloud-banks";
    const dummy = new THREE.Object3D();
    for (let index = 0; index < 48; index += 1) {
      const x = -160 + (index % 8) * 46 + Math.sin(index * 1.7) * 12;
      const z = -210 + Math.floor(index / 8) * 78 + Math.cos(index * 1.2) * 16;
      const y = -9 + (index % 4) * 3.1;
      dummy.position.set(x, y, z);
      dummy.rotation.set(index * 0.07, index * 0.23, 0);
      dummy.scale.set(10 + (index % 5) * 2.4, 2.8 + (index % 3) * 0.9, 6.5 + ((index + 2) % 5) * 1.8);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    this.worldRoot.add(mesh);
  }

  private updateWorldAnchor(snapshot: CartArenaSessionSnapshot): void {
    const nextX = Math.round(snapshot.x / WORLD_CHUNK) * WORLD_CHUNK;
    const nextZ = Math.round(snapshot.z / WORLD_CHUNK) * WORLD_CHUNK;
    if (nextX === this.chunkX && nextZ === this.chunkZ) return;
    this.chunkX = nextX;
    this.chunkZ = nextZ;
    this.worldRoot.position.set(nextX, 0, nextZ);
  }

  private buildEngineSystem(): void {
    for (const side of [-1, 1]) {
      const root = new THREE.Group();
      root.position.set(side * 0.48, 0.48, -1.48);

      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xf3ffff,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const outerMat = new THREE.MeshBasicMaterial({
        color: 0x45cfff,
        transparent: true,
        opacity: 0.46,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const core = new THREE.Mesh(new THREE.ConeGeometry(0.15, 2.4, 12, 1, true), coreMat);
      core.rotation.x = -Math.PI / 2;
      core.position.z = -1.1;
      const outer = new THREE.Mesh(new THREE.ConeGeometry(0.31, 4.2, 14, 1, true), outerMat);
      outer.rotation.x = -Math.PI / 2;
      outer.position.z = -1.95;
      root.add(core, outer);

      const diamonds: EngineFx["diamonds"] = [];
      for (let index = 0; index < 5; index += 1) {
        const diamond = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.16 - index * 0.012, 0),
          new THREE.MeshBasicMaterial({
            color: index % 2 === 0 ? 0xeaffff : 0x5bdcff,
            transparent: true,
            opacity: 0.72,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          }),
        );
        diamond.position.z = -1.15 - index * 0.52;
        root.add(diamond);
        diamonds.push(diamond);
      }

      const rings: EngineFx["rings"] = [];
      for (let index = 0; index < 3; index += 1) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.22 + index * 0.06, 0.015, 5, 18),
          new THREE.MeshBasicMaterial({
            color: 0x8beaff,
            transparent: true,
            opacity: 0.38,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          }),
        );
        ring.position.z = -1.4 - index * 0.72;
        root.add(ring);
        rings.push(ring);
      }

      root.visible = false;
      this.engineFxRoot.add(root);
      this.engineFx.push({ root, core, outer, diamonds, rings });
    }

    const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x536671, roughness: 0.26, metalness: 0.62 });
    for (const side of [-1, 1]) {
      const nozzle = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.07, 7, 18), nozzleMat.clone());
      nozzle.name = "sky-dancer-v22-engine-nozzle";
      nozzle.position.set(side * 0.48, 0.48, -1.53);
      this.engineFxRoot.add(nozzle);
    }
  }

  private updateEngineSystem(_delta: number): void {
    const session = this.runtimeV22.session as unknown as CartArenaSession;
    const turbo = getSkyDancerTurboState(session);
    const releaseEnvelope = turbo.releaseAgeSeconds < 0.9
      ? 1 - THREE.MathUtils.clamp(turbo.releaseAgeSeconds / 0.9, 0, 1)
      : 0;
    const intensity = turbo.held
      ? 0.45 + turbo.charge * 0.38
      : releaseEnvelope > 0
        ? 0.78 + releaseEnvelope * 0.42
        : 0.18;
    const visible = turbo.held || releaseEnvelope > 0.02;

    for (let engineIndex = 0; engineIndex < this.engineFx.length; engineIndex += 1) {
      const engine = this.engineFx[engineIndex];
      engine.root.visible = visible;
      if (!visible) continue;
      const flutter = 0.94 + Math.sin(this.elapsedV22 * 39 + engineIndex * 1.7) * 0.06;
      engine.core.scale.set(0.86 + intensity * 0.34, 0.86 + intensity * 0.34, flutter * (0.78 + intensity * 0.55));
      engine.outer.scale.set(0.82 + intensity * 0.42, 0.82 + intensity * 0.42, flutter * (0.72 + intensity * 0.95));
      engine.core.material.opacity = Math.min(1, 0.5 + intensity * 0.48);
      engine.outer.material.opacity = Math.min(0.72, 0.22 + intensity * 0.38);
      engine.diamonds.forEach((diamond, index) => {
        const pulse = 0.82 + Math.sin(this.elapsedV22 * 31 + index * 0.9) * 0.18;
        diamond.scale.setScalar((0.72 + intensity * 0.65) * pulse);
        diamond.material.opacity = 0.34 + intensity * 0.42;
      });
      engine.rings.forEach((ring, index) => {
        const pulse = 0.92 + Math.sin(this.elapsedV22 * 20 + index * 1.8) * 0.08;
        ring.scale.setScalar((0.8 + intensity * 0.58) * pulse);
        ring.material.opacity = 0.14 + intensity * 0.28;
      });
    }
  }

  private buildSpeedStreaks(): void {
    const material = new THREE.MeshBasicMaterial({
      color: 0xc5f5ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    for (let index = 0; index < 24; index += 1) {
      const streak = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.004, 0.3 + (index % 5) * 0.06), material.clone());
      const angle = index / 24 * Math.PI * 2;
      const radius = 0.16 + (index % 6) * 0.055;
      streak.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.58, -0.9 - (index % 4) * 0.12);
      streak.rotation.z = angle;
      streak.renderOrder = 1300;
      this.speedStreaks.add(streak);
    }
  }

  private updateSpeedStreaks(_delta: number): void {
    const turbo = getSkyDancerTurboState(this.runtimeV22.session as unknown as CartArenaSession);
    const release = turbo.releaseAgeSeconds < 0.65 ? 1 - turbo.releaseAgeSeconds / 0.65 : 0;
    const intensity = turbo.held ? 0.2 + turbo.charge * 0.28 : release * 0.7;
    this.speedStreaks.visible = intensity > 0.03;
    let index = 0;
    for (const object of this.speedStreaks.children) {
      if (!(object instanceof THREE.Mesh)) continue;
      const material = object.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, intensity * (0.48 + (index % 5) * 0.08));
      object.position.z += 0.02 + intensity * 0.05;
      if (object.position.z > -0.48) object.position.z = -1.28;
      index += 1;
    }
  }

  private polishAircraftMaterials(): void {
    const tune = (root: THREE.Object3D, enemy: boolean): void => {
      root.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (material instanceof THREE.MeshStandardMaterial) {
            material.roughness = enemy ? Math.min(material.roughness, 0.46) : Math.min(material.roughness, 0.36);
            material.metalness = Math.max(material.metalness, enemy ? 0.14 : 0.22);
            material.needsUpdate = true;
          }
        }
      });
    };
    tune(this.runtimeV22.playerVisual, false);
    for (const group of this.runtimeV22.enemyGroups.values()) tune(group, true);

    const navRoot = new THREE.Group();
    navRoot.name = "sky-dancer-v22-nav-lights";
    const left = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff5f68, toneMapped: false }));
    left.position.set(-2.05, 0.58, -0.25);
    const right = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0x6dffb1, toneMapped: false }));
    right.position.set(2.05, 0.58, -0.25);
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), new THREE.MeshBasicMaterial({ color: 0xe9fbff, toneMapped: false }));
    tail.position.set(0, 0.82, -1.7);
    navRoot.add(left, right, tail);
    this.runtimeV22.playerVisual.add(navRoot);
  }
}

export { SkyDancerAirCombatFxV22 as SkyDancerAirCombatFx };
