import type { Direction, EquipmentId, ItemId, RPGSaveData, TechniqueId } from "./types";
import { EQUIPMENT } from "./data/equipment";
import { ITEMS } from "./data/items";
import { MAPS } from "./data/maps";
import { TECHNIQUES } from "./data/techniques";

const STORAGE_KEY = "puzzle-rpg:rpg-mode:v1";

export function maxHpForLevel(level: number) {
  if (level <= 5) return 19 + level;
  return 24 + Math.floor((level - 5) * 1.2);
}

export function expForNextLevel(level: number) {
  return 12 + level * level * 8;
}

export function createNewSave(): RPGSaveData {
  return {
    version: 1,
    playerName: "LIO",
    level: 1,
    exp: 0,
    hp: 20,
    maxHp: 20,
    gold: 18,
    mapId: "hearthVillage",
    position: { x: 8, y: 10 },
    direction: "up",
    lastInn: { mapId: "hearthVillage", position: { x: 8, y: 10 } },
    inventory: [{ id: "herb", count: 2 }, { id: "smoke", count: 1 }],
    inventorySlots: 4,
    equipmentOwned: ["travellerCoat"],
    equipment: { weapon: null, armor: null, charm: null },
    techniques: [],
    techniqueSlots: 2,
    memos: [{ id: "journey", title: "最初の旅", text: "村の長から北のOld Templeについて聞く。", read: false }],
    flags: [],
    openedChests: [],
    defeatedEncounters: [],
    defeatedEnemies: {},
    releasedEnemies: {},
    battleLog: [],
    steps: 0,
    playSeconds: 0,
    encounterMeter: 14,
    settings: { music: true, sfx: true },
  };
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function integer(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, Math.floor(value)))
    : fallback;
}

export function normalizeSave(raw: unknown): RPGSaveData | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (value.version !== 1) return null;
  const fallback = createNewSave();
  const level = integer(value.level, 1, 1, 30);
  const mapId = typeof value.mapId === "string" && MAPS[value.mapId] ? value.mapId : fallback.mapId;
  const map = MAPS[mapId]!;
  const positionRaw = value.position && typeof value.position === "object" ? value.position as Record<string, unknown> : {};
  const direction = (["up", "down", "left", "right"] as Direction[]).includes(value.direction as Direction) ? value.direction as Direction : "down";
  const inventory = Array.isArray(value.inventory) ? value.inventory.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const stack = entry as Record<string, unknown>;
    if (typeof stack.id !== "string" || !ITEMS[stack.id as ItemId]) return [];
    return [{ id: stack.id as ItemId, count: integer(stack.count, 1, 1, 9) }];
  }).slice(0, 6) : fallback.inventory;
  const equipmentOwned = stringArray(value.equipmentOwned).filter((id): id is EquipmentId => Boolean(EQUIPMENT[id as EquipmentId]));
  const techniques = stringArray(value.techniques).filter((id): id is TechniqueId => Boolean(TECHNIQUES[id as TechniqueId]));
  const equipRaw = value.equipment && typeof value.equipment === "object" ? value.equipment as Record<string, unknown> : {};
  const slot = (key: "weapon" | "armor" | "charm") => {
    const id = equipRaw[key];
    return typeof id === "string" && EQUIPMENT[id as EquipmentId]?.slot === key && equipmentOwned.includes(id as EquipmentId) ? id as EquipmentId : null;
  };
  const flags = stringArray(value.flags);
  const lastInnRaw = value.lastInn && typeof value.lastInn === "object" ? value.lastInn as Record<string, unknown> : {};
  const lastInnMap = typeof lastInnRaw.mapId === "string" && MAPS[lastInnRaw.mapId] ? lastInnRaw.mapId : "hearthVillage";
  const lastInnPosition = lastInnRaw.position && typeof lastInnRaw.position === "object" ? lastInnRaw.position as Record<string, unknown> : {};
  const records = (source: unknown) => {
    if (!source || typeof source !== "object" || Array.isArray(source)) return {};
    return Object.fromEntries(Object.entries(source as Record<string, unknown>).filter(([, count]) => typeof count === "number").map(([id, count]) => [id, integer(count, 0, 0, 999)]));
  };
  const memos = Array.isArray(value.memos) ? value.memos.flatMap((memo) => {
    if (!memo || typeof memo !== "object") return [];
    const entry = memo as Record<string, unknown>;
    if (typeof entry.id !== "string" || typeof entry.title !== "string" || typeof entry.text !== "string") return [];
    return [{ id: entry.id, title: entry.title.slice(0, 64), text: entry.text.slice(0, 360), read: Boolean(entry.read) }];
  }).slice(0, 80) : fallback.memos;
  const battleLog = Array.isArray(value.battleLog) ? value.battleLog.flatMap((record) => {
    if (!record || typeof record !== "object") return [];
    const entry = record as Record<string, unknown>;
    const outcome = ["victory", "release", "run", "defeat"].includes(String(entry.outcome)) ? entry.outcome as "victory" | "release" | "run" | "defeat" : null;
    if (typeof entry.enemyId !== "string" || !outcome || typeof entry.mapId !== "string") return [];
    return [{ enemyId: entry.enemyId, outcome, turns: integer(entry.turns, 0, 0, 999), hp: integer(entry.hp, 1, 0, 99), itemsUsed: integer(entry.itemsUsed, 0, 0, 99), mapId: entry.mapId, level: integer(entry.level, 1, 1, 30) }];
  }).slice(-120) : [];
  const maxHp = maxHpForLevel(level) + (slot("armor") === "travellerCoat" ? 2 : 0);
  return {
    version: 1,
    playerName: typeof value.playerName === "string" ? value.playerName.slice(0, 10) : fallback.playerName,
    level,
    exp: integer(value.exp, 0, 0, 999999),
    hp: integer(value.hp, maxHp, 1, maxHp),
    maxHp,
    gold: integer(value.gold, 0, 0, 999999),
    mapId,
    position: { x: integer(positionRaw.x, 8, 1, map.width - 2), y: integer(positionRaw.y, 10, 1, map.height - 2) },
    direction,
    lastInn: {
      mapId: lastInnMap,
      position: { x: integer(lastInnPosition.x, 8, 1, MAPS[lastInnMap]!.width - 2), y: integer(lastInnPosition.y, 10, 1, MAPS[lastInnMap]!.height - 2) },
    },
    inventory,
    inventorySlots: integer(value.inventorySlots, 4, 4, 6),
    equipmentOwned,
    equipment: { weapon: slot("weapon"), armor: slot("armor"), charm: slot("charm") },
    techniques: techniques.slice(0, 16),
    techniqueSlots: integer(value.techniqueSlots, 2, 2, 8),
    memos,
    flags,
    openedChests: stringArray(value.openedChests),
    defeatedEncounters: stringArray(value.defeatedEncounters),
    defeatedEnemies: records(value.defeatedEnemies),
    releasedEnemies: records(value.releasedEnemies),
    battleLog,
    steps: integer(value.steps, 0, 0, 9999999),
    playSeconds: integer(value.playSeconds, 0, 0, 99999999),
    encounterMeter: integer(value.encounterMeter, 14, 3, 99),
    settings: {
      music: typeof (value.settings as Record<string, unknown> | undefined)?.music === "boolean" ? Boolean((value.settings as Record<string, unknown>).music) : true,
      sfx: typeof (value.settings as Record<string, unknown> | undefined)?.sfx === "boolean" ? Boolean((value.settings as Record<string, unknown>).sfx) : true,
    },
  };
}

export function loadSave(): RPGSaveData | null {
  if (typeof window === "undefined") return null;
  try {
    const text = window.localStorage.getItem(STORAGE_KEY);
    return text ? normalizeSave(JSON.parse(text)) : null;
  } catch {
    return null;
  }
}

export function saveGame(save: RPGSaveData) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    // A private browser session may reject storage; the current run remains playable.
  }
}

export function hasSave() {
  return loadSave() !== null;
}

export function exportSave(save: RPGSaveData) {
  const blob = new Blob([JSON.stringify(save, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `puzzle-rpg-${save.playerName.toLowerCase()}-lv${save.level}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function importSave(file: File) {
  if (file.size > 256_000) return null;
  try {
    return normalizeSave(JSON.parse(await file.text()));
  } catch {
    return null;
  }
}
