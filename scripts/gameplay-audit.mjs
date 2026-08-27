import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const outDir = 'review-artifacts';
await mkdir(outDir, { recursive: true });
const chrome = process.env.CHROME_BIN || 'google-chrome';
const url = process.env.REVIEW_URL || 'http://127.0.0.1:5173';
const browser = spawn(chrome, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  '--remote-debugging-port=9222', '--user-data-dir=/tmp/puzzle-rpg-gameplay-audit',
  '--window-size=402,690', 'about:blank'
], { stdio: ['ignore', 'ignore', 'inherit'] });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitJson(endpoint) {
  for (let i = 0; i < 80; i += 1) {
    try { const r = await fetch(endpoint); if (r.ok) return await r.json(); } catch {}
    await sleep(250);
  }
  throw new Error('CDP timeout');
}
class Cdp {
  constructor(ws) {
    this.ws = new WebSocket(ws); this.id = 0; this.pending = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data); if (!message.id) return;
      const pending = this.pending.get(message.id); if (!pending) return;
      this.pending.delete(message.id);
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
async function evalJs(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  return result.result.value;
}
async function shot(cdp, name) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await writeFile(`${outDir}/${name}.png`, Buffer.from(data, 'base64'));
}
function pad(value) { return String(value).padStart(2, '0'); }
function scoreGroup(group, state) {
  const count = group.count;
  if (group.type === 'ATK') return count * 3 + (count >= state.enemyHp ? 80 : 0) + (count >= 6 ? 8 : 0);
  if (group.type === 'SKIP') return count >= 2 ? count * 4.2 + 7 : 1.2;
  if (group.type === 'HEAL') {
    const effective = Math.min(count, Math.max(0, 20 - state.hp));
    return effective * 4 + (state.hp <= 10 ? 12 : 0) + count * 0.15;
  }
  if (group.type === 'BAR') {
    const effective = Math.min(count, Math.max(0, 20 - state.bar));
    const dangerBonus = state.free === 0 && state.intentPower > state.bar ? 8 : 0;
    return effective * 2.2 + dangerBonus + (count >= 6 ? 4 : 0);
  }
  return count;
}

const stateExpr = `(() => {
  const text = (el) => (el?.textContent || '').replace(/\\s+/g, ' ').trim();
  const top = text(document.querySelector('[class*="topBar"]'));
  const stage = +(top.match(/STAGE\\s+(\\d+)/)?.[1] || 0);
  const turn = +(top.match(/TURN\\s+(\\d+)/)?.[1] || 0);
  const enemy = document.querySelector('[class*="enemyStage"]');
  const enemyName = text(enemy?.querySelector('strong'));
  const hpLine = Array.from(enemy?.querySelectorAll('span') || []).map(text).find(t => /^HP\\s+\\d+/.test(t)) || '';
  const enemyHp = +(hpLine.match(/HP\\s+(\\d+)/)?.[1] || 0);
  const enemyMax = +(hpLine.match(/\\/\\s*(\\d+)/)?.[1] || 0);
  const player = document.querySelector('[aria-label="player status"]');
  const boxes = Array.from(player?.children || []);
  const number = (box) => +(text(box?.querySelector('strong')).match(/-?\\d+/)?.[0] || 0);
  const hp = number(boxes[0]); const bar = number(boxes[1]); const free = number(boxes[2]);
  const now = document.querySelector('[class*="intentNow"]');
  const intentLabel = text(now?.querySelector('strong'));
  const intentPower = +(text(now?.querySelector('em')).match(/\\d+/)?.[0] || 0);
  const tiles = Array.from(document.querySelectorAll('[aria-label="cluster break board"] button')).map((el) => {
    const label = el.getAttribute('aria-label') || '';
    const m = label.match(/^(ATK|HEAL|BAR|SKIP) panel row (-?\\d+) column (\\d+)/);
    return m ? { label, type:m[1], row:+m[2]-1, col:+m[3]-1, disabled:el.disabled } : null;
  }).filter(Boolean).filter(t => t.row >= 0 && !t.disabled);
  const map = new Map(tiles.map(t => [t.row+':'+t.col, t]));
  const seen = new Set(); const groups = [];
  for (const tile of tiles) {
    const key = tile.row+':'+tile.col; if (seen.has(key)) continue;
    const stack=[tile]; const members=[]; seen.add(key);
    while(stack.length){
      const cur=stack.pop(); members.push(cur);
      for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
        const nk=(cur.row+dr)+':'+(cur.col+dc); const n=map.get(nk);
        if(n && n.type===tile.type && !seen.has(nk)){ seen.add(nk); stack.push(n); }
      }
    }
    groups.push({type:tile.type,count:members.length,seedLabel:members[0].label,cells:members.map(m=>[m.row,m.col])});
  }
  const board = document.querySelector('[aria-label="cluster break board"]')?.getBoundingClientRect();
  const strip = document.querySelector('[aria-label="column next puzzle panels"]')?.getBoundingClientRect();
  return {
    stage, turn, enemyName, enemyHp, enemyMax, hp, bar, free, intentLabel, intentPower, groups,
    stageIntro: !!document.querySelector('[aria-label^="Stage "][aria-label$=" intro"]'),
    stageClear: !!document.querySelector('[aria-label="Stage Clear"]'),
    gameOver: !!document.querySelector('[aria-label="Game Over"]'),
    viewport:{w:innerWidth,h:innerHeight,bodyH:document.body.scrollHeight},
    board:board?{x:+board.x.toFixed(1),y:+board.y.toFixed(1),w:+board.width.toFixed(1),h:+board.height.toFixed(1),bottom:+board.bottom.toFixed(1)}:null,
    strip:strip?{x:+strip.x.toFixed(1),y:+strip.y.toFixed(1),w:+strip.width.toFixed(1),h:+strip.height.toFixed(1)}:null
  };
})()`;

const log = [];
let shotIndex = 1;
try {
  const pages = await waitJson('http://127.0.0.1:9222/json');
  const page = pages.find(p => p.type === 'page') || pages[0];
  const cdp = new Cdp(page.webSocketDebuggerUrl);
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width:402, height:690, deviceScaleFactor:3, mobile:true, screenWidth:402, screenHeight:874 });
  await cdp.send('Page.navigate', { url }); await sleep(1800);
  await shot(cdp, `${pad(shotIndex++)}-title`);
  await evalJs(cdp, `Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('START GAME'))?.click()`); await sleep(300);
  await shot(cdp, `${pad(shotIndex++)}-stage1-intro`);
  await evalJs(cdp, `Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('BATTLE START'))?.click()`); await sleep(500);
  await shot(cdp, `${pad(shotIndex++)}-stage1-start`);

  let action = 0; let lastStage = 1;
  while (action < 30) {
    let state = await evalJs(cdp, stateExpr);
    if (state.gameOver) { await shot(cdp, `${pad(shotIndex++)}-game-over`); log.push({event:'game-over', state}); break; }
    if (state.stageClear) {
      await shot(cdp, `${pad(shotIndex++)}-stage${state.stage}-clear`);
      log.push({event:'stage-clear', state});
      if (state.stage >= 4) break;
      await evalJs(cdp, `Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('NEXT STAGE'))?.click()`); await sleep(350);
      await shot(cdp, `${pad(shotIndex++)}-stage${state.stage+1}-intro`);
      await evalJs(cdp, `Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('BATTLE START'))?.click()`); await sleep(500);
      await shot(cdp, `${pad(shotIndex++)}-stage${state.stage+1}-start`);
      lastStage = state.stage + 1;
      continue;
    }
    if (state.stageIntro) {
      await evalJs(cdp, `Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('BATTLE START'))?.click()`); await sleep(500); continue;
    }
    if (!state.groups.length) { log.push({event:'no-groups', state}); break; }
    const ranked = state.groups.map(g => ({...g, score:scoreGroup(g,state)})).sort((a,b)=>b.score-a.score || b.count-a.count);
    const choice = ranked[0];
    const before = {...state, groups:undefined};
    const activated = await evalJs(cdp, `(() => { const label=${JSON.stringify(choice.seedLabel)}; const b=Array.from(document.querySelectorAll('[aria-label="cluster break board"] button:not(:disabled)')).find(el=>el.getAttribute('aria-label')===label); if(!b)return false; b.focus(); b.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true})); return true; })()`);
    if (!activated) { log.push({event:'activation-failed', before, choice}); break; }
    action += 1;
    if (action === 1 || action % 4 === 0) { await sleep(150); await shot(cdp, `${pad(shotIndex++)}-stage${state.stage}-action${action}-fx`); await sleep(950); }
    else { await sleep(1100); }
    const after = await evalJs(cdp, stateExpr);
    log.push({event:'action', action, choice:{type:choice.type,count:choice.count,score:+choice.score.toFixed(2)}, before, after:{...after, groups:undefined}});
    if (after.stage !== lastStage) lastStage = after.stage;
    if (action % 5 === 0) await shot(cdp, `${pad(shotIndex++)}-stage${after.stage}-after${action}`);
  }
  const finalState = await evalJs(cdp, stateExpr);
  await shot(cdp, `${pad(shotIndex++)}-final`);
  await writeFile(`${outDir}/gameplay-log.json`, JSON.stringify({ finalState:{...finalState,groups:undefined}, log }, null, 2));
  cdp.ws.close();
} finally {
  browser.kill('SIGTERM');
}
