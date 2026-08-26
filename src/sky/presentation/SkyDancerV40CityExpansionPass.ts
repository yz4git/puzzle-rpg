import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../../cart/CartArenaSession";
import type { SkyDancerFxRuntime } from "../SkyDancerAirCombatFxV2";

const CITY_SNAP = 420;
const GROUND_Y = -65.88;
const BUILDING_CAPACITY = 240;
const ROAD_CAPACITY = 24;
const GLOBAL_CITY_DEBUG_KEY = "__skyDancerGetV40CityDebug";
const AIR_BURST_V6_SCALE = 0.58;
const PLAYER_HIT_BURST_V6_SCALE = 0.74;
export const SKY_DANCER_V40_BURST_LINEAR_SCALE = 0.55;
export const SKY_DANCER_V40_AIR_BURST_SCALE = AIR_BURST_V6_SCALE * SKY_DANCER_V40_BURST_LINEAR_SCALE;
export const SKY_DANCER_V40_PLAYER_HIT_BURST_SCALE = PLAYER_HIT_BURST_V6_SCALE * SKY_DANCER_V40_BURST_LINEAR_SCALE;
export const SKY_DANCER_V40_V21_IMPACT_LINEAR_SCALE = 0.38;
export const SKY_DANCER_V40_V18_WARNING_LINEAR_SCALE = 0.32;
export const SKY_DANCER_V40_V21_HIT_CONFIRM_LINEAR_SCALE = 0.40;

interface CitySector {
  x: number;
  z: number;
  rotation: number;
  density: number;
  heightGain: number;
}

const SECTORS: readonly CitySector[] = [
  { x: -300, z: 58, rotation: -Math.PI * 0.50, density: 0.86, heightGain: 0.88 },
  { x: 286, z: -255, rotation: Math.PI * 0.96, density: 0.82, heightGain: 0.82 },
  { x: -252, z: -292, rotation: Math.PI * 0.67, density: 0.78, heightGain: 0.76 },
];

function hash2(x: number, z: number, salt = 0): number {
  let n = Math.imul(x + 0x45d9f3b + salt * 683, 0x27d4eb2d) ^ Math.imul(z - salt * 997, 0x165667b1);
  n ^= n >>> 15;
  n = Math.imul(n, 0x85ebca6b);
  n ^= n >>> 13;
  return (n >>> 0) / 0xffffffff;
}

/**
 * V40 skyline and final combat-declutter pass.
 *
 * V36 intentionally owns the high-detail primary city in front of the opening
 * composition. This pass leaves it untouched and fills the other three broad
 * directions with cheaper instanced districts, so long turns no longer reveal
 * one city island surrounded by empty green terrain. It also runs after the
 * inherited combat FX and reduces V2/V21 world bursts plus the V18 missile
 * warning and V21 hit-confirm camera rings before they can dominate the chase
 * view. All changes are render-only: collision, damage, flight height and
 * combat timing are untouched.
 */
export class SkyDancerV40CityExpansionPass {
  private readonly root = new THREE.Group();
  private readonly low: THREE.InstancedMesh;
  private readonly mid: THREE.InstancedMesh;
  private readonly high: THREE.InstancedMesh;
  private readonly roads: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly palette = [0x607983, 0x71878f, 0x82979b, 0x93a3a4, 0x526e78, 0xa7afad]
    .map((value) => new THREE.Color(value));
  private tileX = Number.NaN;
  private tileZ = Number.NaN;
  private anchored = false;
  private latestCounts = { low: 0, mid: 0, high: 0, roads: 0 };

  constructor(private readonly runtime: SkyDancerFxRuntime) {
    this.root.name = "sky-dancer-v40-multi-direction-city";
    this.root.userData.skyDancerV42StableGroundAnchor = true;

    const material = () => new THREE.MeshLambertMaterial({
      color: 0xffffff,
      flatShading: true,
      fog: true,
    });
    this.low = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material(), BUILDING_CAPACITY);
    this.low.name = "sky-dancer-v40-city-low";
    this.mid = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material(), BUILDING_CAPACITY);
    this.mid.name = "sky-dancer-v40-city-mid";
    this.high = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material(), BUILDING_CAPACITY);
    this.high.name = "sky-dancer-v40-city-high";

    this.roads = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({
        color: 0x9aa6a4,
        transparent: true,
        opacity: 0.26,
        depthWrite: true,
        fog: true,
        toneMapped: false,
      }),
      ROAD_CAPACITY,
    );
    this.roads.name = "sky-dancer-v40-city-arterials";

    for (const mesh of [this.low, this.mid, this.high, this.roads]) mesh.frustumCulled = false;
    this.root.add(this.low, this.mid, this.high, this.roads);
    runtime.scene.add(this.root);
    runtime.scene.userData.skyDancerV40MultiDirectionCity = true;
    runtime.scene.userData.skyDancerV40BurstLinearScale = SKY_DANCER_V40_BURST_LINEAR_SCALE;
    runtime.scene.userData.skyDancerV40V21ImpactLinearScale = SKY_DANCER_V40_V21_IMPACT_LINEAR_SCALE;
    runtime.scene.userData.skyDancerV40V18WarningLinearScale = SKY_DANCER_V40_V18_WARNING_LINEAR_SCALE;
    runtime.scene.userData.skyDancerV40V21HitConfirmLinearScale = SKY_DANCER_V40_V21_HIT_CONFIRM_LINEAR_SCALE;

    if (typeof window !== "undefined" && navigator.webdriver) {
      (window as unknown as Record<string, unknown>)[GLOBAL_CITY_DEBUG_KEY] = () => {
        let v21ImpactMaxScale: number | null = null;
        for (const object of this.runtime.scene.children) {
          if (object.name !== "sky-dancer-v21-player-missile-impact" || !object.visible) continue;
          v21ImpactMaxScale = Math.max(v21ImpactMaxScale ?? 0, object.scale.x);
        }
        const warning = this.runtime.camera.getObjectByName("sky-dancer-v18-missile-warning");
        const hitConfirm = this.runtime.camera.getObjectByName("sky-dancer-v21-missile-hit-confirm");
        return {
          sectorCount: SECTORS.length,
          sectors: SECTORS.map(({ x, z, rotation }) => ({ x, z, rotation })),
          counts: { ...this.latestCounts },
          totalBuildings: this.latestCounts.low + this.latestCounts.mid + this.latestCounts.high,
          rootPosition: { x: this.root.position.x, z: this.root.position.z },
          stableGroundAnchor: this.root.userData.skyDancerV42StableGroundAnchor === true,
          burstLinearScale: SKY_DANCER_V40_BURST_LINEAR_SCALE,
          v21ImpactLinearScale: SKY_DANCER_V40_V21_IMPACT_LINEAR_SCALE,
          v21ImpactMaxScale,
          v18WarningLinearScale: SKY_DANCER_V40_V18_WARNING_LINEAR_SCALE,
          v18WarningScale: warning?.visible ? warning.scale.x : null,
          v21HitConfirmLinearScale: SKY_DANCER_V40_V21_HIT_CONFIRM_LINEAR_SCALE,
          v21HitConfirmScale: hitConfirm?.visible ? hitConfirm.scale.x : null,
          airBurstScale: this.runtime.scene.getObjectByName("sky-dancer-air-burst-v2")?.scale.x ?? null,
          playerHitBurstScale: this.runtime.scene.getObjectByName("sky-dancer-player-hit-burst-v2")?.scale.x ?? null,
        };
      };
    }
  }

  update(snapshot: CartArenaSessionSnapshot): void {
    this.root.visible = true;
    this.reduceInheritedCombatBursts();
    // V42: decorative city geometry is world scenery, not a player-relative
    // chase object. Rebuilding and shifting the entire root every 420 m made
    // buildings abruptly disappear at tile boundaries even after V41 made the
    // ground itself continuous. Anchor the initial deterministic district in
    // world space and let normal camera/fog motion move it out of view.
    if (this.anchored) return;
    this.tileX = Math.floor(snapshot.x / CITY_SNAP);
    this.tileZ = Math.floor(snapshot.z / CITY_SNAP);
    this.root.position.set(this.tileX * CITY_SNAP, 0, this.tileZ * CITY_SNAP);
    this.rebuild(this.tileX, this.tileZ);
    this.anchored = true;
  }

  private reduceInheritedCombatBursts(): void {
    for (const object of this.runtime.scene.children) {
      if (object.name === "sky-dancer-air-burst-v2") {
        object.scale.setScalar(SKY_DANCER_V40_AIR_BURST_SCALE);
      } else if (object.name === "sky-dancer-player-hit-burst-v2") {
        object.scale.setScalar(SKY_DANCER_V40_PLAYER_HIT_BURST_SCALE);
      } else if (object.name === "sky-dancer-v21-player-missile-impact" && object.visible) {
        object.scale.multiplyScalar(SKY_DANCER_V40_V21_IMPACT_LINEAR_SCALE);
      }
    }

    const warning = this.runtime.camera.getObjectByName("sky-dancer-v18-missile-warning");
    if (warning?.visible) warning.scale.multiplyScalar(SKY_DANCER_V40_V18_WARNING_LINEAR_SCALE);
    const hitConfirm = this.runtime.camera.getObjectByName("sky-dancer-v21-missile-hit-confirm");
    if (hitConfirm?.visible) hitConfirm.scale.multiplyScalar(SKY_DANCER_V40_V21_HIT_CONFIRM_LINEAR_SCALE);
  }

  private rebuild(tileX: number, tileZ: number): void {
    const counts = { low: 0, mid: 0, high: 0, roads: 0 };
    const spacing = 10.5;

    SECTORS.forEach((sector, sectorIndex) => {
      const cos = Math.cos(sector.rotation);
      const sin = Math.sin(sector.rotation);
      const seedX = tileX * 29 + sectorIndex * 101;
      const seedZ = tileZ * 31 - sectorIndex * 83;

      for (let row = -5; row <= 6; row += 1) {
        for (let column = -6; column <= 6; column += 1) {
          if (row % 5 === 0 || column % 6 === 0) continue;
          const occupancy = hash2(seedX + column, seedZ + row, 200);
          if (occupancy > sector.density) continue;

          const localX = column * spacing + (hash2(seedX + row, seedZ + column, 250) - 0.5) * 2.2;
          const localZ = row * spacing + (hash2(seedZ + column, seedX + row, 300) - 0.5) * 2.2;
          const x = sector.x + localX * cos - localZ * sin;
          const z = sector.z + localX * sin + localZ * cos;
          const radial = Math.hypot(localX, localZ);
          const core = THREE.MathUtils.clamp(1 - radial / 86, 0, 1);
          const noise = hash2(seedX + column, seedZ + row, 360);
          const height = (4.8 + noise * 8.5 + core * (7 + noise * 19)) * sector.heightGain;
          const width = 4.1 + hash2(seedX + row, seedZ + column, 420) * 3.4;
          const depth = 4.0 + hash2(seedZ + row, seedX + column, 480) * 3.6;
          const classNoise = hash2(seedX + column, seedZ + row, 540);
          const kind = height > 25 || (core > 0.68 && classNoise > 0.82)
            ? "high"
            : height > 13
              ? "mid"
              : "low";
          const mesh = kind === "high" ? this.high : kind === "mid" ? this.mid : this.low;
          const index = counts[kind];
          if (index >= BUILDING_CAPACITY) continue;
          counts[kind] += 1;

          const finalHeight = kind === "high" ? Math.max(24, height * 1.22) : height;
          this.dummy.position.set(x, GROUND_Y + finalHeight * 0.5, z);
          this.dummy.rotation.set(0, sector.rotation + (hash2(seedX + row, seedZ + column, 600) - 0.5) * 0.08, 0);
          this.dummy.scale.set(width, finalHeight, depth);
          this.dummy.updateMatrix();
          mesh.setMatrixAt(index, this.dummy.matrix);
          mesh.setColorAt(index, this.palette[(sectorIndex * 3 + row + column + 32) % this.palette.length]);
        }
      }

      const roadSpecs: ReadonlyArray<[number, number, number, number]> = [
        [0, 0, 0, 142],
        [0, -22, Math.PI / 2, 154],
        [0, 29, Math.PI / 2, 154],
      ];
      for (const [rx, rz, localRotation, length] of roadSpecs) {
        if (counts.roads >= ROAD_CAPACITY) break;
        const x = sector.x + rx * cos - rz * sin;
        const z = sector.z + rx * sin + rz * cos;
        this.dummy.position.set(x, GROUND_Y + 0.18, z);
        this.dummy.rotation.set(0, sector.rotation + localRotation, 0);
        this.dummy.scale.set(1.15, 0.035, length);
        this.dummy.updateMatrix();
        this.roads.setMatrixAt(counts.roads, this.dummy.matrix);
        counts.roads += 1;
      }
    });

    for (const [kind, mesh] of [["low", this.low], ["mid", this.mid], ["high", this.high]] as const) {
      mesh.count = counts[kind];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    this.roads.count = counts.roads;
    this.roads.instanceMatrix.needsUpdate = true;
    this.latestCounts = { ...counts };
  }
}
