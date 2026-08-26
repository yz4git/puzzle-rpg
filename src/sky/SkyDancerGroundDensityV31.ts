import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../cart/CartArenaSession";

interface GroundDensityRuntime {
  scene: THREE.Scene;
}

const WORLD_CHUNK = 210;
const GROUND_Y = -66.45;
const TILE_RADIUS = 3;
const LANDSCAPE_SIZE = WORLD_CHUNK * (TILE_RADIUS * 2 + 1) + 420;
const MAX_FIELDS = 392;
const MAX_BUILDINGS = 588;
const MAX_TREES = 882;
const MAX_ROADS = 140;
const MAX_TOWERS = 64;

function hash2(x: number, z: number, salt = 0): number {
  let n = Math.imul(x + 0x6d2b79f5 + salt * 1013, 0x1b873593) ^ Math.imul(z - salt * 733, 0x85ebca6b);
  n ^= n >>> 15;
  n = Math.imul(n, 0x2c1b3c6d);
  n ^= n >>> 12;
  return (n >>> 0) / 0xffffffff;
}

function pick<T>(items: readonly T[], index: number): T {
  const safeIndex = ((index % items.length) + items.length) % items.length;
  return items[safeIndex];
}

function setInstance(
  mesh: THREE.InstancedMesh,
  index: number,
  dummy: THREE.Object3D,
  color?: THREE.Color,
): number {
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
  if (color) mesh.setColorAt(index, color);
  return index + 1;
}

/**
 * High-altitude V31 world density.
 *
 * Seven-by-seven deterministic chunks cover the useful 300 m chase view while
 * keeping draw calls fixed. Per-instance color is carried exclusively through
 * InstancedMesh.instanceColor; material vertexColors stays disabled because the
 * primitive geometries do not contain a vertex color attribute. This avoids the
 * zero-color multiplication path seen as black slabs on SwiftShader/mobile WebGL.
 */
export class SkyDancerGroundDensityV31 {
  private readonly root = new THREE.Group();
  private readonly landscape: THREE.Mesh;
  private readonly fields: THREE.InstancedMesh;
  private readonly buildings: THREE.InstancedMesh;
  private readonly trees: THREE.InstancedMesh;
  private readonly roads: THREE.InstancedMesh;
  private readonly towers: THREE.InstancedMesh;
  private tileX = Number.NaN;
  private tileZ = Number.NaN;

  constructor(runtime: GroundDensityRuntime) {
    this.root.name = "sky-dancer-v31-ground-density";
    this.landscape = this.makeLandscapeBase();
    this.fields = this.makeFields();
    this.buildings = this.makeBuildings();
    this.trees = this.makeTrees();
    this.roads = this.makeRoads();
    this.towers = this.makeTowers();
    this.root.add(this.landscape, this.fields, this.roads, this.buildings, this.trees, this.towers);
    runtime.scene.add(this.root);
  }

  update(snapshot: CartArenaSessionSnapshot): void {
    const nextTileX = Math.floor(snapshot.x / WORLD_CHUNK);
    const nextTileZ = Math.floor(snapshot.z / WORLD_CHUNK);
    if (nextTileX === this.tileX && nextTileZ === this.tileZ) return;
    this.tileX = nextTileX;
    this.tileZ = nextTileZ;
    this.root.position.set(nextTileX * WORLD_CHUNK, 0, nextTileZ * WORLD_CHUNK);
    this.rebuild(nextTileX, nextTileZ);
  }

  private rebuild(centerTileX: number, centerTileZ: number): void {
    const dummy = new THREE.Object3D();
    const fieldPalette = [0x2f6b37, 0x3f7d3f, 0x559047, 0x6fa44f, 0x86ad59, 0x4b8045, 0x397554, 0x8e9651].map((value) => new THREE.Color(value));
    const buildingPalette = [0x6f8794, 0x8299a4, 0x96a5a8, 0x607a89, 0x89958f].map((value) => new THREE.Color(value));
    const treePalette = [0x1f4e32, 0x285d38, 0x376d41, 0x23573a, 0x427647].map((value) => new THREE.Color(value));
    const roadPalette = [0x647579, 0x728184, 0x596d71].map((value) => new THREE.Color(value));
    const towerPalette = [0x6d8995, 0x849ca4, 0x607b87].map((value) => new THREE.Color(value));

    let fieldIndex = 0;
    let buildingIndex = 0;
    let treeIndex = 0;
    let roadIndex = 0;
    let towerIndex = 0;

    for (let dz = -TILE_RADIUS; dz <= TILE_RADIUS; dz += 1) {
      for (let dx = -TILE_RADIUS; dx <= TILE_RADIUS; dx += 1) {
        const tileX = centerTileX + dx;
        const tileZ = centerTileZ + dz;
        const localBaseX = dx * WORLD_CHUNK;
        const localBaseZ = dz * WORLD_CHUNK;
        const density = hash2(tileX, tileZ, 1);
        const settlementX = localBaseX + (hash2(tileX, tileZ, 2) - 0.5) * 78;
        const settlementZ = localBaseZ + (hash2(tileX, tileZ, 3) - 0.5) * 78;

        const fieldCount = 6;
        for (let i = 0; i < fieldCount && fieldIndex < MAX_FIELDS; i += 1) {
          const column = i % 3;
          const row = Math.floor(i / 3);
          const width = 48 + hash2(tileX, tileZ, 20 + i) * 44;
          const depth = 44 + hash2(tileX, tileZ, 40 + i) * 46;
          const offsetX = (column - 1) * 64 + (hash2(tileX, tileZ, 60 + i) - 0.5) * 15;
          const offsetZ = (row - 0.5) * 80 + (hash2(tileX, tileZ, 80 + i) - 0.5) * 18;
          dummy.position.set(localBaseX + offsetX, GROUND_Y + 0.46, localBaseZ + offsetZ);
          dummy.rotation.set(0, (hash2(tileX, tileZ, 100 + i) - 0.5) * 0.19, 0);
          dummy.scale.set(width, 0.12, depth);
          fieldIndex = setInstance(this.fields, fieldIndex, dummy, pick(fieldPalette, tileX * 7 + tileZ * 11 + i));
        }

        for (let axis = 0; axis < 2 && roadIndex < MAX_ROADS; axis += 1) {
          const longAxis = axis === 0;
          const length = 170 + hash2(tileX, tileZ, 130 + axis) * 70;
          const width = 3.2 + hash2(tileX, tileZ, 140 + axis) * 2.0;
          dummy.position.set(
            settlementX + (longAxis ? 0 : (hash2(tileX, tileZ, 150) - 0.5) * 24),
            GROUND_Y + 0.60,
            settlementZ + (longAxis ? (hash2(tileX, tileZ, 151) - 0.5) * 24 : 0),
          );
          dummy.rotation.set(0, (hash2(tileX, tileZ, 160 + axis) - 0.5) * 0.15 + (longAxis ? 0 : Math.PI / 2), 0);
          dummy.scale.set(width, 0.08, length);
          roadIndex = setInstance(this.roads, roadIndex, dummy, pick(roadPalette, tileX + tileZ + axis));
        }

        const buildingCount = 7 + Math.floor(density * 5);
        for (let i = 0; i < buildingCount && buildingIndex < MAX_BUILDINGS; i += 1) {
          const angle = hash2(tileX, tileZ, 200 + i) * Math.PI * 2;
          const radius = 12 + hash2(tileX, tileZ, 240 + i) * 42;
          const width = 4.2 + hash2(tileX, tileZ, 280 + i) * 4.4;
          const depth = 4.0 + hash2(tileX, tileZ, 320 + i) * 4.8;
          const height = 5.2 + hash2(tileX, tileZ, 360 + i) * (density > 0.78 ? 14 : 8);
          dummy.position.set(
            settlementX + Math.cos(angle) * radius,
            GROUND_Y + 0.58 + height * 0.5,
            settlementZ + Math.sin(angle) * radius,
          );
          dummy.rotation.set(0, angle * 0.18 + (hash2(tileX, tileZ, 400 + i) - 0.5) * 0.26, 0);
          dummy.scale.set(width, height, depth);
          buildingIndex = setInstance(this.buildings, buildingIndex, dummy, pick(buildingPalette, i + tileX * 5 + tileZ * 3));
        }

        const treeCount = 12 + Math.floor(hash2(tileX, tileZ, 450) * 7);
        for (let i = 0; i < treeCount && treeIndex < MAX_TREES; i += 1) {
          const angle = hash2(tileX, tileZ, 480 + i) * Math.PI * 2;
          const radius = 58 + hash2(tileX, tileZ, 520 + i) * 78;
          const height = 4.5 + hash2(tileX, tileZ, 560 + i) * 5.5;
          const width = 2.6 + hash2(tileX, tileZ, 600 + i) * 2.5;
          dummy.position.set(
            settlementX + Math.cos(angle) * radius,
            GROUND_Y + 0.58 + height * 0.5,
            settlementZ + Math.sin(angle) * radius,
          );
          dummy.rotation.set(0, angle, 0);
          dummy.scale.set(width, height, width);
          treeIndex = setInstance(this.trees, treeIndex, dummy, pick(treePalette, i + tileX * 3 + tileZ * 5));
        }

        if (density > 0.76 && towerIndex < MAX_TOWERS) {
          const height = 20 + density * 22;
          dummy.position.set(settlementX - 7, GROUND_Y + 0.62 + height * 0.5, settlementZ + 8);
          dummy.rotation.set(0, hash2(tileX, tileZ, 700) * 0.35, 0);
          dummy.scale.set(4.4, height, 4.4);
          towerIndex = setInstance(this.towers, towerIndex, dummy, pick(towerPalette, tileX * 7 + tileZ * 11));
        }
      }
    }

    this.finishInstances(this.fields, fieldIndex);
    this.finishInstances(this.buildings, buildingIndex);
    this.finishInstances(this.trees, treeIndex);
    this.finishInstances(this.roads, roadIndex);
    this.finishInstances(this.towers, towerIndex);
  }

  private finishInstances(mesh: THREE.InstancedMesh, count: number): void {
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  private makeLandscapeBase(): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(LANDSCAPE_SIZE, LANDSCAPE_SIZE, 1, 1);
    geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: 0x416f3d,
        vertexColors: false,
        transparent: false,
        opacity: 1,
        depthWrite: true,
        depthTest: true,
        fog: false,
        toneMapped: false,
      }),
    );
    mesh.name = "sky-dancer-v31-landscape-base";
    mesh.position.y = GROUND_Y + 0.12;
    mesh.frustumCulled = false;
    mesh.renderOrder = -60;
    return mesh;
  }

  private makeFields(): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: false, transparent: false, depthWrite: true, depthTest: true, toneMapped: false, fog: false }),
      MAX_FIELDS,
    );
    mesh.name = "sky-dancer-v31-patchwork-fields";
    mesh.frustumCulled = false;
    return mesh;
  }

  private makeBuildings(): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: false, flatShading: true, transparent: false, depthWrite: true, fog: false }),
      MAX_BUILDINGS,
    );
    mesh.name = "sky-dancer-v31-settlement-buildings";
    mesh.frustumCulled = false;
    return mesh;
  }

  private makeTrees(): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1, 1, 5),
      new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: false, flatShading: true, transparent: false, depthWrite: true, fog: false }),
      MAX_TREES,
    );
    mesh.name = "sky-dancer-v31-forest-belts";
    mesh.frustumCulled = false;
    return mesh;
  }

  private makeRoads(): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: false, transparent: false, depthWrite: true, depthTest: true, toneMapped: false, fog: false }),
      MAX_ROADS,
    );
    mesh.name = "sky-dancer-v31-road-network";
    mesh.frustumCulled = false;
    return mesh;
  }

  private makeTowers(): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: false, flatShading: true, transparent: false, depthWrite: true, fog: false }),
      MAX_TOWERS,
    );
    mesh.name = "sky-dancer-v31-landmark-towers";
    mesh.frustumCulled = false;
    return mesh;
  }
}
