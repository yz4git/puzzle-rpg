import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../cart/CartArenaSession";
import type { SkyDancerMissileState } from "./SkyDancerFlightCombat";
import { SkyDancerAirCombatFxV12 } from "./SkyDancerAirCombatFxV12";
import type { SkyDancerFxRuntime } from "./SkyDancerAirCombatFxV2";
import { installSkyDancerCombatDoctrine } from "./SkyDancerCombatDoctrine";
import { getSkyDancerPlayerWeaponState } from "./SkyDancerPlayerWeapons";

const GROUND_Y = -34;

interface PlumeVisual {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  baseOpacity: number;
  phase: number;
}

/**
 * V13 final presentation pass.
 *
 * Built from the V12 real-WebGL capture rather than source inspection alone:
 * - restores terrain contrast that was being flattened by low fog,
 * - adds readable near-route fields, tree belts and settlements,
 * - replaces the rectangular Turbo columns with crossed tapered jet ribbons,
 * - makes player missile launches/readability obvious from the chase camera,
 * - installs the missile-only combat doctrine that suppresses legacy ram charge.
 */
export class SkyDancerAirCombatFxV13 extends SkyDancerAirCombatFxV12 {
  private readonly runtimeV13: SkyDancerFxRuntime;
  private builtV13 = false;
  private elapsedV13 = 0;
  private readonly turboRootV13 = new THREE.Group();
  private readonly plumeVisuals: PlumeVisual[] = [];
  private readonly shotFlashRoot = new THREE.Group();
  private lastShotSerial = 0;
  private shotFlashLife = 0;

  constructor(runtime: SkyDancerFxRuntime) {
    super(runtime);
    this.runtimeV13 = runtime;
    installSkyDancerCombatDoctrine();
    this.turboRootV13.name = "sky-dancer-q13-tapered-afterburner";
    this.shotFlashRoot.name = "sky-dancer-q13-shot-flash";
  }

  override update(snapshot: CartArenaSessionSnapshot, missiles: SkyDancerMissileState, delta: number): void {
    super.update(snapshot, missiles, delta);
    this.elapsedV13 += delta;

    if (!this.builtV13) {
      this.builtV13 = true;
      this.tuneAtmosphereAndLegacyLines();
      this.buildNearRouteContrast();
      this.buildTreeBelts();
      this.buildSettlements();
      this.buildTaperedAfterburner();
      this.buildShotFlash();
    }

    this.updateTaperedAfterburner(snapshot);
    this.updateShotFeedback(delta);
    this.enhancePlayerMissiles();
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

  private tuneAtmosphereAndLegacyLines(): void {
    const scene = this.runtimeV13.scene;
    scene.background = new THREE.Color(0x79c3ec);
    // V7's 104-unit fog start made the low-altitude ground collapse into one
    // olive tone. Keep atmospheric depth but preserve field/city color contrast.
    scene.fog = new THREE.Fog(0xcfe1e5, 150, 520);

    const oldRoads = scene.getObjectByName("sky-dancer-q5-road-network");
    if (oldRoads instanceof THREE.LineSegments && oldRoads.material instanceof THREE.LineBasicMaterial) {
      oldRoads.material.opacity = Math.min(oldRoads.material.opacity, 0.09);
    }

    const highways = scene.getObjectByName("sky-dancer-q11-highways");
    highways?.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshBasicMaterial)) return;
      object.material.opacity = Math.max(object.material.opacity, 0.84);
    });
  }

  private buildNearRouteContrast(): void {
    const count = 80;
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 0.05, 1),
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
      count,
    );
    mesh.name = "sky-dancer-q13-near-fields";
    const colors = [
      0x4f713f, 0x6d8749, 0x9a8348, 0xb39a61,
      0x547b58, 0x876a46, 0x3f6848, 0x78975a,
    ].map((value) => new THREE.Color(value));
    const dummy = new THREE.Object3D();
    let cursor = 0;

    for (let band = 0; band < 20; band += 1) {
      const zBase = -24 + band * 34;
      for (let lane = 0; lane < 4; lane += 1) {
        const side = lane < 2 ? -1 : 1;
        const tier = lane % 2;
        const x = side * (22 + tier * 38 + Math.sin((band + 1) * (lane + 2)) * 5.5);
        const z = zBase + Math.cos((band + 2) * (lane + 1)) * 5.5;
        const sx = 13 + ((band + lane) % 4) * 3.6;
        const sz = 14 + ((band * 2 + lane) % 5) * 3.1;
        dummy.position.set(x, this.groundAt(x, z, 0.46), z);
        dummy.rotation.set(0, (lane - 1.5) * 0.028 + Math.sin(band) * 0.018, 0);
        dummy.scale.set(sx, 1, sz);
        dummy.updateMatrix();
        mesh.setMatrixAt(cursor, dummy.matrix);
        mesh.setColorAt(cursor, colors[(band * 3 + lane * 5) % colors.length]);
        cursor += 1;
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    this.runtimeV13.scene.add(mesh);
  }

  private buildTreeBelts(): void {
    const count = 240;
    const trees = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.62, 1, 5),
      new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
      count,
    );
    trees.name = "sky-dancer-q13-tree-belts";
    const colors = [0x284f35, 0x315d39, 0x3c6840, 0x254834].map((value) => new THREE.Color(value));
    const dummy = new THREE.Object3D();

    for (let index = 0; index < count; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const band = Math.floor(index / 12);
      const lane = index % 12;
      const x = side * (30 + (lane % 6) * 15.5) + Math.sin(index * 1.77) * 4.5;
      const z = -42 + band * 34 + Math.cos(index * 0.93) * 8;
      const h = 2.4 + (index % 7) * 0.42;
      dummy.position.set(x, this.groundAt(x, z, h * 0.5 + 0.45), z);
      dummy.rotation.set(0, index * 0.47, 0);
      dummy.scale.set(0.78 + (index % 4) * 0.15, h, 0.78 + ((index + 2) % 4) * 0.14);
      dummy.updateMatrix();
      trees.setMatrixAt(index, dummy.matrix);
      trees.setColorAt(index, colors[index % colors.length]);
    }

    trees.instanceMatrix.needsUpdate = true;
    if (trees.instanceColor) trees.instanceColor.needsUpdate = true;
    trees.frustumCulled = false;
    this.runtimeV13.scene.add(trees);
  }

  private buildSettlements(): void {
    const count = 120;
    const buildings = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0.02, flatShading: true }),
      count,
    );
    buildings.name = "sky-dancer-q13-near-settlements";
    const colors = [0xc7b9a2, 0xaaa99d, 0xc68b67, 0xd3c8ad, 0x8f9996].map((value) => new THREE.Color(value));
    const dummy = new THREE.Object3D();

    for (let index = 0; index < count; index += 1) {
      const cluster = index % 10;
      const row = Math.floor(index / 10);
      const side = cluster % 2 === 0 ? -1 : 1;
      const centerX = side * (56 + (cluster % 5) * 14);
      const centerZ = 20 + row * 51;
      const x = centerX + ((index * 7) % 9 - 4) * 3.3;
      const z = centerZ + ((index * 11) % 9 - 4) * 3.0;
      const h = 3.0 + (index % 8) * 0.78;
      dummy.position.set(x, this.groundAt(x, z, h * 0.5 + 0.5), z);
      dummy.rotation.set(0, side * 0.05 + (index % 3) * 0.025, 0);
      dummy.scale.set(2.2 + (index % 4) * 0.55, h, 2.0 + ((index + 1) % 4) * 0.5);
      dummy.updateMatrix();
      buildings.setMatrixAt(index, dummy.matrix);
      buildings.setColorAt(index, colors[index % colors.length]);
    }

    buildings.instanceMatrix.needsUpdate = true;
    if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true;
    buildings.frustumCulled = false;
    this.runtimeV13.scene.add(buildings);
  }

  private taperedRibbonGeometry(
    frontHalfWidth: number,
    tailHalfWidth: number,
    length: number,
    frontColor: number,
    tailColor: number,
  ): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([
      -frontHalfWidth, 0, 0,
      frontHalfWidth, 0, 0,
      -tailHalfWidth, 0, -length,
      frontHalfWidth, 0, 0,
      tailHalfWidth, 0, -length,
      -tailHalfWidth, 0, -length,
    ], 3));

    const front = new THREE.Color(frontColor);
    const tail = new THREE.Color(tailColor);
    geometry.setAttribute("color", new THREE.Float32BufferAttribute([
      front.r, front.g, front.b,
      front.r, front.g, front.b,
      tail.r, tail.g, tail.b,
      front.r, front.g, front.b,
      tail.r, tail.g, tail.b,
      tail.r, tail.g, tail.b,
    ], 3));
    return geometry;
  }

  private buildTaperedAfterburner(): void {
    this.runtimeV13.playerVisual.add(this.turboRootV13);
    const layers = [
      { front: 0.15, tail: 0.62, length: 6.6, frontColor: 0x67dcff, tailColor: 0x114c7a, opacity: 0.24 },
      { front: 0.09, tail: 0.38, length: 4.9, frontColor: 0xc1f8ff, tailColor: 0x168fc7, opacity: 0.38 },
      { front: 0.045, tail: 0.17, length: 2.9, frontColor: 0xffffff, tailColor: 0x62e5ff, opacity: 0.58 },
    ] as const;

    for (const side of [-1, 1]) {
      for (let layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
        const layer = layers[layerIndex];
        const geometry = this.taperedRibbonGeometry(layer.front, layer.tail, layer.length, layer.frontColor, layer.tailColor);
        for (const crossed of [false, true]) {
          const material = new THREE.MeshBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
            side: THREE.DoubleSide,
          });
          const mesh = new THREE.Mesh(geometry.clone(), material);
          mesh.name = "sky-dancer-q13-turbo-ribbon";
          mesh.position.set(side * 0.34, 0.35, -2.16);
          if (crossed) mesh.rotation.z = Math.PI / 2;
          this.turboRootV13.add(mesh);
          this.plumeVisuals.push({
            mesh,
            baseOpacity: layer.opacity,
            phase: layerIndex * 0.81 + (crossed ? 0.37 : 0) + (side > 0 ? 0.52 : 0),
          });
        }
      }
    }
    this.turboRootV13.visible = false;
  }

  private updateTaperedAfterburner(snapshot: CartArenaSessionSnapshot): void {
    const player = this.runtimeV13.playerVisual;
    const q9 = player.getObjectByName("sky-dancer-q9-afterburner-system");
    const active = Boolean(q9?.visible || snapshot.boostActive);

    // Remove the V9/V11 column-like layers but retain V9 shock diamonds,
    // compression rings and peripheral streaks around the new tapered ribbons.
    player.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (
        object.name === "sky-dancer-q9-turbo-plume"
        || object.name === "sky-dancer-q9-turbo-core"
        || object.name === "sky-dancer-q11-turbo-ribbon"
      ) {
        object.visible = false;
      }
    });

    this.turboRootV13.visible = active;
    if (!active) return;

    for (const visual of this.plumeVisuals) {
      const flicker = 0.86 + Math.sin(this.elapsedV13 * 29 + visual.phase) * 0.11;
      visual.mesh.material.opacity = visual.baseOpacity * flicker;
      visual.mesh.scale.z = 0.92 + flicker * 0.16;
      visual.mesh.scale.x = 0.94 + Math.sin(this.elapsedV13 * 21 + visual.phase) * 0.05;
      visual.mesh.scale.y = 0.94 + Math.cos(this.elapsedV13 * 19 + visual.phase) * 0.05;
    }
  }

  private buildShotFlash(): void {
    const material = new THREE.MeshBasicMaterial({
      color: 0xbdf8ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    for (const side of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.045, 5, 18), material.clone());
      ring.name = "sky-dancer-q13-shot-ring";
      ring.position.set(side * 0.62, 0.36, 2.72);
      this.shotFlashRoot.add(ring);

      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.27, 0), material.clone());
      star.name = "sky-dancer-q13-shot-star";
      star.position.set(side * 0.62, 0.36, 2.78);
      this.shotFlashRoot.add(star);
    }
    const light = new THREE.PointLight(0x81edff, 0, 15, 2);
    light.name = "sky-dancer-q13-shot-light";
    light.position.set(0, 0.42, 2.45);
    this.shotFlashRoot.add(light);
    this.shotFlashRoot.visible = false;
    this.runtimeV13.playerVisual.add(this.shotFlashRoot);
  }

  private updateShotFeedback(delta: number): void {
    const state = getSkyDancerPlayerWeaponState(this.runtimeV13.session);
    if (state.shotSerial !== this.lastShotSerial) {
      this.lastShotSerial = state.shotSerial;
      this.shotFlashLife = 0.32;
    }
    this.shotFlashLife = Math.max(0, this.shotFlashLife - delta);
    const strength = THREE.MathUtils.clamp(this.shotFlashLife / 0.32, 0, 1);
    this.shotFlashRoot.visible = strength > 0.01;
    if (!this.shotFlashRoot.visible) return;

    for (const child of this.shotFlashRoot.children) {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
        child.material.opacity = strength * 0.82;
        child.scale.setScalar(0.9 + (1 - strength) * 1.25);
        child.rotation.z += delta * 5.8;
      } else if (child instanceof THREE.PointLight) {
        child.intensity = strength * 7.5;
      }
    }
  }

  private enhancePlayerMissiles(): void {
    this.runtimeV13.scene.traverse((object) => {
      if (object.name !== "sky-dancer-q10-player-missile") return;
      object.scale.setScalar(2.05);

      const bloom = object.getObjectByName("sky-dancer-q12-missile-bloom");
      if (bloom instanceof THREE.Mesh && bloom.material instanceof THREE.MeshBasicMaterial) {
        bloom.scale.setScalar(1.55);
        bloom.material.opacity = 0.82;
      }
      const streak = object.getObjectByName("sky-dancer-q12-missile-streak");
      if (streak instanceof THREE.Mesh && streak.material instanceof THREE.MeshBasicMaterial) {
        streak.scale.set(1.65, 1.65, 1.32);
        streak.material.opacity = 0.56;
      }

      if (object.userData.skyDancerQ13Enhanced) return;
      object.userData.skyDancerQ13Enhanced = true;
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.38, 0.032, 5, 20),
        new THREE.MeshBasicMaterial({
          color: 0xa8f5ff,
          transparent: true,
          opacity: 0.62,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      halo.name = "sky-dancer-q13-missile-halo";
      object.add(halo);

      const flare = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.34, 0),
        new THREE.MeshBasicMaterial({
          color: 0xd8fbff,
          transparent: true,
          opacity: 0.78,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      flare.name = "sky-dancer-q13-missile-flare";
      flare.position.z = -0.58;
      object.add(flare);
    });
  }
}

export { SkyDancerAirCombatFxV13 as SkyDancerAirCombatFx };
