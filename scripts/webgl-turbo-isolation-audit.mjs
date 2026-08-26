import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.SKY_DANCER_AUDIT_URL || "http://127.0.0.1:4173";
const outputDir = process.env.SKY_DANCER_AUDIT_DIR || "artifacts/webgl-audit";
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

const flight = async () => page.evaluate(() => typeof window.__skyDancerGetFlightDebug === "function" ? window.__skyDancerGetFlightDebug() : null);
const turbo = async () => page.evaluate(() => typeof window.__skyDancerGetTurboState === "function" ? window.__skyDancerGetTurboState() : null);

// Start the check only after the aircraft has reached a representative cruise
// speed. A fresh second browser begins from 0, which is not a useful Turbo-hold
// regression state and can make an absolute-speed assertion meaningless.
let before = null;
for (let attempt = 0; attempt < 24; attempt += 1) {
  await page.waitForTimeout(300);
  before = await flight();
  if (before && Math.abs(Number(before.forwardVelocity) || 0) >= 12) break;
}
if (!before || Math.abs(Number(before.forwardVelocity) || 0) < 12) {
  throw new Error(`Aircraft never reached cruise speed before Turbo check: ${JSON.stringify(before)}`);
}

await page.keyboard.down("Space");
await page.waitForTimeout(920);
const during = await flight();
const turboDuring = await turbo();
if (!during || !turboDuring) throw new Error(`Turbo isolation telemetry unavailable: flight=${JSON.stringify(during)} turbo=${JSON.stringify(turboDuring)}`);
if (turboDuring.held !== true || Number(turboDuring.charge) < 0.98) {
  throw new Error(`Turbo hold did not remain in the isolated charge model: ${JSON.stringify(turboDuring)}`);
}

const beforeForward = Math.abs(Number(before.forwardVelocity) || 0);
const duringForward = Math.abs(Number(during.forwardVelocity) || 0);
if (duringForward < 10) {
  throw new Error(`Turbo hold left aircraft effectively stopped: before=${beforeForward.toFixed(3)} during=${duringForward.toFixed(3)}`);
}
if (duringForward < beforeForward * 0.88) {
  throw new Error(`Turbo hold lost too much normal flight speed: before=${beforeForward.toFixed(3)} during=${duringForward.toFixed(3)}`);
}

const beforeX = Number(before.x);
const beforeZ = Number(before.z);
const duringX = Number(during.x);
const duringZ = Number(during.z);
const holdTravel = [beforeX, beforeZ, duringX, duringZ].every(Number.isFinite)
  ? Math.hypot(duringX - beforeX, duringZ - beforeZ)
  : Number.NaN;
// SwiftShader can advance only a few requestAnimationFrame ticks during this
// wall-clock window once the scene is heavy. Require positive world movement,
// but let the velocity assertions above carry the stronger no-freeze signal.
if (!Number.isFinite(holdTravel) || holdTravel < 0.25) {
  throw new Error(`Turbo hold did not move through world space: travel=${holdTravel} before=${JSON.stringify(before)} during=${JSON.stringify(during)}`);
}

await canvas.screenshot({ path: `${outputDir}/07-v30-turbo-isolated-hold.png` });
await page.keyboard.up("Space");
await page.waitForTimeout(40);
const turboReleaseImmediate = await turbo();
const releaseImmediateFlight = await flight();
if (!turboReleaseImmediate || !releaseImmediateFlight) throw new Error("Turbo release telemetry unavailable");
if (turboReleaseImmediate.held !== false || Number(turboReleaseImmediate.releaseSerial) < 1) {
  throw new Error(`Turbo release was not registered by isolated model: ${JSON.stringify(turboReleaseImmediate)}`);
}
const modelKick = Number(turboReleaseImmediate.postReleaseForwardSpeed) - Number(turboReleaseImmediate.preReleaseForwardSpeed);
if (!Number.isFinite(modelKick) || modelKick < 8) {
  throw new Error(`Isolated Turbo release kick is too weak: ${JSON.stringify(turboReleaseImmediate)}`);
}

await page.waitForTimeout(220);
const after = await flight();
const turboAfter = await turbo();
if (!after || !turboAfter) throw new Error("Post-release telemetry unavailable");
const afterForward = Math.abs(Number(after.forwardVelocity) || 0);
if (afterForward < duringForward + 7) {
  throw new Error(`Turbo release did not create a strong visible speed step: during=${duringForward.toFixed(3)} after=${afterForward.toFixed(3)} modelKick=${modelKick.toFixed(3)}`);
}
await canvas.screenshot({ path: `${outputDir}/08-v30-turbo-release.png` });

const result = {
  capturedAt: new Date().toISOString(),
  before,
  during,
  turboDuring,
  holdTravel,
  beforeForward,
  duringForward,
  turboReleaseImmediate,
  releaseImmediateFlight,
  modelKick,
  after,
  turboAfter,
  afterForward,
  consoleErrors,
  pageErrors,
};
await writeFile(`${outputDir}/turbo-isolation-diagnostics.json`, JSON.stringify(result, null, 2));
if (pageErrors.length) throw new Error(`Page errors during Turbo isolation audit: ${pageErrors.join(" | ")}`);
await browser.close();
