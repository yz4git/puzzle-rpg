from pathlib import Path
import re

path = Path('app/rpg/RPGMode.tsx')
text = path.read_text()

helper = r'''
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
'''

if 'function drawWorldLandmark(' not in text:
    marker = 'function drawTerrainEdge('
    if marker not in text:
        raise SystemExit('terrain edge marker not found')
    text = text.replace(marker, helper + '\n' + marker, 1)

pattern = re.compile(r'''    map\.portals\.forEach\(\(portal, portalIndex\) => \{\n.*?\n    \}\);\n    for \(const chest''', re.S)
replacement = '''    map.portals.forEach((portal, portalIndex) => {
      const x = (portal.x - cameraX) * TILE, y = (portal.y - cameraY) * TILE;
      if (x < -TILE || y < -TILE || x >= VIEW_W * TILE || y >= VIEW_H * TILE) return;
      const locked = Boolean(portal.requireFlag && !hasFlag(save, portal.requireFlag));
      if (map.id === "world") {
        drawWorldLandmark(context, portal.targetMap, x, y, locked);
        return;
      }
      const atlas = atlasImages.current.field;
      if (atlas?.complete && atlas.naturalWidth) {
        context.globalAlpha = locked ? .42 : 1;
        context.drawImage(atlas, (portalIndex % 10) * 64, 9 * 64, 64, 64, x - 6, y - 12, 28, 28);
        context.globalAlpha = 1;
      } else {
        context.fillStyle = locked ? "#55515d" : "#ffe060";
        context.fillRect(x + 3, y + 4, 10, 9); context.fillStyle = "#11111a"; context.fillRect(x + 6, y + 8, 4, 5);
      }
    });
    for (const chest'''
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit(f'portal block replacement count={count}')

path.write_text(text)

progress = Path('PROGRESS.md')
p = progress.read_text() if progress.exists() else ''
entry = '''\n## SFC Visual Reconstruction Pass 4 — Landmark correction\n- Identified the apparent legacy roads as oversized portal-atlas landmark cells, not terrain.\n- Replaced world-map portal atlas cells with compact target-specific pixel landmarks so roads and destinations read as separate layers.\n- Preserved existing portal collision, progression gates and non-world portal rendering.\n'''
if 'Landmark correction' not in p:
    progress.write_text(p + entry)
