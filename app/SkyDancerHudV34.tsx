"use client";

import { useEffect, useState } from "react";
import {
  SKY_DANCER_BOSS_QUALITY_EVENT_V34,
  type SkyDancerBossQualitySnapshotV34,
} from "../src/sky/SkyDancerBossCombatV34";

export default function SkyDancerHudV34() {
  const [boss, setBoss] = useState<SkyDancerBossQualitySnapshotV34 | null>(null);

  useEffect(() => {
    const onBoss = (event: Event) => {
      const detail = (event as CustomEvent<SkyDancerBossQualitySnapshotV34>).detail;
      setBoss(detail.active ? detail : null);
    };
    window.addEventListener(SKY_DANCER_BOSS_QUALITY_EVENT_V34, onBoss);
    return () => window.removeEventListener(SKY_DANCER_BOSS_QUALITY_EVENT_V34, onBoss);
  }, []);

  return <>
    <style>{`
      [aria-label="Missile warning"] {
        left: max(18px, env(safe-area-inset-left)) !important;
        right: auto !important;
        top: max(150px, calc(env(safe-area-inset-top) + 140px)) !important;
        transform: none !important;
        width: auto !important;
        max-width: min(34vw, 290px) !important;
        padding: 3px 7px !important;
        border-radius: 3px 8px 8px 3px !important;
        font-size: clamp(9px, 1.12vw, 11px) !important;
        line-height: 1.05 !important;
        letter-spacing: .065em !important;
        opacity: .78 !important;
        box-shadow: 0 0 8px rgba(255,72,60,.12) !important;
        white-space: nowrap !important;
      }
      .skyDancerBossV34 {
        position: fixed;
        left: 50%;
        top: max(54px, calc(env(safe-area-inset-top) + 44px));
        z-index: 111;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 3px 9px 4px;
        border: 1px solid rgba(255,126,143,.34);
        border-radius: 2px 9px 2px 9px;
        background: linear-gradient(90deg, rgba(30,13,25,.08), rgba(30,13,25,.54), rgba(30,13,25,.08));
        color: rgba(255,235,239,.9);
        font: 800 clamp(8px,1.05vw,11px)/1 system-ui,sans-serif;
        letter-spacing: .09em;
        text-shadow: 0 1px 6px rgba(0,0,0,.55);
        pointer-events: none;
      }
      .skyDancerBossV34 strong { color: #ff8595; font-size: 1.08em; }
      .skyDancerBossV34[data-core-open="true"] {
        border-color: rgba(126,246,255,.54);
        color: #dffcff;
        background: linear-gradient(90deg, rgba(5,42,53,.05), rgba(5,55,68,.58), rgba(5,42,53,.05));
      }
      .skyDancerBossV34[data-core-open="true"] strong { color: #8af7ff; }
      @media(max-height:390px) {
        [aria-label="Missile warning"] {
          left: max(12px, env(safe-area-inset-left)) !important;
          top: 142px !important;
          max-width: 32vw !important;
        }
        .skyDancerBossV34 { top: 50px; padding: 2px 7px 3px; }
      }
    `}</style>
    {boss && (
      <div className="skyDancerBossV34" data-core-open={boss.coreOpen ? "true" : "false"} aria-label="Boss phase status">
        <strong>BOSS P{boss.phase}</strong>
        <span>{boss.mode === "strike" ? "ATTACK RUN" : boss.mode === "break" ? "CORE OPEN" : "INTERCEPT"}</span>
        <span>{Math.max(0, Math.round(boss.hp))}/{Math.max(1, Math.round(boss.maxHp))}</span>
      </div>
    )}
  </>;
}
