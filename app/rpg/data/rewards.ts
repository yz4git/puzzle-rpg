import type { EquipmentId, TechniqueId } from "../types";

export const BOSS_TECHNIQUE_REWARDS: Partial<Record<string, TechniqueId>> = {
  templeKeeper: "finisher",
  scarletOracle: "overheal",
  ironTyrant: "lastStand",
  voidHerald: "tempoBlade",
  nullExecutioner: "wideBreak",
};

export const TECHNIQUE_EQUIPMENT_REWARDS: Partial<Record<TechniqueId, EquipmentId>> = {
  timeTheft: "timeCharm",
};
