import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../../cart/CartArenaSession";
import type { SkyDancerFxRuntime } from "../SkyDancerAirCombatFxV2";
import { getSkyDancerMissileState } from "../SkyDancerFlightCombat";
import { getSkyDancerPlayerWeaponState } from "../SkyDancerPlayerWeapons";
import {
  SKY_DANCER_VERTICAL_RENDER_METERS_PER_UNIT,
  getSkyDancerEnemyVerticalSnapshotV43,
} from "../SkyDancerVerticalFlightV43";
import { getSkyDancerAttackRunSnapshotV44 } from "../SkyDancerAttackRunsV44";

interface AltitudeCue {
  root: THREE.Group;
  stem: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  arrow: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
}

interface MissileTrail {
  line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  points: THREE.Vector3[];
  missingSeconds: number;
}

const MAX_TRAIL_POINTS = 42;
const TRAIL_LINGER_SECONDS = 0.7;

function arrowGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([
    0, 0.32, 0,
    -0.24, -0.16, 0,
    0.24, -0.16, 0,
  ], 3));
  return geometry;
}

/**
 * V44 turns V43's hidden 3D state into readable combat information.
 *
 * - nearby aircraft get a compact world-space altitude stem + up/down arrow
 * - player and enemy missiles leave a curved 3D exhaust history for ~0.7 s
 * - the pass exposes diagnostics for the real-WebGL V44 playcheck
 *
 * It deliberately avoids adding controls: vertical separation is communicated
 * visually while the seeker continues to solve pitch automatically.
 */
export class SkyDancerV44ReadabilityPass {
  private readonly cueRoot = new THREE.Group();
  private readonly trailRoot = new THREE.Group();
  private readonly cues = new Map<string, AltitudeCue>();
  private readonly playerTrails = new Map<string, MissileTrail>();
  private readonly enemyTrails = new Map<string, MissileTrail>();
  private readonly activeCueIds = new Set<string>();
  private readonly activePlayerTrailIds = new Set<string>();
  private readonly activeEnemyTrailIds = new Set<string>();
  private maxVisibleAltitudeCues = 0;
  private maxTrailPoints = 0;
  private sawUpCue = false;
  private sawDownCue = false;
  private sawCurvedTrail = false;

  constructor(private readonly runtime: SkyDancerFxRuntime) {
    this.cueRoot.name = "sky-dancer-v44-altitude-cues";
    this.trailRoot.name = "sky-dancer-v44-missile-trails";
    runtime.scene.add(this.cueRoot, this.trailRoot);
    runtime.scene.userData.skyDancerV44Readability = true;
  }

  update(snapshot: CartArenaSessionSnapshot): void {
    this.updateAltitudeCues(snapshot);
    this.updateMissileTrails(1 / 60);
    this.installAuditBridge();
  }

  private updateAltitudeCues(snapshot: CartArenaSessionSnapshot): void {
    this.activeCueIds.clear();
    const liveById = new Map(this.runtime.session.enemies.map((enemy) => [enemy.id, enemy]));
    const px = this.runtime.session.car.position.x;
    const pz = this.runtime.session.car.position.z;
    const candidates = snapshot.enemies
      .filter((enemy) => enemy.alive)
      .map((enemy) => ({ enemy, distance: Math.hypot(enemy.x - px, enemy.z - pz) }))
      .filter((entry) => entry.distance <= 72)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 4);

    let visible = 0;
    for (const { enemy: enemySnapshot } of candidates) {
      const enemy = liveById.get(enemySnapshot.id);
      if (!enemy) continue;
      const vertical = getSkyDancerEnemyVerticalSnapshotV43(enemy);
      const altitude = vertical.altitudeOffsetMeters;
      if (Math.abs(altitude) < 1.5) continue;
      const cue = this.cues.get(enemySnapshot.id) ?? this.createAltitudeCue(enemySnapshot.id);
      this.cues.set(enemySnapshot.id, cue);
      this.activeCueIds.add(enemySnapshot.id);
      visible += 1;

      const baseY = enemySnapshot.kind === "boss" ? 1.7 : enemySnapshot.kind === "heavy" ? 1.3 : 1.08;
      const altitudeUnits = altitude / SKY_DANCER_VERTICAL_RENDER_METERS_PER_UNIT;
      const enemyY = baseY + altitudeUnits;
      cue.root.visible = true;
      cue.root.position.set(enemySnapshot.x, baseY, enemySnapshot.z);
      const stemPositions = cue.stem.geometry.getAttribute("position") as THREE.BufferAttribute;
      stemPositions.setXYZ(0, 0, 0, 0);
      stemPositions.setXYZ(1, 0, altitudeUnits, 0);
      stemPositions.needsUpdate = true;
      cue.arrow.position.y = altitudeUnits + Math.sign(altitude) * 0.42;
      cue.arrow.rotation.z = altitude > 0 ? 0 : Math.PI;
      cue.arrow.material.opacity = THREE.MathUtils.clamp(0.46 + Math.abs(altitude) / 20, 0.5, 0.9);
      cue.stem.material.opacity = THREE.MathUtils.clamp(0.22 + Math.abs(altitude) / 30, 0.24, 0.55);
      cue.root.userData.altitudeMeters = altitude;
      cue.root.userData.enemyY = enemyY;
      this.sawUpCue ||= altitude > 2;
      this.sawDownCue ||= altitude < -2;
    }

    for (const [id, cue] of this.cues) {
      if (!this.activeCueIds.has(id)) cue.root.visible = false;
    }
    this.maxVisibleAltitudeCues = Math.max(this.maxVisibleAltitudeCues, visible);
  }

  private createAltitudeCue(id: string): AltitudeCue {
    const root = new THREE.Group();
    root.name = `sky-dancer-v44-altitude-${id}`;
    const stemGeometry = new THREE.BufferGeometry();
    stemGeometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
    const stem = new THREE.Line(
      stemGeometry,
      new THREE.LineBasicMaterial({
        color: 0xd9f8ff,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    const arrow = new THREE.Mesh(
      arrowGeometry(),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.82,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    // The marker remains readable as a flat HUD-like glyph in world space.
    arrow.renderOrder = 30;
    stem.renderOrder = 29;
    root.add(stem, arrow);
    this.cueRoot.add(root);
    return { root, stem, arrow };
  }

  private updateMissileTrails(delta: number): void {
    this.activePlayerTrailIds.clear();
    this.activeEnemyTrailIds.clear();

    const playerState = getSkyDancerPlayerWeaponState(this.runtime.session);
    for (const missile of playerState.missiles) {
      const key = `p:${missile.id}`;
      this.activePlayerTrailIds.add(key);
      const trail = this.playerTrails.get(key) ?? this.createTrail(0xbdf5ff, 0.78);
      this.playerTrails.set(key, trail);
      trail.missingSeconds = 0;
      this.pushTrailPoint(
        trail,
        new THREE.Vector3(
          missile.x,
          1.02 + missile.altitudeOffsetMeters / SKY_DANCER_VERTICAL_RENDER_METERS_PER_UNIT,
          missile.z,
        ),
      );
    }

    const enemyState = getSkyDancerMissileState(this.runtime.session);
    for (const missile of enemyState.missiles) {
      const key = `e:${missile.id}`;
      this.activeEnemyTrailIds.add(key);
      const trail = this.enemyTrails.get(key) ?? this.createTrail(0xffd2a6, 0.68);
      this.enemyTrails.set(key, trail);
      trail.missingSeconds = 0;
      this.pushTrailPoint(
        trail,
        new THREE.Vector3(
          missile.x,
          1.18 + missile.altitudeOffsetMeters / SKY_DANCER_VERTICAL_RENDER_METERS_PER_UNIT,
          missile.z,
        ),
      );
    }

    this.ageTrails(this.playerTrails, this.activePlayerTrailIds, delta);
    this.ageTrails(this.enemyTrails, this.activeEnemyTrailIds, delta);
  }

  private createTrail(color: number, opacity: number): MissileTrail {
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const line = new THREE.Line(geometry, material);
    line.frustumCulled = false;
    line.renderOrder = 25;
    this.trailRoot.add(line);
    return { line, points: [], missingSeconds: 0 };
  }

  private pushTrailPoint(trail: MissileTrail, point: THREE.Vector3): void {
    const last = trail.points[trail.points.length - 1];
    if (!last || last.distanceToSquared(point) > 0.035) trail.points.push(point);
    while (trail.points.length > MAX_TRAIL_POINTS) trail.points.shift();
    trail.line.geometry.setFromPoints(trail.points);
    trail.line.geometry.attributes.position.needsUpdate = true;
    trail.line.visible = trail.points.length >= 2;
    trail.line.material.opacity = Math.max(trail.line.material.opacity, 0.68);
    this.maxTrailPoints = Math.max(this.maxTrailPoints, trail.points.length);
    if (trail.points.length >= 6) {
      const a = trail.points[0];
      const b = trail.points[Math.floor(trail.points.length / 2)];
      const c = trail.points[trail.points.length - 1];
      const ab = b.clone().sub(a).normalize();
      const bc = c.clone().sub(b).normalize();
      this.sawCurvedTrail ||= ab.dot(bc) < 0.997 || Math.abs(c.y - a.y) > 0.25;
    }
  }

  private ageTrails(map: Map<string, MissileTrail>, active: Set<string>, delta: number): void {
    for (const [key, trail] of map) {
      if (active.has(key)) continue;
      trail.missingSeconds += delta;
      const life = 1 - trail.missingSeconds / TRAIL_LINGER_SECONDS;
      trail.line.material.opacity = Math.max(0, 0.64 * life);
      if (trail.missingSeconds < TRAIL_LINGER_SECONDS) continue;
      trail.line.removeFromParent();
      trail.line.geometry.dispose();
      trail.line.material.dispose();
      map.delete(key);
    }
  }

  private installAuditBridge(): void {
    if (typeof window === "undefined" || !navigator.webdriver) return;
    (window as unknown as Record<string, unknown>).__skyDancerGetV44Readability = () => ({
      maxVisibleAltitudeCues: this.maxVisibleAltitudeCues,
      maxTrailPoints: this.maxTrailPoints,
      sawUpCue: this.sawUpCue,
      sawDownCue: this.sawDownCue,
      sawCurvedTrail: this.sawCurvedTrail,
      playerTrails: this.playerTrails.size,
      enemyTrails: this.enemyTrails.size,
      attackRuns: getSkyDancerAttackRunSnapshotV44(this.runtime.session),
    });
  }
}
