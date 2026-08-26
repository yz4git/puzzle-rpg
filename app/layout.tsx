import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./cart-rogue-mobile-fix.css";
import CartViewportSync from "./CartViewportSync";

const isGitHubPagesBuild = process.env.VOXEL_RALLY_PAGES === "1";
const githubPagesBasePath = isGitHubPagesBuild
  ? `/${process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "sky-dancer"}`
  : "";

export const metadata: Metadata = {
  title: "Sky Dancer — Turbo Hunt",
  description: "iPhone Safari向けthree.js高速空中アクション。戦闘機で空を駆け、Turbo RAMで敵編隊を突破する。",
  manifest: `${githubPagesBasePath}/manifest.json`,
  appleWebApp: {
    capable: true,
    title: "Sky Dancer",
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
  themeColor: "#78c9ee",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <CartViewportSync />
        {children}
      </body>
    </html>
  );
}
