from pathlib import Path

path = Path('app/rpg/RPGMode.tsx')
text = path.read_text()
if 'function drawWorldLandmarkV2(' in text:
    raise SystemExit('Pass 7 already applied')

anchor = 'function drawWorldLandmarkGround(context: CanvasRenderingContext2D, targetMap: string, x: number, y: number, locked: boolean) {'
if anchor not in text:
    raise SystemExit('landmark anchor not found')

block = r'''
type WorldLandmarkKind = "village" | "city" | "school" | "temple" | "tower" | "marsh" | "pass" | "citadel";

function worldLandmarkKind(targetMap: string): WorldLandmarkKind {
  if (["hearthVillage", "lakeVillage", "reedHamlet", "mirrorTown"].includes(targetMap)) return "village";
  if (targetMap === "ironCity") return "city";
  if (["emberShrine", "quietBower", "ironHall", "hourSpire"].includes(targetMap)) return "school";
  if (targetMap === "oldTemple") return "temple";
  if (targetMap === "mirrorTower") return "tower";
  if (targetMap === "crimsonMarsh") return "marsh";
  if (targetMap === "voidPass") return "pass";
  return "citadel";
}

function drawPixelRoof(context: CanvasRenderingContext2D, left: number, top: number, width: number, roof: string, edge: string) {
  context.fillStyle = edge;
  context.fillRect(left + 4, top, width - 8, 2);
  context.fillRect(left + 2, top + 2, width - 4, 2);
  context.fillRect(left, top + 4, width, 3);
  context.fillStyle = roof;
  context.fillRect(left + 5, top + 1, width - 10, 1);
  context.fillRect(left + 3, top + 3, width - 6, 1);
  context.fillRect(left + 2, top + 5, width - 4, 1);
}

function drawMiniHouse(context: CanvasRenderingContext2D, left: number, top: number, width: number, roof: string, wall: string, trim: string) {
  drawPixelRoof(context, left, top, width, roof, "#1a1720");
  context.fillStyle = "#1a1720";
  context.fillRect(left + 2, top + 7, width - 4, 10);
  context.fillStyle = wall;
  context.fillRect(left + 3, top + 8, width - 6, 8);
  context.fillStyle = trim;
  context.fillRect(left + width - 6, top + 10, 2, 2);
  context.fillStyle = "#33251d";
  context.fillRect(left + Math.floor(width / 2) - 1, top + 12, 3, 4);
}

function drawWorldSeal(context: CanvasRenderingContext2D, x: number, y: number) {
  context.fillStyle = "#17131c";
  context.fillRect(x, y + 3, 8, 7);
  context.fillRect(x + 2, y, 4, 5);
  context.fillStyle = "#d8bd72";
  context.fillRect(x + 1, y + 4, 6, 5);
  context.fillStyle = "#5b456b";
  context.fillRect(x + 3, y + 5, 2, 3);
}

function drawWorldLandmarkGroundV2(context: CanvasRenderingContext2D, targetMap: string, x: number, y: number, locked: boolean) {
  const kind = worldLandmarkKind(targetMap);
  context.save();
  context.globalAlpha = locked ? .38 : 1;
  let left = x - 8, top = y + 7, width = 32, height = 17;
  let dark = "#554733", base = "#9b875c", light = "#c7b176";
  if (kind === "city") { left = x - 11; top = y + 5; width = 38; height = 20; dark = "#3c414b"; base = "#747d85"; light = "#adb1aa"; }
  else if (kind === "school") { left = x - 8; top = y + 6; width = 32; height = 18; dark = "#4b3e31"; base = "#8f7650"; light = "#c3a869"; }
  else if (kind === "temple") { left = x - 10; top = y + 5; width = 36; height = 20; dark = "#3d4138"; base = "#777a63"; light = "#aaa77d"; }
  else if (kind === "tower") { left = x - 8; top = y + 5; width = 32; height = 20; dark = "#303a4a"; base = "#68778a"; light = "#a6b9c5"; }
  else if (kind === "marsh") { left = x - 12; top = y + 4; width = 40; height = 22; dark = "#3c1421"; base = "#74263a"; light = "#b13c4a"; }
  else if (kind === "pass") { left = x - 10; top = y + 4; width = 36; height = 21; dark = "#252b35"; base = "#4c5664"; light = "#7b8791"; }
  else if (kind === "citadel") { left = x - 14; top = y + 2; width = 44; height = 24; dark = "#453858"; base = "#806e9e"; light = "#d4bf7e"; }

  // Irregular 2-3 tile apron: the portal now sits inside a place rather than on a single icon card.
  context.fillStyle = dark;
  context.fillRect(left + 3, top, width - 6, height);
  context.fillRect(left, top + 4, width, height - 8);
  context.fillStyle = base;
  context.fillRect(left + 4, top + 2, width - 8, height - 4);
  context.fillRect(left + 2, top + 6, width - 4, height - 12);
  context.fillStyle = light;
  const seed = stableVisualIndex(`landmark-ground-${targetMap}`, Math.round(x / TILE), Math.round(y / TILE));
  context.fillRect(left + 5 + seed % Math.max(2, width - 12), top + 5, 4, 1);
  context.fillRect(left + width - 12, top + height - 6, 5, 1);

  // A short approach visually connects the landmark footprint to the road without changing collision.
  context.fillStyle = dark;
  context.fillRect(x + 5, y + 18, 6, 9);
  context.fillStyle = base;
  context.fillRect(x + 6, y + 18, 4, 9);

  if (kind === "marsh") {
    context.fillStyle = "#4f1729";
    context.fillRect(left + 1, top + 4, 8, 5);
    context.fillRect(left + width - 11, top + 10, 9, 6);
    context.fillStyle = "#d34b50";
    context.fillRect(left + 5, top + 6, 3, 1);
    context.fillRect(left + width - 8, top + 13, 4, 1);
  }
  if (kind === "citadel") {
    context.fillStyle = "#e1d29a";
    context.fillRect(left + 7, top + height - 5, width - 14, 1);
    context.fillStyle = "#58486d";
    context.fillRect(left + 2, top + 3, 3, 3);
    context.fillRect(left + width - 5, top + 3, 3, 3);
  }
  context.restore();
}

function drawWorldLandmarkV2(context: CanvasRenderingContext2D, targetMap: string, x: number, y: number, locked: boolean) {
  const kind = worldLandmarkKind(targetMap);
  context.save();
  context.globalAlpha = locked ? .46 : 1;
  drawGroundShadow(context, x - 11, y + 21, 38);

  if (kind === "village") {
    let roof = "#a94d36", wall = "#d8bd78", trim = "#f0db95";
    if (targetMap === "lakeVillage") { roof = "#367a91"; wall = "#d7c887"; trim = "#85c3c7"; }
    else if (targetMap === "reedHamlet") { roof = "#6f833d"; wall = "#c9ad69"; trim = "#a9c05c"; }
    else if (targetMap === "mirrorTown") { roof = "#766a9d"; wall = "#d0c7b5"; trim = "#b8c9e3"; }
    drawMiniHouse(context, x - 8, y - 4, 17, roof, wall, trim);
    drawMiniHouse(context, x + 7, y, 15, roof, wall, trim);
    drawMiniHouse(context, x - 15, y + 3, 14, roof, wall, trim);
    context.fillStyle = trim;
    context.fillRect(x + 1, y + 1, 3, 3);
    if (targetMap === "lakeVillage") {
      context.fillStyle = "#314f5f";
      context.fillRect(x - 13, y + 20, 28, 2);
      context.fillStyle = "#a88755";
      for (let post = -10; post <= 12; post += 5) context.fillRect(x + post, y + 17, 2, 5);
    }
    if (targetMap === "mirrorTown") {
      context.fillStyle = "#d7f1f0";
      context.fillRect(x + 1, y - 7, 2, 5);
      context.fillRect(x, y - 5, 4, 2);
    }
  } else if (kind === "city") {
    const outline = "#171a20", stone = "#8d9599", light = "#c8c8b3", roof = "#5f493d";
    context.fillStyle = outline;
    context.fillRect(x - 14, y + 4, 36, 18);
    context.fillRect(x - 10, y - 4, 9, 16);
    context.fillRect(x + 10, y - 4, 9, 16);
    context.fillRect(x, y - 9, 10, 22);
    context.fillStyle = stone;
    context.fillRect(x - 12, y + 6, 32, 14);
    context.fillRect(x - 8, y - 2, 5, 14);
    context.fillRect(x + 12, y - 2, 5, 14);
    context.fillRect(x + 2, y - 7, 6, 18);
    context.fillStyle = roof;
    context.fillRect(x - 10, y - 5, 9, 3);
    context.fillRect(x + 10, y - 5, 9, 3);
    context.fillRect(x, y - 10, 10, 3);
    context.fillStyle = light;
    context.fillRect(x - 8, y + 2, 2, 3);
    context.fillRect(x + 14, y + 2, 2, 3);
    context.fillStyle = "#29252a";
    context.fillRect(x + 2, y + 12, 6, 8);
  } else if (kind === "school") {
    if (targetMap === "emberShrine") {
      context.fillStyle = "#2a1720";
      context.fillRect(x - 12, y + 4, 32, 4);
      context.fillRect(x - 8, y - 5, 4, 25);
      context.fillRect(x + 12, y - 5, 4, 25);
      context.fillStyle = "#b33b32";
      context.fillRect(x - 10, y + 5, 28, 2);
      context.fillRect(x - 7, y - 3, 2, 21);
      context.fillRect(x + 13, y - 3, 2, 21);
      context.fillStyle = "#f0b84e";
      context.fillRect(x + 2, y - 9, 4, 6);
      context.fillRect(x + 1, y - 6, 6, 4);
    } else if (targetMap === "quietBower") {
      context.fillStyle = "#183b29";
      context.fillRect(x - 9, y - 4, 26, 6);
      context.fillRect(x - 13, y + 1, 34, 7);
      context.fillStyle = "#4d7e45";
      context.fillRect(x - 7, y - 7, 22, 6);
      context.fillRect(x - 11, y - 2, 30, 7);
      context.fillStyle = "#705137";
      context.fillRect(x + 2, y + 4, 4, 17);
      context.fillStyle = "#b89a5f";
      context.fillRect(x - 7, y + 13, 18, 4);
    } else if (targetMap === "ironHall") {
      drawPixelRoof(context, x - 13, y - 5, 34, "#555e68", "#171a21");
      context.fillStyle = "#202630";
      context.fillRect(x - 10, y + 2, 28, 18);
      context.fillStyle = "#78838a";
      context.fillRect(x - 8, y + 4, 24, 14);
      context.fillStyle = "#d1bd76";
      context.fillRect(x + 1, y + 6, 6, 2);
      context.fillStyle = "#252129";
      context.fillRect(x + 1, y + 11, 6, 7);
    } else {
      context.fillStyle = "#242838";
      context.fillRect(x - 6, y - 7, 20, 28);
      context.fillRect(x - 2, y - 15, 12, 10);
      context.fillStyle = "#7c86a3";
      context.fillRect(x - 4, y - 5, 16, 24);
      context.fillRect(x, y - 13, 8, 10);
      context.fillStyle = "#e2c36e";
      context.fillRect(x + 2, y - 9, 4, 4);
      context.fillStyle = "#d9e7e6";
      context.fillRect(x + 3, y - 12, 2, 3);
    }
  } else if (kind === "temple") {
    context.fillStyle = "#252529";
    context.fillRect(x - 14, y + 3, 36, 4);
    context.fillRect(x - 10, y + 7, 28, 14);
    context.fillStyle = "#77786a";
    context.fillRect(x - 12, y + 4, 32, 2);
    context.fillRect(x - 8, y + 8, 24, 11);
    context.fillStyle = "#a6a276";
    context.fillRect(x - 5, y + 10, 3, 8);
    context.fillRect(x + 10, y + 9, 3, 9);
    context.fillStyle = "#4b6a45";
    context.fillRect(x - 13, y + 1, 7, 3);
    context.fillRect(x + 13, y + 5, 7, 3);
    context.fillStyle = "#343038";
    context.fillRect(x + 2, y + 12, 6, 7);
  } else if (kind === "tower") {
    context.fillStyle = "#171b27";
    context.fillRect(x - 8, y - 12, 24, 34);
    context.fillRect(x - 4, y - 18, 16, 8);
    context.fillStyle = "#78889a";
    context.fillRect(x - 6, y - 10, 20, 30);
    context.fillRect(x - 2, y - 16, 12, 8);
    context.fillStyle = "#b9d2d6";
    context.fillRect(x - 3, y - 7, 5, 5);
    context.fillRect(x + 7, y + 2, 4, 5);
    context.fillStyle = "#d9f1e8";
    context.fillRect(x + 2, y - 13, 4, 4);
    context.fillStyle = "#564a70";
    context.fillRect(x + 1, y + 12, 6, 8);
  } else if (kind === "marsh") {
    context.fillStyle = "#33141f";
    context.fillRect(x + 2, y - 7, 5, 29);
    context.fillRect(x - 8, y - 2, 12, 4);
    context.fillRect(x + 6, y + 2, 13, 4);
    context.fillStyle = "#6e2737";
    context.fillRect(x + 3, y - 5, 3, 27);
    context.fillRect(x - 7, y - 1, 10, 2);
    context.fillRect(x + 6, y + 3, 11, 2);
    context.fillStyle = "#d3484d";
    context.fillRect(x - 13, y + 18, 35, 3);
    context.fillRect(x - 7, y + 15, 8, 2);
    context.fillStyle = "#ef8261";
    context.fillRect(x - 3, y + 19, 6, 1);
  } else if (kind === "pass") {
    context.fillStyle = "#171c25";
    context.fillRect(x - 13, y - 5, 11, 27);
    context.fillRect(x + 10, y - 7, 11, 29);
    context.fillRect(x - 5, y - 2, 23, 7);
    context.fillStyle = "#4b5664";
    context.fillRect(x - 11, y - 3, 7, 23);
    context.fillRect(x + 12, y - 5, 7, 25);
    context.fillRect(x - 3, y, 19, 3);
    context.fillStyle = "#85909a";
    context.fillRect(x - 9, y + 1, 2, 7);
    context.fillRect(x + 14, y - 1, 2, 8);
    context.fillStyle = "#090b10";
    context.fillRect(x + 2, y + 3, 7, 17);
  } else {
    const outline = "#181522", stone = "#7c6b9b", light = "#c8bad0", gold = "#e1c978";
    context.fillStyle = outline;
    context.fillRect(x - 16, y + 3, 40, 20);
    context.fillRect(x - 13, y - 9, 10, 25);
    context.fillRect(x + 17, y - 9, 10, 25);
    context.fillRect(x - 1, y - 16, 12, 34);
    context.fillStyle = stone;
    context.fillRect(x - 14, y + 5, 36, 16);
    context.fillRect(x - 11, y - 7, 6, 21);
    context.fillRect(x + 19, y - 7, 6, 21);
    context.fillRect(x + 1, y - 14, 8, 30);
    context.fillStyle = light;
    context.fillRect(x - 9, y - 4, 2, 5);
    context.fillRect(x + 21, y - 4, 2, 5);
    context.fillRect(x + 3, y - 10, 4, 4);
    context.fillStyle = gold;
    context.fillRect(x + 2, y - 20, 6, 7);
    context.fillRect(x + 1, y - 17, 8, 2);
    context.fillStyle = "#27202f";
    context.fillRect(x + 3, y + 12, 5, 9);
  }

  if (locked) drawWorldSeal(context, x + 12, y - 6);
  context.restore();
}

'''

text = text.replace(anchor, block + anchor, 1)
old = '''        drawWorldLandmarkGround(context, portal.targetMap, x, y, locked);\n        drawWorldLandmark(context, portal.targetMap, x, y, locked);'''
new = '''        drawWorldLandmarkGroundV2(context, portal.targetMap, x, y, locked);\n        drawWorldLandmarkV2(context, portal.targetMap, x, y, locked);'''
if old not in text:
    raise SystemExit('portal landmark calls not found')
text = text.replace(old, new, 1)
path.write_text(text)

progress = Path('PROGRESS.md')
p = progress.read_text()
marker = '## SFC Visual Reconstruction Pass 7'
if marker not in p:
    p += '''\n\n## SFC Visual Reconstruction Pass 7\n- Rebuilt world-map portals as 2-4 tile landmark silhouettes instead of single-tile symbols.\n- Added distinct village clusters, Iron City fortress, four master schools, Old Temple, Mirror Tower, Void Pass, Crimson Marsh and Prism Citadel art.\n- Added irregular landmark aprons/approaches and locked-gate seal markers without changing map collision, portal coordinates or encounter data.\n- Preserved the Pass 6 continuous water, bridge, mountain, forest and route reconstruction.\n'''
    progress.write_text(p)
