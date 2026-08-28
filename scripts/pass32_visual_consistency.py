from pathlib import Path


def append_once(path: str, marker: str, block: str) -> None:
    p = Path(path)
    text = p.read_text()
    if marker in text:
        return
    if not text.endswith("\n"):
        text += "\n"
    p.write_text(text + "\n" + block.strip() + "\n")

append_once(
    "app/PuzzleRPGApp.module.css",
    "SFC visual reconstruction pass 32 — title consistency audit",
    r'''
/* SFC visual reconstruction pass 32 — title consistency audit */
.title{gap:5px;padding:max(9px,env(safe-area-inset-top)) 9px max(8px,env(safe-area-inset-bottom));}
.logo{margin-top:0;font-size:clamp(46px,13.6vw,68px);line-height:.79;}
.logo::after{margin-top:6px;height:2px;}
.subtitle{padding:3px 10px;font-size:7px;letter-spacing:.22em;}
.hero{width:min(46vw,184px);height:min(24dvh,176px);margin-top:-1px;}
.title:has(.continuePanel) .hero{width:min(36vw,142px);height:min(18dvh,132px);}
.modeGrid{gap:5px;margin-bottom:1px;}
.modeGrid button{min-height:88px;padding:9px 9px 8px;border-width:3px;}
.modeGrid button::before{width:18px;height:18px;top:6px;left:7px;font-size:8px;}
.modeGrid button::after{top:31px;}
.modeGrid span{font-size:5.5px;color:#9e99a5;}
.modeGrid strong{font-size:15px;line-height:1;}
.modeGrid small{font-size:5.5px;line-height:1.3;color:#a9a5b1;}
.continuePanel{gap:4px;padding:7px;margin-bottom:2px;}
.continuePanel>strong{padding-bottom:5px;font-size:15px;}
.continuePanel button{min-height:54px;padding-block:6px;}
.title footer{margin-top:0;padding:3px 6px;opacity:.72;}
@media(max-height:700px){.title{gap:3px}.hero{width:min(27vw,100px);height:min(13dvh,94px)}.modeGrid button{min-height:62px}.modeGrid strong{font-size:12px}.modeGrid small{font-size:5px}}
''')

append_once(
    "app/rpg/RPGMode.module.css",
    "SFC visual reconstruction pass 32 — RPG consistency audit",
    r'''
/* SFC visual reconstruction pass 32 — RPG consistency audit */
.rpg{gap:2px;padding:max(4px,env(safe-area-inset-top)) 6px max(4px,env(safe-area-inset-bottom));grid-template-rows:auto auto auto auto minmax(98px,1fr);}
.hud{min-height:36px;gap:2px;}
.hud>div{padding:3px 5px;border-width:2px;}
.hud span{font-size:5.5px}.hud strong{font-size:9.5px;}
.locationBar{min-height:23px;padding:2px 6px;gap:5px;}
.locationBar span{font-size:5.5px}.locationBar strong{font-size:6.5px;}
.worldFrame{border-width:3px;box-shadow:0 0 0 2px #080609,0 4px 0 #000;}
.memoStrip{min-height:21px;padding:2px 5px;font-size:6.5px;}
.memoStrip strong{font-size:5.5px;}
.controls{min-height:104px;padding:41px 18px 7px;}
.controls::before{top:9px;min-width:118px;padding:4px 10px;font-size:5.5px;}
.controls::after{width:28px;height:28px;}
.dpad::before,.abButtons::before{top:-22px;font-size:5.5px;}
.dpad{width:104px;height:104px;grid-template-columns:repeat(3,34.666px);grid-template-rows:repeat(3,34.666px);}
.dpad button,.dpad i{font-size:14px;}
.abButtons{gap:10px}.abButtons button{width:55px;height:55px;}.abButtons b{font-size:20px;}
.dialogueOverlay,.menuOverlay,.resultOverlay{padding-left:max(8px,env(safe-area-inset-left));padding-right:max(8px,env(safe-area-inset-right));}
.dialogueBox{width:min(100%,420px);min-height:104px;gap:4px;padding:7px 10px;border-width:3px;}
.dialogueBox span{font-size:7px}.dialogueBox p{font-size:13px;line-height:1.42}.dialogueBox small{font-size:6.5px;}
.dialogueBox[data-portrait="true"]{grid-template-columns:52px 1fr;column-gap:8px}.dialoguePortrait{width:46px;height:61px;}
.menuWindow{width:min(94vw,404px);max-height:76dvh;gap:4px;padding:7px;}
.menuWindow>header strong{font-size:10px}.menuWindow>header button{min-height:27px}.menuTabs button{min-height:26px;font-size:6.5px;}
.menuContent,.shopList{max-height:47dvh;gap:3px}.menuContent h2{font-size:13px}.menuContent p,.shopList p{font-size:8.5px;}
.listRow,.shopList>button,.memoRow{min-height:40px;padding:4px 6px;}.listRow b,.shopList b,.memoRow b{font-size:8.5px}.listRow small,.shopList small,.memoRow small{font-size:6.5px;}
.resultCard{gap:7px;padding:12px;}.resultCard strong{font-size:22px}.resultCard p{font-size:9.5px}.resultCard button{min-height:41px;}
.discoveryCard{min-height:190px;padding:15px 16px 12px;}.discoveryCard>strong{font-size:16px}.discoveryCard>p{font-size:8.5px;}
.fieldThreat{left:6px;right:6px;top:6px;min-height:23px;padding:3px 5px;}.fieldThreat strong{font-size:7.5px;}
.dangerWarning{padding:4px 7px}.dangerWarning strong{font-size:8px;}
.ending{gap:15px;padding:26px}.ending strong{font-size:clamp(40px,14vw,68px)}.ending p{min-height:72px;font-size:14px;line-height:1.6}.ending button{min-height:46px;}
@media(max-height:700px){.controls{min-height:98px;padding:39px 17px 6px}.dpad{width:98px;height:98px;grid-template-columns:repeat(3,32.666px);grid-template-rows:repeat(3,32.666px)}.abButtons button{width:52px;height:52px}.dialogueBox{min-height:94px}.dialogueBox p{font-size:12px}.menuWindow{max-height:80dvh}}
''')

append_once(
    "app/PuzzleRPGClusterBreak.module.css",
    "SFC visual reconstruction pass 32 — battle consistency audit",
    r'''
/* SFC visual reconstruction pass 32 — battle consistency audit */
.shell{gap:3px;padding:max(5px,env(safe-area-inset-top)) max(6px,env(safe-area-inset-right)) max(6px,env(safe-area-inset-bottom)) max(6px,env(safe-area-inset-left));}
.topBar{min-height:29px;padding-bottom:2px;}.topBar span{font-size:7px}.topBar strong{font-size:11px}.turnBox{padding:3px 5px;font-size:9px;}
.enemyStage{min-height:80px;grid-template-columns:88px 1fr;gap:5px;padding:4px 6px;}.enemySprite{width:84px;height:74px}.enemyInfo strong{font-size:12px}.enemyInfo>span{font-size:8px}.enemyInfo small{font-size:7px;}
.intentRow{gap:3px}.intentNow,.intentNext{padding:4px 5px;column-gap:3px}.intentNow>span,.intentNext>span{font-size:6.5px}.intentNow>strong,.intentNext>strong{font-size:8.5px}.intentNow>small,.intentNext>small{font-size:6.5px;}
.playerStatus{gap:3px}.playerStatus>div{min-height:36px;padding:3px 4px}.playerStatus span{font-size:6.5px}.playerStatus strong{font-size:10px}.freeMoves small{font-size:6px;}
.nextStrip{min-height:35px}.nextStrip{grid-template-columns:32px 1fr}.nextLabel{font-size:6.5px}.nextColumns{gap:1px;padding:2px}.miniPanel{font-size:5.5px}.nextColumn strong{font-size:6.5px;}
.board{width:min(92vw,43dvh,374px);border-color:#8f8b98;}.groupPreview{top:6px;padding:4px 9px}.groupPreview strong{font-size:16px;}
.clusterReadout{width:min(92vw,374px);gap:2px}.clusterReadout span{padding:2px;font-size:6.5px}.clusterReadout strong{font-size:9px;}
.message{width:min(92vw,374px);min-height:17px;padding:3px 5px;font-size:7.5px}.ruleLine{width:min(92vw,374px);font-size:6px;opacity:.74;}
.introCard,.clearCard,.gameOverCard{width:min(92vw,386px);gap:7px;padding:11px}.introCard>strong{font-size:16px}.dialogue{font-size:13px;line-height:1.45}.hint{font-size:10px;line-height:1.42}.introCard small{font-size:8px}.clearCard strong,.gameOverCard strong{font-size:26px;}
@media(max-height:760px){.shell{gap:2px}.enemyStage{min-height:69px;grid-template-columns:74px 1fr}.enemySprite{width:70px;height:63px}.board{width:min(90vw,40dvh,336px)}.playerStatus>div{min-height:32px}.nextStrip{min-height:31px}}
''')

append_once(
    "app/PuzzleRPGChapter1.module.css",
    "SFC visual reconstruction pass 32 — chapter consistency audit",
    r'''
/* SFC visual reconstruction pass 32 — chapter consistency audit */
.rewardCard{width:min(92vw,386px);max-height:calc(100dvh - 16px);}
.chapterName{margin-bottom:5px;font-size:10px;}.encounterBadge,.buildCounter{min-height:17px;padding:2px 6px;font-size:7px;}
.rewardLead{font-size:9px!important;margin-bottom:5px!important}.rewardGrid{gap:5px;margin:3px 0 6px}.rewardChoice{min-height:54px;grid-template-columns:43px minmax(0,1fr);gap:7px;padding:5px 7px!important;border-width:2px!important}.rewardChoice>b,.acquired>b{width:39px;min-height:35px;font-size:10px}.rewardChoice>span>strong,.acquired>span>strong{font-size:10px!important}.rewardChoice small,.acquired small{font-size:7.5px;line-height:1.3}.acquired{grid-template-columns:43px minmax(0,1fr);gap:7px;padding:6px 7px;border-width:2px}.buildSummary{gap:3px;margin-bottom:6px}.buildSummary i{padding:3px 4px;font-size:5.5px}.nextEncounter{grid-template-columns:43px minmax(0,1fr);gap:7px;padding:5px 6px}.nextEncounter img{width:39px;height:39px}.buildPanel{width:min(92vw,368px);padding:12px 10px 10px;border-width:3px}.buildPanel>strong{margin:4px 0 8px;font-size:15px}.buildList{gap:5px}.buildList>div{padding:5px 6px;gap:6px}.closeBuild{margin-top:8px!important}
''')

progress = Path("PROGRESS.md")
text = progress.read_text()
marker = "## SFC Visual Reconstruction Pass 32 — Visual consistency audit"
if marker not in text:
    if not text.endswith("\n"):
        text += "\n"
    text += r'''

## SFC Visual Reconstruction Pass 32 — Visual consistency audit
- Audited title/mode select, RPG field HUD, dialogue, field menu, discovery/reward overlays, Chapter Battle HUD and chapter reward screens against one compact SFC presentation grammar.
- Reduced excess vertical chrome and secondary-copy weight while preserving the world map and 6x6 battle board as the dominant visual surfaces on iPhone portrait displays.
- Normalized frame density, typography hierarchy, touch-control proportions, menu row heights and modal spacing without changing gameplay, reward values, map data, battle logic, save data or progression.
- Added short-height overrides so the same hierarchy survives smaller Safari viewports instead of hiding primary information.
'''
    progress.write_text(text)
