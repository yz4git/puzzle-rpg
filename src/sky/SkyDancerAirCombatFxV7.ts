import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../cart/CartArenaSession";
import type { SkyDancerMissileState } from "./SkyDancerFlightCombat";
import { installSkyDancerFlightAvoidance } from "./SkyDancerFlightAvoidance";
import { SkyDancerAirCombatFxV6 } from "./SkyDancerAirCombatFxV6";
import type { SkyDancerFxRuntime } from "./SkyDancerAirCombatFxV2";

interface FlightVisualRuntime extends SkyDancerFxRuntime {
  steer?: number;
}

export const SKY_DANCER_PRESENTATION_ALTITUDE_METERS = 105;
const LOW_ALTITUDE_GROUND_SHIFT = 12;

function normalizeAngle(value: number): number {
  let angle = value;
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

export class SkyDancerAirCombatFxV7 extends SkyDancerAirCombatFxV6 {
  private readonly runtimeV7: FlightVisualRuntime;
  private lowAltitudeApplied = false;
  private cameraFlightRoll = 0;
  private previousPlayerHeading: number | null = null;

  constructor(runtime: SkyDancerFxRuntime) {
    super(runtime);
    this.runtimeV7 = runtime as FlightVisualRuntime;
    installSkyDancerFlightAvoidance();
  }

  override update(snapshot: CartArenaSessionSnapshot, missiles: SkyDancerMissileState, delta: number): void {
    this.updateFlightAttitude(snapshot, delta);
    super.update(snapshot, missiles, delta);

    if (!this.lowAltitudeApplied) {
      this.lowAltitudeApplied = true;
      this.applyLowAltitudePresentation();
    }
    this.removePlayerUnderRing();
  }

  override getCameraRollImpulse(): number {
    return super.getCameraRollImpulse() + this.cameraFlightRoll;
  }

  private updateFlightAttitude(snapshot: CartArenaSessionSnapshot, delta: number): void {
    const safeDelta = Math.max(0.001, delta);
    const steer = THREE.MathUtils.clamp(this.runtimeV7.steer ?? 0, -1, 1);
    const speedFactor = THREE.MathUtils.clamp(Math.abs(snapshot.speed) / 20, 0, 1);

    const previousHeading = this.previousPlayerHeading ?? snapshot.heading;
    const turnRate = normalizeAngle(snapshot.heading - previousHeading) / safeDelta;
    this.previousPlayerHeading = snapshot.heading;

    const steerBank = Math.abs(steer) > 0.04
      ? -Math.sign(steer) * (0.24 + Math.abs(steer) * (0.50 + speedFactor * 0.12))
      : 0;
    const turnBank = THREE.MathUtils.clamp(-turnRate * 0.78, -0.98, 0.98);
    const targetPlayerBank = THREE.MathUtils.clamp(
      Math.abs(turnBank) > Math.abs(steerBank) ? turnBank : steerBank,
      -0.98,
      0.98,
    );
    const bankResponse = Math.min(1, delta * (7.2 + speedFactor * 2.8));
    this.runtimeV7.playerVisual.rotation.z += (targetPlayerBank - this.runtimeV7.playerVisual.rotation.z) * bankResponse;

    const targetPlayerPitch = Math.abs(targetPlayerBank) * 0.09 - (snapshot.boostActive ? 0.032 : 0);
    this.runtimeV7.playerVisual.rotation.x += (targetPlayerPitch - this.runtimeV7.playerVisual.rotation.x) * Math.min(1, delta * 5.8);
    // Follow only a little of the bank with the camera; too much camera roll
    // visually cancels the aircraft's own roll.
    this.cameraFlightRoll += (this.runtimeV7.playerVisual.rotation.z * 0.065 - this.cameraFlightRoll) * Math.min(1, delta * 4.5);

    for (const enemy of snapshot.enemies) {
      if (!enemy.alive || enemy.nodeId !== snapshot.nodeId) continue;
      const group = this.runtimeV7.enemyGroups.get(enemy.id);
      if (!group || !group.visible) continue;

      const previousEnemyHeading = Number(group.userData.skyDancerQ7Heading ?? enemy.heading);
      const headingDelta = normalizeAngle(enemy.heading - previousEnemyHeading);
      const angularRate = headingDelta / safeDelta;
      const targetBank = THREE.MathUtils.clamp(-angularRate * 0.68, -0.98, 0.98);
      group.rotation.z += (targetBank - group.rotation.z) * Math.min(1, delta * 7.4);

      const targetPitch = Math.abs(targetBank) * 0.095 - 0.015;
      group.rotation.x += (targetPitch - group.rotation.x) * Math.min(1, delta * 5.3);
      group.position.y += Math.abs(group.rotation.z) * 0.2;
      group.userData.skyDancerQ7Heading = enemy.heading;
    }
  }

  private applyLowAltitudePresentation(): void {
    const scene = this.runtimeV7.scene;
    for (const object of scene.children) {
      if (!object.name.startsWith("sky-dancer-q5-")) continue;
      if (object.name === "sky-dancer-q5-cloud-banks") continue;
      object.position.y += LOW_ALTITUDE_GROUND_SHIFT;
    }

    scene.userData.skyDancerAltitudeMeters = SKY_DANCER_PRESENTATION_ALTITUDE_METERS;
    scene.userData.verticalRenderScaleMetersPerUnit = SKY_DANCER_PRESENTATION_ALTITUDE_METERS / 34;
    scene.fog = new THREE.Fog(0xd3e4e8, 104, 420);
  }

  private removePlayerUnderRing(): void {
    this.runtimeV7.playerVisual.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object.geometry.type === "TorusGeometry") object.visible = false;
    });
  }
}

export { SkyDancerAirCombatFxV7 as SkyDancerAirCombatFx };
