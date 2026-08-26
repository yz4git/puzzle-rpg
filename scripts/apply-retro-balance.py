from pathlib import Path
from PIL import Image

TSX = Path('app/PuzzleRPGGame.tsx')
CSS = Path('app/PuzzleRPGGame.module.css')
tsx = TSX.read_text()
css = CSS.read_text()

def rep(old: str, new: str, count: int = 1):
    global tsx
    found = tsx.count(old)
    if found < count:
        raise SystemExit(f'missing pattern ({found}): {old[:120]!r}')
    tsx = tsx.replace(old, new, count)

# Harder tactical economy: defense/setup matter, attack-only play accumulates pressure.
rep('const PLAYER_MAX_SHIELD = 60;', 'const PLAYER_MAX_SHIELD = 42;')
rep('''const ATTACK_PER_ORB: Record<Orb, number> = {
  fire: 7,
  water: 6,
  light: 8,
  heart: 0,
  guard: 0,
};''', '''const ATTACK_PER_ORB: Record<Orb, number> = {
  fire: 6,
  water: 5,
  light: 7,
  heart: 0,
  guard: 0,
};''')
rep('if (orb === "heart") frameHeal += 4;', 'if (orb === "heart") frameHeal += 3;')
rep('else if (orb === "guard") frameShield += 6;', 'else if (orb === "guard") frameShield += 5;')
rep('const cascadeWeight = safety === 0 ? 1 : safety === 1 ? 0.72 : 0.55;', 'const cascadeWeight = safety === 0 ? 1 : safety === 1 ? 0.52 : 0.34;')
rep('''const comboMultiplier = 1 + Math.min(0.3, Math.max(0, combo - 1) * 0.15);
  const resourceMultiplier = 1 + Math.min(0.2, Math.max(0, combo - 1) * 0.1);''', '''const comboMultiplier = 1 + Math.min(0.18, Math.max(0, combo - 1) * 0.09);
  const resourceMultiplier = 1 + Math.min(0.1, Math.max(0, combo - 1) * 0.05);''')
rep('return 88 + early * 21 + mid * 16 + late * 21;', 'return 112 + early * 26 + mid * 22 + late * 28;')
rep('return 7 + Math.floor(early * 1.15 + mid * 0.8 + late * 1.15);', 'return 10 + Math.floor(early * 1.45 + mid * 1.05 + late * 1.5);')
rep('armor: 4 + tier,', 'armor: 6 + tier * 2,')
rep('''function enemyIntent(stage: number, enemyTurn: number, enemy: EnemyDefinition): EnemyIntent {
  const base = enemyBaseAttack(stage);
  const phase = enemyTurn % 3;''', '''function enemyIntent(stage: number, enemyTurn: number, enemy: EnemyDefinition): EnemyIntent {
  // Escalation prevents indefinite attack-only play: every 3 enemy turns adds +1 power.
  const base = enemyBaseAttack(stage) + Math.floor(enemyTurn / 3);
  const phase = enemyTurn % 3;''')
rep('power: base + 6, detail: "次の強打。SHIELD推奨"', 'power: base + 8, detail: "強打。DEF/SETUP必須級"')
rep('power: base + 1, detail: "SHIELDで軽減可能"', 'power: base + 2, detail: "DEFで軽減可能"')
rep('power: base + 2, detail: "HPダメージ分だけ回復"', 'power: base + 4, detail: "HPダメージ以上に回復"')
rep('power: base + 5, detail: "強打。吸収なし"', 'power: base + 7, detail: "強打。吸収なし"')
rep('power: base + 2, detail: "SHIELD無視。HPを確保"', 'power: base + 4, detail: "DEF無視。HPを確保"')
rep('power: base + (phase === 2 ? 5 : 0), detail: "SHIELDで軽減可能"', 'power: base + (phase === 2 ? 7 : 0), detail: "DEFで軽減可能"')
rep('power: Math.max(4, base - 2), detail: "攻撃後、NEXT列を右へシフト"', 'power: Math.max(7, base), detail: "攻撃後、NEXT列を右へシフト"')
rep('power: base + 5, detail: "強打。今のNEXTを活用"', 'power: base + 7, detail: "強打。今のNEXTを活用"')
rep('power: base + 6, detail: "3手目の強打"', 'power: base + 8, detail: "3手目の強打"')
tsx = tsx.replace('detail: "SHIELDで軽減可能"', 'detail: "DEFで軽減可能"')

rep('''enemyHpAfter = Math.min(maxEnemyHp, enemyHpBefore + hpDamage);
      summary = hpDamage > 0 ? `${intent.label} -${hpDamage} / 敵+${hpDamage}` : `${intent.label} BLOCK`;''', '''const drainHeal = Math.ceil(hpDamage * 1.25);
      enemyHpAfter = Math.min(maxEnemyHp, enemyHpBefore + drainHeal);
      summary = hpDamage > 0 ? `${intent.label} -${hpDamage} / 敵+${drainHeal}` : `${intent.label} BLOCK`;''')
rep('setPlayerShield((value) => Math.floor(value * 0.5));', 'setPlayerShield((value) => Math.floor(value * 0.25));')
rep('''const skillGain = isSetupTurn
      ? 28
      : Math.min(20, plan.matchedCount * 2 + Math.max(0, plan.combo - 1) * 4);''', '''const skillGain = isSetupTurn
      ? 24
      : Math.min(16, plan.matchedCount * 2 + Math.max(0, plan.combo - 1) * 3);''')
rep('chips.push("INTENT 50%");', 'chips.push("INTENT 65%");')
rep('chips.push("PRISM +28");', 'chips.push("PRISM +24");')
rep('? { ...intent, power: Math.max(1, Math.ceil(intent.power * 0.5)) }', '? { ...intent, power: Math.max(1, Math.ceil(intent.power * 0.65)) }')
rep('`TACTICAL SETUP • PRISM +28 • ${enemyResult.summary}`', '`TACTICAL SETUP • PRISM +24 • ${enemyResult.summary}`')
rep('DEF 50% CARRIED', 'DEF 25% CARRIED')

# Make battle escalation visible, like the approved reference HUD.
rep('''  const intent = enemyIntent(stage, enemyTurn, enemy);
  const nextIntent = enemyIntent(stage, enemyTurn + 1, enemy);
  const level = 1 + Math.floor(xp / 100);''', '''  const intent = enemyIntent(stage, enemyTurn, enemy);
  const nextIntent = enemyIntent(stage, enemyTurn + 1, enemy);
  const enemyPressure = Math.floor(enemyTurn / 3);
  const level = 1 + Math.floor(xp / 100);''')
rep('''        <div className={styles.resources}>
          <span>LV {level}</span>
          <span>◈ {gold}</span>
        </div>''', '''        <div className={styles.resources}>
          <span className={styles.turnCounter}>TURN {String(enemyTurn + 1).padStart(2, "0")}{enemyPressure > 0 ? ` ↑${enemyPressure}` : ""}</span>
          <span>LV {level}</span>
          <span>◈ {gold}</span>
        </div>''')

# Compact the bottom explanation into one glanceable tactical strip.
rep('''        {selected && !skillMode
          ? "② 隣接パネル上の予測結果を見て選択 • PLATE×は無効攻撃"
          : setupRecommended
            ? `SETUP RECOMMENDED • NOW ${intent.label} ${intent.power} → 金枠交換で威力50% + PRISM28`
            : setupMode
              ? `即消しなし → 金枠が有力SETUP（次手 最大${analysis.bestSetupScore}候補）`
              : `消せる交換 ${analysis.immediateMoves} • SETUP=敵威力50%+PRISM28 • ⬢×3でDEF`}''', '''        {selected && !skillMode
          ? "予測を見て隣接パネルを選択 • PLATE×は無効"
          : setupRecommended
            ? `SETUP推奨 • ${intent.label} ${intent.power} → 威力65% / PRISM+24`
            : setupMode
              ? `SETUP候補 • 次手 最大${analysis.bestSetupScore}`
              : `消せる手 ${analysis.immediateMoves} • ⬢=DEF • 長期戦は敵威力↑`}''')

# Sample-like title hierarchy: logo -> hero/world scene -> start -> systems.
rep('''          <img
            className={styles.titleHeroSprite}
            src={PIXEL_ART_ASSETS.hero}
            alt="Puzzle RPG hero"
            draggable={false}
            decoding="async"
          />''', '''          <div className={styles.titleScene}>
            <div className={styles.titleHorizon} aria-hidden="true" />
            <img
              className={styles.titleHeroSprite}
              src={PIXEL_ART_ASSETS.hero}
              alt="Puzzle RPG hero"
              draggable={false}
              decoding="async"
            />
          </div>''')
rep('<strong>TACTICAL HINT</strong><span>{ENEMY_HINT[enemy.kind]}</span>', '<strong>攻略ヒント</strong><span>{ENEMY_HINT[enemy.kind]}　※3手ごとに敵威力+1</span>')
TSX.write_text(tsx)

retro = r'''

/* RETRO_BALANCE_PASS_V2 — reference-aligned 8-bit surface, large iPhone touch board retained. */
.turnCounter{border-color:#f2f2f2!important;border-radius:0!important;background:#050505!important;color:#fff!important;letter-spacing:.06em}

/* Never move the tap target itself: pulse only hard outline/brightness. */
.setupHint{transform:none!important;animation:setupGlow8 .72s steps(2,end) infinite!important}
@keyframes setupGlow8{0%{outline-color:#d9b93d;filter:brightness(1);box-shadow:inset 0 0 0 1px #4a3a00}100%{outline-color:#fff075;filter:brightness(1.18);box-shadow:inset 0 0 0 2px #8a6d00,0 0 0 2px #2a2100}}

/* Title composition follows the approved sample without shrinking interactive elements. */
.titleScreen{justify-content:flex-start!important;gap:0!important;padding:max(16px,calc(env(safe-area-inset-top) + 10px)) 18px max(14px,calc(env(safe-area-inset-bottom) + 10px))!important}
.titleKicker{order:1;margin-top:5px}.titleLogo{order:2;margin-top:8px!important;transform:none!important}.titleLogo span{font-size:clamp(44px,13vw,62px)!important}.titleLogo strong{font-size:clamp(58px,18vw,82px)!important}.titleTagline{order:3;margin-top:8px!important;max-width:310px!important;font-size:8px!important;line-height:1.35!important}
.titleScene{order:4;position:relative;width:min(100%,342px);height:190px;margin:4px auto 0;overflow:hidden;border-bottom:2px solid #bdbdbd;background:#020202}
.titleHorizon{position:absolute;left:4%;right:4%;bottom:13px;height:78px;background:#24164b;clip-path:polygon(0 88%,7% 88%,7% 72%,13% 72%,13% 57%,20% 57%,20% 76%,27% 76%,27% 42%,34% 42%,34% 64%,41% 64%,41% 30%,48% 30%,48% 68%,56% 68%,56% 50%,64% 50%,64% 75%,72% 75%,72% 61%,80% 61%,80% 79%,88% 79%,88% 67%,94% 67%,94% 88%,100% 88%,100% 100%,0 100%);box-shadow:inset 0 -9px 0 #090909}.titleHorizon::before{content:"";position:absolute;left:0;right:0;bottom:8px;height:2px;background:#7c52c6;box-shadow:0 7px 0 #3e2b6b}
.titleHeroSprite{position:absolute!important;z-index:2;left:50%;bottom:0;width:102px!important;max-height:150px!important;margin:0!important;transform:translateX(-50%) scale(1.38)!important;transform-origin:center bottom!important}.titleStartButton{order:5;width:min(100%,300px)!important;min-height:46px!important;margin-top:8px!important;animation:retroButtonBlink 1s steps(2,end) infinite!important}.titleSystems{order:6;margin-top:8px!important;width:min(100%,300px)}.titleOrbs{order:7;margin-top:7px!important;gap:5px!important;transform:none!important}.titleOrbs span{width:31px!important;height:31px!important;animation:none!important}.titleFoot{order:8;margin-top:7px!important}@keyframes retroButtonBlink{50%{border-color:#8e8e8e;color:#d0d0d0}}

/* Intro loses the modern spinning radial treatment. */
.stageIntroOverlay::before{display:none!important;animation:none!important}.stageIntroOverlay{background:#020202!important}.introPixelSprite{filter:drop-shadow(4px 4px 0 #000)!important;animation:pixelIntro8 .32s steps(4,end) both!important}@keyframes pixelIntro8{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}

/* Attack: hard pixel clusters travel from board to enemy; no soft beam/glow. */
.playerAttackFx,.enemyAttackFx,.damageVignette{image-rendering:pixelated}.playerAttackFx i{left:var(--sx)!important;top:var(--sy)!important;width:7px!important;height:7px!important;border-radius:0!important;background:#fff!important;box-shadow:7px 0 0 var(--attack-a),0 7px 0 var(--attack-b),7px 7px 0 #fff!important;filter:none!important;animation:pixelMote8 .34s var(--delay,0s) steps(4,end) both!important}@keyframes pixelMote8{0%{opacity:1;transform:translate(-50%,-50%) scale(1)}75%{opacity:1;left:15%;top:12%;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;left:14%;top:10%;transform:translate(-50%,-50%) scale(2)}}
.attackCharge{width:30px!important;height:30px!important;border-radius:0!important;border:3px solid #fff!important;background:var(--attack-b)!important;box-shadow:inset 0 0 0 4px var(--attack-a),4px 4px 0 #000!important;filter:none!important;font-size:0!important;animation:pixelCharge8 .4s steps(5,end) both!important}@keyframes pixelCharge8{0%{left:50%;top:68%;transform:translate(-50%,-50%) scale(.6);opacity:0}20%{opacity:1}80%{left:18%;top:15%;transform:translate(-50%,-50%) scale(1);opacity:1}100%{left:14%;top:10%;transform:translate(-50%,-50%) scale(1.35);opacity:0}}
.attackTrail{height:5px!important;border-radius:0!important;background:var(--attack-a)!important;box-shadow:0 5px 0 var(--attack-b),0 -5px 0 #fff!important;filter:none!important;animation:pixelTrail8 .4s steps(4,end) both!important}@keyframes pixelTrail8{0%,20%{opacity:0}40%,75%{opacity:1}100%{opacity:0}}
.playerAttackFx::before{width:42px!important;height:42px!important;border-radius:0!important;background:transparent!important;box-shadow:0 0 0 4px #fff,8px 0 0 0 var(--attack-a),0 8px 0 0 var(--attack-b),-8px 0 0 var(--attack-a),0 -8px 0 0 var(--attack-b)!important;animation:pixelImpact8 .36s .25s steps(4,end) both!important}@keyframes pixelImpact8{0%{opacity:0;transform:translate(-50%,-50%) scale(.5)}25%,65%{opacity:1;transform:translate(-50%,-50%) scale(1.3)}100%{opacity:0;transform:translate(-50%,-50%) scale(2)}}
.attackImpact{padding:3px 6px!important;border:2px solid #fff!important;background:#050505!important;color:#fff!important;font-size:15px!important;font-style:normal!important;text-shadow:2px 2px 0 #000!important;box-shadow:3px 3px 0 #000!important;animation:pixelText8 .36s .24s steps(3,end) both!important}@keyframes pixelText8{0%{opacity:0}30%,75%{opacity:1}100%{opacity:0}}

/* Enemy attack/damage: stepped, flat-color, high-contrast pixel slashes. */
.enemyAttackFx::before{height:6px!important;border-radius:0!important;background:#fff!important;box-shadow:0 6px 0 #d8334e,0 -6px 0 #7b1428!important;filter:none!important;animation:enemySlash8 .3s steps(4,end) both!important}.enemyAttackFx::after{background:rgba(180,20,45,.22)!important;animation:pixelFlash8 .3s steps(2,end) both!important}.enemyAttackFx i{width:5px!important;background:#fff!important;box-shadow:5px 0 0 #d8334e!important;filter:none!important;animation:enemyShard8 .3s steps(3,end) both!important}.enemyAttack_pierce::before{height:4px!important;background:#dcecff!important;box-shadow:0 5px 0 #6688d8!important}.enemyAttack_drain::after{background:rgba(132,0,55,.28)!important}.enemyAttack_disrupt::before{background:#f2cf38!important;box-shadow:0 6px 0 #7d3bb0,0 -6px 0 #2fbf87!important}@keyframes enemySlash8{0%{opacity:0;transform:rotate(-18deg) translateX(-55%) scaleX(.3)}25%,75%{opacity:1}100%{opacity:0;transform:rotate(-18deg) translateX(30%) scaleX(1)}}@keyframes enemyShard8{from{opacity:1;height:8%}to{opacity:0;height:34%}}@keyframes pixelFlash8{0%,100%{opacity:0}40%,65%{opacity:1}}
.damageVignette{background:rgba(118,0,22,.2)!important;box-shadow:inset 0 0 0 7px #a71c32,inset 0 0 0 13px #33000a!important;animation:damage8 .4s steps(4,end) both!important}.damageVignette::before,.damageVignette::after{height:6px!important;background:#fff!important;box-shadow:0 6px 0 #d8334e!important;filter:none!important}.damageVignette>span{padding:3px 7px;border:2px solid #fff;background:#050505;font-size:28px!important;font-style:normal!important;text-shadow:3px 3px 0 #720014!important;animation:damageNumber8 .4s steps(4,end) both!important}.damageVignette i{background:#fff!important;box-shadow:4px 0 0 #d8334e!important}.damagePierce{background:rgba(55,80,145,.2)!important;box-shadow:inset 0 0 0 7px #b5d5ff,inset 0 0 0 13px #172445!important}@keyframes damage8{0%,100%{opacity:0}20%,70%{opacity:1}}@keyframes damageNumber8{0%{opacity:0;transform:translate(-50%,-50%) scale(.5)}25%,70%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-66%) scale(1)}}
.combo,.combatPop,.resultChips span{border-radius:0!important;background:#050505!important;border:2px solid #eee!important;box-shadow:3px 3px 0 #000!important;text-shadow:2px 2px 0 #000!important}.combo{color:#ffe45c!important;animation:pixelPop8 .32s steps(3,end) both!important}.combatPop{color:#fff!important;animation:pixelPop8 .3s steps(3,end) both!important}.combatPopEnemy{color:#ff8d9f!important}@keyframes pixelPop8{0%{opacity:0;transform:translateX(-50%) scale(.5)}35%,80%{opacity:1;transform:translateX(-50%) scale(1)}100%{opacity:.9;transform:translateX(-50%) scale(1)}}
.stageClearOverlay{background:#020202!important;backdrop-filter:none!important;animation:pixelFlash8 .24s steps(2,end) both!important}.clearBurst{border-radius:0!important;border:3px solid #ffe36c!important;box-shadow:10px 0 0 #fff,-10px 0 0 #fff,0 10px 0 #fff,0 -10px 0 #fff!important;animation:clearBurst8 .8s steps(5,end) both!important}.clearTitle{font-style:normal!important;text-shadow:4px 4px 0 #705600!important;animation:clearTitle8 .55s steps(4,end) both!important}.clearRewards span{border-radius:0!important;background:#050505!important;border:2px solid #eee!important}@keyframes clearBurst8{from{transform:scale(.25);opacity:1}to{transform:scale(2.1);opacity:0}}@keyframes clearTitle8{0%{opacity:0;transform:scale(.5)}25%,80%{opacity:1;transform:scale(1)}100%{opacity:1}}

/* Lower HUD copy no longer competes with the board. */
.ruleHint{min-height:13px!important;padding:1px 3px!important;font-size:7px!important;line-height:1!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.message{min-height:12px!important;max-height:14px!important;padding:0 3px!important;font-size:6.5px!important;line-height:1!important;opacity:.72;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media (max-height:760px) and (orientation:portrait){.titleScene{height:146px}.titleHeroSprite{width:88px!important;transform:translateX(-50%) scale(1.26)!important}.titleLogo span{font-size:40px!important}.titleLogo strong{font-size:52px!important}.titleSystems{padding:4px!important}.titleOrbs{display:flex!important}}
'''
if 'RETRO_BALANCE_PASS_V2' not in css:
    css += retro
CSS.write_text(css)

# Lower fire/water art to 5 hard palette colors.
def nearest(c, palette):
    return min(palette, key=lambda p: sum((c[i] - p[i]) ** 2 for i in range(3)))

palettes = {
    'fire.png': [(15,7,7),(92,13,10),(190,39,20),(255,102,34),(255,218,92)],
    'water.png': [(4,9,20),(5,32,78),(11,79,155),(27,166,224),(218,249,255)],
}
orb_dir = Path('public/assets/pixel8/orbs')
for name, palette in palettes.items():
    p = orb_dir / name
    im = Image.open(p).convert('RGBA')
    out = []
    for r,g,b,a in im.getdata():
        if a < 12:
            out.append((0,0,0,0))
        else:
            nr,ng,nb = nearest((r,g,b), palette)
            out.append((nr,ng,nb,a))
    im.putdata(out)
    im.save(p, optimize=True)

# Existing generated Trickster silhouette is retained, but re-paletted to a limited 8-bit prism set.
trick = Path('public/assets/pixel8/trickster.png')
im = Image.open(trick).convert('RGBA')
w,h = im.size
accents = [(41,188,112),(38,157,199),(124,57,170),(225,58,86),(238,190,45)]
data = []
for y in range(h):
    for x in range(w):
        r,g,b,a = im.getpixel((x,y))
        if a < 12:
            data.append((0,0,0,0)); continue
        lum = .2126*r + .7152*g + .0722*b
        if lum < 42:
            data.append((8,8,10,a)); continue
        if lum > 220:
            data.append((244,235,201,a)); continue
        zone = min(4, int(x / max(1,w) * 5))
        if y < h * .38 and ((x//3 + y//3) % 3 == 0):
            zone = (zone + 1) % 5
        base = accents[zone]
        scale = .72 if lum < 110 else 1.0
        data.append((int(base[0]*scale), int(base[1]*scale), int(base[2]*scale), a))
im.putdata(data)
im.save(trick, optimize=True)
