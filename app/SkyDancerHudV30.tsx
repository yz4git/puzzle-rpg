"use client";

import { useEffect } from "react";

function textOf(element: Element): string {
  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Final HUD consolidation for the Sky Dancer presentation pass.
 *
 * The playable HUD still comes from the inherited Cart runtime, so this layer
 * deliberately tags the existing live controls instead of duplicating input or
 * gameplay state. The result keeps the real touch buttons authoritative while
 * presenting the status hierarchy closer to the supplied flight-combat reference.
 */
export default function SkyDancerHudV30() {
  useEffect(() => {
    let animationFrame = 0;

    const tagLiveHud = () => {
      animationFrame = 0;

      for (const button of document.querySelectorAll<HTMLButtonElement>("button")) {
        const strong = button.querySelector("strong");
        if (strong?.textContent?.trim().toUpperCase() === "TURBO") button.dataset.sdTurboButton = "true";
      }

      for (const element of document.querySelectorAll<HTMLElement>("div")) {
        const text = textOf(element);
        if (/^(?:RAM|BOOST)\s*P\d+\s*SCR\d+$/i.test(text)) {
          element.dataset.sdItemStrip = "true";
          continue;
        }

        // Only tag the outer meter card. Its first child is the meter-head DIV;
        // the nested head itself also contains the same text and must not become
        // a second fixed-position HUD card.
        const firstChild = element.firstElementChild;
        if (!(firstChild instanceof HTMLDivElement) || !firstChild.querySelector("strong")) continue;
        if (/^GAS\s*\d+%$/i.test(text)) {
          element.dataset.sdGasCard = "true";
          continue;
        }
        if (/^TURBO\s*×\d+\s*RECHARGE\b/i.test(text)) {
          element.dataset.sdTurboCard = "true";
        }
      }

      const hunt = document.querySelector<HTMLElement>('[aria-label="Turbo Hunt status"]');
      if (hunt) {
        for (const child of Array.from(hunt.children)) {
          if (!(child instanceof HTMLElement)) continue;
          const text = textOf(child);
          if (/TURBO HUNT/i.test(text) && !/CONTRACT/i.test(text)) child.dataset.sdHuntMode = "true";
          else if (/CONTRACT/i.test(text)) child.dataset.sdHuntObjective = "true";
          else if (/HEAT/i.test(text)) child.dataset.sdHuntHeat = "true";
        }
      }
    };

    const schedule = () => {
      if (animationFrame !== 0) return;
      animationFrame = window.requestAnimationFrame(tagLiveHud);
    };

    tagLiveHud();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      if (animationFrame !== 0) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return <style>{`
    /* Reference hierarchy: brand + HP left, objective center, heat right. */
    [data-sd-gas-card="true"] {
      position: fixed !important;
      left: max(18px, calc(env(safe-area-inset-left) + 10px)) !important;
      top: max(50px, calc(env(safe-area-inset-top) + 43px)) !important;
      width: min(156px, 24vw) !important;
      max-width: 156px !important;
      padding: 4px 7px 6px !important;
      border: 0 !important;
      border-radius: 2px 10px 10px 2px !important;
      background: linear-gradient(90deg, rgba(5,31,51,.72), rgba(7,43,66,.28)) !important;
      box-shadow: inset 3px 0 0 rgba(91,225,255,.78), 0 4px 14px rgba(1,22,38,.12) !important;
      backdrop-filter: blur(4px) !important;
      -webkit-backdrop-filter: blur(4px) !important;
      z-index: 83 !important;
    }
    [data-sd-gas-card="true"] > div:first-child > span:first-child {
      font-size: 0 !important;
      color: rgba(224,249,255,.86) !important;
    }
    [data-sd-gas-card="true"] > div:first-child > span:first-child::after {
      content: "HP";
      font-size: 8px;
      letter-spacing: .16em;
      font-weight: 900;
    }
    [data-sd-gas-card="true"] > div:first-child > strong {
      font-size: 14px !important;
      font-weight: 900 !important;
    }
    [data-sd-gas-card="true"] > div:nth-child(2) {
      height: 5px !important;
      margin-top: 3px !important;
      border-radius: 0 !important;
      background: rgba(8,25,37,.48) !important;
    }
    [data-sd-gas-card="true"] > div:nth-child(2) > i {
      background: linear-gradient(90deg, #56dca8, #90ec79) !important;
      box-shadow: 0 0 9px rgba(82,228,167,.34) !important;
    }

    [data-sd-item-strip="true"] { display: none !important; }

    [data-sd-turbo-card="true"] {
      position: fixed !important;
      left: max(18px, calc(env(safe-area-inset-left) + 10px)) !important;
      bottom: max(15px, calc(env(safe-area-inset-bottom) + 9px)) !important;
      width: min(144px, 23vw) !important;
      max-width: 144px !important;
      padding: 5px 7px 6px !important;
      border: 0 !important;
      border-left: 2px solid rgba(79,218,255,.74) !important;
      border-radius: 2px 9px 9px 2px !important;
      background: linear-gradient(90deg, rgba(4,31,51,.76), rgba(6,39,61,.26)) !important;
      box-shadow: 0 4px 14px rgba(1,22,38,.10) !important;
      backdrop-filter: blur(4px) !important;
      -webkit-backdrop-filter: blur(4px) !important;
      z-index: 83 !important;
    }
    [data-sd-turbo-card="true"] > div:first-child strong { font-size: 11px !important; }
    [data-sd-turbo-card="true"] > div:first-child span { font-size: 8px !important; }
    [data-sd-turbo-card="true"] > div:nth-child(2) { gap: 2px !important; margin-top: 3px !important; }
    [data-sd-turbo-card="true"] > div:nth-child(2) i { height: 5px !important; border-radius: 1px !important; }
    [data-sd-turbo-card="true"] > div:nth-child(3) { margin-top: 3px !important; font-size: 6px !important; }
    [data-sd-turbo-card="true"] > div:nth-child(4) { height: 3px !important; margin-top: 2px !important; }

    [aria-label="Turbo Hunt status"] {
      inset: max(47px, calc(env(safe-area-inset-top) + 40px)) auto auto 50% !important;
      width: min(58vw, 520px) !important;
      transform: translateX(-50%) !important;
      grid-template-columns: minmax(240px, 1fr) minmax(88px, 112px) !important;
      gap: 7px !important;
      align-items: start !important;
      filter: none !important;
    }
    [data-sd-hunt-mode="true"] { display: none !important; }
    [data-sd-hunt-objective="true"] {
      grid-column: 1 !important;
      min-height: 0 !important;
      padding: 5px 10px 6px !important;
      border: 0 !important;
      border-radius: 3px !important;
      background: linear-gradient(90deg, rgba(7,37,58,.18), rgba(6,35,55,.62) 20%, rgba(6,35,55,.62) 80%, rgba(7,37,58,.18)) !important;
      box-shadow: inset 0 -1px 0 rgba(137,231,255,.26) !important;
      backdrop-filter: blur(3px) !important;
      -webkit-backdrop-filter: blur(3px) !important;
      text-align: center !important;
    }
    [data-sd-hunt-objective="true"] > div:first-child {
      justify-content: center !important;
      gap: 10px !important;
      color: rgba(126,232,255,.88) !important;
    }
    [data-sd-hunt-objective="true"] > div:nth-child(2) {
      font-size: clamp(9px, 1.2vw, 12px) !important;
      letter-spacing: .08em !important;
      color: #f3fdff !important;
    }
    [data-sd-hunt-heat="true"] {
      grid-column: 2 !important;
      min-height: 0 !important;
      padding: 5px 8px 6px !important;
      border: 0 !important;
      border-radius: 3px !important;
      background: linear-gradient(180deg, rgba(6,35,55,.54), rgba(6,28,45,.25)) !important;
      box-shadow: inset 0 -1px 0 rgba(255,211,99,.28) !important;
      backdrop-filter: blur(3px) !important;
      -webkit-backdrop-filter: blur(3px) !important;
    }

    /* Preserve touch ergonomics but reduce the inherited arcade-button mass. */
    button[aria-label="Fire missile"] {
      width: 58px !important;
      height: 58px !important;
      border-radius: 9px 14px 9px 14px !important;
      border-width: 1px !important;
      background: linear-gradient(155deg, rgba(8,64,96,.94), rgba(4,29,48,.96)) !important;
      box-shadow: 0 3px 0 rgba(2,22,36,.62), 0 7px 18px rgba(0,46,76,.20), inset 0 1px 0 rgba(255,255,255,.22) !important;
    }
    [data-sd-turbo-button="true"] {
      width: 72px !important;
      height: 72px !important;
      border-radius: 17px !important;
      border-width: 1px !important;
      box-shadow: 0 3px 0 rgba(4,42,69,.52), 0 8px 20px rgba(0,80,135,.20), inset 0 1px 0 rgba(255,255,255,.30) !important;
    }
    [data-sd-turbo-button="true"] strong { font-size: 14px !important; }
    [data-sd-turbo-button="true"] small {
      margin-top: 4px !important;
      font-size: 0 !important;
      line-height: 1 !important;
    }
    [data-sd-turbo-button="true"] small::after {
      content: "HOLD · RELEASE";
      font-size: 6px;
      letter-spacing: .075em;
    }

    @media(max-height:360px) {
      [data-sd-gas-card="true"] { top: max(42px, calc(env(safe-area-inset-top) + 35px)) !important; width: 136px !important; }
      [aria-label="Turbo Hunt status"] { inset: max(40px, calc(env(safe-area-inset-top) + 34px)) auto auto 50% !important; width: min(56vw, 470px) !important; }
      [data-sd-turbo-card="true"] { width: 132px !important; }
      button[aria-label="Fire missile"] { width: 54px !important; height: 54px !important; }
      [data-sd-turbo-button="true"] { width: 66px !important; height: 66px !important; }
    }
  `}</style>;
}
