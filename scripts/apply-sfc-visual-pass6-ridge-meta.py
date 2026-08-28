from pathlib import Path
import re

path=Path('app/rpg/RPGMode.tsx')
text=path.read_text()
new=r'''function drawWorldMountainLayer(context: CanvasRenderingContext2D, map: MapDefinition, cameraX: number, cameraY: number) {
  if (map.id !== "world") return;

  // Pass 1: one continuous foothill / rock foundation for the whole visible ridge.
  for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
    const worldX = cameraX + viewX, worldY = cameraY + viewY;
    if (tileAt(map, worldX, worldY) !== "m") continue;
    const x = viewX * TILE, y = viewY * TILE;
    const seed = stableVisualIndex("ridge-base", worldX, worldY);
    const up = tileAt(map, worldX, worldY - 1) === "m";
    const down = tileAt(map, worldX, worldY + 1) === "m";
    context.fillStyle = up ? (seed % 2 ? "#303a45" : "#343e49") : "#29323d";
    context.fillRect(x - 1, y + (up ? 1 : 7), TILE + 2, up ? 15 : 10);
    context.fillStyle = seed % 2 ? "#4b5660" : "#525d66";
    context.fillRect(x + (seed % 4), y + (up ? 4 : 9), 10 + ((seed >> 3) % 5), up ? 8 : 7);
    context.fillStyle = "#778080";
    context.fillRect(x + 4 + (seed % 6), y + (up ? 5 : 10), 2, 3);
    if (!down) {
      context.fillStyle = "#1d2530";
      context.fillRect(x - 1, y + 14, 5 + (seed % 5), 3);
      context.fillRect(x + 10, y + 13, 7, 4);
    }
  }

  // Pass 2: top ridge cells are grouped into 2-tile metapeaks. A 30-34px
  // mountain spans adjacent gameplay cells, removing the one-icon-per-tile cadence.
  for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
    const worldX = cameraX + viewX, worldY = cameraY + viewY;
    if (tileAt(map, worldX, worldY) !== "m" || tileAt(map, worldX, worldY - 1) === "m") continue;
    let startX = worldX;
    while (tileAt(map, startX - 1, worldY) === "m") startX -= 1;
    const offset = worldX - startX;
    if (offset % 2 !== 0) continue;
    const x = viewX * TILE, y = viewY * TILE;
    const seed = stableVisualIndex("ridge-meta-peak", worldX, worldY);
    const pair = tileAt(map, worldX + 1, worldY) === "m";
    const width = pair ? 31 + (seed % 4) : 20;
    const shift = (seed % 5) - 3;
    const left = x + shift;
    const peakX = left + Math.floor(width * (.42 + ((seed >> 3) % 10) / 100));

    context.fillStyle = "#202833";
    context.beginPath();
    context.moveTo(left - 2, y + 16);
    context.lineTo(left + 5, y + 10);
    context.lineTo(peakX, y + 1 + (seed % 3));
    context.lineTo(left + width - 5, y + 9);
    context.lineTo(left + width + 2, y + 16);
    context.closePath();
    context.fill();

    context.fillStyle = seed % 2 ? "#5e6871" : "#667078";
    context.beginPath();
    context.moveTo(left + 1, y + 15);
    context.lineTo(left + 7, y + 10);
    context.lineTo(peakX, y + 3 + (seed % 2));
    context.lineTo(peakX + 2, y + 15);
    context.closePath();
    context.fill();

    context.fillStyle = "#3a444f";
    context.beginPath();
    context.moveTo(peakX, y + 3 + (seed % 2));
    context.lineTo(left + width - 6, y + 10);
    context.lineTo(left + width, y + 15);
    context.lineTo(peakX + 1, y + 15);
    context.closePath();
    context.fill();

    context.fillStyle = "#a1a59f";
    context.fillRect(peakX - 1, y + 4 + (seed % 2), 2, 4);
    if (width > 24) context.fillRect(left + 8 + (seed % 5), y + 10, 2, 2);
    context.fillStyle = "#242d38";
    context.fillRect(left + width - 9, y + 12, 4, 4);
  }
}
'''
text,count=re.subn(r'function drawWorldMountainLayer\(.*?\n\}\n\nfunction drawWorldLandmarkGround',new+'\nfunction drawWorldLandmarkGround',text,count=1,flags=re.S)
if count!=1: raise SystemExit(f'ridge replacement count={count}')
path.write_text(text)
progress=Path('PROGRESS.md');p=progress.read_text()
entry='''\n- Pass 6 ridge meta correction: replaced the remaining 16px repeated mountain cadence with a two-pass continuous rock foundation plus 2-tile-wide overlapping metapeaks.\n'''
if 'ridge meta correction' not in p: progress.write_text(p+entry)
