"""P11 · Gyms — 1:1 translation of views/GymsView.tsx (list, GymSearch, add-by-location states, desktop detail pane),
views/GymDetailView.tsx (saved gym + unsaved candidate), components/{GymKit,GymThumb,GymPicker,RouteMap,EquipmentBoard,
BandLibraryCard}.tsx and gymEvidence.ts. Copy = en.ts. See fidelity/P11.md for the board -> source map."""
from kit import *

import glob as _glob, os as _os
for _f in _glob.glob(_os.path.join(OUT, 'P11-*.dc.html')):
    _os.remove(_f)

GYM = 'Iron Temple'
ADDR = 'Khreshchatyk St 22, Kyiv'


def abs_box(inner, css):
    return f'<div style="position: absolute; {css}">{inner}</div>'


def thumb(s=56, r=12, mark=None):
    """GymThumb / ResultThumb: provider photo (runtime) -> OSM tile (runtime) -> HouseGraphic.tsx, the app's own final fallback:
    graphite weave + centred barbell mark (drawn: kit weave surface + the barbell mark)."""
    m = mark or max(14, int(s * 0.34))
    ws = s if isinstance(s, str) else f'{s}px'
    return f'<div style="position: relative; width: {ws}; height: {s if isinstance(s, int) else 64}px; flex: none">{photo(s, s if isinstance(s, int) else 64, r)}{abs_box(span(ico("dumbbell", m), "c-dim"), "left: 0; right: 0; top: 0; bottom: 0; display: flex; align-items: center; justify-content: center")}</div>'


def hero_house(h=210, mark=64):
    return f'<div style="position: relative; height: {h}px">{photo("100%", h, 0)}{abs_box(span(ico("dumbbell", mark, w=1.4), "c-dim"), "left: 0; right: 0; top: 0; bottom: 0; display: flex; align-items: center; justify-content: center")}</div>'


import json as _json
_MMAP = _json.load(open(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'musclemap.json')))
GVIEW, GREG = _MMAP['GROUP_VIEW'], _MMAP['GROUP_REGION']


def micon(m, h=22):
    return bodymap(GVIEW[m], primary=(m,), region=GREG[m], h=h)


def mchip(m, name, h=20):
    """MuscleChip (figure chip)"""
    return card(micon(m, h), span(name, 't-m c-mut'), pad=False, gap=4, style='flex-direction: row; align-items: center; padding: 2px 8px 2px 3px; flex: none')


def eqimg(key, w=44, h=44, r=10):
    """equipment photo as the app shows it (gk-thumb / eq-thumb on white)"""
    return img(f'equipment/{key}.jpg', w, h, r, fit='cover')


def gyms_screen(*content, h=844, overlay='', mood='art', tabs='gyms'):
    return phone(brandbar(), txt('Gyms', 't-h1', 'padding: 0 2px'), *content, tabs=tabs, h=h, mood=mood, overlay=overlay)


def gym_card(name, meta, sel=False):
    r = li(txt(name, 't-h3'), meta, thumb(56), chev=True, style='min-height: 82px; padding: 13px 15px')
    return card(r, tone='glass', pad=False, gap=0) if sel else lst(r)


def result(name, addr, hl_=None):
    if hl_:
        name = ''.join(span(ch, 'c-brass') if i in hl_ else ch for i, ch in enumerate(name))
    return li(name, addr, thumb(64, 12), chev=True)


MY = [lbl('My gyms'), gym_card(GYM, '0.2 km · ' + ADDR), gym_card('Home gym', '8.4 km · Obolonskyi Ave 16')]
NEARBY = [lbl('Nearby'), lst(result('Atlet Fitness', '0.6 km · Khreshchatyk St 12'), result('Sportlife Podil', '3.1 km · Naberezhno-Khreshchatytska St 9'),
                             result('Crossfit Kyiv', '1.4 km · Velyka Vasylkivska St 5'), result('Gym Hall 24', '1.9 km · Lva Tolstoho St 11'), result('Olymp Fitness', '2.6 km · Saksahanskoho St 40'))]


def provider_chips(states=(('Saved', 'ok', ' 1'), ('OpenStreetMap', 'ok', ' 3'), ('Google', 'ok', ' 2'), ('Foursquare', 'pending', ''))):
    out = []
    for n, st, c in states:
        lead = ico('check', 14, w=2.2) if st == 'ok' else (dot('neutral') if st == 'pending' else '')
        out.append(f'<button class="chip{" on" if st == "ok" else ""}">{lead}{n}{c}</button>')
    return row(*out, gap=6, wrap=True)


def manual(q='iron', busy=False):
    lead = card(dot('brass'), pad=False, style='width: 48px; height: 48px; align-items: center; justify-content: center') if busy else tile('target', 'brass', lg=True)
    return lst(li(span(f'«{q}»', 'c-brass'), 'Locating' if busy else "I'm here", lead))


# ============================================================== RouteMap (Leaflet / static fallback) — approximated
def route_map(route=True, h=160, coords='50.4474, 30.5226', w=326):
    """RouteMap -> StaticRouteMap, the app's own fallback drawing shown until Leaflet/OSM tiles load: a major road, two roads,
    two thin grid lines, the brass walking route with a green start dot, the brass gym dot, and the chip "Route ready" / coordinates."""
    roads = (abs_box(spark([10, 22, 26, 44, 60, 72, 76], w, h, 'neutral', fill=False), 'left: 0; top: 0')
             + abs_box(spark([80, 60, 52, 54, 54, 44, 30], w, h, 'neutral', fill=False), 'left: 0; top: 0')
             + abs_box(spark([0, 30, 60, 100, 120, 140], int(w * 0.6), h, 'neutral', fill=False), f'left: {w * 0.15:.0f}px; top: 0'))
    grid_ = abs_box('<div class="hl" style="width: 100%"></div>', f'left: 0; right: 0; top: {h * 0.36:.0f}px') + abs_box(f'<div class="vl" style="height: {h}px"></div>', f'left: {w * 0.6:.0f}px; top: 0')
    base = card(pad=False, style=f'height: {h}px; width: 100%; overflow: hidden')
    if route:
        line = abs_box(spark([4, 12, 20, 36, 46, 66, 72, 84, 96], int(w * 0.72), int(h * 0.66), 'brass', fill=False), f'left: {w * 0.13:.0f}px; top: {h * 0.16:.0f}px')
        start = abs_box(dot('ok'), f'left: {w * 0.13 - 4:.0f}px; top: {h * 0.82 - 4:.0f}px')
        chip_ = abs_box(tag('Route ready', 'neutral', 'pin'), 'left: 10px; bottom: 10px')
        return f'<div style="position: relative; overflow: hidden">{base}{roads}{grid_}{line}{start}{chip_}</div>'
    return f'<div style="position: relative; overflow: hidden">{base}{roads}{grid_}{abs_box(dot("brass"), f"left: {w * 0.7:.0f}px; top: {h * 0.4:.0f}px")}{abs_box(tag(coords, "neutral", "pin"), "left: 10px; bottom: 10px")}</div>'



# ============================================================== ROW 0 · main flow
P('P11-Gyms.dc.html', 'Gyms · my gyms + nearby (scroll)', gyms_screen(*MY, search('Search for a gym'), *NEARBY, h=1000), h=1000)

SEARCH = [search('Search for a gym', 'iron'), provider_chips(),
          lst(result('Iron Temple', '0.2 km · ' + ADDR, (0, 1, 2, 3)), result('Iron Club Podil', '3.4 km · Mezhyhirska St 7', (0, 1, 2, 3)),
              result('Iron Mike Gym', '5.8 km · Hryhorenka Ave 22', (0, 1, 2, 3))), manual()]
P('P11-Gyms-Search.dc.html', 'Search · typing, providers streaming', gyms_screen(*MY, *SEARCH), row_=0)


RANGE_TODAY = '06:00–23:00'


def hours_card(state='today', open_=True):
    head = row(span(ico('clock', 16), 'c-dim'), lbl('Hours'), sp(), tag('Open now', 'ok') if open_ is True else (tag('Closed now', 'bad') if open_ is False else ''), gap=6)
    if state == 'unknown':
        body = [txt('Hours not listed in OpenStreetMap', 't-s')]
    elif state == '247':
        body = [txt('Open 24/7', 't-h3')]
    else:
        body = [row(txt('Mon', 't-h3'), sp(), txt(RANGE_TODAY, 't-h2 num')),
                btn('All week', 'txt', 'back' if state == 'week' else None, sm=True, style='align-self: flex-start') if state == 'week' else row(btn('All week', 'txt', sm=True, style='height: 32px'), span(ico('chev', 16), 'c-brass'), gap=0)]
        if state == 'week':
            days = [('Mon', '06:00–23:00'), ('Tue', '06:00–23:00'), ('Wed', '06:00–23:00'), ('Thu', '06:00–23:00'), ('Fri', '06:00–22:00'), ('Sat', '08:00–21:00'), ('Sun', 'Closed')]
            body.append(lst(*[li(span(d, 'c-brass' if i == 0 else ''), None, None, span(v, 't-s num' + (' c-brass' if i == 0 else ''))) for i, (d, v) in enumerate(days)]))
    return card(head, *body, gap=10)


def map_card(route=True):
    return card(row(span(ico('pin', 16), 'c-dim'), lbl('Map'), gap=6), route_map(route), btn('Route from my location', 'sec', 'target', full=True), gap=10)


def stats(n='24', moved='96.4 t', avg='1:04'):
    """.stat-grid: three cells, 22 px value + 10 px label — a strip, not three cards"""
    return card(grid(*[col(txt(v, 't-num num'), lbl(l_), gap=4) for v, l_ in [(n, 'Sessions'), (moved, 'Moved here'), (avg, 'Avg length')]], cols=3, gap=8), tone='quiet')


def kitdots(used):
    pad = 8 - len(used)
    return row(*([dot('neutral')] * pad + [dot('brass' if u else 'neutral') for u in used]), gap=3)


KIT_IMG = {'Leg press (45° / horizontal)': 'm-leg-press', 'Pec deck / fly machine': 'm-pec-deck', 'Cable crossover': 'cable-crossover', 'Hack squat machine': 'm-hack-squat'}


def kit_row(name, used, meta, sw=None, notehere=False):
    t2 = row(kitdots(used), txt(meta, 't-m'), gap=8)
    extra = btn('Not at this gym', 'txt', style='height: 26px; padding: 0') if notehere else ''
    return li(name, t2 + extra, eqimg(KIT_IMG.get(name, 'm-leg-press'), 44, 44), toggle(sw) if sw is not None else '')


def kit_card(title='Seen in your workouts', sub='Used here, not on the list yet', n=4):
    return card(col(txt(title, 't-h3'), txt(sub, 't-s'), gap=2),
                lst(kit_row('Leg press (45° / horizontal)', [True, False, True, True, False, True], 'Seen in 4 sessions here'),
                    kit_row('Pec deck / fly machine', [False, True, False, True], 'Seen in 2 sessions here'),
                    kit_row('Cable crossover', [True], 'Seen once here')),
                btn(f'Review {n}', 'pri', full=True), tone='glass', gap=12)


BAND_HEX = {'yellow': '#e5c100', 'green': '#3fa34d', 'red': '#d1495b', 'blue': '#3d84c9', 'black': '#2b2f36', 'purple': '#7b5ea7', 'pink': '#e06c9f', 'orange': '#e08a3c', 'grey': '#9aa0a6', 'white': '#e9eaec'}  # loads.ts
BANDS = [('yellow', 'Yellow', '5'), ('red', 'Red', '11'), ('green', 'Green', '16'), ('blue', 'Blue', '23'), ('black', 'Black', '30')]


def band_card(pick=None, saved=False, dirty=False, empty_=False):
    rows_ = []
    for i, (t_, n, kg) in enumerate([] if empty_ else BANDS):
        dot_btn = card(swatch(BAND_HEX[t_], 22, 11), pad=False, style='width: 36px; height: 36px; align-items: center; justify-content: center')
        rows_.append(li(n, None, dot_btn, row(f'<div style="width: 76px">{field(value=kg)}</div>', span('kg', 't-m'), ibtn('x', 'Delete', sm=True), gap=6)))
        if pick == i:
            rows_.append(f'<div class="hl" style="padding: 10px 16px">{row(*[swatch(hx, 24, 12) for hx in BAND_HEX.values()], gap=8, wrap=True)}</div>')
    return card(row(span(ico('scale', 16), 'c-dim'), lbl('Band library'), gap=6), txt('Set once per gym — colour → resistance. Used for every band exercise here.', 't-s'),
                lst(*rows_) if rows_ else '', row(btn('Add band', 'sec', 'plus', sm=True, style='flex: 1'), btn('Saved' if saved else 'Save library', 'sec', 'check', sm=True, style='flex: 1', dis=not dirty), gap=8), gap=10)


def eq_tile(key, name, mus, on=False):
    return card(eqimg(key, '100%', 70, 10), txt(name, 't-s'), row(*[mchip(g, n) for g, n in mus], gap=4, wrap=True),
                abs_box(ibtn('check' if on else 'plus', 'In this gym' if on else 'Add', 'pri' if on else 'fill', sm=True), 'right: 6px; top: 6px'),
                tone='glass' if on else '', gap=6, style='padding: 8px; position: relative')


CATS = [('Barbells', '3/26'), ('Dumbbells', '1/8'), ('Kettlebells', '6'), ('Plates', '2/8'), ('Racks & stands', '1/10'), ('Benches', '2/12'), ('Machines', '4/53'),
        ('Plate-loaded', '30'), ('Cable', '1/7'), ('Cardio', '27'), ('Bands', '8'), ('Bodyweight & suspension', '19'), ('Conditioning & functional', '53'),
        ('Aquatic', '11'), ('Recovery & mobility', '38'), ('Accessories', '91'), ('Assessment', '7')]


EQ_TILES = [eq_tile('barbell-olympic', 'Olympic barbell (20 kg)', [('fullbody', 'Full body')], True), eq_tile('barbell-power', 'Power bar', [('fullbody', 'Full body')], True),
            eq_tile('barbell-technique', 'Technique bar (5–10 kg)', [('fullbody', 'Full body')]), eq_tile('barbell-ez', 'EZ curl bar', [('biceps', 'Biceps'), ('triceps', 'Triceps')], True),
            eq_tile('barbell-axle', 'Axle / fat bar', [('fullbody', 'Full body'), ('forearms', 'Forearms')]), eq_tile('barbell-bench-specialist', 'Bench press bar (stiff)', [('chest', 'Chest'), ('triceps', 'Triceps')])]


def eq_board(open_cat='Barbells', filters=False, query='', n=14, cats=None):
    head = row(span(ico('scale', 16), 'c-dim'), lbl('Inventory'), sp(), tag(str(n), 'brass') if n else '', gap=6)
    srow = row(f'<div style="flex: 1">{search("Search equipment", query)}</div>', ibtn('filter', 'Filter by muscle', 'pri' if filters else 'fill'), gap=8)
    parts = [head, txt('Inventory is what you ticked on each gym — nobody audits it. A gym with no inventory set is never flagged as missing anything.', 't-s'), srow]
    if filters:
        parts.append(row(chip('My focus', icon='target'), *[chip(m, m in ('Chest', 'Back')) for m in ['Chest', 'Back', 'Lats', 'Traps', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Quads', 'Glutes',
                                                                                                          'Hamstrings', 'Calves', 'Adductors', 'Abductors', 'Core']], btn('Clear', 'txt', sm=True), gap=6, wrap=True))
        parts.append(txt('12 match', 't-s'))
    rows_ = []
    for c, cnt in (cats or CATS):
        exp = c == open_cat
        rows_.append(li(c, None, span(ico('down' if exp else 'chev', 16), 'c-dim'), span(cnt, 't-s num')))
        if exp:
            rows_.append(f'<div class="hl" style="padding: 10px">{grid(*EQ_TILES, cols=3, gap=8)}</div>')
    parts.append(lst(*rows_))
    return card(*parts, gap=10)


def detail(saved=True, h=2600, hours='today', open_=True, inside=True, stats_=True, kit=True, contact=True, overlay='', mood='art', eq=None, band=None, kit_block=None, route=True):
    hero = (f'<div style="position: relative; margin: -12px -16px 0">{hero_house(230)}'
            f'{abs_box(ibtn("back", "Back", "fill"), "left: 12px; top: 12px")}'
            f'{abs_box(col(txt(GYM if saved else "Atlet Fitness", "t-d1"), row(span(ico("pin", 14), "c-mut"), txt((ADDR + " · 0.2 km") if saved else "Khreshchatyk St 12, Kyiv · 0.6 km", "t-s"), gap=6), tag("Inside") if inside else "", gap=6, style="align-items: flex-start"), "left: 16px; right: 16px; bottom: 14px")}</div>')
    body = [hero]
    if not saved:
        body.append(btn('Add this gym', 'pri', 'plus', full=True, style='height: 54px'))
    body.append(btn('Start session here', 'pri' if saved else 'sec', 'play', full=True, style='height: 54px' if saved else ''))
    body.append(hours_card(hours, open_))
    body.append(map_card(route))
    if contact:
        body.append(row(btn('Website', 'sec', 'globe', style='flex: 1'), btn('Call', 'sec', 'phone', style='flex: 1'), gap=8))
    if saved:
        body.append(stats() if stats_ else txt('No sessions logged here yet', 't-s'))
        if kit:
            body.append(kit_block or kit_card())
        body.append(band or band_card())
        body.append(eq or eq_board())
        body.append(btn('Delete', 'dan', 'trash', full=True))
    return phone(brandbar(), *body, tabs=None, h=h, mood=mood, overlay=overlay)


P('P11-Detail.dc.html', 'Gym detail · saved (scroll)', detail(h=3200), h=3200, row_=0)
P('P11-Detail-Candidate.dc.html', 'Gym detail · search result, not saved', detail(False, h=1080, inside=False), h=1080, row_=0)

# ============================================================== ROW 1 · states
P('P11-Gyms-Empty.dc.html', 'Gyms · none yet', gyms_screen(
    txt('Add a gym while standing in it. Open the app there later and the visit is recorded — an unlogged hour shows up on Today.', 't-s'),
    search('Search for a gym'), *NEARBY[:1], lst(result('Atlet Fitness', '0.6 km · Khreshchatyk St 12'), result('Crossfit Kyiv', '1.4 km · Velyka Vasylkivska St 5')),
    empty('No gyms yet', "Find your gym in the search above — or, standing in it, tap “I'm here” to add it.", 'pin'),
    txt("Browsers don't give background location. Visits are only recorded while the app is open.", 't-m'), h=1000), h=1000, row_=1)

P('P11-Gyms-Searching.dc.html', 'Search · skeleton before first result', gyms_screen(*MY, search('Search for a gym', 'spo'),
    provider_chips((('Saved', 'ok', ' 0'), ('OpenStreetMap', 'pending', ''), ('Google', 'pending', ''), ('Foursquare', 'pending', ''))), skel_rows(3), manual('spo')), row_=1)
P('P11-Gyms-NoResults.dc.html', 'Search · nothing found', gyms_screen(*MY, search('Search for a gym', 'zzgym'),
    provider_chips((('Saved', 'ok', ' 0'), ('OpenStreetMap', 'ok', ' 0'), ('Google', 'fail', ' —'), ('Foursquare', 'fail', ' —'))),
    txt('Nothing found — add it manually below', 't-m'), manual('zzgym')), row_=1)
P('P11-Gyms-Locating.dc.html', 'Add by location · reading position', gyms_screen(*MY, search('Search for a gym', 'Garage gym'), provider_chips(),
    manual('Garage gym', busy=True),
    card(row(tile('target', 'brass'), txt('Reading your position…', 't-h3', 'flex: 1'), gap=10), f'<div class="sk" style="height: 10px; width: 70%"></div>', f'<div class="sk" style="height: 10px; width: 45%"></div>',
         txt('Accuracy improves for a few seconds — the save waits for the best fix or 8 s, whichever comes first.', 't-m'), tone='glass', gap=10), h=920), h=920, row_=1)
P('P11-Gyms-Coarse.dc.html', 'Add by location · GPS too coarse', gyms_screen(
    card(row(tile('warn', 'bad'), txt('Location came back at ±180 m — too coarse to pin a gym. Step inside and try again, or save it anyway and widen the radius.', 't-s', 'flex: 1'), gap=12, align='flex-start'), tone='bad', style='padding: 12px 14px'),
    row(btn('Save anyway', 'sec', sm=True), btn('Retry', 'sec', 'rotate', sm=True), gap=9), *MY, search('Search for a gym')), row_=1)
P('P11-Gyms-Denied.dc.html', 'Location blocked', gyms_screen(
    card(row(tile('pin', 'bad'), col(txt('Location is blocked', 't-h3 c-bad'), txt('Safari → aA → Website Settings → Location → Allow. Gyms and visit reminders stay off until then.', 't-s'), gap=4, style='flex: 1'), gap=10, align='flex-start'),
         btn('Try again', 'sec', sm=True, style='align-self: flex-start'), tone='bad', gap=12),
    *MY, txt('Everything else in the tracker works exactly as before — this only disables gyms.', 't-m')), row_=1)
P('P11-Gyms-Added.dc.html', 'Gym added · toast', gyms_screen(lbl('My gyms'), gym_card('Garage gym', '0 m · Lypska St 3', True), gym_card(GYM, '0.2 km · ' + ADDR), search('Search for a gym'),
                                                          overlay=snack('Gym added · accuracy ±12 m', '', 96)), row_=1)

P('P11-Detail-Hours-Week.dc.html', 'Detail · hours, all week open', detail(h=1000, hours='week', open_=False, kit=False, contact=False), h=1000, row_=1)
P('P11-Detail-Hours-States.dc.html', 'Detail · hours: 24/7, unknown · no route · no stats', phone(brandbar(), cap('Open 24/7', hours_card('247', True)), cap('Hours not listed', hours_card('unknown', None)),
    cap('Map · no location yet (no route)', map_card(False)), cap('Saved, nothing logged', txt('No sessions logged here yet', 't-s')),
    cap('Build the list (gym has no inventory)', kit_card('Build this list from your workouts', 'We found 7 items in your sessions here', 7)), tabs=None, h=1100), h=1100, row_=1)

P('P11-Detail-Missing.dc.html', 'Detail · gym no longer exists (stale link)', phone(brandbar(), row(ibtn('back', 'Back', 'fill'), sp()), tabs=None), row_=1)
P('P11-Detail-Split-Hours.dc.html', 'Detail · split hours, website only, empty band library & inventory', phone(brandbar(),
    card(row(span(ico('clock', 16), 'c-dim'), lbl('Hours'), sp(), tag('Closed now', 'bad'), gap=6), row(txt('Mon', 't-h3'), sp(), txt('07:00–12:00, 16:00–22:00', 't-h3 num')),
         row(btn('All week', 'txt', sm=True, style='height: 32px'), span(ico('chev', 16), 'c-brass'), gap=0), gap=10),
    btn('Website', 'sec', 'globe', full=True),
    band_card(empty_=True),
    card(row(span(ico('scale', 16), 'c-dim'), lbl('Inventory'), gap=6), txt('Inventory is what you ticked on each gym — nobody audits it. A gym with no inventory set is never flagged as missing anything.', 't-s'),
         row(f'<div style="flex: 1">{search("Search equipment")}</div>', ibtn('filter', 'Filter by muscle', 'fill'), gap=8),
         lst(*[li(c, None, span(ico('chev', 16), 'c-dim'), span(n, 't-s num')) for c, n in [('Barbells', '26'), ('Dumbbells', '8'), ('Kettlebells', '6'), ('Plates', '8')]]), gap=10),
    tabs=None, h=1100), h=1100, row_=1)

# ============================================================== ROW 2 · sheets, trays
REVIEW = sheet(None, lbl('Update Iron Temple'), txt('Kit you’ve used here that isn’t on Iron Temple’s list. The ones seen at least twice are switched on.', 't-s'),
               lst(kit_row('Leg press (45° / horizontal)', [True, False, True, True, False, True], 'Leg press, Calf raise', True, True),
                   kit_row('Pec deck / fly machine', [False, True, False, True], 'Pec deck fly', True, True),
                   kit_row('Cable crossover', [True], 'Cable fly', False, True),
                   kit_row('Hack squat machine', [True], 'Hack squat', False, True)),
               txt('Updates the shared list everyone at Iron Temple sees', 't-m'), h=640, close=False, footer=btn('Add 2 items', 'pri', full=True))
P('P11-Kit-Review.dc.html', 'Seen in your workouts · review sheet', detail(h=844, overlay=REVIEW), row_=2)
P('P11-Kit-Undo.dc.html', 'Kit added · undo in place', detail(h=1500, kit_block=card(row(tile('check', 'ok'), txt('Iron Temple updated · +2', 't-h3', 'flex: 1'), btn('Undo', 'txt', sm=True), gap=10), tone='glass', style='padding: 10px 12px')), h=1500, row_=2)

session_bg = [header('Chest 2', sub='Iron Temple · 42:18'), card(txt('Leg press (45° / horizontal)', 't-h3'), row(tag('Quads · 3', 'neutral'), tag('Glutes · 1', 'neutral'), gap=6))]
TRAY = abs_box(card(row(eqimg('m-leg-press', 38, 38), col(txt('Leg press (45° / horizontal) isn’t on Iron Temple’s list', 't-s'), txt('Seen in 4 sessions here', 't-m'), gap=2, style='flex: 1'),
                        ibtn('x', 'Dismiss', sm=True), btn('Add', 'pri', sm=True), gap=8), tone='glass', style='padding: 8px 8px 8px 10px'), 'left: 12px; right: 12px; bottom: 90px')
P('P11-Kit-Tray.dc.html', 'Live session · kit tray', phone(*session_bg, tabs=None, overlay=TRAY), row_=2)
UNDO = abs_box(card(row(tile('check', 'ok'), txt('Added to Iron Temple', 't-h3', 'flex: 1'), btn('Undo', 'txt', sm=True), gap=10), tone='glass', style='padding: 8px 8px 8px 10px'), 'left: 12px; right: 12px; bottom: 90px')
P('P11-Kit-Tray-Undo.dc.html', 'Live session · added, undo', phone(*session_bg, tabs=None, overlay=UNDO), row_=2)

SEL = sheet(None, row(txt('Selected inventory', 't-h2'), tag('14', 'brass'), gap=8),
            lst(*[li(n, None, eqimg(k, 40, 40, 8), ibtn('x', 'Remove', sm=True)) for n, k in [('Adjustable bench (FID)', 'bench-adjustable'), ('Cable crossover', 'cable-crossover'), ('EZ curl bar', 'barbell-ez'), ('Fixed dumbbells (hex/rubber)', 'dumbbell-fixed'),
                                                                                  ('Flat bench', 'bench-flat'), ('Lat pulldown', 'm-lat-pulldown'), ('Olympic barbell (20 kg)', 'barbell-olympic'), ('Power bar', 'barbell-power')]]),
            btn('Clear all', 'dan', 'trash', full=True), h=700, close=False)
P('P11-Inventory-Selected.dc.html', 'Inventory · selected sheet', detail(h=844, overlay=SEL), row_=2)
P('P11-Inventory-Filter.dc.html', 'Inventory · muscle filter open', phone(brandbar(), eq_board(open_cat='Barbells', filters=True, cats=[('Barbells', '3/8'), ('Benches', '2/4')]), tabs=None, h=1100), h=1100, row_=2)
P('P11-Inventory-Search.dc.html', 'Inventory · search, no match', phone(brandbar(), card(row(span(ico('scale', 16), 'c-dim'), lbl('Inventory'), sp(), tag('14', 'brass'), gap=6),
    txt('Inventory is what you ticked on each gym — nobody audits it. A gym with no inventory set is never flagged as missing anything.', 't-s'),
    row(f'<div style="flex: 1">{field(value="zzz", icon="search", trail=ibtn("x", "Close", sm=True))}</div>', ibtn('filter', 'Filter by muscle', 'fill'), gap=8), txt('—', 't-s'), gap=10), tabs=None), row_=2)
P('P11-Bands-Pick.dc.html', 'Band library · colour picker open', phone(brandbar(), band_card(pick=1, dirty=True), tabs=None, h=844), row_=2)
P('P11-Bands-Saved.dc.html', 'Band library · saved', phone(brandbar(), band_card(saved=True), tabs=None, h=844), row_=2)

# GymPicker (components/GymPicker) — sheet usage; states drawn fully on P03 (P03-GymPicker*)
PICK = sheet('Where are you training?', search('Search for a gym'),
             lst(li(GYM, row(txt("You're here", 't-m'), dot('ok'), txt('06:00–23:00', 't-m'), gap=6), thumb(44, 10), tag('Suggested')),
                 li('Home gym', row(txt('8.4 km', 't-m'), dot('neutral'), txt('Closed', 't-m'), gap=6), thumb(44, 10))),
             lbl('Gyms nearby'), lst(li('Atlet Fitness', '0.6 km · Khreshchatyk St 12', thumb(44, 10), tag('Add', 'neutral')), li('Crossfit Kyiv', '1.4 km · Velyka Vasylkivska St 5', thumb(44, 10), tag('Add', 'neutral'))),
             lst(li('Without a gym', None, tile('pin'))), h=620, close=False)
P('P11-GymPicker.dc.html', 'Which gym? · picker sheet', gyms_screen(*MY, overlay=PICK), row_=2)

# ============================================================== ROW 3 · dialogs, desktop, night
P('P11-Delete.dc.html', 'Delete gym · confirm', detail(h=844, overlay=dialog('Delete “Iron Temple”?', '24 recorded visits go with it and reminders for this place stop. Your workouts are untouched.', 'Delete', 'Keep', top=300)), row_=3)
P('P11-Inventory-Remove.dc.html', 'Remove one item · confirm', detail(h=844, overlay=dialog('Remove from gym?', 'Remove "EZ curl bar" from this gym\'s inventory?', 'Remove', 'Cancel', top=300)), row_=3)
P('P11-Inventory-Clear.dc.html', 'Clear all inventory · confirm', detail(h=844, overlay=dialog('Clear all inventory?', 'Remove all 14 items from this gym\'s inventory? You can undo right after.', 'Clear all', 'Cancel', top=300)), row_=3)
P('P11-Inventory-Undo.dc.html', 'Item removed · undo', detail(h=844, overlay=snack('"EZ curl bar" removed', 'Undo', 22)), row_=3)

sess_rows = [('27 Sep', 'Bench press · Incline dumbbell press · Cable fly · Dips', '6.2 t', '0:58'), ('24 Sep', 'Squat · Romanian deadlift · Leg press (45°)', '8.9 t', '1:12'),
             ('22 Sep', 'Deadlift · Lat pulldown · Seated row', '7.4 t', '1:05'), ('20 Sep', 'Bench press · Overhead press · Lateral raise', '5.8 t', '0:54'), ('17 Sep', 'Squat · Leg curl · Calf raise', '6.6 t', '1:01')]
detail_pane = col(f'<div style="position: relative">{hero_house(260, 72)}{abs_box(col(txt(GYM, "t-d1"), txt(ADDR, "t-s"), gap=4), "left: 22px; bottom: 18px")}</div>',
                  row(btn('Start session here', 'pri', 'play'), btn('Edit', 'sec', 'edit'), gap=10),
                  stats(),
                  card(lbl('Last sessions'), lst(*[li(span(d, 't-h3'), ex, None, col(span(t_, 't-s num'), span(m, 't-m num'), gap=0, style='align-items: flex-end')) for d, ex, t_, m in sess_rows])),
                  card(row(lbl('Map'), sp(), lbl('Route from my location')), route_map(False, 200, w=880)), gap=16)
board('P11-Desktop.dc.html', 'Gyms · desktop list + detail pane', 1440, 1080, desktop(row(
    col(txt('Gyms', 't-h1'), lbl('My gyms'), gym_card(GYM, '0.2 km · ' + ADDR, True), gym_card('Home gym', '8.4 km · Obolonskyi Ave 16'), search('Search for a gym'), *NEARBY, gap=12, style='width: 420px'),
    col(detail_pane, style='flex: 1; min-width: 0'), gap=28, align='flex-start'), 'gyms', 1440, 1080), row_=3)
board('P11-Desktop-Busy.dc.html', 'Gyms · desktop, session running (Start disabled), no sessions here', 1440, 900, desktop(row(
    col(txt('Gyms', 't-h1'), lbl('My gyms'), gym_card(GYM, '0.2 km · ' + ADDR), gym_card('Home gym', '8.4 km · Obolonskyi Ave 16', True), search('Search for a gym'), gap=12, style='width: 420px'),
    col(f'<div style="position: relative">{hero_house(260, 72)}{abs_box(col(txt("Home gym", "t-d1"), txt("Obolonskyi Ave 16, Kyiv", "t-s"), gap=4), "left: 22px; bottom: 18px")}</div>',
        row(btn('Start session here', 'pri', 'play', dis=True), btn('Edit', 'sec', 'edit'), gap=10), txt('No sessions logged here yet', 't-s'),
        card(lbl('Last sessions'), txt('No sessions logged here yet', 't-s')), card(row(lbl('Map'), sp(), lbl('Route from my location')), route_map(False, 200, '50.5012, 30.4981', w=880)), gap=16, style='flex: 1; min-width: 0'),
    gap=28, align='flex-start'), 'gyms', 1440, 900), row_=3)

P('P11-Night-Gyms.dc.html', 'Night · Gyms (live night)', phone(brandbar(), sleephero(dur='6h 48m'), txt('Gyms', 't-h1', 'padding: 0 2px'), *MY, search('Search for a gym'), *NEARBY[:1], lst(result('Atlet Fitness', '0.6 km · Khreshchatyk St 12')),
                                                                tabs='gyms', mood='sky'), row_=3)
P('P11-Night-Detail.dc.html', 'Night · gym detail', phone(brandbar(), sleephero(True, dur='6h 48m'), f'<div style="position: relative">{hero_house(180, 56)}{abs_box(ibtn("back", "Back", "fill"), "left: 10px; top: 10px")}{abs_box(col(txt(GYM, "t-h1"), row(span(ico("pin", 14), "c-mut"), txt(ADDR + " · 0.2 km", "t-s"), gap=6), tag("Inside"), gap=6, style="align-items: flex-start"), "left: 14px; bottom: 12px")}</div>',
        btn('Start session here', 'pri', 'play', full=True), hours_card(), map_card(), tabs=None, mood='sky'), row_=3)
print('ok')
