"""Turn a 640 px Blender render into the store icon: crop to the tile outline, square, 320 px, WebP.

Usage: python3 finalize.py out/planner.png ../../../client/public/store-icons/planner.webp
The tile must touch all four edges of the file (the store lays the file out edge to edge).
"""
import sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGBA')
box = im.split()[3].point(lambda v: 255 if v > 8 else 0).getbbox()
c = im.crop(box)
s = max(c.size)
sq = Image.new('RGBA', (s, s), (0, 0, 0, 0))
sq.paste(c, ((s - c.width) // 2, (s - c.height) // 2))
sq.resize((320, 320), Image.LANCZOS).save(dst, 'WEBP', quality=90)
print('saved', dst, 'crop', box)
