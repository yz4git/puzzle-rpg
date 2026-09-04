from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, got {count}: {old[:80]!r}")
    p.write_text(text.replace(old, new, 1))


battle = "app/rpg/RPGPuzzleBattle.tsx"
replace_once(
    battle,
    '  function adjustedIntent(step: number, currentEnemyHp: number, currentHp: number): EnemyIntentDefinition {\n    const base = effectiveEnemy.intents[step % effectiveEnemy.intents.length]!;',
    '  function adjustedIntent(step: number, currentEnemyHp: number, currentHp: number, overrides: { armorWeakened?: boolean; drainWeakened?: boolean } = {}): EnemyIntentDefinition {\n    const effectiveArmorWeakened = overrides.armorWeakened ?? armorWeakened;\n    const effectiveDrainWeakened = overrides.drainWeakened ?? drainWeakened;\n    const base = effectiveEnemy.intents[step % effectiveEnemy.intents.length]!;',
)
replace_once(
    battle,
    '    if (drainWeakened && base.kind === "drain") { power = Math.max(1, power - 2); detail = "TALKで弱体化"; }\n    if (enemy.id === "ironTyrant" && armorWeakened) { power = Math.max(1, power - 1); detail = `${detail} • TALKで構え崩れ`; }',
    '    if (effectiveDrainWeakened && base.kind === "drain") { power = Math.max(1, power - 2); detail = "TALKで弱体化"; }\n    if (enemy.id === "ironTyrant" && effectiveArmorWeakened) { power = Math.max(1, power - 1); detail = `${detail} • TALKで構え崩れ • BAR+2`; }',
)
replace_once(
    battle,
    '    if (type === "barrier") {\n      if (count >= 6 && hasTechnique("fortress")) bonus += 2;\n      if (currentHp <= 8 && hasTechnique("lastStand")) bonus += 3;\n    }',
    '    if (type === "barrier") {\n      if (count >= 6 && hasTechnique("fortress")) bonus += 2;\n      if (currentHp <= 8 && hasTechnique("lastStand")) bonus += 3;\n      // Once TALK breaks the Tyrant\'s shield rhythm, even modest BAR clusters\n      // become a reliable counter to his 4/6 adjusted attack cycle.\n      if (enemy.id === "ironTyrant" && armorWeakened) bonus += 2;\n    }',
)
replace_once(
    battle,
    '      setBarrier(nextBarrier); setMessage(`BAR×${count} → BAR +${gain}`); showEffect(`+${gain} BAR`, "barrier"); playSfx("shield");',
    '      setBarrier(nextBarrier);\n      const ironRhythm = enemy.id === "ironTyrant" && armorWeakened ? " • GUARD RHYTHM +2" : "";\n      setMessage(`BAR×${count} → BAR +${gain}${ironRhythm}`); showEffect(`+${gain} BAR`, "barrier"); playSfx("shield");',
)
replace_once(
    battle,
    '  async function resolveEnemyTurn(currentHp: number, currentBarrier: number, currentEnemyHp: number, currentFree: number, currentStats: BattleStats) {',
    '  async function resolveEnemyTurn(currentHp: number, currentBarrier: number, currentEnemyHp: number, currentFree: number, currentStats: BattleStats, intentOverrides: { armorWeakened?: boolean; drainWeakened?: boolean } = {}) {',
)
replace_once(
    battle,
    '    const action = adjustedIntent(intentStep, currentEnemyHp, currentHp);',
    '    const action = adjustedIntent(intentStep, currentEnemyHp, currentHp, intentOverrides);',
)
replace_once(
    battle,
    '    if (enemy.id.includes("iron") || enemy.id === "ironTyrant") setArmorWeakened(true);\n    if ((enemy.id === "scarletOracle" && save.memos.some((memo) => memo.id === "red-spring")) || enemy.id === "redHermit") setDrainWeakened(true);\n    let nextFree = free;',
    '    // React state updates are asynchronous, so carry the newly activated TALK\n    // weakness into this very enemy response instead of waiting one extra turn.\n    const nextArmorWeakened = armorWeakened || enemy.id.includes("iron");\n    const nextDrainWeakened = drainWeakened || ((enemy.id === "scarletOracle" && save.memos.some((memo) => memo.id === "red-spring")) || enemy.id === "redHermit");\n    if (nextArmorWeakened !== armorWeakened) setArmorWeakened(true);\n    if (nextDrainWeakened !== drainWeakened) setDrainWeakened(true);\n    let nextFree = free;',
)
replace_once(
    battle,
    '    const result = await resolveEnemyTurn(hp, barrier, enemyHp, nextFree, nextStats);',
    '    const result = await resolveEnemyTurn(hp, barrier, enemyHp, nextFree, nextStats, { armorWeakened: nextArmorWeakened, drainWeakened: nextDrainWeakened });',
)

replace_once(
    "app/rpg/data/enemies.ts",
    '    intents: [hit("SHIELD BASH", 5), heavy("IRON CRUSH", 7)], talk: "城壁の外にいる者を守るため、門を閉ざしたと言う。", conditionalTalk: "盾の構えが揺らぎ、IRON ARMORと攻撃の勢いが1弱まった。",',
    '    intents: [hit("SHIELD BASH", 5), heavy("IRON CRUSH", 7)], talk: "城壁の外にいる者を守るため、門を閉ざしたと言う。", conditionalTalk: "盾の構えが揺らぐ。IRON ARMORと攻撃-1、こちらのBAR効果+2。",',
)

replace_once(
    "app/rpg/RPGMode.tsx",
    '  if (flag("boss:scarletOracle")) return { title: "IRON CITY", text: "SCARLET ORACLEを越えた。IRON CITYへ戻り、鍛冶屋で装備とGUARD STONEを整えてIRON TYRANTと向き合う。" };',
    '  if (flag("boss:scarletOracle")) return { title: "IRON CITY", text: "鍛冶屋でIRON SWORD + GUARD STONEを準備 → 王座のIRON TYRANTへ。" };',
)

css_path = Path("app/rpg/RPGMode.module.css")
css = css_path.read_text()
marker = "/* Iron Tyrant guidance readability — portrait iPhone */"
if marker not in css:
    css += '''\n\n/* Iron Tyrant guidance readability — portrait iPhone */\n.fieldGoal{min-height:46px}\n.fieldGoal small{display:block;margin-top:2px;color:#bdb7c1;font-size:6.2px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n@media(max-height:700px){.fieldGoal{min-height:39px}.fieldGoal small{display:block;font-size:5.5px;margin-top:1px}}\n@media(max-height:620px){.fieldGoal small{display:none}}\n'''
    css_path.write_text(css)

replace_once(
    "scripts/live-playcheck.mjs",
    "  assert('Iron Tyrant accepts armor-weakening TALK', ironTalk && /IRON TYRANT/i.test(await bodyText(page)));",
    "  const ironAfterTalk = await bodyText(page);\n  assert('Iron Tyrant TALK weakens the immediate counterattack', ironTalk && /HP\\s+20\\/24/i.test(ironAfterTalk) && /TALKで構え崩れ/i.test(ironAfterTalk) && /BAR\\+2/i.test(ironAfterTalk), { text: ironAfterTalk.slice(0, 1400) });",
)

print("Iron Tyrant tactical counterplay + field guidance patch applied")
