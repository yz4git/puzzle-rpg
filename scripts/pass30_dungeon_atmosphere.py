from pathlib import Path

mode_path = Path('app/rpg/RPGMode.tsx')
css_path = Path('app/rpg/RPGMode.module.css')
progress_path = Path('PROGRESS.md')

text = mode_path.read_text()

anchor = '''function drawTownAmbient(context: CanvasRenderingContext2D, map: MapDefinition, cameraX: number, cameraY: number, frame: number) {'''
if anchor not in text:
    raise SystemExit('drawTownAmbient anchor missing')

insert_after = '''  context.restore();\n}\n\ntype InteractionMarkerKind = "talk" | "treasure" | "danger" | "boss" | "exit";'''
if insert_after not in text:
    raise SystemExit('town ambient end anchor missing')

dungeon_fn = r'''  context.restore();
}

function drawDungeonAmbient(context: CanvasRenderingContext2D, map: MapDefinition, cameraX: number, cameraY: number, frame: number, player: Vec2) {
  if (map.kind !== "dungeon" && map.kind !== "danger") return;
  const phase = frame % 8;
  context.save();

  if (map.id === "oldTemple") {
    // Slow dust and old torch embers keep the first dungeon ancient rather than busy.
    for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
      const worldX = cameraX + viewX, worldY = cameraY + viewY;
      if (tileAt(map, worldX, worldY) === "#") continue;
      const seed = stableVisualIndex("temple-dust", worldX, worldY);
      if ((seed + phase) % 19 !== 0) continue;
      context.globalAlpha = .28; context.fillStyle = phase % 2 ? "#d8c996" : "#8fa076";
      context.fillRect(viewX * TILE + 2 + (seed + phase) % 10, viewY * TILE + 3 + (phase % 6), 1, 1);
    }
    context.globalAlpha = .5;
    for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
      const worldX = cameraX + viewX, worldY = cameraY + viewY;
      if (tileAt(map, worldX, worldY) !== "#" || tileAt(map, worldX, worldY + 1) === "#") continue;
      const seed = stableVisualIndex("temple-ember", worldX, worldY);
      if ((seed + phase) % 7 !== 0) continue;
      const x = viewX * TILE + 6 + seed % 5, y = viewY * TILE + 11 - phase % 3;
      context.fillStyle = phase % 2 ? "#f4c85d" : "#c86a3e"; context.fillRect(x, y, 2, 2);
    }
  } else if (map.id === "crimsonMarsh") {
    // Hazard cells breathe with bubbles while sparse fog crosses the walkable floor.
    for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
      const worldX = cameraX + viewX, worldY = cameraY + viewY;
      const code = tileAt(map, worldX, worldY);
      const seed = stableVisualIndex("marsh-bubble", worldX, worldY);
      if (code === "x" && (seed + phase) % 4 === 0) {
        const x = viewX * TILE + 3 + seed % 9, y = viewY * TILE + 10 - phase % 5;
        context.globalAlpha = .68; context.fillStyle = phase % 2 ? "#ef755f" : "#a52d4f";
        context.fillRect(x, y, 3, 1); context.fillRect(x + 1, y - 1, 1, 3);
      } else if (code !== "#" && (seed + phase) % 31 === 0) {
        context.globalAlpha = .18; context.fillStyle = "#d5a1b4";
        context.fillRect(viewX * TILE - 3 + phase * 3, viewY * TILE + 5 + seed % 6, 14, 2);
      }
    }
  } else if (map.id === "mirrorTower") {
    // Thin moving mirror streaks imply reflections without changing collision readability.
    for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
      const worldX = cameraX + viewX, worldY = cameraY + viewY;
      const code = tileAt(map, worldX, worldY);
      const seed = stableVisualIndex("mirror-shine", worldX, worldY);
      if (code === "#" || (seed + phase) % 11 !== 0) continue;
      const x = viewX * TILE + 2 + (phase * 2 + seed) % 9, y = viewY * TILE + 3 + seed % 8;
      context.globalAlpha = .62; context.fillStyle = phase % 2 ? "#d8f7f2" : "#c9b8ff";
      context.fillRect(x, y, 5, 1); context.fillRect(x + 2, y - 2, 1, 5);
    }
  } else if (map.id === "voidPass") {
    // Wind cuts across the pass in stepped bands; dark flecks move the opposite way.
    context.globalAlpha = .24; context.fillStyle = "#9baab6";
    for (let lane = 0; lane < 5; lane += 1) {
      const y = 18 + lane * 34 + ((lane + phase) % 3) * 3;
      const x = -24 + ((phase * 29 + lane * 41) % (VIEW_W * TILE + 48));
      context.fillRect(x, y, 22 + (lane % 2) * 10, 1);
      context.fillRect(x + 8, y + 2, 9, 1);
    }
    context.globalAlpha = .34; context.fillStyle = "#10131b";
    for (let lane = 0; lane < 4; lane += 1) {
      const x = VIEW_W * TILE - ((phase * 19 + lane * 53) % (VIEW_W * TILE + 28));
      context.fillRect(x, 29 + lane * 42, 7, 2);
    }
  } else if (map.id === "prismCitadel") {
    // The final dungeon pulses harder toward the throne, making progression feel oppressive.
    const approach = clamp(1 - player.y / Math.max(1, map.height - 1), 0, 1);
    const pulseAlpha = .15 + approach * .24 + (phase % 2 ? .05 : 0);
    context.globalAlpha = pulseAlpha;
    for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
      const worldX = cameraX + viewX, worldY = cameraY + viewY;
      const code = tileAt(map, worldX, worldY);
      const seed = stableVisualIndex("citadel-vein", worldX, worldY);
      if (code === "#") {
        if ((seed + phase) % 6 !== 0) continue;
        context.fillStyle = phase % 2 ? "#d7c46f" : "#9f7dd4";
        context.fillRect(viewX * TILE + 3 + seed % 7, viewY * TILE + 10, 5, 1);
      } else if ((seed + phase) % 17 === 0) {
        context.fillStyle = phase % 2 ? "#d9b7ff" : "#f2dc86";
        const x = viewX * TILE + 4 + seed % 6, y = viewY * TILE + 4 + phase % 5;
        context.fillRect(x, y, 2, 2); context.fillRect(x - 2, y + 1, 6, 1);
      }
    }
    context.globalAlpha = .08 + approach * .12;
    context.fillStyle = phase % 2 ? "#6f4c92" : "#b0934b";
    const sweepY = (phase * 31 + Math.floor(approach * 17)) % (VIEW_H * TILE);
    context.fillRect(0, sweepY, VIEW_W * TILE, 2);
  }

  context.restore();
}

type InteractionMarkerKind = "talk" | "treasure" | "danger" | "boss" | "exit";'''
text = text.replace(insert_after, dungeon_fn, 1)

state_anchor = '''  const [fieldEnemyFrame, setFieldEnemyFrame] = useState(0);\n  const [townLifeFrame, setTownLifeFrame] = useState(0);\n  const [walkFrame, setWalkFrame] = useState(0);'''
if state_anchor not in text:
    raise SystemExit('state anchor missing')
text = text.replace(state_anchor, '''  const [fieldEnemyFrame, setFieldEnemyFrame] = useState(0);\n  const [townLifeFrame, setTownLifeFrame] = useState(0);\n  const [dungeonLifeFrame, setDungeonLifeFrame] = useState(0);\n  const [walkFrame, setWalkFrame] = useState(0);''', 1)

effect_anchor = '''  useEffect(() => {\n    if (screen !== "overworld" || map.kind !== "town") return;\n    const timer = window.setInterval(() => setTownLifeFrame((frame) => (frame + 1) % 24), 520);\n    return () => window.clearInterval(timer);\n  }, [screen, map.id, map.kind]);\n\n  useEffect(() => {\n    const timer = window.setInterval(() => commit((current) => ({ ...current, playSeconds: current.playSeconds + 10 })), 10_000);'''
if effect_anchor not in text:
    raise SystemExit('timer effect anchor missing')
text = text.replace(effect_anchor, '''  useEffect(() => {\n    if (screen !== "overworld" || map.kind !== "town") return;\n    const timer = window.setInterval(() => setTownLifeFrame((frame) => (frame + 1) % 24), 520);\n    return () => window.clearInterval(timer);\n  }, [screen, map.id, map.kind]);\n\n  useEffect(() => {\n    if (screen !== "overworld" || (map.kind !== "dungeon" && map.kind !== "danger")) return;\n    const timer = window.setInterval(() => setDungeonLifeFrame((frame) => (frame + 1) % 24), 430);\n    return () => window.clearInterval(timer);\n  }, [screen, map.id, map.kind]);\n\n  useEffect(() => {\n    const timer = window.setInterval(() => commit((current) => ({ ...current, playSeconds: current.playSeconds + 10 })), 10_000);''', 1)

ambient_anchor = '''    drawTownAmbient(context, map, cameraX, cameraY, townLifeFrame);\n\n    map.portals.forEach'''
if ambient_anchor not in text:
    raise SystemExit('ambient draw anchor missing')
text = text.replace(ambient_anchor, '''    drawTownAmbient(context, map, cameraX, cameraY, townLifeFrame);\n    drawDungeonAmbient(context, map, cameraX, cameraY, dungeonLifeFrame, save.position);\n\n    map.portals.forEach''', 1)

deps_anchor = '''  }, [atlasVersion, fieldEnemyFrame, map, mapNpcs, save, townLifeFrame, visibleFixed, walkFrame]);'''
if deps_anchor not in text:
    raise SystemExit('render deps anchor missing')
text = text.replace(deps_anchor, '''  }, [atlasVersion, dungeonLifeFrame, fieldEnemyFrame, map, mapNpcs, save, townLifeFrame, visibleFixed, walkFrame]);''', 1)

frame_anchor = '''      <div className={styles.worldFrame}>'''
if frame_anchor not in text:
    raise SystemExit('worldFrame anchor missing')
text = text.replace(frame_anchor, '''      <div className={styles.worldFrame} data-atmosphere={map.id === "prismCitadel" ? "citadel" : map.id === "voidPass" ? "void" : map.kind === "dungeon" ? "dungeon" : "none"}>''', 1)

mode_path.write_text(text)

css = css_path.read_text()
css += r'''

/* SFC visual reconstruction pass 30 — dungeon atmosphere */
.worldFrame[data-atmosphere="dungeon"] .worldGloss{background:linear-gradient(180deg,rgba(9,8,14,.04),transparent 35%,rgba(5,4,9,.16)),radial-gradient(ellipse at 50% 48%,transparent 45%,rgba(2,2,6,.28) 100%)}
.worldFrame[data-atmosphere="void"] .worldGloss{background:repeating-linear-gradient(0deg,transparent 0 5px,rgba(157,179,191,.025) 6px),radial-gradient(ellipse at 50% 50%,transparent 38%,rgba(3,5,9,.42) 100%)}
.worldFrame[data-atmosphere="citadel"] .worldGloss{background:repeating-linear-gradient(0deg,transparent 0 3px,rgba(218,196,111,.035) 4px),radial-gradient(ellipse at 50% 46%,rgba(125,84,155,.05),transparent 42%,rgba(5,2,10,.5) 100%);box-shadow:inset 0 0 0 2px rgba(190,158,219,.12),inset 0 0 34px rgba(4,1,8,.7)}
.worldFrame[data-atmosphere="citadel"]{box-shadow:0 0 0 2px #08060b,0 0 0 4px #564469,0 7px #020204,0 0 20px rgba(115,78,145,.16)}
@media(prefers-reduced-motion:reduce){.worldFrame[data-atmosphere="citadel"],.worldFrame[data-atmosphere="void"],.worldFrame[data-atmosphere="dungeon"]{scroll-behavior:auto}}
'''
css_path.write_text(css)

progress = progress_path.read_text()
progress += '''\n\n## SFC Visual Reconstruction Pass 30 — Dungeon atmosphere\n- Added low-frequency ambient animation to dungeon/danger exploration only: temple dust and embers, Crimson Marsh bubbles/fog, Mirror Tower reflection streaks, Void Pass crosswinds/shadows, and Prism Citadel prism veins/sweeps.\n- Prism Citadel atmosphere now increases visually as the hero approaches the throne while leaving map coordinates, encounter logic and progression untouched.\n- Added dungeon-specific viewport grading/vignettes, with a stronger final-dungeon bezel and scan texture.\n- Ambient redraw runs at a restrained 430ms cadence only while actively exploring dungeon/danger maps; battle, menu and town screens do not pay this cost.\n- Collision, portal targets, treasure rewards, enemy tables, boss flags, save data and Chapter Battle remain unchanged.\n'''
progress_path.write_text(progress)
