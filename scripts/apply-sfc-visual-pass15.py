from pathlib import Path

css_path = Path('app/rpg/RPGPuzzleBattle.module.css')
css = css_path.read_text().rstrip()
section = r'''

/* SFC visual reconstruction pass 15 — prism board housing */
.nextMap{border-color:color-mix(in srgb,var(--sceneAccent) 68%,#d7c98d);box-shadow:0 0 0 2px #000,inset 0 0 0 1px color-mix(in srgb,var(--sceneAccent) 20%,transparent);background:linear-gradient(180deg,color-mix(in srgb,var(--sceneAccent) 8%,#060609),#030305)}
.nextTitle{color:#ffe887;text-shadow:1px 1px #000}.nextTitle::before{content:"PRISM ARRAY • ";color:var(--sceneAccent)}
.board{border-color:#f1e5b8;box-shadow:0 0 0 2px #08070a,0 0 0 5px color-mix(in srgb,var(--sceneAccent) 46%,#5b5064),0 6px 0 #000}
.board::after{content:"";position:absolute;z-index:30;inset:3px;pointer-events:none;background:linear-gradient(var(--sceneAccent),var(--sceneAccent)) left top/14px 2px no-repeat,linear-gradient(var(--sceneAccent),var(--sceneAccent)) left top/2px 14px no-repeat,linear-gradient(var(--sceneAccent),var(--sceneAccent)) right top/14px 2px no-repeat,linear-gradient(var(--sceneAccent),var(--sceneAccent)) right top/2px 14px no-repeat,linear-gradient(var(--sceneAccent),var(--sceneAccent)) left bottom/14px 2px no-repeat,linear-gradient(var(--sceneAccent),var(--sceneAccent)) left bottom/2px 14px no-repeat,linear-gradient(var(--sceneAccent),var(--sceneAccent)) right bottom/14px 2px no-repeat,linear-gradient(var(--sceneAccent),var(--sceneAccent)) right bottom/2px 14px no-repeat;opacity:.82}
.board:has(.preview){box-shadow:0 0 0 2px #08070a,0 0 0 5px #fff0a0,0 6px 0 #000}.board:has(.preview)::after{opacity:1}
@media(max-height:700px){.board::after{inset:2px}.nextTitle::before{content:"PRISM • "}}
'''
if 'SFC visual reconstruction pass 15 — prism board housing' not in css:
    css_path.write_text((css + section).rstrip() + '\n')

progress = Path('PROGRESS.md')
p = progress.read_text()
record = '''\n\n## SFC Visual Reconstruction Pass 15 — Prism board housing\n- Unified NEXT DROP MAP and the 6x6 puzzle board as one scene-tinted PRISM BOARD device using shared SFC-style housing colors.\n- Added tiny non-interactive corner rails and a PRISM ARRAY label outside the play cells; panel colors, labels and hit regions are untouched.\n- The housing brightens only during the existing cluster preview using CSS presentation state; puzzle logic and timing are unchanged.\n'''
if '## SFC Visual Reconstruction Pass 15' not in p:
    progress.write_text(p.rstrip() + record.rstrip() + '\n')
