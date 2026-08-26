from pathlib import Path

root = Path('.')
tsx_path = root / 'app' / 'PuzzleRPGGame.tsx'
css_path = root / 'app' / 'PuzzleRPGGame.module.css'

tsx = tsx_path.read_text()

asset_import = 'import { PIXEL_ART_ASSETS } from "./pixelArtAssets";'
if asset_import not in tsx:
    tsx = tsx.replace(
        'import { EnemySprite } from "./enemyAssets";\n',
        'import { EnemySprite } from "./enemyAssets";\n' + asset_import + '\n',
        1,
    )

hero_markup = '''          <img\n            className={styles.titleHeroSprite}\n            src={PIXEL_ART_ASSETS.hero}\n            alt="Puzzle RPG hero"\n            draggable={false}\n            decoding="async"\n          />\n'''
anchor = '          <div className={styles.titleTagline}>READ THE INTENT. BUILD THE BOARD. BREAK THE ENEMY.</div>\n'
if 'className={styles.titleHeroSprite}' not in tsx:
    if anchor not in tsx:
        raise SystemExit('title tagline anchor not found')
    tsx = tsx.replace(anchor, anchor + hero_markup, 1)

tsx_path.write_text(tsx)

css = css_path.read_text()
marker = '/* GENERATED_PIXEL_UI_V1 */'
if marker in css:
    css = css.split(marker, 1)[0].rstrip() + '\n'

css += r'''

/* GENERATED_PIXEL_UI_V1 */
/*
 * Surface treatment derived from the approved generated reference sheet.
 * Battle geometry and responsive board sizing stay unchanged; only presentation
 * moves toward a late-1980s 8-bit home-console RPG vocabulary.
 */
.shell {
  --panel: #050505;
  --line: rgba(245, 245, 245, .9);
  background: #030303;
  color: #f4f4f4;
  font-family: ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
}

.shell::before {
  opacity: .16;
  background-image: repeating-linear-gradient(
    180deg,
    rgba(255,255,255,.025) 0,
    rgba(255,255,255,.025) 1px,
    transparent 1px,
    transparent 4px
  );
  background-size: auto;
}

.topBar,
.enemyCard,
.intentCard,
.playerStrip,
.nextStrip,
.ruleHint,
.message,
.skillPalette,
.actionBar,
.gameOverCard {
  border-radius: 0 !important;
  border-color: rgba(245,245,245,.84) !important;
  background: #050505 !important;
  box-shadow: none !important;
}

.topBar {
  padding: 3px 7px 4px;
  border: 1px solid rgba(245,245,245,.75);
  align-items: center;
}

.eyebrow { color: #cfcfcf; letter-spacing: .12em; }
.stage { font-weight: 900; letter-spacing: .08em; }
.resources span {
  border-radius: 0;
  border-color: rgba(245,245,245,.72);
  background: #050505;
}

.enemyCard {
  border-width: 1px !important;
  grid-template-columns: 100px 1fr;
  min-height: 86px;
  padding: 4px 7px;
}
.enemySceneGlow { display: none !important; }
.enemyPixelSprite,
.introPixelSprite,
.titleHeroSprite,
[data-pixel-sprite="enemy"] {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  object-fit: contain;
  filter: none !important;
}
.enemyPixelSprite {
  width: 96px !important;
  height: 78px !important;
  max-width: 100%;
  transform-origin: center;
}
.enemyPixelStruck { animation: retroEnemyHit .24s steps(2, jump-none); }
@keyframes retroEnemyHit {
  0% { transform: translateX(0); filter: brightness(1) !important; }
  33% { transform: translateX(6px); filter: brightness(2.3) !important; }
  66% { transform: translateX(-5px); }
  100% { transform: translateX(0); }
}
.enemyHeader { border-bottom: 1px solid rgba(255,255,255,.32); padding-bottom: 2px; }
.enemyName { font-size: 11px; letter-spacing: .08em; }
.specialTag { border-radius: 0; background: #050505; }
.hpTrack,
.playerHpTrack,
.shieldTrack,
.xpTrack {
  border-radius: 0 !important;
  border-color: rgba(255,255,255,.72);
  background: #020202;
}
.enemyHpFill { background: #e62832 !important; box-shadow: none; }
.playerHpFill { background: #32df57 !important; }
.shieldFill { background: #319ee8 !important; }
.xpFill { background: #8c42df !important; }

.intents { gap: 2px; }
.intentCard {
  border-width: 1px !important;
  min-height: 40px;
}
.intentIcon {
  border-radius: 0;
  border: 1px solid rgba(255,255,255,.38);
  background: #080808;
}
.intentTurn { color: #fff; }
.intentNext .intentTurn { color: #d5d5d5; }
.intentPower,
.intentNext .intentPower { color: #fff; }

.tile,
.nextOrb,
.nextOrbBack,
.skillPalette button {
  border-radius: 1px !important;
  background-image: none !important;
  box-shadow:
    inset 0 0 0 1px rgba(0,0,0,.92),
    0 0 0 1px rgba(220,220,220,.55) !important;
  text-shadow: none !important;
}
.tile { border: 1px solid #bdbdbd !important; }
.tile > span,
.nextOrb,
.nextOrbBack,
.titleOrbs span,
.skillPalette button > span {
  filter: contrast(1.18) saturate(1.08);
}
.fire { background-color: #3c0a0a !important; }
.water { background-color: #071f46 !important; }
.light { background-color: #4b3b02 !important; }
.heart { background-color: #3c0921 !important; }
.guard { background-color: #073122 !important; }

.movePreview,
.resultChips span,
.combatPop,
.combo {
  border-radius: 0 !important;
  font-family: inherit;
}
.ruleHint,
.message {
  border-width: 1px !important;
  font-family: inherit;
}

.skillButton,
.resetButton,
.titleStartButton,
.battleStartButton,
.gameOverCard button {
  border-radius: 0 !important;
  background: #050505 !important;
  border: 2px solid #f2f2f2 !important;
  color: #fff !important;
  box-shadow: inset 0 0 0 2px #050505, inset 0 0 0 3px #8a8a8a !important;
  font-family: inherit;
  letter-spacing: .08em;
}
.skillReady,
.prismBreakReady {
  color: #a880ff !important;
  border-color: #a880ff !important;
}

/* Title: generated hero + boxed 8-bit menu composition. */
.titleScreen {
  inset: 0 !important;
  margin: 0 !important;
  padding: max(20px, calc(env(safe-area-inset-top) + 14px)) 20px max(18px, calc(env(safe-area-inset-bottom) + 12px)) !important;
  background: #020202 !important;
  color: #fff;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  font-family: ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
}
.titleScreen::before {
  content: "";
  position: absolute;
  inset: max(12px, env(safe-area-inset-top)) 10px max(12px, env(safe-area-inset-bottom));
  border: 2px solid #eee;
  pointer-events: none;
  box-shadow: inset 0 0 0 2px #020202, inset 0 0 0 3px #777;
}
.titleGrid { display: none !important; }
.titleKicker { color: #d9d9d9 !important; letter-spacing: .18em; font-size: 10px !important; }
.titleLogo {
  text-shadow: 3px 3px 0 #3d3d3d !important;
  filter: none !important;
  letter-spacing: .06em !important;
}
.titleLogo span,
.titleLogo strong { color: #fff !important; }
.titleTagline {
  color: #ddd !important;
  font-size: 9px !important;
  line-height: 1.45;
  letter-spacing: .08em !important;
}
.titleHeroSprite {
  width: clamp(112px, 35vw, 150px);
  height: auto;
  max-height: 150px;
  margin: 2px auto 0;
  display: block;
  transform: scale(1.65);
  transform-origin: center;
  object-fit: contain;
}
.titleOrbs { margin-top: -2px !important; transform: scale(.88); }
.titleSystems {
  border: 1px solid #dedede !important;
  border-radius: 0 !important;
  background: #050505 !important;
  padding: 6px !important;
}
.titleSystems span { color: #eee !important; }
.titleStartButton {
  min-height: 48px;
  font-size: 15px !important;
  padding: 10px 22px !important;
}
.titleFoot { color: #ccc !important; letter-spacing: .15em !important; }

/* Stage briefing: large enemy, readable classic RPG speech window. */
.stageIntroOverlay {
  inset: 0 !important;
  padding: max(10px, calc(env(safe-area-inset-top) + 8px)) 9px max(10px, calc(env(safe-area-inset-bottom) + 8px)) !important;
  background: #020202 !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  font-family: ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
  gap: 5px !important;
}
.introStageLabel {
  width: 100%;
  padding: 6px 8px;
  border: 2px solid #eee;
  background: #050505;
  text-align: center;
  letter-spacing: .12em;
}
.introPixelSprite {
  width: min(46vw, 186px) !important;
  height: min(24dvh, 190px) !important;
  margin: 1px auto !important;
  transform: none !important;
}
.introEnemyName {
  color: #fff !important;
  font-size: 14px !important;
  font-weight: 900;
  letter-spacing: .1em !important;
  text-align: center;
}
.enemySpeech {
  position: relative;
  width: 100%;
  min-height: 122px;
  display: flex;
  align-items: center;
  padding: 12px 15px 18px !important;
  border: 2px solid #eee !important;
  border-radius: 0 !important;
  background: #040404 !important;
  color: #fff !important;
  box-shadow: inset 0 0 0 2px #040404, inset 0 0 0 3px #707070 !important;
  font-size: clamp(16px, 4.35vw, 20px) !important;
  line-height: 1.55 !important;
  font-weight: 750 !important;
  letter-spacing: .035em !important;
  text-align: left !important;
}
.enemySpeech::after {
  content: "▼";
  position: absolute;
  right: 11px;
  bottom: 4px;
  font-size: 10px;
  animation: retroCursor .8s steps(2, jump-none) infinite;
}
@keyframes retroCursor { 50% { opacity: .18; transform: translateY(2px); } }
.tacticalHint {
  width: 100%;
  padding: 8px 11px !important;
  border: 1px solid #d9d9d9 !important;
  border-radius: 0 !important;
  background: #050505 !important;
  color: #fff !important;
  text-align: left !important;
}
.tacticalHint strong {
  display: block;
  margin-bottom: 4px;
  color: #ffe568 !important;
  font-size: 11px !important;
  letter-spacing: .12em;
}
.tacticalHint span { color: #f0f0f0 !important; font-size: 13px !important; line-height: 1.42 !important; }
.battleStartButton { min-height: 45px; width: 100%; font-size: 14px !important; }

.stageClearOverlay,
.damageVignette {
  border-radius: 0 !important;
  font-family: inherit;
}
.clearTitle { text-shadow: 3px 3px 0 #444 !important; }

@media (max-height: 760px) {
  .titleHeroSprite { width: 104px; transform: scale(1.45); }
  .titleOrbs { display: none !important; }
  .enemySpeech { min-height: 94px; font-size: clamp(14px, 4vw, 17px) !important; padding: 9px 12px 15px !important; }
  .introPixelSprite { height: 18dvh !important; }
  .tacticalHint { padding: 6px 9px !important; }
}
'''

css_path.write_text(css)
print('Applied generated 8-bit character art + retro UI integration')
