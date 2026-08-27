from pathlib import Path

PATH = Path("app/PuzzleRPGClusterBreak.tsx")
text = PATH.read_text()

if "CHAPTER_ONE_STAGES" in text:
    print("Chapter 1 build system already applied")
    raise SystemExit(0)

def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    text = text.replace(old, new, 1)

def replace_between(start: str, end: str, replacement: str, label: str) -> None:
    global text
    a = text.find(start)
    if a < 0:
        raise RuntimeError(f"{label}: start marker not found")
    b = text.find(end, a)
    if b < 0:
        raise RuntimeError(f"{label}: end marker not found")
    text = text[:a] + replacement + text[b:]

replace_once(
    'import v2 from "./PuzzleRPGGameplayV2.module.css";\n',
    'import v2 from "./PuzzleRPGGameplayV2.module.css";\nimport chapter from "./PuzzleRPGChapter1.module.css";\n',
    "chapter css import",
)

replace_once(
    'type EnemyDef = { kind: PixelEnemyKind; name: string; quote: string; hint: string; passive: string };\n',
    '''type EnemyDef = { kind: PixelEnemyKind; name: string; quote: string; hint: string; passive: string };\ntype StageDef = EnemyDef & { hp: number; powerBonus: number; elite?: boolean; boss?: boolean };\ntype RewardId =\n  | "berserker" | "finisher" | "redline" | "overheal"\n  | "fieldMedic" | "vitalGuard" | "fortress" | "lastStand"\n  | "timeThief" | "tempoBlade" | "deepFocus" | "wideBreak";\ntype RewardTag = "ATK" | "HEAL" | "BAR" | "SKIP" | "CORE";\ntype RewardDef = { id: RewardId; name: string; icon: string; tag: RewardTag; description: string };\n''',
    "chapter types",
)

chapter_data = '''const CHAPTER_TITLE = "THE SHATTERED GATE";\nconst CHAPTER_LENGTH = 10;\n\nconst CHAPTER_ONE_STAGES: StageDef[] = [\n  {\n    kind: "warden", name: "VOID WARDEN", hp: 18, powerBonus: 0,\n    quote: "力だけでは届かぬ。時を読め。",\n    hint: "SKIPを2個以上まとめて消すと、敵より多く行動できる。",\n    passive: "2回目の行動はVOID CRUSH。SKIPしても技の順番は消えない。",\n  },\n  {\n    kind: "bastion", name: "IRON BASTION", hp: 25, powerBonus: 0,\n    quote: "崩せるものなら、崩してみろ。",\n    hint: "ATK塊を育てて一気に削る。BARRIERを先に貯めてもよい。",\n    passive: "重い攻撃が多い。小刻みな攻撃より、大量消しの攻勢が有効。",\n  },\n  {\n    kind: "oracle", name: "BLOOD ORACLE", hp: 32, powerBonus: 0,\n    quote: "流した血は、わたしの糧になる。",\n    hint: "DRAINでHPに通った分だけ敵が回復。BARRIERか大量SKIPで封じる。",\n    passive: "DRAINは実際に失ったHPと同じ量だけ敵HPを回復する。",\n  },\n  {\n    kind: "null", name: "NULL KNIGHT", hp: 38, powerBonus: 0,\n    quote: "盾の向こう側まで斬る。",\n    hint: "PIERCEはBARRIER無視。HEALかSKIPで発動そのものを遅らせる。",\n    passive: "PIERCEはBARRIERを消費せず、HPへ直接ダメージを通す。",\n  },\n  {\n    kind: "trickster", name: "PRISM TRICKSTER", hp: 45, powerBonus: 0, elite: true,\n    quote: "いい塊だね。壊れる前に使えるかな？",\n    hint: "DISRUPTは盤面の一部を変色。巨大塊は抱えすぎず使う判断も必要。",\n    passive: "CHAPTER中間戦。PRISM SHIFT後はNEXTと盤面を読み直そう。",\n  },\n  {\n    kind: "warden", name: "VOID HERALD", hp: 48, powerBonus: 1, elite: true,\n    quote: "止めた時間ごと、砕いてみせる。",\n    hint: "前半より攻撃が重い。SKIPで作ったFREE中にATK塊を完成させる。",\n    passive: "強化VOID CRUSHを使用。FREEを攻撃準備に変える判断が重要。",\n  },\n  {\n    kind: "bastion", name: "IRON TYRANT", hp: 54, powerBonus: 1, elite: true,\n    quote: "守り切れるか。それとも先に砕くか。",\n    hint: "IRON CRUSHに備えてBARを作るか、ATKでレースを仕掛けるか選ぶ。",\n    passive: "高耐久＋強化重撃。ビルドの得意色を大きく育てたい。",\n  },\n  {\n    kind: "oracle", name: "SCARLET ORACLE", hp: 60, powerBonus: 1, elite: true,\n    quote: "その回復さえ、血に変えてあげる。",\n    hint: "DRAINを受ける前にBARかSKIP。HEALビルドなら回復超過も活用できる。",\n    passive: "強化DRAIN。防ぐ・遅らせる・先に削るの三択を迫る。",\n  },\n  {\n    kind: "null", name: "NULL EXECUTIONER", hp: 66, powerBonus: 2, elite: true,\n    quote: "盾は数えない。残る命だけを数える。",\n    hint: "PIERCE直前はBARだけに頼らずHPを確保。FREE中のATKボーナスも有効。",\n    passive: "強化PIERCE。終盤ビルドの弱点を突く処刑戦。",\n  },\n  {\n    kind: "trickster", name: "PRISM SOVEREIGN", hp: 78, powerBonus: 2, boss: true,\n    quote: "十の戦いで得た答えを、すべて見せて。",\n    hint: "BOSSは2回に1回PRISM COLLAPSE。3枚変色する前に大塊を使う判断も必要。",\n    passive: "CHAPTER BOSS。高頻度の盤面変色と重い攻撃で完成したビルドを試す。",\n  },\n];\n\nconst REWARDS: RewardDef[] = [\n  { id: "berserker", name: "BERSERKER", icon: "▲+", tag: "ATK", description: "ATK ×6以上 → +3 DAMAGE" },\n  { id: "finisher", name: "FINISHER", icon: "50", tag: "ATK", description: "敵HPが半分以下 → ATK +3" },\n  { id: "redline", name: "REDLINE", icon: "HP!", tag: "ATK", description: "HP 8以下 → ATK +3" },\n  { id: "overheal", name: "OVERHEAL", icon: "♥◆", tag: "HEAL", description: "余剰HEALを同量のBARへ変換" },\n  { id: "fieldMedic", name: "FIELD MEDIC", icon: "♥+", tag: "HEAL", description: "HEAL ×6以上 → HEAL +3" },\n  { id: "vitalGuard", name: "VITAL GUARD", icon: "♥→◆", tag: "HEAL", description: "HEAL ×6以上 → BAR +2" },\n  { id: "fortress", name: "FORTRESS", icon: "◆+", tag: "BAR", description: "BAR ×6以上 → BAR +3" },\n  { id: "lastStand", name: "LAST STAND", icon: "!◆", tag: "BAR", description: "HP 8以下 → BAR効果 +4" },\n  { id: "timeThief", name: "TIME THIEF", icon: "Ⅱ+", tag: "SKIP", description: "SKIP ×4以上 → FREE +1" },\n  { id: "tempoBlade", name: "TEMPO BLADE", icon: "Ⅱ▲", tag: "SKIP", description: "敵WAIT中のATK → +2 DAMAGE" },\n  { id: "deepFocus", name: "DEEP FOCUS", icon: "×8", tag: "CORE", description: "×8以上のATK/HEAL/BAR効果 +2" },\n  { id: "wideBreak", name: "WIDE BREAK", icon: "↔", tag: "CORE", description: "3列以上にまたがる塊のATK/HEAL/BAR +2" },\n];\n\nfunction stageDef(stage: number): StageDef {\n  return CHAPTER_ONE_STAGES[Math.max(0, Math.min(CHAPTER_LENGTH - 1, stage - 1))]!;\n}\n\nfunction rewardDef(id: RewardId): RewardDef {\n  return REWARDS.find((reward) => reward.id === id)!;\n}\n\nfunction drawRewardChoices(owned: RewardId[]): RewardId[] {\n  const available = REWARDS.filter((reward) => !owned.includes(reward.id));\n  return [...available].sort(() => Math.random() - 0.5).slice(0, 3).map((reward) => reward.id);\n}\n\n'''
replace_between("const ENEMIES: EnemyDef[] = [", "let tileId = 1;", chapter_data + "let tileId = 1;", "chapter data")

intent_block = '''function enemyForStage(stage: number): StageDef {\n  return stageDef(stage);\n}\n\nfunction enemyMaxHp(stage: number): number {\n  return stageDef(stage).hp;\n}\n\nfunction enemyIntent(stage: number, step: number, enemy: StageDef): Intent {\n  const add = enemy.powerBonus;\n  if (enemy.kind === "warden") {\n    return step % 3 === 1\n      ? { kind: "heavy", label: "VOID CRUSH", detail: "重撃", power: 6 + add, icon: "!!" }\n      : { kind: "attack", label: "VOID BOLT", detail: "通常攻撃", power: 4 + add, icon: "!" };\n  }\n  if (enemy.kind === "bastion") {\n    return step % 2 === 1\n      ? { kind: "heavy", label: "IRON CRUSH", detail: "重撃", power: 6 + add, icon: "!!" }\n      : { kind: "attack", label: "SHIELD BASH", detail: "通常攻撃", power: 4 + add, icon: "!" };\n  }\n  if (enemy.kind === "oracle") {\n    return step % 3 === 1\n      ? { kind: "drain", label: "BLOOD DRAIN", detail: "HP被害分を吸収", power: 5 + add, icon: "+" }\n      : { kind: "attack", label: "BLOOD NEEDLE", detail: "通常攻撃", power: 4 + add, icon: "!" };\n  }\n  if (enemy.kind === "null") {\n    return step % 2 === 1\n      ? { kind: "pierce", label: "NULL PIERCE", detail: "BARRIER無視", power: 5 + add, icon: ">>" }\n      : { kind: "attack", label: "NULL SLASH", detail: "通常攻撃", power: 4 + add, icon: "!" };\n  }\n  if (enemy.boss) {\n    return step % 2 === 1\n      ? { kind: "disrupt", label: "PRISM COLLAPSE", detail: "攻撃＋3枚変色", power: 7 + add, icon: "<>" }\n      : { kind: "attack", label: "PRISM RAY", detail: "通常攻撃", power: 5 + add, icon: "!" };\n  }\n  return step % 3 === 1\n    ? { kind: "disrupt", label: "PRISM SHIFT", detail: "攻撃＋2枚変色", power: 5 + add, icon: "<>" }\n    : { kind: "attack", label: "PRISM HIT", detail: "通常攻撃", power: 4 + add, icon: "!" };\n}\n\nfunction groupRank(count: number) {'''
replace_between("function enemyForStage(stage: number): EnemyDef {", "function groupRank(count: number) {", intent_block, "chapter intents")

replace_once(
    '''function disruptBoard(current: Tile[]): Tile[] {\n  const candidates = current.filter((tile) => tile.row >= 0);\n  if (candidates.length < 2) return current;\n  const chosen = [...candidates].sort(() => Math.random() - 0.5).slice(0, 2);\n  const ids = new Set(chosen.map((tile) => tile.id));\n  return current.map((tile) => ids.has(tile.id) ? { ...tile, type: weightedType() } : tile);\n}\n''',
    '''function disruptBoard(current: Tile[], amount = 2): Tile[] {\n  const candidates = current.filter((tile) => tile.row >= 0);\n  if (candidates.length < 2) return current;\n  const chosen = [...candidates].sort(() => Math.random() - 0.5).slice(0, Math.min(amount, candidates.length));\n  const ids = new Set(chosen.map((tile) => tile.id));\n  return current.map((tile) => ids.has(tile.id) ? { ...tile, type: weightedType() } : tile);\n}\n''',
    "boss disrupt",
)

replace_once(
    '  const [bestGroup, setBestGroup] = useState(1);\n  const [fx, setFx] = useState<FxState | null>(null);\n',
    '  const [bestGroup, setBestGroup] = useState(1);\n  const [build, setBuild] = useState<RewardId[]>([]);\n  const [rewardChoices, setRewardChoices] = useState<RewardId[]>([]);\n  const [rewardPicked, setRewardPicked] = useState<RewardId | null>(null);\n  const [fx, setFx] = useState<FxState | null>(null);\n',
    "reward state",
)

replace_once(
    '''  const enemy = enemyForStage(stage);\n  const maxEnemyHp = enemyMaxHp(stage);\n  const intent = enemyIntent(stage, enemyStep, enemy);\n  const nextIntent = enemyIntent(stage, enemyStep + 1, enemy);\n''',
    '''  const currentStage = enemyForStage(stage);\n  const enemy = currentStage;\n  const maxEnemyHp = enemyMaxHp(stage);\n  const intent = enemyIntent(stage, enemyStep, currentStage);\n  const nextIntent = enemyIntent(stage, enemyStep + 1, currentStage);\n''',
    "stage derivation",
)

replace_once(
    '''  const isDanger = !isCritical && (playerHp <= 9 || (enemyDelay === 0 && incomingHpDamage >= Math.ceil(playerHp * 0.6)));\n\n  function resetRun() {\n''',
    '''  const isDanger = !isCritical && (playerHp <= 9 || (enemyDelay === 0 && incomingHpDamage >= Math.ceil(playerHp * 0.6)));\n  const ownedBuildDefs = build.map(rewardDef);\n\n  function resetRun() {\n''',
    "owned build defs",
)

replace_once(
    '''    setBestGroup(1);\n    setGameOver(false);\n''',
    '''    setBestGroup(1);\n    setBuild([]);\n    setRewardChoices([]);\n    setRewardPicked(null);\n    setGameOver(false);\n''',
    "reset build",
)

replace_once(
    '''  function nextStage() {\n    const next = stage + 1;\n    setStage(next);\n    setEnemyHp(enemyMaxHp(next));\n    setEnemyStep(0);\n    setEnemyDelay(0);\n    setTurn(1);\n    setPlayerHp((hp) => Math.min(PLAYER_MAX_HP, hp + 3));\n    setStageClear(false);\n    setStageIntro(true);\n    setPreview(null);\n    setFx(null);\n    setFeedback([]);\n    setMessage(`STAGE ${next}`);\n  }\n''',
    '''  function nextStage() {\n    if (stage >= CHAPTER_LENGTH) return;\n    const next = stage + 1;\n    setStage(next);\n    setEnemyHp(enemyMaxHp(next));\n    setEnemyStep(0);\n    setEnemyDelay(0);\n    setTurn(1);\n    setPlayerHp((hp) => Math.min(PLAYER_MAX_HP, hp + 3));\n    setStageClear(false);\n    setStageIntro(true);\n    setRewardChoices([]);\n    setRewardPicked(null);\n    setPreview(null);\n    setFx(null);\n    setFeedback([]);\n    setMessage(`CHAPTER 1 • STAGE ${next}/${CHAPTER_LENGTH}`);\n  }\n\n  function chooseReward(id: RewardId) {\n    if (rewardPicked || !rewardChoices.includes(id)) return;\n    primeAudio();\n    playSfx("uiConfirm");\n    setBuild((current) => current.includes(id) ? current : [...current, id]);\n    setRewardPicked(id);\n    setMessage(`BUILD ACQUIRED • ${rewardDef(id).name}`);\n  }\n''',
    "next stage and reward pick",
)

effect_block = '''    let nextEnemyHp = enemyHp;\n    let nextPlayerHp = playerHp;\n    let nextBarrier = barrier;\n    let nextDelay = enemyDelay;\n    const spanColumns = new Set(group.map((tile) => tile.col)).size;\n    const focusBonus = build.includes("deepFocus") && count >= 8 ? 2 : 0;\n    const wideBonus = build.includes("wideBreak") && spanColumns >= 3 ? 2 : 0;\n    const coreBonus = focusBonus + wideBonus;\n\n    if (currentSeed.type === "attack") {\n      let damage = count + coreBonus;\n      if (build.includes("berserker") && count >= 6) damage += 3;\n      if (build.includes("finisher") && enemyHp <= Math.ceil(maxEnemyHp / 2)) damage += 3;\n      if (build.includes("redline") && playerHp <= 8) damage += 3;\n      if (build.includes("tempoBlade") && enemyDelay > 0) damage += 2;\n      const buildBonus = Math.max(0, damage - count);\n      nextEnemyHp = Math.max(0, enemyHp - damage);\n      setEnemyHp(nextEnemyHp);\n      setMessage(`ATK ×${count} → ${damage} DAMAGE${buildBonus > 0 ? ` • BUILD +${buildBonus}` : ""}`);\n      showFeedback("enemy", `-${damage}`, "loss");\n      playSfx("playerAttack");\n    } else if (currentSeed.type === "heal") {\n      let healPower = count + coreBonus;\n      if (build.includes("fieldMedic") && count >= 6) healPower += 3;\n      const healed = Math.min(PLAYER_MAX_HP, playerHp + healPower);\n      const actual = healed - playerHp;\n      const excess = Math.max(0, healPower - actual);\n      nextPlayerHp = healed;\n      setPlayerHp(nextPlayerHp);\n      let bonusBarrier = 0;\n      if (build.includes("vitalGuard") && count >= 6) bonusBarrier += 2;\n      if (build.includes("overheal")) bonusBarrier += excess;\n      const shielded = Math.min(BARRIER_MAX, nextBarrier + bonusBarrier);\n      const actualBarrier = shielded - nextBarrier;\n      nextBarrier = shielded;\n      if (actualBarrier > 0) {\n        setBarrier(nextBarrier);\n        showFeedback("barrier", `+${actualBarrier} BAR`, "gain");\n      }\n      setMessage(`HEAL ×${count} → HP +${actual}${actualBarrier > 0 ? ` • BAR +${actualBarrier}` : ""}`);\n      showFeedback("hp", actual > 0 ? `+${actual} HP` : "HP FULL", actual > 0 ? "gain" : "special");\n      playSfx("heal");\n    } else if (currentSeed.type === "barrier") {\n      let barrierPower = count + coreBonus;\n      if (build.includes("fortress") && count >= 6) barrierPower += 3;\n      if (build.includes("lastStand") && playerHp <= 8) barrierPower += 4;\n      const shielded = Math.min(BARRIER_MAX, barrier + barrierPower);\n      const actual = shielded - barrier;\n      nextBarrier = shielded;\n      setBarrier(nextBarrier);\n      setMessage(`BAR ×${count} → BARRIER +${actual}${barrierPower > count ? ` • BUILD +${barrierPower - count}` : ""}`);\n      showFeedback("barrier", actual > 0 ? `+${actual} BAR` : "BAR MAX", actual > 0 ? "gain" : "special");\n      playSfx("shield");\n    } else {\n      const extraFree = build.includes("timeThief") && count >= 4 ? 1 : 0;\n      nextDelay += count + extraFree;\n      const granted = Math.max(0, count - 1 + extraFree);\n      setMessage(`SKIP ×${count} → ${granted} FREE MOVE${granted === 1 ? "" : "S"}${extraFree > 0 ? " • TIME THIEF +1" : ""}`);\n      showFeedback("free", `+${granted} FREE`, "special");\n      playSfx(count >= 6 ? "skill" : "setup");\n    }\n\n    const coolingActive ='''
replace_between("    let nextEnemyHp = enemyHp;", "    const coolingActive =", effect_block, "build effects")

replace_once(
    '''    if (nextEnemyHp <= 0) {\n      playSfx("enemyBreak");\n      await delay(330);\n      playSfx("stageClear");\n      setStageClear(true);\n      setResolving(false);\n      return;\n    }\n''',
    '''    if (nextEnemyHp <= 0) {\n      playSfx("enemyBreak");\n      await delay(330);\n      playSfx("stageClear");\n      if (stage < CHAPTER_LENGTH) {\n        setRewardChoices(drawRewardChoices(build));\n        setRewardPicked(null);\n      } else {\n        setRewardChoices([]);\n        setRewardPicked(null);\n      }\n      setStageClear(true);\n      setResolving(false);\n      return;\n    }\n''',
    "battle reward trigger",
)

replace_once(
    '''    if (currentIntent.kind === "disrupt") {\n      setTiles((current) => disruptBoard(current));\n      showFeedback("enemy", "SHIFT!", "special");\n      setMessage((text) => `${text} • 2 PANELS SHIFT`);\n    }\n''',
    '''    if (currentIntent.kind === "disrupt") {\n      const shiftCount = currentStage.boss ? 3 : 2;\n      setTiles((current) => disruptBoard(current, shiftCount));\n      showFeedback("enemy", currentStage.boss ? "COLLAPSE!" : "SHIFT!", "special");\n      setMessage((text) => `${text} • ${shiftCount} PANELS SHIFT`);\n    }\n''',
    "boss shift count",
)

replace_once(
    '''        <div className={styles.titleSub}>CLUSTER BREAK TACTICAL BATTLE</div>\n''',
    '''        <div className={styles.titleSub}>CHAPTER 1 • {CHAPTER_TITLE}</div>\n''',
    "title chapter",
)
replace_once(
    '''          <span>大きなSKIP塊なら、敵を止めて一気に攻められる。</span>\n''',
    '''          <span>10 BATTLES • 勝つたび3つのBUILDから1つ選ぶ。</span>\n          <span>BUILDの組み合わせで、同じ盤面の価値が変わる。</span>\n''',
    "title reward rules",
)

replace_once(
    '''      <header className={styles.topBar}>\n        <div><span>TACTICAL CLUSTER BREAK</span><strong>STAGE {stage}</strong></div>\n        <div className={styles.turnBox}>TURN {String(turn).padStart(2, "0")}</div>\n      </header>\n''',
    '''      <header className={styles.topBar}>\n        <div><span>CHAPTER 1 • {CHAPTER_TITLE}</span><strong>STAGE {stage}/{CHAPTER_LENGTH}{currentStage.boss ? " • BOSS" : currentStage.elite ? " • ELITE" : ""}</strong></div>\n        <div className={styles.turnBox}>TURN {String(turn).padStart(2, "0")} • BUILD {build.length}</div>\n      </header>\n''',
    "chapter header",
)

replace_once(
    '''            <span>STAGE {stage}</span>\n            <img src={PIXEL_ART_ASSETS.enemies[enemy.kind]} alt="" fetchPriority="high" />\n''',
    '''            <span>CHAPTER 1 • STAGE {stage}/{CHAPTER_LENGTH}</span>\n            {currentStage.boss ? <b className={chapter.encounterBadge}>CHAPTER BOSS</b> : currentStage.elite ? <b className={chapter.encounterBadge}>ELITE</b> : null}\n            <img src={PIXEL_ART_ASSETS.enemies[enemy.kind]} alt="" fetchPriority="high" />\n''',
    "stage intro chapter badge",
)
replace_once(
    '''            <div className={styles.hint}><b>HINT</b>{enemy.hint}</div>\n            <button type="button" onClick={(event) => { event.stopPropagation(); beginStage(); }}>▶ BATTLE START</button>\n''',
    '''            <div className={styles.hint}><b>HINT</b>{enemy.hint}</div>\n            <div className={chapter.buildCounter}>CURRENT BUILD {build.length}</div>\n            <button type="button" onClick={(event) => { event.stopPropagation(); beginStage(); }}>▶ BATTLE START</button>\n''',
    "intro build counter",
)

reward_overlay = '''      {stageClear ? (\n        <div className={styles.overlay} role="dialog" aria-label="Stage Clear">\n          <div className={`${styles.clearCard} ${chapter.rewardCard}`}>\n            {stage >= CHAPTER_LENGTH ? (\n              <>\n                <span>CHAPTER 1</span>\n                <strong>CHAPTER CLEAR!</strong>\n                <div className={chapter.chapterName}>{CHAPTER_TITLE}</div>\n                <p>10 BATTLES COMPLETE • BEST ×{bestGroup}</p>\n                <div className={chapter.buildTitle}>FINAL BUILD • {build.length}</div>\n                <div className={chapter.buildSummary}>\n                  {ownedBuildDefs.map((reward) => <i key={reward.id} data-tag={reward.tag}>{reward.name}</i>)}\n                </div>\n                <button type="button" onClick={resetRun}>▶ NEW RUN</button>\n              </>\n            ) : !rewardPicked ? (\n              <>\n                <span>STAGE {stage}/{CHAPTER_LENGTH} CLEAR</span>\n                <strong>CHOOSE 1 BUILD</strong>\n                <p className={chapter.rewardLead}>次の戦いのルールを変える報酬</p>\n                <div className={chapter.rewardGrid}>\n                  {rewardChoices.map((id) => {\n                    const reward = rewardDef(id);\n                    return (\n                      <button\n                        key={reward.id}\n                        className={chapter.rewardChoice}\n                        data-tag={reward.tag}\n                        type="button"\n                        aria-label={`Choose reward ${reward.name}`}\n                        onClick={() => chooseReward(reward.id)}\n                      >\n                        <b>{reward.icon}</b>\n                        <span><strong>{reward.name}</strong><small>{reward.description}</small></span>\n                      </button>\n                    );\n                  })}\n                </div>\n                <div className={chapter.buildFooter}>OWNED BUILD {build.length} / 12</div>\n              </>\n            ) : (\n              <>\n                <span>STAGE {stage}/{CHAPTER_LENGTH} CLEAR</span>\n                <strong>BUILD ACQUIRED</strong>\n                <div className={chapter.acquired} data-tag={rewardDef(rewardPicked).tag}>\n                  <b>{rewardDef(rewardPicked).icon}</b>\n                  <span><strong>{rewardDef(rewardPicked).name}</strong><small>{rewardDef(rewardPicked).description}</small></span>\n                </div>\n                <div className={chapter.buildTitle}>CURRENT BUILD • {build.length}</div>\n                <div className={chapter.buildSummary}>\n                  {ownedBuildDefs.map((reward) => <i key={reward.id} data-tag={reward.tag}>{reward.name}</i>)}\n                </div>\n                <p>HP +3して次の敵へ</p>\n                <button type="button" onClick={nextStage}>▶ NEXT STAGE</button>\n              </>\n            )}\n          </div>\n        </div>\n      ) : null}\n\n'''
replace_between("      {stageClear ? (", "      {gameOver ? (", reward_overlay + "      {gameOver ? (", "reward overlay")

replace_once(
    '''            <p>STAGE {stage} • BEST ×{bestGroup}</p>\n''',
    '''            <p>STAGE {stage}/{CHAPTER_LENGTH} • BUILD {build.length} • BEST ×{bestGroup}</p>\n''',
    "game over chapter summary",
)

PATH.write_text(text)

css = r'''.rewardCard {\n  width: min(94vw, 390px);\n  max-height: calc(100dvh - 18px);\n  overflow-y: auto;\n  overscroll-behavior: contain;\n}\n\n.chapterName {\n  margin: -2px 0 6px;\n  color: #ffe56c;\n  font: 1000 11px/1.2 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;\n  letter-spacing: 1px;\n}\n\n.encounterBadge, .buildCounter {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  align-self: center;\n  min-height: 18px;\n  padding: 2px 7px;\n  border: 2px solid #ffe56c;\n  background: #09090d;\n  color: #ffe56c;\n  font: 1000 8px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;\n  letter-spacing: .7px;\n}\n\n.buildCounter {\n  border-color: #80eaff;\n  color: #80eaff;\n}\n\n.rewardLead {\n  margin: 2px 0 6px !important;\n  color: #d9dded;\n  font-size: 10px !important;\n}\n\n.rewardGrid {\n  display: grid;\n  gap: 6px;\n  width: 100%;\n  margin: 4px 0 7px;\n}\n\n.rewardChoice {\n  appearance: none;\n  display: grid !important;\n  grid-template-columns: 46px minmax(0, 1fr);\n  align-items: center;\n  gap: 8px;\n  width: 100%;\n  min-height: 58px;\n  margin: 0 !important;\n  padding: 6px 8px !important;\n  border: 3px solid #8c93a8 !important;\n  background: #08090f !important;\n  color: #fff !important;\n  text-align: left;\n  box-shadow: inset 0 0 0 2px #171924, 3px 3px 0 #000 !important;\n}\n.rewardChoice > b, .acquired > b {\n  display: grid;\n  place-items: center;\n  width: 42px;\n  min-height: 38px;\n  border: 2px solid currentColor;\n  background: #11131c;\n  font: 1000 11px/1 ui-monospace, monospace;\n}\n.rewardChoice > span, .acquired > span {\n  display: grid;\n  gap: 3px;\n  min-width: 0;\n}\n.rewardChoice > span > strong, .acquired > span > strong {\n  font: 1000 11px/1 ui-monospace, monospace !important;\n  letter-spacing: .5px;\n}\n.rewardChoice small, .acquired small {\n  color: #d7dae5;\n  font: 800 8px/1.35 ui-monospace, monospace;\n  white-space: normal;\n}\n.rewardChoice:active {\n  transform: translate(2px, 2px);\n  box-shadow: inset 0 0 0 2px #171924, 1px 1px 0 #000 !important;\n}\n\n.rewardChoice[data-tag="ATK"], .acquired[data-tag="ATK"] { color: #ff755f !important; border-color: #ff755f !important; }\n.rewardChoice[data-tag="HEAL"], .acquired[data-tag="HEAL"] { color: #ff77c8 !important; border-color: #ff77c8 !important; }\n.rewardChoice[data-tag="BAR"], .acquired[data-tag="BAR"] { color: #6ee8ff !important; border-color: #6ee8ff !important; }\n.rewardChoice[data-tag="SKIP"], .acquired[data-tag="SKIP"] { color: #ffe56c !important; border-color: #ffe56c !important; }\n.rewardChoice[data-tag="CORE"], .acquired[data-tag="CORE"] { color: #c69bff !important; border-color: #c69bff !important; }\n\n.acquired {\n  display: grid;\n  grid-template-columns: 46px minmax(0, 1fr);\n  align-items: center;\n  gap: 8px;\n  width: 100%;\n  margin: 6px 0 8px;\n  padding: 7px 8px;\n  border: 3px solid currentColor;\n  background: #08090f;\n  text-align: left;\n}\n\n.buildTitle, .buildFooter {\n  margin: 5px 0 4px;\n  color: #aeb4ca;\n  font: 1000 7px/1 ui-monospace, monospace;\n  letter-spacing: .7px;\n}\n\n.buildSummary {\n  display: flex;\n  flex-wrap: wrap;\n  justify-content: center;\n  gap: 4px;\n  width: 100%;\n  margin-bottom: 7px;\n}\n.buildSummary i {\n  padding: 3px 5px;\n  border: 1px solid #73798d;\n  background: #0a0b11;\n  color: #dfe3f2;\n  font: 900 6px/1 ui-monospace, monospace;\n  font-style: normal;\n  letter-spacing: .2px;\n}\n.buildSummary i[data-tag="ATK"] { border-color: #ff755f; color: #ff9c8d; }\n.buildSummary i[data-tag="HEAL"] { border-color: #ff77c8; color: #ffaddd; }\n.buildSummary i[data-tag="BAR"] { border-color: #6ee8ff; color: #a9f2ff; }\n.buildSummary i[data-tag="SKIP"] { border-color: #ffe56c; color: #fff0a3; }\n.buildSummary i[data-tag="CORE"] { border-color: #c69bff; color: #dec4ff; }\n\n@media (max-height: 720px) {\n  .rewardCard { padding-top: 9px !important; padding-bottom: 9px !important; }\n  .rewardChoice { min-height: 52px; padding: 5px 7px !important; }\n  .rewardChoice > b, .acquired > b { min-height: 34px; }\n}\n'''
Path("app/PuzzleRPGChapter1.module.css").write_text(css)
print("Chapter 1 + Battle Reward / Build System applied")
