from pathlib import Path

p = Path('app/PrismOverdrive.tsx')
s = p.read_text()

def rep(old: str, new: str, label: str):
    global s
    if old not in s:
        raise SystemExit(f'MISSING {label}')
    s = s.replace(old, new, 1)

rep('''type BoardFx = {
  token: number;
  kind: PanelType | "cascade" | "jackpot";
  phase: "lock" | "burst" | "drop";
  x: number;
  y: number;
  points: number;
  chain: number;
  count: number;
  columns: number[];
};''','''type BoardFx = {
  token: number;
  kind: PanelType | "cascade" | "jackpot";
  phase: "lock" | "burst" | "drop";
  x: number;
  y: number;
  points: number;
  chain: number;
  count: number;
  columns: number[];
  mega?: boolean;
};
type ModeFx = {
  token: number;
  kind: "fever" | "overFever" | "final";
  title: string;
  detail: string;
};''','mode fx type')

rep('''  const [actionFx, setActionFx] = useState<ActionFx | null>(null);
  const [boardFx, setBoardFx] = useState<BoardFx | null>(null);''','''  const [actionFx, setActionFx] = useState<ActionFx | null>(null);
  const [boardFx, setBoardFx] = useState<BoardFx | null>(null);
  const [modeFx, setModeFx] = useState<ModeFx | null>(null);''','mode fx state')

rep('''  const resolvingRef = useRef(false);
  const actionFxTokenRef = useRef(1);''','''  const resolvingRef = useRef(false);
  const actionFxTokenRef = useRef(1);
  const finalTriggeredRef = useRef(false);''','final ref')

rep('''      timeRef.current = Math.max(0, timeRef.current - delta);
      setTimeLeft(timeRef.current);
      if (comboRef.current > 0 && current > comboExpireRef.current) {''','''      timeRef.current = Math.max(0, timeRef.current - delta);
      setTimeLeft(timeRef.current);
      if (!finalTriggeredRef.current && timeRef.current <= FINAL_MS) {
        finalTriggeredRef.current = true;
        const token = actionFxTokenRef.current++;
        setModeFx({ token, kind: "final", title: "FINAL OVERDRIVE", detail: "30 SEC • LIMITER RELEASED" });
        setLastRank("FINAL OVERDRIVE • ×BOOST");
        playOverdriveSfx("final", 1.35);
        window.setTimeout(() => setModeFx((value) => value?.token === token ? null : value), 1050);
      }
      if (comboRef.current > 0 && current > comboExpireRef.current) {''','final trigger')

rep('''    setClearingIds(new Set()); setFocusIds(new Set()); setActionFx(null); setBoardFx(null);
    setResolving(false); resolvingRef.current = false; setLastGain(0); setLastRank("");
    feverUntilRef.current = 0; overFeverUntilRef.current = 0; timeStopUntilRef.current = 0; comboExpireRef.current = 0;''','''    setClearingIds(new Set()); setFocusIds(new Set()); setActionFx(null); setBoardFx(null); setModeFx(null);
    setResolving(false); resolvingRef.current = false; setLastGain(0); setLastRank("");
    feverUntilRef.current = 0; overFeverUntilRef.current = 0; timeStopUntilRef.current = 0; comboExpireRef.current = 0; finalTriggeredRef.current = false;''','reset mode fx')

rep('''      setLastRank("OVER FEVER!! • ×5");
      setMessage("OVER FEVER • BREAK EVERYTHING");
      playSfx("cascade");
      playOverdriveSfx("fever", 1.25);''','''      setLastRank("OVER FEVER!! • ×5");
      setMessage("OVER FEVER • BREAK EVERYTHING");
      const token = actionFxTokenRef.current++;
      setModeFx({ token, kind: "overFever", title: "OVER FEVER", detail: "PRISM LIMIT BROKEN • ×5" });
      window.setTimeout(() => setModeFx((value) => value?.token === token ? null : value), 900);
      playSfx("cascade");
      playOverdriveSfx("fever", 1.35);''','over fever transition')

rep('''      setLastRank("PRISM FEVER!! • ×3");
      setMessage("3 COLOR DROP • CASCADE CHANCE UP");
      playSfx("cascade");
      playOverdriveSfx("fever", 1);''','''      setLastRank("PRISM FEVER!! • ×3");
      setMessage("3 COLOR DROP • CASCADE CHANCE UP");
      const token = actionFxTokenRef.current++;
      setModeFx({ token, kind: "fever", title: "PRISM FEVER", detail: "3 COLOR DROP • ×3" });
      window.setTimeout(() => setModeFx((value) => value?.token === token ? null : value), 820);
      playSfx("cascade");
      playOverdriveSfx("fever", 1.12);''','fever transition')

rep('''    setBoardFx({ token: actionToken, kind: liveSeed.type, phase: "lock", x: impactAnchor.x, y: impactAnchor.y, points: 0, chain: 0, count: removed.size, columns: impactAnchor.columns });''','''    setBoardFx({ token: actionToken, kind: liveSeed.type, phase: "lock", x: impactAnchor.x, y: impactAnchor.y, points: 0, chain: 0, count: removed.size, columns: impactAnchor.columns, mega: attackBlast });''','lock mega')
rep('''    setBoardFx({ token: actionToken + 100000, kind: liveSeed.type, phase: "burst", x: impactAnchor.x, y: impactAnchor.y, points: Math.round(scored.points), chain: 0, count: removed.size, columns: impactAnchor.columns });''','''    setBoardFx({ token: actionToken + 100000, kind: liveSeed.type, phase: "burst", x: impactAnchor.x, y: impactAnchor.y, points: Math.round(scored.points), chain: 0, count: removed.size, columns: impactAnchor.columns, mega: attackBlast });
    if (attackBlast) playOverdriveSfx("mega", Math.min(1.45, 1.08 + removed.size * .025));''','burst mega')
rep('''    setBoardFx({ token: actionToken + 200000, kind: liveSeed.type, phase: "drop", x: impactAnchor.x, y: 91, points: 0, chain: 0, count: removed.size, columns: impactAnchor.columns });''','''    setBoardFx({ token: actionToken + 200000, kind: liveSeed.type, phase: "drop", x: impactAnchor.x, y: 91, points: 0, chain: 0, count: removed.size, columns: impactAnchor.columns, mega: attackBlast });''','drop mega')

rep('''          className={`${styles.tile} ${styles[tile.type]} ${focusIds.has(tile.id) ? styles.focused : ""} ${clearingIds.has(tile.id) ? styles.clearing : ""}`}''','''          className={`${styles.tile} ${styles[tile.type]} ${focusIds.has(tile.id) ? styles.focused : ""} ${clearingIds.has(tile.id) ? styles.clearing : ""} ${boardFx?.phase === "drop" && boardFx.columns.includes(tile.col) ? styles.dropping : ""}`}''','dropping tile class')

rep('''      {boardFx ? <div key={boardFx.token} className={styles.spatialFx} data-phase={boardFx.phase} data-kind={boardFx.kind} aria-hidden="true">''','''      {boardFx ? <div key={boardFx.token} className={styles.spatialFx} data-phase={boardFx.phase} data-kind={boardFx.kind} data-mega={boardFx.mega ? "true" : "false"} aria-hidden="true">''','board fx mega attr')

rep('''    </section>\n\n    <section className={styles.actionFeed}''','''    </section>

    {modeFx ? <div key={modeFx.token} className={styles.modeTransform} data-kind={modeFx.kind} aria-hidden="true">
      <i /><b /><u /><strong>{modeFx.title}</strong><span>{modeFx.detail}</span>
    </div> : null}

    <section className={styles.actionFeed}''','mode transform render')

p.write_text(s)

# Audio escalation vocabulary.
a = Path('app/gameAudio.ts')
g = a.read_text()
if '"final" | "mega"' not in g:
    g = g.replace('export type OverdriveSfx = "attack" | "cascade" | "fever" | "jackpot" | "upgrade" | "drop";', 'export type OverdriveSfx = "attack" | "cascade" | "fever" | "jackpot" | "upgrade" | "drop" | "mega" | "final";')
    needle = '''  if (name === "drop") {\n    const pitch = .9 + k * .12;\n    sweep(980 * pitch, 180 * pitch, t, .085, .035 * k, "triangle");\n    tone(120 * pitch, t + .07, .055, .055 * k, "triangle");\n    noise(t + .065, .035, .022 * k);\n    return;\n  }'''
    replacement = needle + '''\n  if (name === "mega") {\n    tone(62, t, .22, .13 * k, "triangle");\n    sweep(120, 1680, t, .14, .11 * k, "sawtooth");\n    sweep(2400, 260, t + .055, .18, .085 * k, "square");\n    noise(t + .035, .16, .12 * k);\n    arp([659, 988, 1319, 1976], .035, .06 * k, "square");\n    return;\n  }\n  if (name === "final") {\n    tone(55, t, .35, .13 * k, "triangle");\n    sweep(90, 1760, t, .38, .1 * k, "sawtooth");\n    arp([262,392,523,659,784,1047,1319,1568,2093], .042, .07 * k, "square");\n    noise(t + .18, .2, .08 * k);\n    return;\n  }'''
    if needle not in g:
        raise SystemExit('MISSING audio drop block')
    g = g.replace(needle, replacement, 1)
a.write_text(g)

# Visual escalation layer.
c = Path('app/PrismOverdrive.module.css')
cs = c.read_text()
marker = '/* PASS 44 — ESCALATION / TRANSFORMATION VFX */'
if marker not in cs:
    cs += '''\n\n/* PASS 44 — ESCALATION / TRANSFORMATION VFX */
/* Drop physics only affects columns that actually changed. */
.dropping{animation:tileLand 330ms cubic-bezier(.12,.82,.24,1.28)!important;transform-origin:50% 100%}
@keyframes tileLand{0%{transform:translateY(-15px) scaleY(.92);filter:brightness(1.45)}58%{transform:translateY(3px) scaleY(1.04)}78%{transform:translateY(-2px) scaleY(.98)}100%{transform:none;filter:none}}
.spatialFx[data-phase="drop"] .dropTrail::after{content:"";position:absolute;left:-7px;bottom:-3px;width:14px;height:4px;background:currentColor;box-shadow:0 0 10px currentColor;animation:landingPad 330ms steps(4,end) forwards}
@keyframes landingPad{0%,45%{opacity:0;transform:scaleX(.3)}62%{opacity:1;transform:scaleX(1.9)}100%{opacity:0;transform:scaleX(2.7)}}

/* MEGA ATK gets its own second shock ring and hotter palette, without an opaque cover. */
.spatialFx[data-kind="attack"][data-mega="true"]{color:#ffb23d;filter:drop-shadow(0 0 8px #ff5b16)}
.spatialFx[data-kind="attack"][data-mega="true"] .impactRing{border-width:6px;box-shadow:0 0 18px #ff7b20,inset 0 0 12px #fff1a6}
.spatialFx[data-kind="attack"][data-mega="true"]::before,.spatialFx[data-kind="attack"][data-mega="true"]::after{content:"";position:absolute;left:var(--fx-x,50%);top:var(--fx-y,50%);width:12%;aspect-ratio:1;border:4px solid #fff2a8;transform:translate(-50%,-50%) rotate(45deg);animation:megaDiamond 420ms steps(5,end) forwards;pointer-events:none}
.spatialFx[data-kind="attack"][data-mega="true"]::after{animation-delay:70ms;border-color:#ff6b25}
@keyframes megaDiamond{0%{opacity:1;width:8%;filter:brightness(3)}100%{opacity:0;width:76%;transform:translate(-50%,-50%) rotate(135deg);filter:brightness(1.2)}}

/* Mode transformations use only lines, rays and outline typography so the board remains visible. */
.modeTransform{position:absolute;z-index:28;left:max(8px,env(safe-area-inset-left));right:max(8px,env(safe-area-inset-right));top:98px;height:min(54vw,232px);pointer-events:none;overflow:hidden;display:grid;place-items:center;mix-blend-mode:screen}
.modeTransform>i,.modeTransform>b,.modeTransform>u{position:absolute;display:block;inset:50% auto auto 50%;transform:translate(-50%,-50%);border:3px solid currentColor;border-radius:50%;width:24%;aspect-ratio:1;animation:modeRing 780ms steps(7,end) forwards}
.modeTransform>b{animation-delay:70ms}.modeTransform>u{animation-delay:140ms}
.modeTransform strong{z-index:2;margin-top:-15px;padding:3px 10px;border-block:3px solid currentColor;background:rgba(0,4,10,.28);font-size:clamp(18px,6vw,28px);letter-spacing:.08em;text-shadow:3px 3px #000;animation:modeTitle 760ms steps(6,end) forwards}
.modeTransform span{z-index:2;margin-top:38px;font-size:7px;font-weight:1000;letter-spacing:.14em;text-shadow:2px 2px #000;animation:modeTitle 760ms steps(6,end) forwards}
.modeTransform[data-kind="fever"]{color:#64f7ff}.modeTransform[data-kind="overFever"]{color:#fff36d}.modeTransform[data-kind="final"]{color:#ff6fd7}
@keyframes modeRing{0%{opacity:0;width:8%;filter:brightness(4)}18%{opacity:1}100%{opacity:0;width:112%;filter:brightness(1.2)}}
@keyframes modeTitle{0%{opacity:0;transform:scale(.68)}22%{opacity:1;transform:scale(1.08)}72%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.04)}}

/* FEVER looks like the cabinet has changed power state, not just a border recolor. */
.fever .shell::before{filter:saturate(1.18)}
.fever .board{animation:feverCabinetPulse 780ms steps(6,end) infinite alternate}
.fever .tile{box-shadow:inset 0 0 0 2px rgba(255,255,255,.14),inset 0 -6px rgba(0,0,0,.18),0 0 7px color-mix(in srgb,var(--edge) 60%,transparent),0 2px #000}
.overFever .board{animation:overCabinetPulse 420ms steps(4,end) infinite alternate}
.overFever .tile{filter:saturate(1.28) brightness(1.08)}
@keyframes feverCabinetPulse{to{box-shadow:0 0 0 2px #000,inset 0 0 0 3px #83fbff,0 0 33px rgba(81,242,255,.72)}}
@keyframes overCabinetPulse{to{box-shadow:0 0 0 2px #000,inset 0 0 0 4px #fff36d,0 0 42px rgba(255,244,104,.88)}}

/* FINAL 30 sec: the whole cabinet becomes unstable while panel readability remains intact. */
.final .shell::before{animation:finalBackgroundDrive 520ms steps(4,end) infinite alternate}
.final .board{animation:finalBoardDrive 350ms steps(3,end) infinite alternate}
.final .topbar>div,.final .hypeRow>div{border-color:#ff61cb;box-shadow:inset 0 0 0 1px #59204f,0 0 8px rgba(255,66,190,.34),0 3px #000}
.final .tile{animation-duration:220ms}.final .rank{animation:finalRankPunch 380ms steps(3,end) infinite alternate}
@keyframes finalBackgroundDrive{to{filter:hue-rotate(10deg) saturate(1.35) brightness(1.14)}}
@keyframes finalBoardDrive{to{transform:scale(1.006);border-color:#fff36d;box-shadow:0 0 0 2px #000,inset 0 0 0 3px #ff6dd5,0 0 38px rgba(255,72,202,.74)}}
@keyframes finalRankPunch{to{transform:scale(1.055);filter:brightness(1.55)}}
@media(max-height:700px){.modeTransform{top:84px;height:min(52vw,190px)}.modeTransform strong{font-size:17px}.modeTransform span{font-size:6px}}
'''
c.write_text(cs)
