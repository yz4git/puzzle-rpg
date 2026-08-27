import type { EnemyDefinition, EnemyIntentDefinition } from "../types";

const hit = (label: string, power: number, detail = "通常攻撃"): EnemyIntentDefinition => ({ kind: "attack", label, power, detail, icon: "!" });
const heavy = (label: string, power: number, detail = "重撃"): EnemyIntentDefinition => ({ kind: "heavy", label, power, detail, icon: "!!" });
const drain = (label: string, power: number): EnemyIntentDefinition => ({ kind: "drain", label, power, detail: "HP被害分を吸収", icon: "+" });
const pierce = (label: string, power: number): EnemyIntentDefinition => ({ kind: "pierce", label, power, detail: "BAR無視", icon: ">>" });
const disrupt = (label: string, power: number, detail = "攻撃＋2枚変色"): EnemyIntentDefinition => ({ kind: "disrupt", label, power, detail, icon: "<>" });
const seal = (label: string, power: number): EnemyIntentDefinition => ({ kind: "seal", label, power, detail: "攻撃＋SKIP封印", icon: "×Ⅱ" });

const list: EnemyDefinition[] = [
  {
    id: "mossSlime", name: "MOSS SLIME", portrait: "warden", tier: 1, hp: 12, exp: 5, gold: 4,
    trait: "やわらかな苔。大きな塊を見ると形をまねる。", intro: "苔のかたまりが道をふさいだ。",
    intents: [hit("MOSS BUMP", 2), hit("MOSS BUMP", 2)],
    talk: "ぷる、と返事をした気がする。", conditionalTalk: "大きなHEALの光をまねて、道をあけた。",
    alt: { kind: "befriend", hint: "HEAL×5以上を見せてからTALK", rewardText: "苔がくれた露は傷を癒す。", item: "herb", flag: "friend:mossSlime" },
  },
  {
    id: "roadFang", name: "ROAD FANG", portrait: "null", tier: 1, hp: 15, exp: 7, gold: 6,
    trait: "街道から離れた旅人だけを狙う。", intro: "灰色の獣が間合いを測っている。",
    intents: [hit("QUICK BITE", 3), heavy("LUNGE", 4)], talk: "牙を見せるが、視線は荷袋に向いている。", conditionalTalk: "SMOKEの匂いに鼻を鳴らし、去っていった。", drop: "smoke",
  },
  {
    id: "thornBat", name: "THORN BAT", portrait: "trickster", tier: 1, hp: 14, exp: 7, gold: 5,
    trait: "森の影へ隠れ、盤面の色を乱す。", intro: "棘の翼が頭上をかすめた。",
    intents: [hit("WING CUT", 2), disrupt("POLLEN SHIFT", 2)], talk: "甲高い声。近くに赤い花があるらしい。", conditionalTalk: "SKIPで静まった空気に安心している。",
  },
  {
    id: "lakeImp", name: "LAKE IMP", portrait: "oracle", tier: 2, hp: 19, exp: 10, gold: 8,
    trait: "旅人の傷を見つけると水を奪う。", intro: "水面から小鬼が笑いかけた。",
    intents: [hit("SPLASH", 3), drain("SIPHON SIP", 3)], talk: "湖を汚さないなら、戦う理由はないと言う。", conditionalTalk: "BARで水を一滴も通さず、相手は感心した。",
    alt: { kind: "honor", hint: "DRAINを完全防御してTALK", rewardText: "湖底への近道を教わった。", flag: "friend:lakeImp" },
  },
  {
    id: "copperBeetle", name: "COPPER BEETLE", portrait: "bastion", tier: 2, hp: 22, exp: 11, gold: 12,
    trait: "小さなATKを1軽減する硬い甲殻。", intro: "銅色の甲虫が街道で角を構えた。",
    intents: [hit("HORN TAP", 3), heavy("COPPER RUSH", 5)], talk: "殻には鍛冶師の印が刻まれている。", conditionalTalk: "ATK×5の音に反応して腹を見せた。",
  },
  {
    id: "marshLeech", name: "MARSH LEECH", portrait: "oracle", tier: 2, hp: 24, exp: 13, gold: 9,
    trait: "DRAIN成立時、追加で1HP吸収。", intro: "赤い沼が細長い影を吐き出した。",
    intents: [hit("MUD SNAP", 3), drain("RED DRAIN", 4)], talk: "赤い泉の匂いを追っている。", conditionalTalk: "HEALの香りで動きが鈍った。", drop: "herb",
  },
  {
    id: "ashCrow", name: "ASH CROW", portrait: "warden", tier: 2, hp: 21, exp: 12, gold: 10,
    trait: "FREE中も次の強打を覚えている。", intro: "灰をまとった鳥が道標に降りた。",
    intents: [hit("BEAK", 3), hit("BEAK", 3), heavy("ASH FALL", 6)], talk: "『塔は、月の影が短い方角』と鳴いた。", conditionalTalk: "三度SKIPすると、羽根で地図を描いた。",
  },
  {
    id: "ironSentry", name: "IRON SENTRY", portrait: "bastion", tier: 3, hp: 29, exp: 17, gold: 16,
    trait: "ATK×4以下を2軽減するIRON ARMOR。", intro: "門を離れた鉄の番兵が立ちはだかる。",
    intents: [hit("SHIELD BASH", 4), heavy("IRON CRUSH", 6)], talk: "命令が古すぎて、誰を守るか忘れている。", conditionalTalk: "大きなATKを受け、古い命令を思い出した。",
    alt: { kind: "awaken", hint: "ATK×6以上の後にTALK", rewardText: "番兵は鉄壁の呼吸を伝えた。", technique: "ironBreath", flag: "friend:ironSentry" },
  },
  {
    id: "mirrorMote", name: "MIRROR MOTE", portrait: "trickster", tier: 3, hp: 26, exp: 16, gold: 14,
    trait: "直前に消した種類へ姿を変える。", intro: "鏡の光が小さな生き物になった。",
    intents: [disrupt("REFLECT SHIFT", 4), hit("GLASS RAY", 4)], talk: "こちらの言葉を逆から返している。", conditionalTalk: "攻撃せずに話すと、初めて別の言葉を返した。",
    alt: { kind: "befriend", hint: "最初の2ターン攻撃せずTALK", rewardText: "鏡の欠片が近道を映した。", item: "boardBell", flag: "friend:mirrorMote" },
  },
  {
    id: "hollowMonk", name: "HOLLOW MONK", portrait: "null", tier: 3, hp: 31, exp: 19, gold: 15,
    trait: "PIERCEの前だけ静かに頭を下げる。", intro: "空の鎧が古い礼をした。",
    intents: [hit("PALM", 4), pierce("EMPTY SPEAR", 6)], talk: "礼には礼を、と無言で待っている。", conditionalTalk: "PIERCE後にTALKすると構えを解いた。",
  },
  {
    id: "prismHound", name: "PRISM HOUND", portrait: "trickster", tier: 4, hp: 35, exp: 23, gold: 20,
    trait: "強打のたび3枚を変色させる。", intro: "色のない獣が四つの光を飲み込んだ。",
    intents: [hit("PRISM BITE", 5), disrupt("COLOR HOWL", 6, "攻撃＋3枚変色")], talk: "四つの寺の匂いを探している。", conditionalTalk: "四系統の技を見せると尾を振った。",
    alt: { kind: "befriend", hint: "四つの基礎技を覚えてTALK", rewardText: "獣の窮地の構えから『背水』を学んだ。", technique: "redline", flag: "friend:prismHound" },
  },
  {
    id: "citadelEye", name: "CITADEL EYE", portrait: "oracle", tier: 4, hp: 38, exp: 25, gold: 22,
    trait: "傷と盾を同時に監視する門の目。", intro: "石壁の紋章がこちらを見た。",
    intents: [drain("WATCH DRAIN", 5), pierce("JUDGEMENT", 7)], talk: "『四つの学びを、何のために使う？』", conditionalTalk: "別決着の記憶が多いほど攻撃が弱まった。",
  },

  {
    id: "forestWisp", name: "FOREST WISP", portrait: "warden", tier: 2, hp: 20, exp: 14, gold: 6, special: true,
    trait: "攻撃されなければ光が穏やかになる。", intro: "森の灯が逃げずにこちらを見ている。",
    intents: [hit("SOFT LIGHT", 2), hit("SOFT LIGHT", 2)], talk: "まだ怯えている。", conditionalTalk: "静かな時間を信じ、森へ戻っていった。",
    alt: { kind: "release", hint: "3ターン攻撃せずTALK", rewardText: "森の道と『やさしい手』を教わった。", technique: "gentleHand", flag: "release:forestWisp" },
  },
  {
    id: "lostKnight", name: "LOST KNIGHT", portrait: "null", tier: 3, hp: 36, exp: 26, gold: 18, special: true,
    trait: "重撃を受け止める相手を探している。", intro: "名を失った騎士が剣を掲げた。",
    intents: [hit("TEST CUT", 4), heavy("OATH BREAKER", 7)], talk: "『まだ壁とは呼べぬ』", conditionalTalk: "二度の完全防御に剣を納めた。",
    alt: { kind: "honor", hint: "重撃をBARで2回完全防御してTALK", rewardText: "騎士から『返し壁』を授かった。", technique: "counterwall", flag: "release:lostKnight" },
  },
  {
    id: "redHermit", name: "RED HERMIT", portrait: "oracle", tier: 3, hp: 33, exp: 22, gold: 12, special: true,
    trait: "回復を恐れ、傷を力に変える。", intro: "赤い泉の隠者が杖を向けた。",
    intents: [drain("SCARLET SIP", 5), hit("ROOT NEEDLE", 4)], talk: "『癒しは奪うものだ』", conditionalTalk: "大きなHEALを見て、別の癒し方を思い出した。",
    alt: { kind: "awaken", hint: "HEAL×7以上の後にTALK", rewardText: "隠者からPRISM DROPと『生気の盾』を受け取った。", item: "prismDrop", technique: "vitalGuard", flag: "release:redHermit" },
  },
  {
    id: "clockMoth", name: "CLOCK MOTH", portrait: "trickster", tier: 3, hp: 30, exp: 21, gold: 16, special: true,
    trait: "時を止めるほど羽音が音楽へ変わる。", intro: "時計の羽を持つ蛾が針を回した。",
    intents: [hit("TICK", 4), seal("TOCK SEAL", 5)], talk: "羽音はまだ速い。", conditionalTalk: "三度のSKIPで針が止まり、道を譲った。",
    alt: { kind: "befriend", hint: "SKIPを3回使ってTALK", rewardText: "蛾の鱗粉が『深層集中』を示した。", technique: "deepFocus", flag: "release:clockMoth" },
  },
  {
    id: "gateMimic", name: "GATE MIMIC", portrait: "bastion", tier: 4, hp: 40, exp: 29, gold: 28, special: true,
    trait: "宝箱のふりをしてITEMの使い方を見ている。", intro: "宝箱が歯を見せた。",
    intents: [hit("LID SNAP", 5), heavy("LOCK CRUSH", 8)], talk: "何かを使って見せろ、と蝶番が鳴る。", conditionalTalk: "ITEMの使い方に満足して本物の宝を吐き出した。",
    alt: { kind: "befriend", hint: "ITEMを使った後にTALK", rewardText: "中からMIRROR EDGEが現れた。", equipment: "mirrorEdge", flag: "release:gateMimic" },
  },
  {
    id: "silentHerald", name: "SILENT HERALD", portrait: "warden", tier: 4, hp: 42, exp: 32, gold: 24, special: true,
    trait: "言葉を失い、沈黙の回数だけこちらを読む。", intro: "声のない使者が二度うなずいた。",
    intents: [pierce("SILENT EDGE", 6), heavy("WORDLESS END", 8)], talk: "使者は一つ目の印を描いた。", conditionalTalk: "二度目の対話で門の真意を伝えた。",
    alt: { kind: "release", hint: "攻撃せずTALKを2回", rewardText: "VOID PASSの安全な足場と『静歩』を教わった。", item: "timeSand", technique: "quietStep", flag: "release:silentHerald" },
  },

  {
    id: "templeKeeper", name: "OLD TEMPLE KEEPER", portrait: "warden", tier: 2, hp: 30, exp: 28, gold: 30, boss: true,
    trait: "三手目に古い門を落とす。", intro: "『橋を渡る者よ。塊を育てる知恵を示せ』",
    intents: [hit("STONE SIGN", 3), hit("STONE SIGN", 3), heavy("OLD GATE", 7)], talk: "門番はATKの大きさを測っている。", conditionalTalk: "ATK×6を見て、橋の印を渡した。",
  },
  {
    id: "scarletOracle", name: "SCARLET ORACLE", portrait: "oracle", tier: 3, hp: 56, exp: 70, gold: 75, boss: true,
    trait: "DRAIN成立時、受けたHP被害＋2を吸収。", intro: "『その回復さえ、血に変えてあげる』",
    intents: [hit("BLOOD NEEDLE", 5), drain("BLOOD DRAIN", 6)], talk: "泉を守る理由を語ろうとしない。", conditionalTalk: "赤い泉の老人のMEMOを示すと、DRAINが弱まった。",
  },
  {
    id: "ironTyrant", name: "IRON TYRANT", portrait: "bastion", tier: 3, hp: 52, exp: 75, gold: 90, boss: true,
    trait: "ATK×4以下を2軽減するIRON ARMOR。", intro: "『守り切れるか。それとも先に砕くか』",
    intents: [hit("SHIELD BASH", 5), heavy("IRON CRUSH", 7)], talk: "城壁の外にいる者を守るため、門を閉ざしたと言う。", conditionalTalk: "大きなATKを見てIRON ARMORが1弱まった。",
  },
  {
    id: "voidHerald", name: "VOID HERALD", portrait: "warden", tier: 4, hp: 46, exp: 82, gold: 80, boss: true,
    trait: "VOID CRUSH命中後、SKIPを1枚封印。", intro: "『止めた時間ごと、砕いてみせる』",
    intents: [hit("VOID BOLT", 5), seal("VOID CRUSH", 7), hit("VOID BOLT", 5)], talk: "止めた時間の数を数えている。", conditionalTalk: "SKIPを2回使うと次のVOID CRUSHが遅れる。",
  },
  {
    id: "nullExecutioner", name: "NULL EXECUTIONER", portrait: "null", tier: 4, hp: 58, exp: 95, gold: 100, boss: true,
    trait: "HP8以下ではPIERCEが9へ強化。", intro: "『盾は数えない。残る命だけを数える』",
    intents: [hit("NULL SLASH", 6), pierce("NULL PIERCE", 7)], talk: "門を通す命令はPRISM SOVEREIGNだけが持つ。", conditionalTalk: "四つの修行印を示すと、最初のPIERCEを一度だけためらう。",
  },
  {
    id: "prismSovereign", name: "PRISM SOVEREIGN", portrait: "trickster", tier: 5, hp: 72, exp: 180, gold: 0, boss: true,
    trait: "HP50%・25%でPhaseが上がり、攻撃と変色数が強化。", intro: "『旅で得た答えを、盤面に見せて』",
    intents: [hit("PRISM RAY", 5), disrupt("PRISM COLLAPSE", 7)], talk: "倒した数ではなく、聞いた声の数を尋ねている。", conditionalTalk: "別決着の記憶に応じて最終Phaseの力が揺らぐ。",
  },
];

export const ENEMIES: Record<string, EnemyDefinition> = Object.fromEntries(list.map((enemy) => [enemy.id, enemy]));
export const NORMAL_ENEMY_IDS = list.filter((enemy) => !enemy.special && !enemy.boss).map((enemy) => enemy.id);
export const SPECIAL_ENEMY_IDS = list.filter((enemy) => enemy.special).map((enemy) => enemy.id);
export const BOSS_ENEMY_IDS = list.filter((enemy) => enemy.boss).map((enemy) => enemy.id);
