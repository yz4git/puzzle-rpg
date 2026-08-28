from pathlib import Path

css_path = Path('app/rpg/RPGPuzzleBattle.module.css')
css = css_path.read_text()
old = '''.skipEnemyOverlay{position:absolute;z-index:6;left:50%;top:50%;width:100px;height:74px;display:grid;place-items:center;transform:translate(-50%,-50%);pointer-events:none;filter:drop-shadow(3px 4px 0 #000);overflow:visible}
.stopwatchFace{position:absolute;left:50%;top:5px;width:57px;height:57px;transform:translateX(-50%);border:5px solid #ffe56d;border-radius:50%;background:#08080d;box-shadow:inset 0 0 0 3px #6d5818,0 0 0 2px #08080d}
.stopwatchFace::before{content:"";position:absolute;left:50%;top:-13px;width:20px;height:7px;transform:translateX(-50%);background:#ffe56d;box-shadow:0 -3px #5f4b13,15px 8px 0 -5px #ffe56d}
.stopwatchFace::after{content:"";position:absolute;left:50%;top:50%;width:4px;height:19px;transform:translate(-50%,-92%) rotate(-25deg);transform-origin:50% 92%;background:#fff4ae;box-shadow:7px 13px 0 -1px #fff4ae}
.skipEnemyOverlay>strong{position:absolute;z-index:8;left:50%;top:24px;min-width:31px;transform:translateX(-50%);color:#fff7c9;font:1000 27px/1 monospace;text-align:center;text-shadow:2px 2px #000}
.skipEnemyOverlay>span{position:absolute;z-index:9;left:3px;right:3px;bottom:0;padding:3px 2px;border:2px solid #e9ca54;background:#09080d;color:#ffe56d;font:1000 6px/1 monospace;letter-spacing:.12em;text-align:center;box-shadow:2px 2px #000}
'''
new = '''.skipEnemyOverlay{position:absolute;z-index:6;left:82%;top:42%;width:64px;height:64px;display:grid;place-items:center;transform:translate(-50%,-50%);pointer-events:none;filter:drop-shadow(3px 4px 0 #000);overflow:visible}
.stopwatchFace{position:absolute;z-index:5;box-sizing:border-box;left:50%;top:3px;width:46px;height:46px;transform:translateX(-50%);border:4px solid #ffe56d;border-radius:50%;background:#08080d;box-shadow:inset 0 0 0 2px #6d5818,0 0 0 2px #08080d}
.stopwatchFace::before{content:"";position:absolute;left:50%;top:-10px;width:15px;height:6px;transform:translateX(-50%);background:#ffe56d;box-shadow:0 -2px #5f4b13,11px 6px 0 -4px #ffe56d}
.stopwatchFace::after{content:"";position:absolute;z-index:1;left:59%;top:55%;width:3px;height:12px;transform:translate(-50%,-90%) rotate(-38deg);transform-origin:50% 90%;background:#fff4ae;box-shadow:5px 8px 0 -1px #fff4ae}
.skipEnemyOverlay>strong{position:absolute;z-index:8;left:50%;top:15px;min-width:24px;padding:0 2px;transform:translateX(-50%);background:#08080d;color:#fff7c9;font:1000 22px/1 monospace;text-align:center;text-shadow:2px 2px #000;box-shadow:0 0 0 2px #08080d}
.skipEnemyOverlay>span{position:absolute;z-index:9;left:0;right:0;bottom:0;padding:3px 1px;border:2px solid #e9ca54;background:#09080d;color:#ffe56d;font:1000 6px/1 monospace;letter-spacing:.1em;text-align:center;box-shadow:2px 2px #000}
'''
if old not in css:
    raise SystemExit('stopwatch overlay block not found')
css = css.replace(old, new, 1)
old_media = '@media(max-height:700px){.skipEnemyOverlay{width:92px;height:70px;transform:translate(-50%,-50%) scale(.9);transform-origin:center center}.guardShield{width:106px;height:120px}.guardFx>strong{font-size:16px}.stopwatchPanel{width:25px;height:25px;border-width:3px}}'
new_media = '@media(max-height:700px){.skipEnemyOverlay{left:80%;top:43%;width:60px;height:60px;transform:translate(-50%,-50%)}.stopwatchFace{width:42px;height:42px;border-width:4px}.skipEnemyOverlay>strong{top:14px;min-width:22px;font-size:20px}.skipEnemyOverlay>span{font-size:5px}.guardShield{width:106px;height:120px}.guardFx>strong{font-size:16px}.stopwatchPanel{width:25px;height:25px;border-width:3px}}'
if old_media not in css:
    raise SystemExit('stopwatch compact media block not found')
css = css.replace(old_media, new_media, 1)
css_path.write_text(css)

progress_path = Path('PROGRESS.md')
progress = progress_path.read_text()
entry = '''\n\n### Battle stopwatch overlay polish\n- Screenshot QA at 402×874 showed the SKIP stopwatch was functioning but obscured too much of the enemy and the hand visually crossed the remaining-turn digit.\n- Moved the stopwatch toward the enemy sprite's upper-right edge and reduced the clock face from 57px to 46px (42px on short-height layouts).\n- Put the remaining-turn digit on an opaque center patch above the clock hands so `1` and especially `0` stay readable.\n- Shortened and offset the hands, reduced the crown, and kept `TIME STOP` / `TIME UP` in a separate label beneath the face.\n- Gameplay timing, FREE/SKIP values, enemy turns, battle math, and save data are unchanged.\n'''
if '### Battle stopwatch overlay polish' not in progress:
    progress_path.write_text(progress.rstrip() + entry + '\n')
