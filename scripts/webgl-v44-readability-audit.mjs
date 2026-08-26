import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.SKY_DANCER_AUDIT_URL || "http://127.0.0.1:4173";
const outputDir = process.env.SKY_DANCER_AUDIT_DIR || "artifacts/webgl-audit";
const BASE_RUN_MS = 115_000;
const CLEANUP_OBSERVE_MS = 50_000;
const HARD_RUN_MS = 165_000;
const SAMPLE_MS = 180;

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-webgl", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
page.on("pageerror", (error) => pageErrors.push(String(error)));

await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60_000 });
const start = page.getByRole("button", { name: /START(?: HARD)? RUN/i });
if (await start.isVisible().catch(() => false)) await start.click();
const canvas = page.locator('canvas[aria-label="Sky Dancer WebGL game view"]');
await canvas.waitFor({ state: "visible", timeout: 30_000 });
const shot = page.getByRole("button", { name: "Fire missile" });
await shot.waitFor({ state: "visible", timeout: 10_000 });
await page.waitForTimeout(900);

let maxVisibleAltitudeCues = 0;
let maxTrailPoints = 0;
let sawUpCue = false;
let sawDownCue = false;
let sawCurvedTrail = false;
let sawCleanup = false;
let sawOrbit = false;
let sawAttackRun = false;
let maxOrbitDistance = 0;
let minOrbitDistance = Number.POSITIVE_INFINITY;
let maxTacticalPhase = 0;
let shots = 0;
let hits = 0;
let capturedCombat = false;
let capturedCleanup = false;
let steering = "ArrowRight";
let nextSwitch = 7000;
const began = Date.now();
let deadlineMs = BASE_RUN_MS;
await page.keyboard.down(steering);

while (Date.now() - began < Math.min(deadlineMs, HARD_RUN_MS)) {
  const elapsed = Date.now() - began;
  if (elapsed >= nextSwitch) {
    await page.keyboard.up(steering);
    steering = steering === "ArrowRight" ? "ArrowLeft" : "ArrowRight";
    await page.keyboard.down(steering);
    nextSwitch += 7000;
  }
  const box = await shot.boundingBox();
  if (box && elapsed % 700 < 230) await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.5);
  if (elapsed > 12_000 && elapsed < 12_650) await page.keyboard.down("Space");
  else await page.keyboard.up("Space");
  await page.waitForTimeout(SAMPLE_MS);

  const sample = await page.evaluate(() => ({
    v43: typeof window.__skyDancerGetV43VerticalFlight === "function" ? window.__skyDancerGetV43VerticalFlight() : null,
    v44: typeof window.__skyDancerGetV44Readability === "function" ? window.__skyDancerGetV44Readability() : null,
    weapon: typeof window.__skyDancerGetWeaponState === "function" ? window.__skyDancerGetWeaponState() : null,
  }));
  if (!sample.v44) continue;
  maxVisibleAltitudeCues = Math.max(maxVisibleAltitudeCues, Number(sample.v44.maxVisibleAltitudeCues || 0));
  maxTrailPoints = Math.max(maxTrailPoints, Number(sample.v44.maxTrailPoints || 0));
  sawUpCue ||= sample.v44.sawUpCue === true;
  sawDownCue ||= sample.v44.sawDownCue === true;
  sawCurvedTrail ||= sample.v44.sawCurvedTrail === true;
  shots = Math.max(shots, Number(sample.weapon?.shotSerial || 0));
  hits = Math.max(hits, Number(sample.weapon?.hitSerial || 0));
  for (const enemy of sample.v43?.enemies || []) maxTacticalPhase = Math.max(maxTacticalPhase, Number(enemy.tacticalPhase || 0));

  const attack = sample.v44.attackRuns;
  if (attack?.cleanup) {
    sawCleanup = true;
    if (Number(attack.orbitingEnemies || 0) > 0) {
      const firstOrbitObservation = !sawOrbit;
      sawOrbit = true;
      const minDistance = Number(attack.minOrbitDistance || 0);
      if (minDistance > 0) minOrbitDistance = Math.min(minOrbitDistance, minDistance);
      maxOrbitDistance = Math.max(maxOrbitDistance, Number(attack.maxOrbitDistance || 0));
      // The director releases slots in game time (5.25 s), while the real-WebGL
      // audit can run slower than wall time under SwiftShader. Once a physical
      // cleanup orbit is actually observed, reserve enough wall time to see the
      // scheduled transition rather than weakening the gameplay cadence.
      if (firstOrbitObservation && !sawAttackRun) {
        deadlineMs = Math.min(HARD_RUN_MS, Math.max(deadlineMs, elapsed + CLEANUP_OBSERVE_MS));
      }
    }
    if (Number(attack.attackingEnemies || 0) > 0 || Number(attack.releasedRuns || 0) > 0) sawAttackRun = true;
    if (!capturedCleanup && sawOrbit) {
      capturedCleanup = true;
      await page.screenshot({ path: `${outputDir}/61-v44-cleanup-attack-runs.png`, fullPage: true });
      await canvas.screenshot({ path: `${outputDir}/61-v44-cleanup-attack-runs-canvas.png` });
    }
  }

  if (!capturedCombat && maxVisibleAltitudeCues >= 1 && maxTrailPoints >= 6 && sawCurvedTrail) {
    capturedCombat = true;
    await page.screenshot({ path: `${outputDir}/60-v44-vertical-readability.png`, fullPage: true });
    await canvas.screenshot({ path: `${outputDir}/60-v44-vertical-readability-canvas.png` });
  }
}
await page.keyboard.up(steering).catch(() => {});
await page.keyboard.up("Space").catch(() => {});

const hud = await page.evaluate(() => {
  const combo = document.querySelector('[class*="combo"]');
  const legend = document.querySelector('.skyDancerV44AltitudeLegend');
  const comboRect = combo instanceof HTMLElement ? combo.getBoundingClientRect() : null;
  const legendRect = legend instanceof HTMLElement ? legend.getBoundingClientRect() : null;
  return {
    comboCenterX: comboRect ? comboRect.left + comboRect.width * 0.5 : null,
    legendVisible: Boolean(legendRect && legendRect.width > 0 && legendRect.height > 0),
  };
});

const diagnostics = {
  maxVisibleAltitudeCues,
  maxTrailPoints,
  sawUpCue,
  sawDownCue,
  sawCurvedTrail,
  sawCleanup,
  sawOrbit,
  sawAttackRun,
  minOrbitDistance: Number.isFinite(minOrbitDistance) ? minOrbitDistance : null,
  maxOrbitDistance,
  maxTacticalPhase,
  shots,
  hits,
  hud,
  consoleErrors,
  pageErrors,
};
await writeFile(`${outputDir}/v44-readability-diagnostics.json`, JSON.stringify(diagnostics, null, 2));
console.log(JSON.stringify(diagnostics, null, 2));
await browser.close();

if (pageErrors.length) throw new Error(`V44 page errors: ${pageErrors.join(" | ")}`);
if (maxVisibleAltitudeCues < 1) throw new Error(`V44 never displayed an altitude cue: ${JSON.stringify(diagnostics)}`);
if (!sawUpCue || !sawDownCue) throw new Error(`V44 did not communicate both vertical directions: ${JSON.stringify(diagnostics)}`);
if (maxTrailPoints < 6 || !sawCurvedTrail) throw new Error(`V44 missile trail never became readable/curved: ${JSON.stringify(diagnostics)}`);
if (maxTacticalPhase < 1) throw new Error(`V44 tactical vertical maneuver phases never advanced: ${JSON.stringify(diagnostics)}`);
if (shots < 3 || hits < 1) throw new Error(`V44 combat sample was too weak: ${JSON.stringify(diagnostics)}`);
if (!hud.legendVisible) throw new Error(`V44 altitude legend is not visible: ${JSON.stringify(diagnostics)}`);
if (hud.comboCenterX != null && hud.comboCenterX > 844 * 0.43) throw new Error(`V44 reward text still occupies screen center: ${JSON.stringify(diagnostics)}`);
// CLEANUP may start near the end depending on combat RNG. If observed, its
// orbit must be physically beyond the 58 m seeker and an attack run must start.
if (sawCleanup && sawOrbit && minOrbitDistance < 58.5) throw new Error(`V44 cleanup orbit entered lock range before release: ${JSON.stringify(diagnostics)}`);
if (sawCleanup && sawOrbit && !sawAttackRun) throw new Error(`V44 cleanup orbit never transitioned to an attack run: ${JSON.stringify(diagnostics)}`);
