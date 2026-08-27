import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const OUT = 'qa-samegame-review';
await fs.mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 402, height: 874 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(`console:${m.text()}`); });
page.on('pageerror', e => errors.push(`page:${e.message}`));
const wait = ms => new Promise(r => setTimeout(r, ms));
const shot = async name => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });

function parsePanels(rows) {
  const out = [];
  for (const x of rows) {
    const m = x.label.match(/^(ATK|HEAL|BAR|SKIP) panel row (-?\d+) column (-?\d+)$/);
    if (!m) continue;
    out.push({ type: m[1], row: Number(m[2]) - 1, col: Number(m[3]) - 1, label: x.label });
  }
  return out.filter(x => x.row >= 0 && x.col >= 0);
}
function groups(panels) {
  const map = new Map(panels.map(p => [`${p.row}:${p.col}`, p]));
  const seen = new Set();
  const list = [];
  for (const p of panels) {
    const key = `${p.row}:${p.col}`;
    if (seen.has(key)) continue;
    const q = [p], cells = [];
    while (q.length) {
      const cur = q.pop();
      const ck = `${cur.row}:${cur.col}`;
      if (seen.has(ck) || cur.type !== p.type) continue;
      seen.add(ck); cells.push(cur);
      for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const n = map.get(`${cur.row+dr}:${cur.col+dc}`);
        if (n && n.type === p.type && !seen.has(`${n.row}:${n.col}`)) q.push(n);
      }
    }
    list.push({ type:p.type, size:cells.length, seed:cells[0], cells });
  }
  return list;
}
async function readPanels() {
  const rows = await page.locator('button[aria-label*=" panel row "]').evaluateAll(bs => bs.map(b => ({ label: b.getAttribute('aria-label') || '' })));
  return parsePanels(rows);
}
async function readState() {
  return page.evaluate(() => {
    const body = document.body.textContent || '';
    const player = document.querySelector('[aria-label="player status"]')?.textContent || '';
    const enemyStage = document.querySelector('main section:nth-of-type(1)')?.textContent || '';
    const stage = Number(body.match(/STAGE\s+(\d+)/)?.[1] || 0);
    const turn = Number(body.match(/TURN\s+(\d+)/)?.[1] || 0);
    const hp = Number(player.match(/HP\s*(\d+)\/20/)?.[1] || 0);
    const bar = Number(player.match(/BAR\s*(\d+)\/20/)?.[1] || 0);
    const free = Number(player.match(/FREE\s*(\d+)/)?.[1] || 0);
    const enemyHp = Number(enemyStage.match(/HP\s*(\d+)\s*\//)?.[1] || 0);
    const status = document.querySelector('[role="status"]')?.textContent || '';
    return { stage, turn, hp, bar, free, enemyHp, status,
      intro: !!document.querySelector('[role="dialog"][aria-label^="Stage "]'),
      clear: !!document.querySelector('[role="dialog"][aria-label="Stage Clear"]'),
      gameOver: !!document.querySelector('[aria-label="Game Over"]') };
  });
}
async function waitReady() {
  for (let i=0;i<80;i++) {
    if (await page.locator('[aria-label="Game Over"]').count()) return;
    if (await page.locator('[role="dialog"][aria-label="Stage Clear"]').count()) return;
    if (await page.locator('[role="dialog"][aria-label^="Stage "]').count()) return;
    const buttons = page.locator('button[aria-label*=" panel row "]');
    const count = await buttons.count();
    const disabled = count ? await buttons.evaluateAll(bs => bs.filter(b => b.disabled).length) : 0;
    if (count === 36 && disabled === 0) { await wait(80); return; }
    await wait(80);
  }
}
async function clickGroup(g) {
  const label = `${g.type} panel row ${g.seed.row+1} column ${g.seed.col+1}`;
  await page.locator(`button[aria-label="${label}"]`).click({ force:true });
}

await page.goto('http://127.0.0.1:4173', { waitUntil:'networkidle', timeout:60000 });
await page.waitForSelector('[aria-label="Puzzle RPG title"]', { timeout:30000 });
await shot('00-title');
await page.getByRole('button',{name:/START GAME/}).click();
await page.waitForSelector('[role="dialog"][aria-label^="Stage "]');
await shot('01-intro');
await page.locator('[role="dialog"][aria-label^="Stage "]').click({ position:{x:25,y:25}, force:true });
await page.waitForSelector('[aria-label="samegame board"]');
await waitReady();
await shot('02-battle');

const report = { viewport:{w:402,h:874}, errors, turns:[], singletonTest:null, skipEvents:[], screenshots:[], metrics:null };

// Explicitly test that a singleton is legal.
let ps = await readPanels();
let gs = groups(ps);
let single = gs.find(g => g.size === 1);
if (single) {
  const before = await readState();
  await clickGroup(single);
  await wait(120);
  await shot('03-singleton-action');
  await waitReady();
  const after = await readState();
  report.singletonTest = { type:single.type, before, after };
}

for (let step=1; step<=30; step++) {
  let st = await readState();
  if (st.gameOver) { await shot('90-game-over'); break; }
  if (st.clear) {
    await shot(`stage-${st.stage}-clear`);
    report.screenshots.push(`stage-${st.stage}-clear`);
    const btn = page.getByRole('button',{name:/NEXT STAGE/});
    if (await btn.count()) { await btn.click(); await wait(120); }
    if (await page.locator('[role="dialog"][aria-label^="Stage "]').count()) {
      await shot(`stage-${st.stage+1}-intro`);
      await page.locator('[role="dialog"][aria-label^="Stage "]').click({ position:{x:25,y:25}, force:true });
      await waitReady();
      st = await readState();
    }
  }
  if (st.intro) {
    await page.locator('[role="dialog"][aria-label^="Stage "]').click({ position:{x:25,y:25}, force:true });
    await waitReady();
    st = await readState();
  }
  ps = await readPanels(); gs = groups(ps);
  const maxBy = Object.fromEntries(['ATK','HEAL','BAR','SKIP'].map(t => [t, Math.max(0,...gs.filter(g=>g.type===t).map(g=>g.size))]));
  const skip = [...gs].filter(g=>g.type==='SKIP' && g.size>=2).sort((a,b)=>b.size-a.size)[0];
  const heal = [...gs].filter(g=>g.type==='HEAL').sort((a,b)=>b.size-a.size)[0];
  const bar = [...gs].filter(g=>g.type==='BAR').sort((a,b)=>b.size-a.size)[0];
  const atk = [...gs].filter(g=>g.type==='ATK').sort((a,b)=>b.size-a.size)[0];
  let choice;
  if (skip && (skip.size >= 3 || st.free === 0)) choice = skip;
  else if (st.hp <= 9 && heal) choice = heal;
  else if ((st.hp <= 12 || st.bar <= 2) && bar && bar.size >= 2) choice = bar;
  else if (atk) choice = atk;
  else choice = [...gs].sort((a,b)=>b.size-a.size)[0];
  if (!choice) break;

  const before = await readState();
  report.turns.push({ step, before, largest:maxBy, choice:{type:choice.type,size:choice.size} });
  if (choice.type==='SKIP' && choice.size>=2) report.skipEvents.push({step,size:choice.size,before});
  await clickGroup(choice);
  await wait(90);
  if (step===1) await shot('04-first-strategy-action');
  if (choice.type==='SKIP' && choice.size>=3 && !report.screenshots.includes('big-skip')) {
    await shot('05-big-skip'); report.screenshots.push('big-skip');
  }
  if (choice.size>=8 && !report.screenshots.includes('massive')) {
    await shot('06-massive'); report.screenshots.push('massive');
  }
  await waitReady();
  const after = await readState();
  report.turns[report.turns.length-1].after = after;
  if (after.hp <= 7 && after.hp > 0 && !report.screenshots.includes('danger')) {
    await shot('07-danger'); report.screenshots.push('danger');
  }
}

await shot('99-final');
report.final = await readState();
report.metrics = await page.evaluate(() => {
  const board = document.querySelector('[aria-label="samegame board"]')?.getBoundingClientRect();
  const tiles = [...document.querySelectorAll('button[aria-label*=" panel row "]')].map(x=>x.getBoundingClientRect());
  return {
    bodyScrollHeight: document.body.scrollHeight,
    innerHeight: window.innerHeight,
    bodyClientHeight: document.body.clientHeight,
    board: board ? {x:board.x,y:board.y,w:board.width,h:board.height,bottom:board.bottom} : null,
    tileCount: tiles.length,
    minTileW: tiles.length ? Math.min(...tiles.map(r=>r.width)) : 0,
    minTileH: tiles.length ? Math.min(...tiles.map(r=>r.height)) : 0,
  };
});
await fs.writeFile(`${OUT}/report.json`, JSON.stringify(report,null,2));
await browser.close();
console.log(JSON.stringify(report,null,2));
