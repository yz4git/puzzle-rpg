# RPG MODE Art Bible

## Visual identity

Original late-1980s home-console pixel art, interpreted with modern readability. The game must look authored for a strict low-resolution machine rather than like modern illustration reduced in size.

## Hard rules

- Gameplay remains on a 16×16 logical tile grid. Production terrain cells are
  stored at 64×64 and sampled once by the 2× internal-resolution renderer.
- Sprites use hard one-pixel edges, no antialiasing, no gradients and no semi-transparent edge pixels.
- Each sprite keeps a compact, coherent palette. Do not run a second global
  quantization pass over approved source art; it destroys local highlights and faces.
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
- UI icons: 96×96 production cells with transparent background and a light keyline,
  displayed at 16–24 logical pixels with nearest-neighbour sampling.

## Visual Reconstruction pipeline

The production sheets are not thumbnails. The renderer owns the reduction to the
logical screen grid, so source detail is discarded exactly once and never enlarged
again afterward.

| Atlas | Grid | Production cell |
|---|---:|---:|
| Field / Town / Dungeon | 10×10 / 8×8 | 64×64 |
| Hero | 4×4 | 96×96 |
| NPC | 4×3 | 96×128 |
| Enemy A / B | 4×3 / 8×3 | 128×128 |
| Boss | 8×3 | 160×160 |
| UI | 5×4 | 96×96 |

- Extract every source cell before resizing. Never resize a complete enemy or boss
  sheet into a different aspect ratio.
- Fit characters and enemies into transparent target cells while preserving aspect
  ratio and grounding them on a common baseline.
- The overworld uses a 2× backing canvas, semantic road connections, connected
  building facades, ground shadows and ordered layers: terrain → structures → props
  → actors.
- Battle sprites use their full production cell. NEXT DROP MAP, readout and board
  share one exact CSS width variable so all six columns align.
- `scripts/rebuild-rpg-visual-atlases.sh` is the deterministic rebuild entrypoint.

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
2. Preserve the approved local palette; quantize only when a source is demonstrably
   outside the art bible and never as a blanket atlas operation.
3. Remove near-transparent fringe pixels.
4. Resize only by nearest neighbour.
5. Export PNG with alpha and build a deterministic atlas manifest.
6. Verify at iPhone portrait size and against at least grass, stone and black backgrounds.
