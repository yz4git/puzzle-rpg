import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../../cart/CartArenaSession";
import type { SkyDancerFxRuntime } from "../SkyDancerAirCombatFxV2";

const CITY_SNAP = 420;
const GROUND_Y = -66.30;
const CITY_CAPACITY = 900;
const ARCHETYPE_COUNT = 6;
const TERRAIN_COLS = 27;
const TERRAIN_ROWS = 31;
const TERRAIN_WIDTH = 1040;
const TERRAIN_DEPTH = 1080;
const CITY_ORIGIN_X = 140;
const CITY_ORIGIN_Z = 300;
const CITY_CENTER_Z = 145;
const GLOBAL_WORLD_DEBUG_KEY = "__skyDancerGetV36WorldDebug";

function hash2(x: number, z: number, salt = 0): number {
  let n = Math.imul(x + 0x6d2b79f5 + salt * 719, 0x27d4eb2d) ^ Math.imul(z - salt * 449, 0x165667b1);
  n ^= n >>> 15;
  n = Math.imul(n, 0x85ebca6b);
  n ^= n >>> 13;
  return (n >>> 0) / 0xffffffff;
}

function appendBox(
  positions: number[],
  normals: number[],
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number,
): void {
  const x0 = cx - sx * 0.5;
  const x1 = cx + sx * 0.5;
  const y0 = cy - sy * 0.5;
  const y1 = cy + sy * 0.5;
  const z0 = cz - sz * 0.5;
  const z1 = cz + sz * 0.5;
  const faces: Array<[number[], number[]]> = [
    [[x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y0, z1, x1, y1, z1, x0, y1, z1], [0, 0, 1]],
    [[x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y0, z0, x0, y1, z0, x1, y1, z0], [0, 0, -1]],
    [[x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y0, z1, x1, y1, z0, x1, y1, z1], [1, 0, 0]],
    [[x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y0, z0, x0, y1, z1, x0, y1, z0], [-1, 0, 0]],
    [[x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z1, x1, y1, z0, x0, y1, z0], [0, 1, 0]],
    [[x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z0, x1, y0, z1, x0, y0, z1], [0, -1, 0]],
  ];
  for (const [vertices, normal] of faces) {
    positions.push(...vertices);
    for (let index = 0; index < 6; index += 1) normals.push(...normal);
  }
}

function appendPyramid(
  positions: number[],
  normals: number[],
  baseY: number,
  half: number,
  height: number,
): void {
  const p0 = new THREE.Vector3(-half, baseY, -half);
  const p1 = new THREE.Vector3(half, baseY, -half);
  const p2 = new THREE.Vector3(half, baseY, half);
  const p3 = new THREE.Vector3(-half, baseY, half);
  const top = new THREE.Vector3(0, baseY + height, 0);
  const triangles = [[p0, p1, top], [p1, p2, top], [p2, p3, top], [p3, p0, top]] as const;
  for (const triangle of triangles) {
    const normal = new THREE.Vector3()
      .crossVectors(
        new THREE.Vector3().subVectors(triangle[1], triangle[0]),
        new THREE.Vector3().subVectors(triangle[2], triangle[0]),
      )
      .normalize();
    for (const point of triangle) {
      positions.push(point.x, point.y, point.z);
      normals.push(normal.x, normal.y, normal.z);
    }
  }
}

function stackedGeometry(levels: ReadonlyArray<[number, number, number, number]>, spire = false): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  for (const [baseY, height, width, depth] of levels) {
    appendBox(positions, normals, 0, baseY + height * 0.5, 0, width, height, depth);
  }
  if (spire) {
    const last = levels[levels.length - 1];
    appendPyramid(
      positions,
      normals,
      last[0] + last[1],
      Math.min(last[2], last[3]) * 0.42,
      Math.max(0.45, last[1] * 0.28),
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * V36 background-world quality pass.
 * Replaces the single-box metro read with several cheap geometry archetypes and
 * replaces the board-flat foreground with a faceted, vertex-coloured render
 * surface. The render terrain deliberately stays below roads/rivers and never
 * changes gameplay height or collision coordinates.
 */
export class SkyDancerV36WorldGeometryPass {
  private readonly terrainRoot = new THREE.Group();
  private readonly terrainGeometry: THREE.BufferGeometry;
  private readonly terrainPositions: THREE.BufferAttribute;
  private readonly terrainColors: THREE.BufferAttribute;
  private readonly terrain: THREE.Mesh;
  private readonly cityRoot = new THREE.Group();
  private readonly archetypes: THREE.InstancedMesh[];
  private readonly arterialRoads: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly palette = [0x6f828b, 0x81949a, 0x99a8aa, 0xafb8b8, 0x5e747e, 0xc1c5c2, 0x758a92, 0x8e9ea1]
    .map((value) => new THREE.Color(value));
  private readonly terrainPalette = [0x476f43, 0x547a46, 0x63844d, 0x416c48, 0x6f8954, 0x58744a, 0x3f6850]
    .map((value) => new THREE.Color(value));
  private tileX = Number.NaN;
  private tileZ = Number.NaN;
  private anchored = false;

  constructor(private readonly runtime: SkyDancerFxRuntime) {
    this.terrainRoot.name = "sky-dancer-v36-faceted-terrain-root";
    this.terrainGeometry = this.makeTerrainGeometry();
    this.terrainPositions = this.terrainGeometry.getAttribute("position") as THREE.BufferAttribute;
    this.terrainColors = this.terrainGeometry.getAttribute("color") as THREE.BufferAttribute;
    this.terrain = new THREE.Mesh(
      this.terrainGeometry,
      new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: true, side: THREE.DoubleSide }),
    );
    this.terrain.name = "sky-dancer-v36-faceted-terrain";
    this.terrain.frustumCulled = false;
    this.terrainRoot.add(this.terrain);

    this.cityRoot.name = "sky-dancer-v36-archetype-city";
    this.cityRoot.userData.skyDancerV42StableGroundAnchor = true;
    const geometries = [
      stackedGeometry([[0, 1, 1, 1]]),
      stackedGeometry([[0, 0.72, 1.08, 1.02], [0.72, 0.28, 0.74, 0.72]]),
      stackedGeometry([[0, 0.55, 1.20, 1.08], [0.55, 0.30, 0.88, 0.84], [0.85, 0.15, 0.58, 0.56]]),
      stackedGeometry([[0, 0.88, 0.76, 0.76], [0.88, 0.12, 0.92, 0.92]]),
      stackedGeometry([[0, 0.78, 1.28, 0.84], [0.78, 0.22, 0.78, 0.68]]),
      stackedGeometry([[0, 0.82, 0.72, 0.72], [0.82, 0.18, 0.54, 0.54]], true),
    ];
    this.archetypes = geometries.map((geometry, index) => {
      const mesh = new THREE.InstancedMesh(
        geometry,
        new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, fog: true }),
        CITY_CAPACITY,
      );
      mesh.name = `sky-dancer-v36-city-archetype-${index}`;
      mesh.frustumCulled = false;
      this.cityRoot.add(mesh);
      return mesh;
    });

    this.arterialRoads = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0x9aa3a1, transparent: true, opacity: 0.34, fog: true, toneMapped: false }),
      10,
    );
    this.arterialRoads.name = "sky-dancer-v36-arterial-roads";
    this.arterialRoads.frustumCulled = false;
    this.cityRoot.add(this.arterialRoads);

    runtime.scene.add(this.terrainRoot, this.cityRoot);
    runtime.scene.userData.skyDancerV36WorldGeometry = true;
    if (typeof window !== "undefined" && navigator.webdriver) {
      (window as unknown as Record<string, unknown>)[GLOBAL_WORLD_DEBUG_KEY] = () => ({
        cityRootPosition: { x: this.cityRoot.position.x, z: this.cityRoot.position.z },
        stableGroundAnchor: this.cityRoot.userData.skyDancerV42StableGroundAnchor === true,
        anchored: this.anchored,
      });
    }
  }

  update(snapshot: CartArenaSessionSnapshot): void {
    const legacyBuildings = this.runtime.scene.getObjectByName("sky-dancer-v35-focus-buildings");
    if (legacyBuildings) legacyBuildings.visible = false;
    const legacyFields = this.runtime.scene.getObjectByName("sky-dancer-v31-patchwork-fields");
    if (legacyFields) legacyFields.visible = false;
    this.terrainRoot.visible = true;
    this.cityRoot.visible = true;
    for (const mesh of this.archetypes) mesh.visible = true;
    this.arterialRoads.visible = true;

    // V41 owns the rolling terrain. The primary skyline is scenery and must not
    // jump to a new 420 m player-relative tile. Rebuilding it on every boundary
    // caused whole blocks and landmarks to disappear in a single frame. Build
    // it once at the starting world tile and keep its transforms stable.
    if (this.anchored) return;
    this.tileX = Math.floor(snapshot.x / CITY_SNAP);
    this.tileZ = Math.floor(snapshot.z / CITY_SNAP);
    this.terrainRoot.position.set(this.tileX * CITY_SNAP, 0, this.tileZ * CITY_SNAP);
    this.cityRoot.position.set(this.tileX * CITY_SNAP + CITY_ORIGIN_X, 0, this.tileZ * CITY_SNAP + CITY_ORIGIN_Z);
    this.rebuildTerrain(this.tileX, this.tileZ);
    this.rebuildCity(this.tileX, this.tileZ);
    this.anchored = true;
  }

  private makeTerrainGeometry(): THREE.BufferGeometry {
    const triangleCount = (TERRAIN_COLS - 1) * (TERRAIN_ROWS - 1) * 2;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(triangleCount * 9), 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(triangleCount * 9), 3));
    return geometry;
  }

  private terrainHeight(gridX: number, gridZ: number, tileX: number, tileZ: number): number {
    const coarse = hash2(tileX * 13 + gridX, tileZ * 17 + gridZ, 210);
    const ridge = Math.sin((gridX + tileX * 2.3) * 0.73) * Math.cos((gridZ - tileZ * 1.7) * 0.54);
    return -0.18 + coarse * 0.42 + ridge * 0.12;
  }

  private rebuildTerrain(tileX: number, tileZ: number): void {
    const dx = TERRAIN_WIDTH / (TERRAIN_COLS - 1);
    const dz = TERRAIN_DEPTH / (TERRAIN_ROWS - 1);
    let vertex = 0;
    const writeTriangle = (points: ReadonlyArray<[number, number, number]>, color: THREE.Color) => {
      for (const [x, y, z] of points) {
        this.terrainPositions.setXYZ(vertex, x, y, z);
        this.terrainColors.setXYZ(vertex, color.r, color.g, color.b);
        vertex += 1;
      }
    };
    for (let gz = 0; gz < TERRAIN_ROWS - 1; gz += 1) {
      for (let gx = 0; gx < TERRAIN_COLS - 1; gx += 1) {
        const x0 = -TERRAIN_WIDTH * 0.5 + gx * dx;
        const x1 = x0 + dx;
        const z0 = -40 + gz * dz;
        const z1 = z0 + dz;
        const y00 = GROUND_Y + this.terrainHeight(gx, gz, tileX, tileZ);
        const y10 = GROUND_Y + this.terrainHeight(gx + 1, gz, tileX, tileZ);
        const y01 = GROUND_Y + this.terrainHeight(gx, gz + 1, tileX, tileZ);
        const y11 = GROUND_Y + this.terrainHeight(gx + 1, gz + 1, tileX, tileZ);
        const paletteA = this.terrainPalette[Math.floor(hash2(tileX + gx, tileZ + gz, 330) * this.terrainPalette.length) % this.terrainPalette.length];
        const paletteB = this.terrainPalette[Math.floor(hash2(tileX + gx, tileZ + gz, 430) * this.terrainPalette.length) % this.terrainPalette.length];
        writeTriangle([[x0, y00, z0], [x1, y10, z0], [x1, y11, z1]], paletteA);
        writeTriangle([[x0, y00, z0], [x1, y11, z1], [x0, y01, z1]], paletteB);
      }
    }
    this.terrainPositions.needsUpdate = true;
    this.terrainColors.needsUpdate = true;
    this.terrainGeometry.computeVertexNormals();
    this.terrainGeometry.computeBoundingSphere();
  }

  private rebuildCity(tileX: number, tileZ: number): void {
    const counts = new Array<number>(ARCHETYPE_COUNT).fill(0);
    const spacing = 7.2;
    const startZ = 28;
    const seed = Math.floor(hash2(tileX, tileZ, 400) * 1000);
    let total = 0;

    for (let row = 0; row < 32 && total < CITY_CAPACITY; row += 1) {
      const z = startZ + row * spacing;
      const riverX = -10 + Math.sin((z + seed) * 0.023) * 17;
      for (let column = -20; column <= 20 && total < CITY_CAPACITY; column += 1) {
        const x = column * spacing;
        const roadColumn = (column + 20) % 7 === 0;
        const roadRow = row % 6 === 0;
        if (roadColumn || roadRow || Math.abs(x - riverX) < 6.2) continue;

        const noise = hash2(tileX + column, tileZ + row, 800 + seed);
        const centerDistance = Math.hypot(x * 0.82, (z - CITY_CENTER_Z) * 0.54);
        const core = THREE.MathUtils.clamp(1 - centerDistance / 158, 0, 1);
        const depthGain = THREE.MathUtils.clamp((z - startZ) / 92, 0.08, 1);
        const shapeNoise = hash2(column, row, 920 + seed);
        let height = 3.5 + noise * 6.1 + core * depthGain * (4.0 + noise * 15.8);
        let width = 2.7 + hash2(column, row, 1000 + seed) * 2.0;
        let depth = 2.7 + hash2(row, column, 1100 + seed) * 2.2;
        const landmark = (row === 13 && column === -8)
          || (row === 18 && column === 8)
          || (row === 23 && column === 1)
          || (row === 27 && column === 13);
        let archetype = Math.min(4, Math.floor(shapeNoise * 5));
        if (landmark) {
          archetype = 5;
          height = 50 + hash2(column, row, 1200 + seed) * 28;
          width = 4.6;
          depth = 4.6;
        } else if (archetype === 2) {
          width *= 1.12;
          depth *= 1.08;
          height *= 0.86;
        } else if (archetype === 3) {
          height *= 1.18;
          width *= 0.86;
          depth *= 0.86;
        }

        const mesh = this.archetypes[archetype];
        const index = counts[archetype]++;
        this.dummy.position.set(
          x + (hash2(column, row, 1300 + seed) - 0.5) * 0.7,
          GROUND_Y + 0.38,
          z + (hash2(row, column, 1400 + seed) - 0.5) * 0.7,
        );
        this.dummy.rotation.set(0, (hash2(column, row, 1500 + seed) - 0.5) * 0.035, 0);
        this.dummy.scale.set(width, height, depth);
        this.dummy.updateMatrix();
        mesh.setMatrixAt(index, this.dummy.matrix);
        mesh.setColorAt(index, this.palette[(row * 3 + column + this.palette.length * 16) % this.palette.length]);
        total += 1;
      }
    }

    for (let archetype = 0; archetype < ARCHETYPE_COUNT; archetype += 1) {
      const mesh = this.archetypes[archetype];
      mesh.count = counts[archetype];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    const roads: Array<[number, number, number, number]> = [
      [-84, 145, 0, 246], [0, 145, 0, 246], [84, 145, 0, 246],
      [0, 82, Math.PI / 2, 296], [0, 164, Math.PI / 2, 296], [0, 226, Math.PI / 2, 296],
      [-20, 148, 0.22, 276], [26, 158, -0.18, 274],
    ];
    roads.forEach(([x, z, rotation, length], index) => {
      this.dummy.position.set(x, GROUND_Y + 0.74, z);
      this.dummy.rotation.set(0, rotation, 0);
      this.dummy.scale.set(0.68, 0.04, length);
      this.dummy.updateMatrix();
      this.arterialRoads.setMatrixAt(index, this.dummy.matrix);
    });
    this.arterialRoads.count = roads.length;
    this.arterialRoads.instanceMatrix.needsUpdate = true;
  }
}
