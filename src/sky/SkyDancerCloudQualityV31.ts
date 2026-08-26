import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../cart/CartArenaSession";

interface CloudRuntime {
  scene: THREE.Scene;
  camera?: THREE.PerspectiveCamera;
}

type CloudLayerConfig = {
  name: string;
  clusters: number;
  lobes: number;
  radiusMin: number;
  radiusMax: number;
  yMin: number;
  yMax: number;
  sizeMin: number;
  sizeMax: number;
  opacity: number;
  solid: boolean;
  fog: boolean;
};

const WORLD_SNAP = 105;
const LEGACY_CLOUD_NAMES = [
  "sky-dancer-base-cloud-deck",
  "sky-dancer-v25-horizon-cloud-banks",
  "sky-dancer-v28-layered-cloud-banks",
  "sky-dancer-v29-reference-cloud-bank",
] as const;

function rand(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Texture-free V31 cumulus system. Each layer uses a small number of dense
 * clusters instead of many isolated blobs, so the cloud silhouette reads as a
 * real cumulus mass while keeping the total instance budget essentially flat.
 */
export class SkyDancerCloudQualityV31 {
  private readonly root = new THREE.Group();
  private readonly layers: THREE.InstancedMesh[] = [];
  private snapX = Number.NaN;
  private snapZ = Number.NaN;

  constructor(private readonly runtime: CloudRuntime) {
    this.root.name = "sky-dancer-v31-cloud-system";
    const configs: CloudLayerConfig[] = [
      {
        name: "sky-dancer-v31-low-clouds",
        clusters: 9,
        lobes: 12,
        radiusMin: 280,
        radiusMax: 500,
        yMin: -32,
        yMax: -16,
        sizeMin: 5.0,
        sizeMax: 8.2,
        opacity: 1,
        solid: true,
        fog: false,
      },
      {
        name: "sky-dancer-v31-mid-clouds",
        clusters: 12,
        lobes: 14,
        radiusMin: 400,
        radiusMax: 680,
        yMin: -14,
        yMax: 18,
        sizeMin: 6.8,
        sizeMax: 10.8,
        opacity: 1,
        solid: true,
        fog: false,
      },
      {
        name: "sky-dancer-v31-horizon-clouds",
        clusters: 14,
        lobes: 16,
        radiusMin: 660,
        radiusMax: 980,
        yMin: -2,
        yMax: 36,
        sizeMin: 10.0,
        sizeMax: 16.8,
        opacity: 0.90,
        solid: false,
        fog: true,
      },
    ];

    configs.forEach((config, index) => {
      const layer = this.buildLayer(config, index * 10000 + 71);
      this.layers.push(layer);
      this.root.add(layer);
    });
    runtime.scene.add(this.root);
    if (runtime.camera) {
      runtime.camera.far = Math.max(runtime.camera.far, 1650);
      runtime.camera.updateProjectionMatrix();
    }
    this.hideLegacyClouds();
  }

  update(snapshot: CartArenaSessionSnapshot): void {
    this.hideLegacyClouds();
    const x = Math.floor(snapshot.x / WORLD_SNAP) * WORLD_SNAP;
    const z = Math.floor(snapshot.z / WORLD_SNAP) * WORLD_SNAP;
    if (x === this.snapX && z === this.snapZ) return;
    this.snapX = x;
    this.snapZ = z;
    this.root.position.set(x, 0, z);
  }

  private hideLegacyClouds(): void {
    for (const name of LEGACY_CLOUD_NAMES) {
      const cloud = this.runtime.scene.getObjectByName(name);
      if (cloud) cloud.visible = false;
    }

    this.runtime.scene.traverse((object) => {
      if (object === this.root || this.layers.includes(object as THREE.InstancedMesh)) return;
      const name = object.name.toLowerCase();
      if (name.includes("cloud") && !name.includes("v31")) {
        object.visible = false;
        object.userData.skyDancerV31LegacyCloudHidden = true;
      }
    });

    for (const child of this.runtime.scene.children) {
      if (!(child instanceof THREE.InstancedMesh) || this.layers.includes(child)) continue;
      const material = child.material;
      if (child.name) continue;
      if (child.geometry.type !== "DodecahedronGeometry") continue;
      if (!(material instanceof THREE.MeshLambertMaterial)) continue;
      if (!material.transparent || material.opacity < 0.35 || material.opacity > 0.5) continue;
      child.visible = false;
      child.userData.skyDancerV31LegacyCloudHidden = true;
    }
  }

  private buildLayer(config: CloudLayerConfig, seedOffset: number): THREE.InstancedMesh {
    const count = config.clusters * config.lobes;
    const geometry = new THREE.IcosahedronGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: false,
      transparent: !config.solid,
      opacity: config.opacity,
      depthWrite: config.solid,
      depthTest: true,
      fog: config.fog,
      toneMapped: false,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.name = config.name;
    mesh.frustumCulled = false;

    const light = new THREE.Color(0xf9fdff);
    const mid = new THREE.Color(0xdceaf1);
    const shade = new THREE.Color(0xb2c9d4);
    const sample = new THREE.Color();
    const dummy = new THREE.Object3D();
    let index = 0;

    for (let cluster = 0; cluster < config.clusters; cluster += 1) {
      const baseSeed = seedOffset + cluster * 97;
      const evenAngle = cluster / config.clusters * Math.PI * 2;
      const angle = evenAngle + (rand(baseSeed + 1) - 0.5) * 0.15;
      const radius = THREE.MathUtils.lerp(config.radiusMin, config.radiusMax, rand(baseSeed + 2));
      const centerX = Math.cos(angle) * radius;
      const centerZ = Math.sin(angle) * radius;
      const centerY = THREE.MathUtils.lerp(config.yMin, config.yMax, rand(baseSeed + 3));
      const spread = THREE.MathUtils.lerp(4.5, 8.5, rand(baseSeed + 4));

      for (let lobe = 0; lobe < config.lobes; lobe += 1) {
        const seed = baseSeed + lobe * 17;
        const lobeAngle = rand(seed + 5) * Math.PI * 2;
        const ring = lobe === 0 ? 0 : 0.8 + rand(seed + 6) * spread;
        const size = THREE.MathUtils.lerp(config.sizeMin, config.sizeMax, rand(seed + 7));
        const crown = lobe % 5 === 0 ? size * 0.46 : 0;
        const verticalBias = lobe === 0
          ? size * 0.26
          : (rand(seed + 8) - 0.38) * size * 0.62 + crown;

        dummy.position.set(
          centerX + Math.cos(lobeAngle) * ring,
          centerY + verticalBias,
          centerZ + Math.sin(lobeAngle) * ring * 0.78,
        );
        dummy.rotation.set(rand(seed + 9) * 0.26, rand(seed + 10) * Math.PI, rand(seed + 11) * 0.22);
        dummy.scale.set(
          size * THREE.MathUtils.lerp(0.98, 1.20, rand(seed + 12)),
          size * THREE.MathUtils.lerp(0.88, 1.22, rand(seed + 13)),
          size * THREE.MathUtils.lerp(0.98, 1.22, rand(seed + 14)),
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);

        const heightTone = THREE.MathUtils.clamp(0.52 + verticalBias / Math.max(1, size) * 0.30 + rand(seed + 15) * 0.14, 0, 1);
        sample.lerpColors(shade, mid, THREE.MathUtils.clamp(heightTone * 1.24, 0, 1));
        sample.lerp(light, Math.max(0, heightTone - 0.52) * 1.18);
        mesh.setColorAt(index, sample);
        index += 1;
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return mesh;
  }
}
