import { chromium } from "playwright";

const BASE = "http://127.0.0.1:4173/";
const STORAGE_KEY = "puzzle-rpg:rpg-mode:v1";
const failures = [];
const notes = [];

function fail(message) { failures.push(message); }
function note(message) { notes.push(message); console.log(`PASS35 ${message}`); }

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 3,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1",
});
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));

async function waitTitle() {
  await page.getByRole("main", { name: "Puzzle RPG mode title" }).waitFor({ state: "visible", timeout: 15000 });
}

async function clearClientState() {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.evaluate(async (key) => {
    localStorage.removeItem(key);
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    }
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }
  }, STORAGE_KEY);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitTitle();
}

async function finishOpening() {
  for (let i = 0; i < 16; i += 1) {
    const overlay = page.locator("[data-page]").first();
    if (!(await overlay.count())) return;
    await overlay.click({ position: { x: 20, y: 20 } });
    await page.waitForTimeout(60);
  }
  if (await page.locator("[data-page]").count()) fail("opening dialogue did not finish within 16 taps");
}

async function currentSteps() {
  const text = await page.locator("text=/JOURNEY .* STEPS/").first().textContent().catch(() => null);
  const match = text?.match(/JOURNEY\s*[•·]?\s*(\d+)\s*STEPS/i);
  return match ? Number(match[1]) : null;
}

async function makeOneStep() {
  const before = await currentSteps();
  for (const label of ["Move right", "Move left", "Move up", "Move down"]) {
    const button = page.getByRole("button", { name: label });
    await button.dispatchEvent("pointerdown", { pointerId: 1, pointerType: "touch", isPrimary: true, buttons: 1 });
    await page.waitForTimeout(30);
    await button.dispatchEvent("pointerup", { pointerId: 1, pointerType: "touch", isPrimary: true, buttons: 0 });
    await page.waitForTimeout(80);
    const after = await currentSteps();
    if (after !== null && before !== null && after > before) return after;
  }
  fail("could not make a legal field step");
  return before;
}

await clearClientState();

// PWA registration / version integrity.
try {
  const pwa = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return { supported: false };
    const ready = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error("service worker ready timeout")), 10000)),
    ]);
    const build = await fetch("./build-id.json", { cache: "no-store" }).then((r) => r.json()).then((v) => v.build);
    return { supported: true, build, active: ready.active?.scriptURL ?? null };
  });
  if (!pwa.supported) fail("service worker API unavailable");
  else if (!pwa.active || !pwa.build || !pwa.active.includes(`build=${encodeURIComponent(pwa.build)}`)) fail(`service worker build mismatch: ${JSON.stringify(pwa)}`);
  else note(`service-worker build ${pwa.build} active`);
} catch (error) {
  fail(`service worker registration failed: ${error}`);
}

// First reload should become controlled; then app shell should survive offline reload.
try {
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitTitle();
  const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker?.controller));
  if (!controlled) fail("page is not controlled after service-worker reload");
  else note("service-worker controls page after reload");
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 15000 });
  await waitTitle();
  note("offline app-shell reload succeeds");
} catch (error) {
  fail(`offline app-shell reload failed: ${error}`);
} finally {
  await context.setOffline(false);
}

// Fresh RPG save, opening completion, movement, immediate reload, continue.
await page.reload({ waitUntil: "domcontentloaded" });
await waitTitle();
await page.getByRole("button", { name: /RPG MODE/ }).click();
await page.getByRole("button", { name: /NEW GAME/ }).click();
await finishOpening();
await page.getByRole("button", { name: "Move up" }).waitFor({ state: "visible", timeout: 10000 });
const savedAfterOpening = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "null"), STORAGE_KEY);
if (!savedAfterOpening?.flags?.includes("story:openingSeen")) fail("opening completion was not autosaved");
else note("opening completion autosave succeeds");

const stepped = await makeOneStep();
if (stepped === null) fail("step counter unavailable before reload");
else note(`field movement reached ${stepped} steps before reload`);

await page.reload({ waitUntil: "domcontentloaded" });
await waitTitle();
await page.getByRole("button", { name: /RPG MODE/ }).click();
const continueButton = page.getByRole("button", { name: /CONTINUE/ });
if (!(await continueButton.count())) {
  fail("CONTINUE missing after reload");
} else {
  await continueButton.click();
  await page.getByRole("button", { name: "Move up" }).waitFor({ state: "visible", timeout: 10000 });
  const continuedSteps = await currentSteps();
  if (stepped !== null && continuedSteps !== stepped) fail(`immediate reload lost movement progress: before=${stepped}, continued=${continuedSteps}`);
  else note(`immediate reload preserved ${continuedSteps} steps`);
}

// Save settings and menu state changes through a background/pagehide lifecycle.
await page.getByRole("button", { name: /MENU/ }).dispatchEvent("pointerdown", { pointerId: 2, pointerType: "touch", isPrimary: true, buttons: 1 });
await page.getByRole("button", { name: "SAVE" }).click();
const musicButton = page.getByRole("button", { name: /MUSIC/ });
const musicBefore = await musicButton.textContent();
await musicButton.click();
const musicAfter = await musicButton.textContent();
if (musicAfter === musicBefore) fail("music setting did not toggle");
await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
await page.reload({ waitUntil: "domcontentloaded" });
await waitTitle();
await page.getByRole("button", { name: /RPG MODE/ }).click();
await page.getByRole("button", { name: /CONTINUE/ }).click();
await page.getByRole("button", { name: /MENU/ }).dispatchEvent("pointerdown", { pointerId: 3, pointerType: "touch", isPrimary: true, buttons: 1 });
await page.getByRole("button", { name: "SAVE" }).click();
const musicReloaded = await page.getByRole("button", { name: /MUSIC/ }).textContent();
if (musicAfter && musicReloaded !== musicAfter) fail(`pagehide lost settings: expected ${musicAfter}, got ${musicReloaded}`);
else note("pagehide preserves settings");
await page.getByRole("button", { name: /B • CLOSE/ }).click();

// Rapid mode transitions should remain stable and never strand an overlay.
await page.getByRole("button", { name: /MENU/ }).dispatchEvent("pointerdown", { pointerId: 4, pointerType: "touch", isPrimary: true, buttons: 1 });
await page.getByRole("button", { name: /TITLEへ戻る/ }).click();
await waitTitle();
for (let i = 0; i < 8; i += 1) {
  await page.getByRole("button", { name: /RPG MODE/ }).click();
  await page.getByRole("button", { name: /MODE SELECT/ }).click();
}
await page.getByRole("button", { name: /CHAPTER BATTLE/ }).click();
await page.getByRole("button", { name: /◀ MODE/ }).click();
await waitTitle();
note("rapid mode transitions return cleanly to title");

if (pageErrors.length) fail(`runtime page errors: ${pageErrors.join(" | ")}`);

await browser.close();

if (failures.length) {
  console.error("PASS35 FAILURES");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("PASS35 SUCCESS");
for (const line of notes) console.log(`- ${line}`);
