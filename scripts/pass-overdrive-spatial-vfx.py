from pathlib import Path

repo = Path('.')
ts = repo / 'app/PrismOverdrive.tsx'
css = repo / 'app/PrismOverdrive.module.css'
audio = repo / 'app/gameAudio.ts'

s = ts.read_text()

def rep(old: str, new: str, label: str):
    global s
    if old not in s:
        raise SystemExit(f'MISSING {label}')
    s = s.replace(old, new, 1)

rep('''type ActionFx = {
  token: number;
  kind: PanelType | "cascade" | "upgrade";
  title: string;
  detail: string;
  icon: string;
};
''', '''type ActionFx = {
  token: number;
  kind: PanelType | "cascade" | "upgrade";
  title: string;
  detail: string;
  icon: string;
};
type BoardFx = {
  token: number;
  kind: PanelType | "cascade" | "jackpot";
  phase: "lock" | "burst" | "drop";
  x: number;
  y: number;
  points: number;
  chain: number;
  count: number;
  columns: number[];
};
''', 'BoardFx type')

rep('''function chooseUpgrades(owned: UpgradeId[]) {
  return UPGRADES.filter((upgrade) => !owned.includes(upgrade.id)).sort(() => Math.random() - 0.5).slice(0, 3);
}
''', '''function chooseUpgrades(owned: UpgradeId[]) {
  return UPGRADES.filter((upgrade) => !owned.includes(upgrade.id)).sort(() => Math.random() - 0.5).slice(0, 3);
}

function fxAnchor(items: Tile[]) {
  if (!items.length) return { x: 50, y: 50, columns: [] as number[] };
  const x = items.reduce((sum, tile) => sum + tile.col + 0.5, 0) / items.length / SIZE * 100;
  const y = items.reduce((sum, tile) => sum + tile.row + 0.5, 0) / items.length / SIZE * 100;
  const columns = [...new Set(items.map((tile) => tile.col))].sort((a, b) => a - b);
  return { x, y, columns };
}
''', 'fxAnchor helper')

rep('''  const [focusIds, setFocusIds] = useState<Set<number>>(new Set());
  const [actionFx, setActionFx] = useState<ActionFx | null>(null);
''', '''  const [focusIds, setFocusIds] = useState<Set<number>>(new Set());
  const [actionFx, setActionFx] = useState<ActionFx | null>(null);
  const [boardFx, setBoardFx] = useState<BoardFx | null>(null);
''', 'boardFx state')

rep('''    setClearingIds(new Set()); setFocusIds(new Set()); setActionFx(null);
''', '''    setClearingIds(new Set()); setFocusIds(new Set()); setActionFx(null); setBoardFx(null);
''', 'reset boardFx')

rep('''    if (count >= 10 && upgrades.includes("prismNuke")) addRandomIds(tiles, removed, 8);

    let fxTitle = "";
''', '''    if (count >= 10 && upgrades.includes("prismNuke")) addRandomIds(tiles, removed, 8);
    const removedTiles = tiles.filter((tile) => removed.has(tile.id));
    const impactAnchor = fxAnchor(removedTiles);

    let fxTitle = "";
''', 'initial anchor')

rep('''    setFocusIds(new Set(removed));
    setActionFx({ token: actionFxTokenRef.current++, kind: liveSeed.type, title: fxTitle, detail: fxDetail, icon: GLYPH[liveSeed.type] });
    await sleep(360);

    const scored = scoreCluster(liveSeed.type, removed.size, 0);
    let nextScore = addScore(scored.points, scored.rank);
''', '''    setFocusIds(new Set(removed));
    const actionToken = actionFxTokenRef.current++;
    setActionFx({ token: actionToken, kind: liveSeed.type, title: fxTitle, detail: fxDetail, icon: GLYPH[liveSeed.type] });
    setBoardFx({ token: actionToken, kind: liveSeed.type, phase: "lock", x: impactAnchor.x, y: impactAnchor.y, points: 0, chain: 0, count: removed.size, columns: impactAnchor.columns });
    await sleep(380);

    const scored = scoreCluster(liveSeed.type, removed.size, 0);
    let nextScore = addScore(scored.points, scored.rank);
    setBoardFx({ token: actionToken + 100000, kind: liveSeed.type, phase: "burst", x: impactAnchor.x, y: impactAnchor.y, points: Math.round(scored.points), chain: 0, count: removed.size, columns: impactAnchor.columns });
    await sleep(230);
''', 'player spatial fx')

rep('''    setTiles(currentTiles); setQueues(currentQueues); setClearingIds(new Set());
    setActionFx(null);
    await sleep(240);
''', '''    setTiles(currentTiles); setQueues(currentQueues); setClearingIds(new Set());
    setBoardFx({ token: actionToken + 200000, kind: liveSeed.type, phase: "drop", x: impactAnchor.x, y: 91, points: 0, chain: 0, count: removed.size, columns: impactAnchor.columns });
    setActionFx(null);
    playOverdriveSfx("drop", Math.min(1.35, .72 + removed.size * .045));
    await sleep(330);
    setBoardFx(null);
''', 'player drop fx')

rep('''      const autoScore = scoreCluster(autoType, auto.length, depth);
      setFocusIds(autoIds);
      setActionFx({ token: actionFxTokenRef.current++, kind: "cascade", title: `AUTO CASCADE → CHAIN ${depth}!`, detail: `${LABEL[autoType]} ×${auto.length} CONNECTED BY THE DROP`, icon: "↯" });
''', '''      const autoScore = scoreCluster(autoType, auto.length, depth);
      const cascadeAnchor = fxAnchor(auto);
      const cascadeToken = actionFxTokenRef.current++;
      setFocusIds(autoIds);
      setActionFx({ token: cascadeToken, kind: "cascade", title: `AUTO CASCADE → CHAIN ${depth}!`, detail: `${LABEL[autoType]} ×${auto.length} CONNECTED BY THE DROP`, icon: "↯" });
      setBoardFx({ token: cascadeToken, kind: "cascade", phase: "lock", x: cascadeAnchor.x, y: cascadeAnchor.y, points: 0, chain: depth, count: auto.length, columns: cascadeAnchor.columns });
''', 'cascade lock fx')

rep('''      nextScore = addScore(autoScore.points, `CHAIN ${depth}!`);
      setMessage(`CHAIN ${depth} SCORE +${Math.round(autoScore.points).toLocaleString()}`);
      addFever(auto.length * 2.4);
''', '''      nextScore = addScore(autoScore.points, `CHAIN ${depth}!`);
      setBoardFx({ token: cascadeToken + 100000, kind: "cascade", phase: "burst", x: cascadeAnchor.x, y: cascadeAnchor.y, points: Math.round(autoScore.points), chain: depth, count: auto.length, columns: cascadeAnchor.columns });
      setMessage(`CHAIN ${depth} SCORE +${Math.round(autoScore.points).toLocaleString()}`);
      addFever(auto.length * 2.4);
      await sleep(240);
''', 'cascade burst fx')

rep('''      currentTiles = settled.tiles; currentQueues = settled.queues;
      setTiles(currentTiles); setQueues(currentQueues); setClearingIds(new Set());
      await sleep(280);
''', '''      currentTiles = settled.tiles; currentQueues = settled.queues;
      setTiles(currentTiles); setQueues(currentQueues); setClearingIds(new Set());
      setBoardFx({ token: cascadeToken + 200000, kind: "cascade", phase: "drop", x: cascadeAnchor.x, y: 91, points: 0, chain: depth, count: auto.length, columns: cascadeAnchor.columns });
      playOverdriveSfx("drop", 0.9 + depth * .1);
      await sleep(350);
      setBoardFx(null);
''', 'cascade drop fx')

rep('''      playSfx("stageClear");
      playOverdriveSfx("jackpot", 1.35);
      await sleep(520);
''', '''      playSfx("stageClear");
      playOverdriveSfx("jackpot", 1.35);
      setBoardFx({ token: actionFxTokenRef.current++, kind: "jackpot", phase: "burst", x: 50, y: 50, points: Math.round(jackpotPoints), chain: 0, count: 36, columns: [0,1,2,3,4,5] });
      await sleep(620);
''', 'jackpot spatial fx')

rep('''    setActionFx(null);
    setFocusIds(new Set());
    await maybeOfferUpgrade(nextScore);
''', '''    setActionFx(null);
    setBoardFx(null);
    setFocusIds(new Set());
    await maybeOfferUpgrade(nextScore);
''', 'final boardFx clear')

rep('''  return <main className={`${styles.shell} ${feverActive ? styles.fever : ""} ${overFeverActive ? styles.overFever : ""} ${finalOverdrive ? styles.final : ""}`}>
''', '''  return <main data-hype={combo >= 30 ? "max" : combo >= 15 ? "high" : combo >= 5 ? "mid" : "low"} className={`${styles.shell} ${feverActive ? styles.fever : ""} ${overFeverActive ? styles.overFever : ""} ${finalOverdrive ? styles.final : ""}`}>
''', 'hype tier')

rep('''        ><b>{GLYPH[tile.type]}</b><span>{LABEL[tile.type]}</span></button>)}
      </div>
      {actionFx ? <div key={`burst-${actionFx.token}`} className={styles.boardBurst} data-kind={actionFx.kind} aria-hidden="true"><i /><b /><u /></div> : null}
''', '''        ><b>{GLYPH[tile.type]}</b><span>{LABEL[tile.type]}</span></button>)}
        {boardFx ? <div key={boardFx.token} className={styles.spatialFx} data-kind={boardFx.kind} data-phase={boardFx.phase} aria-hidden="true">
          {boardFx.phase !== "drop" ? <>
            <i className={styles.impactRing} style={{ left: `${boardFx.x}%`, top: `${boardFx.y}%` }} />
            <i className={styles.impactCore} style={{ left: `${boardFx.x}%`, top: `${boardFx.y}%` }} />
            <span className={styles.shardField} style={{ left: `${boardFx.x}%`, top: `${boardFx.y}%` }}>{Array.from({ length: 10 }, (_, index) => <i key={index} />)}</span>
            {boardFx.phase === "burst" && boardFx.points > 0 ? <strong className={styles.scorePop} style={{ left: `${boardFx.x}%`, top: `${boardFx.y}%` }}>+{boardFx.points.toLocaleString()}</strong> : null}
            {boardFx.chain > 0 ? <em className={styles.chainStamp} style={{ left: `${boardFx.x}%`, top: `${boardFx.y}%` }}>CHAIN {boardFx.chain}</em> : null}
          </> : null}
          {boardFx.phase === "drop" ? <span className={styles.dropField}>{boardFx.columns.map((column) => <i key={column} style={{ left: `${(column + 0.5) / SIZE * 100}%` }} />)}</span> : null}
        </div> : null}
      </div>
      {actionFx ? <div key={`burst-${actionFx.token}`} className={styles.boardBurst} data-kind={actionFx.kind} aria-hidden="true"><i /><b /><u /></div> : null}
''', 'spatial fx render')

ts.write_text(s)

c = css.read_text()
marker = '/* PASS 43 — SPATIAL IMPACT / DROP VFX */'
if marker not in c:
    c += r'''

/* PASS 43 — SPATIAL IMPACT / DROP VFX */
/* Transparent, coordinate-bound effects. They never hide the board state. */
.spatialFx{position:absolute;inset:0;z-index:18;pointer-events:none;overflow:hidden}
.impactRing,.impactCore{position:absolute;display:block;transform:translate(-50%,-50%);border-radius:50%;pointer-events:none}
.impactRing{width:18%;aspect-ratio:1;border:3px solid #fff;box-shadow:0 0 12px currentColor,inset 0 0 9px currentColor;animation:impactRingOut 430ms steps(5,end) forwards}
.impactCore{width:7%;aspect-ratio:1;background:#fff;box-shadow:0 0 18px 6px currentColor;animation:impactCorePop 280ms steps(4,end) forwards}
.spatialFx[data-kind="attack"]{color:#ff9a31}.spatialFx[data-kind="heal"]{color:#45f5ad}.spatialFx[data-kind="barrier"]{color:#4bddff}.spatialFx[data-kind="skip"]{color:#ffe96a}.spatialFx[data-kind="cascade"]{color:#b26dff}.spatialFx[data-kind="jackpot"]{color:#fff26b}
.spatialFx[data-phase="lock"] .impactRing{width:13%;animation:lockPulse 360ms steps(4,end) infinite}.spatialFx[data-phase="lock"] .impactCore{width:4%;opacity:.8;animation:lockCore 180ms steps(2,end) infinite alternate}
@keyframes lockPulse{50%{width:19%;border-color:currentColor;filter:brightness(2)}}
@keyframes lockCore{to{transform:translate(-50%,-50%) scale(1.7);filter:brightness(2.4)}}
@keyframes impactRingOut{0%{opacity:1;width:10%;border-width:5px}65%{opacity:.9;width:36%;border-width:3px}100%{opacity:0;width:62%;border-width:1px}}
@keyframes impactCorePop{0%{opacity:1;transform:translate(-50%,-50%) scale(.45)}45%{opacity:1;transform:translate(-50%,-50%) scale(1.9)}100%{opacity:0;transform:translate(-50%,-50%) scale(3.3)}}
.shardField{position:absolute;width:1px;height:1px;pointer-events:none}.shardField i{position:absolute;left:-3px;top:-3px;width:7px;height:7px;background:currentColor;box-shadow:0 0 7px currentColor;animation:shardFly 360ms steps(4,end) forwards}.shardField i:nth-child(1){--sx:42px;--sy:-8px}.shardField i:nth-child(2){--sx:31px;--sy:31px}.shardField i:nth-child(3){--sx:2px;--sy:44px}.shardField i:nth-child(4){--sx:-34px;--sy:29px}.shardField i:nth-child(5){--sx:-46px;--sy:-5px}.shardField i:nth-child(6){--sx:-28px;--sy:-37px}.shardField i:nth-child(7){--sx:4px;--sy:-48px}.shardField i:nth-child(8){--sx:34px;--sy:-33px}.shardField i:nth-child(9){--sx:18px;--sy:50px}.shardField i:nth-child(10){--sx:-14px;--sy:49px}@keyframes shardFly{0%{opacity:1;transform:translate(0,0) scale(1.2)}75%{opacity:1;transform:translate(var(--sx),var(--sy)) rotate(90deg) scale(.8)}100%{opacity:0;transform:translate(calc(var(--sx)*1.25),calc(var(--sy)*1.25)) rotate(180deg) scale(.2)}}
.scorePop{position:absolute;z-index:4;transform:translate(-50%,-50%);font-size:clamp(15px,5.5vw,26px);line-height:1;color:#fff;text-shadow:3px 3px #000,-2px 0 currentColor,2px 0 currentColor,0 -2px currentColor,0 2px currentColor;white-space:nowrap;animation:scoreLaunch 560ms steps(6,end) forwards}@keyframes scoreLaunch{0%{opacity:0;transform:translate(-50%,-20%) scale(.65)}24%{opacity:1;transform:translate(-50%,-75%) scale(1.22)}72%{opacity:1;transform:translate(-50%,-120%) scale(1)}100%{opacity:0;transform:translate(-50%,-175%) scale(.92)}}
.chainStamp{position:absolute;z-index:5;transform:translate(-50%,70%);font-style:normal;font-weight:1000;font-size:clamp(10px,3.6vw,16px);letter-spacing:.12em;color:#fff578;text-shadow:2px 2px #000,0 0 8px #b76bff;white-space:nowrap;animation:chainStamp 500ms steps(5,end) forwards}@keyframes chainStamp{0%{opacity:0;transform:translate(-50%,70%) scale(.5)}35%{opacity:1;transform:translate(-50%,72%) scale(1.18)}100%{opacity:0;transform:translate(-50%,115%) scale(1)}}
.dropField{position:absolute;inset:0;display:block}.dropField i{position:absolute;top:-18%;width:6px;height:55%;transform:translateX(-50%);background:linear-gradient(180deg,transparent,currentColor 55%,#fff 88%,transparent);filter:drop-shadow(0 0 4px currentColor);animation:dropTrace 330ms steps(6,end) forwards}.dropField i::after{content:"";position:absolute;left:50%;bottom:-28%;width:34px;height:10px;border:2px solid currentColor;border-radius:50%;transform:translateX(-50%);animation:landRing 330ms steps(4,end) forwards}@keyframes dropTrace{0%{opacity:0;transform:translate(-50%,-25%)}15%{opacity:1}80%{opacity:1;transform:translate(-50%,118%)}100%{opacity:0;transform:translate(-50%,145%)}}@keyframes landRing{0%,60%{opacity:0;transform:translateX(-50%) scale(.3)}78%{opacity:1;transform:translateX(-50%) scale(1.1)}100%{opacity:0;transform:translateX(-50%) scale(1.8)}}

/* Hype tiers make the cabinet itself feel increasingly unstable without obscuring tiles. */
.shell[data-hype="mid"] .board{box-shadow:0 0 0 2px #000,inset 0 0 0 2px #152c42,0 0 30px rgba(78,224,255,.38)}
.shell[data-hype="high"] .board{animation:cabinetCharge 950ms steps(3,end) infinite;box-shadow:0 0 0 2px #000,inset 0 0 0 2px #253653,0 0 34px rgba(177,91,255,.48)}
.shell[data-hype="max"] .board{animation:cabinetCharge 520ms steps(3,end) infinite;box-shadow:0 0 0 2px #000,inset 0 0 0 2px #fff578,0 0 42px rgba(255,245,120,.56)}
.shell[data-hype="high"]::after,.shell[data-hype="max"]::after{animation:gridDrive 650ms steps(5,end) infinite}.shell[data-hype="max"]::after{animation-duration:360ms}
@keyframes cabinetCharge{50%{filter:brightness(1.12);transform:scale(1.003)}}@keyframes gridDrive{50%{opacity:.7;transform:translateY(2px)}}

/* Different impact families get different shard silhouettes. */
.spatialFx[data-kind="attack"] .shardField i{width:9px;height:5px;transform:skewX(-22deg)}
.spatialFx[data-kind="heal"] .shardField i{width:6px;height:6px;border-radius:50%}
.spatialFx[data-kind="barrier"] .shardField i{width:6px;height:9px;transform:rotate(45deg)}
.spatialFx[data-kind="skip"] .shardField i{width:8px;height:3px}
.spatialFx[data-kind="cascade"] .impactRing{border-style:double;border-width:5px}.spatialFx[data-kind="cascade"] .shardField i:nth-child(even){background:#68efff}.spatialFx[data-kind="cascade"] .shardField i:nth-child(odd){background:#fff578}
.spatialFx[data-kind="jackpot"] .impactRing{width:20%;border-width:6px;animation-duration:620ms}.spatialFx[data-kind="jackpot"] .impactCore{width:11%;animation-duration:480ms}.spatialFx[data-kind="jackpot"] .shardField i{background:#fff578;box-shadow:0 0 10px #fff578}

@media(max-height:700px){.scorePop{font-size:17px}.chainStamp{font-size:11px}.dropField i{height:48%}}
@media(prefers-reduced-motion:reduce){.impactRing,.impactCore,.shardField i,.scorePop,.chainStamp,.dropField i,.dropField i::after{animation-duration:1ms!important}.shell[data-hype="high"] .board,.shell[data-hype="max"] .board,.shell[data-hype="high"]::after,.shell[data-hype="max"]::after{animation:none!important}}
'''
css.write_text(c)

a = audio.read_text()
old = 'export type OverdriveSfx = "attack" | "cascade" | "fever" | "jackpot" | "upgrade";'
new = 'export type OverdriveSfx = "attack" | "cascade" | "fever" | "jackpot" | "upgrade" | "drop";'
if old not in a:
    raise SystemExit('MISSING OverdriveSfx union')
a = a.replace(old, new, 1)
old2 = '''  if (name === "cascade") {
    arp([659, 784, 988, 1175, 1568, 1976], .026, .055 * k, "square");
    sweep(220, 1320, t + .06, .13, .055 * k, "sawtooth");
    noise(t + .11, .045, .03 * k);
    return;
  }
'''
new2 = '''  if (name === "cascade") {
    const pitch = .88 + k * .22;
    arp([659, 784, 988, 1175, 1568, 1976].map((note) => note * pitch), .026, .055 * k, "square");
    sweep(220 * pitch, 1320 * pitch, t + .06, .13, .055 * k, "sawtooth");
    tone(92 * pitch, t + .09, .11, .065 * k, "triangle");
    noise(t + .11, .045, .03 * k);
    return;
  }
  if (name === "drop") {
    const pitch = .9 + k * .12;
    sweep(980 * pitch, 180 * pitch, t, .085, .035 * k, "triangle");
    tone(120 * pitch, t + .07, .055, .055 * k, "triangle");
    noise(t + .065, .035, .022 * k);
    return;
  }
'''
if old2 not in a:
    raise SystemExit('MISSING cascade audio block')
a = a.replace(old2, new2, 1)
audio.write_text(a)
