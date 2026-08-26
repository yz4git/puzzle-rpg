import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../cart/CartArenaSession";
import type { SkyDancerMissileState } from "./SkyDancerFlightCombat";
import { SkyDancerAirCombatFxV9 } from "./SkyDancerAirCombatFxV9";
import type { SkyDancerFxRuntime } from "./SkyDancerAirCombatFxV2";
import {
  getSkyDancerPlayerWeaponState,
  installSkyDancerPlayerWeapons,
  requestSkyDancerPlayerMissile,
  stepSkyDancerPlayerWeapons,
} from "./SkyDancerPlayerWeapons";
import { bindSkyDancerWeaponSession } from "./SkyDancerWeaponBridge";

interface PlayerMissileVisualState {
  root: THREE.Group;
  tail: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  core: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
}

const GLOBAL_FIRE_KEY = "__skyDancerFireMissile";
const GLOBAL_WEAPON_STATE_KEY = "__skyDancerGetWeaponState";
const WEAPON_FIXED_STEP = 1 / 60;

export class SkyDancerAirCombatFxV10 extends SkyDancerAirCombatFxV9 {
  private readonly runtimeV10: SkyDancerFxRuntime;
  private readonly missileRoot = new THREE.Group();
  private readonly missileVisuals = new Map<number, PlayerMissileVisualState>();
  private readonly missilePool: PlayerMissileVisualState[] = [];
  private readonly activeMissileIds = new Set<number>();
  private elapsedV10 = 0;
  private weaponAccumulator = 0;

  constructor(runtime: SkyDancerFxRuntime) {
    super(runtime);
    this.runtimeV10 = runtime;
    installSkyDancerPlayerWeapons();
    bindSkyDancerWeaponSession(runtime.session);
    this.missileRoot.name = "sky-dancer-q10-player-missiles";
    runtime.scene.add(this.missileRoot);
    while (this.missilePool.length < 5) {
      const visual = this.buildPlayerMissile();
      visual.root.visible = false;
      this.missilePool.push(visual);
    }
    if (typeof window !== "undefined") {
      const globals = window as unknown as Record<string, unknown>;
      globals[GLOBAL_FIRE_KEY] = () => requestSkyDancerPlayerMissile(runtime.session);
      globals[GLOBAL_WEAPON_STATE_KEY] = () => getSkyDancerPlayerWeaponState(runtime.session);
    }
  }

  override update(snapshot: CartArenaSessionSnapshot, missiles: SkyDancerMissileState, delta: number): void {
    super.update(snapshot, missiles, delta);
    this.elapsedV10 += delta;
    // Weapon simulation lives on the renderer clock rather than the heavily
    // patched CartArenaSession.step chain. A fixed accumulator keeps missile
    // speed/homing consistent at 30/60/120 Hz rendering.
    this.weaponAccumulator = Math.min(0.12, this.weaponAccumulator + Math.max(0, delta));
    while (this.weaponAccumulator >= WEAPON_FIXED_STEP) {
      stepSkyDancerPlayerWeapons(this.runtimeV10.session, WEAPON_FIXED_STEP);
      this.weaponAccumulator -= WEAPON_FIXED_STEP;
    }
    this.updatePlayerMissiles(delta);
  }

  private updatePlayerMissiles(delta: number): void {
    const state = getSkyDancerPlayerWeaponState(this.runtimeV10.session);
    this.activeMissileIds.clear();
    const active = this.activeMissileIds;
    for (const missile of state.missiles) {
      active.add(missile.id);
      let visual = this.missileVisuals.get(missile.id);
      if (!visual) {
        visual = this.missilePool.pop() ?? this.buildPlayerMissile();
        this.missileVisuals.set(missile.id, visual);
      }
      visual.root.visible = true;
      visual.root.position.set(missile.x, 1.12 + Math.sin(this.elapsedV10 * 8.5 + missile.id) * 0.035, missile.z);
      visual.root.rotation.y = missile.heading;
      const pulse = 0.9 + Math.sin(this.elapsedV10 * 31 + missile.id * 0.37) * 0.1;
      visual.tail.material.opacity = 0.54 + pulse * 0.24;
      visual.tail.scale.z = 0.86 + pulse * 0.34;
      visual.core.material.opacity = 0.76 + pulse * 0.2;
      visual.ring.visible = Boolean(missile.targetEnemyId);
      if (visual.ring.visible) {
        visual.ring.rotation.z += delta * 4.6;
        visual.ring.scale.setScalar(0.88 + Math.sin(this.elapsedV10 * 9 + missile.id) * 0.09);
      }
    }

    for (const [id, visual] of this.missileVisuals) {
      if (active.has(id)) continue;
      this.missileVisuals.delete(id);
      visual.root.visible = false;
      this.missilePool.push(visual);
    }
  }

  private buildPlayerMissile(): PlayerMissileVisualState {
    const root = new THREE.Group();
    root.name = "sky-dancer-q10-player-missile";
    const bodyGeometry = new THREE.CylinderGeometry(0.085, 0.12, 1.05, 8);
    bodyGeometry.rotateX(Math.PI / 2);
    const body = new THREE.Mesh(bodyGeometry, new THREE.MeshStandardMaterial({ color: 0xe9f7fa, roughness: 0.24, metalness: 0.48, flatShading: true, emissive: 0x0e3440, emissiveIntensity: 0.2 }));
    const noseGeometry = new THREE.ConeGeometry(0.12, 0.4, 8);
    noseGeometry.rotateX(Math.PI / 2);
    const nose = new THREE.Mesh(noseGeometry, new THREE.MeshStandardMaterial({ color: 0x70eaff, emissive: 0x1b8fab, emissiveIntensity: 0.75, roughness: 0.25, metalness: 0.2, flatShading: true }));
    nose.position.z = 0.7;
    const finMaterial = new THREE.MeshStandardMaterial({ color: 0x25526a, roughness: 0.5, metalness: 0.2, flatShading: true });
    for (const rotation of [0, Math.PI / 2]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.035, 0.3), finMaterial.clone());
      fin.position.z = -0.34;
      fin.rotation.z = rotation;
      root.add(fin);
    }
    const tailGeometry = new THREE.CylinderGeometry(0.022, 0.105, 1.5, 8, 1, true);
    tailGeometry.rotateX(-Math.PI / 2);
    const tail = new THREE.Mesh(tailGeometry, new THREE.MeshBasicMaterial({ color: 0x55e6ff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    tail.position.z = -1.1;
    const coreGeometry = new THREE.CylinderGeometry(0.014, 0.042, 1.0, 7, 1, true);
    coreGeometry.rotateX(-Math.PI / 2);
    const core = new THREE.Mesh(coreGeometry, new THREE.MeshBasicMaterial({ color: 0xf5ffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    core.position.z = -0.9;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.017, 4, 18), new THREE.MeshBasicMaterial({ color: 0x91f5ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    ring.rotation.x = Math.PI / 2;
    ring.position.z = 0.02;
    root.add(body, nose, tail, core, ring);
    this.missileRoot.add(root);
    return { root, tail, core, ring };
  }
}

export { SkyDancerAirCombatFxV10 as SkyDancerAirCombatFx };
