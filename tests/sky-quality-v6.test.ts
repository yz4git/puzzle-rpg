import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Sky Dancer V6 declutters resource and gate markers", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV6.ts", import.meta.url), "utf8");
  assert.match(source, /extends SkyDancerAirCombatFxV5/);
  assert.match(source, /group\.scale\.setScalar\(0\.58\)/);
  assert.match(source, /geometry\.type === "CylinderGeometry" && object\.position\.y < 0/);
  assert.match(source, /object\.scale\.setScalar\(0\.68\)/);
  assert.match(source, /Math\.min\(child\.material\.opacity, 0\.30\)/);
});

test("Sky Dancer V6 reduces oversized air-burst presentation", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV6.ts", import.meta.url), "utf8");
  assert.match(source, /sky-dancer-air-burst-v2/);
  assert.match(source, /\? 0\.74 : 0\.58/);
  assert.match(source, /burst-ring-/);
  assert.match(source, /child\.material\.opacity \*= 0\.48/);
});
