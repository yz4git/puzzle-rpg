import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const url = process.env.PLAYCHECK_URL ?? 'https://yz4git.github.io/puzzle-rpg/';
const outputDir = process.env.PLAYCHECK_OUTPUT ?? path.join(process.cwd(), 'playcheck-artifacts');
await mkdir(outputDir, { recursive: true });

const report = {
  url,
  startedAt: new Date().toISOString(),
  assertions: [],
  scenes: [],
  consoleErrors: [],
  pageErrors: [],
  failedResponses: [],
};
const assert = (name, pass, detail = {}) => report.assertions.push({ name, pass: Boolean(pass), ...detail });
const browser = await chromium.launch({ headless: true });

function baseSave(overrides = {}) {
  return {
    version: 1,
    playerName: 'LIO',
    level: 1,
    exp: 0,
    hp: 22,
    maxHp: 22,
    gold: 18,
    mapId: 'world',
    position: { x: 8, y: 23 },
    direction: 'right',
    lastInn: { mapId: 'hearthVillage', position: { x: 8, y: 10 } },
    inventory: [{ id: 'herb', count: 2 }, { id: 'smoke', count: 1 }],
    inventorySlots: 4,
    equipmentOwned: ['travellerCoat'],
    equipment: { weapon: null, armor: 'travellerCoat', charm: null },
    techniques: [],
    techniqueSlots: 2,
    memos: [{ id: 'journey', title: '最初の旅', text: '北のOld Templeへ向かう。', read: false }],
    flags: ['story:openingSeen'],
    openedChests: [],
    defeatedEncounters: [],
    defeatedEnemies: {},
    releasedEnemies: {},
    battleLog: [],
    steps: 20,
    playSeconds: 60,
    encounterMeter: 12,
    settings: { music: false, sfx: false },
    ...overrides,
  };
}

async function makePage(tag) {
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    screen: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'ja-JP',
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  page.on('console', msg => { if (msg.type() === 'error') report.consoleErrors.push(`${tag}: ${msg.text()}`); });
  page.on('pageerror', err => report.pageErrors.push(`${tag}: ${String(err)}`));
  page.on('response', res => {
    if (res.status() >= 400) report.failedResponses.push({ tag, status: res.status(), url: res.url() });
  });
  return { context, page };
}

async function gotoFresh(page, tag) {
  await page.goto(`${url}?live_playcheck=${encodeURIComponent(tag)}-${Date.now()}`, { waitUntil: 'networkidle', timeout: 60000 });
}

async function enterSeededRpg(page, tag, save) {
  await gotoFresh(page, tag);
  await page.evaluate(value => localStorage.setItem('puzzle-rpg:rpg-mode:v1', JSON.stringify(value)), save);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /RPG MODE/i }).tap();
  const cont = page.getByRole('button', { name: /CONTINUE/i });
  if (await cont.count()) await cont.first().tap();
  await page.waitForTimeout(350);
}

async function snapshot(page, name) {
  await page.waitForTimeout(320);
  const metrics = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')].filter(el => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return s.visibility !== 'hidden' && s.display !== 'none' && r.width > 0 && r.height > 0
        && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    }).map(el => {
      const r = el.getBoundingClientRect();
      return {
        text: (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 120),
        aria: el.getAttribute('aria-label') || '',
        x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height),
      };
    });
    const overflow = [...document.querySelectorAll('body *')].map(el => {
      const r = el.getBoundingClientRect();
      return { tag: el.tagName, x: Math.round(r.x), right: Math.round(r.right), width: Math.round(r.width) };
    }).filter(v => v.width > 1 && (v.x < -2 || v.right > innerWidth + 2)).slice(0, 30);
    return {
      text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 10000),
      viewport: { width: innerWidth, height: innerHeight },
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      buttons,
      tinyButtons: buttons.filter(b => b.width < 44 || b.height < 44),
      overflow,
    };
  });
  report.scenes.push({ name, ...metrics });
  await page.screenshot({ path: path.join(outputDir, `${name}.png`), fullPage: true });
  return metrics;
}

async function bodyText(page) {
  return page.locator('body').innerText().then(text => text.replace(/\s+/g, ' '));
}

async function tap(page, name) {
  const button = page.getByRole('button', { name });
  if (!(await button.count())) return false;
  await button.first().tap({ force: true });
  await page.waitForTimeout(140);
  return true;
}

async function openCommand(page) {
  const launcher = page.getByRole('button', { name: /RPG COMMAND/i }).first();
  if (!(await launcher.count())) return null;
  await launcher.waitFor({ state: 'visible', timeout: 2500 });
  const ready = await launcher.isEnabled().catch(() => false)
    || await launcher.waitFor({ state: 'attached', timeout: 2500 }).then(async () => {
      const started = Date.now();
      while (Date.now() - started < 3200) {
        if (await launcher.isEnabled().catch(() => false)) return true;
        await page.waitForTimeout(120);
      }
      return false;
    }).catch(() => false);
  if (!ready) return null;
  await launcher.tap();
  const win = page.locator('[class*="commandWindow"]');
  await win.waitFor({ state: 'visible', timeout: 2500 });
  return win;
}

async function talkOnce(page) {
  const win = await openCommand(page);
  if (!win) return false;
  const talk = win.locator('button').filter({ hasText: 'TALK' }).first();
  if (!(await talk.count()) || !(await talk.isEnabled().catch(() => false))) return false;
  await talk.tap();
  return win.waitFor({ state: 'hidden', timeout: 2500 }).then(() => true).catch(() => false);
}

async function boardGroups(page) {
  const cells = page.locator('button[aria-label*=" row "][aria-label*=" column "]');
  const data = [];
  for (let i = 0; i < await cells.count(); i++) {
    const locator = cells.nth(i);
    const aria = await locator.getAttribute('aria-label');
    const match = aria?.match(/^(ATK|HEAL|BAR|SKIP)(?: panel)? row (\d+) column (\d+)$/i);
    if (!match || !(await locator.isEnabled().catch(() => false))) continue;
    data.push({ locator, type: match[1].toUpperCase(), row: +match[2], col: +match[3] });
  }
  const at = new Map(data.map(cell => [`${cell.row}:${cell.col}`, cell]));
  const seen = new Set();
  const groups = [];
  for (const start of data) {
    const key = `${start.row}:${start.col}`;
    if (seen.has(key)) continue;
    const stack = [start];
    const members = [];
    seen.add(key);
    while (stack.length) {
      const cell = stack.pop();
      members.push(cell);
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const next = at.get(`${cell.row + dr}:${cell.col + dc}`);
        if (!next || next.type !== start.type) continue;
        const nextKey = `${next.row}:${next.col}`;
        if (seen.has(nextKey)) continue;
        seen.add(nextKey);
        stack.push(next);
      }
    }
    if (members.length >= 2) groups.push({ type: start.type, size: members.length, locator: start.locator });
  }
  return groups.sort((a, b) => b.size - a.size);
}

async function tapGroup(page, preferredType = null) {
  const groups = await boardGroups(page);
  const chosen = (preferredType ? groups.find(group => group.type === preferredType) : null) ?? groups[0];
  if (!chosen) return null;
  await chosen.locator.tap({ force: true });
  return { type: chosen.type, size: chosen.size };
}

async function waitForTurnAdvance(page, before, timeout = 2200) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const text = await bodyText(page);
    const turn = Number(text.match(/TURN\s+(\d+)/i)?.[1] ?? 0);
    if (turn > before) return turn;
    await page.waitForTimeout(160);
  }
  return Number((await bodyText(page)).match(/TURN\s+(\d+)/i)?.[1] ?? 0);
}

async function useBattleItem(page, pattern) {
  const win = await openCommand(page);
  if (!win) return false;
  const itemRoot = win.locator('button').filter({ hasText: 'ITEM' }).first();
  if (!(await itemRoot.count())) return false;
  await itemRoot.tap({ force: true });
  const item = page.locator('[class*="commandWindow"] button').filter({ hasText: pattern }).first();
  if (!(await item.count())) {
    await page.locator('[class*="commandWindow"] button').filter({ hasText: 'CLOSE' }).first().tap({ force: true }).catch(() => {});
    return false;
  }
  await item.tap({ force: true });
  return true;
}

async function storedSave(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('puzzle-rpg:rpg-mode:v1') || '{}'));
}

// 1) Public title + Chapter Battle + a real adjacent cluster. Retry protects against animation/touch races.
{
  const { context, page } = await makePage('chapter');
  await gotoFresh(page, 'chapter');
  const title = await snapshot(page, '01-title');
  assert('Title exposes all three modes', /RPG MODE/i.test(title.text) && /CHAPTER BATTLE/i.test(title.text) && /PRISM OVERDRIVE/i.test(title.text));
  assert('Title controls meet 44px target', title.tinyButtons.length === 0, { tiny: title.tinyButtons });
  assert('Title has no horizontal overflow', title.overflow.length === 0, { overflow: title.overflow });
  await page.getByRole('button', { name: /CHAPTER BATTLE/i }).tap();
  const start = page.getByRole('button', { name: /BATTLE START/i });
  if (await start.count()) await start.tap();
  await page.waitForTimeout(450);
  const chapter = await snapshot(page, '02-chapter-live');
  const turn1 = Number(chapter.text.match(/TURN\s+(\d+)/i)?.[1] ?? 0);
  let turn2 = turn1;
  let chapterMove = null;
  for (let attempt = 0; attempt < 3 && turn2 <= turn1; attempt++) {
    chapterMove = await tapGroup(page);
    if (!chapterMove) break;
    turn2 = await waitForTurnAdvance(page, turn1, 1800);
    if (turn2 <= turn1) await page.waitForTimeout(350);
  }
  const chapterAfter = await snapshot(page, '03-chapter-after-move');
  turn2 = Number(chapterAfter.text.match(/TURN\s+(\d+)/i)?.[1] ?? turn2);
  assert('Chapter Battle accepts a real cluster move', Boolean(chapterMove) && turn2 > turn1, { turn1, turn2, chapterMove });
  assert('Chapter Battle has no failed touch layout', chapterAfter.tinyButtons.length === 0, { tiny: chapterAfter.tinyButtons });
  await context.close();
}

// 2) Field movement -> random encounter -> STATUS -> cluster -> TALK.
{
  const { context, page } = await makePage('normal-rpg');
  await enterSeededRpg(page, 'normal-rpg', baseSave({ position: { x: 8, y: 23 }, direction: 'right', encounterMeter: 3 }));
  const field = await snapshot(page, '04-rpg-field');
  assert('Seeded save reaches PRISM ROAD', /PRISM ROAD/i.test(field.text));
  assert('Field controls meet 44px target', field.tinyButtons.length === 0, { tiny: field.tinyButtons });
  for (let step = 0; step < 6 && !(await page.locator('main[data-enemy]').count()); step++) {
    await tap(page, 'Move right');
    await page.waitForTimeout(220);
  }
  await page.waitForTimeout(750);
  const battle = await snapshot(page, '05-rpg-encounter');
  assert('Field movement triggers RPG encounter', await page.locator('main[data-enemy]').count() > 0);
  assert('RPG battle controls meet 44px target', battle.tinyButtons.length === 0, { tiny: battle.tinyButtons });
  const beforeTurn = Number(battle.text.match(/TURN\s+(\d+)/i)?.[1] ?? 0);
  let win = await openCommand(page);
  const command = await snapshot(page, '06-rpg-command');
  assert('RPG command exposes TALK ITEM STATUS RUN', ['TALK', 'ITEM', 'STATUS', 'RUN'].every(value => command.text.includes(value)));
  await win.locator('button').filter({ hasText: 'STATUS' }).first().tap({ force: true });
  const status = await snapshot(page, '07-rpg-status');
  assert('STATUS is no-turn information', /STATUS • NO TURN/i.test(status.text) && /TECHNIQUES/i.test(status.text));
  await page.locator('[class*="commandWindow"] button').filter({ hasText: 'BACK' }).first().tap({ force: true });
  await page.locator('[class*="commandWindow"] button').filter({ hasText: 'CLOSE' }).first().tap({ force: true });
  const cleared = await tapGroup(page);
  const afterTurn = await waitForTurnAdvance(page, beforeTurn, 2200);
  const afterMove = await snapshot(page, '08-rpg-after-cluster');
  assert('RPG cluster advances turn', Boolean(cleared) && afterTurn > beforeTurn, { beforeTurn, afterTurn, cleared });
  const talked = await talkOnce(page);
  const talkTurn = await waitForTurnAdvance(page, afterTurn, 2400);
  const afterTalk = await snapshot(page, '09-rpg-after-talk');
  assert('TALK consumes one battle turn', talked && talkTurn > afterTurn && await page.locator('main[data-enemy]').count() > 0, { afterTurn, talkTurn });
  assert('Normal RPG battle stays inside viewport', afterTalk.overflow.length === 0, { overflow: afterTalk.overflow });
  await context.close();
}

// 3) Forest Wisp non-violent alternative resolution and persistence.
{
  const { context, page } = await makePage('release');
  await enterSeededRpg(page, 'release', baseSave({ position: { x: 10, y: 19 }, direction: 'right' }));
  await tap(page, /A\s*CHECK/i);
  await page.waitForTimeout(650);
  assert('A CHECK opens FOREST WISP fixed battle', /FOREST WISP/i.test((await snapshot(page, '10-wisp-battle')).text));
  for (let i = 1; i <= 3; i++) {
    const ok = await talkOnce(page);
    assert(`Forest Wisp TALK ${i} is clickable`, ok);
    await page.waitForTimeout(i === 3 ? 1150 : 1450);
  }
  const result = await snapshot(page, '11-release-result');
  assert('Three peaceful TALKs reach ANOTHER ANSWER', /ANOTHER ANSWER/i.test(result.text));
  assert('Release result controls meet 44px target', result.tinyButtons.length === 0, { tiny: result.tinyButtons });
  const released = await storedSave(page);
  assert('Release persists gentleHand', released.techniques?.includes('gentleHand'));
  assert('Release persists forestWisp flag', released.flags?.includes('release:forestWisp'));
  assert('Release clears fixed encounter', released.defeatedEncounters?.includes('world-wisp'));
  await tap(page, /CONTINUE/i);
  await page.waitForTimeout(450);
  assert('Release returns to field', /PRISM ROAD/i.test((await snapshot(page, '12-release-return')).text));
  await context.close();
}

// 4) HERB -> enemy action -> SMOKE escape -> inventory persistence.
{
  const { context, page } = await makePage('items');
  await enterSeededRpg(page, 'items', baseSave({ hp: 10, gold: 30, position: { x: 10, y: 19 }, direction: 'right' }));
  await tap(page, /A\s*CHECK/i);
  await page.waitForTimeout(650);
  let win = await openCommand(page);
  await win.locator('button').filter({ hasText: 'ITEM' }).first().tap({ force: true });
  win = page.locator('[class*="commandWindow"]');
  await win.locator('button').filter({ hasText: /HERB.*×2/i }).first().tap({ force: true });
  await page.waitForTimeout(1000);
  const herb = await snapshot(page, '13-after-herb');
  assert('HERB +6 then SOFT LIGHT -2 leaves 14/22', /HP 14\/22/i.test(herb.text));
  assert('HERB consumes one turn', /TURN 2/i.test(herb.text));
  win = await openCommand(page);
  await win.locator('button').filter({ hasText: 'ITEM' }).first().tap({ force: true });
  const itemPage = await snapshot(page, '14-item-count');
  assert('HERB decrements from two to one', /HERB ×1/i.test(itemPage.text));
  await page.locator('[class*="commandWindow"] button').filter({ hasText: /SMOKE.*×1/i }).first().tap({ force: true });
  await page.waitForTimeout(550);
  const escaped = await snapshot(page, '15-smoke-result');
  assert('SMOKE guarantees ESCAPED', /ESCAPED/i.test(escaped.text));
  assert('Escape result controls meet 44px target', escaped.tinyButtons.length === 0, { tiny: escaped.tinyButtons });
  const itemSaved = await storedSave(page);
  assert('Used HERB persists after escape', itemSaved.inventory?.find?.(value => value.id === 'herb')?.count === 1, { inventory: itemSaved.inventory });
  assert('Used SMOKE is removed after escape', !itemSaved.inventory?.some?.(value => value.id === 'smoke'), { inventory: itemSaved.inventory });
  await context.close();
}

// 5) Defeat -> 15% gold loss -> last inn recovery with progression intact.
{
  const { context, page } = await makePage('defeat');
  await enterSeededRpg(page, 'defeat', baseSave({
    hp: 1,
    gold: 100,
    position: { x: 10, y: 19 },
    direction: 'right',
    inventory: [{ id: 'herb', count: 2 }],
    techniques: ['gentleHand'],
    flags: ['story:openingSeen', 'test:progress'],
  }));
  await tap(page, /A\s*CHECK/i);
  await page.waitForTimeout(650);
  await talkOnce(page);
  await page.waitForTimeout(1500);
  const defeat = await snapshot(page, '16-defeat-result');
  assert('Enemy hit at 1 HP reaches YOU AWAKEN', /YOU AWAKEN/i.test(defeat.text));
  assert('Defeat report states 15 GOLD loss', /15 GOLD/i.test(defeat.text));
  assert('Defeat result controls meet 44px target', defeat.tinyButtons.length === 0, { tiny: defeat.tinyButtons });
  const recovered = await storedSave(page);
  assert('Defeat deducts exactly 15%', recovered.gold === 85, { gold: recovered.gold });
  assert('Defeat restores full HP', recovered.hp === recovered.maxHp && recovered.maxHp === 22, { hp: recovered.hp, maxHp: recovered.maxHp });
  assert('Defeat relocates to last inn', recovered.mapId === 'hearthVillage', { mapId: recovered.mapId });
  assert('Defeat keeps technique/equipment/progress', recovered.techniques?.includes('gentleHand') && recovered.equipment?.armor === 'travellerCoat' && recovered.flags?.includes('test:progress'));
  assert('Defeat keeps inventory', recovered.inventory?.find?.(value => value.id === 'herb')?.count === 2, { inventory: recovered.inventory });
  await tap(page, /CONTINUE/i);
  await page.waitForTimeout(500);
  const inn = await snapshot(page, '17-returned-to-inn');
  assert('CONTINUE returns to HEARTH VILLAGE', /HEARTH VILLAGE/i.test(inn.text));
  assert('Recovered field controls meet 44px target', inn.tinyButtons.length === 0, { tiny: inn.tinyButtons });
  await context.close();
}

// 6) First dungeon boss with real LV1 stats. The bot uses the same choices available to a player.
{
  const { context, page } = await makePage('boss');
  await enterSeededRpg(page, 'boss', baseSave({
    mapId: 'oldTemple',
    position: { x: 10, y: 4 },
    direction: 'up',
    hp: 22,
    maxHp: 22,
    exp: 19,
    gold: 0,
    inventory: [{ id: 'herb', count: 2 }],
    encounterMeter: 99,
  }));
  await tap(page, /A\s*CHECK/i);
  await page.waitForTimeout(650);
  const bossStart = await snapshot(page, '18-temple-boss');
  assert('A CHECK opens OLD TEMPLE KEEPER', /OLD TEMPLE KEEPER/i.test(bossStart.text));

  let actions = 0;
  let herbsUsed = 0;
  const decisions = [];
  while (actions < 45 && await page.locator('main[data-enemy]').count()) {
    const text = await bodyText(page);
    if (/VICTORY|YOU AWAKEN/i.test(text)) break;
    const hpMatch = text.match(/HP\s+(\d+)\/(\d+)\s+BAR\s+(\d+)\/30\s+FREE\s+(\d+)/i);
    const hp = Number(hpMatch?.[1] ?? 22);
    const maxHp = Number(hpMatch?.[2] ?? 22);
    const barrier = Number(hpMatch?.[3] ?? 0);
    const free = Number(hpMatch?.[4] ?? 0);
    const heavy = /NOW\s+!!\s+OLD GATE\s+7/i.test(text);
    const groups = await boardGroups(page);
    const best = type => groups.find(group => group.type === type);
    const attack = best('ATK');
    const heal = best('HEAL');
    const guard = best('BAR');
    const skip = best('SKIP');

    if (hp <= 6 && herbsUsed < 2) {
      const used = await useBattleItem(page, /HERB/i);
      if (used) {
        herbsUsed += 1;
        actions += 1;
        decisions.push({ action: 'HERB', hp, barrier, free, heavy });
        await page.waitForTimeout(1150);
        continue;
      }
    }

    let chosen = null;
    if (free > 0 && attack) chosen = attack;
    else if (free === 0 && skip && skip.size >= 2) chosen = skip;
    else if (heavy && barrier < 7 && guard) chosen = guard;
    else if (hp <= Math.max(9, maxHp - 8) && heal) chosen = heal;
    else if (barrier < 4 && guard && guard.size >= 3) chosen = guard;
    else if (attack) chosen = attack;
    else if (heal && hp < maxHp) chosen = heal;
    else chosen = groups[0];

    if (!chosen) break;
    decisions.push({ action: chosen.type, size: chosen.size, hp, barrier, free, heavy });
    await chosen.locator.tap({ force: true });
    actions += 1;
    await page.waitForTimeout(1200);
  }

  const bossResult = await snapshot(page, '19-temple-result');
  assert('Temple boss can be defeated with real LV1 resources', /VICTORY/i.test(bossResult.text), { actions, herbsUsed, decisions });
  assert('Boss victory produces LEVEL UP', /LEVEL UP/i.test(bossResult.text), { text: bossResult.text.slice(0, 800) });
  assert('Boss result controls meet 44px target', bossResult.tinyButtons.length === 0, { tiny: bossResult.tinyButtons });
  const bossSave = await storedSave(page);
  assert('Boss victory raises level', Number(bossSave.level) >= 2, { level: bossSave.level, exp: bossSave.exp });
  assert('Temple boss grants finisher technique', bossSave.techniques?.includes('finisher'), { techniques: bossSave.techniques });
  assert('Temple boss flag persists', bossSave.flags?.includes('boss:templeKeeper'), { flags: bossSave.flags });
  assert('Temple fixed encounter is cleared', bossSave.defeatedEncounters?.includes('oldTemple-boss'), { defeatedEncounters: bossSave.defeatedEncounters });
  assert('Temple boss grants 30 GOLD', bossSave.gold === 30, { gold: bossSave.gold });
  await tap(page, /CONTINUE/i);
  await page.waitForTimeout(500);
  const templeReturn = await snapshot(page, '20-temple-return');
  assert('Boss victory returns to OLD TEMPLE', /OLD TEMPLE/i.test(templeReturn.text) && !/YOU AWAKEN/i.test(templeReturn.text));
  await tap(page, /A\s*CHECK/i);
  await page.waitForTimeout(500);
  assert('Cleared boss does not reopen when checked again', await page.locator('main[data-enemy]').count() === 0 && !/OLD TEMPLE KEEPER/i.test(await bodyText(page)));
  await context.close();
}

report.finishedAt = new Date().toISOString();
report.consoleErrors = [...new Set(report.consoleErrors)];
report.pageErrors = [...new Set(report.pageErrors)];
report.failedResponses = report.failedResponses.filter((value, index, all) => all.findIndex(item => item.status === value.status && item.url === value.url && item.tag === value.tag) === index);
await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();

const failures = report.assertions.filter(item => !item.pass);
const badResponses = report.failedResponses.filter(item => item.status >= 400);
if (failures.length || report.consoleErrors.length || report.pageErrors.length || badResponses.length) process.exitCode = 1;
