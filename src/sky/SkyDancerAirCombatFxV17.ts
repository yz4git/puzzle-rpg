import * as THREE from "three";
import type { CartArenaSessionSnapshot, CartEnemySnapshot } from "../cart/CartArenaSession";
import type { SkyDancerMissileState } from "./SkyDancerFlightCombat";
import { SkyDancerAirCombatFxV16 } from "./SkyDancerAirCombatFxV16";
import type { SkyDancerFxRuntime } from "./SkyDancerAirCombatFxV2";
import { installSkyDancerFlightDynamics } from "./SkyDancerFlightDynamics";

interface EnemyPoseState {
  x: number;
  z: number;
  heading: number;
  speed: number;
}

interface RuntimeV17 extends SkyDancerFxRuntime {
  enemyGroups: Map<string, THREE.Group>;
}

const ALTITUDE_LIFT_METERS = 88;
const LANDSCAPE_DROP = 3.2;
const FLIGHT_DEBUG_KEY = "__skyDancerGetFlightDebug";

/**
 * V17 restores a little clearance over V16's city while making enemy motion
 * read as aircraft flight instead of direct top-down sliding.
 */
export class SkyDancerAirCombatFxV17 extends SkyDancerAirCombatFxV16 {
  private readonly runtimeV17: RuntimeV17;
  private builtV17 = false;
  private readonly enemyPose = new Map<string, EnemyPoseState>();
  private elapsedV17 = 0;

  constructor(runtime: SkyDancerFxRuntime) {
    super(runtime);
    this.runtimeV17 = runtime as RuntimeV17;
    // Install after the inherited combat/doctrine patches so this wrapper is
    // the final authority over Turbo thrust preservation and enemy inertia.
    installSkyDancerFlightDynamics();
    if (typeof window !== "undefined") {
      (window as unknown as Record<string, unknown>)[FLIGHT_DEBUG_KEY] = () => ({
        forwardVelocity: runtime.session.car.forwardVelocity,
        lateralVelocity: runtime.session.car.lateralVelocity,
        speed: runtime.session.snapshot().speed,
        altitudeMeters: runtime.scene.userData.skyDancerAltitudeMeters,
      });
    }
  }

  override update(snapshot: CartArenaSessionSnapshot, missiles: SkyDancerMissileState, delta: number): void {
    super.update(snapshot, missiles, delta);
    this.elapsedV17 += delta;
    if (!this.builtV17) {
      this.builtV17 = true;
      this.raiseFlightLevelSlightly();
    }
    this.updateEnemyFlightPose(snapshot.enemies, snapshot, delta);
  }

  private raiseFlightLevelSlightly(): void {
    const scene = this.runtimeV17.scene;
    const landscapeWords = [
      "terrain", "field", "road", "river", "city", "mountain", "town",
      "hedgerow", "highway", "landmark", "settlement", "tree", "roof",
      "infrastructure", "scenery", "canal", "industrial", "ground",
    ];
    for (const object of scene.children) {
      if (object.name === "sky-dancer-q5-cloud-banks") continue;
      if (!landscapeWords.some((word) => object.name.includes(word))) continue;
      object.position.y -= LANDSCAPE_DROP;
    }
    scene.userData.skyDancerAltitudeMeters = ALTITUDE_LIFT_METERS;
    scene.userData.verticalRenderScaleMetersPerUnit = ALTITUDE_LIFT_METERS / 28.7;
    scene.fog = new THREE.Fog(0xd4e5e9, 190, 625);
  }

  private updateEnemyFlightPose(
    enemies: readonly CartEnemySnapshot[],
    snapshot: CartArenaSessionSnapshot,
    delta: number,
  ): void {
    const active = new Set<string>();
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const group = this.runtimeV17.enemyGroups.get(enemy.id);
      if (!group) continue;
      active.add(enemy.id);

      const previous = this.enemyPose.get(enemy.id);
      let angularRate = 0;
      let speed = 0;
      let acceleration = 0;
      if (previous) {
        let headingDelta = enemy.heading - previous.heading;
        while (headingDelta > Math.PI) headingDelta -= Math.PI * 2;
        while (headingDelta < -Math.PI) headingDelta += Math.PI * 2;
        angularRate = headingDelta / Math.max(0.001, delta);
        speed = Math.hypot(enemy.x - previous.x, enemy.z - previous.z) / Math.max(0.001, delta);
        acceleration = (speed - previous.speed) / Math.max(0.001, delta);
      }

      const targetBank = THREE.MathUtils.clamp(-angularRate * 0.62, -0.94, 0.94);
      const distance = Math.hypot(enemy.x - snapshot.x, enemy.z - snapshot.z);
      const closingPitch = THREE.MathUtils.clamp((26 - distance) * 0.008, -0.08, 0.16);
      const targetPitch = THREE.MathUtils.clamp(
        -acceleration * 0.006 + Math.abs(angularRate) * 0.035 + closingPitch,
        -0.2,
        0.24,
      );
      const bankBlend = 1 - Math.exp(-delta * 5.6);
      const pitchBlend = 1 - Math.exp(-delta * 3.8);
      group.rotation.z += (targetBank - group.rotation.z) * bankBlend;
      group.rotation.x += (targetPitch - group.rotation.x) * pitchBlend;

      const baseY = enemy.kind === "boss" ? 1.8 : enemy.kind === "heavy" ? 1.36 : 1.12;
      const maneuverLift = Math.abs(targetBank) * 0.22 + Math.max(0, targetPitch) * 0.18;
      const airBob = Math.sin(this.elapsedV17 * 2.6 + enemy.x * 0.07 + enemy.z * 0.045) * 0.12;
      group.position.y = baseY + maneuverLift + airBob;

      this.enemyPose.set(enemy.id, { x: enemy.x, z: enemy.z, heading: enemy.heading, speed });
    }

    for (const id of this.enemyPose.keys()) {
      if (!active.has(id)) this.enemyPose.delete(id);
    }
  }
}

export { SkyDancerAirCombatFxV17 as SkyDancerAirCombatFx };
