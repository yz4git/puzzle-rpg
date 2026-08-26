"use client";

import legacyStyles from "./CartRogueGame.module.css";
import phaseStyles from "./CartRoguePhase3.module.css";

/**
 * V44 reserves the centre of the screen for vertical target reading.
 * Legacy reward banners remain visible, but move into a compact left-side
 * feedback lane and decay visually behind the target/altitude information.
 */
export default function SkyDancerHudV44() {
  return <>
    <style>{`
      .${legacyStyles.combo} {
        left: max(16px, calc(env(safe-area-inset-left) + 10px)) !important;
        top: 23% !important;
        max-width: 30vw !important;
        transform: none !important;
        transform-origin: 0 50% !important;
        text-align: left !important;
        font-size: clamp(13px, 2vw, 20px) !important;
        opacity: .58 !important;
        letter-spacing: .02em !important;
      }
      .${legacyStyles.ramBanner} {
        left: max(16px, calc(env(safe-area-inset-left) + 10px)) !important;
        top: 31% !important;
        max-width: 31vw !important;
        transform: none !important;
        transform-origin: 0 50% !important;
        text-align: left !important;
        font-size: clamp(12px, 1.75vw, 18px) !important;
        opacity: .54 !important;
      }
      .${phaseStyles.wallRide} {
        left: max(16px, calc(env(safe-area-inset-left) + 10px)) !important;
        top: 38% !important;
        max-width: 29vw !important;
        transform: none !important;
        text-align: left !important;
        font-size: clamp(11px, 1.55vw, 16px) !important;
        opacity: .48 !important;
      }
      @media(max-height:390px) {
        .${legacyStyles.combo} { top: 22% !important; font-size: clamp(12px, 1.85vw, 18px) !important; }
        .${legacyStyles.ramBanner} { top: 29% !important; font-size: clamp(11px, 1.65vw, 16px) !important; }
        .${phaseStyles.wallRide} { top: 36% !important; font-size: clamp(10px, 1.45vw, 14px) !important; }
      }
      .skyDancerV44AltitudeLegend {
        position: fixed;
        z-index: 131;
        right: max(15px, calc(env(safe-area-inset-right) + 9px));
        top: max(43px, calc(env(safe-area-inset-top) + 34px));
        pointer-events: none;
        color: rgba(225,248,255,.58);
        font: 800 clamp(8px, .9vw, 10px)/1 system-ui, sans-serif;
        letter-spacing: .10em;
        text-shadow: 0 1px 5px rgba(0,24,42,.62);
      }
      .skyDancerV44AltitudeLegend b { color: rgba(245,253,255,.88); font-weight: 900; }
    `}</style>
    <div className="skyDancerV44AltitudeLegend" aria-label="Altitude cue legend">
      <b>▲</b> ABOVE&nbsp;&nbsp;<b>▼</b> BELOW
    </div>
  </>;
}
