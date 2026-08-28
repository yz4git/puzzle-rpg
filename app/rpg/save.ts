import type { Direction, EquipmentId, ItemId, MapDefinition, RPGSaveData, TechniqueId, Vec2 } from "./types";
import { EQUIPMENT } from "./data/equipment";
import { ITEMS } from "./data/items";
import { BLOCKED_TILES, MAPS, tileAt } from "./data/maps";
import { TECHNIQUES } from "./data/techniques";

const STORAGE_KEY = "puzzle-rpg:rpg-mode:v1";
const BACKUP_STORAGE_KEY = `${STORAGE_KEY}:backup`;

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

function integer(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, Math.floor(value)))
    : fallback;
}

function uniqueStrings(value: unknown, maxItems: number, maxLength = 96) {
  if (!Array.isArray(value)) return [];
  const output: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const clean = item.slice(0, maxLength);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    output.push(clean);
    if (output.length >= maxItems) break;
  }
  return output;
}

function safePosition(map: MapDefinition, source: unknown, fallback: Vec2): Vec2 {
  const raw = source && typeof source === "object" ? source as Record<string, unknown> : {};
  const start = {
    x: integer(raw.x, fallback.x, 1, map.width - 2),
    y: integer(raw.y, fallback.y, 1, map.height - 2),
  };
  const walkable = (position: Vec2) => position.x >= 1 && position.x <= map.width - 2
    && position.y >= 1 && position.y <= map.height - 2
    && !BLOCKED_TILES.has(tileAt(map, position.x, position.y));
  if (walkable(start)) return start;

  // A damaged/imported save can contain an in-bounds wall/water coordinate.
  // Recover to the nearest walkable tile without changing map progression.
  const maxRadius = map.width + map.height;
  for (let radius = 1; radius <= maxRadius; radius += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const dy = radius - Math.abs(dx);
      const candidates = dy === 0
        ? [{ x: start.x + dx, y: start.y }]
        : [{ x: start.x + dx, y: start.y - dy }, { x: start.x + dx, y: start.y + dy }];
      for (const candidate of candidates) if (walkable(candidate)) return candidate;
    }
  }

  const safeFallback = {
    x: integer(fallback.x, 1, 1, map.width - 2),
    y: integer(fallback.y, 1, 1, map.height - 2),
  };
  return safeFallback;
}

function normalizeInventory(value: unknown, fallback: RPGSaveData["inventory"], slots: number) {
  if (!Array.isArray(value)) return fallback.slice(0, slots).map((stack) => ({ ...stack }));
  const merged = new Map<ItemId, number>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const stack = entry as Record<string, unknown>;
    if (typeof stack.id !== "string" || !ITEMS[stack.id as ItemId]) continue;
    const count = integer(stack.count, 1, 0, 9);
    if (count <= 0) continue;
    const id = stack.id as ItemId;
    merged.set(id, Math.min(9, (merged.get(id) ?? 0) + count));
    if (merged.size >= slots && !merged.has(id)) break;
  }
  return [...merged.entries()].slice(0, slots).map(([id, count]) => ({ id, count }));
}

function normalizeRecords(source: unknown) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return {};
  const output: Record<string, number> = {};
  for (const [rawId, count] of Object.entries(source as Record<string, unknown>)) {
    if (typeof count !== "number" || !Number.isFinite(count)) continue;
    const id = rawId.slice(0, 64);
    if (!id) continue;
    output[id] = integer(count, 0, 0, 999);
    if (Object.keys(output).length >= 128) break;
  }
  return output;
}

function isRecognizableLegacySave(value: Record<string, unknown>) {
  return typeof value.mapId === "string"
    || typeof value.playerName === "string"
    || Array.isArray(value.inventory)
    || Array.isArray(value.flags);
}

export function normalizeSave(raw: unknown): RPGSaveData | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const legacyVersion = value.version === undefined || value.version === 0;
  if (value.version !== 1 && !(legacyVersion && isRecognizableLegacySave(value))) return null;

  const fallback = createNewSave();
  const level = integer(value.level, fallback.level, 1, 30);
  const validMapId = typeof value.mapId === "string" && Boolean(MAPS[value.mapId]);
  const mapId = validMapId ? value.mapId as string : fallback.mapId;
  const map = MAPS[mapId]!;
  const position = safePosition(map, validMapId ? value.position : fallback.position, fallback.position);
  const direction = (["up", "down", "left", "right"] as Direction[]).includes(value.direction as Direction)
    ? value.direction as Direction
    : fallback.direction;

  const inventorySlots = integer(value.inventorySlots, fallback.inventorySlots, 4, 6);
  const inventory = normalizeInventory(value.inventory, fallback.inventory, inventorySlots);

  const equipmentOwned = (Array.isArray(value.equipmentOwned)
    ? uniqueStrings(value.equipmentOwned, Object.keys(EQUIPMENT).length)
    : fallback.equipmentOwned
  ).filter((id): id is EquipmentId => Boolean(EQUIPMENT[id as EquipmentId]));
  const uniqueEquipmentOwned = [...new Set(equipmentOwned)];

  const techniques = (Array.isArray(value.techniques)
    ? uniqueStrings(value.techniques, Object.keys(TECHNIQUES).length)
    : fallback.techniques
  ).filter((id): id is TechniqueId => Boolean(TECHNIQUES[id as TechniqueId]));
  const uniqueTechniques = [...new Set(techniques)].slice(0, 16);

  const equipRaw = value.equipment && typeof value.equipment === "object" && !Array.isArray(value.equipment)
    ? value.equipment as Record<string, unknown>
    : {};
  const slot = (key: "weapon" | "armor" | "charm") => {
    const id = equipRaw[key];
    return typeof id === "string"
      && EQUIPMENT[id as EquipmentId]?.slot === key
      && uniqueEquipmentOwned.includes(id as EquipmentId)
      ? id as EquipmentId
      : null;
  };

  const lastInnRaw = value.lastInn && typeof value.lastInn === "object" && !Array.isArray(value.lastInn)
    ? value.lastInn as Record<string, unknown>
    : {};
  const lastInnMapId = typeof lastInnRaw.mapId === "string" && MAPS[lastInnRaw.mapId]
    ? lastInnRaw.mapId
    : fallback.lastInn.mapId;
  const lastInnMap = MAPS[lastInnMapId]!;
  const lastInnFallback = lastInnMapId === fallback.lastInn.mapId
    ? fallback.lastInn.position
    : { x: Math.floor(lastInnMap.width / 2), y: lastInnMap.height - 2 };
  const lastInnPosition = safePosition(lastInnMap, lastInnRaw.position, lastInnFallback);

  const memos = Array.isArray(value.memos) ? (() => {
    const output: RPGSaveData["memos"] = [];
    const seen = new Set<string>();
    for (const memo of value.memos) {
      if (!memo || typeof memo !== "object") continue;
      const entry = memo as Record<string, unknown>;
      if (typeof entry.id !== "string" || typeof entry.title !== "string" || typeof entry.text !== "string") continue;
      const id = entry.id.slice(0, 64);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      output.push({ id, title: entry.title.slice(0, 64), text: entry.text.slice(0, 360), read: Boolean(entry.read) });
      if (output.length >= 80) break;
    }
    return output;
  })() : fallback.memos;

  const battleLog = Array.isArray(value.battleLog) ? value.battleLog.flatMap((record) => {
    if (!record || typeof record !== "object") return [];
    const entry = record as Record<string, unknown>;
    const outcome = ["victory", "release", "run", "defeat"].includes(String(entry.outcome))
      ? entry.outcome as "victory" | "release" | "run" | "defeat"
      : null;
    if (typeof entry.enemyId !== "string" || !outcome || typeof entry.mapId !== "string" || !MAPS[entry.mapId]) return [];
    return [{
      enemyId: entry.enemyId.slice(0, 64),
      outcome,
      turns: integer(entry.turns, 0, 0, 999),
      hp: integer(entry.hp, 1, 0, 99),
      itemsUsed: integer(entry.itemsUsed, 0, 0, 99),
      mapId: entry.mapId,
      level: integer(entry.level, 1, 1, 30),
    }];
  }).slice(-120) : [];

  const armor = slot("armor");
  const maxHp = maxHpForLevel(level) + (armor === "travellerCoat" ? 2 : 0);
  const rawPlayerName = typeof value.playerName === "string" ? value.playerName.trim().slice(0, 10) : "";

  return {
    version: 1,
    playerName: rawPlayerName || fallback.playerName,
    level,
    exp: integer(value.exp, fallback.exp, 0, 999999),
    hp: integer(value.hp, maxHp, 1, maxHp),
    maxHp,
    gold: integer(value.gold, fallback.gold, 0, 999999),
    mapId,
    position,
    direction,
    lastInn: { mapId: lastInnMapId, position: lastInnPosition },
    inventory,
    inventorySlots,
    equipmentOwned: uniqueEquipmentOwned,
    equipment: { weapon: slot("weapon"), armor, charm: slot("charm") },
    techniques: uniqueTechniques,
    techniqueSlots: integer(value.techniqueSlots, fallback.techniqueSlots, 2, 8),
    memos,
    flags: Array.isArray(value.flags) ? uniqueStrings(value.flags, 256) : fallback.flags,
    openedChests: Array.isArray(value.openedChests) ? uniqueStrings(value.openedChests, 160) : fallback.openedChests,
    defeatedEncounters: Array.isArray(value.defeatedEncounters) ? uniqueStrings(value.defeatedEncounters, 160) : fallback.defeatedEncounters,
    defeatedEnemies: normalizeRecords(value.defeatedEnemies),
    releasedEnemies: normalizeRecords(value.releasedEnemies),
    battleLog,
    steps: integer(value.steps, fallback.steps, 0, 9999999),
    playSeconds: integer(value.playSeconds, fallback.playSeconds, 0, 99999999),
    encounterMeter: integer(value.encounterMeter, fallback.encounterMeter, 3, 99),
    settings: {
      music: typeof (value.settings as Record<string, unknown> | undefined)?.music === "boolean"
        ? Boolean((value.settings as Record<string, unknown>).music)
        : fallback.settings.music,
      sfx: typeof (value.settings as Record<string, unknown> | undefined)?.sfx === "boolean"
        ? Boolean((value.settings as Record<string, unknown>).sfx)
        : fallback.settings.sfx,
    },
  };
}

function parseSaveText(text: string | null) {
  if (!text) return null;
  try {
    return normalizeSave(JSON.parse(text));
  } catch {
    return null;
  }
}

function isFutureSaveText(text: string | null) {
  if (!text) return false;
  try {
    const value = JSON.parse(text) as unknown;
    return Boolean(value && typeof value === "object" && !Array.isArray(value)
      && typeof (value as Record<string, unknown>).version === "number"
      && ((value as Record<string, unknown>).version as number) > 1);
  } catch {
    return false;
  }
}

export function loadSave(): RPGSaveData | null {
  if (typeof window === "undefined") return null;
  let primaryText: string | null = null;
  let backupText: string | null = null;
  try { primaryText = window.localStorage.getItem(STORAGE_KEY); } catch { /* storage unavailable */ }

  const primary = parseSaveText(primaryText);
  if (primary) return primary;
  // Never downgrade a save written by a newer game version using an older backup.
  if (isFutureSaveText(primaryText)) return null;

  try { backupText = window.localStorage.getItem(BACKUP_STORAGE_KEY); } catch { /* storage unavailable */ }
  const backup = parseSaveText(backupText);
  if (!backup) return null;

  // A valid one-generation backup repairs a malformed/missing primary slot.
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(backup)); } catch { /* recovery remains playable in memory */ }
  return backup;
}

export function saveGame(save: RPGSaveData) {
  if (typeof window === "undefined") return;
  const normalized = normalizeSave(save);
  if (!normalized) return;
  const serialized = JSON.stringify(normalized);

  let previousText: string | null = null;
  try { previousText = window.localStorage.getItem(STORAGE_KEY); } catch { /* continue with primary write */ }
  const previous = parseSaveText(previousText);
  if (previous) {
    try { window.localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(previous)); } catch { /* primary write still attempted */ }
  }

  let primaryWritten = false;
  try {
    window.localStorage.setItem(STORAGE_KEY, serialized);
    primaryWritten = true;
  } catch {
    // Private browsing/quota failures keep the current run playable in memory.
  }

  if (primaryWritten && !previous) {
    try { window.localStorage.setItem(BACKUP_STORAGE_KEY, serialized); } catch { /* best-effort first backup */ }
  }
}

export function hasSave() {
  return loadSave() !== null;
}

export function exportSave(save: RPGSaveData) {
  const normalized = normalizeSave(save) ?? createNewSave();
  const blob = new Blob([JSON.stringify(normalized, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `puzzle-rpg-${normalized.playerName.toLowerCase()}-lv${normalized.level}.json`;
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
