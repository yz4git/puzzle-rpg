import * as THREE from "three";
import type { CartArenaSession, CartArenaSessionSnapshot, CartEnemySnapshot } from "../cart/CartArenaSession";
import type { CartRogueSnapshotHandler } from "../cart/CartRogueDemo";
import { CartRogueWebGLDemo } from "../cart/CartRogueWebGLDemo";
import { CART_WORLD_GRAPH } from "../cart/CartWorldGraph";
import { SkyDancerAirCombatFx, type SkyDancerFxRuntime } from "./SkyDancerAirCombatFx";
import {
  SKY_DANCER_ALTITUDE_METERS,
  getSkyDancerMissileState,
  installSkyDancerFlightCombat,
  type SkyDancerMissileState,
} from "./SkyDancerFlightCombat";
import { installSkyDancerInfiniteWorld } from "./SkyDancerInfiniteWorld";
import { getSkyDancerTurboState } from "./SkyDancerTurboModel";

interface CartRuntimeView {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  session: CartArenaSession;
  enemyGroups: Map<string, THREE.Group>;
  resourceGroups: Map<string, THREE.Group>;
  obstacleGroups: Map<string, THREE.Group>;
  gateBars: Map<string, THREE.Mesh>;
  playerVisual: THREE.Group;
  playerWheels: THREE.Mesh[];
  boostLight: THREE.PointLight;
  sparkMesh: THREE.InstancedMesh;
  steer: number;
  cameraShake: number;
  cameraRoll: number;
  impactFlash: number;
  impactOverlayMaterial: THREE.MeshBasicMaterial;
  updateVisuals(delta: number): void;
  applyCameraPresentation(snapshot: CartArenaSessionSnapshot): void;
  emitImpactSparks(position: THREE.Vector3, count: number): void;
}

export class SkyDancerWebGLDemo extends CartRogueWebGLDemo {
  private readonly missileRoot = new THREE.Group();
  private readonly missileGroups = new Map<number, THREE.Group>();
  private readonly normalMissilePool: THREE.Group[] = [];
  private readonly bossMissilePool: THREE.Group[] = [];
  private readonly activeMissileIds = new Set<number>();
  private readonly cameraTarget = new THREE.Vector3();
  private readonly airFx: SkyDancerAirCombatFx;

  constructor(
    mount: HTMLElement,
    onSnapshot: CartRogueSnapshotHandler,
    onRuntimeFailure: (message: string, error: unknown) => void,
  ) {
    super(mount, onSnapshot, onRuntimeFailure);
    installSkyDancerFlightCombat();
    const runtime = this as unknown as CartRuntimeView;
    this.airFx = new SkyDancerAirCombatFx(runtime as unknown as SkyDancerFxRuntime);
    this.applySkyDancerTheme(runtime);
    this.prewarmVisualPipeline(runtime);
    this.installFlightPresentation(runtime);
    installSkyDancerInfiniteWorld();
  }

  private applySkyDancerTheme(runtime: CartRuntimeView): void {
    runtime.renderer.domElement.setAttribute("aria-label", "Sky Dancer WebGL game view");
    runtime.scene.background = new THREE.Color(0x68b9ec);
    runtime.scene.fog = new THREE.Fog(0xbadff1, 165, 540);
    runtime.camera.far = 680;
    runtime.camera.updateProjectionMatrix();
    runtime.scene.userData.skyDancerAltitudeMeters = SKY_DANCER_ALTITUDE_METERS;
    runtime.scene.userData.verticalRenderScaleMetersPerUnit = SKY_DANCER_ALTITUDE_METERS / 38;

    const keep = new Set<THREE.Object3D>([
      runtime.camera,
      runtime.session.car.group,
      runtime.sparkMesh,
      ...runtime.enemyGroups.values(),
      ...runtime.resourceGroups.values(),
      ...runtime.obstacleGroups.values(),
    ]);
    for (const object of runtime.scene.children) {
      if (keep.has(object) || object instanceof THREE.Light || object instanceof THREE.Camera) continue;
      object.visible = false;
    }

    this.buildTerrain150m(runtime.scene);
    this.buildCloudDeck(runtime.scene);
    this.buildAirspaceGuides(runtime.scene);
    this.replacePlayerWithFighter(runtime);
    this.replaceEnemiesWithFighters(runtime);
    this.missileRoot.name = "sky-dancer-missile-root";
    runtime.scene.add(this.missileRoot);
  }

  private installFlightPresentation(runtime: CartRuntimeView): void {
    const baseUpdateVisuals = runtime.updateVisuals.bind(this);
    runtime.updateVisuals = (delta: number) => {
      baseUpdateVisuals(delta);
      const snapshot = runtime.session.snapshot();
      this.updateAircraftBank(runtime, snapshot, delta);
      const missileState = this.updateMissileVisuals(runtime);
      this.airFx.update(snapshot, missileState, delta);
    };

    const baseCameraPresentation = runtime.applyCameraPresentation.bind(this);
    runtime.applyCameraPresentation = (snapshot: CartArenaSessionSnapshot) => {
      baseCameraPresentation(snapshot);
      const turbo = getSkyDancerTurboState(runtime.session);
      const release = turbo.releaseAgeSeconds < 0.95
        ? 1 - THREE.MathUtils.clamp(turbo.releaseAgeSeconds / 0.95, 0, 1)
        : 0;
      const releaseFov = release * (6.2 + turbo.releaseCharge * 4.8);
      const sustainedFov = snapshot.boostActive ? 1.8 : 0;
      runtime.camera.fov = Math.min(96, runtime.camera.fov + releaseFov + sustainedFov);
      runtime.camera.updateProjectionMatrix();
      const lookAhead = 30;
      this.cameraTarget.set(
        snapshot.x + Math.sin(snapshot.heading) * lookAhead,
        -9.5,
        snapshot.z + Math.cos(snapshot.heading) * lookAhead,
      );
      runtime.camera.lookAt(this.cameraTarget);
      runtime.camera.rotateZ(runtime.cameraRoll * 0.72 + this.airFx.getCameraRollImpulse());
    };
  }

  private updateAircraftBank(runtime: CartRuntimeView, snapshot: CartArenaSessionSnapshot, delta: number): void {
    const now = performance.now();
    runtime.playerVisual.rotation.z += ((-runtime.steer * 0.43) - runtime.playerVisual.rotation.z) * Math.min(1, delta * 5.8);
    runtime.playerVisual.position.y = 0.62 + Math.sin(now * 0.0024) * 0.04;

    for (const enemy of snapshot.enemies) {
      if (!enemy.alive) continue;
      const group = runtime.enemyGroups.get(enemy.id);
      if (!group) continue;
      const previousHeading = Number(group.userData.skyHeading ?? enemy.heading);
      let headingDelta = enemy.heading - previousHeading;
      while (headingDelta > Math.PI) headingDelta -= Math.PI * 2;
      while (headingDelta < -Math.PI) headingDelta += Math.PI * 2;
      const turnRate = headingDelta / Math.max(0.001, delta);
      const targetBank = THREE.MathUtils.clamp(-turnRate * 0.34, -0.58, 0.58);
      group.rotation.z += (targetBank - group.rotation.z) * Math.min(1, delta * 5.2);
      const baseY = enemy.kind === "boss" ? 1.7 : enemy.kind === "heavy" ? 1.3 : 1.08;
      group.position.y = baseY + Math.sin(now * 0.0018 + enemy.x * 0.11 + enemy.z * 0.05) * 0.18;
      group.userData.skyHeading = enemy.heading;
    }
  }

  private updateMissileVisuals(runtime: CartRuntimeView): SkyDancerMissileState {
    const state = getSkyDancerMissileState(runtime.session);
    this.activeMissileIds.clear();
    const activeIds = this.activeMissileIds;
    const now = performance.now();

    for (const missile of state.missiles) {
      activeIds.add(missile.id);
      let group = this.missileGroups.get(missile.id);
      if (!group) {
        const boss = missile.sourceKind === "boss";
        group = (boss ? this.bossMissilePool : this.normalMissilePool).pop() ?? this.buildMissile(boss);
        this.missileGroups.set(missile.id, group);
      }
      group.visible = true;
      group.position.set(missile.x, 1.18 + Math.sin(missile.id * 1.7 + now * 0.006) * 0.05, missile.z);
      group.rotation.y = missile.heading;
      const warning = Math.max(0, Math.min(1, (14 - missile.distanceToPlayer) / 12));
      group.scale.setScalar(1 + warning * 0.2);
      const glow = group.getObjectByName("missile-glow") as THREE.Mesh | undefined;
      if (glow) {
        const material = glow.material as THREE.MeshBasicMaterial;
        material.opacity = 0.55 + warning * 0.4;
      }
      const halo = group.getObjectByName("sky-dancer-missile-halo") as THREE.Mesh | undefined;
      if (halo) {
        const material = halo.material as THREE.MeshBasicMaterial;
        material.opacity = 0.34 + warning * 0.58;
        halo.scale.setScalar(0.9 + warning * 0.75 + Math.sin(now * 0.018 + missile.id) * 0.08);
      }
    }

    for (const [id, group] of this.missileGroups) {
      if (activeIds.has(id)) continue;
      this.missileGroups.delete(id);
      group.visible = false;
      const pool = group.userData.skyDancerBossMissile === true ? this.bossMissilePool : this.normalMissilePool;
      pool.push(group);
    }

    return state;
  }

  private buildMissile(boss: boolean): THREE.Group {
    const group = new THREE.Group();
    group.userData.skyDancerBossMissile = boss;
    const bodyMat = new THREE.MeshStandardMaterial({
      color: boss ? 0x7d2635 : 0xddd6c6,
      roughness: 0.42,
      metalness: 0.3,
      flatShading: true,
    });
    const noseMat = new THREE.MeshStandardMaterial({
      color: boss ? 0xff4055 : 0xf05b4e,
      roughness: 0.38,
      metalness: 0.18,
      flatShading: true,
      emissive: boss ? 0x5b0711 : 0x4a110a,
      emissiveIntensity: 0.36,
    });
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xffb642,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, boss ? 1.55 : 1.2, 7), bodyMat);
    body.rotation.x = Math.PI / 2;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.46, 7), noseMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = boss ? 0.98 : 0.8;
    const tail = new THREE.Mesh(new THREE.ConeGeometry(boss ? 0.28 : 0.22, boss ? 1.45 : 1.15, 8, 1, true), glowMat);
    tail.name = "missile-glow";
    tail.rotation.x = -Math.PI / 2;
    tail.position.z = boss ? -1.35 : -1.05;

    const finMat = new THREE.MeshStandardMaterial({ color: 0x4b5966, roughness: 0.62, flatShading: true });
    for (const rotation of [0, Math.PI / 2]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(boss ? 0.72 : 0.55, 0.04, 0.36), finMat);
      fin.position.z = boss ? -0.46 : -0.34;
      fin.rotation.z = rotation;
      group.add(fin);
    }
    group.add(body, nose, tail);
    this.airFx.decorateMissile(group, boss);
    this.missileRoot.add(group);
    return group;
  }

  private prewarmVisualPipeline(runtime: CartRuntimeView): void {
    while (this.normalMissilePool.length < 8) this.normalMissilePool.push(this.buildMissile(false));
    while (this.bossMissilePool.length < 3) this.bossMissilePool.push(this.buildMissile(true));
    const warmMissiles = [...this.normalMissilePool, ...this.bossMissilePool];
    for (const missile of warmMissiles) {
      missile.visible = true;
      missile.position.set(runtime.session.car.position.x, -80, runtime.session.car.position.z);
    }
    this.airFx.update(runtime.session.snapshot(), getSkyDancerMissileState(runtime.session), 1 / 60);
    runtime.renderer.compile(runtime.scene, runtime.camera);
    for (const missile of warmMissiles) missile.visible = false;
  }

  private replacePlayerWithFighter(runtime: CartRuntimeView): void {
    runtime.playerVisual.clear();
    runtime.playerWheels.length = 0;
    const fighter = this.buildFighter(0x3eb7d7, 0xe9f8ff, 0x175a82, 1, false);
    fighter.position.y = 0.58;
    this.airFx.decorateFighter(fighter, false, false);
    runtime.playerVisual.add(fighter);
    runtime.boostLight.color.setHex(0x53d8ff);
    runtime.boostLight.position.set(0, 0.62, -2.25);
    runtime.playerVisual.add(runtime.boostLight);
    this.airFx.attachPlayerEffects(runtime.playerVisual);
  }

  private replaceEnemiesWithFighters(runtime: CartRuntimeView): void {
    const enemies = this.getSnapshot().enemies;
    const byId = new Map(enemies.map((enemy) => [enemy.id, enemy]));
    for (const [id, group] of runtime.enemyGroups) {
      const enemy = byId.get(id);
      if (!enemy) continue;
      group.clear();
      group.userData.wheels = [];
      const boss = enemy.kind === "boss";
      const heavy = enemy.kind === "heavy";
      const chaser = enemy.kind === "chaser";
      const primary = boss ? 0x34384d : heavy ? 0xa45c86 : chaser ? 0x75b8d9 : 0xe5a957;
      const accent = boss ? 0xff5e6f : heavy ? 0xe3b4d2 : chaser ? 0xd9f6ff : 0xffefb2;
      const dark = boss ? 0x171b2b : heavy ? 0x50334f : chaser ? 0x2f6886 : 0x77522a;
      const scale = Math.max(0.74, enemy.radius / 1.48) * (boss ? 1.08 : 1);
      const fighter = this.buildFighter(primary, accent, dark, scale, boss);
      fighter.position.y = boss ? 0.72 : 0.5;
      this.airFx.decorateFighter(fighter, true, boss);
      group.add(fighter);
      this.addEnemyHp(group, enemy);
    }
  }

  private addEnemyHp(group: THREE.Group, enemy: CartEnemySnapshot): void {
    const boss = enemy.kind === "boss";
    const heavy = enemy.kind === "heavy";
    const y = boss ? 4.25 : heavy ? 3.15 : 2.7;
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(enemy.radius * 1.9, 0.2, 0.14),
      new THREE.MeshBasicMaterial({ color: 0x223247, transparent: true, opacity: 0.86 }),
    );
    back.position.y = y;
    const fill = new THREE.Mesh(
      new THREE.BoxGeometry(enemy.radius * 1.76, 0.13, 0.16),
      new THREE.MeshBasicMaterial({ color: boss ? 0xff6576 : 0x8be6ff }),
    );
    fill.name = "hp-fill";
    fill.position.set(0, y, -0.02);
    group.add(back, fill);
  }

  private buildFighter(primary: number, accent: number, dark: number, scale: number, boss: boolean): THREE.Group {
    const group = new THREE.Group();
    const primaryMat = this.fighterMaterial(primary, 0.2);
    const accentMat = this.fighterMaterial(accent, 0.08);
    const darkMat = this.fighterMaterial(dark, 0.38);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x173d5b,
      roughness: 0.22,
      metalness: 0.18,
      flatShading: true,
      emissive: 0x0d2942,
      emissiveIntensity: 0.26,
    });

    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.66, 3.15, 8), primaryMat);
    fuselage.rotation.x = Math.PI / 2;
    fuselage.position.set(0, 0.42, -0.05);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.49, 1.55, 8), accentMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.4, 2.25);
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.3, 2.15), darkMat);
    spine.position.set(0, 0.7, -0.22);
    group.add(fuselage, nose, spine);

    const wingGeometry = new THREE.BufferGeometry();
    wingGeometry.setAttribute("position", new THREE.Float32BufferAttribute([
      0, 0.35, 0.72, -2.65, 0.24, -0.62, 0, 0.25, -0.95,
      0, 0.35, 0.72, 0, 0.25, -0.95, 2.65, 0.24, -0.62,
    ], 3));
    wingGeometry.computeVertexNormals();
    group.add(new THREE.Mesh(wingGeometry, primaryMat));

    const wingStripe = new THREE.Mesh(new THREE.BoxGeometry(4.25, 0.08, 0.24), accentMat);
    wingStripe.position.set(0, 0.36, -0.48);
    group.add(wingStripe);
    const tailWing = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.11, 0.78), darkMat);
    tailWing.position.set(0, 0.5, -1.55);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.88, 0.78), accentMat);
    fin.position.set(0, 0.9, -1.48);
    fin.rotation.x = -0.16;
    group.add(tailWing, fin);

    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.53, 8, 5), glassMat);
    canopy.scale.set(0.72, 0.58, 1.12);
    canopy.position.set(0, 0.83, 0.62);
    group.add(canopy);

    const exhaustMat = new THREE.MeshStandardMaterial({ color: 0x29455a, roughness: 0.34, metalness: 0.54, flatShading: true });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x65ddff, transparent: true, opacity: 0.8 });
    for (const x of [-0.34, 0.34]) {
      const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.27, 0.72, 8), exhaustMat);
      engine.rotation.x = Math.PI / 2;
      engine.position.set(x, 0.35, -1.72);
      const glow = new THREE.Mesh(new THREE.CircleGeometry(0.18, 10), glowMat);
      glow.position.set(x, 0.35, -2.09);
      glow.rotation.x = -Math.PI / 2;
      group.add(engine, glow);
    }

    if (boss) {
      for (const side of [-1, 1]) {
        const pod = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.42, 2.05), darkMat);
        pod.position.set(side * 1.55, 0.38, -0.45);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.78, 6), accentMat);
        tip.rotation.x = Math.PI / 2;
        tip.position.set(side * 1.55, 0.38, 0.94);
        group.add(pod, tip);
      }
    }

    group.scale.setScalar(scale);
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = false;
        object.receiveShadow = false;
      }
    });
    return group;
  }

  private fighterMaterial(color: number, metalness: number): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness, flatShading: true });
  }

  private buildTerrain150m(scene: THREE.Scene): void {
    const nodes = CART_WORLD_GRAPH.nodes;
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    for (const node of nodes) {
      minX = Math.min(minX, node.rect.centerX - node.rect.halfWidth);
      maxX = Math.max(maxX, node.rect.centerX + node.rect.halfWidth);
      minZ = Math.min(minZ, node.rect.centerZ - node.rect.halfDepth);
      maxZ = Math.max(maxZ, node.rect.centerZ + node.rect.halfDepth);
    }
    const margin = 150;
    const width = maxX - minX + margin * 2;
    const depth = maxZ - minZ + margin * 2;
    const centerX = (minX + maxX) * 0.5;
    const centerZ = (minZ + maxZ) * 0.5;
    const groundY = -38;

    const geometry = new THREE.PlaneGeometry(width, depth, 40, 62);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.getAttribute("position") as THREE.BufferAttribute;
    const colors = new Float32Array(position.count * 3);
    const low = new THREE.Color(0x648456);
    const mid = new THREE.Color(0x8f9c5d);
    const high = new THREE.Color(0x9a8062);
    const color = new THREE.Color();
    for (let index = 0; index < position.count; index += 1) {
      const worldX = position.getX(index) + centerX;
      const worldZ = position.getZ(index) + centerZ;
      const ridge = Math.sin(worldX * 0.027) * 2.6 + Math.cos(worldZ * 0.021) * 2.1;
      const hills = Math.sin((worldX + worldZ) * 0.013) * 2.2 + Math.cos((worldX - worldZ) * 0.009) * 1.7;
      const elevation = ridge + hills;
      position.setY(index, elevation);
      const t = THREE.MathUtils.clamp((elevation + 6) / 12, 0, 1);
      color.lerpColors(low, t > 0.58 ? high : mid, t > 0.58 ? (t - 0.58) / 0.42 : t / 0.58);
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    }
    position.needsUpdate = true;
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const terrain = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0, flatShading: true }),
    );
    terrain.name = "sky-dancer-terrain-150m-below";
    terrain.position.set(centerX, groundY, centerZ);
    terrain.receiveShadow = false;
    scene.add(terrain);

    const fieldMaterials = [0x6f8f4e, 0xa9995d, 0x7ea45b, 0xb08f62].map((value) => new THREE.MeshLambertMaterial({ color: value }));
    for (let index = 0; index < 44; index += 1) {
      const x = centerX + Math.sin(index * 12.41) * width * 0.38;
      const z = centerZ + Math.sin(index * 7.93 + 1.7) * depth * 0.39;
      const tile = new THREE.Mesh(new THREE.BoxGeometry(10 + index % 5 * 4, 0.12, 8 + index % 4 * 5), fieldMaterials[index % fieldMaterials.length]);
      tile.position.set(x, groundY + 3.2 + Math.sin(x * 0.027) * 1.4, z);
      tile.rotation.y = (index % 7) * 0.19;
      scene.add(tile);
    }

    const riverMat = new THREE.MeshBasicMaterial({ color: 0x4c8fab, transparent: true, opacity: 0.8, depthWrite: false });
    for (let index = 0; index < 30; index += 1) {
      const t = index / 29;
      const z = minZ - margin * 0.7 + t * (depth * 0.92);
      const x = centerX + Math.sin(t * Math.PI * 4.2) * 34 - 46;
      const segment = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.08, depth / 29 + 2), riverMat);
      segment.position.set(x, groundY + 4.2, z);
      segment.rotation.y = Math.sin(t * Math.PI * 4.2) * 0.38;
      scene.add(segment);
    }

    const cityMat = new THREE.MeshLambertMaterial({ color: 0xa7a59b });
    for (let index = 0; index < 36; index += 1) {
      const cluster = index % 3;
      const x = centerX + (cluster - 1) * 72 + ((index * 17) % 9 - 4) * 4.5;
      const z = centerZ + 48 + ((index * 29) % 11 - 5) * 5.2;
      const height = 1.8 + (index % 6) * 0.8;
      const building = new THREE.Mesh(new THREE.BoxGeometry(2.6 + index % 3, height, 2.8 + (index + 1) % 3), cityMat);
      building.position.set(x, groundY + 4.1 + height * 0.5, z);
      scene.add(building);
    }
  }

  private buildCloudDeck(scene: THREE.Scene): void {
    const nodes = CART_WORLD_GRAPH.nodes;
    const count = Math.max(54, nodes.length * 14);
    const geometry = new THREE.DodecahedronGeometry(1, 0);
    const material = new THREE.MeshLambertMaterial({ color: 0xf7fcff, transparent: true, opacity: 0.42, depthWrite: false });
    const clouds = new THREE.InstancedMesh(geometry, material, count);
    const dummy = new THREE.Object3D();
    for (let index = 0; index < count; index += 1) {
      const node = nodes[index % nodes.length];
      const seed = index * 12.9898 + (index % 7) * 3.17;
      const rx = Math.sin(seed) * 0.5 + 0.5;
      const rz = Math.sin(seed * 1.91 + 2.4) * 0.5 + 0.5;
      const x = node.rect.centerX + (rx * 2 - 1) * (node.rect.halfWidth + 28);
      const z = node.rect.centerZ + (rz * 2 - 1) * (node.rect.halfDepth + 24);
      const y = -14 - (index % 6) * 1.15;
      const s = 4.2 + (index % 5) * 1.3;
      dummy.position.set(x, y, z);
      dummy.rotation.set(index * 0.17, index * 0.31, index * 0.09);
      dummy.scale.set(s * (1.4 + (index % 3) * 0.22), s * 0.38, s);
      dummy.updateMatrix();
      clouds.setMatrixAt(index, dummy.matrix);
    }
    clouds.instanceMatrix.needsUpdate = true;
    clouds.frustumCulled = false;
    scene.add(clouds);
  }

  private buildAirspaceGuides(scene: THREE.Scene): void {
    const positions: number[] = [];
    const y = -0.7;
    for (const node of CART_WORLD_GRAPH.nodes) {
      if (node.id === "hunt-field") continue;
      const minX = node.rect.centerX - node.rect.halfWidth;
      const maxX = node.rect.centerX + node.rect.halfWidth;
      const minZ = node.rect.centerZ - node.rect.halfDepth;
      const maxZ = node.rect.centerZ + node.rect.halfDepth;
      positions.push(
        minX, y, minZ, maxX, y, minZ,
        maxX, y, minZ, maxX, y, maxZ,
        maxX, y, maxZ, minX, y, maxZ,
        minX, y, maxZ, minX, y, minZ,
      );
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({ color: 0xbcecff, transparent: true, opacity: 0.13, depthWrite: false });
    const guides = new THREE.LineSegments(geometry, material);
    guides.renderOrder = 2;
    scene.add(guides);
  }
}
