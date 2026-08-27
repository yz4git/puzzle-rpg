"use client";

import { useEffect } from "react";

type BuildInfo = { build?: unknown };

const LEGACY_BUILD_QUERY = "__build";

async function fetchLatestBuildId(): Promise<string | null> {
  try {
    const buildUrl = new URL("./build-id.json", window.location.href);
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

    // Clean URLs left by the retired cache-busting navigation scheme.
    // history.replaceState does not reload or navigate the page.
    cleanLegacyBuildQuery();

    if (!("serviceWorker" in navigator)) return () => {
      cancelled = true;
    };

    void (async () => {
      const buildId = await fetchLatestBuildId();
      if (cancelled || !buildId) return;

      try {
        const swUrl = new URL("./sw.js", window.location.href);
        swUrl.searchParams.set("build", buildId);
        const registration = await navigator.serviceWorker.register(
          `${swUrl.pathname}${swUrl.search}`,
          { updateViaCache: "none" },
        );
        if (cancelled) return;
        await registration.update();
        registration.waiting?.postMessage({ type: "SKIP_WAITING" });
      } catch {
        // The game remains usable without PWA installation or worker updates.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
