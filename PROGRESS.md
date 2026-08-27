# RPG MODE Progress

## Current phase

Phase 20 in progress — implementation, art, audio, content, browser play and balance passes are complete. Final GitHub main sync and existing Sites deployment remain.

## Completed

- Confirmed the latest pre-RPG baseline includes Chapter Battle, BUILD, Stage 6–10 balance and the three-phase PRISM SOVEREIGN.
- Preserved `restore/core-game-complete-20260827`.
- Created `restore/pre-rpg-mode-20260828` from the latest GitHub `main`.
- Defined runtime architecture, save contract, content map and art bible.
- Replaced the obsolete automatic fresh-page policy with background-only Service Worker updates.
- Added a two-mode title: `RPG MODE` and the unchanged `CHAPTER BATTLE`.
- Added a data-driven RPG runtime with 1 world, 5 towns, 4 training sites, 3 small dungeons and 1 final dungeon.
- Added portrait iPhone exploration controls, collision, camera, terrain danger, safe roads, NPC interaction, portals, chests and fixed encounters.
- Integrated a new RPG Cluster Break battle surface with 6×6 board, visually distinct ATK/HEAL panels, column-aligned NEXT DROP MAP, NOW/NEXT Intent and all four RPG commands.
- Added 12 normal enemies, 6 special enemies, 6 bosses, TALK effects and alternate resolutions.
- Added level/EXP/gold, 16 obtainable techniques, 12 obtainable equipment pieces, 6 items, MEMO, inns, shops and GAME OVER recovery.
- Added autosave, validated JSON export/import and a bounded battle telemetry log for the final balance pass.
- Added nine original procedural 8bit BGM arrangements and more than twenty synthesized SE cues with MUSIC/SFX toggles.
- Passed TypeScript and a production Sites build after the playable-loop integration.
- Generated, normalized and integrated Hero, NPC, Field, Town, Dungeon, Enemy, Boss and UI pixel atlases.
- Added atlas-backed world, character, enemy, boss and command rendering with nearest-neighbor scaling and safe code-drawn fallbacks.
- Completed the 5-town / 4-training-site / 3-small-dungeon / final-dungeon content graph with 35 NPCs and complete acquisition paths for 16 techniques and 12 equipment pieces.
- Added phase dialogue to all bosses and retained the tuned VOID HERALD, IRON TYRANT, SCARLET ORACLE, NULL EXECUTIONER and three-phase PRISM SOVEREIGN rules.
- Added content integrity tests and a reproducible five-archetype balance runner.
- Completed real-browser checks for NEW GAME, world/NPC/MEMO, encounter, TALK/ITEM/STATUS/RUN, SAVE EXPORT/IMPORT, Chapter Battle, final boss phases, ending and title return.
- Fixed NPC visibility, blocked exits/chests/fixed encounters, equipment rank enforcement and compact-height title mode selection found during browser play.

## In progress

- Run the final TypeScript, targeted test and production build gates after the last compact-height fix.
- Save the final milestone to GitHub `main`, then publish the existing Sites project.

## Not completed

- Final GitHub merge and existing Sites deployment.

## Next work

1. Run final compile, content/PWA tests and production build.
2. Save the production atlases and source changes to the RPG milestone branch, then fast-forward `main`.
3. Checkpoint and deploy the existing Sites project, then verify the live startup path.

## Important decisions

- Existing Chapter Battle remains isolated and keeps its current tuning.
- RPG bonuses are explicit threshold rules; `1 PANEL = 1 EFFECT` remains the base.
- Maps and content are data-driven.
- Active play is never interrupted by a Service Worker reload or redirect.
- BGM remains WebAudio-generated and completely original; it does not reproduce reference melodies.
- Battle records retain only the latest 120 fights and never include personal data.
- High-resolution generated sources are regenerable and ignored; compact production atlases and the fixed prompt are versioned.
- Alternate resolutions grant 35% EXP and 20% GOLD so TALK routes have distinct rewards without replacing combat progression.

## Known issues

- No app-origin browser errors are known. The remaining work is repository/deployment finalization.
