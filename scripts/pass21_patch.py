from pathlib import Path

css_path = Path('app/rpg/RPGMode.module.css')
progress_path = Path('PROGRESS.md')
css = css_path.read_text()
marker = '/* SFC visual reconstruction pass 21 — field HUD hierarchy */'
if marker in css:
    raise SystemExit('pass 21 CSS already present')
css += r'''

/* SFC visual reconstruction pass 21 — field HUD hierarchy */
.hud{gap:3px;min-height:42px}.hud>div{position:relative;overflow:hidden;padding:4px 6px;border-color:color-mix(in srgb,var(--accent2) 76%,#77717a);background:linear-gradient(180deg,color-mix(in srgb,var(--panel) 90%,#20202a),var(--panel2));box-shadow:inset 0 0 0 1px #040406,inset 0 0 0 3px color-mix(in srgb,var(--accent) 13%,transparent),2px 2px #000}.hud>div::before{content:"";position:absolute;left:3px;top:4px;bottom:4px;width:2px;background:color-mix(in srgb,var(--accent) 62%,transparent)}.hud>div:first-child{grid-template-rows:auto 1fr;padding-left:8px;border-color:color-mix(in srgb,var(--accent) 62%,var(--accent2));background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 9%,var(--panel)),var(--panel2) 76%)}.hud>div:first-child::before{width:3px;background:var(--accent)}.hud>div:first-child span{font-size:6px;letter-spacing:.15em}.hud>div:first-child strong{align-self:end;font-size:11px;color:#fff7df;letter-spacing:.02em}.hud>div:nth-child(2){border-color:#4e735d;background:linear-gradient(90deg,#102318,var(--panel2) 78%)}.hud>div:nth-child(2)::before{background:#5ecb78}.hud>div:nth-child(2) span{color:#a9d9b5}.hud>div:nth-child(2) strong{font-size:11px;color:#d8ffe0}.hud>div:nth-child(3){border-color:#8a7439;background:linear-gradient(90deg,#282108,var(--panel2) 78%)}.hud>div:nth-child(3)::before{background:#f0ca58}.hud>div:nth-child(3) span{color:#e5ce82}.hud>div:nth-child(3) strong{font-size:12px;color:#ffe988;text-align:right}.hud span{padding-left:4px}.hud strong{padding-left:4px}
.locationBar{min-height:27px;grid-template-columns:auto minmax(0,1fr);gap:8px;padding:3px 7px 3px 9px;border-color:color-mix(in srgb,var(--accent2) 80%,#67636d);background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 7%,var(--panel)),var(--panel2) 72%);box-shadow:inset 0 0 0 1px #040406,2px 2px #000}.locationBar::before{content:"";position:absolute;left:3px;top:4px;bottom:4px;width:3px;background:var(--accent)}.locationBar span{padding-left:3px;font-size:6px;font-weight:1000;letter-spacing:.11em;color:var(--accent);text-shadow:1px 1px #000}.locationBar strong{font-size:7px;color:#f4ecdb;text-shadow:1px 1px #000}.locationBar strong::before{content:"› ";color:var(--accent)}
.worldFrame{border-color:color-mix(in srgb,var(--accent) 82%,#fff1c9);box-shadow:0 0 0 2px #080609,0 0 0 4px color-mix(in srgb,var(--accent2) 58%,#28232f),0 5px 0 #000}.worldGloss{box-shadow:inset 0 0 0 2px rgba(255,255,255,.13),inset 0 -12px 0 rgba(0,0,0,.1),inset 0 3px color-mix(in srgb,var(--accent) 16%,transparent)}
.memoStrip{min-height:24px;padding:2px 7px 2px 9px;border-color:color-mix(in srgb,var(--accent2) 72%,#56525d);background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 8%,var(--panel2)),#07070c 70%);box-shadow:inset 0 0 0 1px #050507,2px 2px #000}.memoStrip::before{content:"";position:absolute;left:3px;top:5px;bottom:5px;width:2px;background:var(--accent);opacity:.8}.memoStrip span{font-size:7px;font-weight:1000;letter-spacing:.05em}.memoStrip strong{font-size:6px;letter-spacing:.08em;color:#d0cbc1}.rpg[data-kind="town"] .locationBar span::after{content:" • SAFE";color:#8de1a4}.rpg[data-kind="training"] .locationBar span::after{content:" • MASTER";color:#ffe285}.rpg[data-kind="dungeon"] .locationBar span::after{content:" • DEPTH";color:#d7b5ff}
@media(max-height:720px){.hud{min-height:38px}.hud>div{padding-block:3px}.hud>div:first-child strong,.hud>div:nth-child(2) strong{font-size:10px}.hud>div:nth-child(3) strong{font-size:11px}.locationBar{min-height:24px}.memoStrip{min-height:22px}}
'''
css_path.write_text(css)

progress = progress_path.read_text()
entry = '''\n## SFC Visual Reconstruction Pass 21 — Field HUD hierarchy\n- Rebuilt the exploration HUD so map/location identity is primary, HP reads as a green survival meter block and GOLD reads as a distinct reward/resource block.\n- Reframed the location bar as a scene-accented navigation plaque and tightened the MEMO/JOURNEY strip into a quieter secondary information ribbon.\n- Strengthened the world-frame bezel so the reconstructed map reads as the central game viewport instead of another web panel.\n- Field controls, map rendering, collision, encounters, portal logic, save data and Chapter Battle remain unchanged.\n'''
if '## SFC Visual Reconstruction Pass 21 — Field HUD hierarchy' in progress:
    raise SystemExit('pass 21 progress already present')
progress_path.write_text(progress + entry)
