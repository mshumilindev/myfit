"""P04 · Session — 1:1 translation of the live session (views/SessionView.tsx, focus mode is the only live view)
and its components. Every label is an en.ts string; see fidelity/P04.md for the board → source map."""
from kit import *

import glob as _glob, os as _os
for _f in _glob.glob(_os.path.join(OUT, 'P04-*.dc.html')):
    _os.remove(_f)

GYM = 'Iron Temple'
CLOCK = '42:18'

# ============================================================== helpers (compose kit only)
import re

def shell(night=False):
    """App.tsx shell above every mobile overlay: .app-brand, then SleepHero while a night is live (paused off the sleep screen)."""
    return [brandbar(app='Gym')] + ([sleephero(paused=True, dur='1 h 12 min')] if night else [])


def shell_h(night=False):
    return -170 + (78 if night else 0)


def P4(file, title, content, row_=0, h=None):
    """Board height = the phone's own height (the shell adds rows on top)."""
    P(file, title, content, row_=row_, h=int(re.search(r'height: (\d+)px', content).group(1)))



def abs_box(inner, css):
    return f'<div style="position: absolute; {css}">{inner}</div>'


LABEL = {'live': f'In session · {GYM}', 'offline': 'In session · offline · 3 queued', 'draft': 'Starts with your first exercise', 'home': 'In session · Home'}


def hero_top(state='live', clock=CLOCK, meta='12 sets · 5.8 t · 6 exercises', night=False):
    """Full-bleed shell + 72 px LiveHero(mode=session). The session-top back button sits over the hero's left edge (styles.css .live-toolbar > .back)."""
    st = {'live': 'live', 'home': 'live', 'offline': 'offline', 'draft': 'closed'}[state]
    act = ibtn('pin', 'Change gym', 'fill', sm=True) if state != 'home' else ''
    lh = livehero('session', LABEL[state], clock, meta, action=act, state=st).replace('<div class="bd">', '<div class="bd" style="padding-left: 58px; right: 60px">', 1)
    if state == 'home':  # a home set runs on /home-hero.webp instead of the gym photo
        lh = lh.replace('<div class=bgp></div>', img('home-hero.webp', '100%', 72, 0, style='position: absolute; left: 0; top: 0'), 1)
    sh = ''.join(shell(night))
    sh = f'<div style="padding: 0 0 4px">{brandbar(app="Gym")}</div>' + (f'<div style="padding: 0 16px 8px">{sleephero(paused=True, dur="1 h 12 min")}</div>' if night else '')
    return sh + f'<div style="position: relative">{lh}{abs_box(ibtn("back", "Back", "fill", sm=True), "left: 12px; top: 18px")}</div>'


def strip(sets='12', moved='5.8', exs='6', extra=()):
    """.stats-strip: 18 px value + 10 px uppercase label, no chrome (e4)."""
    cells = [(sets, 'sets'), (moved + ' t', 'moved'), (exs, 'exercises')] + list(extra)
    return row(*[col(txt(v, 't-h3 num'), lbl(l), gap=1) for v, l in cells], gap=18, style='padding: 2px 2px 0')


def mchip(name, n):
    return tag(f'{name} · {n}' if n else name, 'neutral')


def steps(n=5, cur=1):
    """.plan-segments: 4 px, 3 px gap, dashed add."""
    segs = [f'<div style="flex: 1">{bar(100 if i <= cur else 0, "ok" if i < cur else "brass", 4)}</div>' for i in range(n)]
    segs.append(card(tone='dash', pad=False, style='width: 22px; height: 6px'))
    return row(*segs, gap=3)


def nav(next_label='Next · Incline dumbbell press'):
    """.focus-nav: 52 px buttons, discard outlined ruby, Next grows, Finish."""
    r = row(ibtn('trash', 'Discard session'), ibtn('back', 'Previous exercise', 'fill'),
            btn(next_label, 'sec', sm=True, style='flex: 1; min-width: 0; overflow: hidden; justify-content: flex-start; height: 48px'), ibtn('check', 'Finish', 'pri'), gap=8)
    return abs_box(r, 'left: 16px; right: 16px; bottom: 16px')


def ex_head(name, prev=None, plan=None, drag=False):
    """Focus card has no chrome and no drag handle; name 23 px."""
    return row(txt(name, 't-h2', 'flex: 1; min-width: 0'), txt(prev, 't-m') if prev else '', tag(plan, 'neutral') if plan else '', gap=8, style='padding: 6px 0 0')


def ex_chips(*extra, muscles=(('Chest', 4), ('Triceps', 2), ('Front delt', 2))):
    """.exercise-chips: quiet strip closed by a divider."""
    return row(ibtn('dumbbell', 'Equipment', 'fill', sm=True), *extra, *[mchip(a, b) for a, b in muscles], gap=6, wrap=True, style='padding: 6px 0 10px')


def expic(name, w, h, r=12, i=0):
    """The app's exercise photo (exercise-img/<id>/<i>.jpg) or its no-image barbell tile."""
    return exercise_pic(name, w, h, r, i)


def ex_photos(name='Bench press'):
    """.ex-photos: start + end frames (tags Start / End) when the lift has two photos, one frame when it has one, nothing when none."""
    a, b = exercise_img(name, 0), exercise_img(name, 1)
    lab = lambda t: abs_box(tag(t, 'neutral'), 'left: 8px; bottom: 8px')
    if a and b:
        return grid(f'<div style="position: relative">{img(a, "100%", 96, 12)}{lab("Start")}</div>', f'<div style="position: relative">{img(b, "100%", 96, 12)}{lab("End")}</div>', cols=2, gap=8, style='padding: 0 0 6px')
    if a:
        return f'<div style="padding: 0 0 6px">{img(a, "100%", 120, 12)}</div>'
    return ''


PH_TONE = {'Add load': 'ok', 'Hold': 'rest', 'Deload': 'illness', 'New': 'apex'}  # .prog-hint .ph-action per state (styles.css)


def prog_hint(delta, target, action, prev):
    d = span(delta, 't-s c-ok num') if delta else ''
    return row(d, span('→', 't-s c-dim'), span(target, 't-b num'), span('·', 't-s c-dim'), tag(action, PH_TONE[action]), *((span('·', 't-s c-dim'), span(prev, 't-m num')) if prev else ()),
               gap=6, style='padding: 8px 0 4px')


def set_head(c2='Reps', c3='Kg'):
    return row(span('#', 't-l', 'width: 22px'), span(c2, 't-l', 'width: 64px'), span(c3, 't-l', 'width: 64px'), gap=10, style='padding: 6px 16px 2px')


def rest_line(t, cls='t-m c-rest'):
    """.set-rest: 10 px rest-blue, right-aligned, between rows."""
    return txt(t, cls, 'text-align: right; padding: 2px 16px 0')


def srow(idx, reps, kg, tags='', warm=False, live=True, tone=None):
    """.set-row; warm-up values dim; a record row gets the brass wash (.focus-view .set-row.record) → glass strip."""
    c = 'c-dim' if warm else ''
    cells = row(span(reps, f'num {c}', 'width: 64px'), span(kg, f'num {c}', 'width: 64px'), gap=10)
    tr = tags + (span(ico('trash', 16), 'c-dim') if live else '')
    r = li(cells, None, span(str(idx), 'num t-m' + ('' if tone == 'ok' else ' c-dim'), 'width: 22px'), tr, style='min-height: 40px')
    return card(r, tone='glass', pad=False, style='margin: 2px 0') if tone == 'ok' else r


def t_rpe(v, est=False):
    return span(('~' if est else '@') + str(v), 't-m num')


T_PR = tag('PR', 'brass', 'trophy')  # .tag-pr = filled accent
T_WARM = span('warm-up', 't-m c-rest')  # .kind.twarm = --set-warmup blue
T_WORK = span('working', 't-m')


def t_fail(auto=False):
    return tag('F?' if auto else 'F', 'injury', 'flame')  # .tag-fail = --set-fail #ff7a45


def rest_card(time='1:12', of='2:30', pct=52, nxt='Next: Set 5 · 100 × 5', why='heavy load · free barbell · big muscle', done=False):
    """.rst-card (e2): 104 px ring, 26 px countdown; done = success tint, GO + overtime."""
    if done:
        center = col(span('GO', 't-l c-ok'), span(time, 't-num num'), gap=2, style='align-items: center')
        body = col(row(ico('timer', 15), lbl("Rest's over", 'ok'), gap=6), txt(nxt, 't-h3'), txt('Counting the extra time — it’s saved with the set.', 't-m'), gap=5, style='flex: 1; min-width: 0')
    else:
        center = col(span(time, 't-num num'), span(f'of {of}', 't-m'), gap=2, style='align-items: center')
        body = col(row(ico('timer', 15), lbl('Rest', 'rest'), gap=6), txt(nxt, 't-h3'), txt(why, 't-m') if why else '',
                   row(btn('−15', 'sec', sm=True), timein(of, label='Rest target'), btn('+15', 'sec', sm=True), gap=6), gap=5, style='flex: 1; min-width: 0')
    return f'<div style="padding: 12px 0 0">{card(row(ring(100 if done else pct, 104, "ok" if done else "rest", 7, center), body, gap=16), tone="ok" if done else "rest", style="padding: 14px")}</div>'


def ghost(title='Enter this set', reps='5', kg='100', extra='', fail_on=False, pr=False, kind_tone='glass', hold=None, log='Log', reps_label='Reps', drops=None, kind=None):
    """GhostSetRow in focus (.focus-view .gset) = setentry(), THE focal block."""
    t = title + (' · to failure' if fail_on else '')
    html = setentry(title=t, reps=reps, weight=kg, note=extra or None, log=log, drops=drops)
    kt = {'warmup': 'rest', 'drop': 'apex', 'reverse': 'active', 'sd': 'learn', 'fail': 'injury'}.get(kind)
    if fail_on:
        kt = 'injury'
    if reps_label != 'Reps':
        html = html.replace('>Reps<', f'>{reps_label}<', 1)
        html = html.replace(f'<span class="v">{reps}</span>', f'<span class="v">{timein("0:" + reps.zfill(2), label=reps_label)}</span>', 1)
    if kt:  # .focus-view .gset.kind-* : the set-type colour tints the entry card and its title
        html = html.replace('class="card hero pad"', f'class="card {kt} pad"', 1).replace('t-l c-brass', f't-l c-{kt}', 1)
    return f'<div style="padding: 14px 0 0">{html}</div>'


def ghost_plain(reps='5', kg='100'):
    """GhostSetRow outside focus (past / auto-closed): plain .gset, no brass glass."""
    return f'<div style="padding: 10px 0 0">{card(grid(stepper(reps, "", "Reps", big=False), stepper(kg, "", "Weight, kg", big=False), cols=2, gap=8), row(ibtn("sliders", "Set options", "fill"), ibtn("flame", "To failure", "fill"), btn("Log", "pri", style="flex: 1"), gap=8), gap=10, style="padding: 12px")}</div>'


def start_next(name='Incline dumbbell press'):
    """.focus-view .exercise-card .start-next { display: none } — hidden in focus."""
    return ''


def ex_card(*parts, tone='quiet'):
    """.focus-view .exercise-card: padding 0, no background, no border."""
    return card(*parts, tone=tone, pad=False, gap=0)


def tiles(items):
    """renderPickTiles: kicker, name, sub, ⓘ; first one primary."""
    out = []
    for i, (k, n, s) in enumerate(items):
        out.append(card(expic(n, '100%', 64, 10), txt(k, 't-l c-brass' if i == 0 else 't-l'), txt(n, 't-h3'), txt(s, 't-m'),
                        row(sp(), ibtn('info', 'Details', sm=True)), style='padding: 8px', gap=3))
    return grid(*out, cols=len(items), gap=8)


def session_screen(*body, h=1500, mood='art', state='live', clock=CLOCK, meta='12 sets · 5.8 t · 6 exercises', strip_=None, rest=None, cur=None,
                   chips=None, n=5, at=1, next_label='Next · Incline dumbbell press', overlay='', show_nav=True, rail_top=None, night=False):
    """Focus view. styles.css hides .live-rest (Current/Rest plaques), .muscles-worked and .session-rail in .session-focus."""
    h = max(844 + (78 if night else 0), h + shell_h(night))
    if night:
        mood = 'sky'
    ov = (nav(next_label) if show_nav else '') + overlay
    return phone(strip_ or strip(), steps(n, at), *body, sp(h=76), tabs=None, h=h, mood=mood, overlay=ov, top=hero_top(state, clock, meta, night))


BENCH_ROWS = [rest_line('Rest 3:40'), srow(1, '8', '60', T_WARM, warm=True), rest_line('Rest 1:45'), srow(2, '3', '80', T_WARM, warm=True),
              rest_line('Rest 2:30'), srow(3, '5', '97.5', t_rpe(8)), rest_line('Rest 2:41'), srow(4, '5', '100', t_rpe(9) + T_PR, tone='ok')]


def bench_card(rows=None, after='', photos=True, hint=True, tone='quiet'):
    return ex_card(ex_head('Bench press'), ex_chips(), ex_photos() if photos else '',
                   prog_hint('', '100 kg', 'Hold', 'prev 97.5 × 5') if hint else '', set_head(), *(rows if rows is not None else BENCH_ROWS), after, tone=tone)


# ============================================================== ROW 0 · live focus flow
P4('P04-Session.dc.html', 'Session · live, rest running (scroll)', session_screen(
    bench_card(after=rest_card() + ghost() + start_next()), h=1420), h=1420)

P4('P04-Rest-Over.dc.html', 'Rest over · PR attempt next', session_screen(
    bench_card(rows=BENCH_ROWS[4:], photos=False, after=rest_card('+0:24', done=True) +
               ghost('Set 5 · PR attempt', '5', '102.5', extra=row(ico('trophy', 16), txt('+2.5 kg over your best 100 kg', 't-s c-ok'), gap=6), pr=True) + start_next()),
    h=1150, rest='2:54'), h=1200, row_=0)

pr_block = card(row(tile('trophy', 'ok', lg=True), col(lbl('New record · Bench press', 'ok'), f'<div class="t-num num">100 kg × 5</div>', gap=4, style='flex: 1'), gap=12),
                grid(stat('e1RM', '117', '', '+2.9', 'ok'), stat('Best weight', '100', '', '+2.5', 'ok'), stat('Set volume', '500', '', '+12.5', 'ok'), cols=3, gap=8),
                row(btn('Share', 'sec', 'share', style='flex: 1'), btn('Nice — rest', 'ok', style='flex: 1'), gap=8),
                txt('Folds into the rest timer', 't-m', 'text-align: center'), tone='hero', gap=12)
P4('P04-PR.dc.html', 'Record moment', session_screen(
    bench_card(rows=BENCH_ROWS[4:], photos=False, after=f'<div style="padding: 12px 0 0">{pr_block}</div>' + start_next()),
    h=1080, mood='ok', rest='0:04'), h=1080, row_=0)

fail_note = f'<div style="padding: 12px 0 0">{card(row(span(ico("flame", 16), "c-injury"), txt("Read as to failure — 2+ reps short of the target", "t-s", "flex: 1"), btn("Not failure", "sec", sm=True), gap=8), tone="injury", style="padding: 8px 10px")}</div>'
P4('P04-Fail.dc.html', 'Set read as failure', session_screen(
    bench_card(rows=BENCH_ROWS[6:] + [rest_line('Rest 3:05'), srow(5, '3', '100', t_fail(True))], photos=False,
               after=fail_note + rest_card('2:40', '3:30', 76, 'Next: Set 6 · 95 × 5', 'to failure · heavy load · big muscle') +
               ghost('Enter this set', '5', '95', extra=row(span(ico('flame', 16), 'c-bad'), txt('You took the last set to failure', 't-s'), gap=6)) + start_next()),
    h=1270, mood='bad', rest='0:50', cur=('Bench press', 'Set 6')), h=1270, row_=0)

worth = col(row(lbl('Muscle gain from this set'), sp(), tag('Low', 'bad'), gap=8), bar(22, 'bad'),
            txt('About 22% of what your first set gave, and it tires you just as much. You can keep working this muscle if you want.', 't-m'), gap=6)
tired = card(row(tile('dumbbell', 'injury'), col(txt('Chest is tired', 't-h3'), txt('18% weaker than your best set · 9 hard sets done', 't-m'), gap=2, style='flex: 1'), ico('up', 18), gap=10),
             txt('<b>Why:</b> your chest got 9 hard sets today, and your last set was 18% weaker than your best one. Past this point extra sets mostly add tiredness, not muscle.', 't-s'),
             tiles([('NEXT · TODAY’S PLAN', 'Triceps pushdown', 'Triceps'), ('FRESH MUSCLE · SIDE DELT', 'Lateral raise', 'barely worked today')]), gap=10)
P4('P04-Fatigue.dc.html', 'Muscle tired · worth meter', session_screen(
    ex_card(ex_head('Cable crossover'), ex_chips(muscles=(('Chest', 9), ('Front delt', 3))), prog_hint('', '20 kg', 'Hold', 'prev 20 × 12'), set_head(),
            rest_line('Rest 3:10'), srow(1, '12', '20', t_rpe(8)), rest_line('Rest 1:32'), srow(2, '10', '20', t_rpe(9)),
            ghost('Enter this set', '10', '20', extra=worth) + f'<div style="padding: 12px 0 0">{tired}</div>' + start_next('Dips - Triceps Version')),
    h=1570, rest='1:40', cur=('Cable crossover', 'Set 3'), chips=(('Chest', 9), ('Triceps', 4), ('Front delt', 3)), at=3, next_label='Next · Superset A'), h=1570, row_=0)

# ============================================================== ROW 1 · kinds & states
es_tiles = grid(*[card(expic(n, '100%', 64, 10), lbl(k), txt(n, 't-h3'), txt(s, 't-m'), row(sp(), ibtn('info', 'Details', sm=True)), style='padding: 8px', gap=4)
                  for k, n, s in [('USUALLY 2nd', 'Incline dumbbell press', 'Chest'), ('USUALLY 3rd', 'Cable crossover', 'Chest'),
                                  ('USUALLY 4th', 'Dips - Triceps Version', 'Triceps'), ('USUALLY 5th', 'Triceps pushdown', 'Triceps')]], cols=2, gap=8)
empty_start = col(
    card(row(atlas_face(36), col(lbl('ATLAS’S PLAN FOR TODAY'), txt('Chest 2', 't-h3'), txt('~55 min · 5 lifts', 't-m'), gap=2, style='flex: 1'), btn('Start', 'pri', 'play', sm=True), gap=10), style='padding: 10px 12px'),
    card(row(span(ico('heart', 16), 'c-ok'), txt('Readiness · <b>all recovered</b>', 't-s'), gap=8),
         grid(*[col(row(txt(m, 't-s'), sp(), span(p, 't-s num c-ok')), bar(int(p[:-1]), 'ok', 4), gap=6) for m, p in [('Chest', '96%'), ('Triceps', '91%')]], cols=2, gap=10), style='padding: 12px 14px'),
    card(expic('Bench press', '100%', 130, 12), row(col(lbl('USUALLY 1st · MONDAY', 'brass'), txt('Bench press', 't-h2'), txt('Last time 97.5 kg × 5 · aim 100 kg × 5', 't-s num'), gap=3, style='flex: 1'),
                                         ibtn('play', 'Start', 'pri'), ibtn('info', 'Details', 'fill', sm=True), gap=8), tone='hero', gap=10, style='padding: 10px'),
    es_tiles,
    card(row(tile('rotate', 'brass'), col(txt('Circuit', 't-h3'), txt('Exercises back to back, in rounds', 't-m'), gap=2, style='flex: 1'), btn('Start', 'sec', 'play', sm=True), gap=10), style='padding: 10px 12px'),
    gap=12)
P4('P04-Session-Empty.dc.html', 'Session · not started (scroll)', phone(
    strip('0', '0', '0'), empty_start, sp(h=70), tabs=None, h=1260, mood='art', top=hero_top('draft', '0:00', '0 sets · 0 t · 0 exercises'),
    overlay=abs_box(btn('Add exercise', 'pri', 'plus', full=True), 'left: 16px; right: 16px; bottom: 18px')), h=1330, row_=1)

marker = ex_card(ex_head('Warm-up', 'Warm-up'),
                 f'<div style="padding: 4px 12px 12px">{card(img("markers/warmup.jpg", "100%", 130, 12), row(tile("flame", "brass"), col(txt("Ready when you are · ~8 min", "t-h3"), txt("Just a marker — no sets, minutes or weight to log.", "t-m"), gap=2, style="flex: 1"), ibtn("sliders", "Set options", "fill", sm=True), gap=10), style="padding: 10px", gap=10)}</div>',
                 start_next('Bench press'))
P4('P04-Warmup-Marker.dc.html', 'Warm-up marker step', session_screen(marker, h=844, clock='0:00', meta='0 sets · 0 t · 6 exercises', strip_=strip('0', '0', '6'),
                                                                     cur=('Warm-up', ''), rest=None, chips=None, at=0, next_label='Next · Bench press'), h=844, row_=1)

P4('P04-Warmup-Ramp.dc.html', 'Warm-up ramp · first set', session_screen(
    ex_card(ex_head('Bench press'), ex_chips(muscles=(('Chest', 0), ('Triceps', 0), ('Front delt', 0))), ex_photos('Bench press'), prog_hint('+2.5', '100 kg', 'Add load', 'prev 97.5 × 5'),
            ghost('Warm-up 1 of 3', '10', '40', kind='warmup'), start_next(), txt('Warm-up ramp toward 100 kg — working sets come next', 't-m', 'padding: 0 16px 14px')),
    h=980, clock='8:12', meta='0 sets · 0 t · 6 exercises', strip_=strip('0', '0', '6'), cur=('Bench press', 'Set 1'), rest=None, chips=None), h=980, row_=1)

nextup = card(row(tile('chev', 'brass'), col(txt('Next up', 't-h3'), txt('What usually comes next — tap to add', 't-m'), gap=2, style='flex: 1'), ico('up', 18), gap=10),
              tiles([('NEXT · TODAY’S PLAN', 'Cable crossover', 'Chest'), ('SAME MUSCLE · UPPER CHEST', 'Incline cable fly', 'still has room today')]), gap=10)
P4('P04-PerSide.dc.html', 'Per hand ×2 · next up', session_screen(
    ex_card(ex_head('Incline dumbbell press'), ex_chips(tag('×2 per hand', 'brass'), muscles=(('Chest', 3), ('Front delt', 2))), prog_hint('+2', '34 kg', 'Add load', 'prev 32 × 10'), set_head(),
            rest_line('Rest 2:05'), srow(1, '10', '32', t_rpe(7)), rest_line('Rest 2:00'), srow(2, '10', '32', t_rpe(8)), rest_line('Rest 2:12'), srow(3, '9', '32', t_rpe(9)),
            rest_card('0:58', '2:00', 48, 'Next: Set 4 · 32 × 10', 'moderate load · big muscle') + ghost('Enter this set', '10', '32') +
            f'<div style="padding: 12px 0 0">{nextup}</div>' + start_next('Cable crossover')),
    h=1440, cur=('Incline dumbbell press', 'Set 4'), rest='1:02', chips=(('Chest', 7), ('Triceps', 2), ('Front delt', 4)), at=2, next_label='Next · Cable crossover'), h=1660, row_=1)

fss = card(row(tag('Superset A', 'brass'), txt('Round 2 of 3 · no rest between', 't-s', 'flex: 1'), ibtn('more', 'Menu', sm=True), gap=8),
           lst(li('Dips - Triceps Version', None, tag('A1', 'neutral'), span('2/3', 'num t-s')), li('Triceps pushdown', None, tag('A2', 'brass'), span('1/3', 'num t-s'))), gap=10)
P4('P04-Superset.dc.html', 'Superset step', session_screen(
    fss,
    ex_card(ex_head('Triceps pushdown', 'prev 35 × 12'), ex_chips(muscles=(('Triceps', 1),)), set_head(), rest_line('Rest 0:12'), srow(1, '12', '35', T_WORK),
            ghost('Enter this set', '12', '35')),
    h=1060, cur=('Triceps pushdown', 'Set 2'), rest='0:08', chips=(('Chest', 13), ('Triceps', 5), ('Front delt', 4)), at=4, next_label='Next exercise'), h=1060, row_=1)


DROPROWS = [rest_line('Rest 1:40'), srow(1, '12', '14', T_WORK),
            rest_line('Rest 1:35'), srow(2, '10', '14', span(ico('down', 12) + ' drop', 't-m c-apex')),
            f'<div style="padding: 0 16px 0 48px">{col(*[row(span(r, "t-s num c-mut", "width: 64px"), span(w, "t-s num c-mut", "width: 64px"), span(k, "t-m"), gap=10) for r, w, k in [("8", "10", "drop 1"), ("6", "6", "drop 2")]], gap=4)}</div>',
            row(txt('3 drops · 24 reps', 't-m'), sp(), txt('512 kg in one set', 't-m num'), style='padding: 6px 16px 0 48px')]
P4('P04-Dropset.dc.html', 'Dropset · logged + entry', session_screen(
    ex_card(ex_head('Lateral raise', 'prev 14 × 12'), ex_chips(tag('×2 per hand', 'brass'), muscles=(('Side delt', 2),)), set_head(), *DROPROWS,
            ghost('Dropset', '10', '14', drops=[('8', '10'), ('6', '6')], kind='drop')),
    h=1210, clock='58:02', meta='20 sets · 7.4 t · 6 exercises', strip_=strip('20', '7.4', '6'), n=6, at=5, next_label='Next exercise'), h=1210, row_=1)

pips = lambda n, done: row(*[f'<div style="flex: 1">{bar(100 if i < done else (40 if i == done else 0), "ok" if i < done else "brass", 6)}</div>' for i in range(n)], gap=5)
cblock = card(row(tile('rotate', 'brass'), col(txt('Circuit A', 't-h2'), txt('3 exercises · 4 rounds', 't-m'), gap=2, style='flex: 1'), col(span('1/4', 't-h3 num'), lbl('rounds'), gap=0, style='align-items: flex-end'), gap=10),
              pips(4, 1),
              lst(*[li(n, None, tag(s, 'neutral'), row(*[mchip(m, c) for m, c in ms], gap=4)) for s, n, ms in
                    [('A1', 'Kettlebell swing', (('Glutes', 1),)), ('A2', 'Pushups', (('Chest', 1),)), ('A3', 'Bodyweight squat', (('Quads', 1),))]]),
              btn('Continue round 2', 'pri', 'play', full=True), tone='hero', gap=12)
P4('P04-Circuit.dc.html', 'Circuit step', session_screen(cblock, h=844, clock='31:08', meta='3 sets · 0.4 t · 3 exercises', strip_=strip('3', '0.4', '3'),
                                                        cur=('Kettlebell swing', 'Set 2'), rest='0:40', chips=(('Glutes', 1), ('Chest', 1), ('Quads', 1)), n=1, at=0, next_label='Next exercise'), h=844, row_=1)

cbanner = card(row(tile('rotate', 'brass'), col(txt('Adding to Circuit A', 't-h3'), txt('2 so far · next add joins the loop', 't-m'), gap=2, style='flex: 1'), btn('Finish set', 'sec', sm=True), gap=10), style='padding: 10px 12px')
cbuild = card(lbl('Building the circuit'),
              lst(*[li(n, None, tag(s, 'neutral'), row(mchip(m, 0), span(ico('list', 16), 'c-dim'), gap=6)) for s, n, m in [('A1', 'Kettlebell swing', 'Glutes'), ('A2', 'Pushups', 'Chest')]]),
              row(ico('rotate', 16), txt('Rounds', 't-b', 'flex: 1'), ibtn('minus', '-', 'fill', sm=True), span('4', 't-h3 num'), ibtn('plus', '+', 'fill', sm=True), gap=8),
              btn('Add another exercise', 'sec', 'plus', full=True), btn('Done — start Circuit A', 'pri', 'check', full=True), gap=12)
P4('P04-Circuit-Building.dc.html', 'Circuit · building', session_screen(cbanner, cbuild, h=844, clock='24:40', meta='0 sets · 0 t · 2 exercises', strip_=strip('0', '0', '2'),
                                                                     cur=('Kettlebell swing', 'Set 1'), rest=None, chips=None, n=1, at=0, next_label='Next exercise'), h=844, row_=1)

hold = col(
           card(lbl('Set 2 · holding', 'brass'), col(span('0:42', 't-hero num'), txt('Holding — tap Release when you let go', 't-s'), gap=6, style='align-items: center; padding: 10px 0'),
                row(ibtn('x', 'Cancel this hold', 'fill'), btn('Release · log 42 s', 'pri', 'check', style='flex: 1'), gap=8), tone='hero', gap=12, style='padding: 16px'), gap=8)
P4('P04-Hold.dc.html', 'Home set · timed hold running', session_screen(
    ex_card(ex_head('Plank'), ex_chips(muscles=(('Core', 1),)), set_head('Hold', 'Kg'), srow(1, '0:55', 'BW', span('S-D', 't-m')), f'<div style="padding: 14px 0 0">{hold}</div>'),
    h=844, state='home', clock='18:30', meta='4 sets · 3 moves', strip_=strip('4', '0', '3'), cur=('Plank', 'Set 2'), rest=None, chips=(('Core', 2), ('Chest', 3)), n=3, at=2,
    next_label='Next exercise'), h=844, row_=1)

cardio_photo = f'<div style="position: relative; padding: 6px 0 8px">{img("equipment/cardio-treadmill.jpg", "100%", 130, 12)}{abs_box(btn("Change machine", "sec", "swap", sm=True), "left: 10px; bottom: 18px")}</div>'
P4('P04-Cardio.dc.html', 'Cardio · interval running', session_screen(
    ex_card(ex_head('Treadmill', 'Cardio'), cardio_photo,
            row(span('#', 't-l', 'width: 22px'), span('Time', 't-l', 'width: 64px'), span('Km', 't-l', 'width: 64px'), span('RPE', 't-l'), gap=10, style='padding: 6px 16px 4px'),
            li(row(span('10', 'num', 'width: 64px'), span('1.6', 'num', 'width: 64px'), gap=10), '9.5 km/h · 1 %', span('1', 'num t-h3 c-dim', 'width: 22px'), span('—', 't-m')),
            f'<div style="padding: 14px 0 0">{card(row(span("6:24", "t-hero num"), sp(), btn("Stop", "pri", "pause"), gap=10), tone="hero", style="padding: 12px 14px")}</div>'),
    h=844, clock='1:02:10', meta='18 sets · 6.9 t · 6 exercises', strip_=strip('18', '6.9', '6', (('16', 'cardio min'), ('1.6', 'km'))), cur=('Treadmill', ''), rest=None,
    n=6, at=5, next_label='Next exercise'), h=844, row_=1)

P4('P04-Offline.dc.html', 'Session · offline, queued', session_screen(
    bench_card(rows=BENCH_ROWS[4:], photos=False, after=rest_card() + ghost()), h=1170, state='offline', mood='bad'), h=1260, row_=1)

P4('P04-Undo.dc.html', 'Set deleted · undo', session_screen(
    bench_card(rows=BENCH_ROWS[:6], photos=False, after=ghost('Enter this set', '5', '100')), h=1000, cur=('Bench press', 'Set 4'), rest=None,
    chips=(('Chest', 3), ('Triceps', 2), ('Front delt', 2)), show_nav=False, overlay=snack('Set deleted · 5 × 100 kg', 'Undo', 22)), h=1000, row_=1)

music_hint = card(row(art(36, 1, 8), txt('At 100 kg last time you had <b>Training Season</b>', 't-s', 'flex: 1'), btn('Play', 'sec', 'play', sm=True), gap=10), style='padding: 10px 12px')
P4('P04-Music.dc.html', 'Session · Music (planned, V2)', session_screen(
    music_hint, bench_card(rows=BENCH_ROWS[4:], photos=False, after=rest_card() + ghost()), h=1400,
    overlay=miniplayer().replace('bottom: 90px', 'bottom: 80px')), h=1400, row_=1)

# ============================================================== ROW 2 · sheets
BEHIND = session_screen(bench_card(rows=BENCH_ROWS[4:], photos=False), h=844, show_nav=False)


def behind(overlay, h=844, night=False):
    return session_screen(bench_card(rows=BENCH_ROWS[4:], photos=False), h=h + 170, show_nav=False, overlay=overlay, night=night)


def opts(tab, *body, h=790, name='Bench press', n=4):
    head = row(expic(name, 44, 44, 10), col(txt(name, 't-h3'), txt(f'Sets · {n}', 't-m'), gap=2, style='flex: 1'), gap=10)
    tabs = seg(['This set', 'Exercise', 'Session'], tab)
    pinned = row(btn('Muscle map', 'sec', 'body', style='flex: 1'), btn('Discard session', 'dan', 'trash', style='flex: 1'), gap=8)
    return sheet(None, head, tabs, *body, h=h, footer=pinned)


def set_editor(title, logged=None, embedded=False, rpe_on=4):
    parts = [row(txt(title, 't-h2', 'flex: 1'), txt(logged, 't-m') if logged else '', gap=8),
             lbl('Load type'), card(seg(['Weight', 'Assist', 'Band']), grid(stepper('5', '', 'Reps', big=False), stepper('100', '', 'Weight, kg', big=False), cols=2, gap=6), style='padding: 10px'),
             lbl('Set type'), card(row(*[chip(x, i == 0) for i, x in enumerate(['Working', 'Warm-up', 'Dropset', 'Reverse dropset', 'Static-dynamic'])], gap=6, wrap=True), style='padding: 10px'),
             lbl('Effort (RPE)'), card(row(*[chip(x, i == rpe_on) for i, x in enumerate(['Skip', '6', '7', '8', '9', '10', 'F'])], gap=5, wrap=True), txt('1 more rep was possible', 't-m'), style='padding: 10px', gap=8),
             lbl('More'), lst(li('Unit', None, span(ico('scale', 18), 'c-dim'), f'<div style="width: 120px">{seg(["kg", "lb"])}</div>'),
                              li('Plate calculator', None, span(ico('weight', 18), 'c-dim'), span('100 kg', 't-s num')),
                              li('Bodyweight set', None, span(ico('dumbbell', 18), 'c-dim'), toggle(False)))]
    if not embedded:
        parts.append(lst(li('Exercise settings', None, span(ico('gear', 18), 'c-dim'), chev=True)))
    return parts


ed_actions = lambda primary: row(btn('Delete set', 'dan', 'trash', sm=True), btn('Cancel', 'sec'), btn(primary, 'pri', style='flex: 1'), gap=8)

P4('P04-Opts-Set.dc.html', 'Options · This set (scroll)', behind(opts(0, *set_editor('Set 5', embedded=True), ed_actions('Log').replace(btn('Delete set', 'dan', 'trash', sm=True), ''), h=990), h=1060), h=1060, row_=2)

P4('P04-Edit-Set.dc.html', 'Edit logged set (scroll)', behind(sheet(None, *set_editor('Set 4 · Bench press', 'logged 41:02'), h=880, footer=ed_actions('Save')), h=950), h=950, row_=2)

ex_opts = [lbl('Change'),
           lst(li('Replace exercise', None, span(ico('swap', 18), 'c-dim')), li('Equipment', None, span(ico('dumbbell', 18), 'c-dim'))),
           lbl('Look up'),
           lst(li('Details', None, span(ico('info', 18), 'c-dim')), li('Open history', None, span(ico('progress', 18), 'c-dim'))),
           row(btn('Duplicate with sets', 'sec', 'plus', sm=True, style='flex: 1'), btn('Clear all sets', 'sec', 'rotate', sm=True, style='flex: 1'), gap=8),
           lst(li('Delete exercise', None, span(ico('trash', 18), 'c-bad'), tone='bad'))]
P4('P04-Opts-Exercise.dc.html', 'Options · Exercise', behind(opts(1, *ex_opts)), row_=2)

ex_opts_db = [lbl('Change'),
              card(row(span(ico('sliders', 18), 'c-dim'), txt('Sides', 't-b', 'flex: 1'), f'<div style="width: 180px">{seg(["Both", "One side"], 1)}</div>', gap=10),
                   row(ico('info', 14), txt('Log one side · counts ×2 in volume', 't-m'), gap=6), style='padding: 10px 14px'),
              lst(li('Replace exercise', None, span(ico('swap', 18), 'c-dim')), li('Equipment', None, span(ico('dumbbell', 18), 'c-dim')),
                  li('Superset with…', None, span(ico('layers', 18), 'c-dim')))]
P4('P04-Opts-Exercise-Sides.dc.html', 'Options · Exercise · sides + superset', behind(opts(1, *ex_opts_db, h=620, name='Incline dumbbell press', n=3)), row_=2)

P4('P04-Opts-Session.dc.html', 'Options · Session', behind(opts(2,
    card(row(tile('rotate', 'brass'), col(txt('Circuit', 't-h3'), txt('Exercises you add next join one round-based circuit — like a crossfit block.', 't-m'), gap=2, style='flex: 1'), toggle(False), gap=10),
         txt("Run any number of exercises in rounds. Turn it off to go back to normal exercises — it's not a superset, so the loop mark shows wherever it appears.", 't-s')),
    lst(li('Today’s readiness', None, span(ico('pulse', 18), 'c-dim')), li('Change gym', GYM, span(ico('pin', 18), 'c-dim'))), h=640)), row_=2)

rest_sheet = sheet('Rest for Bench press',
                   lbl('Target'), row(chip('Auto · 2:30', True), *[chip(x) for x in ['0:45', '1:00', '1:30', '2:00', '2:30', '3:00', '4:00']], gap=6, wrap=True),
                   row(txt('Target', 't-s', 'flex: 1'), timein('2:30', label='Target'), gap=10),
                   card(txt('Auto picks 2:30 for the last set:', 't-s'), row(tag('heavy load +30 s', 'rest'), tag('free barbell +15 s', 'rest'), tag('big muscle +15 s', 'rest'), tag('hard set +15 s', 'rest'), gap=6, wrap=True), style='padding: 10px 12px'),
                   lbl('When it ends'),
                   lst(li('Vibrate', 'Short double buzz', None, toggle(True)), li('Sound', 'Soft chime', None, toggle(True)),
                       li('Keep screen on', 'During a live workout — so the alert comes on time', None, toggle(True)),
                       li('Notify in the background', 'Best effort — a web app may get it late on a locked phone', None, toggle(False))),
                   btn('Test the alert', 'txt', 'bell', style='align-self: flex-start'),
                   h=800, close=False, footer=row(btn('Cancel', 'sec', style='flex: 1'), btn('Save', 'pri', style='flex: 1'), gap=8))
P4('P04-Rest-Settings.dc.html', 'Rest target & alerts', behind(rest_sheet), row_=2)

P4('P04-Plates.dc.html', 'Plate calculator', behind(sheet(None,
    row(ico('weight', 20), txt('Plate calculator', 't-h2', 'flex: 1'), f'<div style="width: 130px">{seg(["Solve", "Build"])}</div>', gap=8),
    field('Target', '100', trail=span('kg', 't-m')),
    row(barbell(per_side=(25, 15), w=358, h=132), justify='center'),
    row(f'<div class="t-num num">100 {span("kg", "t-m")}</div>', sp(), txt('Per side', 't-m'), plates_legend((25, 15)), gap=8),
    lbl('Bar'), row(chip('20', True), chip('15'), chip('10'), gap=6),
    row(f'<div style="width: 140px">{seg(["kg", "lb"])}</div>', chip('Collars'), gap=10),
    h=620, footer=btn('Use 100 kg', 'pri', 'check', full=True))), row_=2)

FAMG = {'Chest': ('front', ('chest',)), 'Back': ('back', ('lats', 'back', 'traps', 'lower_back')), 'Shoulders': ('front', ('shoulders',)),
        'Arms': ('front', ('biceps', 'triceps', 'forearms')), 'Legs': ('front', ('quads', 'adductors', 'calves')), 'Core': ('front', ('core',))}
READY = {'bad': 'danger', 'brass': 'brass', 'ok': 'ok', 'kcal': 'kcal', 'neutral': 'neutral'}  # recovery.ts READINESS_COLOR


def fam(n, st, subs, tone, today=False):
    """.xp-fam: FamilyFigure (body painted in the readiness colour) + name + state + subs."""
    v, gs = FAMG[n]
    fig = bodymap(v, paint={g: READY[tone] for g in gs}, h=72)
    return card(row(fig, col(row(txt(n, 't-h3'), sp(), tag('Today', 'brass') if today else ''), row(dot(tone), txt(st, 't-m'), gap=6), txt(subs, 't-m'), gap=3, style='flex: 1; min-width: 0'), gap=8, align='flex-start'),
                tone='glass' if today else '', style='padding: 8px 10px', gap=4)


wide = lambda k, n, why, tgt, first=False: card(row(expic(n, 56, 56, 10), col(lbl(k, 'brass'), txt(n, 't-h3'), txt(why, 't-m'), txt(tgt, 't-s c-brass num'), gap=2, style='flex: 1'),
                                                    ibtn('info', 'Details', sm=True), gap=10), tone='glass' if first else '', style='padding: 10px')
picker_home = sheet(None,
                    row(txt('Add exercise', 't-h2'), txt('Chest 2 · 1 done', 't-s'), gap=10, align='baseline'),
                    search('Search by name, muscle or equipment'),
                    seg(['Strength', 'Warm-up', 'Cardio', 'Cool-down']),
                    row(span(ico('check', 16), 'c-ok'), txt('Done today: Bench press', 't-s'), gap=6),
                    row(lbl('Suggested for Chest 2', 'brass'), sp(), txt('Tap to add · ⓘ details', 't-m')),
                    wide('Your usual', 'Incline dumbbell press', 'Done 14× before', 'Try 34 × 10', True),
                    wide('Weak point', 'Cable crossover', 'Chest under target lately', 'Last 20 × 12'),
                    wide('Good fit', 'Triceps pushdown', 'Triceps is ready', 'Try 37.5 × 12'),
                    row(lbl('Or pick a muscle group'), sp(), chip('Equipment', icon='dumbbell'), gap=8),
                    grid(fam('Chest', 'Recovering', 'Upper chest · Lower chest', 'bad', True), fam('Back', 'Ready · 3 d ago', 'Lats · Traps · Lower back', 'ok'),
                         fam('Shoulders', 'Almost ready', 'Front delt · Side delt · Rear delt', 'brass'), fam('Arms', 'Ready · 4 d ago', 'Biceps · Triceps · Forearms', 'ok'),
                         fam('Legs', 'Due · 9 d ago', 'Quads · Hamstrings · Glutes · Calves', 'kcal'), fam('Core', 'Not trained yet', 'Core', 'neutral'), cols=2, gap=8),
                    h=1110, close=False)
P4('P04-Picker.dc.html', 'Exercise picker · home (scroll)', behind(picker_home, h=1180), h=1180, row_=2)


def hl(name, q):
    i = name.lower().find(q)
    return name[:i] + span(name[i:i + len(q)], 'c-brass') + name[i + len(q):]


prow = lambda n, meta, badge=None, pic='': li(n, meta, expic(pic or re.sub('<[^>]+>', '', n), 44, 44, 10), (badge or '') + ibtn('info', 'Details', sm=True))
P4('P04-Picker-Search.dc.html', 'Exercise picker · search', behind(sheet(None,
    row(f'<div style="flex: 1">{search("Search", "incl")}</div>', btn('Cancel', 'txt'), gap=6),
    lbl('Results · 4'),
    lst(prow(hl('Incline dumbbell press', 'incl'), 'Dumbbell · 32 × 10', tag('Suggested', 'brass')),
        prow(hl('Incline bench press', 'incl'), 'Barbell · 80 × 6', tag('Yours', 'neutral')),
        prow(hl('Incline machine press', 'incl'), 'Machine · + triceps'),
        prow(hl('Incline cable fly', 'incl'), 'No cable here')),
    lst(li('Browse all of Chest › Upper chest', None, None, None, chev=True)),
    lst(li(span('Create “incl”', 'c-brass'), None, span(ico('plus', 18), 'c-brass'))),
    h=720, close=False)), row_=2)

P4('P04-Picker-Group.dc.html', 'Exercise picker · muscle group, no matches', behind(sheet(None,
    row(ibtn('back', 'Back to muscle groups', 'fill', sm=True), col(txt('Legs', 't-h2'), row(span('Recovering', 't-s c-bad'), span('· 6 of 12 sets this week', 't-s'), gap=4), gap=2, style='flex: 1'), ibtn('search', 'Search', 'fill', sm=True), gap=8),
    row(chip('All', True), chip('Quads'), chip('Hamstrings'), chip('Glutes'), chip('Calves'), gap=6, wrap=True),
    row(chip('Any · 24'), chip('Barbell · 6', True), chip('Machine · 9'), chip('Cable · 3'), gap=6, wrap=True),
    row(lbl('Legs · 0'), sp(), txt('Tap to add · ⓘ details', 't-m')),
    empty('Nothing matches', 'Nothing matches — loosen the filters.', 'search'),
    h=620, close=False)), row_=2)

eqt = lambda n, sub, on=False, na=False: card(row(sp(), span(ico('check', 14), 'c-brass') if on else ''), span(ico('dumbbell', 22), 'c-brass' if on else 'c-dim'), txt(n, 't-h3'), txt(sub, 't-m'),
                                              tone='glass' if on else '', style='padding: 10px; align-items: center; text-align: center', gap=4)
P4('P04-Picker-Equipment.dc.html', 'Exercise picker · equipment filter', behind(sheet('What do you want to use?',
    txt('Pick one or more — groups, suggestions and search follow it.', 't-s'),
    grid(eqt('Barbell', 'in gym', True), eqt('Dumbbell', 'in gym', True), eqt('Cable', 'in gym'), eqt('Machine', 'in gym'), eqt('Bodyweight', 'always'), eqt('Kettlebell', 'not in gym', na=True),
         eqt('Bands', 'in gym'), eqt('EZ bar', 'in gym'), eqt('Suspension (TRX)', 'not in gym', na=True), cols=3, gap=8),
    lst(li('Only what this gym has', 'Others stay findable in search', None, toggle(True))),
    h=680, close=False, footer=row(btn('Reset', 'sec'), btn('Show 86 exercises', 'pri', style='flex: 1'), gap=8))), row_=2)

P4('P04-Exercise-Detail.dc.html', 'Exercise details (ⓘ) · swaps (scroll)', behind(sheet(None,
    grid(col(img(exercise_img('Incline dumbbell press', 0), '100%', 110, 12), txt('Start', 't-m'), gap=4), col(img(exercise_img('Incline dumbbell press', 1), '100%', 110, 12), txt('Finish', 't-m'), gap=4), cols=2, gap=8),
    txt('Incline dumbbell press', 't-h2'),
    row(tag('Chest', 'brass'), tag('Front delt', 'neutral'), tag('Triceps', 'neutral'), tag('Dumbbell', 'neutral', 'dumbbell'), gap=6, wrap=True),
    card(row(col(txt('You · 14 sessions', 't-m'), txt('Last 32 × 10 · best 34', 't-h3 num'), gap=2, style='flex: 1'), spark([28, 30, 30, 32, 32, 34, 32], 90, 32), gap=10), style='padding: 10px 12px'),
    lbl('Station busy? Same muscles'),
    grid(card(row(expic('Dumbbell bench press', 40, 40, 8), col(txt('Dumbbell bench press', 't-s'), txt('Dumbbell', 't-m'), gap=1), gap=8), style='padding: 8px'),
         card(row(expic('Smith machine bench press', 40, 40, 8), col(txt('Smith machine bench press', 't-s'), txt('Machine', 't-m'), gap=1), gap=8), style='padding: 8px'), cols=2, gap=8),
    lbl('Key cues'),
    col(txt('1 · Set the bench to 30–45 degrees and sit back with a dumbbell in each hand.', 't-s'), txt('2 · Press up until the arms are straight, then lower under control.', 't-s'), gap=6),
    btn('Full instructions (6 steps)', 'txt', style='align-self: flex-start; height: 32px'),
    h=820, close=False, footer=row(btn('Back', 'sec'), btn('Add to session', 'pri', style='flex: 1'), gap=8)), h=880), h=880, row_=2)

P4('P04-Replace.dc.html', 'Replace exercise (swap)', behind(sheet(None,
    row(txt('Replace exercise', 't-h2'), txt('Chest 2 · 1 done', 't-s'), gap=10, align='baseline'),
    search('Search by name, muscle or equipment'),
    seg(['Strength', 'Warm-up', 'Cardio', 'Cool-down']),
    row(span(ico('check', 16), 'c-ok'), txt('Done today: Bench press', 't-s'), gap=6),
    row(lbl('Suggested for Chest 2', 'brass'), sp(), txt('Tap to add · ⓘ details', 't-m')),
    wide('Your usual', 'Dumbbell bench press', 'Done 6× before', 'Try 36 × 8', True),
    wide('Good fit', 'Machine chest press', 'Chest is ready', 'Last 70 × 10'),
    h=720, close=False)), row_=2)

cm = lambda n, icon, on=False: li(n, None, tile(icon, 'neutral'), span(ico('check', 18), 'c-brass') if on else '')  # CardioMachineList: machineIcon(), current ✓
P4('P04-Cardio-Machine.dc.html', 'Which machine?', behind(sheet(None,
    lbl('Which machine?'),
    lbl('In your gym'), lst(cm('Treadmill', 'run', True), cm('Rowing erg', 'wave'), cm('Indoor cycle / spin bike', 'bike')),
    lbl('Other machines'), lst(li('No machine / other', 'Just time and distance', tile('timer')), cm('Curved / manual treadmill', 'run'), cm('Ski erg', 'wave'),
                               cm('Bike erg', 'bike'), cm('Air / fan bike', 'bike'), cm('Elliptical / cross-trainer', 'heart'), cm('Stair climber / stepmill', 'heart')),
    h=790, close=False)), row_=2)

ept = lambda n, on=False, add=False, pic=None: card(img(pic, '100%', 64, 10) if pic else card(row(span(ico('dumbbell', 22), 'c-dim'), justify='center'), style='height: 64px; justify-content: center', pad=False), row(txt(n, 't-s', 'flex: 1'), span(ico('check', 14), 'c-brass') if on else (span('＋', 't-s c-dim') if add else ''), gap=4),
                                          tone='glass' if on else '', style='padding: 6px', gap=6)
cat = lambda n, cnt, open_=False: li(n, None, span(ico('down' if open_ else 'chev', 16), 'c-dim'), span(cnt, 't-s num'))
P4('P04-Equipment.dc.html', 'Equipment for this exercise', behind(sheet(None,
    txt('Equipment', 't-h2'),
    row(chip('Olympic barbell (20 kg)', True, 'x'), chip('Flat bench', True, 'x'), gap=6, wrap=True),
    search('Search equipment'),
    lst(cat('Barbells', '1/9', True)),
    grid(ept('Olympic barbell (20 kg)', True, pic='equipment/barbell-olympic.jpg'), ept('Power bar', add=True), ept('Bench press bar (stiff)', add=True),
         ept('Technique bar (5–10 kg)', add=True), ept('Multi-grip / American press bar', add=True), ept('Axle / fat bar', add=True), cols=3, gap=8),
    lst(cat('Plates', '4'), cat('Racks & stands', '5'), cat('Benches', '1/4'), cat('Bands', '3'), cat('Accessories', '6')),
    h=790, close=False)), row_=2)

zl = lambda t, tone: row(dot(tone), txt(t, 't-m'), gap=5)
mmh = lambda n, d, tone: li(n, None, dot(tone), span(d, 't-s'))
ZONES = {'chest': 'over', 'shoulders': 'high', 'triceps': 'productive', 'lats': 'productive', 'back': 'under', 'biceps': 'under', 'quads': 'productive',
         'hamstrings': 'under', 'glutes': 'under', 'core': 'under', 'traps': 'under', 'calves': 'under'}
P4('P04-Muscle-Map.dc.html', 'Today’s muscle map', behind(sheet(None,
    lbl('Today’s muscle map'),
    bodypair(paint=ZONES, h=250),
    row(zl('Under', 'under'), zl('Productive', 'productive'), zl('High', 'high'), zl('Over', 'over'), gap=14, justify='center'),
    txt('Colours show this week’s volume, today included', 't-m', 'text-align: center'),
    lbl('Still worth doing today'), lst(mmh('Triceps', '~4 sets left', 'productive'), mmh('Biceps', 'planned today', 'under')),
    lbl('Ease off'), lst(mmh('Chest', 'over weekly limit', 'over'), mmh('Shoulders', 'near weekly limit', 'high')),
    row(span(ico('check', 16), 'c-ok'), txt('Done today: Lats', 't-s'), gap=6),
    h=820, close=False), h=870), h=870, row_=2)

P4('P04-Superset-With.dc.html', 'Superset with…', behind(sheet(None,
    txt('Superset with…', 't-h2'),
    txt('Pick the exercises to alternate with Dips - Triceps Version. They move together and are logged in rounds.', 't-s'),
    lst(li('Dips - Triceps Version', None, tag('A1', 'brass'), span('this one', 't-m')), li('Triceps pushdown', None, tag('A2', 'brass'), check(True)),
        li('Lateral raise', None, span('', '', 'width: 30px'), check(False))),
    card(row(tile('info'), txt('Both keep every set already logged. Round count follows the exercise with the most sets; the shorter one simply has an empty round.', 't-s', 'flex: 1'), gap=10), style='padding: 10px 12px'),
    h=560, close=False, footer=row(btn('Cancel', 'sec', style='flex: 1'), btn('Group as A', 'pri', style='flex: 1'), gap=8))), row_=2)

P4('P04-Group-Menu.dc.html', 'Superset menu', behind(sheet(None,
    lbl('Superset A'),
    lst(li('Ungroup', None, span(ico('x', 18), 'c-dim')), li('Add exercise', None, span(ico('plus', 18), 'c-dim'))),
    lst(li('Dips - Triceps Version', None, span(ico('more', 18), 'c-dim')), li('Triceps pushdown', None, span(ico('more', 18), 'c-dim'))),
    h=380, close=False)), row_=2)

cr_head = row(tile('rotate', 'brass'), col(lbl('Circuit A', 'brass'), txt('Round 2 of 4', 't-h2'), gap=2, style='flex: 1'), f'<div style="width: 110px">{pips(4, 1)}</div>', gap=10)
cr_nav = row(ibtn('back', 'Previous', 'fill', sm=True), col(row(dot('ok'), dot('brass'), dot('neutral'), gap=6, justify='center'), txt('Exercise 2 of 3', 't-m', 'text-align: center'), gap=4, style='flex: 1'),
             ibtn('chev', 'Next', 'fill', sm=True), gap=8)
P4('P04-Circuit-Run.dc.html', 'Circuit · run a round', behind(sheet(None, cr_head, cr_nav,
    card(row(tag('A2', 'brass'), txt('Pushups', 't-h2', 'flex: 1'), gap=8), row(mchip('Chest', 1), mchip('Triceps', 0), gap=6),
         row(ico('target', 16), txt('Round goal · <b>15 reps</b>', 't-s'), gap=6),
         stepper('15', '', 'Reps'),
         btn('Log A2 · round 2', 'pri', 'check', full=True), txt('No load — bodyweight. Volume counts reps only.', 't-m', 'text-align: center'), tone='glass', gap=12),
    h=590, close=False, footer=col(btn('Complete round', 'pri', 'check', full=True), btn('Finish circuit', 'sec', full=True), gap=8))), row_=2)

P4('P04-Circuit-Round.dc.html', 'Circuit · round complete', behind(sheet(None,
    col(span(ico('check', 40, w=2.2), 'c-ok'), txt('Round 2 complete', 't-h1'), txt("All 3 exercises logged. Keep the loop going or wrap it up — it's your call.", 't-s', 'text-align: center'),
        f'<div style="width: 220px">{row(f"<div style=flex:1>{pips(4, 2)}</div>", tag("+", "neutral"), gap=8)}</div>',
        txt('2/4 · rounds are open', 't-m'), gap=10, style='align-items: center; padding: 10px 0'),
    card(row(ico('timer', 16), lbl('Rest · auto', 'rest'), sp(), txt('0:45', 't-h3 num'), gap=8), tone='rest', style='padding: 10px 14px'),
    h=640, close=False, footer=col(btn('Start round 3', 'pri', 'play', full=True), row(btn('Add a round', 'sec', 'plus', style='flex: 1'), btn('Finish circuit', 'sec', style='flex: 1'), gap=8), gap=8))), row_=2)

pbrow = lambda i, n, s: li(n, s, row(span(str(i), 'num t-s c-dim', 'width: 14px'), img('markers/warmup.jpg', 40, 40, 8) if n == 'Warm-up' else expic(n, 40, 40, 8), gap=8))
P4('P04-Playbook.dc.html', 'Playbook · how do you want to start?', phone(strip('0', '0', '0'), empty_start, tabs=None, h=844, mood='art', top=hero_top('draft', '0:00', '0 sets · 0 t · 0 exercises'),
    overlay=sheet(None, col(txt('How do you want to start?', 't-h2'), txt('Your whole Monday, or build it as you go', 't-s'), gap=2),
                  card(row(tile('book', 'brass'), col(lbl('PLAYBOOK · YOUR MONDAY', 'brass'), txt('Chest 2 · 6 steps · ~48 min', 't-h3'), txt('Learned from 6 sessions', 't-m'), gap=2, style='flex: 1'), gap=10),
                       lst(pbrow(1, 'Warm-up', 'get warm before the first lift'), pbrow(2, 'Bench press', '4 × 5 · 100 kg'), pbrow(3, 'Incline dumbbell press', '3 × 8–10 · 32 kg'),
                           pbrow(4, 'Cable crossover', '3 × 12 · 20 kg'), pbrow(5, 'Dips - Triceps Version', '3 × 12'), pbrow(6, 'Triceps pushdown', '3 × 12 · 35 kg')),
                       btn('Apply the whole day', 'pri', 'book', full=True), tone='glass', gap=10),
                  h=760, close=False, footer=btn('Custom scenario', 'sec', 'edit', full=True))), row_=2)

mus = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core', 'Lats', 'Traps']
def new_ex(note):
    return behind(sheet(None,
    row(ibtn('back', 'Back', 'fill', sm=True), txt('Zercher squat', 't-h2'), gap=8),
    txt(note, 't-s'),
    lbl('Primary muscle'), row(*[chip(m, m == 'Quads') for m in mus], gap=6, wrap=True),
    lbl('Secondary muscles'), row(*[chip(m, m in ('Glutes', 'Core')) for m in mus if m != 'Quads'], gap=6, wrap=True),
    lbl('Equipment'), row(*[chip(e, e == 'Barbell') for e in ['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight', 'Kettlebell', 'Bands']], gap=6, wrap=True),
    h=790, close=False, footer=btn('Create “Zercher squat”', 'pri', 'plus', full=True)))


P4('P04-New-Exercise.dc.html', 'Create exercise · Member', new_ex('Tag the muscles it trains and the equipment it needs.'), row_=2)
AUTHOR = 'This is added to the shared catalogue, so everyone gets it — with these muscles and equipment.'
P4('P04-New-Exercise-Trainer.dc.html', 'Create exercise · Trainer', new_ex(AUTHOR), row_=2)
P4('P04-New-Exercise-Admin.dc.html', 'Create exercise · Admin', new_ex(AUTHOR), row_=2)

# ============================================================== ROW 3 · dialogs & closed session
P4('P04-Finish.dc.html', 'Finish · confirm', behind(dialog('Finish this session?', '“Cable crossover” has no sets and will be dropped. Everything else — 12 sets, 5.8 t — is saved to 28 Sep.', 'Finish', 'Keep going', kind='pri', top=360)), row_=3)
P4('P04-Discard.dc.html', 'Discard session · confirm', behind(dialog('Discard session', '28 Sep, 12 sets, 5 840 kg. It disappears from every device on the next sync and cannot be undone.', 'Delete', 'Keep', top=360)), row_=3)
P4('P04-Delete-Set.dc.html', 'Delete set · confirm', behind(dialog('Delete set 4?', '5 × 100 kg leaves Bench press. You can undo right after.', 'Delete', 'Keep', top=360)), row_=3)
P4('P04-Delete-Exercise.dc.html', 'Delete exercise · confirm', behind(dialog('Delete “Bench press”?', '4 logged sets — 60 × 8, 80 × 3, 97.5 × 5, 100 × 5 go with it. Added by mistake? Deleting is instant, with a 5-second undo.', 'Delete', 'Keep', top=350)), row_=3)

past_top = (f'<div style="padding: 0 0 4px">{brandbar(app="Gym")}</div><div style="position: relative">{photo("100%", 124, 0, "")}'
            f'<div style="position: absolute; left: 0; right: 0; top: 0; bottom: 0; padding: 12px 14px; display: flex; flex-direction: column">'
            f'{row(ibtn("back", "Back", "fill", sm=True), sp(), btn("Reopen", "sec", sm=True), gap=8)}{sp()}'
            f'{row(txt("Chest 2", "t-h2"), row(ico("pin", 14), txt(GYM, "t-s"), ico("edit", 14), gap=6), gap=12, align="baseline")}</div></div>')
closed_card = lambda name, prev, rows_: card(row(span(ico('drag', 18), 'c-dim'), txt(name, 't-h3', 'flex: 1'), txt(prev, 't-m'), ibtn('gear', 'Menu', sm=True), gap=8, style='padding: 12px 8px 4px 12px'),
                                                f'<div style="padding: 0 12px">{ex_chips()}</div>', set_head(), *rows_, f'<div style="padding: 0 12px 12px">{ghost_plain("5", "100")}</div>', pad=False, gap=0)
P4('P04-Closed.dc.html', 'Closed automatically (scroll)', phone(
    txt('Closed automatically', 't-l', 'padding: 0 2px'),
    col(row(lbl('Muscles worked'), sp(), btn('Muscle map', 'sec', 'body', sm=True)), row(mchip('Chest', 4), mchip('Triceps', 2), mchip('Front delt', 2), gap=6), gap=8),
    card(row(span(ico('clock', 16), 'c-brass'), txt('Left open for 8 hours, so it was closed at 18:02 and may be incomplete. Everything you logged is kept — add what\'s missing and it saves to the original date.', 't-s', 'flex: 1'), gap=10), style='padding: 12px 14px'),
    closed_card('Bench press', 'prev 97.5 × 5', [rest_line('Rest 3:40'), srow(1, '8', '60', T_WARM, warm=True, live=False), rest_line('Rest 2:30'), srow(2, '5', '97.5', T_WORK, live=False),
                                                 rest_line('Rest 2:41'), srow(3, '5', '100', T_PR, live=False, tone='ok')]),
    btn('Add exercise', 'sec', 'plus', full=True),
    tabs=None, h=1000, mood='art', top=past_top), h=1000, row_=3)

LH = lambda st, lab, clk, meta, pin=True: livehero('session', lab, clk, meta, action=ibtn('pin', 'Change gym', 'fill', sm=True) if pin else '', state=st).replace('<div class="bd">', '<div class="bd" style="right: 60px">', 1)
P4('P04-Hero-States.dc.html', 'Live hero · states', phone(
    cap('In session', LH('live', LABEL['live'], CLOCK, '12 sets · 5.8 t · 6 exercises')), cap('Offline · queued', LH('offline', LABEL['offline'], CLOCK, '12 sets · 5.8 t · 6 exercises')),
    cap('Not started', LH('closed', LABEL['draft'], '0:00', '0 sets · 0 t · 0 exercises')), cap('Home set', LH('live', LABEL['home'], '18:30', '4 sets · 3 moves', False)),
    tabs=None, h=560, mood='art'), h=560, row_=3)

# ============================================================== ROW 1 · night (a live night: sky palette + paused SleepHero above the session)
P4('P04-Session-Night.dc.html', 'Session · live, rest running · Night', session_screen(
    bench_card(after=rest_card() + ghost() + start_next()), h=1420, night=True), row_=1)
P4('P04-Rest-Over-Night.dc.html', 'Rest over · Night', session_screen(
    bench_card(rows=BENCH_ROWS[4:], photos=False, after=rest_card('+0:24', done=True) +
               ghost('Set 5 · PR attempt', '5', '102.5', extra=row(ico('trophy', 16), txt('+2.5 kg over your best 100 kg', 't-s c-ok'), gap=6), pr=True) + start_next()),
    h=1150, rest='2:54', night=True), row_=1)
P4('P04-Opts-Set-Night.dc.html', 'Options · This set · Night', behind(opts(0, *set_editor('Set 5', embedded=True), ed_actions('Log').replace(btn('Delete set', 'dan', 'trash', sm=True), ''), h=990), h=1060, night=True), row_=1)
P4('P04-Finish-Night.dc.html', 'Finish · confirm · Night', behind(dialog('Finish this session?', '“Cable crossover” has no sets and will be dropped. Everything else — 12 sets, 5.8 t — is saved to 28 Sep.', 'Finish', 'Keep going', kind='pri', top=380), night=True), row_=1)

# ============================================================== completeness pass (rule #0c): every remaining SessionView branch
# --- ROW 1: exercise kinds / states
cool = ex_card(ex_head('Cool-down', 'Cool-down'),
               f'<div style="padding: 8px 0 0">{card(img("markers/cooldown.jpg", "100%", 150, 12), row(tile("wave", "rest"), col(txt("Wind down · ~5 min", "t-h3"), txt("Stretch, foam-roll, breathe — nothing to log.", "t-m"), gap=2, style="flex: 1"), ibtn("sliders", "Set options", "fill", sm=True), gap=10), style="padding: 10px", gap=10)}</div>')
P4('P04-Cooldown-Marker.dc.html', 'Cool-down marker step (last step)', session_screen(cool, h=844, clock='1:06:40', meta='21 sets · 7.9 t · 7 exercises', strip_=strip('21', '7.9', '7'),
                                                                                 n=7, at=6, next_label='Next exercise'), row_=1)

cardio_head = lambda: (ex_head('Treadmill', 'Cardio'),
                       f'<div style="position: relative; padding: 6px 0 8px">{img("equipment/cardio-treadmill.jpg", "100%", 130, 12)}{abs_box(btn("Change machine", "sec", "swap", sm=True), "left: 10px; bottom: 18px")}</div>',
                       row(span('#', 't-l', 'width: 22px'), span('Time', 't-l', 'width: 64px'), span('Km', 't-l', 'width: 64px'), span('RPE', 't-l'), gap=10, style='padding: 6px 16px 2px'),
                       li(row(span('10', 'num', 'width: 64px'), span('1.6', 'num', 'width: 64px'), gap=10), '9.5 km/h · 1 %', span('1', 'num t-m c-dim', 'width: 22px'), span('—', 't-m')))
P4('P04-Cardio-Idle.dc.html', 'Cardio · between intervals', session_screen(
    ex_card(*cardio_head(), rest_card('0:48', '1:30', 47, 'Next: Set 2 · BW × 0', ''),
            f'<div style="padding: 14px 0 0">{card(row(ibtn("sliders", "Set options", "fill"), btn("Start · interval 2", "pri", "play", style="flex: 1; height: 54px"), gap=10), btn("Log without the timer", "txt", style="align-self: center; height: 32px"), tone="hero", gap=8, style="padding: 14px")}</div>'),
    h=844, clock='1:02:10', meta='18 sets · 6.9 t · 6 exercises', strip_=strip('18', '6.9', '6', (('10', 'cardio min'), ('1.6', 'km'))), n=6, at=5, next_label='Next exercise'), row_=1)

hold_idle = col(txt('last time 55 s · 50 s', 't-m'),
                card(lbl('Enter this set', 'brass'), col(span('0:00', 't-hero num c-dim'), txt('Starts when you tap Start — runs until you let go', 't-s'), gap=6, style='align-items: center; padding: 10px 0'),
                     row(ibtn('sliders', 'Set options', 'fill'), btn('Start hold', 'pri', 'play', style='flex: 1; height: 54px'), gap=10), tone='hero', gap=12, style='padding: 16px'), gap=8)
P4('P04-Hold-Idle.dc.html', 'Home set · timed hold, ready', session_screen(
    ex_card(ex_head('Plank'), ex_chips(muscles=(('Core', 1),)), ex_photos('Plank'), set_head('Hold', 'Kg'), srow(1, '0:55', 'BW', span('S-D', 't-m c-learn')), f'<div style="padding: 14px 0 0">{hold_idle}</div>'),
    h=1000, state='home', clock='17:40', meta='4 sets · 3 moves', strip_=strip('4', '0', '3'), n=3, at=2, next_label='Next exercise'), row_=1)

P4('P04-Static-Dynamic.dc.html', 'Static-dynamic set', session_screen(
    ex_card(ex_head('Bench press'), ex_chips(), prog_hint('', '100 kg', 'Hold', 'prev 97.5 × 5'), set_head('Reps', 'Kg'),
            rest_line('Rest 2:30'), srow(3, '5', '97.5', t_rpe(8)), rest_line('Rest 2:10'), srow(4, '0:20', '80', span(ico('wave', 12) + ' S-D', 't-m c-learn')),
            ghost('Static-dynamic', '30', '80', reps_label='Hold, s', kind='sd')),
    h=1080), row_=1)

P4('P04-Tired-Part.dc.html', 'Part of a muscle had enough', session_screen(
    ex_card(ex_head('Incline dumbbell press'), ex_chips(tag('×2 per hand', 'brass'), muscles=(('Chest', 3), ('Front delt', 2))), set_head(),
            rest_line('Rest 2:05'), srow(1, '10', '32', t_rpe(8)), rest_line('Rest 2:00'), srow(2, '9', '32', t_rpe(9)),
            ghost('Enter this set', '8', '32'),
            f'<div style="padding: 12px 0 0">{card(row(tile("dumbbell", "injury"), col(txt("Upper chest: had enough", "t-h3"), txt("Lower chest still has room", "t-m"), gap=2, style="flex: 1"), ico("up", 18), gap=10), txt("<b>Why:</b> your upper chest got about 8 hard sets today, while your lower chest barely worked. Switching to it keeps the muscle growing instead of just tiring one part.", "t-s"), tiles([("SAME MUSCLE · LOWER CHEST", "Dips - Triceps Version", "still has room today"), ("NEXT · TODAY’S PLAN", "Cable crossover", "Chest")]), gap=10)}</div>'),
    h=1400, at=2, next_label='Next · Cable crossover'), row_=1)

blocked = ghost('Enter this set', '12', '—').replace('class="btn pri full"', 'class="btn pri full dis"', 1)
P4('P04-Planned-New.dc.html', 'Program lift · first time, weight required', session_screen(
    ex_card(ex_head('Cable crossover', None, '0 / 3'), ex_chips(muscles=(('Chest', 0), ('Front delt', 0))), ex_photos('Cable crossover'), prog_hint('', '12 reps', 'New', None),
            blocked, txt('No history for this lift yet — enter a weight before logging.', 't-m', 'padding: 10px 2px 0')),
    h=1000, at=3, next_label='Next · Superset A'), row_=1)

cdone = card(row(tile('rotate', 'neutral'), col(row(txt('Circuit A', 't-h3'), txt('· done', 't-s c-ok'), gap=6), txt('3 exercises · 4 rounds', 't-m'), gap=2, style='flex: 1'), gap=10),
             row(lbl('What you did'), gap=8),
             *[col(row(tag(sl, 'neutral'), txt(n, 't-b', 'flex: 1'), txt('4/4', 't-s num'), gap=8),
                   grid(*[card(txt(f'R{r + 1}', 't-l'), txt(v, 't-s num'), style='padding: 6px 8px', gap=2) for r, v in enumerate(vals)], cols=4, gap=6), gap=6)
               for sl, n, vals in [('A1', 'Kettlebell swing', ['15×24', '15×24', '15×24', '12×24']), ('A2', 'Pushups', ['15', '15', '12', '12']), ('A3', 'Bodyweight squat', ['20', '20', '20', '18'])]],
             gap=12)
P4('P04-Circuit-Done.dc.html', 'Circuit · all rounds done', session_screen(cdone, h=844, clock='44:10', meta='12 sets · 1.4 t · 3 exercises', strip_=strip('12', '1.4', '3'), n=1, at=0, next_label='Next exercise'), row_=1)

P4('P04-Exercise-Deleted.dc.html', 'Exercise deleted · undo', session_screen(
    bench_card(rows=BENCH_ROWS[4:], photos=False, after=ghost()), h=1000, show_nav=False, overlay=snack('“Cable crossover” deleted · 3 sets', 'Undo', 22)), row_=1)

kit_tray = abs_box(card(row(img('equipment/barbell-olympic.jpg', 38, 38, 10), col(txt('Olympic barbell (20 kg) isn’t on Iron Temple’s list', 't-s'), txt('Seen in 3 sessions here', 't-m'), gap=1, style='flex: 1; min-width: 0'),
                            ibtn('x', 'Dismiss', sm=True), btn('Add', 'pri', sm=True), gap=8), tone='glass', style='padding: 10px'), 'left: 12px; right: 12px; bottom: 84px')
P4('P04-Kit-Tray.dc.html', 'Kit not on the gym’s list · tray', session_screen(
    bench_card(rows=BENCH_ROWS[4:], photos=False, after=rest_card() + ghost()), h=1170, overlay=kit_tray), row_=1)

jab = abs_box(card(row(img('atlas/atlas-1.webp', 36, 36, 18), txt('Bro, you only rested 1:10 on Bench press. Take the full 2:30 — your last sets will thank you.', 't-s', 'flex: 1'), gap=10), tone='atlas', style='padding: 10px 12px'),
              'left: 12px; right: 12px; bottom: 84px')
P4('P04-Atlas-Jab.dc.html', 'Atlas jab after a set', session_screen(
    bench_card(rows=BENCH_ROWS[4:], photos=False, after=rest_card('1:20', '2:30', 53) + ghost()), h=1170, overlay=jab), row_=1)

slider = (f'<div class="scrim"></div>'
          + abs_box(row(txt('Bench press', 't-h3', 'flex: 1'), ibtn('x', 'Close', 'fill', sm=True)), 'left: 16px; right: 16px; top: 70px')
          + abs_box(img(exercise_img('Bench press', 0), 390, 260, 0), 'left: 0; right: 0; top: 260px')
          + abs_box(row(ibtn('back', 'Previous', 'fill'), sp(), chip('Start', True), chip('End'), sp(), ibtn('chev', 'Next', 'fill'), gap=8), 'left: 16px; right: 16px; bottom: 60px'))
P4('P04-Photos.dc.html', 'Exercise photos · full screen', session_screen(bench_card(rows=BENCH_ROWS[4:]), h=1014, show_nav=False, overlay=slider), row_=1)

# --- ROW 2: sheets
se_head = lambda t, m=None: row(txt(t, 't-h2', 'flex: 1'), txt(m, 't-m') if m else '', gap=8)
P4('P04-Cardio-Entry.dc.html', 'Cardio entry · console readings', behind(sheet(None,
    se_head('Entry 2 · Treadmill', 'logged 1:02:10'),
    grid(card(txt('Duration, min', 't-l'), row(timein('6:24', True, 'Duration'), justify='center'), style='padding: 10px 12px', gap=8), stepper('1.1', '', 'Distance, km'), cols=2, gap=8),
    grid(stepper('10.5', '', 'Speed, km/h', big=False), stepper('2', '', 'Incline, %', big=False), cols=2, gap=8),
    grid(stepper('85', '', 'Calories', big=False), stepper('7', '', 'RPE', big=False), cols=2, gap=8),
    h=560, close=False, footer=ed_actions('Save'))), row_=2)

rev_rows = col(col(txt('Start', 't-m'), grid(stepper('6', '', 'Reps', big=False), stepper('80', '', 'Weight, kg', big=False), cols=2, gap=8), gap=6),
               col(row(txt('Drop 1', 't-m'), sp(), span(ico('trash', 16), 'c-dim')), grid(stepper('4', '', 'Reps', big=False), stepper('85', '', 'Weight, kg', big=False), cols=2, gap=8), gap=6),
               lst(li('Add another drop', None, span(ico('plus', 18), 'c-brass'), span('10 reps · 820 kg', 't-s num'))),
               card(row(span(ico('up', 16), 'c-active'), txt('Reverse means the weight is expected to climb and the reps to fall. The app doesn’t enforce it — if a drop breaks the pattern it is simply saved as entered.', 't-m', 'flex: 1'), gap=8), style='padding: 10px 12px'), gap=10)
P4('P04-Edit-Reverse.dc.html', 'Set editor · reverse dropset', behind(sheet(None,
    se_head('Set 5 · Bench press'), lbl('Load type'), card(seg(['Weight', 'Assist', 'Band']), rev_rows, style='padding: 10px'),
    lbl('Set type'), card(row(*[chip(x, x == 'Reverse dropset') for x in ['Working', 'Warm-up', 'Dropset', 'Reverse dropset', 'Static-dynamic']], gap=6, wrap=True), txt('weight climbs', 't-m'), style='padding: 10px'),
    h=790, close=False, footer=ed_actions('Log').replace(btn('Delete set', 'dan', 'trash', sm=True), ''))), row_=2)

P4('P04-Edit-Assist.dc.html', 'Set editor · assisted machine', behind(sheet(None,
    se_head('Set 2 · Assisted pull-up'), lbl('Load type'),
    card(seg(['Weight', 'Assist', 'Band'], 1), grid(stepper('8', '', 'Reps', big=False), stepper('25', '', 'Assistance', big=False), cols=2, gap=8),
         row(*[chip(v, v == '25') for v in ['15', '20', '25', '30', '35']], gap=6), txt('Counter-weight that helps you — not weight lifted.', 't-m'), style='padding: 10px'),
    lbl('Set type'), card(row(*[chip(x, x == 'Working') for x in ['Working', 'Warm-up', 'Dropset', 'Reverse dropset', 'Static-dynamic']], gap=6, wrap=True), style='padding: 10px'),
    h=640, close=False, footer=ed_actions('Log').replace(btn('Delete set', 'dan', 'trash', sm=True), ''))), row_=2)

BANDS = [('Yellow', '#e5c100', 7), ('Green', '#3fa34d', 11), ('Red', '#d1495b', 15), ('Black', '#2b2f36', 23)]  # loads.ts BAND_DEFAULTS + BAND_HEX
btile = lambda n, hx, kg, on=False: card(row(swatch(hx, 16, 5), txt(n, 't-s'), gap=6), txt(f'~{kg}', 't-m num'), tone='glass' if on else '', style='padding: 8px', gap=4)
P4('P04-Edit-Band.dc.html', 'Set editor · resistance band', behind(sheet(None,
    se_head('Set 1 · Pallof press'), lbl('Load type'),
    card(seg(['Weight', 'Assist', 'Band'], 2),
         grid(stepper('12', '', 'Reps', big=False), card(row(txt('Band', 't-l'), sp(), txt('~15 kg', 't-m num')), row(swatch('#d1495b', 14, 7), txt('Red', 't-h3'), gap=8), style='padding: 10px 12px', gap=8), cols=2, gap=8),
         grid(*[btile(n, hx, kg, n == 'Red') for n, hx, kg in BANDS], cols=4, gap=6),
         txt('Band load is an estimate — for effort and reps, not counted as tonnage.', 't-m'),
         lst(li('Edit bands · Iron Temple', None, span(ico('sliders', 16), 'c-dim'), chev=True)), style='padding: 10px'),
    h=650, close=False, footer=ed_actions('Log').replace(btn('Delete set', 'dan', 'trash', sm=True), ''))), row_=2)

P4('P04-Band-Library.dc.html', 'Band library', behind(sheet(None,
    row(ico('scale', 18), txt('Band library', 't-h2'), gap=8),
    txt('Set once per gym — colour → resistance. Used for every band exercise here.', 't-s'),
    lst(*[li(n, None, swatch(hx, 22, 11), row(field(None, str(kg), trail=span('kg', 't-m')).replace('<div>', '<div style="width: 96px">', 1), ibtn('x', 'Delete', sm=True), gap=6)) for n, hx, kg in BANDS]),
    h=560, close=False, footer=row(btn('Add band', 'sec', 'plus', style='flex: 1'), btn('Save library', 'pri', 'check', style='flex: 1'), gap=8))), row_=2)

PLATE_HEX = {25: '#e2564f', 20: '#3d84c9', 15: '#e6b53f', 10: '#4cbe8c', 5: '#e9edf1', 2.5: '#8a9099', 1.25: '#6b727c', 0.5: '#4a4f57'}  # plates.ts PLATE_COLOR_KG
rack = row(*[card(row(swatch(PLATE_HEX[d], 12, 6), txt(str(d), 't-s num'), gap=5), (tag('1', 'neutral') if d in (25, 15) else ''), style='padding: 6px 8px', gap=2) for d in (25, 20, 15, 10, 5, 2.5, 1.25, 0.5)], ibtn('rotate', 'Clear', 'fill', sm=True), gap=6, wrap=True)
P4('P04-Plates-Build.dc.html', 'Plate calculator · build', behind(sheet(None,
    row(ico('weight', 20), txt('Plate calculator', 't-h2', 'flex: 1'), f'<div style="width: 130px">{seg(["Solve", "Build"], 1)}</div>', gap=8),
    row(barbell(per_side=(25, 15), w=358, h=132), justify='center'),
    row(f'<div class="t-num num">100 {span("kg", "t-m")}</div>', sp(), txt('Per side', 't-m'), plates_legend((25, 15)), gap=8),
    rack,
    lbl('Bar'), row(chip('20', True), chip('15'), chip('10'), chip('7'), gap=6),
    row(f'<div style="width: 140px">{seg(["kg", "lb"])}</div>', chip('Collars'), gap=10),
    h=700, footer=btn('Use 100 kg', 'pri', 'check', full=True))), row_=2)

P4('P04-Plates-Closest.dc.html', 'Plate calculator · not loadable', behind(sheet(None,
    row(ico('weight', 20), txt('Plate calculator', 't-h2', 'flex: 1'), f'<div style="width: 130px">{seg(["Solve", "Build"])}</div>', gap=8),
    field('Target', '103.5', trail=span('kg', 't-m')),
    row(barbell(per_side=(25, 15, 1.25), w=358, h=132), justify='center'),
    row(f'<div class="t-num num">102.5 {span("kg", "t-m")}</div>', sp(), txt('Per side', 't-m'), plates_legend((25, 15, 1.25)), gap=8),
    txt('Closest loadable: 102.5 kg (−1)', 't-s c-brass'),
    lbl('Bar'), row(chip('20', True), chip('15'), chip('10'), chip('7'), gap=6),
    row(f'<div style="width: 140px">{seg(["kg", "lb"])}</div>', chip('Collars'), gap=10),
    h=700, footer=btn('Use 102.5 kg', 'pri', 'check', full=True))), row_=2)

gcard = lambda: col(wide('Next up · Your usual', 'Incline dumbbell press', 'Done 14× before', 'Try 34 × 10', True), wide('Best for upper chest now', 'Cable crossover', '', 'Last 20 × 12'), gap=8)
gtile = lambda n, meta, badge='': card(expic(n, '100%', 80, 10), txt(n, 't-s'), row(txt(meta, 't-m', 'flex: 1'), badge, ibtn('info', 'Details', sm=True), gap=4), style='padding: 6px', gap=4)
P4('P04-Picker-Group-Filled.dc.html', 'Exercise picker · muscle group (scroll)', behind(sheet(None,
    row(ibtn('back', 'Back to muscle groups', 'fill', sm=True), col(txt('Chest', 't-h2'), row(span('Recovering', 't-s c-bad'), span('· 9 of 12 sets this week', 't-s'), gap=4), gap=2, style='flex: 1'), ibtn('search', 'Search', 'fill', sm=True), gap=8),
    row(chip('All'), chip('Upper chest', True), chip('Lower chest'), gap=6, wrap=True),
    row(chip('Any · 18', True), chip('Barbell · 5'), chip('Dumbbell · 6'), chip('Cable · 4'), gap=6, wrap=True),
    gcard(),
    row(lbl('Upper chest · 7'), sp(), txt('Tap to add · ⓘ details', 't-m')),
    grid(gtile('Incline dumbbell press', 'Dumbbell · 32 × 10', tag('Yours', 'neutral')), gtile('Butterfly', 'Machine · + front delt'), gtile('Smith machine bench press', 'Machine · + triceps'), gtile('Bench press', 'Today 100 × 5 · again?', tag('Done today', 'ok')), cols=2, gap=8),
    h=1150, close=False), h=1210), row_=2)

hm = lambda n, sub, on=False: li(n, sub, tile('home', 'brass' if on else 'neutral'), span(ico('check' if on else 'plus', 18), 'c-brass' if on else 'c-dim'))
P4('P04-Home-Pick.dc.html', 'Home set · add move', session_screen(ex_card(ex_head('Plank')), h=1014, state='home', clock='18:30', meta='4 sets · 3 moves', strip_=strip('4', '0', '3'), n=3, at=2, show_nav=False,
    overlay=sheet(None, row(txt('Add move', 't-h2', 'flex: 1'), tag('Home moves only', 'neutral', 'home'), gap=8),
                  lbl('Spotter’s home moves'),
                  lst(hm('Pushups', 'Chest · Reps', True), hm('Bench Dips', 'Triceps · Reps'), hm('Pullups', 'Lats · Reps'), hm('Bodyweight Squat', 'Quads · Reps'), hm('Side Bridge', 'Core · Hold'), hm('Stomach Vacuum', 'Core · Hold')),
                  lst(li('Create your own move', None, tile('plus', 'neutral'))),
                  txt('Gym exercises stay in gym sessions. Added moves also join “Home set”.', 't-m'),
                  h=760, close=False, footer=btn('Add Pushups', 'pri', full=True))), row_=2)

gp = lambda n, sub, tg='', pic=True: li(n, sub, tile('building', 'brass' if tg else 'neutral'), tg)
P4('P04-Gym-Picker.dc.html', 'Where are you training?', behind(sheet(None,
    txt('Where are you training?', 't-h2'),
    search('Search for a gym'),
    lst(gp(GYM, "You're here · open until 23:00", tag('Suggested', 'brass')), gp('Sport Life Podil', '1.8 km · open until 22:00'), gp('Home gym', 'Closed')),
    lbl('Gyms nearby'),
    lst(li('Atlet Fitness', '0.6 km', tile('pin'), tag('Add', 'neutral')), li('FitCurves Obolon', '1.1 km', tile('pin'), tag('Add', 'neutral'))),
    lst(li('Without a gym', None, tile('pin', 'neutral'))),
    h=700, close=False)), row_=2)

P4('P04-Coach.dc.html', 'Today’s read (session coach)', phone(strip('0', '0', '0'), empty_start, tabs=None, h=844, mood='art', top=hero_top('draft', '0:00', '0 sets · 0 t · 0 exercises'),
    overlay=sheet(None, lbl('Today’s read'),
                  card(row(span(ico('heart', 16), 'c-ok'), lbl('Readiness', 'ok'), gap=6), txt('Everything\'s ready — train what your plan calls for.', 't-h3'),
                       row(*[row(txt(m, 't-s'), txt(p, 't-s num c-ok'), gap=4) for m, p in [('Chest', '96%'), ('Triceps', '91%'), ('Shoulders', '88%')]], gap=14, wrap=True), tone='ok', gap=8),
                  row(span(ico('calendar', 16), 'c-brass'), txt('Chest 2 day', 't-h3'), gap=6),
                  lst(*[li(n, None, None, row(span(v, 't-s num'), tag(a, PH_TONE[a]), gap=6)) for n, v, a in [('Bench press', '100 × 5', 'Hold'), ('Incline dumbbell press', '34 × 10', 'Add load'), ('Cable crossover', '20 × 12', 'Hold'), ('Triceps pushdown', '37.5 × 12', 'Add load')]]),
                  h=600, close=False)), row_=2)

share_card = card(row(txt('spotter', 't-h3'), sp(), txt('28 Sep 2026', 't-m'), gap=8),
                  lbl('New record · Bench press', 'brass'), txt('Bench press', 't-h2'),
                  col(f'<div class="t-hero num">100 kg × 5</div>', txt('record', 't-m'), gap=4),
                  lst(li('e1RM', None, span('↑', 't-s c-ok'), span('117 kg (+2.9)', 't-s num c-brass')), li('Best weight', None, span('↑', 't-s c-ok'), span('100 kg (+2.5)', 't-s num')), li('Set volume', None, span('·', 't-s'), span('500 kg', 't-s num'))),
                  txt('spotter.app', 't-m', 'text-align: center'), tone='hero', gap=10, style='padding: 18px')
P4('P04-PR-Share.dc.html', 'Share the record', session_screen(bench_card(rows=BENCH_ROWS[4:], photos=False), h=1014, mood='ok', show_nav=False,
    overlay=sheet(None, f'<div style="width: 220px; align-self: center">{seg(["Story", "Square"])}</div>', share_card,
                  h=720, close=False, footer=row(btn('Share', 'pri', 'share', style='flex: 1'), ibtn('download', 'Save image', 'fill'), ibtn('link', 'Copy', 'fill'), gap=8))), row_=2)

mss = col(row(dot('bad'), col(txt('recovering', 't-h3 c-bad'), txt('Worked hard recently — more sets now mostly add fatigue.', 't-m'), gap=2), gap=10),
          grid(*[card(txt(v, 't-h2 num' + c), txt(l, 't-m'), style='padding: 10px', gap=2) for v, l, c in
                 [('4.0', 'Hard sets today', ''), ('62%', 'Next set is worth', ''), ('14', 'Sets this week · target 10–16', ''), ('High', 'Weekly fatigue', ' c-brass')]], cols=2, gap=8),
          row(txt('Last hard work', 't-m'), sp(), txt('today', 't-s')),
          txt('The dot on the muscle chip shows this state: red recovering, brass nearly, green ready.', 't-m'), gap=10)
P4('P04-Muscle-Info.dc.html', 'Muscle chip · state drawer', behind(sheet(None,
    txt('Chest', 't-h2'), bodypair(primary=('chest',), h=170), mss,
    h=790, close=False, footer=btn('Chest history', 'pri', full=True))), row_=2)

P4('P04-Muscle-Map-Covered.dc.html', 'Today’s muscle map · all covered', behind(sheet(None,
    lbl('Today’s muscle map'),
    bodypair(paint={'chest': 'productive', 'triceps': 'productive', 'shoulders': 'productive', 'lats': 'under', 'back': 'under', 'quads': 'under', 'hamstrings': 'under', 'glutes': 'under'}, h=250),
    row(zl('Under', 'under'), zl('Productive', 'productive'), zl('High', 'high'), zl('Over', 'over'), gap=14, justify='center'),
    txt('Colours show this week’s volume, today included', 't-m', 'text-align: center'),
    row(span(ico('check', 16), 'c-ok'), txt('Done today: Chest, Triceps, Shoulders', 't-s'), gap=6),
    txt('Everything planned is covered today — nice.', 't-b c-ok', 'text-align: center'),
    h=620, close=False)), row_=2)

P4('P04-Menu-Closed.dc.html', 'Exercise menu (not live)', phone(txt('Closed automatically', 't-l', 'padding: 0 2px'), tabs=None, h=844, mood='art', top=past_top,
    overlay=sheet(None, lbl('Bench press · 3 sets'),
                  lst(li('Replace exercise', None, span(ico('swap', 18), 'c-dim')), li('Duplicate with sets', None, span(ico('plus', 18), 'c-dim')),
                      li('Superset with…', None, span(ico('layers', 18), 'c-dim')), li('Details', None, span(ico('info', 18), 'c-dim')),
                      li('Open history', None, span(ico('progress', 18), 'c-dim')), li('Clear all sets', None, span(ico('rotate', 18), 'c-dim'))),
                  lst(li('Delete exercise', None, span(ico('trash', 18), 'c-bad'), tone='bad')),
                  h=560, close=False)), row_=2)

# --- ROW 3
P4('P04-Finish-Clean.dc.html', 'Finish · confirm (no empty exercise)', behind(dialog('Finish this session?', '12 sets, 5.8 t — saved to 28 Sep.', 'Finish', 'Keep going', kind='pri', top=360)), row_=3)


P4('P04-Edit-Hold.dc.html', 'Set editor · hold time (typed)', behind(sheet(None,
    se_head('Set 1 · Plank', 'logged 18:02'), lbl('Load type'),
    card(seg(['Weight', 'Assist', 'Band']), grid(stepper('BW', '', 'Weight, kg', big=False), card(txt('Hold, s', 't-l'), row(timein('0:55', True, 'Hold'), justify='center'), style='padding: 10px 12px', gap=8), cols=2, gap=8), style='padding: 10px'),
    lbl('Set type'), card(row(*[chip(x, x == 'Static-dynamic') for x in ['Working', 'Warm-up', 'Dropset', 'Reverse dropset', 'Static-dynamic']], gap=6, wrap=True), txt('timed hold', 't-m'), style='padding: 10px'),
    lbl('Effort (RPE)'), card(row(*[chip(x, x == 'Skip') for x in ['Skip', '6', '7', '8', '9', '10']], gap=5, wrap=True), txt('How hard the set felt, 6–10. Optional — tap a number to track it.', 't-m'), style='padding: 10px', gap=8),
    h=700, close=False, footer=ed_actions('Save'))), row_=2)

print('ok')
