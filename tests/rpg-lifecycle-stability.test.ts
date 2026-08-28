import test from "node:test";
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
