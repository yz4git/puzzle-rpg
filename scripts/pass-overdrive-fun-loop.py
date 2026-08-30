from pathlib import Path
p=Path('app/PrismOverdrive.tsx')
s=p.read_text()
def rep(old,new):
 global s
 if old not in s: raise SystemExit('missing anchor: '+old[:120])
 s=s.replace(old,new,1)
rep('const ONBOARDING_KEY = "puzzle-rpg:prism-overdrive:onboarding:v1";','const ONBOARDING_KEY = "puzzle-rpg:prism-overdrive:onboarding:v1";\nconst MOMENTUM_GOAL = 3;')
rep('  const [tutorialSeen, setTutorialSeen] = useState(false);','  const [tutorialSeen, setTutorialSeen] = useState(false);\n  const [momentum, setMomentum] = useState(0);\n  const [surgeReady, setSurgeReady] = useState(false);')
rep('  const bossBreaksRef = useRef(0);','  const bossBreaksRef = useRef(0);\n  const momentumRef = useRef(0);\n  const surgeReadyRef = useRef(false);')
rep('''  function addBank(points: number, comboValue: number, chainDepth = 0) {''','''  function addMomentum(amount = 1) {
    if (surgeReadyRef.current) return;
    const next = Math.min(MOMENTUM_GOAL, momentumRef.current + amount);
    momentumRef.current = next;
    setMomentum(next);
    if (next >= MOMENTUM_GOAL) {
      surgeReadyRef.current = true;
      setSurgeReady(true);
      setLastRank("PRISM SURGE READY!");
      setMessage("NEXT BIG BREAK GETS ×2 • BUILD ×5+");
      playOverdriveSfx("target", 1.16);
    }
  }

  function consumeSurge(count: number) {
    if (!surgeReadyRef.current || count < 5) return 1;
    surgeReadyRef.current = false;
    setSurgeReady(false);
    momentumRef.current = 0;
    setMomentum(0);
    setLastRank("PRISM SURGE ×2!");
    setMessage("SURGE RELEASE • BIG BREAK DOUBLED");
    playOverdriveSfx("mega", 1.38);
    return 2;
  }

  function addBank(points: number, comboValue: number, chainDepth = 0) {''')
rep('''    setBossBreaks(0); bossBreaksRef.current = 0;
    setShowHelp(false); setMoves(tutorialSeen ? 10 : 0);''','''    setBossBreaks(0); bossBreaksRef.current = 0;
    setMomentum(0); momentumRef.current = 0; setSurgeReady(false); surgeReadyRef.current = false;
    setShowHelp(false); setMoves(tutorialSeen ? 10 : 0);''')
rep('''    const scored = scoreCluster(liveSeed.type, removed.size, 0, chargeMove.multiplier);
    let nextScore = addScore(scored.points, scored.rank);''','''    const surgeMult = consumeSurge(count);
    const scored = scoreCluster(liveSeed.type, removed.size, 0, chargeMove.multiplier * surgeMult);
    let nextScore = addScore(scored.points, surgeMult > 1 ? "PRISM SURGE ×2!" : scored.rank);''')
rep('''    advanceManualTarget(liveSeed.type, count);
    nextScore = scoreRef.current;''','''    advanceManualTarget(liveSeed.type, count);
    if (count >= 6) addMomentum(1);
    nextScore = scoreRef.current;''')
rep('''        damageBossCore("PLANNED ROUTE");
        playOverdriveSfx("route", 1.04 + actual * .035);''','''        damageBossCore("PLANNED ROUTE");
        addMomentum(1);
        playOverdriveSfx("route", 1.04 + actual * .035);''')
rep('''      if (depth >= 2) damageBossCore(`CHAIN ${depth}`);
      nextScore = scoreRef.current;''','''      if (depth >= 2) damageBossCore(`CHAIN ${depth}`);
      addMomentum(depth >= 2 ? 2 : 1);
      nextScore = scoreRef.current;''')
rep('''      {fullSystems ? <div className={styles.chargeRow} aria-label="Prism charge meters">{TYPES.map((type) => <span key={type} className={styles.chargeItem} data-type={type} data-value={charge[type]}><i>{GLYPH[type]}</i><b>{charge[type]}</b><u><em style={{ width: `${charge[type]}%` }} /></u></span>)}</div> : null}
    </section> : null}''','''      {fullSystems ? <div className={styles.chargeRow} aria-label="Prism charge meters">{TYPES.map((type) => <span key={type} className={styles.chargeItem} data-type={type} data-value={charge[type]}><i>{GLYPH[type]}</i><b>{charge[type]}</b><u><em style={{ width: `${charge[type]}%` }} /></u></span>)}</div> : null}
      {fullSystems ? <div className={styles.momentumCard} data-ready={surgeReady ? "true" : "false"}><span>PRISM SURGE</span><strong>{surgeReady ? "READY ×2" : `${"◆".repeat(momentum)}${"◇".repeat(MOMENTUM_GOAL-momentum)} ${momentum}/${MOMENTUM_GOAL}`}</strong><em>{surgeReady ? "NEXT ×5+ BREAK DOUBLES" : "BIG BREAK / ROUTE / CHAIN FILLS"}</em></div> : null}
    </section> : null}''')
rep('''      {actionFx ? <div key={actionFx.token} className={styles.actionFx} data-kind={actionFx.kind} role="status">''','''      {surgeReady && !actionFx ? <div className={styles.surgePrompt}><b>PRISM SURGE READY</b><span>MAKE ANY ×5+ GROUP • NEXT BIG BREAK ×2</span></div> : actionFx ? <div key={actionFx.token} className={styles.actionFx} data-kind={actionFx.kind} role="status">''')
p.write_text(s)
p=Path('app/PrismOverdrive.module.css')
c=p.read_text()+'''\n\n/* PASS 57 — PRISM SURGE / SHORT-TERM PAYOFF LOOP */\n.momentumCard{grid-column:1/-1;min-height:34px;padding:4px 7px;border:2px solid #56446f;background:#090818;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:7px;box-sizing:border-box}.momentumCard span{font-size:6px;color:#a99ac7}.momentumCard strong{justify-self:center;color:#fff36d;font-size:10px;letter-spacing:.08em}.momentumCard em{font-size:5px;font-style:normal;color:#8fa4bf;text-align:right}.momentumCard[data-ready="true"]{border-color:#fff36d;background:#17110b;box-shadow:inset 0 0 0 2px #8c4fff,0 0 12px rgba(255,243,109,.48);animation:surgeReadyPulse 620ms steps(2,end) infinite}.momentumCard[data-ready="true"] strong{color:#fff;font-size:12px;text-shadow:2px 2px #8c35ff}.surgePrompt{height:100%;display:grid;place-content:center;text-align:center;gap:4px;border:2px solid #fff36d;background:#120d19;box-sizing:border-box;box-shadow:inset 0 0 0 2px #7e35d7}.surgePrompt b{font-size:11px;color:#fff36d;text-shadow:2px 2px #5f20a2}.surgePrompt span{font-size:6px;color:#fff}.shell:has(.momentumCard[data-ready="true"]) .board{box-shadow:0 0 0 2px #000,inset 0 0 0 2px #fff36d,0 0 24px rgba(255,243,109,.42)}@keyframes surgeReadyPulse{50%{filter:brightness(1.3)}}@media(max-height:700px){.momentumCard{min-height:28px}.momentumCard strong{font-size:8px}.momentumCard em{font-size:4px}}@media(prefers-reduced-motion:reduce){.momentumCard[data-ready="true"]{animation:none!important}}\n'''
p.write_text(c)
