"""P08 · Plan & programs — 1:1 translation of views/ProgramsView.tsx (+ components/ProgramsTabs → OverviewBack),
views/programs/{ProgramBuilder, DayEditor, AssigneesSheet, pieces}.tsx, views/ProgramCsvDialog.tsx,
views/ProgramAssignDialog.tsx, views/PlaybookView.tsx (TemplatesView is a re-export of it), and the
"Suggest a program" seed hand-over from TodayView. Every label is an en.ts string; see fidelity/P08.md."""
from kit import *

import glob as _glob, os as _os
for _f in _glob.glob(_os.path.join(OUT, 'P08-*.dc.html')):
    _os.remove(_f)

PROG = 'Upper/Lower 4×'
WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
WDF = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']


# ============================================================== helpers (compose kit only)
def absb(inner, css):
    return f'<div style="position: absolute; {css}">{inner}</div>'


def rel(inner, *over, style=''):
    return f'<div style="position: relative; {style}">{inner}{"".join(over)}</div>'


def scrim():
    return '<div class="scrim"></div>'


def ph(*c, h=844, overlay='', mood='art', tabs='overview'):
    return phone(*c, tabs=tabs, h=h, overlay=overlay, mood=mood)


def ovback():
    """components/OverviewBack — '‹ Overview'"""
    return row(btn('Overview', 'txt', 'back', style='padding: 0; height: 36px'), style='margin: -4px 0 -6px')


MKEY = {'Chest': 'chest', 'Back': 'back', 'Lats': 'lats', 'Traps': 'traps', 'Lower back': 'lower_back', 'Shoulders': 'shoulders', 'Neck': 'neck', 'Biceps': 'biceps',
        'Triceps': 'triceps', 'Forearms': 'forearms', 'Quads': 'quads', 'Hamstrings': 'hamstrings', 'Glutes': 'glutes', 'Adductors': 'adductors', 'Abductors': 'abductors',
        'Calves': 'calves', 'Core': 'core', 'Full body': 'fullbody'}


def status_lbl(s):
    """.pg-status — 11 px uppercase word: active = emerald, draft = brass, archived = grey (no pill)."""
    return {'active': txt('Active', 't-l c-ok'), 'draft': txt('Draft', 't-l c-brass'), 'archived': txt('Archived', 't-l c-dim')}[s]


status_tag = status_lbl


def avstack(names, more=0):
    """pieces.AvatarStack (max 3 overlapping 30 px + '+n')"""
    avs = ''.join(f'<span style="margin-left: {0 if i == 0 else -8}px">{avatar(n[0], 30)}</span>' for i, n in enumerate(names))
    return row(avs, tag(f'+{more}', 'neutral') if more else '', gap=6)


def pg_tile(status, name, meta, members=None, coach=False):
    """.pg-tile (one column on phone): status · 20 px name · meta; coach: members button bottom-right (avatars or 'Assign')."""
    main = col(status_lbl(status), txt(name, 't-h2 c-dim' if status == 'archived' else 't-h2'), txt(meta, 't-s'), gap=4, style='flex: 1; min-width: 0')
    right = (avstack(*members) if members else row(ico('users', 16), txt('Assign', 't-s c-brass'), gap=6)) if coach else ''
    return card(row(main, right, gap=8, align='flex-end'), style='padding: 16px', gap=0, tone='quiet' if False else '')


def my_prog(kind='mine'):
    """ProgramsView myProgram (.pg-mine, accent border) — the focal block of the home: skeleton / empty / assigned."""
    if kind == 'loading':
        return card('<div class="sk" style="height: 14px; width: 40%"></div>', '<div class="sk" style="height: 24px; width: 70%"></div>', '<div class="sk" style="height: 12px; width: 50%"></div>', gap=10, style='height: 104px')
    if kind == 'empty':
        return card(txt('No program assigned', 't-h3'), txt('Build your own week, or wait for a trainer to assign one.', 't-s'), gap=4, style='padding: 16px')
    by = txt('Mine', 't-s') if kind == 'mine' else row(avatar('O', 22), txt('by Oleh', 't-s'), gap=6)
    return card(row(txt('Active · week 3 of 8', 't-l c-ok'), sp(), by, gap=8), txt(PROG, 't-d1'), txt('8 weeks · 4 days a week', 't-s'), tone='hero', gap=6, style='padding: 18px')


def home_actions():
    """.pg-home-actions.mob — Import CSV (outlined pg-sec) + New program (primary), both 56 px."""
    return row(btn('Import CSV', 'sec', 'upload', style='flex: 1; height: 56px'), btn('New program', 'pri', 'plus', style='flex: 1; height: 56px'), gap=10)


def home(role='member', mine='mine', state='filled', archived_open=False, extra=()):
    coach = role != 'member'
    if coach:
        tiles = [pg_tile('active', PROG, '8 weeks · 4 days a week', (['Anna', 'Oleh', 'Iryna'], 1) if role == 'admin' else (['Anna', 'Oleh'], 0), coach=True),
                 pg_tile('draft', 'Push Pull Legs', '6 weeks · 3 days a week', None, coach=True),
                 pg_tile('active', 'Strength block', 'Ongoing · 3 days a week', (['Marek'], 0) if role == 'admin' else (['Iryna'], 0), coach=True)]
        if archived_open:
            tiles.append(pg_tile('archived', 'Summer cut', '6 weeks · 5 days a week', None, coach=True))
        count = '4' if archived_open else '3'
    else:
        tiles = [pg_tile('active', PROG, '8 weeks · 4 days a week'), pg_tile('draft', 'Home 3-day', '4 weeks · 3 days a week')]
        if archived_open:
            tiles.append(pg_tile('archived', 'Summer cut', '6 weeks · 5 days a week'))
        count = '3' if archived_open else '2'
    created = [row(lbl('Created by me'), sp(), txt(count, 't-l c-dim') if state not in ('loading', 'failed') else '', gap=8, style='padding: 0 2px')]
    if state == 'failed':
        created.append(card(row(span(ico('warn', 18), 'c-bad'), txt('Retry', 't-h3'), gap=10), style='padding: 16px'))
    elif state == 'loading':
        created.append(skel_rows(3))
    elif state == 'empty':
        created.append(txt('No programs yet — create one and assign it to a client.', 't-s', 'padding: 14px 0'))
    else:
        created.append(col(*tiles, gap=10))
        created.append(row(btn('Hide archived' if archived_open else 'Archived · 1', 'txt', 'layers', sm=True, style='padding: 0')))
    return [ovback(), txt('Programs', 't-d1'), *extra, col(lbl('My program'), my_prog(mine), gap=10), col(*created, gap=10), sp(h=4), home_actions()]


# ------------------------------------------------------------- builder pieces
def topbar(title='', menu=False, discard=True, back=True):
    """.pg-top: back · muted 15 px title · discard × · ⋯"""
    acts = row(ibtn('x', 'Discard', 'fill', sm=True) if discard else '', ibtn('more', 'Program options', 'fill', sm=True) if menu else '', gap=6)
    return row(ibtn('back', 'Back', 'fill', sm=True), txt(title, 't-s', 'flex: 1; text-align: center; white-space: nowrap; overflow: hidden'), acts if (discard or menu) else sp(w=36), gap=10, style='height: 48px')


def big_name(name, ph_='e.g. Upper / Lower 4×', size='t-d1'):
    """.pg-name / .pg-day-name: 30 px bold input with a brass underline."""
    return col(txt(name or ph_, size + ('' if name else ' c-dim')), bar(100, 'brass', 2), gap=8)


def big_stepper(v, unit):
    """.pg-stepper.big: 84 px buttons, 96 px number."""
    b = lambda i, l: ibtn(i, l, 'fill', style='width: 84px; height: 84px; border-radius: 22px')
    return row(b('minus', 'Fewer weeks'), col(txt(v, 't-hero num', 'font-size: 96px' if False else ''), txt(unit, 't-s'), gap=4, style='align-items: center'), b('plus', 'More weeks'), gap=10, justify='space-between')


def basics(name='', weeks='8', ongoing=False, ro=False):
    wk = row(txt('∞', 't-hero'), txt('Ongoing', 't-b c-mut'), gap=12) if ongoing else big_stepper(weeks, 'weeks')
    return col(col(lbl('Program name'), big_name(name), gap=12), col(lbl('Weeks'), wk, card(row(txt('No end date', 't-b', 'flex: 1'), toggle(ongoing), gap=10), style='padding: 16px 18px'), gap=12), gap=28)


def start_from():
    t = lambda l, i: card(row(span(ico(i, 20), 'c-brass'), txt(l, 't-h3'), gap=10), style='padding: 0 16px; height: 60px; justify-content: center; flex: 1', gap=0)
    return col(lbl('Or start from'), row(t('Import CSV', 'upload'), t('Duplicate', 'layers'), gap=10), gap=10)


def cta(label, dis=False, kind='pri'):
    return btn(label, kind, full=True, dis=dis, style='height: 56px; font-size: 17px')


WEEK_UL = {1: 'Upper A', 2: 'Lower A', 4: 'Upper B', 5: 'Lower B'}


def week_tiles(days=WEEK_UL, partial=()):
    """.pg-week: 2-column big tiles (108 px): weekday + dot switch; on = brass-edged tile with a 20 px day name, off = grey 'Rest'; last cell = 40 px count."""
    cells = []
    for d in range(1, 8):
        on = d in days
        dotc = (ibtn('check', 'Train', 'pri', sm=True, style='width: 28px; height: 28px') if d not in partial else ibtn('check', 'Train', '', sm=True, style='width: 28px; height: 28px')) if on else check(False)
        head = row(txt(WD[d - 1], 't-l c-brass' if on else 't-l'), sp(), dotc, style='min-height: 30px')
        body = txt(days[d] or 'Name this day', 't-h2' + ('' if days[d] else ' c-brass')) if on else txt('Rest', 't-h2 c-dim')
        cells.append(card(head, body, tone='glass' if on else '', gap=10, style='min-height: 108px; padding: 12px 14px 14px'))
    n = len(days)
    cells.append(col(txt(str(n), 't-num num', 'font-size: 40px' if False else ''), txt('days a week', 't-s'), gap=2, style='justify-content: center; padding: 0 14px'))
    return grid(*cells, cols=2, gap=12)


def rail(cur=1, days=WEEK_UL, done=(2,)):
    """.pg-rail: 88 px pills — weekday (11 px) + name; current = brass-edged."""
    pills = []
    for d, n in days.items():
        on = d == cur
        t = row(txt(WD[d - 1], 't-l c-brass' if on else 't-l'), sp(), span(ico('check', 12), 'c-ok') if (d in done and not on) else '', gap=4)
        pills.append(card(t, txt(n, 't-s'), tone='glass' if on else '', gap=2, style='padding: 7px 10px; width: 88px; flex: none'))
    return row(*pills, gap=8, style='overflow: hidden')


def day_head(wd='Monday', name='Upper A', ro=False):
    return row(col(txt(wd, 't-l c-brass'), txt(name, 't-d1'), gap=2, style='flex: 1; min-width: 0'), '' if ro else ibtn('layers', 'Copy day to', 'fill'), gap=12, align='flex-end')


def modes(m='exercises', ro=False):
    """pieces.ModeTabs: two identical 56 px tiles; the selected one brass-edged."""
    t = lambda k, i, l: card(row(ico(i, 22), txt(l, 't-h3'), gap=8, justify='center'), tone='glass' if m == k else '', gap=0, style='height: 56px; justify-content: center')
    return grid(t('muscles', 'body', 'Muscles'), t('exercises', 'dumbbell', 'Exercises'), cols=2, gap=10)


def body_map(locked=False, sel=(), h=170, caption=None):
    """Muscle.tsx MusclePickerMap — the app's front + back anatomy; selected (or derived, locked) muscles in brass."""
    keys = tuple(MKEY[s] for s in sel if s in MKEY)
    f = col(bodymap('front', keys, h=h), txt('Front', 't-m', 'text-align: center'), gap=4)
    b = col(bodymap('back', keys, h=h), txt('Back', 't-m', 'text-align: center'), gap=4)
    cap_ = caption if caption is not None else ''
    return col(row(f, b, gap=28, justify='center', align='flex-end'), txt(cap_, 't-m', 'text-align: center') if cap_ else '', gap=6)


MB = [('Chest', ['Chest']), ('Back', ['Back', 'Lats', 'Traps', 'Lower back']), ('Shoulders', ['Shoulders', 'Neck']), ('Arms', ['Biceps', 'Triceps', 'Forearms']),
      ('Legs', ['Quads', 'Hamstrings', 'Glutes', 'Adductors', 'Abductors', 'Calves']), ('Core', ['Core']), ('Full body', ['Full body'])]


def muscle_groups(sel=('Chest', 'Shoulders', 'Triceps'), ro=False):
    """.pg-mgroups: label + 3-column grid of 44 px tiles, selected = brass-edged."""
    t = lambda m: btn(m, 'pri' if m in sel else 'sec', sm=True, dis=ro and m not in sel, style='width: 100%; height: 44px; padding: 0 6px')
    return col(*[col(lbl(g), grid(*[t(m) for m in ms], cols=3, gap=8), gap=8) for g, ms in MB], gap=16)


def daynav(prev=('Week', None), nxt=('Lower A', 'Tue')):
    """.pg-daynav: prev = grey tile, next = brass-outlined, flex-1."""
    def lab(l, s, right):
        return col(txt(s, 't-l') if s else '', txt(l, 't-h3'), gap=0, style=f'align-items: {"flex-end" if right else "flex-start"}')
    p = card(row(ico('back', 18), lab(prev[0], prev[1], False), gap=8), style='padding: 0 16px; height: 60px; justify-content: center', gap=0) if prev else ''
    n = btn(lab(nxt[0], nxt[1], True) + ico('chev', 18), 'pri', style='flex: 1; height: 60px') if nxt else ''
    return row(p, n, gap=10)


def locked(ms=('Chest', 'Back', 'Shoulders', 'Triceps', 'Lats', 'Biceps')):
    """.pg-locked: lock + brass-tinted derived-muscle pills."""
    return row(span(ico('lock', 14), 'c-dim'), *[tag(m, 'brass') for m in ms], gap=6, wrap=True)


def marker(kind='Warm-up', ro=False):
    """.pg-marker (44 px, muted): icon · kind · 'marker · nothing to log' · ×"""
    return li(span(kind, 'c-mut'), 'marker · nothing to log', span(ico('flame' if kind == 'Warm-up' else 'wave', 18), 'c-brass'), '' if ro else ibtn('x', f'Remove {kind}', sm=True), style='min-height: 44px')


def exrow(name, sr, label=None, ro=False, open_=False):
    """.pg-row: [A1] name 16/600 · sets×reps pill (pg-sr) · ⓘ · more/less."""
    lead = tag(label, 'brass') if label else ''
    trail = btn(sr, 'sec', sm=True, style='min-width: 64px; font-size: 16px') + ibtn('info', f'{name} details', sm=True) + ('' if ro else ibtn('up' if open_ else 'down', 'Less' if open_ else 'More', 'pri' if open_ else '', sm=True))
    return li(f'<b>{name}</b>', None, lead, trail, style='gap: 6px; padding: 6px 4px 6px 14px')


def more_panel(eq=('Barbell',), label='A1'):
    """.pg-more: inset panel under the row."""
    eqv = row(*[tag(e, 'neutral') for e in eq] if eq else [span('Add', 'c-brass')], ico('plus', 16), gap=6)
    body = col(li(span('Equipment', 'c-mut'), trail=eqv, style='min-height: 46px; padding: 4px 0'), li(span('Drop on last set', 'c-mut'), trail=toggle(False), style='min-height: 46px; padding: 4px 0'),
               li(span('Superset with', 'c-mut'), trail=span(f'{label[0]} · Ungroup' if label else 'Choose exercise', 't-s c-brass'), style='min-height: 46px; padding: 4px 0'),
               li(span('History', 'c-mut'), trail=row(span('Open history', 't-s c-brass'), ico('chev', 16), gap=4), style='min-height: 46px; padding: 4px 0'),
               row(btn('Up', 'sec', 'up', sm=True, style='flex: 1; height: 40px'), btn('Down', 'sec', 'down', sm=True, style='flex: 1; height: 40px'), btn('Remove', 'dan', 'trash', sm=True, style='flex: 1; height: 40px'), gap=6, style='padding: 8px 0 6px'), gap=0)
    return f'<div style="padding: 0 10px 10px">{card(body, tone="quiet", style="padding: 4px 14px")}</div>'


def cardio_row(name='Treadmill', mins='10 min', ro=False):
    return li(name, None, span(ico('pulse', 18), 'c-rest'), btn(mins, 'sec', sm=True, style='min-width: 64px') + ('' if ro else ibtn('x', f'Remove {name}', sm=True)), style='padding: 6px 4px 6px 14px')


def items_upper(open_idx=None, ro=False):
    rows_ = [marker(ro=ro), exrow('Bench press', '4 × 6', 'A1', ro, open_idx == 1)]
    if open_idx == 1:
        rows_.append(more_panel())
    rows_ += [exrow('Barbell row', '4 × 8', 'A2', ro), exrow('Overhead press', '3 × 8', None, ro, open_idx == 3)]
    if open_idx == 3:
        rows_.append(more_panel(('Barbell',), None))
    rows_ += [exrow('Lat pulldown', '3 × 10', None, ro), cardio_row(ro=ro), marker('Cool-down', ro)]
    return lst(*rows_)


def add_dashed():
    """.pg-add: dashed brass-edged 48 px button."""
    return card(row(ico('plus', 18), txt('Add exercise', 't-h3 c-brass'), gap=8, justify='center'), tone='dash', gap=0, style='height: 48px; justify-content: center')


def ex_body(open_idx=None, ro=False):
    return col(locked(), items_upper(open_idx, ro), '' if ro else add_dashed(),
               txt('4 exercises · 14 sets · weight comes from history', 't-m', 'padding: 0 2px'), gap=12)


def review_rows(kind='ul'):
    """.pg-review: one surface, 64 px rows (17 px name + 13 px summary + ✓ / warning), 46 px dim rest rows."""
    if kind == 'ul':
        spec_ = {1: ('Upper A', 'Exercises · 4 + cardio', True), 2: ('Lower A', 'Exercises · 4', True), 4: ('Upper B', 'Muscles · Chest, Shoulders, Triceps', True),
                 5: ('Lower B', 'Muscles · Quads, Hamstrings, Glutes', True)}
    else:
        spec_ = {1: ('Push', 'Muscles · Chest, Shoulders, Triceps', True), 3: ('Pull', 'Exercises · 5', True), 5: ('Legs', 'Pick muscles or exercises', False)}
    rows_ = []
    for d in range(1, 8):
        if d in spec_:
            n, s, ok = spec_[d]
            rows_.append(li(f'<b>{n}</b>', s, txt(WD[d - 1], 't-l c-brass', 'width: 40px'), span(ico('check', 20), 'c-ok') if ok else span(ico('warn', 20), 'c-brass'), style='min-height: 64px; padding: 8px 18px'))
        else:
            rows_.append(li(span('Rest', 'c-dim'), None, txt(WD[d - 1], 't-l', 'width: 40px'), style='min-height: 46px; padding: 4px 18px'))
    return lst(*rows_)


def ready_line(ok=True, text='All 4 days are set'):
    return row(span(ico('check' if ok else 'warn', 16), 'c-ok' if ok else 'c-brass'), txt(text, 't-s c-ok' if ok else 't-s c-brass'), gap=8, justify='center')


def review_head(name=PROG, meta='8 weeks · 4 days a week · ', st='active'):
    return col(txt(name, 't-d1'), row(txt(meta, 't-b c-mut'), status_lbl(st), gap=4), gap=6)


def review_screen(kind='ul', st='active', ready=(True, 'All 4 days are set'), actions=None, ro=False, name=PROG, meta='8 weeks · 4 days a week · ', overlay='', h=844, menu=True, err=None):
    acts = actions if actions is not None else cta('Save', dis=True)
    return ph(topbar('', menu=menu and not ro, discard=not ro), review_head(name, meta, st), review_rows(kind),
              '' if ro else row(btn('Edit week', 'txt', 'calendar', style='padding: 0')),
              col(err or '', ready_line(*ready), '' if ro else acts, gap=12), h=h, overlay=overlay)


def actions_draft(primary, dirty=True, busy=False):
    """.pg-actions (column-reverse): big primary on top, quiet 'Save draft' text button under it."""
    return col(cta(primary, dis=busy), btn('Save draft', 'txt', dis=busy or not dirty, style='align-self: center; color: inherit' if False else 'align-self: center'), gap=4)


def menu_pop(coach=True, active=True, saved=True):
    """pieces.ActionMenu anchored under ⋯ (48 px rows, icon + label; Delete in danger)."""
    it = lambda l, i, tone=None: li(l, None, span(ico(i, 18), 'c-bad' if tone else 'c-mut'), tone=tone, style='min-height: 48px')
    items = ([it('Assign to members', 'users')] if coach else []) + [it('Duplicate', 'layers'), it('Export CSV', 'download')] + (
        [it('Archive', 'layers')] if (active and saved) else []) + ([it('Delete', 'trash', 'bad')] if saved else [])
    return scrim() + absb(lst(*items), 'right: 12px; top: 58px; width: 240px')


# ============================================================== ROW 0 · main flow
def wk_head():
    return col(txt('Week', 't-d1'), txt('Tap a day to train or rest', 't-s'), gap=4)


P('P08-Programs-Member.dc.html', 'Programs home · Member', ph(*home('member')), row_=0)
P('P08-Programs-Trainer.dc.html', 'Programs home · Trainer', ph(*home('trainer'), h=900), h=900, row_=0)
P('P08-Programs-Admin.dc.html', 'Programs home · Admin', ph(*home('admin'), h=900), h=900, row_=0)

P('P08-Builder-Basics.dc.html', 'Builder · 1 basics (new)', ph(
    topbar('New program'), basics(''), sp(h=6), start_from(), cta('Next', dis=True)), row_=0)
P('P08-Builder-Basics-Ongoing.dc.html', 'Builder · 1 basics · saved, no end date (back → review)', ph(
    topbar(PROG), basics(PROG, ongoing=True), sp(h=6), cta('Next')), row_=0)
P('P08-Builder-Week.dc.html', 'Builder · 2 week', ph(topbar(PROG), wk_head(), week_tiles(), cta('Set up days'), h=900), h=900, row_=0)
P('P08-Builder-Day-Exercises.dc.html', 'Builder · 3 day · by exercises', ph(
    topbar(PROG), rail(1), day_head(), modes('exercises'), ex_body(), daynav(('Week', None), ('Lower A', 'Tue')), h=960), h=960, row_=0)
P('P08-Builder-Day-More.dc.html', 'Builder · 3 day · exercise “More” open', ph(
    topbar(PROG), rail(1), day_head(), modes('exercises'), ex_body(open_idx=1), daynav(('Week', None), ('Lower A', 'Tue')), h=1200), h=1200, row_=0)
P('P08-Builder-Day-Muscles.dc.html', 'Builder · 3 day · by muscles (body map + tiles)', ph(
    topbar(PROG), rail(4, done=(1, 2)), day_head('Thursday', 'Upper B'), modes('muscles'), body_map(sel=('Chest', 'Shoulders', 'Triceps')), muscle_groups(),
    daynav(('Lower A', 'Tue'), ('Lower B', 'Fri')), h=1320), h=1320, row_=0)
P('P08-Builder-Review.dc.html', 'Builder · 4 review (saved, active)', review_screen(), row_=0)
P('P08-Builder-Review-Draft.dc.html', 'Builder · 4 review · draft, a day unfilled', review_screen(
    'ppl', 'draft', (False, 'Fill Friday: muscles or exercises'), actions_draft('Fill Friday'), name='Push Pull Legs', meta='6 weeks · 3 days a week · '), row_=0)
P('P08-Builder-Review-Ready.dc.html', 'Builder · 4 review · draft, ready to activate', review_screen(
    'ul', 'draft', (True, 'All 4 days are set'), actions_draft('Activate')), row_=0)
P('P08-Builder-Review-ReadOnly.dc.html', 'Program from my trainer · read-only', review_screen(ro=True), row_=0)
P('P08-Builder-Day-ReadOnly.dc.html', 'Program from my trainer · a day, read-only', ph(
    topbar(PROG, discard=False), rail(1), day_head(ro=True), modes('exercises', ro=True), locked(), items_upper(ro=True),
    txt('4 exercises · 14 sets · weight comes from history', 't-m', 'padding: 0 2px'), daynav(('Week', None), ('Lower A', 'Tue')), h=900), h=900, row_=0)


# Playbook (TemplatesView re-exports PlaybookView)
def play(name, meta, exs, cover, ideas, day='brass'):
    head = row(col(txt(name, 't-h2'), txt(meta, 't-m'), gap=2, style='flex: 1'), btn('Start', 'pri', 'dumbbell', sm=True), gap=10)
    ex = col(*[row(txt(str(i + 1), 't-m num', 'width: 16px'), row(span(n, 't-s'), span('●', 'c-brass') if st else '', gap=6, style='flex: 1; min-width: 0'),
                   tag(sc, 'brass'), txt(w, 't-m num', 'width: 52px; text-align: right'), gap=8, style='min-height: 36px') for i, (n, st, sc, w) in enumerate(exs)], gap=0)
    cov = col(lbl('Muscle mix'), row(*[tag(f'{m} · {n}', 'brass' if p else 'neutral') for m, n, p in cover], gap=6, wrap=True), gap=6)
    ids = col(lbl('Ideas'), row(*[tag(row(ico(i, 13), t, gap=5), 'brass' if w else 'neutral') for i, t, w in ideas], gap=6, wrap=True), gap=6) if ideas else ''
    return card(head, ex, cov, ids, gap=12, style='padding: 14px 16px')


PLAYS = [play('Chest 2', 'from 9 sessions · 28 Sep', [('Bench press', True, '4 × 5', '100 kg'), ('Incline dumbbell press', True, '3 × 8–10', '34 kg'), ('Cable fly', False, '3 × 12', '20 kg'), ('Triceps pushdown', True, '3 × 10–12', '37.5 kg')],
              [('Chest', 10, True), ('Triceps', 6, True), ('Front delt', 4, False), ('Side delt', 1, False)],
              [('progress', 'Bench press has stalled — vary it', True), ('plus', 'Add Side delt work', False)]),
         play('Legs', 'from 7 sessions · 26 Sep', [('Squat', True, '5 × 5', '140 kg'), ('Romanian deadlift', True, '3 × 8', '110 kg'), ('Leg press', False, '3 × 10–12', '200 kg'), ('Seated calf raise', False, '3 × 15', '—')],
              [('Quads', 11, True), ('Hamstrings', 6, True), ('Glutes', 5, False), ('Calves', 3, False)], [('dumbbell', 'Add Leg extension?', False)])]


def rrow(n, ex, d):
    return card(row(col(txt(n, 't-s'), txt(ex, 't-m'), gap=2, style='flex: 1; min-width: 0'), txt(d, 't-m'), span(ico('rotate', 16), 'c-dim'), gap=10), style='padding: 10px 14px', gap=0)


RECENT = col(rrow('Chest 2', 'Bench press · Incline dumbbell press · Cable fly · Triceps pushdown', '28 Sep'),
             rrow('Legs', 'Squat · Romanian deadlift · Leg press · Seated calf raise', '26 Sep'),
             rrow('Back 1', 'Deadlift · Lat pulldown · Barbell row · Face pull', '24 Sep'), gap=8)


def playbook_top():
    return col(lbl('Training'), txt('Playbook', 't-h1'), ovback(), gap=2)


P('P08-Playbook.dc.html', 'Playbook (learned plays)', ph(
    playbook_top(), txt('2 plays learned from your training', 't-s'), *PLAYS, lbl('Repeat a past session'), RECENT, h=1240), h=1240, row_=0)

# ============================================================== ROW 1 · states
P('P08-Programs-Loading.dc.html', 'Programs · loading', ph(*home('member', mine='loading', state='loading')), row_=1)
P('P08-Programs-Failed.dc.html', 'Programs · list failed · no program assigned', ph(*home('member', mine='empty', state='failed')), row_=1)
P('P08-Programs-Empty.dc.html', 'Programs · nothing created yet', ph(*home('member', mine='empty', state='empty')), row_=1)
P('P08-Programs-Archived.dc.html', 'Programs · archived shown · Trainer', ph(*home('trainer', archived_open=True), h=1000), h=1000, row_=1)
P('P08-Programs-ByTrainer.dc.html', 'Programs · assigned by my trainer · Member', ph(*home('member', mine='trainer')), row_=1)
P('P08-Programs-Night.dc.html', 'Programs home · night', ph(sleephero(), *home('member'), mood='sky', h=900), h=900, row_=1)
P('P08-Seed-Week.dc.html', 'From Today suggestion · prefilled week + toast', ph(
    topbar('New program'), wk_head(), week_tiles({1: 'Monday', 2: 'Tuesday', 4: 'Thursday', 5: 'Friday'}), cta('Set up days'), h=900,
    overlay=snack(row(span(ico('check', 16), 'c-ok'), span('Program ready — review and save'), gap=8), '', bottom=96)), h=900, row_=1)
P('P08-Builder-Day-Empty.dc.html', 'Builder · day with no exercises yet', ph(
    topbar(PROG), rail(2, done=(1,)), day_head('Tuesday', 'Lower A'), modes('exercises'), txt('No exercises yet — add the first one.', 't-s', 'padding: 14px 0'),
    add_dashed(), sp(h=120), daynav(('Upper A', 'Mon'), ('Upper B', 'Thu'))), row_=1)
P('P08-Builder-Week-Partial.dc.html', 'Builder · week · a day switched on, not named', ph(
    topbar('Push Pull Legs'), wk_head(), week_tiles({1: 'Push', 3: 'Pull', 5: ''}, partial=(5,)), cta('Set up days'), h=900), h=900, row_=1)
P('P08-Builder-Week-None.dc.html', 'Builder · week · no training day yet (CTA disabled)', ph(
    topbar('New program'), wk_head(), week_tiles({}), cta('Set up days', dis=True), h=900), h=900, row_=1)
P('P08-Builder-SaveFailed.dc.html', 'Builder · save failed', review_screen(
    'ul', 'draft', (True, 'All 4 days are set'), actions_draft('Activate'), err=card(txt('Couldn’t save — check your connection and try again.', 't-s c-bad'), tone='bad', style='padding: 10px 14px')), row_=1)
P('P08-Builder-Saving.dc.html', 'Builder · saving', review_screen('ul', 'draft', (True, 'All 4 days are set'), actions_draft('Saving…', busy=True)), row_=1)
P('P08-Playbook-Empty.dc.html', 'Playbook · nothing learned yet', ph(
    playbook_top(), col(span(ico('layers', 30), 'c-dim'), txt('Do a few sessions and Spotter will build your plays here.', 't-s', 'text-align: center'), gap=10, style='align-items: center; padding: 40px 20px'),
    lbl('Repeat a past session'), rrow('Chest 2', 'Bench press · Incline dumbbell press · Cable fly', '28 Sep')), row_=1)
P('P08-Playbook-Night.dc.html', 'Playbook · night', ph(sleephero(), playbook_top(), txt('2 plays learned from your training', 't-s'), PLAYS[0], mood='sky', h=900), h=900, row_=1)

# ============================================================== ROW 2 · sheets & menus
P('P08-Menu-Trainer.dc.html', 'Program options · Trainer (saved, active)', review_screen(overlay=menu_pop(True)), row_=2)
P('P08-Menu-Admin.dc.html', 'Program options · Admin (saved, active)', review_screen(overlay=menu_pop(True)), row_=2)
P('P08-Menu-Member.dc.html', 'Program options · Member (saved, active)', review_screen(overlay=menu_pop(False)), row_=2)
P('P08-Menu-Unsaved.dc.html', 'Program options · new unsaved draft (no Archive, no Delete) · Member', review_screen(
    'ppl', 'draft', (False, 'Fill Friday: muscles or exercises'), actions_draft('Fill Friday'), name='Push Pull Legs', meta='6 weeks · 3 days a week · ', overlay=menu_pop(False, False, False)), row_=2)


def member_row(n, hint, on, leaving=False):
    """.pg-member: 34 px avatar · 17 px name (struck-through when leaving) · hint · 28 px check."""
    nm = f'<s class="c-dim">{n}</s>' if leaving else n
    return li(nm, hint, avatar(n[0], 34), check(on), style='min-height: 58px; padding: 6px 0')


def ahead(st, name):
    return col(txt(st, 't-l c-ok' if st.startswith('Active') else 't-l c-brass'), txt(name, 't-h2'), gap=4)


def save_delta(plus=0, minus=0, dis=False):
    t = 'Save' + (f' <span class="c-ok">+{plus}</span>' if plus else '') + (f' <span class="c-bad">−{minus}</span>' if minus else '')
    return cta(t, dis=dis)


ASSIGN = sheet(None, ahead('Active · 8 weeks', PROG), search('Search clients'),
               lbl('On this program · 2'), col(member_row('Anna', 'week 3 of 8', True), member_row('Oleh', 'will be removed', False, True), gap=0),
               lbl('Other clients'), col(member_row('Iryna', 'on Strength block · will switch', True), member_row('Marek', 'no program', False), gap=0),
               h=690, close=False, footer=save_delta(1, 1))
P('P08-Assignees-Trainer.dc.html', 'Members drawer · Trainer', ph(*home('trainer'), overlay=ASSIGN, h=900), h=900, row_=2)
ASSIGN_A = sheet(None, ahead('Active · 8 weeks', PROG), search('Search clients'),
                 lbl('On this program · 4'), col(*[member_row(n, w, True) for n, w in [('Anna', 'week 3 of 8'), ('Oleh', 'week 3 of 8'), ('Iryna', 'week 1 of 8'), ('Marek', 'week 2 of 8')]], gap=0),
                 h=640, close=False, footer=save_delta(dis=True))
P('P08-Assignees-Admin.dc.html', 'Members drawer · Admin', ph(*home('admin'), overlay=ASSIGN_A, h=900), h=900, row_=2)
P('P08-Assignees-Empty.dc.html', 'Members drawer · no clients', ph(*home('trainer'), overlay=sheet(None, ahead('Draft · 6 weeks', 'Push Pull Legs'),
                                                                                              txt('No clients available', 't-s', 'padding: 14px 0'), h=320, close=False, footer=save_delta(dis=True)), h=900), h=900, row_=2)
P('P08-Assignees-Error.dc.html', 'Members drawer · save failed', ph(*home('trainer'), overlay=sheet(None, ahead('Active · 8 weeks', PROG), search('Search clients'),
                                                                                                     lbl('On this program · 2'), col(member_row('Anna', 'week 3 of 8', True), member_row('Oleh', 'week 3 of 8', True), gap=0),
                                                                                                     lbl('Other clients'), member_row('Marek', 'no program', True),
                                                                                                     card(txt('Couldn’t save — check your connection and try again.', 't-s c-bad'), tone='bad', style='padding: 10px 14px'),
                                                                                                     h=700, close=False, footer=save_delta(1)), h=900), h=900, row_=2)


def plist(rows_):
    return col(*[row(txt(a, 't-b', 'flex: 1'), txt(b, 't-s'), gap=12, style='min-height: 52px; padding: 0 4px') + '<div class="hl"></div>' for a, b in rows_], gap=0)


DUP = sheet('Duplicate a program', plist([(PROG, '8 weeks · 4 days a week'), ('Home 3-day', '4 weeks · 3 days a week'), ('Summer cut', '6 weeks · 5 days a week')]), h=340, close=False)
P('P08-Duplicate.dc.html', 'Duplicate a program (from basics)', ph(topbar('New program'), basics(''), overlay=DUP), row_=2)
P('P08-Duplicate-Empty.dc.html', 'Duplicate · nothing to copy', ph(topbar('New program'), basics(''), overlay=sheet('Duplicate a program', txt('No programs yet — create one and assign it to a client.', 't-s', 'padding: 14px 0'), h=220, close=False)), row_=2)
COPY = sheet('Copy day to', txt('Replaces whatever that day holds.', 't-s'), plist([(WDF[d - 1], WEEK_UL.get(d, 'Rest')) for d in range(2, 8)]), h=520, close=False)
P('P08-CopyDay.dc.html', 'Copy day to', ph(topbar(PROG), rail(1), day_head(), modes('exercises'), ex_body(), overlay=COPY), row_=2)


def sheet_stepper(v, lab, unit=None):
    b = lambda i, l: ibtn(i, l, 'fill', style='width: 48px; height: 48px; border-radius: 16px')
    return row(b('minus', f'Fewer {lab.lower()}'), col(txt(v, 't-num num'), txt(unit or lab, 't-m'), gap=0, style='align-items: center; flex: 1'), b('plus', f'More {lab.lower()}'), gap=6, style='flex: 1')


SETS = sheet(None, txt('Bench press', 't-h1'), row(sheet_stepper('4', 'Sets'), txt('×', 't-h2 c-dim'), sheet_stepper('6', 'Reps'), gap=10), h=290, close=False, footer=cta('Done'))
P('P08-Sets.dc.html', 'Sets × reps sheet', ph(topbar(PROG), rail(1), day_head(), modes('exercises'), ex_body(), overlay=SETS), row_=2)
MINS = sheet(None, txt('Treadmill', 't-h1'), big_stepper('10', 'min'), h=320, close=False, footer=cta('Done'))
P('P08-Minutes.dc.html', 'Minutes sheet (cardio / timed)', ph(topbar(PROG), rail(1), day_head(), modes('exercises'), ex_body(), overlay=MINS), row_=2)

EQ = ['Barbell', 'Dumbbell', 'Kettlebell', 'Cable', 'Machine', 'Bodyweight', 'Bands', 'Medicine ball', 'Exercise ball', 'EZ bar', 'Foam roller', 'Suspension (TRX)', 'Other']
EQI = ['weight', 'dumbbell', 'weight', 'swap', 'building', 'body', 'wave', 'plates', 'plates', 'weight', 'rotate', 'link', 'more']
EQS = sheet(None, txt('Equipment', 't-h1'), grid(*[card(span(ico(i, 22), 'c-brass' if n == 'Barbell' else 'c-mut'), txt(n, 't-m c-brass' if n == 'Barbell' else 't-m'), tone='glass' if n == 'Barbell' else '', gap=6,
                                                        style='min-height: 72px; padding: 8px; align-items: center; justify-content: center; text-align: center') for n, i in zip(EQ, EQI)], cols=3, gap=8),
            h=640, close=False, footer=cta('Done'))
P('P08-Equipment.dc.html', 'Equipment sheet (exercise “More”)', ph(topbar(PROG), rail(1), day_head(), overlay=EQS), row_=2)
SS = sheet('Superset with', txt('Overhead press', 't-s'), plist([('Bench press', '4 × 6'), ('Barbell row', '4 × 8'), ('Lat pulldown', '3 × 10')]), h=340, close=False)
P('P08-SupersetWith.dc.html', 'Superset with', ph(topbar(PROG), rail(1), day_head(), modes('exercises'), ex_body(open_idx=3), overlay=SS, h=1000), h=1000, row_=2)

# ---- plain ExercisePicker (DayEditor.ProgramPicker): real family figures + exercise photos
FAMS = [('Chest', ('chest',), 'front', 'Upper chest · Lower chest'), ('Back', ('back', 'lats', 'traps', 'lower_back'), 'back', 'Lats · Traps · Lower back'),
        ('Shoulders', ('shoulders',), 'front', 'Front delt · Side delt · Rear delt'), ('Arms', ('biceps', 'triceps', 'forearms'), 'front', 'Biceps · Triceps · Forearms'),
        ('Legs', ('quads', 'hamstrings', 'glutes', 'calves'), 'front', 'Quads · Hamstrings · Glutes · Calves'), ('Core', ('core',), 'front', 'Core')]


def fam_tile(n, gs, v, subs):
    """.xp-fam (88 px): FamilyFigure (plain → accent) · name 15 · subs 11.5."""
    return card(row(bodymap(v, gs, h=72), col(txt(n, 't-h3'), txt(subs, 't-m'), gap=4, style='flex: 1; min-width: 0'), gap=10), style='padding: 8px 10px; min-height: 88px', gap=0)


def kinds():
    """.xp-kinds: Strength is where you are; the other three act at once."""
    return card(grid(btn('Strength', 'pri', sm=True, style='width: 100%; height: 40px'), *[col(txt(k, 't-s'), style='height: 40px; align-items: center; justify-content: center') for k in ('Warm-up', 'Cardio', 'Cool-down')], cols=4, gap=4), style='padding: 4px', gap=0)


PICK = sheet(None, row(txt('Add exercise', 't-h2'), txt('Mon · Upper A', 't-m'), gap=10, align='baseline'), search('Search by name, muscle or equipment'), kinds(),
             row(lbl('Or pick a muscle group'), sp(), btn('Equipment', 'sec', 'dumbbell', sm=True), gap=8),
             grid(*[fam_tile(*f) for f in FAMS], cols=2, gap=8), h=720, close=False)
P('P08-Picker.dc.html', 'Add exercise to a day (plain picker)', ph(topbar(PROG), rail(1), day_head(), overlay=PICK), row_=2)


def pcard(n, meta, added=False):
    """.xp-card: 104 px photo · name 13.5 · meta · Added badge (plain) · ⓘ"""
    return col(rel(exercise_pic(n, '100%', 104, 10), absb(ibtn('info', 'Details', 'fill', sm=True), 'right: 6px; top: 6px')),
               txt(n, 't-s'), txt(meta, 't-m'), row(tag('Added', 'ok', 'check')) if added else '', gap=4)


PICKG = sheet(None, row(ibtn('back', 'Back to muscle groups', 'fill', sm=True), col(txt('Chest', 't-h3'), txt('Mon · Upper A', 't-m'), gap=0, style='flex: 1'), ibtn('search', 'Search', 'fill', sm=True), gap=8),
              chips(['All', 'Upper chest', 'Lower chest']), row(*[chip(f'{a} <span class="t-m">{b}</span>', i == 0) for i, (a, b) in enumerate([('Any', 24), ('Barbell', 6), ('Dumbbell', 8), ('Cable', 4), ('Machine', 6)])], gap=6, wrap=True),
              row(lbl('Chest · 24'), sp(), txt('Tap to add · ⓘ details', 't-m'), gap=8),
              grid(pcard('Barbell Bench Press - Medium Grip', 'Barbell · + shoulders', True), pcard('Incline Dumbbell Press', 'Dumbbell · + shoulders'),
                   pcard('Cable Crossover', 'Cable · + shoulders'), pcard('Butterfly', 'Machine'), cols=2, gap=10), h=790, close=False)
P('P08-Picker-Group.dc.html', 'Plain picker · muscle group (Added badges)', ph(topbar(PROG), overlay=PICKG), row_=2)


def prow(n, meta, added=False):
    """.xp-row: 64×48 photo · name 14.5 · meta · Added · ⓘ"""
    return li(n, meta, exercise_pic(n, 64, 48, 6), (tag('Added', 'ok', 'check') if added else '') + ibtn('info', 'Details', sm=True), style='min-height: 60px; padding: 6px 0')


PICKS = sheet(None, row(f'<div style="flex: 1">{search("Search by name, muscle or equipment", "row")}</div>', btn('Cancel', 'txt', sm=True), gap=6),
              lbl('Results · 3'), col(prow('Bent Over Barbell Row', 'Barbell · + biceps', True), prow('One-Arm Dumbbell Row', 'Dumbbell · + biceps'), prow('Face Pull', 'Cable · + traps'), gap=0),
              card(row(txt('Browse all of Back › Traps', 't-s', 'flex: 1'), ico('chev', 16)), style='padding: 12px 14px'),
              btn('Create “row”', 'sec', 'plus', full=True), h=600, close=False)
P('P08-Picker-Search.dc.html', 'Plain picker · search + create', ph(topbar(PROG), overlay=PICKS), row_=2)

INFO = sheet(None, grid(*[col(exercise_pic('Incline Dumbbell Press', '100%', 128, 10, i), txt(t, 't-m'), gap=4) for i, t in ((0, 'Start'), (1, 'Finish'))], cols=2, gap=8),
             txt('Incline Dumbbell Press', 't-h2'), row(tag('Chest', 'brass'), tag('Shoulders', 'neutral'), tag('Triceps', 'neutral'), tag('Dumbbell', 'neutral', 'dumbbell'), gap=6, wrap=True),
             col(lbl('Station busy? Same muscles'), grid(*[row(exercise_pic(n, 40, 40, 6), col(txt(n, 't-s'), txt(e, 't-m'), gap=0), gap=8) for n, e in [('Dumbbell Bench Press', 'Dumbbell'), ('Leverage Incline Chest Press', 'Machine')]], cols=2, gap=8), gap=8),
             col(lbl('Key cues'), txt('1 · Lie back on an incline bench with a dumbbell in each hand atop your thighs. The palms of your hands will be facing each other.', 't-s'),
                 txt('2 · Then, using your thighs to help push the dumbbells up, lift the dumbbells one at a time so that you can hold them at shoulder width.', 't-s'),
                 btn('Full instructions (7 steps)', 'txt', sm=True, style='padding: 0; align-self: flex-start'), gap=6),
             h=780, close=False, footer=row(btn('Back', 'sec'), btn('Add to Upper A', 'pri', style='flex: 1'), gap=10))
P('P08-Picker-Info.dc.html', 'Plain picker · exercise info (Add to the day)', ph(topbar(PROG), overlay=INFO), row_=2)

EQF = sheet(None, txt('What do you want to use?', 't-h2'), txt('Pick one or more — groups, suggestions and search follow it.', 't-s'),
            grid(*[card(span(ico(i, 20), 'c-brass' if n in ('Barbell', 'Dumbbell') else 'c-mut'), txt(n, 't-m'), tone='glass' if n in ('Barbell', 'Dumbbell') else '', gap=6,
                        style='min-height: 70px; padding: 8px; align-items: center; justify-content: center; text-align: center') for n, i in zip(EQ, EQI)], cols=3, gap=8),
            h=700, close=False, footer=row(btn('Reset', 'sec'), btn('Show 14 exercises', 'pri', style='flex: 1'), gap=10))
P('P08-Picker-Equipment.dc.html', 'Plain picker · equipment filter (no gym → no in-gym labels, no “only this gym”)', ph(topbar(PROG), overlay=EQF), row_=2)

CM = ['Treadmill', 'Curved / manual treadmill', 'Rowing erg', 'Ski erg', 'Bike erg', 'Air / fan bike', 'Upright bike', 'Recumbent bike']
CMI = ['run', 'run', 'wave', 'wave', 'bike', 'bike', 'bike', 'bike']


def cm_row(n, icon, sub=None):
    """CardioMachineList row: 32 px round icon (the code draws icons here, not photos)."""
    return li(n, sub, f'<span class="tile" style="width: 32px; height: 32px">{ico(icon, 16)}</span>', style='min-height: 50px')


CARDIO = sheet(None, lbl('Which machine?'), col(cm_row('No machine / other', 'timer', 'Just time and distance'), *[cm_row(n, i) for n, i in zip(CM, CMI)], gap=0), h=640, close=False)
P('P08-Picker-Cardio.dc.html', 'Plain picker · Cardio → which machine (no gym)', ph(topbar(PROG), overlay=CARDIO), row_=2)

CSVH = txt('Import CSV', 't-h2')
CSV1 = sheet(None, CSVH, txt('Columns: Day, Exercise, Kind, Sets, Reps, Duration, Equipment. A weight column is ignored.', 't-s'),
             btn('Choose a CSV file', 'sec', 'list', full=True), col(txt('or paste CSV', 't-l'), card(txt('Day,Exercise,Kind,Sets,Reps,Duration,Equipment', 't-s c-dim num'), style='height: 120px'), gap=6),
             row(btn('Download template', 'txt', 'rotate', sm=True, style='padding: 0'), sp(), btn('Continue', 'pri', dis=True), gap=8), h=520, close=False)
P('P08-CSV-Pick.dc.html', 'Import CSV · pick', ph(*home('member'), overlay=CSV1), row_=2)
CSV1e = sheet(None, CSVH, txt('Columns: Day, Exercise, Kind, Sets, Reps, Duration, Equipment. A weight column is ignored.', 't-s'),
              btn('Choose a CSV file', 'sec', 'list', full=True), col(txt('or paste CSV', 't-l'), card(txt('Day,Exercise', 't-s num'), style='height: 120px'), gap=6),
              txt('No rows found — check the file has a header and at least one row.', 't-s c-bad'),
              row(btn('Download template', 'txt', 'rotate', sm=True, style='padding: 0'), sp(), btn('Continue', 'pri'), gap=8), h=560, close=False)
P('P08-CSV-NoRows.dc.html', 'Import CSV · no rows', ph(*home('member'), overlay=CSV1e), row_=2)


def mrow(h_, f):
    return row(txt(h_, 't-b num', 'width: 110px'), f'<div style="flex: 1">{field(value=f, trail=ico("down", 16))}</div>', gap=10)


CSV2 = sheet(None, CSVH, txt('Match each column to a field. A detected weight column is discarded — programs never carry load.', 't-s'),
             col(mrow('Day', 'Day'), mrow('Exercise', 'Exercise'), mrow('Sets', 'Sets'), mrow('Reps', 'Reps'), mrow('Weight', 'Weight (discarded)'), mrow('Notes', 'Ignore'), gap=8),
             row(btn('Back', 'sec', style='flex: 1'), btn('Continue', 'pri', style='flex: 1'), gap=10), h=640, close=False)
P('P08-CSV-Map.dc.html', 'Import CSV · map columns', ph(*home('member'), overlay=CSV2), row_=2)


def crow(day, name, s='', r='', kind=None, probs=(), sug=None):
    cells = [f'<div style="width: 44px; flex: none">{field(value=day)}</div>', f'<div style="flex: 1; min-width: 0">{field(value=name, state="err" if probs else "")}</div>']
    if kind:
        cells.append(txt(kind, 't-s', 'width: 108px'))
    else:
        cells += [f'<div style="width: 48px; flex: none">{field(value=s)}</div>', f'<div style="width: 48px; flex: none">{field(value=r)}</div>']
    rr = row(*[tag(p, 'bad') for p in probs], btn(f'Use “{sug}”', 'txt', sm=True, style='height: 28px') if sug else '', gap=6, wrap=True) if probs else ''
    return col(row(*cells, gap=6), rr, gap=6)


CSV3 = sheet(None, CSVH, row(txt('6 rows · 3 days', 't-h3'), sp(), txt('5 ready · 1 need attention', 't-s'), gap=8),
             card(txt('A weight column was found and discarded. Programs never carry load.', 't-s'), tone='glass', style='padding: 10px 14px'),
             crow('1', 'Back Squat', '5', '5'), crow('1', 'Row', '3', '8'), crow('3', 'Bench pres', '4', '6', probs=('Unrecognised exercise',), sug='Bench Press'),
             crow('3', 'Easy Run', kind='Cardio'), crow('5', 'Deadlift', '3', '5'),
             row(btn('Back', 'sec', style='flex: 1'), btn('Import 6 rows', 'pri', style='flex: 1'), gap=10), h=740, close=False)
P('P08-CSV-Preview.dc.html', 'Import CSV · validating preview', ph(*home('member'), overlay=CSV3), row_=2)

# ProgramAssignDialog (PG-03) — exists in code, not mounted by any screen today
AD = sheet(None, col(txt(f'Assign “{PROG}”', 't-h2'), txt("Assigning replaces the member's active program. Their logged history is untouched, and they can still start off-plan sessions any time.", 't-s'), gap=4),
           row(chip(f'{avatar("A", 20)} Anna ×', True), chip(f'{avatar("I", 20)} Iryna ×', True), gap=8), search('Search members'),
           col(*[li(n, 'your client · active program will be replaced', avatar(n[0], 30), span(ico('check', 20), 'c-brass') if on else '', style='min-height: 52px; padding: 4px 0')
                 for n, on in [('Anna', True), ('Oleh', False), ('Iryna', True), ('Marek', False)]], gap=0),
           field('Start week', 'Week 1', trail=ico('down', 16)), txt('Starts on Monday, at program week 1.', 't-s'),
           row(span(ico('warn', 16), 'c-brass'), txt("Each member's current active program will be replaced. Their logged history is untouched.", 't-s', 'flex: 1'), gap=8, align='flex-start'),
           h=800, close=False, footer=row(btn('Cancel', 'sec', style='flex: 1'), btn('Assign to 2', 'pri', style='flex: 1'), gap=10))
P('P08-AssignDialog-Trainer.dc.html', 'ProgramAssignDialog (PG-03, unmounted) · Trainer', ph(*home('trainer'), overlay=AD, h=900), h=900, row_=2)

# ============================================================== ROW 3 · dialogs & desktop
P('P08-Delete.dc.html', 'Delete program', review_screen(overlay=dialog(f'Delete {PROG}?', 'The program is removed for everyone assigned. Logged sessions stay; adherence is recomputed from what was logged.', 'Delete', 'Keep')), row_=3)
P('P08-MakeRest.dc.html', 'Make a day rest', ph(topbar(PROG), wk_head(), week_tiles(), h=900,
                                              overlay=dialog('Make Tuesday a rest day?', 'Its name, muscles and exercises will be cleared.', 'Make rest day', 'Keep', 'pri', top=330)), h=900, row_=3)
P('P08-Discard.dc.html', 'Discard changes', ph(topbar(PROG), basics(PROG), overlay=dialog('Discard changes?', 'Your unsaved changes to this program will be lost.', 'Discard', 'Keep', 'pri')), row_=3)
P('P08-SwitchMuscles.dc.html', 'Define day by muscles?', ph(topbar(PROG), rail(1), day_head(), modes('exercises'), ex_body(),
                                                            overlay=dialog('Define this day by muscles?', '7 items will be removed from this day. Their muscles stay as targets.', 'Switch', 'Keep', 'pri')), row_=3)


def desk_basics(name=PROG):
    return col(col(lbl('Program name'), big_name(name, size='t-h1'), gap=8), col(lbl('Weeks'), stepper('8', '', 'Weeks'),
               card(row(txt('No end date', 't-s', 'flex: 1'), toggle(False), gap=10), style='padding: 12px 14px'), gap=10), gap=16)


def desk_left(sel=1, review=False, saved=True, days=WEEK_UL):
    wrows = []
    for d in range(1, 8):
        on = d in days
        s = on and d == sel and not review
        r_ = row(txt(WD[d - 1], 't-l c-brass' if on else 't-l', 'width: 36px'), txt(days.get(d, 'Rest'), 't-s' if on else 't-s c-dim', 'flex: 1'),
                 span(ico('check', 14), 'c-ok') if on and d != 4 and saved else '', toggle(on), gap=10, style='min-height: 44px; padding: 0 10px 0 12px')
        wrows.append(card(r_, tone='glass' if s else ('' if on else 'quiet'), pad=False, gap=0))
    rv = card(row(ico('list', 18), txt('Review', 't-h3'), gap=8), txt('All 4 days are set' if saved else 'Pick at least one training day', 't-m c-ok' if saved else 't-m c-brass'), tone='glass' if review else '', gap=4, style='padding: 10px 12px')
    return col(status_lbl('active' if saved else 'draft'), desk_basics(PROG if saved else ''), txt(f'{len(days)} days a week', 't-m'), '' if saved else start_from(),
               lbl('Week'), col(*wrows, gap=6), rv, gap=12, style='width: 300px; flex: none')


def desk_top(saved=True):
    return row(btn('Programs', 'txt', 'back', style='padding: 0'), sp(), ibtn('x', 'Discard', 'fill'), '' if saved else btn('Save draft', 'txt', dis=True),
               ibtn('more', 'Program options', 'fill'), btn('Save' if saved else 'Pick training days', 'pri', dis=saved), gap=10)


day_mid = col(day_head(), modes('exercises'), ex_body(open_idx=1), daynav(None, ('Lower A', 'Tue')), gap=14, style='flex: 1; min-width: 0')
day_side = card(row(ico('lock', 14), lbl('From exercises'), gap=6), body_map(True, ('Chest', 'Back', 'Shoulders', 'Triceps', 'Lats', 'Biceps'), h=200),
                txt('Chest · Back · Shoulders · Triceps · Lats · Biceps', 't-m', 'text-align: center'), gap=12, style='width: 280px; flex: none; padding: 18px')
board('P08-Desktop-Builder-Day.dc.html', 'Desktop · builder, day by exercises', 1440, 1180,
      desktop(col(desk_top(), row(desk_left(1), day_mid, day_side, gap=24, align='flex-start'), gap=18), active='overview', h=1180), row_=3)

rv_main = col(review_head(PROG, '8 weeks · 4 days a week · ', 'active'), review_rows(), ready_line(),
              txt("There is no weight column, by design. A program describes work; the session supplies load from each member's own history, so one program fits every member.", 't-s'), gap=14, style='flex: 1; max-width: 640px')
board('P08-Desktop-Builder-Review.dc.html', 'Desktop · builder, review', 1440, 900,
      desktop(col(desk_top(), row(desk_left(review=True), rv_main, gap=24, align='flex-start'), gap=18), active='overview'), row_=3)

dm_side = card(lbl('Muscle map'), body_map(False, ('Chest', 'Shoulders', 'Triceps'), h=200), txt('Chest · Shoulders · Triceps', 't-m', 'text-align: center'), gap=12, style='width: 280px; flex: none; padding: 18px')
dm_mid = col(day_head('Thursday', 'Upper B'), modes('muscles'), muscle_groups(), daynav(('Lower A', 'Tue'), ('Lower B', 'Fri')), gap=14, style='flex: 1; min-width: 0')
board('P08-Desktop-Builder-Muscles.dc.html', 'Desktop · builder, day by muscles', 1440, 1000,
      desktop(col(desk_top(), row(desk_left(4), dm_mid, dm_side, gap=24, align='flex-start'), gap=18), active='overview', h=1000), row_=3)

new_main = col(txt('New program', 't-d1'), txt('Ongoing · 0 days a week · Draft', 't-b c-mut'), review_rows_empty := lst(*[li(span('Rest', 'c-dim'), None, txt(WD[d], 't-l', 'width: 40px'), style='min-height: 46px; padding: 4px 18px') for d in range(7)]),
               ready_line(False, 'Pick at least one training day'), gap=14, style='flex: 1; max-width: 640px')
board('P08-Desktop-Builder-New.dc.html', 'Desktop · new program (start-from, nothing set)', 1440, 1000,
      desktop(col(desk_top(False), row(desk_left(saved=False, review=True, days={}), new_main, gap=24, align='flex-start'), gap=18), active='overview', h=1000), row_=3)

dhome = col(ovback(), row(txt('Programs', 't-d1'), sp(), btn('Import CSV', 'sec', 'upload'), btn('New program', 'pri', 'plus'), gap=10),
            col(lbl('My program'), f'<div style="max-width: 520px">{my_prog()}</div>', gap=10),
            row(lbl('Created by me'), txt('3', 't-l c-dim'), gap=8),
            grid(pg_tile('active', PROG, '8 weeks · 4 days a week', (['Anna', 'Oleh'], 0), coach=True), pg_tile('draft', 'Push Pull Legs', '6 weeks · 3 days a week', None, coach=True),
                 pg_tile('active', 'Strength block', 'Ongoing · 3 days a week', (['Iryna'], 0), coach=True), cols=3, gap=14),
            row(btn('Archived · 1', 'txt', 'layers', sm=True, style='padding: 0')), gap=16, style='max-width: 1100px')
board('P08-Desktop-Programs-Trainer.dc.html', 'Desktop · Programs home · Trainer', 1440, 760, desktop(dhome, active='overview', h=760), row_=3)
print('P08 ok')
