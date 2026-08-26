import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const OUT = 'qa-screen-artifacts';
await fs.mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 402, height: 874 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console: ${msg.text()}`); });
page.on('pageerror', (err) => errors.push(`page: ${err.message}`));

const shot = async (name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function boardFrom(items) {
  const board = Array.from({ length: 6 }, () => Array(6).fill(''));
  for (const x of items) board[x.row][x.col] = x.orb;
  return board;
}
function parseBoardItems(raw) {
  return raw.map(({ label }) => {
    const m = label.match(/(fire|water|light|heart|guard) orb row (\d+) column (\d+)/);
    return m ? { orb: m[1], row: Number(m[2]) - 1, col: Number(m[3]) - 1, label } : null;
  }).filter(Boolean);
}
function maxRun(board) {
  let best = 1;
  for (let r=0;r<6;r++) { let s=0; for (let c=1;c<=6;c++) { if(c<6 && board[r][c]===board[r][s]) continue; best=Math.max(best,c-s); s=c; } }
  for (let c=0;c<6;c++) { let s=0; for (let r=1;r<=6;r++) { if(r<6 && board[r][c]===board[s][c]) continue; best=Math.max(best,r-s); s=r; } }
  return best;
}
function matchedCells(board) {
  const set = new Set();
  for (let r=0;r<6;r++){ let s=0; for(let c=1;c<=6;c++){ if(c<6&&board[r][c]===board[r][s]) continue; if(c-s>=3) for(let x=s;x<c;x++) set.add(`${r}:${x}`); s=c; }}
  for (let c=0;c<6;c++){ let s=0; for(let r=1;r<=6;r++){ if(r<6&&board[r][c]===board[s][c]) continue; if(r-s>=3) for(let y=s;y<r;y++) set.add(`${y}:${c}`); s=r; }}
  return set;
}
function allMoves(board) {
  const moves=[];
  const weights={fire:6,water:5,light:7,heart:0,guard:0};
  for(let r=0;r<6;r++) for(let c=0;c<6;c++) for(const [dr,dc] of [[0,1],[1,0]]){
    const rr=r+dr,cc=c+dc; if(rr>=6||cc>=6) continue;
    const b=board.map(row=>[...row]); [b[r][c],b[rr][cc]]=[b[rr][cc],b[r][c]];
    const match=matchedCells(b); const run=maxRun(b);
    let atk=0,res=0; for(const k of match){const [y,x]=k.split(':').map(Number); const o=b[y][x]; atk+=weights[o]||0; if(o==='heart'||o==='guard') res++;}
    moves.push({a:{row:r,col:c},b:{row:rr,col:cc},matches:match.size,run,attack:atk,resource:res});
  }
  return moves;
}
async function readBoard() {
  const raw = await page.locator('button[aria-label*=" orb row "]').evaluateAll(btns => btns.map(b => ({label:b.getAttribute('aria-label')||''})));
  return boardFrom(parseBoardItems(raw));
}
async function status() {
  return page.evaluate(() => {
    const s=document.querySelector('[aria-label="player status"]')?.textContent||'';
    const stage=(document.body.textContent||'').match(/STAGE\s+(\d+)/)?.[1]||'?';
    const hp=Number(s.match(/HP\s*(\d+)/)?.[1]||0);
    const def=Number(s.match(/DEF\s*(\d+)/)?.[1]||0);
    const alert=document.querySelector('[role="alert"]')?.textContent||'';
    const gameOver=!!document.querySelector('[aria-label="Game Over"]');
    return {stage:Number(stage),hp,def,alert,gameOver};
  });
}
async function clickCell(p) {
  await page.locator(`button[aria-label*=" row ${p.row+1} column ${p.col+1}"]`).first().click({ force: true });
}
async function handleIntro() {
  const intro=page.locator('[role="dialog"][aria-label^="Stage "]');
  if(await intro.count()) { await shot(`stage-${(await status()).stage}-intro`); await intro.click({ position:{x:40,y:40}, force:true }); await wait(250); }
}
async function waitTurnEnd() {
  for(let i=0;i<70;i++){
    if(await page.locator('[aria-label="Game Over"]').count()) return;
    if(await page.locator('[role="dialog"][aria-label^="Stage "]').count()) return;
    const disabled=await page.locator('button[aria-label*=" orb row "]:disabled').count();
    if(disabled===0 && await page.locator('button[aria-label*=" orb row "]').count()===36){ await wait(120); return; }
    await wait(100);
  }
}

await page.goto('http://127.0.0.1:4173', { waitUntil:'networkidle', timeout:60000 });
await page.waitForSelector('[aria-label="Puzzle RPG title"]', { timeout:30000 });
await shot('00-title');
const preloadedAtTitle = await page.evaluate(() => performance.getEntriesByType('resource').map(e=>e.name).filter(n=>/\/assets\/pixel8\/(warden|bastion|oracle|null-knight|trickster)\.png/.test(n)));
await page.getByRole('button',{name:/START GAME/}).click();
await page.waitForSelector('[role="dialog"][aria-label^="Stage "]');
const introImage = await page.locator('[data-pixel-sprite="enemy"][data-intro="true"]').evaluate(img=>({complete:img.complete,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,src:img.currentSrc}));
await shot('01-intro');
await handleIntro();
await page.waitForSelector('button[aria-label*=" orb row "]');
await shot('02-battle');

const report={viewport:{w:402,h:874},preloadedAtTitle:preloadedAtTitle.length,preloadResources:preloadedAtTitle,introImage,states:[],errors,attackFx:false,damageFx:false,pinchSeen:false,criticalSeen:false};
let board=await readBoard();
let moves=allMoves(board);
report.initialFourMoves=moves.filter(m=>m.run>=4&&m.matches>=4).length;
report.initialMatch3Moves=moves.filter(m=>m.matches>=3).length;

for(let turn=1;turn<=22;turn++){
  await handleIntro();
  let st=await status(); if(st.gameOver) break;
  board=await readBoard(); moves=allMoves(board);
  const four=moves.filter(m=>m.run>=4&&m.matches>=4).length;
  const playable=moves.filter(m=>m.matches>=3);
  let choice=[...playable].sort((a,b)=> (b.attack*10+b.run*3-b.resource*6)-(a.attack*10+a.run*3-a.resource*6))[0];
  if(!choice) choice=[...moves].sort((a,b)=>b.run-a.run)[0];
  report.states.push({turn,...st,fourMoves:four,matchMoves:playable.length,choice:{run:choice.run,attack:choice.attack,matches:choice.matches}});
  await clickCell(choice.a);
  if(turn===1) await shot('03-selection');
  await clickCell(choice.b);
  try { await page.waitForSelector('em:text-is("HIT!")',{state:'visible',timeout:1400}); if(!report.attackFx){report.attackFx=true;await shot('04-attack-fx');} } catch {}
  try { await page.waitForFunction(()=>Array.from(document.querySelectorAll('span')).some(s=>/^-\d+ HP$/.test((s.textContent||'').trim())),{}, {timeout:1500}); if(!report.damageFx){report.damageFx=true;await shot('05-damage-fx');} } catch {}
  await waitTurnEnd();
  st=await status();
  if(st.alert && !report.pinchSeen){report.pinchSeen=true;await shot('06-danger');}
  if(st.alert.includes('CRITICAL') && !report.criticalSeen){report.criticalSeen=true;await shot('07-critical');}
  if(st.gameOver){await shot('08-game-over');break;}
}
const finalStatus=await status();
report.finalStatus=finalStatus;
report.bodyMetrics=await page.evaluate(()=>({scrollHeight:document.body.scrollHeight,clientHeight:document.body.clientHeight,innerHeight:window.innerHeight,tiles:document.querySelectorAll('button[aria-label*=" orb row "]').length}));
report.errors=[...errors];
await shot('99-final');
await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
await browser.close();
console.log(JSON.stringify(report,null,2));
