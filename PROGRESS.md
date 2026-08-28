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


## Visual Reconstruction Pass 4 — world metatile routes
- Replaced modern-looking dashed world road atlas cells with connected dirt-road metatiles painted over the grass foundation.
- Replaced rectangular red danger tile strips with a connected CRIMSON SCAR route plus deterministic corruption tendrils.
- Bridges, collision, encounter danger flags, portals and map topology remain unchanged.
- Required validation: Prism Road 402x690 screenshot, route continuity near intersections, natural encounter, battle and Chapter regression.

## SFC Visual Reconstruction Pass 4 — Landmark correction
- Identified the apparent legacy roads as oversized portal-atlas landmark cells, not terrain.
- Replaced world-map portal atlas cells with compact target-specific pixel landmarks so roads and destinations read as separate layers.
- Preserved existing portal collision, progression gates and non-world portal rendering.

## SFC Visual Reconstruction Pass 5 — Forest / ground continuity
- Rebalanced world grass atlas selection so plain field cells dominate and decorative flower/stone cards become sparse accents.
- Forest atlas selection now depends on neighbouring forest tiles: dense canopy inside, single trees/clearings at the perimeter.
- Added forest seam stitching and low-frequency 3x3 ground macro tinting without changing map collision or encounter data.

### Pass 5 correction — Forest metatile compositor
- Rejected the straight seam-fill prototype after visual audit because it created a bright grid.
- World forest now uses a greedy 2x2 canopy compositor over grass, reducing 16px seams while keeping single-tree edge silhouettes.

- SFC Visual Reconstruction Pass 5: cropped trunk-heavy lower source area from 2x2 interior forest metatiles and restricted dense variants to canopy-first cells.

## SFC Visual Reconstruction Pass 6 — Water / ridge / landmark ground
- Reconstructed world lake and river tiles as one continuous procedural 16-bit water surface with bridge-aware shorelines.
- Reconstructed mountain tiles into connected ridgelines and cliff faces instead of isolated atlas cards.
- Added destination-specific landmark ground footprints/plazas so towns, schools, dungeons and the citadel visually connect to the road network.
- Map collision, encounters, portals and progression data are unchanged.

- Pass 6 visual correction: rejected the first rectangular ridge because it read as a fortress wall. Replaced it with overlapping stepped peaks/foothills and added a dedicated bridge compositor over the continuous water layer.

- Pass 6 ridge meta correction: replaced the remaining 16px repeated mountain cadence with a two-pass continuous rock foundation plus 2-tile-wide overlapping metapeaks.

- Pass 6 natural ridge correction: removed the remaining full-width lower rock band; metapeaks now extend across both mountain rows with broken polygon toes while the lower row uses sparse foothill/scree shapes.


## SFC Visual Reconstruction Pass 7
- Rebuilt world-map portals as 2-4 tile landmark silhouettes instead of single-tile symbols.
- Added distinct village clusters, Iron City fortress, four master schools, Old Temple, Mirror Tower, Void Pass, Crimson Marsh and Prism Citadel art.
- Added irregular landmark aprons/approaches and locked-gate seal markers without changing map collision, portal coordinates or encounter data.
- Preserved the Pass 6 continuous water, bridge, mountain, forest and route reconstruction.
- Pass 7 audit correction: dense danger blocks now render as continuous corruption fields; locked major landmarks keep an opaque seal marker.
- Pass 7C: Crimson Marsh corruption boundary gains irregular grass bites, moss islands and deep pools to remove the rectangular biome silhouette.


## SFC Visual Reconstruction Pass 8 — Interior maps
- Reconstructed town, training, dungeon and danger-area interiors with region-specific procedural floor, road, wall, water, hazard and altar layers.
- Replaced generic non-world portal atlas stamps with contextual town gates, training altars, dungeon doors, Void rock gate and Prism gate art.
- Added blocked-edge foreground lips and town facade foundations for stronger SNES-style layering without changing collision or map progression.
- Map data, NPC coordinates, encounter rules, boss conditions and saves remain unchanged.

- Pass 8B audit correction: removed dungeon walkable-floor road stamping, grouped floors into 2x2 macro palettes, rebuilt training altar rows as connected dais structures, added sparse exposed-wall pillars, and changed Void floor from repeated hazard stamps to dark fractured rock.


## SFC Visual Reconstruction Pass 9 — Character / dialogue presentation
- Added role-specific environmental props behind merchants, soldiers, priests, scholars, elders, masters, mystery NPCs and children.
- Added a pixel talk marker only for the NPC directly in front of the hero and contextual bump text (`NPC name • Aで話す`).
- Added crisp 48x64 atlas portraits to NPC dialogue windows while keeping story/system dialogue portrait-free.
- Dialogue behavior and NPC actions are unchanged.

## SFC Visual Reconstruction Pass 10 — Interaction clarity
- Moved interaction glyphs to the final canvas layer so large hero/NPC sprites cannot hide them.
- Reduced the marker footprint and added contextual front-tile glyphs for TALK, treasure, fixed encounters and exits.
- Interaction rules, collision, map data, progression and save format are unchanged.

## SFC Visual Reconstruction Pass 11 — Dialogue portrait crop
- Reframed NPC dialogue portraits from full-body thumbnails to centered upper-body crops using the existing high-resolution NPC atlas.
- Kept story/system dialogue portrait-free and preserved all dialogue logic and NPC actions.
- Added a restrained inner portrait-frame highlight/shadow without adding new production assets.

## SFC Visual Reconstruction Pass 12 — Touch control deck
- Removed the soft central radial glow from the touch deck and replaced it with a crisp region-tinted prism core.
- Renamed the decorative header to FIELD CONTROL and added MOVE / ACTION labels to make the large portrait control area visually intentional.
- Preserved D-pad/A/B hit areas, button sizes, Pointer Events and gameplay input behavior.

## SFC Visual Reconstruction Pass 13 — Battle stage composition
- Rebuilt the enemy strip as a grounded SFC-style battle stage with a scene-tinted pixel floor band and stronger contact platform.
- Enlarged normal/boss enemy presentation without reducing the 360px short-screen puzzle board.
- Reframed enemy information as a denser in-world window and added a stepped TALK reaction treatment driven by the existing reaction sprite state.
- Battle math, panel rules, NEXT queues, intents, save data and encounter tables are unchanged.

## SFC Visual Reconstruction Pass 14 — Enemy reaction readability
- Reframed TALK as a high-contrast ENEMY REACTION window with larger text, a scene-tinted accent rail and stronger SFC window hierarchy.
- Temporarily dims NOW/NEXT and status panels only while the existing 900ms TALK reaction is visible, then restores them unchanged.
- TALK turn cost, duration, enemy response, alternate-resolution rules and battle math are unchanged.

## SFC Visual Reconstruction Pass 15 — Prism board housing
- Unified NEXT DROP MAP and the 6x6 puzzle board as one scene-tinted PRISM BOARD device using shared SFC-style housing colors.
- Added tiny non-interactive corner rails and a PRISM ARRAY label outside the play cells; panel colors, labels and hit regions are untouched.
- The housing matches the existing regional board selector specificity so its scene frame and preview highlight reliably win the cascade in Safari/Chrome; puzzle logic and timing are unchanged.
