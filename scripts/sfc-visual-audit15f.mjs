import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const out = 'sfc-visual-audit15f';
await mkdir(out, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const browser = spawn('google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  '--remote-debugging-port=9222', '--user-data-dir=/tmp/sfc15f',
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
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function ev(cdp, expression) {
  const response = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}
async function waitFor(cdp, expression, timeout = 12000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { if (await ev(cdp, expression)) return true; } catch {}
    await sleep(100);
  }
  return false;
}
async function click(cdp, text) {
  return ev(cdp, `(()=>{const e=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').includes(${JSON.stringify(text)}));if(!e)return false;e.click();return true})()`);
}
async function pressA(cdp) {
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65 });
}
function saveExpr() {
  const save = {
    version:1, playerName:'LIO', level:1, exp:0, hp:20, maxHp:20, gold:18,
    mapId:'oldTemple', position:{x:10,y:4}, direction:'up',
    lastInn:{mapId:'hearthVillage',position:{x:8,y:10}},
    inventory:[{id:'herb',count:2},{id:'smoke',count:1}], inventorySlots:4,
    equipmentOwned:['travellerCoat'], equipment:{weapon:null,armor:null,charm:null},
    techniques:[], techniqueSlots:2, memos:[], flags:['story:openingSeen'], openedChests:[],
    defeatedEncounters:[], defeatedEnemies:{}, releasedEnemies:{}, battleLog:[], steps:8,
    playSeconds:60, encounterMeter:99, settings:{music:false,sfx:false},
  };
  return `localStorage.setItem('puzzle-rpg:rpg-mode:v1',${JSON.stringify(JSON.stringify(save))});true`;
}
async function enter(cdp) {
  await waitFor(cdp, `document.body.innerText.includes('RPG MODE')`, 15000);
  await click(cdp, 'RPG MODE'); await sleep(120); await click(cdp, 'CONTINUE');
  if (!(await waitFor(cdp, `!!document.querySelector('canvas[aria-label$="exploration map"]')`, 8000))) throw new Error('map missing');
  await sleep(260);
}
async function shot(cdp, name) {
  const metrics = await ev(cdp, `(()=>{const board=document.querySelector('[aria-label="RPG Cluster Break board"]');const next=document.querySelector('[aria-label="NEXT DROP MAP"]');const title=next?.querySelector('[class*="nextTitle"]');const br=board?.getBoundingClientRect(),nr=next?.getBoundingClientRect();return{scroll:document.documentElement.scrollHeight,board:br?{w:Math.round(br.width),h:Math.round(br.height)}:null,next:nr?{w:Math.round(nr.width),h:Math.round(nr.height)}:null,state:board?.getAttribute('data-preview')??null,classes:board?.className??'',shadow:board?getComputedStyle(board).boxShadow:null,preview:!!board?.querySelector('[class*="previewBanner"]'),label:title?getComputedStyle(title,'::before').content:null}})()`);
  const { data } = await cdp.send('Page.captureScreenshot', { format:'png', fromSurface:true });
  await writeFile(`${out}/${name}.png`, Buffer.from(data, 'base64'));
  return metrics;
}

try {
  const pages = await waitJson('http://127.0.0.1:9222/json');
  const cdp = new CDP((pages.find((page) => page.type === 'page') || pages[0]).webSocketDebuggerUrl);
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width:402, height:690, deviceScaleFactor:3, mobile:true, screenWidth:402, screenHeight:874 });
  await cdp.send('Page.navigate', { url:'http://127.0.0.1:5173' });
  await waitFor(cdp, `document.body.innerText.includes('RPG MODE')`, 15000);
  await ev(cdp, saveExpr()); await cdp.send('Page.reload', { ignoreCache:true }); await sleep(420); await enter(cdp);
  await pressA(cdp);
  if (!(await waitFor(cdp, `!!document.querySelector('[aria-label="RPG Cluster Break board"]')`, 6000))) throw new Error('fixed battle did not start');
  await sleep(260);
  const normal = await shot(cdp, '01-prism-board');
  const point = await ev(cdp, `(()=>{const e=document.querySelector('[aria-label="RPG Cluster Break board"] button:not(:disabled)');const r=e?.getBoundingClientRect();return r?{x:r.left+r.width/2,y:r.top+r.height/2}:null})()`);
  if (!point) throw new Error('cell missing');
  await cdp.send('Input.dispatchMouseEvent', { type:'mouseMoved', x:point.x, y:point.y });
  await cdp.send('Input.dispatchMouseEvent', { type:'mousePressed', x:point.x, y:point.y, button:'left', clickCount:1 });
  if (!(await waitFor(cdp, `document.querySelector('[aria-label="RPG Cluster Break board"]')?.getAttribute('data-preview')==='true'`, 1500))) throw new Error('preview state missing');
  await sleep(180);
  const preview = await shot(cdp, '02-prism-preview');
  await cdp.send('Input.dispatchMouseEvent', { type:'mouseReleased', x:point.x, y:point.y, button:'left', clickCount:1 });

  if (normal.scroll !== 690 || preview.scroll !== 690) throw new Error(`overflow ${normal.scroll}/${preview.scroll}`);
  for (const [name, metrics] of [['normal', normal], ['preview', preview]]) {
    if (metrics.board?.w !== 360 || metrics.board?.h !== 360) throw new Error(`${name}: board size ${JSON.stringify(metrics.board)}`);
    if (!metrics.next || metrics.next.w < 350) throw new Error(`${name}: next map shrank`);
    if (!String(metrics.label).includes('PRISM')) throw new Error(`${name}: PRISM label missing ${metrics.label}`);
    if (!metrics.classes.includes('prismBoard')) throw new Error(`${name}: prismBoard class missing ${metrics.classes}`);
  }
  if (normal.state !== 'false' || preview.state !== 'true' || !preview.preview) throw new Error(`preview mismatch ${normal.state}/${preview.state}/${preview.preview}`);
  if (!preview.classes.includes('prismPreview')) throw new Error(`prismPreview class missing ${preview.classes}`);
  if (normal.shadow === preview.shadow) throw new Error(`housing highlight missing: ${normal.shadow}`);
  await writeFile(`${out}/audit.json`, JSON.stringify({ normal, preview }, null, 2));
  cdp.ws.close();
} finally {
  browser.kill('SIGTERM');
}
