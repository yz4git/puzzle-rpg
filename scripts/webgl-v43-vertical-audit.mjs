import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const BASE_URL = process.env.SKY_DANCER_AUDIT_URL ?? "http://127.0.0.1:4173/";
const OUTPUT = "artifacts/webgl-audit/50-v43-vertical-combat.png";

const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-webgl", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({
  viewport: { width: 844, height: 390 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => pageErrors.push(String(error)));

try {
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 60000 });
  const start = page.getByRole("button", { name: /START(?: HARD)? RUN/i });
  if (await start.isVisible().catch(() => false)) await start.click();
  const canvas = page.locator('canvas[aria-label="Sky Dancer WebGL game view"]');
  await canvas.waitFor({ state: "visible", timeout: 30000 });
  await page.waitForFunction(() => typeof window.__skyDancerGetV43VerticalFlight === "function", null, { timeout: 30000 });
  const shot = page.getByRole("button", { name: "Fire missile" });
  await shot.waitFor({ state: "visible", timeout: 10000 });

  // Sample a normal production encounter. Touch-fire periodically so both the
  // player seeker and naturally launched enemy missiles have opportunities to
  // demonstrate vertical guidance; no private simulation state is mutated.
  let maxAbsAltitude = 0;
  let maxAbsEnemyPitch = 0;
  let maxAbsMissilePitch = 0;
  let sawAvoidance = false;
  let sawEnemyMissile = false;
  let sawPlayerMissile = false;
  let minAltitude = Number.POSITIVE_INFINITY;
  let maxAltitude = Number.NEGATIVE_INFINITY;
  let firedShots = 0;

  for (let sample = 0; sample < 60; sample += 1) {
    if (sample % 5 === 1) {
      const box = await shot.boundingBox();
      if (box) {
        await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.5);
        firedShots += 1;
      }
    }
    if (sample === 18) await page.keyboard.down("ArrowLeft");
    if (sample === 25) await page.keyboard.up("ArrowLeft");
    if (sample === 38) await page.keyboard.down("ArrowRight");
    if (sample === 45) await page.keyboard.up("ArrowRight");

    await page.waitForTimeout(400);
    const state = await page.evaluate(() => window.__skyDancerGetV43VerticalFlight?.());
    if (!state) continue;
    maxAbsAltitude = Math.max(maxAbsAltitude, Number(state.maxAbsEnemyAltitude ?? 0));
    maxAbsEnemyPitch = Math.max(maxAbsEnemyPitch, Number(state.maxAbsEnemyPitch ?? 0));
    maxAbsMissilePitch = Math.max(maxAbsMissilePitch, Number(state.maxAbsMissilePitch ?? 0));
    const enemies = Array.isArray(state.enemies) ? state.enemies : [];
    for (const enemy of enemies) {
      const altitude = Number(enemy.altitudeOffsetMeters ?? 0);
      minAltitude = Math.min(minAltitude, altitude);
      maxAltitude = Math.max(maxAltitude, altitude);
      sawAvoidance ||= Boolean(enemy.avoiding);
      assert.ok(Math.abs(altitude) <= 10.15, `enemy altitude escaped +/-10m: ${altitude}`);
    }
    sawEnemyMissile ||= Array.isArray(state.enemyMissiles) && state.enemyMissiles.length > 0;
    sawPlayerMissile ||= Array.isArray(state.playerMissiles) && state.playerMissiles.length > 0;
  }
  await page.keyboard.up("ArrowLeft").catch(() => {});
  await page.keyboard.up("ArrowRight").catch(() => {});

  await mkdir("artifacts/webgl-audit", { recursive: true });
  await page.screenshot({ path: OUTPUT, fullPage: true });
  await canvas.screenshot({ path: "artifacts/webgl-audit/50-v43-vertical-combat-canvas.png" });

  assert.ok(maxAbsAltitude >= 2.0, `expected real vertical aircraft motion, max=${maxAbsAltitude.toFixed(2)}m`);
  assert.ok(maxAbsEnemyPitch >= 0.015, `expected aircraft climb/dive pitch, max=${maxAbsEnemyPitch.toFixed(4)}rad`);
  assert.ok(maxAltitude - minAltitude >= 2.5, `expected altitude spread, range=${(maxAltitude - minAltitude).toFixed(2)}m`);
  assert.ok(sawEnemyMissile || sawPlayerMissile, "expected at least one live missile during vertical audit");
  assert.ok(maxAbsMissilePitch > 0.01, `expected 3D missile pitch while targets differ in altitude, max=${maxAbsMissilePitch.toFixed(4)}rad`);
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);

  console.log(JSON.stringify({
    maxAbsAltitude,
    minAltitude,
    maxAltitude,
    maxAbsEnemyPitch,
    maxAbsMissilePitch,
    sawAvoidance,
    sawEnemyMissile,
    sawPlayerMissile,
    firedShots,
    consoleErrors: consoleErrors.length,
    pageErrors: pageErrors.length,
  }, null, 2));
} finally {
  await browser.close();
}
