"use client";

import PuzzleRPGEnhanced from "./PuzzleRPGEnhanced";
import skin from "./PuzzleRPGGraphicsV2.module.css";
import enemyStage from "./EnemyStageV2.module.css";
import orbArt from "./OrbArtV2.module.css";
import battleFx from "./BattleFXV2.module.css";
import stageBackground from "./StageBackgroundV2.module.css";

export default function PuzzleRPGGraphicsV2() {
  return (
    <div
      className={`${skin.root} ${enemyStage.root} ${orbArt.root} ${battleFx.root} ${stageBackground.root}`}
      data-graphics-version="2"
    >
      <div className={skin.backdropGrid} aria-hidden="true" />
      <div className={skin.scanlines} aria-hidden="true" />
      <PuzzleRPGEnhanced />
    </div>
  );
}
