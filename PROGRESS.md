# RPG MODE Progress

## Current phase

Visual Reconstruction Pass complete — high-density atlases, layered overworld rendering,
reconstructed battle/title presentation, GitHub main sync and existing Sites publication
are complete.

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
- Passed final TypeScript, RPG content, PWA startup-safety and production build gates.
- Fast-forwarded GitHub `main` without modifying either restore branch.
- Published Sites Version 31 at `https://puzzle-rpg.yzgame.chatgpt.site` and verified terminal deployment success.
- Preserved the v1.0 baseline as `restore/pre-visual-reconstruction-20260828`.
- Rebuilt every production atlas from the approved high-resolution source cells;
  removed whole-sheet stretching and destructive 16px pre-downscaling.
- Added a deterministic atlas rebuild script and v2 manifest with explicit cell metrics.
- Upgraded the overworld to a 2× backing canvas with semantic roads, connected town
  facades, depth shadows, larger actors and atlas-backed fixed encounters.
- Reconstructed the title around the full-resolution hero portrait.
- Enlarged battle enemies, strengthened panel material separation and locked NEXT
  DROP MAP/readout to the exact 6×6 board width.
- Completed a live visual pass through title, opening dialogue, town, world map and
  a normal RPG battle; no app-origin console error was observed.
- Passed RPG content, PWA startup-safety and production build gates.
- Saved the reconstruction milestone to GitHub main and published Sites Version 32.

## In progress

- None.

## Not completed

- None.

## Next work

1. Preserve all restore branches and the background-only Service Worker policy.
2. Use the v2 manifest and deterministic rebuild script for future asset additions.
3. Re-run only the checks relevant to future changes.

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

- No app-origin browser errors or blocking v1.0 issues are known.


## Visual Reconstruction Pass — SFC baseline
- Restore point: restore/pre-visual-reconstruction-pass
- Target: late-SNES-inspired 16bit+ presentation.
- Phase 1 implementation: denser field layout, larger hero/NPC silhouettes, regional UI palettes, compact field menu, scene-specific battle backdrops, grounded enemies, 340-388px RPG battle board, SNES-styled battle frame, dedicated TALK reaction window.
- Validation required: TypeScript, production build, iPhone 402x690 visual audit, Chapter Battle regression check.
- Next asset phase: replace prototype CSS battle scenery with dedicated pixel background strips and expand region-specific terrain/autotiles.


## Visual Reconstruction Pass 2 — dedicated scene assets
- Added dedicated pixel battle background strips for field/town/marsh/tower/fortress/dungeon/citadel.
- Added terrain edge stitching, richer town facade details, stronger hero/NPC field presence, and TALK reaction frame animation.
- Required validation: TypeScript, vinext build, 402x690 DPR3 screenshots, Chapter Battle regression.


## Visual Reconstruction Pass 3 — seamless terrain + controller deck
- Cropped atlas presentation rims during map rendering so 16x16 tiles read as continuous terrain rather than a visible square grid.
- Rebuilt the large lower touch-control area as an intentional SNES-inspired PRISM LINK controller deck with stronger tactile targets and regional accent framing.
- Required validation: 402x690 DPR3 village/world screenshots, touch control bounds, no page overflow, battle/Chapter regression.
