from pathlib import Path

TSX = Path('app/rpg/RPGPuzzleBattle.tsx')
CSS = Path('app/rpg/RPGPuzzleBattle.module.css')

text = TSX.read_text()
old = '''      <section className={styles.enemyRow}>\n        <span className={styles.enemySprite} role="img" aria-label={enemy.name} style={enemySpriteStyle} />\n        {skipDisplayValue !== null ? <div className={styles.skipEnemyOverlay} data-phase={skipFx?.phase ?? "armed"} data-zero={skipDisplayValue === 0 ? "true" : "false"} aria-label={`Enemy time stop ${skipDisplayValue}`}>\n          <i className={styles.stopwatchFace} aria-hidden="true" /><strong>{skipDisplayValue}</strong><span>{skipDisplayValue === 0 ? "TIME UP" : "TIME STOP"}</span>\n        </div> : null}\n        <div><strong>{effectiveEnemy.name}</strong><i><u style={{ width: `${Math.max(0, enemyHp / effectiveEnemy.hp) * 100}%` }} /></i><span>HP {enemyHp}/{effectiveEnemy.hp}</span><small>{enemy.trait}</small></div>\n      </section>'''
new = '''      <section className={styles.enemyRow}>\n        <div className={styles.enemyVisual}>\n          <span className={styles.enemySprite} role="img" aria-label={enemy.name} style={enemySpriteStyle} />\n          {skipDisplayValue !== null ? <div className={styles.skipEnemyOverlay} data-phase={skipFx?.phase ?? "armed"} data-zero={skipDisplayValue === 0 ? "true" : "false"} aria-label={`Enemy time stop ${skipDisplayValue}`}>\n            <i className={styles.stopwatchFace} aria-hidden="true" /><strong>{skipDisplayValue}</strong><span>{skipDisplayValue === 0 ? "TIME UP" : "TIME STOP"}</span>\n          </div> : null}\n        </div>\n        <div className={styles.enemyInfo}><strong>{effectiveEnemy.name}</strong><i><u style={{ width: `${Math.max(0, enemyHp / effectiveEnemy.hp) * 100}%` }} /></i><span>HP {enemyHp}/{effectiveEnemy.hp}</span><small>{enemy.trait}</small></div>\n      </section>'''
if old not in text:
    raise SystemExit('enemyRow JSX target not found')
TSX.write_text(text.replace(old, new, 1))

css = CSS.read_text()
css = css.replace('.enemyRow{min-height:82px;display:grid;grid-template-columns:105px 1fr;', '.enemyRow{min-height:82px;display:grid;grid-template-columns:112px 1fr;', 1)
css = css.replace('.enemySprite{display:block;width:102px;height:78px;align-self:end;', '.enemyVisual{position:relative;width:108px;height:78px;align-self:end;justify-self:start;overflow:visible;isolation:isolate}.enemySprite{position:absolute;z-index:1;left:0;bottom:0;display:block;width:102px;height:78px;align-self:end;', 1)
css = css.replace('.enemyRow>div{min-width:0;display:grid;gap:2px;padding:4px 5px;background:rgba(5,5,10,.72);border:1px solid rgba(255,255,255,.22)}.enemyRow strong{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.enemyRow i,.statusRow i{display:block;height:6px;border:1px solid #8a8993;background:#16161d;overflow:hidden}.enemyRow u,.statusRow u{display:block;height:100%;background:#df3045;text-decoration:none}.enemyRow span{justify-self:end;font-size:7px}.enemyRow small{font-size:6px;line-height:1.15;color:#c8c7ca}', '.enemyInfo{min-width:0;display:grid;gap:2px;padding:4px 5px;background:rgba(5,5,10,.72);border:1px solid rgba(255,255,255,.22)}.enemyInfo>strong{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.enemyInfo>i,.statusRow i{display:block;height:6px;border:1px solid #8a8993;background:#16161d;overflow:hidden}.enemyInfo>i u,.statusRow u{display:block;height:100%;background:#df3045;text-decoration:none}.enemyInfo>span{justify-self:end;font-size:7px}.enemyInfo>small{font-size:6px;line-height:1.15;color:#c8c7ca}', 1)

old_overlay = '.skipEnemyOverlay{position:absolute;z-index:8;left:4px;top:2px;width:112px;height:76px;display:grid;place-items:center;pointer-events:none;filter:drop-shadow(3px 4px 0 #000)}'
new_overlay = '.skipEnemyOverlay{position:absolute;z-index:6;left:50%;top:50%;width:100px;height:74px;display:grid;place-items:center;transform:translate(-50%,-50%);pointer-events:none;filter:drop-shadow(3px 4px 0 #000);overflow:visible}'
if old_overlay not in css:
    raise SystemExit('skip overlay css target not found')
css = css.replace(old_overlay, new_overlay, 1)
css = css.replace('.stopwatchFace{position:absolute;left:18px;top:10px;width:57px;height:57px;', '.stopwatchFace{position:absolute;left:50%;top:5px;width:57px;height:57px;transform:translateX(-50%);', 1)
css = css.replace('.skipEnemyOverlay>strong{position:absolute;z-index:2;left:46px;top:28px;min-width:31px;', '.skipEnemyOverlay>strong{position:absolute;z-index:8;left:50%;top:24px;min-width:31px;transform:translateX(-50%);', 1)
css = css.replace('.skipEnemyOverlay>span{position:absolute;z-index:3;left:2px;right:2px;bottom:0;', '.skipEnemyOverlay>span{position:absolute;z-index:9;left:3px;right:3px;bottom:0;', 1)
css = css.replace('@keyframes stopwatchTick{0%{filter:drop-shadow(3px 4px 0 #000) brightness(1)}18%{transform:translateX(-3px);', '@keyframes stopwatchTick{0%{filter:drop-shadow(3px 4px 0 #000) brightness(1)}18%{transform:translate(-50%,-50%) translateX(-3px);', 1)
css = css.replace('36%{transform:translateX(3px)}54%{transform:translateX(-2px)}72%{transform:translateX(1px)}100%{transform:none;', '36%{transform:translate(-50%,-50%) translateX(3px)}54%{transform:translate(-50%,-50%) translateX(-2px)}72%{transform:translate(-50%,-50%) translateX(1px)}100%{transform:translate(-50%,-50%);', 1)
css = css.replace('@media(max-height:700px){.skipEnemyOverlay{transform:scale(.9);transform-origin:left top}', '@media(max-height:700px){.skipEnemyOverlay{width:92px;height:70px;transform:translate(-50%,-50%) scale(.9);transform-origin:center center}', 1)

# Make sure the clock is never clipped by generic enemy-row styling.
css += '''\n\n/* Enemy stopwatch overlay fix — isolate the clock from enemy info selectors. */\n.enemyVisual .skipEnemyOverlay{box-sizing:border-box;background:transparent;border:0;padding:0;min-width:0;min-height:0}\n.enemyVisual .stopwatchFace{display:block;overflow:visible;box-sizing:border-box}\n.enemyVisual .skipEnemyOverlay>strong,.enemyVisual .skipEnemyOverlay>span{justify-self:auto;overflow:visible}\n'''
CSS.write_text(css)

progress = Path('PROGRESS.md')
progress.write_text(progress.read_text() + '''\n\n## Enemy stopwatch overlay hotfix\n- Moved enemy sprite and TIME STOP overlay into a dedicated `enemyVisual` layer.\n- Scoped HP/name panel selectors to `enemyInfo`, preventing enemy-row generic `div/i/span/strong` rules from corrupting the stopwatch.\n- Centered the stopwatch directly over the enemy sprite with an explicit z-index and non-clipped face/number/label layers.\n- Preserved SKIP/FREE timing and battle balance.\n''')
