from pathlib import Path

css = Path('app/PuzzleRPGApp.module.css')
text = css.read_text()
marker = '/* PRISM OVERDRIVE mode select */'
if marker not in text:
    text += r'''

/* PRISM OVERDRIVE mode select */
.overdriveMode{grid-column:1/-1!important;color:#ff78df!important;border-color:#da77ff!important;min-height:70px!important;box-shadow:0 0 0 2px #43155c,4px 5px #000!important;background:linear-gradient(90deg,#11102a,#21103a,#081d2b)!important}
.overdriveMode strong{color:#fff36f!important;text-shadow:2px 2px #6e218b!important}
.overdriveMode span{color:#7eefff!important}
.modeGrid button:nth-child(3)::before{content:"03"!important;color:#fff36f!important;border-color:#ff78df!important}
.title:has(.modeGrid) .hero{width:min(40vw,158px);height:min(20dvh,148px);margin-bottom:-2px}
@media(max-height:700px){.title:has(.modeGrid) .hero{width:min(24vw,88px);height:min(11dvh,80px)}.modeGrid button{min-height:54px!important}.overdriveMode{min-height:50px!important}.modeGrid{gap:4px!important}.overdriveMode strong{font-size:12px!important}}
@media(max-height:590px){.title:has(.modeGrid) .hero{width:58px;height:50px}.modeGrid button{min-height:46px!important}.overdriveMode{min-height:44px!important}.modeGrid small{display:none}.modeGrid strong{font-size:10px!important}}
'''
    css.write_text(text)

progress = Path('PROGRESS.md')
if progress.exists():
    p = progress.read_text()
    entry = '\n- PRISM OVERDRIVE: added a third 3-minute hyper-cluster mode with combo, fever/over-fever, auto cascades, jackpot, score-based 3-choice upgrades, time-stop SKIP behavior, final-30-second overdrive, local high score, and an iPhone-safe third mode-select slot.\n'
    if 'PRISM OVERDRIVE:' not in p:
        progress.write_text(p + entry)
