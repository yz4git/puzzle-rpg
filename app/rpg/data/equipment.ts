import type { EquipmentDefinition, EquipmentId } from "../types";

export const EQUIPMENT: Record<EquipmentId, EquipmentDefinition> = {
  ironSword: { id: "ironSword", name: "IRON SWORD", slot: "weapon", rank: 1, icon: "†", description: "ATK×5以上 → +1", price: 55 },
  redBlade: { id: "redBlade", name: "RED BLADE", slot: "weapon", rank: 2, icon: "▲", description: "HP8以下のATK → +2", price: 130 },
  mirrorEdge: { id: "mirrorEdge", name: "MIRROR EDGE", slot: "weapon", rank: 3, icon: "◇", description: "3列以上のATK → +2", price: 240 },
  pilgrimStaff: { id: "pilgrimStaff", name: "PILGRIM STAFF", slot: "weapon", rank: 2, icon: "⌁", description: "HEAL×5以上 → +2", price: 125 },
  travellerCoat: { id: "travellerCoat", name: "TRAVELLER COAT", slot: "armor", rank: 1, icon: "▤", description: "MAX HP +2", price: 45 },
  ironMail: { id: "ironMail", name: "IRON MAIL", slot: "armor", rank: 2, icon: "▦", description: "戦闘開始時 BAR +2", price: 115 },
  reedCloak: { id: "reedCloak", name: "REED CLOAK", slot: "armor", rank: 2, icon: "≈", description: "DRAIN被害 -1", price: 120 },
  prismGuard: { id: "prismGuard", name: "PRISM GUARD", slot: "armor", rank: 3, icon: "✧", description: "Phase変化時 BAR +2", price: 260 },
  timeCharm: { id: "timeCharm", name: "TIME CHARM", slot: "charm", rank: 1, icon: "Ⅱ", description: "初期盤面のSKIP供給補助", price: 65 },
  heartSeed: { id: "heartSeed", name: "HEART SEED", slot: "charm", rank: 1, icon: "♥", description: "戦闘後 HP +1", price: 60 },
  roadBell: { id: "roadBell", name: "ROAD BELL", slot: "charm", rank: 2, icon: "♢", description: "FIELD遭遇間隔 +30%", price: 135 },
  voidThread: { id: "voidThread", name: "VOID THREAD", slot: "charm", rank: 3, icon: "⌛", description: "最初のSKIP×3以上 → FREE +1", price: 250 },
};

export const EQUIPMENT_ORDER = Object.keys(EQUIPMENT) as EquipmentId[];
