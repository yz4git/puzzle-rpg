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
await page.waitForTimeout(2200);

const bridgeAvailable = await page.evaluate(() => typeof window.__skyDancerGetReferenceVisualV39 === "function");
if (!bridgeAvailable) throw new Error("V39 webdriver visual audit bridge is unavailable");
const visual = await page.evaluate(() => window.__skyDancerGetReferenceVisualV39());
const terrainV41 = await page.evaluate(() => typeof window.__skyDancerGetTerrainContinuityV41 === "function" ? window.__skyDancerGetTerrainContinuityV41() : null);
const hudVisible = await page.locator(".skyDancerV39HudFrame").isVisible().catch(() => false);

if (Number(visual.v36CityCount) < 800) throw new Error(`V36 archetype city density is too low: ${JSON.stringify(visual)}`);
if (!visual.v36CityVisible) throw new Error(`V36 archetype city is not visible: ${JSON.stringify(visual)}`);
if (visual.v35CityVisible) throw new Error(`Superseded V35 box city is still visible: ${JSON.stringify(visual)}`);
const v41TerrainValid = terrainV41 && Number(terrainV41.visibleTiles) === 25 && terrainV41.legacyTerrainHidden === true && Number(terrainV41.reliefSpan) >= 4;
if (!visual.terrainVisible && !v41TerrainValid) throw new Error(`Neither V36 nor V41 terrain is valid: ${JSON.stringify({ visual, terrainV41 })}`);
if (Number(visual.arterialCount) < 6) throw new Error(`V36 arterial hierarchy is incomplete: ${JSON.stringify(visual)}`);
if (!visual.playerSurfaceKitVisible || !visual.turboLinesInstalled) throw new Error(`V37 player presentation is incomplete: ${JSON.stringify(visual)}`);
if (!visual.v38SkyVisible || !visual.v38RidgesVisible || !visual.v38CloudsVisible) throw new Error(`V38 atmosphere layers are incomplete: ${JSON.stringify(visual)}`);
if (Number(visual.v38CloudCount) < 180) throw new Error(`V38 cloud clustering is incomplete: ${JSON.stringify(visual)}`);
if (Number(visual.fogNear) < 500 || Number(visual.fogFar) < 1750) throw new Error(`V38 atmospheric depth is clipped: ${JSON.stringify(visual)}`);
if (!hudVisible) throw new Error("V39 HUD frame is not visible");

await page.screenshot({ path: `${outputDir}/10-v39-reference-fidelity.png`, fullPage: true });
await canvas.screenshot({ path: `${outputDir}/10-v39-reference-fidelity-canvas.png` });
await writeFile(`${outputDir}/v39-reference-fidelity-diagnostics.json`, JSON.stringify({ visual, terrainV41, hudVisible, consoleErrors, pageErrors }, null, 2));
if (consoleErrors.length) throw new Error(`Console errors during V39 fidelity audit: ${consoleErrors.join(" | ")}`);
if (pageErrors.length) throw new Error(`Page errors during V39 fidelity audit: ${pageErrors.join(" | ")}`);
await browser.close();
