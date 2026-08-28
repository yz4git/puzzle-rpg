from pathlib import Path


def append_once(path: str, marker: str, block: str) -> None:
    file = Path(path)
    text = file.read_text()
    if marker in text:
        return
    file.write_text(text.rstrip() + "\n\n" + block.strip() + "\n")


append_once(
    "app/PuzzleRPGApp.module.css",
    "pass 34 — QA touch target correction",
    r'''
/* SFC visual reconstruction pass 34 — QA touch target correction */
.continuePanel button{min-height:44px}
.continuePanel .back{min-height:44px}
''',
)

append_once(
    "app/rpg/RPGMode.module.css",
    "pass 34 — QA menu touch target correction",
    r'''
/* SFC visual reconstruction pass 34 — QA menu touch target correction */
.menuTabs button{min-height:44px}
''',
)

append_once(
    "app/PuzzleRPGChapter1.module.css",
    "pass 34 — QA chapter touch target correction",
    r'''
/* SFC visual reconstruction pass 34 — QA chapter touch target correction */
.modeExit{min-height:44px;min-width:48px}
''',
)

qa_path = Path("scripts/pass34_browser_qa.mjs")
qa = qa_path.read_text()
qa = qa.replace(
    "page.locator('[aria-label^=\"column \"]')",
    "page.locator('[class*=\"nextColumn\"][aria-label^=\"column \"]')",
)
qa_path.write_text(qa)
