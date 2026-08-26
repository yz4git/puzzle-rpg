from pathlib import Path
import re

p = Path('app/PuzzleRPGGame.tsx')
s = p.read_text()

def rep(old: str, new: str, label: str):
    global s
    if old not in s:
        raise SystemExit(f'missing pattern: {label}')
    s = s.replace(old, new, 1)

rep(
    'import { playSfx, primeAudio } from "./gameAudio";',
    'import { playSfx, primeAudio, type GameSfx } from "./gameAudio";',
    'audio import',
)

rep(
'''type MoveAnalysis = {
  immediateMoves: number;
  bestSetupScore: number;
  setupHintCells: Set<string>;
};''',
'''type MoveAnalysis = {
  immediateMoves: number;
  bestSetupScore: number;
  setupHintCells: Set<string>;
};

type MovePreviewTone = "attack" | "block" | "heal" | "shield" | "setup" | "combo";
type MovePreview = {
  label: string;
  tone: MovePreviewTone;
  attack: number;
  combo: number;
  breaksPlate: boolean;
};

type PrismOpportunity = { row: number; col: number; orb: Orb; attack: number } | null;''',
    'preview types',
)

old_analyze = re.search(r'function analyzeBoard\(board: Board\): MoveAnalysis \{.*?\n\}\n\nfunction enemyMaxHp', s, flags=re.S)
if not old_analyze:
    raise SystemExit('missing analyzeBoard block')
new_analyze = '''function analyzeBoard(board: Board): MoveAnalysis {
  const immediateMoves = countImmediateMoves(board);
  let bestSetupScore = 0;
  const bestPairs: Array<[Coord, Coord]> = [];

  // SETUP is an intentional tactical option even when a match exists. Only
  // non-clearing swaps are ranked here so the hint never masquerades as an attack.
  for (const [a, b] of ALL_PAIRS) {
    const swapped = swapCells(board, a, b);
    if (findMatches(swapped).size > 0) continue;
    const score = countImmediateMoves(swapped);
    if (score > bestSetupScore) {
      bestSetupScore = score;
      bestPairs.length = 0;
      bestPairs.push([a, b]);
    } else if (score === bestSetupScore && score > 0 && bestPairs.length < 2) {
      bestPairs.push([a, b]);
    }
  }

  const setupHintCells = new Set<string>();
  for (const [a, b] of bestPairs) {
    setupHintCells.add(cellKey(a.row, a.col));
    setupHintCells.add(cellKey(b.row, b.col));
  }
  return { immediateMoves, bestSetupScore, setupHintCells };
}

function enemyMaxHp'''
s = s[:old_analyze.start()] + new_analyze + s[old_analyze.end():]

insert_after_plan = '''
const MATCH_SFX_BY_ORB: Record<Orb, GameSfx> = {
  fire: "matchFire",
  water: "matchWater",
  light: "matchLight",
  heart: "matchHeart",
  guard: "matchGuard",
};

const ATTACK_SFX_BY_ORB: Partial<Record<Orb, GameSfx>> = {
  fire: "attackFire",
  water: "attackWater",
  light: "attackLight",
};

function dominantAttackOrb(plan: CascadePlan): Orb | null {
  const counts = new Map<Orb, number>();
  for (const frame of plan.frames) {
    for (const key of frame.matches) {
      const [rowText, colText] = key.split(":");
      const orb = frame.boardBefore[Number(rowText)]![Number(colText)]!;
      if (ATTACK_PER_ORB[orb] > 0) counts.set(orb, (counts.get(orb) ?? 0) + 1);
    }
  }
  let best: Orb | null = null;
  let bestCount = 0;
  for (const [orb, count] of counts) {
    if (count > bestCount) { best = orb; bestCount = count; }
  }
  return best;
}

function enemyEffectSfx(intent: EnemyIntent): GameSfx {
  if (intent.kind === "heavy") return "enemyHeavy";
  if (intent.kind === "pierce") return "pierce";
  if (intent.kind === "drain") return "enemyDrain";
  if (intent.kind === "disrupt") return "enemyDisrupt";
  return "enemyAttack";
}
'''
needle = 'function computeDropDistances(matches: Set<string>): Map<string, number> {'
if needle not in s:
    raise SystemExit('missing computeDropDistances insertion point')
s = s.replace(needle, insert_after_plan + '\n' + needle, 1)

preview_helpers = '''
function previewResolvedBoard(board: Board, queues: ColumnQueues, enemy: EnemyDefinition): MovePreview {
  const plan = buildCascadePlan(board, queues);
  if (plan.frames.length === 0) {
    return { label: "SETUP", tone: "setup", attack: 0, combo: 0, breaksPlate: false };
  }
  const plateBlocks = enemy.kind === "bastion" && plan.attack > 0 && plan.combo === 1 && plan.largestAttackRun === 3;
  const armorReduction = !plateBlocks && plan.attack > 0 ? Math.min(enemy.armor, plan.attack) : 0;
  const attack = plateBlocks ? 0 : Math.max(0, plan.attack - armorReduction);
  if (plateBlocks) return { label: "PLATE ×", tone: "block", attack: 0, combo: plan.combo, breaksPlate: false };
  if (attack > 0) {
    const breaksPlate = enemy.kind === "bastion";
    const label = breaksPlate
      ? `BREAK ${attack}`
      : plan.combo >= 2 ? `${attack} · ${plan.combo}C` : `${attack} DMG`;
    return { label, tone: plan.combo >= 2 ? "combo" : "attack", attack, combo: plan.combo, breaksPlate };
  }
  if (plan.heal > 0) return { label: `HP +${plan.heal}`, tone: "heal", attack: 0, combo: plan.combo, breaksPlate: false };
  if (plan.shield > 0) return { label: `DEF +${plan.shield}`, tone: "shield", attack: 0, combo: plan.combo, breaksPlate: false };
  return { label: `${plan.combo} COMBO`, tone: "combo", attack: 0, combo: plan.combo, breaksPlate: false };
}

function findPrismBreakOpportunity(board: Board, queues: ColumnQueues, enemy: EnemyDefinition): PrismOpportunity {
  if (enemy.kind !== "bastion") return null;
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const before = board[row]![col]!;
      for (const orb of ORBS) {
        if (orb === before) continue;
        const transformed = cloneBoard(board);
        transformed[row]![col] = orb;
        const recycled = cloneQueues(queues);
        recycled[col]![0] = before;
        const preview = previewResolvedBoard(transformed, recycled, enemy);
        if (preview.breaksPlate && preview.attack > 0) return { row, col, orb, attack: preview.attack };
      }
    }
  }
  return null;
}
'''
needle = 'function enemyIntent(stage: number, enemyTurn: number, enemy: EnemyDefinition): EnemyIntent {'
if needle not in s:
    raise SystemExit('missing enemyIntent insertion point')
s = s.replace(needle, preview_helpers + '\n' + needle, 1)

rep(
'  const [attackSources, setAttackSources] = useState<Coord[]>([]);',
'  const [attackSources, setAttackSources] = useState<Coord[]>([]);\n  const [attackElement, setAttackElement] = useState<Orb | null>(null);',
'attack state',
)
rep(
'  const analysis = useMemo(() => analyzeBoard(board), [board]);',
'  const analysis = useMemo(() => analyzeBoard(board), [board]);\n  const prismBreakOpportunity = useMemo(() => skill >= 100 ? findPrismBreakOpportunity(board, columnQueues, enemy) : null, [board, columnQueues, skill, stage]);',
'prism opportunity memo',
)
rep(
'    setAttackSources([]);\n  }',
'    setAttackSources([]);\n    setAttackElement(null);\n  }',
'reset attack element',
)

rep(
'    const plan = buildCascadePlan(nextBoard, startingQueues);',
'    const plan = buildCascadePlan(nextBoard, startingQueues);\n    const attackElementForTurn = dominantAttackOrb(plan);',
'dominant element',
)

rep(
'''      setCombo(index + 1);
      setResolutionPhase("clear");
      playSfx(index === 0 ? "match" : "cascade");
      await delay(175);''',
'''      setCombo(index + 1);
      setResolutionPhase("clear");
      const matchedOrbTypes = Array.from(new Set(Array.from(frame.matches).map((key) => {
        const [rowText, colText] = key.split(":");
        return frame.boardBefore[Number(rowText)]![Number(colText)]!;
      })));
      matchedOrbTypes.slice(0, 2).forEach((matchedOrb, toneIndex) => {
        window.setTimeout(() => playSfx(MATCH_SFX_BY_ORB[matchedOrb]), toneIndex * 24);
      });
      if (index > 0) playSfx("cascade");
      await delay(175);''',
'match sounds',
)

rep(
'''    if (plan.frames.length === 0) {
      setBoard(nextBoard);
      setMessage(skillLabel ? `${skillLabel} • SETUP` : "SETUP • 次の形を作った");
    }''',
'''    if (plan.frames.length === 0) {
      setBoard(nextBoard);
      if (isSetupTurn) playSfx("setup");
      setMessage(skillLabel ? `${skillLabel} • SETUP` : "SETUP • 次の形を作った");
    }''',
'setup sound',
)

rep(
'''    if (plan.heal > 0) playSfx("heal");
    if (plan.shield > 0) playSfx("shield");''',
'''    if (plan.heal > 0) playSfx("heal");
    if (plan.shield > 0) playSfx("shield");
    if (armorReduction > 0) window.setTimeout(() => playSfx("armor"), 75);''',
'armor sound',
)

rep(
'''    if (actualAttack > 0 || plateBlocks) {
      setAttackSources(attackSourceList.slice(0, 10));
      setResolutionPhase("attack");
      playSfx(plateBlocks ? "block" : "playerAttack");
      setCombatPop(plateBlocks ? "PLATE BLOCK" : `${actualAttack} DMG`);
      await delay(340);
      setAttackSources([]);
    }''',
'''    if (actualAttack > 0 || plateBlocks) {
      setAttackSources(attackSourceList.slice(0, 10));
      setAttackElement(attackElementForTurn);
      setResolutionPhase("attack");
      playSfx(plateBlocks ? "plateBlock" : (attackElementForTurn ? ATTACK_SFX_BY_ORB[attackElementForTurn] ?? "playerAttack" : "playerAttack"));
      setCombatPop(plateBlocks ? "PLATE BLOCK" : `${actualAttack} DMG`);
      await delay(440);
      setAttackSources([]);
      setAttackElement(null);
    }''',
'attack fx timing and sound',
)

rep(
'    playSfx(enemyResult.hpDamage > 0 ? (effectiveIntent.kind === "pierce" ? "pierce" : "damage") : "block");',
'    playSfx(enemyEffectSfx(effectiveIntent));\n    if (enemyResult.hpDamage === 0) window.setTimeout(() => playSfx("block"), 70);',
'enemy effect sounds',
)

rep(
'''    playSfx("skill");
    const transformed = cloneBoard(board);''',
'''    playSfx("skill");
    window.setTimeout(() => playSfx("prismRecycle"), 85);
    const transformed = cloneBoard(board);''',
'prism sounds',
)

old_setup = '''  const setupMode = !isResolving && !stageIntro && !stageClear && analysis.immediateMoves === 0 && analysis.bestSetupScore > 0;
  const enemyPixelClass = `${styles.enemyPixelSprite} ${resolutionPhase === "attack" ? styles.enemyPixelStruck : ""}`;'''
new_setup = '''  const dangerousIntent = intent.kind === "heavy" || intent.kind === "pierce" || (intent.kind === "drain" && playerShield < intent.power);
  const setupRecommended = !isResolving && !stageIntro && !stageClear && dangerousIntent && analysis.bestSetupScore > 0;
  const setupMode = !isResolving && !stageIntro && !stageClear && analysis.bestSetupScore > 0 && (analysis.immediateMoves === 0 || setupRecommended);
  const enemyPixelClass = `${styles.enemyPixelSprite} ${resolutionPhase === "attack" ? styles.enemyPixelStruck : ""}`;

  const movePreviewFor = (row: number, col: number): MovePreview | null => {
    if (!selected || skillMode || !adjacent(selected, { row, col })) return null;
    return previewResolvedBoard(swapCells(board, selected, { row, col }), columnQueues, enemy);
  };

  const skillPreviewFor = (orb: Orb): MovePreview | null => {
    if (!selected) return null;
    const before = board[selected.row]![selected.col]!;
    if (before === orb) return null;
    const transformed = cloneBoard(board);
    transformed[selected.row]![selected.col] = orb;
    const recycled = cloneQueues(columnQueues);
    recycled[selected.col]![0] = before;
    return previewResolvedBoard(transformed, recycled, enemy);
  };'''
rep(old_setup, new_setup, 'setup recommendation helpers')

rep(
'''      {resolutionPhase === "attack" ? (
        <div className={styles.playerAttackFx} aria-hidden="true">
          {attackSources.map((cell, index) => (
            <i
              key={`${cell.row}-${cell.col}-${index}`}
              style={{
                "--sx": `${3 + ((cell.col + 0.5) / SIZE) * 94}%`,
                "--sy": `${49 + ((cell.row + 0.5) / SIZE) * 43}%`,
                "--delay": `${index * 0.025}s`,
              } as CSSProperties}
            />
          ))}
          <b />
        </div>
      ) : null}''',
'''      {resolutionPhase === "attack" ? (
        <div className={`${styles.playerAttackFx} ${attackElement ? styles[`attackFx_${attackElement}`] ?? "" : ""}`} aria-hidden="true">
          {attackSources.map((cell, index) => (
            <i
              key={`${cell.row}-${cell.col}-${index}`}
              style={{
                "--sx": `${3 + ((cell.col + 0.5) / SIZE) * 94}%`,
                "--sy": `${49 + ((cell.row + 0.5) / SIZE) * 43}%`,
                "--delay": `${index * 0.025}s`,
              } as CSSProperties}
            />
          ))}
          <strong className={styles.attackCharge}>{attackElement ? ORB_LABEL[attackElement] : "✦"}</strong>
          <span className={styles.attackTrail} />
          <b />
          <em className={styles.attackImpact}>HIT!</em>
        </div>
      ) : null}''',
'clear attack fx markup',
)

rep(
'<div className={styles.intentCard}>\n          <div className={styles.intentTurn}>NOW</div>',
'<div className={`${styles.intentCard} ${setupRecommended ? styles.intentDanger : ""}`}>\n          <div className={styles.intentTurn}>NOW</div>',
'intent danger class',
)

rep(
'''              const isAdjacentChoice = Boolean(selected && !skillMode && !isSelected && adjacent(selected, { row: rowIndex, col: colIndex }));
              const setupHint = setupMode && analysis.setupHintCells.has(key);''',
'''              const isAdjacentChoice = Boolean(selected && !skillMode && !isSelected && adjacent(selected, { row: rowIndex, col: colIndex }));
              const movePreview = isAdjacentChoice ? movePreviewFor(rowIndex, colIndex) : null;
              const setupHint = setupMode && analysis.setupHintCells.has(key);''',
'move preview variable',
)

rep(
'''                >
                  <span>{ORB_LABEL[orb]}</span>
                </button>''',
'''                >
                  <span>{ORB_LABEL[orb]}</span>
                  {movePreview ? <small className={`${styles.movePreview} ${styles[`preview_${movePreview.tone}`] ?? ""}`}>{movePreview.label}</small> : null}
                </button>''',
'move preview badge',
)

rep(
'''      <div className={`${styles.ruleHint} ${setupMode ? styles.setupAlert : ""}`}>
        {selected && !skillMode
          ? "② シアンに光る上下左右の隣接パネルを選択 • 同じパネルで解除"
          : setupMode
            ? `消せる手なし → 点滅枠が有力SETUP（次手 最大${analysis.bestSetupScore}候補）`
            : `消せる交換 ${analysis.immediateMoves} • SETUP=敵威力50%+PRISM28 • ⬢×3でDEF`}
      </div>''',
'''      <div className={`${styles.ruleHint} ${setupMode ? styles.setupAlert : ""}`}>
        {selected && !skillMode
          ? "② 隣接パネル上の予測結果を見て選択 • PLATE×は無効攻撃"
          : setupRecommended
            ? `SETUP RECOMMENDED • NOW ${intent.label} ${intent.power} → 金枠交換で威力50% + PRISM28`
            : setupMode
              ? `即消しなし → 金枠が有力SETUP（次手 最大${analysis.bestSetupScore}候補）`
              : `消せる交換 ${analysis.immediateMoves} • SETUP=敵威力50%+PRISM28 • ⬢×3でDEF`}
      </div>''',
'rule hint',
)

old_palette = '''            {ORBS.map((orb) => (
              <button key={orb} type="button" className={styles[orb]} disabled={!selected || isResolving} onClick={() => castShift(orb)}>
                {ORB_LABEL[orb]}
              </button>
            ))}'''
new_palette = '''            {ORBS.map((orb) => {
              const sameColor = Boolean(selected && board[selected.row]![selected.col] === orb);
              const preview = skillPreviewFor(orb);
              return (
                <button key={orb} type="button" className={styles[orb]} disabled={!selected || isResolving || sameColor} onClick={() => castShift(orb)}>
                  <span>{ORB_LABEL[orb]}</span>
                  <small className={preview ? styles[`preview_${preview.tone}`] ?? "" : ""}>{sameColor ? "SAME" : preview?.label ?? "—"}</small>
                </button>
              );
            })}'''
rep(old_palette, new_palette, 'skill previews')

rep(
'className={`${styles.skillButton} ${skill >= 100 ? styles.skillReady : ""}`}',
'className={`${styles.skillButton} ${skill >= 100 ? styles.skillReady : ""} ${prismBreakOpportunity ? styles.prismBreakReady : ""}`}',
'prism break button class',
)
rep(
'<span className={styles.skillGauge}>{skill >= 100 ? (skillMode ? "CANCEL" : "READY") : `${skill}%`}</span>',
'<span className={styles.skillGauge}>{skill >= 100 ? (skillMode ? "CANCEL" : prismBreakOpportunity ? `BREAK ${prismBreakOpportunity.attack}` : "READY") : `${skill}%`}</span>',
'prism break gauge',
)

p.write_text(s)

css = Path('app/PuzzleRPGGame.module.css')
c = css.read_text()
marker = '/* Tactical preview + high-density retro combat pass */'
if marker not in c:
    c += r'''

/* Tactical preview + high-density retro combat pass */
.enemyCard { min-height:92px; grid-template-columns:90px 1fr; }
.enemyPixelSprite { width:96px; height:90px; transform:translateX(-2px); filter:drop-shadow(0 5px 0 rgba(0,0,0,.32)) drop-shadow(0 0 10px rgba(161,134,255,.38)); }
.introPixelSprite { width:min(58vw,232px); height:min(58vw,232px); margin:13px 0 4px; filter:drop-shadow(0 10px 0 rgba(0,0,0,.34)) drop-shadow(0 0 21px rgba(155,127,255,.42)); }

.intentDanger { border-color:rgba(255,212,89,.7); box-shadow:inset 0 0 0 1px rgba(255,208,78,.16),0 0 13px rgba(255,178,55,.16); animation:intentDangerPulse .78s ease-in-out infinite alternate; }
@keyframes intentDangerPulse { to { filter:brightness(1.16); border-color:rgba(255,228,123,.95); } }

.adjacentChoice::after { display:none; }
.movePreview { position:absolute; z-index:8; left:3px; right:3px; bottom:3px; min-height:14px; display:grid; place-items:center; padding:1px 2px; border:1px solid rgba(255,255,255,.32); border-radius:5px; background:rgba(4,8,18,.88); color:#fff; font-size:clamp(6px,1.7vw,8px); line-height:1; font-weight:1000; letter-spacing:.01em; text-shadow:0 1px 2px rgba(0,0,0,.7); box-shadow:0 2px 5px rgba(0,0,0,.32); }
.preview_attack { color:#ffe590 !important; border-color:rgba(255,220,99,.58) !important; }
.preview_combo { color:#fff4a8 !important; border-color:rgba(255,234,118,.75) !important; box-shadow:0 0 8px rgba(255,210,70,.3) !important; }
.preview_block { color:#ff9aa8 !important; border-color:rgba(255,88,111,.72) !important; background:rgba(67,10,24,.9) !important; }
.preview_heal { color:#ffb9d5 !important; border-color:rgba(255,117,179,.65) !important; }
.preview_shield { color:#a8eeff !important; border-color:rgba(82,207,255,.68) !important; }
.preview_setup { color:#9cf5ff !important; border-color:rgba(85,222,255,.7) !important; }

.skillPalette { grid-template-columns:58px 1fr; }
.skillPalette > div { gap:3px; }
.skillPalette button { position:relative; min-height:38px; padding:2px; display:grid; grid-template-rows:20px 11px; place-items:center; line-height:1; }
.skillPalette button > span { font-size:16px; }
.skillPalette button > small { width:100%; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:#fff; font-size:5.5px; font-weight:1000; text-align:center; text-shadow:0 1px 2px #000; }
.prismBreakReady { border-color:#ffe37a !important; box-shadow:0 0 0 1px rgba(255,223,102,.25),0 0 20px rgba(255,196,55,.42) !important; }
.prismBreakReady .skillGauge { color:#fff3a8; }

/* A visible projectile now travels from the puzzle field to the enemy before impact. */
.playerAttackFx { --attack-a:#fff19b; --attack-b:#8d6cff; --attack-glow:rgba(144,108,255,.9); z-index:18; }
.attackFx_fire { --attack-a:#ffd06a; --attack-b:#ff4d3d; --attack-glow:rgba(255,83,49,.92); }
.attackFx_water { --attack-a:#c9f7ff; --attack-b:#2f8fff; --attack-glow:rgba(61,167,255,.92); }
.attackFx_light { --attack-a:#fffbd0; --attack-b:#d681ff; --attack-glow:rgba(225,151,255,.95); }
.playerAttackFx i { background:radial-gradient(circle,#fff 0 25%,var(--attack-a) 29%,var(--attack-b) 65%,transparent 72%); box-shadow:0 0 9px #fff,0 0 18px var(--attack-glow); }
.playerAttackFx::before { background:radial-gradient(circle,#fff 0 8%,var(--attack-a) 13%,var(--attack-b) 32%,transparent 69%); box-shadow:0 0 24px #fff,0 0 58px var(--attack-glow); animation:impactBloom .44s .28s ease-out both; }
.attackCharge { position:absolute; z-index:4; left:50%; top:68%; width:38px; height:38px; display:grid; place-items:center; border:2px solid rgba(255,255,255,.84); border-radius:50%; background:radial-gradient(circle at 35% 30%,#fff 0 9%,var(--attack-a) 18%,var(--attack-b) 68%); color:#fff; font-size:20px; font-style:normal; filter:drop-shadow(0 0 9px #fff) drop-shadow(0 0 18px var(--attack-glow)); animation:attackChargeFly .44s cubic-bezier(.18,.7,.12,1) both; }
.attackTrail { position:absolute; z-index:2; left:13%; top:11%; width:64dvh; max-width:590px; height:9px; transform-origin:left center; transform:rotate(73deg); border-radius:999px; background:linear-gradient(90deg,var(--attack-b),var(--attack-a) 45%,rgba(255,255,255,.95) 70%,transparent); box-shadow:0 0 11px var(--attack-glow),0 0 24px var(--attack-glow); opacity:0; animation:attackTrailFlash .44s ease-out both; }
.attackImpact { position:absolute; z-index:7; left:clamp(52px,14%,64px); top:clamp(70px,10%,88px); transform:translate(-50%,-50%); color:#fff; font-size:19px; font-weight:1000; font-style:italic; letter-spacing:.08em; text-shadow:0 2px 2px #000,0 0 10px #fff,0 0 22px var(--attack-glow); opacity:0; animation:attackImpactText .44s .25s ease-out both; }
@keyframes attackChargeFly { 0%{left:50%;top:68%;transform:translate(-50%,-50%) scale(.55);opacity:0} 18%{opacity:1;transform:translate(-50%,-50%) scale(1.22)} 72%{left:17%;top:16%;transform:translate(-50%,-50%) scale(.95);opacity:1} 100%{left:13%;top:11%;transform:translate(-50%,-50%) scale(.2);opacity:0} }
@keyframes attackTrailFlash { 0%,22%{opacity:0;clip-path:inset(0 100% 0 0)} 44%{opacity:.9;clip-path:inset(0 38% 0 0)} 76%{opacity:1;clip-path:inset(0 0 0 0)} 100%{opacity:0;clip-path:inset(0 0 0 0)} }
@keyframes attackImpactText { 0%{opacity:0;transform:translate(-50%,-50%) scale(.45)} 38%{opacity:1;transform:translate(-50%,-50%) scale(1.25)} 100%{opacity:0;transform:translate(-50%,-78%) scale(.92)} }

@media (max-height:760px) and (orientation:portrait) {
  .enemyCard { min-height:61px; grid-template-columns:58px 1fr; }
  .enemyPixelSprite { width:72px; height:66px; }
  .introPixelSprite { width:min(42vw,164px); height:min(42vw,164px); margin:5px 0 2px; }
  .movePreview { min-height:11px; font-size:5.5px; bottom:2px; }
  .skillPalette button { min-height:33px; grid-template-rows:18px 9px; }
}

@media (prefers-reduced-motion:reduce) {
  .attackCharge,.attackTrail,.attackImpact,.intentDanger { animation-duration:.001ms !important; animation-iteration-count:1 !important; }
}
'''
css.write_text(c)
