"""P03 · Start & logging — 1:1 with StartSheet, GymPicker, BackfillSheet, SessionStartCoach, SessionBuilderView,
HomeSetSheet, LogActivityView (+ QuickLog), ActivityView, PickerFields, TimelineRange, EffortGauge. Copy = en.ts."""
from kit import *
_kgauge = gauge

# ---- App shell (App.tsx): the app-brand header sits above every overlay screen too (no tab bar on overlays);
#      during a live night the Spotter Sky + SleepHero band sit under the header (mood='sky').
_phone = phone
_sheet = sheet


def phone(*c, night=False, **kw):
    c = list(c)
    if kw.get('tabs', 'today') is None:
        c = [brandbar()] + c
    if night:
        kw['mood'] = 'sky'
        c.insert(1, sleephero())
    return _phone(*c, **kw)


def sheet(title=None, *content, **kw):
    """ui.tsx Sheet chrome: grabber + close (aria Cancel) in the corner, then the content"""
    if title is None:
        content = (row(sp(), ibtn('x', 'Cancel', 'fill', sm=True), style='margin: -6px 0 -8px'),) + content
    return _sheet(title, *content, **kw)

# ============================================================== shared helpers (compose kit only)
def today_bg(live=False):
    """a dimmed Today behind the sheets (content of Today is P01)"""
    top = livepill('live') if live else card(row(col(lbl('Today · Chest 2', 'brass'), txt('Upper/Lower 4× · week 3', 't-h3'), gap=4, style='flex: 1'), ring(33, 52, 'brass', 5, span('33%', 't-m c-brass num'))),
                                             week(['done', 'rest', 'done', 'none', 'plan', 'plan', 'rest'], today=0), tone='glass', gap=14)
    return [brandbar(), top]


def session_bg():
    return [header('Chest 2', sub='Iron Temple · 0:04', action=ibtn('more', 'Session menu')), txt('Starts with your first exercise', 't-s', 'text-align: center')]


def half(*x):
    return col(*x, gap=6, style='flex: 1; min-width: 0')


def flabel(t_):
    return txt(t_, 't-s')


def date_field(v='27.09.2026'):
    return field(value=v, ph='dd.mm.yyyy', trail=ibtn('calendar', 'Date', sm=True))


def time_field(v='18:00', lab='Start', focus=False):
    """TimeField — typeable (kit timein) + the clock button that opens the hour/minute columns"""
    return row(timein(v, focus, lab), ibtn('clock', lab, sm=True), gap=6)


def dur_field(h='1', m='00'):
    """DurationField — two typeable inputs, h and min"""
    return row(timein(h, label='h'), span('h', 't-s'), timein(m, label='min'), span('min', 't-s'), gap=4)


def cal_grid(sel=27, today=28, marks=None, prev_next=('Previous', 'Next'), title='September 2026'):
    """DateField popover / kit Calendar: month head with prev/next, weekday row, 6×7 day grid, future days disabled"""
    marks = marks or {}
    head = row(ibtn('back', prev_next[0], sm=True), txt(title, 't-h3', 'flex: 1; text-align: center'), ibtn('chev', prev_next[1], sm=True))
    dow = grid(*[txt(d, 't-m', 'text-align: center') for d in ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']], cols=7, gap=2)
    days = [(31, True)] + [(d, False) for d in range(1, 31)] + [(d, True) for d in range(1, 12)]
    cells = []
    for d, muted in days:
        mk = row(*[dot(t_) for t_ in marks.get(d, [])], gap=2, justify='center', style='height: 8px') if not muted else row(style='height: 8px')
        if not muted and d == sel:
            num = btn(str(d), 'pri', sm=True, style='padding: 0; width: 34px; height: 30px; align-self: center')
        elif not muted and d == today:
            num = btn(str(d), 'sec', sm=True, style='padding: 0; width: 34px; height: 30px; align-self: center')
        else:
            num = txt(str(d), 't-s c-dim' if (muted or d > today) else 't-s', 'text-align: center; height: 30px; padding-top: 6px')
        cells.append(col(num, mk, gap=1))
    return col(head, dow, grid(*cells, cols=7, gap=2), gap=6)


def eff_gauge(level=1):
    """EffortGauge card: kicker · the kit's semicircle dial (graded ok → accent → danger, needle on the level) · Light/Moderate/Hard selector"""
    return card(lbl('Effort'), _kgauge(level + 1, w=200), seg(['Light', 'Moderate', 'Hard'], level), gap=8, style='align-items: stretch')


def timeline(s='07:40', e='08:10', d='30min', left=32, width=2, marks=('00:00', '06:00', '12:00', '18:00', '00:00'), focus=None, w=358):
    """TimelineRange — kit timerange: typeable start/end above the draggable day track (overnight wrap supported)"""
    b = left + width
    return timerange(s, e, d, left, b - 100 if b > 100 else b, 'brass', marks, focus, w)


# ============================================================== Start sheet (StartSheet.tsx)
def start_hero(kicker, title, sub, icon='play', busy=False):
    """.ss-hero — the accent block of the sheet (24 px title, 60 px go button)"""
    return card(row(col(lbl(kicker, 'brass'), txt(title, 't-h1'), txt(sub, 't-s'), gap=6, style='flex: 1; min-width: 0'),
                    btn('', 'pri', icon, style='width: 60px; height: 60px; padding: 0'), gap=14), tone='hero', style='padding: 20px')


def ss_tile(title, sub, icon, tone='neutral', locked=False):
    return card(row(tile(icon, 'neutral' if locked else tone), sp(), ico('lock', 16) if locked else ''), txt(title, 't-h3 c-dim' if locked else 't-h3'), txt(sub, 't-m'), style='padding: 12px', gap=8)


def start_grid(locked=False, live='Chest 2'):
    fin = f'Finish {live} first'
    return col(grid(ss_tile('Auto session', fin if locked else 'A full day from your goal & recovery', 'spark', 'brass', locked),
                    ss_tile('Activity', 'Log past' if locked else 'Run, ride, sport', 'pulse', 'ok'),
                    ss_tile('Health', 'Sleep, recovery, injury, unwell', 'timer', 'rest'),
                    ss_tile('Log past', 'A session you forgot', 'history'), cols=2, gap=8),
               card(row(tile('home', 'brass'), col(txt('Home set', 't-h3'), txt(fin if locked else 'Pull-ups, vacuum, push-ups — no gym', 't-m'), gap=2, style='flex: 1'), ico('lock', 16) if locked else '', gap=12), style='padding: 12px'), gap=8)


P('P03-Start-Sheet.dc.html', 'Start sheet · today in program', phone(*today_bg(), mood='art', overlay=sheet(None,
    txt('Start', 't-h2'),
    start_hero('Today in program', 'Chest 2', 'Upper/Lower 4× · Monday'),
    btn('Or start from scratch', 'txt', 'plus', style='align-self: center; height: 32px'),
    start_grid(), h=640)))

# ============================================================== Session start coach (sheet “Today’s read”)
def coach_row(name, target, chip_):
    return li(name, None, None, row(span(target, 'num t-s'), chip_, gap=8))

P('P03-Start-Coach.dc.html', 'Session start coach · Today’s read', phone(*session_bg(), tabs=None, mood='art', overlay=sheet(None,
    lbl('Today’s read'),
    card(row(tile('pulse', 'brass'), lbl('Readiness', 'brass'), gap=10), txt('Some muscles are ready, some are still recovering.', 't-h3'),
         row(*[row(bodymap('front', [m], region=reg, h=34), col(txt(n, 't-m'), txt(pc, f't-h3 num {c}'), gap=0), gap=6) for m, reg, n, pc, c in
               [('chest', 'torso', 'Chest', '92%', 'c-ok'), ('triceps', 'arms', 'Triceps', '88%', 'c-ok'), ('shoulders', 'upper', 'Shoulders', '64%', 'c-brass')]], gap=14, wrap=True),
         txt('Still recovering: Shoulders.', 't-s'), tone='hero', gap=10, style='padding: 18px'),
    card(row(ico('calendar', 18), txt('Chest 2 day', 't-h3'), gap=8),
         lst(coach_row('Bench press', '97.5 × 5', tag('+2.5', 'ok', 'up')), coach_row('Incline DB press', '32.0 × 8', tag('Hold', 'neutral')),
             coach_row('Cable fly', '18.0 × 12', tag('Hold', 'neutral')), coach_row('Dips', '10.0 × 8', tag('+2.5', 'ok', 'up')),
             coach_row('Triceps pushdown', '30.0 × 12', tag('Deload', 'bad')), coach_row('Overhead extension', '', tag('New', 'brass'))), gap=10),
    h=720)))

# ============================================================== Session builder (SessionBuilderView.tsx)
def sb_steps(on):
    names = ['Intent', 'Muscles', 'The day', 'Review']
    items = []
    for i, n in enumerate(names):
        c = btn('', 'ok', 'check', sm=True, style='padding: 0; width: 32px; height: 32px') if i < on else btn(str(i + 1), 'pri' if i == on else 'sec', sm=True, style='padding: 0; width: 32px; height: 32px')
        items.append(col(c, txt(n, 't-m c-brass' if i == on else 't-m', 'text-align: center'), gap=5, style='flex: 1; align-items: center'))
    return row(*items, gap=4, align='flex-start')


def sb_head():
    return row(ibtn('x', 'Close'), txt('Build your day', 't-h3', 'flex: 1'), style='height: 56px; padding: 0 8px')


def sb_foot(nxt=None, review=False):
    b = ibtn('back', 'Back', 'fill')
    if review:
        return row(b, btn('Save as a day', 'sec', style='flex: 1'), btn('Start now', 'pri', style='flex: 1'), gap=8)
    return row(b, btn(nxt + ico('chev', 16), 'pri', style='flex: 1'), gap=8) if nxt else ''


def sb_opt(n, reps, on=False):
    return card(row(col(txt(n, 't-h3'), txt(f'{reps} reps', 't-m'), gap=2, style='flex: 1'), ico('check', 20) if on else '', gap=10), tone='glass' if on else '', style='padding: 13px 14px')

P('P03-Builder-Intent.dc.html', 'Session builder · Intent', phone(sb_head(), sb_steps(0), txt("What's today for?", 't-h1'),
    col(sb_opt('Strength', '3–5'), sb_opt('Muscle', '6–12', True), sb_opt('Endurance', '12–20'), sb_opt('Power', '3–6'), sb_opt('Conditioning', '10–15'), gap=8),
    sp(), row(btn('Muscles' + ico('chev', 16), 'pri', style='flex: 1'), gap=8), tabs=None, mood='art'))

def mchip(n, tone, on=False):
    return chip(f'{dot(tone)}{n}', on)

P('P03-Builder-Muscles.dc.html', 'Session builder · Muscles', phone(sb_head(), sb_steps(1),
    row(txt('Which muscles?', 't-h1', 'flex: 1'), chip('Auto', False, 'spark')),
    card(row(mchip('Chest', 'ok', True), mchip('Lats', 'ok'), mchip('Traps', 'ok'), mchip('Shoulders', 'brass', True), mchip('Biceps', 'ok'), mchip('Triceps', 'ok', True), mchip('Forearms', 'ok'), gap=8, wrap=True)),
    card(row(mchip('Quads', 'bad'), mchip('Hamstrings', 'brass'), mchip('Glutes', 'brass'), mchip('Calves', 'ok'), mchip('Lower back', 'ok'), mchip('Core', 'ok'), gap=8, wrap=True)),
    sp(), sb_foot('The day'), tabs=None, mood='art'))

P('P03-Builder-Day.dc.html', 'Session builder · The day', phone(sb_head(), sb_steps(2), txt('Plan the day', 't-h1'),
    lbl('Length'), seg(['30', '45', '60', '75', '90'], 2),
    lst(li('Warm-up', None, ico('flame', 20), toggle(True)), li('Cardio finisher', None, ico('pulse', 20), toggle(False)), li('Cool-down', None, ico('wave', 20), toggle(True))),
    sp(), sb_foot('Review'), tabs=None, mood='art'))

def sb_ex(name, why, sr, w='', icon='dumbbell', edit=False):
    lead = ico('drag', 18) if edit else tile(icon, 'neutral')
    trail = row(col(span(sr, 't-s num'), span(w, 't-h3 num') if w else '', gap=0, style='align-items: flex-end'), ibtn('swap', 'Replace exercise', 'fill', sm=True) if edit else '', gap=8)
    return li(name, why, lead, trail)

def cov(n, pct, sets):
    return row(txt(n, 't-s', 'width: 84px'), col(bar(pct, 'brass'), style='flex: 1; min-width: 0'), txt(str(sets), 't-m num', 'width: 24px; text-align: right'), gap=10)

wds = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
P('P03-Builder-Review.dc.html', 'Session builder · Review (scroll)', phone(sb_head(), sb_steps(3), txt('Review your day', 't-h1'),
    row(tag('Chest · Triceps', 'neutral'), tag('62 min', 'neutral'), tag('5 · Muscle', 'neutral'), gap=6, wrap=True),
    lbl('Warm-up'), lst(sb_ex('Mobility + light cardio', 'Raise the heart rate and prime the day’s patterns.', '8 min', icon='pulse')),
    lbl('Main'), lst(sb_ex('Bench press', 'Recovered and due to add load.', '4×6–12', '85 kg', edit=True), sb_ex('Incline DB press', 'One of your staples on this day.', '3×6–12', '30 kg', edit=True),
                     sb_ex('Cable fly', 'A grow-focus muscle — earns extra work today.', '3×6–12', '18 kg', edit=True), sb_ex('Triceps pushdown', "Hasn't been trained in a while — bringing it back.", '3×6–12', '30 kg', edit=True),
                     sb_ex('Overhead extension', 'New lift — start light and find your working weight.', '3×6–12', '—', edit=True)),
    lbl('Cool-down'), lst(sb_ex('Cool-down stretch', 'Ease down and stretch the muscles you trained.', '5 min', icon='wave')),
    lbl('Today covers'), card(cov('Chest', 100, 10), cov('Triceps', 75, 6), cov('Shoulders', 25, 2), gap=10),
    lbl('Day name'), field(value='', ph='Chest · Triceps'),
    lbl('Save on'), row(*[chip(d, d == 'Mon') for d in wds], gap=5, wrap=True),
    sb_foot(review=True), tabs=None, h=1360, mood='art'), h=1360)

# ============================================================== Home set (HomeSetSheet.tsx)
def hs_card(name, last, moves, first=False):
    return card(row(col(txt(name, 't-h3'), txt(last, 't-m'), gap=2, style='flex: 1'), ibtn('play', f'Start {name}', 'pri', sm=True), gap=12),
                row(*[tag(m, 'neutral') for m in moves], gap=6, wrap=True), tone='glass' if first else '', style='padding: 12px 14px')

P('P03-HomeSet.dc.html', 'Home set · your sets', phone(*today_bg(), mood='art', overlay=sheet(None,
    row(ico('home', 20), txt('Home set', 't-h2'), gap=8),
    lbl('Your home sets'),
    hs_card('Morning', 'Last: today, 07:10 · 12 min', first=True, moves= ['Pullups', 'Pushups', 'Stomach Vacuum']),
    hs_card('Evening core', 'Last: yesterday, 21:30 · 9 min', ['Plank', 'Side Bridge', 'Hanging Leg Raise']),
    hs_card('Doorframe', 'Not done yet', ['Doorframe hang', 'Pushups']),
    btn('New home set', 'sec', 'plus', full=True),
    row(ico('info', 16), txt('Tap to start. Hold a home set to edit or delete it.', 't-m'), gap=8),
    h=620)))

def hs_tile(n, icon, on):
    return card(row(tile(icon, 'brass' if on else 'neutral'), sp(), check(True) if on else ''), txt(n, 't-s'), tone='glass' if on else '', style='padding: 10px', gap=6)

P('P03-HomeSet-Builder.dc.html', 'Home set · new', phone(*today_bg(), mood='art', h=900, overlay=sheet(None,
    row(ico('home', 20), txt('New home set', 't-h2'), gap=8),
    txt('Name it and select the moves you do at home. It stays in Home set for next time.', 't-s'),
    field('Name', 'Morning', 'Morning', state='focus'),
    row(lbl("Spotter’s home moves"), sp(), txt('3 selected', 't-m c-brass')),
    grid(hs_tile('Stomach Vacuum', 'body', True), hs_tile('Pullups', 'body', True), hs_tile('Pushups', 'body', True), hs_tile('Bench Dips', 'body', False), hs_tile('Bodyweight Squat', 'body', False), hs_tile('Plank', 'body', False), hs_tile('Chin-Up', 'body', False), hs_tile('Butt Lift (Bridge)', 'body', False), hs_tile('Side Bridge', 'body', False), cols=3, gap=8),
    lbl('Your own moves'),
    grid(hs_tile('Doorframe hang', 'body', False), card(tile('plus', 'brass'), txt('Create your own', 't-s'), tone='dash', style='padding: 10px', gap=6), cols=3, gap=8),
    row(ico('info', 16), txt('Hold your own move to edit or delete it.', 't-m'), gap=8),
    h=790, footer=row(btn('Save', 'sec', style='flex: 1'), btn('Start', 'pri', style='flex: 1'), gap=8))), h=900)

def hs_head(title, back=True, right=''):
    return row(ibtn('back', 'Back', sm=True) if back else '', txt(title, 't-h2', 'flex: 1'), right, gap=8)

def mrow_(n, m):
    return li(n, m, tile('body', 'brass'), row(ibtn('up', 'Move up', sm=True), ibtn('down', 'Move down', sm=True), ibtn('x', 'Remove from this home set', sm=True), gap=0))

P('P03-HomeSet-Edit.dc.html', 'Home set · edit', phone(*today_bg(), mood='art', overlay=sheet(None,
    hs_head('Edit home set', right=btn('Save', 'txt')),
    field('Name', 'Morning'),
    lbl('Moves'),
    lst(mrow_('Pullups', 'Reps'), mrow_('Pushups', 'Reps'), mrow_('Stomach Vacuum', 'Hold')),
    btn('Add move', 'sec', 'plus', full=True),
    sp(20), btn('Delete home set', 'dan', 'trash', full=True),
    txt('Past “Morning” sessions stay in History.', 't-m', 'text-align: center'),
    h=620)), row_=2)

def add_row(n, m):
    return li(n, m, tile('body', 'brass'), ico('plus', 18))

P('P03-HomeSet-AddMove.dc.html', 'Home set · add move', phone(*today_bg(), mood='art', overlay=sheet(None,
    hs_head('Add move'),
    lbl('Your own moves'), lst(add_row('Doorframe hang', 'Hold')),
    lbl("Spotter’s home moves"), lst(add_row('Bench Dips', 'Reps'), add_row('Bodyweight Squat', 'Reps'), add_row('Plank', 'Hold'), add_row('Chin-Up', 'Reps')),
    card(row(tile('plus', 'neutral'), txt('Create your own move', 't-b'), gap=12), tone='dash', style='padding: 10px 14px'),
    h=660)), row_=2)

P('P03-HomeSet-Move.dc.html', 'Home set · new move', phone(*today_bg(), mood='art', overlay=sheet(None,
    hs_head('New move'),
    field('Name', '', 'Doorframe hang'),
    flabel('Measured by'), seg(['Reps', 'Hold', 'Time'], 1),
    flabel('Muscle'), row(chip('Back', True), chip('Chest'), chip('Core'), chip('Shoulders'), chip('Biceps'), chip('Triceps'), chip('Quads'), chip('Glutes'), gap=6, wrap=True),
    flabel('Icon'), row(*[ibtn(i, i, 'pri' if i == 'body' else 'fill', sm=True) for i in ['body', 'dumbbell', 'yoga', 'run', 'timer', 'flame', 'target']], gap=6, wrap=True),
    sp(), btn('Save move', 'pri', full=True), h=640)), row_=2)

# ============================================================== Log activity (LogActivityView.tsx, mobile)
def la_head():
    return header('Log activity', large=True)


def cat_row(name, n, icon, tone, minis, meta, locked=False):
    m = row(*[tile(x, tone, s=14) for x in minis], gap=4, style='margin: 4px 0')
    return li(f'{name} <span class="t-m">{n}</span>', m + (ico('lock', 12) if locked else '') + meta, tile(icon, tone, lg=True), '', chev=True)


def browse(meta=('last: Run · yesterday', 'last: Football · 2 wk ago', 'last: Sauna · Thu'), locked=False, hint='34 types'):
    lm = ['Log past only'] * 3 if locked else list(meta)
    return [section('Browse by category', hint),
            lst(cat_row('Conditioning', 12, 'pulse', 'brass', ['run', 'body', 'bike'], lm[0], locked), cat_row('Sports', 16, 'trophy', 'sport', ['target', 'target', 'target'], lm[1], locked),
                cat_row('Recovery', 6, 'yoga', 'rest', ['yoga', 'flame', 'body'], lm[2], locked))]


def pcard(n, meta, icon, tone):
    return card(row(tile(icon, tone), col(txt(n, 't-h3'), txt(meta, 't-m'), gap=1, style='min-width: 0'), gap=10), style='padding: 10px 12px')


def pinned(hint='Hold any card to pin', meta=('yesterday', 'Sat', '2 wk ago', 'Thu')):
    return [row(lbl('Pinned <span class="t-m">4</span>'), sp(), txt(hint, 't-m'), style='min-height: 32px'),
            grid(pcard('Run', meta[0], 'run', 'brass'), pcard('Walk', meta[1], 'body', 'brass'), pcard('Football', meta[2], 'target', 'sport'), pcard('Sauna', meta[3], 'flame', 'rest'), cols=2, gap=8)]


def hero_card():
    return card(row(span(ico('spark', 14) + ' Likely now · Monday evening', 't-l c-brass'), sp(), ibtn('x', 'Not now, hide this suggestion', sm=True)),
                row(tile('run', 'brass', lg=True), col(txt('Run?', 't-h1'), txt('The last 4 Mondays, ~30 min', 't-s'), gap=2, style='flex: 1'), gap=12),
                bars([28, 32, 30, 31], 326, 50, 'brass', None, ['7 Sep · 28', '14 Sep · 32', '21 Sep · 30', '28 Sep · 31']),
                row(btn('Start', 'sec', 'play', style='flex: 1'), btn('Log 30 min', 'pri', style='flex: 1'), gap=8),
                txt('From your last 4 Mondays · usually starts ~18:30', 't-m', 'text-align: center'), tone='hero', gap=12, style='padding: 18px 16px 14px')


def also():
    s = lambda n, d, m, icon, tone: card(row(tile(icon, tone), sp(), span('+ Log', 't-s c-brass')), txt(f'{n} · ~{d}', 't-h3'), txt(m, 't-m'), style='padding: 12px', gap=6)
    return [section('Also on your Mondays'), grid(s('Sauna', '20 min', 'Evenings · 3 of 4', 'flame', 'rest'), s('Walk', '30 min', 'After Run · 2 of 4', 'body', 'brass'), cols=2, gap=8)]


def today_strip():
    return [row(lbl('Today'), txt('Mon 28 Sep · 1 activity', 't-m', 'flex: 1'), txt('+ lifting 58 min', 't-m'), gap=8),
            card(li('Walk · 20 min', 'Light · 07:30–07:50 · ≈ 88 kcal', tile('body', 'brass', s=16), chev=True, style='min-height: 44px; padding: 4px 2px'), tone='quiet')]


P('P03-LogActivity.dc.html', 'Log activity (scroll)', phone(la_head(), search('Search activities'),
    *today_strip(), hero_card(), *also(), *pinned(), *browse(),
    tabs=None, h=1460, mood='art'), h=1460)

# ---- Quick log sheet (QuickLog.tsx, variant sheet)
def ql_head(name, badge, last, icon, tone):
    return row(tile(icon, tone, lg=True), col(row(txt(name, 't-h2'), tag(badge, tone), gap=8, wrap=True), txt(last, 't-m') if last else '', gap=3, style='flex: 1; min-width: 0'), ibtn('x', 'Close', 'fill', sm=True), gap=12, align='flex-start')


def ql_dur_hero(on, custom='38'):
    """Duration is what a quick log is about: the chosen minutes big, presets as a strip under it"""
    v = (['15', '30', '45', '60', '90'] + [custom])[on]
    return card(flabel('Duration · min'), row(txt(v, 't-hero num'), txt('min', 't-h3 c-mut'), gap=8, align='baseline'),
                row(*[chip(x, i == on) for i, x in enumerate(['15', '30', '45', '60', '90', 'Custom'])], gap=6), tone='hero', gap=10, style='padding: 16px')


def ql_dur(on):
    return col(flabel('Duration · min'), row(*[chip(x, i == on) for i, x in enumerate(['15', '30', '45', '60', '90', 'Custom'])], gap=6), gap=6)


def ql_when(on):
    return col(flabel('When'), row(chip('Now', on == 0), chip('Earlier today', on == 1), chip('Pick a day', on == 2, 'calendar'), gap=6), gap=6)


def ql_dist(v, pace):
    return col(row(flabel('Distance'), sp(), txt(f'Pace <b class="c-brass">{pace}</b>', 't-s')),
               field(value=v, trail=row(span('km', 't-s'), ibtn('minus', 'Decrease distance by 0.5 km', 'fill', sm=True), ibtn('plus', 'Increase distance by 0.5 km', 'fill', sm=True), gap=4)), gap=6)


def ql_effort(on):
    return col(flabel('Effort'), seg(['Light', 'Moderate', 'Hard'], on), gap=6)


def ql_est(met, kcal):
    return row(col(txt('Estimate', 't-s'), txt(met, 't-m'), gap=2, style='flex: 1'), txt(f'≈ {kcal} <span class="t-m">kcal</span>', 't-num num'), gap=10, style='padding: 4px 2px')


def ql_pin(name, on=True):
    t1 = 'Pinned' if on else f'Pin {name}'
    t2 = f'{name} shows first on Log activity' if on else 'Shows first on Log activity'
    return li(t1, t2, ico('pin', 18), toggle(on), style='padding: 0 2px')


def ql_actions(log, now=True):
    return col(row(btn('Start timer', 'sec', 'play', style='flex: 1', dis=not now), btn(log, 'pri', style='flex: 1'), gap=8),
               txt('Timer is for now — past ones are logged directly.', 't-m', 'text-align: center') if not now else '', gap=8)


P('P03-QuickLog-Run.dc.html', 'Quick log · run · now', phone(la_head(), search('Search activities'), tabs=None, mood='art', h=900, overlay=_sheet(None,
    ql_head('Run', 'Adds conditioning load', 'Last: 5.2 km · 28 min · Sun 27 Sep', 'run', 'brass'),
    ql_dur_hero(1), ql_when(0), txt('Ends now · 18:10–18:40', 't-s'),
    ql_dist('5.2', '5:46 /km'), ql_effort(1), ql_est('MET 9.8 × 82 kg × 0.5 h', 402), ql_pin('Run'),
    ql_actions('Log it · 30 min'), h=780)), h=900)

# ---- Activity view (ActivityView.tsx)
def av_head(name='Run', icon='run', badge='Adds conditioning load', tone='brass'):
    """ActivityHead — category colour: conditioning = accent (brass), sport = sport, recovery = rest (.act-cat-badge)"""
    return row(ibtn('back', 'Back'), tile(icon, tone), txt(name, 't-h3', 'flex: 1'), tag(badge, tone, 'bolt'), gap=8, style='height: 56px; padding: 0 12px 0 4px')


def av_dist(v=''):
    return row(txt('Distance', 't-b', 'flex: 1'), col(field(value=v, ph='0.0', trail=span('km', 't-s')), style='width: 140px'), gap=10)


def kcal_line(k):
    return row(tile('flame', 'kcal', s=16), txt(f'~{k} <span class="t-m">kcal</span>', 't-h2 num'), gap=8)


P('P03-Activity-Running.dc.html', 'Activity · running', phone(av_head(),
    card(col(txt('27:40', 't-hero num'), kcal_line(358), gap=14, style='align-items: center; padding: 30px 0'), tone='hero'),
    eff_gauge(1), av_dist(),
    sp(), row(btn('Discard', 'dan', 'trash', sm=True, style='flex: 1'), btn('Pause', 'sec', 'timer', sm=True, style='flex: 1'), btn('Finish', 'pri', 'check', sm=True, style='flex: 1'), gap=8),
    tabs=None, mood='art'))

P('P03-Activity-Paused.dc.html', 'Activity · paused', phone(av_head(),
    card(col(txt('27:40', 't-hero num c-dim'), txt('Paused', 't-l'), kcal_line(358), gap=14, style='align-items: center; padding: 30px 0'), tone='hero'),
    eff_gauge(1), av_dist('5.2'),
    sp(), row(btn('Discard', 'dan', 'trash', sm=True, style='flex: 1'), btn('Resume', 'sec', 'play', sm=True, style='flex: 1'), btn('Finish', 'pri', 'check', sm=True, style='flex: 1'), gap=8),
    tabs=None, mood='art'), row_=1)

P('P03-Activity-Edit.dc.html', 'Activity · edit a logged run', phone(av_head(),
    col(flabel('Date'), date_field('27.09.2026'), gap=6),
    timeline('07:40', '08:10', '30min', 32, 2, focus='start'),
    eff_gauge(1), av_dist('5.2'),
    row(kcal_line(412), sp(), btn('Save', 'pri', 'check')),
    btn('Delete', 'dan', 'trash', full=True),
    tabs=None, mood='art'))

# ============================================================== row 1 · states
P('P03-Start-Locked.dc.html', 'Start sheet · something live', phone(*today_bg(live=True), mood='art', overlay=sheet(None,
    txt('Start', 't-h2'),
    start_hero('In progress', 'Chest 2', 'Resume', 'next'),
    start_grid(locked=True), h=580)), row_=1)

P('P03-Start-Usual.dc.html', 'Start sheet · usual day (playbook)', phone(*today_bg(), mood='art', overlay=sheet(None,
    txt('Start', 't-h2'),
    start_hero('Your usual Monday', 'Chest 2', 'From your playbook · last 21 Sep'),
    btn('Or start from scratch', 'txt', 'plus', style='align-self: center; height: 32px'),
    start_grid(), h=640)), row_=1)

P('P03-Start-Scratch.dc.html', 'Start sheet · no plan, no history', phone(*today_bg(), mood='art', overlay=sheet(None,
    txt('Start', 't-h2'),
    start_hero('Start a session', 'From scratch', 'Add exercises as you go'),
    start_grid(), h=580)), row_=1)

P('P03-LogActivity-First.dc.html', 'Log activity · first time', phone(la_head(), search('Search activities'),
    card(span(ico('spark', 14) + ' New here', 't-l c-ok'), txt('Log anything you do outside the gym', 't-h2'), txt('It counts toward your recovery and load — a run, a match, a sauna.', 't-s'),
         row(tile('run', 'brass'), tile('target', 'sport'), tile('flame', 'rest'), gap=6),
         txt('After a few logs, Spotter suggests what you usually do on this day and time.', 't-m'), tone='hero', gap=12, style='padding: 18px'),
    section('Popular to start', 'Tap to log'),
    lst(li('Run', 'Distance + pace', tile('run', 'brass'), ibtn('pin', 'Pin Run', sm=True)), li('Walk', 'Easy to track', tile('body', 'brass'), ibtn('pin', 'Pin Walk', sm=True)),
        li('Yoga', 'Counts as recovery', tile('yoga', 'rest'), ibtn('pin', 'Pin Yoga', sm=True)), li('Tennis', 'Sport load', tile('target', 'sport'), ibtn('pin', 'Pin Tennis', sm=True))),
    row(lbl('Pinned <span class="t-m">0</span>')),
    card(row(tile('pin', 'brass'), txt(f'Tap {ico("pin", 14)} to pin the ones you do often — they’ll show first here.', 't-s', 'flex: 1'), gap=12), style='padding: 12px 14px'),
    *browse(('Run, Walk, Cycling…', 'Tennis, Football, Padel…', 'Yoga, Sauna, Mobility…')),
    tabs=None, h=1240, mood='art'), h=1240, row_=1)

P('P03-LogActivity-Locked.dc.html', 'Log activity · a session is live', phone(la_head(),
    card(row(tile('dumbbell', 'brass', lg=True), col(txt(f'{dot("brass")} In progress · since 17:05', 't-l c-brass'), txt('Chest 2 <span class="t-s">· 42:18</span> <span class="t-m">running</span>', 't-h2'), gap=4, style='flex: 1'), gap=12),
         btn('Resume', 'pri', 'play', full=True), tone='hero', gap=12),
    search('Search activities'),
    card(row(ico('lock', 16), txt('<b>Finish Chest 2 first</b> to start another. You can still log one you did earlier.', 't-s', 'flex: 1'), gap=10), style='padding: 10px 14px'),
    *pinned('Tap = log past', ('Log past',) * 4),
    *browse(locked=True, hint='Start locked · log past'),
    tabs=None, h=1160, mood='art'), h=1160, row_=1)

P('P03-LogActivity-Search.dc.html', 'Log activity · search', phone(la_head(), search(value='ru'),
    row(lbl('1 match <span class="t-m">for “ru”</span>'), sp(), txt('Pinned & recent first', 't-m')),
    lst(li('<b>Ru</b>n', '<span class="c-brass">Conditioning</span> · last yesterday · 5.2 km', tile('run', 'brass'), ibtn('pin', 'Unpin Run', 'pri', sm=True))),
    lst(li('Log “ru” as Other sport', 'Not listed? Keep the name, count it as sport load', tile('plus'), chev=True)),
    tabs=None, mood='art'), row_=1)

def cat_tile(n, meta, icon, pinned_=False):
    return card(row(tile(icon, 'brass'), sp(), ibtn('pin', f'Pin {n}', 'pri' if pinned_ else 'fill', sm=True)), txt(n, 't-h3'), txt(meta, 't-m'), tone='glass' if pinned_ else '', style='padding: 10px 12px', gap=6)

P('P03-LogActivity-Category.dc.html', 'Log activity · category (scroll)', phone(
    row(ibtn('back', 'Back to Log activity'), col(txt('Log activity', 't-m'), row(txt('Conditioning', 't-h1'), tag('12', 'brass'), gap=8), gap=0, style='flex: 1'), tile('pulse', 'brass', lg=True), gap=8, style='padding: 8px 0'),
    search('Search conditioning'),
    section('Recent in Conditioning'),
    grid(pcard('Run', 'yesterday · 5.2 km', 'run', 'brass'), pcard('Walk', 'Sat · 40 min', 'body', 'brass'), cols=2, gap=8),
    row(lbl('All conditioning'), sp(), txt(ico('pin', 12) + ' Tap to pin', 't-m')), txt('Pinned first, then A–Z', 't-m'),
    grid(cat_tile('Run', 'yesterday · 5.2 km', 'run', True), cat_tile('Walk', 'Sat · 40 min', 'body', True), cat_tile('Cardio', 'Not yet', 'pulse'), cat_tile('Cycling', 'Not yet', 'bike'),
         cat_tile('Dance', 'Not yet', 'body'), cat_tile('Elliptical', 'Not yet', 'pulse'), cat_tile('HIIT', 'Not yet', 'bolt'), cat_tile('Hiking', 'Not yet', 'map'),
         cat_tile('Jump rope', 'Not yet', 'pulse'), cat_tile('Rowing', 'Not yet', 'wave'), cat_tile('Stair climber', 'Not yet', 'up'), cat_tile('Swim', 'Not yet', 'wave'), cols=2, gap=8),
    tabs=None, h=1320, mood='art'), h=1320, row_=1)

# ---- controls reference (the real pickers)
board('P03-Controls.dc.html', 'Pickers: date, time, duration, timeline, effort', 1600, 1500, spec('Pickers — date, time, duration, timeline, effort',
    cap('DateField + calendar popover (Log past · Date)', card(date_field('27.09.2026'), cal_grid(27, 28), btn('Today', 'txt', style='align-self: center')), w=360),
    cap('TimeField + hour / minute columns (5-min steps)', card(time_field('18:00'),
        row(col(*[txt(f'{h:02d}', 't-s num' if h != 18 else 't-h3 num c-brass', 'text-align: center') for h in range(15, 22)], gap=6, style='flex: 1'), txt(':', 't-h3'),
            col(*[txt(f'{m:02d}', 't-s num' if m != 0 else 't-h3 num c-brass', 'text-align: center') for m in range(0, 35, 5)], gap=6, style='flex: 1'), gap=6)), w=300),
    cap('DurationField (h · min)', col(card(dur_field('1', '00')), card(time_field('23:40', focus=True), dur_field('0', '10'), txt('That time is in the future', 't-s c-bad'), gap=10), gap=10), w=300),
    cap('TimelineRange (Activity · log past / edit) — typeable start / end', col(timeline('00:00', '12:00', '12h', 0, 50, w=348), timeline('07:40', '08:10', '30min', 32, 2, focus='end', w=348), timeline('21:00', '09:00', '12h', 87.5, 50, w=348), gap=10), w=380),
    cap('EffortGauge', col(eff_gauge(0), eff_gauge(1), eff_gauge(2), gap=8), w=360),
    cap('Quick log · Duration · min (Custom open)', card(ql_dur(5), field(value='38', trail=span('min', 't-s'), label='Minutes')), w=400),
    cap('Quick log · Pick a day (kit Calendar + legend)', card(cal_grid(27, 28, {3: ['brass'], 7: ['brass'], 13: ['sport'], 14: ['brass'], 17: ['rest'], 20: ['brass', 'rest'], 21: ['brass'], 24: ['rest'], 27: ['brass']}, ('Previous month', 'Next month')),
        row(tag('Conditioning', 'brass'), tag('Sports', 'sport'), tag('Recovery', 'rest'), gap=6)), w=360),
    cap('Quick log · When errors', card(ql_when(1), txt('That’s later than now — pick an earlier time.', 't-s c-bad')), w=400),
    w=1600, h=1500), row_=1)

# ============================================================== row 2 · sheets
def gym_row(name, sub, tag_=None, sug=False):
    return li(name, sub, photo(44, 44, 12), tag(tag_, 'brass' if sug else 'neutral') if tag_ else '', style='')

def hours(txt_='06:00–23:00', open_=True, pre=''):
    return row(span(pre, 't-m') if pre else '', dot('ok' if open_ else 'neutral'), span(txt_, 't-m'), gap=6)

P('P03-GymPicker.dc.html', 'Gym picker', phone(*today_bg(), mood='art', overlay=sheet(None,
    txt('Where are you training?', 't-h2'),
    search('Search for a gym'),
    lst(gym_row('Iron Temple', hours(pre="You're here"), 'Suggested', True), tone='glass'), lst(gym_row('Sportlife Podil', hours('07:00–22:00', pre='3.1 km')), gym_row('Home gym', '8.4 km')),
    lbl('Gyms nearby'),
    lst(gym_row('Atlet Fitness', '0.6 km · Khreshchatyk St 12', 'Add'), gym_row('Crossfit Kyiv', '1.4 km · Velyka Vasylkivska St 5', 'Add')),
    lst(li('Without a gym', None, tile('pin'))),
    h=720)), row_=2)

P('P03-GymPicker-Searching.dc.html', 'Gym picker · looking for gyms nearby', phone(*today_bg(), mood='art', overlay=sheet(None,
    txt('Where are you training?', 't-h2'),
    lst(gym_row('Iron Temple', '1.2 km', 'Suggested', True), gym_row('Sportlife Podil', '3.1 km')),
    lbl('Gyms nearby'), txt('Looking around you…', 't-s'),
    lst(li('Without a gym', None, tile('pin'))), h=480)), row_=2)

P('P03-GymPicker-NoLocation.dc.html', 'Gym picker · no location', phone(*today_bg(), mood='art', overlay=sheet(None,
    txt('Where are you training?', 't-h2'),
    lst(gym_row('Iron Temple', hours(), 'Suggested', True)),
    lbl('Gyms nearby'), txt('Allow location to see gyms near you', 't-s'),
    lst(li('Without a gym', None, tile('pin'))),
    h=420)), row_=2)

P('P03-GymPicker-NoneNearby.dc.html', 'Gym picker · none nearby', phone(*today_bg(), mood='art', overlay=sheet(None,
    txt('Where are you training?', 't-h2'),
    lst(gym_row('Iron Temple', hours(pre="You're here"), 'Suggested', True), gym_row('Sportlife Podil', '3.1 km')),
    lbl('Gyms nearby'), txt('No other gyms found nearby', 't-s'),
    lst(li('Without a gym', None, tile('pin'))), h=480)), row_=2)

def backfill(kind=0, err=False):
    body = [row(ico('history', 20), txt('Log a past session', 't-h2'), gap=8), seg(['Gym session', 'Home set'], kind)]
    if kind == 1:
        body += [flabel('Which home set'), row(chip('Morning', True), chip('Evening core'), chip('Doorframe'), chip('Empty'), gap=6, wrap=True)]
    body += [col(flabel('Date'), date_field('27.09.2026'), gap=6),
             row(half(flabel('Start'), time_field('23:40' if err else '18:00')), col(flabel('Duration'), dur_field('0' if kind else '1', '10' if kind else '00'), gap=6, style='flex: 1.4; min-width: 0'), gap=10, align='flex-start')]
    if kind == 1:
        body += [txt('No gym to pick. Duration starts at 10 min; the date can’t be later than today.', 't-m')]
    else:
        body += [col(flabel('Gym'), field(value='Iron Temple', icon='building', trail=ico('chev', 18)), gap=6)]
    if err:
        body += [row(ico('warn', 16), txt('That time is in the future', 't-s c-bad'), gap=8)]
    return sheet(None, *body, h=640 if kind else 560, footer=row(btn('Cancel', 'sec', style='flex: 1'), btn('Continue to exercises', 'pri', style='flex: 1.6', dis=err), gap=8))

P('P03-LogPast.dc.html', 'Log a past session · gym', phone(*today_bg(), mood='art', overlay=backfill(0)), row_=2)
P('P03-LogPast-Home.dc.html', 'Log a past session · home set · future time', phone(*today_bg(), mood='art', overlay=backfill(1, err=True)), row_=2)

P('P03-LogPast-GymInline.dc.html', 'Log a past session · gym list open', phone(*today_bg(), mood='art', h=900, overlay=sheet(None,
    row(ico('history', 20), txt('Log a past session', 't-h2'), gap=8), seg(['Gym session', 'Home set'], 0),
    col(flabel('Date'), date_field('27.09.2026'), gap=6),
    row(half(flabel('Start'), time_field('18:00')), col(flabel('Duration'), dur_field('1', '00'), gap=6, style='flex: 1.4; min-width: 0'), gap=10, align='flex-start'),
    col(flabel('Gym'), field(value='', ph='Choose a gym', trail=ico('back', 18)), gap=6),
    card(txt('Where are you training?', 't-h3'), lst(gym_row('Iron Temple', hours(), 'Suggested', True), gym_row('Sportlife Podil', '3.1 km')), lst(li('Without a gym', None, tile('pin'))), gap=8),
    h=820, footer=row(btn('Cancel', 'sec', style='flex: 1'), btn('Continue to exercises', 'pri', style='flex: 1.6'), gap=8))), h=900, row_=2)

P('P03-QuickLog-Walk.dc.html', 'Quick log · walk · earlier today', phone(la_head(), search('Search activities'), tabs=None, mood='art', h=900, overlay=_sheet(None,
    ql_head('Walk', 'Adds conditioning load', 'Last: 3.5 km · 45 min · Sat 26 Sep', 'body', 'brass'),
    ql_dur_hero(2), ql_when(1),
    row(col(flabel('Start'), timein('12:30', label='Start'), gap=6, style='width: 150px'), txt('Today · 12:30<br><span class="t-m">12:30–13:15 · today</span>', 't-s', 'flex: 1; text-align: right'), gap=10, align='flex-end'),
    ql_dist('3.5', '12:51 /km'), ql_effort(0), ql_est('MET 3.5 × 82 kg × 0.75 h', 216), ql_pin('Walk'),
    ql_actions('Log it · 45 min', now=False), h=830)), h=900, row_=2)

P('P03-QuickLog-Day.dc.html', 'Quick log · football · pick a day', phone(la_head(), search('Search activities'), tabs=None, mood='art', h=1240, overlay=_sheet(None,
    ql_head('Football', 'Adds conditioning load', 'Last: 1h 30min · Hard · Sun 13 Sep', 'target', 'sport'),
    ql_dur_hero(4), ql_when(2),
    card(cal_grid(27, 28, {3: ['brass'], 13: ['sport'], 17: ['rest'], 20: ['brass', 'rest'], 21: ['brass'], 24: ['rest'], 27: ['brass']}, ('Previous month', 'Next month')),
         row(tag('Conditioning', 'brass'), tag('Sports', 'sport'), tag('Recovery', 'rest'), gap=6), style='padding: 10px 12px', gap=8),
    row(col(flabel('Start'), timein('19:00', label='Start'), gap=6, style='width: 150px'), txt('Sun 27 Sep · 19:00<br><span class="t-m">19:00–20:30 · yesterday</span>', 't-s', 'flex: 1; text-align: right'), gap=10, align='flex-end'),
    ql_effort(2), ql_est('MET 7 × 82 kg × 1.5 h', 861), ql_pin('Football', False),
    ql_actions('Log it · 1h 30min', now=False), h=1150)), h=1240, row_=2)

P('P03-Activity-New.dc.html', 'Activity · new · start now', phone(av_head(),
    seg(['Start now', 'Log a past one'], 0),
    card(col(txt('The timer starts when you press Start.', 't-s', 'text-align: center'), btn('Start', 'pri', 'play', full=True), gap=14, style='padding: 18px 4px'), tone='glass'),
    tabs=None, mood='art'), row_=2)

P('P03-Activity-New-Past.dc.html', 'Activity · new · log a past one', phone(av_head(),
    seg(['Start now', 'Log a past one'], 1),
    col(flabel('Date'), date_field('28.09.2026'), gap=6),
    (timeline('00:00', '12:00', '12h', 0, 50)),
    eff_gauge(1), av_dist(),
    row(kcal_line(4836), sp(), btn('Save', 'pri', 'check')),
    tabs=None, mood='art'), row_=2)

# ============================================================== row 3 · dialogs / snack
snack_txt = 'Run · 30 min logged<div class="t-m">Added to today’s load</div>'
P('P03-Logged-Undo.dc.html', 'Activity logged · undo', phone(la_head(), search('Search activities'),
    row(lbl('Today'), txt('Mon 28 Sep · 2 activities', 't-m', 'flex: 1'), txt('+ lifting 58 min', 't-m'), gap=8),
    lst(li('Run · 30 min ' + tag('Just now', 'ok'), 'Moderate · 18:10–18:40 · ≈ 402 kcal', tile('run', 'brass'), chev=True),
        li('Walk · 20 min', 'Light · 07:30–07:50 · ≈ 88 kcal', tile('body', 'brass'), chev=True)),
    *pinned(), tabs=None, mood='art', overlay=snack(snack_txt, 'Undo', 28)), row_=3)

run_bg = [av_head(), card(col(txt('27:40', 't-big num'), kcal_line(358), gap=12, style='align-items: center; padding: 22px 0'), tone='glass')]
P('P03-Activity-Discard.dc.html', 'Discard activity?', phone(*run_bg, tabs=None, mood='art', overlay=dialog('Discard activity?', "This activity won't be saved.", 'Discard', 'Cancel', top=320)), row_=3)
P('P03-Activity-Finish.dc.html', 'Finish activity?', phone(*run_bg, tabs=None, mood='art', overlay=dialog('Finish activity?', 'Save this activity — 28 min.', 'Finish', 'Cancel', kind='pri', top=320)), row_=3)
P('P03-Activity-Delete.dc.html', 'Delete this activity?', phone(av_head(), col(flabel('Date'), date_field('27.09.2026'), gap=6), (timeline('07:40', '08:10', '30min', 32, 2)),
    tabs=None, mood='art', overlay=dialog('Delete this activity?', 'It will be removed from your history.', 'Delete', 'Cancel', top=320)), row_=3)
P('P03-HomeSet-Delete.dc.html', 'Delete home set?', phone(*today_bg(), mood='art', overlay=dialog('Delete “Morning”?', 'The home set goes away. Sessions you did from it stay in History.', 'Delete', 'Cancel', top=300)), row_=3)
P('P03-HomeMove-Delete.dc.html', 'Delete move?', phone(*today_bg(), mood='art', overlay=dialog('Delete Doorframe hang?', 'It leaves “Morning” and your moves. Sets you already logged stay in History.', 'Delete', 'Cancel', top=300)), row_=3)
# ============================================================== night (App.tsx nightLive: Spotter Sky + SleepHero; sleepLive locks starting)
P('P03-Start-Sheet-Night.dc.html', 'Start sheet · night (sleep live)', phone(*today_bg(), night=True, overlay=sheet(None,
    txt('Start', 't-h2'),
    start_hero('In progress', 'Sleep', 'Resume', 'next'),
    start_grid(locked=True, live='Sleep'), h=580)), row_=1)

P('P03-LogActivity-Night.dc.html', 'Log activity · night (sleep live)', phone(la_head(),
    card(row(tile('moon', 'rest', lg=True), col(txt(f'{dot("rest")} In progress · since 23:40', 't-l c-rest'), txt('Sleep <span class="t-s">· 6:48:12</span> <span class="t-m">running</span>', 't-h2'), gap=4, style='flex: 1'), gap=12),
         btn('Resume', 'pri', 'play', full=True), tone='rest', gap=12),
    search('Search activities'),
    card(row(ico('lock', 16), txt('<b>Finish Sleep first</b> to start another. You can still log one you did earlier.', 't-s', 'flex: 1'), gap=10), style='padding: 10px 14px'),
    *today_strip(),
    *pinned('Tap = log past', ('Log past',) * 4),
    *browse(locked=True, hint='Start locked · log past'),
    tabs=None, night=True, h=1360), h=1360, row_=1)

P('P03-QuickLog-Night.dc.html', 'Quick log · night (starting locked)', phone(la_head(), search('Search activities'), tabs=None, night=True, h=900, overlay=_sheet(None,
    ql_head('Walk', 'Adds conditioning load', 'Last: 3.5 km · 45 min · Sat 26 Sep', 'body', 'brass'),
    ql_dur_hero(2), col(flabel('When'), row(btn('Now', 'sec', sm=True, dis=True), chip('Earlier today', True), chip('Pick a day', False, 'calendar'), gap=6), gap=6),
    row(col(flabel('Start'), timein('21:30', label='Start'), gap=6, style='width: 150px'), txt('Today · 21:30<br><span class="t-m">21:30–22:15 · today</span>', 't-s', 'flex: 1; text-align: right'), gap=10, align='flex-end'),
    ql_dist('3.5', '12:51 /km'), ql_effort(0), ql_est('MET 3.5 × 82 kg × 0.75 h', 216), ql_pin('Walk'),
    ql_actions('Log it · 45 min', now=False), h=830)), h=900, row_=1)

# ============================================================== roles — the only role/assignment difference on these screens:
# SessionBuilderView programMode 'other' (program authored by someone else, e.g. the member's trainer) hides Day name / Save on / Save as a day.
P('P03-Builder-Review-Assigned.dc.html', 'Session builder · Review · Member with a trainer-assigned program', phone(sb_head(), sb_steps(3), txt('Review your day', 't-h1'),
    row(tag('Chest · Triceps', 'neutral'), tag('62 min', 'neutral'), tag('5 · Muscle', 'neutral'), gap=6, wrap=True),
    lbl('Main'), lst(sb_ex('Bench press', 'Recovered and due to add load.', '4×6–12', '85 kg', edit=True), sb_ex('Incline DB press', 'One of your staples on this day.', '3×6–12', '30 kg', edit=True),
                     sb_ex('Cable fly', 'A grow-focus muscle — earns extra work today.', '3×6–12', '18 kg', edit=True)),
    lbl('Today covers'), card(cov('Chest', 100, 10), cov('Triceps', 75, 6), gap=10),
    row(ibtn('back', 'Back', 'fill'), btn('Start now', 'pri', style='flex: 1'), gap=8), tabs=None, h=1000, mood='art'), h=1000, row_=1)
# ============================================================== completeness — remaining branches from the code
# StartSheet: an empty session is open (busy, not locked: exercises.length === 0) → hero "In progress", tiles stay open
P('P03-Start-EmptySession.dc.html', 'Start sheet · empty session open (not locked)', phone(*today_bg(live=True), mood='art', overlay=sheet(None,
    txt('Start', 't-h2'),
    start_hero('In progress', 'Start session', 'Resume', 'next'),
    start_grid(), h=580)), row_=1)

# StartSheet: program day with muscles only (programDayItems empty) → hero starts an empty session, no "Or start from scratch"
P('P03-Start-ProgramMuscles.dc.html', 'Start sheet · program day with target muscles only', phone(*today_bg(), mood='art', overlay=sheet(None,
    txt('Start', 't-h2'),
    start_hero('Today in program', 'Day 3', 'Upper/Lower 4× · Monday'),
    start_grid(), h=580)), row_=1)

# SessionStartCoach: a lot still recovering (severity recovering → danger tint)
P('P03-Start-Coach-Recovering.dc.html', 'Session start coach · a lot still recovering', phone(*session_bg(), tabs=None, mood='bad', overlay=sheet(None,
    lbl('Today’s read'),
    card(row(tile('pulse', 'danger'), lbl('Readiness', 'danger'), gap=10), txt('A lot is still recovering — an easy day reads better.', 't-h3'),
         row(*[row(bodymap('front' if v == 'f' else 'back', [m], region=reg, h=34), col(txt(n, 't-m'), txt(pc, f't-h3 num {c}'), gap=0), gap=6) for m, reg, v, n, pc, c in
               [('quads', 'lower', 'f', 'Quads', '41%', 'c-bad'), ('hamstrings', 'lower', 'b', 'Hamstrings', '58%', 'c-brass'), ('glutes', 'lower', 'b', 'Glutes', '47%', 'c-bad')]], gap=14, wrap=True),
         txt('Still recovering: Quads · Hamstrings · Glutes.', 't-s'), tone='danger', gap=10, style='padding: 18px'),
    card(row(ico('calendar', 18), txt('Legs 1 day', 't-h3'), gap=8),
         lst(coach_row('Squat', '140.0 × 5', tag('Hold', 'neutral')), coach_row('Romanian deadlift', '120.0 × 8', tag('Hold', 'neutral')), coach_row('Leg press', '200.0 × 10', tag('Deload', 'bad'))), gap=10),
    h=560)), row_=1)

# SessionBuilderView: goal step (only while the physique goal is unset) → 5 steps, archetype cards (Icon person)
def arche(n, b):
    return card(tile('me', 'brass', lg=True), txt(n, 't-h3'), txt(b, 't-m'), style='padding: 14px', gap=8)

P('P03-Builder-Goal.dc.html', 'Session builder · Goal (physique not set yet)', phone(sb_head(),
    row(*[col(btn(str(i + 1), 'pri' if i == 0 else 'sec', sm=True, style='padding: 0; width: 32px; height: 32px'), txt(n, 't-m c-brass' if i == 0 else 't-m', 'text-align: center'), gap=5, style='flex: 1; align-items: center')
          for i, n in enumerate(['Goal', 'Intent', 'Muscles', 'The day', 'Review'])], gap=2, align='flex-start'),
    txt('Your physique', 't-h1'),
    grid(arche('V-Taper', 'Wide shoulders, tight waist'), arche('Classic', 'Balanced, symmetrical mass'), arche('Powerbuilder', 'Size built on the big lifts'), arche('Lean Athlete', 'Conditioned and defined'), cols=2, gap=10),
    sp(), row(btn('Intent' + ico('chev', 16), 'pri', style='flex: 1'), gap=8), tabs=None, mood='art'), row_=1)

# SessionBuilderView review: cardio finisher on + day saved ("Saved ✓")
P('P03-Builder-Review-Saved.dc.html', 'Session builder · Review · cardio on, day saved', phone(sb_head(), sb_steps(3), txt('Review your day', 't-h1'),
    row(tag('Chest · Triceps', 'neutral'), tag('70 min', 'neutral'), tag('5 · Muscle', 'neutral'), gap=6, wrap=True),
    lbl('Cardio finisher'), lst(sb_ex('Incline walk', 'Zone-2 finisher to round out the day.', '10 min', icon='pulse')),
    lbl('Save on'), row(*[chip(d, d == 'Mon') for d in wds], gap=5, wrap=True),
    sp(), row(ibtn('back', 'Back', 'fill'), btn('Saved ✓', 'sec', style='flex: 1'), btn('Start now', 'pri', style='flex: 1'), gap=8), tabs=None, mood='art'), row_=1)

# BackfillSheet: no saved gyms (no Gym field) · home set list empty (only "Empty")
P('P03-LogPast-NoGyms.dc.html', 'Log a past session · no saved gyms / no home sets', phone(*today_bg(), mood='art', overlay=sheet(None,
    row(ico('history', 20), txt('Log a past session', 't-h2'), gap=8), seg(['Gym session', 'Home set'], 1),
    flabel('Which home set'), row(chip('Empty', True), gap=6),
    col(flabel('Date'), date_field('27.09.2026'), gap=6),
    row(half(flabel('Start'), time_field('07:00')), col(flabel('Duration'), dur_field('0', '10'), gap=6, style='flex: 1.4; min-width: 0'), gap=10, align='flex-start'),
    txt('No gym to pick. Duration starts at 10 min; the date can’t be later than today.', 't-m'),
    h=600, footer=row(btn('Cancel', 'sec', style='flex: 1'), btn('Continue to exercises', 'pri', style='flex: 1.6'), gap=8))), row_=2)

# GymPicker: no saved gyms — only Gyms nearby + Without a gym
P('P03-GymPicker-NoSaved.dc.html', 'Gym picker · no saved gyms yet', phone(*today_bg(), mood='art', overlay=sheet(None,
    txt('Where are you training?', 't-h2'),
    search('Search for a gym'),
    lbl('Gyms nearby'),
    lst(gym_row('Iron Temple', '0.1 km · Khreshchatyk St 22', 'Add'), gym_row('Atlet Fitness', '0.6 km · Khreshchatyk St 12', 'Add')),
    lst(li('Without a gym', None, tile('pin'))), h=520)), row_=2)

# HomeSetSheet MoveEditor: edit an own move — name taken error, Save + Delete move
P('P03-HomeSet-MoveEdit.dc.html', 'Home set · edit own move (name taken)', phone(*today_bg(), mood='art', overlay=sheet(None,
    hs_head('Edit move'),
    field('Name', 'Plank', 'Doorframe hang', state='err', err='You already have a move with this name.'),
    flabel('Measured by'), seg(['Reps', 'Hold', 'Time'], 1),
    flabel('Muscle'), row(chip('Back'), chip('Chest'), chip('Core', True), chip('Shoulders'), chip('Biceps'), chip('Triceps'), chip('Quads'), chip('Glutes'), gap=6, wrap=True),
    flabel('Icon'), row(*[ibtn(i, i, 'pri' if i == 'body' else 'fill', sm=True) for i in ['body', 'dumbbell', 'yoga', 'run', 'timer', 'flame', 'target']], gap=6, wrap=True),
    sp(), btn('Save', 'pri', full=True), btn('Delete move', 'dan', full=True), h=680)), row_=2)

# LogActivityView: an ACTIVITY is live — LiveBanner with Finish, pinned live card, "Up next" hero replaced by the queue card
P('P03-LogActivity-ActivityLive.dc.html', 'Log activity · an activity is live (queue)', phone(la_head(),
    card(row(tile('run', 'brass', lg=True), col(txt(f'{dot("brass")} In progress · since 18:10', 't-l c-brass'), txt('Run <span class="t-s">· 12:04</span> <span class="t-m">running</span>', 't-h2'), gap=4, style='flex: 1'), gap=12),
         row(btn('Resume', 'sec', 'play', style='flex: 1'), btn('Finish', 'pri', 'check', style='flex: 1'), gap=8), tone='hero', gap=12),
    search('Search activities'),
    card(row(ico('lock', 16), txt('<b>Finish Run first</b> to start another. You can still log one you did earlier.', 't-s', 'flex: 1'), gap=10), style='padding: 10px 14px'),
    section('After Run, usually', 'from your last 4 Mondays'),
    card(row(tile('flame', 'rest'), col(txt('Sauna · ~20 min', 't-h3'), txt('Offered when you tap Finish · 3 of 4', 't-m'), gap=2, style='flex: 1'), btn('Queue', 'sec', sm=True), gap=12), style='padding: 12px 14px'),
    row(lbl('Pinned <span class="t-m">4</span>'), sp(), txt('Tap = log past', 't-m'), style='min-height: 32px'),
    grid(card(row(tile('run', 'brass'), col(txt('Run', 't-h3'), txt('Live 12:04', 't-m c-brass'), gap=1), gap=10), tone='glass', style='padding: 10px 12px'),
         pcard('Walk', 'Log past', 'body', 'brass'), pcard('Football', 'Log past', 'target', 'sport'), pcard('Sauna', 'Log past', 'flame', 'rest'), cols=2, gap=8),
    *browse(locked=True, hint='Start locked · log past'),
    tabs=None, h=1320, mood='art'), h=1320, row_=1)

# LogActivityView hero kind 'upnext' + also-card done state
P('P03-LogActivity-UpNext.dc.html', 'Log activity · up next after an activity, also-card done', phone(la_head(), search('Search activities'),
    card(row(span(ico('next', 14) + ' Up next · after Run', 't-l c-rest'), sp(), ibtn('x', 'Not now, hide this suggestion', sm=True)),
         row(tile('flame', 'rest', lg=True), col(txt('Sauna ~20 min?', 't-h1'), txt('After Run you usually wind down with Sauna', 't-s'), gap=2, style='flex: 1'), gap=12),
         row(btn('Start', 'sec', 'play', style='flex: 1'), btn('Log ~20 min', 'pri', style='flex: 1'), gap=8),
         txt('3 of your last 4 Run days ended with Sauna', 't-m', 'text-align: center'), tone='hero', gap=12, style='padding: 18px 16px 14px'),
    section('Also on your Mondays'),
    grid(card(row(tile('body', 'brass'), sp(), span(ico('check', 14) + ' Done', 't-s c-ok')), txt('Walk · 20 min', 't-h3'), txt('Logged 07:50', 't-m'), style='padding: 12px', gap=6),
         card(row(tile('yoga', 'rest'), sp(), span('+ Log', 't-s c-brass')), txt('Yoga · ~15 min', 't-h3'), txt('Evenings · 2 of 4', 't-m'), style='padding: 12px', gap=6), cols=2, gap=8),
    *pinned(), tabs=None, h=1040, mood='art'), h=1040, row_=1)

# QuickLog: "Other sport" logged under the user's own name + no body weight (actNoWeight)
P('P03-QuickLog-OtherSport.dc.html', 'Quick log · other sport by name, no body weight', phone(la_head(), search(value='kitesurf'), tabs=None, mood='art', h=900, overlay=_sheet(None,
    ql_head('kitesurf', 'Adds conditioning load', None, 'trophy', 'sport'),
    ql_dur_hero(3), ql_when(0), txt('Ends now · 17:40–18:40', 't-s'),
    ql_effort(1),
    row(col(txt('Estimate', 't-s'), txt('Add your weight to see calories', 't-m'), gap=2, style='flex: 1'), gap=10, style='padding: 4px 2px'),
    ql_pin('Other sport', False),
    ql_actions('Log it · 60 min'), h=760)), h=900, row_=2)
print('ok')
