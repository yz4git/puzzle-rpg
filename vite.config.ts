import { existsSync, readFileSync, writeFileSync } from "node:fs";
import vinext from "vinext";
import { defineConfig } from "vite";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const hostingConfigUrl = new URL("./.openai/hosting.json", import.meta.url);
const hostingConfig = existsSync(hostingConfigUrl)
  ? JSON.parse(readFileSync(hostingConfigUrl, "utf8")) as { d1?: string; r2?: string }
  : {};
const { d1, r2 } = hostingConfig;

// Every production build gets a distinct identity. A commit SHA is preferred when
// available; the timestamp fallback also makes manual/repeated Sites publishes unique.
const PUZZLE_RPG_BUILD_ID = (
  process.env.GITHUB_SHA?.slice(0, 12)
  ?? process.env.CF_PAGES_COMMIT_SHA?.slice(0, 12)
  ?? process.env.SITES_DEPLOYMENT_ID
  ?? `b${Date.now().toString(36)}`
).replace(/[^a-zA-Z0-9._-]/g, "-");

// public/ is copied by Vite after this config is evaluated, so stamp the build id
// before the asset pipeline starts. Clients fetch it with a cache-busting query.
writeFileSync(
  new URL("./public/build-id.json", import.meta.url),
  `${JSON.stringify({ build: PUZZLE_RPG_BUILD_ID })}\n`,
  "utf8",
);

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    define: {
      __PUZZLE_RPG_BUILD_ID__: JSON.stringify(PUZZLE_RPG_BUILD_ID),
    },
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: localBindingConfig,
      }),
    ],
  };
});
