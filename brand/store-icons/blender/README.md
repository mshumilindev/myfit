# Spotter store icons (style 12: Paper + photoreal objects)

Requirements: Python 3.11+, `pip install bpy==5.2.3 shapely numpy matplotlib pillow` (headless Blender as a module).

Run (renders to ./out, 640 px, Cycles CPU + denoise):

    mkdir -p out
    SIZE=640 SAMPLES=48 python3 gen.py out s12            # all 19 items
    SIZE=640 SAMPLES=48 python3 gen.py out s12 gym apex   # selected items
    SIZE=1024 SAMPLES=64 python3 gen.py out s12           # larger master

Files:

- gen.py : items (ITEMS: id -> glyph, tone), colour tones (TONES), paper tile and layers, theme letters, render().
- real.py : procedural photoreal objects (dumbbell, trophy, banana, stopwatch, brain, ...), poses face-on.
- fonts/ : theme fonts for the letters on theme icons (Chakra Petch = Cyberpunk, Inter = Brass Glass, Cormorant Garamond italic 600 = Christmas).
- tex/ : theme backgrounds (cyberpunk and christmas cropped from client/public/backgrounds, Brass Glass lava drawn from its --lava colours).

Addon tiles are a plain gradient of the tone; to change a colour edit TONES and the tone number in ITEMS.

## Animated icon (Fatigue & readiness)

The animated icon is the same cell charging: 16 frames with FR_LEVEL 0..4 (fractional last window), then three frames with FR_PULSE 0.5 / 1 / 0.5 at level 4. It is used only on the item page (store details) and never in lists.

    # one frame: FR_LEVEL=2.5 FR_PULSE=0 SIZE=320 SAMPLES=40 python3 gen.py out s12 fatigue-readiness
    # all frames: bash anim-frames.sh 0 18   (writes out/f00.png .. f18.png, renamed from fatigue-readiness.png)
    # assemble: Pillow, frames 0..18 then 17, 16 (ping-pong), durations 400, 14 x 90, 300, 4 x 140, 500 ms, loop 0, lossy q82
    # result: client/public/store-icons/fatigue-readiness-anim.webp (about 16 KB)

## Animated icon (Train like a pro)

The medal swings from its ring: 12 frames, `MEDAL_ANG = 16 * sin(2*pi*i/12)` degrees, i = 0..11 (a seamless loop).

    for i in 0..11: MEDAL_ANG=<angle> SIZE=320 SAMPLES=32 python3 gen.py out s12 train-like-a-pro   # -> out/fNN.png
    # crop every frame to the tile box (44,44,276,276), resize to 320, save as WebP (90 ms per frame, loop 0, quality 70)
    # result: client/public/store-icons/train-like-a-pro-anim.webp (about 58 KB); listed in ANIMATED_ICONS (storeItems.tsx)
