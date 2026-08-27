# Puzzle RPG development notes

This repository is `yz4git/puzzle-rpg`.

## Non-negotiable project constraints
- Primary target: iPhone Safari in portrait orientation.
- Keep touch controls, safe-area insets, dynamic viewport height, orientation changes, audio resume, visibility changes, and PWA behavior reliable on iPhone.
- This project was bootstrapped from `yz4git/sky-dancer`, but Sky Dancer gameplay and branding are not product requirements.
- Never deploy using Sky Dancer's ChatGPT Sites project identity. Create/use a Puzzle RPG-specific hosting configuration only when publishing is explicitly set up.
- Do not modify `yz4git/sky-dancer` while working on this repository.
- Save meaningful progress to GitHub frequently so work is recoverable.

## ChatGPT Sites fresh-page policy
- Every Sites/Vite build must produce a distinct `public/build-id.json`. `vite.config.ts` stamps it automatically from the commit/deployment id, with a timestamp fallback for repeated manual publishes.
- `ServiceWorkerRegistration` must fetch `build-id.json` with a unique no-store probe and move the browser onto `?__build=<build-id>` whenever the deployed build changes. This is intentional: a newly published Site should open as a new build-specific page instead of silently reusing the previous Safari page/cache entry.
- Register the service worker as `sw.js?build=<build-id>` with `updateViaCache: "none"`; the worker must derive its cache name from that build id, delete older `puzzle-rpg-*` caches on activation, and keep HTML navigation network-first with `cache: "no-store"`.
- Never remove the build-specific URL redirect merely to make the public URL look cleaner. The stable public URL remains the entry point; it should automatically replace itself with the current build-specific URL.
- After a Sites publish, verify the browser ends on the current `?__build=` URL before judging whether a visual/code update has propagated.

## Current core rules: Cluster Break tactical RPG
- The active puzzle is Cluster Break: pressing a panel previews its entire orthogonally connected same-type cluster, and releasing removes that cluster.
- A single isolated panel is always legal and removes itself.
- There are exactly four core panel types: ATTACK, HEAL, BARRIER, and SKIP.
- One panel always equals exactly one point of its effect. Do not add hidden per-color damage multipliers.
- SKIP delays the pending enemy action without consuming or advancing that enemy action. A SKIP cluster of N therefore produces N delay turns, but the SKIP-clearing move itself consumes one of them: SKIP 1 gives no net free action, SKIP 2 gives one, SKIP 8 gives seven.
- Large SKIP clusters are intentionally allowed to create long one-sided attack sequences and even no-response stage clears. This is desired爽快感, not automatically a balance bug.
- Panels fall vertically after clearing and new panels enter from the per-column NEXT queues.
- Preserve deterministic visual identity during clear/fall animations: a panel must never change symbol before it has visibly finished moving.
- Opening boards should normally start with useful clusters around size 2–5 rather than free giant clusters. Large clusters should emerge from player clearing/gravity decisions.
- Keep SKIP powerful; tune only its appearance and natural connection frequency when balance needs adjustment.
- The tactical focus is which cluster to cash now versus which clusters to grow for later, while reading enemy NOW/NEXT intents and the visible column NEXT supply.

## Direction
Build a portrait-first tactical Cluster Break RPG with fast one-touch play, readable enemy intents, short combat turns, dramatic large-cluster payoffs, and strong one-handed iPhone usability.
