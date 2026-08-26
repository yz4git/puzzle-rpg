"use client";

import { Fragment, useEffect, useState } from "react";
import "../src/cart/CartRogueRuntime";
import "../src/cart/CartGameMenuRuntime";
import "../src/sky/SkyDancerTurboInputIsolation";
import { setCartRunDifficulty, type CartRunDifficulty } from "../src/cart/CartRunDifficulty";
import CartRogueGame from "./CartRogueGame";
import CartTurboHuntHudOverlay from "./CartTurboHuntHudOverlay";
import CartCombatReadabilityPass from "./CartCombatReadabilityPass";
import CartGameMenu from "./CartGameMenu";
import SkyDancerHudQualityPass from "./SkyDancerHudQualityPass";
import SkyDancerShotControl from "./SkyDancerShotControl";
import SkyDancerCombatPolish from "./SkyDancerCombatPolish";
import SkyDancerHudV34 from "./SkyDancerHudV34";
import SkyDancerHudV35 from "./SkyDancerHudV35";
import SkyDancerHudV39 from "./SkyDancerHudV39";
import SkyDancerHudV40 from "./SkyDancerHudV40";
import SkyDancerHudV44 from "./SkyDancerHudV44";

export default function CartRogueGamePhase13() {
  const [started, setStarted] = useState(false);
  const [runKey, setRunKey] = useState(0);

  const startRun = (difficulty: CartRunDifficulty) => {
    setCartRunDifficulty(difficulty);
    setRunKey((value) => value + 1);
    setStarted(true);
  };

  useEffect(() => {
    if (!navigator.webdriver) return undefined;
    const timer = window.setTimeout(() => {
      setCartRunDifficulty("normal");
      setStarted(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return <>
    {started && (
      <Fragment key={runKey}>
        <CartRogueGame />
        <CartTurboHuntHudOverlay />
        <CartCombatReadabilityPass />
        <SkyDancerHudQualityPass />
        <SkyDancerShotControl />
        <SkyDancerCombatPolish />
        <SkyDancerHudV34 />
        <SkyDancerHudV35 />
        <SkyDancerHudV39 />
        <SkyDancerHudV40 />
        <SkyDancerHudV44 />
      </Fragment>
    )}
    <CartGameMenu
      started={started}
      onStart={startRun}
      onReturnTitle={() => setStarted(false)}
    />
  </>;
}
