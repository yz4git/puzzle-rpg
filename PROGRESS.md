# RPG MODE Progress

## Current phase

Phase 1 — specification and recovery setup.

## Completed

- Confirmed the latest pre-RPG baseline includes Chapter Battle, BUILD, Stage 6–10 balance and the three-phase PRISM SOVEREIGN.
- Preserved `restore/core-game-complete-20260827`.
- Created `restore/pre-rpg-mode-20260828` from the latest GitHub `main`.
- Defined runtime architecture, save contract, content map and art bible.
- Replaced the obsolete automatic fresh-page policy with background-only Service Worker updates.

## In progress

- Separate the application title/mode shell from Chapter Battle.
- Add a reusable RPG battle integration without changing the protected Chapter balance.

## Not completed

- World runtime, RPG content, generated atlases, audio pass, browser playthrough, balance pass and final deployment.

## Next work

1. Add `PuzzleRPGApp` title with RPG MODE / CHAPTER BATTLE.
2. Implement RPG state machine and tile-map renderer.
3. Complete one Overworld → Encounter → Cluster Break → Overworld loop.

## Important decisions

- Existing Chapter Battle remains isolated and keeps its current tuning.
- RPG bonuses are explicit threshold rules; `1 PANEL = 1 EFFECT` remains the base.
- Maps and content are data-driven.
- Active play is never interrupted by a Service Worker reload or redirect.

## Known issues

- RPG MODE is not yet reachable in this Phase 1 checkpoint.
