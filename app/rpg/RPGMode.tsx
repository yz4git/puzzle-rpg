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
import { BOSS_TECHNIQUE_REWARDS, TECHNIQUE_EQUIPMENT_REWARDS } from "./data/rewards";
import RPGPuzzleBattle from "./RPGPuzzleBattle";
import RPGIcon from "./RPGIcon";
import { enemySpriteCell, heroAtlasCell, npcAtlasCell, RPG_ASSETS, RPG_ATLAS_METRICS, terrainAtlasCell, type AtlasCell } from "./assets";
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
const WORLD_RENDER_SCALE = 2;
type AtlasImageKey = "hero" | "npcs" | "field" | "town" | "dungeon" | "ui" | "enemyA" | "enemyB" | "bosses";
const DIR_DELTA: Record<Direction, Vec2> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function hasFlag(save: RPGSaveData, flag?: string) { return !flag || save.flags.includes(flag); }
function addUnique<T extends string>(values: T[], value: T): T[] { return values.includes(value) ? values : [...values, value]; }
function stableVisualIndex(id: string, x: number, y: number) {
  let value = x * 31 + y * 53;
  for (let index = 0; index < id.length; index += 1) value = Math.imul(value ^ id.charCodeAt(index), 16777619);
  return Math.abs(value);
}
function encounterReset(save: RPGSaveData) {
  let value = 11 + Math.floor(Math.random() * 8);
  if (save.equipment.charm === "roadBell") value = Math.ceil(value * 1.3);
  if (save.techniques.includes("quietStep")) value = Math.ceil(value * 1.25);
  return value;
}

function drawAtlasTile(context: CanvasRenderingContext2D, image: HTMLImageElement, cell: AtlasCell, x: number, y: number) {
  const { width, height } = RPG_ATLAS_METRICS.terrain;
  const rotation = cell.rotation ?? 0;
  // Generated atlas cells carry a small presentation rim. Crop two source pixels
  // so adjacent 16x16 gameplay tiles read as continuous SNES terrain instead of cards.
  const inset = 2;
  const sourceX = cell.col * width + inset;
  const sourceY = cell.row * height + inset;
  const sourceWidth = width - inset * 2;
  const sourceHeight = height - inset * 2;
  if (!rotation) {
    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, TILE, TILE);
    return;
  }
  context.save();
  context.translate(x + TILE / 2, y + TILE / 2);
  context.rotate(rotation * Math.PI / 2);
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, -TILE / 2, -TILE / 2, TILE, TILE);
  context.restore();
}

function drawGroundShadow(context: CanvasRenderingContext2D, x: number, y: number, width: number) {
  context.save();
  context.globalAlpha = .48;
  context.fillStyle = "#05040a";
  context.beginPath();
  context.ellipse(x + width / 2, y, width * .38, 2.2, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function sameRoute(map: MapDefinition, route: "road" | "danger", x: number, y: number) {
  const code = tileAt(map, x, y);
  return route === "road" ? code === "r" || code === "b" : code === "d" || code === "x";
}

function drawWorldRoute(context: CanvasRenderingContext2D, map: MapDefinition, code: string, worldX: number, worldY: number, x: number, y: number) {
  if (map.id !== "world" || (code !== "r" && code !== "d")) return;
  const route = code === "r" ? "road" : "danger";
  const up = sameRoute(map, route, worldX, worldY - 1);
  const right = sameRoute(map, route, worldX + 1, worldY);
  const down = sameRoute(map, route, worldX, worldY + 1);
  const left = sameRoute(map, route, worldX - 1, worldY);
  const edge = route === "road" ? "#6e5538" : "#371421";
  const base = route === "road" ? "#b99861" : "#772536";
  const light = route === "road" ? "#d0b271" : "#b83a45";
  const dark = route === "road" ? "#8f7049" : "#501a2a";
  // Build one connected 10px-wide metatile path. Arms meet adjacent cells at the
  // exact edge, removing the card-like square road tiles from the source atlas.
  context.fillStyle = edge;
  context.fillRect(x + 3, y + 3, 10, 10);
  if (up) context.fillRect(x + 3, y, 10, 8);
  if (down) context.fillRect(x + 3, y + 8, 10, 8);
  if (left) context.fillRect(x, y + 3, 8, 10);
  if (right) context.fillRect(x + 8, y + 3, 8, 10);
  context.fillStyle = base;
  context.fillRect(x + 4, y + 4, 8, 8);
  if (up) context.fillRect(x + 4, y, 8, 9);
  if (down) context.fillRect(x + 4, y + 7, 8, 9);
  if (left) context.fillRect(x, y + 4, 9, 8);
  if (right) context.fillRect(x + 7, y + 4, 9, 8);
  const seed = stableVisualIndex(route, worldX, worldY);
  context.fillStyle = light;
  context.fillRect(x + 5 + seed % 4, y + 5 + (seed >> 2) % 4, route === "road" ? 2 : 1, 1);
  context.fillStyle = dark;
  context.fillRect(x + 4 + (seed >> 4) % 6, y + 7 + (seed >> 6) % 3, 1, 1);
  if (route === "danger") {
    // Corruption leaks beyond the route edges in deterministic pixel tendrils.
    context.fillStyle = "#9a2e3d";
    if (seed % 3 === 0) { context.fillRect(x + 1, y + 5, 3, 1); context.fillRect(x + 1, y + 4, 1, 1); }
    if (seed % 4 === 0) { context.fillRect(x + 12, y + 10, 3, 1); context.fillRect(x + 14, y + 11, 1, 1); }
    context.fillStyle = "#e45b4d";
    if (seed % 5 === 0) context.fillRect(x + 7, y + 2, 1, 2);
  }
}



function drawGroundMacro(context: CanvasRenderingContext2D, map: MapDefinition, code: string, worldX: number, worldY: number, x: number, y: number) {
  if (map.id !== "world" || code !== "g") return;
  const macro = stableVisualIndex("ground-macro", Math.floor(worldX / 3), Math.floor(worldY / 3));
  context.save();
  context.globalAlpha = .055;
  context.fillStyle = macro % 3 === 0 ? "#d7d96d" : macro % 3 === 1 ? "#153d26" : "#72a548";
  context.fillRect(x, y, TILE, TILE);
  context.globalAlpha = 1;
  const seed = stableVisualIndex("ground-detail", worldX, worldY);
  if (seed % 11 === 0) {
    context.fillStyle = "#245f30";
    context.fillRect(x + 4 + seed % 7, y + 5 + (seed >> 3) % 6, 1, 2);
    context.fillStyle = "#75b655";
    context.fillRect(x + 5 + seed % 7, y + 5 + (seed >> 3) % 6, 1, 1);
  }
  context.restore();
}



function drawAtlasSpan(context: CanvasRenderingContext2D, image: HTMLImageElement, cell: AtlasCell, x: number, y: number, drawWidth: number, drawHeight: number) {
  const { width, height } = RPG_ATLAS_METRICS.terrain;
  const inset = 2;
  context.drawImage(image, cell.col * width + inset, cell.row * height + inset, width - inset * 2, height - inset * 2, x, y, drawWidth, drawHeight);
}

function drawWorldForestLayer(context: CanvasRenderingContext2D, image: HTMLImageElement, map: MapDefinition, cameraX: number, cameraY: number) {
  if (map.id !== "world") return;
  const covered = new Set<string>();
  const dense: AtlasCell[] = [
    { atlas: "field", col: 6, row: 0 }, { atlas: "field", col: 7, row: 0 },
    { atlas: "field", col: 0, row: 1 }, { atlas: "field", col: 1, row: 1 },
  ];
  const edge: AtlasCell[] = [
    { atlas: "field", col: 8, row: 0 }, { atlas: "field", col: 9, row: 0 },
    { atlas: "field", col: 2, row: 1 }, { atlas: "field", col: 3, row: 1 },
  ];
  for (let viewY = 0; viewY < VIEW_H; viewY += 1) {
    for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
      const worldX = cameraX + viewX, worldY = cameraY + viewY;
      const key = `${worldX}:${worldY}`;
      if (covered.has(key) || tileAt(map, worldX, worldY) !== "f") continue;
      const block = viewX < VIEW_W - 1 && viewY < VIEW_H - 1
        && tileAt(map, worldX + 1, worldY) === "f"
        && tileAt(map, worldX, worldY + 1) === "f"
        && tileAt(map, worldX + 1, worldY + 1) === "f";
      const seed = stableVisualIndex("forest-meta", worldX, worldY);
      if (block) {
        // Four gameplay tiles become one illustrated canopy cell. This removes
        // three quarters of the visible 16px source-cell seams in forest masses.
        drawAtlasSpan(context, image, dense[seed % dense.length]!, viewX * TILE - 1, viewY * TILE - 1, TILE * 2 + 2, TILE * 2 + 2);
        covered.add(`${worldX + 1}:${worldY}`);
        covered.add(`${worldX}:${worldY + 1}`);
        covered.add(`${worldX + 1}:${worldY + 1}`);
      } else {
        drawAtlasSpan(context, image, edge[seed % edge.length]!, viewX * TILE, viewY * TILE, TILE, TILE);
      }
      covered.add(key);
    }
  }
}

function drawWorldLandmark(context: CanvasRenderingContext2D, targetMap: string, x: number, y: number, locked: boolean) {
  context.save();
  context.globalAlpha = locked ? .44 : 1;
  drawGroundShadow(context, x - 2, y + TILE, 20);
  const outline = "#16121b";
  const stone = "#d0b879";
  const stoneDark = "#6f5a3d";
  const roof = "#a8453e";
  const blue = "#58a8bd";
  const violet = "#8c71bd";
  const crimson = "#b13a49";
  const gold = "#e7c55f";
  context.fillStyle = outline;
  context.fillRect(x + 2, y + 11, 12, 4);
  context.fillStyle = stoneDark;
  context.fillRect(x + 3, y + 12, 10, 2);

  if (["hearthVillage", "lakeVillage", "reedHamlet", "ironCity", "mirrorTown"].includes(targetMap)) {
    const city = targetMap === "ironCity";
    context.fillStyle = outline;
    context.fillRect(x + 3, y + 5, 10, 7);
    context.fillStyle = city ? "#77879b" : stone;
    context.fillRect(x + 4, y + 6, 8, 6);
    context.fillStyle = city ? "#a9c4d7" : roof;
    context.fillRect(x + 3, y + 4, 10, 3);
    context.fillRect(x + 5, y + 2, 6, 2);
    context.fillStyle = "#2b2530";
    context.fillRect(x + 7, y + 9, 2, 3);
    if (targetMap === "lakeVillage") { context.fillStyle = blue; context.fillRect(x + 4, y + 4, 8, 2); }
    if (targetMap === "mirrorTown") { context.fillStyle = violet; context.fillRect(x + 8, y + 3, 2, 2); }
  } else if (["emberShrine", "quietBower", "ironHall", "hourSpire"].includes(targetMap)) {
    context.fillStyle = outline;
    context.fillRect(x + 4, y + 6, 8, 7);
    context.fillStyle = stone;
    context.fillRect(x + 5, y + 7, 6, 5);
    context.fillStyle = targetMap === "emberShrine" ? "#ef7a3a" : targetMap === "hourSpire" ? violet : targetMap === "ironHall" ? "#9eb7c7" : "#6fad68";
    context.fillRect(x + 6, y + 3, 4, 5);
    context.fillRect(x + 7, y + 1, 2, 2);
    context.fillStyle = "#fff0a8";
    context.fillRect(x + 7, y + 4, 2, 2);
  } else if (targetMap === "oldTemple") {
    context.fillStyle = "#37323b";
    context.fillRect(x + 3, y + 4, 3, 8);
    context.fillRect(x + 10, y + 4, 3, 8);
    context.fillStyle = "#a79a7f";
    context.fillRect(x + 4, y + 5, 2, 6);
    context.fillRect(x + 10, y + 5, 2, 6);
    context.fillRect(x + 4, y + 3, 8, 2);
  } else if (targetMap === "crimsonMarsh") {
    context.fillStyle = "#4f1725";
    context.fillRect(x + 3, y + 7, 10, 5);
    context.fillStyle = crimson;
    context.fillRect(x + 4, y + 5, 2, 5);
    context.fillRect(x + 8, y + 3, 2, 7);
    context.fillRect(x + 11, y + 6, 2, 4);
    context.fillStyle = "#ed6a58";
    context.fillRect(x + 8, y + 3, 1, 2);
  } else if (["mirrorTower", "voidPass"].includes(targetMap)) {
    context.fillStyle = outline;
    context.fillRect(x + 5, y + 2, 6, 11);
    context.fillStyle = targetMap === "mirrorTower" ? violet : "#3f6674";
    context.fillRect(x + 6, y + 3, 4, 9);
    context.fillStyle = targetMap === "mirrorTower" ? "#d5bfff" : "#70d6e6";
    context.fillRect(x + 7, y + 4, 2, 3);
    if (targetMap === "voidPass") { context.fillStyle = "#0b0b11"; context.fillRect(x + 7, y + 8, 2, 4); }
  } else if (targetMap === "prismCitadel") {
    context.fillStyle = outline;
    context.fillRect(x + 2, y + 5, 12, 8);
    context.fillStyle = violet;
    context.fillRect(x + 3, y + 6, 10, 6);
    context.fillStyle = gold;
    context.fillRect(x + 3, y + 3, 3, 4);
    context.fillRect(x + 10, y + 3, 3, 4);
    context.fillRect(x + 7, y + 1, 2, 5);
    context.fillStyle = "#fff1a2";
    context.fillRect(x + 7, y + 4, 2, 2);
  } else {
    context.fillStyle = stone;
    context.fillRect(x + 5, y + 5, 6, 7);
    context.fillStyle = gold;
    context.fillRect(x + 7, y + 2, 2, 4);
  }

  if (locked) {
    context.fillStyle = "#17151c";
    context.fillRect(x + 10, y + 10, 5, 5);
    context.fillStyle = "#d9c56f";
    context.fillRect(x + 11, y + 12, 3, 2);
    context.fillRect(x + 12, y + 10, 1, 2);
  }
  context.restore();
}

function drawTerrainEdge(context: CanvasRenderingContext2D, map: MapDefinition, code: string, worldX: number, worldY: number, x: number, y: number) {
  const up = tileAt(map, worldX, worldY - 1), right = tileAt(map, worldX + 1, worldY), down = tileAt(map, worldX, worldY + 1), left = tileAt(map, worldX - 1, worldY);
  const road = code === "r" || code === "b";
  if (road) {
    context.fillStyle = "rgba(64,45,28,.58)";
    if (!(up === "r" || up === "b")) context.fillRect(x, y, TILE, 1);
    if (!(down === "r" || down === "b")) context.fillRect(x, y + TILE - 1, TILE, 1);
    if (!(left === "r" || left === "b")) context.fillRect(x, y, 1, TILE);
    if (!(right === "r" || right === "b")) context.fillRect(x + TILE - 1, y, 1, TILE);
  }
  if (code === "w") {
    context.fillStyle = "rgba(157,215,203,.70)";
    if (up !== "w") context.fillRect(x, y, TILE, 1);
    if (down !== "w") context.fillRect(x, y + TILE - 1, TILE, 1);
    if (left !== "w") context.fillRect(x, y, 1, TILE);
    if (right !== "w") context.fillRect(x + TILE - 1, y, 1, TILE);
  }
  if (code === "f") {
    context.fillStyle = "rgba(7,29,16,.52)";
    if (up !== "f") context.fillRect(x, y, TILE, 2);
    if (left !== "f") context.fillRect(x, y + 2, 2, TILE - 2);
    context.fillStyle = "rgba(91,139,66,.32)";
    if (down !== "f") context.fillRect(x + 2, y + TILE - 2, TILE - 2, 2);
  }
  if ((code === "d" || code === "x") && !["d","x"].includes(up)) { context.fillStyle = "rgba(239,110,95,.42)"; context.fillRect(x, y, TILE, 1); }
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
  const [atlasVersion, setAtlasVersion] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const atlasImages = useRef<Partial<Record<AtlasImageKey, HTMLImageElement>>>({});
  const afterDialogue = useRef<null | (() => void)>(null);
  const heldTimer = useRef<number | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);
  const saveRef = useRef(save);

  const map = MAPS[save.mapId] ?? MAPS.hearthVillage!;
  const mapNpcs = useMemo(() => npcsForMap(map.id).filter((npc) => hasFlag(save, npc.requireFlag) && (!npc.hideAfterFlag || !hasFlag(save, npc.hideAfterFlag))), [map.id, save]);
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
        const levelResult = applyLevel({ ...next, gold: next.gold + outcome.gold }, outcome.exp);
        next = levelResult.save;
        lines.push(`EXP +${outcome.exp} • GOLD +${outcome.gold}（討伐より少ない）`);
        if (levelResult.levels > 0) { lines.push(`LEVEL UP! • LV ${next.level} • MAX HP ${next.maxHp}`); playSfx("levelUp"); }
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
      const enemyDefinition = ENEMIES[outcome.enemyId];
      if (!released && enemyDefinition?.boss && enemyDefinition.victoryTalk) lines.unshift(enemyDefinition.victoryTalk);
      if (outcome.acquiredItem) { next = giveItem(next, outcome.acquiredItem); lines.push(`${ITEMS[outcome.acquiredItem].name}を手に入れた。`); }
      const scriptedTechnique = !context?.training && outcome.outcome === "victory" ? BOSS_TECHNIQUE_REWARDS[outcome.enemyId] : undefined;
      const techniqueRewards = [outcome.acquiredTechnique, scriptedTechnique].filter((id): id is TechniqueId => Boolean(id));
      for (const technique of techniqueRewards) {
        if (next.techniques.includes(technique)) continue;
        next = grantTechnique(next, technique);
        lines.push(`技「${TECHNIQUES[technique].name}」を覚えた。`);
        playSfx("techAcquire");
      }
      const equipmentReward = outcome.acquiredEquipment ?? (context?.training && outcome.acquiredTechnique ? TECHNIQUE_EQUIPMENT_REWARDS[outcome.acquiredTechnique] : undefined);
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
      if (next.flags.includes("void:clear") && next.flags.includes("key:mirror") && ["flameLore", "firstAid", "fortress", "timeTheft"].every((id) => next.techniques.includes(id as TechniqueId))) next = { ...next, flags: addUnique(next.flags, "gate:citadel") };
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
    const allowedRank = save.level >= 8 ? 3 : save.level >= 4 ? 2 : 1;
    if (!isEquipped && definition.rank > allowedRank) { setNotice(`LVが足りない • 装備RANK ${definition.rank}`); return; }
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
    let active = true;
    const sources = {
      hero: RPG_ASSETS.hero,
      npcs: RPG_ASSETS.npcs,
      field: RPG_ASSETS.field,
      town: RPG_ASSETS.town,
      dungeon: RPG_ASSETS.dungeon,
      ui: RPG_ASSETS.ui,
      enemyA: RPG_ASSETS.enemyA,
      enemyB: RPG_ASSETS.enemyB,
      bosses: RPG_ASSETS.bosses,
    } as const;
    for (const [key, src] of Object.entries(sources) as Array<[keyof typeof sources, string]>) {
      const image = new window.Image();
      image.onload = () => { if (active) setAtlasVersion((version) => version + 1); };
      image.src = src;
      atlasImages.current[key] = image;
    }
    return () => { active = false; };
  }, []);

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
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(WORLD_RENDER_SCALE, 0, 0, WORLD_RENDER_SCALE, 0, 0);
    context.imageSmoothingEnabled = false;
    context.fillStyle = "#050509"; context.fillRect(0, 0, VIEW_W * TILE, VIEW_H * TILE);
    const cameraX = clamp(save.position.x - Math.floor(VIEW_W / 2), 0, Math.max(0, map.width - VIEW_W));
    const cameraY = clamp(save.position.y - Math.floor(VIEW_H / 2), 0, Math.max(0, map.height - VIEW_H));

    // Base terrain is rendered first from dense 64 px source cells. The world
    // remains a precise 16 px gameplay grid while retaining the source texture.
    for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
      const worldX = cameraX + viewX, worldY = cameraY + viewY;
      const code = tileAt(map, worldX, worldY);
      // World roads and danger routes receive a grass foundation; a connected
      // metatile route is painted afterward. Bridges keep their dedicated atlas art.
      const baseCode = map.id === "world" && (code === "r" || code === "d" || code === "f") ? "g" : code;
      const cell = terrainAtlasCell(map, baseCode, worldX, worldY);
      const atlas = atlasImages.current[cell.atlas];
      if (atlas?.complete && atlas.naturalWidth) drawAtlasTile(context, atlas, cell, viewX * TILE, viewY * TILE);
      else drawTile(context, baseCode, viewX * TILE, viewY * TILE, worldX, worldY);
    }

    // Forest is composited as greedy 2x2 metatiles over a grass foundation.
    // Edge cells remain single-tree illustrations for a readable silhouette.
    const fieldAtlas = atlasImages.current.field;
    if (fieldAtlas?.complete && fieldAtlas.naturalWidth) drawWorldForestLayer(context, fieldAtlas, map, cameraX, cameraY);

    // A lightweight autotile edge pass stitches roads, shores, forest walls and danger ground together.
    for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
      const worldX = cameraX + viewX, worldY = cameraY + viewY;
      const code = tileAt(map, worldX, worldY);
      drawGroundMacro(context, map, code, worldX, worldY, viewX * TILE, viewY * TILE);
      drawTerrainEdge(context, map, code, worldX, worldY, viewX * TILE, viewY * TILE);
      drawWorldRoute(context, map, code, worldX, worldY, viewX * TILE, viewY * TILE);
    }

    // A connected two-row house block is reconstructed from complete facade
    // sprites instead of repeating random wall fragments on every tile.
    const townAtlas = atlasImages.current.town;
    if (townAtlas?.complete && townAtlas.naturalWidth && map.kind === "town") {
      for (let worldY = 0; worldY < map.height; worldY += 1) {
        for (let worldX = 0; worldX < map.width; worldX += 1) {
          if (tileAt(map, worldX, worldY) !== "h" || tileAt(map, worldX - 1, worldY) === "h" || tileAt(map, worldX, worldY - 1) === "h") continue;
          let width = 1;
          while (tileAt(map, worldX + width, worldY) === "h") width += 1;
          let height = 1;
          while (tileAt(map, worldX, worldY + height) === "h") height += 1;
          if (worldX + width < cameraX || worldX >= cameraX + VIEW_W || worldY + height < cameraY || worldY >= cameraY + VIEW_H) continue;
          const starts = width <= 2 ? [0] : Array.from(new Set(Array.from({ length: Math.ceil(width / 2) }, (_, index) => Math.min(index * 2, width - 2))));
          starts.forEach((offset, buildingIndex) => {
            const col = (stableVisualIndex(map.id, worldX, worldY) + buildingIndex) % 8;
            const drawX = (worldX + offset - cameraX) * TILE;
            const drawY = (worldY - cameraY) * TILE;
            const drawWidth = Math.min(2, width) * TILE;
            const drawHeight = Math.max(2, height) * TILE;
            context.drawImage(townAtlas, col * 64, 64, 64, 64, drawX, drawY, drawWidth, drawHeight);
            // Distinct signboards / window glints keep repeated facades from reading as one stamped asset.
            if (drawWidth >= TILE * 2) {
              const detail = stableVisualIndex(map.id, worldX + offset, worldY + buildingIndex);
              const signColors = ["#e2aa4f", "#6ec4c7", "#cf6c69", "#a68bd4"];
              context.fillStyle = "#2b1b17"; context.fillRect(drawX + drawWidth - 8, drawY + drawHeight - 15, 7, 6);
              context.fillStyle = signColors[detail % signColors.length]!; context.fillRect(drawX + drawWidth - 7, drawY + drawHeight - 14, 5, 4);
              context.fillStyle = "rgba(255,230,145,.78)"; context.fillRect(drawX + 4, drawY + drawHeight - 13, 3, 3);
            }
          });
        }
      }
    }

    map.portals.forEach((portal, portalIndex) => {
      const x = (portal.x - cameraX) * TILE, y = (portal.y - cameraY) * TILE;
      if (x < -TILE || y < -TILE || x >= VIEW_W * TILE || y >= VIEW_H * TILE) return;
      const locked = Boolean(portal.requireFlag && !hasFlag(save, portal.requireFlag));
      if (map.id === "world") {
        drawWorldLandmark(context, portal.targetMap, x, y, locked);
        return;
      }
      const atlas = atlasImages.current.field;
      if (atlas?.complete && atlas.naturalWidth) {
        context.globalAlpha = locked ? .42 : 1;
        context.drawImage(atlas, (portalIndex % 10) * 64, 9 * 64, 64, 64, x - 6, y - 12, 28, 28);
        context.globalAlpha = 1;
      } else {
        context.fillStyle = locked ? "#55515d" : "#ffe060";
        context.fillRect(x + 3, y + 4, 10, 9); context.fillStyle = "#11111a"; context.fillRect(x + 6, y + 8, 4, 5);
      }
    });
    for (const chest of map.chests) if (!save.openedChests.includes(chest.id)) {
      const x = (chest.x - cameraX) * TILE, y = (chest.y - cameraY) * TILE;
      const atlas = atlasImages.current.ui;
      if (atlas?.complete && atlas.naturalWidth) {
        drawGroundShadow(context, x - 1, y + TILE - 1, 18);
        context.drawImage(atlas, 3 * 96, 3 * 96, 96, 96, x - 1, y - 2, 18, 18);
      }
      else { context.fillStyle = "#2b160d"; context.fillRect(x + 3, y + 5, 10, 8); context.fillStyle = "#e0a53e"; context.fillRect(x + 4, y + 6, 8, 2); context.fillRect(x + 7, y + 9, 2, 3); }
    }
    const npcAtlas = atlasImages.current.npcs;
    const npcColors = ["#e0644d", "#5db8c8", "#d7b454", "#9d68c9"];
    mapNpcs.forEach((npc) => {
      const x = (npc.x - cameraX) * TILE, y = (npc.y - cameraY) * TILE;
      if (x < -TILE * 2 || y < -TILE * 2 || x >= VIEW_W * TILE + TILE || y >= VIEW_H * TILE + TILE) return;
      if (npcAtlas?.complete && npcAtlas.naturalWidth) {
        const cell = npcAtlasCell(npc.sprite);
        drawGroundShadow(context, x - 5, y + TILE, 26);
        context.drawImage(npcAtlas, cell.col * 96, cell.row * 128, 96, 128, x - 5, y - 18, 26, 34);
      } else drawPerson(context, x, y, npcColors[npc.palette % npcColors.length]!, "down", 0);
    });
    visibleFixed.forEach((entry) => {
      const x = (entry.x - cameraX) * TILE, y = (entry.y - cameraY) * TILE;
      const sprite = enemySpriteCell(entry.enemyId, "idle");
      const atlasKey: AtlasImageKey | null = !sprite ? null : sprite.src === RPG_ASSETS.enemyA ? "enemyA" : sprite.src === RPG_ASSETS.enemyB ? "enemyB" : "bosses";
      const atlas = atlasKey ? atlasImages.current[atlasKey] : null;
      if (sprite && atlas?.complete && atlas.naturalWidth) {
        const sourceWidth = atlas.naturalWidth / sprite.columns;
        const sourceHeight = atlas.naturalHeight / sprite.rows;
        const size = ENEMIES[entry.enemyId]?.boss ? 32 : 26;
        drawGroundShadow(context, x + (TILE - size) / 2, y + TILE, size);
        context.drawImage(atlas, sprite.col * sourceWidth, sprite.row * sourceHeight, sourceWidth, sourceHeight, x + (TILE - size) / 2, y + TILE - size, size, size);
      } else {
        context.fillStyle = "#08080d"; context.fillRect(x + 2, y + 2, 12, 12); context.fillStyle = "#ff4f64"; context.fillRect(x + 5, y + 4, 6, 7);
      }
    });
    const heroAtlas = atlasImages.current.hero;
    const heroX = (save.position.x - cameraX) * TILE, heroY = (save.position.y - cameraY) * TILE;
    if (heroAtlas?.complete && heroAtlas.naturalWidth) {
      const cell = heroAtlasCell(save.direction, walkFrame);
      drawGroundShadow(context, heroX - 6, heroY + TILE, 29);
      context.drawImage(heroAtlas, cell.col * 96, cell.row * 96, 96, 96, heroX - 6, heroY - 16, 28, 32);
    } else drawPerson(context, heroX, heroY, "#f0c85a", save.direction, walkFrame, true);

    context.setTransform(1, 0, 0, 1, 0, 0);
  }, [atlasVersion, map, mapNpcs, save, visibleFixed, walkFrame]);

  useEffect(() => () => { stopHold(); stopRpgMusic(); setSfxEnabled(true); }, []);

  const nearPortal = findAt(map.portals);
  const terrainLabel = isRoadTile(currentTile) ? "ROAD • SAFE" : isDangerTile(currentTile) ? "DANGER • HIGH ENCOUNTER" : map.kind === "town" ? "TOWN • SAFE" : map.kind === "training" ? "TRAINING • SAFE" : "FIELD • ENCOUNTER";

  if (battle) return <RPGPuzzleBattle enemy={ENEMIES[battle.enemyId]!} save={save} training={battle.training} onFinish={finishBattle} />;

  const endingLines = save.releasedEnemies && Object.values(save.releasedEnemies).reduce((sum, count) => sum + count, 0) >= 4 ? STORY_TEXT.endingMercy : STORY_TEXT.endingForce;

  return (
    <main className={styles.rpg} data-map={map.id} data-kind={map.kind}>
      <header className={styles.hud}>
        <div><span>RPG MODE</span><strong>{map.name}</strong></div>
        <div><span>LV {save.level}</span><strong>HP {save.hp}/{save.maxHp}</strong></div>
        <div><span><RPGIcon name="gold" size={10} /> GOLD</span><strong>{save.gold}</strong></div>
      </header>
      <section className={styles.locationBar}><span>{terrainLabel}</span><strong>{nearPortal ? `A • ${nearPortal.label}` : notice}</strong></section>
      <div className={styles.worldFrame}>
        <canvas ref={canvasRef} className={styles.world} width={VIEW_W * TILE * WORLD_RENDER_SCALE} height={VIEW_H * TILE * WORLD_RENDER_SCALE} aria-label={`${map.name} exploration map`} />
        <div className={styles.worldGloss} aria-hidden="true" />
      </div>
      <div className={styles.memoStrip}><span><RPGIcon name="memo" size={10} /> MEMO {save.memos.filter((memo) => !memo.read).length ? `NEW ${save.memos.filter((memo) => !memo.read).length}` : save.memos.length}</span><strong>JOURNEY • {save.steps} STEPS</strong></div>

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
