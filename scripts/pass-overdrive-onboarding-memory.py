from pathlib import Path
p=Path('app/PrismOverdrive.tsx')
s=p.read_text()
def rep(old,new):
    global s
    if old not in s:
        raise SystemExit('missing anchor: '+old[:140])
    s=s.replace(old,new,1)
rep('const HIGH_SCORE_KEY = "puzzle-rpg:prism-overdrive:high-score:v1";','const HIGH_SCORE_KEY = "puzzle-rpg:prism-overdrive:high-score:v1";\nconst ONBOARDING_KEY = "puzzle-rpg:prism-overdrive:onboarding:v1";')
rep('  const [showHelp, setShowHelp] = useState(false);\n  const [moves, setMoves] = useState(0);','  const [showHelp, setShowHelp] = useState(false);\n  const [moves, setMoves] = useState(0);\n  const [tutorialSeen, setTutorialSeen] = useState(false);')
rep('''  useEffect(() => {
    const stored = Number(window.localStorage.getItem(HIGH_SCORE_KEY) ?? 0);
    if (Number.isFinite(stored)) setHighScore(Math.max(0, stored));
  }, []);''','''  useEffect(() => {
    const stored = Number(window.localStorage.getItem(HIGH_SCORE_KEY) ?? 0);
    if (Number.isFinite(stored)) setHighScore(Math.max(0, stored));
    try { setTutorialSeen(window.localStorage.getItem(ONBOARDING_KEY) === "1"); } catch { /* ignore */ }
  }, []);''')
rep('    setShowHelp(false); setMoves(0);','    setShowHelp(false); setMoves(tutorialSeen ? 10 : 0);')
rep('''    if (finalScore > highScore) {
      setHighScore(finalScore);
      try { window.localStorage.setItem(HIGH_SCORE_KEY, String(finalScore)); } catch { /* ignore */ }
    }
  }''','''    if (finalScore > highScore) {
      setHighScore(finalScore);
      try { window.localStorage.setItem(HIGH_SCORE_KEY, String(finalScore)); } catch { /* ignore */ }
    }
    if (!tutorialSeen && moves >= 10) {
      setTutorialSeen(true);
      try { window.localStorage.setItem(ONBOARDING_KEY, "1"); } catch { /* ignore */ }
    }
  }''')
rep('''  const fullSystems = moves >= 10;
  const showBeginnerTarget = moves >= 2;''','''  const fullSystems = moves >= 10;
  const learnedRun = tutorialSeen && fullSystems;
  const showBeginnerTarget = moves >= 2;''')
rep('''  const guideTitle = moves === 0 ? "STEP 1  TAP A GLOWING GROUP" : moves < 2 ? "STEP 2  MAKE BIG GROUPS" : moves < 6 ? "STEP 3  MATCH THE TARGET" : moves < 10 ? "STEP 4  USE ROUTE" : "FULL SYSTEMS ONLINE";
  const guideText = moves === 0 ? "Connected tiles break together. Follow TAP." : moves < 2 ? "Bigger connected group = bigger score." : moves < 6 ? "Clear the simple TARGET below. Follow TAP when it helps." : moves < 10 ? "ROUTE marks a move that sets up the scanned next tile." : "CASH OUT saves score. Three TARGETS summon BOSS CORE. Tap ? anytime.";''','''  const guideTitle = moves === 0 ? "STEP 1  TAP A GLOWING GROUP" : moves < 2 ? "STEP 2  MAKE BIG GROUPS" : moves < 6 ? "STEP 3  MATCH THE TARGET" : moves < 10 ? "STEP 4  USE ROUTE" : learnedRun ? "PRISM OVERDRIVE" : "FULL SYSTEMS ONLINE";
  const guideText = moves === 0 ? "Connected tiles break together. Follow TAP." : moves < 2 ? "Bigger connected group = bigger score." : moves < 6 ? "Clear the simple TARGET below. Follow TAP when it helps." : moves < 10 ? "ROUTE marks a move that sets up the scanned next tile." : learnedRun ? "TARGET • ROUTE • CASH OUT • BOSS CORE" : "CASH OUT saves score. Three TARGETS summon BOSS CORE. Tap ? anytime.";''')
rep('<section className={styles.guideBar} data-done={beginner ? "false" : "true"}>','<section className={styles.guideBar} data-done={beginner ? "false" : "true"} data-learned={learnedRun ? "true" : "false"}>')
rep('''      </div> : beginner ? <div className={styles.actionIdle}><b>FOLLOW TAP</b><span>CONNECTED TILES BREAK TOGETHER</span></div> : <div className={styles.actionIdle}><b>{routePlan ? "ROUTE READY" : "PLAN THE BREAK"}</b><span>{routePlan ? `HIGHLIGHTED BREAK → SCANNED ${LABEL[routePlan.type]} ×${routePlan.projected}` : "CHARGE → TARGET ×3 → BOSS CORE → CASH OUT OR PUSH"}</span></div>}''','''      </div> : beginner ? <div className={styles.actionIdle}><b>FOLLOW TAP</b><span>CONNECTED TILES BREAK TOGETHER</span></div> : routeLesson ? <div className={styles.actionIdle}><b>{routePlan ? "ROUTE READY" : "MAKE A ROUTE"}</b><span>{routePlan ? "CLEAR THE HIGHLIGHTED GROUP" : "CLEAR A GROUP IN THE SCANNED COLUMN"}</span></div> : <div className={styles.actionIdle}><b>{routePlan ? "ROUTE READY" : "PLAN THE BREAK"}</b><span>{routePlan ? `HIGHLIGHTED BREAK → SCANNED ${LABEL[routePlan.type]} ×${routePlan.projected}` : "CHARGE → TARGET ×3 → BOSS CORE → CASH OUT OR PUSH"}</span></div>}''')
p.write_text(s)

p=Path('app/PrismOverdrive.module.css')
c=p.read_text()
marker='PASS 53 — ONE-TIME ONBOARDING / VETERAN FLOW'
if marker not in c:
    c += '''\n\n/* PASS 53 — ONE-TIME ONBOARDING / VETERAN FLOW */\n.guideBar[data-learned="true"]{min-height:30px!important;padding-block:3px!important;border-color:#344b61!important;background:#040a11!important}.guideBar[data-learned="true"] strong{font-size:7px!important;color:#75f6ff!important}.guideBar[data-learned="true"] span{font-size:5px!important;color:#8297ac!important}.guideBar[data-learned="true"] button{width:26px!important;height:26px!important;font-size:14px!important}.strategyRouteLesson+.boardWrap{}\n@media(max-height:700px){.guideBar[data-learned="true"]{min-height:26px!important}.guideBar[data-learned="true"] button{width:23px!important;height:23px!important}}\n'''
p.write_text(c)
