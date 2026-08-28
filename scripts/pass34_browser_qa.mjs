import { chromium } from "playwright";

const baseURL = process.env.PASS34_URL ?? "http://127.0.0.1:4173";
const viewports = [
  { name: "iphone-se", width: 375, height: 667 },
  { name: "iphone-regular", width: 390, height: 844 },
  { name: "iphone-large", width: 430, height: 932 },
];

const failures = [];
function fail(viewport, phase, message) {
  failures.push(`${viewport}/${phase}: ${message}`);
}

async function geometryAudit(page, viewport, phase) {
  const report = await page.evaluate(() => {
    const visible = (el) => {
      const style = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0 && r.width > 0 && r.height > 0;
    };
    const buttons = [...document.querySelectorAll("button")].filter(visible).map((el) => {
      const r = el.getBoundingClientRect();
      return { text: (el.textContent || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 80), w: r.width, h: r.height, left: r.left, right: r.right, top: r.top, bottom: r.bottom, aria: el.getAttribute("aria-label") || "" };
    });
    const fixedCards = [...document.querySelectorAll('[class*="dialogueBox"],[class*="menuWindow"],[class*="resultCard"],[class*="introCard"],[class*="rewardCard"],[class*="continuePanel"],[class*="modeGrid"]')].filter(visible).map((el) => {
      const r = el.getBoundingClientRect();
      return { name: String(el.className).slice(0, 100), left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width, h: r.height, scrollH: el.scrollHeight, clientH: el.clientHeight };
    });
    const root = document.querySelector("main");
    const rr = root?.getBoundingClientRect();
    return {
      innerWidth: innerWidth,
      innerHeight: innerHeight,
      htmlOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      bodyOverflowX: document.body.scrollWidth - document.body.clientWidth,
      root: rr ? { left: rr.left, right: rr.right, top: rr.top, bottom: rr.bottom, w: rr.width, h: rr.height } : null,
      buttons,
      fixedCards,
    };
  });

  if (report.htmlOverflowX > 2 || report.bodyOverflowX > 2) fail(viewport.name, phase, `horizontal overflow html=${report.htmlOverflowX} body=${report.bodyOverflowX}`);
  if (!report.root) fail(viewport.name, phase, "main root missing");
  else if (report.root.left < -2 || report.root.right > report.innerWidth + 2) fail(viewport.name, phase, `main outside viewport ${JSON.stringify(report.root)}`);

  for (const card of report.fixedCards) {
    if (card.left < -2 || card.right > report.innerWidth + 2 || card.top < -2 || card.bottom > report.innerHeight + 2) {
      fail(viewport.name, phase, `card clipped ${JSON.stringify(card)}`);
    }
  }

  for (const button of report.buttons) {
    const move = /^Move /.test(button.aria);
    const boardPanel = /panel row/.test(button.aria);
    const exempt = move || boardPanel;
    if (!exempt && (button.h < 40 || button.w < 40)) fail(viewport.name, phase, `small primary target ${button.text} ${button.w.toFixed(1)}x${button.h.toFixed(1)}`);
    if (move && (button.h < 34 || button.w < 34)) fail(viewport.name, phase, `small dpad target ${button.aria} ${button.w.toFixed(1)}x${button.h.toFixed(1)}`);
  }

  console.log(`PASS34 ${viewport.name} ${phase}`, JSON.stringify({ overflowX: [report.htmlOverflowX, report.bodyOverflowX], buttons: report.buttons.length, cards: report.fixedCards.length }));
}

async function runViewport(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(`pageerror:${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") runtimeErrors.push(`console:${message.text()}`); });

  await page.goto(baseURL, { waitUntil: "networkidle" });
  await geometryAudit(page, viewport, "title");
  const rpgMode = page.getByRole("button", { name: /RPG MODE/i });
  const chapterMode = page.getByRole("button", { name: /CHAPTER BATTLE/i });
  if (await rpgMode.count() !== 1 || await chapterMode.count() !== 1) fail(viewport.name, "title", "mode buttons missing");

  await rpgMode.click();
  await geometryAudit(page, viewport, "rpg-choice");
  const newGame = page.getByRole("button", { name: /NEW GAME/i });
  if (!await newGame.isVisible()) fail(viewport.name, "rpg-choice", "NEW GAME not visible");
  else await newGame.click();

  await page.waitForTimeout(250);
  await geometryAudit(page, viewport, "opening");
  for (let i = 0; i < 12; i += 1) {
    const dialogue = page.locator('[class*="dialogueOverlay"]');
    if (!await dialogue.isVisible().catch(() => false)) break;
    await page.keyboard.press("a");
    await page.waitForTimeout(40);
  }
  const canvas = page.getByRole("img", { name: /exploration map/i }).or(page.locator('canvas[aria-label*="exploration map"]'));
  if (!await page.locator('canvas[aria-label*="exploration map"]').isVisible()) fail(viewport.name, "field", "exploration canvas missing");
  const canvasBox = await page.locator('canvas[aria-label*="exploration map"]').boundingBox();
  if (!canvasBox || canvasBox.width < Math.min(320, viewport.width - 24)) fail(viewport.name, "field", `world canvas too small ${JSON.stringify(canvasBox)}`);
  await geometryAudit(page, viewport, "field");

  const menuButton = page.locator("button").filter({ hasText: "MENU" }).last();
  await menuButton.dispatchEvent("pointerdown", { pointerId: 1, pointerType: "touch", isPrimary: true, button: 0 });
  await page.waitForTimeout(80);
  if (!await page.getByText("FIELD MENU", { exact: true }).isVisible().catch(() => false)) fail(viewport.name, "menu", "FIELD MENU did not open");
  await geometryAudit(page, viewport, "menu");
  const tabs = await page.locator('[class*="menuTabs"] button').count();
  if (tabs !== 6) fail(viewport.name, "menu", `expected 6 menu tabs, got ${tabs}`);
  const close = page.getByRole("button", { name: /B • CLOSE/i });
  if (await close.isVisible().catch(() => false)) await close.click();

  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /CHAPTER BATTLE/i }).click();
  await page.waitForTimeout(120);
  await geometryAudit(page, viewport, "chapter-intro");
  const battleStart = page.getByRole("button", { name: /BATTLE START/i });
  if (!await battleStart.isVisible().catch(() => false)) fail(viewport.name, "chapter-intro", "BATTLE START missing");
  else await battleStart.click();
  await page.waitForTimeout(120);
  const board = page.locator('[aria-label="cluster break board"]');
  if (!await board.isVisible().catch(() => false)) fail(viewport.name, "chapter-battle", "cluster board missing");
  const tiles = await page.locator('button[aria-label*="panel row"]').count();
  if (tiles !== 36) fail(viewport.name, "chapter-battle", `expected 36 board panels, got ${tiles}`);
  const nextCols = await page.locator('[aria-label^="column "]').count();
  if (nextCols !== 6) fail(viewport.name, "chapter-battle", `expected 6 NEXT columns, got ${nextCols}`);
  await geometryAudit(page, viewport, "chapter-battle");

  if (runtimeErrors.length) fail(viewport.name, "runtime", runtimeErrors.join(" | "));
  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of viewports) await runViewport(browser, viewport);
} finally {
  await browser.close();
}

if (failures.length) {
  console.error("PASS34 FAILURES");
  failures.forEach((entry) => console.error(`- ${entry}`));
  process.exit(1);
}
console.log("PASS34_BROWSER_QA_OK");
