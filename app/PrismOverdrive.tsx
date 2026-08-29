"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { playSfx, primeAudio } from "./gameAudio";
import styles from "./PrismOverdrive.module.css";

type PanelType = "attack" | "heal" | "barrier" | "skip";
type Tile = { id: number; type: PanelType; row: number; col: number };
type Screen = "intro" | "running" | "finished";
type UpgradeId =
  | "megaAttack"
  | "timeBomb"
  | "doubleBreak"
  | "feverDrive"
  | "comboCore"
  | "prismNuke"
  | "scoreRush"
  | "chainReactor"
  | "barOvercharge"
  | "healLink";
type UpgradeDef = { id: UpgradeId; name: string; icon: string; tag: string; description: string };
type Props = { onExit?: () => void };

const SIZE = 6;
const RUN_MS = 180_000;
const FINAL_MS = 30_000;
const FEVER_MS = 12_000;
const OVER_FEVER_MS = 7_000;
const UPGRADE_THRESHOLDS = [2500, 7000, 14_000, 25_000, 40_000, 60_000];
const TYPES: PanelType[] = ["attack", "heal", "barrier", "skip"];
const LABEL: Record<PanelType, string> = { attack: "ATK", heal: "HEAL", barrier: "BAR", skip: "SKIP" };
const GLYPH: Record<PanelType, string> = { attack: "▲", heal: "♥", barrier: "◆", skip: "⏱" };
const HIGH_SCORE_KEY = "puzzle-rpg:prism-overdrive:high-score:v1";

const UPGRADES: UpgradeDef[] = [
  { id: "megaAttack", name: "MEGA ATK", icon: "▲+", tag: "ATK", description: "ATK ×5以上で周囲パネルも爆破" },
  { id: "timeBomb", name: "TIME BOMB", icon: "⏱✦", tag: "TIME", description: "SKIP ×4以上で追加3パネル爆破" },
  { id: "doubleBreak", name: "DOUBLE BREAK", icon: "×2", tag: "CORE", description: "25%で消去スコアが2倍" },
  { id: "feverDrive", name: "FEVER DRIVE", icon: "F+", tag: "FEVER", description: "FEVERゲージ獲得量 +40%" },
  { id: "comboCore", name: "COMBO CORE", icon: "C+", tag: "COMBO", description: "COMBO受付時間 +0.9秒" },
  { id: "prismNuke", name: "PRISM NUKE", icon: "×10", tag: "ATK", description: "×10以上で追加8パネル爆破" },
  { id: "scoreRush", name: "SCORE RUSH", icon: "+50%", tag: "SCORE", description: "全スコア倍率 +0.5" },
  { id: "chainReactor", name: "CHAIN REACTOR", icon: "↯", tag: "CHAIN", description: "AUTO CASCADE発火条件を1枚軽減" },
  { id: "barOvercharge", name: "BAR OVERCHARGE", icon: "◆F", tag: "BAR", description: "BAR消去のFEVER獲得を大幅増幅" },
  { id: "healLink", name: "HEAL LINK", icon: "♥C", tag: "HEAL", description: "HEALでCOMBO受付時間をさらに延長" },
];

let nextTileId = 1;
function nextId() { nextTileId += 1; return nextTileId; }
function sleep(ms: number) { return new Promise<void>((resolve) => window.setTimeout(resolve, ms)); }
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }

function randomType(fever = false): PanelType {
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
}

function makeBoard(): Tile[] {
  const result: Tile[] = [];
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) result.push({ id: nextId(), type: randomType(), row, col });
  }
  return result;
}

function makeQueues(): PanelType[][] {
  return Array.from({ length: SIZE }, () => [randomType(), randomType(), randomType()]);
}

function mapTiles(tiles: Tile[]) {
  const map = new Map<string, Tile>();
  for (const tile of tiles) map.set(`${tile.row}:${tile.col}`, tile);
  return map;
}

function connectedGroup(tiles: Tile[], seed: Tile): Tile[] {
  const map = mapTiles(tiles);
  const seen = new Set<number>();
  const stack = [seed];
  const group: Tile[] = [];
  while (stack.length) {
    const tile = stack.pop()!;
    if (seen.has(tile.id) || tile.type !== seed.type) continue;
    seen.add(tile.id); group.push(tile);
    for (const [row, col] of [[tile.row - 1, tile.col], [tile.row + 1, tile.col], [tile.row, tile.col - 1], [tile.row, tile.col + 1]]) {
      const next = map.get(`${row}:${col}`);
      if (next && next.type === seed.type && !seen.has(next.id)) stack.push(next);
    }
  }
  return group;
}

function largestGroup(tiles: Tile[]): Tile[] {
  const seen = new Set<number>();
  let best: Tile[] = [];
  for (const tile of tiles) {
    if (seen.has(tile.id)) continue;
    const group = connectedGroup(tiles, tile);
    for (const item of group) seen.add(item.id);
    if (group.length > best.length) best = group;
  }
  return best;
}

function settleBoard(tiles: Tile[], queues: PanelType[][], removed: Set<number>, fever: boolean) {
  const nextTiles: Tile[] = [];
  const nextQueues = queues.map((queue) => [...queue]);
  for (let col = 0; col < SIZE; col += 1) {
    const survivors = tiles.filter((tile) => tile.col === col && !removed.has(tile.id)).sort((a, b) => b.row - a.row);
    survivors.forEach((tile, index) => nextTiles.push({ ...tile, row: SIZE - 1 - index }));
    const holes = SIZE - survivors.length;
    for (let index = 0; index < holes; index += 1) {
      const type = nextQueues[col]!.shift() ?? randomType(fever);
      nextTiles.push({ id: nextId(), type, row: holes - 1 - index, col });
      nextQueues[col]!.push(randomType(fever));
    }
  }
  return { tiles: nextTiles, queues: nextQueues };
}

function expandAdjacent(tiles: Tile[], group: Tile[]) {
  const map = mapTiles(tiles);
  const ids = new Set(group.map((tile) => tile.id));
  for (const tile of group) {
    for (const [row, col] of [[tile.row - 1, tile.col], [tile.row + 1, tile.col], [tile.row, tile.col - 1], [tile.row, tile.col + 1]]) {
      const neighbor = map.get(`${row}:${col}`);
      if (neighbor) ids.add(neighbor.id);
    }
  }
  return ids;
}

function addRandomIds(tiles: Tile[], ids: Set<number>, amount: number) {
  const candidates = tiles.filter((tile) => !ids.has(tile.id)).sort(() => Math.random() - 0.5).slice(0, amount);
  for (const tile of candidates) ids.add(tile.id);
}

function chooseUpgrades(owned: UpgradeId[]) {
  return UPGRADES.filter((upgrade) => !owned.includes(upgrade.id)).sort(() => Math.random() - 0.5).slice(0, 3);
}

export default function PrismOverdrive({ onExit }: Props) {
  const [screen, setScreen] = useState<Screen>("intro");
  const [tiles, setTiles] = useState<Tile[]>(() => makeBoard());
  const [queues, setQueues] = useState<PanelType[][]>(() => makeQueues());
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(RUN_MS);
  const [fever, setFever] = useState(0);
  const [now, setNow] = useState(() => performance.now());
  const [jackpot, setJackpot] = useState(0);
  const [jackpotFlash, setJackpotFlash] = useState(false);
  const [message, setMessage] = useState("3 MINUTES • BREAK THE SYSTEM");
  const [resolving, setResolving] = useState(false);
  const [clearingIds, setClearingIds] = useState<Set<number>>(new Set());
  const [upgrades, setUpgrades] = useState<UpgradeId[]>([]);
  const [upgradeChoices, setUpgradeChoices] = useState<UpgradeDef[]>([]);
  const [runLevel, setRunLevel] = useState(0);
  const [lastGain, setLastGain] = useState(0);
  const [lastRank, setLastRank] = useState("");

  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const timeRef = useRef(RUN_MS);
  const feverRef = useRef(0);
  const jackpotRef = useRef(0);
  const levelRef = useRef(0);
  const comboExpireRef = useRef(0);
  const feverUntilRef = useRef(0);
  const overFeverUntilRef = useRef(0);
  const timeStopUntilRef = useRef(0);
  const lastTickRef = useRef(performance.now());

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(HIGH_SCORE_KEY) ?? 0);
    if (Number.isFinite(stored)) setHighScore(Math.max(0, stored));
  }, []);

  useEffect(() => {
    if (screen !== "running") return;
    const timer = window.setInterval(() => {
      const current = performance.now();
      setNow(current);
      const delta = Math.min(250, current - lastTickRef.current);
      lastTickRef.current = current;
      if (current < timeStopUntilRef.current) return;
      timeRef.current = Math.max(0, timeRef.current - delta);
      setTimeLeft(timeRef.current);
      if (comboRef.current > 0 && current > comboExpireRef.current) {
        comboRef.current = 0;
        setCombo(0);
      }
      if (timeRef.current <= 0) finishRun();
    }, 100);
    return () => window.clearInterval(timer);
  }, [screen]);

  const feverActive = now < feverUntilRef.current;
  const overFeverActive = now < overFeverUntilRef.current;
  const timeStopped = now < timeStopUntilRef.current;
  const finalOverdrive = screen === "running" && timeLeft <= FINAL_MS;
  const multiplier = 1 + Math.floor(combo / 5) + (upgrades.includes("scoreRush") ? 0.5 : 0) + (feverActive ? 2 : 0) + (overFeverActive ? 2 : 0) + (finalOverdrive ? 1 : 0);
  const largest = useMemo(() => largestGroup(tiles).length, [tiles]);

  function resetRun() {
    nextTileId = 1;
    const board = makeBoard();
    const nextQueues = makeQueues();
    setTiles(board); setQueues(nextQueues);
    setScore(0); scoreRef.current = 0;
    setCombo(0); comboRef.current = 0; setMaxCombo(0);
    setTimeLeft(RUN_MS); timeRef.current = RUN_MS;
    setFever(0); feverRef.current = 0;
    setJackpot(0); jackpotRef.current = 0; setJackpotFlash(false);
    setUpgrades([]); setUpgradeChoices([]); setRunLevel(0); levelRef.current = 0;
    setClearingIds(new Set()); setResolving(false); setLastGain(0); setLastRank("");
    feverUntilRef.current = 0; overFeverUntilRef.current = 0; timeStopUntilRef.current = 0; comboExpireRef.current = 0;
    lastTickRef.current = performance.now();
    setMessage("BREAK CLUSTERS • KEEP THE COMBO ALIVE");
  }

  function startRun() {
    primeAudio(); playSfx("uiConfirm");
    resetRun();
    setScreen("running");
  }

  function finishRun() {
    if (screen !== "running") return;
    const finalScore = scoreRef.current;
    setScreen("finished");
    setUpgradeChoices([]);
    playSfx("stageClear");
    if (finalScore > highScore) {
      setHighScore(finalScore);
      try { window.localStorage.setItem(HIGH_SCORE_KEY, String(finalScore)); } catch { /* ignore */ }
    }
  }

  function addScore(amount: number, rank = "") {
    const next = scoreRef.current + Math.max(0, Math.round(amount));
    scoreRef.current = next;
    setScore(next);
    setLastGain(Math.round(amount));
    if (rank) setLastRank(rank);
    return next;
  }

  function addFever(amount: number) {
    const bonus = upgrades.includes("feverDrive") ? 1.4 : 1;
    let next = feverRef.current + amount * bonus;
    const current = performance.now();
    if (current < feverUntilRef.current && next >= 100) {
      next -= 100;
      overFeverUntilRef.current = current + OVER_FEVER_MS;
      setLastRank("OVER FEVER!! • ×5");
      setMessage("OVER FEVER • BREAK EVERYTHING");
      playSfx("cascade");
    } else if (current >= feverUntilRef.current && next >= 100) {
      next -= 100;
      feverUntilRef.current = current + FEVER_MS;
      setLastRank("PRISM FEVER!! • ×3");
      setMessage("3 COLOR DROP • CASCADE CHANCE UP");
      playSfx("cascade");
    }
    feverRef.current = clamp(next, 0, 100);
    setFever(feverRef.current);
  }

  function bumpCombo(type: PanelType, count: number) {
    const current = performance.now();
    const nextCombo = current <= comboExpireRef.current ? comboRef.current + 1 : 1;
    comboRef.current = nextCombo;
    setCombo(nextCombo);
    setMaxCombo((value) => Math.max(value, nextCombo));
    let windowMs = 2200 + (upgrades.includes("comboCore") ? 900 : 0);
    if (type === "heal") windowMs += 300 + count * 90 + (upgrades.includes("healLink") ? 900 : 0);
    comboExpireRef.current = current + windowMs;
    return nextCombo;
  }

  function scoreCluster(type: PanelType, count: number, chainDepth: number) {
    const current = performance.now();
    const comboValue = comboRef.current;
    let mult = 1 + Math.floor(comboValue / 5) + (upgrades.includes("scoreRush") ? 0.5 : 0);
    if (current < feverUntilRef.current) mult += 2;
    if (current < overFeverUntilRef.current) mult += 2;
    if (timeRef.current <= FINAL_MS) mult += 1;
    let base = count * count * 12 * (1 + chainDepth * 0.35);
    if (type === "attack") base *= 1.22;
    if (upgrades.includes("doubleBreak") && Math.random() < 0.25) base *= 2;
    const rank = count >= 12 ? "ULTRA BREAK" : count >= 9 ? "MEGA BREAK" : count >= 6 ? "BIG BREAK" : chainDepth > 0 ? `CASCADE ${chainDepth}` : "BREAK";
    return { points: base * mult, rank };
  }

  function maybeOfferUpgrade(nextScore: number) {
    const threshold = UPGRADE_THRESHOLDS[levelRef.current];
    if (threshold == null || nextScore < threshold) return;
    const picked = chooseUpgrades(upgrades)[0];
    if (!picked) return;
    setUpgrades((current) => current.includes(picked.id) ? current : [...current, picked.id]);
    levelRef.current += 1;
    setRunLevel(levelRef.current);
    setLastRank(`LEVEL ${levelRef.current} • ${picked.name}!`);
    setMessage(`${picked.name} AUTO INSTALLED • KEEP BREAKING`);
    playSfx("skill");
  }

  function pickUpgrade(id: UpgradeId) {
    primeAudio(); playSfx("uiConfirm");
    setUpgrades((current) => current.includes(id) ? current : [...current, id]);
    levelRef.current += 1;
    setRunLevel(levelRef.current);
    setUpgradeChoices([]);
    lastTickRef.current = performance.now();
    setMessage(`${UPGRADES.find((upgrade) => upgrade.id === id)?.name ?? id} ACQUIRED`);
  }

  async function clearCluster(seed: Tile) {
    if (screen !== "running" || resolving || timeRef.current <= 0) return;
    const liveSeed = tiles.find((tile) => tile.id === seed.id);
    if (!liveSeed) return;
    primeAudio();
    setResolving(true);
    const group = connectedGroup(tiles, liveSeed);
    const count = group.length;
    const comboValue = bumpCombo(liveSeed.type, count);
    let removed = new Set(group.map((tile) => tile.id));
    const attackBlast = liveSeed.type === "attack" && (count >= 6 || (upgrades.includes("megaAttack") && count >= 5));
    if (attackBlast) removed = expandAdjacent(tiles, group);
    if (liveSeed.type === "skip" && count >= 4 && upgrades.includes("timeBomb")) addRandomIds(tiles, removed, 3);
    if (count >= 10 && upgrades.includes("prismNuke")) addRandomIds(tiles, removed, 8);

    if (liveSeed.type === "skip") {
      const addedMs = Math.min(3000, count * 250);
      timeRef.current = Math.min(RUN_MS + 20_000, timeRef.current + addedMs);
      setTimeLeft(timeRef.current);
      const stopMs = count >= 6 ? 2000 : count >= 4 ? 1000 : 350;
      timeStopUntilRef.current = Math.max(timeStopUntilRef.current, performance.now() + stopMs);
      setLastRank(`TIME STOP! • +${(addedMs / 1000).toFixed(1)} SEC`);
      setMessage(`SKIP ×${count} • CLOCK FROZEN • KEEP AIMING`);
      playSfx("skill");
    } else if (liveSeed.type === "barrier") {
      setLastRank(`FEVER +${count * (upgrades.includes("barOvercharge") ? 5 : 2)}`);
      setMessage(`BAR ×${count} • FEVER CHARGE`);
      playSfx("shield");
    } else if (liveSeed.type === "heal") {
      setLastRank("COMBO SAVED!");
      setMessage(`HEAL ×${count} • COMBO WINDOW EXTENDED`);
      playSfx("heal");
    } else {
      setLastRank(attackBlast ? "MEGA ATK!!" : count >= 6 ? "BIG BREAK!" : "ATK BREAK!");
      setMessage(attackBlast ? `ATK ×${count} • AREA BLAST` : `ATK ×${count} • SCORE BREAK`);
      playSfx("playerAttack");
    }

    const scored = scoreCluster(liveSeed.type, removed.size, 0);
    let nextScore = addScore(scored.points, scored.rank);
    addFever(count * 3 + Math.max(0, count - 4) * 5 + (liveSeed.type === "barrier" ? count * (upgrades.includes("barOvercharge") ? 5 : 2) : 0));
    let charge = jackpotRef.current + (count >= 10 ? 2 : count >= 7 ? 1 : 0);
    jackpotRef.current = charge;
    setJackpot(Math.min(3, charge));

    setClearingIds(removed);
    playSfx(count >= 8 ? "cascade" : "drop");
    await sleep(95);
    let currentQueues = queues.map((queue) => [...queue]);
    let settled = settleBoard(tiles, currentQueues, removed, performance.now() < feverUntilRef.current);
    let currentTiles = settled.tiles;
    currentQueues = settled.queues;
    setTiles(currentTiles); setQueues(currentQueues); setClearingIds(new Set());
    await sleep(110);

    const cascadeThreshold = (performance.now() < feverUntilRef.current ? 4 : 6) - (upgrades.includes("chainReactor") ? 1 : 0);
    for (let depth = 1; depth <= 4; depth += 1) {
      const auto = largestGroup(currentTiles);
      if (auto.length < cascadeThreshold) break;
      const autoIds = new Set(auto.map((tile) => tile.id));
      comboRef.current += 1; setCombo(comboRef.current); setMaxCombo((value) => Math.max(value, comboRef.current));
      comboExpireRef.current = performance.now() + 2500 + (upgrades.includes("comboCore") ? 900 : 0);
      const autoScore = scoreCluster(auto[0]!.type, auto.length, depth);
      nextScore = addScore(autoScore.points, `CHAIN ${depth}!`);
      setMessage(`AUTO CASCADE • +${Math.round(autoScore.points).toLocaleString()} • DON\'T STOP`);
      addFever(auto.length * 2.4);
      setClearingIds(autoIds);
      playSfx("cascade");
      await sleep(90);
      settled = settleBoard(currentTiles, currentQueues, autoIds, performance.now() < feverUntilRef.current);
      currentTiles = settled.tiles; currentQueues = settled.queues;
      setTiles(currentTiles); setQueues(currentQueues); setClearingIds(new Set());
      await sleep(90);
    }

    if (jackpotRef.current >= 3) {
      jackpotRef.current = 0; setJackpot(0); setJackpotFlash(true);
      const jackpotPoints = 5000 * (1 + Math.floor(comboValue / 5) + (finalOverdrive ? 1 : 0));
      nextScore = addScore(jackpotPoints, "PRISM JACKPOT");
      addFever(35);
      setLastRank("PRISM JACKPOT!!!");
      setMessage(`JACKPOT +${Math.round(jackpotPoints).toLocaleString()} • BOARD RESET`);
      playSfx("stageClear");
      await sleep(260);
      currentTiles = makeBoard(); currentQueues = makeQueues();
      setTiles(currentTiles); setQueues(currentQueues);
      setJackpotFlash(false);
    }

    maybeOfferUpgrade(nextScore);
    setResolving(false);
  }

  const timeSeconds = Math.ceil(timeLeft / 1000);
  const comboWindowMs = Math.max(0, comboExpireRef.current - now);
  const comboWindowMax = 2200 + (upgrades.includes("comboCore") ? 900 : 0) + (upgrades.includes("healLink") ? 900 : 0);

  if (screen === "intro") {
    return <main className={styles.shell} data-screen="intro">
      <button className={styles.exit} type="button" onClick={onExit}>◀ MODE</button>
      <div className={styles.introLogo}><span>PRISM</span><strong>OVERDRIVE</strong><em>3 MINUTE HYPER CLUSTER MODE</em></div>
      <div className={styles.introCore} aria-hidden="true">◆</div>
      <div className={styles.introRules}>
        <b>BREAK → COMBO → FEVER → CASCADE</b>
        <span>ATK = BLAST SCORE</span><span>HEAL = COMBO LINK</span>
        <span>BAR = FEVER BANK</span><span>SKIP = TIME STOP</span>
      </div>
      <button className={styles.start} type="button" onClick={startRun}>▶ START OVERDRIVE</button>
      <small className={styles.record}>HIGH SCORE {highScore.toLocaleString()}</small>
    </main>;
  }

  return <main className={`${styles.shell} ${feverActive ? styles.fever : ""} ${overFeverActive ? styles.overFever : ""} ${finalOverdrive ? styles.final : ""}`}>
    <header className={styles.topbar}>
      <button className={styles.exit} type="button" onClick={onExit}>◀ MODE</button>
      <div><span>SCORE</span><strong>{score.toLocaleString()}</strong><i>{lastGain > 0 ? `+${lastGain.toLocaleString()}` : ""}</i></div>
      <div className={styles.timer} data-stopped={timeStopped ? "true" : "false"}><span>{timeStopped ? "TIME STOP" : finalOverdrive ? "FINAL" : "TIME"}</span><strong>{timeSeconds}</strong></div>
    </header>

    <section className={styles.hypeRow}>
      <div className={styles.combo}><span>COMBO</span><strong>×{combo}</strong><em>MULTI ×{multiplier.toFixed(1)}</em><i><u style={{ width: `${clamp(comboWindowMs / Math.max(1, comboWindowMax) * 100, 0, 100)}%` }} /></i></div>
      <div className={styles.feverMeter}><span>{overFeverActive ? "OVER FEVER" : feverActive ? "PRISM FEVER" : "FEVER"}</span><strong>{Math.round(fever)}%</strong><i><u style={{ width: `${fever}%` }} /></i></div>
      <div className={styles.jackpot}><span>JACKPOT</span><strong>{"◆".repeat(jackpot)}{"◇".repeat(3 - jackpot)}</strong></div>
    </section>

    <section className={styles.next} aria-label="Overdrive next drop map">
      <b>NEXT</b>{queues.map((queue, index) => <span key={index} className={styles[queue[0]!]}>{GLYPH[queue[0]!]}</span>)}
    </section>

    <section className={styles.boardWrap}>
      <div className={styles.rank}>{lastRank || (resolving ? "BREAK!" : "KEEP MOVING")}</div>
      <div className={styles.board} aria-label="Prism Overdrive Cluster Break board">
        {tiles.map((tile) => <button
          key={tile.id}
          type="button"
          className={`${styles.tile} ${styles[tile.type]} ${clearingIds.has(tile.id) ? styles.clearing : ""}`}
          style={{ left: `calc(${tile.col * (100 / SIZE)}% + 1px)`, top: `calc(${tile.row * (100 / SIZE)}% + 1px)` }}
          disabled={resolving || screen !== "running"}
          aria-label={`${LABEL[tile.type]} cluster panel row ${tile.row + 1} column ${tile.col + 1}`}
          onClick={() => void clearCluster(tile)}
        ><b>{GLYPH[tile.type]}</b><span>{LABEL[tile.type]}</span></button>)}
      </div>
      {jackpotFlash ? <div className={styles.jackpotFlash}><span>PRISM</span><strong>JACKPOT!</strong></div> : null}
      {timeStopped ? <div className={styles.timeStopFx}><i>⏱</i><strong>TIME STOP</strong></div> : null}
    </section>

    <section className={styles.runInfo}>
      <span>BIGGEST <b>×{largest}</b></span><span>LEVEL <b>{runLevel}</b></span><span>BEST COMBO <b>×{maxCombo}</b></span>
    </section>
    <div className={styles.message} role="status">{message}</div>
    <div className={styles.build}>{upgrades.map((id) => <i key={id}>{UPGRADES.find((upgrade) => upgrade.id === id)?.name}</i>)}</div>

    {finalOverdrive ? <div className={styles.finalBanner}>FINAL OVERDRIVE • 30 SEC • NO STOP • SCORE BOOST</div> : null}

    {false && upgradeChoices.length > 0 ? <div className={styles.overlay} role="dialog" aria-label="Choose Overdrive upgrade">
      <div className={styles.upgradeCard}><span>OVERDRIVE LEVEL {runLevel + 1}</span><strong>CHOOSE 1</strong><p>ゲームを壊す能力を追加する</p>
        <div>{upgradeChoices.map((upgrade) => <button key={upgrade.id} type="button" data-tag={upgrade.tag} onClick={() => pickUpgrade(upgrade.id)}><b>{upgrade.icon}</b><span><strong>{upgrade.name}</strong><small>{upgrade.description}</small></span></button>)}</div>
      </div>
    </div> : null}

    {screen === "finished" ? <div className={styles.overlay} role="dialog" aria-label="Prism Overdrive result">
      <div className={styles.resultCard}><span>RUN COMPLETE</span><strong>{score.toLocaleString()}</strong>{score >= highScore && score > 0 ? <b>NEW RECORD!</b> : null}
        <div><span>MAX COMBO <b>×{maxCombo}</b></span><span>OVERDRIVE <b>{runLevel}</b></span><span>HIGH SCORE <b>{Math.max(score, highScore).toLocaleString()}</b></span></div>
        <button type="button" onClick={startRun}>▶ ONE MORE RUN</button><button type="button" onClick={onExit}>◀ MODE SELECT</button>
      </div>
    </div> : null}
  </main>;
}
