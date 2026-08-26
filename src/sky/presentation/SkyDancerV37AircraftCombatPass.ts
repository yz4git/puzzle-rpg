import * as THREE from "three";
import type { CartArenaSessionSnapshot, CartEnemySnapshot } from "../../cart/CartArenaSession";
import type { SkyDancerFxRuntime } from "../SkyDancerAirCombatFxV2";

function rearCone(radius: number, length: number, segments = 8): THREE.ConeGeometry {
  const geometry = new THREE.ConeGeometry(radius, length, segments, 1, true);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function flatPanel(width: number, depth: number): THREE.BoxGeometry {
  return new THREE.BoxGeometry(width, 0.075, depth);
}

/**
 * V37 aircraft/combat visual pass.
 * Adds reference-style surface hierarchy, navigation accents and longer combat
 * streaks without touching hitboxes, missile physics, damage or Turbo rules.
 */
export class SkyDancerV37AircraftCombatPass {
  private readonly decoratedEnemies = new Set<string>();
  private readonly playerKit = new THREE.Group();
  private readonly speedLines = new THREE.Group();
  private readonly speedLineMaterial = new THREE.MeshBasicMaterial({
    color: 0xc9f5ff,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  private missileScanClock = 0;
  private elapsed = 0;

  constructor(private readonly runtime: SkyDancerFxRuntime) {
    this.buildPlayerKit();
    this.speedLines.name = "sky-dancer-v37-turbo-speed-lines";
    const geometry = new THREE.BoxGeometry(0.018, 0.018, 1);
    for (let index = 0; index < 14; index += 1) {
      const line = new THREE.Mesh(geometry, this.speedLineMaterial);
      const side = index % 2 === 0 ? -1 : 1;
      const lane = Math.floor(index / 2);
      line.position.set(side * (0.52 + lane * 0.33), 0.12 + (lane % 3) * 0.15, -1.4 - (lane % 4) * 0.28);
      line.scale.z = 2.0 + (index % 5) * 0.52;
      line.rotation.z = side * (0.03 + (lane % 3) * 0.02);
      this.speedLines.add(line);
    }
    this.speedLines.visible = false;
    this.attachBankedPlayerPresentation();
    runtime.scene.userData.skyDancerV37AircraftCombat = true;
  }

  update(snapshot: CartArenaSessionSnapshot): void {
    this.elapsed += 1 / 60;
    // SkyDancerWebGLDemo clears/rebuilds playerVisual after the presentation
    // pipeline is constructed. Reattach on every update so the kit survives
    // that rebuild while remaining under the same banked visual root as the
    // fuselage and tail assembly. Attaching to session.car.group made these
    // surfaces appear detached whenever playerVisual rolled.
    this.attachBankedPlayerPresentation();
    this.playerKit.visible = true;
    this.decorateEnemies(snapshot.enemies);
    this.updateTurboLines(snapshot);
    this.missileScanClock -= 1 / 60;
    if (this.missileScanClock <= 0) {
      this.missileScanClock = 0.45;
      this.decorateMissiles();
    }
    if (typeof window !== "undefined" && navigator.webdriver) {
      (window as unknown as Record<string, unknown>).__skyDancerGetV42AircraftAttachment = () => ({
        playerKitParentIsPlayerVisual: this.playerKit.parent === this.runtime.playerVisual,
        speedLinesParentIsPlayerVisual: this.speedLines.parent === this.runtime.playerVisual,
        playerKitParentName: this.playerKit.parent?.name ?? "",
      });
    }
  }

  private attachBankedPlayerPresentation(): void {
    const bankedVisualRoot = this.runtime.playerVisual;
    if (this.playerKit.parent !== bankedVisualRoot) bankedVisualRoot.add(this.playerKit);
    if (this.speedLines.parent !== bankedVisualRoot) bankedVisualRoot.add(this.speedLines);
  }

  private buildPlayerKit(): void {
    this.playerKit.name = "sky-dancer-v37-player-surface-kit";
    this.playerKit.userData.skyDancerV37Decorated = true;

    const white = new THREE.MeshStandardMaterial({ color: 0xe8eef0, roughness: 0.27, metalness: 0.28, flatShading: true });
    const blue = new THREE.MeshStandardMaterial({ color: 0x1767a8, roughness: 0.25, metalness: 0.32, flatShading: true });
    const navy = new THREE.MeshStandardMaterial({ color: 0x17344f, roughness: 0.32, metalness: 0.24, flatShading: true });
    const glow = new THREE.MeshBasicMaterial({
      color: 0x70eaff,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 2.35), white);
    spine.position.set(0, 0.62, 0.18);
    spine.rotation.x = -0.025;
    this.playerKit.add(spine);

    for (const side of [-1, 1]) {
      const wingPanel = new THREE.Mesh(flatPanel(1.55, 1.45), side < 0 ? blue : blue.clone());
      wingPanel.position.set(side * 1.28, 0.34, -0.18);
      wingPanel.rotation.y = side * -0.12;
      wingPanel.rotation.z = side * 0.06;
      this.playerKit.add(wingPanel);

      const intake = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.30, 0.82), navy);
      intake.position.set(side * 0.55, 0.34, 0.24);
      intake.rotation.y = side * 0.055;
      this.playerKit.add(intake);

      const edge = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.035, 0.05), glow);
      edge.position.set(side * 1.28, 0.39, -0.84);
      edge.rotation.y = side * -0.12;
      this.playerKit.add(edge);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.035, 6, 18), glow);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(side * 0.36, 0.36, -1.90);
      this.playerKit.add(ring);
    }

    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 10, 6),
      new THREE.MeshStandardMaterial({ color: 0x164969, roughness: 0.18, metalness: 0.42, transparent: true, opacity: 0.88 }),
    );
    canopy.scale.set(0.82, 0.48, 1.72);
    canopy.position.set(0, 0.77, 0.62);
    this.playerKit.add(canopy);

    this.runtime.playerVisual.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        material.roughness = Math.min(material.roughness, 0.34);
        material.metalness = Math.max(material.metalness, 0.20);
      }
    });
  }

  private decorateEnemies(enemies: readonly CartEnemySnapshot[]): void {
    for (const enemy of enemies) {
      if (!enemy.alive || this.decoratedEnemies.has(enemy.id)) continue;
      const group = this.runtime.enemyGroups.get(enemy.id);
      if (!group) continue;
      this.decoratedEnemies.add(enemy.id);
      group.userData.skyDancerV37Decorated = true;
      const boss = enemy.kind === "boss";
      const material = new THREE.MeshStandardMaterial({
        color: boss ? 0xa4243d : 0xb64545,
        roughness: 0.34,
        metalness: 0.24,
        flatShading: true,
      });
      const glow = new THREE.MeshBasicMaterial({
        color: boss ? 0xff4c63 : 0xff8a52,
        transparent: true,
        opacity: boss ? 0.78 : 0.58,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      for (const side of [-1, 1]) {
        const blade = new THREE.Mesh(flatPanel(boss ? 1.55 : 1.08, boss ? 0.82 : 0.66), material);
        blade.position.set(side * (boss ? 1.85 : 1.48), 0.30, -0.48);
        blade.rotation.y = side * -0.18;
        blade.rotation.z = side * 0.09;
        group.add(blade);

        const lamp = new THREE.Mesh(new THREE.SphereGeometry(boss ? 0.11 : 0.075, 7, 5), glow);
        lamp.position.set(side * (boss ? 2.68 : 2.38), 0.30, -0.68);
        group.add(lamp);
      }
    }
  }

  private decorateMissiles(): void {
    const candidates: THREE.Object3D[] = [];
    this.runtime.scene.traverse((object) => {
      if (object.name === "sky-dancer-missile-flame-v2" && object.parent) candidates.push(object.parent);
    });
    for (const group of candidates) {
      if (group.userData.skyDancerV37MissileStreak === true) continue;
      group.userData.skyDancerV37MissileStreak = true;
      const flame = group.getObjectByName("sky-dancer-missile-flame-v2");
      const boss = Boolean(flame && flame.position.z < -1.35);
      const plumeMaterial = new THREE.MeshBasicMaterial({
        color: boss ? 0xff7448 : 0xffb34f,
        transparent: true,
        opacity: boss ? 0.58 : 0.50,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const plume = new THREE.Mesh(rearCone(boss ? 0.20 : 0.16, boss ? 3.4 : 2.8, 8), plumeMaterial);
      plume.name = "sky-dancer-v37-missile-long-plume";
      plume.position.z = boss ? -2.45 : -2.0;
      group.add(plume);

      const smoke = new THREE.Mesh(
        new THREE.CylinderGeometry(boss ? 0.15 : 0.12, boss ? 0.30 : 0.24, boss ? 3.8 : 3.1, 7, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xe5ecec, transparent: true, opacity: 0.20, depthWrite: false, fog: true, toneMapped: false }),
      );
      smoke.name = "sky-dancer-v37-missile-smoke-core";
      smoke.rotation.x = Math.PI / 2;
      smoke.position.z = boss ? -3.4 : -2.85;
      group.add(smoke);
    }
  }

  private updateTurboLines(snapshot: CartArenaSessionSnapshot): void {
    const intensity = snapshot.boostActive ? THREE.MathUtils.clamp(0.50 + Math.abs(snapshot.speed) / 46, 0.50, 1) : 0;
    this.speedLines.visible = intensity > 0.02;
    this.speedLineMaterial.opacity = intensity * (0.22 + Math.sin(this.elapsed * 42) * 0.035);
    if (!this.speedLines.visible) return;
    for (let index = 0; index < this.speedLines.children.length; index += 1) {
      const child = this.speedLines.children[index];
      child.position.z = -1.55 - (index % 4) * 0.24 - Math.sin(this.elapsed * 32 + index) * 0.18;
      child.scale.z = 2.2 + (index % 5) * 0.55 + intensity * 1.4;
    }
  }
}
