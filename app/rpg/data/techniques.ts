import type { TechniqueDefinition, TechniqueId } from "../types";

export const TECHNIQUES: Record<TechniqueId, TechniqueDefinition> = {
  flameLore: { id: "flameLore", name: "炎の心得", school: "attack", tier: 1, icon: "▲+", description: "ATK×6以上 → +2 DAMAGE" },
  finisher: { id: "finisher", name: "とどめの型", school: "attack", tier: 2, icon: "50", description: "敵HP半分以下 → ATK +2" },
  redline: { id: "redline", name: "背水", school: "attack", tier: 3, icon: "HP!", description: "HP8以下 → ATK +2" },
  wideBreak: { id: "wideBreak", name: "横断撃", school: "attack", tier: 4, icon: "↔", description: "3列以上に渡るATK → +2" },
  firstAid: { id: "firstAid", name: "応急術", school: "heal", tier: 1, icon: "♥+", description: "HEAL×6以上 → HEAL +2" },
  overheal: { id: "overheal", name: "命の余光", school: "heal", tier: 2, icon: "♥◆", description: "余剰HEALをBARへ変換" },
  vitalGuard: { id: "vitalGuard", name: "生気の盾", school: "heal", tier: 3, icon: "♥→◆", description: "HEAL×6以上 → BAR +2" },
  gentleHand: { id: "gentleHand", name: "やさしい手", school: "heal", tier: 4, icon: "TALK", description: "別決着後 HP +4" },
  fortress: { id: "fortress", name: "城壁", school: "barrier", tier: 1, icon: "◆+", description: "BAR×6以上 → BAR +2" },
  lastStand: { id: "lastStand", name: "不退", school: "barrier", tier: 2, icon: "!◆", description: "HP8以下 → BAR +3" },
  ironBreath: { id: "ironBreath", name: "鉄の呼吸", school: "barrier", tier: 3, icon: "0", description: "完全防御するたび HP +1" },
  counterwall: { id: "counterwall", name: "返し壁", school: "barrier", tier: 4, icon: "◆▲", description: "完全防御2回目 → 2 DAMAGE" },
  timeTheft: { id: "timeTheft", name: "時盗り", school: "skip", tier: 1, icon: "Ⅱ+", description: "SKIP×4以上 → FREE +1" },
  tempoBlade: { id: "tempoBlade", name: "拍子刃", school: "skip", tier: 2, icon: "Ⅱ▲", description: "敵WAIT中のATK → +1" },
  deepFocus: { id: "deepFocus", name: "深層集中", school: "skip", tier: 3, icon: "×8", description: "×8以上のATK/HEAL/BAR → +2" },
  quietStep: { id: "quietStep", name: "静歩", school: "skip", tier: 4, icon: "…", description: "DANGER遭遇間隔 +25%" },
};

export const TECHNIQUE_ORDER = Object.keys(TECHNIQUES) as TechniqueId[];
