import { chromium } from 'playwright';
import fs from 'node:fs';

const outDir = 'review-output/early-battle-20260828-v2';
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'ja-JP' });
const page = await context.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));

const initialSave = {
  version: 1, playerName: 'LIO', level: 1, exp: 0, hp: 20, maxHp: 20, gold: 18,
  mapId: 'oldTemple', position: { x: 8, y: 11 }, direction: 'up',
  lastInn: { mapId: 'hearthVillage', position: { x: 8, y: 10 } },
  inventory: [{ id: 'herb', count: 2 }, { id: 'smoke', count: 1 }], inventorySlots: 4,
  equipmentOwned: ['travellerCoat'], equipment: { weapon: null, armor: null, charm: null },
  techniques: [], techniqueSlots: 2,
  memos: [{ id: 'journey', title: '最初の旅', text: '村の長から北のOld Templeについて聞く。', read: false }, { id: 'old-temple', title: '古寺の橋印', text: 'Hearth Villageの北、Old Templeに崩れた橋を起こす印がある。', read: false }],
  flags: ['story:openingSeen', 'story:begun'], openedChests: [], defeatedEncounters: [], defeatedEnemies: {}, releasedEnemies: {}, battleLog: [],
  steps: 23, playSeconds: 10, encounterMeter: 1, settings: { music: false, sfx: false }
};

await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
await page.evaluate(save => localStorage.setItem('puzzle-rpg:rpg-mode:v1', JSON.stringify(save)), initialSave);
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: /RPG MODE/ }).tap();
await page.getByRole('button', { name: /CONTINUE/ }).tap();
await page.waitForSelector('main[data-map="oldTemple"]');

// move() consumes one random value for encounter reset; chooseEncounter consumes the next.
// Force only the second value to select the last Old Temple encounter, then restore before battle board generation.
await page.evaluate(() => {
  const original = Math.random;
  let calls = 0;
  Math.random = () => {
    calls += 1;
    if (calls === 2) {
      Math.random = original;
      return 0.999999;
    }
    return original();
  };
});
await page.getByRole('button', { name: 'Move up', exact: true }).tap();
await page.waitForSelector('main[data-enemy]', { timeout: 3000 });
await page.waitForFunction(() => document.querySelector('main[data-enemy]')?.innerText.includes('HOLLOW MONK'), null, { timeout: 2000 });
await page.waitForTimeout(180);
await page.screenshot({ path: `${outDir}/00-hollow-monk-start.png` });

function parse(text) {
  const enemyHp = text.match(/HOLLOW MONK[\s\S]*?HP\s+(\d+)\/(\d+)/);
  const playerHpSection = text.match(/\nHP\n(\d+)\/(\d+)/);
  const bar = text.match(/\nBAR\n(\d+)\/30/);
  const free = text.match(/\nFREE\n(\d+)/);
  const turn = text.match(/TURN\s+(\d+)/);
  const nowBlock = text.match(/NOW[\s\S]*?\n([^\n]+)\n(\d+)\n([^\n]+)/);
  return {
    turn: Number(turn?.[1] || 0), enemyHp: Number(enemyHp?.[1] || 0), enemyMax: Number(enemyHp?.[2] || 0),
    playerHp: Number(playerHpSection?.[1] || 0), playerMax: Number(playerHpSection?.[2] || 0), bar: Number(bar?.[1] || 0), free: Number(free?.[1] || 0),
    nowLabel: nowBlock?.[1] || '', nowPower: Number(nowBlock?.[2] || 0), nowDetail: nowBlock?.[3] || ''
  };
}
async function cells() {
  return page.locator('section[aria-label="RPG Cluster Break board"] button').evaluateAll(buttons => buttons.map(button => {
    const label = button.getAttribute('aria-label') || '';
    const m = label.match(/^(ATK|HEAL|BAR|SKIP) row (\d+) column (\d+)$/);
    return m ? { label, type: m[1], row: Number(m[2]), col: Number(m[3]), disabled: button.disabled } : null;
  }).filter(Boolean));
}
function groups(cells) {
  const map = new Map(cells.map(c => [`${c.row}:${c.col}`, c]));
  const seen = new Set(); const out = [];
  for (const c of cells) {
    const key = `${c.row}:${c.col}`; if (seen.has(key) || c.disabled) continue;
    const stack = [c], found = []; seen.add(key);
    while (stack.length) {
      const cur = stack.pop(); found.push(cur);
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nk = `${cur.row+dr}:${cur.col+dc}`, n = map.get(nk);
        if (n && !n.disabled && n.type === c.type && !seen.has(nk)) { seen.add(nk); stack.push(n); }
      }
    }
    out.push({ type: c.type, count: found.length, cells: found });
  }
  return out.sort((a,b) => b.count-a.count);
}
async function waitResolution(prevTurn) {
  await page.waitForTimeout(250);
  await page.waitForFunction(({ prevTurn }) => {
    const main = document.querySelector('main[data-enemy]');
    if (!main) return true;
    const match = main.innerText.match(/TURN\s+(\d+)/);
    return Number(match?.[1] || 0) > prevTurn;
  }, { prevTurn }, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(220);
}

const records = [];
for (let i = 0; i < 12; i += 1) {
  const battle = page.locator('main[data-enemy]');
  if (!(await battle.isVisible().catch(() => false))) break;
  const before = parse(await battle.innerText());
  const allGroups = groups(await cells());
  if (!allGroups.length) break;
  const best = type => allGroups.filter(g => g.type === type).sort((a,b)=>b.count-a.count)[0] || null;
  const candidates = { ATK: best('ATK'), HEAL: best('HEAL'), BAR: best('BAR'), SKIP: best('SKIP') };
  let chosen = candidates.ATK || allGroups[0];
  if (before.playerHp <= 9 && candidates.HEAL?.count >= 2) chosen = candidates.HEAL;
  else if (!/BAR無視/.test(before.nowDetail) && before.nowPower >= 4 && candidates.BAR?.count >= before.nowPower) chosen = candidates.BAR;
  else if (candidates.ATK?.count >= 2) chosen = candidates.ATK;
  else if (candidates.SKIP?.count >= 3) chosen = candidates.SKIP;
  else chosen = allGroups[0];
  const seed = chosen.cells[0];
  const started = Date.now();
  await page.getByRole('button', { name: seed.label, exact: true }).tap();
  await waitResolution(before.turn);
  const still = await battle.isVisible().catch(() => false);
  const after = still ? parse(await battle.innerText()) : null;
  records.push({ before, largest: { ATK: candidates.ATK?.count || 0, HEAL: candidates.HEAL?.count || 0, BAR: candidates.BAR?.count || 0, SKIP: candidates.SKIP?.count || 0 }, chosen: { type: chosen.type, count: chosen.count, row: seed.row, col: seed.col }, elapsedMs: Date.now()-started, after, stillBattle: still });
  if (i === 2 || i === 5) await page.screenshot({ path: `${outDir}/${String(i+1).padStart(2,'0')}-turn.png` });
  if (!still) break;
}
await page.waitForTimeout(700);
await page.screenshot({ path: `${outDir}/99-final.png` });
const finalText = (await page.locator('body').innerText()).slice(0, 1800);
const finalSave = await page.evaluate(() => JSON.parse(localStorage.getItem('puzzle-rpg:rpg-mode:v1') || 'null'));
fs.writeFileSync(`${outDir}/balance.json`, JSON.stringify({ records, errors, finalText, finalSave }, null, 2));
console.log('HOLLOW MONK BALANCE REVIEW V2', JSON.stringify({ turnsPlayed: records.length, errors: errors.length, last: records.at(-1), finalSave: finalSave && { hp: finalSave.hp, level: finalSave.level, exp: finalSave.exp, gold: finalSave.gold } }));
await browser.close();
