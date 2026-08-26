# Sky Dancer V44 — Vertical Combat Readability & Attack Runs

V44 turns V43's vertical simulation into a readable combat language without adding any new player controls.

## Combat readability

- Up to four nearby aircraft receive a compact world-space altitude stem and up/down cue when their altitude differs from the player plane by at least 1.5 m.
- A small HUD legend explains `▲ ABOVE` and `▼ BELOW`.
- Combo, boost-strike and low-pass feedback move away from the sight picture into a compact left-side lane.

## Missile presentation

- Player and enemy missiles retain up to 42 sampled 3D positions.
- Trails remain for roughly 0.7 seconds after the missile disappears.
- The stored path reveals launch inertia, pitch changes and curved seeker motion rather than reducing the missile to a moving light point.

## Vertical tactics

- Strikers alternate high and low crossing passes.
- Orbiters combine their horizontal orbit with four altitude lanes for a loose helical pattern.
- Heavy aircraft climb into higher missile-platform lanes before easing back down.
- Boss aircraft cycle high approach, dive-through and low exit phases.

## CLEANUP attack runs

V44 replaces the nearby-but-untargetable formation model with physical distance:

- waiting aircraft orbit at 74–84 m, beyond the 58 m player missile seeker
- the old cleanup combat gate is cleared by the V44 outer director
- slots release every 5.25 seconds
- a released aircraft closes inward at about 18.5 m/s toward the normal combat envelope
- the attack run starts from a high/low lane and crosses the player altitude plane near seeker entry

The intended rule is simple: an aircraft that is physically in seeker range can be attacked; waiting aircraft are unavailable because they are genuinely too far away, not because of a hidden targetability flag.

## Validation

V44 adds unit regressions for staging range, tactical altitude commands, readability/trail wiring and HUD placement. A dedicated real-WebGL audit checks altitude cues, curved missile trails, tactical phases, cleanup orbit distance, attack-run transition and centre-screen HUD clearance before the existing boss, Turbo and full-stage audits run.
