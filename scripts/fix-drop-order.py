from pathlib import Path

GAME = Path('app/PuzzleRPGGame.tsx')
CSS = Path('app/PuzzleRPGGame.module.css')

game = GAME.read_text()
css = CSS.read_text()

anchor = 'type SwapMotion = { a: Coord; b: Coord } | null;\n'
insert = '''type SwapMotion = { a: Coord; b: Coord } | null;\ntype DropSprite = {\n  id: string;\n  orb: Orb;\n  col: number;\n  fromRow: number;\n  toRow: number;\n};\n'''
assert anchor in game
game = game.replace(anchor, insert, 1)

anchor = '''function cellKey(row: number, col: number): string {\n  return `${row}:${col}`;\n}\n'''
insert = '''function cellKey(row: number, col: number): string {\n  return `${row}:${col}`;\n}\n\nfunction buildDropVisuals(frame: CascadeFrame): { sprites: DropSprite[]; hiddenCells: Set<string> } {\n  const sprites: DropSprite[] = [];\n  const hiddenCells = new Set<string>(frame.matches);\n\n  for (let col = 0; col < SIZE; col += 1) {\n    const survivorRows: number[] = [];\n    for (let row = 0; row < SIZE; row += 1) {\n      if (!frame.matches.has(cellKey(row, col))) survivorRows.push(row);\n    }\n\n    const holes = SIZE - survivorRows.length;\n    survivorRows.forEach((fromRow, index) => {\n      const toRow = holes + index;\n      if (fromRow === toRow) return;\n      hiddenCells.add(cellKey(fromRow, col));\n      sprites.push({\n        id: `survivor-${col}-${fromRow}-${toRow}`,\n        orb: frame.boardBefore[fromRow]![col]!,\n        col,\n        fromRow,\n        toRow,\n      });\n    });\n\n    for (let toRow = 0; toRow < holes; toRow += 1) {\n      sprites.push({\n        id: `incoming-${col}-${toRow}`,\n        orb: frame.boardAfter[toRow]![col]!,\n        col,\n        fromRow: toRow - holes,\n        toRow,\n      });\n    }\n  }\n\n  return { sprites, hiddenCells };\n}\n'''
assert anchor in game
game = game.replace(anchor, insert, 1)

old = '''  const [swapMotion, setSwapMotion] = useState<SwapMotion>(null);\n  const [dropMotion, setDropMotion] = useState<Map<string, number>>(new Map());\n'''
new = '''  const [swapMotion, setSwapMotion] = useState<SwapMotion>(null);\n  const [dropSprites, setDropSprites] = useState<DropSprite[]>([]);\n  const [dropHiddenCells, setDropHiddenCells] = useState<Set<string>>(new Set());\n'''
assert old in game
game = game.replace(old, new, 1)

old = '''    setSwapMotion(null);\n    setDropMotion(new Map());\n    setStageIntro(true);\n'''
new = '''    setSwapMotion(null);\n    setDropSprites([]);\n    setDropHiddenCells(new Set());\n    setStageIntro(true);\n'''
assert old in game
game = game.replace(old, new, 1)

old = '''      setClearingCells(new Set());\n      setDropMotion(computeDropDistances(frame.matches));\n      setBoard(frame.boardAfter);\n      setColumnQueues(frame.queuesAfter);\n      setResolutionPhase("drop");\n      playSfx("drop");\n      await delay(245);\n      setDropMotion(new Map());\n'''
new = '''      // Do not commit the final board before the fall. Keep the cleared holes\n      // visually empty and animate the actual surviving/incoming orb identities\n      // into their destinations. Only after they land do board + NEXT advance.\n      const dropVisuals = buildDropVisuals(frame);\n      setDropHiddenCells(dropVisuals.hiddenCells);\n      setDropSprites(dropVisuals.sprites);\n      setClearingCells(new Set());\n      setResolutionPhase("drop");\n      await nextPaint();\n      playSfx("drop");\n      await delay(245);\n\n      setBoard(frame.boardAfter);\n      setColumnQueues(frame.queuesAfter);\n      setDropHiddenCells(new Set());\n      await nextPaint();\n      setDropSprites([]);\n'''
assert old in game
game = game.replace(old, new, 1)

old = '''              const swapClass = swapClassFor(rowIndex, colIndex);\n              const dropDistance = dropMotion.get(key) ?? 0;\n              const dropClass = dropDistance > 0 ? styles[`drop${dropDistance}`] : "";\n              return (\n                <button\n                  key={`${rowIndex}-${colIndex}`}\n                  type="button"\n                  className={`${styles.tile} ${styles[orb]} ${isSelected ? styles.selected : ""} ${isAdjacentChoice ? styles.adjacentChoice : ""} ${setupHint ? styles.setupHint : ""} ${isClearing ? styles.clearing : ""} ${swapClass} ${dropClass}`}\n'''
new = '''              const swapClass = swapClassFor(rowIndex, colIndex);\n              const isDropHidden = dropHiddenCells.has(key);\n              return (\n                <button\n                  key={`${rowIndex}-${colIndex}`}\n                  type="button"\n                  className={`${styles.tile} ${styles[orb]} ${isSelected ? styles.selected : ""} ${isAdjacentChoice ? styles.adjacentChoice : ""} ${setupHint ? styles.setupHint : ""} ${isClearing ? styles.clearing : ""} ${swapClass} ${isDropHidden ? styles.dropHidden : ""}`}\n'''
assert old in game
game = game.replace(old, new, 1)

anchor = '''          </div>\n\n          {combo >= 2 ? <div className={styles.combo} key={`combo-${combo}`}>{combo} COMBO!</div> : null}\n'''
insert = '''          </div>\n\n          {dropSprites.length > 0 ? (\n            <div className={styles.dropLayer} aria-hidden="true">\n              {dropSprites.map((sprite) => (\n                <div\n                  key={sprite.id}\n                  className={`${styles.tile} ${styles.dropSprite} ${styles[sprite.orb]}`}\n                  style={{\n                    gridColumn: sprite.col + 1,\n                    gridRow: sprite.toRow + 1,\n                    "--drop-offset": `${-(sprite.toRow - sprite.fromRow) * 108}%`,\n                  } as CSSProperties}\n                >\n                  <img\n                    className={styles.tileIcon}\n                    src={PIXEL_ART_ASSETS.orbs[sprite.orb]}\n                    alt=""\n                    draggable={false}\n                  />\n                </div>\n              ))}\n            </div>\n          ) : null}\n\n          {combo >= 2 ? <div className={styles.combo} key={`combo-${combo}`}>{combo} COMBO!</div> : null}\n'''
assert anchor in game
game = game.replace(anchor, insert, 1)

# Remove obsolete per-cell drop animation definitions, then add identity-preserving overlay.
old_css = '''.drop1 { animation:drop1 .245s cubic-bezier(.12,.72,.2,1.12); } .drop2 { animation:drop2 .245s cubic-bezier(.12,.72,.2,1.12); } .drop3 { animation:drop3 .245s cubic-bezier(.12,.72,.2,1.12); } .drop4 { animation:drop4 .245s cubic-bezier(.12,.72,.2,1.12); } .drop5 { animation:drop5 .245s cubic-bezier(.12,.72,.2,1.12); } .drop6 { animation:drop6 .245s cubic-bezier(.12,.72,.2,1.12); }\n@keyframes drop1 { from { transform:translateY(-108%); } } @keyframes drop2 { from { transform:translateY(-216%); } } @keyframes drop3 { from { transform:translateY(-324%); } } @keyframes drop4 { from { transform:translateY(-432%); } } @keyframes drop5 { from { transform:translateY(-540%); } } @keyframes drop6 { from { transform:translateY(-648%); } }\n'''
new_css = '''.dropHidden { visibility: hidden; }\n.dropLayer {\n  position: absolute;\n  z-index: 7;\n  inset: 0;\n  display: grid;\n  grid-template-columns: repeat(6, 1fr);\n  grid-template-rows: repeat(6, 1fr);\n  gap: var(--board-gap);\n  padding: var(--board-pad);\n  pointer-events: none;\n  overflow: visible;\n}\n.dropSprite {\n  min-width: 0;\n  min-height: 0;\n  z-index: 7;\n  animation: dropSpriteLand .245s cubic-bezier(.12,.72,.2,1.05) both;\n  will-change: transform;\n}\n@keyframes dropSpriteLand {\n  from { transform: translateY(var(--drop-offset)); }\n  to { transform: translateY(0); }\n}\n'''
assert old_css in css
css = css.replace(old_css, new_css, 1)

GAME.write_text(game)
CSS.write_text(css)
print('drop ordering fixed with identity-preserving overlay')
