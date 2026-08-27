"use client";

import { useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { playSfx, primeAudio } from "./gameAudio";
import { PIXEL_ART_ASSETS, type PixelEnemyKind } from "./pixelArtAssets";
import styles from "./PuzzleRPGClusterBreak.module.css";

type PanelType = "attack" | "heal" | "barrier" | "skip";
type Tile = { id: number; type: PanelType; row: number; col: number };
type IntentKind = "attack" | "heavy" | "drain" | "pierce" | "disrupt";
type Intent = { kind: IntentKind; label: string; detail: string; power: number; icon: string };
type EnemyDef = { kind: PixelEnemyKind; name: string; quote: string; hint: string; passive: string };
type Preview = { seedId: number; ids: Set<number>; type: PanelType; count: number };
type FxState = { token: number; type: PanelType; count: number; rank: string };

const SIZE = 6;
const PLAYER_MAX_HP = 20;
const BARRIER_MAX = 20;
const QUEUE_DEPTH = 12;
const TYPES: PanelType[] = ["attack", "heal", "barrier", "skip"];

const PANEL_LABEL: Record<PanelType, string> = {
  attack: "ATK",
  heal: "HEAL",
  barrier: "BAR",
  skip: "SKIP",
};
const PANEL_GLYPH: Record<PanelType, string> = {
  attack: "▲",
  heal: "♥",
  barrier: "◆",
  skip: "Ⅱ",
};
const PANEL_EFFECT: Record<PanelType, string> = {
  attack: "DAMAGE",
  heal: "HP",
  barrier: "BARRIER",
  skip: "DELAY",
};

const ENEMIES: EnemyDef[] = [
  {
    kind: "warden",
    name: "VOID WARDEN",
    quote: "力だけでは届かぬ。時を読め。",
    hint: "SKIPを2個以上まとめて消すと、敵より多く行動できる。",
    passive: "3回目の行動はVOID CRUSH。SKIPしても技の順番は消えない。",
  },
  {
    kind: "bastion",
    name: "IRON BASTION",
    quote: "崩せるものなら、崩してみろ。",
    hint: "ATK塊を育てて一気に削る。BARRIERを先に貯めてもよい。",
    passive: "重い攻撃が多い。小刻みな攻撃より、大量消しの攻勢が有効。",
  },
  {
    kind: "oracle",
    name: "BLOOD ORACLE",
    quote: "流した血は、わたしの糧になる。",
    hint: "DRAINでHPに通った分だけ敵が回復。BARRIERか大量SKIPで封じる。",
    passive: "DRAINは実際に失ったHPと同じ量だけ敵HPを回復する。",
  },
  {
    kind: "null",
    name: "NULL KNIGHT",
    quote: "盾の向こう側まで斬る。",
    hint: "PIERCEはBARRIER無視。HEALかSKIPで発動そのものを遅らせる。",
    passive: "PIERCEはBARRIERを消費せず、HPへ直接ダメージを通す。",
  },
  {
    kind: "trickster",
    name: "PRISM TRICKSTER",
    quote: "いい塊だね。壊れる前に使えるかな？",
    hint: "DISRUPTは盤面の一部を変色。巨大塊は抱えすぎず使う判断も必要。",
    passive: "DISRUPT後、盤面2枚の種類を変える。NEXTを読み直そう。",
  },
];

let tileId = 1;
let fxToken = 1;
function nextId() {
  tileId += 1;
  return tileId;
}

function weightedType(): PanelType {
  const r = Math.random();
  if (r < 0.36) return "attack";
  if (r < 0.58) return "heal";
  if (r < 0.84) return "barrier";
  return "skip";
}

function tileMap(tiles: Tile[]) {
  const map = new Map<string, Tile>();
  for (const tile of tiles) if (tile.row >= 0) map.set(`${tile.row}:${tile.col}`, tile);
  return map;
}

function connectedGroup(tiles: Tile[], seed: Tile): Tile[] {
  const map = tileMap(tiles);
  const seen = new Set<number>();
  const group: Tile[] = [];
  const stack: Tile[] = [seed];
  while (stack.length > 0) {
    const tile = stack.pop()!;
    if (seen.has(tile.id) || tile.type !== seed.type || tile.row < 0) continue;
    seen.add(tile.id);
    group.push(tile);
    const around = [
      [tile.row - 1, tile.col],
      [tile.row + 1, tile.col],
      [tile.row, tile.col - 1],
      [tile.row, tile.col + 1],
    ];
    for (const [row, col] of around) {
      const neighbor = map.get(`${row}:${col}`);
      if (neighbor && neighbor.type === seed.type && !seen.has(neighbor.id)) stack.push(neighbor);
    }
  }
  return group;
}

function largestGroups(tiles: Tile[]): Record<PanelType, number> {
  const result: Record<PanelType, number> = { attack: 0, heal: 0, barrier: 0, skip: 0 };
  const visited = new Set<number>();
  for (const tile of tiles) {
    if (tile.row < 0 || visited.has(tile.id)) continue;
    const group = connectedGroup(tiles, tile);
    for (const member of group) visited.add(member.id);
    result[tile.type] = Math.max(result[tile.type], group.length);
  }
  return result;
}

function openingType(left?: PanelType, above?: PanelType): PanelType {
  const neighbors = [left, above].filter(Boolean) as PanelType[];
  if (neighbors.length > 0 && Math.random() < 0.12) {
    const candidate = neighbors[Math.floor(Math.random() * neighbors.length)]!;
    if (candidate !== "skip" || Math.random() < 0.28) return candidate;
  }
  return weightedType();
}

function buildOpeningCandidate(): Tile[] {
  const tiles: Tile[] = [];
  const typeAt = new Map<string, PanelType>();
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const left = col > 0 ? typeAt.get(`${row}:${col - 1}`) : undefined;
      const above = row > 0 ? typeAt.get(`${row - 1}:${col}`) : undefined;
      const type = openingType(left, above);
      typeAt.set(`${row}:${col}`, type);
      tiles.push({ id: nextId(), type, row, col });
    }
  }
  return tiles;
}

function makeOpeningBoard(): Tile[] {
  let fallback = buildOpeningCandidate();
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const candidate = attempt === 0 ? fallback : buildOpeningCandidate();
    fallback = candidate;
    const largest = largestGroups(candidate);
    const max = Math.max(...Object.values(largest));
    const counts = TYPES.map((type) => candidate.filter((tile) => tile.type === type).length);
    if (max >= 3 && max <= 5 && counts.every((count) => count >= 3)) return candidate;
  }
  return fallback;
}

function queueType(previous?: PanelType): PanelType {
  if (previous) {
    const repeatChance = previous === "skip" ? 0.05 : 0.13;
    if (Math.random() < repeatChance) return previous;
  }
  return weightedType();
}

function makeQueues(): PanelType[][] {
  return Array.from({ length: SIZE }, () => {
    const queue: PanelType[] = [];
    for (let i = 0; i < QUEUE_DEPTH; i += 1) queue.push(queueType(queue[i - 1]));
    return queue;
  });
}

function refillQueue(queue: PanelType[]) {
  const next = [...queue];
  while (next.length < QUEUE_DEPTH) next.push(queueType(next[next.length - 1]));
  return next;
}

function enemyForStage(stage: number): EnemyDef {
  return ENEMIES[(stage - 1) % ENEMIES.length]!;
}

function enemyMaxHp(stage: number): number {
  const base = [18, 25, 32, 38, 45][(stage - 1) % 5]!;
  return base + Math.floor((stage - 1) / 5) * 10;
}

function enemyIntent(stage: number, step: number, enemy: EnemyDef): Intent {
  const tier = Math.floor((stage - 1) / 5);
  const add = tier * 2;
  if (enemy.kind === "warden") {
    return step % 3 === 2
      ? { kind: "heavy", label: "VOID CRUSH", detail: "重撃", power: 5 + add, icon: "!!" }
      : { kind: "attack", label: "VOID BOLT", detail: "通常攻撃", power: 3 + add, icon: "!" };
  }
  if (enemy.kind === "bastion") {
    return step % 2 === 1
      ? { kind: "heavy", label: "IRON CRUSH", detail: "重撃", power: 6 + add, icon: "!!" }
      : { kind: "attack", label: "SHIELD BASH", detail: "通常攻撃", power: 4 + add, icon: "!" };
  }
  if (enemy.kind === "oracle") {
    return step % 3 === 1
      ? { kind: "drain", label: "BLOOD DRAIN", detail: "HP被害分を吸収", power: 4 + add, icon: "+" }
      : { kind: "attack", label: "BLOOD NEEDLE", detail: "通常攻撃", power: 4 + add, icon: "!" };
  }
  if (enemy.kind === "null") {
    return step % 2 === 1
      ? { kind: "pierce", label: "NULL PIERCE", detail: "BARRIER無視", power: 5 + add, icon: ">>" }
      : { kind: "attack", label: "NULL SLASH", detail: "通常攻撃", power: 4 + add, icon: "!" };
  }
  return step % 3 === 2
    ? { kind: "disrupt", label: "PRISM SHIFT", detail: "攻撃＋2枚変色", power: 5 + add, icon: "<>" }
    : { kind: "attack", label: "PRISM HIT", detail: "通常攻撃", power: 4 + add, icon: "!" };
}

function groupRank(count: number) {
  if (count >= 12) return "JACKPOT";
  if (count >= 8) return "MASSIVE";
  if (count >= 6) return "GREAT";
  if (count >= 4) return "GOOD";
  return "";
}

function styleForTile(tile: Tile): CSSProperties {
  const gap = 3;
  const unit = 100 / SIZE;
  const gapAdjust = gap / SIZE;
  return {
    left: `calc(${(tile.col * unit).toFixed(6)}% + ${(tile.col * gapAdjust).toFixed(3)}px)`,
    top: `calc(${(tile.row * unit).toFixed(6)}% + ${(tile.row * gapAdjust).toFixed(3)}px)`,
  };
}

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function collapseBoard(currentTiles: Tile[], currentQueues: PanelType[][], removed: Set<number>) {
  const startTiles: Tile[] = [];
  const finalTiles: Tile[] = [];
  const nextQueues = currentQueues.map((queue) => [...queue]);

  for (let col = 0; col < SIZE; col += 1) {
    const survivors = currentTiles
      .filter((tile) => tile.col === col && tile.row >= 0 && !removed.has(tile.id))
      .sort((a, b) => b.row - a.row);

    survivors.forEach((tile, index) => {
      const finalRow = SIZE - 1 - index;
      startTiles.push({ ...tile });
      finalTiles.push({ ...tile, row: finalRow });
    });

    const holes = SIZE - survivors.length;
    const queue = nextQueues[col]!;
    const consumed: PanelType[] = [];
    for (let i = 0; i < holes; i += 1) consumed.push(queue.shift() ?? weightedType());
    nextQueues[col] = refillQueue(queue);

    consumed.forEach((type, index) => {
      const id = nextId();
      startTiles.push({ id, type, row: -1 - index, col });
      finalTiles.push({ id, type, row: holes - 1 - index, col });
    });
  }

  return { startTiles, finalTiles, nextQueues };
}

function disruptBoard(current: Tile[]): Tile[] {
  const candidates = current.filter((tile) => tile.row >= 0);
  if (candidates.length < 2) return current;
  const chosen = [...candidates].sort(() => Math.random() - 0.5).slice(0, 2);
  const ids = new Set(chosen.map((tile) => tile.id));
  return current.map((tile) => ids.has(tile.id) ? { ...tile, type: weightedType() } : tile);
}

export default function PuzzleRPGClusterBreak() {
  const [showTitle, setShowTitle] = useState(true);
  const [stageIntro, setStageIntro] = useState(false);
  const [stageClear, setStageClear] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [stage, setStage] = useState(1);
  const [tiles, setTiles] = useState<Tile[]>(() => makeOpeningBoard());
  const [queues, setQueues] = useState<PanelType[][]>(() => makeQueues());
  const [playerHp, setPlayerHp] = useState(PLAYER_MAX_HP);
  const [barrier, setBarrier] = useState(0);
  const [enemyHp, setEnemyHp] = useState(() => enemyMaxHp(1));
  const [enemyStep, setEnemyStep] = useState(0);
  const [enemyDelay, setEnemyDelay] = useState(0);
  const [turn, setTurn] = useState(1);
  const [clearingIds, setClearingIds] = useState<Set<number>>(new Set());
  const [preview, setPreview] = useState<Preview | null>(null);
  const [resolving, setResolving] = useState(false);
  const [message, setMessage] = useState("塊を押して効果を確認。離すと消去。1個でも消せる。");
  const [bestGroup, setBestGroup] = useState(1);
  const [fx, setFx] = useState<FxState | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);

  const enemy = enemyForStage(stage);
  const maxEnemyHp = enemyMaxHp(stage);
  const intent = enemyIntent(stage, enemyStep, enemy);
  const nextIntent = enemyIntent(stage, enemyStep + 1, enemy);
  const largest = useMemo(() => largestGroups(tiles), [tiles]);
  const boardMap = useMemo(() => tileMap(tiles), [tiles]);
  const incomingHpDamage = enemyDelay > 0
    ? 0
    : intent.kind === "pierce"
      ? intent.power
      : Math.max(0, intent.power - barrier);
  const isCritical = playerHp <= 5 || (enemyDelay === 0 && incomingHpDamage >= playerHp);
  const isDanger = !isCritical && (playerHp <= 9 || (enemyDelay === 0 && incomingHpDamage >= Math.ceil(playerHp * 0.6)));

  function resetRun() {
    tileId = 1;
    setStage(1);
    setTiles(makeOpeningBoard());
    setQueues(makeQueues());
    setPlayerHp(PLAYER_MAX_HP);
    setBarrier(0);
    setEnemyHp(enemyMaxHp(1));
    setEnemyStep(0);
    setEnemyDelay(0);
    setTurn(1);
    setBestGroup(1);
    setGameOver(false);
    setStageClear(false);
    setStageIntro(true);
    setPreview(null);
    setFx(null);
    setMessage("STAGE 1");
  }

  function startGame() {
    primeAudio();
    playSfx("uiConfirm");
    setShowTitle(false);
    resetRun();
  }

  function beginStage() {
    primeAudio();
    playSfx("uiConfirm");
    setStageIntro(false);
    setMessage("塊を押して確認 → 離して消去 • 1 PANEL = 1 EFFECT");
  }

  function nextStage() {
    const next = stage + 1;
    setStage(next);
    setEnemyHp(enemyMaxHp(next));
    setEnemyStep(0);
    setEnemyDelay(0);
    setTurn(1);
    setPlayerHp((hp) => Math.min(PLAYER_MAX_HP, hp + 3));
    setStageClear(false);
    setStageIntro(true);
    setPreview(null);
    setFx(null);
    setMessage(`STAGE ${next}`);
  }

  function showGroupPreview(tile: Tile, event?: PointerEvent<HTMLButtonElement>) {
    if (resolving || showTitle || stageIntro || stageClear || gameOver || tile.row < 0) return;
    if (event) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    primeAudio();
    playSfx("uiSelect");
    const group = connectedGroup(tiles, tile);
    setPreview({ seedId: tile.id, ids: new Set(group.map((member) => member.id)), type: tile.type, count: group.length });
  }

  function cancelPreview() {
    if (!resolving) setPreview(null);
  }

  function releaseGroup(tile: Tile, event?: PointerEvent<HTMLButtonElement>) {
    if (event) event.preventDefault();
    const valid = preview?.seedId === tile.id;
    setPreview(null);
    if (valid) void clearTile(tile);
  }

  function keyActivate(tile: Tile, event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    setPreview(null);
    void clearTile(tile);
  }

  function startFx(type: PanelType, count: number) {
    const nextFx = { token: fxToken++, type, count, rank: groupRank(count) };
    setFx(nextFx);
    window.setTimeout(() => setFx((current) => current?.token === nextFx.token ? null : current), 620);
  }

  async function clearTile(seed: Tile) {
    if (resolving || showTitle || stageIntro || stageClear || gameOver || seed.row < 0) return;
    const currentSeed = tiles.find((tile) => tile.id === seed.id);
    if (!currentSeed || currentSeed.row < 0) return;

    primeAudio();
    const group = connectedGroup(tiles, currentSeed);
    const count = group.length;
    const removed = new Set(group.map((tile) => tile.id));
    const rank = groupRank(count);
    setBestGroup((best) => Math.max(best, count));
    setResolving(true);
    setPreview(null);
    setClearingIds(removed);
    startFx(currentSeed.type, count);
    playSfx(count >= 8 ? "cascade" : currentSeed.type === "heal" ? "matchHeart" : currentSeed.type === "barrier" ? "matchGuard" : currentSeed.type === "skip" ? "skill" : "matchFire");
    await delay(count >= 8 ? 230 : 150);

    let nextEnemyHp = enemyHp;
    let nextPlayerHp = playerHp;
    let nextBarrier = barrier;
    let nextDelay = enemyDelay;

    if (currentSeed.type === "attack") {
      nextEnemyHp = Math.max(0, enemyHp - count);
      setEnemyHp(nextEnemyHp);
      setMessage(`ATK ×${count} → ${count} DAMAGE`);
      playSfx("playerAttack");
    } else if (currentSeed.type === "heal") {
      const healed = Math.min(PLAYER_MAX_HP, playerHp + count);
      const actual = healed - playerHp;
      nextPlayerHp = healed;
      setPlayerHp(nextPlayerHp);
      setMessage(`HEAL ×${count} → HP +${actual}`);
      playSfx("heal");
    } else if (currentSeed.type === "barrier") {
      const shielded = Math.min(BARRIER_MAX, barrier + count);
      const actual = shielded - barrier;
      nextBarrier = shielded;
      setBarrier(nextBarrier);
      setMessage(`BAR ×${count} → BARRIER +${actual}`);
      playSfx("shield");
    } else {
      nextDelay += count;
      setMessage(`SKIP ×${count} → ${Math.max(0, count - 1)} FREE MOVE${count - 1 === 1 ? "" : "S"}`);
      playSfx(count >= 6 ? "skill" : "setup");
    }

    const { startTiles, finalTiles, nextQueues } = collapseBoard(tiles, queues, removed);
    setClearingIds(new Set());
    setTiles(startTiles);
    setQueues(nextQueues);
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    setTiles(finalTiles);
    playSfx("drop");
    await delay(285);

    if (nextEnemyHp <= 0) {
      playSfx("enemyBreak");
      await delay(330);
      playSfx("stageClear");
      setStageClear(true);
      setResolving(false);
      return;
    }

    if (nextDelay > 0) {
      nextDelay -= 1;
      setEnemyDelay(nextDelay);
      setMessage((text) => `${text} • ENEMY WAIT${nextDelay > 0 ? ` • FREE ${nextDelay}` : ""}`);
      setTurn((value) => value + 1);
      setResolving(false);
      return;
    }

    const currentIntent = intent;
    let hpDamage = 0;
    let blocked = 0;
    if (currentIntent.kind === "pierce") {
      hpDamage = currentIntent.power;
    } else {
      blocked = Math.min(nextBarrier, currentIntent.power);
      nextBarrier -= blocked;
      hpDamage = Math.max(0, currentIntent.power - blocked);
    }
    nextPlayerHp = Math.max(0, nextPlayerHp - hpDamage);
    setBarrier(nextBarrier);
    setPlayerHp(nextPlayerHp);
    setMessage((text) => `${text} • ${hpDamage > 0 ? `${currentIntent.label} -${hpDamage} HP` : `${currentIntent.label} BLOCK ${blocked}`}`);
    playSfx(currentIntent.kind === "heavy" ? "enemyHeavy" : currentIntent.kind === "drain" ? "enemyDrain" : currentIntent.kind === "pierce" ? "pierce" : currentIntent.kind === "disrupt" ? "enemyDisrupt" : "enemyAttack");

    if (currentIntent.kind === "drain" && hpDamage > 0) {
      const healed = Math.min(maxEnemyHp, nextEnemyHp + hpDamage);
      setEnemyHp(healed);
      nextEnemyHp = healed;
      setMessage((text) => `${text} • DRAIN +${hpDamage}`);
    }
    if (currentIntent.kind === "disrupt") {
      setTiles((current) => disruptBoard(current));
      setMessage((text) => `${text} • 2 PANELS SHIFT`);
    }

    setEnemyStep((value) => value + 1);
    setTurn((value) => value + 1);
    await delay(390);

    if (nextPlayerHp <= 0) {
      playSfx("gameOver");
      setGameOver(true);
      setMessage("GAME OVER");
    }
    setResolving(false);
  }

  function connectionClasses(tile: Tile) {
    if (tile.row < 0) return "";
    const classes: string[] = [];
    if (boardMap.get(`${tile.row - 1}:${tile.col}`)?.type === tile.type) classes.push(styles.joinUp);
    if (boardMap.get(`${tile.row}:${tile.col + 1}`)?.type === tile.type) classes.push(styles.joinRight);
    if (boardMap.get(`${tile.row + 1}:${tile.col}`)?.type === tile.type) classes.push(styles.joinDown);
    if (boardMap.get(`${tile.row}:${tile.col - 1}`)?.type === tile.type) classes.push(styles.joinLeft);
    return classes.join(" ");
  }

  if (showTitle) {
    return (
      <main className={styles.titleScreen} aria-label="Puzzle RPG title">
        <div className={styles.titleLogo}>PUZZLE<br />RPG</div>
        <div className={styles.titleSub}>CLUSTER BREAK TACTICAL BATTLE</div>
        <img className={styles.hero} src={PIXEL_ART_ASSETS.hero} alt="8bit hero" />
        <button className={styles.startButton} type="button" onClick={startGame}>▶ START GAME</button>
        <div className={styles.titleRules}>
          <strong>1 PANEL = 1 EFFECT</strong>
          <span>ATK / HEAL / BARRIER / SKIP</span>
          <span>つながった同種の塊を押す。1個でも消せる。</span>
          <span>大きなSKIP塊なら、敵を止めて一気に攻められる。</span>
        </div>
      </main>
    );
  }

  const warningText = isCritical
    ? `!! CRITICAL !! ${enemyDelay > 0 ? `FREE ${enemyDelay}` : `${intent.label} → ${incomingHpDamage} HP`}`
    : isDanger
      ? `! DANGER ! ${enemyDelay > 0 ? `FREE ${enemyDelay}` : `${intent.label} → ${incomingHpDamage} HP`}`
      : "";
  const shellClass = `${styles.shell} ${isCritical ? styles.critical : isDanger ? styles.danger : ""}`;
  const energyDelta = fx?.type === "attack"
    ? { dx: 0, dy: -400 }
    : fx?.type === "heal"
      ? { dx: -128, dy: -315 }
      : fx?.type === "barrier"
        ? { dx: 0, dy: -315 }
        : { dx: 128, dy: -315 };

  return (
    <main className={shellClass} data-enemy-kind={enemy.kind}>
      {warningText ? <div className={styles.warningBanner} role="alert">{warningText}</div> : null}

      {fx ? (
        <div className={styles.energyLayer} key={`energy-${fx.token}`} aria-hidden="true">
          {Array.from({ length: Math.min(12, Math.max(5, fx.count)) }, (_, index) => (
            <i
              key={index}
              className={`${styles.energyParticle} ${fx.type === "attack" ? styles.energyAttack : fx.type === "heal" ? styles.energyHeal : fx.type === "barrier" ? styles.energyBarrier : styles.energySkip}`}
              style={{
                "--dx": `${energyDelta.dx + ((index % 3) - 1) * 18}px`,
                "--dy": `${energyDelta.dy - Math.floor(index / 3) * 8}px`,
                "--delay": `${index * 18}ms`,
              } as CSSProperties}
            />
          ))}
        </div>
      ) : null}

      <header className={styles.topBar}>
        <div><span>TACTICAL CLUSTER BREAK</span><strong>STAGE {stage}</strong></div>
        <div className={styles.turnBox}>TURN {String(turn).padStart(2, "0")}</div>
      </header>

      <section className={`${styles.enemyStage} ${fx?.type === "attack" ? styles.targetHit : ""}`}>
        <img className={styles.enemySprite} src={PIXEL_ART_ASSETS.enemies[enemy.kind]} alt={enemy.name} />
        <div className={styles.enemyInfo}>
          <strong>{enemy.name}</strong>
          <div className={styles.enemyHpTrack}><div style={{ width: `${Math.max(0, enemyHp / maxEnemyHp) * 100}%` }} /></div>
          <span>HP {enemyHp} / {maxEnemyHp}</span>
          <small>{enemy.passive}</small>
        </div>
      </section>

      <section className={styles.intentRow} aria-label="enemy intents">
        <div className={styles.intentNow}>
          <span>NOW</span><b>{intent.icon}</b><strong>{intent.label}</strong><em>{intent.power}</em>
          <small>{enemyDelay > 0 ? `WAITING • FREE ${enemyDelay}` : intent.detail}</small>
        </div>
        <div className={styles.intentNext}>
          <span>NEXT</span><b>{nextIntent.icon}</b><strong>{nextIntent.label}</strong><em>{nextIntent.power}</em>
          <small>{nextIntent.detail}</small>
        </div>
      </section>

      <section className={styles.playerStatus} aria-label="player status">
        <div className={fx?.type === "heal" ? styles.targetGain : ""}>
          <span>HP</span><strong>{playerHp}/{PLAYER_MAX_HP}</strong><i><u style={{ width: `${playerHp / PLAYER_MAX_HP * 100}%` }} /></i>
        </div>
        <div className={fx?.type === "barrier" ? styles.targetGain : ""}>
          <span>BAR</span><strong>{barrier}/{BARRIER_MAX}</strong><i><u style={{ width: `${barrier / BARRIER_MAX * 100}%` }} /></i>
        </div>
        <div className={`${styles.freeMoves} ${enemyDelay > 0 ? styles.freeMovesActive : ""} ${fx?.type === "skip" ? styles.targetGain : ""}`}>
          <span>FREE</span><strong>{enemyDelay}</strong><small>{enemyDelay > 0 ? `${intent.label}は待機中` : "敵は次の手後に行動"}</small>
        </div>
      </section>

      <section className={styles.nextStrip} aria-label="column next puzzle panels">
        <div className={styles.nextLabel}>NEXT ↓</div>
        <div className={styles.nextColumns}>
          {queues.map((queue, col) => (
            <div className={styles.nextColumn} key={col}>
              <span className={`${styles.miniPanel} ${styles[queue[1]!]}`}>{PANEL_LABEL[queue[1]!]}</span>
              <strong className={`${styles.miniPanel} ${styles[queue[0]!]}`}>{PANEL_LABEL[queue[0]!]}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.boardZone}>
        <div className={`${styles.fxBanner} ${fx ? styles.fxBannerActive : ""}`}>
          {fx ? <><em>{fx.rank || PANEL_LABEL[fx.type]}</em>{PANEL_LABEL[fx.type]} ×{fx.count}</> : "PRESS A CLUSTER → RELEASE TO BREAK"}
        </div>
        <div className={styles.board} ref={boardRef} aria-label="cluster break board">
          {tiles.map((tile) => (
            <button
              key={tile.id}
              type="button"
              className={`${styles.tile} ${styles[tile.type]} ${connectionClasses(tile)} ${preview?.ids.has(tile.id) ? styles.previewed : ""} ${clearingIds.has(tile.id) ? styles.clearing : ""}`}
              style={styleForTile(tile)}
              aria-label={`${PANEL_LABEL[tile.type]} panel row ${tile.row + 1} column ${tile.col + 1}`}
              disabled={resolving || tile.row < 0}
              onPointerDown={(event) => showGroupPreview(tile, event)}
              onPointerUp={(event) => releaseGroup(tile, event)}
              onPointerCancel={cancelPreview}
              onKeyDown={(event) => keyActivate(tile, event)}
            >
              <i className={`${styles.bridge} ${styles.bridgeUp}`} aria-hidden="true" />
              <i className={`${styles.bridge} ${styles.bridgeRight}`} aria-hidden="true" />
              <i className={`${styles.bridge} ${styles.bridgeDown}`} aria-hidden="true" />
              <i className={`${styles.bridge} ${styles.bridgeLeft}`} aria-hidden="true" />
              <b>{PANEL_GLYPH[tile.type]}</b>
              <span>{PANEL_LABEL[tile.type]}</span>
            </button>
          ))}
          {preview ? (
            <div className={`${styles.groupPreview} ${styles[preview.type]}`}>
              <small>BREAK PREVIEW</small>
              <strong>{PANEL_LABEL[preview.type]} ×{preview.count}</strong>
            </div>
          ) : null}
        </div>
      </section>

      <section className={styles.clusterReadout} aria-label="largest current clusters">
        {TYPES.map((type) => <span className={styles[type]} key={type}>{PANEL_LABEL[type]} <strong>×{largest[type]}</strong></span>)}
      </section>

      <div className={styles.message} role="status">{message}</div>
      <div className={styles.ruleLine}>1 PANEL = 1 {PANEL_EFFECT.attack} • SKIP 1 = FREE 0 • BEST ×{bestGroup}</div>

      {stageIntro ? (
        <div className={styles.overlay} role="dialog" aria-label={`Stage ${stage} intro`} onClick={beginStage}>
          <div className={styles.introCard}>
            <span>STAGE {stage}</span>
            <img src={PIXEL_ART_ASSETS.enemies[enemy.kind]} alt="" fetchPriority="high" />
            <strong>{enemy.name}</strong>
            <div className={styles.dialogue}>「{enemy.quote}」</div>
            <div className={styles.hint}><b>HINT</b>{enemy.hint}</div>
            <button type="button" onClick={(event) => { event.stopPropagation(); beginStage(); }}>▶ BATTLE START</button>
            <small>画面のどこを押しても開始</small>
          </div>
        </div>
      ) : null}

      {stageClear ? (
        <div className={styles.overlay} role="dialog" aria-label="Stage Clear">
          <div className={styles.clearCard}>
            <span>STAGE {stage}</span>
            <strong>CLEAR!</strong>
            <p>BEST CLUSTER ×{bestGroup}</p>
            <p>HP +3して次の敵へ</p>
            <button type="button" onClick={nextStage}>▶ NEXT STAGE</button>
          </div>
        </div>
      ) : null}

      {gameOver ? (
        <div className={styles.overlay} aria-label="Game Over">
          <div className={styles.gameOverCard}>
            <img src={PIXEL_ART_ASSETS.hero} alt="" />
            <strong>GAME OVER</strong>
            <p>STAGE {stage} • BEST ×{bestGroup}</p>
            <button type="button" onClick={resetRun}>▶ RETRY</button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
