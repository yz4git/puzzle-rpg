import { chromium } from 'playwright';

const save = {
  version: 1,
  playerName: 'LIO',
  level: 1,
  exp: 0,
  hp: 22,
  maxHp: 22,
  gold: 18,
  mapId: 'oldTemple',
  position: { x: 10, y: 15 },
  direction: 'up',
  lastInn: { mapId: 'hearthVillage', position: { x: 8, y: 10 } },
  inventory: [{ id: 'herb', count: 2 }, { id: 'smoke', count: 1 }],
  inventorySlots: 4,
  equipmentOwned: ['travellerCoat'],
  equipment: { weapon: null, armor: 'travellerCoat', charm: null },
  techniques: [],
  techniqueSlots: 2,
  memos: [{ id: 'journey', title: '最初の旅', text: '村の長から北のOld Templeについて聞く。', read: false }],
  flags: ['story:openingSeen'],
  openedChests: [],
  defeatedEncounters: [],
  defeatedEnemies: {},
  releasedEnemies: {},
  battleLog: [],
  steps: 0,
  playSeconds: 0,
  encounterMeter: 3,
  settings: { music: false, sfx: false },
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 1 });
page.on('console', msg => { if (msg.type() === 'error') console.error('PAGE ERROR:', msg.text()); });
await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
await page.evaluate((value) => localStorage.setItem('puzzle-rpg:rpg-mode:v1', JSON.stringify(value)), save);
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: /RPG MODE/ }).click();
await page.getByRole('button', { name: /CONTINUE/ }).click();
const up = page.getByRole('button', { name: 'Move up' });
for (let i = 0; i < 3; i += 1) {
  await up.click();
  await page.waitForTimeout(180);
}
await page.locator('section[aria-label="RPG Cluster Break board"]').waitFor({ state: 'visible', timeout: 15000 });
const skip = page.locator('button[aria-label^="SKIP "]').first();
await skip.waitFor({ state: 'visible', timeout: 10000 });
await skip.click();
const overlay = page.locator('[aria-label^="Enemy time stop "]');
await overlay.waitFor({ state: 'visible', timeout: 4000 });
const enemyRow = page.locator('section:has([aria-label^="Enemy time stop "])').first();
await enemyRow.screenshot({ path: '/tmp/stopwatch-armed.jpg', type: 'jpeg', quality: 92 });
const armedLabel = await overlay.getAttribute('aria-label');
console.log('armed=', armedLabel);
const armedBox = await overlay.boundingBox();
const spriteBox = await page.locator('[role="img"][aria-label]').first().boundingBox();
console.log('armedBox=', JSON.stringify(armedBox), 'spriteBox=', JSON.stringify(spriteBox));
await page.locator('[aria-label="Enemy time stop 0"]').waitFor({ state: 'visible', timeout: 4000 });
await enemyRow.screenshot({ path: '/tmp/stopwatch-zero.jpg', type: 'jpeg', quality: 92 });
console.log('zero captured');
await browser.close();
