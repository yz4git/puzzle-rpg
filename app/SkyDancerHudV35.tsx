"use client";

import legacyStyles from "./CartRogueGame.module.css";
import huntStyles from "./CartTurboHuntHudOverlay.module.css";
import shotStyles from "./SkyDancerShotControl.module.css";

/**
 * Reference-composition HUD pass.
 *
 * This intentionally restyles existing real telemetry instead of fabricating
 * score, radar or weapon inventory that the runtime does not yet own.
 */
export default function SkyDancerHudV35() {
  return <>
    <style>{`
      .${legacyStyles.topHud} {
        top: max(8px, env(safe-area-inset-top)) !important;
        grid-template-columns: minmax(112px,.72fr) minmax(300px,1.85fr) minmax(112px,.72fr) !important;
        gap: clamp(8px,1.2vw,16px) !important;
      }
      .${legacyStyles.runCard},
      .${legacyStyles.enemyCard},
      .${legacyStyles.meterCard} {
        background: linear-gradient(180deg, rgba(7,31,50,.20), rgba(5,26,43,.08)) !important;
        border-color: rgba(183,239,255,.14) !important;
        box-shadow: none !important;
        backdrop-filter: blur(2px) !important;
        -webkit-backdrop-filter: blur(2px) !important;
      }
      .${legacyStyles.objective} {
        padding: 7px 20px 8px !important;
        border-width: 0 0 1px !important;
        border-radius: 0 !important;
        background: linear-gradient(90deg, transparent, rgba(5,40,62,.54) 18%, rgba(5,40,62,.54) 82%, transparent) !important;
        border-color: rgba(186,241,255,.35) !important;
        box-shadow: none !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }
      .${legacyStyles.runCard},
      .${legacyStyles.enemyCard} {
        padding: 7px 10px 8px !important;
        min-height: 42px !important;
        border-radius: 2px !important;
      }
      .${legacyStyles.runCard} strong,
      .${legacyStyles.enemyCard} strong {
        font-size: clamp(15px,2vw,20px) !important;
        letter-spacing: .035em !important;
      }
      .${legacyStyles.bottomHud} {
        bottom: max(8px, env(safe-area-inset-bottom)) !important;
      }
      .${legacyStyles.meterCard} {
        padding: 6px 9px 7px !important;
        max-width: 190px !important;
        border-radius: 2px 10px 2px 10px !important;
      }
      .${legacyStyles.meterTrack} {
        height: 5px !important;
        margin-top: 4px !important;
        border-radius: 0 !important;
      }
      .${legacyStyles.chargeRow} {
        gap: 3px !important;
        margin-top: 4px !important;
      }
      .${legacyStyles.chargeRow} i {
        height: 5px !important;
        border-radius: 1px !important;
      }
      .${legacyStyles.actions} {
        right: max(12px, env(safe-area-inset-right)) !important;
        bottom: max(54px, calc(env(safe-area-inset-bottom) + 44px)) !important;
        gap: 7px !important;
      }
      .${legacyStyles.boostButton} {
        width: 66px !important;
        height: 66px !important;
        border-radius: 9px 17px 9px 17px !important;
        border-width: 1px !important;
        box-shadow: 0 3px 0 rgba(3,31,52,.58), 0 8px 18px rgba(0,78,125,.20), inset 0 1px 0 rgba(255,255,255,.30) !important;
      }
      .${legacyStyles.boostButton}:before {
        top: 2px !important;
        right: 6px !important;
        font-size: 13px !important;
      }
      .${legacyStyles.boostButton} strong { font-size: 13px !important; }
      .${legacyStyles.boostButton} small { margin-top: 3px !important; font-size: 7px !important; }
      .${shotStyles.shotWrap} {
        right: calc(max(12px, env(safe-area-inset-right)) + 73px) !important;
        bottom: max(54px, calc(env(safe-area-inset-bottom) + 44px)) !important;
      }
      .${shotStyles.shotButton} {
        width: 58px !important;
        height: 58px !important;
        border-radius: 8px 15px 8px 15px !important;
        box-shadow: 0 3px 0 rgba(3,25,44,.62), 0 8px 18px rgba(0,55,88,.20), inset 0 1px 0 rgba(255,255,255,.22) !important;
      }
      .${shotStyles.shotButton} strong { font-size: 11px !important; }
      .${shotStyles.shotButton} small { margin-top: 3px !important; font-size: 6px !important; }
      .${huntStyles.hud} {
        inset: max(47px, calc(env(safe-area-inset-top) + 36px)) max(10px, env(safe-area-inset-right)) auto max(10px, env(safe-area-inset-left)) !important;
        grid-template-columns: minmax(96px,.55fr) minmax(300px,1.9fr) minmax(96px,.55fr) !important;
        gap: 9px !important;
      }
      .${huntStyles.card},
      .${huntStyles.orderCard},
      .${huntStyles.heatCard} {
        background: linear-gradient(180deg, rgba(5,31,49,.36), rgba(4,21,36,.22)) !important;
        border-color: rgba(151,228,250,.16) !important;
        box-shadow: none !important;
        backdrop-filter: blur(3px) !important;
        -webkit-backdrop-filter: blur(3px) !important;
      }
      .${huntStyles.orderCard} {
        border-width: 0 0 1px !important;
        border-radius: 0 !important;
      }
      [aria-label="Missile warning"] {
        left: 50% !important;
        right: auto !important;
        top: auto !important;
        bottom: max(88px, calc(env(safe-area-inset-bottom) + 78px)) !important;
        transform: translateX(-50%) !important;
        max-width: min(56vw,360px) !important;
        padding: 4px 12px !important;
        border-radius: 2px 9px 2px 9px !important;
        font-size: clamp(9px,1.18vw,12px) !important;
        letter-spacing: .09em !important;
        opacity: .88 !important;
        white-space: nowrap !important;
      }
      .skyDancerBossV34 {
        top: max(58px, calc(env(safe-area-inset-top) + 49px)) !important;
        padding: 3px 10px 4px !important;
      }
      .skyDancerV35ReferenceFrame {
        position: fixed;
        inset: 0;
        z-index: 5;
        pointer-events: none;
        box-shadow: inset 0 0 62px rgba(3,18,32,.08);
      }
      .skyDancerV35ReferenceFrame::before,
      .skyDancerV35ReferenceFrame::after {
        content: "";
        position: absolute;
        top: 24%;
        bottom: 18%;
        width: 1px;
        opacity: .28;
        background: linear-gradient(180deg, transparent, rgba(184,239,255,.42) 20%, rgba(184,239,255,.12) 80%, transparent);
      }
      .skyDancerV35ReferenceFrame::before { left: max(18px, env(safe-area-inset-left)); }
      .skyDancerV35ReferenceFrame::after { right: max(18px, env(safe-area-inset-right)); }
      @media(max-height:420px) {
        .${legacyStyles.actions} { bottom: max(44px, calc(env(safe-area-inset-bottom) + 36px)) !important; }
        .${legacyStyles.boostButton} { width: 58px !important; height: 58px !important; }
        .${shotStyles.shotWrap} {
          right: calc(max(10px, env(safe-area-inset-right)) + 64px) !important;
          bottom: max(44px, calc(env(safe-area-inset-bottom) + 36px)) !important;
        }
        .${shotStyles.shotButton} { width: 51px !important; height: 51px !important; }
        [aria-label="Missile warning"] { bottom: max(68px, calc(env(safe-area-inset-bottom) + 58px)) !important; }
      }
    `}</style>
    <div className="skyDancerV35ReferenceFrame" aria-hidden="true" />
  </>;
}
