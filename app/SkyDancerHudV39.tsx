"use client";

import legacyStyles from "./CartRogueGame.module.css";
import huntStyles from "./CartTurboHuntHudOverlay.module.css";
import shotStyles from "./SkyDancerShotControl.module.css";

/**
 * V39 final HUD hierarchy pass.
 * Uses existing real telemetry only. The extra geometry is decorative targeting
 * framing and never represents fabricated score, radar or weapon data.
 */
export default function SkyDancerHudV39() {
  return <>
    <style>{`
      .${legacyStyles.topHud} {
        top: max(10px, env(safe-area-inset-top)) !important;
        grid-template-columns: minmax(106px,.68fr) minmax(286px,1.72fr) minmax(106px,.68fr) !important;
        gap: clamp(9px,1.35vw,18px) !important;
        opacity: .96 !important;
      }
      .${legacyStyles.runCard},
      .${legacyStyles.enemyCard},
      .${legacyStyles.meterCard},
      .${huntStyles.card},
      .${huntStyles.orderCard},
      .${huntStyles.heatCard} {
        background: linear-gradient(180deg, rgba(3,27,45,.22), rgba(5,33,51,.07)) !important;
        border-color: rgba(185,238,252,.16) !important;
        box-shadow: inset 0 1px 0 rgba(226,250,255,.05) !important;
        backdrop-filter: blur(2px) !important;
        -webkit-backdrop-filter: blur(2px) !important;
      }
      .${legacyStyles.objective},
      .${huntStyles.orderCard} {
        background: linear-gradient(90deg, transparent 2%, rgba(4,39,59,.38) 24%, rgba(4,39,59,.42) 76%, transparent 98%) !important;
        border-width: 0 0 1px !important;
        border-color: rgba(188,240,255,.28) !important;
        border-radius: 0 !important;
        box-shadow: none !important;
      }
      .${legacyStyles.objective} {
        padding: 5px 22px 6px !important;
        letter-spacing: .10em !important;
      }
      .${legacyStyles.runCard}, .${legacyStyles.enemyCard} {
        padding: 6px 9px 7px !important;
        border-radius: 2px 8px 2px 8px !important;
      }
      .${legacyStyles.runCard} strong,
      .${legacyStyles.enemyCard} strong {
        font-size: clamp(14px,1.8vw,19px) !important;
        letter-spacing: .05em !important;
      }
      .${legacyStyles.bottomHud} {
        bottom: max(10px, env(safe-area-inset-bottom)) !important;
      }
      .${legacyStyles.meterCard} {
        max-width: 178px !important;
        padding: 5px 8px 6px !important;
        border-radius: 2px 9px 2px 9px !important;
      }
      .${legacyStyles.meterTrack} { height: 4px !important; opacity: .88 !important; }
      .${legacyStyles.chargeRow} i { height: 4px !important; opacity: .84 !important; }
      .${legacyStyles.actions} {
        right: max(14px, env(safe-area-inset-right)) !important;
        bottom: max(56px, calc(env(safe-area-inset-bottom) + 46px)) !important;
        gap: 8px !important;
        opacity: .88 !important;
      }
      .${legacyStyles.boostButton} {
        width: 61px !important;
        height: 61px !important;
        border-width: 1px !important;
        border-radius: 6px 15px 6px 15px !important;
        background: linear-gradient(145deg, rgba(12,64,91,.64), rgba(3,31,52,.44)) !important;
        box-shadow: 0 3px 0 rgba(2,24,40,.46), inset 0 1px 0 rgba(218,248,255,.20) !important;
      }
      .${legacyStyles.boostButton} strong { font-size: 12px !important; letter-spacing: .07em !important; }
      .${legacyStyles.boostButton} small { font-size: 6px !important; opacity: .70 !important; }
      .${shotStyles.shotWrap} {
        right: calc(max(14px, env(safe-area-inset-right)) + 68px) !important;
        bottom: max(56px, calc(env(safe-area-inset-bottom) + 46px)) !important;
        opacity: .90 !important;
      }
      .${shotStyles.shotButton} {
        width: 54px !important;
        height: 54px !important;
        border-width: 1px !important;
        border-radius: 6px 13px 6px 13px !important;
        background: linear-gradient(145deg, rgba(11,58,84,.62), rgba(3,27,47,.44)) !important;
        box-shadow: 0 3px 0 rgba(2,22,38,.48), inset 0 1px 0 rgba(218,248,255,.18) !important;
      }
      .${shotStyles.shotButton} strong { font-size: 10px !important; letter-spacing: .07em !important; }
      .${shotStyles.shotButton} small { font-size: 6px !important; opacity: .68 !important; }
      .${huntStyles.hud} {
        inset: max(48px, calc(env(safe-area-inset-top) + 37px)) max(12px, env(safe-area-inset-right)) auto max(12px, env(safe-area-inset-left)) !important;
        grid-template-columns: minmax(90px,.50fr) minmax(290px,1.86fr) minmax(90px,.50fr) !important;
        gap: 10px !important;
      }
      [aria-label="Missile warning"] {
        bottom: max(82px, calc(env(safe-area-inset-bottom) + 72px)) !important;
        max-width: min(50vw,330px) !important;
        padding: 3px 11px !important;
        border-radius: 1px 7px 1px 7px !important;
        font-size: clamp(8px,1.05vw,11px) !important;
        letter-spacing: .12em !important;
        opacity: .82 !important;
      }
      .skyDancerBossV34 {
        top: max(56px, calc(env(safe-area-inset-top) + 47px)) !important;
        padding: 4px 12px 5px !important;
        background: linear-gradient(90deg, transparent, rgba(37,8,17,.46) 16%, rgba(37,8,17,.56) 84%, transparent) !important;
        border-color: rgba(255,111,126,.34) !important;
        box-shadow: 0 1px 0 rgba(255,174,182,.08) !important;
      }
      .skyDancerV39HudFrame {
        position: fixed;
        inset: 0;
        z-index: 6;
        pointer-events: none;
      }
      .skyDancerV39HudFrame::before {
        content: "";
        position: absolute;
        left: 50%;
        top: 42%;
        width: min(18vw,150px);
        height: min(10vw,84px);
        transform: translate(-50%,-50%);
        border: 1px solid rgba(182,237,252,.16);
        border-left-color: transparent;
        border-right-color: transparent;
        clip-path: polygon(0 0,22% 0,22% 7%,78% 7%,78% 0,100% 0,100% 100%,78% 100%,78% 93%,22% 93%,22% 100%,0 100%);
        opacity: .72;
      }
      .skyDancerV39HudFrame::after {
        content: "";
        position: absolute;
        left: 50%;
        top: 42%;
        width: 5px;
        height: 5px;
        transform: translate(-50%,-50%) rotate(45deg);
        border: 1px solid rgba(194,244,255,.42);
        box-shadow: 0 0 7px rgba(118,222,255,.16);
      }
      @media(max-height:420px) {
        .${legacyStyles.boostButton} { width: 55px !important; height: 55px !important; }
        .${shotStyles.shotWrap} { right: calc(max(12px, env(safe-area-inset-right)) + 61px) !important; }
        .${shotStyles.shotButton} { width: 49px !important; height: 49px !important; }
        [aria-label="Missile warning"] { bottom: max(66px, calc(env(safe-area-inset-bottom) + 56px)) !important; }
      }
    `}</style>
    <div className="skyDancerV39HudFrame" aria-hidden="true" />
  </>;
}
