from pathlib import Path

p = Path('app/PrismOverdrive.tsx')
s = p.read_text()

def rep(old: str, new: str):
    global s
    if old not in s:
        raise SystemExit('missing anchor: ' + old[:180])
    s = s.replace(old, new, 1)

rep(
'''  async function maybeOfferUpgrade(nextScore: number) {\n    const threshold = UPGRADE_THRESHOLDS[levelRef.current];''',
'''  async function maybeOfferUpgrade(nextScore: number) {\n    if (moves < 10) return;\n    const threshold = UPGRADE_THRESHOLDS[levelRef.current];'''
)

rep(
'''      <div className={styles.targetCard}><span>{beginner ? "YOUR TARGET" : "PRISM TARGET"}</span><strong>{target.label}</strong><em>{beginner ? "MATCH THIS FOR A BONUS" : `${targetProgressText(target)} • +${target.reward.toLocaleString()}`}</em></div>''',
'''      {!routeLesson ? <div className={styles.targetCard}><span>{beginner ? "YOUR TARGET" : "PRISM TARGET"}</span><strong>{target.label}</strong><em>{beginner ? "MATCH THIS FOR A BONUS" : `${targetProgressText(target)} • +${target.reward.toLocaleString()}`}</em></div> : null}'''
)

p.write_text(s)

p = Path('app/PrismOverdrive.module.css')
c = p.read_text()
c += '''\n\n/* PASS 55 — ONE CONCEPT AT A TIME */\n.strategyRouteLesson{grid-template-columns:1fr!important;min-height:52px!important}\n.strategyRouteLesson .scanCard{grid-column:1/-1!important;min-height:44px!important;display:grid!important;grid-template-columns:auto 1fr;grid-template-rows:auto auto;align-items:center;gap:2px 8px!important;padding:5px 8px!important}\n.strategyRouteLesson .scanCard>span{grid-column:1;grid-row:1/-1;font-size:7px!important;color:#8ee9ff!important}\n.strategyRouteLesson .scanCard>strong{grid-column:2;grid-row:1;font-size:11px!important}\n.strategyRouteLesson .scanCard>em{grid-column:2;grid-row:2;font-size:6px!important;white-space:normal!important;line-height:1.2!important}\n@media(max-height:700px){.strategyRouteLesson{min-height:43px!important}.strategyRouteLesson .scanCard{min-height:36px!important;padding:3px 6px!important}.strategyRouteLesson .scanCard>strong{font-size:9px!important}.strategyRouteLesson .scanCard>em{font-size:5px!important}}\n'''
p.write_text(c)
