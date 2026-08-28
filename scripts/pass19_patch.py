from pathlib import Path

tsx_path = Path("app/rpg/RPGPuzzleBattle.tsx")
css_path = Path("app/rpg/RPGPuzzleBattle.module.css")
progress_path = Path("PROGRESS.md")

tsx = tsx_path.read_text()
old = '    }), 360);\n'
new = '    }), outcome === "release" ? 620 : outcome === "victory" ? 480 : outcome === "defeat" ? 420 : 360);\n'
if old not in tsx:
    raise SystemExit("finish-delay anchor missing")
tsx = tsx.replace(old, new, 1)
tsx_path.write_text(tsx)

css = css_path.read_text()
marker = "/* SFC visual reconstruction pass 19 — encounter resolution transitions */"
if marker in css:
    raise SystemExit("pass 19 CSS already present")
css += r'''

/* SFC visual reconstruction pass 19 — encounter resolution transitions */
.battle::after{content:"";position:fixed;z-index:280;inset:0;pointer-events:none;background:#05060b;opacity:0;animation:battleGateOpen 420ms steps(6,end) both}.battle{animation:battleSceneResolveIn 420ms steps(6,end) both}
.battle:has(.enemyRow i u[style*="width: 0%"]){animation:victoryResolve 480ms steps(6,end) both}.battle:has(.enemyRow i u[style*="width: 0%"])::after{background:repeating-linear-gradient(0deg,rgba(255,247,197,.9) 0 3px,rgba(255,175,64,.5) 3px 6px,transparent 6px 12px);animation:victoryGate 480ms steps(6,end) both}.battle:has(.enemyRow i u[style*="width: 0%"] ) .enemyRow{animation:enemyResolveBreak 480ms steps(6,end) both}
.battle:has(.statusRow>div:first-child i u[style*="width: 0%"]){animation:defeatResolve 420ms steps(6,end) both}.battle:has(.statusRow>div:first-child i u[style*="width: 0%"])::after{background:repeating-linear-gradient(90deg,rgba(62,0,11,.76) 0 14px,rgba(5,5,9,.9) 14px 28px);animation:defeatGate 420ms steps(6,end) both}
.battle[data-impact="release"]::after{background:radial-gradient(circle at 50% 20%,rgba(255,249,209,.86),rgba(255,225,112,.26) 24%,rgba(6,7,10,.1) 48%,transparent 68%);animation:releaseGate 620ms steps(7,end) both}
@keyframes battleGateOpen{0%{opacity:1;clip-path:inset(0 0 0 0)}16%{opacity:.92;clip-path:inset(9% 0 9% 0)}34%{opacity:.72;clip-path:inset(20% 0 20% 0)}54%{opacity:.46;clip-path:inset(34% 0 34% 0)}74%{opacity:.18;clip-path:inset(47% 0 47% 0)}100%{opacity:0;clip-path:inset(50% 0 50% 0)}}
@keyframes battleSceneResolveIn{0%{opacity:.35;filter:brightness(2.1) saturate(.45)}18%{opacity:1;filter:brightness(.78) saturate(1.18)}42%{filter:brightness(1.3)}70%{filter:brightness(.94)}100%{opacity:1;filter:none}}
@keyframes victoryResolve{0%{filter:brightness(1)}18%{filter:brightness(1.85) saturate(.6)}40%{filter:brightness(.8) saturate(1.35)}62%{filter:brightness(1.45)}82%{filter:brightness(.95)}100%{filter:none}}
@keyframes victoryGate{0%{opacity:0;clip-path:inset(46% 0 46% 0)}16%{opacity:.9;clip-path:inset(35% 0 35% 0)}34%{opacity:.58;clip-path:inset(22% 0 22% 0)}58%{opacity:.26;clip-path:inset(9% 0 9% 0)}78%{opacity:.1;clip-path:inset(0)}100%{opacity:0;clip-path:inset(0)}}
@keyframes enemyResolveBreak{0%{transform:translateX(0);filter:brightness(1)}18%{transform:translateX(6px);filter:brightness(2.8) saturate(.35)}34%{transform:translateX(-5px);opacity:1}54%{transform:translateX(3px);filter:brightness(1.4);opacity:.72}76%{transform:translateY(-2px);opacity:.34}100%{transform:translateY(-4px);filter:brightness(3);opacity:0}}
@keyframes defeatResolve{0%{filter:none;opacity:1}18%{filter:brightness(1.5) saturate(.45)}36%{filter:grayscale(.35) brightness(.72)}62%{filter:grayscale(.72) brightness(.52)}82%{opacity:.78;filter:grayscale(1) brightness(.4)}100%{opacity:.5;filter:grayscale(1) brightness(.32)}}
@keyframes defeatGate{0%{opacity:0;clip-path:inset(50% 0 50% 0)}20%{opacity:.34;clip-path:inset(34% 0 34% 0)}42%{opacity:.5;clip-path:inset(20% 0 20% 0)}68%{opacity:.64;clip-path:inset(7% 0 7% 0)}100%{opacity:.78;clip-path:inset(0)}}
@keyframes releaseGate{0%{opacity:0;transform:scale(.85)}14%{opacity:.78;transform:scale(.92)}34%{opacity:.46;transform:scale(1)}58%{opacity:.22;transform:scale(1.08)}80%{opacity:.08;transform:scale(1.14)}100%{opacity:0;transform:scale(1.2)}}
@media(prefers-reduced-motion:reduce){.battle,.battle::after,.battle .enemyRow{animation-duration:1ms!important;animation-iteration-count:1!important}}
'''
css_path.write_text(css)

progress = progress_path.read_text()
block = '''

## SFC Visual Reconstruction Pass 19 — Encounter resolution transitions
- Added a short stepped battle-entry shutter so encounters arrive as a game scene rather than an instantaneous web view swap.
- Added enemy-HP-zero victory break, player-HP-zero defeat fade and RELEASE-specific exit light using the existing rendered HP state, with no new combat state machine.
- Extended only the visual result hold to 480ms for victory, 420ms for defeat and 620ms for RELEASE so the new resolution beats are visible before returning to the field/result flow.
- Rewards, outcome priority, battle math, save data, enemy logic, turn order, touch controls and Chapter Battle remain unchanged.
'''
if "## SFC Visual Reconstruction Pass 19 — Encounter resolution transitions" in progress:
    raise SystemExit("pass 19 progress already present")
progress_path.write_text(progress.rstrip() + block + "\n")
