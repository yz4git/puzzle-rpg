import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../cart/CartArenaSession";
import { CART_WORLD_GRAPH } from "../cart/CartWorldGraph";
import type { SkyDancerMissileState } from "./SkyDancerFlightCombat";
import { SkyDancerAirCombatFxV10 } from "./SkyDancerAirCombatFxV10";
import type { SkyDancerFxRuntime } from "./SkyDancerAirCombatFxV2";
import { getSkyDancerPlayerWeaponState } from "./SkyDancerPlayerWeapons";

const GROUND_Y = -34;

interface RibbonState {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  phase: number;
  side: number;
}

/**
 * Route-scale presentation pass created after reviewing the V10 real WebGL
 * capture. Its job is to fill the large empty olive areas with features big
 * enough to read from ~105 m while keeping the texture-free low-poly style.
 */
export class SkyDancerAirCombatFxV11 extends SkyDancerAirCombatFxV10 {
  private readonly runtimeV11: SkyDancerFxRuntime;
  private worldBuilt = false;
  private exhaustBuilt = false;
  private elapsedV11 = 0;
  private lastShotSerial = 0;
  private muzzleLife = 0;
  private readonly muzzleRoot = new THREE.Group();
  private readonly plumeRibbons: RibbonState[] = [];

  constructor(runtime: SkyDancerFxRuntime) {
    super(runtime);
    this.runtimeV11 = runtime;
    this.muzzleRoot.name = "sky-dancer-q11-muzzle-flash";
  }

  override update(snapshot: CartArenaSessionSnapshot, missiles: SkyDancerMissileState, delta: number): void {
    super.update(snapshot, missiles, delta);
    this.elapsedV11 += delta;
    if (!this.worldBuilt) {
      this.worldBuilt = true;
      this.buildRouteLandscape();
    }
    if (!this.exhaustBuilt) {
      this.exhaustBuilt = true;
      this.buildAfterburnerRibbons();
      this.buildMuzzleFlash();
    }
    this.updateAfterburnerRibbons(snapshot);
    this.updatePlayerWeaponFeedback(delta);
    this.enlargePlayerMissiles();
  }

  private elevation(x: number, z: number): number {
    return Math.sin(x * 0.011) * 0.72
      + Math.cos(z * 0.0105) * 0.66
      + Math.sin((x + z) * 0.0062) * 0.48
      + Math.cos((x - z) * 0.0051) * 0.36;
  }

  private groundAt(x: number, z: number, lift = 0): number {
    return GROUND_Y + this.elevation(x, z) + lift;
  }

  private buildRouteLandscape(): void {
    const scene = this.runtimeV11.scene;
    const nodes = CART_WORLD_GRAPH.nodes;

    // Large agricultural / park parcels. They are intentionally much larger
    // than V5's micro mosaic, so they remain legible in a fast chase camera.
    const parcelCount = nodes.length * 12;
    const parcelGeometry = new THREE.BoxGeometry(1, 0.045, 1);
    const parcelMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const parcels = new THREE.InstancedMesh(parcelGeometry, parcelMaterial, parcelCount);
    parcels.name = "sky-dancer-q11-route-parcels";
    const parcelDummy = new THREE.Object3D();
    const parcelColors = [0x657d4e, 0x789158, 0x9a8b58, 0x8d9b67, 0xb29a68, 0x6f885e].map((value) => new THREE.Color(value));
    let parcelIndex = 0;
    for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex += 1) {
      const node = nodes[nodeIndex];
      for (let local = 0; local < 12; local += 1) {
        const side = local % 2 === 0 ? -1 : 1;
        const band = Math.floor(local / 2);
        const x = node.rect.centerX + side * (42 + band * 17 + (nodeIndex % 3) * 5);
        const z = node.rect.centerZ + (band - 2.5) * 15 + Math.sin((nodeIndex + 1) * (local + 2)) * 5;
        const sx = 12 + ((nodeIndex + local) % 5) * 5.5;
        const sz = 9 + ((nodeIndex * 3 + local) % 4) * 5;
        parcelDummy.position.set(x, this.groundAt(x, z, 0.31), z);
        parcelDummy.rotation.set(0, (nodeIndex % 4 - 1.5) * 0.025 + side * 0.018, 0);
        parcelDummy.scale.set(sx, 1, sz);
        parcelDummy.updateMatrix();
        parcels.setMatrixAt(parcelIndex, parcelDummy.matrix);
        parcels.setColorAt(parcelIndex, parcelColors[(nodeIndex + local * 2) % parcelColors.length]);
        parcelIndex += 1;
      }
    }
    parcels.instanceMatrix.needsUpdate = true;
    if (parcels.instanceColor) parcels.instanceColor.needsUpdate = true;
    parcels.frustumCulled = false;
    scene.add(parcels);

    // Hedgerows and windbreaks create strong dark borders between parcels.
    const hedgeCount = nodes.length * 16;
    const hedges = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 0.55, 1),
      new THREE.MeshLambertMaterial({ color: 0x355b3d }),
      hedgeCount,
    );
    hedges.name = "sky-dancer-q11-hedgerows";
    const hedgeDummy = new THREE.Object3D();
    let hedgeIndex = 0;
    for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex += 1) {
      const node = nodes[nodeIndex];
      for (let local = 0; local < 16; local += 1) {
        const side = local % 2 === 0 ? -1 : 1;
        const band = Math.floor(local / 2);
        const x = node.rect.centerX + side * (34 + (band % 4) * 24);
        const z = node.rect.centerZ + (band - 3.5) * 12;
        const horizontal = local % 4 < 2;
        hedgeDummy.position.set(x, this.groundAt(x, z, 0.62), z);
        hedgeDummy.rotation.set(0, horizontal ? Math.PI / 2 : 0, 0);
        hedgeDummy.scale.set(0.65, 1, 18 + (local % 5) * 4.2);
        hedgeDummy.updateMatrix();
        hedges.setMatrixAt(hedgeIndex++, hedgeDummy.matrix);
      }
    }
    hedges.instanceMatrix.needsUpdate = true;
    hedges.frustumCulled = false;
    scene.add(hedges);

    // Route-side towns: taller and closer to the playable corridor than V9's
    // background settlement grid, with two materials for stronger color breakup.
    const townRoot = new THREE.Group();
    townRoot.name = "sky-dancer-q11-route-towns";
    const light = new THREE.MeshStandardMaterial({ color: 0xc8c0af, roughness: 0.86, flatShading: true });
    const warm = new THREE.MeshStandardMaterial({ color: 0xb88366, roughness: 0.9, flatShading: true });
    for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex += 2) {
      const node = nodes[nodeIndex];
      const side = nodeIndex % 4 < 2 ? -1 : 1;
      const cx = node.rect.centerX + side * (72 + (nodeIndex % 3) * 14);
      const cz = node.rect.centerZ + 7;
      for (let local = 0; local < 16; local += 1) {
        const x = cx + (local % 4 - 1.5) * 7.2;
        const z = cz + (Math.floor(local / 4) - 1.5) * 7.2;
        const h = 3.2 + (local % 6) * 1.25;
        const building = new THREE.Mesh(new THREE.BoxGeometry(3.1 + (local % 3) * 0.8, h, 3.0 + ((local + 1) % 3) * 0.7), local % 4 === 0 ? warm : light);
        building.position.set(x, this.groundAt(x, z, h * 0.5 + 0.3), z);
        building.rotation.y = side * 0.04;
        townRoot.add(building);
      }
    }
    scene.add(townRoot);

    // Highways and lane stripes form a readable network through the route.
    const highwayRoot = new THREE.Group();
    highwayRoot.name = "sky-dancer-q11-highways";
    const asphalt = new THREE.MeshBasicMaterial({ color: 0x515c5d, transparent: true, opacity: 0.82, depthWrite: false });
    const lane = new THREE.MeshBasicMaterial({ color: 0xe4dcc6, transparent: true, opacity: 0.62, depthWrite: false });
    for (const x of [-24, 0, 24]) {
      const highway = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.05, 720), asphalt.clone());
      highway.position.set(x, this.groundAt(x, 250, 0.48), 250);
      highwayRoot.add(highway);
      for (const laneOffset of [-1.15, 1.15]) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.055, 720), lane.clone());
        stripe.position.set(x + laneOffset, this.groundAt(x, 250, 0.52), 250);
        highwayRoot.add(stripe);
      }
    }
    for (const z of [82, 212, 342, 472]) {
      const cross = new THREE.Mesh(new THREE.BoxGeometry(310, 0.05, 3.5), asphalt.clone());
      cross.position.set(0, this.groundAt(0, z, 0.48), z);
      highwayRoot.add(cross);
    }
    scene.add(highwayRoot);

    // A few large industrial landmarks make the horizon less repetitive.
    const landmarkRoot = new THREE.Group();
    landmarkRoot.name = "sky-dancer-q11-landmarks";
    const siloMaterial = new THREE.MeshStandardMaterial({ color: 0x9aa7a5, roughness: 0.67, metalness: 0.16, flatShading: true });
    for (let index = 0; index < 18; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const x = side * (112 + (index % 5) * 17);
      const z = 42 + index * 29;
      const h = 6 + (index % 5) * 1.5;
      const silo = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.7, h, 8), siloMaterial.clone());
      silo.position.set(x, this.groundAt(x, z, h * 0.5 + 0.35), z);
      landmarkRoot.add(silo);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(2.75, 1.7, 8), siloMaterial.clone());
      cap.position.set(x, this.groundAt(x, z, h + 1.15), z);
      landmarkRoot.add(cap);
    }
    scene.add(landmarkRoot);
  }

  private ribbonGeometry(width: number, length: number): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([
      -width, 0, 0,
      width, 0, 0,
      -width * 0.08, 0, -length,
      width, 0, 0,
      width * 0.08, 0, -length,
      -width * 0.08, 0, -length,
    ], 3));
    geometry.computeVertexNormals();
    return geometry;
  }

  private buildAfterburnerRibbons(): void {
    const player = this.runtimeV11.playerVisual;
    for (const side of [-1, 1]) {
      for (let index = 0; index < 3; index += 1) {
        const material = new THREE.MeshBasicMaterial({
          color: index === 0 ? 0xbff8ff : index === 1 ? 0x43dcff : 0x268fd9,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
          side: THREE.DoubleSide,
        });
        const ribbon = new THREE.Mesh(this.ribbonGeometry(0.24 + index * 0.14, 5.6 + index * 1.35), material);
        ribbon.name = "sky-dancer-q11-turbo-ribbon";
        ribbon.position.set(side * 0.34, 0.35 + (index - 1) * 0.045, -2.15);
        ribbon.rotation.z = (index - 1) * 0.18 * side;
        ribbon.rotation.x = (index - 1) * 0.045;
        player.add(ribbon);
        this.plumeRibbons.push({ mesh: ribbon, phase: index * 0.87 + (side > 0 ? 0.45 : 0), side });
      }
    }
  }

  private buildMuzzleFlash(): void {
    const player = this.runtimeV11.playerVisual;
    const material = new THREE.MeshBasicMaterial({
      color: 0xcffaff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    for (const side of [-1, 1]) {
      const geometry = new THREE.ConeGeometry(0.22, 1.15, 7, 1, true);
      geometry.rotateX(Math.PI / 2);
      const flash = new THREE.Mesh(geometry, material.clone());
      flash.position.set(side * 0.62, 0.34, 2.55);
      this.muzzleRoot.add(flash);
    }
    const light = new THREE.PointLight(0x83edff, 0, 13, 2);
    light.name = "sky-dancer-q11-muzzle-light";
    light.position.set(0, 0.4, 2.25);
    this.muzzleRoot.add(light);
    this.muzzleRoot.visible = false;
    player.add(this.muzzleRoot);
  }

  private updateAfterburnerRibbons(snapshot: CartArenaSessionSnapshot): void {
    const q9 = this.runtimeV11.playerVisual.getObjectByName("sky-dancer-q9-afterburner-system");
    const active = Boolean(q9?.visible || snapshot.boostActive);
    for (const state of this.plumeRibbons) {
      state.mesh.visible = active;
      if (!active) continue;
      const flicker = 0.75 + Math.sin(this.elapsedV11 * 24 + state.phase) * 0.18;
      state.mesh.material.opacity = 0.18 + flicker * 0.28;
      state.mesh.scale.z = 0.84 + flicker * 0.28;
      state.mesh.scale.x = 0.9 + Math.sin(this.elapsedV11 * 17 + state.phase) * 0.08;
    }

    // De-emphasize the bright rod-like cores from V9 now that the wider feathered
    // plume is present. Diamonds and compression rings remain untouched.
    this.runtimeV11.playerVisual.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshBasicMaterial)) return;
      if (object.name === "sky-dancer-q9-turbo-plume" || object.name === "sky-dancer-q9-turbo-core") {
        object.material.opacity *= 0.58;
      }
    });
  }

  private updatePlayerWeaponFeedback(delta: number): void {
    const state = getSkyDancerPlayerWeaponState(this.runtimeV11.session);
    if (state.shotSerial !== this.lastShotSerial) {
      this.lastShotSerial = state.shotSerial;
      this.muzzleLife = 0.12;
    }
    this.muzzleLife = Math.max(0, this.muzzleLife - delta);
    const strength = THREE.MathUtils.clamp(this.muzzleLife / 0.12, 0, 1);
    this.muzzleRoot.visible = strength > 0.01;
    for (const child of this.muzzleRoot.children) {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
        child.material.opacity = strength * 0.84;
        child.scale.setScalar(0.8 + (1 - strength) * 0.75);
      } else if (child instanceof THREE.PointLight) {
        child.intensity = strength * 5.8;
      }
    }
  }

  private enlargePlayerMissiles(): void {
    this.runtimeV11.scene.traverse((object) => {
      if (object.name !== "sky-dancer-q10-player-missile") return;
      object.scale.setScalar(1.42);
    });
  }
}

export { SkyDancerAirCombatFxV11 as SkyDancerAirCombatFx };
