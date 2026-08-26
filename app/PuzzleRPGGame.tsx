"use client";

import { useMemo, useState, type CSSProperties } from "react";
import styles from "./PuzzleRPGGame.module.css";
import { EnemySprite } from "./enemyAssets";
import { playSfx, primeAudio, type GameSfx } from "./gameAudio";

type Orb = "fire" | "water" | "light" | "heart" | "guard";
type Board = Orb[][];
type Coord = { row: number; col: number };
type ColumnQueues = Orb[][];
type IntentKind = "attack" | "heavy" | "pierce" | "drain" | "disrupt";
type EnemyKind = "warden" | "bastion" | "oracle" | "null" | "trickster";
type ResolutionPhase = "idle" | "swap" | "clear" | "drop" | "attack" | "enemy" | "victory";
type SwapMotion = { a: Coord; b: Coord } | null;
type StageClearState = { stage: number; gold: number; xp: number } | null;

type EnemyDefinition = {
  kind: EnemyKind;
  name: string;
  passive: string;
  armor: number;
};

type EnemyIntent = {
  kind: IntentKind;
  label: string;
  icon: string;
  power: number;
  detail: string;
};

type MoveAnalysis = {
  immediateMoves: number;
  bestSetupScore: number;
  setupHintCells: Set<string>;
};

type MovePreviewTone = "attack" | "block" | "heal" | "shield" | "setup" | "combo";
type MovePreview = {
  label: string;
  tone: MovePreviewTone;
  attack: number;
  combo: number;
  breaksPlate: boolean;
};

type PrismOpportunity = { row: number; col: number; orb: Orb; attack: number } | null;

type CascadeFrame = {
  boardBefore: Board;
  matches: Set<string>;
  boardAfter: Board;
  queuesAfter: ColumnQueues;
  attack: number;
  heal: number;
  shield: number;
  largestAttackRun: number;
};

type CascadePlan = {
  frames: CascadeFrame[];
  finalBoard: Board;
  finalQueues: ColumnQueues;
  combo: number;
  attack: number;
  heal: number;
  shield: number;
  matchedCount: number;
  largestAttackRun: number;
};

type EnemyActionResult = {
  hpAfter: number;
  shieldAfter: number;
  enemyHpAfter: number;
  queuesAfter: ColumnQueues;
  hpDamage: number;
  blocked: number;
  summary: string;
};

const SIZE = 6;
const PLAYER_MAX_HP = 100;
const PLAYER_MAX_SHIELD = 60;
const COLUMN_QUEUE_DEPTH = 14;
const ORBS: Orb[] = ["fire", "water", "light", "heart", "guard"];

const ORB_LABEL: Record<Orb, string> = {
  fire: "🔥",
  water: "💧",
  light: "✦",
  heart: "♥",
  guard: "⬢",
};

const ORB_NAME: Record<Orb, string> = {
  fire: "fire",
  water: "water",
  light: "light",
  heart: "heart",
  guard: "guard",
};

const ATTACK_PER_ORB: Record<Orb, number> = {
  fire: 7,
  water: 6,
  light: 8,
  heart: 0,
  guard: 0,
};

const ENEMY_SIGIL: Record<EnemyKind, string> = {
  warden: "◆",
  bastion: "▣",
  oracle: "☿",
  null: "✧",
  trickster: "◈",
};

const ENEMY_DIALOGUE: Record<EnemyKind, string> = {
  warden: "盤面の先まで見えている。焦って消せば、次の一手を失うぞ。",
  bastion: "三つ並べただけでは、この装甲は砕けない。",
  oracle: "傷を見せなさい。その痛みごと、私の命に変えてあげる。",
  null: "盾に頼るな。次の刃は、その向こう側へ届く。",
  trickster: "NEXTを信じる？ なら、並びを少しだけ変えてあげよう。",
};

const ENEMY_HINT: Record<EnemyKind, string> = {
  warden: "3手目の強打をNOW/NEXTで確認。先にDEFを作るか、撃破を狙う。",
  bastion: "単発3消し攻撃は無効。4消しか2 COMBO以上を仕込む。",
  oracle: "DRAIN前はHP受けを避け、DEFで吸収を止める。",
  null: "PIERCEはDEF無視。回復・撃破・次ターン用DEFの準備を優先。",
  trickster: "DISRUPT前に列別NEXTを使い切るか、シフト後の列を予測する。",
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function randomOrb(): Orb {
  return ORBS[Math.floor(Math.random() * ORBS.length)]!;
}

function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

function cloneQueues(queues: ColumnQueues): ColumnQueues {
  return queues.map((queue) => [...queue]);
}

function makeColumnQueues(): ColumnQueues {
  return Array.from({ length: SIZE }, () =>
    Array.from({ length: COLUMN_QUEUE_DEPTH }, () => randomOrb()),
  );
}

function refillColumnQueues(queues: ColumnQueues): ColumnQueues {
  const next = cloneQueues(queues);
  for (const queue of next) {
    while (queue.length < COLUMN_QUEUE_DEPTH) queue.push(randomOrb());
  }
  return next;
}

function makeBoard(): Board {
  const board: Board = Array.from({ length: SIZE }, () => Array<Orb>(SIZE).fill("fire"));
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      let next = randomOrb();
      let guard = 0;
      while (
        guard < 24 &&
        ((col >= 2 && board[row]![col - 1] === next && board[row]![col - 2] === next) ||
          (row >= 2 && board[row - 1]![col] === next && board[row - 2]![col] === next))
      ) {
        next = randomOrb();
        guard += 1;
      }
      board[row]![col] = next;
    }
  }
  return board;
}

function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

function findMatches(board: Board): Set<string> {
  const matches = new Set<string>();

  for (let row = 0; row < SIZE; row += 1) {
    let start = 0;
    for (let col = 1; col <= SIZE; col += 1) {
      if (col < SIZE && board[row]![col] === board[row]![start]) continue;
      if (col - start >= 3) {
        for (let x = start; x < col; x += 1) matches.add(cellKey(row, x));
      }
      start = col;
    }
  }

  for (let col = 0; col < SIZE; col += 1) {
    let start = 0;
    for (let row = 1; row <= SIZE; row += 1) {
      if (row < SIZE && board[row]![col] === board[start]![col]) continue;
      if (row - start >= 3) {
        for (let y = start; y < row; y += 1) matches.add(cellKey(y, col));
      }
      start = row;
    }
  }

  return matches;
}

function maxAttackRun(board: Board): number {
  let maxRun = 0;
  const isAttack = (orb: Orb) => ATTACK_PER_ORB[orb] > 0;

  for (let row = 0; row < SIZE; row += 1) {
    let start = 0;
    for (let col = 1; col <= SIZE; col += 1) {
      if (col < SIZE && board[row]![col] === board[row]![start]) continue;
      const run = col - start;
      if (run >= 3 && isAttack(board[row]![start]!)) maxRun = Math.max(maxRun, run);
      start = col;
    }
  }

  for (let col = 0; col < SIZE; col += 1) {
    let start = 0;
    for (let row = 1; row <= SIZE; row += 1) {
      if (row < SIZE && board[row]![col] === board[start]![col]) continue;
      const run = row - start;
      if (run >= 3 && isAttack(board[start]![col]!)) maxRun = Math.max(maxRun, run);
      start = row;
    }
  }

  return maxRun;
}

function collapse(board: Board, matches: Set<string>, columnQueues: ColumnQueues) {
  const next = cloneBoard(board);
  const queues = cloneQueues(columnQueues);

  for (let col = 0; col < SIZE; col += 1) {
    const survivors: Orb[] = [];
    for (let row = 0; row < SIZE; row += 1) {
      if (!matches.has(cellKey(row, col))) survivors.push(next[row]![col]!);
    }

    const holes = SIZE - survivors.length;
    for (let row = 0; row < holes; row += 1) {
      const queue = queues[col]!;
      next[row]![col] = queue.shift() ?? randomOrb();
    }
    for (let row = holes; row < SIZE; row += 1) {
      next[row]![col] = survivors[row - holes]!;
    }
  }

  return { board: next, columnQueues: refillColumnQueues(queues) };
}

function buildCascadePlan(board: Board, columnQueues: ColumnQueues): CascadePlan {
  let next = cloneBoard(board);
  let queues = cloneQueues(columnQueues);
  const frames: CascadeFrame[] = [];
  let weightedAttack = 0;
  let heal = 0;
  let shield = 0;
  let matchedCount = 0;
  let largestAttackRun = 0;

  for (let safety = 0; safety < 12; safety += 1) {
    const matches = findMatches(next);
    if (matches.size === 0) break;

    let frameAttack = 0;
    let frameHeal = 0;
    let frameShield = 0;
    const frameLargestAttackRun = maxAttackRun(next);
    largestAttackRun = Math.max(largestAttackRun, frameLargestAttackRun);
    matchedCount += matches.size;

    for (const key of matches) {
      const [rowText, colText] = key.split(":");
      const row = Number(rowText);
      const col = Number(colText);
      const orb = next[row]![col]!;
      if (orb === "heart") frameHeal += 4;
      else if (orb === "guard") frameShield += 6;
      else frameAttack += ATTACK_PER_ORB[orb];
    }

    // 後段の偶発落ちコンほど攻撃寄与を弱める。NEXTを読んだ意図的な連鎖は
    // 回復・防御・ゲージ面で十分に価値が残る。
    const cascadeWeight = safety === 0 ? 1 : safety === 1 ? 0.72 : 0.55;
    weightedAttack += frameAttack * cascadeWeight;
    heal += frameHeal;
    shield += frameShield;

    const collapsed = collapse(next, matches, queues);
    frames.push({
      boardBefore: cloneBoard(next),
      matches: new Set(matches),
      boardAfter: cloneBoard(collapsed.board),
      queuesAfter: cloneQueues(collapsed.columnQueues),
      attack: frameAttack,
      heal: frameHeal,
      shield: frameShield,
      largestAttackRun: frameLargestAttackRun,
    });
    next = collapsed.board;
    queues = collapsed.columnQueues;
  }

  const combo = frames.length;
  const comboMultiplier = 1 + Math.min(0.3, Math.max(0, combo - 1) * 0.15);
  const resourceMultiplier = 1 + Math.min(0.2, Math.max(0, combo - 1) * 0.1);

  return {
    frames,
    finalBoard: next,
    finalQueues: refillColumnQueues(queues),
    combo,
    attack: Math.floor(weightedAttack * comboMultiplier),
    heal: Math.floor(heal * resourceMultiplier),
    shield: Math.floor(shield * resourceMultiplier),
    matchedCount,
    largestAttackRun,
  };
}


const MATCH_SFX_BY_ORB: Record<Orb, GameSfx> = {
  fire: "matchFire",
  water: "matchWater",
  light: "matchLight",
  heart: "matchHeart",
  guard: "matchGuard",
};

const ATTACK_SFX_BY_ORB: Partial<Record<Orb, GameSfx>> = {
  fire: "attackFire",
  water: "attackWater",
  light: "attackLight",
};

function dominantAttackOrb(plan: CascadePlan): Orb | null {
  const counts = new Map<Orb, number>();
  for (const frame of plan.frames) {
    for (const key of frame.matches) {
      const [rowText, colText] = key.split(":");
      const orb = frame.boardBefore[Number(rowText)]![Number(colText)]!;
      if (ATTACK_PER_ORB[orb] > 0) counts.set(orb, (counts.get(orb) ?? 0) + 1);
    }
  }
  let best: Orb | null = null;
  let bestCount = 0;
  for (const [orb, count] of counts) {
    if (count > bestCount) { best = orb; bestCount = count; }
  }
  return best;
}

function enemyEffectSfx(intent: EnemyIntent): GameSfx {
  if (intent.kind === "heavy") return "enemyHeavy";
  if (intent.kind === "pierce") return "pierce";
  if (intent.kind === "drain") return "enemyDrain";
  if (intent.kind === "disrupt") return "enemyDisrupt";
  return "enemyAttack";
}

function computeDropDistances(matches: Set<string>): Map<string, number> {
  const distances = new Map<string, number>();
  for (let col = 0; col < SIZE; col += 1) {
    const survivorRows: number[] = [];
    let holes = 0;
    for (let row = 0; row < SIZE; row += 1) {
      if (matches.has(cellKey(row, col))) holes += 1;
      else survivorRows.push(row);
    }
    for (let row = 0; row < holes; row += 1) {
      distances.set(cellKey(row, col), Math.min(6, holes - row + 1));
    }
    survivorRows.forEach((sourceRow, index) => {
      const destRow = holes + index;
      const distance = destRow - sourceRow;
      if (distance > 0) distances.set(cellKey(destRow, col), Math.min(6, distance));
    });
  }
  return distances;
}

function adjacent(a: Coord, b: Coord): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

function swapCells(board: Board, a: Coord, b: Coord): Board {
  const next = cloneBoard(board);
  const first = next[a.row]![a.col]!;
  next[a.row]![a.col] = next[b.row]![b.col]!;
  next[b.row]![b.col] = first;
  return next;
}

function adjacentPairs(): Array<[Coord, Coord]> {
  const pairs: Array<[Coord, Coord]> = [];
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (col + 1 < SIZE) pairs.push([{ row, col }, { row, col: col + 1 }]);
      if (row + 1 < SIZE) pairs.push([{ row, col }, { row: row + 1, col }]);
    }
  }
  return pairs;
}

const ALL_PAIRS = adjacentPairs();

function countImmediateMoves(board: Board): number {
  let count = 0;
  for (const [a, b] of ALL_PAIRS) {
    if (findMatches(swapCells(board, a, b)).size > 0) count += 1;
  }
  return count;
}

function analyzeBoard(board: Board): MoveAnalysis {
  const immediateMoves = countImmediateMoves(board);
  let bestSetupScore = 0;
  const bestPairs: Array<[Coord, Coord]> = [];

  // SETUP is an intentional tactical option even when a match exists. Only
  // non-clearing swaps are ranked here so the hint never masquerades as an attack.
  for (const [a, b] of ALL_PAIRS) {
    const swapped = swapCells(board, a, b);
    if (findMatches(swapped).size > 0) continue;
    const score = countImmediateMoves(swapped);
    if (score > bestSetupScore) {
      bestSetupScore = score;
      bestPairs.length = 0;
      bestPairs.push([a, b]);
    } else if (score === bestSetupScore && score > 0 && bestPairs.length < 2) {
      bestPairs.push([a, b]);
    }
  }

  const setupHintCells = new Set<string>();
  for (const [a, b] of bestPairs) {
    setupHintCells.add(cellKey(a.row, a.col));
    setupHintCells.add(cellKey(b.row, b.col));
  }
  return { immediateMoves, bestSetupScore, setupHintCells };
}

function enemyMaxHp(stage: number): number {
  const early = Math.min(stage - 1, 5);
  const mid = Math.max(0, Math.min(stage - 6, 5));
  const late = Math.max(0, stage - 11);
  return 88 + early * 21 + mid * 16 + late * 21;
}

function enemyBaseAttack(stage: number): number {
  const early = Math.min(stage - 1, 5);
  const mid = Math.max(0, Math.min(stage - 6, 5));
  const late = Math.max(0, stage - 11);
  return 7 + Math.floor(early * 1.15 + mid * 0.8 + late * 1.15);
}

function enemyDefinition(stage: number): EnemyDefinition {
  const tier = Math.floor((stage - 1) / 5);
  switch ((stage - 1) % 5) {
    case 1:
      return {
        kind: "bastion",
        name: "IRON BASTION",
        passive: "PLATE：単発3消し攻撃を無効。4消し・連鎖で突破",
        armor: 4 + tier,
      };
    case 2:
      return {
        kind: "oracle",
        name: "BLOOD ORACLE",
        passive: "DRAIN：HPに通ったダメージだけ敵が回復",
        armor: 0,
      };
    case 3:
      return {
        kind: "null",
        name: "NULL KNIGHT",
        passive: "PIERCE：予告された貫通攻撃はSHIELDを無視",
        armor: 0,
      };
    case 4:
      return {
        kind: "trickster",
        name: "PRISM TRICKSTER",
        passive: "DISRUPT：列別NEXTを右へ1列ずらす",
        armor: 0,
      };
    default:
      return {
        kind: "warden",
        name: "VOID WARDEN",
        passive: "3手目に強打。2手先INTENTを読んで備える",
        armor: 0,
      };
  }
}


function previewResolvedBoard(board: Board, queues: ColumnQueues, enemy: EnemyDefinition): MovePreview {
  const plan = buildCascadePlan(board, queues);
  if (plan.frames.length === 0) {
    return { label: "SETUP", tone: "setup", attack: 0, combo: 0, breaksPlate: false };
  }
  const plateBlocks = enemy.kind === "bastion" && plan.attack > 0 && plan.combo === 1 && plan.largestAttackRun === 3;
  const armorReduction = !plateBlocks && plan.attack > 0 ? Math.min(enemy.armor, plan.attack) : 0;
  const attack = plateBlocks ? 0 : Math.max(0, plan.attack - armorReduction);
  if (plateBlocks) return { label: "PLATE ×", tone: "block", attack: 0, combo: plan.combo, breaksPlate: false };
  if (attack > 0) {
    const breaksPlate = enemy.kind === "bastion";
    const label = breaksPlate
      ? `BREAK ${attack}`
      : plan.combo >= 2 ? `${attack} · ${plan.combo}C` : `${attack} DMG`;
    return { label, tone: plan.combo >= 2 ? "combo" : "attack", attack, combo: plan.combo, breaksPlate };
  }
  if (plan.heal > 0) return { label: `HP +${plan.heal}`, tone: "heal", attack: 0, combo: plan.combo, breaksPlate: false };
  if (plan.shield > 0) return { label: `DEF +${plan.shield}`, tone: "shield", attack: 0, combo: plan.combo, breaksPlate: false };
  return { label: `${plan.combo} COMBO`, tone: "combo", attack: 0, combo: plan.combo, breaksPlate: false };
}

function findPrismBreakOpportunity(board: Board, queues: ColumnQueues, enemy: EnemyDefinition): PrismOpportunity {
  if (enemy.kind !== "bastion") return null;
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const before = board[row]![col]!;
      for (const orb of ORBS) {
        if (orb === before) continue;
        const transformed = cloneBoard(board);
        transformed[row]![col] = orb;
        const recycled = cloneQueues(queues);
        recycled[col]![0] = before;
        const preview = previewResolvedBoard(transformed, recycled, enemy);
        if (preview.breaksPlate && preview.attack > 0) return { row, col, orb, attack: preview.attack };
      }
    }
  }
  return null;
}

function enemyIntent(stage: number, enemyTurn: number, enemy: EnemyDefinition): EnemyIntent {
  const base = enemyBaseAttack(stage);
  const phase = enemyTurn % 3;

  if (enemy.kind === "bastion") {
    if (phase === 2) return { kind: "heavy", label: "CRUSH", icon: "💥", power: base + 6, detail: "次の強打。SHIELD推奨" };
    return { kind: "attack", label: "ATTACK", icon: "⚔", power: base + 1, detail: "SHIELDで軽減可能" };
  }

  if (enemy.kind === "oracle") {
    if (phase === 1) return { kind: "drain", label: "DRAIN", icon: "☠", power: base + 2, detail: "HPダメージ分だけ回復" };
    if (phase === 2) return { kind: "heavy", label: "BLOOD RITE", icon: "◆", power: base + 5, detail: "強打。吸収なし" };
    return { kind: "attack", label: "ATTACK", icon: "⚔", power: base, detail: "SHIELDで軽減可能" };
  }

  if (enemy.kind === "null") {
    if (phase === 1) return { kind: "pierce", label: "PIERCE", icon: "✧", power: base + 2, detail: "SHIELD無視。HPを確保" };
    return { kind: phase === 2 ? "heavy" : "attack", label: phase === 2 ? "CRUSH" : "ATTACK", icon: phase === 2 ? "💥" : "⚔", power: base + (phase === 2 ? 5 : 0), detail: "SHIELDで軽減可能" };
  }

  if (enemy.kind === "trickster") {
    if (phase === 0) return { kind: "disrupt", label: "DISRUPT", icon: "⟳", power: Math.max(4, base - 2), detail: "攻撃後、NEXT列を右へシフト" };
    if (phase === 2) return { kind: "heavy", label: "PRISM HIT", icon: "◇", power: base + 5, detail: "強打。今のNEXTを活用" };
    return { kind: "attack", label: "ATTACK", icon: "⚔", power: base, detail: "SHIELDで軽減可能" };
  }

  if (phase === 2) return { kind: "heavy", label: "VOID CRUSH", icon: "💥", power: base + 6, detail: "3手目の強打" };
  return { kind: "attack", label: "ATTACK", icon: "⚔", power: base, detail: "SHIELDで軽減可能" };
}

function disruptColumnQueues(queues: ColumnQueues): ColumnQueues {
  const next = cloneQueues(queues);
  const last = next.pop();
  return last ? [last, ...next] : next;
}

function computeEnemyAction(
  intent: EnemyIntent,
  maxEnemyHp: number,
  hpBefore: number,
  shieldBefore: number,
  enemyHpBefore: number,
  queuesBefore: ColumnQueues,
): EnemyActionResult {
  let hpAfter = hpBefore;
  let shieldAfter = shieldBefore;
  let enemyHpAfter = enemyHpBefore;
  let queuesAfter = cloneQueues(queuesBefore);
  let hpDamage = 0;
  let blocked = 0;
  let summary = "";

  if (intent.kind === "pierce") {
    hpDamage = intent.power;
    hpAfter = Math.max(0, hpBefore - hpDamage);
    summary = `${intent.label} -${hpDamage} HP`;
  } else {
    blocked = Math.min(shieldBefore, intent.power);
    hpDamage = intent.power - blocked;
    shieldAfter = shieldBefore - blocked;
    hpAfter = Math.max(0, hpBefore - hpDamage);

    if (intent.kind === "drain") {
      enemyHpAfter = Math.min(maxEnemyHp, enemyHpBefore + hpDamage);
      summary = hpDamage > 0 ? `${intent.label} -${hpDamage} / 敵+${hpDamage}` : `${intent.label} BLOCK`;
    } else if (intent.kind === "disrupt") {
      queuesAfter = disruptColumnQueues(queuesBefore);
      summary = `${intent.label}${hpDamage > 0 ? ` -${hpDamage}` : ""} / NEXT SHIFT`;
    } else {
      summary = hpDamage > 0 ? `${intent.label} -${hpDamage}` : `${intent.label} BLOCK`;
    }
  }

  return { hpAfter, shieldAfter, enemyHpAfter, queuesAfter, hpDamage, blocked, summary };
}

function newRun() {
  return {
    board: makeBoard(),
    columnQueues: makeColumnQueues(),
    hp: PLAYER_MAX_HP,
    shield: 0,
    stage: 1,
    enemyHp: enemyMaxHp(1),
    enemyTurn: 0,
    skill: 0,
    xp: 0,
    gold: 0,
  };
}

export default function PuzzleRPGGame() {
  const initial = useMemo(() => newRun(), []);
  const [board, setBoard] = useState<Board>(initial.board);
  const [columnQueues, setColumnQueues] = useState<ColumnQueues>(initial.columnQueues);
  const [selected, setSelected] = useState<Coord | null>(null);
  const [playerHp, setPlayerHp] = useState(initial.hp);
  const [playerShield, setPlayerShield] = useState(initial.shield);
  const [stage, setStage] = useState(initial.stage);
  const [enemyHp, setEnemyHp] = useState(initial.enemyHp);
  const [enemyTurn, setEnemyTurn] = useState(initial.enemyTurn);
  const [skill, setSkill] = useState(initial.skill);
  const [skillMode, setSkillMode] = useState(false);
  const [xp, setXp] = useState(initial.xp);
  const [gold, setGold] = useState(initial.gold);
  const [combo, setCombo] = useState(0);
  const [message, setMessage] = useState("INTENTを読み、攻撃・防御・SETUPを選ぶ");
  const [gameOver, setGameOver] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionPhase, setResolutionPhase] = useState<ResolutionPhase>("idle");
  const [clearingCells, setClearingCells] = useState<Set<string>>(new Set());
  const [combatPop, setCombatPop] = useState("");
  const [resultChips, setResultChips] = useState<string[]>([]);
  const [swapMotion, setSwapMotion] = useState<SwapMotion>(null);
  const [dropMotion, setDropMotion] = useState<Map<string, number>>(new Map());
  const [stageIntro, setStageIntro] = useState(true);
  const [stageClear, setStageClear] = useState<StageClearState>(null);
  const [showTitle, setShowTitle] = useState(true);
  const [damageTaken, setDamageTaken] = useState(0);
  const [attackSources, setAttackSources] = useState<Coord[]>([]);
  const [attackElement, setAttackElement] = useState<Orb | null>(null);

  const maxEnemyHp = enemyMaxHp(stage);
  const enemy = enemyDefinition(stage);
  const intent = enemyIntent(stage, enemyTurn, enemy);
  const nextIntent = enemyIntent(stage, enemyTurn + 1, enemy);
  const level = 1 + Math.floor(xp / 100);
  const xpIntoLevel = xp % 100;
  const analysis = useMemo(() => analyzeBoard(board), [board]);
  const prismBreakOpportunity = useMemo(() => skill >= 100 ? findPrismBreakOpportunity(board, columnQueues, enemy) : null, [board, columnQueues, skill, stage]);

  function reset() {
    if (isResolving) return;
    const next = newRun();
    setBoard(next.board);
    setColumnQueues(next.columnQueues);
    setSelected(null);
    setPlayerHp(next.hp);
    setPlayerShield(next.shield);
    setStage(next.stage);
    setEnemyHp(next.enemyHp);
    setEnemyTurn(next.enemyTurn);
    setSkill(next.skill);
    setSkillMode(false);
    setXp(next.xp);
    setGold(next.gold);
    setCombo(0);
    setMessage("INTENTを読み、攻撃・防御・SETUPを選ぶ");
    setGameOver(false);
    setResolutionPhase("idle");
    setClearingCells(new Set());
    setCombatPop("");
    setResultChips([]);
    setSwapMotion(null);
    setDropMotion(new Map());
    setStageIntro(true);
    setStageClear(null);
    setDamageTaken(0);
    setAttackSources([]);
    setAttackElement(null);
  }

  async function finishEnemyDefeat(currentStage: number) {
    const nextStage = currentStage + 1;
    const gainedGold = 12 + currentStage * 4;
    const gainedXp = 28 + currentStage * 6;
    playSfx("stageClear");
    setResolutionPhase("victory");
    setCombatPop("STAGE CLEAR!");
    setStageClear({ stage: currentStage, gold: gainedGold, xp: gainedXp });
    setGold((value) => value + gainedGold);
    setXp((value) => value + gainedXp);
    setMessage(`STAGE ${currentStage} CLEAR • 盤面/NEXT持ち越し`);
    await delay(1050);
    setPlayerShield((value) => Math.floor(value * 0.5));
    setStage(nextStage);
    setEnemyHp(enemyMaxHp(nextStage));
    setEnemyTurn(0);
    setStageClear(null);
    setStageIntro(true);
    setCombatPop("");
  }

  async function resolveTurn(nextBoard: Board, consumeSkill = false, skillLabel?: string, swapPair?: [Coord, Coord], queueOverride?: ColumnQueues) {
    if (isResolving || gameOver || showTitle || stageIntro || stageClear) return;
    setIsResolving(true);
    setSelected(null);
    setSkillMode(false);
    setResultChips([]);
    setCombatPop(skillLabel ?? "");

    const startingQueues = queueOverride ?? columnQueues;
    const plan = buildCascadePlan(nextBoard, startingQueues);
    const attackElementForTurn = dominantAttackOrb(plan);
    const isSetupTurn = plan.frames.length === 0 && !consumeSkill;
    const attackSourceList: Coord[] = [];
    for (const frame of plan.frames) {
      for (const key of frame.matches) {
        const [rowText, colText] = key.split(":");
        const row = Number(rowText);
        const col = Number(colText);
        if (ATTACK_PER_ORB[frame.boardBefore[row]![col]!] > 0) attackSourceList.push({ row, col });
      }
    }

    setResolutionPhase("swap");
    setSwapMotion(swapPair ? { a: swapPair[0], b: swapPair[1] } : null);
    setBoard(nextBoard);
    if (swapPair) playSfx("swap");
    await delay(swapPair ? 205 : 120);
    setSwapMotion(null);

    for (let index = 0; index < plan.frames.length; index += 1) {
      const frame = plan.frames[index]!;
      setBoard(frame.boardBefore);
      setClearingCells(frame.matches);
      setCombo(index + 1);
      setResolutionPhase("clear");
      const matchedOrbTypes = Array.from(new Set(Array.from(frame.matches).map((key) => {
        const [rowText, colText] = key.split(":");
        return frame.boardBefore[Number(rowText)]![Number(colText)]!;
      })));
      matchedOrbTypes.slice(0, 2).forEach((matchedOrb, toneIndex) => {
        window.setTimeout(() => playSfx(MATCH_SFX_BY_ORB[matchedOrb]), toneIndex * 24);
      });
      if (index > 0) playSfx("cascade");
      await delay(175);

      setClearingCells(new Set());
      setDropMotion(computeDropDistances(frame.matches));
      setBoard(frame.boardAfter);
      setColumnQueues(frame.queuesAfter);
      setResolutionPhase("drop");
      playSfx("drop");
      await delay(245);
      setDropMotion(new Map());
    }

    if (plan.frames.length === 0) {
      setBoard(nextBoard);
      if (isSetupTurn) playSfx("setup");
      setMessage(skillLabel ? `${skillLabel} • SETUP` : "SETUP • 次の形を作った");
    }

    const skillGain = isSetupTurn
      ? 28
      : Math.min(20, plan.matchedCount * 2 + Math.max(0, plan.combo - 1) * 4);
    setSkill(consumeSkill ? skillGain : Math.min(100, skill + skillGain));

    const healedHp = Math.min(PLAYER_MAX_HP, playerHp + plan.heal);
    const shieldBeforeEnemy = Math.min(PLAYER_MAX_SHIELD, playerShield + plan.shield);
    const plateBlocks =
      enemy.kind === "bastion" &&
      plan.attack > 0 &&
      plan.combo === 1 &&
      plan.largestAttackRun === 3;
    const armorReduction = !plateBlocks && plan.attack > 0 ? Math.min(enemy.armor, plan.attack) : 0;
    const actualAttack = plateBlocks ? 0 : Math.max(0, plan.attack - armorReduction);
    const enemyAfter = Math.max(0, enemyHp - actualAttack);

    setPlayerHp(healedHp);
    setPlayerShield(shieldBeforeEnemy);
    setEnemyHp(enemyAfter);
    if (plan.heal > 0) playSfx("heal");
    if (plan.shield > 0) playSfx("shield");
    if (armorReduction > 0) window.setTimeout(() => playSfx("armor"), 75);

    const chips: string[] = [];
    if (actualAttack > 0) chips.push(`${actualAttack} DMG`);
    if (plateBlocks) chips.push("PLATE BLOCK");
    if (armorReduction > 0) chips.push(`ARMOR -${armorReduction}`);
    if (plan.heal > 0) chips.push(`+${plan.heal} HP`);
    if (plan.shield > 0) chips.push(`+${plan.shield} DEF`);
    if (isSetupTurn) {
      chips.push("TACTICAL SETUP");
      chips.push("INTENT 50%");
      chips.push("PRISM +28");
    } else if (plan.frames.length === 0) {
      chips.push("SHIFT SETUP");
    }
    if (consumeSkill) chips.push("NEXT RECYCLE");
    setResultChips(chips);

    if (actualAttack > 0 || plateBlocks) {
      setAttackSources(attackSourceList.slice(0, 10));
      setAttackElement(attackElementForTurn);
      setResolutionPhase("attack");
      playSfx(plateBlocks ? "plateBlock" : (attackElementForTurn ? ATTACK_SFX_BY_ORB[attackElementForTurn] ?? "playerAttack" : "playerAttack"));
      setCombatPop(plateBlocks ? "PLATE BLOCK" : `${actualAttack} DMG`);
      await delay(440);
      setAttackSources([]);
      setAttackElement(null);
    }

    if (enemyAfter <= 0) {
      playSfx("enemyBreak");
      setCombatPop("BREAK!");
      await delay(250);
      await finishEnemyDefeat(stage);
      setCombo(0);
      setClearingCells(new Set());
      setResolutionPhase("idle");
      setIsResolving(false);
      setResultChips([]);
      return;
    }

    const effectiveIntent = isSetupTurn
      ? { ...intent, power: Math.max(1, Math.ceil(intent.power * 0.5)) }
      : intent;
    const enemyResult = computeEnemyAction(
      effectiveIntent,
      maxEnemyHp,
      healedHp,
      shieldBeforeEnemy,
      enemyAfter,
      plan.finalQueues,
    );

    setDamageTaken(enemyResult.hpDamage);
    setResolutionPhase("enemy");
    playSfx(enemyEffectSfx(effectiveIntent));
    if (enemyResult.hpDamage === 0) window.setTimeout(() => playSfx("block"), 70);
    setCombatPop(enemyResult.hpDamage > 0 ? `-${enemyResult.hpDamage} HP` : `BLOCK ${enemyResult.blocked}`);
    await delay(enemyResult.hpDamage > 0 ? 420 : 280);

    setPlayerHp(enemyResult.hpAfter);
    setPlayerShield(enemyResult.shieldAfter);
    setEnemyHp(enemyResult.enemyHpAfter);
    setColumnQueues(enemyResult.queuesAfter);
    setEnemyTurn((value) => value + 1);
    setMessage(
      isSetupTurn
        ? `TACTICAL SETUP • PRISM +28 • ${enemyResult.summary}`
        : plan.frames.length === 0
          ? `SHIFT SETUP • ${enemyResult.summary}`
        : `${actualAttack > 0 ? `${actualAttack} DMG • ` : ""}${enemyResult.summary}`,
    );

    if (enemyResult.hpAfter <= 0) {
      playSfx("gameOver");
      setGameOver(true);
      setMessage(`GAME OVER • ${enemyResult.summary}`);
    }

    setCombo(0);
    setClearingCells(new Set());
    setResolutionPhase("idle");
    setIsResolving(false);
    await delay(330);
    setDamageTaken(0);
    setCombatPop("");
    setResultChips([]);
  }

  function selectCell(row: number, col: number) {
    if (gameOver || showTitle || stageIntro || stageClear || isResolving) return;
    const nextCoord = { row, col };

    if (skillMode) {
      setSelected(nextCoord);
      setMessage("PRISM SHIFT • 変換色を選択");
      return;
    }

    if (!selected) {
      playSfx("uiSelect");
      setSelected(nextCoord);
      setMessage("①選択中 • ②光っている隣接パネルを選択");
      return;
    }

    if (selected.row === row && selected.col === col) {
      playSfx("uiSelect");
      setSelected(null);
      setMessage("選択解除 • 交換する1枚目を選択");
      return;
    }

    if (!adjacent(selected, nextCoord)) {
      playSfx("uiSelect");
      setSelected(nextCoord);
      setMessage("①選択を変更 • ②光っている隣接パネルを選択");
      return;
    }

    void resolveTurn(swapCells(board, selected, nextCoord), false, undefined, [selected, nextCoord]);
  }

  function toggleSkillMode() {
    if (gameOver || isResolving || stageIntro || stageClear || skill < 100) return;
    playSfx("uiConfirm");
    setSkillMode((value) => !value);
    setSelected(null);
    setMessage(skillMode ? "PRISM SHIFT CANCEL" : "PRISM SHIFT • 変換する1枚を選択");
  }

  function castShift(orb: Orb) {
    if (!skillMode || !selected || skill < 100 || gameOver || isResolving || stageIntro || stageClear) return;
    playSfx("skill");
    window.setTimeout(() => playSfx("prismRecycle"), 85);
    const transformed = cloneBoard(board);
    const before = transformed[selected.row]![selected.col]!;
    transformed[selected.row]![selected.col] = orb;
    const recycledQueues = cloneQueues(columnQueues);
    recycledQueues[selected.col]![0] = before;
    setColumnQueues(recycledQueues);
    void resolveTurn(transformed, true, `SHIFT ${ORB_LABEL[before]}→${ORB_LABEL[orb]} • NEXT↺`, undefined, recycledQueues);
  }

  const dangerousIntent = intent.kind === "heavy" || intent.kind === "pierce" || (intent.kind === "drain" && playerShield < intent.power);
  const setupRecommended = !isResolving && !stageIntro && !stageClear && dangerousIntent && analysis.bestSetupScore > 0;
  const setupMode = !isResolving && !stageIntro && !stageClear && analysis.bestSetupScore > 0 && (analysis.immediateMoves === 0 || setupRecommended);
  const enemyPixelClass = `${styles.enemyPixelSprite} ${resolutionPhase === "attack" ? styles.enemyPixelStruck : ""}`;

  const movePreviewFor = (row: number, col: number): MovePreview | null => {
    if (!selected || skillMode || !adjacent(selected, { row, col })) return null;
    return previewResolvedBoard(swapCells(board, selected, { row, col }), columnQueues, enemy);
  };

  const skillPreviewFor = (orb: Orb): MovePreview | null => {
    if (!selected) return null;
    const before = board[selected.row]![selected.col]!;
    if (before === orb) return null;
    const transformed = cloneBoard(board);
    transformed[selected.row]![selected.col] = orb;
    const recycled = cloneQueues(columnQueues);
    recycled[selected.col]![0] = before;
    return previewResolvedBoard(transformed, recycled, enemy);
  };
  const swapClassFor = (row: number, col: number): string => {
    if (!swapMotion) return "";
    const { a, b } = swapMotion;
    let source: Coord | null = null;
    let target: Coord | null = null;
    if (row === a.row && col === a.col) { source = b; target = a; }
    else if (row === b.row && col === b.col) { source = a; target = b; }
    if (!source || !target) return "";
    if (source.col < target.col) return styles.swapFromLeft;
    if (source.col > target.col) return styles.swapFromRight;
    if (source.row < target.row) return styles.swapFromUp;
    return styles.swapFromDown;
  };

  return (
    <main className={`${styles.shell} ${damageTaken > 0 ? styles.shellDamaged : ""}`}>
      <div className={styles.topBar}>
        <div>
          <div className={styles.eyebrow}>TACTICAL PUZZLE RPG</div>
          <div className={styles.stage}>STAGE {stage}</div>
        </div>
        <div className={styles.resources}>
          <span>LV {level}</span>
          <span>◈ {gold}</span>
        </div>
      </div>

      <section className={styles.enemyCard} aria-label="enemy status">
        <div className={styles.enemySceneGlow} aria-hidden="true" />
        <EnemySprite kind={enemy.kind} className={enemyPixelClass} />
        <div className={styles.enemyInfo}>
          <div className={styles.enemyHeader}>
            <div className={styles.enemyName}>{enemy.name} {stage}</div>
            {enemy.kind !== "warden" ? <span className={styles.specialTag}>SPECIAL</span> : null}
          </div>
          <div className={styles.hpTrack}>
            <div className={styles.enemyHpFill} style={{ width: `${(enemyHp / maxEnemyHp) * 100}%` }} />
          </div>
          <div className={styles.hpText}>{enemyHp} / {maxEnemyHp}</div>
          <div className={styles.passive}>{enemy.passive}</div>
        </div>
      </section>

      {resolutionPhase === "attack" ? (
        <div className={`${styles.playerAttackFx} ${attackElement ? styles[`attackFx_${attackElement}`] ?? "" : ""}`} aria-hidden="true">
          {attackSources.map((cell, index) => (
            <i
              key={`${cell.row}-${cell.col}-${index}`}
              style={{
                "--sx": `${3 + ((cell.col + 0.5) / SIZE) * 94}%`,
                "--sy": `${49 + ((cell.row + 0.5) / SIZE) * 43}%`,
                "--delay": `${index * 0.025}s`,
              } as CSSProperties}
            />
          ))}
          <strong className={styles.attackCharge}>{attackElement ? ORB_LABEL[attackElement] : "✦"}</strong>
          <span className={styles.attackTrail} />
          <b />
          <em className={styles.attackImpact}>HIT!</em>
        </div>
      ) : null}
      {resolutionPhase === "enemy" ? (
        <div className={`${styles.enemyAttackFx} ${styles[`enemyAttack_${intent.kind}`] ?? ""}`} aria-hidden="true"><i /><i /><i /></div>
      ) : null}
      {damageTaken > 0 ? (
        <div className={`${styles.damageVignette} ${intent.kind === "pierce" ? styles.damagePierce : ""}`} aria-hidden="true">
          <span>-{damageTaken} HP</span><i /><i /><i /><i />
        </div>
      ) : null}

      <section className={styles.intents} aria-label="enemy intents">
        <div className={`${styles.intentCard} ${setupRecommended ? styles.intentDanger : ""}`}>
          <div className={styles.intentTurn}>NOW</div>
          <div className={styles.intentIcon}>{intent.icon}</div>
          <div className={styles.intentBody}>
            <strong>{intent.label}</strong>
            <span>{intent.detail}</span>
          </div>
          <div className={styles.intentPower}>{intent.power}</div>
        </div>
        <div className={`${styles.intentCard} ${styles.intentNext}`}>
          <div className={styles.intentTurn}>NEXT</div>
          <div className={styles.intentIcon}>{nextIntent.icon}</div>
          <div className={styles.intentBody}>
            <strong>{nextIntent.label}</strong>
            <span>{nextIntent.detail}</span>
          </div>
          <div className={styles.intentPower}>{nextIntent.power}</div>
        </div>
      </section>

      <section className={`${styles.playerStrip} ${resolutionPhase === "enemy" ? styles.playerStruck : ""}`} aria-label="player status">
        <div className={styles.playerRow}>
          <span>HP</span><strong>{playerHp}</strong>
          <div className={styles.playerHpTrack}><div className={styles.playerHpFill} style={{ width: `${playerHp}%` }} /></div>
        </div>
        <div className={styles.shieldRow}>
          <span>DEF</span><strong>{playerShield}</strong>
          <div className={styles.shieldTrack}><div className={styles.shieldFill} style={{ width: `${(playerShield / PLAYER_MAX_SHIELD) * 100}%` }} /></div>
        </div>
        <div className={styles.xpRow}>
          <span>XP</span>
          <div className={styles.xpTrack}><div className={styles.xpFill} style={{ width: `${xpIntoLevel}%` }} /></div>
        </div>
      </section>

      <section className={styles.puzzleZone} aria-label="puzzle zone">
        <section className={styles.nextStrip} aria-label="column next puzzle orbs">
          <div className={styles.nextHeader}>
            <strong>NEXT ↓</strong>
            <span>各列 1st / 2nd</span>
          </div>
          <div className={styles.nextColumns}>
            {columnQueues.map((queue, colIndex) => (
              <div key={colIndex} className={styles.nextColumn} aria-label={`column ${colIndex + 1} next`}>
                <div className={`${styles.nextOrbBack} ${styles[queue[1]!]}`}>{ORB_LABEL[queue[1]!]}</div>
                <div className={`${styles.nextOrb} ${styles[queue[0]!]}`}>{ORB_LABEL[queue[0]!]}</div>
                <span className={styles.dropArrow}>↓</span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.boardWrap} aria-label="puzzle board">
          <div className={`${styles.board} ${selected && !skillMode ? styles.awaitingNeighbor : ""}`}>
            {board.map((row, rowIndex) => row.map((orb, colIndex) => {
              const key = cellKey(rowIndex, colIndex);
              const isSelected = selected?.row === rowIndex && selected?.col === colIndex;
              const isAdjacentChoice = Boolean(selected && !skillMode && !isSelected && adjacent(selected, { row: rowIndex, col: colIndex }));
              const movePreview = isAdjacentChoice ? movePreviewFor(rowIndex, colIndex) : null;
              const setupHint = setupMode && analysis.setupHintCells.has(key);
              const isClearing = clearingCells.has(key);
              const swapClass = swapClassFor(rowIndex, colIndex);
              const dropDistance = dropMotion.get(key) ?? 0;
              const dropClass = dropDistance > 0 ? styles[`drop${dropDistance}`] : "";
              return (
                <button
                  key={`${rowIndex}-${colIndex}`}
                  type="button"
                  className={`${styles.tile} ${styles[orb]} ${isSelected ? styles.selected : ""} ${isAdjacentChoice ? styles.adjacentChoice : ""} ${setupHint ? styles.setupHint : ""} ${isClearing ? styles.clearing : ""} ${swapClass} ${dropClass}`}
                  aria-label={`${ORB_NAME[orb]} orb row ${rowIndex + 1} column ${colIndex + 1}`}
                  aria-pressed={isSelected}
                  disabled={isResolving}
                  onClick={() => selectCell(rowIndex, colIndex)}
                >
                  <span>{ORB_LABEL[orb]}</span>
                  {movePreview ? <small className={`${styles.movePreview} ${styles[`preview_${movePreview.tone}`] ?? ""}`}>{movePreview.label}</small> : null}
                </button>
              );
            }))}
          </div>

          {combo >= 2 ? <div className={styles.combo} key={`combo-${combo}`}>{combo} COMBO!</div> : null}
          {combatPop ? <div className={`${styles.combatPop} ${resolutionPhase === "enemy" ? styles.combatPopEnemy : ""}`} key={combatPop}>{combatPop}</div> : null}
          {resultChips.length > 0 ? (
            <div className={styles.resultChips}>
              {resultChips.map((chip) => <span key={chip}>{chip}</span>)}
            </div>
          ) : null}
        </section>
      </section>

      <div className={`${styles.ruleHint} ${setupMode ? styles.setupAlert : ""}`}>
        {selected && !skillMode
          ? "② 隣接パネル上の予測結果を見て選択 • PLATE×は無効攻撃"
          : setupRecommended
            ? `SETUP RECOMMENDED • NOW ${intent.label} ${intent.power} → 金枠交換で威力50% + PRISM28`
            : setupMode
              ? `即消しなし → 金枠が有力SETUP（次手 最大${analysis.bestSetupScore}候補）`
              : `消せる交換 ${analysis.immediateMoves} • SETUP=敵威力50%+PRISM28 • ⬢×3でDEF`}
      </div>
      <div className={styles.message} role="status">{message}</div>

      {skillMode ? (
        <section className={styles.skillPalette} aria-label="Prism Shift color selection">
          <span>{selected ? "変換色" : "1枚選択"}</span>
          <div>
            {ORBS.map((orb) => {
              const sameColor = Boolean(selected && board[selected.row]![selected.col] === orb);
              const preview = skillPreviewFor(orb);
              return (
                <button key={orb} type="button" className={styles[orb]} disabled={!selected || isResolving || sameColor} onClick={() => castShift(orb)}>
                  <span>{ORB_LABEL[orb]}</span>
                  <small className={preview ? styles[`preview_${preview.tone}`] ?? "" : ""}>{sameColor ? "SAME" : preview?.label ?? "—"}</small>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className={styles.actionBar}>
        <button
          type="button"
          className={`${styles.skillButton} ${skill >= 100 ? styles.skillReady : ""} ${prismBreakOpportunity ? styles.prismBreakReady : ""}`}
          onClick={toggleSkillMode}
          disabled={skill < 100 || gameOver || isResolving}
        >
          <span className={styles.skillTitle}>PRISM SHIFT</span>
          <span className={styles.skillGauge}>{skill >= 100 ? (skillMode ? "CANCEL" : prismBreakOpportunity ? `BREAK ${prismBreakOpportunity.attack}` : "READY") : `${skill}%`}</span>
        </button>
        <button type="button" className={styles.resetButton} onClick={reset} disabled={isResolving}>
          {gameOver ? "RETRY" : "RESET"}
        </button>
      </section>

      {showTitle ? (
        <div className={styles.titleScreen} role="dialog" aria-label="Puzzle RPG title">
          <div className={styles.titleGrid} aria-hidden="true" />
          <div className={styles.titleKicker}>TACTICAL PUZZLE RPG</div>
          <div className={styles.titleLogo}><span>PUZZLE</span><strong>RPG</strong></div>
          <div className={styles.titleTagline}>READ THE INTENT. BUILD THE BOARD. BREAK THE ENEMY.</div>
          <div className={styles.titleOrbs} aria-hidden="true">
            {ORBS.map((orb) => <span key={orb} className={styles[orb]}>{ORB_LABEL[orb]}</span>)}
          </div>
          <div className={styles.titleSystems}><span>INTENT</span><span>NEXT</span><span>TACTICAL SETUP</span></div>
          <button type="button" className={styles.titleStartButton} onClick={() => { primeAudio(); playSfx("uiConfirm"); setShowTitle(false); setStageIntro(true); setMessage("STAGE BRIEFING • 敵のルールを確認"); }}>START GAME</button>
          <div className={styles.titleFoot}>1 MOVE = 1 TURN</div>
        </div>
      ) : null}

      {stageIntro && !showTitle ? (
        <div className={styles.stageIntroOverlay} role="dialog" aria-label={`Stage ${stage} briefing`}>
          <div className={styles.introStageLabel}>STAGE {stage}</div>
          <EnemySprite kind={enemy.kind} className={styles.introPixelSprite} intro />
          <div className={styles.introEnemyName}>{enemy.name}</div>
          <div className={styles.enemySpeech}>「{ENEMY_DIALOGUE[enemy.kind]}」</div>
          <div className={styles.tacticalHint}><strong>TACTICAL HINT</strong><span>{ENEMY_HINT[enemy.kind]}</span></div>
          <button type="button" className={styles.battleStartButton} onClick={() => { primeAudio(); playSfx("uiConfirm"); setStageIntro(false); setMessage("BATTLE START • INTENTを読んで一手を選ぶ"); }}>BATTLE START</button>
        </div>
      ) : null}

      {stageClear ? (
        <div className={styles.stageClearOverlay} aria-live="assertive">
          <div className={styles.clearBurst} aria-hidden="true" />
          <div className={styles.clearStage}>STAGE {stageClear.stage}</div>
          <div className={styles.clearTitle}>CLEAR!</div>
          <div className={styles.clearRewards}><span>+{stageClear.gold} ◈</span><span>+{stageClear.xp} XP</span></div>
          <div className={styles.clearCarry}>BOARD + NEXT CARRIED • DEF 50% CARRIED</div>
        </div>
      ) : null}

      {gameOver ? (
        <div className={styles.gameOverCard}>
          <div>GAME OVER</div>
          <button type="button" onClick={reset}>もう一度</button>
        </div>
      ) : null}

      <div className={styles.landscapeNotice}>iPhoneを縦向きにしてください</div>
    </main>
  );
}
