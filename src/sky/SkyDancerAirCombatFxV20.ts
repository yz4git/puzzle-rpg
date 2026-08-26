import * as THREE from "three";
import type { CartArenaSession, CartArenaSessionSnapshot } from "../cart/CartArenaSession";
import type { SkyDancerMissileState } from "./SkyDancerFlightCombat";
import { SkyDancerAirCombatFxV19 } from "./SkyDancerAirCombatFxV19";
import type { SkyDancerFxRuntime } from "./SkyDancerAirCombatFxV2";
import {
  getSkyDancerPlayerWeaponState,
  type SkyDancerPlayerMissileSnapshot,
} from "./SkyDancerPlayerWeapons";

interface PlayerShotVisual {
  root: THREE.Group;
  body: THREE.Mesh;
  flare: THREE.Mesh;
  trail: THREE.Mesh;
}

const MAX_SHOT_VISUALS = 5;

/**
 * V20 keeps the V19 midpoint graphics and makes player missiles unmistakable
 * on iPhone. It deliberately performs no Turbo speed modification: Phase15
 * owns the original release dash and Turbo hold never edits forward speed.
 */
export class SkyDancerAirCombatFxV20 extends SkyDancerAirCombatFxV19 {
  private readonly runtimeV20: SkyDancerFxRuntime;
  private readonly shotVisualRoot = new THREE.Group();
  private readonly shotVisuals: PlayerShotVisual[] = [];
  private builtV20 = false;

  constructor(runtime: SkyDancerFxRuntime) {
    super(runtime);
    this.runtimeV20 = runtime;
    this.shotVisualRoot.name = "sky-dancer-v20-visible-player-shots";
  }

  override update(snapshot: CartArenaSessionSnapshot, missiles: SkyDancerMissileState, delta: number): void {
    super.update(snapshot, missiles, delta);
    if (!this.builtV20) {
      this.builtV20 = true;
      this.buildShotVisualPool();
      this.runtimeV20.scene.add(this.shotVisualRoot);
      this.reduceBlackBuildingDominance();
    }
    this.updateVisiblePlayerShots();
  }

  private buildShotVisualPool(): void {
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xe9f8ff,
      emissive: 0x69d8ff,
      emissiveIntensity: 0.72,
      roughness: 0.3,
      metalness: 0.18,
      flatShading: true,
    });
    const flareMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const trailMaterial = new THREE.MeshBasicMaterial({
      color: 0x59d9ff,
      transparent: true,
      opacity: 0.68,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

    for (let index = 0; index < MAX_SHOT_VISUALS; index += 1) {
      const root = new THREE.Group();
      root.name = `sky-dancer-v20-player-shot-${index}`;
      root.visible = false;

      const bodyGeometry = new THREE.CylinderGeometry(0.12, 0.18, 1.25, 8);
      bodyGeometry.rotateX(Math.PI / 2);
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial.clone());
      body.position.z = 0.08;

      const flare = new THREE.Mesh(new THREE.SphereGeometry(0.34, 9, 6), flareMaterial.clone());
      flare.position.z = -0.62;

      const trail = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 7.4), trailMaterial.clone());
      trail.position.z = -4.05;

      const finMaterial = new THREE.MeshBasicMaterial({ color: 0xa7eeff, toneMapped: false });
      for (let finIndex = 0; finIndex < 4; finIndex += 1) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.035, 0.34), finMaterial.clone());
        fin.position.z = -0.28;
        fin.rotation.z = finIndex * Math.PI * 0.5;
        root.add(fin);
      }

      root.add(body, flare, trail);
      this.shotVisualRoot.add(root);
      this.shotVisuals.push({ root, body, flare, trail });
    }
  }

  private updateVisiblePlayerShots(): void {
    const state = getSkyDancerPlayerWeaponState(this.runtimeV20.session as unknown as CartArenaSession);
    for (let index = 0; index < this.shotVisuals.length; index += 1) {
      const visual = this.shotVisuals[index];
      const missile = state.missiles[index] ?? null;
      if (!missile) {
        visual.root.visible = false;
        continue;
      }
      this.placeShotVisual(visual, missile);
    }
  }

  private placeShotVisual(visual: PlayerShotVisual, missile: SkyDancerPlayerMissileSnapshot): void {
    const age = Math.max(0, missile.maxLife - missile.life);
    const launchSide = missile.id % 2 === 0 ? -1 : 1;
    const wingBlend = THREE.MathUtils.clamp(1 - age / 0.5, 0, 1);
    const rightX = Math.cos(missile.heading);
    const rightZ = -Math.sin(missile.heading);
    const lateralOffset = launchSide * 1.05 * wingBlend;

    visual.root.visible = true;
    visual.root.position.set(
      missile.x + rightX * lateralOffset,
      2.05 + wingBlend * 0.18,
      missile.z + rightZ * lateralOffset,
    );
    visual.root.rotation.set(0, missile.heading, 0);

    const pulse = 0.92 + Math.sin(performance.now() * 0.045 + missile.id) * 0.08;
    visual.flare.scale.setScalar(1.1 + pulse * 0.38);
    (visual.flare.material as THREE.MeshBasicMaterial).opacity = 0.76 + pulse * 0.2;
    visual.trail.scale.set(1 + wingBlend * 0.5, 1 + wingBlend * 0.5, 1);
    (visual.trail.material as THREE.MeshBasicMaterial).opacity = 0.52 + pulse * 0.2;
    visual.body.rotation.z += 0.08;
  }

  private reduceBlackBuildingDominance(): void {
    const names = [
      "sky-dancer-q14-visible-city-belts",
      "sky-dancer-q16-city-blocks",
      "sky-dancer-v19-readable-city",
    ];
    for (const name of names) {
      const object = this.runtimeV20.scene.getObjectByName(name);
      if (!(object instanceof THREE.InstancedMesh)) continue;
      const material = object.material;
      if (Array.isArray(material)) continue;
      if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshLambertMaterial) {
        material.color.lerp(new THREE.Color(0xd9e0dd), 0.18);
        material.needsUpdate = true;
      }
    }
  }
}

export { SkyDancerAirCombatFxV20 as SkyDancerAirCombatFx };
