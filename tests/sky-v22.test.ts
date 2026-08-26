import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CartArenaSession } from "../src/cart/CartArenaSession";
import {
  SKY_DANCER_TURBO_RELEASE_BASE_KICK,
  getSkyDancerTurboState,
  setSkyDancerTurboHeld,
} from "../src/sky/SkyDancerTurboModel";

test("Sky Dancer Turbo hold is physics-neutral and release is a strong dedicated dash", () => {
  const session = new CartArenaSession();
  session.car.forwardVelocity = 16;
  session.car.lateralVelocity = 2.5;
  session.car.velocity.x = Math.sin(session.car.heading) * 16 + Math.cos(session.car.heading) * 2.5;
  session.car.velocity.z = Math.cos(session.car.heading) * 16 - Math.sin(session.car.heading) * 2.5;
  const boostChargesBefore = session.car.boostCharges;

  setSkyDancerTurboHeld(session, true);
  assert.equal(session.car.forwardVelocity, 16);
  assert.equal(session.car.lateralVelocity, 2.5);
  assert.equal(session.car.boostCharges, boostChargesBefore);
  assert.equal(getSkyDancerTurboState(session).held, true);

  setSkyDancerTurboHeld(session, false);
  const turbo = getSkyDancerTurboState(session);
  assert.equal(turbo.held, false);
  assert.equal(turbo.releaseSerial, 1);
  assert.ok(turbo.postReleaseForwardSpeed >= turbo.preReleaseForwardSpeed + SKY_DANCER_TURBO_RELEASE_BASE_KICK - 0.02);
  assert.equal(session.car.boostCharges, boostChargesBefore - 1);
  assert.equal(session.car.boostActive, true);
  assert.ok(session.car.boostTimeRemaining >= 1.04);
});

test("Turbo input isolation never forwards a held boost=true into the legacy Cart Rogue wrapper stack", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerTurboInputIsolation.ts", import.meta.url), "utf8");
  assert.match(source, /inheritedSetBoost\.call\(this, false\)/);
  assert.doesNotMatch(source, /inheritedSetBoost\.call\(this, active\)/);
  assert.doesNotMatch(source, /inheritedSetBoost\.call\(this, true\)/);
  assert.match(source, /setSkyDancerTurboHeld\(this\.session, active\)/);
  assert.match(source, /SkyDancerWebGLDemo\.prototype/);
  assert.match(source, /SkyDancerCanvasPreviewV4\.prototype/);
});

test("Turbo model has no held-speed mutation and owns a substantially stronger release", () => {
  const source = readFileSync(new URL("../src/sky/SkyDancerTurboModel.ts", import.meta.url), "utf8");
  const heldBranch = source.slice(source.indexOf("if (active)"), source.indexOf("if (!state.held) return false"));
  assert.doesNotMatch(heldBranch, /forwardVelocity\s*=/);
  assert.doesNotMatch(heldBranch, /lateralVelocity\s*=/);
  assert.doesNotMatch(heldBranch, /boostActive\s*=/);
  assert.match(source, /SKY_DANCER_TURBO_RELEASE_BASE_KICK = 6\.4/);
  assert.match(source, /SKY_DANCER_TURBO_RELEASE_CHARGE_KICK = 12\.8/);
  assert.match(source, /maxSpeed \* \(1\.76 \+ charge \* 0\.22\)/);
  assert.match(source, /car\.consumeBoostCharge\(\)/);
  assert.match(source, /car\.boostActive = true/);
  assert.match(source, /SKY_DANCER_TURBO_RELEASE_DURATION_BASE \+ charge \* SKY_DANCER_TURBO_RELEASE_DURATION_CHARGE/);
});

test("the application installs Turbo isolation after the legacy Cart runtime bootstrap", () => {
  const source = readFileSync(new URL("../app/CartRogueGamePhase13.tsx", import.meta.url), "utf8");
  const cartRuntime = source.indexOf('import "../src/cart/CartRogueRuntime"');
  const isolation = source.indexOf('import "../src/sky/SkyDancerTurboInputIsolation"');
  assert.ok(cartRuntime >= 0 && isolation > cartRuntime);
});

test("V22 raises world aircraft and effects quality without moving the chase camera", () => {
  const entry = readFileSync(new URL("../src/sky/SkyDancerAirCombatFx.ts", import.meta.url), "utf8");
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV22.ts", import.meta.url), "utf8");
  assert.match(entry, /SkyDancerAirCombatFxV22/);
  assert.match(entry, /SkyDancerAirCombatFxV21 remains in the inheritance chain/);
  assert.match(source, /extends SkyDancerAirCombatFxV21/);
  assert.match(source, /sky-dancer-v22-quality-world/);
  assert.match(source, /sky-dancer-v22-city-blocks/);
  assert.match(source, /sky-dancer-v22-rooftop-detail/);
  assert.match(source, /sky-dancer-v22-road-grid/);
  assert.match(source, /sky-dancer-v22-river/);
  assert.match(source, /sky-dancer-v22-green-belts/);
  assert.match(source, /sky-dancer-v22-industrial-landmarks/);
  assert.match(source, /sky-dancer-v22-cloud-banks/);
  assert.match(source, /sky-dancer-v22-engine-system/);
  assert.match(source, /sky-dancer-v22-speed-streaks/);
  assert.match(source, /getSkyDancerTurboState/);
  assert.doesNotMatch(source, /camera\.position\.set/);
  assert.doesNotMatch(source, /camera\.fov\s*=/);
});

test("V23 is active and removes the washed-out overlapping presentation", () => {
  const entry = readFileSync(new URL("../src/sky/SkyDancerAirCombatFx.ts", import.meta.url), "utf8");
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV23.ts", import.meta.url), "utf8");
  assert.match(entry, /SkyDancerAirCombatFxV23/);
  assert.match(source, /extends SkyDancerAirCombatFxV22/);
  assert.match(source, /toneMappingExposure = 0\.92/);
  assert.match(source, /sky-dancer-v19-cloud-volume/);
  assert.match(source, /sky-dancer-v22-cloud-banks/);
  assert.match(source, /sky-dancer-v19-cinematic-boost/);
  assert.match(source, /sky-dancer-q13-tapered-afterburner/);
  assert.match(source, /sky-dancer-v23-facade-window-bands/);
  assert.match(source, /sky-dancer-v23-refined-clouds/);
  assert.match(source, /sky-dancer-v23-river-highlights/);
  assert.match(source, /sky-dancer-v22-engine-system/);
  assert.doesNotMatch(source, /camera\.position\.set/);
  assert.doesNotMatch(source, /camera\.fov\s*=/);
});

test("V24 integrates product-quality atmosphere, aircraft and staged combat effects", () => {
  const entry = readFileSync(new URL("../src/sky/SkyDancerAirCombatFx.ts", import.meta.url), "utf8");
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV24.ts", import.meta.url), "utf8");
  assert.match(entry, /SkyDancerAirCombatFxV24/);
  assert.match(entry, /V23 remains in the inheritance chain/);
  assert.match(source, /extends SkyDancerAirCombatFxV23/);
  assert.match(source, /sky-dancer-v24-sky-dome/);
  assert.match(source, /sky-dancer-v24-horizon-silhouettes/);
  assert.match(source, /sky-dancer-v24-far-cloud-layer/);
  assert.match(source, /sky-dancer-v24-hero-detail/);
  assert.match(source, /sky-dancer-v24-enemy-signature/);
  assert.match(source, /sky-dancer-v24-muzzle-left/);
  assert.match(source, /sky-dancer-v24-impact-residue/);
  assert.match(source, /sky-dancer-v24-cinematic-edge-grade/);
  assert.match(source, /MAX_IMPACT_RESIDUES = 4/);
  assert.match(source, /toneMappingExposure = 0\.96/);
  assert.doesNotMatch(source, /camera\.position\.set/);
});

test("the product HUD adds a restrained flight frame and launch response", () => {
  const source = readFileSync(new URL("../app/SkyDancerHudQualityPass.tsx", import.meta.url), "utf8");
  assert.match(source, /sky-dancer-player-shot-ui/);
  assert.match(source, /skyDancerProductFrame/);
  assert.match(source, /skyDancerGunsight/);
  assert.match(source, /skyDancerReferenceBrand/);
  assert.match(source, /skyDancerCompassRail/);
  assert.match(source, /skyDancerTargetBracket/);
  assert.match(source, /skyDancerShotPulse/);
  assert.match(source, /CartTurboHuntHudOverlay\.module\.css/);
});

test("V25 activates the supplied reference composition without changing flight rules or chase-camera position", () => {
  const entry = readFileSync(new URL("../src/sky/SkyDancerAirCombatFx.ts", import.meta.url), "utf8");
  const source = readFileSync(new URL("../src/sky/SkyDancerAirCombatFxV25.ts", import.meta.url), "utf8");
  assert.match(entry, /SkyDancerAirCombatFxV25/);
  assert.match(entry, /V24 remains in the inheritance chain/);
  assert.match(source, /extends SkyDancerAirCombatFxV24/);
  assert.match(source, /sky-dancer-v25-reference-sky/);
  assert.match(source, /sky-dancer-v25-valley-fields/);
  assert.match(source, /sky-dancer-v25-river-basin/);
  assert.match(source, /sky-dancer-v25-landmark-city/);
  assert.match(source, /sky-dancer-v25-horizon-cloud-banks/);
  assert.match(source, /sky-dancer-v25-hero-presence/);
  assert.match(source, /sky-dancer-v25-missile-heat-system/);
  assert.match(source, /HERO_SCALE = 1\.14/);
  assert.match(source, /outerCore\.rotation\.y = Math\.PI/);
  assert.match(source, /plume\.scale\.y \+=/);
  assert.match(source, /visual\.flame\.scale\.set\(flameWidth/);
  assert.match(source, /toneMappingExposure = 1\.03/);
  assert.doesNotMatch(source, /camera\.position\.set/);
  assert.doesNotMatch(source, /camera\.fov\s*=/);
});
