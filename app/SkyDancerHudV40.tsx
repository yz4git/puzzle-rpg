"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SKY_DANCER_BOSS_QUALITY_EVENT_V34,
  type SkyDancerBossQualitySnapshotV34,
} from "../src/sky/SkyDancerBossCombatV34";
import {
  SKY_DANCER_STAGE_CYCLE_EVENT,
  getLatestSkyDancerStageCycleSnapshot,
  type SkyDancerStageCycleSnapshot,
} from "../src/sky/SkyDancerStageCycle";
import phase4Styles from "./CartRoguePhase4.module.css";
import phase8Styles from "./CartRoguePhase8.module.css";
import huntStyles from "./CartTurboHuntHudOverlay.module.css";

export default function SkyDancerHudV40() {
  const [stage, setStage] = useState<SkyDancerStageCycleSnapshot | null>(() => getLatestSkyDancerStageCycleSnapshot());
  const [boss, setBoss] = useState<SkyDancerBossQualitySnapshotV34 | null>(null);

  useEffect(() => {
    const onStage = (event: Event) => {
      const detail = (event as CustomEvent<SkyDancerStageCycleSnapshot>).detail;
      if (detail) setStage(detail);
    };
    const onBoss = (event: Event) => {
      const detail = (event as CustomEvent<SkyDancerBossQualitySnapshotV34>).detail;
      setBoss(detail?.active ? detail : null);
    };
    window.addEventListener(SKY_DANCER_STAGE_CYCLE_EVENT, onStage);
    window.addEventListener(SKY_DANCER_BOSS_QUALITY_EVENT_V34, onBoss);
    return () => {
      window.removeEventListener(SKY_DANCER_STAGE_CYCLE_EVENT, onStage);
      window.removeEventListener(SKY_DANCER_BOSS_QUALITY_EVENT_V34, onBoss);
    };
  }, []);

  const bossActive = stage?.phase === "boss" || Boolean(boss?.active);
  useEffect(() => {
    document.body.classList.add("skyDancerV40StageHudActive");
    document.body.classList.toggle("skyDancerV40BossActive", bossActive);
    return () => {
      document.body.classList.remove("skyDancerV40StageHudActive", "skyDancerV40BossActive");
    };
  }, [bossActive]);

  const content = useMemo(() => {
    if (bossActive) {
      const maxHp = Math.max(1, boss?.maxHp ?? stage?.bossMaxHp ?? 1);
      const hp = Math.max(0, boss?.hp ?? stage?.bossHp ?? maxHp);
      const mode = boss?.mode === "break" ? "CORE OPEN" : boss?.mode === "strike" ? "ATTACK RUN" : "INTERCEPT";
      return {
        title: `STAGE ${stage?.stage ?? 1}`,
        phase: "BOSS",
        detail: `P${boss?.phase ?? 1} · ${mode} · ${Math.round(hp)} / ${Math.round(maxHp)}`,
        progress: Math.max(0, Math.min(1, hp / maxHp)),
      };
    }
    if (!stage) return { title: "STAGE 1", phase: "WAVE", detail: "ENGAGE", progress: 0 };
    if (stage.phase === "cleanup") {
      return {
        title: `STAGE ${stage.stage}`,
        phase: "CLEANUP",
        detail: `${stage.remainingEnemies} LEFT`,
        progress: 0,
      };
    }
    if (stage.phase === "stage-clear") {
      return {
        title: `STAGE ${stage.stage}`,
        phase: "CLEAR",
        detail: "AIRSPACE SECURED",
        progress: 1,
      };
    }
    return {
      title: `STAGE ${stage.stage}`,
      phase: "WAVE",
      detail: `${Math.min(stage.stageKills, stage.reinforcementTarget)} / ${stage.reinforcementTarget}`,
      progress: Math.min(1, stage.stageKills / Math.max(1, stage.reinforcementTarget)),
    };
  }, [stage, boss, bossActive]);

  return <>
    <style>{`
      .skyDancerV40StageHudActive .${huntStyles.orderCard} {
        visibility: hidden !important;
      }
      .skyDancerV40BossActive .skyDancerBossV34,
      .skyDancerV40BossActive .${huntStyles.boss},
      .skyDancerV40BossActive .${phase4Styles.bossMeter},
      .skyDancerV40BossActive .${phase8Styles.bossPhase} {
        display: none !important;
      }

      .skyDancerGunsight {
        width: 40px !important;
        height: 40px !important;
        border-color: rgba(177,243,255,.22) !important;
        opacity: .54 !important;
      }
      .skyDancerGunsight::before { width: 54px !important; }
      .skyDancerGunsight::after { height: 22px !important; }
      .skyDancerGunsight i { width: 6px !important; height: 6px !important; }
      .skyDancerGunsight b { bottom: -6px !important; transform: translateX(-50%) scale(.72) !important; }
      .skyDancerShotPulse .skyDancerGunsight {
        transform: translate(-50%,-50%) scale(.90) !important;
      }
      @media(max-height:360px) {
        .skyDancerGunsight { width: 36px !important; height: 36px !important; }
        .skyDancerGunsight::before { width: 48px !important; }
        .skyDancerGunsight::after { height: 19px !important; }
      }

      .skyDancerStageV40 {
        position: fixed;
        z-index: 132;
        left: 50%;
        top: max(49px, calc(env(safe-area-inset-top) + 39px));
        width: min(40vw, 410px);
        min-width: 270px;
        transform: translateX(-50%);
        pointer-events: none;
        color: rgba(235,251,255,.94);
        font-family: system-ui, sans-serif;
        text-shadow: 0 1px 6px rgba(0,19,34,.58);
      }
      .skyDancerStageV40Main {
        position: relative;
        display: grid;
        grid-template-columns: auto auto 1fr;
        align-items: center;
        gap: 8px;
        min-height: 25px;
        padding: 4px 13px 5px;
        border: 1px solid rgba(170,235,252,.24);
        border-width: 0 0 1px;
        background: linear-gradient(90deg, transparent, rgba(3,35,55,.62) 13%, rgba(3,35,55,.68) 87%, transparent);
      }
      .skyDancerStageV40 strong {
        color: #eefcff;
        font-size: clamp(9px,1.05vw,12px);
        letter-spacing: .13em;
        white-space: nowrap;
      }
      .skyDancerStageV40Phase {
        color: #71e4ff;
        font-size: clamp(8px,.98vw,11px);
        font-weight: 900;
        letter-spacing: .13em;
        white-space: nowrap;
      }
      .skyDancerStageV40Detail {
        justify-self: end;
        color: rgba(221,247,254,.90);
        font-size: clamp(8px,.94vw,11px);
        font-weight: 800;
        letter-spacing: .075em;
        white-space: nowrap;
      }
      .skyDancerStageV40Track {
        height: 2px;
        margin: 0 16%;
        background: rgba(167,228,244,.10);
        overflow: hidden;
      }
      .skyDancerStageV40Track i {
        display: block;
        height: 100%;
        background: linear-gradient(90deg,#58d8f3,#c3f7ff);
        box-shadow: 0 0 7px rgba(89,221,249,.30);
        transition: width .16s linear;
      }
      .skyDancerStageV40[data-phase="BOSS"] .skyDancerStageV40Main {
        border-color: rgba(255,102,126,.42);
        background: linear-gradient(90deg, transparent, rgba(49,7,20,.66) 11%, rgba(49,7,20,.72) 89%, transparent);
      }
      .skyDancerStageV40[data-phase="BOSS"] .skyDancerStageV40Phase { color: #ff758e; }
      .skyDancerStageV40[data-phase="BOSS"] .skyDancerStageV40Track i {
        background: linear-gradient(90deg,#ff566f,#ffbdc6);
        box-shadow: 0 0 8px rgba(255,80,105,.28);
      }
      .skyDancerStageV40[data-phase="CLEANUP"] .skyDancerStageV40Phase { color: #ffd56b; }
      .skyDancerStageV40[data-phase="CLEAR"] .skyDancerStageV40Phase { color: #8dffcf; }
      @media(max-height:390px) {
        .skyDancerStageV40 {
          top: max(44px, calc(env(safe-area-inset-top) + 35px));
          width: min(43vw,380px);
          min-width: 250px;
        }
        .skyDancerStageV40Main { min-height: 22px; padding: 3px 10px 4px; gap: 6px; }
      }
    `}</style>
    <div className="skyDancerStageV40" data-phase={content.phase} aria-label="Sky Dancer stage status">
      <div className="skyDancerStageV40Main">
        <strong>{content.title}</strong>
        <span className="skyDancerStageV40Phase">{content.phase}</span>
        <span className="skyDancerStageV40Detail">{content.detail}</span>
      </div>
      <div className="skyDancerStageV40Track" aria-hidden="true">
        <i style={{ width: `${Math.round(content.progress * 100)}%` }} />
      </div>
    </div>
  </>;
}
