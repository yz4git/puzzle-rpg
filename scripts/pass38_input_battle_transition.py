from pathlib import Path

root = Path('.')
rpg_path = root / 'app/rpg/RPGMode.tsx'
css_path = root / 'app/rpg/RPGMode.module.css'
test_path = root / 'tests/rpg-field-input-stability.test.ts'
qa_path = root / 'scripts/pass38_input_qa.mjs'

src = rpg_path.read_text()

def replace_once(old: str, new: str, label: str):
    global src
    count = src.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    src = src.replace(old, new, 1)

replace_once(
'''  const stepEncounterTimer = useRef<number | null>(null);\n  const keyboardHandlerRef = useRef<(event: KeyboardEvent) => void>(() => undefined);''',
'''  const stepEncounterTimer = useRef<number | null>(null);\n  // Synchronous gameplay lock. Unlike React state, stale hold-repeat closures also\n  // observe this ref immediately, so no movement can leak into a battle transition.\n  const movementLockedRef = useRef(false);\n  const keyboardHandlerRef = useRef<(event: KeyboardEvent) => void>(() => undefined);''',
'ref insertion')

replace_once(
'''  function move(direction: Direction) {\n    if (screen !== "overworld" || service || battle || result || areaTransition || discovery || encounterCue) return;''',
'''  function move(direction: Direction) {\n    if (movementLockedRef.current || stepEncounterTimer.current !== null || screen !== "overworld" || service || battle || result || areaTransition || discovery || encounterCue) return;''',
'move guard')

replace_once(
'''    const shouldEncounter = !safe && nextMeter <= 0 && Boolean(map.encounterTable || map.id === "world");\n    const updated: RPGSaveData = { ...current, position: nextPosition, direction, steps: current.steps + 1, encounterMeter: shouldEncounter ? encounterReset(current) : nextMeter };\n    saveRef.current = updated; setSave(updated); setWalkFrame((frame) => (frame + 1) % 3);\n    playSfx("step");\n    if (shouldEncounter) {\n      saveGame(updated);''',
'''    const shouldEncounter = !safe && nextMeter <= 0 && Boolean(map.encounterTable || map.id === "world");\n    if (shouldEncounter) {\n      // Lock on the exact step that rolls an encounter, before the 90ms cue delay.\n      // This prevents a held D-pad repeat from moving LIO again behind the battle.\n      movementLockedRef.current = true;\n      stopHold();\n    }\n    const updated: RPGSaveData = { ...current, position: nextPosition, direction, steps: current.steps + 1, encounterMeter: shouldEncounter ? encounterReset(current) : nextMeter };\n    saveRef.current = updated; setSave(updated); setWalkFrame((frame) => (frame + 1) % 3);\n    playSfx("step");\n    if (shouldEncounter) {\n      saveGame(updated);''',
'encounter lock')

replace_once(
'''  function interact() {\n    if (discovery) { setDiscovery(null); playSfx("uiSelect"); return; }''',
'''  function interact() {\n    if (movementLockedRef.current) return;\n    if (discovery) { setDiscovery(null); playSfx("uiSelect"); return; }''',
'interact lock')

replace_once(
'''  function startBattle(enemyId: string, context: Omit<BattleContext, "enemyId"> = {}, requestedKind?: EncounterCueKind) {\n    const enemy = ENEMIES[enemyId];\n    if (!enemy || encounterCue) return;''',
'''  function startBattle(enemyId: string, context: Omit<BattleContext, "enemyId"> = {}, requestedKind?: EncounterCueKind) {\n    const enemy = ENEMIES[enemyId];\n    if (!enemy || encounterCue) return;\n    movementLockedRef.current = true;\n    stopHold();''',
'start battle lock')

replace_once(
'''    const delay = kind === "boss" ? 620 : kind === "trial" ? 460 : kind === "fixed" ? 420 : kind === "danger" ? 320 : 240;''',
'''    const delay = kind === "boss" ? 700 : kind === "trial" ? 520 : kind === "fixed" ? 480 : kind === "danger" ? 420 : 360;''',
'encounter timing')

replace_once(
'''  function closeResult() {\n    if (result?.ending) { setEndingIndex(0); setScreen("ending"); setResult(null); return; }\n    setResult(null); setScreen("overworld"); setFieldReturn(true);''',
'''  function closeResult() {\n    if (result?.ending) { setEndingIndex(0); setScreen("ending"); setResult(null); return; }\n    movementLockedRef.current = false;\n    setResult(null); setScreen("overworld"); setFieldReturn(true);''',
'result unlock')

replace_once(
'''  function openMenu() { if (screen === "overworld" && !areaTransition && !discovery && !encounterCue) { primeAudio(); playSfx("uiSelect"); setService(null); setScreen("menu"); } }''',
'''  function openMenu() { if (!movementLockedRef.current && screen === "overworld" && !areaTransition && !discovery && !encounterCue) { primeAudio(); playSfx("uiSelect"); setService(null); setScreen("menu"); } }''',
'menu lock')

replace_once(
'''  function startHold(direction: Direction, event: PointerEvent<HTMLButtonElement>) {\n    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); move(direction);\n    if (heldTimer.current !== null) window.clearInterval(heldTimer.current);\n    heldTimer.current = window.setInterval(() => move(direction), 145);\n  }''',
'''  function startHold(direction: Direction, event: PointerEvent<HTMLButtonElement>) {\n    event.preventDefault();\n    if (movementLockedRef.current) return;\n    event.currentTarget.setPointerCapture(event.pointerId);\n    move(direction);\n    // move() may synchronously roll an encounter. Never recreate repeat after it locked.\n    if (movementLockedRef.current || stepEncounterTimer.current !== null) return;\n    if (heldTimer.current !== null) window.clearInterval(heldTimer.current);\n    heldTimer.current = window.setInterval(() => move(direction), 145);\n  }''',
'hold repeat guard')

rpg_path.write_text(src)

css = css_path.read_text()
marker = '/* RPG field input + battle transition usability pass */'
if marker not in css:
    css += r'''\n\n/* RPG field input + battle transition usability pass */
/* Large contiguous D-pad cells: no cardinal direction falls below Apple's 44px touch target. */
.controls{min-height:142px;padding:35px 12px 6px;}
.controls::before{top:8px;}
.dpad{width:150px;height:150px;grid-template-columns:repeat(3,50px);grid-template-rows:repeat(3,50px);filter:drop-shadow(4px 5px 0 #000);}
.dpad button,.dpad i{min-width:50px;min-height:50px;border-width:3px;font-size:19px;box-shadow:inset 0 0 0 2px #565666,inset 0 -5px 0 rgba(0,0,0,.22);}
.dpad button{position:relative;z-index:2;background:#272732;}
.dpad button::after{content:"";position:absolute;inset:4px;border:1px solid rgba(255,255,255,.08);pointer-events:none;}
.dpad i{pointer-events:none;background:#14141c;color:#6f6b7d;box-shadow:inset 0 0 0 3px #20202b;}
.dpad button:active{background:var(--accent);color:#101015;transform:translate(1px,2px);box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--accent2) 62%,#222),inset 0 4px 0 rgba(0,0,0,.2);}
.abButtons{gap:11px;}
.abButtons button{width:58px;height:58px;}

/* Make the field-to-battle cut unmistakable: lock -> shutter -> prism slash -> battle. */
.encounterCue{background:#020205;animation:encounterFieldSnap 360ms steps(6,end) both;}
.encounterCue::before,.encounterCue::after{height:50%;background:#030307;}
.encounterCue::before{animation:encounterShutterTopStrong 260ms steps(6,end) both;}
.encounterCue::after{animation:encounterShutterBottomStrong 260ms steps(6,end) both;}
.encounterCue>strong{z-index:2;animation:encounterTitleStrike 360ms steps(6,end) both;}
.encounterCue>i{z-index:1;width:196px;height:196px;border-color:rgba(255,240,196,.28);box-shadow:0 0 0 10px rgba(255,255,255,.04),0 0 0 24px rgba(255,255,255,.025);animation:encounterPrismBurst 360ms steps(6,end) both;}
.encounterCue>i::before,.encounterCue>i::after{content:"";position:absolute;left:50%;top:50%;background:#fff4c9;transform:translate(-50%,-50%);box-shadow:0 0 0 1px rgba(255,255,255,.2);}
.encounterCue>i::before{width:3px;height:240px;}
.encounterCue>i::after{width:240px;height:3px;}
.encounterCue[data-kind="danger"]{animation-duration:420ms;}.encounterCue[data-kind="fixed"]{animation-duration:480ms;}.encounterCue[data-kind="trial"]{animation-duration:520ms;}.encounterCue[data-kind="boss"]{animation:bossApproachStrong 700ms steps(10,end) both;background:#020205;}
.encounterCue[data-kind="danger"]>i{border-color:rgba(255,100,92,.4);}.encounterCue[data-kind="fixed"]>i{border-color:rgba(130,224,244,.36);}.encounterCue[data-kind="trial"]>i{border-color:rgba(255,210,105,.38);}.encounterCue[data-kind="boss"]>i{animation:bossPrismBurst 700ms steps(10,end) both;}
@keyframes encounterFieldSnap{0%{opacity:0;filter:brightness(2)}16%{opacity:1;filter:brightness(.65)}34%{filter:brightness(1.55)}52%,100%{filter:none}}
@keyframes encounterShutterTopStrong{0%{transform:translateY(-102%)}100%{transform:none}}
@keyframes encounterShutterBottomStrong{0%{transform:translateY(102%)}100%{transform:none}}
@keyframes encounterPrismBurst{0%{opacity:0;transform:translate(-50%,-50%) rotate(45deg) scale(.08)}28%{opacity:1;transform:translate(-50%,-50%) rotate(45deg) scale(1.12)}58%{opacity:.8;transform:translate(-50%,-50%) rotate(45deg) scale(.72)}100%{opacity:.18;transform:translate(-50%,-50%) rotate(45deg) scale(1.28)}}
@keyframes encounterTitleStrike{0%,30%{opacity:0;transform:translateY(8px)}46%{opacity:1;transform:translateY(-2px);filter:brightness(1.8)}100%{opacity:1;transform:none;filter:none}}
@keyframes bossApproachStrong{0%{opacity:0;filter:brightness(2)}12%{opacity:1;filter:brightness(.35)}24%{filter:brightness(1.8)}36%{filter:brightness(.72)}52%,100%{filter:none}}
@keyframes bossPrismBurst{0%{opacity:0;transform:translate(-50%,-50%) rotate(45deg) scale(.08)}22%{opacity:1;transform:translate(-50%,-50%) rotate(45deg) scale(.92)}48%{transform:translate(-50%,-50%) rotate(135deg) scale(1.18)}72%{opacity:.75;transform:translate(-50%,-50%) rotate(225deg) scale(.78)}100%{opacity:.25;transform:translate(-50%,-50%) rotate(315deg) scale(1.35)}}
@media(max-height:700px){.controls{min-height:132px;padding:33px 10px 5px}.dpad{width:138px;height:138px;grid-template-columns:repeat(3,46px);grid-template-rows:repeat(3,46px)}.dpad button,.dpad i{min-width:46px;min-height:46px;font-size:18px}.abButtons button{width:56px;height:56px}}
@media(max-height:620px){.controls{min-height:124px;padding:31px 8px 4px}.dpad{width:132px;height:132px;grid-template-columns:repeat(3,44px);grid-template-rows:repeat(3,44px)}.dpad button,.dpad i{min-width:44px;min-height:44px;font-size:17px}.abButtons button{width:54px;height:54px}}
@media(prefers-reduced-motion:reduce){.encounterCue,.encounterCue::before,.encounterCue::after,.encounterCue>strong,.encounterCue>i{animation-duration:1ms!important}}
'''
css_path.write_text(css)

test_path.write_text(r'''import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mode = readFileSync(new URL("../app/rpg/RPGMode.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/rpg/RPGMode.module.css", import.meta.url), "utf8");

test("encounter step synchronously locks all field movement", () => {
  assert.match(mode, /const movementLockedRef = useRef\(false\)/);
  assert.match(mode, /movementLockedRef\.current \|\| stepEncounterTimer\.current !== null \|\| screen !== "overworld"/);
  assert.match(mode, /if \(shouldEncounter\) \{[\s\S]*movementLockedRef\.current = true;[\s\S]*stopHold\(\);/);
  assert.match(mode, /function startBattle[\s\S]*movementLockedRef\.current = true;[\s\S]*stopHold\(\);/);
});

test("hold repeat cannot be recreated after encounter lock", () => {
  assert.match(mode, /move\(direction\);[\s\S]*if \(movementLockedRef\.current \|\| stepEncounterTimer\.current !== null\) return;[\s\S]*setInterval/);
  assert.match(mode, /function closeResult\(\)[\s\S]*movementLockedRef\.current = false;/);
});

test("D-pad touch targets stay at least 44px and battle cue has a full transition", () => {
  assert.match(css, /RPG field input \+ battle transition usability pass/);
  assert.match(css, /\.dpad\{width:150px;height:150px;grid-template-columns:repeat\(3,50px\)/);
  assert.match(css, /@media\(max-height:620px\)[\s\S]*repeat\(3,44px\)/);
  assert.match(css, /encounterPrismBurst/);
  assert.match(mode, /kind === "boss" \? 700 : kind === "trial" \? 520 : kind === "fixed" \? 480 : kind === "danger" \? 420 : 360/);
});
''')

qa_path.write_text(r'''import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 3 });
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(String(error)));

await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
await page.evaluate(() => {
  localStorage.setItem("puzzle-rpg:rpg-mode:v1", JSON.stringify({
    version: 1,
    playerName: "LIO",
    mapId: "oldTemple",
    position: { x: 10, y: 16 },
    direction: "up",
    lastInn: { mapId: "hearthVillage", position: { x: 8, y: 10 } },
    flags: ["story:openingSeen"],
    steps: 0,
    encounterMeter: 3,
    settings: { music: false, sfx: false }
  }));
});
await page.reload({ waitUntil: "networkidle" });
await page.getByRole("button", { name: /RPG MODE/i }).click();
await page.getByRole("button", { name: /CONTINUE/i }).click();
const up = page.getByRole("button", { name: "Move up" });
await up.waitFor({ state: "visible" });
const box = await up.boundingBox();
if (!box || box.width < 44 || box.height < 44) throw new Error(`D-pad target too small: ${JSON.stringify(box)}`);

// Real held pointer: oldTemple starts at y16 with meter 3. The third valid step must
// lock at y13; continuing to hold must not queue y12/y11 behind the battle transition.
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.waitForTimeout(430);
const cue = page.getByText("ENCOUNTER", { exact: true });
if (!(await cue.isVisible().catch(() => false))) throw new Error("battle entry transition did not become visible");
await page.waitForTimeout(520);
await page.mouse.up();
await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("puzzle-rpg:rpg-mode:v1") || "null"));
if (!saved) throw new Error("save missing after encounter hold");
if (saved.position?.x !== 10 || saved.position?.y !== 13) throw new Error(`movement leaked into battle: ${JSON.stringify(saved.position)}`);
if (saved.steps !== 3) throw new Error(`unexpected queued steps: ${saved.steps}`);
if (errors.length) throw new Error(`runtime errors: ${errors.join(" | ")}`);
console.log(`INPUT QA SUCCESS dpad=${box.width.toFixed(1)}x${box.height.toFixed(1)} position=${saved.position.x},${saved.position.y} steps=${saved.steps}`);
await browser.close();
''')
