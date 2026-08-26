"use client";

import { useEffect, useState } from "react";
import PuzzleRPGGame from "./PuzzleRPGGame";
import { PIXEL_ART_ASSETS } from "./pixelArtAssets";

// Stable no-match opening board with three immediately discoverable 4+ match swaps.
// Orb indexes follow fire / water / light / heart / guard.
const OPENING_BOARD_TEMPLATE = [
  4, 3, 3, 0, 3, 1,
  3, 3, 2, 3, 4, 0,
  2, 0, 2, 0, 3, 0,
  3, 3, 4, 2, 1, 3,
  0, 4, 2, 0, 1, 2,
  2, 1, 2, 1, 3, 3,
] as const;

let randomInstalled = false;
let templateIndex = 0;
let lastOrbBucket: number | null = null;
let nativeRandom: (() => number) | null = null;

function resetSpawnSequence() {
  templateIndex = 0;
  lastOrbBucket = null;
}

function installPuzzleSpawnBalancer() {
  if (randomInstalled || typeof window === "undefined") return;
  randomInstalled = true;
  nativeRandom = Math.random.bind(Math);

  Math.random = () => {
    if (templateIndex < OPENING_BOARD_TEMPLATE.length) {
      const bucket = OPENING_BOARD_TEMPLATE[templateIndex++]!;
      lastOrbBucket = bucket;
      return (bucket + 0.31) / 5;
    }

    const source = nativeRandom!();
    const freshBucket = Math.min(4, Math.floor(source * 5));
    // NEXT remains readable/random, but small same-color clusters make 4+ setups
    // materially more common after falls without creating automatic matches every turn.
    const repeat = lastOrbBucket !== null && nativeRandom!() < 0.24;
    const bucket = repeat ? lastOrbBucket! : freshBucket;
    lastOrbBucket = bucket;
    return (bucket + 0.31) / 5;
  };

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("button") : null;
    const label = target?.textContent ?? "";
    if (/RESET|RETRY|もう一度/.test(label)) resetSpawnSequence();
  }, true);
}

type PinchState = {
  level: "safe" | "danger" | "critical";
  hp: number;
  incoming: number;
  label: string;
  power: number;
};

const SAFE_PINCH: PinchState = { level: "safe", hp: 100, incoming: 0, label: "", power: 0 };

function parseNumber(text: string, key: string): number {
  const match = text.match(new RegExp(`${key}\\s*(\\d+)`));
  return match ? Number(match[1]) : 0;
}

function decorateEffects() {
  for (const em of document.querySelectorAll("em")) {
    if (em.textContent?.trim() === "HIT!") em.parentElement?.classList.add("runtimePlayerAttackFx");
  }
  for (const span of document.querySelectorAll("span")) {
    if (/^-\d+ HP$/.test(span.textContent?.trim() ?? "")) span.parentElement?.classList.add("runtimeDamageFx");
  }
  document.querySelectorAll('[aria-live="assertive"]').forEach((node) => {
    if (node.textContent?.includes("CLEAR!")) node.classList.add("runtimeStageClear");
  });
  document.querySelectorAll('button[class*="clearing"]').forEach((node) => node.classList.add("runtimeClearingTile"));
  document.querySelectorAll('[data-pixel-sprite="enemy"][class*="Struck"], [data-pixel-sprite="enemy"][class*="struck"]').forEach((node) => node.classList.add("runtimeEnemyStruck"));
}

function inspectPinch(): PinchState {
  const blockingDialog = document.querySelector(
    '[aria-label="Puzzle RPG title"], [aria-label="Game Over"], [role="dialog"][aria-label^="Stage "]',
  );
  const clearOverlay = Array.from(document.querySelectorAll('[aria-live="assertive"]')).some((node) => node.textContent?.includes("CLEAR!"));
  if (blockingDialog || clearOverlay) return SAFE_PINCH;

  const status = document.querySelector('[aria-label="player status"]');
  const intents = document.querySelector('[aria-label="enemy intents"]');
  if (!status || !intents) return SAFE_PINCH;

  const statusText = status.textContent ?? "";
  const hp = parseNumber(statusText, "HP");
  const def = parseNumber(statusText, "DEF");
  const now = intents.firstElementChild;
  const nowText = now?.textContent ?? "";
  const label = now?.querySelector("strong")?.textContent?.trim() ?? "ATTACK";
  const numbers = nowText.match(/\d+/g) ?? [];
  const power = numbers.length > 0 ? Number(numbers[numbers.length - 1]) : 0;
  const incoming = /PIERCE/.test(label) ? power : Math.max(0, power - def);

  if (hp <= 24 || (incoming > 0 && incoming >= hp)) return { level: "critical", hp, incoming, label, power };
  if (hp <= 45 || incoming >= Math.ceil(hp * 0.45)) return { level: "danger", hp, incoming, label, power };
  return { level: "safe", hp, incoming, label, power };
}

function samePinch(a: PinchState, b: PinchState) {
  return a.level === b.level && a.hp === b.hp && a.incoming === b.incoming && a.label === b.label && a.power === b.power;
}

export default function PuzzleRPGEnhanced() {
  const [mounted, setMounted] = useState(false);
  const [pinch, setPinch] = useState<PinchState>(SAFE_PINCH);

  useEffect(() => {
    installPuzzleSpawnBalancer();
    for (const src of Object.values(PIXEL_ART_ASSETS.enemies)) {
      const image = new Image();
      image.loading = "eager";
      image.fetchPriority = "high";
      image.decoding = "sync";
      image.src = src;
      image.decode?.().catch(() => undefined);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let frame = 0;
    const inspect = () => {
      frame = 0;
      decorateEffects();
      const next = inspectPinch();
      setPinch((current) => samePinch(current, next) ? current : next);
      document.body.classList.toggle("runtimeDanger", next.level === "danger");
      document.body.classList.toggle("runtimeCritical", next.level === "critical");
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(inspect);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
    inspect();

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      document.body.classList.remove("runtimeDanger", "runtimeCritical");
    };
  }, [mounted]);

  if (!mounted) return <div className="runtimeBootFrame" aria-hidden="true" />;

  return (
    <>
      <PuzzleRPGGame />
      {pinch.level !== "safe" ? (
        <div className={`runtimePinchBanner ${pinch.level === "critical" ? "runtimePinchCritical" : ""}`} role="alert">
          <strong>{pinch.level === "critical" ? "!! CRITICAL !!" : "! DANGER !"}</strong>
          <span>HP {pinch.hp} · NOW {pinch.label} {pinch.power}{pinch.incoming > 0 ? ` · HP -${pinch.incoming}予測` : " · BLOCK可能"}</span>
        </div>
      ) : null}
    </>
  );
}
