import * as THREE from "three";
import type { SkyDancerFxRuntime } from "../SkyDancerAirCombatFxV2";

export interface SkyDancerV39VisualAuditSnapshot {
  v36CityCount: number;
  v36CityVisible: boolean;
  v35CityVisible: boolean;
  terrainVisible: boolean;
  arterialCount: number;
  playerSurfaceKitVisible: boolean;
  turboLinesInstalled: boolean;
  v38SkyVisible: boolean;
  v38RidgesVisible: boolean;
  v38CloudCount: number;
  v38CloudsVisible: boolean;
  fogNear: number | null;
  fogFar: number | null;
}

function effectiveVisible(object: THREE.Object3D | null | undefined): boolean {
  let current: THREE.Object3D | null = object ?? null;
  while (current) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return Boolean(object);
}

function instanceCount(runtime: SkyDancerFxRuntime, name: string): number {
  const object = runtime.scene.getObjectByName(name);
  return object instanceof THREE.InstancedMesh ? object.count : 0;
}

export function getSkyDancerV39VisualAuditSnapshot(runtime: SkyDancerFxRuntime): SkyDancerV39VisualAuditSnapshot {
  let cityCount = 0;
  let cityVisible = false;
  for (let index = 0; index < 6; index += 1) {
    const object = runtime.scene.getObjectByName(`sky-dancer-v36-city-archetype-${index}`);
    if (object instanceof THREE.InstancedMesh) cityCount += object.count;
    cityVisible ||= effectiveVisible(object);
  }
  const fog = runtime.scene.fog;
  const farRidge = runtime.scene.getObjectByName("sky-dancer-v38-ridge-far");
  const nearRidge = runtime.scene.getObjectByName("sky-dancer-v38-ridge-near");
  const cloudMain = runtime.scene.getObjectByName("sky-dancer-v38-cloud-cluster-main");
  const cloudShade = runtime.scene.getObjectByName("sky-dancer-v38-cloud-cluster-shade");
  const flightRoot = runtime.session.car.group;
  return {
    v36CityCount: cityCount,
    v36CityVisible: cityVisible,
    v35CityVisible: effectiveVisible(runtime.scene.getObjectByName("sky-dancer-v35-focus-buildings")),
    terrainVisible: effectiveVisible(runtime.scene.getObjectByName("sky-dancer-v36-faceted-terrain")),
    arterialCount: instanceCount(runtime, "sky-dancer-v36-arterial-roads"),
    playerSurfaceKitVisible: effectiveVisible(flightRoot.getObjectByName("sky-dancer-v37-player-surface-kit")),
    turboLinesInstalled: Boolean(flightRoot.getObjectByName("sky-dancer-v37-turbo-speed-lines")),
    v38SkyVisible: effectiveVisible(runtime.scene.getObjectByName("sky-dancer-v38-four-band-sky")),
    v38RidgesVisible: effectiveVisible(farRidge) && effectiveVisible(nearRidge),
    v38CloudCount: instanceCount(runtime, "sky-dancer-v38-cloud-cluster-main") + instanceCount(runtime, "sky-dancer-v38-cloud-cluster-shade"),
    v38CloudsVisible: effectiveVisible(cloudMain) && effectiveVisible(cloudShade),
    fogNear: fog instanceof THREE.Fog ? fog.near : null,
    fogFar: fog instanceof THREE.Fog ? fog.far : null,
  };
}

export function installSkyDancerV39VisualAuditBridge(runtime: SkyDancerFxRuntime): void {
  if (typeof window === "undefined" || typeof navigator === "undefined" || !navigator.webdriver) return;
  const globals = window as unknown as Record<string, unknown>;
  globals.__skyDancerGetReferenceVisualV39 = () => getSkyDancerV39VisualAuditSnapshot(runtime);
}
