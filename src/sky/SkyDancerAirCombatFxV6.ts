import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../cart/CartArenaSession";
import type { SkyDancerMissileState } from "./SkyDancerFlightCombat";
import { SkyDancerAirCombatFxV5 } from "./SkyDancerAirCombatFxV5";
import type { SkyDancerFxRuntime } from "./SkyDancerAirCombatFxV2";

/**
 * Final declutter layer after the full V5 world/airframe pass.
 * Keeps gameplay markers readable while preventing resource beams, gates and
 * air-burst rings from dominating an aircraft-scale scene.
 */
export class SkyDancerAirCombatFxV6 extends SkyDancerAirCombatFxV5 {
  constructor(private readonly runtimeV6: SkyDancerFxRuntime) {
    super(runtimeV6);
  }

  override update(snapshot: CartArenaSessionSnapshot, missiles: SkyDancerMissileState, delta: number): void {
    super.update(snapshot, missiles, delta);
    this.tuneResourceMarkers();
    this.tuneObstacleMarkers();
    this.tuneGateMarkers();
    this.tuneAirBursts();
  }

  private tuneResourceMarkers(): void {
    for (const group of this.runtimeV6.resourceGroups.values()) {
      if (!group.visible) continue;
      group.scale.setScalar(0.58);
      group.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        if (object.geometry.type === "CylinderGeometry" && object.position.y < 0) {
          object.visible = false;
          return;
        }
        if (object.geometry.type === "TorusGeometry" && object.material instanceof THREE.MeshBasicMaterial) {
          object.material.opacity = Math.min(object.material.opacity, 0.22);
        }
      });
    }
  }

  private tuneObstacleMarkers(): void {
    for (const group of this.runtimeV6.obstacleGroups.values()) {
      group.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        if (object.geometry.type === "TorusGeometry" && object.material instanceof THREE.MeshBasicMaterial) {
          object.material.opacity = Math.min(object.material.opacity, 0.24);
          object.scale.setScalar(0.90);
        }
      });
    }
  }

  private tuneGateMarkers(): void {
    for (const object of this.runtimeV6.scene.children) {
      if (!object.name.startsWith("sky-dancer-air-gate-")) continue;
      object.scale.setScalar(0.68);
      object.traverse((child) => {
        if (!(child instanceof THREE.Mesh) || !(child.material instanceof THREE.MeshBasicMaterial)) return;
        if (child.geometry.type === "TorusGeometry") {
          child.material.opacity = Math.min(child.material.opacity, 0.30);
        } else if (child.geometry.type === "BoxGeometry") {
          child.material.opacity = Math.min(child.material.opacity, 0.16);
        } else if (child.geometry.type === "SphereGeometry") {
          child.material.opacity = Math.min(child.material.opacity, 0.34);
        }
      });
    }
  }

  private tuneAirBursts(): void {
    for (const object of this.runtimeV6.scene.children) {
      if (object.name !== "sky-dancer-air-burst-v2" && object.name !== "sky-dancer-player-hit-burst-v2") continue;
      object.scale.setScalar(object.name === "sky-dancer-player-hit-burst-v2" ? 0.74 : 0.58);
      object.traverse((child) => {
        if (!(child instanceof THREE.Mesh) || !(child.material instanceof THREE.MeshBasicMaterial)) return;
        if (child.name.startsWith("burst-ring-")) {
          child.material.opacity *= 0.48;
        } else if (child.name === "burst-hot") {
          child.material.opacity *= 0.68;
        } else if (child.name === "burst-core") {
          child.material.opacity *= 0.76;
        } else if (child.name === "burst-streak") {
          child.material.opacity *= 0.72;
        }
      });
    }
  }
}

export { SkyDancerAirCombatFxV6 as SkyDancerAirCombatFx };
