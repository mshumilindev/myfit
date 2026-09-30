"""P09 · Exercises & Learn — 1:1 translation of views/ExerciseLibraryView.tsx + components/ExerciseGallery.tsx
(Library / My exercises, filters sheet, CustomEditor, delete confirm), views/ExerciseDetailView.tsx,
views/EquipmentDetailView.tsx, components/{EquipmentBoard, EquipmentPickerSheet, BandLibraryCard, CardioMachineList}.tsx
and the Learn sub-app (LearnApp.tsx → learn/App.tsx, learn/catalog.ts, learn/i18n.ts). Strings = en.ts / learn i18n.
Sizes/weights from styles.css (.exl-*, .exd-*, .eqd-*, .eq-*, .band-*), learn/learn.css. See fidelity/P09.md."""
from kit import *
import kit as _k
import re as _re, os as _os, json as _json, glob as _glob

for _f in _glob.glob(_os.path.join(OUT, 'P09-*.dc.html')):
    _os.remove(_f)

GYM = 'Iron Temple'
SRC = '/mnt/user-data/uploads/training/gym-tracker/client/src'
_MMAP = _json.load(open(_os.path.join(ROOT, 'musclemap.json')))
GV, GR = _MMAP['GROUP_VIEW'], _MMAP['GROUP_REGION']
MNAME = {'chest': 'Chest', 'back': 'Back', 'shoulders': 'Shoulders', 'biceps': 'Biceps', 'triceps': 'Triceps', 'forearms': 'Forearms', 'quads': 'Quads',
         'hamstrings': 'Hamstrings', 'glutes': 'Glutes', 'calves': 'Calves', 'core': 'Core', 'lats': 'Lats', 'traps': 'Traps', 'lower_back': 'Lower back',
         'adductors': 'Adductors', 'abductors': 'Abductors', 'neck': 'Neck', 'fullbody': 'Full body'}
EQN = {'barbell': 'Barbell', 'dumbbell': 'Dumbbell', 'cable': 'Cable', 'machine': 'Machine', 'body': 'Bodyweight', 'kettlebell': 'Kettlebell', 'bands': 'Bands',
       'medicineBall': 'Medicine ball', 'exerciseBall': 'Exercise ball', 'ezBar': 'EZ bar', 'foamRoll': 'Foam roller', 'suspension': 'Suspension (TRX)', 'other': 'Other'}
EQI = {'barbell': 'weight', 'dumbbell': 'dumbbell', 'cable': 'swap', 'machine': 'building', 'body': 'body', 'kettlebell': 'weight', 'bands': 'wave',
       'medicineBall': 'plates', 'exerciseBall': 'plates', 'ezBar': 'weight', 'foamRoll': 'rotate', 'suspension': 'link', 'other': 'more'}
RICH = {e['name'].lower(): e for e in _json.load(open(SRC + '/data/exercises.rich.json'))}
INSTR = _json.load(open(SRC + '/data/exercises.instructions.json'))
_cat = open(SRC + '/data/equipmentCatalog.ts').read()
EQC = {i: (n, c, [x.strip(" '") for x in m.split(',') if x.strip()]) for i, n, c, m in
       _re.findall(r"id: '([^']+)',\s*name: '([^']+)',\s*category: '([a-zA-Z]+)',\s*cls: '[^']+',\s*muscles: \[([^\]]*)\]", _cat)}
MISSING = set()


def absb(inner, css):
    return f'<div style="position: absolute; {css}">{inner}</div>'


def rel(inner, *over, style=''):
    return f'<div style="position: relative; {style}">{inner}{"".join(over)}</div>'


def scrim():
    return '<div class="scrim"></div>'


def ph(*c, h=844, overlay='', mood='art', tabs='overview'):
    return phone(*c, tabs=tabs, h=h, overlay=overlay, mood=mood)


def ovback():
    return row(btn('Overview', 'txt', 'back', style='padding: 0; height: 32px'), style='margin: -4px 0 -8px')


def mchip(m, pri=True):
    """components/Muscle MuscleChip — graphite chip with the muscle's own silhouette mark + label."""
    fig = bodymap(GV[m], (m,) if m != 'fullbody' else (), region=GR[m], h=16, hl=ACCENT['brass'] if pri else ACCENT['neutral'], full=(m == 'fullbody'))
    return tag(row(fig, MNAME[m], gap=4), 'brass' if pri else 'neutral')


def eq_pic(eid, w='100%', h=80, r=10):
    """Equipment photo as the app shows it (EquipmentItem.image.thumbUrl → /equipment/<id>.jpg)."""
    k = f'equipment/{eid}.jpg'
    if _os.path.exists(_os.path.join(OUT, 'assets', k)):
        return img(k, w, h, r, alt=EQC.get(eid, ('',))[0])
    MISSING.add('public/' + k)
    return photo(w, h, r, '')


def xpic(name, w, h, r=8, i=0):
    k = exercise_img(name, i)
    if not k:
        MISSING.add(f'public/exercise-img/{name.replace(" ", "_")}/{i}.jpg')
    return exercise_pic(name, w, h, r, i)


# ============================================================== Exercise gallery (ExerciseGallery)
KICK = {'member': 'Training', 'trainer': 'Trainer', 'admin': 'Admin'}
PAGE1 = ['Ab Crunch Machine', 'Ab Roller', 'Adductor', 'Alternate Hammer Curl', 'Arnold Dumbbell Press', 'Band Assisted Pull-Up',
         'Barbell Bench Press - Medium Grip', 'Barbell Curl', 'Barbell Deadlift', 'Barbell Full Squat', 'Barbell Glute Bridge', 'Barbell Incline Bench Press - Medium Grip']
CHEST_P = ['Barbell Bench Press - Medium Grip', 'Barbell Incline Bench Press - Medium Grip', 'Butterfly', 'Cable Crossover', 'Dumbbell Bench Press',
           'Incline Dumbbell Press', 'Leverage Chest Press', 'Pushups', 'Smith Machine Bench Press']
CHEST_S = ['Close-Grip Barbell Bench Press', 'Dips - Triceps Version']


def rinfo(n):
    e = RICH[n.lower()]
    mus = ' · '.join(MNAME[m] for m in e['primaryMuscles'] + e['secondaryMuscles'] if m in MNAME)
    return e, mus


def exrow(n):
    """.exl-mrow (phone): 72×60 photo · name 15 · muscles 11 · mechanic / force / equipment badges (9 px)."""
    e, mus = rinfo(n)
    b = [tag(e['mechanic'].title(), 'neutral')] if e.get('mechanic') else []
    if e.get('force'):
        b.append(tag(e['force'].title(), 'neutral'))
    b.append(tag(EQN[e['equipment']], 'neutral', EQI[e['equipment']]))
    return card(row(xpic(n, 72, 60, 8), col(txt(n, 't-b', 'font-weight: 600' if False else ''), txt(mus, 't-m'), row(*b, gap=4, wrap=True), gap=3, style='flex: 1; min-width: 0'),
                    gap=12, align='flex-start'), style='padding: 8px 10px 8px 8px', gap=0)


def pager(cur=1, pages=(1, 2, 3, '…', 73)):
    items = [ibtn('back', 'Previous', 'fill', sm=True)] + [btn(str(p), 'pri' if p == cur else 'sec', sm=True, style='min-width: 34px; padding: 0 8px') if p != '…' else span('…', 'c-dim') for p in pages] + [ibtn('chev', 'Next', 'fill', sm=True)]
    return row(*items, gap=6, justify='center')


def lib_top(role):
    """programs-top: kicker + 26 px title + ‹ Overview."""
    return col(lbl(KICK[role]), txt('Exercises', 't-h1'), ovback(), gap=2)


def gal_head(role, tab='library', mine_n=3):
    can = role != 'member'
    title = 'My exercises' if tab == 'mine' else 'Exercises'
    cov = f'{mine_n} custom exercises' if tab == 'mine' else '873 in the library · 812 with instructions & photos'
    return [row(col(txt(title, 't-h2'), txt(cov, 't-m'), gap=2, style='flex: 1; min-width: 0'), btn('New exercise', 'pri', 'plus', sm=True) if can else '', gap=10),
            seg(['Library', f'My exercises <span class="c-brass">{mine_n}</span>' if mine_n else 'My exercises'], 0 if tab == 'library' else 1)]


def searchrow(active=0, q=''):
    return row(f'<div style="flex: 1">{search("Search exercises", q)}</div>', ibtn('filter', 'Filters', 'pri' if active else 'fill'), gap=8)


def library(role='member', rows=PAGE1, active=(), divider=None, rows2=(), mine_n=3, q='', pages=(1, 2, 3, '…', 73), n=None):
    chips_ = row(*[chip(a + ' ×', True) for a in active], gap=6, wrap=True) if active else ''
    extra = [txt(divider, 't-l', 'padding: 6px 2px 0'), *[exrow(r) for r in rows2]] if divider else []
    return [lib_top(role), *gal_head(role, 'library', mine_n), searchrow(len(active), q), chips_, col(*[exrow(r) for r in rows[:n]], gap=8), *extra, pager(pages=pages) if pages else '']


def mine_rows(can=True):
    def mr(n, mus, eq=None, catalog=True):
        acts = row(ibtn('history', 'Open history', 'fill', sm=True), ibtn('edit', 'Edit', 'fill', sm=True), ibtn('trash', 'Remove', 'fill', sm=True) if catalog else '', gap=6) if can else ''
        body = col(txt(n, 't-b'), txt(mus, 't-m'), row(tag(EQN[eq], 'neutral', EQI[eq])) if eq else '', gap=3, style='flex: 1; min-width: 0')
        return card(row(body, acts, gap=10), style='padding: 10px 10px 10px 14px', gap=0)
    return col(mr('Cable Y-raise', 'Shoulders · Traps', 'cable'), mr('TRX row', 'Back · Biceps', 'suspension'), mr('Landmine press', 'no classification', None, False), gap=8)


def mine_screen(role='trainer', empty_=False):
    can = role != 'member'
    body = txt('No custom exercises yet. Create your own — TRX, cable variations, anything.', 't-s', 'padding: 8px 2px') if empty_ else mine_rows(can)
    return [lib_top(role), *gal_head(role, 'mine', 0 if empty_ else 3), searchrow(), body]


MUS = ['quads', 'adductors', 'hamstrings', 'glutes', 'abductors', 'calves', 'chest', 'back', 'lats', 'traps', 'lower_back', 'shoulders', 'biceps', 'triceps', 'core', 'forearms', 'neck', 'fullbody']
CAT = ['Strength', 'Stretching', 'Plyometrics', 'Strongman', 'Powerlifting', 'Cardio', 'Olympic']
EQ = list(EQN.values())


def cg(title, items, on=()):
    return col(lbl(title), row(*[chip(x, x in on) for x in items], gap=6, wrap=True), gap=8)


def filter_groups(on=('Chest',)):
    return [cg('Muscle groups', [MNAME[m] for m in MUS], on), cg('Category', CAT, on), cg('Mechanic · Force', ['Compound', 'Isolation', 'Push', 'Pull', 'Static'], on),
            cg('Level', ['Beginner', 'Intermediate', 'Expert'], on), cg('Equipment', EQ, on)]


# ============================================================== Exercise detail (ExerciseDetailView)
BENCH = 'Barbell Bench Press - Medium Grip'


def detail_media(n=BENCH, h=240, none=False):
    """.exd-media.phone 240 px, full-bleed, round back button over it."""
    m = card(span(ico('dumbbell', 46), 'c-dim'), pad=False, style=f'height: {h}px; align-items: center; justify-content: center; border-radius: 0') if none else xpic(n, '100%', h, 0)
    return rel(m, absb(ibtn('back', 'Back', 'fill', sm=True), 'left: 12px; top: 12px'), style='margin: -12px -16px 0')


def badges_row(e):
    b = [tag(e['category'].title(), 'brass')]
    b += [tag(e[k].title(), 'neutral') for k in ('mechanic', 'force', 'level') if e.get(k)]
    b.append(tag(EQN[e['equipment']], 'neutral', EQI[e['equipment']]))
    return row(*b, gap=6, wrap=True)


def muscles_sec(pri=('chest',), sec=('shoulders', 'triceps'), subs=(('Lower chest', True), ('Upper chest', True), ('Front delt', False)), fig_h=150):
    """exd-muscles-row: MuscleBodyFigure (auto view, brass primary / grey secondary) beside the badge columns + legend."""
    view = GV[pri[0]] if pri else 'front'
    fig = bodymap(view, pri, sec, h=fig_h)
    chipsc = col(row(*[tag(MNAME[m], 'brass') for m in pri], gap=6, wrap=True),
                 row(*[tag(s, 'brass' if p else 'neutral') for s, p in subs], gap=6, wrap=True) if subs else '',
                 row(*[tag(MNAME[m], 'neutral') for m in sec], gap=6, wrap=True) if sec else '',
                 txt('brass = primary · grey = secondary', 't-m'), gap=8, style='flex: 1; min-width: 0')
    return col(lbl('Muscles worked'), row(f'<div style="width: 70px; flex: none">{fig}</div>', chipsc, gap=16, align='center'), gap=10)


def instructions(steps):
    return col(lbl('Instructions'), *[row(tag(str(i + 1), 'brass'), txt(s, 't-s', 'flex: 1'), gap=10, align='flex-start') for i, s in enumerate(steps)], gap=10)


def form_photos(n=BENCH, h=116):
    return col(lbl('Form photos · public domain'),
               grid(*[rel(xpic(n, '100%', h, 10, i), absb(txt(t, 't-m'), 'left: 8px; bottom: 6px')) for i, t in ((0, 'Start'), (1, 'End'))], cols=2, gap=8), gap=10)


def history_sec(rich=True, avail=True, desk=False):
    tl = [('100', 'Record kg', True), ('117', 'Est 1RM', False), ('24', 'Sessions', False), ('100', 'Last top', False)] if rich else [('—', 'Record kg', True), ('0', 'Sessions', False)]
    tiles_ = grid(*[card(txt(v, 't-num num c-ok' if ok else 't-num num'), txt(l, 't-l'), gap=4, style='padding: 12px 14px') for v, l, ok in tl], cols=4 if desk and rich else 2, gap=8)
    av = row(span(ico('check', 14), 'c-ok'), txt('Available at your gym — Barbell in inventory', 't-m c-ok'), gap=6) if avail else ''
    return col(lbl('From your history'), tiles_, av, gap=10)


def swap(n, pct, avail, tone):
    ic = {'ok': 'check', 'bad': 'warn', 'neutral': 'body'}[tone]
    e, _ = rinfo(n)
    chips_ = row(mchip(e['primaryMuscles'][0]), *[mchip(m, False) for m in e['secondaryMuscles'][:2]], gap=6)
    return card(row(txt(n, 't-s', 'flex: 1; min-width: 0'), txt(f'{pct}% match', 't-m c-brass'), gap=8), bar(pct, 'brass', 5), chips_,
                row(span(ico(ic, 14), {'ok': 'c-ok', 'bad': 'c-bad', 'neutral': 'c-dim'}[tone]), txt(avail, 't-m'), gap=6), gap=8, style='padding: 12px 14px')


def alternatives():
    return col(lbl('Alternatives'), swap('Dumbbell Bench Press', 92, f'Available at {GYM}', 'ok'), swap('Pushups', 84, 'Bodyweight — anywhere', 'neutral'),
               swap('Smith Machine Bench Press', 81, 'Needs Machine — not at your gym', 'bad'), swap('Cable Crossover', 64, f'Available at {GYM}', 'ok'), gap=8)


def add_btn():
    return btn("Add to today's session", 'pri', 'plus', full=True, style='height: 52px')


def detail_rich(night=False):
    e = RICH[BENCH.lower()]
    return [sleephero() if night else '', detail_media(), col(txt(BENCH, 't-h1'), badges_row(e), gap=10), muscles_sec(),
            instructions(INSTR['Barbell_Bench_Press_-_Medium_Grip']), form_photos(), history_sec(), alternatives(), add_btn()]


# ============================================================== Equipment detail (EquipmentDetailView)
EXS = [('Leg Press', 'quads'), ('Hack Squat', 'quads'), ('Leg Extensions', 'quads'), ('Barbell Full Squat', 'quads'), ('Bodyweight Squat', 'quads'),
       ('Barbell Glute Bridge', 'glutes'), ('Butt Lift Bridge', 'glutes'), ('Seated Leg Curl', 'hamstrings')]
ALTS = [('m-hack-squat', True), ('m-leg-extension', True), ('m-leg-curl-seated', False), ('m-leg-curl-lying', True), ('m-hip-abductor', False), ('m-back-extension', True)]


def eq_detail(eid='m-leg-press', here=True, gym=True):
    name, cat, mus = EQC[eid]
    head = row(ibtn('back', 'Back', 'fill', sm=True), col(lbl('Machines'), txt(name, 't-h2'), gap=2, style='flex: 1; min-width: 0'), gap=12)
    gb = (btn('In this gym', 'sec', 'check', full=True) if here else btn('Add to this gym', 'pri', 'plus', full=True)) if gym else ''
    musc = col(lbl('Muscles worked'), txt('Primary', 't-l c-brass'), row(*[mchip(m) for m in mus], gap=6, wrap=True),
               txt('Secondary', 't-l c-brass'), row(mchip('calves', False), mchip('lower_back', False), gap=6, wrap=True), gap=8)
    goal = card(row(span(ico('target', 16), 'c-brass'), txt('Hits Quads + Glutes — on your grow list this block', 't-s'), gap=8), tone='glass', style='padding: 10px 14px')
    exs = col(row(lbl('Exercises you can do on it'), txt('8', 't-l c-brass'), gap=8), txt('From the exercise database', 't-m'),
              lst(*[li(n, None, dot('brass'), span(MNAME[m], 't-m'), chev=True, style='min-height: 44px') for n, m in EXS]),
              btn('Log a set on this', 'pri', 'plus', full=True), gap=8)
    models = col(lbl('Common models'), *[card(row(span(ico('gear', 14), 'c-dim'), txt(b, 't-s', 'font-weight: 600' if False else ''), txt(n, 't-s c-dim'), gap=8), style='padding: 9px 12px', gap=0)
                                         for b, n in [('Cybex', 'Leg Press'), ('Hammer Strength', 'Linear Leg Press'), ('Life Fitness', 'Signature Leg Press')]], gap=6)
    aka = col(lbl('Also known as'), row(tag('leg press', 'neutral'), tag('45 degree leg press', 'neutral'), gap=6, wrap=True), gap=8)
    alts = col(lbl('Trains the same muscles'), grid(*[col(eq_pic(a, '100%', 72, 10), txt(EQC[a][0], 't-m'), (tag('here', 'ok', 'check') if h_ else txt('not here', 't-m')) if gym else '', gap=4)
                                                     for a, h_ in ALTS], cols=3, gap=10), gap=8)
    hero = eq_pic(eid, '100%', 214, 16)
    return [head, hero, txt('Heavy lower-body pressing with your back supported.', 't-s'), gb, musc, goal, '<div class="hl"></div>', exs, models, aka, alts]


# ============================================================== Inventory (EquipmentBoard) + band library
def eq_tile(eid, on, toggle_=True, mus=True):
    n, c, ms = EQC[eid]
    thumb = rel(eq_pic(eid, '100%', 74, 10), absb(ibtn('check' if on else 'plus', 'In this gym' if on else 'Add', 'pri' if on else 'fill', sm=True), 'right: 4px; top: 4px') if toggle_ else '')
    return col(thumb, txt(n, 't-m c-brass' if on else 't-m'), row(*[mchip(m) for m in ms[:2] if m in MNAME], gap=4, wrap=True) if mus else '', gap=5)


def cat_box(n, c, open_=False, body=''):
    head = row(span(ico('down' if open_ else 'chev', 14), 'c-dim'), txt(n, 't-s', 'flex: 1; font-weight: 600' if False else 'flex: 1'), txt(c, 't-m c-brass' if open_ else 't-m'), gap=10, style='min-height: 40px')
    return card(head, body, gap=10, style='padding: 2px 12px 8px' if open_ else 'padding: 2px 12px')


CATS = [('Barbells', '3/27'), ('Dumbbells', '1/8'), ('Kettlebells', '6'), ('Plates', '2/8'), ('Racks & stands', '2/10'), ('Benches', '3/13'), ('Machines', '9/53'),
        ('Plate-loaded', '2/30'), ('Cable', '1/7'), ('Cardio', '3/28'), ('Bands', '1/8'), ('Bodyweight & suspension', '19'), ('Conditioning & functional', '55'),
        ('Aquatic', '11'), ('Recovery & mobility', '38'), ('Accessories', '91'), ('Assessment', '7')]
MACH = [('smith-machine', True), ('bench-reverse-hyper', False), ('m-chest-press', True), ('m-pec-deck', True), ('m-shoulder-press', False), ('m-lateral-raise', False)]


def inv_head(n=24):
    return row(row(ico('scale', 16), txt('Inventory', 't-h3'), gap=8), sp(), tag(str(n), 'brass') if n else '', gap=8)


def inv_search(q='', fil=0):
    return row(f'<div style="flex: 1">{field(value=q, ph="Search equipment", icon="search", trail=ibtn("x", "Close", sm=True) if q else "")}</div>',
               rel(ibtn('filter', 'Filter by muscle', 'pri' if fil else 'fill'), absb(tag(str(fil), 'brass'), 'right: -4px; top: -4px') if fil else ''), gap=8)


def eq_board(mode='collapsed', n=24):
    out = [inv_head(n), txt('Inventory is what you ticked on each gym — nobody audits it. A gym with no inventory set is never flagged as missing anything.', 't-m')]
    if mode == 'filter':
        out.append(inv_search(fil=3))
        fm = ['chest', 'back', 'lats', 'traps', 'shoulders', 'biceps', 'triceps', 'forearms', 'quads', 'glutes', 'hamstrings', 'calves', 'adductors', 'abductors', 'core']
        out.append(row(btn('My focus', 'pri', 'target', sm=True), *[mchip(m, m in ('chest', 'shoulders', 'quads')) for m in fm], btn('Clear', 'txt', sm=True, style='height: 28px'), gap=6, wrap=True))
        out.append(txt('17 match', 't-m'))
        out.append(cat_box('Barbells', '1/5', True, grid(eq_tile('barbell-bench-specialist', False), eq_tile('barbell-multi-grip', True), eq_tile('barbell-ez', False, mus=True) if False else eq_tile('barbell-axle', False), cols=3, gap=8)))
        out.append(cat_box('Benches', '2/2', True, grid(eq_tile('bench-flat', True), eq_tile('bench-adjustable', True), cols=3, gap=8)))
        out.append(cat_box('Machines', '4/9', True, grid(eq_tile('m-chest-press', True), eq_tile('m-pec-deck', True), eq_tile('m-incline-press', False), eq_tile('m-shoulder-press', True), eq_tile('m-leg-press', True), eq_tile('m-leg-extension', False), cols=3, gap=8)))
        return col(*out, gap=12)
    if mode == 'empty':
        out += [inv_search('treadclimbr'), txt('—', 't-h3 c-dim', 'padding: 6px 2px')]
        return col(*out, gap=12)
    out.append(inv_search())
    if mode == 'expanded':
        out += [cat_box(n_, c) for n_, c in CATS[:6]]
        out.append(cat_box('Machines', '9/53', True, grid(*[eq_tile(e, o) for e, o in MACH], cols=3, gap=8)))
        out += [cat_box(n_, c) for n_, c in CATS[7:11]]
    else:
        out += [cat_box(n_, (c.split('/')[1] if n == 0 and '/' in c else c)) for n_, c in CATS]
    return col(*out, gap=10 if mode != 'expanded' else 8)


BANDS = [('yellow', 'Yellow', '#e5c100', 7), ('green', 'Green', '#3fa34d', 11), ('red', 'Red', '#d1495b', 15), ('black', 'Black', '#2b2f36', 23)]
BAND_HEX = [('#e5c100', 'Yellow'), ('#3fa34d', 'Green'), ('#d1495b', 'Red'), ('#3d84c9', 'Blue'), ('#2b2f36', 'Black'), ('#7b5ea7', 'Purple'), ('#e06c9f', 'Pink'),
            ('#e08a3c', 'Orange'), ('#9aa0a6', 'Grey'), ('#e9eaec', 'White')]


def band_card(pick=None, dirty=False, saved=False, rows=BANDS):
    """BandLibraryCard: colour dot (the band's real colour, loads.ts BAND_HEX) · name · kg input · kg · ×."""
    rr = []
    for i, (_, n, hx, kg) in enumerate(rows):
        rr.append(row(f'<span style="display: inline-flex; width: 30px; justify-content: center">{swatch(hx, 14, 7)}</span>', txt(n, 't-s', 'flex: 1'),
                      f'<div style="width: 78px">{field(value=str(kg))}</div>', txt('kg', 't-m', 'width: 20px'), ibtn('x', 'Delete', sm=True), gap=8))
        if pick == i:
            sw = grid(*[col(swatch(h_, 22, 11), gap=0, style='align-items: center') for h_, _n in BAND_HEX], cols=5, gap=10)
            rr.append(card(sw, style='padding: 12px; width: 200px; margin-left: 20px'))
    lab = 'Saved' if saved else 'Save library'
    return card(row(ico('scale', 16), txt('Band library', 't-h3'), gap=8), txt('Set once per gym — colour → resistance. Used for every band exercise here.', 't-m'), col(*rr, gap=6),
                row(btn('Add band', 'sec', 'plus', sm=True), sp(), btn(lab, 'sec', 'check', sm=True, dis=not dirty and not saved), gap=8), gap=12)


# ============================================================== Learn (learn/App.tsx, learn.css) — graduation-cap placeholders are what the code renders (videos not shot)
LEARN_TABS = [('home', 'Home', 'play'), ('topics', 'Topics', 'layers'), ('saved', 'Saved', 'book'), ('apps', 'Apps', 'grid')]
TOPICS = [('Basics', 'Accounts, the app, your first workout & log', 'star', 7, 7, 7), ('Logging', 'Sets, supersets, rest timer, backfill', 'edit', 14, 14, 14),
          ('Cardio & recovery', 'Timed activities, effort, rest days', 'heart', 6, 6, 6), ('Programs', 'Playbook templates, weeks, assignments', 'calendar', 7, 10, 10),
          ('Progress & charts', 'Volume, trends, PRs, body metrics', 'chart', 10, 10, 10), ('Exercises', 'Library, custom lifts, exercise history', 'dumbbell', 4, 4, 5),
          ('Gyms', 'Add a gym, equipment, band library', 'pin', 4, 4, 4), ('Apex & challenges', 'Gamification, ranks, awards, feed', 'trophy', 6, 6, 6),
          ('People', 'Profile, clients, users & roles', 'users', 2, 4, 8), ('Account & app', 'Settings, offline, install, sign-in', 'gear', 5, 5, 6)]
RI = {'member': 3, 'trainer': 4, 'admin': 5}
TOTAL = {'member': 65, 'trainer': 70, 'admin': 76}
BASICS = ['Get started in 3 minutes', 'Switch between apps', 'The Today screen', 'Set up your first workout', 'Log a set the fast way', 'Install Spotter on your phone', 'Change the language']
LOGGING = ['Sets, reps & weight', 'Edit or delete a set', 'Warm-up sets', 'Personal records as you lift', 'Supersets & circuits', 'The rest timer', 'Swap an exercise mid-session',
           'Add an exercise to a session', 'Bands, chains & assisted loads', 'Plate & bar math', 'Notes on a set or session', 'Log a past session', 'Finish & review a session', 'Your session history']
PROGS = ['Browse the Playbook', 'Find the right template', 'Start a program', 'Your active week & today', 'Build a program week', 'Edit & reorder a program', 'Save a session as a template']


def lbrand():
    return brandbar(right=row(ibtn('bell', 'Notifications', 'fill', sm=True), ibtn('globe', 'Language', 'fill', sm=True), gap=6), app='Learn')


def lph(*c, tab='home', h=844, overlay='', mood='art'):
    return phone(lbrand(), *c, tabs=(tab, LEARN_TABS), h=h, overlay=overlay, mood=mood, skin='learn')


def thumb(w='100%', h=290, soon=True, r=14):
    """.ln-thumb: dark still frame with the graduation-cap placeholder + bottom scrim; tiles carry the 'Soon' chip top-right."""
    ws = w if isinstance(w, str) else f'{w}px'
    base = card(span(ico('book', 24 if h > 120 else 18), 'c-dim'), pad=False, style=f'width: {ws}; height: {h}px; align-items: center; justify-content: center; flex: none')
    return rel(base, absb(tag('Soon', 'learn', 'clock'), 'right: 8px; top: 8px') if soon else '', style=f'width: {ws}; flex: none')


def ltile(t, h=290):
    return col(thumb('100%', h), txt(t, 't-s', 'font-weight: 600' if False else ''), gap=8)


def lgrid(titles, cols=2, h=290):
    return grid(*[ltile(t, h) for t in titles], cols=cols, gap=12, style='row-gap: 20px')


def ltoolbar(open_=False, n=0, q='', on=()):
    tb = row(f'<div style="flex: 1">{search("Search lessons", q)}</div>', rel(ibtn('filter', 'Filters', 'pri' if (open_ or n) else 'fill'), absb(tag(str(n), 'learn'), 'right: -5px; top: -5px') if n else ''), gap=10)
    if not open_:
        return tb
    fl = card(row(lbl('Filters'), sp(), btn('Clear', 'txt', sm=True, style='height: 24px') if n else '', gap=8), row(*[chip(t[0], t[0] in on) for t in TOPICS], gap=8, wrap=True), gap=12)
    return col(tb, fl, gap=10)


def lhead(title, count=''):
    return row(txt(title, 't-h1', 'flex: 1'), txt(count, 't-s num'), gap=8, align='baseline')


def kicker(t):
    return txt(t, 't-l', 'margin-bottom: -6px')


def cont_card():
    """.ln-continue: lead thumb (96 wide, 9:16) + topic tag + title + 'Video coming soon'; faint gem glow."""
    return card(row(thumb(96, 170, False), col(txt('Basics', 't-l c-learn'), txt('Get started in 3 minutes', 't-h3'), row(ico('clock', 13), txt('Video coming soon', 't-m'), gap=5), gap=6, style='flex: 1'), gap=14),
                tone='glass', style='padding: 12px')


def topic_block(name, n, titles, cols=2, h=290):
    return col('<div class="hl"></div>', kicker(f'{name} · {n} lessons'), lgrid(titles, cols, h), gap=14)


def learn_home(role='member', short=False):
    out = [lhead('How to Spotter', f'<span class="c-learn">0</span> / {TOTAL[role]}'), ltoolbar(), kicker('Continue'), cont_card(), topic_block('Basics', 7, BASICS[:2] if short else BASICS[:4])]
    if not short:
        out.append(topic_block('Logging', 14, LOGGING[:2]))
    return out


def topics_screen(role):
    rows_ = [card(row(tile(ic, 'learn', lg=True), col(txt(n, 't-h3'), txt(d, 't-m'), bar(0, 'learn', 5), gap=4, style='flex: 1; min-width: 0'), txt(f'0/{t[RI[role]]}', 't-m num'), gap=14), style='padding: 15px', gap=0)
             for t in TOPICS for (n, d, ic) in [t[:3]]]
    return [lhead('Topics'), col(*rows_, gap=11)]


def upnext_rows(web=False):
    return col(*[row(thumb(120 if web else 68, 68 if web else 120, False, 12), col(txt(t, 't-s'), txt('video coming soon', 't-m'), gap=3, style='flex: 1'), gap=13)
                 for t in ['Switch between apps', 'The Today screen', 'Set up your first workout']], gap=12)


def stage(web=False, h=None):
    """.ln-stage — THE focal block of the player: the lesson frame (9:16 phone / 16:9 web), gem ring icon + coming-soon copy."""
    hh = h or (202 if web else 506)
    return card(span(ico('book', 26), 'c-learn'), txt('This lesson is coming soon', 't-h3', 'text-align: center'),
                txt('We’re recording it in two cuts — phone and web. Save it and we’ll notify you.', 't-s', 'text-align: center; max-width: 300px'),
                tone='hero', style=f'height: {hh}px; align-items: center; justify-content: center; padding: 0 28px', gap=10)


def player(web=False, saved=False):
    return [btn('Basics', 'txt', 'back', sm=True, style='padding: 0; height: 28px; align-self: flex-start'), stage(web),
            col(txt('Basics', 't-l c-learn'), txt('Get started in 3 minutes', 't-h2'), txt('A quick tour of the four tabs — Today, Progress, Programs, Gyms — and where everything lives.', 't-s'), gap=6),
            row(f'<div style="width: 170px">{seg(["Phone", "Web"], 1 if web else 0)}</div>', sp(), btn('Saved' if saved else 'Save', 'pri' if saved else 'sec', 'book', sm=True), gap=10),
            '<div class="hl"></div>', kicker('Up next'), upnext_rows(web)]


SAVED = [('Set up your first workout', 'Basics'), ('The rest timer', 'Logging'), ('Read your first chart', 'Progress & charts')]

# ============================================================== ROW 0 · main
for role in ('member', 'trainer', 'admin'):
    P(f'P09-Exercises-{role.title()}.dc.html', f'Exercises · Library · {role.title()}', ph(*library(role), h=1500), h=1500, row_=0)
P('P09-Mine-Trainer.dc.html', 'Exercises · My exercises · Trainer', ph(*mine_screen('trainer')), row_=0)
P('P09-Mine-Admin.dc.html', 'Exercises · My exercises · Admin', ph(*mine_screen('admin')), row_=0)
P('P09-Mine-Member.dc.html', 'Exercises · My exercises · Member', ph(*mine_screen('member')), row_=0)
P('P09-Detail.dc.html', 'Exercise detail · rich (scroll)', ph(*detail_rich(), h=2060), h=2060, row_=0)


def custom_detail(can):
    return ph(detail_media(none=True), col(txt('Landmine press', 't-h1'), row(tag('Barbell', 'neutral', 'weight')), gap=10),
              muscles_sec(('shoulders',), ('chest', 'triceps'), ()), history_sec(False, False),
              btn('Edit exercise', 'sec', 'edit', full=True) if can else '', add_btn())


P('P09-Detail-Custom-Trainer.dc.html', 'Exercise detail · custom lift · Trainer', custom_detail(True), row_=0)
P('P09-Detail-Custom-Member.dc.html', 'Exercise detail · custom lift · Member', custom_detail(False), row_=0)
P('P09-Equipment-Detail.dc.html', 'Machine detail · in this gym (scroll)', ph(*eq_detail(), h=1900, tabs='gyms'), h=1900, row_=0)

P('P09-Learn-Home-Member.dc.html', 'Learn · Home · Member (scroll)', lph(*learn_home('member'), h=1700), h=1700, row_=0)
P('P09-Learn-Topics-Member.dc.html', 'Learn · Topics · Member', lph(*topics_screen('member'), tab='topics', h=1200), h=1200, row_=0)
P('P09-Learn-Topic.dc.html', 'Learn · Topic · Logging', lph(btn('Topics', 'txt', 'back', sm=True, style='padding: 0; height: 28px; align-self: flex-start'), lhead('Logging', '14 lessons'), lgrid(LOGGING[:4]), tab='topics', h=1020), h=1020, row_=0)
P('P09-Learn-Player.dc.html', 'Learn · Player · phone cut', lph(*player(), tab='', h=1300), h=1300, row_=0)
P('P09-Learn-Saved.dc.html', 'Learn · Saved', lph(lhead('Saved', '3 videos'), col(*[row(thumb(68, 120, False, 12), col(txt(t, 't-s'), txt(f'{tp} · video coming soon', 't-m'), gap=3, style='flex: 1'), span(ico('book', 19), 'c-learn'), gap=13) for t, tp in SAVED], gap=12), tab='saved'), row_=0)

# ============================================================== ROW 1 · states, roles, night
P('P09-Exercises-Filtered.dc.html', 'Library · muscle filter on (primary, then secondary)', ph(*library('member', CHEST_P, ('Chest',), 'Secondary · Chest', CHEST_S, pages=None), h=1420), h=1420, row_=1)
P('P09-Exercises-Search.dc.html', 'Library · search', ph(*library('member', [BENCH, 'Barbell Incline Bench Press - Medium Grip', 'Close-Grip Barbell Bench Press', 'Dumbbell Bench Press', 'Smith Machine Bench Press'], q='bench press', pages=None), h=900), h=900, row_=1)
P('P09-Mine-Empty.dc.html', 'My exercises · none yet · Trainer', ph(*mine_screen('trainer', True)), row_=1)
P('P09-Exercises-Night.dc.html', 'Exercises · night', ph(sleephero(), *library('member', n=6)[:-1], mood='sky', h=1000), h=1000, row_=1)
P('P09-Detail-Night.dc.html', 'Exercise detail · night', ph(*detail_rich(True)[:5], mood='sky', h=980), h=980, row_=1)
P('P09-Equipment-NotHere.dc.html', 'Machine detail · not in this gym', ph(*eq_detail(here=False)[:6], h=900, tabs='gyms'), h=900, row_=1)
P('P09-Equipment-NoGym.dc.html', 'Machine detail · opened without a gym (no gym button, no here flags)', ph(*[x for i, x in enumerate(eq_detail(gym=False)) if i in (0, 1, 2, 4, 10)], h=1000, tabs='gyms'), h=1000, row_=1)
P('P09-Equipment-NoMuscles.dc.html', 'Machine detail · kit with no muscle tags (no exercise list, no alternatives)', ph(
    row(ibtn('back', 'Back', 'fill', sm=True), col(lbl('Racks & stands'), txt('Power rack', 't-h2'), gap=2, style='flex: 1'), gap=12), eq_pic('rack-power', '100%', 214, 16),
    btn('In this gym', 'sec', 'check', full=True), tabs='gyms'), row_=1)
P('P09-Equipment-Missing.dc.html', 'Machine detail · unknown item', ph(ibtn('back', 'Back', 'fill', sm=True), txt('—', 't-h2 c-dim'), tabs='gyms'), row_=1)

for role in ('trainer', 'admin'):
    P(f'P09-Learn-Home-{role.title()}.dc.html', f'Learn · Home · {role.title()}', lph(*learn_home(role, True)), row_=1)
    P(f'P09-Learn-Topics-{role.title()}.dc.html', f'Learn · Topics · {role.title()}', lph(*topics_screen(role), tab='topics', h=1200), h=1200, row_=1)
P('P09-Learn-Filters.dc.html', 'Learn · filters open + results', lph(lhead('How to Spotter', '<span class="c-learn">0</span> / 65'), ltoolbar(True, 1, on=('Programs',)),
                                                                   '<div class="hl"></div>', kicker('Results · 7'), lgrid(PROGS[:4]), h=1180), h=1180, row_=1)
P('P09-Learn-NoResults.dc.html', 'Learn · no results', lph(lhead('How to Spotter', '<span class="c-learn">0</span> / 65'), ltoolbar(q='deadlift'), '<div class="hl"></div>',
                                                          kicker('Results · 0'), txt('No lessons match', 't-s', 'padding: 24px 0; text-align: center')), row_=1)
P('P09-Learn-Saved-Empty.dc.html', 'Learn · Saved · empty', lph(lhead('Saved'), col(tile('book', 'neutral', lg=True, s=30), txt('Nothing saved yet', 't-h2'), txt('Tap the bookmark on any lesson to keep it here for later.', 't-s', 'text-align: center; max-width: 300px'),
                                                                            btn('Browse lessons', 'pri', 'globe', sm=True), gap=12, style='align-items: center; padding: 120px 24px 0'), tab='saved'), row_=1)
P('P09-Learn-Player-Web.dc.html', 'Learn · Player · web cut on phone, saved', lph(*player(True, True), tab='', h=1000), h=1000, row_=1)
P('P09-Learn-Night.dc.html', 'Learn · Home · night (moon, no sky)', lph(*learn_home('member', True), mood='moon', h=1100), h=1100, row_=1)

# ============================================================== ROW 2 · sheets
FSHEET = sheet(None, row(ibtn('back', 'Back', 'fill', sm=True), txt('Filters', 't-h2'), gap=10), *filter_groups(('Chest', 'Compound')), h=800, close=False)
P('P09-Filters.dc.html', 'Library · filters sheet', ph(*library('member'), overlay=FSHEET), row_=2)


def editor(title='New exercise', name='', pri=None, sec=(), eq=(), subs=False, cta=None):
    parts = [row(ibtn('back', 'Back', 'fill', sm=True), txt(title, 't-h2'), gap=10), field('Name', name, 'Exercise name', state='' if name else 'focus'),
             col(lbl('Primary muscle'), row(*[chip(row(bodymap(GV[m], (m,) if m != 'fullbody' else (), region=GR[m], h=16, full=m == 'fullbody'), MNAME[m], gap=4), MNAME[m] == pri) for m in MUS], gap=6, wrap=True), gap=8),
             col(lbl('Secondary muscles'), row(*[chip(row(bodymap(GV[m], (m,) if m != 'fullbody' else (), region=GR[m], h=16, hl=ACCENT['neutral'], full=m == 'fullbody'), MNAME[m], gap=4), MNAME[m] in sec)
                                                   for m in MUS if MNAME[m] != pri], gap=6, wrap=True), gap=8)]
    if subs:
        parts += [cg('Sub-regions', ['Front delt', 'Side delt', 'Rear delt'], ('Front delt',)), cg('Sub-regions (secondary)', ['Upper chest', 'Lower chest'], ('Upper chest',))]
    parts += [col(lbl('Equipment'), row(*[chip(EQN[k], EQN[k] in eq, EQI[k]) for k in EQN], gap=6, wrap=True), gap=8), btn(cta or title, 'pri', full=True, dis=not name, style='height: 48px')]
    return sheet(None, *parts, h=1080 if subs else 960, close=False)


P('P09-Editor-New-Trainer.dc.html', 'New exercise · Trainer', ph(*mine_screen('trainer'), overlay=editor(), h=1000), h=1000, row_=2)
P('P09-Editor-Edit-Admin.dc.html', 'Edit exercise · sub-regions · Admin', ph(*mine_screen('admin'), overlay=editor('Edit exercise', 'Landmine press', 'Shoulders', ('Chest', 'Triceps'), ('Barbell',), True, 'Save'), h=1120), h=1120, row_=2)

LIGHT = scrim() + scrim() + scrim() + absb(row(txt('Start', 't-s', 'flex: 1'), ibtn('x', 'Cancel', 'fill', sm=True), gap=8), 'left: 16px; right: 16px; top: 16px') + \
    absb(xpic(BENCH, '100%', 239, 6, 0), 'left: 16px; right: 16px; top: 280px') + \
    absb(row(ibtn('minus', 'Zoom out', 'fill'), txt('100%', 't-m num', 'min-width: 48px; text-align: center'), ibtn('plus', 'Zoom in', 'fill'), gap=10, justify='center'), 'left: 0; right: 0; bottom: 40px')
P('P09-Lightbox.dc.html', 'Exercise detail · form photo lightbox', ph(*detail_rich()[:4], overlay=LIGHT, tabs=None), row_=2)

GYMH = header(GYM)
P('P09-Inventory.dc.html', 'Gym · band library + inventory (all categories collapsed)', ph(GYMH, band_card(), card(eq_board(), gap=0), h=1560, tabs='gyms'), h=1560, row_=2)
P('P09-Inventory-Open.dc.html', 'Inventory · a category opened', ph(GYMH, card(eq_board('expanded'), gap=0), h=1300, tabs='gyms'), h=1300, row_=2)
P('P09-Inventory-Filter.dc.html', 'Inventory · muscle filter + My focus', ph(GYMH, card(eq_board('filter'), gap=0), h=1440, tabs='gyms'), h=1440, row_=2)
P('P09-Inventory-Search.dc.html', 'Inventory · search (categories auto-open)', ph(GYMH, card(col(inv_head(), inv_search('leg press'),
                                                                                          cat_box('Machines', '1/1', True, grid(eq_tile('m-leg-press', True), cols=3, gap=8)),
                                                                                          cat_box('Plate-loaded', '1/1', True, grid(eq_tile('m-hack-squat', False), cols=3, gap=8)), gap=10), gap=0), tabs='gyms'), row_=2)
P('P09-Inventory-Fresh.dc.html', 'Inventory · nothing ticked yet (no count badge)', ph(GYMH, band_card(rows=[], dirty=False), card(eq_board(n=0), gap=0), h=1300, tabs='gyms'), h=1300, row_=2)
P('P09-Inventory-NoMatch.dc.html', 'Inventory · no match', ph(GYMH, card(eq_board('empty'), gap=0), tabs='gyms'), row_=2)
SEL = sheet(None, row(txt('Selected inventory', 't-h2'), tag('24', 'brass'), gap=8),
            lst(*[li(EQC[e][0], None, eq_pic(e, 44, 44, 10), ibtn('x', 'Remove', 'fill', sm=True)) for e in ['bench-adjustable', 'cable-crossover', 'barbell-ez', 'bench-flat', 'm-lat-pulldown', 'm-leg-press', 'barbell-olympic']]),
            btn('Clear all', 'dan', 'trash', full=True), h=720, close=False)
P('P09-Inventory-Selected.dc.html', 'Inventory · selected sheet', ph(GYMH, card(eq_board(), gap=0), overlay=SEL, tabs='gyms'), row_=2)


def pick_tile(eid, on, ingym):
    corner = tag('✓', 'brass') if on else (tag('＋', 'neutral') if not ingym else '')
    return col(rel(eq_pic(eid, '100%', 74, 10), absb(corner, 'right: 6px; top: 6px')), txt(EQC[eid][0], 't-m c-brass' if on else 't-m'), gap=5)


EPS = sheet(None, txt('Equipment', 't-h3'), row(chip('Olympic barbell (20 kg) ×', True), chip('Flat bench ×', True), gap=6, wrap=True), search('Search equipment'),
            cat_box('Barbells', '1/6', True, grid(*[pick_tile(e, o, g) for e, o, g in [('barbell-olympic', True, True), ('barbell-power', False, True), ('barbell-technique', False, False),
                                                                                     ('barbell-bench-specialist', False, False), ('barbell-multi-grip', False, False), ('barbell-axle', False, True)]], cols=3, gap=8)),
            cat_box('Racks & stands', '4'), cat_box('Benches', '1/5'), cat_box('Plates', '6'), h=790, close=False)
P('P09-EquipmentPicker.dc.html', 'Session · equipment for this exercise', ph(header('Bench press'), overlay=EPS, tabs=None), row_=2)
EPS2 = sheet(None, txt('Equipment', 't-h3'), search('Search equipment', 'strap'), txt('—', 't-h3 c-dim'), h=320, close=False)
P('P09-EquipmentPicker-Empty.dc.html', 'Equipment picker · no match', ph(header('Bench press'), overlay=EPS2, tabs=None), row_=2)

P('P09-BandSheet.dc.html', 'Session · band library sheet (seeded defaults, swatches open)', ph(header('Band pull-apart'), overlay=sheet(None, band_card(pick=1, dirty=True), h=560, close=False), tabs=None), row_=2)
P('P09-BandSaved.dc.html', 'Gym · band library saved', ph(GYMH, band_card(saved=True), tabs='gyms'), row_=2)


def cm_row(n, icon, on=False, sub=None):
    return li(n, sub, f'<span class="tile" style="width: 32px; height: 32px">{ico(icon, 16)}</span>', span(ico('check', 18), 'c-brass') if on else '')


CMS = sheet(None, lbl('Which machine?'), lbl('In your gym'), lst(cm_row('Treadmill', 'run', True), cm_row('Rowing erg', 'wave'), cm_row('Indoor cycle / spin bike', 'bike')),
            lbl('Other machines'), lst(cm_row('No machine / other', 'timer', sub='Just time and distance'), *[cm_row(n, i) for n, i in [('Curved / manual treadmill', 'run'), ('Ski erg', 'wave'), ('Bike erg', 'bike'), ('Air / fan bike', 'bike')]]),
            h=740, close=False)
P('P09-CardioMachine.dc.html', 'Cardio · which machine (gym stocked)', ph(header('Treadmill'), overlay=CMS, tabs=None), row_=2)

# ============================================================== ROW 3 · dialogs, snack, desktop
P('P09-Delete-Custom.dc.html', 'Delete custom exercise · Trainer', ph(*mine_screen('trainer'), overlay=dialog('Delete “Cable Y-raise”?', 'This removes it from your exercise list. Logged sets keep their name.', 'Remove', 'Cancel')), row_=3)
P('P09-Inventory-RemoveOne.dc.html', 'Remove from gym?', ph(GYMH, card(eq_board(), gap=0), overlay=dialog('Remove from gym?', 'Remove "Flat bench" from this gym\'s inventory?', 'Remove', 'Cancel'), tabs='gyms'), row_=3)
P('P09-Inventory-ClearAll.dc.html', 'Clear all inventory?', ph(GYMH, card(eq_board(), gap=0), overlay=dialog('Clear all inventory?', "Remove all 24 items from this gym's inventory? You can undo right after.", 'Clear all', 'Cancel'), tabs='gyms'), row_=3)
P('P09-Inventory-Undo.dc.html', 'Inventory · removed, undo', ph(GYMH, card(eq_board(), gap=0), overlay=snack('"Flat bench" removed'), tabs='gyms'), row_=3)
P('P09-Inventory-Cleared.dc.html', 'Inventory · cleared, undo', ph(GYMH, card(eq_board(n=0), gap=0), overlay=snack('24 items cleared'), tabs='gyms'), row_=3)

rail_ = col(txt('Filters', 't-h2'), search('Search exercises'), *filter_groups(('Chest',)), gap=16, style='width: 330px; flex: none')


def dcard(n):
    """.exl-card (web): square photo, name 14, muscles 10, badges."""
    e, mus = rinfo(n)
    return card(xpic(n, '100%', 180, 12), col(txt(n, 't-s', ''), txt(mus, 't-m'), row(tag(e['mechanic'].title(), 'neutral') if e.get('mechanic') else '', tag(EQN[e['equipment']], 'neutral', EQI[e['equipment']]), gap=4, wrap=True), gap=4, style='padding: 10px 12px 12px'), pad=False, gap=0)


dmain = col(row(col(txt('Exercises', 't-h1'), txt('873 in the library · 812 with instructions & photos', 't-m'), gap=2, style='flex: 1'), btn('New exercise', 'pri', 'plus'), gap=10),
            f'<div style="width: 360px">{seg(["Library", "My exercises <span class=c-brass>3</span>"])}</div>', row(chip('Chest ×', True)),
            grid(*[dcard(n) for n in CHEST_P[:8]], cols=4, gap=16), txt('Secondary · Chest', 't-l'), grid(*[dcard(n) for n in CHEST_S], cols=4, gap=16),
            pager(pages=(1, 2)), gap=14, style='flex: 1; min-width: 0')
board('P09-Desktop-Exercises-Trainer.dc.html', 'Desktop · Exercises · Trainer', 1440, 1080,
      desktop(col(col(lbl('Trainer'), txt('Exercises', 't-h1'), ovback(), gap=2), row(rail_, dmain, gap=32, align='flex-start'), gap=16), active='overview', h=1080), row_=3)

_e = RICH[BENCH.lower()]
dd = row(col(xpic(BENCH, '100%', 420, 16), form_photos(h=200), gap=18, style='flex: 1; min-width: 0'),
         col(col(txt(BENCH, 't-d1'), badges_row(_e), gap=12), muscles_sec(fig_h=170), instructions(INSTR['Barbell_Bench_Press_-_Medium_Grip']), history_sec(desk=True), alternatives(),
             row(btn('Full history', 'sec'), btn("Add to today's session", 'pri', 'plus'), gap=10), gap=22, style='width: 480px; flex: none'), gap=36, align='flex-start')
board('P09-Desktop-Detail.dc.html', 'Desktop · exercise detail', 1440, 1400,
      desktop(col(row(ibtn('back', 'Back', sm=True), txt(f'Exercises / {BENCH}', 't-s'), gap=8), dd, gap=16), active='overview', h=1400), row_=3)

LRAIL = [('home', 'Home', 'play'), ('topics', 'Topics', 'layers'), ('saved', 'Saved', 'book')]
dlearn = col(row(txt('spotter', 't-h3'), chip('Learn'), sp(), ibtn('bell', 'Notifications', 'fill', sm=True), ibtn('globe', 'Language', 'fill', sm=True), gap=10),
             lhead('How to Spotter', '<span class="c-learn">0</span> / 65'), f'<div style="max-width: 640px">{ltoolbar()}</div>', kicker('Continue'),
             card(row(thumb(235, 132, False), col(txt('Basics', 't-l c-learn'), txt('Get started in 3 minutes', 't-h2'), row(ico('clock', 14), txt('Video coming soon', 't-s'), gap=6), gap=8), gap=18), tone='glass', style='padding: 12px; max-width: 700px'),
             '<div class="hl"></div>', kicker('Basics · 7 lessons'), lgrid(BASICS[:4], cols=4, h=165), '<div class="hl"></div>', kicker('Logging · 14 lessons'), lgrid(LOGGING[:4], cols=4, h=165), gap=18)
board('P09-Desktop-Learn.dc.html', 'Desktop · Learn home (landscape cut)', 1440, 820, desktop(dlearn, active='home', items=LRAIL, h=820, skin='learn'), row_=3)

dplayer = col(btn('Basics', 'txt', 'back', sm=True, style='padding: 0; height: 28px; align-self: flex-start'), stage(True, 508),
              col(txt('Basics', 't-l c-learn'), txt('Get started in 3 minutes', 't-h2'), txt('A quick tour of the four tabs — Today, Progress, Programs, Gyms — and where everything lives.', 't-s'), gap=6),
              row(f'<div style="width: 200px">{seg(["Phone", "Web"], 1)}</div>', sp(), btn('Save', 'sec', 'book', sm=True), gap=12), '<div class="hl"></div>', kicker('Up next'), upnext_rows(True), gap=16,
              style='max-width: 904px; width: 100%; align-self: center')
board('P09-Desktop-Learn-Player.dc.html', 'Desktop · Learn player (web cut)', 1440, 1000, desktop(dplayer, active='', items=LRAIL, h=1000, skin='learn'), row_=3)

if MISSING:
    print('MISSING ASSETS:', sorted(MISSING))
print('P09 ok')
