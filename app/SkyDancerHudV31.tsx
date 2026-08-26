"use client";

import phase4Styles from "./CartRoguePhase4.module.css";
import phase8Styles from "./CartRoguePhase8.module.css";

/**
 * V31 boss HUD layout: keep the boss itself and lock-on area visually clear.
 * The world-space boss HP bar is removed by SkyDancerAirCombatFxV31; this slim
 * screen-space gauge becomes the single authoritative boss health display.
 */
export default function SkyDancerHudV31() {
  return <style>{`
    .${phase4Styles.bossMeter} {
      left: max(14px, calc(env(safe-area-inset-left) + 8px)) !important;
      right: auto !important;
      top: max(34px, calc(env(safe-area-inset-top) + 28px)) !important;
      width: min(31vw, 252px) !important;
      transform: none !important;
      padding: 3px 7px 4px !important;
      border: 1px solid rgba(180,239,255,.42) !important;
      border-radius: 5px !important;
      background: linear-gradient(180deg, rgba(7,34,54,.58), rgba(4,20,35,.50)) !important;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.07), 0 4px 14px rgba(1,14,26,.16) !important;
      backdrop-filter: blur(4px) saturate(1.05) !important;
      -webkit-backdrop-filter: blur(4px) saturate(1.05) !important;
      z-index: 32 !important;
    }
    .${phase4Styles.bossMeterHead} {
      gap: 8px !important;
      align-items: center !important;
      font-size: 7px !important;
      line-height: 1 !important;
      letter-spacing: .10em !important;
      color: rgba(236,250,255,.90) !important;
    }
    .${phase4Styles.bossMeterHead} span {
      font-weight: 1000 !important;
      color: #ffadb9 !important;
    }
    .${phase4Styles.bossMeterHead} strong {
      font-size: 7px !important;
      font-weight: 900 !important;
      opacity: .82 !important;
      white-space: nowrap !important;
    }
    .${phase4Styles.bossMeterTrack} {
      height: 3px !important;
      margin-top: 3px !important;
      border-radius: 1px !important;
      background: rgba(255,255,255,.15) !important;
    }
    .${phase4Styles.bossMeterTrack} i {
      border-radius: 1px !important;
      background: linear-gradient(90deg, #ff647a, #ff9a73) !important;
      box-shadow: 0 0 8px rgba(255,92,116,.28) !important;
    }
    .${phase8Styles.bossPhase} {
      left: max(14px, calc(env(safe-area-inset-left) + 8px)) !important;
      top: max(58px, calc(env(safe-area-inset-top) + 52px)) !important;
      transform: none !important;
      padding: 2px 6px !important;
      border-radius: 4px !important;
      border: 1px solid rgba(255,155,179,.22) !important;
      background: rgba(25,20,39,.34) !important;
      color: rgba(255,220,229,.80) !important;
      font-size: 6px !important;
      letter-spacing: .09em !important;
      z-index: 31 !important;
    }
    @media (max-height: 390px) {
      .${phase4Styles.bossMeter} {
        top: max(29px, calc(env(safe-area-inset-top) + 23px)) !important;
        width: min(29vw, 230px) !important;
      }
      .${phase8Styles.bossPhase} {
        top: max(50px, calc(env(safe-area-inset-top) + 44px)) !important;
      }
    }
  `}</style>;
}
