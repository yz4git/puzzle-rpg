"use client";

import { useEffect } from "react";

type BuildInfo = { build?: unknown };

const BUILD_QUERY = "__build";

async function fetchLatestBuildId(): Promise<string | null> {
  try {
    const buildUrl = new URL("./build-id.json", window.location.href);
    // A unique probe URL also bypasses an older cache-first service worker.
    buildUrl.searchParams.set("_fresh", `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
    const response = await fetch(buildUrl.toString(), { cache: "no-store" });
    if (!response.ok) return null;
    const payload = await response.json() as BuildInfo;
    return typeof payload.build === "string" && payload.build.length > 0 ? payload.build : null;
  } catch {
    return null;
  }
}

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    let cancelled = false;
    let navigatingToFreshBuild = false;
    let refreshedForController = false;
    const hasServiceWorker = "serviceWorker" in navigator;
    const hadController = hasServiceWorker && Boolean(navigator.serviceWorker.controller);

    const onControllerChange = () => {
      if (cancelled || navigatingToFreshBuild || !hadController || refreshedForController) return;
      refreshedForController = true;
      window.location.reload();
    };

    if (hasServiceWorker) navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    void (async () => {
      const buildId = await fetchLatestBuildId();
      if (cancelled) return;

      const currentUrl = new URL(window.location.href);
      const needsFreshNavigation = Boolean(buildId && currentUrl.searchParams.get(BUILD_QUERY) !== buildId);
      navigatingToFreshBuild = needsFreshNavigation;

      if (hasServiceWorker) {
        try {
          const swUrl = new URL("./sw.js", window.location.href);
          if (buildId) swUrl.searchParams.set("build", buildId);
          const registration = await navigator.serviceWorker.register(
            `${swUrl.pathname}${swUrl.search}`,
            { updateViaCache: "none" },
          );
          void registration.update();
          registration.waiting?.postMessage({ type: "SKIP_WAITING" });
        } catch {
          // The page still works without PWA installation; fresh URL navigation remains active.
        }
      }

      if (cancelled || !buildId || !needsFreshNavigation) return;
      currentUrl.searchParams.set(BUILD_QUERY, buildId);
      currentUrl.searchParams.delete("_fresh");
      // Replace the stable URL with a build-unique page. Every Sites publish therefore
      // gets a new navigation target instead of reusing the previous Safari page entry.
      window.location.replace(currentUrl.toString());
    })();

    return () => {
      cancelled = true;
      if (hasServiceWorker) navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
