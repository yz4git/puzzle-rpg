import { chromium } from 'playwright';
import fs from 'node:fs';

const outDir = 'review-output/early-game-20260828';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 402, height: 874 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: 'ja-JP',
  reducedMotion: 'no-preference',
});
const page = await context.newPage();
const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console: ${msg.text()}`); });
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

const metrics = { viewport: { width: 402, height: 874 }, checkpoints: [], battleTurns: [], errors };
async function shot(name) {
  const path = `${outDir}/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  return path;
}
async function checkpoint(name, extra = {}) {
  const base = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    bodyScrollHeight: document.body.scrollHeight,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    text: document.body.innerText.slice(0, 1000),
  }));
  metrics.checkpoints.push({ name, ...base, ...extra });
}
async function tapLabel(label, delay = 95) {
  const loc = page.getByRole('button', { name: label, exact: true });
  await loc.tap();
  await page.waitForTimeout(delay);
}
async function move(dir, count = 1, delay = 105) {
  const labels = { up: 'Move up', down: 'Move down', left: 'Move left', right: 'Move right' };
  for (let i = 0; i < count; i += 1) {
    await tapLabel(labels[dir], delay);
  }
}
async function dismissDialogue(max = 20) {
  for (let i = 0; i < max; i += 1) {
    const overlay = page.locator('div[data-story="event"], div[data-story="dialogue"]').first();
    if (!(await overlay.isVisible().catch(() => false))) return;
    await overlay.tap({ position: { x: 190, y: 90 } }).catch(async () => {
      await page.getByText('A / TAP ▼').last().tap();
    });
    await page.waitForTimeout(100);
  }
}
function parseBattleSnapshot(text) {
  const hpMatches = [...text.matchAll(/HP\s+(\d+)\/(\d+)/g)].map(m => ({ current: Number(m[1]), max: Number(m[2]) }));
  const turn = Number((text.match(/TURN\s+(\d+)/) || [])[1] || 0);
  const nowPower = Number((text.match(/NOW[\s\S]{0,100}?(\d+)\s*(?:通常攻撃|重撃|DRAIN|DISRUPT|PIERCE|SEAL|攻撃|ダメージ)/) || [])[1] || 0);
  return { turn, enemyHp: hpMatches[0] || null, playerHp: hpMatches[1] || null, nowPower };
}
async function boardState() {
  return page.locator('section[aria-label="RPG Cluster Break board"] button').evaluateAll((buttons) => buttons.map((button) => {
    const label = button.getAttribute('aria-label') || '';
    const m = label.match(/^(Attack|Heal|Barrier|Skip) row (\d+) column (\d+)$/);
    return m ? { type: m[1], row: Number(m[2]), col: Number(m[3]), disabled: button.disabled, label } : null;
  }).filter(Boolean));
}
function largestGroups(cells) {
  const map = new Map(cells.map(c => [`${c.row}:${c.col}`, c]));
  const seen = new Set();
  const groups = [];
  for (const cell of cells) {
    const key = `${cell.row}:${cell.col}`;
    if (seen.has(key) || cell.disabled) continue;
    const stack = [cell];
    const group = [];
    seen.add(key);
    while (stack.length) {
      const cur = stack.pop(); group.push(cur);
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nk = `${cur.row + dr}:${cur.col + dc}`;
        const n = map.get(nk);
        if (n && !n.disabled && n.type === cell.type && !seen.has(nk)) { seen.add(nk); stack.push(n); }
      }
    }
    groups.push({ type: cell.type, cells: group, count: group.length });
  }
  return groups.sort((a,b) => b.count - a.count);
}
async function playOneTurn() {
  const textBefore = await page.locator('main[data-enemy]').innerText();
  const before = parseBattleSnapshot(textBefore);
  const groups = largestGroups(await boardState());
  if (!groups.length) return null;
  const playerHp = before.playerHp?.current ?? 20;
  const attack = groups.filter(g => g.type === 'Attack').sort((a,b) => b.count-a.count)[0];
  const heal = groups.filter(g => g.type === 'Heal').sort((a,b) => b.count-a.count)[0];
  const barrier = groups.filter(g => g.type === 'Barrier').sort((a,b) => b.count-a.count)[0];
  const skip = groups.filter(g => g.type === 'Skip').sort((a,b) => b.count-a.count)[0];
  let chosen = attack || groups[0];
  if (playerHp <= 9 && heal && heal.count >= 2) chosen = heal;
  else if (before.nowPower >= 4 && barrier && barrier.count >= 2) chosen = barrier;
  else if (attack && attack.count >= 2) chosen = attack;
  else if (skip && skip.count >= 3) chosen = skip;
  else chosen = groups[0];
  const seed = chosen.cells[0];
  const target = page.getByRole('button', { name: seed.label, exact: true });
  const started = Date.now();
  await target.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true, bubbles: true });
  await page.waitForTimeout(70);
  await target.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch', isPrimary: true, bubbles: true });
  await page.waitForTimeout(760);
  const elapsedMs = Date.now() - started;
  const battleMain = page.locator('main[data-enemy]');
  const stillBattle = await battleMain.isVisible().catch(() => false);
  const afterText = stillBattle ? await battleMain.innerText() : await page.locator('body').innerText();
  const after = parseBattleSnapshot(afterText);
  const record = { before, chosen: { type: chosen.type, count: chosen.count, row: seed.row, col: seed.col }, elapsedMs, after, stillBattle };
  metrics.battleTurns.push(record);
  return record;
}

await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await shot('00-title');
await checkpoint('title');

await page.getByRole('button', { name: /RPG MODE/ }).tap();
await page.waitForTimeout(180);
await shot('01-rpg-choice');
await checkpoint('rpg-choice');

await page.getByRole('button', { name: /NEW GAME/ }).tap();
await page.waitForSelector('main[data-map="hearthVillage"]');
await page.waitForTimeout(250);
await shot('02-opening');
await checkpoint('opening');
await dismissDialogue();
await page.waitForFunction(() => !document.querySelector('div[data-story="event"]'));
await page.waitForTimeout(200);

const controlSizes = await page.evaluate(() => {
  const q = (name) => document.querySelector(`button[aria-label="${name}"]`)?.getBoundingClientRect();
  const a = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('CHECK'))?.getBoundingClientRect();
  const b = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('MENU'))?.getBoundingClientRect();
  return {
    up: q('Move up') ? { width: q('Move up').width, height: q('Move up').height } : null,
    left: q('Move left') ? { width: q('Move left').width, height: q('Move left').height } : null,
    a: a ? { width: a.width, height: a.height } : null,
    b: b ? { width: b.width, height: b.height } : null,
  };
});
await shot('03-hearth-start');
await checkpoint('hearth-start', { controlSizes });

await move('up', 6);
await move('right', 1);
await page.waitForTimeout(150);
await shot('04-elder-facing');
await tapLabel('A CHECK');
await page.waitForTimeout(160);
await shot('05-elder-dialogue');
await checkpoint('elder-dialogue');
await dismissDialogue();
await page.waitForTimeout(160);

await move('down', 8);
await page.waitForTimeout(150);
await tapLabel('A CHECK');
await page.waitForSelector('main[data-map="world"]');
await page.waitForFunction(() => document.querySelector('main[data-area-phase="none"]'));
await page.waitForTimeout(160);
await shot('06-world-entry');
await checkpoint('world-entry');

await move('right', 4);
await move('up', 5);
await page.waitForTimeout(120);
await tapLabel('A CHECK');
await page.waitForSelector('main[data-map="oldTemple"]');
await page.waitForFunction(() => document.querySelector('main[data-area-phase="none"]'));
await page.waitForTimeout(160);
await shot('07-old-temple-entry');
await checkpoint('old-temple-entry');

const walkSequence = ['up','up','up','left','left','up','up','down','up','down','up','down','up','down','up','down','up','down','up','down','up','down','up','down'];
let encounterCaptured = false;
for (const dir of walkSequence) {
  if (await page.locator('main[data-enemy]').isVisible().catch(() => false)) break;
  await tapLabel({up:'Move up',down:'Move down',left:'Move left',right:'Move right'}[dir], 105);
  const main = page.locator('main[data-encounter]');
  const kind = await main.getAttribute('data-encounter').catch(() => 'none');
  if (kind && kind !== 'none' && !encounterCaptured) {
    encounterCaptured = true;
    await shot('08-encounter-transition');
    await checkpoint('encounter-transition', { encounterKind: kind });
  }
  if (kind && kind !== 'none') {
    await page.waitForSelector('main[data-enemy]', { timeout: 1800 });
    break;
  }
}
await page.waitForSelector('main[data-enemy]', { timeout: 4000 });
await page.waitForTimeout(200);
await shot('09-battle-start');
await checkpoint('battle-start');

for (let turn = 0; turn < 10; turn += 1) {
  if (!(await page.locator('main[data-enemy]').isVisible().catch(() => false))) break;
  const rec = await playOneTurn();
  if (!rec) break;
  if (turn === 2) await shot('10-battle-mid');
  if (!rec.stillBattle) break;
}
await page.waitForTimeout(600);
if (await page.locator('main[data-enemy]').isVisible().catch(() => false)) {
  await shot('11-battle-late');
  await checkpoint('battle-late');
} else {
  await shot('11-post-battle');
  await checkpoint('post-battle');
}

metrics.finalSave = await page.evaluate(() => JSON.parse(localStorage.getItem('puzzle-rpg:rpg-mode:v1') || 'null'));
metrics.finalText = (await page.locator('body').innerText()).slice(0, 1800);
fs.writeFileSync(`${outDir}/review.json`, JSON.stringify(metrics, null, 2));
await browser.close();
console.log(`EARLY GAME REVIEW COMPLETE ${JSON.stringify({ screenshots: 12, turns: metrics.battleTurns.length, errors: errors.length, final: metrics.finalSave && { mapId: metrics.finalSave.mapId, hp: metrics.finalSave.hp, level: metrics.finalSave.level, steps: metrics.finalSave.steps } })}`);
