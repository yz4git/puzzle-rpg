# Puzzle RPG development notes

This repository is `yz4git/puzzle-rpg`.

## Non-negotiable project constraints
- Primary target: iPhone Safari in portrait orientation.
- Keep touch controls, safe-area insets, dynamic viewport height, orientation changes, audio resume, visibility changes, and PWA behavior reliable on iPhone.
- This project was bootstrapped from `yz4git/sky-dancer`, but Sky Dancer gameplay and branding are not product requirements.
- Never deploy using Sky Dancer's ChatGPT Sites project identity. Create/use a Puzzle RPG-specific hosting configuration only when publishing is explicitly set up.
- Do not modify `yz4git/sky-dancer` while working on this repository.
- Save meaningful progress to GitHub frequently so work is recoverable.

## Direction
Build a portrait-first puzzle RPG with a fast readable touch puzzle board, short combat turns, RPG progression, satisfying skill/chain feedback, and strong one-handed usability.
