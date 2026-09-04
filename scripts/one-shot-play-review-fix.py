from pathlib import Path

mode = Path('app/rpg/RPGMode.tsx')
s = mode.read_text()
if 'const VIEW_H = 15;' in s:
    s = s.replace('const VIEW_H = 15;', 'const VIEW_H = 17;', 1)
elif 'const VIEW_H = 17;' not in s:
    raise SystemExit('VIEW_H 15 anchor not found')
mode.write_text(s)

css_path = Path('app/rpg/RPGMode.module.css')
css = css_path.read_text()
marker = '/* Play review pass 36 — restore visible controls with a taller 13x17 world */'
if marker not in css:
    css += r'''

/* Play review pass 36 — restore visible controls with a taller 13x17 world */
/* fieldBrief is an in-flow grid child again; this prevents the controls from auto-placing into the zero-height row. */
.rpg{
  grid-template-rows:auto auto auto auto 42px minmax(150px,1fr);
  align-content:stretch;
}
.worldFrame{
  width:100%;
  aspect-ratio:13/17;
  justify-self:center;
}
.fieldBrief{
  position:relative;
  left:auto;
  right:auto;
  bottom:auto;
  z-index:7;
  margin:0 8px;
  padding:2px 0;
  display:block;
  pointer-events:none;
}
.fieldGoal{
  width:100%;
  max-width:none;
  min-height:38px;
  padding:4px 11px 4px 13px;
  background:linear-gradient(90deg,rgba(7,7,12,.95),rgba(7,7,12,.74) 72%,rgba(7,7,12,.20));
}
.fieldGoal small{display:none}
.fieldQuick{display:none}
.controls{
  min-height:150px;
  height:auto;
  margin:0;
  padding:5px 10px max(6px,env(safe-area-inset-bottom));
  align-self:stretch;
  align-items:center;
  background:radial-gradient(ellipse at 26% 50%,color-mix(in srgb,var(--accent2) 13%,transparent),transparent 34%),radial-gradient(ellipse at 79% 50%,color-mix(in srgb,var(--accent) 9%,transparent),transparent 34%),linear-gradient(180deg,rgba(6,6,11,.72),#020205 100%);
}
.controls::after{top:50%}
.abButtons{margin-top:0}
@media(max-height:700px){
  .rpg{grid-template-rows:auto auto auto auto 38px minmax(138px,1fr)}
  .worldFrame{
    width:min(100%,calc((100dvh - 260px) * 13 / 17));
    aspect-ratio:13/17;
  }
  .fieldBrief{margin-inline:5px;padding-block:1px}
  .fieldGoal{min-height:34px;padding-block:3px}
  .controls{min-height:138px}
}
@media(max-height:620px){
  .rpg{grid-template-rows:auto auto auto auto 34px minmax(132px,1fr)}
  .worldFrame{width:min(100%,calc((100dvh - 238px) * 13 / 17))}
  .fieldGoal{min-height:31px}
  .controls{min-height:132px}
}
'''
    css_path.write_text(css)

test_path = Path('scripts/live-playcheck.mjs')
t = test_path.read_text()
old = '''  for (let step = 0; step < 6 && !(await page.locator('main[data-enemy]').count()); step++) {
    await tap(page, 'Move right');
    await page.waitForTimeout(220);
  }
  await page.waitForTimeout(750);
  const battle = await snapshot(page, '05-rpg-encounter');
  assert('Field movement triggers RPG encounter', await page.locator('main[data-enemy]').count() > 0);
  assert('RPG battle controls meet 44px target', battle.tinyButtons.length === 0, { tiny: battle.tinyButtons });
  const beforeTurn = Number(battle.text.match(/TURN\\s+(\\d+)/i)?.[1] ?? 0);
  let win = await openCommand(page);
  const command = await snapshot(page, '06-rpg-command');
  assert('RPG command exposes TALK ITEM STATUS RUN', ['TALK', 'ITEM', 'STATUS', 'RUN'].every(value => command.text.includes(value)));
  await win.locator('button').filter({ hasText: 'STATUS' }).first().tap({ force: true });
'''
new = '''  const encounterLauncher = page.getByRole('button', { name: /RPG COMMAND/i }).first();
  for (let step = 0; step < 8; step++) {
    if (await encounterLauncher.isVisible().catch(() => false)) break;
    await tap(page, 'Move right');
    await page.waitForTimeout(260);
  }
  const encounterReady = await encounterLauncher.waitFor({ state: 'visible', timeout: 6000 }).then(() => true).catch(() => false);
  const battle = await snapshot(page, '05-rpg-encounter');
  assert('Field movement triggers RPG encounter', encounterReady, { text: battle.text.slice(0, 500) });
  assert('RPG battle controls meet 44px target', battle.tinyButtons.length === 0, { tiny: battle.tinyButtons });
  const beforeTurn = Number(battle.text.match(/TURN\\s+(\\d+)/i)?.[1] ?? 0);
  const win = encounterReady ? await openCommand(page) : null;
  const command = await snapshot(page, '06-rpg-command');
  assert('RPG command exposes TALK ITEM STATUS RUN', Boolean(win) && ['TALK', 'ITEM', 'STATUS', 'RUN'].every(value => command.text.includes(value)));
  if (!win) throw new Error('Normal RPG encounter did not expose an operable RPG COMMAND');
  await win.locator('button').filter({ hasText: 'STATUS' }).first().tap({ force: true });
'''
if old in t:
    t = t.replace(old, new, 1)
elif new not in t:
    raise SystemExit('normal encounter playcheck anchor not found')
old2 = "  assert('TALK consumes one battle turn', talked && talkTurn > afterTurn && await page.locator('main[data-enemy]').count() > 0, { afterTurn, talkTurn });"
new2 = "  assert('TALK consumes one battle turn', talked && talkTurn > afterTurn && await page.getByRole('button', { name: /RPG COMMAND/i }).count() > 0, { afterTurn, talkTurn });"
if old2 in t:
    t = t.replace(old2, new2, 1)
test_path.write_text(t)
