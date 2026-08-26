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

/*
 * Built-in sprites deliberately use an original 8-bit JRPG vocabulary rather than
 * reproducing any existing monster. Rows may have different lengths: the renderer
 * centers each row in the sprite viewBox. That keeps hand-authored replacement art easy.
 */
export const ENEMY_SPRITES: Record<EnemyAssetKind, PixelSprite> = {
  warden: {
    alt: "Void Warden",
    palette: {
      K: "#090914", A: "#1b1730", B: "#34245c", C: "#6947a0",
      D: "#a982df", E: "#e3d7ff", F: "#67a8ff",
    },
    rows: [
      "..............KK..............",
      ".............KEEK.............",
      "............KEFFEK............",
      "...........KCEECK.............",
      "......KK..KCCCCCCK..KK........",
      ".....KBBKKCCDDDCCCKKBBK.......",
      "....KBBCCCCDDDDDDCCCCBBK......",
      "...KBBCCCDDDCCCCDDDCCCBBK.....",
      "..KBBCCDDCCCKKKCCCDDCCBBK.....",
      ".KBBCCDDCCKAAAKKCCDDCCBBK.....",
      "KBBCCDDCCKAEAEAKCCDDCCBBK.....",
      ".KBBCCDDCCKAAAAKCCDDCCBBK.....",
      "..KBBCCDDCCKFFKCCDDCCBBK......",
      "...KBBCCCDDFFFFDDCCCBBK........",
      "....KBBCCCDDDDDDCCCBBK.........",
      ".....KBBCCCDDDDCCCBBK..........",
      "......KBBCCDDDDCCBBK...........",
      ".....KBBCCDDDDDDCCBBK..........",
      "....KBBCCDDCCCCDDCCBBK.........",
      "...KBBCCDDCCBBCCDDCCBBK........",
      "..KBBCCDDCCBBBBCCDDCCBBK.......",
      ".KBBCCDDCCBBBBBBCCDDCCBBK......",
      "KBBCCDDCCBBBKKBBBCCDDCCBBK.....",
      "KBBCCDDCBBBKKKKBBBCCDDCCBK.....",
      ".KBBCCDCBBBK..KBBBCCDDCBK......",
      "..KBBCCCBBK....KBBCCCBK........",
      "...KBBCCBK......KBCCBBK........",
      "....KBBBK........KBBBK.........",
      ".....KKK..........KKK..........",
      "......K............K...........",
      "................................",
      "................................",
    ],
  },
  bastion: {
    alt: "Iron Bastion",
    palette: {
      K: "#0d0c0a", A: "#2a2519", B: "#514126", C: "#85672e",
      D: "#c79a42", E: "#f1cf78", F: "#fff3b6",
    },
    rows: [
      "...........KKKKKKKK...........",
      ".........KKEEEEEEEEKK.........",
      ".......KKEDDDDDDDDEKK.........",
      "......KEDDDCCCCCCDDDEK........",
      ".....KEDCCBBBBBBBBCCDEK.......",
      "....KEDCBBKKKKKKKKBB CDEK".replace(" ", ""),
      "...KEDCBBKDDDDDDDDKBB CDEK".replace(" ", ""),
      "..KEDCBBKDEEEEEEEEDKBB CDEK".replace(" ", ""),
      ".KEDCBBKDEFFKKKFFEDKBB CDEK".replace(" ", ""),
      ".KEDCBBKDEFFKKKFFEDKBB CDEK".replace(" ", ""),
      ".KEDCBBKDEEEEEEEEDKBB CDEK".replace(" ", ""),
      "..KEDCBBKDDCCCCDDKBB CDEK".replace(" ", ""),
      "...KEDCBBKKDDDDKKBB CDEK".replace(" ", ""),
      "....KEDCCBBBBBBBBCCDEK.......",
      ".....KEDCCCCCCCCCCDEK........",
      "....KKEDCCCCCCCCCCDEKK.......",
      "...KEEEDCCBBBBBBCCDEEEK......",
      "..KEEEDCCBBBBBBBBCCDEEEK.....",
      ".KEEDCCBBBKBBBBKBBBCCDEEK....",
      "KEEDCCBBBKBBBBBBKBBBCCDEEK...",
      "KEDCCBBBKKBBBBBBKKBBBCCDEK...",
      "KEDCCBBK..KBBBBK..KBBCCDEK...",
      ".KEDCCBK...KBBBBK...KBCCDEK..",
      "..KEDCK....KBBBBK....KCDEK...",
      "...KEEK....KBBBBK....KEEK....",
      "....KK.....KBBBBK.....KK.....",
      "...........KBBBBK............",
      "..........KKBBBBKK...........",
      ".........KCCK..KCCK..........",
      "........KCCK....KCCK.........",
      ".........KK......KK..........",
      "................................",
    ],
  },
  oracle: {
    alt: "Blood Oracle",
    palette: {
      K: "#10060b", A: "#2c0b18", B: "#54102a", C: "#8c1e3d",
      D: "#cf3e62", E: "#ff91aa", F: "#ffe3b0",
    },
    rows: [
      ".........................KK.....",
      "........................KFFK....",
      ".......................KFFFK...",
      "...........KKKK.......KDFDK....",
      ".........KKDDDDKK....KDDDK.....",
      "........KDDCCCCDDK..KDDDK......",
      ".......KDCBBBBBBCDK.KDDDK.......",
      "......KDCBBAAAABBCDKDDDK........",
      ".....KDCBBAKKKAABBCDDDK.........",
      "....KDCBBAKFFKAABBCDDK..........",
      "....KDCBBAKAAKAABBCDK...........",
      ".....KDCBBAAAAABBCDK............",
      "......KDCBBBBBBBCDK.............",
      ".......KDDCCCCDDK...............",
      "........KKDDDDKK................",
      ".........KDDDDK.................",
      "........KDDCCDDK................",
      ".......KDDCBB CDDK".replace(" ", ""),
      "......KDDCBBBB CDDK".replace(" ", ""),
      ".....KDDCBBBBBB CDDK".replace(" ", ""),
      "....KDDCBBCCCCBB CDDK".replace(" ", ""),
      "...KDDCBBCCDDCCBB CDDK".replace(" ", ""),
      "..KDDCBBCCD..DCCBB CDDK".replace(" ", ""),
      ".KDDCBBCCD....DCCBB CDDK".replace(" ", ""),
      "KDDCBBBCCD....DCCBBB CDDK".replace(" ", ""),
      ".KDDCCCCDK....KDCCCCDDK.....",
      "..KDDDDDK......KDDDDDK.......",
      "...KDDDK........KDDDK........",
      "....KKK..........KKK.........",
      "...................K..........",
      "................................",
      "................................",
    ],
  },
  null: {
    alt: "Null Knight",
    palette: {
      K: "#080c12", A: "#141d2b", B: "#27374e", C: "#4f6685",
      D: "#849ab8", E: "#d5e2f3", F: "#70b8ff",
    },
    rows: [
      "......................KK.......",
      ".....................KEEK......",
      ".............KK......KEEK......",
      "............KEEK.....KEEK......",
      "...........KEDDEK....KEEK......",
      "..........KEDDDDEK...KEEK......",
      ".........KEDCCCCDEK..KEEK......",
      "........KEDCBBB CDEK.KEEK".replace(" ", ""),
      ".......KEDCBBAAB CDEKKEEK".replace(" ", ""),
      ".......KEDCBAFAB CDEKKEEK".replace(" ", ""),
      ".......KEDCBBAAB CDEKKEEK".replace(" ", ""),
      ".......KEDCBBBBB CDEKKEEK".replace(" ", ""),
      "........KEDCCCCDEK.KEEK.......",
      ".........KEDDDDEK..KEEK.......",
      "..........KEDDEK...KEEK.......",
      ".........KEDCCCCDEKKEEK........",
      "........KEDCCBBCCDEKEEK........",
      ".......KEDCCBBBBCCDEEK.........",
      "......KEDCCBBBBBBCCDEK.........",
      ".....KEDCCBBBCCBBBCCDEK........",
      "....KEDCCBBBCEECBBBCCDEK.......",
      "...KEDCCBBBCE..ECBBBCCDEK......",
      "..KEDCCBBBCE....ECBBBCCDEK.....",
      ".KEDCCBBBCE......ECBBBCCDEK....",
      "..KEDCCCCE........ECCCCDEK.....",
      "...KEDDDDE........EDDDDEK......",
      "....KEEEEK........KEEEEK.......",
      ".....KKKK..........KKKK........",
      "......KK............KK.........",
      "................................",
      "................................",
      "................................",
    ],
  },
  trickster: {
    alt: "Prism Trickster",
    palette: {
      K: "#0b0915", A: "#241942", B: "#6840ae", C: "#38b9d7",
      D: "#ec4e98", E: "#ffd45b", F: "#effcff",
    },
    rows: [
      "....EE..........................",
      "...EDE....................CC....",
      "..EDBDE..................CDCC...",
      "...DBBDE......KK........CBBCC...",
      "....DBBDE....KFFK......CBBBC....",
      ".....DBBDK..KFFFFK....CBBBC.....",
      "......DBBK.KFBBBBFK..CBBBC......",
      ".......DBKKFBAAABFK.CBBC........",
      "......KDBBFBAEAFBBKCBCCD........",
      ".....KDBBBFAAAFBBBCCBCCD........",
      "....KDBBBBBFABBBBBCCBCCD........",
      ".....KDBBBBBFFFFBBBCCBCD........",
      "......KDBBBBBBBBBBBCCCD.........",
      ".......KDBBBCCCCBBBCCD..........",
      "......KDBBBCCDDCCBBBCCD.........",
      ".....KDBBBCCDDDDCCBBBCCD........",
      "....KDBBBCCDDCCDDCCBBBCCD.......",
      "...KDBBBCCDDC..CDDCCBBBCCD......",
      "..KDBBBCCDDC....CDDCCBBBCCD.....",
      ".KDBBBCCDDC......CDDCCBBBCCD....",
      "KDBBBCCDDC..EE..CDDCCBBBCCD....",
      ".KDBBCCDDC..EDEE..CDDCCBBBCD....",
      "..KDBCCDDC.EBBBBE.CDDCCBBD.....",
      "...KDBCDDC.EBAABE.CDDCBBD.......",
      "....KDBCDC..EAAE..CDCBBD........",
      ".....KDBCC...EE...CCBBD.........",
      "......KDBBCK....KCBBD...........",
      ".......KDBBK....KBBD............",
      "........KDDK....KDDK............",
      ".........KK......KK.............",
      "................................",
      "................................",
    ],
  },
};

export function EnemySprite({ kind, className, intro = false }: { kind: EnemyAssetKind; className?: string; intro?: boolean }) {
  const asset = ENEMY_SPRITES[kind];
  const width = Math.max(...asset.rows.map((row) => row.length));
  const height = asset.rows.length;
  const style = { "--pixel-scale": intro ? 4 : 3 } as CSSProperties;

  if (asset.src) {
    return <img className={className} src={asset.src} alt={asset.alt} draggable={false} style={style} />;
  }

  const pixels: Array<ReactElement> = [];
  asset.rows.forEach((row, y) => {
    const xOffset = Math.floor((width - row.length) / 2);
    [...row].forEach((token, x) => {
      if (token === TRANSPARENT) return;
      const fill = asset.palette[token];
      if (!fill) return;
      pixels.push(<rect key={`${x}-${y}`} x={x + xOffset} y={y} width="1" height="1" fill={fill} />);
    });
  });

  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${height}`}
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
