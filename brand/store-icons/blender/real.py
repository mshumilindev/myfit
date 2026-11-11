"""s11 - photoreal objects on a flat tile. Imported by gen.py (shares its helpers)."""
import math
import bpy
import bmesh
from mathutils import Vector, noise as mnoise
from shapely.geometry import Polygon

OBJS = []
TONE = [0]


def reg(ob):
    OBJS.append(ob)
    return ob


def smooth(ob):
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.shade_smooth()
    ob.select_set(False)


def pbr(color, metal=0.0, rough=0.4, coat=0.0, emit=0.0, trans=0.0, ior=1.45, bump=0.0, aniso=0.0, grad=None):
    from gen import resolve, srgb
    m = bpy.data.materials.new('p')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    col = srgb(resolve(color, TONE[0]))
    b.inputs['Base Color'].default_value = col
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    try:
        b.inputs['Coat Weight'].default_value = coat
        b.inputs['Coat Roughness'].default_value = 0.04
    except KeyError:
        pass
    if trans:
        b.inputs['Transmission Weight'].default_value = trans
        b.inputs['IOR'].default_value = ior
    if emit:
        b.inputs['Emission Color'].default_value = col
        b.inputs['Emission Strength'].default_value = emit
    if aniso:
        b.inputs['Anisotropic'].default_value = aniso
    if grad:  # (c_low, c_high, z0, z1) colour by object Z
        tc = nt.nodes.new('ShaderNodeTexCoord')
        sp = nt.nodes.new('ShaderNodeSeparateXYZ')
        nt.links.new(tc.outputs['Object'], sp.inputs[0])
        mp = nt.nodes.new('ShaderNodeMapRange')
        mp.inputs['From Min'].default_value = grad[2]
        mp.inputs['From Max'].default_value = grad[3]
        nt.links.new(sp.outputs['Z'], mp.inputs[0])
        rp = nt.nodes.new('ShaderNodeValToRGB')
        rp.color_ramp.elements[0].color = srgb(resolve(grad[0], TONE[0]))
        rp.color_ramp.elements[1].color = srgb(resolve(grad[1], TONE[0]))
        nt.links.new(mp.outputs[0], rp.inputs[0])
        nt.links.new(rp.outputs[0], b.inputs['Base Color'])
    if bump:
        tc = nt.nodes.new('ShaderNodeTexCoord')
        vo = nt.nodes.new('ShaderNodeTexVoronoi')
        vo.inputs['Scale'].default_value = 5.0
        nt.links.new(tc.outputs['Object'], vo.inputs['Vector'])
        bp = nt.nodes.new('ShaderNodeBump')
        bp.inputs['Strength'].default_value = bump
        bp.inputs['Distance'].default_value = 0.05
        nt.links.new(vo.outputs['Distance'], bp.inputs['Height'])
        nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    nt.links.new(b.outputs[0], out.inputs['Surface'])
    return m


def glass(color='#eaf6ff', ior=1.5, rough=0.0):
    from gen import srgb
    m = bpy.data.materials.new('g')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    g = nt.nodes.new('ShaderNodeBsdfGlass')
    g.inputs['Color'].default_value = srgb(color)
    g.inputs['IOR'].default_value = ior
    g.inputs['Roughness'].default_value = rough
    nt.links.new(g.outputs[0], out.inputs['Surface'])
    return m


def addmat(ob, m):
    ob.data.materials.append(m)
    return ob


def bevel(ob, w, seg=4):
    md = ob.modifiers.new('b', 'BEVEL')
    md.width = w
    md.segments = seg
    md.limit_method = 'ANGLE'
    md.angle_limit = math.radians(35)
    return ob


def sphere(loc, r, m, scale=(1, 1, 1), seg=48, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=r, location=loc, rotation=rot)
    ob = bpy.context.object
    ob.scale = scale
    smooth(ob)
    return reg(addmat(ob, m))


def cyl(loc, r, depth, m, axis='Y', bev=0.0, verts=64, rot=None):
    rr = {'Y': (math.radians(90), 0, 0), 'X': (0, math.radians(90), 0), 'Z': (0, 0, 0)}[axis]
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot or rr)
    ob = bpy.context.object
    if bev:
        bevel(ob, bev, 4)
    smooth(ob)
    return reg(addmat(ob, m))


def box(loc, size, m, bev=0.03, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    ob = bpy.context.object
    ob.scale = size
    bpy.ops.object.transform_apply(scale=True)
    bevel(ob, bev, 4)
    smooth(ob)
    return reg(addmat(ob, m))


def torus(loc, major, minor, m, rot=(math.radians(90), 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=96, minor_segments=24, location=loc, rotation=rot)
    ob = bpy.context.object
    smooth(ob)
    return reg(addmat(ob, m))


def tube(pts, r, m, cyclic=False, ends=True, res=10):
    cu = bpy.data.curves.new('t', 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = r
    cu.bevel_resolution = res
    cu.use_fill_caps = True
    sp = cu.splines.new('POLY')
    sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (p[0], p[1], p[2], 1)
    sp.use_cyclic_u = cyclic
    sp.use_smooth = True
    cu.materials.append(m)
    ob = bpy.data.objects.new('t', cu)
    bpy.context.scene.collection.objects.link(ob)
    reg(ob)
    if ends and not cyclic:
        for p in (pts[0], pts[-1]):
            sphere(p, r, m, seg=24)
    return ob


def lathe(profile, m, loc=(0, 0, 0), seg=72, scale=1.0):
    me = bpy.data.meshes.new('l')
    ob = bpy.data.objects.new('l', me)
    bpy.context.scene.collection.objects.link(ob)
    bm = bmesh.new()
    vs = [bm.verts.new((r * scale, 0, z * scale)) for r, z in profile]
    es = [bm.edges.new((vs[i], vs[i + 1])) for i in range(len(vs) - 1)]
    bmesh.ops.spin(bm, geom=vs + es, cent=(0, 0, 0), axis=(0, 0, 1), dvec=(0, 0, 0), angle=2 * math.pi, space=ob.matrix_world, steps=seg, use_merge=True, use_normal_flip=False, use_duplicate=False)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    ob.location = loc
    smooth(ob)
    return reg(addmat(ob, m))


def slab(pts, depth, m, yfront, bev=0.05, seg=6, scale=1.0):
    from gen import extrude_geom, finish
    pg = Polygon([(x * scale, z * scale) for x, z in pts])
    if not pg.is_valid:
        pg = pg.buffer(0)
    for ob in extrude_geom(pg, depth, m, yfront, bev, seg):
        reg(ob)


def chain3(pts2, y, r, m, joints=True):
    P = [(x, y, z) for x, z in pts2]
    tube(P, r, m)


# ------------------------------------------------------------------ objects
def o_dumbbell(c):
    steel = pbr('#e9ebf0', metal=1.0, rough=0.16)
    rubber = pbr('#1c1e24', rough=0.5, coat=0.1)
    cyl((0, -0.4, 0), 0.1, 1.55, steel, 'X')
    for sx in (-1, 1):
        cyl((sx * 0.22, -0.4, 0), 0.17, 0.12, steel, 'X', 0.02)
        cyl((sx * 0.62, -0.4, 0), 0.5, 0.5, rubber, 'X', 0.07, verts=6)
        cyl((sx * 0.9, -0.4, 0), 0.22, 0.1, steel, 'X', 0.025)
    return (0, -30, 0)


def o_peak(c):
    nr, nt_ = 40, 112
    me = bpy.data.meshes.new('mt')
    ob = bpy.data.objects.new('mt', me)
    bpy.context.scene.collection.objects.link(ob)
    bm = bmesh.new()
    rings = []
    HT = {}
    for ri in range(nr + 1):
        rho = ri / nr
        ring = []
        for ti in range(nt_ if ri else 1):
            th = 2 * math.pi * ti / nt_
            x, y = rho * 1.2 * math.cos(th), rho * 0.72 * math.sin(th)
            d1 = math.hypot((x + 0.15) / 1.0, y / 0.72)
            d2 = math.hypot((x - 0.66) / 0.6, (y + 0.05) / 0.5)
            h = 1.3 * max(0.0, 1 - d1) ** 1.1 + 0.62 * max(0.0, 1 - d2) ** 1.1
            h += 0.08 * mnoise.fractal((x * 2.4, y * 2.4, 3.0), 0.5, 2.0, 5) * min(1.0, h * 2.5)
            e = max(0.0, min(1.0, (1 - rho) / 0.3))
            h = max(h, 0.0) * (e * e * (3 - 2 * e)) if rho > 0 else h
            v_ = bm.verts.new((x, y, h - 0.75)); HT[v_] = h
            ring.append(v_)
        rings.append(ring)
    for ri in range(nr):
        for ti in range(nt_):
            t2 = (ti + 1) % nt_
            if ri == 0:
                bm.faces.new([rings[0][0], rings[1][ti], rings[1][t2]])
            else:
                bm.faces.new([rings[ri][ti], rings[ri + 1][ti], rings[ri + 1][t2], rings[ri][t2]])
    dead = [f for f in bm.faces if max(HT[v] for v in f.verts) < 0.012]
    bmesh.ops.delete(bm, geom=dead, context='FACES')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    smooth(ob)
    addmat(ob, pbr('#6c675f', rough=0.85, grad=('#5a564f', '#f7f9fc', -0.15, 0.4)))
    reg(ob)
    ob.location = (0, -0.7, 0)
    cyl((-0.15, -0.7, 0.66), 0.022, 0.62, pbr('#d9dce4', metal=1, rough=0.2), 'Z')
    box((0.02, -0.7, 0.86), (0.36, 0.012, 0.22), pbr('#e5484d', rough=0.6), 0.004)
    return (0, 0, 0)


def o_whistle(c):
    nick = pbr('#eef0f5', metal=1.0, rough=0.13)
    dark = pbr('#0e1015', rough=0.5)
    cyl((0.3, -0.4, -0.15), 0.52, 0.5, nick, 'Y', 0.06)
    cyl((0.3, -0.66, -0.15), 0.19, 0.04, dark, 'Y')
    box((-0.4, -0.4, 0.12), (1.3, 0.5, 0.4), nick, 0.1)
    box((-0.5, -0.66, 0.16), (0.6, 0.04, 0.1), dark, 0.02)
    torus((0.66, -0.4, 0.58), 0.17, 0.05, nick, rot=(math.radians(90), 0, 0))
    return (0, 0, 0)


def apple_profile():
    pts = []
    cen = (0.0, -0.1)
    for k in range(0, 61):
        t = math.radians(90 - 180 * k / 60)
        best = 0
        for cx in (-0.2, 0.2):
            ox, oy = cx - cen[0], -0.1 - cen[1]
            dx, dy = math.cos(t), math.sin(t)
            b = dx * (-ox) + dy * (-oy)
            disc = b * b - (ox * ox + oy * oy - 0.7 * 0.7)
            best = max(best, -b + math.sqrt(max(disc, 0)))
        best -= 0.1 * math.exp(-(((t - math.pi / 2)) / 0.24) ** 2)
        best -= 0.06 * math.exp(-(((t + math.pi / 2)) / 0.3) ** 2)
        pts.append((max(best * math.cos(t), 0.0), cen[1] + best * math.sin(t)))
    return pts


def o_apple(c):
    body = pbr('#d63a2a', rough=0.22, coat=1.0, grad=('#b3201a', '#e8553a', -0.7, 0.55))
    lathe(apple_profile(), body, (0, -0.55, 0.0), seg=96, scale=1.05)
    tube([(0.0, -0.55, 0.62), (0.03, -0.55, 0.78), (0.1, -0.55, 0.92)], 0.04, pbr('#5b3a22', rough=0.6), res=8)
    leaf = pbr('#4f9a3c', rough=0.35, coat=0.6)
    from gen import rounded_poly
    lp = [(0.38 * math.cos(2 * math.pi * k / 40), 0.15 * math.sin(2 * math.pi * k / 40)) for k in range(40)]
    ang = math.radians(24)
    lp = [(x * math.cos(ang) - z * math.sin(ang) + 0.34, x * math.sin(ang) + z * math.cos(ang) + 0.9) for x, z in lp]
    slab(lp, 0.05, leaf, -0.6, 0.02, 4)
    return (0, 0, 0)


def o_note(c):
    black = pbr('#14161b', rough=0.14, coat=1.0)
    chrome = pbr('#e9ebf0', metal=1.0, rough=0.14)
    for sx in (-0.55, 0.5):
        sphere((sx, -0.4, -0.6), 0.3, black, (1.0, 0.7, 0.78), rot=(0, math.radians(-18), 0))
        cyl((sx + 0.22, -0.4, 0.05), 0.065, 1.4, black, 'Z')
    box((0.195, -0.4, 0.68), (1.22, 0.16, 0.26), black, 0.075)
    return (0, 0, 0)


def o_heart(c):
    from gen import srgb
    pts = []
    for k in range(120):
        t = 2 * math.pi * k / 120
        pts.append((16 * math.sin(t) ** 3 / 17.0 * 0.95, (13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)) / 17.0 * 0.95 + 0.04))
    slab(pts, 0.55, pbr('#d92a3a', rough=0.14, coat=1.0), -0.55, 0.26, 12)
    w = pbr('#ffffff', rough=0.2, coat=1.0)
    line = [(-0.62, -0.04, -0.62), (-0.3, -0.04, -0.62), (-0.12, 0.3, -0.62), (0.14, -0.4, -0.62), (0.3, -0.04, -0.62), (0.62, -0.04, -0.62)]
    tube([(x, y, z) for z, y, x in [(p[1], p[2], p[0]) for p in line]], 0.065, w)
    return (0, 0, 0)


def o_moon(c):
    from gen import crescent, rot2, star4
    cr = rot2(crescent(1.0, 0.82, 0.5), -28)
    slab(cr, 0.4, pbr('#ece7da', rough=0.55, bump=0.5), -0.4, 0.17, 10)
    gold = pbr('#f2c15a', metal=1.0, rough=0.2)
    s1 = [(x + 0.45, z - 0.1) for x, z in star4(0.4, 0.11)]
    slab(s1, 0.14, gold, -0.34, 0.04, 5)
    return (0, 0, 0)


def o_activity(c):
    wood = pbr('#f4f1ea', rough=0.3, coat=0.7)
    r = 0.12
    P = lambda pts, y: tube([(x, y, z) for x, z in pts], r, wood)
    sphere((0.36, -0.4, 0.82), 0.23, wood)
    P([(0.1, 0.5), (0.32, 0.74)], -0.4)
    P([(0.1, 0.5), (-0.14, -0.1)], -0.4)
    tube([(0.3, -0.5, -0.42), (0.22, -0.5, -0.92)], r, wood)
    P([(-0.14, -0.1), (0.3, -0.42)], -0.45)
    P([(-0.14, -0.1), (-0.5, -0.4), (-0.92, -0.32)], -0.3)
    P([(0.07, 0.4), (0.52, 0.2), (0.8, 0.46)], -0.5)
    P([(0.07, 0.4), (-0.5, 0.34), (-0.84, 0.1)], -0.28)
    return (0, 0, 0)


def o_house(c):
    plaster = pbr('#f3eadb', rough=0.75)
    tiles = pbr('#b8452c', rough=0.55, coat=0.2)
    steel = pbr('#e9ebf0', metal=1.0, rough=0.16)
    rub = pbr('#1c1e24', rough=0.5)
    box((0, -0.5, -0.45), (1.7, 0.9, 1.1), plaster, 0.03)
    roof = [(-1.15, 0.1), (0.0, 0.9), (1.15, 0.1)]
    slab([(x, z + 0.05) for x, z in roof], 1.05, tiles, -1.05, 0.05, 4)
    cyl((0, -1.1, -0.5), 0.05, 1.3, steel, 'X')
    for sx in (-1, 1):
        cyl((sx * 0.4, -1.1, -0.5), 0.33, 0.16, rub, 'X', 0.025, verts=6)
        cyl((sx * 0.6, -1.1, -0.5), 0.22, 0.12, rub, 'X', 0.02, verts=6)
    return (0, 0, 0)


def o_target(c):
    red = pbr('#d63a2f', rough=0.4, coat=0.5)
    cream = pbr('#f4efe4', rough=0.5)
    cyl((0, -0.1, 0), 1.02, 0.2, pbr('#8a5a34', rough=0.6), 'Y', 0.04)
    for i, (r, m) in enumerate(((0.96, cream), (0.78, red), (0.6, cream), (0.42, red), (0.22, cream))):
        cyl((0, -0.22 - i * 0.012, 0), r, 0.02, m, 'Y')
    wood = pbr('#cda26a', rough=0.45)
    d = Vector((0.55, -0.45, 0.62)).normalized()
    p0 = Vector((0.0, -0.3, 0.0))
    p1 = p0 + d * 1.5
    tube([tuple(p0), tuple(p1)], 0.035, wood)
    for k in range(3):
        a = k * 2 * math.pi / 3
        q = p1 - d * 0.18
        side = Vector((math.cos(a), 0, math.sin(a))) * 0.1
        tube([tuple(q), tuple(q + side), tuple(q + side + d * 0.2)], 0.02, red, ends=False)
    return (0, 0, 0)


def o_book(c):
    cover = pbr('T1', rough=0.5, coat=0.35)
    pages = pbr('#f6f2e8', rough=0.8)
    gold = pbr('#f2c443', metal=0.0, rough=0.3, coat=0.4)
    box((0.0, -0.3, 0), (1.5, 0.55, 1.95), cover, 0.07)
    box((0.06, -0.3, 0), (1.34, 0.45, 1.84), pages, 0.02)
    box((0.0, -0.58, 0), (1.5, 0.08, 1.95), cover, 0.05)
    box((-0.72, -0.3, 0), (0.1, 0.6, 1.95), pbr('T0', rough=0.45, coat=0.3), 0.04)
    tri = [(-0.3, 0.45), (-0.3, -0.45), (0.5, 0.0)]
    slab(tri, 0.04, gold, -0.66, 0.015, 4)
    box((0.52, -0.67, 0.72), (0.13, 0.02, 0.5), pbr('#e9d9a8', rough=0.4), 0.005)
    return (0, 0, 0)


def o_sparkle(c):
    from gen import star4
    slab(star4(1.0, 0.26), 0.5, pbr('T1L', rough=0.1, coat=1.0, emit=0.25), -0.5, 0.2, 12)
    sphere((0, -0.52, 0), 0.12, pbr('#ffffff', emit=6.0))
    gold = pbr('#f2c15a', metal=1.0, rough=0.2)
    slab([(x + 0.72, z + 0.68) for x, z in star4(0.4, 0.11)], 0.16, gold, -0.34, 0.05, 6)
    slab([(x - 0.74, z - 0.66) for x, z in star4(0.3, 0.085)], 0.14, gold, -0.32, 0.045, 6)
    return (0, 0, 0)


def o_broadcast(c):
    w = pbr('#ffffff', rough=0.2, coat=1.0)
    sphere((0, -0.4, 0), 0.24, pbr('#ff4d4d', rough=0.2, coat=1.0, emit=1.2))
    for r in (0.62, 1.0):
        for a0, a1 in ((-42, 42), (138, 222)):
            P = [(r * math.cos(math.radians(a0 + (a1 - a0) * k / 16)), -0.4, r * math.sin(math.radians(a0 + (a1 - a0) * k / 16))) for k in range(17)]
            tube(P, 0.075, w)
    return (0, 0, 0)


def o_bell(c):
    brass = pbr('#e2b04a', metal=1.0, rough=0.2)
    prof = [(0.0, 0.88), (0.1, 0.86), (0.22, 0.78), (0.42, 0.64), (0.54, 0.4), (0.6, 0.0), (0.72, -0.32), (0.92, -0.52), (0.98, -0.56), (0.92, -0.6), (0.86, -0.56), (0.64, -0.3), (0.5, 0.0), (0.4, 0.3), (0.0, 0.4)]
    lathe(prof, brass, (0, -0.55, 0.05), seg=96)
    torus((0, -0.55, 0.98), 0.12, 0.04, brass, rot=(math.radians(90), 0, 0))
    sphere((0, -0.55, -0.55), 0.17, brass)
    return (0, 0, 0)


def o_notes(c):
    from gen import rot2
    paper = pbr('#faf9f5', rough=0.85)
    paper2 = pbr('#e9e6dc', rough=0.85)
    ink = pbr('T0D', rough=0.4)
    page = [(-0.72, -0.98), (0.72, -0.98), (0.72, 0.5), (0.22, 0.98), (-0.72, 0.98)]
    slab(rot2(page, 5), 0.07, paper2, -0.25, 0.015, 3, 1.0)
    slab(page, 0.08, paper, -0.4, 0.02, 3)
    from gen import pill, tr
    for i, w in enumerate((1.0, 1.0, 0.62)):
        slab(tr(pill(w, 0.14), -0.46 + w / 2, 0.1 - i * 0.36), 0.025, ink, -0.43, 0.01, 3)
    return (0, 0, 0)


def o_team(c):
    prof = [(0.0, -0.9), (0.52, -0.9), (0.54, -0.82), (0.42, -0.7), (0.3, -0.3), (0.2, 0.05), (0.3, 0.1), (0.3, 0.18), (0.0, 0.18)]
    white = pbr('#f6f7fa', rough=0.22, coat=1.0)
    grey = pbr('#cdd6de', rough=0.22, coat=1.0)
    for sx, s, m in ((-0.78, 0.72, grey), (0.78, 0.72, grey), (0.0, 1.0, white)):
        lathe(prof, m, (sx, -0.6 if s == 1 else -0.35, 0.22 + (0 if s == 1 else -0.14)), seg=72, scale=s)
        sphere((sx, -0.6 if s == 1 else -0.35, 0.22 + (0.42 if s == 1 else 0.3) + (0 if s == 1 else -0.14)), 0.3 * s, m)
    return (0, 0, 0)


def o_lens(c):
    brass = pbr('#e2b04a', metal=1.0, rough=0.22)
    torus((0, -0.45, 0), 0.9, 0.14, brass)
    torus((0, -0.45, 0), 0.72, 0.05, pbr('#8a6a2a', metal=1.0, rough=0.35))
    sphere((0, -0.45, 0), 0.72, glass('#f2fbff', 1.5), (1, 0.42, 1))
    return (0, 0, 0)


def o_cyber(c):
    from gen import rounded_poly
    pink = pbr('#ff4fb0', emit=7.0)
    cyan = pbr('#4de1ff', emit=7.0)
    h, k = 0.98, 0.42
    cut = [(-h + k, h), (h, h), (h, -h + k), (h - k, -h), (-h, -h), (-h, h - k)]
    slab(cut, 0.22, pbr('#14172a', metal=0.6, rough=0.3, coat=0.6), -0.22, 0.05, 4)
    P = [(x, -0.3, z) for x, z in rounded_poly(cut, 0.05, 0.03, 3)]
    tube(P, 0.06, pink, cyclic=True)
    tube([(-0.15, -0.3, 0.38), (0.2, -0.3, 0.0), (-0.15, -0.3, -0.38)], 0.075, cyan)
    return (0, 0, 0)


def o_gift(c):
    red = pbr('#c92f33', rough=0.32, coat=0.6)
    sat = pbr('#f6f1e6', rough=0.3, coat=0.4)
    box((0, -0.55, -0.4), (1.5, 1.0, 1.0), red, 0.04)
    box((0, -0.55, 0.22), (1.74, 1.14, 0.4), red, 0.05)
    box((0, -0.55, -0.18), (0.3, 1.03, 1.45), sat, 0.015)
    box((0.0, -0.55, 0.22), (0.3, 1.17, 0.42), sat, 0.015)
    for s in (-1, 1):
        P = [(s * (0.27 + 0.27 * math.cos(2 * math.pi * k / 28)), -0.55 - 0.12 * math.sin(2 * math.pi * k / 28), 0.64 + 0.21 * math.sin(2 * math.pi * k / 28)) for k in range(28)]
        tube(P, 0.06, sat, cyclic=True)
    sphere((0, -0.55, 0.5), 0.15, sat)
    return (0, 0, 0)


def o_trophy(c):
    gold = pbr('#e6b83c', metal=1.0, rough=0.2)
    wood = pbr('#5a3a22', rough=0.45, coat=0.3)
    prof = [(0.0, -0.78), (0.46, -0.78), (0.52, -0.74), (0.52, -0.66), (0.4, -0.6), (0.15, -0.55), (0.11, -0.42), (0.11, -0.22), (0.2, -0.12), (0.44, 0.0), (0.58, 0.28), (0.64, 0.66), (0.62, 0.88), (0.58, 0.9), (0.52, 0.86), (0.5, 0.62), (0.38, 0.34), (0.0, 0.2)]
    lathe(prof, gold, (0, -0.55, 0.0), seg=96)
    for sx in (-1, 1):
        torus((sx * 0.7, -0.55, 0.5), 0.26, 0.06, gold)
    box((0, -0.55, -0.98), (1.2, 0.6, 0.2), wood, 0.04)
    box((0, -0.87, -0.98), (0.5, 0.02, 0.09), gold, 0.005)
    return (0, 0, 0)


def o_banana(c):
    N, M = 72, 44
    me = bpy.data.meshes.new('ban')
    ob = bpy.data.objects.new('ban', me)
    bpy.context.scene.collection.objects.link(ob)
    bm = bmesh.new()
    R, cz, A0, A1 = 0.95, 0.36, 192.0, 346.0
    rings = []
    for i in range(N + 1):
        t = i / N
        ph = math.radians(A0 + (A1 - A0) * t)
        rr = 0.27 * (math.sin(math.pi * t) ** 0.55) + 0.025
        cxp, czp = R * math.cos(ph), cz + R * math.sin(ph)
        rx, rz = math.cos(ph), math.sin(ph)
        ring = []
        for j in range(M):
            th = 2 * math.pi * j / M
            q = rr * (1.0 + 0.07 * math.cos(5 * th))
            a, b = q * math.cos(th), q * math.sin(th)
            ring.append(bm.verts.new((cxp + a * rx, b, czp + a * rz)))
        rings.append(ring)
    for i in range(N):
        for j in range(M):
            j2 = (j + 1) % M
            bm.faces.new([rings[i][j], rings[i + 1][j], rings[i + 1][j2], rings[i][j2]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    smooth(ob)
    addmat(ob, pbr('#f3cb2c', rough=0.42, coat=0.25, grad=('#d9a81c', '#f8dc4e', -0.7, 0.8)))
    reg(ob)
    ob.location = (0, -0.55, 0)
    ph = math.radians(A1)
    ex, ez = R * math.cos(ph), cz + R * math.sin(ph)
    tx, tz = -math.sin(ph), math.cos(ph)
    stem = pbr('#5c5424', rough=0.7)
    tube([(ex, -0.55, ez), (ex + tx * 0.16, -0.55, ez + tz * 0.16), (ex + tx * 0.26, -0.55, ez + tz * 0.26)], 0.065, stem, res=8)
    ph0 = math.radians(A0)
    sx0, sz0 = R * math.cos(ph0), cz + R * math.sin(ph0)
    sphere((sx0, -0.55, sz0), 0.05, pbr('#2a2012', rough=0.6), seg=24)
    return (0, -32, 0)


def o_stopwatch(c):
    chrome = pbr('#e9ebf0', metal=1.0, rough=0.16)
    white = pbr('#fbfbfd', rough=0.55)
    dark = pbr('#1b1e26', rough=0.5)
    red = pbr('#e5392f', rough=0.35, coat=0.4)
    yb = -0.55
    cz = -0.08
    cyl((0, yb, cz), 0.86, 0.4, chrome, 'Y', 0.06)
    cyl((0, yb - 0.2, cz), 0.74, 0.04, white, 'Y')
    for k in range(12):
        a = math.radians(30 * k)
        L = 0.12 if k % 3 == 0 else 0.07
        r0 = 0.64 - L / 2
        box((r0 * math.sin(a), yb - 0.225, cz + r0 * math.cos(a)), (0.035, 0.01, L), dark, 0.004, rot=(0, a, 0))
    def hand(ang, L, w, m, y):
        a = math.radians(ang)
        box((0.5 * L * math.sin(a), y, cz + 0.5 * L * math.cos(a)), (w, 0.012, L), m, 0.004, rot=(0, a, 0))
    hand(305, 0.34, 0.06, dark, yb - 0.235)
    hand(60, 0.52, 0.045, dark, yb - 0.245)
    hand(165, 0.6, 0.022, red, yb - 0.255)
    cyl((0, yb - 0.26, cz), 0.06, 0.03, red, 'Y')
    cyl((0, yb, cz + 0.9), 0.1, 0.22, chrome, 'Z', 0.015)
    cyl((0, yb, cz + 1.04), 0.17, 0.12, chrome, 'Z', 0.03)
    cyl((0.66, yb, cz + 0.68), 0.085, 0.2, chrome, 'Z', 0.015, rot=(0, math.radians(45), 0))
    return (0, 0, 0)


def o_brain(c):
    nz = mnoise
    me = bpy.data.meshes.new('brain')
    ob = bpy.data.objects.new('brain', me)
    bpy.context.scene.collection.objects.link(ob)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=170, v_segments=100, radius=1.0)
    for v in bm.verts:
        n = v.co.normalized()
        p = Vector((n.x * 1.0, n.y * 0.74, n.z * 0.78))
        if p.z < -0.3:
            p.z = -0.3 + (p.z + 0.3) * 0.55
        q = Vector((p.x * 2.1 + 3.0, p.y * 2.1, p.z * 2.1))
        g1 = max(0.0, 1.0 - abs(nz.noise(q)) * 5.0)
        q2 = q * 2.3
        g2 = max(0.0, 1.0 - abs(nz.noise(q2)) * 6.0)
        d = 0.075 * g1 + 0.035 * g2
        v.co = p * (1.0 - d)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    smooth(ob)
    addmat(ob, pbr('#ec9fab', rough=0.5, coat=0.25, grad=('#c97889', '#f6b9c2', -0.8, 0.9)))
    reg(ob)
    ob.location = (-0.05, -0.55, 0.12)
    cer = bpy.data.meshes.new('cer')
    co = bpy.data.objects.new('cer', cer)
    bpy.context.scene.collection.objects.link(co)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=96, v_segments=56, radius=1.0)
    for v in bm.verts:
        n = v.co.normalized()
        p = Vector((n.x * 0.42, n.y * 0.34, n.z * 0.3))
        q = Vector((p.x * 7.0, p.y * 7.0, p.z * 7.0 + 9.0))
        gg = max(0.0, 1.0 - abs(nz.noise(q * 1.0)) * 3.0)
        v.co = p * (1.0 - 0.06 * gg)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(cer)
    bm.free()
    smooth(co)
    addmat(co, pbr('#d68996', rough=0.5, coat=0.2))
    reg(co)
    co.location = (0.4, -0.45, -0.5)
    cyl((0.1, -0.5, -0.62), 0.12, 0.4, pbr('#e8b3b3', rough=0.55), 'Z', 0.02)
    return (0, 0, 0)


OBJECTS = {'dumbbell': o_dumbbell, 'peak': o_peak, 'whistle': o_whistle, 'apple': o_apple, 'note': o_note, 'heart': o_heart,
           'moon': o_moon, 'activity': o_activity, 'house': o_house, 'target': o_target, 'book': o_book, 'sparkle': o_sparkle,
           'broadcast': o_broadcast, 'bell': o_bell, 'notes': o_notes, 'team': o_team, 'lens': o_lens, 'cyber': o_cyber, 'gift': o_gift, 'trophy': o_trophy, 'banana': o_banana, 'stopwatch': o_stopwatch, 'brain': o_brain}


def build(gname, tone):
    TONE[0] = tone
    del OBJS[:]
    pose = OBJECTS[gname](None)
    emp = bpy.data.objects.new('pose', None)
    bpy.context.scene.collection.objects.link(emp)
    for ob in OBJS:
        ob.parent = emp
    emp.rotation_euler = (math.radians(pose[0]), math.radians(pose[1]), math.radians(pose[2]))
    emp.scale = (0.92, 0.92, 0.92)
