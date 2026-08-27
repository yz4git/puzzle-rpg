import { RPG_ASSETS } from "./assets";

export type RPGIconName =
  | "attack" | "heal" | "barrier" | "skip" | "talk"
  | "item" | "status" | "run" | "memo" | "gold"
  | "weapon" | "armor" | "charm" | "herb" | "guardStone"
  | "timeSand" | "boardBell" | "smoke" | "treasure" | "save";

const ICONS: RPGIconName[] = [
  "attack", "heal", "barrier", "skip", "talk",
  "item", "status", "run", "memo", "gold",
  "weapon", "armor", "charm", "herb", "guardStone",
  "timeSand", "boardBell", "smoke", "treasure", "save",
];

export default function RPGIcon({ name, size = 16 }: { name: RPGIconName; size?: number }) {
  const index = ICONS.indexOf(name);
  const col = index % 5;
  const row = Math.floor(index / 5);
  return <i aria-hidden="true" style={{
    display: "inline-block",
    flex: "0 0 auto",
    width: size,
    height: size,
    backgroundImage: `url(${RPG_ASSETS.ui})`,
    backgroundRepeat: "no-repeat",
    backgroundSize: "500% 400%",
    backgroundPosition: `${col / 4 * 100}% ${row / 3 * 100}%`,
    imageRendering: "pixelated",
  }} />;
}
