import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.SKY_DANCER_AUDIT_URL || "http://127.0.0.1:4173";
const outputDir = process.env.SKY_DANCER_AUDIT_DIR || "artifacts/webgl-audit";
const MAX_WALL_MS = 480_000;
const SAMPLE_MS = 420;
const CLEANUP_TARGET_SECONDS = [20, 30];
const CLEANUP_ACCEPT_SECONDS = [18, 32];

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
const stageHud = page.getByLabel("Sky Dancer stage status");
await stageHud.waitFor({ state: "visible", timeout: 10_000 });
await page.waitForTimeout(1_200);

const openingPresentation = await page.evaluate(() => {
  const city = typeof window.__skyDancerGetV40CityDebug === "function" ? window.__skyDancerGetV40CityDebug() : null;
  const gunsight = document.querySelector(".skyDancerGunsight");
  const style = gunsight ? getComputedStyle(gunsight) : null;
  return {
    city,
    gunsight: style ? { width: parseFloat(style.width), height: parseFloat(style.height), opacity: parseFloat(style.opacity) } : null,
  };
});
if (!openingPresentation.city || openingPresentation.city.sectorCount !== 3 || openingPresentation.city.totalBuildings < 150) {
  throw new Error(`V40 multi-direction city did not initialize: ${JSON.stringify(openingPresentation.city)}`);
}
if (!openingPresentation.gunsight || openingPresentation.gunsight.width > 42 || openingPresentation.gunsight.height > 42) {
  throw new Error(`V40 gunsight reduction did not apply: ${JSON.stringify(openingPresentation.gunsight)}`);
}
if (Math.abs(Number(openingPresentation.city.burstLinearScale) - 0.55) > 0.001) {
  throw new Error(`V40 dynamic combat-ring reduction did not initialize: ${JSON.stringify(openingPresentation.city)}`);
}
if (openingPresentation.city.airBurstScale != null && Number(openingPresentation.city.airBurstScale) > 0.33) {
  throw new Error(`V40 air-burst ring remained oversized: ${JSON.stringify(openingPresentation.city)}`);
}

await page.screenshot({ path: `${outputDir}/30-v40-opening.png`, fullPage: true });
await canvas.screenshot({ path: `${outputDir}/30-v40-opening-canvas.png` });

const timeline = [];
const phaseScreens = new Set();
let lastPhaseKey = "";
let lastHitSerial = 0;
let firstHitSeconds = null;
let cleanupWallSeconds = null;
let bossWallSeconds = null;
let clearWallSeconds = null;
let stage2WallSeconds = null;
let cleanupGameSeconds = 0;
let cleanupScheduledEnemies = 0;
let cleanupMaxDistance = 0;
let cleanupCorrectionFrames = 0;
let cleanupMaxLockAngle = 0;
let cleanupPeakLockCandidates = 0;
let bossDuplicateVisible = false;
let bossLegacyBlocksVisible = 0;
let turboReleases = 0;
let steeringDirection = "ArrowRight";
let nextSteerSwitch = 4_800;
let nextTurboAt = 5_600;
let turboHeld = false;
let turboReleaseAt = 0;
const began = Date.now();

await page.keyboard.down(steeringDirection);

async function captureOnce(key, filename) {
  if (phaseScreens.has(key)) return;
  phaseScreens.add(key);
  await page.screenshot({ path: `${outputDir}/${filename}.png`, fullPage: true });
  await canvas.screenshot({ path: `${outputDir}/${filename}-canvas.png` });
}

async function readState() {
  const hudText = (await stageHud.innerText()).replace(/\s+/g, " ").trim();
  const weapon = await page.evaluate(() => typeof window.__skyDancerGetWeaponState === "function" ? window.__skyDancerGetWeaponState() : null);
  const flight = await page.evaluate(() => typeof window.__skyDancerGetFlightDebug === "function" ? window.__skyDancerGetFlightDebug() : null);
  const reengagement = await page.evaluate(() => typeof window.__skyDancerGetReengagementV40 === "function" ? window.__skyDancerGetReengagementV40() : null);
  const boss = await page.evaluate(() => typeof window.__skyDancerGetBossQualityV34 === "function" ? window.__skyDancerGetBossQualityV34() : null);
  const presentation = await page.evaluate(() => typeof window.__skyDancerGetV40CityDebug === "function" ? window.__skyDancerGetV40CityDebug() : null);
  return { hudText, weapon, flight, reengagement, boss, presentation };
}

async function countVisibleLegacyBossBlocks() {
  return page.evaluate(() => {
    const nodes = document.querySelectorAll('[class*="bossMeter"], [class*="bossPhase"]');
    let visible = 0;
    for (const node of nodes) {
      if (!(node instanceof HTMLElement)) continue;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      if (style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0.02 && rect.width > 0 && rect.height > 0) visible += 1;
    }
    return visible;
  });
}

while (Date.now() - began < MAX_WALL_MS && stage2WallSeconds == null) {
  const elapsed = Date.now() - began;
  if (elapsed >= nextSteerSwitch) {
    await page.keyboard.up(steeringDirection);
    steeringDirection = steeringDirection === "ArrowRight" ? "ArrowLeft" : "ArrowRight";
    await page.keyboard.down(steeringDirection);
    nextSteerSwitch += 4_800;
  }
  if (!turboHeld && elapsed >= nextTurboAt) {
    await page.keyboard.down("Space");
    turboHeld = true;
    turboReleaseAt = elapsed + 720;
  }
  if (turboHeld && elapsed >= turboReleaseAt) {
    await page.keyboard.up("Space");
    turboHeld = false;
    turboReleases += 1;
    nextTurboAt = elapsed + 5_600;
  }

  const box = await shot.boundingBox();
  if (box) await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.waitForTimeout(SAMPLE_MS);

  const state = await readState();
  const wallSeconds = Number(((Date.now() - began) / 1000).toFixed(2));
  const hits = Number(state.weapon?.hitSerial ?? 0);
  const shots = Number(state.weapon?.shotSerial ?? 0);
  if (firstHitSeconds == null && hits > 0) firstHitSeconds = wallSeconds;

  const isCleanup = /STAGE 1.*CLEANUP/i.test(state.hudText);
  const isBoss = /STAGE 1.*BOSS/i.test(state.hudText);
  const isClear = /STAGE 1.*CLEAR/i.test(state.hudText);
  const isStage2 = /STAGE 2.*WAVE/i.test(state.hudText);

  if (isCleanup) {
    if (cleanupWallSeconds == null) {
      cleanupWallSeconds = wallSeconds;
      await captureOnce("cleanup", "31-v40-cleanup");
    }
    cleanupGameSeconds = Math.max(cleanupGameSeconds, Number(state.reengagement?.cleanupElapsed ?? 0));
    cleanupScheduledEnemies = Math.max(cleanupScheduledEnemies, Number(state.reengagement?.cleanupScheduledEnemies ?? 0));
    cleanupMaxDistance = Math.max(cleanupMaxDistance, Number(state.reengagement?.maxEnemyDistance ?? 0));
    cleanupMaxLockAngle = Math.max(cleanupMaxLockAngle, Number(state.reengagement?.maxLockAngle ?? 0));
    cleanupPeakLockCandidates = Math.max(cleanupPeakLockCandidates, Number(state.reengagement?.lockConeCandidates ?? 0));
    if (Number(state.reengagement?.correctedEnemies ?? 0) > 0) cleanupCorrectionFrames += 1;
  }
  if (isBoss && bossWallSeconds == null) {
    bossWallSeconds = wallSeconds;
    cleanupGameSeconds = Math.max(cleanupGameSeconds, Number(state.reengagement?.lastCleanupDuration ?? 0));
    const oldBossChip = page.getByLabel("Boss phase status");
    const oldBossChipVisible = await oldBossChip.isVisible().catch(() => false);
    bossLegacyBlocksVisible = await countVisibleLegacyBossBlocks();
    bossDuplicateVisible = oldBossChipVisible || bossLegacyBlocksVisible > 0;
    await captureOnce("boss", "32-v40-boss");
  }
  if (isClear && clearWallSeconds == null) {
    clearWallSeconds = wallSeconds;
    await captureOnce("clear", "33-v40-clear");
  }
  if (isStage2 && stage2WallSeconds == null) {
    stage2WallSeconds = wallSeconds;
    await captureOnce("stage2", "34-v40-stage2");
  }

  const phaseKey = `${state.hudText}|${hits}`;
  if (phaseKey !== lastPhaseKey) {
    timeline.push({
      wallSeconds,
      hudText: state.hudText,
      shotSerial: shots,
      hitSerial: hits,
      hitDelta: hits - lastHitSerial,
      reengagement: state.reengagement,
      boss: state.boss,
      altitudeMeters: state.flight?.altitudeMeters ?? null,
      forwardVelocity: state.flight?.forwardVelocity ?? null,
      minEnemyDistance: state.flight?.minEnemyDistance ?? null,
      airBurstScale: state.presentation?.airBurstScale ?? null,
    });
    lastPhaseKey = phaseKey;
    lastHitSerial = hits;
  }
}

await page.keyboard.up(steeringDirection).catch(() => {});
if (turboHeld) await page.keyboard.up("Space").catch(() => {});
const final = await readState();
const shots = Number(final.weapon?.shotSerial ?? 0);
const hits = Number(final.weapon?.hitSerial ?? 0);
const cleanupWallDurationSeconds = cleanupWallSeconds != null && bossWallSeconds != null
  ? Number((bossWallSeconds - cleanupWallSeconds).toFixed(2))
  : null;
cleanupGameSeconds = Math.max(cleanupGameSeconds, Number(final.reengagement?.lastCleanupDuration ?? 0));
cleanupGameSeconds = Number(cleanupGameSeconds.toFixed(2));
const diagnostics = {
  completed: stage2WallSeconds != null,
  wallSeconds: Number(((Date.now() - began) / 1000).toFixed(2)),
  firstHitSeconds,
  cleanupWallSeconds,
  bossWallSeconds,
  clearWallSeconds,
  stage2WallSeconds,
  cleanupWallDurationSeconds,
  cleanupGameSeconds,
  cleanupTargetWindowSeconds: CLEANUP_TARGET_SECONDS,
  cleanupAcceptanceWindowSeconds: CLEANUP_ACCEPT_SECONDS,
  cleanupScheduledEnemies,
  cleanupMaxDistance,
  cleanupMaxLockAngle,
  cleanupPeakLockCandidates,
  cleanupCorrectionFrames,
  bossDuplicateVisible,
  bossLegacyBlocksVisible,
  shots,
  hits,
  hitRate: shots > 0 ? Number((hits / shots).toFixed(3)) : 0,
  turboReleases,
  openingPresentation,
  finalPresentation: final.presentation,
  finalHudText: final.hudText,
  finalFlight: final.flight,
  consoleErrors,
  pageErrors,
  timeline,
};
await writeFile(`${outputDir}/v40-quality-diagnostics.json`, JSON.stringify(diagnostics, null, 2));
await page.screenshot({ path: `${outputDir}/35-v40-final.png`, fullPage: true });
await canvas.screenshot({ path: `${outputDir}/35-v40-final-canvas.png` });
await browser.close();

if (pageErrors.length) throw new Error(`Page errors during V40 playcheck: ${pageErrors.join(" | ")}`);
if (cleanupWallSeconds == null) throw new Error(`V40 playcheck never entered CLEANUP: ${JSON.stringify(diagnostics)}`);
if (bossWallSeconds == null) throw new Error(`V40 playcheck never reached BOSS: ${JSON.stringify(diagnostics)}`);
if (cleanupGameSeconds < CLEANUP_ACCEPT_SECONDS[0] || cleanupGameSeconds > CLEANUP_ACCEPT_SECONDS[1]) {
  throw new Error(`V40 cleanup gameplay time missed the 20-30s target: ${JSON.stringify(diagnostics)}`);
}
if (cleanupMaxDistance > 58.5) throw new Error(`V40 cleanup enemy escaped the missile-lock envelope: ${JSON.stringify(diagnostics)}`);
if (cleanupPeakLockCandidates < 1) throw new Error(`V40 cleanup never presented a lock-cone target: ${JSON.stringify(diagnostics)}`);
if (bossDuplicateVisible) throw new Error(`Legacy boss HUD remained visible during V40 boss HUD: ${JSON.stringify(diagnostics)}`);
if (clearWallSeconds == null || stage2WallSeconds == null) throw new Error(`V40 playcheck did not show CLEAR then STAGE 2: ${JSON.stringify(diagnostics)}`);
