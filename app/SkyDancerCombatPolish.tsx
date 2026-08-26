"use client";

import { useEffect, useState } from "react";
import {
  SKY_DANCER_MISSILE_EVENT,
  type SkyDancerMissileState,
} from "../src/sky/SkyDancerFlightCombat";

function skyText(value: string): string {
  let next = value;
  next = next.replaceAll("HOLD DRIFT · RELEASE DASH", "HOLD BOOST · RELEASE DASH");
  next = next.replaceAll("WALL RIDE", "LOW PASS");
  next = next.replaceAll("TURBO RAM LIGHT TARGETS", "MISSILE TARGETS");
  next = next.replaceAll("TURBO RAM BOSS", "MISSILE BOSS");
  next = next.replaceAll("TURBO RAM", "BOOST STRIKE");
  next = next.replaceAll("TURBO SMASH", "BOOST STRIKE");
  next = next.replaceAll("TURBO STORM", "BOOST STORM");
  next = next.replaceAll("ARCADE TURN", "FLIGHT CONTROL");
  next = next.replaceAll("BRAWL", "AIRSPACE");
  next = next.replaceAll("ROOM CLEAR", "AIRSPACE CLEAR");
  next = next.replaceAll("GATE OPEN", "ROUTE OPEN");
  next = next.replace(/\bRAM\b/g, "BOOST");
  next = next.replace(/\bP0\b/g, "LOCK");
  next = next.replace(/\bSCR0\b/g, "SCORE");
  return next;
}

function rewriteLegacyText(root: Node): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    if (current instanceof Text) nodes.push(current);
    current = walker.nextNode();
  }
  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent || parent.tagName === "STYLE" || parent.tagName === "SCRIPT") continue;
    const before = node.nodeValue ?? "";
    const after = skyText(before);
    if (after !== before) node.nodeValue = after;
  }
}

export default function SkyDancerCombatPolish() {
  const [warning, setWarning] = useState<{ count: number; distance: number } | null>(null);

  useEffect(() => {
    const rewrite = () => rewriteLegacyText(document.body);
    rewrite();
    const observer = new MutationObserver(() => rewrite());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    const onMissiles = (event: Event) => {
      const detail = (event as CustomEvent<SkyDancerMissileState>).detail;
      let nearest = Number.POSITIVE_INFINITY;
      for (const missile of detail.missiles) nearest = Math.min(nearest, missile.distanceToPlayer);
      if (!Number.isFinite(nearest) || nearest >= 30) {
        setWarning(null);
        return;
      }
      const closeCount = detail.missiles.filter((missile) => missile.distanceToPlayer < 30).length;
      setWarning({ count: Math.max(detail.incomingCount, closeCount, 1), distance: nearest });
    };
    window.addEventListener(SKY_DANCER_MISSILE_EVENT, onMissiles);
    return () => {
      observer.disconnect();
      window.removeEventListener(SKY_DANCER_MISSILE_EVENT, onMissiles);
    };
  }, []);

  if (!warning) return null;
  const urgent = warning.distance < 12;
  return (
    <div
      aria-label="Missile warning"
      aria-live="assertive"
      style={{
        position: "fixed",
        top: "11%",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 120,
        pointerEvents: "none",
        padding: "5px 11px",
        border: `1px solid ${urgent ? "rgba(255,86,76,.9)" : "rgba(255,194,84,.82)"}`,
        borderRadius: 6,
        background: urgent ? "rgba(80,8,12,.62)" : "rgba(54,35,6,.48)",
        color: urgent ? "#ff8b82" : "#ffd67a",
        font: "800 clamp(11px, 1.8vw, 16px)/1 system-ui, sans-serif",
        letterSpacing: ".12em",
        textShadow: "0 1px 8px rgba(0,0,0,.8)",
        boxShadow: urgent ? "0 0 18px rgba(255,72,60,.28)" : "0 0 14px rgba(255,190,70,.18)",
      }}
    >
      MISSILE WARNING · {warning.count} INBOUND · {Math.max(1, Math.round(warning.distance))}m
    </div>
  );
}
