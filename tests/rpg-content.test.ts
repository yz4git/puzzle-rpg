import assert from "node:assert/strict";
import test from "node:test";
import { ENEMIES, BOSS_ENEMY_IDS, NORMAL_ENEMY_IDS, SPECIAL_ENEMY_IDS } from "../app/rpg/data/enemies";
import { EQUIPMENT, EQUIPMENT_ORDER } from "../app/rpg/data/equipment";
import { ITEMS, ITEM_ORDER } from "../app/rpg/data/items";
import { BLOCKED_TILES, MAPS, tileAt } from "../app/rpg/data/maps";
import { NPCS } from "../app/rpg/data/npcs";
import { BOSS_TECHNIQUE_REWARDS, TECHNIQUE_EQUIPMENT_REWARDS } from "../app/rpg/data/rewards";
import { TECHNIQUE_ORDER } from "../app/rpg/data/techniques";
import { createNewSave, maxHpForLevel } from "../app/rpg/save";
import type { EquipmentId, ItemId, TechniqueId } from "../app/rpg/types";

test("RPG v1 content targets and map invariants", () => {
  const maps = Object.values(MAPS);
  assert.equal(maps.filter((map) => map.id === "world").length, 1);
  assert.equal(maps.filter((map) => map.kind === "town").length, 5);
  assert.equal(maps.filter((map) => map.kind === "training").length, 4);
  assert.equal(maps.filter((map) => map.kind === "dungeon" && map.id !== "prismCitadel").length, 3);
  assert.equal(maps.filter((map) => map.id === "prismCitadel").length, 1);
  assert.equal(NPCS.length, 35);
  assert.equal(NORMAL_ENEMY_IDS.length, 12);
  assert.equal(SPECIAL_ENEMY_IDS.length, 6);
  assert.equal(BOSS_ENEMY_IDS.length, 6);
  assert.equal(TECHNIQUE_ORDER.length, 16);
  assert.equal(EQUIPMENT_ORDER.length, 12);
  assert.equal(ITEM_ORDER.length, 6);

  for (const map of maps) {
    assert.equal(map.tiles.length, map.height, `${map.id} height`);
    map.tiles.forEach((row) => assert.equal(row.length, map.width, `${map.id} width`));
    const entries = [...map.portals, ...map.chests, ...map.fixedEncounters];
    for (const entry of entries) {
      assert.ok(entry.x > 0 && entry.x < map.width - 1 && entry.y > 0 && entry.y < map.height - 1, `${map.id} entry in bounds`);
      assert.ok(!BLOCKED_TILES.has(tileAt(map, entry.x, entry.y)), `${map.id} entry is walkable`);
    }
    for (const portal of map.portals) {
      const target = MAPS[portal.targetMap];
      assert.ok(target, `${map.id} portal target exists`);
      assert.ok(!BLOCKED_TILES.has(tileAt(target!, portal.target.x, portal.target.y)), `${map.id} portal target is walkable`);
    }
  }

  for (const npc of NPCS) {
    const map = MAPS[npc.mapId];
    assert.ok(map, `${npc.id} map exists`);
    assert.ok(!BLOCKED_TILES.has(tileAt(map!, npc.x, npc.y)), `${npc.id} stands on walkable tile`);
    assert.ok(!map!.portals.some((portal) => portal.x === npc.x && portal.y === npc.y), `${npc.id} does not block portal`);
  }

  const reached = new Set(["hearthVillage"]);
  const queue = ["hearthVillage"];
  while (queue.length) {
    const id = queue.shift()!;
    for (const portal of MAPS[id]!.portals) if (!reached.has(portal.targetMap)) { reached.add(portal.targetMap); queue.push(portal.targetMap); }
  }
  assert.deepEqual([...reached].sort(), Object.keys(MAPS).sort(), "all maps are connected to the starting village");
});

test("every technique, equipment piece and item has an acquisition path", () => {
  const techniques = new Set<TechniqueId>();
  const equipment = new Set<EquipmentId>(createNewSave().equipmentOwned);
  const items = new Set<ItemId>(createNewSave().inventory.map((stack) => stack.id));

  for (const npc of NPCS) {
    if (npc.action?.kind === "training") techniques.add(npc.action.technique);
    if (npc.action?.kind === "shop") for (const id of npc.action.stock) {
      if (EQUIPMENT[id as EquipmentId]) equipment.add(id as EquipmentId);
      if (ITEMS[id as ItemId]) items.add(id as ItemId);
    }
  }
  for (const map of Object.values(MAPS)) for (const chest of map.chests) {
    if (chest.equipment) equipment.add(chest.equipment);
    if (chest.item) items.add(chest.item);
  }
  for (const enemy of Object.values(ENEMIES)) {
    if (enemy.alt?.technique) techniques.add(enemy.alt.technique);
    if (enemy.alt?.equipment) equipment.add(enemy.alt.equipment);
    if (enemy.alt?.item) items.add(enemy.alt.item);
    if (enemy.drop) items.add(enemy.drop);
  }
  Object.values(BOSS_TECHNIQUE_REWARDS).forEach((id) => { if (id) techniques.add(id); });
  Object.values(TECHNIQUE_EQUIPMENT_REWARDS).forEach((id) => { if (id) equipment.add(id); });

  assert.deepEqual([...techniques].sort(), [...TECHNIQUE_ORDER].sort());
  assert.deepEqual([...equipment].sort(), [...EQUIPMENT_ORDER].sort());
  assert.deepEqual([...items].sort(), [...ITEM_ORDER].sort());
  assert.equal(maxHpForLevel(1), 20);
  assert.equal(maxHpForLevel(5), 24);
  assert.equal(maxHpForLevel(10), 30);
});
