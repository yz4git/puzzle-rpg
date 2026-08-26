import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Sky Dancer service worker uses a versioned fresh-navigation cache", async () => {
  const worker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(worker, /const CACHE_PREFIX = ["']sky-dancer-["'];/);
  assert.match(worker, /const CACHE_VERSION = ["']v\d+["'];/);
  assert.match(worker, /event\.request\.mode === ["']navigate["']/);
  assert.match(worker, /fetch\(event\.request, \{ cache: ["']no-store["'] \}\)/);
  assert.match(worker, /self\.skipWaiting\(\)/);
  assert.match(worker, /self\.clients\.claim\(\)/);
});

test("Sky Dancer client registration requests an update", async () => {
  const app = await readFile(new URL("../app/ServiceWorkerRegistration.tsx", import.meta.url), "utf8");
  assert.match(app, /updateViaCache:\s*["']none["']/);
  assert.match(app, /registration\.update\(\)/);
  assert.match(app, /controllerchange/);
});

test("Sky Dancer PWA manifest is fullscreen landscape with standalone fallback", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.name, "Sky Dancer");
  assert.equal(manifest.display, "fullscreen");
  assert.deepEqual(manifest.display_override, ["fullscreen", "standalone"]);
  assert.equal(manifest.orientation, "landscape");
});

test("iPhone metadata uses edge-to-edge and Apple standalone capability", async () => {
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /viewportFit:\s*["']cover["']/);
  assert.match(layout, /appleWebApp:\s*\{/);
  assert.match(layout, /capable:\s*true/);
  assert.match(layout, /statusBarStyle:\s*["']black-translucent["']/);
});
