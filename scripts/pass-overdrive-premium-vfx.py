from pathlib import Path

p = Path('app/PrismOverdrive.tsx')
s = p.read_text()

def rep(old: str, new: str, label: str):
    global s
    if old not in s:
        raise SystemExit(f'MISSING {label}')
    s = s.replace(old, new, 1)

rep('''  columns: number[];\n  mega?: boolean;\n};''','''  columns: number[];\n  mega?: boolean;\n  links?: Array<{ x1: number; y1: number; x2: number; y2: number }>;\n};''','board links type')

rep('''function fxAnchor(items: Tile[]) {\n  if (!items.length) return { x: 50, y: 50, columns: [] as number[] };\n  const x = items.reduce((sum, tile) => sum + tile.col + 0.5, 0) / items.length / SIZE * 100;\n  const y = items.reduce((sum, tile) => sum + tile.row + 0.5, 0) / items.length / SIZE * 100;\n  const columns = [...new Set(items.map((tile) => tile.col))].sort((a, b) => a - b);\n  return { x, y, columns };\n}\n''','''function fxAnchor(items: Tile[]) {\n  if (!items.length) return { x: 50, y: 50, columns: [] as number[] };\n  const x = items.reduce((sum, tile) => sum + tile.col + 0.5, 0) / items.length / SIZE * 100;\n  const y = items.reduce((sum, tile) => sum + tile.row + 0.5, 0) / items.length / SIZE * 100;\n  const columns = [...new Set(items.map((tile) => tile.col))].sort((a, b) => a - b);\n  return { x, y, columns };\n}\n\nfunction fxLinks(items: Tile[]) {\n  const map = mapTiles(items);\n  const links: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];\n  for (const tile of items) {\n    for (const [row, col] of [[tile.row + 1, tile.col], [tile.row, tile.col + 1]]) {\n      if (!map.has(`${row}:${col}`)) continue;\n      links.push({\n        x1: (tile.col + 0.5) / SIZE * 100,\n        y1: (tile.row + 0.5) / SIZE * 100,\n        x2: (col + 0.5) / SIZE * 100,\n        y2: (row + 0.5) / SIZE * 100,\n      });\n    }\n  }\n  return links;\n}\n''','fx links helper')

rep('''      setBoardFx({ token: cascadeToken, kind: "cascade", phase: "lock", x: cascadeAnchor.x, y: cascadeAnchor.y, points: 0, chain: depth, count: auto.length, columns: cascadeAnchor.columns });''','''      setBoardFx({ token: cascadeToken, kind: "cascade", phase: "lock", x: cascadeAnchor.x, y: cascadeAnchor.y, points: 0, chain: depth, count: auto.length, columns: cascadeAnchor.columns, links: fxLinks(auto) });''','cascade lock links')
rep('''      setBoardFx({ token: cascadeToken + 100000, kind: "cascade", phase: "burst", x: cascadeAnchor.x, y: cascadeAnchor.y, points: Math.round(autoScore.points), chain: depth, count: auto.length, columns: cascadeAnchor.columns });''','''      setBoardFx({ token: cascadeToken + 100000, kind: "cascade", phase: "burst", x: cascadeAnchor.x, y: cascadeAnchor.y, points: Math.round(autoScore.points), chain: depth, count: auto.length, columns: cascadeAnchor.columns, links: fxLinks(auto) });''','cascade burst links')

rep('''      playSfx("stageClear");\n      playOverdriveSfx("jackpot", 1.35);\n      setBoardFx({ token: actionFxTokenRef.current++, kind: "jackpot", phase: "burst", x: 50, y: 50, points: Math.round(jackpotPoints), chain: 0, count: 36, columns: [0,1,2,3,4,5] });\n      await sleep(620);\n      currentTiles = makeBoard(); currentQueues = makeQueues();\n      setTiles(currentTiles); setQueues(currentQueues);\n      setJackpotFlash(false);''','''      playSfx("stageClear");\n      playOverdriveSfx("jackpot", 1.42);\n      const jackpotToken = actionFxTokenRef.current++;\n      setBoardFx({ token: jackpotToken, kind: "jackpot", phase: "burst", x: 50, y: 50, points: Math.round(jackpotPoints), chain: 0, count: 36, columns: [0,1,2,3,4,5] });\n      await sleep(680);\n      currentTiles = makeBoard(); currentQueues = makeQueues();\n      setTiles(currentTiles); setQueues(currentQueues);\n      setBoardFx({ token: jackpotToken + 200000, kind: "jackpot", phase: "drop", x: 50, y: 91, points: 0, chain: 0, count: 36, columns: [0,1,2,3,4,5] });\n      playOverdriveSfx("drop", 1.42);\n      await sleep(390);\n      setJackpotFlash(false);''','jackpot rebuild phase')

rep('''  return <main data-hype={combo >= 30 ? "max" : combo >= 15 ? "high" : combo >= 5 ? "mid" : "low"} className={`${styles.shell} ${feverActive ? styles.fever : ""} ${overFeverActive ? styles.overFever : ""} ${finalOverdrive ? styles.final : ""}`}>\n    <header className={styles.topbar}>''','''  return <main data-hype={combo >= 30 ? "max" : combo >= 15 ? "high" : combo >= 5 ? "mid" : "low"} className={`${styles.shell} ${feverActive ? styles.fever : ""} ${overFeverActive ? styles.overFever : ""} ${finalOverdrive ? styles.final : ""}`}>\n    <div className={styles.backFx} aria-hidden="true"><i /><i /><b /><u /></div>\n    <header className={styles.topbar}>''','background layer render')

rep('''    <section className={styles.boardWrap} data-impact={actionFx?.kind ?? "idle"}>''','''    <section className={styles.boardWrap} data-impact={actionFx?.kind ?? "idle"} data-jackpot={jackpotFlash ? "true" : "false"}>''','jackpot board attr')

rep('''          style={{ left: `calc(${tile.col * (100 / SIZE)}% + 1px)`, top: `calc(${tile.row * (100 / SIZE)}% + 1px)` }}''','''          style={{\n            left: `calc(${tile.col * (100 / SIZE)}% + 1px)`,\n            top: `calc(${tile.row * (100 / SIZE)}% + 1px)`,\n            animationDelay: boardFx?.phase === "drop" && boardFx.columns.includes(tile.col) ? `${tile.row * 22}ms` : undefined,\n          }}''','drop stagger style')

rep('''        {boardFx ? <div key={boardFx.token} className={styles.spatialFx} data-kind={boardFx.kind} data-phase={boardFx.phase} data-mega={boardFx.mega ? "true" : "false"} aria-hidden="true">\n          {boardFx.phase !== "drop" ? <>''','''        {boardFx ? <div key={boardFx.token} className={styles.spatialFx} data-kind={boardFx.kind} data-phase={boardFx.phase} data-mega={boardFx.mega ? "true" : "false"} data-chain={boardFx.chain} aria-hidden="true">\n          {boardFx.kind === "cascade" && boardFx.phase !== "drop" && boardFx.links?.length ? <svg className={styles.chainPath} viewBox="0 0 100 100" preserveAspectRatio="none">\n            {boardFx.links.map((link, index) => <line key={index} x1={link.x1} y1={link.y1} x2={link.x2} y2={link.y2} />)}\n          </svg> : null}\n          {boardFx.phase !== "drop" ? <>''','cascade path render')

p.write_text(s)

# Enrich jackpot sound with a second sparkling crest.
a = Path('app/gameAudio.ts')
g = a.read_text()
old = '''  if (name === "jackpot") {\n    arp([523, 659, 784, 1047, 1319, 1568, 2093], .045, .075 * k, "square");\n    tone(98, t, .22, .11 * k, "triangle");\n    tone(196, t + .12, .2, .095 * k, "triangle");\n    noise(t + .18, .12, .075 * k);\n    return;\n  }'''
new = '''  if (name === "jackpot") {\n    arp([523, 659, 784, 1047, 1319, 1568, 2093], .042, .078 * k, "square");\n    tone(98, t, .25, .12 * k, "triangle");\n    tone(196, t + .11, .22, .1 * k, "triangle");\n    sweep(240, 2480, t + .08, .28, .075 * k, "sawtooth");\n    arp([1047, 1319, 1568, 2093, 2637], .028, .045 * k, "triangle");\n    noise(t + .16, .15, .082 * k);\n    return;\n  }'''
if old not in g:
    raise SystemExit('MISSING jackpot audio')
g = g.replace(old, new, 1)
a.write_text(g)

c = Path('app/PrismOverdrive.module.css')
cs = c.read_text()
marker = '/* PASS 45 — PREMIUM PANEL / CHAIN / JACKPOT / BACKGROUND VFX */'
if marker not in cs:
    cs += r'''

/* PASS 45 — PREMIUM PANEL / CHAIN / JACKPOT / BACKGROUND VFX */
/* A separate ambient layer gives the mode depth while preserving a crisp board. */
.backFx{position:absolute;inset:0;z-index:-1;overflow:hidden;pointer-events:none;color:#56eaff}
.backFx>i,.backFx>b,.backFx>u{position:absolute;display:block;pointer-events:none}
.backFx>i:first-child{left:-20%;right:-20%;top:20%;height:48%;opacity:.18;background:repeating-conic-gradient(from 0deg at 50% 58%,transparent 0 8deg,currentColor 9deg 10deg,transparent 11deg 18deg);mask-image:linear-gradient(transparent,#000 32%,#000 74%,transparent);animation:backRotor 9s steps(18,end) infinite}
.backFx>i:nth-child(2){inset:42% -15% -10%;opacity:.24;background:repeating-linear-gradient(90deg,transparent 0 28px,rgba(83,232,255,.18) 29px 30px),repeating-linear-gradient(0deg,transparent 0 28px,rgba(83,232,255,.11) 29px 30px);transform:perspective(180px) rotateX(58deg);transform-origin:50% 100%;animation:gridFloor 1.6s steps(10,end) infinite}
.backFx>b{left:8%;top:17%;width:4px;height:4px;background:#fff;box-shadow:46px 22px #63ecff,102px -8px #fff36d,158px 34px #b26dff,214px 2px #63ecff,272px 28px #fff,318px -12px #ff7adf,350px 46px #63ecff,35px 116px #fff36d,126px 145px #63ecff,238px 124px #fff,332px 164px #b26dff;opacity:.42;animation:starDrive 1.2s steps(8,end) infinite}
.backFx>u{left:50%;top:52%;width:72%;aspect-ratio:1;border:1px solid rgba(97,238,255,.12);transform:translate(-50%,-50%) rotate(45deg);text-decoration:none;box-shadow:0 0 36px rgba(76,223,255,.08);animation:backDiamond 3.2s steps(12,end) infinite}
@keyframes backRotor{to{transform:rotate(1turn)}}
@keyframes gridFloor{to{background-position:30px 0,0 30px}}
@keyframes starDrive{50%{transform:translateY(8px);opacity:.7}}
@keyframes backDiamond{50%{transform:translate(-50%,-50%) rotate(135deg) scale(1.08);opacity:.55}}
.shell[data-hype="high"] .backFx,.shell[data-hype="max"] .backFx{color:#b16cff}.shell[data-hype="max"] .backFx>i:first-child{animation-duration:3.8s;opacity:.32}.shell[data-hype="max"] .backFx>i:nth-child(2){animation-duration:.72s;opacity:.38}
.fever .backFx{color:#62fff1}.overFever .backFx{color:#fff26b}.final .backFx{color:#ff68d4}.final .backFx>i:first-child{animation-duration:1.8s;opacity:.38}.final .backFx>i:nth-child(2){animation-duration:.38s;opacity:.46}.final .backFx>b{animation-duration:.44s;opacity:.85}

/* Panel motion language: subtle when idle, expressive only when the tile is involved. */
.tile::after{background-position:0 0;transition:opacity 120ms steps(3,end)}
.shell[data-hype="high"] .tile::after{animation:panelEnergy 1.2s steps(6,end) infinite}.shell[data-hype="max"] .tile::after,.fever .tile::after{animation:panelEnergy .62s steps(5,end) infinite}
@keyframes panelEnergy{50%{background-position:8px -8px;opacity:.92}}
.focused.attack b{animation:atkGlyph .28s steps(3,end) infinite alternate}.focused.heal b{animation:healGlyph .34s steps(3,end) infinite alternate}.focused.barrier b{animation:barGlyph .3s steps(3,end) infinite alternate}.focused.skip b{animation:skipGlyph .28s steps(4,end) infinite}
@keyframes atkGlyph{to{transform:scaleX(1.24) scaleY(.88) translateY(-2px);filter:brightness(1.7)}}
@keyframes healGlyph{to{transform:scale(1.22);filter:drop-shadow(0 0 7px #86ffd1)}}
@keyframes barGlyph{to{transform:rotate(45deg) scale(1.12);filter:drop-shadow(0 0 7px #6be4ff)}}
@keyframes skipGlyph{50%{transform:rotate(-10deg) scale(1.1)}100%{transform:rotate(10deg) scale(1.1)}}
.dropping{will-change:transform,filter}

/* AUTO CASCADE now visibly traces the exact connected route before breaking it. */
.chainPath{position:absolute;inset:0;width:100%;height:100%;z-index:2;overflow:visible;color:#a86cff;filter:drop-shadow(0 0 4px #5ff1ff);pointer-events:none}
.chainPath line{stroke:currentColor;stroke-width:2.3;vector-effect:non-scaling-stroke;stroke-linecap:square;stroke-dasharray:5 3;animation:chainCurrent 280ms steps(6,end) infinite}
.spatialFx[data-chain="2"] .chainPath{color:#6fefff}.spatialFx[data-chain="3"] .chainPath{color:#fff36d;filter:drop-shadow(0 0 6px #fff36d)}.spatialFx[data-chain="4"] .chainPath{color:#ff72d8;filter:drop-shadow(0 0 8px #ff72d8)}
@keyframes chainCurrent{to{stroke-dashoffset:-16}}

/* JACKPOT is a short board transformation, not a dark modal. */
.boardWrap[data-jackpot="true"] .board{animation:jackpotBoardWarp 680ms steps(7,end)!important;transform-origin:50% 50%}
.boardWrap[data-jackpot="true"] .tile{animation:jackpotTilePulse 340ms steps(4,end) infinite alternate!important}
.boardWrap[data-jackpot="true"]::after{content:"";position:absolute;z-index:16;inset:24px 1.5% 0;pointer-events:none;background:repeating-conic-gradient(from 0deg at 50% 50%,transparent 0 12deg,rgba(255,244,105,.18) 13deg 14deg,transparent 15deg 24deg);animation:jackpotLattice 680ms steps(9,end) forwards}
.jackpotFlash{background:radial-gradient(circle at 50% 50%,rgba(255,244,107,.18),rgba(101,34,146,.08) 42%,transparent 72%)!important}
.jackpotFlash span{font-size:10px;text-shadow:0 0 8px #72f6ff}.jackpotFlash strong{font-size:44px!important;text-shadow:4px 0 #8c2bd0,-4px 0 #8c2bd0,0 4px #8c2bd0,0 -4px #8c2bd0,0 0 18px #fff36d!important}
@keyframes jackpotBoardWarp{0%{transform:scale(1);filter:brightness(1)}18%{transform:scale(.965) rotate(-.45deg);filter:brightness(1.8)}42%{transform:scale(1.025) rotate(.45deg);filter:brightness(1.35) saturate(1.45)}68%{transform:scale(.985);filter:brightness(1.65)}100%{transform:scale(1);filter:none}}
@keyframes jackpotTilePulse{to{filter:brightness(1.7) saturate(1.45);box-shadow:inset 0 0 0 2px #fff,0 0 12px var(--edge)}}
@keyframes jackpotLattice{0%{opacity:0;transform:scale(.55) rotate(0)}22%{opacity:1}100%{opacity:0;transform:scale(1.32) rotate(18deg)}}

@media(max-height:700px){.backFx>i:first-child{top:18%;height:42%}.jackpotFlash strong{font-size:34px!important}.chainPath line{stroke-width:2}}
@media(prefers-reduced-motion:reduce){.backFx>i,.backFx>b,.backFx>u,.tile::after,.focused b,.chainPath line,.boardWrap[data-jackpot="true"] .board,.boardWrap[data-jackpot="true"] .tile,.boardWrap[data-jackpot="true"]::after{animation:none!important}}
'''
c.write_text(cs)
