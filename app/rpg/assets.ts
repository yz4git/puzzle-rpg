import type { Direction, MapDefinition, NPCDefinition } from "./types";

export const RPG_ASSETS = {
  hero: "/assets/rpg/atlas/hero.png",
  heroTitle: "/assets/rpg/atlas/hero-title.png",
  npcs: "/assets/rpg/atlas/npcs.png",
  field: "/assets/rpg/atlas/field.png",
  town: "/assets/rpg/atlas/town.png",
  dungeon: "/assets/rpg/atlas/dungeon.png",
  enemyA: "/assets/rpg/atlas/enemy-a.png",
  enemyB: "/assets/rpg/atlas/enemy-b.png",
  bosses: "/assets/rpg/atlas/boss.png",
  ui: "/assets/rpg/atlas/ui.png",
} as const;

export type AtlasKey = "field" | "town" | "dungeon";
export type AtlasCell = { atlas: AtlasKey; col: number; row: number; rotation?: 0 | 1 | 2 | 3 };
export type EnemySpriteFrame = "idle" | "reaction" | "attack" | "hurt" | "phase";
export type EnemySpriteCell = { src: string; columns: number; rows: number; col: number; row: number };

export const RPG_ATLAS_METRICS = {
  terrain: { width: 64, height: 64 },
  hero: { width: 96, height: 96 },
  npc: { width: 96, height: 128 },
  enemyA: { width: 128, height: 128 },
  enemyB: { width: 128, height: 128 },
  boss: { width: 160, height: 160 },
  ui: { width: 96, height: 96 },
} as const;

function stableSeed(x: number, y: number) {
  let value = Math.imul(x + 37, 0x45d9f3b) ^ Math.imul(y + 71, 0x119de1f3);
  value ^= value >>> 16;
  return Math.abs(value);
}

function isRoadConnection(map: MapDefinition, x: number, y: number) {
  const row = map.tiles[y];
  if (!row) return false;
  const code = row[x];
  return code === "r" || code === "b";
}

function roadCell(map: MapDefinition, x: number, y: number): AtlasCell {
  const up = isRoadConnection(map, x, y - 1);
  const right = isRoadConnection(map, x + 1, y);
  const down = isRoadConnection(map, x, y + 1);
  const left = isRoadConnection(map, x - 1, y);
  const count = Number(up) + Number(right) + Number(down) + Number(left);
  if (count >= 4) return { atlas: "field", col: 9, row: 1 };
  if (count === 3) {
    const rotation = !up ? 0 : !right ? 1 : !down ? 2 : 3;
    return { atlas: "field", col: 8, row: 1, rotation };
  }
  if (count === 2 && ((up && right) || (right && down) || (down && left) || (left && up))) {
    const rotation = up && right ? 0 : right && down ? 1 : down && left ? 2 : 3;
    return { atlas: "field", col: 8, row: 1, rotation };
  }
  if (left || right) return { atlas: "field", col: 7, row: 1 };
  return { atlas: "field", col: 5, row: 1 };
}

export function terrainAtlasCell(map: MapDefinition, code: string, x: number, y: number): AtlasCell {
  const seed = stableSeed(x, y);
  if (map.id === "world") {
    if (code === "g") return { atlas: "field", col: seed % 6, row: 0 };
    if (code === "f") return { atlas: "field", col: 6 + seed % 4, row: seed % 3 === 0 ? 0 : 1 };
    if (code === "r") return roadCell(map, x, y);
    if (code === "d" || code === "x") return { atlas: "field", col: seed % 10, row: 2 };
    if (code === "w") return { atlas: "field", col: seed % 4, row: 3 };
    if (code === "b") return { atlas: "field", col: isRoadConnection(map, x - 1, y) || isRoadConnection(map, x + 1, y) ? 0 : 1, row: 4 };
    if (code === "m") return { atlas: "field", col: seed % 8, row: 5 };
    return { atlas: "field", col: 0, row: 0 };
  }

  if (map.kind === "town" || map.kind === "training") {
    if (code === "h") return { atlas: "town", col: seed % 2, row: 7 };
    if (code === "#") return { atlas: "town", col: 6 + seed % 2, row: 6 };
    if (code === "w") return { atlas: "town", col: 5 + seed % 3, row: 7 };
    if (code === "b") return { atlas: "town", col: 3 + seed % 2, row: 4 };
    if (code === "a") return { atlas: "town", col: 4 + seed % 3, row: 4 };
    if (code === "r") return { atlas: "town", col: 2 + seed % 2, row: 0 };
    return { atlas: "town", col: seed % 2, row: 7 };
  }

  if (code === "#") return { atlas: "dungeon", col: 2 + seed % 2, row: 0 };
  if (code === "x") {
    if (map.id === "crimsonMarsh") return { atlas: "dungeon", col: seed % 8, row: 2 + seed % 2 };
    if (map.id === "mirrorTower") return { atlas: "dungeon", col: seed % 8, row: 4 + seed % 2 };
    return { atlas: "dungeon", col: seed % 8, row: 6 + seed % 2 };
  }
  return { atlas: "dungeon", col: seed % 2, row: 0 };
}

const NPC_INDEX: Record<NPCDefinition["sprite"], number> = {
  elder: 0, woman: 1, man: 2, child: 3,
  soldier: 4, merchant: 5, priest: 6, master: 7,
  ruler: 8, scholar: 9, traveller: 10, mystery: 11,
};

export function npcAtlasCell(sprite: NPCDefinition["sprite"]) {
  const index = NPC_INDEX[sprite];
  return { col: index % 4, row: Math.floor(index / 4) };
}

export function heroAtlasCell(direction: Direction, walk: number) {
  if (direction === "up") return { col: 2, row: 3 };
  const row = direction === "down" ? 0 : direction === "left" ? 1 : 2;
  return { col: walk % 3, row };
}

const ENEMY_A: Record<string, [number, number]> = {
  mossSlime: [0, 0], roadFang: [2, 0], thornBat: [0, 1], lakeImp: [2, 1], copperBeetle: [0, 2], marshLeech: [2, 2],
};
const ENEMY_B: Record<string, [number, number]> = {
  ashCrow: [0, 0], ironSentry: [2, 0], mirrorMote: [4, 0], hollowMonk: [6, 0],
  prismHound: [0, 1], citadelEye: [2, 1], forestWisp: [4, 1], lostKnight: [6, 1],
  redHermit: [0, 2], clockMoth: [2, 2], gateMimic: [4, 2], silentHerald: [6, 2],
};
const BOSSES: Record<string, [number, number]> = {
  templeKeeper: [0, 0], scarletOracle: [4, 0], ironTyrant: [0, 1], voidHerald: [4, 1], nullExecutioner: [0, 2], prismSovereign: [4, 2],
};

export function enemySpriteCell(id: string, frame: EnemySpriteFrame): EnemySpriteCell | null {
  if (ENEMY_A[id]) {
    const [col, row] = ENEMY_A[id];
    return { src: RPG_ASSETS.enemyA, columns: 4, rows: 3, col: col + (frame === "idle" ? 0 : 1), row };
  }
  if (ENEMY_B[id]) {
    const [col, row] = ENEMY_B[id];
    return { src: RPG_ASSETS.enemyB, columns: 8, rows: 3, col: col + (frame === "idle" ? 0 : 1), row };
  }
  if (BOSSES[id]) {
    const [col, row] = BOSSES[id];
    const offset = frame === "attack" ? 1 : frame === "hurt" || frame === "reaction" ? 2 : frame === "phase" ? 3 : 0;
    return { src: RPG_ASSETS.bosses, columns: 8, rows: 3, col: col + offset, row };
  }
  return null;
}
