from pathlib import Path

p=Path('app/PrismOverdrive.tsx')
s=p.read_text()

def rep(old,new,label):
    global s
    if old not in s: raise SystemExit(f'MISSING {label}')
    s=s.replace(old,new,1)

rep('import { playSfx, primeAudio } from "./gameAudio";', 'import { playOverdriveSfx, playSfx, primeAudio } from "./gameAudio";', 'audio import')

# Layer stronger purpose-built sounds on the important reward events.
rep('''      setMessage("OVER FEVER • BREAK EVERYTHING");
      playSfx("cascade");''','''      setMessage("OVER FEVER • BREAK EVERYTHING");
      playSfx("cascade");
      playOverdriveSfx("fever", 1.25);''','over fever audio')
rep('''      setMessage("3 COLOR DROP • CASCADE CHANCE UP");
      playSfx("cascade");''','''      setMessage("3 COLOR DROP • CASCADE CHANCE UP");
      playSfx("cascade");
      playOverdriveSfx("fever", 1);''','fever audio')
rep('''    playSfx("skill");
    await sleep(520);''','''    playSfx("skill");
    playOverdriveSfx("upgrade", 1);
    await sleep(620);''','upgrade audio')
rep('''      setMessage(attackBlast ? "RED ATK → NEARBY PANELS ALSO BREAK" : "RED ATK → SCORE");
      playSfx("playerAttack");''','''      setMessage(attackBlast ? "RED ATK → NEARBY PANELS ALSO BREAK" : "RED ATK → SCORE");
      playSfx("playerAttack");
      playOverdriveSfx("attack", attackBlast ? 1.35 : Math.min(1.2, .72 + count * .06));''','attack audio')
rep('''      playSfx("setup");
      await sleep(420);''','''      playSfx("setup");
      playOverdriveSfx("cascade", 0.72 + depth * .16);
      await sleep(520);''','cascade anticipation')
rep('''      playSfx("cascade");
      await sleep(220);''','''      playSfx("cascade");
      playOverdriveSfx("cascade", 1 + depth * .18);
      await sleep(260);''','cascade impact')
rep('''      playSfx("stageClear");
      await sleep(260);''','''      playSfx("stageClear");
      playOverdriveSfx("jackpot", 1.35);
      await sleep(520);''','jackpot audio')

# Keep explanatory card outside the board. Remove old in-board actionFx block and add a compact external feed.
old='''      {actionFx ? <div key={actionFx.token} className={styles.actionFx} data-kind={actionFx.kind} role="status">
        <i>{actionFx.icon}</i><strong>{actionFx.title}</strong><span>{actionFx.detail}</span>
      </div> : null}
      {jackpotFlash ? <div className={styles.jackpotFlash}>'''
new='''      {actionFx ? <div key={`burst-${actionFx.token}`} className={styles.boardBurst} data-kind={actionFx.kind} aria-hidden="true"><i /><b /><u /></div> : null}
      {jackpotFlash ? <div className={styles.jackpotFlash}>'''
rep(old,new,'move action card out')

rep('''    <section className={styles.runInfo}>''','''    <section className={styles.actionFeed} data-kind={actionFx?.kind ?? "idle"} aria-live="polite">
      {actionFx ? <div key={actionFx.token} className={styles.actionFx} data-kind={actionFx.kind} role="status">
        <i>{actionFx.icon}</i><strong>{actionFx.title}</strong><span>{actionFx.detail}</span>
      </div> : <div className={styles.actionIdle}><b>BREAK!</b><span>WATCH THE BOARD → CHAIN THE NEXT CLUSTER</span></div>}
    </section>

    <section className={styles.runInfo}>''','external feed')

# Add board state hook for full-frame dopamine accents without covering tiles.
rep('<section className={styles.boardWrap}>','<section className={styles.boardWrap} data-impact={actionFx?.kind ?? "idle"}>','board impact data')

p.write_text(s)

# Audio helper: high-energy layered effects, still behind existing master limiter.
a=Path('app/gameAudio.ts')
asrc=a.read_text()
anchor='''export function setSfxEnabled(enabled: boolean) {
  sfxEnabled = enabled;
}
'''
if anchor not in asrc: raise SystemExit('MISSING audio anchor')
helper=r'''
export type OverdriveSfx = "attack" | "cascade" | "fever" | "jackpot" | "upgrade";

/** Dense arcade-style reward sounds used only by PRISM OVERDRIVE. */
export function playOverdriveSfx(name: OverdriveSfx, intensity = 1) {
  if (!sfxEnabled) return;
  const c = audioContext();
  if (!c) return;
  const t = c.currentTime;
  const k = Math.max(0.55, Math.min(1.45, intensity));
  if (name === "attack") {
    sweep(140, 1180, t, .105, .09 * k, "sawtooth");
    sweep(1760, 420, t + .045, .12, .065 * k, "square");
    tone(82, t + .085, .12, .09 * k, "triangle");
    noise(t + .07, .085, .075 * k);
    return;
  }
  if (name === "cascade") {
    arp([659, 784, 988, 1175, 1568, 1976], .026, .055 * k, "square");
    sweep(220, 1320, t + .06, .13, .055 * k, "sawtooth");
    noise(t + .11, .045, .03 * k);
    return;
  }
  if (name === "fever") {
    arp([392, 523, 659, 784, 1047, 1319, 1568], .038, .065 * k, "square");
    sweep(110, 880, t, .22, .07 * k, "sawtooth");
    noise(t + .15, .07, .05 * k);
    return;
  }
  if (name === "jackpot") {
    arp([523, 659, 784, 1047, 1319, 1568, 2093], .045, .075 * k, "square");
    tone(98, t, .22, .11 * k, "triangle");
    tone(196, t + .12, .2, .095 * k, "triangle");
    noise(t + .18, .12, .075 * k);
    return;
  }
  arp([330, 494, 659, 988, 1319, 1976], .04, .065 * k, "square");
  sweep(180, 1280, t + .05, .18, .055 * k, "sawtooth");
}
'''
asrc=asrc.replace(anchor,anchor+helper,1)
a.write_text(asrc)

css=Path('app/PrismOverdrive.module.css')
cs=css.read_text()
marker='/* PASS 41 — BOARD-FIRST DOPAMINE FEEDBACK */'
if marker not in cs:
  cs += r'''

/* PASS 41 — BOARD-FIRST DOPAMINE FEEDBACK */
/* Explanations live below the board. Nothing opaque is allowed to sit over the playfield. */
.actionFeed{position:relative;width:min(96vw,410px);height:74px;margin:5px auto 0;box-sizing:border-box;border:2px solid #344260;background:#030611;overflow:hidden;box-shadow:0 3px #000,inset 0 0 0 1px #101a2d}
.actionFx{position:relative!important;z-index:1!important;left:auto!important;top:auto!important;width:100%!important;min-height:70px!important;height:70px!important;transform:none!important;display:grid!important;grid-template-columns:52px 1fr!important;grid-template-rows:1fr 1fr!important;gap:0 8px!important;padding:7px 10px!important;border:0!important;border-left:5px solid currentColor!important;box-shadow:none!important;animation:feedPunch 180ms steps(3,end)!important}
.actionFx i{grid-row:1/3!important;width:42px!important;height:42px!important;align-self:center!important;border:2px solid currentColor!important;font-size:25px!important;box-shadow:3px 3px #000!important}
.actionFx strong{align-self:end!important;font-size:clamp(12px,3.8vw,17px)!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.actionFx span{align-self:start!important;font-size:clamp(7px,2vw,9px)!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.actionIdle{height:100%;display:grid;grid-template-columns:auto 1fr;align-items:center;gap:10px;padding:0 12px;color:#70809d;font-size:7px;letter-spacing:.05em}.actionIdle b{font-size:13px;color:#9eacc5}
@keyframes feedPunch{0%{transform:translateX(-18px)!important;filter:brightness(2.5);opacity:.2}60%{transform:translateX(3px)!important;filter:brightness(1.6);opacity:1}100%{transform:none!important;filter:none}}

/* Board-only feedback: outlines, rings and rays leave every panel readable. */
.boardWrap{isolation:isolate}
.boardWrap::before,.boardWrap::after{content:"";position:absolute;pointer-events:none;z-index:12;opacity:0}
.boardWrap[data-impact="attack"]::before{inset:18px max(2%,8px) 0;border:5px solid #ff654c;box-shadow:inset 0 0 0 5px rgba(255,101,76,.18),0 0 22px #ff402e;animation:impactFrame 430ms steps(4,end)}
.boardWrap[data-impact="barrier"]::before{inset:18px max(2%,8px) 0;border:5px solid #54d9ff;box-shadow:inset 0 0 0 5px rgba(84,217,255,.15),0 0 24px #54d9ff;animation:impactFrame 430ms steps(4,end)}
.boardWrap[data-impact="heal"]::before{inset:18px max(2%,8px) 0;border:5px solid #ff6bc8;box-shadow:inset 0 0 0 5px rgba(255,107,200,.13),0 0 24px #ff6bc8;animation:impactFrame 430ms steps(4,end)}
.boardWrap[data-impact="skip"]::before{inset:18px max(2%,8px) 0;border:5px solid #fff26d;box-shadow:inset 0 0 0 5px rgba(255,242,109,.13),0 0 24px #fff26d;animation:impactFrame 430ms steps(4,end)}
.boardWrap[data-impact="cascade"]::before{inset:18px max(2%,8px) 0;border:6px double #75f6ff;box-shadow:inset 0 0 20px rgba(117,246,255,.28),0 0 30px #8d35dc;animation:cascadeFrame 520ms steps(5,end) infinite alternate}
@keyframes impactFrame{0%{opacity:0;transform:scale(.96)}30%{opacity:1;transform:scale(1.015)}75%{opacity:.75}100%{opacity:0;transform:scale(1)}}
@keyframes cascadeFrame{from{opacity:.45;transform:scale(.99);filter:hue-rotate(0)}to{opacity:1;transform:scale(1.012);filter:hue-rotate(40deg)}}

.boardBurst{position:absolute;z-index:11;inset:18px max(2%,8px) 0;pointer-events:none;overflow:hidden}
.boardBurst::before,.boardBurst::after,.boardBurst i,.boardBurst b,.boardBurst u{content:"";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none}
.boardBurst::before{width:8%;height:8%;border:4px solid currentColor;border-radius:50%;animation:burstRing 520ms steps(7,end) forwards}
.boardBurst::after{width:2px;height:130%;background:currentColor;box-shadow:38px 0 currentColor,-38px 0 currentColor,76px 0 currentColor,-76px 0 currentColor;opacity:.3;animation:rayFlash 360ms steps(4,end) forwards}
.boardBurst i{width:130%;height:2px;background:currentColor;box-shadow:0 38px currentColor,0 -38px currentColor,0 76px currentColor,0 -76px currentColor;opacity:.26;animation:rayFlash 360ms steps(4,end) forwards}
.boardBurst b{width:14px;height:14px;background:currentColor;box-shadow:42px 26px currentColor,-48px 34px currentColor,60px -44px currentColor,-70px -38px currentColor,15px 82px currentColor,-18px -76px currentColor;animation:pixelBurst 520ms steps(5,end) forwards}
.boardBurst u{width:68%;height:68%;border:2px dashed currentColor;border-radius:50%;opacity:.5;animation:spinBurst 700ms steps(10,end) forwards}
.boardBurst[data-kind="attack"]{color:#ff654c}.boardBurst[data-kind="heal"]{color:#ff6bc8}.boardBurst[data-kind="barrier"]{color:#54d9ff}.boardBurst[data-kind="skip"]{color:#fff26d}.boardBurst[data-kind="cascade"]{color:#75f6ff}.boardBurst[data-kind="upgrade"]{color:#d9a0ff}
@keyframes burstRing{0%{width:4%;height:4%;opacity:1}70%{opacity:.7}100%{width:105%;height:105%;opacity:0}}
@keyframes rayFlash{0%{opacity:0}20%{opacity:.65}100%{opacity:0}}
@keyframes pixelBurst{0%{opacity:1;transform:translate(-50%,-50%) scale(.4)}100%{opacity:0;transform:translate(-50%,-50%) scale(2.5) rotate(30deg)}}
@keyframes spinBurst{0%{opacity:.65;transform:translate(-50%,-50%) scale(.35) rotate(0)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.3) rotate(140deg)}}

/* More physical tile motion and clearer chain anticipation. */
.tile{transition:left 150ms steps(5,end),top 170ms cubic-bezier(.18,.8,.25,1.35),transform 90ms steps(3,end),opacity 90ms steps(3,end)!important}
.focused{outline-width:5px!important;box-shadow:0 0 0 2px #000,0 0 18px currentColor,inset 0 0 12px rgba(255,255,255,.22)!important;animation:focusBeat 330ms steps(3,end) infinite!important}
.clearing{animation-duration:230ms!important;filter:brightness(3) saturate(1.6)!important}
@keyframes pixelBreak{0%{transform:scale(1);opacity:1}25%{transform:scale(1.12);filter:brightness(3)}55%{transform:scale(.82) rotate(2deg)}78%{transform:scale(1.22);opacity:.8}100%{transform:scale(.08);opacity:0}}

/* Fever states pulse the chrome instead of washing out the board. */
.fever .hypeRow{filter:drop-shadow(0 0 5px #54d9ff)}
.fever .feverMeter strong{animation:meterPulse 420ms steps(2,end) infinite}
.overFever .topbar,.overFever .hypeRow{animation:overdriveChrome 360ms steps(2,end) infinite alternate}
@keyframes meterPulse{50%{transform:scale(1.12);filter:brightness(1.7)}}
@keyframes overdriveChrome{from{filter:brightness(1)}to{filter:brightness(1.35) saturate(1.35)}}
.jackpotFlash{background:rgba(3,2,14,.42)!important;backdrop-filter:none!important}.jackpotFlash strong{font-size:42px!important;animation:jackpotPunch 260ms steps(4,end) infinite alternate}@keyframes jackpotPunch{to{transform:scale(1.12);filter:brightness(1.7)}}

@media(max-height:700px){.actionFeed{height:58px;margin-top:3px}.actionFx{height:54px!important;min-height:54px!important;padding:4px 7px!important;grid-template-columns:42px 1fr!important}.actionFx i{width:34px!important;height:34px!important;font-size:20px!important}.actionFx strong{font-size:11px!important}.actionFx span{font-size:6px!important}.actionIdle{font-size:6px}.actionIdle b{font-size:10px}}
'''
css.write_text(cs)
