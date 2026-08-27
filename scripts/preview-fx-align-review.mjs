import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const outDir='review-artifacts'; await mkdir(outDir,{recursive:true});
const chrome=process.env.CHROME_BIN||'google-chrome';
const url=process.env.REVIEW_URL||'http://127.0.0.1:5173';
const browser=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--hide-scrollbars','--remote-debugging-port=9222','--user-data-dir=/tmp/puzzle-rpg-preview-fx','--window-size=402,690','about:blank'],{stdio:['ignore','ignore','inherit']});
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
async function waitJson(endpoint){for(let i=0;i<80;i++){try{const r=await fetch(endpoint);if(r.ok)return await r.json();}catch{}await sleep(250);}throw new Error('CDP timeout');}
class Cdp{constructor(ws){this.ws=new WebSocket(ws);this.id=0;this.pending=new Map();this.ready=new Promise((res,rej)=>{this.ws.addEventListener('open',res,{once:true});this.ws.addEventListener('error',rej,{once:true});});this.ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(!m.id)return;const p=this.pending.get(m.id);if(!p)return;this.pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);});}async send(method,params={}){await this.ready;const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}}
async function evalJs(cdp,expression){const r=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});return r.result.value;}
async function shot(cdp,name){const {data}=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true});await writeFile(`${outDir}/${name}.png`,Buffer.from(data,'base64'));}
try{
 const pages=await waitJson('http://127.0.0.1:9222/json'); const page=pages.find(p=>p.type==='page')||pages[0]; const cdp=new Cdp(page.webSocketDebuggerUrl);
 await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:402,height:690,deviceScaleFactor:3,mobile:true,screenWidth:402,screenHeight:874});
 await cdp.send('Page.navigate',{url}); await sleep(1800);
 await evalJs(cdp,`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('START GAME'))?.click()`); await sleep(300);
 await evalJs(cdp,`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('BATTLE START'))?.click()`); await sleep(450);
 const alignment=await evalJs(cdp,`(()=>{const rect=e=>{const r=e.getBoundingClientRect();return{x:+r.x.toFixed(2),width:+r.width.toFixed(2),right:+r.right.toFixed(2)}};const board=document.querySelector('[aria-label="cluster break board"]');const strip=document.querySelector('[aria-label="column next puzzle panels"]');const cols=Array.from(strip.querySelectorAll('[class*="nextColumn"]')).map(rect);const tiles=Array.from(board.querySelectorAll('button')).filter(b=>/row 1 column/.test(b.getAttribute('aria-label')||'')).sort((a,b)=>{const ca=+(a.getAttribute('aria-label').match(/column (\\d+)/)?.[1]||0);const cb=+(b.getAttribute('aria-label').match(/column (\\d+)/)?.[1]||0);return ca-cb;}).map(rect);return{board:rect(board),strip:rect(strip),cols,tiles,deltas:cols.map((c,i)=>({x:+(c.x-tiles[i].x).toFixed(2),width:+(c.width-tiles[i].width).toFixed(2)}))};})()`);
 await shot(cdp,'01-preview-alignment');
 const triggered=await evalJs(cdp,`(()=>{const b=Array.from(document.querySelectorAll('[aria-label="cluster break board"] button:not(:disabled)')).find(el=>el.getAttribute('aria-label')?.startsWith('ATK panel'));if(!b)return false;b.focus();b.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}));return true;})()`); await sleep(160);
 const fx=await evalJs(cdp,`(()=>{const layer=document.querySelector('[class*="energyLayer"]');const p=document.querySelector('[class*="energyParticle"]');const scan=Array.from(document.querySelectorAll('div')).find(el=>String(el.className).includes('scanlines'));const shell=document.querySelector('main[class*="shell"]');const s=e=>e?{z:getComputedStyle(e).zIndex,pos:getComputedStyle(e).position,overflow:getComputedStyle(e).overflow}:null;let top=[];let pr=null;if(p){const r=p.getBoundingClientRect();pr={x:+r.x.toFixed(1),y:+r.y.toFixed(1),width:+r.width.toFixed(1),height:+r.height.toFixed(1)};top=document.elementsFromPoint(r.left+r.width/2,r.top+r.height/2).slice(0,6).map(e=>String(e.className||e.tagName));}return{triggered,particleCount:document.querySelectorAll('[class*="energyParticle"]').length,layer:s(layer),shell:s(shell),scan:s(scan),particle:pr,topAtParticle:top};})()`);
 await shot(cdp,'02-fx-top-layer');
 await writeFile(`${outDir}/verification.json`,JSON.stringify({alignment,fx},null,2)); cdp.ws.close();
}finally{browser.kill('SIGTERM');}
