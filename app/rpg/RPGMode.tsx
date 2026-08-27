"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { playSfx, primeAudio, setSfxEnabled } from "../gameAudio";
import { DIALOGUE, STORY_TEXT } from "./data/dialogue";
import { ENEMIES } from "./data/enemies";
import { EQUIPMENT } from "./data/equipment";
import { ITEMS } from "./data/items";
import { BLOCKED_TILES, isDangerTile, isRoadTile, MAPS, tileAt } from "./data/maps";
import { npcsForMap } from "./data/npcs";
import { TECHNIQUES } from "./data/techniques";
import RPGPuzzleBattle from "./RPGPuzzleBattle";
import { setRpgMusic, stopRpgMusic } from "./rpgAudio";
import { expForNextLevel, exportSave, importSave, maxHpForLevel, saveGame } from "./save";
import type { BattleResult, Direction, EquipmentId, ItemId, MapDefinition, NPCAction, NPCDefinition, PanelType, RPGSaveData, RPGScreen, TechniqueId, Vec2 } from "./types";
import styles from "./RPGMode.module.css";

type Props = { initialSave: RPGSaveData; onExit: () => void };
type BattleContext = { enemyId: string; fixedId?: string; afterFlag?: string; training?: { school: PanelType; technique: TechniqueId; objective: string } };
type ServiceState =
  | { kind: "shop"; title: string; stock: Array<ItemId | EquipmentId> }
  | { kind: "inn"; title: string; price: number }
  | { kind: "save"; title: string }
  | null;
type ResultState = { title: string; lines: string[]; ending?: boolean } | null;

const TILE = 16;
const VIEW_W = 15;
const VIEW_H = 13;
const DIR_DELTA: Record<Direction, Vec2> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const BOSS_TECHNIQUE_REWARDS: Partial<Record<string, TechniqueId>> = {
  templeKeeper: "finisher",
  scarletOracle: "overheal",
  ironTyrant: "lastStand",
  voidHerald: "tempoBlade",
  nullExecutioner: "wideBreak",
};

function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function hasFlag(save: RPGSaveData, flag?: string) { return !flag || save.flags.includes(flag); }
function addUnique<T extends string>(values: T[], value: T): T[] { return values.includes(value) ? values : [...values, value]; }
function encounterReset(save: RPGSaveData) {
  let value = 11 + Math.floor(Math.random() * 8);
  if (save.equipment.charm === "roadBell") value = Math.ceil(value * 1.3);
  if (save.techniques.includes("quietStep")) value = Math.ceil(value * 1.25);
  return value;
}

function drawTile(context: CanvasRenderingContext2D, code: string, x: number, y: number, worldX: number, worldY: number) {
  const palettes: Record<string, [string, string]> = {
    g: ["#2e6336", "#62a34f"], f: ["#183a24", "#356d38"], r: ["#a78e58", "#d1b675"], d: ["#6e2530", "#b43a3d"],
    w: ["#174d68", "#3c91a0"], b: ["#7f6845", "#c3a268"], m: ["#343846", "#6d7180"],
    ".": ["#89704f", "#b99a69"], h: ["#5c3030", "#be6344"], "#": ["#2d2e38", "#696b78"],
    s: ["#343642", "#686b78"], x: ["#4c1c37", "#973256"], a: ["#5c3b24", "#bd8550"],
  };
  const [base, accent] = palettes[code] ?? palettes.g!;
  context.fillStyle = base;
  context.fillRect(x, y, TILE, TILE);
  context.fillStyle = accent;
  if (code === "w") {
    context.fillRect(x + ((worldY * 3) % 5), y + 4, 11, 2);
    context.fillRect(x + ((worldX * 5) % 4), y + 11, 9, 1);
  } else if (code === "m") {
    context.fillRect(x + 7, y + 2, 3, 3); context.fillRect(x + 5, y + 5, 7, 3); context.fillRect(x + 3, y + 8, 11, 5);
  } else if (code === "f") {
    context.fillRect(x + 5, y + 2, 7, 8); context.fillStyle = "#5a3a26"; context.fillRect(x + 7, y + 10, 3, 5);
  } else if (code === "h") {
    context.fillRect(x + 2, y + 2, 12, 7); context.fillStyle = "#2a1a20"; context.fillRect(x + 6, y + 9, 4, 7);
  } else if (code === "#" || code === "s") {
    context.fillRect(x + 1, y + 1, 6, 5); context.fillRect(x + 9, y + 7, 6, 5);
  } else if (code === "r" || code === "b") {
    context.fillRect(x, y + 6, TILE, 3);
  } else if (code === "d" || code === "x") {
    context.fillRect(x + 2, y + 2, 3, 3); context.fillRect(x + 11, y + 9, 3, 3);
  } else {
    const seed = (worldX * 7 + worldY * 11) % 13;
    context.fillRect(x + 2 + seed % 9, y + 3 + seed % 7, 2, 2);
  }
}

function drawPerson(context: CanvasRenderingContext2D, x: number, y: number, color: string, direction: Direction, walk: number, hero = false) {
  context.fillStyle = "#08080d";
  context.fillRect(x + 4, y + 1, 8, 4); context.fillRect(x + 3, y + 5, 10, 8);
  context.fillStyle = hero ? "#f0c85a" : color;
  context.fillRect(x + 5, y + 2, 6, 4); context.fillRect(x + 4, y + 6, 8, 5);
  context.fillStyle = hero ? "#df5b3d" : "#d9d3b2";
  context.fillRect(x + 5, y + 11, 3, 4); context.fillRect(x + 9, y + (walk % 2 ? 10 : 11), 3, walk % 2 ? 5 : 4);
  context.fillStyle = "#fff7d8";
  if (direction === "left") context.fillRect(x + 4, y + 4, 1, 1);
  else if (direction === "right") context.fillRect(x + 11, y + 4, 1, 1);
  else if (direction === "down") { context.fillRect(x + 6, y + 4, 1, 1); context.fillRect(x + 9, y + 4, 1, 1); }
}

function worldEnemyTable(position: Vec2, danger: boolean) {
  if (position.x < 14) return danger ? ["copperBeetle", "forestWisp", "thornBat"] : ["mossSlime", "roadFang", "thornBat"];
  if (position.x < 28) return danger ? ["ironSentry", "ashCrow", "lostKnight"] : ["lakeImp", "copperBeetle", "ashCrow"];
  if (position.x < 38) return danger ? ["marshLeech", "redHermit", "mirrorMote"] : ["marshLeech", "ironSentry", "mirrorMote"];
  return danger ? ["prismHound", "citadelEye", "clockMoth"] : ["hollowMonk", "prismHound", "mirrorMote"];
}

export default function RPGMode({ initialSave, onExit }: Props) {
  const [save, setSave] = useState<RPGSaveData>(() => initialSave);
  const [screen, setScreen] = useState<RPGScreen>(() => initialSave.flags.includes("story:openingSeen") ? "overworld" : "event");
  const [dialogue, setDialogue] = useState<string[]>(() => initialSave.flags.includes("story:openingSeen") ? [] : STORY_TEXT.opening);
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [speaker, setSpeaker] = useState(initialSave.flags.includes("story:openingSeen") ? "" : "PRISM ROAD");
  const [notice, setNotice] = useState("A: 話す/調べる • B: メニュー");
  const [menuTab, setMenuTab] = useState<"status" | "item" | "equip" | "tech" | "memo" | "save">("status");
  const [service, setService] = useState<ServiceState>(null);
  const [battle, setBattle] = useState<BattleContext | null>(null);
  const [result, setResult] = useState<ResultState>(null);
  const [walkFrame, setWalkFrame] = useState(0);
  const [endingIndex, setEndingIndex] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const afterDialogue = useRef<null | (() => void)>(null);
  const heldTimer = useRef<number | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);
  const saveRef = useRef(save);

  const map = MAPS[save.mapId] ?? MAPS.hearthVillage!;
  const mapNpcs = useMemo(() => npcsForMap(map.id).filter((npc) => hasFlag(save, npc.requireFlag) && !hasFlag(save, npc.hideAfterFlag)), [map.id, save]);
  const visibleFixed = useMemo(() => map.fixedEncounters.filter((entry) => hasFlag(save, entry.requireFlag) && !save.defeatedEncounters.includes(entry.id)), [map, save]);
  const currentTile = tileAt(map, save.position.x, save.position.y);

  function commit(mutator: (current: RPGSaveData) => RPGSaveData, autosave = false) {
    setSave((current) => {
      const next = mutator(current);
      if (autosave) saveGame(next);
      return next;
    });
  }

  function openDialogue(name: string, lines: string[], after: null | (() => void) = null) {
    setSpeaker(name); setDialogue(lines); setDialogueIndex(0); afterDialogue.current = after; setScreen("dialogue"); primeAudio(); playSfx("uiConfirm");
  }

  function advanceDialogue() {
    if (dialogueIndex < dialogue.length - 1) { setDialogueIndex((index) => index + 1); playSfx("uiSelect"); return; }
    const callback = afterDialogue.current;
    afterDialogue.current = null;
    setScreen("overworld"); setDialogue([]); setDialogueIndex(0);
    if (!save.flags.includes("story:openingSeen")) commit((current) => ({ ...current, flags: addUnique(current.flags, "story:openingSeen") }), true);
    callback?.();
  }

  function tileBlocked(nextMap: MapDefinition, position: Vec2) {
    if (BLOCKED_TILES.has(tileAt(nextMap, position.x, position.y))) return true;
    if (mapNpcs.some((npc) => npc.x === position.x && npc.y === position.y)) return true;
    if (visibleFixed.some((entry) => entry.x === position.x && entry.y === position.y)) return true;
    return false;
  }

  function chooseEncounter(nextPosition: Vec2, danger: boolean) {
    const table = map.id === "world"
      ? worldEnemyTable(nextPosition, danger)
      : danger ? map.dangerEncounterTable ?? map.encounterTable ?? [] : map.encounterTable ?? [];
    return table[Math.floor(Math.random() * table.length)] ?? "mossSlime";
  }

  function move(direction: Direction) {
    if (screen !== "overworld" || service || battle || result) return;
    const current = saveRef.current;
    const delta = DIR_DELTA[direction];
    const nextPosition = { x: current.position.x + delta.x, y: current.position.y + delta.y };
    if (tileBlocked(map, nextPosition)) {
      commit((current) => ({ ...current, direction })); setNotice("道がふさがっている。・ Aで調べる"); playSfx("uiSelect"); return;
    }
    const code = tileAt(map, nextPosition.x, nextPosition.y);
    const danger = isDangerTile(code);
    const safe = isRoadTile(code) || map.kind === "town" || map.kind === "training";
    let nextMeter = current.encounterMeter;
    if (!safe) nextMeter -= danger ? 2 : 1;
    const shouldEncounter = !safe && nextMeter <= 0 && Boolean(map.encounterTable || map.id === "world");
    const updated: RPGSaveData = { ...current, position: nextPosition, direction, steps: current.steps + 1, encounterMeter: shouldEncounter ? encounterReset(current) : nextMeter };
    saveRef.current = updated; setSave(updated); setWalkFrame((frame) => (frame + 1) % 3);
    playSfx("step");
    if (shouldEncounter) {
      saveGame(updated);
      window.setTimeout(() => startBattle(chooseEncounter(nextPosition, danger)), 120);
    }
  }

  function targetPositions() {
    const delta = DIR_DELTA[save.direction];
    return [{ x: save.position.x + delta.x, y: save.position.y + delta.y }, save.position];
  }

  function findAt<T extends { x: number; y: number }>(entries: T[]) {
    for (const position of targetPositions()) {
      const found = entries.find((entry) => entry.x === position.x && entry.y === position.y);
      if (found) return found;
    }
    return undefined;
  }

  function addMemo(npc: NPCDefinition) {
    if (!npc.memo || save.memos.some((memo) => memo.id === npc.memo!.id)) return;
    commit((current) => ({ ...current, memos: [...current.memos, { ...npc.memo!, read: false }] }), true);
    setNotice(`MEMO追加 • ${npc.memo.title}`);
  }

  function handleNpcAction(npc: NPCDefinition, action?: NPCAction) {
    addMemo(npc);
    if (!action || action.kind === "talk") return;
    if (action.kind === "story") { commit((current) => ({ ...current, flags: addUnique(current.flags, action.setFlag) }), true); return; }
    if (action.kind === "inn") { setService({ kind: "inn", title: npc.name, price: action.price }); setScreen("menu"); return; }
    if (action.kind === "shop") { setService({ kind: "shop", title: npc.name, stock: action.stock }); setScreen("menu"); return; }
    if (action.kind === "save") { setService({ kind: "save", title: npc.name }); setMenuTab("save"); setScreen("menu"); return; }
    if (action.kind === "training") {
      if (save.techniques.includes(action.technique)) { setNotice(`${TECHNIQUES[action.technique].name}は習得済み。`); return; }
      startBattle(action.school === "attack" ? "templeKeeper" : action.school === "heal" ? "scarletOracle" : action.school === "barrier" ? "ironTyrant" : "voidHerald", { training: { school: action.school, technique: action.technique, objective: action.objective } });
    }
  }

  function interact() {
    if (screen === "dialogue" || screen === "event") { advanceDialogue(); return; }
    if (screen !== "overworld") return;
    const npc = findAt(mapNpcs);
    if (npc) {
      openDialogue(npc.name, DIALOGUE[npc.dialogueKey] ?? ["……"], () => handleNpcAction(npc, npc.action));
      return;
    }
    const fixed = findAt(visibleFixed);
    if (fixed) { startBattle(fixed.enemyId, { fixedId: fixed.id, afterFlag: fixed.afterFlag }); return; }
    const chest = findAt(map.chests.filter((entry) => !save.openedChests.includes(entry.id) && hasFlag(save, entry.requireFlag)));
    if (chest) {
      let text = "宝箱を開けた。";
      commit((current) => {
        let next = { ...current, openedChests: addUnique(current.openedChests, chest.id) };
        if (chest.gold) { next = { ...next, gold: next.gold + chest.gold }; text = `${chest.gold} GOLDを見つけた。`; }
        if (chest.item) { next = giveItem(next, chest.item); text = `${ITEMS[chest.item].name}を見つけた。`; }
        if (chest.equipment) { next = { ...next, equipmentOwned: addUnique(next.equipmentOwned, chest.equipment) }; text = `${EQUIPMENT[chest.equipment].name}を見つけた。`; }
        saveGame(next); return next;
      });
      openDialogue("TREASURE", [text]); playSfx("treasure"); return;
    }
    const portal = findAt(map.portals);
    if (portal) {
      if (!hasFlag(save, portal.requireFlag)) { openDialogue("ROAD", [portal.blockedText ?? "今は進めない。"]); return; }
      transitionMap(portal.targetMap, portal.target, portal.label); return;
    }
    const code = tileAt(map, targetPositions()[0]!.x, targetPositions()[0]!.y);
    const descriptions: Record<string, string> = { w: "水は深く、歩いて渡れない。", m: "険しい山。別の道を探そう。", f: "木々の奥で何かが光った。", d: "危険な気配。近道は続いている。", x: "強い敵の気配が残る。", a: "修行の跡が刻まれている。", h: "戸は閉まっている。" };
    setNotice(descriptions[code] ?? "特に変わったものはない。");
  }

  function transitionMap(targetMap: string, position: Vec2, label: string) {
    const destination = MAPS[targetMap];
    if (!destination) return;
    primeAudio(); playSfx("door");
    const isTown = destination.kind === "town";
    commit((current) => {
      const next = { ...current, mapId: targetMap, position, direction: "up" as Direction, encounterMeter: encounterReset(current), lastInn: isTown ? { mapId: targetMap, position } : current.lastInn };
      saveGame(next); return next;
    });
    setNotice(label);
  }

  function startBattle(enemyId: string, context: Omit<BattleContext, "enemyId"> = {}) {
    if (!ENEMIES[enemyId]) return;
    primeAudio(); playSfx("battleStart"); saveGame(save); setBattle({ enemyId, ...context }); setScreen("battle"); setResult(null);
  }

  function giveItem(current: RPGSaveData, itemId: ItemId) {
    const existing = current.inventory.findIndex((stack) => stack.id === itemId);
    if (existing >= 0) return { ...current, inventory: current.inventory.map((stack, index) => index === existing ? { ...stack, count: Math.min(9, stack.count + 1) } : stack) };
    if (current.inventory.length >= current.inventorySlots) return current;
    return { ...current, inventory: [...current.inventory, { id: itemId, count: 1 }] };
  }

  function grantTechnique(current: RPGSaveData, id?: TechniqueId) {
    if (!id || current.techniques.includes(id)) return current;
    return { ...current, techniques: [...current.techniques, id] };
  }

  function applyLevel(current: RPGSaveData, gainedExp: number) {
    let level = current.level;
    let exp = current.exp + gainedExp;
    let levels = 0;
    while (level < 30 && exp >= expForNextLevel(level)) { exp -= expForNextLevel(level); level += 1; levels += 1; }
    const baseMax = maxHpForLevel(level) + (current.equipment.armor === "travellerCoat" ? 2 : 0);
    return {
      save: { ...current, level, exp, maxHp: baseMax, hp: Math.min(baseMax, current.hp + levels * 3), inventorySlots: level >= 8 ? 6 : level >= 4 ? 5 : current.inventorySlots, techniqueSlots: Math.min(8, 2 + Math.floor(level / 2)) },
      levels,
    };
  }

  function finishBattle(outcome: BattleResult) {
    const context = battle;
    setBattle(null);
    let next = { ...save, hp: Math.max(1, outcome.hp), inventory: outcome.inventory };
    let title = "BATTLE END";
    const lines: string[] = [];
    let ending = false;
    if (outcome.outcome === "defeat") {
      const lost = Math.ceil(next.gold * .15);
      next = { ...next, gold: Math.max(0, next.gold - lost), hp: next.maxHp, mapId: next.lastInn.mapId, position: next.lastInn.position, direction: "down" };
      title = "YOU AWAKEN";
      lines.push("気がつくと最後に訪れた町の宿にいた。", `${lost} GOLDを失った。技・装備・物語は失わない。`);
    } else if (outcome.outcome === "run") {
      title = "ESCAPED"; lines.push("元いた場所へ戻った。");
    } else {
      const released = outcome.outcome === "release";
      title = released ? "ANOTHER ANSWER" : "VICTORY";
      if (released) {
        next = { ...next, releasedEnemies: { ...next.releasedEnemies, [outcome.enemyId]: (next.releasedEnemies[outcome.enemyId] ?? 0) + 1 } };
        if (next.techniques.includes("gentleHand")) next = { ...next, hp: Math.min(next.maxHp, next.hp + 4) };
        if (outcome.rewardText) lines.push(outcome.rewardText);
      } else {
        const levelResult = applyLevel({ ...next, gold: next.gold + outcome.gold, defeatedEnemies: { ...next.defeatedEnemies, [outcome.enemyId]: (next.defeatedEnemies[outcome.enemyId] ?? 0) + 1 } }, outcome.exp);
        next = levelResult.save;
        lines.push(`EXP +${outcome.exp} • GOLD +${outcome.gold}`);
        if (levelResult.levels > 0) { lines.push(`LEVEL UP! • LV ${next.level} • MAX HP ${next.maxHp}`); playSfx("levelUp"); }
        const drop = ENEMIES[outcome.enemyId]?.drop;
        if (drop) { next = giveItem(next, drop); lines.push(`${ITEMS[drop].name}を手に入れた。`); }
      }
      if (outcome.acquiredItem) { next = giveItem(next, outcome.acquiredItem); lines.push(`${ITEMS[outcome.acquiredItem].name}を手に入れた。`); }
      const scriptedTechnique = !context?.training && outcome.outcome === "victory" ? BOSS_TECHNIQUE_REWARDS[outcome.enemyId] : undefined;
      const techniqueRewards = [outcome.acquiredTechnique, scriptedTechnique].filter((id): id is TechniqueId => Boolean(id));
      for (const technique of techniqueRewards) {
        if (next.techniques.includes(technique)) continue;
        next = grantTechnique(next, technique);
        lines.push(`技「${TECHNIQUES[technique].name}」を覚えた。`);
        playSfx("techAcquire");
      }
      const equipmentReward = outcome.acquiredEquipment ?? (context?.training && outcome.acquiredTechnique === "timeTheft" ? "timeCharm" : undefined);
      if (equipmentReward && !next.equipmentOwned.includes(equipmentReward)) {
        next = { ...next, equipmentOwned: addUnique(next.equipmentOwned, equipmentReward) };
        lines.push(`${EQUIPMENT[equipmentReward].name}を手に入れた。`);
      }
      for (const flag of outcome.setFlags) next = { ...next, flags: addUnique(next.flags, flag) };
      if (context?.fixedId) next = { ...next, defeatedEncounters: addUnique(next.defeatedEncounters, context.fixedId) };
      if (context?.afterFlag) next = { ...next, flags: addUnique(next.flags, context.afterFlag) };
      const fixed = map.fixedEncounters.find((entry) => entry.id === context?.fixedId);
      if (fixed) next = { ...next, flags: addUnique(next.flags, fixed.defeatedFlag) };
      if (outcome.enemyId === "prismSovereign") ending = true;
      if (next.flags.includes("void:clear") && ["flameLore", "firstAid", "fortress", "timeTheft"].every((id) => next.techniques.includes(id as TechniqueId))) next = { ...next, flags: addUnique(next.flags, "gate:citadel") };
      if (next.equipment.charm === "heartSeed") next = { ...next, hp: Math.min(next.maxHp, next.hp + 1) };
      if (!lines.length) lines.push("戦いから無事に戻った。");
    }
    next = { ...next, battleLog: [...next.battleLog, { enemyId: outcome.enemyId, outcome: outcome.outcome, turns: outcome.stats.turns, hp: outcome.hp, itemsUsed: outcome.stats.itemsUsed, mapId: map.id, level: next.level }].slice(-120) };
    saveGame(next); setSave(next); setResult({ title, lines, ending }); setScreen("result");
  }

  function closeResult() {
    if (result?.ending) { setEndingIndex(0); setScreen("ending"); setResult(null); return; }
    setResult(null); setScreen("overworld");
  }

  function buy(id: ItemId | EquipmentId) {
    const item = ITEMS[id as ItemId];
    const equipment = EQUIPMENT[id as EquipmentId];
    const price = item?.price ?? equipment?.price ?? 0;
    if (save.gold < price) { setNotice("GOLDが足りない。"); playSfx("uiSelect"); return; }
    if (equipment) {
      const allowedRank = save.level >= 8 ? 3 : save.level >= 4 ? 2 : 1;
      if (equipment.rank > allowedRank) { setNotice(`LVが足りない • 装備RANK ${equipment.rank}`); return; }
      if (save.equipmentOwned.includes(equipment.id)) { setNotice("すでに持っている。"); return; }
      commit((current) => ({ ...current, gold: current.gold - price, equipmentOwned: [...current.equipmentOwned, equipment.id] }), true);
    } else if (item) {
      const hasSlot = save.inventory.some((stack) => stack.id === item.id) || save.inventory.length < save.inventorySlots;
      if (!hasSlot) { setNotice("ITEM枠がいっぱいだ。"); return; }
      commit((current) => giveItem({ ...current, gold: current.gold - price }, item.id), true);
    }
    setNotice(`${item?.name ?? equipment?.name}を買った。`); playSfx("uiConfirm");
  }

  function rest() {
    if (service?.kind !== "inn") return;
    if (save.gold < service.price) { setNotice("GOLDが足りない。"); return; }
    commit((current) => {
      const next = { ...current, gold: current.gold - service.price, hp: current.maxHp, lastInn: { mapId: current.mapId, position: current.position } };
      saveGame(next); return next;
    });
    setNotice("HPが全回復した。ここが復帰地点になった。"); playSfx("heal");
  }

  function equip(id: EquipmentId) {
    const definition = EQUIPMENT[id];
    const isEquipped = save.equipment[definition.slot] === id;
    commit((current) => {
      const equipment = { ...current.equipment, [definition.slot]: isEquipped ? null : id };
      const maxHp = maxHpForLevel(current.level) + (equipment.armor === "travellerCoat" ? 2 : 0);
      const next = { ...current, equipment, maxHp, hp: Math.min(current.hp, maxHp) };
      saveGame(next); return next;
    });
    playSfx("uiConfirm");
  }

  function openMenu() { if (screen === "overworld") { primeAudio(); playSfx("uiSelect"); setService(null); setScreen("menu"); } }
  function closeMenu() { setService(null); setScreen("overworld"); playSfx("uiSelect"); }

  function toggleSetting(key: "music" | "sfx") {
    commit((current) => ({ ...current, settings: { ...current.settings, [key]: !current.settings[key] } }), true);
  }

  function startHold(direction: Direction, event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); move(direction);
    if (heldTimer.current !== null) window.clearInterval(heldTimer.current);
    heldTimer.current = window.setInterval(() => move(direction), 145);
  }
  function stopHold() { if (heldTimer.current !== null) window.clearInterval(heldTimer.current); heldTimer.current = null; }

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    setSfxEnabled(save.settings.sfx);
    if (screen === "battle") return;
    setRpgMusic(screen === "ending" ? "ending" : map.music, save.settings.music);
  }, [map.music, save.settings.music, save.settings.sfx, screen]);

  useEffect(() => {
    const timer = window.setInterval(() => commit((current) => ({ ...current, playSeconds: current.playSeconds + 10 })), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (screen === "dialogue" || screen === "event") { if (["enter", " ", "a"].includes(key)) { event.preventDefault(); advanceDialogue(); } return; }
      if (screen === "result" && key === "enter") { closeResult(); return; }
      if (screen !== "overworld") { if (key === "escape" || key === "b") closeMenu(); return; }
      const direction = key === "arrowup" || key === "w" ? "up" : key === "arrowdown" || key === "s" ? "down" : key === "arrowleft" ? "left" : key === "arrowright" || key === "d" ? "right" : null;
      if (direction) { event.preventDefault(); move(direction); }
      else if (key === "a" || key === "enter" || key === " ") { event.preventDefault(); interact(); }
      else if (key === "b" || key === "escape") { event.preventDefault(); openMenu(); }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  });

  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    context.imageSmoothingEnabled = false;
    context.fillStyle = "#050509"; context.fillRect(0, 0, VIEW_W * TILE, VIEW_H * TILE);
    const cameraX = clamp(save.position.x - Math.floor(VIEW_W / 2), 0, Math.max(0, map.width - VIEW_W));
    const cameraY = clamp(save.position.y - Math.floor(VIEW_H / 2), 0, Math.max(0, map.height - VIEW_H));
    for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
      const worldX = cameraX + viewX, worldY = cameraY + viewY;
      drawTile(context, tileAt(map, worldX, worldY), viewX * TILE, viewY * TILE, worldX, worldY);
    }
    for (const portal of map.portals) {
      const x = (portal.x - cameraX) * TILE, y = (portal.y - cameraY) * TILE;
      if (x < -TILE || y < -TILE || x >= VIEW_W * TILE || y >= VIEW_H * TILE) continue;
      context.fillStyle = portal.requireFlag && !hasFlag(save, portal.requireFlag) ? "#55515d" : "#ffe060";
      context.fillRect(x + 3, y + 4, 10, 9); context.fillStyle = "#11111a"; context.fillRect(x + 6, y + 8, 4, 5);
    }
    for (const chest of map.chests) if (!save.openedChests.includes(chest.id)) {
      const x = (chest.x - cameraX) * TILE, y = (chest.y - cameraY) * TILE;
      context.fillStyle = "#2b160d"; context.fillRect(x + 3, y + 5, 10, 8); context.fillStyle = "#e0a53e"; context.fillRect(x + 4, y + 6, 8, 2); context.fillRect(x + 7, y + 9, 2, 3);
    }
    const npcColors = ["#e0644d", "#5db8c8", "#d7b454", "#9d68c9"];
    mapNpcs.forEach((npc) => drawPerson(context, (npc.x - cameraX) * TILE, (npc.y - cameraY) * TILE, npcColors[npc.palette % npcColors.length]!, "down", 0));
    visibleFixed.forEach((entry) => {
      const x = (entry.x - cameraX) * TILE, y = (entry.y - cameraY) * TILE;
      context.fillStyle = "#08080d"; context.fillRect(x + 2, y + 2, 12, 12); context.fillStyle = "#ff4f64"; context.fillRect(x + 5, y + 4, 6, 7); context.fillStyle = "#fff7d8"; context.fillRect(x + 6, y + 5, 1, 1); context.fillRect(x + 9, y + 5, 1, 1);
    });
    drawPerson(context, (save.position.x - cameraX) * TILE, (save.position.y - cameraY) * TILE, "#f0c85a", save.direction, walkFrame, true);
  }, [map, mapNpcs, save, visibleFixed, walkFrame]);

  useEffect(() => () => { stopHold(); stopRpgMusic(); setSfxEnabled(true); }, []);

  const nearPortal = findAt(map.portals);
  const terrainLabel = isRoadTile(currentTile) ? "ROAD • SAFE" : isDangerTile(currentTile) ? "DANGER • HIGH ENCOUNTER" : map.kind === "town" ? "TOWN • SAFE" : map.kind === "training" ? "TRAINING • SAFE" : "FIELD • ENCOUNTER";

  if (battle) return <RPGPuzzleBattle enemy={ENEMIES[battle.enemyId]!} save={save} training={battle.training} onFinish={finishBattle} />;

  const endingLines = save.releasedEnemies && Object.values(save.releasedEnemies).reduce((sum, count) => sum + count, 0) >= 4 ? STORY_TEXT.endingMercy : STORY_TEXT.endingForce;

  return (
    <main className={styles.rpg}>
      <header className={styles.hud}>
        <div><span>RPG MODE</span><strong>{map.name}</strong></div>
        <div><span>LV {save.level}</span><strong>HP {save.hp}/{save.maxHp}</strong></div>
        <div><span>GOLD</span><strong>{save.gold}</strong></div>
      </header>
      <section className={styles.locationBar}><span>{terrainLabel}</span><strong>{nearPortal ? `A • ${nearPortal.label}` : notice}</strong></section>
      <canvas ref={canvasRef} className={styles.world} width={VIEW_W * TILE} height={VIEW_H * TILE} aria-label={`${map.name} exploration map`} />
      <div className={styles.memoStrip}><span>MEMO {save.memos.filter((memo) => !memo.read).length ? `NEW ${save.memos.filter((memo) => !memo.read).length}` : save.memos.length}</span><strong>{save.techniques.length}/16 TECH • {save.equipmentOwned.length}/12 EQUIP</strong></div>

      <section className={styles.controls} aria-label="RPG touch controls">
        <div className={styles.dpad}>
          <button type="button" aria-label="Move up" onPointerDown={(event) => startHold("up", event)} onPointerUp={stopHold} onPointerCancel={stopHold}>▲</button>
          <button type="button" aria-label="Move left" onPointerDown={(event) => startHold("left", event)} onPointerUp={stopHold} onPointerCancel={stopHold}>◀</button>
          <i>◆</i>
          <button type="button" aria-label="Move right" onPointerDown={(event) => startHold("right", event)} onPointerUp={stopHold} onPointerCancel={stopHold}>▶</button>
          <button type="button" aria-label="Move down" onPointerDown={(event) => startHold("down", event)} onPointerUp={stopHold} onPointerCancel={stopHold}>▼</button>
        </div>
        <div className={styles.abButtons}>
          <button type="button" className={styles.bButton} onPointerDown={(event) => { event.preventDefault(); openMenu(); }}><b>B</b><small>MENU</small></button>
          <button type="button" className={styles.aButton} onPointerDown={(event) => { event.preventDefault(); interact(); }}><b>A</b><small>CHECK</small></button>
        </div>
      </section>

      {(screen === "dialogue" || screen === "event") && dialogue.length ? <div className={styles.dialogueOverlay} onPointerDown={(event) => { event.preventDefault(); advanceDialogue(); }}>
        <div className={styles.dialogueBox}><span>{speaker}</span><p>{dialogue[dialogueIndex]}</p><small>A / TAP ▼</small></div>
      </div> : null}

      {screen === "menu" ? <div className={styles.menuOverlay}>
        <div className={styles.menuWindow}>
          <header><strong>{service?.title ?? "FIELD MENU"}</strong><button type="button" onClick={closeMenu}>B • CLOSE</button></header>
          {service?.kind === "shop" ? <div className={styles.shopList}>
            <p>GOLD {save.gold} • ITEM {save.inventory.length}/{save.inventorySlots}</p>
            {service.stock.map((id) => {
              const item = ITEMS[id as ItemId]; const equipment = EQUIPMENT[id as EquipmentId]; const def = item ?? equipment;
              return <button type="button" key={id} onClick={() => buy(id)}><b>{def.icon} {def.name}</b><span>{def.price}G</span><small>{def.description}</small></button>;
            })}
          </div> : service?.kind === "inn" ? <div className={styles.servicePanel}><strong>REST • {service.price}G</strong><p>HP全回復。GAME OVER時の復帰地点になる。</p><button type="button" onClick={rest}>A • REST</button></div> : <>
            <nav className={styles.menuTabs}>
              {(["status", "item", "equip", "tech", "memo", "save"] as const).map((tab) => <button type="button" data-active={menuTab === tab} onClick={() => setMenuTab(tab)} key={tab}>{tab.toUpperCase()}</button>)}
            </nav>
            <div className={styles.menuContent}>
              {menuTab === "status" ? <><h2>{save.playerName} • LV {save.level}</h2><p>HP {save.hp}/{save.maxHp} • EXP {save.exp}/{expForNextLevel(save.level)}</p><p>STEPS {save.steps} • TIME {Math.floor(save.playSeconds / 60)}m</p><p>DEFEATED {Object.values(save.defeatedEnemies).reduce((sum, count) => sum + count, 0)} • RELEASED {Object.values(save.releasedEnemies).reduce((sum, count) => sum + count, 0)}</p><button type="button" onClick={onExit}>TITLEへ戻る</button></> : null}
              {menuTab === "item" ? <>{save.inventory.length ? save.inventory.map((stack) => <div className={styles.listRow} key={stack.id}><b>{ITEMS[stack.id].icon} {ITEMS[stack.id].name}</b><span>×{stack.count}</span><small>{ITEMS[stack.id].description}</small></div>) : <p>ITEMがない。</p>}</> : null}
              {menuTab === "equip" ? <>{save.equipmentOwned.map((id) => <button className={styles.listRow} type="button" data-equipped={save.equipment[EQUIPMENT[id].slot] === id} key={id} onClick={() => equip(id)}><b>{EQUIPMENT[id].icon} {EQUIPMENT[id].name}</b><span>{save.equipment[EQUIPMENT[id].slot] === id ? "EQUIPPED" : EQUIPMENT[id].slot.toUpperCase()}</span><small>{EQUIPMENT[id].description}</small></button>)}</> : null}
              {menuTab === "tech" ? <>{save.techniques.length ? save.techniques.map((id) => <div className={styles.listRow} key={id}><b>{TECHNIQUES[id].icon} {TECHNIQUES[id].name}</b><span>{LABEL_SCHOOL[TECHNIQUES[id].school]}</span><small>{TECHNIQUES[id].description}</small></div>) : <p>師を探して技を学ぼう。</p>}</> : null}
              {menuTab === "memo" ? <>{save.memos.map((memo) => <button className={styles.memoRow} type="button" data-new={!memo.read} key={memo.id} onClick={() => commit((current) => ({ ...current, memos: current.memos.map((entry) => entry.id === memo.id ? { ...entry, read: true } : entry) }))}><b>{memo.title}</b><small>{memo.text}</small></button>)}</> : null}
              {menuTab === "save" ? <div className={styles.servicePanel}><strong>AUTO SAVE</strong><p>町・戦闘・取得・移動時に保存。</p><button type="button" onClick={() => toggleSetting("music")}>MUSIC • {save.settings.music ? "ON" : "OFF"}</button><button type="button" onClick={() => toggleSetting("sfx")}>SFX • {save.settings.sfx ? "ON" : "OFF"}</button><button type="button" onClick={() => { saveGame(save); setNotice("保存した。"); }}>SAVE NOW</button><button type="button" onClick={() => exportSave(save)}>SAVE EXPORT</button><button type="button" onClick={() => importRef.current?.click()}>SAVE IMPORT</button><input ref={importRef} hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (!file) return; void importSave(file).then((loaded) => { if (!loaded) { setNotice("SAVEを読み込めなかった。"); return; } saveGame(loaded); setSave(loaded); setNotice("SAVE IMPORT完了。"); closeMenu(); }); }} /></div> : null}
            </div>
          </>}
          <footer>{notice}</footer>
        </div>
      </div> : null}

      {screen === "result" && result ? <div className={styles.resultOverlay}><div className={styles.resultCard}><span>RPG MODE</span><strong>{result.title}</strong>{result.lines.map((line) => <p key={line}>{line}</p>)}<button type="button" onClick={closeResult}>A • CONTINUE</button></div></div> : null}

      {screen === "ending" ? <div className={styles.ending}><span>PRISM ROAD</span><strong>{endingIndex < endingLines.length ? "ENDING" : "THE END"}</strong><p>{endingLines[Math.min(endingIndex, endingLines.length - 1)]}</p>{endingIndex < endingLines.length - 1 ? <button type="button" onClick={() => setEndingIndex((index) => index + 1)}>A • NEXT</button> : <button type="button" onClick={() => { commit((current) => ({ ...current, flags: addUnique(current.flags, "ending:seen") }), true); onExit(); }}>TITLEへ</button>}<small>LV {save.level} • {Object.values(save.releasedEnemies).reduce((sum, count) => sum + count, 0)} RELEASES • {Math.floor(save.playSeconds / 60)} MIN</small></div> : null}
    </main>
  );
}

const LABEL_SCHOOL: Record<PanelType, string> = { attack: "ATK", heal: "HEAL", barrier: "BAR", skip: "SKIP" };
