from pathlib import Path

MARK = "SFC visual reconstruction pass 33"


def append_once(path: str, block: str):
    p = Path(path)
    text = p.read_text()
    if MARK in text:
        return
    p.write_text(text.rstrip() + "\n\n" + block.strip() + "\n")

append_once("app/globals.css", r'''
/* SFC visual reconstruction pass 33 — iPhone portrait final polish */
:root{-webkit-text-size-adjust:100%;text-size-adjust:100%;overscroll-behavior:none}
html,body{width:100%;min-height:100%;overflow:hidden;overscroll-behavior:none;background:#050509}
button,[role="button"]{-webkit-tap-highlight-color:transparent;touch-action:manipulation}
img,canvas{-webkit-user-drag:none}
''')

append_once("app/PuzzleRPGApp.module.css", r'''
/* SFC visual reconstruction pass 33 — iPhone portrait final polish */
.title{box-sizing:border-box;width:min(100%,460px);height:100dvh;min-height:100dvh;padding-top:max(10px,env(safe-area-inset-top));padding-right:max(10px,env(safe-area-inset-right));padding-bottom:max(9px,env(safe-area-inset-bottom));padding-left:max(10px,env(safe-area-inset-left));overscroll-behavior:none}
.modeGrid,.continuePanel,.title footer{max-width:100%;box-sizing:border-box}
.modeGrid button,.continuePanel button{box-sizing:border-box;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.continuePanel .back{min-height:44px}
.modeGrid strong,.modeGrid small,.continuePanel b,.continuePanel small{overflow-wrap:anywhere}
@media(max-width:380px){.title{padding-left:max(7px,env(safe-area-inset-left));padding-right:max(7px,env(safe-area-inset-right))}.modeGrid{gap:5px}.modeGrid button{padding-inline:7px}.modeGrid strong{font-size:13px}.modeGrid small{font-size:5.5px}.continuePanel{padding:6px}}
@media(max-height:667px){.title{gap:3px}.logo{font-size:clamp(36px,10.8vw,46px)}.logo::after{margin-top:4px}.subtitle{padding-block:2px}.hero{width:min(25vw,92px);height:min(13dvh,86px)}.title:has(.continuePanel) .hero{width:min(23vw,82px);height:min(11dvh,76px)}.modeGrid button{min-height:62px}.continuePanel button{min-height:46px}.continuePanel .back{min-height:42px}}
@media(max-height:600px){.hero{width:64px;height:54px}.modeGrid button{min-height:52px}.modeGrid strong{font-size:10.5px}.modeGrid small{font-size:5px}.title footer{display:none}}
''')

append_once("app/rpg/RPGMode.module.css", r'''
/* SFC visual reconstruction pass 33 — iPhone portrait final polish */
.rpg{box-sizing:border-box;width:min(100%,460px);height:100dvh;min-height:100dvh;padding-top:max(5px,env(safe-area-inset-top));padding-right:max(7px,env(safe-area-inset-right));padding-bottom:max(5px,env(safe-area-inset-bottom));padding-left:max(7px,env(safe-area-inset-left));overscroll-behavior:none}
.hud,.locationBar,.worldFrame,.memoStrip,.controls,.dialogueBox,.menuWindow,.resultCard,.discoveryCard{box-sizing:border-box;max-width:100%}
.hud strong,.locationBar strong,.memoStrip strong,.fieldThreat strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.controls button,.menuWindow button,.resultCard button,.ending button{touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.menuOverlay{padding-top:max(10px,env(safe-area-inset-top));padding-right:max(10px,env(safe-area-inset-right));padding-bottom:max(10px,env(safe-area-inset-bottom));padding-left:max(10px,env(safe-area-inset-left))}
.dialogueOverlay,.resultOverlay{padding-right:max(8px,env(safe-area-inset-right));padding-left:max(8px,env(safe-area-inset-left));padding-bottom:max(10px,env(safe-area-inset-bottom))}
.menuWindow{max-height:calc(100dvh - max(20px,env(safe-area-inset-top)) - max(20px,env(safe-area-inset-bottom)));overflow:hidden}
.menuContent,.shopList{max-height:none;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.menuWindow>header button{min-height:40px;min-width:44px}.menuTabs button{min-height:38px}.menuContent>button,.servicePanel button,.listRow,.shopList>button,.memoRow{min-height:44px}
.dialogueBox p,.resultCard p,.ending p,.discoveryCard>strong,.discoveryCard>p{overflow-wrap:anywhere;word-break:break-word}
.ending{box-sizing:border-box;padding-top:max(24px,env(safe-area-inset-top));padding-right:max(18px,env(safe-area-inset-right));padding-bottom:max(24px,env(safe-area-inset-bottom));padding-left:max(18px,env(safe-area-inset-left));overflow:auto;overscroll-behavior:contain}
@media(max-width:380px){.rpg{padding-right:max(5px,env(safe-area-inset-right));padding-left:max(5px,env(safe-area-inset-left))}.hud{grid-template-columns:1.25fr .88fr .64fr}.hud>div{padding-inline:4px}.controls{padding-inline:12px}.dpad{width:108px;height:108px;grid-template-columns:repeat(3,36px);grid-template-rows:repeat(3,36px)}.abButtons{gap:8px}.abButtons button{width:54px;height:54px}.dialogueBox[data-portrait="true"]{grid-template-columns:48px 1fr;column-gap:7px}.dialoguePortrait{width:44px;height:60px}.dialogueBox p{font-size:13px}}
@media(max-height:667px){.rpg{gap:2px}.hud{min-height:32px}.locationBar{min-height:21px}.memoStrip{min-height:19px}.controls{min-height:100px;padding-top:36px;padding-bottom:5px}.controls::before{top:7px;padding-block:4px}.dpad::before,.abButtons::before{top:-20px}.dpad{width:102px;height:102px;grid-template-columns:repeat(3,34px);grid-template-rows:repeat(3,34px)}.dpad button,.dpad i{font-size:13px}.abButtons button{width:54px;height:54px}.aButton{transform:translateY(-9px)}.bButton{transform:translateY(7px)}.dialogueBox{min-height:96px;padding:7px 9px}.dialogueBox p{font-size:13px;line-height:1.4}.menuTabs button{min-height:36px}.listRow,.shopList>button,.memoRow{min-height:42px}.ending{gap:12px}.ending p{min-height:0;font-size:13px;line-height:1.55}}
@media(max-height:590px){.hud{min-height:29px}.hud span{font-size:5.5px}.hud strong{font-size:9px}.locationBar{min-height:19px}.locationBar span,.locationBar strong{font-size:5.5px}.memoStrip{display:none}.controls{min-height:90px;padding-top:31px}.controls::before{top:5px}.dpad{width:90px;height:90px;grid-template-columns:repeat(3,30px);grid-template-rows:repeat(3,30px)}.abButtons button{width:50px;height:50px}.abButtons b{font-size:19px}.dpad::before,.abButtons::before{display:none}.menuWindow{gap:3px;padding:6px}.menuTabs button{min-height:34px}.dialogueBox p{font-size:12px}.fieldThreat{min-height:20px}}
''')

append_once("app/PuzzleRPGClusterBreak.module.css", r'''
/* SFC visual reconstruction pass 33 — iPhone portrait final polish */
.shell,.titleScreen{box-sizing:border-box;width:100%;height:100dvh;min-height:100dvh;overscroll-behavior:none}
.shell{padding-top:max(5px,env(safe-area-inset-top));padding-right:max(7px,env(safe-area-inset-right));padding-bottom:max(6px,env(safe-area-inset-bottom));padding-left:max(7px,env(safe-area-inset-left))}
.shell button,.overlay button{touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.topBar,.enemyStage,.intentRow,.playerStatus,.nextStrip,.boardZone,.clusterReadout,.message,.ruleLine{min-width:0;max-width:100%;box-sizing:border-box}
.enemyInfo strong,.enemyInfo span,.enemyInfo small,.intentNow strong,.intentNext strong,.intentNow small,.intentNext small,.freeMoves small{min-width:0;overflow:hidden;text-overflow:ellipsis}
.overlay{box-sizing:border-box;padding-top:max(14px,env(safe-area-inset-top));padding-right:max(12px,env(safe-area-inset-right));padding-bottom:max(14px,env(safe-area-inset-bottom));padding-left:max(12px,env(safe-area-inset-left));overscroll-behavior:contain}
.introCard,.clearCard,.gameOverCard{box-sizing:border-box;max-height:calc(100dvh - max(22px,env(safe-area-inset-top)) - max(22px,env(safe-area-inset-bottom)));overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.introCard button,.clearCard button,.gameOverCard button{min-height:44px;min-width:44px}
.dialogue,.hint,.clearCard p,.gameOverCard p{overflow-wrap:anywhere;word-break:break-word}
@media(max-width:380px){.shell{padding-right:max(5px,env(safe-area-inset-right));padding-left:max(5px,env(safe-area-inset-left))}.enemyStage{grid-template-columns:78px 1fr}.enemySprite{width:74px}.intentNow,.intentNext{padding-inline:4px}.playerStatus>div{padding-inline:4px}.board{width:min(94vw,41dvh,360px)}}
@media(max-height:667px){.shell{gap:2px}.topBar{min-height:27px}.enemyStage{min-height:66px;grid-template-columns:72px 1fr;padding-block:3px}.enemySprite{width:70px;height:61px}.enemyInfo small{display:none}.intentNow,.intentNext{padding-block:3px}.playerStatus>div{min-height:31px}.nextStrip{min-height:31px}.board{width:min(92vw,40dvh,342px)}.message{min-height:14px;padding-block:2px}.ruleLine{font-size:6px}.introCard,.clearCard,.gameOverCard{gap:6px;padding:10px}.introCard>img{width:112px;height:94px}}
@media(max-height:590px){.topBar{min-height:24px}.enemyStage{min-height:58px;grid-template-columns:62px 1fr}.enemySprite{width:60px;height:53px}.enemyInfo>span{font-size:7px}.intentNow>small,.intentNext>small,.ruleLine{display:none}.playerStatus>div{min-height:28px}.nextStrip{min-height:27px}.board{width:min(90vw,38dvh,300px)}.message{font-size:7px}.clusterReadout span{padding-block:2px}}
''')

append_once("app/PuzzleRPGChapter1.module.css", r'''
/* SFC visual reconstruction pass 33 — iPhone portrait final polish */
.rewardCard,.buildPanel{box-sizing:border-box;max-width:100%;max-height:calc(100dvh - max(18px,env(safe-area-inset-top)) - max(18px,env(safe-area-inset-bottom)));overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.rewardChoice,.buildButton,.closeBuild,.modeExit{touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.rewardChoice{min-height:58px}.modeExit{min-width:44px;min-height:36px}.closeBuild{min-height:44px}
.rewardChoice small,.acquired small,.nextEncounter em,.buildList small{overflow-wrap:anywhere;word-break:break-word}
@media(max-width:380px){.rewardChoice,.acquired,.nextEncounter{grid-template-columns:40px minmax(0,1fr);gap:6px}.rewardChoice>b,.acquired>b{width:36px}.buildPanel{padding-inline:9px}}
@media(max-height:667px){.rewardCard{padding:8px!important}.rewardGrid{gap:4px}.rewardChoice{min-height:50px;padding-block:4px!important}.acquired{margin-block:4px;padding-block:5px}.nextEncounter{margin-block:3px}.buildPanel{padding-top:10px;padding-bottom:9px}.buildList{gap:4px}.buildList>div{padding-block:5px}.buildSummary{margin-bottom:5px}}
@media(max-height:590px){.rewardChoice{min-height:46px}.rewardChoice small,.acquired small{font-size:7px}.nextEncounter img{width:36px;height:36px}.buildPanel>strong{margin-bottom:7px}.buildList small{font-size:6.5px}}
''')

progress = Path("PROGRESS.md")
progress_text = progress.read_text()
heading = "## SFC Visual Reconstruction Pass 33 — iPhone portrait final polish"
if heading not in progress_text:
    progress.write_text(progress_text.rstrip() + "\n\n" + heading + "\n- Hardened all title, RPG field, dialogue/menu/result, Chapter Battle and reward surfaces against iPhone safe-area clipping, short portrait heights and narrow displays without changing game logic.\n- Raised undersized menu/navigation touch targets, disabled tap highlight/double-tap style browser gestures on controls, and added contained momentum scrolling only where long menus or reward cards need it.\n- Added dedicated 380px-wide, 667px-tall and 590px-tall portrait breakpoints so world/board play space remains primary while secondary labels collapse before core interaction does.\n- Added overflow wrapping and ellipsis rules for long Japanese/English labels plus symmetric left/right safe-area padding for Dynamic Island/notch landscape-to-portrait transitions.\n- Viewport metadata, battle math, encounter logic, reward values, maps, story flags, save format and Chapter Battle rules remain unchanged.\n")
