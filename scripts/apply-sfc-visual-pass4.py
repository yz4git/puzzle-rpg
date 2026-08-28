from pathlib import Path

ROOT=Path('.')

def rep(text,before,after,label):
    if before not in text: raise RuntimeError(f'missing target: {label}')
    return text.replace(before,after,1)

path=ROOT/'app/rpg/RPGMode.tsx'
text=path.read_text()
anchor='''function drawTerrainEdge(context: CanvasRenderingContext2D, map: MapDefinition, code: string, worldX: number, worldY: number, x: number, y: number) {\n'''
helper='''function sameRoute(map: MapDefinition, route: "road" | "danger", x: number, y: number) {\n  const code = tileAt(map, x, y);\n  return route === "road" ? code === "r" || code === "b" : code === "d" || code === "x";\n}\n\nfunction drawWorldRoute(context: CanvasRenderingContext2D, map: MapDefinition, code: string, worldX: number, worldY: number, x: number, y: number) {\n  if (map.id !== "world" || (code !== "r" && code !== "d")) return;\n  const route = code === "r" ? "road" : "danger";\n  const up = sameRoute(map, route, worldX, worldY - 1);\n  const right = sameRoute(map, route, worldX + 1, worldY);\n  const down = sameRoute(map, route, worldX, worldY + 1);\n  const left = sameRoute(map, route, worldX - 1, worldY);\n  const edge = route === "road" ? "#6e5538" : "#371421";\n  const base = route === "road" ? "#b99861" : "#772536";\n  const light = route === "road" ? "#d0b271" : "#b83a45";\n  const dark = route === "road" ? "#8f7049" : "#501a2a";\n  // Build one connected 10px-wide metatile path. Arms meet adjacent cells at the\n  // exact edge, removing the card-like square road tiles from the source atlas.\n  context.fillStyle = edge;\n  context.fillRect(x + 3, y + 3, 10, 10);\n  if (up) context.fillRect(x + 3, y, 10, 8);\n  if (down) context.fillRect(x + 3, y + 8, 10, 8);\n  if (left) context.fillRect(x, y + 3, 8, 10);\n  if (right) context.fillRect(x + 8, y + 3, 8, 10);\n  context.fillStyle = base;\n  context.fillRect(x + 4, y + 4, 8, 8);\n  if (up) context.fillRect(x + 4, y, 8, 9);\n  if (down) context.fillRect(x + 4, y + 7, 8, 9);\n  if (left) context.fillRect(x, y + 4, 9, 8);\n  if (right) context.fillRect(x + 7, y + 4, 9, 8);\n  const seed = stableVisualIndex(route, worldX, worldY);\n  context.fillStyle = light;\n  context.fillRect(x + 5 + seed % 4, y + 5 + (seed >> 2) % 4, route === "road" ? 2 : 1, 1);\n  context.fillStyle = dark;\n  context.fillRect(x + 4 + (seed >> 4) % 6, y + 7 + (seed >> 6) % 3, 1, 1);\n  if (route === "danger") {\n    // Corruption leaks beyond the route edges in deterministic pixel tendrils.\n    context.fillStyle = "#9a2e3d";\n    if (seed % 3 === 0) { context.fillRect(x + 1, y + 5, 3, 1); context.fillRect(x + 1, y + 4, 1, 1); }\n    if (seed % 4 === 0) { context.fillRect(x + 12, y + 10, 3, 1); context.fillRect(x + 14, y + 11, 1, 1); }\n    context.fillStyle = "#e45b4d";\n    if (seed % 5 === 0) context.fillRect(x + 7, y + 2, 1, 2);\n  }\n}\n\n'''+anchor
text=rep(text,anchor,helper,'world route helper')
old='''      const code = tileAt(map, worldX, worldY);\n      const cell = terrainAtlasCell(map, code, worldX, worldY);\n      const atlas = atlasImages.current[cell.atlas];\n      if (atlas?.complete && atlas.naturalWidth) drawAtlasTile(context, atlas, cell, viewX * TILE, viewY * TILE);\n      else drawTile(context, code, viewX * TILE, viewY * TILE, worldX, worldY);\n'''
new='''      const code = tileAt(map, worldX, worldY);\n      // World roads and danger routes receive a grass foundation; a connected\n      // metatile route is painted afterward. Bridges keep their dedicated atlas art.\n      const baseCode = map.id === "world" && (code === "r" || code === "d") ? "g" : code;\n      const cell = terrainAtlasCell(map, baseCode, worldX, worldY);\n      const atlas = atlasImages.current[cell.atlas];\n      if (atlas?.complete && atlas.naturalWidth) drawAtlasTile(context, atlas, cell, viewX * TILE, viewY * TILE);\n      else drawTile(context, baseCode, viewX * TILE, viewY * TILE, worldX, worldY);\n'''
text=rep(text,old,new,'world route grass foundation')
old2='''      const worldX = cameraX + viewX, worldY = cameraY + viewY;\n      drawTerrainEdge(context, map, tileAt(map, worldX, worldY), worldX, worldY, viewX * TILE, viewY * TILE);\n    }\n'''
new2='''      const worldX = cameraX + viewX, worldY = cameraY + viewY;\n      const code = tileAt(map, worldX, worldY);\n      drawTerrainEdge(context, map, code, worldX, worldY, viewX * TILE, viewY * TILE);\n      drawWorldRoute(context, map, code, worldX, worldY, viewX * TILE, viewY * TILE);\n    }\n'''
text=rep(text,old2,new2,'connected route drawing')
path.write_text(text)

progress=ROOT/'PROGRESS.md'
p=progress.read_text(); marker='## Visual Reconstruction Pass 4 — world metatile routes'
if marker not in p:
    p += '''\n\n## Visual Reconstruction Pass 4 — world metatile routes\n- Replaced modern-looking dashed world road atlas cells with connected dirt-road metatiles painted over the grass foundation.\n- Replaced rectangular red danger tile strips with a connected CRIMSON SCAR route plus deterministic corruption tendrils.\n- Bridges, collision, encounter danger flags, portals and map topology remain unchanged.\n- Required validation: Prism Road 402x690 screenshot, route continuity near intersections, natural encounter, battle and Chapter regression.\n'''
    progress.write_text(p)
print('SFC visual reconstruction pass 4 applied')
