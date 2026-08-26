import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const OUT='qa-deep-fun-artifacts';
await fs.mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:402,height:874},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await ctx.newPage();
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
async function clickCell([r,c]){await page.locator(`button[aria-label*=" row ${r+1} column ${c+1}"]`).first().click({force:true});}
async function state(){return page.evaluate(()=>{const p=document.querySelector('[aria-label="player status"]')?.textContent||'';const e=document.querySelector('[aria-label="enemy status"]')?.textContent||'';const all=document.body.textContent||'';const intent=document.querySelector('[aria-label="enemy intents"]');return{stage:+(all.match(/STAGE\s+(\d+)/)?.[1]||0),turn:+(all.match(/TURN\s+(\d+)/)?.[1]||0),hp:+(p.match(/HP\s*(\d+)/)?.[1]||0),def:+(p.match(/DEF\s*(\d+)/)?.[1]||0),enemyHp:+(e.match(/(\d+)\s*\/\s*(\d+)/)?.[1]||0),enemyMax:+(e.match(/(\d+)\s*\/\s*(\d+)/)?.[2]||0),enemyName:e.split(/\d/)[0].trim(),now:intent?.children?.[0]?.textContent||'',next:intent?.children?.[1]?.textContent||'',skill:Array.from(document.querySelectorAll('button')).find(b=>(b.textContent||'').includes('PRISM SHIFT'))?.textContent||'',message:document.querySelector('[role="status"]')?.textContent||'',gameOver:!!document.querySelector('[aria-label="Game Over"]')};});}
async function introIfAny(){const d=page.locator('[role="dialog"][aria-label^="Stage "]');if(await d.count()){const s=await state();await shot(`stage-${s.stage}-intro`);await d.click({position:{x:35,y:35},force:true});await wait(280);return true;}return false;}
async function waitReady(){for(let i=0;i<120;i++){if(await page.locator('[aria-label="Game Over"]').count())return;if(await page.locator('[role="dialog"][aria-label^="Stage "]').count())return;const n=await page.locator('button[aria-label*=" orb row "]').count(),d=await page.locator('button[aria-label*=" orb row "]:disabled').count();if(n===36&&d===0){await wait(140);return;}await wait(100);}}
function intentPower(text){const nums=[...text.matchAll(/(\d+)/g)].map(m=>+m[1]);return nums.length?nums.at(-1):0;}
function chooseMove(moves,s){const legal=moves.filter(m=>m.matches>0);const pool=legal.length?legal:moves;const power=intentPower(s.now);const lethalRisk=s.hp<=power+4;const danger=lethalRisk||s.hp<48||s.def<power||/HEAVY|PIERCE|DRAIN|CRUSH|RITE/.test(s.now);
  return pool.map(m=>{let score=m.matches*1.8+m.run*2+m.attack; if(s.stage===2){if(m.run>=4&&m.attack>0)score+=48; else if(m.attack>0)score-=20;} if(danger){score+=m.guard*5.4+m.heal*5.2-score*.12;} else {score+=m.guard*1.0+m.heal*.9;} if(s.hp<30)score+=m.heal*7.5;if(s.def<8)score+=m.guard*4.5;if(m.run>=4)score+=12;if(m.matches===0)score+=danger?10:-8;return{...m,score};}).sort((a,b)=>b.score-a.score)[0];}
async function tryUsefulPrism(s){if(!/READY|BREAK/.test(s.skill))return false;const trigger=page.getByRole('button',{name:/PRISM SHIFT/});if(!(await trigger.count())||await trigger.isDisabled())return false;await trigger.click({force:true});await wait(80);const tiles=page.locator('button[aria-label*=" orb row "]');for(let i=0;i<await tiles.count();i++){await tiles.nth(i).click({force:true});await wait(25);const palette=page.locator('[aria-label="Prism Shift color selection"] button:not(:disabled)');for(let j=0;j<await palette.count();j++){const txt=(await palette.nth(j).textContent())||'';if(/BREAK\s+\d+|\d+\s*DMG|\d+\s*·\s*\d+C/.test(txt)){await palette.nth(j).click({force:true});await waitReady();return true;}}}
  const cancel=page.getByRole('button',{name:/PRISM SHIFT/});if(await cancel.count())await cancel.click({force:true});return false;}

await page.goto('http://127.0.0.1:4173',{waitUntil:'networkidle',timeout:60000});
await page.waitForSelector('[aria-label="Puzzle RPG title"]',{timeout:30000});await shot('00-title');
await page.getByRole('button',{name:/START GAME/}).click();await page.waitForSelector('[role="dialog"][aria-label^="Stage "]');await introIfAny();await page.waitForSelector('button[aria-label*=" orb row "]');await shot('01-stage1');
const report={errors,turns:[],stageTransitions:[],decisionTypes:{attack:0,defense:0,heal:0,setup:0,prism:0,fourPlus:0},dramaticMoments:[]};
let lastStage=1,lastHp=100,lastEnemy=999;
for(let t=1;t<=36;t++){
  await introIfAny();let s=await state();if(s.gameOver)break;if(s.stage!==lastStage){report.stageTransitions.push({atTurn:t,from:lastStage,to:s.stage});lastStage=s.stage;await shot(`stage-${s.stage}-battle`);}
  if(await tryUsefulPrism(s)){report.decisionTypes.prism++;const after=await state();report.turns.push({t,action:'PRISM',before:s,after});report.dramaticMoments.push({t,type:'prism',stage:s.stage,hp:after.hp,enemyHp:after.enemyHp});if(after.gameOver)break;continue;}
  const moves=analyzeMoves(await board());const c=chooseMove(moves,s);if(!c)break;let kind='attack';if(c.matches===0){kind='setup';report.decisionTypes.setup++;}else if(c.guard>c.attack&&c.guard>0){kind='defense';report.decisionTypes.defense++;}else if(c.heal>c.attack&&c.heal>0){kind='heal';report.decisionTypes.heal++;}else report.decisionTypes.attack++;if(c.run>=4&&c.matches>=4)report.decisionTypes.fourPlus++;
  await clickCell(c.a);if([1,7,14,21,28].includes(t))await shot(`turn-${t}-selection`);await wait(60);await clickCell(c.b);
  try{if([1,10,20,30].includes(t)){await page.waitForSelector('em:text-is("HIT!")',{state:'visible',timeout:1400});await shot(`turn-${t}-fx`);}}catch{}
  await waitReady();const after=await state();report.turns.push({t,action:`${kind} m${c.matches} r${c.run} atk${c.attack} heal${c.heal} def${c.guard}`,before:s,after});
  if(after.hp<=25&&lastHp>25){report.dramaticMoments.push({t,type:'critical_hp',stage:after.stage,hp:after.hp,enemyHp:after.enemyHp});await shot(`turn-${t}-critical`);} if(after.enemyHp<=Math.max(12,after.enemyMax*.12)&&lastEnemy>Math.max(12,after.enemyMax*.12)){report.dramaticMoments.push({t,type:'enemy_near_death',stage:after.stage,hp:after.hp,enemyHp:after.enemyHp});}
  lastHp=after.hp;lastEnemy=after.enemyHp;if(after.gameOver){await shot('game-over');break;}
}
report.final=await state();report.errors=[...errors];await shot('99-final');await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();
