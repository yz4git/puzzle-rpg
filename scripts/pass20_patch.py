from pathlib import Path

mode_path = Path('app/rpg/RPGMode.tsx')
css_path = Path('app/rpg/RPGMode.module.css')
progress_path = Path('PROGRESS.md')
mode = mode_path.read_text()

def swap(old: str, new: str):
    global mode
    if old not in mode:
        raise SystemExit(f'missing mode anchor: {old[:120]!r}')
    mode = mode.replace(old, new, 1)

swap(
    'function worldEnemyTable(position: Vec2, danger: boolean) {\n',
    'function resultLineKind(line: string) {\n'
    '  if (line.includes("LEVEL UP")) return "level";\n'
    '  if (line.startsWith("EXP +")) return "reward";\n'
    '  if (/手に入れた|覚えた|習得|取得/.test(line)) return "acquire";\n'
    '  if (/失った|YOU AWAKEN/.test(line)) return "loss";\n'
    '  return "story";\n'
    '}\n\n'
    'function worldEnemyTable(position: Vec2, danger: boolean) {\n'
)

swap(
    '  const [result, setResult] = useState<ResultState>(null);\n  const [walkFrame, setWalkFrame] = useState(0);\n',
    '  const [result, setResult] = useState<ResultState>(null);\n  const [fieldReturn, setFieldReturn] = useState(false);\n  const [walkFrame, setWalkFrame] = useState(0);\n'
)

swap(
    '  function closeResult() {\n    if (result?.ending) { setEndingIndex(0); setScreen("ending"); setResult(null); return; }\n    setResult(null); setScreen("overworld");\n  }\n',
    '  function closeResult() {\n'
    '    if (result?.ending) { setEndingIndex(0); setScreen("ending"); setResult(null); return; }\n'
    '    setResult(null); setScreen("overworld"); setFieldReturn(true);\n'
    '    window.setTimeout(() => setFieldReturn(false), 520);\n'
    '  }\n'
)

swap(
    '    <main className={styles.rpg} data-map={map.id} data-kind={map.kind}>',
    '    <main className={styles.rpg} data-map={map.id} data-kind={map.kind} data-returning={fieldReturn ? "true" : "false"}>'
)

old_result = '      {screen === "result" && result ? <div className={styles.resultOverlay}><div className={styles.resultCard}><span>RPG MODE</span><strong>{result.title}</strong>{result.lines.map((line) => <p key={line}>{line}</p>)}<button type="button" onClick={closeResult}>A • CONTINUE</button></div></div> : null}\n'
new_result = '''      {screen === "result" && result ? <div className={styles.resultOverlay} data-result={result.title.toLowerCase().replaceAll(" ", "-")}><div className={styles.resultCard}>
        <span className={styles.resultEyebrow}>RPG MODE • BATTLE REPORT</span>
        <strong>{result.title}</strong>
        <div className={styles.resultStatus}><i><small>LV</small><b>{save.level}</b></i><i><small>HP</small><b>{save.hp}/{save.maxHp}</b></i><i><small>GOLD</small><b>{save.gold}</b></i></div>
        <div className={styles.resultLines}>{result.lines.map((line, index) => <p data-kind={resultLineKind(line)} style={{ "--result-index": index } as React.CSSProperties} key={`${index}-${line}`}>{line}</p>)}</div>
        <button type="button" onClick={closeResult}>A • CONTINUE</button>
      </div></div> : null}
'''
# Avoid importing React namespace solely for CSS variable typing: use inline any-free object through CSSProperties already not imported.
new_result = new_result.replace(' as React.CSSProperties', ' as Record<string, number>')
swap(old_result, new_result)

mode_path.write_text(mode)

css = css_path.read_text()
marker = '/* SFC visual reconstruction pass 20 — battle reward ceremony */'
if marker in css:
    raise SystemExit('pass 20 CSS already present')
css += r'''

/* SFC visual reconstruction pass 20 — battle reward ceremony */
.resultOverlay{z-index:150;place-items:center;background:rgba(0,0,0,.9);background-image:repeating-linear-gradient(0deg,transparent 0 3px,rgba(255,255,255,.025) 4px)}
.resultCard{position:relative;width:min(94vw,400px);max-height:82dvh;overflow:hidden;gap:7px;padding:12px 12px 11px;border-color:#fff4cf;background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 8%,#12111a),#07080d 30%,#05060a);box-shadow:0 0 0 2px #000,0 0 0 5px var(--accent2),7px 7px #000;animation:resultCardIn 360ms steps(6,end) both}.resultCard::before{content:"";position:absolute;left:5px;right:5px;top:5px;height:3px;background:var(--accent);opacity:.8}.resultEyebrow{display:block;padding:5px 6px 4px;border-bottom:2px solid color-mix(in srgb,var(--accent) 55%,#57535c);color:var(--accent)!important;font-size:7px!important;letter-spacing:.14em}.resultCard>strong{padding:2px 0 4px;color:#fff7dc;font-size:clamp(24px,8vw,32px);letter-spacing:.06em;text-shadow:3px 3px #000}.resultStatus{width:100%;display:grid;grid-template-columns:.65fr 1.25fr 1fr;gap:3px;padding:3px;border:2px solid color-mix(in srgb,var(--accent2) 72%,#77717c);background:#05060a;box-shadow:inset 0 0 0 1px #18131d}.resultStatus i{min-height:35px;display:grid;grid-template-rows:auto 1fr;place-items:center;padding:3px 4px;border:1px solid #3e3e48;background:linear-gradient(180deg,#11131c,#090a0f);font-style:normal}.resultStatus small{font-size:6px;color:#a9a5ad;letter-spacing:.12em}.resultStatus b{align-self:center;font-size:11px;color:#fff1bd;text-shadow:1px 1px #000}.resultLines{width:100%;max-height:42dvh;overflow:auto;display:grid;gap:3px;padding:2px}.resultLines p{--result-index:0;position:relative;width:100%;min-height:29px;display:grid;place-items:center start;margin:0!important;padding:5px 7px 5px 12px;border:1px solid #353640;background:#090a10;color:#dad6d2;text-align:left!important;font-size:9px!important;line-height:1.35!important;opacity:0;animation:resultLineIn 260ms steps(5,end) forwards;animation-delay:calc(120ms + var(--result-index) * 90ms)}.resultLines p::before{content:"";position:absolute;left:4px;top:5px;bottom:5px;width:3px;background:#66636e}.resultLines p[data-kind="reward"]{min-height:37px;border:2px solid #8e7435;background:linear-gradient(90deg,#2d2509,#0a0908 78%);color:#ffe88d;font-size:11px!important;font-weight:1000}.resultLines p[data-kind="reward"]::before{background:#ffd95e}.resultLines p[data-kind="level"]{min-height:43px;border:2px solid #fff0a1;background:linear-gradient(90deg,#4a2f0b,#171009 72%);color:#fff6c4;font-size:12px!important;font-weight:1000;letter-spacing:.04em;box-shadow:inset 0 0 0 1px #a96822;animation-name:levelLineIn}.resultLines p[data-kind="level"]::before{background:#fff0a1;box-shadow:2px 0 #a96822}.resultLines p[data-kind="acquire"]{border:2px solid color-mix(in srgb,var(--accent) 55%,#5c5964);background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 11%,#101118),#08090d 76%);color:#f9f2dc;font-weight:900}.resultLines p[data-kind="acquire"]::before{background:var(--accent)}.resultLines p[data-kind="loss"]{border-color:#8b3543;background:#210a0f;color:#ffc1c8}.resultLines p[data-kind="loss"]::before{background:#e75b68}.resultCard>button{position:relative;min-width:230px;min-height:42px;margin-top:2px;border-color:color-mix(in srgb,var(--accent) 62%,#fff);background:linear-gradient(180deg,#1d1921,#0d0b10);box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--accent2) 34%,#2c2632),3px 3px #000;color:#fff0a5}.resultCard>button::before{content:"›";margin-right:7px;color:var(--accent)}.resultCard>button:active{transform:translate(2px,2px);box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--accent2) 34%,#2c2632)}
.resultOverlay[data-result="victory"] .resultCard>strong{color:#fff0a0}.resultOverlay[data-result="another-answer"] .resultCard{border-color:#fff3af;box-shadow:0 0 0 2px #000,0 0 0 5px color-mix(in srgb,var(--accent) 62%,var(--accent2)),7px 7px #000}.resultOverlay[data-result="another-answer"] .resultCard>strong{color:#fff4b9}.resultOverlay[data-result="you-awaken"] .resultCard>strong{color:#ffb4bd}.resultOverlay[data-result="escaped"] .resultCard>strong{color:#bcefff}
.rpg[data-returning="true"]::after{content:"";position:fixed;z-index:90;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(255,247,200,.38),transparent 22% 82%,rgba(255,224,138,.12));animation:fieldReturnFlash 520ms steps(7,end) both}.rpg[data-returning="true"] .worldFrame{animation:fieldReturnFrame 520ms steps(7,end) both}.rpg[data-returning="true"] .locationBar{animation:fieldReturnBar 520ms steps(7,end) both}
@keyframes resultCardIn{0%{opacity:0;transform:translateY(10px) scale(.92);filter:brightness(1.8)}20%{opacity:1;transform:translateY(-2px) scale(1.03)}48%{transform:translateY(1px) scale(.99)}72%{transform:translateY(0) scale(1.01)}100%{opacity:1;transform:none;filter:none}}@keyframes resultLineIn{0%{opacity:0;transform:translateX(-10px)}35%{opacity:1;transform:translateX(2px)}70%{transform:translateX(-1px)}100%{opacity:1;transform:none}}@keyframes levelLineIn{0%{opacity:0;transform:scale(.82);filter:brightness(3)}24%{opacity:1;transform:scale(1.08);filter:brightness(1.8)}52%{transform:scale(.97);filter:brightness(1.15)}76%{transform:scale(1.02)}100%{opacity:1;transform:scale(1);filter:none}}@keyframes fieldReturnFlash{0%{opacity:1}14%{opacity:.16}30%{opacity:.66}48%{opacity:.1}68%{opacity:.32}100%{opacity:0}}@keyframes fieldReturnFrame{0%{filter:brightness(1.9) saturate(.55)}18%{filter:brightness(.82) saturate(1.25)}42%{filter:brightness(1.35)}68%{filter:brightness(.94)}100%{filter:none}}@keyframes fieldReturnBar{0%{filter:brightness(2)}28%{filter:brightness(.9)}55%{filter:brightness(1.4)}100%{filter:none}}
@media(max-height:720px){.resultCard{max-height:88dvh;padding:10px 10px 9px}.resultCard>strong{font-size:24px}.resultStatus i{min-height:31px}.resultLines{max-height:39dvh}.resultLines p{min-height:26px;padding-block:4px}.resultLines p[data-kind="level"]{min-height:38px}.resultCard>button{min-height:38px}}
@media(prefers-reduced-motion:reduce){.resultCard,.resultLines p,.rpg[data-returning="true"]::after,.rpg[data-returning="true"] .worldFrame,.rpg[data-returning="true"] .locationBar{animation-duration:1ms!important;animation-delay:0ms!important;animation-iteration-count:1!important}}
'''
css_path.write_text(css)

progress = progress_path.read_text()
entry = '''\n## SFC Visual Reconstruction Pass 20 — Battle reward ceremony\n- Rebuilt the RPG battle result card into a staged battle report with persistent LV/HP/GOLD status, distinct reward, level-up, acquisition, story and loss rows.\n- Added stepped reveal timing so EXP/GOLD lands first, LEVEL UP receives a dedicated celebratory beat and item/technique/equipment acquisitions read as separate rewards.\n- Added a 520ms field-return flash/frame settle after CONTINUE so returning from battle feels like a scene transition instead of an overlay simply disappearing.\n- EXP, GOLD, drops, level formulas, HP recovery, rewards, autosave, outcome handling, battle telemetry and Chapter Battle remain unchanged.\n'''
if '## SFC Visual Reconstruction Pass 20 — Battle reward ceremony' in progress:
    raise SystemExit('pass 20 progress already present')
progress_path.write_text(progress + entry)
