from pathlib import Path

path = Path('app/rpg/RPGMode.tsx')
text = path.read_text()
if 'function drawNpcRoleProp(' in text:
    raise SystemExit('Pass 9 already applied')

anchor = 'function worldEnemyTable(position: Vec2, danger: boolean) {'
if anchor not in text:
    raise SystemExit('world enemy anchor missing')
block = r'''
function drawNpcRoleProp(context: CanvasRenderingContext2D, npc: NPCDefinition, x: number, y: number) {
  context.save();
  const dark = "#17131a";
  if (npc.sprite === "merchant") {
    context.fillStyle = "#5b3827"; context.fillRect(x - 5, y + 9, 6, 7); context.fillRect(x + 15, y + 10, 5, 6);
    context.fillStyle = "#c58b4d"; context.fillRect(x - 4, y + 10, 4, 2); context.fillRect(x + 16, y + 11, 3, 2);
  } else if (npc.sprite === "soldier") {
    context.fillStyle = dark; context.fillRect(x - 5, y + 3, 3, 13);
    context.fillStyle = "#87929a"; context.fillRect(x - 4, y + 2, 1, 12); context.fillRect(x - 6, y + 4, 5, 2);
  } else if (npc.sprite === "priest") {
    context.fillStyle = "#493728"; context.fillRect(x + 14, y + 10, 5, 6);
    context.fillStyle = "#78a85b"; context.fillRect(x + 13, y + 7, 2, 4); context.fillRect(x + 16, y + 6, 2, 5);
  } else if (npc.sprite === "scholar") {
    context.fillStyle = dark; context.fillRect(x - 5, y + 10, 7, 5);
    context.fillStyle = "#b58c58"; context.fillRect(x - 4, y + 9, 5, 3);
    context.fillStyle = "#e1d09b"; context.fillRect(x - 3, y + 9, 2, 2);
  } else if (npc.sprite === "elder" || npc.sprite === "traveller") {
    context.fillStyle = dark; context.fillRect(x + 16, y + 3, 2, 13);
    context.fillStyle = "#9b7048"; context.fillRect(x + 16, y + 2, 1, 13);
  } else if (npc.sprite === "master") {
    context.globalAlpha = .58; context.fillStyle = "#c4a75d";
    context.fillRect(x - 5, y + 13, 26, 2); context.fillRect(x + 7, y + 8, 2, 12);
    context.fillStyle = "#6b4c34"; context.fillRect(x + 1, y + 11, 14, 6);
  } else if (npc.sprite === "mystery") {
    context.globalAlpha = .6; context.fillStyle = "#71548c";
    context.fillRect(x - 4, y + 13, 4, 2); context.fillRect(x + 16, y + 10, 4, 2); context.fillRect(x + 1, y + 15, 15, 1);
  } else if (npc.sprite === "child") {
    context.fillStyle = "#b04d55"; context.fillRect(x + 15, y + 12, 4, 4);
    context.fillStyle = "#e2ba64"; context.fillRect(x + 16, y + 13, 2, 2);
  }
  context.restore();
}

function drawTalkMarker(context: CanvasRenderingContext2D, x: number, y: number) {
  context.save();
  context.fillStyle = "#111017"; context.fillRect(x + 7, y - 24, 10, 11);
  context.fillStyle = "#f1d06a"; context.fillRect(x + 8, y - 23, 8, 9);
  context.fillStyle = "#231c21"; context.fillRect(x + 11, y - 21, 2, 4); context.fillRect(x + 11, y - 16, 2, 2);
  context.fillStyle = "#f1d06a"; context.fillRect(x + 10, y - 13, 4, 2);
  context.restore();
}

'''
text = text.replace(anchor, block + anchor)

map_anchor = '''  const mapNpcs = useMemo(() => npcsForMap(map.id).filter((npc) => hasFlag(save, npc.requireFlag) && (!npc.hideAfterFlag || !hasFlag(save, npc.hideAfterFlag))), [map.id, save]);
  const visibleFixed = useMemo(() => map.fixedEncounters.filter((entry) => hasFlag(save, entry.requireFlag) && !save.defeatedEncounters.includes(entry.id)), [map, save]);'''
if map_anchor not in text:
    raise SystemExit('map npc anchor missing')
text = text.replace(map_anchor, '''  const mapNpcs = useMemo(() => npcsForMap(map.id).filter((npc) => hasFlag(save, npc.requireFlag) && (!npc.hideAfterFlag || !hasFlag(save, npc.hideAfterFlag))), [map.id, save]);
  const speakerNpc = useMemo(() => mapNpcs.find((npc) => npc.name === speaker) ?? null, [mapNpcs, speaker]);
  const speakerNpcCell = speakerNpc ? npcAtlasCell(speakerNpc.sprite) : null;
  const visibleFixed = useMemo(() => map.fixedEncounters.filter((entry) => hasFlag(save, entry.requireFlag) && !save.defeatedEncounters.includes(entry.id)), [map, save]);''')

move_anchor = '''    const code = tileAt(map, nextPosition.x, nextPosition.y);
    const danger = isDangerTile(code);'''
# Need insert before tileBlocked earlier, so target the actual block.
blocked_anchor = '''    if (tileBlocked(map, nextPosition)) {
      commit((current) => ({ ...current, direction })); setNotice("道がふさがっている。・ Aで調べる"); playSfx("uiSelect"); return;
    }
    const code = tileAt(map, nextPosition.x, nextPosition.y);'''
if blocked_anchor not in text:
    raise SystemExit('blocked move anchor missing')
text = text.replace(blocked_anchor, '''    const blockingNpc = mapNpcs.find((npc) => npc.x === nextPosition.x && npc.y === nextPosition.y);
    if (blockingNpc) {
      commit((current) => ({ ...current, direction })); setNotice(`${blockingNpc.name} • Aで話す`); playSfx("uiSelect"); return;
    }
    if (tileBlocked(map, nextPosition)) {
      commit((current) => ({ ...current, direction })); setNotice("道がふさがっている • Aで調べる"); playSfx("uiSelect"); return;
    }
    const code = tileAt(map, nextPosition.x, nextPosition.y);''')

npc_anchor = '''      if (npcAtlas?.complete && npcAtlas.naturalWidth) {
        const cell = npcAtlasCell(npc.sprite);
        drawGroundShadow(context, x - 5, y + TILE, 26);
        context.drawImage(npcAtlas, cell.col * 96, cell.row * 128, 96, 128, x - 5, y - 18, 26, 34);
      } else drawPerson(context, x, y, npcColors[npc.palette % npcColors.length]!, "down", 0);'''
if npc_anchor not in text:
    raise SystemExit('npc draw anchor missing')
text = text.replace(npc_anchor, '''      drawNpcRoleProp(context, npc, x, y);
      if (npcAtlas?.complete && npcAtlas.naturalWidth) {
        const cell = npcAtlasCell(npc.sprite);
        drawGroundShadow(context, x - 5, y + TILE, 26);
        context.drawImage(npcAtlas, cell.col * 96, cell.row * 128, 96, 128, x - 5, y - 18, 26, 34);
      } else drawPerson(context, x, y, npcColors[npc.palette % npcColors.length]!, "down", 0);
      const delta = DIR_DELTA[save.direction];
      if (npc.x === save.position.x + delta.x && npc.y === save.position.y + delta.y) drawTalkMarker(context, x, y);''')

old_dialogue = '''      {(screen === "dialogue" || screen === "event") && dialogue.length ? <div className={styles.dialogueOverlay} onPointerDown={(event) => { event.preventDefault(); advanceDialogue(); }}>
        <div className={styles.dialogueBox}><span>{speaker}</span><p>{dialogue[dialogueIndex]}</p><small>A / TAP ▼</small></div>
      </div> : null}'''
if old_dialogue not in text:
    raise SystemExit('dialogue JSX anchor missing')
new_dialogue = '''      {(screen === "dialogue" || screen === "event") && dialogue.length ? <div className={styles.dialogueOverlay} onPointerDown={(event) => { event.preventDefault(); advanceDialogue(); }}>
        <div className={styles.dialogueBox} data-portrait={Boolean(speakerNpcCell)}>
          {speakerNpcCell ? <i className={styles.dialoguePortrait} aria-hidden="true" style={{ backgroundImage: `url(${RPG_ASSETS.npcs})`, backgroundSize: "192px 192px", backgroundPosition: `${-speakerNpcCell.col * 48}px ${-speakerNpcCell.row * 64}px` }} /> : null}
          <span>{speaker}</span><p>{dialogue[dialogueIndex]}</p><small>A / TAP ▼</small>
        </div>
      </div> : null}'''
text = text.replace(old_dialogue, new_dialogue)

path.write_text(text)

css = Path('app/rpg/RPGMode.module.css')
css_text = css.read_text()
css_anchor = '.dialogueBox{width:min(100%,430px);min-height:112px;display:grid;grid-template-rows:auto 1fr auto;gap:5px;padding:8px 11px;border:3px solid #f4ecd4;box-shadow:0 0 0 2px #09080c,0 0 0 4px var(--accent2),5px 6px #000;background:linear-gradient(#111421,#07080e)}.dialogueBox span{color:var(--accent);font-size:8px;letter-spacing:.12em}.dialogueBox p{margin:0;font-size:14px;line-height:1.5;font-weight:900;text-shadow:1px 1px #000}.dialogueBox small{text-align:right;color:#bbb;font-size:7px}'
if css_anchor not in css_text:
    raise SystemExit('dialogue CSS anchor missing')
css_new = css_anchor + '.dialogueBox[data-portrait="true"]{grid-template-columns:54px 1fr;grid-template-rows:auto 1fr auto;column-gap:9px}.dialogueBox[data-portrait="true"]>span,.dialogueBox[data-portrait="true"]>p,.dialogueBox[data-portrait="true"]>small{grid-column:2}.dialoguePortrait{grid-column:1;grid-row:1/4;width:48px;height:64px;align-self:center;border:2px solid var(--accent2);box-shadow:inset 0 0 0 1px #050507,2px 3px #000;background-color:#090910;background-repeat:no-repeat;image-rendering:pixelated}'
css_text = css_text.replace(css_anchor, css_new)
css.write_text(css_text)

progress = Path('PROGRESS.md')
progress.write_text(progress.read_text() + '''\n\n## SFC Visual Reconstruction Pass 9 — Character / dialogue presentation\n- Added role-specific environmental props behind merchants, soldiers, priests, scholars, elders, masters, mystery NPCs and children.\n- Added a pixel talk marker only for the NPC directly in front of the hero and contextual bump text (`NPC name • Aで話す`).\n- Added crisp 48x64 atlas portraits to NPC dialogue windows while keeping story/system dialogue portrait-free.\n- Dialogue behavior and NPC actions are unchanged.\n''')
