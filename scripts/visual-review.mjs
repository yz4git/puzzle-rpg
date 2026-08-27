import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const outDir = 'review-artifacts';
await mkdir(outDir, { recursive: true });
const chrome = process.env.CHROME_BIN || 'google-chrome';
const url = process.env.REVIEW_URL || 'http://127.0.0.1:5173';

const browser = spawn(chrome, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--hide-scrollbars',
  '--remote-debugging-port=9222',
  '--user-data-dir=/tmp/puzzle-rpg-review-chrome',
  '--window-size=393,852',
  'about:blank',
], { stdio: ['ignore', 'ignore', 'inherit'] });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitJson(endpoint, attempts = 60) {
  let last;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) return await response.json();
    } catch (error) { last = error; }
    await sleep(250);
  }
  throw last || new Error(`Timed out waiting for ${endpoint}`);
}

class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }
  async send(method, params = {}) {
    await this.ready;
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function shot(cdp, name) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await writeFile(`${outDir}/${name}.png`, Buffer.from(data, 'base64'));
  const body = await cdp.send('Runtime.evaluate', { expression: 'document.body.innerText', returnByValue: true });
  await writeFile(`${outDir}/${name}.txt`, body.result.value || '');
}

async function evaluate(cdp, expression) {
  return cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
}

async function pressBestTile(cdp) {
  const expression = `(() => {
    const buttons = [...document.querySelectorAll('[aria-label="cluster break board"] button')].filter((b) => !b.disabled);
    if (!buttons.length) return {ok:false, reason:'no tiles'};
    const tiles = buttons.map((b) => {
      const r = b.getBoundingClientRect();
      const label = [...b.querySelectorAll('span')].map(s => s.textContent.trim()).find(t => ['ATK','HEAL','BAR','SKIP'].includes(t)) || '';
      return { b, label, x:r.left+r.width/2, y:r.top+r.height/2 };
    });
    const xs = [...new Set(tiles.map(t => Math.round(t.x)))].sort((a,b)=>a-b);
    const ys = [...new Set(tiles.map(t => Math.round(t.y)))].sort((a,b)=>a-b);
    const grid = new Map();
    for (const t of tiles) {
      const col = xs.indexOf(Math.round(t.x)); const row = ys.indexOf(Math.round(t.y));
      t.row=row; t.col=col; grid.set(row+':'+col,t);
    }
    const seen = new Set(); const groups=[];
    for (const t of tiles) {
      const key=t.row+':'+t.col; if(seen.has(key)) continue;
      const q=[t]; const g=[];
      while(q.length){const n=q.pop(); const k=n.row+':'+n.col; if(seen.has(k)||n.label!==t.label) continue; seen.add(k); g.push(n);
        for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){const m=grid.get((n.row+dr)+':'+(n.col+dc)); if(m&&m.label===t.label) q.push(m);}
      }
      groups.push({label:t.label,size:g.length,button:g[0].b});
    }
    const hpText = document.querySelector('[aria-label="player status"]')?.innerText || '';
    const hpMatch = hpText.match(/HP\\s*(\\d+)\\/(\\d+)/); const hp = hpMatch ? Number(hpMatch[1]) : 20;
    const freeMatch = hpText.match(/FREE\\s*(\\d+)/); const free = freeMatch ? Number(freeMatch[1]) : 0;
    const score = (g) => {
      if (hp <= 8 && g.label==='HEAL') return 100 + g.size*8;
      if (g.label==='SKIP' && g.size>=2) return 80 + g.size*7;
      if (g.label==='ATK') return 60 + g.size*6;
      if (g.label==='BAR') return 45 + g.size*5;
      if (g.label==='HEAL' && hp<18) return 35 + g.size*4;
      return g.size;
    };
    groups.sort((a,b)=>score(b)-score(a)); const best=groups[0];
    best.button.focus();
    best.button.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}));
    return {ok:true,label:best.label,size:best.size,hp,free};
  })()`;
  const result = await evaluate(cdp, expression);
  return result.result.value;
}

try {
  const pages = await waitJson('http://127.0.0.1:9222/json');
  const page = pages.find((p) => p.type === 'page') || pages[0];
  const cdp = new Cdp(page.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 393, height: 852, deviceScaleFactor: 3, mobile: true,
    screenWidth: 393, screenHeight: 852,
  });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await cdp.send('Page.navigate', { url });
  await sleep(2200);
  await shot(cdp, '01-title');

  await evaluate(cdp, `Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('START GAME'))?.click()`);
  await sleep(500);
  await shot(cdp, '02-stage-intro');

  await evaluate(cdp, `Array.from(document.querySelectorAll('button')).find(b => !b.textContent.includes('START GAME'))?.click()`);
  await sleep(500);
  await shot(cdp, '03-battle-start');

  const turns = [];
  for (let i = 0; i < 8; i += 1) {
    const move = await pressBestTile(cdp);
    turns.push({ turn: i + 1, ...move });
    await sleep(1150);
    if (i === 1 || i === 4 || i === 7) await shot(cdp, `0${4 + Math.floor(i / 3)}-turn-${i + 1}`);
    const state = await evaluate(cdp, `document.body.innerText`);
    const text = state.result.value || '';
    if (text.includes('STAGE CLEAR') || text.includes('GAME OVER')) break;
  }
  await writeFile(`${outDir}/moves.json`, JSON.stringify(turns, null, 2));
  await shot(cdp, '07-final');
  cdp.ws.close();
} finally {
  browser.kill('SIGTERM');
}
