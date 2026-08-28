from pathlib import Path

path = Path('app/rpg/RPGMode.tsx')
text = path.read_text()
old = '''function drawAtlasSpan(context: CanvasRenderingContext2D, image: HTMLImageElement, cell: AtlasCell, x: number, y: number, drawWidth: number, drawHeight: number) {
  const { width, height } = RPG_ATLAS_METRICS.terrain;
  const inset = 2;
  context.drawImage(image, cell.col * width + inset, cell.row * height + inset, width - inset * 2, height - inset * 2, x, y, drawWidth, drawHeight);
}
'''
new = '''function drawAtlasSpan(context: CanvasRenderingContext2D, image: HTMLImageElement, cell: AtlasCell, x: number, y: number, drawWidth: number, drawHeight: number, cropBottom = 0) {
  const { width, height } = RPG_ATLAS_METRICS.terrain;
  const inset = 2;
  const sourceHeight = height - inset * 2 - cropBottom;
  context.drawImage(image, cell.col * width + inset, cell.row * height + inset, width - inset * 2, sourceHeight, x, y, drawWidth, drawHeight);
}
'''
if old not in text:
    raise SystemExit('drawAtlasSpan target not found')
text = text.replace(old, new, 1)
old_dense = '''  const dense: AtlasCell[] = [
    { atlas: "field", col: 6, row: 0 }, { atlas: "field", col: 7, row: 0 },
    { atlas: "field", col: 0, row: 1 }, { atlas: "field", col: 1, row: 1 },
  ];'''
new_dense = '''  const dense: AtlasCell[] = [
    // Interior canopy cells deliberately avoid the trunk-heavy variants.
    { atlas: "field", col: 6, row: 0 },
    { atlas: "field", col: 0, row: 1 },
  ];'''
if old_dense not in text:
    raise SystemExit('dense target not found')
text = text.replace(old_dense, new_dense, 1)
old_call = '''        drawAtlasSpan(context, image, dense[seed % dense.length]!, viewX * TILE - 1, viewY * TILE - 1, TILE * 2 + 2, TILE * 2 + 2);'''
new_call = '''        // Crop the dark trunk/shadow band from the source tile so a 32px forest
        // block reads as continuous canopy instead of a row of enlarged tree bases.
        drawAtlasSpan(context, image, dense[seed % dense.length]!, viewX * TILE - 1, viewY * TILE - 1, TILE * 2 + 2, TILE * 2 + 2, 10);'''
if old_call not in text:
    raise SystemExit('forest span call target not found')
text = text.replace(old_call, new_call, 1)
path.write_text(text)

progress = Path('PROGRESS.md')
progress.write_text(progress.read_text() + '\n- SFC Visual Reconstruction Pass 5: cropped trunk-heavy lower source area from 2x2 interior forest metatiles and restricted dense variants to canopy-first cells.\n')
