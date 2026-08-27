from pathlib import Path
import re

ROOT = Path('.')
tsx_path = ROOT / 'app/PuzzleRPGClusterBreak.tsx'
css_path = ROOT / 'app/PuzzleRPGGameplayV2.module.css'
text = tsx_path.read_text()

def rep(old, new, label):
    global text
    if old not in text:
        raise SystemExit(f'missing replacement: {label}')
    text = text.replace(old, new, 1)

rep('import styles from "./PuzzleRPGClusterBreak.module.css";\n', 'import styles from "./PuzzleRPGClusterBreak.module.css";\nimport v2 from "./PuzzleRPGGameplayV2.module.css";\n', 'v2 import')
rep('type FxState = { token: number; type: PanelType; count: number; rank: string };', '''type FxState = { token: number; type: PanelType; count: number; rank: string; sourceX: number; sourceY: number; dx: number; dy: number };
type FeedbackTarget = "enemy" | "hp" | "barrier" | "free";
type FeedbackTone = "gain" | "loss" | "special";
type FeedbackState = { token: number; target: FeedbackTarget; text: string; tone: FeedbackTone };''', 'types')
rep('let fxToken = 1;\n', 'let fxToken = 1;\nlet feedbackToken = 1;\n', 'feedback token')
rep('''function weightedType(): PanelType {
  const r = Math.random();
  if (r < 0.36) return "attack";
  if (r < 0.58) return "heal";
  if (r < 0.84) return "barrier";
  return "skip";
}''', '''function weightedType(suppressSkip = false): PanelType {
  const r = Math.random();
  if (suppressSkip) {
    if (r < 0.42) return "attack";
    if (r < 0.69) return "heal";
    if (r < 0.96) return "barrier";
    return "skip";
  }
  if (r < 0.36) return "attack";
  if (r < 0.58) return "heal";
  if (r < 0.84) return "barrier";
  return "skip";
}

function weightedNonSkipType(): PanelType {
  const r = Math.random();
  if (r < 0.43) return "attack";
  if (r < 0.70) return "heal";
  return "barrier";
}''', 'weighted types')
text = text.replace('Math.random() < 0.12', 'Math.random() < 0.08', 1)
text = text.replace('Math.random() < 0.28', 'Math.random() < 0.18', 1)
rep('''function queueType(previous?: PanelType): PanelType {
  if (previous) {
    const repeatChance = previous === "skip" ? 0.05 : 0.13;
    if (Math.random() < repeatChance) return previous;
  }
  return weightedType();
}''', '''function queueType(previous?: PanelType, suppressSkip = false): PanelType {
  if (previous) {
    const repeatChance = previous === "skip" ? (suppressSkip ? 0 : 0.02) : 0.09;
    if (Math.random() < repeatChance) return previous;
  }
  return weightedType(suppressSkip);
}''', 'queue type')
rep('''function refillQueue(queue: PanelType[]) {
  const next = [...queue];
  while (next.length < QUEUE_DEPTH) next.push(queueType(next[next.length - 1]));
  return next;
}''', '''function refillQueue(queue: PanelType[], suppressSkip = false) {
  const next = [...queue];
  while (next.length < QUEUE_DEPTH) next.push(queueType(next[next.length - 1], suppressSkip));
  return next;
}

function coolSkipQueues(queues: PanelType[][]): PanelType[][] {
  return queues.map((queue) => queue.map((type, index) => {
    // Keep both visible NEXT panels exact. Only hidden future supply cools down.
    if (index < 2 || type !== "skip") return type;
    return Math.random() < 0.82 ? weightedNonSkipType() : type;
  }));
}''', 'refill and cooling')
text = text.replace('passive: "3回目の行動はVOID CRUSH。SKIPしても技の順番は消えない。"', 'passive: "2回目の行動はVOID CRUSH。SKIPしても技の順番は消えない。"', 1)
rep('''  if (enemy.kind === "warden") {
    return step % 3 === 2
      ? { kind: "heavy", label: "VOID CRUSH", detail: "重撃", power: 5 + add, icon: "!!" }
      : { kind: "attack", label: "VOID BOLT", detail: "通常攻撃", power: 3 + add, icon: "!" };
  }''', '''  if (enemy.kind === "warden") {
    return step % 3 === 1
      ? { kind: "heavy", label: "VOID CRUSH", detail: "重撃", power: 6 + add, icon: "!!" }
      : { kind: "attack", label: "VOID BOLT", detail: "通常攻撃", power: 4 + add, icon: "!" };
  }''', 'warden intent')
rep('''  if (enemy.kind === "oracle") {
    return step % 3 === 1
      ? { kind: "drain", label: "BLOOD DRAIN", detail: "HP被害分を吸収", power: 4 + add, icon: "+" }
      : { kind: "attack", label: "BLOOD NEEDLE", detail: "通常攻撃", power: 4 + add, icon: "!" };
  }''', '''  if (enemy.kind === "oracle") {
    return step % 3 === 1
      ? { kind: "drain", label: "BLOOD DRAIN", detail: "HP被害分を吸収", power: 5 + add, icon: "+" }
      : { kind: "attack", label: "BLOOD NEEDLE", detail: "通常攻撃", power: 4 + add, icon: "!" };
  }''', 'oracle intent')
rep('''  return step % 3 === 2
    ? { kind: "disrupt", label: "PRISM SHIFT", detail: "攻撃＋2枚変色", power: 5 + add, icon: "<>" }
    : { kind: "attack", label: "PRISM HIT", detail: "通常攻撃", power: 4 + add, icon: "!" };''', '''  return step % 3 === 1
    ? { kind: "disrupt", label: "PRISM SHIFT", detail: "攻撃＋2枚変色", power: 5 + add, icon: "<>" }
    : { kind: "attack", label: "PRISM HIT", detail: "通常攻撃", power: 4 + add, icon: "!" };''', 'trickster intent')
rep('function collapseBoard(currentTiles: Tile[], currentQueues: PanelType[][], removed: Set<number>) {', 'function collapseBoard(currentTiles: Tile[], currentQueues: PanelType[][], removed: Set<number>, suppressSkipRefill = false) {', 'collapse signature')
text = text.replace('consumed.push(queue.shift() ?? weightedType());', 'consumed.push(queue.shift() ?? weightedType(suppressSkipRefill));', 1)
text = text.replace('nextQueues[col] = refillQueue(queue);', 'nextQueues[col] = refillQueue(queue, suppressSkipRefill);', 1)
rep('''  const [bestGroup, setBestGroup] = useState(1);
  const [fx, setFx] = useState<FxState | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);''', '''  const [bestGroup, setBestGroup] = useState(1);
  const [fx, setFx] = useState<FxState | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState[]>([]);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const enemySpriteRef = useRef<HTMLImageElement | null>(null);
  const hpRef = useRef<HTMLDivElement | null>(null);
  const barrierRef = useRef<HTMLDivElement | null>(null);
  const freeRef = useRef<HTMLDivElement | null>(null);''', 'states and refs')
rep('''  const largest = useMemo(() => largestGroups(tiles), [tiles]);
  const boardMap = useMemo(() => tileMap(tiles), [tiles]);''', '''  const largest = useMemo(() => largestGroups(tiles), [tiles]);
  const boardMap = useMemo(() => tileMap(tiles), [tiles]);
  const previewDropCounts = useMemo(() => {
    const counts = Array.from({ length: SIZE }, () => 0);
    if (!preview) return counts;
    for (const tile of tiles) {
      if (tile.row >= 0 && preview.ids.has(tile.id)) counts[tile.col] += 1;
    }
    return counts;
  }, [preview, tiles]);''', 'preview drops')
rep('''    setPreview(null);
    setFx(null);
    setMessage("STAGE 1");''', '''    setPreview(null);
    setFx(null);
    setFeedback([]);
    setMessage("STAGE 1");''', 'reset feedback')
rep('''    setPreview(null);
    setFx(null);
    setMessage(`STAGE ${next}`);''', '''    setPreview(null);
    setFx(null);
    setFeedback([]);
    setMessage(`STAGE ${next}`);''', 'next feedback')
rep('''  function startFx(type: PanelType, count: number) {
    const nextFx = { token: fxToken++, type, count, rank: groupRank(count) };
    setFx(nextFx);
    window.setTimeout(() => setFx((current) => current?.token === nextFx.token ? null : current), 620);
  }''', '''  function showFeedback(target: FeedbackTarget, text: string, tone: FeedbackTone, duration = 760) {
    const entry: FeedbackState = { token: feedbackToken++, target, text, tone };
    setFeedback((current) => [...current.slice(-5), entry]);
    window.setTimeout(() => setFeedback((current) => current.filter((item) => item.token !== entry.token)), duration);
  }

  function rectCenter(element: Element | null) {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function groupCenter(group: Tile[]) {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect || group.length === 0) return { x: window.innerWidth / 2, y: window.innerHeight * 0.72 };
    const avgCol = group.reduce((sum, tile) => sum + tile.col, 0) / group.length;
    const avgRow = group.reduce((sum, tile) => sum + tile.row, 0) / group.length;
    return {
      x: rect.left + rect.width * ((avgCol + 0.5) / SIZE),
      y: rect.top + rect.height * ((avgRow + 0.5) / SIZE),
    };
  }

  function startFx(type: PanelType, count: number, group: Tile[]) {
    const source = groupCenter(group);
    const targetElement = type === "attack"
      ? enemySpriteRef.current
      : type === "heal"
        ? hpRef.current
        : type === "barrier"
          ? barrierRef.current
          : freeRef.current;
    const target = rectCenter(targetElement) ?? { x: window.innerWidth / 2, y: window.innerHeight * 0.25 };
    const nextFx: FxState = {
      token: fxToken++, type, count, rank: groupRank(count),
      sourceX: source.x, sourceY: source.y, dx: target.x - source.x, dy: target.y - source.y,
    };
    setFx(nextFx);
    window.setTimeout(() => setFx((current) => current?.token === nextFx.token ? null : current), 560);
  }

  function feedbackNodes(target: FeedbackTarget) {
    return feedback.filter((item) => item.target === target).map((item) => (
      <b
        key={item.token}
        className={`${v2.feedback} ${item.tone === "gain" ? v2.feedbackGain : item.tone === "loss" ? v2.feedbackLoss : v2.feedbackSpecial}`}
      >{item.text}</b>
    ));
  }''', 'fx and feedback helpers')
text = text.replace('startFx(currentSeed.type, count);', 'startFx(currentSeed.type, count, group);', 1)
text = text.replace('await delay(count >= 8 ? 230 : 150);', 'await delay(count >= 8 ? 150 : 115);', 1)
rep('''      setEnemyHp(nextEnemyHp);
      setMessage(`ATK ×${count} → ${count} DAMAGE`);
      playSfx("playerAttack");''', '''      setEnemyHp(nextEnemyHp);
      setMessage(`ATK ×${count} → ${count} DAMAGE`);
      showFeedback("enemy", `-${count}`, "loss");
      playSfx("playerAttack");''', 'attack feedback')
rep('''      setPlayerHp(nextPlayerHp);
      setMessage(`HEAL ×${count} → HP +${actual}`);
      playSfx("heal");''', '''      setPlayerHp(nextPlayerHp);
      setMessage(`HEAL ×${count} → HP +${actual}`);
      showFeedback("hp", actual > 0 ? `+${actual} HP` : "HP FULL", actual > 0 ? "gain" : "special");
      playSfx("heal");''', 'heal feedback')
rep('''      setBarrier(nextBarrier);
      setMessage(`BAR ×${count} → BARRIER +${actual}`);
      playSfx("shield");''', '''      setBarrier(nextBarrier);
      setMessage(`BAR ×${count} → BARRIER +${actual}`);
      showFeedback("barrier", actual > 0 ? `+${actual} BAR` : "BAR MAX", actual > 0 ? "gain" : "special");
      playSfx("shield");''', 'barrier feedback')
rep('''      nextDelay += count;
      setMessage(`SKIP ×${count} → ${Math.max(0, count - 1)} FREE MOVE${count - 1 === 1 ? "" : "S"}`);
      playSfx(count >= 6 ? "skill" : "setup");''', '''      nextDelay += count;
      setMessage(`SKIP ×${count} → ${Math.max(0, count - 1)} FREE MOVE${count - 1 === 1 ? "" : "S"}`);
      showFeedback("free", `+${Math.max(0, count - 1)} FREE`, "special");
      playSfx(count >= 6 ? "skill" : "setup");''', 'skip feedback')
rep('''    const { startTiles, finalTiles, nextQueues } = collapseBoard(tiles, queues, removed);
    setClearingIds(new Set());
    setTiles(startTiles);
    setQueues(nextQueues);''', '''    const coolingActive = enemyDelay > 0 || currentSeed.type === "skip";
    const collapsed = collapseBoard(tiles, queues, removed, coolingActive);
    const nextQueues = coolingActive ? coolSkipQueues(collapsed.nextQueues) : collapsed.nextQueues;
    setClearingIds(new Set());
    setTiles(collapsed.startTiles);
    setQueues(nextQueues);''', 'collapse cooling')
text = text.replace('setTiles(finalTiles);', 'setTiles(collapsed.finalTiles);', 1)
text = text.replace('await delay(285);', 'await delay(215);', 1)
rep('''    setBarrier(nextBarrier);
    setPlayerHp(nextPlayerHp);
    setMessage((text) => `${text} • ${hpDamage > 0 ? `${currentIntent.label} -${hpDamage} HP` : `${currentIntent.label} BLOCK ${blocked}`}`);
    playSfx''', '''    setBarrier(nextBarrier);
    setPlayerHp(nextPlayerHp);
    if (blocked > 0) showFeedback("barrier", `-${blocked} BAR`, "loss");
    if (hpDamage > 0) showFeedback("hp", `-${hpDamage} HP`, "loss");
    if (currentIntent.kind !== "attack") showFeedback("enemy", currentIntent.label, "special", 900);
    setMessage((text) => `${text} • ${hpDamage > 0 ? `${currentIntent.label} -${hpDamage} HP` : `${currentIntent.label} BLOCK ${blocked}`}`);
    playSfx''', 'enemy feedback')
rep('''      setEnemyHp(healed);
      nextEnemyHp = healed;
      setMessage((text) => `${text} • DRAIN +${hpDamage}`);''', '''      setEnemyHp(healed);
      nextEnemyHp = healed;
      showFeedback("enemy", `+${hpDamage} HP`, "gain");
      setMessage((text) => `${text} • DRAIN +${hpDamage}`);''', 'drain feedback')
rep('''      setTiles((current) => disruptBoard(current));
      setMessage((text) => `${text} • 2 PANELS SHIFT`);''', '''      setTiles((current) => disruptBoard(current));
      showFeedback("enemy", "SHIFT!", "special");
      setMessage((text) => `${text} • 2 PANELS SHIFT`);''', 'disrupt feedback')
# Remove old fixed delta block; FX now travels from selected cluster to its actual target.
text = re.sub(r'\n  const energyDelta = fx\?\.type === "attack"[\s\S]*?: \{ dx: 128, dy: -315 \};\n', '\n', text, count=1)
rep('const shellClass = `${styles.shell} ${isCritical ? styles.critical : isDanger ? styles.danger : ""}`;', 'const shellClass = `${styles.shell} ${v2.gameplayRoot} ${isCritical ? styles.critical : isDanger ? styles.danger : ""}`;', 'shell root')
rep('''                "--dx": `${energyDelta.dx + ((index % 3) - 1) * 18}px`,
                "--dy": `${energyDelta.dy - Math.floor(index / 3) * 8}px`,
                "--delay": `${index * 18}ms`,''', '''                left: `${fx.sourceX}px`,
                top: `${fx.sourceY}px`,
                "--dx": `${fx.dx + ((index % 3) - 1) * 14}px`,
                "--dy": `${fx.dy + ((Math.floor(index / 3) % 3) - 1) * 10}px`,
                "--delay": `${index * 14}ms`,''', 'particle geometry')
rep('<section className={`${styles.enemyStage} ${fx?.type === "attack" ? styles.targetHit : ""}`}>\n        <img className={styles.enemySprite}', '<section className={`${styles.enemyStage} ${v2.feedbackHost} ${fx?.type === "attack" ? styles.targetHit : ""}`}>\n        {feedbackNodes("enemy")}\n        <img ref={enemySpriteRef} className={styles.enemySprite}', 'enemy target')
rep('''        <div className={fx?.type === "heal" ? styles.targetGain : ""}>
          <span>HP</span><strong>{playerHp}/{PLAYER_MAX_HP}</strong><i><u style={{ width: `${playerHp / PLAYER_MAX_HP * 100}%` }} /></i>
        </div>
        <div className={fx?.type === "barrier" ? styles.targetGain : ""}>
          <span>BAR</span><strong>{barrier}/{BARRIER_MAX}</strong><i><u style={{ width: `${barrier / BARRIER_MAX * 100}%` }} /></i>
        </div>
        <div className={`${styles.freeMoves} ${enemyDelay > 0 ? styles.freeMovesActive : ""} ${fx?.type === "skip" ? styles.targetGain : ""}`}>
          <span>FREE</span><strong>{enemyDelay}</strong><small>{enemyDelay > 0 ? `${intent.label}は待機中` : "敵は次の手後に行動"}</small>
        </div>''', '''        <div ref={hpRef} className={`${v2.feedbackHost} ${fx?.type === "heal" ? styles.targetGain : ""}`}>
          {feedbackNodes("hp")}
          <span>HP</span><strong>{playerHp}/{PLAYER_MAX_HP}</strong><i><u style={{ width: `${playerHp / PLAYER_MAX_HP * 100}%` }} /></i>
        </div>
        <div ref={barrierRef} className={`${v2.feedbackHost} ${fx?.type === "barrier" ? styles.targetGain : ""}`}>
          {feedbackNodes("barrier")}
          <span>BAR</span><strong>{barrier}/{BARRIER_MAX}</strong><i><u style={{ width: `${barrier / BARRIER_MAX * 100}%` }} /></i>
        </div>
        <div ref={freeRef} className={`${styles.freeMoves} ${v2.feedbackHost} ${enemyDelay > 0 ? styles.freeMovesActive : ""} ${fx?.type === "skip" ? styles.targetGain : ""}`}>
          {feedbackNodes("free")}
          <span>FREE</span><strong>{enemyDelay}</strong><small>{enemyDelay > 0 ? `${intent.label}は待機中` : "敵は次の手後に行動"}</small>
        </div>''', 'player feedback hosts')
rep('''          {queues.map((queue, col) => (
            <div className={styles.nextColumn} key={col}>
              <span className={`${styles.miniPanel} ${styles[queue[1]!]}`}>{PANEL_LABEL[queue[1]!]}</span>
              <strong className={`${styles.miniPanel} ${styles[queue[0]!]}`}>{PANEL_LABEL[queue[0]!]}</strong>
            </div>
          ))}''', '''          {queues.map((queue, col) => {
            const drops = previewDropCounts[col] ?? 0;
            return (
              <div className={`${styles.nextColumn} ${drops > 0 ? v2.nextColumnActive : ""}`} key={col}>
                <span className={`${styles.miniPanel} ${styles[queue[1]!]} ${drops >= 2 ? v2.nextIncoming : ""}`}>{PANEL_LABEL[queue[1]!]}</span>
                <strong className={`${styles.miniPanel} ${styles[queue[0]!]} ${drops >= 1 ? v2.nextIncoming : ""}`}>{PANEL_LABEL[queue[0]!]}</strong>
                {drops > 0 ? <i className={v2.dropCount}>↓{drops}</i> : null}
              </div>
            );
          })}''', 'next forecast')
rep('<section className={styles.boardZone}>\n        <div className={`${styles.fxBanner} ${fx ? styles.fxBannerActive : ""}`}>', '<section className={`${styles.boardZone} ${v2.boardZoneStable}`}>\n        <div className={`${styles.fxBanner} ${v2.rankBanner} ${fx ? styles.fxBannerActive : ""}`}>', 'stable banner')

tsx_path.write_text(text)

css_path.write_text(r'''.gameplayRoot {
  --v2-pixel-white: #fff7d8;
}

.feedbackHost {
  position: relative !important;
  overflow: visible !important;
}

.feedback {
  position: absolute;
  z-index: 12000;
  left: 50%;
  top: 50%;
  min-width: max-content;
  padding: 2px 5px;
  border: 2px solid #fff;
  background: #040407;
  font: 1000 12px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  letter-spacing: .3px;
  pointer-events: none;
  transform: translate(-50%, -50%);
  animation: feedbackRise 720ms steps(6,end) both;
  text-shadow: 2px 2px #000;
}
.feedbackGain { color: #7cffb0; box-shadow: 0 0 10px rgba(64,255,154,.55); }
.feedbackLoss { color: #ff715d; box-shadow: 0 0 10px rgba(255,80,50,.55); }
.feedbackSpecial { color: #ffe35f; box-shadow: 0 0 10px rgba(255,220,70,.55); }

.nextColumnActive {
  position: relative;
  outline: 2px solid #fff2a8;
  outline-offset: -1px;
  z-index: 3;
}
.nextIncoming {
  filter: brightness(1.65) saturate(1.2);
  box-shadow: inset 0 0 0 1px #fff;
}
.dropCount {
  position: absolute;
  z-index: 8;
  right: 1px;
  bottom: -1px;
  min-width: 14px;
  padding: 1px 2px;
  border: 1px solid #fff2a8;
  background: #050509;
  color: #fff2a8;
  font: 1000 6px/1 ui-monospace, monospace;
  font-style: normal;
  text-align: center;
  pointer-events: none;
}

.boardZoneStable {
  position: relative;
  padding-top: 0 !important;
}
.rankBanner {
  position: absolute !important;
  z-index: 80 !important;
  top: 7px !important;
  left: 50% !important;
  transform: translateX(-50%) !important;
  margin: 0 !important;
  pointer-events: none !important;
}

.gameplayRoot :global([class*="clearing"]) {
  transition: none !important;
  transform: none !important;
  opacity: 1 !important;
  filter: none !important;
  animation: pixelVanish 130ms steps(4,end) forwards !important;
}
.gameplayRoot :global([class*="clearing"])::after {
  content: "";
  position: absolute;
  z-index: 10;
  left: 50%;
  top: 50%;
  width: 7px;
  height: 7px;
  background: var(--v2-pixel-white);
  box-shadow:
    -16px -12px var(--panel-edge), 16px -12px var(--panel-edge),
    -18px 10px #fff, 18px 10px #fff,
    -8px 18px var(--panel-edge), 9px 18px var(--panel-edge);
  transform: translate(-50%,-50%);
  animation: pixelDebris 150ms steps(4,end) forwards;
  pointer-events: none;
}

.gameplayRoot :global([class*="energyParticle"]) {
  margin-left: -4px;
  margin-top: -4px;
}

@keyframes feedbackRise {
  0% { opacity: 0; transform: translate(-50%, -20%) scale(.75); }
  16% { opacity: 1; transform: translate(-50%, -55%) scale(1.18); }
  70% { opacity: 1; transform: translate(-50%, -120%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -170%) scale(.9); }
}
@keyframes pixelVanish {
  0% { opacity: 1; filter: brightness(3); }
  28% { opacity: 1; filter: brightness(5) saturate(0); }
  55% { opacity: .75; filter: brightness(2); }
  100% { opacity: 0; filter: brightness(1); }
}
@keyframes pixelDebris {
  0% { opacity: 0; transform: translate(-50%,-50%) scale(.5); }
  30% { opacity: 1; transform: translate(-50%,-50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%,-50%) scale(2.2); }
}
''')
print('Cluster Break v2 source changes applied')
