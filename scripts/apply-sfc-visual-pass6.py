from pathlib import Path

path = Path('app/rpg/RPGMode.tsx')
text = path.read_text()

marker = '\nfunction drawWorldLandmark(context: CanvasRenderingContext2D, targetMap: string, x: number, y: number, locked: boolean) {'
if marker not in text:
    raise SystemExit('world landmark marker not found')

helpers = r'''

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

function drawWorldMountainLayer(context: CanvasRenderingContext2D, map: MapDefinition, cameraX: number, cameraY: number) {
  if (map.id !== "world") return;
  for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
    const worldX = cameraX + viewX, worldY = cameraY + viewY;
    if (tileAt(map, worldX, worldY) !== "m") continue;
    const x = viewX * TILE, y = viewY * TILE;
    const seed = stableVisualIndex("world-ridge", worldX, worldY);
    const up = tileAt(map, worldX, worldY - 1) === "m";
    const right = tileAt(map, worldX + 1, worldY) === "m";
    const down = tileAt(map, worldX, worldY + 1) === "m";
    const left = tileAt(map, worldX - 1, worldY) === "m";

    context.fillStyle = "#343b49";
    context.fillRect(x, y, TILE, TILE);
    if (!up) {
      const p1 = 3 + (seed % 3), p2 = 11 + ((seed >> 3) % 3);
      context.fillStyle = "#66717a";
      context.beginPath();
      context.moveTo(x, y + 9);
      context.lineTo(x + p1, y + 2);
      context.lineTo(x + 8, y + 7);
      context.lineTo(x + p2, y + 1);
      context.lineTo(x + TILE, y + 8);
      context.lineTo(x + TILE, y + TILE);
      context.lineTo(x, y + TILE);
      context.closePath();
      context.fill();
      context.fillStyle = "#9aa09d";
      context.fillRect(x + p1, y + 3, 1, 4);
      context.fillRect(x + p2, y + 2, 1, 5);
    } else {
      context.fillStyle = seed % 2 ? "#46505c" : "#414a56";
      context.fillRect(x + 2 + (seed % 5), y + 2, 5, 8);
    }
    if (!down) {
      context.fillStyle = "#202733";
      context.fillRect(x, y + 12, TILE, 4);
      context.fillStyle = "#4e5661";
      context.fillRect(x + 2, y + 12, TILE - 4, 1);
      context.fillStyle = "#151b25";
      context.fillRect(x + 5 + (seed % 6), y + 13, 1, 3);
    }
    context.fillStyle = "#202733";
    if (!left) context.fillRect(x, y + 5, 2, 11);
    if (!right) context.fillRect(x + TILE - 2, y + 5, 2, 11);
  }
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
'''

if 'function drawWorldWaterLayer(' not in text:
    text = text.replace(marker, helpers + marker, 1)

old_water = '  if (code === "w") {\n'
new_water = '  if (code === "w" && map.id !== "world") {\n'
if old_water not in text:
    raise SystemExit('terrain water edge block not found')
text = text.replace(old_water, new_water, 1)

old_base = '      const baseCode = map.id === "world" && (code === "r" || code === "d" || code === "f") ? "g" : code;'
new_base = '      const baseCode = map.id === "world" && (code === "r" || code === "d" || code === "f" || code === "w" || code === "m") ? "g" : code;'
if old_base not in text:
    raise SystemExit('baseCode target not found')
text = text.replace(old_base, new_base, 1)

old_layer = '''    // Forest is composited as greedy 2x2 metatiles over a grass foundation.\n    // Edge cells remain single-tree illustrations for a readable silhouette.\n    const fieldAtlas = atlasImages.current.field;\n    if (fieldAtlas?.complete && fieldAtlas.naturalWidth) drawWorldForestLayer(context, fieldAtlas, map, cameraX, cameraY);\n'''
new_layer = '''    // World water and mountains are reconstructed as continuous terrain masses\n    // before the forest canopy and route overlays are added.\n    drawWorldWaterLayer(context, map, cameraX, cameraY);\n    drawWorldMountainLayer(context, map, cameraX, cameraY);\n\n    // Forest is composited as greedy 2x2 metatiles over a grass foundation.\n    // Edge cells remain single-tree illustrations for a readable silhouette.\n    const fieldAtlas = atlasImages.current.field;\n    if (fieldAtlas?.complete && fieldAtlas.naturalWidth) drawWorldForestLayer(context, fieldAtlas, map, cameraX, cameraY);\n'''
if old_layer not in text:
    raise SystemExit('forest layer target not found')
text = text.replace(old_layer, new_layer, 1)

old_portal = '''      if (map.id === "world") {\n        drawWorldLandmark(context, portal.targetMap, x, y, locked);\n        return;\n      }'''
new_portal = '''      if (map.id === "world") {\n        drawWorldLandmarkGround(context, portal.targetMap, x, y, locked);\n        drawWorldLandmark(context, portal.targetMap, x, y, locked);\n        return;\n      }'''
if old_portal not in text:
    raise SystemExit('world portal target not found')
text = text.replace(old_portal, new_portal, 1)

path.write_text(text)

progress = Path('PROGRESS.md')
p = progress.read_text() if progress.exists() else ''
entry = '''\n## SFC Visual Reconstruction Pass 6 — Water / ridge / landmark ground\n- Reconstructed world lake and river tiles as one continuous procedural 16-bit water surface with bridge-aware shorelines.\n- Reconstructed mountain tiles into connected ridgelines and cliff faces instead of isolated atlas cards.\n- Added destination-specific landmark ground footprints/plazas so towns, schools, dungeons and the citadel visually connect to the road network.\n- Map collision, encounters, portals and progression data are unchanged.\n'''
if 'Pass 6 — Water / ridge / landmark ground' not in p:
    progress.write_text(p + entry)
