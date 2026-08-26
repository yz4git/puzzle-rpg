import * as THREE from "three";

interface GroundReadabilityRuntime {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}

type SceneLayerDebug = {
  name: string;
  type: string;
  geometry: string | null;
  material: string | null;
  color: number | null;
  worldY: number;
  transparent: boolean | null;
  opacity: number | null;
  depthWrite: boolean | null;
  fog: boolean | null;
  renderOrder: number;
  effectiveVisible: boolean;
};

type RayHitDebug = {
  name: string;
  type: string;
  distance: number;
  point: { x: number; y: number; z: number };
  material: string | null;
  color: number | null;
  instanceId: number | null;
  instanceColor: number | null;
  transparent: boolean | null;
  opacity: number | null;
  depthWrite: boolean | null;
  effectiveVisible: boolean;
};

interface V31DebugHost extends Window {
  __skyDancerGetV31WorldDebug?: () => {
    camera: { x: number; y: number; z: number; dx: number; dy: number; dz: number };
    centerGroundHit: { x: number; y: number; z: number; t: number } | null;
    layers: SceneLayerDebug[];
    rays: Record<string, RayHitDebug[]>;
  };
}

function isEffectivelyVisible(object: THREE.Object3D): boolean {
  let cursor: THREE.Object3D | null = object;
  while (cursor) {
    if (!cursor.visible) return false;
    cursor = cursor.parent;
  }
  return true;
}

/**
 * Final high-altitude readability calibration for V31.
 * V31 renders one opaque terrain foundation and uses instanceColor-only detail
 * layers so mobile/SwiftShader never multiplies them by missing vertex colors.
 */
export class SkyDancerGroundReadabilityV31 {
  private prepared = false;

  constructor(private readonly runtime: GroundReadabilityRuntime) {}

  update(): void {
    if (this.prepared) return;
    const scene = this.runtime.scene;
    const foundation = scene.getObjectByName("sky-dancer-v30-ground-foundation");
    const macroLandscape = scene.getObjectByName("sky-dancer-v31-landscape-base");
    const legacyFields = scene.getObjectByName("sky-dancer-v30-patchwork-fields");
    const fields = scene.getObjectByName("sky-dancer-v31-patchwork-fields");
    const buildings = scene.getObjectByName("sky-dancer-v31-settlement-buildings");
    const trees = scene.getObjectByName("sky-dancer-v31-forest-belts");
    const roads = scene.getObjectByName("sky-dancer-v31-road-network");
    const towers = scene.getObjectByName("sky-dancer-v31-landmark-towers");
    const mountainBelt = scene.getObjectByName("sky-dancer-v30-mountain-belt");
    const skyline = scene.getObjectByName("sky-dancer-v29-reference-skyline");
    if (!(foundation instanceof THREE.Mesh)
      || !(fields instanceof THREE.InstancedMesh)
      || !(buildings instanceof THREE.InstancedMesh)
      || !(trees instanceof THREE.InstancedMesh)
      || !(roads instanceof THREE.InstancedMesh)
      || !(towers instanceof THREE.InstancedMesh)
      || !skyline) return;

    if (legacyFields) {
      legacyFields.visible = false;
      legacyFields.userData.skyDancerV31SupersededFieldLayer = true;
    }

    if (macroLandscape) {
      macroLandscape.visible = false;
      macroLandscape.userData.skyDancerV31SupersededMacroLandscape = true;
    }

    const previousFoundationMaterial = Array.isArray(foundation.material) ? null : foundation.material;
    foundation.material = new THREE.MeshBasicMaterial({
      color: 0x416f3d,
      vertexColors: false,
      transparent: false,
      opacity: 1,
      depthWrite: true,
      depthTest: true,
      fog: false,
      toneMapped: false,
    });
    foundation.receiveShadow = false;
    foundation.castShadow = false;
    foundation.renderOrder = -80;
    foundation.userData.skyDancerV31SingleGroundFoundation = true;
    previousFoundationMaterial?.dispose();

    // V30 mountain instances also use setColorAt(). Their primitive geometry has
    // no vertex color attribute, so render them through instanceColor only.
    if (mountainBelt instanceof THREE.InstancedMesh) {
      const oldMaterial = Array.isArray(mountainBelt.material) ? null : mountainBelt.material;
      mountainBelt.material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        vertexColors: false,
        transparent: false,
        depthWrite: true,
        depthTest: true,
        fog: true,
        toneMapped: false,
      });
      mountainBelt.userData.skyDancerV31InstanceColorSafe = true;
      oldMaterial?.dispose();
    }

    skyline.position.set(-18, 0, 336);
    skyline.scale.setScalar(0.64);
    scene.fog = new THREE.Fog(0x6ba8be, 900, 1920);
    this.exposeDebug();
    this.prepared = true;
  }

  private exposeDebug(): void {
    if (typeof window === "undefined") return;
    const host = window as V31DebugHost;
    host.__skyDancerGetV31WorldDebug = () => {
      const camera = this.runtime.camera;
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      const groundY = -66.77;
      const t = Math.abs(direction.y) > 1e-5 ? (groundY - camera.position.y) / direction.y : Number.NaN;
      const centerGroundHit = Number.isFinite(t) && t > 0
        ? {
            x: camera.position.x + direction.x * t,
            y: groundY,
            z: camera.position.z + direction.z * t,
            t,
          }
        : null;

      const world = new THREE.Vector3();
      const layers: SceneLayerDebug[] = [];
      this.runtime.scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.InstancedMesh)) return;
        const name = object.name.toLowerCase();
        if (!name.includes("ground") && !name.includes("terrain") && !name.includes("field") && !name.includes("lake") && !name.includes("river") && !name.includes("landscape")) return;
        object.getWorldPosition(world);
        const material = Array.isArray(object.material) ? object.material[0] : object.material;
        const color = material && "color" in material && material.color instanceof THREE.Color ? material.color.getHex() : null;
        layers.push({
          name: object.name || "(unnamed)",
          type: object.type,
          geometry: object.geometry?.type ?? null,
          material: material?.type ?? null,
          color,
          worldY: Number(world.y.toFixed(3)),
          transparent: material ? material.transparent : null,
          opacity: material ? material.opacity : null,
          depthWrite: material ? material.depthWrite : null,
          fog: material && "fog" in material ? Boolean((material as THREE.Material & { fog?: boolean }).fog) : null,
          renderOrder: object.renderOrder,
          effectiveVisible: isEffectivelyVisible(object),
        });
      });

      const raycaster = new THREE.Raycaster();
      const ndcSamples: Record<string, THREE.Vector2> = {
        blackCenter: new THREE.Vector2(0, -0.05),
        blackLeft: new THREE.Vector2(-0.68, -0.06),
        blackRight: new THREE.Vector2(0.62, 0.02),
        lowerCenter: new THREE.Vector2(0, -0.55),
        lowerLeft: new THREE.Vector2(-0.52, -0.55),
        lowerRight: new THREE.Vector2(0.52, -0.55),
        midLeft: new THREE.Vector2(-0.46, -0.18),
        midRight: new THREE.Vector2(0.46, -0.18),
      };
      const rays: Record<string, RayHitDebug[]> = {};
      const instanceColorSample = new THREE.Color();
      for (const [label, ndc] of Object.entries(ndcSamples)) {
        raycaster.setFromCamera(ndc, camera);
        rays[label] = raycaster.intersectObjects(this.runtime.scene.children, true)
          .filter((hit) => hit.distance > 20
            && isEffectivelyVisible(hit.object)
            && (hit.object instanceof THREE.Mesh || hit.object instanceof THREE.InstancedMesh))
          .slice(0, 16)
          .map((hit) => {
            const object = hit.object as THREE.Mesh | THREE.InstancedMesh;
            const material = Array.isArray(object.material) ? object.material[0] : object.material;
            const color = material && "color" in material && material.color instanceof THREE.Color ? material.color.getHex() : null;
            const instanceId = hit.instanceId ?? null;
            let instanceColor: number | null = null;
            if (instanceId != null && object instanceof THREE.InstancedMesh && object.instanceColor) {
              object.getColorAt(instanceId, instanceColorSample);
              instanceColor = instanceColorSample.getHex();
            }
            return {
              name: object.name || object.parent?.name || "(unnamed)",
              type: object.type,
              distance: Number(hit.distance.toFixed(3)),
              point: {
                x: Number(hit.point.x.toFixed(3)),
                y: Number(hit.point.y.toFixed(3)),
                z: Number(hit.point.z.toFixed(3)),
              },
              material: material?.type ?? null,
              color,
              instanceId,
              instanceColor,
              transparent: material ? material.transparent : null,
              opacity: material ? material.opacity : null,
              depthWrite: material ? material.depthWrite : null,
              effectiveVisible: true,
            };
          });
      }

      return {
        camera: {
          x: Number(camera.position.x.toFixed(3)),
          y: Number(camera.position.y.toFixed(3)),
          z: Number(camera.position.z.toFixed(3)),
          dx: Number(direction.x.toFixed(4)),
          dy: Number(direction.y.toFixed(4)),
          dz: Number(direction.z.toFixed(4)),
        },
        centerGroundHit,
        layers,
        rays,
      };
    };
  }
}
