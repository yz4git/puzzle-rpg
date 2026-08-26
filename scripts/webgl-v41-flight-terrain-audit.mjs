import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.SKY_DANCER_AUDIT_URL || "http://127.0.0.1:4173";
const outputDir = process.env.SKY_DANCER_AUDIT_DIR || "artifacts/webgl-audit";
const SAMPLE_MS = 140;
const RUN_MS = 150_000;

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
await page.waitForTimeout(1_200);
await page.screenshot({ path: `${outputDir}/40-v41-natural-opening.png`, fullPage: true });
await canvas.screenshot({ path: `${outputDir}/40-v41-natural-opening-canvas.png` });

let minEnemyDistance = Number.POSITIVE_INFINITY;
let maxStepSpeed = 0;
let maxTurnRate = 0;
let maxConstrainedEnemies = 0;
let emergencyBreakawayFrames = 0;
let minReliefSpan = Number.POSITIVE_INFINITY;
let maxReliefSpan = 0;
let minVisibleTiles = Number.POSITIVE_INFINITY;
let legacyTerrainEverVisible = false;
let aircraftAttachmentFailures = 0;
let cityAnchorMoved = false;
let initialV36City = null;
let initialV40City = null;
const terrainCenters = new Set();
const samples = [];
const began = Date.now();
let capturedTravel = false;
let capturedBank = false;
let bankLeftDown = false;
let turboReleaseCount = 0;
let nextTurboAt = 8;

const moved = (initial, current) => initial && current
  ? Math.hypot(Number(current.x) - Number(initial.x), Number(current.z) - Number(initial.z)) > 0.01
  : false;

while (Date.now() - began < RUN_MS) {
  await page.waitForTimeout(SAMPLE_MS);
  const sample = await page.evaluate(() => ({
    motion: typeof window.__skyDancerGetNaturalMotionV41 === "function" ? window.__skyDancerGetNaturalMotionV41() : null,
    terrain: typeof window.__skyDancerGetTerrainContinuityV41 === "function" ? window.__skyDancerGetTerrainContinuityV41() : null,
    flight: typeof window.__skyDancerGetFlightDebug === "function" ? window.__skyDancerGetFlightDebug() : null,
    attachment: typeof window.__skyDancerGetV42AircraftAttachment === "function" ? window.__skyDancerGetV42AircraftAttachment() : null,
    v36World: typeof window.__skyDancerGetV36WorldDebug === "function" ? window.__skyDancerGetV36WorldDebug() : null,
    v40City: typeof window.__skyDancerGetV40CityDebug === "function" ? window.__skyDancerGetV40CityDebug() : null,
  }));
  const elapsed = (Date.now() - began) / 1000;

  if (elapsed >= 16 && elapsed < 20 && !bankLeftDown) {
    await page.keyboard.down("ArrowLeft");
    bankLeftDown = true;
  }
  if (elapsed >= 20 && bankLeftDown) {
    await page.keyboard.up("ArrowLeft");
    bankLeftDown = false;
  }
  if (!capturedBank && elapsed >= 18.2) {
    capturedBank = true;
    await page.screenshot({ path: `${outputDir}/40b-v42-banked-airframe.png`, fullPage: true });
    await canvas.screenshot({ path: `${outputDir}/40b-v42-banked-airframe-canvas.png` });
  }

  if (elapsed >= nextTurboAt && turboReleaseCount < 5) {
    await page.keyboard.down("Space");
    await page.waitForTimeout(650);
    await page.keyboard.up("Space");
    turboReleaseCount += 1;
    nextTurboAt += 28;
  }
  if (!sample.motion || !sample.terrain) continue;
  if (elapsed > 2) minEnemyDistance = Math.min(minEnemyDistance, Number(sample.motion.minEnemyDistance || Number.POSITIVE_INFINITY));
  maxStepSpeed = Math.max(maxStepSpeed, Number(sample.motion.maxStepSpeed || 0));
  maxTurnRate = Math.max(maxTurnRate, Number(sample.motion.maxTurnRate || 0));
  maxConstrainedEnemies = Math.max(maxConstrainedEnemies, Number(sample.motion.constrainedEnemies || 0));
  if (Number(sample.motion.emergencyBreakaways || 0) > 0) emergencyBreakawayFrames += 1;
  minReliefSpan = Math.min(minReliefSpan, Number(sample.terrain.reliefSpan || 0));
  maxReliefSpan = Math.max(maxReliefSpan, Number(sample.terrain.reliefSpan || 0));
  minVisibleTiles = Math.min(minVisibleTiles, Number(sample.terrain.visibleTiles || 0));
  legacyTerrainEverVisible ||= sample.terrain.legacyTerrainHidden !== true;
  terrainCenters.add(`${sample.terrain.centerTileX}:${sample.terrain.centerTileZ}`);

  if (sample.attachment && (sample.attachment.playerKitParentIsPlayerVisual !== true || sample.attachment.speedLinesParentIsPlayerVisual !== true)) {
    aircraftAttachmentFailures += 1;
  }
  if (sample.v36World?.cityRootPosition) {
    initialV36City ??= { ...sample.v36World.cityRootPosition };
    cityAnchorMoved ||= moved(initialV36City, sample.v36World.cityRootPosition);
  }
  if (sample.v40City?.rootPosition) {
    initialV40City ??= { ...sample.v40City.rootPosition };
    cityAnchorMoved ||= moved(initialV40City, sample.v40City.rootPosition);
  }

  if (samples.length < 160 && (samples.length === 0 || elapsed - samples[samples.length - 1].elapsed > 0.28)) {
    samples.push({ elapsed: Number(elapsed.toFixed(2)), ...sample });
  }
  if (!capturedTravel && terrainCenters.size >= 2) {
    capturedTravel = true;
    await page.screenshot({ path: `${outputDir}/41-v41-terrain-transition.png`, fullPage: true });
    await canvas.screenshot({ path: `${outputDir}/41-v41-terrain-transition-canvas.png` });
  }
}
if (bankLeftDown) await page.keyboard.up("ArrowLeft");

await page.screenshot({ path: `${outputDir}/42-v41-natural-final.png`, fullPage: true });
await canvas.screenshot({ path: `${outputDir}/42-v41-natural-final-canvas.png` });
const diagnostics = {
  minEnemyDistance: Number.isFinite(minEnemyDistance) ? minEnemyDistance : null,
  maxStepSpeed,
  maxTurnRate,
  maxConstrainedEnemies,
  emergencyBreakawayFrames,
  turboReleaseCount,
  minReliefSpan: Number.isFinite(minReliefSpan) ? minReliefSpan : null,
  maxReliefSpan,
  minVisibleTiles: Number.isFinite(minVisibleTiles) ? minVisibleTiles : null,
  terrainCenterCount: terrainCenters.size,
  terrainCenters: [...terrainCenters],
  legacyTerrainEverVisible,
  aircraftAttachmentFailures,
  cityAnchorMoved,
  initialV36City,
  initialV40City,
  consoleErrors,
  pageErrors,
  samples,
};
await writeFile(`${outputDir}/v41-flight-terrain-diagnostics.json`, JSON.stringify(diagnostics, null, 2));
await browser.close();

if (pageErrors.length) throw new Error(`Page errors during V41/V42 playcheck: ${pageErrors.join(" | ")}`);
if (minEnemyDistance < 11.5) throw new Error(`V41 enemy pass came too close to the player: ${JSON.stringify(diagnostics)}`);
if (maxStepSpeed > 40.2) throw new Error(`V41 enemy escape speed exceeded aircraft cap: ${JSON.stringify(diagnostics)}`);
if (maxTurnRate > 1.67) throw new Error(`V41 enemy turn rate exceeded aircraft cap: ${JSON.stringify(diagnostics)}`);
if (maxConstrainedEnemies < 1) throw new Error(`V41 natural-motion guard never constrained inherited corrections: ${JSON.stringify(diagnostics)}`);
if (minVisibleTiles < 25) throw new Error(`V41 terrain ring lost visible tiles: ${JSON.stringify(diagnostics)}`);
if (minReliefSpan < 4.0) throw new Error(`V41 terrain relief collapsed: ${JSON.stringify(diagnostics)}`);
if (terrainCenters.size < 2) throw new Error(`V41 playcheck did not cross a terrain tile boundary: ${JSON.stringify(diagnostics)}`);
if (legacyTerrainEverVisible) throw new Error(`V36 snapping terrain reappeared during V41 playcheck: ${JSON.stringify(diagnostics)}`);
if (aircraftAttachmentFailures > 0) throw new Error(`V42 player surface kit detached from banked player visual: ${JSON.stringify(diagnostics)}`);
if (!initialV36City || !initialV40City) throw new Error(`V42 ground-scenery debug was unavailable: ${JSON.stringify(diagnostics)}`);
if (cityAnchorMoved) throw new Error(`V42 city scenery jumped during a terrain tile transition: ${JSON.stringify(diagnostics)}`);
