import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");

test("V35 locks the supplied reference image as the graphics quality contract", () => {
  const contract = read("../docs/SKY_DANCER_REFERENCE_ART_DIRECTION_V35.md");
  assert.match(contract, /visual north star/i);
  assert.match(contract, /City density is the primary ground focal point/);
  assert.match(contract, /Clouds stay below the flight plane/);
  assert.match(contract, /If V35 visual capture is visibly worse than V32\/V33/);
});

test("V35 presentation pipeline has one final owner after V34", () => {
  const pipeline = read("../src/sky/presentation/SkyDancerPresentationPipeline.ts");
  assert.match(pipeline, /SkyDancerV35ReferencePass/);
  assert.doesNotMatch(pipeline, /SkyDancerV35ReferencePolishPass|v35Polish/);
  assert.match(pipeline, /this\.v34\.update\(snapshot\);\n    this\.v35\.update\(snapshot\);/);
});

test("V35 single owner builds the reference-width central city and restrained horizon layers", () => {
  const source = read("../src/sky/presentation/SkyDancerV35ReferencePass.ts");
  assert.match(source, /MAX_FOCUS_BUILDINGS = 880/);
  assert.match(source, /MAX_FOCUS_RIVER = 24/);
  assert.match(source, /FRONT_CLOUD_COUNT = 32/);
  assert.match(source, /sky-dancer-v35-focus-buildings/);
  assert.match(source, /sky-dancer-v35-focus-streets/);
  assert.match(source, /sky-dancer-v35-focus-river/);
  assert.match(source, /sky-dancer-v35-front-mountains-far/);
  assert.match(source, /sky-dancer-v35-front-mountains-near/);
  assert.match(source, /sky-dancer-v35-front-cloud-patches/);
  assert.match(source, /tileZ \* CITY_SNAP \+ 300/);
  assert.match(source, /FOCUS_CITY_LOCAL_CENTER_Z = 145/);
  assert.match(source, /const spacing = 7\.2/);
  assert.match(source, /const riverX = -10/);
  assert.match(source, /new THREE\.MeshLambertMaterial/);
  assert.match(source, /opacity: far \? 0\.23 : 0\.38/);
  assert.match(source, /opacity: 0\.20/);
  assert.match(source, /blockType > 0\.86/);
  assert.match(source, /fog\.near = 620/);
  assert.match(source, /fog\.far = 1760/);
  assert.match(source, /skyDancerV35ReferenceOwner = "single-pass"/);
  assert.match(source, /this\.restoreOwnPresentation\(\)/);
  assert.match(source, /this\.focusRoot\.visible = true/);
});

test("V35 removes superseded scene work and reuses rebuild scratch objects", () => {
  const source = read("../src/sky/presentation/SkyDancerV35ReferencePass.ts");
  const v34 = read("../src/sky/presentation/SkyDancerV34QualityPass.ts");
  const rebuild = source.slice(
    source.indexOf("private rebuildFocusCity"),
    source.indexOf("private makeFocusBuildings"),
  );

  assert.doesNotMatch(source, /sky-dancer-v35-city-low|sky-dancer-v35-metro-road-grid|sky-dancer-v35-cloud-main/);
  assert.match(source, /private readonly instanceDummy = new THREE\.Object3D/);
  assert.match(source, /private readonly cityPalette =/);
  assert.match(source, /private readonly legacyDynamicLayers/);
  assert.doesNotMatch(rebuild, /new THREE\.Object3D|\.map\(\(value\) => new THREE\.Color/);
  assert.match(v34, /if \(this\.terrainPatches\.visible\) this\.updateTerrainPatches\(snapshot\)/);
  assert.match(v34, /skyDancerV35ReferenceOwner !== "single-pass"/);
  assert.match(v34, /private readonly atmosphereColor = new THREE\.Color/);
  assert.doesNotMatch(v34, /scene\.background = new THREE\.Color/);
});

test("V35 webdriver audit verifies density plus reference-like central screen coverage", () => {
  const bridge = read("../src/sky/presentation/SkyDancerV35VisualAuditBridge.ts");
  const audit = read("../scripts/webgl-v35-reference-audit.mjs");
  assert.match(bridge, /sky-dancer-v35-front-cloud-patches/);
  assert.match(bridge, /sky-dancer-v35-front-mountains-far/);
  assert.match(bridge, /sky-dancer-v35-front-mountains-near/);
  assert.match(bridge, /sky-dancer-v35-focus-river/);
  assert.match(bridge, /singleOwnerInstalled/);
  assert.match(bridge, /projectedInstanceStats/);
  assert.match(bridge, /focusCityInViewCount/);
  assert.doesNotMatch(bridge, /cityLow|firstPassCityVisible|polishFramingInstalled/);
  assert.match(audit, /focusCityCount\) < 800/);
  assert.match(audit, /focusCityInViewCount\) < 650/);
  assert.match(audit, /cityVerticalSpan > 0\.90/);
  assert.match(audit, /cityHorizontalSpan < 1\.15 \|\| cityHorizontalSpan > 1\.70/);
  assert.match(audit, /reference midground corridor/i);
  assert.match(audit, /focalDelta < 220 \|\| focalDelta > 360/);
  assert.match(audit, /settlementsVisible \|\| visual\.towersVisible \|\| visual\.roadsVisible/);
  assert.match(audit, /singleOwnerInstalled/);
});

test("V35 uses one reference camera decorator without changing the 300m gameplay model", () => {
  const camera = read("../src/sky/presentation/SkyDancerCameraPresentation.ts");
  const pass = read("../src/sky/presentation/SkyDancerV35ReferencePass.ts");
  assert.match(camera, /scheduleSkyDancerV35ReferenceFraming/);
  assert.match(camera, /cameraRuntime\.camera\.rotateX\(0\.205\)/);
  assert.doesNotMatch(pass, /SKY_DANCER_V29_ALTITUDE_METERS\s*=/);
  assert.doesNotMatch(pass, /applyCameraPresentation/);
});

test("V35 HUD follows the reference hierarchy using real existing telemetry", () => {
  const hud = read("../app/SkyDancerHudV35.tsx");
  const game = read("../app/CartRogueGamePhase13.tsx");
  assert.match(game, /<SkyDancerHudV34 \/>\n        <SkyDancerHudV35 \/>/);
  assert.match(hud, /aria-label="Missile warning"/);
  assert.match(hud, /left: 50% !important/);
  assert.match(hud, /bottom: max\(88px/);
  assert.match(hud, /does not yet own/);
  assert.doesNotMatch(hud, /1,250|x2\.4|VX-23/);
});
