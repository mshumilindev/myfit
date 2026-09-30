"""P13 · Apex & challenges — 1:1 translation of the Apex sub-app (views/ApexApp.tsx: apex-head · apex-nav Home · Challenges ·
Ranks · Awards · Apps, bell → Feed), views/ApexHome.tsx, views/ChallengesView.tsx (hub, filter sheet, StartSheet, DetailSheet,
CompleteSheet), components/StandardsView.tsx (Ranks), components/FeatsView.tsx (Awards, hideSubtabs), views/NotificationsView.tsx
(embedded Feed = "Milestones"), components/StatShareSheet.tsx, components/AppRail.tsx (desktop). Catalog = challenges.ts, tiers =
standards.ts / feats.ts, copy = en.ts. See fidelity/P13.md."""
from kit import *

import glob as _glob, os as _os
for _f in _glob.glob(_os.path.join(OUT, 'P13-*.dc.html')):
    _os.remove(_f)

NAV = [('home', 'Home', 'home'), ('challenges', 'Challenges', 'target'), ('ranks', 'Ranks', 'trophy'), ('awards', 'Awards', 'star'), ('apps', 'Apps', 'grid')]
ACC = {'brass': 'brass', 'ok': 'ok', 'blue': 'rest'}          # challenge accents → kit tones


def apex_spec(*a, **k):
    """kit spec() board in the Apex skin."""
    return spec(*a, **k).replace('<div class="scr"', '<div class="scr sk-apex"', 1)


def abs_(inner, css):
    return f'<div style="position: absolute; {css}">{inner}</div>'


def rel(inner, *badges, style=''):
    return f'<div style="position: relative; {style}">{inner}{"".join(badges)}</div>'


def bell(on=False, unread=3):
    b = ibtn('bell', 'Milestones', 'pri' if on else 'fill', sm=True)
    return rel(b, abs_(tag(str(unread), 'bad'), 'top: -4px; right: -6px') if (unread and not on) else '')


def apex_head(feed=False, unread=3):
    """apex-head: spotter · Apex (app switch) · bell (→ Feed, fills on Feed) · Language. No Mastery badge."""
    return brandbar(row(bell(feed, unread), ibtn('globe', 'Language', 'fill', sm=True), gap=6), app='Apex')


def apex_phone(*content, tab='home', h=844, overlay='', mood='art', feed=False, unread=3):
    return phone(apex_head(feed, unread), *content, tabs=(tab, NAV), h=h, overlay=overlay, mood=mood, skin='apex')


def title(t_, sub=None, share=False):
    left = col(txt(t_, 't-h1'), txt(sub, 't-s') if sub else '', gap=2, style='flex: 1; min-width: 0')
    return row(left, ibtn('share', 'Share', 'fill', sm=True) if share else '', gap=8, align='flex-start')


def hl():
    return '<div class="hl"></div>'


# ============================================================== Home (ApexHome)
WEEK = ['on', 'on', 'off', 'on', 'on', 'future', 'future']      # Mon … Sun, today = Fri


def wdot(s):
    if s == 'future':
        return card(tone='dash', pad=False, style='width: 10px; height: 10px')
    return dot('brass' if s == 'on' else 'neutral')


def active_home(title_='120 chest sets', val='62', rest=' / 120 sets · 11 days left', pct=52, icon='layers'):
    num, rest2 = rest.split(' · ', 1)
    return card(row(ring(pct, 72, 'apex', 6, ico(icon, 22)),
                    col(txt(title_, 't-h3'), row(span(val, 't-num c-brass num'), span(num, 't-s num'), gap=6, align='baseline'), txt(rest2, 't-m'), gap=4, style='flex: 1; min-width: 0'),
                    ico('chev', 18), gap=16), tone='hero', style='padding: 16px')


def streak_card(n='42-day streak'):
    return card(row(tile('flame', 'brass'), col(txt(n, 't-h3 num'), txt('this week', 't-m'), gap=2, style='flex: 1'),
                    row(*[wdot(s) for s in WEEK], gap=6), gap=12), style='padding: 12px 14px')


RECENT = [('Deadlift → CMS', 'trophy', '2h'), ('Bench press PR', 'dumbbell', '5h'), ('190 kg club', 'star', '26 Sep')]


def home_body(empty=False):
    out = [title('Apex', 'Level up your training'), lbl('Active challenge')]
    if empty:
        out.append(card(row(col(txt('No active challenges', 't-h3'), txt('Start one from Challenges.', 't-s'), gap=3, style='flex: 1'), ico('chev', 18), gap=12), tone='dash', style='padding: 14px 16px'))
        out.append(streak_card('0-day streak'))
        return out
    out += [active_home(), streak_card(),
            lbl('Next rank'),
            card(row(tile('trophy', 'brass'), col(txt('Bench press → I', 't-h3'), bar(95, 'brass'), gap=8, style='flex: 1'), txt('+1 kg', 't-h3 c-brass num'), gap=12), style='padding: 12px 14px'),
            lbl('Latest achievement'),
            card(row(span('🏋️', 't-h1'), col(txt('190 kg club', 't-h3'), txt('26 Sep', 't-m'), gap=2, style='flex: 1'), gap=14), tone='apex', style='padding: 12px 14px'),
            section('Recent milestones', 'See all'),
            lst(*[li(t_, None, tile(i, 'brass'), span(tm, 't-m')) for t_, i, tm in RECENT])]
    return out


P('P13-Home.dc.html', 'Apex · Home', apex_phone(*home_body(), h=880), row_=0, h=880)

# ============================================================== Challenges hub (ChallengesView)
CAT = [  # page 1 of the generated catalog (challenges.ts order), state
    ('120 chest sets', 'Volume', 'layers', 'brass', 'active'), ('150 back sets', 'Volume', 'layers', 'brass', 'idle'),
    ('100 shoulders sets', 'Volume', 'layers', 'brass', 'idle'), ('120 arms sets', 'Volume', 'layers', 'brass', 'idle'),
    ('150 legs sets', 'Volume', 'layers', 'brass', 'idle'), ('80 core sets', 'Volume', 'layers', 'brass', 'idle'),
    ('500 hard sets', 'Volume', 'layers', 'brass', 'idle'), ('50 sessions', 'Milestones', 'star', 'brass', 'idle'),
    ('Lift 100 t', 'Milestones', 'dumbbell', 'brass', 'idle'), ('5,000 reps', 'Milestones', 'chart', 'brass', 'idle'),
    ('Set 10 PRs', 'Strength', 'trophy', 'brass', 'idle'), ('Reach 100 kg bench', 'Strength', 'dumbbell', 'brass', 'idle'),
    ('Reach 140 kg squat', 'Strength', 'dumbbell', 'brass', 'idle'), ('Reach 180 kg deadlift', 'Strength', 'dumbbell', 'brass', 'idle'),
    ('Reach 60 kg overhead press', 'Strength', 'dumbbell', 'brass', 'idle'), ('Reach 100 kg barbell row', 'Strength', 'dumbbell', 'brass', 'idle'),
    ('7-day streak', 'Streaks', 'flame', 'brass', 'idle'), ('14-day streak', 'Streaks', 'flame', 'brass', 'idle'),
    ('30-day streak', 'Streaks', 'flame', 'brass', 'done'), ('50-day streak', 'Streaks', 'flame', 'brass', 'idle'),
]


def state_chip(st):
    if st == 'active':
        return tile('clock', 'illness', s=16)
    if st == 'done':
        return tile('check', 'ok', s=16)
    return ibtn('plus', 'Start', 'pri', sm=True)


def cat_row(t_, c, icon, acc, st):
    return li(t_, c, tile(icon, ACC.get(acc, acc)), state_chip(st))


def active_card(t_, val, rest, pct, icon='layers', tone='brass', ended=False):
    num, rest2 = rest.split(' · ', 1)
    sub = col(row(span(val, 't-num c-brass num'), span(num, 't-s num'), gap=6, align='baseline'), txt(rest2, 't-m c-bad' if ended else 't-m'), gap=2)
    return card(row(ring(pct, 58, tone, 5, ico(icon, 20)), col(txt(t_, 't-h3'), sub, gap=4, style='flex: 1; min-width: 0'),
                    txt(f'{pct}%', 't-h3 num c-brass'), ico('chev', 18), gap=12), tone='glass' if not ended else '', style='padding: 14px')


ACTIVE = [active_card('120 chest sets', '62', ' / 120 sets · 11 days left', 52),
          active_card('Train 4×/week for 8 weeks', '18', ' / 32 days · 30 days left', 56, 'calendar', 'ok')]


def searchrow(q='', filt=False):
    s = field(value=q, ph='Search challenges', icon='search', trail=ibtn('x', 'Clear', sm=True) if q else '')
    return row(col(s, style='flex: 1; min-width: 0'), ibtn('filter', 'Filters', 'pri' if filt else 'fill'), gap=8)


def pager(cur=0, n=3):
    items = [ibtn('back', 'Previous', 'fill' if cur > 0 else '', sm=True)]
    items += [btn(str(i + 1), 'pri' if i == cur else 'sec', sm=True, style='width: 36px; padding: 0') for i in range(n)]
    items += [ibtn('chev', 'Next', 'fill' if cur < n - 1 else '', sm=True)]
    return row(*items, gap=6, justify='center')


def ch_head(n=2):
    return row(txt('Challenges', 't-h1'), tag(f'{n} active', 'brass') if n else '', sp(), gap=10)


def hub(active=True, rows_=CAT, q='', filt=None, empty=False, page=0):
    out = [ch_head(2 if active else 0)]
    if active:
        out += [lbl('Active'), *ACTIVE]
    out += [lbl('Start a challenge'), searchrow(q, bool(filt))]
    if filt:
        out.append(row(chip(filt + ' ' + ico('x', 12), True), gap=8))
    if empty:
        out.append(card(txt('No challenges match that.', 't-s', 'text-align: center'), tone='dash', style='padding: 22px'))
    else:
        out += [lst(*[cat_row(*r) for r in rows_]), pager(page) if not filt else '']
    return out


P('P13-Challenges.dc.html', 'Apex · Challenges hub (scroll)', apex_phone(*hub(), tab='challenges', h=1820), row_=0, h=1820)

# ============================================================== Ranks (StandardsView)
TIERS_R = ['III', 'II', 'I', 'CMS', 'MS', 'MSIC']
TIERS_L = ['Beg', 'Nov', 'Int', 'Adv', 'Elite']
BW = 82.4


def lv(ratios):
    return [f'{round(r * BW / 2.5) * 2.5:g}' for r in ratios]


TRAINED = [  # name, system, best, thresholds, achievedIdx, nextIdx, toGo, progress
    ('Powerlifting total', 'rank', 478, ['337.5', '387.5', '437.5', '505', '572.5', '655'], 2, 3, 27, 60),
    ('Squat', 'rank', 163, ['132.5', '155', '167.5', '190', '220', '250'], 1, 2, 5, 64),
    ('Bench press', 'rank', 117, ['92.5', '102.5', '117.5', '132.5', '147.5', '167.5'], 1, 2, 1, 95),
    ('Deadlift', 'rank', 198, ['147.5', '157.5', '172.5', '190', '220', '250'], 3, 4, 22, 27),
]
UNTRAINED = [('Strict curl', 'rank', ['37.5', '45', '52.5', '57.5', '65', '72.5'])] + [
    (n, 'level', lv(r)) for n, r in [
        ('Overhead press', [0.42, 0.59, 0.78, 1.0, 1.23]), ('Barbell row', [0.62, 0.83, 1.1, 1.39, 1.71]),
        ('Front squat', [0.76, 1.0, 1.29, 1.62, 1.97]), ('Romanian deadlift', [0.83, 1.16, 1.54, 1.99, 2.46]),
        ('Incline bench', [0.64, 0.84, 1.09, 1.36, 1.63]), ('Close-grip bench', [0.71, 0.92, 1.17, 1.43, 1.72]),
        ('Hip thrust', [0.76, 1.23, 1.87, 2.62, 3.46]), ('Leg press', [1.41, 2.04, 2.83, 3.76, 4.77]),
        ('Leg extension', [0.59, 0.88, 1.23, 1.66, 2.12]), ('Leg curl', [0.49, 0.71, 1.0, 1.33, 1.69]),
        ('Lat pulldown', [0.58, 0.78, 1.02, 1.29, 1.58]), ('Seated cable row', [0.59, 0.8, 1.07, 1.36, 1.67]),
        ('Dumbbell bench', [0.24, 0.36, 0.49, 0.64, 0.82]), ('Incline dumbbell press', [0.28, 0.37, 0.49, 0.61, 0.76]),
        ('Dumbbell shoulder press', [0.2, 0.28, 0.39, 0.51, 0.66]), ('Lateral raise', [0.07, 0.12, 0.2, 0.3, 0.41])]]


def tier_cells(system, th, ach=-1, nxt=None):
    names = TIERS_R if system == 'rank' else TIERS_L
    cells = []
    for i, (n, k) in enumerate(zip(names, th)):
        on = i <= ach
        tone = 'apex' if on else ('dash' if i == nxt else '')
        cells.append(card(txt(n, 't-s c-brass' if on else ('t-s' if i == nxt else 't-s c-dim'), 'text-align: center'), txt(k, 't-m num', 'text-align: center'), tone=tone, pad=False, gap=1, style='padding: 8px 2px'))
    return grid(*cells, cols=len(names), gap=4)


def std_card(name, system, th, best=None, ach=-1, nxt=None, togo=0, prog=0, hero=False, maxed=False, below=False):
    cls = row(tag('Rank' if system == 'rank' else 'Level', 'brass' if system == 'rank' else 'neutral'),
              span('· up to 82.5 kg', 't-m') if system == 'rank' else '', gap=6)
    right = col(txt(str(best), 't-num num', 'text-align: right'), txt('kg · est. max', 't-m'), gap=2, style='align-items: flex-end') if best else tag('not started', 'neutral')
    parts = [row(col(txt(name, 't-h3'), cls, gap=4, style='flex: 1; min-width: 0'), right, gap=10, align='flex-start'), tier_cells(system, th, ach, nxt)]
    if best:
        names = TIERS_R if system == 'rank' else TIERS_L
        now_ = txt(f'below {names[0]}', 't-s c-dim') if below else txt(f'Now <b>{names[ach]}</b>', 't-s')
        nx = txt('Top reached!', 't-s c-ok') if maxed else txt(f'+{togo} kg → {names[nxt]}', 't-s num c-brass')
        parts += [bar(prog, 'apex'), row(now_, sp(), nx, gap=8)]
    return card(*parts, gap=12, tone='hero' if hero else '', style='padding: 16px 18px' if best else '')


def ranks_body():
    top = row(col(lbl('Bodyweight'), txt('82 kg', 't-h2 num'), gap=2), col(lbl('Sex'), txt('Male', 't-h2'), gap=2), sp(),
              btn('Edit profile', 'txt', 'edit', sm=True, style='height: 32px'), gap=26, style='padding: 0 2px')
    return [title('Ranks', 'strength standards', share=True), top, lbl('Your disciplines'),
            *[std_card(n, s, th, b, a, nx, tg, pr, hero=(i == 0)) for i, (n, s, b, th, a, nx, tg, pr) in enumerate(TRAINED)],
            lbl('Not training yet'), *[std_card(n, s, th) for n, s, th in UNTRAINED],
            txt('Ranks: raw amateur norms (WPF kRAWa). Levels: Strength Level community data. Estimated from your best set at your bodyweight.', 't-m')]


P('P13-Ranks.dc.html', 'Apex · Ranks (scroll)', apex_phone(*ranks_body(), tab='ranks', h=3900), row_=0, h=3900)

# ============================================================== Awards (FeatsView, hideSubtabs)
FEATS = [  # label, unlocked, total, current tier emoji, current title, progress %
    ('Volume lifted', 25, 37, '🗽', 'Statue of Liberty', 55), ('Strength clubs', 16, 31, '🏋️', '200 kg club', 80),
    ('Sessions', 7, 24, '🗓️', '100 sessions', 30), ('Weekly streak', 4, 18, '🔥', '45-day streak', 80),
    ('Personal records', 5, 18, '🏆', '25 PRs', 70), ('Time under the bar', 5, 17, '⏱️', '100 hours', 72),
    ('Sets completed', 6, 16, '🔁', '2k sets', 68), ('Reps performed', 5, 13, '🔢', '25k reps', 28),
    ('Exercise variety', 3, 11, '🎯', '35 exercises', 73), ('Biggest single day', 6, 12, '💥', '15k kg day', 17),
    ('Heaviest set', 9, 16, '🪨', '200 kg lift', 0), ('Longest session', 5, 10, '⏳', '105-min session', 33),
    ('Cardio distance', 4, 12, '🏃', '100 km', 24), ('Solid weeks', 4, 10, '✅', '26 solid weeks', 43),
    ('Days shown up', 3, 12, '📆', '100 days', 72), ('Months trained', 3, 11, '📅', '12 months', 50),
    ('Sunrise lifter', 1, 8, '🌅', '5 dawn sessions', 50), ('Night owl', 3, 8, '🦉', '25 night sessions', 13),
    ('Weekend warrior', 2, 8, '🏖️', '25 weekend sessions', 67),
]


def ftile(emoji, name, prog=None, on=False):
    """feat-cell: emoji + name; .on / .current = accent border, .ghost = dimmed; current carries the progress strip."""
    lit = on or prog is not None
    return card(span(emoji, 't-h1'), txt(name, 't-m' if lit else 't-m c-dim', 'text-align: center'), bar(prog, 'apex', 4) if prog is not None else '',
                tone='apex' if lit else 'dash', pad=False, gap=6, style='padding: 14px 6px 10px; align-items: center; justify-content: center; min-height: 104px')


def fblock(num, lab, earned=True):
    return card(txt(num, 't-num num c-brass' if earned else 't-num num', 'text-align: center'), txt(lab.upper(), 't-l', 'text-align: center'), tone='dash', pad=False, gap=3,
                style='padding: 10px 6px; justify-content: center; min-height: 96px')


def feat_section(label, un, tot, emoji, cur, prog, ghost=None):
    head = row(txt(label, 't-h3'), sp(), txt(f'{un}/{tot}', 't-m num'), gap=8)
    if un == tot:   # all unlocked: one earned block + the last tiles
        cells = [fblock(str(un), 'All earned'), ftile(emoji, cur, on=True), ftile(emoji, ghost or cur, on=True)]
    elif un == 0:   # nothing yet: current + next ghost + upcoming
        cells = [ftile(emoji, cur, prog), ftile(emoji, ghost, None), fblock(f'+{tot - 2}', 'Upcoming', False)]
    else:
        cells = [fblock(str(un), 'Earned'), ftile(emoji, cur, prog), fblock(f'+{tot - un - 1}', 'Upcoming', False)]
    return col(head, grid(*cells, cols=3, gap=10), gap=8)


def awards_body():
    nextup = card(row(span('🏋️', 't-big'), col(txt('200 kg club', 't-h2'), lbl('next milestone', 'apex'), bar(80, 'apex', 8),
                                              row(txt('198 kg', 't-num num'), sp(), txt('2 kg to go', 't-s')), gap=8, style='flex: 1'), gap=16), tone='hero', style='padding: 18px')
    return [title('Achievements', share=True), txt('116 of 292', 't-s num'), nextup, *[feat_section(*f) for f in FEATS]]


P('P13-Awards.dc.html', 'Apex · Awards (scroll)', apex_phone(*awards_body(), tab='awards', h=3220), row_=0, h=3220)

# ============================================================== Feed (NotificationsView embedded, title Milestones)
NOTIFS = [
    ('Today', [('Deadlift → CMS', '198 kg · a new tier', 'trophy', '2h', True, True), ('Bench press PR', '100 kg · up 2.5 kg', 'dumbbell', '5h', True, True)]),
    ('This week', [('190 kg club', 'achievement unlocked', 'star', 'Sat', True, True), ('42-day streak', 'keep it going', 'flame', 'Fri', False, False),
                   ('Challenge done: 30-day streak', 'you finished it', 'target', 'Thu', False, True)]),
    ('Earlier', [('Squat climbing', 'Top weight up 12 kg over ~3 months.', 'chart', '14 Sep', False, True),
                 ('Weekly volume goal met', 'Every muscle in its productive range', 'check', '7 Sep', False, True)]),
]


def nrow(t_, sub, icon, tm, unread, nav):
    lead = row(dot('brass') if unread else '<span style="width: 8px"></span>', tile(icon, 'brass' if unread else 'neutral'), gap=8)
    return li(t_, sub, lead, row(span(tm, 't-m'), ico('chev', 16) if nav else '', gap=4), style='padding-left: 10px')


def feed_body(mark=True, groups=NOTIFS):
    out = [row(txt('Milestones', 't-h1'), sp(), btn('Mark all read', 'txt', sm=True, style='height: 32px') if mark else '', gap=8)]
    for g, items in groups:
        out += [lbl(g), lst(*[nrow(*x) for x in items])]
    return out


P('P13-Feed.dc.html', 'Apex · Milestones feed (bell)', apex_phone(*feed_body(), tab='feed', feed=True, h=930), row_=0, h=930)

# ============================================================== ROW 1 · states
P('P13-Home-Empty.dc.html', 'Apex · Home · nothing yet', apex_phone(*home_body(empty=True), unread=0), row_=1)

P('P13-Challenges-NoActive.dc.html', 'Challenges · none active', apex_phone(*hub(active=False, rows_=[(a, b, c, d, 'idle') for a, b, c, d, e in CAT][:9]), tab='challenges', h=1000), row_=1, h=1000)

STRENGTH = [('Set 10 PRs', 'Strength', 'trophy', 'brass', 'idle'), ('Reach 100 kg bench', 'Strength', 'dumbbell', 'brass', 'idle'),
            ('Reach 140 kg squat', 'Strength', 'dumbbell', 'brass', 'idle'), ('Reach 180 kg deadlift', 'Strength', 'dumbbell', 'brass', 'idle'),
            ('Reach 60 kg overhead press', 'Strength', 'dumbbell', 'brass', 'idle'), ('Reach 100 kg barbell row', 'Strength', 'dumbbell', 'brass', 'idle')]
P('P13-Challenges-Filtered.dc.html', 'Challenges · filter Strength', apex_phone(*hub(rows_=STRENGTH, filt='Strength'), tab='challenges', h=1080), row_=1, h=1080)

P('P13-Challenges-NoMatch.dc.html', 'Challenges · search, no match', apex_phone(*hub(q='rowing marathon', empty=True), tab='challenges'), row_=1)

PAGE3 = [('600 min of cardio', 'Endurance', 'pulse', 'blue', 'idle'), ('25 cardio sessions', 'Endurance', 'pulse', 'blue', 'idle'),
         ('Burn 50,000 kcal', 'Endurance', 'flame', 'blue', 'idle'), ('500 pull-up reps', 'Bodyweight', 'body', 'ok', 'idle'),
         ('1,000 push-up reps', 'Bodyweight', 'body', 'ok', 'idle'), ('500 dip reps', 'Bodyweight', 'body', 'ok', 'idle'),
         ('1,000 bodyweight squat reps', 'Bodyweight', 'body', 'ok', 'idle')]
P('P13-Challenges-Page3.dc.html', 'Challenges · last page (3 of 3)', apex_phone(*hub(rows_=PAGE3, page=2), tab='challenges', h=1320), row_=1, h=1320)

P('P13-Ranks-Gate.dc.html', 'Ranks · profile missing', apex_phone(
    title('Ranks', 'strength standards', share=True),
    card(col(tile('me', 'brass', lg=True), txt('Finish your profile first', 't-h3', 'text-align: center'),
             txt('Standards are scaled to your body — add your sex and bodyweight in Profile to see them.', 't-s', 'text-align: center; max-width: 280px'),
             btn('Open profile', 'pri', sm=True), gap=10, style='align-items: center; padding: 26px 10px'), tone='dash'), tab='ranks'), row_=1)

P('P13-Awards-Empty.dc.html', 'Awards · no sessions yet', apex_phone(
    title('Achievements', share=True), empty('No feats yet', 'Finish sessions — volume adds up fast.', 'dumbbell'), tab='awards'), row_=1)

P('P13-Feed-Empty.dc.html', 'Milestones · empty', apex_phone(
    row(txt('Milestones', 't-h1'), gap=8),
    empty('No notifications yet', 'Milestones, PRs and streaks will show up here as you train.', 'bell'), tab='feed', feed=True, unread=0), row_=1)

READ = [(g, [(a, b, c, d, False, f) for a, b, c, d, e, f in items]) for g, items in NOTIFS]
P('P13-Feed-Read.dc.html', 'Milestones · all read', apex_phone(*feed_body(mark=False, groups=READ), tab='feed', feed=True, unread=0, h=930), row_=1, h=930)

P('P13-Home-Night.dc.html', 'Apex · Home · night mode', apex_phone(*home_body(), mood='moon', h=1000), row_=1, h=1000)
P('P13-Challenges-Night.dc.html', 'Challenges · night mode', apex_phone(*hub(rows_=CAT[:8]), tab='challenges', mood='moon', h=1300), row_=1, h=1300)

# ============================================================== ROW 2 · sheets & overlays
hub_short = hub(rows_=CAT[:8])


def behind(overlay, tab='challenges', h=844):
    return apex_phone(*hub_short, tab=tab, overlay=overlay, h=h)


filt_sheet = sheet(None, row(ibtn('back', 'Back', 'fill', sm=True), txt('Filters', 't-h2', 'flex: 1'), ibtn('x', 'Cancel', 'fill', sm=True), gap=10),
                   chips(['All', 'Volume', 'Consistency', 'Strength', 'Streaks', 'Endurance', 'Balance', 'Milestones', 'Bodyweight'], on=0), h=300)
P('P13-Filter-Sheet.dc.html', 'Challenges · filters', behind(filt_sheet), row_=2)


def start_sheet(icon, tone, name, cat, blurb, unit=None, value=None, durs=None, on=0, h=560, minus_off=False):
    head = row(tile(icon, tone, lg=True), col(txt(name, 't-h2'), txt(cat, 't-s'), gap=2), gap=12)
    parts = [head, txt(blurb, 't-b c-mut')]
    if unit:
        parts += [txt(f'Target — {unit}', 't-l'), col(stepper(value, ''), style='flex: none')]
    if durs:
        parts += [txt('Duration', 't-l'), seg(durs, on)]
    return sheet(None, *parts, h=h, footer=btn('Start challenge', 'pri', full=True))


P('P13-Start-Sheet.dc.html', 'Start challenge · adjustable target', behind(start_sheet(
    'layers', 'brass', '120 chest sets', 'Volume', 'Log hard chest sets before the clock runs out. Only sets in your productive range count.',
    'sets', '120', ['1 month', '2 weeks', '6 weeks', '3 months'])), row_=2)
P('P13-Start-Sheet-Strength.dc.html', 'Start challenge · strength target', behind(start_sheet(
    'dumbbell', 'brass', 'Reach 100 kg bench', 'Strength', 'Push your estimated bench 1RM to the target weight.',
    'kg', '100 kg', ['3 months', '6 months', '1 year'])), row_=2)
P('P13-Start-Sheet-Fixed.dc.html', 'Start challenge · fixed (streak)', behind(start_sheet(
    'flame', 'brass', '14-day streak', 'Streaks', 'Train (or take a planned rest day) every day, no gaps.', h=330)), row_=2)


def detail(t_='120 chest sets', kick='Volume', when='11 days left · ends 9 Oct', val='62', den='/120', pct=52, unit='sets',
           blurb='Log hard chest sets before the clock runs out. Only sets in your productive range count.', pace='~5/day to finish on time', foot=None):
    center = col(f'<div class="t-hero num">{val}<span class="t-h3 c-mut">{den}</span></div>', txt(f'{pct}% · {unit}', 't-l'), gap=4, style='align-items: center')
    by = col(lbl('By day'), heat(4, 7, seed=5, cell=36, gap=6), gap=8, style='align-items: center')
    body = col(row(ibtn('back', 'Back', 'fill', sm=True), txt(kick, 't-l', 'flex: 1; text-align: center'), '<span style="width: 36px"></span>'),
               txt(t_, 't-h1', 'text-align: center'), txt(when, 't-s', 'text-align: center'),
               row(ring(pct, 220, 'apex', 14, center), justify='center'),
               txt(blurb + (' ' + span(pace, 'c-brass') if pace else ''), 't-s', 'text-align: center'), by, sp(),
               foot or btn('Give up', 'dan', full=True), gap=14, style='height: 100%')
    return '<div class="scrim"></div>' * 4 + abs_(card(body, tone='glass', style='height: 100%; padding: 14px 16px 18px'), 'left: 10px; right: 10px; top: 30px; bottom: 16px')


P('P13-Detail.dc.html', 'Challenge detail', behind(detail()), row_=2)
confirm = card(txt('Give up this challenge? Your progress will be lost.', 't-s', 'text-align: center'),
               row(btn('Cancel', 'sec', full=True), btn('Give up', 'dan', full=True), gap=8), tone='bad', style='padding: 12px')
P('P13-Detail-GiveUp.dc.html', 'Challenge detail · give up?', behind(detail(foot=confirm)), row_=2)
P('P13-Detail-Ended.dc.html', 'Challenge detail · time’s up', behind(detail('Train 4×/week for 8 weeks', 'Consistency', 'Time’s up', '26', '/32', 81, 'days',
                                                                         'Log at least 4 training days each week.', None)), row_=2)
P('P13-Detail-Reach.dc.html', 'Challenge detail · reach target', behind(detail('Reach 100 kg bench', 'Strength', '72 days left · ends 9 Dec', '96 kg', '/100 kg', 96, 'kg',
                                                                              'Push your estimated bench 1RM to the target weight.', 'Reach it any time before the clock runs out.')), row_=2)

conf = ''.join(abs_(dot(t_), css) for t_, css in [('brass', 'left: 15%; top: 18%'), ('ok', 'right: 17%; top: 15%'), ('rest', 'left: 25%; top: 27%'),
                                                   ('brass', 'right: 24%; top: 30%'), ('sleep', 'left: 34%; top: 13%'), ('ok', 'right: 33%; top: 23%')])
complete = ('<div class="scrim"></div><div class="scrim"></div>' + conf +
            abs_(card(ring(100, 96, 'apex', 2, ico('trophy', 40)), lbl('Challenge complete', 'apex'), txt('120 chest sets', 't-h1', 'text-align: center'),
                     txt('You hit 120 sets in 19 days.', 't-b c-mut', 'text-align: center'), btn('Done', 'pri', full=True),
                     row(ico('bell', 14), txt('Posted to your notifications', 't-m'), gap=6, justify='center'), tone='hero', gap=14, style='align-items: center; padding: 28px 22px'),
                 'left: 24px; right: 24px; top: 220px'))
P('P13-Complete.dc.html', 'Challenge complete', behind(complete), row_=2)


def pop(inner, top=120):
    return '<div class="scrim"></div>' * 4 + abs_(card(*inner, tone='glass', gap=12, style='padding: 18px'), f'left: 20px; right: 20px; top: {top}px')


EARNED = [f'{n} kg club' for n in (40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190)]
listpop = pop([row(txt('Strength clubs · Earned', 't-h3'), sp(), txt('16', 't-h3 num c-brass')),
               grid(*[ftile('🏋️', n, on=True) for n in EARNED], cols=3, gap=8), btn('Close', 'sec', full=True)], top=60)
P('P13-Awards-List.dc.html', 'Awards · earned list', apex_phone(*awards_body()[:4], tab='awards', overlay=listpop, h=844), row_=2)


def featpop(emoji, name, badge, tone, val, mile):
    return pop([col(span(emoji, 't-big'), txt(name, 't-h2'), txt('Your best estimated 1-rep max on any single lift.', 't-s', 'text-align: center'),
                    tag(badge, tone), gap=10, style='align-items: center'),
                lst(li('Strength clubs', None, None, span(val, 'num')), li(span('Milestone', 'c-dim'), None, None, span(mile, 'num c-dim'))),
                btn('Close', 'sec', full=True)], top=200)


P('P13-Awards-Detail.dc.html', 'Awards · achievement (unlocked)', apex_phone(*awards_body()[:4], tab='awards', overlay=featpop('🏋️', '190 kg club', 'Unlocked 26 Sep', 'ok', '198 kg', '190 kg')), row_=2)
P('P13-Awards-Detail-Locked.dc.html', 'Awards · achievement (next)', apex_phone(*awards_body()[:4], tab='awards', overlay=featpop('🏋️', '200 kg club', '2 kg to go', 'neutral', '198 kg', '200 kg')), row_=2)


def share_sheet(kicker, hero, hero_lbl, headline, rows_, fmt=0):
    card_ = card(row(txt('spotter', 't-h3'), sp(), lbl(kicker.upper())), sp(h=10), txt(hero, 't-big num'), lbl(hero_lbl.upper()), txt(headline, 't-h3'),
                 lst(*[li(n, None, span(e, 't-h3'), span(d, 't-s num')) for e, n, d in rows_]), sp(h=6), txt('SPOTTER.APP', 't-l', 'text-align: center'),
                 tone='glass', gap=8, style='padding: 18px')
    acts = row(btn('Share', 'pri', 'share', style='flex: 1'), ibtn('download', 'Save image', 'fill'), ibtn('link', 'Copy', 'fill'), gap=8)
    return sheet(None, row(txt(kicker, 't-h2', 'flex: 1'), col(seg(['Story', 'Square'], fmt), style='width: 170px'), gap=10), card_, h=720, footer=acts)


RROWS = [('🏅', 'Powerlifting total', 'I · 478 kg'), ('🏅', 'Deadlift', 'CMS · 198 kg'), ('🏅', 'Squat', 'II · 163 kg'), ('🏅', 'Bench press', 'II · 117 kg')]
AROWS = [('🏋️', '190 kg club', '26 Sep'), ('🐳', 'Blue whale', '24 Sep'), ('🪨', '180 kg lift', '21 Sep'), ('🔢', '10k reps', '18 Sep'),
         ('⏳', '90-min session', '12 Sep'), ('🦉', '10 night sessions', '9 Sep')]
P('P13-Share-Ranks.dc.html', 'Ranks · share card', apex_phone(*ranks_body()[:4], tab='ranks', overlay=share_sheet('Ranks', '4', 'Lifts ranked', 'My strength standards', RROWS)), row_=2)
P('P13-Share-Awards.dc.html', 'Awards · share card', apex_phone(*awards_body()[:4], tab='awards', overlay=share_sheet('Achievements', '116', 'Awards earned', 'My Spotter achievements', AROWS)), row_=2)

# ============================================================== ROW 3 · desktop (AppRail) + components
def apex_desktop(content, active='home', w=1440, h=900, mood=''):
    """AppRail: brand mark · Home · Challenges · Ranks · Awards · (foot) bell · apps · language · avatar."""
    ri = lambda k, n, i: f'<button class="ri{" on" if k == active else ""}">{ico(i, 20)}<span>{n}</span></button>'
    foot = rel(ri('feed', '', 'bell'), abs_(tag('3', 'bad'), 'top: 2px; right: 0')) + ri('apps', '', 'grid') + ri('lang', '', 'globe') + avatar('M', 36)
    rail = '<div class="rail">' + tile('dumbbell', 'brass', lg=True) + sp(h=10) + ''.join(ri(*x) for x in NAV[:4]) + '<div style="flex: 1"></div>' + foot + '</div>'
    return (f'<div class="scr{mood_cls(mood or "art", "apex")}" style="width: {w}px; height: {h}px">{rail}'
            f'<div style="position: absolute; left: 76px; right: 0; top: 0; bottom: 0; padding: 28px 40px; display: flex; flex-direction: column; gap: 18px">{content}</div></div>')


dhome = col(*home_body(), gap=14, style='width: 640px')
board('P13-Desktop-Home.dc.html', 'Apex · desktop Home', 1440, 900, apex_desktop(dhome), row_=3)
dch = row(col(ch_head(), lbl('Active'), *ACTIVE, gap=14, style='width: 520px'),
          col(lbl('Start a challenge'), searchrow(), lst(*[cat_row(*r) for r in CAT[:12]]), gap=14, style='flex: 1; min-width: 0'), gap=32, align='flex-start')
board('P13-Desktop-Challenges.dc.html', 'Apex · desktop Challenges', 1440, 1000, apex_desktop(dch, 'challenges', h=1000), row_=3)

board('P13-Components.dc.html', 'Apex components · states', 1600, 720, apex_spec('Challenge rows and cards — every state (ChallengesView)',
    cap('Catalog row · start (+)', lst(cat_row('150 back sets', 'Volume', 'layers', 'brass', 'idle')), w=360),
    cap('Catalog row · in progress (clock)', lst(cat_row('120 chest sets', 'Volume', 'layers', 'brass', 'active')), w=360),
    cap('Catalog row · done (check)', lst(cat_row('30-day streak', 'Streaks', 'flame', 'brass', 'done')), w=360),
    cap('Accents · brass / ok / blue', lst(cat_row('Train 3×/week for 4 weeks', 'Consistency', 'calendar', 'ok', 'idle'), cat_row('Run: 50 km', 'Endurance', 'run', 'blue', 'idle')), w=360),
    cap('Active card · running', active_card('120 chest sets', '62', ' / 120 sets · 11 days left', 52), w=360),
    cap('Active card · time’s up', active_card('Train 4×/week for 8 weeks', '26', ' / 32 days · Time’s up', 81, 'calendar', 'ok', ended=True), w=360),
    cap('Pager (20 per page)', pager(1), w=360),
    cap('Apex Home · streak week dots (on · off · future)', streak_card(), w=360),
    cap('Ranks · below the first tier', std_card('Strict curl', 'rank', ['37.5', '45', '52.5', '57.5', '65', '72.5'], 35, -1, 0, 3, 88, below=True), w=360),
    cap('Ranks · top tier reached', std_card('Lateral raise', 'level', ['5', '10', '17.5', '25', '35'], 36, 4, None, 0, 100, maxed=True), w=360),
    cap('Awards · section, all earned', feat_section('Sunrise lifter', 8, 8, '🌅', '200 dawn sessions', None, '350 dawn sessions'), w=360),
    cap('Awards · section, nothing yet', feat_section('Cardio distance', 0, 12, '🏃', '5 km', 40, '10 km'), w=360),
    w=1600, h=720), row_=3)

# Upcoming list popup (FeatsView popup kind 'up')
UPC = [f'{n} kg club' for n in (210, 220, 230, 240, 250, 260, 280, 300, 325, 350, 375, 400, 450, 500)]
uppop = pop([row(txt('Strength clubs · Upcoming', 't-h3'), sp(), txt('14', 't-h3 num c-brass')),
             grid(*[ftile('🏋️', n) for n in UPC], cols=3, gap=8), btn('Close', 'sec', full=True)], top=40)
P('P13-Awards-Upcoming.dc.html', 'Awards · upcoming list', apex_phone(*awards_body()[:4], tab='awards', overlay=uppop, h=900), row_=2, h=900)

# StatShareSheet on desktop: square by default, Download image + Copy (no native share / save icon)
dshare = ('<div class="scrim"></div>' * 3 + abs_(card(row(txt('Achievements', 't-h2', 'flex: 1'), col(seg(['Story', 'Square'], 1), style='width: 190px'), ibtn('x', 'Cancel', 'fill', sm=True), gap=10),
          card(row(txt('spotter', 't-h3'), sp(), lbl('ACHIEVEMENTS')), txt('116', 't-big num'), lbl('AWARDS EARNED'), txt('My Spotter achievements', 't-h3'),
               lst(*[li(n, None, span(e, 't-h3'), span(d, 't-s num')) for e, n, d in AROWS]), txt('SPOTTER.APP', 't-l', 'text-align: center'), tone='glass', gap=8, style='padding: 18px'),
          row(btn('Download image', 'pri', 'download', style='flex: 1'), ibtn('link', 'Copy', 'fill'), gap=8), tone='', gap=14, style='padding: 20px'),
          'left: 460px; width: 520px; top: 60px'))
board('P13-Share-Desktop.dc.html', 'Awards · share card · desktop', 1440, 960,
      apex_desktop(col(*awards_body()[:4], gap=14, style='width: 640px'), 'awards', h=960)[:-6] + dshare + '</div>', row_=3)
print('ok')
