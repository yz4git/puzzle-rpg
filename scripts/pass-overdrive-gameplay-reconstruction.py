from pathlib import Path

p = Path('app/PrismOverdrive.tsx')
s = p.read_text()

def rep(old: str, new: str, label: str):
    global s
    if old not in s:
        raise SystemExit(f'MISSING {label}')
    s = s.replace(old, new, 1)

# --- Strategic model types -------------------------------------------------
rep('''type ModeFx = {
  token: number;
  kind: "fever" | "overFever" | "final";
  title: string;
  detail: string;
};''','''type ModeFx = {
  token: number;
  kind: "fever" | "overFever" | "accel" | "overdrive" | "final";
  title: string;
  detail: string;
};
type RunPhase = "build" | "accel" | "overdrive" | "final";
type TargetKind = "color" | "sequence" | "cascade";
type PrismTarget = {
  token: number;
  kind: TargetKind;
  label: string;
  reward: number;
  type?: PanelType;
  need?: number;
  sequence?: [PanelType, PanelType];
  progress: number;
};
type ChargeMap = Record<PanelType, number>;''','strategic types')

rep('''const HIGH_SCORE_KEY = "puzzle-rpg:prism-overdrive:high-score:v1";''','''const HIGH_SCORE_KEY = "puzzle-rpg:prism-overdrive:high-score:v1";
const PHASE_META: Record<RunPhase, { label: string; note: string; score: number; charge: number; cascadeCut: number; cascadeCap: number; cash: number }> = {
  build: { label: "BUILD", note: "MAKE CHARGE", score: 1, charge: 1, cascadeCut: 0, cascadeCap: 4, cash: 1 },
  accel: { label: "ACCEL", note: "FASTER LINKS", score: 1.15, charge: 1.25, cascadeCut: 1, cascadeCap: 4, cash: 1.08 },
  overdrive: { label: "OVERDRIVE", note: "CHAIN FIELD", score: 1.35, charge: 1.55, cascadeCut: 2, cascadeCap: 5, cash: 1.18 },
  final: { label: "FINAL", note: "NO LIMIT", score: 1.65, charge: 2, cascadeCut: 3, cascadeCap: 6, cash: 1.35 },
};
const emptyCharge = (): ChargeMap => ({ attack: 0, heal: 0, barrier: 0, skip: 0 });

function phaseForTime(timeLeft: number): RunPhase {
  if (timeLeft > 120_000) return "build";
  if (timeLeft > 60_000) return "accel";
  if (timeLeft > 30_000) return "overdrive";
  return "final";
}

function phaseIndex(phase: RunPhase) {
  return phase === "build" ? 0 : phase === "accel" ? 1 : phase === "overdrive" ? 2 : 3;
}

function targetProgressText(target: PrismTarget) {
  if (target.kind === "sequence") return target.progress > 0 ? "1 / 2 • NEXT STEP" : "0 / 2 • START";
  if (target.kind === "cascade") return `CHAIN ${target.need}+`;
  return `${LABEL[target.type ?? "attack"]} ×${target.need}+`;
}

function desiredTargetType(target: PrismTarget): PanelType | null {
  if (target.kind === "color") return target.type ?? null;
  if (target.kind === "sequence" && target.sequence) return target.sequence[target.progress > 0 ? 1 : 0];
  return null;
}

function makeTarget(phase: RunPhase, token: number): PrismTarget {
  const idx = phaseIndex(phase);
  const reward = [1800, 2800, 4200, 6200][idx]!;
  const roll = Math.random();
  if (roll < 0.46) {
    const type = TYPES[Math.floor(Math.random() * TYPES.length)]!;
    const need = 6 + Math.min(2, idx);
    return { token, kind: "color", label: `${LABEL[type]} ×${need}+ BREAK`, reward, type, need, progress: 0 };
  }
  if (roll < 0.78) {
    const first = TYPES[Math.floor(Math.random() * TYPES.length)]!;
    let second = TYPES[Math.floor(Math.random() * TYPES.length)]!;
    if (second === first) second = TYPES[(TYPES.indexOf(first) + 1) % TYPES.length]!;
    return { token, kind: "sequence", label: `${LABEL[first]} → ${LABEL[second]}`, reward: Math.round(reward * 1.15), sequence: [first, second], progress: 0 };
  }
  const need = idx >= 2 ? 2 : 2;
  return { token, kind: "cascade", label: `AUTO CHAIN ${need}+`, reward: Math.round(reward * 1.25), need, progress: 0 };
}

function pickScanColumn(queues: PanelType[][], target: PrismTarget) {
  const wanted = desiredTargetType(target);
  if (wanted) {
    const matches = queues.map((queue, col) => queue[0] === wanted ? col : -1).filter((col) => col >= 0);
    if (matches.length) return matches[Math.floor(Math.random() * matches.length)]!;
  }
  return Math.floor(Math.random() * SIZE);
}''','strategic constants')

# --- Phase-sensitive drops ------------------------------------------------
rep('''function randomType(fever = false): PanelType {
  const r = Math.random();
  if (fever) {
    if (r < 0.38) return "attack";
    if (r < 0.70) return "heal";
    return "skip";
  }
  if (r < 0.34) return "attack";
  if (r < 0.58) return "heal";
  if (r < 0.82) return "barrier";
  return "skip";
}''','''function randomType(fever = false, phase: RunPhase = "build"): PanelType {
  const r = Math.random();
  if (fever) {
    if (r < 0.40) return "attack";
    if (r < 0.72) return "heal";
    return "skip";
  }
  if (phase === "final") {
    if (r < 0.46) return "attack";
    if (r < 0.76) return "heal";
    if (r < 0.84) return "barrier";
    return "skip";
  }
  if (phase === "overdrive") {
    if (r < 0.42) return "attack";
    if (r < 0.70) return "heal";
    if (r < 0.82) return "barrier";
    return "skip";
  }
  if (phase === "accel") {
    if (r < 0.38) return "attack";
    if (r < 0.63) return "heal";
    if (r < 0.83) return "barrier";
    return "skip";
  }
  if (r < 0.34) return "attack";
  if (r < 0.58) return "heal";
  if (r < 0.82) return "barrier";
  return "skip";
}''','phase random type')
rep('''function makeBoard(): Tile[] {''','''function makeBoard(phase: RunPhase = "build"): Tile[] {''','make board phase')
rep('''for (let col = 0; col < SIZE; col += 1) result.push({ id: nextId(), type: randomType(), row, col });''','''for (let col = 0; col < SIZE; col += 1) result.push({ id: nextId(), type: randomType(false, phase), row, col });''','make board random')
rep('''function makeQueues(): PanelType[][] {
  return Array.from({ length: SIZE }, () => [randomType(), randomType(), randomType()]);
}''','''function makeQueues(phase: RunPhase = "build"): PanelType[][] {
  return Array.from({ length: SIZE }, () => [randomType(false, phase), randomType(false, phase), randomType(false, phase)]);
}''','make queues phase')
rep('''function settleBoard(tiles: Tile[], queues: PanelType[][], removed: Set<number>, fever: boolean) {''','''function settleBoard(tiles: Tile[], queues: PanelType[][], removed: Set<number>, fever: boolean, phase: RunPhase = "build") {''','settle phase')
s = s.replace('randomType(fever));', 'randomType(fever, phase));')

# --- Runtime state ---------------------------------------------------------
rep('''  const [jackpotAfterglow, setJackpotAfterglow] = useState(false);''','''  const [jackpotAfterglow, setJackpotAfterglow] = useState(false);
  const [runPhase, setRunPhase] = useState<RunPhase>("build");
  const [charge, setCharge] = useState<ChargeMap>(() => emptyCharge());
  const [comboBank, setComboBank] = useState(0);
  const [target, setTarget] = useState<PrismTarget>(() => makeTarget("build", 1));
  const [scanColumn, setScanColumn] = useState(0);
  const [targetPulse, setTargetPulse] = useState(false);''','strategic state')
rep('''  const finalTriggeredRef = useRef(false);''','''  const finalTriggeredRef = useRef(false);
  const phaseRef = useRef<RunPhase>("build");
  const chargeRef = useRef<ChargeMap>(emptyCharge());
  const bankRef = useRef(0);
  const targetRef = useRef<PrismTarget>(target);
  const targetTokenRef = useRef(2);''','strategic refs')

# --- Timer: phase escalation + bank risk ---------------------------------
old_timer = '''      if (!finalTriggeredRef.current && timeRef.current <= FINAL_MS) {
        finalTriggeredRef.current = true;
        const token = actionFxTokenRef.current++;
        setModeFx({ token, kind: "final", title: "FINAL OVERDRIVE", detail: "30 SEC • LIMITER RELEASED" });
        setLastRank("FINAL OVERDRIVE • ×BOOST");
        playOverdriveSfx("final", 1.35);
        window.setTimeout(() => setModeFx((value) => value?.token === token ? null : value), 1050);
      }
      if (comboRef.current > 0 && current > comboExpireRef.current) {
        comboRef.current = 0;
        setCombo(0);
      }'''
new_timer = '''      const nextPhase = phaseForTime(timeRef.current);
      if (nextPhase !== phaseRef.current) announcePhase(nextPhase);
      if (comboRef.current > 0 && current > comboExpireRef.current) {
        comboRef.current = 0;
        setCombo(0);
        if (bankRef.current > 0) {
          const lost = bankRef.current;
          bankRef.current = 0;
          setComboBank(0);
          setLastRank(`BANK LOST • ${lost.toLocaleString()}`);
          setMessage("COMBO BROKE • CASH OUT EARLIER OR KEEP THE CHAIN ALIVE");
          playOverdriveSfx("cash", .62);
        }
      }'''
rep(old_timer, new_timer, 'timer phase bank')

rep('''  const finalOverdrive = screen === "running" && timeLeft <= FINAL_MS;
  const multiplier = 1 + Math.floor(combo / 5) + (upgrades.includes("scoreRush") ? 0.5 : 0) + (feverActive ? 2 : 0) + (overFeverActive ? 2 : 0) + (finalOverdrive ? 1 : 0);''','''  const finalOverdrive = screen === "running" && runPhase === "final";
  const multiplier = 1 + Math.floor(combo / 5) + (upgrades.includes("scoreRush") ? 0.5 : 0) + (feverActive ? 2 : 0) + (overFeverActive ? 2 : 0) + (finalOverdrive ? 1 : 0);''','phase final derived')

# --- Strategic helper functions inside component --------------------------
anchor = '''  function resetRun() {'''
helpers = '''  function announcePhase(nextPhase: RunPhase) {
    phaseRef.current = nextPhase;
    setRunPhase(nextPhase);
    const token = actionFxTokenRef.current++;
    if (nextPhase === "accel") {
      setModeFx({ token, kind: "accel", title: "ACCEL PHASE", detail: "DROP BIAS UP • CASCADE -1" });
      setLastRank("ACCEL • LINKS OPEN");
      setMessage("ACCEL • BUILD CHARGE FASTER • CASCADE THRESHOLD DOWN");
      playOverdriveSfx("target", .92);
    } else if (nextPhase === "overdrive") {
      setModeFx({ token, kind: "overdrive", title: "OVERDRIVE PHASE", detail: "CHAIN FIELD • SCORE ×1.35" });
      setLastRank("OVERDRIVE • CHAIN FIELD");
      setMessage("OVERDRIVE • BIG CLUSTERS FORM FASTER");
      playOverdriveSfx("fever", 1.12);
    } else if (nextPhase === "final") {
      finalTriggeredRef.current = true;
      setModeFx({ token, kind: "final", title: "FINAL OVERDRIVE", detail: "30 SEC • LIMITER RELEASED" });
      setLastRank("FINAL OVERDRIVE • ×BOOST");
      setMessage("FINAL • CHARGE ×2 • CASCADE THRESHOLD MINIMUM");
      playOverdriveSfx("final", 1.35);
    }
    window.setTimeout(() => setModeFx((value) => value?.token === token ? null : value), nextPhase === "final" ? 1050 : 880);
  }

  function setChargeValue(type: PanelType, value: number) {
    const next = { ...chargeRef.current, [type]: clamp(Math.round(value), 0, 100) };
    chargeRef.current = next;
    setCharge(next);
  }

  function manualCharge(type: PanelType, count: number) {
    const before = chargeRef.current[type];
    if (count <= 4) {
      const gain = Math.round((10 + count * 7) * PHASE_META[phaseRef.current].charge);
      setChargeValue(type, before + gain);
      return { multiplier: 1, gain, release: 0 };
    }
    if (before >= 8) {
      const releaseMult = 1 + before / 100 * (1.05 + phaseIndex(phaseRef.current) * .12);
      setChargeValue(type, 0);
      return { multiplier: releaseMult, gain: 0, release: before };
    }
    return { multiplier: 1, gain: 0, release: 0 };
  }

  function addBank(points: number, comboValue: number, chainDepth = 0) {
    const ratio = clamp(.18 + comboValue * .018 + chainDepth * .09, .18, .78);
    const gain = Math.max(1, Math.round(points * ratio));
    bankRef.current += gain;
    setComboBank(bankRef.current);
    return gain;
  }

  function cashOut() {
    if (screen !== "running" || resolvingRef.current || bankRef.current <= 0) return;
    primeAudio();
    const payout = Math.round(bankRef.current * PHASE_META[phaseRef.current].cash);
    bankRef.current = 0;
    setComboBank(0);
    comboRef.current = 0;
    setCombo(0);
    comboExpireRef.current = 0;
    addScore(payout, `CASH OUT +${payout.toLocaleString()}`);
    const token = actionFxTokenRef.current++;
    setActionFx({ token, kind: "upgrade", title: "BANK SECURED!", detail: `+${payout.toLocaleString()} • COMBO RESET`, icon: "◆$" });
    setMessage("SAFE SCORE LOCKED • START A NEW COMBO");
    playOverdriveSfx("cash", 1.18);
    window.setTimeout(() => setActionFx((value) => value?.token === token ? null : value), 650);
  }

  function rollTarget(nextQueues: PanelType[][] = queues) {
    const next = makeTarget(phaseRef.current, targetTokenRef.current++);
    targetRef.current = next;
    setTarget(next);
    setScanColumn(pickScanColumn(nextQueues, next));
  }

  function completeTarget(nextQueues: PanelType[][] = queues) {
    const completed = targetRef.current;
    const reward = completed.reward;
    addScore(reward, `PRISM TARGET +${reward.toLocaleString()}`);
    addFever(18 + phaseIndex(phaseRef.current) * 4);
    const core = Math.min(3, jackpotRef.current + 1);
    jackpotRef.current = core;
    setJackpot(core);
    setTargetPulse(true);
    setMessage(`TARGET CLEAR • +${reward.toLocaleString()} • PRISM CORE +1`);
    playOverdriveSfx("target", 1.08 + phaseIndex(phaseRef.current) * .08);
    window.setTimeout(() => setTargetPulse(false), 620);
    rollTarget(nextQueues);
  }

  function advanceManualTarget(type: PanelType, count: number, nextQueues: PanelType[][] = queues) {
    const active = targetRef.current;
    if (active.kind === "color") {
      if (active.type === type && count >= (active.need ?? 6)) completeTarget(nextQueues);
      return;
    }
    if (active.kind !== "sequence" || !active.sequence) return;
    const [first, second] = active.sequence;
    if (active.progress === 0) {
      if (type === first) {
        const next = { ...active, progress: 1 };
        targetRef.current = next;
        setTarget(next);
        setMessage(`TARGET STEP 1 • ${LABEL[first]} → NOW ${LABEL[second]}`);
      }
      return;
    }
    if (type === second) {
      completeTarget(nextQueues);
    } else {
      const nextProgress = type === first ? 1 : 0;
      const next = { ...active, progress: nextProgress };
      targetRef.current = next;
      setTarget(next);
    }
  }

  function advanceCascadeTarget(depth: number, nextQueues: PanelType[][]) {
    const active = targetRef.current;
    if (active.kind === "cascade" && depth >= (active.need ?? 2)) completeTarget(nextQueues);
  }

'''
if anchor not in s: raise SystemExit('MISSING reset anchor')
s = s.replace(anchor, helpers + anchor, 1)

# --- Reset strategic state -------------------------------------------------
rep('''    const board = makeBoard();
    const nextQueues = makeQueues();''','''    const board = makeBoard("build");
    const nextQueues = makeQueues("build");
    const firstTarget = makeTarget("build", 1);''','reset board')
rep('''    setPressedId(null); setJackpotAfterglow(false);
    setResolving(false); resolvingRef.current = false; setLastGain(0); setLastRank("");
    feverUntilRef.current = 0; overFeverUntilRef.current = 0; timeStopUntilRef.current = 0; comboExpireRef.current = 0; finalTriggeredRef.current = false;''','''    setPressedId(null); setJackpotAfterglow(false);
    setRunPhase("build"); phaseRef.current = "build";
    const blankCharge = emptyCharge(); setCharge(blankCharge); chargeRef.current = blankCharge;
    setComboBank(0); bankRef.current = 0;
    setTarget(firstTarget); targetRef.current = firstTarget; targetTokenRef.current = 2;
    setScanColumn(pickScanColumn(nextQueues, firstTarget)); setTargetPulse(false);
    setResolving(false); resolvingRef.current = false; setLastGain(0); setLastRank("");
    feverUntilRef.current = 0; overFeverUntilRef.current = 0; timeStopUntilRef.current = 0; comboExpireRef.current = 0; finalTriggeredRef.current = false;''','reset strategy')
rep('''    setMessage("BREAK CLUSTERS • KEEP THE COMBO ALIVE");''','''    setMessage("SMALL BREAK = CHARGE • BIG BREAK = RELEASE • TARGET = CORE");''','reset message')

# --- Phase-scored gameplay -------------------------------------------------
rep('''  function scoreCluster(type: PanelType, count: number, chainDepth: number) {''','''  function scoreCluster(type: PanelType, count: number, chainDepth: number, chargeMultiplier = 1) {''','score signature')
rep('''    let base = count * count * 12 * (1 + chainDepth * 0.35);''','''    let base = count * count * 12 * (1 + chainDepth * 0.35) * PHASE_META[phaseRef.current].score * chargeMultiplier;''','phase score')

# Charge decision happens only for manual clears.
rep('''    const count = group.length;
    const comboValue = bumpCombo(liveSeed.type, count);''','''    const count = group.length;
    const comboValue = bumpCombo(liveSeed.type, count);
    const chargeMove = manualCharge(liveSeed.type, count);''','manual charge hook')

rep('''      playOverdriveSfx("attack", attackBlast ? 1.35 : Math.min(1.2, .72 + count * .06));
    }

    setFocusDelays''','''      playOverdriveSfx("attack", attackBlast ? 1.35 : Math.min(1.2, .72 + count * .06));
    }
    if (chargeMove.gain > 0) {
      fxDetail += ` • CHARGE +${chargeMove.gain}`;
      setMessage(`${LABEL[liveSeed.type]} SMALL BREAK → CHARGE +${chargeMove.gain}`);
    } else if (chargeMove.release > 0) {
      fxTitle = `CHARGE RELEASE • ${fxTitle}`;
      fxDetail += ` • BANKED ${chargeMove.release}% → ×${chargeMove.multiplier.toFixed(2)}`;
      setLastRank(`CHARGE RELEASE ×${chargeMove.multiplier.toFixed(2)}`);
      playOverdriveSfx("target", 1.12);
    }

    setFocusDelays''','charge messaging')
rep('''    const scored = scoreCluster(liveSeed.type, removed.size, 0);
    let nextScore = addScore(scored.points, scored.rank);''','''    const scored = scoreCluster(liveSeed.type, removed.size, 0, chargeMove.multiplier);
    let nextScore = addScore(scored.points, scored.rank);
    const bankGain = addBank(scored.points, comboValue, 0);
    advanceManualTarget(liveSeed.type, count);
    nextScore = scoreRef.current;
    setMessage((current) => chargeMove.release > 0 ? `${current} • BANK +${bankGain.toLocaleString()}` : current);''','manual score bank target')

# Settle with current phase and move the one-column scan.
s = s.replace('settleBoard(tiles, currentQueues, removed, performance.now() < feverUntilRef.current)', 'settleBoard(tiles, currentQueues, removed, performance.now() < feverUntilRef.current, phaseRef.current)')
s = s.replace('settleBoard(currentTiles, currentQueues, autoIds, performance.now() < feverUntilRef.current)', 'settleBoard(currentTiles, currentQueues, autoIds, performance.now() < feverUntilRef.current, phaseRef.current)')
rep('''    setTiles(currentTiles); setQueues(currentQueues); setClearingIds(new Set());
    setBoardFx({ token: actionToken + 200000''','''    setTiles(currentTiles); setQueues(currentQueues); setScanColumn(pickScanColumn(currentQueues, targetRef.current)); setClearingIds(new Set());
    setBoardFx({ token: actionToken + 200000''','manual scan')

# Phase-specific cascade threshold/cap.
rep('''    const cascadeThreshold = (performance.now() < feverUntilRef.current ? 4 : 6) - (upgrades.includes("chainReactor") ? 1 : 0);
    for (let depth = 1; depth <= 4; depth += 1) {''','''    const cascadeThreshold = clamp((performance.now() < feverUntilRef.current ? 4 : 6) - (upgrades.includes("chainReactor") ? 1 : 0) - PHASE_META[phaseRef.current].cascadeCut, 3, 6);
    const cascadeCap = PHASE_META[phaseRef.current].cascadeCap;
    for (let depth = 1; depth <= cascadeCap; depth += 1) {''','cascade phase rules')
rep('''      nextScore = addScore(autoScore.points, `CHAIN ${depth}!`);''','''      nextScore = addScore(autoScore.points, `CHAIN ${depth}!`);
      addBank(autoScore.points, comboRef.current, depth);
      advanceCascadeTarget(depth, currentQueues);
      nextScore = scoreRef.current;''','cascade bank target')
rep('''      setTiles(currentTiles); setQueues(currentQueues); setClearingIds(new Set());
      setBoardFx({ token: cascadeToken + 200000''','''      setTiles(currentTiles); setQueues(currentQueues); setScanColumn(pickScanColumn(currentQueues, targetRef.current)); setClearingIds(new Set());
      setBoardFx({ token: cascadeToken + 200000''','cascade scan')

# Jackpot rebuild respects phase and scan.
rep('''      currentTiles = makeBoard(); currentQueues = makeQueues();
      setTiles(currentTiles); setQueues(currentQueues);''','''      currentTiles = makeBoard(phaseRef.current); currentQueues = makeQueues(phaseRef.current);
      setTiles(currentTiles); setQueues(currentQueues); setScanColumn(pickScanColumn(currentQueues, targetRef.current));''','jackpot phase board')

# --- Render strategic information -----------------------------------------
rep('''  const comboWindowMax = 2200 + (upgrades.includes("comboCore") ? 900 : 0) + (upgrades.includes("healLink") ? 900 : 0);''','''  const comboWindowMax = 2200 + (upgrades.includes("comboCore") ? 900 : 0) + (upgrades.includes("healLink") ? 900 : 0);
  const scanType = queues[scanColumn]?.[0] ?? "attack";
  const cashValue = Math.round(comboBank * PHASE_META[runPhase].cash);''','render derived strategy')

rep('''        <b>BREAK → COMBO → FEVER → CASCADE</b>
        <span>ATK = BLAST SCORE</span><span>HEAL = COMBO LINK</span>
        <span>BAR = FEVER BANK</span><span>SKIP = TIME STOP</span>''','''        <b>BUILD → AIM → RELEASE → CASH OUT</b>
        <span>SMALL BREAK = CHARGE</span><span>BIG BREAK = RELEASE</span>
        <span>TARGET CLEAR = PRISM CORE</span><span>SCAN = ONE NEXT COLUMN</span>''','intro strategy')

old_next = '''    <section className={styles.next} aria-label="Overdrive next drop map">
      <b>NEXT</b>{queues.map((queue, index) => <span key={index} className={styles[queue[0]!]}>{GLYPH[queue[0]!]}</span>)}
    </section>'''
new_strategy = '''    <section className={styles.strategyPanel} data-target-pulse={targetPulse ? "true" : "false"} aria-label="Overdrive strategy panel">
      <div className={styles.phaseCard} data-phase={runPhase}><span>PHASE</span><strong>{PHASE_META[runPhase].label}</strong><em>{PHASE_META[runPhase].note}</em></div>
      <div className={styles.targetCard}><span>PRISM TARGET</span><strong>{target.label}</strong><em>{targetProgressText(target)} • +{target.reward.toLocaleString()}</em></div>
      <div className={styles.scanCard}><span>NEXT SCAN • COL {scanColumn + 1}</span><strong data-type={scanType}>{GLYPH[scanType]} {LABEL[scanType]}</strong><em>ONLY THIS COLUMN IS REVEALED</em></div>
      <button className={styles.cashOut} type="button" disabled={comboBank <= 0 || resolving} onClick={cashOut}><span>CASH OUT</span><strong>+{cashValue.toLocaleString()}</strong><em>{comboBank > 0 ? "SECURE • RESET COMBO" : "BUILD BANK WITH COMBO"}</em></button>
      <div className={styles.chargeRow} aria-label="Prism charge meters">{TYPES.map((type) => <span key={type} className={styles.chargeItem} data-type={type} data-value={charge[type]}><i>{GLYPH[type]}</i><b>{charge[type]}</b><u><em style={{ width: `${charge[type]}%` }} /></u></span>)}</div>
    </section>'''
rep(old_next, new_strategy, 'replace full next with strategic panel')

# Add scan marker to the revealed column, without exposing every next piece.
rep('''      <div className={styles.board} aria-label="Prism Overdrive Cluster Break board">
        {tiles.map''','''      <div className={styles.board} aria-label="Prism Overdrive Cluster Break board">
        <div className={styles.scanMarker} data-type={scanType} style={{ left: `${(scanColumn + .5) / SIZE * 100}%` }} aria-hidden="true"><b>▼</b><span>{GLYPH[scanType]}</span></div>
        {tiles.map''','scan marker')

rep('''      {actionFx ? <div key={actionFx.token} className={styles.actionFx} data-kind={actionFx.kind} role="status">
        <i>{actionFx.icon}</i><strong>{actionFx.title}</strong><span>{actionFx.detail}</span>
      </div> : <div className={styles.actionIdle}><b>BREAK!</b><span>WATCH THE BOARD → CHAIN THE NEXT CLUSTER</span></div>}''','''      {actionFx ? <div key={actionFx.token} className={styles.actionFx} data-kind={actionFx.kind} role="status">
        <i>{actionFx.icon}</i><strong>{actionFx.title}</strong><span>{actionFx.detail}</span>
      </div> : <div className={styles.actionIdle}><b>PLAN THE BREAK</b><span>CHARGE SMALL → HIT TARGET → RELEASE BIG → CASH OUT OR PUSH</span></div>}''','idle strategic copy')

p.write_text(s)

# --- Audio vocabulary ------------------------------------------------------
a = Path('app/gameAudio.ts')
g = a.read_text()
g = g.replace('"tap" | "rebuild"', '"tap" | "rebuild" | "target" | "cash"')
needle = '''  if (name === "tap") {'''
if needle not in g:
    raise SystemExit('MISSING tap sfx block')
insert = '''  if (name === "target") {
    const pitch = .96 + k * .12;
    arp([523, 784, 1047, 1568, 2093].map((note) => note * pitch), .032, .055 * k, "square");
    sweep(180 * pitch, 1460 * pitch, t + .035, .16, .05 * k, "triangle");
    tone(98 * pitch, t + .1, .1, .045 * k, "triangle");
    return;
  }
  if (name === "cash") {
    arp([392, 523, 659, 988].map((note) => note * (.94 + k * .08)), .028, .05 * k, "square");
    tone(131, t + .06, .11, .055 * k, "triangle");
    sweep(860, 320, t + .04, .1, .032 * k, "triangle");
    return;
  }
'''
g = g.replace(needle, insert + needle, 1)
a.write_text(g)

# --- Strategy UI -----------------------------------------------------------
c = Path('app/PrismOverdrive.module.css')
cs = c.read_text()
marker = '/* PASS 47 — GAMEPLAY RECONSTRUCTION */'
if marker not in cs:
    cs += r'''

/* PASS 47 — GAMEPLAY RECONSTRUCTION */
/* Strategic information replaces the old six-column NEXT strip. It stays compact and outside the board. */
.strategyPanel{position:relative;display:grid;grid-template-columns:.78fr 1.42fr 1.08fr 1.08fr;gap:3px;margin:0 0 4px;min-height:64px;padding:3px;border:2px solid #31445f;background:linear-gradient(180deg,#07111d,#02060d);box-shadow:inset 0 0 0 1px #0f2b42,0 2px #000;box-sizing:border-box}
.strategyPanel>div,.cashOut{min-width:0;border:1px solid #31445a;background:#040a13;color:#eaf7ff;padding:4px;box-sizing:border-box;font-family:inherit}
.phaseCard,.targetCard,.scanCard,.cashOut{display:grid;align-content:center;gap:2px}.strategyPanel span{font-size:5px;letter-spacing:.08em;color:#7e9ab4}.strategyPanel strong{font-size:8px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.strategyPanel em{font-size:5px;line-height:1.1;font-style:normal;color:#8396ae;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.phaseCard strong{color:#75f6ff}.phaseCard[data-phase="accel"] strong{color:#7bffb3}.phaseCard[data-phase="overdrive"] strong{color:#fff16a}.phaseCard[data-phase="final"] strong{color:#ff74d8;text-shadow:0 0 7px #ff4fc5}.targetCard{border-color:#7850b5!important}.targetCard strong{color:#fff36d}.strategyPanel[data-target-pulse="true"] .targetCard{animation:targetClearPulse 620ms steps(6,end);box-shadow:0 0 14px #fff36d,inset 0 0 0 2px #71f5ff}@keyframes targetClearPulse{0%{transform:scale(.96);filter:brightness(2.4)}45%{transform:scale(1.04)}100%{transform:none;filter:none}}
.scanCard{border-color:#356f8c!important}.scanCard strong[data-type="attack"]{color:#ff9e36}.scanCard strong[data-type="heal"]{color:#58f1b1}.scanCard strong[data-type="barrier"]{color:#63d8ff}.scanCard strong[data-type="skip"]{color:#fff16a}
.cashOut{appearance:none;text-align:left;border-color:#69588c!important;box-shadow:none;touch-action:manipulation}.cashOut strong{color:#74ff9a}.cashOut:not(:disabled){border-color:#74ff9a!important;background:#07170e;box-shadow:inset 0 0 0 1px #173e26}.cashOut:active:not(:disabled){transform:translate(1px,1px)}.cashOut:disabled{opacity:.55}.cashOut em{display:block}
.chargeRow{grid-column:1/-1!important;display:grid!important;grid-template-columns:repeat(4,1fr);gap:3px!important;padding:2px!important;border:0!important;background:transparent!important}.chargeItem{height:13px;display:grid;grid-template-columns:12px 18px 1fr;align-items:center;gap:2px;padding:0 2px;border:1px solid #28394c;background:#02060c;box-sizing:border-box}.chargeItem i{font-size:7px;font-style:normal}.chargeItem b{font-size:6px;text-align:right}.chargeItem u{height:4px;border:1px solid #26384b;background:#0b1119;text-decoration:none;overflow:hidden}.chargeItem u em{display:block;height:100%;background:var(--charge-color);transition:width 120ms steps(6,end)}.chargeItem[data-type="attack"]{--charge-color:#ff8a2b;color:#ffad55}.chargeItem[data-type="heal"]{--charge-color:#41f5ae;color:#7fffd0}.chargeItem[data-type="barrier"]{--charge-color:#49bfff;color:#81ddff}.chargeItem[data-type="skip"]{--charge-color:#ffe34c;color:#fff47c}
/* One-column forecast: a tiny marker shows where the only revealed next panel will fall. */
.scanMarker{position:absolute;z-index:14;top:0;transform:translate(-50%,0);width:18px;height:18px;display:grid;grid-template-columns:1fr 1fr;place-items:center;background:#02050a;border:1px solid currentColor;pointer-events:none;box-shadow:0 0 7px currentColor}.scanMarker b{font-size:6px}.scanMarker span{font-size:8px;font-weight:1000}.scanMarker[data-type="attack"]{color:#ff9d35}.scanMarker[data-type="heal"]{color:#53f0b0}.scanMarker[data-type="barrier"]{color:#60d8ff}.scanMarker[data-type="skip"]{color:#fff16a}
/* Phase rules alter the cabinet rhythm so the 3-minute run has acts, not one flat loop. */
.shell:has(.phaseCard[data-phase="accel"]) .board{box-shadow:0 0 0 2px #000,inset 0 0 0 2px #184534,0 0 24px rgba(86,255,172,.25)}.shell:has(.phaseCard[data-phase="overdrive"]) .board{box-shadow:0 0 0 2px #000,inset 0 0 0 2px #6d5c1c,0 0 30px rgba(255,226,83,.32)}.shell:has(.phaseCard[data-phase="final"]) .strategyPanel{border-color:#a94187;box-shadow:inset 0 0 0 1px #4b173f,0 0 12px rgba(255,80,201,.24)}
.modeTransform[data-kind="accel"]{color:#76ffb0}.modeTransform[data-kind="overdrive"]{color:#fff16c}
@media(max-height:700px){.strategyPanel{min-height:54px;grid-template-columns:.72fr 1.48fr 1fr 1fr}.strategyPanel>div,.cashOut{padding:2px 3px}.strategyPanel strong{font-size:7px}.strategyPanel em{font-size:4px}.chargeItem{height:11px}.boardWrap{padding-top:15px}.scanMarker{width:15px;height:15px}}
@media(prefers-reduced-motion:reduce){.strategyPanel[data-target-pulse="true"] .targetCard{animation:none!important}}
'''
c.write_text(cs)
