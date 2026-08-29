from pathlib import Path

TSX=Path('app/PrismOverdrive.tsx')
CSS=Path('app/PrismOverdrive.module.css')
AUDIO=Path('app/gameAudio.ts')

def repl(path, old, new):
    text=path.read_text()
    if old not in text:
        raise SystemExit(f'anchor missing in {path}: {old[:120]!r}')
    path.write_text(text.replace(old,new,1))

# Types and helpers.
repl(TSX,
'''type ChargeMap = Record<PanelType, number>;''',
'''type ChargeMap = Record<PanelType, number>;
type RoutePlan = { ids: number[]; projected: number; type: PanelType; column: number } | null;''')

repl(TSX,
'''function pickScanColumn(queues: PanelType[][], target: PrismTarget) {
  const wanted = desiredTargetType(target);
  if (wanted) {
    const matches = queues.map((queue, col) => queue[0] === wanted ? col : -1).filter((col) => col >= 0);
    if (matches.length) return matches[Math.floor(Math.random() * matches.length)]!;
  }
  return Math.floor(Math.random() * SIZE);
}
''',
'''function pickScanColumn(queues: PanelType[][], target: PrismTarget) {
  const wanted = desiredTargetType(target);
  if (wanted) {
    const matches = queues.map((queue, col) => queue[0] === wanted ? col : -1).filter((col) => col >= 0);
    if (matches.length) return matches[Math.floor(Math.random() * matches.length)]!;
  }
  return Math.floor(Math.random() * SIZE);
}

function forecastRoute(tiles: Tile[], queues: PanelType[][], scanColumn: number): RoutePlan {
  const scanType = queues[scanColumn]?.[0];
  if (!scanType) return null;
  const seen = new Set<number>();
  let best: RoutePlan = null;
  for (const tile of tiles) {
    if (seen.has(tile.id)) continue;
    const group = connectedGroup(tiles, tile);
    group.forEach((item) => seen.add(item.id));
    const removedInScan = group.filter((item) => item.col === scanColumn);
    if (removedInScan.length !== 1) continue;
    const removed = new Set(group.map((item) => item.id));
    const preview: Tile[] = [];
    for (let col = 0; col < SIZE; col += 1) {
      const survivors = tiles.filter((item) => item.col === col && !removed.has(item.id)).sort((a,b)=>b.row-a.row);
      survivors.forEach((item, index) => preview.push({ ...item, row: SIZE - 1 - index }));
    }
    preview.push({ id: -1000 - tile.id, type: scanType, row: 0, col: scanColumn });
    const landing = preview[preview.length - 1]!;
    const projected = connectedGroup(preview, landing).length;
    if (projected < 3) continue;
    if (!best || projected > best.projected || (projected === best.projected && group.length < best.ids.length)) {
      best = { ids: group.map((item) => item.id), projected, type: scanType, column: scanColumn };
    }
  }
  return best;
}
''')

# State + refs.
repl(TSX,
'''  const [targetPulse, setTargetPulse] = useState(false);''',
'''  const [targetPulse, setTargetPulse] = useState(false);
  const [missionStreak, setMissionStreak] = useState(0);
  const [bossCoreHp, setBossCoreHp] = useState(0);
  const [bossCoreMax, setBossCoreMax] = useState(0);
  const [bossBreaks, setBossBreaks] = useState(0);
  const [routePulse, setRoutePulse] = useState(false);''')

repl(TSX,
'''  const targetTokenRef = useRef(2);''',
'''  const targetTokenRef = useRef(2);
  const missionStreakRef = useRef(0);
  const bossCoreHpRef = useRef(0);
  const bossCoreMaxRef = useRef(0);
  const bossBreaksRef = useRef(0);''')

# Combo break resets mission streak when no boss is active.
repl(TSX,
'''          setMessage("COMBO BROKE • CASH OUT EARLIER OR KEEP THE CHAIN ALIVE");
          playOverdriveSfx("cash", .62);''',
'''          setMessage("COMBO BROKE • CASH OUT EARLIER OR KEEP THE CHAIN ALIVE");
          if (bossCoreHpRef.current <= 0 && missionStreakRef.current > 0) {
            missionStreakRef.current = 0;
            setMissionStreak(0);
          }
          playOverdriveSfx("cash", .62);''')

# Mission/Boss Core functions inserted before rollTarget.
repl(TSX,
'''  function rollTarget(nextQueues: PanelType[][] = queues) {''',
'''  function spawnBossCore() {
    const hp = 4 + Math.min(2, phaseIndex(phaseRef.current));
    bossCoreMaxRef.current = hp;
    bossCoreHpRef.current = hp;
    setBossCoreMax(hp);
    setBossCoreHp(hp);
    missionStreakRef.current = 0;
    setMissionStreak(0);
    const token = actionFxTokenRef.current++;
    setModeFx({ token, kind: "overdrive", title: "BOSS CORE ONLINE", detail: `${hp} ARMOR • RELEASE / ROUTE / CHAIN 2+` });
    setLastRank(`BOSS CORE • HP ${hp}`);
    setMessage("BREAK THE CORE WITH CHARGE RELEASE • PLANNED ROUTE • CHAIN 2+");
    playOverdriveSfx("boss", 1.06 + phaseIndex(phaseRef.current) * .08);
    window.setTimeout(() => setModeFx((value) => value?.token === token ? null : value), 980);
  }

  function damageBossCore(reason: string, amount = 1) {
    if (bossCoreHpRef.current <= 0) return false;
    const next = Math.max(0, bossCoreHpRef.current - amount);
    bossCoreHpRef.current = next;
    setBossCoreHp(next);
    if (next > 0) {
      setLastRank(`CORE HIT • ${reason} • HP ${next}/${bossCoreMaxRef.current}`);
      setMessage(`BOSS CORE DAMAGED • ${reason}`);
      playOverdriveSfx("boss", .82 + (bossCoreMaxRef.current - next) * .08);
      return true;
    }
    const bonus = Math.round((9000 + phaseIndex(phaseRef.current) * 4500) * PHASE_META[phaseRef.current].score);
    addScore(bonus, `BOSS CORE BREAK +${bonus.toLocaleString()}`);
    addFever(34);
    const core = Math.min(3, jackpotRef.current + 1);
    jackpotRef.current = core;
    setJackpot(core);
    const boosted = { ...chargeRef.current };
    TYPES.forEach((type) => { boosted[type] = clamp(boosted[type] + 20, 0, 100); });
    chargeRef.current = boosted;
    setCharge(boosted);
    bossBreaksRef.current += 1;
    setBossBreaks(bossBreaksRef.current);
    const token = actionFxTokenRef.current++;
    setModeFx({ token, kind: "overdrive", title: "BOSS CORE BREAK", detail: `+${bonus.toLocaleString()} • ALL CHARGE +20 • CORE +1` });
    setLastRank("BOSS CORE DESTROYED!");
    setMessage("MID-RUN OBJECTIVE CLEARED • PRISM POWER SURGE");
    playOverdriveSfx("boss", 1.42);
    window.setTimeout(() => setModeFx((value) => value?.token === token ? null : value), 1050);
    return true;
  }

  function rollTarget(nextQueues: PanelType[][] = queues) {''')

# Target completion grows mission streak or keeps target loop during boss.
repl(TSX,
'''    setTargetPulse(true);
    setMessage(`TARGET CLEAR • +${reward.toLocaleString()} • PRISM CORE +1`);
    playOverdriveSfx("target", 1.08 + phaseIndex(phaseRef.current) * .08);
    window.setTimeout(() => setTargetPulse(false), 620);
    rollTarget(nextQueues);''',
'''    setTargetPulse(true);
    if (bossCoreHpRef.current <= 0) {
      const streak = missionStreakRef.current + 1;
      missionStreakRef.current = streak;
      setMissionStreak(streak);
      if (streak >= 3) spawnBossCore();
      else setMessage(`TARGET CLEAR • +${reward.toLocaleString()} • MISSION STREAK ${streak}/3`);
    } else {
      setMessage(`TARGET CLEAR • +${reward.toLocaleString()} • BOSS CORE ACTIVE`);
    }
    playOverdriveSfx("target", 1.08 + phaseIndex(phaseRef.current) * .08);
    window.setTimeout(() => setTargetPulse(false), 620);
    rollTarget(nextQueues);''')

# Reset new state.
repl(TSX,
'''    setScanColumn(pickScanColumn(nextQueues, firstTarget)); setTargetPulse(false);''',
'''    setScanColumn(pickScanColumn(nextQueues, firstTarget)); setTargetPulse(false); setRoutePulse(false);
    setMissionStreak(0); missionStreakRef.current = 0;
    setBossCoreHp(0); bossCoreHpRef.current = 0; setBossCoreMax(0); bossCoreMaxRef.current = 0;
    setBossBreaks(0); bossBreaksRef.current = 0;''')

# Cashout explicitly trades away target streak.
repl(TSX,
'''    comboExpireRef.current = 0;
    addScore(payout, `CASH OUT +${payout.toLocaleString()}`);''',
'''    comboExpireRef.current = 0;
    if (bossCoreHpRef.current <= 0) {
      missionStreakRef.current = 0;
      setMissionStreak(0);
    }
    addScore(payout, `CASH OUT +${payout.toLocaleString()}`);''')

# Route plan derived from live board.
repl(TSX,
'''  const scanType = queues[scanColumn]?.[0] ?? "attack";
  const cashValue = Math.round(comboBank * PHASE_META[runPhase].cash);''',
'''  const scanType = queues[scanColumn]?.[0] ?? "attack";
  const routePlan = useMemo(() => forecastRoute(tiles, queues, scanColumn), [tiles, queues, scanColumn]);
  const routeIds = useMemo(() => new Set(routePlan?.ids ?? []), [routePlan]);
  const cashValue = Math.round(comboBank * PHASE_META[runPhase].cash);''')

# Clear start captures whether this is the highlighted route.
repl(TSX,
'''    const group = connectedGroup(tiles, liveSeed);
    const count = group.length;
    const comboValue = bumpCombo(liveSeed.type, count);''',
'''    const group = connectedGroup(tiles, liveSeed);
    const count = group.length;
    const selectedRoute = routePlan && routePlan.ids.includes(liveSeed.id) ? routePlan : null;
    const comboValue = bumpCombo(liveSeed.type, count);''')

# Charge release can hit boss core.
repl(TSX,
'''      setLastRank(`CHARGE RELEASE ×${chargeMove.multiplier.toFixed(2)}`);
      playOverdriveSfx("target", 1.12);''',
'''      setLastRank(`CHARGE RELEASE ×${chargeMove.multiplier.toFixed(2)}`);
      damageBossCore("CHARGE RELEASE");
      playOverdriveSfx("target", 1.12);''')

# After settle, evaluate intentional scan route before cascade threshold.
repl(TSX,
'''    setBoardFx(null);

    const cascadeThreshold = clamp((performance.now() < feverUntilRef.current ? 4 : 6) - (upgrades.includes("chainReactor") ? 1 : 0) - PHASE_META[phaseRef.current].cascadeCut, 3, 6);''',
'''    setBoardFx(null);

    let routeBoost = 0;
    if (selectedRoute) {
      const landing = currentTiles.find((item) => item.col === selectedRoute.column && item.row === 0 && item.type === selectedRoute.type);
      const actual = landing ? connectedGroup(currentTiles, landing).length : 0;
      if (actual >= 3) {
        routeBoost = 1;
        const routeBonus = Math.round((600 + actual * 260) * PHASE_META[phaseRef.current].score);
        nextScore = addScore(routeBonus, `SCAN ROUTE +${routeBonus.toLocaleString()}`);
        addBank(routeBonus, comboRef.current, 1);
        setRoutePulse(true);
        setLastRank(`PLANNED ROUTE • ${LABEL[selectedRoute.type]} ×${actual}`);
        setMessage(`SCAN ROUTE CONNECTED • NEXT CASCADE THRESHOLD -1`);
        damageBossCore("PLANNED ROUTE");
        playOverdriveSfx("route", 1.04 + actual * .035);
        await sleep(260);
        setRoutePulse(false);
      }
    }

    const cascadeThreshold = clamp((performance.now() < feverUntilRef.current ? 4 : 6) - (upgrades.includes("chainReactor") ? 1 : 0) - PHASE_META[phaseRef.current].cascadeCut - routeBoost, 3, 6);''')

# Chain2+ damages boss.
repl(TSX,
'''      addBank(autoScore.points, comboRef.current, depth);
      advanceCascadeTarget(depth, currentQueues);''',
'''      addBank(autoScore.points, comboRef.current, depth);
      advanceCascadeTarget(depth, currentQueues);
      if (depth >= 2) damageBossCore(`CHAIN ${depth}`);''')

# Intro copy.
repl(TSX,
'''        <span>TARGET CLEAR = PRISM CORE</span><span>SCAN = ONE NEXT COLUMN</span>''',
'''        <span>TARGET ×3 = BOSS CORE</span><span>SCAN ROUTE = PLANNED CHAIN</span>''')

# Strategy UI includes mission strip and route info.
repl(TSX,
'''      <div className={styles.scanCard}><span>NEXT SCAN • COL {scanColumn + 1}</span><strong data-type={scanType}>{GLYPH[scanType]} {LABEL[scanType]}</strong><em>ONLY THIS COLUMN IS REVEALED</em></div>
      <button className={styles.cashOut} type="button" disabled={comboBank <= 0 || resolving} onClick={cashOut}><span>CASH OUT</span><strong>+{cashValue.toLocaleString()}</strong><em>{comboBank > 0 ? "SECURE • RESET COMBO" : "BUILD BANK WITH COMBO"}</em></button>
      <div className={styles.chargeRow} aria-label="Prism charge meters">''',
'''      <div className={styles.scanCard} data-route={routePlan ? "ready" : "none"}><span>NEXT SCAN • COL {scanColumn + 1}</span><strong data-type={scanType}>{GLYPH[scanType]} {LABEL[scanType]}</strong><em>{routePlan ? `ROUTE READY → ${LABEL[routePlan.type]} ×${routePlan.projected}` : "NO ROUTE • SHAPE THE COLUMN"}</em></div>
      <button className={styles.cashOut} type="button" disabled={comboBank <= 0 || resolving} onClick={cashOut}><span>CASH OUT</span><strong>+{cashValue.toLocaleString()}</strong><em>{comboBank > 0 ? "SECURE • RESET COMBO + STREAK" : "BUILD BANK WITH COMBO"}</em></button>
      <div className={styles.missionCard} data-boss={bossCoreHp > 0 ? "active" : "idle"}><span>{bossCoreHp > 0 ? "BOSS CORE" : "MISSION STREAK"}</span><strong>{bossCoreHp > 0 ? `HP ${bossCoreHp}/${bossCoreMax}` : `${"◆".repeat(missionStreak)}${"◇".repeat(3-missionStreak)}  ${missionStreak}/3`}</strong><em>{bossCoreHp > 0 ? "RELEASE • ROUTE • CHAIN 2+" : "3 TARGETS WITHOUT COMBO BREAK"}</em></div>
      <div className={styles.chargeRow} aria-label="Prism charge meters">''')

# Board/tiles route visual marker and pulse data.
repl(TSX,
'''    <section className={styles.boardWrap} data-impact={actionFx?.kind ?? "idle"} data-phase={boardFx?.phase ?? "idle"} data-chain={boardFx?.chain ?? 0} data-jackpot={jackpotFlash ? "true" : "false"} data-afterglow={jackpotAfterglow ? "true" : "false"}>''',
'''    <section className={styles.boardWrap} data-impact={actionFx?.kind ?? "idle"} data-phase={boardFx?.phase ?? "idle"} data-chain={boardFx?.chain ?? 0} data-jackpot={jackpotFlash ? "true" : "false"} data-afterglow={jackpotAfterglow ? "true" : "false"} data-route-pulse={routePulse ? "true" : "false"}>''')

repl(TSX,
'''          className={`${styles.tile} ${styles[tile.type]} ${focusIds.has(tile.id) ? styles.focused : ""} ${clearingIds.has(tile.id) ? styles.clearing : ""} ${boardFx?.phase === "drop" && boardFx.columns.includes(tile.col) ? styles.dropping : ""} ${pressedId === tile.id ? styles.pressed : ""}`}''',
'''          className={`${styles.tile} ${styles[tile.type]} ${focusIds.has(tile.id) ? styles.focused : ""} ${clearingIds.has(tile.id) ? styles.clearing : ""} ${boardFx?.phase === "drop" && boardFx.columns.includes(tile.col) ? styles.dropping : ""} ${pressedId === tile.id ? styles.pressed : ""} ${routeIds.has(tile.id) ? styles.routeReady : ""}`}''')

# Action idle copy and result includes boss breaks.
repl(TSX,
'''      {actionFx ? <div key={actionFx.token} className={styles.actionFx} data-kind={actionFx.kind} role="status">
        <i>{actionFx.icon}</i><strong>{actionFx.title}</strong><span>{actionFx.detail}</span>
      </div> : <div className={styles.actionIdle}><b>PLAN THE BREAK</b><span>CHARGE SMALL → HIT TARGET → RELEASE BIG → CASH OUT OR PUSH</span></div>}''',
'''      {actionFx ? <div key={actionFx.token} className={styles.actionFx} data-kind={actionFx.kind} role="status">
        <i>{actionFx.icon}</i><strong>{actionFx.title}</strong><span>{actionFx.detail}</span>
      </div> : <div className={styles.actionIdle}><b>{routePlan ? "ROUTE READY" : "PLAN THE BREAK"}</b><span>{routePlan ? `HIGHLIGHTED BREAK → SCANNED ${LABEL[routePlan.type]} ×${routePlan.projected}` : "CHARGE → TARGET ×3 → BOSS CORE → CASH OUT OR PUSH"}</span></div>}''')

repl(TSX,
'''<div><span>MAX COMBO <b>×{maxCombo}</b></span><span>OVERDRIVE <b>{runLevel}</b></span><span>HIGH SCORE <b>{Math.max(score, highScore).toLocaleString()}</b></span></div>''',
'''<div><span>MAX COMBO <b>×{maxCombo}</b></span><span>CORE BREAK <b>×{bossBreaks}</b></span><span>HIGH SCORE <b>{Math.max(score, highScore).toLocaleString()}</b></span></div>''')

# CSS for new fifth strategic item, route highlight, route/boss feedback.
CSS.write_text(CSS.read_text() + r'''

/* PASS 48 — PLANNED ROUTES / MISSION STREAK / BOSS CORE */
.strategyPanel{grid-template-columns:.72fr 1.30fr 1.06fr 1.04fr}
.missionCard{grid-column:1/-1!important;display:grid!important;grid-template-columns:70px 1fr auto;align-items:center;gap:5px!important;padding:3px 5px!important;border-color:#58417a!important;background:linear-gradient(90deg,#0b0716,#050a13)!important}
.missionCard span{font-size:5px!important}.missionCard strong{font-size:9px!important;color:#bf90ff;letter-spacing:.08em}.missionCard em{text-align:right}
.missionCard[data-boss="active"]{border-color:#ff714f!important;background:linear-gradient(90deg,#251009,#0c0812)!important;box-shadow:inset 0 0 0 1px #5b1d14,0 0 8px rgba(255,92,56,.24)}
.missionCard[data-boss="active"] strong{color:#ffbd55;text-shadow:0 0 6px #ff5c35}
.scanCard[data-route="ready"]{border-color:#58ffd1!important;background:#061912!important;box-shadow:inset 0 0 0 1px #184c3b,0 0 8px rgba(70,255,205,.18)}
.scanCard[data-route="ready"] em{color:#79ffd8!important;font-weight:900}
.routeReady{z-index:3;box-shadow:inset 0 0 0 2px #eafff8,inset 0 0 0 4px rgba(48,255,205,.28),0 0 9px #49ffd0!important}
.routeReady::before{content:"ROUTE"!important;position:absolute!important;left:2px!important;top:2px!important;right:auto!important;bottom:auto!important;width:auto!important;height:auto!important;padding:1px 2px!important;background:#02150f!important;border:1px solid #6affd6!important;color:#9affdf!important;font:1000 4px/1 monospace!important;opacity:1!important;transform:none!important;z-index:5!important;box-shadow:none!important}
.boardWrap[data-route-pulse="true"] .board{animation:routeBoardPulse 300ms steps(4,end)!important;box-shadow:0 0 0 2px #000,inset 0 0 0 3px #62ffd6,0 0 30px rgba(65,255,206,.58)!important}
@keyframes routeBoardPulse{0%{transform:scale(.994);filter:brightness(1.45)}55%{transform:scale(1.006)}100%{transform:none;filter:none}}
@media(max-height:700px){.missionCard{grid-template-columns:60px 1fr auto;padding:2px 4px!important}.missionCard strong{font-size:8px!important}.routeReady::before{font-size:3px!important}}
@media(prefers-reduced-motion:reduce){.boardWrap[data-route-pulse="true"] .board{animation:none!important}}
''')

# Dedicated route/core sounds.
repl(AUDIO,
'''export type OverdriveSfx = "attack" | "cascade" | "fever" | "jackpot" | "upgrade" | "drop" | "mega" | "final" | "tap" | "rebuild" | "target" | "cash";''',
'''export type OverdriveSfx = "attack" | "cascade" | "fever" | "jackpot" | "upgrade" | "drop" | "mega" | "final" | "tap" | "rebuild" | "target" | "cash" | "route" | "boss";''')

repl(AUDIO,
'''  if (name === "target") {''',
'''  if (name === "boss") {
    tone(55, t, .22, .12 * k, "triangle");
    sweep(110, 880, t, .18, .075 * k, "sawtooth");
    arp([196, 294, 392, 587, 784, 1175], .04, .055 * k, "square");
    noise(t + .08, .12, .07 * k);
    return;
  }
  if (name === "route") {
    arp([659, 784, 1047, 1319, 1568].map((note) => note * (.96 + k * .08)), .025, .046 * k, "triangle");
    sweep(300, 1520, t + .035, .12, .042 * k, "square");
    return;
  }
  if (name === "target") {''')

print('route/mission pass applied')
