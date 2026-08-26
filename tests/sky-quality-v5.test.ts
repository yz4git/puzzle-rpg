import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Sky Dancer V5 replaces the legacy close-scale world picture", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV5.ts", import.meta.url), "utf8");
  assert.match(source, /const GROUND_Y = -46/);
  assert.match(source, /sky-dancer-q5-/);
  assert.match(source, /buildCloudBanks/);
  assert.match(source, /buildMountainRim/);
  assert.match(source, /verticalRenderScaleMetersPerUnit/);
  assert.match(source, /DodecahedronGeometry/);
});

test("Sky Dancer V5 removes rotor-like HP sticks and tones inherited car FX", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV5.ts", import.meta.url), "utf8");
  assert.match(source, /installEnemyMarkers/);
  assert.match(source, /child\.name === "hp-fill"/);
  assert.match(source, /PlaneGeometry\(1\.28, 0\.105\)/);
  assert.match(source, /child !== this\.runtimeV5\.playerVisual/);
  assert.match(source, /sky-dancer-wing-vapor-/);
});

test("Sky Dancer HUD quality pass keeps feedback without covering the aircraft", () => {
  const source = readFileSync(new URL("../app/SkyDancerHudQualityPass.tsx", import.meta.url), "utf8");
  assert.match(source, /legacyStyles\.combo/);
  assert.match(source, /font-size: clamp\(17px, 3\.1vw, 29px\)/);
  assert.match(source, /legacyStyles\.ramBanner/);
  assert.match(source, /phaseStyles\.wallRide/);
});
