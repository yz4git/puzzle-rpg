import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.SKY_DANCER_AUDIT_URL || "http://127.0.0.1:4173";
const outputDir = process.env.SKY_DANCER_AUDIT_DIR || "artifacts/webgl-audit";
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
await page.waitForTimeout(1800);

const bridgeAvailable = await page.evaluate(() => typeof window.__skyDancerGetReferenceVisualV35 === "function");
if (!bridgeAvailable) throw new Error("V35 webdriver visual audit bridge is unavailable");
const visual = await page.evaluate(() => window.__skyDancerGetReferenceVisualV35());

if (Number(visual.focusCityCount) < 800) throw new Error(`V35 focal metro density is too low: ${JSON.stringify(visual)}`);
if (!visual.focusRootEffectiveVisible) throw new Error(`V35 focal metro root is not effectively visible: ${JSON.stringify(visual)}`);
if (Number(visual.focusCityInViewCount) < 650 || !visual.focusCityNdcBounds) throw new Error(`V35 focal metro is not visibly projected: ${JSON.stringify(visual)}`);
const cityBounds = visual.focusCityNdcBounds;
const cityVerticalSpan = Number(cityBounds.maxY) - Number(cityBounds.minY);
const cityHorizontalSpan = Number(cityBounds.maxX) - Number(cityBounds.minX);
if (cityVerticalSpan < 0.42 || cityVerticalSpan > 0.90) {
  throw new Error(`V35 city vertical coverage diverges from the reference midground: ${JSON.stringify(visual)}`);
}
if (cityHorizontalSpan < 1.15 || cityHorizontalSpan > 1.70) {
  throw new Error(`V35 city horizontal coverage diverges from the reference central corridor: ${JSON.stringify(visual)}`);
}
if (Number(cityBounds.maxY) < -0.15) {
  throw new Error(`V35 skyline sits too low in frame: ${JSON.stringify(visual)}`);
}
if (Number(visual.focusStreetCount) < 10) throw new Error(`V35 focal street structure is incomplete: ${JSON.stringify(visual)}`);
if (Number(visual.riverCount) < 20) throw new Error(`V35 focal river structure is incomplete: ${JSON.stringify(visual)}`);
if (Number(visual.focusCloudCount) < 30) throw new Error(`V35 readable below-flight clouds are incomplete: ${JSON.stringify(visual)}`);
if (Number(visual.focusMountainCount) < 38) throw new Error(`V35 angular horizon is incomplete: ${JSON.stringify(visual)}`);
if (!visual.fieldsVisible) throw new Error(`Recovered patchwork density is not visible: ${JSON.stringify(visual)}`);
if (visual.settlementsVisible || visual.towersVisible || visual.roadsVisible) throw new Error(`Coarse legacy settlement geometry still dominates the V35 foreground: ${JSON.stringify(visual)}`);
if (visual.v34MassesVisible) throw new Error(`V34 broad terrain masses still override the reference hierarchy: ${JSON.stringify(visual)}`);
if (visual.legacyRidgesVisible) throw new Error(`Legacy stretched ridges are still visible: ${JSON.stringify(visual)}`);
if (!visual.focusCityVisible) throw new Error(`Capture-driven city hierarchy is not visible: ${JSON.stringify(visual)}`);
if (!visual.cameraFramingInstalled || !visual.singleOwnerInstalled) throw new Error(`V35 single-owner presentation was not fully installed: ${JSON.stringify(visual)}`);
if (Number(visual.fogNear) < 600 || Number(visual.fogFar) < 1700) throw new Error(`V35 atmosphere clips metro depth: ${JSON.stringify(visual)}`);

const focalDelta = Number(visual.focusCenterWorldZ) - Number(visual.cameraZ);
if (!Number.isFinite(focalDelta) || focalDelta < 220 || focalDelta > 360) {
  throw new Error(`V35 focal metro is outside the reference midground corridor: ${JSON.stringify(visual)}`);
}

await page.screenshot({ path: `${outputDir}/09-v35-reference.png`, fullPage: true });
await canvas.screenshot({ path: `${outputDir}/09-v35-reference-canvas.png` });
const diagnostics = { visual, focalDelta, cityVerticalSpan, cityHorizontalSpan, consoleErrors, pageErrors };
await writeFile(`${outputDir}/v35-reference-diagnostics.json`, JSON.stringify(diagnostics, null, 2));
if (consoleErrors.length) throw new Error(`Console errors during V35 reference audit: ${consoleErrors.join(" | ")}`);
if (pageErrors.length) throw new Error(`Page errors during V35 reference audit: ${pageErrors.join(" | ")}`);
await browser.close();
