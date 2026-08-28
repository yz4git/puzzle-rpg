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
type AreaTransitionState = { phase: "depart" | "arrive"; targetName: string; targetKind: string; label: string } | null;
type DiscoveryState = { kind: "gold" | "item" | "equipment"; kicker: string; name: string; detail: string } | null;
type EncounterCueKind = "wild" | "danger" | "fixed" | "boss" | "trial";
type EncounterCueState = { enemyId: string; kind: EncounterCueKind; title: string; subtitle: string; context: Omit<BattleContext, "enemyId"> } | null;

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




function drawWorldDangerMass(context: CanvasRenderingContext2D, map: MapDefinition, code: string, worldX: number, worldY: number, x: number, y: number) {
  if (map.id !== "world" || code !== "d") return;
  const up = tileAt(map, worldX, worldY - 1) === "d";
  const right = tileAt(map, worldX + 1, worldY) === "d";
  const down = tileAt(map, worldX, worldY + 1) === "d";
  const left = tileAt(map, worldX - 1, worldY) === "d";
  // Only filled danger regions become corruption fields. One-tile danger roads
  // keep their connected route treatment from Pass 6.
  if (!(up || down) || !(left || right)) return;
  const seed = stableVisualIndex("danger-mass", worldX, worldY);
  context.fillStyle = seed % 3 === 0 ? "#6e2035" : seed % 3 === 1 ? "#79263a" : "#642031";
  context.fillRect(x, y, TILE, TILE);
  context.fillStyle = "#421627";
  if (!up) context.fillRect(x, y, TILE, 2);
  if (!down) context.fillRect(x, y + TILE - 2, TILE, 2);
  if (!left) context.fillRect(x, y, 2, TILE);
  if (!right) context.fillRect(x + TILE - 2, y, 2, TILE);
  context.fillStyle = "#a63643";
  context.fillRect(x + 2 + seed % 7, y + 4 + (seed >> 3) % 7, 5 + seed % 4, 1);
  if (seed % 3 === 0) context.fillRect(x + 4, y + 11, 2, 2);
  context.fillStyle = "#df5b53";
  if (seed % 5 === 0) context.fillRect(x + 10, y + 3, 2, 1);
  // Jagged tendrils break the original rectangular biome edge without touching collision.
  context.fillStyle = "#812a3d";
  if (!up && seed % 2 === 0) { context.fillRect(x + 4, y - 2, 5, 2); context.fillRect(x + 6, y - 3, 2, 1); }
  if (!down && seed % 3 === 0) { context.fillRect(x + 8, y + TILE, 4, 2); context.fillRect(x + 9, y + TILE + 2, 1, 1); }
  if (!left && seed % 2 === 1) context.fillRect(x - 2, y + 7, 2, 4);
  if (!right && seed % 4 === 0) context.fillRect(x + TILE, y + 5, 2, 5);

  // Grass bites back into the outer corruption edge in uneven chunks. This
  // visually breaks the rectangular 9x5 map-data block while collision stays unchanged.
  const grass = seed % 3 === 0 ? "#5d9d46" : seed % 3 === 1 ? "#68a64a" : "#518f40";
  context.fillStyle = grass;
  if (!up) {
    context.fillRect(x, y, 3 + seed % 5, 3);
    context.fillRect(x + 11 - (seed % 3), y, 5 + seed % 2, 2 + (seed % 2));
    if (seed % 2 === 0) context.fillRect(x + 1, y + 3, 3, 1);
  }
  if (!down) {
    context.fillRect(x, y + 13, 5 + seed % 4, 3);
    context.fillRect(x + 12 - (seed % 4), y + 14, 4 + seed % 4, 2);
    if (seed % 3 === 0) context.fillRect(x + 10, y + 12, 3, 2);
  }
  if (!left) {
    context.fillRect(x, y, 2 + seed % 2, 5 + seed % 5);
    context.fillRect(x, y + 11 - seed % 3, 3, 5 + seed % 3);
  }
  if (!right) {
    context.fillRect(x + 13, y + 1, 3, 4 + seed % 5);
    context.fillRect(x + 14, y + 11 - seed % 4, 2, 5 + seed % 4);
  }
  // Mossy islands and deep pools keep the interior from reading as a flat red floor.
  if (seed % 7 === 0) {
    context.fillStyle = "#485f38";
    context.fillRect(x + 5, y + 7, 4, 3);
    context.fillStyle = "#7da452";
    context.fillRect(x + 6, y + 7, 2, 1);
  } else if (seed % 5 === 0) {
    context.fillStyle = "#351426";
    context.fillRect(x + 4, y + 6, 6, 4);
    context.fillStyle = "#9c3343";
    context.fillRect(x + 5, y + 7, 4, 1);
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



function drawAtlasSpan(context: CanvasRenderingContext2D, image: HTMLImageElement, cell: AtlasCell, x: number, y: number, drawWidth: number, drawHeight: number, cropBottom = 0) {
  const { width, height } = RPG_ATLAS_METRICS.terrain;
  const inset = 2;
  const sourceHeight = height - inset * 2 - cropBottom;
  context.drawImage(image, cell.col * width + inset, cell.row * height + inset, width - inset * 2, sourceHeight, x, y, drawWidth, drawHeight);
}

function drawWorldForestLayer(context: CanvasRenderingContext2D, image: HTMLImageElement, map: MapDefinition, cameraX: number, cameraY: number) {
  if (map.id !== "world") return;
  const covered = new Set<string>();
  const dense: AtlasCell[] = [
    // Interior canopy cells deliberately avoid the trunk-heavy variants.
    { atlas: "field", col: 6, row: 0 },
    { atlas: "field", col: 0, row: 1 },
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
        // Crop the dark trunk/shadow band from the source tile so a 32px forest
        // block reads as continuous canopy instead of a row of enlarged tree bases.
        drawAtlasSpan(context, image, dense[seed % dense.length]!, viewX * TILE - 1, viewY * TILE - 1, TILE * 2 + 2, TILE * 2 + 2, 10);
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


function drawWorldWaterLayer(context: CanvasRenderingContext2D, map: MapDefinition, cameraX: number, cameraY: number) {
  if (map.id !== "world") return;
  const waterLike = (x: number, y: number) => {
    const code = tileAt(map, x, y);
    return code === "w" || code === "b";
  };
  for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
    const worldX = cameraX + viewX, worldY = cameraY + viewY;
    if (tileAt(map, worldX, worldY) !== "w") continue;
    const x = viewX * TILE, y = viewY * TILE;
    const seed = stableVisualIndex("world-water", worldX, worldY);
    const macro = stableVisualIndex("world-water-macro", Math.floor(worldX / 3), Math.floor(worldY / 2));
    context.fillStyle = macro % 3 === 0 ? "#1b5269" : macro % 3 === 1 ? "#205d73" : "#23596d";
    context.fillRect(x, y, TILE, TILE);

    // Sparse horizontal highlights read as one continuous SNES water surface,
    // rather than repeating one illustrated 16px card per gameplay tile.
    context.fillStyle = "#4b91a0";
    const waveY = y + 4 + (seed % 7);
    context.fillRect(x + 2 + (seed % 4), waveY, 7 + (seed % 4), 1);
    if (seed % 4 === 0) {
      context.fillStyle = "#78b7b5";
      context.fillRect(x + 8, y + 11, 5, 1);
    }
    context.fillStyle = "#123f57";
    if (seed % 5 === 0) context.fillRect(x + 1, y + 14, 6, 1);

    const up = waterLike(worldX, worldY - 1), right = waterLike(worldX + 1, worldY);
    const down = waterLike(worldX, worldY + 1), left = waterLike(worldX - 1, worldY);
    // Shorelines are two-tone and only exist where water actually meets land.
    // Bridge cells count as water so banks connect cleanly into bridge art.
    context.fillStyle = "#0e3144";
    if (!up) context.fillRect(x, y, TILE, 2);
    if (!down) context.fillRect(x, y + TILE - 2, TILE, 2);
    if (!left) context.fillRect(x, y, 2, TILE);
    if (!right) context.fillRect(x + TILE - 2, y, 2, TILE);
    context.fillStyle = "#79aa89";
    if (!up) context.fillRect(x + 2, y + 2, TILE - 4, 1);
    if (!down) context.fillRect(x + 2, y + TILE - 3, TILE - 4, 1);
    if (!left) context.fillRect(x + 2, y + 2, 1, TILE - 4);
    if (!right) context.fillRect(x + TILE - 3, y + 2, 1, TILE - 4);
  }
}


function drawWorldBridgeLayer(context: CanvasRenderingContext2D, map: MapDefinition, cameraX: number, cameraY: number) {
  if (map.id !== "world") return;
  for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
    const worldX = cameraX + viewX, worldY = cameraY + viewY;
    if (tileAt(map, worldX, worldY) !== "b") continue;
    const x = viewX * TILE, y = viewY * TILE;
    const horizontal = tileAt(map, worldX - 1, worldY) === "b" || tileAt(map, worldX + 1, worldY) === "b";
    const seed = stableVisualIndex("world-bridge", worldX, worldY);
    // Repaint the bridge cell as water first so gaps beside the deck remain lake/river.
    context.fillStyle = "#205d73";
    context.fillRect(x, y, TILE, TILE);
    context.fillStyle = "#4b91a0";
    context.fillRect(x + 2, y + 3 + (seed % 9), 6, 1);
    const rail = "#3b2a20", deck = "#8c693f", plank = "#b68c55", shine = "#d0a768";
    if (horizontal) {
      context.fillStyle = "#16202a"; context.fillRect(x, y + 4, TILE, 9);
      context.fillStyle = rail; context.fillRect(x, y + 3, TILE, 2); context.fillRect(x, y + 12, TILE, 2);
      context.fillStyle = deck; context.fillRect(x, y + 5, TILE, 7);
      context.fillStyle = plank;
      for (let px = x + 2; px < x + TILE; px += 5) context.fillRect(px, y + 5, 1, 7);
      context.fillStyle = shine; context.fillRect(x + 1, y + 6, TILE - 2, 1);
    } else {
      context.fillStyle = "#16202a"; context.fillRect(x + 4, y, 9, TILE);
      context.fillStyle = rail; context.fillRect(x + 3, y, 2, TILE); context.fillRect(x + 12, y, 2, TILE);
      context.fillStyle = deck; context.fillRect(x + 5, y, 7, TILE);
      context.fillStyle = plank;
      for (let py = y + 2; py < y + TILE; py += 5) context.fillRect(x + 5, py, 7, 1);
      context.fillStyle = shine; context.fillRect(x + 6, y + 1, 1, TILE - 2);
    }
  }
}

function drawWorldMountainLayer(context: CanvasRenderingContext2D, map: MapDefinition, cameraX: number, cameraY: number) {
  if (map.id !== "world") return;

  // Lower mountain row: sparse foothill and scree shapes only. Keeping the
  // grass foundation visible between forms prevents the range from reading as a wall.
  for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
    const worldX = cameraX + viewX, worldY = cameraY + viewY;
    if (tileAt(map, worldX, worldY) !== "m" || tileAt(map, worldX, worldY - 1) !== "m") continue;
    const x=viewX*TILE,y=viewY*TILE,seed=stableVisualIndex("ridge-foot",worldX,worldY);
    context.fillStyle="#27313b";
    context.beginPath();
    context.moveTo(x-3,y+15);context.lineTo(x+2,y+9+(seed%3));context.lineTo(x+7,y+5+(seed%4));context.lineTo(x+11,y+10);context.lineTo(x+17,y+7+((seed>>3)%4));context.lineTo(x+19,y+16);context.closePath();context.fill();
    context.fillStyle=seed%2?"#4b5660":"#56616a";
    context.beginPath();context.moveTo(x,y+14);context.lineTo(x+7,y+7+(seed%3));context.lineTo(x+10,y+14);context.closePath();context.fill();
    context.fillStyle="#707979";context.fillRect(x+5+(seed%5),y+10,2,2);
    context.fillStyle="#1b232d";context.fillRect(x+12,y+12,3+(seed%3),3);
  }

  // Top row: one large 2-tile-wide mountain per pair. Peaks extend through the
  // lower gameplay row and end in a broken polygonal toe rather than a baseline.
  for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
    const worldX=cameraX+viewX,worldY=cameraY+viewY;
    if(tileAt(map,worldX,worldY)!=="m"||tileAt(map,worldX,worldY-1)==="m")continue;
    let startX=worldX;while(tileAt(map,startX-1,worldY)==="m")startX-=1;
    const offset=worldX-startX;if(offset%2!==0)continue;
    const x=viewX*TILE,y=viewY*TILE,seed=stableVisualIndex("ridge-natural",worldX,worldY);
    const pair=tileAt(map,worldX+1,worldY)==="m";const width=pair?32+(seed%5):21;const left=x-3+((seed%5)-2);const peak=left+Math.floor(width*(.38+((seed>>3)%15)/100));const toeY=y+29+(seed%3);
    context.fillStyle="#1d2631";
    context.beginPath();context.moveTo(left-3,toeY-2);context.lineTo(left+3,y+19);context.lineTo(left+9,y+12);context.lineTo(peak,y+1+(seed%3));context.lineTo(left+width-8,y+12);context.lineTo(left+width-2,y+20);context.lineTo(left+width+3,toeY-4);context.lineTo(left+width-3,toeY);context.lineTo(left+width-11,toeY-3);context.lineTo(left+width-18,toeY+1);context.lineTo(left+width-25,toeY-2);context.lineTo(left+4,toeY+1);context.closePath();context.fill();
    context.fillStyle=seed%2?"#59646d":"#657078";
    context.beginPath();context.moveTo(left+1,toeY-4);context.lineTo(left+8,y+14);context.lineTo(peak,y+4+(seed%2));context.lineTo(peak+1,toeY-5);context.lineTo(left+width-18,toeY-2);context.lineTo(left+10,toeY);context.closePath();context.fill();
    context.fillStyle="#38434e";
    context.beginPath();context.moveTo(peak,y+4+(seed%2));context.lineTo(left+width-8,y+13);context.lineTo(left+width-1,toeY-5);context.lineTo(peak+1,toeY-5);context.closePath();context.fill();
    context.fillStyle="#a0a49e";context.fillRect(peak-1,y+5,2,5);if(width>25)context.fillRect(left+8+(seed%6),y+16,2,2);
    context.fillStyle="#202a34";context.fillRect(left+width-12,y+20,4,5);
  }
}


type WorldLandmarkKind = "village" | "city" | "school" | "temple" | "tower" | "marsh" | "pass" | "citadel";

function worldLandmarkKind(targetMap: string): WorldLandmarkKind {
  if (["hearthVillage", "lakeVillage", "reedHamlet", "mirrorTown"].includes(targetMap)) return "village";
  if (targetMap === "ironCity") return "city";
  if (["emberShrine", "quietBower", "ironHall", "hourSpire"].includes(targetMap)) return "school";
  if (targetMap === "oldTemple") return "temple";
  if (targetMap === "mirrorTower") return "tower";
  if (targetMap === "crimsonMarsh") return "marsh";
  if (targetMap === "voidPass") return "pass";
  return "citadel";
}

function drawPixelRoof(context: CanvasRenderingContext2D, left: number, top: number, width: number, roof: string, edge: string) {
  context.fillStyle = edge;
  context.fillRect(left + 4, top, width - 8, 2);
  context.fillRect(left + 2, top + 2, width - 4, 2);
  context.fillRect(left, top + 4, width, 3);
  context.fillStyle = roof;
  context.fillRect(left + 5, top + 1, width - 10, 1);
  context.fillRect(left + 3, top + 3, width - 6, 1);
  context.fillRect(left + 2, top + 5, width - 4, 1);
}

function drawMiniHouse(context: CanvasRenderingContext2D, left: number, top: number, width: number, roof: string, wall: string, trim: string) {
  drawPixelRoof(context, left, top, width, roof, "#1a1720");
  context.fillStyle = "#1a1720";
  context.fillRect(left + 2, top + 7, width - 4, 10);
  context.fillStyle = wall;
  context.fillRect(left + 3, top + 8, width - 6, 8);
  context.fillStyle = trim;
  context.fillRect(left + width - 6, top + 10, 2, 2);
  context.fillStyle = "#33251d";
  context.fillRect(left + Math.floor(width / 2) - 1, top + 12, 3, 4);
}

function drawWorldSeal(context: CanvasRenderingContext2D, x: number, y: number) {
  context.fillStyle = "#17131c";
  context.fillRect(x, y + 3, 8, 7);
  context.fillRect(x + 2, y, 4, 5);
  context.fillStyle = "#d8bd72";
  context.fillRect(x + 1, y + 4, 6, 5);
  context.fillStyle = "#5b456b";
  context.fillRect(x + 3, y + 5, 2, 3);
}

function drawWorldLandmarkGroundV2(context: CanvasRenderingContext2D, targetMap: string, x: number, y: number, locked: boolean) {
  const kind = worldLandmarkKind(targetMap);
  context.save();
  context.globalAlpha = locked ? .38 : 1;
  let left = x - 8, top = y + 7, width = 32, height = 17;
  let dark = "#554733", base = "#9b875c", light = "#c7b176";
  if (kind === "city") { left = x - 11; top = y + 5; width = 38; height = 20; dark = "#3c414b"; base = "#747d85"; light = "#adb1aa"; }
  else if (kind === "school") { left = x - 8; top = y + 6; width = 32; height = 18; dark = "#4b3e31"; base = "#8f7650"; light = "#c3a869"; }
  else if (kind === "temple") { left = x - 10; top = y + 5; width = 36; height = 20; dark = "#3d4138"; base = "#777a63"; light = "#aaa77d"; }
  else if (kind === "tower") { left = x - 8; top = y + 5; width = 32; height = 20; dark = "#303a4a"; base = "#68778a"; light = "#a6b9c5"; }
  else if (kind === "marsh") { left = x - 12; top = y + 4; width = 40; height = 22; dark = "#3c1421"; base = "#74263a"; light = "#b13c4a"; }
  else if (kind === "pass") { left = x - 10; top = y + 4; width = 36; height = 21; dark = "#252b35"; base = "#4c5664"; light = "#7b8791"; }
  else if (kind === "citadel") { left = x - 14; top = y + 2; width = 44; height = 24; dark = "#453858"; base = "#806e9e"; light = "#d4bf7e"; }

  // Irregular 2-3 tile apron: the portal now sits inside a place rather than on a single icon card.
  context.fillStyle = dark;
  context.fillRect(left + 3, top, width - 6, height);
  context.fillRect(left, top + 4, width, height - 8);
  context.fillStyle = base;
  context.fillRect(left + 4, top + 2, width - 8, height - 4);
  context.fillRect(left + 2, top + 6, width - 4, height - 12);
  context.fillStyle = light;
  const seed = stableVisualIndex(`landmark-ground-${targetMap}`, Math.round(x / TILE), Math.round(y / TILE));
  context.fillRect(left + 5 + seed % Math.max(2, width - 12), top + 5, 4, 1);
  context.fillRect(left + width - 12, top + height - 6, 5, 1);

  // A short approach visually connects the landmark footprint to the road without changing collision.
  context.fillStyle = dark;
  context.fillRect(x + 5, y + 18, 6, 9);
  context.fillStyle = base;
  context.fillRect(x + 6, y + 18, 4, 9);

  if (kind === "marsh") {
    context.fillStyle = "#4f1729";
    context.fillRect(left + 1, top + 4, 8, 5);
    context.fillRect(left + width - 11, top + 10, 9, 6);
    context.fillStyle = "#d34b50";
    context.fillRect(left + 5, top + 6, 3, 1);
    context.fillRect(left + width - 8, top + 13, 4, 1);
  }
  if (kind === "citadel") {
    context.fillStyle = "#e1d29a";
    context.fillRect(left + 7, top + height - 5, width - 14, 1);
    context.fillStyle = "#58486d";
    context.fillRect(left + 2, top + 3, 3, 3);
    context.fillRect(left + width - 5, top + 3, 3, 3);
  }
  context.restore();
}

function drawWorldLandmarkV2(context: CanvasRenderingContext2D, targetMap: string, x: number, y: number, locked: boolean) {
  const kind = worldLandmarkKind(targetMap);
  context.save();
  context.globalAlpha = locked ? .46 : 1;
  drawGroundShadow(context, x - 11, y + 21, 38);

  if (kind === "village") {
    let roof = "#a94d36", wall = "#d8bd78", trim = "#f0db95";
    if (targetMap === "lakeVillage") { roof = "#367a91"; wall = "#d7c887"; trim = "#85c3c7"; }
    else if (targetMap === "reedHamlet") { roof = "#6f833d"; wall = "#c9ad69"; trim = "#a9c05c"; }
    else if (targetMap === "mirrorTown") { roof = "#766a9d"; wall = "#d0c7b5"; trim = "#b8c9e3"; }
    drawMiniHouse(context, x - 8, y - 4, 17, roof, wall, trim);
    drawMiniHouse(context, x + 7, y, 15, roof, wall, trim);
    drawMiniHouse(context, x - 15, y + 3, 14, roof, wall, trim);
    context.fillStyle = trim;
    context.fillRect(x + 1, y + 1, 3, 3);
    if (targetMap === "lakeVillage") {
      context.fillStyle = "#314f5f";
      context.fillRect(x - 13, y + 20, 28, 2);
      context.fillStyle = "#a88755";
      for (let post = -10; post <= 12; post += 5) context.fillRect(x + post, y + 17, 2, 5);
    }
    if (targetMap === "mirrorTown") {
      context.fillStyle = "#d7f1f0";
      context.fillRect(x + 1, y - 7, 2, 5);
      context.fillRect(x, y - 5, 4, 2);
    }
  } else if (kind === "city") {
    const outline = "#171a20", stone = "#8d9599", light = "#c8c8b3", roof = "#5f493d";
    context.fillStyle = outline;
    context.fillRect(x - 14, y + 4, 36, 18);
    context.fillRect(x - 10, y - 4, 9, 16);
    context.fillRect(x + 10, y - 4, 9, 16);
    context.fillRect(x, y - 9, 10, 22);
    context.fillStyle = stone;
    context.fillRect(x - 12, y + 6, 32, 14);
    context.fillRect(x - 8, y - 2, 5, 14);
    context.fillRect(x + 12, y - 2, 5, 14);
    context.fillRect(x + 2, y - 7, 6, 18);
    context.fillStyle = roof;
    context.fillRect(x - 10, y - 5, 9, 3);
    context.fillRect(x + 10, y - 5, 9, 3);
    context.fillRect(x, y - 10, 10, 3);
    context.fillStyle = light;
    context.fillRect(x - 8, y + 2, 2, 3);
    context.fillRect(x + 14, y + 2, 2, 3);
    context.fillStyle = "#29252a";
    context.fillRect(x + 2, y + 12, 6, 8);
  } else if (kind === "school") {
    if (targetMap === "emberShrine") {
      context.fillStyle = "#2a1720";
      context.fillRect(x - 12, y + 4, 32, 4);
      context.fillRect(x - 8, y - 5, 4, 25);
      context.fillRect(x + 12, y - 5, 4, 25);
      context.fillStyle = "#b33b32";
      context.fillRect(x - 10, y + 5, 28, 2);
      context.fillRect(x - 7, y - 3, 2, 21);
      context.fillRect(x + 13, y - 3, 2, 21);
      context.fillStyle = "#f0b84e";
      context.fillRect(x + 2, y - 9, 4, 6);
      context.fillRect(x + 1, y - 6, 6, 4);
    } else if (targetMap === "quietBower") {
      context.fillStyle = "#183b29";
      context.fillRect(x - 9, y - 4, 26, 6);
      context.fillRect(x - 13, y + 1, 34, 7);
      context.fillStyle = "#4d7e45";
      context.fillRect(x - 7, y - 7, 22, 6);
      context.fillRect(x - 11, y - 2, 30, 7);
      context.fillStyle = "#705137";
      context.fillRect(x + 2, y + 4, 4, 17);
      context.fillStyle = "#b89a5f";
      context.fillRect(x - 7, y + 13, 18, 4);
    } else if (targetMap === "ironHall") {
      drawPixelRoof(context, x - 13, y - 5, 34, "#555e68", "#171a21");
      context.fillStyle = "#202630";
      context.fillRect(x - 10, y + 2, 28, 18);
      context.fillStyle = "#78838a";
      context.fillRect(x - 8, y + 4, 24, 14);
      context.fillStyle = "#d1bd76";
      context.fillRect(x + 1, y + 6, 6, 2);
      context.fillStyle = "#252129";
      context.fillRect(x + 1, y + 11, 6, 7);
    } else {
      context.fillStyle = "#242838";
      context.fillRect(x - 6, y - 7, 20, 28);
      context.fillRect(x - 2, y - 15, 12, 10);
      context.fillStyle = "#7c86a3";
      context.fillRect(x - 4, y - 5, 16, 24);
      context.fillRect(x, y - 13, 8, 10);
      context.fillStyle = "#e2c36e";
      context.fillRect(x + 2, y - 9, 4, 4);
      context.fillStyle = "#d9e7e6";
      context.fillRect(x + 3, y - 12, 2, 3);
    }
  } else if (kind === "temple") {
    context.fillStyle = "#252529";
    context.fillRect(x - 14, y + 3, 36, 4);
    context.fillRect(x - 10, y + 7, 28, 14);
    context.fillStyle = "#77786a";
    context.fillRect(x - 12, y + 4, 32, 2);
    context.fillRect(x - 8, y + 8, 24, 11);
    context.fillStyle = "#a6a276";
    context.fillRect(x - 5, y + 10, 3, 8);
    context.fillRect(x + 10, y + 9, 3, 9);
    context.fillStyle = "#4b6a45";
    context.fillRect(x - 13, y + 1, 7, 3);
    context.fillRect(x + 13, y + 5, 7, 3);
    context.fillStyle = "#343038";
    context.fillRect(x + 2, y + 12, 6, 7);
  } else if (kind === "tower") {
    context.fillStyle = "#171b27";
    context.fillRect(x - 8, y - 12, 24, 34);
    context.fillRect(x - 4, y - 18, 16, 8);
    context.fillStyle = "#78889a";
    context.fillRect(x - 6, y - 10, 20, 30);
    context.fillRect(x - 2, y - 16, 12, 8);
    context.fillStyle = "#b9d2d6";
    context.fillRect(x - 3, y - 7, 5, 5);
    context.fillRect(x + 7, y + 2, 4, 5);
    context.fillStyle = "#d9f1e8";
    context.fillRect(x + 2, y - 13, 4, 4);
    context.fillStyle = "#564a70";
    context.fillRect(x + 1, y + 12, 6, 8);
  } else if (kind === "marsh") {
    context.fillStyle = "#33141f";
    context.fillRect(x + 2, y - 7, 5, 29);
    context.fillRect(x - 8, y - 2, 12, 4);
    context.fillRect(x + 6, y + 2, 13, 4);
    context.fillStyle = "#6e2737";
    context.fillRect(x + 3, y - 5, 3, 27);
    context.fillRect(x - 7, y - 1, 10, 2);
    context.fillRect(x + 6, y + 3, 11, 2);
    context.fillStyle = "#d3484d";
    context.fillRect(x - 13, y + 18, 35, 3);
    context.fillRect(x - 7, y + 15, 8, 2);
    context.fillStyle = "#ef8261";
    context.fillRect(x - 3, y + 19, 6, 1);
  } else if (kind === "pass") {
    context.fillStyle = "#171c25";
    context.fillRect(x - 13, y - 5, 11, 27);
    context.fillRect(x + 10, y - 7, 11, 29);
    context.fillRect(x - 5, y - 2, 23, 7);
    context.fillStyle = "#4b5664";
    context.fillRect(x - 11, y - 3, 7, 23);
    context.fillRect(x + 12, y - 5, 7, 25);
    context.fillRect(x - 3, y, 19, 3);
    context.fillStyle = "#85909a";
    context.fillRect(x - 9, y + 1, 2, 7);
    context.fillRect(x + 14, y - 1, 2, 8);
    context.fillStyle = "#090b10";
    context.fillRect(x + 2, y + 3, 7, 17);
  } else {
    const outline = "#181522", stone = "#7c6b9b", light = "#c8bad0", gold = "#e1c978";
    context.fillStyle = outline;
    context.fillRect(x - 16, y + 3, 40, 20);
    context.fillRect(x - 13, y - 9, 10, 25);
    context.fillRect(x + 17, y - 9, 10, 25);
    context.fillRect(x - 1, y - 16, 12, 34);
    context.fillStyle = stone;
    context.fillRect(x - 14, y + 5, 36, 16);
    context.fillRect(x - 11, y - 7, 6, 21);
    context.fillRect(x + 19, y - 7, 6, 21);
    context.fillRect(x + 1, y - 14, 8, 30);
    context.fillStyle = light;
    context.fillRect(x - 9, y - 4, 2, 5);
    context.fillRect(x + 21, y - 4, 2, 5);
    context.fillRect(x + 3, y - 10, 4, 4);
    context.fillStyle = gold;
    context.fillRect(x + 2, y - 20, 6, 7);
    context.fillRect(x + 1, y - 17, 8, 2);
    context.fillStyle = "#27202f";
    context.fillRect(x + 3, y + 12, 5, 9);
  }

  context.restore();
  if (locked) drawWorldSeal(context, x + 12, y - 6);
}

function drawWorldLandmarkGround(context: CanvasRenderingContext2D, targetMap: string, x: number, y: number, locked: boolean) {
  context.save();
  context.globalAlpha = locked ? .38 : 1;
  const towns = ["hearthVillage", "lakeVillage", "reedHamlet", "ironCity", "mirrorTown"];
  const schools = ["emberShrine", "quietBower", "ironHall", "hourSpire"];
  let dark = "#574733", base = "#9f875c", light = "#c4aa70";
  if (targetMap === "crimsonMarsh") { dark = "#3e1521"; base = "#76263a"; light = "#aa3a49"; }
  else if (["mirrorTower", "voidPass"].includes(targetMap)) { dark = "#303544"; base = "#586477"; light = "#8793a5"; }
  else if (targetMap === "prismCitadel") { dark = "#51456d"; base = "#8f7db1"; light = "#d7c588"; }
  else if (targetMap === "oldTemple") { dark = "#393536"; base = "#746c5b"; light = "#a99a76"; }
  else if (schools.includes(targetMap)) { dark = "#4b4031"; base = "#897452"; light = "#b79a63"; }
  else if (towns.includes(targetMap)) { dark = "#574733"; base = "#9f875c"; light = "#c4aa70"; }

  // A small plaza / corrupted clearing / stone apron visually separates the
  // destination from the road tile underneath and gives every landmark a footprint.
  context.fillStyle = dark;
  context.fillRect(x - 3, y + 7, 22, 10);
  context.fillStyle = base;
  context.fillRect(x - 2, y + 7, 20, 8);
  context.fillStyle = light;
  context.fillRect(x + 1, y + 8, 5, 1);
  context.fillRect(x + 11, y + 12, 4, 1);
  context.fillStyle = dark;
  context.fillRect(x + 7, y + 14, 3, 3);
  if (targetMap === "crimsonMarsh") {
    context.fillStyle = "#cf514b";
    context.fillRect(x - 4, y + 10, 3, 1);
    context.fillRect(x + 17, y + 8, 3, 1);
  }
  context.restore();
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


type InteriorPalette = {
  floor: string; floorAlt: string; line: string; road: string; roadLight: string;
  wall: string; wallLight: string; accent: string; accent2: string; water: string; waterLight: string;
};

function interiorPalette(map: MapDefinition): InteriorPalette {
  const base: InteriorPalette = { floor: "#7f6948", floorAlt: "#927956", line: "#5a4934", road: "#b59b6a", roadLight: "#d4bd83", wall: "#44434a", wallLight: "#77757d", accent: "#c7904b", accent2: "#e4c676", water: "#205d73", waterLight: "#73b1b2" };
  if (map.id === "lakeVillage") return { ...base, floor: "#706b50", floorAlt: "#7f795a", line: "#48584f", road: "#aaa477", roadLight: "#d6cf9c", accent: "#5aa5ae", accent2: "#9bd1c9", water: "#1c6075", waterLight: "#81c5c1" };
  if (map.id === "reedHamlet") return { ...base, floor: "#667143", floorAlt: "#75834a", line: "#405332", road: "#9c8a55", roadLight: "#c5b673", accent: "#8ca34c", accent2: "#c8d274" };
  if (map.id === "ironCity") return { ...base, floor: "#575b5e", floorAlt: "#646a6c", line: "#353a40", road: "#80888a", roadLight: "#b1b6ae", wall: "#323942", wallLight: "#7a858b", accent: "#b88b51", accent2: "#d4bc74" };
  if (map.id === "mirrorTown") return { ...base, floor: "#645f72", floorAlt: "#746d84", line: "#454357", road: "#9790a3", roadLight: "#c7c0d1", wall: "#414557", wallLight: "#858ea2", accent: "#7fc0c8", accent2: "#c2e0df" };
  if (map.id === "emberShrine") return { ...base, floor: "#4d312a", floorAlt: "#5f3c2d", line: "#2c2020", road: "#8a5b38", roadLight: "#c4824a", wall: "#38232a", wallLight: "#8a3f3a", accent: "#d34b34", accent2: "#ffc55a" };
  if (map.id === "quietBower") return { ...base, floor: "#2e4d35", floorAlt: "#3d6040", line: "#183424", road: "#786443", roadLight: "#a28c58", wall: "#284333", wallLight: "#58734c", accent: "#78a74f", accent2: "#c3cf73" };
  if (map.id === "ironHall") return { ...base, floor: "#3e454d", floorAlt: "#4a525b", line: "#222931", road: "#666e73", roadLight: "#92999a", wall: "#252c35", wallLight: "#69757d", accent: "#c19554", accent2: "#d7c37c" };
  if (map.id === "hourSpire") return { ...base, floor: "#33364c", floorAlt: "#444763", line: "#22243b", road: "#666786", roadLight: "#9698b5", wall: "#252a42", wallLight: "#69718b", accent: "#b6a164", accent2: "#e0d18a" };
  if (map.id === "oldTemple") return { ...base, floor: "#3f413b", floorAlt: "#4b4d44", line: "#292d2a", road: "#65685a", roadLight: "#8e9072", wall: "#2d302e", wallLight: "#666a5e", accent: "#748953", accent2: "#b7aa69" };
  if (map.id === "crimsonMarsh") return { ...base, floor: "#422834", floorAlt: "#53303d", line: "#2d1722", road: "#6a3b43", roadLight: "#9f5860", wall: "#351c28", wallLight: "#6f3747", accent: "#b63d49", accent2: "#ed735c", water: "#531c35", waterLight: "#a73350" };
  if (map.id === "mirrorTower") return { ...base, floor: "#343d4d", floorAlt: "#424d60", line: "#222b39", road: "#647388", roadLight: "#9baaba", wall: "#242c3b", wallLight: "#66768c", accent: "#71b5c1", accent2: "#c9ece7" };
  if (map.id === "voidPass") return { ...base, floor: "#272a34", floorAlt: "#303540", line: "#171b24", road: "#4b515d", roadLight: "#777f8b", wall: "#1b202a", wallLight: "#505866", accent: "#5d718c", accent2: "#9db0c0", water: "#222a3d", waterLight: "#485d7d" };
  if (map.id === "prismCitadel") return { ...base, floor: "#504963", floorAlt: "#605674", line: "#342f45", road: "#827897", roadLight: "#b8acc1", wall: "#393448", wallLight: "#796f8c", accent: "#b29b64", accent2: "#e4d18f", water: "#4a4d76", waterLight: "#8e9ac2" };
  return base;
}

function drawConnectedInteriorRoad(context: CanvasRenderingContext2D, map: MapDefinition, worldX: number, worldY: number, x: number, y: number, palette: InteriorPalette) {
  const same = (xx: number, yy: number) => ["r", "b"].includes(tileAt(map, xx, yy));
  const up = same(worldX, worldY - 1), right = same(worldX + 1, worldY), down = same(worldX, worldY + 1), left = same(worldX - 1, worldY);
  context.fillStyle = palette.line;
  context.fillRect(x + 2, y + 2, 12, 12);
  if (up) context.fillRect(x + 2, y, 12, 8); if (down) context.fillRect(x + 2, y + 8, 12, 8);
  if (left) context.fillRect(x, y + 2, 8, 12); if (right) context.fillRect(x + 8, y + 2, 8, 12);
  context.fillStyle = palette.road;
  context.fillRect(x + 3, y + 3, 10, 10);
  if (up) context.fillRect(x + 3, y, 10, 9); if (down) context.fillRect(x + 3, y + 7, 10, 9);
  if (left) context.fillRect(x, y + 3, 9, 10); if (right) context.fillRect(x + 7, y + 3, 9, 10);
  const seed = stableVisualIndex(`interior-road-${map.id}`, worldX, worldY);
  context.fillStyle = palette.roadLight;
  context.fillRect(x + 4 + seed % 6, y + 5 + ((seed >> 2) % 5), 3, 1);
  context.fillStyle = palette.line;
  if (seed % 3 === 0) context.fillRect(x + 10, y + 11, 2, 1);
}

function drawInteriorWater(context: CanvasRenderingContext2D, map: MapDefinition, worldX: number, worldY: number, x: number, y: number, palette: InteriorPalette) {
  const waterLike = (xx: number, yy: number) => ["w", "b"].includes(tileAt(map, xx, yy));
  const seed = stableVisualIndex(`interior-water-${map.id}`, worldX, worldY);
  context.fillStyle = palette.water; context.fillRect(x, y, TILE, TILE);
  context.fillStyle = palette.waterLight; context.fillRect(x + 2 + seed % 5, y + 4 + ((seed >> 2) % 7), 7, 1);
  context.fillStyle = palette.line;
  if (!waterLike(worldX, worldY - 1)) context.fillRect(x, y, TILE, 2);
  if (!waterLike(worldX, worldY + 1)) context.fillRect(x, y + 14, TILE, 2);
  if (!waterLike(worldX - 1, worldY)) context.fillRect(x, y, 2, TILE);
  if (!waterLike(worldX + 1, worldY)) context.fillRect(x + 14, y, 2, TILE);
}

function drawInteriorWall(context: CanvasRenderingContext2D, map: MapDefinition, worldX: number, worldY: number, x: number, y: number, palette: InteriorPalette) {
  const seed = stableVisualIndex(`interior-wall-${map.id}`, worldX, worldY);
  context.fillStyle = palette.wall; context.fillRect(x, y, TILE, TILE);
  context.fillStyle = palette.wallLight;
  context.fillRect(x + 1, y + 2, 14, 2);
  context.fillRect(x + (seed % 7), y + 8, 6, 2);
  context.fillStyle = palette.line;
  context.fillRect(x, y + 14, TILE, 2);
  context.fillRect(x + 7, y + 4, 1, 4);
  if (tileAt(map, worldX, worldY + 1) !== "#" && tileAt(map, worldX, worldY + 1) !== "m") {
    context.fillStyle = palette.accent2; context.fillRect(x + 2, y + 13, 12, 1);
  }
}

function drawInteriorHazard(context: CanvasRenderingContext2D, map: MapDefinition, worldX: number, worldY: number, x: number, y: number, palette: InteriorPalette) {
  const seed = stableVisualIndex(`interior-hazard-${map.id}`, worldX, worldY);
  if (map.id === "voidPass") {
    const macro = stableVisualIndex("void-rock-macro", Math.floor(worldX / 2), Math.floor(worldY / 2));
    context.fillStyle = macro % 3 === 0 ? "#242935" : macro % 3 === 1 ? "#292f3a" : "#202631";
    context.fillRect(x, y, TILE, TILE);
    context.fillStyle = "#48515f";
    if (seed % 5 === 0) { context.fillRect(x + 3, y + 5, 5, 1); context.fillRect(x + 7, y + 6, 1, 4); }
    context.fillStyle = "#141923";
    if (seed % 7 === 0) context.fillRect(x + 10, y + 2, 1, 7);
    return;
  }
  context.fillStyle = palette.floor; context.fillRect(x, y, TILE, TILE);
  context.fillStyle = map.id === "crimsonMarsh" ? "#5f1738" : map.id === "prismCitadel" ? "#4e4270" : "#2a2538";
  context.fillRect(x + 2, y + 2, 12, 12);
  context.fillStyle = palette.accent; context.fillRect(x + 4 + seed % 5, y + 4, 4, 2);
  context.fillStyle = palette.accent2; if (seed % 2 === 0) context.fillRect(x + 9, y + 10, 2, 2);
}

function drawTrainingAltar(context: CanvasRenderingContext2D, map: MapDefinition, x: number, y: number, seed: number, palette: InteriorPalette) {
  context.fillStyle = palette.line; context.fillRect(x, y + 5, TILE, 9);
  context.fillStyle = palette.road; context.fillRect(x + 1, y + 6, 14, 7);
  context.fillStyle = palette.accent; context.fillRect(x + 6, y + 3, 4, 5);
  context.fillStyle = palette.accent2; context.fillRect(x + 7, y + 2, 2, 3);
  if (map.id === "emberShrine") { context.fillStyle = "#ef5b35"; context.fillRect(x + 2, y + 7, 2, 4); context.fillRect(x + 12, y + 7, 2, 4); }
  if (map.id === "quietBower") { context.fillStyle = "#82b85c"; context.fillRect(x + 2, y + 4, 3, 3); context.fillRect(x + 11, y + 4, 3, 3); }
  if (map.id === "hourSpire") { context.fillStyle = "#d8c875"; context.fillRect(x + 2, y + 8, 2, 1); context.fillRect(x + 12, y + 8, 2, 1); }
  if (seed % 2 === 0) { context.fillStyle = palette.roadLight; context.fillRect(x + 3, y + 11, 4, 1); }
}


function drawTrainingDaisLayer(context: CanvasRenderingContext2D, map: MapDefinition, cameraX: number, cameraY: number, palette: InteriorPalette) {
  if (map.kind !== "training") return;
  for (let worldY = 0; worldY < map.height; worldY += 1) {
    let worldX = 0;
    while (worldX < map.width) {
      if (tileAt(map, worldX, worldY) !== "a" || tileAt(map, worldX - 1, worldY) === "a") { worldX += 1; continue; }
      let width = 1; while (tileAt(map, worldX + width, worldY) === "a") width += 1;
      const drawX = (worldX - cameraX) * TILE;
      const drawY = (worldY - cameraY) * TILE;
      const drawWidth = width * TILE;
      if (drawX + drawWidth >= 0 && drawX < VIEW_W * TILE && drawY > -TILE && drawY < VIEW_H * TILE) {
        context.fillStyle = palette.line; context.fillRect(drawX - 2, drawY + 4, drawWidth + 4, 13);
        context.fillStyle = palette.road; context.fillRect(drawX, drawY + 6, drawWidth, 9);
        context.fillStyle = palette.roadLight; context.fillRect(drawX + 2, drawY + 7, drawWidth - 4, 1);
        // Three focal emblems replace the repeated per-tile altar stamps.
        const marks = [0.2, 0.5, 0.8];
        for (const ratio of marks) {
          const cx = drawX + Math.floor(drawWidth * ratio);
          context.fillStyle = palette.line; context.fillRect(cx - 4, drawY - 1, 8, 9);
          context.fillStyle = palette.accent; context.fillRect(cx - 3, drawY, 6, 7);
          context.fillStyle = palette.accent2; context.fillRect(cx - 1, drawY - 3, 2, 5);
        }
        if (map.id === "emberShrine") {
          context.fillStyle = "#f06438";
          for (const ratio of [0.08, 0.92]) { const fx = drawX + Math.floor(drawWidth * ratio); context.fillRect(fx - 2, drawY, 4, 6); context.fillStyle = "#ffc65c"; context.fillRect(fx - 1, drawY - 2, 2, 4); context.fillStyle = "#f06438"; }
        } else if (map.id === "quietBower") {
          context.fillStyle = "#7ead55"; context.fillRect(drawX + 4, drawY + 1, 8, 4); context.fillRect(drawX + drawWidth - 12, drawY + 1, 8, 4);
        } else if (map.id === "ironHall") {
          context.fillStyle = "#9da5a2"; context.fillRect(drawX + 5, drawY + 2, 8, 2); context.fillRect(drawX + drawWidth - 13, drawY + 2, 8, 2);
        } else if (map.id === "hourSpire") {
          context.fillStyle = "#ded08b"; context.fillRect(drawX + 6, drawY + 1, 1, 5); context.fillRect(drawX + drawWidth - 7, drawY + 1, 1, 5);
        }
      }
      worldX += width;
    }
  }
}

function drawInteriorStructuralDetails(context: CanvasRenderingContext2D, map: MapDefinition, cameraX: number, cameraY: number, palette: InteriorPalette) {
  if (map.id === "world") return;
  for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
    const worldX = cameraX + viewX, worldY = cameraY + viewY;
    const code = tileAt(map, worldX, worldY);
    const x = viewX * TILE, y = viewY * TILE;
    const seed = stableVisualIndex(`structure-${map.id}`, worldX, worldY);
    const wall = code === "#" || code === "m";
    const exposed = wall && !["#", "m"].includes(tileAt(map, worldX, worldY + 1));
    if (exposed && seed % 3 === 0) {
      context.fillStyle = palette.line; context.fillRect(x + 3, y + 5, 10, 14);
      context.fillStyle = palette.wallLight; context.fillRect(x + 5, y + 6, 6, 11);
      context.fillStyle = palette.accent; context.fillRect(x + 5, y + 7, 6, 2);
    }
    if (code === "s") {
      if ((worldX % 2 === 0) && (worldY % 2 === 0)) {
        context.globalAlpha = .32; context.fillStyle = palette.roadLight;
        context.fillRect(x + 2, y + 2, TILE * 2 - 4, 1);
        context.fillRect(x + 2, y + 2, 1, TILE * 2 - 4);
        context.globalAlpha = 1;
      }
      if (map.id === "oldTemple" && seed % 9 === 0) { context.fillStyle = "#607a50"; context.fillRect(x + 3, y + 11, 5, 2); }
      if (map.id === "mirrorTower" && seed % 8 === 0) { context.fillStyle = "#b7e1df"; context.fillRect(x + 5, y + 4, 5, 1); }
      if (map.id === "prismCitadel" && seed % 7 === 0) { context.fillStyle = "#d7c77f"; context.fillRect(x + 7, y + 3, 2, 2); }
    }
  }
}

function drawInteriorReconstruction(context: CanvasRenderingContext2D, map: MapDefinition, cameraX: number, cameraY: number) {
  if (map.id === "world") return;
  const palette = interiorPalette(map);
  for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
    const worldX = cameraX + viewX, worldY = cameraY + viewY;
    const code = tileAt(map, worldX, worldY);
    const x = viewX * TILE, y = viewY * TILE;
    const seed = stableVisualIndex(`interior-floor-${map.id}`, worldX, worldY);
    if (code === "h") continue;
    if (code === "#" || code === "m") { drawInteriorWall(context, map, worldX, worldY, x, y, palette); continue; }
    if (code === "w") { drawInteriorWater(context, map, worldX, worldY, x, y, palette); continue; }
    if (code === "b") {
      drawInteriorWater(context, map, worldX, worldY, x, y, palette);
      context.fillStyle = palette.line; context.fillRect(x, y + 4, TILE, 9);
      context.fillStyle = palette.road; context.fillRect(x, y + 5, TILE, 7);
      context.fillStyle = palette.roadLight; for (let px = x + 2; px < x + TILE; px += 5) context.fillRect(px, y + 5, 1, 7);
      continue;
    }
    if (code === "x" || code === "d") { drawInteriorHazard(context, map, worldX, worldY, x, y, palette); continue; }
    if (code === "a") {
      const macro = stableVisualIndex(`training-floor-${map.id}`, Math.floor(worldX / 2), Math.floor(worldY / 2));
      context.fillStyle = macro % 3 === 0 ? palette.floorAlt : palette.floor; context.fillRect(x, y, TILE, TILE);
      continue;
    }
    const macro = stableVisualIndex(`interior-macro-${map.id}`, Math.floor(worldX / 2), Math.floor(worldY / 2));
    context.fillStyle = macro % 4 === 0 ? palette.floorAlt : palette.floor; context.fillRect(x, y, TILE, TILE);
    context.fillStyle = palette.line;
    if (seed % 17 === 0) context.fillRect(x + 3 + seed % 7, y + 5 + ((seed >> 3) % 6), 2, 1);
    if (map.id === "mirrorTower" || map.id === "prismCitadel") {
      context.fillStyle = palette.roadLight; context.globalAlpha = .34; context.fillRect(x + 2, y + 2, 12, 1); context.fillRect(x + 2, y + 13, 12, 1); context.globalAlpha = 1;
    }
    if (code === "r") drawConnectedInteriorRoad(context, map, worldX, worldY, x, y, palette);
  }

  drawTrainingDaisLayer(context, map, cameraX, cameraY, palette);
  drawInteriorStructuralDetails(context, map, cameraX, cameraY, palette);

  // Region-specific set dressing is placed on blocked architecture or edges so collision stays honest.
  if (map.kind === "town") {
    for (let worldY = cameraY; worldY < Math.min(map.height, cameraY + VIEW_H); worldY += 1) for (let worldX = cameraX; worldX < Math.min(map.width, cameraX + VIEW_W); worldX += 1) {
      if (tileAt(map, worldX, worldY) !== "h") continue;
      const x = (worldX - cameraX) * TILE, y = (worldY - cameraY) * TILE;
      const seed = stableVisualIndex(`town-detail-${map.id}`, worldX, worldY);
      if (tileAt(map, worldX, worldY + 1) !== "h") {
        context.fillStyle = palette.line; context.fillRect(x + 1, y + 13, 14, 3);
        context.fillStyle = palette.accent; if (seed % 2 === 0) { context.fillRect(x + 2, y + 12, 3, 2); context.fillRect(x + 11, y + 12, 3, 2); }
      }
    }
  }
}

function drawInteriorPortal(context: CanvasRenderingContext2D, map: MapDefinition, targetMap: string, x: number, y: number, locked: boolean) {
  const palette = interiorPalette(map);
  context.save(); context.globalAlpha = locked ? .5 : 1;
  drawGroundShadow(context, x - 4, y + TILE, 24);
  const isExit = targetMap === "world";
  if (map.kind === "town") {
    context.fillStyle = palette.line; context.fillRect(x + 1, y - 4, 14, 20);
    context.fillStyle = palette.wallLight; context.fillRect(x + 3, y - 2, 10, 18);
    context.fillStyle = "#28222a"; context.fillRect(x + 5, y + 4, 6, 12);
    context.fillStyle = palette.accent2; context.fillRect(x + 3, y - 2, 10, 2);
  } else if (map.kind === "training") {
    context.fillStyle = palette.line; context.fillRect(x, y + 4, 16, 12);
    context.fillStyle = palette.road; context.fillRect(x + 2, y + 6, 12, 10);
    context.fillStyle = palette.accent; context.fillRect(x + 5, y + 2, 6, 6);
    context.fillStyle = palette.accent2; context.fillRect(x + 7, y, 2, 4);
  } else if (map.id === "voidPass") {
    context.fillStyle = "#151a22"; context.fillRect(x - 3, y - 6, 22, 22);
    context.fillStyle = "#535d68"; context.fillRect(x, y - 3, 6, 19); context.fillRect(x + 10, y - 3, 6, 19); context.fillRect(x + 3, y - 5, 10, 5);
    context.fillStyle = "#05070a"; context.fillRect(x + 5, y + 3, 6, 13);
  } else if (map.id === "prismCitadel") {
    context.fillStyle = palette.line; context.fillRect(x - 2, y - 7, 20, 23);
    context.fillStyle = palette.wallLight; context.fillRect(x + 1, y - 4, 14, 20);
    context.fillStyle = palette.accent2; context.fillRect(x + 5, y - 10, 6, 8); context.fillRect(x + 3, y - 7, 10, 3);
    context.fillStyle = "#29233b"; context.fillRect(x + 5, y + 3, 6, 13);
  } else {
    context.fillStyle = palette.line; context.fillRect(x + 1, y - 2, 14, 18);
    context.fillStyle = palette.wallLight; context.fillRect(x + 3, y, 10, 16);
    context.fillStyle = "#22232b"; context.fillRect(x + 5, y + 5, 6, 11);
    context.fillStyle = palette.accent; context.fillRect(x + 5, y + 1, 6, 3);
  }
  if (isExit) { context.fillStyle = palette.accent2; context.fillRect(x + 7, y + 9, 2, 2); }
  if (locked) { context.globalAlpha = 1; drawWorldSeal(context, x + 8, y + 3); }
  context.restore();
}

function drawInteriorForeground(context: CanvasRenderingContext2D, map: MapDefinition, cameraX: number, cameraY: number) {
  if (map.id === "world") return;
  const palette = interiorPalette(map);
  // Top edges of walls/roofs are redrawn as a foreground lip, giving characters a layered SNES-space feel near architecture.
  for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
    const worldX = cameraX + viewX, worldY = cameraY + viewY;
    const code = tileAt(map, worldX, worldY);
    if (!["#", "m", "h"].includes(code) || ["#", "m", "h"].includes(tileAt(map, worldX, worldY + 1))) continue;
    const x = viewX * TILE, y = viewY * TILE;
    context.globalAlpha = .76; context.fillStyle = palette.line; context.fillRect(x, y + TILE - 2, TILE, 2); context.globalAlpha = 1;
  }
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
  if (code === "w" && map.id !== "world") {
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


function drawNpcRoleProp(context: CanvasRenderingContext2D, npc: NPCDefinition, x: number, y: number) {
  context.save();
  const dark = "#17131a";
  if (npc.sprite === "merchant") {
    context.fillStyle = "#5b3827"; context.fillRect(x - 5, y + 9, 6, 7); context.fillRect(x + 15, y + 10, 5, 6);
    context.fillStyle = "#c58b4d"; context.fillRect(x - 4, y + 10, 4, 2); context.fillRect(x + 16, y + 11, 3, 2);
  } else if (npc.sprite === "soldier") {
    context.fillStyle = dark; context.fillRect(x - 5, y + 3, 3, 13);
    context.fillStyle = "#87929a"; context.fillRect(x - 4, y + 2, 1, 12); context.fillRect(x - 6, y + 4, 5, 2);
  } else if (npc.sprite === "priest") {
    context.fillStyle = "#493728"; context.fillRect(x + 14, y + 10, 5, 6);
    context.fillStyle = "#78a85b"; context.fillRect(x + 13, y + 7, 2, 4); context.fillRect(x + 16, y + 6, 2, 5);
  } else if (npc.sprite === "scholar") {
    context.fillStyle = dark; context.fillRect(x - 5, y + 10, 7, 5);
    context.fillStyle = "#b58c58"; context.fillRect(x - 4, y + 9, 5, 3);
    context.fillStyle = "#e1d09b"; context.fillRect(x - 3, y + 9, 2, 2);
  } else if (npc.sprite === "elder" || npc.sprite === "traveller") {
    context.fillStyle = dark; context.fillRect(x + 16, y + 3, 2, 13);
    context.fillStyle = "#9b7048"; context.fillRect(x + 16, y + 2, 1, 13);
  } else if (npc.sprite === "master") {
    context.globalAlpha = .58; context.fillStyle = "#c4a75d";
    context.fillRect(x - 5, y + 13, 26, 2); context.fillRect(x + 7, y + 8, 2, 12);
    context.fillStyle = "#6b4c34"; context.fillRect(x + 1, y + 11, 14, 6);
  } else if (npc.sprite === "mystery") {
    context.globalAlpha = .6; context.fillStyle = "#71548c";
    context.fillRect(x - 4, y + 13, 4, 2); context.fillRect(x + 16, y + 10, 4, 2); context.fillRect(x + 1, y + 15, 15, 1);
  } else if (npc.sprite === "child") {
    context.fillStyle = "#b04d55"; context.fillRect(x + 15, y + 12, 4, 4);
    context.fillStyle = "#e2ba64"; context.fillRect(x + 16, y + 13, 2, 2);
  }
  context.restore();
}

function drawNpcActivity(context: CanvasRenderingContext2D, npc: NPCDefinition, x: number, y: number, frame: number) {
  const phase = (frame + stableVisualIndex(npc.name, npc.x, npc.y)) % 8;
  context.save();
  if (npc.sprite === "merchant") {
    if (phase <= 1) { context.fillStyle = "#ffe07a"; context.fillRect(x + 18, y + 7, 2, 2); context.fillRect(x + 20, y + 5, 1, 1); }
  } else if (npc.sprite === "soldier") {
    if (phase === 0 || phase === 4) { context.fillStyle = "#d5e4eb"; context.fillRect(x - 6, y + 1 + (phase === 4 ? 1 : 0), 2, 2); }
  } else if (npc.sprite === "priest") {
    if (phase <= 2) { context.fillStyle = "#b9e58f"; context.fillRect(x + 17 + phase, y + 5 - phase, 1, 2); }
  } else if (npc.sprite === "scholar") {
    context.fillStyle = phase % 4 < 2 ? "#f0dfac" : "#c9ae7c"; context.fillRect(x - 2, y + 8, 2, 2);
  } else if (npc.sprite === "elder" || npc.sprite === "traveller") {
    if (phase === 0) { context.fillStyle = "#d0a76f"; context.fillRect(x + 15, y + 15, 3, 1); }
  } else if (npc.sprite === "master") {
    if (phase <= 1) { context.globalAlpha = .7; context.fillStyle = "#ffe28b"; context.fillRect(x + 6, y + 6, 1, 1); context.fillRect(x + 10, y + 4, 1, 1); }
  } else if (npc.sprite === "mystery") {
    if (phase % 3 === 0) { context.globalAlpha = .68; context.fillStyle = "#c79cff"; context.fillRect(x - 2, y + 9 - (phase % 2), 2, 1); context.fillRect(x + 18, y + 5 + (phase % 3), 1, 2); }
  } else if (npc.sprite === "child") {
    const ballX = x + 17 + (phase % 3);
    const ballY = y + 12 - (phase % 2) * 2;
    context.fillStyle = "#e7c25d"; context.fillRect(ballX, ballY, 3, 3); context.fillStyle = "#8b3f47"; context.fillRect(ballX + 1, ballY + 1, 1, 1);
  } else if (phase === 0) {
    context.globalAlpha = .55; context.fillStyle = "#f3d890"; context.fillRect(x + 14, y + 7, 1, 1);
  }
  context.restore();
}

function drawTownAmbient(context: CanvasRenderingContext2D, map: MapDefinition, cameraX: number, cameraY: number, frame: number) {
  if (map.kind !== "town") return;
  const phase = frame % 8;
  context.save();
  if (map.id === "hearthVillage") {
    for (let worldY = cameraY; worldY < Math.min(map.height, cameraY + VIEW_H); worldY += 1) for (let worldX = cameraX; worldX < Math.min(map.width, cameraX + VIEW_W); worldX += 1) {
      if (tileAt(map, worldX, worldY) !== "h" || tileAt(map, worldX, worldY - 1) === "h" || tileAt(map, worldX - 1, worldY) === "h") continue;
      const x = (worldX - cameraX) * TILE + 11;
      const y = (worldY - cameraY) * TILE - 2 - (phase % 4) * 2;
      context.globalAlpha = .28 + (3 - phase % 4) * .08; context.fillStyle = "#d5c9b4";
      context.fillRect(x, y, 3, 2); context.fillRect(x + 2, y - 2, 2, 2);
    }
  } else if (map.id === "lakeVillage") {
    context.globalAlpha = .72; context.fillStyle = "#bff5ef";
    for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
      const worldX = cameraX + viewX, worldY = cameraY + viewY;
      if (tileAt(map, worldX, worldY) !== "w") continue;
      const seed = stableVisualIndex("lake-life", worldX, worldY);
      if ((seed + phase) % 5 !== 0) continue;
      context.fillRect(viewX * TILE + 3 + seed % 6, viewY * TILE + 5 + phase % 4, 5, 1);
    }
  } else if (map.id === "ironCity") {
    context.globalAlpha = .8;
    for (let worldY = cameraY; worldY < Math.min(map.height, cameraY + VIEW_H); worldY += 1) for (let worldX = cameraX; worldX < Math.min(map.width, cameraX + VIEW_W); worldX += 1) {
      if (tileAt(map, worldX, worldY) !== "h" || tileAt(map, worldX, worldY + 1) === "h") continue;
      const seed = stableVisualIndex("forge-life", worldX, worldY);
      if ((seed + phase) % 4 !== 0) continue;
      const x = (worldX - cameraX) * TILE + 4 + seed % 8, y = (worldY - cameraY) * TILE + 12 - phase % 3;
      context.fillStyle = phase % 2 ? "#ffd36d" : "#ef6f45"; context.fillRect(x, y, 2, 2); context.fillRect(x + 3, y - 3, 1, 2);
    }
  } else if (map.id === "reedHamlet") {
    context.globalAlpha = .58; context.fillStyle = phase % 2 ? "#d6ba69" : "#93b267";
    for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
      const worldX = cameraX + viewX, worldY = cameraY + viewY;
      if (tileAt(map, worldX, worldY) !== "." && tileAt(map, worldX, worldY) !== "r") continue;
      const seed = stableVisualIndex("reed-life", worldX, worldY);
      if ((seed + phase) % 17 !== 0) continue;
      context.fillRect(viewX * TILE + 2 + (seed + phase) % 11, viewY * TILE + 3 + (phase % 5), 2, 1);
    }
  } else if (map.id === "mirrorTown") {
    context.globalAlpha = .72;
    for (let worldY = cameraY; worldY < Math.min(map.height, cameraY + VIEW_H); worldY += 1) for (let worldX = cameraX; worldX < Math.min(map.width, cameraX + VIEW_W); worldX += 1) {
      if (tileAt(map, worldX, worldY) !== "h" || tileAt(map, worldX, worldY + 1) === "h") continue;
      const seed = stableVisualIndex("mirror-life", worldX, worldY);
      if ((seed + phase) % 5 !== 0) continue;
      const x = (worldX - cameraX) * TILE + 4 + seed % 7, y = (worldY - cameraY) * TILE + 10;
      context.fillStyle = phase % 2 ? "#d7b9ff" : "#a9edf0"; context.fillRect(x, y, 4, 1); context.fillRect(x + 1, y - 2, 1, 5);
    }
  }
  context.restore();
}

function drawDungeonAmbient(context: CanvasRenderingContext2D, map: MapDefinition, cameraX: number, cameraY: number, frame: number, player: Vec2) {
  if (map.kind !== "dungeon" && map.kind !== "danger") return;
  const phase = frame % 8;
  context.save();

  if (map.id === "oldTemple") {
    // Slow dust and old torch embers keep the first dungeon ancient rather than busy.
    for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
      const worldX = cameraX + viewX, worldY = cameraY + viewY;
      if (tileAt(map, worldX, worldY) === "#") continue;
      const seed = stableVisualIndex("temple-dust", worldX, worldY);
      if ((seed + phase) % 19 !== 0) continue;
      context.globalAlpha = .28; context.fillStyle = phase % 2 ? "#d8c996" : "#8fa076";
      context.fillRect(viewX * TILE + 2 + (seed + phase) % 10, viewY * TILE + 3 + (phase % 6), 1, 1);
    }
    context.globalAlpha = .5;
    for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
      const worldX = cameraX + viewX, worldY = cameraY + viewY;
      if (tileAt(map, worldX, worldY) !== "#" || tileAt(map, worldX, worldY + 1) === "#") continue;
      const seed = stableVisualIndex("temple-ember", worldX, worldY);
      if ((seed + phase) % 7 !== 0) continue;
      const x = viewX * TILE + 6 + seed % 5, y = viewY * TILE + 11 - phase % 3;
      context.fillStyle = phase % 2 ? "#f4c85d" : "#c86a3e"; context.fillRect(x, y, 2, 2);
    }
  } else if (map.id === "crimsonMarsh") {
    // Hazard cells breathe with bubbles while sparse fog crosses the walkable floor.
    for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
      const worldX = cameraX + viewX, worldY = cameraY + viewY;
      const code = tileAt(map, worldX, worldY);
      const seed = stableVisualIndex("marsh-bubble", worldX, worldY);
      if (code === "x" && (seed + phase) % 4 === 0) {
        const x = viewX * TILE + 3 + seed % 9, y = viewY * TILE + 10 - phase % 5;
        context.globalAlpha = .68; context.fillStyle = phase % 2 ? "#ef755f" : "#a52d4f";
        context.fillRect(x, y, 3, 1); context.fillRect(x + 1, y - 1, 1, 3);
      } else if (code !== "#" && (seed + phase) % 31 === 0) {
        context.globalAlpha = .18; context.fillStyle = "#d5a1b4";
        context.fillRect(viewX * TILE - 3 + phase * 3, viewY * TILE + 5 + seed % 6, 14, 2);
      }
    }
  } else if (map.id === "mirrorTower") {
    // Thin moving mirror streaks imply reflections without changing collision readability.
    for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
      const worldX = cameraX + viewX, worldY = cameraY + viewY;
      const code = tileAt(map, worldX, worldY);
      const seed = stableVisualIndex("mirror-shine", worldX, worldY);
      if (code === "#" || (seed + phase) % 11 !== 0) continue;
      const x = viewX * TILE + 2 + (phase * 2 + seed) % 9, y = viewY * TILE + 3 + seed % 8;
      context.globalAlpha = .62; context.fillStyle = phase % 2 ? "#d8f7f2" : "#c9b8ff";
      context.fillRect(x, y, 5, 1); context.fillRect(x + 2, y - 2, 1, 5);
    }
  } else if (map.id === "voidPass") {
    // Wind cuts across the pass in stepped bands; dark flecks move the opposite way.
    context.globalAlpha = .24; context.fillStyle = "#9baab6";
    for (let lane = 0; lane < 5; lane += 1) {
      const y = 18 + lane * 34 + ((lane + phase) % 3) * 3;
      const x = -24 + ((phase * 29 + lane * 41) % (VIEW_W * TILE + 48));
      context.fillRect(x, y, 22 + (lane % 2) * 10, 1);
      context.fillRect(x + 8, y + 2, 9, 1);
    }
    context.globalAlpha = .34; context.fillStyle = "#10131b";
    for (let lane = 0; lane < 4; lane += 1) {
      const x = VIEW_W * TILE - ((phase * 19 + lane * 53) % (VIEW_W * TILE + 28));
      context.fillRect(x, 29 + lane * 42, 7, 2);
    }
  } else if (map.id === "prismCitadel") {
    // The final dungeon pulses harder toward the throne, making progression feel oppressive.
    const approach = clamp(1 - player.y / Math.max(1, map.height - 1), 0, 1);
    const pulseAlpha = .15 + approach * .24 + (phase % 2 ? .05 : 0);
    context.globalAlpha = pulseAlpha;
    for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
      const worldX = cameraX + viewX, worldY = cameraY + viewY;
      const code = tileAt(map, worldX, worldY);
      const seed = stableVisualIndex("citadel-vein", worldX, worldY);
      if (code === "#") {
        if ((seed + phase) % 6 !== 0) continue;
        context.fillStyle = phase % 2 ? "#d7c46f" : "#9f7dd4";
        context.fillRect(viewX * TILE + 3 + seed % 7, viewY * TILE + 10, 5, 1);
      } else if ((seed + phase) % 17 === 0) {
        context.fillStyle = phase % 2 ? "#d9b7ff" : "#f2dc86";
        const x = viewX * TILE + 4 + seed % 6, y = viewY * TILE + 4 + phase % 5;
        context.fillRect(x, y, 2, 2); context.fillRect(x - 2, y + 1, 6, 1);
      }
    }
    context.globalAlpha = .08 + approach * .12;
    context.fillStyle = phase % 2 ? "#6f4c92" : "#b0934b";
    const sweepY = (phase * 31 + Math.floor(approach * 17)) % (VIEW_H * TILE);
    context.fillRect(0, sweepY, VIEW_W * TILE, 2);
  }

  context.restore();
}


function drawBossSetpieces(
  context: CanvasRenderingContext2D,
  map: MapDefinition,
  cameraX: number,
  cameraY: number,
  entries: MapDefinition["fixedEncounters"],
  frame: number,
) {
  if (map.id === "world" || map.kind === "training") return;
  const phase = frame % 8;
  for (const entry of entries) {
    const enemy = ENEMIES[entry.enemyId];
    const important = Boolean(enemy?.boss) || Boolean(entry.afterFlag) || map.id === "mirrorTower";
    if (!important) continue;
    const centerX = (entry.x - cameraX) * TILE + Math.floor(TILE / 2);
    const baseY = (entry.y - cameraY) * TILE + TILE;
    if (centerX < -TILE * 4 || centerX > VIEW_W * TILE + TILE * 4 || baseY < -TILE * 3 || baseY > VIEW_H * TILE + TILE * 3) continue;

    context.save();
    if (entry.enemyId === "prismSovereign") {
      // Final throne: a five-tile ceremonial dais with a vertical prism crown.
      context.fillStyle = "#100d18"; context.fillRect(centerX - 42, baseY - 13, 84, 26);
      context.fillStyle = "#3e3157"; context.fillRect(centerX - 38, baseY - 11, 76, 21);
      context.fillStyle = "#725d93"; context.fillRect(centerX - 33, baseY - 9, 66, 16);
      context.fillStyle = "#d0b966"; context.fillRect(centerX - 29, baseY - 7, 58, 2); context.fillRect(centerX - 29, baseY + 4, 58, 2);
      context.fillStyle = "#17121f"; context.fillRect(centerX - 11, baseY - 31, 22, 25);
      context.fillStyle = "#65517f"; context.fillRect(centerX - 8, baseY - 28, 16, 20);
      context.fillStyle = phase % 2 ? "#f0d878" : "#c9a7ff";
      context.fillRect(centerX - 2, baseY - 37, 4, 12); context.fillRect(centerX - 5, baseY - 32, 10, 3);
      context.globalAlpha = .38 + (phase % 2) * .16;
      context.fillStyle = "#b989e5"; context.fillRect(centerX - 34, baseY - 17, 3, 9); context.fillRect(centerX + 31, baseY - 17, 3, 9);
      context.fillStyle = "#f0d46f"; context.fillRect(centerX - 33, baseY - 20 - phase % 2, 1, 4); context.fillRect(centerX + 32, baseY - 20 - ((phase + 1) % 2), 1, 4);
    } else if (map.id === "crimsonMarsh") {
      // Scarlet Oracle ritual pool.
      context.globalAlpha = .86;
      context.fillStyle = "#25121d"; context.fillRect(centerX - 27, baseY - 10, 54, 18);
      context.fillStyle = "#601d35"; context.fillRect(centerX - 23, baseY - 7, 46, 12);
      context.fillStyle = phase % 2 ? "#bb3950" : "#8d2943"; context.fillRect(centerX - 18, baseY - 4, 36, 6);
      context.fillStyle = "#ef7960";
      for (const dx of [-19, 19]) { context.fillRect(centerX + dx - 1, baseY - 18, 3, 9); context.fillRect(centerX + dx, baseY - 21 - phase % 2, 1, 4); }
    } else if (map.id === "voidPass") {
      // Void gate: paired monoliths visually narrow the approach without changing collision.
      context.fillStyle = "#0d1118"; context.fillRect(centerX - 31, baseY - 30, 10, 38); context.fillRect(centerX + 21, baseY - 30, 10, 38);
      context.fillStyle = "#46525f"; context.fillRect(centerX - 28, baseY - 27, 5, 31); context.fillRect(centerX + 23, baseY - 27, 5, 31);
      context.globalAlpha = .42 + (phase % 2) * .12; context.fillStyle = "#72d6df";
      context.fillRect(centerX - 27, baseY - 22 + phase % 3, 3, 8); context.fillRect(centerX + 24, baseY - 20 - phase % 3, 3, 8);
      context.fillStyle = "#151a22"; context.fillRect(centerX - 21, baseY - 5, 42, 8);
    } else if (map.id === "mirrorTower") {
      // Mirror sanctum: broken reflective panels around the key encounter.
      context.fillStyle = "#1d2531"; context.fillRect(centerX - 28, baseY - 10, 56, 17);
      context.fillStyle = "#596b7f"; context.fillRect(centerX - 24, baseY - 8, 48, 12);
      context.fillStyle = "#a8d9dc"; context.fillRect(centerX - 18, baseY - 6, 12, 2); context.fillRect(centerX + 7, baseY - 2, 11, 2);
      context.fillStyle = phase % 2 ? "#d4bbff" : "#c4f1eb";
      context.fillRect(centerX - 24, baseY - 22, 7, 14); context.fillRect(centerX + 17, baseY - 24, 7, 16);
      context.fillRect(centerX - 22 + phase % 3, baseY - 18, 3, 1); context.fillRect(centerX + 19, baseY - 19 + phase % 3, 3, 1);
    } else if (map.id === "oldTemple") {
      // Collapsed altar and candle stubs for the ancient guardian.
      context.fillStyle = "#242923"; context.fillRect(centerX - 29, baseY - 9, 58, 17);
      context.fillStyle = "#5c6254"; context.fillRect(centerX - 25, baseY - 7, 50, 12);
      context.fillStyle = "#85856b"; context.fillRect(centerX - 13, baseY - 15, 26, 9);
      context.fillStyle = "#b7aa69"; context.fillRect(centerX - 11, baseY - 13, 22, 2);
      context.fillStyle = phase % 2 ? "#ffc967" : "#d98b42";
      context.fillRect(centerX - 22, baseY - 16, 2, 6); context.fillRect(centerX + 20, baseY - 16, 2, 6);
    } else if (map.id === "ironCity") {
      // Iron throne platform for the ruler encounter.
      context.fillStyle = "#22282e"; context.fillRect(centerX - 27, baseY - 9, 54, 17);
      context.fillStyle = "#69737a"; context.fillRect(centerX - 23, baseY - 7, 46, 12);
      context.fillStyle = "#b69554"; context.fillRect(centerX - 19, baseY - 5, 38, 2);
      context.fillStyle = "#343b43"; context.fillRect(centerX - 8, baseY - 25, 16, 18);
      context.fillStyle = phase % 2 ? "#e2c879" : "#aeb8b7"; context.fillRect(centerX - 4, baseY - 22, 8, 3);
    } else {
      context.fillStyle = "#17151b"; context.fillRect(centerX - 24, baseY - 8, 48, 15);
      context.fillStyle = "#6b606d"; context.fillRect(centerX - 20, baseY - 6, 40, 10);
      context.fillStyle = "#c5aa68"; context.fillRect(centerX - 14, baseY - 4, 28, 2);
    }
    context.restore();
  }
}

type InteractionMarkerKind = "talk" | "treasure" | "danger" | "boss" | "exit";

function drawInteractionMarker(context: CanvasRenderingContext2D, x: number, y: number, kind: InteractionMarkerKind) {
  const accent = kind === "boss" ? "#ffe784" : kind === "danger" ? "#ff6a66" : kind === "treasure" ? "#ffd765" : kind === "exit" ? "#7ee8ef" : "#f1d06a";
  context.save();
  context.fillStyle = "#0a0910"; context.fillRect(x + 7, y - 22, 8, 9);
  context.fillStyle = accent; context.fillRect(x + 8, y - 21, 6, 7);
  context.fillStyle = "#201b22";
  if (kind === "talk") {
    context.fillRect(x + 10, y - 19, 2, 1); context.fillRect(x + 9, y - 18, 1, 4); context.fillRect(x + 12, y - 18, 1, 4); context.fillRect(x + 10, y - 17, 2, 1);
  } else if (kind === "treasure") {
    context.fillRect(x + 10, y - 19, 2, 4); context.fillRect(x + 9, y - 18, 4, 2);
  } else if (kind === "danger" || kind === "boss") {
    context.fillRect(x + 10, y - 20, 2, 4); context.fillRect(x + 10, y - 15, 2, 1);
    if (kind === "boss") { context.fillRect(x + 8, y - 22, 1, 2); context.fillRect(x + 13, y - 22, 1, 2); }
  } else {
    context.fillRect(x + 10, y - 20, 2, 4); context.fillRect(x + 9, y - 17, 4, 1); context.fillRect(x + 10, y - 16, 2, 1);
  }
  context.fillStyle = accent; context.fillRect(x + 10, y - 13, 2, 2);
  context.restore();
}

function resultLineKind(line: string) {
  if (line.includes("LEVEL UP")) return "level";
  if (line.startsWith("EXP +")) return "reward";
  if (/手に入れた|覚えた|習得|取得/.test(line)) return "acquire";
  if (/失った|YOU AWAKEN/.test(line)) return "loss";
  return "story";
}
function resultAcquireKind(line: string) {
  if (line.startsWith("技「")) return "technique";
  if (Object.values(EQUIPMENT).some((equipment) => line.startsWith(equipment.name))) return "equipment";
  return "item";
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
  const [fieldReturn, setFieldReturn] = useState(false);
  const [areaTransition, setAreaTransition] = useState<AreaTransitionState>(null);
  const [discovery, setDiscovery] = useState<DiscoveryState>(null);
  const [encounterCue, setEncounterCue] = useState<EncounterCueState>(null);
  const [dangerWarning, setDangerWarning] = useState<string | null>(null);
  const [fieldEnemyFrame, setFieldEnemyFrame] = useState(0);
  const [townLifeFrame, setTownLifeFrame] = useState(0);
  const [dungeonLifeFrame, setDungeonLifeFrame] = useState(0);
  const [walkFrame, setWalkFrame] = useState(0);
  const [endingIndex, setEndingIndex] = useState(0);
  const [atlasVersion, setAtlasVersion] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const atlasImages = useRef<Partial<Record<AtlasImageKey, HTMLImageElement>>>({});
  const afterDialogue = useRef<null | (() => void)>(null);
  const heldTimer = useRef<number | null>(null);
  const transitionTimer = useRef<number | null>(null);
  const arrivalTimer = useRef<number | null>(null);
  const encounterTimer = useRef<number | null>(null);
  const dangerTimer = useRef<number | null>(null);
  const stepEncounterTimer = useRef<number | null>(null);
  // Synchronous gameplay lock. Unlike React state, stale hold-repeat closures also
  // observe this ref immediately, so no movement can leak into a battle transition.
  const movementLockedRef = useRef(false);
  const keyboardHandlerRef = useRef<(event: KeyboardEvent) => void>(() => undefined);
  const importRef = useRef<HTMLInputElement | null>(null);
  const saveRef = useRef(save);

  const map = MAPS[save.mapId] ?? MAPS.hearthVillage!;
  const mapNpcs = useMemo(() => npcsForMap(map.id).filter((npc) => hasFlag(save, npc.requireFlag) && (!npc.hideAfterFlag || !hasFlag(save, npc.hideAfterFlag))), [map.id, save]);
  const speakerNpc = useMemo(() => mapNpcs.find((npc) => npc.name === speaker) ?? null, [mapNpcs, speaker]);
  const speakerNpcCell = speakerNpc ? npcAtlasCell(speakerNpc.sprite) : null;
  const visibleFixed = useMemo(() => map.fixedEncounters.filter((entry) => hasFlag(save, entry.requireFlag) && !save.defeatedEncounters.includes(entry.id)), [map, save]);
  const currentTile = tileAt(map, save.position.x, save.position.y);
  const nearbyThreat = useMemo(() => {
    let closest: { entry: (typeof visibleFixed)[number]; distance: number } | null = null;
    for (const entry of visibleFixed) {
      const distance = Math.abs(entry.x - save.position.x) + Math.abs(entry.y - save.position.y);
      if (!closest || distance < closest.distance) closest = { entry, distance };
    }
    return closest && closest.distance <= 3 ? closest : null;
  }, [visibleFixed, save.position.x, save.position.y]);

  function commit(mutator: (current: RPGSaveData) => RPGSaveData, autosave = false) {
    setSave((current) => {
      const next = mutator(current);
      // Keep the lifecycle-save ref synchronous with state so an immediate
      // iPhone background/pagehide cannot persist the previous frame.
      saveRef.current = next;
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
    if (movementLockedRef.current || stepEncounterTimer.current !== null || screen !== "overworld" || service || battle || result || areaTransition || discovery || encounterCue) return;
    const current = saveRef.current;
    const delta = DIR_DELTA[direction];
    const nextPosition = { x: current.position.x + delta.x, y: current.position.y + delta.y };
    const blockingNpc = mapNpcs.find((npc) => npc.x === nextPosition.x && npc.y === nextPosition.y);
    if (blockingNpc) {
      commit((current) => ({ ...current, direction })); setNotice(`${blockingNpc.name} • Aで話す`); playSfx("uiSelect"); return;
    }
    if (tileBlocked(map, nextPosition)) {
      commit((current) => ({ ...current, direction })); setNotice("道がふさがっている • Aで調べる"); playSfx("uiSelect"); return;
    }
    const code = tileAt(map, nextPosition.x, nextPosition.y);
    const danger = isDangerTile(code);
    const enteringDanger = danger && !isDangerTile(tileAt(map, current.position.x, current.position.y));
    if (enteringDanger) {
      setDangerWarning(map.kind === "danger" ? map.name : "DANGER ZONE");
      if (dangerTimer.current) window.clearTimeout(dangerTimer.current);
      dangerTimer.current = window.setTimeout(() => {
        dangerTimer.current = null;
        setDangerWarning(null);
      }, 760);
    }
    const safe = isRoadTile(code) || map.kind === "town" || map.kind === "training";
    let nextMeter = current.encounterMeter;
    if (!safe) nextMeter -= danger ? 2 : 1;
    const shouldEncounter = !safe && nextMeter <= 0 && Boolean(map.encounterTable || map.id === "world");
    if (shouldEncounter) {
      // Lock on the exact step that rolls an encounter, before the 90ms cue delay.
      // This prevents a held D-pad repeat from moving LIO again behind the battle.
      movementLockedRef.current = true;
      stopHold();
    }
    const updated: RPGSaveData = { ...current, position: nextPosition, direction, steps: current.steps + 1, encounterMeter: shouldEncounter ? encounterReset(current) : nextMeter };
    saveRef.current = updated; setSave(updated); setWalkFrame((frame) => (frame + 1) % 3);
    playSfx("step");
    if (shouldEncounter) {
      saveGame(updated);
      if (stepEncounterTimer.current !== null) window.clearTimeout(stepEncounterTimer.current);
      stepEncounterTimer.current = window.setTimeout(() => {
        stepEncounterTimer.current = null;
        startBattle(chooseEncounter(nextPosition, danger), {}, danger ? "danger" : "wild");
      }, 90);
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
    if (movementLockedRef.current) return;
    if (discovery) { setDiscovery(null); playSfx("uiSelect"); return; }
    if (areaTransition || encounterCue) return;
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
      let found: Exclude<DiscoveryState, null> = { kind: "item", kicker: "TREASURE FOUND", name: "TREASURE", detail: "宝箱を開けた。" };
      if (chest.gold) found = { kind: "gold", kicker: "TREASURE FOUND", name: `${chest.gold} GOLD`, detail: "旅の資金を手に入れた。" };
      if (chest.item) found = { kind: "item", kicker: "ITEM ACQUIRED", name: ITEMS[chest.item].name, detail: "ITEMを手に入れた。" };
      if (chest.equipment) found = { kind: "equipment", kicker: "EQUIPMENT ACQUIRED", name: EQUIPMENT[chest.equipment].name, detail: "EQUIPMENTを手に入れた。" };
      commit((current) => {
        let next = { ...current, openedChests: addUnique(current.openedChests, chest.id) };
        if (chest.gold) next = { ...next, gold: next.gold + chest.gold };
        if (chest.item) next = giveItem(next, chest.item);
        if (chest.equipment) next = { ...next, equipmentOwned: addUnique(next.equipmentOwned, chest.equipment) };
        saveGame(next); return next;
      });
      setDiscovery(found); playSfx("treasure"); return;
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
    if (!destination || areaTransition) return;
    primeAudio(); playSfx("door");
    const visual = { targetName: destination.name, targetKind: destination.kind, label };
    setAreaTransition({ ...visual, phase: "depart" });
    if (transitionTimer.current) window.clearTimeout(transitionTimer.current);
    if (arrivalTimer.current) window.clearTimeout(arrivalTimer.current);
    transitionTimer.current = window.setTimeout(() => {
      transitionTimer.current = null;
      const isTown = destination.kind === "town";
      commit((current) => {
        const next = { ...current, mapId: targetMap, position, direction: "up" as Direction, encounterMeter: encounterReset(current), lastInn: isTown ? { mapId: targetMap, position } : current.lastInn };
        saveGame(next); return next;
      });
      setNotice(label);
      setAreaTransition({ ...visual, phase: "arrive" });
      arrivalTimer.current = window.setTimeout(() => {
        arrivalTimer.current = null;
        setAreaTransition(null);
      }, 420);
    }, 180);
  }

  function startBattle(enemyId: string, context: Omit<BattleContext, "enemyId"> = {}, requestedKind?: EncounterCueKind) {
    const enemy = ENEMIES[enemyId];
    if (!enemy || encounterCue) return;
    movementLockedRef.current = true;
    stopHold();
    const kind: EncounterCueKind = requestedKind ?? (context.training ? "trial" : enemy.boss ? "boss" : context.fixedId ? "fixed" : "wild");
    const title = kind === "boss" ? "BOSS APPROACH" : kind === "trial" ? "TRIAL" : kind === "fixed" ? "GUARDIAN" : kind === "danger" ? "DANGER ENCOUNTER" : "ENCOUNTER";
    const subtitle = kind === "boss" ? "A POWERFUL PRESENCE" : kind === "trial" ? "MASTER'S TEST" : kind === "fixed" ? "PATH BLOCKED" : kind === "danger" ? "HOSTILE TERRITORY" : "WILD FOE";
    const delay = kind === "boss" ? 700 : kind === "trial" ? 520 : kind === "fixed" ? 480 : kind === "danger" ? 420 : 360;
    primeAudio(); playSfx("battleStart"); saveGame(saveRef.current); setResult(null); setEncounterCue({ enemyId, kind, title, subtitle, context });
    if (encounterTimer.current) window.clearTimeout(encounterTimer.current);
    encounterTimer.current = window.setTimeout(() => {
      encounterTimer.current = null;
      setEncounterCue(null); setBattle({ enemyId, ...context }); setScreen("battle");
    }, delay);
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
    movementLockedRef.current = false;
    setResult(null); setScreen("overworld"); setFieldReturn(true);
    window.setTimeout(() => setFieldReturn(false), 520);
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

  function openMenu() { if (!movementLockedRef.current && screen === "overworld" && !areaTransition && !discovery && !encounterCue) { primeAudio(); playSfx("uiSelect"); setService(null); setScreen("menu"); } }
  function closeMenu() { setService(null); setScreen("overworld"); playSfx("uiSelect"); }

  function toggleSetting(key: "music" | "sfx") {
    commit((current) => ({ ...current, settings: { ...current.settings, [key]: !current.settings[key] } }), true);
  }

  function startHold(direction: Direction, event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (movementLockedRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    move(direction);
    // move() may synchronously roll an encounter. Never recreate repeat after it locked.
    if (movementLockedRef.current || stepEncounterTimer.current !== null) return;
    if (heldTimer.current !== null) window.clearInterval(heldTimer.current);
    heldTimer.current = window.setInterval(() => move(direction), 145);
  }
  function stopHold() { if (heldTimer.current !== null) window.clearInterval(heldTimer.current); heldTimer.current = null; }

  keyboardHandlerRef.current = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (screen === "dialogue" || screen === "event") { if (["enter", " ", "a"].includes(key)) { event.preventDefault(); advanceDialogue(); } return; }
    if (screen === "result" && key === "enter") { closeResult(); return; }
    if (screen !== "overworld") { if (key === "escape" || key === "b") closeMenu(); return; }
    const direction = key === "arrowup" || key === "w" ? "up" : key === "arrowdown" || key === "s" ? "down" : key === "arrowleft" ? "left" : key === "arrowright" || key === "d" ? "right" : null;
    if (direction) { event.preventDefault(); move(direction); }
    else if (key === "a" || key === "enter" || key === " ") { event.preventDefault(); interact(); }
    else if (key === "b" || key === "escape") { event.preventDefault(); openMenu(); }
  };

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    // iOS Safari may suspend or discard a tab without another gameplay event.
    // Persist the latest state and release held input before backgrounding.
    const persistCurrentSave = () => saveGame(saveRef.current);
    const handlePageHide = () => { stopHold(); persistCurrentSave(); };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") { stopHold(); persistCurrentSave(); }
    };
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

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
    return () => {
      active = false;
      for (const image of Object.values(atlasImages.current)) if (image) image.onload = null;
      atlasImages.current = {};
    };
  }, []);

  useEffect(() => {
    setSfxEnabled(save.settings.sfx);
    if (screen === "battle") return;
    setRpgMusic(screen === "ending" ? "ending" : map.music, save.settings.music);
  }, [map.music, save.settings.music, save.settings.sfx, screen]);

  useEffect(() => {
    if (screen !== "overworld" || !visibleFixed.length) return;
    const timer = window.setInterval(() => setFieldEnemyFrame((frame) => (frame + 1) % 4), 360);
    return () => window.clearInterval(timer);
  }, [screen, map.id, visibleFixed.length]);

  useEffect(() => {
    if (screen !== "overworld" || map.kind !== "town") return;
    const timer = window.setInterval(() => setTownLifeFrame((frame) => (frame + 1) % 24), 520);
    return () => window.clearInterval(timer);
  }, [screen, map.id, map.kind]);

  useEffect(() => {
    if (screen !== "overworld" || (map.kind !== "dungeon" && map.kind !== "danger")) return;
    const timer = window.setInterval(() => setDungeonLifeFrame((frame) => (frame + 1) % 24), 430);
    return () => window.clearInterval(timer);
  }, [screen, map.id, map.kind]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      commit((current) => ({ ...current, playSeconds: current.playSeconds + 10 }));
    }, 10_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (screen !== "overworld" || areaTransition || discovery || encounterCue) stopHold();
  }, [areaTransition, discovery, encounterCue, screen]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => keyboardHandlerRef.current(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

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
      const baseCode = map.id === "world" && (code === "r" || code === "d" || code === "f" || code === "w" || code === "m") ? "g" : code;
      const cell = terrainAtlasCell(map, baseCode, worldX, worldY);
      const atlas = atlasImages.current[cell.atlas];
      if (atlas?.complete && atlas.naturalWidth) drawAtlasTile(context, atlas, cell, viewX * TILE, viewY * TILE);
      else drawTile(context, baseCode, viewX * TILE, viewY * TILE, worldX, worldY);
    }

    // Non-world maps are rebuilt as cohesive regional interiors before entity layers.
    drawInteriorReconstruction(context, map, cameraX, cameraY);

    // World water and mountains are reconstructed as continuous terrain masses
    // before the forest canopy and route overlays are added.
    drawWorldWaterLayer(context, map, cameraX, cameraY);
    drawWorldBridgeLayer(context, map, cameraX, cameraY);
    drawWorldMountainLayer(context, map, cameraX, cameraY);

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
      drawWorldDangerMass(context, map, code, worldX, worldY, viewX * TILE, viewY * TILE);
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

    drawTownAmbient(context, map, cameraX, cameraY, townLifeFrame);
    drawDungeonAmbient(context, map, cameraX, cameraY, dungeonLifeFrame, save.position);
    drawBossSetpieces(context, map, cameraX, cameraY, map.fixedEncounters.filter((entry) => hasFlag(save, entry.requireFlag)), dungeonLifeFrame);

    map.portals.forEach((portal, portalIndex) => {
      const x = (portal.x - cameraX) * TILE, y = (portal.y - cameraY) * TILE;
      if (x < -TILE || y < -TILE || x >= VIEW_W * TILE || y >= VIEW_H * TILE) return;
      const locked = Boolean(portal.requireFlag && !hasFlag(save, portal.requireFlag));
      if (map.id === "world") {
        drawWorldLandmarkGroundV2(context, portal.targetMap, x, y, locked);
        drawWorldLandmarkV2(context, portal.targetMap, x, y, locked);
        return;
      }
      drawInteriorPortal(context, map, portal.targetMap, x, y, locked);
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
      const npcPhase = (townLifeFrame + stableVisualIndex(npc.name, npc.x, npc.y)) % 8;
      const lively = map.kind === "town";
      const bob = lively && (npc.sprite === "child" ? npcPhase % 2 === 0 : npcPhase === 0) ? -1 : 0;
      drawNpcRoleProp(context, npc, x, y + bob);
      if (npcAtlas?.complete && npcAtlas.naturalWidth) {
        const cell = npcAtlasCell(npc.sprite);
        drawGroundShadow(context, x - 5, y + TILE, 26);
        context.drawImage(npcAtlas, cell.col * 96, cell.row * 128, 96, 128, x - 5, y - 18 + bob, 26, 34);
      } else drawPerson(context, x, y + bob, npcColors[npc.palette % npcColors.length]!, "down", lively ? npcPhase : 0);
      if (lively) drawNpcActivity(context, npc, x, y + bob, townLifeFrame);
    });
    visibleFixed.forEach((entry) => {
      const x = (entry.x - cameraX) * TILE, y = (entry.y - cameraY) * TILE;
      const enemy = ENEMIES[entry.enemyId];
      const boss = Boolean(enemy?.boss);
      const proximity = Math.abs(entry.x - save.position.x) + Math.abs(entry.y - save.position.y);
      const alerted = proximity <= 2;
      const pulse = fieldEnemyFrame % 2;
      const frame = alerted && pulse ? "reaction" : !boss && pulse ? "reaction" : "idle";
      const sprite = enemySpriteCell(entry.enemyId, frame);
      const atlasKey: AtlasImageKey | null = !sprite ? null : sprite.src === RPG_ASSETS.enemyA ? "enemyA" : sprite.src === RPG_ASSETS.enemyB ? "enemyB" : "bosses";
      const atlas = atlasKey ? atlasImages.current[atlasKey] : null;
      const size = boss ? 38 : 28;
      const bob = pulse ? -1 : 0;

      context.save();
      context.globalAlpha = boss ? .76 : alerted ? .58 : .34;
      context.fillStyle = boss ? "#b559d1" : alerted ? "#ff5a60" : "#9d3545";
      const aura = boss ? 27 : alerted ? 21 : 17;
      const auraX = x + 8 - Math.floor(aura / 2), auraY = y + 13 - Math.floor(aura / 2);
      context.fillRect(auraX, auraY + 5, aura, 2);
      context.fillRect(auraX + 5, auraY, 2, aura);
      context.fillRect(auraX + aura - 7, auraY, 2, aura);
      context.fillRect(auraX, auraY + aura - 7, aura, 2);
      if (boss || alerted) {
        context.fillStyle = boss ? "#f1c76b" : "#ffaba4";
        const spark = (fieldEnemyFrame + stableVisualIndex(entry.id, entry.x, entry.y)) % 4;
        context.fillRect(x - 3 + spark * 6, y - 5 - (spark % 2) * 2, 2, 3);
        context.fillRect(x + 17 - spark * 3, y + 1 + spark * 3, 2, 2);
      }
      context.restore();

      if (sprite && atlas?.complete && atlas.naturalWidth) {
        const sourceWidth = atlas.naturalWidth / sprite.columns;
        const sourceHeight = atlas.naturalHeight / sprite.rows;
        drawGroundShadow(context, x + (TILE - size) / 2, y + TILE, size);
        context.drawImage(atlas, sprite.col * sourceWidth, sprite.row * sourceHeight, sourceWidth, sourceHeight, x + (TILE - size) / 2, y + TILE - size + bob, size, size);
      } else {
        context.fillStyle = "#08080d"; context.fillRect(x + 2, y + 2 + bob, 12, 12); context.fillStyle = "#ff4f64"; context.fillRect(x + 5, y + 4 + bob, 6, 7);
      }
      if (alerted) {
        context.fillStyle = "#09070b"; context.fillRect(x + 5, y - (boss ? 18 : 13), 7, 8);
        context.fillStyle = boss ? "#ffd86a" : "#ff6868"; context.fillRect(x + 7, y - (boss ? 17 : 12), 3, 4); context.fillRect(x + 7, y - (boss ? 12 : 7), 3, 2);
      }
    });
    const heroAtlas = atlasImages.current.hero;
    const heroX = (save.position.x - cameraX) * TILE, heroY = (save.position.y - cameraY) * TILE;
    if (heroAtlas?.complete && heroAtlas.naturalWidth) {
      const cell = heroAtlasCell(save.direction, walkFrame);
      drawGroundShadow(context, heroX - 6, heroY + TILE, 29);
      context.drawImage(heroAtlas, cell.col * 96, cell.row * 96, 96, 96, heroX - 6, heroY - 16, 28, 32);
    } else drawPerson(context, heroX, heroY, "#f0c85a", save.direction, walkFrame, true);

    drawInteriorForeground(context, map, cameraX, cameraY);

    // Interaction glyphs are intentionally rendered last. Large SNES-style actors
    // can overlap adjacent tiles, so drawing these inside an NPC loop allowed the
    // hero to hide the cue even though interaction still worked.
    const frontDelta = DIR_DELTA[save.direction];
    const frontPosition = { x: save.position.x + frontDelta.x, y: save.position.y + frontDelta.y };
    const frontNpc = mapNpcs.find((npc) => npc.x === frontPosition.x && npc.y === frontPosition.y);
    const frontChest = map.chests.find((chest) => chest.x === frontPosition.x && chest.y === frontPosition.y && !save.openedChests.includes(chest.id) && hasFlag(save, chest.requireFlag));
    const frontFixed = visibleFixed.find((entry) => entry.x === frontPosition.x && entry.y === frontPosition.y);
    const frontPortal = map.portals.find((portal) => portal.x === frontPosition.x && portal.y === frontPosition.y);
    const markerTarget = frontNpc ?? frontChest ?? frontFixed ?? frontPortal;
    if (markerTarget) {
      const markerX = (markerTarget.x - cameraX) * TILE;
      const markerY = (markerTarget.y - cameraY) * TILE;
      const markerKind: InteractionMarkerKind = frontNpc ? "talk" : frontChest ? "treasure" : frontFixed ? (ENEMIES[frontFixed.enemyId]?.boss ? "boss" : "danger") : "exit";
      drawInteractionMarker(context, markerX, markerY, markerKind);
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
  }, [atlasVersion, dungeonLifeFrame, fieldEnemyFrame, map, mapNpcs, save, townLifeFrame, visibleFixed, walkFrame]);

  useEffect(() => () => {
    stopHold();
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
    if (arrivalTimer.current !== null) window.clearTimeout(arrivalTimer.current);
    if (encounterTimer.current !== null) window.clearTimeout(encounterTimer.current);
    if (dangerTimer.current !== null) window.clearTimeout(dangerTimer.current);
    if (stepEncounterTimer.current !== null) window.clearTimeout(stepEncounterTimer.current);
    stopRpgMusic();
    setSfxEnabled(true);
  }, []);

  const nearPortal = findAt(map.portals);
  const terrainLabel = isRoadTile(currentTile) ? "ROAD • SAFE" : isDangerTile(currentTile) ? "DANGER • HIGH ENCOUNTER" : map.kind === "town" ? "TOWN • SAFE" : map.kind === "training" ? "TRAINING • SAFE" : "FIELD • ENCOUNTER";

  if (battle) return <RPGPuzzleBattle enemy={ENEMIES[battle.enemyId]!} save={save} training={battle.training} onFinish={finishBattle} />;

  const endingLines = save.releasedEnemies && Object.values(save.releasedEnemies).reduce((sum, count) => sum + count, 0) >= 4 ? STORY_TEXT.endingMercy : STORY_TEXT.endingForce;

  return (
    <main className={styles.rpg} data-map={map.id} data-kind={map.kind} data-returning={fieldReturn ? "true" : "false"} data-area-phase={areaTransition?.phase ?? "none"} data-encounter={encounterCue?.kind ?? "none"}>
      {areaTransition ? <div className={styles.areaTransition} data-phase={areaTransition.phase} data-kind={areaTransition.targetKind} role="status" aria-live="polite">
        <span>{areaTransition.phase === "depart" ? "TRAVEL" : "AREA"}</span><strong>{areaTransition.targetName}</strong><small>{areaTransition.label}</small>
      </div> : null}
      {dangerWarning && !encounterCue ? <div className={styles.dangerWarning} role="status" aria-live="polite"><span>WARNING</span><strong>{dangerWarning}</strong><small>ENCOUNTER RATE UP</small></div> : null}
      {encounterCue ? <div className={styles.encounterCue} data-kind={encounterCue.kind} role="status" aria-live="assertive">
        <span>{encounterCue.subtitle}</span><strong>{encounterCue.title}</strong><b>{ENEMIES[encounterCue.enemyId]?.name ?? encounterCue.enemyId}</b><i aria-hidden="true" />
      </div> : null}
      {discovery ? <div className={styles.discoveryOverlay} data-kind={discovery.kind} onPointerDown={(event) => { event.preventDefault(); setDiscovery(null); playSfx("uiSelect"); }}>
        <div className={styles.discoveryCard} data-kind={discovery.kind}>
          <span>{discovery.kicker}</span><i aria-hidden="true">{discovery.kind === "gold" ? "G" : discovery.kind === "equipment" ? "E" : "I"}</i><strong>{discovery.name}</strong><p>{discovery.detail}</p><small>A / TAP • CONTINUE</small>
        </div>
      </div> : null}
      <header className={styles.hud}>
        <div><span>RPG MODE</span><strong>{map.name}</strong></div>
        <div><span>LV {save.level}</span><strong>HP {save.hp}/{save.maxHp}</strong></div>
        <div><span><RPGIcon name="gold" size={10} /> GOLD</span><strong>{save.gold}</strong></div>
      </header>
      <section className={styles.locationBar}><span>{terrainLabel}</span><strong>{nearPortal ? `A • ${nearPortal.label}` : notice}</strong></section>
      <div className={styles.worldFrame} data-atmosphere={map.id === "prismCitadel" ? "citadel" : map.id === "voidPass" ? "void" : map.kind === "dungeon" ? "dungeon" : "none"}>
        <canvas ref={canvasRef} className={styles.world} width={VIEW_W * TILE * WORLD_RENDER_SCALE} height={VIEW_H * TILE * WORLD_RENDER_SCALE} aria-label={`${map.name} exploration map`} />
        <div className={styles.worldGloss} aria-hidden="true" />
        {nearbyThreat ? <div className={styles.fieldThreat} data-boss={ENEMIES[nearbyThreat.entry.enemyId]?.boss ? "true" : "false"} data-alert={nearbyThreat.distance <= 1 ? "true" : "false"}>
          <span>{ENEMIES[nearbyThreat.entry.enemyId]?.boss ? "BOSS" : "HOSTILE"}</span><strong>{ENEMIES[nearbyThreat.entry.enemyId]?.name ?? nearbyThreat.entry.enemyId}</strong><small>{nearbyThreat.distance <= 1 ? "A • CONFRONT" : `${nearbyThreat.distance} TILES`}</small>
        </div> : null}
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

      {(screen === "dialogue" || screen === "event") && dialogue.length ? <div className={styles.dialogueOverlay} data-story={screen === "event" ? "event" : "dialogue"} data-page={`${dialogueIndex + 1}/${dialogue.length}`} onPointerDown={(event) => { event.preventDefault(); advanceDialogue(); }}>
        <div className={styles.dialogueBox} data-story={screen === "event" ? "event" : "dialogue"} data-portrait={Boolean(speakerNpcCell)}>
          {speakerNpcCell ? <i className={styles.dialoguePortrait} aria-hidden="true" data-sprite={speakerNpc?.sprite} style={{
            backgroundImage: `url(${RPG_ASSETS.npcs})`,
            // The field atlas stores complete 96x128 actors. Dialogue uses a centered
            // upper-body crop so faces read at conversation scale without a second asset.
            backgroundSize: "288px 288px",
            backgroundPosition: `${-(speakerNpcCell.col * 72 + 12)}px ${-(speakerNpcCell.row * 96 + (speakerNpc?.sprite === "child" ? 8 : 4))}px`,
          }} /> : null}
          <span>{speaker}</span><p>{dialogue[dialogueIndex]}</p><small>A / TAP ▼</small>
        </div>
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

      {screen === "result" && result ? <div className={styles.resultOverlay} data-result={result.title.toLowerCase().replaceAll(" ", "-")}><div className={styles.resultCard}>
        <span className={styles.resultEyebrow}>RPG MODE • BATTLE REPORT</span>
        <strong>{result.title}</strong>
        <div className={styles.resultStatus}><i><small>LV</small><b>{save.level}</b></i><i><small>HP</small><b>{save.hp}/{save.maxHp}</b></i><i><small>GOLD</small><b>{save.gold}</b></i></div>
        <div className={styles.resultLines}>{result.lines.map((line, index) => <p data-kind={resultLineKind(line)} data-acquire={resultLineKind(line) === "acquire" ? resultAcquireKind(line) : undefined} style={{ "--result-index": index } as Record<string, number>} key={`${index}-${line}`}>{line}</p>)}</div>
        <button type="button" onClick={closeResult}>A • CONTINUE</button>
      </div></div> : null}

      {screen === "ending" ? <div className={styles.ending} data-stage={endingIndex < endingLines.length - 1 ? "story" : "final"}><span>PRISM ROAD</span><strong>{endingIndex < endingLines.length ? "ENDING" : "THE END"}</strong><p>{endingLines[Math.min(endingIndex, endingLines.length - 1)]}</p>{endingIndex < endingLines.length - 1 ? <button type="button" onClick={() => setEndingIndex((index) => index + 1)}>A • NEXT</button> : <button type="button" onClick={() => { commit((current) => ({ ...current, flags: addUnique(current.flags, "ending:seen") }), true); onExit(); }}>TITLEへ</button>}<small>LV {save.level} • {Object.values(save.releasedEnemies).reduce((sum, count) => sum + count, 0)} RELEASES • {Math.floor(save.playSeconds / 60)} MIN</small></div> : null}
    </main>
  );
}

const LABEL_SCHOOL: Record<PanelType, string> = { attack: "ATK", heal: "HEAL", barrier: "BAR", skip: "SKIP" };
