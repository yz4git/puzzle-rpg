from pathlib import Path

path = Path('app/rpg/RPGMode.tsx')
s = path.read_text()

old = 'const macro = stableVisualIndex(`interior-macro-${map.id}`, Math.floor(worldX / 2), Math.floor(worldY / 2));'
new = 'const macro = stableVisualIndex(`interior-macro-${map.id}`, Math.floor(worldX / 4), Math.floor(worldY / 3));'
if old not in s:
    raise SystemExit('interior macro anchor not found')
s = s.replace(old, new, 1)

old = '''  context.fillStyle = palette.wallLight;
  context.fillRect(x + 1, y + 2, 14, 2);
  context.fillRect(x + (seed % 7), y + 8, 6, 2);
  context.fillStyle = palette.line;
  context.fillRect(x, y + 14, TILE, 2);
  context.fillRect(x + 7, y + 4, 1, 4);
  if (tileAt(map, worldX, worldY + 1) !== "#" && tileAt(map, worldX, worldY + 1) !== "m") {
    context.fillStyle = palette.accent2; context.fillRect(x + 2, y + 13, 12, 1);
  }
'''
new = '''  const belowWall = ["#", "m"].includes(tileAt(map, worldX, worldY + 1));
  context.fillStyle = palette.wallLight;
  if (seed % 2 === 0) context.fillRect(x + 1, y + 2, 14, 1);
  if (seed % 3 === 0) context.fillRect(x + 2 + seed % 5, y + 8, 6, 1);
  context.fillStyle = palette.line;
  if (!belowWall) context.fillRect(x, y + 14, TILE, 2);
  else if (seed % 5 === 0) context.fillRect(x + 3 + seed % 6, y + 13, 4, 1);
  if (seed % 4 === 0) context.fillRect(x + 7, y + 4, 1, 4);
  if (!belowWall) {
    context.fillStyle = palette.accent2; context.fillRect(x + 2, y + 13, 12, 1);
  }
'''
if old not in s:
    raise SystemExit('wall reconstruction anchor not found')
s = s.replace(old, new, 1)

old = '''    if (code === "s") {
      if ((worldX % 2 === 0) && (worldY % 2 === 0)) {
'''
new = '''    if (code === "s") {
      const rigidSurface = ["ironCity", "ironHall", "mirrorTower", "hourSpire", "prismCitadel"].includes(map.id);
      if (rigidSurface && (worldX % 3 === 0) && (worldY % 3 === 0)) {
'''
if old not in s:
    raise SystemExit('structural floor anchor not found')
s = s.replace(old, new, 1)

old = '''  context.fillStyle = palette.floor; context.fillRect(x, y, TILE, TILE);
  context.fillStyle = map.id === "crimsonMarsh" ? "#5f1738" : map.id === "prismCitadel" ? "#4e4270" : "#2a2538";
  context.fillRect(x + 2, y + 2, 12, 12);
  context.fillStyle = palette.accent; context.fillRect(x + 4 + seed % 5, y + 4, 4, 2);
  context.fillStyle = palette.accent2; if (seed % 2 === 0) context.fillRect(x + 9, y + 10, 2, 2);
'''
new = '''  context.fillStyle = palette.floor; context.fillRect(x, y, TILE, TILE);
  if (map.id === "crimsonMarsh") {
    // Organic pools bleed across gameplay-cell edges. Collision still follows
    // the original map, but the picture no longer advertises a tile grid.
    context.fillStyle = seed % 2 === 0 ? "#5f1738" : "#54152f";
    context.beginPath();
    context.moveTo(x - 2, y + 5 + seed % 3);
    context.lineTo(x + 4, y + 1);
    context.lineTo(x + 13, y + 3 + ((seed >> 2) % 3));
    context.lineTo(x + 18, y + 8);
    context.lineTo(x + 11, y + 15);
    context.lineTo(x + 2, y + 13);
    context.closePath(); context.fill();
    context.fillStyle = palette.accent;
    context.fillRect(x + 3 + seed % 6, y + 5, 5, 1);
    context.fillStyle = palette.accent2;
    if (seed % 3 === 0) context.fillRect(x + 10, y + 10, 2, 2);
    return;
  }
  context.fillStyle = map.id === "prismCitadel" ? "#4e4270" : "#2a2538";
  context.fillRect(x + 2, y + 2, 12, 12);
  context.fillStyle = palette.accent; context.fillRect(x + 4 + seed % 5, y + 4, 4, 2);
  context.fillStyle = palette.accent2; if (seed % 2 === 0) context.fillRect(x + 9, y + 10, 2, 2);
'''
if old not in s:
    raise SystemExit('hazard reconstruction anchor not found')
s = s.replace(old, new, 1)
path.write_text(s)
