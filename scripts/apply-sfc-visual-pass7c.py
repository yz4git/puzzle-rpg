from pathlib import Path

path = Path('app/rpg/RPGMode.tsx')
text = path.read_text()
old = '''  if (!left && seed % 2 === 1) context.fillRect(x - 2, y + 7, 2, 4);\n  if (!right && seed % 4 === 0) context.fillRect(x + TILE, y + 5, 2, 5);\n}\n\nfunction drawGroundMacro'''
new = '''  if (!left && seed % 2 === 1) context.fillRect(x - 2, y + 7, 2, 4);\n  if (!right && seed % 4 === 0) context.fillRect(x + TILE, y + 5, 2, 5);\n\n  // Grass bites back into the outer corruption edge in uneven chunks. This\n  // visually breaks the rectangular 9x5 map-data block while collision stays unchanged.\n  const grass = seed % 3 === 0 ? "#5d9d46" : seed % 3 === 1 ? "#68a64a" : "#518f40";\n  context.fillStyle = grass;\n  if (!up) {\n    context.fillRect(x, y, 3 + seed % 5, 3);\n    context.fillRect(x + 11 - (seed % 3), y, 5 + seed % 2, 2 + (seed % 2));\n    if (seed % 2 === 0) context.fillRect(x + 1, y + 3, 3, 1);\n  }\n  if (!down) {\n    context.fillRect(x, y + 13, 5 + seed % 4, 3);\n    context.fillRect(x + 12 - (seed % 4), y + 14, 4 + seed % 4, 2);\n    if (seed % 3 === 0) context.fillRect(x + 10, y + 12, 3, 2);\n  }\n  if (!left) {\n    context.fillRect(x, y, 2 + seed % 2, 5 + seed % 5);\n    context.fillRect(x, y + 11 - seed % 3, 3, 5 + seed % 3);\n  }\n  if (!right) {\n    context.fillRect(x + 13, y + 1, 3, 4 + seed % 5);\n    context.fillRect(x + 14, y + 11 - seed % 4, 2, 5 + seed % 4);\n  }\n  // Mossy islands and deep pools keep the interior from reading as a flat red floor.\n  if (seed % 7 === 0) {\n    context.fillStyle = "#485f38";\n    context.fillRect(x + 5, y + 7, 4, 3);\n    context.fillStyle = "#7da452";\n    context.fillRect(x + 6, y + 7, 2, 1);\n  } else if (seed % 5 === 0) {\n    context.fillStyle = "#351426";\n    context.fillRect(x + 4, y + 6, 6, 4);\n    context.fillStyle = "#9c3343";\n    context.fillRect(x + 5, y + 7, 4, 1);\n  }\n}\n\nfunction drawGroundMacro'''
if old not in text:
    raise SystemExit('Pass 7C anchor not found')
text = text.replace(old, new, 1)
path.write_text(text)

progress = Path('PROGRESS.md')
p = progress.read_text()
line = '- Pass 7C: Crimson Marsh corruption boundary gains irregular grass bites, moss islands and deep pools to remove the rectangular biome silhouette.'
if line not in p:
    progress.write_text(p.rstrip() + '\n' + line + '\n')
