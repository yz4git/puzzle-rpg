from pathlib import Path

GAME = Path('app/PuzzleRPGGame.tsx')
CSS = Path('app/PuzzleRPGGame.module.css')

game = GAME.read_text()
css = CSS.read_text()

old_delay = '''function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
'''
new_delay = '''function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}
'''
assert old_delay in game, 'delay helper anchor not found'
game = game.replace(old_delay, new_delay, 1)

old_swap_phase = '''    setResolutionPhase("swap");
    setSwapMotion(swapPair ? { a: swapPair[0], b: swapPair[1] } : null);
    setBoard(nextBoard);
    if (swapPair) playSfx("swap");
    await delay(swapPair ? 205 : 120);
    setSwapMotion(null);

    for (let index = 0; index < plan.frames.length; index += 1) {
'''
new_swap_phase = '''    setResolutionPhase("swap");
    if (swapPair) {
      // Keep the pre-swap board mounted while the two original tiles physically
      // travel to each other's cells. Only commit the logical swapped board
      // after the movement finishes, then allow two painted frames to settle
      // before any clear animation starts. This prevents the old tile identity
      // from appearing to clear before the swap has visually completed.
      setSwapMotion({ a: swapPair[0], b: swapPair[1] });
      playSfx("swap");
      await delay(205);
      setSwapMotion(null);
      setBoard(nextBoard);
      await nextPaint();
    } else {
      setSwapMotion(null);
      setBoard(nextBoard);
      await delay(120);
    }

    for (let index = 0; index < plan.frames.length; index += 1) {
'''
assert old_swap_phase in game, 'swap phase anchor not found'
game = game.replace(old_swap_phase, new_swap_phase, 1)

old_swap_class = '''  const swapClassFor = (row: number, col: number): string => {
    if (!swapMotion) return "";
    const { a, b } = swapMotion;
    let source: Coord | null = null;
    let target: Coord | null = null;
    if (row === a.row && col === a.col) { source = b; target = a; }
    else if (row === b.row && col === b.col) { source = a; target = b; }
    if (!source || !target) return "";
    if (source.col < target.col) return styles.swapFromLeft;
    if (source.col > target.col) return styles.swapFromRight;
    if (source.row < target.row) return styles.swapFromUp;
    return styles.swapFromDown;
  };
'''
new_swap_class = '''  const swapClassFor = (row: number, col: number): string => {
    if (!swapMotion) return "";
    const { a, b } = swapMotion;
    let source: Coord | null = null;
    let target: Coord | null = null;
    // During the swap phase board still contains the pre-swap orbs, so each
    // mounted tile moves OUT from its own cell toward the other selected cell.
    if (row === a.row && col === a.col) { source = a; target = b; }
    else if (row === b.row && col === b.col) { source = b; target = a; }
    if (!source || !target) return "";
    if (target.col < source.col) return styles.swapToLeft;
    if (target.col > source.col) return styles.swapToRight;
    if (target.row < source.row) return styles.swapToUp;
    return styles.swapToDown;
  };
'''
assert old_swap_class in game, 'swapClassFor anchor not found'
game = game.replace(old_swap_class, new_swap_class, 1)

old_css = '''.swapFromLeft { animation:swapFromLeft .205s cubic-bezier(.2,.8,.2,1); }
.swapFromRight { animation:swapFromRight .205s cubic-bezier(.2,.8,.2,1); }
.swapFromUp { animation:swapFromUp .205s cubic-bezier(.2,.8,.2,1); }
.swapFromDown { animation:swapFromDown .205s cubic-bezier(.2,.8,.2,1); }
@keyframes swapFromLeft { from { transform:translateX(-108%); z-index:6; } to { transform:translateX(0); z-index:6; } }
@keyframes swapFromRight { from { transform:translateX(108%); z-index:6; } to { transform:translateX(0); z-index:6; } }
@keyframes swapFromUp { from { transform:translateY(-108%); z-index:6; } to { transform:translateY(0); z-index:6; } }
@keyframes swapFromDown { from { transform:translateY(108%); z-index:6; } to { transform:translateY(0); z-index:6; } }
'''
new_css = '''.swapToLeft,
.swapToRight,
.swapToUp,
.swapToDown {
  z-index: 6;
  animation-duration: .205s;
  animation-timing-function: cubic-bezier(.2,.8,.2,1);
  animation-fill-mode: both;
  will-change: transform;
}
.swapToLeft { animation-name: swapToLeft; }
.swapToRight { animation-name: swapToRight; }
.swapToUp { animation-name: swapToUp; }
.swapToDown { animation-name: swapToDown; }
@keyframes swapToLeft { from { transform:translateX(0); } to { transform:translateX(-108%); } }
@keyframes swapToRight { from { transform:translateX(0); } to { transform:translateX(108%); } }
@keyframes swapToUp { from { transform:translateY(0); } to { transform:translateY(-108%); } }
@keyframes swapToDown { from { transform:translateY(0); } to { transform:translateY(108%); } }
'''
assert old_css in css, 'swap CSS anchor not found'
css = css.replace(old_css, new_css, 1)

GAME.write_text(game)
CSS.write_text(css)
print('swap animation ordering fixed')
