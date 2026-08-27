# Puzzle RPG — RPG MODE Specification

## Product thesis

An original portrait-first 8bit solo RPG: exploration and learning techniques feel like a late-1980s journey, while every encounter is resolved through the existing 6×6 Cluster Break battle. One panel always remains one effect.

## Protected foundations

- Chapter Battle remains playable and keeps its ten-stage balance, BUILD rewards, endgame enemies and PRISM SOVEREIGN phases.
- RPG MODE reuses ATK, HEAL, BAR, SKIP, NEXT DROP MAP and NOW/NEXT Intent.
- No hidden attack multiplier is added. Techniques and equipment use explicit threshold bonuses.
- Service-worker updates never reload or navigate an active run.

## Runtime architecture

```text
PuzzleRPGApp
├── ModeTitle
├── ChapterBattle
└── RPGMode
    ├── Overworld / Interior / Dungeon
    ├── Dialogue + Memo
    ├── FieldMenu + Save
    ├── Event / Training / Ending
    └── RPGPuzzleBattle
        └── Cluster Break rules + RPG commands
```

Content is data-driven under `app/rpg/data`. Adding a map, NPC, encounter, item, equipment or technique must not require editing the world renderer.

## State machine

`TITLE → OVERWORLD ↔ DIALOGUE / MENU / EVENT / TRAINING → BATTLE → RESULT → OVERWORLD → ENDING`

State transitions are explicit and serializable. Battle animation state is ephemeral and is never written into the save.

## Exploration rules

- Tile logical size: 16×16; renderer scales by an integer-like nearest-neighbour factor.
- Four directions, three visual walk phases, one-tile collision, camera centered with edge clamping.
- ROAD is safe; FIELD uses a step budget; DANGER uses a shorter budget and a stronger encounter table.
- Every major route offers a safer road and a shorter dangerous route.
- A interacts with NPCs, signs, doors, treasure and landmarks. B opens/cancels menus.

## Battle contract

RPG battle receives enemy data, current HP, techniques, equipment and inventory. It returns one of:

- `victory`: EXP, gold, drops, event flags and remaining HP.
- `release`: alternate reward and dialogue; no kill reward duplication.
- `run`: returns to the previous map tile; bosses reject this command.
- `defeat`: respawn at the last inn with 15% gold loss.

B opens TALK / ITEM / STATUS / RUN. TALK and ITEM consume a turn unless a definition says otherwise. STATUS never consumes a turn.

## Progression

- Levels mainly raise max HP: 20 at LV1, 24 around LV5 and 30 at LV10.
- Technique capacity expands at story milestones. Techniques map to the existing BUILD rules.
- Three equipment slots: weapon, armor, charm. Effects alter thresholds, starting supply or crisis rules.
- Inventory begins at four slots and grows to six. Key items are stored separately.

## Save format

`SaveData.version = 1` stores player stats, map/position, inventory, equipment, techniques, memos, flags, opened chests, defeated fixed encounters, play time and settings.

Autosave occurs after town entry, battle, acquisition, boss/event completion and map transition. JSON export/import validates schema, clamps numeric fields and rejects unknown versions without overwriting the current save.

## Story spine

The lone traveller LIO follows the fractured Prism Road. Four masters teach disciplines needed to read the personalities of the guardians. The apparent tyrants protect seals holding the Prism Sovereign. The ending reflects whether the traveller listened to or only defeated the world's inhabitants, without blocking completion.

## Completion gates

The final release requires both modes, five towns, four training sites, three minor dungeons, one final dungeon, roughly 35 NPCs, 12 normal enemies, six special enemies, six bosses, all four RPG commands, alternate resolutions, progression, memo, autosave/export/import, phase dialogue, ending, original audio, portrait touch controls and a verified production deployment.
