import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const out = 'rpg-early-review';
await mkdir(out, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const browser = spawn('google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  '--remote-debugging-port=9222', '--user-data-dir=/tmp/rpg-early-review',
  '--window-size=402,690', 'about:blank',
], { stdio: ['ignore', 'ignore', 'inherit'] });

async function waitJson(url) {
  for (let i = 0; i < 240; i += 1) {
    try { const r = await fetch(url); if (r.ok) return r.json(); } catch {}
    await sleep(250);
  }
  throw new Error(`timeout: ${url}`);
}
class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl); this.id = 0; this.pending = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data); const pending = this.pending.get(msg.id); if (!pending) return;
      this.pending.delete(msg.id); msg.error ? pending.reject(new Error(msg.error.message)) : pending.resolve(msg.result);
    });
  }
  async send(method, params = {}) {
    await this.ready; const id = ++this.id;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
}
async function ev(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'evaluate failed');
  return result.result.value;
}
async function waitFor(cdp, expression, timeout = 10000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await ev(cdp, expression)) return true; await sleep(100); }
  return false;
}
const records = [];
async function shot(cdp, name, note = '') {
  const metrics = await ev(cdp, `(()=>({
    url: location.href,
    width: innerWidth, height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    bodyText: document.body.innerText.replace(/\\s+/g,' ').trim().slice(0,900),
    canvas: (()=>{const e=document.querySelector('canvas'); if(!e)return null; const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}})(),
    board: (()=>{const e=document.querySelector('[aria-label="RPG Cluster Break board"]'); if(!e)return null; const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}})()
  }))()`);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await writeFile(`${out}/${name}.png`, Buffer.from(data, 'base64'));
  records.push({ name, note, metrics });
}
async function clickText(cdp, text) {
  return ev(cdp, `(()=>{const t=${JSON.stringify(text)};const b=Array.from(document.querySelectorAll('button')).find(e=>(e.innerText||'').includes(t));if(!b)return false;b.click();return true})()`);
}
async function key(cdp, keyName, pause = 110) {
  await ev(cdp, `(()=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(keyName)},bubbles:true,cancelable:true}));return true})()`);
  await sleep(pause);
}
async function saveState(cdp) {
  return ev(cdp, `(()=>{try{return JSON.parse(localStorage.getItem('puzzle-rpg:rpg-mode:v1')||'null')}catch{return null}})()`);
}
async function boardGroups(cdp) {
  return ev(cdp, `(()=>{
    const els=Array.from(document.querySelectorAll('[aria-label="RPG Cluster Break board"] button:not(:disabled)'));
    const tiles=els.map(el=>{const l=el.getAttribute('aria-label')||'';const m=l.match(/^(ATK|HEAL|BAR|SKIP) row (\\d+) column (\\d+)/);if(!m)return null;const r=el.getBoundingClientRect();return{type:m[1],row:+m[2]-1,col:+m[3]-1,label:l,x:r.left+r.width/2,y:r.top+r.height/2}}).filter(Boolean);
    const map=new Map(tiles.map(t=>[t.row+':'+t.col,t])),seen=new Set(),groups=[];
    for(const t of tiles){const k=t.row+':'+t.col;if(seen.has(k))continue;seen.add(k);const stack=[t],members=[];while(stack.length){const c=stack.pop();members.push(c);for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){const nk=(c.row+dr)+':'+(c.col+dc),n=map.get(nk);if(n&&n.type===t.type&&!seen.has(nk)){seen.add(nk);stack.push(n)}}}groups.push({type:t.type,count:members.length,seed:members[0]})}return groups;
  })()`);
}
async function activateGroup(cdp, group) {
  const { x, y } = group.seed;
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await sleep(90);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}
function chooseGroup(groups, bodyText) {
  const hpMatch = bodyText.match(/HP\s+(\d+)\/(\d+)/g) || [];
  const player = hpMatch.length > 1 ? +(hpMatch[1].match(/\d+/)?.[0] || 20) : 20;
  return [...groups].map((g) => {
    let score = g.count * 4;
    if (g.type === 'ATK') score += 15 + g.count * 2;
    if (g.type === 'SKIP' && g.count >= 2) score += 18 + g.count * 2;
    if (g.type === 'HEAL') score += player <= 12 ? 28 + g.count * 2 : 2;
    if (g.type === 'BAR') score += player <= 14 ? 17 + g.count : 5;
    return { ...g, score };
  }).sort((a, b) => b.score - a.score || b.count - a.count)[0];
}

const consoleIssues = [];
try {
  const pages = await waitJson('http://127.0.0.1:9222/json');
  const cdp = new Cdp((pages.find((p) => p.type === 'page') || pages[0]).webSocketDebuggerUrl);
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Log.enable');
  cdp.ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.exceptionThrown') consoleIssues.push({ type: 'exception', text: msg.params?.exceptionDetails?.text || '' });
    if (msg.method === 'Log.entryAdded' && ['error','warning'].includes(msg.params?.entry?.level)) consoleIssues.push({ type: msg.params.entry.level, text: msg.params.entry.text });
  });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 402, height: 690, deviceScaleFactor: 3, mobile: true, screenWidth: 402, screenHeight: 874 });
  await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173' });
  await waitFor(cdp, `document.body.innerText.includes('RPG MODE')`, 15000);
  await ev(cdp, `localStorage.removeItem('puzzle-rpg:rpg-mode:v1'); true`);
  await cdp.send('Page.reload', { ignoreCache: true }); await sleep(900);
  await shot(cdp, '01-title', 'Mode-select title');

  await clickText(cdp, 'RPG MODE'); await sleep(250);
  await shot(cdp, '02-new-game-choice', 'RPG continue/new-game panel');
  await clickText(cdp, 'NEW GAME'); await sleep(500);
  await shot(cdp, '03-opening-dialogue', 'Opening story dialogue');

  for (let i = 0; i < 12; i += 1) {
    const hasDialogue = await ev(cdp, `document.body.innerText.includes('A / TAP')`);
    if (!hasDialogue) break;
    await key(cdp, 'a', 100);
  }
  await sleep(350);
  await shot(cdp, '04-start-village', 'First controllable Hearth Village screen');
  records.push({ checkpoint: 'startSave', save: await saveState(cdp) });

  // Walk to the nearby old traveller and talk: U, L, L, U(block/faces NPC), A.
  for (const k of ['ArrowUp','ArrowLeft','ArrowLeft','ArrowUp']) await key(cdp, k);
  await key(cdp, 'a', 160);
  await shot(cdp, '05-first-npc', 'Early NPC conversation and information delivery');
  for (let i = 0; i < 8; i += 1) {
    if (!(await ev(cdp, `document.body.innerText.includes('A / TAP')`))) break;
    await key(cdp, 'a', 90);
  }
  await key(cdp, 'b', 180);
  await shot(cdp, '06-field-menu', 'Field menu opened with B');
  await clickText(cdp, 'MEMO'); await sleep(180);
  await shot(cdp, '07-memo', 'Memo tab after talking to NPC');
  await clickText(cdp, 'B • CLOSE'); await sleep(180);

  // Move from (6,9) to face the village exit at (8,12), then interact.
  for (const k of ['ArrowRight','ArrowRight','ArrowDown','ArrowDown']) await key(cdp, k);
  await key(cdp, 'a', 350);
  records.push({ checkpoint: 'afterExit', save: await saveState(cdp) });
  await shot(cdp, '08-world-map', 'First arrival on Prism Road');

  // Leave the road and walk through grass until the first natural encounter.
  await key(cdp, 'ArrowDown', 120);
  for (let i = 0; i < 28; i += 1) {
    if (await ev(cdp, `!!document.querySelector('[aria-label="RPG Cluster Break board"]')`)) break;
    await key(cdp, 'ArrowRight', 95);
  }
  await waitFor(cdp, `!!document.querySelector('[aria-label="RPG Cluster Break board"]')`, 4000);
  if (await ev(cdp, `!!document.querySelector('[aria-label="RPG Cluster Break board"]')`)) {
    await sleep(350);
    await shot(cdp, '09-first-encounter', 'First natural RPG puzzle battle');
    await clickText(cdp, 'RPG COMMAND'); await sleep(160);
    await shot(cdp, '10-rpg-command', 'Battle RPG command menu');
    await clickText(cdp, 'STATUS'); await sleep(160);
    await shot(cdp, '11-battle-status', 'No-turn enemy/status information');
    await clickText(cdp, 'BACK'); await sleep(100);
    await clickText(cdp, 'TALK'); await sleep(1100);
    await shot(cdp, '12-after-talk', 'Enemy reaction after TALK and enemy turn');

    for (let turn = 0; turn < 7; turn += 1) {
      if (await ev(cdp, `document.body.innerText.includes('VICTORY')||document.body.innerText.includes('ANOTHER ANSWER')||document.body.innerText.includes('YOU AWAKEN')||document.body.innerText.includes('ESCAPED')`)) break;
      const groups = await boardGroups(cdp); if (!groups.length) break;
      const bodyText = await ev(cdp, `document.body.innerText`); const chosen = chooseGroup(groups, bodyText); if (!chosen) break;
      records.push({ checkpoint: `turn-${turn+1}`, chosen: { type: chosen.type, count: chosen.count }, text: bodyText.replace(/\\s+/g,' ').slice(0,500) });
      await activateGroup(cdp, chosen); await sleep(1050);
      if (turn === 0 || turn === 3) await shot(cdp, `13-battle-turn-${turn+1}`, `Puzzle battle after turn ${turn+1}`);
    }
    const resultVisible = await ev(cdp, `document.body.innerText.includes('VICTORY')||document.body.innerText.includes('ANOTHER ANSWER')||document.body.innerText.includes('YOU AWAKEN')||document.body.innerText.includes('ESCAPED')`);
    if (resultVisible) {
      await shot(cdp, '14-battle-result', 'First battle result and RPG rewards');
      await clickText(cdp, 'CONTINUE'); await sleep(300);
      await shot(cdp, '15-return-to-world', 'Returned to overworld after first battle');
    } else {
      await shot(cdp, '14-early-battle-stop', 'Stopped after representative early turns as requested');
    }
  } else {
    records.push({ error: 'No natural encounter reached', save: await saveState(cdp) });
    await shot(cdp, '09-no-encounter', 'No encounter reached in review walk');
  }

  records.push({ checkpoint: 'finalSave', save: await saveState(cdp), consoleIssues });
  await writeFile(`${out}/review.json`, JSON.stringify(records, null, 2));
  cdp.ws.close();
} finally {
  browser.kill('SIGTERM');
}
