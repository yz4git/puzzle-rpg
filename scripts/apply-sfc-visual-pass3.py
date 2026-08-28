from pathlib import Path

ROOT=Path('.')

def rep(text,before,after,label):
    if before not in text: raise RuntimeError(f'missing target: {label}')
    return text.replace(before,after,1)

mode_path=ROOT/'app/rpg/RPGMode.tsx'
mode=mode_path.read_text()
old='''function drawAtlasTile(context: CanvasRenderingContext2D, image: HTMLImageElement, cell: AtlasCell, x: number, y: number) {\n  const { width, height } = RPG_ATLAS_METRICS.terrain;\n  const rotation = cell.rotation ?? 0;\n  if (!rotation) {\n    context.drawImage(image, cell.col * width, cell.row * height, width, height, x, y, TILE, TILE);\n    return;\n  }\n  context.save();\n  context.translate(x + TILE / 2, y + TILE / 2);\n  context.rotate(rotation * Math.PI / 2);\n  context.drawImage(image, cell.col * width, cell.row * height, width, height, -TILE / 2, -TILE / 2, TILE, TILE);\n  context.restore();\n}\n'''
new='''function drawAtlasTile(context: CanvasRenderingContext2D, image: HTMLImageElement, cell: AtlasCell, x: number, y: number) {\n  const { width, height } = RPG_ATLAS_METRICS.terrain;\n  const rotation = cell.rotation ?? 0;\n  // Generated atlas cells carry a small presentation rim. Crop two source pixels\n  // so adjacent 16x16 gameplay tiles read as continuous SNES terrain instead of cards.\n  const inset = 2;\n  const sourceX = cell.col * width + inset;\n  const sourceY = cell.row * height + inset;\n  const sourceWidth = width - inset * 2;\n  const sourceHeight = height - inset * 2;\n  if (!rotation) {\n    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, TILE, TILE);\n    return;\n  }\n  context.save();\n  context.translate(x + TILE / 2, y + TILE / 2);\n  context.rotate(rotation * Math.PI / 2);\n  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, -TILE / 2, -TILE / 2, TILE, TILE);\n  context.restore();\n}\n'''
mode=rep(mode,old,new,'atlas border crop')
mode_path.write_text(mode)

css_path=ROOT/'app/rpg/RPGMode.module.css'
css=css_path.read_text()
old_controls='''.controls{min-height:104px;display:flex;align-items:center;justify-content:space-between;padding:4px 20px 0;border-top:2px solid color-mix(in srgb,var(--accent2) 70%,#000);background:repeating-linear-gradient(90deg,#0c0b11 0 14px,#0a0910 14px 28px)}\n.dpad{width:105px;height:105px;display:grid;grid-template-columns:repeat(3,35px);grid-template-rows:repeat(3,35px);filter:drop-shadow(3px 4px 0 #000)}'''
new_controls='''.controls{min-height:112px;display:flex;align-items:center;justify-content:space-between;padding:42px 22px 8px;border:2px solid color-mix(in srgb,var(--accent2) 72%,#09080d);border-top-color:var(--accent2);overflow:hidden;box-shadow:inset 0 0 0 2px #060609,inset 0 18px 34px rgba(255,255,255,.015);background:radial-gradient(ellipse at 50% 36%,color-mix(in srgb,var(--accent2) 18%,transparent) 0 9%,transparent 10% 100%),repeating-linear-gradient(90deg,#0d0c13 0 14px,#09090f 14px 28px)}\n.controls::before{content:"◆  PRISM LINK  ◆";position:absolute;z-index:0;left:50%;top:12px;transform:translateX(-50%);min-width:132px;padding:5px 12px;border:1px solid color-mix(in srgb,var(--accent) 54%,#332b39);background:#090910;color:color-mix(in srgb,var(--accent) 82%,#fff);box-shadow:0 0 0 2px #050507;font:900 6px/1 monospace;letter-spacing:.16em;text-align:center;white-space:nowrap}\n.controls::after{content:"";position:absolute;left:18px;right:18px;top:31px;height:1px;background:linear-gradient(90deg,transparent,var(--accent2) 18% 42%,transparent 42% 58%,var(--accent2) 58% 82%,transparent);opacity:.66}\n.dpad,.abButtons{position:relative;z-index:1}\n.dpad{width:112px;height:112px;display:grid;grid-template-columns:repeat(3,37.333px);grid-template-rows:repeat(3,37.333px);filter:drop-shadow(3px 4px 0 #000)}'''
css=rep(css,old_controls,new_controls,'control deck')
old_media='''@media(max-height:720px){.hud{min-height:36px}.locationBar{min-height:23px}.controls{min-height:96px;padding-top:1px}.dpad{width:96px;height:96px;grid-template-columns:repeat(3,32px);grid-template-rows:repeat(3,32px)}.dpad button,.dpad i{font-size:13px}.abButtons button{width:54px;height:54px}.abButtons b{font-size:20px}.dialogueBox{min-height:104px}.dialogueBox p{font-size:13px}.menuWindow{max-height:76dvh}}'''
new_media='''@media(max-height:720px){.hud{min-height:36px}.locationBar{min-height:23px}.controls{min-height:108px;padding:40px 22px 7px}.controls::before{top:10px}.controls::after{top:29px}.dpad{width:108px;height:108px;grid-template-columns:repeat(3,36px);grid-template-rows:repeat(3,36px)}.dpad button,.dpad i{font-size:14px}.abButtons button{width:62px;height:62px}.abButtons b{font-size:22px}.dialogueBox{min-height:104px}.dialogueBox p{font-size:13px}.menuWindow{max-height:76dvh}}'''
css=rep(css,old_media,new_media,'short viewport control deck')
css_path.write_text(css)

progress_path=ROOT/'PROGRESS.md'
progress=progress_path.read_text()
marker='## Visual Reconstruction Pass 3 — seamless terrain + controller deck'
if marker not in progress:
    progress += '''\n\n## Visual Reconstruction Pass 3 — seamless terrain + controller deck\n- Cropped atlas presentation rims during map rendering so 16x16 tiles read as continuous terrain rather than a visible square grid.\n- Rebuilt the large lower touch-control area as an intentional SNES-inspired PRISM LINK controller deck with stronger tactile targets and regional accent framing.\n- Required validation: 402x690 DPR3 village/world screenshots, touch control bounds, no page overflow, battle/Chapter regression.\n'''
    progress_path.write_text(progress)
print('SFC visual reconstruction pass 3 applied')
