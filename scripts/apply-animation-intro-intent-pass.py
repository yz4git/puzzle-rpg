from pathlib import Path

TSX = Path('app/PuzzleRPGGame.tsx')
CSS = Path('app/PuzzleRPGGame.module.css')

ts = TSX.read_text()
css = CSS.read_text()


def replace_once(src: str, old: str, new: str, label: str) -> str:
    count = src.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    return src.replace(old, new, 1)

# Safari-safe asset rendering: preload sprites and use a real img for board icons.
ts = replace_once(
    ts,
    'import { useMemo, useState, type CSSProperties } from "react";',
    'import { useEffect, useMemo, useState, type CSSProperties } from "react";',
    'react import',
)

ts = replace_once(
    ts,
    '  const initial = useMemo(() => newRun(), []);\n  const [board, setBoard] = useState<Board>(initial.board);',
    '''  const initial = useMemo(() => newRun(), []);\n\n  useEffect(() => {\n    const spriteSources = [\n      PIXEL_ART_ASSETS.hero,\n      ...Object.values(PIXEL_ART_ASSETS.enemies),\n      ...Object.values(PIXEL_ART_ASSETS.orbs),\n    ];\n    for (const src of spriteSources) {\n      const image = new Image();\n      image.decoding = "async";\n      image.src = src;\n    }\n  }, []);\n\n  const [board, setBoard] = useState<Board>(initial.board);''',
    'asset preload',
)

# One clear start action used by both the button and the whole stage-intro surface.
ts = replace_once(
    ts,
    '''  const dangerousIntent = intent.kind === "heavy" || intent.kind === "pierce" || (intent.kind === "drain" && playerShield < intent.power);''',
    '''  function beginStage() {\n    if (!stageIntro || showTitle || stageClear || gameOver || isResolving) return;\n    primeAudio();\n    playSfx("uiConfirm");\n    setStageIntro(false);\n    setMessage("BATTLE START • INTENTを読んで一手を選ぶ");\n  }\n\n  const dangerousIntent = intent.kind === "heavy" || intent.kind === "pierce" || (intent.kind === "drain" && playerShield < intent.power);''',
    'begin stage function',
)

ts = replace_once(
    ts,
    '''  const enemyPixelClass = `${styles.enemyPixelSprite} ${resolutionPhase === "attack" ? styles.enemyPixelStruck : ""}`;''',
    '''  const enemyPixelClass = `${styles.enemyPixelSprite} ${resolutionPhase === "attack" ? styles.enemyPixelStruck : ""}`;\n  const nextIntentAlert = nextIntent.kind !== "attack" || nextIntent.power >= Math.max(12, playerShield + 5);''',
    'next intent alert',
)

# Make NEXT action visually explicit and special attacks impossible to miss.
ts = replace_once(
    ts,
    '''        <div className={`${styles.intentCard} ${styles.intentNext}`}>\n          <div className={styles.intentTurn}>NEXT</div>''',
    '''        <div className={`${styles.intentCard} ${styles.intentNext} ${nextIntentAlert ? styles.intentNextAlert : ""}`}>\n          <div className={styles.intentTurn}>{nextIntentAlert ? "NEXT !" : "NEXT"}</div>''',
    'next intent markup',
)

# Real image element prevents CSS background-image dropouts while transforms are active.
ts = replace_once(
    ts,
    '''                  <span>{ORB_LABEL[orb]}</span>\n                  {movePreview ? <small className={`${styles.movePreview} ${styles[`preview_${movePreview.tone}`] ?? ""}`}>{movePreview.label}</small> : null}''',
    '''                  <img\n                    className={styles.tileIcon}\n                    src={PIXEL_ART_ASSETS.orbs[orb]}\n                    alt=""\n                    aria-hidden="true"\n                    draggable={false}\n                    decoding="async"\n                  />\n                  {movePreview ? <small className={`${styles.movePreview} ${styles[`preview_${movePreview.tone}`] ?? ""}`}>{movePreview.label}</small> : null}''',
    'tile image markup',
)

# Entire stage briefing starts the battle. Button remains a strong explicit affordance.
ts = replace_once(
    ts,
    '''        <div className={styles.stageIntroOverlay} role="dialog" aria-label={`Stage ${stage} briefing`}>''',
    '''        <div\n          className={styles.stageIntroOverlay}\n          role="dialog"\n          aria-label={`Stage ${stage} briefing`}\n          tabIndex={0}\n          onClick={beginStage}\n          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") beginStage(); }}\n        >''',
    'intro overlay interaction',
)

ts = replace_once(
    ts,
    '''          <div className={styles.tacticalHint}><strong>攻略ヒント</strong><span>{ENEMY_HINT[enemy.kind]}　※3手ごとに敵威力+1</span></div>\n          <button type="button" className={styles.battleStartButton} onClick={() => { primeAudio(); playSfx("uiConfirm"); setStageIntro(false); setMessage("BATTLE START • INTENTを読んで一手を選ぶ"); }}>BATTLE START</button>''',
    '''          <div className={styles.tacticalHint}><strong>攻略ヒント</strong><span>{ENEMY_HINT[enemy.kind]}　※3手ごとに敵威力+1</span></div>\n          <div className={styles.introTapHint}>▼ 画面のどこを押しても開始 ▼</div>\n          <button type="button" className={styles.battleStartButton} onClick={(event) => { event.stopPropagation(); beginStage(); }}>▶ BATTLE START</button>''',
    'intro start affordance',
)

marker = '/* Animation visibility + intro + NEXT intent pass */'
if marker in css:
    raise SystemExit('CSS pass already present')

css += r'''

/* Animation visibility + intro + NEXT intent pass */
/* iOS Safari: keep transformed tiles on a stable compositor layer and render the orb as a real image. */
.tile {
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  transform-style: preserve-3d;
  will-change: transform;
  isolation: isolate;
}
.tileIcon {
  position: relative;
  z-index: 1;
  display: block;
  width: 70%;
  height: 70%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  transform: translateZ(1px);
}
/* All motion frames stay fully opaque. Clearing is the only animation allowed to fade a tile. */
.swapFromLeft,.swapFromRight,.swapFromUp,.swapFromDown,
.drop1,.drop2,.drop3,.drop4,.drop5,.drop6 {
  opacity: 1 !important;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  will-change: transform;
}
@keyframes swapFromLeft { from { transform:translate3d(-108%,0,0); z-index:6; opacity:1; } to { transform:translate3d(0,0,0); z-index:6; opacity:1; } }
@keyframes swapFromRight { from { transform:translate3d(108%,0,0); z-index:6; opacity:1; } to { transform:translate3d(0,0,0); z-index:6; opacity:1; } }
@keyframes swapFromUp { from { transform:translate3d(0,-108%,0); z-index:6; opacity:1; } to { transform:translate3d(0,0,0); z-index:6; opacity:1; } }
@keyframes swapFromDown { from { transform:translate3d(0,108%,0); z-index:6; opacity:1; } to { transform:translate3d(0,0,0); z-index:6; opacity:1; } }
@keyframes drop1 { from { transform:translate3d(0,-108%,0); opacity:1; } to { transform:translate3d(0,0,0); opacity:1; } }
@keyframes drop2 { from { transform:translate3d(0,-216%,0); opacity:1; } to { transform:translate3d(0,0,0); opacity:1; } }
@keyframes drop3 { from { transform:translate3d(0,-324%,0); opacity:1; } to { transform:translate3d(0,0,0); opacity:1; } }
@keyframes drop4 { from { transform:translate3d(0,-432%,0); opacity:1; } to { transform:translate3d(0,0,0); opacity:1; } }
@keyframes drop5 { from { transform:translate3d(0,-540%,0); opacity:1; } to { transform:translate3d(0,0,0); opacity:1; } }
@keyframes drop6 { from { transform:translate3d(0,-648%,0); opacity:1; } to { transform:translate3d(0,0,0); opacity:1; } }

/* NEXT TURN is intentionally louder than NOW: it is the core planning information. */
.intents { grid-template-columns: .9fr 1.1fr !important; gap: 5px !important; }
.intentNext {
  position: relative;
  min-height: 44px !important;
  border: 2px solid #ffe15a !important;
  background: #0d0b02 !important;
  box-shadow: inset 0 0 0 1px #6a5700, 3px 3px 0 #000 !important;
}
.intentNext .intentTurn {
  color: #ffe15a !important;
  font-size: 9px !important;
  font-weight: 1000 !important;
  text-shadow: 2px 2px 0 #000;
}
.intentNext .intentIcon {
  border-radius: 0 !important;
  border: 1px solid #ffe15a !important;
  background: #050505 !important;
  font-size: 14px !important;
}
.intentNext .intentBody strong {
  color: #fff3a0 !important;
  font-size: 10px !important;
  letter-spacing: .04em !important;
}
.intentNext .intentBody span {
  color: #f4f0d5 !important;
  font-size: 7px !important;
}
.intentNext .intentPower {
  color: #ffe15a !important;
  font-size: 18px !important;
  text-shadow: 2px 2px 0 #000;
}
.intentNextAlert {
  border-color: #ff6262 !important;
  box-shadow: inset 0 0 0 1px #7d1515, 3px 3px 0 #000 !important;
  animation: nextIntentBlink .76s steps(2,end) infinite;
}
.intentNextAlert .intentTurn,
.intentNextAlert .intentPower { color:#ff7777 !important; }
.intentNextAlert .intentBody strong { color:#fff !important; }
@keyframes nextIntentBlink { 50% { background:#1d0505; filter:brightness(1.16); } }

/* Whole intro is tappable, while the explicit button looks unmistakably actionable. */
.stageIntroOverlay {
  cursor: pointer;
  outline: none;
}
.introTapHint {
  position: relative;
  margin-top: 10px;
  color: #ffe15a;
  font-size: 10px;
  font-weight: 1000;
  letter-spacing: .08em;
  text-shadow: 2px 2px 0 #000;
  animation: introTapBlink .8s steps(2,end) infinite;
}
.battleStartButton {
  min-height: 58px !important;
  width: min(100%, 360px) !important;
  margin-top: 8px !important;
  border: 4px double #fff !important;
  background: #050505 !important;
  color: #fff !important;
  font-size: 18px !important;
  font-weight: 1000 !important;
  letter-spacing: .1em !important;
  box-shadow: 0 0 0 3px #000, 0 0 0 5px #ffe15a !important;
  animation: battleStartBlink .72s steps(2,end) infinite !important;
}
@keyframes introTapBlink { 50% { color:#fff; } }
@keyframes battleStartBlink { 50% { color:#ffe15a; border-color:#ffe15a !important; transform:translateY(-1px); } }

@media (max-height:760px) and (orientation:portrait) {
  .intentNext { min-height: 36px !important; }
  .intentNext .intentBody strong { font-size: 8px !important; }
  .intentNext .intentPower { font-size: 14px !important; }
  .introTapHint { margin-top:5px; font-size:8px; }
  .battleStartButton { min-height:48px !important; font-size:15px !important; margin-top:5px !important; }
}
'''

TSX.write_text(ts)
CSS.write_text(css)
print('animation visibility + intro + NEXT intent pass applied')
