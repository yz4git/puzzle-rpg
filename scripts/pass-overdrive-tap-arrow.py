from pathlib import Path
p = Path('app/PrismOverdrive.module.css')
s = p.read_text()
marker = 'PASS 52 — TAP ARROW / PRESERVE TILE COLOR'
if marker not in s:
    s += '''\n\n/* PASS 52 — TAP ARROW / PRESERVE TILE COLOR */\n.recommended{background:var(--fill)!important;color:#fff!important;filter:none!important;transform:none!important;box-shadow:inset 0 0 0 2px #fff36d,inset 0 0 0 4px var(--edge),0 0 8px rgba(255,243,109,.72)!important}\n.recommended::after{content:""!important;position:absolute!important;inset:auto!important;width:0!important;height:0!important;padding:0!important;margin:0!important;border:0!important;background:transparent!important;box-shadow:none!important}\n.recommendedLead::after{content:"▼"!important;position:absolute!important;inset:auto 2px auto auto!important;width:10px!important;height:10px!important;padding:0!important;margin:0!important;border:0!important;background:transparent!important;color:#fff36d!important;text-shadow:1px 1px #000,-1px -1px #000!important;font:1000 9px/10px monospace!important;opacity:1!important;z-index:8!important;pointer-events:none!important}\n@keyframes recommendedOutline{0%,100%{box-shadow:inset 0 0 0 2px #fff36d,inset 0 0 0 4px var(--edge),0 0 6px rgba(255,243,109,.55)}50%{box-shadow:inset 0 0 0 3px #fff,inset 0 0 0 5px var(--edge),0 0 10px rgba(255,243,109,.85)}}\n'''
p.write_text(s)
