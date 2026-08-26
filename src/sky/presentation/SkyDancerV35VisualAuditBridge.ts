import * as THREE from "three";
import type { SkyDancerFxRuntime } from "../SkyDancerAirCombatFxV2";

export interface SkyDancerV35VisualAuditSnapshot {
  focusCityCount: number;
  focusStreetCount: number;
  riverCount: number;
  focusCloudCount: number;
  focusMountainCount: number;
  focusCityInViewCount: number;
  focusCityNdcBounds: { minX: number; maxX: number; minY: number; maxY: number } | null;
  focusRootZ: number | null;
  focusCenterWorldZ: number | null;
  cameraZ: number;
  focusRootEffectiveVisible: boolean;
  fieldsVisible: boolean;
  settlementsVisible: boolean;
  towersVisible: boolean;
  roadsVisible: boolean;
  v34MassesVisible: boolean;
  legacyRidgesVisible: boolean;
  focusCityVisible: boolean;
  cameraFramingInstalled: boolean;
  singleOwnerInstalled: boolean;
  fogNear: number | null;
  fogFar: number | null;
}

function instanceCount(runtime: SkyDancerFxRuntime, name: string): number {
  const object = runtime.scene.getObjectByName(name);
  return object instanceof THREE.InstancedMesh ? object.count : 0;
}

function visible(runtime: SkyDancerFxRuntime, name: string): boolean {
  return runtime.scene.getObjectByName(name)?.visible ?? false;
}

function effectiveVisible(object: THREE.Object3D | null | undefined): boolean {
  let current: THREE.Object3D | null = object ?? null;
  while (current) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return Boolean(object);
}

function projectedInstanceStats(runtime: SkyDancerFxRuntime, name: string): {
  count: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number } | null;
} {
  const mesh = runtime.scene.getObjectByName(name);
  if (!(mesh instanceof THREE.InstancedMesh) || !effectiveVisible(mesh)) return { count: 0, bounds: null };
  runtime.scene.updateMatrixWorld(true);
  runtime.camera.updateMatrixWorld(true);
  const instance = new THREE.Matrix4();
  const world = new THREE.Matrix4();
  const point = new THREE.Vector3();
  let count = 0;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < mesh.count; index += 1) {
    mesh.getMatrixAt(index, instance);
    world.multiplyMatrices(mesh.matrixWorld, instance);
    point.setFromMatrixPosition(world).project(runtime.camera);
    if (point.z < -1 || point.z > 1 || point.x < -1 || point.x > 1 || point.y < -1 || point.y > 1) continue;
    count += 1;
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  return {
    count,
    bounds: count > 0 ? { minX, maxX, minY, maxY } : null,
  };
}

export function getSkyDancerV35VisualAuditSnapshot(runtime: SkyDancerFxRuntime): SkyDancerV35VisualAuditSnapshot {
  const fog = runtime.scene.fog;
  const focusRoot = runtime.scene.getObjectByName("sky-dancer-v35-reference-focus-city");
  const focusRootZ = focusRoot?.position.z ?? null;
  const localCenterZ = typeof focusRoot?.userData.skyDancerV35LocalCenterZ === "number"
    ? focusRoot.userData.skyDancerV35LocalCenterZ
    : null;
  const focusCenterWorldZ = focusRootZ !== null && localCenterZ !== null ? focusRootZ + localCenterZ : null;
  const focusMountainCount = instanceCount(runtime, "sky-dancer-v35-front-mountains-far")
    + instanceCount(runtime, "sky-dancer-v35-front-mountains-near");
  const projectedCity = projectedInstanceStats(runtime, "sky-dancer-v35-focus-buildings");

  return {
    focusCityCount: instanceCount(runtime, "sky-dancer-v35-focus-buildings"),
    focusStreetCount: instanceCount(runtime, "sky-dancer-v35-focus-streets"),
    riverCount: instanceCount(runtime, "sky-dancer-v35-focus-river"),
    focusCloudCount: instanceCount(runtime, "sky-dancer-v35-front-cloud-patches"),
    focusMountainCount,
    focusCityInViewCount: projectedCity.count,
    focusCityNdcBounds: projectedCity.bounds,
    focusRootZ,
    focusCenterWorldZ,
    cameraZ: runtime.camera.position.z,
    focusRootEffectiveVisible: effectiveVisible(focusRoot),
    fieldsVisible: visible(runtime, "sky-dancer-v31-patchwork-fields"),
    settlementsVisible: visible(runtime, "sky-dancer-v31-settlement-buildings"),
    towersVisible: visible(runtime, "sky-dancer-v31-landmark-towers"),
    roadsVisible: visible(runtime, "sky-dancer-v31-road-network"),
    v34MassesVisible: visible(runtime, "sky-dancer-v34-irregular-terrain-masses"),
    legacyRidgesVisible: [
      "sky-dancer-v32-polish-ridge-near",
      "sky-dancer-v32-polish-ridge-far",
      "sky-dancer-v32-ridge-near",
      "sky-dancer-v32-ridge-far",
    ].some((name) => visible(runtime, name)),
    focusCityVisible: effectiveVisible(runtime.scene.getObjectByName("sky-dancer-v35-focus-buildings")),
    cameraFramingInstalled: runtime.camera.userData.skyDancerV35ReferenceFraming === true,
    singleOwnerInstalled: runtime.scene.userData.skyDancerV35ReferenceOwner === "single-pass",
    fogNear: fog instanceof THREE.Fog ? fog.near : null,
    fogFar: fog instanceof THREE.Fog ? fog.far : null,
  };
}

export function installSkyDancerV35VisualAuditBridge(runtime: SkyDancerFxRuntime): void {
  if (typeof window === "undefined" || typeof navigator === "undefined" || !navigator.webdriver) return;
  const globals = window as unknown as Record<string, unknown>;
  globals.__skyDancerGetReferenceVisualV35 = () => getSkyDancerV35VisualAuditSnapshot(runtime);
}
