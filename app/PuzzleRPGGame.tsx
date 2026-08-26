"use client";

import { useMemo, useState } from "react";
import styles from "./PuzzleRPGGame.module.css";

type Orb = "fire" | "water" | "leaf" | "light" | "heart" | "guard";
type Board = Orb[][];
type Coord = { row: number; col: number };
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

const SIZE = 6;
const PLAYER_MAX_HP = 100;
const PLAYER_MAX_SHIELD = 60;
const NEXT_PREVIEW = 6;
const NEXT_BUFFER = 48;
const ORBS: Orb[] = ["fire", "water", "leaf", "light", "heart", "guard"];

const ORB_LABEL: Record<Orb, string> = {
  fire: "🔥",
  water: "💧",
  leaf: "🌿",
  light: "✦",
  heart: "♥",
  guard: "⬢",
};

const ORB_NAME: Record<Orb, string> = {
  fire: "fire",
  water: "water",
  leaf: "leaf",
  light: "light",
  heart: "heart",
  guard: "guard",
};

const ATTACK_PER_ORB: Record<Orb, number> = {
  fire: 7,
  water: 6,
  leaf: 6,
  light: 8,
  heart: 0,
  guard: 0,
};

function randomOrb(): Orb {
  return ORBS[Math.floor(Math.random() * ORBS.length)]!;
}

function makeNextQueue(): Orb[] {
  return Array.from({ length: NEXT_BUFFER }, () => randomOrb());
}

function refillNextQueue(queue: Orb[]): Orb[] {
  const next = [...queue];
  while (next.length < NEXT_BUFFER) next.push(randomOrb());
  return next;
}

function takeNext(queue: Orb[]): Orb {
  if (queue.length === 0) queue.push(randomOrb());
  return queue.shift()!;
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

function collapse(board: Board, matches: Set<string>, nextQueue: Orb[]) {
  const next = cloneBoard(board);
  const queue = [...nextQueue];

  for (let col = 0; col < SIZE; col += 1) {
    const survivors: Orb[] = [];
    for (let row = 0; row < SIZE; row += 1) {
      if (!matches.has(cellKey(row, col))) survivors.push(next[row]![col]!);
    }

    const holes = SIZE - survivors.length;
    for (let row = 0; row < holes; row += 1) next[row]![col] = takeNext(queue);
    for (let row = holes; row < SIZE; row += 1) next[row]![col] = survivors[row - holes]!;
  }

  return { board: next, nextQueue: refillNextQueue(queue) };
}

function resolveBoard(board: Board, nextQueue: Orb[]) {
  let next = cloneBoard(board);
  let queue = [...nextQueue];
  let combo = 0;
  let attack = 0;
  let heal = 0;
  let shield = 0;
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
      else if (orb === "guard") shield += 6;
      else attack += ATTACK_PER_ORB[orb];
    }

    const collapsed = collapse(next, matches, queue);
    next = collapsed.board;
    queue = collapsed.nextQueue;
  }

  const comboMultiplier = 1 + Math.max(0, combo - 1) * 0.35;
  return {
    board: next,
    nextQueue: refillNextQueue(queue),
    combo,
    attack: Math.floor(attack * comboMultiplier),
    heal: Math.floor(heal * comboMultiplier),
    shield: Math.floor(shield * comboMultiplier),
    matchedCount,
  };
}

function adjacent(a: Coord, b: Coord): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

function enemyMaxHp(stage: number): number {
  return 82 + (stage - 1) * 25;
}

function enemyBaseAttack(stage: number): number {
  return 7 + Math.min(20, Math.floor((stage - 1) * 1.55));
}

function enemyDefinition(stage: number): EnemyDefinition {
  const tier = Math.floor((stage - 1) / 5);
  switch ((stage - 1) % 5) {
    case 1: {
      const armor = 7 + tier * 2;
      return {
        kind: "bastion",
        name: "IRON BASTION",
        passive: `ARMOR ${armor}：通常攻撃を毎手軽減`,
        armor,
      };
    }
    case 2:
      return {
        kind: "oracle",
        name: "BLOOD ORACLE",
        passive: "DRAIN：与えたHPダメージの分だけ回復",
        armor: 0,
      };
    case 3:
      return {
        kind: "null",
        name: "NULL KNIGHT",
        passive: "PIERCE：予告された貫通攻撃はシールド無視",
        armor: 0,
      };
    case 4:
      return {
        kind: "trickster",
        name: "PRISM TRICKSTER",
        passive: "DISRUPT：攻撃後にNEXT 6個の順序を反転",
        armor: 0,
      };
    default:
      return {
        kind: "warden",
        name: "VOID WARDEN",
        passive: "3手目に強打。基本を読む標準型",
        armor: 0,
      };
  }
}

function enemyIntent(stage: number, enemyTurn: number, enemy: EnemyDefinition): EnemyIntent {
  const base = enemyBaseAttack(stage);
  const phase = enemyTurn % 3;

  if (enemy.kind === "bastion") {
    if (phase === 2) return { kind: "heavy", label: "CRUSH", icon: "💥", power: base + 8, detail: "大ダメージ" };
    return { kind: "attack", label: "ATTACK", icon: "⚔", power: base + 1, detail: "シールドで軽減可能" };
  }

  if (enemy.kind === "oracle") {
    if (phase === 1) return { kind: "drain", label: "DRAIN", icon: "☠", power: base + 3, detail: "HPダメージ分を吸収" };
    if (phase === 2) return { kind: "heavy", label: "BLOOD RITE", icon: "◆", power: base + 6, detail: "大ダメージ" };
    return { kind: "attack", label: "ATTACK", icon: "⚔", power: base, detail: "シールドで軽減可能" };
  }

  if (enemy.kind === "null") {
    if (phase === 1) return { kind: "pierce", label: "PIERCE", icon: "✧", power: base + 3, detail: "シールドを無視" };
    return { kind: phase === 2 ? "heavy" : "attack", label: phase === 2 ? "CRUSH" : "ATTACK", icon: phase === 2 ? "💥" : "⚔", power: base + (phase === 2 ? 7 : 0), detail: "シールドで軽減可能" };
  }

  if (enemy.kind === "trickster") {
    if (phase === 0) return { kind: "disrupt", label: "DISRUPT", icon: "⟳", power: Math.max(5, base - 2), detail: "攻撃後NEXT 6個を反転" };
    if (phase === 2) return { kind: "heavy", label: "PRISM HIT", icon: "◇", power: base + 6, detail: "大ダメージ" };
    return { kind: "attack", label: "ATTACK", icon: "⚔", power: base, detail: "シールドで軽減可能" };
  }

  if (phase === 2) return { kind: "heavy", label: "VOID CRUSH", icon: "💥", power: base + 8, detail: "3手目の強打" };
  return { kind: "attack", label: "ATTACK", icon: "⚔", power: base, detail: "シールドで軽減可能" };
}

function reverseNextPreview(queue: Orb[]): Orb[] {
  const next = [...queue];
  const head = next.slice(0, NEXT_PREVIEW).reverse();
  return [...head, ...next.slice(NEXT_PREVIEW)];
}

function newRun() {
  return {
    board: makeBoard(),
    nextQueue: makeNextQueue(),
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
  const [nextQueue, setNextQueue] = useState<Orb[]>(initial.nextQueue);
  const [selected, setSelected] = useState<Coord | null>(null);
  const [playerHp, setPlayerHp] = useState(initial.hp);
  const [playerShield, setPlayerShield] = useState(initial.shield);
  const [stage, setStage] = useState(initial.stage);
  const [enemyHp, setEnemyHp] = useState(initial.enemyHp);
  const [enemyTurn, setEnemyTurn] = useState(initial.enemyTurn);
  const [skill, setSkill] = useState(initial.skill);
  const [xp, setXp] = useState(initial.xp);
  const [gold, setGold] = useState(initial.gold);
  const [combo, setCombo] = useState(0);
  const [message, setMessage] = useState("敵INTENTを見て、攻撃・防御・盤面作りを選ぶ");
  const [gameOver, setGameOver] = useState(false);

  const maxEnemyHp = enemyMaxHp(stage);
  const enemy = enemyDefinition(stage);
  const intent = enemyIntent(stage, enemyTurn, enemy);
  const level = 1 + Math.floor(xp / 100);
  const xpIntoLevel = xp % 100;

  function reset() {
    const next = newRun();
    setBoard(next.board);
    setNextQueue(next.nextQueue);
    setSelected(null);
    setPlayerHp(next.hp);
    setPlayerShield(next.shield);
    setStage(next.stage);
    setEnemyHp(next.enemyHp);
    setEnemyTurn(next.enemyTurn);
    setSkill(next.skill);
    setXp(next.xp);
    setGold(next.gold);
    setCombo(0);
    setMessage("敵INTENTを見て、攻撃・防御・盤面作りを選ぶ");
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
    setMessage(`${carryMessage} / 撃破！ 盤面を保持して STAGE ${nextStage}`);
  }

  function runEnemyAction(
    hpBefore: number,
    shieldBefore: number,
    enemyHpBefore: number,
    queueBefore: Orb[],
  ) {
    let hpAfter = hpBefore;
    let shieldAfter = shieldBefore;
    let enemyHpAfter = enemyHpBefore;
    let queueAfter = queueBefore;
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
        summary = `${intent.label} -${hpDamage} HP / ${hpDamage}吸収`;
      } else if (intent.kind === "disrupt") {
        queueAfter = reverseNextPreview(queueBefore);
        summary = `${intent.label} -${hpDamage} HP / NEXT反転`;
      } else {
        summary = `${intent.label} -${hpDamage} HP${blocked > 0 ? ` / ${blocked} BLOCK` : ""}`;
      }
    }

    setPlayerHp(hpAfter);
    setPlayerShield(shieldAfter);
    setEnemyHp(enemyHpAfter);
    setNextQueue(queueAfter);
    setEnemyTurn((value) => value + 1);

    return { hpAfter, summary };
  }

  function resolveTurn(swapped: Board) {
    const result = resolveBoard(swapped, nextQueue);
    const isSetupTurn = result.matchedCount === 0;
    setBoard(result.board);
    setNextQueue(result.nextQueue);
    setSelected(null);
    setCombo(result.combo);

    const nextSkill = Math.min(100, skill + result.matchedCount * 4 + Math.max(0, result.combo - 1) * 8);
    setSkill(nextSkill);

    const healedHp = Math.min(PLAYER_MAX_HP, playerHp + result.heal);
    const shieldBeforeEnemy = Math.min(PLAYER_MAX_SHIELD, playerShield + result.shield);
    const armorReduction = result.attack > 0 ? Math.min(enemy.armor, result.attack) : 0;
    const actualAttack = Math.max(0, result.attack - armorReduction);
    const enemyAfter = Math.max(0, enemyHp - actualAttack);

    setPlayerHp(healedHp);
    setPlayerShield(shieldBeforeEnemy);
    setEnemyHp(enemyAfter);

    const playerSummary = isSetupTurn
      ? "SETUP：消去なしで盤面を1手進めた"
      : `${result.combo} COMBO / ${actualAttack} DMG${armorReduction > 0 ? `（ARMOR -${armorReduction}）` : ""}${result.heal > 0 ? ` / +${result.heal} HP` : ""}${result.shield > 0 ? ` / +${result.shield} SHIELD` : ""}`;

    if (enemyAfter <= 0) {
      finishEnemyDefeat(stage, playerSummary);
      return;
    }

    const enemyResult = runEnemyAction(healedHp, shieldBeforeEnemy, enemyAfter, result.nextQueue);
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

    // 消えない交換も正式な1ターン。盤面を仕込む代わりに敵INTENTは実行される。
    resolveTurn(swapped);
  }

  function castSkill() {
    if (gameOver || skill < 100) return;
    const damage = 46 + level * 5 + stage * 3;
    setSkill(0);
    setCombo(0);
    setSelected(null);
    const enemyAfter = Math.max(0, enemyHp - damage);
    if (enemyAfter <= 0) {
      setEnemyHp(0);
      finishEnemyDefeat(stage, `ARC BURST ${damage} DMG（ARMOR無視）`);
      return;
    }

    setEnemyHp(enemyAfter);
    const enemyResult = runEnemyAction(playerHp, playerShield, enemyAfter, nextQueue);
    if (enemyResult.hpAfter <= 0) {
      setGameOver(true);
      setMessage(`GAME OVER — BURST ${damage} DMG / ${enemyResult.summary}`);
    } else {
      setMessage(`BURST ${damage} DMG（ARMOR無視） / ${enemyResult.summary}`);
    }
  }

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

      <section className={styles.intentCard} aria-label="enemy next intent">
        <div className={styles.intentLabel}>ENEMY INTENT</div>
        <div className={styles.intentIcon}>{intent.icon}</div>
        <div className={styles.intentBody}>
          <strong>{intent.label}</strong>
          <span>{intent.detail}</span>
        </div>
        <div className={styles.intentPower}>{intent.power}</div>
      </section>

      <section className={styles.playerStrip} aria-label="player status">
        <div className={styles.playerRow}>
          <span>HP</span>
          <strong>{playerHp}</strong>
          <div className={styles.playerHpTrack}>
            <div className={styles.playerHpFill} style={{ width: `${(playerHp / PLAYER_MAX_HP) * 100}%` }} />
          </div>
        </div>
        <div className={styles.shieldRow}>
          <span>DEF</span>
          <strong>{playerShield}</strong>
          <div className={styles.shieldTrack}>
            <div className={styles.shieldFill} style={{ width: `${(playerShield / PLAYER_MAX_SHIELD) * 100}%` }} />
          </div>
        </div>
        <div className={styles.xpRow}>
          <span>XP</span>
          <div className={styles.xpTrack}><div className={styles.xpFill} style={{ width: `${xpIntoLevel}%` }} /></div>
        </div>
      </section>

      <section className={styles.nextStrip} aria-label="next puzzle orbs">
        <div className={styles.nextLabel}>
          <span>NEXT</span>
          <small>落下順</small>
        </div>
        <div className={styles.nextOrbs}>
          {nextQueue.slice(0, NEXT_PREVIEW).map((orb, index) => (
            <div key={`${orb}-${index}`} className={`${styles.nextOrb} ${styles[orb]}`} aria-label={`next ${index + 1}: ${ORB_NAME[orb]}`}>
              <small>{index + 1}</small>
              <span>{ORB_LABEL[orb]}</span>
            </div>
          ))}
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

      <div className={styles.ruleHint}>隣接2枚を交換 • 消えない交換も1ターン • ⬢×3でSHIELD</div>
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
