from pathlib import Path
p=Path('app/PrismOverdrive.tsx')
s=p.read_text()

def rep(old,new):
    global s
    if old not in s:
        raise SystemExit('missing anchor: '+old[:120])
    s=s.replace(old,new,1)

rep('''function makeTarget(phase: RunPhase, token: number): PrismTarget {
  const idx = phaseIndex(phase);
  const reward = [1800, 2800, 4200, 6200][idx]!;
  const roll = Math.random();''','''function makeTarget(phase: RunPhase, token: number): PrismTarget {
  const idx = phaseIndex(phase);
  const reward = [1800, 2800, 4200, 6200][idx]!;
  if (phase === "build" && token <= 2) {
    const type = TYPES[Math.floor(Math.random() * TYPES.length)]!;
    const need = 4;
    return { token, kind: "color", label: `${LABEL[type]} ×${need}+ BREAK`, reward: 1400, type, need, progress: 0 };
  }
  const roll = Math.random();''')

rep('''  const beginner = moves < 6;
  const showBeginnerTarget = moves >= 2;''','''  const beginner = moves < 6;
  const routeLesson = moves >= 6 && moves < 10;
  const fullSystems = moves >= 10;
  const showBeginnerTarget = moves >= 2;''')
rep('''  const guideTitle = moves === 0 ? "STEP 1  TAP A GLOWING GROUP" : moves < 2 ? "STEP 2  MAKE BIG GROUPS" : moves < 6 ? "STEP 3  MATCH THE TARGET" : "ADVANCED SYSTEMS ONLINE";
  const guideText = moves === 0 ? "Connected tiles break together. Follow TAP." : moves < 2 ? "Bigger connected group = bigger score." : moves < 6 ? "Clear the TARGET shown below. Follow TAP when it helps." : "ROUTE sets up chains. CASH OUT saves banked score. Tap ? anytime.";''','''  const recommendedLead = [...recommended][0] ?? -1;
  const guideTitle = moves === 0 ? "STEP 1  TAP A GLOWING GROUP" : moves < 2 ? "STEP 2  MAKE BIG GROUPS" : moves < 6 ? "STEP 3  MATCH THE TARGET" : moves < 10 ? "STEP 4  USE ROUTE" : "FULL SYSTEMS ONLINE";
  const guideText = moves === 0 ? "Connected tiles break together. Follow TAP." : moves < 2 ? "Bigger connected group = bigger score." : moves < 6 ? "Clear the simple TARGET below. Follow TAP when it helps." : moves < 10 ? "ROUTE marks a move that sets up the scanned next tile." : "CASH OUT saves score. Three TARGETS summon BOSS CORE. Tap ? anytime.";''')

rep('{!beginner ? <section className={styles.hypeRow}>','{fullSystems ? <section className={styles.hypeRow}>')
rep('''    {(!beginner || showBeginnerTarget) ? <section className={`${styles.strategyPanel} ${beginner ? styles.strategyBeginner : ""}`} data-target-pulse={targetPulse ? "true" : "false"} aria-label="Overdrive strategy panel">''','''    {(!beginner || showBeginnerTarget) ? <section className={`${styles.strategyPanel} ${beginner ? styles.strategyBeginner : routeLesson ? styles.strategyRouteLesson : ""}`} data-target-pulse={targetPulse ? "true" : "false"} aria-label="Overdrive strategy panel">''')
rep('{!beginner ? <div className={styles.phaseCard}','{fullSystems ? <div className={styles.phaseCard}')
rep('{!beginner ? <div className={styles.scanCard}','{moves >= 6 ? <div className={styles.scanCard}')
rep('{!beginner ? <button className={styles.cashOut}','{fullSystems ? <button className={styles.cashOut}')
rep('{!beginner ? <div className={styles.missionCard}','{fullSystems ? <div className={styles.missionCard}')
rep('{!beginner ? <div className={styles.chargeRow}','{fullSystems ? <div className={styles.chargeRow}')
rep('{!beginner ? <div className={styles.scanMarker}','{moves >= 6 ? <div className={styles.scanMarker}')
rep('${!beginner && routeIds.has(tile.id) ? styles.routeReady : ""} ${beginner && recommended.has(tile.id) ? styles.recommended : ""}`','${moves >= 6 && routeIds.has(tile.id) ? styles.routeReady : ""} ${beginner && recommended.has(tile.id) ? styles.recommended : ""} ${beginner && tile.id === recommendedLead ? styles.recommendedLead : ""}`')
rep('''    {!beginner ? <>
      <section className={styles.runInfo}>''','''    {fullSystems ? <>
      <section className={styles.runInfo}>''')

p.write_text(s)

p=Path('app/PrismOverdrive.module.css')
c=p.read_text()+'''\n\n/* PASS 51 — PROGRESSIVE ONBOARDING / PRESERVE TILE IDENTITY */\n.strategyRouteLesson{grid-template-columns:1.3fr 1fr!important;min-height:48px!important}.strategyRouteLesson .targetCard,.strategyRouteLesson .scanCard{min-height:40px}\n.recommended{background:var(--fill)!important;color:#fff!important;filter:none!important;transform:none!important;animation:recommendedOutline 780ms steps(2,end) infinite!important;box-shadow:inset 0 0 0 2px #fff36d,inset 0 0 0 4px var(--edge),0 0 9px #fff36d!important}\n.recommended::after{content:""!important;padding:0!important;border:0!important;background:transparent!important}\n.recommendedLead::after{content:"TAP"!important;position:absolute!important;right:2px!important;top:2px!important;width:auto!important;height:auto!important;padding:2px 3px!important;border:1px solid #fff!important;background:#fff36d!important;color:#080a0e!important;font:1000 6px/1 monospace!important;opacity:1!important;z-index:7!important}\n@keyframes recommendedOutline{50%{box-shadow:inset 0 0 0 3px #fff,inset 0 0 0 5px #fff36d,0 0 16px #fff36d!important}}\n@media(max-height:700px){.strategyRouteLesson{min-height:39px!important}.strategyRouteLesson .targetCard,.strategyRouteLesson .scanCard{min-height:33px}}\n@media(prefers-reduced-motion:reduce){.recommended{animation:none!important}}\n'''
p.write_text(c)
