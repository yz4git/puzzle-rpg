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
  "/assets/rpg/atlas/hero.png",
  "/assets/rpg/atlas/npcs.png",
  "/assets/rpg/atlas/field.png",
  "/assets/rpg/atlas/town.png",
  "/assets/rpg/atlas/dungeon.png",
  "/assets/rpg/atlas/enemy-a.png",
  "/assets/rpg/atlas/enemy-b.png",
  "/assets/rpg/atlas/boss.png",
  "/assets/rpg/atlas/ui.png",
];

export const metadata: Metadata = {
  title: "Puzzle RPG — The Prism Road",
  description: "世界を歩き、師から技を学び、会話と6×6 Cluster Breakで戦う一人旅8bitパズルRPG。",
  manifest: `${githubPagesBasePath}/manifest.json`,
  appleWebApp: {
    capable: true,
    title: "Puzzle RPG",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
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
