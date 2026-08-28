import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mode = readFileSync(new URL("../app/rpg/RPGMode.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/rpg/RPGMode.module.css", import.meta.url), "utf8");

test("encounter step synchronously locks all field movement", () => {
  assert.match(mode, /const movementLockedRef = useRef\(false\)/);
  assert.match(mode, /movementLockedRef\.current \|\| stepEncounterTimer\.current !== null \|\| screen !== "overworld"/);
  assert.match(mode, /if \(shouldEncounter\) \{[\s\S]*movementLockedRef\.current = true;[\s\S]*stopHold\(\);/);
  assert.match(mode, /function startBattle[\s\S]*movementLockedRef\.current = true;[\s\S]*stopHold\(\);/);
});

test("hold repeat cannot be recreated after encounter lock", () => {
  assert.match(mode, /move\(direction\);[\s\S]*if \(movementLockedRef\.current \|\| stepEncounterTimer\.current !== null\) return;[\s\S]*setInterval/);
  assert.match(mode, /function closeResult\(\)[\s\S]*movementLockedRef\.current = false;/);
});

test("D-pad touch targets stay at least 44px and battle cue has a full transition", () => {
  assert.match(css, /RPG field input \+ battle transition usability pass/);
  assert.match(css, /\.dpad\{width:150px;height:150px;grid-template-columns:repeat\(3,50px\)/);
  assert.match(css, /@media\(max-height:620px\)[\s\S]*repeat\(3,44px\)/);
  assert.match(css, /encounterPrismBurst/);
  assert.match(mode, /kind === "boss" \? 700 : kind === "trial" \? 520 : kind === "fixed" \? 480 : kind === "danger" \? 420 : 360/);
});
