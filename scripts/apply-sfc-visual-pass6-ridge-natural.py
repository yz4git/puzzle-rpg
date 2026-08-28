from pathlib import Path
import re
path=Path('app/rpg/RPGMode.tsx');text=path.read_text()
new=r'''function drawWorldMountainLayer(context: CanvasRenderingContext2D, map: MapDefinition, cameraX: number, cameraY: number) {
  if (map.id !== "world") return;

  // Lower mountain row: sparse foothill and scree shapes only. Keeping the
  // grass foundation visible between forms prevents the range from reading as a wall.
  for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
    const worldX = cameraX + viewX, worldY = cameraY + viewY;
    if (tileAt(map, worldX, worldY) !== "m" || tileAt(map, worldX, worldY - 1) !== "m") continue;
    const x=viewX*TILE,y=viewY*TILE,seed=stableVisualIndex("ridge-foot",worldX,worldY);
    context.fillStyle="#27313b";
    context.beginPath();
    context.moveTo(x-3,y+15);context.lineTo(x+2,y+9+(seed%3));context.lineTo(x+7,y+5+(seed%4));context.lineTo(x+11,y+10);context.lineTo(x+17,y+7+((seed>>3)%4));context.lineTo(x+19,y+16);context.closePath();context.fill();
    context.fillStyle=seed%2?"#4b5660":"#56616a";
    context.beginPath();context.moveTo(x,y+14);context.lineTo(x+7,y+7+(seed%3));context.lineTo(x+10,y+14);context.closePath();context.fill();
    context.fillStyle="#707979";context.fillRect(x+5+(seed%5),y+10,2,2);
    context.fillStyle="#1b232d";context.fillRect(x+12,y+12,3+(seed%3),3);
  }

  // Top row: one large 2-tile-wide mountain per pair. Peaks extend through the
  // lower gameplay row and end in a broken polygonal toe rather than a baseline.
  for (let viewY = 0; viewY < VIEW_H; viewY += 1) for (let viewX = 0; viewX < VIEW_W; viewX += 1) {
    const worldX=cameraX+viewX,worldY=cameraY+viewY;
    if(tileAt(map,worldX,worldY)!=="m"||tileAt(map,worldX,worldY-1)==="m")continue;
    let startX=worldX;while(tileAt(map,startX-1,worldY)==="m")startX-=1;
    const offset=worldX-startX;if(offset%2!==0)continue;
    const x=viewX*TILE,y=viewY*TILE,seed=stableVisualIndex("ridge-natural",worldX,worldY);
    const pair=tileAt(map,worldX+1,worldY)==="m";const width=pair?32+(seed%5):21;const left=x-3+((seed%5)-2);const peak=left+Math.floor(width*(.38+((seed>>3)%15)/100));const toeY=y+29+(seed%3);
    context.fillStyle="#1d2631";
    context.beginPath();context.moveTo(left-3,toeY-2);context.lineTo(left+3,y+19);context.lineTo(left+9,y+12);context.lineTo(peak,y+1+(seed%3));context.lineTo(left+width-8,y+12);context.lineTo(left+width-2,y+20);context.lineTo(left+width+3,toeY-4);context.lineTo(left+width-3,toeY);context.lineTo(left+width-11,toeY-3);context.lineTo(left+width-18,toeY+1);context.lineTo(left+width-25,toeY-2);context.lineTo(left+4,toeY+1);context.closePath();context.fill();
    context.fillStyle=seed%2?"#59646d":"#657078";
    context.beginPath();context.moveTo(left+1,toeY-4);context.lineTo(left+8,y+14);context.lineTo(peak,y+4+(seed%2));context.lineTo(peak+1,toeY-5);context.lineTo(left+width-18,toeY-2);context.lineTo(left+10,toeY);context.closePath();context.fill();
    context.fillStyle="#38434e";
    context.beginPath();context.moveTo(peak,y+4+(seed%2));context.lineTo(left+width-8,y+13);context.lineTo(left+width-1,toeY-5);context.lineTo(peak+1,toeY-5);context.closePath();context.fill();
    context.fillStyle="#a0a49e";context.fillRect(peak-1,y+5,2,5);if(width>25)context.fillRect(left+8+(seed%6),y+16,2,2);
    context.fillStyle="#202a34";context.fillRect(left+width-12,y+20,4,5);
  }
}
'''
text,count=re.subn(r'function drawWorldMountainLayer\(.*?\n\}\n\nfunction drawWorldLandmarkGround',new+'\nfunction drawWorldLandmarkGround',text,count=1,flags=re.S)
if count!=1:raise SystemExit(f'replace count={count}')
path.write_text(text)
progress=Path('PROGRESS.md');p=progress.read_text();entry='''\n- Pass 6 natural ridge correction: removed the remaining full-width lower rock band; metapeaks now extend across both mountain rows with broken polygon toes while the lower row uses sparse foothill/scree shapes.\n'''
if 'natural ridge correction' not in p:progress.write_text(p+entry)
