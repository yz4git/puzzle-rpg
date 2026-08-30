"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { playOverdriveSfx, playSfx, primeAudio } from "./gameAudio";
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
type ActionFx = {
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
  mega?: boolean;
  links?: Array<{ x1: number; y1: number; x2: number; y2: number }>;
};
type ModeFx = {
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
type ChargeMap = Record<PanelType, number>;
type RoutePlan = { ids: number[]; projected: number; type: PanelType; column: number } | null;

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
const ONBOARDING_KEY = "puzzle-rpg:prism-overdrive:onboarding:v1";
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
  if (phase === "build" && token <= 2) {
    const type = TYPES[Math.floor(Math.random() * TYPES.length)]!;
    const need = 4;
    return { token, kind: "color", label: `${LABEL[type]} ×${need}+ BREAK`, reward: 1400, type, need, progress: 0 };
  }
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

function randomType(fever = false, phase: RunPhase = "build"): PanelType {
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
}

function makeBoard(phase: RunPhase = "build"): Tile[] {
  const result: Tile[] = [];
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) result.push({ id: nextId(), type: randomType(false, phase), row, col });
  }
  return result;
}

function makeQueues(phase: RunPhase = "build"): PanelType[][] {
  return Array.from({ length: SIZE }, () => [randomType(false, phase), randomType(false, phase), randomType(false, phase)]);
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

function settleBoard(tiles: Tile[], queues: PanelType[][], removed: Set<number>, fever: boolean, phase: RunPhase = "build") {
  const nextTiles: Tile[] = [];
  const nextQueues = queues.map((queue) => [...queue]);
  for (let col = 0; col < SIZE; col += 1) {
    const survivors = tiles.filter((tile) => tile.col === col && !removed.has(tile.id)).sort((a, b) => b.row - a.row);
    survivors.forEach((tile, index) => nextTiles.push({ ...tile, row: SIZE - 1 - index }));
    const holes = SIZE - survivors.length;
    for (let index = 0; index < holes; index += 1) {
      const type = nextQueues[col]!.shift() ?? randomType(fever);
      nextTiles.push({ id: nextId(), type, row: holes - 1 - index, col });
      nextQueues[col]!.push(randomType(fever, phase));
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

function fxAnchor(items: Tile[]) {
  if (!items.length) return { x: 50, y: 50, columns: [] as number[] };
  const x = items.reduce((sum, tile) => sum + tile.col + 0.5, 0) / items.length / SIZE * 100;
  const y = items.reduce((sum, tile) => sum + tile.row + 0.5, 0) / items.length / SIZE * 100;
  const columns = [...new Set(items.map((tile) => tile.col))].sort((a, b) => a - b);
  return { x, y, columns };
}

function fxWaveDelays(items: Tile[], anchor: { x: number; y: number }) {
  const ax = anchor.x / 100 * SIZE - 0.5;
  const ay = anchor.y / 100 * SIZE - 0.5;
  const delays: Record<number, number> = {};
  for (const tile of items) delays[tile.id] = Math.round((Math.abs(tile.col - ax) + Math.abs(tile.row - ay)) * 38);
  return delays;
}

function fxRouteDelays(items: Tile[]) {
  const delays: Record<number, number> = {};
  items.forEach((tile, index) => { delays[tile.id] = Math.min(245, index * 34); });
  return delays;
}

function fxLinks(items: Tile[]) {
  const map = mapTiles(items);
  const links: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  for (const tile of items) {
    for (const [row, col] of [[tile.row + 1, tile.col], [tile.row, tile.col + 1]]) {
      if (!map.has(`${row}:${col}`)) continue;
      links.push({
        x1: (tile.col + 0.5) / SIZE * 100,
        y1: (tile.row + 0.5) / SIZE * 100,
        x2: (col + 0.5) / SIZE * 100,
        y2: (row + 0.5) / SIZE * 100,
      });
    }
  }
  return links;
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
  const [focusIds, setFocusIds] = useState<Set<number>>(new Set());
  const [actionFx, setActionFx] = useState<ActionFx | null>(null);
  const [boardFx, setBoardFx] = useState<BoardFx | null>(null);
  const [modeFx, setModeFx] = useState<ModeFx | null>(null);
  const [pressedId, setPressedId] = useState<number | null>(null);
  const [focusDelays, setFocusDelays] = useState<Record<number, number>>({});
  const [jackpotAfterglow, setJackpotAfterglow] = useState(false);
  const [runPhase, setRunPhase] = useState<RunPhase>("build");
  const [charge, setCharge] = useState<ChargeMap>(() => emptyCharge());
  const [comboBank, setComboBank] = useState(0);
  const [target, setTarget] = useState<PrismTarget>(() => makeTarget("build", 1));
  const [scanColumn, setScanColumn] = useState(0);
  const [targetPulse, setTargetPulse] = useState(false);
  const [missionStreak, setMissionStreak] = useState(0);
  const [bossCoreHp, setBossCoreHp] = useState(0);
  const [bossCoreMax, setBossCoreMax] = useState(0);
  const [bossBreaks, setBossBreaks] = useState(0);
  const [routePulse, setRoutePulse] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [moves, setMoves] = useState(0);
  const [tutorialSeen, setTutorialSeen] = useState(false);

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
  const resolvingRef = useRef(false);
  const actionFxTokenRef = useRef(1);
  const finalTriggeredRef = useRef(false);
  const phaseRef = useRef<RunPhase>("build");
  const chargeRef = useRef<ChargeMap>(emptyCharge());
  const bankRef = useRef(0);
  const targetRef = useRef<PrismTarget>(target);
  const targetTokenRef = useRef(2);
  const missionStreakRef = useRef(0);
  const bossCoreHpRef = useRef(0);
  const bossCoreMaxRef = useRef(0);
  const bossBreaksRef = useRef(0);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(HIGH_SCORE_KEY) ?? 0);
    if (Number.isFinite(stored)) setHighScore(Math.max(0, stored));
    try { setTutorialSeen(window.localStorage.getItem(ONBOARDING_KEY) === "1"); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (screen !== "running") return;
    const timer = window.setInterval(() => {
      const current = performance.now();
      setNow(current);
      const delta = Math.min(250, current - lastTickRef.current);
      lastTickRef.current = current;
      if (current < timeStopUntilRef.current || resolvingRef.current || showHelp) {
        if (comboRef.current > 0 && comboExpireRef.current > 0) comboExpireRef.current += delta;
        return;
      }
      timeRef.current = Math.max(0, timeRef.current - delta);
      setTimeLeft(timeRef.current);
      const nextPhase = phaseForTime(timeRef.current);
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
          if (bossCoreHpRef.current <= 0 && missionStreakRef.current > 0) {
            missionStreakRef.current = 0;
            setMissionStreak(0);
          }
          playOverdriveSfx("cash", .62);
        }
      }
      if (timeRef.current <= 0) finishRun();
    }, 100);
    return () => window.clearInterval(timer);
  }, [screen, showHelp]);

  const feverActive = now < feverUntilRef.current;
  const overFeverActive = now < overFeverUntilRef.current;
  const timeStopped = now < timeStopUntilRef.current;
  const finalOverdrive = screen === "running" && runPhase === "final";
  const multiplier = 1 + Math.floor(combo / 5) + (upgrades.includes("scoreRush") ? 0.5 : 0) + (feverActive ? 2 : 0) + (overFeverActive ? 2 : 0) + (finalOverdrive ? 1 : 0);
  const largest = useMemo(() => largestGroup(tiles).length, [tiles]);

  function announcePhase(nextPhase: RunPhase) {
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
    if (bossCoreHpRef.current <= 0) {
      missionStreakRef.current = 0;
      setMissionStreak(0);
    }
    addScore(payout, `CASH OUT +${payout.toLocaleString()}`);
    const token = actionFxTokenRef.current++;
    setActionFx({ token, kind: "upgrade", title: "BANK SECURED!", detail: `+${payout.toLocaleString()} • COMBO RESET`, icon: "◆$" });
    setMessage("SAFE SCORE LOCKED • START A NEW COMBO");
    playOverdriveSfx("cash", 1.18);
    window.setTimeout(() => setActionFx((value) => value?.token === token ? null : value), 650);
  }

  function spawnBossCore() {
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

  function resetRun() {
    nextTileId = 1;
    const board = makeBoard("build");
    const nextQueues = makeQueues("build");
    const firstTarget = makeTarget("build", 1);
    setTiles(board); setQueues(nextQueues);
    setScore(0); scoreRef.current = 0;
    setCombo(0); comboRef.current = 0; setMaxCombo(0);
    setTimeLeft(RUN_MS); timeRef.current = RUN_MS;
    setFever(0); feverRef.current = 0;
    setJackpot(0); jackpotRef.current = 0; setJackpotFlash(false);
    setUpgrades([]); setUpgradeChoices([]); setRunLevel(0); levelRef.current = 0;
    setClearingIds(new Set()); setFocusIds(new Set()); setFocusDelays({}); setActionFx(null); setBoardFx(null); setModeFx(null);
    setPressedId(null); setJackpotAfterglow(false);
    setRunPhase("build"); phaseRef.current = "build";
    const blankCharge = emptyCharge(); setCharge(blankCharge); chargeRef.current = blankCharge;
    setComboBank(0); bankRef.current = 0;
    setTarget(firstTarget); targetRef.current = firstTarget; targetTokenRef.current = 2;
    setScanColumn(pickScanColumn(nextQueues, firstTarget)); setTargetPulse(false); setRoutePulse(false);
    setMissionStreak(0); missionStreakRef.current = 0;
    setBossCoreHp(0); bossCoreHpRef.current = 0; setBossCoreMax(0); bossCoreMaxRef.current = 0;
    setBossBreaks(0); bossBreaksRef.current = 0;
    setShowHelp(false); setMoves(tutorialSeen ? 10 : 0);
    setResolving(false); resolvingRef.current = false; setLastGain(0); setLastRank("");
    feverUntilRef.current = 0; overFeverUntilRef.current = 0; timeStopUntilRef.current = 0; comboExpireRef.current = 0; finalTriggeredRef.current = false;
    lastTickRef.current = performance.now();
    setMessage("SMALL BREAK = CHARGE • BIG BREAK = RELEASE • TARGET = CORE");
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
    if (!tutorialSeen && moves >= 10) {
      setTutorialSeen(true);
      try { window.localStorage.setItem(ONBOARDING_KEY, "1"); } catch { /* ignore */ }
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
      const token = actionFxTokenRef.current++;
      setModeFx({ token, kind: "overFever", title: "OVER FEVER", detail: "PRISM LIMIT BROKEN • ×5" });
      window.setTimeout(() => setModeFx((value) => value?.token === token ? null : value), 900);
      playSfx("cascade");
      playOverdriveSfx("fever", 1.35);
    } else if (current >= feverUntilRef.current && next >= 100) {
      next -= 100;
      feverUntilRef.current = current + FEVER_MS;
      setLastRank("PRISM FEVER!! • ×3");
      setMessage("3 COLOR DROP • CASCADE CHANCE UP");
      const token = actionFxTokenRef.current++;
      setModeFx({ token, kind: "fever", title: "PRISM FEVER", detail: "3 COLOR DROP • ×3" });
      window.setTimeout(() => setModeFx((value) => value?.token === token ? null : value), 820);
      playSfx("cascade");
      playOverdriveSfx("fever", 1.12);
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

  function scoreCluster(type: PanelType, count: number, chainDepth: number, chargeMultiplier = 1) {
    const current = performance.now();
    const comboValue = comboRef.current;
    let mult = 1 + Math.floor(comboValue / 5) + (upgrades.includes("scoreRush") ? 0.5 : 0);
    if (current < feverUntilRef.current) mult += 2;
    if (current < overFeverUntilRef.current) mult += 2;
    if (timeRef.current <= FINAL_MS) mult += 1;
    let base = count * count * 12 * (1 + chainDepth * 0.35) * PHASE_META[phaseRef.current].score * chargeMultiplier;
    if (type === "attack") base *= 1.22;
    if (upgrades.includes("doubleBreak") && Math.random() < 0.25) base *= 2;
    const rank = count >= 12 ? "ULTRA BREAK" : count >= 9 ? "MEGA BREAK" : count >= 6 ? "BIG BREAK" : chainDepth > 0 ? `CASCADE ${chainDepth}` : "BREAK";
    return { points: base * mult, rank };
  }

  async function maybeOfferUpgrade(nextScore: number) {
    const threshold = UPGRADE_THRESHOLDS[levelRef.current];
    if (threshold == null || nextScore < threshold) return;
    const picked = chooseUpgrades(upgrades)[0];
    if (!picked) return;
    setUpgrades((current) => current.includes(picked.id) ? current : [...current, picked.id]);
    levelRef.current += 1;
    setRunLevel(levelRef.current);
    setLastRank(`LEVEL ${levelRef.current} • ${picked.name}!`);
    setMessage(`${picked.name} AUTO INSTALLED`);
    setActionFx({ token: actionFxTokenRef.current++, kind: "upgrade", title: `${picked.name} GET!`, detail: picked.description, icon: picked.icon });
    playSfx("skill");
    playOverdriveSfx("upgrade", 1);
    await sleep(620);
    setActionFx(null);
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
    resolvingRef.current = true;
    const group = connectedGroup(tiles, liveSeed);
    const count = group.length;
    setMoves((value) => value + 1);
    const selectedRoute = routePlan && routePlan.ids.includes(liveSeed.id) ? routePlan : null;
    const comboValue = bumpCombo(liveSeed.type, count);
    const chargeMove = manualCharge(liveSeed.type, count);
    let removed = new Set(group.map((tile) => tile.id));
    const attackBlast = liveSeed.type === "attack" && (count >= 6 || (upgrades.includes("megaAttack") && count >= 5));
    if (attackBlast) removed = expandAdjacent(tiles, group);
    if (liveSeed.type === "skip" && count >= 4 && upgrades.includes("timeBomb")) addRandomIds(tiles, removed, 3);
    if (count >= 10 && upgrades.includes("prismNuke")) addRandomIds(tiles, removed, 8);
    const removedTiles = tiles.filter((tile) => removed.has(tile.id));
    const impactAnchor = fxAnchor(removedTiles);

    let fxTitle = "";
    let fxDetail = "";
    if (liveSeed.type === "skip") {
      const addedMs = Math.min(3000, count * 250);
      timeRef.current = Math.min(RUN_MS + 20_000, timeRef.current + addedMs);
      setTimeLeft(timeRef.current);
      const stopMs = count >= 6 ? 2000 : count >= 4 ? 1000 : 350;
      timeStopUntilRef.current = Math.max(timeStopUntilRef.current, performance.now() + stopMs);
      fxTitle = `TIME STOP ×${count}`;
      fxDetail = `YELLOW SKIP → CLOCK STOP +${(addedMs / 1000).toFixed(1)} SEC`;
      setLastRank(`TIME STOP! • +${(addedMs / 1000).toFixed(1)} SEC`);
      setMessage("YELLOW SKIP → CLOCK STOPS");
      playSfx("skill");
    } else if (liveSeed.type === "barrier") {
      const feverGain = count * (upgrades.includes("barOvercharge") ? 5 : 2);
      fxTitle = `FEVER CHARGE ×${count}`;
      fxDetail = `BLUE BAR → FEVER +${feverGain}`;
      setLastRank(`FEVER +${feverGain}`);
      setMessage("BLUE BAR → FEVER GAUGE");
      playSfx("shield");
    } else if (liveSeed.type === "heal") {
      fxTitle = `COMBO LINK ×${count}`;
      fxDetail = "PINK HEAL → COMBO WINDOW EXTENDED";
      setLastRank("COMBO SAVED!");
      setMessage("PINK HEAL → MORE TIME FOR NEXT COMBO");
      playSfx("heal");
    } else {
      fxTitle = attackBlast ? `MEGA ATTACK ×${count}!` : `ATTACK ×${count}!`;
      fxDetail = attackBlast ? `RED ATK → AREA BLAST • ${removed.size} PANELS` : `RED ATK → SCORE BREAK • ${removed.size} PANELS`;
      setLastRank(attackBlast ? "MEGA ATK!!" : count >= 6 ? "BIG BREAK!" : "ATK BREAK!");
      setMessage(attackBlast ? "RED ATK → NEARBY PANELS ALSO BREAK" : "RED ATK → SCORE");
      playSfx("playerAttack");
      playOverdriveSfx("attack", attackBlast ? 1.35 : Math.min(1.2, .72 + count * .06));
    }
    if (chargeMove.gain > 0) {
      fxDetail += ` • CHARGE +${chargeMove.gain}`;
      setMessage(`${LABEL[liveSeed.type]} SMALL BREAK → CHARGE +${chargeMove.gain}`);
    } else if (chargeMove.release > 0) {
      fxTitle = `CHARGE RELEASE • ${fxTitle}`;
      fxDetail += ` • BANKED ${chargeMove.release}% → ×${chargeMove.multiplier.toFixed(2)}`;
      setLastRank(`CHARGE RELEASE ×${chargeMove.multiplier.toFixed(2)}`);
      damageBossCore("CHARGE RELEASE");
      playOverdriveSfx("target", 1.12);
    }

    setFocusDelays(fxWaveDelays(removedTiles, impactAnchor));
    setFocusIds(new Set(removed));
    const actionToken = actionFxTokenRef.current++;
    setActionFx({ token: actionToken, kind: liveSeed.type, title: fxTitle, detail: fxDetail, icon: GLYPH[liveSeed.type] });
    setBoardFx({ token: actionToken, kind: liveSeed.type, phase: "lock", x: impactAnchor.x, y: impactAnchor.y, points: 0, chain: 0, count: removed.size, columns: impactAnchor.columns, mega: attackBlast });
    await sleep(380);

    const scored = scoreCluster(liveSeed.type, removed.size, 0, chargeMove.multiplier);
    let nextScore = addScore(scored.points, scored.rank);
    const bankGain = addBank(scored.points, comboValue, 0);
    advanceManualTarget(liveSeed.type, count);
    nextScore = scoreRef.current;
    setMessage((current) => chargeMove.release > 0 ? `${current} • BANK +${bankGain.toLocaleString()}` : current);
    setBoardFx({ token: actionToken + 100000, kind: liveSeed.type, phase: "burst", x: impactAnchor.x, y: impactAnchor.y, points: Math.round(scored.points), chain: 0, count: removed.size, columns: impactAnchor.columns, mega: attackBlast });
    if (attackBlast) playOverdriveSfx("mega", Math.min(1.45, 1.08 + removed.size * .025));
    await sleep(230);
    addFever(count * 3 + Math.max(0, count - 4) * 5 + (liveSeed.type === "barrier" ? count * (upgrades.includes("barOvercharge") ? 5 : 2) : 0));
    let charge = jackpotRef.current + (count >= 10 ? 2 : count >= 7 ? 1 : 0);
    jackpotRef.current = charge;
    setJackpot(Math.min(3, charge));

    setFocusIds(new Set());
    setFocusDelays({});
    setClearingIds(removed);
    playSfx(count >= 8 ? "cascade" : "drop");
    await sleep(190);
    let currentQueues = queues.map((queue) => [...queue]);
    let settled = settleBoard(tiles, currentQueues, removed, performance.now() < feverUntilRef.current, phaseRef.current);
    let currentTiles = settled.tiles;
    currentQueues = settled.queues;
    setTiles(currentTiles); setQueues(currentQueues); setScanColumn(pickScanColumn(currentQueues, targetRef.current)); setClearingIds(new Set());
    setBoardFx({ token: actionToken + 200000, kind: liveSeed.type, phase: "drop", x: impactAnchor.x, y: 91, points: 0, chain: 0, count: removed.size, columns: impactAnchor.columns, mega: attackBlast });
    setActionFx(null);
    playOverdriveSfx("drop", Math.min(1.35, .72 + removed.size * .045));
    await sleep(330);
    setBoardFx(null);

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

    const cascadeThreshold = clamp((performance.now() < feverUntilRef.current ? 4 : 6) - (upgrades.includes("chainReactor") ? 1 : 0) - PHASE_META[phaseRef.current].cascadeCut - routeBoost, 3, 6);
    const cascadeCap = PHASE_META[phaseRef.current].cascadeCap;
    for (let depth = 1; depth <= cascadeCap; depth += 1) {
      const auto = largestGroup(currentTiles);
      if (auto.length < cascadeThreshold) break;
      const autoIds = new Set(auto.map((tile) => tile.id));
      const autoType = auto[0]!.type;
      comboRef.current += 1; setCombo(comboRef.current); setMaxCombo((value) => Math.max(value, comboRef.current));
      comboExpireRef.current = performance.now() + 2500 + (upgrades.includes("comboCore") ? 900 : 0);
      const autoScore = scoreCluster(autoType, auto.length, depth);
      const cascadeAnchor = fxAnchor(auto);
      const cascadeToken = actionFxTokenRef.current++;
      setFocusDelays(fxRouteDelays(auto));
      setFocusIds(autoIds);
      setActionFx({ token: cascadeToken, kind: "cascade", title: `AUTO CASCADE → CHAIN ${depth}!`, detail: `${LABEL[autoType]} ×${auto.length} CONNECTED BY THE DROP`, icon: "↯" });
      setBoardFx({ token: cascadeToken, kind: "cascade", phase: "lock", x: cascadeAnchor.x, y: cascadeAnchor.y, points: 0, chain: depth, count: auto.length, columns: cascadeAnchor.columns, links: fxLinks(auto) });
      setLastRank(`CHAIN ${depth}!`);
      setMessage(`AUTO MATCH FOUND • ${LABEL[autoType]} ×${auto.length} WILL BREAK`);
      playSfx("setup");
      playOverdriveSfx("cascade", 0.72 + depth * .16);
      await sleep(520);

      nextScore = addScore(autoScore.points, `CHAIN ${depth}!`);
      addBank(autoScore.points, comboRef.current, depth);
      advanceCascadeTarget(depth, currentQueues);
      if (depth >= 2) damageBossCore(`CHAIN ${depth}`);
      nextScore = scoreRef.current;
      setBoardFx({ token: cascadeToken + 100000, kind: "cascade", phase: "burst", x: cascadeAnchor.x, y: cascadeAnchor.y, points: Math.round(autoScore.points), chain: depth, count: auto.length, columns: cascadeAnchor.columns, links: fxLinks(auto) });
      setMessage(`CHAIN ${depth} SCORE +${Math.round(autoScore.points).toLocaleString()}`);
      addFever(auto.length * 2.4);
      await sleep(240);
      setFocusIds(new Set());
      setFocusDelays({});
      setClearingIds(autoIds);
      playSfx("cascade");
      playOverdriveSfx("cascade", 1 + depth * .18);
      await sleep(260);
      settled = settleBoard(currentTiles, currentQueues, autoIds, performance.now() < feverUntilRef.current, phaseRef.current);
      currentTiles = settled.tiles; currentQueues = settled.queues;
      setTiles(currentTiles); setQueues(currentQueues); setScanColumn(pickScanColumn(currentQueues, targetRef.current)); setClearingIds(new Set());
      setBoardFx({ token: cascadeToken + 200000, kind: "cascade", phase: "drop", x: cascadeAnchor.x, y: 91, points: 0, chain: depth, count: auto.length, columns: cascadeAnchor.columns });
      playOverdriveSfx("drop", 0.9 + depth * .1);
      await sleep(350);
      setBoardFx(null);
    }

    if (jackpotRef.current >= 3) {
      jackpotRef.current = 0; setJackpot(0); setJackpotFlash(true);
      const jackpotPoints = 5000 * (1 + Math.floor(comboValue / 5) + (finalOverdrive ? 1 : 0));
      nextScore = addScore(jackpotPoints, "PRISM JACKPOT");
      addFever(35);
      setLastRank("PRISM JACKPOT!!!");
      setMessage(`JACKPOT +${Math.round(jackpotPoints).toLocaleString()} • BOARD RESET`);
      playSfx("stageClear");
      playOverdriveSfx("jackpot", 1.42);
      const jackpotToken = actionFxTokenRef.current++;
      setBoardFx({ token: jackpotToken, kind: "jackpot", phase: "burst", x: 50, y: 50, points: Math.round(jackpotPoints), chain: 0, count: 36, columns: [0,1,2,3,4,5] });
      await sleep(680);
      currentTiles = makeBoard(phaseRef.current); currentQueues = makeQueues(phaseRef.current);
      setTiles(currentTiles); setQueues(currentQueues); setScanColumn(pickScanColumn(currentQueues, targetRef.current));
      setBoardFx({ token: jackpotToken + 200000, kind: "jackpot", phase: "drop", x: 50, y: 91, points: 0, chain: 0, count: 36, columns: [0,1,2,3,4,5] });
      playOverdriveSfx("drop", 1.42);
      await sleep(390);
      setJackpotFlash(false);
      setJackpotAfterglow(true);
      playOverdriveSfx("rebuild", 1.28);
      window.setTimeout(() => setJackpotAfterglow(false), 1180);
    }

    setActionFx(null);
    setBoardFx(null);
    setFocusIds(new Set());
    setFocusDelays({});
    await maybeOfferUpgrade(nextScore);
    setResolving(false);
    resolvingRef.current = false;
  }

  const timeSeconds = Math.ceil(timeLeft / 1000);
  const comboWindowMs = Math.max(0, comboExpireRef.current - now);
  const comboWindowMax = 2200 + (upgrades.includes("comboCore") ? 900 : 0) + (upgrades.includes("healLink") ? 900 : 0);
  const scanType = queues[scanColumn]?.[0] ?? "attack";
  const routePlan = useMemo(() => forecastRoute(tiles, queues, scanColumn), [tiles, queues, scanColumn]);
  const routeIds = useMemo(() => new Set(routePlan?.ids ?? []), [routePlan]);
  const cashValue = Math.round(comboBank * PHASE_META[runPhase].cash);
  const beginner = moves < 6;
  const routeLesson = moves >= 6 && moves < 10;
  const fullSystems = moves >= 10;
  const learnedRun = tutorialSeen && fullSystems;
  const showBeginnerTarget = moves >= 2;
  const recommended = useMemo(() => {
    const wanted = moves >= 2 ? desiredTargetType(target) : null;
    if (wanted) {
      let best: Tile[] = [];
      const seen = new Set<number>();
      for (const tile of tiles) {
        if (tile.type !== wanted || seen.has(tile.id)) continue;
        const group = connectedGroup(tiles, tile);
        group.forEach((item) => seen.add(item.id));
        if (group.length > best.length) best = group;
      }
      if (best.length) return new Set(best.map((tile) => tile.id));
    }
    return new Set(largestGroup(tiles).map((tile) => tile.id));
  }, [tiles, moves, target]);
  const recommendedLead = [...recommended][0] ?? -1;
  const routeLessonReady = routeLesson && Boolean(routePlan);
  const guideTitle = moves === 0 ? "STEP 1  TAP A GLOWING GROUP" : moves < 2 ? "STEP 2  MAKE BIG GROUPS" : moves < 6 ? "STEP 3  MATCH THE TARGET" : moves < 10 ? (routeLessonReady ? "STEP 4  TAP THE ROUTE" : "STEP 4  SHAPE THE SCAN") : learnedRun ? "PRISM OVERDRIVE" : "FULL SYSTEMS ONLINE";
  const guideText = moves === 0 ? "Connected tiles break together. Follow the arrow." : moves < 2 ? "Bigger connected group = bigger score." : moves < 6 ? "Clear the simple TARGET below. Follow the arrow when it helps." : moves < 10 ? (routeLessonReady ? "The glowing ROUTE sets up the scanned next tile. Tap it now." : `Column ${scanColumn + 1} is scanned. Clear one connected group in that lane.`) : learnedRun ? "TARGET • ROUTE • CASH OUT • BOSS CORE" : "CASH OUT saves score. Three TARGETS summon BOSS CORE. Tap ? anytime.";

  if (screen === "intro") {
    return <main className={styles.shell} data-screen="intro">
      <button className={styles.exit} type="button" onClick={onExit}>◀ MODE</button>
      <div className={styles.introLogo}><span>PRISM</span><strong>OVERDRIVE</strong><em>3 MINUTE HYPER CLUSTER MODE</em></div>
      <div className={styles.introCore} aria-hidden="true">◆</div>
      <div className={styles.introRules}>
        <b>ONE RULE TO START</b>
        <strong>TAP CONNECTED TILES</strong>
        <span>BIGGER GROUP = BIGGER SCORE</span>
        <span>THE GAME TEACHES THE REST</span>
      </div>
      <button className={styles.start} type="button" onClick={startRun}>▶ START OVERDRIVE</button>
      <small className={styles.record}>HIGH SCORE {highScore.toLocaleString()}</small>
    </main>;
  }

  return <main data-hype={combo >= 30 ? "max" : combo >= 15 ? "high" : combo >= 5 ? "mid" : "low"} className={`${styles.shell} ${feverActive ? styles.fever : ""} ${overFeverActive ? styles.overFever : ""} ${finalOverdrive ? styles.final : ""}`}>
    <div className={styles.backFx} aria-hidden="true"><i /><i /><i /><b /><u /><span /></div>
    <header className={styles.topbar}>
      <button className={styles.exit} type="button" onClick={onExit}>◀ MODE</button>
      <div><span>SCORE</span><strong>{score.toLocaleString()}</strong><i>{lastGain > 0 ? `+${lastGain.toLocaleString()}` : ""}</i></div>
      <div className={styles.timer} data-stopped={timeStopped ? "true" : "false"}><span>{timeStopped ? "TIME STOP" : finalOverdrive ? "FINAL" : "TIME"}</span><strong>{timeSeconds}</strong></div>
    </header>

    {fullSystems ? <section className={styles.hypeRow}>
      <div className={styles.combo}><span>COMBO</span><strong>×{combo}</strong><em>MULTI ×{multiplier.toFixed(1)}</em><i><u style={{ width: `${clamp(comboWindowMs / Math.max(1, comboWindowMax) * 100, 0, 100)}%` }} /></i></div>
      <div className={styles.feverMeter}><span>{overFeverActive ? "OVER FEVER" : feverActive ? "PRISM FEVER" : "FEVER"}</span><strong>{Math.round(fever)}%</strong><i><u style={{ width: `${fever}%` }} /></i></div>
      <div className={styles.jackpot}><span>JACKPOT</span><strong>{"◆".repeat(jackpot)}{"◇".repeat(3 - jackpot)}</strong></div>
    </section> : null}

    <section className={styles.guideBar} data-done={beginner ? "false" : "true"} data-learned={learnedRun ? "true" : "false"}>
      <div><strong>{guideTitle}</strong><span>{guideText}</span></div>
      <button type="button" aria-label="Help" onClick={() => { lastTickRef.current = performance.now(); setShowHelp(true); }}>?</button>
    </section>

    {(!beginner || showBeginnerTarget) ? <section className={`${styles.strategyPanel} ${beginner ? styles.strategyBeginner : routeLesson ? styles.strategyRouteLesson : ""}`} data-target-pulse={targetPulse ? "true" : "false"} aria-label="Overdrive strategy panel">
      {fullSystems ? <div className={styles.phaseCard} data-phase={runPhase}><span>PHASE</span><strong>{PHASE_META[runPhase].label}</strong><em>{PHASE_META[runPhase].note}</em></div> : null}
      <div className={styles.targetCard}><span>{beginner ? "YOUR TARGET" : "PRISM TARGET"}</span><strong>{target.label}</strong><em>{beginner ? "MATCH THIS FOR A BONUS" : `${targetProgressText(target)} • +${target.reward.toLocaleString()}`}</em></div>
      {moves >= 6 ? <div className={styles.scanCard} data-route={routePlan ? "ready" : "none"}><span>{routeLesson ? `SCANNED COLUMN ${scanColumn + 1}` : `NEXT SCAN • COL ${scanColumn + 1}`}</span><strong data-type={scanType}>{GLYPH[scanType]} {LABEL[scanType]}</strong><em>{routePlan ? (routeLesson ? `ROUTE READY • TAP GLOWING GROUP` : `ROUTE READY → ${LABEL[routePlan.type]} ×${routePlan.projected}`) : (routeLesson ? "CLEAR 1 GROUP IN THIS LANE" : "NO ROUTE • SHAPE THE COLUMN")}</em></div> : null}
      {fullSystems ? <button className={styles.cashOut} type="button" disabled={comboBank <= 0 || resolving} onClick={cashOut}><span>CASH OUT</span><strong>+{cashValue.toLocaleString()}</strong><em>{comboBank > 0 ? "SAVE SCORE / END COMBO" : "COMBO BUILDS THE BANK"}</em></button> : null}
      {fullSystems ? <div className={styles.missionCard} data-boss={bossCoreHp > 0 ? "active" : "idle"} data-breaks={bossBreaks}><span>{bossCoreHp > 0 ? "BOSS CORE" : "MISSION STREAK"}</span><strong>{bossCoreHp > 0 ? `HP ${bossCoreHp}/${bossCoreMax}` : `${"◆".repeat(missionStreak)}${"◇".repeat(3-missionStreak)}  ${missionStreak}/3`}</strong><em>{bossCoreHp > 0 ? "HIT WITH RELEASE / ROUTE / CHAIN" : "CLEAR 3 TARGETS IN ONE COMBO"}</em><u><i style={{ width: `${bossCoreHp > 0 ? bossCoreHp / Math.max(1, bossCoreMax) * 100 : missionStreak / 3 * 100}%` }} /></u></div> : null}
      {fullSystems ? <div className={styles.chargeRow} aria-label="Prism charge meters">{TYPES.map((type) => <span key={type} className={styles.chargeItem} data-type={type} data-value={charge[type]}><i>{GLYPH[type]}</i><b>{charge[type]}</b><u><em style={{ width: `${charge[type]}%` }} /></u></span>)}</div> : null}
    </section> : null}

    <section className={styles.boardWrap} data-impact={actionFx?.kind ?? "idle"} data-phase={boardFx?.phase ?? "idle"} data-chain={boardFx?.chain ?? 0} data-jackpot={jackpotFlash ? "true" : "false"} data-afterglow={jackpotAfterglow ? "true" : "false"} data-route-pulse={routePulse ? "true" : "false"}>
      <div className={styles.rank}>{lastRank || (resolving ? "BREAK!" : "KEEP MOVING")}</div>
      <div className={styles.board} aria-label="Prism Overdrive Cluster Break board">
        {routeLesson ? <div className={styles.scanLane} data-ready={routeLessonReady ? "true" : "false"} style={{ left: `${scanColumn / SIZE * 100}%`, width: `${100 / SIZE}%` }} aria-hidden="true"><span>{routeLessonReady ? "ROUTE" : "SCAN"}</span></div> : null}
        {moves >= 6 ? <div className={styles.scanMarker} data-type={scanType} style={{ left: `${(scanColumn + .5) / SIZE * 100}%` }} aria-hidden="true"><b>▼</b><span>{GLYPH[scanType]}</span></div> : null}
        {tiles.map((tile) => <button
          key={tile.id}
          type="button"
          className={`${styles.tile} ${styles[tile.type]} ${focusIds.has(tile.id) ? styles.focused : ""} ${clearingIds.has(tile.id) ? styles.clearing : ""} ${boardFx?.phase === "drop" && boardFx.columns.includes(tile.col) ? styles.dropping : ""} ${pressedId === tile.id ? styles.pressed : ""} ${moves >= 6 && routeIds.has(tile.id) ? styles.routeReady : ""} ${beginner && recommended.has(tile.id) ? styles.recommended : ""} ${beginner && tile.id === recommendedLead ? styles.recommendedLead : ""}`}
          style={{
            left: `calc(${tile.col * (100 / SIZE)}% + 1px)`,
            top: `calc(${tile.row * (100 / SIZE)}% + 1px)`,
            animationDelay: boardFx?.phase === "drop" && boardFx.columns.includes(tile.col) ? `${tile.row * 22}ms` : undefined,
            "--focus-delay": `${focusDelays[tile.id] ?? 0}ms`,
            "--tile-delay": `${tile.row * 14 + tile.col * 9}ms`,
          } as CSSProperties}
          disabled={resolving || screen !== "running"}
          aria-label={`${LABEL[tile.type]} cluster panel row ${tile.row + 1} column ${tile.col + 1}`}
          onPointerDown={() => { setPressedId(tile.id); playOverdriveSfx("tap", 0.72); }}
          onPointerUp={() => setPressedId(null)}
          onPointerCancel={() => setPressedId(null)}
          onPointerLeave={() => setPressedId((value) => value === tile.id ? null : value)}
          onClick={() => { setPressedId(null); void clearCluster(tile); }}
        ><b>{GLYPH[tile.type]}</b><span>{LABEL[tile.type]}</span></button>)}
        {boardFx ? <div key={boardFx.token} className={styles.spatialFx} data-kind={boardFx.kind} data-phase={boardFx.phase} data-mega={boardFx.mega ? "true" : "false"} data-chain={boardFx.chain} aria-hidden="true">
          {boardFx.kind === "cascade" && boardFx.phase !== "drop" && boardFx.links?.length ? <svg className={styles.chainPath} viewBox="0 0 100 100" preserveAspectRatio="none">
            {boardFx.links.map((link, index) => <line key={index} x1={link.x1} y1={link.y1} x2={link.x2} y2={link.y2} />)}
          </svg> : null}
          {boardFx.phase !== "drop" ? <>
            <i className={styles.impactRing} style={{ left: `${boardFx.x}%`, top: `${boardFx.y}%` }} />
            <i className={styles.impactCore} style={{ left: `${boardFx.x}%`, top: `${boardFx.y}%` }} />
            <span className={styles.shardField} style={{ left: `${boardFx.x}%`, top: `${boardFx.y}%` }}>{Array.from({ length: 10 }, (_, index) => <i key={index} />)}</span>
            {boardFx.phase === "burst" && boardFx.points > 0 ? <strong className={styles.scorePop} data-score={`+${boardFx.points.toLocaleString()}`} style={{ left: `${boardFx.x}%`, top: `${boardFx.y}%` }}>+{boardFx.points.toLocaleString()}</strong> : null}
            {boardFx.chain > 0 ? <em className={styles.chainStamp} style={{ left: `${boardFx.x}%`, top: `${boardFx.y}%` }}>CHAIN {boardFx.chain}</em> : null}
          </> : null}
          {boardFx.phase === "drop" ? <span className={styles.dropField}>{boardFx.columns.map((column) => <i key={column} style={{ left: `${(column + 0.5) / SIZE * 100}%` }} />)}</span> : null}
        </div> : null}
      </div>
      {actionFx ? <div key={`burst-${actionFx.token}`} className={styles.boardBurst} data-kind={actionFx.kind} aria-hidden="true"><i /><b /><u /></div> : null}
      {jackpotFlash ? <div className={styles.jackpotFlash}><span>PRISM</span><strong>JACKPOT!</strong></div> : null}
      {timeStopped ? <div className={styles.timeStopFx}><i>⏱</i><strong>TIME STOP</strong></div> : null}
    </section>

    {showHelp ? <div className={styles.helpOverlay} role="dialog" aria-label="Prism Overdrive help"><div><button type="button" aria-label="Close help" onClick={() => { lastTickRef.current = performance.now(); setShowHelp(false); }}>X</button><h2>HOW TO PLAY</h2><p><b>1.</b> TAP CONNECTED TILES</p><p><b>2.</b> BIGGER GROUP = BIGGER SCORE</p><p><b>3.</b> MATCH TARGET = BONUS</p><p><b>4.</b> ROUTE = GOOD CHAIN SETUP</p><p><b>5.</b> CASH OUT = SAVE BANKED SCORE</p><small>Ignore CHARGE and BOSS CORE at first. The game will introduce them naturally.</small></div></div> : null}

    {modeFx ? <div key={modeFx.token} className={styles.modeTransform} data-kind={modeFx.kind} aria-hidden="true">
      <i /><b /><u /><strong>{modeFx.title}</strong><span>{modeFx.detail}</span>
    </div> : null}

    <section className={styles.actionFeed} data-kind={actionFx?.kind ?? "idle"} aria-live="polite">
      {actionFx ? <div key={actionFx.token} className={styles.actionFx} data-kind={actionFx.kind} role="status">
        <i>{actionFx.icon}</i><strong>{actionFx.title}</strong><span>{actionFx.detail}</span>
      </div> : beginner ? <div className={styles.actionIdle}><b>FOLLOW TAP</b><span>CONNECTED TILES BREAK TOGETHER</span></div> : routeLesson ? <div className={styles.actionIdle}><b>{routePlan ? "ROUTE READY" : "MAKE A ROUTE"}</b><span>{routePlan ? "CLEAR THE HIGHLIGHTED GROUP" : "CLEAR A GROUP IN THE SCANNED COLUMN"}</span></div> : <div className={styles.actionIdle}><b>{routePlan ? "ROUTE READY" : "PLAN THE BREAK"}</b><span>{routePlan ? `HIGHLIGHTED BREAK → SCANNED ${LABEL[routePlan.type]} ×${routePlan.projected}` : "CHARGE → TARGET ×3 → BOSS CORE → CASH OUT OR PUSH"}</span></div>}
    </section>

    {fullSystems ? <>
      <section className={styles.runInfo}>
        <span>BIGGEST <b>×{largest}</b></span><span>LEVEL <b>{runLevel}</b></span><span>BEST COMBO <b>×{maxCombo}</b></span>
      </section>
      <div className={styles.message} role="status">{message}</div>
      <div className={styles.build}>{upgrades.map((id) => <i key={id}>{UPGRADES.find((upgrade) => upgrade.id === id)?.name}</i>)}</div>
    </> : null}

    {finalOverdrive ? <div className={styles.finalBanner}>FINAL OVERDRIVE • 30 SEC • NO STOP • SCORE BOOST</div> : null}

    {false && upgradeChoices.length > 0 ? <div className={styles.overlay} role="dialog" aria-label="Choose Overdrive upgrade">
      <div className={styles.upgradeCard}><span>OVERDRIVE LEVEL {runLevel + 1}</span><strong>CHOOSE 1</strong><p>ゲームを壊す能力を追加する</p>
        <div>{upgradeChoices.map((upgrade) => <button key={upgrade.id} type="button" data-tag={upgrade.tag} onClick={() => pickUpgrade(upgrade.id)}><b>{upgrade.icon}</b><span><strong>{upgrade.name}</strong><small>{upgrade.description}</small></span></button>)}</div>
      </div>
    </div> : null}

    {screen === "finished" ? <div className={styles.overlay} role="dialog" aria-label="Prism Overdrive result">
      <div className={styles.resultCard}><span>RUN COMPLETE</span><strong>{score.toLocaleString()}</strong>{score >= highScore && score > 0 ? <b>NEW RECORD!</b> : null}
        <div><span>MAX COMBO <b>×{maxCombo}</b></span><span>CORE BREAK <b>×{bossBreaks}</b></span><span>HIGH SCORE <b>{Math.max(score, highScore).toLocaleString()}</b></span></div>
        <button type="button" onClick={startRun}>▶ ONE MORE RUN</button><button type="button" onClick={onExit}>◀ MODE SELECT</button>
      </div>
    </div> : null}
  </main>;
}
