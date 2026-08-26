export type PixelEnemyKind = "warden" | "bastion" | "oracle" | "null" | "trickster";
export type PixelOrbKind = "fire" | "water" | "light" | "heart" | "guard";

export const PIXEL_ART_ASSETS = {
  hero: "/assets/pixel8/hero.png",
  enemies: {
    warden: "/assets/pixel8/warden.png",
    bastion: "/assets/pixel8/bastion.png",
    oracle: "/assets/pixel8/oracle.png",
    null: "/assets/pixel8/null-knight.png",
    trickster: "/assets/pixel8/trickster.png",
  } satisfies Record<PixelEnemyKind, string>,
  orbs: {
    fire: "/assets/pixel8/orbs/fire.png",
    water: "/assets/pixel8/orbs/water.png",
    light: "/assets/pixel8/orbs/light.png",
    heart: "/assets/pixel8/orbs/heart.png",
    guard: "/assets/pixel8/orbs/guard.png",
  } satisfies Record<PixelOrbKind, string>,
} as const;

/**
 * Single source of truth for generated character art. Replace a path here to swap
 * sprites without touching combat or stage logic. See docs/PIXEL_ART_STYLE.md.
 */
export function pixelEnemySrc(kind: PixelEnemyKind): string {
  return PIXEL_ART_ASSETS.enemies[kind];
}

export function pixelOrbSrc(kind: PixelOrbKind): string {
  return PIXEL_ART_ASSETS.orbs[kind];
}
