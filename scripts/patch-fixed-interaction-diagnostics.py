from pathlib import Path

path = Path('scripts/live-playcheck.mjs')
text = path.read_text()
old = r'''async function startFixedBattle(page, expectedName, attempts = 6) {
  const launcher = page.getByRole('button', { name: /RPG COMMAND/i }).first();
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (await launcher.isVisible().catch(() => false)) {
      const text = await bodyText(page);
      return expectedName.test(text);
    }
    // A fixed encounter can be tapped during the short field-entry lock on a cold
    // mobile load. Retrying A after the visual cue window is harmless: interact()
    // ignores input while encounterCue is active.
    await tap(page, /A\s*CHECK/i);
    await page.waitForTimeout(720);
  }
  const ready = await launcher.waitFor({ state: 'visible', timeout: 2500 }).then(() => true).catch(() => false);
  return ready && expectedName.test(await bodyText(page));
}'''
new = r'''async function startFixedBattle(page, expectedName, attempts = 6) {
  const launcher = page.getByRole('button', { name: /RPG COMMAND/i }).first();
  const action = page.getByRole('button', { name: /A\s*CHECK/i }).first();
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (await launcher.isVisible().catch(() => false)) {
      const text = await bodyText(page);
      return expectedName.test(text);
    }
    const before = await action.evaluate(el => {
      const r = el.getBoundingClientRect();
      return {
        dataset: { ...el.dataset },
        disabled: el.disabled,
        rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
        visibility: getComputedStyle(el).visibility,
        pointerEvents: getComputedStyle(el).pointerEvents,
      };
    }).catch(error => ({ error: String(error) }));
    console.log(`FIXED_INTERACTION before ${String(expectedName)} #${attempt + 1}`, JSON.stringify(before));
    const tapped = await tap(page, /A\s*CHECK/i);
    await page.waitForTimeout(90);
    const after90 = await action.evaluate(el => ({ ...el.dataset })).catch(error => ({ error: String(error) }));
    const body90 = await bodyText(page);
    console.log(`FIXED_INTERACTION after90 ${String(expectedName)} #${attempt + 1}`, JSON.stringify({ tapped, state: after90, cue: /GUARDIAN|PATH BLOCKED/i.test(body90), enemyText: expectedName.test(body90) }));
    await page.waitForTimeout(630);
  }
  const ready = await launcher.waitFor({ state: 'visible', timeout: 2500 }).then(() => true).catch(() => false);
  return ready && expectedName.test(await bodyText(page));
}'''
if old not in text:
    if new in text:
        raise SystemExit(0)
    raise SystemExit('startFixedBattle block not found')
path.write_text(text.replace(old, new, 1))
