import type { ItemDefinition, ItemId } from "../types";

export const ITEMS: Record<ItemId, ItemDefinition> = {
  herb: { id: "herb", name: "HERB", icon: "♥", description: "戦闘中 HP +6", price: 12, battleOnly: true },
  guardStone: { id: "guardStone", name: "GUARD STONE", icon: "◆", description: "戦闘中 BAR +5", price: 20, battleOnly: true },
  timeSand: { id: "timeSand", name: "TIME SAND", icon: "Ⅱ", description: "戦闘中 FREE +1", price: 28, battleOnly: true },
  boardBell: { id: "boardBell", name: "BOARD BELL", icon: "↻", description: "盤面を再配置", price: 34, battleOnly: true },
  smoke: { id: "smoke", name: "SMOKE", icon: "≋", description: "通常戦から確実に逃走", price: 26, battleOnly: true },
  prismDrop: { id: "prismDrop", name: "PRISM DROP", icon: "✦", description: "HP +4 / BAR +4 / FREE +1", price: 70, battleOnly: true },
};

export const ITEM_ORDER = Object.keys(ITEMS) as ItemId[];
