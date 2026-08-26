# Sky Dancer V42 continuity fix

V42 fixes the three visible regressions found during real play after V41 and hardens the cleanup pacing that the long-run WebGL audit exposed:

1. Player aircraft surface/tail-adjacent presentation shares the banked `playerVisual` root. Presentation construction happens before the WebGL fighter rebuild, so V37 reattaches the kit after rebuild on every update rather than attaching it to `session.car.group`.
2. Cleanup holding aircraft keep a fixed world-direction offset captured when cleanup begins. Player yaw no longer rotates held enemies around the camera. The hold radius is 40-42 m with a 40 m/s capped follow correction and tangent-facing guidance, leaving at least 16 m of radial headroom inside the 58 m missile-lock envelope.
3. Normal-wave re-engagement no longer fires on screen angle alone. An aircraft inside the range envelope is left to V41 natural turn/acceleration; player-relative intercept correction is reserved for genuinely distant enemies.
4. V36 primary city and V40 expanded city scenery are anchored at their initial world tile. V41 remains the sole rolling terrain owner. A final V42 continuity pass suppresses remaining snapping V35 street/river and V31 forest layers, replaces the river with a stable world-space version, and moves the distant V38 ridge continuously instead of in 420 m jumps.
5. Five-survivor cleanup slots are spaced by 5.25 s so the final scheduled release lands at 21 s, keeping the intended 20-30 s cleanup phase from collapsing below its target window.

Regression coverage:
- source-level V42 tests for bank hierarchy, world-fixed cleanup offsets, cleanup cadence/range margin, normal-wave angle gating, and ground-scene ownership,
- real WebGL banked-airframe capture,
- V41 terrain-boundary crossing while V36/V40 city root positions remain unchanged,
- existing V36-V39 reference fidelity, V34 boss, Turbo isolation and V40 full-stage audits remain required.