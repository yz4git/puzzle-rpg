from pathlib import Path

assets = Path('app/rpg/assets.ts')
text = assets.read_text()
old = '''    if (code === "g") return { atlas: "field", col: seed % 6, row: 0 };
    if (code === "f") {
      const variant = seed % 8;
      return variant < 4
        ? { atlas: "field", col: 6 + variant, row: 0 }
        : { atlas: "field", col: variant - 4, row: 1 };
    }
'''
new = '''    if (code === "g") {
      // Keep broad fields calm: most cells use the two plain grass sources and
      // flower/stone source cells become sparse accents instead of a checkerboard.
      const variant = seed % 16;
      if (variant < 8) return { atlas: "field", col: 0, row: 0 };
      if (variant < 12) return { atlas: "field", col: 1, row: 0 };
      return { atlas: "field", col: 2 + (variant - 12), row: 0 };
    }
    if (code === "f") {
      const neighbours = [
        tileAtSafe(map, x, y - 1), tileAtSafe(map, x + 1, y),
        tileAtSafe(map, x, y + 1), tileAtSafe(map, x - 1, y),
      ].filter((value) => value === "f").length;
      const variant = seed % 4;
      // Forest interiors use dense canopy sources; edges use readable single-tree
      // and clearing sources. This makes a forest mass instead of random cards.
      if (neighbours >= 3) {
        if (variant < 2) return { atlas: "field", col: 6 + variant, row: 0 };
        return { atlas: "field", col: variant - 2, row: 1 };
      }
      if (variant < 2) return { atlas: "field", col: 8 + variant, row: 0 };
      return { atlas: "field", col: variant, row: 1 };
    }
'''
if old not in text:
    raise SystemExit('assets terrain block not found')
text = text.replace(old, new, 1)
marker = '''function isRoadConnection(map: MapDefinition, x: number, y: number) {
  const row = map.tiles[y];
  if (!row) return false;
  const code = row[x];
  return code === "r" || code === "b";
}
'''
replacement = marker + '''\nfunction tileAtSafe(map: MapDefinition, x: number, y: number) {\n  return map.tiles[y]?.[x] ?? "";\n}\n'''
if 'function tileAtSafe(' not in text:
    if marker not in text: raise SystemExit('road helper marker not found')
    text = text.replace(marker, replacement, 1)
assets.write_text(text)

mode = Path('app/rpg/RPGMode.tsx')
text = mode.read_text()
helper = '''
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

function drawForestStitch(context: CanvasRenderingContext2D, map: MapDefinition, code: string, worldX: number, worldY: number, x: number, y: number) {
  if (map.id !== "world" || code !== "f") return;
  const up = tileAt(map, worldX, worldY - 1) === "f";
  const right = tileAt(map, worldX + 1, worldY) === "f";
  const down = tileAt(map, worldX, worldY + 1) === "f";
  const left = tileAt(map, worldX - 1, worldY) === "f";
  const seed = stableVisualIndex("forest-stitch", worldX, worldY);
  context.save();
  // Cover the source-cell presentation seams only where two forest cells touch.
  // Two leaf tones keep the seam organic instead of drawing a straight green bar.
  context.fillStyle = "#174a2b";
  if (up) context.fillRect(x + 2, y, TILE - 4, 2);
  if (down) context.fillRect(x + 2, y + TILE - 2, TILE - 4, 2);
  if (left) context.fillRect(x, y + 2, 2, TILE - 4);
  if (right) context.fillRect(x + TILE - 2, y + 2, 2, TILE - 4);
  context.fillStyle = "#2d7136";
  if (up) context.fillRect(x + 4 + seed % 6, y, 3, 1);
  if (down) context.fillRect(x + 3 + (seed >> 2) % 7, y + TILE - 1, 3, 1);
  if (left) context.fillRect(x, y + 4 + (seed >> 4) % 6, 1, 3);
  if (right) context.fillRect(x + TILE - 1, y + 3 + (seed >> 6) % 7, 1, 3);
  context.restore();
}
'''
if 'function drawGroundMacro(' not in text:
    marker = '\nfunction drawWorldLandmark('
    if marker not in text: raise SystemExit('world landmark marker not found')
    text = text.replace(marker, '\n' + helper + marker, 1)
old = '''      drawTerrainEdge(context, map, code, worldX, worldY, viewX * TILE, viewY * TILE);
      drawWorldRoute(context, map, code, worldX, worldY, viewX * TILE, viewY * TILE);
'''
new = '''      drawGroundMacro(context, map, code, worldX, worldY, viewX * TILE, viewY * TILE);
      drawForestStitch(context, map, code, worldX, worldY, viewX * TILE, viewY * TILE);
      drawTerrainEdge(context, map, code, worldX, worldY, viewX * TILE, viewY * TILE);
      drawWorldRoute(context, map, code, worldX, worldY, viewX * TILE, viewY * TILE);
'''
if old not in text: raise SystemExit('render overlay block not found')
text = text.replace(old, new, 1)
mode.write_text(text)

progress = Path('PROGRESS.md')
p = progress.read_text() if progress.exists() else ''
entry = '''\n## SFC Visual Reconstruction Pass 5 — Forest / ground continuity\n- Rebalanced world grass atlas selection so plain field cells dominate and decorative flower/stone cards become sparse accents.\n- Forest atlas selection now depends on neighbouring forest tiles: dense canopy inside, single trees/clearings at the perimeter.\n- Added forest seam stitching and low-frequency 3x3 ground macro tinting without changing map collision or encounter data.\n'''
if 'Pass 5 — Forest / ground continuity' not in p:
    progress.write_text(p + entry)
