import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("V33 production entry ends version inheritance at V29 and composes modern presentation", () => {
  const entry = readFileSync(new URL("../src/sky/SkyDancerAirCombatFx.ts", import.meta.url), "utf8");
  assert.match(entry, /class SkyDancerAirCombatFx extends SkyDancerAirCombatFxV29/);
  assert.match(entry, /SkyDancerPresentationPipeline/);
  assert.match(entry, /presentation\.update\(snapshot\)/);
  assert.doesNotMatch(entry, /export \{\s*SkyDancerAirCombatFxV32 as SkyDancerAirCombatFx/);
});

test("V33 pipeline preserves V30 then V31 then V32 presentation order", () => {
  const pipeline = readFileSync(new URL("../src/sky/presentation/SkyDancerPresentationPipeline.ts", import.meta.url), "utf8");
  assert.match(pipeline, /new SkyDancerV30PresentationPass/);
  assert.match(pipeline, /new SkyDancerV31PresentationPass/);
  assert.match(pipeline, /new SkyDancerV32PresentationPass/);
  assert.match(pipeline, /this\.v30\.update\(snapshot\);\s*this\.v31\.update\(snapshot\);\s*this\.v32\.update\(snapshot\);/s);
});

test("V33 keeps historical V30-V32 classes as thin compatibility wrappers", () => {
  const v30 = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV30.ts", import.meta.url), "utf8");
  const v31 = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV31.ts", import.meta.url), "utf8");
  const v32 = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV32.ts", import.meta.url), "utf8");
  assert.match(v30, /SkyDancerV30PresentationPass/);
  assert.match(v31, /SkyDancerV31PresentationPass/);
  assert.match(v32, /SkyDancerV32PresentationPass/);
  assert.doesNotMatch(v31, /SkyDancerGroundDensityV31/);
  assert.doesNotMatch(v32, /SkyDancerReferencePolishV32/);
});

test("V33 centralizes camera decorators and boss world-gauge policy", () => {
  const camera = readFileSync(new URL("../src/sky/presentation/SkyDancerCameraPresentation.ts", import.meta.url), "utf8");
  const boss = readFileSync(new URL("../src/sky/presentation/SkyDancerBossGaugePresentation.ts", import.meta.url), "utf8");
  assert.match(camera, /skyDancerV31PitchInstalled/);
  assert.match(camera, /camera\.rotateX\(-0\.08\)/);
  assert.match(camera, /skyDancerV32ReferenceCamera/);
  assert.match(camera, /camera\.rotateX\(0\.095\)/);
  assert.match(boss, /skyDancerV31BossWorldGaugeHidden/);
});
