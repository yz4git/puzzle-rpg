# Sky Dancer V35 — Reference Art Direction Contract

## Reference
The user-supplied Sky Dancer gameplay image shared on 2026-08-25 is the visual north star for all subsequent graphics work. V35 does not copy a third-party game UI or assets; it extracts the composition principles that matter for Sky Dancer: dense low-poly city readability, deep blue atmosphere, layered mountain silhouettes, below-flight cloud patches, a strong hero aircraft, clean target hierarchy, and premium but restrained HUD framing.

## Why V35 exists
V34 improved boss readability and atmospheric consistency, but the visual playcheck showed a regression in scene richness versus the strongest earlier captures. In particular, V34 hid the V31 patchwork layer, V32 continued to suppress V31 settlement meshes, and V34 vertically exaggerated ridge layers. The combined result was a flatter green carpet, sparse city read, large rounded horizon masses, and less of the high-altitude metropolitan scale visible in the reference.

## Non-negotiable visual targets
1. **City density is the primary ground focal point.** The common opening view must show a coherent metropolitan core with hundreds of readable low-poly buildings, several height tiers, one or more unmistakable landmark towers, roads and water structure.
2. **Patchwork terrain supports the city instead of replacing it.** Restore V31 field color variation at reduced visual dominance. Avoid a single flat green carpet and avoid giant board-game rectangles.
3. **Mountains are angular and distant.** Replace oversized dome/slab silhouettes with low-poly ridges that form a continuous but broken skyline. Mountains must not consume the middle third of the frame.
4. **Clouds stay below the flight plane.** Use sparse, thin, semi-transparent cloud patches around the city/valley. Do not reintroduce a distant cloud sea or large opaque horizon banks.
5. **Atmosphere keeps distant contrast.** Deep blue zenith, lighter horizon, fog beginning far enough away that the central city remains legible. City depth must come from value and scale hierarchy rather than being erased by fog.
6. **Hero aircraft remains dominant without filling the screen.** Preserve the existing aircraft silhouette and engine glow; frame it against readable city/sky negative space.
7. **HUD hierarchy follows the reference composition.** Brand and status live at the periphery; objective/target information stays near the top center; controls are compact; warnings do not cover the aircraft or target. Do not invent score, weapon inventory or radar data that the runtime does not actually provide.
8. **Combat remains readable.** Enemy silhouettes and lock brackets must survive against the denser city. V34 boss phase/core language remains intact.
9. **Mobile performance is part of art quality.** New world density must use instancing, fixed draw-call counts, deterministic tile rebuilds, no per-frame bulk allocations, and no texture dependency.

## V35 implementation plan
### A. Recover lost world detail
- Re-enable `sky-dancer-v31-patchwork-fields` after the V34 pass and retune its palette/material hierarchy rather than hiding it.
- Re-enable V31 settlement buildings and landmark towers after V32's compatibility hide step.
- Hide V34's broad seven-sided terrain masses once the richer field/city hierarchy is active.

### B. Add a dedicated metropolitan core
- Add a V35 instanced metro layer with low/mid/high building tiers.
- Build a deterministic city core per world tile with a readable street grid and river corridor.
- Add landmark towers with stronger vertical rhythm around the central approach.
- Keep building counts fixed and bounded for iPhone.

### C. Replace degraded horizon treatment
- Suppress the V32/V34 ridge layers that read as large rounded masses.
- Add new faceted mountain chains using low-poly cone geometry, two depth tiers and atmospheric value separation.
- Keep the skyline below the target/aircraft combat band.

### D. Cloud and atmosphere pass
- Add sparse below-flight cloud patches with flattened low-poly lobes.
- Keep cloud opacity low and depthWrite disabled.
- Extend fog distance so the metro remains visible while the far mountains soften.
- Preserve the V34 gradient dome but shift the balance toward a deeper blue upper sky.

### E. Camera composition
- Add a final V35 camera presentation decorator after V32 camera balance.
- Move the horizon lower in the image (more sky than current V34), closer to the supplied reference composition.
- Do not change gameplay coordinates or the 300 m flight model.

### F. HUD composition pass
- Add V35 HUD overrides after V34.
- Keep real existing values only.
- Reduce inherited card bulk and increase transparent negative space.
- Keep the compass/brand/target bracket style established by the previous HUD quality pass, but align spacing with the reference.
- Preserve V34 boss phase/core HUD and missile-warning behavior.

## Acceptance gates
- CI, lint, Pages artifact validation all pass.
- Real WebGL opening capture shows a dense city/road/river read in the central and lower-middle field of view.
- Mountains read as angular distant ridges, not giant rounded domes.
- Clouds remain sparse and below the aircraft, with no distant cloud-sea wall.
- Player aircraft remains unobstructed by HUD.
- V34 boss WebGL cadence/core-open audit still passes.
- Turbo isolation audit still passes.
- No console/page errors in the visual audit.
- If V35 visual capture is visibly worse than V32/V33 in density, depth or readability, V35 must not be merged.
