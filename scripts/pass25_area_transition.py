from pathlib import Path

root = Path('.')
tsx = root / 'app/rpg/RPGMode.tsx'
css = root / 'app/rpg/RPGMode.module.css'
progress = root / 'PROGRESS.md'

text = tsx.read_text()

old = 'type ResultState = { title: string; lines: string[]; ending?: boolean } | null;\n'
new = old + 'type AreaTransitionState = { phase: "depart" | "arrive"; targetName: string; targetKind: string; label: string } | null;\n'
if old not in text:
    raise SystemExit('ResultState target not found')
text = text.replace(old, new, 1)

old = '  const [fieldReturn, setFieldReturn] = useState(false);\n'
new = old + '  const [areaTransition, setAreaTransition] = useState<AreaTransitionState>(null);\n'
if old not in text:
    raise SystemExit('fieldReturn state target not found')
text = text.replace(old, new, 1)

old = '  const heldTimer = useRef<number | null>(null);\n'
new = old + '  const transitionTimer = useRef<number | null>(null);\n  const arrivalTimer = useRef<number | null>(null);\n'
if old not in text:
    raise SystemExit('heldTimer target not found')
text = text.replace(old, new, 1)

old = '  function move(direction: Direction) {\n    if (screen !== "overworld" || service || battle || result) return;\n'
new = '  function move(direction: Direction) {\n    if (screen !== "overworld" || service || battle || result || areaTransition) return;\n'
if old not in text:
    raise SystemExit('move guard target not found')
text = text.replace(old, new, 1)

old = '  function interact() {\n    if (screen === "dialogue" || screen === "event") { advanceDialogue(); return; }\n'
new = '  function interact() {\n    if (areaTransition) return;\n    if (screen === "dialogue" || screen === "event") { advanceDialogue(); return; }\n'
if old not in text:
    raise SystemExit('interact target not found')
text = text.replace(old, new, 1)

old = '  function openMenu() { if (screen === "overworld") { primeAudio(); playSfx("uiSelect"); setService(null); setScreen("menu"); } }\n'
new = '  function openMenu() { if (screen === "overworld" && !areaTransition) { primeAudio(); playSfx("uiSelect"); setService(null); setScreen("menu"); } }\n'
if old not in text:
    raise SystemExit('openMenu target not found')
text = text.replace(old, new, 1)

old = '''  function transitionMap(targetMap: string, position: Vec2, label: string) {
    const destination = MAPS[targetMap];
    if (!destination) return;
    primeAudio(); playSfx("door");
    const isTown = destination.kind === "town";
    commit((current) => {
      const next = { ...current, mapId: targetMap, position, direction: "up" as Direction, encounterMeter: encounterReset(current), lastInn: isTown ? { mapId: targetMap, position } : current.lastInn };
      saveGame(next); return next;
    });
    setNotice(label);
  }
'''
new = '''  function transitionMap(targetMap: string, position: Vec2, label: string) {
    const destination = MAPS[targetMap];
    if (!destination || areaTransition) return;
    primeAudio(); playSfx("door");
    const visual = { targetName: destination.name, targetKind: destination.kind, label };
    setAreaTransition({ ...visual, phase: "depart" });
    if (transitionTimer.current) window.clearTimeout(transitionTimer.current);
    if (arrivalTimer.current) window.clearTimeout(arrivalTimer.current);
    transitionTimer.current = window.setTimeout(() => {
      const isTown = destination.kind === "town";
      commit((current) => {
        const next = { ...current, mapId: targetMap, position, direction: "up" as Direction, encounterMeter: encounterReset(current), lastInn: isTown ? { mapId: targetMap, position } : current.lastInn };
        saveGame(next); return next;
      });
      setNotice(label);
      setAreaTransition({ ...visual, phase: "arrive" });
      arrivalTimer.current = window.setTimeout(() => setAreaTransition(null), 420);
    }, 180);
  }
'''
if old not in text:
    raise SystemExit('transitionMap target not found')
text = text.replace(old, new, 1)

old = '  useEffect(() => () => { stopHold(); stopRpgMusic(); setSfxEnabled(true); }, []);\n'
new = '  useEffect(() => () => { stopHold(); if (transitionTimer.current) window.clearTimeout(transitionTimer.current); if (arrivalTimer.current) window.clearTimeout(arrivalTimer.current); stopRpgMusic(); setSfxEnabled(true); }, []);\n'
if old not in text:
    raise SystemExit('cleanup target not found')
text = text.replace(old, new, 1)

old = '    <main className={styles.rpg} data-map={map.id} data-kind={map.kind} data-returning={fieldReturn ? "true" : "false"}>\n'
new = '''    <main className={styles.rpg} data-map={map.id} data-kind={map.kind} data-returning={fieldReturn ? "true" : "false"} data-area-phase={areaTransition?.phase ?? "none"}>
      {areaTransition ? <div className={styles.areaTransition} data-phase={areaTransition.phase} data-kind={areaTransition.targetKind} role="status" aria-live="polite">
        <span>{areaTransition.phase === "depart" ? "TRAVEL" : "AREA"}</span><strong>{areaTransition.targetName}</strong><small>{areaTransition.label}</small>
      </div> : null}
'''
if old not in text:
    raise SystemExit('main root target not found')
text = text.replace(old, new, 1)

tsx.write_text(text)

addition = r'''

/* SFC visual reconstruction pass 25 — area transitions */
.areaTransition{--area-accent:var(--accent);position:fixed;z-index:190;inset:0;display:grid;place-content:center;justify-items:center;gap:7px;padding:max(18px,env(safe-area-inset-top)) 20px max(18px,env(safe-area-inset-bottom));pointer-events:auto;overflow:hidden;background:#030307;color:#fff4d5;text-align:center;isolation:isolate}
.areaTransition::before{content:"";position:absolute;z-index:-2;inset:0;background:repeating-linear-gradient(0deg,transparent 0 3px,rgba(255,255,255,.035) 4px),radial-gradient(circle at 50% 47%,color-mix(in srgb,var(--area-accent) 24%,#11101a),#030307 66%)}
.areaTransition::after{content:"";position:absolute;z-index:-1;left:0;right:0;top:50%;height:2px;transform:translateY(-50%);background:linear-gradient(90deg,transparent,var(--area-accent) 22% 78%,transparent);box-shadow:0 -34px color-mix(in srgb,var(--area-accent) 18%,transparent),0 34px color-mix(in srgb,var(--area-accent) 18%,transparent)}
.areaTransition[data-kind="town"]{--area-accent:#f2d273}.areaTransition[data-kind="training"]{--area-accent:#79dbe8}.areaTransition[data-kind="dungeon"]{--area-accent:#b69ae5}.areaTransition[data-kind="world"]{--area-accent:#9dc86a}
.areaTransition span{padding:3px 8px;border-block:1px solid color-mix(in srgb,var(--area-accent) 64%,#6e6770);color:var(--area-accent);font:900 6px/1 monospace;letter-spacing:.24em;text-shadow:1px 1px #000}
.areaTransition strong{max-width:390px;color:#fff5d6;font:1000 clamp(20px,7vw,32px)/1.05 monospace;letter-spacing:.02em;text-shadow:2px 0 #09070d,-2px 0 #09070d,0 2px #09070d,4px 4px #000}
.areaTransition small{max-width:340px;color:#aaa6ae;font:900 7px/1.35 monospace;letter-spacing:.06em;text-shadow:1px 1px #000}
.areaTransition[data-phase="depart"]{animation:areaDepart 180ms steps(6,end) both}.areaTransition[data-phase="depart"]>span,.areaTransition[data-phase="depart"]>strong,.areaTransition[data-phase="depart"]>small{animation:areaDepartText 180ms steps(4,end) both}.areaTransition[data-phase="arrive"]{animation:areaArrive 420ms steps(7,end) both}.areaTransition[data-phase="arrive"] strong{animation:areaNameResolve 420ms steps(6,end) both}
@keyframes areaDepart{0%{opacity:0;clip-path:inset(48% 0)}20%{opacity:1;clip-path:inset(34% 0)}55%{clip-path:inset(15% 0)}100%{opacity:1;clip-path:inset(0)}}@keyframes areaDepartText{0%,52%{opacity:0;transform:translateY(5px)}100%{opacity:.72;transform:none}}@keyframes areaArrive{0%{opacity:1;clip-path:inset(0)}58%{opacity:1;clip-path:inset(0)}78%{opacity:.58;clip-path:inset(20% 0)}100%{opacity:0;clip-path:inset(48% 0)}}@keyframes areaNameResolve{0%{opacity:0;transform:translateY(6px);filter:brightness(2)}20%{opacity:1;transform:translateY(-1px)}56%{transform:none;filter:none}82%{opacity:1}100%{opacity:0}}
@media(max-height:700px){.areaTransition{gap:5px}.areaTransition strong{font-size:20px}.areaTransition small{font-size:6px}}
@media(prefers-reduced-motion:reduce){.areaTransition[data-phase="depart"],.areaTransition[data-phase="arrive"],.areaTransition[data-phase="depart"]>span,.areaTransition[data-phase="depart"]>strong,.areaTransition[data-phase="depart"]>small,.areaTransition[data-phase="arrive"] strong{animation-duration:1ms}}
'''
css.write_text(css.read_text() + addition)

section = '''\

## SFC Visual Reconstruction Pass 25 — Area transitions
- Replaced instant portal swaps with a presentation-only 180ms departure shutter, map commit, then a 420ms arrival plate showing the destination name and existing portal label.
- Added destination-type accenting for towns, training schools, dungeons and the world map while keeping the field renderer and map data unchanged.
- Locked movement, interaction and menu input only during the short transition window to prevent double portal activation or accidental post-transition inputs.
- Portal requirements, target coordinates, encounter reset, last-inn updates, save behavior, map topology and progression flags remain unchanged.
'''
progress.write_text(progress.read_text() + section)
