"use client";

import PuzzleRPGSameGame from "./PuzzleRPGSameGame";
import skin from "./PuzzleRPGGraphicsV2.module.css";

export default function PuzzleRPGGraphicsV2() {
  return (
    <div className={skin.root} data-graphics-version="samegame-v1">
      <div className={skin.backdropGrid} aria-hidden="true" />
      <div className={skin.scanlines} aria-hidden="true" />
      <PuzzleRPGSameGame />
    </div>
  );
}
