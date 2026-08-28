from PIL import Image
from pathlib import Path
img=Image.open('public/assets/rpg/atlas/field.png').convert('RGBA')
out=Path('field-inspect');out.mkdir(exist_ok=True)
# Terrain cells are 64x64. Export mountain row and nearby rows at 2x nearest-neighbour.
for row in [3,4,5,6]:
    crop=img.crop((0,row*64,min(img.width,640),(row+1)*64))
    crop.resize((crop.width*2,crop.height*2),Image.Resampling.NEAREST).save(out/f'row{row}.png')
