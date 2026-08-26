import * as THREE from "three";
import type { CartArenaSession, CartArenaSessionSnapshot } from "../cart/CartArenaSession";
import type { SkyDancerMissileState } from "./SkyDancerFlightCombat";

export interface SkyDancerFxRuntime {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  session: CartArenaSession & { car: { group: THREE.Group } };
  playerVisual: THREE.Group;
  enemyGroups: Map<string, THREE.Group>;
  resourceGroups: Map<string, THREE.Group>;
  obstacleGroups: Map<string, THREE.Group>;
  gateBars: Map<string, THREE.Mesh>;
  cameraShake: number;
  impactFlash: number;
  impactOverlayMaterial: THREE.MeshBasicMaterial;
  emitImpactSparks(position: THREE.Vector3, count: number): void;
}

interface TrailPoint {
  position: THREE.Vector3;
  age: number;
}

interface FighterTrailState {
  fighter: THREE.Group;
  enemy: boolean;
  boss: boolean;
  resolvedId: string | null;
  wingSpan: number;
  sampleClock: number;
  left: WorldRibbonTrail;
  right: WorldRibbonTrail;
}

interface MissileTrailState {
  trail: WorldRibbonTrail;
  seenThisFrame: boolean;
  sampleClock: number;
  boss: boolean;
}

interface AirBurst {
  root: THREE.Group;
  life: number;
  maxLife: number;
}

interface AnimatedFlame {
  mesh: THREE.Mesh;
  baseOpacity: number;
  phase: number;
  baseLength: number;
}

interface AerialGateVisual {
  root: THREE.Group;
  ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  inner: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  beacon: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
}

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const TMP_A = new THREE.Vector3();
const TMP_B = new THREE.Vector3();
const TMP_TANGENT = new THREE.Vector3();
const TMP_SIDE = new THREE.Vector3();
const MAX_AIR_BURSTS = 6;

class WorldRibbonTrail {
  private readonly points: TrailPoint[] = [];
  private readonly pointPool: TrailPoint[] = [];
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly mesh: THREE.Mesh;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly baseColor: THREE.Color;
  private strength = 1;

  constructor(
    scene: THREE.Scene,
    name: string,
    private readonly maxPoints: number,
    private readonly maxAge: number,
    private readonly width: number,
    color: number,
    opacity: number,
    additive: boolean,
    private readonly riseRate = 0,
    private readonly minSpacing = 0.18,
  ) {
    this.baseColor = new THREE.Color(color);
    this.positions = new Float32Array(maxPoints * 2 * 3);
    this.colors = new Float32Array(maxPoints * 2 * 3);
    const indices: number[] = [];
    for (let index = 0; index < maxPoints - 1; index += 1) {
      const a = index * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, c, c, b, d);
    }
    this.geometry = new THREE.BufferGeometry();
    const positionAttribute = new THREE.BufferAttribute(this.positions, 3);
    const colorAttribute = new THREE.BufferAttribute(this.colors, 3);
    positionAttribute.setUsage(THREE.DynamicDrawUsage);
    colorAttribute.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute("position", positionAttribute);
    this.geometry.setAttribute("color", colorAttribute);
    this.geometry.setIndex(indices);
    this.geometry.setDrawRange(0, 0);
    this.material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = name;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 9 : 7;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  setStrength(value: number): void {
    this.strength = THREE.MathUtils.clamp(value, 0, 1);
  }

  setName(value: string): void {
    this.mesh.name = value;
  }

  addPoint(position: THREE.Vector3): void {
    const last = this.points[this.points.length - 1];
    if (last && last.position.distanceToSquared(position) < this.minSpacing * this.minSpacing) {
      last.position.copy(position);
      last.age = 0;
      return;
    }
    const point = this.pointPool.pop() ?? { position: new THREE.Vector3(), age: 0 };
    point.position.copy(position);
    point.age = 0;
    this.points.push(point);
    while (this.points.length > this.maxPoints) {
      const oldest = this.points.shift();
      if (oldest) this.pointPool.push(oldest);
    }
  }

  clear(): void {
    this.pointPool.push(...this.points);
    this.points.length = 0;
    this.geometry.setDrawRange(0, 0);
    this.mesh.visible = false;
  }

  update(delta: number): void {
    for (const point of this.points) point.age += delta;
    while (this.points.length > 0 && this.points[0].age > this.maxAge) {
      const oldest = this.points.shift();
      if (oldest) this.pointPool.push(oldest);
    }
    this.rebuild();
  }

  isEmpty(): boolean {
    return this.points.length < 2;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }

  private rebuild(): void {
    const count = this.points.length;
    this.mesh.visible = count >= 2 && this.strength > 0.02;
    if (!this.mesh.visible) {
      this.geometry.setDrawRange(0, 0);
      return;
    }

    for (let index = 0; index < count; index += 1) {
      const point = this.points[index];
      const previous = this.points[Math.max(0, index - 1)].position;
      const next = this.points[Math.min(count - 1, index + 1)].position;
      TMP_TANGENT.subVectors(next, previous).normalize();
      TMP_SIDE.crossVectors(TMP_TANGENT, WORLD_UP);
      if (TMP_SIDE.lengthSq() < 0.0001) TMP_SIDE.set(1, 0, 0);
      else TMP_SIDE.normalize();

      const freshness = THREE.MathUtils.clamp(1 - point.age / this.maxAge, 0, 1);
      const width = this.width * (0.45 + freshness * 0.55) * (0.78 + this.strength * 0.22);
      TMP_A.copy(point.position);
      TMP_A.y += point.age * this.riseRate;
      TMP_B.copy(TMP_SIDE).multiplyScalar(width);

      const vertex = index * 2;
      this.positions[(vertex + 0) * 3 + 0] = TMP_A.x - TMP_B.x;
      this.positions[(vertex + 0) * 3 + 1] = TMP_A.y - TMP_B.y;
      this.positions[(vertex + 0) * 3 + 2] = TMP_A.z - TMP_B.z;
      this.positions[(vertex + 1) * 3 + 0] = TMP_A.x + TMP_B.x;
      this.positions[(vertex + 1) * 3 + 1] = TMP_A.y + TMP_B.y;
      this.positions[(vertex + 1) * 3 + 2] = TMP_A.z + TMP_B.z;

      const luminance = (0.08 + freshness * 0.92) * this.strength;
      for (const side of [0, 1]) {
        const offset = (vertex + side) * 3;
        this.colors[offset + 0] = this.baseColor.r * luminance;
        this.colors[offset + 1] = this.baseColor.g * luminance;
        this.colors[offset + 2] = this.baseColor.b * luminance;
      }
    }

    (this.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
    this.geometry.setDrawRange(0, Math.max(0, count - 1) * 6);
  }
}

function rearConeGeometry(radius: number, length: number, segments: number): THREE.ConeGeometry {
  const geometry = new THREE.ConeGeometry(radius, length, segments, 1, true);
  // Bake the cone's Y height axis into -Z. The object can then animate scale.z,
  // which is the actual aircraft fore/aft axis (nose +Z, exhaust -Z).
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function discFacingRear(radius: number, segments: number): THREE.CircleGeometry {
  const geometry = new THREE.CircleGeometry(radius, segments);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

function clipSpaceEdgeMaterial(color: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform vec3 uColor;
      uniform float uOpacity;
      void main() {
        vec2 p = abs(vUv - 0.5) * 2.0;
        float edge = smoothstep(0.34, 1.0, max(p.x, p.y));
        float corner = smoothstep(0.50, 1.18, length(p));
        float alpha = clamp(max(edge * 0.90, corner * 0.64), 0.0, 1.0) * uOpacity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
}

export class SkyDancerAirCombatFxV2 {
  private readonly fighterTrails: FighterTrailState[] = [];
  private readonly missileTrails = new Map<number, MissileTrailState>();
  private readonly normalMissileTrailPool: MissileTrailState[] = [];
  private readonly bossMissileTrailPool: MissileTrailState[] = [];
  private readonly flames: AnimatedFlame[] = [];
  private readonly bursts: AirBurst[] = [];
  private readonly burstPool: AirBurst[] = [];
  private readonly enemyAlive = new Map<string, boolean>();
  private readonly aliveThisFrame = new Map<string, boolean>();
  private readonly obstacleAlive = new Map<string, boolean>();
  private readonly damageRoot = new THREE.Group();
  private readonly damageFire: THREE.Mesh[] = [];
  private readonly damageRing: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  private readonly damageSmokeTrail: WorldRibbonTrail;
  private readonly edgeMaterial = clipSpaceEdgeMaterial(0xff2635);
  private readonly warningMaterial = clipSpaceEdgeMaterial(0xffb029);
  private readonly gateVisuals = new Map<string, AerialGateVisual>();
  private readonly leftTrailPoint = new THREE.Vector3();
  private readonly rightTrailPoint = new THREE.Vector3();
  private readonly missileTrailPoint = new THREE.Vector3();
  private readonly damageTrailPoint = new THREE.Vector3();
  private readonly hitPoint = new THREE.Vector3();
  private readonly burstPoint = new THREE.Vector3();
  private worldQualityApplied = false;
  private elapsed = 0;
  private lastHitSerial = 0;
  private damagePulse = 0;
  private damageSmokeLife = 0;
  private damageSampleClock = 0;
  private hitRoll = 0;

  constructor(private readonly runtime: SkyDancerFxRuntime) {
    this.disableInheritedGroundFx();

    const edge = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.edgeMaterial);
    edge.name = "sky-dancer-hit-vignette-v2";
    edge.frustumCulled = false;
    edge.renderOrder = 10030;
    runtime.camera.add(edge);

    const warning = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.warningMaterial);
    warning.name = "sky-dancer-lock-vignette-v2";
    warning.frustumCulled = false;
    warning.renderOrder = 10029;
    runtime.camera.add(warning);

    this.damageRoot.name = "sky-dancer-damage-root-v2";
    for (const x of [-0.38, 0.38]) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xff5a25,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const fire = new THREE.Mesh(rearConeGeometry(0.24, 1.55, 9), material);
      fire.name = "sky-dancer-damage-fire-v2";
      fire.position.set(x, 0.40, -2.35);
      fire.visible = false;
      this.damageFire.push(fire);
      this.damageRoot.add(fire);
    }
    this.damageRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.55, 0.055, 6, 36),
      new THREE.MeshBasicMaterial({
        color: 0xffd0a1,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.damageRing.rotation.x = Math.PI / 2;
    this.damageRing.position.y = 0.55;
    this.damageRoot.add(this.damageRing);

    this.damageSmokeTrail = new WorldRibbonTrail(
      runtime.scene,
      "sky-dancer-damage-smoke-trail-v2",
      34,
      1.75,
      0.46,
      0x24272d,
      0.52,
      false,
      0.32,
      0.12,
    );
    this.prewarmMissileTrails();
    this.prewarmAirBursts();
  }

  attachPlayerEffects(playerVisual: THREE.Group): void {
    if (this.damageRoot.parent !== playerVisual) playerVisual.add(this.damageRoot);
  }

  decorateFighter(fighter: THREE.Group, enemy: boolean, boss: boolean): void {
    fighter.name = enemy ? "sky-dancer-enemy-fighter-v2" : "sky-dancer-player-fighter-v2";
    const engineX = boss ? 0.48 : 0.34;
    const outerColor = enemy ? (boss ? 0xff4a3c : 0xffa63a) : 0x43d9ff;
    const innerColor = enemy ? 0xffefbd : 0xe8fdff;
    const outerOpacity = enemy ? 0.52 : 0.64;
    const innerOpacity = enemy ? 0.78 : 0.92;

    for (const x of [-engineX, engineX]) {
      const outerMaterial = new THREE.MeshBasicMaterial({
        color: outerColor,
        transparent: true,
        opacity: outerOpacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const outer = new THREE.Mesh(rearConeGeometry(boss ? 0.30 : 0.23, boss ? 2.2 : 1.75, 10), outerMaterial);
      outer.name = "sky-dancer-jet-flame-v2";
      outer.position.set(x, 0.35, boss ? -2.52 : -2.33);
      fighter.add(outer);
      this.flames.push({ mesh: outer, baseOpacity: outerOpacity, phase: this.flames.length * 0.73, baseLength: 1 });

      const innerMaterial = new THREE.MeshBasicMaterial({
        color: innerColor,
        transparent: true,
        opacity: innerOpacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const inner = new THREE.Mesh(rearConeGeometry(boss ? 0.12 : 0.095, boss ? 1.62 : 1.25, 9), innerMaterial);
      inner.name = "sky-dancer-jet-core-v2";
      inner.position.set(x, 0.35, boss ? -2.28 : -2.10);
      fighter.add(inner);
      this.flames.push({ mesh: inner, baseOpacity: innerOpacity, phase: this.flames.length * 0.59, baseLength: 1 });

      const nozzle = new THREE.Mesh(
        discFacingRear(boss ? 0.24 : 0.18, 14),
        new THREE.MeshBasicMaterial({
          color: innerColor,
          transparent: true,
          opacity: enemy ? 0.56 : 0.78,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      nozzle.position.set(x, 0.35, boss ? -1.98 : -1.91);
      fighter.add(nozzle);
    }

    const leftNav = new THREE.Mesh(
      new THREE.SphereGeometry(boss ? 0.10 : 0.075, 8, 5),
      new THREE.MeshBasicMaterial({ color: 0xff3f53, toneMapped: false }),
    );
    const rightNav = new THREE.Mesh(
      new THREE.SphereGeometry(boss ? 0.10 : 0.075, 8, 5),
      new THREE.MeshBasicMaterial({ color: 0x5cffb2, toneMapped: false }),
    );
    leftNav.position.set(boss ? -2.55 : -2.48, 0.28, -0.62);
    rightNav.position.set(boss ? 2.55 : 2.48, 0.28, -0.62);
    fighter.add(leftNav, rightNav);

    const wingSpan = boss ? 2.55 : 2.46;
    const leftTrail = new WorldRibbonTrail(
      this.runtime.scene,
      `sky-dancer-wing-vapor-left-${this.fighterTrails.length}`,
      enemy ? 22 : 30,
      enemy ? 0.90 : 1.25,
      enemy ? 0.055 : 0.072,
      0xf2fbff,
      enemy ? 0.26 : 0.34,
      true,
      0.015,
      0.12,
    );
    const rightTrail = new WorldRibbonTrail(
      this.runtime.scene,
      `sky-dancer-wing-vapor-right-${this.fighterTrails.length}`,
      enemy ? 22 : 30,
      enemy ? 0.90 : 1.25,
      enemy ? 0.055 : 0.072,
      0xf2fbff,
      enemy ? 0.26 : 0.34,
      true,
      0.015,
      0.12,
    );
    this.fighterTrails.push({
      fighter,
      enemy,
      boss,
      resolvedId: enemy ? null : "player",
      wingSpan,
      sampleClock: 0,
      left: leftTrail,
      right: rightTrail,
    });
  }

  decorateMissile(group: THREE.Group, boss: boolean): void {
    const flameMaterial = new THREE.MeshBasicMaterial({
      color: boss ? 0xff7a35 : 0xffc04d,
      transparent: true,
      opacity: boss ? 0.88 : 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const flame = new THREE.Mesh(rearConeGeometry(boss ? 0.23 : 0.18, boss ? 1.55 : 1.25, 9), flameMaterial);
    flame.name = "sky-dancer-missile-flame-v2";
    flame.position.z = boss ? -1.48 : -1.18;
    group.add(flame);
    this.flames.push({ mesh: flame, baseOpacity: flameMaterial.opacity, phase: this.flames.length * 0.67, baseLength: 1 });

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(boss ? 0.40 : 0.31, 0.04, 5, 20),
      new THREE.MeshBasicMaterial({
        color: boss ? 0xff3557 : 0xffc04d,
        transparent: true,
        opacity: 0.54,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    halo.name = "sky-dancer-missile-halo";
    halo.rotation.x = Math.PI / 2;
    halo.position.z = boss ? 0.82 : 0.66;
    group.add(halo);
  }

  update(snapshot: CartArenaSessionSnapshot, missiles: SkyDancerMissileState, delta: number): void {
    this.elapsed += delta;
    if (!this.worldQualityApplied) this.applyWorldQualityPass();

    this.damagePulse = Math.max(0, this.damagePulse - delta * 1.65);
    this.damageSmokeLife = Math.max(0, this.damageSmokeLife - delta);
    this.hitRoll *= Math.max(0, 1 - delta * 4.1);

    for (const flame of this.flames) {
      const flicker = 0.92
        + Math.sin(this.elapsed * 31 + flame.phase) * 0.08
        + Math.sin(this.elapsed * 53 + flame.phase * 1.7) * 0.035;
      // V2 geometry is baked along Z, so scale.z now changes flame LENGTH.
      flame.mesh.scale.z = flame.baseLength * flicker;
      (flame.mesh.material as THREE.MeshBasicMaterial).opacity = flame.baseOpacity * (0.94 + Math.sin(this.elapsed * 37 + flame.phase) * 0.06);
    }

    this.updateFighterTrails(snapshot, delta);
    this.updateMissileTrails(missiles, delta);
    this.updateDamageTrail(delta);
    this.updateDamagePresentation();
    this.updateEnemyDestruction(snapshot);
    this.updateObstacleDestruction(snapshot);
    this.updateBursts(delta);
    this.updateAerialGates(snapshot);

    const closest = missiles.missiles.reduce((value, missile) => Math.min(value, missile.distanceToPlayer), Number.POSITIVE_INFINITY);
    const proximity = Number.isFinite(closest) ? THREE.MathUtils.clamp((18 - closest) / 16, 0, 1) : 0;
    const warningStrength = missiles.incomingCount > 0
      ? THREE.MathUtils.clamp(0.22 + proximity * 0.74 + Math.sin(this.elapsed * 10.5) * 0.08, 0, 1)
      : 0;
    this.warningMaterial.uniforms.uOpacity.value = warningStrength * 0.20;

    if (missiles.hitSerial > this.lastHitSerial) {
      this.lastHitSerial = missiles.hitSerial;
      this.triggerMissileHit(missiles);
    }
  }

  getCameraRollImpulse(): number {
    return this.hitRoll;
  }

  private disableInheritedGroundFx(): void {
    const view = this.runtime as unknown as Record<string, unknown>;
    for (const method of ["emitDust", "emitWallSparks", "spawnDebris", "spawnImpact", "updatePetals"]) {
      if (typeof view[method] === "function") view[method] = () => undefined;
    }
  }

  private resolveFighterId(state: FighterTrailState): string | null {
    if (state.resolvedId) return state.resolvedId;
    for (const [id, group] of this.runtime.enemyGroups) {
      if (state.fighter.parent === group || group.children.includes(state.fighter)) {
        state.resolvedId = id;
        return id;
      }
    }
    return null;
  }

  private updateFighterTrails(snapshot: CartArenaSessionSnapshot, delta: number): void {
    this.aliveThisFrame.clear();
    for (const enemy of snapshot.enemies) this.aliveThisFrame.set(enemy.id, enemy.alive);
    for (const state of this.fighterTrails) {
      state.left.update(delta);
      state.right.update(delta);
      const id = this.resolveFighterId(state);
      const active = id === "player" || (id ? this.aliveThisFrame.get(id) === true : false);
      if (!active || !state.fighter.parent?.visible) {
        state.left.setStrength(0);
        state.right.setStrength(0);
        continue;
      }

      const parentBank = Math.abs(state.fighter.parent.rotation.z);
      const playerBoost = !state.enemy && snapshot.boostActive;
      const condensation = THREE.MathUtils.clamp(
        (parentBank - 0.07) * (state.enemy ? 2.7 : 3.4) + (playerBoost ? 0.48 : 0) + (state.boss ? 0.06 : 0),
        0,
        1,
      );
      state.left.setStrength(condensation);
      state.right.setStrength(condensation);
      if (condensation < 0.08) continue;

      state.sampleClock -= delta;
      if (state.sampleClock > 0) continue;
      state.sampleClock = state.enemy ? 0.055 : 0.038;
      state.fighter.updateWorldMatrix(true, false);
      this.leftTrailPoint.set(-state.wingSpan, 0.29, -0.58);
      this.rightTrailPoint.set(state.wingSpan, 0.29, -0.58);
      state.fighter.localToWorld(this.leftTrailPoint);
      state.fighter.localToWorld(this.rightTrailPoint);
      state.left.addPoint(this.leftTrailPoint);
      state.right.addPoint(this.rightTrailPoint);
    }
  }

  private updateMissileTrails(missiles: SkyDancerMissileState, delta: number): void {
    for (const state of this.missileTrails.values()) state.seenThisFrame = false;
    for (const missile of missiles.missiles) {
      let state = this.missileTrails.get(missile.id);
      if (!state) {
        const boss = missile.sourceKind === "boss";
        state = (boss ? this.bossMissileTrailPool : this.normalMissileTrailPool).pop()
          ?? this.createMissileTrailState(boss, missile.id);
        state.trail.clear();
        state.trail.setName(`sky-dancer-missile-smoke-${missile.id}`);
        state.seenThisFrame = true;
        state.sampleClock = 0;
        this.missileTrails.set(missile.id, state);
      }
      state.seenThisFrame = true;
      state.trail.setStrength(1);
      state.sampleClock -= delta;
      if (state.sampleClock <= 0) {
        state.sampleClock = 0.025;
        this.missileTrailPoint.set(missile.x, 1.18, missile.z);
        state.trail.addPoint(this.missileTrailPoint);
      }
    }

    for (const [id, state] of this.missileTrails) {
      if (!state.seenThisFrame) state.trail.setStrength(0.72);
      state.trail.update(delta);
      if (!state.seenThisFrame && state.trail.isEmpty()) {
        state.trail.clear();
        (state.boss ? this.bossMissileTrailPool : this.normalMissileTrailPool).push(state);
        this.missileTrails.delete(id);
      }
    }
  }

  private prewarmMissileTrails(): void {
    while (this.normalMissileTrailPool.length < 8) {
      this.normalMissileTrailPool.push(this.createMissileTrailState(false, this.normalMissileTrailPool.length));
    }
    while (this.bossMissileTrailPool.length < 3) {
      this.bossMissileTrailPool.push(this.createMissileTrailState(true, this.bossMissileTrailPool.length));
    }
  }

  private createMissileTrailState(boss: boolean, serial: number): MissileTrailState {
    return {
      trail: new WorldRibbonTrail(
        this.runtime.scene,
        `sky-dancer-missile-smoke-pool-${boss ? "boss" : "normal"}-${serial}`,
        boss ? 34 : 28,
        boss ? 0.90 : 0.72,
        boss ? 0.23 : 0.17,
        boss ? 0xdccdc6 : 0xe9eef1,
        boss ? 0.56 : 0.46,
        false,
        0.10,
        0.10,
      ),
      seenThisFrame: false,
      sampleClock: 0,
      boss,
    };
  }

  private updateDamageTrail(delta: number): void {
    this.damageSmokeTrail.update(delta);
    this.damageSmokeTrail.setStrength(THREE.MathUtils.clamp(this.damageSmokeLife / 0.8, 0, 1));
    if (this.damageSmokeLife <= 0) return;
    this.damageSampleClock -= delta;
    if (this.damageSampleClock > 0) return;
    this.damageSampleClock = 0.042;
    const player = this.fighterTrails.find((state) => !state.enemy)?.fighter;
    if (!player) return;
    player.updateWorldMatrix(true, false);
    const side = this.lastHitSerial % 2 === 0 ? -0.38 : 0.38;
    this.damageTrailPoint.set(side, 0.46, -1.82);
    player.localToWorld(this.damageTrailPoint);
    this.damageSmokeTrail.addPoint(this.damageTrailPoint);
  }

  private triggerMissileHit(missiles: SkyDancerMissileState): void {
    this.hitPoint.set(missiles.lastHitX, 1.15, missiles.lastHitZ);
    this.runtime.emitImpactSparks(this.hitPoint, 34);
    this.runtime.cameraShake = Math.max(this.runtime.cameraShake, 1.42);
    this.runtime.impactFlash = Math.max(this.runtime.impactFlash, 1);
    this.runtime.impactOverlayMaterial.color.setHex(0xff3d2c);
    this.damagePulse = 1;
    this.damageSmokeLife = Math.max(this.damageSmokeLife, 2.35);
    this.damageSampleClock = 0;
    this.hitRoll = (missiles.hitSerial % 2 === 0 ? -1 : 1) * 0.245;
    this.spawnAirBurst(this.hitPoint, 0xff6a2d, 1.65, true);
  }

  private updateDamagePresentation(): void {
    const pulse = this.damagePulse;
    this.edgeMaterial.uniforms.uOpacity.value = pulse * (0.64 + Math.sin(this.elapsed * 34) * 0.07);
    this.damageRoot.visible = this.damageSmokeLife > 0 || pulse > 0.001;
    const smokeStrength = THREE.MathUtils.clamp(this.damageSmokeLife / 1.8, 0, 1);

    for (let index = 0; index < this.damageFire.length; index += 1) {
      const fire = this.damageFire[index];
      const activeEngine = index === (this.lastHitSerial % 2);
      fire.visible = activeEngine && this.damageSmokeLife > 0.35;
      const material = fire.material as THREE.MeshBasicMaterial;
      material.opacity = fire.visible ? smokeStrength * (0.54 + Math.sin(this.elapsed * 42) * 0.18) : 0;
      fire.scale.z = 0.78 + Math.sin(this.elapsed * 35 + index) * 0.18;
    }

    this.damageRing.material.opacity = pulse * 0.78;
    this.damageRing.scale.setScalar(0.82 + (1 - pulse) * 3.4);
  }

  private updateEnemyDestruction(snapshot: CartArenaSessionSnapshot): void {
    for (const enemy of snapshot.enemies) {
      const previous = this.enemyAlive.get(enemy.id);
      if (previous === true && !enemy.alive) {
        const group = this.runtime.enemyGroups.get(enemy.id);
        if (group) {
          this.burstPoint.copy(group.position);
          this.burstPoint.y = Math.max(1.15, this.burstPoint.y + 0.45);
          this.spawnAirBurst(this.burstPoint, enemy.kind === "boss" ? 0xff3e55 : 0xffa13a, enemy.kind === "boss" ? 2.4 : 1.25, false);
        }
      }
      this.enemyAlive.set(enemy.id, enemy.alive);
    }
  }

  private updateObstacleDestruction(snapshot: CartArenaSessionSnapshot): void {
    for (const obstacle of snapshot.obstacles) {
      const alive = !obstacle.destroyed;
      const previous = this.obstacleAlive.get(obstacle.id);
      if (previous === true && !alive) {
        const group = this.runtime.obstacleGroups.get(obstacle.id);
        if (group) {
          this.burstPoint.copy(group.position);
          this.burstPoint.y = 0.9;
          this.spawnAirBurst(this.burstPoint, 0x63dfff, 0.82, false);
        }
      }
      this.obstacleAlive.set(obstacle.id, alive);
    }
  }

  private spawnAirBurst(position: THREE.Vector3, color: number, scale: number, playerHit: boolean): void {
    if (this.bursts.length >= MAX_AIR_BURSTS) {
      const oldest = this.bursts.shift();
      if (oldest) this.releaseAirBurst(oldest);
    }
    const burst = this.burstPool.pop() ?? this.createAirBurst();
    const root = burst.root;
    burst.life = playerHit ? 0.86 : 0.72;
    burst.maxLife = burst.life;
    root.name = playerHit ? "sky-dancer-player-hit-burst-v2" : "sky-dancer-air-burst-v2";
    root.position.copy(position);
    root.scale.setScalar(scale);
    root.visible = true;
    for (const object of root.children) {
      if (!(object instanceof THREE.Mesh)) continue;
      object.position.set(0, 0, 0);
      object.scale.setScalar(1);
      const material = object.material as THREE.MeshBasicMaterial;
      if (object.name === "burst-core") {
        material.color.setHex(0xfff2c6);
        material.opacity = 1;
      } else if (object.name === "burst-hot") {
        material.color.setHex(color);
        material.opacity = 0.88;
      } else if (object.name.startsWith("burst-ring")) {
        material.color.setHex(0xfff2c6);
        material.opacity = 1;
      } else if (object.name === "burst-streak") {
        material.color.setHex(color);
        material.opacity = 0.88;
      } else if (object.name === "burst-smoke") {
        material.color.setHex(0x34363b);
        material.opacity = 0.34;
      }
    }
    this.bursts.push(burst);
  }

  private prewarmAirBursts(): void {
    while (this.burstPool.length < MAX_AIR_BURSTS) this.burstPool.push(this.createAirBurst());
  }

  private createAirBurst(): AirBurst {
    const root = new THREE.Group();
    root.name = "sky-dancer-air-burst-pool-v2";
    root.visible = false;

    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xfff2c6,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const hotMat = new THREE.MeshBasicMaterial({
      color: 0xffa13a,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const smokeMat = new THREE.MeshBasicMaterial({ color: 0x34363b, transparent: true, opacity: 0.34, depthWrite: false });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), coreMat);
    core.name = "burst-core";
    root.add(core);
    const hot = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 1), hotMat);
    hot.name = "burst-hot";
    root.add(hot);

    for (let ringIndex = 0; ringIndex < 2; ringIndex += 1) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.055, 5, 32), coreMat.clone());
      ring.name = `burst-ring-${ringIndex}`;
      ring.rotation.set(ringIndex === 0 ? Math.PI / 2 : 0.42, ringIndex === 0 ? 0 : 0.58, ringIndex * 0.4);
      root.add(ring);
    }

    for (let index = 0; index < 12; index += 1) {
      const streak = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 1.2 + index % 4 * 0.32), hotMat.clone());
      streak.name = "burst-streak";
      const angle = index / 12 * Math.PI * 2;
      streak.rotation.set((index % 3 - 1) * 0.42, angle, (index % 2 ? 1 : -1) * 0.18);
      streak.userData.angle = angle;
      streak.userData.lift = (index % 3 - 1) * 0.24;
      root.add(streak);
    }

    for (let index = 0; index < 8; index += 1) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 0), smokeMat.clone());
      puff.name = "burst-smoke";
      const angle = index / 8 * Math.PI * 2;
      puff.userData.angle = angle;
      puff.userData.index = index;
      root.add(puff);
    }

    this.runtime.scene.add(root);
    return { root, life: 0, maxLife: 0.72 };
  }

  private updateBursts(delta: number): void {
    for (let index = this.bursts.length - 1; index >= 0; index -= 1) {
      const burst = this.bursts[index];
      burst.life -= delta;
      const ratio = THREE.MathUtils.clamp(burst.life / burst.maxLife, 0, 1);
      const progress = 1 - ratio;
      burst.root.children.forEach((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        if (object.name === "burst-core") {
          object.scale.setScalar(0.65 + progress * 2.5);
          (object.material as THREE.MeshBasicMaterial).opacity = ratio;
        } else if (object.name === "burst-hot") {
          object.scale.setScalar(0.72 + progress * 2.1);
          (object.material as THREE.MeshBasicMaterial).opacity = ratio * 0.72;
        } else if (object.name.startsWith("burst-ring")) {
          object.scale.setScalar(0.7 + progress * 4.2);
          (object.material as THREE.MeshBasicMaterial).opacity = ratio * 0.68;
        } else if (object.name === "burst-streak") {
          const angle = Number(object.userData.angle ?? 0);
          const distance = progress * 5.8;
          object.position.set(Math.sin(angle) * distance, Number(object.userData.lift ?? 0) * distance, Math.cos(angle) * distance);
          object.scale.z = 0.65 + ratio * 0.9;
          (object.material as THREE.MeshBasicMaterial).opacity = ratio * 0.82;
        } else if (object.name === "burst-smoke") {
          const angle = Number(object.userData.angle ?? 0);
          const puffIndex = Number(object.userData.index ?? 0);
          object.position.set(Math.sin(angle) * progress * 2.6, progress * (0.7 + puffIndex % 3 * 0.22), Math.cos(angle) * progress * 2.6);
          object.scale.setScalar(0.7 + progress * 2.1);
          (object.material as THREE.MeshBasicMaterial).opacity = ratio * 0.30;
        }
      });
      if (burst.life <= 0) {
        this.releaseAirBurst(burst);
        this.bursts.splice(index, 1);
      }
    }
  }

  private releaseAirBurst(burst: AirBurst): void {
    burst.life = 0;
    burst.root.visible = false;
    this.burstPool.push(burst);
  }

  private applyWorldQualityPass(): void {
    this.worldQualityApplied = true;
    const runtime = this.runtime;

    // Remove all inherited car/ground visuals attached directly to the vehicle;
    // the Sky fighter lives in playerVisual and keeps the actual gameplay transform.
    for (const child of runtime.session.car.group.children) {
      if (child !== runtime.playerVisual) child.visible = false;
    }

    const snapshot = runtime.session.snapshot();
    const resources = new Map(snapshot.resources.map((resource) => [resource.id, resource]));
    for (const [id, group] of runtime.resourceGroups) {
      const resource = resources.get(id);
      if (!resource) continue;
      group.clear();
      const cyan = resource.kind === "turbo";
      const coreMat = new THREE.MeshStandardMaterial({
        color: cyan ? 0x67dbff : 0xffb14a,
        emissive: cyan ? 0x0c7398 : 0x7d3512,
        emissiveIntensity: 0.9,
        roughness: 0.34,
        metalness: 0.18,
        flatShading: true,
      });
      const glowMat = new THREE.MeshBasicMaterial({
        color: cyan ? 0x9cecff : 0xffd07a,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const core = new THREE.Mesh(cyan ? new THREE.OctahedronGeometry(0.72, 0) : new THREE.CapsuleGeometry(0.42, 0.72, 4, 8), coreMat);
      core.position.y = 0.85;
      group.add(core);
      for (const radius of [1.0, 1.35]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.045, 5, 28), glowMat.clone());
        ring.position.y = 0.85;
        ring.rotation.x = Math.PI / 2 + (radius > 1 ? 0.5 : 0);
        ring.rotation.z = radius > 1 ? 0.35 : 0;
        group.add(ring);
      }
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.12, 4.2, 7, 1, true), glowMat.clone());
      beam.position.y = -0.8;
      group.add(beam);
    }

    const obstacles = new Map(snapshot.obstacles.map((obstacle) => [obstacle.id, obstacle]));
    for (const [id, group] of runtime.obstacleGroups) {
      const obstacle = obstacles.get(id);
      if (!obstacle) continue;
      group.clear();
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x3c4650, roughness: 0.58, metalness: 0.44, flatShading: true });
      const hotMat = new THREE.MeshBasicMaterial({ color: 0xff7a42, transparent: true, opacity: 0.82, toneMapped: false });
      const core = new THREE.Mesh(new THREE.DodecahedronGeometry(obstacle.scale * 0.58, 0), darkMat);
      core.position.y = 0.85;
      group.add(core);
      for (let arm = 0; arm < 4; arm += 1) {
        const angle = arm * Math.PI / 2 + 0.35;
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, obstacle.scale * 1.4), darkMat);
        strut.position.set(Math.sin(angle) * obstacle.scale * 0.48, 0.85, Math.cos(angle) * obstacle.scale * 0.48);
        strut.rotation.y = angle;
        group.add(strut);
        const light = new THREE.Mesh(new THREE.SphereGeometry(0.11, 7, 5), hotMat.clone());
        light.position.set(Math.sin(angle) * obstacle.scale * 1.12, 0.85, Math.cos(angle) * obstacle.scale * 1.12);
        group.add(light);
      }
      const warningRing = new THREE.Mesh(
        new THREE.TorusGeometry(obstacle.scale * 1.16, 0.055, 5, 28),
        new THREE.MeshBasicMaterial({ color: 0x65e8ff, transparent: true, opacity: 0.46, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
      );
      warningRing.position.y = 0.85;
      warningRing.rotation.x = Math.PI / 2;
      group.add(warningRing);
    }

    for (const [nodeId, bar] of runtime.gateBars) {
      let oldRoot: THREE.Object3D = bar;
      while (oldRoot.parent && oldRoot.parent !== runtime.scene) oldRoot = oldRoot.parent;
      oldRoot.visible = false;
      const root = new THREE.Group();
      root.name = `sky-dancer-air-gate-${nodeId}`;
      root.position.set(0, 1.15, bar.position.z);
      const material = new THREE.MeshBasicMaterial({ color: 0xff5e6f, transparent: true, opacity: 0.66, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const innerMaterial = material.clone();
      innerMaterial.opacity = 0.28;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(6.35, 0.10, 6, 48), material);
      const inner = new THREE.Mesh(new THREE.TorusGeometry(5.72, 0.035, 5, 48), innerMaterial);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.20, 8, 6), material.clone());
      beacon.position.y = 6.35;
      root.add(ring, inner, beacon);
      for (const x of [-7.1, 7.1]) {
        const marker = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.8, 0.16), material.clone());
        marker.position.x = x;
        root.add(marker);
      }
      runtime.scene.add(root);
      this.gateVisuals.set(nodeId, { root, ring, inner, beacon });
    }

    for (const object of runtime.scene.children) {
      if (!(object instanceof THREE.LineSegments)) continue;
      const material = object.material;
      if (material instanceof THREE.LineBasicMaterial && material.transparent && material.opacity <= 0.2) {
        material.opacity = Math.min(material.opacity, 0.045);
      }
    }
  }

  private updateAerialGates(snapshot: CartArenaSessionSnapshot): void {
    for (const [nodeId, visual] of this.gateVisuals) {
      const locked = nodeId === "arena-01" ? snapshot.arena1GateLocked : nodeId === "arena-02" ? snapshot.arena2GateLocked : false;
      const color = locked ? 0xff566b : 0x69e7ff;
      visual.ring.material.color.setHex(color);
      visual.inner.material.color.setHex(color);
      visual.beacon.material.color.setHex(color);
      const pulse = 1 + Math.sin(this.elapsed * (locked ? 5.5 : 2.8)) * (locked ? 0.035 : 0.018);
      visual.ring.scale.setScalar(pulse);
      visual.beacon.scale.setScalar(0.85 + (Math.sin(this.elapsed * 7) * 0.5 + 0.5) * 0.5);
      visual.root.rotation.z = Math.sin(this.elapsed * 0.55) * 0.012;
    }
  }
}

export { SkyDancerAirCombatFxV2 as SkyDancerAirCombatFx };
