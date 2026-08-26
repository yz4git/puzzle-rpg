import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const OUT='qa-v2-artifacts';
await fs.mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:402,height:874},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
const errors=[];
page.on('console',m=>{if(m.type()==='error')errors.push(`console:${m.text()}`)});
page.on('pageerror',e=>errors.push(`page:${e.message}`));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const shot=name=>page.screenshot({path:`${OUT}/${name}.png`});

function parseBoard(labels){
  const b=Array.from({length:6},()=>Array(6).fill(''));
  for(const label of labels){const m=label.match(/(fire|water|light|heart|guard) orb row (\d+) column (\d+)/);if(m)b[+m[2]-1][+m[3]-1]=m[1];}
  return b;
}
function matches(b){
  const s=new Set();
  for(let r=0;r<6;r++){let st=0;for(let c=1;c<=6;c++){if(c<6&&b[r][c]===b[r][st])continue;if(c-st>=3)for(let x=st;x<c;x++)s.add(`${r}:${x}`);st=c;}}
  for(let c=0;c<6;c++){let st=0;for(let r=1;r<=6;r++){if(r<6&&b[r][c]===b[st][c])continue;if(r-st>=3)for(let y=st;y<r;y++)s.add(`${y}:${c}`);st=r;}}
  return s;
}
function moves(b){
  const weight={fire:6,water:5,light:7,heart:2,guard:2}; const out=[];
  for(let r=0;r<6;r++)for(let c=0;c<6;c++)for(const [dr,dc] of [[0,1],[1,0]]){const rr=r+dr,cc=c+dc;if(rr>=6||cc>=6)continue;const n=b.map(x=>[...x]);[n[r][c],n[rr][cc]]=[n[rr][cc],n[r][c]];const m=matches(n);let score=0;for(const k of m){const [y,x]=k.split(':').map(Number);score+=weight[n[y][x]]||0;}if(m.size)out.push({a:[r,c],b:[rr,cc],count:m.size,score});}
  return out.sort((a,b)=>(b.score+b.count*2)-(a.score+a.count*2));
}
async function readBoard(){return parseBoard(await page.locator('button[aria-label*=" orb row "]').evaluateAll(bs=>bs.map(b=>b.getAttribute('aria-label')||'')));}
async function clickCell([r,c]){await page.locator(`button[aria-label*=" row ${r+1} column ${c+1}"]`).first().click({force:true});}
async function introIfAny(){const d=page.locator('[role="dialog"][aria-label^="Stage "]');if(await d.count()){await shot(`stage-${await page.evaluate(()=>document.body.textContent?.match(/STAGE\s+(\d+)/)?.[1]||'x')}-intro`);await d.click({position:{x:24,y:24},force:true});await wait(250);}}
async function waitReady(){for(let i=0;i<80;i++){if(await page.locator('[aria-label="Game Over"]').count())return;if(await page.locator('[role="dialog"][aria-label^="Stage "]').count())return;const n=await page.locator('button[aria-label*=" orb row "]').count();const dis=await page.locator('button[aria-label*=" orb row "]:disabled').count();if(n===36&&dis===0){await wait(120);return;}await wait(100);}}

await page.goto('http://127.0.0.1:4173',{waitUntil:'networkidle',timeout:60000});
await page.waitForSelector('[aria-label="Puzzle RPG title"]',{timeout:30000});
await shot('00-title');
const report={errors,turns:[],attackFx:false,damageFx:false,metrics:{}};
report.graphicsVersion=await page.locator('[data-graphics-version="2"]').count();
await page.getByRole('button',{name:/START GAME/}).click();
await page.waitForSelector('[role="dialog"][aria-label^="Stage "]');
await shot('01-intro');
await introIfAny();
await page.waitForSelector('button[aria-label*=" orb row "]');
await wait(250);
await shot('02-battle');
report.metrics=await page.evaluate(()=>{
  const rect=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),bottom:Math.round(r.bottom)}};
  const enemy=document.querySelector('[data-pixel-sprite="enemy"]');
  const tile=document.querySelector('button[aria-label*=" orb row "]');
  return {body:{scrollHeight:document.body.scrollHeight,clientHeight:document.body.clientHeight,innerHeight:innerHeight},enemy:enemy?rect('[data-pixel-sprite="enemy"]'):null,puzzle:rect('[aria-label="puzzle zone"]'),board:rect('[aria-label="puzzle board"]'),tile:tile?(()=>{const r=tile.getBoundingClientRect();return{w:Math.round(r.width),h:Math.round(r.height)}})():null,enemyFilter:enemy?getComputedStyle(enemy).filter:null,rootBg:getComputedStyle(document.querySelector('[data-graphics-version="2"]')).backgroundColor};
});

for(let turn=1;turn<=12;turn++){
  await introIfAny();
  if(await page.locator('[aria-label="Game Over"]').count())break;
  const b=await readBoard();const ms=moves(b);if(!ms.length)break;const m=ms[0];
  await clickCell(m.a); if(turn===1)await shot('03-selection'); await wait(80); await clickCell(m.b);
  if(!report.attackFx){try{await page.waitForSelector('em:text-is("HIT!")',{state:'visible',timeout:1600});report.attackFx=true;await shot('04-attack-fx');}catch{}}
  if(!report.damageFx){try{await page.waitForFunction(()=>Array.from(document.querySelectorAll('span')).some(s=>/^-\d+ HP$/.test((s.textContent||'').trim())),{},{timeout:1800});report.damageFx=true;await shot('05-damage-fx');}catch{}}
  await waitReady();
  const state=await page.evaluate(()=>({stage:Number(document.body.textContent?.match(/STAGE\s+(\d+)/)?.[1]||0),hp:Number(document.querySelector('[aria-label="player status"]')?.textContent?.match(/HP\s*(\d+)/)?.[1]||0),def:Number(document.querySelector('[aria-label="player status"]')?.textContent?.match(/DEF\s*(\d+)/)?.[1]||0),gameOver:!!document.querySelector('[aria-label="Game Over"]')}));
  report.turns.push({turn,...state,move:m});
  if(turn===6)await shot('06-midgame');
  if(state.gameOver){await shot('07-game-over');break;}
}
await shot('99-final');
report.final=report.turns.at(-1)||null;
report.errors=[...errors];
await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
