from pathlib import Path

path = Path('app/rpg/RPGMode.tsx')
text = path.read_text()
old = '''          {speakerNpcCell ? <i className={styles.dialoguePortrait} aria-hidden="true" style={{ backgroundImage: `url(${RPG_ASSETS.npcs})`, backgroundSize: "192px 192px", backgroundPosition: `${-speakerNpcCell.col * 48}px ${-speakerNpcCell.row * 64}px` }} /> : null}
'''
new = '''          {speakerNpcCell ? <i className={styles.dialoguePortrait} aria-hidden="true" data-sprite={speakerNpc?.sprite} style={{
            backgroundImage: `url(${RPG_ASSETS.npcs})`,
            // The field atlas stores complete 96x128 actors. Dialogue uses a centered
            // upper-body crop so faces read at conversation scale without a second asset.
            backgroundSize: "288px 288px",
            backgroundPosition: `${-(speakerNpcCell.col * 72 + 12)}px ${-(speakerNpcCell.row * 96 + (speakerNpc?.sprite === "child" ? 8 : 4))}px`,
          }} /> : null}
'''
if old not in text:
    raise SystemExit('portrait JSX not found')
path.write_text(text.replace(old, new, 1))

css_path = Path('app/rpg/RPGMode.module.css')
css = css_path.read_text()
old_css = '.dialoguePortrait{grid-column:1;grid-row:1/4;width:48px;height:64px;align-self:center;border:2px solid var(--accent2);box-shadow:inset 0 0 0 1px #050507,2px 3px #000;background-color:#090910;background-repeat:no-repeat;image-rendering:pixelated}'
new_css = '.dialoguePortrait{grid-column:1;grid-row:1/4;width:48px;height:64px;align-self:center;overflow:hidden;border:2px solid var(--accent2);box-shadow:inset 0 0 0 1px #050507,2px 3px #000;background-color:#090910;background-repeat:no-repeat;image-rendering:pixelated}.dialoguePortrait::after{content:"";position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 -8px rgba(0,0,0,.12),inset 0 1px rgba(255,255,255,.12)}'
# Pseudo element on an <i> needs positioning context.
new_css = new_css.replace('overflow:hidden;', 'position:relative;overflow:hidden;')
if old_css not in css:
    raise SystemExit('portrait CSS not found')
css_path.write_text(css.replace(old_css, new_css, 1))

progress = Path('PROGRESS.md')
p = progress.read_text()
section = '''\n\n## SFC Visual Reconstruction Pass 11 — Dialogue portrait crop\n- Reframed NPC dialogue portraits from full-body thumbnails to centered upper-body crops using the existing high-resolution NPC atlas.\n- Kept story/system dialogue portrait-free and preserved all dialogue logic and NPC actions.\n- Added a restrained inner portrait-frame highlight/shadow without adding new production assets.\n'''
if '## SFC Visual Reconstruction Pass 11' not in p:
    progress.write_text(p.rstrip() + section)
