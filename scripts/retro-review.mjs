import { chromium } from 'playwright';
import fs from 'node:fs';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport:{width:402,height:874}, isMobile:true, hasTouch:true, deviceScaleFactor:3 });
const page = await context.newPage();
const errors=[];
page.on('console', m=>{ if(m.type()==='error') errors.push('console:'+m.text()); });
page.on('pageerror', e=>errors.push('page:'+e.message));
fs.mkdirSync('review-artifact',{recursive:true});

await page.goto('http://127.0.0.1:4173/', {waitUntil:'networkidle'});
await page.evaluate(() => {
  window.__audioCounts={osc:0,buf:0};
  const AC=window.AudioContext||window.webkitAudioContext;
  if(AC){
    const op=AC.prototype.createOscillator;
    AC.prototype.createOscillator=function(){window.__audioCounts.osc++;return op.call(this);};
    const bp=AC.prototype.createBufferSource;
    AC.prototype.createBufferSource=function(){window.__audioCounts.buf++;return bp.call(this);};
  }
});
await page.screenshot({path:'review-artifact/00-title.png',fullPage:true});
await page.getByRole('button',{name:'START GAME'}).click();
await page.waitForTimeout(180);
await page.screenshot({path:'review-artifact/01-stage1-intro.png',fullPage:true});
await page.getByRole('button',{name:'BATTLE START'}).click();
await page.waitForTimeout(220);
await page.screenshot({path:'review-artifact/02-stage1-battle.png',fullPage:true});

const orbScore={fire:7,water:6,light:8,heart:3,guard:4};
function matches(board){
  const hit=new Set();
  for(let r=0;r<6;r++){let s=0;for(let c=1;c<=6;c++){if(c<6&&board[r][c]===board[r][s])continue;if(c-s>=3)for(let x=s;x<c;x++)hit.add(`${r}:${x}`);s=c;}}
  for(let c=0;c<6;c++){let s=0;for(let r=1;r<=6;r++){if(r<6&&board[r][c]===board[s][c])continue;if(r-s>=3)for(let y=s;y<r;y++)hit.add(`${y}:${c}`);s=r;}}
  return hit;
}
function swapped(board,a,b){const n=board.map(r=>r.slice());const t=n[a.r][a.c];n[a.r][a.c]=n[b.r][b.c];n[b.r][b.c]=t;return n;}
async function readBoard(){
  const data=await page.locator('button[aria-label*=" orb row "]').evaluateAll(btns=>btns.map(b=>b.getAttribute('aria-label')));
  const b=Array.from({length:6},()=>Array(6).fill(''));
  for(const a of data){const m=a?.match(/^(\w+) orb row (\d+) column (\d+)$/);if(m)b[+m[2]-1][+m[3]-1]=m[1];}
  return b;
}
function bestMove(board){
  let best=null;
  for(let r=0;r<6;r++)for(let c=0;c<6;c++)for(const [dr,dc] of [[0,1],[1,0]]){
    const rr=r+dr,cc=c+dc;if(rr>=6||cc>=6)continue;
    const n=swapped(board,{r,c},{r:rr,c:cc});const h=matches(n);let score=0;
    for(const k of h){const [y,x]=k.split(':').map(Number);score+=orbScore[n[y][x]]??0;}
    if(h.size&&(!best||score>best.score))best={a:{r,c},b:{r:rr,c:cc},score};
  }
  return best;
}
async function visibleStage(){
  const txt=await page.locator('body').innerText();
  const nums=[...txt.matchAll(/STAGE\s+(\d+)/g)].map(m=>+m[1]);
  return nums.length?Math.max(...nums):0;
}
async function ensurePlayable(){
  const deadline=Date.now()+6000;
  while(Date.now()<deadline){
    const intro=page.getByRole('button',{name:'BATTLE START'});
    if(await intro.count()&&await intro.isVisible().catch(()=>false)){
      const st=await visibleStage();
      await page.screenshot({path:`review-artifact/stage-${st}-intro.png`,fullPage:true});
      await intro.click();
      await page.waitForTimeout(220);
      continue;
    }
    const enabled=await page.locator('button[aria-label*=" orb row "]:not([disabled])').count();
    if(enabled===36)return true;
    await page.waitForTimeout(100);
  }
  return false;
}
async function clickCell(p){
  const loc=page.getByRole('button',{name:new RegExp(`orb row ${p.r+1} column ${p.c+1}$`)});
  await loc.click({timeout:6000});
}

let currentStage=1,turns=0,setups=0;
const logs=[];
while(turns<42&&currentStage<=5){
  if(!(await ensurePlayable())){errors.push('QA:board did not become playable');break;}
  currentStage=await visibleStage();
  const board=await readBoard();if(board.flat().some(x=>!x)){errors.push('QA:board parse incomplete');break;}
  let move=bestMove(board);
  if(!move){setups++;move={a:{r:2,c:2},b:{r:2,c:3},score:0};}
  await clickCell(move.a);
  await page.waitForTimeout(70);
  if(turns===0)await page.screenshot({path:'review-artifact/03-selected-guide.png',fullPage:true});
  await clickCell(move.b);
  if(turns===0){await page.waitForTimeout(100);await page.screenshot({path:'review-artifact/04-first-swap-fx.png',fullPage:true});}
  await page.waitForTimeout(1350);
  turns++;
  const st=await visibleStage();
  const body=(await page.locator('body').innerText()).replace(/\s+/g,' ');
  logs.push({turn:turns,stage:st,text:body.slice(-650)});
  if(st>currentStage){
    await page.screenshot({path:`review-artifact/stage-${currentStage}-clear.png`,fullPage:true});
    currentStage=st;
  }
  if(body.includes('GAME OVER'))break;
  if([8,16,24,32,40].includes(turns))await page.screenshot({path:`review-artifact/turn-${turns}.png`,fullPage:true});
}
await page.screenshot({path:'review-artifact/99-final.png',fullPage:true});
const audioCounts=await page.evaluate(()=>window.__audioCounts);
const metrics=await page.evaluate(()=>({scrollY:window.scrollY,scrollHeight:document.documentElement.scrollHeight,innerHeight:window.innerHeight,svgs:document.querySelectorAll('svg[aria-label]').length,tiles:document.querySelectorAll('button[aria-label*=" orb row "]').length}));
fs.writeFileSync('review-artifact/report.json',JSON.stringify({turns,currentStage,setups,audioCounts,metrics,errors,logs},null,2));
await browser.close();
