import assert from "node:assert/strict";
import test from "node:test";
import { BLOCKED_TILES, MAPS, tileAt } from "../app/rpg/data/maps";
import { createNewSave, loadSave, normalizeSave, saveGame } from "../app/rpg/save";

const STORAGE_KEY = "puzzle-rpg:rpg-mode:v1";
const BACKUP_STORAGE_KEY = `${STORAGE_KEY}:backup`;

class MemoryStorage {
  values = new Map<string, string>();
  throwOnSet = false;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) {
    if (this.throwOnSet) throw new Error("quota");
    this.values.set(key, value);
  }
}

function withStorage<T>(storage: MemoryStorage, run: () => T): T {
  const globalRecord = globalThis as typeof globalThis & { window?: unknown };
  const previous = globalRecord.window;
  globalRecord.window = { localStorage: storage };
  try { return run(); }
  finally {
    if (previous === undefined) delete globalRecord.window;
    else globalRecord.window = previous;
  }
}

test("rejects junk and future saves instead of silently resetting progression", () => {
  assert.equal(normalizeSave(null), null);
  assert.equal(normalizeSave({}), null);
  assert.equal(normalizeSave({ version: 9, mapId: "world", playerName: "LIO" }), null);
});

test("migrates recognizable pre-release versionless saves to v1", () => {
  const legacy = { ...createNewSave(), version: undefined, level: 4, gold: 123 } as Record<string, unknown>;
  const recovered = normalizeSave(legacy);
  assert.ok(recovered);
  assert.equal(recovered.version, 1);
  assert.equal(recovered.level, 4);
  assert.equal(recovered.gold, 123);
});

test("repairs blocked coordinates and sanitizes duplicate or invalid collections", () => {
  const raw = {
    ...createNewSave(),
    mapId: "world",
    position: { x: 20, y: 18 },
    inventory: [
      { id: "herb", count: 8 },
      { id: "herb", count: 8 },
      { id: "smoke", count: 0 },
      { id: "not-an-item", count: 5 },
    ],
    equipmentOwned: ["travellerCoat", "travellerCoat", "not-equipment"],
    equipment: { armor: "travellerCoat", weapon: "travellerCoat", charm: "not-equipment" },
    techniques: ["quietStep", "quietStep", "not-technique"],
    flags: ["story:openingSeen", "story:openingSeen", 4],
    openedChests: ["chest:a", "chest:a"],
  };
  const recovered = normalizeSave(raw);
  assert.ok(recovered);
  const map = MAPS[recovered.mapId]!;
  assert.equal(BLOCKED_TILES.has(tileAt(map, recovered.position.x, recovered.position.y)), false);
  assert.deepEqual(recovered.inventory, [{ id: "herb", count: 9 }]);
  assert.deepEqual(recovered.equipmentOwned, ["travellerCoat"]);
  assert.equal(recovered.equipment.armor, "travellerCoat");
  assert.equal(recovered.equipment.weapon, null);
  assert.equal(recovered.equipment.charm, null);
  assert.deepEqual(recovered.techniques, ["quietStep"]);
  assert.deepEqual(recovered.flags, ["story:openingSeen"]);
  assert.deepEqual(recovered.openedChests, ["chest:a"]);
});

test("loads the backup when the primary JSON is corrupted and repairs primary", () => {
  const storage = new MemoryStorage();
  const backup = { ...createNewSave(), gold: 77, flags: ["story:openingSeen"] };
  storage.values.set(STORAGE_KEY, "{broken-json");
  storage.values.set(BACKUP_STORAGE_KEY, JSON.stringify(backup));
  const loaded = withStorage(storage, () => loadSave());
  assert.ok(loaded);
  assert.equal(loaded.gold, 77);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)!).gold, 77);
});

test("does not downgrade a future primary save using an older backup", () => {
  const storage = new MemoryStorage();
  storage.values.set(STORAGE_KEY, JSON.stringify({ version: 2, mapId: "world", playerName: "LIO" }));
  storage.values.set(BACKUP_STORAGE_KEY, JSON.stringify(createNewSave()));
  const loaded = withStorage(storage, () => loadSave());
  assert.equal(loaded, null);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)!).version, 2);
});

test("rotates a valid previous save into the recovery slot before writing primary", () => {
  const storage = new MemoryStorage();
  const previous = { ...createNewSave(), gold: 18 };
  storage.values.set(STORAGE_KEY, JSON.stringify(previous));
  const next = { ...previous, gold: 91, flags: ["story:openingSeen"] };
  withStorage(storage, () => saveGame(next));
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)!).gold, 91);
  assert.equal(JSON.parse(storage.getItem(BACKUP_STORAGE_KEY)!).gold, 18);
});

test("storage quota/private-mode write errors never crash the active run", () => {
  const storage = new MemoryStorage();
  storage.throwOnSet = true;
  assert.doesNotThrow(() => withStorage(storage, () => saveGame(createNewSave())));
});
