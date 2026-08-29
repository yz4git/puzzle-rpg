from pathlib import Path

src = Path('scripts/pass-overdrive-action-clarity.py').read_text()
start = src.index("rep('''      const autoIds = new Set(auto.map((tile) => tile.id));")
end_marker = "''', 'cascade staging')"
end = src.index(end_marker, start) + len(end_marker)
replacement = r'''# Cascade source varies slightly between passes, so replace it by stable boundaries.
cascade_start = s.index("      const autoIds = new Set(auto.map((tile) => tile.id));")
cascade_end_marker = "      await sleep(90);\n    }"
cascade_end = s.index(cascade_end_marker, cascade_start) + len("      await sleep(90);")
cascade_new = '''      const autoIds = new Set(auto.map((tile) => tile.id));
      const autoType = auto[0]!.type;
      comboRef.current += 1; setCombo(comboRef.current); setMaxCombo((value) => Math.max(value, comboRef.current));
      comboExpireRef.current = performance.now() + 2500 + (upgrades.includes("comboCore") ? 900 : 0);
      const autoScore = scoreCluster(autoType, auto.length, depth);
      setFocusIds(autoIds);
      setActionFx({ token: actionFxTokenRef.current++, kind: "cascade", title: `AUTO CASCADE → CHAIN ${depth}!`, detail: `${LABEL[autoType]} ×${auto.length} CONNECTED BY THE DROP`, icon: "↯" });
      setLastRank(`CHAIN ${depth}!`);
      setMessage(`AUTO MATCH FOUND • ${LABEL[autoType]} ×${auto.length} WILL BREAK`);
      playSfx("setup");
      await sleep(420);

      nextScore = addScore(autoScore.points, `CHAIN ${depth}!`);
      setMessage(`CHAIN ${depth} SCORE +${Math.round(autoScore.points).toLocaleString()}`);
      addFever(auto.length * 2.4);
      setFocusIds(new Set());
      setClearingIds(autoIds);
      playSfx("cascade");
      await sleep(220);
      settled = settleBoard(currentTiles, currentQueues, autoIds, performance.now() < feverUntilRef.current);
      currentTiles = settled.tiles; currentQueues = settled.queues;
      setTiles(currentTiles); setQueues(currentQueues); setClearingIds(new Set());
      await sleep(280);'''
s = s[:cascade_start] + cascade_new + s[cascade_end:]'''
patched = src[:start] + replacement + src[end:]
exec(compile(patched, 'pass-overdrive-action-clarity.py', 'exec'), {'__name__': '__main__'})
