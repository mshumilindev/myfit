"""P02 · Widget library — production pass.

Source of truth = the app code (client/src/today/widgets/*.tsx + *.strings.ts, components/ui/Widget.css,
ShortcutTile.css, today/shortcuts.tsx, today/WidgetLibrary.tsx). The canvas library (L0–L11, K1, T0) is the design
origin; where the code differs, the code wins (listed in fidelity/P02.md). Mock values follow the canvas.

Widget frame = Widget.tsx: kicker (10.5 px caps, tone text colour) · badge (12 px muted) · body · headline
(value 28 px bold + 13 px unit · 16 px name · 12 px sub) · footer. M = 36 px icon tile + 14.5 px title + sub + trailing.
"""
from kit import *

GYM = 'Iron Temple'
TMAP = {'accent': 'brass'}


def T_(tone):
    return TMAP.get(tone, tone)


# ============================================================== Widget.tsx twin
def kick(text, tone):
    tn = {'accent': 'brass', 'danger': 'bad'}.get(tone, tone)
    cls = 't-l' if tn == 'neutral' else f't-l c-{tn}'
    return txt(text, cls, 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0')


def frame(size, inner, tone=''):
    """Widget.css .uiw: S/L min-height 150, XL aspect 1:1 minimum — content-rich widgets grow, never clip."""
    w, h = WSIZE[size]
    return card(inner, tone=tone, pad=False, gap=10 if size == 'XL' else 8,
                style=f'width: {w}px; min-height: {h}px; padding: 14px; position: relative; overflow: hidden')


def val(v, unit=None, cls='t-num'):
    u = f'<span class="t-m" style="margin-left: 3px">{unit}</span>' if unit else ''
    return f'<div class="num {cls}">{v}{u}</div>'


def W(size, tone='neutral', kicker=None, badge=None, value=None, unit=None, title=None, sub=None, body=None,
      footer=None, bodyLast=False, icon=None, trailing=None, go=True, vcls='t-num', sub_wrap=False):
    t = T_(tone)
    if size == 'M':
        lead = tile(icon or 'spark', t) if icon else ''
        head = title if title is not None else (val(value, unit, 't-h3') if value is not None else '')
        mid = col(txt(head, 't-h3', 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis') if isinstance(head, str) and not head.startswith('<') else head,
                  txt(sub, 't-m', 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis') if isinstance(sub, str) else (sub or ''), gap=1, style='flex: 1; min-width: 0')
        tr = trailing if trailing is not None else (ibtn('chev', 'Open', 'fill', sm=True, style='width: 30px; height: 30px') if go else '')
        return widget('M', '', lead + mid + tr)
    head = row(kick(kicker, tone) if kicker else '', sp(), txt(badge, 't-m', 'white-space: nowrap') if isinstance(badge, str) else (badge or ''), gap=8, style='min-height: 16px') if (kicker or badge) else ''
    hl = []
    if value is not None:
        hl.append(val(value, unit, vcls))
    if title is not None:
        hl.append(txt(title, 't-h3') if isinstance(title, str) else title)
    if sub is not None:
        hl.append(txt(sub, 't-m', '' if sub_wrap else 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis') if isinstance(sub, str) else
                  (f'<div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0">{sub}</div>' if sub.startswith('<span') else sub))
    b = body if isinstance(body, str) else (''.join(body) if body else '')
    bodyd = col(b, gap=8, style='flex: 1 1 auto; min-height: 0') if b else ''
    if bodyLast:
        headline = col(*hl, gap=4) if hl else ''
        parts = [head, headline, bodyd]
    else:
        headline = col(*hl, gap=4, style='margin-top: auto') if hl else ''
        parts = [head, bodyd, headline]
    ft = row(*footer, gap=8) if isinstance(footer, (list, tuple)) else (footer or '')
    parts.append(ft)
    return frame(size, col(*parts, gap=10 if size == 'XL' else 8, style='flex: 1; min-height: 0'))


def Empty(size, tone, icon, kicker, title, sub=None, action=None):
    """WidgetEmpty: S = kicker + title · M = row + '+' · L = title + sub + action · XL = centred icon tile above."""
    if size == 'M':
        return W('M', tone, icon=icon, title=title, sub=sub, trailing=ibtn('plus', action or 'Add', 'fill', sm=True) if action else None)
    body = col(tile(icon, T_(tone), lg=True, s=30), style='flex: 1; align-items: center; justify-content: center') if size == 'XL' else None
    return W(size, tone, kicker=kicker, title=title, sub=None if size == 'S' else sub, body=body,
             footer=btn(action, 'pri', 'plus', sm=True) if (action and size != 'S') else None)


def Delta(t, good=None):
    g = good if good is not None else not t.strip().startswith('−')
    return span(t, 't-s c-ok' if g else 'c-bad t-s')


def TT(t, tone, strong=False):
    """ToneText: text in a family's text colour."""
    tn = {'accent': 'brass', 'danger': 'bad'}.get(tone, tone)
    cls = '' if tn == 'neutral' else f' c-{tn}'
    return f'<span class="t-s{cls}">{t}</span>'


def Bars(values, h=52, hi=None, labels=None, tone='accent', w=326):
    return bars(values, w, h + (16 if labels else 0), T_(tone), hi, labels)


def Rect(hex_, w='100%', h=10, r=3):
    """a data-coloured block (kit swatch, resized)."""
    ws = w if isinstance(w, str) else f'{w}px'
    return swatch(hex_, 1, r).replace('width: 1px; height: 1px', f'width: {ws}; height: {h}px')


def ColBars(values, his=(), h=52, tone='accent', labels=None, gap=5):
    """WidgetBars with several highlighted columns (is-on = tone, rest neutral-800)."""
    mx = max(values) or 1
    on = ACCENT[T_(tone)]
    cols_ = [col(sp(), Rect(on if i in his else '#2a2c30', 'min(100%, 28px)', max(4, v / mx * h), 4), style=f'height: {h}px; flex: 1; min-width: 0; align-items: center; justify-content: flex-end') for i, v in enumerate(values)]
    out = row(*cols_, gap=gap, align='flex-end')
    if labels:
        out = col(out, row(*[m(l_, 'flex: 1; text-align: center; white-space: nowrap') for l_ in labels], gap=gap), gap=4)
    return out


def Spark(pts, h=64, tone='ok', area=False, w=326):
    return spark(pts, w, h, T_(tone), area)


def Bar(v, tone='accent', h=6):
    return bar(max(0, min(100, v * 100)), T_(tone), h)


def Ring(v, s_=84, tone='accent', label=''):
    return ring(max(0, min(100, v * 100)), s_, T_(tone), 5 * s_ / 58, label)


def RL(v, small=None):
    """uiw-ring-label: 20 px bold + 10 px small."""
    return col(txt(v, 't-h2 num'), txt(small, 't-m') if small else '', gap=0, style='align-items: center')


def List(rows_):
    """WidgetList: 13.5 px/600 label, 12 px muted value, optional 30 px tone tile, hairlines."""
    out = []
    for i, r_ in enumerate(rows_):
        lab, v = r_[0], r_[1] if len(r_) > 1 else None
        ic = r_[2] if len(r_) > 2 else None
        tn = r_[3] if len(r_) > 3 else 'neutral'
        lead = tile(ic, T_(tn), s=16) if ic else ''
        labd = txt(lab, 't-s c-mut', 'flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis') if isinstance(lab, str) else f'<div style="flex: 1; min-width: 0">{lab}</div>'
        vd = txt(v, 't-m', 'white-space: nowrap') if isinstance(v, str) else (v or '')
        out.append(row(lead, labd, vd, gap=10, style='padding: 6px 0' + ('; border-top: 0' if i == 0 else '')))
    return f'<div class="uiw-list">{"".join(out)}</div>'


def LI(lab, v, strong_lab=True):
    return (b(lab) if strong_lab else lab, v)


def Stats(items):
    return grid(*[card(txt(a, 't-m'), txt(v, 't-s num c-mut'), style='padding: 8px 10px', gap=2) for a, v in items], cols=len(items), gap=8)


def Dots(values, h=10, tone='accent'):
    return grid(*[bar(100 if on else 0, T_(tone), h) for on in values], cols=len(values), gap=6)


def StackBar(parts, h=10):
    tot = sum(p for p, _ in parts) or 1
    return row(*[col(bar(100, T_(t), h), style=f'width: {p * 100 / tot:.1f}%') for p, t in parts], gap=2)


def Chips(items, tone='neutral'):
    return row(*[tag(x, T_(tone)) for x in items], gap=6, wrap=True)


def B(t, kind='pri', icon=None, full=False):
    return btn(t, kind, icon, sm=True, full=full)


def b(t, style=''):
    return txt(t, 't-b', style)


def m(t, style=''):
    return txt(t, 't-m', style)


def s_(t, style=''):
    return txt(t, 't-s', style)


# ============================================================== board scaffolding (WidgetLibrary.tsx twin)
BW = 1640


def wrow(name, wid, cells):
    """wlib-row: name + id, then S · M · L · XL cells."""
    head = row(txt(name, 't-h3'), m(wid), gap=8, align='baseline')
    cs = [col(txt(sz, 't-l'), c, gap=6, style=f'width: {171 if sz == "S" else 358}px') for sz, c in zip(['S', 'M', 'L', 'XL'], cells)]
    return col(head, row(*cs, gap=18, align='flex-start'), gap=10)


def H_ROW(x):
    return 392 if 'min-height: 330px' in x else 220


import json as _json
_HF = '/tmp/claude-0/-home-claude/3dc3a19d-8146-52f2-8513-ed1bbd9c77ae/scratchpad/p02_heights.json'
try:
    HEIGHTS = _json.load(open(_HF))
except Exception:
    HEIGHTS = {}


def fit(file, guess):
    """board height = measured content height (p02_heights.json, written by the measuring pass) or a generous guess."""
    return HEIGHTS.get(file, guess)


def group_board(file, title, widgets_, note=None):
    h = fit(file, 200 + sum(H_ROW(x) + 120 for x in widgets_))
    head = col(lbl('Widget library', 'brass'), txt(title, 't-d1'), s_(note) if note else '', gap=6, style='width: 100%')
    board(file, title, BW, h, spec('', head, col(*widgets_, gap=34), w=BW, h=h), row_=0)


# ============================================================== TRAINING (training.tsx)
VOL8 = [11.2, 12.6, 10.2, 14.3, 13.4, 15.9, 14.7, 18.2]
E1 = [92, 93, 93, 95, 96, 97, 98, 99, 100, 100, 101, 102]


def goals_chips(items, tone, arrow):
    return Chips([f'{x} {arrow}' for x in items], tone)


training = [
    wrow('Volume · 8 weeks', 'weekly-volume', [
        W('S', 'accent', kicker='This week', value='18.2', unit='t', sub=Delta('+8% vs 8-week avg')),
        W('M', 'accent', icon='chart', title='18.2 t this week', sub='+8% vs 8-week avg'),
        W('L', 'accent', kicker='Volume · 8 weeks', badge=Delta('+8%'), value='18.2', unit='t', bodyLast=True, body=Bars(VOL8, 52, 7)),
        W('XL', 'accent', kicker='Volume · 8 weeks', badge=Delta('+8%'), value='18.2', unit='t', bodyLast=True,
          body=[Bars(VOL8, 110, 7), List([('21 Sep', '18.2 t'), ('14 Sep', '14.7 t'), ('7 Sep', '15.9 t'), ('31 Aug', '13.4 t')])]),
    ]),
    wrow('Lift record', 'lift-record', [
        W('S', 'accent', kicker='Bench press e1RM', value='102', unit='kg', sub=Delta('+2.5 · 4 wks')),
        W('M', 'accent', icon='progress', title='Bench press · 102 kg', sub='est. 1RM', trailing=Delta('+2.5')),
        W('L', 'accent', kicker='Bench press e1RM', badge=Delta('+2.5 · 4 wks'), value='102', unit='kg', bodyLast=True, body=Spark(E1, 56, 'ok', True)),
        W('XL', 'accent', kicker='Bench press · e1RM', badge=TT('PR · 3 d ago', 'ok'), value='102', unit='kg', sub=Delta('+2.5 · 4 wks'), bodyLast=True,
          body=[Spark(E1, 96, 'ok'), List([('Tue · Chest 2', '4 × 8 · 82.5 kg'), ('Fri · Chest 1', '4 × 8 · 80 kg'), ('Mon · Chest 2', '3 × 10 · 77.5 kg')])],
          footer=B('Change lift', full=True)),
    ]),
    wrow('Activities', 'activities-week', [
        W('S', 'active', kicker='Active this week', value='310', unit='min', sub='4 activities'),
        W('M', 'active', icon='run', title='310 min active', sub='Dance · Run · Sauna'),
        W('L', 'active', kicker='This week', badge='1 480 kcal', value='310', unit='min', bodyLast=True,
          sub=row(TT('Dance 160', 'active'), TT('Run 95', 'active'), TT('Sauna 55', 'rest'), gap=12), body=StackBar([(160, 'active'), (95, 'active'), (55, 'rest')])),
        W('XL', 'active', kicker='Activities · this week', badge='1 480 kcal', value='310', unit='min', bodyLast=True,
          body=List([('Dance', 'Sat · 35 min', 'music', 'active'), ('Sauna', 'Wed · 55 min', 'flame', 'rest'), ('Run', 'Wed · 5.2 km · 31 min', 'run', 'active'), ('Dance', 'Mon · 125 min', 'music', 'active')]),
          footer=B('Log activity', icon='plus', full=True)),
    ]),
    wrow('Weekly recap', 'weekly-recap', [
        W('S', 'accent', kicker='Recap', badge=TT('●', 'accent'), title='Your week is ready', sub='21 Sep – 27 Sep · 2 PRs'),
        W('M', 'accent', icon='note', title='Your week is ready', sub='21 Sep – 27 Sep · 4 sessions'),
        W('L', 'accent', kicker='Recap · 21 Sep – 27 Sep', title='4 sessions · 49.2 t · 2 PRs', bodyLast=True, body=Dots([1, 0, 0, 0, 0], 3)),
        W('XL', 'accent', kicker='Recap · 21 Sep – 27 Sep', value='4 sessions.<br>49.2 tonnes.<br>2 new PRs.', vcls='t-num', sub='Your biggest week in 5 weeks.',
          body=Dots([1, 0, 0, 0, 0], 3), footer=B('Watch week 39 recap', icon='play', full=True)),
    ]),
    wrow('Goals', 'goals', [
        W('S', 'accent', kicker='Goal', title='Lean Athlete', sub='3 muscles in focus'),
        W('M', 'accent', icon='target', title='Lean Athlete · 3 in focus', sub='Grow Shoulders, Back, Calves'),
        W('L', 'accent', kicker='Goal · Lean Athlete', sub='Ease: Forearms · rest on hold', body=goals_chips(['Shoulders', 'Back', 'Calves'], 'ok', '↑')),
        W('XL', 'accent', kicker='Goal · archetype', badge='since 14 Aug', title='Lean Athlete', sub='Conditioned and defined', bodyLast=True,
          body=List([(goals_chips(['Shoulders', 'Back', 'Calves'], 'ok', '↑'), 'Grow'), (goals_chips(['Chest', 'Quads', 'Arms'], 'neutral', '='), 'Hold'),
                     (goals_chips(['Forearms'], 'rest', '↓'), 'Ease'), ('Shoulders', '9 / 16 sets'), ('Back', '11 / 18 sets')]),
          footer=B('Edit goal', full=True)),
    ]),
    wrow('Playbook', 'playbook', [
        W('S', 'accent', kicker='Playbook', badge='3 plays', title='Pull day', sub='Back isn’t covered'),
        W('M', 'accent', icon='layers', title='3 plays learned', sub='Today: Pull day', trailing=B('Start', icon='play')),
        W('L', 'accent', kicker='Playbook', badge='1 of 3', title='Pull day', sub='Back isn’t covered', footer=[B('Start', icon='play'), B('All plays', 'sec')]),
        W('XL', 'accent', kicker='Playbook · play 1 of 3', badge='6 sessions', title='Pull day', sub='Back isn’t covered', bodyLast=True,
          body=List([('Pull-up', '4 × 8 · 10 kg'), ('Barbell row', '4 × 8 · 70 kg'), ('Lat pulldown', '3 × 10 · 60 kg'), ('Face pull', '3 × 15 · 22.5 kg'), ('Hammer curl', '3 × 12 · 16 kg')]),
          footer=[f'<div style="flex: 1; display: flex">{B("Start this play", icon="play", full=True)}</div>', B('All plays', 'sec')]),
    ]),
]


def weak_rows(n):
    return [(col(b('Rear delts'), Bar(0.4, 'injury', 4), gap=4), TT('4 / 10 sets', 'injury')), (col(b('Hamstrings'), Bar(0.5, 'injury', 4), gap=4), TT('6 / 12 sets', 'injury'))][:n]


training += [
    wrow('Weak points', 'weak-points', [
        W('S', 'injury', kicker='Weak points', value='2', unit='lagging', sub='Rear delts · Hamstrings'),
        W('M', 'injury', icon='warn', title='2 weak points', sub='Rear delts · Hamstrings'),
        W('L', 'injury', kicker='Weak points', body=List(weak_rows(2))),
        W('XL', 'injury', kicker='Weak points · 6 weeks', badge='Under minimum 4 of 6 weeks',
          body=[List(weak_rows(2)), TT(f'Fix-it · at {GYM}', 'injury'),
                List([(f'Reverse pec deck · Rear delts · 3 × 15', B('Add', icon='plus')), ('Face pull · Rear delts · 3 × 15', B('Add', icon='plus')), ('Romanian deadlift · Hamstrings · 3 × 8', B('Add', icon='plus'))])]),
    ]),
    wrow('Fatigue & deload', 'fatigue-deload', [
        W('S', 'rest', kicker='Fatigue', badge=TT('Moderate', 'accent'), value='64', unit='/ 100', sub='Ease off Chest this week', body=Bar(0.64, 'accent')),
        W('M', 'rest', icon='pulse', title='Fatigue: moderate', sub='Ease off Chest this week'),
        W('L', 'rest', kicker='Fatigue', badge=TT('Moderate', 'accent'), title='Chest stalled', sub='Ease off Chest this week', bodyLast=True, body=Bar(0.64, 'accent', 8)),
        W('XL', 'rest', kicker='Fatigue · 6 weeks', badge='Ease off Chest this week', value='64', unit='/ 100 · moderate', bodyLast=True,
          body=[Spark([40, 44, 47, 52, 55, 58, 61, 64], 72, 'accent', True), List([('Chest', TT('stalled', 'injury')), ('Quads', '19 / 22 sets'), ('Weekly volume', '+8% vs 4-wk avg')])],
          footer=B('Plan deload week', full=True)),
    ]),
    wrow('Gyms', 'my-gym', [
        W('S', 'neutral', kicker='My gym', title=GYM, sub='1.2 km · 2 days ago'),
        W('M', 'neutral', icon='pin', title=f'{GYM} · 1.2 km', sub='Last visit 2 days ago'),
        W('L', 'neutral', kicker='My gym', badge='1.2 km', title=GYM, sub='12 visits this month', footer=B('Start here', icon='dumbbell')),
        W('XL', 'neutral', kicker='My gym', badge='1.2 km', title=GYM, sub='Last visit 2 days ago · 12 visits this month',
          body=[col(tile('pin', 'neutral', lg=True, s=30), style='flex: 1; align-items: center; justify-content: center'),
                Chips(['Power rack', 'Dumbbells', 'Cable station', 'Leg curl', 'Flat bench', '+4']), TT('Chest 1 fits here · all exercises available', 'ok')],
          footer=B('Start here', icon='dumbbell', full=True)),
    ]),
]


def Heat(colors, width):
    """MuscleHeatmap: front + back figures side by side in `width` px (colours per group, rest dimmed)."""
    hw = width / 2
    return row(bodymap('front', paint=colors, w=hw), bodymap('back', paint=colors, w=hw), gap=0, style=f'width: {width}px; flex: none')


A7 = '#8a642e'   # --color-accent-700
LEG_COLORS = {'quads': 'brass', 'glutes': 'brass', 'hamstrings': A7, 'calves': A7, 'lower_back': A7}


def dayT(d, lab, ic, tn):
    return col(m(d), tile(ic, T_(tn)), m(lab), gap=6, style='align-items: center; min-width: 0')


# ============================================================== PLAN & SESSIONS (plan.tsx)
plan = [
    wrow('Next workout', 'next-workout', [
        W('S', 'accent', kicker='Next up', title='Chest 2', sub='Day 4 of 6 · 6 exercises', footer=m('~55 min · today')),
        W('M', 'accent', icon='play', title='Chest 2 · today', sub='MS - 6 days · 6 exercises · ~55 min', trailing=B('Start', icon='play')),
        W('L', 'accent', kicker='Next workout · MS - 6 days', badge='Day 4 of 6', title='Chest 2',
          body=row(tag('Incline bench press', 'neutral'), tag('Flat DB press', 'neutral'), tag('+4', 'neutral'), gap=6, style='overflow: hidden'),
          footer=[m(f'~55 min · {GYM}', 'flex: 1'), B('Start', icon='play')]),
        W('XL', 'accent', kicker='Next workout · week 3', badge='Day 4 of 6', title='Chest 2', sub=f'6 exercises · 20 sets · ~55 min · {GYM}', bodyLast=True,
          body=List([('Incline bench press', '4×6 · last 80 kg'), ('Flat DB press', '3×10 · last 34 kg'), ('Weighted dips', '3×8 · last 20 kg'), ('Cable fly', '3×12 · last 17.5 kg'), ('Landmine press', '3×10 · last 30 kg'), ('Push-ups', '1×AMRAP')]),
          footer=[m('Last done Thu, 24 Sep', 'flex: 1'), B('Start', icon='play')]),
    ]),
    wrow('Quick session builder', 'quick-session-builder', [
        W('S', 'accent', kicker='Quick session', value='45', unit='min', sub=f'Upper · {GYM}', footer=B('Build', full=True)),
        W('M', 'accent', icon='spark', title='Build me a session', sub=f'45 min · Upper · {GYM}', trailing=B('Build')),
        W('L', 'accent', kicker='Build me a session', badge='~5 exercises', body=seg(['30 min', '45 min', '60 min'], 1), footer=[m(f'Upper · {GYM}', 'flex: 1'), B('Generate')]),
        W('XL', 'accent', kicker='Build me a session', badge=GYM,
          body=[seg(['30 min', '45 min', '60 min'], 1), row(*[chip(x, x == 'Upper') for x in ['Auto', 'Upper', 'Push', 'Pull', 'Legs', 'Full']], gap=6, wrap=True),
                List([('Overhead press', '4×6'), ('Chin-up', '4×8'), ('Incline dumbbell press', '3×10'), ('Chest-supported row', '3×10')])],
          footer=[B('Regenerate', 'sec', 'rotate'), f'<div style="flex: 1; display: flex">{B("Start · 44 min", icon="play", full=True)}</div>']),
    ]),
    wrow('Warm-up', 'warm-up', [
        W('S', 'accent', kicker='Warm-up', badge='~9 min', title='4 ramp sets → 80 kg', sub='Incline bench press · + mobility', body=Bars([20, 40, 55, 70, 80], 30, 4, w=141)),
        W('M', 'accent', icon='flame', title='Warm-up · Incline bench press', sub='4 ramp sets → 80 kg · Mobility · 5 min'),
        W('L', 'accent', kicker='Warm-up · Incline bench press', badge='work 80 kg', body=Stats([('Bar', '×10'), ('40', '×5'), ('55', '×3'), ('70', '×1'), ('80', '4×6')]),
          footer=m('+ Arm circles 30s · Band pull-apart ×15 · T-spine rotation ×8')),
        W('XL', 'accent', kicker='Warm-up · Chest 2', badge='~9 min', title='Incline bench press → 80 kg', bodyLast=True,
          body=[List([('Bar 20 kg', '×10'), ('40 kg', '×5'), ('55 kg', '×3'), ('70 kg', '×1'), ('Working 80 kg', '4×6')]), kick('Mobility · 5 min', 'neutral'),
                List([('Arm circles', '30s'), ('Band pull-apart', '×15'), ('T-spine rotation', '×8')])],
          footer=B('Start session', full=True)),
    ]),
    wrow('Program progress', 'program-progress', [
        W('S', 'accent', kicker='MS - 6 days', value='3', unit='of 8 weeks', sub='93% adherence', body=Bar(3 / 8)),
        W('M', 'accent', icon='plan', title='Week 3 of 8 · MS - 6 days', sub='14 of 15 sessions · 93% adherence'),
        W('L', 'accent', kicker='Program · MS - 6 days', badge='93%', value='Week 3', unit='of 8', bodyLast=True,
          body=ColBars([6, 6, 3, .15, .15, .15, .15, .15], (0, 1, 2), 30),
          footer=m('14 done · 1 missed · 33 to go')),
        W('XL', 'accent', kicker='Program · MS - 6 days', badge='Week 3 of 8',
          body=[row(Ring(0.93, 72, 'accent', RL('93%')), col(val('14', 'of 48 sessions'), m('adherence · 1 missed · 33 to go'), gap=2), gap=16),
                ColBars([6, 6, 3, .15, .15, .15, .15, .15], (0, 1, 2), 40, labels=[f'W{i}' for i in range(1, 9)]),
                List([('Missed', 'Legs 2 · Sat 19 Sep'), ('This week', '3 done')])],
          footer=[m('Ends Sun, 22 Nov', 'flex: 1'), B('Open program ›', 'sec')]),
    ]),
    wrow('This week’s plan', 'week-plan', [
        W('S', 'accent', kicker='This week', badge='3 of 6 done', title='Today · Chest 2', sub='Next: Fri', body=Dots([1, 1, 1, 0, 0, 0, 0], 10, 'ok')),
        W('M', 'accent', icon='calendar', title='Today · Chest 2', sub='Fri · Back + Arms · Sun · Rest'),
        W('L', 'accent', kicker='This week', badge='3 of 6 done',
          body=grid(*[dayT(d, n, ic, tn) for d, n, ic, tn in [('Mo', 'Chest 1', 'check', 'ok'), ('Tu', 'Pull', 'check', 'ok'), ('We', 'Legs', 'check', 'ok'), ('Th', 'Chest 2', 'play', 'accent'), ('Fr', 'Back', 'dumbbell', 'neutral'), ('Sa', 'Legs 2', 'dumbbell', 'neutral'), ('Su', 'Rest', 'moon', 'rest')]], cols=7, gap=6)),
        W('XL', 'accent', kicker='This week · 28 Sep – 4 Oct', badge='3 of 6 done',
          body=List([('Mon · Chest 1', '58 min', 'check', 'ok'), ('Tue · Pull + Shoulders', '64 min', 'check', 'ok'), ('Wed · Legs', '1h 12m', 'check', 'ok'), ('Thu · Chest 2 · today', '~55 min', 'play', 'accent'),
                     ('Fri · Back + Arms', '~60 min', 'dumbbell', 'neutral'), ('Sat · Legs 2', '~65 min', 'dumbbell', 'neutral'), ('Sun · Rest', 'recover', 'moon', 'rest')]),
          footer=m('Next week starts Mon, 5 Oct')),
    ]),
    wrow('Time to train', 'time-to-train', [
        W('S', 'neutral', kicker='Usual time', value='19:00', sub=f'in 1h 20m · Chest 2 · {GYM}'),
        W('M', 'neutral', icon='clock', title='You usually train at 19:00', sub='in 1h 20m · Chest 2'),
        W('L', 'neutral', kicker='Time to train', badge='from 17 sessions',
          body=row(col(val('19:00'), m('in 1h 20m'), m(f'Chest 2 · {GYM}'), gap=2), col(Bars([1, 2, 4, 9, 3, 1], 44, 3, ['15', '17', '18', '19', '20', '21'], w=190), style='flex: 1'), gap=16, align='flex-end', style='flex: 1')),
        W('XL', 'neutral', kicker='Time to train · last 60 days', badge='17 sessions', value='19:00', unit='usual start', sub='in 1h 20m', bodyLast=True,
          body=[Bars([0, 1, 0, 1, 0, 1, 2, 9, 3, 0], 48, 7, ['06', '08', '10', '12', '14', '16', '18', '19', '20', '22'], 'neutral'), List([('Today · Chest 2', '19:00'), ('Fri · Back + Arms', '19:00'), ('Sat · Legs 2', '11:00 · weekend')])],
          footer=[m('Reminder 30 min before', 'flex: 1'), B('Start now', icon='play')]),
    ]),
    wrow('Rest timer', 'rest-timer', [
        W('S', 'rest', kicker='Rest · running', body=row(Ring(0.7, 64, 'rest', txt('1:24', 't-s num')), col(m('of 2:00'), m('set 2/4'), gap=0), gap=10),
          footer=[B('+15s', 'sec'), B('Skip', 'sec')]),
        W('M', 'rest', icon='timer', title='1:24 of 2:00', sub='Incline bench press · set 2/4', trailing=B('+15s', 'sec')),
        W('L', 'rest', body=row(Ring(0.7, 96, 'rest', RL('1:24', 'of 2:00')),
                                  col(kick('Rest · running', 'rest'), txt('Incline bench press · 2/4', 't-h3'), m('Next: 80 kg × 6'), row(B('−15s', 'sec'), B('+15s', 'sec'), B('Skip'), gap=6), gap=4), gap=16, style='flex: 1')),
        W('XL', 'rest', kicker='Rest · Chest 2', badge='set 2/4',
          body=[row(Ring(0.7, 120, 'rest', RL('1:24', 'of 2:00')), col(txt('Incline bench press', 't-h3'), Dots([1, 1, 0, 0], 4, 'rest'), m('Last: 80 kg × 6'), m('Next: 80 kg × 6'), gap=4, style='flex: 1'), gap=16),
                row(m('Up next · Flat DB press'), sp(), m('3×10 · 34 kg'))],
          footer=[B('−15s', 'sec'), B('+15s', 'sec'), sp(), B('Skip')]),
    ]),
    wrow('Last session', 'last-session', [
        W('S', 'accent', kicker='Last session', title='Legs', sub='1h 12m · 14.6 t', footer=m('2 PR · yesterday')),
        W('M', 'accent', icon='history', title='Legs · yesterday', sub='1h 12m · 14.6 t · 22 sets', trailing=tag('2 PR')),
        W('L', 'accent', kicker='Last session · yesterday', badge=GYM, title='Legs', body=Stats([('time', '1h 12m'), ('volume', '14.6 t'), ('sets', '22'), ('PRs', '2')]), bodyLast=True),
        W('XL', 'accent', kicker='Last session · Wed, 30 Sep', badge='RPE 8.0', title='Legs', sub='1h 12m · 14.6 t · 22 sets', bodyLast=True,
          body=List([('Barbell full squat', 'PR 5×5 · 120 kg'), ('Romanian deadlift', '4×8 · 100 kg'), ('Leg press', 'PR 3×12 · 220 kg'), ('Walking lunge', '3×12 · 24 kg'), ('Seated leg curl', '3×12 · 50 kg'), ('Seated calf raise', '4×15 · 80 kg')]),
          footer=[m(f'410 kcal · {GYM}', 'flex: 1'), B('Summary ›', 'sec')]),
    ]),
    wrow('Last session muscles', 'last-session-muscles', [
        W('S', 'accent', kicker='Worked · yesterday', body=row(Heat(LEG_COLORS, 64), col(txt('Legs', 't-h3'), m('Quads, Glutes'), m('+3 secondary'), gap=0, style='min-width: 0'), gap=10, style='flex: 1')),
        W('M', 'accent', icon='body', title='Legs · yesterday', sub='Quads, Glutes · +3 secondary'),
        W('L', 'accent', body=row(Heat(LEG_COLORS, 130), col(txt('Legs · yesterday', 't-h3'), m('● Quads, Glutes'), m('○ Hamstrings, Calves, Lower back'), m('22 sets · 5 muscle groups'), gap=4, style='min-width: 0'), gap=14, style='flex: 1')),
        W('XL', 'accent', kicker='Worked · Legs · Wed, 30 Sep', badge='22 sets',
          body=[col(Heat(LEG_COLORS, 165), style='flex: 1; align-items: center; justify-content: center'),
                row(tag('Quads 9'), tag('Glutes 7'), tag('Hamstrings 4', 'neutral'), tag('Calves 4', 'neutral'), tag('Lower back 2', 'neutral'), gap=6, wrap=True)]),
    ]),
    wrow('Session energy', 'session-energy', [
        W('S', 'kcal', kicker='Last workout', value='410', unit='kcal', sub='Legs · 1h 12m'),
        W('M', 'kcal', icon='flame', title='410 kcal · Legs', sub='yesterday · 5.7 kcal/min'),
        W('L', 'kcal', kicker='Session energy · Legs', badge='yesterday',
          body=row(col(val('410', 'kcal'), m('5.7 kcal/min · 1h 12m'), Delta('+29 vs avg'), gap=2), col(Bars([360, 380, 350, 390, 370, 380, 410], 44, 6, tone='kcal', w=170), m('last 7 · avg 381'), gap=2, style='flex: 1'), gap=16, align='flex-end', style='flex: 1')),
        W('XL', 'kcal', kicker='Session energy · Wed, 30 Sep', badge='Legs', value='410', unit='kcal', sub='5.7 kcal/min · 1h 12m', bodyLast=True,
          body=[Bars([340, 360, 350, 380, 370, 390, 360, 380, 410], 56, 8, tone='kcal'), m('last 9 · avg 381'), List([('Working sets', '52 min · 340 kcal'), ('Rest between sets', '14 min · 45 kcal'), ('Warm-up', '6 min · 25 kcal')])],
          footer=[m('This week 1150 kcal · 3 sessions', 'flex: 1'), B('Summary ›', 'sec')]),
    ]),
    wrow('Effort trend', 'effort-trend', [
        W('S', 'accent', kicker='Effort · RPE', value='7.8', unit='avg', sub='in zone 7–8.5', body=Spark([7.6, 8.0, 7.4, 7.9, 7.7, 7.8, 7.8], 24, 'accent', w=141)),
        W('M', 'accent', icon='pulse', title='Avg RPE 7.8', sub='last 10 sessions · in zone', trailing=spark([7.6, 8.1, 7.3, 8.0, 7.7, 7.9, 7.8], 72, 28, 'brass', False)),
        W('L', 'accent', kicker='Effort · last 10 sessions', badge='zone 7–8.5', value='7.8', unit='avg RPE', bodyLast=True, body=Spark([7.6, 7.9, 7.3, 8.3, 7.7, 7.9, 7.6, 7.9, 7.9, 7.8], 48, 'accent')),
        W('XL', 'accent', kicker='Effort · last 10 sessions', badge='10/10 in zone', value='7.8', unit='avg RPE', sub='zone 7–8.5', bodyLast=True,
          body=[Spark([7.6, 7.9, 7.3, 8.3, 7.7, 7.9, 7.9, 7.5, 8.0, 8.0], 72, 'accent'), List([('Wed · Legs', 'RPE 8.0'), ('Tue · Pull + Shoulders', 'RPE 8.0'), ('Mon · Chest 1', 'RPE 7.5')])],
          footer=[m('Right in the zone — keep it up', 'flex: 1'), B('Progress ›', 'sec')]),
    ]),
    wrow('Session length', 'session-length', [
        W('S', 'neutral', kicker='Avg session', value='1h 06m', sub=Delta('−4 min vs previous 30 days', True)),
        W('M', 'neutral', icon='clock', title='Avg 1h 06m per session', sub='30 days · 17 sessions · −4 min vs previous 30 days'),
        W('L', 'neutral', kicker='Session length · last 10', badge=Delta('−4 min', True), value='1h 06m', unit='avg', bodyLast=True, body=Bars([60, 66, 64, 66, 62, 68, 64, 60, 62, 72], 44, 9, tone='neutral')),
        W('XL', 'neutral', kicker='Session length · 30 days', badge=Delta('−4 min vs previous 30 days', True), value='1h 06m', unit='avg', sub='17 sessions', bodyLast=True,
          body=[Bars([60, 70, 64, 66, 62, 70, 64, 60, 62, 72], 56, 9, tone='neutral'), row(m('17 Sep'), sp(), m('30 Sep')), List([('Legs', 'avg 1h 12m · longest'), ('Pull + Shoulders', 'avg 1h 04m'), ('Chest 1', 'avg 58 min')])],
          footer=B('History', 'sec', full=True)),
    ]),
    wrow('Home sets', 'home-sets', [
        W('S', 'active', kicker='Home sets', title='Pull-ups', sub='5×max · 8 min', footer=B('Start', icon='play', full=True)),
        W('M', 'active', icon='home', title='Home sets · 3 templates', sub='Pull-ups · Vacuum · Push-ups', trailing=B('Start', 'sec')),
        W('L', 'active', kicker='Home sets', badge='last: Tue',
          body=col(*[row(col(txt(n, 't-h3'), m(d), gap=0, style='flex: 1; min-width: 0'), B('Start', 'sec'), gap=8) for n, d in [('Pull-ups', '5×max'), ('Vacuum', '4×30s'), ('Push-ups', '4×20')]], gap=6)),
        W('XL', 'active', kicker='Home sets · 3 templates', badge='2× this week',
          body=[row(col(m('Pull-ups · last: Tue'), val('47', 'reps'), Delta('+5 vs last time'), gap=2), col(Bars([8, 8, 9, 9, 10, 12], 48, 5, tone='active', w=150), style='flex: 1'), gap=16, align='flex-end'),
                col(*[row(col(txt(n, 't-h3'), m(d), gap=0, style='flex: 1; min-width: 0'), B('Start', 'sec'), gap=8) for n, d in [('Pull-ups', '5×max · 12-10-9-8-8'), ('Vacuum', '4×30s · 8 min'), ('Push-ups', '4×20 · 10 min')]], gap=6)],
          footer=[m('No gym needed · counts to streak', 'flex: 1'), B('New template', 'txt', 'plus')]),
    ]),
]


# ============================================================== STRENGTH (strength.tsx)
def Tag_(t, good=True):
    return span(t, 't-s c-ok' if good is True else ('t-s c-bad' if good is False else 't-s c-dim'))


def Meter(label, value, pct, tone='accent', marker=None):
    """MeterRow: muted label, 12 px/600 value, 4 px bar (marker = typical)."""
    mk = f'<span style="position: absolute; left: {marker}%; top: -2px; bottom: -2px; width: 2px">{bar(100, "neutral", 8)}</span>' if marker else ''
    return col(row(m(label, 'flex: 1'), txt(value, 't-s num'), gap=8), f'<div style="position: relative">{bar(pct, T_(tone), 4)}{mk}</div>', gap=4)


def TwoLine(t, sub_):
    return col(txt(t, 't-s'), m(sub_), gap=0)


PT = {25: '#e2564f', 20: '#3d84c9', 15: '#d9a24f', 10: '#4cbe8c', 5: '#e9eaec', 2.5: '#b0b4b8', 1.25: '#71767b'}   # PLATE_TOKEN hex
LIFT_COLOR = {'Squat': '#d9a24f', 'Bench': '#eed3a5', 'Deadlift': '#4cbe8c', 'OHP': '#3d84c9'}


def Sw(hex_, label):
    return row(swatch(hex_, 10, 3), m(label), gap=5)


def LiftStack(h=10):
    return row(*[col(Rect(c, '100%', h), style=f'width: {w}%') for c, w in [('#d9a24f', 34), ('#eed3a5', 24), ('#4cbe8c', 42)]], gap=2)


TOP = [('S', 'Squat', '140', '↑ 5', True, [130, 132, 135, 137, 140]), ('B', 'Bench', '102', '↑ 2.5', True, [96, 97, 99, 100, 102]),
       ('D', 'Deadlift', '175', '↑ 5', True, [165, 167, 168, 171, 175]), ('OHP', 'OHP', '62', '→ 0', None, [58, 61, 62, 62, 62])]

strength = [
    wrow('Top lifts', 'top-lifts', [
        W('S', 'accent', kicker='Top lifts · 4 wk', value='3', unit='of 4 up',
          body=grid(*[row(m(sh), txt(v, 't-s num'), Tag_(d.split()[0], g), gap=4) for sh, _, v, d, g, _s in TOP], cols=2, gap=4)),
        W('M', 'accent', icon='progress', title='Top lifts · e1RM', sub='S 140 · B 102 · D 175 · OHP 62', trailing=Tag_('3 ↑')),
        W('L', 'accent', kicker='Top lifts · e1RM', badge='4 weeks', body=col(Stats([(n, col(txt(v, 't-h2 num'), Tag_(d, g), gap=0)) for _, n, v, d, g, _s in TOP]), style='margin-top: auto')),
        W('XL', 'accent', kicker='Top lifts · e1RM', badge='12 weeks',
          body=List([(row(col(txt(n, 't-s'), m('kg'), gap=0, style='width: 80px; flex: none'), spark(sv, 150, 30, 'ok' if g else 'neutral', False), gap=10),
                      col(txt(v, 't-h3 num'), Tag_(d, g), gap=0, style='align-items: flex-end')) for _, n, v, d, g, sv in TOP]),
          footer=[m('Big-3 total 417 kg', 'flex: 1'), B('All lifts')]),
    ]),
    wrow('Next target', 'next-target', [
        W('S', 'accent', kicker='Next · Chest 1', value='82.5', unit='× 8', title=m('Bench press'), sub=Tag_('+2.5 kg')),
        W('M', 'accent', icon='target', title='Bench press: 82.5 kg × 8', sub='Chest 1 today · +2.5 kg'),
        W('L', 'accent', kicker='Next target · Chest 1 today', badge=Tag_('+2.5 kg'), value='82.5', unit='kg × 8 × 3 sets', sub='Bench press',
          footer=[m('Last: 80 × 8 · 8 · 9', 'flex: 1'), B('Start')]),
        W('XL', 'accent', kicker='Next targets · Chest 1', badge='1 Oct',
          body=[List([('Bench press', row(txt('82.5 × 8', 't-s num'), Tag_('+2.5 kg'), gap=10)), ('Incline dumbbell press', row(txt('30 × 10', 't-s num'), Tag_('+1 rep'), gap=10)),
                      ('Weighted dips', row(txt('+15 × 8', 't-s num'), Tag_('hold', None), gap=10)), ('Cable crossover', row(txt('17.5 × 12', 't-s num'), Tag_('+2.5 kg'), gap=10)),
                      ('Triceps pushdown', row(txt('30 × 12', 't-s num'), Tag_('+1 rep'), gap=10))]),
                m('Double progression: hit the top of the rep range on all sets → add weight next time.', 'white-space: normal')],
          footer=B('Start Chest 1', full=True)),
    ]),
    wrow('PR forecast', 'pr-forecast', [
        W('S', 'ok', kicker='PR forecast', sub='Bench 102 → 110 kg',
          body=row(Ring(0.93, 56, 'ok', txt('93%', 't-m num')), col(txt('14 Dec', 't-h3'), m('in ~11 wk'), gap=0), gap=10, style='margin-top: auto')),
        W('M', 'ok', icon='progress', title='Bench 110 kg by 14 Dec', sub='+0.8 kg / week · 102 now'),
        W('L', 'ok', kicker='PR forecast · Bench', title=txt('At this pace: 110 kg by 14 Dec', 't-h3'), bodyLast=True, body=Spark([96, 97, 98, 99, 100, 101, 102, 104, 106, 108, 110], 64, 'ok')),
        W('XL', 'ok', kicker='PR forecast · Bench', badge=Tag_('+0.8 kg / week'),
          body=[row(val('110', 'kg'), txt('by 14 Dec', 't-h3'), gap=8, align='baseline'), Spark([96, 97, 98, 99, 100, 101, 102, 104, 106, 108, 110], 84, 'ok', True),
                List([(TwoLine('Squat → 150', '140 now · +1.1 / wk'), Tag_('26 Nov')), (TwoLine('Deadlift → 185', '175 now · +1.0 / wk'), Tag_('9 Dec')), (TwoLine('OHP → 65', '62 now · +0 / wk'), Tag_('no ETA', None))])],
          footer=B('Change targets', full=True)),
    ]),
    wrow('Recent PRs', 'recent-prs', [
        W('S', 'ok', kicker='Recent PRs', value='7', unit='this month', title=m('Latest: Bench 102 kg e1RM'), sub=Tag_('+2.5 · 29 Sep')),
        W('M', 'ok', icon='trophy', title='PR: Bench 102 kg e1RM', sub='29 Sep · 6 more this month', trailing=Tag_('+2.5')),
        W('L', 'ok', kicker='Recent PRs', body=col(List([('Bench · e1RM 102 kg', '29 Sep'), ('Squat · 120 × 5', '26 Sep'), ('Pull-up · +20 × 6', '24 Sep')]), style='margin-top: auto')),
        W('XL', 'ok', kicker='Recent PRs', badge=Tag_('7 this month'),
          body=List([(TwoLine(t, sb), col(Tag_(d), m(dt), gap=0, style='align-items: flex-end')) for t, sb, d, dt in
                     [('Bench press · 102 kg', 'e1RM · Chest 2', '+2.5', '29 Sep'), ('Squat · 120 × 5', 'reps at weight · Legs', '+1 rep', '26 Sep'), ('Pull-up · +20 × 6', 'reps at weight · Pull', '+1 rep', '24 Sep'), ('Deadlift · 170 × 3', 'e1RM · Legs', '+5', '19 Sep')]]),
          footer=B('All records', full=True)),
    ]),
    wrow('1RM calculator', 'one-rm-calc', [
        W('S', 'neutral', kicker='Est. 1RM', value='105', unit='kg', sub='from 90 × 5 · Bench', body=Stats([('80%', '84 × 8')])),
        W('M', 'neutral', icon='note', title='90 × 5 → 105 kg', sub='est. 1RM · from last Bench set'),
        W('L', 'neutral', kicker='1RM calculator', badge='Epley', body=col(Stats([('Weight', '90 kg'), ('Reps', '5'), ('Estimated 1RM', '105 kg')]), style='margin-top: auto')),
        W('XL', 'neutral', kicker='1RM calculator', badge='Epley',
          body=[Stats([('Weight', '90 kg'), ('Reps', '5'), ('Estimated 1RM', '105 kg')]),
                grid(List([('95%', '100 × 2'), ('90%', '94.5 × 4'), ('85%', '89 × 6'), ('80%', '84 × 8')]), List([('75%', '79 × 10'), ('70%', '73.5 × 12'), ('65%', '68 × 15'), ('60%', '63 × 20')]), cols=2, gap=16)],
          footer=[row(chip('Squat'), chip('Bench', True), chip('Deadlift'), chip('OHP'), gap=6, wrap=True, style='flex: 1'), B('Enter a set')]),
    ]),
    wrow('Plate calculator', 'plate-calc', [
        W('S', 'neutral', kicker='Plates · per side', value='102.5', unit='kg', sub='25 + 15 + 1.25', body=col(barbell((25, 15, 1.25), w=141, h=40), style='margin-top: auto')),
        W('M', 'neutral', icon='plates', title='102.5 kg: 25 + 15 + 1.25', sub='per side · 20 kg bar'),
        W('L', 'neutral', kicker='Plates', body=row(col(val('102.5', 'kg'), m('per side 41.25'), txt('25 + 15 + 1.25', 't-m'), gap=2, style='flex: none'), barbell((25, 15, 1.25), w=196, h=96), gap=14, style='flex: 1')),
        W('XL', 'neutral', kicker='Plate calculator', badge='Bar 20 kg · per side',
          body=[row(B('− 2.5', 'sec'), val('102.5', 'kg'), B('+ 2.5', 'sec'), justify='space-between'), barbell((25, 15, 1.25), w=326, h=110),
                row(Sw(PT[25], '25'), Sw(PT[15], '15'), Sw(PT[1.25], '1.25'), gap=10)],
          footer=Stats([('Warm-up 60%', '20'), ('Warm-up 80%', '25 + 5'), ('Top set', '25 + 15 + 1.25')])),
    ]),
    wrow('Strength balance', 'strength-balance', [
        W('S', 'neutral', kicker='Strength balance', title='Bench lags', value='−12', unit='kg', sub='vs typical for DL 175',
          body=row(*[col(bar(100, T_(t), 5), style='flex: 1') for t in ['accent', 'injury', 'ok']], gap=3)),
        W('M', 'injury', icon='scales', title='Bench lags by ~12 kg', sub='Squat 0.80 · Bench 0.58 · Deadlift 1.00'),
        W('L', 'neutral', kicker='Balance · vs deadlift', badge='│ typical', body=col(Meter('Squat', '0.80 / 0.85', 80, 'accent', 85), Meter('Bench', '0.58 / 0.65', 58, 'injury', 65), Meter('Deadlift', '1.00', 100, 'ok'), gap=9, style='margin-top: auto')),
        W('XL', 'neutral', kicker='Strength balance', badge='e1RM · best',
          body=[col(txt('1.37 : 1 : 1.72', 't-h1 num'), m('Squat : Bench : Deadlift · typical 1.31 : 1 : 1.54'), gap=2),
                ColBars([140, 133, 102, 101, 175, 154], (0, 2, 4), 90, 'accent', ['S 140', '', 'B 102', '', 'D 175', '']),
                row(Sw('#d9a24f', 'You'), Sw('#2a2c30', 'Typical for your strongest lift'), gap=12), m('Bench is ~12 kg under typical proportions.', 'white-space: normal')],
          footer=B('Open trends', full=True)),
    ]),
    wrow('Standards', 'standards', [
        W('S', 'accent', kicker='Class · 83 kg', value=txt('II', 't-num c-brass'), sub='43 kg to Class I', body=Bar(0.3)),
        W('M', 'accent', icon='shield', title='Class II · total 417', sub='43 kg to Class I · 83 kg cat.'),
        W('L', 'accent', kicker='Standards · 83 kg · total', badge='BW 81.4', value='417', unit='/ 460 kg', sub=TT('43 kg to Class I', 'accent'),
          body=grid(*[col(bar(p, T_(tn), 8), m(l_, 'text-align: center'), gap=3) for l_, p, tn in [('III', 100, 'ok'), ('II', 100, 'accent'), ('I', 30, 'accent'), ('CMS', 0, 'accent'), ('MS', 0, 'accent')]], cols=5, gap=4)),
        W('XL', 'accent', kicker='Standards · 83 kg category', badge='raw total',
          body=[row(txt('Class II', 't-num c-brass'), m('417 kg total'), gap=10, align='baseline'),
                List([('MS', '600'), ('CMS', '530'), ('Class I', TT('+43 to go · 460', 'accent')), (b('Class II · you'), TT('400 ✓', 'accent')), ('Class III', TT('350 ✓', 'ok'))])],
          footer=B('Open standards', full=True)),
    ]),
    wrow('Powerlifting total', 'pl-total', [
        W('S', 'accent', kicker='Total', value='417', unit='kg', sub=Tag_('+12.5 · 30 d')),
        W('M', 'accent', icon='dumbbell', title='Total 417 kg', sub='S 140 · B 102 · D 175', trailing=Tag_('+12.5')),
        W('L', 'accent', kicker='Powerlifting total', badge=Tag_('+12.5 · 30 d'),
          body=[row(val('417', 'kg'), sp(), spark([404, 406, 409, 410, 412, 414, 417], 150, 36, 'ok', False), align='flex-end'),
                col(LiftStack(), row(Sw('#d9a24f', 'Squat 140'), Sw('#eed3a5', 'Bench 102'), Sw('#4cbe8c', 'Deadlift 175'), gap=14), gap=6, style='margin-top: auto')]),
        W('XL', 'accent', kicker='Powerlifting total', badge='12 weeks',
          body=[row(val('417', 'kg'), sp(), Tag_('+24.5 since 9 Jul'), align='baseline'), Spark([392, 395, 398, 400, 403, 405, 408, 410, 413, 417], 64, 'ok', True), LiftStack(),
                List([(row(swatch('#d9a24f', 8), txt('Squat', 't-s'), gap=6), row(txt('140', 't-s num'), Tag_('+5'), gap=10)), (row(swatch('#eed3a5', 8), txt('Bench', 't-s'), gap=6), row(txt('102', 't-s num'), Tag_('+2.5'), gap=10)),
                      (row(swatch('#4cbe8c', 8), txt('Deadlift', 't-s'), gap=6), row(txt('175', 't-s num'), Tag_('+5'), gap=10))])],
          footer=[m('Class II · 43 kg to Class I', 'flex: 1'), B('View progress')]),
    ]),
    wrow('Relative strength', 'relative-strength', [
        W('S', 'neutral', kicker='Bench × BW', value='1.25', unit='×', sub='102 / 81.4 kg'),
        W('M', 'neutral', icon='body', title='Bench 1.25× bodyweight', sub='Squat 1.72× · Deadlift 2.15×'),
        W('L', 'neutral', kicker='× bodyweight · 81.4 kg', badge='scale 0 – 2.5×', body=col(Meter('Squat', '1.72×', 69), Meter('Bench', '1.25×', 50), Meter('Deadlift', '2.15×', 86, 'ok'), gap=7, style='margin-top: auto')),
        W('XL', 'neutral', kicker='× bodyweight · 81.4 kg', badge='│ next milestone',
          body=[row(val('5.12', '×'), m('total 417 ÷ BW'), gap=8, align='baseline'),
                col(Meter('Squat', '1.72× / 2', 69, 'accent', 80), Meter('Bench', '1.25× / 1.5', 50, 'accent', 60), Meter('Deadlift', '2.15× / 2.5', 86, 'ok', 100), Meter('OHP', '0.76× / 1', 30, 'accent', 40), gap=9),
                Stats([('Closest milestone', 'Squat 2× = 163 kg'), ('To go', '+23 kg')])],
          footer=[m('BW 81.4 · −0.6 in 30 d', 'flex: 1'), B('Log weight')]),
    ]),
    wrow('Rep PRs', 'rep-prs', [
        W('S', 'ok', kicker='Rep PR · Bench', value='11', unit='reps', sub='@ 80 kg · 15 Sep', body=Bars([15, 11, 6, 2], 22, 1, tone='ok', w=141)),
        W('M', 'ok', icon='chart', title='Bench @ 80 kg: 11 reps', sub='Latest rep record · 15 Sep'),
        W('L', 'ok', kicker='Rep PRs · Bench', badge='best reps', body=col(Stats([(f'{w} kg', col(txt(r, 't-h2 num'), m(d), gap=0)) for w, r, d in [('70', '15', '3 Aug'), ('80', '11', '15 Sep'), ('90', '6', '22 Sep'), ('100', '2', '29 Sep')]]), style='margin-top: auto')),
        W('XL', 'ok', kicker='Rep PRs · Bench', badge='best reps',
          body=[Bars([15, 11, 8, 6, 4, 2], 60, 1, ['70·15', '80·11', '82.5·8', '90·6', '95·4', '100·2'], 'ok'), m('Next rep PR at your heaviest weights'),
                List([(TwoLine(f'{w} kg', f'best {n} · {d}'), Tag_(f'{n + 1} = PR')) for w, n, d in [('90', 6, '22 Sep'), ('95', 4, '26 Sep'), ('100', 2, '29 Sep')]])],
          footer=[row(chip('Squat'), chip('Bench', True), chip('Deadlift'), chip('OHP'), gap=6, wrap=True, style='flex: 1'), B('Exercise history')]),
    ]),
    wrow('Stalled lifts', 'stalled-lifts', [
        W('S', 'injury', kicker='Stalled', value='2', unit='lifts', title=m('OHP · 4 sessions at 60 × 6'), sub=TT('Deload 10%', 'accent')),
        W('M', 'injury', icon='warn', title='2 lifts stalled', sub='Standing military press · 4 sessions at 60 × 6'),
        W('L', 'injury', kicker='Stalled lifts', body=col(List([(TwoLine('Standing military press', '4 sessions · 60 × 6'), tag('Deload 10%', 'neutral')), (TwoLine('Bent over barbell row', '3 sessions · 80 × 8'), tag('Swap', 'neutral'))]), style='margin-top: auto')),
        W('XL', 'injury', kicker='Stalled lifts', badge='no e1RM gain',
          body=Stats([(row(txt('Standing military press', 't-s'), spark([60, 61, 61, 61], 80, 24, 'injury', False), gap=8), m('Deload 10% → 55 × 8, build back up')),
                      (row(txt('Bent over barbell row', 't-s'), spark([80, 81, 81, 81], 80, 24, 'injury', False), gap=8), m('Swap → Chest-supported row'))]).replace('repeat(2', 'repeat(1'),
          footer=[m('Watching: Leg press · 2 sessions', 'flex: 1'), B('Open trends')]),
    ]),
    wrow('Smart swap', 'smart-swap', [
        W('S', 'apex', kicker='Swap · Bench press', title=txt('Machine chest press', 't-s'), sub=f'free now · {GYM}',
          body=row(Ring(0.92, 44, 'apex'), col(txt('92%', 't-h3'), m('match'), gap=0), gap=10)),
        W('M', 'apex', icon='swap', title='Bench press busy? Machine chest press', sub=f'92% same muscles · {GYM}', trailing=B('Swap', 'sec')),
        W('L', 'apex', kicker=f'Smart swap · {GYM}', badge='92% match', body=[row(m('Bench press'), m('→'), txt('Machine chest press', 't-h3'), gap=8), Chips(['Chest', 'Front delts', 'Triceps'])], footer=B('Swap')),
        W('XL', 'apex', kicker=f'Smart swap · {GYM}', badge='now',
          body=[Stats([('Replacing', 'Bench press')]), Chips(['Chest', 'Front delts', 'Triceps']),
                List([(TwoLine('Machine chest press', 'available here · 70 × 10'), '92%'), (TwoLine('Dumbbell bench press', 'available here · 34 × 8'), '88%'), (TwoLine('Smith machine bench press', 'available here · 75 × 8'), '85%')])],
          footer=B('Swap · Machine chest press', full=True)),
    ]),
]


# ============================================================== MUSCLES & CONSISTENCY (muscles.tsx)
AC = {'300': '#eed3a5', '400': '#e4bb76', '500': '#d9a24f', '600': '#b3833d', '700': '#8a642e', '800': '#5b4420', 'line': '#5a4524'}
NE = {'600': '#71767b', '700': '#55595e', '800': '#3b3f43', '900': '#262a2d'}
OK_LINE = '#2f6f52'
ZONE = {'none': NE['800'], 'under': NE['600'], 'productive': '#4cbe8c', 'high': '#d9a24f', 'over': '#e2564f'}


def heatc(n):
    return None if n <= 0 else AC['800'] if n < 5 else AC['600'] if n < 10 else AC['500'] if n < 15 else AC['300']


SETS7 = {'chest': 23, 'back': 16, 'lats': 16, 'shoulders': 14, 'triceps': 12, 'biceps': 10, 'quads': 9, 'hamstrings': 5, 'glutes': 5, 'calves': 4, 'core': 6}
MAPC = {k: heatc(v) for k, v in SETS7.items()}


def Cell(hex_, s=10):
    return Rect(hex_, s, s, 3)


def HeatGrid(weeks, seed=3, cell=None):
    """consistency heat grid: columns = weeks, rows = Mon–Sun, HEAT levels (neutral-800 · accent-800/600/400)."""
    lv = [NE['800'], AC['800'], AC['600'], AC['400']]
    cols_ = []
    for w in range(weeks):
        cs = []
        for d in range(7):
            v = (w * 7 + d * 3 + seed * 5 + (w * d) % 4) % 7
            lvl = 0 if v in (0, 3, 5) else (1 if v == 1 else 2 if v in (2, 6) else 3)
            cs.append(f'<div style="aspect-ratio: 1">{Rect(lv[lvl], "100%", 1000, 2).replace("height: 1000px", "height: 100%")}</div>')
        cols_.append(col(*cs, gap=2, style='flex: 1; min-width: 0'))
    return row(*cols_, gap=2, align='flex-start')


def LmBar(sets, mev, mav, mrv, zone, mx=26):
    p = lambda v: f'{min(100, v / mx * 100):.1f}%'
    return (f'<div style="position: relative; height: 8px; flex: 1">{Rect(NE["800"], "100%", 8, 3)}'
            f'<div style="position: absolute; top: 0; left: {p(mev)}; width: calc({p(mrv)} - {p(mev)})">{Rect(NE["700"], "100%", 8, 3)}</div>'
            f'<div style="position: absolute; top: 0; left: {p(mev)}; width: calc({p(mav)} - {p(mev)})">{Rect(OK_LINE, "100%", 8, 3)}</div>'
            f'<div style="position: absolute; top: -3px; left: calc({p(sets)} - 2px); width: 4px">{Rect(ZONE[zone], 4, 14, 2)}</div></div>')


LM = [('Chest', 23, 8, 16, 22, 'over'), ('Back', 16, 10, 18, 25, 'productive'), ('Shoulders', 14, 8, 16, 26, 'productive'), ('Triceps', 12, 6, 12, 18, 'high'),
      ('Biceps', 10, 8, 14, 20, 'productive'), ('Quads', 9, 8, 15, 20, 'productive'), ('Hamstrings', 5, 6, 12, 18, 'under'), ('Calves', 4, 8, 14, 20, 'under')]


def lmrow(n, sets, mev, mav, mrv, z):
    return row(m(n, 'width: 78px'), LmBar(sets, mev, mav, mrv, z), txt(str(sets), 't-s num', 'width: 30px; text-align: right'), gap=8)


def stimrow(n, done, target):
    left = target - done
    return row(m(n, 'width: 84px'), col(Bar(done / target if target else 1, 'ok' if left == 0 else 'accent'), style='flex: 1'),
               txt('done ✓' if left == 0 else f'{left} left', 't-s num' + (' c-ok' if left == 0 else ''), 'width: 52px; text-align: right'), gap=8)


def LrRow(name, l_, r_, tagt, weak='L'):
    mx = max(l_, r_)
    even = l_ == r_
    lt = 'injury' if (not even and weak == 'L') else 'accent'
    rt = 'injury' if (not even and weak == 'R') else 'accent'
    return col(row(m(name, 'flex: 1'), Tag_(tagt, True if even else None), gap=8),
               row(m(str(l_), 'width: 28px'), f'<div style="flex: 1; transform: scaleX(-1)">{Bar(l_ / mx, lt)}</div>', col(Bar(r_ / mx, rt), style='flex: 1'), m(str(r_), 'width: 28px; text-align: right'), gap=6), gap=4)


def FreqGrid(rows_):
    head = row(txt('', 't-m', 'width: 78px'), *[m(d, 'flex: 1; text-align: center') for d in 'MTWTFSS'], txt('', 't-m', 'width: 26px'), gap=4)
    out = [head]
    for n, days, c in rows_:
        cells = [f'<span style="flex: 1; display: flex; justify-content: center">{Cell("#d9a24f" if d == 1 else (AC["line"] if d == 2 else NE["800"]))}</span>' for d in days]
        out.append(row(m(n, 'width: 78px'), *cells, txt(c, 't-s num', 'width: 26px; text-align: right'), gap=4))
    return col(*out, gap=5)


FREQ = [('Chest', [1, 0, 0, 2, 0, 0, 0], '2×'), ('Back', [0, 1, 0, 0, 2, 0, 0], '2×'), ('Shoulders', [1, 1, 0, 2, 2, 0, 0], '4×'), ('Biceps', [0, 1, 0, 0, 2, 0, 0], '2×'),
        ('Triceps', [1, 0, 0, 2, 0, 0, 0], '2×'), ('Quads', [0, 0, 1, 0, 0, 2, 0], '2×'), ('Hamstrings', [0, 0, 1, 0, 0, 2, 0], '2×'), ('Calves', [0, 0, 0, 0, 0, 2, 0], '1×')]
FREQC = [('Push', [1, 0, 0, 2, 0, 0, 0], '2×'), ('Pull', [0, 1, 0, 0, 2, 0, 0], '2×'), ('Legs', [0, 0, 1, 0, 0, 2, 0], '2×')]


def tcol(v):
    return NE['900'] if v is None else NE['800'] if v < -1.5 else AC['800'] if v < 1 else AC['600'] if v < 3 else AC['400']


BT = [[-3, None, -2, None, -4, 1, None], [None, None, None, None, None, 1, -1], [1, -2, 0, 2, -1, 3, None], [4, 3, 4, 6, 3, None, None]]


def BtGrid(values=True, cell=14):
    head = row(txt('', 't-m', f'width: {64 if values else 34}px'), *[m(d, 'flex: 1; text-align: center') for d in 'MTWTFSS'], gap=4)
    out = [head]
    for i, r_ in enumerate(BT):
        lab = col(m(['Morning', 'Midday', 'Afternoon', 'Evening'][i]), m(['6–10', '10–14', '14–18', '18–22'][i]), gap=0, style='width: 64px') if values else m(['AM', 'Mid', 'PM', 'Eve'][i], 'width: 34px')
        cells = []
        for v in r_:
            c = tcol(v)
            inner = Rect(c, '100%', cell + (8 if values else 0), 4)
            if values:
                inner = f'<div style="position: relative">{inner}<div class="t-m num" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center">{"·" if v is None else (f"+{v}" if v > 0 else ("0" if v == 0 else f"−{-v}"))}</div></div>'
            cells.append(f'<div style="flex: 1; min-width: 0">{inner}</div>')
        out.append(row(lab, *cells, gap=4))
    return col(*out, gap=4)


PPLC = {'Push': '#d9a24f', 'Pull': '#3d84c9', 'Legs': '#4cbe8c'}


def PplBar(h=10, parts=(42, 33, 25)):
    return row(*[col(Rect(c, '100%', h), style=f'width: {p}%') for c, p in zip(PPLC.values(), parts)], gap=2)


def NoteAct(note, button):
    return [m(note, 'flex: 1; white-space: normal'), button]


muscles = [
    wrow('Muscle map', 'muscle-map', [
        W('S', 'accent', kicker='Last 7 days', body=row(Heat(MAPC, 64), col(m('Most'), txt('Chest', 't-h3'), val('23', 'sets', 't-h2'), m('Calves 4'), gap=0, style='min-width: 0'), gap=10, style='flex: 1')),
        W('M', 'accent', icon='body', title='Chest leads · 23 sets', sub='132 sets in 7 days · Calves only 4'),
        W('L', 'accent', body=row(Heat(MAPC, 140), col(kick('Volume · 7 days', 'accent'), val('132', 'sets'), *[row(m(n, 'flex: 1'), txt(v, 't-s num'), gap=8) for n, v in [('Chest', '23'), ('Back', '16'), ('Calves', '4')]], gap=2, style='flex: 1; min-width: 0'), gap=14, style='flex: 1')),
        W('XL', 'accent', kicker='Muscle map · last 7 days', badge='132 sets',
          body=[col(Heat(MAPC, 165), style='flex: 1; align-items: center; justify-content: center'),
                row(m('Sets'), Sw(AC['800'], '<5'), Sw(AC['600'], '5–9'), Sw(AC['500'], '10–14'), Sw(AC['300'], '15+'), gap=10, wrap=True)],
          footer=NoteAct('Most Chest 23 · least Calves 4', B('Details'))),
    ]),
    wrow('Volume landmarks', 'volume-landmarks', [
        W('S', 'ok', kicker='Landmarks', value='3', unit='/ 8 in range', sub='Chest over MRV · 23 sets', body=row(*[Cell(ZONE[z], 12) for *_, z in LM], gap=3)),
        W('M', 'danger', icon='chart', title='Chest over MRV · 23 sets', sub='3 of 8 muscles in range', trailing=chip('MRV 22')),
        W('L', 'ok', kicker='Volume landmarks', badge='sets / week', body=col(*[lmrow(*x) for x in LM[:3]], gap=8, style='margin-top: auto')),
        W('XL', 'ok', kicker='Volume landmarks · 7 days', badge='sets / week',
          body=[col(*[lmrow(*x) for x in LM], gap=8), row(Sw(OK_LINE, 'MEV–MAV sweet spot'), Sw(NE['700'], 'MEV–MRV'), gap=12),
                Stats([('Tip', 'Chest is over MRV — move ~4 sets to Hamstrings next week.')])],
          footer=NoteAct('3 of 8 muscles in range', B('Open volume'))),
    ]),
    wrow('Stimulus left today', 'stimulus-left', [
        W('S', 'accent', kicker='Left today', value='14', unit='sets', sub='Biceps 6 · Back 4 · Side delts 4', body=Bar(0.5)),
        W('M', 'accent', icon='target', title='14 productive sets left', sub='Biceps 6 · Back 4 · Shoulders 4'),
        W('L', 'accent', kicker='Left today · Pull + Shoulders', badge='14 sets', body=col(stimrow('Back', 6, 10), stimrow('Shoulders', 2, 6), stimrow('Biceps', 0, 6), stimrow('Rear delts', 6, 6), gap=7, style='margin-top: auto')),
        W('XL', 'accent', kicker='Left today · Pull + Shoulders', badge='to MAV',
          body=[row(Ring(0.5, 84, 'accent', RL('50%')), col(val('14', 'sets left'), m('14 of 28 productive sets done'), m('~35 min at your pace'), gap=2), gap=14),
                col(stimrow('Biceps', 0, 6), stimrow('Back', 6, 10), stimrow('Shoulders', 2, 6), stimrow('Rear delts', 6, 6), gap=7)],
          footer=NoteAct('Readiness 82%', B('Continue workout'))),
    ]),
    wrow('Left / right balance', 'lr-balance', [
        W('S', 'neutral', kicker='Left / right balance', value='−6', unit='% L', sub='Dumbbell shoulder press · 34 / 36', body=LrRow('', 34, 36, 'L −6%')),
        W('M', 'injury', icon='swap', title='L 6% weaker', sub='Dumbbell shoulder press · 34 / 36', trailing=chip('L −6%')),
        W('L', 'neutral', kicker='Left / right · e1RM', badge='L ← → R', body=col(LrRow('Dumbbell shoulder press', 34, 36, 'L −6%'), LrRow('One-arm dumbbell row', 42, 42, 'even ✓'), gap=8, style='margin-top: auto')),
        W('XL', 'neutral', kicker='Left / right · e1RM', badge='kg · L ← → R',
          body=[row(val('−6', '%'), m('Dumbbell shoulder press · 26 Sep'), gap=8, align='baseline'),
                col(LrRow('Dumbbell shoulder press', 34, 36, 'L −6%'), LrRow('Alternate hammer curl', 17, 18, 'L −6%'), LrRow('One-arm dumbbell row', 42, 42, 'even ✓'), gap=9)],
          footer=NoteAct('Start sets with the weaker side (l)', B('Test a lift'))),
    ]),
    wrow('Muscle of the week', 'muscle-of-week', [
        W('S', 'accent', kicker='Focus · week', title='Shoulders', value='9', unit='/ 12 sets', body=Bar(0.75)),
        W('M', 'accent', icon='star', title='Focus: Shoulders', sub='9 of 12 sets · 3 to go by Sun', trailing=chip('75%')),
        W('L', 'accent', body=row(Ring(0.75, 84, 'accent', col(txt('9', 't-h2 num'), m('/ 12'), gap=0, style='align-items: center')),
                                    col(kick('Muscle of the week', 'accent'), txt('Shoulders', 't-h3'), m('3 more sets of Side lateral raise close the gap.', 'white-space: normal'), gap=4, style='min-width: 0'), gap=14, style='flex: 1')),
        W('XL', 'accent', kicker='Muscle of the week', badge='28 Sep – 4 Oct',
          body=[row(Ring(0.75, 84, 'accent', col(txt('9', 't-h2 num'), m('/ 12'), gap=0, style='align-items: center')), col(txt('Shoulders', 't-h3'), m('Furthest below MAV over 4 weeks'), m('3 sets to go by Sun'), gap=2), gap=14),
                ColBars([6, 7, 8, 9], (3,), 40, labels=['6', '7', '8', 'now']), List([('Side lateral raise', '6 sets'), ('Face pull', '3 sets')])],
          footer=NoteAct('3 more sets of Side lateral raise close the gap.', B('Open muscle'))),
    ]),
    wrow('Frequency', 'muscle-frequency', [
        W('S', 'accent', kicker='Frequency', value='7', unit='/ 8 at 2×', sub='Calves only 1× this week', body=Dots([1, 1, 1, 1, 1, 1, 1, 0], 8)),
        W('M', 'accent', icon='calendar', title='7 of 8 muscles hit 2×', sub='Calves only 1× this week', trailing=chip('Calves 1×')),
        W('L', 'accent', kicker='Frequency · this week', badge='target 2×', body=FreqGrid(FREQC)),
        W('XL', 'accent', kicker='Frequency · this week', badge='target 2× per muscle', body=[FreqGrid(FREQ), row(Sw('#d9a24f', 'Trained'), Sw(AC['line'], 'Planned'), gap=12)],
          footer=NoteAct('Calves only 1× this week', B('Open volume'))),
    ]),
    wrow('Push / Pull / Legs', 'ppl-split', [
        W('S', 'accent', kicker='Push / Pull / Legs', value='42', unit='% push', sub='Pull 33% · Legs 25%', body=PplBar(8)),
        W('M', 'accent', icon='chart', title='Push-heavy · 42 / 33 / 25', sub='Legs 5% below target · 4 weeks', trailing=chip('Legs 25%')),
        W('L', 'accent', kicker='Volume split · 4 weeks', badge='512 sets', body=[PplBar(10), Stats([(row(swatch(c, 8), txt(k, 't-m'), gap=5), col(txt(f'{p}%', 't-s num'), m(f'{n} · target {tg}%'), gap=0)) for (k, c), p, n, tg in zip(PPLC.items(), (42, 33, 25), (215, 169, 128), (35, 35, 30))])]),
        W('XL', 'accent', kicker='Volume split · 4 weeks', badge='512 sets',
          body=[PplBar(12), Stats([(row(swatch(c, 8), txt(k, 't-m'), gap=5), col(txt(f'{p}%', 't-s num'), m(f'{n} · target {tg}%'), gap=0)) for (k, c), p, n, tg in zip(PPLC.items(), (42, 33, 25), (215, 169, 128), (35, 35, 30))]),
                col(kick('By week', 'accent'), *[row(m(w, 'width: 50px'), col(PplBar(8), style='flex: 1'), txt(n, 't-m num', 'width: 30px; text-align: right'), gap=8) for w, n in [('7 Sep', '124'), ('14 Sep', '128'), ('21 Sep', '128'), ('28 Sep', '132')]], gap=6)],
          footer=NoteAct('Legs 5% below target', B('Open volume'))),
    ]),
    wrow('Consistency heatmap', 'consistency-heatmap', [
        W('S', 'accent', kicker='Consistency', body=row(col(HeatGrid(4, 2), style='width: 60px; flex: none'), col(val('6'), m('week streak'), m('4.2 / week'), gap=0), gap=10, style='flex: 1')),
        W('M', 'accent', icon='grid', title='6-week streak', sub='67 sessions in 16 weeks · 4.2 / week', trailing=chip('Best 9')),
        W('L', 'accent', body=row(col(HeatGrid(16, 3), style='flex: 1; min-width: 0'), col(kick('16 weeks', 'accent'), val('6', 'wk'), m('week streak'), m('67 sessions'), m('4.2 / week'), gap=0, style='flex: none'), gap=14, style='flex: 1')),
        W('XL', 'accent', kicker='Training days · 52 weeks', badge='251 sessions',
          body=[col(m('Oct – Mar'), HeatGrid(26, 4), gap=4), col(m('Apr – Sep'), HeatGrid(26, 5), gap=4),
                row(m('Less'), Cell(NE['800']), Cell(AC['800']), Cell(AC['600']), Cell(AC['400']), m('More'), gap=4)],
          footer=Stats([('Streak', '6 wk'), ('Longest', '9 wk'), ('In 2026', '184')])),
    ]),
    wrow('Weekly goal', 'weekly-goal', [
        W('S', 'accent', kicker='Weekly goal', body=row(Ring(0.5, 64, 'accent', col(txt('2', 't-h3 num'), m('/ 4'), gap=0, style='align-items: center')), col(txt('2 to go', 't-h3'), m('by Sun'), gap=0), gap=12, style='flex: 1')),
        W('M', 'accent', icon='check', title='Weekly goal · 2 of 4', sub='Next: Chest 2 today'),
        W('L', 'accent', body=row(Ring(0.5, 84, 'accent', col(txt('2', 't-h2 num'), m('/ 4'), gap=0, style='align-items: center')),
                                    col(kick('Weekly goal · 4 sessions', 'accent'), row(*[col(m(d), Cell('#d9a24f' if i < 2 else (NE['800']), 14), gap=3, style='align-items: center') for i, d in enumerate('MTWTFSS')], gap=4),
                                        m('Next: Chest 2 today'), Tag_('6-week goal streak'), gap=5, style='flex: 1; min-width: 0'), gap=14, style='flex: 1')),
        W('XL', 'accent', kicker='Weekly goal · 28 Sep – 4 Oct', badge='4 sessions',
          body=[row(Ring(0.5, 84, 'accent', col(txt('2', 't-h2 num'), m('/ 4'), gap=0, style='align-items: center')), col(txt('2 to go by Sun', 't-h3'), m('3 days left'), Tag_('6-week goal streak'), gap=2), gap=14),
                List([('Chest 1', 'Mon · 58 min', 'check', 'ok'), ('Pull + Shoulders', 'Tue · 64 min', 'check', 'ok'), ('Chest 2', 'Today · 19:00', 'play', 'accent'), ('Legs 2', 'Sat · planned', 'dumbbell', 'neutral')])],
          footer=NoteAct('Last 6 weeks: 4 · 5 · 4 · 4 · 6 · 4', B('Edit goal'))),
    ]),
    wrow('Sessions this month', 'sessions-month', [
        W('S', 'accent', kicker='September', value='22', unit='sessions', sub=Tag_('+7 vs August')),
        W('M', 'accent', icon='calendar', title='22 sessions in September', sub='vs 15 in August · best in 6 months', trailing=Tag_('+7')),
        W('L', 'accent', kicker='Sessions · Sep vs Aug', badge=Tag_('+7'), body=row(val('22', 'vs 15'), col(ColBars([16, 18, 14, 17, 15, 22], (5,), 56, labels=['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']), style='flex: 1'), gap=14, align='flex-end', style='flex: 1')),
        W('XL', 'accent', kicker='Sessions · September', badge=Tag_('+7 vs Aug'),
          body=[row(val('22', 'sessions'), m('best in 6 months · vs 15 in August'), gap=10, align='baseline'), ColBars([16, 18, 14, 17, 15, 22], (5,), 64, labels=['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']),
                List([('1 – 7 Sep', '5 sessions · 4.9 h'), ('8 – 14 Sep', '6 sessions · 5.8 h'), ('15 – 21 Sep', '5 sessions · 5.1 h'), ('22 – 30 Sep', '6 sessions · 6.0 h')])],
          footer=NoteAct('21.8 h total · avg 59 min', B('Open history'))),
    ]),
    wrow('Best training time', 'best-training-time', [
        W('S', 'accent', kicker='Best time', title='Thu · Evening', sub=Tag_('+6% top sets'), body=row(*[Cell(tcol(v), 14) for v in BT[3]], gap=3)),
        W('M', 'accent', icon='clock', title='Strongest: Thu evening', sub='Top sets +6% vs your average', trailing=chip('18–22')),
        W('L', 'accent', body=row(col(BtGrid(False, 12), style='flex: 1; min-width: 0'), col(kick('Best time', 'accent'), txt('Thu · Evening', 't-h3'), Tag_('+6% top sets'), m('from 64 sessions'), gap=4, style='flex: none'), gap=14, style='flex: 1')),
        W('XL', 'accent', kicker='Best training time', badge='e1RM vs avg · 12 wk',
          body=[BtGrid(True, 14), m('Values = % vs your average top set · 64 sessions'), Stats([('Best', 'Thu evening · +6%'), ('Weakest', 'Fri morning · −4%')])],
          footer=NoteAct('Thu evening is your strongest slot (+6%).', B('Open trends'))),
    ]),
    wrow('Back on track', 'back-on-track', [
        W('S', 'active', kicker='Back on track', value='80', unit='% load', sub='9 days off · session 1 of 3', body=Dots([1, 0, 0], 6, 'active')),
        W('M', 'active', icon='rotate', title='Welcome back · 9 days off', sub='This session lighter: 80% load', trailing=B('Start light', 'sec')),
        W('L', 'active', kicker='Back on track · 9 days off', title=txt('Ease back in over 3 sessions', 't-h3'), bodyLast=True,
          body=Stats([('Today', 'Session 1 · 80%'), ('Next', 'Session 2 · 90%'), ('Then', 'Full load')]), footer=NoteAct('−20% weight · −1 set', B('Start light'))),
        W('XL', 'active', kicker='Back on track', badge='last session 19 Sep',
          body=[row(val('9', 'days off'), m('Ease back in over 3 sessions'), gap=8, align='baseline'), ColBars([80, 90, 100], (0,), 56, 'active', ['Today', 'Next', 'Then']),
                List([('Session 1', '80% · 3 sets / lift'), ('Session 2', '90% · full sets'), ('Session 3', 'Full load · back to plan')]), Stats([('Example', 'Bench press today: 72 kg instead of 90 kg')])],
          footer=NoteAct('Lighter warm-up · stop 2–3 reps short', B('Start light'))),
    ]),
]


# ============================================================== BODY & RECOVERY (body.tsx + bodyplus.tsx)
def Ladder(idx, labels=None):
    cells = []
    for i in range(4):
        c = '#4cbe8c' if i < idx else ('#e2786a' if i == idx else NE['700'])
        cells.append(col(Rect(c, '100%', 6, 3), (txt(labels[i], 't-m' if i != idx else 't-s', 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis') if labels else ''), gap=4, style='min-width: 0'))
    return grid(*cells, cols=4, gap=6)


def BedStrip(offs, lo, hi, ticks=False, w=326):
    R = 180
    x = lambda o: (max(-R, min(R, o)) + R) / (2 * R) * (w - 16) + 8
    H = 56 if ticks else 30
    cy = 20 if ticks else H / 2
    parts = [f'<div style="position: absolute; left: 0; right: 0; top: {cy}px">{Rect(NE["700"], "100%", 1, 0)}</div>',
             f'<div style="position: absolute; left: {x(lo) - 7:.0f}px; top: {cy - 9}px; width: {max(14, x(hi) - x(lo) + 14):.0f}px">{Rect("rgba(157,140,240,.22)", "100%", 18, 9)}</div>']
    for o in offs:
        parts.append(f'<div style="position: absolute; left: {x(o) - 5:.0f}px; top: {cy - 5}px">{Rect("#f0a35e" if o > 60 else "#9d8cf0", 10, 10, 5)}</div>')
    if ticks:
        for o, lab in [(-120, '21:20'), (0, '23:20'), (120, '01:20')]:
            parts.append(f'<div class="t-m" style="position: absolute; top: {H - 16}px; left: {x(o) - 20:.0f}px; width: 40px; text-align: center">{lab}</div>')
    return f'<div style="position: relative; height: {H}px; width: 100%">{"".join(parts)}</div>'


KIND = {'train': '#d9a24f', 'rest': '#93d4f2', 'sick': '#f0a35e', 'off': '#5cc8a8', 'none': NE['800']}
KINDS30 = (['train', 'rest', 'train', 'train', 'none', 'train', 'rest', 'train', 'train', 'sick', 'sick', 'train', 'rest', 'train', 'train',
            'rest', 'train', 'none', 'train', 'off', 'train', 'rest', 'train', 'train', 'rest', 'train', 'train', 'train', 'rest', 'train'])


def KindBar():
    return row(*[col(Rect(KIND[k], '100%', 10, 0), style=f'flex: {n}') for k, n in [('train', 19), ('rest', 8), ('sick', 2), ('off', 1)]], gap=2)


def DayGrid():
    return grid(*[Rect(KIND[k], '100%', 14, 4) for k in KINDS30], cols=15, gap=4)


READY = [('Quads', '61'), ('Hamstrings', '67'), ('Core', '76'), ('Biceps', '88'), ('Back', '92'), ('Shoulders', '94')]
SLEEPS = [6.8, 8.2, 5.4, 8.6, 7.1, 7.4, 8.5]

body = [
    wrow('Readiness', 'readiness', [
        W('S', 'ok', kicker='Readiness', value='82', unit='%', sub='3 recovering', body=Bar(0.82, 'ok')),
        W('M', 'ok', icon='pulse', title='Readiness 82%', sub='3 recovering'),
        W('L', 'ok', kicker='Readiness', body=row(Ring(0.82, 96, 'ok', RL('82')), col(List(READY[:3]), style='flex: 1; min-width: 0'), gap=16)),
        W('XL', 'ok', kicker='Muscle readiness', badge='82%', body=List(READY), footer=B('Open muscles', 'sec', full=True)),
    ]),
    wrow('Last night', 'sleep', [
        W('S', 'sleep', kicker='Last night', value='8h', unit='30m', sub='02:00 → 10:30'),
        W('M', 'sleep', icon='moon', title='Slept 8h 30m', sub='02:00 → 10:30'),
        W('L', 'sleep', kicker='Last night', badge='02:00 → 10:30', value='8h 30m', sub='7-night avg 7h 20m', bodyLast=True, body=ColBars(SLEEPS, (6,), 44, 'sleep')),
        W('XL', 'sleep', kicker='Sleep · 7 nights', value='7h 20m', sub='7-night avg 7h 20m', bodyLast=True, body=ColBars(SLEEPS, (6,), 150, 'sleep', ['Fr', 'Sa', 'Su', 'Mo', 'Tu', 'We', 'Th']),
          footer=Stats([('Last night', '8h 30m'), ('→', '02:00 → 10:30')])),
    ]),
    wrow('Body weight', 'body-weight', [
        W('S', 'neutral', kicker='Body weight', value='81.4', unit='kg', sub=Delta('−0.6 this week', True)),
        W('M', 'neutral', icon='scale', title='81.4 kg', sub='−0.6 this week', trailing=B('Log weight', 'sec')),
        W('L', 'neutral', kicker='Body weight · 30 days', badge=Delta('−1.8 kg', True), value='81.4', unit='kg', bodyLast=True, body=Spark([83.2, 83.0, 83.1, 82.8, 82.8, 82.5, 82.6, 82.3, 82.1, 82.2, 81.8, 81.9, 81.6, 81.4], 56, 'neutral')),
        W('XL', 'neutral', kicker='Body weight · 30 days', badge=Delta('−1.8 kg', True), value='81.4', unit='kg', sub=Delta('−0.6 this week', True), bodyLast=True,
          body=Spark([83.2, 83.0, 83.1, 82.8, 82.8, 82.5, 82.6, 82.3, 82.1, 82.2, 81.8, 81.9, 81.6, 81.4], 150, 'neutral'), footer=B('Log weight', 'sec')),
    ]),
    wrow('Energy today', 'energy-today', [
        W('S', 'kcal', kicker='Burned today', value='2 380', unit='kcal', sub='640 active'),
        W('M', 'kcal', icon='flame', title='2 380 kcal today', sub='640 active · 1 740 resting'),
        W('L', 'kcal', kicker='Energy today', value='2 380', unit='kcal', bodyLast=True, body=Stats([('Resting', '1 740'), ('Workout', '410'), ('Activities', '230')])),
        W('XL', 'kcal', kicker='Energy · Thu, 1 Oct', badge='by hour', value='2 380', unit='kcal', sub='640 active', bodyLast=True,
          body=[ColBars([60, 60, 60, 60, 60, 62, 70, 90, 110, 80, 75, 85, 95, 80, 78, 70, 80, 330, 290, 120, 90, 80, 70, 65], (17, 18), 72, 'kcal', ['00', '', '', '', '', '', '06', '', '', '', '', '', '12', '', '', '', '', '', '18', '', '', '', '', ''], gap=2),
                List([('Resting', '1 740', 'moon', 'kcal'), ('Chest 1', '410', 'dumbbell', 'kcal'), ('Dance', '230', 'music', 'kcal'), (b('Total'), '2 380 kcal')])],
          footer=B('Day history', full=True)),
    ]),
    wrow('Rehab plan', 'rehab', [
        W('S', 'injury', kicker='Rehab', sub='Shoulder (Left) · Reintroduce', body=Ring(0.5, 70, 'injury', RL('2', '/ 4'))),
        W('M', 'injury', icon='bandage', title='Shoulder (Left) · Stage 2 of 4', sub='1 of 2 good check-ins to move up'),
        W('L', 'injury', kicker='Rehab · Shoulder (Left)', badge='day 9', title='Stage 2 of 4 · Reintroduce', bodyLast=True, body=Ladder(1),
          footer=[m('1 of 2 good check-ins to move up', 'flex: 1; min-width: 0'), B('Check-in')]),
        W('XL', 'injury', kicker='Rehab · Shoulder (Left)', badge='day 9', title='Stage 2 of 4 · Reintroduce', sub='1 of 2 good check-ins to move up', bodyLast=True,
          body=[Ladder(1, ['Protect', 'Reintroduce', 'Rebuild', 'Return to full']), kick('Protected muscles · load', 'injury'), List([('Shoulders', '50%'), ('Chest', '50%'), ('Triceps', '50%')]), m('Last check-in · Felt fine · 30 Sep')],
          footer=B('Check-in', full=True)),
    ]),
    wrow('Sleep debt', 'sleep-debt', [
        W('S', 'sleep', kicker='Sleep debt', value='4h', unit='40m', sub='under 8h goal · 7 nights', body=ColBars([60, 30, 85, 5, 40, 40, 2], (2,), 26, 'sleep')),
        W('M', 'sleep', icon='clock', title='Sleep debt 4h 40m', sub='7 nights vs 8h · bed by 22:40 tonight'),
        W('L', 'sleep', kicker='Sleep debt · 7 nights', badge='goal 8h', value='4h 40m', sub='Bed by 22:40 tonight to cut 40m', bodyLast=True, body=ColBars([60, 30, 85, 5, 40, 40, 2], (2,), 34, 'sleep')),
        W('XL', 'sleep', kicker='Sleep debt · 7 nights', badge=Delta('−1h 10m vs last week', True), value='4h 40m', sub='Bed by 22:40 · clear in ~5 nights', bodyLast=True,
          body=[ColBars([60, 30, 85, 5, 40, 40, 2], (2,), 96, 'sleep', ['Fr', 'Sa', 'Su', 'Mo', 'Tu', 'We', 'Th']), List([('Worst night · Sun', '6h 35m'), ('Average sleep', '7h 20m'), ('Naps counted', '−1h 05m')])],
          footer=B('Plan bedtime', full=True)),
    ]),
    wrow('Bedtime consistency', 'bedtime-consistency', [
        W('S', 'sleep', kicker='Bedtime', value='±24 min', sub='Usual 23:20 · 1 late', body=BedStrip([-30, -10, 0, 5, 12, 20, 160], -30, 20, w=141)),
        W('M', 'sleep', icon='clock', title='Bedtime ±24 min', sub='Usual 23:20 · last night 02:00'),
        W('L', 'sleep', kicker='Bedtime · 7 nights', badge='usual 23:20', value='±24 min', sub='spread', bodyLast=True, body=BedStrip([-30, -10, 0, 5, 12, 20, 160], -30, 20)),
        W('XL', 'sleep', kicker='Bedtime · 7 nights', badge='usual 22:50–23:40', value='±24 min', sub='spread · 1 late night', bodyLast=True,
          body=[BedStrip([-30, -10, 0, 5, 12, 20, 160], -30, 20, True), List([('Latest · last night', '02:00'), ('Avg wake-up', '07:10'), ('On rhythm · 14 d', '11 of 14')])],
          footer=B('Set schedule', full=True)),
    ]),
    wrow('Naps', 'naps', [
        W('S', 'sleep', kicker='Naps · this week', value='2', sub='1h 05m total', body=ColBars([0.1, 25, 40, 0.1, 0.1, 0.1, 0.1], (3,), 34, 'sleep')),
        W('M', 'sleep', icon='sun', title='2 naps · 1h 05m', sub='Tue 25m · Wed 40m', trailing=ibtn('plus', 'Log nap', 'fill', sm=True)),
        W('L', 'sleep', kicker='Naps · this week', badge='28 Sep – 4 Oct', title='2 naps · 1h 05m', sub='avg 33m', bodyLast=True, body=ColBars([0.1, 25, 40, 0.1, 0.1, 0.1, 0.1], (3,), 34, 'sleep')),
        W('XL', 'sleep', kicker='Naps · this week', badge='28 Sep – 4 Oct', title='2 naps · 1h 05m', sub='avg 33m', bodyLast=True,
          body=[ColBars([0.1, 25, 40, 0.1, 0.1, 0.1, 0.1], (3,), 90, 'sleep', ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']), List([('Tue · 14:10–14:35', '25m'), ('Wed · 15:00–15:40', '40m'), ('Sleep debt offset', '−1h 05m')])],
          footer=B('Log nap', icon='plus', full=True)),
    ]),
    wrow('Body composition', 'body-composition', [
        W('S', 'neutral', kicker='Body fat', value='17.8', unit='%', sub='BMI 24.6'),
        W('M', 'neutral', icon='body', title='Fat 17.8% · muscle 42.1%', sub='BMI 24.6 · waist 84 cm'),
        W('L', 'neutral', kicker='Body composition', badge='28 Sep', sub='Chest 104 · Waist 84 · Hip 98 cm', body=Stats([('BMI', '24.6'), ('Body fat', '17.8%'), ('Muscle', '42.1%')])),
        W('XL', 'neutral', kicker='Body composition · 30 d', badge='28 Sep', body=[Spark([25.1, 25.0, 24.9, 24.8, 24.8, 24.7, 24.6], 64, 'neutral', True),
                                                                                List([('BMI', row(txt('24.6', 't-m'), Delta('−0.5'), gap=6)), ('Body fat', '17.8%'), ('Muscle', '42.1%'), ('Lean mass', row(txt('66.9 kg', 't-m'), Delta('+0.4'), gap=6)),
                                                                                      ('Chest', '104 cm'), ('Waist', '84 cm'), ('Hip', '98 cm')])],
          footer=B('Update measurements', full=True)),
    ]),
    wrow('Resting energy', 'resting-energy', [
        W('S', 'kcal', kicker='Resting energy', value='1 740', unit='kcal', sub='per day · BMR'),
        W('M', 'kcal', icon='bolt', title='BMR 1 740 kcal/day', sub='81.4 kg · 17.8% fat · −15 in 30 d'),
        W('L', 'kcal', kicker='Resting energy · BMR', badge=Delta('−15 in 30 d', True), value='1 740', unit='kcal / day', bodyLast=True, body=Stats([('BMR', '1 740'), ('Daily life', '~380'), ('Training today', '~420')])),
        W('XL', 'kcal', kicker='Resting energy · 30 d', badge='Katch–McArdle', value='1 740', unit='kcal / day', sub=Delta('−15 in 30 d', True), bodyLast=True,
          body=[Spark([1755, 1754, 1754, 1752, 1750, 1746, 1742, 1740], 56, 'kcal', True), List([('Body weight', '81.4 kg'), ('Lean mass', '66.9 kg'), ('Lifestyle', 'Moderate'), ('Training today', '~420 kcal'), (b('Total daily estimate'), '≈ 2 540 kcal')])],
          footer=B('Log weight', full=True)),
    ]),
    wrow('Physique goal', 'physique-goal', [
        W('S', 'accent', kicker='Physique goal', sub='Lean Athlete · 2.4 kg to go', body=Ring(0.57, 70, 'accent', RL('57%'))),
        W('M', 'accent', icon='target', title='Lean Athlete · 57% there', sub='81.4 → 79 kg · On pace for 3 Dec'),
        W('L', 'accent', kicker='Physique goal', badge='Overall 57%', title='Lean Athlete', sub='Target 79 kg · On pace for 3 Dec', bodyLast=True, body=Bar(0.57, 'accent', 8)),
        W('XL', 'accent', kicker='Physique goal', badge='started 6 Jul', title='Lean Athlete', sub='Conditioned and defined', bodyLast=True,
          body=[row(Ring(0.57, 96, 'accent', RL('57%')), col(kick('Overall', 'accent'), m('On pace for 3 Dec'), gap=4), gap=16), List([('Weight', '81.4 → 79 kg'), ('Body fat', '17.8%'), ('Waist', '84 cm'), ('Chest', '104 cm')])],
          footer=B('Adjust goal', full=True)),
    ]),
    wrow('Rest & illness log', 'rest-illness-log', [
        W('S', 'rest', kicker='Rest · 30 d', value='11', unit='days off', sub='Streak 12 kept ✓'),
        W('M', 'rest', icon='moon', title='8 rest · 2 sick · 1 off', sub='Last 30 days · streak 12 safe ✓'),
        W('L', 'rest', kicker='Rest & illness · 30 d', badge='Streak 12 kept ✓', body=[KindBar(), Stats([('Train', '19'), ('Rest', '8'), ('Sick', '2'), ('Off', '1')])]),
        W('XL', 'rest', kicker='Rest & illness · 30 d', badge='Streak 12 kept ✓',
          body=[DayGrid(), Stats([('Train', '19'), ('Rest', '8'), ('Sick', '2'), ('Off', '1')]), List([('Active rest', '30 Sep'), ('Day off · Travel', '21 Sep'), ('Sick · Cold', '12 Sep – 13 Sep')])],
          footer=[m('None of these broke the streak', 'flex: 1; min-width: 0'), B('Log a day', icon='plus')]),
    ]),
]


# ============================================================== CARDIO (cardio.tsx) — 8 widgets in code
WK = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
cardio = [
    wrow('Distance this week', 'distance-week', [
        W('S', 'sport', kicker='This week', value='24.8', unit='km', sub=Delta('+3.5 vs last week')),
        W('M', 'sport', icon='map', title='24.8 km this week', sub='Run 10.2 · Walk 6.1 · Cycling 8.5'),
        W('L', 'sport', kicker='Distance · this week', badge=Delta('+3.5'), value='24.8', unit='km', bodyLast=True, body=Stats([('Run', '10.2 km'), ('Walk', '6.1 km'), ('Cycling', '8.5 km')])),
        W('XL', 'sport', kicker='Distance · 28 Sep – 4 Oct', badge=Delta('+3.5'), value='24.8', unit='km', sub='last week 21.3', bodyLast=True,
          body=[ColBars([6.5, 9.5, 1.8, 7.0, 0, 0, 0], (3,), 70, 'sport', WK), List([('Run', '10.2 km', 'run', 'active'), ('Cycling', '8.5 km', 'bike', 'active'), ('Walk', '6.1 km', 'run', 'active')])],
          footer=B('Log activity', icon='plus')),
    ]),
    wrow('Last route', 'last-route', [
        W('S', 'sport', kicker='Run · Today', value='5.2', unit='km', sub='5:12 /km · 27:04'),
        W('M', 'sport', icon='run', title='Run · 5.2 km · 27:04', sub='Today · 5:12 /km'),
        W('L', 'sport', kicker='Run · Today', value='5.2', unit='km', sub='Riverside loop', bodyLast=True, body=Stats([('Time', '27:04'), ('Pace', '5:12 /km')])),
        W('XL', 'sport', kicker='Last route · Run', badge='Today',
          body=[row(tile('run', 'sport', lg=True), col(val('5.2', 'km'), m('Riverside loop'), gap=4), gap=12), Stats([('Distance', '5.2 km'), ('Time', '27:04'), ('Pace', '5:12 /km'), ('Burned', '412 kcal')]),
                List([('Walk · Mon', '3.1 km · 11:40 /km', 'run', 'sport'), ('Cycling · Sat', '8.5 km · 24.1 km/h', 'bike', 'sport'), ('Run · Thu', '5.0 km · 5:19 /km', 'run', 'sport')])],
          footer=B('Log a run', icon='plus')),
    ]),
    wrow('Pace trend', 'pace-trend', [
        W('S', 'sport', kicker='Pace · 6 runs', value='5:12', unit='/km', sub=Delta('↑ 29 s faster'), body=Spark([-341, -336, -338, -330, -326, -312], 30, 'sport', True, 141)),
        W('M', 'sport', icon='pulse', title='5:12 /km last run', sub='↑ 29 s faster over 6 runs'),
        W('L', 'sport', kicker='Pace · last 6 runs', badge=Delta('−0:29 /km'), value='5:12', unit='/km', bodyLast=True, body=Spark([-341, -336, -338, -330, -326, -312], 48, 'sport', True)),
        W('XL', 'sport', kicker='Pace · last 6 runs', badge=Delta('−0:29 /km'), value='5:12', unit='/km', sub='avg 5:27 /km', bodyLast=True,
          body=[Spark([-341, -336, -338, -330, -326, -312], 72, 'sport', True), List([('Today · 5.2 km', '5:12 /km · best'), ('Mon · 5.0 km', '5:19 /km'), ('Fri · 6.4 km', '5:24 /km')])],
          footer=B('Log a run', icon='plus')),
    ]),
    wrow('Cardio machine', 'cardio-machine', [
        W('S', 'accent', kicker='Rower · Tue', value='2:04', unit='/500 m', sub='2 000 m · 142 kcal'),
        W('M', 'accent', icon='wave', title='Rower · 2:04 /500 m', sub='Tue · 2 000 m · 8:16 · 142 kcal'),
        W('L', 'accent', kicker=f'Rower · Tue at {GYM}', badge='PB pace', body=[sp(), Stats([('Pace', '2:04 /500 m'), ('Distance', '2 000 m'), ('Burned', '142 kcal')])]),
        W('XL', 'accent', kicker=f'Rower · Tue at {GYM}', badge='PB pace',
          body=[Stats([('Pace', '2:04 /500 m'), ('Distance', '2 000 m'), ('Burned', '142 kcal')]), row(m('Rower · 5 sessions', 'flex: 1'), m('2:11 → 2:04')), Spark([-131, -130, -129, -128, -124], 48, 'accent'),
                List([('Treadmill · Sat', '3 500 m · 20 min'), ('Recumbent bike · 22 Sep', '30 min')])],
          footer=B('Start cardio session', icon='play')),
    ]),
    wrow('Active minutes', 'active-minutes', [
        W('S', 'active', kicker='Active min · week', body=row(Ring(0.75, 72, 'active', RL('112')), m('of 150 min · week'), gap=10, style='flex: 1')),
        W('M', 'active', icon='pulse', title='112 / 150 active min', sub='38 min to go · 3 days left'),
        W('L', 'active', kicker='Active min · week', body=row(Ring(0.75, 96, 'active', RL('112', 'of 150')), col(txt('38 min to go', 't-h3'), m('3 days left · ~13 min/day'), gap=4), gap=16, style='flex: 1')),
        W('XL', 'active', kicker='Active minutes · 28 Sep – 4 Oct', badge='WHO 150',
          body=[row(Ring(0.75, 96, 'active', RL('112', '112 / 150')), col(txt('38 min to go', 't-h3'), m('3 days left · ~13 min/day'), gap=4), gap=16),
                ColBars([40, 36, 13, 23, 0, 0, 0], (3,), 52, 'active', WK), Stats([('Run', '53 min'), ('Cycling', '36 min'), ('Walk', '23 min')])],
          footer=B('Log activity', icon='plus')),
    ]),
    wrow('Favourite sport', 'favourite-sport', [
        W('S', 'sport', kicker='Top sport · 30 d', title='Football', sub='6× · 7h 10m total', body=tile('target', 'sport')),
        W('M', 'sport', icon='target', title='Football · 6× in 30 days', sub='Next: Tennis 4× · Padel 2×'),
        W('L', 'sport', kicker='Top sports · 30 days', badge='12 sessions', body=List([('Football', '6× · 7h 10m'), ('Tennis', '4× · 3h 05m'), ('Padel', '2× · 1h 40m')])),
        W('XL', 'sport', kicker='Favourite sport · 30 days', badge='13 sessions',
          body=[row(tile('target', 'sport', lg=True), col(txt('Football', 't-h2'), m('6× · 7h 10m · 1 490 kcal'), gap=0), gap=12),
                List([('Football', '6× · 7h 10m', 'target', 'sport'), ('Tennis', '4× · 3h 05m', 'target', 'sport'), ('Padel', '2× · 1h 40m', 'target', 'sport'), ('Swim', '1× · 45m', 'wave', 'active')]),
                m('Usually on Tue, Fri')],
          footer=B('See all activities ›')),
    ]),
    wrow('Recovery rituals', 'recovery-rituals', [
        W('S', 'rest', kicker='Recovery · September', value='9', unit='sessions', sub='Sauna 5 · Cold plunge 3 · Massage 1'),
        W('M', 'rest', icon='flame', title='9 recovery sessions', sub='Last: Sauna · Yesterday', trailing=ibtn('plus', 'Log recovery', 'fill', sm=True)),
        W('L', 'rest', kicker='Recovery rituals · September', badge='9 total', body=List([('Sauna', '5×'), ('Cold plunge', '3×'), ('Massage', '1×')])),
        W('XL', 'rest', kicker='Recovery rituals · September', badge='9 recovery sessions',
          body=[List([('Sauna', '5× · 1h 40m', 'flame', 'rest'), ('Cold plunge', '3× · 9 min', 'wave', 'rest'), ('Massage', '1× · 60 min', 'heart', 'rest')]), m('Last: Sauna · Yesterday'), Delta('↑ 3 more than August')],
          footer=B('Log recovery', icon='plus')),
    ]),
    wrow('Activity calories', 'activity-kcal', [
        W('S', 'kcal', kicker='Activities · week', value='1 860', unit='kcal', sub=Delta('+240 vs last week')),
        W('M', 'kcal', icon='flame', title='1 860 kcal from activities', sub='This week · top: Run 720'),
        W('L', 'kcal', kicker='Activity calories · this week', badge=Delta('+240'), value='1 860', unit='kcal', bodyLast=True, body=Stats([('Run', '720'), ('Cycling', '460'), ('Dance', '370'), ('Walk', '310')])),
        W('XL', 'kcal', kicker='Activity calories · 28 Sep – 4 Oct', badge=Delta('+240'), value='1 860', unit='kcal', sub='last week 1 620', bodyLast=True,
          body=[ColBars([520, 540, 500, 300, 0, 0, 0], (3,), 64, 'kcal', WK), Stats([('Run', '720'), ('Cycling', '460'), ('Dance', '370'), ('Walk', '310')])],
          footer=B('Open day history ›')),
    ]),
]


# ============================================================== APEX (apex.tsx) — every widget in apex tone
def PL(label, value, frac):
    """apex progressLine: sub label · sub value, then an apex bar."""
    return col(row(m(label, 'flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis'), m(value), gap=8), Bar(frac, 'apex'), gap=6)


def AF(t):
    return B(t, 'sec', full=True)


FEATS = [('Tonnage', 5, 8), ('Sessions', 4, 6), ('Streak', 3, 6), ('PRs', 3, 5), ('Squat', 2, 4), ('Bench', 3, 4), ('Deadlift', 2, 4), ('OHP', 1, 4),
         ('Cardio', 2, 4), ('Distance', 1, 3), ('Sleep', 1, 3), ('Learn', 2, 4), ('Recaps', 1, 3), ('Early bird', 1, 3), ('Night owl', 0, 3), ('Variety', 0, 4),
         ('Gyms', 0, 3), ('Photos', 0, 3), ('Share', 0, 2)]
YEAR = [1, 2, 0, 3, 2, 1, 2, 1, 2, 0, 0, 0]
MON = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

apex = [
    wrow('Streak', 'streak', [
        W('S', 'apex', kicker='Streak', value='12', unit='days', sub='Train or rest today to keep it', body=tile('flame', 'apex')),
        W('M', 'apex', icon='flame', title='12-day streak', sub='Train or rest today to keep it'),
        W('L', 'apex', kicker='Streak', value='12', unit='days', sub='Train or rest today to keep it', bodyLast=True, body=Dots([1, 1, 1, 1, 1, 1, 0], 8, 'apex')),
        W('XL', 'apex', kicker='Streak', body=col(Ring(0.4, 130, 'apex', RL('12', 'days')), m('Train or rest today to keep it'), gap=10, style='flex: 1; align-items: center; justify-content: center'),
          footer=AF('Open Apex')),
    ]),
    wrow('Challenge', 'apex-challenge', [
        W('S', 'apex', kicker='Challenge', badge='62%', value='62', unit='of 100 km', sub='October 100 km', bodyLast=True, body=Bar(0.62, 'apex')),
        W('M', 'apex', icon='trophy', title='October 100 km', sub='62 of 100 km · 5 days left', trailing=TT('62%', 'apex')),
        W('L', 'apex', kicker='Challenge', badge='+1 more active',
          body=row(Ring(0.62, 88, 'apex', RL('62%')), col(txt('October 100 km', 't-h3'), m('62 of 100 km'), m('≈ 7.6 km a day to finish'), gap=3, style='min-width: 0'), gap=14, style='flex: 1')),
        W('XL', 'apex', kicker='Challenge', badge='ends 13 Oct',
          body=[row(Ring(0.62, 96, 'apex', RL('62%')), col(txt('October 100 km', 't-h3'), m('Run, walk or ride 100 km this month', 'white-space: normal'), TT('5 days left', 'apex'), gap=4, style='min-width: 0'), gap=14),
                Dots([1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0], 8, 'apex'), List([('≈ 7.6 km a day to finish', '62%'), ('+1 more active', '')])],
          footer=AF('Open')),
    ]),
    wrow('Rank & mastery', 'apex-rank', [
        W('S', 'apex', kicker='Bench', title='Silver II', sub='4.5 kg to Gold I', bodyLast=True, body=Bar(0.7, 'apex')),
        W('M', 'apex', icon='shield', title='Silver II · Bench', sub='4.5 kg to Gold I'),
        W('L', 'apex', kicker='Closest rank · Bench', badge='1.26× BW', title='Silver II', bodyLast=True, body=PL('To Gold I', '4.5 kg', 0.7)),
        W('XL', 'apex', kicker='Ranks', badge='Mastery 640',
          body=[List([('Squat', TT('Gold I', 'apex')), ('Bench', 'Silver II'), ('Deadlift', TT('Gold II', 'apex')), ('Overhead press', 'Silver I')]),
                PL('Closest: Bench → Gold I', '4.5 kg', 0.7)],
          footer=AF('Open ranks')),
    ]),
    wrow('Awards', 'apex-awards', [
        W('S', 'apex', kicker='Awards', badge='14', title='🏋 Iron Month', sub='Unlocked 27 Sep'),
        W('M', 'apex', icon='trophy', title='🏋 Iron Month', sub='Unlocked 27 Sep · 14 of 60'),
        W('L', 'apex', kicker='Awards', badge='14 of 60 unlocked', title='🏋 Iron Month', sub='Unlocked 27 Sep', bodyLast=True, body=PL('Next · 100 tonnes lifted', '82%', 0.82)),
        W('XL', 'apex', kicker='Awards', badge='14 of 60 unlocked',
          body=[List([('🏋 Iron Month', '27 Sep'), ('🔥 Two-week streak', '21 Sep'), ('🌅 Early bird', '9 Sep'), ('🎯 First PR', '2 Sep'), (m('Locked · 46 more'), '')]),
                PL('Next · 100 tonnes lifted', '82%', 0.82)],
          footer=AF('All awards')),
    ]),
    wrow('Apex feed', 'apex-feed', [
        W('S', 'apex', kicker='Apex feed', value='3', unit='new'),
        W('M', 'apex', icon='bell', title='3 new in Apex', sub='New PR · Bench 102 kg'),
        W('L', 'apex', kicker='Apex feed · 3 new', body=List([('New PR · Bench 102 kg', '3 d'), ('Award · Iron Month', '4 d'), ('Feat · Tonnage III', '1 w')])),
        W('XL', 'apex', kicker='Apex feed · 3 new',
          body=List([('New PR · Bench 102 kg', '3 d', 'trophy', 'apex'), ('Award · Iron Month', '4 d', 'star', 'apex'), ('Feat · Tonnage III', '1 w', 'target', 'apex'),
                     ('Rank up · Squat Gold I', '2 w', 'shield', 'apex'), ('12-day streak', '2 w', 'flame', 'apex')]),
          footer=AF('See all')),
    ]),
    wrow('Mastery', 'apex-mastery', [
        W('S', 'apex', kicker='Mastery', value='640', unit='/ 1000', sub='Master II', bodyLast=True, body=Bar(0.64, 'apex')),
        W('M', 'apex', icon='shield', title='Mastery 640 · Master II', sub='26 pts to Master III'),
        W('L', 'apex', kicker='Mastery',
          body=row(Ring(0.64, 88, 'apex', RL('640', 'of 1000')), col(txt('Master II', 't-h3'), Dots([1] * 7 + [0] * 5, 6, 'apex'), m('26 pts to Master III'), gap=6, style='flex: 1; min-width: 0'), gap=14, style='flex: 1')),
        W('XL', 'apex', kicker='Mastery', badge='Rank 8 of 12',
          body=[row(Ring(0.64, 84, 'apex', RL('640', 'of 1000')), col(txt('Master II', 't-h3'), m('26 pts to Master III'), Delta('+12 this week'), gap=4), gap=14),
                Dots([1] * 8 + [0] * 4, 6, 'apex'), TT('What moves it', 'apex'),
                List([('Strength', '248'), ('Consistency', '196'), ('Experience', '122'), ('Practice', '74')])],
          footer=AF('Open Mastery')),
    ]),
    wrow('Level-up countdown', 'apex-level-up', [
        W('S', 'apex', kicker='Level up', value='26', unit='pts', sub='to Master III'),
        W('M', 'apex', icon='up', title='26 pts to Master III', sub='≈ 3 workouts at this pace', trailing=m('640 → 666')),
        W('L', 'apex', kicker='Level up · Master III', badge='≈ 3 workouts', value='26', unit='pts to go', bodyLast=True,
          body=col(Bar(0.54, 'apex', 8), row(m('Master II'), sp(), m('640'), sp(), m('Master III')), gap=6)),
        W('XL', 'apex', kicker='Level up', badge='Rank 8 of 12',
          body=[row(Ring(0.54, 84, 'apex', RL('26', 'pts')), col(txt('Master III at 666', 't-h3'), m('≈ 3 workouts at this pace'), gap=4), gap=14),
                TT('Fastest ways to earn', 'apex'), List([('Finish a full session', '+9'), ('Hit a PR', '+6'), ('Keep the streak 7 days', '+4')])],
          footer=AF('Start a workout')),
    ]),
    wrow('Next feat', 'apex-next-feat', [
        W('S', 'apex', kicker='Next feat', value='86', unit='/ 100 t', sub='Tonnage IV', bodyLast=True, body=Bar(0.86, 'apex')),
        W('M', 'apex', icon='target', title='Tonnage IV · 14 t left', sub='≈ 2 sessions', trailing=TT('86%', 'apex')),
        W('L', 'apex', kicker='Next feat', badge='≈ 2 sessions', title='Tonnage IV', sub='Lift 100 t in total', bodyLast=True, body=[Bar(0.86, 'apex'), m('Then · Sessions V')]),
        W('XL', 'apex', kicker='Next feat', badge='≈ 2 sessions',
          body=[txt('🏋 Tonnage IV', 't-h3'), val('86', '/ 100 t'), PL('14 t left', '86%', 0.86), TT('Up next', 'apex'),
                PL('Sessions V · 8 left', '84%', 0.84), PL('Bench III · 7.5 kg left', '70%', 0.70), PL('Streak IV · 9 days left', '57%', 0.57), m('19 axes · 31 / 76 tiers')],
          footer=AF('All feats')),
    ]),
    wrow('Feats board', 'apex-feats-board', [
        W('S', 'apex', kicker='Feats', value='31', unit='/ 76', sub='14 of 19 axes started', bodyLast=True, body=Bar(31 / 76, 'apex')),
        W('M', 'apex', icon='grid', title='Feats 31 / 76 tiers', sub='14 of 19 axes started'),
        W('L', 'apex', kicker='Feats board', badge='31 / 76 tiers', sub='Closest · Tonnage IV 86%', bodyLast=True,
          body=ColBars([g / t for _, g, t in FEATS], tuple(i for i, (_, g, _t) in enumerate(FEATS) if g), 56, 'apex', gap=3)),
        W('XL', 'apex', kicker='Feats board', badge='31 / 76 tiers',
          body=[grid(*[col(row(m(n, 'flex: 1'), m(str(g)), gap=6), Bar(g / t, 'apex', 3), gap=2) for n, g, t in FEATS], cols=2, gap=6, style='column-gap: 16px'),
                m('Closest · Tonnage IV 86%')],
          footer=AF('All feats')),
    ]),
    wrow('Year in feats', 'apex-year-feats', [
        W('S', 'apex', kicker='Feats · 2026', value='14', unit='unlocks', sub='vs 9 in 2025', bodyLast=True, body=ColBars(YEAR[:9], (8,), 22, 'apex', gap=3)),
        W('M', 'apex', icon='calendar', title='14 feats unlocked in 2026', sub='Latest · Tonnage III, 22 Sep'),
        W('L', 'apex', kicker='Feats · 2026', badge='vs 9 in 2025', value='14', unit='unlocks', bodyLast=True, body=ColBars(YEAR, (8,), 48, 'apex', MON, 4)),
        W('XL', 'apex', kicker='Year in feats · 2026', badge='vs 9 in 2025', value='14', unit='unlocks', bodyLast=True,
          body=[ColBars(YEAR, (8,), 84, 'apex', MON, 4), List([('🏋 Tonnage III · Tonnage', '22 Sep'), ('🔥 Streak III · Streak', '14 Sep'), ('🎯 PRs II · PRs', '2 Sep')])],
          footer=AF('All feats')),
    ]),
]


# ============================================================== LEARN (learnatlas.tsx) — learn tone
def P2(t, strong=False):
    """Para: wrapped text, name (16/600) or sub."""
    return txt(t, 't-h3' if strong else 't-m', 'white-space: normal')


def PlayRow(title, meta_, pre=None):
    return row(tile('play', 'learn', lg=True, s=28), col(m(pre) if pre else '', P2(title, True), m(meta_), gap=2, style='min-width: 0; flex: 1'), gap=12)


def TopicCell(t, d, n):
    full = d == n
    return col(row(m(t, 'flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis'), m('✓' if full else f'{d}/{n}'), gap=4), Bar(d / n, 'ok' if full else 'learn', 4), gap=4, style='min-width: 0')


TOPICS = [('Technique', 6, 6), ('Hypertrophy', 4, 7), ('Strength', 2, 6), ('Recovery', 1, 5), ('Nutrition', 0, 5), ('Programming', 1, 6)]
FACT = ('Sets near failure build muscle', 'Sets taken close to failure build more muscle — stopping 0–3 reps short works about as well as going all the way.', 'Robinson et al., 2024 · meta-analysis')

learn = [
    wrow('Learn · next lesson', 'learn-next', [
        W('S', 'learn', kicker='Learn', value='14', unit='/ 35', sub='lessons watched', bodyLast=True, body=Bar(14 / 35, 'learn')),
        W('M', 'learn', icon='play', title='Bracing for heavy squats', sub='Technique · 14 of 35 lessons'),
        W('L', 'learn', kicker='Continue', badge='14 / 35', title='Bracing for heavy squats', sub='Technique · 6 min', bodyLast=True, body=Bar(14 / 35, 'learn')),
        W('XL', 'learn', kicker='Learn', badge='14 / 35',
          body=[PlayRow('Bracing for heavy squats', 'Technique · 6 min'), Stats([('Library progress', '14 / 35'), ('lessons watched', '40%')]),
                List([('Hip hinge basics', 'Technique', 'play', 'learn'), ('How many sets per week', 'Hypertrophy', 'play', 'learn'), ('Rest between sets', 'Hypertrophy', 'play', 'learn')])],
          footer=B('Next lesson', icon='play', full=True)),
    ]),
    wrow('Lesson of the day', 'lesson-of-day', [
        W('S', 'learn', kicker='Daily', title='Rest between sets', sub='Hypertrophy'),
        W('M', 'learn', icon='play', title='Rest between sets', sub='Lesson of the day · Hypertrophy'),
        W('L', 'learn', kicker='Lesson of the day', badge='Tue', title='Rest between sets', sub='Hypertrophy · 5 min · new', footer=B('Watch', icon='play')),
        W('XL', 'learn', kicker='Lesson of the day', badge='Tue 29 Sep',
          body=[PlayRow('Rest between sets', 'Hypertrophy · 5 min · new'), P2('Why three minutes between heavy sets builds more muscle than one, and when shorter rest is fine.'),
                m('Up next · Hypertrophy'), List([('How many sets per week', '6 min', 'play', 'learn'), ('Training to failure', '7 min', 'play', 'learn')])],
          footer=B('Watch', icon='play', full=True)),
    ]),
    wrow('Saved lessons', 'learn-saved', [
        W('S', 'learn', kicker='Saved', value='5', unit='lessons', sub='Unwatched · 3'),
        W('M', 'learn', icon='note', title='Saved lessons · 5', sub='Next: Deadlift setup'),
        W('L', 'learn', kicker='Saved lessons · 5', badge='Unwatched · 3',
          body=List([('Deadlift setup', 'Technique', 'play', 'learn'), ('Protein timing', 'Nutrition', 'play', 'learn'), ('Deload weeks', 'Programming', 'check', 'ok')])),
        W('XL', 'learn', kicker='Saved lessons · 5', badge='Unwatched · 3',
          body=[PlayRow('Deadlift setup', 'Technique · 8 min', 'Up next'),
                List([('Protein timing', 'Nutrition', 'play', 'learn'), ('Deload weeks', 'Watched', 'check', 'ok'), ('Sleep and strength', 'Recovery', 'play', 'learn'), ('Warm-up sets', 'Watched', 'check', 'ok')])],
          footer=B('Play all', icon='play', full=True)),
    ]),
    wrow('Learn topics', 'learn-topics', [
        W('S', 'learn', kicker='Learn topics', value='40', unit='%', sub='Next: Hypertrophy', bodyLast=True, body=[Bar(0.4, 'learn'), m('14/35 lessons')]),
        W('M', 'learn', icon='layers', title='14 of 35 lessons', sub='Hypertrophy · Topics done · 1 of 6'),
        W('L', 'learn', kicker='Learn topics', badge='14 / 35', body=grid(*[TopicCell(*x) for x in TOPICS], cols=2, gap=8, style='column-gap: 14px')),
        W('XL', 'learn', kicker='Learn topics', badge='14 / 35',
          body=[row(Ring(0.4, 84, 'learn', RL('40%')), col(txt('14 of 35 lessons', 't-h3'), m('Topics done · 1 of 6'), gap=4), gap=14),
                List([(t, '✓' if d == n else f'{d} / {n}') for t, d, n in TOPICS])],
          footer=B('Open Learn', full=True)),
    ]),
    wrow('Did you know', 'did-you-know', [
        W('S', 'learn', kicker='Did you know', body=P2(FACT[0], True)),
        W('M', 'learn', icon='book', title='Did you know', sub=FACT[0]),
        W('L', 'learn', kicker='Did you know', badge='Science · 1 of 8', sub=FACT[2], body=P2(FACT[1])),
        W('XL', 'learn', kicker='Did you know', badge='Science · 1 of 8',
          body=[col(tile('book', 'learn', lg=True, s=30), style='align-items: center; padding: 8px 0'), P2(FACT[0], True), P2(FACT[1]), Stats([('Source', FACT[2])])],
          footer=B('Open Learn', full=True)),
    ]),
]


# ============================================================== ATLAS (learnatlas.tsx) — atlas tone; mood follows the temper (Blunt → accent)
def SetsBar(label, n, of, tone):
    return col(row(m(label, 'flex: 1'), m(str(n)), gap=8), Bar(n / of, tone), gap=4)


atlas = [
    wrow('Atlas insight', 'atlas-insight', [
        W('S', 'atlas', kicker='Atlas', value='44', unit='% gap', sub='Hamstrings < Quads'),
        W('M', 'atlas', icon='spark', title='Hamstrings 44% under Quads', sub='Atlas · Balance · 2 h'),
        W('L', 'atlas', kicker='Atlas · Balance', badge='2 h', body=P2('Hamstrings got 9 sets this fortnight against 16 for quads. Add a hinge on leg day.'), footer=B('Ask Atlas')),
        W('XL', 'atlas', kicker='Atlas · Balance', badge='2 h',
          body=[P2('Hamstrings 44% under Quads', True), P2('Hamstrings got 9 sets this fortnight against 16 for quads. Add Romanian deadlifts on leg day and keep curls — the gap closes in two weeks.'),
                SetsBar('Quads · sets', 16, 16, 'neutral'), SetsBar('Hamstrings · sets', 9, 16, 'atlas')],
          footer=B('Ask Atlas', full=True)),
    ]),
    wrow('Ask Atlas', 'ask-atlas', [
        W('S', 'atlas', kicker='Atlas', title='Ask Atlas', sub='Am I recovered?'),
        W('M', 'atlas', icon='spark', title='Ask anything…', sub='What should I train today?'),
        W('L', 'atlas', kicker='Ask Atlas', body=Chips(['What should I train today?', 'Am I recovered?', 'How is my Bench going?']), footer=B('Ask anything…', 'sec', full=True)),
        W('XL', 'atlas', kicker='Ask Atlas', badge='Readiness 82%',
          body=[P2('How long should I rest?', True), P2('Between heavy sets of squats, 3 minutes. For curls and raises 60–90 seconds is fine — you’ll still grow.')],
          footer=B('Ask anything…', 'sec', full=True)),
    ]),
    wrow('Ask Atlas · one tap', 'atlas-quick-ask', [
        W('S', 'atlas', kicker='Atlas', title='Tap to ask', body=col(tile('chat', 'atlas', lg=True, s=26), style='flex: 1; align-items: center; justify-content: center')),
        W('M', 'atlas', icon='chat', title='Ask Atlas', sub='A quick question between sets', trailing=B('Ask')),
        W('L', 'atlas', kicker='Ask Atlas', body=row(tile('chat', 'atlas', lg=True, s=28), col(txt('Tap to ask', 't-h3'), m('“What should I train today?”'), m('“Am I recovered?”'), gap=2, style='min-width: 0'), gap=12)),
        W('XL', 'atlas', kicker='Ask Atlas · one tap',
          body=[col(tile('chat', 'atlas', lg=True, s=28), m('A quick question between sets'), gap=8, style='align-items: center; padding: 6px 0'), m('Try asking'),
                List([('“What should I train today?”', '›'), ('“Am I recovered?”', '›'), ('“How is my Bench going?”', '›')]), m('Last: “How long should I rest?”')],
          footer=B('Ask', full=True)),
    ]),
    wrow('Atlas plan for today', 'atlas-plan', [
        W('S', 'atlas', kicker='Train', title='Pull day', sub='Barbell row 70 kg × 8'),
        W('M', 'atlas', icon='dumbbell', title='Train · Pull day', sub='Atlas · Barbell row 70 kg × 8 · Readiness 82%', trailing=B('Start')),
        W('L', 'atlas', kicker='Atlas · today', badge='Readiness 82%', title='Pull day', sub='Exercises · 5 · ~55 min · Focus: Barbell row 70 kg × 8', sub_wrap=True, footer=B('Start')),
        W('XL', 'atlas', kicker='Atlas · plan for Tue 29 Sep', badge='Readiness 82%',
          body=[col(txt('Pull day', 't-h3'), m('Exercises · 5 · ~55 min · Biceps still recovering'), gap=2),
                List([('Barbell row', '70 kg × 8', 'target', 'atlas'), ('Pull-up', '10 kg × 8'), ('Lat pulldown', '60 kg × 10'), ('Face pull', '22.5 kg × 15'), ('Hammer curl', '16 kg × 12')])],
          footer=B('Start Pull day', full=True)),
    ]),
    wrow('Atlas debrief', 'atlas-debrief', [
        W('S', 'atlas', kicker='Debrief', value='2', unit='· 1', title='Chest 1', sub='Wins 2 · changes 1'),
        W('M', 'atlas', icon='list', title='Debrief · Chest 1', sub='Wins 2 · changes 1'),
        W('L', 'atlas', kicker='Debrief · Chest 1', badge='Mon',
          body=List([('Bench press 102 kg × 3 — new best', '', 'check', 'ok'), ('Incline press: rested 1:10, the plan was 2:00', '', 'rotate', 'accent')])),
        W('XL', 'atlas', kicker='Atlas debrief', badge='Mon 28 Sep',
          body=[txt('Chest 1', 't-h3'), Stats([('Volume', '9.4 t'), ('Sets', '18'), ('PR', '1')]),
                List([('Bench press 102 kg × 3 — new best', '', 'check', 'ok'), ('All 18 working sets done', '', 'check', 'ok'), ('Incline press: rested 1:10, the plan was 2:00', '', 'rotate', 'accent')])],
          footer=B('Ask Atlas', full=True)),
    ]),
    wrow('Atlas mood', 'atlas-mood', [
        W('S', 'accent', kicker='Atlas mood', title='Blunt', bodyLast=True, body=P2('straight talk, no fluff')),
        W('M', 'accent', icon='spark', title='Atlas · Blunt', sub='straight talk, no fluff'),
        W('L', 'accent', kicker='Atlas · Blunt', body=[P2('straight talk, no fluff'), Stats([('Streak', '12 d'), ('Readiness', '82%')])]),
        W('XL', 'accent', kicker='Atlas mood', badge='Blunt',
          body=[P2('Three sessions, no excuses. Row day is next — don’t skip the last set.', True), chips(['Warm', 'Blunt', 'Merciless'], on=1), m('Why this mood'),
                List([('Streak', '12 d'), ('Readiness', '82%'), ('Sessions this week', '3'), ('A normal day — your chosen temper', '')])],
          footer=B('Talk to Atlas', full=True)),
    ]),
    wrow('Atlas notes', 'atlas-notes', [
        W('S', 'atlas', kicker='Atlas notes', value='3', title='Bench press record · 102 kg', sub='+2 more'),
        W('M', 'atlas', icon='edit', title='Unread · 3', sub='Bench press record · 102 kg · +2 more'),
        W('L', 'atlas', kicker='Atlas notes', badge='Unread · 3',
          body=List([('Bench press record · 102 kg', 'Record'), ('Incline press: rest cut short', 'Rest'), ('Short night · 5.4 h', 'Sleep')])),
        W('XL', 'atlas', kicker='Atlas notes', badge='Unread · 3',
          body=[P2('Bench press record · 102 kg', True), P2('Clean triple at 102 — 2.5 kg over your old best. Keep the pause on the chest; that’s what made it.'),
                List([('Incline press: rest cut short', 'Rest · 1 d'), ('Short night · 5.4 h', 'Sleep · 2 d')])],
          footer=[B('Mark all read', 'ghost'), f'<div style="flex: 1; display: flex">{B("Open notes", full=True)}</div>']),
    ]),
    wrow('Atlas weekly review', 'atlas-weekly', [
        W('S', 'atlas', kicker='Week review', value='4', unit='/ 4', sub='49.2 t · 21–27 Sep'),
        W('M', 'atlas', icon='calendar', title='Week review · 21–27 Sep', sub='Sessions 4 / 4 · 49.2 t'),
        W('L', 'atlas', kicker='Week review · 21–27 Sep',
          body=List([('1. 4 of 4 sessions, 49.2 t lifted.', ''), ('2. New best: Bench press 102 kg × 3.', ''), ('3. Volume +8% vs the week before.', '')])),
        W('XL', 'atlas', kicker='Atlas weekly review', badge='21–27 Sep',
          body=[ColBars([12.4, 0, 11.8, 0, 13.1, 11.9, 0], (0, 2, 4, 5), 72, 'atlas', WK), Stats([('Sessions', '4 / 4'), ('Lifted', '49.2 t'), ('Records', '2')]),
                P2('1. 4 of 4 sessions, 49.2 t lifted.'), P2('2. New best: Bench press 102 kg × 3.'), P2('3. Volume +8% vs the week before.')],
          footer=B('Full review', full=True)),
    ]),
]


# ============================================================== DISCOVER (discover.tsx) — real photos where the code has them
EX = 'Romanian Deadlift'
KIT = 'equipment/m-hack-squat.jpg'


def Photo(key, w='100%', h=120):
    """discover Photo: object-fit cover, radius-lg."""
    return img(key, w, h, 12, alt='')


def Moon(s):
    """MoonGlyph (canvas): dark disc #1a2036, lit #f6f6f2→#dee0e5→#b2b5c2 — waning gibbous 88 % (29 Sep 2026)."""
    return swatch('radial-gradient(circle at 34% 46%, #f6f6f2 0, #dee0e5 30%, #b2b5c2 52%, #1a2036 53%)', s, s // 2)


def RdRow(name, v, tone):
    return row(m(name, 'width: 72px'), col(Bar(v, tone), style='flex: 1'), m(f'{round(v * 100)}%', 'width: 36px; text-align: right'), gap=10)


discover = [
    wrow('Tip of the day', 'tip-of-the-day', [
        W('S', 'neutral', kicker='Tip', body=col(P2('Tuck elbows ~45°', True), m('Bench press'), gap=2, style='margin-top: auto')),
        W('M', 'neutral', icon='book', title='Tuck elbows ~45°', sub='For today’s Bench press'),
        W('L', 'neutral', kicker='Tip for today · Bench press', body=P2('Tuck your elbows ~45° at the bottom — shoulders stay happy, the press gets stronger.', True)),
        W('XL', 'neutral', kicker='Tip of the day', badge='Bench press',
          body=[P2('Tuck your elbows ~45° at the bottom — shoulders stay happy, the press gets stronger.', True),
                row(tile('info', 'ok'), P2('Flared at 90° loads the shoulder joint; ~45° keeps the press in the chest and triceps.'), gap=12),
                List([('Grip just outside shoulders', '', 'check', 'ok'), ('Bar touches lower chest', '', 'check', 'ok'), ('Drive feet, glutes down', '', 'check', 'ok')])],
          footer=B('See full technique', 'sec', full=True)),
    ]),
    wrow('Kit spotlight', 'kit-spotlight', [
        W('S', 'neutral', kicker=GYM, title='Hack squat', sub='Never used · 3 moves', body=Photo(KIT, '100%', 50)),
        W('M', 'neutral', icon='dumbbell', title='Hack squat — never used', sub=f'At {GYM}'),
        W('L', 'neutral', kicker=f'Kit spotlight · {GYM}',
          body=row(Photo(KIT, 110, 100), col(txt('Hack squat', 't-h3'), m('Sled machine for quads with the back supported', 'white-space: normal'), sp(), B('See 3 moves'), gap=4, style='flex: 1; min-width: 0; align-self: stretch'), gap=14, align='stretch')),
        W('XL', 'neutral', kicker=f'Kit spotlight · {GYM}',
          body=[Photo(KIT, '100%', 110), txt('Hack squat', 't-h3'), List([('Hack squat', '3 × 10'), ('Reverse hack squat', '3 × 12'), ('Calf raise on hack squat', '3 × 15')])],
          footer=B('See 3 moves', full=True)),
    ]),
    wrow('On this day', 'on-this-day', [
        W('S', 'apex', kicker='1 year ago', value='+17', unit='kg', sub='Bench press 85 → 102 kg'),
        W('M', 'apex', icon='history', title='1 year ago: Bench press 85 kg', sub='Now e1RM 102 kg · +17'),
        W('L', 'apex', kicker='On this day · 2025', title='Chest 1 · 7.8 t · 58 min', bodyLast=True,
          body=Stats([('Bench press · Then', '85 kg'), ('Now', '102 kg'), ('Growth', Delta('+20%'))])),
        W('XL', 'apex', kicker='On this day',
          body=[List([('1 month ago · Chest 1', '9.1 t'), ('6 months ago · Push', '8.2 t'), ('1 year ago · Chest 1', '7.8 t')]), m('Bench press e1RM · since then'),
                Spark([85, 86, 88, 87, 90, 92, 93, 95, 97, 98, 100, 102], 64, 'apex'), Stats([('Then', '85 kg'), ('Now', row(span('102 kg'), Delta('+20%'), gap=6))])],
          footer=B('Open that session', 'sec', full=True)),
    ]),
    wrow('Lifetime lifted', 'lifetime-lifted', [
        W('S', 'accent', kicker='Lifetime', value='412', unit='t', sub='≈ 1 × Boeing 747'),
        W('M', 'accent', icon='layers', title='412 t lifted, ever', sub='≈ 1 × Boeing 747 · 186 sessions'),
        W('L', 'accent', kicker='Lifetime lifted', value='412', unit='t · 186 sessions · 171 h', bodyLast=True,
          body=[row(m('Next: Space station', 'flex: 1'), m('412 / 420 t'), gap=8), Bar(412 / 420)]),
        W('XL', 'accent', kicker='Lifetime lifted', badge='Sep 49.2 t', value='412', unit='t · 186 sessions · 171 h', bodyLast=True,
          body=[m('Tonnage by month'), ColBars([38.1, 41.6, 44.0, 39.2, 46.5, 47.8, 49.2], (6,), 44, 'accent', ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']),
                List([('Boeing 747 × 1', '400 t', 'check', 'ok')]), row(m('Next: Space station', 'flex: 1'), m('412 / 420 t'), gap=8), Bar(412 / 420)],
          footer=B('Open progress', 'sec', full=True)),
    ]),
    wrow('Night sky', 'night-sky', [
        W('S', 'sleep', title='Waning gibbous · 88%', sub='Bed in 3h 20m', body=Moon(46)),
        W('M', 'sleep', icon='moon', title='Bed 23:00 → 07:00', sub='Waning gibbous · 88%', trailing=chip('in 3h 20m')),
        W('L', 'sleep', body=row(Moon(84), col(kick('Tonight', 'sleep'), txt('Bed 23:00 → 07:00', 't-h3'), m('Waning gibbous · 88% · Bed in 3h 20m'), gap=4, style='min-width: 0'), gap=16, style='flex: 1')),
        W('XL', 'sleep', kicker='Night sky',
          body=[col(Moon(130), style='flex: 1; align-items: center; justify-content: center'),
                col(txt('Waning gibbous · 88%', 't-h3'), m('Full moon in 27 days'), gap=2, style='align-items: center')],
          footer=f'<div style="flex: 1">{Stats([("Bed", "23:00"), ("Wake", "07:00"), ("In", "3h 20m")])}</div>'),
    ]),
    wrow('Challenge to try', 'challenge-to-try', [
        W('S', 'apex', title='Try: 10 000 steps × 7', sub='7 days · fits you', body=tile('run', 'apex')),
        W('M', 'apex', icon='trophy', title='Try: 10 000 steps × 7', sub='7 days · fits you', trailing=B('Start', 'sec')),
        W('L', 'apex', kicker='Challenge to try', title='10 000 steps × 7', sub='You’re at 8 400 steps now · 7 days', footer=[B('Start'), B('Another', 'ghost')]),
        W('XL', 'apex', kicker='Challenge to try', badge='1 active',
          body=[row(Ring(0.84, 64, 'apex', RL('84', '%')), col(P2('10 000 steps × 7', True), m('You’re at 8 400 steps now'), gap=2, style='min-width: 0'), gap=14),
                P2('Hit 10 000 steps every day for a week. Walks, runs and hikes all count.')],
          footer=[f'<div style="flex: 1; display: flex">{B("Start challenge", full=True)}</div>', B('Another', 'ghost')]),
    ]),
    wrow('Rest-day idea', 'rest-day-idea', [
        W('S', 'rest', kicker='Rest day', value='20', unit='min', sub='Mobility · Quads 61%', bodyLast=True, body=Bar(0.61)),
        W('M', 'rest', icon='yoga', title='Rest day · try 20 min mobility', sub='Quads still at 61%'),
        W('L', 'rest', kicker='Rest-day idea', body=[row(chip('Mobility · 20 min'), chip('Walk · 30 min'), chip('Sauna · 25 min'), gap=6, wrap=True), m('Quads still at 61% — keep it easy, blood flow helps.', 'white-space: normal')],
          footer=B('Start mobility')),
        W('XL', 'rest', kicker='Rest-day idea', badge='Tue 29 Sep',
          body=[m('Muscle recovery · keep it easy'), RdRow('Quads', 0.61, 'danger'), RdRow('Hamstrings', 0.67, 'danger'), RdRow('Core', 0.76, 'rest'),
                List([('Mobility', '20 min', 'yoga', 'neutral'), ('Walk', '30 min', 'run', 'neutral'), ('Sauna', '25 min', 'flame', 'neutral')])],
          footer=B('Start mobility', full=True)),
    ]),
    wrow('Exercise of the day', 'exercise-of-the-day', [
        W('S', 'accent', kicker='Daily', title='Romanian deadlift', body=exercise_pic(EX, '100%', 56, 12)),
        W('M', 'accent', icon='dumbbell', title='Romanian deadlift', sub='Exercise of the day · Hamstrings', trailing=ibtn('plus', 'Add to today', 'fill', sm=True)),
        W('L', 'accent', kicker='Exercise of the day',
          body=row(exercise_pic(EX, 110, 100, 12), col(txt('Romanian deadlift', 't-h3'), m('Hamstrings · Glutes · Lower back', 'white-space: normal'), sp(), row(B('+ Today'), B('Why', 'ghost'), gap=6), gap=4, style='flex: 1; min-width: 0; align-self: stretch'), gap=14, align='stretch')),
        W('XL', 'accent', kicker='Exercise of the day', badge='29 Sep',
          body=[exercise_pic(EX, '100%', 120, 12), txt('Romanian deadlift', 't-h3'), row(chip('Hamstrings'), chip('Glutes'), chip('Lower back'), gap=6, wrap=True), P2('New for you · fits your gym')],
          footer=[f'<div style="flex: 1; display: flex">{B("+ Add to today", full=True)}</div>', B('Skip', 'ghost')]),
    ]),
]
discover = [discover[-1]] + discover[:-1]


# ============================================================== FUN & TOOLS (fun.tsx)
def WeekCard(big=False):
    """share-card WeekCard: accent tinted card, SPOTTER · WEEK n caps, three big stats."""
    st_ = lambda v, l: col(txt(v, 't-num' if big else 't-h2 num'), txt(l, 't-m c-brass'), gap=2)
    return card(txt('SPOTTER · WEEK 40', 't-l c-brass'), row(st_('4', 'sessions'), st_('49.2', 't lifted'), st_('2', 'PRs'), gap=24 if big else 14),
                tone='brass', pad=False, gap=12 if big else 8, style=f'padding: {14 if big else 10}px')


def Quote(t, big=False):
    return col(txt('“', 't-hero c-brass' if big else 't-num c-brass', 'line-height: 0.8'), txt(t, 't-h1' if big else 't-h3', 'white-space: normal'), gap=2, style='min-width: 0')


def ScoreRow(v, labels=False, small=False):
    L_ = ['Awful', 'Low', 'Okay', 'Good', 'Great']
    cells = []
    for n in range(1, 6):
        on = n == v
        t = f'{n} · {L_[n - 1]}' if (on and labels) else str(n)
        cells.append(card(txt(t, 't-s' + (' c-ok' if on else ' c-mut'), 'white-space: nowrap'), tone='ok' if on else '', pad=False,
                          style=('width: 26px; height: 26px' if small else f'flex: {2.2 if on else 1}; height: 36px') + '; align-items: center; justify-content: center; padding: 0'))
    return row(*cells, gap=4 if small else 6, style='' if small else 'width: 100%')


def UserPhoto(h, label=None):
    """Thumb: the user's own progress photo (runtime, no local file) — the kit placeholder, captioned."""
    return col(photo('100%', h, 10, 'Your photo'), m(label) if label else '', gap=4, style='flex: 1; min-width: 0')


def Race(w=326, h=80):
    """RaceChart: last week cumulative (neutral) vs this week to today (accent), same scale."""
    prev = [0, 6.2, 6.2, 12.9, 12.9, 19.8, 24.4]
    cur = [0, 7.1, 7.1, 14.3]
    hc = 8 + (h - 8) * max(cur) / max(prev)
    ch = f'<div style="position: relative; width: {w}px; height: {h}px">{spark(prev, w, h, "neutral", False)}<div style="position: absolute; left: 0; bottom: 0">{spark(cur, w * 3 / 6, hc, "brass", False)}</div></div>'
    return col(ch, row(*[m(d) for d in ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']], justify='space-between'), gap=4)


def RaceRow(label, v, frac, tone):
    return col(row(m(label, 'flex: 1'), s_(f'{v} t'), gap=8), Bar(frac, tone), gap=4)


MOTTO = 'Show up. Add a plate. Go home.'

fun = [
    wrow('Wildcard session', 'wildcard', [
        W('S', 'accent', kicker='Wildcard', title='Pull day', sub='45 min · 5 exercises', footer=B('Reroll', 'sec', 'rotate')),
        W('M', 'accent', icon='spark', title='Wildcard: Pull day', sub='45 min · fits readiness 82%', trailing=B('Start')),
        W('L', 'accent', kicker='Wildcard', badge='45 min · 5 exercises', title='Pull day', sub='Back · Biceps · Rear delts — Chest, Quads stay resting',
          footer=[B('Reroll', 'sec', 'rotate'), B('Start ›')]),
        W('XL', 'accent', kicker='Wildcard session', badge='Roll 1', title='Pull day · 45 min', sub='Why: Back, Biceps, Rear delts recovered, readiness 82%. All at Iron Temple.', sub_wrap=True, bodyLast=True,
          body=List([('Barbell row', '4 × 6–8 · 70 kg'), ('Pull-up', '4 × 8'), ('Lat pulldown', '3 × 10–12 · 60 kg'), ('Face pull', '3 × 15 · 22.5 kg'), ('Hammer curl', '3 × 12 · 16 kg')]),
          footer=[B('Reroll', 'sec', 'rotate'), f'<div style="flex: 1; display: flex">{B("Start session ›", full=True)}</div>']),
    ]),
    wrow('Milestone countdown', 'milestones', [
        W('S', 'accent', kicker='Next milestone', value='14', unit='sessions', sub='to 200 sessions', bodyLast=True, body=Bar(186 / 200)),
        W('M', 'accent', icon='target', title='14 sessions to 200', sub='186 done · about 3 Nov'),
        W('L', 'accent', kicker='Milestones', body=List([('14 sessions to 200', '186 / 200'), ('88 t to 500 t lifted', '412 t')])),
        W('XL', 'accent', kicker='Milestones', badge='2 in reach',
          body=[row(Ring(0.93, 96, 'accent', RL('186', 'of 200')), col(txt('14 sessions to 200', 't-h3'), m('At 3.5 sessions a week you hit it around Tue 3 Nov.', 'white-space: normal'), gap=4, style='min-width: 0'), gap=16),
                List([('18 days to a 30-day streak', '~17 Oct'), ('14 sessions to 200', '~3 Nov'), ('88 t to 500 t lifted', '~12 Dec')])],
          footer=B('All milestones ›')),
    ]),
    wrow('Share card', 'share-card', [
        W('S', 'accent', kicker='Week 40 · SPOTTER', value='4', unit='sessions', sub='49.2 t · 2 PRs'),
        W('M', 'accent', icon='share', title='Week 40 card is ready', sub='4 sessions · 49.2 t · 2 PRs', trailing=B('Share', 'sec', 'share')),
        W('L', 'accent', kicker='Your week card', badge='28 Sep – 4 Oct', body=WeekCard(), footer=B('Share', 'sec', 'share')),
        W('XL', 'accent', kicker='Share your week', badge='28 Sep – 4 Oct',
          body=[WeekCard(True), List([('Bench press', '102 kg × 3', 'trophy', 'accent'), ('Barbell row', '72.5 kg × 8', 'trophy', 'accent')])],
          footer=B('Share', icon='share', full=True)),
    ]),
    wrow('Event countdown', 'event-countdown', [
        W('S', 'accent', kicker='Club meet', value='23', unit='days', sub='22 Oct'),
        W('M', 'accent', icon='target', title='Club meet in 23 days', sub='Thu 22 Oct'),
        W('L', 'accent', kicker='Countdown · Thu 22 Oct', value='23', unit='days', sub='Club meet', bodyLast=True,
          body=col(Bar(0.54, 'accent', 8), row(m('2 Sep'), m('Today'), m('22 Oct'), justify='space-between'), gap=4)),
        W('XL', 'accent', kicker='Countdown · Thu 22 Oct', value='23', unit='days', title='Club meet', sub='you weigh 81.4 kg', bodyLast=True,
          body=[col(Bar(0.54, 'accent', 8), row(m('2 Sep'), m('Today'), m('22 Oct'), justify='space-between'), gap=4),
                List([(TT('Build · heavy work now', 'accent'), '2 Sep – 8 Oct'), ('Peak · openers', '9 Oct – 15 Oct'), ('Deload · rest', '16 Oct – 21 Oct')])],
          footer=B('Edit event', icon='edit')),
    ]),
    wrow('Progress photos', 'progress-photos', [
        W('S', 'neutral', kicker='Then / now', sub='89 days · −3.2 kg', body=row(UserPhoto(70), UserPhoto(70), gap=6, style='flex: 1')),
        W('M', 'neutral', icon='camera', title='Progress photos', sub='89 days · −3.2 kg · next 28 Oct', trailing=B('Photo', 'sec', 'plus')),
        W('L', 'neutral', body=row(row(UserPhoto(96, '2 Jul'), UserPhoto(96, '29 Sep'), gap=6, style='width: 46%'),
                                   col(kick('Progress', 'neutral'), txt('89 days', 't-h2'), Delta('−3.2 kg', True), m('84.6 → 81.4 kg'), sp(), B('Photo', 'sec', 'plus'), gap=4, style='flex: 1; min-width: 0; align-self: stretch'), gap=12, align='stretch')),
        W('XL', 'neutral', kicker='Progress photos',
          body=[row(UserPhoto(150, '2 Jul · 84.6 kg'), UserPhoto(150, '29 Sep · 81.4 kg'), gap=8), Stats([('Time', '89 days'), ('Weight', '−3.2 kg'), ('Sessions', '41')])],
          footer=[m('Next reminder 28 Oct', 'flex: 1'), B('New photo', icon='camera')]),
    ]),
    wrow('Personal motto', 'motto', [
        W('S', 'accent', body=Quote(MOTTO)),
        W('M', 'accent', icon='edit', title=MOTTO, sub='My motto'),
        W('L', 'accent', sub='Written 1 Sep · tap to edit', body=Quote(MOTTO)),
        W('XL', 'accent', kicker='My motto', badge='Since 1 Sep · 14 sessions',
          body=[col(Quote(MOTTO, True), style='flex: 1; justify-content: center'), kick('Earlier mottos', 'neutral'), List([('Consistency beats intensity.', '3 Jun – 31 Aug'), ('One more rep.', '2 Jan – 2 Jun')])],
          footer=B('Edit motto', icon='edit')),
    ]),
    wrow('Daily check-in', 'daily-check-in', [
        W('S', 'ok', kicker='How do you feel?', value='4', unit='/ 5 · Good', sub='Logged 08:12'),
        W('M', 'ok', icon='heart', title='4 / 5 · Good', sub='Slept well, shoulder feels fine', trailing=ScoreRow(4, small=True)),
        W('L', 'ok', kicker='Check-in · Tue 29 Sep', badge='7-day avg 3.7', body=[ScoreRow(4, True), s_('Slept well, shoulder feels fine')]),
        W('XL', 'ok', kicker='Check-in · Tue 29 Sep', badge='Logged 08:12',
          body=[ScoreRow(4, True), s_('Slept well, shoulder feels fine'), m('7-day avg 3.7'), ColBars([4, 3, 2, 4, 5, 4, 4], (6,), 60, 'ok', ['We', 'Th', 'Fr', 'Sa', 'Su', 'Mo', 'Tu']),
                m('Low day Fr: “Bad sleep, stiff back”')],
          footer=B('Edit note', icon='edit')),
    ]),
    wrow('Timer', 'timer', [
        W('S', 'accent', kicker='EMOM · running', value='0:38', sub='Round 4 of 10'),
        W('M', 'accent', icon='timer', title='EMOM · 0:38', sub='Round 4 of 10 · running', trailing=ibtn('pause', 'Pause', 'fill', sm=True)),
        W('L', 'accent', kicker='EMOM · running',
          body=row(Ring(0.37, 64, 'accent', txt('0:38', 't-b num')), col(seg(['Stopwatch', 'EMOM', 'Tabata'], 1), m('Round 4 of 10'), gap=6, style='flex: 1; min-width: 0'), gap=14),
          footer=[B('Pause', icon='pause'), B('Reset', 'sec', 'rotate')]),
        W('XL', 'accent', kicker='EMOM · running',
          body=[seg(['Stopwatch', 'EMOM', 'Tabata'], 1), col(Ring(0.37, 150, 'accent', RL('<span class="t-num">0:38</span>', 'left in minute')), style='flex: 1; align-items: center; justify-content: center'),
                col(txt('Round 4 of 10', 't-h3'), m('10 rounds · every minute on the minute · Elapsed 3:22 · total 10:00', 'white-space: normal; text-align: center'), gap=2, style='align-items: center')],
          footer=[B('Pause', icon='pause'), B('Reset', 'sec', 'rotate')]),
    ]),
    wrow('Sync status', 'sync-status', [
        W('S', 'illness', kicker='Offline', title='Last sync 09:40', sub='Saved on this phone · uploads when back online', sub_wrap=True, footer=B('Retry', 'sec', 'rotate')),
        W('M', 'ok', icon='rotate', title='All changes saved', sub='Last sync 10:02'),
        W('L', 'ok', kicker='All changes saved', badge='Last sync 10:02',
          body=[List([('Pull day', '09:58'), ('Weigh-in · 81.4 kg', '07:15')]), m('Your data is backed up to your account')]),
        W('XL', 'illness', kicker='Offline', title='Offline', sub='Last sync 09:40', bodyLast=True,
          body=[row(tile('cloudoff', 'illness', lg=True), m('Saved on this phone · uploads when back online', 'white-space: normal'), gap=12),
                kick('Latest on this phone', 'neutral'), List([('Pull day', '09:58'), ('Walk', '08:30'), ('Weigh-in · 81.4 kg', '07:15')])],
          footer=[B('Retry now', icon='rotate'), B('Backup settings', 'sec', 'gear')]),
    ]),
    wrow('Notifications', 'notifications', [
        W('S', 'accent', kicker='Inbox', value='3', unit='unread', sub='New PR · Bench press'),
        W('M', 'accent', icon='bell', title='3 unread', sub='New PR · Bench press · 12-day streak · Atlas note'),
        W('L', 'accent', kicker='Notifications', badge='3 unread', body=List([('New PR · Bench press', 'Gym'), ('12-day streak', 'Apex'), ('Atlas left you a note', 'Atlas')])),
        W('XL', 'accent', kicker='Notifications', badge='3 unread',
          body=List([('New PR · Bench press', 'Gym · 3 d', 'trophy', 'accent'), ('12-day streak', 'Apex · 2 h', 'flame', 'apex'), ('Atlas left you a note', 'Atlas · 2 h', 'bell', 'atlas'),
                     ('Challenge · 5 days left', 'Apex · 1 d', 'bell', 'apex'), ('Recap for week 39 is ready', 'Gym · 2 d', 'bell', 'accent')]),
          footer=[B('Open inbox ›'), B('Mark all read', 'ghost', 'check')]),
    ]),
    wrow('Beat last week', 'beat-last-week', [
        W('S', 'accent', kicker='Ahead of last week', value=span('+1.5', 'c-ok'), unit='t', sub='14.3 t so far · last week 12.8 t by Thu'),
        W('M', 'accent', icon='progress', title='1.5 t ahead of last week', sub='14.3 t vs 12.8 t by Thu'),
        W('L', 'accent', kicker='Beat last week', badge=Delta('1.5 t ahead'),
          body=[RaceRow('This week', '14.3', 1, 'accent'), RaceRow('Last week · by Thu', '12.8', 12.8 / 14.3, 'neutral'), m('10.1 t to pass last week’s 24.4 t')]),
        W('XL', 'accent', kicker='Beat last week', badge='Week 40 vs 39', value=span('+1.5 t', 'c-ok'), sub='14.3 t vs 12.8 t by Thu', bodyLast=True,
          body=[Race(), List([('Legs · Thu', '7.2 t'), ('Pull day · Tue', '7.1 t')]), m('10.1 t to pass last week’s 24.4 t')],
          footer=B('Weekly volume', 'sec')),
    ]),
]


# ============================================================== CALENDAR (calendar.tsx) — real month grid + year pixels
import datetime as _dt
TODAY = _dt.date(2026, 9, 29)
SEP_W = {1, 3, 5, 8, 10, 12, 15, 17, 19, 22, 24, 26, 28}
SEP_ACT = {6, 13, 20, 27}
SEP_HEALTH = {11: 'rest', 16: 'illness', 23: 'rest'}
SEP_PR = {10, 24}
PLANNED_WD = {2, 4}  # Wed, Fri (0 = Mon)


def Mark(tone, dash=False):
    return Rect(ACCENT[tone], 9 if dash else 5, 3 if dash else 5, 3)


def DayCell(d, month=9, h=30, compact=False):
    """calendar DayCell: 11.5 px number (+ brass ★ on PR days), marks (brass dash workout · sport dot · sleep dot),
    health tint, today = accent ring, planned future = dashed."""
    date = _dt.date(2026, month, d)
    future = date > TODAY
    sep = month == 9
    marks = []
    if sep and d in SEP_W and not future:
        marks.append(Mark('brass', True))
    if sep and d in SEP_ACT and not future:
        marks.append(Mark('sport'))
    if not future and not compact and d % 3 != 0:
        marks.append(Mark('sleep'))
    num = f'{d}' + ('<span class="c-brass" style="vertical-align: top; margin-left: 1px">★</span>' if sep and d in SEP_PR else '')
    body = col(txt(num, 't-s num' + (' c-dim' if future else '')), row(*marks, gap=2, style='height: 5px'), gap=2, style='align-items: center')
    health = SEP_HEALTH.get(d) if sep else None
    planned = future and date.weekday() in PLANNED_WD
    tone = 'glass' if date == TODAY else (health or ('dash' if planned else 'quiet'))
    return card(body, tone=tone, pad=False, style=f'height: {h}px; padding: 0; align-items: center; justify-content: center; min-width: 0')


def HeadRow():
    return grid(*[txt(x, 't-m', 'text-align: center') for x in 'MTWTFSS'], cols=7, gap=3)


def Legend_():
    it = [('brass', 'Workout', True), ('sport', 'Activity', False), ('sleep', 'Sleep', False), ('rest', 'Rest', False), ('illness', 'Sick', False), ('injury', 'Injury', False)]
    return row(*[row(Mark(t, dsh), m(l), gap=4) for t, l, dsh in it], gap=10, wrap=True)


def MonthGrid():
    cells = [''] + [DayCell(d, 9, 34) for d in range(1, 31)]
    cells += [''] * ((7 - len(cells) % 7) % 7)
    return grid(*cells, cols=7, gap=3)


# ---- year in pixels
PIX = {'trained': '#d9a24f', 'activity': '#a8dc7c', 'rest': '#93d4f2', 'sick': '#f0a35e', 'off': '#71767b', 'injury': '#e2786a', 'none': '#3b3f43', 'future': '#262a2d'}


def pix_kind(date):
    if date > TODAY:
        return 'future'
    if date.month == 9:
        d = date.day
        if d in SEP_HEALTH:
            return {'rest': 'rest', 'illness': 'sick'}[SEP_HEALTH[d]]
        return 'trained' if d in SEP_W else 'activity' if d in SEP_ACT else 'none'
    n = date.toordinal()
    if _dt.date(2026, 2, 9) <= date <= _dt.date(2026, 2, 12):
        return 'sick'
    if _dt.date(2026, 5, 18) <= date <= _dt.date(2026, 5, 24):
        return 'injury'
    wd = date.weekday()
    h = (n * 37 + 11) % 17
    if wd in (0, 2, 4) and h > 2 or wd == 5 and h > 9:
        return 'trained'
    if wd == 6 and h > 6:
        return 'activity'
    if h == 4:
        return 'rest'
    if h == 7 and wd == 3:
        return 'off'
    return 'none'


def PixelGrid(start, end, width, labels=False):
    lead = start.weekday()
    days = [None] * lead + [start + _dt.timedelta(i) for i in range((end - start).days + 1)]
    days += [None] * ((7 - len(days) % 7) % 7)
    cols_n = len(days) // 7
    gap = 1.5
    cs_ = (width - gap * (cols_n - 1)) / cols_n
    cols_ = []
    for c in range(cols_n):
        cells = []
        for r_ in range(7):
            dd = days[c * 7 + r_]
            cells.append(f'<span style="display: block; width: {cs_:.2f}px; height: {cs_:.2f}px"></span>' if dd is None else
                         Rect(PIX[pix_kind(dd)], cs_, cs_, 0.5 if cs_ < 6 else 1).replace('inline-block', 'block'))
        cols_.append(col(*cells, gap=gap))
    out = row(*cols_, gap=gap, align='flex-start', style=f'width: {width}px')
    if labels:
        lab = []
        for mo in range(1, 13, 2):
            d0 = _dt.date(2026, mo, 1)
            ci = ((d0 - start).days + lead) // 7
            lab.append(f'<span class="t-m" style="position: absolute; left: {ci * (cs_ + gap):.0f}px">{d0.strftime("%b")}</span>')
        out = col(out, f'<div style="position: relative; height: 14px; width: {width}px">{"".join(lab)}</div>', gap=3)
    return out


def year_counts():
    cnt = {}
    d = _dt.date(2026, 1, 1)
    while d <= TODAY:
        k = pix_kind(d)
        cnt[k] = cnt.get(k, 0) + 1
        d += _dt.timedelta(1)
    return cnt


YC = year_counts()
Y_LOGGED = sum(v for k, v in YC.items() if k != 'none')
Y_ELAPSED = (TODAY - _dt.date(2026, 1, 1)).days + 1
BREAK = [('trained', 'Trained'), ('activity', 'Activity only'), ('rest', 'Rest'), ('sick', 'Sick'), ('off', 'Day off'), ('injury', 'Injury')]

calendar = [
    wrow('Calendar', 'calendar', [
        W('S', 'accent', kicker='Last 30 days', value='14', unit='days trained', sub='2 rest · 1 sick · 2 PRs'),
        W('M', 'accent', icon='calendar', title=grid(*[DayCell(d, 9 if d <= 30 else 10, 26, True) if d <= 30 else DayCell(d - 30, 10, 26, True) for d in range(28, 35)], cols=7, gap=2, style='width: 240px'),
          sub='1 trained this week'),
        W('L', 'accent', kicker='Sep 21 – Oct 4', badge='10 logged · 1 PR',
          body=[HeadRow(), grid(*[DayCell(d, 9, 30) if d <= 30 else DayCell(d - 30, 10, 30) for d in range(21, 35)], cols=7, gap=3)]),
        W('XL', 'accent', kicker='Calendar',
          body=[row(txt('September 2026', 't-h3', 'flex: 1'), ibtn("back", "Previous month", sm=True), ibtn("chev", "Next month", sm=True), gap=4), HeadRow(), MonthGrid(), Legend_()],
          footer=[m('Sep: 14 trained · 51.3 t', 'flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis'), B('Open calendar')]),
    ]),
    wrow('Year in pixels', 'year-pixels', [
        W('S', 'accent', kicker='2026 in pixels', value=str(Y_LOGGED), unit='days', sub=f'logged · {YC["trained"]} trained', bodyLast=True,
          body=PixelGrid(TODAY - _dt.timedelta(84), TODAY, 143)),
        W('M', 'accent', icon='grid', title=f'{Y_LOGGED} days logged · 2026', sub=f'{YC["trained"]} trained · {YC["rest"]} rest · {YC["sick"]} sick'),
        W('L', 'accent', kicker='2026 · every day', badge=f'{Y_LOGGED} logged of {Y_ELAPSED}',
          body=[PixelGrid(_dt.date(2026, 1, 1), _dt.date(2026, 12, 31), 330, True),
                row(*[row(Rect(PIX[k], 8, 8, 2), m(l, 'white-space: nowrap'), gap=4) for k, l in BREAK if k != 'off'], gap=10)]),
        W('XL', 'accent', kicker='Year in pixels · 2026', badge='longest streak 9', value=str(Y_LOGGED), unit='days', sub=f'logged · {round(Y_LOGGED * 100 / Y_ELAPSED)}%', bodyLast=True,
          body=[PixelGrid(_dt.date(2026, 1, 1), _dt.date(2026, 12, 31), 330, True),
                grid(*[row(Rect(PIX[k], 8, 8, 2), m(l, 'flex: 1'), txt(str(YC.get(k, 0)), 't-s num'), gap=8) for k, l in BREAK], cols=2, gap=6, style='column-gap: 16px')],
          footer=B('Open calendar', full=True)),
    ]),
]


# ============================================================== SHORTCUTS · XS (shortcuts.tsx + ShortcutTile.css)
def XS(label, icon, tone='neutral', state='default', primary=False, meta=None):
    """ShortcutTile: 86 px tile, 36 px tone IconTile (primary = solid brass), 11.5 px label; live = tone tint + tone border +
    pulsing tone dot + meta; done = ok check badge; selected = accent border + accent pick badge."""
    t = T_(tone)
    if primary:
        ic = f'<span style="position: relative; width: 36px; height: 36px; flex: none">{swatch("#d9a24f", 36, 11)}<span style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center">{ico(icon, 18, "#121316", 2.2)}</span></span>'
    else:
        ic = tile(icon, t)
    parts = [ic, txt(label, 't-s', 'text-align: center; max-width: 100%')]
    if meta:
        parts.append(txt(meta, f't-m c-{t}' if t != 'neutral' else 't-m'))
    badge = ''
    if state == 'live':
        badge = f'<span style="position: absolute; top: 7px; right: 7px">{dot(t)}</span>'
    elif state == 'done':
        badge = f'<span class="c-ok" style="position: absolute; top: 6px; right: 6px">{ico("check", 14, "#4cbe8c", 2.4)}</span>'
    elif state == 'selected':
        badge = f'<span style="position: absolute; top: 6px; right: 6px">{tile("check", "brass", s=10)}</span>'
    tn = t if state == 'live' else ('glass' if state == 'selected' else '')
    return card(*parts, badge, tone=tn, pad=False, gap=7, style='position: relative; width: 84px; min-height: 86px; padding: 10px 4px 9px; align-items: center; justify-content: center')


ACT_ICON = {'run': 'run', 'cycle': 'bike', 'swim': 'wave', 'row': 'wave', 'walk': 'run', 'hiit': 'bolt', 'dance': 'music', 'cardio': 'pulse', 'hike': 'map',
            'elliptical': 'rotate', 'stairs': 'up', 'jumprope': 'rotate', 'pilates': 'body', 'football': 'target', 'basketball': 'target', 'volleyball': 'target',
            'tennis': 'target', 'padel': 'target', 'badminton': 'target', 'tabletennis': 'target', 'boxing': 'bolt', 'martial': 'bolt', 'climbing': 'up',
            'climbgym': 'up', 'hockey': 'target', 'ski': 'map', 'snowboard': 'map', 'golf': 'target', 'sport': 'trophy', 'yoga': 'yoga', 'mobility': 'yoga',
            'massage': 'heart', 'sauna': 'flame', 'cold': 'wave'}
ACT_LABEL = {'run': 'Run', 'cycle': 'Cycling', 'swim': 'Swim', 'row': 'Rowing', 'walk': 'Walk', 'hiit': 'HIIT', 'dance': 'Dance', 'cardio': 'Cardio', 'hike': 'Hiking',
             'elliptical': 'Elliptical', 'stairs': 'Stair climber', 'jumprope': 'Jump rope', 'pilates': 'Pilates', 'football': 'Football', 'basketball': 'Basketball',
             'volleyball': 'Volleyball', 'tennis': 'Tennis', 'padel': 'Padel', 'badminton': 'Badminton', 'tabletennis': 'Table tennis', 'boxing': 'Boxing',
             'martial': 'Martial arts', 'climbing': 'Rock climbing', 'climbgym': 'Climbing gym', 'hockey': 'Hockey', 'ski': 'Skiing', 'snowboard': 'Snowboard',
             'golf': 'Golf', 'sport': 'Other sport', 'yoga': 'Yoga', 'mobility': 'Mobility', 'massage': 'Massage', 'sauna': 'Sauna', 'cold': 'Cold plunge'}
SPORT = {'football', 'basketball', 'volleyball', 'tennis', 'padel', 'badminton', 'tabletennis', 'boxing', 'martial', 'climbing', 'climbgym', 'hockey', 'ski', 'snowboard', 'golf', 'sport'}
RECOV = {'yoga', 'mobility', 'massage', 'sauna', 'cold'}


def act_tone(k):
    return 'sport' if k in SPORT else 'rest' if k in RECOV else 'active'


TRAIN_SC = [XS('Today’s day', 'play', 'accent', primary=True), XS('Auto session', 'bolt', 'accent'), XS('Home set', 'home', 'accent'), XS('Log past', 'history')]
HEALTH_SC = [XS('Sleep', 'moon', 'sleep'), XS('Active rest', 'run', 'rest'), XS('Day off', 'send', 'rest'), XS('Unwell', 'warn', 'illness'), XS('Injury', 'bandage', 'injury'),
             XS('Next lesson', 'book', 'learn'), XS('Ask Atlas', 'spark', 'atlas'), XS('Weigh-in', 'scale')]
ACT_STATE = {'run': ('live', '24 min'), 'dance': ('done', None), 'sauna': ('done', None)}
ACT_SC = [XS(ACT_LABEL[k], ACT_ICON[k], act_tone(k), *ACT_STATE.get(k, ('default', None))[:1], meta=ACT_STATE.get(k, (None, None))[1]) for k in ACT_LABEL]


def sc_group(name, items):
    return col(txt(name, 't-h3'), row(*items, gap=10, wrap=True), gap=10)


def states_row():
    ex = [(XS('Run', 'run', 'active'), 'default'), (XS('Run', 'run', 'active', 'live', meta='24 min'), 'live · resume'),
          (XS('Run', 'run', 'active', 'done'), 'done today'), (XS('Run', 'run', 'active', 'selected'), 'selected · customise'),
          (XS('Today’s day', 'play', 'accent', primary=True), 'primary')]
    return row(*[col(x, m(c, 'text-align: center'), gap=6, style='align-items: center; width: 96px') for x, c in ex], gap=12, align='flex-start')


def shortcuts_board():
    f = 'P02-13-Shortcuts.dc.html'
    h = fit(f, 1200)
    head = row(col(lbl('Widget library', 'brass'), txt('Shortcuts · XS', 't-d1'), s_('46 shortcuts · one-tap actions, one size, 4 per row on phones (8 on desktop).'), gap=6, style='flex: 1'),
               states_row(), gap=40, align='flex-start', style='width: 100%')
    body_ = col(sc_group('Train', TRAIN_SC), sc_group('Health & body', HEALTH_SC), sc_group('Activities · 34', ACT_SC), gap=28)
    board(f, 'Shortcuts · XS', BW, h, spec('', head, body_, w=BW, h=h), row_=1)


# ============================================================== SIZE SCALE (WidgetGrid.css: 4 columns · XS 1 · S 2 · M/L/XL 4)
def cols_ind(n, of=4, rows_=1):
    return col(*[row(*[Rect('#d9a24f' if i < n else '#3b3f43', 16, 10, 2) for i in range(of)], gap=3) for _ in range(rows_)], gap=3)


def sizes_board():
    f = 'P02-00-Sizes.dc.html'
    h = fit(f, 900)
    cells = [
        ('XS', 'Shortcut', XS('Dance', 'music', 'active', 'live', meta='24 min'), cols_ind(1), 'Span 1 of 4. Action only, no data.', 96),
        ('S', 'Square', W('S', 'ok', kicker='Readiness', value='82', unit='%', sub='3 recovering', bodyLast=True, body=Bar(0.82, 'ok')), cols_ind(2), 'Span 2. One number + minimum context.', 171),
        ('M', 'Row', W('M', 'apex', icon='flame', title='12-day streak', sub='Train or rest today to keep it'), cols_ind(4), 'Span 4, 64 px. Icon tile, title, one line.', 358),
        ('L', 'Wide', W('L', 'accent', kicker='Bench press e1RM', badge=Delta('+2.5 · 4 wks'), value='102', unit='kg', bodyLast=True, body=Spark(E1, 56, 'ok', True)), cols_ind(4), 'Span 4, height of S. Number + chart or list.', 358),
        ('XL', 'Big square', W('XL', 'active', kicker='Active minutes · 28 Sep – 4 Oct', badge='WHO 150',
                               body=[row(Ring(0.75, 96, 'active', RL('112', '112 / 150')), col(txt('38 min to go', 't-h3'), m('3 days left · ~13 min/day'), gap=4), gap=16),
                                     ColBars([40, 36, 13, 23, 0, 0, 0], (3,), 52, 'active', WK), Stats([('Run', '53 min'), ('Cycling', '36 min'), ('Walk', '23 min')])],
                               footer=B('Log activity', icon='plus')), cols_ind(4, rows_=2), 'Span 4, square (grows with content). Desktop: span 8, min-height 312.', 358),
    ]
    blocks = row(*[col(txt(sz, 't-h1 c-brass'), txt(nm, 't-h3'), w_, ci, m(d, f'width: {wd}px; white-space: normal'), gap=10) for sz, nm, w_, ci, d, wd in cells], gap=28, align='flex-start')
    foot = row(*[tag(x, 'neutral') for x in ['Shortcuts → XS × 4–8', 'Pair → S + S', 'Quad → 4 × S', 'Rows → M × 1–5', 'Wide → L', 'Wide + pair → L · S S', 'Big → XL']], gap=8, wrap=True)
    head = col(lbl('Size scale', 'brass'), txt('XS · S · M · L · XL', 't-d1'), s_('One grid of 4 columns (desktop 8, every span doubled). 111 widgets × 4 sizes (S · M · L · XL) · 46 shortcuts (XS).'), gap=6, style='width: 100%')
    board(f, 'Sizes · XS S M L XL', BW, h, spec('', head, blocks, foot, w=BW, h=h), row_=1)


# ============================================================== MUSIC (music-canvas V2-Widgets — not in the app code yet)
def mcap(t):
    return lbl(t)


def music_board():
    f = 'P02-14-Music.dc.html'
    h = fit(f, 1400)
    xs = card(art(36, 0, 18), txt('Workout mix', 't-l c-brass'), tone='glass', pad=False, gap=7, style='width: 84px; height: 86px; align-items: center; justify-content: center; padding: 0 4px')
    s_w = card(f'<div style="position: absolute; inset: 0; display: flex">{art(171, 0, 18)}</div>',
               f'<div style="position: absolute; left: 8px; right: 8px; bottom: 8px">{card(row(col(txt("Houdini", "t-h3"), m("Dua Lipa"), gap=0, style="flex: 1; min-width: 0"), ibtn("pause", "Pause", sm=True), gap=4), tone="glass", style="padding: 6px 6px 6px 12px")}</div>',
               tone='glass', pad=False, style='position: relative; width: 171px; height: 150px; overflow: hidden')
    m_w = widget('M', '', art(44, 0, 22) + col(txt('Houdini', 't-h3'), m('Dua Lipa'), gap=0, style='flex: 1') + ibtn('prev', 'Previous', sm=True) + ibtn('pause', 'Pause', sm=True) + ibtn('next', 'Next track', sm=True), 'glass')
    l_w = frame('L', row(art(120, 0, 12), col(kick('Chest · Heavy', 'accent'), row(txt('Houdini', 't-h3'), m('· Dua Lipa'), gap=4, align='baseline'), m('Next: Just Pretend'), m('Then: The Summoning'),
                                               row(ibtn('pause', 'Pause', sm=True), ibtn('next', 'Next track', sm=True), gap=4, style='margin-top: auto'), gap=3, style='flex: 1; align-self: stretch; min-width: 0'), gap=14), 'glass')
    xl_w = frame('XL', col(row(art(72, 0, 12), col(txt('Houdini', 't-h2'), m('Dua Lipa · 1:42 / 3:05'), gap=2, style='flex: 1'), ibtn('pause', 'Pause', 'pri'), gap=12),
                           bar(55, 'brass', 4),
                           grid(card(kick('Next workout', 'accent'), b('Legs 1 · Thu'), m('Leg Day · Heavy'), style='padding: 10px 12px', gap=2),
                                card(kick('PR song', 'ok'), b('Training Season'), m('Bench 100 × 5'), style='padding: 10px 12px', gap=2), cols=2, gap=8),
                           m('Up next · Just Pretend · The Summoning · Swim', 'white-space: normal'), gap=12), 'glass')
    mus_in = col(lbl('In app · Today', 'brass'),
                 row(col(xs, mcap('XS'), gap=8, style='align-items: center'), col(s_w, mcap('S · Compact'), gap=8), gap=12, align='flex-start'),
                 col(m_w, mcap('M · Horizontal'), gap=8), col(l_w, mcap('L · Medium'), gap=8), col(xl_w, mcap('XL · Large'), gap=8), gap=18)
    iph = phone(
        row(card(sp(), card(txt('Chest · Heavy', 't-h3'), m('Play for Chest 2'), tone='glass', style='padding: 8px 12px', gap=0), tone='glass', style='width: 158px; height: 158px; padding: 10px'),
            col(col(ibtn('play', 'Play', 'pri', style='width: 76px; height: 76px'), mcap('Lock · circular'), gap=6, style='align-items: center'),
                col(card(span(ico('music', 20), 'c-brass'), txt('Mix', 't-l c-brass'), style='width: 76px; height: 76px; align-items: center; justify-content: center', gap=4), mcap('Control Center'), gap=6, style='align-items: center'), gap=10),
            gap=16, align='flex-start'),
        card(row(art(76, 0, 38), col(txt('Houdini', 't-h3'), m('Dua Lipa · Chest · Heavy'), gap=2, style='flex: 1; align-self: flex-start'), gap=14),
             row(ibtn('prev', 'Previous', sm=True), ibtn('pause', 'Pause', 'pri', sm=True), ibtn('next', 'Next track', sm=True), gap=10, justify='center'), tone='glass', gap=6),
        card(row(ring(40, 44, 'brass', 4, txt('1:12', 't-m num')), col(b('Bench 100 × 5'), m('Houdini · Dua Lipa'), gap=0), gap=12), style='padding: 10px 14px'),
        mcap('Lock · rectangular'),
        tabs=None, h=560, mood='night')
    di = col(lbl('Dynamic Island', 'brass'),
             card(row(art(24, 0, 12), sp(), txt('1:12', 't-h3 num c-brass'), gap=10), style='padding: 6px 14px; width: 250px'),
             card(row(ring(70, 76, 'brass', 5, txt('1:12', 't-h3 num')), col(txt('Bench 100 × 5', 't-h3'), m('Houdini · Dua Lipa'), btn('Set done', 'pri', sm=True, full=True), gap=4, style='flex: 1'), gap=14), style='padding: 16px 18px; width: 360px'),
             gap=12)
    mus = row(mus_in, col(lbl('iPhone · outside the app', 'brass'), f'<div style="width: 390px; overflow: hidden">{iph}</div>', di, gap=18), gap=60, align='flex-start')
    board(f, 'Music widgets · in app + iPhone', 1000, h, spec('', col(lbl('Music · V2', 'brass'), txt('Music widgets', 't-d1'), s_('From music-canvas V2-Widgets — not part of the Today widget code yet.'), gap=6, style='width: 100%'), mus, w=1000, h=h), row_=1)


# ============================================================== emit (code order: WIDGET_GROUPS)
GROUPS = [('01', 'Training', training), ('02', 'Plan & sessions', plan), ('03', 'Strength', strength), ('04', 'Muscles & consistency', muscles),
          ('05', 'Body & recovery', body), ('06', 'Cardio & gyms', cardio), ('07', 'Apex', apex), ('08', 'Learn', learn), ('09', 'Atlas', atlas),
          ('10', 'Discover', discover), ('11', 'Fun & tools', fun), ('12', 'Calendar', calendar)]
N_W = sum(len(g) for _, _, g in GROUPS)
if __name__ == '__main__' or True:
    sizes_board()
    for n, t, g in GROUPS:
        slug = t.replace(' & ', '-').replace(' ', '-')
        group_board(f'P02-{n}-{slug}.dc.html', t, g, f'{len(g)} widgets × S · M · L · XL')
    shortcuts_board()
    music_board()
    print('widgets', N_W)
