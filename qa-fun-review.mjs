import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const OUT='qa-fun-review-artifacts';
await fs.mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:402,height:874},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
const errors=[];
page.on('console',m=>{if(m.type()==='error')errors.push(`console:${m.text()}`)});
page.on('pageerror',e=>errors.push(`page:${e.message}`));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const shot=n=>page.screenshot({path:`${OUT}/${n}.png`});

function parseBoard(labels){const b=Array.from({length:6},()=>Array(6).fill(''));for(const s of labels){const m=s.match(/(fire|water|light|heart|guard) orb row (\d+) column (\d+)/);if(m)b[+m[2]-1][+m[3]-1]=m[1];}return b;}
function matchedCells(b){const s=new Set();for(let r=0;r<6;r++){let st=0;for(let c=1;c<=6;c++){if(c<6&&b[r][c]===b[r][st])continue;if(c-st>=3)for(let x=st;x<c;x++)s.add(`${r}:${x}`);st=c;}}for(let c=0;c<6;c++){let st=0;for(let r=1;r<=6;r++){if(r<6&&b[r][c]===b[st][c])continue;if(r-st>=3)for(let y=st;y<r;y++)s.add(`${y}:${c}`);st=r;}}return s;}
function largestRun(b){let best=1;for(let r=0;r<6;r++){let st=0;for(let c=1;c<=6;c++){if(c<6&&b[r][c]===b[r][st])continue;best=Math.max(best,c-st);st=c;}}for(let c=0;c<6;c++){let st=0;for(let r=1;r<=6;r++){if(r<6&&b[r][c]===b[st][c])continue;best=Math.max(best,r-st);st=r;}}return best;}
function analyzeMoves(board){const out=[];const atk={fire:6,water:5,light:7,heart:0,guard:0};for(let r=0;r<6;r++)for(let c=0;c<6;c++)for(const[dr,dc]of[[0,1],[1,0]]){const rr=r+dr,cc=c+dc;if(rr>=6||cc>=6)continue;const b=board.map(row=>[...row]);[b[r][c],b[rr][cc]]=[b[rr][cc],b[r][c]];const m=matchedCells(b);let attack=0,heal=0,guard=0;for(const k of m){const[y,x]=k.split(':').map(Number);const o=b[y][x];attack+=atk[o]||0;if(o==='heart')heal+=3;if(o==='guard')guard+=5;}out.push({a:[r,c],b:[rr,cc],matches:m.size,run:largestRun(b),attack,heal,guard});}return out;}
async function board(){return parseBoard(await page.locator('button[aria-label*=" orb row "]').evaluateAll(bs=>bs.map(b=>b.getAttribute('aria-label')||'')));}
async function cell([r,c]){await page.locator(`button[aria-label*=" row ${r+1} column ${c+1}"]`).first().click({force:true});}
async function state(){return page.evaluate(()=>{const p=document.querySelector('[aria-label="player status"]')?.textContent||'';const e=document.querySelector('[aria-label="enemy status"]')?.textContent||'';const all=document.body.textContent||'';return{stage:+(all.match(/STAGE\s+(\d+)/)?.[1]||0),turn:+(all.match(/TURN\s+(\d+)/)?.[1]||0),hp:+(p.match(/HP\s*(\d+)/)?.[1]||0),def:+(p.match(/DEF\s*(\d+)/)?.[1]||0),enemyHp:+(e.match(/(\d+)\s*\/\s*(\d+)/)?.[1]||0),enemyMax:+(e.match(/(\d+)\s*\/\s*(\d+)/)?.[2]||0),enemyName:e.split(/\d/)[0].trim(),now:document.querySelector('[aria-label="enemy intents"]')?.children?.[0]?.textContent||'',next:document.querySelector('[aria-label="enemy intents"]')?.children?.[1]?.textContent||'',skill:(Array.from(document.querySelectorAll('button')).find(b=>(b.textContent||'').includes('PRISM SHIFT'))?.textContent||''),gameOver:!!document.querySelector('[aria-label="Game Over"]')};});}
async function introIfAny(){const d=page.locator('[role="dialog"][aria-label^="Stage "]');if(await d.count()){const s=await state();await shot(`stage-${s.stage}-intro`);await d.click({position:{x:30,y:30},force:true});await wait(280);return true;}return false;}
async function waitReady(){for(let i=0;i<100;i++){if(await page.locator('[aria-label="Game Over"]').count())return;if(await page.locator('[role="dialog"][aria-label^="Stage "]').count())return;const n=await page.locator('button[aria-label*=" orb row "]').count(),d=await page.locator('button[aria-label*=" orb row "]:disabled').count();if(n===36&&d===0){await wait(140);return;}await wait(100);}}
function incomingPower(text){const nums=[...text.matchAll(/(\d+)/g)].map(m=>+m[1]);return nums.length?nums.at(-1):0;}
function chooseMove(moves,s){const legal=moves.filter(m=>m.matches>0);const power=incomingPower(s.now);const needSurvival=s.hp<55||s.def<power||/HEAVY|PIERCE|DRAIN|CRUSH/.test(s.now);
  const scored=(legal.length?legal:moves).map(m=>{let score=0;score+=m.attack*1.0+m.matches*1.6;if(s.stage===2){if(m.run>=4&&m.attack>0)score+=45;else if(m.attack>0)score-=18;}if(needSurvival){score+=m.guard*5.2+m.heal*4.2;score-=m.attack*.22;}else{score+=m.guard*1.0+m.heal*.8;}if(s.hp<35)score+=m.heal*7;if(s.def<8)score+=m.guard*4;if(m.run>=4)score+=10;return{...m,score};}).sort((a,b)=>b.score-a.score);
  return scored[0];}
async function tryPrism(s){if(!/READY|BREAK/.test(s.skill))return false;const btn=page.getByRole('button',{name:/PRISM SHIFT/});if(!(await btn.count())||await btn.isDisabled())return false;await btn.click({force:true});await wait(120);
  const tiles=page.locator('button[aria-label*=" orb row "]');const count=await tiles.count();
  for(let i=0;i<count;i++){await tiles.nth(i).click({force:true});await wait(40);const palette=page.locator('[aria-label="Prism Shift color selection"] button:not(:disabled)');const pc=await palette.count();for(let j=0;j<pc;j++){const txt=(await palette.nth(j).textContent())||'';if(/BREAK|\d+/.test(txt)&&!/SETUP/.test(txt)){await palette.nth(j).click({force:true});await waitReady();return true;}}}
  const cancel=page.getByRole('button',{name:/PRISM SHIFT/});if(await cancel.count())await cancel.click({force:true});return false;}

await page.goto('http://127.0.0.1:4173',{waitUntil:'networkidle',timeout:60000});
await page.waitForSelector('[aria-label="Puzzle RPG title"]',{timeout:30000});await shot('00-title');
await page.getByRole('button',{name:/START GAME/}).click();await page.waitForSelector('[role="dialog"][aria-label^="Stage "]');await introIfAny();await page.waitForSelector('button[aria-label*=" orb row "]');await shot('01-stage1');
const report={turns:[],errors,stageTransitions:[],prismUses:0,setupTurns:0,fourPlusChoices:0};
let lastStage=1;
for(let t=1;t<=30;t++){
  await introIfAny();let s=await state();if(s.gameOver)break;if(s.stage!==lastStage){report.stageTransitions.push({atTurn:t,from:lastStage,to:s.stage});lastStage=s.stage;await shot(`stage-${s.stage}-battle`);}
  if(await tryPrism(s)){report.prismUses++;s=await state();report.turns.push({t,action:'PRISM',...s});if(s.gameOver)break;continue;}
  const moves=analyzeMoves(await board());const choice=chooseMove(moves,s);if(!choice)break;if(choice.run>=4&&choice.matches>=4)report.fourPlusChoices++;
  if(choice.matches===0)report.setupTurns++;
  await cell(choice.a);if(t===1||t===8||t===16)await shot(`turn-${t}-selection`);await wait(70);await cell(choice.b);
  try{if(t===1||t===10||t===20){await page.waitForSelector('em:text-is("HIT!")',{state:'visible',timeout:1400});await shot(`turn-${t}-fx`);}}catch{}
  await waitReady();const after=await state();report.turns.push({t,action:choice.matches?`swap ${choice.matches}m r${choice.run} atk${choice.attack} h${choice.heal} d${choice.guard}`:'SETUP',before:s,after});
  if(after.gameOver){await shot('game-over');break;}
}
report.final=await state();report.errors=[...errors];await shot('99-final');await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();
