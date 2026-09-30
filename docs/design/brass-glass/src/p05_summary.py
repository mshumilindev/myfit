"""P05 · Summary & recap — 1:1 with SessionView summary (S-29) + ShareSheet, AtlasDebrief, sessionSummary/NextUp,
SessionEnergy.EnergyPlaque, GymKit.GymKitCard, RecapBlock (+ AllRecapsSheet), RecapView (+ RecapShareSheet, RecapStory).
Copy = en.ts / atlas.en.ts."""
from kit import *

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

# ============================================================== summary pieces (SessionView summary, JSX order)
def saved_mark():
    return row(tag('Session saved', 'ok', 'check'), gap=8)


def headline(sub='Monday, 28 September · Iron Temple'):
    """.headline 30 px — the screen's title, no card"""
    return col(txt('Done.', 't-hero'), txt(sub, 't-s'), gap=8)


def debrief(lines=('18 sets, 58 min. Fine.', 'Bench press 100 kg. A record. Do it again and I’ll believe it.')):
    """AtlasDebrief — temper 3 (Blunt): chat bubbles without a surrounding card; 'Mute for today' only from temper 4"""
    bub = lambda t_: row(atlas_face(28), card(txt(t_, 't-s'), style='flex: 1; padding: 9px 12px'), gap=10, align='flex-start')
    return card(*[bub(x) for x in lines], row(chip('Open Atlas', True), gap=8, style='padding-left: 38px'), tone='quiet', gap=8)


def stat_grid(cells, hero=True):
    """.stat-grid — e1 of the summary: the headline numbers big, labels tiny"""
    items = [col(txt(v, 't-num num' if len(cells) <= 3 else 't-h2 num'), txt(l, 't-l'), gap=6) for v, l in cells]
    return card(grid(*items, cols=len(cells), gap=10), tone='hero' if hero else '', style='padding: 18px 18px 16px')


def next_up_card():
    """NextUpCard (p01): kicker · more, icon + title + reason, strip dots, Start / Log, alternatives"""
    dots = row(*[dot('brass' if y else 'neutral') for y in [1, 1, 0, 1]], gap=10)
    return card(row(span(ico('clock', 14) + ' Next up · while you’re warm', 't-l c-brass'), sp(), ibtn('more', 'More options for this suggestion', sm=True)),
                row(tile('run', 'brass', lg=True), col(txt('Run · 20 min', 't-h2'), txt('You went for a run after 3 of your last 4 sessions', 't-s'), gap=2, style='flex: 1'), gap=12),
                dots, row(txt('4 sessions ago', 't-m'), sp(), txt('usually 20–30 min · adds to your load', 't-m')),
                row(btn('Start run', 'pri', 'play', style='flex: 1'), btn('Log 20 min', 'sec', style='flex: 1'), gap=8),
                txt('Or, also after lifting', 't-m'), row(chip(f'Walk <span class="t-m">30 min</span>', icon='body'), chip(f'Sauna <span class="t-m">20 min</span>', icon='flame'), gap=8),
                gap=10)


def energy(k='~412'):
    """EnergyPlaque — a one-line plaque"""
    return row(tile('flame', 'kcal', s=16), txt(f'{k} <span class="t-m">kcal</span>', 't-h3 num'), gap=10, style='padding: 0 4px')


def gym_kit():
    r = lambda n, s, k: li(n, row(dot('brass'), dot('brass'), dot('neutral'), span(s, 't-m'), gap=4), img(k, 40, 40, 10, alt=n))
    return card(row(txt('2 things you used aren’t on the list', 't-h3', 'flex: 1'), txt('Iron Temple', 't-m')),
                col(r('Pec deck', 'Seen in 3 sessions here', 'equipment/m-pec-deck.jpg'), r('Flat bench', 'Seen once here', 'equipment/bench-flat.jpg'), gap=0),
                btn('Review 2', 'sec', sm=True, style='align-self: flex-start'), gap=8)


def muscles_worked():
    """MuscleBreakdownList (Muscle.tsx): MuscleIcon chip figure · name · week meter tinted by volume zone (ZONE_COLOR) with
    'N / MAV' + 'this week' · this session's sets on the right"""
    zc = {'under': 'c-dim', 'productive': 'c-ok', 'high': 'c-brass', 'over': 'c-bad'}
    def m(g, reg, n, sets, wk, mav, zone, primary=True):
        return row(bodymap('front', [g] if primary else [], [] if primary else [g], region=reg, h=38),
                   col(txt(n, 't-s'), row(col(bar(min(100, wk / mav * 100), zone, 4), style='flex: 1; min-width: 0'), txt(f'{wk} / {mav}', f't-m num {zc[zone]}'), txt('this week', 't-m'), gap=8), gap=4, style='flex: 1; min-width: 0'),
                   txt(str(sets), 't-h3 num', 'width: 26px; text-align: right'), gap=10)
    return col(lbl('Muscle groups worked'), m('chest', 'torso', 'Chest', 10, 16, 16, 'productive'), m('triceps', 'arms', 'Triceps', 6, 8, 12, 'under'),
               m('shoulders', 'upper', 'Shoulders', 2, 14, 12, 'high', False), gap=10)


def pr_panel():
    """.pr-panel — emerald, 24 px record line"""
    return card(row(ico('trophy', 18), lbl('New record', 'ok'), gap=8), txt('Bench press · 100 kg × 5', 't-h1'),
                txt('Previous best 97.5 kg · estimated 1RM up to 117 kg', 't-m'), tone='ok', gap=8, style='padding: 18px')


def compare():
    """.compare-row — plain divided rows, 14 px, no card"""
    c = lambda n, v, d, tone: li(n, None, None, row(span(v, 'num t-s'), span(d, f'num t-s c-{tone}', 'width: 40px; text-align: right'), gap=10), style='min-height: 40px; padding: 6px 2px')
    return col(lbl('Compared to last session'),
               card(c('Bench press', '2 000 kg', '+8%', 'ok'), c('Incline DB press', '1 536 kg', '+4%', 'ok'), c('Cable fly', '648 kg', '—', 'dim'),
                    c('Dips', '1 296 kg', '+2%', 'ok'), c('Triceps pushdown', '1 080 kg', '−6%', 'bad'), c('Session volume', '6.2 t', '+5%', 'ok'), tone='quiet', gap=0), gap=4)


def actions():
    return col(btn('Share workout', 'pri', 'share', full=True, style='height: 54px'), row(btn('Edit session', 'txt', style='flex: 1'), btn('Done', 'txt', style='flex: 1'), gap=8), gap=4)


# ---- row 0 · main flow
P('P05-Summary.dc.html', 'Workout summary (scroll)', phone(
    saved_mark(), headline(), debrief(), next_up_card(),
    stat_grid([('58:12', 'Duration'), ('18', 'Sets'), ('6.2 t', 'Moved')]),
    energy(), gym_kit(), muscles_worked(), pr_panel(), compare(), actions(),
    tabs=None, h=1880, mood='ok'), h=1880)


def share_canvas(story=True):
    """the canvas the ShareSheet draws from buildShareModel (brand, title, date, gym, hero, stats, record, top exercises, muscles, tagline)"""
    return card(row(txt('Spotter', 't-h3'), sp(), tag('Chest 2', 'brass')),
                col(txt('Monday, 28 September · Iron Temple', 't-m'), txt('6.2 t', 't-hero num'), txt('Total volume', 't-l'), gap=4),
                grid(stat('Duration', '58:12'), stat('Sets', '18'), stat('exercises', '6'), cols=3),
                card(row(tile('trophy', 'ok'), col(lbl('New record', 'ok'), txt('Bench press · 100 kg × 5', 't-h3'), gap=2, style='flex: 1'), gap=10), tone='ok', style='padding: 10px 12px'),
                lbl('Top exercises'),
                col(row(txt('Bench press', 't-s', 'flex: 1'), txt('100 kg × 5', 't-s num')), row(txt('Incline DB press', 't-s', 'flex: 1'), txt('32 kg × 8', 't-s num')),
                    row(txt('Dips', 't-s', 'flex: 1'), txt('10 kg × 8', 't-s num')), gap=6),
                row(tag('Chest 10', 'neutral'), tag('Triceps 6', 'neutral'), tag('Front delts 2', 'neutral'), gap=6) if story else '',
                txt('Everything you lift, in one place.', 't-m'), tone='hero', gap=12, style='padding: 18px')


P('P05-Share.dc.html', 'Share workout sheet', phone(saved_mark(), headline(), tabs=None, mood='ok', h=900,
    overlay=sheet(None, row(txt('Share workout', 't-h2', 'flex: 1'), col(seg(['Story', 'Square'], 0), style='width: 170px')), share_canvas(),
        h=720, footer=row(btn('Share', 'pri', 'share', style='flex: 1'), ibtn('download', 'Save image', 'fill'), ibtn('layers', 'Copy', 'fill'), gap=8))), h=900)


# ============================================================== recaps (RecapView.tsx, RecapBlock.tsx)
def delta(d, suffix=''):
    up = not d.startswith('−')
    return txt(f'{ico("up" if up else "down", 12)} {d}' + (f' <span class="t-m">{suffix}</span>' if suffix else ''), f't-s num c-{"ok" if up else "bad"}')


def rc_stat(v, l, d, suffix=''):
    return col(txt(v, 't-num num'), lbl(l), delta(d, suffix), gap=4, style='padding: 6px 2px')


def rank(n, pct, p):
    return col(row(txt(n, 't-s', 'flex: 1'), txt(f'{p}%', 't-m num')), bar(pct, 'brass'), gap=5)


def dots7(mask):
    return row(*[col(dot('brass' if m else 'neutral'), txt(d, 't-m'), gap=4, style='align-items: center') for m, d in zip(mask, 'MTWTFSS')], justify='space-between')


P('P05-Recap.dc.html', 'Recap · September (scroll)', phone(
    row(ibtn('back', 'Back'), txt('Recap', 't-h1', 'flex: 1'), ibtn('layers', 'Play story', 'fill', sm=True), ibtn('share', 'Share', 'fill', sm=True), gap=6, style='height: 56px'),
    card(span(ico('dumbbell', 14) + ' Monthly recap', 't-l c-brass'), txt('September 2026', 't-hero'), txt('Your highest-volume month yet.', 't-h2 c-brass'),
         txt('You showed up 16 times.', 't-s c-brass'), tone='hero', gap=12, style='padding: 26px 22px 24px'),
    lbl('The totals'),
    grid(rc_stat('16', 'Sessions', '+23%'), rc_stat('85 t', 'Total volume', '+11%', '84 612 kg'), rc_stat('15.7 h', 'Time trained', '+14%'), rc_stat('262', 'Sets · 1 720 reps', '+9%'), cols=2, gap=14),
    row(tile('flame', 'kcal'), col(txt('9 840 <span class="t-m">kcal</span>', 't-h2 num'), lbl('Estimated burn · training'), gap=2, style='flex: 1'), delta('+12%'), gap=12, style='padding: 0 2px'),
    card(row(ico('trophy', 18), lbl('New records', 'brass'), sp(), txt('5', 't-h2 num c-brass'), gap=8),
         lst(li('Bench press', 'est. 1RM 117 kg', tile('star', 'brass'), span('100 kg', 't-h3 num')), li('Squat', 'est. 1RM 163 kg', tile('star', 'brass'), span('140 kg', 't-h3 num')),
             li('Deadlift', 'est. 1RM 191 kg', tile('star', 'brass'), span('180 kg', 't-h3 num'))),
         grid(card(lbl('Heaviest set'), txt('Deadlift', 't-s'), txt('180 kg × 3', 't-h3 num'), style='padding: 10px 12px', gap=3),
              card(lbl('Biggest session'), txt('24 Sep', 't-s'), txt('7 t moved', 't-h3 num'), style='padding: 10px 12px', gap=3), cols=2, gap=8), tone='glass', gap=12),
    card(lbl('Muscle distribution'),
         row(bodypair(['chest', 'lats', 'shoulders'], h=150, gap=2), col(rank('Chest', 100, 22), rank('Back', 95, 21), rank('Legs', 82, 18), rank('Shoulders', 50, 11), gap=10, style='flex: 1; min-width: 0'), gap=14),
         row(ico('info', 16), txt('Core saw the least work this period — worth a look next block.', 't-s', 'flex: 1'), gap=8), gap=12),
    card(lbl('Consistency'), grid(stat('Training days', '16'), stat('Longest streak', '6'), stat('Perfect weeks', '3', '/4'), cols=3), dots7([1, 0, 1, 1, 0, 1, 0]), gap=14),
    card(row(lbl('Volume trend · by week'), sp(), txt('tonnes', 't-m')), bars([18.2, 19.6, 21.4, 25.4], 326, 96, 'brass', 3, ['W36', 'W37', 'W38', 'W39']), gap=8),
    card(lbl('You trained toward your goal'), row(ring(78, 64, 'brass', 6, span('78%', 't-h3 num')), col(txt('V-Taper · block focus', 't-b'),
         row(tag('Side delt ✓', 'brass'), tag('Upper chest ✓', 'brass'), tag('Lats', 'neutral'), gap=6, wrap=True), gap=10, style='flex: 1'), gap=14), gap=12),
    card(lbl('Alongside lifting'), grid(row(tile('pulse', 'rest'), col(txt('140 <span class="t-m">min</span>', 't-h3 num'), lbl('Recovery'), gap=2), gap=10),
                                        row(tile('wave', 'brass'), col(txt('210 <span class="t-m">min</span>', 't-h3 num'), lbl('Conditioning'), gap=2), gap=10), cols=2, gap=12), tone='quiet', gap=12),
    card(txt('Your highest-volume month yet.', 't-h2', 'text-align: center'), btn('Share your September', 'pri', 'share', full=True), btn('Watch it as a story · Save the card', 'txt', style='align-self: center'), tone='glass', gap=12),
    tabs=None, h=2080, mood='art'), h=2080)


# ---- story (RecapStory: 5 panels, auto-advancing; last panel = share card)
def story(i, *body, mood='art'):
    prog = row(*[col(bar(100 if k < i or (k == i and i == 4) else (40 if k == i else 0), 'brass', 3), style='flex: 1') for k in range(5)], gap=4)
    return _phone(prog, row(sp(), ibtn('x', 'Back', 'fill', sm=True)), *body, tabs=None, mood=mood)  # rc-story covers the whole app (no brand)

panels = [
    story(0, sp(170), span(ico('dumbbell', 14) + ' Your September, wrapped', 't-l c-brass'), txt('September<br>2026', 't-hero'), txt('Your highest-volume month yet.', 't-h1 c-brass')),
    story(1, sp(130), lbl('In September you moved'), txt('85<span class="t-h1 c-brass"> t</span>', 't-hero num'), txt('84 612 kg across 262 sets', 't-b c-mut'), sp(24),
          grid(col(txt('16', 't-num num'), lbl('Sessions'), gap=4), col(txt('15.7<span class="t-m">h</span>', 't-num num'), lbl('Trained'), gap=4), col(txt('9.8<span class="t-m">k</span>', 't-num num c-rest'), lbl('kcal'), gap=4), cols=3), mood='sleep'),
    story(2, sp(90), tile('trophy', 'brass', lg=True), txt('You set 5 new personal records', 't-d1'), sp(10),
          col(*[row(txt(n_, 't-num num c-brass', 'width: 44px'), col(txt(e, 't-h3'), txt(r, 't-m c-brass'), gap=2, style='flex: 1'), txt(w, 't-num num'), gap=12) for n_, e, r, w in
                [('01', 'Bench press', 'est. 1RM 117 kg', '100 kg'), ('02', 'Squat', 'est. 1RM 163 kg', '140 kg'), ('03', 'Deadlift', 'est. 1RM 191 kg', '180 kg')]], gap=18)),
    story(3, sp(30), lbl('Where the work went'), txt('Chest & Back led the way', 't-d1'), bodypair(['chest', 'lats', 'shoulders'], h=300, gap=10),
          col(rank('Chest', 100, 22), rank('Back', 95, 21), rank('Legs', 82, 18), gap=12), mood='sleep'),
    story(4, card(txt('spotter', 't-h3'), txt('September 2026', 't-d1'), txt('Your highest-volume month yet.', 't-s c-brass'),
          grid(col(txt('16', 't-num num c-brass'), lbl('Sessions'), gap=4), col(txt('85<span class="t-m"> t</span>', 't-num num'), lbl('Volume'), gap=4), col(txt('5', 't-num num'), lbl('PRs'), gap=4), cols=3),
          bodypair(['chest', 'lats', 'shoulders'], h=170, gap=8), col(rank('Chest', 100, 22), rank('Back', 95, 21), rank('Legs', 82, 18), gap=8),
          row(tile('star', 'brass'), col(lbl('Top record'), txt('Bench press', 't-s'), gap=2, style='flex: 1'), txt('100 kg', 't-h2 num'), gap=10),
          btn('Share card', 'pri', 'share', full=True, style='height: 52px'), tone='hero', gap=14, style='padding: 20px')),
]
board('P05-Recap-Story.dc.html', 'Recap story · 5 panels', 390 * 5 + 40 * 4, 844, row(*panels, gap=40, align='flex-start'))


# ---- RecapBlock (lives in Notifications)
def compact(title, sub, building=False, year=False):
    return li(title, sub, tile('clock' if building else ('star' if year else 'calendar'), 'neutral' if building else 'brass'), '' if building else ico('play', 22))


def rc_block(ready=True):
    head = row(span(ico('spark', 13) + ' Your recaps', 't-l c-brass', 'flex: 1'), btn('See all', 'txt', style='height: 28px'))
    if ready:
        hero = card(row(span(ico('dumbbell', 14) + ' Monthly recap · ready', 't-l c-brass'), sp(), dot('brass')), txt('September 2026', 't-d1'), txt('Your highest-volume month yet.', 't-b c-brass'),
                    grid(col(txt('85<span class="t-m"> t</span>', 't-num num c-brass'), lbl('Volume'), gap=4), col(txt('16', 't-num num'), lbl('Sessions'), gap=4), col(txt('5', 't-num num c-brass'), lbl('PRs'), gap=4), cols=3),
                    btn('Play your September', 'pri', 'play', full=True, style='height: 50px'),
                    btn('or read the full recap', 'txt', style='align-self: center; height: 28px'), tone='hero', gap=14, style='padding: 20px')
    else:
        hero = card(row(tile('clock', 'neutral', lg=True), col(txt('October 2026', 't-h2'), lbl('Recap not ready'), gap=2, style='flex: 1'), gap=11),
                    txt("Not enough sessions this period yet. Your recap unlocks at 8 sessions — you're at 3.", 't-s'),
                    row(col(bar(37, 'brass'), style='flex: 1'), txt('3 / 8', 't-m num'), gap=10), gap=12)
    return col(head, hero, lst(compact('Q3 2026', '38 sessions · 214 t')), lst(compact('2026', 'Building — 132 sessions so far', building=True, year=True)), gap=10)


P('P05-RecapBlock.dc.html', 'Your recaps · Notifications block', phone(header('Notifications', large=True), rc_block(True), tabs=None, mood='art', h=900), h=900, row_=1)
P('P05-RecapBlock-NotReady.dc.html', 'Your recaps · month not ready', phone(header('Notifications', large=True), rc_block(False), tabs=None, mood='art'), row_=1)


# ---- summary states
P('P05-Summary-NextUpRunning.dc.html', 'Summary · next up running (scroll)', phone(
    card(row(tile('run', 'brass', lg=True), col(txt(f'{dot("brass")} Conditioning · since 18:06', 't-l c-brass'), txt('Run 4:12 <span class="t-m">of ~20 min</span>', 't-h2'), gap=4, style='flex: 1'), gap=12),
         bar(21, 'brass'), row(btn('Pause', 'sec', 'pause', style='flex: 1'), btn('Finish', 'pri', 'check', style='flex: 1'), gap=8), tone='glass', gap=10),
    saved_mark(), headline(), debrief(),
    card(row(tile('run', 'brass'), col(txt('Run running — we’ll add it to your load', 't-h3'), txt('Timer keeps going after Done. Find it on Today.', 't-s'), gap=2, style='flex: 1'), ibtn('x', 'Cancel run timer', sm=True), gap=12)),
    stat_grid([('58:12', 'Duration'), ('18', 'Sets'), ('6.2 t', 'Moved')]), energy(), pr_panel(), compare(),
    txt(f'{dot("brass")} Run keeps timing if you leave', 't-s c-brass'),
    row(ibtn('share', 'Share workout', 'fill'), btn('Edit session', 'sec', style='flex: 1'), btn('Done', 'pri', style='flex: 1'), gap=8),
    tabs=None, h=1450, mood='ok'), h=1450, row_=1)

P('P05-Summary-Home.dc.html', 'Summary · home set, nothing suggested', phone(
    saved_mark(), headline('Monday, 28 September · Morning'), debrief(('9 sets, 12 min. Fine.',)),
    stat_grid([('12:04', 'Duration'), ('9', 'Sets'), ('86', 'Reps'), ('2:40', 'Hold')]),
    card(row(tile('plus', 'neutral'), txt('Anything after this?', 't-b', 'flex: 1'), btn('Log activity' + ico('chev', 14), 'txt', style='height: 32px'), gap=10), style='padding: 8px 14px'),
    energy('~96'), muscles_worked(), actions(),
    tabs=None, mood='art'), row_=1)

P('P05-Summary-NextUpLogged.dc.html', 'Summary · next up logged, undo', phone(
    saved_mark(), headline(), debrief(),
    card(row(tile('run', 'brass'), col(txt('Run · 20 min logged', 't-h3'), txt('Added to today’s load', 't-s'), gap=2, style='flex: 1'), btn('Undo', 'txt'), gap=12)),
    stat_grid([('58:12', 'Duration'), ('18', 'Sets'), ('6.2 t', 'Moved')]), energy(),
    tabs=None, mood='ok'), row_=1)

# ============================================================== row 2 · sheets
P('P05-NextUp-Options.dc.html', 'Next up · options', phone(saved_mark(), headline(), debrief(), tabs=None, mood='ok', overlay=sheet(None,
    row(tile('run', 'brass', lg=True), col(txt('Run · 20 min', 't-h2'), txt('Suggested after this workout', 't-s'), gap=2, style='flex: 1'), gap=12),
    lst(li('Not today', 'Hide it for this session only', tile('moon')),
        li('Change to…', 'Pick another activity on Log activity', tile('swap'), chev=True),
        li('Don’t suggest Run after workouts', 'Walk and Sauna can still show up', tile('eye', 'bad'))),
    row(ico('info', 16), txt('Suggestions come from your last 12 sessions.', 't-m', 'flex: 1'), gap=8),
    h=440)), row_=2)

def month_card(m, sub, gold=False, grow=('chest', 'lats', 'shoulders')):
    return card(bodymap('front', grow, h=56), txt(m, 't-h3'), txt(sub, 't-m c-brass' if gold else 't-m'), tone='glass' if gold else '', style='padding: 12px', gap=6)

P('P05-AllRecaps.dc.html', 'All recaps sheet', phone(header('Notifications', large=True), rc_block(True), tabs=None, mood='art', overlay=sheet(None,
    txt('Your recaps', 't-h2'),
    lbl('Monthly'), grid(month_card('October', 'Building — 3 sessions so far', grow=()), month_card('September', '85 t · 5 PR', True), month_card('August', '76 t · 3 PR'), cols=3, gap=8),
    lbl('Quarterly'), lst(compact('Q3 2026', '38 sessions · 214 t'), compact('Q2 2026', '35 sessions · 188 t')),
    lbl('Yearly'), lst(compact('2026', 'Building — 132 sessions so far', building=True, year=True), compact('2025', '148 sessions · 690 t', year=True)),
    h=700)), row_=2)

def recap_canvas():
    return card(row(txt('Spotter', 't-h3'), sp(), txt('spotter.app', 't-m')), lbl('Monthly recap', 'brass'), txt('September 2026', 't-h1'), txt('Your highest-volume month yet.', 't-s c-brass'),
                grid(stat('Sessions', '16'), stat('Volume', '85', 't'), stat('PRs', '5'), cols=3),
                row(bodypair(['chest', 'lats', 'shoulders'], h=110, gap=2), col(rank('Chest', 100, 22), rank('Back', 95, 21), rank('Legs', 82, 18), gap=8, style='flex: 1; min-width: 0'), gap=10),
                row(tile('star', 'brass'), txt('Bench press', 't-s', 'flex: 1'), txt('100 kg', 't-h3 num'), gap=10), txt('9 840 kcal', 't-m'), tone='glass', gap=12, style='padding: 18px')

P('P05-Recap-Share.dc.html', 'Recap · share card sheet', phone(header('Recap'), tabs=None, mood='art', h=900, overlay=sheet(None,
    row(txt('Share card', 't-h2', 'flex: 1'), col(seg(['Story', 'Square'], 0), style='width: 170px')), recap_canvas(),
    h=720, footer=row(btn('Share', 'pri', 'share', style='flex: 1'), ibtn('download', 'Save image', 'fill'), ibtn('layers', 'Copy', 'fill'), gap=8))), h=900, row_=2)
# ============================================================== night (App.tsx nightLive) — summary under SleepHero; Next up start is blocked while a night runs
def next_up_blocked():
    return card(row(span(ico('clock', 14) + ' Next up · while you’re warm', 't-l c-rest'), sp(), ibtn('more', 'More options for this suggestion', sm=True)),
                row(tile('flame', 'rest', lg=True), col(txt('Sauna · 20 min', 't-h2'), txt('You hit the sauna after 3 of your last 4 sessions', 't-s'), gap=2, style='flex: 1'), gap=12),
                row(btn('Start sauna', 'pri', 'play', style='flex: 1', dis=True), btn('Log 20 min', 'sec', style='flex: 1'), gap=8), gap=10)

P('P05-Summary-Night.dc.html', 'Workout summary · night (sleep live)', phone(
    saved_mark(), headline(), debrief(), next_up_blocked(),
    stat_grid([('58:12', 'Duration'), ('18', 'Sets'), ('6.2 t', 'Moved')]), energy(), pr_panel(), actions(),
    tabs=None, night=True, h=1480), h=1480, row_=1)
print('ok')
