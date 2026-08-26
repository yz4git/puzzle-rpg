"use client";

/**
 * V31 keeps the saturated arcade sky without multiplying the entire landscape
 * blue. V30's full-screen multiply grade made the opaque green valley read as a
 * flat cyan plane; this replacement fades out before the lower half so fields,
 * forests, roads and water retain their authored material colours.
 */
export default function SkyDancerColorGradeV31() {
  return <>
    <style>{`
      .skyDancerV31ColorGrade {
        position: fixed;
        inset: 0;
        z-index: 4;
        pointer-events: none;
        background: linear-gradient(
          180deg,
          rgba(3, 62, 198, .38) 0%,
          rgba(4, 76, 205, .27) 24%,
          rgba(5, 93, 190, .15) 40%,
          rgba(7, 105, 160, .055) 52%,
          rgba(0, 0, 0, 0) 61%,
          rgba(0, 0, 0, 0) 100%
        );
        mix-blend-mode: multiply;
      }
      @media (prefers-reduced-transparency: reduce) {
        .skyDancerV31ColorGrade { opacity: .82; }
      }
    `}</style>
    <div className="skyDancerV31ColorGrade" aria-hidden="true" />
  </>;
}
