"use client";

import type { CSSProperties, ReactElement } from "react";

export type EnemyAssetKind = "warden" | "bastion" | "oracle" | "null" | "trickster";

type PixelSprite = {
  /** Set this to /assets/enemies/foo.png later to replace the built-in sprite. */
  src?: string;
  alt: string;
  palette: Record<string, string>;
  rows: string[];
};

const TRANSPARENT = ".";

export const ENEMY_SPRITES: Record<EnemyAssetKind, PixelSprite> = {
  warden: {
    alt: "Void Warden",
    palette: { A: "#1a1433", B: "#4a2c78", C: "#8d63c9", D: "#d9c7ff", E: "#f4f0ff", F: "#4b82d9" },
    rows: [
      "........................",
      "..........DD............",
      ".........DCCD...........",
      "....DD..DCCCCD..DD......",
      "...DCCDDCCCCCCDDCCD.....",
      "...DCCCCBBBBCCCCCCD.....",
      "....DCCBBBBBBCCCD.......",
      "...DCCBBAAAAABBCCD......",
      "..DCCBBAEAAEAABBCCD.....",
      "..DCCBBAAAAAAABBCCD.....",
      "..DCCBBBAFFAABBBCCD.....",
      "...DCCBBFFFFBBCCD.......",
      "....DCCBBBBBBCCD........",
      ".....DCCBBBBCCD.........",
      "....DCCBBBBBBCCD........",
      "...DCCBBBBBBBBCCD.......",
      "..DCCBBBCCCCBBBCCD......",
      ".DCCBBBCCDDCCBBBCCD.....",
      ".DCCBBCCD..DCCBBCCD.....",
      "..DCCCCD....DCCCCD......",
      "...DCCD......DCCD.......",
      "....DD........DD........",
      "........................",
      "........................",
    ],
  },
  bastion: {
    alt: "Iron Bastion",
    palette: { A: "#2a261c", B: "#5c4b2b", C: "#9a7835", D: "#d4aa53", E: "#ffe59b", F: "#ffffff" },
    rows: [
      "........................",
      ".......DDDDDDDD.........",
      ".....DDCCCCCCCCDD.......",
      "....DCCBBBBBBBBCCD......",
      "...DCCBBDDDDDDBBCCD.....",
      "..DCCBBDDDDDDDDBBCCD....",
      "..DCBBDDCCCCCCDDBBCD....",
      ".DCBBDDCCEEEECCDDBBCD...",
      ".DCBBDCCEFFFFECCDBBCD...",
      ".DCBBDCCEFFFFECCDBBCD...",
      ".DCBBDDCCEEEECCDDBBCD...",
      ".DCBBDDDCCCCCDDDDBBCD...",
      "..DCBBBBDDDDBBBBCCD.....",
      "..DCCBBBBBBBBBBCCD......",
      "...DCCBBBBBBBBCCD.......",
      "..DDCCBBBBBBBBCCDD......",
      ".DCCCCCCBBBBCCCCCCD......",
      "DCCDDDCCBBBBCCDDDCCD....",
      "DCD...DCCBBCCD...DCD....",
      "DD.....DCCCCD.....DD....",
      "........DCCD............",
      "........DCCD............",
      ".........DD.............",
      "........................",
    ],
  },
  oracle: {
    alt: "Blood Oracle",
    palette: { A: "#2b0b18", B: "#64152e", C: "#a82b4c", D: "#e15a75", E: "#ffd4df", F: "#ffef9d" },
    rows: [
      "........................",
      "...........DD...........",
      "..........DCCD..........",
      "......D..DCCCCD..D.......",
      ".....DCD.DCCCCD.DCD......",
      "....DCCDDCCCCCCDDCCD.....",
      "...DCCCCCBBBBCCCCCCD.....",
      "..DCCCCBBAAAAABBCCCCD....",
      "..DCCCBAAEAAEAABCCCD.....",
      "...DCCBAAAAAAAABCCD......",
      "....DCBBAFAFABBCCD.......",
      ".....DCCBBBBBCCD.........",
      "......DCCBBBCCD..........",
      ".....DCCBBBBBCCD.........",
      "....DCCBBCCCBBCCD........",
      "...DCCBBCCCCCBBCCD.......",
      "..DCCBBCCDDDCCBBCCD......",
      ".DCCBBCCD...DCCBBCCD.....",
      ".DCBBBCCD...DCCBBBCD.....",
      "..DCCCCD.....DCCCCD......",
      "...DCCD.......DCCD.......",
      "....DD.........DD........",
      "........................",
      "........................",
    ],
  },
  null: {
    alt: "Null Knight",
    palette: { A: "#101622", B: "#273246", C: "#586b88", D: "#9db0cc", E: "#e8f0ff", F: "#75b7ff" },
    rows: [
      "........................",
      "...........EE...........",
      "..........EDDE..........",
      ".........EDDDDE.........",
      "........EDCCCCDE........",
      ".......EDCBBBCDE........",
      "......EDCBABABCDE.......",
      "......EDCBFAFBCDE.......",
      "......EDCBABABCDE.......",
      "......EDCBBBBBCDE.......",
      ".......EDCCCCDE.........",
      "........EDDDDE..........",
      ".......EDCCCCDE.........",
      "......EDCCBBCCDE........",
      ".....EDCCBBBBCCDE.......",
      "....EDCCBBBBBBCCDE......",
      "...EDCCBBBCCBBBCCDE.....",
      "..EDCCBBBCEECBBBCCDE....",
      ".EDCCBBBCE..ECBBBCCDE....",
      "..EDCCCCE..ECCCCDE......",
      "...EDDDE....EDDDE.......",
      "....EEE......EEE........",
      "........................",
      "........................",
    ],
  },
  trickster: {
    alt: "Prism Trickster",
    palette: { A: "#1b1830", B: "#5f37a6", C: "#3db8d8", D: "#ee5b9f", E: "#ffd75c", F: "#f5fbff" },
    rows: [
      "........................",
      ".....E............C.....",
      "....EDE..........CDC....",
      "...EDBDE........CBBCC...",
      "....DBBDE..FF..CBBBC....",
      ".....DBBDFFFFCBBBC......",
      "......DBFBBBBFBCD.......",
      ".....DBBFBAABFBBCCD.....",
      "....DBBBFAEAFBBBCCD.....",
      "...DBBBBFAAABBBBCCD.....",
      "....DBBBBFABBBBBCCD.....",
      ".....DBBBFFFFBBBCCD.....",
      "......DBBBBBBBBCD.......",
      ".....DBBCCCCCBBCD.......",
      "....DBBCCDDDCCBBCCD.....",
      "...DBBCCDDDDDCCBBCCD....",
      "..DBBCCDDCCCDDCCBBCCD...",
      ".DBBCCDDC...CDDCCBBCCD..",
      "..DBCCDD.....DDCCBBD....",
      "...DCDD.......DDCCD.....",
      "....DD.........DD.......",
      "........................",
      "........................",
      "........................",
    ],
  },
};

export function EnemySprite({ kind, className, intro = false }: { kind: EnemyAssetKind; className?: string; intro?: boolean }) {
  const asset = ENEMY_SPRITES[kind];
  const style = {
    "--pixel-scale": intro ? 4 : 3,
  } as CSSProperties;

  if (asset.src) {
    return <img className={className} src={asset.src} alt={asset.alt} draggable={false} style={style} />;
  }

  const pixels: Array<ReactElement> = [];
  asset.rows.forEach((row, y) => {
    [...row].forEach((token, x) => {
      if (token === TRANSPARENT) return;
      const fill = asset.palette[token];
      if (!fill) return;
      pixels.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={fill} />);
    });
  });

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      role="img"
      aria-label={asset.alt}
      shapeRendering="crispEdges"
      preserveAspectRatio="xMidYMid meet"
      style={style}
    >
      {pixels}
    </svg>
  );
}
