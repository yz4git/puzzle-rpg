import * as THREE from "three";
import type { CartArenaSession, CartArenaSessionSnapshot } from "../cart/CartArenaSession";
import type { SkyDancerMissileState } from "./SkyDancerFlightCombat";
import { SkyDancerAirCombatFxV20 } from "./SkyDancerAirCombatFxV20";
import type { SkyDancerFxRuntime } from "./SkyDancerAirCombatFxV2";
import { getSkyDancerPlayerWeaponState } from "./SkyDancerPlayerWeapons";

interface HitBurst {
  root: THREE.Group;
  life: number;
  maxLife: number;
  light: THREE.PointLight;
}

/** V21 makes every player-missile impact unmistakable in both world and HUD space. */
export class SkyDancerAirCombatFxV21 extends SkyDancerAirCombatFxV20 {
  private readonly runtimeV21: SkyDancerFxRuntime;
  private readonly hitBursts: HitBurst[] = [];
  private readonly hitBurstPool: HitBurst[] = [];
  private readonly hitPoint = new THREE.Vector3();
  private readonly hitConfirm = new THREE.Group();
  private lastHitSerial = 0;
  private hitConfirmLife = 0;
  private elapsedV21 = 0;

  constructor(runtime: SkyDancerFxRuntime) {
    super(runtime);
    this.runtimeV21 = runtime;
    this.buildHitConfirm();
    this.prewarmHitBursts();
  }

  override update(snapshot: CartArenaSessionSnapshot, missiles: SkyDancerMissileState, delta: number): void {
    super.update(snapshot, missiles, delta);
    this.elapsedV21 += delta;
    this.detectPlayerMissileHit();
    this.updateHitBursts(delta);
    this.updateHitConfirm(delta);
  }

  private buildHitConfirm(): void {
    this.hitConfirm.name = "sky-dancer-v21-missile-hit-confirm";
    this.hitConfirm.position.set(0, 0.015, -0.72);
    this.hitConfirm.visible = false;

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xffdf6b,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.01, 5, 32), ringMaterial);
    ring.renderOrder = 1400;
    this.hitConfirm.add(ring);

    for (let index = 0; index < 4; index += 1) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.009, 0.004),
        ringMaterial.clone(),
      );
      const angle = Math.PI * 0.25 + index * Math.PI * 0.5;
      bar.position.set(Math.cos(angle) * 0.155, Math.sin(angle) * 0.155, 0);
      bar.rotation.z = angle;
      bar.renderOrder = 1400;
      this.hitConfirm.add(bar);
    }
    this.runtimeV21.camera.add(this.hitConfirm);
  }

  private detectPlayerMissileHit(): void {
    const state = getSkyDancerPlayerWeaponState(this.runtimeV21.session as unknown as CartArenaSession);
    if (state.hitSerial <= this.lastHitSerial) return;
    this.lastHitSerial = state.hitSerial;

    const target = state.lastHitEnemyId
      ? this.runtimeV21.enemyGroups.get(state.lastHitEnemyId)
      : undefined;
    if (target) this.hitPoint.copy(target.position);
    else this.hitPoint.set(state.lastHitX, 1.55, state.lastHitZ);
    if (this.hitPoint.y < 0.8) this.hitPoint.y = 1.55;
    this.spawnMissileHitBurst(this.hitPoint);

    this.runtimeV21.cameraShake = Math.max(this.runtimeV21.cameraShake, 0.78);
    this.runtimeV21.impactFlash = Math.max(this.runtimeV21.impactFlash, 0.9);
    this.runtimeV21.impactOverlayMaterial.color.setHex(0xffd85c);
    this.runtimeV21.emitImpactSparks(this.hitPoint, 20);
    this.hitConfirmLife = 0.34;
    this.hitConfirm.visible = true;
    this.hitConfirm.scale.setScalar(0.7);
  }

  private spawnMissileHitBurst(position: THREE.Vector3): void {
    if (this.hitBursts.length >= 4) {
      const oldest = this.hitBursts.shift();
      if (oldest) this.releaseMissileHitBurst(oldest);
    }
    const burst = this.hitBurstPool.pop() ?? this.createMissileHitBurst();
    burst.life = burst.maxLife;
    burst.root.visible = true;
    burst.root.position.copy(position);
    burst.root.scale.setScalar(1);
    burst.root.rotation.set(0, 0, 0);
    burst.light.intensity = 7.5;
    for (const child of burst.root.children) {
      if (!(child instanceof THREE.Mesh)) continue;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        if ("opacity" in material) material.opacity = child.name === "sky-dancer-v21-impact-core" ? 1 : 0.9;
      }
    }
    this.hitBursts.push(burst);
  }

  private prewarmHitBursts(): void {
    while (this.hitBurstPool.length < 4) this.hitBurstPool.push(this.createMissileHitBurst());
  }

  private createMissileHitBurst(): HitBurst {
    const root = new THREE.Group();
    root.name = "sky-dancer-v21-player-missile-impact";
    root.visible = false;

    const hot = new THREE.MeshBasicMaterial({
      color: 0xfff4b0,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const orange = new THREE.MeshBasicMaterial({
      color: 0xff7a32,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const smoke = new THREE.MeshLambertMaterial({
      color: 0x384653,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
      flatShading: true,
    });

    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.72, 1), hot);
    core.name = "sky-dancer-v21-impact-core";
    root.add(core);

    for (const scale of [1, 1.6, 2.25]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72 * scale, 0.07 / Math.max(1, scale * 0.7), 5, 28), orange.clone());
      ring.rotation.x = Math.PI / 2;
      root.add(ring);
    }

    for (let index = 0; index < 18; index += 1) {
      const ray = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.055, 1.8 + (index % 5) * 0.42),
        index % 3 === 0 ? hot.clone() : orange.clone(),
      );
      ray.position.y = (index % 3 - 1) * 0.13;
      ray.rotation.y = index / 18 * Math.PI * 2;
      ray.rotation.x = (index % 5 - 2) * 0.095;
      ray.position.x = Math.sin(ray.rotation.y) * 0.42;
      ray.position.z = Math.cos(ray.rotation.y) * 0.42;
      root.add(ray);
    }

    for (let index = 0; index < 10; index += 1) {
      const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(0.46 + (index % 3) * 0.12, 0), smoke.clone());
      const angle = index / 10 * Math.PI * 2;
      puff.position.set(Math.cos(angle) * (0.55 + (index % 2) * 0.22), 0.25 + (index % 4) * 0.16, Math.sin(angle) * (0.55 + (index % 2) * 0.22));
      puff.rotation.set(index * 0.31, index * 0.47, index * 0.19);
      root.add(puff);
    }

    const light = new THREE.PointLight(0xffa43d, 7.5, 18, 2);
    root.add(light);
    this.runtimeV21.scene.add(root);
    return { root, life: 0, maxLife: 0.62, light };
  }

  private updateHitBursts(delta: number): void {
    for (let index = this.hitBursts.length - 1; index >= 0; index -= 1) {
      const burst = this.hitBursts[index];
      burst.life -= delta;
      const ratio = THREE.MathUtils.clamp(burst.life / burst.maxLife, 0, 1);
      const growth = 1 + (1 - ratio) * 2.7;
      burst.root.scale.setScalar(growth);
      burst.root.rotation.y += delta * 1.8;
      burst.light.intensity = 7.5 * ratio * ratio;
      for (const child of burst.root.children) {
        if (!(child instanceof THREE.Mesh)) continue;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) {
          if ("opacity" in material) material.opacity = Math.min(material.opacity, ratio);
        }
      }
      if (burst.life > 0) continue;
      this.releaseMissileHitBurst(burst);
      this.hitBursts.splice(index, 1);
    }
  }

  private releaseMissileHitBurst(burst: HitBurst): void {
    burst.life = 0;
    burst.root.visible = false;
    burst.light.intensity = 0;
    this.hitBurstPool.push(burst);
  }

  private updateHitConfirm(delta: number): void {
    if (this.hitConfirmLife <= 0) {
      this.hitConfirm.visible = false;
      return;
    }
    this.hitConfirmLife = Math.max(0, this.hitConfirmLife - delta);
    const ratio = this.hitConfirmLife / 0.34;
    const pulse = 1 + Math.sin(this.elapsedV21 * 38) * 0.08;
    this.hitConfirm.rotation.z += delta * 2.4;
    this.hitConfirm.scale.setScalar((0.78 + (1 - ratio) * 0.62) * pulse);
    for (const child of this.hitConfirm.children) {
      if (!(child instanceof THREE.Mesh)) continue;
      (child.material as THREE.MeshBasicMaterial).opacity = Math.max(0, ratio) * 0.95;
    }
  }
}

export { SkyDancerAirCombatFxV21 as SkyDancerAirCombatFx };
