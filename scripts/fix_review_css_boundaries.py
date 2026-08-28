from pathlib import Path

for path in [Path('app/rpg/RPGMode.module.css'), Path('app/PuzzleRPGApp.module.css')]:
    text = path.read_text()
    cleaned = text.replace('\\n\\n/*', '\n\n/*')
    if cleaned == text:
        raise SystemExit(f'no literal CSS boundary escapes found in {path}')
    path.write_text(cleaned)
    print(f'cleaned {path}')
