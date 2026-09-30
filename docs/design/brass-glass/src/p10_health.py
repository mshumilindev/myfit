"""P10 · Health, sleep, injury — 1:1 translation of views/HealthView.tsx + views/health/{HealthForm,HealthHistory,parts}.tsx,
views/SleepView.tsx (night · wake · logged · hub · backfill · schedule · edit), components/{SleepAutomation,SleepHero,MoonGlyph,
Readiness,MuscleStatePanel,FixSheet}.tsx and views/InjuryView.tsx. Copy = en.ts. Night mode (a live night) = mood='sky' on every
screen someone can open while asleep; see fidelity/P10.md for the board -> source map."""
from kit import *

import glob as _glob, os as _os
for _f in _glob.glob(_os.path.join(OUT, 'P10-*.dc.html')):
    _os.remove(_f)

# ============================================================== tone map (app kit tone -> glass tone)
# the app's own families (components/ui/tones.ts, Health.css): rest sky · active teal · illness amber · injury coral · sleep violet · accent brass
TN = {'off': 'rest', 'active': 'active', 'illness': 'illness', 'injury': 'injury', 'sleep': 'sleep', 'neu': 'neutral', 'gym': 'brass'}
IC = {'off': 'yoga', 'active': 'pulse', 'illness': 'flame', 'injury': 'bandage'}   # bed / pulse / thermo / bandage
CARD = {'rest': 'rest', 'ok': 'ok', 'brass': 'glass', 'bad': 'bad', 'danger': 'bad', 'sleep': 'sleep', 'illness': 'illness', 'injury': 'injury', 'active': 'active', 'kcal': 'kcal'}
TXT = {'rest': 'c-rest', 'ok': 'c-ok', 'brass': 'c-brass', 'bad': 'c-bad', 'danger': 'c-bad', 'sleep': 'c-sleep', 'neutral': 'c-mut',
       'illness': 'c-illness', 'injury': 'c-injury', 'active': 'c-active', 'kcal': 'c-kcal'}


def tchip(t_, tone=None, on=False):
    """PresetChips / Chip in the app's tone family (selected = tinted family pill)"""
    if not on:
        return chip(t_)
    if tone in (None, 'brass'):
        return chip(t_, True)
    return card(span(t_, f't-s {TXT[tone]}'), tone=CARD[tone], pad=False, gap=0, style='height: 34px; padding: 0 14px; flex-direction: row; align-items: center; white-space: nowrap')


def tbtn(label, tone='brass', flex='1.6', dis=False, full=False):
    """Health.css tone-filled primary (.p-rest / .p-act / .p-ill / .p-inj)"""
    if tone in ('brass', None):
        return btn(label, 'pri', style=f'flex: {flex}', dis=dis, full=full)
    inner = span(label, f't-h3 {TXT[tone]}')
    st = f'height: 48px; flex-direction: row; align-items: center; justify-content: center; {"width: 100%;" if full else f"flex: {flex};"} white-space: nowrap'
    c = card(inner, tone=CARD[tone], pad=False, gap=0, style=st)
    return f'<div class="btn dis" style="padding: 0; height: 48px; flex: {flex}{"; width: 100%" if full else ""}">{c}</div>' if dis else c


def abs_box(inner, css):
    return f'<div style="position: absolute; {css}">{inner}</div>'


def house(w=52, h=52, r=12, mark=18):
    """HouseGraphic.tsx — the app's own gym-photo fallback: graphite weave + centred barbell mark"""
    return f'<div style="position: relative; width: {w if isinstance(w, str) else str(w) + "px"}; height: {h}px; flex: none">{photo(w, h, r)}{abs_box(span(ico("dumbbell", mark), "c-dim"), "left: 0; right: 0; top: 0; bottom: 0; display: flex; align-items: center; justify-content: center")}</div>'


def ic(kind, tone=None):
    return tile(IC.get(kind, kind), tone or TN.get(kind, 'neutral'))


# ============================================================== GroupedList / ListRow (components/ui/GroupedList)
def glist(header=None, *rows, footer=None, err=False, notes=()):
    out = [lbl(header)] if header else []
    out.append(lst(*[r for r in rows if r]))
    for n in notes:
        out.append(txt(n, 't-m', 'padding: 0 4px'))
    if footer:
        out.append(txt(footer, 't-m c-bad' if err else 't-m', 'padding: 0 4px'))
    return col(*out, gap=8)


def lr(label, sub=None, icon=None, value=None, vtone=None, strong=False, chev=False, check=None, ctone='brass', trail='', action=None, dim=False, sel=False):
    """ListRow: icon tile · label/sub · value (tone, strong) · check · chevron. action=tone -> centred tinted action label."""
    if action:
        return li(span(label, f't-h3 {TXT.get(action, "")}'), style='justify-content: center; text-align: center')
    v = ''
    if value:
        cls = ('t-h3 ' if strong else 't-s ') + (TXT.get(vtone, '') if vtone else 'c-mut')
        v = span(value, cls + ' num')
    ck = span(ico('check', 18, w=2.2), TXT.get(ctone, 'c-brass')) if check else ''
    title = span(label, 'c-dim') if dim else label
    r = li(title, sub, icon, v + trail + ck, chev=chev)
    return card(r, tone='glass', pad=False, gap=0) if sel else r


def sticky(*btns):
    return abs_box(row(*btns, gap=8), 'left: 16px; right: 16px; bottom: 18px')


def sbar(primary, tone='rest', dis=False, cancel='Cancel'):
    return sticky(btn(cancel, 'sec', style='flex: 1'), tbtn(primary, tone, dis=dis))


# ============================================================== Calendar (components/ui/Calendar, month grid, Mon first)
SEP_FIRST = 1  # 1 Sep 2026 = Tuesday -> index 1 in a Monday-first week


def cal(month='September 2026', start=None, end=None, tone='rest', today=28, gold=(), skipped=(), maxd=None, single=None, presets=None, first=SEP_FIRST, days=30, lead_prev=31, lead_in=(), lead_end=None):
    head = row(ibtn('back', 'Previous month', sm=True), txt(month, 't-h3', 'flex: 1; text-align: center'), ibtn('chev', 'Next month', sm=True), gap=4)
    wd = grid(*[txt(d, 't-m', 'text-align: center') for d in 'MTWTFSS'], cols=7, gap=2)
    cells = []
    for i in range(first):
        ld = lead_prev - first + 1 + i
        lb = col(txt(str(ld), 't-s num c-dim', 'text-align: center'), gap=0, style='align-items: center; justify-content: center; height: 38px')
        if ld == lead_end:
            cells.append(card(lb, tone=CARD.get(tone, 'glass'), pad=False, gap=0, style=''))
        elif ld in lead_in:
            cells.append(card(lb, pad=False, gap=0, style=''))
        else:
            cells.append(col(txt(str(ld), 't-s num c-dim', 'text-align: center'), gap=0, style='align-items: center; justify-content: center; height: 38px'))
    for d in range(1, days + 1):
        num_cls = 't-s num'
        if d == today:
            num_cls += ' c-brass'
        mark = f'<div style="display: flex; justify-content: center; height: 6px">{dot("brass") if d in gold else ""}</div>'
        num = txt(f'<s>{d}</s>' if d in skipped else str(d), num_cls, 'text-align: center')
        body = col(num, mark, gap=1, style='align-items: center; justify-content: center; height: 38px')
        is_end = (single is not None and d == single) or (start is not None and (d == start or d == end))
        in_rng = start is not None and end is not None and start < d < end
        if is_end:
            cells.append(card(body, tone=CARD.get(tone, 'glass'), pad=False, gap=0, style=''))
        elif in_rng:
            cells.append(card(body, pad=False, gap=0, style=''))
        elif maxd is not None and d > maxd:
            cells.append(col(txt(str(d), 't-s num c-dim', 'text-align: center'), f'<div style="height: 6px"></div>', gap=1, style='align-items: center; justify-content: center; height: 38px'))
        else:
            cells.append(body)
    g = grid(*cells, cols=7, gap=3)
    return col(presets or '', head, wd, g, gap=8, style='padding: 10px 12px 12px')


def presets(items, on=None, tone='brass'):
    return row(*[tchip(x, tone, x == on) for x in items], gap=6, wrap=True)


def panel(inner):
    """ListPanel: an expanded area inside the grouped list"""
    return f'<div class="hl" style="padding: 2px 0">{inner}</div>'


# ============================================================== screens shell
def hl_screen(title, *content, h=844, overlay='', mood='art', bar_=''):
    return phone(brandbar(), header(title), *content, sp(h=80 if bar_ else 10), tabs=None, h=h, mood=mood, overlay=bar_ + overlay)


def night(*content, h=844, overlay='', tabs='today', hero=True, paused=False):
    return phone(brandbar(), sleephero(paused, dur='6h 48m') if hero else '', *content, tabs=tabs, h=h, mood='sky', overlay=overlay)


# ============================================================== HEALTH HOME (HealthView mobile)
def segs(n, cur, tone):
    return row(*[f'<div style="flex: 1">{bar(100 if i <= cur else 0, tone, 5)}</div>' for i in range(n)], gap=5)


def now_hero(header, tone, icon, title, big, big_sub=None, sub=None, rows_=(), action=None, foot=None, prog=None):
    """The 'Now' group — the one thing Health is about right now. e1: family-tinted, big day/stage figure; the rest squeezed."""
    head = row(tile(icon, tone, lg=True), col(lbl(header, tone), txt(title, 't-h2'), txt(sub, 't-s') if sub else '', gap=2, style='flex: 1; min-width: 0'), span(ico('chev', 20), 'c-dim'), gap=12)
    fig = row(span(big, 't-num num'), span(big_sub, f't-h3 {TXT[tone]}') if big_sub else '', gap=10, align='baseline')
    extra = [prog] if prog else []
    small = [row(span(ico(i, 16), 'c-dim'), txt(a, 't-s', 'flex: 1'), span(b, 't-m') if b else '', gap=8) for i, a, b in rows_]
    body = [head, fig, *extra]
    if small:
        body.append(col('<div class="hl"></div>', *small, gap=8))
    if action:
        body.append(tbtn(action, tone, full=True))
    out = card(*body, tone=CARD[tone], gap=12, style='padding: 16px')
    return col(out, txt(foot, 't-m', 'padding: 0 4px') if foot else '', gap=8)


G_INJURY = now_hero('Now · Right knee', 'injury', 'bandage', 'Rehab plan', 'Stage 2 of 4', 'Reintroduce', prog=segs(4, 1, 'injury'),
                    rows_=[('clock', 'Next check-in · How did it feel?', 'After your next session')])
G_INJURY_LIST = glist('Now · Right knee',
                 lr('Rehab plan', 'Stage 2 of 4 · ' + span('Reintroduce', 'c-injury'), ic('injury'), chev=True),
                 lr('Next check-in', 'How did it feel?', tile('clock', 'injury'), 'After your next session'))
G_COMING = glist('Coming up', lr('Vacation', '5–11 Oct', ic('off'), 'In 7 days', chev=True))


def g_sleep(live=False):
    start = span('Asleep since 23:40' if live else 'Start sleep', 't-h3 c-sleep')
    return glist('Sleep',
                 lr('Last night', '23:40–06:52', tile('moon', 'sleep'), '7h 12m', chev=True),
                 lr(start, None, tile('clock', 'sleep')),
                 lr('Sleep details & schedule', 'Nights, backfill a night, your usual schedule', tile('calendar', 'sleep'), chev=True))


def g_start(ill_active=False, sel=None):
    unwell = lr('Unwell', 'Sick days — your plan waits', ic('illness'), 'Active', dim=True) if ill_active else lr('Unwell', 'Sick days — your plan waits', ic('illness'), chev=True, sel=sel == 'ill')
    return glist('Start',
                 lr('Full rest', 'Away from the gym', ic('off'), chev=True, sel=sel == 'off'),
                 lr('Active recovery', 'Light training, reduced targets', ic('active'), chev=True, sel=sel == 'act'),
                 unwell,
                 lr('Injury rehab', 'A guided plan, stage by stage', ic('injury'), chev=True),
                 footer='Full rest and active recovery can start today or later — plan a vacation ahead.')


def g_past(sel=None):
    return glist('Log the past',
                 lr('I was unwell', None, ic('illness'), chev=True, sel=sel == 'ill'),
                 lr('I took a break', 'Full rest or active recovery', ic('off'), chev=True, sel=sel == 'off'),
                 lr('I got hurt', None, ic('injury'), chev=True, sel=sel == 'inj'),
                 footer='Pick the days on a calendar. If you trained in between, we’ll ask what to keep.')


G_HIST = glist('History',
               lr('Unwell', 'Unwell · 4 days', ic('illness'), '14–17 Sep', chev=True),
               lr('Full rest', 'Full rest · 3 days', ic('off'), '1–3 Sep', chev=True),
               lr(span('See all', 't-h3 c-brass'), None, None, 'List · Timeline', chev=True))

G_ILL = now_hero('Now · Unwell', 'illness', 'flame', 'Unwell', 'Day 4', sub='Since Fri 25 Sep · no end date',
                 rows_=[('shield', 'Streak protected · Program paused', None)], action='I\'m recovered',
                 foot='No missed days — your plan waits until you tap “I’m recovered”.')
G_REST = now_hero('Now · Full rest', 'rest', 'yoga', 'Vacation', 'Day 3/7', sub='26 Sep – 2 Oct', prog=segs(7, 2, 'rest'),
                  rows_=[('shield', 'Fully off — no gym. These days count as rest, not missed.', None)], action='End rest now')
G_ACT = now_hero('Now · Active recovery', 'active', 'pulse', 'Active recovery', 'Day 3', sub='Since Sat 26 Sep · no end date',
                 rows_=[('pulse', 'Light training with reduced targets. These days count as rest.', None)], action='End rest now')
G_BACK = col(card(row(tile('sun', 'brass', lg=True), col(lbl('Now'), txt('Welcome back', 't-num'), txt('Take it easy today', 't-s'), gap=2, style='flex: 1'), span('Today', 't-m'), gap=12, align='flex-start'),
                  '<div class="hl"></div>',
                  row(span(ico('shield', 16), 'c-dim'), txt('You were out 4 days · No streak lost', 't-s', 'flex: 1'), span('Streak kept', 't-m'), gap=8),
                  row(span(ico('pause', 16), 'c-dim'), txt('Program · Lighter targets today, full plan tomorrow', 't-s', 'flex: 1'), span('Resumed', 't-m'), gap=8),
                  tone='hero', gap=10, style='padding: 16px'), txt('Unwell 23–26 Sep is now in your history.', 't-m', 'padding: 0 4px'), gap=8)
G_CLEAR = col(card(row(tile('shield', 'neutral', lg=True), col(lbl('Now · Status'), txt('All clear', 't-num'), gap=4, style='flex: 1'), gap=12), tone='quiet'),
              txt('Nothing active. Start something below, or log what already happened.', 't-m', 'padding: 0 4px'), gap=4)
G_FULLREST_INJ = now_hero('Now · Left shoulder', 'injury', 'bandage', 'Rehab plan', 'Stage 1 of 4', 'Full rest', prog=segs(4, 0, 'injury'),
                          rows_=[('clock', 'Next check-in · How did it feel?', '12 days left')])

P('P10-Health.dc.html', 'Health · home (scroll)', hl_screen('Health', G_INJURY, G_COMING, g_sleep(), g_start(), g_past(), G_HIST, h=1330), h=1330)

# ============================================================== FORMS (HealthForm mobile) — row 0 main flow
PAST_P = ['Today', 'Yesterday', 'Last 3 days', 'This week', 'Last week']
START_P = ['Today', 'Next 7 days', 'This week', 'Next week', '10 days', '2 weeks']


def period(type_='Full rest', tone='rest', icon='off', name='', ph='e.g. Vacation', expanded=False, opts=('Full rest', 'Active recovery', 'Unwell', 'Injury'), fw=230):
    rows = [lr('Type', None, ic(icon, tone), type_, tone, True, chev=True)]
    if expanded:
        tmap = {'Full rest': 'rest', 'Active recovery': 'active', 'Unwell': 'illness', 'Injury': 'injury'}
        rows += [lr(o, None, None, check=o == type_, ctone=tmap[o], trail='') for o in opts]
    rows.append(li(span('Name', 't-s', 'width: 70px'), None, None, f'<div style="width: {fw}px">{field(value=name, ph=ph)}</div>'))
    return glist('Period', *rows)


def dates(start_lbl, start_v, end_lbl, end_v, tone='rest', exp=None, calendar='', ongoing=False, ongoing_sub=None, footer='', err=False, notes=()):
    rs = [lr(start_lbl, None, None, start_v, tone if exp == 'start' else None, exp == 'start')]
    if exp == 'start':
        rs.append(panel(calendar))
    rs.append(lr(end_lbl, None, None, end_v, tone if exp == 'end' else None, exp == 'end'))
    if exp == 'end':
        rs.append(panel(calendar))
    rs.append(lr('Still ongoing', ongoing_sub, None, trail=toggle(ongoing)))
    return glist('Dates', *rs, footer=footer, err=err, notes=notes)


def does(program='Paused', rem='Off', active=False):
    return glist('What it does',
                 lr('Streak', None, tile('shield'), 'Protected'),
                 lr('Program', None, tile('pause'), program),
                 lr('Reminders', None, tile('bell'), rem))


F_FULLREST = hl_screen('Full rest',
    period(),
    dates('Starts', 'Mon 28 Sep', 'Ends', 'Sun 4 Oct', 'rest', 'end',
          cal('October 2026', start=0, end=4, tone='rest', presets=presets(START_P, 'Next 7 days', 'rest'), first=3, days=31, lead_prev=30, today=None, lead_in=(29, 30), lead_end=28),
          ongoing_sub='No end date — end it whenever you’re back', footer='7 days, starting today. Your plan picks up on Mon 5 Oct.'),
    does(), h=1260, mood='rest', bar_=sbar('Start full rest'))
P('P10-Form-FullRest.dc.html', 'Start · Full rest (scroll)', F_FULLREST, h=1260)

F_UNWELL = hl_screen('Unwell',
    period('Unwell', 'illness', 'illness', ph='e.g. Flu'),
    dates('Starts', 'Mon 28 Sep', 'Ends', 'When you tap “I’m recovered”', 'illness', 'start',
          cal(single=28, tone='illness', presets=presets(PAST_P, 'Today', 'illness'), maxd=28), ongoing=True, ongoing_sub='No end date',
          footer='Day 1 so far. No missed days — your plan waits.', notes=['Illness can’t be planned ahead — log it on the day, or afterwards under Log the past.']),
    h=1180, bar_=sbar('Mark unwell', 'illness'))
P('P10-Form-Unwell.dc.html', 'Start · Unwell (open-ended)', F_UNWELL, h=1180)

# ============================================================== HISTORY (HealthHistory) — row 0
def hist_controls(mode=0, f=0):
    fl = [('All', ()), ('Rest', ('rest', 'active')), ('Unwell', ('illness',)), ('Injury', ('injury',))]
    chs = row(*[f'<button class="chip{" on" if i == f else ""}">{"".join(dot(d) for d in ds)}{n}</button>' for i, (n, ds) in enumerate(fl)], gap=8, wrap=True)
    return col(seg(['List', 'Timeline'], mode), chs, gap=10)


def hrow(label, sub, tone, icon, val, sel=False):
    return lr(label, span(sub, TXT[tone]), ic(icon, tone), val, chev=True, sel=sel)


H_NOW = glist('Now', hrow('Right knee', 'Rehab · stage 2 of 4', 'injury', 'injury', '21 Sep → now'))
H_LATER = glist('Coming up', hrow('Vacation', 'Full rest · 7 days', 'rest', 'off', '5–11 Oct'))
H_SEP = glist('September 2026', hrow('Unwell', 'Unwell · 4 days', 'illness', 'illness', '14–17 Sep'), hrow('Full rest', 'Full rest · 3 days', 'rest', 'off', '1–3 Sep'))
H_AUG = glist('August 2026', hrow('Active recovery', 'Active recovery · 5 days', 'active', 'active', '17–21 Aug'), hrow('Left wrist', 'Injury · 12 days', 'injury', 'injury', '3–14 Aug'))
H_FOOT = txt('Tap a period to edit it. Swipe left to delete. Sleep lives in Sleep details.', 't-m', 'padding: 0 4px')

P('P10-History-List.dc.html', 'History · List (scroll)', hl_screen('History', hist_controls(0), H_NOW, H_LATER, H_SEP, H_AUG, H_FOOT, h=900,
                                                                    bar_=sticky(btn('Log the past', 'pri', full=True))), h=900)


def tl_row(date, bars, label, sub=None, value=None, strong=False, rail='solid'):
    d = col(*[txt(x, 't-s num' if i == 0 else 't-m') for i, x in enumerate(date)], gap=0, style='width: 44px; align-items: flex-end')
    lanes = row(*bars, gap=3, style='width: 20px; justify-content: center; align-self: stretch')
    body = col(txt(label, 't-h3' if strong else 't-b'), txt(sub, 't-m') if sub else '', gap=2, style='flex: 1; min-width: 0')
    return row(d, lanes, body, span(value, 't-s c-mut num') if value else '', gap=12, align='center', style='min-height: 58px; padding: 6px 14px 6px 8px')


def tbar(tone, faded=False, h=46):
    return card(tone='dash' if faded else CARD[tone], pad=False, style=f'width: 7px; height: {h}px')


def railv():
    return card(tone='dash', pad=False, style='width: 1px; height: 46px')


TIMELINE = card(
    tl_row(('Later',), [railv()], span('Vacation', 't-b'), span('Full rest · 7 days', 'c-rest'), '5–11 Oct'),
    tl_row(('Now',), [tbar('injury', h=30)], 'Mon 28 Sep', None, '1 active', strong=True),
    tl_row(('28', 'Mon', '21', 'Mon'), [tbar('injury')], 'Right knee', span('Rehab · Reintroduce', 'c-injury'), '21 Sep →'),
    tl_row(('20', 'Sun'), [railv()], span('18–20 Sep · free', 'c-dim'), None, None),
    tl_row(('17', 'Thu', '14', 'Mon'), [tbar('illness')], 'Unwell', span('Unwell · 4 days', 'c-illness') + span(' · 15 Sep workout kept', 'c-dim'), '14–17 Sep'),
    tl_row(('3', 'Thu', '1', 'Tue'), [tbar('rest')], 'Full rest', span('Full rest · 3 days', 'c-rest'), '1–3 Sep'),
    row(lbl('August'), style='padding: 8px 14px'),
    tl_row(('21', 'Fri', '17', 'Mon'), [tbar('active')], 'Active recovery', span('Active recovery · 5 days', 'c-active'), '17–21 Aug'),
    tl_row(('14', 'Fri', '3', 'Mon'), [tbar('active', h=46), tbar('injury')], 'Left wrist', span('Injury · 12 days', 'c-injury'), '3–14 Aug'),
    tl_row(('Jun',), [dot('neutral')], span('Start of your log · 1 Jun 2026', 'c-dim'), None, None),
    pad=False, gap=0, style='padding: 6px 0')
P('P10-History-Timeline.dc.html', 'History · Timeline (scroll)', hl_screen('History', hist_controls(1), TIMELINE,
    txt('Newest on top. Two bars side by side = two things at once. To add or edit, use List.', 't-m', 'padding: 0 4px'),
    glist('Not on the timeline', lr('Sleep details & schedule', 'Sleep has its own history', tile('calendar', 'sleep'), chev=True)), h=1080), h=1080)

# ============================================================== Health states — row 1
P('P10-Health-Unwell.dc.html', 'Health · unwell now', hl_screen('Health', G_ILL, g_sleep(), g_start(ill_active=True), h=1130, mood='art'), h=1130, row_=1)
P('P10-Health-Rest.dc.html', 'Health · full rest running', hl_screen('Health', G_REST, g_sleep(), g_start(), h=1130, mood='rest'), h=1130, row_=1)
P('P10-Health-Active.dc.html', 'Health · active recovery running', hl_screen('Health', G_ACT, g_sleep(), g_start(), h=1130, mood='rest'), h=1130, row_=1)
P('P10-Health-Back.dc.html', 'Health · welcome back after illness', hl_screen('Health', G_BACK, g_sleep(), h=844), row_=1)
P('P10-Health-Clear.dc.html', 'Health · all clear, no nights yet', hl_screen('Health', G_CLEAR,
    glist('Sleep', lr('Last night', 'No nights logged yet', tile('moon', 'sleep'), chev=True), lr(span('Start sleep', 't-h3 c-sleep'), None, tile('clock', 'sleep')),
          lr('Sleep details & schedule', 'Nights, backfill a night, your usual schedule', tile('calendar', 'sleep'), chev=True)),
    g_start(), g_past(), glist('History', lr(span('See all', 't-h3 c-brass'), None, None, 'List · Timeline', chev=True)), h=1330), h=1330, row_=1)
P('P10-Health-Stage0.dc.html', 'Health · injury in clinician full rest', hl_screen('Health', G_FULLREST_INJ, g_sleep(), h=844, mood='bad'), row_=1)
P('P10-Health-Busy.dc.html', 'Health · Start sleep disabled (session running)', hl_screen('Health', G_CLEAR,
    glist('Sleep', lr('Last night', '23:40–06:52', tile('moon', 'sleep'), '7h 12m', chev=True),
          lr(span("Start sleep", "t-h3 c-dim"), None, tile("clock", "neutral")),
          lr('Sleep details & schedule', 'Nights, backfill a night, your usual schedule', tile('calendar', 'sleep'), chev=True)), h=844), row_=1)

P('P10-History-Empty.dc.html', 'History · nothing logged', hl_screen('History', hist_controls(0),
    txt('Nothing logged yet.', 't-m', 'padding: 0 4px'), h=844, bar_=sticky(btn('Log the past', 'pri', full=True))), row_=1)
P('P10-History-Filter.dc.html', 'History · filter Injury', hl_screen('History', hist_controls(0, 3), H_NOW,
    glist('August 2026', hrow('Left wrist', 'Injury · 12 days', 'injury', 'injury', '3–14 Aug')), H_FOOT, h=844, bar_=sticky(btn('Log the past', 'pri', full=True))), row_=1)

swiped = col(row(f'<div style="width: 358px; flex: none; margin-left: -170px">{lst(hrow("Unwell", "Unwell · 4 days", "illness", "illness", "14–17 Sep"))}</div>',
                  btn('Edit', 'sec', 'edit', sm=True, style='height: 56px; padding: 0 10px'), btn('Delete', 'dan', 'trash', sm=True, style='height: 56px; padding: 0 10px'), gap=6),
              style='overflow: hidden')
P('P10-History-Swipe.dc.html', 'History · row swiped (Edit / Delete)', hl_screen('History', hist_controls(0), H_NOW,
    col(lbl('September 2026'), swiped, lst(hrow('Full rest', 'Full rest · 3 days', 'rest', 'off', '1–3 Sep')), gap=8), H_FOOT, h=844,
    bar_=sticky(btn('Log the past', 'pri', full=True))), row_=1)

# ============================================================== more forms — row 1 (states of HealthForm)
P('P10-Form-Active.dc.html', 'Start · Active recovery (scroll)', hl_screen('Active recovery',
    period('Active recovery', 'active', 'active'),
    dates('Starts', 'Mon 28 Sep', 'Ends', 'Sun 4 Oct', 'active', None, ongoing_sub='No end date — end it whenever you’re back', footer='7 days, starting today. Your plan picks up on Mon 5 Oct.'),
    does('Lighter targets', 'On'), h=1000, mood='rest', bar_=sbar('Start active recovery', 'active')), h=1000, row_=1)

P('P10-Form-Schedule.dc.html', 'Start · Full rest planned ahead', hl_screen('Full rest',
    period(name='Vacation'),
    dates('Starts', 'Mon 5 Oct', 'Ends', 'Sun 11 Oct', 'rest', 'start',
          cal('October 2026', start=5, end=11, tone='rest', presets=presets(START_P, 'Next week', 'rest'), first=3, days=31, lead_prev=30, today=None),
          ongoing_sub='No end date — end it whenever you’re back', footer='7 days, starts in 7 days. Your plan picks up on Mon 12 Oct.'),
    does(), h=1260, mood='rest', bar_=sbar('Schedule full rest')), h=1260, row_=1)

P('P10-Form-Type.dc.html', 'Type row expanded', hl_screen('Full rest',
    period(expanded=True),
    dates('Starts', 'Mon 28 Sep', 'Ends', 'Sun 4 Oct', 'rest', None, ongoing_sub='No end date — end it whenever you’re back', footer='7 days, starting today. Your plan picks up on Mon 5 Oct.'),
    h=1000, mood='rest', bar_=sbar('Start full rest')), h=1000, row_=1)

P('P10-Form-Error.dc.html', 'Dates · error (end before start)', hl_screen('I took a break',
    period(),
    dates('Started', 'Fri 25 Sep', 'Ended', 'Wed 23 Sep', 'rest', None, footer='The end is before the start.', err=True),
    h=844, mood='rest', bar_=sbar('Save break', dis=True)), row_=1)

# ============================================================== past / overlap / conflict — row 2
P('P10-Form-Past.dc.html', 'Log the past · break with a workout inside (scroll)', hl_screen('I took a break',
    period(),
    dates('Started', 'Mon 21 Sep', 'Ended', 'Thu 24 Sep', 'rest', 'start',
          cal(start=21, end=24, tone='rest', presets=presets(PAST_P, None, 'rest'), gold=(15, 17, 22, 26), skipped=(22,), maxd=28),
          footer='4 days, already over. Gold dot = a workout you logged.'),
    glist('Overlap · 1 workout',
          lr('You trained on Tue 22 Sep', 'Chest 2 · 58 min', tile('dumbbell', 'brass')),
          lr('Keep that session', 'The rest skips 22 Sep', check=True, ctone='rest'),
          lr('Remove the session', 'Count 22 Sep as a rest day', check=False),
          footer='Full rest 21 Sep and 23–24 Sep. Your streak stays as it was.'),
    h=1300, mood='rest', bar_=sbar('Save break')), h=1300, row_=2)

P('P10-Form-Past-Remove.dc.html', 'Overlap · remove the session', hl_screen('I took a break',
    dates('Started', 'Mon 21 Sep', 'Ended', 'Thu 24 Sep', 'rest', None, footer='4 days, already over. Gold dot = a workout you logged.'),
    glist('Overlap · 1 workout',
          lr('You trained on Tue 22 Sep', 'Chest 2 · 58 min', tile('dumbbell', 'brass')),
          lr('Keep that session', 'The rest skips 22 Sep', check=False),
          lr('Remove the session', 'Count 22 Sep as a rest day', check=True, ctone='rest'),
          footer='The session is deleted when you save.'),
    h=844, mood='rest', bar_=sbar('Save break')), row_=2)

P('P10-Form-Conflict.dc.html', 'Overlap with another period', hl_screen('I was unwell',
    period('Unwell', 'illness', 'illness', ph='e.g. Flu', opts=()),
    dates('Started', 'Tue 15 Sep', 'Ended', 'Fri 18 Sep', 'illness', None, footer='4 days, already over. Gold dot = a workout you logged.'),
    glist('Overlap · Unwell',
          lr('Unwell', 'Already logged for 14–17 Sep', ic('illness')),
          lr('Merge into one period', 'One period, 14–18 Sep', check=True, ctone='illness'),
          lr('Replace those days', 'The other period is trimmed around these dates', check=False),
          footer='Periods can’t overlap — pick how to fix it, or change the dates.'),
    h=1110, bar_=sbar('Save illness', 'illness')), h=1110, row_=2)

INJ_PARTS = ['Shoulder', 'Elbow', 'Wrist', 'Neck', 'Lower back', 'Hip', 'Knee', 'Ankle']


def where(part='Knee', open_=True, side=1, type_rows=True):
    rs = [lr('Type', None, ic('injury'), 'Injury', 'injury', True, chev=type_rows)]
    rs.append(lr('Body part', None, None, part or '—', 'injury' if part else None, bool(part)))
    if open_:
        rs.append(panel(f'<div style="padding: 10px 12px">{row(*[tchip(p, "injury", p == part) for p in INJ_PARTS], gap=6, wrap=True)}</div>'))
    rs.append(li('Side', None, None, f'<div style="width: 210px">{seg(["Left", "Right", "Both"], side)}</div>'))
    return glist('Where', *rs)


def when(v='Mon 21 Sep', open_=True, d=21):
    rs = [lr('Happened on', None, None, v, 'injury' if open_ else None, open_)]
    if open_:
        rs.append(panel(cal(single=d, tone='injury', presets=presets(['Today', 'Yesterday', '2 days ago', 'Last week'], 'Last week', 'injury'), maxd=28)))
    return glist('When it happened', *rs)


def how(healed=False, new=True, open_cal=False, err=None):
    rs = [lr('Healed', 'Log it and pick the day it healed', None, 'Healed on Fri 25 Sep' if healed else 'Healed on …', 'injury' if healed else None, healed, check=healed, ctone='injury')]
    if healed and open_cal:
        rs.append(panel(cal(single=25, tone='injury', maxd=28)))
    rs.append(lr('Still healing', 'Continue into a rehab plan', check=not healed, ctone='injury'))
    if not healed and new:
        rs.append(lr('Rehab plan', 'Injury & Rehab — how it feels, stages, check-ins', chev=True))
    foot = err or ('Right knee, 21–25 Sep. It goes to your history — no plan needed.' if healed else 'Right knee since Mon 21 Sep. Next you’ll tell us how it feels today — the plan starts from there.')
    return glist('How is it now', *rs, footer=foot, err=bool(err))


P('P10-Form-Injury.dc.html', 'Log the past · I got hurt (scroll)', hl_screen('I got hurt', where(), when(), how(), h=1330, mood='bad',
                                                                         bar_=sbar('Continue to rehab plan', 'injury')), h=1330, row_=2)
P('P10-Form-Injury-Healed.dc.html', 'I got hurt · healed (scroll)', hl_screen('I got hurt', where(open_=False), when(open_=False), how(True, open_cal=True), h=1060, mood='bad',
                                                                            bar_=sbar('Save injury', 'injury')), h=1060, row_=2)
P('P10-Form-Injury-Empty.dc.html', 'I got hurt · no body part yet', hl_screen('I got hurt', where(None), when(open_=False), how(), h=920, mood='bad',
                                                                          bar_=sbar('Continue to rehab plan', 'injury', dis=True)), h=920, row_=2)


def del_group(label, body=None):
    rs = [lr(label, action='bad')]
    if body:
        rs.append(panel(col(txt(body, 't-s'), row(btn('Keep it', 'sec', style='flex: 1'), btn('Delete', 'dan', style='flex: 1'), gap=8), gap=12, style='padding: 12px 14px')))
    return glist(None, *rs)


P('P10-Form-Edit.dc.html', 'Edit period · delete open (scroll)', hl_screen('Edit period',
    period('Full rest', 'rest', 'off', name='', opts=('Full rest', 'Active recovery', 'Unwell')),
    dates('Started', 'Tue 1 Sep', 'Ended', 'Thu 3 Sep', 'rest', None, footer='3 days. Tap a date to open the calendar.'),
    glist('Overlap · 1 workout', lr('Wed 2 Sep · Legs', 'The rest skips this day', tile('dumbbell', 'brass'), 'Kept', chev=True)),
    del_group('Delete period', 'Delete Full rest (1–3 Sep)? Those 3 days go back to normal days. Your streak stays as it is and the 2 Sep workout stays logged.'),
    h=1000, mood='rest', bar_=sbar('Save changes')), h=1000, row_=2)

P('P10-Form-Edit-Removed.dc.html', 'Edit period · workout marked removed', hl_screen('Edit period',
    dates('Started', 'Tue 1 Sep', 'Ended', 'Thu 3 Sep', 'rest', None, footer='3 days. Tap a date to open the calendar.'),
    glist('Overlap · 1 workout', lr('Wed 2 Sep · Legs', 'Count 2 Sep as a rest day', tile('dumbbell', 'brass'), 'Removed', chev=True)),
    del_group('Delete period'), h=844, mood='rest', bar_=sbar('Save changes')), row_=2)

P('P10-Form-Edit-Injury.dc.html', 'Edit injury · delete open', hl_screen('Edit injury',
    where('Wrist', open_=False, side=0, type_rows=False), when('Mon 3 Aug', open_=False), how(True, new=False).replace('Healed on Fri 25 Sep', 'Healed on Fri 14 Aug').replace('Right knee, 21–25 Sep', 'Left wrist, 3–14 Aug'),
    del_group('Delete injury', 'Delete Left wrist? It leaves your history and stops shaping your training.'),
    h=1000, mood='bad', bar_=sbar('Save changes', 'injury')), h=1000, row_=2)

P('P10-Form-SaveError.dc.html', 'Save refused · overlap found on save', hl_screen('I took a break',
    dates('Started', 'Mon 14 Sep', 'Ended', 'Wed 16 Sep', 'rest', None, footer='3 days, already over. Gold dot = a workout you logged.'),
    txt('Periods can’t overlap — pick how to fix it, or change the dates.', 't-s c-bad', 'padding: 0 4px'),
    h=844, mood='rest', bar_=sbar('Save break')), row_=2)

# RecoveredSheet (F10) + End rest dialog
REC = sheet(None,
            txt('Come back from illness?', 't-h2'),
            txt('Unwell Fri 25 – Sun 27 Sep, 3 days. Your program picks up today with lighter targets.', 't-s'),
            lst(lr('Streak', None, tile('shield'), 'Kept'), lr('Program', None, tile('pause'), 'Resumes today')),
            h=420, close=False, footer=col(tbtn('Yes, I\'m recovered', 'illness', full=True), btn('Still unwell', 'sec', full=True), gap=8))
P('P10-Recovered.dc.html', 'I\'m recovered · sheet', hl_screen('Health', G_ILL, g_sleep(), overlay=REC), row_=2)

P('P10-EndRest.dc.html', 'End rest period · confirm', hl_screen('Health', G_REST, g_sleep(), mood='rest',
    overlay=dialog('End rest period?', 'It ends now — these days stop counting as rest.', 'End rest now', 'Cancel', top=300)), row_=3)
P('P10-History-Delete.dc.html', 'Delete period · confirm', hl_screen('History', hist_controls(0), H_NOW, H_SEP, H_FOOT,
    overlay=dialog('Delete period', 'Delete Unwell (14–17 Sep)? Those 4 days go back to normal days. Your streak stays as it is.', 'Delete', 'Keep it', top=300),
    bar_=sticky(btn('Log the past', 'pri', full=True))), row_=3)
P('P10-History-Delete-Injury.dc.html', 'Delete injury · confirm', hl_screen('History', hist_controls(0), H_NOW, H_AUG, H_FOOT,
    overlay=dialog('Delete injury', 'Delete Left wrist? It leaves your history and stops shaping your training.', 'Delete', 'Keep it', top=300),
    bar_=sticky(btn('Log the past', 'pri', full=True))), row_=3)

# ============================================================== Health web (≥720 px) — row 3
def web_top(title, sub):
    return row(ibtn('back', 'Back', 'fill'), col(txt(title, 't-h1'), txt(sub, 't-s'), gap=2, style='flex: 1'), tag('Today · Mon 28 Sep', 'neutral'), gap=14)


P_W = 1440
left = row(col(G_INJURY, G_COMING, g_sleep(), gap=18, style='flex: 1; min-width: 0'), col(g_start(), g_past(), gap=18, style='flex: 1; min-width: 0'), gap=18, align='flex-start')
right = col(row(txt('History', 't-h2'), sp(), btn('Open history', 'txt', style='height: 32px'), span(ico('chev', 16), 'c-brass')), hist_controls(1), TIMELINE,
            txt('Newest on top. Two bars side by side = two things at once. To add or edit, use List. Sleep lives in Sleep details.', 't-m'), gap=12)
board('P10-Health-Desktop.dc.html', 'Health · desktop', P_W, 1100,
      desktop(col(web_top('Health', 'Sleep, recovery, injury, unwell'),
                  row(card(left, style='flex: 1.5; min-width: 0; padding: 18px'), card(right, style='flex: 1; min-width: 0; padding: 18px'), gap=18, align='flex-start'), gap=20), 'today', P_W, 1100), row_=3)

form_panel = card(row(ic('off'), col(txt('Full rest', 't-h3'), txt('Starts today or later', 't-s'), gap=2, style='flex: 1'), ibtn('x', 'Close', 'fill', sm=True), gap=12),
                  row(col(dates('Starts', 'Mon 28 Sep', 'Ends', 'Sun 4 Oct', 'rest', 'end',
                                col(presets(START_P, 'Next 7 days', 'rest'), row(cal(start=28, end=31, tone='rest'), cal('October 2026', start=0, end=4, tone='rest', first=3, days=31, lead_prev=30, today=None), gap=8), gap=4),
                                ongoing_sub='No end date — end it whenever you’re back', footer='7 days, starting today. Your plan picks up on Mon 5 Oct.'), style='flex: 2.2; min-width: 0'),
                      col(period(fw=130), does(), gap=16, style='flex: 1; min-width: 0'), gap=16, align='flex-start'),
                  row(sp(), btn('Cancel', 'sec'), tbtn('Start full rest', 'rest', flex='none'), gap=8), tone='glass', gap=16, style='padding: 18px')
board('P10-Health-Desktop-Form.dc.html', 'Health · desktop · form in the right panel', P_W, 1100,
      desktop(col(web_top('Health', 'Sleep, recovery, injury, unwell'),
                  row(card(col(G_INJURY, g_sleep(), g_start(sel='off'), g_past(), gap=16), style='width: 360px; padding: 18px'), col(form_panel, style='flex: 1; min-width: 0'), gap=18, align='flex-start'), gap=20), 'today', P_W, 1100), row_=3)

board('P10-History-Desktop.dc.html', 'Health history · desktop list', P_W, 900,
      desktop(col(web_top('History', 'Rest, illness and injury periods'),
                  row(card(col(hist_controls(0), H_NOW, H_LATER, glist('September 2026', hrow('Unwell', 'Unwell · 4 days', 'illness', 'illness', '14–17 Sep', True), hrow('Full rest', 'Full rest · 3 days', 'rest', 'off', '1–3 Sep')),
                                txt('Click a period to edit it. Sleep lives in Sleep details.', 't-m'), gap=14), style='width: 520px; padding: 18px'),
                      col(card(row(ic('illness'), col(txt('Edit period', 't-h3'), txt('Unwell · Unwell · 14–17 Sep', 't-s'), gap=2, style='flex: 1'), ibtn('x', 'Close', 'fill', sm=True), gap=12),
                               row(col(dates('Started', 'Mon 14 Sep', 'Ended', 'Thu 17 Sep', 'illness', None, footer='4 days. Tap a date to open the calendar.'), style='flex: 1'),
                                   col(period('Unwell', 'illness', 'illness', ph='e.g. Flu', fw=150), del_group('Delete period'), gap=16, style='flex: 1'), gap=16, align='flex-start'),
                               row(sp(), btn('Cancel', 'sec'), tbtn('Save changes', 'illness', flex='none'), gap=8), tone='glass', gap=16, style='padding: 18px'), style='flex: 1'), gap=18, align='flex-start'), gap=20), 'today', P_W, 900), row_=3)

# ============================================================== anatomy (components/Muscle.tsx figures, via the kit's bodymap)
import json as _json
_MMAP = _json.load(open(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'musclemap.json')))
GVIEW, GREG = _MMAP['GROUP_VIEW'], _MMAP['GROUP_REGION']


def micon(m, h=26, paint=None, secondary=False):
    """MuscleIcon: the single muscle on its own cropped figure (view + region as the app picks them)"""
    if paint:
        return bodymap(GVIEW[m], paint={m: paint}, region=GREG[m], h=h)
    return bodymap(GVIEW[m], primary=() if secondary else (m,), secondary=(m,) if secondary else (), region=GREG[m], h=h)


def mchip(m, name, tail='', secondary=False, h=22):
    """MuscleChip / MuscleSetChip (mworked-chip-fig): figure + name"""
    return card(micon(m, h, secondary=secondary), span(name, 't-s' + (' c-mut' if secondary else '')), tail, pad=False, gap=6,
                style='flex-direction: row; align-items: center; padding: 3px 10px 3px 4px; flex: none')


# ============================================================== SLEEP (SleepView) — row 4 main, 5 states
# moon for Mon 28 Sep 2026 03:30 UTC (moon.ts): phase .55 · illum 97.5 % · waning gibbous · northern hemisphere -> lit limb on the LEFT
def moon(s=104, halo=False):
    """MoonGlyph.tsx drawn with its own paint: dark disc #1a2036, lit radial #f6f6f2 → #dee0e5 → #b2b5c2 (centre +.22R/−.18R),
    four maria #a7aab8 @ .32 mirrored to the lit side, limb shadow rgba(12,14,26,.42), optional halo rgba(195,206,244,.28)."""
    R = s * (0.4 if halo else 0.47); c = s / 2; D = 2 * R
    parts = []
    if halo:
        parts.append(abs_box(swatch('radial-gradient(circle closest-side, rgba(195,206,244,.28) 40%, rgba(195,206,244,0) 100%)', s, s / 2), 'left: 0; top: 0'))
    parts.append(abs_box(swatch('#1a2036', D, R), f'left: {c - R:.1f}px; top: {c - R:.1f}px'))
    lit = f'radial-gradient(circle {1.1 * R:.0f}px at {(R + .22 * R) / D * 100:.0f}% {(R - .18 * R) / D * 100:.0f}%, #f6f6f2 9%, #dee0e5 55%, #b2b5c2 100%)'
    parts.append(abs_box(swatch(lit, D, R), f'left: {c - R:.1f}px; top: {c - R:.1f}px'))
    for mx, my, mr in [(0.28, -0.18, 0.13), (0.1, 0.22, 0.09), (0.42, 0.06, 0.07), (0.2, -0.4, 0.055)]:
        x = c - mx * R; y = c + my * R; r = mr * R
        parts.append(abs_box(swatch('rgba(167,170,184,.32)', 2 * r, r), f'left: {x - r:.1f}px; top: {y - r:.1f}px'))
    parts.append(abs_box(swatch('radial-gradient(circle closest-side, rgba(12,14,26,0) 72%, rgba(12,14,26,.42) 100%)', D, R), f'left: {c - R:.1f}px; top: {c - R:.1f}px'))
    return f'<div style="position: relative; width: {s}px; height: {s}px; flex: none">{"".join(parts)}</div>'


MOONLINE = 'Waning gibbous · 97% · Kyiv tonight'


def zz():
    return col(span('z', 't-m c-dim', 'margin-left: 24px'), span('z', 't-s c-dim', 'margin-left: 12px'), span('z', 't-h3 c-dim'), gap=0)


def night_screen(overlay=''):
    return phone(brandbar(),
        row(ibtn('back', 'Back'), txt('Use the app', 't-s'), gap=2),
        sp(h=46),
        col(row(moon(104), zz(), gap=4, align='flex-start', justify='center'),
            sp(h=6), lbl('Asleep'), '<div class="t-hero num">6h 48m</div>', txt('since 23:40', 't-s'),
            row(span(ico('moon', 14, fill=True), 'c-dim'), txt('Night mode · everything is dimmed', 't-m'), gap=6),
            gap=10, style='align-items: center; text-align: center'),
        sp(h=150),
        txt(MOONLINE, 't-m', 'text-align: center'),
        btn('I’m awake — stop', 'sec', 'sun', full=True),
        btn('Discard sleep', 'txt', style='align-self: center; height: 32px'),
        tabs=None, mood='sky', overlay=overlay)


P('P10-Sleep-Night.dc.html', 'Sleep · night (live, night mode)', night_screen(), row_=4)


def wake(picker=False):
    pop = ''
    if picker:
        hrs = col(*[txt(f'{h:02d}', 't-h3 num' + (' c-brass' if h == 6 else ' c-dim'), 'text-align: center; padding: 6px 0') for h in range(3, 10)], gap=0, style='flex: 1')
        mins = col(*[txt(f'{m:02d}', 't-h3 num' + (' c-brass' if m == 30 else ' c-dim'), 'text-align: center; padding: 6px 0') for m in (15, 20, 25, 30, 35, 40, 45)], gap=0, style='flex: 1')
        pop = f'<div class="dialog" style="left: 16px; right: auto; top: 132px; width: 200px; padding: 8px 10px">{row(hrs, span(":", "t-h2"), mins, gap=6)}</div>'
    return phone(brandbar(), sp(h=40),
                 col(txt('Good morning', 't-h1'),
                     txt('The phone ran while you slept, so it won’t guess. When did you actually wake up?', 't-s', 'max-width: 300px; text-align: center'),
                     sp(h=10), '<div class="t-hero num">6h 50m</div>', txt('That’s about 23:40 → 06:30', 't-m'), gap=8, style='align-items: center; text-align: center'),
                 sp(h=18),
                 col(lbl('Woke at'), row(timein('06:30', focus=picker, label='Woke at'), ibtn('clock', 'Start', 'fill', sm=True), gap=8), gap=8),
                 sp(h=150),
                 btn('Log 6h 50m & wake up', 'pri', full=True, style='height: 54px'), btn('Cancel', 'txt', style='align-self: center'),
                 tabs=None, mood='sky', overlay=pop)


P('P10-Sleep-Wake.dc.html', 'Sleep · wake (honest wake time)', wake(), row_=4)


def qchips(on=None):
    return grid(*[card(txt(q, 't-s' + (' c-brass' if q == on else ''), 'text-align: center'), tone='glass' if q == on else '', pad=False, style='padding: 12px 6px')
                  for q in ('Restless', 'OK', 'Good')], cols=3, gap=8)


def quality(on=None):
    return col(row(txt('How did you sleep?', 't-s'), span('optional', 't-m'), gap=6, align='baseline'), qchips(on), gap=8)


def logged(nap=False):
    """.sleep-screen: centred, moonlit --s-* palette (btn-moon, sleep-q-chip), 52 px big number"""
    return phone(brandbar(), sp(h=36),
                 col(row(span(ico('check', 16, w=2.4), 'c-ok'), txt('Nap logged' if nap else 'Sleep logged', 't-s c-ok'), gap=6),
                     txt('Nap' if nap else 'Good morning, Mykola', 't-h1'),
                     sp(h=4), f'<div class="t-hero num">{"45m" if nap else "7h 12m"}</div>',
                     txt('14:00 → 14:45' if nap else '23:40 → 06:52', 't-s num'), gap=8, style='align-items: center; text-align: center'),
                 '' if nap else row(txt('Your goal 8h 0m', 't-s'), sp(), span('90% · right on rhythm', 't-s c-brass'), style='padding: 0 12px'),
                 sp(h=8), quality('Good' if not nap else None),
                 txt('It’s already feeding readiness, recovery and calories.', 't-m', 'text-align: center'),
                 sp(), btn('Done', 'pri', full=True, style='height: 54px'), tabs=None, mood='moon')


P('P10-Sleep-Logged.dc.html', 'Sleep · logged (good morning)', logged(), row_=4)


def vbars(vals, goal=None, labels=None, wk=False, h=100):
    """.slh-bar: #3d6488 (kit kcal), goal met / rhythm = --s-moon (kit rest), weekend = --color-accent (brass)"""
    mx = max(vals + ([goal] if goal else []))
    cols_ = []
    for i, v in enumerate(vals):
        met = goal is not None and v >= goal
        weekend = wk and i >= 5
        tone = 'brass' if weekend else ('rest' if (met or wk) else 'kcal')
        b = f'<div style="width: 100%">{bar(100, tone, int(v / mx * h))}</div>'
        lab = txt(labels[i], 't-m' + (' c-brass' if weekend else ''), 'text-align: center') if labels else ''
        cols_.append(col(b, lab, gap=4, style='flex: 1; justify-content: flex-end'))
    return row(*cols_, gap=5, align='flex-end', style=f'height: {h + (18 if labels else 0)}px')


def hub(empty=False, auto=(False, True)):
    body = []
    if empty:
        body.append(txt('Log a few nights and your rhythm shows up here.', 't-s'))
    else:
        body += [card(grid(col(txt('7h 12m', 't-num num c-brass'), txt('Avg · 14 nights', 't-s'), txt('+18m vs last block', 't-m c-ok'), gap=3),
                           col(txt('86%', 't-num num c-brass'), txt('Consistency', 't-s'), txt('Bed within ±30m', 't-m'), gap=3), cols=2, gap=14), tone='hero', style='padding: 16px'),
                 lbl('Last 14 nights'),
                 vbars([7.2, 6.8, 7.5, 8.1, 6.2, 7.0, 8.4, 7.3, 7.9, 6.5, 7.1, 8.2, 7.6, 8.0], goal=8, h=96),
                 txt('Goal met 5/14 nights ≥ 8h 0m', 't-m'),
                 lbl('Your rhythm by weekday'),
                 vbars([7.1, 7.0, 7.2, 6.9, 7.3, 8.4, 8.6], labels='MTWTFSS', wk=True, h=64)]
    body += [lst(li('Auto-dim at bedtime', 'Dim the app when your bedtime arrives.', None, toggle(auto[0])),
                 li('Auto-log', 'Start and end each night on its own, from your schedule or weekday pattern.', None, toggle(auto[1]))),
             row(btn('Add a past night', 'sec', 'plus', sm=True, style='flex: 1'), btn('Sleep schedule', 'sec', 'calendar', sm=True, style='flex: 1'), gap=8)]
    return phone(brandbar(), header('Sleep'), *body, tabs=None, h=900 if not empty else 844, mood='sleep')


P('P10-Sleep-Hub.dc.html', 'Sleep · hub', hub(), h=900, row_=4)


def daycards(sel=1):
    names = [('today', 28), ('Sun', 27), ('Sat', 26), ('Fri', 25), ('Thu', 24), ('Wed', 23), ('Tue', 22)]
    return row(*[card(txt(n, 't-m' + (' c-brass' if i == sel else ''), 'text-align: center'), txt(str(d), 't-h3 num', 'text-align: center'), tone='glass' if i == sel else '', pad=False, gap=2,
                      style='width: 46px; padding: 8px 0; flex: none') for i, (n, d) in enumerate(names)], gap=5, style='overflow: hidden')


def pct(hhmm):
    h, m = map(int, hhmm.split(':'))
    return round((h * 60 + m) / 1440 * 100, 1)


def trange(a, b, dur, focus=None, w=358):
    """TimelineRange (kit timerange): typeable start/end above the 24 h track; overnight wrap handled by the kit"""
    return timerange(a, b, dur, pct(a), pct(b), 'sleep', focus=focus, w=w)


def tbox(icon, v, tone='c-sleep'):
    return field(value=v, ph='hh:mm', icon=None, trail='').replace('<div class="field ">', f'<div class="field ">{span(ico(icon, 18, fill=True), tone)}')


def backfill(kind='Sleep', bedsel=1, wakesel=0, bed='23:20', woke='06:40', dur='7h 20m', invalid=False, mood='sleep', top_='', focus=None):
    return phone(brandbar(), top_, header('Add a past night'),
                 txt('Missed logging live? Add the night by hand — roughly is fine, you can fix it later.', 't-s'),
                 lbl('Type'), grid(*[card(txt(k, 't-s' + (' c-brass' if k == kind else ''), 'text-align: center'), tone='glass' if k == kind else '', pad=False, style='padding: 12px 6px') for k in ('Sleep', 'Nap')], cols=2, gap=8),
                 lbl('Fell asleep'), daycards(bedsel),
                 lbl('Woke up'), daycards(wakesel),
                 trange(bed, woke, '' if invalid else dur, focus),
                 card(lbl('Duration'), txt('Wake must be after bedtime.', 't-s c-bad') if invalid else f'<div class="t-num num">{dur}</div>', tone='quiet', gap=6),
                 quality(), btn('Save night', 'pri', 'check', full=True, dis=invalid),
                 tabs=None, h=1060, mood=mood)


P('P10-Sleep-Backfill.dc.html', 'Sleep · add a past night (scroll)', backfill(), h=1060, row_=4)


def schedule(same=True, mood='sleep', top_=''):
    if same:
        body = col(row(txt('Bedtime', 't-s'), sp(), txt('Woke', 't-s'), style='padding: 0 4px'), trange('23:00', '07:00', '8h 0m'), gap=6)
    else:
        rows_ = [('M', '23:10', '06:50', '7h 40m'), ('T', '23:05', '06:50', '7h 45m'), ('W', '23:20', '06:50', '7h 30m'), ('T', '23:15', '06:50', '7h 35m'),
                 ('F', '23:40', '07:10', '7h 30m'), ('S', '00:30', '08:40', '8h 10m'), ('S', '00:10', '08:30', '8h 20m')]
        body = lst(*[li(row(span(d, 't-h3', 'width: 18px'), timein(b, label='Bedtime'), span('→', 'c-dim'), timein(w, label='Woke'), gap=8), None, None, span(du, 't-s num')) for d, b, w, du in rows_])
    return phone(brandbar(), top_, header('Sleep schedule'),
                 txt('Give Spotter your usual nights and every day pre-fills itself.', 't-s'),
                 lst(li('Same most nights', None, None, toggle(same))), body, btn('Save schedule', 'pri', full=True),
                 tabs=None, h=844 if same else 1000, mood=mood)


P('P10-Sleep-Schedule.dc.html', 'Sleep · schedule (same most nights)', schedule(), row_=4)


def edit_night(kind='Sleep', overlay=''):
    return phone(brandbar(), header('Edit night'),
                 row(span(ico('moon' if kind == 'Sleep' else 'sun', 18, fill=True), 'c-sleep' if kind == 'Sleep' else 'c-brass'), txt('Night of Sun, Sep 27', 't-h3'), gap=8),
                 col(txt('Type', 't-s'), grid(*[card(txt(k, 't-s' + (' c-brass' if k == kind else ''), 'text-align: center'), tone='glass' if k == kind else '', pad=False, style='padding: 12px 6px') for k in ('Sleep', 'Nap')], cols=2, gap=8), gap=8),
                 row(lbl('Bedtime'), sp(), lbl('Woke'), style='padding: 0 4px'),
                 trange('23:40' if kind == 'Sleep' else '14:00', '06:52' if kind == 'Sleep' else '14:45', '7h 12m' if kind == 'Sleep' else '45m'),
                 card(lbl('Duration'), f'<div class="t-num num">{"7h 12m" if kind == "Sleep" else "45m"}</div>', tone='quiet', gap=6),
                 quality('Good'), btn('Save night', 'pri', 'check', full=True), btn('Delete night', 'txt', 'trash', style='align-self: center'),
                 tabs=None, h=900, mood='sleep', overlay=overlay)


P('P10-Sleep-Edit.dc.html', 'Sleep · edit a logged night', edit_night(), h=900, row_=4)

# sleep states — row 5
P('P10-Sleep-Discard.dc.html', 'Discard sleep · confirm (night)', night_screen(dialog('Discard sleep', 'Discard this sleep? It won’t be logged.', 'Discard sleep', 'Cancel', top=300)), row_=5)
P('P10-Sleep-Wake-Picker.dc.html', 'Wake · time picker open', wake(True), row_=5)
P('P10-Sleep-Logged-Nap.dc.html', 'Sleep · nap logged', logged(True), row_=5)
P('P10-Sleep-Hub-Empty.dc.html', 'Sleep · hub, no nights yet', hub(True, (False, False)), row_=5)
P('P10-Sleep-Backfill-Invalid.dc.html', 'Backfill · wake before bedtime', backfill(bedsel=0, wakesel=0, bed='23:20', woke='06:40', invalid=True), h=1060, row_=5)
P('P10-Sleep-Backfill-Nap.dc.html', 'Backfill · nap', backfill('Nap', 0, 0, '14:00', '14:45', '45m'), h=1060, row_=5)
P('P10-Sleep-Schedule-Weekday.dc.html', 'Schedule · by weekday', schedule(False), h=1000, row_=5)
P('P10-Sleep-Edit-Nap.dc.html', 'Edit night · nap', edit_night('Nap'), h=900, row_=5)
P('P10-Sleep-Edit-Delete.dc.html', 'Delete night · confirm', edit_night(overlay=dialog('Delete night', 'Delete this night? This can’t be undone.', 'Delete night', 'Cancel', top=320)), h=900, row_=5)
P('P10-Sleep-Schedule-Night.dc.html', 'Schedule · opened during a live night', schedule(mood='sky'), row_=5)
P('P10-Sleep-Backfill-Typing.dc.html', 'Backfill · typing the wake time (focused field)', backfill(woke='07:1', dur='7h 50m', focus='end'), h=1060, row_=5)
P('P10-Sleep-Backfill-Night.dc.html', 'Backfill · opened during a live night', backfill(mood='sky'), h=1060, row_=5)

# ============================================================== SleepAutomation — row 6
AUTO_DIM = phone(sp(h=90),
    col(moon(150, halo=True), row(ico('moon', 14, fill=True), txt('Full moon · 98% · Kyiv tonight', 't-s'), gap=8),
        sp(h=4), txt('It’s your bedtime', 't-h1'), txt('You usually turn in around 23:00. Start sleep when you’re ready.', 't-b c-mut', 'text-align: center; max-width: 300px'),
        gap=12, style='align-items: center; text-align: center'),
    sp(h=120),
    btn('Start sleep', 'pri', 'moon', full=True, style='height: 54px'),
    row(btn('Not yet — 15 min', 'sec', style='flex: 1'), btn('Keep app lit', 'txt'), gap=8),
    txt('Auto-dim follows your schedule — turn it off any time in Sleep settings.', 't-m', 'text-align: center'),
    tabs=None, mood='sky')
P('P10-Sleep-AutoDim.dc.html', 'Auto-dim · it’s your bedtime', AUTO_DIM, row_=6)

OFFER = (f'<div class="scrim"></div><div class="dialog" style="top: 70px">'
         + col(row(tag('Pattern learned', 'sleep', 'spark')), txt('Want Spotter to log sleep for you?', 't-h2'),
               txt('Your nights are steady enough to fill themselves — by weekday, not one flat figure. You just edit the odd night out.', 't-s'), gap=8)
         + card(row(tile('chart', 'sleep'), col(txt('Confidence · high', 't-h3'), txt('Weeknights vary under ±20 min · weekends run later.', 't-m'), gap=2, style='flex: 1'),
                    row(*[f'<div style="width: 5px">{bar(100 if i < 4 else 0, "sleep", 16)}</div>' for i in range(5)], gap=3), gap=10), style='padding: 10px 12px')
         + col(lbl('Your rhythm by weekday'), vbars([7.1, 7.0, 7.2, 6.9, 7.3, 8.4, 8.6], labels='MTWTFSS', wk=True, h=70), gap=8)
         + row(span(ico('edit', 16), 'c-dim'), txt('You can spot and fix any that were off — auto-logged nights are flagged ' + tag('auto', 'sleep'), 't-m'), gap=8, align='flex-start')
         + row(btn('Not now', 'sec', style='flex: 1'), btn('Turn on auto-log', 'pri', 'spark', style='flex: 1.4'), gap=8)
         + btn('Manage sleep', 'txt', style='align-self: center; height: 32px')
         + '</div>')
ATLAS_ = card(row(atlas_face(48), col(txt('Atlas', 't-h3'), txt('Pull is 30% under push for 3 weeks — add a row set on chest days.', 't-s'), gap=2, style='flex: 1'), gap=12), style='padding: 12px 14px')
PROG_ = card(row(col(lbl('Today · Chest 2', 'brass'), txt('Upper/Lower 4×', 't-h2'), txt('2 of 4 sessions', 't-s'), gap=3, style='flex: 1'), col(txt('50%', 't-h3 c-brass num'), bar(50), gap=6, style='width: 90px'), gap=10),
             week(['done', 'rest', 'done', 'none', 'plan', 'plan', 'rest'], today=0), tone='glass', gap=14)
P('P10-Sleep-AutoLog-Offer.dc.html', 'Auto-log offer · pattern learned', phone(brandbar(), ATLAS_, PROG_, tabs='today', mood='art', overlay=OFFER), row_=6)

SL_MISSING = card(row(tile('moon', 'sleep'), col(txt('Last night’s sleep is missing', 't-h3'), txt('You’ve logged 11 of the last 14 nights — want to fill this one? Roughly is fine.', 't-s'), gap=3, style='flex: 1'),
                      ibtn('x', 'Done', '', sm=True), gap=12, align='flex-start'), row(btn('Use my usual · 7h 30m', 'sec', sm=True), btn('Enter', 'txt', sm=True), gap=8), tone='sleep', style='width: 358px')
SL_AUTO = card(row(tile('moon', 'sleep'), col(row(txt('Last night 7h 12m · 23:40→06:52', 't-h3 num'), tag('auto', 'sleep', 'spark'), gap=8, wrap=True),
                                              txt('Filled from your Sunday pattern — adjust if it’s off, and the pattern learns from your fix.', 't-s'), gap=4, style='flex: 1'), gap=12, align='flex-start'),
               row(btn('Adjust times', 'sec', 'edit', sm=True), btn('Looks right', 'pri', sm=True), gap=8), tone='sleep', style='width: 358px')

sky_box = lambda inner, w=390: f'<div class="scr m-sky nt" style="width: {w}px; padding: 16px">{inner}</div>'
board('P10-Sleep-Parts.dc.html', 'Sleep parts · SleepHero, MoonGlyph (night)', 1600, 560, spec('Sleep parts',
    cap('SleepHero · asleep (every screen but Sleep, while a night is live)', sky_box(sleephero(False, dur='6h 48m'))),
    cap('SleepHero · paused (you are using the app)', sky_box(sleephero(True, dur='6h 48m'))),
    cap('MoonGlyph · 132 hero bg · 104 night · 150 + halo auto-dim', sky_box(row(moon(132), moon(104), moon(150, halo=True), gap=20, align='center'), 480)),
    w=1600, h=560), row_=6)
board('P10-Sleep-Today-Cards.dc.html', 'Sleep cards on Today · forgot to log, auto-filled', 900, 420, spec('Sleep cards on Today (SleepAutomation)',
    cap('SL-11 · forgot to log', SL_MISSING), cap('SL-10 · auto-filled night', SL_AUTO), w=900, h=420), row_=6)

# ============================================================== NIGHT MODE — the whole app while a night is live (row 7)
PROG = card(row(col(lbl('Today · Chest 2', 'brass'), txt('Upper/Lower 4×', 't-h2'), txt('2 of 4 sessions', 't-s'), gap=3, style='flex: 1'), col(txt('50%', 't-h3 c-brass num'), bar(50), gap=6, style='width: 90px'), gap=10),
            week(['done', 'rest', 'done', 'none', 'plan', 'plan', 'rest'], today=0), tone='glass', gap=14)
ATLAS = card(row(atlas_face(48), col(txt('Atlas', 't-h3'), txt('Pull is 30% under push for 3 weeks — add a row set on chest days.', 't-s'), gap=2, style='flex: 1'), gap=12), style='padding: 12px 14px')
P('P10-Night-Today.dc.html', 'Night · Today with SleepHero', night(row(lbl('Monday, September 28'), sp(), row(dot('ok'), txt('Synced', 't-m'), gap=6)), ATLAS, PROG,
    section('Body'), row(card(lbl('Readiness'), '<div class="t-d1 num">82<span class="t-m"> %</span></div>', bar(82, 'ok'), style='flex: 1'),
                         card(lbl('Sleep · last night'), '<div class="t-d1 num">7<span class="t-m"> h </span>12<span class="t-m"> m</span></div>', txt('23:40 → 06:52', 't-m'), style='flex: 1'), gap=12)), row_=7)

OV_TILE = lambda k, icon, tt, ts, big=None: card(row(lbl(k), sp(), span(ico(icon, 18), 'c-dim')), f'<div class="t-h1 num">{big}</div>' if big else txt(tt, 't-h3'), txt(ts, 't-m'), gap=6)
P('P10-Night-Overview.dc.html', 'Night · Overview', night(
    grid(card(row(lbl('Progress'), sp(), span(ico('progress', 18), 'c-dim')), '<div class="t-h1 num">6.2<span class="t-m"> t</span></div>', txt('Volume this week', 't-m'),
              bars([4, 5, 4.5, 6, 5.2, 5.8, 6.4, 6.2], 150, 50, 'brass', 7), gap=6, style='grid-row: span 2'),
         OV_TILE('Atlas', 'progress', 'All clear', ''), OV_TILE('Records', 'trophy', 'Est. 1RM', 'Bench press 117 kg'), cols=2, gap=10),
    card(row(lbl('Program · Upper/Lower 4×'), sp(), span(ico('list', 18), 'c-dim')),
         grid(*[card(txt(d, 't-m', 'text-align: center'), txt(n, 't-s', 'text-align: center'), tone='glass' if i == 0 else '', pad=False, gap=2, style='padding: 6px 0')
                for i, (d, n) in enumerate([('Mon', 'Upper'), ('Tue', 'Rest'), ('Wed', 'Lower'), ('Thu', 'Rest'), ('Fri', 'Upper'), ('Sat', 'Lower'), ('Sun', 'Rest')])], cols=7, gap=4),
         txt('Today: Upper', 't-m'), gap=10),
    grid(OV_TILE('Goals', 'target', 'V-Taper', '4 muscles in focus'), OV_TILE('Playbook', 'layers', '3 plays', 'From your sessions'), cols=2, gap=10),
    lst(li('Exercises', '873 in the library · 4 yours', tile('dumbbell'), chev=True)), tabs='overview'), row_=7)

GY_ROW = lambda n, m, v=0: li(n, m, house(56, 56, 12), chev=True)
P('P10-Night-Gyms.dc.html', 'Night · Gyms', night(txt('Gyms', 't-h1'), lbl('My gyms'), lst(GY_ROW('Iron Temple', '0.2 km · Khreshchatyk St 22'), GY_ROW('Home gym', '8.4 km · Obolon')),
                                                  search('Search for a gym'), lbl('Nearby'), lst(GY_ROW('Sportlife Podil', '3.1 km · Naberezhno-Khreshchatytska 9'), GY_ROW('Atlet Fitness', '0.6 km · Khreshchatyk St 12')), tabs='gyms'), row_=7)
P('P10-Night-Health.dc.html', 'Night · Health (Asleep since)', phone(brandbar(), sleephero(True, dur='6h 48m'), header('Health'), G_CLEAR, g_sleep(live=True), g_start(), tabs=None, h=920, mood='sky'), h=920, row_=7)
P('P10-Night-Sheet.dc.html', 'Night · a sheet (Which gym?)', night(ATLAS, PROG, tabs=None, overlay=sheet('Where are you training?',
    search('Search for a gym'),
    lst(li('Iron Temple', row(txt("You're here", 't-m'), dot('ok'), txt('06:00–23:00', 't-m'), gap=6), house(44, 44, 10, 14), tag('Suggested')),
        li('Home gym', '8.4 km', house(44, 44, 10, 14))),
    lbl('Gyms nearby'), lst(li('Atlet Fitness', '0.6 km · Khreshchatyk St 12', house(44, 44, 10, 14), tag('Add', 'neutral'))),
    lst(li('Without a gym', None, tile('pin'))), h=560, close=False)), row_=7)
P('P10-Night-Dialog.dc.html', 'Night · a dialog', night(ATLAS, PROG, tabs=None, overlay=dialog('End rest period?', 'It ends now — these days stop counting as rest.', 'End rest now', 'Cancel', top=320)), row_=7)
P('P10-Night-Paused.dc.html', 'Night · SleepHero paused over Today', night(row(lbl('Monday, September 28'), sp(), row(dot('ok'), txt('Synced', 't-m'), gap=6)), ATLAS, PROG, paused=True), row_=7)
board('P10-Night-Desktop.dc.html', 'Night · desktop', 1440, 900, desktop(col(f'<div style="max-width: 560px">{sleephero(dur="6h 48m")}</div>', row(lbl('Monday, September 28'), sp()),
      row(col(ATLAS, PROG, row(card(lbl('Readiness'), '<div class="t-d1 num">82<span class="t-m"> %</span></div>', bar(82, 'ok'), style='flex: 1'),
                            card(lbl('Sleep · last night'), '<div class="t-d1 num">7<span class="t-m"> h </span>12<span class="t-m"> m</span></div>', txt('23:40 → 06:52', 't-m'), style='flex: 1'), gap=12), gap=14, style='flex: 1'),
          col(g_sleep(True), g_start(), gap=14, style='flex: 1'), gap=18, align='flex-start'), gap=18), 'today', 1440, 900, mood='sky'), row_=7)

# ============================================================== Readiness, MuscleStatePanel, FixSheet — row 8
RC = {'recovering': 'danger', 'nearly': 'brass', 'ready': 'ok', 'stale': 'kcal'}   # recovery.ts READINESS_COLOR


def rd_chip(m, name, pct, st):
    return card(micon(m, 26), span(name, 't-s', 'flex: 1'), span(f'{pct}%', f't-s num {TXT[RC[st]]}'), pad=False, gap=6,
                style='flex-direction: row; align-items: center; padding: 6px 8px 6px 4px')


READY_NUDGE = card(row(tile('pulse', 'ok'), lbl('Readiness', 'ok'), gap=10), txt('Ready to train: Chest · Back · Biceps.', 't-h3'),
                   txt('5 ready · 2 recovering', 't-s num'),
                   grid(rd_chip('quads', 'Quads', 41, 'recovering'), rd_chip('glutes', 'Glutes', 78, 'nearly'), rd_chip('chest', 'Chest', 100, 'ready'), cols=3, gap=6),
                   btn('Full read →', 'sec', sm=True, style='align-self: flex-start'), gap=8, style='width: 358px')

RD_ROWS = [('quads', 'Quads', '~2d', 41, 'recovering'), ('hamstrings', 'Hamstrings', '~1d', 63, 'recovering'), ('glutes', 'Glutes', '~1d', 88, 'nearly'),
           ('calves', 'Calves', 'behind', 100, 'stale'), ('chest', 'Chest', 'ready', 100, 'ready'), ('back', 'Back', 'ready', 100, 'ready'), ('biceps', 'Biceps', 'ready', 100, 'ready')]


def rd_row(m, name, days, pct, st):
    return li(name, None, micon(m, 34), row(span(days, 't-s num c-dim'), f'<div style="width: 60px">{bar(pct, RC[st], 5)}</div>',
                                               span(f'{pct}%', f't-s num {TXT[RC[st]]}', 'width: 40px; text-align: right'), gap=8))


RD_PAINT = {m: RC[st] for m, _, _, _, st in RD_ROWS}
RD_PAINT.update({'triceps': 'ok', 'shoulders': 'ok', 'lats': 'ok', 'core': 'brass', 'forearms': 'ok'})
VERDICT = card(row(span(ico('pulse', 18), 'c-ok'), col(txt('Ready to train: Chest · Back · Biceps.', 't-h3'), txt('Still recovering: Quads · Hamstrings.', 't-s'), gap=2), gap=10, align='flex-start'))
RECO = row(span(ico('check', 18), 'c-ok'), txt('Good day for Chest · Back · Biceps.', 't-s'), gap=8)
LENS_LIST = col(RECO, lst(*[rd_row(*r) for r in RD_ROWS]), VERDICT, gap=10, style='width: 358px')
LEGEND = row(*[row(dot(t_), txt(s_, 't-m'), gap=5) for s_, t_ in RC.items()], gap=14, justify='center')
LENS_MAP = col(RECO, card(bodypair(paint=RD_PAINT, h=230, gap=18), style='padding: 14px'), LEGEND, VERDICT, gap=10, style='width: 358px')
board('P10-Readiness.dc.html', 'Readiness · nudge and lens', 1600, 1180, spec('Readiness (components/Readiness.tsx)',
    cap('Nudge on Today · mixed', READY_NUDGE),
    cap('Nudge titles (fresh · cooked · mixed without names)', col(txt('Everything\'s ready — train what your plan calls for.', 't-s'), txt('A lot is still recovering — an easy day reads better.', 't-s'), txt('Some muscles are ready, some are still recovering.', 't-s'), gap=8, style='width: 300px')),
    cap('Lens · List (Progress › Volume › Readiness)', LENS_LIST),
    cap('Lens · Map (mobile map view)', LENS_MAP),
    cap('Lens · cold start', card(txt('Log a few sessions and the readiness read fills in.', 't-s'), tone='dash', style='width: 300px')),
    w=1600, h=1180), row_=8)

MS_STATE = {'recovering': ('danger', 'Worked hard recently — more sets now mostly add fatigue.'), 'nearly': ('brass', 'Almost recovered — fine for moderate work.'),
            'ready': ('ok', 'Recovered — ready for hard sets.'), 'stale': ('kcal', 'Not trained lately — ease back in.')}


def ms_state(st):
    t_, note = MS_STATE[st]
    return row(dot(t_), col(txt(st, f't-h3 {TXT[t_]}'), txt(note, 't-s'), gap=2), gap=10, align='flex-start')


def muscle_drawer(st='recovering', today='4.0', worth='48%', week_='13', fat=('Moderate', 'c-brass'), last='today'):
    tiles_ = grid(*[col(txt(v, f't-num num {c}'), txt(l_, 't-m'), gap=2) for v, l_, c in
                    [(today, 'Hard sets today', ''), (worth, 'Next set is worth', ''), (week_, 'Sets this week · target 10–20', ''), (fat[0], 'Weekly fatigue', fat[1])]], cols=2, gap=14)
    panel_ = col(ms_state(st), card(tiles_, tone='quiet'),
                 row(txt('Last hard work', 't-s'), sp(), txt(last, 't-s')),
                 txt('The dot on the muscle chip shows this state: red recovering, brass nearly, green ready.', 't-m'), gap=12)
    return sheet(None, txt('Chest', 't-h2'), bodypair(primary=('chest',), h=170, gap=22), panel_, h=720, close=False, footer=btn('Chest history', 'pri', full=True))


SESS_BG = [header('Chest 2', sub='Iron Temple · 42:18'), card(txt('Bench press', 't-h3'), row(mchip('chest', 'Chest', span('4', 't-m')), mchip('triceps', 'Triceps', span('2', 't-m'), True), gap=6))]
P('P10-MuscleState.dc.html', 'Muscle drawer · state right now (live session)', phone(*SESS_BG, tabs=None, overlay=muscle_drawer()), row_=8)
board('P10-MuscleState-States.dc.html', 'Muscle state · every read', 1600, 520, spec('MuscleStatePanel · state header per readiness read, fatigue levels, last hard work',
    *[cap(k, card(ms_state(k), style='width: 330px')) for k in MS_STATE],
    cap('Weekly fatigue (FATIGUE_COLOR)', row(*[col(txt(v, f't-h3 {c}'), gap=0) for v, c in [('Fresh', 'c-ok'), ('Moderate', 'c-brass'), ('High', 'c-brass'), ('Fried', 'c-bad'), ('—', 'c-dim')]], gap=18)),
    cap('Last hard work', row(*[txt(v, 't-s') for v in ('today', 'yesterday', '3 days ago', 'not lately')], gap=18)),
    w=1600, h=520), row_=8)


def fix_card(name, scheme, prim, sec, avail, atone, aicon, added=False, add='Add to session'):
    return card(row(txt(name + ' →', 't-h3', 'flex: 1'), span(scheme, 't-s num')),
                row(mchip(prim[0], prim[1]), *[mchip(m, n, secondary=True) for m, n in sec], gap=6, wrap=True),
                row(span(ico(aicon, 16), TXT[atone]), txt(avail, f't-s {TXT[atone]}'), gap=6),
                btn(('✓ ' + add) if added else add, 'ok' if added else 'sec', sm=True, full=True, dis=added), tone='ok' if added else '', gap=8)


FIX = sheet(None, txt('Add Hamstrings work', 't-h2'), txt('Exercises that hit it — ready to add', 't-s'),
            fix_card('Romanian deadlift', '3 × 8–10', ('hamstrings', 'Hamstrings'), [('glutes', 'Glutes'), ('lower_back', 'Lower back')], 'Available at Iron Temple', 'ok', 'check'),
            fix_card('Seated leg curl', '3 × 10–12', ('hamstrings', 'Hamstrings'), [('calves', 'Calves')], 'Needs Leg curl machine — not at your gym', 'brass', 'warn'),
            fix_card('Nordic curl', '3 × 5–8', ('hamstrings', 'Hamstrings'), [('glutes', 'Glutes')], 'Bodyweight — anywhere', 'neutral', 'body', added=True, add='Added'),
            h=740, close=False)
PROG_BG = [brandbar(), header('Progress'), card(txt('Weak points', 't-h3'), txt('Hamstrings under target for 3 weeks', 't-s'))]
P('P10-FixSheet.dc.html', 'Fix sheet · add lagging-muscle work', phone(*PROG_BG, tabs=None, overlay=FIX), row_=8)
FIX2 = sheet(None, txt('Add Hamstrings work', 't-h2'), txt('Exercises that hit it — ready to add', 't-s'),
             txt('Link a gym to see what you can do where you train.', 't-s c-brass'),
             fix_card('Romanian deadlift', '3 × 8–10', ('hamstrings', 'Hamstrings'), [('glutes', 'Glutes'), ('lower_back', 'Lower back')], 'Barbell', 'neutral', 'dumbbell', add='Start session + add'),
             fix_card('Nordic curl', '3 × 5–8', ('hamstrings', 'Hamstrings'), [('glutes', 'Glutes')], 'Bodyweight — anywhere', 'neutral', 'body', added=True, add='Added — session started'),
             h=620, close=False)
P('P10-FixSheet-NoGym.dc.html', 'Fix sheet · no gym, no session', phone(*PROG_BG, tabs=None, overlay=FIX2), row_=8)
P('P10-FixSheet-None.dc.html', 'Fix sheet · no matches', phone(*PROG_BG, tabs=None, overlay=sheet(None, txt('Add Neck work', 't-h2'), txt('Exercises that hit it — ready to add', 't-s'),
                                                                                                txt('No matching exercises found.', 't-s'), h=260, close=False)), row_=8)

# ============================================================== INJURY & REHAB (InjuryView .rx: --dgr = --color-danger) — rows 9–11
def rx(title, *content, h=844, lead='back', right='', overlay='', mood='bad', cta=None):
    top = row(ibtn(lead, 'Back'), txt(title, 't-h3', 'flex: 1'), right, gap=6)
    ov = (abs_box(col(*cta, gap=10), 'left: 16px; right: 16px; bottom: 18px') if cta else '') + overlay
    return phone(brandbar(), top, *content, sp(h=150 if cta else 10), tabs=None, h=h, mood=mood, overlay=ov)


def stepper3(active=1):
    def s(n, label):
        state = 'on' if n == active else ('done' if n < active else '')
        mark = span(ico('check', 14, w=2.4), 'c-bad') if state == 'done' else span(str(n), 't-s num' + (' c-bad' if state else ' c-dim'))
        return row(card(mark, tone='bad' if state else '', pad=False, style='width: 26px; height: 26px; align-items: center; justify-content: center'),
                   txt(label, 't-s' + (' c-bad' if state == 'on' else ' c-dim')), gap=6)
    ln = '<div class="hl" style="flex: 1"></div>'
    return row(s(1, 'Where'), ln, s(2, 'How'), ln, s(3, 'Plan'), gap=8)


MUS_KNEE = [('quads', 'Quads'), ('hamstrings', 'Hamstrings'), ('calves', 'Calves'), ('adductors', 'Adductors')]


def where_screen(part='Knee'):
    parts_ = [stepper3(1), txt('Pick the sore spot — no anatomy degree needed.', 't-s'),
              row(*[tchip(p, 'danger', p == part) if p != part else card(row(span(ico('target', 14), 'c-bad'), span(p, 't-s c-bad'), gap=6), tone='bad', pad=False, style='height: 34px; padding: 0 14px; justify-content: center')
                    for p in INJ_PARTS], gap=8, wrap=True)]
    if part:
        mus = [m for m, _ in MUS_KNEE]
        parts_ += [seg(['Left', 'Right', 'Both'], 1),
                   card(row(col(txt('Good to know', 't-h3 c-bad'), txt('This area loads these muscles — we’ll ease them back together:', 't-s'),
                                row(*[tag(n, 'danger', 'check') for _, n in MUS_KNEE], gap=6, wrap=True), gap=8, style='flex: 1'),
                            row(bodymap('front', paint={m: 'danger' for m in mus}, region='lower', h=130), bodymap('back', paint={m: 'danger' for m in mus}, region='lower', h=130), gap=2), gap=10, align='flex-start'),
                        tone='bad')]
    parts_.append(btn('Not a spot? Surgery, illness, general →', 'txt', style='align-self: flex-start'))
    return rx('Where does it hurt?', *parts_, lead='x', cta=[btn('Next: how it feels →', 'dan', full=True, dis=not part, style='height: 54px')], h=844)


P('P10-Injury-Where.dc.html', 'Rehab setup · where', where_screen(), row_=9)

GR = [('After surgery', 'Cleared to move, building back slowly', 'plus', True), ('After illness', 'Getting my capacity back', 'flame', False),
      ('Long break / detrained', 'Away a while — easing in', 'timer', False), ('Just being cautious', 'Nothing wrong — going gently', 'shield', False)]
P('P10-Injury-General.dc.html', 'Rehab setup · general reason', rx('What’s going on?', stepper3(1),
    txt('Not one sore spot? Pick what fits — we’ll ease your whole body back, no muscle-picking needed.', 't-s'),
    col(*[card(row(tile(i, 'danger' if on else 'neutral'), col(txt(n, 't-h3' + (' c-bad' if on else '')), txt(d, 't-s'), gap=2, style='flex: 1'),
                   span(ico('check', 18, w=2.2), 'c-bad') if on else '', gap=12), tone='bad' if on else '', style='padding: 12px 14px') for n, d, i, on in GR], gap=9),
    cta=[btn('Continue →', 'dan', full=True, style='height: 54px')]), row_=9)

FEEL = [('Can’t load it', 'Hurts to put weight through it', 'Protect', False, False, 'x'), ('Sore but usable', 'Works, but I feel it', 'Reintroduce', True, False, 'target'),
        ('Almost normal', 'Only at heavy loads', 'Rebuild', False, True, 'check')]


def feel_screen(prefill=False):
    return rx('Where does it hurt?', stepper3(2), txt('How does it feel today?', 't-h1'),
              txt('This sets your starting stage — you move on from there by feel.', 't-s'),
              col(*[card(row(tile(ic_, 'ok' if ok else 'danger'), col(txt(n, 't-h3' + (' c-bad' if on else '')), txt(s_, 't-s'), gap=2, style='flex: 1'),
                             tag(st, 'danger' if (on or not ok) else 'ok'), gap=12), tone='bad' if on else '', style='padding: 14px') for n, s_, st, on, ok, ic_ in FEEL], gap=11),
              cta=[btn('Next →', 'dan', full=True, style='height: 54px')])


P('P10-Injury-Feel.dc.html', 'Rehab setup · how it feels (also the entry from Health › Still healing)', feel_screen(), row_=9)


def clinician(yes=False):
    opts = col(card(row(radio(not yes), col(txt('No / not sure', 't-h3'), txt('I’ll just go by feel from now', 't-s'), gap=2, style='flex: 1'), gap=11), style='padding: 12px 14px'),
               card(row(radio(yes), col(txt('Yes — a fixed no-load period', 't-h3' + (' c-rest' if yes else '')), txt('We’ll hold all training until it’s up', 't-s'), gap=2, style='flex: 1'), gap=11, align='flex-start'),
                    tone='rest' if yes else '', style='padding: 12px 14px'), gap=9)
    extra = []
    if yes:
        extra = [lbl('How long, total?', 'rest'), stepper('6', 'Weeks'), seg(['Days', 'Weeks', 'Months'], 1),
                 card(row(span(ico('warn', 16), 'c-brass'), txt('This is the one part that follows the calendar — your clinician’s order. Follow their advice first; everything after still moves by how you feel.', 't-s'), gap=8, align='flex-start'), tone='quiet')]
    return rx('Recovery timeframe', txt('Did a doctor or physio tell you how long to fully rest before loading it again?', 't-s'), opts, *extra,
              cta=[tbtn('See my plan →', 'rest', full=True) if yes else btn('See my plan →', 'dan', full=True, style='height: 54px')], h=940 if yes else 844, mood='rest' if yes else 'bad')


P('P10-Injury-Clinician.dc.html', 'Rehab setup · timeframe · no', clinician(False), row_=9)
P('P10-Injury-Clinician-Yes.dc.html', 'Rehab setup · timeframe · fixed no-load', clinician(True), h=940, row_=9)
P('P10-Injury-Where-Empty.dc.html', 'Rehab setup · nothing picked yet', where_screen(None), row_=9)

STAGES = ['Protect', 'Reintroduce', 'Rebuild', 'Return to full']


def stages(cur=1, full_rest=False, left='12 days left'):
    """.slist — the current stage is THE thing on this screen (e1); the others shrink to one-line rows"""
    out = []
    if full_rest:
        out.append(card(row(tile('moon', 'rest', lg=True), col(row(txt('Full rest', 't-num c-rest'), tag('Now', 'rest'), gap=10), txt(left, 't-s c-rest'), gap=4), gap=14), tone='rest', style='padding: 16px'))
    rows_ = []
    for i, s_ in enumerate(STAGES):
        st = '' if full_rest else ('done' if i < cur else 'now' if i == cur else '')
        if st == 'now':
            if rows_:
                out.append(lst(*rows_)); rows_ = []
            out.append(card(row(col(lbl(f'Stage {i + 1} of 4 · Now', 'danger'), txt(s_, 't-num c-bad'), gap=6, style='flex: 1'), tile('target', 'danger', lg=True), gap=12),
                            row(*[f'<div style="flex: 1">{bar(100 if k <= cur else 0, "danger", 5)}</div>' for k in range(4)], gap=5), tone='bad', gap=14, style='padding: 16px'))
            continue
        mark = tile('check', 'ok') if st == 'done' else f'<span class="tile" style="width: 36px">{span(str(i + 1), "t-s num c-dim")}</span>'
        rows_.append(li(txt(s_, 't-b' + ('' if st == 'done' else ' c-mut')), None, mark, span('Cleared' if st == 'done' else 'By feel', 't-m')))
    if rows_:
        out.append(lst(*rows_))
    return col(*out, gap=10)


def plan(cur=1, full_rest=False, ramp=False, overlay='', h=844, title='Knee · rehab plan'):
    note = row(span(ico('info' if full_rest else 'shield', 16), 'c-rest' if full_rest else 'c-bad'),
               txt('Full rest until your clinician’s date — then the by-feel stages begin.' if full_rest else 'You climb the stages by how it feels, not by a date. Estimates are only a guide.', 't-m'), gap=8, align='flex-start')
    extra = []
    if ramp:
        cells = []
        for p_, k_, t_ in [(60, 'done', 'ok'), (75, 'now', 'danger'), (90, 'lock', 'neutral'), (100, 'lock', 'neutral')]:
            top_ = span(ico('check', 14, w=2.4), 'c-ok') if k_ == 'done' else (span('Now', 't-m c-bad') if k_ == 'now' else span(ico('lock', 14), 'c-dim'))
            blk = card(tone='dash', pad=False, style=f'height: {int(p_ * 1.1)}px; width: 100%') if k_ == 'lock' else f'<div style="width: 100%">{bar(100, t_, int(p_ * 1.1))}</div>'
            cells.append(col(top_, blk, span(f'{p_}%', 't-m' + (' c-bad' if k_ == 'now' else '')), gap=6, style='flex: 1; align-items: center; justify-content: flex-end'))
        extra = [lbl('Weight ramp · working set'), row(*cells, gap=10, align='flex-end', style='height: 150px'),
                 row(span(ico('up', 16), 'c-bad'), txt('Graded load back to your old working set — each step unlocks only after a good check-in.', 't-m'), gap=8, align='flex-start')]
    cta = ([btn('Log a check-in', 'dan', 'pulse', full=True, style='height: 54px')] if (not full_rest and cur > 0) else []) + [btn('Manage', 'sec', 'more', full=True)]
    return rx(title, note, lbl('Your stages'), stages(cur, full_rest), *extra, right=ibtn('more', 'Manage'),
              cta=cta, overlay=overlay, h=h, mood='rest' if full_rest else 'bad')


P('P10-Injury-Plan.dc.html', 'Rehab plan · Reintroduce', plan(1), row_=10)
P('P10-Injury-Plan-Rebuild.dc.html', 'Rehab plan · Rebuild with weight ramp (scroll)', plan(2, ramp=True, h=1000), h=1000, row_=10)
P('P10-Injury-Plan-Protect.dc.html', 'Rehab plan · Protect (no check-in yet)', plan(0), row_=10)
P('P10-Injury-Plan-FullRest.dc.html', 'Rehab plan · clinician full rest', plan(0, True), row_=10)
P('P10-Injury-Plan-General.dc.html', 'Rehab plan · general reason (After surgery)', plan(1, title='After surgery · rehab plan'), row_=10)

CI = sheet(None, row(span(ico('pulse', 16), 'c-bad'), lbl('Quick check', 'danger'), gap=6), txt('How did it feel?', 't-h2'), txt('During those sets — be honest, it steers your comeback.', 't-s'),
           col(*[card(row(dot(t_), col(txt(a, 't-h3'), txt(b, 't-s'), gap=2, style='flex: 1'), span(c, f't-s {TXT[t_]}'), gap=12), tone=CARD[t_], style='padding: 14px')
                 for a, b, c, t_ in [('Felt fine', 'No pain, or ≤2/10 and gone fast', '↑ Progress', 'ok'), ('A little sore', 'Nagged a bit, faded within the day', '→ Hold', 'brass'),
                                     ('It hurt', 'Sharp, or still aching hours later', '↓ Step back', 'danger')]], gap=9),
           row(span(ico('info', 16), 'c-dim'), txt('Pain ≤2–3/10 during and gone within 24h → you move up. Sharp or lingering → we ease you back a stage.', 't-m'), gap=8, align='flex-start'),
           h=560, close=False)
P('P10-Injury-Checkin.dc.html', 'Check-in · how did it feel?', plan(1, overlay=CI), row_=10)


def result(kind):
    icon, tone, title, body = {'adv': ('up', 'ok', 'Green light — nice.', 'That area handled it well. You’re moving up a stage.'),
                               'hold': ('pause', 'brass', 'We’ll hold here.', 'A little soreness that fades is normal — no need to push. One more good session and the next stage opens.'),
                               'back': ('down', 'danger', 'Let’s ease back a step.', 'Sharp or lingering pain means we went a touch too fast — not a setback, just information.')}[kind]
    if kind == 'hold':
        mid = card(txt('Staying at · Reintroduce', 't-h3 c-brass'), style='padding: 12px 16px')
        dots_i = 1
    elif kind == 'adv':
        mid = card(row(span('Reintroduce', 't-s c-dim'), span(ico('chev', 16), 'c-ok'), span('Rebuild', 't-h3 c-ok'), gap=10, justify='center'), style='padding: 12px 16px')
        dots_i = 2
    else:
        mid = card(row(span('Reintroduce', 't-s c-bad'), span(ico('back', 16), 'c-bad'), span('Protect', 't-h3 c-bad'), gap=10, justify='center'), tone='bad', style='padding: 12px 16px')
        dots_i = 0
    dots = row(*[dot('ok' if i < dots_i else 'danger' if i == dots_i else 'neutral') for i in range(4)], gap=8, justify='center')
    acts = [btn('Move up to Rebuild →', 'dan', full=True, style='height: 54px'), btn('Stay a bit longer', 'sec', full=True)] if kind == 'adv' else [btn('Done', 'dan', full=True, style='height: 54px')]
    return sheet(None, col(tile(icon, tone, lg=True), txt(title, 't-h1'), txt(body, 't-s', 'text-align: center; max-width: 290px'), mid, dots, gap=14,
                           style='align-items: center; text-align: center; padding-top: 8px'), h=580 if kind == 'adv' else 520, close=False, footer=col(*acts, gap=10))


P('P10-Injury-Result-Advance.dc.html', 'Check-in result · green light', plan(1, overlay=result('adv')), row_=10)
P('P10-Injury-Result-Hold.dc.html', 'Check-in result · hold', plan(1, overlay=result('hold')), row_=10)
P('P10-Injury-Result-Back.dc.html', 'Check-in result · step back', plan(1, overlay=result('back')), row_=10)


def manage(overlay=''):
    return rx('Manage rehab', lbl('Injury'), lst(li('Area', None, span(ico('target', 18), 'c-bad'), span('Right Knee', 't-s')),
                                               li('Current stage', None, span(ico('swap', 18), 'c-dim'), span('Reintroduce', 't-s'))),
              cta=[btn('Mark as healed', 'ok', 'check', full=True), btn('Cancel rehab plan', 'dan', 'x', full=True)], overlay=overlay)


P('P10-Injury-Manage.dc.html', 'Manage rehab', manage(), row_=11)
P('P10-Injury-Healed.dc.html', 'Mark as healed · confirm', manage(dialog('Mark the Knee as healed?', 'You’ll return to full training and the protected days clear from your program. You can start a new plan any time if it flares up.', 'Yes, I’m healed', 'Not yet', 'ok', top=260)), row_=11)
P('P10-Injury-Cancel.dc.html', 'Cancel rehab plan · confirm', manage(dialog('Cancel the rehab plan?', 'The plan is removed and your training goes straight back to normal. This can’t be undone.', 'Cancel plan', 'Not yet', top=280)), row_=11)

node = lambda n, name, st: col(card(span(ico('check', 16, w=2.4), 'c-ok') if st == 'Cleared' else span(str(n), 't-h3 num' + (' c-bad' if st == 'Now' else ' c-dim')), tone='ok' if st == 'Cleared' else 'bad' if st == 'Now' else '', pad=False,
                                    style=f'width: {56 if st == "Now" else 40}px; height: {56 if st == "Now" else 40}px; align-items: center; justify-content: center'),
                               txt(name, 't-h2 c-bad' if st == 'Now' else 't-h3'), txt(st, 't-m'), gap=6, style='align-items: center; width: 140px')
cline = lambda done: f'<div style="flex: 1; margin-top: 24px">{bar(100 if done else 0, "ok", 3)}</div>'
board('P10-Injury-Desktop.dc.html', 'Rehab plan · desktop hub', 1440, 900, desktop(col(
    row(tile('bandage', 'danger', lg=True), col(txt('Knee · rehab plan', 't-h1'), txt('Reintroduce · step 2 of 4 · advancing by feel', 't-s'), gap=2, style='flex: 1'),
        btn('Manage', 'sec', sm=True), btn('Mark as healed', 'ok', sm=True), gap=14),
    row(col(card(row(node(1, 'Protect', 'Cleared'), cline(True), node(2, 'Reintroduce', 'Now'), cline(False), node(3, 'Rebuild', 'By feel'), cline(False), node(4, 'Return to full', 'By feel'), align='flex-start', gap=4), tone='quiet', style='padding: 18px 0'),
            card(lbl('Right now · Reintroduce', 'danger'), row(span(ico('shield', 18), 'c-bad'), txt('You climb the stages by how it feels, not by a date. Estimates are only a guide.', 't-b'), gap=9, align='flex-start'), tone='bad', style='padding: 18px'),
            card(txt('What Rebuild will do', 't-h3'), row(*[col(f'<div style="width: 100%">{bar(100, "neutral", p)}</div>', span(f'{p}%', 't-m'), gap=6, style='flex: 1; align-items: center; justify-content: flex-end') for p in (60, 75, 90, 100)], gap=12, align='flex-end', style='height: 120px'),
                 txt('Graded load back to your old working set — each step gated by a good check-in.', 't-m')),
            btn('Log a check-in', 'dan', 'pulse', style='height: 54px'), gap=16, style='flex: 1.6'),
        col(card(row(span(ico('calendar', 16), 'c-rest'), txt('No fixed timeframe set', 't-h3 c-rest'), gap=9),
                 txt('Got a doctor’s no-load period? Add it and we’ll hold training until the date, then resume by feel.', 't-s'), tone='rest'),
            col(lbl('Recent check-ins'), lst(li('26/09/2026', None, dot('ok'), span('Fine', 't-s c-ok')), li('24/09/2026', None, dot('brass'), span('Sore', 't-s c-brass')),
                                               li('22/09/2026', None, dot('ok'), span('Fine', 't-s c-ok'))), gap=8),
            col(lbl('Protected'), lst(*[li(n, None, span(ico('shield', 16), 'c-bad')) for _, n in MUS_KNEE]), gap=8), gap=14, style='flex: 1'), gap=18, align='flex-start'), gap=20), 'today', 1440, 900), row_=11)

print('ok')
