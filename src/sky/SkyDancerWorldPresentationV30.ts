import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../cart/CartArenaSession";

interface V30WorldRuntime {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer?: THREE.WebGLRenderer;
}

interface WorldDebugState {
  foundationVisible: boolean;
  foundationTransparent: boolean;
  foundationDepthWrite: boolean;
  hiddenLegacyLayers: number;
  chunkX: number;
  chunkZ: number;
}

interface WorldDebugHost extends Window {
  __skyDancerGetWorldPresentationDebug?: () => WorldDebugState;
}

const WORLD_CHUNK = 210;
const FOUNDATION_CHUNKS = 12;
const FOUNDATION_SIZE = WORLD_CHUNK * FOUNDATION_CHUNKS;
const FOUNDATION_SEGMENTS = 44;
const TARGET_GROUND_Y = -66.45;
const FOUNDATION_Y = TARGET_GROUND_Y - 0.32;

const LEGACY_LAYER_NAMES = [
  "sky-dancer-terrain-150m-below",
  "sky-dancer-q11-route-parcels",
  "sky-dancer-q11-hedgerows",
  "sky-dancer-q11-route-towns",
  "sky-dancer-q11-highways",
  "sky-dancer-q11-landmarks",
  "sky-dancer-v22-quality-world",
  "sky-dancer-v24-horizon-silhouettes",
  "sky-dancer-v25-valley-fields",
  "sky-dancer-v27-landmark-city-ring",
  "sky-dancer-v28-patchwork-valley",
  "sky-dancer-v28-mountain-depth",
  "phase67-turbo-hunt-world",
] as const;

const BASE_FIELD_COLORS = new Set([0x6f8f4e, 0xa9995d, 0x7ea45b, 0xb08f62, 0xa7a59b]);

function colorHex(material: THREE.Material): number | null {
  if (!("color" in material)) return null;
  const color = (material as THREE.Material & { color?: THREE.Color }).color;
  return color instanceof THREE.Color ? color.getHex() : null;
}

/**
 * Final world-composition owner for the high-altitude game view.
 *
 * Older Sky Dancer passes intentionally accumulated scenery while the project
 * was finding its art direction. At 300 m that left several independent ground
 * systems competing for the same pixels. V30 establishes one opaque foundation,
 * suppresses obsolete/overlapping ground systems and leaves the V28 lake/clouds
 * plus the focused V29 skyline above the V30-owned valley detail.
 */
export class SkyDancerWorldPresentationV30 {
  private readonly runtime: V30WorldRuntime;
  private readonly root = new THREE.Group();
  private readonly mountainRoot = new THREE.Group();
  private readonly foundation: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshLambertMaterial>;
  private readonly sky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private hiddenLegacyLayers = 0;
  private chunkX = Number.NaN;
  private chunkZ = Number.NaN;
  private preparedModernLayers = false;

  constructor(runtime: V30WorldRuntime) {
    this.runtime = runtime;
    this.root.name = "sky-dancer-v30-world-presentation";
    this.mountainRoot.name = "sky-dancer-v30-horizon-mountains";
    this.foundation = this.buildFoundation();
    this.sky = this.buildSky();
    this.root.add(this.foundation, this.mountainRoot);
    this.runtime.scene.add(this.root, this.sky);
    this.buildMountainBelt();
    this.applyLegacyLayerPolicy();
    this.exposeDebug();
  }

  update(snapshot: CartArenaSessionSnapshot): void {
    this.applyLegacyLayerPolicy();
    this.prepareModernLayers();

    const centerX = Math.floor(snapshot.x / WORLD_CHUNK) * WORLD_CHUNK;
    const centerZ = Math.floor(snapshot.z / WORLD_CHUNK) * WORLD_CHUNK;
    if (centerX !== this.chunkX || centerZ !== this.chunkZ) {
      this.chunkX = centerX;
      this.chunkZ = centerZ;
      this.root.position.x = centerX;
      this.root.position.z = centerZ;
    }

    // A sky dome must follow the camera in an unbounded world or the aircraft
    // can eventually fly outside it.
    this.sky.position.copy(this.runtime.camera.position);
  }

  private buildFoundation(): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshLambertMaterial> {
    const geometry = new THREE.PlaneGeometry(
      FOUNDATION_SIZE,
      FOUNDATION_SIZE,
      FOUNDATION_SEGMENTS,
      FOUNDATION_SEGMENTS,
    );
    geometry.rotateX(-Math.PI / 2);

    const position = geometry.getAttribute("position") as THREE.BufferAttribute;
    const colors = new Float32Array(position.count * 3);
    const dark = new THREE.Color(0x356b42);
    const mid = new THREE.Color(0x528849);
    const light = new THREE.Color(0x76a455);
    const sample = new THREE.Color();
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const z = position.getZ(index);
      const broad = Math.sin(x * 0.0105) * 0.5 + Math.cos(z * 0.0092) * 0.5;
      const detail = Math.sin((x + z) * 0.018) * 0.5 + 0.5;
      sample.lerpColors(dark, mid, THREE.MathUtils.clamp(broad * 0.24 + 0.5, 0, 1));
      sample.lerp(light, detail * 0.18);
      colors[index * 3] = sample.r;
      colors[index * 3 + 1] = sample.g;
      colors[index * 3 + 2] = sample.b;
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      vertexColors: true,
      flatShading: true,
      transparent: false,
      depthWrite: true,
      depthTest: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = "sky-dancer-v30-ground-foundation";
    mesh.position.y = FOUNDATION_Y;
    mesh.frustumCulled = false;
    mesh.renderOrder = -80;
    return mesh;
  }

  private buildSky(): THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
    const material = new THREE.ShaderMaterial({
      name: "sky-dancer-v30-sky-material",
      vertexShader: `
        varying vec3 vDirection;
        void main() {
          vDirection = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec3 vDirection;
        void main() {
          float h = normalize(vDirection).y;
          float horizonMix = smoothstep(-0.16, 0.44, h);
          float zenithMix = smoothstep(0.30, 0.94, h);
          vec3 horizon = vec3(0.20, 0.56, 0.80);
          vec3 body = vec3(0.055, 0.36, 0.68);
          vec3 zenith = vec3(0.018, 0.15, 0.40);
          vec3 sky = mix(horizon, body, horizonMix);
          sky = mix(sky, zenith, zenithMix);
          float glow = pow(max(0.0, 1.0 - abs(h)), 12.0);
          sky += vec3(0.035, 0.055, 0.05) * glow;
          gl_FragColor = vec4(sky, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(980, 28, 14), material);
    sky.name = "sky-dancer-v30-sky";
    sky.frustumCulled = false;
    sky.renderOrder = -3000;
    return sky;
  }

  private buildMountainBelt(): void {
    const count = 96;
    const geometry = new THREE.ConeGeometry(1, 1, 7);
    const material = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      vertexColors: true,
      flatShading: true,
      transparent: false,
    });
    const mountains = new THREE.InstancedMesh(geometry, material, count);
    mountains.name = "sky-dancer-v30-mountain-belt";
    mountains.frustumCulled = false;
    const palette = [0x416f69, 0x4f7d6f, 0x648d78, 0x396765].map((value) => new THREE.Color(value));
    const dummy = new THREE.Object3D();
    for (let index = 0; index < count; index += 1) {
      const angle = index / count * Math.PI * 2 + Math.sin(index * 0.83) * 0.035;
      const radius = 420 + (index % 13) * 25;
      const width = 18 + (index % 7) * 5.5;
      const height = 14 + (index % 9) * 3.7;
      dummy.position.set(
        Math.cos(angle) * radius,
        TARGET_GROUND_Y + height * 0.48,
        Math.sin(angle) * radius,
      );
      dummy.rotation.set(0, angle * 0.27, 0);
      dummy.scale.set(width * 1.35, height, width);
      dummy.updateMatrix();
      mountains.setMatrixAt(index, dummy.matrix);
      mountains.setColorAt(index, palette[index % palette.length]);
    }
    mountains.instanceMatrix.needsUpdate = true;
    if (mountains.instanceColor) mountains.instanceColor.needsUpdate = true;
    this.mountainRoot.add(mountains);
  }

  private applyLegacyLayerPolicy(): void {
    let hidden = 0;
    for (const name of LEGACY_LAYER_NAMES) {
      const object = this.runtime.scene.getObjectByName(name);
      if (object && object.visible) {
        object.visible = false;
        hidden += 1;
      }
    }

    // The very first Sky Dancer terrain pass created small fields/river/city
    // meshes without names. Match only their exact legacy material signatures.
    for (const object of this.runtime.scene.children) {
      if (!(object instanceof THREE.Mesh) || object.name) continue;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const legacy = materials.some((material) => {
        const hex = colorHex(material);
        if (hex != null && BASE_FIELD_COLORS.has(hex)) return true;
        return material instanceof THREE.MeshBasicMaterial
          && hex === 0x4c8fab
          && material.transparent;
      });
      if (legacy && object.visible) {
        object.visible = false;
        hidden += 1;
      }
    }
    this.hiddenLegacyLayers = Math.max(this.hiddenLegacyLayers, hidden);
  }

  private tuneCloudLayer(name: string, opacity: number, scale: number, lift: number): void {
    const object = this.runtime.scene.getObjectByName(name);
    if (!(object instanceof THREE.InstancedMesh)) return;
    if (object.material instanceof THREE.MeshLambertMaterial) {
      object.material.opacity = opacity;
      object.material.color.setHex(0xf8fcff);
      object.material.needsUpdate = true;
    }
    object.scale.setScalar(scale);
    object.position.y += lift;
  }

  private prepareModernLayers(): void {
    if (this.preparedModernLayers) return;
    const skyline = this.runtime.scene.getObjectByName("sky-dancer-v29-reference-skyline");
    const lake = this.runtime.scene.getObjectByName("sky-dancer-v28-valley-lake");
    if (!skyline || !lake) return;

    // World +X projects to the left in the current chase camera. Move the
    // landmark toward lower local X so it reads in the right-front quadrant,
    // then push it farther out to match the supplied high-altitude reference.
    skyline.position.set(0, 0, 260);
    skyline.scale.setScalar(0.82);

    if (lake instanceof THREE.Mesh) {
      lake.position.x = -8;
      lake.position.z = 214;
      lake.scale.set(1.65, 0.78, 1);
    }

    // V28/V29 authored large low cloud volumes for a lower camera. At 300 m
    // they obscure the valley. Keep a thinner horizon layer instead.
    this.tuneCloudLayer("sky-dancer-v28-layered-cloud-banks", 0.13, 0.72, 11);
    this.tuneCloudLayer("sky-dancer-v29-reference-cloud-bank", 0.16, 0.76, 8);

    const oldSky = this.runtime.scene.getObjectByName("sky-dancer-v25-reference-sky");
    if (oldSky) oldSky.visible = false;

    const renderer = this.runtime.renderer;
    if (renderer) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    this.runtime.scene.background = new THREE.Color(0x1676b7);
    this.runtime.scene.fog = new THREE.Fog(0x77b9d4, 560, 1460);
    this.runtime.camera.far = Math.max(this.runtime.camera.far, 1520);
    this.runtime.camera.updateProjectionMatrix();

    this.preparedModernLayers = true;
  }

  private exposeDebug(): void {
    if (typeof window === "undefined") return;
    const host = window as WorldDebugHost;
    host.__skyDancerGetWorldPresentationDebug = () => ({
      foundationVisible: this.foundation.visible,
      foundationTransparent: this.foundation.material.transparent,
      foundationDepthWrite: this.foundation.material.depthWrite,
      hiddenLegacyLayers: this.hiddenLegacyLayers,
      chunkX: this.chunkX,
      chunkZ: this.chunkZ,
    });
  }
}
