import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const out = 'sfc-visual-audit11';
await mkdir(out, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const browser = spawn('google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  '--remote-debugging-port=9222', '--user-data-dir=/tmp/sfc11', '--window-size=402,690', 'about:blank',
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
    this.ready = new Promise((resolve, reject) => { this.ws.addEventListener('open', resolve, { once:true }); this.ws.addEventListener('error', reject, { once:true }); });
    this.ws.addEventListener('message', (event) => { const m = JSON.parse(event.data); const p = this.pending.get(m.id); if (!p) return; this.pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); });
  }
  async send(method, params = {}) { await this.ready; const id = ++this.id; return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); }); }
}
async function evaluate(cdp, expression) { const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise:true, returnByValue:true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; }
async function waitFor(cdp, expression, timeout = 12000) { const end = Date.now() + timeout; while (Date.now() < end) { if (await evaluate(cdp, expression)) return true; await sleep(100); } return false; }
async function click(cdp, text) { return evaluate(cdp, `(()=>{const e=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').includes(${JSON.stringify(text)}));if(!e)return false;e.click();return true})()`); }
async function pointer(cdp, text) { return evaluate(cdp, `(()=>{const e=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').includes(${JSON.stringify(text)}));if(!e)return false;e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1,pointerType:'touch',isPrimary:true}));return true})()`); }
async function shot(cdp, name, note) {
  const metrics = await evaluate(cdp, `(()=>{const box=document.querySelector('[data-portrait="true"]');const portrait=document.querySelector('[data-portrait="true"] i');const r=portrait?.getBoundingClientRect();return{scroll:document.documentElement.scrollHeight,portrait:r?{w:Math.round(r.width),h:Math.round(r.height)}:null,sprite:portrait?.getAttribute('data-sprite')??null,text:document.body.innerText.replace(/\\s+/g,' ').slice(0,300)}})()`);
  const { data } = await cdp.send('Page.captureScreenshot', { format:'png', fromSurface:true });
  await writeFile(`${out}/${name}.png`, Buffer.from(data, 'base64'));
  return { name, note, metrics };
}
function saveExpr(mapId, x, y, direction) {
  const save = {version:1,playerName:'LIO',level:1,exp:0,hp:20,maxHp:20,gold:18,mapId,position:{x,y},direction,lastInn:{mapId:'hearthVillage',position:{x:8,y:10}},inventory:[{id:'herb',count:2},{id:'smoke',count:1}],inventorySlots:4,equipmentOwned:['travellerCoat'],equipment:{weapon:null,armor:null,charm:null},techniques:[],techniqueSlots:2,memos:[],flags:['story:openingSeen'],openedChests:[],defeatedEncounters:[],defeatedEnemies:{},releasedEnemies:{},battleLog:[],steps:8,playSeconds:60,encounterMeter:99,settings:{music:false,sfx:false}};
  return `localStorage.setItem('puzzle-rpg:rpg-mode:v1',${JSON.stringify(JSON.stringify(save))});true`;
}
async function enter(cdp) {
  await waitFor(cdp, `document.body.innerText.includes('RPG MODE')`, 15000);
  await click(cdp, 'RPG MODE'); await sleep(120); await click(cdp, 'CONTINUE');
  if (!(await waitFor(cdp, `!!document.querySelector('canvas[aria-label$="exploration map"]')`, 8000))) throw new Error('map missing');
  await sleep(250);
}
async function talk(cdp, mapId, x, y, direction, name, file) {
  await evaluate(cdp, saveExpr(mapId,x,y,direction)); await cdp.send('Page.reload',{ignoreCache:true}); await sleep(420); await enter(cdp);
  await pointer(cdp,'CHECK');
  if (!(await waitFor(cdp, `document.body.innerText.includes(${JSON.stringify(name)}) && !!document.querySelector('[data-portrait="true"]')`, 4000))) throw new Error(`${name}: portrait missing`);
  return shot(cdp,file,`${name} upper-body portrait crop`);
}

const records=[];
try {
  const pages=await waitJson('http://127.0.0.1:9222/json');
  const cdp=new CDP((pages.find(p=>p.type==='page')||pages[0]).webSocketDebuggerUrl);
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:402,height:690,deviceScaleFactor:3,mobile:true,screenWidth:402,screenHeight:874});
  await cdp.send('Page.navigate',{url:'http://127.0.0.1:5173'});
  await waitFor(cdp,`document.body.innerText.includes('RPG MODE')`,15000);
  records.push(await talk(cdp,'hearthVillage',9,5,'up','村の長','01-elder-dialogue'));
  records.push(await talk(cdp,'hearthVillage',14,6,'up','旅商人','02-merchant-dialogue'));
  records.push(await talk(cdp,'hearthVillage',7,10,'down','街道番','03-soldier-dialogue'));
  records.push(await talk(cdp,'emberShrine',8,5,'up','炎の師イグナ','04-master-dialogue'));
  for (const record of records) {
    if (record.metrics.scroll !== 690) throw new Error(`${record.name}: overflow ${record.metrics.scroll}`);
    if (!record.metrics.portrait || record.metrics.portrait.w !== 48 || record.metrics.portrait.h !== 64) throw new Error(`${record.name}: portrait frame regression`);
  }
  await writeFile(`${out}/audit.json`,JSON.stringify(records,null,2));
  cdp.ws.close();
} finally { browser.kill('SIGTERM'); }
