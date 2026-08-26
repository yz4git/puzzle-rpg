from pathlib import Path
from PIL import Image

TSX = Path('app/PuzzleRPGGame.tsx')
CSS = Path('app/PuzzleRPGGame.module.css')
HEART = Path('public/assets/pixel8/orbs/heart.png')

ts = TSX.read_text()
css = CSS.read_text()


def replace_once(src: str, old: str, new: str, label: str) -> str:
    if old not in src:
        raise SystemExit(f'missing pattern: {label}')
    if src.count(old) != 1:
        raise SystemExit(f'non-unique pattern {label}: {src.count(old)}')
    return src.replace(old, new, 1)

# Stage 3+ enemy identity rules: keep Stage 2 Bastion untouched.
ts = replace_once(ts,
'''const ENEMY_HINT: Record<EnemyKind, string> = {
  warden: "3手目の強打をNOW/NEXTで確認。先にDEFを作るか、撃破を狙う。",
  bastion: "単発3消し攻撃は無効。4消しか2 COMBO以上を仕込む。",
  oracle: "DRAIN前はHP受けを避け、DEFで吸収を止める。",
  null: "PIERCEはDEF無視。回復・撃破・次ターン用DEFの準備を優先。",
  trickster: "DISRUPT前に列別NEXTを使い切るか、シフト後の列を予測する。",
};''',
'''const ENEMY_HINT: Record<EnemyKind, string> = {
  warden: "3手目の強打をNOW/NEXTで確認。先にDEFを作るか、撃破を狙う。",
  bastion: "単発3消し攻撃は無効。4消しか2 COMBO以上を仕込む。",
  oracle: "DRAINでHPを受けると150%吸収＋DEF4削り。必ずDEFで止める。",
  null: "PIERCEはDEF無視＋残DEF半減。直前はHP確保、直後にDEFを作り直す。",
  trickster: "DISRUPTはNEXT右シフト＋PRISM-15。READY前後の使い時を読む。",
};''', 'enemy hints')

ts = replace_once(ts,
'''        passive: "DRAIN：HPに通ったダメージだけ敵が回復",''',
'''        passive: "DRAIN：HP被弾で150%吸収＋DEF4を削る",''', 'oracle passive')
ts = replace_once(ts,
'''        passive: "PIERCE：予告された貫通攻撃はSHIELDを無視",''',
'''        passive: "PIERCE：DEF無視＋攻撃後に残DEFを半減",''', 'null passive')
ts = replace_once(ts,
'''        passive: "DISRUPT：列別NEXTを右へ1列ずらす",''',
'''        passive: "DISRUPT：NEXT右シフト＋PRISMを15削る",''', 'trickster passive')

# computeEnemyAction receives stage so Stage 3+ rules can be applied without affecting Stage 2.
ts = replace_once(ts,
'''function computeEnemyAction(
  intent: EnemyIntent,
  maxEnemyHp: number,''',
'''function computeEnemyAction(
  intent: EnemyIntent,
  stage: number,
  maxEnemyHp: number,''', 'enemy action signature')

ts = replace_once(ts,
'''  if (intent.kind === "pierce") {
    hpDamage = intent.power;
    hpAfter = Math.max(0, hpBefore - hpDamage);
    summary = `${intent.label} -${hpDamage} HP`;
  } else {''',
'''  if (intent.kind === "pierce") {
    hpDamage = intent.power;
    hpAfter = Math.max(0, hpBefore - hpDamage);
    if (stage >= 4) {
      shieldAfter = Math.floor(shieldBefore * 0.5);
      summary = `${intent.label} -${hpDamage} HP / DEF HALF`;
    } else {
      summary = `${intent.label} -${hpDamage} HP`;
    }
  } else {''', 'pierce identity rule')

ts = replace_once(ts,
'''    if (intent.kind === "drain") {
      const drainHeal = Math.ceil(hpDamage * 1.25);
      enemyHpAfter = Math.min(maxEnemyHp, enemyHpBefore + drainHeal);
      summary = hpDamage > 0 ? `${intent.label} -${hpDamage} / 敵+${drainHeal}` : `${intent.label} BLOCK`;
    } else if (intent.kind === "disrupt") {''',
'''    if (intent.kind === "drain") {
      const drainHeal = Math.ceil(hpDamage * (stage >= 3 ? 1.5 : 1.25));
      enemyHpAfter = Math.min(maxEnemyHp, enemyHpBefore + drainHeal);
      if (stage >= 3 && hpDamage > 0) shieldAfter = Math.max(0, shieldAfter - 4);
      summary = hpDamage > 0
        ? `${intent.label} -${hpDamage} / 敵+${drainHeal}${stage >= 3 ? " / DEF-4" : ""}`
        : `${intent.label} BLOCK`;
    } else if (intent.kind === "disrupt") {''', 'drain identity rule')

ts = replace_once(ts,
'''    const enemyResult = computeEnemyAction(
      effectiveIntent,
      maxEnemyHp,''',
'''    const enemyResult = computeEnemyAction(
      effectiveIntent,
      stage,
      maxEnemyHp,''', 'enemy action call')

# Trickster steals PRISM on DISRUPT after Stage 5; does not alter Stage 2 balance.
ts = replace_once(ts,
'''    setColumnQueues(enemyResult.queuesAfter);
    setEnemyTurn((value) => value + 1);
    setMessage(''',
'''    setColumnQueues(enemyResult.queuesAfter);
    const prismTax = stage >= 5 && enemy.kind === "trickster" && effectiveIntent.kind === "disrupt" ? 15 : 0;
    if (prismTax > 0) setSkill((value) => Math.max(0, value - prismTax));
    setEnemyTurn((value) => value + 1);
    setMessage(''', 'trickster prism tax')

ts = replace_once(ts,
'''        : `${actualAttack > 0 ? `${actualAttack} DMG • ` : ""}${enemyResult.summary}`,
    );''',
'''        : `${actualAttack > 0 ? `${actualAttack} DMG • ` : ""}${enemyResult.summary}${prismTax > 0 ? " • PRISM -15" : ""}`,
    );''', 'trickster summary')

# Rich Game Over card with fallen hero and run result.
ts = replace_once(ts,
'''      {gameOver ? (
        <div className={styles.gameOverCard}>
          <div>GAME OVER</div>
          <button type="button" onClick={reset}>もう一度</button>
        </div>
      ) : null}''',
'''      {gameOver ? (
        <div className={styles.gameOverCard} role="dialog" aria-label="Game Over">
          <div className={styles.gameOverHeroWrap} aria-hidden="true">
            <img className={styles.gameOverHero} src={PIXEL_ART_ASSETS.hero} alt="" draggable={false} />
          </div>
          <div className={styles.gameOverTitle}>GAME OVER</div>
          <div className={styles.gameOverStats}>
            <span>STAGE {stage}</span><span>LV {level}</span><span>◈ {gold}</span><span>XP {xp}</span>
          </div>
          <div className={styles.gameOverTip}>INTENT / DEF / PRISM を組み合わせて再挑戦</div>
          <button type="button" onClick={reset}>▶ RETRY</button>
        </div>
      ) : null}''', 'game over card')

# Append final CSS overrides. Keeping them at the end makes the pass reversible and deterministic.
marker = '/* Review pass 1-5 + heart/fire separation */'
if marker in css:
    raise SystemExit('review CSS already present')
css += r'''

/* Review pass 1-5 + heart/fire separation */
/* 1) Keep controls attached to the puzzle instead of pinning them to the viewport bottom. */
.actionBar {
  margin-top: 3px !important;
  margin-bottom: 0 !important;
  flex: 0 0 auto !important;
  position: relative !important;
  bottom: auto !important;
}
.message { margin-bottom: 0 !important; }
.skillPalette { margin: 2px 0 0 !important; }

/* 2) Pixel projectiles visibly travel from matched cells into the enemy sprite. */
.playerAttackFx { --hit-x: 25%; --hit-y: 18%; }
.playerAttackFx::before {
  left: var(--hit-x) !important;
  top: var(--hit-y) !important;
  width: 42px !important;
  height: 42px !important;
  border-radius: 0 !important;
  background: #fff !important;
  box-shadow: 12px 0 0 #ffd447, -12px 0 0 #ff7a2f, 0 12px 0 #ffd447, 0 -12px 0 #fff, 18px 12px 0 #ff4b35, -18px -12px 0 #fff !important;
  transform: translate(-50%,-50%) scale(0) !important;
  animation: pixelEnemyImpact .44s steps(4,end) forwards !important;
}
.playerAttackFx i {
  left: var(--sx) !important;
  top: var(--sy) !important;
  width: 9px !important;
  height: 9px !important;
  border-radius: 0 !important;
  filter: none !important;
  background: #fff !important;
  box-shadow: 6px 0 0 currentColor, 0 6px 0 currentColor !important;
  animation: pixelShotToEnemy .42s steps(7,end) forwards !important;
}
.attackFx_fire i { color:#ff5a2e !important; background:#ffd447 !important; }
.attackFx_water i { color:#208cff !important; background:#8ee9ff !important; }
.attackFx_light i { color:#ffe044 !important; background:#fff7a1 !important; }
@keyframes pixelShotToEnemy {
  0% { opacity:1; transform:translate(-50%,-50%) scale(1); }
  72% { opacity:1; left:var(--hit-x); top:var(--hit-y); transform:translate(-50%,-50%) scale(1.15); }
  100% { opacity:0; left:var(--hit-x); top:var(--hit-y); transform:translate(-50%,-50%) scale(2); }
}
@keyframes pixelEnemyImpact {
  0%,58% { opacity:0; transform:translate(-50%,-50%) scale(0); }
  62% { opacity:1; transform:translate(-50%,-50%) scale(.45); }
  82% { opacity:1; transform:translate(-50%,-50%) scale(1); }
  100% { opacity:0; transform:translate(-50%,-50%) scale(1.45); }
}

/* 3) Use the upper screen instead of vertically centering the title composition. */
.titleScreen {
  justify-content: flex-start !important;
  padding-top: calc(env(safe-area-inset-top) + 18px) !important;
  padding-bottom: calc(env(safe-area-inset-bottom) + 12px) !important;
}
.titleKicker { margin-top: 0 !important; }
.titleLogo { margin-top: 5px !important; }
.titleTagline { margin-top: 5px !important; }
.titleScene { margin-top: 8px !important; }
.titleOrbs { margin-top: 6px !important; }
.titleSystems { margin-top: 6px !important; }
.titleStartButton { margin-top: 9px !important; }
.titleFoot { margin-top: 7px !important; }

/* 4) Classic RPG-style Game Over presentation. */
.gameOverCard {
  position: fixed !important;
  z-index: 60 !important;
  inset: 0 !important;
  width: 100% !important;
  max-width: none !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 12px !important;
  padding: calc(env(safe-area-inset-top) + 24px) 24px calc(env(safe-area-inset-bottom) + 24px) !important;
  border: 0 !important;
  background: #020202 !important;
  color: #fff !important;
}
.gameOverHeroWrap { width:132px; height:86px; display:grid; place-items:center; overflow:visible; }
.gameOverHero {
  width: 82px;
  height: auto;
  image-rendering: pixelated;
  transform: rotate(86deg) translateY(8px);
  filter: grayscale(.72) brightness(.72) sepia(.18) drop-shadow(7px 5px 0 #5d1018);
}
.gameOverTitle { font-size: clamp(38px,12vw,58px); font-weight:1000; letter-spacing:.08em; line-height:1; }
.gameOverStats { width:min(100%,340px); display:grid; grid-template-columns:1fr 1fr; gap:5px; }
.gameOverStats span { border:2px solid #eee; padding:7px 9px; background:#050505; font-size:12px; font-weight:900; text-align:center; }
.gameOverTip { width:min(100%,340px); border:2px solid #eee; padding:9px; color:#d7d7d7; font-size:10px; line-height:1.45; text-align:center; }
.gameOverCard button { width:min(100%,280px); min-height:48px; border:3px double #fff !important; background:#030303 !important; color:#fff !important; font-weight:1000; letter-spacing:.12em; }

/* Heart is magenta/pink; fire stays red/orange. Never let the two read as the same red family. */
.tile.heart, .nextOrb.heart, .nextOrbBack.heart, .skillPalette button.heart, .titleOrbs .heart {
  background-color:#3b0628 !important;
  border-color:#ff70c5 !important;
}
.tile.fire, .nextOrb.fire, .nextOrbBack.fire, .skillPalette button.fire, .titleOrbs .fire {
  background-color:#3c0903 !important;
  border-color:#ff6a24 !important;
}
'''

TSX.write_text(ts)
CSS.write_text(css)

# Re-palette HEART asset into unmistakable pink/magenta while preserving 8-bit clusters and alpha.
im = Image.open(HEART).convert('RGBA')
pix = im.load()
for y in range(im.height):
    for x in range(im.width):
        r,g,b,a = pix[x,y]
        if a == 0:
            continue
        lum = (r*3 + g*5 + b*2) // 10
        if lum < 35:
            pix[x,y] = (35, 2, 24, a)
        elif lum < 90:
            pix[x,y] = (116, 8, 72, a)
        elif lum < 170:
            pix[x,y] = (224, 28, 142, a)
        else:
            pix[x,y] = (255, 132, 214, a)
im.save(HEART, optimize=True)
print('review pass 1-5 + heart palette applied')
