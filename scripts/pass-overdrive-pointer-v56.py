from pathlib import Path

p = Path('app/PrismOverdrive.module.css')
s = p.read_text()
marker = '/* PASS 56 — BEGINNER POINTER WITHOUT COLOR LOSS */'
if marker not in s:
    s += r'''

/* PASS 56 — BEGINNER POINTER WITHOUT COLOR LOSS */
/* Keep each panel's own hue dominant. Guidance is only an outline + tiny pointer. */
.recommended{
  background:var(--fill)!important;
  color:#fff!important;
  filter:none!important;
  transform:none!important;
  animation:recommendedEdgeOnly 820ms steps(2,end) infinite!important;
  box-shadow:
    inset 0 0 0 2px var(--edge),
    inset 0 0 0 3px rgba(255,255,255,.72),
    0 0 7px rgba(255,243,109,.38)!important;
}
.recommended::after{
  content:""!important;
  padding:0!important;
  border:0!important;
  background:transparent!important;
}
.recommendedLead{z-index:6!important}
.recommendedLead::after{
  content:"▼"!important;
  position:absolute!important;
  left:50%!important;
  right:auto!important;
  top:1px!important;
  width:auto!important;
  height:auto!important;
  padding:0!important;
  border:0!important;
  background:transparent!important;
  color:#fff36d!important;
  font:1000 8px/1 monospace!important;
  text-shadow:0 1px #000,1px 0 #000,-1px 0 #000,0 0 4px rgba(255,243,109,.75)!important;
  transform:translateX(-50%)!important;
  opacity:1!important;
  z-index:8!important;
  pointer-events:none!important;
}
@keyframes recommendedEdgeOnly{
  50%{box-shadow:inset 0 0 0 2px var(--edge),inset 0 0 0 4px rgba(255,255,255,.92),0 0 11px rgba(255,243,109,.58)!important}
}
@media(max-height:700px){.recommendedLead::after{font-size:7px!important;top:0!important}}
@media(prefers-reduced-motion:reduce){.recommended{animation:none!important}}
'''
    p.write_text(s)
