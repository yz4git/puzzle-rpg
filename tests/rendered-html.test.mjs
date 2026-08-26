import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Pages artifact contains the playable Sky Dancer shell", async () => {
  const html = await readFile(new URL("../out/index.html", import.meta.url), "utf8");
  assert.match(html, /<title>Sky Dancer — Airborne Turbo Run<\/title>/i);
  assert.match(html, /<div id="root"><\/div>/i);
  assert.match(html, /<script type="module"[^>]+src="\.\/assets\//i);
  assert.match(html, /<link rel="stylesheet"[^>]+href="\.\/assets\//i);
});
