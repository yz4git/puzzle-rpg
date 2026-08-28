from pathlib import Path

root = Path('.')
tsx = root / 'app/rpg/RPGMode.tsx'
css = root / 'app/rpg/RPGMode.module.css'
progress = root / 'PROGRESS.md'

text = tsx.read_text()

old = '''  const [encounterCue, setEncounterCue] = useState<EncounterCueState>(null);\n  const [dangerWarning, setDangerWarning] = useState<string | null>(null);\n  const [walkFrame, setWalkFrame] = useState(0);'''
new = '''  const [encounterCue, setEncounterCue] = useState<EncounterCueState>(null);\n  const [dangerWarning, setDangerWarning] = useState<string | null>(null);\n  const [fieldEnemyFrame, setFieldEnemyFrame] = useState(0);\n  const [walkFrame, setWalkFrame] = useState(0);'''
if old not in text: raise SystemExit('state target not found')
text = text.replace(old, new, 1)

old = '''  const visibleFixed = useMemo(() => map.fixedEncounters.filter((entry) => hasFlag(save, entry.requireFlag) && !save.defeatedEncounters.includes(entry.id)), [map, save]);\n  const currentTile = tileAt(map, save.position.x, save.position.y);'''
new = '''  const visibleFixed = useMemo(() => map.fixedEncounters.filter((entry) => hasFlag(save, entry.requireFlag) && !save.defeatedEncounters.includes(entry.id)), [map, save]);\n  const currentTile = tileAt(map, save.position.x, save.position.y);\n  const nearbyThreat = useMemo(() => {\n    let closest: { entry: (typeof visibleFixed)[number]; distance: number } | null = null;\n    for (const entry of visibleFixed) {\n      const distance = Math.abs(entry.x - save.position.x) + Math.abs(entry.y - save.position.y);\n      if (!closest || distance < closest.distance) closest = { entry, distance };\n    }\n    return closest && closest.distance <= 3 ? closest : null;\n  }, [visibleFixed, save.position.x, save.position.y]);'''
if old not in text: raise SystemExit('nearby target not found')
text = text.replace(old, new, 1)

old = '''  useEffect(() => {\n    const timer = window.setInterval(() => commit((current) => ({ ...current, playSeconds: current.playSeconds + 10 })), 10_000);\n    return () => window.clearInterval(timer);\n  }, []);'''
new = '''  useEffect(() => {\n    if (screen !== "overworld" || !visibleFixed.length) return;\n    const timer = window.setInterval(() => setFieldEnemyFrame((frame) => (frame + 1) % 4), 360);\n    return () => window.clearInterval(timer);\n  }, [screen, map.id, visibleFixed.length]);\n\n  useEffect(() => {\n    const timer = window.setInterval(() => commit((current) => ({ ...current, playSeconds: current.playSeconds + 10 })), 10_000);\n    return () => window.clearInterval(timer);\n  }, []);'''
if old not in text: raise SystemExit('timer target not found')
text = text.replace(old, new, 1)

old = '''    visibleFixed.forEach((entry) => {\n      const x = (entry.x - cameraX) * TILE, y = (entry.y - cameraY) * TILE;\n      const sprite = enemySpriteCell(entry.enemyId, "idle");\n      const atlasKey: AtlasImageKey | null = !sprite ? null : sprite.src === RPG_ASSETS.enemyA ? "enemyA" : sprite.src === RPG_ASSETS.enemyB ? "enemyB" : "bosses";\n      const atlas = atlasKey ? atlasImages.current[atlasKey] : null;\n      if (sprite && atlas?.complete && atlas.naturalWidth) {\n        const sourceWidth = atlas.naturalWidth / sprite.columns;\n        const sourceHeight = atlas.naturalHeight / sprite.rows;\n        const size = ENEMIES[entry.enemyId]?.boss ? 32 : 26;\n        drawGroundShadow(context, x + (TILE - size) / 2, y + TILE, size);\n        context.drawImage(atlas, sprite.col * sourceWidth, sprite.row * sourceHeight, sourceWidth, sourceHeight, x + (TILE - size) / 2, y + TILE - size, size, size);\n      } else {\n        context.fillStyle = "#08080d"; context.fillRect(x + 2, y + 2, 12, 12); context.fillStyle = "#ff4f64"; context.fillRect(x + 5, y + 4, 6, 7);\n      }\n    });'''
new = '''    visibleFixed.forEach((entry) => {\n      const x = (entry.x - cameraX) * TILE, y = (entry.y - cameraY) * TILE;\n      const enemy = ENEMIES[entry.enemyId];\n      const boss = Boolean(enemy?.boss);\n      const proximity = Math.abs(entry.x - save.position.x) + Math.abs(entry.y - save.position.y);\n      const alerted = proximity <= 2;\n      const pulse = fieldEnemyFrame % 2;\n      const frame = alerted && pulse ? "reaction" : !boss && pulse ? "reaction" : "idle";\n      const sprite = enemySpriteCell(entry.enemyId, frame);\n      const atlasKey: AtlasImageKey | null = !sprite ? null : sprite.src === RPG_ASSETS.enemyA ? "enemyA" : sprite.src === RPG_ASSETS.enemyB ? "enemyB" : "bosses";\n      const atlas = atlasKey ? atlasImages.current[atlasKey] : null;\n      const size = boss ? 38 : 28;\n      const bob = pulse ? -1 : 0;\n\n      context.save();\n      context.globalAlpha = boss ? .76 : alerted ? .58 : .34;\n      context.fillStyle = boss ? "#b559d1" : alerted ? "#ff5a60" : "#9d3545";\n      const aura = boss ? 27 : alerted ? 21 : 17;\n      const auraX = x + 8 - Math.floor(aura / 2), auraY = y + 13 - Math.floor(aura / 2);\n      context.fillRect(auraX, auraY + 5, aura, 2);\n      context.fillRect(auraX + 5, auraY, 2, aura);\n      context.fillRect(auraX + aura - 7, auraY, 2, aura);\n      context.fillRect(auraX, auraY + aura - 7, aura, 2);\n      if (boss || alerted) {\n        context.fillStyle = boss ? "#f1c76b" : "#ffaba4";\n        const spark = (fieldEnemyFrame + stableVisualIndex(entry.id, entry.x, entry.y)) % 4;\n        context.fillRect(x - 3 + spark * 6, y - 5 - (spark % 2) * 2, 2, 3);\n        context.fillRect(x + 17 - spark * 3, y + 1 + spark * 3, 2, 2);\n      }\n      context.restore();\n\n      if (sprite && atlas?.complete && atlas.naturalWidth) {\n        const sourceWidth = atlas.naturalWidth / sprite.columns;\n        const sourceHeight = atlas.naturalHeight / sprite.rows;\n        drawGroundShadow(context, x + (TILE - size) / 2, y + TILE, size);\n        context.drawImage(atlas, sprite.col * sourceWidth, sprite.row * sourceHeight, sourceWidth, sourceHeight, x + (TILE - size) / 2, y + TILE - size + bob, size, size);\n      } else {\n        context.fillStyle = "#08080d"; context.fillRect(x + 2, y + 2 + bob, 12, 12); context.fillStyle = "#ff4f64"; context.fillRect(x + 5, y + 4 + bob, 6, 7);\n      }\n      if (alerted) {\n        context.fillStyle = "#09070b"; context.fillRect(x + 5, y - (boss ? 18 : 13), 7, 8);\n        context.fillStyle = boss ? "#ffd86a" : "#ff6868"; context.fillRect(x + 7, y - (boss ? 17 : 12), 3, 4); context.fillRect(x + 7, y - (boss ? 12 : 7), 3, 2);\n      }\n    });'''
if old not in text: raise SystemExit('fixed render target not found')
text = text.replace(old, new, 1)

old = '''  }, [atlasVersion, map, mapNpcs, save, visibleFixed, walkFrame]);'''
new = '''  }, [atlasVersion, fieldEnemyFrame, map, mapNpcs, save, visibleFixed, walkFrame]);'''
if old not in text: raise SystemExit('canvas deps target not found')
text = text.replace(old, new, 1)

old = '''      <div className={styles.worldFrame}>\n        <canvas ref={canvasRef} className={styles.world} width={VIEW_W * TILE * WORLD_RENDER_SCALE} height={VIEW_H * TILE * WORLD_RENDER_SCALE} aria-label={`${map.name} exploration map`} />\n        <div className={styles.worldGloss} aria-hidden="true" />\n      </div>'''
new = '''      <div className={styles.worldFrame}>\n        <canvas ref={canvasRef} className={styles.world} width={VIEW_W * TILE * WORLD_RENDER_SCALE} height={VIEW_H * TILE * WORLD_RENDER_SCALE} aria-label={`${map.name} exploration map`} />\n        <div className={styles.worldGloss} aria-hidden="true" />\n        {nearbyThreat ? <div className={styles.fieldThreat} data-boss={ENEMIES[nearbyThreat.entry.enemyId]?.boss ? "true" : "false"} data-alert={nearbyThreat.distance <= 1 ? "true" : "false"}>\n          <span>{ENEMIES[nearbyThreat.entry.enemyId]?.boss ? "BOSS" : "HOSTILE"}</span><strong>{ENEMIES[nearbyThreat.entry.enemyId]?.name ?? nearbyThreat.entry.enemyId}</strong><small>{nearbyThreat.distance <= 1 ? "A • CONFRONT" : `${nearbyThreat.distance} TILES`}</small>\n        </div> : null}\n      </div>'''
if old not in text: raise SystemExit('world frame target not found')
text = text.replace(old, new, 1)

tsx.write_text(text)

addition = r'''

/* SFC visual reconstruction pass 28 — field enemy presence */
.fieldThreat{position:absolute;z-index:4;left:7px;right:7px;top:7px;min-height:25px;display:grid;grid-template-columns:auto 1fr auto;gap:6px;align-items:center;padding:3px 6px;border:2px solid #833d46;background:linear-gradient(90deg,rgba(29,8,13,.94),rgba(9,8,13,.88));box-shadow:0 0 0 1px #050507,2px 3px #000;pointer-events:none;animation:fieldThreatIn 180ms steps(4,end) both}
.fieldThreat span{padding:2px 4px;border:1px solid #9e454b;background:#17090c;color:#ff7772;font:900 5px/1 monospace;letter-spacing:.13em}.fieldThreat strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff0d6;font:1000 8px/1 monospace;text-shadow:1px 1px #000}.fieldThreat small{color:#d57e7d;font:900 5px/1 monospace;letter-spacing:.08em;white-space:nowrap}
.fieldThreat[data-boss="true"]{border-color:#a77a43;background:linear-gradient(90deg,rgba(38,22,8,.95),rgba(18,10,23,.92));box-shadow:0 0 0 1px #050507,inset 0 0 0 1px #5c3e57,2px 3px #000}.fieldThreat[data-boss="true"] span{border-color:#b68b49;background:#221407;color:#ffe17a}.fieldThreat[data-boss="true"] strong{color:#ffe8a4}.fieldThreat[data-boss="true"] small{color:#dcbf73}.fieldThreat[data-alert="true"]{animation:fieldThreatAlert 520ms steps(2,end) infinite}
@keyframes fieldThreatIn{0%{opacity:0;transform:translateY(-8px)}100%{opacity:1;transform:none}}@keyframes fieldThreatAlert{0%,49%{filter:brightness(1)}50%,100%{filter:brightness(1.22)}}
@media(max-height:620px){.fieldThreat{top:5px;min-height:22px;padding-block:2px}.fieldThreat strong{font-size:7px}}
@media(prefers-reduced-motion:reduce){.fieldThreat,.fieldThreat[data-alert="true"]{animation:none!important}}
'''
css.write_text(css.read_text() + addition)

section = '''\n\n## SFC Visual Reconstruction Pass 28 — Field enemy presence\n- Animated fixed field enemies with a low-frequency stepped idle cadence using existing enemy frames, plus subtle bobbing and deterministic pixel aura/spark accents.\n- Added proximity reactions within two tiles, including reaction frames and an alert glyph; bosses use a larger silhouette, gold/purple threat aura and stronger approach presence.\n- Added a compact in-world threat plaque within three tiles so HOSTILE/BOSS identity and A • CONFRONT state are readable before interaction.\n- Enemy coordinates, collision, fixed encounter flags, boss conditions, encounter tables, battle timing, rewards and save data are unchanged.\n'''
progress.write_text(progress.read_text() + section)
