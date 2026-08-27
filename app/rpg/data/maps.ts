import type { MapDefinition, PortalDefinition, Vec2 } from "../types";

type Grid = string[][];

function grid(width: number, height: number, fill: string): Grid {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
}

function put(target: Grid, x: number, y: number, value: string) {
  if (target[y]?.[x] !== undefined) target[y]![x] = value;
}

function rect(target: Grid, x: number, y: number, width: number, height: number, value: string) {
  for (let yy = y; yy < y + height; yy += 1) for (let xx = x; xx < x + width; xx += 1) put(target, xx, yy, value);
}

function line(target: Grid, from: Vec2, to: Vec2, value: string) {
  let x = from.x;
  let y = from.y;
  while (x !== to.x) { put(target, x, y, value); x += Math.sign(to.x - x); }
  while (y !== to.y) { put(target, x, y, value); y += Math.sign(to.y - y); }
  put(target, x, y, value);
}

function rows(target: Grid) {
  return target.map((row) => row.join(""));
}

function worldMap(): MapDefinition {
  const width = 48;
  const height = 30;
  const map = grid(width, height, "g");
  rect(map, 0, 0, width, 1, "m");
  rect(map, 0, height - 1, width, 1, "w");
  rect(map, 0, 0, 1, height, "m");
  rect(map, width - 1, 0, 1, height, "m");

  // Lake and river divide the safe road from the dangerous eastern shortcut.
  rect(map, 17, 16, 10, 8, "w");
  rect(map, 20, 8, 2, 9, "w");
  put(map, 20, 22, "b"); put(map, 21, 22, "b");
  put(map, 20, 11, "b"); put(map, 21, 11, "b");

  // Northern ridge leaves a guarded route through Void Pass.
  rect(map, 1, 7, 46, 2, "m");
  rect(map, 21, 7, 3, 2, "g");
  rect(map, 36, 7, 4, 2, "d");

  // Main roads.
  line(map, { x: 6, y: 25 }, { x: 10, y: 20 }, "r");
  line(map, { x: 6, y: 25 }, { x: 22, y: 22 }, "r");
  line(map, { x: 22, y: 22 }, { x: 32, y: 18 }, "r");
  line(map, { x: 10, y: 20 }, { x: 15, y: 12 }, "r");
  line(map, { x: 15, y: 12 }, { x: 22, y: 11 }, "r");
  line(map, { x: 22, y: 11 }, { x: 29, y: 10 }, "r");
  line(map, { x: 29, y: 10 }, { x: 32, y: 6 }, "r");
  line(map, { x: 32, y: 6 }, { x: 38, y: 7 }, "r");
  line(map, { x: 38, y: 7 }, { x: 42, y: 3 }, "r");

  // Optional branches to the four masters.
  line(map, { x: 6, y: 25 }, { x: 3, y: 22 }, "r");
  line(map, { x: 22, y: 22 }, { x: 28, y: 25 }, "r");
  line(map, { x: 15, y: 12 }, { x: 11, y: 10 }, "r");
  line(map, { x: 22, y: 11 }, { x: 22, y: 6 }, "r");

  // Risky shortcuts.
  line(map, { x: 8, y: 23 }, { x: 15, y: 15 }, "d");
  line(map, { x: 27, y: 21 }, { x: 39, y: 16 }, "d");
  line(map, { x: 17, y: 12 }, { x: 29, y: 10 }, "d");
  rect(map, 34, 13, 9, 5, "d");
  rect(map, 27, 4, 8, 3, "f");
  rect(map, 6, 17, 7, 5, "f");

  const portals: PortalDefinition[] = [
    { id: "world-hearth", x: 6, y: 25, label: "HEARTH VILLAGE", targetMap: "hearthVillage", target: { x: 8, y: 11 } },
    { id: "world-ember", x: 3, y: 22, label: "EMBER SHRINE", targetMap: "emberShrine", target: { x: 8, y: 9 } },
    { id: "world-temple", x: 10, y: 20, label: "OLD TEMPLE", targetMap: "oldTemple", target: { x: 10, y: 15 } },
    { id: "world-lake", x: 22, y: 22, label: "LAKE VILLAGE", targetMap: "lakeVillage", target: { x: 8, y: 11 } },
    { id: "world-bower", x: 28, y: 25, label: "QUIET BOWER", targetMap: "quietBower", target: { x: 8, y: 9 } },
    { id: "world-reed", x: 32, y: 18, label: "REED HAMLET", targetMap: "reedHamlet", target: { x: 8, y: 11 } },
    { id: "world-marsh", x: 40, y: 16, label: "CRIMSON MARSH", targetMap: "crimsonMarsh", target: { x: 10, y: 15 } },
    { id: "world-iron", x: 15, y: 12, label: "IRON CITY", targetMap: "ironCity", target: { x: 8, y: 11 }, requireFlag: "boss:templeKeeper", blockedText: "古寺の橋印がなければ城塞街道は開かない。" },
    { id: "world-hall", x: 11, y: 10, label: "IRON HALL", targetMap: "ironHall", target: { x: 8, y: 9 } },
    { id: "world-mirror-town", x: 29, y: 10, label: "MIRROR TOWN", targetMap: "mirrorTown", target: { x: 8, y: 11 } },
    { id: "world-tower", x: 32, y: 6, label: "MIRROR TOWER", targetMap: "mirrorTower", target: { x: 10, y: 15 } },
    { id: "world-hour", x: 22, y: 6, label: "HOUR SPIRE", targetMap: "hourSpire", target: { x: 8, y: 9 } },
    { id: "world-void", x: 38, y: 7, label: "VOID PASS", targetMap: "voidPass", target: { x: 8, y: 13 }, requireFlag: "boss:ironTyrant", blockedText: "IRON CITYの門が閉じ、北へ進めない。" },
    { id: "world-citadel", x: 42, y: 3, label: "PRISM CITADEL", targetMap: "prismCitadel", target: { x: 10, y: 20 }, requireFlag: "gate:citadel", blockedText: "四つの修行印とVOIDの証が必要だ。" },
  ];

  return {
    id: "world", name: "PRISM ROAD", kind: "field", width, height, tiles: rows(map), portals,
    chests: [
      { id: "world-forest-cache", x: 9, y: 18, item: "smoke" },
      { id: "world-lake-cache", x: 26, y: 20, item: "guardStone" },
      { id: "world-danger-cache", x: 37, y: 15, equipment: "roadBell" },
    ],
    fixedEncounters: [
      { id: "world-wisp", x: 11, y: 19, enemyId: "forestWisp", defeatedFlag: "fixed:forestWisp" },
      { id: "world-red-hermit", x: 36, y: 14, enemyId: "redHermit", requireFlag: "boss:scarletOracle", defeatedFlag: "fixed:redHermit" },
      { id: "world-silent", x: 37, y: 6, enemyId: "silentHerald", requireFlag: "boss:ironTyrant", defeatedFlag: "fixed:silentHerald" },
    ],
    encounterTable: ["mossSlime", "roadFang", "thornBat"], dangerEncounterTable: ["copperBeetle", "marshLeech", "ashCrow"], music: "world",
  };
}

function town(id: string, name: string, returnPosition: Vec2, water = false): MapDefinition {
  const width = 18;
  const height = 14;
  const map = grid(width, height, ".");
  rect(map, 0, 0, width, 1, "#");
  rect(map, 0, 0, 1, height, "#");
  rect(map, width - 1, 0, 1, height, "#");
  rect(map, 0, height - 1, width, 1, "#");
  rect(map, 2, 2, 4, 2, "h");
  rect(map, 8, 2, 4, 2, "h");
  rect(map, 13, 2, 3, 2, "h");
  line(map, { x: 8, y: 4 }, { x: 8, y: 12 }, "r");
  line(map, { x: 3, y: 7 }, { x: 15, y: 7 }, "r");
  if (water) {
    rect(map, 1, 10, 5, 3, "w");
    line(map, { x: 5, y: 11 }, { x: 8, y: 11 }, "b");
  }
  put(map, 8, 13, "r");
  return {
    id, name, kind: "town", width, height, tiles: rows(map), returnMap: "world", returnPosition,
    portals: [{ id: `${id}-exit`, x: 8, y: 12, label: "WORLD MAP", targetMap: "world", target: returnPosition }],
    chests: [], fixedEncounters: [], music: id === "ironCity" ? "castle" : "village",
  };
}

function training(id: string, name: string, returnPosition: Vec2): MapDefinition {
  const width = 16;
  const height = 12;
  const map = grid(width, height, ".");
  rect(map, 0, 0, width, 1, "#"); rect(map, 0, height - 1, width, 1, "#");
  rect(map, 0, 0, 1, height, "#"); rect(map, width - 1, 0, 1, height, "#");
  rect(map, 3, 2, 10, 1, "a");
  line(map, { x: 8, y: 3 }, { x: 8, y: 10 }, "r");
  return {
    id, name, kind: "training", width, height, tiles: rows(map), returnMap: "world", returnPosition,
    portals: [{ id: `${id}-exit`, x: 8, y: 10, label: "WORLD MAP", targetMap: "world", target: returnPosition }],
    chests: [], fixedEncounters: [], music: "village",
  };
}

function dungeon(id: string, name: string, returnPosition: Vec2, enemyId: string, defeatedFlag: string): MapDefinition {
  const width = 20;
  const height = 18;
  const map = grid(width, height, "s");
  rect(map, 0, 0, width, 1, "#"); rect(map, 0, height - 1, width, 1, "#");
  rect(map, 0, 0, 1, height, "#"); rect(map, width - 1, 0, 1, height, "#");
  rect(map, 3, 5, 14, 1, "#"); put(map, 5, 5, "s"); put(map, 14, 5, "s");
  rect(map, 3, 11, 14, 1, "#"); put(map, 8, 11, "s"); put(map, 16, 11, "s");
  rect(map, 9, 1, 2, 4, "x");
  line(map, { x: 10, y: 16 }, { x: 10, y: 12 }, "s");
  put(map, 10, 17, "s");
  return {
    id, name, kind: "dungeon", width, height, tiles: rows(map), returnMap: "world", returnPosition,
    portals: [{ id: `${id}-exit`, x: 10, y: 16, label: "WORLD MAP", targetMap: "world", target: returnPosition }],
    chests: [
      { id: `${id}-chest-a`, x: 3, y: 3, item: "guardStone" },
      { id: `${id}-chest-b`, x: 16, y: 14, item: "boardBell" },
    ],
    fixedEncounters: [{ id: `${id}-boss`, x: 10, y: 3, enemyId, defeatedFlag }],
    encounterTable: ["thornBat", "copperBeetle", "hollowMonk"], dangerEncounterTable: ["mirrorMote", "gateMimic"], music: "dungeon",
  };
}

function voidPass(): MapDefinition {
  const width = 16;
  const height = 16;
  const map = grid(width, height, "x");
  rect(map, 0, 0, width, 1, "m"); rect(map, 0, height - 1, width, 1, "m");
  rect(map, 0, 0, 1, height, "m"); rect(map, width - 1, 0, 1, height, "m");
  line(map, { x: 8, y: 14 }, { x: 8, y: 2 }, "r");
  rect(map, 3, 6, 4, 2, "m"); rect(map, 9, 10, 4, 2, "m");
  return {
    id: "voidPass", name: "VOID PASS", kind: "danger", width, height, tiles: rows(map), returnMap: "world", returnPosition: { x: 38, y: 8 },
    portals: [{ id: "void-exit", x: 8, y: 14, label: "WORLD MAP", targetMap: "world", target: { x: 38, y: 8 } }],
    chests: [{ id: "void-thread", x: 3, y: 3, equipment: "voidThread" }],
    fixedEncounters: [{ id: "void-boss", x: 8, y: 3, enemyId: "voidHerald", defeatedFlag: "boss:voidHerald", afterFlag: "void:clear" }],
    encounterTable: ["prismHound", "silentHerald"], dangerEncounterTable: ["citadelEye", "clockMoth"], music: "dungeon",
  };
}

function prismCitadel(): MapDefinition {
  const width = 22;
  const height = 23;
  const map = grid(width, height, "s");
  rect(map, 0, 0, width, 1, "#"); rect(map, 0, height - 1, width, 1, "#");
  rect(map, 0, 0, 1, height, "#"); rect(map, width - 1, 0, 1, height, "#");
  for (let y = 4; y < 20; y += 4) {
    rect(map, 3, y, 16, 1, "#");
    put(map, y % 8 === 0 ? 6 : 15, y, "s");
  }
  line(map, { x: 10, y: 21 }, { x: 10, y: 18 }, "s");
  return {
    id: "prismCitadel", name: "PRISM CITADEL", kind: "dungeon", width, height, tiles: rows(map), returnMap: "world", returnPosition: { x: 42, y: 4 },
    portals: [{ id: "citadel-exit", x: 10, y: 21, label: "WORLD MAP", targetMap: "world", target: { x: 42, y: 4 } }],
    chests: [
      { id: "citadel-prism-guard", x: 3, y: 18, equipment: "prismGuard" },
      { id: "citadel-prism-drop", x: 18, y: 10, item: "prismDrop" },
      { id: "citadel-mirror-edge", x: 3, y: 6, equipment: "mirrorEdge" },
    ],
    fixedEncounters: [
      { id: "citadel-null", x: 15, y: 9, enemyId: "nullExecutioner", defeatedFlag: "boss:nullExecutioner" },
      { id: "citadel-final", x: 10, y: 2, enemyId: "prismSovereign", requireFlag: "boss:nullExecutioner", defeatedFlag: "boss:prismSovereign", afterFlag: "story:ending" },
    ],
    encounterTable: ["prismHound", "citadelEye", "hollowMonk"], dangerEncounterTable: ["gateMimic", "clockMoth"], music: "castle",
  };
}

const mapList: MapDefinition[] = [
  worldMap(),
  town("hearthVillage", "HEARTH VILLAGE", { x: 6, y: 26 }),
  town("lakeVillage", "LAKE VILLAGE", { x: 22, y: 23 }, true),
  town("reedHamlet", "REED HAMLET", { x: 32, y: 19 }, true),
  {
    ...town("ironCity", "IRON CITY", { x: 15, y: 13 }),
    fixedEncounters: [{ id: "iron-throne", x: 9, y: 2, enemyId: "ironTyrant", requireFlag: "boss:scarletOracle", defeatedFlag: "boss:ironTyrant" }],
  },
  town("mirrorTown", "MIRROR TOWN", { x: 29, y: 11 }),
  training("emberShrine", "EMBER SHRINE", { x: 3, y: 23 }),
  training("quietBower", "QUIET BOWER", { x: 28, y: 26 }),
  training("ironHall", "IRON HALL", { x: 11, y: 11 }),
  training("hourSpire", "HOUR SPIRE", { x: 22, y: 7 }),
  dungeon("oldTemple", "OLD TEMPLE", { x: 10, y: 21 }, "templeKeeper", "boss:templeKeeper"),
  dungeon("crimsonMarsh", "CRIMSON MARSH", { x: 40, y: 17 }, "scarletOracle", "boss:scarletOracle"),
  {
    ...dungeon("mirrorTower", "MIRROR TOWER", { x: 32, y: 7 }, "lostKnight", "fixed:lostKnight"),
    fixedEncounters: [
      { id: "mirror-lost", x: 10, y: 3, enemyId: "lostKnight", defeatedFlag: "fixed:lostKnight", afterFlag: "key:mirror" },
      { id: "mirror-mimic", x: 16, y: 14, enemyId: "gateMimic", defeatedFlag: "fixed:gateMimic" },
    ],
  },
  voidPass(),
  prismCitadel(),
];

export const MAPS: Record<string, MapDefinition> = Object.fromEntries(mapList.map((map) => [map.id, map]));

export const BLOCKED_TILES = new Set(["#", "m", "w", "h", "a"]);

export function tileAt(map: MapDefinition, x: number, y: number) {
  return map.tiles[y]?.[x] ?? "#";
}

export function isRoadTile(tile: string) {
  return tile === "r" || tile === "b";
}

export function isDangerTile(tile: string) {
  return tile === "d" || tile === "x";
}
