from pathlib import Path

rpg = Path("app/rpg/RPGMode.tsx")
text = rpg.read_text()

old_commit = '''  function commit(mutator: (current: RPGSaveData) => RPGSaveData, autosave = false) {
    setSave((current) => {
      const next = mutator(current);
      if (autosave) saveGame(next);
      return next;
    });
  }
'''
new_commit = '''  function commit(mutator: (current: RPGSaveData) => RPGSaveData, autosave = false) {
    setSave((current) => {
      const next = mutator(current);
      // Keep the lifecycle-save ref synchronous with state so an immediate
      // iPhone background/pagehide cannot persist the previous frame.
      saveRef.current = next;
      if (autosave) saveGame(next);
      return next;
    });
  }
'''
if old_commit not in text:
    raise SystemExit("commit anchor missing")
text = text.replace(old_commit, new_commit, 1)

old_effect = '''  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    let active = true;
'''
new_effect = '''  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    // iOS Safari may suspend or discard a tab without another gameplay event.
    // Persist the latest in-memory save at lifecycle boundaries; pagehide also
    // fires on reload/navigation, while visibilitychange covers app switching.
    const persistCurrentSave = () => saveGame(saveRef.current);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") persistCurrentSave();
    };
    window.addEventListener("pagehide", persistCurrentSave);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", persistCurrentSave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    let active = true;
'''
if old_effect not in text:
    raise SystemExit("saveRef effect anchor missing")
text = text.replace(old_effect, new_effect, 1)
rpg.write_text(text)

qa = Path("scripts/pass35_stability_qa.mjs")
q = qa.read_text()
old = '''await page.getByRole("button", { name: /MENU/ }).dispatchEvent("pointerdown", { pointerId: 4, pointerType: "touch", isPrimary: true, buttons: 1 });
await page.getByRole("button", { name: /TITLEへ戻る/ }).click();
await waitTitle();
'''
new = '''await page.getByRole("button", { name: /MENU/ }).dispatchEvent("pointerdown", { pointerId: 4, pointerType: "touch", isPrimary: true, buttons: 1 });
await page.getByRole("button", { name: "STATUS" }).click();
await page.getByRole("button", { name: /TITLEへ戻る/ }).click();
await waitTitle();
'''
if old not in q:
    raise SystemExit("QA mode-return anchor missing")
q = q.replace(old, new, 1)
qa.write_text(q)
