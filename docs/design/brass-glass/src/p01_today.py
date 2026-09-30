"""P01 · Today & customize — 1:1 with the Today Configurator canvas (page v3: T1–T6, A1, A2, D1, D2, K2, K3)
and the app code (views/TodayView.tsx, NudgeStack, AtlasStrip, TrainerClientsStrip, HistoryTimeline, DayHistorySheet,
SleepAutomation, LiveHero, App.tsx shell). Copy = canvas / en.ts. Values = canvas values (Chest 1, MS - 6 days,
Thursday, October 1, Kate / Valeriia / Konrad …) — only the gym "Iron Club" is the standard "Iron Temple" (as on P02)."""
from kit import *

DATE = 'Thursday, October 1'


def atlas_face(s=40, temper=3):
    """AtlasFace.tsx: the real portrait for the temper (public/atlas/atlas-N.webp); Blunt = 3 is also the 'off' face."""
    return img(f'atlas/atlas-{temper}.webp', s, s, s // 2, alt='Atlas')
LINE = 'Pull is 30% under push for 3 weeks — add a row set on chest days.'


# ============================================================== shell (kit: phone tabs / brandbar / desktop / sleephero)
def ph(*content, nav=True, h=844, overlay='', mood='art'):
    return phone(*content, tabs='today' if nav else None, h=h, overlay=overlay, mood=mood)


def brand(night=False):
    """App.tsx header; while a night is live the SleepHero band sits right under it."""
    return brandbar() + (sleephero() if night else '')


def dateline(state='Synced', tone='ok', date=DATE):
    return row(lbl(date), sp(), row(dot(tone), txt(state, 't-m'), gap=6), style='padding: 0 2px')


def hl():
    return '<div class="hl"></div>'


def abs_(inner, css):
    return f'<div style="position: absolute; {css}">{inner}</div>'


def rel(inner, *badges, style=''):
    return f'<div style="position: relative; {style}">{inner}{"".join(badges)}</div>'


# ============================================================== Atlas & clients
def atlas_solo(line=LINE, count='2', name='Atlas', face=54, chev=False, band=False):
    """band=True: Today's .tcs strip — a full-bleed quiet band (hairline on top), not a card (e4)."""
    right = ico('chev', 18) if chev else (tag(count, 'atlas') if count else '')
    r = row(atlas_face(face), col(txt(name, 't-h3'), txt(line, 't-s'), gap=2, style='flex: 1; min-width: 0'), right, gap=12)
    if band:
        return col(hl(), col(r, style='padding: 12px 16px 4px'), gap=0, style='margin: 0 -16px')
    return card(r, style='padding: 12px 14px')


def story(name, ch=None, ring_tone=None, live=False, alert=False, count=None, s=54):
    face = atlas_face(s) if ch is None else avatar(ch, s)
    box = ring(100, s + 8, ring_tone, 2.5, face) if ring_tone else col(face, style=f'width: {s + 8}px; height: {s + 8}px; align-items: center; justify-content: center')
    badges = []
    if count:
        badges.append(abs_(tag(count, 'atlas'), 'top: -2px; right: -4px'))
    if alert:
        badges.append(abs_(tag('!', 'bad'), 'top: -2px; right: -4px'))
    if live:
        badges.append(abs_(row(dot('ok')), 'bottom: 6px; right: 6px'))
    return col(rel(box, *badges), txt(name, 't-m', 'white-space: nowrap'), gap=5, style='align-items: center; width: 64px')


def divider_v(h=44):
    return f'<div class="vl" style="height: {h}px; margin: 9px 2px 0"></div>'


def stories(clients=(('Kate', 'K', 'brass', False, False), ('Valeriia', 'V', None, False, False), ('Konrad', 'K', 'bad', False, False)), count=None):
    return row(story('Atlas', count=count), divider_v(), *[story(n, c, r, lv, al) for n, c, r, lv, al in clients], gap=8, align='flex-start')


# ============================================================== Program & week
PILL = {'done': ('check', 'ok'), 'missed': ('x', 'bad'), 'rest': ('yoga', 'rest'), 'sick': ('pulse', 'illness'), 'off': ('send', 'rest'),
        'off-next': ('send', 'neutral'), 'next-train': ('dumbbell', 'neutral'), 'next-rest': ('yoga', 'rest'), 'injury': ('bandage', 'bad'),
        'play': ('play', 'brass')}
CT = {'done': 'ok', 'missed': 'bad', 'rest': 'rest', 'sick': 'illness', 'off': 'rest', 'play': 'glass', 'injury': 'injury', 'next-rest': 'rest'}
DAYS = ('Sun', 'Mon', 'Tue', 'Wed', 'Today', 'Fri', 'Sat')
WEEK_T1 = ['done', 'missed', 'done', 'rest', 'play', 'next-train', 'next-rest']


def pill(st):
    if st == 'blank':
        return card(pad=False, style='width: 36px; height: 36px')
    i, t_ = PILL[st]
    return tile(i, t_)


def weekstrip(states=WEEK_T1, labels=DAYS, plain=False, gap=4):
    cells = []
    for i, st_ in enumerate(states):
        if plain:
            cells.append(card(tone=CT.get(st_, ''), pad=False, style='height: 40px'))
        else:
            today = labels[i] == 'Today'
            cells.append(col(pill(st_), txt(labels[i], 't-m c-brass' if today else 't-m'), gap=5, style='align-items: center'))
    return grid(*cells, cols=7, gap=gap)


def prog_head(kicker='Today · Chest 1', icon='list', name='MS - 6 days', sub='2 of 6 sessions · Assigned by coach', pct=33):
    return row(span(ico(icon, 20), 'c-brass', 'padding-top: 2px'),
               col(lbl(kicker, 'brass'), txt(name, 't-h2'), txt(sub, 't-s') if sub else '', gap=3, style='flex: 1; min-width: 0'),
               col(txt(f'{pct}%', 't-num c-brass num'), bar(pct, 'brass'), gap=8, style='width: 108px'), gap=10, align='flex-start')


def status_pill(text='Chest 1 — Chest · Triceps'):
    return card(txt(text, 't-s c-brass'), style='padding: 9px 12px', gap=0)


def prog_card(kicker='Today · Chest 1', icon='list', status='Chest 1 — Chest · Triceps', week=WEEK_T1, sub='2 of 6 sessions · Assigned by coach', labels=DAYS, bleed=True):
    """e1: .today-program-card is full-bleed brass glass (margin-inline -20px) — the focal block of Today."""
    return card(prog_head(kicker, icon, sub=sub), status_pill(status) if status else '', weekstrip(week, labels), tone='hero', gap=14,
                style='margin: 0 -16px; padding: 18px 20px 16px' if bleed else '')


# ============================================================== Nudges
def nudge_card(kicker='On your plan today', title='Chest 1', icon='calendar', tone='brass'):
    return card(row(tile(icon, tone), col(lbl(kicker), txt(title, 't-h3'), gap=2, style='flex: 1; min-width: 0'), ico('chev', 18), gap=12), style='padding: 12px 14px')


def nudge_deck(kicker='On your plan today', title='Chest 1', icon='calendar', tone='brass', n=4, peek=2):
    peeks = [card(pad=False, style=f'height: 12px; margin: -6px {8 + i * 8}px 0') for i in range(peek)][::-1]
    deck = col(*peeks, nudge_card(kicker, title, icon, tone), gap=0, style='flex-direction: column-reverse') if peek else nudge_card(kicker, title, icon, tone)
    rail = row(col(bar(30, 'neutral', 3), style='flex: 1'), *[col(bar(0, 'neutral', 3), style='width: 16px') for _ in range(n - 1)], gap=6) if n > 1 else ''
    return col(deck, rail, gap=10)


# ============================================================== Shortcuts / Body (custom sections)
SC_T1 = [('Chest 1', 'play', 'brass'), ('Dance', 'music', 'active'), ('Run', 'run', 'active'), ('Home set', 'home', 'brass'),
         ('Sleep', 'moon', 'sleep'), ('Weigh-in', 'scale', 'neutral'), ('Log past', 'history', 'neutral')]


def dash_tile(label, icon='plus', w=84):
    return card(tile(icon, 'neutral'), txt(label, 't-m'), tone='dash', pad=False, gap=7, style=f'width: {w}px; height: 86px; align-items: center; justify-content: center')


def sc_grid(items=SC_T1, add=True, sel=None, cols=4, drop=None):
    cells = []
    for i, (n, ic, t_) in enumerate(items):
        if drop is not None and i == drop:
            cells.append(card(txt('Drop here', 't-m'), tone='dash', pad=False, style='width: 84px; height: 86px; align-items: center; justify-content: center'))
        else:
            cells.append(shortcut(n, ic, t_, 'selected' if n == sel else 'default'))
    if add:
        cells.append(dash_tile('Add'))
    return grid(*cells, cols=cols, gap=7)


def wS(label, body, tone=None, w='171px', h=150):
    return card(lbl(label, tone), body, pad=False, gap=8, style=f'width: {w}; height: {h}px; padding: 14px')


def big_num(*parts):
    """parts: (value, unit) pairs"""
    return f'<div class="num t-d1" style="margin-top: auto">' + ''.join(f'{v}<span class="t-m"> {u} </span>' for v, u in parts) + '</div>'


def body_pair(w='171px', subs=True, bars=True, sleep_lbl='Last night'):
    """today/widgets/body.tsx, size S: Readiness (value %, sub tw.recovering(n), bar) · Last night (8h 30m, bed → wake)."""
    r = wS('Readiness', big_num(('82', '%')) + (bar(82, 'ok') if bars else '') + (txt('2 recovering', 't-m') if subs else ''), tone='ok', w=w)
    sl = wS(sleep_lbl, big_num(('8h', '30m')) + (txt('02:00 → 10:30', 't-m') if subs else ''), tone='sleep', w=w)
    return row(r, sl, gap=16)


# ============================================================== History timeline
def trow(time, icon, tone, title, val=None, sub=None, auto=False):
    t = span(title, 't-h3') + (span(f' · {val}', 'c-mut') if val else '') + (' ' + tag('auto', 'brass') if auto else '')
    return li(t, sub, lead=row(txt(time, 't-s num', 'width: 40px'), tile(icon, tone), gap=8), trail=ibtn('chev', 'Open', 'fill', sm=True), style='padding: 8px 10px 8px 14px')


NODE = {'today': lambda: col(dot('neutral'), style='width: 36px; height: 20px; align-items: center; justify-content: center'),
        'trained': lambda: tile('check', 'ok', s=14), 'rest': lambda: tile('yoga', 'rest', s=14)}


def tday(label, node, rows, last=False):
    nd = col(NODE[node](), '' if last else '<div class="vl" style="flex: 1; width: 0"></div>', gap=4, style='width: 36px; align-items: center')
    return row(nd, col(lbl(label), lst(*rows), gap=8, style='flex: 1; min-width: 0; padding-bottom: 6px'), gap=10, align='stretch')


def hist_days(n=3):
    d = [tday('Today · Oct 1', 'today', [trow('02:00', 'moon', 'sleep', 'Sleep', '8:30', auto=True)]),
         tday('Tue · Sep 29', 'trained', [trow('05:00', 'moon', 'sleep', 'Sleep', '5:23'), trow('20:47', 'dumbbell', 'brass', 'Pull + Shoulders', sub='1:35 · 26 sets · 12 929 kg')]),
         tday('Mon · Sep 28 · Rest day', 'rest', [trow('23:00', 'music', 'active', 'Dance', '125 min')], last=True)]
    return d[:n]


def customize_btn(w=None):
    """e4: .td-customize — a quiet link at the very bottom, not a card."""
    return row(btn('Customize Today', 'txt', 'sliders', sm=True), justify='center' if not w else 'flex-start', style='padding: 4px 0')


def see_all():
    return row(btn('See all history ↗', 'txt', sm=True), justify='center')


# ============================================================== Today stack (T1)
def today_stack(status=(), atlas=None, program=None, nudges=None, custom=True, history=None, date_state=('Synced', 'ok'), extra_end=(), night=False):
    out = [brand(night), dateline(*date_state)]
    out += list(status)
    out.append(atlas if atlas is not None else atlas_solo(band=True))
    out.append(program if program is not None else prog_card())
    out += [hl(), nudges if nudges is not None else nudge_deck()]
    if custom:
        out += [hl(), section('Shortcuts'), sc_grid(), hl(), section('Body'), body_pair()]
    out += [hl()] + (list(history) if history is not None else [section('History'), *hist_days(), see_all()])
    out += [customize_btn()] + list(extra_end)
    return out


# T1 · Today (as is) + custom sections
ADMIN_CLIENTS = (('Valeriia', 'V', None, True, False), ('Kate', 'K', 'brass', False, False), ('Konrad', 'K', 'bad', False, True), ('Oleh', 'O', None, False, False))
P('P01-Today.dc.html', 'Today · with custom sections (scroll) · Member', ph(*today_stack(), h=1760), h=1760, row_=0)
P('P01-Today-Default.dc.html', 'Today · default layout (core blocks only) · Member', ph(*today_stack(custom=False), h=1280), h=1280, row_=0)
P('P01-Today-Admin.dc.html', 'Today · Atlas & clients stories (scroll) · Admin', ph(*today_stack(atlas=stories(ADMIN_CLIENTS, count='2')), h=1760), h=1760, row_=0)
P('P01-Today-Night.dc.html', 'Today · night live (scroll) · Member', ph(*today_stack(night=True), h=1840, mood='sky'), h=1840, row_=1)

# ============================================================== T2 · Customize Today (mobile, arrows, no D&D)
def edit_hdr(night=False):
    """TodayCustomize .tdc-top: Cancel (ghost) · Customize Today · Save (primary, enabled once the draft changed)."""
    return (sleephero() if night else '') + row(btn('Cancel', 'txt'), txt('Customize Today', 't-h3', 'flex: 1; text-align: center'), btn('Save', 'pri', sm=True), style='height: 56px; padding: 0 8px 0 12px')


def ctrl(up=True, down=True, conf='sliders', conf_label='Configure', trash=False, arrows=True, conf_icon=True, configure=True):
    items = []
    if arrows:
        dis = lambda i: col(span(ico(i, 18), 'c-dim'), style='width: 36px; height: 36px; align-items: center; justify-content: center')
        items += [ibtn('up', 'Move up', '', sm=True) if up else dis('up'), ibtn('down', 'Move down', '', sm=True) if down else dis('down')]
    if configure:
        items.append(ibtn(conf, conf_label, 'fill', sm=True) if conf_icon else btn('Configure', 'sec', sm=True))
    if trash:
        items.append(tile('trash', 'bad'))
    return row(*items, gap=6)


def eblock(name, tg, inner, custom=False, tail=None, pin=False, drag=False):
    t_ = tag(tg, 'brass' if custom else 'neutral')
    head = row(ico('drag', 16) if drag else '', ico('pin', 14) if pin else '', lbl(name), t_, sp(), tail or '', gap=8)
    return card(head, inner, tone='dash', style='padding: 10px 10px 12px', gap=10)


STATUS_HINT = lambda: card(txt('Injury, illness and rest banners appear here', 't-s', 'text-align: center'), tone='dash', style='padding: 10px')


def status_block():
    """Status: tag "Always first", no arrows, not configurable."""
    return eblock('Status', 'Always first', STATUS_HINT())


def edit_prog(labels=False):
    """edit preview: the block itself, but dimmed to e3 so the edit chrome (Save, Add section) leads."""
    return card(lbl('Today · Chest 1', 'brass'), row(txt('MS - 6 days', 't-h3'), sp(), txt('33%', 't-h3 c-brass num')),
                status_pill() if not labels else '', weekstrip(WEEK_T1, plain=True, gap=6), gap=10)


def edit_nudge():
    return card(row(lbl('On your plan today'), txt('Chest 1', 't-h3'), gap=10), style='padding: 14px 16px')


def edit_hist():
    return tday('Today · Oct 1', 'today', [li(span('Sleep', 't-h3') + span(' · 8:30', 'c-mut'), style='padding: 8px 14px')], last=True)


def add_here():
    return row('<div class="hl" style="flex: 1"></div>', btn('Add section here', 'txt', 'plus', sm=True), '<div class="hl" style="flex: 1"></div>', gap=8)


def shortcuts_edit(sel='Run'):
    """custom section: tag = layout sizes; shortcuts show items + 1 empty "Add" slot; selected widget → select bar."""
    selbar = row(txt(sel, 't-s', 'flex: 1'), ibtn('back', 'Move up', 'fill', sm=True), ibtn('chev', 'Move down', 'fill', sm=True),
                 ibtn('swap', 'Add widget', 'fill', sm=True), tile('trash', 'bad'), gap=6)
    return eblock('Shortcuts', 'XS × 4–8', col(sc_grid(sel=sel), selbar, gap=10), custom=True, tail=ctrl(conf='sliders', conf_label='Edit section', trash=True))


def body_edit(tail=None):
    return eblock('Body', 'S + S', body_pair(subs=False, bars=False), custom=True, tail=tail or ctrl(conf='sliders', conf_label='Edit section', trash=True))


def edit_stack(role='member', night=False):
    atlas_tag, atlas_prev = ('Core · Compact', atlas_solo()) if role == 'member' else ('Core · Together', stories(count='2'))
    return [edit_hdr(night), status_block(), add_here(),
            eblock('Atlas & clients', atlas_tag, atlas_prev, tail=ctrl(up=False, conf_label='Configure · Atlas & clients')), add_here(),
            eblock('Program & week', 'Core · Standard', edit_prog(), tail=ctrl(conf_label='Configure · Program & week')), add_here(),
            eblock('Nudges & reminders', 'Core · 11 of 11 on', edit_nudge(), tail=ctrl(conf_label='Configure · Nudges & reminders')), add_here(),
            shortcuts_edit(), add_here(), body_edit(), add_here(),
            eblock('History', 'Core · 5 days', edit_hist(), tail=ctrl(down=False, conf_label='Configure · History')),
            btn('Add section', 'pri', 'plus', full=True), row(sp(), btn('Reset to default', 'txt'))]


P('P01-Edit.dc.html', 'Customize Today · edit mode (scroll) · Member', ph(*edit_stack(), nav=False, h=2000), h=2000, row_=0)
P('P01-Edit-Admin.dc.html', 'Customize Today · edit mode (scroll) · Admin', ph(*edit_stack('admin'), nav=False, h=2000), h=2000, row_=0)
P('P01-Edit-Night.dc.html', 'Customize Today · night live (scroll) · Member', ph(*edit_stack(night=True), nav=False, h=2080, mood='sky'), h=2080, row_=1)
P('P01-Discard.dc.html', 'Customize Today · discard changes · Member', ph(*edit_stack()[:6], nav=False,
    overlay=dialog('Discard changes?', 'Your changes to Today won’t be saved.', 'Discard', 'Keep editing', 'dan', top=300)), row_=3)

# ============================================================== T3 · Shortcuts sheet
def sc_pick(n, ic, t_, on=False, w=84):
    s = shortcut(n, ic, t_, 'selected' if on else 'default')
    return rel(s, abs_(check(True), 'top: 5px; right: 5px') if on else '', style=f'width: {w}px')


def sc_row(items):
    return row(*[sc_pick(*x) for x in items], gap=7, justify='space-between')


def dash_search(label='All 34'):
    return card(tile('search', 'neutral'), txt(label, 't-m'), tone='dash', pad=False, gap=7, style='width: 84px; height: 86px; align-items: center; justify-content: center')


def edit_behind():
    return [edit_hdr(), status_block()]


P('P01-Shortcuts.dc.html', 'Shortcuts sheet · Member', ph(*edit_behind(), nav=False, overlay=sheet(None,
    row(txt('Shortcuts', 't-h2'), sp(), txt('7 of 8', 't-s')),
    txt('One tap from Today starts it — the same actions as the Start sheet.', 't-s', 'margin-top: -6px'),
    chips(['All', 'Train', 'Activities', 'Health & body'], 0, wrap=False),
    lbl('Train'),
    sc_row([("Today’s day", 'play', 'brass', True), ('Auto session', 'bolt', 'brass'), ('Home set', 'home', 'brass', True), ('Log past', 'history', 'neutral', True)]),
    lbl('Activities · favourites first'),
    sc_row([('Dance', 'music', 'active', True), ('Run', 'run', 'active', True), ('Cycling', 'bike', 'active'), ('Swim', 'wave', 'active')]),
    row(sc_pick('Yoga', 'yoga', 'rest'), sc_pick('Sauna', 'flame', 'rest'), sc_pick('Padel', 'target', 'sport'), dash_search(), gap=7, justify='space-between'),
    lbl('Health & body'),
    sc_row([('Sleep', 'moon', 'sleep', True), ('Active rest', 'run', 'rest'), ('Day off', 'send', 'rest'), ('Unwell', 'pulse', 'illness')]),
    sc_row([('Injury', 'bandage', 'injury'), ('Next lesson', 'book', 'learn'), ('Ask Atlas', 'spark', 'atlas'), ('Weigh-in', 'scale', 'neutral', True)]),
    h=820, footer=btn('Done', 'pri', full=True))), row_=2)

# ============================================================== T4 · New section sheet
def sk(css):
    return f'<div class="sk" style="{css}"></div>'


def thumb(kind):
    g = lambda *x, c=2: grid(*x, cols=c, gap=4)
    h = 'height: 20px'
    th = {'shortcuts': g(*[sk(h) for _ in range(8)], c=4),
          'pair': g(sk('height: 44px'), sk('height: 44px')),
          'wide': sk('height: 44px'),
          'wide-pair': col(sk(h), g(sk('height: 20px'), sk('height: 20px')), gap=4),
          'quad': g(*[sk(h) for _ in range(4)]),
          'rows': col(sk('height: 12px'), sk('height: 12px'), sk('height: 12px'), gap=4),
          'big': sk('height: 44px; width: 44px')}[kind]
    return col(th, style='height: 48px; justify-content: center')


def layout_opt(name, size, kind, on=False):
    return card(thumb(kind), row(txt(name, 't-h3'), sp(), txt(size, 't-m', 'white-space: nowrap'), gap=6), tone='glass' if on else '', pad=False, gap=10, style='padding: 10px')


LAYOUTS = [('Shortcuts', 'XS × 4–8', 'shortcuts'), ('Pair', 'S + S', 'pair'), ('Quad', '4 × S', 'quad'), ('Rows', 'M × 1–5', 'rows'),
           ('Wide', 'L', 'wide'), ('Wide + pair', 'L · S S', 'wide-pair'), ('Big', 'XL', 'big')]  # components/ui/WidgetGrid.tsx SECTION_LAYOUTS

def section_sheet(heading, after, title, on, submit, warn=None):
    return sheet(None,
        col(txt(heading, 't-h2'), txt(f'Goes after <b>{after}</b>', 't-s') if after else '', gap=2),
        lbl('Title'), field(value=title),
        lbl('Layout'), grid(*[layout_opt(n, s_, k, k == on) for n, s_, k in LAYOUTS], cols=2, gap=8),
        banner(warn, None, 'bad', 'warn') if warn else '',
        txt('Sizes: XS shortcut · S square · M row · L wide · XL big square. Same on desktop, just wider.', 't-m'),
        h=820, footer=row(btn('Cancel', 'sec'), btn(submit, 'pri', style='flex: 1'), gap=10))


P('P01-AddSection.dc.html', 'New section sheet · Member', ph(*edit_behind(), nav=False, overlay=section_sheet('New section', 'Nudges &amp; reminders', 'My section', 'pair', 'Add section')), row_=2)
P('P01-EditSection.dc.html', 'Edit section sheet · layout change warning · Member', ph(*edit_behind(), nav=False,
    overlay=section_sheet('Edit section', None, 'Body', 'wide', 'Save', 'Widgets that won’t fit: 1. They’ll be removed from the section.')), row_=2)


# PickerSheet (design B5): slot title, hint, group chips, previews at the slot size, "Put X here"
def pick_tile(name, body, tone=None, on=False):
    w = card(lbl(name, tone), body, tone='glass' if on else '', pad=False, gap=8, style='width: 100%; height: 150px; padding: 14px')
    return col(w, txt(name, 't-m', 'text-align: center'), gap=6)


P('P01-FillSlot.dc.html', 'Fill a slot · widget picker (S) · Member', ph(edit_hdr(), eblock('My section', 'S + S', row(card(txt('Picking…', 't-s c-brass'), tone='glass', pad=False, style='flex: 1; height: 150px; align-items: center; justify-content: center'),
    card(txt('+ Add widget', 't-s'), tone='dash', pad=False, style='flex: 1; height: 150px; align-items: center; justify-content: center'), gap=12), custom=True, tail=ctrl(conf='sliders', conf_label='Edit section', trash=True)), nav=False, overlay=sheet(None,
    col(txt('Small slot', 't-h2'), txt('Tap a widget to preview it in the slot', 't-s'), gap=2),
    chips(['All', 'Training', 'Plan & sessions', 'Strength', 'Muscles & consistency', 'Body & recovery', 'Cardio & gyms', 'Apex', 'Learn', 'Atlas', 'Discover', 'Fun & tools', 'Calendar'], 5, wrap=True),
    grid(pick_tile('Readiness', big_num(('82', '%')) + bar(82, 'ok') + txt('2 recovering', 't-m'), 'ok', True),
         pick_tile('Last night', big_num(('8h', '30m')) + txt('02:00 → 10:30', 't-m'), 'sleep'),
         pick_tile('Body weight', big_num(('82.4', 'kg')) + txt('−0.3 kg this week', 't-m')),
         pick_tile('Energy today', big_num(('~2 450', 'kcal'))), cols=2, gap=10),
    h=820, footer=btn('Put Readiness here', 'pri', full=True))), row_=2)

# ============================================================== T5 · Atlas strip: solo or stories
def plain_board(w, h, *items, pad='20px 0', gap=14):
    return f'<div class="scr" style="width: {w}px; height: {h}px; padding: {pad}; display: flex; flex-direction: column; gap: {gap}px">{"".join(items)}</div>'


def note(text):
    return card(txt(text, 't-s'), tone='dash', style='padding: 14px 16px')


board('P01-AtlasStrip.dc.html', 'Atlas & clients: solo or stories · Member / Admin', 390, 620, plain_board(390, 620,
    col(lbl('A · No clients — Atlas solo', 'brass'), atlas_solo(), txt('One full-width row: the face, his temper by colour, the latest note.', 't-s'), gap=12, style='padding: 0 16px'),
    col(lbl('B · With clients — stories', 'brass'),
        stories((('Kate', 'K', 'brass', False, False), ('Valeriia', 'V', None, True, False), ('Konrad', 'K', 'bad', False, True)), count='2'),
        txt('Atlas is the first bubble, then a divider and the clients: brass ring — new, green dot — training now, red — not seen for a long time.', 't-s'), gap=12, style='padding: 8px 16px 0'),
    col(note('Core block “Atlas & clients”: view A or B is picked by itself — by whether there are clients. In Customize it can be moved and configured, but not removed.'), style='padding: 10px 16px 0')), row_=0)

# ============================================================== T6 · Remove confirm
P('P01-RemoveConfirm.dc.html', 'Remove section · confirm · Member', ph(
    edit_hdr(), body_edit(),
    nav=False, overlay=dialog('Remove “Body”?',
                              'The section and its 2 widgets leave Today. Your data stays untouched — you can add the section back anytime.',
                              'Remove', 'Cancel', 'dan', top=290)), row_=3)

# ============================================================== A2 · Atlas & clients — configure
def mini_line(w):
    return sk(f'height: 6px; width: {w}')


def cfg_opt(name, sub, thumb_html, on=False):
    return rel(card(card(thumb_html, pad=False, style='height: 40px; padding: 8px; justify-content: center'), col(txt(name, 't-h3'), txt(sub, 't-m'), gap=1),
                    tone='glass' if on else '', pad=False, gap=8, style='padding: 10px'),
               abs_(check(True), 'top: 8px; right: 8px') if on else '')


def mini_av(n=4):
    return row(atlas_face(18), *[avatar('', 18) for _ in range(n)], gap=5)


def cfg_sheet(title, *body, h=820):
    """CoreConfigSheet: title = todayCore[id], lock line, body, Reset block / Done."""
    return sheet(None, col(txt(title, 't-h2'), row(ico('lock', 14), txt('Core block — configure or move, it can’t be removed', 't-s'), gap=6), gap=4), *body,
                 h=h, footer=row(btn('Reset block', 'sec'), btn('Done', 'pri', style='flex: 1'), gap=10))


def atlas_views(sel='compact'):
    return grid(cfg_opt('Note of the day', 'One daily insight', row(atlas_face(18), col(mini_line('50%'), mini_line('90%'), mini_line('70%'), gap=4, style='flex: 1'), gap=8), sel == 'note'),
                cfg_opt('Quick chat', 'Last message + replies', col(mini_line('70%'), row(mini_line('24%'), mini_line('20%'), mini_line('22%'), gap=5), gap=6), sel == 'chat'),
                cfg_opt('Compact', 'Face + one line', row(atlas_face(18), mini_line('100%'), dot('bad'), gap=8), sel == 'compact'),
                cfg_opt('Off when no notes', 'Appears only if new', card(txt('hidden until a note', 't-m', 'text-align: center'), tone='dash', pad=False, style='padding: 4px'), sel == 'auto'), cols=2, gap=8)


P('P01-ConfigCore.dc.html', 'Configure · Atlas & clients · Admin', ph(*edit_behind(), nav=False, overlay=cfg_sheet('Atlas & clients',
    lbl('Layout'),
    grid(cfg_opt('Together', 'One stories strip', mini_av(4)), cfg_opt('Split', 'Atlas, then Clients', col(row(atlas_face(14), mini_line('80%'), gap=6), mini_av(3), gap=5), True), cols=2, gap=8),
    lbl('Atlas view'), atlas_views('note'),
    lbl('Clients view'), seg(['Stories', 'List'], 0),
    lst(li('Order', 'Which block sits on top', trail=seg(['Atlas first', 'Clients first'], 0)),
        li('Clients training now first', 'Anyone live leads the row', trail=toggle(True)),
        li('Hide clients inactive 30+ days', 'They stay in your clients list', trail=toggle(False))), h=880), h=920), h=920, row_=2)
P('P01-ConfigAtlas-Member.dc.html', 'Configure · Atlas & clients (no clients: Atlas view only) · Member', ph(*edit_behind(), nav=False, overlay=cfg_sheet('Atlas & clients',
    lbl('Atlas view'), atlas_views('compact'), h=460)), row_=2)
P('P01-ConfigProgram.dc.html', 'Configure · Program & week · Member', ph(*edit_behind(), nav=False, overlay=cfg_sheet('Program & week',
    prog_card(bleed=False),
    lbl('Card style'), seg(['Compact', 'Standard', 'Detailed'], 1),
    lbl('Show'),
    lst(li('Week pills', 'Done, rest, sick, off, injury, next', trail=toggle(True)), li('Exercise list', 'Names of today’s exercises', trail=toggle(False)),
        li('Gym step', 'Ask which gym before Start', trail=toggle(True)), li('“Log past session” link', 'When today has no plan', trail=toggle(False))))), row_=2)
NUDGE_KINDS = ['Program plan for today', 'Likely today', 'Unlogged gym visit', 'Weigh-in reminder', 'Trends: things to fix', 'Suggest a program',
               'Readiness', 'Energy out this week', 'Playbook', 'Learn progress', 'Sleep reminders']
P('P01-ConfigNudges.dc.html', 'Configure · Nudges & reminders · Member', ph(*edit_behind(), nav=False, h=940, overlay=cfg_sheet('Nudges & reminders',
    lbl('Show on Today'), lst(*[li(k, trail=toggle(True), style='min-height: 46px') for k in NUDGE_KINDS]), h=900)), h=940, row_=2)
P('P01-ConfigHistory.dc.html', 'Configure · History · Member', ph(*edit_behind(), nav=False, overlay=cfg_sheet('History',
    hist_days(1)[0],
    lbl('Days shown'), seg(['3', '5', '7'], 1),
    lbl('Default view'), seg(['Timeline', 'Calendar'], 0),
    lst(li('Show planned program days', 'Dashed outline on upcoming training days', trail=toggle(True))), h=640)), row_=2)

# ============================================================== A1 · Atlas & clients — variants (spec board)
def prog_peek(sub=True):
    return card(lbl('Today · Chest 1', 'brass'), txt('MS - 6 days', 't-h2'), txt('2 of 6 sessions · Assigned by coach', 't-m') if sub else '', tone='glass', gap=4, style='margin-top: auto')


def mini(inner, h=470, peek=True, w=390, sub=False):
    return card(dateline(), *inner, prog_peek(sub) if peek else '', pad=False, gap=12, style=f'width: {w}px; height: {h}px; padding: 14px 16px; overflow: hidden')


def vcap(title, desc, *inner, w=390):
    return col(lbl(title, 'brass'), txt(desc, 't-s'), *inner, gap=8, style=f'width: {w}px')


def live_now(name='Valeriia · Chest 1', sub='Set 9 of 22 · 34 min · Iron Temple'):
    return card(row(rel(avatar('V', 40), abs_(row(dot('ok')), 'bottom: 0; right: 0')), col(lbl('Live now', 'ok'), txt(name, 't-h3'), txt(sub, 't-m'), gap=1, style='flex: 1; min-width: 0'), btn('Watch', 'pri', sm=True), gap=10), tone='ok', style='padding: 10px 12px')


def more_bubble(label='+7', name='More'):
    return col(card(txt(label, 't-s'), tone='dash', pad=False, style='width: 54px; height: 54px; align-items: center; justify-content: center'), txt(name, 't-m'), gap=5, style='align-items: center; width: 64px')


def note_card(text, chips_, acts, pager=True, ask=False):
    return card(row(atlas_face(40), col(row(txt('Atlas', 't-h3'), tag('Strict coach', 'atlas'), gap=8), txt('07:40 · 3 unread', 't-m'), gap=2, style='flex: 1'), tag('3', 'atlas'), gap=10),
                lbl('Note of the day', 'atlas'), txt(text, 't-b'), row(*chips_, gap=6, wrap=True),
                row(*acts, sp(), row(bar(100, 'bad', 3), style='width: 16px') if pager else '', gap=8, wrap=True),
                search_ask() if ask else '', gap=10, style='padding: 14px')


def search_ask():
    return field(ph='Ask Atlas…', trail=row(ico('mic', 18), ibtn('up', 'Send', 'pri', sm=True), gap=6))


HL102 = 'Bench e1RM just hit <span class="c-ok">102 kg</span> — a PR. Keep today heavy, but your pull volume is still 30% under push. Add 2 row sets after Chest 1.'

var_a = vcap('a · Together (as now)', 'One stories strip: Atlas first, a divider, then the clients. Minimum height, maximum faces.',
             mini([stories((('Valeriia', 'V', None, True, False), ('Kate', 'K', 'brass', False, False), ('Konrad', 'K', 'bad', False, True), ('Oleh', 'O', None, False, False)), count='2'),
                   hl(), txt('Tap Atlas → chat with notes. Tap a client → their day and session.', 't-s')], sub=True))
var_b = vcap('b · Split: Atlas + Clients', 'Technically one block, visually two: the Atlas strip on top, below it a separate clients section with “Live now”.',
             mini([atlas_solo(), section('Clients · 12', 'All ›'), live_now(),
                   row(story('Kate', 'K'), story('Konrad', 'K', 'bad', alert=True), story('Oleh', 'O'), story('Marta', 'M', 'brass'), more_bubble(), gap=6, align='flex-start')]))
var_c = vcap('c · Atlas · Note of the day', 'One main thought a day. The ring is Atlas’s temper colour; “Reply” opens the chat, “Got it” clears the counter.',
             mini([note_card(HL102, [tag('↑ Bench 102 kg PR', 'ok'), tag('Pull / push 0.7', 'bad')], [btn('Reply', 'pri', sm=True), btn('Got it', 'sec', sm=True)])]))
var_d = vcap('d · Atlas · Quick chat', 'Atlas’s latest message, three ready replies and a field with a mic — answer without leaving Today.',
             mini([card(row(atlas_face(36), col(txt('Atlas', 't-h3'), row(dot('ok'), txt('online', 't-m c-ok'), gap=5), gap=1, style='flex: 1'), ibtn('external', 'Expand', 'fill', sm=True), gap=10),
                        card(txt('You slept 5:23 on Tuesday and Chest 1 is heavy today. Want me to cap top sets at RPE 8?', 't-s'), style='padding: 10px 12px; margin-right: 40px'),
                        txt('07:42', 't-m'), row(chip('Yes, cap at RPE 8'), chip('Keep the plan'), chip('Why?'), gap=6, wrap=True), search_ask(), gap=10, style='padding: 14px')]))
var_e = vcap('e · Atlas · Compact', 'Only the face and one line. For those who need Atlas as a signal, not a conversation.',
             mini([card(row(atlas_face(30), txt('<b>Atlas</b> · Pull 30% under push — add a row set', 't-s', 'flex: 1; white-space: nowrap; overflow: hidden'), tag('2', 'atlas'), ico('chev', 16), gap=10), style='padding: 10px 12px')], h=180))
var_g = vcap('g · Side by side in one row', 'Atlas is an S-size card on the left, clients a horizontal scroll on the right. One height: 150.',
             mini([row(card(row(atlas_face(28), txt('Atlas', 't-h3'), sp(), tag('2', 'atlas'), gap=8), txt('Pull is 30% under push. Add a row set today.', 't-s'), txt('Open chat ›', 't-s c-brass'), style='width: 160px; height: 150px; padding: 12px', pad=False, gap=8),
                       card(lbl('Clients · 1 live'), row(story('Valeriia', 'V', live=True, s=40), story('Kate', 'K', 'brass', s=40), story('Konrad', 'K', 'bad', alert=True, s=40), gap=0, style='margin-top: auto'), pad=False, gap=8, style='flex: 1; height: 150px; padding: 12px; overflow: hidden'), gap=8)], h=270))
var_f = vcap('f · Clients as a list', 'Rows instead of bubbles — for trainers with many clients: who is training now, who has gone quiet, where there is an alert.',
             mini([card(row(atlas_face(30), txt('<b>Atlas</b> · Konrad has skipped 3 sessions', 't-s', 'flex: 1'), tag('1', 'atlas'), gap=10), style='padding: 10px 12px'),
                   row(lbl('Clients · 12'), sp(), row(dot('ok'), txt('1 live', 't-m c-ok'), dot('bad'), txt('2 alerts', 't-m c-bad'), gap=5)),
                   lst(li('Valeriia', 'Training now · Chest 1 · 34 min', rel(avatar('V', 36), abs_(row(dot('ok')), 'bottom: 0; right: 0')), btn('Watch', 'pri', sm=True), tone=None),
                       li('Kate', 'New PR · Squat 110 kg · 2 h ago', ring(100, 40, 'brass', 2, avatar('K', 34)), tag('PR', 'ok')),
                       li('Konrad', 'Last seen 9 days · missed 3 sessions', ring(100, 40, 'bad', 2, avatar('K', 34)), btn('Nudge', 'dan', sm=True)),
                       li('Marta', 'Done · Pull + Shoulders · 1:12 · 11 480 kg', avatar('M', 36), chev=True),
                       li('Oleh', 'Rest day · next Legs on Fri', avatar('O', 36), chev=True)),
                   btn('All 12 clients ›', 'sec', full=True)], h=620))


def client_tile(ch, name, sub, ring_=None, alert=False, tone=None):
    av = ring(100, 40, ring_, 2, avatar(ch, 34)) if ring_ else avatar(ch, 36)
    return card(row(rel(av, abs_(tag('!', 'bad'), 'top: -4px; right: -6px') if alert else ''), col(txt(name, 't-h3'), txt(sub, 't-m c-bad' if tone == 'bad' else 't-m'), gap=1, style='min-width: 0'), gap=10), style='padding: 10px 12px')


var_desk = vcap('Desktop · Split', 'On a wide screen the two blocks become columns: Atlas’s note of the day with the chat on the left, the clients grid on the right.',
                card(dateline(), row(
                    col(note_card('Bench e1RM hit <span class="c-ok">102 kg</span> — a PR. Pull volume is still 30% under push: add 2 row sets after Chest 1.',
                                  [tag('↑ Bench 102 kg', 'ok'), tag('Pull / push 0.7', 'bad')], [chip('Add the rows'), chip('Not today'), chip('Show pull trend')], pager=False, ask=True), style='width: 320px'),
                    col(section('Clients · 12', 'All clients ›'), live_now(),
                        grid(client_tile('K', 'Kate', 'PR · Squat 110 kg', 'brass'), client_tile('K', 'Konrad', 'Last seen 9 days', 'bad', True, 'bad'),
                             client_tile('M', 'Marta', 'Done · Pull + Shoulders'), client_tile('O', 'Oleh', 'Rest day · Legs Fri'),
                             client_tile('A', 'Andrii', 'Next · Chest 2 Sat'), card(txt('+6 more ›', 't-s', 'text-align: center'), tone='dash', style='justify-content: center'), cols=2, gap=8), gap=10, style='flex: 1; min-width: 0'),
                    gap=18, align='flex-start'), prog_peek(), pad=False, gap=14, style='width: 790px; height: 620px; padding: 18px 22px'), w=790)

board('P01-Atlas-Variants.dc.html', 'Atlas & clients — variants · Admin', 1700, 1680, plain_board(1700, 1680,
    col(lbl('Core block · Atlas & clients', 'brass'), txt('Atlas & clients — variants', 't-h1'),
        txt('One core block, but it can be shown together or split into two visual blocks; Atlas gets his own modes (note of the day, quick chat, compact), clients — stories or a list.', 't-s', 'max-width: 920px'), gap=8),
    row(var_a, var_b, var_c, var_d, gap=16, align='flex-start'),
    row(col(var_e, var_g, gap=22), var_f, var_desk, gap=16, align='flex-start'),
    note('Rule: in every variant this is one core block “Atlas & clients” — it can be moved and configured (see A2), but not removed. Without clients the Clients section disappears and the chosen Atlas mode remains. Colours: coral — Atlas, brass ring — new, green — training now, red — not seen for a long time / alert.'),
    pad='40px 44px', gap=26), row_=0)

# ============================================================== K2 · History · Calendar view (mobile)
def mark_workout(done=True):
    return col(bar(100 if done else 35, 'brass', 3), style='width: 14px')


def star():
    return span(ico('star', 10, fill=True), 'c-ok')


def cal_cell(n, kind='plan', marks=(), num_cls='t-s num', big=False, extra=()):
    """kind: past, rest, sel, today, plan, planrest, restplan"""
    h = 100 if big else 56
    inner = col(txt(n, num_cls), *extra, sp(), row(*marks, gap=3) if marks else '', gap=3 if big else 0, style='height: 100%')
    css = f'height: {h}px; padding: {"8px 10px" if big else "5px 6px"}'
    if kind == 'sel':
        return f'<div class="field focus" style="{css}; display: block">{inner}</div>'
    tone = {'past': '', 'rest': 'rest', 'today': 'glass', 'plan': 'dash', 'planrest': 'dash', 'restplan': 'rest'}[kind]
    return card(inner, tone=tone, pad=False, gap=0, style=css)


def cal_grid_m():
    W = mark_workout
    cells = [cal_cell('27', 'past', [W(), dot('rest'), dot('sleep'), star()], 't-s num c-dim'),
             cal_cell('28', 'rest', [dot('ok'), dot('sleep')], 't-s num c-rest'),
             cal_cell('29', 'sel', [W(), dot('sleep')], 't-s num c-dim'),
             cal_cell('30', 'rest', [dot('sleep'), dot('neutral')], 't-s num c-rest'),
             cal_cell('1', 'today', [W(False), dot('sleep')], 't-s num c-brass'),
             cal_cell('2', 'plan', [W(False)]), cal_cell('3', 'restplan', [], 't-s num c-rest')]
    for d in range(4, 32):
        wd = (d + 3) % 7  # 0 = Sun
        if wd == 3:
            cells.append(cal_cell(str(d), 'planrest'))
        else:
            cells.append(cal_cell(str(d), 'plan', [W(False)] + ([dot('sport')] if d == 17 else [])))
    return col(grid(*[txt(x, 't-m', 'text-align: center') for x in 'SMTWTFS'], cols=7, gap=5), grid(*cells, cols=7, gap=5), gap=6)


def legend(challenge=False):
    sq = lambda t_: card(pad=False, tone=t_, style='width: 11px; height: 11px')
    items = [row(mark_workout(), txt('Workout', 't-m'), gap=5), row(dot('ok'), txt('Activity', 't-m'), gap=5), row(dot('sleep'), txt('Sleep', 't-m'), gap=5),
             row(star(), txt('PR', 't-m'), gap=5), row(dot('neutral'), txt('Weight', 't-m'), gap=5), row(sq('rest'), txt('Rest', 't-m'), gap=5),
             row(sq('illness'), txt('Sick', 't-m'), gap=5), row(sq('rest'), txt('Off', 't-m'), gap=5), row(sq('injury'), txt('Injury', 't-m'), gap=5),
             row(sq('dash'), txt('Planned', 't-m'), gap=5)]
    if challenge:
        items.append(row(sq('apex'), txt('Challenge', 't-m'), gap=5))
    return row(*items, gap=12, wrap=True)


def cal_filters(today=False):
    return row(btn('Today', 'sec', sm=True) if today else '', chip('All', True), chip('Workouts', icon='minus'), chip('Activities', icon=None), chip('Sleep'), chip('Weight'), chip('★ PRs'), gap=8, wrap=True)


def sel_day(desk=False):
    return col(row(tile('check', 'ok', s=14), lbl('Tue · Sep 29'), sp(), txt('Selected day · day 3 of 6' if desk else 'day 3 of 6', 't-m'), gap=10),
               lst(trow('05:00', 'moon', 'sleep', 'Sleep', '5:23'), trow('20:47', 'dumbbell', 'brass', 'Pull + Shoulders', sub='1:35 · 26 sets · 12 929 kg')),
               btn('+ Log for Sep 29', 'sec', sm=True, full=desk, style='align-self: flex-start' if not desk else ''), gap=10)


def last30(desk=False):
    cell = lambda v, l, c='': col(txt(v, f't-h2 num {c}', 'text-align: center'), txt(l, 't-m', 'text-align: center'), gap=0, style='flex: 1')
    stats = card(row(cell('22', 'trained'), '<div class="vl" style="align-self: stretch"></div>', cell('6', 'rest', 'c-rest'), '<div class="vl" style="align-self: stretch"></div>', cell('1', 'sick', 'c-ok'),
                     '<div class="vl" style="align-self: stretch"></div>', cell('4', 'PRs', 'c-ok'), '<div class="vl" style="align-self: stretch"></div>', cell('49.2<span class="t-m"> t</span>', 'volume'), gap=4), tone='quiet')
    head = row(lbl('Last 30 days · Sep 2 – Oct 1' if desk else 'Last 30 days'), sp(), '' if desk else txt('Sep 2 – Oct 1', 't-m'))
    return col(head, stats, row(btn('Open full calendar ↗', 'txt', sm=True), justify='center'), gap=6)


def hist_head(settings=False):
    return row(lbl('History'), sp(), seg(['Timeline', 'Calendar'], 1), ibtn('sliders', 'History settings', 'fill', sm=True) if settings else '', gap=8)


def month_head(desk=False):
    title = col(txt('October 2026', 't-h1'), txt('1 logged · 26 planned · MS - 6 days', 't-s'), gap=2)
    nav_ = row(ibtn('back', 'Previous month', 'fill', sm=True), ibtn('chev', 'Next month', 'fill', sm=True), gap=6)
    if desk:
        return row(title, nav_, sp(), cal_filters(today=True), gap=14)
    return row(title, sp(), nav_)


P('P01-History-Calendar.dc.html', 'History · calendar view (Today, scroll) · Member', ph(
    brand(), dateline(), hl(), hist_head(), month_head(), cal_grid_m(), legend(), cal_filters(), sel_day(), last30(),
    hl(), row(tile('sliders', 'neutral'), col(txt('History settings', 't-h3'), txt('Customize Today → History', 't-m'), gap=1), gap=12),
    lst(li('Default view', trail=seg(['Timeline', 'Calendar'], 1)), li('Show planned program days', trail=toggle(True)), li('Week starts on', trail=txt('Sunday ›', 't-s'))),
    customize_btn(), h=1500), h=1500, row_=0)

# ============================================================== App-code states (TodayView.tsx)
# Loading — the skeleton TodayView renders while the store is empty (showSkeleton)
P('P01-Today-Loading.dc.html', 'Today · loading (skeleton) · Member', ph(
    brand(), col(sk('width: 120px; height: 10px'), sk('width: 210px; height: 26px'), gap=9, style='padding-top: 6px'),
    row(*[sk('flex: 1; height: 46px') for _ in range(7)], gap=6), sk('height: 62px'), row(sk('flex: 1; height: 92px'), sk('flex: 1; height: 92px'), gap=10)), row_=1)

# Offline — Status block banner + SyncChip "Offline" + served-from-cache footnote
P('P01-Today-Offline.dc.html', 'Today · offline, changes queued (scroll) · Member', ph(*today_stack(
    status=[banner('No connection. 3 changes queued — they’ll sync on their own.', None, 'bad', 'cloudoff')], date_state=('Offline', 'bad'),
    extra_end=[txt('Everything below is served from the local cache.', 't-m')]), h=1840), h=1840, row_=1)

# Live session — LiveHero (mode="compact") above Today, from App.tsx
def live_compact(label='Live · Iron Temple', clock='42:18', meta='12 · 5.8 t'):
    body = row(col(row(dot('brass'), lbl(label, 'brass'), gap=8), row(span(clock, 't-h1 num'), span(meta, 't-s'), gap=10, align='baseline'), gap=4, style='flex: 1'), ibtn('play', 'Resume', 'pri'), gap=10)
    return rel(photo('100%', 96, 18, ''), abs_(body, 'left: 0; right: 0; top: 0; bottom: 0; padding: 12px 12px 12px 16px; display: flex; align-items: center'))


P('P01-Today-Live.dc.html', 'Today · session live (LiveHero compact) · Member', ph(
    brand(), col(livehero('compact', 'Live · Iron Temple', '42:18', '12 · 5.8 t', action=ibtn('play', 'Resume', 'pri')), style='margin: -14px -16px 0'), *today_stack()[1:6]), row_=1)

# Activity in progress — the resume row in the Status block
def activity_resume():
    return card(row(tile('run', 'sport'), col(lbl('Activity in progress'), txt('Run', 't-h3'), gap=2, style='flex: 1'), btn('Resume', 'sec', 'next', sm=True), gap=12), style='padding: 12px 14px')


P('P01-Today-Activity.dc.html', 'Today · activity in progress · Member', ph(*today_stack(status=[activity_resume()])[:7]), row_=1)

# Injury (rehab stage) — status banner + program card in injury mode
def pills(*p):
    return row(*[tag(t_, 'neutral', i) for t_, i in p], gap=6, wrap=True)


def stage_dots(cur, total=4, done_tone='ok'):
    return row(*[dot(done_tone if i < cur else 'bad' if i == cur else 'neutral') for i in range(total)], gap=6)


def b_rehab():
    return card(row(tile('pulse', 'injury'), col(lbl('Reintroduce · step 2 of 4', 'injury'), txt('Shoulder rehab', 't-h3'), stage_dots(1),
                                                txt('Today’s session is built around what’s safe — the injured area stays protected this stage.', 't-s'),
                                                pills(('Shoulders', None), ('Chest', None)),
                                                row(btn('View plan', 'sec', 'list', sm=True), btn('Check-in', 'txt', 'pulse', sm=True), gap=8), gap=8, style='flex: 1'), gap=12, align='flex-start'), tone='injury')


INJ_WEEK = ['done', 'missed', 'done', 'rest', 'injury', 'next-train', 'next-rest']
P('P01-Today-Injury.dc.html', 'Today · injury rehab · Member', ph(*today_stack(status=[b_rehab()], program=prog_card('Shoulder rehab', 'bandage', week=INJ_WEEK))[:7], mood='bad'), row_=1)

# Program rest day — program card in rest mode (no session planned)
REST_WEEK = ['done', 'missed', 'done', 'rest', 'rest', 'next-train', 'next-rest']
P('P01-Today-Rest.dc.html', 'Today · program rest day · Member', ph(*today_stack(
    program=prog_card('Rest day · Thursday', 'yoga', 'Your program has today down as recovery — no session planned.', REST_WEEK),
    nudges=nudge_deck('Readiness', 'Some muscles are ready, some are still recovering.', 'pulse', 'ok', n=3))[:7], mood='rest'), row_=1)

# New user — no program, no history (td-empty), Atlas off (invite), Learn banner above the nudge stack
def learn_banner(title='Learn how to master Spotter', done=0, total=24):
    return card(row(tile('book', 'learn'), col(lbl('Learn', 'learn'), txt(title, 't-h3'), bar(round(done / total * 100), 'learn', 4), txt(f'{done} / {total} lessons', 't-m'), gap=5, style='flex: 1'), ico('chev', 18), gap=12), tone='learn', style='padding: 12px 14px')


def td_empty(gym_hint=True):
    return col(card(col(tile('dumbbell', 'brass', lg=True), txt('Nothing logged yet', 't-h3', 'text-align: center'),
                        txt('Start a session and this page fills with your weeks, records and trends. Templates appear after the second one.', 't-s', 'text-align: center; max-width: 290px'),
                        btn('Start your first session', 'pri', 'play', full=True), btn('Log a past session', 'txt', sm=True), gap=10, style='align-items: center; padding: 22px 8px'), tone='hero'),
               card(row(tile('pin', 'brass'), txt('Add your gym. Train there without logging — and Today will remind you.', 't-s', 'flex: 1'), btn('Add', 'txt'), gap=12), style='padding: 10px 14px') if gym_hint else '', gap=10)


P('P01-Today-Empty.dc.html', 'Today · new user (scroll) · Member', ph(
    brand(), dateline(), atlas_solo('A coach who reads every set. You pick how harsh.', None, 'Meet Atlas, your coach', chev=True),
    hl(), learn_banner(), hl(), td_empty(), customize_btn(), h=1000), h=1000, row_=1)

# Trainer — Today is only the clients strip (TrainerClientsStrip with Atlas first)
P('P01-Today-Trainer.dc.html', 'Today · clients only · Trainer', ph(
    brand(), stories((('Valeriia', 'V', None, True, False), ('Kate', 'K', 'brass', False, False), ('Konrad', 'K', 'bad', False, True), ('Oleh', 'O', None, False, False)), count='2')), row_=1)

# ============================================================== Status block · every banner (TodayView status core block)
def acts(*b):
    return row(*b, gap=8, wrap=True)


def ban(icon, tone, kicker, title, body=None, extra=(), actions=None, ctone=None, right=None):
    head = row(lbl(kicker, tone if tone != 'neutral' else None), sp(), right) if right else lbl(kicker, tone if tone != 'neutral' else None)
    return card(row(tile(icon, tone), col(head, txt(title, 't-h3'), *extra, txt(body, 't-s') if body else '', actions or '', gap=7, style='flex: 1; min-width: 0'), gap=12, align='flex-start'),
                tone=ctone if ctone is not None else tone, style='width: 358px')


STATUS = [
    ('Offline · changes queued', banner('No connection. 3 changes queued — they’ll sync on their own.', None, 'bad', 'cloudoff')),
    ('Syncing · sending queued changes', card(row(ico('rotate', 18), txt('Sending queued changes', 't-s', 'flex: 1'), txt('3', 't-m num'), gap=10), bar(66, 'brass'), style='width: 358px')),
    ('Activity in progress', col(activity_resume(), style='width: 358px')),
    ('Injury · full rest', ban('moon', 'rest', 'Full rest', '5 days left', 'Full rest until your clinician’s date — then the by-feel stages begin.', [pills(('Program paused', 'pause'))], acts(btn('View plan', 'sec', 'list', sm=True)))),
    ('Injury · rehab stage', col(b_rehab(), style='width: 358px')),
    ('Injury · ready to move up', ban('up', 'ok', 'Two good check-ins in a row', 'Ready to move up to Rebuild?', 'Your area handled this stage well. The next one loads it a bit more — gradually.', (),
                                     acts(btn('Stay a bit longer', 'txt', sm=True), btn('Move up →', 'ok', sm=True)))),
    ('Injury · all stages cleared', card(col(tile('spark', 'ok', lg=True), txt('You’re back to full training', 't-h2', 'text-align: center'),
                                             txt('The area cleared every stage. Protected days are back in your program.', 't-s', 'text-align: center'), stage_dots(4),
                                             btn('Back to my program', 'ok', 'check', sm=True), gap=10, style='align-items: center; padding: 6px 0'), tone='ok', style='width: 358px')),
    ('Illness · resting up', ban('pulse', 'illness', 'Taking care', 'Resting up · day 2', 'Get well first — nothing counts as missed, and your program is waiting.',
                                 [pills(('Streak protected', 'check'), ('Program paused', 'pause'))], acts(btn('I’m recovered', 'sec', 'check', sm=True)), ctone='illness')),
    ('Rest period · active recovery', ban('timer', 'active', 'Active recovery', 'Recovery week', 'Light training with reduced targets. These days count as rest.', [bar(43, 'active', 4)],
                                          acts(btn('Start light session', 'sec', 'play', sm=True), btn('End rest now', 'txt', sm=True)), right=txt('Day 3/7', 't-m'))),
    ('Rest period · full rest — no gym', ban('timer', 'rest', 'Full rest — no gym', 'Rest — away from the gym', 'Fully off — no gym. These days count as rest, not missed.', [bar(40, 'rest', 4)],
                                             acts(btn('End rest now', 'sec', sm=True)), right=txt('Day 2/5', 't-m'))),
    ('Back from illness', ban('sun', 'illness', 'Welcome back', 'Take it easy today', 'You were out 3 days — no streak lost. Ease back in: go lighter on your first session.', (),
                              acts(btn('Start light session', 'sec', 'play', sm=True), btn('Got it', 'txt', sm=True)), ctone='illness')),
]
board('P01-Status.dc.html', 'Status block · every banner · Member', 1600, 1060, spec('Status block · every banner (Today, always first)',
    *[cap(c, b, w=358) for c, b in STATUS], w=1600, h=1060), row_=1)

# ============================================================== Nudges block · deck, stack kinds, Learn, sleep cards
def rd_chip(name, group, pct, cls, view='front', region='torso'):
    """Readiness.tsx .rd-chip: MuscleIcon (the app's anatomy, cropped) · name · % in the readiness colour."""
    return card(row(col(bodymap(view, [group], region=region, h=26), style='width: 22px; align-items: center'), txt(name, 't-m'), txt(pct, f't-m num {cls}'), gap=6),
                pad=False, style='padding: 3px 10px 3px 6px')


def nfull(icon, tone, kicker, title, body=None, extra=(), action=None):
    return card(row(tile(icon, tone), lbl(kicker, tone if tone != 'neutral' else None), gap=10), txt(title, 't-h3'), *extra, txt(body, 't-s') if body else '', action or '', gap=8, style='width: 358px')


def tp_timing():
    return row(row(tile('timer', 'neutral'), col(txt('~18:30', 't-h3 num'), txt('Usual start', 't-m'), gap=0), gap=8),
               row(tile('clock', 'neutral'), col(txt('~16:45', 't-h3 num'), txt('Eat ~1h45m before', 't-m'), gap=0), gap=8), gap=18)


N_PLAN = nfull('calendar', 'brass', 'On your plan today', 'Chest 1', None, [txt('Chest · Triceps', 't-s'), tp_timing()])
N_VISIT = nfull('pin', 'neutral', 'Iron Temple', '1h 10m at Iron Temple on Sep 29 with nothing logged.', action=btn('Log it', 'sec', sm=True, style='align-self: flex-start'))
N_READY = nfull('pulse', 'kcal', 'Readiness', 'Some muscles are ready, some are still recovering.', None,
                [txt('5 ready · 2 recovering', 't-s num'), row(rd_chip('Chest', 'chest', '100%', 'c-ok'), rd_chip('Back', 'back', '92%', 'c-ok', 'back'), rd_chip('Quads', 'quads', '61%', 'c-brass', region='lower'), gap=6, wrap=True)], btn('Full read →', 'sec', sm=True, style='align-self: flex-start'))
N_WEIGH = nfull('scale', 'neutral', 'Time to weigh in', 'You usually weigh in around 07:30. Nothing logged today yet.', action=btn('Add weight', 'sec', sm=True, style='align-self: flex-start'))
N_CHECK = nfull('chart', 'danger', 'Training check', '3 quick wins spotted', 'Spotter flagged pull volume · rest · progression. Here’s how to fix them.', action=btn('Open Trends →', 'sec', sm=True, style='align-self: flex-start'))
N_SUGG = nfull('spark', 'ok', 'Suggested for you', 'Ready to build your program', 'You’ve logged enough that Spotter can turn your week into a repeatable program — no manual setup.', action=btn('Build my program →', 'sec', sm=True, style='align-self: flex-start'))
N_DRIFT = nfull('spark', 'ok', 'Suggested for you', 'Your program has drifted', 'The last few weeks don’t match your current program. Spotter can rebuild it from what you’re actually doing.', action=btn('Review & replace →', 'sec', sm=True, style='align-self: flex-start'))
N_ENERGY = nfull('flame', 'kcal', 'kcal · last 7 days', '~14 200', None, [row(txt('3 400 lifting · 1 900 cardio', 't-s'), txt('8 900 passive', 't-m'), gap=10)])
N_LIKELY = nfull('calendar', 'brass', 'Likely today', 'Push day', None, [txt('Chest · Shoulders · Triceps', 't-s'), tp_timing()])
N_PLAY = nfull('layers', 'ok', 'Playbook', 'Built from how you train', None, [row(tag('Push A · 6 exercises', 'neutral'), tag('Pull B · 5 exercises', 'neutral'), tag('Legs · 5 exercises', 'neutral'), gap=6, wrap=True)],
               btn('Open Playbook →', 'sec', sm=True, style='align-self: flex-start'))
N_LEARN = nfull('book', 'learn', 'Learn', 'Keep learning Spotter', None, [bar(25, 'learn', 4), txt('6 / 24 lessons', 't-m')], btn('Start learning →', 'sec', sm=True, style='align-self: flex-start'))


def sleep_missing():
    return card(row(tile('moon', 'sleep'), col(txt('Last night’s sleep is missing', 't-h3'), txt('You’ve logged 11 of the last 14 nights — want to fill this one? Roughly is fine.', 't-s'), gap=3, style='flex: 1'),
                    ibtn('x', 'Done', '', sm=True), gap=12, align='flex-start'), row(btn('Use my usual · 7h 30m', 'sec', sm=True), btn('Enter', 'txt', sm=True), gap=8), tone='sleep', style='width: 358px')


def sleep_auto():
    return card(row(tile('moon', 'sleep'), col(row(txt('Last night 8h 30m · 02:00→10:30', 't-h3 num'), tag('auto', 'sleep', 'spark'), gap=8, wrap=True),
                                               txt('Filled from your Wednesday pattern — adjust if it’s off, and the pattern learns from your fix.', 't-s'), gap=4, style='flex: 1'), gap=12, align='flex-start'),
                row(btn('Adjust times', 'sec', 'edit', sm=True), btn('Looks right', 'pri', sm=True), gap=8), tone='sleep', style='width: 358px')


NUDGES = [('Deck · one nudge (no rail)', col(nudge_deck(n=1, peek=0), style='width: 358px')),
          ('Deck · 4 nudges, rail advances every 15 s', col(nudge_deck(), style='width: 358px')),
          ('Learn · none completed (full banner above the deck)', col(learn_banner(), style='width: 358px')),
          ('Sleep · last night missing', sleep_missing()),
          ('Sleep · auto-filled night', sleep_auto()),
          ('Stack card · Readiness', N_READY), ('Stack card · On your plan today', N_PLAN), ('Stack card · gym visit, nothing logged', N_VISIT),
          ('Stack card · Likely today (no program)', N_LIKELY), ('Stack card · Weigh-in', N_WEIGH), ('Stack card · Training check', N_CHECK),
          ('Stack card · Program suggestion · new', N_SUGG), ('Stack card · Program suggestion · drifted', N_DRIFT), ('Stack card · Energy', N_ENERGY),
          ('Stack card · Playbook', N_PLAY), ('Stack card · Learn · in progress', N_LEARN)]
board('P01-Nudges.dc.html', 'Nudges block · deck and every card · Member', 1600, 1560, spec('Nudges block · deck, Learn, sleep cards and every stack card', *[cap(c, b, w=358) for c, b in NUDGES], w=1600, h=1560), row_=1)

# Nudge stack opened — every card in full, fixed importance order, close
P('P01-Nudges-Open.dc.html', 'Nudges · stack open · Member', ph(*today_stack()[:6], overlay=
    '<div class="scrim"></div>' * 3 + abs_(col(row(sp(), ibtn('x', 'Close', 'fill'), gap=0), N_PLAN, N_VISIT, N_READY, N_WEIGH, gap=12), 'left: 16px; right: 16px; top: 60px')), row_=2)

# Program suggestion sheet (from the "Suggested for you" nudge)
def ps_opt(title, body, on=False):
    return card(row(col(txt(title, 't-h3'), txt(body, 't-s'), gap=3, style='flex: 1'), span(ico('check', 20), 'c-brass') if on else '', gap=12), tone='glass' if on else '')


P('P01-ProgSuggest.dc.html', 'Create your program sheet · Member', ph(*today_stack()[:6], overlay=sheet(None, txt('Create your program', 't-h2'),
    ps_opt('Weekly split only', 'Just the training days by weekday — no exercises. You fill each day yourself.', True),
    ps_opt('Weekdays + last week’s lifts', 'The same weekday split, prefilled with the exercises from your most recent training week.'),
    h=420, footer=row(btn('Cancel', 'sec'), btn('Create program', 'pri', style='flex: 1'), gap=10))), row_=2)

# End rest / illness confirms (ConfirmDialog)
P('P01-EndRest.dc.html', 'End rest period · confirm · Member', ph(*today_stack(status=[STATUS[8][1]])[:5], mood='rest', overlay=dialog('End rest period?', 'It ends now — these days stop counting as rest.', 'End rest now', 'Cancel', 'dan', top=300)), row_=3)
P('P01-EndIllness.dc.html', 'Back from illness · confirm · Member', ph(*today_stack(status=[STATUS[7][1]])[:5], mood='rest', overlay=dialog('Come back from illness?', 'Your sick pause ends today. Spotter will keep the protected streak and ease you back into training.', 'Yes, I’m recovered', 'Cancel', 'pri', top=300)), row_=3)

# ============================================================== Day drawer (DayHistorySheet) — from the week pills / calendar
def day_energy():
    return row(tile('flame', 'kcal'), col(txt('~2 450<span class="t-m"> kcal</span>', 't-num num'), txt('1 780 passive · 670 active', 't-m'), gap=2), gap=12, style='padding: 2px 2px 6px')


P('P01-DaySheet.dc.html', 'Day drawer · a trained day · Member', ph(*today_stack()[:4], overlay=sheet('Tuesday, September 29', day_energy(),
    lst(trow('05:00', 'moon', 'sleep', 'Sleep', '5:23'), trow('20:47', 'dumbbell', 'brass', 'Pull + Shoulders', sub='1:35 · 26 sets · 12 929 kg')), h=400, close=False)), row_=2)
P('P01-DaySheet-Night.dc.html', 'Day drawer · a trained day · night live · Member', ph(*today_stack(night=True)[:4], mood='sky', overlay=sheet('Tuesday, September 29', day_energy(),
    lst(trow('05:00', 'moon', 'sleep', 'Sleep', '5:23'), trow('20:47', 'dumbbell', 'brass', 'Pull + Shoulders', sub='1:35 · 26 sets · 12 929 kg')), h=400, close=False)), row_=1)
P('P01-DaySheet-Today.dc.html', 'Day drawer · today, start from it · Member', ph(*today_stack()[:4], overlay=sheet('Thursday, October 1', day_energy(),
    lst(trow('02:00', 'moon', 'sleep', 'Sleep', '8:30', auto=True)), h=400, close=False, footer=btn('Start session', 'pri', 'play', full=True))), row_=2)


def day_note(icon, tone, title, body):
    return card(row(tile(icon, tone), col(txt(title, 't-h3'), txt(body, 't-s'), gap=2, style='flex: 1'), gap=12), style='width: 358px')


board('P01-DaySheet-Notes.dc.html', 'Day drawer · day notes · Member', 1600, 420, spec('Day drawer · day notes (above the day’s entries)',
    cap('Missed program day', day_note('x', 'bad', 'Missed session', '“Legs 2” was on your plan for this day — but nothing was logged.'), w=358),
    cap('Rest day', day_note('yoga', 'rest', 'Rest day', 'Rest day — recovery, no training planned.'), w=358),
    cap('Full rest (4+ days)', day_note('send', 'rest', 'Full rest', 'Time off — away from the gym.'), w=358),
    cap('Sick day', day_note('pulse', 'illness', 'Sick day', 'Sick day — resting up over training.'), w=358), w=1600, h=420), row_=2)

# ============================================================== Desktop (D1, D2, K3)
def dshell(w, h, main, side, mood='art', night=False):
    """kit desktop() = AppRail; Start (or the Add to Today library) stands open on the right."""
    side_html = f'<div class="vl" style="position: absolute; right: 0; top: 0; bottom: 0; width: 360px; padding: 26px 20px; display: flex; flex-direction: column; gap: 12px">{side}</div>'
    body = (sleephero() if night else '') + main
    return desktop(col(body, gap=16, style='margin-right: 320px; flex: 1; min-height: 0; overflow: hidden'), 'today', w, h, right=side_html, mood='sky' if night else mood)


def start_side():
    t_ = lambda ti, su, ic, tn: card(tile(ic, tn), txt(ti, 't-h3'), txt(su, 't-m'), style='padding: 12px', gap=8)
    return (txt('Start', 't-h2') +
            card(row(col(lbl('Today in program', 'brass'), txt('Chest 1', 't-h2'), txt('MS - 6 days · Thursday', 't-s'), gap=3, style='flex: 1'), ibtn('play', 'Start', 'pri'), gap=12), tone='glass') +
            grid(t_('Auto session', 'A full day from your goal & recovery', 'spark', 'brass'), t_('Activity', 'Run, ride, sport', 'pulse', 'sport'),
                 t_('Health', 'Sleep, recovery, injury, unwell', 'timer', 'rest'), t_('Log past', 'A session you forgot', 'history', 'neutral'), cols=2, gap=8) +
            card(row(tile('home', 'brass'), col(txt('Home set', 't-h3'), txt('Pull-ups, vacuum, push-ups — no gym', 't-m'), gap=2, style='flex: 1'), gap=12), style='padding: 12px'))


def dhist_days():
    d1 = tday('Today · Oct 1', 'today', [trow('02:00', 'moon', 'sleep', 'Sleep', '8:30')], last=True)
    d2 = tday('Tue · Sep 29', 'trained', [trow('05:00', 'moon', 'sleep', 'Sleep', '5:23'), trow('20:47', 'dumbbell', 'brass', 'Pull + Shoulders', sub='1:35 · 26 sets · 12 929 kg')], last=True)
    return row(col(d1, style='width: 250px'), col(d2, style='width: 290px'), col(see_all(), style='flex: 1'), gap=18, align='flex-start')


D1_main = (dateline() + atlas_solo() + prog_card(bleed=False) + nudge_card() + hl() + section('Shortcuts') + sc_grid(cols=8) + hl() +
           section('Body') + body_pair(w='100%') + hl() + section('History') + dhist_days() + row(customize_btn(w='230px')))
board('P01-Desktop.dc.html', 'Desktop · Today · Member', 1440, 1380, dshell(1440, 1380, D1_main, start_side()), row_=3)
board('P01-Desktop-Night.dc.html', 'Desktop · Today · night live · Member', 1440, 1460, dshell(1440, 1460, D1_main, start_side(), night=True), row_=1)


board('P01-Desktop-Edit.dc.html', 'Desktop · Customize Today (scroll) · Member', 1440, 1960, dshell(1440, 1960,
    ''.join(edit_stack()).replace('width: 171px', 'width: 100%'), start_side()), row_=3)


def dcell(n, kind='plan', lines=(), sleep=None, num_cls='t-s num', label=None):
    head = row(txt(n, num_cls), span(label, 't-m c-brass') if label else '', sp(), txt(f'☾ {sleep}', 't-m num') if sleep else '', gap=6)
    return cal_cell('', kind, (), big=True, extra=[head, *lines]).replace('<div class="t-s num" style=""></div>', '', 1)


def ptag(t_):
    return tag(t_, 'brass')


K3_rows = [
    dcell('Sep 27', 'past', [row(ptag('Legs'), star(), gap=4), tag('Walk 40m', 'active')], '7:55', 't-s num c-dim'),
    dcell('28', 'rest', [tag('Dance 125m', 'active'), txt('Rest', 't-m c-rest')], '6:30', 't-s num c-rest'),
    dcell('29', 'sel', [ptag('Pull + Should…')], '5:23'),
    dcell('30', 'rest', [txt('Rest', 't-m c-rest'), txt('81.4 kg', 't-m')], '7:50', 't-s num c-rest'),
    dcell('1', 'today', [tag('Chest 1', 'brass')], '8:30', 't-s num c-brass', 'Today'),
    dcell('2', 'plan', [tag('Chest 2', 'neutral')]),
    dcell('3', 'restplan', [txt('Travel', 't-m c-rest')], None, 't-s num c-rest'),
]
PLAN = ['Pull + Should…', 'Legs', 'Back + Arms', None, 'Legs 2', 'Chest 1', 'Chest 2']
for d in range(4, 32):
    wd = (d + 3) % 7
    p = PLAN[wd]
    lines = [tag(p, 'neutral')] if p else [txt('Rest', 't-m c-rest')]
    if d == 17:
        lines.append(tag('Football 90m', 'sport'))
    if d == 24:
        lines.append(tag('Plank day 24', 'apex'))
    K3_rows.append(dcell(str(d), 'planrest' if not p else 'plan', lines))

K3_main = (dateline() + hl() + hist_head(settings=True) + month_head(desk=True) +
           grid(*[txt(x, 't-l', 'text-align: center') for x in ('Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat')], cols=7, gap=8) + grid(*K3_rows, cols=7, gap=8) +
           legend(challenge=True) + row(col(sel_day(desk=True), style='width: 476px'), col(last30(desk=True), style='flex: 1'), gap=24, align='flex-start'))
board('P01-Desktop-Calendar.dc.html', 'Desktop · History · calendar view · Member', 1440, 1100, dshell(1440, 1100, K3_main, start_side()), row_=3)

# ============================================================== en.ts: Empty slot · Add widget (custom section right after it is added)
P('P01-EmptySlot.dc.html', 'Customize Today · new section, empty slots · Member', ph(
    edit_hdr(),
    eblock('Nudges', 'Core · 9 of 11 on', edit_nudge(), tail=ctrl()),
    eblock('My section', 'Pair', row(*[card(txt('Empty slot', 't-s'), btn('Add widget', 'txt', 'plus', sm=True), tone='dash', pad=False, gap=4, style='flex: 1; height: 150px; align-items: center; justify-content: center') for _ in range(2)], gap=12),
           custom=True, tail=ctrl(conf='sliders', conf_label='Edit section', trash=True)),
    nav=False), row_=0)
# ============================================================== completeness pass (rule #0c)
# LiveHero on a HOME set: the home image (public/home-hero.webp), "Live · Home set · <name>", "<sets> sets · <n> moves"
def live_home(label='Live · Home set · Evening', timer='18:05', meta='8 sets · 3 moves'):
    body = (f'<div class="bd">{row(dot("brass"), f"<span class=t-l style=font-size:10px>{label}</span>", gap=8)}'
            f'<div style="display: flex; align-items: baseline; gap: 10px"><span class="num t-h3">{timer}</span><span class="t-m num">{meta}</span></div></div>')
    return col(f'<div class="lhero" style="height: 72px">{img("home-hero.webp", "100%", 72, 0, style="position: absolute; left: 0; top: 0")}<div class="scr2"></div>{body}'
               f'<div class="ac">{ibtn("play", "Resume", "pri")}</div></div>', style='margin: -14px -16px 0')


P('P01-Today-Live-Home.dc.html', 'Today · home set live (LiveHero compact, home image) · Member', ph(brand(), live_home(), *today_stack()[1:6]), row_=1)


# Program card — every mode TodayView computes (train · done · rest · active · illness · off · injury) + the no-program week strip
def pmode(kicker, icon, status, today_state, label='Today'):
    wk = ['done', 'missed', 'done', 'rest', today_state, 'next-train', 'next-rest']
    return prog_card(kicker, icon, status, wk, bleed=False)


NOPROG = card(weekstrip(['rest', 'done', 'done', 'rest', 'play', 'blank', 'blank']), tone='hero')
MODES = [('Train · a program day', pmode('Today · Chest 1', 'list', 'Chest 1 — Chest · Triceps', 'play')),
         ('Done · trained today', pmode('Today · Chest 1', 'list', None, 'done')),
         ('Rest · program rest day', pmode('Rest day · Thursday', 'yoga', 'Your program has today down as recovery — no session planned.', 'rest')),
         ('Active recovery period', pmode('Active recovery', 'yoga', None, 'rest')),
         ('Illness', pmode('Taking care', 'pulse', None, 'sick')),
         ('Full rest (away)', pmode('Full rest', 'send', None, 'off')),
         ('Injury · rehab on a program day', pmode('Shoulder rehab', 'bandage', 'Chest 1 — Chest · Triceps', 'injury')),
         ('No program · week strip only (after the first session)', NOPROG)]
board('P01-Program-Modes.dc.html', 'Program & week · every card mode · Member', 1600, 880,
      spec('Program & week · every mode (TodayView programCard / weekCard)', *[cap(c, b, w=380) for c, b in MODES], w=1600, h=880), row_=1)

# Edit section · switching a filled Shortcuts section to widgets (todayLayoutKind)
P('P01-EditSection-Kind.dc.html', 'Edit section sheet · shortcuts ↔ widgets warning · Member', ph(*edit_behind(), nav=False,
    overlay=section_sheet('Edit section', None, 'Shortcuts', 'pair', 'Save', 'Shortcuts and widgets don’t mix — items to remove: 7. Add widgets to the new slots afterwards.')), row_=2)

print('ok')
