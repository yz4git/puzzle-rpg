from pathlib import Path
import re

root = Path('.')
tsx_path = root / 'app/rpg/RPGPuzzleBattle.tsx'
css_path = root / 'app/rpg/RPGPuzzleBattle.module.css'
progress_path = root / 'PROGRESS.md'

tsx = tsx_path.read_text()
css = css_path.read_text()

# 1) Types and stopwatch glyph for compact contexts.
tsx = tsx.replace(
    'type BattleImpact = "enemyHit" | "playerHit" | "heal" | "barrier" | "block" | "phase" | "release" | "skill" | "item" | null;\n',
    'type BattleImpact = "enemyHit" | "playerHit" | "heal" | "barrier" | "block" | "phase" | "release" | "skill" | "item" | null;\n'
    'type SkipFxState = { value: number; phase: "armed" | "tick" } | null;\n'
    'type GuardFxState = { phase: "block" | "break"; absorbed: number; damage: number } | null;\n'
)
tsx = tsx.replace(
    'const GLYPH: Record<PanelType, string> = { attack: "▲", heal: "♥", barrier: "◆", skip: "Ⅱ" };',
    'const GLYPH: Record<PanelType, string> = { attack: "▲", heal: "♥", barrier: "◆", skip: "◷" };'
)

# 2) Visual state.
tsx = tsx.replace(
    '  const [impact, setImpact] = useState<BattleImpact>(null);\n  const [talkOverlay, setTalkOverlay] = useState<{ speaker: string; text: string } | null>(null);',
    '  const [impact, setImpact] = useState<BattleImpact>(null);\n'
    '  const [skipFx, setSkipFx] = useState<SkipFxState>(null);\n'
    '  const [guardFx, setGuardFx] = useState<GuardFxState>(null);\n'
    '  const [talkOverlay, setTalkOverlay] = useState<{ speaker: string; text: string } | null>(null);'
)

# 3) SKIP application shows its full duration immediately.
old_skip = '''    } else {\n      const power = count + bonus;\n      nextFree += power;\n      setFree(nextFree); setMessage(`SKIP×${count} → FREE ${Math.max(0, nextFree - 1)}`); showEffect(`+${Math.max(0, power - 1)} FREE`); playSfx("skill");\n    }'''
new_skip = '''    } else {\n      const power = count + bonus;\n      nextFree += power;\n      setFree(nextFree);\n      setSkipFx({ value: nextFree, phase: "armed" });\n      setMessage(`SKIP×${count} → TIME STOP ${nextFree}`);\n      showEffect(`TIME STOP ${nextFree}`, "skill", 520);\n      playSfx("skill");\n    }'''
if old_skip not in tsx:
    raise SystemExit('skip branch anchor not found')
tsx = tsx.replace(old_skip, new_skip)

# 4) Replace enemy-turn resolution with staged time-stop and shield impact language.
pattern = re.compile(r'  async function resolveEnemyTurn\(currentHp: number, currentBarrier: number, currentEnemyHp: number, currentFree: number, currentStats: BattleStats\) \{.*?\n  \}\n\n  async function talk\(\)', re.S)
new_function = '''  async function resolveEnemyTurn(currentHp: number, currentBarrier: number, currentEnemyHp: number, currentFree: number, currentStats: BattleStats) {\n    if (currentFree > 0) {\n      const remaining = currentFree - 1;\n      setSkipFx({ value: remaining, phase: "tick" });\n      setMessage(`ENEMY TURN • TIME STOP ${currentFree} → ${remaining}`);\n      playSfx("skill");\n      await delay(480);\n      setFree(remaining);\n      if (remaining <= 0) {\n        setSkipFx(null);\n        setMessage("TIME STOP END • NEXT ENEMY TURN WILL ACT");\n        await delay(160);\n      } else {\n        setSkipFx({ value: remaining, phase: "armed" });\n      }\n      return { hp: currentHp, barrier: currentBarrier, enemyHp: currentEnemyHp, free: remaining, stats: currentStats };\n    }\n\n    const action = adjustedIntent(intentStep, currentEnemyHp, currentHp);\n    let damage = action.power;\n    let blocked = 0;\n    if (action.kind !== "pierce") {\n      blocked = Math.min(currentBarrier, damage);\n      currentBarrier -= blocked;\n      damage -= blocked;\n    }\n    const nextHp = Math.max(0, currentHp - damage);\n    const nextStats = { ...currentStats, blocked: currentStats.blocked + blocked };\n    if (damage === 0 && action.power > 0) {\n      nextStats.perfectBlocks += 1;\n      if (hasTechnique("ironBreath")) currentHp = Math.min(save.maxHp, currentHp + 1);\n      if (hasTechnique("counterwall") && nextStats.perfectBlocks === 2) currentEnemyHp = Math.max(0, currentEnemyHp - 2);\n    }\n    currentHp = damage === 0 && action.power > 0 ? currentHp : nextHp;\n\n    if (action.kind === "drain" && damage > 0) {\n      const extra = enemy.id === "scarletOracle" ? 2 : enemy.id === "marshLeech" ? 1 : 0;\n      currentEnemyHp = Math.min(effectiveEnemy.hp, currentEnemyHp + damage + extra);\n    }\n    if (action.kind === "disrupt") {\n      const amount = enemy.id === "prismSovereign" ? phase + 1 : 2;\n      setTiles((current) => {\n        const candidates = [...current.filter((tile) => tile.row >= 0)].sort(() => Math.random() - .5).slice(0, amount);\n        const ids = new Set(candidates.map((tile) => tile.id));\n        return current.map((tile) => ids.has(tile.id) ? { ...tile, type: randomPanel() } : tile);\n      });\n    }\n    if (action.kind === "seal") {\n      setTiles((current) => {\n        const candidate = current.find((tile) => tile.type === "skip" && tile.row >= 0);\n        return candidate ? current.map((tile) => tile.id === candidate.id ? { ...tile, type: "attack" } : tile) : current;\n      });\n    }\n\n    const attackSfx = action.kind === "heavy" ? "enemyHeavy" : action.kind === "drain" ? "enemyDrain" : action.kind === "pierce" ? "pierce" : action.kind === "disrupt" || action.kind === "seal" ? "enemyDisrupt" : "enemyAttack";\n    playSfx(attackSfx);\n\n    // Barrier feedback is deliberately staged: hit shield -> absorb -> break only if damage leaks through.\n    if (blocked > 0) {\n      setBarrier(currentBarrier);\n      setGuardFx({ phase: "block", absorbed: blocked, damage });\n      setMessage(`${action.label} • SHIELD ${blocked}`);\n      playSfx("shield");\n      await delay(damage > 0 ? 260 : 420);\n      if (damage > 0) {\n        setGuardFx({ phase: "break", absorbed: blocked, damage });\n        setMessage(`${action.label} • SHIELD BREAK • HP -${damage}`);\n        await delay(300);\n      } else {\n        setMessage(`${action.label} • PERFECT BLOCK ${blocked}`);\n      }\n      setGuardFx(null);\n    }\n\n    setHp(currentHp); setBarrier(currentBarrier); setEnemyHp(currentEnemyHp); setStats(nextStats); setIntentStep((step) => step + 1);\n    if (blocked === 0) setMessage(`${action.label} • ${damage > 0 ? `HP -${damage}` : "NO DAMAGE"}`);\n    if (damage > 0) showEffect(`-${damage} HP`, "playerHit");\n    else showEffect("PERFECT BLOCK", "block");\n    await delay(blocked > 0 ? 220 : 320);\n    if (currentEnemyHp <= 0 && !training) finish("victory", currentHp, inventory, nextStats);\n    if (currentHp <= 0) finish("defeat", 0, inventory, nextStats);\n    return { hp: currentHp, barrier: currentBarrier, enemyHp: currentEnemyHp, free: 0, stats: nextStats };\n  }\n\n  async function talk()'''
tsx, count = pattern.subn(new_function, tsx, count=1)
if count != 1:
    raise SystemExit(f'enemy turn replacement count={count}')

# 5) TALK/item-derived time stop should also visibly arm before the enemy turn.
tsx = tsx.replace(
    '    if (enemy.id === "voidHerald" && nextStats.skipUses >= 2) { nextFree += 1; setFree(nextFree); }\n    if (enemy.id === "ashCrow" && nextStats.skipUses >= 3) { nextFree += 1; setFree(nextFree); }',
    '    if (enemy.id === "voidHerald" && nextStats.skipUses >= 2) { nextFree += 1; setFree(nextFree); setSkipFx({ value: nextFree, phase: "armed" }); }\n'
    '    if (enemy.id === "ashCrow" && nextStats.skipUses >= 3) { nextFree += 1; setFree(nextFree); setSkipFx({ value: nextFree, phase: "armed" }); }'
)
tsx = tsx.replace(
    '      nextFree += 1; setFree(nextFree); setNullHesitated(true);',
    '      nextFree += 1; setFree(nextFree); setSkipFx({ value: nextFree, phase: "armed" }); setNullHesitated(true);'
)
tsx = tsx.replace(
    '    setHp(nextHp); setBarrier(nextBarrier); setFree(nextFree); setMessage(`${ITEMS[stack.id].name} USED`); showEffect(ITEMS[stack.id].description, "item");',
    '    setHp(nextHp); setBarrier(nextBarrier); setFree(nextFree);\n'
    '    if (nextFree > free) setSkipFx({ value: nextFree, phase: "armed" });\n'
    '    setMessage(`${ITEMS[stack.id].name} USED`); showEffect(ITEMS[stack.id].description, "item");'
)

# 6) Enemy attack frame also applies while shield feedback is playing.
tsx = tsx.replace(
    '      : impact === "playerHit"\n        ? "attack"',
    '      : impact === "playerHit" || guardFx\n        ? "attack"'
)

# 7) Derived display and overlays.
tsx = tsx.replace(
    '  const enemySprite = enemySpriteCell(enemy.id, enemyFrame);',
    '  const skipDisplayValue = skipFx?.value ?? (free > 0 ? free : null);\n'
    '  const enemySprite = enemySpriteCell(enemy.id, enemyFrame);'
)
tsx = tsx.replace(
    '      <section className={styles.enemyRow}>\n        <span className={styles.enemySprite} role="img" aria-label={enemy.name} style={enemySpriteStyle} />',
    '      <section className={styles.enemyRow}>\n'
    '        <span className={styles.enemySprite} role="img" aria-label={enemy.name} style={enemySpriteStyle} />\n'
    '        {skipDisplayValue !== null ? <div className={styles.skipEnemyOverlay} data-phase={skipFx?.phase ?? "armed"} data-zero={skipDisplayValue === 0 ? "true" : "false"} aria-label={`Enemy time stop ${skipDisplayValue}`}>\n'
    '          <i className={styles.stopwatchFace} aria-hidden="true" /><strong>{skipDisplayValue}</strong><span>{skipDisplayValue === 0 ? "TIME UP" : "TIME STOP"}</span>\n'
    '        </div> : null}'
)

tsx = tsx.replace(
    '      <section className={styles.board} aria-label="RPG Cluster Break board">\n        {tiles.map((tile) => <button',
    '      <section className={styles.board} aria-label="RPG Cluster Break board">\n'
    '        {guardFx ? <div className={styles.guardFx} data-phase={guardFx.phase} aria-label={guardFx.phase === "break" ? `Shield break, ${guardFx.damage} damage` : `Shield blocks ${guardFx.absorbed}`}>\n'
    '          <i className={styles.guardShield} aria-hidden="true" />\n'
    '          <strong>{guardFx.phase === "break" ? "SHIELD BREAK" : "BLOCK"}</strong>\n'
    '          <small>{guardFx.phase === "break" ? `BLOCK ${guardFx.absorbed} • ${guardFx.damage} DAMAGE` : `${guardFx.absorbed} DAMAGE ABSORBED`}</small>\n'
    '        </div> : null}\n'
    '        {tiles.map((tile) => <button'
)

tsx = tsx.replace(
    '        ><b>{GLYPH[tile.type]}</b><span>{LABEL[tile.type]}</span></button>)}',
    '        ><b className={tile.type === "skip" ? styles.stopwatchPanel : undefined}>{tile.type === "skip" ? "" : GLYPH[tile.type]}</b><span>{LABEL[tile.type]}</span></button>)}'
)

# 8) CSS: pixel stopwatch and large shield language.
css += r'''

/* Battle status legibility pass — stopwatch SKIP + shield interception */
.stopwatchPanel{
  position:relative;width:29px;height:29px;align-self:center!important;margin-top:2px;
  border:4px solid #fff078;border-radius:50%;background:#171207;box-shadow:inset 0 0 0 2px #6d5815,2px 2px #000;
  font-size:0!important;text-shadow:none!important;
}
.stopwatchPanel::before{content:"";position:absolute;left:50%;top:-9px;width:12px;height:5px;transform:translateX(-50%);background:#fff078;box-shadow:0 -2px #5b4911,9px 6px 0 -3px #fff078}
.stopwatchPanel::after{content:"";position:absolute;left:50%;top:50%;width:3px;height:10px;transform:translate(-50%,-88%) rotate(-28deg);transform-origin:50% 88%;background:#fff7bf;box-shadow:4px 7px 0 -1px #fff7bf}

.skipEnemyOverlay{position:absolute;z-index:8;left:4px;top:2px;width:112px;height:76px;display:grid;place-items:center;pointer-events:none;filter:drop-shadow(3px 4px 0 #000)}
.stopwatchFace{position:absolute;left:18px;top:10px;width:57px;height:57px;border:5px solid #ffe56d;border-radius:50%;background:#08080d;box-shadow:inset 0 0 0 3px #6d5818,0 0 0 2px #08080d}
.stopwatchFace::before{content:"";position:absolute;left:50%;top:-13px;width:20px;height:7px;transform:translateX(-50%);background:#ffe56d;box-shadow:0 -3px #5f4b13,15px 8px 0 -5px #ffe56d}
.stopwatchFace::after{content:"";position:absolute;left:50%;top:50%;width:4px;height:19px;transform:translate(-50%,-92%) rotate(-25deg);transform-origin:50% 92%;background:#fff4ae;box-shadow:7px 13px 0 -1px #fff4ae}
.skipEnemyOverlay>strong{position:absolute;z-index:2;left:46px;top:28px;min-width:31px;color:#fff7c9;font:1000 27px/1 monospace;text-align:center;text-shadow:2px 2px #000}
.skipEnemyOverlay>span{position:absolute;z-index:3;left:2px;right:2px;bottom:0;padding:3px 2px;border:2px solid #e9ca54;background:#09080d;color:#ffe56d;font:1000 6px/1 monospace;letter-spacing:.12em;text-align:center;box-shadow:2px 2px #000}
.skipEnemyOverlay[data-phase="tick"]{animation:stopwatchTick 480ms steps(6,end) both}
.skipEnemyOverlay[data-zero="true"] .stopwatchFace{border-color:#ff8b68;box-shadow:inset 0 0 0 3px #6e241d,0 0 0 2px #08080d}
.skipEnemyOverlay[data-zero="true"] .stopwatchFace::before{background:#ff8b68}.skipEnemyOverlay[data-zero="true"]>strong,.skipEnemyOverlay[data-zero="true"]>span{color:#ffb08c;border-color:#ff7c61}
@keyframes stopwatchTick{0%{filter:drop-shadow(3px 4px 0 #000) brightness(1)}18%{transform:translateX(-3px);filter:drop-shadow(3px 4px 0 #000) brightness(1.8)}36%{transform:translateX(3px)}54%{transform:translateX(-2px)}72%{transform:translateX(1px)}100%{transform:none;filter:drop-shadow(3px 4px 0 #000)}}

.guardFx{position:absolute;z-index:45;inset:0;display:grid;place-content:center;justify-items:center;gap:7px;pointer-events:none;background:rgba(1,8,13,.26);isolation:isolate}
.guardShield{position:relative;width:124px;height:140px;background:#65daf3;clip-path:polygon(50% 0,88% 14%,84% 62%,72% 80%,50% 100%,28% 80%,16% 62%,12% 14%);filter:drop-shadow(0 0 0 #fff) drop-shadow(5px 6px 0 #000);animation:shieldCatch 420ms steps(6,end) both}
.guardShield::before{content:"";position:absolute;inset:9px;background:#0b5f78;clip-path:inherit;box-shadow:inset 0 0 0 5px #bff7ff}
.guardShield::after{content:"";position:absolute;left:48%;top:19%;width:8px;height:65%;background:#d7fbff;transform:rotate(8deg);box-shadow:-24px 23px 0 -2px #d7fbff,26px 30px 0 -2px #d7fbff}
.guardFx>strong{padding:5px 11px;border:3px solid #d9fbff;background:#07131a;color:#c9f7ff;font:1000 19px/1 monospace;letter-spacing:.06em;text-shadow:2px 2px #000;box-shadow:4px 4px #000}
.guardFx>small{padding:3px 7px;background:#07090e;color:#8ee8f7;font:1000 7px/1 monospace;letter-spacing:.08em;box-shadow:2px 2px #000}
.guardFx[data-phase="break"]{background:rgba(19,3,6,.32)}
.guardFx[data-phase="break"] .guardShield{background:#ff8071;animation:shieldBreak 300ms steps(6,end) both}
.guardFx[data-phase="break"] .guardShield::before{background:#6b2030}
.guardFx[data-phase="break"] .guardShield::after{background:#fff0df;transform:rotate(38deg);box-shadow:-22px 24px 0 -2px #fff0df,23px 33px 0 -2px #fff0df}
.guardFx[data-phase="break"]>strong{border-color:#ffb293;color:#ffd0b7;background:#1b090c}
.guardFx[data-phase="break"]>small{color:#ffad91}
@keyframes shieldCatch{0%{opacity:0;transform:scale(.48);filter:brightness(2.5) drop-shadow(5px 6px 0 #000)}22%{opacity:1;transform:scale(1.12)}48%{transform:scale(.94)}70%{transform:scale(1.03)}100%{opacity:1;transform:scale(1);filter:brightness(1) drop-shadow(5px 6px 0 #000)}}
@keyframes shieldBreak{0%{opacity:1;transform:translate(0) scale(1);filter:brightness(2) drop-shadow(5px 6px 0 #000)}22%{transform:translate(-5px,2px) rotate(-3deg) scale(1.05)}44%{transform:translate(6px,-3px) rotate(4deg) scale(.97)}66%{opacity:1;transform:translate(-4px,5px) rotate(-5deg) scale(.91)}100%{opacity:0;transform:translate(8px,18px) rotate(8deg) scale(.65);filter:brightness(.7) drop-shadow(5px 6px 0 #000)}}
@media(max-height:700px){.skipEnemyOverlay{transform:scale(.9);transform-origin:left top}.guardShield{width:106px;height:120px}.guardFx>strong{font-size:16px}.stopwatchPanel{width:25px;height:25px;border-width:3px}}
@media(prefers-reduced-motion:reduce){.skipEnemyOverlay[data-phase="tick"],.guardShield,.guardFx[data-phase="break"] .guardShield{animation-duration:1ms!important}}
'''

tsx_path.write_text(tsx)
css_path.write_text(css)

if progress_path.exists():
    with progress_path.open('a') as f:
        f.write('\n\n## Battle Stopwatch / Shield Feedback Pass\n')
        f.write('- Replaced SKIP panel art with a stopwatch motif; NEXT preview also uses a time glyph.\n')
        f.write('- TIME STOP now overlays the enemy with remaining turns and visibly ticks to 0 on the skipped enemy turn before disappearing.\n')
        f.write('- Barrier attacks now stage a large shield over the board; full absorption reads BLOCK, overflow visibly breaks the shield before HP damage appears.\n')
        f.write('- Existing FREE, barrier, intent, damage, training, rewards, and save semantics remain unchanged.\n')
