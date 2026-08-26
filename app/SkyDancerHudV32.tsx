"use client";

/** V32 visual hierarchy overrides for the inherited live HUD. */
export default function SkyDancerHudV32() {
  return <style>{`
    [data-sd-gas-card="true"] {
      width: min(158px, 23vw) !important;
      padding: 2px 4px 4px !important;
      background: linear-gradient(90deg, rgba(3,31,52,.20), rgba(3,31,52,0)) !important;
      box-shadow: inset 0 -1px 0 rgba(117,225,255,.34) !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }
    [data-sd-gas-card="true"] > div:first-child > strong { font-size: 13px !important; text-shadow: 0 1px 5px rgba(0,34,60,.42) !important; }
    [data-sd-gas-card="true"] > div:nth-child(2) { height: 4px !important; background: rgba(4,30,47,.30) !important; }

    /* The live Turbo meter originates in CartRogueGame. The data tag is added
       asynchronously by V30, so also target the CSS-module class fragment to
       make screenshot/first-frame placement deterministic. */
    [data-sd-turbo-card="true"], div[class*="turboCard"] {
      position: fixed !important;
      left: max(18px, env(safe-area-inset-left)) !important;
      right: auto !important;
      bottom: max(22px, calc(env(safe-area-inset-bottom) + 14px)) !important;
      transform: none !important;
      width: min(108px, 17vw) !important;
      max-width: 108px !important;
      min-width: 0 !important;
      padding: 2px 4px 3px !important;
      gap: 2px !important;
      border: 0 !important;
      border-left: 1px solid rgba(95,219,255,.42) !important;
      border-radius: 2px 7px 7px 2px !important;
      background: linear-gradient(90deg, rgba(3,31,52,.25), rgba(3,31,52,.04)) !important;
      box-shadow: none !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      z-index: 38 !important;
    }
    [data-sd-turbo-card="true"] *, div[class*="turboCard"] * { font-size: 8px !important; line-height: 1.02 !important; }
    [data-sd-turbo-card="true"] strong, div[class*="turboCard"] strong { font-size: 11px !important; }
    [data-sd-turbo-card="true"] div[class*="chargeRow"], div[class*="turboCard"] div[class*="chargeRow"] { gap: 2px !important; margin-top: 2px !important; }
    [data-sd-turbo-card="true"] div[class*="chargeRow"] i, div[class*="turboCard"] div[class*="chargeRow"] i { height: 4px !important; }
    [data-sd-turbo-card="true"] div[class*="rechargeTrack"], div[class*="turboCard"] div[class*="rechargeTrack"] { height: 2px !important; margin-top: 1px !important; }

    [aria-label="Turbo Hunt status"] {
      top: max(43px, calc(env(safe-area-inset-top) + 36px)) !important;
      width: min(54vw, 500px) !important;
      gap: 7px !important;
    }
    [data-sd-hunt-objective="true"] {
      padding: 2px 8px 4px !important;
      background: linear-gradient(90deg, transparent, rgba(5,38,61,.27) 22%, rgba(5,38,61,.27) 78%, transparent) !important;
      box-shadow: inset 0 -1px 0 rgba(139,232,255,.31) !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }
    [data-sd-hunt-heat="true"] {
      padding: 2px 6px 4px !important;
      background: rgba(5,35,55,.16) !important;
      box-shadow: inset 0 -1px 0 rgba(255,218,105,.24) !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }

    button[aria-label="Fire missile"] {
      width: 52px !important;
      height: 52px !important;
      border-radius: 8px 12px 8px 12px !important;
      background: linear-gradient(155deg, rgba(5,66,100,.75), rgba(3,25,43,.80)) !important;
      box-shadow: 0 3px 10px rgba(0,35,58,.22), inset 0 1px 0 rgba(255,255,255,.17) !important;
    }
    [data-sd-turbo-button="true"] {
      width: 62px !important;
      height: 62px !important;
      border-radius: 14px !important;
      background: linear-gradient(160deg, rgba(54,196,239,.86), rgba(8,106,175,.86)) !important;
      box-shadow: 0 4px 12px rgba(0,67,109,.20), inset 0 1px 0 rgba(255,255,255,.24) !important;
    }
    button[aria-label="Pause"] { opacity: .68 !important; transform: scale(.84) !important; transform-origin: top right !important; }

    @media(max-height:390px) {
      [data-sd-turbo-card="true"], div[class*="turboCard"] {
        left: max(12px, env(safe-area-inset-left)) !important;
        bottom: max(12px, calc(env(safe-area-inset-bottom) + 7px)) !important;
        width: min(96px, 16vw) !important;
        max-width: 96px !important;
      }
      button[aria-label="Fire missile"] { width: 48px !important; height: 48px !important; }
      [data-sd-turbo-button="true"] { width: 58px !important; height: 58px !important; }
    }
  `}</style>;
}
