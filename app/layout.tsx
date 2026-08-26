import type { Metadata, Viewport } from "next";
import "./globals.css";

const isGitHubPagesBuild = process.env.VOXEL_RALLY_PAGES === "1";
const githubPagesBasePath = isGitHubPagesBuild
  ? `/${process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "puzzle-rpg"}`
  : "";

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
      <body>{children}</body>
    </html>
  );
}
