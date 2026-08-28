from pathlib import Path
import re, struct, zlib

ROOT = Path('.')


def replace_required(text: str, before: str, after: str, label: str) -> str:
    if before not in text:
        raise RuntimeError(f'missing replacement target: {label}')
    return text.replace(before, after, 1)


def write_png(path: Path, pixels, scale=4):
    h = len(pixels); w = len(pixels[0])
    sw, sh = w * scale, h * scale
    rows = []
    for row in pixels:
        expanded = b''.join(bytes(rgb) * scale for rgb in row)
        for _ in range(scale): rows.append(b'\x00' + expanded)
    raw = b''.join(rows)
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n'
    data += chunk(b'IHDR', struct.pack('>IIBBBBB', sw, sh, 8, 2, 0, 0, 0))
    data += chunk(b'IDAT', zlib.compress(raw, 9))
    data += chunk(b'IEND', b'')
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


class Pix:
    def __init__(self, w=96, h=24, color=(0,0,0)):
        self.w=w; self.h=h; self.p=[[color for _ in range(w)] for _ in range(h)]
    def rect(self,x,y,w,h,c):
        for yy in range(max(0,y), min(self.h,y+h)):
            for xx in range(max(0,x), min(self.w,x+w)): self.p[yy][xx]=c
    def set(self,x,y,c):
        if 0 <= x < self.w and 0 <= y < self.h: self.p[y][x]=c
    def line(self,x0,y0,x1,y1,c):
        dx=abs(x1-x0); sx=1 if x0<x1 else -1; dy=-abs(y1-y0); sy=1 if y0<y1 else -1; err=dx+dy
        while True:
            self.set(x0,y0,c)
            if x0==x1 and y0==y1: break
            e2=2*err
            if e2>=dy: err+=dy; x0+=sx
            if e2<=dx: err+=dx; y0+=sy
    def tri(self,cx,base_y,half_w,height,c):
        for yy in range(height):
            span=max(0, int(half_w*(yy+1)/height))
            self.rect(cx-span, base_y-height+yy, span*2+1, 1, c)


def band(p, bands):
    for y0,y1,c in bands: p.rect(0,y0,p.w,y1-y0,c)


def scene_field():
    p=Pix(); band(p,[(0,4,(39,67,98)),(4,9,(53,88,117)),(9,13,(76,108,123)),(13,24,(28,51,32))])
    p.tri(18,15,15,9,(48,72,73)); p.tri(48,15,20,11,(39,61,66)); p.tri(79,15,16,8,(58,80,76))
    p.rect(7,3,13,2,(192,190,153)); p.rect(11,2,6,1,(224,211,164)); p.rect(66,5,15,2,(177,183,156)); p.rect(70,4,7,1,(220,210,170))
    for x in range(0,96,5):
        h=2+((x*7)%4); p.rect(x,13-h,4,h+4,(22,55,35)); p.rect(x+1,11-h,2,2,(38,78,43))
    p.rect(0,18,96,6,(40,76,39)); p.rect(0,21,96,3,(31,61,32))
    for x in range(3,96,11): p.set(x,20+(x%2),(219,194,91))
    return p.p


def scene_town():
    p=Pix(); band(p,[(0,5,(71,79,111)),(5,11,(99,96,122)),(11,24,(81,59,49))])
    for x,w,h,roof in [(1,17,8,(125,62,49)),(21,19,10,(110,54,48)),(44,22,8,(144,74,50)),(70,24,11,(107,55,51))]:
        p.rect(x,14-h,w,h,(107,88,72)); p.tri(x+w//2,14-h+1,w//2+2,4,roof)
        for wx in range(x+4,x+w-2,7): p.rect(wx,10,2,2,(232,190,91))
    p.rect(8,3,1,5,(73,51,48)); p.rect(81,2,2,6,(71,51,52))
    p.rect(0,15,96,9,(81,67,55));
    for y in range(16,24,3):
        for x in range((y%2)*3,96,8): p.rect(x,y,5,1,(119,101,76))
    return p.p


def scene_marsh():
    p=Pix(); band(p,[(0,6,(43,31,57)),(6,12,(64,37,62)),(12,18,(87,44,58)),(18,24,(45,26,39))])
    p.rect(73,3,5,5,(212,176,148)); p.rect(74,4,3,3,(238,207,162))
    for x in [7,25,53,88]:
        p.rect(x,7,2,12,(43,24,35)); p.line(x+1,9,x-5,5,(43,24,35)); p.line(x+1,11,x+6,7,(43,24,35))
    p.rect(0,17,96,7,(67,33,49)); p.rect(0,19,96,1,(134,57,70)); p.rect(0,22,96,1,(85,39,56))
    for x in range(2,96,7): p.rect(x,15+(x%3),1,6,(77,68,40)); p.set(x+1,16+(x%3),(120,93,47))
    return p.p


def scene_tower():
    p=Pix(); band(p,[(0,6,(24,24,48)),(6,13,(36,34,67)),(13,24,(31,27,50))])
    for x,y in [(6,3),(20,6),(34,2),(61,5),(79,2),(91,7)]: p.set(x,y,(210,203,238))
    for x,w,h,c in [(4,10,14,(67,59,96)),(20,8,18,(88,75,122)),(35,13,12,(70,63,104)),(56,9,20,(103,87,139)),(73,14,15,(73,63,108)),(89,6,17,(91,78,128))]:
        p.rect(x,16-h,w,h,(49,43,76)); p.tri(x+w//2,16-h+1,w//2,5,c); p.rect(x+w//2,16-h+3,1,h-4,(156,140,188))
    p.rect(0,17,96,7,(28,24,47)); p.rect(0,18,96,1,(105,91,140)); p.rect(0,22,96,1,(62,55,91))
    return p.p


def scene_fortress():
    p=Pix(); band(p,[(0,5,(54,65,85)),(5,11,(73,83,103)),(11,24,(42,45,55))])
    p.rect(0,9,96,9,(70,72,80))
    for x in range(0,96,8): p.rect(x,7,5,3,(79,81,89))
    for x in [5,30,58,82]:
        p.rect(x,3,11,13,(64,67,76)); p.rect(x-1,2,4,3,(78,80,87)); p.rect(x+4,2,4,3,(78,80,87)); p.rect(x+9,2,4,3,(78,80,87))
        p.rect(x+4,9,2,3,(220,159,70))
    p.rect(0,17,96,7,(38,39,47));
    for y in range(18,24,2):
        for x in range((y%4)*2,96,9): p.rect(x,y,6,1,(68,68,76))
    return p.p


def scene_dungeon():
    p=Pix(); band(p,[(0,5,(18,17,25)),(5,13,(29,25,35)),(13,24,(21,19,25))])
    for x in [8,28,54,79]:
        p.rect(x,4,5,14,(48,40,50)); p.rect(x-2,3,9,2,(62,51,62)); p.rect(x-1,17,7,2,(56,47,56))
    for x in [19,68]:
        p.rect(x,9,1,5,(100,54,39)); p.rect(x-1,7,3,3,(237,143,59)); p.set(x,6,(255,207,95))
    p.rect(0,18,96,6,(29,26,31)); p.rect(0,19,96,1,(58,49,57))
    for x in range(2,96,9): p.rect(x,22,6,1,(45,39,45))
    return p.p


def scene_citadel():
    p=Pix(); band(p,[(0,5,(79,69,111)),(5,11,(118,96,141)),(11,17,(186,160,157)),(17,24,(74,56,88))])
    for x,y in [(7,4),(31,2),(49,6),(70,3),(90,5)]: p.set(x,y,(255,239,181))
    for x,w,h,c in [(3,12,13,(216,201,208)),(20,10,17,(229,213,224)),(37,16,14,(210,190,225)),(61,11,19,(236,219,222)),(79,15,15,(218,198,228))]:
        p.rect(x,17-h,w,h,(186,168,195)); p.tri(x+w//2,17-h+1,w//2,5,c); p.rect(x+w//2,17-h+2,1,h-3,(248,226,150))
    p.rect(0,18,96,6,(68,52,84)); p.rect(0,18,96,1,(226,192,115)); p.rect(0,22,96,1,(119,88,139))
    return p.p


scenes={'field':scene_field(),'town':scene_town(),'marsh':scene_marsh(),'tower':scene_tower(),'fortress':scene_fortress(),'dungeon':scene_dungeon(),'citadel':scene_citadel()}
for name,pixels in scenes.items(): write_png(ROOT/'public/assets/rpg/battle-bg'/f'{name}.png', pixels)

# Battle component: citadel scene, explicit TALK reaction frame, talking state hook.
battle_path=ROOT/'app/rpg/RPGPuzzleBattle.tsx'
battle=battle_path.read_text()
battle=replace_required(battle,
'''function battleScene(mapId: string) {\n  if (/crimson|marsh|reed/i.test(mapId)) return "marsh";\n  if (/mirror|hour|spire|tower/i.test(mapId)) return "tower";\n  if (/iron|citadel/i.test(mapId)) return "fortress";''',
'''function battleScene(mapId: string) {\n  if (/prismCitadel/i.test(mapId)) return "citadel";\n  if (/crimson|marsh|reed/i.test(mapId)) return "marsh";\n  if (/mirror|hour|spire|tower/i.test(mapId)) return "tower";\n  if (/iron/i.test(mapId)) return "fortress";''','citadel battle scene')
battle=replace_required(battle,
'''  const enemyFrame: EnemySpriteFrame = phase > 1\n    ? "phase"''',
'''  const enemyFrame: EnemySpriteFrame = talkOverlay\n    ? "reaction"\n    : phase > 1\n      ? "phase"''','talk reaction enemy frame')
battle=replace_required(battle,
'''    <main className={styles.battle} data-enemy={enemy.portrait} data-boss={enemy.boss || training ? "true" : "false"} data-scene={battleScene(save.mapId)}>''',
'''    <main className={styles.battle} data-enemy={enemy.portrait} data-boss={enemy.boss || training ? "true" : "false"} data-scene={battleScene(save.mapId)} data-talking={talkOverlay ? "true" : "false"}>''','talking data state')
battle_path.write_text(battle)

# Replace prototype CSS scenery with dedicated pixel background images.
css_path=ROOT/'app/rpg/RPGPuzzleBattle.module.css'
css=css_path.read_text()
start=css.find('.battleBackdrop{')
end=css.find('.header{', start)
if start < 0 or end < 0: raise RuntimeError('battle backdrop css range missing')
new_backdrop='''.battle{--sceneAccent:#d6c16f}\n.battle[data-scene="town"]{--sceneAccent:#e6a06e}.battle[data-scene="marsh"]{--sceneAccent:#e4788d}.battle[data-scene="tower"]{--sceneAccent:#bd9cf0}.battle[data-scene="fortress"]{--sceneAccent:#adc7dc}.battle[data-scene="dungeon"]{--sceneAccent:#a98baf}.battle[data-scene="citadel"]{--sceneAccent:#ffe29a}\n.battleBackdrop{position:absolute;z-index:1;left:7px;right:7px;top:27px;height:82px;overflow:hidden;border:2px solid var(--sceneAccent);background:#111 url('/assets/rpg/battle-bg/field.png') center/cover no-repeat;box-shadow:inset 0 -10px rgba(0,0,0,.22),0 2px 0 #000;image-rendering:pixelated}\n.battleBackdrop::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgba(255,255,255,.04),transparent 22% 78%,rgba(0,0,0,.11)),repeating-linear-gradient(0deg,transparent 0 3px,rgba(0,0,0,.07) 4px)}\n.battleBackdrop i{display:none}\n.battle[data-scene="town"] .battleBackdrop{background-image:url('/assets/rpg/battle-bg/town.png')}\n.battle[data-scene="marsh"] .battleBackdrop{background-image:url('/assets/rpg/battle-bg/marsh.png')}\n.battle[data-scene="tower"] .battleBackdrop{background-image:url('/assets/rpg/battle-bg/tower.png')}\n.battle[data-scene="fortress"] .battleBackdrop{background-image:url('/assets/rpg/battle-bg/fortress.png')}\n.battle[data-scene="dungeon"] .battleBackdrop{background-image:url('/assets/rpg/battle-bg/dungeon.png')}\n.battle[data-scene="citadel"] .battleBackdrop{background-image:url('/assets/rpg/battle-bg/citadel.png')}\n'''
css=css[:start]+new_backdrop+css[end:]
css += '''\n/* SFC visual reconstruction pass 2 */\n.battle[data-scene] .enemyRow{border-color:color-mix(in srgb,var(--sceneAccent) 82%,#fff);box-shadow:inset 0 0 0 2px rgba(0,0,0,.62),inset 0 -9px 16px rgba(0,0,0,.16)}\n.battle[data-scene] .board{border-color:color-mix(in srgb,var(--sceneAccent) 68%,#eee);box-shadow:0 0 0 2px #09070b,0 0 0 4px color-mix(in srgb,var(--sceneAccent) 34%,#332b3b),0 5px 0 #000}\n.battle[data-talking="true"] .enemySprite{animation:enemyTalk 900ms steps(4,end) both;filter:drop-shadow(0 4px 0 #000) drop-shadow(0 0 7px var(--sceneAccent))}\n.battle[data-talking="true"] .enemyRow>div{border-color:color-mix(in srgb,var(--sceneAccent) 70%,#fff)}\n.battle[data-talking="true"] .talkMoment{border-color:var(--sceneAccent);box-shadow:0 0 0 2px #000,0 0 0 4px color-mix(in srgb,var(--sceneAccent) 45%,#352743),5px 5px #000}\n@keyframes enemyTalk{0%,100%{transform:translateY(0)}25%{transform:translateY(-3px)}55%{transform:translateY(1px)}75%{transform:translateY(-1px)}}\n'''
css_path.write_text(css)

# Field rendering: edge continuity, richer town facade cues, stronger character scale.
mode_path=ROOT/'app/rpg/RPGMode.tsx'
mode=mode_path.read_text()
anchor='''function drawGroundShadow(context: CanvasRenderingContext2D, x: number, y: number, width: number) {\n  context.save();\n  context.globalAlpha = .48;\n  context.fillStyle = "#05040a";\n  context.beginPath();\n  context.ellipse(x + width / 2, y, width * .38, 2.2, 0, 0, Math.PI * 2);\n  context.fill();\n  context.restore();\n}\n'''
edge_helper=anchor+'''\nfunction drawTerrainEdge(context: CanvasRenderingContext2D, map: MapDefinition, code: string, worldX: number, worldY: number, x: number, y: number) {\n  const up = tileAt(map, worldX, worldY - 1), right = tileAt(map, worldX + 1, worldY), down = tileAt(map, worldX, worldY + 1), left = tileAt(map, worldX - 1, worldY);\n  const road = code === "r" || code === "b";\n  if (road) {\n    context.fillStyle = "rgba(64,45,28,.58)";\n    if (!(up === "r" || up === "b")) context.fillRect(x, y, TILE, 1);\n    if (!(down === "r" || down === "b")) context.fillRect(x, y + TILE - 1, TILE, 1);\n    if (!(left === "r" || left === "b")) context.fillRect(x, y, 1, TILE);\n    if (!(right === "r" || right === "b")) context.fillRect(x + TILE - 1, y, 1, TILE);\n  }\n  if (code === "w") {\n    context.fillStyle = "rgba(157,215,203,.70)";\n    if (up !== "w") context.fillRect(x, y, TILE, 1);\n    if (down !== "w") context.fillRect(x, y + TILE - 1, TILE, 1);\n    if (left !== "w") context.fillRect(x, y, 1, TILE);\n    if (right !== "w") context.fillRect(x + TILE - 1, y, 1, TILE);\n  }\n  if (code === "f") {\n    context.fillStyle = "rgba(7,29,16,.52)";\n    if (up !== "f") context.fillRect(x, y, TILE, 2);\n    if (left !== "f") context.fillRect(x, y + 2, 2, TILE - 2);\n    context.fillStyle = "rgba(91,139,66,.32)";\n    if (down !== "f") context.fillRect(x + 2, y + TILE - 2, TILE - 2, 2);\n  }\n  if ((code === "d" || code === "x") && !["d","x"].includes(up)) { context.fillStyle = "rgba(239,110,95,.42)"; context.fillRect(x, y, TILE, 1); }\n}\n'''
mode=replace_required(mode,anchor,edge_helper,'terrain edge helper')
base_loop='''    for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {\n      const worldX = cameraX + viewX, worldY = cameraY + viewY;\n      const code = tileAt(map, worldX, worldY);\n      const cell = terrainAtlasCell(map, code, worldX, worldY);\n      const atlas = atlasImages.current[cell.atlas];\n      if (atlas?.complete && atlas.naturalWidth) drawAtlasTile(context, atlas, cell, viewX * TILE, viewY * TILE);\n      else drawTile(context, code, viewX * TILE, viewY * TILE, worldX, worldY);\n    }\n'''
second_loop=base_loop+'''\n    // A lightweight autotile edge pass stitches roads, shores, forest walls and danger ground together.\n    for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {\n      const worldX = cameraX + viewX, worldY = cameraY + viewY;\n      drawTerrainEdge(context, map, tileAt(map, worldX, worldY), worldX, worldY, viewX * TILE, viewY * TILE);\n    }\n'''
mode=replace_required(mode,base_loop,second_loop,'autotile edge pass')
facade='''            context.drawImage(townAtlas, col * 64, 64, 64, 64, drawX, drawY, drawWidth, drawHeight);\n'''
facade_new=facade+'''            // Distinct signboards / window glints keep repeated facades from reading as one stamped asset.\n            if (drawWidth >= TILE * 2) {\n              const detail = stableVisualIndex(map.id, worldX + offset, worldY + buildingIndex);\n              const signColors = ["#e2aa4f", "#6ec4c7", "#cf6c69", "#a68bd4"];\n              context.fillStyle = "#2b1b17"; context.fillRect(drawX + drawWidth - 8, drawY + drawHeight - 15, 7, 6);\n              context.fillStyle = signColors[detail % signColors.length]!; context.fillRect(drawX + drawWidth - 7, drawY + drawHeight - 14, 5, 4);\n              context.fillStyle = "rgba(255,230,145,.78)"; context.fillRect(drawX + 4, drawY + drawHeight - 13, 3, 3);\n            }\n'''
mode=replace_required(mode,facade,facade_new,'town facade details')
mode=replace_required(mode,
'''        drawGroundShadow(context, x - 4, y + TILE, 24);\n        context.drawImage(npcAtlas, cell.col * 96, cell.row * 128, 96, 128, x - 4, y - 16, 24, 32);''',
'''        drawGroundShadow(context, x - 5, y + TILE, 26);\n        context.drawImage(npcAtlas, cell.col * 96, cell.row * 128, 96, 128, x - 5, y - 18, 26, 34);''','npc presence scale')
mode=replace_required(mode,
'''      drawGroundShadow(context, heroX - 5, heroY + TILE, 27);\n      context.drawImage(heroAtlas, cell.col * 96, cell.row * 96, 96, 96, heroX - 5, heroY - 14, 26, 30);''',
'''      drawGroundShadow(context, heroX - 6, heroY + TILE, 29);\n      context.drawImage(heroAtlas, cell.col * 96, cell.row * 96, 96, 96, heroX - 6, heroY - 16, 28, 32);''','hero presence scale')
mode_path.write_text(mode)

# Document this visual phase.
bible_path=ROOT/'docs/VISUAL_RECONSTRUCTION_BIBLE.md'
bible=bible_path.read_text()
marker='## Phase 2 asset reconstruction'
if marker not in bible:
    bible += '''\n\n## Phase 2 asset reconstruction\n- Battle backdrops are dedicated 384x96 nearest-neighbor PNG strips, not CSS placeholder scenery.\n- Seven scene identities: field, town, marsh, tower, fortress, dungeon, prism citadel.\n- Overworld gets a second-pass edge stitch for road shoulders, water shore highlights, forest walls, and danger-ground rims.\n- Town facade reuse is broken up with deterministic signboard/window details.\n- Hero/NPC display silhouettes are slightly larger while collision remains anchored to the original 16x16 gameplay tile.\n- TALK forces the enemy reaction frame and a short stepped reaction motion.\n'''
    bible_path.write_text(bible)
progress_path=ROOT/'PROGRESS.md'
progress=progress_path.read_text()
marker2='## Visual Reconstruction Pass 2 — dedicated scene assets'
if marker2 not in progress:
    progress += '''\n\n## Visual Reconstruction Pass 2 — dedicated scene assets\n- Added dedicated pixel battle background strips for field/town/marsh/tower/fortress/dungeon/citadel.\n- Added terrain edge stitching, richer town facade details, stronger hero/NPC field presence, and TALK reaction frame animation.\n- Required validation: TypeScript, vinext build, 402x690 DPR3 screenshots, Chapter Battle regression.\n'''
    progress_path.write_text(progress)
print('SFC visual reconstruction pass 2 applied')
