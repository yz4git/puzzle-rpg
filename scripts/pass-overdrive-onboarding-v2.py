from pathlib import Path
p=Path('app/PrismOverdrive.tsx')
s=p.read_text()

def rep(old,new):
    global s
    if old not in s:
        raise SystemExit('missing anchor: '+old[:100])
    s=s.replace(old,new,1)

rep('  const [guideStep, setGuideStep] = useState(0);\n','')
rep('    setGuideStep(0); setShowHelp(false); setMoves(0);','    setShowHelp(false); setMoves(0);')
rep('    setMoves((value) => value + 1);\n    if (guideStep < 2) setGuideStep((value) => value + 1);','    setMoves((value) => value + 1);')
rep('  }, [screen]);','  }, [screen, showHelp]);')
rep('      if (current < timeStopUntilRef.current || resolvingRef.current) {','      if (current < timeStopUntilRef.current || resolvingRef.current || showHelp) {')

old='''  const beginner = moves < 6;
  const recommended = useMemo(() => {
    if (routePlan?.ids?.length) return new Set(routePlan.ids);
    const best = largestGroup(tiles);
    return new Set(best.map((tile) => tile.id));
  }, [tiles, routePlan]);
  const guideTitle = moves === 0 ? "① SAME COLOR → TAP" : moves < 3 ? "② BIG GROUP = BIG SCORE" : routePlan ? "③ GLOWING ROUTE = GOOD MOVE" : "③ TARGET IS YOUR NEXT GOAL";
  const guideText = moves === 0 ? "同じ色がつながった場所をタップ。まずはそれだけでOK。" : moves < 3 ? "つながりが大きいほど高得点。光っている候補を狙おう。" : routePlan ? "ROUTE表示を消すと、予告パネルがつながって連鎖しやすい。" : "上のTARGETを狙う。細かいゲージは慣れてからでOK。";'''
new='''  const beginner = moves < 6;
  const showBeginnerTarget = moves >= 2;
  const recommended = useMemo(() => {
    const wanted = moves >= 2 ? desiredTargetType(target) : null;
    if (wanted) {
      let best: Tile[] = [];
      const seen = new Set<number>();
      for (const tile of tiles) {
        if (tile.type !== wanted || seen.has(tile.id)) continue;
        const group = connectedGroup(tiles, tile);
        group.forEach((item) => seen.add(item.id));
        if (group.length > best.length) best = group;
      }
      if (best.length) return new Set(best.map((tile) => tile.id));
    }
    return new Set(largestGroup(tiles).map((tile) => tile.id));
  }, [tiles, moves, target]);
  const guideTitle = moves === 0 ? "STEP 1  TAP A GLOWING GROUP" : moves < 2 ? "STEP 2  MAKE BIG GROUPS" : moves < 6 ? "STEP 3  MATCH THE TARGET" : "ADVANCED SYSTEMS ONLINE";
  const guideText = moves === 0 ? "Connected tiles break together. Follow TAP." : moves < 2 ? "Bigger connected group = bigger score." : moves < 6 ? "Clear the TARGET shown below. Follow TAP when it helps." : "ROUTE sets up chains. CASH OUT saves banked score. Tap ? anytime.";'''
rep(old,new)

old='''      <div className={styles.introRules}>
        <b>遊び方は1つだけ</b>
        <strong>同じ色がつながった場所をタップ</strong>
        <span>大きくつなげて消すほど高得点！</span>
        <span>最初のプレイ中に順番に教えます</span>
      </div>'''
new='''      <div className={styles.introRules}>
        <b>ONE RULE TO START</b>
        <strong>TAP CONNECTED TILES</strong>
        <span>BIGGER GROUP = BIGGER SCORE</span>
        <span>THE GAME TEACHES THE REST</span>
      </div>'''
rep(old,new)

rep('''    <section className={styles.hypeRow}>
      <div className={styles.combo}><span>COMBO</span><strong>×{combo}</strong><em>MULTI ×{multiplier.toFixed(1)}</em><i><u style={{ width: `${clamp(comboWindowMs / Math.max(1, comboWindowMax) * 100, 0, 100)}%` }} /></i></div>
      <div className={styles.feverMeter}><span>{overFeverActive ? "OVER FEVER" : feverActive ? "PRISM FEVER" : "FEVER"}</span><strong>{Math.round(fever)}%</strong><i><u style={{ width: `${fever}%` }} /></i></div>
      <div className={styles.jackpot}><span>JACKPOT</span><strong>{"◆".repeat(jackpot)}{"◇".repeat(3 - jackpot)}</strong></div>
    </section>''','''    {!beginner ? <section className={styles.hypeRow}>
      <div className={styles.combo}><span>COMBO</span><strong>×{combo}</strong><em>MULTI ×{multiplier.toFixed(1)}</em><i><u style={{ width: `${clamp(comboWindowMs / Math.max(1, comboWindowMax) * 100, 0, 100)}%` }} /></i></div>
      <div className={styles.feverMeter}><span>{overFeverActive ? "OVER FEVER" : feverActive ? "PRISM FEVER" : "FEVER"}</span><strong>{Math.round(fever)}%</strong><i><u style={{ width: `${fever}%` }} /></i></div>
      <div className={styles.jackpot}><span>JACKPOT</span><strong>{"◆".repeat(jackpot)}{"◇".repeat(3 - jackpot)}</strong></div>
    </section> : null}''')
rep('<button type="button" onClick={() => setShowHelp(true)}>？</button>','<button type="button" aria-label="Help" onClick={() => { lastTickRef.current = performance.now(); setShowHelp(true); }}>?</button>')

rep('''    <section className={`${styles.strategyPanel} ${beginner ? styles.strategyBeginner : ""}`} data-target-pulse={targetPulse ? "true" : "false"} aria-label="Overdrive strategy panel">''','''    {(!beginner || showBeginnerTarget) ? <section className={`${styles.strategyPanel} ${beginner ? styles.strategyBeginner : ""}`} data-target-pulse={targetPulse ? "true" : "false"} aria-label="Overdrive strategy panel">''')
rep('''      <div className={styles.targetCard}><span>PRISM TARGET</span><strong>{target.label}</strong><em>{targetProgressText(target)} • +{target.reward.toLocaleString()}</em></div>''','''      <div className={styles.targetCard}><span>{beginner ? "YOUR TARGET" : "PRISM TARGET"}</span><strong>{target.label}</strong><em>{beginner ? "MATCH THIS FOR A BONUS" : `${targetProgressText(target)} • +${target.reward.toLocaleString()}`}</em></div>''')
rep('''</u></span>)}</div> : null}
    </section>''','''</u></span>)}</div> : null}
    </section> : null}''')

rep('''        <div className={styles.scanMarker} data-type={scanType} style={{ left: `${(scanColumn + .5) / SIZE * 100}%` }} aria-hidden="true"><b>▼</b><span>{GLYPH[scanType]}</span></div>''','''        {!beginner ? <div className={styles.scanMarker} data-type={scanType} style={{ left: `${(scanColumn + .5) / SIZE * 100}%` }} aria-hidden="true"><b>▼</b><span>{GLYPH[scanType]}</span></div> : null}''')
rep('${routeIds.has(tile.id) ? styles.routeReady : ""} ${beginner && recommended.has(tile.id) ? styles.recommended : ""}','${!beginner && routeIds.has(tile.id) ? styles.routeReady : ""} ${beginner && recommended.has(tile.id) ? styles.recommended : ""}')

old='''    {showHelp ? <div className={styles.helpOverlay} role="dialog" aria-label="Prism Overdrive help"><div><button type="button" onClick={() => setShowHelp(false)}>×</button><h2>遊び方</h2><p><b>1.</b> 同じ色がつながった場所をタップ</p><p><b>2.</b> 大きな塊ほど高得点</p><p><b>3.</b> TARGETを狙うとボーナス</p><p><b>4.</b> ROUTEが光ったら狙い目</p><p><b>5.</b> CASH OUTでBANK得点を安全に確定</p><small>CHARGEやBOSS COREはプレイしているうちに自然に使えます。最初から覚える必要はありません。</small></div></div> : null}'''
new='''    {showHelp ? <div className={styles.helpOverlay} role="dialog" aria-label="Prism Overdrive help"><div><button type="button" aria-label="Close help" onClick={() => { lastTickRef.current = performance.now(); setShowHelp(false); }}>X</button><h2>HOW TO PLAY</h2><p><b>1.</b> TAP CONNECTED TILES</p><p><b>2.</b> BIGGER GROUP = BIGGER SCORE</p><p><b>3.</b> MATCH TARGET = BONUS</p><p><b>4.</b> ROUTE = GOOD CHAIN SETUP</p><p><b>5.</b> CASH OUT = SAVE BANKED SCORE</p><small>Ignore CHARGE and BOSS CORE at first. The game will introduce them naturally.</small></div></div> : null}'''
rep(old,new)

old='''      {actionFx ? <div key={actionFx.token} className={styles.actionFx} data-kind={actionFx.kind} role="status">
        <i>{actionFx.icon}</i><strong>{actionFx.title}</strong><span>{actionFx.detail}</span>
      </div> : <div className={styles.actionIdle}><b>{routePlan ? "ROUTE READY" : "PLAN THE BREAK"}</b><span>{routePlan ? `HIGHLIGHTED BREAK → SCANNED ${LABEL[routePlan.type]} ×${routePlan.projected}` : "CHARGE → TARGET ×3 → BOSS CORE → CASH OUT OR PUSH"}</span></div>}'''
new='''      {actionFx ? <div key={actionFx.token} className={styles.actionFx} data-kind={actionFx.kind} role="status">
        <i>{actionFx.icon}</i><strong>{actionFx.title}</strong><span>{actionFx.detail}</span>
      </div> : beginner ? <div className={styles.actionIdle}><b>FOLLOW TAP</b><span>CONNECTED TILES BREAK TOGETHER</span></div> : <div className={styles.actionIdle}><b>{routePlan ? "ROUTE READY" : "PLAN THE BREAK"}</b><span>{routePlan ? `HIGHLIGHTED BREAK → SCANNED ${LABEL[routePlan.type]} ×${routePlan.projected}` : "CHARGE → TARGET ×3 → BOSS CORE → CASH OUT OR PUSH"}</span></div>}'''
rep(old,new)

rep('''    <section className={styles.runInfo}>
      <span>BIGGEST <b>×{largest}</b></span><span>LEVEL <b>{runLevel}</b></span><span>BEST COMBO <b>×{maxCombo}</b></span>
    </section>
    <div className={styles.message} role="status">{message}</div>
    <div className={styles.build}>{upgrades.map((id) => <i key={id}>{UPGRADES.find((upgrade) => upgrade.id === id)?.name}</i>)}</div>''','''    {!beginner ? <>
      <section className={styles.runInfo}>
        <span>BIGGEST <b>×{largest}</b></span><span>LEVEL <b>{runLevel}</b></span><span>BEST COMBO <b>×{maxCombo}</b></span>
      </section>
      <div className={styles.message} role="status">{message}</div>
      <div className={styles.build}>{upgrades.map((id) => <i key={id}>{UPGRADES.find((upgrade) => upgrade.id === id)?.name}</i>)}</div>
    </> : null}''')

rep('<em>{comboBank > 0 ? "得点を確定 / COMBO終了" : "COMBOでBANKがたまる"}</em>','<em>{comboBank > 0 ? "SAVE SCORE / END COMBO" : "COMBO BUILDS THE BANK"}</em>')
rep('<em>{bossCoreHp > 0 ? "CHARGE / ROUTE / CHAINで攻撃" : "TARGETを3回連続達成"}</em>','<em>{bossCoreHp > 0 ? "HIT WITH RELEASE / ROUTE / CHAIN" : "CLEAR 3 TARGETS IN ONE COMBO"}</em>')

p.write_text(s)

p=Path('app/PrismOverdrive.module.css')
c=p.read_text()+'''\n\n/* PASS 50 — BEGINNER FOCUS / FONT-SAFE ONBOARDING */\n.guideBar{min-height:48px!important}.guideBar strong{font-size:10px!important;letter-spacing:.04em}.guideBar span{font-size:7px!important}.guideBar button{font-size:18px!important}\n.strategyBeginner{min-height:44px!important}.strategyBeginner .targetCard{min-height:38px!important}.strategyBeginner .targetCard strong{font-size:11px!important}.strategyBeginner .targetCard em{font-size:6px!important}\n.recommended::after{content:"TAP"!important;font-size:6px!important;padding:2px 3px!important}.helpOverlay h2{font-size:17px!important;letter-spacing:.06em}.helpOverlay p{font-size:9px!important}.helpOverlay small{font-size:7px!important}\n@media(max-height:700px){.guideBar{min-height:39px!important}.guideBar strong{font-size:8px!important}.guideBar span{font-size:5px!important}.strategyBeginner{min-height:34px!important}}\n'''
p.write_text(c)
