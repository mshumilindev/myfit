"""Spotter store icons: 19 items x 10 styles, all geometry drawn here (2D outline -> extrude -> bevel) and rendered in Blender.

python3 gen.py OUT_DIR STYLE [item ...]     (STYLE = s01..s10)
Env: SIZE (px, default 640), SAMPLES (default 40)
"""
import math
import os
import sys

import bpy
import bmesh
from mathutils import Vector

SIZE = int(os.environ.get('SIZE', 640))
SAMPLES = int(os.environ.get('SAMPLES', 40))
DARK = os.environ.get('DARK', '0') == '1'


def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c) + (1.0,)


def mix(a, b, t):
    A = [int(a.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)]
    B = [int(b.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)]
    return '#%02x%02x%02x' % tuple(round(A[i] + (B[i] - A[i]) * t) for i in range(3))


# store-kit --ic-N gradient pairs (dark, light)
TONES = {
    0: ('#a63307', '#c2410c'), 1: ('#2f4bc4', '#4263eb'), 2: ('#4c2fd6', '#7c3aed'), 3: ('#a04f00', '#bd5a0b'),
    4: ('#0a7046', '#0d7f50'), 5: ('#4b4b55', '#6b6b76'), 6: ('#0a6b7a', '#0e7c8f'), 7: ('#a3135f', '#be185d'),
    8: ('#4a6a08', '#587d0a'), 9: ('#0a5fa0', '#0f74c4'),
    10: ('#a2762f', '#cf9a46'), 11: ('#6b4bb0', '#7d59c8'), 12: ('#a12f52', '#c9426a'), 13: ('#227e87', '#289fa9'), 14: ('#336ea8', '#3d84c9'),
    15: ('#1f7f6e', '#2fa58f'), 16: ('#3a45a0', '#5662c4'), 17: ('#c5651f', '#ea8a38'), 18: ('#55803f', '#7aa95c'), 19: ('#2b4a5c', '#3f6a80'),
}
# item -> (glyph builder name, tone) ; tones from addons/manifest.ts
ITEMS = {
    'gym': ('dumbbell', 10), 'apex': ('trophy', 11), 'coach': ('whistle', 13), 'nutrition': ('banana', 14), 'music': ('note', 12),
    'health': ('heart', 15), 'sleep': ('moon', 16), 'activities': ('stopwatch', 17), 'home-sets': ('house', 18),
    'goals': ('target', 10), 'playbook': ('book', 10), 'atlas': ('brain', 19), 'planner': ('calendar', 1), 'planner-a': ('calendar', 1), 'planner-b': ('cal_b', 1), 'planner-c': ('cal_c', 1), 'planner-d': ('cal_d', 1), 'planner-e': ('cal_e', 1), 'planner-f': ('cal_f', 1), 'planner-g': ('cal_g', 1), 'planner-h': ('cal_h', 1), 'planner-i': ('cal_i', 1), 'planner-j': ('cal_j', 1),
    'coach-live': ('broadcast', 13), 'coach-signals': ('bell', 13), 'coach-notes': ('notes', 13), 'coach-team': ('team', 13),
    'theme-brass-glass': ('scene_brass', 10), 'theme-cyberpunk': ('scene_cyber', 10), 'holiday-themes': ('scene_holiday', 10),
}


# ------------------------------------------------------------------ 2D geometry
def area2(p):
    return 0.5 * sum(p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1] for i in range(len(p)))


def rounded_poly(pts, rc=0.18, rv=0.06, n=8):
    if area2(pts) < 0:
        pts = pts[::-1]
    out, L = [], len(pts)
    for i in range(L):
        P, A, B = Vector(pts[i]), Vector(pts[i - 1]), Vector(pts[(i + 1) % L])
        u, v = A - P, B - P
        lu, lv = u.length, v.length
        u.normalize()
        v.normalize()
        cross = (P - A).x * (B - P).y - (P - A).y * (B - P).x
        r = rc if cross > 0 else rv
        ang = math.acos(max(-1, min(1, u.dot(v))))
        if ang < 1e-3 or abs(ang - math.pi) < 1e-3:
            out.append((P.x, P.y))
            continue
        half = ang / 2
        t = min(r / math.tan(half), lu * 0.5, lv * 0.5)
        re = t * math.tan(half)
        c = P + (u + v).normalized() * (re / math.sin(half))
        T1, T2 = P + u * t, P + v * t
        a1, a2 = math.atan2(T1.y - c.y, T1.x - c.x), math.atan2(T2.y - c.y, T2.x - c.x)
        da = (a2 - a1 + math.pi) % (2 * math.pi) - math.pi
        for k in range(n + 1):
            a = a1 + da * k / n
            out.append((c.x + re * math.cos(a), c.y + re * math.sin(a)))
    return out


def stroke_poly(path, w):
    h = w / 2
    P = [Vector(p) for p in path]
    left, right = [], []
    for i, p in enumerate(P):
        if i == 0:
            d = (P[1] - p).normalized()
            n = Vector((-d.y, d.x))
            left.append(p + n * h)
            right.append(p - n * h)
        elif i == len(P) - 1:
            d = (p - P[i - 1]).normalized()
            n = Vector((-d.y, d.x))
            left.append(p + n * h)
            right.append(p - n * h)
        else:
            d1, d2 = (p - P[i - 1]).normalized(), (P[i + 1] - p).normalized()
            n1, n2 = Vector((-d1.y, d1.x)), Vector((-d2.y, d2.x))
            m = (n1 + n2).normalized()
            k = h / max(0.3, m.dot(n1))
            left.append(p + m * k)
            right.append(p - m * k)
    return [(q.x, q.y) for q in left + right[::-1]]


def rot2(pts, deg, c=(0, 0)):
    cs, sn = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    return [((x - c[0]) * cs - (y - c[1]) * sn + c[0], (x - c[0]) * sn + (y - c[1]) * cs + c[1]) for x, y in pts]


def tr(pts, dx=0.0, dy=0.0):
    return [(x + dx, y + dy) for x, y in pts]


def sc2(pts, sx, sy=None):
    sy = sx if sy is None else sy
    return [(x * sx, y * sy) for x, y in pts]


def pill(w, h):
    r = min(w, h) / 2
    hw, hh = w / 2, h / 2
    return rounded_poly([(-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)], rc=r * 0.98, n=12)


def rrect(w, h, r, n=8):
    hw, hh = w / 2, h / 2
    return rounded_poly([(-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)], rc=r, n=n)


def circle(r, n=72):
    return [(r * math.cos(2 * math.pi * k / n), r * math.sin(2 * math.pi * k / n)) for k in range(n)]


def ellipse(rx, ry, n=64):
    return [(rx * math.cos(2 * math.pi * k / n), ry * math.sin(2 * math.pi * k / n)) for k in range(n)]


def squircle(h, n=5.0, m=160):
    pts = []
    for k in range(m):
        t = 2 * math.pi * k / m
        c, s = math.cos(t), math.sin(t)
        pts.append((h * math.copysign(abs(c) ** (2 / n), c), h * math.copysign(abs(s) ** (2 / n), s)))
    return pts


def arc(r, a0, a1, c=(0, 0), n=24):
    return [(c[0] + r * math.cos(math.radians(a0 + (a1 - a0) * k / n)),
             c[1] + r * math.sin(math.radians(a0 + (a1 - a0) * k / n))) for k in range(n + 1)]


def star4(ro, ri, n=8):
    pts = []
    for k in range(8):
        a = math.radians(90 + 45 * k)
        r = ro if k % 2 == 0 else ri
        pts.append((r * math.cos(a), r * math.sin(a)))
    return rounded_poly(pts, 0.05, 0.12, n)


def crescent(R, r, d):
    x0 = (d * d + R * R - r * r) / (2 * d)
    y0 = math.sqrt(R * R - x0 * x0)
    a = math.degrees(math.atan2(y0, x0))
    outer = arc(R, a, 360 - a, n=56)
    b1 = math.degrees(math.atan2(-y0, x0 - d)) % 360
    b2 = math.degrees(math.atan2(y0, x0 - d)) % 360
    inner = arc(r, b1, b2, c=(d, 0), n=40)
    return outer + inner[1:-1]


# ------------------------------------------------------------------ styles
# material spec: kind 'grad' (top->bottom, c1 top, c2 bottom) or 'solid' (c1); tokens: T0 (dark tone) T1 (light tone) TM mid
def S(**k):
    return k


STYLES = {
    's01': S(name='Flat', flat=True, shape='squircle', tdepth=0.02, tbev=0.0, gdepth=0.02, gbev=0.0, tilt=(0, 0), world='none',
             tile=S(k='grad', c1='T0', c2='T1', emit=1), g=S(k='solid', c1='#ffffff', emit=1),
             a=S(k='solid', c1='TM', emit=1), d=S(k='solid', c1='#ffffff', emit=1)),
    's02': S(name='Skeuomorphic', shape='squircle', photo=True, tdepth=0.4, tbev=0.05, gdepth=0.12, gbev=0.06, tilt=(0.1, 0.14), world='studio',
             gs=0.84, tile=S(k='grad', c1='T1', c2='T0', rough=0.32, coat=1.0), g=S(k='solid', c1='#f8f8fb', rough=0.22, coat=1.0),
             a=S(k='solid', c1='T0D', rough=0.3, coat=1.0), d=S(k='solid', c1='#d9dce4', metal=1.0, rough=0.12),
             bz=S(k='solid', c1='#c9ced8', metal=1.0, rough=0.24, aniso=0.7)),
    's11': S(name='Photoreal objects', shape='squircle', real=True, tdepth=0.12, tbev=0.03, gdepth=0.1, gbev=0.03, tilt=(0.0, 0.0), world='studio',
             tile=S(k='grad', c1='T0', c2='T1', rough=0.55), g=S(k='solid', c1='#ffffff'), a=S(k='solid', c1='#ffffff'), d=S(k='solid', c1='#ffffff')),
    's03': S(name='Clay', shape='squircle', tdepth=0.62, tbev=0.26, gdepth=0.3, gbev=0.12, tilt=(0.12, 0.2), world='soft',
             tile=S(k='solid', c1='TM', rough=0.62), g=S(k='solid', c1='#f6f0e8', rough=0.6),
             a=S(k='solid', c1='T0', rough=0.6), d=S(k='solid', c1='T0D', rough=0.6)),
    's04': S(name='Glass', shape='squircle', tdepth=0.5, tbev=0.14, gdepth=0.2, gbev=0.06, tilt=(0.14, 0.18), world='studio', blobs=True,
             tile=S(k='solid', c1='T1L', trans=1.0, rough=0.12, ior=1.45, alpha=0.9), g=S(k='solid', c1='#ffffff', rough=0.2, coat=1, emit=0.25),
             a=S(k='solid', c1='TL2', rough=0.2, emit=0.2), d=S(k='solid', c1='#ffffff', rough=0.2)),
    's05': S(name='Object', shape='none', kstep=0.12, tdepth=0.0, tbev=0, gdepth=0.4, gbev=0.1, tilt=(0.05, 0.09), world='soft', gscale=1.0,
             tile=S(k='solid', c1='TM'), g=S(k='solid', c1='T1', rough=0.25, coat=1.0),
             a=S(k='solid', c1='#f7f3ea', rough=0.3, coat=0.6), d=S(k='solid', c1='#2a2f3a', rough=0.35)),
    's06': S(name='Emboss', shape='squircle', tdepth=0.34, tbev=0.14, gdepth=0.2, gbev=0.1, tilt=(0.0, 0.0), world='soft2', emboss=True,
             tile=S(k='solid', c1='TINT', rough=0.8), g=S(k='solid', c1='T1L', rough=0.6),
             a=S(k='solid', c1='#ffffff', rough=0.5), d=S(k='solid', c1='T0', rough=0.5)),
    's07': S(name='Inflated', shape='squircle', tdepth=0.9, tbev=0.38, gdepth=0.5, gbev=0.2, tilt=(0.12, 0.22), world='studio',
             tile=S(k='grad', c1='T1L', c2='T1', rough=0.1, coat=1.0), g=S(k='solid', c1='#ffffff', rough=0.1, coat=1.0),
             a=S(k='solid', c1='T0L', rough=0.1, coat=1.0), d=S(k='solid', c1='T0', rough=0.1, coat=1.0)),
    's08': S(name='Ceramic', shape='squircle', tdepth=0.5, tbev=0.12, gdepth=0.34, gbev=0.08, tilt=(0.1, 0.18), world='studio', ceramic=True,
             tile=S(k='grad', c1='#ffffff', c2='#dfe4ef', rough=0.2, coat=1.0), g=S(k='grad', c1='T1L', c2='T0', rough=0.18, coat=1.0),
             a=S(k='solid', c1='#1b2236', rough=0.3, coat=0.6), d=S(k='solid', c1='#eef1f8', rough=0.25, coat=0.8)),
    's09': S(name='Neon', shape='squircle', tdepth=0.5, tbev=0.1, gdepth=0.2, gbev=0.07, tilt=(0.08, 0.14), world='dark', neon=True,
             tile=S(k='grad', c1='#262d4d', c2='#0d1122', metal=0.7, rough=0.34, coat=0.6), g=S(k='solid', c1='T1N', emit=3.2),
             a=S(k='solid', c1='#ffffff', emit=2.4), d=S(k='solid', c1='#0b0e1c', rough=0.5)),
    's12': S(name='Photoreal on paper', shape='squircle', real=True, layers=True, paper=True, tdepth=0.1, tbev=0.012, gdepth=0.1, gbev=0.03, tilt=(0.0, 0.0), world='studio',
             tile=S(k='grad', c1='T0', c2='T1', rough=0.85, paper=True), g=S(k='solid', c1='#ffffff'), a=S(k='solid', c1='#ffffff'), d=S(k='solid', c1='#ffffff')),
    's10': S(name='Paper', shape='squircle', tdepth=0.16, tbev=0.02, gdepth=0.12, gbev=0.015, tilt=(0.04, 0.08), world='soft', layers=True,
             tile=S(k='solid', c1='T1', rough=0.9), g=S(k='solid', c1='#ffffff', rough=0.9),
             a=S(k='solid', c1='T0', rough=0.9), d=S(k='solid', c1='T0D', rough=0.9)),
}


def resolve(c, tone):
    lo, hi = TONES[tone]
    tm = mix(lo, hi, 0.5)
    m = {'T0': lo, 'T1': hi, 'TM': tm, 'T1L': mix(hi, '#ffffff', 0.28), 'T0L': mix(lo, '#ffffff', 0.35),
         'T0D': mix(lo, '#000000', 0.45), 'TL2': mix(hi, '#ffffff', 0.55), 'TINT': mix(hi, '#ffffff', 0.74),
         'TINT2': mix(hi, '#ffffff', 0.5), 'T1N': mix(hi, '#ffffff', 0.38)}
    if tone == 5:
        m['T1N'] = '#8f7bff'
    if DARK:
        m['TINT'] = mix(lo, '#0f1325', 0.78)
        m['TINT2'] = mix(lo, '#0f1325', 0.7)
    return m.get(c, c)


# ------------------------------------------------------------------ Blender scene
_cache = {}


def make_mat(spec, tone, key):
    ck = (key, tone, DARK)
    if ck in _cache and _cache[ck].name in bpy.data.materials:
        return _cache[ck]
    m = bpy.data.materials.new(f'{key}{tone}')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    if spec['k'] == 'img':
        tc = nt.nodes.new('ShaderNodeTexCoord')
        sep = nt.nodes.new('ShaderNodeSeparateXYZ')
        nt.links.new(tc.outputs['Object'], sep.inputs[0])
        mu = nt.nodes.new('ShaderNodeMapRange'); mu.inputs['From Min'].default_value = -1.22; mu.inputs['From Max'].default_value = 1.22
        mv = nt.nodes.new('ShaderNodeMapRange'); mv.inputs['From Min'].default_value = -1.22; mv.inputs['From Max'].default_value = 1.22
        nt.links.new(sep.outputs['X'], mu.inputs[0]); nt.links.new(sep.outputs['Z'], mv.inputs[0])
        cb = nt.nodes.new('ShaderNodeCombineXYZ')
        nt.links.new(mu.outputs[0], cb.inputs['X']); nt.links.new(mv.outputs[0], cb.inputs['Y'])
        tx = nt.nodes.new('ShaderNodeTexImage')
        tx.image = bpy.data.images.load(spec['path'])
        tx.extension = 'EXTEND'
        nt.links.new(cb.outputs[0], tx.inputs['Vector'])
        b = nt.nodes.new('ShaderNodeBsdfPrincipled')
        nt.links.new(tx.outputs['Color'], b.inputs['Base Color'])
        b.inputs['Roughness'].default_value = 0.8
        try:
            nt.links.new(tx.outputs['Color'], b.inputs['Emission Color'])
            b.inputs['Emission Strength'].default_value = 0.22
        except KeyError:
            pass
        nt.links.new(b.outputs[0], out.inputs['Surface'])
        return _store(ck, m)
    c1 = srgb(resolve(spec['c1'], tone))
    if spec['k'] == 'grad':
        c2 = srgb(resolve(spec['c2'], tone))
        tc = nt.nodes.new('ShaderNodeTexCoord')
        sep = nt.nodes.new('ShaderNodeSeparateXYZ')
        nt.links.new(tc.outputs['Object'], sep.inputs[0])
        ramp = nt.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].position = 0.0
        ramp.color_ramp.elements[1].position = 1.0
        ramp.color_ramp.elements[0].color = c2   # bottom
        ramp.color_ramp.elements[1].color = c1   # top
        mp = nt.nodes.new('ShaderNodeMapRange')
        mp.inputs['From Min'].default_value = -1.4
        mp.inputs['From Max'].default_value = 1.4
        nt.links.new(sep.outputs['Z'], mp.inputs[0])
        nt.links.new(mp.outputs[0], ramp.inputs[0])
        col = ramp.outputs[0]
    else:
        col = None
    if spec.get('emit', 0) and spec.get('emit') > 0 and not spec.get('rough'):
        em = nt.nodes.new('ShaderNodeEmission')
        em.inputs['Strength'].default_value = spec['emit'] if spec['emit'] > 1 else 1.0
        if col is not None:
            nt.links.new(col, em.inputs['Color'])
        else:
            em.inputs['Color'].default_value = c1
        nt.links.new(em.outputs[0], out.inputs['Surface'])
        return _store(ck, m)
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    if col is not None:
        nt.links.new(col, b.inputs['Base Color'])
    else:
        b.inputs['Base Color'].default_value = c1
    b.inputs['Roughness'].default_value = spec.get('rough', 0.4)
    b.inputs['Metallic'].default_value = spec.get('metal', 0.0)
    try:
        b.inputs['Coat Weight'].default_value = spec.get('coat', 0.0)
        b.inputs['Coat Roughness'].default_value = 0.05
    except KeyError:
        pass
    if spec.get('aniso'):
        b.inputs['Anisotropic'].default_value = spec['aniso']
        b.inputs['Anisotropic Rotation'].default_value = 0.25
    if spec.get('trans'):
        b.inputs['Transmission Weight'].default_value = spec['trans']
        b.inputs['IOR'].default_value = spec.get('ior', 1.45)
    if spec.get('emit', 0) > 0:
        try:
            b.inputs['Emission Color'].default_value = c1
            b.inputs['Emission Strength'].default_value = spec['emit']
        except KeyError:
            pass
    if spec.get('paper'):
        tcp = nt.nodes.new('ShaderNodeTexCoord')
        n1 = nt.nodes.new('ShaderNodeTexNoise')
        n1.inputs['Scale'].default_value = 38.0
        n1.inputs['Detail'].default_value = 8.0
        n1.inputs['Roughness'].default_value = 0.65
        n2 = nt.nodes.new('ShaderNodeTexNoise')
        n2.inputs['Scale'].default_value = 150.0
        n2.inputs['Detail'].default_value = 3.0
        mixh = nt.nodes.new('ShaderNodeMath')
        mixh.operation = 'ADD'
        nt.links.new(tcp.outputs['Object'], n1.inputs['Vector'])
        nt.links.new(tcp.outputs['Object'], n2.inputs['Vector'])
        nt.links.new(n1.outputs['Fac'], mixh.inputs[0])
        nt.links.new(n2.outputs['Fac'], mixh.inputs[1])
        bp = nt.nodes.new('ShaderNodeBump')
        bp.inputs['Strength'].default_value = 0.22
        bp.inputs['Distance'].default_value = 0.01
        nt.links.new(mixh.outputs[0], bp.inputs['Height'])
        nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
        # fibre tint variation: darken base colour slightly with the coarse noise
        mc = nt.nodes.new('ShaderNodeMix')
        mc.data_type = 'RGBA'
        mc.blend_type = 'MULTIPLY'
        mc.inputs['Factor'].default_value = 0.14
        if col is not None:
            nt.links.new(col, mc.inputs['A'])
        else:
            mc.inputs['A'].default_value = c1
        nt.links.new(n1.outputs['Color'], mc.inputs['B'])
        nt.links.new(mc.outputs['Result'], b.inputs['Base Color'])
        try:
            b.inputs['Subsurface Weight'].default_value = 0.1
            b.inputs['Subsurface Radius'].default_value = (0.08, 0.05, 0.03)
            b.inputs['Sheen Weight'].default_value = 0.25
        except KeyError:
            pass
    nt.links.new(b.outputs[0], out.inputs['Surface'])
    return _store(ck, m)


def _store(ck, m):
    _cache[ck] = m
    return m


def reset_scene(st):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _cache.clear()
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception:
        pass
    sc.cycles.max_bounces = 8
    sc.cycles.transmission_bounces = 8
    sc.cycles.use_adaptive_sampling = True
    sc.render.resolution_x = sc.render.resolution_y = SIZE
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'

    w = bpy.data.worlds.new('w')
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    nt.links.new(bg.outputs[0], out.inputs[0])
    kind = st['world']
    if kind in ('studio',):
        # vertical gradient sky: bright top, mid band, dark floor -> believable reflections
        tc = nt.nodes.new('ShaderNodeTexCoord')
        sep = nt.nodes.new('ShaderNodeSeparateXYZ')
        nt.links.new(tc.outputs['Generated'], sep.inputs[0])
        ramp = nt.nodes.new('ShaderNodeValToRGB')
        e = ramp.color_ramp.elements
        e[0].position, e[0].color = 0.0, (0.28, 0.3, 0.36, 1)
        e[1].position, e[1].color = 1.0, (2.2, 2.3, 2.5, 1)
        e.new(0.5).color = (0.55, 0.58, 0.65, 1)
        e.new(0.56).color = (1.4, 1.38, 1.3, 1)
        nt.links.new(sep.outputs['Z'], ramp.inputs[0])
        nt.links.new(ramp.outputs[0], bg.inputs[0])
        bg.inputs[1].default_value = 0.7
    elif kind == 'dark':
        bg.inputs[0].default_value = (0.05, 0.06, 0.1, 1)
        bg.inputs[1].default_value = 0.6
    elif kind == 'none':
        bg.inputs[0].default_value = (0, 0, 0, 1)
        bg.inputs[1].default_value = 0.0
    else:
        bg.inputs[0].default_value = (0.93, 0.94, 0.97, 1)
        bg.inputs[1].default_value = 0.8 if kind == 'soft' else 1.0

    cd = bpy.data.cameras.new('cam')
    cd.type = 'PERSP' if (st.get('photo') or st.get('real') or st.get('persp')) else 'ORTHO'
    if st.get('photo') or st.get('real') or st.get('persp'):
        cd.lens = 85
        cd.sensor_width = 36
    cd.ortho_scale = (3.9 if st.get('photo') else 3.5) if st['shape'] != 'none' else 3.3
    cam = bpy.data.objects.new('cam', cd)
    sc.collection.objects.link(cam)
    d = Vector((st['tilt'][0], -1.0, st['tilt'][1])).normalized()
    cam.location = d * (9.4 if (st.get('photo') or st.get('real') or st.get('persp')) else 16)
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam

    def area(name, loc, energy, size, color=(1, 1, 1)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy, ld.size, ld.color = energy, size, color
        lo = bpy.data.objects.new(name, ld)
        lo.location = loc
        lo.rotation_euler = (-Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        sc.collection.objects.link(lo)

    if st.get('flat'):
        return
    if st.get('photo'):
        def box(name, loc, energy, sx, sy):
            ld = bpy.data.lights.new(name, 'AREA')
            ld.shape = 'RECTANGLE'
            ld.size, ld.size_y, ld.energy = sx, sy, energy
            lo = bpy.data.objects.new(name, ld)
            lo.location = loc
            lo.rotation_euler = (-Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
            sc.collection.objects.link(lo)
        box('top', (-1.5, -4.0, 6.5), 1100, 7.0, 3.0)
        box('left', (-6.5, -3.5, 1.0), 900, 1.6, 6.0)
        box('right', (6.5, -3.0, 0.5), 700, 1.2, 6.0)
        box('floor', (0.5, -5.0, -5.0), 200, 6.0, 1.5)
        box('sheen', (-2.2, -9.0, 2.8), 650, 4.2, 2.2)
        return
    if kind == 'dark':
        area('key', (-4.5, -5.5, 6.5), 500, 5.0, (0.8, 0.88, 1.0))
        area('rim', (0.5, 6.0, 5.0), 500, 4.0, (0.7, 0.8, 1.0))
    elif st.get('emboss'):
        area('key', (-6.0, -5.0, 6.0), 900, 9.0, (1, 0.99, 0.97))
        area('fill', (6.0, -4.0, -2.0), 120, 8.0)
    elif st.get('layers'):
        area('key', (-5.0, -5.0, 7.5), 520, 2.4, (1, 0.97, 0.93))
        area('fill', (5.0, -5.0, 2.0), 150, 8.0)
    else:
        area('key', (-4.5, -5.5, 6.5), 720, 5.0, (1.0, 0.97, 0.92))
        area('fill', (6.0, -4.0, 2.0), 170, 6.0, (0.9, 0.94, 1.0))
        area('rim', (0.5, 6.0, 5.0), 260, 4.0)


def finish(ob, bevel, material, segments=6):
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    if bevel > 0:
        bpy.ops.object.shade_smooth()
        m = ob.modifiers.new('bev', 'BEVEL')
        m.width = bevel
        m.segments = segments
        m.limit_method = 'ANGLE'
        m.angle_limit = math.radians(40)
        m.profile = 0.7
        w = ob.modifiers.new('wn', 'WEIGHTED_NORMAL')
        w.keep_sharp = True
        w.weight = 60
    ob.data.materials.append(material)
    ob.select_set(False)
    return ob


def extrude(pts, depth, material, yfront, bevel=0.0, segs=6):
    """Outline in XZ extruded back from yfront (front face at yfront, camera looks from -Y)."""
    me = bpy.data.meshes.new('m')
    ob = bpy.data.objects.new('o', me)
    bpy.context.scene.collection.objects.link(ob)
    bm = bmesh.new()
    vs = [bm.verts.new((x, 0, z)) for x, z in pts]
    f = bm.faces.new(vs)
    ret = bmesh.ops.extrude_face_region(bm, geom=[f])
    vv = [e for e in ret['geom'] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=vv, vec=(0, depth, 0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    ob.location.y = yfront
    return finish(ob, min(bevel, depth * 0.48), material, segs)


# ------------------------------------------------------------------ build context
def extrude_geom(geom, depth, material, yfront, bevel=0.0, segs=6):
    """Extrude a shapely (Multi)Polygon (holes allowed) along +Y from yfront."""
    import shapely
    polys = list(geom.geoms) if hasattr(geom, 'geoms') else [geom]
    obs = []
    for pg in polys:
        if pg.is_empty or pg.area < 1e-5:
            continue
        tri = shapely.constrained_delaunay_triangles(pg)
        me = bpy.data.meshes.new('m')
        ob = bpy.data.objects.new('o', me)
        bpy.context.scene.collection.objects.link(ob)
        bm = bmesh.new()
        cache = {}

        def vert(p):
            k = (round(p[0], 6), round(p[1], 6))
            if k not in cache:
                cache[k] = bm.verts.new((k[0], 0, k[1]))
            return cache[k]
        fs = []
        for t in tri.geoms:
            c = list(t.exterior.coords)[:-1]
            if len(c) != 3:
                continue
            try:
                fs.append(bm.faces.new([vert(c[0]), vert(c[1]), vert(c[2])]))
            except ValueError:
                pass
        bmesh.ops.recalc_face_normals(bm, faces=fs)
        ret = bmesh.ops.extrude_face_region(bm, geom=fs)
        vv = [e for e in ret['geom'] if isinstance(e, bmesh.types.BMVert)]
        bmesh.ops.translate(bm, verts=vv, vec=(0, depth, 0))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-6)
        bm.to_mesh(me)
        bm.free()
        ob.location.y = yfront
        obs.append(finish(ob, min(bevel, depth * 0.48), material, segs))
    return obs


class Ctx:
    def __init__(self, st, tone):
        self.st, self.tone = st, tone
        self.top = 0.0
        self.layers = []  # [role, shapely geometry, depth, bevel]

    def m(self, role):
        if role[:2] in ('c:', 'e:'):
            hexc = role[2:]
            if role[0] == 'e':
                spec = S(k='solid', c1=hexc, emit=1.6)
            elif self.st.get('flat') or self.st.get('world') == 'none':
                spec = S(k='solid', c1=hexc, emit=1)
            else:
                spec = S(k='solid', c1=hexc, rough=0.55)
            return make_mat(spec, 0, role)
        return make_mat(self.st[role], self.tone, role)

    def geom_part(self, g, role, depth=None, bevel=None):
        from shapely.affinity import scale as _scale
        st = self.st
        s = st.get('gs', 0.92) if st['shape'] != 'none' else st.get('gscale', 1.0)
        g = _scale(g, s, s, origin=(0, 0))
        if self.layers and self.layers[-1][0] == role:
            self.layers[-1][1] = self.layers[-1][1].union(g)
        else:
            gd = depth if depth is not None else st['gdepth']
            gb = bevel if bevel is not None else st['gbev']
            self.layers.append([role, g, gd, gb])

    def part(self, pts, role='g', lift=0, depth=None, bevel=None):
        """Add a piece. Consecutive pieces of one role are merged into ONE outline (no seams, no nicks);
        a piece of another role starts a new layer on top."""
        from shapely.geometry import Polygon
        st = self.st
        s = st.get('gs', 0.92) if st['shape'] != 'none' else st.get('gscale', 1.0)
        pg = Polygon([(x * s, y * s) for x, y in pts])
        if not pg.is_valid:
            pg = pg.buffer(0)
        if self.layers and self.layers[-1][0] == role:
            self.layers[-1][1] = self.layers[-1][1].union(pg)
        else:
            gd = depth if depth is not None else st['gdepth']
            gb = bevel if bevel is not None else st['gbev']
            self.layers.append([role, pg, gd, gb])

    def flush(self):
        st = self.st
        k_off = 0.0
        for i, (role, g, gd, gb) in enumerate(self.layers):
            r = 0.075 * (0.92 if st['shape'] != 'none' else 1.0)
            g = g.buffer(r, join_style=1, resolution=16).buffer(-r, join_style=1, resolution=16)  # closing: fills nicks/seams
            o = 0.022
            g = g.buffer(-o, join_style=1, resolution=16).buffer(o, join_style=1, resolution=16)  # opening: removes micro-spikes
            g = g.simplify(0.0015)
            if st.get('flat'):
                yf = self.top - 0.02 * (i + 1)
                d = 0.01
            else:
                yf = self.top - gd - k_off + 0.012
                d = gd
                k_off += gd * st.get('kstep', 0.62)
            extrude_geom(g, d, self.m(role), yf, 0.0 if st.get('flat') else gb)


def build_photo(cx):
    st = cx.st
    # machined aluminium ring
    ring = extrude(squircle(1.48), 1.1, make_mat(st['bz'], cx.tone, 'bz'), -0.6, 0.0)
    cutter = extrude(squircle(1.2), 2.0, make_mat(st['bz'], cx.tone, 'bz'), -1.0, 0.0)
    bpy.context.view_layer.objects.active = ring
    bm_ = ring.modifiers.new('cut', 'BOOLEAN')
    bm_.operation = 'DIFFERENCE'
    bm_.object = cutter
    bm_.solver = 'EXACT'
    bpy.ops.object.modifier_apply(modifier='cut')
    bpy.data.objects.remove(cutter, do_unlink=True)
    bpy.ops.object.shade_smooth()
    bv = ring.modifiers.new('bev', 'BEVEL')
    bv.width = 0.05
    bv.segments = 5
    bv.limit_method = 'ANGLE'
    bv.angle_limit = math.radians(35)
    # enamel dial (recessed), glass crystal over it
    extrude(squircle(1.24), 0.3, make_mat(st['tile'], cx.tone, 'tile'), -0.14, 0.03)
    gm = bpy.data.materials.new('glass')
    gm.use_nodes = True
    nt = gm.node_tree
    nt.nodes.clear()
    o = nt.nodes.new('ShaderNodeOutputMaterial')
    gl = nt.nodes.new('ShaderNodeBsdfGlass')
    gl.inputs['Roughness'].default_value = 0.0
    gl.inputs['IOR'].default_value = 1.5
    gl.inputs['Color'].default_value = (0.97, 0.98, 1.0, 1)
    nt.links.new(gl.outputs[0], o.inputs['Surface'])
    extrude(squircle(1.2), 0.1, gm, -0.56, 0.045)
    cx.top = -0.14


def build_tile(cx):
    st = cx.st
    if st.get('real') and st.get('layers'):
        td = st['tdepth']
        sc_ = st.get('scene_cols')
        cols = [sc_[0], sc_[2]] if sc_ else [('T1L', 0), ('T1', 0)]
        for k, (hh, (cc, _)) in enumerate([(1.46, cols[0]), (1.34, cols[1])]):
            sp = S(k='solid', c1=cc, rough=0.85, paper=True)
            extrude(squircle(hh), td, make_mat(sp, cx.tone, f'sheet{k}'), td * (2 - k), 0.012)
        extrude(squircle(1.22), td, make_mat(st['tile'], cx.tone, 'tile'), 0.0, 0.015)
        return
    if st.get('real'):
        extrude(squircle(1.4), 0.12, make_mat(st['tile'], cx.tone, 'tile'), 0.0, 0.03)
        return
    if st.get('photo'):
        build_photo(cx)
        return
    if st['shape'] == 'none':
        cx.top = 0.0
        return
    h = 1.4
    td = st['tdepth']
    if st.get('bezel'):
        extrude(squircle(h + 0.1), td + 0.08, make_mat(st['bz'], cx.tone, 'bz'), td / 2 + 0.04, 0.08)
        h -= 0.0
        extrude(squircle(h - 0.06), td + 0.01, make_mat(st['tile'], cx.tone, 'tile'), td / 2 - 0.01, st['tbev'])
        cx.top = -td / 2 + 0.0
    elif st.get('layers'):
        cols = st.get('scene_cols') or [('T1L', 1.4), ('T1', 1.27), ('T0', 1.14)]
        y = td * 3
        for i, (c, hh) in enumerate(cols):
            sp = S(k='solid', c1=c, rough=0.9, paper=st.get('paper'))
            extrude(squircle(hh), td, make_mat(sp, cx.tone, f'pl{i}'), y - td * i, 0.01)
        cx.top = y - td * 2 - td
    else:
        extrude(squircle(h), td, make_mat(st['tile'], cx.tone, 'tile'), td / 2, st['tbev'])
        cx.top = -td / 2
    if st.get('gloss'):
        # classic skeuomorphic gloss: soft white cap over the upper half
        gl = bpy.data.materials.new('gloss')
        gl.use_nodes = True
        nt = gl.node_tree
        nt.nodes.clear()
        out = nt.nodes.new('ShaderNodeOutputMaterial')
        em = nt.nodes.new('ShaderNodeEmission')
        tr_ = nt.nodes.new('ShaderNodeBsdfTransparent')
        mx = nt.nodes.new('ShaderNodeMixShader')
        tc = nt.nodes.new('ShaderNodeTexCoord')
        sep = nt.nodes.new('ShaderNodeSeparateXYZ')
        mp = nt.nodes.new('ShaderNodeMapRange')
        mp.inputs['From Min'].default_value = -0.35
        mp.inputs['From Max'].default_value = 1.3
        mp.inputs['To Min'].default_value = 0.0
        mp.inputs['To Max'].default_value = 1.0
        nt.links.new(tc.outputs['Object'], sep.inputs[0])
        nt.links.new(sep.outputs['Z'], mp.inputs[0])
        mul = nt.nodes.new('ShaderNodeMath')
        mul.operation = 'MULTIPLY'
        mul.inputs[1].default_value = 0.36
        nt.links.new(mp.outputs[0], mul.inputs[0])
        nt.links.new(mul.outputs[0], mx.inputs[0])
        nt.links.new(tr_.outputs[0], mx.inputs[1])
        nt.links.new(em.outputs[0], mx.inputs[2])
        nt.links.new(mx.outputs[0], out.inputs['Surface'])
        cap = [(x, z) for x, z in squircle(h - 0.1)]
        cap = [(x, max(z, 0.0)) for x, z in cap if True]
        cap = [(x * 0.95, z) for x, z in cap]
        pts = [p for p in squircle(h - 0.12) if p[1] >= 0.02]
        pts = sorted(pts, key=lambda p: -math.atan2(p[1], p[0]))
        pts = [(x, z) for x, z in pts]
        # lens-shaped highlight
        hl = [(x * 0.96, 0.08 + z * 0.46) for x, z in squircle(1.0, 3.0) if z >= 0] if False else None
        top = [(x * 0.97, z * 0.97) for x, z in squircle(h - 0.12, m=240) if z > 0.0 and abs(x) < 1.28]
        top = sorted(top, key=lambda p: -p[0])
        top = [p for p in top if p[1] > 0.45 or abs(p[0]) < 1.0] if False else top
        low = [(x, 0.18 - 0.5 * (1 - (x / 1.3) ** 2)) for x in [-1.3 + 2.6 * k / 30 for k in range(31)]]
        flat_cut = [p for p in top if p[1] > 0.3] + low[::-1][:0]
        flat_cut = sorted([p for p in top if p[1] > 0.2], key=lambda p: math.atan2(p[1], p[0]))
        flat_cut = flat_cut[::-1] if False else flat_cut
        flat_cut = flat_cut + low
        o = extrude(flat_cut, 0.01, gl, cx.top - 0.02, 0.0)
    if st.get('blobs'):
        # coloured light blobs behind the glass so it has something to refract
        lo, hi = TONES[cx.tone]
        for (x, z, r, c) in ((-0.55, 0.5, 0.75, mix(hi, '#ffffff', 0.5)), (0.6, -0.55, 0.8, lo)):
            bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=(x, td + 0.35, z))
            ob = bpy.context.object
            em = bpy.data.materials.new('b')
            em.use_nodes = True
            nt = em.node_tree
            nt.nodes.clear()
            o2 = nt.nodes.new('ShaderNodeOutputMaterial')
            e2 = nt.nodes.new('ShaderNodeEmission')
            e2.inputs['Color'].default_value = srgb(c)
            e2.inputs['Strength'].default_value = 1.1
            nt.links.new(e2.outputs[0], o2.inputs['Surface'])
            ob.data.materials.append(em)


# ------------------------------------------------------------------ glyphs (design space +-1, y up)
def g_dumbbell(c):
    ang = 35
    c.part(rot2(pill(1.7, 0.26), ang), 'd')
    for sx in (-1, 1):
        c.part(rot2(tr(rrect(0.34, 1.12, 0.12), sx * 0.52, 0), ang), 'g', 1)
        c.part(rot2(tr(rrect(0.26, 0.76, 0.1), sx * 0.8, 0), ang), 'a', 1) if False else None
        c.part(rot2(tr(rrect(0.22, 0.74, 0.09), sx * 0.8, 0), ang), 'g', 1)
    c.part(rot2(pill(0.5, 0.26), ang), 'a', 1)


def g_peak(c):
    c.part(rounded_poly([(-1.0, -0.62), (-0.18, 0.86), (0.64, -0.62)], 0.14, 0.05), 'g')
    c.part(rounded_poly([(0.12, -0.62), (0.62, 0.22), (1.05, -0.62)], 0.12, 0.05), 'g', 0)
    c.part(rounded_poly([(-0.18, 0.86), (-0.46, 0.38), (-0.3, 0.4), (-0.18, 0.28), (-0.06, 0.4), (0.1, 0.38)], 0.06, 0.04), 'a', 1)


def g_whistle(c):
    c.part(tr(circle(0.56), 0.22, -0.2), 'g')
    c.part(rot2(tr(rrect(1.0, 0.5, 0.16), -0.52, 0.12), 8), 'g')
    c.part(tr(circle(0.2), 0.22, -0.2), 'a', 1)
    c.part(rot2(tr(rrect(0.5, 0.15, 0.06), -0.62, 0.14), 8), 'a', 1)
    c.part(tr(circle(0.13), 0.26, 0.58), 'g')
    c.part(tr(pill(0.1, 0.34), 0.26, 0.42), 'g')


def g_apple(c):
    cen = (0.0, -0.1)
    pts = []
    for k in range(120):
        t = 2 * math.pi * k / 120
        best = 0
        for cx_ in (-0.3, 0.3):
            ox, oy = cx_ - cen[0], -0.12 - cen[1]
            dx, dy = math.cos(t), math.sin(t)
            b = dx * (-ox) + dy * (-oy)
            disc = b * b - (ox * ox + oy * oy - 0.62 * 0.62)
            r = -b + math.sqrt(max(disc, 0))
            best = max(best, r)
        notch = 0.14 * math.exp(-((math.atan2(math.sin(t - math.pi / 2), math.cos(t - math.pi / 2))) / 0.2) ** 2)
        best -= notch
        pts.append((cen[0] + best * math.cos(t), cen[1] + best * math.sin(t) * 0.98))
    c.part(pts, 'g')
    leaf = rot2(ellipse(0.36, 0.15), 38)
    c.part(tr(leaf, 0.32, 0.78), 'a', 1)
    c.part(rot2(pill(0.1, 0.34), -12, (0, 0)) if False else tr(rot2(pill(0.1, 0.36), -14), 0.02, 0.66), 'd', 0)


def g_note(c):
    for sx in (-0.55, 0.5):
        c.part(tr(rot2(ellipse(0.3, 0.23), 18), sx, -0.58), 'g')
        c.part(tr(pill(0.12, 1.4), sx + 0.22, 0.04), 'g')
    c.part(rounded_poly([(-0.33, 0.78), (0.72, 0.98), (0.72, 0.58), (-0.33, 0.38)], 0.05, 0.03), 'a', 1)


def g_heart(c):
    pts = []
    for k in range(120):
        t = 2 * math.pi * k / 120
        pts.append((16 * math.sin(t) ** 3 / 17.0,
                    (13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)) / 17.0 + 0.04))
    c.part(pts, 'g')
    line = [(-0.8, -0.04), (-0.34, -0.04), (-0.14, 0.34), (0.14, -0.42), (0.34, -0.04), (0.8, -0.04)]
    w = 0.15
    for i, ((x0, z0), (x1, z1)) in enumerate(zip(line, line[1:])):
        ln = math.hypot(x1 - x0, z1 - z0)
        a = math.degrees(math.atan2(z1 - z0, x1 - x0))
        c.part(tr(rot2(pill(ln + w, w), a), (x0 + x1) / 2, (z0 + z1) / 2), 'a', 1, depth=c.st['gdepth'] * (1 + 0.04 * i))


def g_moon(c):
    c.part(rot2(crescent(1.0, 0.82, 0.5), -28), 'g')
    c.part(tr(star4(0.3, 0.09), 0.5, 0.45), 'a', 0)
    c.part(tr(star4(0.18, 0.055), 0.12, -0.5), 'a', 0)


def g_bolt(c):
    c.part(rounded_poly([(0.2, 1.0), (-0.62, -0.1), (-0.06, -0.1), (-0.22, -1.0), (0.64, 0.14), (0.06, 0.14)], 0.1, 0.05), 'g')
    c.part(rounded_poly([(0.12, 0.72), (-0.3, 0.06), (0.04, 0.06), (-0.04, -0.5), (0.34, 0.2), (0.1, 0.2)], 0.04, 0.02), 'a', 1) if False else None


def g_house(c):
    c.part(rounded_poly([(-1.0, 0.0), (0.0, 0.96), (1.0, 0.0)], 0.12, 0.04), 'g')
    c.part(rrect(1.46, 1.0, 0.1) if False else tr(rrect(1.4, 0.98, 0.1), 0, -0.5), 'g')
    c.part(tr(rrect(0.46, 0.7, 0.1), 0, -0.64), 'a', 1)
    c.part(tr(circle(0.06), 0.1, -0.64), 'g', 2) if False else None
    c.part(tr(pill(0.62, 0.17), 0.0, 0.12), 'a', 1) if False else None


def g_target(c):
    c.part(circle(1.0), 'g')
    c.part(circle(0.72), 'a', 1)
    c.part(circle(0.45), 'g', 2)
    c.part(circle(0.2), 'a', 3)
    c.part(tr(rot2(pill(1.1, 0.14), 45), 0.62, 0.62), 'd', 4, depth=0.07)


def g_book(c):
    c.part(tr(rrect(1.46, 1.96, 0.14), 0.04, 0), 'g')
    c.part(tr(rrect(0.2, 1.96, 0.07), -0.62, 0), 'a', 1)
    c.part(rounded_poly([(-0.18, 0.45), (-0.18, -0.45), (0.58, 0.0)], 0.12, 0.05), 'a', 1)


def g_sparkle(c):
    c.part(star4(1.0, 0.24), 'g')
    c.part(tr(star4(0.42, 0.11), 0.68, 0.7), 'a', 1)
    c.part(tr(star4(0.28, 0.08), -0.7, -0.66), 'a', 1)


def g_broadcast(c):
    c.part(circle(0.22), 'g')
    for r, w in ((0.58, 0.17), (0.98, 0.17)):
        for s in (-1, 1):
            a0, a1 = (-42, 42) if s == 1 else (138, 222)
            c.part(rounded_poly(stroke_poly(arc(r, a0, a1, n=20), w), 0.07, 0.02, 4), 'g')


def g_bell(c):
    dome = arc(0.55, 0, 180, c=(0, 0.14), n=32)
    body = dome + [(-0.55, 0.0), (-0.86, -0.5), (0.86, -0.5), (0.55, 0.0)]
    c.part(rounded_poly(body, 0.14, 0.06), 'g')
    c.part(tr(circle(0.13), 0, 0.82), 'g')
    c.part(tr(circle(0.19), 0, -0.76), 'a', 0)
    c.part(tr(pill(0.14, 0.6), -0.0, 0.2), 'a', 1) if False else None


def g_notes(c):
    page = [(-0.72, -0.98), (0.72, -0.98), (0.72, 0.48), (0.2, 0.98), (-0.72, 0.98)]
    c.part(rounded_poly(page, 0.12, 0.04), 'g')
    c.part(rounded_poly([(0.2, 0.98), (0.2, 0.48), (0.72, 0.48)], 0.05, 0.03), 'a', 1)
    for i, w in enumerate((1.0, 1.0, 0.62)):
        c.part(tr(pill(w, 0.14), -0.72 + 0.14 + w / 2 + 0.1 - 0.0 - 0.1, 0.12 - i * 0.36), 'a', 1)


def g_team(c):
    for sx, sc_, role, lf in ((-0.62, 0.78, 'g', 0), (0.62, 0.78, 'g', 0)):
        c.part(tr(sc2(circle(0.24), sc_), sx, 0.3), role, lf)
        c.part(tr(sc2(rounded_poly([(-0.5, -0.7), (0.5, -0.7), (0.5, -0.1), (-0.5, -0.1)], 0.3, 0.05), sc_), sx, -0.5), role, lf)
    c.part(tr(circle(0.32), 0, 0.42), 'a', 1)
    c.part(tr(rounded_poly([(-0.62, -0.92), (0.62, -0.92), (0.62, -0.08), (-0.62, -0.08)], 0.36, 0.05), 0, 0.0), 'a', 1)
    c.part(tr(circle(0.28), 0, 0.42), 'g', 2)
    c.part(tr(rounded_poly([(-0.52, -0.92), (0.52, -0.92), (0.52, -0.1), (-0.52, -0.1)], 0.32, 0.05), 0, 0.0), 'g', 2)


def g_lens(c):
    c.part(circle(1.0), 'g')
    c.part(circle(0.74), 'a', 1)
    c.part(rounded_poly(stroke_poly(arc(0.5, 110, 175, n=12), 0.13), 0.05, 0.02, 4), 'g', 2)
    c.part(tr(circle(0.07), 0.3, 0.42), 'g', 2)


def g_cyber(c):
    def cut(h, k):
        return [(-h + k, h), (h, h), (h, -h + k), (h - k, -h), (-h, -h), (-h, h - k)]
    c.part(rounded_poly(cut(0.96, 0.4), 0.05, 0.03, 3), 'g')
    c.part(rounded_poly(cut(0.64, 0.28), 0.04, 0.03, 3), 'a', 1)
    c.part(tr(pill(0.62, 0.13), -0.06, 0.0), 'g', 2)
    c.part(tr(pill(0.13, 0.62), 0.0, -0.06), 'g', 2)


def g_gift(c):
    c.part(tr(rrect(1.5, 1.0, 0.1), 0, -0.4), 'g')
    c.part(tr(rrect(1.76, 0.42, 0.1), 0, 0.22), 'g', 1)
    c.part(tr(rrect(0.3, 1.36, 0.06), 0, -0.2), 'a', 2)
    for s in (-1, 1):
        c.part(tr(rot2(ellipse(0.34, 0.19), s * 38), s * 0.3, 0.7), 'a', 2)
    c.part(tr(circle(0.13), 0, 0.5), 'a', 3)



def chain(c, pts, w, role='g', lift=0):
    for i, ((x0, z0), (x1, z1)) in enumerate(zip(pts, pts[1:])):
        ln = math.hypot(x1 - x0, z1 - z0)
        a = math.degrees(math.atan2(z1 - z0, x1 - x0))
        c.part(tr(rot2(pill(ln + w, w), a), (x0 + x1) / 2, (z0 + z1) / 2), role, lift, depth=c.st['gdepth'] * (1 + 0.03 * i))


def g_dumbbell(c):
    ang = 35
    c.part(rot2(pill(2.0, 0.26), ang), 'g')
    for sx in (-1, 1):
        c.part(rot2(tr(rrect(0.34, 1.16, 0.12), sx * 0.5, 0), ang), 'g', 1)
        c.part(rot2(tr(rrect(0.24, 0.78, 0.1), sx * 0.8, 0), ang), 'g', 1)
    for sx in (-1, 1):
        c.part(rot2(tr(pill(0.07, 0.8), sx * 0.65, 0), ang), 'a', 2) if False else None


def g_peak(c):
    c.part(tr(rounded_poly([(-1.0, -0.62), (-0.18, 0.72), (0.64, -0.62)], 0.14, 0.05), 0, -0.1), 'g')
    c.part(tr(rounded_poly([(0.12, -0.62), (0.62, 0.2), (1.05, -0.62)], 0.12, 0.05), 0, -0.1), 'g')
    c.part(tr(pill(0.1, 0.62), -0.18, 0.92), 'g')
    c.part(tr(rounded_poly([(0.0, 0.0), (0.56, 0.2), (0.0, 0.42)], 0.05, 0.03), -0.13, 0.82 + 0.0), 'g')


def g_whistle(c):
    c.part(tr(circle(0.6), 0.28, -0.2), 'g')
    c.part(tr(rrect(1.2, 0.5, 0.14), -0.42, 0.22), 'g')
    c.part(tr(circle(0.19), 0.28, -0.2), 'a', 1)
    c.part(tr(pill(0.52, 0.12), -0.5, 0.22), 'a', 1)
    c.part(tr(circle(0.2), 0.62, 0.6), 'g')
    c.part(tr(circle(0.09), 0.62, 0.6), 'a', 1)


def g_apple(c):
    cen = (0.0, -0.1)
    pts = []
    for k in range(140):
        t = 2 * math.pi * k / 140
        best = 0
        for cx_ in (-0.2, 0.2):
            ox, oy = cx_ - cen[0], -0.1 - cen[1]
            dx, dy = math.cos(t), math.sin(t)
            b = dx * (-ox) + dy * (-oy)
            disc = b * b - (ox * ox + oy * oy - 0.7 * 0.7)
            best = max(best, -b + math.sqrt(max(disc, 0)))
        best -= 0.08 * math.exp(-((math.atan2(math.sin(t - math.pi / 2), math.cos(t - math.pi / 2))) / 0.22) ** 2)
        best -= 0.05 * math.exp(-((math.atan2(math.sin(t + math.pi / 2), math.cos(t + math.pi / 2))) / 0.3) ** 2)
        pts.append((cen[0] + best * math.cos(t), cen[1] + best * math.sin(t)))
    c.part(pts, 'g')
    c.part(tr(rot2(ellipse(0.38, 0.16), 32), 0.34, 0.8), 'g')
    c.part(tr(rot2(pill(0.11, 0.4), -12), 0.0, 0.66), 'g')


def g_note(c):
    for sx in (-0.55, 0.5):
        c.part(tr(rot2(ellipse(0.31, 0.24), 18), sx, -0.6), 'g')
        c.part(tr(pill(0.13, 1.45), sx + 0.22, 0.04), 'g')
    c.part(rounded_poly([(-0.33, 0.8), (0.72, 1.0), (0.72, 0.56), (-0.33, 0.36)], 0.05, 0.03), 'g', 1)


def g_moon(c):
    c.part(rot2(crescent(1.0, 0.82, 0.5), -28), 'g')
    c.part(tr(star4(0.36, 0.1), 0.45, -0.1), 'g')


def g_activity(c):
    c.part(tr(circle(0.21), 0.34, 0.8), 'g')
    chain(c, [(0.08, 0.5), (-0.14, -0.1)], 0.3)
    chain(c, [(-0.14, -0.1), (0.3, -0.42), (0.22, -0.92)], 0.26)
    chain(c, [(-0.14, -0.1), (-0.5, -0.38), (-0.92, -0.3)], 0.26)
    chain(c, [(0.05, 0.4), (0.5, 0.2), (0.78, 0.46)], 0.22)
    chain(c, [(0.05, 0.4), (-0.4, 0.22), (-0.62, -0.04)], 0.22)


g_bolt = g_activity


def g_house(c):
    c.part(rounded_poly([(-1.02, 0.0), (0.0, 0.98), (1.02, 0.0)], 0.12, 0.04), 'g')
    c.part(tr(rrect(1.42, 1.0, 0.1), 0, -0.5), 'g')
    for sx in (-1, 1):
        c.part(tr(rrect(0.15, 0.52, 0.05), sx * 0.3, -0.52), 'a', 1)
        c.part(tr(rrect(0.11, 0.32, 0.04), sx * 0.46, -0.52), 'a', 1)
    c.part(tr(pill(0.62, 0.075), 0, -0.52), 'a', 1)


def g_team(c):
    for sx in (-0.7, 0.7):
        c.part(tr(circle(0.2), sx, 0.3), 'g')
        c.part(tr(rounded_poly([(-0.32, -0.34), (0.32, -0.34), (0.32, 0.08), (-0.32, 0.08)], 0.18, 0.04), sx, -0.46), 'g')
    c.part(tr(circle(0.4), 0, 0.4), 'a', 1)
    c.part(tr(rounded_poly([(-0.64, -0.9), (0.64, -0.9), (0.64, -0.06), (-0.64, -0.06)], 0.4, 0.04), 0, 0.0), 'a', 1)
    c.part(tr(circle(0.31), 0, 0.4), 'g', 2)
    c.part(tr(rounded_poly([(-0.55, -0.82), (0.55, -0.82), (0.55, -0.1), (-0.55, -0.1)], 0.34, 0.04), 0, 0.0), 'g', 2)


def g_bell(c):
    dome = arc(0.55, 0, 180, c=(0, 0.14), n=32)
    body = dome + [(-0.55, 0.0), (-0.88, -0.5), (0.88, -0.5), (0.55, 0.0)]
    c.part(rounded_poly(body, 0.14, 0.06), 'g')
    c.part(tr(circle(0.13), 0, 0.82), 'g')
    c.part(tr(circle(0.2), 0, -0.78), 'g')


def g_cyber(c):
    def cut(h, k):
        return [(-h + k, h), (h, h), (h, -h + k), (h - k, -h), (-h, -h), (-h, h - k)]
    c.part(rounded_poly(cut(0.98, 0.42), 0.05, 0.03, 3), 'g')
    c.part(rounded_poly(cut(0.7, 0.3), 0.04, 0.03, 3), 'a', 1)
    for dx in (-0.18, 0.22):
        c.part(tr(rounded_poly(stroke_poly([(-0.14, 0.34), (0.1, 0.0), (-0.14, -0.34)], 0.17), 0.06, 0.02, 4), dx, 0), 'g', 2)


def g_gift(c):
    c.part(tr(rrect(1.5, 1.0, 0.1), 0, -0.4), 'g')
    c.part(tr(rrect(1.76, 0.42, 0.1), 0, 0.22), 'g', 1)
    c.part(tr(rrect(0.3, 1.36, 0.06), 0, -0.2), 'a', 2)
    for s in (-1, 1):
        c.part(tr(rot2(ellipse(0.36, 0.2), s * 36), s * 0.3, 0.74), 'g', 0)
    c.part(tr(circle(0.13), 0, 0.52), 'g', 3)


def g_sparkle(c):
    c.part(star4(1.0, 0.24), 'g')
    c.part(tr(star4(0.4, 0.11), 0.7, 0.7), 'g')
    c.part(tr(star4(0.26, 0.07), -0.72, -0.68), 'g')



def g_dumbbell(c):
    ang = 35
    c.part(rot2(pill(2.0, 0.28), ang), 'g')
    for sx in (-1, 1):
        c.part(rot2(tr(rrect(0.36, 1.16, 0.13), sx * 0.5, 0), ang), 'g', 1)
        c.part(rot2(tr(rrect(0.32, 0.78, 0.11), sx * 0.78, 0), ang), 'g', 1)


def g_whistle(c):
    c.part(tr(circle(0.6), 0.28, -0.2), 'g')
    c.part(tr(rrect(1.4, 0.5, 0.12), -0.32, 0.22), 'g', 1)
    c.part(tr(circle(0.19), 0.28, -0.2), 'a', 2)
    c.part(tr(pill(0.52, 0.12), -0.52, 0.22), 'a', 2)
    c.part(tr(circle(0.21), 0.66, 0.6), 'g')
    c.part(tr(circle(0.09), 0.66, 0.6), 'a', 1)


def g_note(c):
    for sx in (-0.55, 0.5):
        c.part(tr(rot2(ellipse(0.31, 0.24), 18), sx, -0.6), 'g')
        c.part(tr(rrect(0.13, 1.4, 0.02), sx + 0.19, 0.06), 'g', 1)
    c.part(rounded_poly([(-0.395, 0.8), (0.785, 1.0), (0.785, 0.58), (-0.395, 0.38)], 0.02, 0.02), 'g', 2)


def g_house(c):
    c.part(tr(rrect(1.42, 1.0, 0.1), 0, -0.5), 'g')
    c.part(tr(rounded_poly([(-1.02, 0.0), (0.0, 0.98), (1.02, 0.0)], 0.1, 0.04), 0, -0.04), 'g', 1)
    for sx in (-1, 1):
        c.part(tr(rrect(0.17, 0.56, 0.06), sx * 0.34, -0.52), 'a', 2)
    c.part(tr(pill(0.8, 0.09), 0, -0.52), 'a', 2)


def g_book(c):
    c.part(tr(rrect(1.46, 1.96, 0.14), 0.04, 0), 'g')
    c.part(rounded_poly([(0.38, 0.98), (0.38, 0.3), (0.55, 0.45), (0.72, 0.3), (0.72, 0.98)], 0.0, 0.02, 2), 'a', 1)
    c.part(rounded_poly([(-0.34, 0.3), (-0.34, -0.6), (0.5, -0.15)], 0.12, 0.05), 'a', 1)


def g_team(c):
    for sx in (-0.72, 0.72):
        c.part(tr(circle(0.2), sx, 0.3), 'g')
        c.part(tr(rounded_poly([(-0.3, -0.8), (0.3, -0.8), (0.3, -0.2), (-0.3, -0.2)], 0.26, 0.04), sx, 0.0), 'g')
    c.part(tr(circle(0.4), 0, 0.4), 'a', 1)
    c.part(tr(rounded_poly([(-0.64, -0.9), (0.64, -0.9), (0.64, -0.06), (-0.64, -0.06)], 0.4, 0.04), 0, 0.0), 'a', 1)
    c.part(tr(circle(0.31), 0, 0.4), 'g', 2)
    c.part(tr(rounded_poly([(-0.55, -0.82), (0.55, -0.82), (0.55, -0.1), (-0.55, -0.1)], 0.34, 0.04), 0, 0.0), 'g', 2)


def g_notes(c):
    page = [(-0.72, -0.98), (0.72, -0.98), (0.72, 0.5), (0.22, 0.98), (-0.72, 0.98)]
    c.part(rounded_poly(page, 0.1, 0.03), 'g')
    c.part(rounded_poly([(0.22, 0.98), (0.22, 0.5), (0.72, 0.5)], 0.0, 0.0, 2), 'a', 1)
    for i, w in enumerate((1.0, 1.0, 0.62)):
        c.part(tr(pill(w, 0.14), -0.46 + w / 2 + 0.0, 0.1 - i * 0.36), 'a', 1)



def g_activity(c):
    c.part(tr(circle(0.22), 0.36, 0.82), 'g')
    chain(c, [(0.1, 0.5), (0.3, 0.74)], 0.25)
    chain(c, [(0.1, 0.5), (-0.14, -0.1)], 0.32)
    chain(c, [(-0.14, -0.1), (0.3, -0.42), (0.22, -0.92)], 0.27)
    chain(c, [(-0.14, -0.1), (-0.5, -0.4), (-0.92, -0.32)], 0.27)
    chain(c, [(0.07, 0.4), (0.52, 0.2), (0.8, 0.46)], 0.23)
    chain(c, [(0.07, 0.4), (-0.5, 0.34), (-0.84, 0.1)], 0.23)


g_bolt = g_activity


def g_note(c):
    for sx in (-0.55, 0.5):
        c.part(tr(rot2(ellipse(0.31, 0.24), 18), sx, -0.6), 'g')
        c.part(tr(rrect(0.13, 1.4, 0.02), sx + 0.19, 0.06), 'g', 1)
    c.part(rounded_poly([(-0.425, 0.8), (0.755, 1.0), (0.755, 0.58), (-0.425, 0.38)], 0.02, 0.02), 'g', 2)


def g_bell(c):
    dome = arc(0.55, 0, 180, c=(0, 0.14), n=32)
    body = dome + [(-0.55, 0.0), (-0.88, -0.5), (0.88, -0.5), (0.55, 0.0)]
    c.part(rounded_poly(body, 0.14, 0.06), 'g')
    c.part(tr(circle(0.13), 0, 0.82), 'g')
    c.part(tr(circle(0.2), 0, -0.86), 'a', 1)
    c.part(tr(circle(0.2), 0, -0.86), 'g', 2)



def g_dumbbell(c):
    ang = 35
    c.part(rot2(pill(2.0, 0.26), ang), 'g')
    for sx in (-1, 1):
        c.part(rot2(tr(pill(0.36, 1.2), sx * 0.5, 0), ang), 'g')
        c.part(rot2(tr(pill(0.3, 0.8), sx * 0.78, 0), ang), 'g')


def g_whistle(c):
    c.part(tr(circle(0.6), 0.28, -0.2), 'g')
    c.part(tr(rrect(1.4, 0.5, 0.12), -0.32, 0.15), 'g')
    c.part(tr(circle(0.19), 0.28, -0.2), 'a', 2)
    c.part(tr(pill(0.52, 0.12), -0.52, 0.15), 'a', 2)
    c.part(tr(circle(0.22), 0.68, 0.58), 'g')
    c.part(tr(circle(0.09), 0.68, 0.58), 'a', 1)


def g_apple(c):
    cen = (0.0, -0.1)
    pts = []
    for k in range(140):
        t = 2 * math.pi * k / 140
        best = 0
        for cx_ in (-0.2, 0.2):
            ox, oy = cx_ - cen[0], -0.1 - cen[1]
            dx, dy = math.cos(t), math.sin(t)
            b = dx * (-ox) + dy * (-oy)
            disc = b * b - (ox * ox + oy * oy - 0.7 * 0.7)
            best = max(best, -b + math.sqrt(max(disc, 0)))
        best -= 0.08 * math.exp(-((math.atan2(math.sin(t - math.pi / 2), math.cos(t - math.pi / 2))) / 0.22) ** 2)
        best -= 0.05 * math.exp(-((math.atan2(math.sin(t + math.pi / 2), math.cos(t + math.pi / 2))) / 0.3) ** 2)
        pts.append((cen[0] + best * math.cos(t), cen[1] + best * math.sin(t)))
    c.part(pts, 'g')
    chain(c, [(0.0, 0.5), (0.08, 0.88)], 0.15)
    c.part(tr(rot2(ellipse(0.4, 0.17), 24), 0.38, 0.86), 'g')


def g_peak(c):
    c.part(tr(rounded_poly([(-1.0, -0.62), (-0.18, 0.72), (0.64, -0.62)], 0.14, 0.05), 0, -0.1), 'g')
    c.part(tr(rounded_poly([(0.12, -0.62), (0.62, 0.2), (1.05, -0.62)], 0.12, 0.05), 0, -0.1), 'g')
    c.part(tr(pill(0.11, 0.7), -0.18, 0.9), 'g')
    c.part(rounded_poly([(-0.2, 0.0), (0.5, 0.2), (-0.2, 0.42)], 0.05, 0.03), 'g') if False else c.part(tr(rounded_poly([(-0.14, 0.0), (0.5, 0.2), (-0.14, 0.42)], 0.05, 0.03), 0, 0.8), 'g')


def g_activity(c):
    c.part(tr(circle(0.23), 0.36, 0.82), 'g')
    chain(c, [(0.1, 0.5), (0.32, 0.76)], 0.32)
    chain(c, [(0.1, 0.5), (-0.14, -0.1)], 0.32)
    chain(c, [(-0.14, -0.1), (0.3, -0.42), (0.22, -0.92)], 0.27)
    chain(c, [(-0.14, -0.1), (-0.5, -0.4), (-0.92, -0.32)], 0.27)
    chain(c, [(0.07, 0.4), (0.52, 0.2), (0.8, 0.46)], 0.23)
    chain(c, [(0.07, 0.4), (-0.5, 0.34), (-0.84, 0.1)], 0.23)


g_bolt = g_activity


def g_house(c):
    c.part(rounded_poly([(0.0, 1.0), (1.1, 0.1), (0.9, 0.1), (0.9, -1.0), (-0.9, -1.0), (-0.9, 0.1), (-1.1, 0.1)], 0.1, 0.05), 'g')
    c.part(tr(rrect(1.3, 0.16, 0.07), 0, -0.42), 'a', 1)
    for sx in (-1, 1):
        c.part(tr(rrect(0.3, 0.78, 0.11), sx * 0.42, -0.42), 'a', 1)
        c.part(tr(rrect(0.22, 0.5, 0.09), sx * 0.68, -0.42), 'a', 1)


def g_book(c):
    c.part(tr(rrect(1.46, 1.96, 0.14), 0.04, 0), 'g')
    c.part(rounded_poly([(0.3, 0.98), (0.3, 0.3), (0.45, 0.45), (0.6, 0.3), (0.6, 0.98)], 0.0, 0.02, 2), 'a', 1)
    c.part(rounded_poly([(-0.34, 0.3), (-0.34, -0.6), (0.5, -0.15)], 0.12, 0.05), 'a', 1)


def g_broadcast(c):
    c.part(circle(0.22), 'g')
    for r in (0.58, 0.98):
        for a0, a1 in ((-40, 40), (140, 220)):
            chain(c, arc(r, a0, a1, n=14), 0.17)


def g_bell(c):
    dome = arc(0.55, 0, 180, c=(0, 0.14), n=32)
    body = dome + [(-0.55, 0.0), (-0.88, -0.5), (0.88, -0.5), (0.55, 0.0)]
    c.part(rounded_poly(body, 0.14, 0.06), 'g')
    c.part(tr(circle(0.15), 0, 0.76), 'g')
    c.part(tr(circle(0.2), 0, -0.86), 'a', 1)
    c.part(tr(circle(0.2), 0, -0.86), 'g', 2)


def g_notes(c):
    page = [(-0.72, -0.98), (0.72, -0.98), (0.72, 0.5), (0.22, 0.98), (-0.72, 0.98)]
    c.part(rounded_poly(page, 0.1, 0.03), 'g')
    for i, w in enumerate((1.0, 1.0, 0.62)):
        c.part(tr(pill(w, 0.14), -0.46 + w / 2 + 0.0, 0.1 - i * 0.36), 'a', 1)


def g_team(c):
    for sx in (-0.9, 0.9):
        c.part(tr(circle(0.19), sx, 0.3), 'g')
        c.part(tr(rounded_poly([(-0.24, -0.8), (0.24, -0.8), (0.24, -0.2), (-0.24, -0.2)], 0.23, 0.04), sx, 0.0), 'g')
    c.part(tr(circle(0.31), 0, 0.4), 'g')
    c.part(tr(rounded_poly([(-0.46, -0.82), (0.46, -0.82), (0.46, -0.1), (-0.46, -0.1)], 0.32, 0.04), 0, 0.0), 'g')


def g_lens(c):
    c.part(circle(1.0), 'g')
    c.part(circle(0.74), 'a', 1)
    chain(c, arc(0.5, 110, 175, n=10), 0.13) if False else None
    c.part(tr(circle(0.07), 0.3, 0.42), 'g', 2)
    for r_ in (0,):
        pass
    chain_pts = arc(0.5, 112, 172, n=10)
    for i, ((x0, z0), (x1, z1)) in enumerate(zip(chain_pts, chain_pts[1:])):
        ln = math.hypot(x1 - x0, z1 - z0)
        a = math.degrees(math.atan2(z1 - z0, x1 - x0))
        c.part(tr(rot2(pill(ln + 0.13, 0.13), a), (x0 + x1) / 2, (z0 + z1) / 2), 'g', 2)


def g_cyber(c):
    def cut(h, k):
        return [(-h + k, h), (h, h), (h, -h + k), (h - k, -h), (-h, -h), (-h, h - k)]
    c.part(rounded_poly(cut(0.98, 0.42), 0.05, 0.03, 3), 'g')
    c.part(rounded_poly(cut(0.7, 0.3), 0.04, 0.03, 3), 'a', 1)
    for dx in (-0.2, 0.2):
        chain(c, [(dx - 0.12, 0.34), (dx + 0.12, 0.0), (dx - 0.12, -0.34)], 0.17, 'g', 2)



def g_dumbbell(c):
    c.part(pill(1.7, 0.26), 'g')
    for sx in (-1, 1):
        c.part(tr(rrect(0.34, 1.36, 0.14), sx * 0.5, 0), 'g')
        c.part(tr(rrect(0.26, 0.9, 0.12), sx * 0.78, 0), 'g')



def g_cyber(c):
    def cut(h, k):
        return [(-h + k, h), (h, h), (h, -h + k), (h - k, -h), (-h, -h), (-h, h - k)]
    c.part(rounded_poly(cut(0.98, 0.42), 0.05, 0.03, 3), 'g')
    c.part(rounded_poly(cut(0.7, 0.3), 0.04, 0.03, 3), 'a', 1)
    chain(c, [(-0.14, 0.4), (0.2, 0.0), (-0.14, -0.4)], 0.22, 'g', 2)


# ---------- v2 glyphs: trophy, banana, stopwatch, brain ----------
def g_trophy(c):
    # cup
    c.part(rounded_poly([(-0.62, 0.78), (0.62, 0.78), (0.5, 0.0), (0.24, -0.3), (-0.24, -0.3), (-0.5, 0.0)], 0.2, 0.05), 'g')
    # handles (arcs anchored inside the bowl)
    for sx in (-1, 1):
        pts = [(sx * (0.5 + 0.44 * math.cos(math.radians(a))), 0.38 + 0.34 * math.sin(math.radians(a))) for a in range(100, -101, -20)]
        chain(c, pts, 0.13, 'g')
    c.part(rrect(0.28, 0.5, 0.06), 'g') if False else None
    c.part(tr(rrect(0.28, 0.5, 0.06), 0, -0.45), 'g')
    c.part(tr(rrect(1.0, 0.22, 0.09), 0, -0.76), 'g')
    # star on the cup
    c.part(tr(star4(0.3, 0.12), 0, 0.36), 'a', 1)


def banana_pts(rot=-32):
    n = 48
    outer, inner = [], []
    A0, A1 = 192, 346
    for k in range(n + 1):
        t = k / n
        ph = math.radians(A0 + (A1 - A0) * t)
        h = 0.29 * (math.sin(math.pi * t) ** 0.7) + 0.012
        cx, cz = 0.0, 0.42
        R = 0.92
        outer.append(((R + h * 0.8) * math.cos(ph) + cx, (R + h * 0.8) * math.sin(ph) + cz))
        inner.append(((R - h * 1.4) * math.cos(ph) + cx, (R - h * 1.4) * math.sin(ph) + cz))
    return rot2(outer + inner[::-1], rot), (ph, rot)


def g_banana(c):
    pts, (ph_end, rot) = banana_pts()
    c.part(pts, 'g')
    ex, ez = rot2([(0.92 * math.cos(ph_end), 0.92 * math.sin(ph_end) + 0.42)], rot)[0]
    c.part(rot2(tr(rrect(0.17, 0.3, 0.06), ex + 0.0, ez + 0.1), rot + 78 - 90 + 0, (ex, ez)), 'g')
    sx_, sz_ = rot2([(0.92 * math.cos(math.radians(192)), 0.92 * math.sin(math.radians(192)) + 0.42)], rot)[0]
    c.part(tr(circle(0.075), sx_ + 0.03, sz_ + 0.02), 'a', 1)
    mid = []
    for k in range(6, 43):
        t = k / 48
        ph = math.radians(192 + 154 * t)
        mid.append((0.92 * math.cos(ph), 0.92 * math.sin(ph) + 0.42))
    chain(c, rot2(mid, rot), 0.055, 'a', 1)


def g_stopwatch(c):
    c.part(tr(circle(0.86), 0, -0.1), 'g')
    c.part(tr(rrect(0.2, 0.3, 0.06), 0, 0.84), 'g')
    c.part(tr(rrect(0.5, 0.16, 0.07), 0, 1.0), 'g')
    c.part(rot2(tr(rrect(0.2, 0.3, 0.06), 0.66, 0.72), -45), 'g')
    c.part(tr(circle(0.62), 0, -0.1), 'a', 1)
    chain(c, [(0, -0.1), (0, 0.32)], 0.13, 'g', 2)
    chain(c, [(0, -0.1), (0.3, -0.27)], 0.13, 'g', 2)
    c.part(tr(circle(0.1), 0, -0.1), 'g', 2)


def g_brain(c):
    L = [((-0.5, 0.48), 0.4), ((-0.18, 0.62), 0.38), ((-0.66, 0.02), 0.4), ((-0.55, -0.4), 0.36), ((-0.2, -0.1), 0.5), ((-0.2, -0.55), 0.34)]
    for sx in (-1, 1):
        for (x, y), r in L:
            c.part(tr(circle(r), sx * -x if sx == 1 else x, y), 'g')
    # fissure + folds
    chain(c, [(0, 0.95), (0.06, 0.6), (-0.05, 0.25), (0.05, -0.1), (-0.03, -0.45), (0.0, -0.78)], 0.1, 'a', 1)
    for sx in (-1, 1):
        chain(c, [(sx * 0.3, 0.55), (sx * 0.5, 0.42), (sx * 0.66, 0.5)], 0.08, 'a', 1)
        chain(c, [(sx * 0.35, 0.05), (sx * 0.55, -0.08), (sx * 0.78, 0.02)], 0.08, 'a', 1)
        chain(c, [(sx * 0.32, -0.42), (sx * 0.5, -0.32), (sx * 0.6, -0.46)], 0.08, 'a', 1)


# ---------- v2 theme scenes ----------
CLIP = [1.5]

def _clipped(poly_pts):
    from shapely.geometry import Polygon
    g = Polygon(poly_pts)
    if not g.is_valid:
        g = g.buffer(0)
    return g.intersection(Polygon(squircle(CLIP[0])))


def _rect(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


def _sc(c, geom, role):
    c.geom_part(geom, role, depth=0.05, bevel=0.01)


def _P(pts):
    from shapely.geometry import Polygon
    return Polygon(pts)


def _clip():
    from shapely.geometry import Polygon
    return Polygon(squircle(CLIP[0]))


def _towers(spec, bottom=-1.7):
    g = None
    for x0, x1, top in spec:
        r = _P(_rect(x0, bottom, x1, top))
        g = r if g is None else g.union(r)
    return g.intersection(_clip())


def _letter(ch, h=0.95):
    from matplotlib.textpath import TextPath
    from matplotlib.font_manager import FontProperties
    from shapely.geometry import Polygon
    from shapely.affinity import scale as _sc2, translate as _tr2
    tp = TextPath((0, 0), ch, size=1, prop=FontProperties(family='DejaVu Sans', weight='bold'))
    g = None
    for pg in tp.to_polygons():
        p = Polygon(pg).buffer(0)
        g = p if g is None else g.symmetric_difference(p)
    x0, y0, x1, y1 = g.bounds
    k = h / (y1 - y0)
    g = _tr2(_sc2(g, k, k, origin=(0, 0)), -(x0 + x1) / 2 * k, -(y0 + y1) / 2 * k)
    return g


def _with_letter(c, ch, col):
    g = _letter(ch)
    _sc(c, g.buffer(0.045, join_style=1), 'c:#05060a')
    _sc(c, g, col)


def _fletter(ch, fname, h=1.2, italic_shear=0.0):
    from matplotlib.textpath import TextPath
    from matplotlib.font_manager import FontProperties
    from shapely.geometry import Polygon
    from shapely.affinity import scale as _sc2, translate as _tr2
    tp = TextPath((0, 0), ch, size=1, prop=FontProperties(fname=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fonts', fname)))
    g = None
    for pg in tp.to_polygons():
        p = Polygon(pg).buffer(0)
        g = p if g is None else g.symmetric_difference(p)
    x0, y0, x1, y1 = g.bounds
    k = h / (y1 - y0)
    return _tr2(_sc2(g, k, k, origin=(0, 0)), -(x0 + x1) / 2 * k, -(y0 + y1) / 2 * k)


def _big_letter(c, ch, fname, role, h=1.75):
    g = _fletter(ch, fname, h)
    c.geom_part(g, role, 0.3, 0.07)


def g_scene_cyber(c):
    _big_letter(c, 'C', 'chakra-petch.ttf', 'c:#c8ff3a')


def g_scene_brass(c):
    _big_letter(c, 'B', 'inter.ttf', 'c:#e6b25a')


def g_scene_holiday(c):
    _big_letter(c, 'H', 'christmas-display-600-italic.ttf', 'c:#e0415f')


SCENES = {
    'scene_cyber': ('#161b38', '#05060a'),
    'scene_brass': ('#1b1c25', '#0b0c10'),
    'scene_holiday': ('#241f3a', '#10211a'),
}


GLYPHS = {n[len('g_'):]: f for n, f in globals().items() if n.startswith('g_')}


def render(item, style, out_dir):
    gname, tone = ITEMS[item]
    st = STYLES[style]
    if gname in SCENES:
        import copy as _cp
        st = _cp.deepcopy(st)
        c1_, c2_ = SCENES[gname]
        st['tile'] = S(k='grad', c1=c1_, c2=c2_, emit=1) if st.get('flat') else S(k='grad', c1=c1_, c2=c2_, rough=0.5, paper=st.get('paper'))
        CLIP[0] = 1.22 / 0.92 if style == 's12' else 1.5
        st['scene_cols'] = [(c2_, 1.4), (c2_, 1.27), (c1_, 1.14)]
        if st['shape'] == 'none':
            st.update(shape='squircle', tdepth=0.18, tbev=0.05, gs=0.92)
        st['kstep'] = 0.5
    TI = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex', item + '.png')
    if style == 's12' and os.path.exists(TI):
        import copy as _cp2
        st = _cp2.deepcopy(st)
        st['tile'] = S(k='img', c1='T1', path=TI)
    reset_scene(st)
    cx = Ctx(st, tone)
    build_tile(cx)
    if st.get('real') and gname not in SCENES:
        import real
        real.build(gname, tone)
    else:
        GLYPHS[gname](cx)
        cx.flush()
    p = os.path.join(out_dir, f'{item}.png')
    bpy.context.scene.render.filepath = p
    bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    out, style = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    items = sys.argv[3:] or list(ITEMS)
    for it in items:
        print('render', style, it, flush=True)
        render(it, style, out)
    print('done')
