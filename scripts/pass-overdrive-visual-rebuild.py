from pathlib import Path
p=Path('app/PrismOverdrive.module.css')
s=p.read_text()
marker='/* PASS 42 — OVERDRIVE VISUAL RECONSTRUCTION */'
if marker not in s:
    s += r'''

/* PASS 42 — OVERDRIVE VISUAL RECONSTRUCTION */
/* Four panel families must read by hue AND silhouette at a glance. */
.shell{background:#01040b}
.shell::before{background:
  radial-gradient(circle at 50% 35%,rgba(17,92,120,.18),transparent 34%),
  linear-gradient(180deg,#041322 0 24%,#02060c 24% 68%,#09031a 68% 100%)!important}
.shell::after{opacity:.48;background:
  linear-gradient(90deg,transparent 49.5%,rgba(89,236,255,.08) 50%,transparent 50.5%),
  repeating-linear-gradient(0deg,transparent 0 23px,rgba(255,255,255,.025) 24px),
  repeating-linear-gradient(90deg,transparent 0 23px,rgba(82,233,255,.03) 24px)}

.topbar>div,.hypeRow>div{background:linear-gradient(180deg,#071120,#030812);border-color:#36506e;box-shadow:inset 0 0 0 1px #0d1d31,0 3px #000}
.board{border:5px solid #5c7898;background:#00050a;box-shadow:0 0 0 2px #000,inset 0 0 0 2px #152c42,0 0 24px rgba(78,224,255,.28)}
.board::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background:
  linear-gradient(90deg,transparent 49.4%,rgba(93,234,255,.04) 50%,transparent 50.6%),
  linear-gradient(0deg,transparent 49.4%,rgba(93,234,255,.04) 50%,transparent 50.6%)}

.tile{border-width:3px;overflow:hidden;isolation:isolate;background:var(--fill);box-shadow:inset 0 0 0 2px rgba(255,255,255,.08),inset 0 -6px rgba(0,0,0,.22),0 2px #000}
.tile::before{content:"";position:absolute;inset:4px;z-index:-1;border:1px solid var(--inner);background:linear-gradient(145deg,var(--hi),transparent 38%),linear-gradient(325deg,rgba(0,0,0,.32),transparent 48%);opacity:.95}
.tile::after{content:"";position:absolute;inset:0;z-index:-2;opacity:.65;background:repeating-linear-gradient(135deg,transparent 0 6px,var(--pattern) 7px,transparent 8px 13px)}
.tile b{font-size:clamp(22px,7.6vw,33px);line-height:.82;filter:drop-shadow(2px 3px 0 #000);text-shadow:none}
.tile span{font-size:clamp(7px,1.8vw,9px);letter-spacing:.08em;text-shadow:1px 2px #000}

/* ATK: orange-red, hard angular silhouette, chevron-energy texture. */
.attack{--fill:#61170a;--edge:#ff8a2b;--inner:#ffc067;--hi:rgba(255,214,124,.34);--pattern:rgba(255,116,28,.12);color:#fff3d4}
.attack b{color:#ffb13b;transform:scaleX(1.12);text-shadow:-2px 0 #7a1600,2px 0 #7a1600,0 2px #7a1600}
.attack::after{background:repeating-linear-gradient(45deg,transparent 0 7px,rgba(255,154,38,.15) 8px,transparent 9px 15px)}

/* HEAL: emerald-green, soft/round silhouette. Deliberately nowhere near ATK hue. */
.heal{--fill:#063d30;--edge:#41f5ae;--inner:#a2ffd8;--hi:rgba(135,255,211,.30);--pattern:rgba(54,238,168,.10);color:#eafff4}
.heal b{color:#7fffd0;transform:scale(1.04);text-shadow:-2px 0 #03543d,2px 0 #03543d,0 2px #03543d}
.heal::after{background:radial-gradient(circle at 25% 28%,rgba(103,255,194,.16) 0 3px,transparent 4px),radial-gradient(circle at 74% 70%,rgba(103,255,194,.10) 0 2px,transparent 3px)}

/* BAR: electric blue, crystalline. */
.barrier{--fill:#062c57;--edge:#49bfff;--inner:#91e7ff;--hi:rgba(121,222,255,.28);--pattern:rgba(53,164,255,.11);color:#ebf9ff}
.barrier b{color:#71d8ff;text-shadow:-2px 0 #063b75,2px 0 #063b75,0 2px #063b75}
.barrier::after{background:linear-gradient(45deg,transparent 42%,rgba(99,204,255,.17) 43% 48%,transparent 49%),linear-gradient(-45deg,transparent 42%,rgba(99,204,255,.10) 43% 48%,transparent 49%)}

/* SKIP: gold, mechanical/timepiece. */
.skip{--fill:#504006;--edge:#ffe34c;--inner:#fff3a0;--hi:rgba(255,247,159,.28);--pattern:rgba(255,223,53,.10);color:#fffbe0}
.skip b{color:#fff16b;text-shadow:-2px 0 #5e4c00,2px 0 #5e4c00,0 2px #5e4c00}
.skip::after{background:repeating-radial-gradient(circle at center,transparent 0 7px,rgba(255,232,87,.12) 8px,transparent 9px 14px)}

/* NEXT inherits the same four-way language. */
.next .attack{color:#ffad3b;background:#4b1607;border-color:#ff8a2b}.next .heal{color:#71f5c1;background:#07382c;border-color:#41f5ae}.next .barrier{color:#6ed5ff;background:#072c50;border-color:#49bfff}.next .skip{color:#fff16b;background:#473a08;border-color:#ffe34c}

/* Arcade cabinet-like frame and richer meters. */
.rank{font-size:11px;color:#fff3a3;text-shadow:0 0 8px rgba(255,235,107,.55),2px 2px #000}
.combo strong{color:#ff9d2f;text-shadow:0 0 10px rgba(255,130,38,.55),2px 2px #000}.combo u{background:linear-gradient(90deg,#ff7729,#ffd249)}
.feverMeter strong{color:#67f6ff;text-shadow:0 0 9px rgba(72,236,255,.6)}.feverMeter u{background:linear-gradient(90deg,#2fb9ff,#76fff2,#fff46f)}
.actionFeed{border-color:#45698c;background:linear-gradient(180deg,#07101b,#02060d);box-shadow:0 3px #000,inset 0 0 0 1px #15344d,0 0 14px rgba(74,221,255,.12)}

/* State changes should visibly transform the cabinet, not just tint one border. */
.fever .shell,.fever{--pulse:#65f6ff}.fever::before{background:radial-gradient(circle at 50% 38%,rgba(60,242,255,.20),transparent 38%),linear-gradient(180deg,#052e3b,#031019 64%,#12082c)!important}.fever .board{animation:feverCabinet 520ms steps(3,end) infinite alternate}.fever .tile{filter:saturate(1.22) brightness(1.08)}
.overFever .board{animation:overCabinet 300ms steps(2,end) infinite alternate}.overFever .tile{filter:saturate(1.35) brightness(1.16)}
@keyframes feverCabinet{to{box-shadow:0 0 0 2px #000,inset 0 0 0 2px #1d5260,0 0 34px rgba(80,247,255,.72)}}
@keyframes overCabinet{from{border-color:#fff469}to{border-color:#67f7ff;box-shadow:0 0 0 2px #000,0 0 38px rgba(255,238,75,.78)}}

/* Impact readability: active tiles stay crisp and pop harder. */
.focused{outline:4px solid #fff!important;box-shadow:0 0 0 3px var(--edge),0 0 20px var(--edge)!important;filter:brightness(1.65) saturate(1.3)!important}
.clearing{filter:brightness(2.8) saturate(1.5);animation:pixelBreakPremium 180ms steps(4,end) forwards!important}
@keyframes pixelBreakPremium{0%{transform:scale(1);opacity:1}32%{transform:scale(1.12);filter:brightness(3)}64%{transform:scale(.78) rotate(2deg)}100%{transform:scale(.08) rotate(-8deg);opacity:0}}

@media(max-height:700px){.tile b{font-size:clamp(19px,6.8vw,28px)}.tile span{font-size:6px}.actionFeed{height:66px}.actionFx{height:62px!important;min-height:62px!important}}
'''
p.write_text(s)
