import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../cart/CartArenaSession";
import type { SkyDancerMissileSnapshot, SkyDancerMissileState } from "./SkyDancerFlightCombat";
import { SkyDancerAirCombatFxV24 } from "./SkyDancerAirCombatFxV24";
import type { SkyDancerFxRuntime } from "./SkyDancerAirCombatFxV2";

interface V25Runtime extends SkyDancerFxRuntime {
  renderer?: THREE.WebGLRenderer;
}

interface MissileHeatVisual {
  root: THREE.Group;
  core: THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshBasicMaterial>;
  halo: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  flame: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>;
  light: THREE.PointLight;
  phase: number;
}

const GROUND_Y = -28.45;
const WORLD_CHUNK = 210;
const HERO_SCALE = 1.14;

/**
 * V25 translates the supplied arcade-air-combat reference into the live scene:
 * a brighter layered valley, a concentrated landmark city, an enlarged blue/white
 * hero fighter, hot twin exhausts, and white-hot missile cores with long inherited
 * smoke ribbons. Simulation, collision and chase-camera position remain untouched.
 */
export class SkyDancerAirCombatFxV25 extends SkyDancerAirCombatFxV24 {
  private readonly runtimeV25: V25Runtime;
  private readonly referenceWorld = new THREE.Group();
  private readonly missileHeatRoot = new THREE.Group();
  private readonly missileHeat = new Map<number, MissileHeatVisual>();
  private readonly missileHeatPool: MissileHeatVisual[] = [];
  private readonly activeMissileHeatIds = new Set<number>();
  private readonly engineCores: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>[] = [];
  private readonly enginePlumes: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>[] = [];
  private readonly cameraWorldPosition = new THREE.Vector3();
  private referenceSky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> | null = null;
  private builtV25 = false;
  private chunkX = Number.NaN;
  private chunkZ = Number.NaN;
  private elapsedV25 = 0;

  constructor(runtime: SkyDancerFxRuntime) {
    super(runtime);
    this.runtimeV25 = runtime as V25Runtime;
    this.referenceWorld.name = "sky-dancer-v25-reference-world";
    this.missileHeatRoot.name = "sky-dancer-v25-missile-heat-system";
  }

  override update(snapshot: CartArenaSessionSnapshot, missiles: SkyDancerMissileState, delta: number): void {
    super.update(snapshot, missiles, delta);
    const frameDelta = THREE.MathUtils.clamp(delta, 0.001, 0.05);
    this.elapsedV25 += frameDelta;

    if (!this.builtV25) {
      this.builtV25 = true;
      this.configureReferenceGrade();
      this.buildReferenceSky();
      this.buildValleyFields();
      this.buildRiverBasin();
      this.buildLandmarkCity();
      this.buildHorizonCloudBanks();
      this.buildNavigationBeacons();
      this.buildHeroPresence();
      this.runtimeV25.scene.add(this.referenceWorld, this.missileHeatRoot);
      this.prewarmMissileHeat();
    }

    this.updateWorldAnchor(snapshot);
    this.updateReferenceSky();
    this.updateHeroEngines(snapshot, frameDelta);
    this.updateMissileHeat(missiles, frameDelta);
  }

  private configureReferenceGrade(): void {
    const renderer = this.runtimeV25.renderer;
    if (renderer) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.03;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }

    this.runtimeV25.scene.background = new THREE.Color(0x3294cf);
    this.runtimeV25.scene.fog = new THREE.Fog(0xa8d4e8, 245, 795);
    this.runtimeV25.camera.far = Math.max(this.runtimeV25.camera.far, 840);
    this.runtimeV25.camera.updateProjectionMatrix();

    const oldSky = this.runtimeV25.scene.getObjectByName("sky-dancer-v24-sky-dome");
    if (oldSky) oldSky.visible = false;

    for (const name of [
      "sky-dancer-v22-city-blocks",
      "sky-dancer-v23-facade-window-bands",
      "sky-dancer-v23-roof-markers",
    ]) {
      const object = this.runtimeV25.scene.getObjectByName(name);
      if (object) object.visible = false;
    }

    const sun = this.runtimeV25.scene.getObjectByName("sky-dancer-v22-sun-key");
    if (sun instanceof THREE.DirectionalLight) {
      sun.color.setHex(0xffe9c8);
      sun.intensity = 0.98;
      sun.position.set(-165, 205, -125);
    }

    const fill = this.runtimeV25.scene.getObjectByName("sky-dancer-v22-sky-fill");
    if (fill instanceof THREE.HemisphereLight) {
      fill.color.setHex(0xdff6ff);
      fill.groundColor.setHex(0x3d624c);
      fill.intensity = 0.78;
    }
  }

  private buildReferenceSky(): void {
    const material = new THREE.ShaderMaterial({
      name: "sky-dancer-v25-reference-sky-material",
      uniforms: {
        uSunDirection: { value: new THREE.Vector3(-0.46, 0.31, -0.83).normalize() },
      },
      vertexShader: `
        varying vec3 vDirection;
        void main() {
          vDirection = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec3 vDirection;
        uniform vec3 uSunDirection;

        void main() {
          vec3 direction = normalize(vDirection);
          float height = direction.y;
          float skyMix = smoothstep(-0.16, 0.78, height);
          float zenithMix = smoothstep(0.34, 0.98, height);
          vec3 horizon = vec3(0.48, 0.75, 0.90);
          vec3 blue = vec3(0.055, 0.37, 0.66);
          vec3 zenith = vec3(0.018, 0.16, 0.38);
          vec3 sky = mix(horizon, blue, skyMix);
          sky = mix(sky, zenith, zenithMix);

          float horizonGlow = pow(max(0.0, 1.0 - abs(height)), 8.0);
          sky += vec3(0.12, 0.13, 0.11) * horizonGlow;
          float sunDot = max(dot(direction, normalize(uSunDirection)), 0.0);
          sky += vec3(1.0, 0.78, 0.48) * pow(sunDot, 420.0);
          sky += vec3(0.20, 0.13, 0.07) * pow(sunDot, 15.0);
          gl_FragColor = vec4(sky, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });

    const sky = new THREE.Mesh(new THREE.SphereGeometry(670, 28, 14), material);
    sky.name = "sky-dancer-v25-reference-sky";
    sky.frustumCulled = false;
    sky.renderOrder = -2200;
    this.referenceSky = sky;
    this.runtimeV25.scene.add(sky);
  }

  private buildValleyFields(): void {
    const placements: Array<{ x: number; z: number; width: number; depth: number; rotation: number; color: THREE.Color }> = [];
    const palette = [
      new THREE.Color(0x477f45),
      new THREE.Color(0x5f984c),
      new THREE.Color(0x77a753),
      new THREE.Color(0x9aa65a),
      new THREE.Color(0x8a8e4d),
      new THREE.Color(0x4f8960),
    ];

    for (let row = -5; row <= 5; row += 1) {
      for (let column = -6; column <= 6; column += 1) {
        const seed = (row + 7) * 31 + (column + 9) * 17;
        const x = column * 19.5 + Math.sin(seed * 1.37) * 5.2;
        const z = row * 21.5 + Math.cos(seed * 0.91) * 5.8;
        if (Math.abs(x + 43 + Math.sin(z * 0.035) * 16) < 8.5) continue;
        placements.push({
          x,
          z,
          width: 12.5 + (seed % 5) * 2.6,
          depth: 13.5 + (seed % 4) * 3.2,
          rotation: ((seed % 7) - 3) * 0.045,
          color: palette[Math.abs(seed) % palette.length],
        });
      }
    }

    const fields = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({
        color: 0xffffff,
        vertexColors: true,
        transparent: true,
        opacity: 0.96,
      }),
      placements.length,
    );
    fields.name = "sky-dancer-v25-valley-fields";
    const dummy = new THREE.Object3D();
    placements.forEach((placement, index) => {
      dummy.position.set(placement.x, GROUND_Y + 0.18, placement.z);
      dummy.rotation.set(0, placement.rotation, 0);
      dummy.scale.set(placement.width, 0.16, placement.depth);
      dummy.updateMatrix();
      fields.setMatrixAt(index, dummy.matrix);
      fields.setColorAt(index, placement.color);
    });
    fields.instanceMatrix.needsUpdate = true;
    if (fields.instanceColor) fields.instanceColor.needsUpdate = true;
    fields.frustumCulled = false;
    this.referenceWorld.add(fields);
  }

  private buildRiverBasin(): void {
    const root = new THREE.Group();
    root.name = "sky-dancer-v25-river-basin";
    const waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x287fa5,
      emissive: 0x0a405c,
      emissiveIntensity: 0.22,
      roughness: 0.2,
      metalness: 0.12,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    const highlightMaterial = new THREE.MeshBasicMaterial({
      color: 0xa8efff,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      toneMapped: false,
    });

    for (let index = 0; index < 22; index += 1) {
      const t = index / 21;
      const z = -118 + t * 236;
      const x = -43 + Math.sin(t * Math.PI * 3.2) * 18;
      const width = 9.5 + Math.sin(t * Math.PI) * 8.5;
      const segment = new THREE.Mesh(new THREE.BoxGeometry(width, 0.11, 13.5), waterMaterial);
      segment.position.set(x, GROUND_Y + 0.31, z);
      segment.rotation.y = Math.cos(t * Math.PI * 3.2) * 0.23;
      root.add(segment);

      if (index % 3 === 0) {
        const glint = new THREE.Mesh(new THREE.BoxGeometry(width * 0.62, 0.025, 0.18), highlightMaterial);
        glint.position.set(x, GROUND_Y + 0.38, z - 0.7);
        glint.rotation.y = segment.rotation.y;
        root.add(glint);
      }
    }
    this.referenceWorld.add(root);
  }

  private buildLandmarkCity(): void {
    const root = new THREE.Group();
    root.name = "sky-dancer-v25-landmark-city";
    const count = 34;
    const buildings = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.35,
        metalness: 0.28,
        flatShading: true,
      }),
      count,
    );
    buildings.name = "sky-dancer-v25-city-cluster";
    const cool = new THREE.Color(0x8ea8b5);
    const light = new THREE.Color(0xc0ced4);
    const blue = new THREE.Color(0x668ca4);
    const dummy = new THREE.Object3D();

    for (let index = 0; index < count; index += 1) {
      const column = index % 7;
      const row = Math.floor(index / 7);
      const x = 58 + column * 7.2 + Math.sin(index * 2.17) * 2.1;
      const z = 20 + row * 8.4 + Math.cos(index * 1.39) * 2.4;
      const height = 4.5 + (index % 8) * 2.15 + (column === 3 ? 5.8 : 0);
      dummy.position.set(x, GROUND_Y + height * 0.5 + 0.28, z);
      dummy.rotation.set(0, (index % 3 - 1) * 0.055, 0);
      dummy.scale.set(3.2 + (index % 3) * 0.7, height, 3.1 + ((index + 1) % 3) * 0.75);
      dummy.updateMatrix();
      buildings.setMatrixAt(index, dummy.matrix);
      buildings.setColorAt(index, index % 5 === 0 ? light : index % 3 === 0 ? blue : cool);
    }
    buildings.instanceMatrix.needsUpdate = true;
    if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true;
    root.add(buildings);

    const towerMaterial = new THREE.MeshStandardMaterial({
      color: 0xbccbd2,
      emissive: 0x173f55,
      emissiveIntensity: 0.2,
      roughness: 0.26,
      metalness: 0.44,
      flatShading: true,
    });
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 3.4, 39, 7), towerMaterial);
    tower.position.set(81, GROUND_Y + 19.8, 42);
    tower.name = "sky-dancer-v25-city-spire";
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(1.68, 9.5, 7),
      new THREE.MeshBasicMaterial({ color: 0x9bf1ff, transparent: true, opacity: 0.78, toneMapped: false }),
    );
    tip.position.set(81, GROUND_Y + 44, 42);
    root.add(tower, tip);
    this.referenceWorld.add(root);
  }

  private buildHorizonCloudBanks(): void {
    const count = 44;
    const clouds = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshLambertMaterial({
        color: 0xf4fbff,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
        flatShading: true,
      }),
      count,
    );
    clouds.name = "sky-dancer-v25-horizon-cloud-banks";
    const dummy = new THREE.Object3D();
    for (let index = 0; index < count; index += 1) {
      const angle = index / count * Math.PI * 2 + Math.sin(index * 1.73) * 0.12;
      const radius = 185 + (index % 7) * 25;
      const width = 10 + (index % 6) * 3.6;
      dummy.position.set(
        Math.cos(angle) * radius,
        13 + (index % 6) * 5.4,
        Math.sin(angle) * radius,
      );
      dummy.rotation.set(index * 0.04, angle, index * 0.015);
      dummy.scale.set(width * 1.7, 2.5 + (index % 4) * 0.65, width * 0.72);
      dummy.updateMatrix();
      clouds.setMatrixAt(index, dummy.matrix);
    }
    clouds.instanceMatrix.needsUpdate = true;
    clouds.frustumCulled = false;
    this.referenceWorld.add(clouds);
  }

  private buildNavigationBeacons(): void {
    const root = new THREE.Group();
    root.name = "sky-dancer-v25-navigation-beacons";
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: 0x71e6ff,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const beaconMaterial = new THREE.MeshBasicMaterial({
      color: 0xc8f8ff,
      transparent: true,
      opacity: 0.72,
      toneMapped: false,
    });
    const positions: Array<[number, number]> = [
      [-112, -76],
      [118, -68],
      [82, 43],
      [-96, 82],
      [22, 112],
    ];

    positions.forEach(([x, z], index) => {
      const height = 28 + (index % 3) * 9;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.22, height, 6), beamMaterial.clone());
      beam.position.set(x, GROUND_Y + height * 0.5, z);
      const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.72, 0), beaconMaterial.clone());
      marker.position.set(x, GROUND_Y + height, z);
      root.add(beam, marker);
    });
    this.referenceWorld.add(root);
  }

  private buildHeroPresence(): void {
    const fighter = this.runtimeV25.playerVisual.getObjectByName("sky-dancer-player-fighter-v2")
      ?? this.runtimeV25.playerVisual;
    if (fighter.userData.skyDancerV25HeroScale !== true) {
      fighter.scale.multiplyScalar(HERO_SCALE);
      fighter.userData.skyDancerV25HeroScale = true;
    }
    if (fighter.getObjectByName("sky-dancer-v25-hero-presence")) return;

    const root = new THREE.Group();
    root.name = "sky-dancer-v25-hero-presence";
    const whiteMaterial = new THREE.MeshStandardMaterial({
      color: 0xe8f3f8,
      emissive: 0x163d52,
      emissiveIntensity: 0.12,
      roughness: 0.26,
      metalness: 0.5,
      flatShading: true,
      side: THREE.DoubleSide,
    });
    const blueMaterial = new THREE.MeshStandardMaterial({
      color: 0x136bb2,
      emissive: 0x0c4b78,
      emissiveIntensity: 0.42,
      roughness: 0.22,
      metalness: 0.54,
      flatShading: true,
    });
    const glassHighlight = new THREE.MeshBasicMaterial({
      color: 0xbdefff,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

    for (const side of [-1, 1]) {
      const wingGeometry = new THREE.BufferGeometry();
      wingGeometry.setAttribute("position", new THREE.Float32BufferAttribute([
        side * 0.12, 0.405, 0.54,
        side * 2.47, 0.325, -0.56,
        side * 0.34, 0.39, -0.82,
      ], 3));
      wingGeometry.computeVertexNormals();
      const wingPanel = new THREE.Mesh(wingGeometry, whiteMaterial.clone());
      root.add(wingPanel);

      const blueStripe = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.035, 0.14), blueMaterial.clone());
      blueStripe.position.set(side * 1.24, 0.43, -0.34);
      blueStripe.rotation.y = side * 0.42;
      root.add(blueStripe);

      const wingTip = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.11, 0),
        new THREE.MeshBasicMaterial({
          color: side < 0 ? 0xff6a72 : 0x74efff,
          transparent: true,
          opacity: 0.94,
          toneMapped: false,
        }),
      );
      wingTip.position.set(side * 2.58, 0.34, -0.58);
      root.add(wingTip);

      const outerCore = new THREE.Mesh(
        new THREE.CircleGeometry(0.255, 16),
        new THREE.MeshBasicMaterial({
          color: 0xff682d,
          transparent: true,
          opacity: 0.88,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      outerCore.position.set(side * 0.34, 0.35, -2.115);
      outerCore.rotation.y = Math.PI;

      const innerCore = new THREE.Mesh(
        new THREE.CircleGeometry(0.145, 14),
        new THREE.MeshBasicMaterial({
          color: 0xfff5d5,
          transparent: true,
          opacity: 0.98,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      innerCore.position.set(side * 0.34, 0.35, -2.13);
      innerCore.rotation.y = Math.PI;

      const plume = new THREE.Mesh(
        new THREE.ConeGeometry(0.24, 1.75, 12, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0x52cfff,
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      plume.position.set(side * 0.34, 0.35, -2.88);
      plume.rotation.x = -Math.PI / 2;
      root.add(outerCore, innerCore, plume);
      this.engineCores.push(outerCore, innerCore);
      this.enginePlumes.push(plume);
    }

    const centerStripe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.055, 2.8), blueMaterial);
    centerStripe.position.set(0, 0.79, 0.04);
    const canopyGlint = new THREE.Mesh(new THREE.SphereGeometry(0.54, 12, 7), glassHighlight);
    canopyGlint.scale.set(0.73, 0.6, 1.14);
    canopyGlint.position.set(0, 0.85, 0.63);
    root.add(centerStripe, canopyGlint);

    fighter.add(root);
  }

  private updateWorldAnchor(snapshot: CartArenaSessionSnapshot): void {
    const nextChunkX = Math.floor(snapshot.x / WORLD_CHUNK) * WORLD_CHUNK;
    const nextChunkZ = Math.floor(snapshot.z / WORLD_CHUNK) * WORLD_CHUNK;
    if (nextChunkX === this.chunkX && nextChunkZ === this.chunkZ) return;
    this.chunkX = nextChunkX;
    this.chunkZ = nextChunkZ;
    this.referenceWorld.position.set(nextChunkX, 0, nextChunkZ);
  }

  private updateReferenceSky(): void {
    if (!this.referenceSky) return;
    this.runtimeV25.camera.getWorldPosition(this.cameraWorldPosition);
    this.referenceSky.position.copy(this.cameraWorldPosition);
  }

  private updateHeroEngines(snapshot: CartArenaSessionSnapshot, delta: number): void {
    const speed = THREE.MathUtils.clamp(snapshot.speed / 24, 0, 1);
    const turbo = snapshot.boostActive ? 1 : 0;
    const pulse = 0.94 + Math.sin(this.elapsedV25 * 23) * 0.06;

    for (let index = 0; index < this.engineCores.length; index += 1) {
      const core = this.engineCores[index];
      const inner = index % 2 === 1;
      const scale = pulse * (inner ? 0.88 + speed * 0.22 : 0.94 + speed * 0.34 + turbo * 0.22);
      core.scale.setScalar(scale);
      core.material.opacity = inner ? 0.92 + turbo * 0.08 : 0.72 + speed * 0.2;
    }

    for (let index = 0; index < this.enginePlumes.length; index += 1) {
      const plume = this.enginePlumes[index];
      const targetLength = 0.84 + speed * 0.68 + turbo * 2.35;
      plume.scale.y += (targetLength - plume.scale.y) * Math.min(1, delta * 13);
      plume.scale.x = 0.88 + turbo * 0.32;
      plume.scale.z = 0.88 + turbo * 0.32;
      plume.material.opacity = 0.36 + speed * 0.22 + turbo * 0.36;
    }
  }

  private updateMissileHeat(state: SkyDancerMissileState, delta: number): void {
    this.activeMissileHeatIds.clear();
    const active = this.activeMissileHeatIds;
    for (const missile of state.missiles) {
      active.add(missile.id);
      let visual = this.missileHeat.get(missile.id);
      if (!visual) {
        visual = this.missileHeatPool.pop() ?? this.createMissileHeat();
        visual.root.name = `sky-dancer-v25-missile-heat-${missile.id}`;
        visual.root.visible = true;
        visual.root.scale.setScalar(missile.sourceKind === "boss" ? 1.22 : 1);
        visual.phase = missile.id * 0.77;
        this.missileHeat.set(missile.id, visual);
      }
      this.positionMissileHeat(visual, missile, delta);
    }

    for (const [id, visual] of this.missileHeat) {
      if (active.has(id)) continue;
      visual.root.visible = false;
      visual.light.intensity = 0;
      this.missileHeatPool.push(visual);
      this.missileHeat.delete(id);
    }
  }

  private prewarmMissileHeat(): void {
    while (this.missileHeatPool.length < 8) {
      const visual = this.createMissileHeat();
      visual.root.visible = false;
      this.missileHeatPool.push(visual);
    }
  }

  private createMissileHeat(): MissileHeatVisual {
    const root = new THREE.Group();
    root.name = "sky-dancer-v25-missile-heat-pooled";
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.2, 1),
      new THREE.MeshBasicMaterial({
        color: 0xfff7dc,
        transparent: true,
        opacity: 0.98,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    core.position.z = -0.96;
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 10, 7),
      new THREE.MeshBasicMaterial({
        color: 0xff6d2d,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    halo.position.z = -1.02;
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.27, 2.15, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xff8a34,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    flame.rotation.x = -Math.PI / 2;
    flame.position.z = -1.86;
    const light = new THREE.PointLight(0xff7a32, 2.3, 9, 2);
    light.position.z = -1.05;
    root.add(core, halo, flame, light);
    this.missileHeatRoot.add(root);
    return { root, core, halo, flame, light, phase: 0 };
  }

  private positionMissileHeat(visual: MissileHeatVisual, missile: SkyDancerMissileSnapshot, delta: number): void {
    visual.phase += delta * 22;
    const danger = THREE.MathUtils.clamp((20 - missile.distanceToPlayer) / 18, 0, 1);
    const pulse = 0.92 + Math.sin(visual.phase) * 0.08;
    visual.root.position.set(missile.x, 1.18, missile.z);
    visual.root.rotation.y = missile.heading;
    visual.core.scale.setScalar(pulse * (1 + danger * 0.28));
    visual.halo.scale.setScalar((1.02 + danger * 0.48) * pulse);
    visual.halo.material.opacity = 0.34 + danger * 0.28;
    const flameWidth = 0.9 + danger * 0.16;
    visual.flame.scale.set(flameWidth, 0.9 + danger * 0.5, flameWidth);
    visual.flame.material.opacity = 0.58 + danger * 0.3;
    visual.light.intensity = 1.8 + danger * 2.5;
  }
}

export { SkyDancerAirCombatFxV25 as SkyDancerAirCombatFx };
