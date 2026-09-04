from pathlib import Path

path = Path('scripts/live-playcheck.mjs')
s = path.read_text()

anchor = '''async function openCommand(page) {\n'''
helper = '''async function startFixedBattle(page, expectedName, attempts = 6) {\n  const launcher = page.getByRole('button', { name: /RPG COMMAND/i }).first();\n  for (let attempt = 0; attempt < attempts; attempt++) {\n    if (await launcher.isVisible().catch(() => false)) {\n      const text = await bodyText(page);\n      return expectedName.test(text);\n    }\n    // A fixed encounter can be tapped during the short field-entry lock on a cold\n    // mobile load. Retrying A after the visual cue window is harmless: interact()\n    // ignores input while encounterCue is active.\n    await tap(page, /A\\s*CHECK/i);\n    await page.waitForTimeout(720);\n  }\n  const ready = await launcher.waitFor({ state: 'visible', timeout: 2500 }).then(() => true).catch(() => false);\n  return ready && expectedName.test(await bodyText(page));\n}\n\n'''
if 'async function startFixedBattle' not in s:
    if anchor not in s:
        raise SystemExit('openCommand anchor not found')
    s = s.replace(anchor, helper + anchor, 1)

old = '''  await tap(page, /A\\s*CHECK/i);\n  await page.waitForTimeout(650);\n  assert('A CHECK opens FOREST WISP fixed battle', /FOREST WISP/i.test((await snapshot(page, '10-wisp-battle')).text));\n'''
new = '''  const releaseBattleReady = await startFixedBattle(page, /FOREST WISP/i);\n  const releaseBattle = await snapshot(page, '10-wisp-battle');\n  assert('A CHECK opens FOREST WISP fixed battle', releaseBattleReady && /FOREST WISP/i.test(releaseBattle.text));\n'''
if old in s:
    s = s.replace(old, new, 1)

old = '''  await tap(page, /A\\s*CHECK/i);\n  // Wait on the actual player-facing command launcher. This survives cue timing\n  // changes and avoids relying on an implementation-specific battle root selector.\n  const itemLauncher = page.getByRole('button', { name: /RPG COMMAND/i }).first();\n  const itemBattleReady = await itemLauncher.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);\n  assert('Item route opens FOREST WISP battle', itemBattleReady && /FOREST WISP/i.test(await bodyText(page)));\n'''
new = '''  const itemBattleReady = await startFixedBattle(page, /FOREST WISP/i);\n  assert('Item route opens FOREST WISP battle', itemBattleReady);\n'''
if old in s:
    s = s.replace(old, new, 1)

old = '''  await tap(page, /A\\s*CHECK/i);\n  await page.waitForTimeout(650);\n  await talkOnce(page);\n'''
new = '''  const defeatBattleReady = await startFixedBattle(page, /FOREST WISP/i);\n  assert('Defeat route opens FOREST WISP battle', defeatBattleReady);\n  await talkOnce(page);\n'''
if old in s:
    s = s.replace(old, new, 1)

old = '''  await tap(page, /A\\s*CHECK/i);\n  await page.waitForTimeout(650);\n  const bossStart = await snapshot(page, '18-temple-boss');\n  assert('A CHECK opens OLD TEMPLE KEEPER', /OLD TEMPLE KEEPER/i.test(bossStart.text));\n'''
new = '''  const bossBattleReady = await startFixedBattle(page, /OLD TEMPLE KEEPER/i, 8);\n  const bossStart = await snapshot(page, '18-temple-boss');\n  assert('A CHECK opens OLD TEMPLE KEEPER', bossBattleReady && /OLD TEMPLE KEEPER/i.test(bossStart.text));\n'''
if old in s:
    s = s.replace(old, new, 1)

path.write_text(s)
