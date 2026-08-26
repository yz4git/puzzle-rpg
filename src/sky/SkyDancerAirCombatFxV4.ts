import type { CartArenaSessionSnapshot } from "../cart/CartArenaSession";
import type { SkyDancerMissileState } from "./SkyDancerFlightCombat";
import { SkyDancerAirCombatFxV3 } from "./SkyDancerAirCombatFxV3";
import type { SkyDancerFxRuntime } from "./SkyDancerAirCombatFxV2";

/** Final presentation layer: keep only the current airspace visually active. */
export class SkyDancerAirCombatFxV4 extends SkyDancerAirCombatFxV3 {
  constructor(private readonly runtimeV4: SkyDancerFxRuntime) {
    super(runtimeV4);
  }

  override update(snapshot: CartArenaSessionSnapshot, missiles: SkyDancerMissileState, delta: number): void {
    const enemyById = new Map(snapshot.enemies.map((enemy) => [enemy.id, enemy]));
    for (const [id, group] of this.runtimeV4.enemyGroups) {
      const enemy = enemyById.get(id);
      group.visible = Boolean(enemy?.alive && enemy.nodeId === snapshot.nodeId);
    }

    const resourceById = new Map(snapshot.resources.map((resource) => [resource.id, resource]));
    for (const [id, group] of this.runtimeV4.resourceGroups) {
      const resource = resourceById.get(id);
      group.visible = Boolean(resource && !resource.collected && resource.nodeId === snapshot.nodeId);
    }

    const obstacleById = new Map(snapshot.obstacles.map((obstacle) => [obstacle.id, obstacle]));
    for (const [id, group] of this.runtimeV4.obstacleGroups) {
      const obstacle = obstacleById.get(id);
      group.visible = Boolean(obstacle && !obstacle.destroyed && obstacle.nodeId === snapshot.nodeId);
    }

    super.update(snapshot, missiles, delta);
  }
}

export { SkyDancerAirCombatFxV4 as SkyDancerAirCombatFx };
