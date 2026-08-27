# RPG MODE Art Bible

## Visual identity

Original late-1980s home-console pixel art, interpreted with modern readability. The game must look authored for a strict low-resolution machine rather than like modern illustration reduced in size.

## Hard rules

- Logical tiles are 16×16 pixels.
- Sprites use hard one-pixel edges, no antialiasing, no gradients and no semi-transparent edge pixels.
- One sprite uses four to eight visible colors plus transparency.
- Outlines are one logical pixel and remain readable against near-black, grass, stone and water.
- Shading uses clusters of square pixels, never soft noise or airbrush texture.
- Scaling uses `image-rendering: pixelated` / nearest-neighbour only.
- Characters face down, left, right and up. Walk cycles have contact, passing and opposite-contact frames.
- Enemy portraits preserve the existing Puzzle RPG silhouette density: large black shapes, one bright identity color and one pale readable accent.

## Master palette

| Role | Colors |
|---|---|
| Ink | `#050509`, `#151522`, `#2b2938` |
| Paper/light | `#fff7d8`, `#d9d3b2` |
| Hero | `#f0c85a`, `#df5b3d`, `#4969a6`, `#f0d1a0` |
| Field | `#183a24`, `#2e6336`, `#62a34f`, `#a2c867` |
| Water | `#123a58`, `#206a86`, `#55b3ba` |
| Stone | `#343846`, `#626778`, `#a3a3a5` |
| Danger | `#5a1729`, `#a32f3b`, `#e45c45` |
| Prism | `#663b9b`, `#a85bd1`, `#54c9d5`, `#f4d65d` |

## Sprite sheets

- Hero: 4 directions × 3 walking frames, plus damage, victory and down.
- NPC base sheet: elder, woman, man, child, soldier, merchant, priest, master, ruler, scholar, traveller and masked stranger. Palette swaps expand the cast.
- Field, town and dungeon sheets keep a visible 16×16 grid and include no UI text.
- Enemies: idle and reaction. Bosses may add attack, hurt and phase frames.
- UI icons: 16×16 with transparent background and a one-pixel light keyline.

## Fixed ImageGen base prompt

```text
Use case: stylized-concept
Asset type: production sprite sheet for an original mobile web RPG
Primary request: [ASSET-SPECIFIC CONTENT]
Style/medium: authentic late-1980s 8bit home-console pixel art; deliberately low resolution; hard square pixels; 16x16 logical grid; 4–8 colors per sprite; one-pixel dark outline; bold readable silhouette
Composition/framing: exact orthographic sprite-sheet grid, even cell spacing, every sprite fully inside its cell, no overlap
Color palette: near-black ink, warm ivory highlights, limited muted jewel colors matching Puzzle RPG
Constraints: completely original characters and world; transparent background where requested; nearest-neighbour appearance; no antialiasing; no gradients; no blur; no text; no logos; no watermark
Avoid: 16bit detail density, painterly shading, modern vector art, perspective camera, soft lighting, tiny unreadable accessories, copyrighted characters or recognizable franchise designs
```

## Post-processing checklist

1. Crop to the usable sheet and normalize cell dimensions.
2. Quantize to the target palette without dithering.
3. Remove near-transparent fringe pixels.
4. Resize only by nearest neighbour.
5. Export PNG with alpha and build a deterministic atlas manifest.
6. Verify at iPhone portrait size and against at least grass, stone and black backgrounds.
