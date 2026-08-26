"use client";

import { useMemo, useState } from "react";
import styles from "./PuzzleRPGGame.module.css";

type Orb = "fire" | "water" | "light" | "heart" | "guard";
type Board = Orb[][];
type Coord = { row: number; col: number };
type ColumnQueues = Orb[][];
type IntentKind = "attack" | "heavy" | "pierce" | "drain" | "disrupt";
type EnemyKind = "warden" | "bastion" | "oracle" | "null" | "trickster";

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

function resolveBoard(board: Board, columnQueues: ColumnQueues) {
  let next = cloneBoard(board);
  let queues = cloneQueues(columnQueues);
  let combo = 0;
  let attack = 0;
  let heal = 0;
  let shield = 0;
  let matchedCount = 0;
  let largestAttackRun = 0;

  for (let safety = 0; safety < 12; safety += 1) {
    const matches = findMatches(next);
    if (matches.size === 0) break;
    combo += 1;
    matchedCount += matches.size;
    largestAttackRun = Math.max(largestAttackRun, maxAttackRun(next));

    for (const key of matches) {
      const [rowText, colText] = key.split(":");
      const row = Number(rowText);
      const col = Number(colText);
      const orb = next[row]![col]!;
      if (orb === "heart") heal += 4;
      else if (orb === "guard") shield += 6;
      else attack += ATTACK_PER_ORB[orb];
    }

    const collapsed = collapse(next, matches, queues);
    next = collapsed.board;
    queues = collapsed.columnQueues;
  }

  const comboMultiplier = 1 + Math.max(0, combo - 1) * 0.35;
  return {
    board: next,
    columnQueues: refillColumnQueues(queues),
    combo,
    attack: Math.floor(attack * comboMultiplier),
    heal: Math.floor(heal * comboMultiplier),
    shield: Math.floor(shield * comboMultiplier),
    matchedCount,
    largestAttackRun,
  };
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
  if (immediateMoves > 0) {
    return { immediateMoves, bestSetupScore: 0, setupHintCells: new Set<string>() };
  }

  let bestSetupScore = 0;
  const bestPairs: Array<[Coord, Coord]> = [];
  for (const [a, b] of ALL_PAIRS) {
    const score = countImmediateMoves(swapCells(board, a, b));
    if (score > bestSetupScore) {
      bestSetupScore = score;
      bestPairs.length = 0;
      bestPairs.push([a, b]);
    } else if (score === bestSetupScore && score > 0 && bestPairs.length < 3) {
      bestPairs.push([a, b]);
    }
  }

  const setupHintCells = new Set<string>();
  for (const [a, b] of bestPairs.slice(0, 3)) {
    setupHintCells.add(cellKey(a.row, a.col));
    setupHintCells.add(cellKey(b.row, b.col));
  }
  return { immediateMoves, bestSetupScore, setupHintCells };
}

function enemyMaxHp(stage: number): number {
  const early = Math.min(stage - 1, 5);
  const mid = Math.max(0, Math.min(stage - 6, 5));
  const late = Math.max(0, stage - 11);
  return 82 + early * 21 + mid * 16 + late * 21;
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
  const [message, setMessage] = useState("INTENTを2手先まで読み、攻撃・防御・SETUPを選ぶ");
  const [gameOver, setGameOver] = useState(false);

  const maxEnemyHp = enemyMaxHp(stage);
  const enemy = enemyDefinition(stage);
  const intent = enemyIntent(stage, enemyTurn, enemy);
  const nextIntent = enemyIntent(stage, enemyTurn + 1, enemy);
  const level = 1 + Math.floor(xp / 100);
  const xpIntoLevel = xp % 100;
  const analysis = useMemo(() => analyzeBoard(board), [board]);

  function reset() {
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
    setMessage("INTENTを2手先まで読み、攻撃・防御・SETUPを選ぶ");
    setGameOver(false);
  }

  function finishEnemyDefeat(currentStage: number, carryMessage: string) {
    const nextStage = currentStage + 1;
    const gainedGold = 12 + currentStage * 4;
    const gainedXp = 28 + currentStage * 6;
    setStage(nextStage);
    setEnemyHp(enemyMaxHp(nextStage));
    setEnemyTurn(0);
    setGold((value) => value + gainedGold);
    setXp((value) => value + gainedXp);
    setMessage(`${carryMessage} / 撃破！ 盤面と列別NEXTを保持 → STAGE ${nextStage}`);
  }

  function runEnemyAction(
    hpBefore: number,
    shieldBefore: number,
    enemyHpBefore: number,
    queuesBefore: ColumnQueues,
  ) {
    let hpAfter = hpBefore;
    let shieldAfter = shieldBefore;
    let enemyHpAfter = enemyHpBefore;
    let queuesAfter = queuesBefore;
    let summary = "";

    if (intent.kind === "pierce") {
      hpAfter = Math.max(0, hpBefore - intent.power);
      summary = `${intent.label} -${intent.power} HP（SHIELD無視）`;
    } else {
      const blocked = Math.min(shieldBefore, intent.power);
      const hpDamage = intent.power - blocked;
      shieldAfter = shieldBefore - blocked;
      hpAfter = Math.max(0, hpBefore - hpDamage);

      if (intent.kind === "drain") {
        enemyHpAfter = Math.min(maxEnemyHp, enemyHpBefore + hpDamage);
        summary = `${intent.label} -${hpDamage} HP / 敵+${hpDamage}`;
      } else if (intent.kind === "disrupt") {
        queuesAfter = disruptColumnQueues(queuesBefore);
        summary = `${intent.label} -${hpDamage} HP / NEXT列シフト`;
      } else {
        summary = `${intent.label} -${hpDamage} HP${blocked > 0 ? ` / ${blocked} BLOCK` : ""}`;
      }
    }

    setPlayerHp(hpAfter);
    setPlayerShield(shieldAfter);
    setEnemyHp(enemyHpAfter);
    setColumnQueues(queuesAfter);
    setEnemyTurn((value) => value + 1);

    return { hpAfter, summary };
  }

  function resolveTurn(nextBoard: Board, consumeSkill = false, skillLabel?: string) {
    const result = resolveBoard(nextBoard, columnQueues);
    const isSetupTurn = result.matchedCount === 0;
    setBoard(result.board);
    setColumnQueues(result.columnQueues);
    setSelected(null);
    setSkillMode(false);
    setCombo(result.combo);

    const skillGain = result.matchedCount * 4 + Math.max(0, result.combo - 1) * 8;
    setSkill(consumeSkill ? Math.min(100, skillGain) : Math.min(100, skill + skillGain));

    const healedHp = Math.min(PLAYER_MAX_HP, playerHp + result.heal);
    const shieldBeforeEnemy = Math.min(PLAYER_MAX_SHIELD, playerShield + result.shield);

    const plateBlocks =
      enemy.kind === "bastion" &&
      result.attack > 0 &&
      result.combo === 1 &&
      result.largestAttackRun === 3;
    const armorReduction = !plateBlocks && result.attack > 0 ? Math.min(enemy.armor, result.attack) : 0;
    const actualAttack = plateBlocks ? 0 : Math.max(0, result.attack - armorReduction);
    const enemyAfter = Math.max(0, enemyHp - actualAttack);

    setPlayerHp(healedHp);
    setPlayerShield(shieldBeforeEnemy);
    setEnemyHp(enemyAfter);

    const prefix = skillLabel ? `${skillLabel} / ` : "";
    const playerSummary = isSetupTurn
      ? `${prefix}SETUP：盤面を仕込んだ`
      : `${prefix}${result.combo} COMBO / ${actualAttack} DMG${plateBlocks ? "（PLATE BLOCK）" : ""}${armorReduction > 0 ? `（ARMOR -${armorReduction}）` : ""}${result.heal > 0 ? ` / +${result.heal} HP` : ""}${result.shield > 0 ? ` / +${result.shield} SHIELD` : ""}`;

    if (enemyAfter <= 0) {
      finishEnemyDefeat(stage, playerSummary);
      return;
    }

    const enemyResult = runEnemyAction(healedHp, shieldBeforeEnemy, enemyAfter, result.columnQueues);
    if (enemyResult.hpAfter <= 0) {
      setGameOver(true);
      setMessage(`GAME OVER — ${playerSummary} / ${enemyResult.summary}`);
    } else {
      setMessage(`${playerSummary} / ${enemyResult.summary}`);
    }
  }

  function selectCell(row: number, col: number) {
    if (gameOver) return;
    const nextCoord = { row, col };

    if (skillMode) {
      setSelected(nextCoord);
      setMessage("PRISM SHIFT：変換する色を下から選択");
      return;
    }

    if (!selected) {
      setSelected(nextCoord);
      return;
    }

    if (selected.row === row && selected.col === col) {
      setSelected(null);
      return;
    }

    if (!adjacent(selected, nextCoord)) {
      setSelected(nextCoord);
      return;
    }

    resolveTurn(swapCells(board, selected, nextCoord));
  }

  function toggleSkillMode() {
    if (gameOver || skill < 100) return;
    setSkillMode((value) => !value);
    setSelected(null);
    setMessage(skillMode ? "PRISM SHIFTをキャンセル" : "PRISM SHIFT：盤面の1枚を選択");
  }

  function castShift(orb: Orb) {
    if (!skillMode || !selected || skill < 100 || gameOver) return;
    const transformed = cloneBoard(board);
    const before = transformed[selected.row]![selected.col]!;
    transformed[selected.row]![selected.col] = orb;
    resolveTurn(transformed, true, `SHIFT ${ORB_LABEL[before]}→${ORB_LABEL[orb]}`);
  }

  const setupMode = analysis.immediateMoves === 0 && analysis.bestSetupScore > 0;

  return (
    <main className={styles.shell}>
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
        <div className={styles.enemyVisual} aria-hidden="true">
          <span className={styles.enemyCore}>◆</span>
          <span className={styles.enemyWingLeft} />
          <span className={styles.enemyWingRight} />
        </div>
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

      <section className={styles.intents} aria-label="enemy intents">
        <div className={styles.intentCard}>
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

      <section className={styles.playerStrip} aria-label="player status">
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

      <section className={styles.nextStrip} aria-label="column next puzzle orbs">
        <div className={styles.nextHeader}>
          <strong>COLUMN NEXT</strong>
          <span>各列に次に落ちる2個</span>
        </div>
        <div className={styles.nextColumns}>
          {columnQueues.map((queue, colIndex) => (
            <div key={colIndex} className={styles.nextColumn}>
              <small>{colIndex + 1}</small>
              <div className={`${styles.nextOrb} ${styles[queue[0]!]}`}>{ORB_LABEL[queue[0]!]}</div>
              <div className={`${styles.nextOrbBack} ${styles[queue[1]!]}`}>{ORB_LABEL[queue[1]!]}</div>
              <span>↓</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.boardWrap} aria-label="puzzle board">
        <div className={styles.board}>
          {board.map((row, rowIndex) => row.map((orb, colIndex) => {
            const isSelected = selected?.row === rowIndex && selected?.col === colIndex;
            const setupHint = setupMode && analysis.setupHintCells.has(cellKey(rowIndex, colIndex));
            return (
              <button
                key={`${rowIndex}-${colIndex}`}
                type="button"
                className={`${styles.tile} ${styles[orb]} ${isSelected ? styles.selected : ""} ${setupHint ? styles.setupHint : ""}`}
                aria-label={`${ORB_NAME[orb]} orb row ${rowIndex + 1} column ${colIndex + 1}`}
                aria-pressed={isSelected}
                onClick={() => selectCell(rowIndex, colIndex)}
              >
                <span>{ORB_LABEL[orb]}</span>
              </button>
            );
          }))}
        </div>
        {combo >= 2 ? <div className={styles.combo}>{combo} COMBO!</div> : null}
      </section>

      <div className={`${styles.ruleHint} ${setupMode ? styles.setupAlert : ""}`}>
        {setupMode
          ? `今すぐ消せる手なし → 点滅枠が有力SETUP（次手候補 最大${analysis.bestSetupScore}）`
          : `今すぐ消せる交換 ${analysis.immediateMoves}手 • 消えない交換も1ターン • ⬢×3でSHIELD`}
      </div>
      <div className={styles.message} role="status">{message}</div>

      {skillMode ? (
        <section className={styles.skillPalette} aria-label="Prism Shift color selection">
          <span>{selected ? "変換色を選択" : "変換する1枚を選択"}</span>
          <div>
            {ORBS.map((orb) => (
              <button key={orb} type="button" className={styles[orb]} disabled={!selected} onClick={() => castShift(orb)}>
                {ORB_LABEL[orb]}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.actionBar}>
        <button
          type="button"
          className={`${styles.skillButton} ${skill >= 100 ? styles.skillReady : ""}`}
          onClick={toggleSkillMode}
          disabled={skill < 100 || gameOver}
        >
          <span className={styles.skillTitle}>PRISM SHIFT</span>
          <span className={styles.skillGauge}>{skill >= 100 ? (skillMode ? "CANCEL" : "READY") : `${skill}%`}</span>
        </button>
        <button type="button" className={styles.resetButton} onClick={reset}>
          {gameOver ? "RETRY" : "RESET"}
        </button>
      </section>

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
