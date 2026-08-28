from pathlib import Path

root = Path('.')
tsx = root / 'app/rpg/RPGMode.tsx'
css = root / 'app/rpg/RPGMode.module.css'
progress = root / 'PROGRESS.md'

text = tsx.read_text()
old = '''{(screen === "dialogue" || screen === "event") && dialogue.length ? <div className={styles.dialogueOverlay} onPointerDown={(event) => { event.preventDefault(); advanceDialogue(); }}>
        <div className={styles.dialogueBox} data-portrait={Boolean(speakerNpcCell)}>'''
new = '''{(screen === "dialogue" || screen === "event") && dialogue.length ? <div className={styles.dialogueOverlay} data-story={screen === "event" ? "event" : "dialogue"} data-page={`${dialogueIndex + 1}/${dialogue.length}`} onPointerDown={(event) => { event.preventDefault(); advanceDialogue(); }}>
        <div className={styles.dialogueBox} data-story={screen === "event" ? "event" : "dialogue"} data-portrait={Boolean(speakerNpcCell)}>'''
if old not in text:
    raise SystemExit('dialogue target not found')
text = text.replace(old, new, 1)
old_end = '''{screen === "ending" ? <div className={styles.ending}><span>PRISM ROAD</span><strong>{endingIndex < endingLines.length ? "ENDING" : "THE END"}</strong>'''
new_end = '''{screen === "ending" ? <div className={styles.ending} data-stage={endingIndex < endingLines.length - 1 ? "story" : "final"}><span>PRISM ROAD</span><strong>{endingIndex < endingLines.length ? "ENDING" : "THE END"}</strong>'''
if old_end not in text:
    raise SystemExit('ending target not found')
text = text.replace(old_end, new_end, 1)
tsx.write_text(text)

addition = r'''

/* SFC visual reconstruction pass 24 — story presentation */
.dialogueOverlay{z-index:180;background:linear-gradient(180deg,rgba(2,2,7,.08),rgba(2,2,7,.3) 58%,rgba(2,2,7,.54));perspective:600px}
.dialogueOverlay::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.12;background:repeating-linear-gradient(0deg,transparent 0 3px,rgba(255,255,255,.14) 4px)}
.dialogueBox{position:relative;isolation:isolate;overflow:visible;min-height:118px;padding:10px 12px 9px;border:3px solid #f4ecd4;background:linear-gradient(180deg,color-mix(in srgb,var(--panel) 86%,#202337),var(--panel2));box-shadow:0 0 0 2px #050507,0 0 0 4px var(--accent2),5px 6px #000;animation:storyWindowIn 170ms steps(4,end) both}
.dialogueBox::before{content:"";position:absolute;z-index:-1;left:7px;right:7px;top:7px;height:2px;background:linear-gradient(90deg,var(--accent),transparent 68%);opacity:.66}
.dialogueBox::after{content:attr(data-story);position:absolute;right:8px;top:-9px;padding:2px 5px;border:1px solid var(--accent2);background:#07070c;color:color-mix(in srgb,var(--accent) 72%,#aaa);font:900 5px/1 monospace;letter-spacing:.12em;text-transform:uppercase;box-shadow:1px 1px #000}
.dialogueBox span{align-self:end;width:max-content;max-width:100%;padding:2px 6px 3px;border-left:3px solid var(--accent);background:#08080e;color:var(--accent);font-size:8px;letter-spacing:.13em;text-shadow:1px 1px #000}
.dialogueBox p{align-self:center;margin:0;padding:3px 1px 1px;color:#fff8df;font-size:14px;line-height:1.55;font-weight:900;letter-spacing:.01em;text-shadow:1px 1px #000}
.dialogueBox small{align-self:end;padding-right:2px;color:#bdb7ad;font-size:7px;letter-spacing:.08em;animation:storyPrompt 720ms steps(2,end) infinite}
.dialogueBox[data-portrait="true"]{grid-template-columns:62px 1fr;column-gap:10px;padding-left:9px}.dialogueBox[data-portrait="true"]::before{left:71px}.dialogueBox[data-portrait="true"]>span{margin-left:-2px}.dialoguePortrait{width:54px;height:72px;border:3px solid color-mix(in srgb,var(--accent) 62%,#c9c4b7);box-shadow:0 0 0 2px #050507,3px 4px #000;background-color:#090910}.dialoguePortrait::before{content:"";position:absolute;inset:3px;border-top:1px solid rgba(255,255,255,.18);pointer-events:none}.dialoguePortrait::after{box-shadow:inset 0 -12px rgba(0,0,0,.18),inset 0 1px rgba(255,255,255,.16)}
.dialogueOverlay[data-story="event"]{place-items:center;background:radial-gradient(circle at 50% 43%,rgba(79,50,102,.34),rgba(3,3,8,.92) 68%),repeating-linear-gradient(0deg,transparent 0 3px,rgba(255,255,255,.025) 4px)}
.dialogueOverlay[data-story="event"]::after{content:"PRISM ROAD • STORY";position:absolute;top:max(10%,calc(env(safe-area-inset-top) + 18px));left:50%;transform:translateX(-50%);padding:4px 10px;border-block:1px solid #8e7543;color:#d7c67c;font:900 6px/1 monospace;letter-spacing:.22em;white-space:nowrap;text-shadow:1px 1px #000}
.dialogueBox[data-story="event"]{width:min(88vw,384px);min-height:170px;display:grid;align-content:center;grid-template-rows:auto minmax(76px,auto) auto;gap:10px;padding:18px 20px 14px;border-color:#ece3c8;background:linear-gradient(180deg,#171321,#09080f 70%,#050509);box-shadow:0 0 0 2px #050507,0 0 0 5px #705d38,7px 8px #000;text-align:center;animation:eventWindowIn 360ms steps(6,end) both}
.dialogueBox[data-story="event"]::before{left:18%;right:18%;top:12px;height:2px;background:linear-gradient(90deg,transparent,#ffe48a 30% 70%,transparent);opacity:.82}.dialogueBox[data-story="event"]::after{content:"CHAPTER 0";left:50%;right:auto;top:-11px;transform:translateX(-50%);padding:3px 9px;color:#ffe48a;border-color:#806a3c;font-size:6px;letter-spacing:.16em}
.dialogueBox[data-story="event"] span{justify-self:center;padding:3px 9px;border:0;border-block:1px solid #5f5470;background:transparent;color:#d8c56e;font-size:8px;letter-spacing:.2em}.dialogueBox[data-story="event"] p{align-self:center;font-size:clamp(15px,4vw,18px);line-height:1.65;color:#fff4d2;text-wrap:balance}.dialogueBox[data-story="event"] small{justify-self:center;color:#8f8995}
.ending{overflow:hidden;isolation:isolate;gap:16px;padding:max(28px,env(safe-area-inset-top)) 26px max(24px,env(safe-area-inset-bottom));background:radial-gradient(ellipse at 50% 38%,#272039 0,#0c0912 42%,#020204 76%);animation:endingFadeIn 720ms steps(8,end) both}.ending::before{content:"";position:absolute;z-index:-2;inset:0;background:repeating-linear-gradient(0deg,transparent 0 3px,rgba(255,255,255,.04) 4px),linear-gradient(180deg,transparent 0 44%,rgba(170,132,196,.08) 45% 46%,transparent 47%);opacity:.9}.ending::after{content:"";position:absolute;z-index:-1;left:-10%;right:-10%;bottom:-9%;height:43%;background:linear-gradient(180deg,transparent 0 14%,#11101a 15% 37%,#08080e 38% 100%);clip-path:polygon(0 44%,9% 27%,17% 39%,26% 19%,36% 42%,47% 12%,59% 35%,70% 20%,81% 40%,91% 26%,100% 42%,100% 100%,0 100%)}
.ending span{padding:3px 9px;border-block:1px solid #7b663a;color:#d6bf62;font-size:8px;letter-spacing:.24em}.ending strong{position:relative;color:#fff4c9;font-size:clamp(40px,13vw,64px);letter-spacing:-.04em;text-shadow:3px 0 #170d20,-3px 0 #170d20,0 3px #170d20,5px 5px #6f365f,8px 8px #000}.ending strong::after{content:"";display:block;width:70%;height:2px;margin:8px auto 0;background:linear-gradient(90deg,transparent,#ffe37b,transparent)}
.ending p{width:min(100%,386px);min-height:128px;display:grid;place-items:center;margin:0;padding:15px 16px;border:2px solid #9a8a68;background:rgba(7,7,13,.88);box-shadow:0 0 0 2px #020204,0 0 0 4px #332b3d,5px 6px #000;color:#f8f0da;font-size:14px;line-height:1.75;text-shadow:1px 1px #000;animation:endingLineIn 330ms steps(5,end) both}.ending button{position:relative;min-width:220px;min-height:44px;border:2px solid #d6ceb9;background:#0c0c13;color:#ffe178;box-shadow:0 0 0 2px #030305,3px 4px #000;font-size:9px;letter-spacing:.08em}.ending button:active{transform:translate(2px,2px);box-shadow:0 0 0 2px #030305,1px 1px #000}.ending small{padding-top:3px;border-top:1px solid #3e3845;color:#77727c;font-size:7px;letter-spacing:.08em}
.ending[data-stage="final"]{background:radial-gradient(circle at 50% 38%,#3a2b4c 0,#100b16 40%,#010102 76%)}.ending[data-stage="final"] strong{color:#ffe88f;animation:theEndPulse 1400ms steps(3,end) infinite}.ending[data-stage="final"] p{border-color:#c1a55b;background:#09080d;color:#fff3c6}.ending[data-stage="final"]::after{filter:brightness(1.22)}
@keyframes storyWindowIn{0%{opacity:0;transform:translateY(14px)}45%{opacity:1;transform:translateY(-2px)}100%{opacity:1;transform:none}}@keyframes eventWindowIn{0%{opacity:0;transform:scaleY(.15);filter:brightness(2)}28%{opacity:1;transform:scaleY(.82)}54%{transform:scaleY(1.05)}100%{opacity:1;transform:scaleY(1);filter:none}}@keyframes storyPrompt{0%,49%{opacity:.48}50%,100%{opacity:1}}@keyframes endingFadeIn{0%{opacity:0;filter:brightness(2)}35%{opacity:1}100%{filter:none}}@keyframes endingLineIn{0%{opacity:0;transform:translateY(6px)}100%{opacity:1;transform:none}}@keyframes theEndPulse{0%,66%{filter:brightness(1)}67%,100%{filter:brightness(1.22)}}
@media(max-height:700px){.dialogueBox{min-height:103px;padding-block:7px}.dialogueBox p{font-size:13px;line-height:1.45}.dialoguePortrait{width:48px;height:64px}.dialogueBox[data-portrait="true"]{grid-template-columns:55px 1fr}.dialogueBox[data-story="event"]{min-height:138px;gap:6px;padding:13px 15px 10px}.dialogueBox[data-story="event"] p{font-size:14px;line-height:1.5}.ending{gap:10px;padding-block:18px}.ending strong{font-size:38px}.ending p{min-height:92px;padding:10px 12px;font-size:12px;line-height:1.55}.ending button{min-height:38px}}
'''
css.write_text(css.read_text() + addition)

section = '''\n\n## SFC Visual Reconstruction Pass 24 — Story presentation\n- Split story presentation into two visual languages without changing text or progression: regular NPC dialogue remains field-anchored with stronger portrait/name hierarchy, while the opening EVENT becomes a centered chapter-style story window.\n- Added presentation-only story/page data attributes so event dialogue can be staged differently from ordinary conversations without touching dialogue order, callbacks or save flags.\n- Rebuilt the ending into a dedicated SFC finale scene with pixel horizon, framed narrative page, stronger ENDING/THE END hierarchy and a distinct final-state treatment.\n- Opening text, dialogue content/order, mercy/force ending selection, ending progression, title return and save behavior remain unchanged.\n'''
with progress.open('a') as f:
    f.write(section)
