import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../../cart/CartArenaSession";
import type { SkyDancerFxRuntime } from "../SkyDancerAirCombatFxV2";

const SNAP = 420;
const GROUND_Y = -66.30;
const CLOUD_CLUSTERS = 24;
const PUFFS_PER_CLUSTER = 4;
const CLOUD_INSTANCES = CLOUD_CLUSTERS * PUFFS_PER_CLUSTER;

function hash1(value: number, salt = 0): number {
  let n = Math.imul(value + salt * 0x45d9f3b, 0x27d4eb2d);
  n ^= n >>> 15;
  n = Math.imul(n, 0x85ebca6b);
  n ^= n >>> 13;
  return (n >>> 0) / 0xffffffff;
}

/**
 * V38 atmosphere pass.
 * Replaces repeated cone mountains and isolated flattened cloud primitives with
 * continuous low-poly ridge strips and clustered below-flight cloud puffs.
 */
export class SkyDancerV38AtmospherePass {
  private readonly sky: THREE.Mesh;
  private readonly ridgeRoot = new THREE.Group();
  private readonly farRidge: THREE.Mesh;
  private readonly nearRidge: THREE.Mesh;
  private readonly cloudRoot = new THREE.Group();
  private readonly cloudMain: THREE.InstancedMesh;
  private readonly cloudShade: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private tileX = Number.NaN;
  private tileZ = Number.NaN;

  constructor(private readonly runtime: SkyDancerFxRuntime) {
    this.sky = this.makeSky();
    this.sky.name = "sky-dancer-v38-four-band-sky";
    this.farRidge = this.makeRidge("sky-dancer-v38-ridge-far", 58, 900, 38, 0x728fa0, 0.52, 71);
    this.nearRidge = this.makeRidge("sky-dancer-v38-ridge-near", 52, 720, 52, 0x557b86, 0.76, 113);
    this.ridgeRoot.name = "sky-dancer-v38-ridge-root";
    this.ridgeRoot.add(this.farRidge, this.nearRidge);

    const puffGeometry = new THREE.IcosahedronGeometry(1, 1);
    this.cloudMain = new THREE.InstancedMesh(
      puffGeometry,
      new THREE.MeshBasicMaterial({ color: 0xf7fbfc, transparent: true, opacity: 0.24, depthWrite: false, depthTest: true, fog: true, toneMapped: false }),
      CLOUD_INSTANCES,
    );
    this.cloudShade = new THREE.InstancedMesh(
      puffGeometry,
      new THREE.MeshBasicMaterial({ color: 0x9fb5be, transparent: true, opacity: 0.10, depthWrite: false, depthTest: true, fog: true, toneMapped: false }),
      CLOUD_INSTANCES,
    );
    this.cloudMain.name = "sky-dancer-v38-cloud-cluster-main";
    this.cloudShade.name = "sky-dancer-v38-cloud-cluster-shade";
    this.cloudMain.frustumCulled = false;
    this.cloudShade.frustumCulled = false;
    this.cloudRoot.name = "sky-dancer-v38-below-flight-clouds";
    this.cloudRoot.add(this.cloudShade, this.cloudMain);

    runtime.scene.add(this.sky, this.ridgeRoot, this.cloudRoot);
    runtime.scene.userData.skyDancerV38Atmosphere = true;
  }

  update(snapshot: CartArenaSessionSnapshot): void {
    this.suppressLegacyAtmosphere();
    // V30/V32 legacy cleanup/restoration runs before this pass and can touch any
    // object whose semantic name resembles cloud/ridge presentation. V38 is the
    // final atmosphere owner, so restore both roots and owned children here.
    this.sky.visible = true;
    this.ridgeRoot.visible = true;
    this.farRidge.visible = true;
    this.nearRidge.visible = true;
    this.cloudRoot.visible = true;
    this.cloudMain.visible = true;
    this.cloudShade.visible = true;
    this.sky.position.set(snapshot.x, 0, snapshot.z);

    const tileX = Math.floor(snapshot.x / SNAP);
    const tileZ = Math.floor(snapshot.z / SNAP);
    if (tileX !== this.tileX || tileZ !== this.tileZ) {
      this.tileX = tileX;
      this.tileZ = tileZ;
      this.ridgeRoot.position.set(tileX * SNAP, 0, tileZ * SNAP);
      this.cloudRoot.position.set(tileX * SNAP, 0, tileZ * SNAP);
      this.rebuildClouds(tileX, tileZ);
    }

    const fog = this.runtime.scene.fog;
    if (fog instanceof THREE.Fog) {
      fog.color.setHex(0x9ac9da);
      fog.near = 540;
      fog.far = 1840;
    }
    if (!(this.runtime.scene.background instanceof THREE.Color)) this.runtime.scene.background = new THREE.Color(0x73b5d4);
    else this.runtime.scene.background.setHex(0x73b5d4);
  }

  private suppressLegacyAtmosphere(): void {
    for (const name of [
      "sky-dancer-v34-sky-gradient",
      "sky-dancer-v35-front-mountains-far",
      "sky-dancer-v35-front-mountains-near",
      "sky-dancer-v35-front-cloud-patches",
    ]) {
      const object = this.runtime.scene.getObjectByName(name);
      if (object) object.visible = false;
    }
  }

  private makeSky(): THREE.Mesh {
    const radius = 1250;
    const geometry = new THREE.SphereGeometry(radius, 24, 14);
    const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
    const colors = new Float32Array(positions.count * 3);
    const zenith = new THREE.Color(0x18588f);
    const upper = new THREE.Color(0x347caf);
    const horizon = new THREE.Color(0x79b9d5);
    const haze = new THREE.Color(0xa8cedb);
    const color = new THREE.Color();
    for (let index = 0; index < positions.count; index += 1) {
      const y = THREE.MathUtils.clamp(positions.getY(index) / radius, -1, 1);
      if (y > 0.48) color.lerpColors(upper, zenith, (y - 0.48) / 0.52);
      else if (y > 0.04) color.lerpColors(horizon, upper, (y - 0.04) / 0.44);
      else color.lerpColors(haze, horizon, THREE.MathUtils.clamp((y + 0.18) / 0.22, 0, 1));
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = -1200;
    return mesh;
  }

  private makeRidge(
    name: string,
    segments: number,
    zBase: number,
    baseHeight: number,
    colorHex: number,
    opacity: number,
    salt: number,
  ): THREE.Mesh {
    const positions: number[] = [];
    const colors: number[] = [];
    const baseColor = new THREE.Color(colorHex);
    const faceColor = new THREE.Color();
    const width = 1480;
    for (let segment = 0; segment < segments; segment += 1) {
      const x0 = -width * 0.5 + width * (segment / segments);
      const x1 = -width * 0.5 + width * ((segment + 1) / segments);
      const h0 = baseHeight * (0.66 + hash1(segment, salt) * 0.70);
      const h1 = baseHeight * (0.66 + hash1(segment + 1, salt) * 0.70);
      const z0 = zBase + (hash1(segment, salt + 30) - 0.5) * 50;
      const z1 = zBase + (hash1(segment + 1, salt + 30) - 0.5) * 50;
      positions.push(x0, GROUND_Y, z0, x1, GROUND_Y, z1, x1, GROUND_Y + h1, z1);
      positions.push(x0, GROUND_Y, z0, x1, GROUND_Y + h1, z1, x0, GROUND_Y + h0, z0);
      faceColor.copy(baseColor).multiplyScalar(0.82 + hash1(segment, salt + 90) * 0.26);
      for (let index = 0; index < 6; index += 1) colors.push(faceColor.r, faceColor.g, faceColor.b);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity, depthWrite: false, depthTest: true, fog: true, toneMapped: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.frustumCulled = false;
    return mesh;
  }

  private rebuildClouds(tileX: number, tileZ: number): void {
    let instance = 0;
    for (let cluster = 0; cluster < CLOUD_CLUSTERS; cluster += 1) {
      const side = cluster % 2 === 0 ? -1 : 1;
      const lane = Math.floor(cluster / 2) % 8;
      const baseX = side * (62 + (cluster % 6) * 54) + (hash1(cluster + tileX, 30) - 0.5) * 42;
      const baseZ = 115 + lane * 60 + hash1(cluster + tileZ, 44) * 30;
      const baseY = -50 - (cluster % 4) * 1.6;
      for (let puff = 0; puff < PUFFS_PER_CLUSTER; puff += 1) {
        const angle = (puff / PUFFS_PER_CLUSTER) * Math.PI * 2 + hash1(cluster, 77) * 0.8;
        const size = 9.8 + hash1(cluster * 7 + puff, 91) * 8.2;
        const x = baseX + Math.cos(angle) * size * 0.74;
        const z = baseZ + Math.sin(angle) * size * 0.54;
        const y = baseY + (puff % 2) * 1.0;
        this.dummy.position.set(x, y, z);
        this.dummy.rotation.set(0.03 * puff, angle * 0.35, 0.015 * cluster);
        this.dummy.scale.set(size * 1.58, size * 0.26, size * 1.04);
        this.dummy.updateMatrix();
        this.cloudMain.setMatrixAt(instance, this.dummy.matrix);
        this.dummy.position.y -= 1.7;
        this.dummy.scale.multiplyScalar(0.94);
        this.dummy.updateMatrix();
        this.cloudShade.setMatrixAt(instance, this.dummy.matrix);
        instance += 1;
      }
    }
    this.cloudMain.count = instance;
    this.cloudShade.count = instance;
    this.cloudMain.instanceMatrix.needsUpdate = true;
    this.cloudShade.instanceMatrix.needsUpdate = true;
  }
}
