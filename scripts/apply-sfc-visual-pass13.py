from pathlib import Path

css_path = Path('app/rpg/RPGPuzzleBattle.module.css')
css = css_path.read_text().rstrip()
section = r'''

/* SFC visual reconstruction pass 13 — battle stage composition */
.battleBackdrop::before{content:"";position:absolute;z-index:0;left:0;right:0;bottom:0;height:20px;background:repeating-linear-gradient(0deg,color-mix(in srgb,var(--sceneAccent) 18%,#121018) 0 3px,#09090e 3px 6px);border-top:2px solid color-mix(in srgb,var(--sceneAccent) 46%,#201b26);box-shadow:inset 0 5px rgba(255,255,255,.025)}
.enemyRow{grid-template-columns:112px 1fr;padding:2px 7px 4px;background:rgba(4,5,9,.18);border-color:color-mix(in srgb,var(--sceneAccent) 86%,#fff)}
.enemyRow::after{left:10px;bottom:5px;width:96px;height:9px;background:#040407;opacity:.76;clip-path:polygon(7% 0,93% 0,100% 45%,86% 100%,13% 100%,0 45%);box-shadow:inset 0 2px color-mix(in srgb,var(--sceneAccent) 32%,transparent)}
.enemySprite{width:110px;height:82px;transform-origin:50% 88%;filter:drop-shadow(0 4px 0 #000) drop-shadow(0 0 2px color-mix(in srgb,var(--sceneAccent) 34%,transparent))}.battle[data-boss="true"] .enemySprite{width:118px;height:84px;transform:translateX(-3px);filter:drop-shadow(0 5px 0 #000) drop-shadow(0 0 4px color-mix(in srgb,var(--sceneAccent) 48%,transparent))}
.enemyRow>div{align-self:center;padding:5px 6px;border:2px solid color-mix(in srgb,var(--sceneAccent) 58%,#777483);box-shadow:inset 0 0 0 1px #050507,3px 3px 0 rgba(0,0,0,.48);background:rgba(5,6,12,.9)}
.enemyRow strong{color:#fff7df;text-shadow:1px 1px #000}.enemyRow span{color:var(--sceneAccent)}.enemyRow small{color:#d3ced3}
.battle[data-talking="true"] .battleBackdrop::before{background:repeating-linear-gradient(90deg,color-mix(in srgb,var(--sceneAccent) 32%,#15101a) 0 8px,#09090e 8px 16px);border-top-color:var(--gold)}
.battle[data-talking="true"] .enemyRow{border-color:#fff0a0;box-shadow:inset 0 0 0 2px rgba(0,0,0,.68),inset 0 -12px 18px color-mix(in srgb,var(--sceneAccent) 18%,transparent)}
.battle[data-talking="true"] .enemySprite{animation:battleTalkReaction 900ms steps(4,end) both}
@keyframes battleTalkReaction{0%{transform:translateY(2px) scale(.98)}22%{transform:translateY(-2px) scale(1.04)}48%{transform:translateY(0) scale(1)}72%{transform:translateY(-1px) scale(1.02)}100%{transform:translateY(0) scale(1)}}
@media(max-height:700px){.enemyRow{grid-template-columns:102px 1fr}.enemySprite{width:100px;height:76px}.battle[data-boss="true"] .enemySprite{width:106px;height:78px}.enemyRow::after{width:88px}.battleBackdrop::before{height:18px}}
'''
if 'SFC visual reconstruction pass 13 — battle stage composition' not in css:
    css_path.write_text((css + section).rstrip() + '\n')

progress = Path('PROGRESS.md')
p = progress.read_text()
record = '''\n\n## SFC Visual Reconstruction Pass 13 — Battle stage composition\n- Rebuilt the enemy strip as a grounded SFC-style battle stage with a scene-tinted pixel floor band and stronger contact platform.\n- Enlarged normal/boss enemy presentation without reducing the 360px short-screen puzzle board.\n- Reframed enemy information as a denser in-world window and added a stepped TALK reaction treatment driven by the existing reaction sprite state.\n- Battle math, panel rules, NEXT queues, intents, save data and encounter tables are unchanged.\n'''
if '## SFC Visual Reconstruction Pass 13' not in p:
    progress.write_text(p.rstrip() + record.rstrip() + '\n')
