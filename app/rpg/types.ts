export type RPGScreen = "overworld" | "dialogue" | "menu" | "battle" | "result" | "event" | "training" | "ending";
export type TerrainKind = "road" | "field" | "danger" | "town" | "dungeon" | "training";
export type Direction = "up" | "down" | "left" | "right";
export type PanelType = "attack" | "heal" | "barrier" | "skip";
export type EquipmentSlot = "weapon" | "armor" | "charm";
export type ItemId = "herb" | "guardStone" | "timeSand" | "boardBell" | "smoke" | "prismDrop";
export type EquipmentId =
  | "ironSword" | "redBlade" | "mirrorEdge" | "pilgrimStaff"
  | "travellerCoat" | "ironMail" | "reedCloak" | "prismGuard"
  | "timeCharm" | "heartSeed" | "roadBell" | "voidThread";
export type TechniqueId =
  | "flameLore" | "finisher" | "redline" | "wideBreak"
  | "firstAid" | "overheal" | "vitalGuard" | "gentleHand"
  | "fortress" | "lastStand" | "ironBreath" | "counterwall"
  | "timeTheft" | "tempoBlade" | "deepFocus" | "quietStep";
export type EnemyPortrait = "warden" | "bastion" | "oracle" | "null" | "trickster";

export type Vec2 = { x: number; y: number };
export type InventoryStack = { id: ItemId; count: number };
export type EquipmentLoadout = Record<EquipmentSlot, EquipmentId | null>;

export type ItemDefinition = {
  id: ItemId;
  name: string;
  icon: string;
  description: string;
  battleOnly?: boolean;
  price: number;
};

export type EquipmentDefinition = {
  id: EquipmentId;
  name: string;
  slot: EquipmentSlot;
  rank: 1 | 2 | 3;
  icon: string;
  description: string;
  price: number;
};

export type TechniqueDefinition = {
  id: TechniqueId;
  name: string;
  school: PanelType;
  tier: 1 | 2 | 3 | 4;
  icon: string;
  description: string;
};

export type EnemyIntentDefinition = {
  kind: "attack" | "heavy" | "drain" | "pierce" | "disrupt" | "seal";
  label: string;
  power: number;
  detail: string;
  icon: string;
};

export type AlternateResolution = {
  kind: "release" | "honor" | "befriend" | "awaken";
  hint: string;
  rewardText: string;
  technique?: TechniqueId;
  item?: ItemId;
  equipment?: EquipmentId;
  flag: string;
};

export type EnemyDefinition = {
  id: string;
  name: string;
  portrait: EnemyPortrait;
  tier: number;
  hp: number;
  exp: number;
  gold: number;
  boss?: boolean;
  special?: boolean;
  trait: string;
  intro: string;
  intents: EnemyIntentDefinition[];
  talk: string;
  conditionalTalk: string;
  phaseDialogue?: [string, string];
  victoryTalk?: string;
  alt?: AlternateResolution;
  drop?: ItemId;
};

export type PortalDefinition = {
  id: string;
  x: number;
  y: number;
  label: string;
  targetMap: string;
  target: Vec2;
  requireFlag?: string;
  blockedText?: string;
};

export type ChestDefinition = {
  id: string;
  x: number;
  y: number;
  item?: ItemId;
  equipment?: EquipmentId;
  gold?: number;
  requireFlag?: string;
};

export type FixedEncounterDefinition = {
  id: string;
  x: number;
  y: number;
  enemyId: string;
  requireFlag?: string;
  defeatedFlag: string;
  afterFlag?: string;
};

export type MapDefinition = {
  id: string;
  name: string;
  kind: TerrainKind;
  width: number;
  height: number;
  tiles: string[];
  returnMap?: string;
  returnPosition?: Vec2;
  portals: PortalDefinition[];
  chests: ChestDefinition[];
  fixedEncounters: FixedEncounterDefinition[];
  encounterTable?: string[];
  dangerEncounterTable?: string[];
  music: "world" | "village" | "castle" | "dungeon";
};

export type NPCAction =
  | { kind: "talk" }
  | { kind: "inn"; price: number }
  | { kind: "shop"; stock: Array<ItemId | EquipmentId> }
  | { kind: "training"; school: PanelType; technique: TechniqueId; objective: string }
  | { kind: "save" }
  | { kind: "story"; setFlag: string };

export type NPCDefinition = {
  id: string;
  mapId: string;
  x: number;
  y: number;
  name: string;
  sprite: "elder" | "woman" | "man" | "child" | "soldier" | "merchant" | "priest" | "master" | "ruler" | "scholar" | "traveller" | "mystery";
  palette: number;
  dialogueKey: string;
  memo?: { id: string; title: string; text: string };
  action?: NPCAction;
  requireFlag?: string;
  hideAfterFlag?: string;
};

export type RPGSaveData = {
  version: 1;
  playerName: string;
  level: number;
  exp: number;
  hp: number;
  maxHp: number;
  gold: number;
  mapId: string;
  position: Vec2;
  direction: Direction;
  lastInn: { mapId: string; position: Vec2 };
  inventory: InventoryStack[];
  inventorySlots: number;
  equipmentOwned: EquipmentId[];
  equipment: EquipmentLoadout;
  techniques: TechniqueId[];
  techniqueSlots: number;
  memos: Array<{ id: string; title: string; text: string; read: boolean }>;
  flags: string[];
  openedChests: string[];
  defeatedEncounters: string[];
  defeatedEnemies: Record<string, number>;
  releasedEnemies: Record<string, number>;
  battleLog: BattleRecord[];
  steps: number;
  playSeconds: number;
  encounterMeter: number;
  settings: { music: boolean; sfx: boolean };
};

export type BattleRecord = {
  enemyId: string;
  outcome: "victory" | "release" | "run" | "defeat";
  turns: number;
  hp: number;
  itemsUsed: number;
  mapId: string;
  level: number;
};

export type BattleStats = {
  turns: number;
  maxAttackCluster: number;
  maxHealCluster: number;
  maxBarrierCluster: number;
  maxSkipCluster: number;
  healed: number;
  blocked: number;
  perfectBlocks: number;
  skipUses: number;
  attackUses: number;
  talkUses: number;
  itemsUsed: number;
};

export type BattleResult = {
  outcome: "victory" | "release" | "run" | "defeat";
  enemyId: string;
  hp: number;
  inventory: InventoryStack[];
  exp: number;
  gold: number;
  rewardText?: string;
  acquiredTechnique?: TechniqueId;
  acquiredItem?: ItemId;
  acquiredEquipment?: EquipmentId;
  setFlags: string[];
  stats: BattleStats;
};
