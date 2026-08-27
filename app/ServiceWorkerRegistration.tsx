"use client";

import { useEffect } from "react";

type BuildInfo = { build?: unknown };

const BUILD_STORAGE_KEY = "puzzle-rpg:last-build-id";
const LEGACY_BUILD_QUERY = "__build";

async function fetchLatestBuildId(): Promise<string | null> {
  try {
    const buildUrl = new URL("./build-id.json", window.location.href);
    // A unique probe URL bypasses both HTTP cache and older cache-first workers.
    buildUrl.searchParams.set("_fresh", `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
    const response = await fetch(buildUrl.toString(), { cache: "no-store" });
    if (!response.ok) return null;
    const payload = await response.json() as BuildInfo;
    return typeof payload.build === "string" && payload.build.length > 0 ? payload.build : null;
  } catch {
    return null;
  }
}

function cleanLegacyBuildQuery() {
  const currentUrl = new URL(window.location.href);
  if (!currentUrl.searchParams.has(LEGACY_BUILD_QUERY)) return;
  currentUrl.searchParams.delete(LEGACY_BUILD_QUERY);
  currentUrl.searchParams.delete("_fresh");
  window.history.replaceState(window.history.state, "", currentUrl.toString());
}

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    let cancelled = false;
    let reloading = false;
    const hasServiceWorker = "serviceWorker" in navigator;

    // Remove the previous cache-busting URL without causing another navigation.
    cleanLegacyBuildQuery();

    void (async () => {
      const buildId = await fetchLatestBuildId();
      if (cancelled || !buildId) return;

      let previousBuild: string | null = null;
      try {
        previousBuild = window.localStorage.getItem(BUILD_STORAGE_KEY);
      } catch {
        // Storage may be unavailable in private/embedded browsing. Fresh SW logic still works.
      }

      if (hasServiceWorker) {
        try {
          const swUrl = new URL("./sw.js", window.location.href);
          swUrl.searchParams.set("build", buildId);
          const registration = await navigator.serviceWorker.register(
            `${swUrl.pathname}${swUrl.search}`,
            { updateViaCache: "none" },
          );
          await registration.update();
          registration.waiting?.postMessage({ type: "SKIP_WAITING" });
        } catch {
          // The game remains usable without PWA installation.
        }
      }

      if (cancelled) return;

      try {
        window.localStorage.setItem(BUILD_STORAGE_KEY, buildId);
      } catch {
        // Ignore storage failures.
      }

      // First visit: keep the already-rendered page stable. On a later publish, reload
      // exactly once at the same clean URL. Navigation requests are network-first/no-store
      // in sw.js, so this fetches the new HTML without the delayed ?__build redirect that
      // could surface a non-HTML Sites response in embedded Safari.
      if (previousBuild && previousBuild !== buildId && !reloading) {
        reloading = true;
        window.location.reload();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
