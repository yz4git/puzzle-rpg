import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  SKY_DANCER_V44_ATTACK_RUN_RELEASE_INTERVAL,
  SKY_DANCER_V44_ATTACK_RUN_SPEED,
  SKY_DANCER_V44_ATTACK_RUN_TARGET_DISTANCE,
  SKY_DANCER_V44_CLEANUP_ORBIT_MAX_DISTANCE,
  SKY_DANCER_V44_CLEANUP_ORBIT_MIN_DISTANCE,
  SKY_DANCER_V44_INTERCEPT_HEADING_RATE,
  SKY_DANCER_V44_INTERCEPT_SIDE_OFFSET,
} from "../src/sky/SkyDancerAttackRunsV44";
import {
  isSkyDancerCombatTargetableV42,
  setSkyDancerCombatOutOfSeekerRangeV44,
} from "../src/sky/SkyDancerCombatEligibilityV42";
import { SKY_DANCER_PLAYER_MISSILE_LOCK_DISTANCE } from "../src/sky/SkyDancerPlayerWeapons";
import {
  SKY_DANCER_ENEMY_ALTITUDE_LIMIT_METERS,
  getSkyDancerEnemyVerticalSnapshotV43,
  requestSkyDancerVerticalManeuverV44,
} from "../src/sky/SkyDancerVerticalFlightV43";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");

test("V44 cleanup staging stays physically outside missile lock before attack runs", () => {
  assert.ok(SKY_DANCER_V44_CLEANUP_ORBIT_MIN_DISTANCE > SKY_DANCER_PLAYER_MISSILE_LOCK_DISTANCE);
  assert.ok(SKY_DANCER_V44_CLEANUP_ORBIT_MAX_DISTANCE >= SKY_DANCER_V44_CLEANUP_ORBIT_MIN_DISTANCE + 8);
  assert.ok(SKY_DANCER_V44_ATTACK_RUN_RELEASE_INTERVAL >= 5);
  assert.ok(SKY_DANCER_V44_ATTACK_RUN_SPEED >= 32 && SKY_DANCER_V44_ATTACK_RUN_SPEED <= 50);
  assert.ok(SKY_DANCER_V44_ATTACK_RUN_TARGET_DISTANCE < SKY_DANCER_PLAYER_MISSILE_LOCK_DISTANCE);
  const source = read("../src/sky/SkyDancerAttackRunsV44.ts");
  assert.match(source, /setSkyDancerCleanupHeldV42\(enemy, false\)/);
  assert.match(source, /setPhysicalSeekerEligibility/);
  assert.match(source, /SKY_DANCER_PLAYER_MISSILE_LOCK_DISTANCE/);
  assert.match(source, /applyAttackRun/);
});

test("V44 released cleanup aircraft remain in a finite-rate forward intercept corridor until destroyed", () => {
  assert.ok(SKY_DANCER_V44_INTERCEPT_HEADING_RATE > 0 && SKY_DANCER_V44_INTERCEPT_HEADING_RATE < 1);
  assert.ok(SKY_DANCER_V44_INTERCEPT_SIDE_OFFSET >= 5 && SKY_DANCER_V44_INTERCEPT_SIDE_OFFSET <= 10);
  const source = read("../src/sky/SkyDancerAttackRunsV44.ts");
  assert.match(source, /slot\.interceptHeading = session\.car\.heading/);
  assert.match(source, /slot\.interceptHeading = rotateToward/);
  assert.match(source, /SKY_DANCER_V44_INTERCEPT_HEADING_RATE \* delta/);
  assert.match(source, /SKY_DANCER_V44_INTERCEPT_SIDE_OFFSET/);
  assert.doesNotMatch(source, /slot\.completed \|\| slot\.slot === 0/);
  assert.match(source, /applyAttackRun\(session, enemy, slot, delta, state\);\n          attackingEnemies \+= 1/);
});

test("V44 seeker eligibility follows physical range instead of a cleanup timer", () => {
  const enemy = { id: "v44-range", alive: true } as unknown as Parameters<typeof setSkyDancerCombatOutOfSeekerRangeV44>[0];
  setSkyDancerCombatOutOfSeekerRangeV44(enemy, true);
  assert.equal(isSkyDancerCombatTargetableV42(enemy), false);
  setSkyDancerCombatOutOfSeekerRangeV44(enemy, false);
  assert.equal(isSkyDancerCombatTargetableV42(enemy), true);

  const eligibility = read("../src/sky/SkyDancerCombatEligibilityV42.ts");
  assert.match(eligibility, /exact fixed step that the aircraft crosses back inside the 58 m engagement/);
  assert.match(eligibility, /OUT_OF_SEEKER_RANGE_KEY/);
});

test("V44 exposes deliberate vertical maneuvers without breaking the +/-10m envelope", () => {
  const striker = {
    id: "v44-striker",
    kind: "chaser",
    archetype: "striker",
  } as unknown as Parameters<typeof requestSkyDancerVerticalManeuverV44>[0];
  requestSkyDancerVerticalManeuverV44(striker, 9.6, 1.2);
  const snapshot = getSkyDancerEnemyVerticalSnapshotV43(striker);
  assert.ok(snapshot.targetAltitudeMeters <= SKY_DANCER_ENEMY_ALTITUDE_LIMIT_METERS);
  assert.ok(snapshot.targetAltitudeMeters >= -SKY_DANCER_ENEMY_ALTITUDE_LIMIT_METERS);
  assert.equal(snapshot.avoiding, true);
  const source = read("../src/sky/SkyDancerVerticalFlightV43.ts");
  assert.match(source, /enemy\.archetype === "striker"/);
  assert.match(source, /enemy\.archetype === "orbiter"/);
  assert.match(source, /enemy\.kind === "heavy"/);
  assert.match(source, /enemy\.kind === "boss"/);
});

test("V44 readability pass provides altitude cues and persistent curved missile trails", () => {
  const source = read("../src/sky/presentation/SkyDancerV44ReadabilityPass.ts");
  assert.match(source, /MAX_TRAIL_POINTS = 42/);
  assert.match(source, /TRAIL_LINGER_SECONDS = 0\.7/);
  assert.match(source, /sky-dancer-v44-altitude-cues/);
  assert.match(source, /sky-dancer-v44-missile-trails/);
  assert.match(source, /sawUpCue/);
  assert.match(source, /sawDownCue/);
  assert.match(source, /sawCurvedTrail/);
  assert.match(source, /__skyDancerGetV44Readability/);
});

test("V44 reserves the screen center for target and altitude reading", () => {
  const hud = read("../app/SkyDancerHudV44.tsx");
  const phase = read("../app/CartRogueGamePhase13.tsx");
  assert.match(hud, /Altitude cue legend/);
  assert.match(hud, /ABOVE/);
  assert.match(hud, /BELOW/);
  assert.match(hud, /left: max\(16px/);
  assert.match(phase, /SkyDancerHudV44/);
});

test("V44 presentation and attack-run directors are wired after V43/V41", () => {
  const pipeline = read("../src/sky/presentation/SkyDancerPresentationPipeline.ts");
  const facade = read("../src/sky/SkyDancerAirCombatFx.ts");
  assert.match(pipeline, /SkyDancerV44ReadabilityPass/);
  assert.match(pipeline, /this\.v43\.update\(snapshot\);\n    this\.v44\.update\(snapshot\);/);
  assert.match(facade, /installSkyDancerFlightNaturalMotionV41\(\);\n    installSkyDancerAttackRunsV44\(\);/);
});
