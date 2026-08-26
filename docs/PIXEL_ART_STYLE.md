# Puzzle RPG — 8-bit pixel art style guide

This file is the canonical prompt/style reference for future generated sprites.

## Core direction

Original late-8-bit home-console JRPG pixel art. Do not imitate or reproduce any existing character, monster, logo, map, UI, or copyrighted sprite. Capture only the era-level constraints: chunky silhouettes, tiny sprite resolution, hard 1px clusters, limited palettes, high contrast, black/dark outlines, no anti-aliasing, no gradients, no painterly shading, no 16-bit density.

## Master generation prompt

Create an ORIGINAL 8-bit home-console JRPG sprite for Puzzle RPG. Use authentic late-1980s 8-bit constraints: approximately 32–64 logical pixels tall, hard square pixels, crisp 1px clusters, no anti-aliasing, no sub-pixel smoothing, no gradients, no soft lighting, no modern vector finish. Use a compact palette of roughly 4–8 colors plus transparent background and a dark outline. Silhouette must read instantly at small size. Favor bold asymmetric shapes, simple readable equipment, one clear face/eye feature, and large color blocks. Keep detail below 16-bit console density. Transparent background. Full body. Front or slight 3/4 battle pose. Original design only; do not reproduce any existing game character or monster.

## Enemy continuation suffix

Match the existing Puzzle RPG enemy sprite family: Warden = purple floating void mage; Bastion = gold armored shield knight; Oracle = blood-red hooded ritual caster; Null Knight = steel-blue anti-magic swordsman with shield; Trickster = bright multicolor jester. Preserve each enemy's silhouette language and palette identity while creating a new pose/variant.

## Player continuation suffix

Match the Puzzle RPG hero: compact young adventurer, brown spiky hair, blue tunic/armor, red cape, short bright sword, readable heroic stance. Keep the same 8-bit palette and proportions as the title sprite.

## UI art prompt

Original 8-bit JRPG interface assets on a black background: 1–2 px white rectangular borders, square corners with tiny pixel notches, monochrome/palette-limited icons, no rounded mobile-card look, no gradients, no blur, no glassmorphism. Information hierarchy should remain modern and readable on iPhone portrait while the surface treatment looks like an 8-bit RPG.

## Replacement contract

Character files live under `public/assets/pixel8/` and are referenced through `app/pixelArtAssets.ts`. Replace the file path there to swap art without changing battle logic. Always use CSS `image-rendering: pixelated` for these assets.
