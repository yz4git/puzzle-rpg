import * as THREE from "three";
import type { CartArenaSessionSnapshot, CartEnemySnapshot } from "../cart/CartArenaSession";
import { CART_WORLD_GRAPH } from "../cart/CartWorldGraph";
import type { SkyDancerMissileState } from "./SkyDancerFlightCombat";
import { SkyDancerAirCombatFxV4 } from "./SkyDancerAirCombatFxV4";
import type { SkyDancerFxRuntime } from "./SkyDancerAirCombatFxV2";

interface EnemyHudMarker {
  root: THREE.Group;
  fill: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  back: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  boss: boolean;
}

interface WorldBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
}

const Q5_PREFIX = "sky-dancer-q5-";
const GROUND_Y = -46;
const CAMERA_ALTITUDE_METERS = 150;
const TMP_CAMERA_Q = new THREE.Quaternion();
const TMP_PARENT_Q = new THREE.Quaternion();

/**
 * Full visual quality pass for the aircraft conversion.
 *
 * V4 keeps the gameplay/visibility contract. V5 only changes presentation:
 * - replaces the oversized legacy ground picture with an aerial-scale landscape,
 * - turns glass-like cloud shards into low-contrast cloud banks,
 * - adds a denser aircraft silhouette/detail pass,
 * - replaces world-space HP sticks with compact camera-facing markers,
 * - suppresses inherited ground-car FX that can reappear after the base update,
 * - tones down vapor / missile / afterburner glare for combat readability.
 */
export class SkyDancerAirCombatFxV5 extends SkyDancerAirCombatFxV4 {
  private readonly runtimeV5: SkyDancerFxRuntime;
  private readonly enemyMarkers = new Map<string, EnemyHudMarker>();
  private worldBuiltV5 = false;
  private effectTuneClock = 0;
  private elapsedV5 = 0;

  constructor(runtime: SkyDancerFxRuntime) {
    super(runtime);
    this.runtimeV5 = runtime;
  }

  override decorateFighter(fighter: THREE.Group, enemy: boolean, boss: boolean): void {
    super.decorateFighter(fighter, enemy, boss);
    this.addAirframeQualityPass(fighter, enemy, boss);
  }

  override decorateMissile(group: THREE.Group, boss: boolean): void {
    super.decorateMissile(group, boss);
    const halo = group.getObjectByName("sky-dancer-missile-halo");
    if (halo instanceof THREE.Mesh && halo.material instanceof THREE.MeshBasicMaterial) {
      halo.material.opacity *= boss ? 0.70 : 0.58;
    }
  }

  override update(snapshot: CartArenaSessionSnapshot, missiles: SkyDancerMissileState, delta: number): void {
    super.update(snapshot, missiles, delta);
    this.elapsedV5 += delta;

    if (!this.worldBuiltV5) {
      this.worldBuiltV5 = true;
      this.replaceLegacyWorldPicture();
      this.installEnemyMarkers(snapshot);
      this.collectAndTunePersistentFx();
    }

    // Some inherited vehicle presentation toggles visibility every base frame.
    // Enforce the aircraft-only picture after the base renderer has updated.
    this.suppressInheritedVehicleFx();
    this.updateEnemyMarkers(snapshot);
    this.tunePlayerAfterburners(snapshot);

    this.effectTuneClock -= delta;
    if (this.effectTuneClock <= 0) {
      this.effectTuneClock = 0.45;
      this.collectAndTunePersistentFx();
    }
  }

  private replaceLegacyWorldPicture(): void {
    const scene = this.runtimeV5.scene;

    // Hide the first conversion's oversized ground pieces and V3 scale helpers.
    for (const object of scene.children) {
      if (object.name.startsWith(Q5_PREFIX)) continue;
      if (
        object.name === "sky-dancer-terrain-150m-below"
        || object.name === "sky-dancer-ground-road-network-v3"
        || object.name === "sky-dancer-distant-city-v3"
        || object.name === "sky-dancer-horizon-haze-v3"
      ) {
        object.visible = false;
        continue;
      }
      if (object instanceof THREE.InstancedMesh && object.geometry.type === "DodecahedronGeometry") {
        object.visible = false;
        continue;
      }
      if (object instanceof THREE.Mesh && object.position.y < -20) {
        object.visible = false;
      }
    }

    scene.background = new THREE.Color(0x8fc8e9);
    scene.fog = new THREE.Fog(0xd5e4e7, 118, 455);
    scene.userData.skyDancerAltitudeMeters = CAMERA_ALTITUDE_METERS;
    scene.userData.verticalRenderScaleMetersPerUnit = CAMERA_ALTITUDE_METERS / Math.abs(GROUND_Y);
    this.runtimeV5.camera.far = 760;
    this.runtimeV5.camera.updateProjectionMatrix();

    const bounds = this.getWorldBounds();
    this.buildTerrain(bounds);
    this.buildFields(bounds);
    this.buildRoads(bounds);
    this.buildRiver(bounds);
    this.buildCity(bounds);
    this.buildMountainRim(bounds);
    this.buildCloudBanks(bounds);
  }

  private getWorldBounds(): WorldBounds {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    for (const node of CART_WORLD_GRAPH.nodes) {
      minX = Math.min(minX, node.rect.centerX - node.rect.halfWidth);
      maxX = Math.max(maxX, node.rect.centerX + node.rect.halfWidth);
      minZ = Math.min(minZ, node.rect.centerZ - node.rect.halfDepth);
      maxZ = Math.max(maxZ, node.rect.centerZ + node.rect.halfDepth);
    }
    const margin = 190;
    minX -= margin;
    maxX += margin;
    minZ -= margin;
    maxZ += margin;
    return {
      minX,
      maxX,
      minZ,
      maxZ,
      centerX: (minX + maxX) * 0.5,
      centerZ: (minZ + maxZ) * 0.5,
      width: maxX - minX,
      depth: maxZ - minZ,
    };
  }

  private groundElevation(x: number, z: number): number {
    const broad = Math.sin(x * 0.011) * 0.72 + Math.cos(z * 0.0105) * 0.66;
    const cross = Math.sin((x + z) * 0.0062) * 0.48 + Math.cos((x - z) * 0.0051) * 0.36;
    return broad + cross;
  }

  private buildTerrain(bounds: WorldBounds): void {
    const geometry = new THREE.PlaneGeometry(bounds.width, bounds.depth, 52, 72);
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
    const colors = new Float32Array(positions.count * 3);
    const greenA = new THREE.Color(0x718360);
    const greenB = new THREE.Color(0x8d956c);
    const dry = new THREE.Color(0xa59675);
    const scratch = new THREE.Color();

    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index) + bounds.centerX;
      const z = positions.getZ(index) + bounds.centerZ;
      const elevation = this.groundElevation(x, z);
      positions.setY(index, elevation);
      const patch = Math.sin(x * 0.031 + Math.cos(z * 0.017)) * 0.5 + 0.5;
      const dryMix = THREE.MathUtils.clamp((Math.sin((x - z) * 0.008) + 1) * 0.20, 0, 0.42);
      scratch.lerpColors(greenA, greenB, patch * 0.72 + 0.12).lerp(dry, dryMix);
      colors[index * 3] = scratch.r;
      colors[index * 3 + 1] = scratch.g;
      colors[index * 3 + 2] = scratch.b;
    }
    positions.needsUpdate = true;
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const terrain = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 1,
        metalness: 0,
        flatShading: true,
      }),
    );
    terrain.name = `${Q5_PREFIX}terrain-150m`;
    terrain.position.set(bounds.centerX, GROUND_Y, bounds.centerZ);
    terrain.receiveShadow = false;
    this.runtimeV5.scene.add(terrain);
  }

  private buildFields(bounds: WorldBounds): void {
    const count = 96;
    const geometry = new THREE.BoxGeometry(1, 0.035, 1);
    const material = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const fields = new THREE.InstancedMesh(geometry, material, count);
    fields.name = `${Q5_PREFIX}field-mosaic`;
    const palette = [0x718b55, 0x87965d, 0xa59468, 0x7b8f61, 0x9d8a63].map((value) => new THREE.Color(value));
    const dummy = new THREE.Object3D();

    for (let index = 0; index < count; index += 1) {
      const x = bounds.centerX + Math.sin(index * 11.73 + 0.4) * bounds.width * 0.39;
      const z = bounds.centerZ + Math.sin(index * 7.19 + 1.6) * bounds.depth * 0.40;
      const sx = 5.2 + (index % 6) * 2.15;
      const sz = 6.0 + ((index * 3) % 7) * 2.1;
      dummy.position.set(x, GROUND_Y + this.groundElevation(x, z) + 0.12, z);
      dummy.rotation.set(0, (index % 9) * 0.12, 0);
      dummy.scale.set(sx, 1, sz);
      dummy.updateMatrix();
      fields.setMatrixAt(index, dummy.matrix);
      fields.setColorAt(index, palette[index % palette.length]);
    }
    fields.instanceMatrix.needsUpdate = true;
    if (fields.instanceColor) fields.instanceColor.needsUpdate = true;
    fields.frustumCulled = false;
    this.runtimeV5.scene.add(fields);
  }

  private buildRoads(bounds: WorldBounds): void {
    const vertices: number[] = [];
    const y = GROUND_Y + 0.42;
    for (let index = -10; index <= 10; index += 1) {
      const x = bounds.centerX + index * (bounds.width / 22);
      vertices.push(x, y, bounds.minZ, x + Math.sin(index * 1.9) * 18, y, bounds.maxZ);
    }
    for (let index = -7; index <= 8; index += 1) {
      const z = bounds.centerZ + index * (bounds.depth / 18);
      vertices.push(bounds.minX, y, z, bounds.maxX, y, z + Math.cos(index * 1.43) * 12);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    const roads = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({ color: 0xc8c5b5, transparent: true, opacity: 0.25, depthWrite: false }),
    );
    roads.name = `${Q5_PREFIX}road-network`;
    roads.renderOrder = 1;
    this.runtimeV5.scene.add(roads);
  }

  private buildRiver(bounds: WorldBounds): void {
    const count = 34;
    const river = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 0.025, 1),
      new THREE.MeshBasicMaterial({ color: 0x5f91a8, transparent: true, opacity: 0.64, depthWrite: false }),
      count,
    );
    river.name = `${Q5_PREFIX}river`;
    const dummy = new THREE.Object3D();
    for (let index = 0; index < count; index += 1) {
      const t = index / (count - 1);
      const z = bounds.minZ + t * bounds.depth;
      const x = bounds.centerX - bounds.width * 0.16 + Math.sin(t * Math.PI * 4.1) * 27;
      dummy.position.set(x, GROUND_Y + this.groundElevation(x, z) + 0.24, z);
      dummy.rotation.set(0, Math.sin(t * Math.PI * 4.1) * 0.28, 0);
      dummy.scale.set(3.6 + (index % 4) * 0.42, 1, bounds.depth / count + 2.2);
      dummy.updateMatrix();
      river.setMatrixAt(index, dummy.matrix);
    }
    river.instanceMatrix.needsUpdate = true;
    river.frustumCulled = false;
    this.runtimeV5.scene.add(river);
  }

  private buildCity(bounds: WorldBounds): void {
    const count = 168;
    const buildings = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color: 0x90938f }),
      count,
    );
    buildings.name = `${Q5_PREFIX}micro-city`;
    const dummy = new THREE.Object3D();
    for (let index = 0; index < count; index += 1) {
      const cluster = index % 6;
      const lane = Math.floor(index / 6);
      const x = bounds.centerX + (cluster - 2.5) * 34 + ((index * 17) % 7 - 3) * 2.7;
      const z = bounds.centerZ + 52 + lane * 5.8 + ((index * 13) % 5 - 2) * 2.2;
      const h = 0.75 + (index % 9) * 0.31;
      const sx = 0.7 + (index % 3) * 0.34;
      const sz = 0.8 + ((index + 1) % 4) * 0.29;
      dummy.position.set(x, GROUND_Y + this.groundElevation(x, z) + h * 0.5 + 0.14, z);
      dummy.rotation.set(0, (index % 4) * 0.08, 0);
      dummy.scale.set(sx, h, sz);
      dummy.updateMatrix();
      buildings.setMatrixAt(index, dummy.matrix);
    }
    buildings.instanceMatrix.needsUpdate = true;
    buildings.frustumCulled = false;
    this.runtimeV5.scene.add(buildings);
  }

  private buildMountainRim(bounds: WorldBounds): void {
    const material = new THREE.MeshLambertMaterial({ color: 0x7e8276, flatShading: true });
    const root = new THREE.Group();
    root.name = `${Q5_PREFIX}mountain-rim`;
    for (let index = 0; index < 18; index += 1) {
      const mountain = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 5), material.clone());
      const side = index % 2 === 0 ? -1 : 1;
      const x = bounds.centerX + side * (bounds.width * 0.39 + (index % 4) * 18);
      const z = bounds.centerZ + 72 + Math.floor(index / 2) * 34;
      const h = 7 + (index % 6) * 2.1;
      mountain.position.set(x, GROUND_Y + h * 0.5 - 0.2, z);
      mountain.scale.set(9 + (index % 4) * 2.8, h, 8 + ((index + 2) % 5) * 2.4);
      mountain.rotation.y = index * 0.37;
      root.add(mountain);
    }
    this.runtimeV5.scene.add(root);
  }

  private buildCloudBanks(bounds: WorldBounds): void {
    const puffCount = 120;
    const clouds = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshLambertMaterial({
        color: 0xf7fbfc,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
      }),
      puffCount,
    );
    clouds.name = `${Q5_PREFIX}cloud-banks`;
    const dummy = new THREE.Object3D();
    for (let index = 0; index < puffCount; index += 1) {
      const cluster = Math.floor(index / 5);
      const puff = index % 5;
      const cx = bounds.centerX + Math.sin(cluster * 5.41 + 0.8) * bounds.width * 0.42;
      const cz = bounds.centerZ + Math.sin(cluster * 3.17 + 2.1) * bounds.depth * 0.43;
      const angle = puff / 5 * Math.PI * 2 + cluster * 0.23;
      const radius = puff === 0 ? 0 : 3.1 + puff * 1.25;
      const x = cx + Math.sin(angle) * radius;
      const z = cz + Math.cos(angle) * radius;
      const y = -24 - (cluster % 4) * 2.3 + Math.sin(index * 1.71) * 0.8;
      const s = 2.7 + (index % 4) * 0.74;
      dummy.position.set(x, y, z);
      dummy.rotation.set(index * 0.07, index * 0.19, index * 0.05);
      dummy.scale.set(s * (1.28 + (puff % 2) * 0.18), s * 0.36, s * (0.92 + (cluster % 3) * 0.08));
      dummy.updateMatrix();
      clouds.setMatrixAt(index, dummy.matrix);
    }
    clouds.instanceMatrix.needsUpdate = true;
    clouds.frustumCulled = false;
    clouds.renderOrder = 0;
    this.runtimeV5.scene.add(clouds);
  }

  private addAirframeQualityPass(fighter: THREE.Group, enemy: boolean, boss: boolean): void {
    const darkColor = enemy ? (boss ? 0x171b24 : 0x293845) : 0x123747;
    const panelColor = enemy ? (boss ? 0x6b2834 : 0x8a5d35) : 0x55c7df;
    const dark = new THREE.MeshStandardMaterial({
      color: darkColor,
      roughness: 0.42,
      metalness: 0.38,
      flatShading: true,
    });
    const panel = new THREE.MeshStandardMaterial({
      color: panelColor,
      roughness: 0.36,
      metalness: 0.24,
      flatShading: true,
    });

    // Angular belly/chine breaks up the toy-like cylinder silhouette from rear 3/4 views.
    const belly = new THREE.Mesh(new THREE.BoxGeometry(boss ? 0.88 : 0.72, 0.18, boss ? 2.55 : 2.15), dark);
    belly.position.set(0, 0.18, -0.18);
    belly.rotation.x = 0.025;
    fighter.add(belly);

    for (const side of [-1, 1]) {
      const tailFin = new THREE.Mesh(new THREE.BoxGeometry(boss ? 0.13 : 0.10, boss ? 1.05 : 0.86, boss ? 0.78 : 0.66), dark.clone());
      tailFin.position.set(side * (boss ? 0.72 : 0.58), boss ? 0.93 : 0.82, boss ? -1.48 : -1.38);
      tailFin.rotation.set(-0.10, 0, side * -0.18);
      fighter.add(tailFin);

      const tipPod = new THREE.Mesh(new THREE.CylinderGeometry(boss ? 0.12 : 0.09, boss ? 0.15 : 0.11, boss ? 0.72 : 0.56, 6), dark.clone());
      tipPod.rotation.x = Math.PI / 2;
      tipPod.position.set(side * (boss ? 2.86 : 2.60), 0.28, -0.62);
      fighter.add(tipPod);

      const leading = new THREE.Mesh(new THREE.BoxGeometry(boss ? 2.18 : 1.92, 0.045, 0.12), panel.clone());
      leading.position.set(side * (boss ? 1.36 : 1.20), 0.37, -0.12);
      leading.rotation.y = side * 0.27;
      fighter.add(leading);
    }

    const canopyFrame = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, boss ? 1.08 : 0.90), dark.clone());
    canopyFrame.position.set(0, 1.00, 0.58);
    fighter.add(canopyFrame);

    const dorsalPanel = new THREE.Mesh(new THREE.BoxGeometry(boss ? 0.56 : 0.44, 0.075, boss ? 1.18 : 0.96), panel.clone());
    dorsalPanel.position.set(0, 0.77, -0.36);
    fighter.add(dorsalPanel);
  }

  private suppressInheritedVehicleFx(): void {
    const carGroup = this.runtimeV5.session.car.group;
    for (const child of carGroup.children) {
      if (child !== this.runtimeV5.playerVisual) child.visible = false;
    }
  }

  private installEnemyMarkers(snapshot: CartArenaSessionSnapshot): void {
    const enemies = new Map(snapshot.enemies.map((enemy) => [enemy.id, enemy]));
    for (const [id, group] of this.runtimeV5.enemyGroups) {
      const enemy = enemies.get(id);
      if (!enemy) continue;

      // The inherited HP boxes rotate with the plane and read as giant rotor bars.
      for (const child of group.children) {
        if (child instanceof THREE.Mesh && (child.name === "hp-fill" || child.position.y > 2.1)) {
          child.visible = false;
        }
      }

      const boss = enemy.kind === "boss";
      const root = new THREE.Group();
      root.name = `${Q5_PREFIX}enemy-hp-${id}`;
      root.position.y = boss ? 3.0 : enemy.kind === "heavy" ? 2.45 : 2.18;
      root.scale.setScalar(boss ? 1.24 : 1);

      const backMaterial = new THREE.MeshBasicMaterial({
        color: 0x172531,
        transparent: true,
        opacity: 0.58,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      const fillMaterial = new THREE.MeshBasicMaterial({
        color: boss ? 0xff6677 : 0x8fe8ff,
        transparent: true,
        opacity: 0.78,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      const back = new THREE.Mesh(new THREE.PlaneGeometry(1.28, 0.105), backMaterial);
      const fill = new THREE.Mesh(new THREE.PlaneGeometry(1.10, 0.047), fillMaterial);
      back.renderOrder = 100;
      fill.renderOrder = 101;
      fill.position.z = 0.002;
      root.add(back, fill);
      group.add(root);
      this.enemyMarkers.set(id, { root, fill, back, boss });
    }
  }

  private updateEnemyMarkers(snapshot: CartArenaSessionSnapshot): void {
    const byId = new Map(snapshot.enemies.map((enemy) => [enemy.id, enemy]));
    this.runtimeV5.camera.getWorldQuaternion(TMP_CAMERA_Q);

    for (const [id, marker] of this.enemyMarkers) {
      const enemy = byId.get(id);
      const group = this.runtimeV5.enemyGroups.get(id);
      if (!enemy || !group) {
        marker.root.visible = false;
        continue;
      }
      const distance = Math.hypot(enemy.x - snapshot.x, enemy.z - snapshot.z);
      marker.root.visible = enemy.alive && enemy.nodeId === snapshot.nodeId && distance < (marker.boss ? 92 : 68);
      if (!marker.root.visible) continue;

      group.getWorldQuaternion(TMP_PARENT_Q);
      marker.root.quaternion.copy(TMP_PARENT_Q.invert().multiply(TMP_CAMERA_Q));

      const ratio = THREE.MathUtils.clamp(enemy.hp / Math.max(0.001, enemy.maxHp), 0, 1);
      marker.fill.scale.x = Math.max(0.02, ratio);
      marker.fill.position.x = -0.55 * (1 - ratio);
      const fade = THREE.MathUtils.clamp((marker.boss ? 96 : 72) - distance, 0, 22) / 22;
      marker.back.material.opacity = 0.18 + fade * 0.40;
      marker.fill.material.opacity = 0.30 + fade * 0.50;
    }
  }

  private tunePlayerAfterburners(snapshot: CartArenaSessionSnapshot): void {
    this.runtimeV5.playerVisual.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshBasicMaterial)) return;
      if (object.name === "sky-dancer-jet-flame-v2") {
        object.scale.z *= snapshot.boostActive ? 0.86 : 0.72;
        object.material.opacity *= snapshot.boostActive ? 0.78 : 0.64;
      } else if (object.name === "sky-dancer-jet-core-v2") {
        object.scale.z *= snapshot.boostActive ? 0.82 : 0.68;
        object.material.opacity *= snapshot.boostActive ? 0.82 : 0.70;
      }
    });
  }

  private collectAndTunePersistentFx(): void {
    this.runtimeV5.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object.name.startsWith("sky-dancer-wing-vapor-")) {
        const material = object.material;
        if (material instanceof THREE.MeshBasicMaterial) material.opacity = object.name.includes("left") || object.name.includes("right") ? 0.15 : 0.16;
      } else if (object.name === "sky-dancer-missile-halo") {
        const material = object.material;
        if (material instanceof THREE.MeshBasicMaterial) material.opacity = Math.min(material.opacity, 0.34);
      } else if (object.name.startsWith("burst-ring-")) {
        const material = object.material;
        if (material instanceof THREE.MeshBasicMaterial) material.opacity *= 0.72;
      }
    });
  }
}

export { SkyDancerAirCombatFxV5 as SkyDancerAirCombatFx };
