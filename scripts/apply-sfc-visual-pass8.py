from pathlib import Path

path = Path('app/rpg/RPGMode.tsx')
text = path.read_text()
if 'function drawInteriorReconstruction(' in text:
    raise SystemExit('Pass 8 already applied')

anchor = 'function drawTerrainEdge(context: CanvasRenderingContext2D, map: MapDefinition, code: string, worldX: number, worldY: number, x: number, y: number) {'
if anchor not in text:
    raise SystemExit('terrain edge anchor missing')

block = r'''
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
  const same = (xx: number, yy: number) => ["r", "b", "s"].includes(tileAt(map, xx, yy));
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
    if (code === "a") { drawTrainingAltar(context, map, x, y, seed, palette); continue; }
    context.fillStyle = seed % 4 === 0 ? palette.floorAlt : palette.floor; context.fillRect(x, y, TILE, TILE);
    context.fillStyle = palette.line;
    if (seed % 7 === 0) context.fillRect(x + 3 + seed % 7, y + 5 + ((seed >> 3) % 6), 2, 1);
    if (map.id === "mirrorTower" || map.id === "prismCitadel") {
      context.fillStyle = palette.roadLight; context.globalAlpha = .34; context.fillRect(x + 2, y + 2, 12, 1); context.fillRect(x + 2, y + 13, 12, 1); context.globalAlpha = 1;
    }
    if (code === "r" || code === "s") drawConnectedInteriorRoad(context, map, worldX, worldY, x, y, palette);
  }

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
'''
text = text.replace(anchor, block + '\n' + anchor)

base_anchor = '''    // World water and mountains are reconstructed as continuous terrain masses
    // before the forest canopy and route overlays are added.
    drawWorldWaterLayer(context, map, cameraX, cameraY);'''
if base_anchor not in text:
    raise SystemExit('renderer base anchor missing')
text = text.replace(base_anchor, '''    // Non-world maps are rebuilt as cohesive regional interiors before entity layers.
    drawInteriorReconstruction(context, map, cameraX, cameraY);

    // World water and mountains are reconstructed as continuous terrain masses
    // before the forest canopy and route overlays are added.
    drawWorldWaterLayer(context, map, cameraX, cameraY);''')

old_portal = '''      const atlas = atlasImages.current.field;
      if (atlas?.complete && atlas.naturalWidth) {
        context.globalAlpha = locked ? .42 : 1;
        context.drawImage(atlas, (portalIndex % 10) * 64, 9 * 64, 64, 64, x - 6, y - 12, 28, 28);
        context.globalAlpha = 1;
      } else {
        context.fillStyle = locked ? "#55515d" : "#ffe060";
        context.fillRect(x + 3, y + 4, 10, 9); context.fillStyle = "#11111a"; context.fillRect(x + 6, y + 8, 4, 5);
      }'''
if old_portal not in text:
    raise SystemExit('portal block missing')
text = text.replace(old_portal, '''      drawInteriorPortal(context, map, portal.targetMap, x, y, locked);''')

hero_anchor = '''    } else drawPerson(context, heroX, heroY, "#f0c85a", save.direction, walkFrame, true);

    context.setTransform(1, 0, 0, 1, 0, 0);'''
if hero_anchor not in text:
    raise SystemExit('hero foreground anchor missing')
text = text.replace(hero_anchor, '''    } else drawPerson(context, heroX, heroY, "#f0c85a", save.direction, walkFrame, true);

    drawInteriorForeground(context, map, cameraX, cameraY);
    context.setTransform(1, 0, 0, 1, 0, 0);''')

progress = Path('PROGRESS.md')
progress_text = progress.read_text()
progress_text += '''\n\n## SFC Visual Reconstruction Pass 8 — Interior maps\n- Reconstructed town, training, dungeon and danger-area interiors with region-specific procedural floor, road, wall, water, hazard and altar layers.\n- Replaced generic non-world portal atlas stamps with contextual town gates, training altars, dungeon doors, Void rock gate and Prism gate art.\n- Added blocked-edge foreground lips and town facade foundations for stronger SNES-style layering without changing collision or map progression.\n- Map data, NPC coordinates, encounter rules, boss conditions and saves remain unchanged.\n'''
progress.write_text(progress_text)
path.write_text(text)
