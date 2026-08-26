import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../cart/CartArenaSession";
import type { SkyDancerMissileState } from "./SkyDancerFlightCombat";
import { SkyDancerAirCombatFxV2, type SkyDancerFxRuntime } from "./SkyDancerAirCombatFxV2";

interface AnimatedMarker {
  mesh: THREE.Mesh;
  baseScale: number;
  phase: number;
}

/**
 * Presentation-only polish layered over V2. V2 owns the world-space trails and
 * combat feedback; V3 concentrates on aircraft silhouette, nozzle orientation,
 * missile readability and the 150m-altitude ground picture.
 */
export class SkyDancerAirCombatFxV3 extends SkyDancerAirCombatFxV2 {
  private readonly runtimeV3: SkyDancerFxRuntime;
  private readonly markers: AnimatedMarker[] = [];
  private elapsedV3 = 0;
  private worldBuilt = false;

  constructor(runtime: SkyDancerFxRuntime) {
    super(runtime);
    this.runtimeV3 = runtime;
  }

  override decorateFighter(fighter: THREE.Group, enemy: boolean, boss: boolean): void {
    super.decorateFighter(fighter, enemy, boss);
    this.fixNozzleDiscAxes(fighter);
    this.addAircraftDetailPass(fighter, enemy, boss);
  }

  override decorateMissile(group: THREE.Group, boss: boolean): void {
    const inheritedGlow = group.getObjectByName("missile-glow");
    if (inheritedGlow) inheritedGlow.visible = false;
    super.decorateMissile(group, boss);

    const hot = new THREE.MeshBasicMaterial({
      color: boss ? 0xff3c56 : 0xffd36a,
      transparent: true,
      opacity: boss ? 0.9 : 0.76,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const seeker = new THREE.Mesh(new THREE.SphereGeometry(boss ? 0.12 : 0.085, 8, 6), hot);
    seeker.name = "sky-dancer-missile-seeker-v3";
    seeker.position.z = boss ? 1.16 : 0.96;
    group.add(seeker);
    this.markers.push({ mesh: seeker, baseScale: 1, phase: this.markers.length * 0.73 });

    const finMaterial = new THREE.MeshBasicMaterial({
      color: boss ? 0xff6b78 : 0xeef6f8,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
      toneMapped: false,
    });
    for (const side of [-1, 1]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(boss ? 0.045 : 0.035, boss ? 0.42 : 0.31, boss ? 0.52 : 0.40), finMaterial.clone());
      fin.position.set(side * (boss ? 0.20 : 0.15), 0, boss ? -0.48 : -0.34);
      fin.rotation.z = side * 0.34;
      group.add(fin);
    }
  }

  override update(snapshot: CartArenaSessionSnapshot, missiles: SkyDancerMissileState, delta: number): void {
    super.update(snapshot, missiles, delta);
    this.elapsedV3 += delta;
    if (!this.worldBuilt) {
      this.worldBuilt = true;
      this.addGroundScaleCues();
      this.addAtmosphericDepth();
    }
    for (const marker of this.markers) {
      const pulse = 0.88 + (Math.sin(this.elapsedV3 * 10 + marker.phase) * 0.5 + 0.5) * 0.34;
      marker.mesh.scale.setScalar(marker.baseScale * pulse);
    }
  }

  private fixNozzleDiscAxes(fighter: THREE.Group): void {
    fighter.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object.geometry.type !== "CircleGeometry") return;
      if (object.position.z > -1.7) return;
      // The original Sky fighter already had rotated CircleGeometry engine glows.
      // V2 nozzle discs have no object-space X rotation because their geometry was
      // baked. Only correct those baked discs; hide the older primitive discs.
      if (Math.abs(object.rotation.x) > 0.01) {
        object.visible = false;
        return;
      }
      // CircleGeometry starts in the XY plane, perpendicular to Z. Undo V2's
      // unnecessary +90° geometry rotation so the nozzle faces the flight axis.
      object.geometry.rotateX(-Math.PI / 2);
      object.geometry.computeBoundingSphere();
    });
  }

  private addAircraftDetailPass(fighter: THREE.Group, enemy: boolean, boss: boolean): void {
    const bodyColor = enemy ? (boss ? 0x252b36 : 0x334a5c) : 0x174f66;
    const accentColor = enemy ? (boss ? 0xff5368 : 0xffb454) : 0x9beeff;
    const body = new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.39,
      metalness: 0.32,
      flatShading: true,
    });
    const accent = new THREE.MeshBasicMaterial({
      color: accentColor,
      transparent: true,
      opacity: enemy ? 0.52 : 0.62,
      depthWrite: false,
      toneMapped: false,
    });

    for (const side of [-1, 1]) {
      const intake = new THREE.Mesh(new THREE.BoxGeometry(boss ? 0.68 : 0.54, 0.34, boss ? 1.72 : 1.42), body);
      intake.position.set(side * (boss ? 0.82 : 0.66), 0.35, -0.44);
      intake.rotation.z = side * 0.08;
      fighter.add(intake);

      const intakeLip = new THREE.Mesh(new THREE.BoxGeometry(boss ? 0.72 : 0.58, 0.12, 0.12), accent.clone());
      intakeLip.position.set(side * (boss ? 0.82 : 0.66), 0.35, 0.30);
      fighter.add(intakeLip);

      const stabilator = new THREE.Mesh(new THREE.BoxGeometry(boss ? 1.85 : 1.48, 0.055, boss ? 0.64 : 0.52), body);
      stabilator.position.set(side * (boss ? 1.26 : 1.02), 0.43, -1.55);
      stabilator.rotation.y = side * 0.10;
      fighter.add(stabilator);
    }

    for (const side of [-1, 1]) {
      const stripGeometry = new THREE.BufferGeometry();
      stripGeometry.setAttribute("position", new THREE.Float32BufferAttribute([
        side * 0.20, 0.37, 0.64,
        side * (boss ? 2.86 : 2.62), 0.28, -0.56,
        side * (boss ? 2.72 : 2.50), 0.30, -0.66,
      ], 3));
      stripGeometry.computeVertexNormals();
      const strip = new THREE.Mesh(stripGeometry, accent.clone());
      strip.renderOrder = 6;
      fighter.add(strip);
    }

    const canopyHighlight = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 8, 5),
      new THREE.MeshBasicMaterial({
        color: 0xb8edff,
        transparent: true,
        opacity: enemy ? 0.13 : 0.20,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    canopyHighlight.scale.set(0.68, 0.34, 1.12);
    canopyHighlight.position.set(-0.08, 0.94, 0.73);
    fighter.add(canopyHighlight);

    if (boss) {
      const spine = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.62, 2.0), body);
      spine.position.set(0, 0.86, -0.52);
      fighter.add(spine);
    }
  }

  private addGroundScaleCues(): void {
    const scene = this.runtimeV3.scene;
    const terrain = scene.getObjectByName("sky-dancer-terrain-150m-below");
    if (terrain instanceof THREE.Mesh && terrain.material instanceof THREE.MeshStandardMaterial) {
      terrain.material.roughness = 0.88;
      terrain.material.metalness = 0;
    }

    const roadMaterial = new THREE.LineBasicMaterial({
      color: 0xc9c5b2,
      transparent: true,
      opacity: 0.30,
      depthWrite: false,
    });
    const positions: number[] = [];
    for (let index = -7; index <= 7; index += 1) {
      const x = index * 22;
      positions.push(x, -33.55, -120, x + Math.sin(index * 1.7) * 12, -33.55, 410);
    }
    for (let index = -2; index <= 8; index += 1) {
      const z = index * 42;
      positions.push(-165, -33.52, z, 165, -33.52, z + Math.cos(index * 1.2) * 8);
    }
    const roadsGeometry = new THREE.BufferGeometry();
    roadsGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const roads = new THREE.LineSegments(roadsGeometry, roadMaterial);
    roads.name = "sky-dancer-ground-road-network-v3";
    scene.add(roads);

    const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
    const buildingMaterial = new THREE.MeshLambertMaterial({ color: 0x8f918c });
    const buildings = new THREE.InstancedMesh(buildingGeometry, buildingMaterial, 120);
    buildings.name = "sky-dancer-distant-city-v3";
    const dummy = new THREE.Object3D();
    for (let index = 0; index < 120; index += 1) {
      const cluster = index % 5;
      const x = (cluster - 2) * 56 + ((index * 37) % 17 - 8) * 2.4;
      const z = 36 + Math.floor(index / 5) * 12 + ((index * 19) % 7 - 3) * 2.1;
      const h = 1.2 + (index % 7) * 0.65;
      dummy.position.set(x, -33.6 + h * 0.5, z);
      dummy.rotation.set(0, (index % 6) * 0.11, 0);
      dummy.scale.set(1.3 + index % 3 * 0.55, h, 1.4 + (index + 1) % 3 * 0.45);
      dummy.updateMatrix();
      buildings.setMatrixAt(index, dummy.matrix);
    }
    buildings.instanceMatrix.needsUpdate = true;
    buildings.frustumCulled = false;
    scene.add(buildings);
  }

  private addAtmosphericDepth(): void {
    const scene = this.runtimeV3.scene;
    const hazeMaterial = new THREE.MeshBasicMaterial({
      color: 0xd8edf4,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    for (let index = 0; index < 7; index += 1) {
      const haze = new THREE.Mesh(new THREE.PlaneGeometry(110 + index * 18, 12 + index * 1.4), hazeMaterial.clone());
      haze.name = "sky-dancer-horizon-haze-v3";
      haze.position.set((index - 3) * 38, -21 + index * 0.8, 190 + index * 42);
      haze.rotation.x = -0.12;
      scene.add(haze);
    }
  }
}

export { SkyDancerAirCombatFxV3 as SkyDancerAirCombatFx };
