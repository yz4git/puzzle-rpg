"use client";

import { useMemo, useState } from "react";
import styles from "./PuzzleRPGGame.module.css";

type Orb = "fire" | "water" | "leaf" | "light" | "heart";
type Board = Orb[][];
type Coord = { row: number; col: number };

const SIZE = 6;
const PLAYER_MAX_HP = 100;
const ORBS: Orb[] = ["fire", "water", "leaf", "light", "heart"];

const ORB_LABEL: Record<Orb, string> = {
  fire: "🔥",
  water: "💧",
  leaf: "🌿",
  light: "✦",
  heart: "♥",
};

const ATTACK_PER_ORB: Record<Orb, number> = {
  fire: 7,
  water: 6,
  leaf: 6,
  light: 8,
  heart: 0,
};

function randomOrb(): Orb {
  return ORBS[Math.floor(Math.random() * ORBS.length)]!;
}

function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

function makeBoard(): Board {
  const board: Board = Array.from({ length: SIZE }, () => Array<Orb>(SIZE).fill("fire"));
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      let next = randomOrb();
      let guard = 0;
      while (
        guard < 20 &&
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

function collapse(board: Board, matches: Set<string>): Board {
  const next = cloneBoard(board);
  for (let col = 0; col < SIZE; col += 1) {
    const survivors: Orb[] = [];
    for (let row = SIZE - 1; row >= 0; row -= 1) {
      if (!matches.has(cellKey(row, col))) survivors.push(next[row]![col]!);
    }
    for (let row = SIZE - 1, index = 0; row >= 0; row -= 1, index += 1) {
      next[row]![col] = survivors[index] ?? randomOrb();
    }
  }
  return next;
}

function resolveBoard(board: Board) {
  let next = cloneBoard(board);
  let combo = 0;
  let attack = 0;
  let heal = 0;
  let matchedCount = 0;

  for (let safety = 0; safety < 12; safety += 1) {
    const matches = findMatches(next);
    if (matches.size === 0) break;
    combo += 1;
    matchedCount += matches.size;

    for (const key of matches) {
      const [rowText, colText] = key.split(":");
      const row = Number(rowText);
      const col = Number(colText);
      const orb = next[row]![col]!;
      if (orb === "heart") heal += 4;
      else attack += ATTACK_PER_ORB[orb];
    }

    next = collapse(next, matches);
  }

  const comboMultiplier = 1 + Math.max(0, combo - 1) * 0.35;
  return {
    board: next,
    combo,
    attack: Math.floor(attack * comboMultiplier),
    heal: Math.floor(heal * comboMultiplier),
    matchedCount,
  };
}

function adjacent(a: Coord, b: Coord): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

function enemyMaxHp(stage: number): number {
  return 78 + (stage - 1) * 24;
}

function enemyAttack(stage: number): number {
  return 7 + Math.min(18, Math.floor((stage - 1) * 1.6));
}

function newRun() {
  return {
    board: makeBoard(),
    hp: PLAYER_MAX_HP,
    stage: 1,
    enemyHp: enemyMaxHp(1),
    skill: 0,
    xp: 0,
    gold: 0,
  };
}

export default function PuzzleRPGGame() {
  const initial = useMemo(() => newRun(), []);
  const [board, setBoard] = useState<Board>(initial.board);
  const [selected, setSelected] = useState<Coord | null>(null);
  const [playerHp, setPlayerHp] = useState(initial.hp);
  const [stage, setStage] = useState(initial.stage);
  const [enemyHp, setEnemyHp] = useState(initial.enemyHp);
  const [skill, setSkill] = useState(initial.skill);
  const [xp, setXp] = useState(initial.xp);
  const [gold, setGold] = useState(initial.gold);
  const [combo, setCombo] = useState(0);
  const [message, setMessage] = useState("同じ色を3つ以上そろえて攻撃");
  const [gameOver, setGameOver] = useState(false);

  const maxEnemyHp = enemyMaxHp(stage);
  const level = 1 + Math.floor(xp / 100);
  const xpIntoLevel = xp % 100;

  function reset() {
    const next = newRun();
    setBoard(next.board);
    setSelected(null);
    setPlayerHp(next.hp);
    setStage(next.stage);
    setEnemyHp(next.enemyHp);
    setSkill(next.skill);
    setXp(next.xp);
    setGold(next.gold);
    setCombo(0);
    setMessage("同じ色を3つ以上そろえて攻撃");
    setGameOver(false);
  }

  function finishEnemyDefeat(currentStage: number, carryMessage: string) {
    const nextStage = currentStage + 1;
    const gainedGold = 12 + currentStage * 4;
    const gainedXp = 28 + currentStage * 6;
    setStage(nextStage);
    setEnemyHp(enemyMaxHp(nextStage));
    setGold((value) => value + gainedGold);
    setXp((value) => value + gainedXp);
    setMessage(`${carryMessage}  敵を撃破！ STAGE ${nextStage}`);
  }

  function resolveTurn(swapped: Board) {
    const result = resolveBoard(swapped);
    setBoard(result.board);
    setSelected(null);
    setCombo(result.combo);

    const nextSkill = Math.min(100, skill + result.matchedCount * 4 + Math.max(0, result.combo - 1) * 8);
    setSkill(nextSkill);
    setPlayerHp((value) => Math.min(PLAYER_MAX_HP, value + result.heal));

    const enemyAfter = Math.max(0, enemyHp - result.attack);
    if (enemyAfter <= 0) {
      finishEnemyDefeat(stage, `${result.combo} COMBO / ${result.attack} DMG`);
      return;
    }

    setEnemyHp(enemyAfter);
    const incoming = enemyAttack(stage);
    const hpAfter = Math.max(0, Math.min(PLAYER_MAX_HP, playerHp + result.heal) - incoming);
    setPlayerHp(hpAfter);
    if (hpAfter <= 0) {
      setGameOver(true);
      setMessage(`GAME OVER — ${result.combo} COMBO / ${result.attack} DMG`);
    } else {
      const healText = result.heal > 0 ? ` / +${result.heal} HP` : "";
      setMessage(`${result.combo} COMBO / ${result.attack} DMG${healText} / 敵-${incoming} HP`);
    }
  }

  function selectCell(row: number, col: number) {
    if (gameOver) return;
    const nextCoord = { row, col };
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

    const swapped = cloneBoard(board);
    const first = swapped[selected.row]![selected.col]!;
    swapped[selected.row]![selected.col] = swapped[row]![col]!;
    swapped[row]![col] = first;

    if (findMatches(swapped).size === 0) {
      setSelected(null);
      setCombo(0);
      setMessage("その入れ替えでは消えない");
      return;
    }

    resolveTurn(swapped);
  }

  function castSkill() {
    if (gameOver || skill < 100) return;
    const damage = 46 + level * 5 + stage * 3;
    setSkill(0);
    setCombo(0);
    const enemyAfter = Math.max(0, enemyHp - damage);
    if (enemyAfter <= 0) {
      finishEnemyDefeat(stage, `BURST ${damage} DMG`);
      return;
    }

    setEnemyHp(enemyAfter);
    const incoming = enemyAttack(stage);
    const hpAfter = Math.max(0, playerHp - incoming);
    setPlayerHp(hpAfter);
    if (hpAfter <= 0) {
      setGameOver(true);
      setMessage(`GAME OVER — BURST ${damage} DMG`);
    } else {
      setMessage(`BURST ${damage} DMG / 敵-${incoming} HP`);
    }
  }

  return (
    <main className={styles.shell}>
      <div className={styles.topBar}>
        <div>
          <div className={styles.eyebrow}>PUZZLE RPG</div>
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
          <div className={styles.enemyName}>VOID WARDEN {stage}</div>
          <div className={styles.hpTrack}>
            <div className={styles.enemyHpFill} style={{ width: `${(enemyHp / maxEnemyHp) * 100}%` }} />
          </div>
          <div className={styles.hpText}>{enemyHp} / {maxEnemyHp}</div>
        </div>
      </section>

      <section className={styles.playerStrip} aria-label="player status">
        <div className={styles.playerRow}>
          <span>HP</span>
          <strong>{playerHp}</strong>
          <div className={styles.playerHpTrack}>
            <div className={styles.playerHpFill} style={{ width: `${(playerHp / PLAYER_MAX_HP) * 100}%` }} />
          </div>
        </div>
        <div className={styles.xpRow}>
          <span>XP</span>
          <div className={styles.xpTrack}><div className={styles.xpFill} style={{ width: `${xpIntoLevel}%` }} /></div>
        </div>
      </section>

      <section className={styles.boardWrap} aria-label="puzzle board">
        <div className={styles.board}>
          {board.map((row, rowIndex) => row.map((orb, colIndex) => {
            const isSelected = selected?.row === rowIndex && selected?.col === colIndex;
            return (
              <button
                key={`${rowIndex}-${colIndex}`}
                type="button"
                className={`${styles.tile} ${styles[orb]} ${isSelected ? styles.selected : ""}`}
                aria-label={`${orb} orb row ${rowIndex + 1} column ${colIndex + 1}`}
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

      <div className={styles.message} role="status">{message}</div>

      <section className={styles.actionBar}>
        <button
          type="button"
          className={`${styles.skillButton} ${skill >= 100 ? styles.skillReady : ""}`}
          onClick={castSkill}
          disabled={skill < 100 || gameOver}
        >
          <span className={styles.skillTitle}>ARC BURST</span>
          <span className={styles.skillGauge}>{skill >= 100 ? "READY" : `${skill}%`}</span>
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
