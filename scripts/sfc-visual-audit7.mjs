import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const out = 'sfc-visual-audit7';
await mkdir(out, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const browser = spawn('google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  '--remote-debugging-port=9222', '--user-data-dir=/tmp/sfc-visual-audit7',
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
  const metrics = await evaluate(cdp, `(()=>{const c=document.querySelector('canvas[aria-label$="exploration map"]');const r=c?.getBoundingClientRect();return{w:innerWidth,h:innerHeight,scroll:document.documentElement.scrollHeight,canvas:r?{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}:null,text:document.body.innerText.replace(/\\s+/g,' ').slice(0,450)}})()`);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await writeFile(`${out}/${name}.png`, Buffer.from(data, 'base64'));
  return { name, note, metrics };
}

const allFlags = ['story:openingSeen','boss:templeKeeper','boss:ironTyrant','gate:citadel'];
function saveExpression(x, y, flags = allFlags) {
  const save = {
    version: 1, screen: 'world', mapId: 'world', position: { x, y }, direction: 'down',
    hp: 20, maxHp: 20, level: 1, exp: 0, gold: 18, inventory: { herb: 1 },
    equipment: { weapon: null, armor: null, charm: null }, techniques: [], memos: [], flags,
    steps: 1, encounterClock: 99, lastSafeMap: 'hearthVillage',
  };
  return `localStorage.setItem('puzzle-rpg:rpg-mode:v1',${JSON.stringify(JSON.stringify(save))});true`;
}
async function enter(cdp) {
  await waitFor(cdp, `document.body.innerText.includes('RPG MODE')`);
  await click(cdp, 'RPG MODE'); await sleep(150); await click(cdp, 'CONTINUE');
  if (!(await waitFor(cdp, `!!document.querySelector('canvas[aria-label$="exploration map"]')`, 8000))) throw new Error('world map not visible');
  await sleep(220);
}
async function teleport(cdp, x, y, flags = allFlags) {
  await evaluate(cdp, saveExpression(x, y, flags));
  await cdp.send('Page.reload', { ignoreCache: true }); await sleep(430); await enter(cdp);
}

const records = [];
try {
  const pages = await waitJson('http://127.0.0.1:9222/json');
  const cdp = new CDP((pages.find((page) => page.type === 'page') || pages[0]).webSocketDebuggerUrl);
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 402, height: 690, deviceScaleFactor: 3, mobile: true, screenWidth: 402, screenHeight: 874 });
  await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173' });
  await waitFor(cdp, `document.body.innerText.includes('RPG MODE')`, 15000);
  await evaluate(cdp, saveExpression(8, 25)); await cdp.send('Page.reload', { ignoreCache: true }); await sleep(500); await enter(cdp);

  records.push(await shot(cdp, '01-hearth-village', 'Three-building village cluster and apron'));
  await teleport(cdp, 20, 22); records.push(await shot(cdp, '02-lake-village', 'Lake Village cluster integrated with lake/bridge'));
  await teleport(cdp, 8, 20); records.push(await shot(cdp, '03-old-temple', 'Old Temple ruined landmark'));
  await teleport(cdp, 13, 11); records.push(await shot(cdp, '04-iron-city-hall', 'Iron City fortress and Iron Hall school separation'));
  await teleport(cdp, 28, 8); records.push(await shot(cdp, '05-mirror-region', 'Mirror Town, Mirror Tower and Hour Spire silhouettes'));
  await teleport(cdp, 38, 16); records.push(await shot(cdp, '06-crimson-marsh', 'Crimson Marsh corrupted landmark footprint'));
  await teleport(cdp, 36, 7); records.push(await shot(cdp, '07-void-pass', 'Void Pass rock gate beside reconstructed ridge'));
  await teleport(cdp, 40, 4); records.push(await shot(cdp, '08-prism-citadel', 'Unlocked Prism Citadel major landmark'));
  await teleport(cdp, 40, 4, ['story:openingSeen']); records.push(await shot(cdp, '09-locked-citadel', 'Locked Citadel seal readability'));

  for (const record of records) {
    if (record.metrics.scroll !== 690) throw new Error(`${record.name}: vertical overflow ${record.metrics.scroll}`);
    if (!record.metrics.canvas || record.metrics.canvas.w < 340) throw new Error(`${record.name}: map canvas regression`);
  }
  await writeFile(`${out}/audit.json`, JSON.stringify(records, null, 2));
  cdp.ws.close();
} finally {
  browser.kill('SIGTERM');
}
