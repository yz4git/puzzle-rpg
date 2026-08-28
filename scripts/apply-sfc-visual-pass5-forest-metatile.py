from pathlib import Path
import re

path = Path('app/rpg/RPGMode.tsx')
text = path.read_text()

# Remove the first-attempt straight seam painter.
text, count = re.subn(r'\nfunction drawForestStitch\(.*?\n\}\n(?=\nfunction drawWorldLandmark)', '\n', text, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'forest stitch removal count={count}')

helper = r'''
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
'''
marker = '\nfunction drawWorldLandmark('
if 'function drawWorldForestLayer(' not in text:
    if marker not in text: raise SystemExit('landmark marker missing')
    text = text.replace(marker, '\n' + helper + marker, 1)

old = '      const baseCode = map.id === "world" && (code === "r" || code === "d") ? "g" : code;'
new = '      const baseCode = map.id === "world" && (code === "r" || code === "d" || code === "f") ? "g" : code;'
if old not in text: raise SystemExit('baseCode line missing')
text = text.replace(old, new, 1)

old = '''    // A lightweight autotile edge pass stitches roads, shores, forest walls and danger ground together.
    for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
'''
new = '''    // Forest is composited as greedy 2x2 metatiles over a grass foundation.
    // Edge cells remain single-tree illustrations for a readable silhouette.
    const fieldAtlas = atlasImages.current.field;
    if (fieldAtlas?.complete && fieldAtlas.naturalWidth) drawWorldForestLayer(context, fieldAtlas, map, cameraX, cameraY);

    // A lightweight autotile edge pass stitches roads, shores, forest walls and danger ground together.
    for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
'''
if old not in text: raise SystemExit('autotile marker missing')
text = text.replace(old, new, 1)
text = text.replace('      drawForestStitch(context, map, code, worldX, worldY, viewX * TILE, viewY * TILE);\n', '', 1)
path.write_text(text)

progress = Path('PROGRESS.md')
p = progress.read_text()
entry = '''\n### Pass 5 correction — Forest metatile compositor\n- Rejected the straight seam-fill prototype after visual audit because it created a bright grid.\n- World forest now uses a greedy 2x2 canopy compositor over grass, reducing 16px seams while keeping single-tree edge silhouettes.\n'''
if 'Pass 5 correction — Forest metatile compositor' not in p:
    progress.write_text(p + entry)
