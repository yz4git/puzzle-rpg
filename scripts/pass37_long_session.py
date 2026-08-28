from pathlib import Path

rpg_path = Path("app/rpg/RPGMode.tsx")
rpg = rpg_path.read_text()

# 1) Track the short delayed random encounter and keep one stable keyboard listener.
old = '''  const encounterTimer = useRef<number | null>(null);\n  const dangerTimer = useRef<number | null>(null);\n  const importRef = useRef<HTMLInputElement | null>(null);\n  const saveRef = useRef(save);\n'''
new = '''  const encounterTimer = useRef<number | null>(null);\n  const dangerTimer = useRef<number | null>(null);\n  const stepEncounterTimer = useRef<number | null>(null);\n  const keyboardHandlerRef = useRef<(event: KeyboardEvent) => void>(() => undefined);\n  const importRef = useRef<HTMLInputElement | null>(null);\n  const saveRef = useRef(save);\n'''
if old not in rpg: raise SystemExit("RPG timer refs anchor missing")
rpg = rpg.replace(old, new, 1)

# 2) Make danger warning timer self-clearing.
old = '''      dangerTimer.current = window.setTimeout(() => setDangerWarning(null), 760);\n'''
new = '''      dangerTimer.current = window.setTimeout(() => {\n        dangerTimer.current = null;\n        setDangerWarning(null);\n      }, 760);\n'''
if old not in rpg: raise SystemExit("danger timer anchor missing")
rpg = rpg.replace(old, new, 1)

# 3) Track the 90ms delayed random encounter so unmount cleanup owns it.
old = '''    if (shouldEncounter) {\n      saveGame(updated);\n      window.setTimeout(() => startBattle(chooseEncounter(nextPosition, danger), {}, danger ? "danger" : "wild"), 90);\n    }\n'''
new = '''    if (shouldEncounter) {\n      saveGame(updated);\n      if (stepEncounterTimer.current !== null) window.clearTimeout(stepEncounterTimer.current);\n      stepEncounterTimer.current = window.setTimeout(() => {\n        stepEncounterTimer.current = null;\n        startBattle(chooseEncounter(nextPosition, danger), {}, danger ? "danger" : "wild");\n      }, 90);\n    }\n'''
if old not in rpg: raise SystemExit("step encounter anchor missing")
rpg = rpg.replace(old, new, 1)

# 4) Clear transition/encounter refs as soon as they fire rather than retaining stale timer ids.
old = '''    transitionTimer.current = window.setTimeout(() => {\n      const isTown = destination.kind === "town";\n'''
new = '''    transitionTimer.current = window.setTimeout(() => {\n      transitionTimer.current = null;\n      const isTown = destination.kind === "town";\n'''
if old not in rpg: raise SystemExit("transition timer anchor missing")
rpg = rpg.replace(old, new, 1)
old = '''      arrivalTimer.current = window.setTimeout(() => setAreaTransition(null), 420);\n'''
new = '''      arrivalTimer.current = window.setTimeout(() => {\n        arrivalTimer.current = null;\n        setAreaTransition(null);\n      }, 420);\n'''
if old not in rpg: raise SystemExit("arrival timer anchor missing")
rpg = rpg.replace(old, new, 1)
old = '''    encounterTimer.current = window.setTimeout(() => {\n      setEncounterCue(null); setBattle({ enemyId, ...context }); setScreen("battle");\n    }, delay);\n'''
new = '''    encounterTimer.current = window.setTimeout(() => {\n      encounterTimer.current = null;\n      setEncounterCue(null); setBattle({ enemyId, ...context }); setScreen("battle");\n    }, delay);\n'''
if old not in rpg: raise SystemExit("encounter cue timer anchor missing")
rpg = rpg.replace(old, new, 1)

# 5) Stable keyboard dispatcher. The ref always points at current render state, but the DOM listener mounts once.
old = '''  function stopHold() { if (heldTimer.current !== null) window.clearInterval(heldTimer.current); heldTimer.current = null; }\n\n  useEffect(() => {\n    saveRef.current = save;\n  }, [save]);\n'''
new = '''  function stopHold() { if (heldTimer.current !== null) window.clearInterval(heldTimer.current); heldTimer.current = null; }\n\n  keyboardHandlerRef.current = (event: KeyboardEvent) => {\n    const key = event.key.toLowerCase();\n    if (screen === "dialogue" || screen === "event") { if (["enter", " ", "a"].includes(key)) { event.preventDefault(); advanceDialogue(); } return; }\n    if (screen === "result" && key === "enter") { closeResult(); return; }\n    if (screen !== "overworld") { if (key === "escape" || key === "b") closeMenu(); return; }\n    const direction = key === "arrowup" || key === "w" ? "up" : key === "arrowdown" || key === "s" ? "down" : key === "arrowleft" ? "left" : key === "arrowright" || key === "d" ? "right" : null;\n    if (direction) { event.preventDefault(); move(direction); }\n    else if (key === "a" || key === "enter" || key === " ") { event.preventDefault(); interact(); }\n    else if (key === "b" || key === "escape") { event.preventDefault(); openMenu(); }\n  };\n\n  useEffect(() => {\n    saveRef.current = save;\n  }, [save]);\n'''
if old not in rpg: raise SystemExit("keyboard dispatcher insertion anchor missing")
rpg = rpg.replace(old, new, 1)

# 6) Stop held movement at Safari lifecycle boundaries as well as persisting the newest save.
old = '''  useEffect(() => {\n    // iOS Safari may suspend or discard a tab without another gameplay event.\n    // Persist the latest in-memory save at lifecycle boundaries; pagehide also\n    // fires on reload/navigation, while visibilitychange covers app switching.\n    const persistCurrentSave = () => saveGame(saveRef.current);\n    const handleVisibilityChange = () => {\n      if (document.visibilityState === "hidden") persistCurrentSave();\n    };\n    window.addEventListener("pagehide", persistCurrentSave);\n    document.addEventListener("visibilitychange", handleVisibilityChange);\n    return () => {\n      window.removeEventListener("pagehide", persistCurrentSave);\n      document.removeEventListener("visibilitychange", handleVisibilityChange);\n    };\n  }, []);\n'''
new = '''  useEffect(() => {\n    // iOS Safari may suspend or discard a tab without another gameplay event.\n    // Persist the latest state and release held input before backgrounding.\n    const persistCurrentSave = () => saveGame(saveRef.current);\n    const handlePageHide = () => { stopHold(); persistCurrentSave(); };\n    const handleVisibilityChange = () => {\n      if (document.visibilityState === "hidden") { stopHold(); persistCurrentSave(); }\n    };\n    window.addEventListener("pagehide", handlePageHide);\n    document.addEventListener("visibilitychange", handleVisibilityChange);\n    return () => {\n      window.removeEventListener("pagehide", handlePageHide);\n      document.removeEventListener("visibilitychange", handleVisibilityChange);\n    };\n  }, []);\n'''
if old not in rpg: raise SystemExit("lifecycle save effect anchor missing")
rpg = rpg.replace(old, new, 1)

# 7) Release image handlers and atlas references on RPGMode unmount.
old = '''    return () => { active = false; };\n  }, []);\n'''
new = '''    return () => {\n      active = false;\n      for (const image of Object.values(atlasImages.current)) if (image) image.onload = null;\n      atlasImages.current = {};\n    };\n  }, []);\n'''
if old not in rpg: raise SystemExit("atlas cleanup anchor missing")
rpg = rpg.replace(old, new, 1)

# 8) Pause play-time accumulation while the document is actually backgrounded.
old = '''  useEffect(() => {\n    const timer = window.setInterval(() => commit((current) => ({ ...current, playSeconds: current.playSeconds + 10 })), 10_000);\n    return () => window.clearInterval(timer);\n  }, []);\n'''
new = '''  useEffect(() => {\n    const timer = window.setInterval(() => {\n      if (document.visibilityState !== "visible") return;\n      commit((current) => ({ ...current, playSeconds: current.playSeconds + 10 }));\n    }, 10_000);\n    return () => window.clearInterval(timer);\n  }, []);\n\n  useEffect(() => {\n    if (screen !== "overworld" || areaTransition || discovery || encounterCue) stopHold();\n  }, [areaTransition, discovery, encounterCue, screen]);\n'''
if old not in rpg: raise SystemExit("playtime timer anchor missing")
rpg = rpg.replace(old, new, 1)

# 9) Replace per-render keydown subscribe/unsubscribe churn with a single stable listener.
old = '''  useEffect(() => {\n    const listener = (event: KeyboardEvent) => {\n      const key = event.key.toLowerCase();\n      if (screen === "dialogue" || screen === "event") { if (["enter", " ", "a"].includes(key)) { event.preventDefault(); advanceDialogue(); } return; }\n      if (screen === "result" && key === "enter") { closeResult(); return; }\n      if (screen !== "overworld") { if (key === "escape" || key === "b") closeMenu(); return; }\n      const direction = key === "arrowup" || key === "w" ? "up" : key === "arrowdown" || key === "s" ? "down" : key === "arrowleft" ? "left" : key === "arrowright" || key === "d" ? "right" : null;\n      if (direction) { event.preventDefault(); move(direction); }\n      else if (key === "a" || key === "enter" || key === " ") { event.preventDefault(); interact(); }\n      else if (key === "b" || key === "escape") { event.preventDefault(); openMenu(); }\n    };\n    window.addEventListener("keydown", listener);\n    return () => window.removeEventListener("keydown", listener);\n  });\n'''
new = '''  useEffect(() => {\n    const listener = (event: KeyboardEvent) => keyboardHandlerRef.current(event);\n    window.addEventListener("keydown", listener);\n    return () => window.removeEventListener("keydown", listener);\n  }, []);\n'''
if old not in rpg: raise SystemExit("keydown effect anchor missing")
rpg = rpg.replace(old, new, 1)

# 10) Final unmount cleanup owns every manually retained timer ref.
old = '''  useEffect(() => () => { stopHold(); if (transitionTimer.current) window.clearTimeout(transitionTimer.current); if (arrivalTimer.current) window.clearTimeout(arrivalTimer.current); if (encounterTimer.current) window.clearTimeout(encounterTimer.current); if (dangerTimer.current) window.clearTimeout(dangerTimer.current); stopRpgMusic(); setSfxEnabled(true); }, []);\n'''
new = '''  useEffect(() => () => {\n    stopHold();\n    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);\n    if (arrivalTimer.current !== null) window.clearTimeout(arrivalTimer.current);\n    if (encounterTimer.current !== null) window.clearTimeout(encounterTimer.current);\n    if (dangerTimer.current !== null) window.clearTimeout(dangerTimer.current);\n    if (stepEncounterTimer.current !== null) window.clearTimeout(stepEncounterTimer.current);\n    stopRpgMusic();\n    setSfxEnabled(true);\n  }, []);\n'''
if old not in rpg: raise SystemExit("RPG unmount cleanup anchor missing")
rpg = rpg.replace(old, new, 1)

rpg_path.write_text(rpg)

# Battle: own the two free-standing timeout families that can otherwise outlive a completed battle.
battle_path = Path("app/rpg/RPGPuzzleBattle.tsx")
battle = battle_path.read_text()
old = '''  const finished = useRef(false);\n  const feedbackSeq = useRef(0);\n'''
new = '''  const finished = useRef(false);\n  const feedbackSeq = useRef(0);\n  const finishTimer = useRef<number | null>(null);\n  const feedbackTimer = useRef<number | null>(null);\n'''
if old not in battle: raise SystemExit("battle timer refs anchor missing")
battle = battle.replace(old, new, 1)

old = '''    setResolving(true);\n    window.setTimeout(() => onFinish({\n      outcome,\n      enemyId: enemy.id,\n      hp: Math.max(0, nextHp),\n      inventory: nextInventory,\n      exp: !training ? outcome === "victory" ? enemy.exp : outcome === "release" ? Math.max(1, Math.floor(enemy.exp * .35)) : 0 : 0,\n      gold: !training ? outcome === "victory" ? enemy.gold : outcome === "release" ? Math.floor(enemy.gold * .2) : 0 : 0,\n      setFlags: [],\n      stats: nextStats,\n      ...options,\n    }), outcome === "release" ? 620 : outcome === "victory" ? 480 : outcome === "defeat" ? 420 : 360);\n'''
new = '''    setResolving(true);\n    if (finishTimer.current !== null) window.clearTimeout(finishTimer.current);\n    finishTimer.current = window.setTimeout(() => {\n      finishTimer.current = null;\n      onFinish({\n        outcome,\n        enemyId: enemy.id,\n        hp: Math.max(0, nextHp),\n        inventory: nextInventory,\n        exp: !training ? outcome === "victory" ? enemy.exp : outcome === "release" ? Math.max(1, Math.floor(enemy.exp * .35)) : 0 : 0,\n        gold: !training ? outcome === "victory" ? enemy.gold : outcome === "release" ? Math.floor(enemy.gold * .2) : 0 : 0,\n        setFlags: [],\n        stats: nextStats,\n        ...options,\n      });\n    }, outcome === "release" ? 620 : outcome === "victory" ? 480 : outcome === "defeat" ? 420 : 360);\n'''
if old not in battle: raise SystemExit("battle finish timeout anchor missing")
battle = battle.replace(old, new, 1)

old = '''    setFeedback(text);\n    setImpact(kind);\n    window.setTimeout(() => {\n      if (feedbackSeq.current !== seq) return;\n      setFeedback("");\n      setImpact(null);\n    }, duration);\n'''
new = '''    setFeedback(text);\n    setImpact(kind);\n    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);\n    feedbackTimer.current = window.setTimeout(() => {\n      feedbackTimer.current = null;\n      if (feedbackSeq.current !== seq) return;\n      setFeedback("");\n      setImpact(null);\n    }, duration);\n'''
if old not in battle: raise SystemExit("battle feedback timeout anchor missing")
battle = battle.replace(old, new, 1)

old = '''  useEffect(() => {\n    const listener = (event: KeyboardEvent) => {\n      if (event.key.toLowerCase() === "b" || event.key === "Escape") {\n        event.preventDefault(); setCommandOpen((open) => !open); setCommandPage("root");\n      }\n    };\n    window.addEventListener("keydown", listener);\n    return () => window.removeEventListener("keydown", listener);\n  }, []);\n'''
new = '''  useEffect(() => {\n    const listener = (event: KeyboardEvent) => {\n      if (event.key.toLowerCase() === "b" || event.key === "Escape") {\n        event.preventDefault(); setCommandOpen((open) => !open); setCommandPage("root");\n      }\n    };\n    window.addEventListener("keydown", listener);\n    return () => window.removeEventListener("keydown", listener);\n  }, []);\n\n  useEffect(() => () => {\n    if (finishTimer.current !== null) window.clearTimeout(finishTimer.current);\n    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);\n  }, []);\n'''
if old not in battle: raise SystemExit("battle cleanup insertion anchor missing")
battle = battle.replace(old, new, 1)

battle_path.write_text(battle)

# Permanent targeted regression test. This deliberately avoids the legacy Sky Dancer test suites.
test = Path("tests/rpg-lifecycle-stability.test.ts")
test.write_text(r'''import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mode = readFileSync(new URL("../app/rpg/RPGMode.tsx", import.meta.url), "utf8");
const battle = readFileSync(new URL("../app/rpg/RPGPuzzleBattle.tsx", import.meta.url), "utf8");

test("RPG field owns delayed encounter and held-input timers", () => {
  assert.match(mode, /stepEncounterTimer = useRef<number \| null>/);
  assert.match(mode, /stepEncounterTimer\.current = window\.setTimeout/);
  assert.match(mode, /window\.clearTimeout\(stepEncounterTimer\.current\)/);
  assert.match(mode, /handlePageHide = \(\) => \{ stopHold\(\); persistCurrentSave\(\); \}/);
});

test("RPG keyboard listener mounts once and atlas handlers are released", () => {
  assert.match(mode, /keyboardHandlerRef\.current\(event\)/);
  assert.match(mode, /window\.addEventListener\("keydown", listener\);[\s\S]*?window\.removeEventListener\("keydown", listener\);[\s\S]*?\}, \[\]\);/);
  assert.match(mode, /image\.onload = null/);
  assert.match(mode, /atlasImages\.current = \{\}/);
});

test("background time does not inflate RPG play time", () => {
  assert.match(mode, /document\.visibilityState !== "visible"/);
});

test("battle finish and feedback timers are explicitly released", () => {
  assert.match(battle, /finishTimer = useRef<number \| null>/);
  assert.match(battle, /feedbackTimer = useRef<number \| null>/);
  assert.match(battle, /window\.clearTimeout\(finishTimer\.current\)/);
  assert.match(battle, /window\.clearTimeout\(feedbackTimer\.current\)/);
});
''')

# Temporary browser soak audit. It is removed by the workflow after success.
qa = Path("scripts/pass37_soak_qa.mjs")
qa.write_text(r'''import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, args: ["--enable-precise-memory-info", "--js-flags=--expose-gc"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

await page.addInitScript(() => {
  const originalSetInterval = window.setInterval.bind(window);
  const originalClearInterval = window.clearInterval.bind(window);
  const activeIntervals = new Set();
  window.__pass37 = { activeIntervals, peakIntervals: 0 };
  window.setInterval = (handler, timeout, ...args) => {
    const id = originalSetInterval(handler, timeout, ...args);
    activeIntervals.add(id);
    window.__pass37.peakIntervals = Math.max(window.__pass37.peakIntervals, activeIntervals.size);
    return id;
  };
  window.clearInterval = (id) => {
    activeIntervals.delete(id);
    return originalClearInterval(id);
  };
});

await page.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
await page.evaluate(() => {
  localStorage.setItem("puzzle-rpg:rpg-mode:v1", JSON.stringify({
    version: 1, playerName: "LIO", level: 1, exp: 0, hp: 20, maxHp: 20, gold: 18,
    mapId: "hearthVillage", position: { x: 8, y: 10 }, direction: "up",
    lastInn: { mapId: "hearthVillage", position: { x: 8, y: 10 } },
    inventory: [{ id: "herb", count: 2 }, { id: "smoke", count: 1 }], inventorySlots: 4,
    equipmentOwned: ["travellerCoat"], equipment: { weapon: null, armor: null, charm: null },
    techniques: [], techniqueSlots: 2,
    memos: [{ id: "journey", title: "最初の旅", text: "村の長から北のOld Templeについて聞く。", read: false }],
    flags: ["story:openingSeen"], openedChests: [], defeatedEncounters: [], defeatedEnemies: {}, releasedEnemies: {}, battleLog: [],
    steps: 0, playSeconds: 0, encounterMeter: 14, settings: { music: true, sfx: true }
  }));
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: /RPG MODE/ }).click();
await page.getByRole("button", { name: /CONTINUE/ }).click();
await page.getByLabel(/exploration map/).waitFor();
await page.waitForTimeout(900);

const intervalCount = () => page.evaluate(() => window.__pass37.activeIntervals.size);
const heap = async () => page.evaluate(() => { globalThis.gc?.(); return performance.memory?.usedJSHeapSize ?? 0; });
const fieldBaseline = await intervalCount();
const heapBaseline = await heap();

// Repeated menu mount/unmount cycles exercise town animation, keyboard state and canvas redraw paths.
for (let i = 0; i < 80; i += 1) {
  await page.getByRole("button", { name: /MENU/ }).dispatchEvent("pointerdown", { pointerId: 20 + i, pointerType: "touch", isPrimary: true, buttons: 1 });
  await page.getByRole("button", { name: /B • CLOSE/ }).click();
}
await page.waitForTimeout(650);
const afterMenus = await intervalCount();
if (afterMenus > fieldBaseline + 1) throw new Error(`interval leak after menu soak: baseline=${fieldBaseline} after=${afterMenus}`);

// A held d-pad interval must be released by Safari's pagehide lifecycle event.
const up = page.getByRole("button", { name: "Move up" });
await up.dispatchEvent("pointerdown", { pointerId: 900, pointerType: "touch", isPrimary: true, buttons: 1 });
await page.waitForTimeout(220);
const withHold = await intervalCount();
await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
await page.waitForTimeout(80);
const afterPageHide = await intervalCount();
if (afterPageHide >= withHold) throw new Error(`pagehide did not release held movement: held=${withHold} after=${afterPageHide}`);
await up.dispatchEvent("pointerup", { pointerId: 900, pointerType: "touch", isPrimary: true, buttons: 0 });

// Hundreds of short touch movements should not accumulate repeat timers.
const right = page.getByRole("button", { name: "Move right" });
const left = page.getByRole("button", { name: "Move left" });
for (let i = 0; i < 120; i += 1) {
  const button = i % 2 ? left : right;
  const pointerId = 1000 + i;
  await button.dispatchEvent("pointerdown", { pointerId, pointerType: "touch", isPrimary: true, buttons: 1 });
  await button.dispatchEvent("pointerup", { pointerId, pointerType: "touch", isPrimary: true, buttons: 0 });
}
await page.waitForTimeout(250);
const afterMoves = await intervalCount();
if (afterMoves > fieldBaseline + 1) throw new Error(`interval leak after movement soak: baseline=${fieldBaseline} after=${afterMoves}`);

// Return to title repeatedly; RPGMode unmount must return timer count to title baseline rather than ratcheting upward.
await page.getByRole("button", { name: /MENU/ }).dispatchEvent("pointerdown", { pointerId: 2000, pointerType: "touch", isPrimary: true, buttons: 1 });
await page.getByRole("button", { name: "STATUS" }).click();
await page.getByRole("button", { name: /TITLEへ戻る/ }).click();
await page.getByRole("button", { name: /RPG MODE/ }).waitFor();
await page.waitForTimeout(250);
const titleBaseline = await intervalCount();

for (let i = 0; i < 12; i += 1) {
  await page.getByRole("button", { name: /RPG MODE/ }).click();
  await page.getByRole("button", { name: /CONTINUE/ }).click();
  await page.getByLabel(/exploration map/).waitFor();
  await page.getByRole("button", { name: /MENU/ }).dispatchEvent("pointerdown", { pointerId: 3000 + i, pointerType: "touch", isPrimary: true, buttons: 1 });
  await page.getByRole("button", { name: "STATUS" }).click();
  await page.getByRole("button", { name: /TITLEへ戻る/ }).click();
  await page.getByRole("button", { name: /RPG MODE/ }).waitFor();
}
await page.waitForTimeout(350);
const titleAfter = await intervalCount();
if (titleAfter > titleBaseline + 1) throw new Error(`RPG mount/unmount interval growth: baseline=${titleBaseline} after=${titleAfter}`);

const heapAfter = await heap();
const heapGrowth = heapBaseline && heapAfter ? heapAfter - heapBaseline : 0;
if (heapGrowth > 24 * 1024 * 1024) throw new Error(`heap grew excessively during soak: +${Math.round(heapGrowth / 1024 / 1024)} MiB`);
if (errors.length) throw new Error(`runtime page errors: ${errors.join(" | ")}`);

const metrics = await page.evaluate(() => ({ active: window.__pass37.activeIntervals.size, peak: window.__pass37.peakIntervals }));
console.log(`PASS37 SUCCESS fieldBaseline=${fieldBaseline} afterMenus=${afterMenus} afterMoves=${afterMoves} titleBaseline=${titleBaseline} titleAfter=${titleAfter} peak=${metrics.peak} heapGrowthMiB=${(heapGrowth / 1024 / 1024).toFixed(2)}`);
await browser.close();
''')
