from pathlib import Path
import re

root = Path('.')
mode = root / 'app/rpg/RPGMode.tsx'
progress = root / 'PROGRESS.md'
text = mode.read_text()

anchor = 'type InteractionMarkerKind = "talk" | "treasure" | "danger" | "boss" | "exit";'
assert anchor in text, 'interaction marker anchor missing'

helper = r'''
function drawBossSetpieces(
  context: CanvasRenderingContext2D,
  map: MapDefinition,
  cameraX: number,
  cameraY: number,
  entries: MapDefinition["fixedEncounters"],
  frame: number,
) {
  if (map.id === "world" || map.kind === "training") return;
  const phase = frame % 8;
  for (const entry of entries) {
    const enemy = ENEMIES[entry.enemyId];
    const important = Boolean(enemy?.boss) || Boolean(entry.afterFlag) || map.id === "mirrorTower";
    if (!important) continue;
    const centerX = (entry.x - cameraX) * TILE + Math.floor(TILE / 2);
    const baseY = (entry.y - cameraY) * TILE + TILE;
    if (centerX < -TILE * 4 || centerX > VIEW_W * TILE + TILE * 4 || baseY < -TILE * 3 || baseY > VIEW_H * TILE + TILE * 3) continue;

    context.save();
    if (entry.enemyId === "prismSovereign") {
      // Final throne: a five-tile ceremonial dais with a vertical prism crown.
      context.fillStyle = "#100d18"; context.fillRect(centerX - 42, baseY - 13, 84, 26);
      context.fillStyle = "#3e3157"; context.fillRect(centerX - 38, baseY - 11, 76, 21);
      context.fillStyle = "#725d93"; context.fillRect(centerX - 33, baseY - 9, 66, 16);
      context.fillStyle = "#d0b966"; context.fillRect(centerX - 29, baseY - 7, 58, 2); context.fillRect(centerX - 29, baseY + 4, 58, 2);
      context.fillStyle = "#17121f"; context.fillRect(centerX - 11, baseY - 31, 22, 25);
      context.fillStyle = "#65517f"; context.fillRect(centerX - 8, baseY - 28, 16, 20);
      context.fillStyle = phase % 2 ? "#f0d878" : "#c9a7ff";
      context.fillRect(centerX - 2, baseY - 37, 4, 12); context.fillRect(centerX - 5, baseY - 32, 10, 3);
      context.globalAlpha = .38 + (phase % 2) * .16;
      context.fillStyle = "#b989e5"; context.fillRect(centerX - 34, baseY - 17, 3, 9); context.fillRect(centerX + 31, baseY - 17, 3, 9);
      context.fillStyle = "#f0d46f"; context.fillRect(centerX - 33, baseY - 20 - phase % 2, 1, 4); context.fillRect(centerX + 32, baseY - 20 - ((phase + 1) % 2), 1, 4);
    } else if (map.id === "crimsonMarsh") {
      // Scarlet Oracle ritual pool.
      context.globalAlpha = .86;
      context.fillStyle = "#25121d"; context.fillRect(centerX - 27, baseY - 10, 54, 18);
      context.fillStyle = "#601d35"; context.fillRect(centerX - 23, baseY - 7, 46, 12);
      context.fillStyle = phase % 2 ? "#bb3950" : "#8d2943"; context.fillRect(centerX - 18, baseY - 4, 36, 6);
      context.fillStyle = "#ef7960";
      for (const dx of [-19, 19]) { context.fillRect(centerX + dx - 1, baseY - 18, 3, 9); context.fillRect(centerX + dx, baseY - 21 - phase % 2, 1, 4); }
    } else if (map.id === "voidPass") {
      // Void gate: paired monoliths visually narrow the approach without changing collision.
      context.fillStyle = "#0d1118"; context.fillRect(centerX - 31, baseY - 30, 10, 38); context.fillRect(centerX + 21, baseY - 30, 10, 38);
      context.fillStyle = "#46525f"; context.fillRect(centerX - 28, baseY - 27, 5, 31); context.fillRect(centerX + 23, baseY - 27, 5, 31);
      context.globalAlpha = .42 + (phase % 2) * .12; context.fillStyle = "#72d6df";
      context.fillRect(centerX - 27, baseY - 22 + phase % 3, 3, 8); context.fillRect(centerX + 24, baseY - 20 - phase % 3, 3, 8);
      context.fillStyle = "#151a22"; context.fillRect(centerX - 21, baseY - 5, 42, 8);
    } else if (map.id === "mirrorTower") {
      // Mirror sanctum: broken reflective panels around the key encounter.
      context.fillStyle = "#1d2531"; context.fillRect(centerX - 28, baseY - 10, 56, 17);
      context.fillStyle = "#596b7f"; context.fillRect(centerX - 24, baseY - 8, 48, 12);
      context.fillStyle = "#a8d9dc"; context.fillRect(centerX - 18, baseY - 6, 12, 2); context.fillRect(centerX + 7, baseY - 2, 11, 2);
      context.fillStyle = phase % 2 ? "#d4bbff" : "#c4f1eb";
      context.fillRect(centerX - 24, baseY - 22, 7, 14); context.fillRect(centerX + 17, baseY - 24, 7, 16);
      context.fillRect(centerX - 22 + phase % 3, baseY - 18, 3, 1); context.fillRect(centerX + 19, baseY - 19 + phase % 3, 3, 1);
    } else if (map.id === "oldTemple") {
      // Collapsed altar and candle stubs for the ancient guardian.
      context.fillStyle = "#242923"; context.fillRect(centerX - 29, baseY - 9, 58, 17);
      context.fillStyle = "#5c6254"; context.fillRect(centerX - 25, baseY - 7, 50, 12);
      context.fillStyle = "#85856b"; context.fillRect(centerX - 13, baseY - 15, 26, 9);
      context.fillStyle = "#b7aa69"; context.fillRect(centerX - 11, baseY - 13, 22, 2);
      context.fillStyle = phase % 2 ? "#ffc967" : "#d98b42";
      context.fillRect(centerX - 22, baseY - 16, 2, 6); context.fillRect(centerX + 20, baseY - 16, 2, 6);
    } else if (map.id === "ironCity") {
      // Iron throne platform for the ruler encounter.
      context.fillStyle = "#22282e"; context.fillRect(centerX - 27, baseY - 9, 54, 17);
      context.fillStyle = "#69737a"; context.fillRect(centerX - 23, baseY - 7, 46, 12);
      context.fillStyle = "#b69554"; context.fillRect(centerX - 19, baseY - 5, 38, 2);
      context.fillStyle = "#343b43"; context.fillRect(centerX - 8, baseY - 25, 16, 18);
      context.fillStyle = phase % 2 ? "#e2c879" : "#aeb8b7"; context.fillRect(centerX - 4, baseY - 22, 8, 3);
    } else {
      context.fillStyle = "#17151b"; context.fillRect(centerX - 24, baseY - 8, 48, 15);
      context.fillStyle = "#6b606d"; context.fillRect(centerX - 20, baseY - 6, 40, 10);
      context.fillStyle = "#c5aa68"; context.fillRect(centerX - 14, baseY - 4, 28, 2);
    }
    context.restore();
  }
}

'''
text = text.replace(anchor, helper + anchor, 1)

# Place setpieces after the ambient layer and before portals/chests/entities so actors remain foregrounded.
pattern = re.compile(r'(\n\s*drawDungeonAmbient\(context, map, cameraX, cameraY, dungeonLifeFrame, save\.position\);)')
match = pattern.search(text)
assert match, 'drawDungeonAmbient call missing'
replacement = match.group(1) + '\n    drawBossSetpieces(context, map, cameraX, cameraY, map.fixedEncounters.filter((entry) => hasFlag(save, entry.requireFlag)), dungeonLifeFrame);'
text = text[:match.start()] + replacement + text[match.end():]

mode.write_text(text)

section = '''\n## SFC Visual Reconstruction Pass 31 — Boss rooms and setpieces\n- Rebuilt important fixed-encounter locations as presentation-only setpieces around their existing map coordinates, leaving collision and encounter data untouched.\n- Added a collapsed altar for Old Temple, a ritual pool for Crimson Marsh, reflective sanctum panels for Mirror Tower, paired void monoliths for Void Pass and an iron throne platform for Iron City.\n- Reconstructed the Prism Sovereign approach as a five-tile ceremonial throne dais with a pulsing prism crown and flanking lights, while preserving the existing final-boss coordinate and progression flag.\n- Setpiece animation reuses the low-frequency dungeon ambience frame and remains behind actors, enemies, chests and interaction markers.\n- Boss conditions, enemy IDs, rewards, map topology, portal destinations, save data and Chapter Battle remain unchanged.\n'''
with progress.open('a') as fh:
    fh.write(section)
