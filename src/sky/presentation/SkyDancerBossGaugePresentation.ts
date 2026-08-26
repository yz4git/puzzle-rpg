import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../../cart/CartArenaSession";
import type { SkyDancerFxRuntime } from "../SkyDancerAirCombatFxV2";

/** Hide the inherited world-space boss gauge without changing combat state. */
export function hideSkyDancerBossWorldGauge(runtime: SkyDancerFxRuntime, snapshot: CartArenaSessionSnapshot): void {
  for (const enemy of snapshot.enemies) {
    if (enemy.kind !== "boss") continue;
    const group = runtime.enemyGroups.get(enemy.id);
    if (!group) continue;
    const fill = group.getObjectByName("hp-fill");
    if (!(fill instanceof THREE.Mesh)) continue;
    fill.visible = false;
    for (const child of group.children) {
      if (!(child instanceof THREE.Mesh) || child === fill) continue;
      if (Math.abs(child.position.y - fill.position.y) < 0.08) child.visible = false;
    }
    group.userData.skyDancerV31BossWorldGaugeHidden = true;
  }
}
