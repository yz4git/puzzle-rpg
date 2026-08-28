from pathlib import Path

path = Path('app/rpg/RPGMode.tsx')
text = path.read_text()

anchor = 'function drawGroundMacro(context: CanvasRenderingContext2D, map: MapDefinition, code: string, worldX: number, worldY: number, x: number, y: number) {'
if 'function drawWorldDangerMass(' not in text:
    if anchor not in text:
        raise SystemExit('danger mass anchor not found')
    block = r'''
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
}

'''
    text = text.replace(anchor, block + anchor, 1)

route_call = '      drawWorldRoute(context, map, code, worldX, worldY, viewX * TILE, viewY * TILE);'
if 'drawWorldDangerMass(context, map, code, worldX, worldY' not in text:
    if route_call not in text:
        raise SystemExit('route call not found')
    text = text.replace(route_call, route_call + '\n      drawWorldDangerMass(context, map, code, worldX, worldY, viewX * TILE, viewY * TILE);', 1)

old_seal = '''  if (locked) drawWorldSeal(context, x + 12, y - 6);\n  context.restore();\n}\n\nfunction drawWorldLandmarkGround'''
new_seal = '''  context.restore();\n  if (locked) drawWorldSeal(context, x + 12, y - 6);\n}\n\nfunction drawWorldLandmarkGround'''
if old_seal not in text:
    raise SystemExit('seal order anchor not found')
text = text.replace(old_seal, new_seal, 1)
path.write_text(text)

progress = Path('PROGRESS.md')
p = progress.read_text()
line = '- Pass 7 audit correction: dense danger blocks now render as continuous corruption fields; locked major landmarks keep an opaque seal marker.'
if line not in p:
    progress.write_text(p.rstrip() + '\n' + line + '\n')
