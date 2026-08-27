from pathlib import Path

path = Path("scripts/implement-chapter1-build.py")
text = path.read_text()
replacements = [
    ('replace_between("const ENEMIES: EnemyDef[] = [", "let tileId = 1;", chapter_data + "let tileId = 1;", "chapter data")',
     'replace_between("const ENEMIES: EnemyDef[] = [", "let tileId = 1;", chapter_data, "chapter data")'),
    ('function groupRank(count: number) {\'\'\'\nreplace_between("function enemyForStage(stage: number): EnemyDef {", "function groupRank(count: number) {", intent_block, "chapter intents")',
     '\'\'\'\nreplace_between("function enemyForStage(stage: number): EnemyDef {", "function groupRank(count: number) {", intent_block, "chapter intents")'),
    ('    const coolingActive =\'\'\'\nreplace_between("    let nextEnemyHp = enemyHp;", "    const coolingActive =", effect_block, "build effects")',
     '\'\'\'\nreplace_between("    let nextEnemyHp = enemyHp;", "    const coolingActive =", effect_block, "build effects")'),
    ('replace_between("      {stageClear ? (", "      {gameOver ? (", reward_overlay + "      {gameOver ? (", "reward overlay")',
     'replace_between("      {stageClear ? (", "      {gameOver ? (", reward_overlay, "reward overlay")'),
]
for old, new in replacements:
    if old not in text:
        raise RuntimeError(f"patcher fix marker missing: {old[:80]}")
    text = text.replace(old, new, 1)
path.write_text(text)
print("Chapter 1 patcher boundaries fixed")
