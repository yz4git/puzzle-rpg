import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./puzzleEnhancements.css";

const isGitHubPagesBuild = process.env.VOXEL_RALLY_PAGES === "1";
const githubPagesBasePath = isGitHubPagesBuild
  ? `/${process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "puzzle-rpg"}`
  : "";

const pixelArtPreloads = [
  "/assets/pixel8/warden.png",
  "/assets/pixel8/bastion.png",
  "/assets/pixel8/oracle.png",
  "/assets/pixel8/null-knight.png",
  "/assets/pixel8/trickster.png",
  "/assets/pixel8/orbs/fire.png",
  "/assets/pixel8/orbs/water.png",
  "/assets/pixel8/orbs/light.png",
  "/assets/pixel8/orbs/heart.png",
  "/assets/pixel8/orbs/guard.png",
];

export const metadata: Metadata = {
  title: "Puzzle RPG",
  description: "iPhone縦画面で遊ぶ、連鎖とスキルが気持ちいいパズルRPG。",
  manifest: `${githubPagesBasePath}/manifest.json`,
  appleWebApp: {
    capable: true,
    title: "Puzzle RPG",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  other: { "codex-preview": "development" },
  icons: {
    icon: `${githubPagesBasePath}/favicon.svg`,
    shortcut: `${githubPagesBasePath}/favicon.svg`,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#11182d",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <head>
        {pixelArtPreloads.map((src) => (
          <link key={src} rel="preload" as="image" href={`${githubPagesBasePath}${src}`} />
        ))}
      </head>
      <body>{children}</body>
    </html>
  );
}
