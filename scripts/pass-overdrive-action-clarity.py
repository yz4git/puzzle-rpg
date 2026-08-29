from pathlib import Path

p = Path("app/PrismOverdrive.tsx")
s = p.read_text()

def rep(old, new, label):
    global s
    if old not in s:
        raise SystemExit(f"MISSING {label}")
    s = s.replace(old, new, 1)

rep('type Props = { onExit?: () => void };', '''type Props = { onExit?: () => void };
type ActionFx = {
  token: number;
  kind: PanelType | "cascade" | "upgrade";
  title: string;
  detail: string;
  icon: string;
};''', 'ActionFx type')

rep('const [lastRank, setLastRank] = useState("");', '''const [lastRank, setLastRank] = useState("");
  const [focusIds, setFocusIds] = useState<Set<number>>(new Set());
  const [actionFx, setActionFx] = useState<ActionFx | null>(null);''', 'visual states')

rep('const lastTickRef = useRef(performance.now());', '''const lastTickRef = useRef(performance.now());
  const resolvingRef = useRef(false);
  const actionFxTokenRef = useRef(1);''', 'visual refs')

rep('if (current < timeStopUntilRef.current) return;', 'if (current < timeStopUntilRef.current || resolvingRef.current) return;', 'pause timer')
rep('setClearingIds(new Set()); setResolving(false); setLastGain(0); setLastRank("");', '''setClearingIds(new Set()); setFocusIds(new Set()); setActionFx(null);
    setResolving(false); resolvingRef.current = false; setLastGain(0); setLastRank("");''', 'reset states')

rep('''  function maybeOfferUpgrade(nextScore: number) {
    const threshold = UPGRADE_THRESHOLDS[levelRef.current];
    if (threshold == null || nextScore < threshold) return;
    const picked = chooseUpgrades(upgrades)[0];
    if (!picked) return;
    setUpgrades((current) => current.includes(picked.id) ? current : [...current, picked.id]);
    levelRef.current += 1;
    setRunLevel(levelRef.current);
    setLastRank(`LEVEL ${levelRef.current} • ${picked.name}!`);
    setMessage(`${picked.name} AUTO INSTALLED • KEEP BREAKING`);
    playSfx("skill");
  }''', '''  async function maybeOfferUpgrade(nextScore: number) {
    const threshold = UPGRADE_THRESHOLDS[levelRef.current];
    if (threshold == null || nextScore < threshold) return;
    const picked = chooseUpgrades(upgrades)[0];
    if (!picked) return;
    setUpgrades((current) => current.includes(picked.id) ? current : [...current, picked.id]);
    levelRef.current += 1;
    setRunLevel(levelRef.current);
    setLastRank(`LEVEL ${levelRef.current} • ${picked.name}!`);
    setMessage(`${picked.name} AUTO INSTALLED`);
    setActionFx({ token: actionFxTokenRef.current++, kind: "upgrade", title: `${picked.name} GET!`, detail: picked.description, icon: picked.icon });
    playSfx("skill");
    await sleep(520);
    setActionFx(null);
  }''', 'upgrade visual')

rep('''    setResolving(true);
    const group = connectedGroup(tiles, liveSeed);''', '''    setResolving(true);
    resolvingRef.current = true;
    const group = connectedGroup(tiles, liveSeed);''', 'resolution ref')

rep('''    if (liveSeed.type === "skip") {
      const addedMs = Math.min(3000, count * 250);
      timeRef.current = Math.min(RUN_MS + 20_000, timeRef.current + addedMs);
      setTimeLeft(timeRef.current);
      const stopMs = count >= 6 ? 2000 : count >= 4 ? 1000 : 350;
      timeStopUntilRef.current = Math.max(timeStopUntilRef.current, performance.now() + stopMs);
      setLastRank(`TIME STOP! • +${(addedMs / 1000).toFixed(1)} SEC`);
      setMessage(`SKIP ×${count} • CLOCK FROZEN • KEEP AIMING`);
      playSfx("skill");
    } else if (liveSeed.type === "barrier") {
      setLastRank(`FEVER +${count * (upgrades.includes("barOvercharge") ? 5 : 2)}`);
      setMessage(`BAR ×${count} • FEVER CHARGE`);
      playSfx("shield");
    } else if (liveSeed.type === "heal") {
      setLastRank("COMBO SAVED!");
      setMessage(`HEAL ×${count} • COMBO WINDOW EXTENDED`);
      playSfx("heal");
    } else {
      setLastRank(attackBlast ? "MEGA ATK!!" : count >= 6 ? "BIG BREAK!" : "ATK BREAK!");
      setMessage(attackBlast ? `ATK ×${count} • AREA BLAST` : `ATK ×${count} • SCORE BREAK`);
      playSfx("playerAttack");
    }

    const scored = scoreCluster(liveSeed.type, removed.size, 0);''', '''    let fxTitle = "";
    let fxDetail = "";
    if (liveSeed.type === "skip") {
      const addedMs = Math.min(3000, count * 250);
      timeRef.current = Math.min(RUN_MS + 20_000, timeRef.current + addedMs);
      setTimeLeft(timeRef.current);
      const stopMs = count >= 6 ? 2000 : count >= 4 ? 1000 : 350;
      timeStopUntilRef.current = Math.max(timeStopUntilRef.current, performance.now() + stopMs);
      fxTitle = `TIME STOP ×${count}`;
      fxDetail = `YELLOW SKIP → CLOCK STOP +${(addedMs / 1000).toFixed(1)} SEC`;
      setLastRank(`TIME STOP! • +${(addedMs / 1000).toFixed(1)} SEC`);
      setMessage("YELLOW SKIP → CLOCK STOPS");
      playSfx("skill");
    } else if (liveSeed.type === "barrier") {
      const feverGain = count * (upgrades.includes("barOvercharge") ? 5 : 2);
      fxTitle = `FEVER CHARGE ×${count}`;
      fxDetail = `BLUE BAR → FEVER +${feverGain}`;
      setLastRank(`FEVER +${feverGain}`);
      setMessage("BLUE BAR → FEVER GAUGE");
      playSfx("shield");
    } else if (liveSeed.type === "heal") {
      fxTitle = `COMBO LINK ×${count}`;
      fxDetail = "PINK HEAL → COMBO WINDOW EXTENDED";
      setLastRank("COMBO SAVED!");
      setMessage("PINK HEAL → MORE TIME FOR NEXT COMBO");
      playSfx("heal");
    } else {
      fxTitle = attackBlast ? `MEGA ATTACK ×${count}!` : `ATTACK ×${count}!`;
      fxDetail = attackBlast ? `RED ATK → AREA BLAST • ${removed.size} PANELS` : `RED ATK → SCORE BREAK • ${removed.size} PANELS`;
      setLastRank(attackBlast ? "MEGA ATK!!" : count >= 6 ? "BIG BREAK!" : "ATK BREAK!");
      setMessage(attackBlast ? "RED ATK → NEARBY PANELS ALSO BREAK" : "RED ATK → SCORE");
      playSfx("playerAttack");
    }

    setFocusIds(new Set(removed));
    setActionFx({ token: actionFxTokenRef.current++, kind: liveSeed.type, title: fxTitle, detail: fxDetail, icon: GLYPH[liveSeed.type] });
    await sleep(360);

    const scored = scoreCluster(liveSeed.type, removed.size, 0);''', 'main action staging')

rep('''    setClearingIds(removed);
    playSfx(count >= 8 ? "cascade" : "drop");
    await sleep(95);''', '''    setFocusIds(new Set());
    setClearingIds(removed);
    playSfx(count >= 8 ? "cascade" : "drop");
    await sleep(190);''', 'main clear')
rep('''    setTiles(currentTiles); setQueues(currentQueues); setClearingIds(new Set());
    await sleep(110);

    const cascadeThreshold''', '''    setTiles(currentTiles); setQueues(currentQueues); setClearingIds(new Set());
    setActionFx(null);
    await sleep(240);

    const cascadeThreshold''', 'main settle')

rep('''      const autoIds = new Set(auto.map((tile) => tile.id));
      comboRef.current += 1; setCombo(comboRef.current); setMaxCombo((value) => Math.max(value, comboRef.current));
      comboExpireRef.current = performance.now() + 2500 + (upgrades.includes("comboCore") ? 900 : 0);
      const autoScore = scoreCluster(auto[0]!.type, auto.length, depth);
      nextScore = addScore(autoScore.points, `CHAIN ${depth}!`);
      setMessage(`AUTO CASCADE • +${Math.round(autoScore.points).toLocaleString()} • DON'T STOP`);
      addFever(auto.length * 2.4);
      setClearingIds(autoIds);
      playSfx("cascade");
      await sleep(90);
      settled = settleBoard(currentTiles, currentQueues, autoIds, performance.now() < feverUntilRef.current);
      currentTiles = settled.tiles; currentQueues = settled.queues;
      setTiles(currentTiles); setQueues(currentQueues); setClearingIds(new Set());
      await sleep(90);''', '''      const autoIds = new Set(auto.map((tile) => tile.id));
      const autoType = auto[0]!.type;
      comboRef.current += 1; setCombo(comboRef.current); setMaxCombo((value) => Math.max(value, comboRef.current));
      comboExpireRef.current = performance.now() + 2500 + (upgrades.includes("comboCore") ? 900 : 0);
      const autoScore = scoreCluster(autoType, auto.length, depth);
      setFocusIds(autoIds);
      setActionFx({ token: actionFxTokenRef.current++, kind: "cascade", title: `AUTO CASCADE → CHAIN ${depth}!`, detail: `${LABEL[autoType]} ×${auto.length} CONNECTED BY THE DROP`, icon: "↯" });
      setLastRank(`CHAIN ${depth}!`);
      setMessage(`AUTO MATCH FOUND • ${LABEL[autoType]} ×${auto.length} WILL BREAK`);
      playSfx("setup");
      await sleep(420);

      nextScore = addScore(autoScore.points, `CHAIN ${depth}!`);
      setMessage(`CHAIN ${depth} SCORE +${Math.round(autoScore.points).toLocaleString()}`);
      addFever(auto.length * 2.4);
      setFocusIds(new Set());
      setClearingIds(autoIds);
      playSfx("cascade");
      await sleep(220);
      settled = settleBoard(currentTiles, currentQueues, autoIds, performance.now() < feverUntilRef.current);
      currentTiles = settled.tiles; currentQueues = settled.queues;
      setTiles(currentTiles); setQueues(currentQueues); setClearingIds(new Set());
      await sleep(280);''', 'cascade staging')

rep('''      setJackpotFlash(false);
    }

    maybeOfferUpgrade(nextScore);
    setResolving(false);''', '''      setJackpotFlash(false);
    }

    setActionFx(null);
    setFocusIds(new Set());
    await maybeOfferUpgrade(nextScore);
    setResolving(false);
    resolvingRef.current = false;''', 'resolution finish')

rep('className={`${styles.tile} ${styles[tile.type]} ${clearingIds.has(tile.id) ? styles.clearing : ""}`}', 'className={`${styles.tile} ${styles[tile.type]} ${focusIds.has(tile.id) ? styles.focused : ""} ${clearingIds.has(tile.id) ? styles.clearing : ""}`}', 'focus class')
rep('''      </div>
      {jackpotFlash ? <div className={styles.jackpotFlash}>''', '''      </div>
      {actionFx ? <div key={actionFx.token} className={styles.actionFx} data-kind={actionFx.kind} role="status">
        <i>{actionFx.icon}</i><strong>{actionFx.title}</strong><span>{actionFx.detail}</span>
      </div> : null}
      {jackpotFlash ? <div className={styles.jackpotFlash}>''', 'action overlay')

p.write_text(s)

css = Path("app/PrismOverdrive.module.css")
cs = css.read_text()
marker = "/* PASS 40 — ACTION CLARITY / READABLE CASCADE */"
if marker not in cs:
    cs += '''\n\n/* PASS 40 — ACTION CLARITY / READABLE CASCADE */
.focused{z-index:8!important;filter:brightness(1.8)!important;transform:scale(.92)!important;outline:4px solid #fff!important;outline-offset:-5px;animation:focusBeat 280ms steps(2,end) infinite!important}
@keyframes focusBeat{50%{filter:brightness(2.7)!important;transform:scale(.86)!important}}
.clearing{animation-duration:180ms!important}
.actionFx{position:absolute;z-index:24;left:50%;top:50%;width:min(88%,330px);min-height:96px;box-sizing:border-box;transform:translate(-50%,-50%);display:grid;grid-template-columns:58px 1fr;grid-template-rows:auto auto;align-items:center;gap:2px 8px;padding:10px 12px;border:4px solid #fff;background:#050914;box-shadow:0 0 0 3px #000,7px 8px #000;pointer-events:none;animation:actionFxIn 180ms steps(3,end)}
.actionFx i{grid-row:1/3;width:52px;height:52px;display:grid;place-items:center;border:3px solid currentColor;background:#090d18;font:1000 31px/1 monospace;font-style:normal;text-shadow:2px 2px #000}
.actionFx strong{align-self:end;font-size:clamp(13px,4vw,18px);line-height:1.05;letter-spacing:.04em;text-shadow:2px 2px #000}
.actionFx span{align-self:start;font-size:clamp(7px,2.2vw,10px);line-height:1.35;color:#fff}
.actionFx[data-kind="attack"]{color:#ff765e;border-color:#ff654c;background:#2d0910}
.actionFx[data-kind="heal"]{color:#ff86d5;border-color:#ff6bc8;background:#2a0820}
.actionFx[data-kind="barrier"]{color:#73e7ff;border-color:#54d9ff;background:#062431}
.actionFx[data-kind="skip"]{color:#fff578;border-color:#fff26d;background:#282306}
.actionFx[data-kind="cascade"]{color:#fff578;border-color:#75f6ff;background:#120a31;min-height:108px}
.actionFx[data-kind="cascade"] strong{font-size:clamp(15px,4.6vw,21px);color:#fff578}
.actionFx[data-kind="upgrade"]{color:#d9a0ff;border-color:#b86cff;background:#180b2c}
@keyframes actionFxIn{0%{transform:translate(-50%,-50%) scale(.72);opacity:0}65%{transform:translate(-50%,-50%) scale(1.06);opacity:1}100%{transform:translate(-50%,-50%) scale(1);opacity:1}}
@media(max-height:700px){.actionFx{min-height:82px;padding:7px 9px;grid-template-columns:48px 1fr}.actionFx i{width:42px;height:42px;font-size:25px}.actionFx[data-kind="cascade"]{min-height:88px}}
'''
css.write_text(cs)
