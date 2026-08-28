# RPG MODE Visual Reconstruction Bible

## Target
SNES-inspired late-16-bit JRPG presentation optimized for portrait iPhone Safari. This is not hardware emulation; it is a disciplined 16bit+ art system.

## Core visual rules
- Gameplay tile grid remains 16x16 logical pixels.
- Field hero renders around 26x30 px; NPCs around 24x32 px so silhouettes read above terrain detail.
- Pixel edges only. No CSS image smoothing.
- Character shading should read in 2-4 deliberate value steps.
- Environment art may use richer palettes than 8-bit, but each region needs a controlled dominant palette.
- UI uses warm ivory borders, dark navy/black interiors, and one regional accent.
- Battle board remains the primary interaction surface and should stay 340-388 px on current iPhone portrait viewports.
- Battle enemies must visually contact their scene with a grounding shadow and scene-specific backdrop.
- TALK is a character moment: enemy reaction copy receives a dedicated message window before the enemy turn resolves.

## Regional palette identities
- Hearth Village / Ember Shrine: warm ochre, leaf green, brown.
- Lake Village / Quiet Bower: cyan, blue-green, pale stone.
- Iron City / Iron Hall: steel blue, slate, cool gray.
- Reed / Crimson Marsh: dark crimson, plum, muted rose.
- Mirror / Hour areas: violet, silver, midnight blue.
- Void Pass: near-black navy with cyan accents.
- Prism Citadel: ivory, violet, gold.

## Field composition
- Terrain should read as connected geography, not isolated tile stamps. Roads need visible continuity and landmarks should dominate local silhouettes.
- Character feet are the collision anchor; artwork may overlap the logical 16x16 tile vertically.
- Menus should leave some field visible so they feel like RPG windows, not a separate web page.

## Battle composition
- Scene-specific horizon occupies the enemy presentation band.
- NOW remains brighter than NEXT.
- NEXT DROP MAP remains column-aligned to the 6x6 board.
- Damage/heal feedback and TALK windows stay above all battle UI.
- Board uses a framed prism/altar presentation but panel colors and symbols remain immediately readable.

## Asset generation base prompt
Original late-16-bit console JRPG pixel art, SNES-era visual richness, strict pixel edges, readable silhouettes, controlled palette, no antialiasing, no photorealism, game-ready sprite sheet or tileset, cohesive original fantasy world, strong value grouping, 2-4 step pixel shading, designed for nearest-neighbor scaling.

## Next asset pass
1. Hero directional sheet with stronger hair/clothing silhouette.
2. NPC archetype sheet with shape differences, not palette swaps.
3. Region-specific field edge/autotile pack.
4. Town facade/prop pack.
5. Dedicated pixel battle background strips replacing CSS prototype scenery.
6. TALK reaction frames for high-value enemies and bosses.
