# Spotter store icons (style 12: Paper + photoreal objects)

Requirements: Python 3.11+, `pip install bpy==5.2.3 shapely numpy matplotlib pillow` (headless Blender as a module).

Run (renders to ./out, 640 px, Cycles CPU + denoise):

    mkdir -p out
    SIZE=640 SAMPLES=48 python3 gen.py out s12            # all 19 items
    SIZE=640 SAMPLES=48 python3 gen.py out s12 gym apex   # selected items
    SIZE=1024 SAMPLES=64 python3 gen.py out s12           # larger master

Files:
- gen.py   : items (ITEMS: id -> glyph, tone), colour tones (TONES), paper tile and layers, theme letters, render().
- real.py  : procedural photoreal objects (dumbbell, trophy, banana, stopwatch, brain, ...), poses face-on.
- fonts/   : theme fonts for the letters on theme icons (Chakra Petch = Cyberpunk, Inter = Brass Glass, Cormorant Garamond italic 600 = Christmas).
- tex/     : theme backgrounds (cyberpunk and christmas cropped from client/public/backgrounds, Brass Glass lava drawn from its --lava colours).

Addon tiles are a plain gradient of the tone; to change a colour edit TONES and the tone number in ITEMS.
