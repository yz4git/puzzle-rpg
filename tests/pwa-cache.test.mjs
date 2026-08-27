import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Puzzle RPG service worker uses a versioned background-update cache", async () => {
  const worker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(worker, /const CACHE_PREFIX = ["']puzzle-rpg-["'];/);
  assert.match(worker, /CACHE_VERSION = SERVICE_WORKER_URL\.searchParams\.get\(["']build["']\)/);
  assert.match(worker, /event\.request\.mode === ["']navigate["']/);
  assert.match(worker, /fetch\(event\.request, \{ cache: ["']no-store["'] \}\)/);
  assert.match(worker, /self\.skipWaiting\(\)/);
  assert.match(worker, /self\.clients\.claim\(\)/);
});

test("Puzzle RPG client requests a background update without page navigation", async () => {
  const app = await readFile(new URL("../app/ServiceWorkerRegistration.tsx", import.meta.url), "utf8");
  assert.match(app, /updateViaCache:\s*["']none["']/);
  assert.match(app, /registration\.update\(\)/);
  assert.match(app, /registration\.waiting\?\.postMessage/);
  assert.doesNotMatch(app, /controllerchange|location\.reload|location\.replace/);
});

test("Puzzle RPG PWA manifest is fullscreen portrait with standalone fallback", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.name, "Puzzle RPG");
  assert.equal(manifest.display, "fullscreen");
  assert.deepEqual(manifest.display_override, ["fullscreen", "standalone"]);
  assert.equal(manifest.orientation, "portrait");
});

test("iPhone metadata uses edge-to-edge and Apple standalone capability", async () => {
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /viewportFit:\s*["']cover["']/);
  assert.match(layout, /appleWebApp:\s*\{/);
  assert.match(layout, /capable:\s*true/);
  assert.match(layout, /statusBarStyle:\s*["']black-translucent["']/);
});
