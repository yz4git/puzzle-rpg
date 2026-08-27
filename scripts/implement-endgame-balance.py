from pathlib import Path

p = Path('app/PuzzleRPGClusterBreak.tsx')
s = p.read_text()

repls = {
'''  {
    kind: "warden", name: "VOID HERALD", hp: 48, powerBonus: 1, elite: true,
    quote: "止めた時間ごと、砕いてみせる。",
    hint: "前半より攻撃が重い。SKIPで作ったFREE中にATK塊を完成させる。",
    passive: "強化VOID CRUSHを使用。FREEを攻撃準備に変える判断が重要。",
  },
''': '''  {
    kind: "warden", name: "VOID HERALD", hp: 46, powerBonus: 1, elite: true,
    quote: "止めた時間ごと、砕いてみせる。",
    hint: "VOID CRUSH後はSKIPが1枚封印される。FREE中に次のSKIP塊も育てておく。",
    passive: "VOID CRUSH 7。命中後、盤面のSKIPを1枚ATKへ封印する。",
  },
''',
'''  {
    kind: "bastion", name: "IRON TYRANT", hp: 54, powerBonus: 1, elite: true,
    quote: "守り切れるか。それとも先に砕くか。",
    hint: "IRON CRUSHに備えてBARを作るか、ATKでレースを仕掛けるか選ぶ。",
    passive: "高耐久＋強化重撃。ビルドの得意色を大きく育てたい。",
  },
''': '''  {
    kind: "bastion", name: "IRON TYRANT", hp: 52, powerBonus: 1, elite: true,
    quote: "守り切れるか。それとも先に砕くか。",
    hint: "ATK×4以下はIRON ARMORで2軽減。×5以上を作るかBUILDボーナスで押し切る。",
    passive: "SHIELD BASH 5 / IRON CRUSH 7。小ATKだけ2軽減する装甲を持つ。",
  },
''',
'''  {
    kind: "oracle", name: "SCARLET ORACLE", hp: 60, powerBonus: 1, elite: true,
    quote: "その回復さえ、血に変えてあげる。",
    hint: "DRAINを受ける前にBARかSKIP。HEALビルドなら回復超過も活用できる。",
    passive: "強化DRAIN。防ぐ・遅らせる・先に削るの三択を迫る。",
  },
''': '''  {
    kind: "oracle", name: "SCARLET ORACLE", hp: 56, powerBonus: 1, elite: true,
    quote: "その回復さえ、血に変えてあげる。",
    hint: "BLOOD DRAINをHPへ通すと、受けた分＋2だけ敵が回復する。BARかSKIPで完全阻止したい。",
    passive: "BLOOD NEEDLE 5 / BLOOD DRAIN 6。DRAIN成立時は追加で2HP吸収する。",
  },
''',
'''  {
    kind: "null", name: "NULL EXECUTIONER", hp: 66, powerBonus: 2, elite: true,
    quote: "盾は数えない。残る命だけを数える。",
    hint: "PIERCE直前はBARだけに頼らずHPを確保。FREE中のATKボーナスも有効。",
    passive: "強化PIERCE。終盤ビルドの弱点を突く処刑戦。",
  },
''': '''  {
    kind: "null", name: "NULL EXECUTIONER", hp: 62, powerBonus: 2, elite: true,
    quote: "盾は数えない。残る命だけを数える。",
    hint: "HP8以下ではNULL PIERCEが+2。BARでは防げないので、HEALかSKIPを優先する。",
    passive: "NULL SLASH 6 / NULL PIERCE 7。HP8以下ではEXECUTEが発動しPIERCE 9。",
  },
''',
'''  {
    kind: "trickster", name: "PRISM SOVEREIGN", hp: 78, powerBonus: 2, boss: true,
    quote: "十の戦いで得た答えを、すべて見せて。",
    hint: "BOSSは2回に1回PRISM COLLAPSE。3枚変色する前に大塊を使う判断も必要。",
    passive: "CHAPTER BOSS。高頻度の盤面変色と重い攻撃で完成したビルドを試す。",
  },
''': '''  {
    kind: "trickster", name: "PRISM SOVEREIGN", hp: 72, powerBonus: 0, boss: true,
    quote: "十の戦いで得た答えを、すべて見せて。",
    hint: "HP50%・25%でPHASE UP。RAYとCOLLAPSEが+1され、変色枚数も2→3→4へ増える。",
    passive: "PHASE I: 5/7＋2枚変色。HP50%で6/8＋3枚、HP25%で7/9＋4枚へ強化。",
  },
'''
}
for old,new in repls.items():
    if old not in s:
        raise SystemExit('missing stage block')
    s=s.replace(old,new)

old = '''function enemyIntent(stage: number, step: number, enemy: StageDef): Intent {
  const add = enemy.powerBonus;
  if (enemy.kind === "warden") {
    return step % 3 === 1
      ? { kind: "heavy", label: "VOID CRUSH", detail: "重撃", power: 6 + add, icon: "!!" }
      : { kind: "attack", label: "VOID BOLT", detail: "通常攻撃", power: 4 + add, icon: "!" };
  }
  if (enemy.kind === "bastion") {
    return step % 2 === 1
      ? { kind: "heavy", label: "IRON CRUSH", detail: "重撃", power: 6 + add, icon: "!!" }
      : { kind: "attack", label: "SHIELD BASH", detail: "通常攻撃", power: 4 + add, icon: "!" };
  }
  if (enemy.kind === "oracle") {
    return step % 3 === 1
      ? { kind: "drain", label: "BLOOD DRAIN", detail: "HP被害分を吸収", power: 5 + add, icon: "+" }
      : { kind: "attack", label: "BLOOD NEEDLE", detail: "通常攻撃", power: 4 + add, icon: "!" };
  }
  if (enemy.kind === "null") {
    return step % 2 === 1
      ? { kind: "pierce", label: "NULL PIERCE", detail: "BARRIER無視", power: 5 + add, icon: ">>" }
      : { kind: "attack", label: "NULL SLASH", detail: "通常攻撃", power: 4 + add, icon: "!" };
  }
  if (enemy.boss) {
    return step % 2 === 1
      ? { kind: "disrupt", label: "PRISM COLLAPSE", detail: "攻撃＋3枚変色", power: 7 + add, icon: "<>" }
      : { kind: "attack", label: "PRISM RAY", detail: "通常攻撃", power: 5 + add, icon: "!" };
  }
  return step % 3 === 1
    ? { kind: "disrupt", label: "PRISM SHIFT", detail: "攻撃＋2枚変色", power: 5 + add, icon: "<>" }
    : { kind: "attack", label: "PRISM HIT", detail: "通常攻撃", power: 4 + add, icon: "!" };
}
'''
new = '''function bossPhaseBonus(enemyRatio: number) {
  if (enemyRatio <= 0.25) return 2;
  if (enemyRatio <= 0.5) return 1;
  return 0;
}

function bossShiftCount(enemyRatio: number) {
  return 2 + bossPhaseBonus(enemyRatio);
}

function enemyIntent(stage: number, step: number, enemy: StageDef, playerHp = PLAYER_MAX_HP, enemyRatio = 1): Intent {
  const add = enemy.powerBonus;
  if (enemy.kind === "warden") {
    return step % 3 === 1
      ? { kind: "heavy", label: "VOID CRUSH", detail: stage === 6 ? "重撃＋SKIP封印" : "重撃", power: 6 + add, icon: "!!" }
      : { kind: "attack", label: "VOID BOLT", detail: "通常攻撃", power: 4 + add, icon: "!" };
  }
  if (enemy.kind === "bastion") {
    return step % 2 === 1
      ? { kind: "heavy", label: "IRON CRUSH", detail: "重撃", power: 6 + add, icon: "!!" }
      : { kind: "attack", label: "SHIELD BASH", detail: "通常攻撃", power: 4 + add, icon: "!" };
  }
  if (enemy.kind === "oracle") {
    return step % 3 === 1
      ? { kind: "drain", label: "BLOOD DRAIN", detail: stage === 8 ? "HP被害＋2を吸収" : "HP被害分を吸収", power: 5 + add, icon: "+" }
      : { kind: "attack", label: "BLOOD NEEDLE", detail: "通常攻撃", power: 4 + add, icon: "!" };
  }
  if (enemy.kind === "null") {
    const executeBonus = stage === 9 && playerHp <= 8 ? 2 : 0;
    return step % 2 === 1
      ? { kind: "pierce", label: "NULL PIERCE", detail: executeBonus > 0 ? "EXECUTE • BARRIER無視" : "BARRIER無視", power: 5 + add + executeBonus, icon: ">>" }
      : { kind: "attack", label: "NULL SLASH", detail: "通常攻撃", power: 4 + add, icon: "!" };
  }
  if (enemy.boss) {
    const phaseBonus = bossPhaseBonus(enemyRatio);
    const shiftCount = bossShiftCount(enemyRatio);
    return step % 2 === 1
      ? { kind: "disrupt", label: "PRISM COLLAPSE", detail: `攻撃＋${shiftCount}枚変色`, power: 7 + add + phaseBonus, icon: "<>" }
      : { kind: "attack", label: "PRISM RAY", detail: phaseBonus > 0 ? `PHASE ${phaseBonus + 1}` : "通常攻撃", power: 5 + add + phaseBonus, icon: "!" };
  }
  return step % 3 === 1
    ? { kind: "disrupt", label: "PRISM SHIFT", detail: "攻撃＋2枚変色", power: 5 + add, icon: "<>" }
    : { kind: "attack", label: "PRISM HIT", detail: "通常攻撃", power: 4 + add, icon: "!" };
}
'''
if old not in s: raise SystemExit('enemyIntent block missing')
s=s.replace(old,new)

old='''function disruptBoard(current: Tile[], amount = 2): Tile[] {
  const candidates = current.filter((tile) => tile.row >= 0);
  if (candidates.length < 2) return current;
  const chosen = [...candidates].sort(() => Math.random() - 0.5).slice(0, Math.min(amount, candidates.length));
  const ids = new Set(chosen.map((tile) => tile.id));
  return current.map((tile) => ids.has(tile.id) ? { ...tile, type: weightedType() } : tile);
}
'''
new='''function disruptBoard(current: Tile[], amount = 2): Tile[] {
  const candidates = current.filter((tile) => tile.row >= 0);
  if (candidates.length < 2) return current;
  const chosen = [...candidates].sort(() => Math.random() - 0.5).slice(0, Math.min(amount, candidates.length));
  const ids = new Set(chosen.map((tile) => tile.id));
  return current.map((tile) => ids.has(tile.id) ? { ...tile, type: weightedType() } : tile);
}

function convertRandomPanelType(current: Tile[], from: PanelType, to: PanelType, amount = 1): Tile[] {
  const candidates = current.filter((tile) => tile.row >= 0 && tile.type === from);
  if (candidates.length === 0) return current;
  const chosen = [...candidates].sort(() => Math.random() - 0.5).slice(0, Math.min(amount, candidates.length));
  const ids = new Set(chosen.map((tile) => tile.id));
  return current.map((tile) => ids.has(tile.id) ? { ...tile, type: to } : tile);
}
'''
if old not in s: raise SystemExit('disrupt block missing')
s=s.replace(old,new)

old='''  const intent = enemyIntent(stage, enemyStep, currentStage);
  const nextIntent = enemyIntent(stage, enemyStep + 1, currentStage);
'''
new='''  const enemyRatio = maxEnemyHp > 0 ? enemyHp / maxEnemyHp : 1;
  const intent = enemyIntent(stage, enemyStep, currentStage, playerHp, enemyRatio);
  const nextIntent = enemyIntent(stage, enemyStep + 1, currentStage, playerHp, enemyRatio);
'''
if old not in s: raise SystemExit('intent calls missing')
s=s.replace(old,new)

old='''    if (currentSeed.type === "attack") {
      let damage = count + coreBonus;
      if (build.includes("berserker") && count >= 6) damage += 3;
      if (build.includes("finisher") && enemyHp <= Math.ceil(maxEnemyHp / 2)) damage += 3;
      if (build.includes("redline") && playerHp <= 8) damage += 3;
      if (build.includes("tempoBlade") && enemyDelay > 0) damage += 2;
      const buildBonus = Math.max(0, damage - count);
      nextEnemyHp = Math.max(0, enemyHp - damage);
      setEnemyHp(nextEnemyHp);
      setMessage(`ATK ×${count} → ${damage} DAMAGE${buildBonus > 0 ? ` • BUILD +${buildBonus}` : ""}`);
      showFeedback("enemy", `-${damage}`, "loss");
      playSfx("playerAttack");
'''
new='''    if (currentSeed.type === "attack") {
      let damage = count + coreBonus;
      if (build.includes("berserker") && count >= 6) damage += 3;
      if (build.includes("finisher") && enemyHp <= Math.ceil(maxEnemyHp / 2)) damage += 3;
      if (build.includes("redline") && playerHp <= 8) damage += 3;
      if (build.includes("tempoBlade") && enemyDelay > 0) damage += 2;
      const preArmorDamage = damage;
      const buildBonus = Math.max(0, preArmorDamage - count);
      const armorReduction = stage === 7 && count < 5 ? Math.min(2, Math.max(0, damage - 1)) : 0;
      damage -= armorReduction;
      nextEnemyHp = Math.max(0, enemyHp - damage);
      setEnemyHp(nextEnemyHp);
      setMessage(`ATK ×${count} → ${damage} DAMAGE${buildBonus > 0 ? ` • BUILD +${buildBonus}` : ""}${armorReduction > 0 ? ` • IRON ARMOR -${armorReduction}` : ""}`);
      showFeedback("enemy", armorReduction > 0 ? `-${damage} • ARMOR` : `-${damage}`, "loss");
      playSfx("playerAttack");
'''
if old not in s: raise SystemExit('attack block missing')
s=s.replace(old,new)

old='''    const currentIntent = intent;
'''
new='''    const currentIntent = enemyIntent(stage, enemyStep, currentStage, nextPlayerHp, enemyRatio);
'''
if old not in s: raise SystemExit('currentIntent missing')
s=s.replace(old,new,1)

old='''    if (currentIntent.kind === "drain" && hpDamage > 0) {
      const healed = Math.min(maxEnemyHp, nextEnemyHp + hpDamage);
      setEnemyHp(healed);
      nextEnemyHp = healed;
      showFeedback("enemy", `+${hpDamage} HP`, "gain");
      setMessage((text) => `${text} • DRAIN +${hpDamage}`);
    }
    if (currentIntent.kind === "disrupt") {
      const shiftCount = currentStage.boss ? 3 : 2;
      setTiles((current) => disruptBoard(current, shiftCount));
      showFeedback("enemy", currentStage.boss ? "COLLAPSE!" : "SHIFT!", "special");
      setMessage((text) => `${text} • ${shiftCount} PANELS SHIFT`);
    }
'''
new='''    if (currentIntent.kind === "drain" && hpDamage > 0) {
      const drainBonus = stage === 8 ? 2 : 0;
      const drainHeal = hpDamage + drainBonus;
      const healed = Math.min(maxEnemyHp, nextEnemyHp + drainHeal);
      const actualDrain = healed - nextEnemyHp;
      setEnemyHp(healed);
      nextEnemyHp = healed;
      showFeedback("enemy", `+${actualDrain} HP`, "gain");
      setMessage((text) => `${text} • DRAIN +${actualDrain}${drainBonus > 0 ? " • SCARLET +2" : ""}`);
    }
    if (stage === 6 && currentIntent.kind === "heavy") {
      setTiles((current) => convertRandomPanelType(current, "skip", "attack", 1));
      showFeedback("enemy", "VOID SEAL", "special");
      setMessage((text) => `${text} • 1 SKIP SEALED`);
    }
    if (currentIntent.kind === "disrupt") {
      const shiftCount = currentStage.boss ? bossShiftCount(enemyRatio) : 2;
      setTiles((current) => disruptBoard(current, shiftCount));
      showFeedback("enemy", currentStage.boss ? `PHASE ${bossPhaseBonus(enemyRatio) + 1}` : "SHIFT!", "special");
      setMessage((text) => `${text} • ${shiftCount} PANELS SHIFT`);
    }
'''
if old not in s: raise SystemExit('drain/disrupt block missing')
s=s.replace(old,new)

p.write_text(s)
print('endgame balance patch applied')
