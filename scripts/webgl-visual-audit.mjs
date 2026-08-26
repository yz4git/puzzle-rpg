import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.SKY_DANCER_AUDIT_URL || "http://127.0.0.1:4173";
const outputDir = process.env.SKY_DANCER_AUDIT_DIR || "artifacts/webgl-audit";
const EXPECTED_ALTITUDE_METERS = 300;
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-angle=swiftshader",
    "--enable-webgl",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--disable-dev-shm-usage",
  ],
});

const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
page.on("pageerror", (error) => pageErrors.push(String(error)));

await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60_000 });
await page.screenshot({ path: `${outputDir}/00-startup.png`, fullPage: true });
const start = page.getByRole("button", { name: /START(?: HARD)? RUN/i });
if (await start.isVisible().catch(() => false)) await start.click();

const webglCanvas = page.locator('canvas[aria-label="Sky Dancer WebGL game view"]');
try {
  await webglCanvas.waitFor({ state: "visible", timeout: 30_000 });
} catch (error) {
  const diagnostics = await page.evaluate(() => ({
    bodyText: document.body.innerText.slice(0, 2400),
    canvases: Array.from(document.querySelectorAll("canvas")).map((canvas) => ({
      ariaLabel: canvas.getAttribute("aria-label"), width: canvas.width, height: canvas.height, display: getComputedStyle(canvas).display,
    })),
  })).catch(() => ({ bodyText: "", canvases: [] }));
  const failure = { error: String(error), consoleErrors, pageErrors, diagnostics };
  await writeFile(`${outputDir}/00-startup-failure.json`, JSON.stringify(failure, null, 2));
  throw new Error(`WebGL canvas unavailable: ${JSON.stringify(failure)}`, { cause: error });
}
const shot = page.getByRole("button", { name: "Fire missile" });
await shot.waitFor({ state: "visible", timeout: 10_000 });
await page.waitForTimeout(1_600);

const webgl = await webglCanvas.evaluate((canvas) => {
  const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
  if (!gl) return { ok: false };
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  return {
    ok: true, width: canvas.width, height: canvas.height, clientWidth: canvas.clientWidth, clientHeight: canvas.clientHeight,
    vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
  };
});
if (!webgl.ok) throw new Error("WebGL context was not created");

const controlState = await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll("button"));
  const brakeButtons = buttons.filter((button) => button.textContent?.trim() === "BRAKE");
  const visibleBrakeButtons = brakeButtons.filter((button) => getComputedStyle(button).display !== "none");
  const shotButton = buttons.find((button) => button.getAttribute("aria-label") === "Fire missile");
  const gasCards = Array.from(document.querySelectorAll('[data-sd-gas-card="true"]'));
  const itemStrips = Array.from(document.querySelectorAll('[data-sd-item-strip="true"]'));
  const huntModeCards = Array.from(document.querySelectorAll('[data-sd-hunt-mode="true"]'));
  const turboButtons = Array.from(document.querySelectorAll('[data-sd-turbo-button="true"]'));
  return {
    shotVisible: Boolean(shotButton && getComputedStyle(shotButton).display !== "none"),
    brakeCount: brakeButtons.length,
    visibleBrakeCount: visibleBrakeButtons.length,
    directFireAvailable: typeof window.__skyDancerFireMissile === "function",
    v30Hud: {
      gasCardCount: gasCards.length,
      itemStripCount: itemStrips.length,
      itemStripHidden: itemStrips.length > 0 && itemStrips.every((element) => getComputedStyle(element).display === "none"),
      huntModeCount: huntModeCards.length,
      huntModeHidden: huntModeCards.length > 0 && huntModeCards.every((element) => getComputedStyle(element).display === "none"),
      turboButtonCount: turboButtons.length,
    },
  };
});
if (!controlState.shotVisible || controlState.visibleBrakeCount !== 0 || !controlState.directFireAvailable) {
  throw new Error(`Control replacement failed: ${JSON.stringify(controlState)}`);
}
if (
  controlState.v30Hud.gasCardCount < 1
  || controlState.v30Hud.itemStripCount < 1
  || !controlState.v30Hud.itemStripHidden
  || controlState.v30Hud.huntModeCount < 1
  || !controlState.v30Hud.huntModeHidden
  || controlState.v30Hud.turboButtonCount < 1
) {
  throw new Error(`V30 HUD consolidation did not reach the static runtime: ${JSON.stringify(controlState.v30Hud)}`);
}

const openingFlight = await page.evaluate(() => typeof window.__skyDancerGetFlightDebug === "function" ? window.__skyDancerGetFlightDebug() : null);
const v31World = await page.evaluate(() => typeof window.__skyDancerGetV31WorldDebug === "function" ? window.__skyDancerGetV31WorldDebug() : null);
if (!openingFlight) throw new Error("Flight telemetry unavailable at opening");
if (Math.abs(Number(openingFlight.altitudeMeters) - EXPECTED_ALTITUDE_METERS) > 0.6) throw new Error(`Unexpected flight level: ${JSON.stringify(openingFlight)}`);

await page.screenshot({ path: `${outputDir}/01-gameplay-start.png`, fullPage: true });
await webglCanvas.screenshot({ path: `${outputDir}/01-gameplay-start-canvas.png` });

// Primary regression #1: real touch firing must create flight or an immediate hit.
const weaponBefore = await page.evaluate(() => typeof window.__skyDancerGetWeaponState === "function" ? window.__skyDancerGetWeaponState() : null);
const shotBox = await shot.boundingBox();
if (!shotBox) throw new Error("Shot button has no touchable bounds");
await page.touchscreen.tap(shotBox.x + shotBox.width * 0.5, shotBox.y + shotBox.height * 0.5);
const weaponImmediatelyAfter = await page.evaluate(() => typeof window.__skyDancerGetWeaponState === "function" ? window.__skyDancerGetWeaponState() : null);
const shotRegistered = Boolean(weaponBefore && weaponImmediatelyAfter && weaponImmediatelyAfter.shotSerial > weaponBefore.shotSerial);
const immediateHit = Boolean(weaponBefore && weaponImmediatelyAfter && weaponImmediatelyAfter.hitSerial > weaponBefore.hitSerial);
const launched = Array.isArray(weaponImmediatelyAfter?.missiles) ? (weaponImmediatelyAfter.missiles[0] ?? null) : null;
if (!shotRegistered || (!launched && !immediateHit)) {
  throw new Error(`Touch Shot produced neither missile flight nor an immediate hit: before=${JSON.stringify(weaponBefore)} after=${JSON.stringify(weaponImmediatelyAfter)}`);
}

await page.waitForTimeout(80);
await page.screenshot({ path: `${outputDir}/02-player-shot.png`, fullPage: true });
await webglCanvas.screenshot({ path: `${outputDir}/02-player-shot-canvas.png` });
await page.waitForTimeout(40);
const weaponAfter120 = await page.evaluate(() => typeof window.__skyDancerGetWeaponState === "function" ? window.__skyDancerGetWeaponState() : null);
if (!weaponAfter120) throw new Error("Weapon telemetry disappeared after launch");
const sameMissile120 = launched && Array.isArray(weaponAfter120.missiles) ? weaponAfter120.missiles.find((missile) => missile.id === launched.id) : null;
const missileTravel120 = sameMissile120 && launched ? Math.hypot(sameMissile120.x - launched.x, sameMissile120.z - launched.z) : null;
const moved120 = launched
  ? (sameMissile120 ? missileTravel120 > 0.2 || sameMissile120.life < launched.life - 0.02 : weaponAfter120.hitSerial > weaponImmediatelyAfter.hitSerial)
  : immediateHit;
if (!moved120) throw new Error(`Player missile did not advance or hit: launch=${JSON.stringify(launched)} after=${JSON.stringify(weaponAfter120)}`);

await page.waitForTimeout(180);
const weaponAfter300 = await page.evaluate(() => typeof window.__skyDancerGetWeaponState === "function" ? window.__skyDancerGetWeaponState() : null);
const sameMissile300 = launched && Array.isArray(weaponAfter300?.missiles) ? weaponAfter300.missiles.find((missile) => missile.id === launched.id) : null;
const missileTravel300 = sameMissile300 && launched ? Math.hypot(sameMissile300.x - launched.x, sameMissile300.z - launched.z) : null;
const advancedMeaningfully = launched
  ? (sameMissile300 ? missileTravel300 > 1 || sameMissile300.life < launched.life - 0.08 : (weaponAfter300?.hitSerial ?? 0) > weaponImmediatelyAfter.hitSerial)
  : immediateHit;
if (!advancedMeaningfully) throw new Error(`Player missile did not achieve visible flight or an immediate hit: launch=${JSON.stringify(launched)} after300=${JSON.stringify(weaponAfter300)}`);

await page.keyboard.down("ArrowRight");
await page.waitForTimeout(1_350);
const turnFlight = await page.evaluate(() => typeof window.__skyDancerGetFlightDebug === "function" ? window.__skyDancerGetFlightDebug() : null);
await page.screenshot({ path: `${outputDir}/03-banked-turn.png`, fullPage: true });
await webglCanvas.screenshot({ path: `${outputDir}/03-banked-turn-canvas.png` });
await page.keyboard.up("ArrowRight");
await page.waitForTimeout(320);

// Primary regression #2: Turbo hold is neutral; release owns the acceleration.
const turboBefore = await page.evaluate(() => typeof window.__skyDancerGetFlightDebug === "function" ? window.__skyDancerGetFlightDebug() : null);
await page.keyboard.down("Space");
await page.waitForTimeout(850);
const turboDuring = await page.evaluate(() => typeof window.__skyDancerGetFlightDebug === "function" ? window.__skyDancerGetFlightDebug() : null);
if (!turboBefore || !turboDuring) throw new Error(`Turbo telemetry unavailable: before=${JSON.stringify(turboBefore)} during=${JSON.stringify(turboDuring)}`);
const beforeForward = Math.abs(Number(turboBefore.forwardVelocity) || 0);
const duringForward = Math.abs(Number(turboDuring.forwardVelocity) || 0);
if (beforeForward > 3 && duringForward < beforeForward * 0.96) {
  throw new Error(`Turbo hold still decelerated the aircraft: before=${beforeForward.toFixed(3)} during=${duringForward.toFixed(3)}`);
}
await page.waitForTimeout(200);
await page.screenshot({ path: `${outputDir}/04-turbo-hold.png`, fullPage: true });
await webglCanvas.screenshot({ path: `${outputDir}/04-turbo-hold-canvas.png` });
await page.keyboard.up("Space");
await page.waitForTimeout(180);
const turboAfterRelease = await page.evaluate(() => typeof window.__skyDancerGetFlightDebug === "function" ? window.__skyDancerGetFlightDebug() : null);
if (!turboAfterRelease) throw new Error("Turbo telemetry disappeared after release");
const releasedForward = Math.abs(Number(turboAfterRelease.forwardVelocity) || 0);
if (duringForward > 3 && releasedForward < duringForward + 1.2) {
  throw new Error(`Turbo release dash did not restore its acceleration: during=${duringForward.toFixed(3)} release=${releasedForward.toFixed(3)}`);
}
await page.screenshot({ path: `${outputDir}/05-turbo-release.png`, fullPage: true });
await webglCanvas.screenshot({ path: `${outputDir}/05-turbo-release-canvas.png` });

// Secondary opening spacing remains below the primary Shot/Turbo regressions.
if (openingFlight.minEnemyDistance != null && Number(openingFlight.minEnemyDistance) < 13.5) {
  throw new Error(`Opening fighter spawned too close: ${JSON.stringify(openingFlight)}`);
}

await page.keyboard.down("ArrowLeft");
await page.waitForTimeout(900);
await page.keyboard.up("ArrowLeft");
await page.waitForTimeout(3_000);

const combatWeaponBefore = await page.evaluate(() => typeof window.__skyDancerGetWeaponState === "function" ? window.__skyDancerGetWeaponState() : null);
for (let index = 0; index < 5; index += 1) {
  const combatBox = await shot.boundingBox();
  if (combatBox) await page.touchscreen.tap(combatBox.x + combatBox.width * 0.5, combatBox.y + combatBox.height * 0.5);
  await page.waitForTimeout(390);
}
await page.waitForTimeout(2_400);
const combatWeaponAfter = await page.evaluate(() => typeof window.__skyDancerGetWeaponState === "function" ? window.__skyDancerGetWeaponState() : null);
const combatFlight = await page.evaluate(() => typeof window.__skyDancerGetFlightDebug === "function" ? window.__skyDancerGetFlightDebug() : null);
const warningVisible = await page.getByLabel("Missile warning").isVisible().catch(() => false);
await page.screenshot({ path: `${outputDir}/06-combat.png`, fullPage: true });
await webglCanvas.screenshot({ path: `${outputDir}/06-combat-canvas.png` });

const text = await page.locator("body").innerText();
const legacyTerms = ["WALL RIDE", "TURBO RAM", "HOLD DRIFT · RELEASE DASH"];
const legacyVisible = legacyTerms.filter((term) => text.includes(term));
if (legacyVisible.length) throw new Error(`Legacy vehicle HUD text still visible: ${legacyVisible.join(", ")}`);

const diagnostics = {
  capturedAt: new Date().toISOString(), url: page.url(), viewport: page.viewportSize(), webgl, controlState,
  openingFlight, v31World, weaponBefore, weaponImmediatelyAfter, immediateHit, weaponAfter120, weaponAfter300,
  missileTravel120, missileTravel300,
  turnFlight, turboBefore, turboDuring, turboAfterRelease,
  combatWeaponBefore, combatWeaponAfter, combatFlight,
  warningVisible, legacyVisible,
  bodyTextSample: text.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 120), consoleErrors, pageErrors,
};
await writeFile(`${outputDir}/diagnostics.json`, JSON.stringify(diagnostics, null, 2));
if (pageErrors.length) throw new Error(`Page errors during WebGL audit: ${pageErrors.join(" | ")}`);
await browser.close();
