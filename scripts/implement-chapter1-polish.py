from pathlib import Path

p = Path('app/PuzzleRPGClusterBreak.tsx')
s = p.read_text()

s = s.replace(
'''function makeOpeningBoard(): Tile[] {
  let fallback = buildOpeningCandidate();
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const candidate = attempt === 0 ? fallback : buildOpeningCandidate();
    fallback = candidate;
    const largest = largestGroups(candidate);
    const max = Math.max(...Object.values(largest));
    const counts = TYPES.map((type) => candidate.filter((tile) => tile.type === type).length);
    if (max >= 3 && max <= 5 && counts.every((count) => count >= 3)) return candidate;
  }
  return fallback;
}
''',
'''function makeOpeningBoard(): Tile[] {
  let fallback = buildOpeningCandidate();
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const candidate = attempt === 0 ? fallback : buildOpeningCandidate();
    fallback = candidate;
    const largest = largestGroups(candidate);
    const max = Math.max(...Object.values(largest));
    const counts = TYPES.map((type) => candidate.filter((tile) => tile.type === type).length);
    const hasSkipSetup = largest.skip >= 2;
    const hasDefenseSetup = largest.heal >= 2 || largest.barrier >= 2;
    const hasAttackSetup = largest.attack >= 2;
    if (
      max >= 3 && max <= 5
      && counts.every((count) => count >= 3)
      && hasSkipSetup && hasDefenseSetup && hasAttackSetup
    ) return candidate;
  }
  return fallback;
}
''')

s = s.replace(
'''  const [rewardPicked, setRewardPicked] = useState<RewardId | null>(null);
  const [fx, setFx] = useState<FxState | null>(null);
''',
'''  const [rewardPicked, setRewardPicked] = useState<RewardId | null>(null);
  const [buildOpen, setBuildOpen] = useState(false);
  const [fx, setFx] = useState<FxState | null>(null);
''')

s = s.replace(
'''  const ownedBuildDefs = build.map(rewardDef);

  function resetRun() {
''',
'''  const ownedBuildDefs = build.map(rewardDef);
  const nextEncounter = stage < CHAPTER_LENGTH ? stageDef(stage + 1) : null;
  const nextEncounterIntent = nextEncounter ? enemyIntent(stage + 1, 0, nextEncounter) : null;
  const nextEncounterFollowup = nextEncounter ? enemyIntent(stage + 1, 1, nextEncounter) : null;

  function resetRun() {
''')

s = s.replace(
'''    setRewardChoices([]);
    setRewardPicked(null);
    setGameOver(false);
''',
'''    setRewardChoices([]);
    setRewardPicked(null);
    setBuildOpen(false);
    setGameOver(false);
''', 1)

s = s.replace(
'''    setTurn(1);
    setPlayerHp((hp) => Math.min(PLAYER_MAX_HP, hp + 3));
    setStageClear(false);
''',
'''    setTurn(1);
    setPlayerHp((hp) => Math.min(PLAYER_MAX_HP, hp + 6));
    setBuildOpen(false);
    setStageClear(false);
''')

s = s.replace(
'''  const warningText = isCritical
    ? `!! CRITICAL !! ${enemyDelay > 0 ? `FREE ${enemyDelay}` : `${intent.label} → ${incomingHpDamage} HP`}`
    : isDanger
      ? `! DANGER ! ${enemyDelay > 0 ? `FREE ${enemyDelay}` : `${intent.label} → ${incomingHpDamage} HP`}`
      : "";
  const shellClass = `${styles.shell} ${v2.gameplayRoot} ${isCritical ? styles.critical : isDanger ? styles.danger : ""}`;
''',
'''  const overlayActive = stageIntro || stageClear || gameOver || buildOpen;
  const warningText = overlayActive
    ? ""
    : isCritical
      ? `!! CRITICAL !! ${enemyDelay > 0 ? `FREE ${enemyDelay}` : `${intent.label} → ${incomingHpDamage} HP`}`
      : isDanger
        ? `! DANGER ! ${enemyDelay > 0 ? `FREE ${enemyDelay}` : `${intent.label} → ${incomingHpDamage} HP`}`
        : "";
  const shellClass = `${styles.shell} ${v2.gameplayRoot} ${!overlayActive && isCritical ? styles.critical : !overlayActive && isDanger ? styles.danger : ""}`;
''')

s = s.replace(
'''        <div className={styles.turnBox}>TURN {String(turn).padStart(2, "0")} • BUILD {build.length}</div>
''',
'''        <button
          type="button"
          className={`${styles.turnBox} ${chapter.buildButton}`}
          aria-label="Open Build Details"
          onClick={() => setBuildOpen(true)}
        >TURN {String(turn).padStart(2, "0")} • BUILD {build.length}</button>
''')

s = s.replace(
'''                <strong>CHOOSE 1 BUILD</strong>
                <p className={chapter.rewardLead}>次の戦いのルールを変える報酬</p>
                <div className={chapter.rewardGrid}>
''',
'''                <strong>CHOOSE 1 BUILD</strong>
                {nextEncounter && nextEncounterIntent && nextEncounterFollowup ? (
                  <div className={chapter.nextEncounter}>
                    <img src={PIXEL_ART_ASSETS.enemies[nextEncounter.kind]} alt="" />
                    <span>
                      <small>NEXT ENCOUNTER • STAGE {stage + 1}/{CHAPTER_LENGTH}</small>
                      <strong>{nextEncounter.name}</strong>
                      <em>{nextEncounterIntent.label} {nextEncounterIntent.power} → {nextEncounterFollowup.label} {nextEncounterFollowup.power}</em>
                    </span>
                  </div>
                ) : null}
                <p className={chapter.rewardLead}>次の敵を見て、戦い方を変えるBUILDを1つ選ぶ</p>
                <div className={chapter.rewardGrid}>
''')

s = s.replace('''                <p>HP +3して次の敵へ</p>
''','''                <p>HP +6して次の敵へ</p>
''')

insert = '''\n      {buildOpen ? (\n        <div className={styles.overlay} role="dialog" aria-label="Build Details" onClick={() => setBuildOpen(false)}>\n          <div className={chapter.buildPanel} onClick={(event) => event.stopPropagation()}>\n            <span>RUN BUILD</span>\n            <strong>BUILD {build.length} / 12</strong>\n            {ownedBuildDefs.length > 0 ? (\n              <div className={chapter.buildList}>\n                {ownedBuildDefs.map((reward) => (\n                  <div key={reward.id} data-tag={reward.tag}>\n                    <b>{reward.icon}</b>\n                    <span><strong>{reward.name}</strong><small>{reward.description}</small></span>\n                  </div>\n                ))}\n              </div>\n            ) : <p className={chapter.emptyBuild}>まだBUILDを取得していません。</p>}\n            <button type="button" className={chapter.closeBuild} onClick={() => setBuildOpen(false)}>× CLOSE</button>\n          </div>\n        </div>\n      ) : null}\n'''
needle = '''\n      {gameOver ? (\n'''
if insert.strip() not in s:
    s = s.replace(needle, insert + needle)

p.write_text(s)

css = Path('app/PuzzleRPGChapter1.module.css')
c = css.read_text()
append = r'''

.buildButton {
  appearance: none;
  cursor: pointer;
  color: inherit;
  font: inherit;
  text-align: center;
}
.buildButton:active { transform: translate(1px, 1px); }

.nextEncounter {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  width: 100%;
  margin: 5px 0 3px;
  padding: 5px 7px;
  border: 2px solid #6f7892;
  background: #05060b;
  text-align: left;
  box-shadow: inset 0 0 0 1px #151824;
}
.nextEncounter img {
  width: 42px;
  height: 42px;
  object-fit: contain;
  image-rendering: pixelated;
}
.nextEncounter > span { display: grid; gap: 2px; min-width: 0; }
.nextEncounter small {
  color: #9ba3bd;
  font: 900 6px/1 ui-monospace, monospace;
  letter-spacing: .5px;
}
.nextEncounter strong {
  color: #fff;
  font: 1000 10px/1 ui-monospace, monospace !important;
}
.nextEncounter em {
  color: #ffe56c;
  font: 900 7px/1.2 ui-monospace, monospace;
  font-style: normal;
}

.buildPanel {
  width: min(92vw, 372px);
  max-height: calc(100dvh - 24px);
  overflow-y: auto;
  padding: 14px 12px 12px;
  border: 4px solid #7b8299;
  background: #08090f;
  color: #fff;
  box-shadow: inset 0 0 0 2px #171924, 6px 6px 0 #000;
  text-align: center;
}
.buildPanel > span {
  color: #9ba3bd;
  font: 900 7px/1 ui-monospace, monospace;
  letter-spacing: 1px;
}
.buildPanel > strong {
  display: block;
  margin: 4px 0 10px;
  font: 1000 16px/1 ui-monospace, monospace;
}
.buildList { display: grid; gap: 6px; width: 100%; }
.buildList > div {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  padding: 6px 7px;
  border: 2px solid #73798d;
  background: #0b0c12;
  text-align: left;
}
.buildList > div > b {
  display: grid;
  place-items: center;
  min-height: 32px;
  border: 1px solid currentColor;
  font: 1000 9px/1 ui-monospace, monospace;
}
.buildList > div > span { display: grid; gap: 2px; }
.buildList strong { font: 1000 9px/1 ui-monospace, monospace; }
.buildList small { color: #d7dae5; font: 800 7px/1.25 ui-monospace, monospace; }
.buildList > div[data-tag="ATK"] { border-color: #ff755f; color: #ff9c8d; }
.buildList > div[data-tag="HEAL"] { border-color: #ff77c8; color: #ffaddd; }
.buildList > div[data-tag="BAR"] { border-color: #6ee8ff; color: #a9f2ff; }
.buildList > div[data-tag="SKIP"] { border-color: #ffe56c; color: #fff0a3; }
.buildList > div[data-tag="CORE"] { border-color: #c69bff; color: #dec4ff; }
.emptyBuild { margin: 14px 0; color: #aeb4ca; font-size: 10px; }
.closeBuild { width: 100%; margin-top: 10px !important; }
'''
if '.nextEncounter {' not in c:
    c += append
css.write_text(c)
print('Chapter 1 polish applied')
