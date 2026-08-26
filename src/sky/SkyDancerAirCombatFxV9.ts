import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../cart/CartArenaSession";
import { getCartTurboCombatState } from "../cart/CartRoguePhase15Turbo";
import type { SkyDancerMissileState } from "./SkyDancerFlightCombat";
import { SkyDancerAirCombatFxV8 } from "./SkyDancerAirCombatFxV8";
import type { SkyDancerFxRuntime } from "./SkyDancerAirCombatFxV2";

const GROUND_Y = -34;

interface TurboPlumePiece {
  mesh: THREE.Mesh;
  phase: number;
  kind: "plume" | "diamond" | "ring" | "streak";
  baseZ: number;
}

/**
 * V9 visual density pass.
 * Adds readable ground texture/settlements/vegetation and replaces the simple
 * boost cone silhouette with layered jet plumes, shock diamonds and streaks.
 */
export class SkyDancerAirCombatFxV9 extends SkyDancerAirCombatFxV8 {
  private readonly runtimeV9: SkyDancerFxRuntime;
  private worldBuilt = false;
  private turboBuilt = false;
  private readonly turboRoot = new THREE.Group();
  private readonly turboPieces: TurboPlumePiece[] = [];
  private elapsedV9 = 0;

  constructor(runtime: SkyDancerFxRuntime) {
    super(runtime);
    this.runtimeV9 = runtime;
    this.turboRoot.name = "sky-dancer-q9-afterburner-system";
  }

  override update(snapshot: CartArenaSessionSnapshot, missiles: SkyDancerMissileState, delta: number): void {
    super.update(snapshot, missiles, delta);
    this.elapsedV9 += delta;
    if (!this.worldBuilt) {
      this.worldBuilt = true;
      this.buildWorldDensityPass();
    }
    if (!this.turboBuilt) {
      this.turboBuilt = true;
      this.buildTurboSystem();
    }
    this.updateTurboSystem(snapshot);
    this.updateWorldMotion(snapshot);
  }

  private elevation(x: number, z: number): number {
    const broad = Math.sin(x * 0.011) * 0.72 + Math.cos(z * 0.0105) * 0.66;
    const cross = Math.sin((x + z) * 0.0062) * 0.48 + Math.cos((x - z) * 0.0051) * 0.36;
    return broad + cross;
  }

  private groundAt(x: number, z: number, lift = 0): number {
    return GROUND_Y + this.elevation(x, z) + lift;
  }

  private buildWorldDensityPass(): void {
    const scene = this.runtimeV9.scene;

    // Forest canopy: many small low-poly crowns make the ground read as a place,
    // not as a few oversized rectangles viewed from an empty skybox.
    const trees = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.7, 2.5, 5),
      new THREE.MeshLambertMaterial({ color: 0x4d744c, flatShading: true }),
      360,
    );
    trees.name = "sky-dancer-q9-forest-canopy";
    const treeDummy = new THREE.Object3D();
    for (let index = 0; index < 360; index += 1) {
      const cluster = index % 9;
      const lane = Math.floor(index / 9);
      const side = cluster % 2 === 0 ? -1 : 1;
      const x = side * (42 + (cluster % 5) * 21) + Math.sin(index * 2.17) * 19;
      const z = -85 + lane * 11.8 + Math.cos(index * 1.41) * 24;
      const height = 1.6 + (index % 7) * 0.28;
      treeDummy.position.set(x, this.groundAt(x, z, height * 0.48 + 0.2), z);
      treeDummy.rotation.set(0, index * 0.61, 0);
      treeDummy.scale.set(0.8 + (index % 4) * 0.16, height, 0.8 + ((index + 2) % 4) * 0.14);
      treeDummy.updateMatrix();
      trees.setMatrixAt(index, treeDummy.matrix);
    }
    trees.instanceMatrix.needsUpdate = true;
    trees.frustumCulled = false;
    scene.add(trees);

    // Several dense settlement clusters rather than one distant grey city strip.
    const buildings = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0xb7b1a5, roughness: 0.91, metalness: 0.02, flatShading: true }),
      320,
    );
    buildings.name = "sky-dancer-q9-settlement-grid";
    const buildingDummy = new THREE.Object3D();
    for (let index = 0; index < 320; index += 1) {
      const cluster = index % 8;
      const row = Math.floor(index / 8);
      const centerX = (cluster - 3.5) * 48 + Math.sin(cluster * 2.3) * 28;
      const centerZ = -48 + (cluster % 4) * 106;
      const x = centerX + ((row * 17 + cluster * 7) % 13 - 6) * 3.5;
      const z = centerZ + ((row * 11 + cluster * 5) % 17 - 8) * 3.1;
      const h = 1.4 + (index % 11) * 0.42;
      buildingDummy.position.set(x, this.groundAt(x, z, h * 0.5 + 0.22), z);
      buildingDummy.rotation.set(0, (cluster % 4) * 0.08, 0);
      buildingDummy.scale.set(1.1 + (index % 4) * 0.38, h, 1.0 + ((index + 2) % 5) * 0.3);
      buildingDummy.updateMatrix();
      buildings.setMatrixAt(index, buildingDummy.matrix);
    }
    buildings.instanceMatrix.needsUpdate = true;
    buildings.frustumCulled = false;
    scene.add(buildings);

    // Bright roofs give settlements color separation at 100m-class flight level.
    const roofs = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1, 0.7, 4),
      new THREE.MeshLambertMaterial({ color: 0xb66c4f, flatShading: true }),
      96,
    );
    roofs.name = "sky-dancer-q9-village-roofs";
    const roofDummy = new THREE.Object3D();
    for (let index = 0; index < 96; index += 1) {
      const x = -126 + (index % 16) * 16.8 + Math.sin(index * 1.7) * 3;
      const z = 18 + Math.floor(index / 16) * 30 + Math.cos(index * 0.8) * 5;
      roofDummy.position.set(x, this.groundAt(x, z, 2.7 + (index % 3) * 0.3), z);
      roofDummy.rotation.set(0, Math.PI / 4 + (index % 3) * 0.08, 0);
      roofDummy.scale.set(1.4 + (index % 4) * 0.2, 1, 1.2 + ((index + 1) % 3) * 0.2);
      roofDummy.updateMatrix();
      roofs.setMatrixAt(index, roofDummy.matrix);
    }
    roofs.instanceMatrix.needsUpdate = true;
    roofs.frustumCulled = false;
    scene.add(roofs);

    // Broad road strips stay visible at speed. Existing V5 line roads remain as
    // fine secondary roads underneath this stronger hierarchy.
    const roadRoot = new THREE.Group();
    roadRoot.name = "sky-dancer-q9-primary-roads";
    const roadMaterial = new THREE.MeshBasicMaterial({ color: 0x6f7473, transparent: true, opacity: 0.72, depthWrite: false });
    for (let index = -5; index <= 5; index += 1) {
      const road = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.04, 520), roadMaterial);
      const x = index * 30 + Math.sin(index * 1.7) * 8;
      road.position.set(x, this.groundAt(x, 120, 0.38), 120);
      road.rotation.y = index * 0.018;
      roadRoot.add(road);
    }
    for (let index = -3; index <= 5; index += 1) {
      const road = new THREE.Mesh(new THREE.BoxGeometry(390, 0.04, 1.8), roadMaterial.clone());
      const z = index * 62 + 94;
      road.position.set(0, this.groundAt(0, z, 0.4), z);
      road.rotation.y = Math.sin(index) * 0.018;
      roadRoot.add(road);
    }
    scene.add(roadRoot);

    // Lakes/reservoirs break up the green/brown ground palette.
    const waterMaterial = new THREE.MeshBasicMaterial({ color: 0x4d8ea9, transparent: true, opacity: 0.78, depthWrite: false, side: THREE.DoubleSide });
    const waterRoot = new THREE.Group();
    waterRoot.name = "sky-dancer-q9-lakes";
    for (let index = 0; index < 7; index += 1) {
      const lake = new THREE.Mesh(new THREE.CircleGeometry(1, 24), waterMaterial.clone());
      const x = (index % 2 ? -1 : 1) * (84 + index * 19);
      const z = -28 + index * 73;
      lake.rotation.x = -Math.PI / 2;
      lake.rotation.z = index * 0.4;
      lake.position.set(x, this.groundAt(x, z, 0.43), z);
      lake.scale.set(11 + (index % 3) * 5, 7 + ((index + 1) % 3) * 4, 1);
      waterRoot.add(lake);
    }
    scene.add(waterRoot);

    // Slender towers create occasional strong silhouettes and altitude cues.
    const towers = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.2, 0.34, 1, 6),
      new THREE.MeshStandardMaterial({ color: 0xd8d1c4, roughness: 0.72, metalness: 0.08, flatShading: true }),
      52,
    );
    towers.name = "sky-dancer-q9-utility-towers";
    const towerDummy = new THREE.Object3D();
    for (let index = 0; index < 52; index += 1) {
      const x = -172 + (index % 13) * 28 + Math.sin(index * 1.9) * 4;
      const z = -65 + Math.floor(index / 13) * 125 + (index % 5) * 3;
      const h = 4.5 + (index % 6) * 0.7;
      towerDummy.position.set(x, this.groundAt(x, z, h * 0.5 + 0.25), z);
      towerDummy.scale.set(1, h, 1);
      towerDummy.updateMatrix();
      towers.setMatrixAt(index, towerDummy.matrix);
    }
    towers.instanceMatrix.needsUpdate = true;
    towers.frustumCulled = false;
    scene.add(towers);

    // Soft low cloud shadows make the terrain feel layered without textures.
    const shadows = new THREE.InstancedMesh(
      new THREE.CircleGeometry(1, 20),
      new THREE.MeshBasicMaterial({ color: 0x41596a, transparent: true, opacity: 0.07, depthWrite: false }),
      34,
    );
    shadows.name = "sky-dancer-q9-cloud-shadows";
    const shadowDummy = new THREE.Object3D();
    for (let index = 0; index < 34; index += 1) {
      const x = Math.sin(index * 2.37) * 190;
      const z = -110 + index * 18.5;
      shadowDummy.position.set(x, this.groundAt(x, z, 0.5), z);
      shadowDummy.rotation.set(-Math.PI / 2, 0, index * 0.31);
      shadowDummy.scale.set(8 + (index % 5) * 3, 5 + ((index + 2) % 5) * 2.5, 1);
      shadowDummy.updateMatrix();
      shadows.setMatrixAt(index, shadowDummy.matrix);
    }
    shadows.instanceMatrix.needsUpdate = true;
    shadows.frustumCulled = false;
    scene.add(shadows);
  }

  private buildTurboSystem(): void {
    const player = this.runtimeV9.playerVisual;
    player.add(this.turboRoot);
    const plumeMaterial = new THREE.MeshBasicMaterial({
      color: 0x42d8ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0xf0fdff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const diamondMaterial = new THREE.MeshBasicMaterial({
      color: 0x9af2ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

    for (const x of [-0.34, 0.34]) {
      const plumeGeometry = new THREE.CylinderGeometry(0.07, 0.2, 3.8, 8, 1, true);
      plumeGeometry.rotateX(-Math.PI / 2);
      const plume = new THREE.Mesh(plumeGeometry, plumeMaterial.clone());
      plume.name = "sky-dancer-q9-turbo-plume";
      plume.position.set(x, 0.35, -3.45);
      this.turboRoot.add(plume);
      this.turboPieces.push({ mesh: plume, phase: x < 0 ? 0 : 0.7, kind: "plume", baseZ: -3.45 });

      const coreGeometry = new THREE.CylinderGeometry(0.035, 0.075, 2.55, 7, 1, true);
      coreGeometry.rotateX(-Math.PI / 2);
      const core = new THREE.Mesh(coreGeometry, coreMaterial.clone());
      core.name = "sky-dancer-q9-turbo-core";
      core.position.set(x, 0.35, -2.85);
      this.turboRoot.add(core);
      this.turboPieces.push({ mesh: core, phase: x < 0 ? 0.2 : 0.9, kind: "plume", baseZ: -2.85 });

      for (let index = 0; index < 4; index += 1) {
        const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.13 - index * 0.014, 0), diamondMaterial.clone());
        diamond.name = "sky-dancer-q9-shock-diamond";
        const z = -2.6 - index * 0.72;
        diamond.position.set(x, 0.35, z);
        diamond.scale.z = 1.7;
        this.turboRoot.add(diamond);
        this.turboPieces.push({ mesh: diamond, phase: index * 0.83 + (x > 0 ? 0.31 : 0), kind: "diamond", baseZ: z });
      }

      for (let index = 0; index < 3; index += 1) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.18 + index * 0.035, 0.018, 4, 18),
          diamondMaterial.clone(),
        );
        ring.name = "sky-dancer-q9-exhaust-ring";
        ring.rotation.x = Math.PI / 2;
        const z = -2.45 - index * 1.02;
        ring.position.set(x, 0.35, z);
        this.turboRoot.add(ring);
        this.turboPieces.push({ mesh: ring, phase: index * 1.2, kind: "ring", baseZ: z });
      }
    }

    const streakMaterial = new THREE.MeshBasicMaterial({
      color: 0x7de8ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    for (let index = 0; index < 18; index += 1) {
      const streak = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 1.4 + (index % 5) * 0.32), streakMaterial.clone());
      const angle = index / 18 * Math.PI * 2;
      const radius = 0.45 + (index % 6) * 0.16;
      const z = -2.8 - (index % 4) * 0.55;
      streak.position.set(Math.cos(angle) * radius, 0.36 + Math.sin(angle) * radius * 0.42, z);
      streak.rotation.z = angle * 0.08;
      this.turboRoot.add(streak);
      this.turboPieces.push({ mesh: streak, phase: index * 0.41, kind: "streak", baseZ: z });
    }
    this.turboRoot.visible = false;
  }

  private updateTurboSystem(snapshot: CartArenaSessionSnapshot): void {
    const turbo = getCartTurboCombatState(this.runtimeV9.session);
    const hold = turbo.held ? turbo.charge : 0;
    const dash = snapshot.boostActive ? 1 : 0;
    const intensity = THREE.MathUtils.clamp(Math.max(dash, hold * 0.82), 0, 1);
    this.turboRoot.visible = intensity > 0.04;

    // The older simple cone flames remain as normal engine exhaust, but disappear
    // while the Q9 afterburner system is active so there is no double-cone look.
    this.runtimeV9.playerVisual.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object.name === "sky-dancer-jet-flame-v2" || object.name === "sky-dancer-jet-core-v2") {
        object.visible = intensity <= 0.04;
      }
    });

    if (!this.turboRoot.visible) return;
    const pulse = 0.92 + Math.sin(this.elapsedV9 * 31) * 0.08;
    for (const piece of this.turboPieces) {
      const material = piece.mesh.material;
      if (!(material instanceof THREE.MeshBasicMaterial)) continue;
      if (piece.kind === "plume") {
        material.opacity = (0.38 + intensity * 0.38) * pulse;
        piece.mesh.scale.set(0.82 + intensity * 0.24, 0.82 + intensity * 0.24, 0.72 + intensity * 0.62);
      } else if (piece.kind === "diamond") {
        const flicker = 0.58 + Math.sin(this.elapsedV9 * 23 + piece.phase) * 0.28;
        material.opacity = intensity * flicker;
        piece.mesh.scale.setScalar(0.7 + intensity * 0.55 + flicker * 0.15);
        piece.mesh.scale.z *= 1.65;
      } else if (piece.kind === "ring") {
        const wave = (this.elapsedV9 * 1.8 + piece.phase) % 1;
        material.opacity = intensity * (1 - wave) * 0.38;
        piece.mesh.scale.setScalar(0.78 + wave * 1.65);
        piece.mesh.position.z = piece.baseZ - wave * 1.15;
      } else {
        const travel = (this.elapsedV9 * (2.2 + intensity * 3.1) + piece.phase) % 1;
        material.opacity = intensity * (0.12 + (1 - travel) * 0.42);
        piece.mesh.position.z = piece.baseZ - travel * (2.2 + intensity * 2.4);
        piece.mesh.scale.z = 0.7 + intensity * 1.15;
      }
    }
  }

  private updateWorldMotion(snapshot: CartArenaSessionSnapshot): void {
    const shadows = this.runtimeV9.scene.getObjectByName("sky-dancer-q9-cloud-shadows");
    if (shadows) {
      shadows.position.x = Math.sin(this.elapsedV9 * 0.035) * 8;
      shadows.position.z = Math.cos(this.elapsedV9 * 0.028) * 5;
    }
    const roads = this.runtimeV9.scene.getObjectByName("sky-dancer-q9-primary-roads");
    if (roads) roads.visible = snapshot.speed > -1000;
  }
}

export { SkyDancerAirCombatFxV9 as SkyDancerAirCombatFx };
