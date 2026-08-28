from pathlib import Path

rpg_path = Path('app/rpg/RPGMode.tsx')
progress_path = Path('PROGRESS.md')
text = rpg_path.read_text()

anchor = '''  context.restore();
}

type InteractionMarkerKind = "talk" | "treasure" | "danger" | "boss" | "exit";'''
insert = '''  context.restore();
}

function drawNpcActivity(context: CanvasRenderingContext2D, npc: NPCDefinition, x: number, y: number, frame: number) {
  const phase = (frame + stableVisualIndex(npc.name, npc.x, npc.y)) % 8;
  context.save();
  if (npc.sprite === "merchant") {
    if (phase <= 1) { context.fillStyle = "#ffe07a"; context.fillRect(x + 18, y + 7, 2, 2); context.fillRect(x + 20, y + 5, 1, 1); }
  } else if (npc.sprite === "soldier") {
    if (phase === 0 || phase === 4) { context.fillStyle = "#d5e4eb"; context.fillRect(x - 6, y + 1 + (phase === 4 ? 1 : 0), 2, 2); }
  } else if (npc.sprite === "priest") {
    if (phase <= 2) { context.fillStyle = "#b9e58f"; context.fillRect(x + 17 + phase, y + 5 - phase, 1, 2); }
  } else if (npc.sprite === "scholar") {
    context.fillStyle = phase % 4 < 2 ? "#f0dfac" : "#c9ae7c"; context.fillRect(x - 2, y + 8, 2, 2);
  } else if (npc.sprite === "elder" || npc.sprite === "traveller") {
    if (phase === 0) { context.fillStyle = "#d0a76f"; context.fillRect(x + 15, y + 15, 3, 1); }
  } else if (npc.sprite === "master") {
    if (phase <= 1) { context.globalAlpha = .7; context.fillStyle = "#ffe28b"; context.fillRect(x + 6, y + 6, 1, 1); context.fillRect(x + 10, y + 4, 1, 1); }
  } else if (npc.sprite === "mystery") {
    if (phase % 3 === 0) { context.globalAlpha = .68; context.fillStyle = "#c79cff"; context.fillRect(x - 2, y + 9 - (phase % 2), 2, 1); context.fillRect(x + 18, y + 5 + (phase % 3), 1, 2); }
  } else if (npc.sprite === "child") {
    const ballX = x + 17 + (phase % 3);
    const ballY = y + 12 - (phase % 2) * 2;
    context.fillStyle = "#e7c25d"; context.fillRect(ballX, ballY, 3, 3); context.fillStyle = "#8b3f47"; context.fillRect(ballX + 1, ballY + 1, 1, 1);
  } else if (phase === 0) {
    context.globalAlpha = .55; context.fillStyle = "#f3d890"; context.fillRect(x + 14, y + 7, 1, 1);
  }
  context.restore();
}

function drawTownAmbient(context: CanvasRenderingContext2D, map: MapDefinition, cameraX: number, cameraY: number, frame: number) {
  if (map.kind !== "town") return;
  const phase = frame % 8;
  context.save();
  if (map.id === "hearthVillage") {
    for (let worldY = cameraY; worldY < Math.min(map.height, cameraY + VIEW_H); worldY += 1) for (let worldX = cameraX; worldX < Math.min(map.width, cameraX + VIEW_W); worldX += 1) {
      if (tileAt(map, worldX, worldY) !== "h" || tileAt(map, worldX, worldY - 1) === "h" || tileAt(map, worldX - 1, worldY) === "h") continue;
      const x = (worldX - cameraX) * TILE + 11;
      const y = (worldY - cameraY) * TILE - 2 - (phase % 4) * 2;
      context.globalAlpha = .28 + (3 - phase % 4) * .08; context.fillStyle = "#d5c9b4";
      context.fillRect(x, y, 3, 2); context.fillRect(x + 2, y - 2, 2, 2);
    }
  } else if (map.id === "lakeVillage") {
    context.globalAlpha = .72; context.fillStyle = "#bff5ef";
    for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
      const worldX = cameraX + viewX, worldY = cameraY + viewY;
      if (tileAt(map, worldX, worldY) !== "w") continue;
      const seed = stableVisualIndex("lake-life", worldX, worldY);
      if ((seed + phase) % 5 !== 0) continue;
      context.fillRect(viewX * TILE + 3 + seed % 6, viewY * TILE + 5 + phase % 4, 5, 1);
    }
  } else if (map.id === "ironCity") {
    context.globalAlpha = .8;
    for (let worldY = cameraY; worldY < Math.min(map.height, cameraY + VIEW_H); worldY += 1) for (let worldX = cameraX; worldX < Math.min(map.width, cameraX + VIEW_W); worldX += 1) {
      if (tileAt(map, worldX, worldY) !== "h" || tileAt(map, worldX, worldY + 1) === "h") continue;
      const seed = stableVisualIndex("forge-life", worldX, worldY);
      if ((seed + phase) % 4 !== 0) continue;
      const x = (worldX - cameraX) * TILE + 4 + seed % 8, y = (worldY - cameraY) * TILE + 12 - phase % 3;
      context.fillStyle = phase % 2 ? "#ffd36d" : "#ef6f45"; context.fillRect(x, y, 2, 2); context.fillRect(x + 3, y - 3, 1, 2);
    }
  } else if (map.id === "reedHamlet") {
    context.globalAlpha = .58; context.fillStyle = phase % 2 ? "#d6ba69" : "#93b267";
    for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
      const worldX = cameraX + viewX, worldY = cameraY + viewY;
      if (tileAt(map, worldX, worldY) !== "." && tileAt(map, worldX, worldY) !== "r") continue;
      const seed = stableVisualIndex("reed-life", worldX, worldY);
      if ((seed + phase) % 17 !== 0) continue;
      context.fillRect(viewX * TILE + 2 + (seed + phase) % 11, viewY * TILE + 3 + (phase % 5), 2, 1);
    }
  } else if (map.id === "mirrorTown") {
    context.globalAlpha = .72;
    for (let worldY = cameraY; worldY < Math.min(map.height, cameraY + VIEW_H); worldY += 1) for (let worldX = cameraX; worldX < Math.min(map.width, cameraX + VIEW_W); worldX += 1) {
      if (tileAt(map, worldX, worldY) !== "h" || tileAt(map, worldX, worldY + 1) === "h") continue;
      const seed = stableVisualIndex("mirror-life", worldX, worldY);
      if ((seed + phase) % 5 !== 0) continue;
      const x = (worldX - cameraX) * TILE + 4 + seed % 7, y = (worldY - cameraY) * TILE + 10;
      context.fillStyle = phase % 2 ? "#d7b9ff" : "#a9edf0"; context.fillRect(x, y, 4, 1); context.fillRect(x + 1, y - 2, 1, 5);
    }
  }
  context.restore();
}

type InteractionMarkerKind = "talk" | "treasure" | "danger" | "boss" | "exit";'''
if anchor not in text:
    raise SystemExit('npc helper anchor not found')
text = text.replace(anchor, insert, 1)

old_state = '  const [fieldEnemyFrame, setFieldEnemyFrame] = useState(0);\n  const [walkFrame, setWalkFrame] = useState(0);'
new_state = '  const [fieldEnemyFrame, setFieldEnemyFrame] = useState(0);\n  const [townLifeFrame, setTownLifeFrame] = useState(0);\n  const [walkFrame, setWalkFrame] = useState(0);'
if old_state not in text:
    raise SystemExit('state anchor not found')
text = text.replace(old_state, new_state, 1)

old_effect = '''  useEffect(() => {
    if (screen !== "overworld" || !visibleFixed.length) return;
    const timer = window.setInterval(() => setFieldEnemyFrame((frame) => (frame + 1) % 4), 360);
    return () => window.clearInterval(timer);
  }, [screen, map.id, visibleFixed.length]);

  useEffect(() => {
    const timer = window.setInterval(() => commit((current) => ({ ...current, playSeconds: current.playSeconds + 10 })), 10_000);'''
new_effect = '''  useEffect(() => {
    if (screen !== "overworld" || !visibleFixed.length) return;
    const timer = window.setInterval(() => setFieldEnemyFrame((frame) => (frame + 1) % 4), 360);
    return () => window.clearInterval(timer);
  }, [screen, map.id, visibleFixed.length]);

  useEffect(() => {
    if (screen !== "overworld" || map.kind !== "town") return;
    const timer = window.setInterval(() => setTownLifeFrame((frame) => (frame + 1) % 24), 520);
    return () => window.clearInterval(timer);
  }, [screen, map.id, map.kind]);

  useEffect(() => {
    const timer = window.setInterval(() => commit((current) => ({ ...current, playSeconds: current.playSeconds + 10 })), 10_000);'''
if old_effect not in text:
    raise SystemExit('effect anchor not found')
text = text.replace(old_effect, new_effect, 1)

portal_anchor = '''    map.portals.forEach((portal, portalIndex) => {'''
if portal_anchor not in text:
    raise SystemExit('portal anchor not found')
text = text.replace(portal_anchor, '''    drawTownAmbient(context, map, cameraX, cameraY, townLifeFrame);\n\n    map.portals.forEach((portal, portalIndex) => {''', 1)

old_npcs = '''    mapNpcs.forEach((npc) => {
      const x = (npc.x - cameraX) * TILE, y = (npc.y - cameraY) * TILE;
      if (x < -TILE * 2 || y < -TILE * 2 || x >= VIEW_W * TILE + TILE || y >= VIEW_H * TILE + TILE) return;
      drawNpcRoleProp(context, npc, x, y);
      if (npcAtlas?.complete && npcAtlas.naturalWidth) {
        const cell = npcAtlasCell(npc.sprite);
        drawGroundShadow(context, x - 5, y + TILE, 26);
        context.drawImage(npcAtlas, cell.col * 96, cell.row * 128, 96, 128, x - 5, y - 18, 26, 34);
      } else drawPerson(context, x, y, npcColors[npc.palette % npcColors.length]!, "down", 0);
    });'''
new_npcs = '''    mapNpcs.forEach((npc) => {
      const x = (npc.x - cameraX) * TILE, y = (npc.y - cameraY) * TILE;
      if (x < -TILE * 2 || y < -TILE * 2 || x >= VIEW_W * TILE + TILE || y >= VIEW_H * TILE + TILE) return;
      const npcPhase = (townLifeFrame + stableVisualIndex(npc.name, npc.x, npc.y)) % 8;
      const lively = map.kind === "town";
      const bob = lively && (npc.sprite === "child" ? npcPhase % 2 === 0 : npcPhase === 0) ? -1 : 0;
      drawNpcRoleProp(context, npc, x, y + bob);
      if (npcAtlas?.complete && npcAtlas.naturalWidth) {
        const cell = npcAtlasCell(npc.sprite);
        drawGroundShadow(context, x - 5, y + TILE, 26);
        context.drawImage(npcAtlas, cell.col * 96, cell.row * 128, 96, 128, x - 5, y - 18 + bob, 26, 34);
      } else drawPerson(context, x, y + bob, npcColors[npc.palette % npcColors.length]!, "down", lively ? npcPhase : 0);
      if (lively) drawNpcActivity(context, npc, x, y + bob, townLifeFrame);
    });'''
if old_npcs not in text:
    raise SystemExit('npc draw anchor not found')
text = text.replace(old_npcs, new_npcs, 1)

old_dep = '  }, [atlasVersion, fieldEnemyFrame, map, mapNpcs, save, visibleFixed, walkFrame]);'
new_dep = '  }, [atlasVersion, fieldEnemyFrame, map, mapNpcs, save, townLifeFrame, visibleFixed, walkFrame]);'
if old_dep not in text:
    raise SystemExit('canvas dependency anchor not found')
text = text.replace(old_dep, new_dep, 1)

rpg_path.write_text(text)

progress = progress_path.read_text()
section = '''\n\n## SFC Visual Reconstruction Pass 29 — Town life and ambient motion\n- Added a low-frequency town-life animation clock that runs only while actively exploring town maps, keeping the ambient pass inexpensive on iPhone.\n- Added role-specific NPC micro-actions and one-pixel idle motion for merchants, soldiers, priests, scholars, elders, travellers, masters, mystery figures and children without changing NPC positions or interaction hit areas.\n- Added distinct ambient motion to all five towns: Hearth Village chimney smoke, Lake Village water glints, Iron City forge sparks, Reed Hamlet drifting motes and Mirror Town reflective window flashes.\n- NPC collision, dialogue, services, shops, story flags, map geometry, portals, save data and Chapter Battle remain unchanged.\n'''
if '## SFC Visual Reconstruction Pass 29 — Town life and ambient motion' not in progress:
    progress_path.write_text(progress.rstrip() + section)
