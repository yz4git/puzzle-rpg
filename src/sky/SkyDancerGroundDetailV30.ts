import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../cart/CartArenaSession";

interface GroundDetailRuntime {
  scene: THREE.Scene;
}

const WORLD_CHUNK = 210;
const GROUND_Y = -66.45;
const FIELD_COUNT = 180;
const RIVER_SEGMENTS = 30;

/**
 * Owns the visible V30 ground detail. Unlike the inherited low-altitude field
 * passes, every surface here is opaque and depth-writing, so there is no layer
 * ordering path that can expose black/void-looking slabs during banking.
 */
export class SkyDancerGroundDetailV30 {
  private readonly root = new THREE.Group();
  private readonly fields: THREE.InstancedMesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  private chunkX = Number.NaN;
  private chunkZ = Number.NaN;

  constructor(runtime: GroundDetailRuntime) {
    this.root.name = "sky-dancer-v30-valley-detail";
    this.fields = this.buildFields();
    this.root.add(this.fields, this.buildRiver());
    runtime.scene.add(this.root);
  }

  update(snapshot: CartArenaSessionSnapshot): void {
    const x = Math.floor(snapshot.x / WORLD_CHUNK) * WORLD_CHUNK;
    const z = Math.floor(snapshot.z / WORLD_CHUNK) * WORLD_CHUNK;
    if (x === this.chunkX && z === this.chunkZ) return;
    this.chunkX = x;
    this.chunkZ = z;
    this.root.position.set(x, 0, z);
  }

  private buildFields(): THREE.InstancedMesh<THREE.BoxGeometry, THREE.MeshBasicMaterial> {
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: false,
        depthWrite: true,
        depthTest: true,
        fog: false,
      }),
      FIELD_COUNT,
    );
    mesh.name = "sky-dancer-v30-patchwork-fields";
    mesh.frustumCulled = false;
    const palette = [
      0x397941, 0x4d8b45, 0x629d4e, 0x77aa58, 0x568b48,
      0x6e9950, 0x3f7851, 0x879f59, 0x4d8240,
    ].map((value) => new THREE.Color(value));
    const dummy = new THREE.Object3D();

    let index = 0;
    for (let row = -6; row <= 5 && index < FIELD_COUNT; row += 1) {
      for (let column = -7; column <= 7 && index < FIELD_COUNT; column += 1) {
        const seed = (row + 11) * 97 + (column + 13) * 53;
        const x = column * 51 + Math.sin(seed * 0.17) * 13;
        const z = row * 58 + Math.cos(seed * 0.23) * 15;
        const riverCenter = 45 + Math.sin(z * 0.012) * 62;
        if (Math.abs(x - riverCenter) < 34) continue;
        const width = 34 + Math.abs(seed % 5) * 6.5;
        const depth = 38 + Math.abs((seed + 3) % 4) * 8.2;
        dummy.position.set(x, GROUND_Y + 0.24, z);
        dummy.rotation.set(0, ((seed % 7) - 3) * 0.028, 0);
        dummy.scale.set(width, 0.10, depth);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        mesh.setColorAt(index, palette[Math.abs(seed) % palette.length]);
        index += 1;
      }
    }

    // Fill unused instances safely below the world if the river exclusion made
    // the generated grid shorter than the fixed GPU allocation.
    while (index < FIELD_COUNT) {
      dummy.position.set(0, -9999, 0);
      dummy.scale.setScalar(0.001);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, palette[0]);
      index += 1;
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return mesh;
  }

  private buildRiver(): THREE.Group {
    const root = new THREE.Group();
    root.name = "sky-dancer-v30-river";
    const water = new THREE.MeshBasicMaterial({
      color: 0x267fa8,
      transparent: false,
      depthWrite: true,
      depthTest: true,
      fog: false,
      toneMapped: false,
    });
    const glint = new THREE.MeshBasicMaterial({
      color: 0x78d3ec,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });

    for (let index = 0; index < RIVER_SEGMENTS; index += 1) {
      const z = -390 + index * 28;
      const x = 45 + Math.sin(z * 0.012) * 62;
      const nextZ = z + 28;
      const nextX = 45 + Math.sin(nextZ * 0.012) * 62;
      const dx = nextX - x;
      const dz = nextZ - z;
      const length = Math.hypot(dx, dz) + 4;
      const width = 22 + (index % 5) * 2.6;
      const segment = new THREE.Mesh(new THREE.BoxGeometry(width, 0.09, length), water);
      segment.position.set((x + nextX) * 0.5, GROUND_Y + 0.34, (z + nextZ) * 0.5);
      segment.rotation.y = Math.atan2(dx, dz);
      root.add(segment);
      if (index % 3 === 0) {
        const shine = new THREE.Mesh(new THREE.BoxGeometry(width * 0.58, 0.025, 0.24), glint);
        shine.position.set(segment.position.x, GROUND_Y + 0.40, segment.position.z);
        shine.rotation.y = segment.rotation.y;
        root.add(shine);
      }
    }
    return root;
  }
}
