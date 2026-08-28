"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { playSfx, primeAudio } from "../gameAudio";
import { ITEMS } from "./data/items";
import { TECHNIQUES } from "./data/techniques";
import { setRpgMusic, stopRpgMusic } from "./rpgAudio";
import RPGIcon from "./RPGIcon";
import { enemySpriteCell, type EnemySpriteFrame } from "./assets";
import type { BattleResult, BattleStats, EnemyDefinition, EnemyIntentDefinition, InventoryStack, PanelType, RPGSaveData, TechniqueId } from "./types";
import styles from "./RPGPuzzleBattle.module.css";

type Tile = { id: number; type: PanelType; row: number; col: number };
type Preview = { seed: number; ids: Set<number>; type: PanelType; count: number } | null;
type TrainingBrief = { school: PanelType; technique: TechniqueId; objective: string };

type Props = {
  enemy: EnemyDefinition;
  save: RPGSaveData;
  training?: TrainingBrief | null;
  onFinish: (result: BattleResult) => void;
};

const SIZE = 6;
const QUEUE_DEPTH = 12;
const PANEL_TYPES: PanelType[] = ["attack", "heal", "barrier", "skip"];
const LABEL: Record<PanelType, string> = { attack: "ATK", heal: "HEAL", barrier: "BAR", skip: "SKIP" };
const GLYPH: Record<PanelType, string> = { attack: "▲", heal: "♥", barrier: "◆", skip: "Ⅱ" };

let nextTileId = 10_000;
function tileId() { nextTileId += 1; return nextTileId; }

function randomPanel(skipBoost = false): PanelType {
  const value = Math.random();
  if (value < (skipBoost ? .31 : .36)) return "attack";
  if (value < (skipBoost ? .52 : .58)) return "heal";
  if (value < (skipBoost ? .75 : .84)) return "barrier";
  return "skip";
}

function makeBoard(skipBoost = false) {
  let result: Tile[] = [];
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const tiles: Tile[] = [];
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        let type = randomPanel(skipBoost);
        const left = tiles.find((tile) => tile.row === row && tile.col === col - 1)?.type;
        const above = tiles.find((tile) => tile.row === row - 1 && tile.col === col)?.type;
        if ((left || above) && Math.random() < .11) type = Math.random() < .5 ? left ?? type : above ?? type;
        tiles.push({ id: tileId(), type, row, col });
      }
    }
    result = tiles;
    const biggest = Math.max(...PANEL_TYPES.map((type) => largestGroup(tiles, type)));
    if (biggest >= 3 && biggest <= 6 && PANEL_TYPES.every((type) => tiles.filter((tile) => tile.type === type).length >= 3)) return tiles;
  }
  return result;
}

function makeQueues(skipBoost = false) {
  return Array.from({ length: SIZE }, () => Array.from({ length: QUEUE_DEPTH }, () => randomPanel(skipBoost)));
}

function connected(tiles: Tile[], seed: Tile) {
  const byPosition = new Map(tiles.filter((tile) => tile.row >= 0).map((tile) => [`${tile.row}:${tile.col}`, tile]));
  const result: Tile[] = [];
  const seen = new Set<number>();
  const stack = [seed];
  while (stack.length > 0) {
    const tile = stack.pop()!;
    if (seen.has(tile.id) || tile.type !== seed.type || tile.row < 0) continue;
    seen.add(tile.id);
    result.push(tile);
    for (const [row, col] of [[tile.row - 1, tile.col], [tile.row + 1, tile.col], [tile.row, tile.col - 1], [tile.row, tile.col + 1]]) {
      const neighbor = byPosition.get(`${row}:${col}`);
      if (neighbor && !seen.has(neighbor.id)) stack.push(neighbor);
    }
  }
  return result;
}

function largestGroup(tiles: Tile[], type: PanelType) {
  let largest = 0;
  const seen = new Set<number>();
  for (const tile of tiles) {
    if (tile.type !== type || seen.has(tile.id) || tile.row < 0) continue;
    const group = connected(tiles, tile);
    group.forEach((member) => seen.add(member.id));
    largest = Math.max(largest, group.length);
  }
  return largest;
}

function collapse(tiles: Tile[], queues: PanelType[][], removed: Set<number>) {
  const nextQueues = queues.map((queue) => [...queue]);
  const start: Tile[] = [];
  const end: Tile[] = [];
  for (let col = 0; col < SIZE; col += 1) {
    const survivors = tiles.filter((tile) => tile.col === col && tile.row >= 0 && !removed.has(tile.id)).sort((a, b) => b.row - a.row);
    survivors.forEach((tile, index) => {
      start.push({ ...tile });
      end.push({ ...tile, row: SIZE - 1 - index });
    });
    const holes = SIZE - survivors.length;
    for (let index = 0; index < holes; index += 1) {
      const type = nextQueues[col]!.shift() ?? randomPanel();
      nextQueues[col]!.push(randomPanel());
      const id = tileId();
      start.push({ id, type, col, row: -1 - index });
      end.push({ id, type, col, row: holes - 1 - index });
    }
  }
  return { start, end, queues: nextQueues };
}

function tileStyle(tile: Tile): CSSProperties {
  const unit = 100 / SIZE;
  return { left: `calc(${tile.col * unit}% + ${tile.col * .5}px)`, top: `calc(${tile.row * unit}% + ${tile.row * .5}px)` };
}

function initialStats(): BattleStats {
  return { turns: 0, maxAttackCluster: 0, maxHealCluster: 0, maxBarrierCluster: 0, maxSkipCluster: 0, healed: 0, blocked: 0, perfectBlocks: 0, skipUses: 0, attackUses: 0, talkUses: 0, itemsUsed: 0 };
}

function cloneInventory(inventory: InventoryStack[]) {
  return inventory.map((stack) => ({ ...stack }));
}

function useOne(inventory: InventoryStack[], index: number) {
  return inventory.flatMap((stack, current) => current !== index ? [stack] : stack.count > 1 ? [{ ...stack, count: stack.count - 1 }] : []);
}

function delay(ms: number) { return new Promise<void>((resolve) => window.setTimeout(resolve, ms)); }

function battleScene(mapId: string) {
  if (/prismCitadel/i.test(mapId)) return "citadel";
  if (/crimson|marsh|reed/i.test(mapId)) return "marsh";
  if (/mirror|hour|spire|tower/i.test(mapId)) return "tower";
  if (/iron/i.test(mapId)) return "fortress";
  if (/temple|void/i.test(mapId)) return "dungeon";
  if (/village|town|hamlet|hearth/i.test(mapId)) return "town";
  return "field";
}

export default function RPGPuzzleBattle({ enemy, save, training = null, onFinish }: Props) {
  const skipBoost = save.equipment.charm === "timeCharm";
  const effectiveEnemy = training ? { ...enemy, name: "TRAINING ECHO", hp: 120, exp: 0, gold: 0, boss: true } : enemy;
  const [tiles, setTiles] = useState<Tile[]>(() => makeBoard(skipBoost));
  const [queues, setQueues] = useState<PanelType[][]>(() => makeQueues(skipBoost));
  const [enemyHp, setEnemyHp] = useState(effectiveEnemy.hp);
  const [hp, setHp] = useState(save.hp);
  const [barrier, setBarrier] = useState(save.equipment.armor === "ironMail" ? 2 : 0);
  const [free, setFree] = useState(0);
  const [intentStep, setIntentStep] = useState(0);
  const [preview, setPreview] = useState<Preview>(null);
  const [clearing, setClearing] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState(training ? training.objective : effectiveEnemy.intro);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandPage, setCommandPage] = useState<"root" | "item" | "status">("root");
  const [inventory, setInventory] = useState(() => cloneInventory(save.inventory));
  const [stats, setStats] = useState<BattleStats>(() => initialStats());
  const [resolving, setResolving] = useState(false);
  const [armorWeakened, setArmorWeakened] = useState(false);
  const [drainWeakened, setDrainWeakened] = useState(false);
  const [nullHesitated, setNullHesitated] = useState(false);
  const [phase, setPhase] = useState(1);
  const [feedback, setFeedback] = useState("");
  const [talkOverlay, setTalkOverlay] = useState<{ speaker: string; text: string } | null>(null);
  const finished = useRef(false);

  const hasTechnique = (id: TechniqueId) => save.techniques.includes(id);
  const intent = useMemo(() => adjustedIntent(intentStep, enemyHp, hp), [intentStep, enemyHp, hp, drainWeakened, phase]);
  const nextIntent = useMemo(() => adjustedIntent(intentStep + 1, enemyHp, hp), [intentStep, enemyHp, hp, drainWeakened, phase]);
  const largest = useMemo(() => Object.fromEntries(PANEL_TYPES.map((type) => [type, largestGroup(tiles, type)])) as Record<PanelType, number>, [tiles]);
  const boardMap = useMemo(() => new Map(tiles.filter((tile) => tile.row >= 0).map((tile) => [`${tile.row}:${tile.col}`, tile])), [tiles]);
  const previewDrops = useMemo(() => {
    const values = Array.from({ length: SIZE }, () => 0);
    if (preview) tiles.forEach((tile) => { if (preview.ids.has(tile.id)) values[tile.col] += 1; });
    return values;
  }, [preview, tiles]);

  function adjustedIntent(step: number, currentEnemyHp: number, currentHp: number): EnemyIntentDefinition {
    const base = effectiveEnemy.intents[step % effectiveEnemy.intents.length]!;
    let power = base.power;
    let detail = base.detail;
    if (enemy.id === "nullExecutioner" && base.kind === "pierce" && currentHp <= 8) { power += 2; detail = "EXECUTE • BAR無視"; }
    if (enemy.id === "prismSovereign") {
      const ratio = currentEnemyHp / effectiveEnemy.hp;
      const bonus = ratio <= .25 ? 2 : ratio <= .5 ? 1 : 0;
      power += bonus;
      if (base.kind === "disrupt") detail = `攻撃＋${2 + bonus}枚変色`;
      const releases = Object.values(save.releasedEnemies).reduce((sum, count) => sum + count, 0);
      if (releases >= 4) { power = Math.max(1, power - 1); detail += " • 聞いた声で弱体"; }
    }
    if (enemy.id === "citadelEye" && Object.values(save.releasedEnemies).reduce((sum, count) => sum + count, 0) >= 3) power = Math.max(1, power - 1);
    if (drainWeakened && base.kind === "drain") { power = Math.max(1, power - 2); detail = "TALKで弱体化"; }
    return { ...base, power, detail };
  }

  function finish(outcome: BattleResult["outcome"], nextHp: number, nextInventory: InventoryStack[], nextStats: BattleStats, options: Partial<BattleResult> = {}) {
    if (finished.current) return;
    finished.current = true;
    setResolving(true);
    window.setTimeout(() => onFinish({
      outcome,
      enemyId: enemy.id,
      hp: Math.max(0, nextHp),
      inventory: nextInventory,
      exp: !training ? outcome === "victory" ? enemy.exp : outcome === "release" ? Math.max(1, Math.floor(enemy.exp * .35)) : 0 : 0,
      gold: !training ? outcome === "victory" ? enemy.gold : outcome === "release" ? Math.floor(enemy.gold * .2) : 0 : 0,
      setFlags: [],
      stats: nextStats,
      ...options,
    }), 360);
  }

  function showEffect(text: string) {
    setFeedback(text);
    window.setTimeout(() => setFeedback((current) => current === text ? "" : current), 620);
  }

  function trainingComplete(nextStats: BattleStats) {
    if (!training) return false;
    if (training.school === "attack") return nextStats.maxAttackCluster >= 6;
    if (training.school === "heal") return nextStats.maxHealCluster >= 7;
    if (training.school === "barrier") return nextStats.perfectBlocks >= 2;
    return nextStats.skipUses >= 3;
  }

  function alternateReady(nextStats: BattleStats) {
    switch (enemy.id) {
      case "mossSlime": return nextStats.maxHealCluster >= 5;
      case "lakeImp": return nextStats.perfectBlocks >= 1;
      case "ironSentry": return nextStats.maxAttackCluster >= 6;
      case "mirrorMote": return nextStats.attackUses === 0 && nextStats.turns >= 2;
      case "forestWisp": return nextStats.attackUses === 0 && nextStats.turns >= 3;
      case "lostKnight": return nextStats.perfectBlocks >= 2;
      case "redHermit": return nextStats.maxHealCluster >= 7;
      case "clockMoth": return nextStats.skipUses >= 3;
      case "gateMimic": return nextStats.itemsUsed >= 1;
      case "silentHerald": return nextStats.attackUses === 0 && nextStats.talkUses >= 2;
      case "prismHound": return ["flameLore", "firstAid", "fortress", "timeTheft"].every((id) => save.techniques.includes(id as TechniqueId));
      default: return false;
    }
  }

  function updateStat(type: PanelType, count: number, columns: number) {
    const next = { ...stats, turns: stats.turns + 1 };
    if (type === "attack") { next.maxAttackCluster = Math.max(next.maxAttackCluster, count); next.attackUses += 1; }
    if (type === "heal") next.maxHealCluster = Math.max(next.maxHealCluster, count);
    if (type === "barrier") next.maxBarrierCluster = Math.max(next.maxBarrierCluster, count);
    if (type === "skip") { next.maxSkipCluster = Math.max(next.maxSkipCluster, count); next.skipUses += 1; }
    if (columns >= 3 && type === "attack") next.maxAttackCluster = Math.max(next.maxAttackCluster, count);
    return next;
  }

  function groupBonus(type: PanelType, count: number, columns: number, currentHp: number, currentEnemyHp: number) {
    let bonus = 0;
    if (count >= 8 && hasTechnique("deepFocus") && type !== "skip") bonus += 2;
    if (type === "attack") {
      if (count >= 6 && hasTechnique("flameLore")) bonus += 2;
      if (currentEnemyHp <= effectiveEnemy.hp / 2 && hasTechnique("finisher")) bonus += 2;
      if (currentHp <= 8 && hasTechnique("redline")) bonus += 2;
      if (columns >= 3 && hasTechnique("wideBreak")) bonus += 2;
      if (save.equipment.weapon === "ironSword" && count >= 5) bonus += 1;
      if (save.equipment.weapon === "redBlade" && currentHp <= 8) bonus += 2;
      if (save.equipment.weapon === "mirrorEdge" && columns >= 3) bonus += 2;
      if (free > 0 && hasTechnique("tempoBlade")) bonus += 1;
    }
    if (type === "heal") {
      if (count >= 6 && hasTechnique("firstAid")) bonus += 2;
      if (save.equipment.weapon === "pilgrimStaff" && count >= 5) bonus += 2;
    }
    if (type === "barrier") {
      if (count >= 6 && hasTechnique("fortress")) bonus += 2;
      if (currentHp <= 8 && hasTechnique("lastStand")) bonus += 3;
    }
    if (type === "skip") {
      if (count >= 4 && hasTechnique("timeTheft")) bonus += 1;
      if (save.equipment.charm === "voidThread" && stats.skipUses === 0 && count >= 3) bonus += 1;
    }
    return bonus;
  }

  async function clearGroup(seed: Tile) {
    if (resolving || seed.row < 0) return;
    const actual = tiles.find((tile) => tile.id === seed.id);
    if (!actual) return;
    primeAudio();
    const group = connected(tiles, actual);
    const removed = new Set(group.map((tile) => tile.id));
    const columns = new Set(group.map((tile) => tile.col)).size;
    const count = group.length;
    let nextStats = updateStat(actual.type, count, columns);
    let nextHp = hp;
    let nextBarrier = barrier;
    let nextEnemyHp = enemyHp;
    let nextFree = free;
    setStats(nextStats);
    setResolving(true);
    setPreview(null);
    setClearing(removed);
    playSfx(count >= 8 ? "cascade" : actual.type === "heal" ? "matchHeart" : actual.type === "barrier" ? "matchGuard" : actual.type === "skip" ? "skill" : "matchFire");
    await delay(120);

    const bonus = groupBonus(actual.type, count, columns, nextHp, nextEnemyHp);
    if (actual.type === "attack") {
      let damage = count + bonus;
      if ((enemy.id === "ironSentry" || enemy.id === "ironTyrant") && count < 5) damage = Math.max(1, damage - (armorWeakened ? 1 : 2));
      nextEnemyHp = Math.max(0, nextEnemyHp - damage);
      setEnemyHp(nextEnemyHp);
      setMessage(`ATK×${count} → ${damage} DAMAGE${bonus ? ` • 技+${bonus}` : ""}`);
      showEffect(`-${damage}`);
      playSfx("playerAttack");
    } else if (actual.type === "heal") {
      const power = count + bonus;
      const healed = Math.min(save.maxHp, nextHp + power);
      const gain = healed - nextHp;
      nextHp = healed;
      nextStats.healed += gain;
      if (hasTechnique("overheal")) nextBarrier = Math.min(30, nextBarrier + Math.max(0, power - gain));
      if (hasTechnique("vitalGuard") && count >= 6) nextBarrier = Math.min(30, nextBarrier + 2);
      setHp(nextHp); setBarrier(nextBarrier); setStats(nextStats);
      setMessage(`HEAL×${count} → HP +${gain}${nextBarrier > barrier ? ` • BAR +${nextBarrier - barrier}` : ""}`);
      showEffect(`+${gain} HP`); playSfx("heal");
    } else if (actual.type === "barrier") {
      const power = count + bonus;
      const raised = Math.min(30, nextBarrier + power);
      const gain = raised - nextBarrier;
      nextBarrier = raised;
      setBarrier(nextBarrier); setMessage(`BAR×${count} → BAR +${gain}`); showEffect(`+${gain} BAR`); playSfx("shield");
    } else {
      const power = count + bonus;
      nextFree += power;
      setFree(nextFree); setMessage(`SKIP×${count} → FREE ${Math.max(0, nextFree - 1)}`); showEffect(`+${Math.max(0, power - 1)} FREE`); playSfx("skill");
    }

    const fallen = collapse(tiles, queues, removed);
    setClearing(new Set()); setTiles(fallen.start); setQueues(fallen.queues);
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    setTiles(fallen.end); playSfx("drop"); await delay(220);

    if (trainingComplete(nextStats)) {
      setMessage(`TRAINING COMPLETE • ${TECHNIQUES[training!.technique].name}`);
      finish("victory", nextHp, inventory, nextStats, { acquiredTechnique: training!.technique, rewardText: training!.objective });
      return;
    }
    if (nextEnemyHp <= 0 && !training) {
      playSfx("enemyBreak"); finish("victory", nextHp, inventory, nextStats);
      return;
    }

    const enemyResult = await resolveEnemyTurn(nextHp, nextBarrier, nextEnemyHp, nextFree, nextStats);
    if (trainingComplete(enemyResult.stats)) {
      setMessage(`TRAINING COMPLETE • ${TECHNIQUES[training!.technique].name}`);
      finish("victory", enemyResult.hp, inventory, enemyResult.stats, { acquiredTechnique: training!.technique, rewardText: training!.objective });
      return;
    }
    setResolving(false);
  }

  async function resolveEnemyTurn(currentHp: number, currentBarrier: number, currentEnemyHp: number, currentFree: number, currentStats: BattleStats) {
    if (currentFree > 0) {
      const remaining = currentFree - 1;
      setFree(remaining); setMessage((text) => `${text} • ENEMY WAIT${remaining ? ` • FREE ${remaining}` : ""}`);
      return { hp: currentHp, barrier: currentBarrier, enemyHp: currentEnemyHp, free: remaining, stats: currentStats };
    }
    const action = adjustedIntent(intentStep, currentEnemyHp, currentHp);
    let damage = action.power;
    let blocked = 0;
    if (action.kind !== "pierce") {
      blocked = Math.min(currentBarrier, damage);
      currentBarrier -= blocked;
      damage -= blocked;
    }
    currentHp = Math.max(0, currentHp - damage);
    const nextStats = { ...currentStats, blocked: currentStats.blocked + blocked };
    if (damage === 0 && action.power > 0) {
      nextStats.perfectBlocks += 1;
      if (hasTechnique("ironBreath")) currentHp = Math.min(save.maxHp, currentHp + 1);
      if (hasTechnique("counterwall") && nextStats.perfectBlocks === 2) currentEnemyHp = Math.max(0, currentEnemyHp - 2);
    }
    if (action.kind === "drain" && damage > 0) {
      const extra = enemy.id === "scarletOracle" ? 2 : enemy.id === "marshLeech" ? 1 : 0;
      currentEnemyHp = Math.min(effectiveEnemy.hp, currentEnemyHp + damage + extra);
    }
    if (action.kind === "disrupt") {
      const amount = enemy.id === "prismSovereign" ? phase + 1 : 2;
      setTiles((current) => {
        const candidates = [...current.filter((tile) => tile.row >= 0)].sort(() => Math.random() - .5).slice(0, amount);
        const ids = new Set(candidates.map((tile) => tile.id));
        return current.map((tile) => ids.has(tile.id) ? { ...tile, type: randomPanel() } : tile);
      });
    }
    if (action.kind === "seal") {
      setTiles((current) => {
        const candidate = current.find((tile) => tile.type === "skip" && tile.row >= 0);
        return candidate ? current.map((tile) => tile.id === candidate.id ? { ...tile, type: "attack" } : tile) : current;
      });
    }
    setHp(currentHp); setBarrier(currentBarrier); setEnemyHp(currentEnemyHp); setStats(nextStats); setIntentStep((step) => step + 1);
    setMessage(`${action.label} • ${damage > 0 ? `HP -${damage}` : `BLOCK ${blocked}`}`);
    showEffect(damage > 0 ? `-${damage} HP` : "PERFECT BLOCK");
    playSfx(action.kind === "heavy" ? "enemyHeavy" : action.kind === "drain" ? "enemyDrain" : action.kind === "pierce" ? "pierce" : action.kind === "disrupt" || action.kind === "seal" ? "enemyDisrupt" : "enemyAttack");
    await delay(320);
    if (currentEnemyHp <= 0 && !training) finish("victory", currentHp, inventory, nextStats);
    if (currentHp <= 0) finish("defeat", 0, inventory, nextStats);
    return { hp: currentHp, barrier: currentBarrier, enemyHp: currentEnemyHp, free: 0, stats: nextStats };
  }

  async function talk() {
    if (resolving) return;
    primeAudio(); playSfx("uiConfirm"); setCommandOpen(false); setCommandPage("root"); setResolving(true);
    const nextStats = { ...stats, turns: stats.turns + 1, talkUses: stats.talkUses + 1 };
    setStats(nextStats);
    if (enemy.alt && alternateReady(nextStats)) {
      setMessage(enemy.conditionalTalk); showEffect("RELEASE");
      finish("release", hp, inventory, nextStats, {
        rewardText: enemy.alt.rewardText,
        acquiredTechnique: enemy.alt.technique,
        acquiredItem: enemy.alt.item,
        acquiredEquipment: enemy.alt.equipment,
        setFlags: [enemy.alt.flag],
      });
      return;
    }
    if (enemy.id.includes("iron") || enemy.id === "ironTyrant") setArmorWeakened(true);
    if ((enemy.id === "scarletOracle" && save.memos.some((memo) => memo.id === "red-spring")) || enemy.id === "redHermit") setDrainWeakened(true);
    let nextFree = free;
    if (enemy.id === "voidHerald" && nextStats.skipUses >= 2) { nextFree += 1; setFree(nextFree); }
    if (enemy.id === "ashCrow" && nextStats.skipUses >= 3) { nextFree += 1; setFree(nextFree); }
    if (enemy.id === "nullExecutioner" && !nullHesitated && ["flameLore", "firstAid", "fortress", "timeTheft"].every((id) => save.techniques.includes(id as TechniqueId))) {
      nextFree += 1; setFree(nextFree); setNullHesitated(true);
    }
    const talkLine = alternateReady(nextStats) ? enemy.conditionalTalk : enemy.talk;
    setMessage(talkLine);
    setTalkOverlay({ speaker: enemy.name, text: talkLine });
    await delay(900);
    setTalkOverlay(null);
    const result = await resolveEnemyTurn(hp, barrier, enemyHp, nextFree, nextStats);
    if (trainingComplete(result.stats)) finish("victory", result.hp, inventory, result.stats, { acquiredTechnique: training!.technique });
    setResolving(false);
  }

  async function useItem(index: number) {
    const stack = inventory[index];
    if (!stack || resolving) return;
    primeAudio(); playSfx("uiConfirm");
    const nextInventory = useOne(inventory, index);
    const nextStats = { ...stats, turns: stats.turns + 1, itemsUsed: stats.itemsUsed + 1 };
    let nextHp = hp;
    let nextBarrier = barrier;
    let nextFree = free;
    setInventory(nextInventory); setStats(nextStats); setCommandOpen(false); setCommandPage("root"); setResolving(true);
    if (stack.id === "herb") nextHp = Math.min(save.maxHp, hp + 6);
    if (stack.id === "guardStone") nextBarrier = Math.min(30, barrier + 5);
    if (stack.id === "timeSand") nextFree += 1;
    if (stack.id === "boardBell") { setTiles(makeBoard(skipBoost)); setQueues(makeQueues(skipBoost)); }
    if (stack.id === "smoke" && !enemy.boss && !training) { finish("run", hp, nextInventory, nextStats); return; }
    if (stack.id === "prismDrop") { nextHp = Math.min(save.maxHp, hp + 4); nextBarrier = Math.min(30, barrier + 4); nextFree += 1; }
    setHp(nextHp); setBarrier(nextBarrier); setFree(nextFree); setMessage(`${ITEMS[stack.id].name} USED`); showEffect(ITEMS[stack.id].description);
    await delay(360);
    await resolveEnemyTurn(nextHp, nextBarrier, enemyHp, nextFree, nextStats);
    setResolving(false);
  }

  async function run() {
    if (enemy.boss || training || resolving) { setMessage("RUNできない戦いだ。"); setCommandOpen(false); return; }
    const nextStats = { ...stats, turns: stats.turns + 1 };
    setCommandOpen(false); setResolving(true);
    if (Math.random() < .72) { setMessage("逃げ切った！"); playSfx("escape"); finish("run", hp, inventory, nextStats); return; }
    setMessage("逃げ道をふさがれた！"); await delay(300); await resolveEnemyTurn(hp, barrier, enemyHp, free, nextStats); setResolving(false);
  }

  function showPreview(tile: Tile, event: PointerEvent<HTMLButtonElement>) {
    if (resolving || tile.row < 0) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); primeAudio(); playSfx("uiSelect");
    const group = connected(tiles, tile);
    setPreview({ seed: tile.id, ids: new Set(group.map((member) => member.id)), type: tile.type, count: group.length });
  }

  function release(tile: Tile, event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const valid = preview?.seed === tile.id;
    setPreview(null);
    if (valid) void clearGroup(tile);
  }

  function joined(tile: Tile) {
    const names: string[] = [];
    if (boardMap.get(`${tile.row - 1}:${tile.col}`)?.type === tile.type) names.push(styles.joinUp);
    if (boardMap.get(`${tile.row + 1}:${tile.col}`)?.type === tile.type) names.push(styles.joinDown);
    if (boardMap.get(`${tile.row}:${tile.col - 1}`)?.type === tile.type) names.push(styles.joinLeft);
    if (boardMap.get(`${tile.row}:${tile.col + 1}`)?.type === tile.type) names.push(styles.joinRight);
    return names.join(" ");
  }

  useEffect(() => {
    setRpgMusic(enemy.id === "prismSovereign" ? "finalBoss" : enemy.boss || training ? "boss" : "battle", save.settings.music);
    return () => stopRpgMusic();
  }, [enemy.boss, enemy.id, save.settings.music, training]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "b" || event.key === "Escape") {
        event.preventDefault(); setCommandOpen((open) => !open); setCommandPage("root");
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  useEffect(() => {
    if (!enemy.boss || training) return;
    const ratio = enemyHp / effectiveEnemy.hp;
    const nextPhase = ratio <= .25 ? 3 : ratio <= .5 ? 2 : 1;
    if (nextPhase > phase) {
      const line = enemy.phaseDialogue?.[nextPhase - 2] ?? (nextPhase === 2 ? "構えが変わった。" : "最後の力を解き放った。");
      setPhase(nextPhase); setMessage(`${line} • ${nextPhase === 2 ? "PHASE II" : "FINAL PHASE"}`);
      if (save.equipment.armor === "prismGuard") setBarrier((value) => Math.min(30, value + 2));
      playSfx("enemyDisrupt");
    }
  }, [effectiveEnemy.hp, enemy.boss, enemy.phaseDialogue, enemyHp, phase, save.equipment.armor, training]);

  const enemyFrame: EnemySpriteFrame = talkOverlay
    ? "reaction"
    : phase > 1
      ? "phase"
    : feedback.includes("HP")
      ? "attack"
      : feedback.startsWith("-")
        ? "hurt"
        : feedback
          ? "reaction"
          : "idle";
  const enemySprite = enemySpriteCell(enemy.id, enemyFrame);
  const enemySpriteStyle: CSSProperties | undefined = enemySprite ? {
    backgroundImage: `url(${enemySprite.src})`,
    backgroundSize: `${enemySprite.columns * 100}% ${enemySprite.rows * 100}%`,
    backgroundPosition: `${enemySprite.col / (enemySprite.columns - 1) * 100}% ${enemySprite.row / (enemySprite.rows - 1) * 100}%`,
  } : undefined;

  return (
    <main className={styles.battle} data-enemy={enemy.portrait} data-boss={enemy.boss || training ? "true" : "false"} data-scene={battleScene(save.mapId)} data-talking={talkOverlay ? "true" : "false"}>
      <div className={styles.battleBackdrop} aria-hidden="true"><i /><i /><i /></div>
      {talkOverlay ? <div className={styles.talkMoment}><span>{talkOverlay.speaker}</span><p>{talkOverlay.text}</p><small>TALK</small></div> : null}
      {feedback ? <div className={styles.feedback}>{feedback}</div> : null}
      <header className={styles.header}>
        <span>{training ? "TRAINING" : enemy.boss ? `BOSS • PHASE ${phase}` : "ENCOUNTER"}</span>
        <strong>{enemy.name}</strong>
        <em>TURN {stats.turns + 1}</em>
      </header>

      <section className={styles.enemyRow}>
        <span className={styles.enemySprite} role="img" aria-label={enemy.name} style={enemySpriteStyle} />
        <div><strong>{effectiveEnemy.name}</strong><i><u style={{ width: `${Math.max(0, enemyHp / effectiveEnemy.hp) * 100}%` }} /></i><span>HP {enemyHp}/{effectiveEnemy.hp}</span><small>{enemy.trait}</small></div>
      </section>

      <section className={styles.intentRow}>
        <div className={styles.intentNow}><span>NOW</span><b>{intent.icon}</b><strong>{intent.label}</strong><em>{intent.power}</em><small>{free > 0 ? `WAIT • FREE ${free}` : intent.detail}</small></div>
        <div className={styles.intentNext}><span>NEXT</span><b>{nextIntent.icon}</b><strong>{nextIntent.label}</strong><em>{nextIntent.power}</em><small>{nextIntent.detail}</small></div>
      </section>

      <section className={styles.statusRow}>
        <div><span>HP</span><strong>{hp}/{save.maxHp}</strong><i><u style={{ width: `${hp / save.maxHp * 100}%` }} /></i></div>
        <div><span>BAR</span><strong>{barrier}/30</strong><i><u style={{ width: `${barrier / 30 * 100}%` }} /></i></div>
        <div><span>FREE</span><strong>{free}</strong><small>{save.level > 1 ? `LV ${save.level}` : "ENEMY WAIT"}</small></div>
      </section>

      <section className={styles.nextMap} aria-label="NEXT DROP MAP">
        <span className={styles.nextTitle}>NEXT DROP MAP</span>
        {queues.map((queue, col) => <div className={previewDrops[col] ? styles.nextActive : ""} key={col}><small className={styles[queue[1]!]}>{GLYPH[queue[1]!]}</small><strong className={styles[queue[0]!]}>{GLYPH[queue[0]!]}</strong><i>{col + 1}▼{previewDrops[col] || ""}</i></div>)}
      </section>

      <section className={styles.board} aria-label="RPG Cluster Break board">
        {tiles.map((tile) => <button
          key={tile.id}
          type="button"
          className={`${styles.tile} ${styles[tile.type]} ${joined(tile)} ${preview?.ids.has(tile.id) ? styles.preview : ""} ${clearing.has(tile.id) ? styles.clearing : ""}`}
          style={tileStyle(tile)}
          disabled={resolving || tile.row < 0}
          aria-label={`${LABEL[tile.type]} row ${tile.row + 1} column ${tile.col + 1}`}
          onPointerDown={(event) => showPreview(tile, event)}
          onPointerUp={(event) => release(tile, event)}
          onPointerCancel={() => setPreview(null)}
        ><b>{GLYPH[tile.type]}</b><span>{LABEL[tile.type]}</span></button>)}
        {preview ? <div className={`${styles.previewBanner} ${styles[preview.type]}`}>{LABEL[preview.type]} ×{preview.count}</div> : null}
      </section>

      <section className={styles.readout}>
        {PANEL_TYPES.map((type) => <span className={styles[type]} key={type}>{LABEL[type]} <b>×{largest[type]}</b></span>)}
      </section>
      <div className={styles.message} role="status">{message}</div>
      <button className={styles.commandButton} type="button" onClick={() => { primeAudio(); playSfx("uiSelect"); setCommandOpen(true); setCommandPage("root"); }}><RPGIcon name="talk" size={14} /> B • RPG COMMAND</button>

      {commandOpen ? <div className={styles.overlay} onClick={() => { setCommandOpen(false); setCommandPage("root"); }}>
        <div className={styles.commandWindow} onClick={(event) => event.stopPropagation()}>
          {commandPage === "root" ? <>
            <span>RPG COMMAND</span>
            <button type="button" onClick={() => void talk()}><b><RPGIcon name="talk" /> TALK</b><small>{enemy.alt?.hint ?? "敵の性格を読む"}</small></button>
            <button type="button" onClick={() => setCommandPage("item")}><b><RPGIcon name="item" /> ITEM</b><small>{inventory.reduce((sum, item) => sum + item.count, 0)} ITEMS</small></button>
            <button type="button" onClick={() => setCommandPage("status")}><b><RPGIcon name="status" /> STATUS</b><small>ターン消費なし</small></button>
            <button type="button" disabled={Boolean(enemy.boss || training)} onClick={() => void run()}><b><RPGIcon name="run" /> RUN</b><small>{enemy.boss || training ? "使用不可" : "成功率72%"}</small></button>
          </> : commandPage === "item" ? <>
            <span>ITEM</span>
            {inventory.length ? inventory.map((stack, index) => <button type="button" key={`${stack.id}-${index}`} onClick={() => void useItem(index)}><b>{ITEMS[stack.id].icon} {ITEMS[stack.id].name} ×{stack.count}</b><small>{ITEMS[stack.id].description}</small></button>) : <p>ITEMがない。</p>}
            <button type="button" onClick={() => setCommandPage("root")}>← BACK</button>
          </> : <>
            <span>STATUS • NO TURN</span>
            <div className={styles.statusPanel}><b>{enemy.name}</b><p>{enemy.trait}</p>{enemy.alt ? <p>別決着：{enemy.alt.hint}</p> : null}<b>TECHNIQUES</b><p>{save.techniques.length ? save.techniques.map((id) => TECHNIQUES[id].name).join(" / ") : "なし"}</p><b>EQUIPMENT</b><p>{Object.values(save.equipment).filter(Boolean).join(" / ") || "なし"}</p></div>
            <button type="button" onClick={() => setCommandPage("root")}>← BACK</button>
          </>}
          <button className={styles.close} type="button" onClick={() => { setCommandOpen(false); setCommandPage("root"); }}>B • CLOSE</button>
        </div>
      </div> : null}
    </main>
  );
}
