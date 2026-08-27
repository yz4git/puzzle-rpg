import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const outDir = 'review-artifacts';
await mkdir(outDir, { recursive: true });
const chrome = process.env.CHROME_BIN || 'google-chrome';
const url = process.env.REVIEW_URL || 'http://127.0.0.1:5173';
const browser = spawn(chrome, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  '--remote-debugging-port=9222', '--user-data-dir=/tmp/puzzle-rpg-intent-fx-review',
  '--window-size=402,690', 'about:blank',
], { stdio: ['ignore', 'ignore', 'inherit'] });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitJson(endpoint, attempts = 80) {
  let last;
  for (let i = 0; i < attempts; i += 1) {
    try { const r = await fetch(endpoint); if (r.ok) return await r.json(); } catch (e) { last = e; }
    await sleep(250);
  }
  throw last || new Error(`Timed out waiting for ${endpoint}`);
}
class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl); this.id = 0; this.pending = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const m = JSON.parse(event.data); if (!m.id) return;
      const p = this.pending.get(m.id); if (!p) return; this.pending.delete(m.id);
      if (m.error) p.reject(new Error(m.error.message)); else p.resolve(m.result);
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
async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  return result.result.value;
}
async function shot(cdp, name) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await writeFile(`${outDir}/${name}.png`, Buffer.from(data, 'base64'));
}

try {
  const pages = await waitJson('http://127.0.0.1:9222/json');
  const page = pages.find((p) => p.type === 'page') || pages[0];
  const cdp = new Cdp(page.webSocketDebuggerUrl);
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 402, height: 690, deviceScaleFactor: 3, mobile: true, screenWidth: 402, screenHeight: 874 });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await cdp.send('Page.navigate', { url });

  await sleep(4200);
  const freshNav = await evaluate(cdp, `({href:location.href, search:location.search, bodyText:document.body.innerText.slice(0,120)})`);
  await shot(cdp, '01-stable-first-open');

  await evaluate(cdp, `Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('START GAME'))?.click()`);
  await sleep(350);
  await evaluate(cdp, `Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('BATTLE START'))?.click()`);
  await sleep(500);

  const intents = await evaluate(cdp, `(() => {
    const style=(el)=>{const cs=getComputedStyle(el); const r=el.getBoundingClientRect(); return {width:+r.width.toFixed(1),height:+r.height.toFixed(1),border:cs.border,background:cs.background,opacity:cs.opacity,zIndex:cs.zIndex};};
    return {now:style(document.querySelector('[class*="intentNow"]')),next:style(document.querySelector('[class*="intentNext"]'))};
  })()`);
  await shot(cdp, '02-intent-hierarchy');

  const attackTriggered = await evaluate(cdp, `(() => {
    const b=Array.from(document.querySelectorAll('[aria-label="cluster break board"] button:not(:disabled)')).find(el => el.getAttribute('aria-label')?.startsWith('ATK panel'));
    if(!b) return false;
    const r=b.getBoundingClientRect(); const x=r.left+r.width/2, y=r.top+r.height/2;
    b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:17,pointerType:'touch',clientX:x,clientY:y,isPrimary:true}));
    b.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:17,pointerType:'touch',clientX:x,clientY:y,isPrimary:true}));
    return true;
  })()`);
  await sleep(120);
  const fx = await evaluate(cdp, `(() => {
    const layer=document.querySelector('[class*="energyLayer"]'); const main=document.querySelector('main[class*="shell"]');
    const scan=Array.from(document.querySelectorAll('div')).find(el => String(el.className).includes('scanlines'));
    const particles=document.querySelectorAll('[class*="energyParticle"]');
    const s=(el)=>el?{position:getComputedStyle(el).position,zIndex:getComputedStyle(el).zIndex,overflow:getComputedStyle(el).overflow}:null;
    return {particleCount:particles.length,layer:s(layer),main:s(main),scanlines:s(scan)};
  })()`);
  await shot(cdp, '03-attack-fx-front');

  await writeFile(`${outDir}/verification.json`, JSON.stringify({freshNav,intents,attackTriggered,fx}, null, 2));
  cdp.ws.close();
} finally {
  browser.kill('SIGTERM');
}
