from pathlib import Path

css_path = Path('app/rpg/RPGPuzzleBattle.module.css')
css = css_path.read_text().rstrip()
section = r'''

/* SFC visual reconstruction pass 14 — enemy reaction readability */
.battle[data-talking="true"] .intentRow,.battle[data-talking="true"] .statusRow{filter:brightness(.48) saturate(.72);opacity:.72;transition:filter 80ms steps(2,end),opacity 80ms steps(2,end)}
.talkMoment{width:min(94vw,400px);min-height:78px;padding:8px 11px 7px 15px;border-color:#fff0a0;background:linear-gradient(90deg,color-mix(in srgb,var(--sceneAccent) 13%,#070910),#05060a 45%);box-shadow:0 0 0 2px #000,0 0 0 4px color-mix(in srgb,var(--sceneAccent) 62%,#66537c),5px 5px #000}
.talkMoment::before{content:"";position:absolute;left:4px;top:7px;bottom:7px;width:4px;background:var(--sceneAccent);box-shadow:2px 0 #08080d}
.talkMoment span{font-size:8px;color:#ffe887;letter-spacing:.12em;text-shadow:1px 1px #000}.talkMoment p{font-size:13px;line-height:1.42;letter-spacing:.01em;text-shadow:1px 1px #000}.talkMoment small{font-size:6px;color:#d2ccd4;letter-spacing:.1em}.talkMoment small::before{content:"ENEMY REACTION • ";color:var(--sceneAccent)}
@media(max-height:700px){.talkMoment{top:90px;min-height:72px;padding:7px 9px 6px 14px}.talkMoment p{font-size:13px;line-height:1.35}.talkMoment::before{top:6px;bottom:6px}}
'''
if 'SFC visual reconstruction pass 14 — enemy reaction readability' not in css:
    css_path.write_text((css + section).rstrip() + '\n')

progress = Path('PROGRESS.md')
p = progress.read_text()
record = '''\n\n## SFC Visual Reconstruction Pass 14 — Enemy reaction readability\n- Reframed TALK as a high-contrast ENEMY REACTION window with larger text, a scene-tinted accent rail and stronger SFC window hierarchy.\n- Temporarily dims NOW/NEXT and status panels only while the existing 900ms TALK reaction is visible, then restores them unchanged.\n- TALK turn cost, duration, enemy response, alternate-resolution rules and battle math are unchanged.\n'''
if '## SFC Visual Reconstruction Pass 14' not in p:
    progress.write_text(p.rstrip() + record.rstrip() + '\n')
