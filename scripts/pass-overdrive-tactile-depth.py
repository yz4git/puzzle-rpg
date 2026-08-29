from pathlib import Path

p = Path('app/PrismOverdrive.tsx')
s = p.read_text()

def rep(old: str, new: str, label: str):
    global s
    if old not in s:
        raise SystemExit(f'MISSING {label}')
    s = s.replace(old, new, 1)

rep('import { useEffect, useMemo, useRef, useState } from "react";', 'import { useEffect, useMemo, useRef, useState } from "react";\nimport type { CSSProperties } from "react";', 'css properties import')

rep('''  const [boardFx, setBoardFx] = useState<BoardFx | null>(null);\n  const [modeFx, setModeFx] = useState<ModeFx | null>(null);''', '''  const [boardFx, setBoardFx] = useState<BoardFx | null>(null);\n  const [modeFx, setModeFx] = useState<ModeFx | null>(null);\n  const [pressedId, setPressedId] = useState<number | null>(null);\n  const [focusDelays, setFocusDelays] = useState<Record<number, number>>({});\n  const [jackpotAfterglow, setJackpotAfterglow] = useState(false);''', 'tactile states')

rep('''function fxAnchor(items: Tile[]) {\n  if (!items.length) return { x: 50, y: 50, columns: [] as number[] };\n  const x = items.reduce((sum, tile) => sum + tile.col + 0.5, 0) / items.length / SIZE * 100;\n  const y = items.reduce((sum, tile) => sum + tile.row + 0.5, 0) / items.length / SIZE * 100;\n  const columns = [...new Set(items.map((tile) => tile.col))].sort((a, b) => a - b);\n  return { x, y, columns };\n}''', '''function fxAnchor(items: Tile[]) {\n  if (!items.length) return { x: 50, y: 50, columns: [] as number[] };\n  const x = items.reduce((sum, tile) => sum + tile.col + 0.5, 0) / items.length / SIZE * 100;\n  const y = items.reduce((sum, tile) => sum + tile.row + 0.5, 0) / items.length / SIZE * 100;\n  const columns = [...new Set(items.map((tile) => tile.col))].sort((a, b) => a - b);\n  return { x, y, columns };\n}\n\nfunction fxWaveDelays(items: Tile[], anchor: { x: number; y: number }) {\n  const ax = anchor.x / 100 * SIZE - 0.5;\n  const ay = anchor.y / 100 * SIZE - 0.5;\n  const delays: Record<number, number> = {};\n  for (const tile of items) delays[tile.id] = Math.round((Math.abs(tile.col - ax) + Math.abs(tile.row - ay)) * 38);\n  return delays;\n}\n\nfunction fxRouteDelays(items: Tile[]) {\n  const delays: Record<number, number> = {};\n  items.forEach((tile, index) => { delays[tile.id] = Math.min(245, index * 34); });\n  return delays;\n}''', 'wave delay helper')

rep('''    setClearingIds(new Set()); setFocusIds(new Set()); setActionFx(null); setBoardFx(null); setModeFx(null);\n    setResolving(false); resolvingRef.current = false; setLastGain(0); setLastRank("");''', '''    setClearingIds(new Set()); setFocusIds(new Set()); setFocusDelays({}); setActionFx(null); setBoardFx(null); setModeFx(null);\n    setPressedId(null); setJackpotAfterglow(false);\n    setResolving(false); resolvingRef.current = false; setLastGain(0); setLastRank("");''', 'reset tactile state')

rep('''    setFocusIds(new Set(removed));\n    const actionToken = actionFxTokenRef.current++;''', '''    setFocusDelays(fxWaveDelays(removedTiles, impactAnchor));\n    setFocusIds(new Set(removed));\n    const actionToken = actionFxTokenRef.current++;''', 'normal focus wave')

rep('''    setFocusIds(new Set());\n    setClearingIds(removed);''', '''    setFocusIds(new Set());\n    setFocusDelays({});\n    setClearingIds(removed);''', 'normal clear focus delay')

rep('''      setFocusIds(autoIds);\n      setActionFx({ token: cascadeToken, kind: "cascade", title: `AUTO CASCADE → CHAIN ${depth}!`, detail: `${LABEL[autoType]} ×${auto.length} CONNECTED BY THE DROP`, icon: "↯" });''', '''      setFocusDelays(fxRouteDelays(auto));\n      setFocusIds(autoIds);\n      setActionFx({ token: cascadeToken, kind: "cascade", title: `AUTO CASCADE → CHAIN ${depth}!`, detail: `${LABEL[autoType]} ×${auto.length} CONNECTED BY THE DROP`, icon: "↯" });''', 'cascade route pulse')

rep('''      setFocusIds(new Set());\n      setClearingIds(autoIds);''', '''      setFocusIds(new Set());\n      setFocusDelays({});\n      setClearingIds(autoIds);''', 'cascade clear focus delay')

rep('''      setBoardFx({ token: jackpotToken + 200000, kind: "jackpot", phase: "drop", x: 50, y: 91, points: 0, chain: 0, count: 36, columns: [0,1,2,3,4,5] });\n      playOverdriveSfx("drop", 1.42);\n      await sleep(390);\n      setJackpotFlash(false);''', '''      setBoardFx({ token: jackpotToken + 200000, kind: "jackpot", phase: "drop", x: 50, y: 91, points: 0, chain: 0, count: 36, columns: [0,1,2,3,4,5] });\n      playOverdriveSfx("drop", 1.42);\n      await sleep(390);\n      setJackpotFlash(false);\n      setJackpotAfterglow(true);\n      playOverdriveSfx("rebuild", 1.28);\n      window.setTimeout(() => setJackpotAfterglow(false), 1180);''', 'jackpot afterglow')

rep('''    setActionFx(null);\n    setBoardFx(null);\n    setFocusIds(new Set());''', '''    setActionFx(null);\n    setBoardFx(null);\n    setFocusIds(new Set());\n    setFocusDelays({});''', 'end focus delay reset')

rep('''    <div className={styles.backFx} aria-hidden="true"><i /><i /><b /><u /></div>''', '''    <div className={styles.backFx} aria-hidden="true"><i /><i /><i /><b /><u /><span /></div>''', 'background depth layers')

rep('''    <section className={styles.boardWrap} data-impact={actionFx?.kind ?? "idle"} data-jackpot={jackpotFlash ? "true" : "false"}>''', '''    <section className={styles.boardWrap} data-impact={actionFx?.kind ?? "idle"} data-phase={boardFx?.phase ?? "idle"} data-chain={boardFx?.chain ?? 0} data-jackpot={jackpotFlash ? "true" : "false"} data-afterglow={jackpotAfterglow ? "true" : "false"}>''', 'board tactile data')

rep('''          className={`${styles.tile} ${styles[tile.type]} ${focusIds.has(tile.id) ? styles.focused : ""} ${clearingIds.has(tile.id) ? styles.clearing : ""} ${boardFx?.phase === "drop" && boardFx.columns.includes(tile.col) ? styles.dropping : ""}`}\n          style={{\n            left: `calc(${tile.col * (100 / SIZE)}% + 1px)`,\n            top: `calc(${tile.row * (100 / SIZE)}% + 1px)`,\n            animationDelay: boardFx?.phase === "drop" && boardFx.columns.includes(tile.col) ? `${tile.row * 22}ms` : undefined,\n          }}''', '''          className={`${styles.tile} ${styles[tile.type]} ${focusIds.has(tile.id) ? styles.focused : ""} ${clearingIds.has(tile.id) ? styles.clearing : ""} ${boardFx?.phase === "drop" && boardFx.columns.includes(tile.col) ? styles.dropping : ""} ${pressedId === tile.id ? styles.pressed : ""}`}\n          style={{\n            left: `calc(${tile.col * (100 / SIZE)}% + 1px)`,\n            top: `calc(${tile.row * (100 / SIZE)}% + 1px)`,\n            animationDelay: boardFx?.phase === "drop" && boardFx.columns.includes(tile.col) ? `${tile.row * 22}ms` : undefined,\n            "--focus-delay": `${focusDelays[tile.id] ?? 0}ms`,\n            "--tile-delay": `${tile.row * 14 + tile.col * 9}ms`,\n          } as CSSProperties}''', 'tile tactile class style')

rep('''          aria-label={`${LABEL[tile.type]} cluster panel row ${tile.row + 1} column ${tile.col + 1}`}\n          onClick={() => void clearCluster(tile)}''', '''          aria-label={`${LABEL[tile.type]} cluster panel row ${tile.row + 1} column ${tile.col + 1}`}\n          onPointerDown={() => { setPressedId(tile.id); playOverdriveSfx("tap", 0.72); }}\n          onPointerUp={() => setPressedId(null)}\n          onPointerCancel={() => setPressedId(null)}\n          onPointerLeave={() => setPressedId((value) => value === tile.id ? null : value)}\n          onClick={() => { setPressedId(null); void clearCluster(tile); }}''', 'tile pointer feedback')

rep('''            {boardFx.phase === "burst" && boardFx.points > 0 ? <strong className={styles.scorePop} style={{ left: `${boardFx.x}%`, top: `${boardFx.y}%` }}>+{boardFx.points.toLocaleString()}</strong> : null}''', '''            {boardFx.phase === "burst" && boardFx.points > 0 ? <strong className={styles.scorePop} data-score={`+${boardFx.points.toLocaleString()}`} style={{ left: `${boardFx.x}%`, top: `${boardFx.y}%` }}>+{boardFx.points.toLocaleString()}</strong> : null}''', 'score pop data')

p.write_text(s)

# Extend Overdrive audio with tactile press and rebuild reward layers.
a = Path('app/gameAudio.ts')
g = a.read_text()
g = g.replace('export type OverdriveSfx = "attack" | "cascade" | "fever" | "jackpot" | "upgrade" | "drop" | "mega" | "final";', 'export type OverdriveSfx = "attack" | "cascade" | "fever" | "jackpot" | "upgrade" | "drop" | "mega" | "final" | "tap" | "rebuild";')
needle = '''  if (name === "attack") {\n    sweep(140, 1180, t, .105, .09 * k, "sawtooth");\n    sweep(1760, 420, t + .045, .12, .065 * k, "square");\n    tone(82, t + .085, .12, .09 * k, "triangle");\n    noise(t + .07, .085, .075 * k);\n    return;\n  }'''
if needle not in g:
    raise SystemExit('MISSING audio attack block')
insert = '''  if (name === "tap") {\n    tone(520, t, .025, .022 * k, "square");\n    tone(1040, t + .012, .018, .012 * k, "triangle");\n    return;\n  }\n  if (name === "rebuild") {\n    sweep(1800, 260, t, .12, .038 * k, "triangle");\n    arp([392, 523, 659, 988, 1319, 1976], .038, .052 * k, "square");\n    tone(98, t + .08, .16, .07 * k, "triangle");\n    sweep(260, 1860, t + .13, .2, .05 * k, "sawtooth");\n    return;\n  }\n'''
g = g.replace(needle, insert + needle, 1)
a.write_text(g)

c = Path('app/PrismOverdrive.module.css')
cs = c.read_text()
marker = '/* PASS 46 — TACTILE DEPTH / REWARD AFTERGLOW */'
if marker not in cs:
    cs += r'''

/* PASS 46 — TACTILE DEPTH / REWARD AFTERGLOW */
/* Input has a visible mechanical press before the resolution animation starts. */
.pressed{transform:translateY(4px) scale(.94)!important;filter:brightness(1.42) saturate(1.18)!important;box-shadow:inset 0 0 0 3px rgba(255,255,255,.58),inset 0 -2px rgba(0,0,0,.24),0 0 11px var(--edge)!important;transition:none!important}
.pressed b{transform:translateY(1px) scale(.94)!important;filter:brightness(1.5)}
.focused{animation-delay:var(--focus-delay,0ms)!important}
.focused::before{animation-delay:var(--focus-delay,0ms)!important}

/* The cabinet kicks at the exact BURST moment; later chains hit harder. */
.boardWrap[data-phase="burst"] .board{animation:impactKick 220ms steps(4,end)!important}
.boardWrap[data-phase="burst"][data-chain="2"] .board{animation-name:impactKick2!important}
.boardWrap[data-phase="burst"][data-chain="3"] .board,.boardWrap[data-phase="burst"][data-chain="4"] .board{animation-name:impactKick3!important}
@keyframes impactKick{0%{transform:translate(0) scale(1)}24%{transform:translate(-2px,1px) scale(.995)}48%{transform:translate(2px,-1px) scale(1.006)}100%{transform:none}}
@keyframes impactKick2{0%{transform:translate(0) scale(1)}20%{transform:translate(-3px,2px) scale(.992)}45%{transform:translate(3px,-2px) scale(1.009)}72%{transform:translate(-1px,1px)}100%{transform:none}}
@keyframes impactKick3{0%{transform:translate(0) scale(1)}18%{transform:translate(-4px,2px) scale(.988)}38%{transform:translate(4px,-3px) scale(1.012)}58%{transform:translate(-3px,1px)}78%{transform:translate(2px,-1px)}100%{transform:none}}

/* Chain depth is also readable at the board edge, without covering any tile. */
.boardWrap[data-chain="1"] .board{outline:1px solid rgba(167,105,255,.68);outline-offset:3px}
.boardWrap[data-chain="2"] .board{outline:2px solid rgba(95,236,255,.74);outline-offset:3px}
.boardWrap[data-chain="3"] .board{outline:3px solid rgba(255,242,91,.84);outline-offset:3px}
.boardWrap[data-chain="4"] .board{outline:3px solid rgba(255,104,216,.92);outline-offset:4px;box-shadow:0 0 0 2px #000,inset 0 0 0 2px #ff6bd8,0 0 38px rgba(255,92,215,.62)}

/* Score numbers carry two chromatic echo planes, giving a much stronger reward punch. */
.scorePop{isolation:isolate;filter:drop-shadow(0 0 5px currentColor)}
.scorePop::before,.scorePop::after{content:attr(data-score);position:absolute;inset:0;z-index:-1;pointer-events:none;opacity:.78}
.scorePop::before{color:#63efff;transform:translate(-4px,2px);animation:scoreEchoLeft 500ms steps(6,end) forwards}
.scorePop::after{color:#ff67cf;transform:translate(4px,-2px);animation:scoreEchoRight 500ms steps(6,end) forwards}
@keyframes scoreEchoLeft{0%{opacity:.9;transform:translate(-2px,2px) scale(.92)}100%{opacity:0;transform:translate(-18px,-18px) scale(1.12)}}
@keyframes scoreEchoRight{0%{opacity:.9;transform:translate(2px,-2px) scale(.92)}100%{opacity:0;transform:translate(18px,-22px) scale(1.12)}}

/* JACKPOT rebuild leaves a short-lived prism afterglow so the reward has an ending beat. */
.boardWrap[data-afterglow="true"] .board{animation:rebuildAfterglow 1.05s steps(8,end)!important}
.boardWrap[data-afterglow="true"] .tile{animation:rebuildTile 620ms cubic-bezier(.18,.9,.22,1.2) both!important;animation-delay:var(--tile-delay,0ms)!important}
.boardWrap[data-afterglow="true"]::before{content:"";position:absolute;z-index:15;inset:24px 1.5% 0;pointer-events:none;border:2px solid #fff36d;box-shadow:0 0 22px #63efff,inset 0 0 18px rgba(255,103,216,.32);animation:rebuildFrame 1.12s steps(8,end) forwards}
@keyframes rebuildAfterglow{0%{filter:brightness(1.9) saturate(1.6)}32%{filter:brightness(1.25) saturate(1.34)}100%{filter:none}}
@keyframes rebuildTile{0%{opacity:.25;transform:translateY(-24px) scale(.9);filter:brightness(2.1)}56%{opacity:1;transform:translateY(3px) scale(1.04)}78%{transform:translateY(-2px) scale(.985)}100%{transform:none;filter:none}}
@keyframes rebuildFrame{0%{opacity:1;transform:scale(.96);filter:brightness(2.2)}62%{opacity:.72;transform:scale(1.01)}100%{opacity:0;transform:scale(1.035)}}

/* Two extra depth planes: a far horizon and a slow prism veil. */
.backFx>i:nth-child(3){left:-25%;right:-25%;top:31%;height:2px;background:linear-gradient(90deg,transparent,#63efff 18%,#fff36d 50%,#ff68d4 82%,transparent);opacity:.3;box-shadow:0 0 12px currentColor;animation:horizonBreath 2.4s steps(8,end) infinite}
.backFx>span{position:absolute;left:50%;top:41%;width:120%;height:48%;transform:translate(-50%,-50%) perspective(240px) rotateX(62deg);background:repeating-radial-gradient(ellipse at center,transparent 0 25px,rgba(102,235,255,.055) 26px 27px,transparent 28px 48px);opacity:.7;animation:depthPulse 3.8s steps(12,end) infinite;pointer-events:none}
@keyframes horizonBreath{50%{opacity:.62;transform:scaleX(.82);filter:brightness(1.5)}}
@keyframes depthPulse{50%{transform:translate(-50%,-50%) perspective(240px) rotateX(62deg) scale(1.08);opacity:.95}}
.shell[data-hype="max"] .backFx>span,.final .backFx>span{animation-duration:1.2s;opacity:1}.final .backFx>i:nth-child(3){animation-duration:.64s;opacity:.72}

@media(max-height:700px){.pressed{transform:translateY(3px) scale(.95)!important}.boardWrap[data-afterglow="true"]::before{inset:21px 2% 0}}
@media(prefers-reduced-motion:reduce){.pressed{transform:none!important}.boardWrap[data-phase="burst"] .board,.scorePop::before,.scorePop::after,.boardWrap[data-afterglow="true"] .board,.boardWrap[data-afterglow="true"] .tile,.boardWrap[data-afterglow="true"]::before,.backFx>i:nth-child(3),.backFx>span{animation:none!important}}
'''
c.write_text(cs)
