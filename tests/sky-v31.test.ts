import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("V31 activates the ground density and cloud quality pass", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV31.ts", import.meta.url), "utf8");
  const pass = readFileSync(new URL("../src/sky/presentation/SkyDancerV31PresentationPass.ts", import.meta.url), "utf8");
  assert.match(source, /extends SkyDancerAirCombatFxV30/);
  assert.match(source, /SkyDancerV31PresentationPass/);
  assert.match(pass, /SkyDancerGroundDensityV31/);
  assert.match(pass, /SkyDancerGroundReadabilityV31/);
  assert.match(pass, /SkyDancerCloudQualityV31/);
  assert.match(pass, /groundDensity\.update\(snapshot\)/);
  assert.match(pass, /groundReadability\.update\(\)/);
  assert.match(pass, /cloudQuality\.update\(snapshot\)/);
});

test("V31 restores modern presentation roots hidden by the legacy theme bootstrap", () => {
  const source = readFileSync(new URL("../src/sky/presentation/SkyDancerV31PresentationPass.ts", import.meta.url), "utf8");
  assert.match(source, /V31_OWNED_PRESENTATION_ROOTS/);
  assert.match(source, /sky-dancer-v30-valley-detail/);
  assert.match(source, /sky-dancer-v30-world-presentation/);
  assert.match(source, /sky-dancer-v30-sky/);
  assert.match(source, /sky-dancer-v31-ground-density/);
  assert.match(source, /sky-dancer-v31-cloud-system/);
  assert.match(source, /restoreOwnedPresentationRoots\(\)/);
  assert.match(source, /object\.visible = true/);
});

test("V31 ground density uses a deterministic 7x7 instanced neighborhood", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerGroundDensityV31.ts", import.meta.url), "utf8");
  assert.match(source, /TILE_RADIUS = 3/);
  assert.match(source, /sky-dancer-v31-patchwork-fields/);
  assert.match(source, /sky-dancer-v31-settlement-buildings/);
  assert.match(source, /sky-dancer-v31-forest-belts/);
  assert.match(source, /sky-dancer-v31-road-network/);
  assert.match(source, /sky-dancer-v31-landmark-towers/);
  assert.match(source, /fieldCount = 6/);
  assert.match(source, /InstancedMesh/);
  assert.match(source, /transparent: false/);
  assert.match(source, /depthWrite: true/);
  assert.match(source, /function pick/);
});

test("V31 ground instances use instanceColor without geometry vertex colors", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerGroundDensityV31.ts", import.meta.url), "utf8");
  assert.match(source, /setColorAt\(index, color\)/);
  assert.match(source, /vertexColors: false/);
  assert.doesNotMatch(source, /vertexColors: true/);
});

test("V31 collapses macro terrain to one opaque fixed-green foundation", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerGroundReadabilityV31.ts", import.meta.url), "utf8");
  assert.match(source, /sky-dancer-v30-ground-foundation/);
  assert.match(source, /sky-dancer-v31-landscape-base/);
  assert.match(source, /macroLandscape\.visible = false/);
  assert.match(source, /skyDancerV31SupersededMacroLandscape/);
  assert.match(source, /foundation\.material = new THREE\.MeshBasicMaterial/);
  assert.match(source, /color: 0x416f3d/);
  assert.match(source, /vertexColors: false/);
  assert.match(source, /opacity: 1/);
  assert.match(source, /depthWrite: true/);
  assert.match(source, /fog: false/);
  assert.match(source, /toneMapped: false/);
  assert.match(source, /skyDancerV31SingleGroundFoundation/);
});

test("V31 suppresses legacy fields and keeps horizon mountains on instanceColor", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerGroundReadabilityV31.ts", import.meta.url), "utf8");
  assert.match(source, /sky-dancer-v30-patchwork-fields/);
  assert.match(source, /legacyFields\.visible = false/);
  assert.match(source, /skyDancerV31SupersededFieldLayer/);
  assert.match(source, /sky-dancer-v30-mountain-belt/);
  assert.match(source, /skyDancerV31InstanceColorSafe/);
  assert.match(source, /mountainBelt\.material = new THREE\.MeshBasicMaterial/);
  assert.match(source, /sky-dancer-v29-reference-skyline/);
  assert.match(source, /scale\.setScalar\(0\.64\)/);
  assert.match(source, /Fog\(0x6ba8be, 900, 1920\)/);
});

test("V31 replaces legacy clouds with cohesive unlit three-depth cumulus clusters", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerCloudQualityV31.ts", import.meta.url), "utf8");
  assert.match(source, /WORLD_SNAP = 105/);
  assert.match(source, /sky-dancer-v31-low-clouds/);
  assert.match(source, /sky-dancer-v31-mid-clouds/);
  assert.match(source, /sky-dancer-v31-horizon-clouds/);
  assert.match(source, /IcosahedronGeometry\(1, 1\)/);
  assert.match(source, /clusters: 9/);
  assert.match(source, /lobes: 12/);
  assert.match(source, /radiusMin: 280/);
  assert.match(source, /radiusMin: 660/);
  assert.match(source, /MathUtils\.lerp\(4\.5, 8\.5/);
  assert.match(source, /new THREE\.MeshBasicMaterial/);
  assert.match(source, /vertexColors: false/);
  assert.doesNotMatch(source, /vertexColors: true/);
  assert.match(source, /toneMapped: false/);
  assert.match(source, /evenAngle = cluster \/ config\.clusters/);
  assert.match(source, /fog: config\.fog/);
  assert.match(source, /depthWrite: config\.solid/);
  assert.match(source, /name\.includes\("cloud"\)/);
  assert.match(source, /DodecahedronGeometry/);
});

test("V31 keeps sky and horizon while tilting the final camera toward the valley", () => {
  const source = readFileSync(new URL("../src/sky/presentation/SkyDancerCameraPresentation.ts", import.meta.url), "utf8");
  assert.match(source, /scheduleSkyDancerV31CameraPitch/);
  assert.match(source, /applyCameraPresentation/);
  assert.match(source, /camera\.rotateX\(-0\.08\)/);
});

test("V31 preserves green land by replacing the full-screen V30 blue grade in both runtimes", () => {
  const grade = readFileSync(new URL("../app/SkyDancerColorGradeV31.tsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const pages = readFileSync(new URL("../pages-entry.tsx", import.meta.url), "utf8");
  assert.match(grade, /rgba\(0, 0, 0, 0\) 61%/);
  assert.match(grade, /mix-blend-mode: multiply/);
  assert.match(app, /SkyDancerColorGradeV31/);
  assert.doesNotMatch(app, /SkyDancerColorGradeV30/);
  assert.match(pages, /SkyDancerColorGradeV31/);
  assert.doesNotMatch(pages, /SkyDancerColorGradeV30/);
});

test("V31 removes world-space boss HP obstruction and moves boss HUD off center", () => {
  const fx = readFileSync(new URL("../src/sky/presentation/SkyDancerBossGaugePresentation.ts", import.meta.url), "utf8");
  const hud = readFileSync(new URL("../app/SkyDancerHudV31.tsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const pages = readFileSync(new URL("../pages-entry.tsx", import.meta.url), "utf8");
  assert.match(fx, /hideSkyDancerBossWorldGauge/);
  assert.match(fx, /skyDancerV31BossWorldGaugeHidden/);
  assert.match(hud, /bossMeter/);
  assert.match(hud, /left: max\(14px/);
  assert.match(hud, /width: min\(31vw, 252px\)/);
  assert.match(app, /SkyDancerHudV31/);
  assert.match(pages, /SkyDancerHudV31/);
});
