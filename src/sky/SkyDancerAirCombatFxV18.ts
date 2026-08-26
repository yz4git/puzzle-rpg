import * as THREE from "three";
import type { CartArenaSessionSnapshot, CartEnemySnapshot } from "../cart/CartArenaSession";
import type { SkyDancerMissileState } from "./SkyDancerFlightCombat";
import { SkyDancerAirCombatFxV17 } from "./SkyDancerAirCombatFxV17";
import type { SkyDancerFxRuntime } from "./SkyDancerAirCombatFxV2";

interface VerticalState {
  y: number;
  verticalSpeed: number;
  phase: number;
}

const STREAMED_SCENERY_DROP = 3.2;
const HIGHRISE_SCALE = 0.9;
const FLIGHT_DEBUG_KEY = "__skyDancerGetFlightDebug";

export class SkyDancerAirCombatFxV18 extends SkyDancerAirCombatFxV17 {
  private readonly runtimeV18: SkyDancerFxRuntime;
  private readonly enemyVertical = new Map<string, VerticalState>();
  private readonly missileWarningRoot = new THREE.Group();
  private readonly missileWarningRing: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  private builtV18 = false;
  private elapsedV18 = 0;

  constructor(runtime: SkyDancerFxRuntime) {
    super(runtime);
    this.runtimeV18 = runtime;
    this.missileWarningRoot.name = "sky-dancer-v18-missile-warning";
    this.missileWarningRoot.position.set(0, 0.03, -0.62);
    this.missileWarningRoot.visible = false;

    const warningMaterial = new THREE.MeshBasicMaterial({
      color: 0xffb84d,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.missileWarningRing = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.008, 4, 28), warningMaterial);
    this.missileWarningRing.renderOrder = 1200;
    this.missileWarningRoot.add(this.missileWarningRing);
    for (let index = 0; index < 4; index += 1) {
      const marker = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.012, 0.004), warningMaterial.clone());
      const angle = index * Math.PI * 0.5;
      marker.position.set(Math.cos(angle) * 0.205, Math.sin(angle) * 0.205, 0);
      marker.rotation.z = angle;
      marker.renderOrder = 1200;
      this.missileWarningRoot.add(marker);
    }
    runtime.camera.add(this.missileWarningRoot);
  }

  override update(snapshot: CartArenaSessionSnapshot, missiles: SkyDancerMissileState, delta: number): void {
    super.update(snapshot, missiles, delta);
    this.elapsedV18 += delta;
    if (!this.builtV18) {
      this.builtV18 = true;
      this.correctStreamedCityClearance();
    }
    this.updateEnemyThreeDimensionalFlight(snapshot.enemies, snapshot, delta);
    this.updateMissileWarning(missiles, delta);
    this.publishFlightDebug(snapshot);
  }

  private correctStreamedCityClearance(): void {
    const root = this.runtimeV18.scene.getObjectByName("sky-dancer-q16-streamed-scenery");
    if (!root) return;
    // V17 lowered fixed scenery but the streamed V16 root was not matched by
    // its name filter. Align it with the same 88m presentation flight level.
    root.position.y -= STREAMED_SCENERY_DROP;

    const buildings = root.getObjectByName("sky-dancer-q16-city-blocks");
    if (buildings instanceof THREE.InstancedMesh) {
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      for (let index = 0; index < buildings.count; index += 1) {
        buildings.getMatrixAt(index, matrix);
        matrix.decompose(position, quaternion, scale);
        const oldHeight = scale.y;
        const newHeight = oldHeight * HIGHRISE_SCALE;
        position.y -= (oldHeight - newHeight) * 0.5;
        scale.y = newHeight;
        matrix.compose(position, quaternion, scale);
        buildings.setMatrixAt(index, matrix);
      }
      buildings.instanceMatrix.needsUpdate = true;
    }

    const roofs = root.getObjectByName("sky-dancer-q16-city-roofs");
    if (roofs instanceof THREE.InstancedMesh) {
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      for (let index = 0; index < roofs.count; index += 1) {
        roofs.getMatrixAt(index, matrix);
        matrix.decompose(position, quaternion, scale);
        position.y -= 1.15;
        matrix.compose(position, quaternion, scale);
        roofs.setMatrixAt(index, matrix);
      }
      roofs.instanceMatrix.needsUpdate = true;
    }
  }

  private updateEnemyThreeDimensionalFlight(
    enemies: readonly CartEnemySnapshot[],
    snapshot: CartArenaSessionSnapshot,
    delta: number,
  ): void {
    const active = new Set<string>();
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const group = this.runtimeV18.enemyGroups.get(enemy.id);
      if (!group) continue;
      active.add(enemy.id);
      let state = this.enemyVertical.get(enemy.id);
      if (!state) {
        let hash = 0;
        for (let index = 0; index < enemy.id.length; index += 1) hash = (hash * 31 + enemy.id.charCodeAt(index)) >>> 0;
        state = { y: group.position.y, verticalSpeed: 0, phase: (hash % 1000) / 1000 * Math.PI * 2 };
        this.enemyVertical.set(enemy.id, state);
      }

      const distance = Math.hypot(enemy.x - snapshot.x, enemy.z - snapshot.z);
      const side = Math.sin(state.phase) >= 0 ? 1 : -1;
      const baseY = enemy.kind === "boss" ? 1.9 : enemy.kind === "heavy" ? 1.48 : 1.22;
      const cruiseWave = Math.sin(this.elapsedV18 * 0.92 + state.phase) * (enemy.kind === "boss" ? 0.24 : 0.42);
      const closeManeuver = distance < 28
        ? (1 - distance / 28) * (enemy.kind === "heavy" || enemy.kind === "boss" ? 0.72 : 1.25) * side
        : 0;
      const breakClimb = distance < 17 ? (17 - distance) * 0.055 : 0;
      const targetY = baseY + cruiseWave + closeManeuver + breakClimb;
      const previousY = state.y;
      const blend = 1 - Math.exp(-delta * 2.3);
      state.y += (targetY - state.y) * blend;
      state.verticalSpeed = (state.y - previousY) / Math.max(0.001, delta);
      group.position.y = state.y;

      const pitchFromClimb = THREE.MathUtils.clamp(-state.verticalSpeed * 0.045, -0.22, 0.22);
      group.rotation.x += (pitchFromClimb - group.rotation.x) * (1 - Math.exp(-delta * 4.1));
      const maneuverBank = THREE.MathUtils.clamp(side * closeManeuver * 0.42, -0.55, 0.55);
      if (Math.abs(maneuverBank) > Math.abs(group.rotation.z) * 0.45) {
        group.rotation.z += (maneuverBank - group.rotation.z) * (1 - Math.exp(-delta * 3.6));
      }
    }
    for (const id of this.enemyVertical.keys()) if (!active.has(id)) this.enemyVertical.delete(id);
  }

  private updateMissileWarning(missiles: SkyDancerMissileState, delta: number): void {
    let nearest = Number.POSITIVE_INFINITY;
    for (const missile of missiles.missiles) nearest = Math.min(nearest, missile.distanceToPlayer);
    const threat = Number.isFinite(nearest) && nearest < 30;
    this.missileWarningRoot.visible = threat;
    if (!threat) return;

    const strength = THREE.MathUtils.clamp((30 - nearest) / 25, 0.12, 1);
    const urgent = nearest < 12;
    const color = urgent ? 0xff554d : 0xffbd55;
    const pulse = 0.85 + Math.sin(this.elapsedV18 * (urgent ? 19 : 11)) * 0.15;
    this.missileWarningRoot.rotation.z += delta * (urgent ? 1.8 : 0.8);
    this.missileWarningRoot.scale.setScalar(0.9 + strength * 0.2 + pulse * 0.05);
    for (const child of this.missileWarningRoot.children) {
      if (!(child instanceof THREE.Mesh)) continue;
      const material = child.material as THREE.MeshBasicMaterial;
      material.color.setHex(color);
      material.opacity = 0.28 + strength * 0.68 * pulse;
    }
  }

  private publishFlightDebug(snapshot: CartArenaSessionSnapshot): void {
    if (typeof window === "undefined") return;
    let minEnemyDistance = Number.POSITIVE_INFINITY;
    let minEnemyY = Number.POSITIVE_INFINITY;
    let maxEnemyY = Number.NEGATIVE_INFINITY;
    for (const enemy of snapshot.enemies) {
      if (!enemy.alive) continue;
      minEnemyDistance = Math.min(minEnemyDistance, Math.hypot(enemy.x - snapshot.x, enemy.z - snapshot.z));
      const group = this.runtimeV18.enemyGroups.get(enemy.id);
      if (group) {
        minEnemyY = Math.min(minEnemyY, group.position.y);
        maxEnemyY = Math.max(maxEnemyY, group.position.y);
      }
    }
    (window as unknown as Record<string, unknown>)[FLIGHT_DEBUG_KEY] = () => ({
      forwardVelocity: this.runtimeV18.session.car.forwardVelocity,
      lateralVelocity: this.runtimeV18.session.car.lateralVelocity,
      speed: this.runtimeV18.session.snapshot().speed,
      x: snapshot.x,
      z: snapshot.z,
      altitudeMeters: this.runtimeV18.scene.userData.skyDancerAltitudeMeters,
      minEnemyDistance: Number.isFinite(minEnemyDistance) ? minEnemyDistance : null,
      enemyVerticalSpread: Number.isFinite(minEnemyY) && Number.isFinite(maxEnemyY) ? maxEnemyY - minEnemyY : 0,
    });
  }
}

export { SkyDancerAirCombatFxV18 as SkyDancerAirCombatFx };
