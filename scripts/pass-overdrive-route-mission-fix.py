from pathlib import Path

TSX=Path('app/PrismOverdrive.tsx')
CSS=Path('app/PrismOverdrive.module.css')

def repl(path, old, new):
    text=path.read_text()
    if old not in text:
        raise SystemExit(f'anchor missing in {path}: {old[:160]!r}')
    path.write_text(text.replace(old,new,1))

# Resolution / TIME STOP are gameplay pauses. Freeze the combo deadline too,
# otherwise long readable cascade animations can break a combo while input is disabled.
repl(TSX,
'''      const delta = Math.min(250, current - lastTickRef.current);
      lastTickRef.current = current;
      if (current < timeStopUntilRef.current || resolvingRef.current) return;
      timeRef.current = Math.max(0, timeRef.current - delta);''',
'''      const delta = Math.min(250, current - lastTickRef.current);
      lastTickRef.current = current;
      if (current < timeStopUntilRef.current || resolvingRef.current) {
        if (comboRef.current > 0 && comboExpireRef.current > 0) comboExpireRef.current += delta;
        return;
      }
      timeRef.current = Math.max(0, timeRef.current - delta);''')

# Expose persistent boss-break count to QA and add a compact progress bar.
repl(TSX,
'''      <div className={styles.missionCard} data-boss={bossCoreHp > 0 ? "active" : "idle"}><span>{bossCoreHp > 0 ? "BOSS CORE" : "MISSION STREAK"}</span><strong>{bossCoreHp > 0 ? `HP ${bossCoreHp}/${bossCoreMax}` : `${"◆".repeat(missionStreak)}${"◇".repeat(3-missionStreak)}  ${missionStreak}/3`}</strong><em>{bossCoreHp > 0 ? "RELEASE • ROUTE • CHAIN 2+" : "3 TARGETS WITHOUT COMBO BREAK"}</em></div>''',
'''      <div className={styles.missionCard} data-boss={bossCoreHp > 0 ? "active" : "idle"} data-breaks={bossBreaks}><span>{bossCoreHp > 0 ? "BOSS CORE" : "MISSION STREAK"}</span><strong>{bossCoreHp > 0 ? `HP ${bossCoreHp}/${bossCoreMax}` : `${"◆".repeat(missionStreak)}${"◇".repeat(3-missionStreak)}  ${missionStreak}/3`}</strong><em>{bossCoreHp > 0 ? "RELEASE • ROUTE • CHAIN 2+" : "3 TARGETS WITHOUT COMBO BREAK"}</em><u><i style={{ width: `${bossCoreHp > 0 ? bossCoreHp / Math.max(1, bossCoreMax) * 100 : missionStreak / 3 * 100}%` }} /></u></div>''')

CSS.write_text(CSS.read_text() + r'''

/* PASS 48b — COMBO-FAIR PAUSES / BOSS CORE METER */
.missionCard u{grid-column:1/-1;height:4px;border:1px solid #31264a;background:#090711;text-decoration:none;overflow:hidden}
.missionCard u i{display:block;height:100%;background:#a86cff;box-shadow:0 0 5px #a86cff;transition:width 120ms steps(6,end)}
.missionCard[data-boss="active"] u{border-color:#6a2c1e;background:#130806}
.missionCard[data-boss="active"] u i{background:linear-gradient(90deg,#ff4c2d,#ffd45b);box-shadow:0 0 7px #ff7040}
''')

print('combo pause + boss meter fix applied')
