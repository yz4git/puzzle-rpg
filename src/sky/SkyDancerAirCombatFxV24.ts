import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../cart/CartArenaSession";
import type { SkyDancerMissileState } from "./SkyDancerFlightCombat";
import { SkyDancerAirCombatFxV23 } from "./SkyDancerAirCombatFxV23";
import type { SkyDancerFxRuntime } from "./SkyDancerAirCombatFxV2";
import { getSkyDancerPlayerWeaponState, type SkyDancerPlayerWeaponState } from "./SkyDancerPlayerWeapons";
import { getSkyDancerTurboState, type SkyDancerTurboState } from "./SkyDancerTurboModel";

interface V24Runtime extends SkyDancerFxRuntime {
  renderer?: THREE.WebGLRenderer;
}

interface MuzzleSocket {
  root: THREE.Group;
  core: THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshBasicMaterial>;
  plume: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>;
  light: THREE.PointLight;
  life: number;
}

interface ImpactResidue {
  root: THREE.Group;
  life: number;
  maxLife: number;
  flash: THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshBasicMaterial>;
  rings: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>[];
  light: THREE.PointLight;
  sparks: THREE.InstancedMesh<THREE.TetrahedronGeometry, THREE.MeshBasicMaterial>;
  sparkPositions: THREE.Vector3[];
  sparkVelocities: THREE.Vector3[];
  smoke: THREE.InstancedMesh<THREE.DodecahedronGeometry, THREE.MeshLambertMaterial>;
  smokePositions: THREE.Vector3[];
  smokeVelocities: THREE.Vector3[];
}

const SKY_RADIUS = 650;
const MAX_IMPACT_RESIDUES = 4;

/**
 * V24 is the first integrated product-quality presentation pass.
 *
 * It spends the mobile GPU budget on a small number of high-value layers:
 * a shader sky, distant atmospheric silhouettes, a readable hero-aircraft
 * silhouette, launch/impact staging, and a single-pass cinematic edge grade.
 * Chase-camera position and all simulation rules remain untouched.
 */
export class SkyDancerAirCombatFxV24 extends SkyDancerAirCombatFxV23 {
  private readonly runtimeV24: V24Runtime;
  private readonly atmosphereRoot = new THREE.Group();
  private readonly muzzleSockets: MuzzleSocket[] = [];
  private readonly impactResidues: ImpactResidue[] = [];
  private readonly impactResiduePool: ImpactResidue[] = [];
  private readonly impactDummy = new THREE.Object3D();
  private readonly cameraWorldPosition = new THREE.Vector3();
  private readonly screenGrade: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private skyDome: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> | null = null;
  private farClouds: THREE.InstancedMesh | null = null;
  private builtV24 = false;
  private elapsedV24 = 0;
  private baseFov: number;
  private lastShotSerial = 0;
  private lastPlayerHitSerial = 0;
  private lastEnemyHitSerial = 0;
  private enemyHitPulse = 0;
  private launchPulse = 0;

  constructor(runtime: SkyDancerFxRuntime) {
    super(runtime);
    this.runtimeV24 = runtime as V24Runtime;
    this.baseFov = runtime.camera.fov;
    this.atmosphereRoot.name = "sky-dancer-v24-atmosphere";
    this.screenGrade = this.createScreenGrade();
  }

  override update(snapshot: CartArenaSessionSnapshot, missiles: SkyDancerMissileState, delta: number): void {
    super.update(snapshot, missiles, delta);
    const frameDelta = THREE.MathUtils.clamp(delta, 0.001, 0.05);
    this.elapsedV24 += frameDelta;

    if (!this.builtV24) {
      this.builtV24 = true;
      this.configureProductRenderer();
      this.buildSkyDome();
      this.buildAtmosphericSilhouettes();
      this.buildHeroAircraftDetail();
      this.buildMuzzleSystem();
      this.prewarmImpactResidues();
      this.tuneAircraftMaterialsV24(this.runtimeV24.playerVisual, false);
      this.runtimeV24.scene.add(this.atmosphereRoot);
      this.runtimeV24.camera.add(this.screenGrade);
      this.runtimeV24.camera.getWorldPosition(this.cameraWorldPosition);
      this.atmosphereRoot.position.set(this.cameraWorldPosition.x, 0, this.cameraWorldPosition.z);
    }

    const weapon = getSkyDancerPlayerWeaponState(this.runtimeV24.session);
    const turbo = getSkyDancerTurboState(this.runtimeV24.session);

    this.ensureEnemySilhouettes(snapshot);
    this.updateAtmosphere(frameDelta);
    this.updateMuzzleSystem(weapon, frameDelta);
    this.updateImpactResidues(weapon, frameDelta);
    this.updateCameraLens(turbo, frameDelta);
    this.updateScreenGrade(turbo, missiles, frameDelta);
  }

  private configureProductRenderer(): void {
    const renderer = this.runtimeV24.renderer;
    if (renderer) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.96;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }

    this.runtimeV24.scene.background = new THREE.Color(0x4d9dca);
    this.runtimeV24.scene.fog = new THREE.Fog(0xa9cfdd, 225, 735);
    this.runtimeV24.camera.far = Math.max(this.runtimeV24.camera.far, 760);
    this.runtimeV24.camera.updateProjectionMatrix();

    const inheritedSun = this.runtimeV24.scene.getObjectByName("sky-dancer-v22-sun-key");
    if (inheritedSun instanceof THREE.DirectionalLight) {
      inheritedSun.color.setHex(0xffe4bd);
      inheritedSun.intensity = 0.84;
      inheritedSun.position.set(-150, 190, -110);
    }

    const inheritedFill = this.runtimeV24.scene.getObjectByName("sky-dancer-v22-sky-fill");
    if (inheritedFill instanceof THREE.HemisphereLight) {
      inheritedFill.color.setHex(0xd9f3ff);
      inheritedFill.groundColor.setHex(0x334d4d);
      inheritedFill.intensity = 0.68;
    }

    if (!this.runtimeV24.scene.getObjectByName("sky-dancer-v24-cool-rim")) {
      const rim = new THREE.DirectionalLight(0x8fcfff, 0.34);
      rim.name = "sky-dancer-v24-cool-rim";
      rim.position.set(130, 72, 160);
      this.runtimeV24.scene.add(rim);
    }
  }

  private buildSkyDome(): void {
    const material = new THREE.ShaderMaterial({
      name: "sky-dancer-v24-gradient-sky-material",
      uniforms: {
        uSunDirection: { value: new THREE.Vector3(-0.42, 0.33, -0.84).normalize() },
      },
      vertexShader: `
        varying vec3 vSkyDirection;
        void main() {
          vSkyDirection = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec3 vSkyDirection;
        uniform vec3 uSunDirection;

        void main() {
          vec3 direction = normalize(vSkyDirection);
          float height = direction.y;
          float upperMix = smoothstep(-0.08, 0.82, height);
          float lowerMix = smoothstep(-0.72, -0.02, height);

          vec3 zenith = vec3(0.030, 0.155, 0.315);
          vec3 upperSky = vec3(0.120, 0.385, 0.620);
          vec3 horizon = vec3(0.620, 0.805, 0.865);
          vec3 lowerHaze = vec3(0.300, 0.500, 0.555);

          vec3 sky = mix(horizon, upperSky, upperMix);
          sky = mix(sky, zenith, smoothstep(0.42, 0.98, height));
          sky = mix(lowerHaze, sky, lowerMix);

          float horizonBand = pow(max(0.0, 1.0 - abs(height)), 7.0);
          sky += vec3(0.105, 0.095, 0.075) * horizonBand;

          float sunDot = max(dot(direction, normalize(uSunDirection)), 0.0);
          float sunDisc = pow(sunDot, 760.0);
          float sunHalo = pow(sunDot, 20.0);
          sky += vec3(1.45, 0.98, 0.57) * sunDisc;
          sky += vec3(0.31, 0.17, 0.075) * sunHalo;

          gl_FragColor = vec4(sky, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 28, 14), material);
    dome.name = "sky-dancer-v24-sky-dome";
    dome.frustumCulled = false;
    dome.renderOrder = -2000;
    this.skyDome = dome;
    this.runtimeV24.scene.add(dome);
  }

  private buildAtmosphericSilhouettes(): void {
    const mountainCount = 22;
    const mountains = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1, 1, 7),
      new THREE.MeshLambertMaterial({
        color: 0xffffff,
        flatShading: true,
        transparent: true,
        opacity: 0.72,
      }),
      mountainCount,
    );
    mountains.name = "sky-dancer-v24-horizon-silhouettes";
    const mountainColors = [
      new THREE.Color(0x42616a),
      new THREE.Color(0x4d6b70),
      new THREE.Color(0x58777a),
      new THREE.Color(0x385960),
    ];
    const dummy = new THREE.Object3D();
    for (let index = 0; index < mountainCount; index += 1) {
      const angle = index / mountainCount * Math.PI * 2 + (index % 3) * 0.035;
      const radius = 335 + (index % 5) * 19;
      const height = 28 + (index % 7) * 6.5;
      const width = 33 + (index % 6) * 8.5;
      dummy.position.set(Math.cos(angle) * radius, -29.2 + height * 0.5, Math.sin(angle) * radius);
      dummy.rotation.set(0, -angle + index * 0.08, (index % 3 - 1) * 0.035);
      dummy.scale.set(width, height, width * (0.55 + (index % 3) * 0.08));
      dummy.updateMatrix();
      mountains.setMatrixAt(index, dummy.matrix);
      mountains.setColorAt(index, mountainColors[index % mountainColors.length]);
    }
    mountains.instanceMatrix.needsUpdate = true;
    if (mountains.instanceColor) mountains.instanceColor.needsUpdate = true;
    mountains.frustumCulled = false;
    this.atmosphereRoot.add(mountains);

    const cloudCount = 36;
    const clouds = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshLambertMaterial({
        color: 0xe9f5f7,
        transparent: true,
        opacity: 0.115,
        depthWrite: false,
        flatShading: true,
      }),
      cloudCount,
    );
    clouds.name = "sky-dancer-v24-far-cloud-layer";
    for (let index = 0; index < cloudCount; index += 1) {
      const angle = index / cloudCount * Math.PI * 2 + Math.sin(index * 2.1) * 0.13;
      const radius = 145 + (index % 8) * 29;
      const width = 13 + (index % 6) * 3.8;
      dummy.position.set(
        Math.cos(angle) * radius,
        24 + (index % 6) * 6.8,
        Math.sin(angle) * radius,
      );
      dummy.rotation.set(index * 0.03, angle + index * 0.09, 0);
      dummy.scale.set(width, 2.4 + (index % 4) * 0.7, width * (0.47 + (index % 3) * 0.08));
      dummy.updateMatrix();
      clouds.setMatrixAt(index, dummy.matrix);
    }
    clouds.instanceMatrix.needsUpdate = true;
    clouds.frustumCulled = false;
    this.farClouds = clouds;
    this.atmosphereRoot.add(clouds);
  }

  private buildHeroAircraftDetail(): void {
    const fighter = this.runtimeV24.playerVisual.getObjectByName("sky-dancer-player-fighter-v2")
      ?? this.runtimeV24.playerVisual;
    if (fighter.getObjectByName("sky-dancer-v24-hero-detail")) return;

    const root = new THREE.Group();
    root.name = "sky-dancer-v24-hero-detail";
    const edgeMaterial = new THREE.MeshStandardMaterial({
      color: 0xb8efff,
      emissive: 0x17617a,
      emissiveIntensity: 0.72,
      roughness: 0.24,
      metalness: 0.48,
      flatShading: true,
    });
    const panelMaterial = new THREE.MeshStandardMaterial({
      color: 0x123c58,
      roughness: 0.3,
      metalness: 0.56,
      flatShading: true,
    });
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x85eaff,
      transparent: true,
      opacity: 0.8,
      toneMapped: false,
    });

    for (const side of [-1, 1]) {
      const leadingEdge = new THREE.Mesh(new THREE.BoxGeometry(2.46, 0.045, 0.075), edgeMaterial.clone());
      leadingEdge.position.set(side * 1.31, 0.39, 0.055);
      leadingEdge.rotation.y = side * 0.47;
      root.add(leadingEdge);

      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.036, 0.18), glowMaterial.clone());
      panel.position.set(side * 1.34, 0.415, -0.35);
      panel.rotation.y = side * 0.12;
      root.add(panel);

      const intake = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.25, 0.88), panelMaterial.clone());
      intake.position.set(side * 0.62, 0.31, -0.52);
      intake.rotation.x = -0.05;
      root.add(intake);

      const canopyRail = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.045, 1.0), edgeMaterial.clone());
      canopyRail.position.set(side * 0.31, 0.865, 0.54);
      canopyRail.rotation.x = -0.08;
      root.add(canopyRail);
    }

    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.065, 2.18), edgeMaterial.clone());
    spine.position.set(0, 0.825, -0.19);
    const keel = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.24, 1.85), panelMaterial.clone());
    keel.position.set(0, 0.16, -0.48);
    root.add(spine, keel);

    fighter.add(root);
  }

  private ensureEnemySilhouettes(snapshot: CartArenaSessionSnapshot): void {
    const enemies = new Map(snapshot.enemies.map((enemy) => [enemy.id, enemy]));
    for (const [id, group] of this.runtimeV24.enemyGroups) {
      const fighter = group.getObjectByName("sky-dancer-enemy-fighter-v2");
      if (!fighter || fighter.getObjectByName("sky-dancer-v24-enemy-signature")) continue;
      const enemy = enemies.get(id);
      const boss = enemy?.kind === "boss";
      const heavy = enemy?.kind === "heavy";

      const signature = new THREE.Group();
      signature.name = "sky-dancer-v24-enemy-signature";
      const color = boss ? 0xff344f : heavy ? 0xff65ad : 0xffbf55;
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: boss ? 0.94 : 0.76,
        toneMapped: false,
      });
      const width = boss ? 2.7 : heavy ? 1.75 : 1.25;
      for (const side of [-1, 1]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(width, 0.045, boss ? 0.14 : 0.09), material.clone());
        bar.position.set(side * width * 0.45, boss ? 0.82 : 0.61, -0.05);
        bar.rotation.y = side * 0.28;
        signature.add(bar);
      }
      const beacon = new THREE.Mesh(
        new THREE.OctahedronGeometry(boss ? 0.15 : 0.1, 0),
        material.clone(),
      );
      beacon.position.set(0, boss ? 1.42 : 1.04, -0.45);
      signature.add(beacon);
      fighter.add(signature);
      this.tuneAircraftMaterialsV24(group, true);
    }
  }

  private tuneAircraftMaterialsV24(root: THREE.Object3D, enemy: boolean): void {
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        material.dithering = true;
        if (material instanceof THREE.MeshStandardMaterial) {
          material.roughness = Math.min(material.roughness, enemy ? 0.42 : 0.32);
          material.metalness = Math.max(material.metalness, enemy ? 0.16 : 0.26);
          material.needsUpdate = true;
        }
      }
    });
  }

  private buildMuzzleSystem(): void {
    const fighter = this.runtimeV24.playerVisual.getObjectByName("sky-dancer-player-fighter-v2")
      ?? this.runtimeV24.playerVisual;
    for (const side of [-1, 1]) {
      const root = new THREE.Group();
      root.name = side < 0 ? "sky-dancer-v24-muzzle-left" : "sky-dancer-v24-muzzle-right";
      root.position.set(side * 1.02, 0.37, 0.88);
      root.visible = false;

      const core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.17, 1),
        new THREE.MeshBasicMaterial({
          color: 0xf4ffff,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      const plume = new THREE.Mesh(
        new THREE.ConeGeometry(0.16, 1.05, 10, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0x5be1ff,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      plume.rotation.x = Math.PI / 2;
      plume.position.z = 0.43;
      const light = new THREE.PointLight(0x8eeeff, 0, 6, 2);
      root.add(core, plume, light);
      fighter.add(root);
      this.muzzleSockets.push({ root, core, plume, light, life: 0 });
    }
  }

  private updateMuzzleSystem(weapon: SkyDancerPlayerWeaponState, delta: number): void {
    if (weapon.shotSerial > this.lastShotSerial) {
      this.lastShotSerial = weapon.shotSerial;
      this.launchPulse = 1;
      const socket = this.muzzleSockets[weapon.shotSerial % this.muzzleSockets.length];
      if (socket) {
        socket.life = 0.16;
        socket.root.visible = true;
      }
    }

    for (let index = 0; index < this.muzzleSockets.length; index += 1) {
      const socket = this.muzzleSockets[index];
      socket.life = Math.max(0, socket.life - delta);
      if (socket.life <= 0) {
        socket.root.visible = false;
        socket.light.intensity = 0;
        continue;
      }
      const ratio = socket.life / 0.16;
      const pulse = Math.sin((1 - ratio) * Math.PI);
      socket.root.visible = true;
      socket.core.scale.setScalar(0.72 + pulse * 1.35);
      socket.plume.scale.set(0.7 + pulse * 0.55, 0.7 + pulse * 0.55, 0.5 + pulse * 1.3);
      socket.core.material.opacity = ratio * 0.96;
      socket.plume.material.opacity = ratio * 0.72;
      socket.light.intensity = ratio * 3.8;
    }
  }

  private updateImpactResidues(weapon: SkyDancerPlayerWeaponState, delta: number): void {
    if (weapon.hitSerial > this.lastPlayerHitSerial) {
      this.lastPlayerHitSerial = weapon.hitSerial;
      this.spawnImpactResidue(weapon);
    }

    for (let index = this.impactResidues.length - 1; index >= 0; index -= 1) {
      const residue = this.impactResidues[index];
      residue.life -= delta;
      const ratio = THREE.MathUtils.clamp(residue.life / residue.maxLife, 0, 1);
      const age = 1 - ratio;

      residue.flash.scale.setScalar(0.8 + age * 3.0);
      residue.flash.material.opacity = ratio * ratio * 0.72;
      residue.light.intensity = 4.4 * ratio * ratio;

      residue.rings.forEach((ring, ringIndex) => {
        const ringAge = THREE.MathUtils.clamp(age * (1.1 + ringIndex * 0.15), 0, 1);
        ring.scale.setScalar(0.7 + ringAge * (3.5 + ringIndex * 1.15));
        ring.rotation.x += delta * (0.7 + ringIndex * 0.26);
        ring.rotation.y += delta * (0.45 + ringIndex * 0.21);
        ring.material.opacity = Math.max(0, (1 - ringAge) * (0.5 - ringIndex * 0.09));
      });

      for (let particleIndex = 0; particleIndex < residue.sparkPositions.length; particleIndex += 1) {
        const position = residue.sparkPositions[particleIndex];
        const velocity = residue.sparkVelocities[particleIndex];
        position.addScaledVector(velocity, delta);
        velocity.y -= delta * 0.72;
        this.impactDummy.position.copy(position);
        this.impactDummy.rotation.set(
          this.elapsedV24 * (1.8 + particleIndex * 0.07),
          this.elapsedV24 * (2.2 + particleIndex * 0.05),
          particleIndex * 0.41,
        );
        this.impactDummy.scale.setScalar(Math.max(0.05, ratio * (0.65 + (particleIndex % 4) * 0.12)));
        this.impactDummy.updateMatrix();
        residue.sparks.setMatrixAt(particleIndex, this.impactDummy.matrix);
      }
      residue.sparks.instanceMatrix.needsUpdate = true;
      residue.sparks.material.opacity = ratio * 0.82;

      for (let particleIndex = 0; particleIndex < residue.smokePositions.length; particleIndex += 1) {
        const position = residue.smokePositions[particleIndex];
        const velocity = residue.smokeVelocities[particleIndex];
        position.addScaledVector(velocity, delta);
        velocity.multiplyScalar(Math.pow(0.72, delta));
        this.impactDummy.position.copy(position);
        this.impactDummy.rotation.set(particleIndex * 0.33, this.elapsedV24 * 0.22 + particleIndex, particleIndex * 0.19);
        const scale = 0.65 + age * (2.1 + (particleIndex % 3) * 0.35);
        this.impactDummy.scale.set(scale * 1.35, scale * 0.78, scale);
        this.impactDummy.updateMatrix();
        residue.smoke.setMatrixAt(particleIndex, this.impactDummy.matrix);
      }
      residue.smoke.instanceMatrix.needsUpdate = true;
      residue.smoke.material.opacity = Math.sin(ratio * Math.PI) * 0.32;

      if (residue.life > 0) continue;
      this.releaseImpactResidue(residue);
      this.impactResidues.splice(index, 1);
    }
  }

  private spawnImpactResidue(weapon: SkyDancerPlayerWeaponState): void {
    while (this.impactResidues.length >= MAX_IMPACT_RESIDUES) {
      const oldest = this.impactResidues.shift();
      if (oldest) this.releaseImpactResidue(oldest);
    }

    const residue = this.impactResiduePool.pop() ?? this.createImpactResidue();
    residue.life = residue.maxLife;
    residue.root.visible = true;
    const target = weapon.lastHitEnemyId
      ? this.runtimeV24.enemyGroups.get(weapon.lastHitEnemyId)
      : undefined;
    if (target) target.getWorldPosition(residue.root.position);
    else residue.root.position.set(weapon.lastHitX, 1.55, weapon.lastHitZ);
    if (residue.root.position.y < 0.8) residue.root.position.y = 1.55;

    residue.flash.scale.setScalar(0.8);
    residue.flash.material.opacity = 0.72;
    residue.rings.forEach((ring, index) => {
      ring.scale.setScalar(0.7);
      ring.rotation.set(Math.PI * (0.25 + index * 0.3), index * 0.75, 0);
      ring.material.opacity = 0.5 - index * 0.09;
    });
    residue.light.intensity = 4.4;

    const sparkCount = residue.sparkPositions.length;
    for (let index = 0; index < sparkCount; index += 1) {
      const angle = index / sparkCount * Math.PI * 2 + (index % 3) * 0.16;
      const position = residue.sparkPositions[index];
      const velocity = residue.sparkVelocities[index];
      position.set(Math.cos(angle) * 0.18, (index % 4 - 1.5) * 0.08, Math.sin(angle) * 0.18);
      velocity.set(
        Math.cos(angle) * (3.2 + (index % 5) * 0.68),
        -0.35 + (index % 6) * 0.42,
        Math.sin(angle) * (3.2 + ((index + 2) % 5) * 0.68),
      );
      this.impactDummy.position.copy(position);
      this.impactDummy.scale.setScalar(1);
      this.impactDummy.updateMatrix();
      residue.sparks.setMatrixAt(index, this.impactDummy.matrix);
    }
    residue.sparks.instanceMatrix.needsUpdate = true;
    residue.sparks.material.opacity = 0.82;

    const smokeCount = residue.smokePositions.length;
    for (let index = 0; index < smokeCount; index += 1) {
      const angle = index / smokeCount * Math.PI * 2;
      const position = residue.smokePositions[index];
      const velocity = residue.smokeVelocities[index];
      position.set(Math.cos(angle) * 0.28, 0.12 + (index % 3) * 0.1, Math.sin(angle) * 0.28);
      velocity.set(Math.cos(angle) * 0.32, 0.45 + (index % 3) * 0.16, Math.sin(angle) * 0.32);
      this.impactDummy.position.copy(position);
      this.impactDummy.scale.setScalar(0.7);
      this.impactDummy.updateMatrix();
      residue.smoke.setMatrixAt(index, this.impactDummy.matrix);
    }
    residue.smoke.instanceMatrix.needsUpdate = true;
    residue.smoke.material.opacity = 0;
    this.impactResidues.push(residue);
  }

  private prewarmImpactResidues(): void {
    while (this.impactResiduePool.length < MAX_IMPACT_RESIDUES) {
      this.impactResiduePool.push(this.createImpactResidue());
    }
  }

  private createImpactResidue(): ImpactResidue {
    const root = new THREE.Group();
    root.name = "sky-dancer-v24-impact-residue";
    root.visible = false;

    const flash = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.54, 1),
      new THREE.MeshBasicMaterial({
        color: 0xffefaf,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    root.add(flash);

    const rings: ImpactResidue["rings"] = [];
    for (let index = 0; index < 2; index += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.62 + index * 0.17, 0.055, 6, 26),
        new THREE.MeshBasicMaterial({
          color: index === 0 ? 0xff9a43 : 0xffe08a,
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      ring.rotation.set(Math.PI * (0.25 + index * 0.3), index * 0.75, 0);
      root.add(ring);
      rings.push(ring);
    }

    const sparkCount = 14;
    const sparks = new THREE.InstancedMesh(
      new THREE.TetrahedronGeometry(0.12, 0),
      new THREE.MeshBasicMaterial({
        color: 0xffb14e,
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
      sparkCount,
    );
    sparks.name = "sky-dancer-v24-impact-fragments";
    const sparkPositions: THREE.Vector3[] = [];
    const sparkVelocities: THREE.Vector3[] = [];
    for (let index = 0; index < sparkCount; index += 1) {
      const position = new THREE.Vector3();
      const velocity = new THREE.Vector3();
      sparkPositions.push(position);
      sparkVelocities.push(velocity);
      this.impactDummy.position.copy(position);
      this.impactDummy.scale.setScalar(1);
      this.impactDummy.updateMatrix();
      sparks.setMatrixAt(index, this.impactDummy.matrix);
    }
    sparks.instanceMatrix.needsUpdate = true;
    root.add(sparks);

    const smokeCount = 7;
    const smoke = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(0.32, 0),
      new THREE.MeshLambertMaterial({
        color: 0x33434a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        flatShading: true,
      }),
      smokeCount,
    );
    smoke.name = "sky-dancer-v24-impact-smoke";
    const smokePositions: THREE.Vector3[] = [];
    const smokeVelocities: THREE.Vector3[] = [];
    for (let index = 0; index < smokeCount; index += 1) {
      const position = new THREE.Vector3();
      const velocity = new THREE.Vector3();
      smokePositions.push(position);
      smokeVelocities.push(velocity);
      this.impactDummy.position.copy(position);
      this.impactDummy.scale.setScalar(0.7);
      this.impactDummy.updateMatrix();
      smoke.setMatrixAt(index, this.impactDummy.matrix);
    }
    smoke.instanceMatrix.needsUpdate = true;
    root.add(smoke);

    const light = new THREE.PointLight(0xff9b42, 4.4, 14, 2);
    root.add(light);
    this.runtimeV24.scene.add(root);
    return {
      root,
      life: 0,
      maxLife: 1.35,
      flash,
      rings,
      light,
      sparks,
      sparkPositions,
      sparkVelocities,
      smoke,
      smokePositions,
      smokeVelocities,
    };
  }

  private releaseImpactResidue(residue: ImpactResidue): void {
    residue.life = 0;
    residue.root.visible = false;
    residue.light.intensity = 0;
    this.impactResiduePool.push(residue);
  }

  private createScreenGrade(): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
    const material = new THREE.ShaderMaterial({
      name: "sky-dancer-v24-cinematic-edge-grade-material",
      uniforms: {
        uBoost: { value: 0 },
        uThreat: { value: 0 },
        uHit: { value: 0 },
        uLaunch: { value: 0 },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        uniform float uBoost;
        uniform float uThreat;
        uniform float uHit;
        uniform float uLaunch;
        uniform float uTime;

        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float radius = length(p * vec2(0.78, 1.0));
          float edge = smoothstep(0.48, 1.12, radius);
          float bars = smoothstep(0.72, 1.0, abs(p.y));
          float pulse = 0.96 + sin(uTime * 9.0) * 0.04;
          float danger = max(uThreat * 0.72, uHit);

          vec3 cool = vec3(0.012, 0.055, 0.085);
          vec3 hot = vec3(0.34, 0.012, 0.006);
          vec3 color = mix(cool, hot, danger);
          color += vec3(0.018, 0.11, 0.17) * uBoost;
          color += vec3(0.11, 0.24, 0.28) * uLaunch * max(0.0, 1.0 - radius);

          float alpha = edge * (0.075 + uBoost * 0.055 + danger * 0.19 * pulse);
          alpha += bars * 0.018;
          alpha += uLaunch * (1.0 - smoothstep(0.0, 0.82, radius)) * 0.055;
          gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.34));
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const overlay = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    overlay.name = "sky-dancer-v24-cinematic-edge-grade";
    overlay.frustumCulled = false;
    overlay.renderOrder = 1320;
    return overlay;
  }

  private updateAtmosphere(delta: number): void {
    this.runtimeV24.camera.getWorldPosition(this.cameraWorldPosition);
    if (this.skyDome) this.skyDome.position.copy(this.cameraWorldPosition);

    const follow = Math.min(1, delta * 0.42);
    this.atmosphereRoot.position.x += (this.cameraWorldPosition.x - this.atmosphereRoot.position.x) * follow;
    this.atmosphereRoot.position.z += (this.cameraWorldPosition.z - this.atmosphereRoot.position.z) * follow;
    if (this.farClouds) {
      this.farClouds.rotation.y = Math.sin(this.elapsedV24 * 0.018) * 0.012;
      this.farClouds.position.x = Math.sin(this.elapsedV24 * 0.027) * 3.5;
    }
  }

  private updateCameraLens(turbo: SkyDancerTurboState, delta: number): void {
    const release = turbo.releaseAgeSeconds < 0.78
      ? 1 - THREE.MathUtils.clamp(turbo.releaseAgeSeconds / 0.78, 0, 1)
      : 0;
    const easedRelease = release * release * (3 - 2 * release);
    const targetFov = this.baseFov + easedRelease * 4.6;
    const nextFov = THREE.MathUtils.lerp(this.runtimeV24.camera.fov, targetFov, Math.min(1, delta * 8.5));
    if (Math.abs(nextFov - this.runtimeV24.camera.fov) < 0.005) return;
    this.runtimeV24.camera.fov = nextFov;
    this.runtimeV24.camera.updateProjectionMatrix();
  }

  private updateScreenGrade(turbo: SkyDancerTurboState, missiles: SkyDancerMissileState, delta: number): void {
    if (missiles.hitSerial > this.lastEnemyHitSerial) {
      this.lastEnemyHitSerial = missiles.hitSerial;
      this.enemyHitPulse = 1;
    }
    this.enemyHitPulse = Math.max(0, this.enemyHitPulse - delta * 2.4);
    this.launchPulse = Math.max(0, this.launchPulse - delta * 5.8);

    const nearest = missiles.missiles.reduce(
      (distance, missile) => Math.min(distance, missile.distanceToPlayer),
      Number.POSITIVE_INFINITY,
    );
    const threat = Number.isFinite(nearest)
      ? THREE.MathUtils.clamp((30 - nearest) / 26, 0, 1)
      : 0;
    const release = turbo.releaseAgeSeconds < 0.78
      ? 1 - THREE.MathUtils.clamp(turbo.releaseAgeSeconds / 0.78, 0, 1)
      : 0;

    const uniforms = this.screenGrade.material.uniforms;
    uniforms.uBoost.value = release;
    uniforms.uThreat.value = threat;
    uniforms.uHit.value = this.enemyHitPulse;
    uniforms.uLaunch.value = this.launchPulse;
    uniforms.uTime.value = this.elapsedV24;
  }
}

export { SkyDancerAirCombatFxV24 as SkyDancerAirCombatFx };
