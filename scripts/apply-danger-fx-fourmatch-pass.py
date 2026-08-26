from pathlib import Path

TSX = Path('app/PuzzleRPGGame.tsx')
CSS = Path('app/PuzzleRPGGame.module.css')
ENEMY = Path('app/enemyAssets.tsx')

ts = TSX.read_text()
css = CSS.read_text()
enemy = ENEMY.read_text()


def replace_once(src: str, old: str, new: str, label: str) -> str:
    count = src.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    return src.replace(old, new, 1)

# 4+ match accessibility: clustered incoming queues + initial board candidates with real 4-match opportunities.
ts = replace_once(ts,
'''function randomOrb(): Orb {
  return ORBS[Math.floor(Math.random() * ORBS.length)]!;
}
''',
'''function randomOrb(): Orb {
  return ORBS[Math.floor(Math.random() * ORBS.length)]!;
}

function queuedOrb(previous?: Orb): Orb {
  // Small same-color clustering makes intentional 4+ setups appear more often
  // without turning the board into automatic cascades.
  if (previous && Math.random() < 0.24) return previous;
  return randomOrb();
}
''', 'queued orb')

ts = replace_once(ts,
'''function makeColumnQueues(): ColumnQueues {
  return Array.from({ length: SIZE }, () =>
    Array.from({ length: COLUMN_QUEUE_DEPTH }, () => randomOrb()),
  );
}

function refillColumnQueues(queues: ColumnQueues): ColumnQueues {
  const next = cloneQueues(queues);
  for (const queue of next) {
    while (queue.length < COLUMN_QUEUE_DEPTH) queue.push(randomOrb());
  }
  return next;
}

function makeBoard(): Board {
  const board: Board = Array.from({ length: SIZE }, () => Array<Orb>(SIZE).fill("fire"));
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      let next = randomOrb();
      let guard = 0;
      while (
        guard < 24 &&
        ((col >= 2 && board[row]![col - 1] === next && board[row]![col - 2] === next) ||
          (row >= 2 && board[row - 1]![col] === next && board[row - 2]![col] === next))
      ) {
        next = randomOrb();
        guard += 1;
      }
      board[row]![col] = next;
    }
  }
  return board;
}
''',
'''function makeColumnQueues(): ColumnQueues {
  return Array.from({ length: SIZE }, () => {
    const queue: Orb[] = [];
    while (queue.length < COLUMN_QUEUE_DEPTH) queue.push(queuedOrb(queue.at(-1)));
    return queue;
  });
}

function refillColumnQueues(queues: ColumnQueues): ColumnQueues {
  const next = cloneQueues(queues);
  for (const queue of next) {
    while (queue.length < COLUMN_QUEUE_DEPTH) queue.push(queuedOrb(queue.at(-1)));
  }
  return next;
}

function maxLineRun(board: Board): number {
  let best = 1;
  for (let row = 0; row < SIZE; row += 1) {
    let start = 0;
    for (let col = 1; col <= SIZE; col += 1) {
      if (col < SIZE && board[row]![col] === board[row]![start]) continue;
      best = Math.max(best, col - start);
      start = col;
    }
  }
  for (let col = 0; col < SIZE; col += 1) {
    let start = 0;
    for (let row = 1; row <= SIZE; row += 1) {
      if (row < SIZE && board[row]![col] === board[start]![col]) continue;
      best = Math.max(best, row - start);
      start = row;
    }
  }
  return best;
}

function countFourMatchMoves(board: Board): number {
  let count = 0;
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const neighbors: Coord[] = [];
      if (col + 1 < SIZE) neighbors.push({ row, col: col + 1 });
      if (row + 1 < SIZE) neighbors.push({ row: row + 1, col });
      for (const other of neighbors) {
        const swapped = cloneBoard(board);
        const before = swapped[row]![col]!;
        swapped[row]![col] = swapped[other.row]![other.col]!;
        swapped[other.row]![other.col] = before;
        if (maxLineRun(swapped) >= 4) count += 1;
      }
    }
  }
  return count;
}

function makeBoardCandidate(): Board {
  const board: Board = Array.from({ length: SIZE }, () => Array<Orb>(SIZE).fill("fire"));
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      let next = randomOrb();
      let guard = 0;
      while (
        guard < 24 &&
        ((col >= 2 && board[row]![col - 1] === next && board[row]![col - 2] === next) ||
          (row >= 2 && board[row - 1]![col] === next && board[row - 2]![col] === next))
      ) {
        next = randomOrb();
        guard += 1;
      }
      board[row]![col] = next;
    }
  }
  return board;
}

function makeBoard(): Board {
  let best = makeBoardCandidate();
  let bestFourMoves = countFourMatchMoves(best);
  for (let attempt = 0; attempt < 28 && bestFourMoves < 3; attempt += 1) {
    const candidate = makeBoardCandidate();
    const fourMoves = countFourMatchMoves(candidate);
    if (fourMoves > bestFourMoves) {
      best = candidate;
      bestFourMoves = fourMoves;
    }
  }
  return best;
}
''', 'queue and board generation')

# Strong pinch evaluation.
ts = replace_once(ts,
'''  const enemyPixelClass = `${styles.enemyPixelSprite} ${resolutionPhase === "attack" ? styles.enemyPixelStruck : ""}`;
  const nextIntentAlert = nextIntent.kind !== "attack" || nextIntent.power >= Math.max(12, playerShield + 5);
''',
'''  const enemyPixelClass = `${styles.enemyPixelSprite} ${resolutionPhase === "attack" ? styles.enemyPixelStruck : ""}`;
  const nextIntentAlert = nextIntent.kind !== "attack" || nextIntent.power >= Math.max(12, playerShield + 5);
  const incomingHpDamage = intent.kind === "pierce" ? intent.power : Math.max(0, intent.power - playerShield);
  const pinchLevel = playerHp <= 24 || incomingHpDamage >= playerHp
    ? "critical"
    : playerHp <= 45 || incomingHpDamage >= Math.ceil(playerHp * 0.45)
      ? "danger"
      : "safe";
''', 'pinch state')

ts = replace_once(ts,
'''    <main className={`${styles.shell} ${damageTaken > 0 ? styles.shellDamaged : ""}`}>
''',
'''    <main className={`${styles.shell} ${damageTaken > 0 ? styles.shellDamaged : ""} ${pinchLevel === "critical" ? styles.shellCritical : pinchLevel === "danger" ? styles.shellDanger : ""}`}>
''', 'shell pinch class')

ts = replace_once(ts,
'''      <section className={`${styles.playerStrip} ${resolutionPhase === "enemy" ? styles.playerStruck : ""}`} aria-label="player status">
''',
'''      <section className={`${styles.playerStrip} ${resolutionPhase === "enemy" ? styles.playerStruck : ""} ${pinchLevel !== "safe" ? styles.playerPinch : ""}`} aria-label="player status">
''', 'player pinch class')

ts = replace_once(ts,
'''      </section>

      <section className={styles.puzzleZone} aria-label="puzzle zone">
''',
'''      </section>

      {pinchLevel !== "safe" ? (
        <div className={`${styles.pinchBanner} ${pinchLevel === "critical" ? styles.pinchCritical : ""}`} role="alert">
          <strong>{pinchLevel === "critical" ? "!! CRITICAL !!" : "! DANGER !"}</strong>
          <span>HP {playerHp} • NOW {intent.label} {intent.power}{incomingHpDamage > 0 ? ` • HP -${incomingHpDamage}予測` : " • BLOCK可能"}</span>
        </div>
      ) : null}

      <section className={styles.puzzleZone} aria-label="puzzle zone">
''', 'pinch banner')

# More intense pixel FX: extra impact text and stage clear punch remains purely 8-bit.
ts = replace_once(ts,
'''          <b />
          <em className={styles.attackImpact}>HIT!</em>
''',
'''          <b />
          <em className={styles.attackImpact}>HIT!</em>
          <span className={styles.attackBurstBits} aria-hidden="true" />
''', 'attack burst bits')

# Faster enemy art on intro: browser-level preload hints are done in EnemySprite too.
enemy = replace_once(enemy,
'''      draggable={false}
      decoding="async"
      data-pixel-sprite="enemy"
''',
'''      draggable={false}
      loading="eager"
      fetchPriority="high"
      decoding="sync"
      data-pixel-sprite="enemy"
''', 'enemy eager image')

marker = '/* Danger + stronger FX + four-match balance pass */'
if marker in css:
    raise SystemExit('CSS marker already exists')

css += r'''

/* Danger + stronger FX + four-match balance pass */
/* Player pinch is impossible to miss but stays behind board interaction. */
.shellDanger::before,.shellCritical::before {
  content:"";
  position:fixed;
  z-index:45;
  inset:0;
  pointer-events:none;
  border:5px solid #a91f38;
  box-shadow:inset 0 0 0 4px #240007;
  animation:pinchFrame8 .82s steps(2,end) infinite;
}
.shellCritical::before {
  border-width:8px;
  border-color:#ff334f;
  box-shadow:inset 0 0 0 5px #4d000d, inset 0 0 0 10px #080000;
  animation-duration:.48s;
}
.playerPinch {
  border-color:#ff4c62 !important;
  background:#170307 !important;
  box-shadow:inset 0 0 0 2px #5d0714 !important;
}
.playerPinch .playerRow > strong { color:#ff6577 !important; font-size:12px !important; animation:pinchText8 .62s steps(2,end) infinite; }
.pinchBanner {
  flex:0 0 auto;
  min-height:30px;
  display:grid;
  grid-template-columns:auto 1fr;
  align-items:center;
  gap:8px;
  padding:4px 8px;
  border:3px double #ff5b6e;
  background:#120205;
  color:#fff;
  box-shadow:3px 3px 0 #000;
  font-size:8px;
  letter-spacing:.04em;
}
.pinchBanner strong { color:#ff6679; font-size:12px; white-space:nowrap; }
.pinchBanner span { color:#ffdfe3; font-weight:900; }
.pinchCritical { border-color:#fff; background:#380009; animation:pinchBanner8 .48s steps(2,end) infinite; }
.pinchCritical strong { color:#fff; font-size:14px; }
@keyframes pinchFrame8 { 50% { opacity:.22; } }
@keyframes pinchText8 { 50% { color:#fff; } }
@keyframes pinchBanner8 { 50% { background:#7a0016; color:#fff; } }

/* Stronger 8-bit player impact: larger hit cluster, square shock rings and screen flash. */
.playerAttackFx::after {
  content:"";
  position:absolute;
  inset:0;
  background:rgba(255,255,255,.18);
  opacity:0;
  animation:attackScreenFlash8 .44s steps(3,end) forwards;
}
.attackBurstBits {
  position:absolute;
  left:25%;
  top:18%;
  width:8px;
  height:8px;
  background:#fff;
  box-shadow:
    -30px -18px 0 #ffd447, 28px -22px 0 #fff,
    -38px 9px 0 #ff5a2e, 36px 12px 0 #ffd447,
    -18px 31px 0 #fff, 20px 34px 0 #ff5a2e,
    -52px -2px 0 #fff, 52px 1px 0 #ffd447;
  transform:translate(-50%,-50%) scale(.2);
  opacity:0;
  animation:attackBurstBits8 .44s steps(4,end) forwards;
}
.enemyPixelStruck {
  animation:enemyPixelHitHard8 .42s steps(5,end) !important;
}
@keyframes attackScreenFlash8 { 0%,55%,100%{opacity:0} 62%,74%{opacity:1} }
@keyframes attackBurstBits8 { 0%,52%{opacity:0;transform:translate(-50%,-50%) scale(.2)} 60%{opacity:1;transform:translate(-50%,-50%) scale(.6)} 82%{opacity:1;transform:translate(-50%,-50%) scale(1.3)} 100%{opacity:0;transform:translate(-50%,-50%) scale(1.8)} }
@keyframes enemyPixelHitHard8 { 0%{transform:translateX(0);filter:none} 22%{transform:translateX(10px);filter:brightness(4) contrast(2)} 42%{transform:translateX(-8px);filter:brightness(.25) invert(1)} 64%{transform:translateX(6px);filter:brightness(3)} 100%{transform:translateX(0);filter:none} }

/* Clearing gets a bigger square shock without soft gradients. */
.clearing::before {
  border-radius:0 !important;
  border-width:4px !important;
  box-shadow:0 0 0 3px #000, 0 0 0 6px #fff !important;
}
.clearing::after {
  border-radius:0 !important;
  background:#fff !important;
  width:8px;
  height:8px;
  inset:calc(50% - 4px) !important;
  box-shadow:-22px 0 0 currentColor,22px 0 0 currentColor,0 -22px 0 currentColor,0 22px 0 currentColor,-16px -16px 0 #fff,16px 16px 0 #fff !important;
}

/* Enemy attack and damage punch: hard full-frame flash and larger pixel shards. */
.enemyAttackFx { animation:enemyAttackFrame8 .34s steps(3,end) both; }
.enemyAttackFx i { width:8px !important; box-shadow:8px 0 0 #d8334e,0 8px 0 #fff !important; }
.damageVignette { animation:damage8Hard .42s steps(4,end) both !important; }
.damageVignette>span { font-size:34px !important; border-width:3px !important; padding:5px 9px !important; }
@keyframes enemyAttackFrame8 { 0%,100%{filter:none} 38%{filter:brightness(1.8)} 55%{filter:brightness(.6)} }
@keyframes damage8Hard { 0%,100%{opacity:0} 12%{opacity:1;background:rgba(255,255,255,.3)} 28%,76%{opacity:1} }

/* Stage clear has a harder white/yellow flash and larger title. */
.stageClearOverlay::after {
  content:"";
  position:absolute;
  inset:0;
  pointer-events:none;
  background:#fff;
  opacity:0;
  animation:clearFlashHard8 .9s steps(4,end) both;
}
.clearTitle { font-size:clamp(48px,16vw,78px) !important; }
@keyframes clearFlashHard8 { 0%{opacity:.9} 12%{opacity:0} 24%{opacity:.55} 38%,100%{opacity:0} }

@media (max-height:760px) and (orientation:portrait) {
  .pinchBanner { min-height:24px; padding:2px 6px; }
  .pinchBanner strong { font-size:10px; }
  .pinchBanner span { font-size:7px; }
}
'''

TSX.write_text(ts)
CSS.write_text(css)
ENEMY.write_text(enemy)
print('danger/fx/four-match pass applied')
# git-trigger
