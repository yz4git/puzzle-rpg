import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const out = 'sfc-visual-audit9';
await mkdir(out, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const browser = spawn('google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  '--remote-debugging-port=9222', '--user-data-dir=/tmp/sfc9', '--window-size=402,690', 'about:blank',
], { stdio: ['ignore', 'ignore', 'inherit'] });

async function waitJson(url) {
  for (let i = 0; i < 240; i += 1) {
    try { const r = await fetch(url); if (r.ok) return r.json(); } catch {}
    await sleep(250);
  }
  throw new Error('CDP timeout');
}
class CDP {
  constructor(url) {
    this.ws = new WebSocket(url); this.id = 0; this.pending = new Map();
    this.ready = new Promise((resolve, reject) => { this.ws.addEventListener('open', resolve, { once: true }); this.ws.addEventListener('error', reject, { once: true }); });
    this.ws.addEventListener('message', (event) => { const m = JSON.parse(event.data); const p = this.pending.get(m.id); if (!p) return; this.pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); });
  }
  async send(method, params = {}) { await this.ready; const id = ++this.id; return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); }); }
}
async function evaluate(cdp, expression) { const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; }
async function waitFor(cdp, expression, timeout = 12000) { const end = Date.now() + timeout; while (Date.now() < end) { if (await evaluate(cdp, expression)) return true; await sleep(100); } return false; }
async function click(cdp, text) { return evaluate(cdp, `(()=>{const e=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').includes(${JSON.stringify(text)}));if(!e)return false;e.click();return true})()`); }
async function shot(cdp, name, note) {
  const metrics = await evaluate(cdp, `(()=>{const c=document.querySelector('canvas[aria-label$="exploration map"]');const r=c?.getBoundingClientRect();const box=document.querySelector('[data-portrait]');return{scroll:document.documentElement.scrollHeight,canvas:r?{w:Math.round(r.width),h:Math.round(r.height)}:null,portrait:box?.getAttribute('data-portrait')??null,text:document.body.innerText.replace(/\\s+/g,' ').slice(0,430)}})()`);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await writeFile(`${out}/${name}.png`, Buffer.from(data, 'base64'));
  return { name, note, metrics };
}

const flags = ['story:openingSeen'];
function saveExpr(mapId, x, y, direction, useFlags = flags) {
  const save = {
    version:1, playerName:'LIO', level:1, exp:0, hp:20, maxHp:20, gold:18,
    mapId, position:{x,y}, direction, lastInn:{mapId:'hearthVillage',position:{x:8,y:10}},
    inventory:[{id:'herb',count:2},{id:'smoke',count:1}], inventorySlots:4,
    equipmentOwned:['travellerCoat'], equipment:{weapon:null,armor:null,charm:null}, techniques:[], techniqueSlots:2,
    memos:[], flags:useFlags, openedChests:[], defeatedEncounters:[], defeatedEnemies:{}, releasedEnemies:{}, battleLog:[],
    steps:8, playSeconds:60, encounterMeter:99, settings:{music:false,sfx:false},
  };
  return `localStorage.setItem('puzzle-rpg:rpg-mode:v1',${JSON.stringify(JSON.stringify(save))});true`;
}
async function enter(cdp) {
  await waitFor(cdp, `document.body.innerText.includes('RPG MODE')`, 15000);
  await click(cdp, 'RPG MODE'); await sleep(120); await click(cdp, 'CONTINUE');
  if (!(await waitFor(cdp, `!!document.querySelector('canvas[aria-label$="exploration map"]')`, 8000))) throw new Error('map missing');
  await sleep(260);
}
async function teleport(cdp, mapId, x, y, direction='up') {
  await evaluate(cdp, saveExpr(mapId,x,y,direction)); await cdp.send('Page.reload',{ignoreCache:true}); await sleep(400); await enter(cdp);
}
async function talkAndShot(cdp, name, note, expectedName) {
  if (!(await waitFor(cdp, `document.body.innerText.includes(${JSON.stringify(expectedName)}) || !!document.querySelector('canvas[aria-label$="exploration map"]')`, 2000))) throw new Error('target context missing');
  await click(cdp,'CHECK');
  if (!(await waitFor(cdp, `document.body.innerText.includes(${JSON.stringify(expectedName)}) && !!document.querySelector('[data-portrait="true"]')`, 4000))) throw new Error(`${expectedName}: portrait dialog missing`);
  return shot(cdp,name,note);
}

const records=[];
try {
  const pages=await waitJson('http://127.0.0.1:9222/json');
  const cdp=new CDP((pages.find(p=>p.type==='page')||pages[0]).webSocketDebuggerUrl);
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:402,height:690,deviceScaleFactor:3,mobile:true,screenWidth:402,screenHeight:874});
  await cdp.send('Page.navigate',{url:'http://127.0.0.1:5173'});
  await waitFor(cdp,`document.body.innerText.includes('RPG MODE')`,15000);

  await teleport(cdp,'hearthVillage',9,5,'up');
  records.push(await shot(cdp,'01-elder-target','Elder directly ahead: talk marker and staff prop'));
  records.push(await talkAndShot(cdp,'02-elder-dialogue','Elder portrait dialogue','村の長'));

  await teleport(cdp,'hearthVillage',14,6,'up');
  records.push(await shot(cdp,'03-merchant-target','Merchant role props and talk marker'));
  records.push(await talkAndShot(cdp,'04-merchant-dialogue','Merchant portrait dialogue','旅商人'));

  await teleport(cdp,'hearthVillage',7,10,'down');
  records.push(await shot(cdp,'05-soldier-target','Soldier spear prop and talk marker'));
  records.push(await talkAndShot(cdp,'06-soldier-dialogue','Soldier portrait dialogue','街道番'));

  await teleport(cdp,'lakeVillage',9,5,'up');
  records.push(await shot(cdp,'07-priest-target','Priest herb prop and talk marker'));
  records.push(await talkAndShot(cdp,'08-priest-dialogue','Priest portrait dialogue','湖の癒し手'));

  await teleport(cdp,'emberShrine',8,5,'up');
  records.push(await shot(cdp,'09-master-target','Master crest and talk marker'));
  records.push(await talkAndShot(cdp,'10-master-dialogue','Master portrait dialogue','炎の師イグナ'));

  // Opening/system dialogue must remain portrait-free.
  await evaluate(cdp, `localStorage.removeItem('puzzle-rpg:rpg-mode:v1');true`);
  await cdp.send('Page.reload',{ignoreCache:true}); await sleep(450);
  await click(cdp,'RPG MODE'); await sleep(120); await click(cdp,'NEW GAME');
  await waitFor(cdp, `!!document.querySelector('[data-portrait="false"]')`, 4000);
  records.push(await shot(cdp,'11-opening-no-portrait','Story/system opening remains portrait-free'));

  for (const record of records) {
    if (record.metrics.scroll !== 690) throw new Error(`${record.name}: overflow ${record.metrics.scroll}`);
    if (record.metrics.canvas && record.metrics.canvas.w < 340) throw new Error(`${record.name}: canvas regression`);
  }
  await writeFile(`${out}/audit.json`,JSON.stringify(records,null,2));
  cdp.ws.close();
} finally { browser.kill('SIGTERM'); }
