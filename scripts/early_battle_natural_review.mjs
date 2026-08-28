import { chromium } from 'playwright';
import fs from 'node:fs';

const outDir = 'review-output/early-battle-natural-20260828';
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'ja-JP' });
const page = await context.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));

async function tap(name, delay = 100) { await page.getByRole('button', { name, exact: true }).tap(); await page.waitForTimeout(delay); }
async function move(dir, count = 1) {
  const labels = { up:'Move up', down:'Move down', left:'Move left', right:'Move right' };
  for (let i=0;i<count;i++) await tap(labels[dir], 105);
}
async function dismissDialogue(max=20) {
  for (let i=0;i<max;i++) {
    const box = page.locator('div[data-story="event"], div[data-story="dialogue"]').first();
    if (!(await box.isVisible().catch(()=>false))) return;
    await box.tap({position:{x:190,y:90}}); await page.waitForTimeout(100);
  }
}
function parse(text) {
  const enemyName = (text.match(/^ENCOUNTER\n([^\n]+)/) || [])[1] || '';
  const hp = [...text.matchAll(/HP\s+(\d+)\/(\d+)/g)].map(m=>({current:Number(m[1]),max:Number(m[2])}));
  const turn = Number((text.match(/TURN\s+(\d+)/)||[])[1]||0);
  const now = text.match(/NOW[\s\S]*?\n([^\n]+)\n(\d+)\n([^\n]+)/);
  return { enemyName, turn, enemyHp:hp[0]||null, playerHp:hp[1]||null, nowLabel:now?.[1]||'', nowPower:Number(now?.[2]||0), nowDetail:now?.[3]||'' };
}
async function cells() {
  return page.locator('section[aria-label="RPG Cluster Break board"] button').evaluateAll(buttons => buttons.map(button => {
    const label=button.getAttribute('aria-label')||'';
    const m=label.match(/^(ATK|HEAL|BAR|SKIP) row (\d+) column (\d+)$/);
    return m?{label,type:m[1],row:Number(m[2]),col:Number(m[3]),disabled:button.disabled}:null;
  }).filter(Boolean));
}
function groups(cells) {
  const map=new Map(cells.map(c=>[`${c.row}:${c.col}`,c])); const seen=new Set(); const out=[];
  for (const c of cells) {
    const key=`${c.row}:${c.col}`; if(seen.has(key)||c.disabled) continue;
    const stack=[c], found=[]; seen.add(key);
    while(stack.length){const cur=stack.pop();found.push(cur);for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){const nk=`${cur.row+dr}:${cur.col+dc}`,n=map.get(nk);if(n&&!n.disabled&&n.type===c.type&&!seen.has(nk)){seen.add(nk);stack.push(n);}}}
    out.push({type:c.type,count:found.length,cells:found});
  }
  return out.sort((a,b)=>b.count-a.count);
}
async function waitTurn(prev) {
  await page.waitForTimeout(250);
  await page.waitForFunction(({prev})=>{const main=document.querySelector('main[data-enemy]');if(!main)return true;const m=main.innerText.match(/TURN\s+(\d+)/);return Number(m?.[1]||0)>prev;},{prev},{timeout:3000}).catch(()=>{});
  await page.waitForTimeout(220);
}

await page.goto('http://127.0.0.1:4173',{waitUntil:'networkidle'});
await page.evaluate(()=>localStorage.clear());
await page.reload({waitUntil:'networkidle'});
await page.getByRole('button',{name:/RPG MODE/}).tap();
await page.getByRole('button',{name:/NEW GAME/}).tap();
await page.waitForSelector('main[data-map="hearthVillage"]');
await dismissDialogue();
await page.waitForFunction(()=>!document.querySelector('div[data-story="event"]'));
await move('up',6); await move('right',1); await tap('A CHECK'); await dismissDialogue();
await move('down',8); await tap('A CHECK');
await page.waitForSelector('main[data-map="world"]'); await page.waitForFunction(()=>document.querySelector('main[data-area-phase="none"]'));
await move('right',4); await move('up',5); await tap('A CHECK');
await page.waitForSelector('main[data-map="oldTemple"]'); await page.waitForFunction(()=>document.querySelector('main[data-area-phase="none"]'));

const walk=['up','up','up','left','left','up','up','down','up','down','up','down','up','down','up','down','up','down','up','down','up','down','up','down','left','right','left','right'];
for(const dir of walk){
  if(await page.locator('main[data-enemy]').isVisible().catch(()=>false)) break;
  await tap({up:'Move up',down:'Move down',left:'Move left',right:'Move right'}[dir],105);
  const kind=await page.locator('main[data-encounter]').getAttribute('data-encounter').catch(()=>null);
  if(kind&&kind!=='none'){await page.waitForSelector('main[data-enemy]',{timeout:2500});break;}
}
await page.waitForSelector('main[data-enemy]',{timeout:5000}); await page.waitForTimeout(180);
await page.screenshot({path:`${outDir}/00-start.png`});

const records=[];
for(let i=0;i<12;i++){
  const battle=page.locator('main[data-enemy]'); if(!(await battle.isVisible().catch(()=>false))) break;
  const before=parse(await battle.innerText()); const gs=groups(await cells()); if(!gs.length) break;
  const best=t=>gs.filter(g=>g.type===t).sort((a,b)=>b.count-a.count)[0]||null;
  const c={ATK:best('ATK'),HEAL:best('HEAL'),BAR:best('BAR'),SKIP:best('SKIP')};
  let chosen=c.ATK||gs[0];
  if((before.playerHp?.current||20)<=9&&c.HEAL?.count>=2) chosen=c.HEAL;
  else if(!/BAR無視/.test(before.nowDetail)&&before.nowPower>=4&&c.BAR?.count>=before.nowPower) chosen=c.BAR;
  else if(c.ATK?.count>=2) chosen=c.ATK;
  else if(c.SKIP?.count>=3) chosen=c.SKIP;
  else chosen=gs[0];
  const seed=chosen.cells[0]; const started=Date.now();
  await page.getByRole('button',{name:seed.label,exact:true}).tap(); await waitTurn(before.turn);
  const still=await battle.isVisible().catch(()=>false); const after=still?parse(await battle.innerText()):null;
  records.push({before,largest:{ATK:c.ATK?.count||0,HEAL:c.HEAL?.count||0,BAR:c.BAR?.count||0,SKIP:c.SKIP?.count||0},chosen:{type:chosen.type,count:chosen.count},elapsedMs:Date.now()-started,after,stillBattle:still});
  if(i===2||i===5) await page.screenshot({path:`${outDir}/${String(i+1).padStart(2,'0')}-turn.png`});
  if(!still) break;
}
await page.waitForTimeout(650); await page.screenshot({path:`${outDir}/99-final.png`});
const finalSave=await page.evaluate(()=>JSON.parse(localStorage.getItem('puzzle-rpg:rpg-mode:v1')||'null'));
const finalText=(await page.locator('body').innerText()).slice(0,1800);
fs.writeFileSync(`${outDir}/battle.json`,JSON.stringify({records,errors,finalSave,finalText},null,2));
console.log('NATURAL EARLY BATTLE REVIEW',JSON.stringify({enemy:records[0]?.before.enemyName,turns:records.length,errors:errors.length,last:records.at(-1),save:finalSave&&{hp:finalSave.hp,level:finalSave.level,exp:finalSave.exp,gold:finalSave.gold}}));
await browser.close();
