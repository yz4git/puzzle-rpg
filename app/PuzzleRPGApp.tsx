"use client";

import { useEffect, useState } from "react";
import { playSfx, primeAudio } from "./gameAudio";
import PrismOverdrive from "./PrismOverdrive";
import PuzzleRPGClusterBreak from "./PuzzleRPGClusterBreak";
import RPGMode from "./rpg/RPGMode";
import { createNewSave, loadSave, saveGame } from "./rpg/save";
import { setRpgMusic, stopRpgMusic } from "./rpg/rpgAudio";
import { RPG_ASSETS } from "./rpg/assets";
import type { RPGSaveData } from "./rpg/types";
import styles from "./PuzzleRPGApp.module.css";

type Mode = "title" | "rpg-choice" | "rpg" | "chapter" | "overdrive";

export default function PuzzleRPGApp() {
  const [mode, setMode] = useState<Mode>("title");
  const [storedSave, setStoredSave] = useState<RPGSaveData | null>(null);
  const [activeSave, setActiveSave] = useState<RPGSaveData | null>(null);

  useEffect(() => {
    const loaded = loadSave();
    setStoredSave(loaded);
    setRpgMusic("title", loaded?.settings.music ?? true);
    return () => stopRpgMusic();
  }, []);

  function select(next: Mode) {
    primeAudio(); playSfx("uiConfirm");
    if (next === "chapter" || next === "overdrive") stopRpgMusic();
    else if (next !== "rpg") setRpgMusic("title", storedSave?.settings.music ?? true);
    setMode(next);
  }

  function startNew() {
    const next = createNewSave();
    saveGame(next); setStoredSave(next); setActiveSave(next); select("rpg");
  }

  function continueGame() {
    const next = loadSave() ?? createNewSave();
    setActiveSave(next); select("rpg");
  }

  function backToTitle() {
    const loaded = loadSave();
    setStoredSave(loaded); setActiveSave(null); setMode("title"); setRpgMusic("title", loaded?.settings.music ?? true);
  }

  if (mode === "chapter") return <PuzzleRPGClusterBreak embedded onExit={backToTitle} />;
  if (mode === "overdrive") return <PrismOverdrive onExit={backToTitle} />;
  if (mode === "rpg" && activeSave) return <RPGMode initialSave={activeSave} onExit={backToTitle} />;

  return (
    <main className={styles.title} aria-label="Puzzle RPG mode title">
      <div className={styles.logo}>PUZZLE<br />RPG</div>
      <div className={styles.subtitle}>THE PRISM ROAD</div>
      <img className={styles.hero} src={RPG_ASSETS.heroTitle} alt="8bit hero Lio" />

      {mode === "title" ? <div className={styles.modeGrid}>
        <button type="button" className={styles.rpgMode} onClick={() => select("rpg-choice")}>
          <span>NEW ADVENTURE</span><strong>RPG MODE</strong><small>WORLD • TALK • TRAINING • STORY</small>
        </button>
        <button type="button" className={styles.chapterMode} onClick={() => select("chapter")}>
          <span>ORIGINAL 10 BATTLES</span><strong>CHAPTER BATTLE</strong><small>BUILD • ELITE • PRISM SOVEREIGN</small>
        </button>
        <button type="button" className={styles.overdriveMode} onClick={() => select("overdrive")}>
          <span>3 MINUTE HYPER CLUSTER</span><strong>PRISM OVERDRIVE</strong><small>COMBO • FEVER • CASCADE • JACKPOT</small>
        </button>
      </div> : <div className={styles.continuePanel}>
        <span>RPG MODE</span><strong>THE PRISM ROAD</strong>
        {storedSave ? <button type="button" onClick={continueGame}><b>▶ CONTINUE</b><small>LV {storedSave.level} • {storedSave.mapId.toUpperCase()} • {Math.floor(storedSave.playSeconds / 60)} MIN</small></button> : null}
        <button type="button" onClick={startNew}><b>＋ NEW GAME</b><small>最初から一人旅を始める</small></button>
        <button type="button" className={styles.back} onClick={() => select("title")}>◀ MODE SELECT</button>
      </div>}

      <footer><strong>1 PANEL = 1 EFFECT</strong><span>ATK • HEAL • BAR • SKIP</span></footer>
    </main>
  );
}
