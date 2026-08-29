from pathlib import Path

p = Path('app/PuzzleRPGClusterBreak.tsx')
s = p.read_text()

s = s.replace(
'''type FeedbackState = { token: number; target: FeedbackTarget; text: string; tone: FeedbackTone };
type ChapterBattleProps = { embedded?: boolean; onExit?: () => void };''',
'''type FeedbackState = { token: number; target: FeedbackTarget; text: string; tone: FeedbackTone };
type ChapterTimeFx = { token: number; count: number; phase: "armed" | "tick" | "zero" };
type ChapterGuardFx = { token: number; mode: "block" | "break"; blocked: number; hpDamage: number };
type ChapterBattleProps = { embedded?: boolean; onExit?: () => void };''')

s = s.replace(
'''let tileId = 1;
let fxToken = 1;
let feedbackToken = 1;''',
'''let tileId = 1;
let fxToken = 1;
let feedbackToken = 1;
let chapterTimeFxToken = 1;
let chapterGuardFxToken = 1;''')

s = s.replace(
'''  const [fx, setFx] = useState<FxState | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState[]>([]);''',
'''  const [fx, setFx] = useState<FxState | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState[]>([]);
  const [chapterTimeFx, setChapterTimeFx] = useState<ChapterTimeFx | null>(null);
  const [chapterGuardFx, setChapterGuardFx] = useState<ChapterGuardFx | null>(null);''')

s = s.replace('''    setFx(null);
    setFeedback([]);
    setMessage("STAGE 1");''', '''    setFx(null);
    setFeedback([]);
    setChapterTimeFx(null);
    setChapterGuardFx(null);
    setMessage("STAGE 1");''')

s = s.replace('''    setFx(null);
    setFeedback([]);
    setMessage(`CHAPTER 1 • STAGE ${next}/${CHAPTER_LENGTH}`);''', '''    setFx(null);
    setFeedback([]);
    setChapterTimeFx(null);
    setChapterGuardFx(null);
    setMessage(`CHAPTER 1 • STAGE ${next}/${CHAPTER_LENGTH}`);''')

s = s.replace(
'''    } else {
      const extraFree = build.includes("timeThief") && count >= 4 ? 1 : 0;
      nextDelay += count + extraFree;
      const granted = Math.max(0, count - 1 + extraFree);
      setMessage(`SKIP ×${count} → ${granted} FREE MOVE${granted === 1 ? "" : "S"}${extraFree > 0 ? " • TIME THIEF +1" : ""}`);
      showFeedback("free", `+${granted} FREE`, "special");
      playSfx(count >= 6 ? "skill" : "setup");
    }''',
'''    } else {
      const extraFree = build.includes("timeThief") && count >= 4 ? 1 : 0;
      nextDelay += count + extraFree;
      const granted = Math.max(0, count - 1 + extraFree);
      setEnemyDelay(nextDelay);
      setChapterTimeFx({ token: chapterTimeFxToken++, count: nextDelay, phase: "armed" });
      setMessage(`SKIP ×${count} → ${granted} FREE MOVE${granted === 1 ? "" : "S"}${extraFree > 0 ? " • TIME THIEF +1" : ""}`);
      showFeedback("free", `+${granted} FREE`, "special");
      playSfx(count >= 6 ? "skill" : "setup");
    }''')

s = s.replace(
'''    if (nextDelay > 0) {
      nextDelay -= 1;
      setEnemyDelay(nextDelay);
      setMessage((text) => `${text} • ENEMY WAIT${nextDelay > 0 ? ` • FREE ${nextDelay}` : ""}`);
      setTurn((value) => value + 1);
      setResolving(false);
      return;
    }''',
'''    if (nextDelay > 0) {
      const beforeTick = nextDelay;
      setChapterTimeFx({ token: chapterTimeFxToken++, count: beforeTick, phase: "tick" });
      await delay(180);
      nextDelay -= 1;
      setEnemyDelay(nextDelay);
      setChapterTimeFx({ token: chapterTimeFxToken++, count: nextDelay, phase: nextDelay === 0 ? "zero" : "tick" });
      playSfx("setup");
      await delay(nextDelay === 0 ? 300 : 220);
      if (nextDelay === 0) setChapterTimeFx(null);
      else setChapterTimeFx({ token: chapterTimeFxToken++, count: nextDelay, phase: "armed" });
      setMessage((text) => `${text} • ENEMY WAIT${nextDelay > 0 ? ` • FREE ${nextDelay}` : " • TIME UP"}`);
      setTurn((value) => value + 1);
      setResolving(false);
      return;
    }''')

old_attack = '''    nextPlayerHp = Math.max(0, nextPlayerHp - hpDamage);
    setBarrier(nextBarrier);
    setPlayerHp(nextPlayerHp);
    if (blocked > 0) showFeedback("barrier", `-${blocked} BAR`, "loss");
    if (hpDamage > 0) showFeedback("hp", `-${hpDamage} HP`, "loss");
    if (currentIntent.kind !== "attack") showFeedback("enemy", currentIntent.label, "special", 900);
    setMessage((text) => `${text} • ${hpDamage > 0 ? `${currentIntent.label} -${hpDamage} HP` : `${currentIntent.label} BLOCK ${blocked}`}`);
    playSfx(currentIntent.kind === "heavy" ? "enemyHeavy" : currentIntent.kind === "drain" ? "enemyDrain" : currentIntent.kind === "pierce" ? "pierce" : currentIntent.kind === "disrupt" ? "enemyDisrupt" : "enemyAttack");'''
new_attack = '''    const enemyAttackSfx = currentIntent.kind === "heavy" ? "enemyHeavy" : currentIntent.kind === "drain" ? "enemyDrain" : currentIntent.kind === "pierce" ? "pierce" : currentIntent.kind === "disrupt" ? "enemyDisrupt" : "enemyAttack";
    playSfx(enemyAttackSfx);
    if (blocked > 0) {
      setChapterGuardFx({ token: chapterGuardFxToken++, mode: "block", blocked, hpDamage });
      playSfx("shield");
      await delay(190);
      if (hpDamage > 0) {
        setChapterGuardFx({ token: chapterGuardFxToken++, mode: "break", blocked, hpDamage });
        await delay(240);
      } else {
        await delay(210);
      }
      setChapterGuardFx(null);
    }
    nextPlayerHp = Math.max(0, nextPlayerHp - hpDamage);
    setBarrier(nextBarrier);
    setPlayerHp(nextPlayerHp);
    if (blocked > 0) showFeedback("barrier", `-${blocked} BAR`, "loss");
    if (hpDamage > 0) showFeedback("hp", `-${hpDamage} HP`, "loss");
    if (currentIntent.kind !== "attack") showFeedback("enemy", currentIntent.label, "special", 900);
    setMessage((text) => `${text} • ${hpDamage > 0 ? `${currentIntent.label} -${hpDamage} HP` : `${currentIntent.label} BLOCK ${blocked}`}`);'''
if old_attack not in s:
    raise SystemExit('enemy attack block not found')
s = s.replace(old_attack, new_attack)

s = s.replace(
'''        <img ref={enemySpriteRef} className={styles.enemySprite} src={PIXEL_ART_ASSETS.enemies[enemy.kind]} alt={enemy.name} />
        <div className={styles.enemyInfo}>''',
'''        <img ref={enemySpriteRef} className={styles.enemySprite} src={PIXEL_ART_ASSETS.enemies[enemy.kind]} alt={enemy.name} />
        {enemyDelay > 0 || chapterTimeFx ? (
          <div
            className={`${styles.chapterTimeStop} ${chapterTimeFx?.phase === "zero" ? styles.chapterTimeStopZero : ""}`}
            aria-label={`Enemy time stop ${chapterTimeFx?.count ?? enemyDelay}`}
          >
            <i className={styles.pixelStopwatchLarge} aria-hidden="true" />
            <strong>{chapterTimeFx?.count ?? enemyDelay}</strong>
            <span>{(chapterTimeFx?.count ?? enemyDelay) === 0 ? "TIME UP" : "TIME STOP"}</span>
          </div>
        ) : null}
        <div className={styles.enemyInfo}>''')

s = s.replace(
'''      <section className={`${styles.boardZone} ${v2.boardZoneStable}`}>
        <div className={`${styles.fxBanner} ${v2.rankBanner} ${fx ? styles.fxBannerActive : ""}`}>''',
'''      <section className={`${styles.boardZone} ${v2.boardZoneStable}`}>
        {chapterGuardFx ? (
          <div
            className={`${styles.chapterGuardFx} ${chapterGuardFx.mode === "break" ? styles.chapterGuardBreak : styles.chapterGuardBlock}`}
            aria-label={chapterGuardFx.mode === "break" ? `Shield break ${chapterGuardFx.hpDamage} damage` : `Barrier blocks ${chapterGuardFx.blocked}`}
          >
            <i className={styles.pixelShieldLarge} aria-hidden="true"><b /></i>
            <strong>{chapterGuardFx.mode === "break" ? "SHIELD BREAK" : "BLOCK"}</strong>
            <span>{chapterGuardFx.mode === "break" ? `${chapterGuardFx.hpDamage} HP DAMAGE` : `${chapterGuardFx.blocked} DAMAGE ABSORBED`}</span>
          </div>
        ) : null}
        <div className={`${styles.fxBanner} ${v2.rankBanner} ${fx ? styles.fxBannerActive : ""}`}>''')

s = s.replace(
'''              <b>{PANEL_GLYPH[tile.type]}</b>
              <span>{PANEL_LABEL[tile.type]}</span>''',
'''              <b>
                {tile.type === "skip" ? <i className={styles.pixelStopwatchMini} aria-hidden="true" /> : tile.type === "barrier" ? <i className={styles.pixelShieldMini} aria-hidden="true" /> : PANEL_GLYPH[tile.type]}
              </b>
              <span>{PANEL_LABEL[tile.type]}</span>''')

p.write_text(s)

css = Path('app/PuzzleRPGClusterBreak.module.css')
c = css.read_text()
marker = '/* CHAPTER 8BIT CLOCK + SHIELD FX */'
if marker not in c:
    c += r'''

/* CHAPTER 8BIT CLOCK + SHIELD FX */
.pixelStopwatchMini,
.pixelStopwatchLarge {
  position: relative;
  display: block;
  box-sizing: border-box;
  background: #f8f2d8;
  border: 3px solid #09111c;
  outline: 2px solid #18d5d6;
  clip-path: polygon(25% 0,75% 0,100% 25%,100% 75%,75% 100%,25% 100%,0 75%,0 25%);
  image-rendering: pixelated;
}
.pixelStopwatchMini { width: 24px; height: 24px; }
.pixelStopwatchMini::before,
.pixelStopwatchLarge::before {
  content: "";
  position: absolute;
  left: 50%;
  top: -8px;
  width: 10px;
  height: 6px;
  transform: translateX(-50%);
  background: #ffbd24;
  border: 2px solid #09111c;
}
.pixelStopwatchMini::after,
.pixelStopwatchLarge::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 45%;
  width: 3px;
  height: 7px;
  background: #09111c;
  transform: translate(-50%,-50%);
  box-shadow: 4px 4px 0 #09111c;
}
.pixelStopwatchLarge { width: 58px; height: 58px; outline-width: 4px; }
.pixelStopwatchLarge::before { top: -12px; width: 18px; height: 8px; border-width: 3px; }
.pixelStopwatchLarge::after { width: 4px; height: 12px; box-shadow: 7px 7px 0 #09111c; }

.pixelShieldMini,
.pixelShieldLarge {
  position: relative;
  display: block;
  box-sizing: border-box;
  background: #1588db;
  border: 3px solid #081423;
  outline: 2px solid #ffd12a;
  clip-path: polygon(12% 4%,88% 4%,94% 55%,75% 82%,50% 100%,25% 82%,6% 55%);
  image-rendering: pixelated;
}
.pixelShieldMini { width: 24px; height: 26px; }
.pixelShieldMini::after,
.pixelShieldLarge::after {
  content: "+";
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #ffe75b;
  font-weight: 1000;
  line-height: 1;
  text-shadow: 2px 0 #704408, -2px 0 #704408, 0 2px #704408, 0 -2px #704408;
}
.pixelShieldLarge { width: 84px; height: 92px; border-width: 5px; outline-width: 5px; }
.pixelShieldLarge::after { font-size: 46px; text-shadow: 4px 0 #704408, -4px 0 #704408, 0 4px #704408, 0 -4px #704408; }

.chapterTimeStop {
  position: absolute;
  z-index: 8;
  left: 56px;
  top: 12px;
  width: 72px;
  height: 78px;
  display: grid;
  place-items: center;
  pointer-events: none;
  filter: drop-shadow(3px 4px 0 #000);
  animation: chapterClockPulse 300ms steps(2,end) infinite alternate;
}
.chapterTimeStop > i { grid-area: 1 / 1; }
.chapterTimeStop > strong {
  grid-area: 1 / 1;
  z-index: 2;
  margin-top: 2px;
  color: #ffe24a;
  font-size: 25px;
  line-height: 1;
  text-shadow: 3px 0 #08111c, -3px 0 #08111c, 0 3px #08111c, 0 -3px #08111c;
}
.chapterTimeStop > span {
  position: absolute;
  bottom: -1px;
  padding: 2px 4px;
  border: 2px solid #111827;
  background: #053847;
  color: #eaffff;
  font-size: 7px;
  font-weight: 1000;
  letter-spacing: .5px;
  white-space: nowrap;
}
.chapterTimeStopZero .pixelStopwatchLarge { outline-color: #ff3c45; background: #fff0e7; }
.chapterTimeStopZero > strong { color: #ffdb45; }
.chapterTimeStopZero > span { background: #731522; color: #fff; }

.chapterGuardFx {
  position: absolute;
  z-index: 30;
  inset: 50% auto auto 50%;
  transform: translate(-50%,-50%);
  width: 150px;
  min-height: 132px;
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 4px;
  pointer-events: none;
  image-rendering: pixelated;
  filter: drop-shadow(5px 6px 0 #000);
}
.chapterGuardFx > strong {
  padding: 3px 7px;
  border: 3px solid #07101a;
  background: #0c3c68;
  color: #fff4a4;
  font-size: 13px;
  line-height: 1;
  text-shadow: 2px 2px #000;
}
.chapterGuardFx > span {
  padding: 2px 5px;
  background: #05070c;
  border: 2px solid #a4dfff;
  color: #dff8ff;
  font-size: 8px;
  font-weight: 1000;
}
.chapterGuardBlock { animation: chapterShieldHit 190ms steps(3,end) 1; }
.chapterGuardBreak { animation: chapterShieldBreak 240ms steps(4,end) 1; }
.chapterGuardBreak .pixelShieldLarge {
  outline-color: #ff5c3f;
  background: linear-gradient(100deg,#1588db 0 43%,#081423 44% 54%,#187aca 55% 100%);
  transform: rotate(-4deg);
}
.chapterGuardBreak .pixelShieldLarge b::before,
.chapterGuardBreak .pixelShieldLarge b::after {
  content: "";
  position: absolute;
  width: 10px;
  height: 10px;
  background: #ffd12a;
  border: 3px solid #081423;
}
.chapterGuardBreak .pixelShieldLarge b::before { left: -18px; top: 20px; }
.chapterGuardBreak .pixelShieldLarge b::after { right: -20px; bottom: 18px; background: #1689d7; }
.chapterGuardBreak > strong { background: #7d1a17; color: #fff2c0; }
.chapterGuardBreak > span { border-color: #ff735d; color: #ffd3c9; }

@keyframes chapterClockPulse {
  from { transform: translateY(0); }
  to { transform: translateY(-2px); }
}
@keyframes chapterShieldHit {
  0% { transform: translate(-50%,-50%) scale(.8); }
  55% { transform: translate(-50%,-50%) scale(1.12); }
  100% { transform: translate(-50%,-50%) scale(1); }
}
@keyframes chapterShieldBreak {
  0% { transform: translate(-50%,-50%) translateX(-4px); }
  30% { transform: translate(-50%,-50%) translateX(5px); }
  60% { transform: translate(-50%,-50%) translateX(-3px); }
  100% { transform: translate(-50%,-50%) translateX(0); }
}

@media (max-height: 667px) {
  .chapterTimeStop { left: 52px; top: 8px; transform: scale(.9); transform-origin: center; }
  .chapterGuardFx { transform: translate(-50%,-50%) scale(.88); }
}
'''
css.write_text(c)

progress = Path('PROGRESS.md')
pr = progress.read_text() if progress.exists() else ''
entry = '''\n## Original Chapter Battle clock + shield feedback\n- Added 8-bit CSS stopwatch art to CHAPTER BATTLE SKIP panels and enemy WAIT overlay.\n- SKIP now visibly shows the full clock count, ticks on the enemy turn, shows 0 / TIME UP, then clears.\n- Added 8-bit CSS shield art to BAR panels and a large board-centered barrier impact overlay.\n- Fully blocked attacks show BLOCK; overflow attacks show SHIELD BREAK before remaining HP damage. PIERCE continues to bypass the shield.\n- Chapter battle rules, damage values, enemy intent order, BUILD effects, and reward balance are unchanged.\n'''
if 'Original Chapter Battle clock + shield feedback' not in pr:
    progress.write_text(pr + entry)
