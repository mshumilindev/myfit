"""P07 · Progress — 1:1 translation of views/OverviewView.tsx (Overview hub tab), views/ProgressView.tsx
(Progress · Trends drill-ins, RangeSheet, Volume view sheet, VolumePanel, DeloadCard, WeakPointsCard, FixSheet,
ReadinessLens, AtlasNotesPanel, TrendsView), components/StandardsView + FeatsView (Apex Ranks / Awards) + StatShareSheet,
components/BodyMetrics (BodyMetricsSection, WeightSheet, ProfileCompletionGate), components/PhotoSlider,
views/GoalsView (+ FocusEditor, PhysiquePicker), views/MasteryView (detail, shortfalls, ladder, calibration,
practice sheet, MasteryRankUp). Copy = en.ts; see fidelity/P07.md for the board -> source map."""
from kit import *

import glob as _glob, os as _os
for _f in _glob.glob(_os.path.join(OUT, 'P07-*.dc.html')):
    _os.remove(_f)

GYM = 'Iron Temple'
APEX_TABS = [('home', 'Home', 'home'), ('challenges', 'Challenges', 'target'), ('ranks', 'Ranks', 'trophy'), ('awards', 'Awards', 'star'), ('apps', 'Apps', 'grid')]


# ============================================================== shell helpers
def tab(*content, h=844, overlay='', night=False, mood='art'):
    """A tab screen (Overview / Progress / Programs peers): app header · (SleepHero at night) · tab bar, Overview lit."""
    top = [brandbar()] + ([sleephero()] if night else [])
    return phone(*top, *content, tabs='overview', h=h, overlay=overlay, mood='sky' if night else mood)


def ovl(*content, h=844, overlay='', night=False, mood='art'):
    """An overlay screen: app header, no tab bar."""
    top = [brandbar()] + ([sleephero()] if night else [])
    return phone(*top, *content, tabs=None, h=h, overlay=overlay, mood='sky' if night else mood)


def apex(active, *content, h=844, overlay=''):
    """ApexApp: header spotter · Apex · bell · language; nav Home · Challenges · Ranks · Awards · Apps."""
    hdr = brandbar(row(ibtn('bell', 'Milestones', 'fill', sm=True), ibtn('globe', 'Language', 'fill', sm=True), gap=6), app='Apex')
    return phone(hdr, *content, tabs=(active, APEX_TABS), h=h, overlay=overlay, mood='art')


def ov_back():
    """OverviewBack: ‹ Overview"""
    return btn('Overview', 'txt', 'back', style='height: 32px; padding: 0 4px 0 0; align-self: flex-start')


def abs_(inner, css):
    return f'<div style="position: absolute; {css}">{inner}</div>'


def popup(*inner, top=150):
    return f'<div class="scrim"></div><div class="dialog" style="top: {top}px">{"".join(inner)}</div>'


import kit as _k
GK = {'Chest': 'chest', 'Back': 'back', 'Quads': 'quads', 'Shoulders': 'shoulders', 'Triceps': 'triceps', 'Hamstrings': 'hamstrings', 'Biceps': 'biceps',
      'Calves': 'calves', 'Forearms': 'forearms', 'Lats': 'lats', 'Traps': 'traps', 'Glutes': 'glutes', 'Lower back': 'lower_back', 'Core': 'core'}


def micon(name, h=28, tone='brass'):
    """MuscleIcon variant=row: the app's body figure cropped to the group's region with that group lit (muted = grey)."""
    g = GK.get(name, name)
    v = _k._MM['GROUP_VIEW'][g]; rg = _k._MM['GROUP_REGION'][g]
    return bodymap(v, primary=(g,) if tone == 'brass' else (), secondary=(g,) if tone != 'brass' else (), region=rg, h=h)


def heatmap(paint, h=210, labels=False):
    """MuscleHeatmap: front + back body-muscles figures painted per group."""
    return bodypair(paint={GK.get(k, k): v for k, v in paint.items()}, h=h, labels=labels)


def legend(items):
    return row(*[row(dot(t_), txt(n, 't-m'), gap=5) for n, t_ in items], gap=12, wrap=True, justify='center')


def vbars(vals, tones, h=120, gap=6):
    """.bars / .ov-bars: flex columns, each its own colour (graphite older weeks → accent this week)."""
    mx = max(vals) or 1
    out = []
    for v, t_ in zip(vals, tones):
        bh = max(4, round(v / mx * h))
        inner = bar(0, 'brass', bh) if t_ == 'track' else bar(100, t_, bh)
        out.append(f'<div style="flex: 1; height: {h}px; display: flex; flex-direction: column; justify-content: flex-end">{inner}</div>')
    return f'<div style="display: flex; gap: {gap}px; align-items: flex-end">{"".join(out)}</div>'


# zone / fatigue / readiness palettes exactly as the app (volume.ts ZONE_COLOR, fatigue.ts FATIGUE_COLOR, recovery.ts READINESS_COLOR)
ZONE_PAINT = {'none': '#3b3f43', 'under': 'under', 'productive': 'productive', 'high': 'high', 'over': 'over'}
FAT_PAINT = {'fresh': 'ok', 'moderate': '#b3833d', 'high': 'high', 'fried': 'danger'}
RD_PAINT = {'recovering': 'danger', 'nearly': 'high', 'ready': 'ok', 'stale': 'kcal'}


# ============================================================== OVERVIEW (hub tab)
def ov_hd(k, icon):
    return row(lbl(k), sp(), span(ico(icon, 18), 'c-brass'), gap=6)


def ov_tile(k, icon, *body, tone='', style=''):
    return card(ov_hd(k, icon), *body, tone=tone, gap=8, style=f'padding: 14px; {style}')


def tt(t, sub):
    return col(txt(t, 't-h3'), txt(sub, 't-m'), gap=2)


def program_tile(names=('Upper 1', 'Lower 1', 'Rest', 'Upper 2', 'Lower 2', 'Rest', 'Rest'), today=0, foot='Today: Upper 1'):
    days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    cells = []
    for i, (d, n) in enumerate(zip(days, names)):
        rest = n == 'Rest'
        cells.append(card(txt(d.upper(), 't-l c-brass' if i == today else 't-l c-dim'), txt(n, 't-m c-brass' if i == today else ('t-m c-dim' if rest else 't-m c-mut'), 'white-space: nowrap; overflow: hidden; max-width: 100%'), pad=False,
                          tone='glass' if i == today else '', gap=3, style='height: 48px; padding: 0 2px; align-items: center; justify-content: center; text-align: center; min-width: 0; overflow: hidden'))
    return ov_tile('Program · Upper/Lower 4×', 'list', grid(*cells, cols=7, gap=4), txt(foot, 't-s'))


def overview(state='full', trends_state='risk', foot='Today: Upper 1'):
    if state == 'full':
        prog = ov_tile('Progress', 'progress', col(txt('6.2<span class="t-m"> t</span>', 't-hero num'), txt('Volume this week', 't-m'), gap=4),
                       vbars([3.1, 3.8, 2.9, 4.2, 4.6, 5.1, 5.7, 6.2], ['track'] * 4 + ['brass'] * 4, 70, 4), tone='hero', style='height: 100%')
        trends = (ov_tile('Atlas', 'progress', tt('3 risks', 'Pull volume is low'), tone='bad') if trends_state == 'risk' else
                  ov_tile('Atlas', 'progress', tt('All clear', 'Bench press climbing')))
        recs = ov_tile('Records', 'trophy', tt('Est. 1RM', 'Deadlift 205 kg'))
        program = program_tile(foot=foot, today=0 if foot.startswith('Today') else 2)
        goals = ov_tile('Goals', 'target', tt('V-Taper', '3 muscles in focus'))
        play = ov_tile('Playbook', 'book', tt('4 plays', 'From your sessions'))
        ex_sub = '412 in the library · 3 yours'
    else:
        prog = ov_tile('Progress', 'progress', col(txt('0.0<span class="t-m"> t</span>', 't-d1 num'), txt('Volume this week', 't-m'), gap=2),
                       vbars([0] * 8, ['track'] * 8, 70, 4), style='height: 100%')
        trends = ov_tile('Trends', 'progress', tt('Trends', 'Unlocks after a few sessions'))
        recs = ov_tile('Records', 'trophy', tt('Est. 1RM', 'No lifts yet'))
        program = ov_tile('Programs', 'list', tt('No program yet', 'Build your own or get one from a coach'), tone='dash')
        goals = ov_tile('Goals', 'target', tt('Goals', 'Set your focus'))
        play = ov_tile('Playbook', 'book', tt('Playbook', 'Learns from your sessions'))
        ex_sub = '412 in the library · 0 yours'
    top = grid(prog, col(trends, recs, gap=10), cols=2, gap=10, style='align-items: stretch')
    exrow = lst(li(span('Exercises', 't-h3'), ex_sub, tile('dumbbell', 'brass'), chev=True))
    return [top, program, grid(goals, play, cols=2, gap=10), exrow]


P('P07-Overview.dc.html', 'Overview · hub tab', tab(*overview(), h=844))


# ============================================================== PROGRESS (drill-in)
def topbar(rng='This week'):
    return row(ov_back(), sp(), btn(rng, 'sec', 'calendar', sm=True) if rng else '', gap=8)


def kpi(v='6.2', label='Volume this week', delta='+8%'):
    return row(col(txt(f'{v}<span class="t-m"> t</span>', 't-hero num'), txt(label, 't-l c-dim'), gap=8),
               tag(delta, 'brass' if delta.startswith('+') else 'neutral') if delta else '', gap=14, align='flex-end')


def pseg(i):
    """.pv-chips: separate pill chips, the active one accent."""
    return chips(['Total', 'By muscle', 'Volume', 'Records'], i, wrap=False)


WEEKS10 = [3.4, 3.9, 3.1, 4.4, 4.8, 5.2, 5.0, 5.9, 5.7, 6.2]


def e1rm_chart():
    a = spark([150, 152.5, 155, 155, 157.5, 160, 162.5, 165], 326, 100, 'brass', fill=False)
    b = spark([180, 180, 185, 187.5, 190, 190, 195, 200], 326, 100, 'neutral', fill=False)
    stack = f'<div style="position: relative; height: 100px">{abs_(b, "left: 0; top: 0")}{abs_(a, "left: 0; top: 0")}</div>'
    return col(section('Estimated 1RM'), card(stack, row(row(dot('brass'), txt('Squat 165 kg', 't-m'), gap=6), row(dot('neutral'), txt('Deadlift 205 kg', 't-m'), gap=6), gap=16), gap=8), gap=6)


BAR_T10 = ['track'] * 5 + ['brass'] * 5     # neutral-800 ×5, accent-800 → accent (kit: one brass)


def progress_head(i, rng='This week', v='6.2', label='Volume this week', delta='+8%', title='Progress', total=None):
    """pv-top · pv-title (30 px) · summary pane: KPI (40 px) — the e1 — then the section chips. On Total the bars join the KPI block."""
    hero = card(kpi(v, label, delta), total or '', tone='hero', gap=16, style='padding: 18px 16px 14px')
    return [topbar(rng), txt(title, 't-h1'), hero, pseg(i)]


def total_bars(vals=None, tones=None):
    return vbars(vals or WEEKS10, tones or BAR_T10, 140, 7)


P('P07-Progress.dc.html', 'Progress · Total', tab(*progress_head(0, total=total_bars()), e1rm_chart(), h=960), h=960)

MUSCLES = [('Chest', 1.9, 1.9), ('Back', 1.5, 1.5), ('Quads', 1.1, 1.1), ('Shoulders', 0.7, .7), ('Triceps', 0.5, .5), ('Hamstrings', 0.3, .3), ('Biceps', 0.2, .2), ('Calves', 0, 0), ('Forearms', 0, 0)]


def muscle_rows():
    out = []
    for n, v, _ in MUSCLES:
        pct = v / 1.9 * 100
        out.append(li(span(n, '' if v else 'c-dim'), None, micon(n, 30, 'brass' if v else 'muted'),
                      row(f'<div style="width: 130px">{bar(pct, "brass", 8)}</div>', span(f'{v} t' if v else '—', 'num t-s' if v else 'num t-s c-dim', 'width: 40px; text-align: right'), gap=10),
                      style='min-height: 48px; padding: 6px 2px'))
    return lst(*out, tone='quiet')


def note_card(text, icon='scale'):
    """.muscle-note / .vol-note: a quiet icon + 12 px line, no card."""
    return row(span(ico(icon, 16), 'c-dim'), txt(text, 't-m', 'flex: 1'), gap=8, align='flex-start', style='padding: 0 2px')


P('P07-Progress-Muscle.dc.html', 'Progress · By muscle', tab(*progress_head(1), muscle_rows(),
    note_card('Calves · Forearms had nothing this week, Chest had 31% of everything.'), h=1060), h=1060)


# -- Volume
def zone_bar(mev, mav, mrv, sets):
    mx = max(mrv * 1.3, sets * 1.05, mrv + 2)
    w = lambda v: max(0, min(100, v / mx * 100))
    segs = [(w(mev), 'under'), (w(mav - mev), 'productive'), (w(mrv - mav), 'high'), (w(mx - mrv), 'over')]
    inner = ''.join(f'<div style="width: {p:.1f}%">{bar(100, t_, 6)}</div>' for p, t_ in segs)
    return f'<div style="position: relative; display: flex; gap: 2px">{inner}<div style="position: absolute; left: {w(min(sets, mx)):.1f}%; top: -4px; width: 3px; height: 14px; margin-left: -1px">{bar(100, "neutral", 14)}</div></div>'.replace('"neutral"', '"neutral"')


ZONE_T = {'none': 'neutral', 'under': 'neutral', 'productive': 'ok', 'high': 'brass', 'over': 'danger'}
ZONE_L = {'none': 'None', 'under': 'Under', 'productive': 'Productive', 'high': 'High', 'over': 'Over'}


def vol_row(name, sets, lm, zone, fix=False, muscle=True):
    mev, mav, mrv = lm
    head = row(micon(name, 26, 'brass' if sets else 'muted') if muscle else '', txt(name, 't-h3', 'flex: 1'),
               btn('Fix', 'sec', 'plus', sm=True, style='height: 28px; padding: 0 10px') if fix else '',
               txt(f'{sets}<span class="t-m"> sets</span>', 't-s num'), tag(ZONE_L[zone], ZONE_T[zone]), gap=8)
    cap_ = row(txt(f'Productive {mev}–{mav}', 't-m c-ok'), sp(), txt(f'MRV {mrv}', 't-m'))
    return col(head, zone_bar(mev, mav, mrv, sets), cap_, gap=7, style='padding: 10px 2px 12px')


VOL_FINE = [('Chest', 24, (8, 14, 22), 'over'), ('Shoulders', 18, (8, 16, 26), 'high'), ('Triceps', 13, (6, 12, 18), 'high'), ('Quads', 12, (8, 14, 20), 'productive'),
            ('Lats', 11, (10, 16, 24), 'productive'), ('Traps', 7, (6, 12, 18), 'productive'), ('Glutes', 8, (6, 12, 18), 'productive'), ('Hamstrings', 7, (6, 12, 18), 'productive'),
            ('Biceps', 6.5, (6, 12, 20), 'productive'), ('Lower back', 3, (4, 8, 12), 'under'), ('Core', 2, (0, 8, 16), 'productive'), ('Forearms', 0, (5, 8, 14), 'none'), ('Calves', 0, (6, 12, 20), 'none')]


def vol_rows(rows_=VOL_FINE, muscle=True):
    return lst(*[vol_row(n, s, lm, z, fix=z in ("under", "none") and muscle, muscle=muscle) for n, s, lm, z in rows_], tone='quiet')


def vol_controls(map_=False, grain=0, sort=True):
    return row(f'<div style="width: 170px">{seg(["Muscles", "Zones"], grain)}</div>', f'<div style="width: 120px">{seg(["List", "Map"], 1 if map_ else 0)}</div>', sp(),
               ibtn('down', 'Sort', 'fill', sm=True) if sort else '', gap=8)


def vv_btn(text='Volume · List · Muscles'):
    return btn(text + ' ' + ico('down', 14), 'sec', 'sliders', sm=True, style='align-self: flex-start')


def deload_card(local=True):
    t_, b_ = ('Chest looks fried', 'Cut about a third of Chest sets for a week, then rebuild.') if local else \
             ('Fatigue is piling up', 'Several muscles are near their limit — a lighter recovery week would help.')
    # .deload-card: accent left rule (local) / danger (systemic)
    return card(row(span(ico('warn', 20), 'c-brass' if local else 'c-bad'), col(txt(t_, 't-h3'), txt(b_, 't-s'), gap=2, style='flex: 1'), gap=10, align='flex-start'),
                tone='glass' if local else 'bad', style='padding: 12px 14px')


def weak_card():
    r = lambda n, u, a: li(n, f'{u} · {a}', micon(n, 26, 'muted'), row(dot('bad'), btn('Fix', 'sec', 'plus', sm=True, style='height: 28px; padding: 0 10px'), gap=8), style='min-height: 48px; padding: 6px 12px')
    return card(row(tile('target', 'brass'), col(txt('Weak points', 't-h3'), txt('Under your minimum across recent weeks — worth catching up.', 't-s'), gap=2, style='flex: 1'), gap=10, align='flex-start'),
                lst(r('Calves', '5/6 wk low', '2.1 vs 6 min'), r('Lower back', '4/6 wk low', '2.8 vs 4 min')), gap=10, style='padding: 12px 14px')


def coach_group(lens='volume', summary='1 over MRV — consider trimming a set.', tuned='Ranges tuned to your history · 9 muscles', deload=True, weak=True, local=True):
    out = []
    if lens == 'volume':
        out += [note_card(summary), row(span(ico('target', 14), 'c-brass'), txt(tuned, 't-m c-brass', 'flex: 1'), gap=8, style='padding: 0 2px')]
    if deload:
        out.append(deload_card(local))
    if weak:
        out.append(weak_card())
    return col(*out, gap=10)


P('P07-Progress-Volume.dc.html', 'Progress · Volume (list, scroll)', tab(*progress_head(2), vv_btn(), vol_controls(), vol_rows(), coach_group(), h=2000), h=2000)


# -- Records
def rec_group(m, rows_, icon=True):
    """.record-group: bold accent-100 subheader with the muscle figure; rows without chrome (.record-row), record tag green."""
    head = row(micon(m, 30) if icon else span(ico('dumbbell', 19), 'c-brass'), txt(m, 't-h3 c-brass'), gap=10, style='padding: 6px 0 4px')
    rs = [li(n, None, None, row(txt(v, 't-b num'), tag('record', 'ok') if w == 0 else span(f'{w} wks', 'num t-m', 'width: 44px; text-align: right'), gap=10), style='min-height: 46px; padding: 8px 2px') for n, v, w in rows_]
    return col(head, lst(*rs, tone='quiet'), gap=0, style='margin-bottom: 8px')


RECS = [rec_group('Chest', [('Bench press', '100 kg', 0), ('Incline dumbbell press', '32 kg', 3), ('Cable fly', '20 kg', 5)]),
        rec_group('Back', [('Deadlift', '180 kg', 2), ('Barbell row', '90 kg', 6), ('Lat pulldown', '75 kg', 4)]),
        rec_group('Quads', [('Squat', '140 kg', 0), ('Leg press', '220 kg', 7)]),
        rec_group('Shoulders', [('Overhead press', '55 kg', 9), ('Lateral raise', '14 kg', 3)]),
        rec_group('Triceps', [('Triceps pushdown', '35 kg', 1)]),
        rec_group('Other', [('Farmer carry', '40 kg', 11)], icon=False)]
P('P07-Progress-Records.dc.html', 'Progress · Records (scroll)', tab(*progress_head(3), section('Records'), *RECS, h=1380), h=1380)


# -- Trends / Atlas
def atlas_say(text):
    return row(img('atlas/atlas-1.webp', 32, 32, 16), card(txt(text, 't-s'), tone='atlas', style='padding: 10px 12px; flex: 1', gap=0), gap=10, align='flex-start')


def atlas_panel(notes):
    return col(*[atlas_say(n) for n in notes], lbl('The numbers'), gap=8)


# .ai-badge --lvl: risk danger · warn #e8933f (amber) · info #5f8fd0 (blue) · good ok
LEVEL = {'risk': ('Risk', 'danger'), 'warn': ('Warning', 'illness'), 'info': ('Info', 'kcal'), 'good': ('On track', 'ok')}


def badge(lvl):
    n, t_ = LEVEL[lvl]
    return tag(n, t_)


def ai_top(kicker, lvl):
    return row(lbl(kicker) if kicker else '', sp(), badge(lvl), gap=8)


def ai_card(lvl, *inner, attention=False):
    tone = 'bad' if attention and lvl == 'risk' else ''
    return card(*inner, tone=tone, gap=8, style='padding: 14px')


def two_bar(a, b, la, lb, low='b'):
    return grid(col(txt(la, 't-m'), bar(a, 'bad' if low == 'a' else 'brass'), gap=4), col(txt(lb, 't-m'), bar(b, 'bad' if low == 'b' else 'brass'), gap=4), cols=2, gap=12)


INSIGHTS = [
    ai_card('risk', ai_top('Needs attention', 'risk'), txt('Pull volume is low', 't-h3'), two_bar(100, 62, 'Push', 'Pull'), txt('Add 4–6 sets — rows or pull-ups.', 't-s'), attention=True),
    ai_card('warn', row(row(tile('bolt', 'illness', s=14), txt('No rest day', 't-h3'), gap=8, style='flex: 1'), badge('warn'), gap=8),
            txt('8 training days in a row — a rest day helps you recover and grow.', 't-s')),
    ai_card('warn', ai_top('Top set · Squat', 'warn'), txt('Squat stalling', 't-h3'), spark([140, 140, 140, 137.5, 140, 140], 300, 34, 'illness', fill=False),
            txt('Top weight flat 4 weeks — try a deload or new rep range.', 't-s')),
    ai_card('info', ai_top('Least-trained · 4 wk', 'info'),
            col(*[row(txt(n, 't-s', 'width: 90px'), f'<div style="flex: 1">{bar(p, "danger" if i == 0 else "brass")}</div>', gap=10) for i, (n, p) in enumerate([('Calves', 8), ('Forearms', 18), ('Core', 30)])], gap=6),
            txt('Calves lags — add a set or two.', 't-s')),
    ai_card('info', ai_top('Weekly volume', 'info'), txt('Volume trending up', 't-h3'),
            grid(*[txt(v, 't-s num', 'text-align: center') for v in ['6.2 t', '5.8 t', '5.1 t', '4.6 t']], cols=4, gap=6),
            bars([6.2, 5.8, 5.1, 4.6], 300, 80, 'kcal', None, ['30d', '90d', '180d', '1y']),
            txt('Higher now than your earlier months — steady overload.', 't-s')),
    ai_card('good', ai_top('Strength', 'good'), txt('Bench press climbing', 't-h3'),
            row(txt('100', 't-num num'), txt('kg top', 't-m'), tag('+8%', 'ok'), gap=8, align='baseline'), spark([90, 92.5, 92.5, 95, 97.5, 100], 300, 34, 'ok', fill=False),
            txt('Top weight up 10 kg over ~3 months.', 't-s')),
]

P('P07-Trends.dc.html', 'Trends · Atlas (coach on, scroll)', tab(
    topbar(None), txt('Atlas', 't-h1'),
    atlas_panel(['Pull is 30% under push for 3 weeks — add a row set on chest days.', 'Eight days straight. Take tomorrow off — the squat will thank you.']),
    txt('What your training needs — the most lacking thing first.', 't-s'), *INSIGHTS, h=1560), h=1560)


# ============================================================== GOALS (Programs peer)
def goals_top():
    return row(col(lbl('Training'), txt('Goals', 't-h1'), gap=2), sp(), ov_back(), gap=8, align='flex-start')


def gcard(kicker, action, *body, tone=''):
    return card(row(lbl(kicker), sp(), action, gap=8), *body, tone=tone, gap=12, style='padding: 14px')


GROW = ['Side delt', 'Lats', 'Upper chest']
EASE = ['Lower back']


def focus_cols(grow=GROW, ease=EASE):
    return col(col(lbl('Grow', 'brass'), row(*[tag(g, 'brass') for g in grow], gap=6, wrap=True), gap=6) if grow else '',
               col(lbl('Ease', 'danger'), row(*[tag(e, 'danger') for e in ease], gap=6, wrap=True), gap=6) if ease else '', gap=12, style='flex: 1; min-width: 0')


FOCUS_PAINT = {'shoulders': 'high', 'lats': 'high', 'chest': 'high', 'lower_back': 'danger'}   # grow = accent, ease = danger


def focus_map(h=170, paint=FOCUS_PAINT):
    """FocusBodyMap view='both': front + back, grow sub-regions lit accent, ease danger."""
    return bodypair(paint=paint, h=h, gap=4)


def goals_screen(filled=True, overlay='', h=1400):
    intro = txt("Programs say what you train. Goals say why — the shape you're building toward and what this block emphasises.", 't-s')
    if filled:
        phys = gcard('Physique target', btn('Change', 'txt', style='height: 28px'),
                     row(img('physiques/v-taper-lit.png', 64, 150, 0, fit='contain'),
                         col(txt('V-Taper', 't-h2'), txt('Wide shoulders, tight waist', 't-m'), gap=4), gap=16), tone='glass')
        focus = gcard('Focus this block', ibtn('edit', 'Focus this block', 'fill', sm=True),
                      row(focus_map(h=170), focus_cols(), gap=12, align='flex-start'), tone='hero')
        shape = gcard('How your focus shapes training', '', lbl('Weekly volume targets'),
                      lst(*[li(m, None, None, row(span(a, 'num t-s c-dim'), ico('chev', 14), span(b, f'num t-h3 {c}'), tag(d, t_), gap=6), style='min-height: 44px; padding: 6px 2px')
                            for m, a, b, d, c, t_ in [('Chest', '14', '18', '+4', 'c-brass', 'brass'), ('Shoulders', '16', '20', '+4', 'c-brass', 'brass'),
                                                      ('Lats', '16', '20', '+4', 'c-brass', 'brass'), ('Lower back', '8', '4', '−4', 'c-bad', 'danger')]], tone='quiet'))
        moves = gcard('Suggested moves', '',
                      lst(*[li(n, None, span(ico('progress', 16), 'c-dim'), tag(r, 'brass'), style='min-height: 42px; padding: 6px 2px')
                            for n, r in [('Lateral raise', 'Side delt'), ('Cable lateral raise', 'Side delt'), ('Lat pulldown', 'Lats'), ('Pull-up', 'Lats'), ('Incline bench press', 'Upper chest'), ('Incline dumbbell press', 'Upper chest')]], tone='quiet'))
        body = [phys, focus, shape, moves, btn('Reset goals', 'txt', style='align-self: center')]
    else:
        phys = gcard('Physique target', ibtn('plus', 'Physique target', 'fill', sm=True),
                     card(row(tile('me', 'neutral'), txt("No target set yet — pick the shape you're training toward.", 't-s', 'flex: 1'), gap=12), tone='dash', style='padding: 12px'))
        focus = gcard('Focus this block', ibtn('edit', 'Focus this block', 'fill', sm=True),
                      card(row(tile('target', 'neutral'), txt('Nothing emphasised yet. Set muscles to grow, hold or ease off.', 't-s', 'flex: 1'), gap=12), tone='dash', style='padding: 12px'))
        body = [phys, focus]
    return tab(goals_top(), intro, *body, h=h, overlay=overlay)


P('P07-Goals.dc.html', 'Goals · physique + focus (scroll)', goals_screen(), h=1400)


# ============================================================== MASTERY
def insignia(s=40, dim=False):
    """RankInsignia (hex frame + chevrons/bars/stars) approximated with the brass shield tile."""
    return tile('shield', 'neutral' if dim else 'brass', lg=s >= 40, s=int(s * 0.5))


def m_head(title, right=''):
    return row(ibtn('back', 'Back', 'fill', sm=True), txt(title, 't-h2', 'flex: 1'), right, gap=10)


def axis_row(n, pct, score):
    return row(txt(f'{n} <span class="t-m">{pct}</span>', 't-s', 'width: 190px'), f'<div style="flex: 1">{bar(score, "brass")}</div>', txt(str(score), 't-s num', 'width: 26px; text-align: right'), gap=10)


def m_tile(icon, name, score, read, sub=None, chip_=None, gold=False, more=None):
    head = row(span(ico(icon, 18), 'c-brass'), txt(name + (f' <span class="t-m">{sub}</span>' if sub else ''), 't-h3', 'flex: 1'),
               txt(f'{score}<span class="t-m {"c-brass" if gold else ""}">/100</span>', 't-h3 num'), gap=8)
    rd = row(txt(read, 't-s c-brass' if gold else 't-s'), tag(chip_, 'neutral') if chip_ else '', gap=8, wrap=True)
    extra = row(txt(more, 't-m', 'flex: 1'), ico('chev', 16), gap=6) if more else ''
    return card(head, bar(score, 'brass'), rd, extra, tone='glass' if gold else '', gap=8, style='padding: 14px')


def mastery_detail(night=False, h=1100, overlay=''):
    hero = card(row(ring(64, 120, 'brass', 10, col(txt('640', 't-num num c-brass'), txt('RATING', 't-l c-brass'), gap=2, style='align-items: center')),
                    col(insignia(34), row(txt('Proficient', 't-h2'), txt('II', 't-h3 c-brass'), gap=6, align='baseline'), txt('20 below Proficient III', 't-s'), gap=6), gap=16),
                lbl('Balance across four axes'),
                axis_row('Strength', '30%', 68), axis_row('Consistency', '25%', 72), axis_row('Experience', '15%', 55), axis_row('Practice & programming', '30%', 61),
                tone='hero', gap=12, style='padding: 18px 16px')
    bd = [row(lbl('The breakdown'), sp(), txt('tap any axis', 't-m'), gap=8),
          m_tile('dumbbell', 'Strength', 68, '≈ Intermediate · top lift Bench press', sub='· relative to you'),
          m_tile('calendar', 'Consistency', 72, '3.4 sessions/wk · 26 weeks active'),
          m_tile('clock', 'Experience', 55, '~3 years training', chip_='self-reported'),
          m_tile('note', 'Practice & programming', 61, '2 signals need attention', gold=True, more='9 signals — coverage, progression, warm-up, rest, recovery, cardio…'),
          btn('See where you fall short', 'pri', 'progress', full=True),
          btn('See all nine ranks ' + ico('chev', 16), 'txt', 'list', style='align-self: center')]
    return ovl(m_head('Mastery'), hero, *bd, h=h, night=night, overlay=overlay)


P('P07-Mastery.dc.html', 'Mastery · detail (scroll)', mastery_detail(), h=1100)

IMP = {'High': 'brass', 'Med': 'brass', 'Low': 'neutral'}
SF = [('note', 'Add warm-up sets', 'Practice & programming · Warm-up sets', 'High'), ('heart', 'Add some conditioning', 'Practice & programming · Cardio & conditioning', 'High'),
      ('calendar', 'Train more regularly', 'Consistency', 'Med'), ('clock', 'Tune your rest between sets', 'Practice & programming · Rest between sets', 'Med'),
      ('dumbbell', 'Build strength relative to you', 'Strength', 'Low')]
P('P07-Mastery-Shortfall.dc.html', 'Mastery · where you fall short', ovl(
    m_head('Where you fall short'),
    card(row(col(lbl('Next up the scale', 'brass'), txt('Proficient III', 't-h2'), gap=4, style='flex: 1'), col(txt('20', 't-d1 num c-brass'), lbl('below', 'brass'), gap=2, style='align-items: flex-end'), gap=10), tone='glass', style='padding: 16px'),
    txt('The standards a lifter above you meets that you don’t yet — ordered by how much each holds your rating down. Close them and your standing rises on its own; there’s nothing to collect.', 't-s'),
    lst(*[li(t_, s_, tile(i, 'neutral' if imp == 'Low' else 'brass'), tag(imp, IMP[imp] if imp != 'Med' else 'neutral')) for i, t_, s_, imp in SF]),
    row(span(ico('info', 16), 'c-dim'), txt('Impact shows what weighs most — your rating reads the whole picture, so it settles as these change.', 't-m', 'flex: 1'), gap=8, align='flex-start'),
    h=990), h=990)

RANKS = [('World-Class', 'Rarefied — every signal mastered, sustained over years', 970), ('Elite', 'Mastery across nearly every signal', 900),
         ('Competitive', 'Sharp, consistent, seriously well-built training', 790), ('Advanced', 'Balanced, progressive, well-recovered training', 660),
         ('Proficient', 'Programming and execution are becoming deliberate', 520), ('Intermediate', 'You train the whole body with intent', 380),
         ('Developing', 'Training with more purpose', 240), ('Novice', 'Learning the lifts and the routine', 120), ('Foundation', 'Getting started — building the habit', 0)]


def rung(n, m, thr):
    if n == 'Proficient':
        pips = row(*[f'<div style="width: 22px">{bar(100 if i < 2 else 0, "brass", 5)}</div>' for i in range(3)], gap=4)
        return card(row(insignia(40), col(row(txt(n, 't-h3'), txt('II', 't-s c-brass'), txt('· you are here', 't-m c-brass'), gap=6, align='baseline'), txt(m, 't-m'), pips, gap=4, style='flex: 1'),
                        txt('640', 't-h3 num c-brass'), gap=12), tone='glass', style='padding: 12px 14px')
    locked = thr > 520
    return li(span(n, 'c-dim' if locked else ''), m, insignia(30, dim=locked), span(str(thr), 'num t-s'))


P('P07-Mastery-Ladder.dc.html', 'Mastery · the ladder', ovl(
    m_head('The ladder', tag('0–1000 scale', 'neutral')),
    lst(*[rung(*r) for r in RANKS[:4]]), rung(*RANKS[4]), lst(*[rung(*r) for r in RANKS[5:]]), h=844))


def history_tile(since=2023, pat=0):
    return card(row(span(ico('clock', 18), 'c-brass'), txt('Been training a while?', 't-h3', 'flex: 1'), tag('Optional', 'neutral'), gap=8),
                txt('Set roughly when you started so Experience isn’t stuck at zero. We’ll still label app-measured stats honestly.', 't-s'),
                row(ibtn('minus', '-', 'fill'), card(row(ico('calendar', 16), txt(f'Training since {since}', 't-h3 num'), gap=8, justify='center'), style='flex: 1; padding: 10px', gap=0), ibtn('plus', '+', 'fill'), gap=8),
                txt('How steady has it been?', 't-s'),
                chips(['Continuously', 'With short breaks', 'On and off'], pat),
                row(span(ico('external', 14), 'c-brass'), txt('Adds a slow Experience floor · never inflates the other axes', 't-m'), gap=6),
                gap=12, style='padding: 14px')


P('P07-Mastery-Calibrate.dc.html', 'Mastery · training history (Experience)', ovl(
    m_head('Mastery'), history_tile(), btn('Save & keep training', 'pri', 'check', full=True), h=844))


# ============================================================== ROW 1 · states
P('P07-Overview-Empty.dc.html', 'Overview · new account', tab(*overview('empty')), row_=1)
P('P07-Overview-Night.dc.html', 'Overview · night mode · all clear, rest day', tab(*overview(trends_state='clear', foot='Rest today · next: Upper 2, Thursday'), night=True, h=900), h=900, row_=1)
P('P07-Progress-Night.dc.html', 'Progress · night mode', tab(*progress_head(0, total=total_bars()), e1rm_chart(), night=True, h=1030), h=1030, row_=1)
P('P07-Mastery-Night.dc.html', 'Mastery · night mode', mastery_detail(night=True, h=1180), h=1180, row_=1)

unlock = lambda n: row(txt('Progress unlocks at', 't-s', 'flex: 1'), *[dot('brass' if i < n else 'neutral') for i in range(3)], gap=6)
P('P07-Progress-Locked.dc.html', 'Progress · locked (1 of 3 sessions)', tab(
    topbar(None), txt('Progress', 't-h1'), card(kpi('4.2', 'Volume this week', None), vbars([0.01] * 9 + [4.2], BAR_T10, 140, 7), tone='hero', gap=16, style='padding: 18px 16px 14px'),
    empty('Two more sessions', 'Volume, records and 1RM estimates need three logged sessions before they mean anything. You have one.', 'progress'), unlock(1), h=900), h=900, row_=1)
P('P07-Progress-Locked-Empty.dc.html', 'Progress · empty account', tab(
    topbar(None), txt('Progress', 't-h1'),
    empty('3 more sessions', 'Volume, records and 1RM estimates need three logged sessions before they mean anything. You have 0.', 'progress'), unlock(0)), row_=1)

P('P07-Progress-Range.dc.html', 'Progress · custom period', tab(
    *progress_head(0, 'Sep 1 – Sep 28', '23.4', 'Sep 1 – Sep 28', '+11%', total=total_bars([5.1, 5.6, 6.1, 6.6], ['brass'] * 4)), e1rm_chart(), h=960), h=960, row_=1)

VOL_ZONES = [('Chest', 24, (8, 14, 22), 'over'), ('Shoulders', 18, (8, 16, 26), 'high'), ('Arms', 19.5, (17, 32, 52), 'productive'),
             ('Legs', 27, (26, 50, 76), 'productive'), ('Back', 21, (20, 36, 54), 'productive'), ('Core', 2, (0, 8, 16), 'productive')]
P('P07-Progress-Zones.dc.html', 'Progress · Volume · Zones, cold start', tab(*progress_head(2), vv_btn('Volume · List · Zones'), vol_controls(grain=1),
    txt('Tracking your volume — ranges fill in as you train.', 't-s c-brass'), vol_rows(VOL_ZONES, muscle=False),
    coach_group(summary='1 over MRV — consider trimming a set.', tuned='Starting estimates — ranges tune to you as history builds', deload=False, weak=False), h=1160), h=1160, row_=1)

P('P07-Progress-Fatigue-Map.dc.html', 'Progress · Volume · Fatigue lens · map', tab(*progress_head(2), vv_btn('Fatigue · Map · Muscles'), vol_controls(map_=True, sort=False),
    card(seg(['Volume', 'Fatigue', 'Readiness'], 1),
         heatmap({'Chest': FAT_PAINT['fried'], 'Triceps': FAT_PAINT['high'], 'Shoulders': FAT_PAINT['moderate'], 'Quads': FAT_PAINT['fresh'],
                  'Glutes': FAT_PAINT['fresh'], 'Hamstrings': FAT_PAINT['fresh'], 'Lats': FAT_PAINT['moderate'], 'Biceps': FAT_PAINT['fresh']}, h=230, labels=True),
         legend([('Fresh', 'ok'), ('Moderate', 'brass'), ('High', 'brass'), ('Fried', 'danger')]), tone='hero', gap=14),
    coach_group(lens='fatigue', local=False), h=1180), h=1180, row_=1)

P('P07-Progress-Volume-Map.dc.html', 'Progress · Volume · volume lens · map', tab(*progress_head(2), vv_btn('Volume · Map · Muscles'), vol_controls(map_=True, sort=False),
    card(seg(['Volume', 'Fatigue', 'Readiness'], 0),
         heatmap({n: ZONE_PAINT[z] for n, _s, _l, z in VOL_FINE if GK.get(n)}, h=230, labels=True),
         legend([('Under', 'under'), ('Productive', 'productive'), ('High', 'high'), ('Over', 'over')]), tone='hero', gap=14),
    coach_group(), h=1300), h=1300, row_=1)


def rd_row(n, days, pct, tone):
    c = {'ok': 'c-ok', 'danger': 'c-bad', 'brass': 'c-brass', 'kcal': 'c-kcal'}[tone]
    return li(n, None, micon(n, 28), row(txt(days, 't-m num', 'width: 44px; text-align: right'), f'<div style="width: 80px">{bar(pct, tone)}</div>', txt(f'{pct}%', f't-s num {c}', 'width: 40px; text-align: right'), gap=8), style='min-height: 46px; padding: 6px 2px')


RD_ROWS = [('Chest', '~2d', 38, 'danger'), ('Triceps', '~1d', 55, 'brass'), ('Shoulders', '~1d', 64, 'brass'), ('Quads', 'ready', 100, 'ok'),
           ('Back', 'ready', 100, 'ok'), ('Biceps', 'ready', 100, 'ok'), ('Hamstrings', 'ready', 100, 'ok'), ('Calves', 'behind', 100, 'kcal')]
RD_VERDICT = card(row(tile('heart', 'danger'), col(txt('Ready to train: Back · Biceps · Hamstrings.', 't-h3'), txt('Still recovering: Chest · Triceps · Shoulders.', 't-s'), gap=2, style='flex: 1'), gap=12, align='flex-start'), style='padding: 12px 14px')


P('P07-Progress-Readiness.dc.html', 'Progress · Volume · Readiness lens · list', tab(*progress_head(2), vv_btn('Readiness · List · Muscles'), vol_controls(),
    row(span(ico('check', 16, w=2.2), 'c-ok'), txt('Good day for Back · Biceps · Hamstrings.', 't-s'), gap=8),
    lst(*[rd_row(*r) for r in RD_ROWS], tone='quiet'), RD_VERDICT,
    coach_group(lens='readiness', deload=False), h=1300), h=1300, row_=1)

RDP = {'recovering': 'danger', 'nearly': 'high', 'ready': 'ok', 'stale': 'kcal'}
P('P07-Progress-Readiness-Map.dc.html', 'Progress · Volume · Readiness lens · map', tab(*progress_head(2), vv_btn('Readiness · Map · Muscles'), vol_controls(map_=True, sort=False),
    row(span(ico('check', 16, w=2.2), 'c-ok'), txt('Good day for Back · Biceps · Hamstrings.', 't-s'), gap=8),
    card(heatmap({'Chest': RDP['recovering'], 'Triceps': RDP['nearly'], 'Shoulders': RDP['nearly'], 'Quads': RDP['ready'], 'Back': RDP['ready'], 'Biceps': RDP['ready'],
                  'Hamstrings': RDP['ready'], 'Calves': RDP['stale'], 'Glutes': RDP['ready']}, h=230, labels=True),
         legend([('recovering', 'danger'), ('nearly', 'brass'), ('ready', 'ok'), ('stale', 'kcal')]), tone='hero', gap=14),
    RD_VERDICT, coach_group(lens='readiness', deload=False), h=1240), h=1240, row_=1)

P('P07-Trends-States.dc.html', 'Trends · coach off + empty states', tab(
    topbar(None), txt('Trends', 't-h1'),
    cap('No sessions yet', empty('No trends yet', 'Finish a few sessions and insights show up here.', 'progress')),
    cap('Not ready', empty('Analysis needs a bit more history', 'Log 3+ weeks and the first insights — balance, timing, plateaus — appear here.', 'progress')),
    cap('Nothing to flag', empty('All clear', 'Nothing to flag right now — your training looks balanced. Keep it up.', 'shield')),
    cap('Atlas · no notes (coach on)', atlas_panel(['No notes yet — train, and I’ll have something to say.'])),
    cap('Stat card (StatCard)', ai_card('good', ai_top('Heaviest lift', 'good'), row(txt('180', 't-num num'), txt('kg', 't-m'), gap=6, align='baseline'), txt('Your all-time heaviest set — Deadlift.', 't-s'))),
    h=1400), h=1400, row_=1)

P('P07-Goals-Empty.dc.html', 'Goals · nothing set', goals_screen(False, h=844), row_=1)

P('P07-Mastery-Calibrating.dc.html', 'Mastery · calibrating (new account)', ovl(
    m_head('Mastery'),
    card(col(insignia(80, dim=True), txt('Calibrating your rank', 't-h2'), txt('You’ve logged 4 sessions. A few more and your rank settles — until then it’s a provisional read, not a verdict.', 't-s', 'text-align: center'),
             row(tag('provisional', 'neutral'), txt('~ Developing', 't-h3 c-brass'), gap=8), gap=10, style='align-items: center'), tone='hero', style='padding: 18px'),
    card(row(lbl('Estimate confidence'), sp(), txt('Low', 't-s c-brass'), gap=8), grid(bar(100, 'brass'), bar(0, 'brass'), bar(0, 'brass'), cols=3, gap=6),
         txt('Builds as you train · ~6 more sessions to a firm read', 't-m'), gap=10, style='padding: 14px'),
    history_tile(2019, 1), btn('Save & keep training', 'pri', 'check', full=True), h=1260), h=1260, row_=1)

# ============================================================== ROW 2 · sheets & popups
P('P07-Range-Sheet.dc.html', 'Progress · range sheet', phone(brandbar(), *progress_head(0, total=total_bars()), tabs='overview', mood='art', overlay=sheet(None,
    txt('Range', 't-h2'),
    row(chip('This week', True), chip('Last 4 weeks'), chip('3 months'), chip('1 year'), chip('All time'), gap=8, wrap=True),
    lbl('Custom'), grid(field('From', '08/31/2026', icon='calendar'), field('To', '09/28/2026', icon='calendar'), cols=2, gap=10),
    h=440, close=False, footer=btn('Show period', 'pri', full=True))), row_=2)


def lens_opt(n, s, on=False):
    return card(txt(n, 't-h3'), txt(s, 't-m'), tone='glass' if on else '', gap=2, style='padding: 10px 12px; flex: 1')


P('P07-Volume-View-Sheet.dc.html', 'Progress · volume view sheet', phone(brandbar(), *progress_head(2), vv_btn(), vol_controls(), tabs='overview', mood='art', overlay=sheet(None,
    row(txt('Volume view', 't-h2', 'flex: 1'), btn('Reset', 'txt', style='height: 32px')),
    lbl('Lens'), col(lens_opt('Volume', 'Sets per muscle vs targets', True), lens_opt('Fatigue', 'Load you’re still carrying'), lens_opt('Readiness', 'What’s recovered to train'), gap=8),
    grid(col(lbl('Show as'), seg(['List', 'Map'], 0), gap=6), col(lbl('Detail'), seg(['Muscles', 'Zones'], 0), gap=6), cols=2, gap=12),
    h=520, close=False)), row_=2)


def fix_card(name, scheme, chips_, avail, tone, icon, label='Start session + add'):
    return card(row(txt(name + ' ' + ico('chev', 14), 't-h3', 'flex: 1'), txt(scheme, 't-s num'), gap=8), row(*chips_, gap=6),
                row(span(ico(icon, 16), f'c-{tone}' if tone != 'neutral' else 'c-dim'), txt(avail, 't-s'), gap=6), btn(label, 'sec', sm=True, full=True), gap=8, style='padding: 12px 14px')


P('P07-Fix-Sheet.dc.html', 'Progress · Fix → add Calves work', phone(brandbar(), *progress_head(2), vv_btn(), tabs='overview', mood='art', overlay=sheet(None,
    txt('Add Calves work', 't-h2'), txt('Exercises that hit it — ready to add', 't-s'),
    fix_card('Standing calf raise', '3 × 12–15', [tag('Calves', 'brass')], f'Available at {GYM}', 'ok', 'check'),
    fix_card('Single-leg calf raise', '3 × 12–15', [tag('Calves', 'brass')], 'Bodyweight — anywhere', 'brass', 'me'),
    fix_card('Leg press calf raise', '3 × 12–15', [tag('Calves', 'brass'), tag('Quads', 'neutral')], 'Needs Leg press — not at your gym', 'bad', 'warn'),
    h=640, close=False)), row_=2)

FOCUS_G = [('Shoulders', [('Front delt', 1), ('Side delt', 2), ('Rear delt', 1)]), ('Chest', [('Upper chest', 2), ('Lower chest', 1)]),
           ('Back', [('Lats', 2), ('Traps', 1), ('Lower back', 0)]), ('Legs', [('Quads', 1), ('Hamstrings', 1), ('Glutes', 1), ('Calves', 1)]),
           ('Arms', [('Biceps', 1), ('Triceps', 1), ('Forearms', 1)]), ('Core', [('Core', 1)])]


def focus_row(n, e):
    d = {0: 'danger', 1: 'neutral', 2: 'brass'}[e]
    return li(n, None, dot(d), f'<div style="width: 190px">{seg(["Ease", "Hold", "Grow"], e)}</div>', style='min-height: 48px; padding: 6px 10px 6px 14px')


focus_sheet = sheet(None,
    row(ibtn('back', 'Back', 'fill', sm=True), txt('Focus this block', 't-h2', 'flex: 1'), btn('Reset', 'txt', style='height: 32px'), gap=8),
    row(focus_map(h=150), txt('Grow adds volume and moves a muscle up in exercise suggestions; ease off trims it back.', 't-s', 'flex: 1'), gap=12),
    *[col(lbl(g), lst(*[focus_row(n, e) for n, e in ms]), gap=6) for g, ms in FOCUS_G],
    h=1500, close=False, footer=row(txt('3 grow · 1 ease · 12 held', 't-s', 'flex: 1'), btn('Save focus', 'pri'), gap=10))
P('P07-Focus-Editor.dc.html', 'Goals · Focus editor (sheet, scroll)', goals_screen(overlay=focus_sheet, h=1580), h=1580, row_=2)


PHYS_KEY = {'V-Taper': 'v-taper', 'Classic': 'classic', 'Powerbuilder': 'powerbuilder', 'Lean Athlete': 'lean-athlete', 'Hourglass': 'hourglass',
            'Glute Focus': 'glute-focus', 'Toned & Lean': 'toned-lean', 'Strong Athlete': 'strong-athlete'}


def phys_card(n, b, on=False):
    """phys-card: the archetype silhouette (-lit when picked), name, blurb, check on the picked one."""
    k = PHYS_KEY[n] + ('-lit' if on else '')
    return card(row(sp(), span(ico('check', 16, w=2.4), 'c-brass') if on else '', style='height: 16px'), row(img(f'physiques/{k}.png', 80, 150, 0, fit='contain'), justify='center'),
                txt(n, 't-h3', 'text-align: center'), txt(b, 't-m', 'text-align: center'), tone='glass' if on else '', gap=6, style='padding: 10px')


P('P07-Physique-Picker.dc.html', 'Goals · physique target picker', goals_screen(overlay=sheet(None,
    row(ibtn('back', 'Back', 'fill', sm=True), txt('Physique target', 't-h2', 'flex: 1'), btn('Remove', 'txt', style='height: 32px'), gap=8),
    txt("Pick the shape you're building toward — it seeds your muscle focus, which you can tune afterwards.", 't-s'),
    grid(phys_card('V-Taper', 'Wide shoulders, tight waist', True), phys_card('Classic', 'Balanced, symmetrical mass'),
         phys_card('Powerbuilder', 'Size built on the big lifts'), phys_card('Lean Athlete', 'Conditioned and defined'), cols=2, gap=10),
    h=720, close=False, footer=btn('Use this target', 'pri', full=True)), h=844), row_=2)

P('P07-Physique-Picker-Sex.dc.html', 'Goals · physique picker · no sex on account', goals_screen(False, overlay=sheet(None,
    row(ibtn('back', 'Back', 'fill', sm=True), txt('Physique target', 't-h2', 'flex: 1'), gap=8),
    txt("Pick the shape you're building toward — it seeds your muscle focus, which you can tune afterwards.", 't-s'),
    seg(['Male', 'Female'], 1),
    grid(phys_card('Hourglass', 'Shoulders & glutes, tight waist'), phys_card('Glute Focus', 'Lower-body led'),
         phys_card('Toned & Lean', 'Defined and light'), phys_card('Strong Athlete', 'Built to perform'), cols=2, gap=10),
    h=760, close=False, footer=btn('Use this target', 'pri', full=True, dis=True)), h=844), row_=2)

PS = [('target', 'Muscle coverage & balance', 'All major groups covered', 'Good'), ('progress', 'Load progression', 'Flat lately: Squat', 'Watch'),
      ('pulse', 'Volume in range', 'Calves below MEV', 'Watch'), ('flame', 'Warm-up sets', '38% of lifts get a warm-up', 'Low'),
      ('yoga', 'Cooldown & mobility', 'Rarely logged after sessions', 'Low'), ('timer', 'Rest between sets', 'Well-paced rest', 'Good'),
      ('moon', 'Recovery & rest days', 'Sensible rhythm · respects readiness', 'Good'), ('heart', 'Cardio & conditioning', 'Conditioning in the mix', 'Good'),
      ('list', 'Session structure', 'Compounds first · sensible sets', 'Good')]
ST = {'Good': 'ok', 'Watch': 'brass', 'Low': 'danger'}
P('P07-Practice-Sheet.dc.html', 'Mastery · practice signals sheet', mastery_detail(h=844, overlay=sheet(None,
    row(span(ico('note', 20), 'c-brass'), txt('Practice & programming', 't-h2', 'flex: 1'), tag('61/100', 'brass'), gap=8),
    txt('Everything about how you build and run sessions — measured from data you already log. Nothing you do is left out.', 't-s'),
    lst(*[li(n, r, tile(i, ST[s]), tag(s, ST[s]), style='min-height: 54px') for i, n, r, s in PS]),
    h=760, close=False)), row_=2)

# ============================================================== ROW 3 · dialogs, moments, desktop, gate
P('P07-Goals-Reset.dc.html', 'Goals · reset confirm', goals_screen(overlay=dialog('Reset goals', 'This clears your physique target and block focus.', 'Reset goals', 'Cancel', top=300), h=844), row_=3)

rankup = popup(col(
    row(sp(), ibtn('x', 'Cancel', 'fill', sm=True)), lbl('Your standing rose', 'brass'),
    row(tile('shield', 'brass', lg=True, s=52), justify='center', style='padding: 6px 0'),
    row(txt('Proficient', 't-h1'), txt('I', 't-h2 c-brass'), gap=8, justify='center', align='baseline'),
    txt('Programming and execution are becoming deliberate', 't-s', 'text-align: center'),
    col(lbl('What moved it', 'brass'), row(span(ico('calendar', 16), 'c-brass'), txt('Consistency · 72<span class="t-m">/100</span>', 't-s'), gap=8),
        row(span(ico('dumbbell', 16), 'c-brass'), txt('Strength · 68<span class="t-m">/100</span>', 't-s'), gap=8), gap=8),
    card(row(span(ico('target', 16), 'c-brass'), txt('Next: Advanced — Add warm-up sets', 't-s', 'flex: 1'), gap=8), style='padding: 10px 12px'),
    btn('See what’s next', 'pri', full=True), gap=12), top=140)
P('P07-Rank-Up.dc.html', 'Mastery · rank-up moment (MasteryRankUp)', tab(*overview(), overlay=rankup), row_=3)

# -- desktop (≥960 px: detail pane)
def dpane(*inner, w=None):
    return card(*inner, gap=16, style=f'padding: 22px; {"width: " + str(w) + "px;" if w else "flex: 1;"} min-width: 0')


def d_summary(i, *extra):
    return dpane(row(ov_back(), sp(), btn('This week', 'sec', 'calendar', sm=True)), txt('Progress', 't-h1'), kpi(), pseg(i), *extra, w=520)


def d_table(head, rows_):
    return tbl(head, rows_)


def tbl(head, rows_):
    h = row(*[span(x, 't-l', 'flex: 1') for x in head], gap=10, style='padding: 10px 16px 6px')
    rs = ''.join(f'<div class="li" style="min-height: 44px">{"".join(span(x, "t-s c-ok" if x.endswith("here") else ("t-s c-bad" if x.startswith("No ") else "t-s"), "flex: 1") for x in r)}</div>' for r in rows_)
    return f'<div class="card">{h}{rs}</div>'


rec_detail = dpane(row(txt('Bench press', 't-h1', 'flex: 1'), btn('Full history', 'txt')),
                   row(tag('Chest'), tag('Triceps', 'neutral'), tag('Shoulders', 'neutral'), tag('Barbell', 'neutral', 'dumbbell'), tag('Bench', 'neutral', 'dumbbell'), gap=6),
                   grid(*[col(txt(v, f't-num num {c}'), lbl(l), gap=4) for v, l, c in [('100', 'Record kg', 'c-ok'), ('117', 'Est. 1RM', ''), ('100', 'Last top', ''), ('2 105 kg', 'Last volume', '')]], cols=4),
                   card(lbl('Top set · 12 weeks'), spark([100, 104, 106, 107, 109, 110, 112, 113, 115, 117], 600, 150, 'brass', fill=False),
                        row(txt('14 sessions', 't-m'), sp(), txt('100 kg · record', 't-m')), tone='hero', gap=10),
                   col(section('Where you can do it'), d_table(['Gym', 'Needs', 'Status'], [[GYM, 'Barbell · Bench', 'Both here'], ['Home', 'Barbell · Bench', 'No bench']]), gap=6))
recs_desk = [row(lbl('Records'), sp(), btn('Exercises', 'txt', style='height: 28px')),
             rec_group('Chest', [('Bench press', '100 kg', 0), ('Incline dumbbell press', '32 kg', 3), ('Cable fly', '20 kg', 5)]),
             rec_group('Back', [('Deadlift', '180 kg', 2), ('Barbell row', '90 kg', 6)])]
board('P07-Desktop-Records.dc.html', 'Progress · Records · desktop (detail pane)', 1440, 900,
      desktop(row(d_summary(3, *recs_desk), rec_detail, gap=20, align='flex-start'), active='overview'), row_=3)

vol_desk = dpane(row(txt('Volume', 't-h1', 'flex: 1'), f'<div style="width: 320px">{seg(["Volume", "Fatigue", "Readiness"], 0)}</div>', gap=10),
                 heatmap({n: ZONE_PAINT[z] for n, _s, _l, z in VOL_FINE if GK.get(n)}, h=420, labels=True),
                 legend([('Under', 'under'), ('Productive', 'productive'), ('High', 'high'), ('Over', 'over')]))
board('P07-Desktop-Volume.dc.html', 'Progress · Volume · desktop (map pane)', 1440, 900,
      desktop(row(d_summary(2, vv_btn(), row(f'<div style="width: 170px">{seg(["Muscles", "Zones"], 0)}</div>', sp(), ibtn('down', 'Sort', 'fill', sm=True)), vol_rows(VOL_FINE[:5])), vol_desk, gap=20, align='flex-start'), active='overview'), row_=3)
print('ok')
