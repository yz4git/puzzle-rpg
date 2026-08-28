from pathlib import Path

path = Path('app/rpg/RPGMode.tsx')
text = path.read_text()
if 'function drawTrainingDaisLayer(' in text:
    raise SystemExit('Pass 8B already applied')

text = text.replace('const same = (xx: number, yy: number) => ["r", "b", "s"].includes(tileAt(map, xx, yy));', 'const same = (xx: number, yy: number) => ["r", "b"].includes(tileAt(map, xx, yy));')

hazard_anchor = '''function drawInteriorHazard(context: CanvasRenderingContext2D, map: MapDefinition, worldX: number, worldY: number, x: number, y: number, palette: InteriorPalette) {
  const seed = stableVisualIndex(`interior-hazard-${map.id}`, worldX, worldY);'''
if hazard_anchor not in text:
    raise SystemExit('hazard anchor missing')
text = text.replace(hazard_anchor, '''function drawInteriorHazard(context: CanvasRenderingContext2D, map: MapDefinition, worldX: number, worldY: number, x: number, y: number, palette: InteriorPalette) {
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
  }''')

insert_anchor = 'function drawInteriorReconstruction(context: CanvasRenderingContext2D, map: MapDefinition, cameraX: number, cameraY: number) {'
if insert_anchor not in text:
    raise SystemExit('interior reconstruction anchor missing')
extra = r'''
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

'''
text = text.replace(insert_anchor, extra + insert_anchor)

old_a = '    if (code === "a") { drawTrainingAltar(context, map, x, y, seed, palette); continue; }'
if old_a not in text:
    raise SystemExit('training tile branch missing')
text = text.replace(old_a, '''    if (code === "a") {
      const macro = stableVisualIndex(`training-floor-${map.id}`, Math.floor(worldX / 2), Math.floor(worldY / 2));
      context.fillStyle = macro % 3 === 0 ? palette.floorAlt : palette.floor; context.fillRect(x, y, TILE, TILE);
      continue;
    }''')

old_floor = '''    context.fillStyle = seed % 4 === 0 ? palette.floorAlt : palette.floor; context.fillRect(x, y, TILE, TILE);
    context.fillStyle = palette.line;
    if (seed % 7 === 0) context.fillRect(x + 3 + seed % 7, y + 5 + ((seed >> 3) % 6), 2, 1);'''
if old_floor not in text:
    raise SystemExit('floor branch missing')
text = text.replace(old_floor, '''    const macro = stableVisualIndex(`interior-macro-${map.id}`, Math.floor(worldX / 2), Math.floor(worldY / 2));
    context.fillStyle = macro % 4 === 0 ? palette.floorAlt : palette.floor; context.fillRect(x, y, TILE, TILE);
    context.fillStyle = palette.line;
    if (seed % 17 === 0) context.fillRect(x + 3 + seed % 7, y + 5 + ((seed >> 3) % 6), 2, 1);''')

text = text.replace('    if (code === "r" || code === "s") drawConnectedInteriorRoad(context, map, worldX, worldY, x, y, palette);', '    if (code === "r") drawConnectedInteriorRoad(context, map, worldX, worldY, x, y, palette);')

post_loop_anchor = '''  // Region-specific set dressing is placed on blocked architecture or edges so collision stays honest.
  if (map.kind === "town") {'''
if post_loop_anchor not in text:
    raise SystemExit('post loop anchor missing')
text = text.replace(post_loop_anchor, '''  drawTrainingDaisLayer(context, map, cameraX, cameraY, palette);
  drawInteriorStructuralDetails(context, map, cameraX, cameraY, palette);

  // Region-specific set dressing is placed on blocked architecture or edges so collision stays honest.
  if (map.kind === "town") {''')

progress = Path('PROGRESS.md')
progress.write_text(progress.read_text() + '''\n- Pass 8B audit correction: removed dungeon walkable-floor road stamping, grouped floors into 2x2 macro palettes, rebuilt training altar rows as connected dais structures, added sparse exposed-wall pillars, and changed Void floor from repeated hazard stamps to dark fractured rock.\n''')
path.write_text(text)
