from pathlib import Path

p = Path('app/PrismOverdrive.tsx')
s = p.read_text()

def rep(old: str, new: str):
    global s
    if old not in s:
        raise SystemExit('missing anchor: ' + old[:180])
    s = s.replace(old, new, 1)

rep(
'''  const guideTitle = moves === 0 ? "STEP 1  TAP A GLOWING GROUP" : moves < 2 ? "STEP 2  MAKE BIG GROUPS" : moves < 6 ? "STEP 3  MATCH THE TARGET" : moves < 10 ? "STEP 4  USE ROUTE" : learnedRun ? "PRISM OVERDRIVE" : "FULL SYSTEMS ONLINE";\n  const guideText = moves === 0 ? "Connected tiles break together. Follow TAP." : moves < 2 ? "Bigger connected group = bigger score." : moves < 6 ? "Clear the simple TARGET below. Follow TAP when it helps." : moves < 10 ? "ROUTE marks a move that sets up the scanned next tile." : learnedRun ? "TARGET • ROUTE • CASH OUT • BOSS CORE" : "CASH OUT saves score. Three TARGETS summon BOSS CORE. Tap ? anytime.";''',
'''  const routeLessonReady = routeLesson && Boolean(routePlan);\n  const guideTitle = moves === 0 ? "STEP 1  TAP A GLOWING GROUP" : moves < 2 ? "STEP 2  MAKE BIG GROUPS" : moves < 6 ? "STEP 3  MATCH THE TARGET" : moves < 10 ? (routeLessonReady ? "STEP 4  TAP THE ROUTE" : "STEP 4  SHAPE THE SCAN") : learnedRun ? "PRISM OVERDRIVE" : "FULL SYSTEMS ONLINE";\n  const guideText = moves === 0 ? "Connected tiles break together. Follow the arrow." : moves < 2 ? "Bigger connected group = bigger score." : moves < 6 ? "Clear the simple TARGET below. Follow the arrow when it helps." : moves < 10 ? (routeLessonReady ? "The glowing ROUTE sets up the scanned next tile. Tap it now." : `Column ${scanColumn + 1} is scanned. Clear one connected group in that lane.`) : learnedRun ? "TARGET • ROUTE • CASH OUT • BOSS CORE" : "CASH OUT saves score. Three TARGETS summon BOSS CORE. Tap ? anytime.";'''
)

rep(
'''      {moves >= 6 ? <div className={styles.scanCard} data-route={routePlan ? "ready" : "none"}><span>NEXT SCAN • COL {scanColumn + 1}</span><strong data-type={scanType}>{GLYPH[scanType]} {LABEL[scanType]}</strong><em>{routePlan ? `ROUTE READY → ${LABEL[routePlan.type]} ×${routePlan.projected}` : "NO ROUTE • SHAPE THE COLUMN"}</em></div> : null}''',
'''      {moves >= 6 ? <div className={styles.scanCard} data-route={routePlan ? "ready" : "none"}><span>{routeLesson ? `SCANNED COLUMN ${scanColumn + 1}` : `NEXT SCAN • COL ${scanColumn + 1}`}</span><strong data-type={scanType}>{GLYPH[scanType]} {LABEL[scanType]}</strong><em>{routePlan ? (routeLesson ? `ROUTE READY • TAP GLOWING GROUP` : `ROUTE READY → ${LABEL[routePlan.type]} ×${routePlan.projected}`) : (routeLesson ? "CLEAR 1 GROUP IN THIS LANE" : "NO ROUTE • SHAPE THE COLUMN")}</em></div> : null}'''
)

rep(
'''        {moves >= 6 ? <div className={styles.scanMarker} data-type={scanType} style={{ left: `${(scanColumn + .5) / SIZE * 100}%` }} aria-hidden="true"><b>▼</b><span>{GLYPH[scanType]}</span></div> : null}''',
'''        {routeLesson ? <div className={styles.scanLane} data-ready={routeLessonReady ? "true" : "false"} style={{ left: `${scanColumn / SIZE * 100}%`, width: `${100 / SIZE}%` }} aria-hidden="true"><span>{routeLessonReady ? "ROUTE" : "SCAN"}</span></div> : null}\n        {moves >= 6 ? <div className={styles.scanMarker} data-type={scanType} style={{ left: `${(scanColumn + .5) / SIZE * 100}%` }} aria-hidden="true"><b>▼</b><span>{GLYPH[scanType]}</span></div> : null}'''
)

p.write_text(s)

p = Path('app/PrismOverdrive.module.css')
c = p.read_text()
c += '''\n\n/* PASS 54 — ROUTE LESSON STATE CLARITY */\n.scanLane{position:absolute;z-index:2;top:0;bottom:0;pointer-events:none;box-sizing:border-box;border-inline:2px dashed rgba(99,232,255,.78);background:linear-gradient(180deg,rgba(99,232,255,.12),rgba(99,232,255,.025) 42%,rgba(99,232,255,.09));box-shadow:inset 5px 0 8px rgba(99,232,255,.05),inset -5px 0 8px rgba(99,232,255,.05);animation:scanLanePulse 780ms steps(2,end) infinite}\n.scanLane span{position:absolute;left:50%;top:21px;transform:translateX(-50%);padding:2px 3px;border:1px solid #62eaff;background:#03121a;color:#8af6ff;font:1000 5px/1 monospace;letter-spacing:.08em;box-shadow:2px 2px #000}\n.scanLane[data-ready="true"]{border-color:#62ffd6;background:linear-gradient(180deg,rgba(98,255,214,.14),rgba(98,255,214,.025) 42%,rgba(98,255,214,.1));box-shadow:inset 5px 0 8px rgba(98,255,214,.06),inset -5px 0 8px rgba(98,255,214,.06),0 0 8px rgba(98,255,214,.24)}\n.scanLane[data-ready="true"] span{border-color:#62ffd6;color:#9affdf;background:#03150f}\n.strategyRouteLesson .scanCard[data-route="none"]{border-color:#4d8aa4!important;background:#041018!important;box-shadow:inset 0 0 0 1px #102f3d}\n.strategyRouteLesson .scanCard[data-route="none"] em{color:#8ee9ff!important;font-weight:900}\n.strategyRouteLesson .scanCard[data-route="ready"] em{color:#9affdf!important;font-weight:1000}\n@keyframes scanLanePulse{50%{border-inline-width:3px;filter:brightness(1.25)}}\n@media(max-height:700px){.scanLane span{top:18px;font-size:4px}}\n@media(prefers-reduced-motion:reduce){.scanLane{animation:none!important}}\n'''
p.write_text(c)
