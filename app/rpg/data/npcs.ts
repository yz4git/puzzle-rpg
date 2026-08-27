import type { NPCDefinition } from "../types";

export const NPCS: NPCDefinition[] = [
  { id: "hearth-elder", mapId: "hearthVillage", x: 9, y: 4, name: "村の長", sprite: "elder", palette: 0, dialogueKey: "hearthElder", memo: { id: "old-temple", title: "古寺の橋印", text: "Hearth Villageの北、Old Templeに崩れた橋を起こす印がある。" }, action: { kind: "story", setFlag: "story:begun" } },
  { id: "hearth-inn", mapId: "hearthVillage", x: 4, y: 5, name: "宿の女主人", sprite: "woman", palette: 1, dialogueKey: "hearthInn", action: { kind: "inn", price: 5 } },
  { id: "hearth-child", mapId: "hearthVillage", x: 12, y: 9, name: "森を見た子", sprite: "child", palette: 2, dialogueKey: "hearthChild", memo: { id: "forest-wisp", title: "森の灯", text: "東の森の灯は、攻撃せず静かに待つと話せるかもしれない。" } },
  { id: "hearth-road", mapId: "hearthVillage", x: 7, y: 11, name: "街道番", sprite: "soldier", palette: 0, dialogueKey: "hearthKeeper", memo: { id: "road-risk", title: "道の危険度", text: "街道は安全。草地は通常遭遇。赤い地面は危険な近道。" } },
  { id: "hearth-shop", mapId: "hearthVillage", x: 14, y: 5, name: "旅商人", sprite: "merchant", palette: 3, dialogueKey: "hearthMerchant", action: { kind: "shop", stock: ["herb", "smoke", "travellerCoat", "ironSword"] } },
  { id: "hearth-traveller", mapId: "hearthVillage", x: 6, y: 8, name: "古い旅人", sprite: "traveller", palette: 1, dialogueKey: "hearthTraveller", memo: { id: "four-masters", title: "四人の師", text: "炎・癒し・鉄壁・時の師が世界のどこかにいる。" } },
  { id: "hearth-well", mapId: "hearthVillage", x: 11, y: 6, name: "井戸番", sprite: "man", palette: 2, dialogueKey: "hearthWell" },

  { id: "lake-ferry", mapId: "lakeVillage", x: 4, y: 9, name: "渡し守", sprite: "man", palette: 1, dialogueKey: "lakeFerryman", memo: { id: "lake-routes", title: "湖の二つの道", text: "北の街道は安全。葦の近道にはDRAINを使う魔物がいる。" } },
  { id: "lake-healer", mapId: "lakeVillage", x: 9, y: 4, name: "湖の癒し手", sprite: "priest", palette: 2, dialogueKey: "lakeHealer" },
  { id: "lake-fisher", mapId: "lakeVillage", x: 13, y: 8, name: "漁師", sprite: "man", palette: 3, dialogueKey: "lakeFisher", memo: { id: "lake-imp", title: "湖の小鬼", text: "DRAINをBARで完全防御してTALKすると争わずに済む。" } },
  { id: "lake-witness", mapId: "lakeVillage", x: 7, y: 7, name: "灯を見た女", sprite: "woman", palette: 0, dialogueKey: "lakeWitness" },
  { id: "lake-shop", mapId: "lakeVillage", x: 14, y: 4, name: "水上商人", sprite: "merchant", palette: 1, dialogueKey: "lakeMerchant", action: { kind: "shop", stock: ["herb", "guardStone", "heartSeed", "pilgrimStaff"] } },
  { id: "lake-child", mapId: "lakeVillage", x: 5, y: 5, name: "庵の子", sprite: "child", palette: 3, dialogueKey: "lakeChild", memo: { id: "healing-bower", title: "癒しの庵", text: "Lake Villageの南東にQuiet Bowerがある。" } },

  { id: "reed-herbalist", mapId: "reedHamlet", x: 5, y: 5, name: "薬草師", sprite: "woman", palette: 3, dialogueKey: "reedHerbalist" },
  { id: "reed-scout", mapId: "reedHamlet", x: 8, y: 10, name: "沼の斥候", sprite: "soldier", palette: 2, dialogueKey: "reedScout", memo: { id: "marsh-route", title: "Crimson Marsh", text: "中央の赤土は危険な近道。北の木道は安全。" } },
  { id: "reed-defector", mapId: "reedHamlet", x: 12, y: 5, name: "Oracleの元弟子", sprite: "priest", palette: 1, dialogueKey: "reedDefector", memo: { id: "scarlet-drain", title: "強化DRAIN", text: "SCARLET ORACLEのDRAINはHP被害＋2を吸収。BARで0にする。" } },
  { id: "reed-elder", mapId: "reedHamlet", x: 14, y: 8, name: "葦の長", sprite: "elder", palette: 2, dialogueKey: "reedElder" },
  { id: "reed-seeker", mapId: "reedHamlet", x: 6, y: 8, name: "赤泉を探す老人", sprite: "elder", palette: 3, dialogueKey: "reedSeeker", memo: { id: "red-spring", title: "赤い泉", text: "Crimson Marshの奥。泉の水はRed Hermitの記憶に関係する。" }, action: { kind: "shop", stock: ["herb", "guardStone", "timeSand", "reedCloak"] } },

  { id: "iron-smith", mapId: "ironCity", x: 4, y: 5, name: "城塞の鍛冶師", sprite: "merchant", palette: 0, dialogueKey: "ironSmith", memo: { id: "iron-armor", title: "IRON ARMOR", text: "ATK×4以下は2軽減される。×5以上を育てる。" }, action: { kind: "shop", stock: ["guardStone", "ironSword", "ironMail", "redBlade"] } },
  { id: "iron-captain", mapId: "ironCity", x: 9, y: 4, name: "門衛隊長", sprite: "soldier", palette: 1, dialogueKey: "ironCaptain" },
  { id: "iron-guard-a", mapId: "ironCity", x: 7, y: 8, name: "盾兵", sprite: "soldier", palette: 2, dialogueKey: "ironSoldierA" },
  { id: "iron-guard-b", mapId: "ironCity", x: 11, y: 8, name: "古参兵", sprite: "soldier", palette: 3, dialogueKey: "ironSoldierB", memo: { id: "iron-training", title: "鉄壁道場", text: "Iron City西の道場。重撃を二度完全防御する試練。" } },
  { id: "iron-miner", mapId: "ironCity", x: 14, y: 10, name: "鏡鉱の坑夫", sprite: "man", palette: 1, dialogueKey: "ironMiner" },
  { id: "iron-loyal", mapId: "ironCity", x: 13, y: 5, name: "王の支持者", sprite: "woman", palette: 2, dialogueKey: "ironLoyalist" },
  { id: "iron-apprentice", mapId: "ironCity", x: 5, y: 9, name: "鍛冶の弟子", sprite: "child", palette: 0, dialogueKey: "ironApprentice" },

  { id: "mirror-archive", mapId: "mirrorTown", x: 5, y: 4, name: "記録官", sprite: "scholar", palette: 0, dialogueKey: "mirrorArchivist", action: { kind: "save" } },
  { id: "mirror-scholar", mapId: "mirrorTown", x: 9, y: 5, name: "Prism学者", sprite: "scholar", palette: 2, dialogueKey: "mirrorScholar" },
  { id: "mirror-keeper", mapId: "mirrorTown", x: 13, y: 5, name: "塔の番人", sprite: "soldier", palette: 1, dialogueKey: "mirrorKeeper", memo: { id: "lost-knight", title: "Lost Knight", text: "重撃を二度完全防御した後にTALKすれば剣を納める。" } },
  { id: "mirror-shop", mapId: "mirrorTown", x: 14, y: 9, name: "鏡商人", sprite: "merchant", palette: 3, dialogueKey: "mirrorMerchant", action: { kind: "shop", stock: ["boardBell", "timeSand", "mirrorEdge", "roadBell"] } },
  { id: "mirror-mask", mapId: "mirrorTown", x: 7, y: 9, name: "仮面の人物", sprite: "mystery", palette: 2, dialogueKey: "mirrorMystery", memo: { id: "silent-herald", title: "声のない使者", text: "VOID PASSで攻撃せず、TALKを二度試す。" } },
  { id: "mirror-inn", mapId: "mirrorTown", x: 4, y: 8, name: "鏡宿の主人", sprite: "man", palette: 0, dialogueKey: "mirrorInn", action: { kind: "inn", price: 18 } },

  { id: "ember-master", mapId: "emberShrine", x: 8, y: 4, name: "炎の師イグナ", sprite: "master", palette: 0, dialogueKey: "emberMaster", action: { kind: "training", school: "attack", technique: "flameLore", objective: "ATK×6以上を1回作る" } },
  { id: "heal-master", mapId: "quietBower", x: 8, y: 4, name: "癒しの師セナ", sprite: "master", palette: 1, dialogueKey: "healMaster", action: { kind: "training", school: "heal", technique: "firstAid", objective: "HEAL×7以上で回復する" } },
  { id: "iron-master", mapId: "ironHall", x: 8, y: 4, name: "鉄壁の師ガン", sprite: "master", palette: 2, dialogueKey: "ironMaster", action: { kind: "training", school: "barrier", technique: "fortress", objective: "重撃を2回完全防御する" } },
  { id: "time-master", mapId: "hourSpire", x: 8, y: 4, name: "時の師トワ", sprite: "master", palette: 3, dialogueKey: "timeMaster", action: { kind: "training", school: "skip", technique: "timeTheft", objective: "SKIPを3回使う" } },
];

export function npcsForMap(mapId: string) {
  return NPCS.filter((npc) => npc.mapId === mapId);
}
