from pathlib import Path

path = Path('app/rpg/RPGMode.tsx')
text = path.read_text()
old_marker = '''function drawTalkMarker(context: CanvasRenderingContext2D, x: number, y: number) {
  context.save();
  context.fillStyle = "#111017"; context.fillRect(x + 7, y - 24, 10, 11);
  context.fillStyle = "#f1d06a"; context.fillRect(x + 8, y - 23, 8, 9);
  context.fillStyle = "#231c21"; context.fillRect(x + 11, y - 21, 2, 4); context.fillRect(x + 11, y - 16, 2, 2);
  context.fillStyle = "#f1d06a"; context.fillRect(x + 10, y - 13, 4, 2);
  context.restore();
}
'''
new_marker = '''type InteractionMarkerKind = "talk" | "treasure" | "danger" | "exit";

function drawInteractionMarker(context: CanvasRenderingContext2D, x: number, y: number, kind: InteractionMarkerKind) {
  const accent = kind === "danger" ? "#ff6a66" : kind === "treasure" ? "#ffd765" : kind === "exit" ? "#7ee8ef" : "#f1d06a";
  context.save();
  context.fillStyle = "#0a0910"; context.fillRect(x + 7, y - 22, 8, 9);
  context.fillStyle = accent; context.fillRect(x + 8, y - 21, 6, 7);
  context.fillStyle = "#201b22";
  if (kind === "talk") {
    context.fillRect(x + 10, y - 19, 2, 1); context.fillRect(x + 9, y - 18, 1, 4); context.fillRect(x + 12, y - 18, 1, 4); context.fillRect(x + 10, y - 17, 2, 1);
  } else if (kind === "treasure") {
    context.fillRect(x + 10, y - 19, 2, 4); context.fillRect(x + 9, y - 18, 4, 2);
  } else if (kind === "danger") {
    context.fillRect(x + 10, y - 20, 2, 4); context.fillRect(x + 10, y - 15, 2, 1);
  } else {
    context.fillRect(x + 10, y - 20, 2, 4); context.fillRect(x + 9, y - 17, 4, 1); context.fillRect(x + 10, y - 16, 2, 1);
  }
  context.fillStyle = accent; context.fillRect(x + 10, y - 13, 2, 2);
  context.restore();
}
'''
if old_marker not in text:
    raise SystemExit('marker function not found')
text = text.replace(old_marker, new_marker, 1)
old_inline = '''      const delta = DIR_DELTA[save.direction];
      if (npc.x === save.position.x + delta.x && npc.y === save.position.y + delta.y) drawTalkMarker(context, x, y);
'''
if old_inline not in text:
    raise SystemExit('inline marker not found')
text = text.replace(old_inline, '', 1)
old_tail = '''    drawInteriorForeground(context, map, cameraX, cameraY);
    context.setTransform(1, 0, 0, 1, 0, 0);
'''
new_tail = '''    drawInteriorForeground(context, map, cameraX, cameraY);

    // Interaction glyphs are intentionally rendered last. Large SNES-style actors
    // can overlap adjacent tiles, so drawing these inside an NPC loop allowed the
    // hero to hide the cue even though interaction still worked.
    const frontDelta = DIR_DELTA[save.direction];
    const frontPosition = { x: save.position.x + frontDelta.x, y: save.position.y + frontDelta.y };
    const frontNpc = mapNpcs.find((npc) => npc.x === frontPosition.x && npc.y === frontPosition.y);
    const frontChest = map.chests.find((chest) => chest.x === frontPosition.x && chest.y === frontPosition.y && !save.openedChests.includes(chest.id) && hasFlag(save, chest.requireFlag));
    const frontFixed = visibleFixed.find((entry) => entry.x === frontPosition.x && entry.y === frontPosition.y);
    const frontPortal = map.portals.find((portal) => portal.x === frontPosition.x && portal.y === frontPosition.y);
    const markerTarget = frontNpc ?? frontChest ?? frontFixed ?? frontPortal;
    if (markerTarget) {
      const markerX = (markerTarget.x - cameraX) * TILE;
      const markerY = (markerTarget.y - cameraY) * TILE;
      const markerKind: InteractionMarkerKind = frontNpc ? "talk" : frontChest ? "treasure" : frontFixed ? "danger" : "exit";
      drawInteractionMarker(context, markerX, markerY, markerKind);
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
'''
if old_tail not in text:
    raise SystemExit('render tail not found')
text = text.replace(old_tail, new_tail, 1)
path.write_text(text)

progress = Path('PROGRESS.md')
p = progress.read_text()
section = '''\n\n## SFC Visual Reconstruction Pass 10 — Interaction clarity\n- Moved interaction glyphs to the final canvas layer so large hero/NPC sprites cannot hide them.\n- Reduced the marker footprint and added contextual front-tile glyphs for TALK, treasure, fixed encounters and exits.\n- Interaction rules, collision, map data, progression and save format are unchanged.\n'''
if '## SFC Visual Reconstruction Pass 10' not in p:
    progress.write_text(p.rstrip() + section + '\n')
