from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"missing pattern in {path}: {old[:120]!r}")
    if text.count(old) != 1:
        raise SystemExit(f"pattern count != 1 in {path}: {text.count(old)}")
    file.write_text(text.replace(old, new, 1))

# 1 + 5: portrait field camera, field status density, dialogue de-clutter.
replace_once(
    "app/rpg/RPGMode.tsx",
    'const VIEW_W = 15;\nconst VIEW_H = 13;',
    'const VIEW_W = 13;\nconst VIEW_H = 13;',
)
replace_once(
    "app/rpg/RPGMode.tsx",
    '  const terrainLabel = isRoadTile(currentTile) ? "ROAD • SAFE" : isDangerTile(currentTile) ? "DANGER • HIGH ENCOUNTER" : map.kind === "town" ? "TOWN • SAFE" : map.kind === "training" ? "TRAINING • SAFE" : "FIELD • ENCOUNTER";\n',
    '  const terrainLabel = isRoadTile(currentTile) ? "ROAD • SAFE" : isDangerTile(currentTile) ? "DANGER • HIGH ENCOUNTER" : map.kind === "town" ? "TOWN • SAFE" : map.kind === "training" ? "TRAINING • SAFE" : "FIELD • ENCOUNTER";\n  const activeMemo = save.memos.find((memo) => !memo.read) ?? save.memos[save.memos.length - 1];\n  const armorLabel = save.equipment.armor ? EQUIPMENT[save.equipment.armor].name : "NO ARMOR";\n  const encounterLabel = map.kind === "town" || map.kind === "training" || isRoadTile(currentTile) ? "SAFE" : `${save.encounterMeter} STEP`;\n',
)
replace_once(
    "app/rpg/RPGMode.tsx",
    '<main className={styles.rpg} data-map={map.id} data-kind={map.kind} data-returning={fieldReturn ? "true" : "false"} data-area-phase={areaTransition?.phase ?? "none"} data-encounter={encounterCue?.kind ?? "none"}>',
    '<main className={styles.rpg} data-map={map.id} data-kind={map.kind} data-screen={screen} data-returning={fieldReturn ? "true" : "false"} data-area-phase={areaTransition?.phase ?? "none"} data-encounter={encounterCue?.kind ?? "none"}>',
)
replace_once(
    "app/rpg/RPGMode.tsx",
    '      <div className={styles.memoStrip}><span><RPGIcon name="memo" size={10} /> MEMO {save.memos.filter((memo) => !memo.read).length ? `NEW ${save.memos.filter((memo) => !memo.read).length}` : save.memos.length}</span><strong>JOURNEY • {save.steps} STEPS</strong></div>\n\n      <section className={styles.controls} aria-label="RPG touch controls">',
    '      <div className={styles.memoStrip}><span><RPGIcon name="memo" size={10} /> MEMO {save.memos.filter((memo) => !memo.read).length ? `NEW ${save.memos.filter((memo) => !memo.read).length}` : save.memos.length}</span><strong>JOURNEY • {save.steps} STEPS</strong></div>\n\n      <section className={styles.fieldBrief} aria-label="Field status">\n        <div className={styles.fieldGoal}><span>NEXT GOAL</span><strong>{activeMemo?.title ?? map.name}</strong><small>{activeMemo?.text ?? "PRISM ROADを進み、次の手掛かりを探す。"}</small></div>\n        <div className={styles.fieldQuick}>\n          <div><span>NEXT LV</span><strong>{Math.max(0, expForNextLevel(save.level) - save.exp)} EXP</strong></div>\n          <div><span>ARMOR</span><strong>{armorLabel}</strong></div>\n          <div><span>ENCOUNTER</span><strong>{encounterLabel}</strong></div>\n        </div>\n      </section>\n\n      <section className={styles.controls} aria-label="RPG touch controls">',
)

# 2: keep the first dungeon readable; later dungeons retain Hollow Monk.
replace_once(
    "app/rpg/data/maps.ts",
    '    encounterTable: ["thornBat", "copperBeetle", "hollowMonk"], dangerEncounterTable: ["mirrorMote", "gateMimic"], music: "dungeon",',
    '    encounterTable: id === "oldTemple" ? ["mossSlime", "thornBat", "copperBeetle"] : ["thornBat", "copperBeetle", "hollowMonk"], dangerEncounterTable: ["mirrorMote", "gateMimic"], music: "dungeon",',
)

# 3: the starter coat is starter gear, not a hidden inventory lesson.
replace_once(
    "app/rpg/save.ts",
    '    hp: 20,\n    maxHp: 20,',
    '    hp: 22,\n    maxHp: 22,',
)
replace_once(
    "app/rpg/save.ts",
    '    equipment: { weapon: null, armor: null, charm: null },',
    '    equipment: { weapon: null, armor: "travellerCoat", charm: null },',
)

# 1 + 5 visual layout override. Keep 50px direction cells on the primary iPhone layout,
# but stop the controls row from consuming every remaining viewport pixel.
rpg_css = Path("app/rpg/RPGMode.module.css")
rpg_css.write_text(rpg_css.read_text() + r'''\n\n/* Early-game play review 1–5 — portrait field density and control deck */
.rpg{
  grid-template-rows:auto auto auto auto minmax(44px,1fr) auto;
  gap:3px;
}
.worldFrame{aspect-ratio:1/1;}
.fieldBrief{
  position:relative;z-index:1;min-height:0;display:grid;grid-template-rows:minmax(48px,1fr) auto;gap:3px;
  padding:4px;border:2px solid color-mix(in srgb,var(--accent2) 70%,#4d4851);background:#08080e;
  box-shadow:inset 0 0 0 1px #030305,2px 2px #000;overflow:hidden;
}
.fieldGoal{min-height:0;display:grid;align-content:center;gap:2px;padding:6px 8px;border-left:3px solid var(--accent);background:#101018;}
.fieldGoal span,.fieldQuick span{color:var(--accent);font:900 5.5px/1 monospace;letter-spacing:.13em;}
.fieldGoal strong{font-size:9px;line-height:1.15;color:#fff3d5;text-shadow:1px 1px #000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.fieldGoal small{font-size:6.5px;line-height:1.35;color:#bdb8ae;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.fieldQuick{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3px;}
.fieldQuick>div{min-width:0;min-height:39px;display:grid;align-content:center;gap:3px;padding:4px 5px;border:1px solid #3b3d48;background:#0d0e15;box-shadow:inset 2px 0 color-mix(in srgb,var(--accent2) 72%,#222);}
.fieldQuick strong{min-width:0;color:#e9e5d8;font-size:7px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.hud{min-height:38px}.locationBar{min-height:24px}.memoStrip{min-height:21px}
.controls{
  height:166px;min-height:166px;align-self:end;display:flex;align-items:center;justify-content:space-between;
  padding:8px 12px;border:2px solid color-mix(in srgb,var(--accent2) 72%,#09080d);overflow:hidden;
  background:#09090f;box-shadow:inset 0 0 0 2px #050507,inset 0 -5px #060609;
}
.controls::before,.dpad::before,.abButtons::before{display:none!important;}
.controls::after{top:50%;width:25px;height:25px;opacity:.72;}
.dpad{width:150px;height:150px;grid-template-columns:repeat(3,50px);grid-template-rows:repeat(3,50px);}
.dpad button,.dpad i{min-width:50px;min-height:50px;}
.abButtons{gap:10px}.abButtons button{width:58px;height:58px;}
.rpg[data-screen="dialogue"] .fieldBrief,.rpg[data-screen="dialogue"] .controls,
.rpg[data-screen="event"] .fieldBrief,.rpg[data-screen="event"] .controls{visibility:hidden;}
.dialogueOverlay{background:rgba(0,0,0,.34);}
@media(max-width:380px){
  .controls{height:154px;min-height:154px;padding:8px 8px}.dpad{width:138px;height:138px;grid-template-columns:repeat(3,46px);grid-template-rows:repeat(3,46px)}.dpad button,.dpad i{min-width:46px;min-height:46px}.abButtons{gap:7px}.abButtons button{width:54px;height:54px}
  .fieldGoal{padding-inline:6px}.fieldGoal small{font-size:6px}.fieldQuick strong{font-size:6.5px}
}
@media(max-height:700px){
  .rpg{grid-template-rows:auto auto auto auto minmax(32px,1fr) auto}.controls{height:150px;min-height:150px;padding:6px 9px}.dpad{width:138px;height:138px;grid-template-columns:repeat(3,46px);grid-template-rows:repeat(3,46px)}.dpad button,.dpad i{min-width:46px;min-height:46px}.fieldBrief{grid-template-rows:minmax(36px,1fr) auto}.fieldGoal{padding-block:4px}.fieldGoal small{display:none}.fieldQuick>div{min-height:33px;padding-block:3px}
}
@media(max-height:620px){
  .controls{height:142px;min-height:142px;padding:5px 7px}.dpad{width:132px;height:132px;grid-template-columns:repeat(3,44px);grid-template-rows:repeat(3,44px)}.dpad button,.dpad i{min-width:44px;min-height:44px;font-size:17px}.abButtons button{width:52px;height:52px}.fieldGoal{display:none}.fieldBrief{grid-template-rows:1fr;padding:3px}.fieldQuick{align-self:center}.fieldQuick>div{min-height:34px}
}
''')

# 4: remove the title's large hero-to-mode dead zone without shrinking touch targets.
title_css = Path("app/PuzzleRPGApp.module.css")
title_css.write_text(title_css.read_text() + r'''\n\n/* Early-game play review 4 — compact title composition */
.title:has(.modeGrid){justify-content:flex-start;gap:4px;}
.title:has(.modeGrid) .hero{margin-top:0;margin-bottom:2px;width:min(48vw,190px);height:min(25dvh,184px);}
.title:has(.modeGrid) .modeGrid{margin-top:7px;margin-bottom:0;}
.title:has(.modeGrid) footer{margin-top:auto;}
@media(max-height:700px){.title:has(.modeGrid) .hero{width:min(30vw,112px);height:min(15dvh,104px)}.title:has(.modeGrid) .modeGrid{margin-top:3px}}
''')

progress = Path("PROGRESS.md")
progress.write_text(progress.read_text() + r'''\n\n## Early-game play review improvements — items 1–5
- Reframed field exploration from a 15x13 landscape-leaning camera to a 13x13 portrait-friendly camera, making the visible field about 15% taller on iPhone without scaling or blurring the pixel art.
- Rebuilt the oversized lower control deck into a fixed compact controller plus a useful field-status area. Primary iPhone direction cells remain 50px; smaller/shorter screens retain 44px+ targets.
- Dialogue and event scenes now hide the field-status/controller layers behind the dialogue presentation so conversations no longer stack three competing UI bands.
- Added compact NEXT GOAL / NEXT LV / ARMOR / ENCOUNTER field information to use the recovered portrait space with RPG-relevant information rather than empty controller chrome.
- Old Temple no longer rolls HOLLOW MONK as a normal encounter; its early table is now MOSS SLIME / THORN BAT / COPPER BEETLE. Later dungeons retain HOLLOW MONK.
- New games start with TRAVELLER COAT equipped and HP/MAX HP 22, making starter gear explicit and reducing the first-dungeon punishment spike.
- Removed the title screen's large hero-to-mode-select dead zone while preserving the existing title art and touch target sizes.
- No story flags, map collision/topology, boss placement, reward logic, battle rules, Chapter Battle logic, or existing-save format were changed.
''')

print("Applied early-game review improvements 1-5")
