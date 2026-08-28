import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const out = 'sfc-visual-audit2';
await mkdir(out, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const browser = spawn('google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  '--remote-debugging-port=9222', '--user-data-dir=/tmp/sfc-visual-audit2',
  '--window-size=402,690', 'about:blank',
], { stdio: ['ignore', 'ignore', 'inherit'] });

async function waitJson(url) {
  for (let i = 0; i < 240; i += 1) {
    try { const response = await fetch(url); if (response.ok) return response.json(); } catch {}
    await sleep(250);
  }
  throw new Error(`timeout ${url}`);
}
class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl); this.id = 0; this.pending = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data); const pending = this.pending.get(message.id); if (!pending) return;
      this.pending.delete(message.id); message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
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
async function clickText(cdp, text) {
  return ev(cdp, `(()=>{const t=${JSON.stringify(text)};const e=Array.from(document.querySelectorAll('button')).find(x=>(x.innerText||'').includes(t));if(!e)return false;e.click();return true})()`);
}
async function key(cdp, keyName, pause = 100) {
  await ev(cdp, `(()=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(keyName)},bubbles:true,cancelable:true}));return true})()`);
  await sleep(pause);
}
const records = [];
async function metrics(cdp) {
  return ev(cdp, `(()=>{
    const rect=(sel)=>{const e=document.querySelector(sel);if(!e)return null;const r=e.getBoundingClientRect();return{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}};
    const backdrop=document.querySelector('[class*="battleBackdrop"]');
    return {
      width:innerWidth,height:innerHeight,scrollHeight:document.documentElement.scrollHeight,
      bodyText:document.body.innerText.replace(/\\s+/g,' ').trim().slice(0,1100),
      world:rect('canvas[aria-label$="exploration map"]'), board:rect('[aria-label="RPG Cluster Break board"]'),
      talk:rect('[class*="talkMoment"]'), menu:rect('[class*="menuWindow"]'), enemy:rect('[role="img"]'),
      scene:document.querySelector('main[data-scene]')?.getAttribute('data-scene')||null,
      backdropImage:backdrop ? getComputedStyle(backdrop).backgroundImage : null
    };
  })()`);
}
async function shot(cdp, name, note='') {
  const info = await metrics(cdp);
  const { data } = await cdp.send('Page.captureScreenshot', { format:'png', fromSurface:true });
  await writeFile(`${out}/${name}.png`, Buffer.from(data,'base64'));
  records.push({ name, note, metrics: info });
}

const consoleIssues = [];
try {
  const pages = await waitJson('http://127.0.0.1:9222/json');
  const page = pages.find((entry) => entry.type === 'page') ?? pages[0];
  const cdp = new Cdp(page.webSocketDebuggerUrl);
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Log.enable');
  cdp.ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') consoleIssues.push({ type:'exception', text:message.params?.exceptionDetails?.text ?? '' });
    if (message.method === 'Log.entryAdded' && ['error','warning'].includes(message.params?.entry?.level)) consoleIssues.push({ type:message.params.entry.level, text:message.params.entry.text });
  });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width:402,height:690,deviceScaleFactor:3,mobile:true,screenWidth:402,screenHeight:874 });
  await cdp.send('Page.navigate', { url:'http://127.0.0.1:5173' });
  await waitFor(cdp, `document.body.innerText.includes('RPG MODE')`, 15000);
  await ev(cdp, `localStorage.removeItem('puzzle-rpg:rpg-mode:v1'); true`);
  await cdp.send('Page.reload', { ignoreCache:true }); await sleep(800);
  await clickText(cdp,'RPG MODE'); await sleep(180); await clickText(cdp,'NEW GAME'); await sleep(350);
  for (let i=0;i<10;i+=1) { if (!(await ev(cdp, `document.body.innerText.includes('A / TAP')`))) break; await key(cdp,'a',80); }
  await sleep(250);
  await shot(cdp,'01-hearth-village','Larger hero/NPC and richer facade details');
  await key(cdp,'b',160); await shot(cdp,'02-field-menu','Menu regression'); await clickText(cdp,'B • CLOSE'); await sleep(120);
  await key(cdp,'ArrowDown',90); await key(cdp,'a',280); await shot(cdp,'03-prism-road','Terrain edge stitching on world field');
  await key(cdp,'ArrowDown',100);
  for (let i=0;i<32;i+=1) {
    if (await ev(cdp, `!!document.querySelector('[aria-label="RPG Cluster Break board"]')`)) break;
    await key(cdp,'ArrowRight',75);
  }
  const battleReached = await waitFor(cdp, `!!document.querySelector('[aria-label="RPG Cluster Break board"]')`, 5000);
  if (!battleReached) throw new Error('Natural encounter not reached');
  await sleep(250); await shot(cdp,'04-field-battle','Dedicated field PNG battle background');
  const m=await metrics(cdp);
  if (!m.board || m.board.w < 340) throw new Error(`RPG battle board too small: ${m.board?.w}`);
  if (!m.backdropImage || !m.backdropImage.includes('/assets/rpg/battle-bg/field.png')) throw new Error(`Dedicated field background missing: ${m.backdropImage}`);
  await clickText(cdp,'RPG COMMAND'); await sleep(100); await clickText(cdp,'TALK'); await sleep(180); await shot(cdp,'05-talk-reaction','TALK reaction frame and scene-accent window');
  await sleep(950); await shot(cdp,'06-after-talk','Battle after TALK');
  await cdp.send('Page.reload', { ignoreCache:true }); await sleep(650);
  await clickText(cdp,'CHAPTER BATTLE'); await waitFor(cdp, `document.body.innerText.includes('CHAPTER 1') || document.body.innerText.includes('STAGE')`, 5000);
  await sleep(200); await shot(cdp,'07-chapter-battle','Chapter Battle regression check');
  records.push({ consoleIssues });
  await writeFile(`${out}/audit.json`, JSON.stringify(records,null,2));
  cdp.ws.close();
} finally { browser.kill('SIGTERM'); }
