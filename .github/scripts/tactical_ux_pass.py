from pathlib import Path

TSX = Path('app/PuzzleRPGGame.tsx')
CSS = Path('app/PuzzleRPGGame.module.css')
tsx = TSX.read_text()
css = CSS.read_text()

def rep(src: str, old: str, new: str, label: str, count: int = 1) -> str:
    if old not in src:
        raise SystemExit(f'missing patch target: {label}')
    return src.replace(old, new, count)

# React type for CSS custom properties used by attack trajectories.
tsx = rep(tsx,
'import { useMemo, useState } from "react";',
'import { useMemo, useState, type CSSProperties } from "react";',
'import')

# New presentation/gameplay state.
tsx = rep(tsx,
'  const [stageClear, setStageClear] = useState<StageClearState>(null);',
'  const [stageClear, setStageClear] = useState<StageClearState>(null);\n  const [showTitle, setShowTitle] = useState(true);\n  const [damageTaken, setDamageTaken] = useState(0);\n  const [attackSources, setAttackSources] = useState<Coord[]>([]);',
'states')

# Reset presentation state but keep reset inside the run rather than reopening title.
tsx = rep(tsx,
'    setStageClear(null);\n  }',
'    setStageClear(null);\n    setDamageTaken(0);\n    setAttackSources([]);\n  }',
'reset state')

# DEF carry-over decay.
tsx = rep(tsx,
'    setStage(nextStage);\n    setEnemyHp(enemyMaxHp(nextStage));',
'    setPlayerShield((value) => Math.floor(value * 0.5));\n    setStage(nextStage);\n    setEnemyHp(enemyMaxHp(nextStage));',
'def carry decay')

# Queue override lets Prism Shift deliberately alter the selected column NEXT.
tsx = rep(tsx,
'  async function resolveTurn(nextBoard: Board, consumeSkill = false, skillLabel?: string, swapPair?: [Coord, Coord]) {\n    if (isResolving || gameOver || stageIntro || stageClear) return;',
'  async function resolveTurn(nextBoard: Board, consumeSkill = false, skillLabel?: string, swapPair?: [Coord, Coord], queueOverride?: ColumnQueues) {\n    if (isResolving || gameOver || showTitle || stageIntro || stageClear) return;',
'resolve signature')

tsx = rep(tsx,
'    const plan = buildCascadePlan(nextBoard, columnQueues);',
'    const startingQueues = queueOverride ?? columnQueues;\n    const plan = buildCascadePlan(nextBoard, startingQueues);\n    const isSetupTurn = plan.frames.length === 0 && !consumeSkill;\n    const attackSourceList: Coord[] = [];\n    for (const frame of plan.frames) {\n      for (const key of frame.matches) {\n        const [rowText, colText] = key.split(":");\n        const row = Number(rowText);\n        const col = Number(colText);\n        if (ATTACK_PER_ORB[frame.boardBefore[row]![col]!] > 0) attackSourceList.push({ row, col });\n      }\n    }',
'plan setup')

# SETUP is now a deliberate defensive/focus action. Normal matches charge Prism more slowly.
tsx = rep(tsx,
'    const skillGain = Math.min(36, plan.matchedCount * 3 + Math.max(0, plan.combo - 1) * 4);\n    setSkill(consumeSkill ? skillGain : Math.min(100, skill + skillGain));',
'    const skillGain = isSetupTurn\n      ? 28\n      : Math.min(20, plan.matchedCount * 2 + Math.max(0, plan.combo - 1) * 4);\n    setSkill(consumeSkill ? skillGain : Math.min(100, skill + skillGain));',
'skill tuning')

# Richer result chips for intentional setup and Prism/NEXT interaction.
tsx = rep(tsx,
'    if (plan.frames.length === 0) chips.push("SETUP");\n    setResultChips(chips);',
'    if (isSetupTurn) {\n      chips.push("TACTICAL SETUP");\n      chips.push("INTENT 50%");\n      chips.push("PRISM +28");\n    } else if (plan.frames.length === 0) {\n      chips.push("SHIFT SETUP");\n    }\n    if (consumeSkill) chips.push("NEXT RECYCLE");\n    setResultChips(chips);',
'result chips')

# Player attack originates from matched attack panels and converges on the enemy.
tsx = rep(tsx,
'    if (actualAttack > 0 || plateBlocks) {\n      setResolutionPhase("attack");\n      setCombatPop(plateBlocks ? "PLATE BLOCK" : `${actualAttack} DMG`);\n      await delay(260);\n    }',
'    if (actualAttack > 0 || plateBlocks) {\n      setAttackSources(attackSourceList.slice(0, 10));\n      setResolutionPhase("attack");\n      setCombatPop(plateBlocks ? "PLATE BLOCK" : `${actualAttack} DMG`);\n      await delay(340);\n      setAttackSources([]);\n    }',
'attack timing')

# Setup halves this turn's incoming power while preserving enemy special behavior.
tsx = rep(tsx,
'    const enemyResult = computeEnemyAction(\n      intent,',
'    const effectiveIntent = isSetupTurn\n      ? { ...intent, power: Math.max(1, Math.ceil(intent.power * 0.5)) }\n      : intent;\n    const enemyResult = computeEnemyAction(\n      effectiveIntent,',
'effective intent')

# Stronger actual-damage feedback and slightly longer hit beat.
tsx = rep(tsx,
'    setResolutionPhase("enemy");\n    setCombatPop(enemyResult.hpDamage > 0 ? `-${enemyResult.hpDamage} HP` : `BLOCK ${enemyResult.blocked}`);\n    await delay(250);',
'    setDamageTaken(enemyResult.hpDamage);\n    setResolutionPhase("enemy");\n    setCombatPop(enemyResult.hpDamage > 0 ? `-${enemyResult.hpDamage} HP` : `BLOCK ${enemyResult.blocked}`);\n    await delay(enemyResult.hpDamage > 0 ? 420 : 280);',
'damage beat')

# Setup wording and clear damage flash after the post-hit hold.
tsx = rep(tsx,
'      plan.frames.length === 0\n        ? `SETUP • ${enemyResult.summary}`',
'      isSetupTurn\n        ? `TACTICAL SETUP • PRISM +28 • ${enemyResult.summary}`\n        : plan.frames.length === 0\n          ? `SHIFT SETUP • ${enemyResult.summary}`',
'message setup')

tsx = rep(tsx,
'    await delay(330);\n    setCombatPop("");\n    setResultChips([]);',
'    await delay(330);\n    setDamageTaken(0);\n    setCombatPop("");\n    setResultChips([]);',
'clear damage')

# Selection guidance.
tsx = rep(tsx,
'  function selectCell(row: number, col: number) {\n    if (gameOver || isResolving) return;',
'  function selectCell(row: number, col: number) {\n    if (gameOver || showTitle || stageIntro || stageClear || isResolving) return;',
'select guard')

tsx = rep(tsx,
'    if (!selected) {\n      setSelected(nextCoord);\n      return;\n    }',
'    if (!selected) {\n      setSelected(nextCoord);\n      setMessage("①選択中 • ②光っている隣接パネルを選択");\n      return;\n    }',
'first select')

tsx = rep(tsx,
'    if (selected.row === row && selected.col === col) {\n      setSelected(null);\n      return;\n    }',
'    if (selected.row === row && selected.col === col) {\n      setSelected(null);\n      setMessage("選択解除 • 交換する1枚目を選択");\n      return;\n    }',
'deselect')

tsx = rep(tsx,
'    if (!adjacent(selected, nextCoord)) {\n      setSelected(nextCoord);\n      return;\n    }',
'    if (!adjacent(selected, nextCoord)) {\n      setSelected(nextCoord);\n      setMessage("①選択を変更 • ②光っている隣接パネルを選択");\n      return;\n    }',
'non adjacent selection')

# Prism Shift recycles the original orb into that column's first NEXT.
tsx = rep(tsx,
'    transformed[selected.row]![selected.col] = orb;\n    void resolveTurn(transformed, true, `SHIFT ${ORB_LABEL[before]}→${ORB_LABEL[orb]}`);',
'    transformed[selected.row]![selected.col] = orb;\n    const recycledQueues = cloneQueues(columnQueues);\n    recycledQueues[selected.col]![0] = before;\n    setColumnQueues(recycledQueues);\n    void resolveTurn(transformed, true, `SHIFT ${ORB_LABEL[before]}→${ORB_LABEL[orb]} • NEXT↺`, undefined, recycledQueues);',
'prism recycle')

# Title-aware shell and stronger screen shake state.
tsx = rep(tsx,
'  return (\n    <main className={styles.shell}>',
'  return (\n    <main className={`${styles.shell} ${damageTaken > 0 ? styles.shellDamaged : ""}`}>',
'shell class')

# Add face and weapon pieces to the in-battle enemy illustration.
tsx = rep(tsx,
'          <span className={styles.enemyCore}>{ENEMY_SIGIL[enemy.kind]}</span>\n          <span className={styles.enemyBase} />',
'          <span className={styles.enemyCore}>{ENEMY_SIGIL[enemy.kind]}</span>\n          <span className={styles.enemyFace}><i /><i /></span>\n          <span className={styles.enemyWeapon} />\n          <span className={styles.enemyBase} />',
'battle enemy character')

# Replace player attack render with panel-origin motes.
tsx = rep(tsx,
'      {resolutionPhase === "attack" ? (\n        <div className={styles.playerAttackFx} aria-hidden="true"><i /><i /><i /></div>\n      ) : null}',
'      {resolutionPhase === "attack" ? (\n        <div className={styles.playerAttackFx} aria-hidden="true">\n          {attackSources.map((cell, index) => (\n            <i\n              key={`${cell.row}-${cell.col}-${index}`}\n              style={{\n                "--sx": `${3 + ((cell.col + 0.5) / SIZE) * 94}%`,\n                "--sy": `${49 + ((cell.row + 0.5) / SIZE) * 43}%`,\n                "--delay": `${index * 0.025}s`,\n              } as CSSProperties}\n            />\n          ))}\n          <b />\n        </div>\n      ) : null}',
'attack render')

# Strong HP damage vignette.
tsx = rep(tsx,
'      {resolutionPhase === "enemy" ? (\n        <div className={`${styles.enemyAttackFx} ${styles[`enemyAttack_${intent.kind}`] ?? ""}`} aria-hidden="true"><i /><i /><i /></div>\n      ) : null}',
'      {resolutionPhase === "enemy" ? (\n        <div className={`${styles.enemyAttackFx} ${styles[`enemyAttack_${intent.kind}`] ?? ""}`} aria-hidden="true"><i /><i /><i /></div>\n      ) : null}\n      {damageTaken > 0 ? (\n        <div className={`${styles.damageVignette} ${intent.kind === "pierce" ? styles.damagePierce : ""}`} aria-hidden="true">\n          <span>-{damageTaken} HP</span><i /><i /><i /><i />\n        </div>\n      ) : null}',
'damage render')

# Board guidance: selected stays bright, adjacent cells pulse, other cells dim.
tsx = rep(tsx,
'          <div className={styles.board}>',
'          <div className={`${styles.board} ${selected && !skillMode ? styles.awaitingNeighbor : ""}`}>',
'board selection context')

tsx = rep(tsx,
'              const isSelected = selected?.row === rowIndex && selected?.col === colIndex;\n              const setupHint = setupMode && analysis.setupHintCells.has(key);',
'              const isSelected = selected?.row === rowIndex && selected?.col === colIndex;\n              const isAdjacentChoice = Boolean(selected && !skillMode && !isSelected && adjacent(selected, { row: rowIndex, col: colIndex }));\n              const setupHint = setupMode && analysis.setupHintCells.has(key);',
'adjacent choice bool')

tsx = rep(tsx,
'                  className={`${styles.tile} ${styles[orb]} ${isSelected ? styles.selected : ""} ${setupHint ? styles.setupHint : ""} ${isClearing ? styles.clearing : ""} ${swapClass} ${dropClass}`}',
'                  className={`${styles.tile} ${styles[orb]} ${isSelected ? styles.selected : ""} ${isAdjacentChoice ? styles.adjacentChoice : ""} ${setupHint ? styles.setupHint : ""} ${isClearing ? styles.clearing : ""} ${swapClass} ${dropClass}`}',
'adjacent choice class')

# Explain deliberate setup whenever no tile is selected; selection instructions take precedence.
tsx = rep(tsx,
'        {setupMode\n          ? `消せる手なし → 点滅枠が有力SETUP（次手 最大${analysis.bestSetupScore}候補）`\n          : `消せる交換 ${analysis.immediateMoves} • 消えない交換も1ターン • ⬢×3でDEF`}',
'        {selected && !skillMode\n          ? "② シアンに光る上下左右の隣接パネルを選択 • 同じパネルで解除"\n          : setupMode\n            ? `消せる手なし → 点滅枠が有力SETUP（次手 最大${analysis.bestSetupScore}候補）`\n            : `消せる交換 ${analysis.immediateMoves} • SETUP=敵威力50%+PRISM28 • ⬢×3でDEF`}',
'rule hint')

# Title screen before the stage briefing.
tsx = rep(tsx,
'      {stageIntro ? (',
'      {showTitle ? (\n        <div className={styles.titleScreen} role="dialog" aria-label="Puzzle RPG title">\n          <div className={styles.titleGrid} aria-hidden="true" />\n          <div className={styles.titleKicker}>TACTICAL PUZZLE RPG</div>\n          <div className={styles.titleLogo}><span>PUZZLE</span><strong>RPG</strong></div>\n          <div className={styles.titleTagline}>READ THE INTENT. BUILD THE BOARD. BREAK THE ENEMY.</div>\n          <div className={styles.titleOrbs} aria-hidden="true">\n            {ORBS.map((orb) => <span key={orb} className={styles[orb]}>{ORB_LABEL[orb]}</span>)}\n          </div>\n          <div className={styles.titleSystems}><span>INTENT</span><span>NEXT</span><span>TACTICAL SETUP</span></div>\n          <button type="button" className={styles.titleStartButton} onClick={() => { setShowTitle(false); setStageIntro(true); setMessage("STAGE BRIEFING • 敵のルールを確認"); }}>START GAME</button>\n          <div className={styles.titleFoot}>1 MOVE = 1 TURN</div>\n        </div>\n      ) : null}\n\n      {stageIntro && !showTitle ? (',
'title screen')

# Add character details to intro enemy too.
tsx = rep(tsx,
'            <span className={styles.enemyCore}>{ENEMY_SIGIL[enemy.kind]}</span><span className={styles.enemyBase} />',
'            <span className={styles.enemyCore}>{ENEMY_SIGIL[enemy.kind]}</span><span className={styles.enemyFace}><i /><i /></span><span className={styles.enemyWeapon} /><span className={styles.enemyBase} />',
'intro enemy character')

# Stage clear communicates the shield decay rule.
tsx = rep(tsx,
'          <div className={styles.clearCarry}>BOARD + NEXT CARRIED</div>',
'          <div className={styles.clearCarry}>BOARD + NEXT CARRIED • DEF 50% CARRIED</div>',
'clear carry copy')

# CSS append: last definitions intentionally override the previous cinematic pass.
css += r'''

/* Tactical UX + presentation pass */
.board { overflow: hidden; }

/* More character-like enemy silhouettes: visible face + distinct equipment. */
.enemy_warden { --enemy-a:#a76cff; --enemy-b:#3f277c; --enemy-line:rgba(218,189,255,.78); --enemy-glow:rgba(178,126,255,.5); }
.enemyFace { position:absolute; z-index:7; left:50%; top:48%; width:19px; height:9px; transform:translate(-50%,-50%); display:flex; justify-content:space-between; align-items:center; pointer-events:none; }
.enemyFace i { width:5px; height:3px; border-radius:999px; background:#fff; box-shadow:0 0 6px #fff; }
.enemyWeapon { position:absolute; z-index:5; right:-4px; top:11px; width:5px; height:39px; border-radius:999px; background:linear-gradient(#fff,var(--enemy-a)); box-shadow:0 0 8px var(--enemy-glow); transform:rotate(24deg); transform-origin:center; }
.enemy_warden .enemyWeapon { right:3px; top:4px; height:48px; transform:rotate(42deg); }
.enemy_bastion .enemyFace { top:47%; width:22px; }
.enemy_bastion .enemyFace i { width:7px; height:3px; background:#fff3b0; }
.enemy_bastion .enemyWeapon { right:-7px; top:17px; width:12px; height:30px; border-radius:4px; background:linear-gradient(#ffe89a,#795b23); transform:rotate(-17deg); }
.enemy_oracle .enemyFace i { width:4px; height:4px; border-radius:50%; background:#ffd6e2; }
.enemy_oracle .enemyWeapon { right:0; top:0; width:4px; height:50px; background:linear-gradient(#ffd6e2,#ee4e79); transform:rotate(16deg); }
.enemy_oracle .enemyWeapon::after { content:""; position:absolute; left:50%; top:-7px; width:13px; height:13px; transform:translateX(-50%); border-radius:50%; border:2px solid #ffd6e2; background:#9b244f; }
.enemy_null .enemyFace { top:43%; width:15px; }
.enemy_null .enemyFace i { width:4px; height:2px; background:#bcd7ff; box-shadow:0 0 7px #8bb8ff; }
.enemy_null .enemyWeapon { right:-3px; top:-2px; width:3px; height:58px; background:linear-gradient(#fff,#a4bde8); transform:rotate(8deg); }
.enemy_null .enemyWeapon::after { content:""; position:absolute; left:-5px; top:33px; width:13px; height:3px; background:#e8efff; }
.enemy_trickster .enemyFace { transform:translate(-50%,-50%) rotate(-7deg); }
.enemy_trickster .enemyFace i:first-child { background:#ffd75c; } .enemy_trickster .enemyFace i:last-child { background:#65ecff; }
.enemy_trickster .enemyWeapon { right:-2px; top:6px; height:47px; background:linear-gradient(#ffd75c,#ee6caf,#54d8ff); transform:rotate(-31deg); }

/* Intro uses exactly the same enemy identity palette as battle. */
.introEnemyVisual.enemy_warden { --enemy-a:#a76cff; --enemy-b:#3f277c; --enemy-line:rgba(218,189,255,.78); --enemy-glow:rgba(178,126,255,.5); }
.introEnemyVisual.enemy_bastion { --enemy-a:#e1b65f; --enemy-b:#514427; --enemy-line:rgba(255,229,151,.9); --enemy-glow:rgba(226,181,88,.46); }
.introEnemyVisual.enemy_oracle { --enemy-a:#f05b7f; --enemy-b:#6c193b; --enemy-line:rgba(255,172,195,.9); --enemy-glow:rgba(255,73,125,.48); }
.introEnemyVisual.enemy_null { --enemy-a:#e8efff; --enemy-b:#414d68; --enemy-line:rgba(255,255,255,.94); --enemy-glow:rgba(188,213,255,.5); }
.introEnemyVisual.enemy_trickster { --enemy-a:#54d8ff; --enemy-b:#9b49d8; --enemy-line:rgba(255,224,114,.88); --enemy-glow:rgba(94,212,255,.5); }

/* First tile remains dominant, while only valid second taps glow. */
.awaitingNeighbor .tile:not(.selected):not(.adjacentChoice) { filter:brightness(.68) saturate(.72); opacity:.82; }
.adjacentChoice { z-index:3; outline:3px solid rgba(102,235,255,.98); outline-offset:-2px; filter:brightness(1.22) saturate(1.12) !important; animation:adjacentPulse .62s ease-in-out infinite alternate; }
.adjacentChoice::after { content:"TAP"; position:absolute; right:3px; bottom:3px; padding:2px 3px; border-radius:4px; background:rgba(6,26,38,.82); color:#c7f8ff; font-size:6px; font-weight:1000; letter-spacing:.05em; }
@keyframes adjacentPulse { to { transform:scale(.96); box-shadow:inset 0 0 0 2px rgba(255,255,255,.26),0 0 15px rgba(91,222,255,.62); } }

/* Attack motes leave the matched panel region and converge on the enemy. */
.playerAttackFx::before { content:""; position:absolute; left:50%; top:18%; width:76px; height:76px; transform:translate(-50%,-50%) scale(.2); border-radius:50%; background:radial-gradient(circle,#fff 0 8%,#ffe476 12%,rgba(139,108,255,.74) 30%,transparent 68%); box-shadow:0 0 24px #fff,0 0 52px rgba(137,103,255,.8); animation:impactBloom .34s .16s ease-out both; }
.playerAttackFx i { position:absolute; left:var(--sx); top:var(--sy); width:12px; height:12px; margin:-6px 0 0 -6px; border-radius:50%; background:radial-gradient(circle,#fff 0 28%,#ffe576 32%,#8d6cff 68%,transparent 72%); box-shadow:0 0 9px #fff,0 0 18px #8e75ff; animation:attackMoteFly .34s var(--delay) cubic-bezier(.28,.7,.2,1) both; }
.playerAttackFx b { position:absolute; left:50%; top:18%; width:7px; height:7px; border-radius:50%; background:#fff; box-shadow:0 0 16px #fff,0 0 34px #ffd75c; animation:impactCore .34s .18s ease-out both; }
@keyframes attackMoteFly { 0%{left:var(--sx);top:var(--sy);opacity:0;transform:scale(.6)} 18%{opacity:1;transform:scale(1.25)} 100%{left:50%;top:18%;opacity:.1;transform:scale(.35)} }
@keyframes impactBloom { 0%{opacity:0;transform:translate(-50%,-50%) scale(.2)} 40%{opacity:1} 100%{opacity:0;transform:translate(-50%,-50%) scale(1.55)} }
@keyframes impactCore { from{opacity:1;transform:scale(.2)} to{opacity:0;transform:scale(8)} }

/* Stronger real HP-damage feedback. Blocked hits do not trigger this layer. */
.shellDamaged { animation:screenImpact .42s cubic-bezier(.2,.8,.25,1); }
.damageVignette { position:fixed; z-index:24; inset:0; pointer-events:none; overflow:hidden; background:radial-gradient(circle at 50% 67%,transparent 12%,rgba(255,35,70,.12) 42%,rgba(124,0,28,.7) 100%); box-shadow:inset 0 0 52px rgba(255,27,64,.82); animation:damageVignette .62s ease-out both; }
.damageVignette::before,.damageVignette::after { content:""; position:absolute; left:-10%; width:120%; height:8px; background:linear-gradient(90deg,transparent,#fff,#ff315e,transparent); box-shadow:0 0 22px #ff315e; }
.damageVignette::before { top:39%; transform:rotate(-16deg); } .damageVignette::after { top:58%; transform:rotate(11deg); }
.damageVignette > span { position:absolute; left:50%; top:69%; transform:translate(-50%,-50%); color:#fff; font-size:clamp(34px,10vw,52px); font-weight:1000; font-style:italic; letter-spacing:.04em; text-shadow:0 3px 4px rgba(0,0,0,.7),0 0 22px #ff315e; animation:damageNumber .56s cubic-bezier(.1,.8,.2,1) both; }
.damageVignette i { position:absolute; left:50%; top:66%; width:4px; height:28%; transform-origin:top center; background:linear-gradient(#fff,rgba(255,45,85,.8),transparent); animation:damageShard .56s ease-out both; }
.damageVignette i:nth-of-type(1){transform:rotate(35deg)} .damageVignette i:nth-of-type(2){transform:rotate(-42deg)} .damageVignette i:nth-of-type(3){transform:rotate(12deg)} .damageVignette i:nth-of-type(4){transform:rotate(-11deg)}
.damagePierce { background:radial-gradient(circle at 50% 67%,rgba(214,232,255,.28),transparent 22%,rgba(56,83,150,.38) 72%,rgba(8,13,30,.8)); box-shadow:inset 0 0 62px rgba(181,211,255,.9); }
@keyframes screenImpact { 0%,100%{transform:translate(0)} 16%{transform:translate(-7px,3px)} 32%{transform:translate(6px,-2px)} 48%{transform:translate(-4px,1px)} 66%{transform:translate(3px,0)} }
@keyframes damageVignette { 0%{opacity:0} 18%{opacity:1} 100%{opacity:0} }
@keyframes damageNumber { 0%{opacity:0;transform:translate(-50%,-50%) scale(.35) rotate(-7deg)} 38%{opacity:1;transform:translate(-50%,-50%) scale(1.15) rotate(2deg)} 100%{opacity:0;transform:translate(-50%,-68%) scale(.96)} }
@keyframes damageShard { from{opacity:1;height:6%} to{opacity:0;height:36%} }

/* Title */
.titleScreen { position:fixed; z-index:45; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:calc(env(safe-area-inset-top) + 28px) 22px calc(env(safe-area-inset-bottom) + 28px); overflow:hidden; background:radial-gradient(circle at 50% 35%,rgba(108,83,255,.3),transparent 27%),linear-gradient(180deg,#11182d 0%,#090d19 58%,#05070e 100%); text-align:center; }
.titleGrid { position:absolute; inset:0; opacity:.2; background-image:linear-gradient(rgba(130,145,255,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(130,145,255,.12) 1px,transparent 1px); background-size:32px 32px; mask-image:linear-gradient(transparent 0,#000 28%,#000 75%,transparent 100%); }
.titleKicker { position:relative; color:#9daaff; font-size:10px; font-weight:950; letter-spacing:.25em; }
.titleLogo { position:relative; margin-top:8px; display:flex; flex-direction:column; line-height:.82; transform:skewY(-3deg); text-shadow:0 0 28px rgba(139,111,255,.38); }
.titleLogo span { color:#fff; font-size:clamp(48px,15vw,72px); font-weight:1000; letter-spacing:-.055em; }
.titleLogo strong { color:#ffe27a; font-size:clamp(66px,21vw,100px); font-weight:1000; letter-spacing:.02em; }
.titleTagline { position:relative; max-width:330px; margin-top:19px; color:#c5cae4; font-size:9px; font-weight:850; letter-spacing:.1em; line-height:1.55; }
.titleOrbs { position:relative; display:flex; gap:8px; margin-top:22px; }
.titleOrbs span { width:46px; height:46px; display:grid; place-items:center; border:1px solid rgba(255,255,255,.18); border-radius:14px; color:#fff; font-size:23px; box-shadow:inset 0 2px 6px rgba(255,255,255,.18),0 7px 15px rgba(0,0,0,.28); animation:titleOrbFloat 1.6s ease-in-out infinite alternate; }
.titleOrbs span:nth-child(2){animation-delay:.1s}.titleOrbs span:nth-child(3){animation-delay:.2s}.titleOrbs span:nth-child(4){animation-delay:.3s}.titleOrbs span:nth-child(5){animation-delay:.4s}
.titleSystems { position:relative; display:flex; gap:6px; flex-wrap:wrap; justify-content:center; margin-top:17px; }
.titleSystems span { padding:4px 7px; border:1px solid rgba(161,173,255,.23); border-radius:999px; color:#abb7ff; background:rgba(102,116,211,.08); font-size:7px; font-weight:950; letter-spacing:.1em; }
.titleStartButton { position:relative; width:min(100%,330px); min-height:56px; margin-top:26px; border:1px solid rgba(255,255,255,.34); border-radius:999px; background:linear-gradient(135deg,#8f5cff,#4e77ff); color:#fff; font-size:16px; font-weight:1000; letter-spacing:.16em; box-shadow:0 12px 36px rgba(74,81,255,.36); animation:readyPulse 1.1s ease-in-out infinite alternate; }
.titleFoot { position:relative; margin-top:13px; color:#687394; font-size:7px; font-weight:900; letter-spacing:.2em; }
@keyframes titleOrbFloat { to{transform:translateY(-6px) rotate(3deg);filter:brightness(1.15)} }

@media (max-width:360px) { .titleOrbs { gap:5px; } .titleOrbs span { width:40px;height:40px;font-size:20px; } }
@media (prefers-reduced-motion:reduce) { .titleOrbs span,.adjacentChoice,.shellDamaged,.damageVignette,.playerAttackFx i { animation-duration:.001ms !important; animation-iteration-count:1 !important; } }
'''

TSX.write_text(tsx)
CSS.write_text(css)
print('patched tactical UX pass')
