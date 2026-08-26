import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../cart/CartArenaSession";
import type { SkyDancerMissileState } from "./SkyDancerFlightCombat";
import { SkyDancerAirCombatFxV7 } from "./SkyDancerAirCombatFxV7";
import type { SkyDancerFxRuntime } from "./SkyDancerAirCombatFxV2";

/**
 * Removes legacy Cart radial markers that are generated at scene level rather
 * than under playerVisual. Only ring/torus geometry very close to the player's
 * horizontal position and near flight-plane Y is suppressed; distant gates,
 * pickups and combat markers remain available.
 */
export class SkyDancerAirCombatFxV8 extends SkyDancerAirCombatFxV7 {
  private readonly runtimeV8: SkyDancerFxRuntime;
  private readonly worldPosition = new THREE.Vector3();

  constructor(runtime: SkyDancerFxRuntime) {
    super(runtime);
    this.runtimeV8 = runtime;
  }

  override update(snapshot: CartArenaSessionSnapshot, missiles: SkyDancerMissileState, delta: number): void {
    super.update(snapshot, missiles, delta);
    this.removeLegacyPlayerRadials(snapshot);
  }

  private removeLegacyPlayerRadials(snapshot: CartArenaSessionSnapshot): void {
    this.runtimeV8.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const geometryType = object.geometry.type;
      if (geometryType !== "TorusGeometry" && geometryType !== "RingGeometry") return;

      object.getWorldPosition(this.worldPosition);
      const dx = this.worldPosition.x - snapshot.x;
      const dz = this.worldPosition.z - snapshot.z;
      if (dx * dx + dz * dz > 5.2 * 5.2) return;
      if (this.worldPosition.y < -1.5 || this.worldPosition.y > 2.2) return;

      // Sky-specific gate rings can legitimately be crossed by the player.
      // Keep them visible even when their world center is temporarily nearby.
      let ancestor: THREE.Object3D | null = object;
      while (ancestor) {
        if (ancestor.name.startsWith("sky-dancer-air-gate-")) return;
        ancestor = ancestor.parent;
      }

      object.visible = false;
    });
  }
}

export { SkyDancerAirCombatFxV8 as SkyDancerAirCombatFx };
