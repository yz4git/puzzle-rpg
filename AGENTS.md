# Puzzle RPG development notes

This repository is `yz4git/puzzle-rpg`.

## Non-negotiable project constraints
- Primary target: iPhone Safari in portrait orientation.
- Keep touch controls, safe-area insets, dynamic viewport height, orientation changes, audio resume, visibility changes, and PWA behavior reliable on iPhone.
- This project was bootstrapped from `yz4git/sky-dancer`, but Sky Dancer gameplay and branding are not product requirements.
- Never deploy using Sky Dancer's ChatGPT Sites project identity. Create/use a Puzzle RPG-specific hosting configuration only when publishing is explicitly set up.
- Do not modify `yz4git/sky-dancer` while working on this repository.
- Save meaningful progress to GitHub frequently so work is recoverable.

## Current core rules: SameGame tactical RPG
- The active puzzle is SameGame-style: tapping a panel removes its entire orthogonally connected same-type group.
- A single isolated panel is always legal and removes itself.
- There are exactly four core panel types: ATTACK, HEAL, BARRIER, and SKIP.
- One panel always equals exactly one point of its effect. Do not add hidden per-color damage multipliers.
- SKIP delays the pending enemy action without consuming or advancing that enemy action. A SKIP group of N therefore produces N delay turns, but the SKIP-clearing move itself consumes one of them: SKIP 1 gives no net free action, SKIP 2 gives one, SKIP 8 gives seven.
- Large SKIP groups are intentionally allowed to create long one-sided attack sequences and even no-response stage clears. This is a desired爽快感, not automatically a balance bug.
- Panels fall vertically after clearing and new panels enter from the per-column NEXT queues.
- Preserve deterministic visual identity during clear/fall animations: a panel must never change symbol before it has visibly finished moving.
- The tactical focus is which group to cash now versus which groups to grow for later, while reading enemy NOW/NEXT intents and the visible column NEXT supply.

## Direction
Build a portrait-first tactical SameGame RPG with fast one-tap play, readable enemy intents, short combat turns, dramatic large-group payoffs, and strong one-handed iPhone usability.
