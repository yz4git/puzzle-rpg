import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../cart/CartArenaSession";
import type { SkyDancerMissileState } from "./SkyDancerFlightCombat";
import { SkyDancerAirCombatFxV18 } from "./SkyDancerAirCombatFxV18";
import type { SkyDancerFxRuntime } from "./SkyDancerAirCombatFxV2";

const GROUND_Y = -28.55;
const CHUNK_X = 180;
const CHUNK_Z = 240;

/**
 * V19 deliberately targets the midpoint visual reference: denser readable
 * cities, river/bridges, wind farms, cloud volume and stronger jet/missile
 * effects, while keeping the existing chase-camera distance unchanged.
 */
export class SkyDancerAirCombatFxV19 extends SkyDancerAirCombatFxV18 {
  private readonly runtimeV19: SkyDancerFxRuntime;
  private readonly heroWorld = new THREE.Group();
  private readonly cinematicBoost = new THREE.Group();
  private builtV19 = false;
  private chunkX = Number.NaN;
  private chunkZ = Number.NaN;
  private elapsedV19 = 0;

  constructor(runtime: SkyDancerFxRuntime) {
    super(runtime);
    this.runtimeV19 = runtime;
    this.heroWorld.name = "sky-dancer-v19-midpoint-world";
    this.cinematicBoost.name = "sky-dancer-v19-cinematic-boost";
    this.cinematicBoost.visible = false;
    this.tuneAtmosphere();
  }

  override update(snapshot: CartArenaSessionSnapshot, missiles: SkyDancerMissileState, delta: number): void {
    super.update(snapshot, missiles, delta);
    this.elapsedV19 += delta;
    if (!this.builtV19) {
      this.builtV19 = true;
      this.buildMidpointWorld();
      this.buildCinematicBoost();
      this.runtimeV19.scene.add(this.heroWorld);
      this.runtimeV19.playerVisual.add(this.cinematicBoost);
    }
    this.updateWorldAnchor(snapshot);
    this.updateCinematicBoost(snapshot, delta);
    this.enhancePlayerMissiles();
  }

  private tuneAtmosphere(): void {
    const renderer = (this.runtimeV19 as SkyDancerFxRuntime & { renderer?: THREE.WebGLRenderer }).renderer;
    if (renderer) renderer.toneMappingExposure = 1.18;
    this.runtimeV19.scene.background = new THREE.Color(0x62b9ed);
    if (this.runtimeV19.scene.fog instanceof THREE.Fog) {
      this.runtimeV19.scene.fog.color.setHex(0xb7ddef);
      this.runtimeV19.scene.fog.near = 185;
      this.runtimeV19.scene.fog.far = 650;
    }
    for (const child of this.runtimeV19.scene.children) {
      if (child instanceof THREE.HemisphereLight) child.intensity = Math.max(child.intensity, 2.45);
      if (child instanceof THREE.DirectionalLight) child.intensity = Math.max(child.intensity, 1.15);
    }
  }

  private buildMidpointWorld(): void {
    this.buildReadableCity();
    this.buildDistantSkyline();
    this.buildRoadNetwork();
    this.buildRiverAndBridges();
    this.buildWindFarm();
    this.buildCloudVolume();
  }

  private buildReadableCity(): void {
    const count = 168;
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.68,
        metalness: 0.09,
        flatShading: true,
        vertexColors: true,
      }),
      count,
    );
    mesh.name = "sky-dancer-v19-readable-city";
    const colors = [0xe5e3dc, 0xc7d2d5, 0xb8c6c8, 0xd5c6b4, 0xa9b8bb, 0xd8d1c6, 0xb6a998]
      .map((value) => new THREE.Color(value));
    const dummy = new THREE.Object3D();
    for (let index = 0; index < count; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const row = Math.floor(index / 14);
      const lane = index % 14;
      const x = side * (30 + (lane % 7) * 9.2) + Math.sin(index * 1.31) * 2.4;
      const z = -102 + row * 25.5 + Math.cos(index * 0.77) * 3.2;
      const height = 4.6 + (index % 9) * 1.12 + (lane % 5 === 0 ? 3.8 : 0);
      const width = 2.8 + (index % 4) * 0.75;
      const depth = 2.8 + ((index + 2) % 5) * 0.62;
      dummy.position.set(x, GROUND_Y + height * 0.5, z);
      dummy.rotation.set(0, (side * 0.035) + (row % 3 - 1) * 0.025, 0);
      dummy.scale.set(width, height, depth);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, colors[(index * 5 + row) % colors.length]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    this.heroWorld.add(mesh);

    const roofMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x8fa4aa, roughness: 0.56, metalness: 0.2, flatShading: true }),
      84,
    );
    roofMesh.name = "sky-dancer-v19-rooftop-equipment";
    for (let index = 0; index < 84; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const row = Math.floor(index / 14);
      const lane = index % 14;
      const x = side * (31 + (lane % 7) * 9.2);
      const z = -96 + row * 38;
      const height = 8.2 + (index % 7) * 1.05;
      dummy.position.set(x, GROUND_Y + height + 0.42, z);
      dummy.scale.set(1.15 + (index % 3) * 0.3, 0.55, 1.0 + ((index + 1) % 3) * 0.25);
      dummy.rotation.set(0, index * 0.21, 0);
      dummy.updateMatrix();
      roofMesh.setMatrixAt(index, dummy.matrix);
    }
    roofMesh.instanceMatrix.needsUpdate = true;
    roofMesh.frustumCulled = false;
    this.heroWorld.add(roofMesh);
  }

  private buildDistantSkyline(): void {
    const root = new THREE.Group();
    root.name = "sky-dancer-v19-skyline";
    const glass = new THREE.MeshStandardMaterial({
      color: 0xb7cbd4,
      roughness: 0.3,
      metalness: 0.28,
      flatShading: true,
      emissive: 0x244250,
      emissiveIntensity: 0.08,
    });
    const pale = new THREE.MeshStandardMaterial({ color: 0xd6d9d8, roughness: 0.52, metalness: 0.12, flatShading: true });
    for (let index = 0; index < 30; index += 1) {
      const side = index % 2 === 0 ? 1 : -1;
      const x = side * (96 + (index % 6) * 9.5);
      const z = 88 + Math.floor(index / 6) * 27 + (index % 3) * 5;
      const height = 13 + (index % 8) * 1.7;
      const tower = new THREE.Mesh(
        index % 4 === 0 ? new THREE.CylinderGeometry(2.5, 3.2, height, 8) : new THREE.BoxGeometry(5.3, height, 5.3),
        index % 3 === 0 ? glass.clone() : pale.clone(),
      );
      tower.position.set(x, GROUND_Y + height * 0.5, z);
      tower.rotation.y = index * 0.13;
      root.add(tower);
      if (index % 5 === 0) {
        const antenna = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.2, 4.2, 6),
          new THREE.MeshBasicMaterial({ color: 0xff6c5c, toneMapped: false }),
        );
        antenna.position.set(x, GROUND_Y + height + 2.1, z);
        root.add(antenna);
      }
    }
    this.heroWorld.add(root);
  }

  private buildRoadNetwork(): void {
    const root = new THREE.Group();
    root.name = "sky-dancer-v19-road-network";
    const asphalt = new THREE.MeshStandardMaterial({ color: 0x4f5d60, roughness: 0.88, metalness: 0.02 });
    const lane = new THREE.MeshBasicMaterial({ color: 0xe9d69a, transparent: true, opacity: 0.7, depthWrite: false });
    for (const x of [-18, 18, -70, 70]) {
      const road = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x) === 18 ? 5.8 : 3.8, 0.09, 420), asphalt.clone());
      road.position.set(x, GROUND_Y + 0.16, 45);
      root.add(road);
      if (Math.abs(x) === 18) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.05, 420), lane.clone());
        stripe.position.set(x, GROUND_Y + 0.23, 45);
        root.add(stripe);
      }
    }
    for (let row = -3; row <= 5; row += 1) {
      const z = row * 44;
      const road = new THREE.Mesh(new THREE.BoxGeometry(168, 0.08, 4.2), asphalt.clone());
      road.position.set(0, GROUND_Y + 0.15, z);
      root.add(road);
    }
    this.heroWorld.add(root);
  }

  private buildRiverAndBridges(): void {
    const root = new THREE.Group();
    root.name = "sky-dancer-v19-river-bridges";
    const water = new THREE.Mesh(
      new THREE.BoxGeometry(28, 0.09, 430),
      new THREE.MeshStandardMaterial({
        color: 0x3f9db8,
        roughness: 0.22,
        metalness: 0.16,
        transparent: true,
        opacity: 0.88,
      }),
    );
    water.position.set(112, GROUND_Y + 0.08, 56);
    root.add(water);

    for (const z of [12, 144]) {
      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(54, 0.34, 4.8),
        new THREE.MeshStandardMaterial({ color: 0x596469, roughness: 0.72, metalness: 0.08 }),
      );
      deck.position.set(112, GROUND_Y + 0.48, z);
      root.add(deck);
      const red = new THREE.MeshStandardMaterial({ color: 0xb85b51, roughness: 0.52, metalness: 0.14, flatShading: true });
      for (const x of [102, 122]) {
        const tower = new THREE.Mesh(new THREE.BoxGeometry(0.9, 8.2, 1.1), red.clone());
        tower.position.set(x, GROUND_Y + 4.5, z);
        root.add(tower);
        const cross = new THREE.Mesh(new THREE.BoxGeometry(20.8, 0.45, 0.55), red.clone());
        cross.position.set(112, GROUND_Y + 8.1, z);
        root.add(cross);
      }
    }
    this.heroWorld.add(root);
  }

  private buildWindFarm(): void {
    const root = new THREE.Group();
    root.name = "sky-dancer-v19-wind-farm";
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xe3ecee, roughness: 0.52, metalness: 0.15 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xf2f6f6, roughness: 0.48, metalness: 0.08 });
    for (let index = 0; index < 14; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const x = side * (132 + (index % 4) * 14);
      const z = -54 + index * 28;
      const mastHeight = 9 + (index % 3) * 1.1;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, mastHeight, 7), poleMat.clone());
      mast.position.set(x, GROUND_Y + mastHeight * 0.5, z);
      root.add(mast);
      const hub = new THREE.Group();
      hub.position.set(x, GROUND_Y + mastHeight, z);
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 5), poleMat.clone());
      hub.add(center);
      for (let blade = 0; blade < 3; blade += 1) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 4.2, 0.1), bladeMat.clone());
        arm.position.y = 2;
        arm.rotation.z = blade * Math.PI * 2 / 3;
        hub.add(arm);
      }
      hub.rotation.z = index * 0.47;
      root.add(hub);
    }
    this.heroWorld.add(root);
  }

  private buildCloudVolume(): void {
    const root = new THREE.Group();
    root.name = "sky-dancer-v19-cloud-volume";
    const material = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.19,
      depthWrite: false,
    });
    for (let index = 0; index < 34; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const cloud = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), material.clone());
      cloud.position.set(
        side * (66 + (index % 8) * 13),
        11 + (index % 5) * 3.2,
        -70 + Math.floor(index / 2) * 24,
      );
      const sx = 5.8 + (index % 4) * 2.2;
      cloud.scale.set(sx, 1.7 + (index % 3) * 0.55, 3.4 + ((index + 1) % 4) * 1.1);
      root.add(cloud);
    }
    this.heroWorld.add(root);
  }

  private buildCinematicBoost(): void {
    const outerMaterial = new THREE.MeshBasicMaterial({
      color: 0x43cfff,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: 0xe9fdff,
      transparent: true,
      opacity: 0.74,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    for (const x of [-0.62, 0.62]) {
      const outerGeometry = new THREE.ConeGeometry(0.34, 6.1, 12, 1, true);
      outerGeometry.rotateX(-Math.PI / 2);
      const outer = new THREE.Mesh(outerGeometry, outerMaterial.clone());
      outer.name = "sky-dancer-v19-boost-outer";
      outer.position.set(x, 0.57, -5.15);
      const innerGeometry = new THREE.ConeGeometry(0.15, 4.3, 10, 1, true);
      innerGeometry.rotateX(-Math.PI / 2);
      const inner = new THREE.Mesh(innerGeometry, innerMaterial.clone());
      inner.name = "sky-dancer-v19-boost-inner";
      inner.position.set(x, 0.57, -4.18);
      this.cinematicBoost.add(outer, inner);

      for (let cell = 0; cell < 5; cell += 1) {
        const diamond = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.18 - cell * 0.018, 0),
          innerMaterial.clone(),
        );
        diamond.name = "sky-dancer-v19-boost-cell";
        diamond.position.set(x, 0.57, -2.65 - cell * 0.72);
        diamond.scale.z = 1.35;
        this.cinematicBoost.add(diamond);
      }
    }
  }

  private updateWorldAnchor(snapshot: CartArenaSessionSnapshot): void {
    const nextX = Math.round(snapshot.x / CHUNK_X) * CHUNK_X;
    const nextZ = Math.round(snapshot.z / CHUNK_Z) * CHUNK_Z;
    if (nextX === this.chunkX && nextZ === this.chunkZ) return;
    this.chunkX = nextX;
    this.chunkZ = nextZ;
    this.heroWorld.position.set(nextX, 0, nextZ);
  }

  private updateCinematicBoost(snapshot: CartArenaSessionSnapshot, delta: number): void {
    this.cinematicBoost.visible = snapshot.boostActive;
    if (!snapshot.boostActive) return;
    const pulse = 0.94 + Math.sin(this.elapsedV19 * 25) * 0.06;
    for (const child of this.cinematicBoost.children) {
      if (!(child instanceof THREE.Mesh)) continue;
      if (child.name === "sky-dancer-v19-boost-outer") {
        child.scale.set(1 + Math.sin(this.elapsedV19 * 17 + child.position.x) * 0.07, 1, pulse);
        (child.material as THREE.MeshBasicMaterial).opacity = 0.24 + pulse * 0.12;
      } else if (child.name === "sky-dancer-v19-boost-inner") {
        child.scale.set(1, 1, 0.93 + pulse * 0.13);
        (child.material as THREE.MeshBasicMaterial).opacity = 0.68 + pulse * 0.16;
      } else {
        child.rotation.z += delta * 2.3;
      }
    }
  }

  private enhancePlayerMissiles(): void {
    const root = this.runtimeV19.scene.getObjectByName("sky-dancer-q10-player-missiles");
    if (!root) return;
    for (const child of root.children) {
      if (!(child instanceof THREE.Group)) continue;
      child.scale.setScalar(2.15);
      if (child.getObjectByName("sky-dancer-v19-player-missile-trail")) continue;
      const trail = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.055, 5.4),
        new THREE.MeshBasicMaterial({
          color: 0x79eaff,
          transparent: true,
          opacity: 0.48,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      trail.name = "sky-dancer-v19-player-missile-trail";
      trail.position.z = -3.05;
      const flare = new THREE.Mesh(
        new THREE.SphereGeometry(0.19, 8, 5),
        new THREE.MeshBasicMaterial({
          color: 0xf4ffff,
          transparent: true,
          opacity: 0.92,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      flare.name = "sky-dancer-v19-player-missile-flare";
      flare.position.z = -0.66;
      child.add(trail, flare);
    }
  }
}

export { SkyDancerAirCombatFxV19 as SkyDancerAirCombatFx };
