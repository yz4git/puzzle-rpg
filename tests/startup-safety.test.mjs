import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Sky Dancer uses the Cart WebGL renderer with Sky presentation and Canvas fallback", async () => {
  const skyWebgl = await readFile(new URL("../src/sky/SkyDancerWebGLDemo.ts", import.meta.url), "utf8");
  const cartWebgl = await readFile(new URL("../src/cart/CartRogueWebGLDemo.ts", import.meta.url), "utf8");
  const canvasEntry = await readFile(new URL("../src/sky/SkyDancerCanvasPreview.ts", import.meta.url), "utf8");
  const canvasV4 = await readFile(new URL("../src/sky/SkyDancerCanvasPreviewV4.ts", import.meta.url), "utf8");
  const canvasV3 = await readFile(new URL("../src/sky/SkyDancerCanvasPreviewV3.ts", import.meta.url), "utf8");
  const canvasV2 = await readFile(new URL("../src/sky/SkyDancerCanvasPreviewV2.ts", import.meta.url), "utf8");
  const cartCanvas = await readFile(new URL("../src/cart/CartRogueCanvasPreview.ts", import.meta.url), "utf8");
  const game = await readFile(new URL("../app/CartRogueGame.tsx", import.meta.url), "utf8");

  assert.match(skyWebgl, /extends CartRogueWebGLDemo/);
  assert.match(skyWebgl, /SkyDancerAirCombatFx/);
  assert.match(skyWebgl, /Sky Dancer WebGL game view/);
  assert.match(cartWebgl, /new THREE\.WebGLRenderer/);
  assert.match(cartWebgl, /setPixelRatio/);
  assert.match(cartWebgl, /requestAnimationFrame/);

  assert.match(canvasEntry, /SkyDancerCanvasPreviewV4/);
  assert.match(canvasV4, /extends SkyDancerCanvasPreviewV3/);
  assert.match(canvasV4, /requestSkyDancerPlayerMissile/);
  assert.match(canvasV3, /extends SkyDancerCanvasPreviewV2/);
  assert.match(canvasV3, /installSkyDancerFlightAvoidance/);
  assert.match(canvasV2, /extends CartRogueCanvasPreview/);
  assert.match(cartCanvas, /CanvasRenderingContext2D/);
  assert.match(cartCanvas, /requestAnimationFrame/);

  assert.match(game, /new SkyDancerWebGLDemo/);
  assert.match(game, /new SkyDancerCanvasPreview/);
  assert.match(game, /probe\.getContext\("webgl2"\) \|\| probe\.getContext\("webgl"\)/);
  assert.match(game, /WebGL runtime failure/);
});

test("Sky Dancer keeps steering/Turbo touch safety and replaces Brake with Shot", async () => {
  const page = await readFile(new URL("../app/CartRogueGame.tsx", import.meta.url), "utf8");
  const phase = await readFile(new URL("../app/CartRogueGamePhase13.tsx", import.meta.url), "utf8");
  const shot = await readFile(new URL("../app/SkyDancerShotControl.tsx", import.meta.url), "utf8");
  const patch = await readFile(new URL("../src/sky/SkyDancerControlPatch.ts", import.meta.url), "utf8");
  const bridge = await readFile(new URL("../src/sky/SkyDancerWeaponBridge.ts", import.meta.url), "utf8");

  assert.match(page, /setPointerCapture/);
  assert.match(page, /onPointerCancel=\{releaseSteer\}/);
  assert.match(page, /onPointerCancel=\{releaseBoost\}/);
  assert.match(page, /boostPointersRef/);
  assert.match(phase, /SkyDancerShotControl/);
  assert.match(shot, />SHOT</);
  assert.match(shot, />MISSILE</);
  assert.match(shot, /fireSkyDancerActiveWeapon/);
  assert.match(bridge, /bindSkyDancerWeaponSession/);
  assert.match(shot, /setPointerCapture/);
  assert.match(shot, /textContent\?\.trim\(\) === "BRAKE"/);
  assert.match(patch, /original\.call\(this, false\)/);
});
