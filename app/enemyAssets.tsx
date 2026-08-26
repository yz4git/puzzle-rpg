"use client";

import { pixelEnemySrc, type PixelEnemyKind } from "./pixelArtAssets";

export type EnemyAssetKind = PixelEnemyKind;

const ENEMY_ALT: Record<EnemyAssetKind, string> = {
  warden: "Void Warden",
  bastion: "Iron Bastion",
  oracle: "Blood Oracle",
  null: "Null Knight",
  trickster: "Prism Trickster",
};

/**
 * Generated character art is intentionally isolated behind this component.
 * Swapping a path in pixelArtAssets.ts replaces art everywhere without touching
 * battle, intro, or progression logic.
 */
export function EnemySprite({
  kind,
  className,
  intro = false,
}: {
  kind: EnemyAssetKind;
  className?: string;
  intro?: boolean;
}) {
  return (
    <img
      className={className}
      src={pixelEnemySrc(kind)}
      alt={ENEMY_ALT[kind]}
      draggable={false}
      loading="eager"
      fetchPriority="high"
      decoding="sync"
      data-pixel-sprite="enemy"
      data-enemy-kind={kind}
      data-intro={intro ? "true" : "false"}
    />
  );
}
