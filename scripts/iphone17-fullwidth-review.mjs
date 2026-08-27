import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const outDir = 'review-artifacts';
await mkdir(outDir, { recursive: true });
const chrome = process.env.CHROME_BIN || 'google-chrome';
const url = process.env.REVIEW_URL || 'http://127.0.0.1:5173';
const browser = spawn(chrome, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  '--remote-debugging-port=9222', '--user-data-dir=/tmp/puzzle-rpg-fullwidth-review',
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
  await sleep(1800);
  await evaluate(cdp, `Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('START GAME'))?.click()`);
  await sleep(350);
  await evaluate(cdp, `Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('BATTLE START'))?.click()`);
  await sleep(500);

  const metrics = await evaluate(cdp, `(() => {
    const rect = (el) => { if (!el) return null; const r=el.getBoundingClientRect(); const cs=getComputedStyle(el); return {x:+r.x.toFixed(1),y:+r.y.toFixed(1),width:+r.width.toFixed(1),height:+r.height.toFixed(1),display:cs.display}; };
    const board=document.querySelector('[aria-label="cluster break board"]');
    const enemy=document.querySelector('[class*="enemySprite"]');
    const footerClusters=document.querySelector('[aria-label="largest current clusters"]');
    const status=document.querySelector('main > [role="status"]');
    const rule=document.querySelector('main > [class*="ruleLine"]');
    return {viewport:{innerWidth,innerHeight,devicePixelRatio},board:rect(board),enemy:rect(enemy),footerClusters:rect(footerClusters),status:rect(status),rule:rect(rule),bodyScrollHeight:document.body.scrollHeight};
  })()`);
  await writeFile(`${outDir}/metrics.json`, JSON.stringify(metrics, null, 2));
  await shot(cdp, 'battle-fullwidth');
  cdp.ws.close();
} finally {
  browser.kill('SIGTERM');
}
