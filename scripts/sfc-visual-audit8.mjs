import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const out = 'sfc-visual-audit8';
await mkdir(out, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const browser = spawn('google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  '--remote-debugging-port=9222', '--user-data-dir=/tmp/sfc-visual-audit8',
  '--window-size=402,690', 'about:blank',
], { stdio: ['ignore', 'ignore', 'inherit'] });

async function waitJson(url) {
  for (let i = 0; i < 240; i += 1) {
    try { const response = await fetch(url); if (response.ok) return response.json(); } catch {}
    await sleep(250);
  }
  throw new Error('CDP timeout');
}
class CDP {
  constructor(url) {
    this.ws = new WebSocket(url); this.id = 0; this.pending = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data); const pending = this.pending.get(message.id);
      if (!pending) return; this.pending.delete(message.id);
      message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
    });
  }
  async send(method, params = {}) {
    await this.ready; const id = ++this.id;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
}
async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(cdp, expression, timeout = 12000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await evaluate(cdp, expression)) return true; await sleep(100); }
  return false;
}
async function click(cdp, text) {
  return evaluate(cdp, `(()=>{const e=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').includes(${JSON.stringify(text)}));if(!e)return false;e.click();return true})()`);
}
async function shot(cdp, name, note) {
  const metrics = await evaluate(cdp, `(()=>{const c=document.querySelector('canvas[aria-label$="exploration map"]');const r=c?.getBoundingClientRect();return{w:innerWidth,h:innerHeight,scroll:document.documentElement.scrollHeight,canvas:r?{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}:null,text:document.body.innerText.replace(/\\s+/g,' ').slice(0,420)}})()`);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await writeFile(`${out}/${name}.png`, Buffer.from(data, 'base64'));
  return { name, note, metrics };
}

const flags = ['story:openingSeen','boss:templeKeeper','boss:ironTyrant','boss:scarletOracle','boss:voidHerald','gate:citadel'];
function saveExpression(mapId, x, y) {
  const save = {
    version: 1, playerName: 'LIO', level: 8, exp: 0, hp: 27, maxHp: 27, gold: 118,
    mapId, position: { x, y }, direction: 'up', lastInn: { mapId: 'hearthVillage', position: { x: 8, y: 10 } },
    inventory: [{ id: 'herb', count: 2 }, { id: 'smoke', count: 1 }], inventorySlots: 4,
    equipmentOwned: ['travellerCoat'], equipment: { weapon: null, armor: null, charm: null },
    techniques: [], techniqueSlots: 2, memos: [], flags, openedChests: [], defeatedEncounters: [],
    defeatedEnemies: {}, releasedEnemies: {}, battleLog: [], steps: 120, playSeconds: 600, encounterMeter: 99,
    settings: { music: false, sfx: false },
  };
  return `localStorage.setItem('puzzle-rpg:rpg-mode:v1',${JSON.stringify(JSON.stringify(save))});true`;
}
async function enter(cdp) {
  await waitFor(cdp, `document.body.innerText.includes('RPG MODE')`);
  await click(cdp, 'RPG MODE'); await sleep(120); await click(cdp, 'CONTINUE');
  if (!(await waitFor(cdp, `!!document.querySelector('canvas[aria-label$="exploration map"]')`, 8000))) throw new Error('map not visible');
  await sleep(260);
}
async function teleport(cdp, mapId, x, y) {
  await evaluate(cdp, saveExpression(mapId, x, y));
  await cdp.send('Page.reload', { ignoreCache: true }); await sleep(400); await enter(cdp);
}

const records = [];
try {
  const pages = await waitJson('http://127.0.0.1:9222/json');
  const cdp = new CDP((pages.find((page) => page.type === 'page') || pages[0]).webSocketDebuggerUrl);
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 402, height: 690, deviceScaleFactor: 3, mobile: true, screenWidth: 402, screenHeight: 874 });
  await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173' });
  await waitFor(cdp, `document.body.innerText.includes('RPG MODE')`, 15000);

  const targets = [
    ['01-hearth-village','hearthVillage',8,10,'Warm village street, facades and town gate'],
    ['02-lake-village','lakeVillage',8,10,'Lake palette, continuous water and bridge'],
    ['03-iron-city','ironCity',8,10,'Fortress-city stone streets and walls'],
    ['04-mirror-town','mirrorTown',8,10,'Cool reflective town palette'],
    ['05-ember-shrine','emberShrine',8,8,'ATK school altar and flame identity'],
    ['06-quiet-bower','quietBower',8,8,'HEAL school green/wood identity'],
    ['07-iron-hall','ironHall',8,8,'BAR school metal identity'],
    ['08-hour-spire','hourSpire',8,8,'SKIP school clock/indigo identity'],
    ['09-old-temple','oldTemple',10,9,'Moss stone dungeon walls and paths'],
    ['10-crimson-marsh','crimsonMarsh',10,9,'Crimson dungeon hazard floor'],
    ['11-mirror-tower','mirrorTower',10,9,'Reflective blue tower floor and walls'],
    ['12-void-pass','voidPass',8,10,'Dark pass road, rock walls and exit gate'],
    ['13-prism-citadel','prismCitadel',10,15,'Violet/gold citadel interior and gate'],
  ];
  for (const [name,mapId,x,y,note] of targets) {
    await teleport(cdp, mapId, x, y);
    records.push(await shot(cdp, name, note));
  }
  for (const record of records) {
    if (record.metrics.scroll !== 690) throw new Error(`${record.name}: vertical overflow ${record.metrics.scroll}`);
    if (!record.metrics.canvas || record.metrics.canvas.w < 340) throw new Error(`${record.name}: canvas regression`);
  }
  await writeFile(`${out}/audit.json`, JSON.stringify(records, null, 2));
  cdp.ws.close();
} finally { browser.kill('SIGTERM'); }
