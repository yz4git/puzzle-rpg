import type { NextConfig } from "next";

const isGitHubPagesBuild = process.env.SKY_DANCER_PAGES === "1";
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "sky-dancer";
const basePath = isGitHubPagesBuild ? `/${repositoryName}` : "";

const nextConfig: NextConfig = isGitHubPagesBuild
  ? {
      output: "export",
      trailingSlash: true,
      basePath,
      assetPrefix: `${basePath}/`,
      images: { unoptimized: true },
    }
  : {
      images: { unoptimized: true },
    };

export default nextConfig;
