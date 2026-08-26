import * as THREE from "three";

interface LegacySceneryRuntime {
  scene: THREE.Scene;
}

const EXPLICIT_ROOTS = new Set([
  "sky-dancer-v19-midpoint-world",
  "sky-dancer-v22-quality-world",
  "sky-dancer-v24-horizon-silhouettes",
  "sky-dancer-v25-valley-fields",
  "sky-dancer-v25-landmark-city",
  "sky-dancer-v27-landmark-city-ring",
  "sky-dancer-v28-patchwork-valley",
  "sky-dancer-v28-mountain-depth",
  "phase67-turbo-hunt-world",
]);

const LEGACY_PREFIXES = [
  "sky-dancer-q5-",
  "sky-dancer-q11-",
  "sky-dancer-q12-",
  "sky-dancer-q13-",
  "sky-dancer-q14-",
  "sky-dancer-q15-",
  "sky-dancer-q16-",
  "phase46-ground-",
] as const;

const SCENERY_WORDS = [
  "terrain", "field", "parcel", "mosaic", "crop", "road", "river", "city",
  "mountain", "ridge", "town", "hedgerow", "highway", "landmark",
  "settlement", "tree", "roof", "infrastructure", "scenery", "canal",
  "industrial", "ground", "wind", "skyline",
] as const;

function isLegacySceneryRoot(object: THREE.Object3D): boolean {
  if (EXPLICIT_ROOTS.has(object.name)) return true;
  if (!LEGACY_PREFIXES.some((prefix) => object.name.startsWith(prefix))) return false;
  return SCENERY_WORDS.some((word) => object.name.includes(word));
}

/**
 * V12-V19 plus inherited Cart presentation phases accumulated complete
 * low-altitude worlds. At the final 300 m flight level they can sit tens of
 * render units above the actual V30/V31 terrain and completely occlude it.
 *
 * V30 originally inspected only top-level scene children. V31 extends that
 * policy through the full scene graph because several Cart layers (notably the
 * phase46 ground sheets) are nested. Combat FX are untouched; only objects whose
 * names explicitly match known scenery prefixes/words are suppressed.
 */
export class SkyDancerLegacySceneryCleanupV30 {
  private readonly runtime: LegacySceneryRuntime;
  private hiddenCount = 0;

  constructor(runtime: LegacySceneryRuntime) {
    this.runtime = runtime;
  }

  update(): void {
    for (const name of EXPLICIT_ROOTS) {
      const object = this.runtime.scene.getObjectByName(name);
      if (!object?.visible) continue;
      object.visible = false;
      this.hiddenCount += 1;
    }

    this.runtime.scene.traverse((object) => {
      if (object === this.runtime.scene || !object.visible || !isLegacySceneryRoot(object)) return;
      object.visible = false;
      object.userData.skyDancerLegacySceneryHidden = true;
      this.hiddenCount += 1;
    });
  }

  getHiddenCount(): number {
    return this.hiddenCount;
  }
}
