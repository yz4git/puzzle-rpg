import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../../cart/CartArenaSession";
import type { SkyDancerFxRuntime } from "../SkyDancerAirCombatFxV2";
import { getSkyDancerMissileState } from "../SkyDancerFlightCombat";
import { getSkyDancerPlayerWeaponState } from "../SkyDancerPlayerWeapons";
import {
  SKY_DANCER_VERTICAL_RENDER_METERS_PER_UNIT,
  getSkyDancerEnemyVerticalSnapshotV43,
} from "../SkyDancerVerticalFlightV43";

interface PlayerMissileVisual {
  root: THREE.Group;
  flame: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>;
}

/**
 * V43 makes the altitude simulation visible without changing chase-camera
 * controls. Enemy roots pitch and climb/dive over a +/-10 m band, enemy missile
 * meshes follow their 3D trajectory, and player missiles get a dedicated 3D
 * visual so seeker pitch can be read during combat.
 */
export class SkyDancerV43VerticalCombatPass {
  private readonly playerMissileRoot = new THREE.Group();
  private readonly playerMissiles = new Map<number, PlayerMissileVisual>();
  private readonly playerMissilePool: PlayerMissileVisual[] = [];
  private readonly activePlayerMissiles = new Set<number>();
  private elapsed = 0;

  constructor(private readonly runtime: SkyDancerFxRuntime) {
    this.playerMissileRoot.name = "sky-dancer-v43-player-missiles";
    runtime.scene.add(this.playerMissileRoot);
    for (let index = 0; index < 5; index += 1) this.playerMissilePool.push(this.createPlayerMissileVisual());
    runtime.scene.userData.skyDancerV43VerticalCombat = true;
  }

  update(snapshot: CartArenaSessionSnapshot): void {
    this.elapsed += 1 / 60;
    this.updateEnemyAircraft(snapshot);
    this.updateEnemyMissiles();
    this.updatePlayerMissiles();
    this.installAuditBridge();
  }

  private updateEnemyAircraft(snapshot: CartArenaSessionSnapshot): void {
    const liveById = new Map(this.runtime.session.enemies.map((enemy) => [enemy.id, enemy]));
    for (const enemySnapshot of snapshot.enemies) {
      if (!enemySnapshot.alive) continue;
      const enemy = liveById.get(enemySnapshot.id);
      const group = this.runtime.enemyGroups.get(enemySnapshot.id);
      if (!enemy || !group) continue;
      const vertical = getSkyDancerEnemyVerticalSnapshotV43(enemy);
      const baseY = enemySnapshot.kind === "boss" ? 1.7 : enemySnapshot.kind === "heavy" ? 1.3 : 1.08;
      const targetY = baseY + vertical.altitudeOffsetMeters / SKY_DANCER_VERTICAL_RENDER_METERS_PER_UNIT;
      group.position.y += (targetY - group.position.y) * 0.82;
      group.rotation.x += ((-vertical.pitchRadians) - group.rotation.x) * 0.74;
    }
  }

  private updateEnemyMissiles(): void {
    const missileState = getSkyDancerMissileState(this.runtime.session);
    const root = this.runtime.scene.getObjectByName("sky-dancer-missile-root");
    if (!root) return;
    const available = [...missileState.missiles];
    for (const child of root.children) {
      if (!(child instanceof THREE.Group) || !child.visible || available.length === 0) continue;
      let bestIndex = 0;
      let bestDistanceSq = Number.POSITIVE_INFINITY;
      for (let index = 0; index < available.length; index += 1) {
        const missile = available[index];
        const distanceSq = (child.position.x - missile.x) ** 2 + (child.position.z - missile.z) ** 2;
        if (distanceSq < bestDistanceSq) {
          bestDistanceSq = distanceSq;
          bestIndex = index;
        }
      }
      const missile = available.splice(bestIndex, 1)[0];
      child.position.y = 1.18 + missile.altitudeOffsetMeters / SKY_DANCER_VERTICAL_RENDER_METERS_PER_UNIT;
      child.rotation.x = -missile.pitch;
      child.userData.skyDancerV43AltitudeMeters = missile.altitudeOffsetMeters;
      child.userData.skyDancerV43Pitch = missile.pitch;
    }
  }

  private updatePlayerMissiles(): void {
    const weapon = getSkyDancerPlayerWeaponState(this.runtime.session);
    this.activePlayerMissiles.clear();
    for (const missile of weapon.missiles) {
      this.activePlayerMissiles.add(missile.id);
      let visual = this.playerMissiles.get(missile.id);
      if (!visual) {
        visual = this.playerMissilePool.pop() ?? this.createPlayerMissileVisual();
        this.playerMissiles.set(missile.id, visual);
      }
      visual.root.visible = true;
      visual.root.position.set(
        missile.x,
        1.02 + missile.altitudeOffsetMeters / SKY_DANCER_VERTICAL_RENDER_METERS_PER_UNIT,
        missile.z,
      );
      visual.root.rotation.set(-missile.pitch, missile.heading, 0, "YXZ");
      const thrust = THREE.MathUtils.clamp((missile.speed - 22) / 20, 0.2, 1);
      visual.flame.scale.z = 0.72 + thrust * 1.35 + Math.sin(this.elapsed * 56 + missile.id) * 0.08;
      visual.flame.material.opacity = 0.48 + thrust * 0.42;
    }

    for (const [id, visual] of this.playerMissiles) {
      if (this.activePlayerMissiles.has(id)) continue;
      this.playerMissiles.delete(id);
      visual.root.visible = false;
      this.playerMissilePool.push(visual);
    }
  }

  private createPlayerMissileVisual(): PlayerMissileVisual {
    const root = new THREE.Group();
    root.name = "sky-dancer-v43-player-missile";
    root.visible = false;

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.105, 0.125, 0.94, 7),
      new THREE.MeshStandardMaterial({ color: 0xeaf6f8, roughness: 0.32, metalness: 0.38, flatShading: true }),
    );
    body.rotation.x = Math.PI / 2;
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.125, 0.38, 7),
      new THREE.MeshStandardMaterial({ color: 0x4bc7f2, roughness: 0.25, metalness: 0.3, flatShading: true }),
    );
    nose.rotation.x = Math.PI / 2;
    nose.position.z = 0.65;

    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 1.0, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x8deeff,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    flame.rotation.x = -Math.PI / 2;
    flame.position.z = -0.82;

    for (const rotation of [0, Math.PI / 2]) {
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.025, 0.24),
        new THREE.MeshStandardMaterial({ color: 0x31536a, roughness: 0.5, flatShading: true }),
      );
      fin.position.z = -0.32;
      fin.rotation.z = rotation;
      root.add(fin);
    }
    root.add(body, nose, flame);
    this.playerMissileRoot.add(root);
    return { root, flame };
  }

  private installAuditBridge(): void {
    if (typeof window === "undefined" || !navigator.webdriver) return;
    (window as unknown as Record<string, unknown>).__skyDancerGetV43VerticalFlight = () => {
      const liveEnemies = this.runtime.session.enemies.filter(
        (enemy) => enemy.alive && enemy.nodeId === this.runtime.session.location.node.id,
      );
      const enemies = liveEnemies.map((enemy) => ({ id: enemy.id, ...getSkyDancerEnemyVerticalSnapshotV43(enemy) }));
      const enemyMissiles = getSkyDancerMissileState(this.runtime.session).missiles;
      const playerMissiles = getSkyDancerPlayerWeaponState(this.runtime.session).missiles;
      return {
        enemies,
        enemyMissiles,
        playerMissiles,
        maxAbsEnemyAltitude: enemies.reduce((max, enemy) => Math.max(max, Math.abs(enemy.altitudeOffsetMeters)), 0),
        maxAbsEnemyPitch: enemies.reduce((max, enemy) => Math.max(max, Math.abs(enemy.pitchRadians)), 0),
        maxAbsMissilePitch: [...enemyMissiles, ...playerMissiles].reduce((max, missile) => Math.max(max, Math.abs(missile.pitch)), 0),
      };
    };
  }
}
