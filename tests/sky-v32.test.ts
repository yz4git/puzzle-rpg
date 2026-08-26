import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("V32 remains a compatibility checkpoint over an extracted reference presentation pass", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV32.ts", import.meta.url), "utf8");
  const pass = readFileSync(new URL("../src/sky/presentation/SkyDancerV32PresentationPass.ts", import.meta.url), "utf8");
  assert.match(source, /extends SkyDancerAirCombatFxV31/);
  assert.match(source, /SkyDancerV32PresentationPass/);
  assert.match(pass, /SkyDancerReferenceWorldV32/);
  assert.match(pass, /SkyDancerReferencePolishV32/);
  assert.match(pass, /referencePresentation\.update\(snapshot\)/);
  assert.match(pass, /referencePolish\.update\(snapshot\)/);
  assert.doesNotMatch(pass, /private readonly referenceWorld:/);
});

test("V32 first pass removes close blob hills and composes shallow ridges plus clustered cities", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerReferenceWorldV32.ts", import.meta.url), "utf8");
  assert.match(source, /sky-dancer-v30-mountain-belt/);
  assert.match(source, /sky-dancer-v31-settlement-buildings/);
  assert.match(source, /sky-dancer-v32-ridge-near/);
  assert.match(source, /sky-dancer-v32-ridge-far/);
  assert.doesNotMatch(source, /sky-dancer-v32-rolling-hills/);
  assert.match(source, /sky-dancer-v32-city-low/);
  assert.match(source, /sky-dancer-v32-city-high/);
  assert.match(source, /districtCount = 7/);
  assert.match(source, /\? 44/);
  assert.match(source, /height = 68/);
});

test("V32 first pass builds compact multi-lobe cumulus banks and a dedicated blue sky dome", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerReferenceWorldV32.ts", import.meta.url), "utf8");
  assert.match(source, /sky-dancer-v32-hero-clouds/);
  assert.match(source, /sky-dancer-v32-hero-cloud-shade/);
  assert.match(source, /clusters = 6/);
  assert.match(source, /lobes = 14/);
  assert.match(source, /upper = l >= 9/);
  assert.match(source, /sky-dancer-v32-sky-dome/);
  assert.match(source, /vec3 zenith/);
  assert.match(source, /sky-dancer-v25-horizon-cloud-banks/);
  assert.match(source, /sky-dancer-v29-reference-cloud-bank/);
  assert.match(source, /restoreOwnPresentation/);
});

test("V32 final polish replaces first-pass ridges cities and clouds with distant cohesive composition", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerReferencePolishV32.ts", import.meta.url), "utf8");
  assert.match(source, /sky-dancer-v32-polish-ridge-near/);
  assert.match(source, /sky-dancer-v32-polish-ridge-far/);
  assert.match(source, /IcosahedronGeometry\(1, 1\)/);
  assert.match(source, /sky-dancer-v32-polish-city-high/);
  assert.match(source, /\{ x: -175, z: 345, count: 58, hero: true \}/);
  assert.match(source, /sky-dancer-v32-polish-cloud-main/);
  assert.match(source, /angle: -0\.58, radius: 455/);
  assert.match(source, /sky-dancer-v25-horizon-cloud-banks/);
  assert.match(source, /sky-dancer-v29-reference-cloud-bank/);
  assert.match(source, /object\.visible = false/);
  assert.match(source, /Number\.isFinite\(snapshot\.x\)/);
});

test("V32 increases hero aircraft presence without changing gameplay collision", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerReferenceWorldV32.ts", import.meta.url), "utf8");
  const polish = readFileSync(new URL("../src/sky/SkyDancerReferencePolishV32.ts", import.meta.url), "utf8");
  assert.match(source, /player\.scale\.multiplyScalar\(1\.32\)/);
  assert.match(polish, /player\.scale\.multiplyScalar\(2\.10\)/);
  assert.match(source, /sky-dancer-v32-player-detail/);
  assert.match(source, /CylinderGeometry\(0\.29, 0\.34, 0\.98, 8\)/);
  assert.match(source, /TorusGeometry\(0\.24, 0\.045, 5, 10\)/);
  assert.match(source, /wingTip/);
});

test("V32 restores reference-like horizon balance after the V31 look-down pass", () => {
  const source = readFileSync(new URL("../src/sky/presentation/SkyDancerCameraPresentation.ts", import.meta.url), "utf8");
  assert.match(source, /scheduleSkyDancerV32CameraBalance/);
  assert.match(source, /camera\.rotateX\(0\.095\)/);
  assert.match(source, /skyDancerV32ReferenceCamera/);
});

test("V32 HUD polish is mounted in app and static pages runtimes", () => {
  const hud = readFileSync(new URL("../app/SkyDancerHudV32.tsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const pages = readFileSync(new URL("../pages-entry.tsx", import.meta.url), "utf8");
  assert.match(hud, /data-sd-gas-card/);
  assert.match(hud, /data-sd-turbo-card/);
  assert.match(hud, /left: max\(18px, env\(safe-area-inset-left\)\)/);
  assert.match(hud, /Fire missile/);
  assert.match(app, /SkyDancerHudV32/);
  assert.match(pages, /SkyDancerHudV32/);
});
