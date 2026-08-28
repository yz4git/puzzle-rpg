from pathlib import Path
import re

path = Path('app/rpg/RPGMode.tsx')
text = path.read_text()

mountain = r'''function drawWorldMountainLayer(context: CanvasRenderingContext2D, map: MapDefinition, cameraX: number, cameraY: number) {
  if (map.id !== "world") return;
  for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
    const worldX = cameraX + viewX, worldY = cameraY + viewY;
    if (tileAt(map, worldX, worldY) !== "m") continue;
    const x = viewX * TILE, y = viewY * TILE;
    const seed = stableVisualIndex("world-ridge", worldX, worldY);
    const up = tileAt(map, worldX, worldY - 1) === "m";
    const down = tileAt(map, worldX, worldY + 1) === "m";

    if (!up) {
      // Top-edge mountain cells become overlapping 24px stepped peaks. Peaks
      // intentionally extend beyond the 16px gameplay cell to erase tile rhythm.
      const shift = (seed % 5) - 2;
      context.fillStyle = "#242b36";
      context.fillRect(x - 4, y + 13, 24, 14);
      context.fillRect(x - 1 + shift, y + 9, 18, 17);
      context.fillRect(x + 2 + shift, y + 6, 13, 20);
      context.fillRect(x + 5 + shift, y + 3, 7, 22);
      context.fillStyle = seed % 2 ? "#59636d" : "#626c73";
      context.fillRect(x + 1 + shift, y + 11, 14, 11);
      context.fillRect(x + 4 + shift, y + 8, 9, 13);
      context.fillRect(x + 6 + shift, y + 5, 4, 13);
      context.fillStyle = "#929994";
      context.fillRect(x + 6 + shift, y + 6, 2, 5);
      context.fillRect(x + 4 + shift, y + 11, 2, 3);
      context.fillStyle = "#353d48";
      context.fillRect(x + 11 + shift, y + 10, 4, 11);
      context.fillRect(x + 14 + shift, y + 15, 4, 7);
    } else {
      // Lower/interior ridge cells are irregular foothill masses, not a flat wall.
      context.fillStyle = "#28313c";
      context.fillRect(x - 2, y + 5, 20, 11);
      context.fillRect(x + 1 + (seed % 3), y + 2, 13, 13);
      context.fillStyle = seed % 2 ? "#4e5963" : "#56606a";
      context.fillRect(x + 1, y + 7, 15, 8);
      context.fillRect(x + 4 + (seed % 4), y + 4, 8, 8);
      context.fillStyle = "#737b7b";
      context.fillRect(x + 5 + (seed % 5), y + 5, 2, 4);
      context.fillStyle = "#1a222d";
      context.fillRect(x + 11, y + 10, 4, 6);
    }

    if (!down) {
      // Broken scree along the open lower edge avoids one long horizontal baseline.
      context.fillStyle = "#202833";
      context.fillRect(x - 1, y + 14, 6 + (seed % 4), 3);
      context.fillRect(x + 9, y + 13, 7, 4);
      context.fillStyle = "#626a70";
      context.fillRect(x + 2, y + 13, 3, 2);
      context.fillRect(x + 12, y + 12, 2, 2);
    }
  }
}
'''
text, count = re.subn(r'function drawWorldMountainLayer\(.*?\n\}\n\nfunction drawWorldLandmarkGround', mountain + '\nfunction drawWorldLandmarkGround', text, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'mountain replacement count={count}')

bridge = r'''
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
'''
marker = '\nfunction drawWorldMountainLayer('
if 'function drawWorldBridgeLayer(' not in text:
    if marker not in text: raise SystemExit('mountain marker missing for bridge')
    text = text.replace(marker, '\n' + bridge + marker, 1)

old_call = '''    drawWorldWaterLayer(context, map, cameraX, cameraY);\n    drawWorldMountainLayer(context, map, cameraX, cameraY);'''
new_call = '''    drawWorldWaterLayer(context, map, cameraX, cameraY);\n    drawWorldBridgeLayer(context, map, cameraX, cameraY);\n    drawWorldMountainLayer(context, map, cameraX, cameraY);'''
if old_call not in text: raise SystemExit('world layer call target missing')
text = text.replace(old_call, new_call, 1)

path.write_text(text)
progress=Path('PROGRESS.md');p=progress.read_text()
entry='''\n- Pass 6 visual correction: rejected the first rectangular ridge because it read as a fortress wall. Replaced it with overlapping stepped peaks/foothills and added a dedicated bridge compositor over the continuous water layer.\n'''
if 'rejected the first rectangular ridge' not in p: progress.write_text(p+entry)
