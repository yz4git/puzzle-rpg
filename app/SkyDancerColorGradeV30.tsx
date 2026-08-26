"use client";

/**
 * Lightweight screen-space grade for the final V30 reference match.
 * It sits above the WebGL canvas but below all live controls/HUD, so input and
 * gameplay rendering remain untouched while the washed high-altitude cyan is
 * pulled toward the deeper saturated blue of the supplied reference.
 */
export default function SkyDancerColorGradeV30() {
  return <>
    <style>{`
      .skyDancerV30ColorGrade {
        position: fixed;
        inset: 0;
        z-index: 4;
        pointer-events: none;
        background: linear-gradient(
          180deg,
          rgba(5, 74, 220, .42) 0%,
          rgba(5, 82, 220, .34) 22%,
          rgba(8, 106, 220, .28) 38%,
          rgba(6, 104, 180, .10) 68%,
          rgba(0, 40, 70, 0) 88%
        );
        mix-blend-mode: multiply;
      }
      @media (prefers-reduced-transparency: reduce) {
        .skyDancerV30ColorGrade { opacity: .82; }
      }
    `}</style>
    <div className="skyDancerV30ColorGrade" aria-hidden="true" />
  </>;
}
