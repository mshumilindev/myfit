"""P06 · History — 1:1 translation of views/HistoryListView.tsx (+ components/HistoryTimeline.tsx),
SessionView with `past` (past workout · editing a past session · delete flow), views/TraineeSessionView.tsx,
views/ExerciseHistoryView.tsx, views/MuscleHistoryView.tsx. Copy = en.ts; dates = en-US (fmtDayMonth "Sep 28").
Overlays keep the app header (App.tsx .app-brand) and hide the tab bar (showTabbar = !activeOverlay).
See fidelity/P06.md for the board -> source map."""
from kit import *

import glob as _glob, os as _os
for _f in _glob.glob(_os.path.join(OUT, 'P06-*.dc.html')):
    _os.remove(_f)

GYM = 'Iron Temple'


# ============================================================== shell helpers (compose kit only)
def ov(*content, h=844, mood='art', overlay='', night=False):
    """An overlay screen: app header, (SleepHero while a night is live), no tab bar."""
    top = [brandbar()] + ([sleephero()] if night else [])
    return phone(*top, *content, tabs=None, h=h, mood='sky' if night else mood, overlay=overlay)


def ovtop(hero, *content, h=844, mood='art', overlay='', night=False):
    """Overlay whose screen-top is a full-bleed hero bar (past-hero): header, (SleepHero), hero, then the body."""
    sh = f'<div style="padding: 0 16px 10px">{sleephero()}</div>' if night else ''
    return phone(*content, tabs=None, h=h, mood='sky' if night else mood, overlay=overlay, top=brandbar() + sh + hero)


def micon(m, h=30):
    """MuscleIcon variant=row: the app's body figure cropped to the muscle's region, muscle lit."""
    import kit as _k
    v = _k._MM['GROUP_VIEW'][m]; rg = _k._MM['GROUP_REGION'][m]
    return bodymap(v, primary=(m,), region=rg, h=h)


def vbars(vals, tones, h=120, gap=6):
    """Column bars with per-bar colour (the app's .bars: graphite older weeks, accent recent)."""
    mx = max(vals) or 1
    cols = []
    for v, t_ in zip(vals, tones):
        bh = max(4, round(v / mx * h))
        inner = bar(0, 'brass', bh) if t_ == 'track' else bar(100, t_, bh)
        cols.append(f'<div style="flex: 1; height: {h}px; display: flex; flex-direction: column; justify-content: flex-end">{inner}</div>')
    return f'<div style="display: flex; gap: {gap}px; align-items: flex-end">{"".join(cols)}</div>'


def hist_head(title, sub=None, right='', extra=''):
    """.hist-head: back caret · title-26 + sub (+ trailing action)."""
    return row(ibtn('back', 'Back', 'fill', sm=True),
               col(txt(title, 't-h1'), txt(sub, 't-s') if sub else '', extra, gap=4, style='flex: 1; min-width: 0'),
               right, gap=10, align='flex-start')


def abs_(inner, css):
    return f'<div style="position: absolute; {css}">{inner}</div>'


# ============================================================== HistoryTimeline
def trow(time, icon, tone, title, val=None, sub=None, auto=False, chev=True):
    t = span(title, 't-h3') + (span(f' · {val}', 'c-mut') if val else '') + (' ' + tag('auto', 'brass') if auto else '')
    pad = '12px 10px 12px 14px' if sub else '8px 10px 8px 14px'   # .hist-item.is-minor rows are shorter
    return li(t, sub, lead=row(txt(time, 't-m num', 'width: 40px'), tile(icon, tone), gap=8),
              trail=span(ico('chev', 18), 'c-dim') if chev else '', style=f'padding: {pad}')


# day state -> rail node (STATE_GLYPH): trained check · illness pulse · injury bandaids · vacation plane · rest lotus · missed x · logged dot
# node colours (.hist-tl-day.st-*): trained ok · rest rest-400 · vacation #e8933f (amber) · illness --care (teal) · missed danger · logged neutral
NODE = {'trained': ('check', 'ok'), 'illness': ('pulse', 'active'), 'injury': ('bandage', 'injury'), 'vacation': ('send', 'illness'),
        'rest': ('yoga', 'rest'), 'missed': ('x', 'danger')}


def node(state):
    if state == 'logged':
        return col(dot('neutral'), style='width: 36px; height: 20px; align-items: center; justify-content: center')
    i, t_ = NODE[state]
    return tile(i, t_, s=14)


def tday(label, state, rows=(), last=False, tone=''):
    nd = col(node(state), '' if last else '<div class="vl" style="flex: 1; width: 0"></div>', gap=4, style='width: 36px; align-items: center')
    body = col(row(lbl(label), style='min-height: 36px'), (lst(*rows, tone=tone) if rows else ''), gap=6, style='flex: 1; min-width: 0; padding-bottom: 8px')
    return row(nd, body, gap=10, align='stretch')


W_CHEST2 = trow('18:10', 'dumbbell', 'brass', 'Chest 2', sub='0:58 · 18 sets · 5 840 kg')
S_NIGHT = trow('23:40', 'moon', 'sleep', 'Sleep', '7:12', auto=True)

WEEK = [
    tday('Today · Sep 28', 'trained', [S_NIGHT, W_CHEST2], tone='glass'),
    tday('Sun · Sep 27 · Rest day', 'rest', [trow('07:30', 'moon', 'sleep', 'Sleep', '6:48'), trow('10:05', 'run', 'ok', 'Run', '32 min')]),
    tday('Sat · Sep 26', 'trained', [trow('11:20', 'dumbbell', 'brass', 'Legs 1', sub='1:12 · 20 sets · 9 460 kg')]),
    tday('Fri · Sep 25 · Missed', 'missed'),
    tday('Thu · Sep 24', 'trained', [trow('07:40', 'home', 'neutral', 'Home set', sub='0:24 · 9 sets'),
                                     trow('19:02', 'dumbbell', 'brass', 'Back 1', sub='1:05 · 19 sets · 7 120 kg')]),
    tday('Wed · Sep 23 · Sick day', 'illness'),
    tday('Tue · Sep 22 · Full rest', 'vacation', [trow('20:30', 'music', 'sport', 'Dance', '45 min')], last=True),
]


def pager(cur=0, pages=(1, 2, 3, 4, 5, 6)):
    """exl-pager: ‹ · numbered pages (… gaps) · ›"""
    items = [ibtn('back', 'Previous', sm=True) if cur == 0 else ibtn('back', 'Previous', 'fill', sm=True)]
    for p in pages:
        items.append(span('…', 't-s c-dim') if p is None else chip(str(p), on=(p == cur + 1)))
    items.append(ibtn('chev', 'Next', 'fill', sm=True))
    return row(*items, gap=6, justify='center', style='padding: 4px 0')


# ============================================================== ROW 0 · History list
P('P06-History.dc.html', 'History · all sessions (scroll)', ov(
    hist_head('History', '42 sessions'),
    *WEEK, pager(0), h=1180), h=1180)


# ============================================================== past workout (SessionView past)
def past_hero(title='Chest 2', gym=GYM, mode='edit', home=False):
    """session-top.past-hero: slim 72 px full-bleed bar — gym photo (GymThumb, runtime) or home-hero.webp under a frosted scrim;
    back · title + gym row (pin · name · pencil) · trash + Save | Reopen (auto-closed)."""
    right = row(ibtn('trash', 'Delete workout', sm=True), btn('Save', 'pri', sm=True), gap=4) if mode == 'edit' else btn('Reopen', 'sec', sm=True)
    gym_row = (row(ico('home', 13), txt('Home set', 't-m c-mut'), gap=5) if home else
               row(ico('pin', 13), txt(gym if gym else 'Add gym', 't-m c-mut'), span(ico('edit', 13), 'c-dim'), gap=5))
    bg = img('home-hero.webp', '100%', 72, 0) if home else photo('100%', 72, 0, '')
    return (f'<div class="lhero" style="height: 72px"><div style="position: absolute; inset: 0">{bg}</div><div class="scr2"></div>'
            f'<div style="position: absolute; inset: 0; display: flex; align-items: center; gap: 8px; padding: 0 12px 0 6px">'
            f'{ibtn("back", "Back", sm=True)}{col(txt(title, "t-h2"), gym_row, gap=2, style="flex: 1; min-width: 0")}{right}</div></div>')


def datebar(t='Monday, September 28, 2026 · 18:10 → 19:08'):
    return txt(t, 't-l c-dim', 'padding: 0 2px')


GKEY = {'Chest': 'chest', 'Triceps': 'triceps', 'Shoulders': 'shoulders', 'Biceps': 'biceps', 'Glutes': 'glutes', 'Core': 'core', 'Quads': 'quads', 'Back': 'back'}


def mtag(name, n=None, primary=True):
    """MuscleSetChip / MuscleChip (chipFig): the body-figure crop with the muscle lit + name (· set count). Primary = accent, secondary = grey."""
    g = GKEY.get(name)
    fig = bodymap(_mm('GROUP_VIEW')[g], primary=(g,) if primary else (), secondary=() if primary else (g,), region=_mm('GROUP_REGION')[g], h=24) if g else ''
    lab = f'{name} <span class="num c-dim">· {n}</span>' if n is not None else name
    return f'<span class="chip{" on" if primary else ""}" style="height: 32px; padding: 0 12px 0 6px">{fig}{lab}</span>'


def _mm(k):
    import kit as _k
    return _k._MM[k]


def worked(chips=(('Chest', 11, True), ('Triceps', 10, True), ('Shoulders', 5.5, False))):
    return col(lbl('Muscle groups worked'), row(*[mtag(a, b, c) for a, b, c in chips], gap=6, wrap=True), gap=6)


def targets(items=(('Chest', True), ('Triceps', True), ('Biceps', False))):
    return col(lbl('Program targets'), row(*[tag(m, 'ok' if d else 'bad', 'check' if d else 'x') for m, d in items], gap=6, wrap=True), gap=8)


def pcard(name, summary=None, cur=False):
    """past-ex-card (collapsed): name · top-set summary · gear (card-cfg → menu sheet)."""
    return card(row(txt(name, 't-h3', 'flex: 1; min-width: 0'), txt(summary, 't-s num') if summary else '', ibtn('gear', 'Menu', sm=True), gap=8),
                style='padding: 4px 4px 4px 16px')


PAST_CARDS = [pcard('Warm-up', 'Warm-up'), pcard('Bench press', '5 × 5 · 100 kg'), pcard('Incline dumbbell press', '3 × 10 · 32 kg'),
              pcard('Cable fly', '3 × 12 · 20 kg'), pcard('Dips', '3 × 12 · BW'), pcard('Triceps pushdown', '4 × 12 · 35 kg')]


def energy(k='~412'):
    """EnergyPlaque: blue flame · ~kcal"""
    return card(row(tile('flame', 'kcal', lg=True), txt(f'{k}<span class="t-m"> kcal</span>', 't-num num c-kcal'), gap=14), tone='kcal', style='padding: 12px 16px')


def past_tail(share=True, mmap=True, note=False):
    out = [energy()]
    if note:
        out.append(card(row(span(ico('progress', 18), 'c-dim'), txt('In Progress and in an exercise’s own history each lift is counted separately — a superset is how you performed it, not what you performed. Volume, records and 1RM estimates are unaffected.', 't-s', 'flex: 1'), gap=10, align='flex-start'), style='padding: 12px 14px'))
    out.append(btn('Add exercise to this session', 'sec', 'plus', sm=True, full=True))
    if mmap:
        out.append(btn('Muscle map', 'sec', 'body', sm=True, full=True))
    if share:
        out.append(btn('Share workout', 'pri', 'share', full=True, style='height: 54px'))
    return out


def past_screen(*body, h=1320, overlay='', night=False, hero=None, date=None, chips=True, tg=True, chipset=None):
    top = [datebar(date) if date else datebar()]
    if chips:
        top.append(worked(chipset) if chipset else worked())
    if tg:
        top.append(targets())
    return ovtop(hero or past_hero(), *top, *body, h=h, overlay=overlay, night=night)


P('P06-Past-Workout.dc.html', 'Past workout · Chest 2 (scroll)', past_screen(*PAST_CARDS, *past_tail(), h=960), h=960)


# -- editing a past session: expanded card (renderCard, classic view) + GhostSetRow with Add
def rest_line(t):
    return txt(t, 't-m', 'padding: 6px 16px 0 48px')


def srow(idx, reps, kg, kind, tone=None):
    c = 'c-dim' if kind == 'warm-up' else ('c-ok' if tone == 'ok' else '')
    cells = row(span(reps, f'num {c}', 'width: 64px'), span(kg, f'num {c}', 'width: 64px'), gap=10)
    tr = tag('record', 'ok', 'trophy') if kind == 'record' else span(kind, 't-m')
    return li(cells, None, span(str(idx), f'num t-h3 {"c-ok" if tone == "ok" else "c-dim"}', 'width: 22px'), tr, style='min-height: 46px')


def set_head(c2='Reps', c3='Kg'):
    return row(span('#', 't-l', 'width: 22px'), span(c2, 't-l', 'width: 64px'), span(c3, 't-l', 'width: 64px'), gap=10, style='padding: 6px 16px 4px')


def ghost_add(reps='5', kg='100'):
    """GhostSetRow isPast: steppers Reps / Weight, kg · set options · Add (no failure flame on a past session)."""
    stp = grid(stepper(reps, '', 'Reps'), stepper(kg, '', 'Weight, kg'), cols=2, gap=10)
    acts = row(ibtn('sliders', 'Set options', 'fill'), btn('Add', 'pri', style='flex: 1; height: 54px'), gap=10)
    return f'<div style="padding: 8px 10px 10px">{card(stp, acts, tone="hero", gap=14, style="padding: 14px")}</div>'


def ex_head(name, prev=None, plan=None):
    return row(span(ico('drag', 18), 'c-dim'), txt(name, 't-h2', 'flex: 1; min-width: 0'), txt(prev, 't-m') if prev else '',
               tag(plan, 'ok' if plan.split('/')[0].strip() == plan.split('/')[1].strip() else 'neutral') if plan else '', ibtn('gear', 'Menu', sm=True), gap=8, style='padding: 12px 8px 6px 12px')


def ex_chips(muscles=(('Chest', 5, True), ('Triceps', 2.5, False), ('Shoulders', 2.5, False))):
    return row(ibtn('dumbbell', 'Equipment', 'pri', sm=True), *[mtag(a, b, c) for a, b, c in muscles], gap=6, wrap=True, style='padding: 2px 14px 8px')


BENCH = [rest_line('Rest 3:40'), srow(1, '8', '60', 'warm-up'), rest_line('Rest 1:45'), srow(2, '3', '80', 'warm-up'),
         rest_line('Rest 2:30'), srow(3, '5', '97.5', 'working'), rest_line('Rest 2:41'), srow(4, '5', '100', 'record', 'ok'),
         rest_line('Rest 3:05'), srow(5, '5', '100', 'working')]
bench_open = card(ex_head('Bench press', 'prev 97.5 × 5', '5 / 5'), ex_chips(), set_head(), *BENCH, ghost_add(), tone='glass', pad=False, gap=0)

P('P06-Past-Edit.dc.html', 'Editing a past session · card open (scroll)', past_screen(
    PAST_CARDS[0], bench_open, *PAST_CARDS[2:], *past_tail(), h=1600), h=1600)


# ============================================================== TraineeSessionView (trainer / admin only)
def tcard(name, rows, sides=False, round_=False):
    head = row(txt(name, 't-h3', 'flex: 1; min-width: 0'), tag('×2 per hand', 'neutral') if sides else '', gap=8, style='padding: 12px 14px 4px 16px')
    return card(head, set_head(), *rows, pad=False, gap=0)


def trow_set(idx, reps, kg, kind):
    cells = row(span(reps, 'num', 'width: 64px'), span(kg, 'num', 'width: 64px'), gap=10)
    return li(cells, None, span(idx, 'num t-h3 c-dim', 'width: 26px'), span(kind, 't-m'), style='min-height: 44px')


def drops(parts, foot, one):
    """drops rail: drop n rows + foot 'n drops · reps' / 'kg in one set'"""
    rows_ = ''.join(row(span('', '', 'width: 26px'), span(r, 'num t-s', 'width: 64px'), span(k, 'num t-s', 'width: 64px'), span(f'drop {i + 1}', 't-m'), gap=10, style='padding: 3px 16px') for i, (r, k) in enumerate(parts))
    return col(rows_, row(txt(foot, 't-m'), sp(), txt(one, 't-m'), style='padding: 4px 16px 8px 52px'), gap=0)


def ss_block(letter, meta, cards):
    return card(row(tag(f'Superset {letter}', 'brass'), txt(meta, 't-s'), gap=8), *cards, tone='glass', gap=10, style='padding: 12px')


def circuit_card(letter='A', rows_=()):
    head = row(tile('rotate', 'brass'), col(lbl(f'Circuit {letter}', 'brass'), txt('3 exercises · 3 rounds', 't-s'), gap=2, style='flex: 1'), gap=10)
    out = [head]
    for slot, name, cnt, plates in rows_:
        pl = row(*[card(txt(f'R{i + 1}', 't-m'), txt(v, 't-s num'), tone='' if v == '—' else 'glass', gap=2, style='padding: 6px 8px; flex: 1; align-items: center') for i, v in enumerate(plates)], gap=6)
        out.append(col(row(tag(slot, 'brass'), txt(name, 't-h3', 'flex: 1'), txt(cnt, 't-s num'), gap=8), pl, gap=6))
    return card(*out, gap=12)


trainee_body = [
    tcard('Bench press', [trow_set('1', '8', '60', 'warm-up'), rest_line('Rest 2:30'), trow_set('2', '5', '90', 'working'),
                          rest_line('Rest 2:45'), trow_set('3', '5', '92.5', 'working'), rest_line('Rest 3:00'), trow_set('4', '8', '80', 'drop'),
                          drops([('6', '60'), ('5', '40')], '3 drops · 19 reps', '1 140 kg in one set')]),
    ss_block('A', '3 rounds', [
        tcard('Incline dumbbell press', [trow_set('R1', '10', '26', 'working'), rest_line('Rest 1:30'), trow_set('R2', '10', '26', 'working'), rest_line('Rest 1:30'), trow_set('R3', '9', '26', 'working')], sides=True),
        tcard('Cable fly', [trow_set('R1', '12', '15', 'working'), rest_line('Rest 1:20'), trow_set('R2', '12', '15', 'working'), rest_line('Rest 1:20'), trow_set('R3', '12', '15', 'working')]),
    ]),
    tcard('Dips', [trow_set('1', '12', 'BW', 'working'), rest_line('Rest 1:40'), trow_set('2', '10', 'BW', 'working'), rest_line('Rest 1:40'), trow_set('3', '10', 'BW', 'S-D')]),
    circuit_card('A', [('A1', 'Push-up', '3/3', ['15', '15', '12']), ('A2', 'Plank', '3/3', ['1', '1', '1']), ('A3', 'Kettlebell swing', '2/3', ['15×16', '15×16', '—'])]),
]
P('P06-Trainee-Session.dc.html', 'Trainee session · Trainer (scroll)', ov(
    hist_head('Anna', 'Sep 27 · 16 sets · 4.9 t · 5 exercises · 1:04'), *trainee_body, h=1760), h=1760)


# ============================================================== ExerciseHistoryView
def stat_grid(*cells):
    """.stat-grid: value over label, no chrome (record value in ok green)."""
    return grid(*[col(txt(v, f't-num num {c}'), lbl(l), gap=4) for v, l, c in cells], cols=len(cells), gap=8, style='padding: 2px 2px 4px')


def tbl(head, rows_):
    cols_ = len(head)
    h = row(*[span(x, 't-l', 'flex: 1') for x in head], gap=10, style='padding: 10px 16px 6px')
    rs = ''.join(f'<div class="li" style="min-height: 44px">{"".join(span(x, "t-s num c-mut" if i else "t-s", "flex: 1") for i, x in enumerate(r))}</div>' for r in rows_)
    return f'<div class="card">{h}{rs}</div>'


def chart_card(vals, left, right, tone='brass', hero=True):
    """chart-card: accent polyline, green dot on the latest point; min kg · record axis line."""
    return card(spark(vals, 326, 130, tone), row(txt(left, 't-m'), sp(), txt(right, 't-s c-ok')), tone='hero' if hero else '', gap=8, style='padding: 16px 14px 12px')


EX_CHIPS = row(mtag('Chest'), mtag('Triceps', primary=False), mtag('Shoulders', primary=False), tag('Barbell', 'neutral', 'dumbbell'), tag('Bench', 'neutral', 'dumbbell'), gap=6, wrap=True)
WCDI = col(section('Where you can do it'),
           lst(li(GYM, None, span(ico('check', 18, w=2.2), 'c-ok'), txt('barbell · bench', 't-s')),
               li('Home', None, span(ico('warn', 18), 'c-bad'), txt('No bench', 't-s c-bad')), tone='quiet'),
           row(span(ico('info', 14), 'c-dim'), txt('Inventory is what you ticked on each gym — nobody audits it. A gym with no inventory set is never flagged as missing anything.', 't-m', 'flex: 1'), gap=8, align='flex-start'), gap=6)
LAST_SESS = tbl(['Date', 'Top set', 'Volume'], [['Sep 28', '100 × 5', '2 105 kg'], ['Sep 21', '100 × 4', '1 980 kg'], ['Sep 14', '97.5 × 5', '1 950 kg'],
                                              ['Sep 7', '97.5 × 4', '1 870 kg'], ['Aug 31', '95 × 5', '1 845 kg'], ['Aug 24', '95 × 4', '1 790 kg']])

P('P06-Exercise-History.dc.html', 'Exercise history · Bench press (scroll)', ov(
    hist_head('Bench press', right=btn('Details', 'sec', 'book', sm=True), extra=EX_CHIPS),
    stat_grid(('100', 'Record kg', 'c-ok'), ('117', 'Est. 1RM', ''), ('100', 'Last top', '')),
    WCDI,
    col(section('Top set · 12 weeks'), chart_card([85, 87.5, 87.5, 90, 90, 92.5, 92.5, 95, 95, 97.5, 97.5, 100], '85 kg', '100 kg · record', 'brass'), gap=8),
    col(section('Last sessions'), LAST_SESS, gap=6), h=1100), h=1100)


# ============================================================== MuscleHistoryView
def mh_title(m='Chest', sub='24 sessions · since Mar 2'):
    return row(ibtn('back', 'Back', 'fill', sm=True), micon('chest', 44), col(txt(f'{m} history', 't-h1'), txt(sub, 't-s'), gap=2, style='flex: 1; min-width: 0'), gap=10)


def rec_row(name, v, n):
    return li(name, None, None, row(txt(v, 't-s num'), span(n, 'num t-m', 'width: 24px; text-align: right'), gap=10), chev=True)


def recent_row(d, names, stats):
    return li(names, stats, span(d, 't-s num', 'width: 48px'), span(ico('external', 16), 'c-dim'))


P('P06-Muscle-History.dc.html', 'Muscle history · Chest (scroll)', ov(
    mh_title(),
    stat_grid(('28.4 t', 'Volume', ''), ('212', 'Sets', ''), ('Sep 28', 'Last session', '')),
    card(lbl('Weekly volume'), vbars([2.1, 2.6, 1.8, 2.9, 2.4, 3.0, 2.2, 3.1, 3.3, 2.9], ['track'] * 5 + ['brass'] * 5, 140), tone='hero', gap=12, style='padding: 16px'),
    col(section('Top exercises'), lst(rec_row('Bench press', '10 520 kg', '58'), rec_row('Incline dumbbell press', '6 140 kg', '42'), rec_row('Cable fly', '3 880 kg', '39'),
                                      rec_row('Dips', '2 950 kg', '31'), rec_row('Triceps pushdown', '2 610 kg', '28'), rec_row('Machine chest press', '1 940 kg', '14')), gap=6),
    col(section('Last sessions'), lst(recent_row('Sep 28', 'Bench press · Incline dumbbell press · Cable fly · Dips', '14 sets · 4 720 kg'),
                                      recent_row('Sep 21', 'Bench press · Incline dumbbell press · Cable fly', '11 sets · 4 390 kg'),
                                      recent_row('Sep 14', 'Bench press · Dips · Cable fly', '12 sets · 4 105 kg'),
                                      recent_row('Sep 7', 'Bench press · Incline dumbbell press', '8 sets · 3 460 kg'),
                                      recent_row('Aug 31', 'Machine chest press · Cable fly · Dips', '10 sets · 2 980 kg')), gap=6),
    h=1250), h=1250)


# ============================================================== ROW 1 · states
P('P06-History-Empty.dc.html', 'History · no history yet', ov(
    hist_head('History', '0 sessions'), txt('No history yet', 't-s', 'padding: 4px 2px')), row_=1)

P('P06-History-Page.dc.html', 'History · page 4 of 9 (pager window)', ov(
    hist_head('History', '42 sessions'),
    tday('Mon · Aug 31', 'trained', [trow('18:04', 'dumbbell', 'brass', 'Chest 2', sub='0:56 · 17 sets · 5 610 kg')]),
    tday('Sun · Aug 30 · Rest day', 'rest'),
    tday('Sat · Aug 29', 'trained', [trow('10:48', 'dumbbell', 'brass', 'Legs 1', sub='1:09 · 19 sets · 9 020 kg')]),
    tday('Fri · Aug 28 · Injury & rehab', 'injury'),
    tday('Thu · Aug 27', 'logged', [trow('08:15', 'yoga', 'rest', 'Mobility', '20 min'), trow('14:10', 'sun', 'sleep', 'Nap', '0:35'), trow('20:00', 'flame', 'rest', 'Sauna', '25 min')]),
    tday('Wed · Aug 26 · Missed', 'missed'),
    tday('Tue · Aug 25', 'trained', [trow('19:20', 'dumbbell', 'brass', 'Back 1', sub='1:02 · 18 sets · 6 890 kg')], last=True),
    pager(3, (1, None, 3, 4, 5, None, 9)), h=960), h=960, row_=1)

P('P06-History-Night.dc.html', 'History · night mode', ov(
    hist_head('History', '42 sessions'), *WEEK[:4], h=1080, night=True), h=1080, row_=1)

P('P06-Past-Night.dc.html', 'Past workout · night mode', past_screen(*PAST_CARDS[:4], h=1080, night=True), h=1080, row_=1)

P('P06-Past-Auto.dc.html', 'Past workout · closed automatically', past_screen(
    card(row(tile('clock', 'brass'), txt('Auto-closed after 8 hours — may be incomplete. Anything added here saves to the original date.', 't-s', 'flex: 1'), gap=12), tone='glass', style='padding: 12px 14px'),
    *PAST_CARDS[1:4], *past_tail(), hero=past_hero(mode='auto'), date='Closed automatically', tg=False, h=900), h=900, row_=1)


def home_screen():
    return past_screen(pcard('Push-up', '3 × 15 · BW'), pcard('Plank', '3 × 1 · BW'), pcard('Glute bridge', '3 × 20 · BW'), *past_tail(),
                       hero=past_hero('Morning set', home=True), date='Thursday, September 24, 2026 · 07:40 → 08:04', tg=False, h=860,
                       chipset=(('Chest', 3, True), ('Triceps', 1.5, False), ('Glutes', 3, True), ('Core', 3, True)))


P('P06-Past-Home.dc.html', 'Past workout · home set', home_screen(), h=860, row_=1)

ss_past = card(row(tag('Superset A', 'neutral'), txt('3 rounds · 1 740 kg', 't-s'), gap=8),
               lst(li('Incline dumbbell press', None, tag('A1', 'brass'), txt('3 × 10 · 32 kg', 't-s num')),
                   li('Cable fly', None, tag('A2', 'brass'), txt('3 × 12 · 20 kg', 't-s num'))), tone='glass', gap=10, style='padding: 12px')
P('P06-Past-Superset.dc.html', 'Past workout · superset (collapsed) + note', past_screen(
    PAST_CARDS[1], ss_past, *PAST_CARDS[4:], *past_tail(note=True), tg=False, h=1110), h=1110, row_=1)

cb_past = card(row(tile('rotate', 'brass'), col(row(txt('Circuit A', 't-h3'), txt('·', 't-m'), txt('done', 't-m c-ok'), gap=6), txt('3 exercises · 3 rounds', 't-m'), gap=2, style='flex: 1'),
                   txt('1.2 t', 't-h3 num'), ibtn('up', 'Collapse', sm=True), gap=10),
               lbl('What you did'),
               *[col(row(tag(sl, 'brass'), txt(n, 't-s', 'flex: 1'), txt(c, 't-m num'), gap=8),
                     row(*[card(txt(f'R{i + 1}', 't-m'), txt(v, 't-s num'), tone='' if v == '—' else 'glass', gap=2, style='padding: 6px 8px; flex: 1; align-items: center') for i, v in enumerate(p)], gap=6), gap=6)
                 for sl, n, c, p in [('A1', 'Push-up', '3/3', ['15', '15', '12']), ('A2', 'Kettlebell swing', '3/3', ['15×16', '15×16', '12×16']), ('A3', 'Plank', '2/3', ['1', '1', '—'])]],
               gap=12)
P('P06-Past-Circuit.dc.html', 'Past workout · circuit (summary)', past_screen(
    PAST_CARDS[1], cb_past, *PAST_CARDS[4:5], *past_tail(), tg=False, h=1080), h=1080, row_=1)

P('P06-Past-Empty.dc.html', 'Past session · no exercises yet (backfill)', past_screen(
    card(col(tile('list', 'brass', lg=True), txt('No exercises yet', 't-h3', 'text-align: center'),
             txt('Add the first one — recent lifts and your whole history come up as you type.', 't-s', 'text-align: center; max-width: 280px'),
             btn('Add exercise', 'pri', 'plus', full=True), btn('Discard session', 'dan', 'trash', full=True), gap=10, style='align-items: center; padding: 22px 6px'), tone='dash'),
    hero=past_hero('Sep 28'), date='Monday, September 28, 2026 · 18:10 → 19:08', chips=False, tg=False, h=844), row_=1)

P('P06-Trainee-Loading.dc.html', 'Trainee session · loading · Trainer', ov(hist_head('Anna'), txt('…', 't-s', 'padding: 4px 2px')), row_=1)
P('P06-Trainee-Error.dc.html', 'Trainee session · failed · Trainer', ov(hist_head('View recap'), txt('Failed to fetch', 't-s', 'padding: 4px 2px')), row_=1)

P('P06-Exercise-History-Few.dc.html', 'Exercise history · not enough data', ov(
    hist_head('Zercher squat', '1 session', right=btn('Details', 'sec', 'book', sm=True)),
    stat_grid(('120', 'Record kg', 'c-ok'), ('135', 'Est. 1RM', ''), ('120', 'Last top', '')),
    empty('Not enough to draw a line', "Three sessions and the trend appears here. One point isn't a trend.", 'chart'),
    col(section('Last sessions'), tbl(['Date', 'Top set', 'Volume'], [['Sep 26', '120 × 5', '1 800 kg']]), gap=6), h=900), h=900, row_=1)

P('P06-Exercise-History-Client.dc.html', 'Exercise history · a client’s lift · Trainer', ov(
    hist_head('Bench press', 'Anna', right=btn('Details', 'sec', 'book', sm=True), extra=EX_CHIPS),
    stat_grid(('70', 'Record kg', 'c-ok'), ('82', 'Est. 1RM', ''), ('67.5', 'Last top', '')),
    col(section('Top set · 12 weeks'), chart_card([55, 57.5, 57.5, 60, 62.5, 62.5, 65, 67.5, 70, 67.5], '55 kg', '70 kg · record'), gap=8),
    col(section('Last sessions'), tbl(['Date', 'Top set', 'Volume'], [['Sep 27', '67.5 × 5', '1 320 kg'], ['Sep 20', '70 × 3', '1 260 kg'], ['Sep 13', '67.5 × 5', '1 290 kg'],
                                                                 ['Sep 6', '65 × 5', '1 240 kg'], ['Aug 30', '62.5 × 6', '1 180 kg'], ['Aug 23', '62.5 × 5', '1 120 kg']]), gap=6),
    h=1120), h=1120, row_=1)

# ============================================================== ROW 2 · sheets & undo
menu = sheet(None,
             lbl('Bench press · 5 sets'),
             lst(li('Replace exercise', None, span(ico('swap', 18), 'c-dim')), li('Duplicate with sets', None, span(ico('layers', 18), 'c-dim')),
                 li('Superset with…', None, span(ico('list', 18), 'c-dim')), li('Details', None, span(ico('info', 18), 'c-dim')),
                 li('Open history', None, span(ico('progress', 18), 'c-dim')), li('Clear all sets', None, span(ico('x', 18), 'c-dim'))),
             lst(li('Delete exercise', None, span(ico('trash', 18), 'c-bad'), tone='bad')),
             h=520, close=False)
P('P06-Past-Menu.dc.html', 'Past session · exercise menu (gear)', past_screen(*PAST_CARDS, h=844, overlay=menu), row_=2)

P('P06-Past-Cleared.dc.html', 'Past session · sets cleared · undo', past_screen(
    PAST_CARDS[0], card(ex_head('Bench press', 'prev 97.5 × 5', '0 / 5'), ex_chips(), ghost_add(), pad=False, gap=0), *PAST_CARDS[2:4], h=844, overlay=snack('“Bench press” deleted · 5 sets', 'Undo', 24)), row_=2)

# ============================================================== ROW 3 · dialogs
P('P06-Delete-Workout.dc.html', 'Delete this workout? · confirm', past_screen(*PAST_CARDS, h=844,
    overlay=dialog('Delete this workout?', 'Sep 28, 18 sets, 5 840 kg. It disappears from every device on the next sync and cannot be undone.', 'Delete', 'Keep', top=280)), row_=3)

P('P06-Discard-Backfill.dc.html', 'Discard session · empty backfill', past_screen(
    empty('No exercises yet', 'Add the first one — recent lifts and your whole history come up as you type.', 'list', None),
    hero=past_hero('Sep 28'), chips=False, tg=False, h=844,
    overlay=dialog('Delete this workout?', 'Sep 28, 0 sets, 0 kg. It disappears from every device on the next sync and cannot be undone.', 'Delete', 'Keep', top=280)), row_=3)
print('ok')
