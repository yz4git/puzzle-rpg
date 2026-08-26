# V40 combat pacing, HUD, and world continuity

V40 is intentionally ordered around the full-run review findings:

1. Keep non-boss fighters inside the 58 m missile-lock envelope, with a stronger cleanup re-engagement leash.
2. Target a 20–30 second cleanup phase and fail the WebGL playcheck above 35 seconds.
3. Replace competing boss/status overlays with one Stage HUD that explicitly reads WAVE, CLEANUP, BOSS, CLEAR, and the next STAGE.
4. Reduce the dominant center gunsight from 72 px to 40 px.
5. Preserve the V36 primary city while adding render-only instanced districts to the west, south-east, and south-west.

The V40 WebGL quality audit uses the real SHOT touch control, steering, and Turbo release loop, records phase timing, checks HUD duplication, and captures each stage transition.
