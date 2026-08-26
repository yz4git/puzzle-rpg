from pathlib import Path

p = Path('app/PuzzleRPGGame.tsx')
s = p.read_text()

def rep(old: str, new: str, label: str):
    global s
    if old not in s:
        raise SystemExit(f'missing pattern: {label}')
    s = s.replace(old, new, 1)

rep('import styles from "./PuzzleRPGGame.module.css";', 'import styles from "./PuzzleRPGGame.module.css";\nimport { EnemySprite } from "./enemyAssets";\nimport { playSfx, primeAudio } from "./gameAudio";', 'imports')
rep('    setResolutionPhase("victory");\n    setCombatPop("STAGE CLEAR!");', '    playSfx("stageClear");\n    setResolutionPhase("victory");\n    setCombatPop("STAGE CLEAR!");', 'stage clear sound')
rep('    setBoard(nextBoard);\n    await delay(swapPair ? 205 : 120);', '    setBoard(nextBoard);\n    if (swapPair) playSfx("swap");\n    await delay(swapPair ? 205 : 120);', 'swap sound')
rep('      setResolutionPhase("clear");\n      await delay(175);', '      setResolutionPhase("clear");\n      playSfx(index === 0 ? "match" : "cascade");\n      await delay(175);', 'match sound')
rep('      setResolutionPhase("drop");\n      await delay(245);', '      setResolutionPhase("drop");\n      playSfx("drop");\n      await delay(245);', 'drop sound')
rep('    setPlayerHp(healedHp);\n    setPlayerShield(shieldBeforeEnemy);\n    setEnemyHp(enemyAfter);', '    setPlayerHp(healedHp);\n    setPlayerShield(shieldBeforeEnemy);\n    setEnemyHp(enemyAfter);\n    if (plan.heal > 0) playSfx("heal");\n    if (plan.shield > 0) playSfx("shield");', 'resource sounds')
rep('      setAttackSources(attackSourceList.slice(0, 10));\n      setResolutionPhase("attack");', '      setAttackSources(attackSourceList.slice(0, 10));\n      setResolutionPhase("attack");\n      playSfx(plateBlocks ? "block" : "playerAttack");', 'attack sound')
rep('    if (enemyAfter <= 0) {\n      setCombatPop("BREAK!");', '    if (enemyAfter <= 0) {\n      playSfx("enemyBreak");\n      setCombatPop("BREAK!");', 'break sound')
rep('    setDamageTaken(enemyResult.hpDamage);\n    setResolutionPhase("enemy");', '    setDamageTaken(enemyResult.hpDamage);\n    setResolutionPhase("enemy");\n    playSfx(enemyResult.hpDamage > 0 ? (effectiveIntent.kind === "pierce" ? "pierce" : "damage") : "block");', 'damage sound')
rep('    if (enemyResult.hpAfter <= 0) {\n      setGameOver(true);', '    if (enemyResult.hpAfter <= 0) {\n      playSfx("gameOver");\n      setGameOver(true);', 'game over sound')
rep('    if (!selected) {\n      setSelected(nextCoord);', '    if (!selected) {\n      playSfx("uiSelect");\n      setSelected(nextCoord);', 'select sound')
rep('      setSelected(null);\n      setMessage("選択解除', '      playSfx("uiSelect");\n      setSelected(null);\n      setMessage("選択解除', 'cancel sound')
rep('      setSelected(nextCoord);\n      setMessage("①選択を変更', '      playSfx("uiSelect");\n      setSelected(nextCoord);\n      setMessage("①選択を変更', 'change selection sound')
rep('    setSkillMode((value) => !value);', '    playSfx("uiConfirm");\n    setSkillMode((value) => !value);', 'skill mode sound')
rep('    const transformed = cloneBoard(board);', '    playSfx("skill");\n    const transformed = cloneBoard(board);', 'skill sound')
rep('  const enemyVisualClass = `${styles.enemyVisual} ${styles[`enemy_${enemy.kind}`] ?? ""} ${resolutionPhase === "attack" ? styles.enemyStruck : ""}`;', '  const enemyPixelClass = `${styles.enemyPixelSprite} ${resolutionPhase === "attack" ? styles.enemyPixelStruck : ""}`;', 'enemy class')
rep('''        <div className={enemyVisualClass} aria-hidden="true">\n          <span className={styles.enemyAura} />\n          <span className={styles.enemyWingLeft} />\n          <span className={styles.enemyWingRight} />\n          <span className={styles.enemyAccentLeft} />\n          <span className={styles.enemyAccentRight} />\n          <span className={styles.enemyCore}>{ENEMY_SIGIL[enemy.kind]}</span>\n          <span className={styles.enemyFace}><i /><i /></span>\n          <span className={styles.enemyWeapon} />\n          <span className={styles.enemyBase} />\n        </div>''', '        <EnemySprite kind={enemy.kind} className={enemyPixelClass} />', 'battle sprite')
rep('''          <div className={`${styles.introEnemyVisual} ${styles[`enemy_${enemy.kind}`] ?? ""}`} aria-hidden="true">\n            <span className={styles.enemyAura} /><span className={styles.enemyWingLeft} /><span className={styles.enemyWingRight} />\n            <span className={styles.enemyAccentLeft} /><span className={styles.enemyAccentRight} />\n            <span className={styles.enemyCore}>{ENEMY_SIGIL[enemy.kind]}</span><span className={styles.enemyFace}><i /><i /></span><span className={styles.enemyWeapon} /><span className={styles.enemyBase} />\n          </div>''', '          <EnemySprite kind={enemy.kind} className={styles.introPixelSprite} intro />', 'intro sprite')
rep('onClick={() => { setShowTitle(false); setStageIntro(true); setMessage("STAGE BRIEFING • 敵のルールを確認"); }}>START GAME', 'onClick={() => { primeAudio(); playSfx("uiConfirm"); setShowTitle(false); setStageIntro(true); setMessage("STAGE BRIEFING • 敵のルールを確認"); }}>START GAME', 'title audio')
rep('onClick={() => { setStageIntro(false); setMessage("BATTLE START • INTENTを読んで一手を選ぶ"); }}>BATTLE START', 'onClick={() => { primeAudio(); playSfx("uiConfirm"); setStageIntro(false); setMessage("BATTLE START • INTENTを読んで一手を選ぶ"); }}>BATTLE START', 'battle start audio')
p.write_text(s)

css = Path('app/PuzzleRPGGame.module.css')
c = css.read_text()
marker = '/* Replaceable 8-bit enemy sprite layer */'
if marker not in c:
    c += '''\n\n/* Replaceable 8-bit enemy sprite layer */\n.enemyPixelSprite { width:78px; height:78px; display:block; margin:auto; image-rendering:pixelated; image-rendering:crisp-edges; filter:drop-shadow(0 5px 0 rgba(0,0,0,.28)) drop-shadow(0 0 8px rgba(161,134,255,.34)); transform-origin:center bottom; }\n.enemyPixelStruck { animation:enemyPixelHit .28s steps(2,end); }\n@keyframes enemyPixelHit { 0%{transform:translateX(0);filter:brightness(1)} 34%{transform:translateX(7px);filter:brightness(2.8) contrast(1.4) drop-shadow(0 0 10px #fff)} 68%{transform:translateX(-4px)} 100%{transform:translateX(0)} }\n.introPixelSprite { position:relative; width:min(52vw,208px); height:min(52vw,208px); margin:18px 0 8px; image-rendering:pixelated; image-rendering:crisp-edges; filter:drop-shadow(0 10px 0 rgba(0,0,0,.28)) drop-shadow(0 0 18px rgba(155,127,255,.42)); animation:pixelIntro .42s steps(4,end) both; }\n@keyframes pixelIntro { from{opacity:0;transform:translateY(-10px) scale(.88)} to{opacity:1;transform:translateY(0) scale(1)} }\n@media (max-height:760px) and (orientation:portrait) { .enemyPixelSprite{width:58px;height:58px}.introPixelSprite{width:min(38vw,150px);height:min(38vw,150px);margin:8px 0 3px} }\n'''
css.write_text(c)
