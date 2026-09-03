"use client";

import PuzzleRPGApp from "./PuzzleRPGApp";
import skin from "./PuzzleRPGGraphicsV2.module.css";
import polish from "./PuzzleRPGLayoutPolish.module.css";
import review from "./PuzzleRPGLiveReview.module.css";

export default function PuzzleRPGGraphicsV2() {
  return (
    <div className={`${skin.root} ${polish.root} ${review.reviewScope}`} data-graphics-version="cluster-break-v1">
      <div className={skin.backdropGrid} aria-hidden="true" />
      <div className={skin.scanlines} aria-hidden="true" />
      <PuzzleRPGApp />
    </div>
  );
}
