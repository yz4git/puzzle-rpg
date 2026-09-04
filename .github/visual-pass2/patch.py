from pathlib import Path

mode_path = Path('app/rpg/RPGMode.tsx')
s = mode_path.read_text()

anchor = '''function drawGroundMacro(context: CanvasRenderingContext2D, map: MapDefinition, code: string, worldX: number, worldY: number, x: number, y: number) {
'''
insert = '''function drawWorldGrassBase(context: CanvasRenderingContext2D, map: MapDefinition, worldX: number, worldY: number, x: number, y: number) {
  if (map.id !== "world") return false;
  // World grass is painted procedurally instead of stamping the 64px terrain atlas
  // into every 16px gameplay cell. Broad 5x4-cell zones share one hue, so the
  // collision grid remains exact while the picture reads as continuous country.
  const macro = stableVisualIndex("grass-region", Math.floor(worldX / 5), Math.floor(worldY / 4));
  const base = macro % 4 === 0 ? "#5f9845" : macro % 4 === 1 ? "#629b47" : macro % 4 === 2 ? "#589240" : "#669d49";
  context.fillStyle = base;
  context.fillRect(x, y, TILE, TILE);
  const seed = stableVisualIndex("grass-grain", worldX, worldY);
  if (seed % 7 === 0) {
    context.fillStyle = "#4b8339";
    context.fillRect(x + 2 + seed % 9, y + 3 + (seed >> 3) % 9, 3, 1);
  }
  if (seed % 13 === 0) {
    context.fillStyle = "#8ab657";
    context.fillRect(x + 5 + seed % 5, y + 9 + (seed >> 4) % 4, 1, 2);
    context.fillRect(x + 6 + seed % 5, y + 10 + (seed >> 4) % 4, 1, 1);
  }
  if (seed % 29 === 0) {
    context.fillStyle = "#d2c85d";
    context.fillRect(x + 3 + seed % 8, y + 5 + (seed >> 5) % 7, 1, 1);
  }
  return true;
}

'''
if anchor not in s:
    raise SystemExit('ground macro anchor not found')
s = s.replace(anchor, insert + anchor, 1)

old = '''  const macro = stableVisualIndex("ground-macro", Math.floor(worldX / 3), Math.floor(worldY / 3));
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
'''
new = '''  const macro = stableVisualIndex("ground-macro", Math.floor(worldX / 5), Math.floor(worldY / 4));
  context.save();
  // A very soft regional wash ties neighbouring cells together without drawing
  // a second visible checkerboard. Atlas repetition has already been removed by
  // drawWorldGrassBase, so this pass only creates slow meadow variation.
  context.globalAlpha = .07;
  context.fillStyle = macro % 3 === 0 ? "#e3d86e" : macro % 3 === 1 ? "#1f5a32" : "#9dbc5c";
  context.fillRect(x - 1, y - 1, TILE + 2, TILE + 2);
  context.globalAlpha = 1;
  const seed = stableVisualIndex("ground-detail", worldX, worldY);
  if (seed % 17 === 0) {
    context.fillStyle = "#2d6f37";
    context.fillRect(x + 3 + seed % 8, y + 5 + (seed >> 3) % 6, 1, 2);
    context.fillStyle = "#8ac35e";
    context.fillRect(x + 4 + seed % 8, y + 5 + (seed >> 3) % 6, 1, 1);
  }
  context.restore();
'''
if old not in s:
    raise SystemExit('ground macro body anchor not found')
s = s.replace(old, new, 1)

old = '''      const cell = terrainAtlasCell(map, baseCode, worldX, worldY);
      const atlas = atlasImages.current[cell.atlas];
      if (atlas?.complete && atlas.naturalWidth) drawAtlasTile(context, atlas, cell, viewX * TILE, viewY * TILE);
      else drawTile(context, baseCode, viewX * TILE, viewY * TILE, worldX, worldY);
'''
new = '''      const drawX = viewX * TILE, drawY = viewY * TILE;
      if (map.id === "world" && baseCode === "g") {
        drawWorldGrassBase(context, map, worldX, worldY, drawX, drawY);
      } else {
        const cell = terrainAtlasCell(map, baseCode, worldX, worldY);
        const atlas = atlasImages.current[cell.atlas];
        if (atlas?.complete && atlas.naturalWidth) drawAtlasTile(context, atlas, cell, drawX, drawY);
        else drawTile(context, baseCode, drawX, drawY, worldX, worldY);
      }
'''
if old not in s:
    raise SystemExit('base terrain loop anchor not found')
s = s.replace(old, new, 1)
mode_path.write_text(s)

script_path = Path('scripts/live-playcheck.mjs')
s = script_path.read_text()
old = '''  await tap(page, /A\\s*CHECK/i);
  await page.waitForTimeout(650);
  let win = await openCommand(page);
  await win.locator('button').filter({ hasText: 'ITEM' }).first().tap({ force: true });
'''
new = '''  await tap(page, /A\\s*CHECK/i);
  // Fixed encounters can spend a short moment in the encounter cue before the
  // battle root mounts. Wait for the real battle instead of assuming 650ms is enough.
  let itemBattleReady = false;
  for (let attempt = 0; attempt < 3 && !itemBattleReady; attempt += 1) {
    itemBattleReady = await page.locator('main[data-enemy]').waitFor({ state: 'visible', timeout: 1600 }).then(() => true).catch(() => false);
    if (!itemBattleReady) {
      await tap(page, /A\\s*CHECK/i);
      await page.waitForTimeout(280);
    }
  }
  assert('Item route opens FOREST WISP battle', itemBattleReady && /FOREST WISP/i.test(await bodyText(page)));
  let win = null;
  for (let attempt = 0; attempt < 3 && !win; attempt += 1) {
    win = await openCommand(page);
    if (!win) await page.waitForTimeout(360);
  }
  if (!win) throw new Error('RPG COMMAND did not become available in item route');
  await win.locator('button').filter({ hasText: 'ITEM' }).first().tap({ force: true });
'''
if old not in s:
    raise SystemExit('item route anchor not found')
s = s.replace(old, new, 1)
script_path.write_text(s)
