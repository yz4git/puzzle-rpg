# RPG MODE Progress

## Current phase

Phase 6 complete — the first full Overworld → Encounter → Cluster Break → Overworld loop is playable. Phase 7 asset production is next.

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

## In progress

- Generate and normalize the RPG sprite/tile/enemy/UI atlases using the fixed art prompt.
- Replace the code-drawn overworld fallback with atlas-backed rendering while retaining a safe fallback.

## Not completed

- Generated production atlases, complete story-text pass, real-browser iPhone playthrough, five-archetype balance pass, final GitHub merge and existing Sites deployment.

## Next work

1. Generate Hero/NPC, field/town/dungeon, enemy/boss and UI atlas groups.
2. Integrate the cleaned atlases and run visual audit at 402×690 DPR3.
3. Complete content/balance passes, then fast-forward `main` and publish the existing Sites project.

## Important decisions

- Existing Chapter Battle remains isolated and keeps its current tuning.
- RPG bonuses are explicit threshold rules; `1 PANEL = 1 EFFECT` remains the base.
- Maps and content are data-driven.
- Active play is never interrupted by a Service Worker reload or redirect.
- BGM remains WebAudio-generated and completely original; it does not reproduce reference melodies.
- Battle records retain only the latest 120 fights and never include personal data.

## Known issues

- Current map art is a readable code-drawn fallback pending generated-atlas integration.
- Full-route browser balance data has not yet been collected.
