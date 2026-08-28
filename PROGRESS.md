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

## SFC Visual Reconstruction Pass 15 — Cluster board readability
- Rebuilt the 6×6 board material treatment with stronger SFC bevels, scene-tinted framing and distinct ATK/HEAL/BAR/SKIP surface language without changing board dimensions.
- During touch preview, non-selected panels now recede while the selected connected cluster rises forward; the corresponding NEXT DROP columns receive matching emphasis.
- Replaced the generic clear shrink with a stepped cluster-break effect and strengthened the cluster-count banner.
- Touch hit areas, panel generation, collapse timing, battle math, NEXT queue order and Chapter Battle remain unchanged.

## SFC Visual Reconstruction Pass 16 — Battle HUD hierarchy
- Rebalanced the Intent row so NOW owns most of the visual weight while NEXT remains visible as secondary planning information.
- Reframed current enemy power as a compact high-contrast threat badge and reduced NEXT saturation/typographic weight to prevent the second action from competing with the immediate action.
- Rebuilt HP, BAR and FREE as distinct SFC-style status meters and reframed the message line as a scene-accented battle log.
- Preserved all row heights, board size, touch layout, intent order, status values, combat rules and Chapter Battle behavior.

## SFC Visual Reconstruction Pass 17 — RPG command window
- Rebuilt the command overlay as a scene-tinted SFC battle window instead of a generic mobile modal.
- Added a strong title band, pixel pointer rails, stepped press feedback, denser STATUS framing and clearer disabled-command treatment while keeping touch targets large.
- ITEM scrolling, TALK/ITEM/STATUS/RUN behavior, close/back behavior, turn costs and combat logic are unchanged.

## SFC Visual Reconstruction Pass 18 — Battle impact language
- Split the generic battle feedback into explicit enemy-hit, player-hit, heal, barrier, perfect-block, boss-phase, release, skill and item impact states.
- Added a fixed impact layer above the battle HUD/board and below dialogue/command overlays so attack effects can no longer disappear behind interface panels.
- Added target-specific stepped shakes, meter flashes and phase/release screen accents while preserving the existing 620ms feedback cadence for normal actions.
- Damage/heal/barrier values, enemy intents, turn order, collapse timing, battle rules, touch targets and Chapter Battle remain unchanged.

## SFC Visual Reconstruction Pass 19 — Encounter resolution transitions
- Added a short stepped battle-entry shutter so encounters arrive as a game scene rather than an instantaneous web view swap.
- Added enemy-HP-zero victory break, player-HP-zero defeat fade and RELEASE-specific exit light using the existing rendered HP state, with no new combat state machine.
- Extended only the visual result hold to 480ms for victory, 420ms for defeat and 620ms for RELEASE so the new resolution beats are visible before returning to the field/result flow.
- Rewards, outcome priority, battle math, save data, enemy logic, turn order, touch controls and Chapter Battle remain unchanged.


## SFC Visual Reconstruction Pass 20 — Battle reward ceremony
- Rebuilt the RPG battle result card into a staged battle report with persistent LV/HP/GOLD status, distinct reward, level-up, acquisition, story and loss rows.
- Added stepped reveal timing so EXP/GOLD lands first, LEVEL UP receives a dedicated celebratory beat and item/technique/equipment acquisitions read as separate rewards.
- Added a 520ms field-return flash/frame settle after CONTINUE so returning from battle feels like a scene transition instead of an overlay simply disappearing.
- EXP, GOLD, drops, level formulas, HP recovery, rewards, autosave, outcome handling, battle telemetry and Chapter Battle remain unchanged.

## SFC Visual Reconstruction Pass 21 — Field HUD hierarchy
- Rebuilt the exploration HUD so map/location identity is primary, HP reads as a green survival meter block and GOLD reads as a distinct reward/resource block.
- Reframed the location bar as a scene-accented navigation plaque and tightened the MEMO/JOURNEY strip into a quieter secondary information ribbon.
- Strengthened the world-frame bezel so the reconstructed map reads as the central game viewport instead of another web panel.
- Field controls, map rendering, collision, encounters, portal logic, save data and Chapter Battle remain unchanged.


## SFC Visual Reconstruction Pass 22 — Field menu reconstruction
- Rebuilt FIELD MENU as a four-part SFC command screen: framed title bar, six command slots, dedicated content window and persistent INFO footer.
- STATUS now reads as a compact character sheet; ITEM / EQUIP / TECH / MEMO use denser role-specific rows instead of web-card styling, with equipped/new states receiving stronger pixel cues.
- SHOP and SAVE/service panels now share the same game-window grammar, including compact currency/action framing and stepped pressed states.
- Menu tab logic, inventory/equipment behavior, prices, save/import/export, touch targets and RPG progression remain unchanged.


## SFC Visual Reconstruction Pass 23 — Title and mode select
- Reframed the opening screen as one SFC title composition with a pixel horizon/stage behind the existing hero art, stronger logo lockup and a compact PRISM ROAD subtitle plate.
- Converted RPG MODE and CHAPTER BATTLE from stacked web buttons into two numbered game-mode slots with distinct gold/cyan identity and stronger press feedback.
- Rebuilt the RPG continue/new-game screen as a save-slot window with CONTINUE visually prioritized while preserving the existing save metadata and mode flow.
- Title music, save loading, mode selection, Chapter Battle entry and RPG initialization remain unchanged.


## SFC Visual Reconstruction Pass 24 — Story presentation
- Split story presentation into two visual languages without changing text or progression: regular NPC dialogue remains field-anchored with stronger portrait/name hierarchy, while the opening EVENT becomes a centered chapter-style story window.
- Added presentation-only story/page data attributes so event dialogue can be staged differently from ordinary conversations without touching dialogue order, callbacks or save flags.
- Rebuilt the ending into a dedicated SFC finale scene with pixel horizon, framed narrative page, stronger ENDING/THE END hierarchy and a distinct final-state treatment.
- Opening text, dialogue content/order, mercy/force ending selection, ending progression, title return and save behavior remain unchanged.

## SFC Visual Reconstruction Pass 25 — Area transitions
- Replaced instant portal swaps with a presentation-only 180ms departure shutter, map commit, then a 420ms arrival plate showing the destination name and existing portal label.
- Added destination-type accenting for towns, training schools, dungeons and the world map while keeping the field renderer and map data unchanged.
- Locked movement, interaction and menu input only during the short transition window to prevent double portal activation or accidental post-transition inputs.
- Portal requirements, target coordinates, encounter reset, last-inn updates, save behavior, map topology and progression flags remain unchanged.


## SFC Visual Reconstruction Pass 26 — Discovery and acquisition presentation
- Replaced generic TREASURE dialogue for field chests with a dedicated discovery ceremony that distinguishes GOLD, ITEM and EQUIPMENT rewards while preserving the same tap-to-continue cadence.
- Added discovery input locking so movement/menu actions cannot fire underneath the acquisition card; the next A/TAP dismisses it and immediately returns control to exploration.
- Split battle-result acquisition rows into ITEM, EQUIPMENT and TECHNIQUE materials so training rewards and boss technique unlocks no longer read as identical text rows.
- Chest contents, inventory limits, equipment ownership, reward formulas, technique grants, save data, encounter logic and Chapter Battle remain unchanged.


## SFC Visual Reconstruction Pass 27 — Encounter warning & boss approach
- Split pre-battle presentation into WILD ENCOUNTER, DANGER ENCOUNTER, fixed GUARDIAN, training TRIAL and BOSS APPROACH cues using the existing enemy/context data.
- Added a short non-blocking warning when stepping from normal terrain into a danger tile so high-encounter regions announce themselves before the next fight.
- Boss fixed encounters now use a distinct gold warning marker and a longer stepped approach shutter, while ordinary fixed enemies keep a shorter guardian cue.
- Encounter meter math, encounter tables, fixed-enemy coordinates, boss flags, battle rules, rewards, save data and Chapter Battle remain unchanged.


## SFC Visual Reconstruction Pass 28 — Field enemy presence
- Animated fixed field enemies with a low-frequency stepped idle cadence using existing enemy frames, plus subtle bobbing and deterministic pixel aura/spark accents.
- Added proximity reactions within two tiles, including reaction frames and an alert glyph; bosses use a larger silhouette, gold/purple threat aura and stronger approach presence.
- Added a compact in-world threat plaque within three tiles so HOSTILE/BOSS identity and A • CONFRONT state are readable before interaction.
- Enemy coordinates, collision, fixed encounter flags, boss conditions, encounter tables, battle timing, rewards and save data are unchanged.

## SFC Visual Reconstruction Pass 29 — Town life and ambient motion
- Added a low-frequency town-life animation clock that runs only while actively exploring town maps, keeping the ambient pass inexpensive on iPhone.
- Added role-specific NPC micro-actions and one-pixel idle motion for merchants, soldiers, priests, scholars, elders, travellers, masters, mystery figures and children without changing NPC positions or interaction hit areas.
- Added distinct ambient motion to all five towns: Hearth Village chimney smoke, Lake Village water glints, Iron City forge sparks, Reed Hamlet drifting motes and Mirror Town reflective window flashes.
- NPC collision, dialogue, services, shops, story flags, map geometry, portals, save data and Chapter Battle remain unchanged.


## SFC Visual Reconstruction Pass 30 — Dungeon atmosphere
- Added low-frequency ambient animation to dungeon/danger exploration only: temple dust and embers, Crimson Marsh bubbles/fog, Mirror Tower reflection streaks, Void Pass crosswinds/shadows, and Prism Citadel prism veins/sweeps.
- Prism Citadel atmosphere now increases visually as the hero approaches the throne while leaving map coordinates, encounter logic and progression untouched.
- Added dungeon-specific viewport grading/vignettes, with a stronger final-dungeon bezel and scan texture.
- Ambient redraw runs at a restrained 430ms cadence only while actively exploring dungeon/danger maps; battle, menu and town screens do not pay this cost.
- Collision, portal targets, treasure rewards, enemy tables, boss flags, save data and Chapter Battle remain unchanged.

## SFC Visual Reconstruction Pass 31 — Boss rooms and setpieces
- Rebuilt important fixed-encounter locations as presentation-only setpieces around their existing map coordinates, leaving collision and encounter data untouched.
- Added a collapsed altar for Old Temple, a ritual pool for Crimson Marsh, reflective sanctum panels for Mirror Tower, paired void monoliths for Void Pass and an iron throne platform for Iron City.
- Reconstructed the Prism Sovereign approach as a five-tile ceremonial throne dais with a pulsing prism crown and flanking lights, while preserving the existing final-boss coordinate and progression flag.
- Setpiece animation reuses the low-frequency dungeon ambience frame and remains behind actors, enemies, chests and interaction markers.
- Boss conditions, enemy IDs, rewards, map topology, portal destinations, save data and Chapter Battle remain unchanged.


## SFC Visual Reconstruction Pass 32 — Visual consistency audit
- Audited title/mode select, RPG field HUD, dialogue, field menu, discovery/reward overlays, Chapter Battle HUD and chapter reward screens against one compact SFC presentation grammar.
- Reduced excess vertical chrome and secondary-copy weight while preserving the world map and 6x6 battle board as the dominant visual surfaces on iPhone portrait displays.
- Normalized frame density, typography hierarchy, touch-control proportions, menu row heights and modal spacing without changing gameplay, reward values, map data, battle logic, save data or progression.
- Added short-height overrides so the same hierarchy survives smaller Safari viewports instead of hiding primary information.

## SFC Visual Reconstruction Pass 33 — iPhone portrait final polish
- Hardened all title, RPG field, dialogue/menu/result, Chapter Battle and reward surfaces against iPhone safe-area clipping, short portrait heights and narrow displays without changing game logic.
- Raised undersized menu/navigation touch targets, disabled tap highlight/double-tap style browser gestures on controls, and added contained momentum scrolling only where long menus or reward cards need it.
- Added dedicated 380px-wide, 667px-tall and 590px-tall portrait breakpoints so world/board play space remains primary while secondary labels collapse before core interaction does.
- Added overflow wrapping and ellipsis rules for long Japanese/English labels plus symmetric left/right safe-area padding for Dynamic Island/notch landscape-to-portrait transitions.
- Viewport metadata, battle math, encounter logic, reward values, maps, story flags, save format and Chapter Battle rules remain unchanged.

## SFC Visual Reconstruction Pass 34 — Final visual regression and gameplay QA
- Ran browser-driven iPhone portrait QA at 375×667, 390×844 and 430×932 with touch/mobile emulation after a clean TypeScript check and production build.
- Verified title → RPG MODE → NEW GAME → opening dialogue → field exploration → FIELD MENU, plus CHAPTER BATTLE → stage intro → live 6×6 board.
- Browser QA found undersized NEW GAME / MODE SELECT, FIELD MENU tabs and CHAPTER MODE-return targets; raised those primary touch targets to at least 44 px. The RPG save-slot entrance was also changed from scaleY to stepped translate so its hit boxes never shrink during the opening animation.
- Checked horizontal overflow, fixed-card clipping, primary touch-target sizes, D-pad minimum sizes, world-canvas readability, menu tabs, 36 puzzle panels, six NEXT columns and runtime console/page errors.
- No gameplay values, encounter tables, maps, rewards, save data or battle math were changed by this QA pass.

## Release Candidate Stability Pass 35
- Ran targeted Puzzle RPG PWA tests plus browser-driven iPhone Safari-style stability QA after a clean TypeScript check and production build.
- Verified build-id Service Worker registration, controlled reload, offline app-shell reload, RPG opening autosave, immediate reload/CONTINUE persistence, pagehide persistence and rapid mode transitions.
- Browser QA found that normal field movement could remain only in React state until a later autosave event; added pagehide and hidden-state lifecycle persistence backed by a synchronously updated save ref so iPhone app switching/reload preserves the newest field state.
- Chapter Battle transition QA follows the intended Stage Intro → Battle Start → Mode-return input order; the stage intro correctly blocks background controls.
- No gameplay balance, encounter tables, rewards, maps or battle math were changed by this stability pass.

## Release Candidate Pass 36 — Save Integrity & Recovery
- Added one-generation local save backup rotation and automatic recovery when the primary JSON is malformed or missing.
- Added tolerant migration for recognizable pre-release/versionless saves while explicitly refusing future-version saves to prevent accidental downgrade.
- Hardened save normalization: blocked/water coordinates recover to the nearest walkable tile; duplicate inventory stacks are merged; invalid/duplicate item, equipment, technique, flag, chest and encounter data are sanitized and bounded.
- Added a permanent targeted RPG save-integrity regression test covering corrupted-primary recovery, future-version protection, backup rotation and storage-write failure safety.
- Safari/private-mode/quota write failures remain non-fatal; gameplay balance, encounter tables, rewards, map topology and battle math are unchanged.

## Release Candidate Pass 37 — Long Session / Timer Stability
- Added explicit ownership for delayed field encounter, held-input, battle finish and battle feedback timers so transient callbacks cannot outlive their owning RPG screen.
- Safari pagehide/hidden lifecycle now releases held d-pad repeat immediately, while play-time accumulation pauses when the document is backgrounded.
- Replaced per-render RPG keyboard listener churn with one stable listener backed by a current handler ref, and release atlas image onload handlers/references on RPGMode unmount.
- Added targeted lifecycle regression tests plus a Chromium iPhone-size soak covering repeated menu cycles, 120 real touch taps, pagehide during a held touch and 12 RPG mount/unmount cycles with interval and heap-growth checks.
- Gameplay balance, encounter odds, map topology, rewards, save progression and battle math remain unchanged.

## RPG Field Control / Battle Entry Usability Pass
- Enlarged the field D-pad to 50px cardinal touch cells on normal portrait screens and never below 44px on short iPhones.
- Added a synchronous movement lock so the exact encounter-triggering step cancels held repeat before the delayed battle cue; stale callbacks cannot move the player behind combat.
- Fixed startHold so it cannot recreate a repeat interval after move() synchronously rolls an encounter.
- Strengthened field-to-battle presentation with full-screen pixel shutters, a prism cross burst and longer encounter-class-specific timing while preserving battle rules.
- Added source regression tests and an iPhone-size real-pointer browser QA that holds UP through a forced encounter and verifies the saved position remains exactly on the triggering tile.
- Encounter odds, map topology, enemy stats, rewards, save format and puzzle battle math remain unchanged.
\n\n## Early-game play review improvements — items 1–5
- Reframed field exploration from a 15x13 landscape-leaning camera to a 13x13 portrait-friendly camera, making the visible field about 15% taller on iPhone without scaling or blurring the pixel art.
- Rebuilt the oversized lower control deck into a fixed compact controller plus a useful field-status area. Primary iPhone direction cells remain 50px; smaller/shorter screens retain 44px+ targets.
- Dialogue and event scenes now hide the field-status/controller layers behind the dialogue presentation so conversations no longer stack three competing UI bands.
- Added compact NEXT GOAL / NEXT LV / ARMOR / ENCOUNTER field information to use the recovered portrait space with RPG-relevant information rather than empty controller chrome.
- Old Temple no longer rolls HOLLOW MONK as a normal encounter; its early table is now MOSS SLIME / THORN BAT / COPPER BEETLE. Later dungeons retain HOLLOW MONK.
- New games start with TRAVELLER COAT equipped and HP/MAX HP 22, making starter gear explicit and reducing the first-dungeon punishment spike.
- Removed the title screen's large hero-to-mode-select dead zone while preserving the existing title art and touch target sizes.
- No story flags, map collision/topology, boss placement, reward logic, battle rules, Chapter Battle logic, or existing-save format were changed.
