"""P16 · Trainer & admin — 1:1 with the People sub-app and the role-specific pieces of the Gym app.
Sources: views/RosterApp.tsx (nav, header, tabs), views/TrainerView.tsx (+ TrainerClientDialog, TrainerInviteDialog),
views/AdminView.tsx (+ NewPersonDialog, LinkDialog, menu sheet, AssignTrainerDialog, EditDialog, DeleteDialog),
views/ProfileView.tsx (Me tab + a person's profile, ProfileAssignTrainerSheet, ProfileAssignClientsSheet, TrainerLivePanel),
views/ClientPage.tsx, views/TraineeSessionView.tsx, components/TrainerClientsStrip.tsx, components/TrainerLiveBanner.tsx,
trainerLive.ts, views/TodayView.tsx (trainer / admin branches), views/ProgramsView.tsx + programs/AssigneesSheet.tsx
(coach assign flow), views/ProgramAssignDialog.tsx, components/ShellLauncher.tsx (People tile), components/AppRail.tsx.
Copy = en.ts. Mock data = standard (Mykola, clients Anna · Oleh · Iryna · Marek, Iron Temple, Upper/Lower 4×, 28 Sep 2026).
See fidelity/P16.md for the board → source map."""
from kit import *

import glob as _glob, os as _os
for _f in _glob.glob(_os.path.join(OUT, 'P16-*.dc.html')):
    _os.remove(_f)

# ============================================================== shell (RosterApp)
NAV = {
    'trainer': [('clients', 'Clients', 'users'), ('me', 'Me', 'me'), ('apps', 'Apps', 'grid')],
    'admin': [('users', 'Users', 'shield'), ('me', 'Me', 'me'), ('apps', 'Apps', 'grid')],
    'member': [('me', 'Me', 'me'), ('apps', 'Apps', 'grid')],
}
LABEL = {'trainer': 'Clients', 'admin': 'Users', 'member': 'Me'}


def abs_(inner, css):
    return f'<div style="position: absolute; {css}">{inner}</div>'


def rel(inner, *badges, style=''):
    return f'<div style="position: relative; {style}">{inner}{"".join(badges)}</div>'


def hl():
    return '<div class="hl"></div>'


def pbrand(role, badge=None, feed=False):
    """RosterApp header: spotter · <People label> (app switcher) · bell (unread badge) · language. No Mastery badge."""
    bell = ibtn('bell', 'Milestones', 'pri' if feed else 'fill', sm=True)
    if badge and not feed:
        bell = rel(bell, abs_(tag(badge, 'bad'), 'top: -4px; right: -6px'))
    return brandbar(row(bell, ibtn('globe', 'Language', 'fill', sm=True), gap=6), app=LABEL[role])


def pph(role, *content, active=None, h=844, overlay='', mood='art'):
    """People-app phone: its own bottom nav (RosterApp .apex-nav)."""
    act = active if active is not None else {'trainer': 'clients', 'admin': 'users', 'member': 'me'}[role]
    return phone(*content, tabs=(act, NAV[role]), h=h, overlay=overlay, mood='moon' if mood == 'sky' else mood, skin='roster')


def gbrand():
    """Gym app header (App.tsx .app-brand): spotter · Gym · Mastery · bell · language."""
    return brandbar(app='Gym')


def gph(*content, h=844, overlay='', mood='art', tabs='today', top=''):
    return phone(*content, tabs=tabs, h=h, overlay=overlay, mood=mood, top=top)


def page_head(kicker, title, sub=None, action=None):
    return row(col(lbl(kicker), txt(title, 't-h1'), txt(sub, 't-s') if sub else '', gap=4, style='flex: 1; min-width: 0'),
               action or '', gap=10, align='flex-start')


def st_dot(tone):
    return dot(tone)


def err_empty(title='Error', icon='warn', retry=True, sub=None):
    return card(col(tile(icon, 'bad', lg=True), txt(title, 't-h3', 'text-align: center'), txt(sub, 't-s', 'text-align: center; max-width: 290px') if sub else '',
                    btn('Retry', 'sec', sm=True) if retry else '', gap=10, style='align-items: center; padding: 22px 10px'), tone='dash')


def sk(css):
    return f'<div class="sk" style="{css}"></div>'


# ============================================================== TrainerView data
CLIENTS = [
    # name, ch, live, meta, sessions, moved, delta(tone), program, last(tone)
    dict(n='Anna', ch='A', live=True, meta='12 sets completed · 2.1 t', ses='4', mv='14.2 t', d=('+18%', 'c-ok'), prog='Upper/Lower 4× · wk 3', last=('Now', 'c-brass')),
    dict(n='Oleh', ch='O', live=False, meta='Last session 27 Sep · 9.8 t', ses='3', mv='9.8 t', d=('+4%', 'c-ok'), prog='Upper/Lower 4× · wk 2', last=('27 Sep', '')),
    dict(n='Iryna', ch='I', live=False, meta='Last session 24 Sep · 6.1 t', ses='2', mv='6.1 t', d=('-12%', 'c-bad'), prog='None', last=('24 Sep', '')),
    dict(n='Marek', ch='M', live=False, dormant=True, meta='Dormant · 48 days', ses='0', mv='0.0 t', d=('-100%', 'c-bad'), prog='None', last=('Dormant · 48 days', 'c-bad')),
]


def self_card():
    """.trainer-self-card: surface + faint accent wash (not a focal block)."""
    return card(row(avatar('M', 52), col(txt('Mykola', 't-b'), txt('Trainer', 't-m'), gap=2, style='flex: 1'), span(ico('chev', 16), 'c-dim'), gap=13),
                style='padding: 13px 15px')


def client_card(c, clock='24:18'):
    """.tr-client-card. Live = the loud one (104 px band, pill, avatar overlapping, accent ring + bottom line).
    Others = compact rows; dormant only turns the sub-line danger (the app's rule)."""
    if c['live']:
        band = rel('<div style="height: 104px"></div>', abs_(tag(f'Training now · {clock}', 'brass', 'play'), 'left: 12px; top: 12px'))
        body = rel(row(col(txt(c['n'], 't-h2'), txt(c['meta'], 't-s num'), gap=3, style='flex: 1; padding-left: 50px'), span(ico('chev', 18), 'c-brass'), gap=10, style='padding: 13px 14px'),
                   abs_(avatar(c['ch'], 44), 'left: 14px; top: -26px'))
        return card(band, body, tone='hero', pad=False, gap=0)
    sub = txt(c['meta'], 't-m c-bad num' if c.get('dormant') else 't-m num')
    return card(row(avatar(c['ch'], 52), col(txt(c['n'], 't-b'), sub, gap=3, style='flex: 1; min-width: 0'), span(ico('chev', 16), 'c-dim'), gap=13), style='padding: 13px 15px')


def week_table(w_who='240px'):
    """.trainer-week-table — desktop only (>= 960 px): dense, quiet, uppercase 10 px head, divider rows; ok/accent → green, danger → red."""
    cols = f'grid-template-columns: {w_who} 1fr 1fr 1fr 1.4fr 1fr'
    head = f'<div style="display: grid; {cols}; gap: 14px; padding: 0 12px 10px">' + ''.join(span(h, 't-l c-dim') for h in ['Client', 'Sessions', 'moved', 'vs last week', 'Programs', 'Last seen']) + '</div>'
    rows = []
    for c in CLIENTS:
        last_cls = 'c-ok' if c['live'] else ('c-bad' if c.get('dormant') else 'c-mut')
        cells = [row(avatar(c['ch'], 30), span(c['n'], 't-s'), gap=11), span(c['ses'], 't-s num c-mut'), span(c['mv'], 't-s num c-mut'), span(c['d'][0], 't-s num ' + c['d'][1]),
                 span(c['prog'], 't-s c-mut'), span(c['last'][0], 't-s ' + last_cls)]
        rows.append(f'<div class="hl" style="display: grid; {cols}; gap: 14px; align-items: center; padding: 12px">' + ''.join(f'<div style="min-width: 0; white-space: nowrap; overflow: hidden">{x}</div>' for x in cells) + '</div>')
    return col(lbl('This week across your clients'), card(head, *rows, tone='quiet', pad=False, gap=0), gap=12)


def trainer_head(summary=True, n='4 assigned · 1 training now'):
    return page_head('Trainer', 'My clients', n if summary else None, btn('Add client', 'pri', 'plus', sm=True))


def trainer_screen():
    """Phone (< 720 px): the week table and the preview aside are display:none in styles.css — only the cards + footnote."""
    return [pbrand('trainer', '3'), trainer_head(),
            col(self_card(), *[client_card(c) for c in CLIENTS], gap=16),
            txt('Only your clients appear here: created by you or assigned by an admin.', 't-m')]


P('P16-Trainer-Clients.dc.html', 'People · Clients · Trainer (scroll)', pph('trainer', *trainer_screen(), h=920), h=920, row_=0)

# ============================================================== AdminView
ADMIN_HEAD_COLS = ['Person', 'Role', 'Trainer', 'Last session', '30-day volume', 'Status']


ST = {'live': 'brass', 'ok': 'ok', 'muted': 'neutral', 'danger': 'neutral'}
ST_TXT = {'live': 'c-brass', 'ok': 'c-mut', 'muted': 'c-dim', 'danger': 'c-bad'}


def arow(ch, name, user, role, trainer, last, vol, status, st, extra='', me=False):
    """Phone (< 720 px): .admin-row collapses to who · role tag · ⋯ on line 1 and the status on line 2 (trainer / last / volume hidden)."""
    role_t = tag(role, 'neutral' if role == 'Member' else 'brass')
    who = row(avatar(ch, 40 if me else 34), col(txt(name, 't-b' if me else 't-s', '' if not me else ''), txt('@' + user, 't-m'), extra, gap=1, style='flex: 1; min-width: 0'),
              role_t, '' if me else ibtn('more', 'Menu', sm=True), gap=10)
    stl = row(dot(ST[st]), txt(status, 't-m ' + ST_TXT[st]), gap=6, style='padding-left: 45px' if not me else '')
    if me:
        return row(avatar(ch, 40), col(txt(name, 't-b'), txt('@' + user, 't-m'), gap=1, style='flex: 1; min-width: 0'), role_t, row(dot(ST[st]), txt(status, 't-m c-mut'), gap=6), gap=12, style='padding: 12px 13px')
    return col(who, stl, gap=3, style='padding: 11px 0')


def rereq(when='2 h'):
    return row(txt('asked for a new link · 28 Sep', 't-m c-brass'), btn('Send', 'txt', sm=True, style='height: 18px; padding: 0'), gap=6, wrap=True)


PEOPLE_ROWS = [
    ('A', 'Anna', 'anna', 'Member', 'Oleh', 'Training now', '42.8 t', 'Training now · 24:18', 'live', ''),
    ('O', 'Oleh', 'oleh', 'Trainer', '2 clients', '27 Sep', '31.2 t', 'Active', 'ok', ''),
    ('I', 'Iryna', 'iryna', 'Member', 'Oleh', 'Never', '—', 'Invite sent · 5 d left', 'muted', 'rereq'),
    ('M', 'Marek', 'marek', 'Member', '—', '11 Aug', '—', 'Dormant · 48 d', 'muted', ''),
]


def admin_me():
    return card(arow('M', 'Mykola', 'mykola', 'Admin', '', '', '18.9 t', 'Active', 'ok', me=True), pad=False, gap=0)


def admin_table(rows=PEOPLE_ROWS):
    rs = []
    for i, r in enumerate(rows):
        ex = rereq() if r[9] == 'rereq' else ''
        rs.append(('' if i == 0 else hl()) + arow(*r[:9], extra=ex))
    return card(*rs, tone='quiet', pad=False, gap=0)


def admin_toolbar(on=0):
    return col(search('Search people'), seg(['All', 'Members', 'Trainers', 'Pending'], on), gap=8)


def admin_head():
    return page_head('Admin', 'Users', '3 members · 1 trainers · 1 invites pending', btn('New member', 'pri', 'plus', sm=True))


def admin_note():
    return row(span(ico('shield', 16), 'c-dim'), txt('This page exists only for admins. Members never see each other; trainers see only the clients assigned to them.', 't-m', 'flex: 1'), gap=8, align='flex-start')


def admin_screen(extra_banners=()):
    return [pbrand('admin', '3'), admin_head(), *extra_banners, admin_toolbar(), admin_me(), admin_table(), admin_note()]


P('P16-Admin-Users.dc.html', 'People · Users · Admin (scroll)', pph('admin', *admin_screen(), h=1080), h=1080, row_=0)

# ============================================================== ProfileView
def stat_cell(icon, v, l, accent=False):
    """.profile-stat-cell: roomy cell, icon tile top-right, value + label; accent = live sessions."""
    return card(row(col(txt(v, 't-h2 num' + (' c-brass' if accent else '')), txt(l, 't-m'), gap=4, style='flex: 1; min-width: 0'), tile(icon, 'brass' if accent else 'neutral'), align='flex-start'),
                tone='glass' if accent else '', style='padding: 16px 14px; min-height: 96px')


def stat_group(title, icon, *cells):
    return col(row(span(ico(icon, 16), 'c-brass'), lbl(title), gap=8), grid(*cells, cols=2, gap=8), gap=9)


def profile_stats(live=False):
    a = [stat_cell('calendar', '142', 'Sessions'), stat_cell('progress', '14', '30-day sessions'), stat_cell('rotate', '3.5', 'Per week')]
    if live:
        a.append(stat_cell('play', '1', 'Live sessions', True))
    return col(stat_group('Activity', 'calendar', *a),
               stat_group('Training load', 'flame', stat_cell('trophy', '612.4 t', 'Lifetime volume'), stat_cell('chart', '48.2 t', '30-day volume'), stat_cell('flame', '12.9 t', '7-day volume')),
               stat_group('Workout structure', 'dumbbell', stat_cell('list', '3412', 'Sets'), stat_cell('dumbbell', '38', 'exercises'), stat_cell('timer', '151:20', 'Duration'), stat_cell('clock', '610', 'Cardio min')), gap=18)


def top_ex():
    rows = [('Bench press', '38 · 152 Sets completed', '71.4 t', '118 kg e1RM'), ('Squat', '34 · 136 Sets completed', '88.2 t', '163 kg e1RM'),
            ('Deadlift', '22 · 66 Sets completed', '52.9 t', '198 kg e1RM')]
    return col(section('Top exercises'), lst(*[li(n, s, trail=col(txt(v, 't-s num'), txt(e, 't-m'), gap=0, style='align-items: flex-end')) for n, s, v, e in rows], tone='quiet'), gap=4)


def gyms_sec():
    return col(section('Gyms'), card(row(photo(64, 64, 12, ''), col(row(txt('Iron Temple', 't-h3'), tag('Favourite'), gap=8), txt('96 · 402.1 t · 28 Sep', 't-m'),
                                                                  txt('50.45012, 30.52340', 't-m'), gap=3, style='flex: 1'), gap=12), style='padding: 10px'), gap=4)


def recent(live_first=False):
    rs = [('28 Sep', 'Iron Temple', '18 · 6.2 t', '1:05 · Bench press, Incline dumbbell press, Cable fly, Triceps pushdown')]
    if live_first:
        rs = [('28 Sep', 'Iron Temple', '12 · 2.1 t', 'Training now · Bench press, Incline dumbbell press')]
    rs += [('26 Sep', 'Iron Temple', '16 · 7.4 t', '1:12 · Squat, Romanian deadlift, Leg press'), ('24 Sep', 'Iron Temple', '20 · 5.8 t', '1:08 · Pull-up, Barbell row, Face pull'),
           ('22 Sep', 'Iron Temple', '9 · 3.1 t', 'Auto-closed · Bench press, Cable fly')]
    return col(section('Recent sessions'), lst(*[li(f'{d} · {g}', ex, trail=txt(v, 't-s num')) for d, g, v, ex in rs], tone='quiet'), gap=4)


def subtabs(on=0):
    return seg(['Overview', 'Body', 'Settings'], on)


def meta_grid(items):
    return row(*[txt(f'{k}: {v}', 't-m') for k, v in items], gap=12, wrap=True, style='row-gap: 6px')


def me_meta(role):
    return [('Joined', '3 Mar'), ('Status', 'Active'), ('Trainer', 'Oleh' if role == 'member' else '—'), ('First session', '4 Mar'), ('Last session', '28 Sep')]


def detail_fields(first='Mykola', last='Koval', user='mykola', dirty=False):
    return col(field('First name', first), field('Last name', last), field('Username', user, state='focus' if dirty else ''),
               row(sp(), btn('Cancel', 'sec', sm=True, dis=not dirty), btn('Save', 'pri', sm=True, dis=not dirty), gap=8), gap=10)


def me_hero(role='member', editing=False):
    """.profile-hero (mobile: stacked). AvatarUploader compact = the loud identity; detail fields are always rendered for self."""
    up = col(rel(ring(100, 120, 'brass', 3, avatar('M', 104)), abs_(ibtn('camera', 'Change photo', 'pri', sm=True), 'right: 0; bottom: 2px')),
             row(btn('Camera', 'sec', 'camera', sm=True), btn('Library', 'sec', 'image', sm=True), btn('Remove photo', 'dan', 'trash', sm=True), gap=6, wrap=True, justify='center'),
             gap=12, style='align-items: center')
    meta = me_meta(role)
    if role == 'trainer':
        meta.insert(3, ('Clients', '4'))
    ident = col(row(txt('Mykola Koval', 't-h1'), tag('You'), sp(), btn('Done' if editing else 'Edit', 'txt', sm=True), gap=8),
                txt(f'@mykola · {role}', 't-m'), detail_fields(user='mykola_k' if editing else 'mykola', dirty=editing), meta_grid(meta), gap=8)
    return card(up, ident, tone='glass', gap=16)


def me_top():
    return col(lbl('Profile'), txt('Mykola Koval', 't-h1'), gap=4)


def me_overview(role='member'):
    return [me_top(), me_hero(role), subtabs(0), profile_stats(), top_ex(), gyms_sec(), recent()]


P('P16-Member-Me.dc.html', 'People · Me · Member (scroll)', pph('member', pbrand('member'), *me_overview(), h=2500), h=2500, row_=0)
P('P16-Trainer-Me.dc.html', 'People · Me · Trainer', pph('trainer', pbrand('trainer'), *me_overview('trainer')[:3], h=1060), h=1060, row_=0)
P('P16-Admin-Me.dc.html', 'People · Me · Admin', pph('admin', pbrand('admin'), *me_overview('admin')[:3], h=1060), h=1060, row_=0)


# ---- Me · Settings (self)
def who_sees(items=(('O', 'Oleh', 'Trainer · reads your sessions'), ('I', 'Iryna', 'Admin · full access'))):
    if not items:
        return col(section('Who can see your training'), txt('Only you can see your data.', 't-s'), gap=4)
    return col(section('Who can see your training'), lst(*[li(n, s, avatar(c, 34)) for c, n, s in items]), gap=4)


def self_settings(pw_edit=False):
    """Flat .profile-setting-row list (dividers, no cards). While the password is being edited the title, language and rows hide
    and only the Security card shows (styles.css .profile-password-editing)."""
    rows = card(li('Units', None, span(ico('scale', 17), 'c-dim'), seg(['kg', 'lb'], 0)),
                li('Week starts on', None, span(ico('calendar', 17), 'c-dim'), row(txt('Monday', 't-s'), ico('down', 16), gap=4)),
                li('Atlas · Blunt', None, span(ico('spark', 17), 'c-dim'), ico('chev', 16)),
                li('Password', None, span(ico('lock', 17), 'c-dim'), ico('chev', 16)), tone='quiet', pad=False, gap=0)
    sec = card(row(span(ico('shield', 16), 'c-brass'), lbl('Security'), gap=6), txt('Change your password with your current password. Admins and trainers do not see it.', 't-s'),
               col(field('Current password', '••••••••'), field('New password', '••••••', state='focus'), field('Confirm new password', ''), gap=10),
               row(btn('Cancel', 'sec', sm=True, style='flex: 1'), btn('Update password', 'pri', sm=True, dis=True, style='flex: 1'), gap=8), gap=10)
    if pw_edit:
        return [sec]
    return [section('Settings'), row(span(ico('globe', 17), 'c-dim'), txt('English', 't-b', 'flex: 1'), ico('down', 16), gap=12, style='padding: 0 16px'), rows,
            card(li('Sign out', None, span(ico('logout', 17), 'c-bad'), tone='bad'), tone='quiet', pad=False)]


def audit():
    return col(section('Who opened this profile'), lst(li('Oleh', 'Trainer · profile', trail=txt('27 Sep', 't-m')), li('Iryna', 'Admin · profile', trail=txt('21 Sep', 't-m')), tone='quiet'), gap=4)


def admin_self_section():
    return col(section('Assigned trainer'), lst(li('Assign trainer', 'No trainer', tile('users'), chev=True)), gap=4)


P('P16-Member-Me-Settings.dc.html', 'People · Me · Settings · Member (scroll)', pph('member', pbrand('member'), me_top(), subtabs(2), who_sees(), *self_settings(), audit(), h=960), h=960, row_=0)
P('P16-Admin-Me-Settings.dc.html', 'People · Me · Settings · Admin (scroll)', pph('admin', pbrand('admin'), me_top(), subtabs(2), who_sees(()), *self_settings(), admin_self_section(), audit(), h=1000), h=1000, row_=0)
P('P16-Me-Edit.dc.html', 'People · Me · Edit tapped, username changed (Save enabled)', pph('member', pbrand('member'), me_top(), me_hero(editing=True), h=1000), h=1000, row_=2)
P('P16-Me-Password.dc.html', 'People · Me · Settings · change password', pph('member', pbrand('member'), me_top(), subtabs(2), who_sees(), *self_settings(pw_edit=True), audit(), h=960), h=960, row_=2)


# ---- Me · Body (BodyMetricsSection)
def body_metrics(read_only=False):
    hero = card(lbl('Current weight'), txt('82.4 kg', 't-big num'), txt('28 Sep, 07:30', 't-m'), row(tag('−1.6 kg', 'ok'), txt('·', 't-m'), txt('2.4 kg to goal', 't-s'), gap=6),
                '' if read_only else btn('Add weight', 'pri', 'plus', sm=True, style='align-self: flex-start'), tone='glass', gap=6)
    two = grid(card(txt('182 <span class="t-m">cm</span>', 't-h2 num'), txt('Height', 't-m'), gap=2), card(row(txt('24.9', 't-h2 num'), tag('normal', 'ok'), gap=8), txt('BMI · approx.', 't-m'), gap=2), cols=2, gap=8)
    about = grid(col(lbl('Sex'), seg(['Male', 'Female'], 0), gap=6), col(row(lbl('Birthday'), txt('34 yrs', 't-m'), gap=6), field(value='1992-05-14'), gap=6), cols=2, gap=10)
    trend = card(row(lbl('Weight trend'), sp(), txt('last 8 entries', 't-m')), spark([84, 83.8, 83.5, 83.6, 83.1, 82.9, 82.6, 82.4], 320, 70, 'brass'), row(txt('28 Sep, 07:30', 't-m'), sp(), txt('goal 80.0 kg', 't-m')), gap=8)
    ed = '' if read_only else ibtn('edit', 'Edit weight', sm=True)
    ents = col(section('Recent entries'), lst(li('28 Sep, 07:30', trail=row(txt('82.4 kg', 't-s num'), tag('−0.2 kg', 'ok'), ed, gap=8)),
                                           li('21 Sep, 07:40', trail=row(txt('82.6 kg', 't-s num'), tag('−0.3 kg', 'ok'), ed, gap=8)),
                                           li('14 Sep, 07:35', trail=row(txt('82.9 kg', 't-s num'), txt('—', 't-m'), ed, gap=8))), gap=4)
    comp = col(section('Composition'), grid(*[card(txt(f'{v} <span class="t-m">{u}</span>', 't-h3 num'), txt(l, 't-m'), gap=2, style='padding: 10px 12px') for l, v, u in
                                              [('Body fat', '16', '%'), ('Muscle', '38.2', 'kg'), ('Goal', '80', 'kg'), ('Waist', '84', 'cm'), ('Chest', '104', 'cm'), ('Hip', '98', 'cm')]], cols=3, gap=8), gap=4)
    return [section('Body metrics'), hero, two, about, trend, ents, comp]


P('P16-Me-Body.dc.html', 'People · Me · Body (scroll)', pph('member', pbrand('member'), me_top(), subtabs(1), *body_metrics(), h=1520), h=1520, row_=0)


# ---- a person's profile, opened from Clients / Users (not embedded: back button)
def person_top(name='Anna'):
    return row(ibtn('back', 'Back', 'fill', sm=True), col(lbl('Profile'), txt(name, 't-h1'), gap=2), gap=10)


def person_hero(relation='trainer', live=True, name='Anna', ch='A', trainer='Oleh'):
    pill = tag('Training now', 'brass', 'play') if (relation == 'trainer' and live) else ''
    name_line = row(txt(name, 't-h1'), tag('Member'), pill, gap=8, wrap=True)
    meta = meta_grid([('Joined', '3 Mar'), ('Status', 'Active'), ('Trainer', trainer), ('First session', '5 Mar'), ('Last session', '28 Sep')])
    det = detail_fields(name, 'Shevchenko', name.lower()) if relation == 'admin' else txt(f'@{name.lower()}', 't-s')
    return card(col(avatar(ch, 82), style='align-items: center'), name_line, det, meta, tone='glass', gap=10)


def trainer_live_panel():
    """TrainerLivePanel — the loud block of a trainer's view of a live client (tr-live-card: accent ring)."""
    g = grid(*[txt(x, 't-l c-dim') for x in ('#', 'Sets', 'Lifetime volume')], *[txt(x, 't-num num') for x in ('1', '12', '2.1 t')], cols=3, gap=8)
    return col(lbl('Live right now', 'brass'), card(row(txt('Bench press', 't-h2'), sp(), txt('12 · 2.1 t', 't-m num')), g, txt('Updating live · you cannot edit these', 't-m'), tone='hero', gap=12), gap=8)


P('P16-Trainer-Client-Profile.dc.html', 'People · a client’s profile · Trainer (scroll)', pph('trainer', pbrand('trainer'), person_top(), person_hero('trainer'), subtabs(0),
                                                                                              trainer_live_panel(), profile_stats(live=True), top_ex(), gyms_sec(), recent(True), h=2080), h=2080, row_=0)
P('P16-Trainer-Client-Settings.dc.html', 'People · a client’s profile · Settings tab · Trainer (empty for a trainer)', pph('trainer', pbrand('trainer'), person_top(), person_hero('trainer'), subtabs(2), h=900), h=900, row_=1)
P('P16-Trainer-Client-Body.dc.html', 'People · a client’s profile · Body · Trainer (read-only)', pph('trainer', pbrand('trainer'), person_top(), subtabs(1), *body_metrics(read_only=True), h=1400), h=1400, row_=1)


def empty_profile():
    """Admin opens an invited person who never trained: status Pending, zero stats, every list empty; a save error card."""
    hero = card(col(avatar('I', 82), style='align-items: center'), row(txt('Iryna', 't-h1'), tag('Member'), gap=8),
                detail_fields('Iryna', 'Bondar', 'iryna'), meta_grid([('Joined', '28 Sep'), ('Status', 'Pending'), ('Trainer', 'Oleh')]), tone='glass', gap=10)
    err = card(row(span(ico('warn', 18), 'c-bad'), txt('That username is already taken.', 't-s', 'flex: 1'), gap=10), tone='bad', style='padding: 12px 14px')
    zero = col(stat_group('Activity', 'calendar', stat_cell('calendar', '0', 'Sessions'), stat_cell('progress', '0', '30-day sessions'), stat_cell('rotate', '0', 'Per week')), gap=0)
    return [person_top('Iryna'), hero, subtabs(0), err, zero,
            col(section('Top exercises'), txt('No training data yet.', 't-s'), gap=4), col(section('Gyms'), txt('No gyms saved yet.', 't-s'), gap=4),
            col(section('Recent sessions'), txt('No training data yet.', 't-s'), gap=4)]


def admin_person_settings(trainer_person=False):
    name = 'Oleh' if trainer_person else 'Anna'
    acc = who_sees((('O', 'Oleh', 'Trainer · reads your sessions'), ('M', 'Mykola', 'Admin · full access'))) if not trainer_person else who_sees((('M', 'Mykola', 'Admin · full access'),))
    rows = [li('Assign trainer', 'No trainer' if trainer_person else 'Oleh', tile('users'), chev=True)]
    if trainer_person:
        rows.append(li('Assign clients', '2 clients', tile('plus'), chev=True))
    return [acc, col(section('Assigned trainer'), lst(*rows), gap=4),
            lst(li('Trainer privileges', 'Grants access to assigned clients and program authoring.', tile('dumbbell'), toggle(trainer_person)))]


P('P16-Admin-Person-Profile.dc.html', 'People · a person’s profile · Admin (scroll)', pph('admin', pbrand('admin'), person_top(), person_hero('admin', live=True), subtabs(0),
                                                                                         profile_stats(live=True), top_ex(), gyms_sec(), recent(True), h=1980), h=1980, row_=0)
P('P16-Admin-Person-Settings.dc.html', 'People · a member’s profile · Settings · Admin', pph('admin', pbrand('admin'), person_top(), subtabs(2), *admin_person_settings(), h=900), h=900, row_=0)
P('P16-Admin-Trainer-Settings.dc.html', 'People · a trainer’s profile · Settings · Admin', pph('admin', pbrand('admin'), person_top('Oleh'), subtabs(2), *admin_person_settings(True), h=900), h=900, row_=0)

P('P16-Profile-Empty.dc.html', 'People · an invited person (no data) + save error · Admin (scroll)', pph('admin', pbrand('admin'), *empty_profile(), h=1320), h=1320, row_=1)


def body_empty():
    return [section('Body metrics'), card(txt('No weight entries yet', 't-h3'), txt('Add your first entry — then the trend and weigh-in reminders appear.', 't-s'), btn('Add weight', 'sec', sm=True, style='align-self: flex-start'), tone='quiet', gap=6),
            grid(card(txt('— <span class="t-m">cm</span>', 't-h2 num'), txt('Height', 't-m'), gap=2), card(txt('—', 't-h2 num'), txt('BMI · approx.', 't-m'), gap=2), cols=2, gap=8)]


P('P16-Me-Body-Empty.dc.html', 'People · Me · Body · no entries yet', pph('member', pbrand('member'), me_top(), subtabs(1), *body_empty()), row_=1)

# ============================================================== Milestones feed tab (bell → NotificationsView embedded)
def notif_row(icon, tone, title, sub, time, unread=False, link=True):
    return li(title, sub, row(dot('brass') if unread else '<span style="width: 8px"></span>', tile(icon, tone), gap=8), trail=row(txt(time, 't-m'), ico('chev', 16) if link else '', gap=6))


P('P16-Feed.dc.html', 'People · Milestones (bell) · Trainer', pph('trainer', pbrand('trainer', feed=True),
    row(txt('Milestones', 't-h1'), sp(), btn('Mark all read', 'txt', sm=True)),
    lbl('Today'), lst(notif_row('dumbbell', 'brass', 'Bench press PR', '100 kg · up 2.5 kg', '2h', True), notif_row('flame', 'bad', '6-day streak', 'keep it going', '3h', True)),
    lbl('This week'), lst(notif_row('check', 'ok', 'Weekly volume goal met', 'Every muscle in its productive range', 'Saturday', link=False)),
    active='feed'), row_=0)
P('P16-Feed-Empty.dc.html', 'People · Milestones · empty', pph('trainer', pbrand('trainer', feed=True), txt('Milestones', 't-h1'),
    empty('No notifications yet', 'Milestones, PRs and streaks will show up here as you train.', 'bell'), active='feed'), row_=1)

# ============================================================== states (row 1)
def row_skel(n=4, meta=False):
    return skel_rows(n)


P('P16-Trainer-Loading.dc.html', 'Clients · loading · Trainer', pph('trainer', pbrand('trainer'), page_head('Trainer', 'My clients', None, btn('Add client', 'pri', 'plus', sm=True)), row_skel(4)), row_=1)
P('P16-Trainer-Failed.dc.html', 'Clients · failed · Trainer', pph('trainer', pbrand('trainer'), page_head('Trainer', 'My clients', None, btn('Add client', 'pri', 'plus', sm=True)), err_empty()), row_=1)
P('P16-Trainer-Empty.dc.html', 'Clients · no clients · Trainer', pph('trainer', pbrand('trainer'), page_head('Trainer', 'My clients', '0 assigned · 0 training now', btn('Add client', 'pri', 'plus', sm=True)),
    empty('No clients assigned yet', 'Create a client and send them an invite. Their history appears here after onboarding.', 'dumbbell', 'Add client')), row_=1)

admin_skel = skel_rows(3)
P('P16-Admin-Loading.dc.html', 'Users · loading · Admin', pph('admin', pbrand('admin'), page_head('Admin', 'Users', '0 members · 0 trainers · 0 invites pending', btn('New member', 'pri', 'plus', sm=True)), admin_toolbar(), admin_skel), row_=1)
P('P16-Admin-Failed.dc.html', 'Users · failed · Admin', pph('admin', pbrand('admin'), page_head('Admin', 'Users', '0 members · 0 trainers · 0 invites pending', btn('New member', 'pri', 'plus', sm=True)), admin_toolbar(), err_empty()), row_=1)
P('P16-Admin-Empty.dc.html', 'Users · no one but you · Admin', pph('admin', pbrand('admin'), page_head('Admin', 'Users', '0 members · 0 trainers · 0 invites pending', btn('New member', 'pri', 'plus', sm=True)), admin_toolbar(),
    empty('No one here but you', 'Create a member and hand them a link. They set their own password — you never see or type it.', 'users', 'New member'), admin_me()), row_=1)
P('P16-Admin-Offline.dc.html', 'Users · offline + action error · Admin (scroll)', pph('admin', *admin_screen([
    banner('Offline — admin actions need the server. Nothing is queued here.', None, 'bad', 'cloudoff'),
    banner('That username is already taken.', None, 'bad', 'warn')]), h=1300), h=1300, row_=1)
P('P16-Admin-Filter-Pending.dc.html', 'Users · filter Pending + search · Admin', pph('admin', pbrand('admin'), admin_head(), col(search('Search people', 'ir'), seg(['All', 'Members', 'Trainers', 'Pending'], 3), gap=8),
    admin_me(), admin_table([PEOPLE_ROWS[2]]), admin_note()), row_=1)

profile_skel = card(col(sk('width: 96px; height: 96px'), style='align-items: center'), row(sk('flex: 1; height: 40px'), sk('flex: 1; height: 40px'), gap=8),
                    sk('height: 14px; width: 60%'), sk('height: 12px; width: 40%'), gap=12)
board('P16-Profile-States.dc.html', 'Profile · loading, locked, not found, failed', 1600, 640, spec('Profile (ProfileView) · states' + span('', ' sk-roster'),
    cap('Loading · ProfileSkeleton', col(lbl('Profile'), txt('Profile', 't-h1'), profile_skel, row(sk('flex: 1; height: 80px'), sk('flex: 1; height: 80px'), gap=8), gap=10), w=340),
    cap('403 · Profile locked', col(lbl('Profile'), txt('Profile locked', 't-h1'), err_empty('Profile locked', 'lock', False, 'Direct links work only for the profile owner, an admin, or the assigned trainer.'), gap=10), w=340),
    cap('404 · Profile not found', col(lbl('Profile'), txt('Profile not found', 't-h1'), err_empty('Profile not found', 'warn', False, 'GET /api/profile/users/u_8f3a'), gap=10), w=340),
    cap('Failed', col(lbl('Profile'), txt('Profile', 't-h1'), err_empty('Error', 'warn', False, 'GET /api/profile/users/u_8f3a'), gap=10), w=340),
    w=1600, h=640), row_=1)

board('P16-Client-States.dc.html', 'Clients · card, table and status states', 1600, 700, spec('Trainer cards (clientMeta) · week-table cells · admin status column' + span('', ' sk-roster'),
    cap('Card · live (loud)', client_card(CLIENTS[0]), w=358),
    cap('Card · trained', client_card(CLIENTS[1]), w=358),
    cap('Card · dormant (sub-line danger)', client_card(CLIENTS[3]), w=358),
    cap('Card · never trained', client_card(dict(n='Iryna', ch='I', live=False, meta='Never')), w=358),
    cap('Week table · delta / program / last seen', col(row(span('+18%', 't-s c-ok'), span('0%', 't-s c-mut'), span('-12%', 't-s c-bad'), span('—', 't-s c-mut'), gap=16),
                                                        row(span('Upper/Lower 4× · wk 3', 't-s c-mut'), span('Full body 3×', 't-s c-mut'), span('None', 't-s c-mut'), gap=16),
                                                        row(span('Now', 't-s c-ok'), span('27 Sep', 't-s c-mut'), span('Dormant · 48 days', 't-s c-bad'), span('Never', 't-s c-mut'), gap=16), gap=10), w=420),
    cap('Admin status (statusOf) · priority order', col(*[row(dot(ST[k]), span(t, 't-s ' + ST_TXT[k]), gap=6) for t, k in [('Suspended', 'muted'), ('Training now · 24:18', 'live'), ('Invite sent · 5 d left', 'muted'),
                                                                                                                 ('Invite expired', 'muted'), ('Invite revoked', 'muted'), ('Dormant · 48 d', 'muted'), ('Active', 'ok')]], gap=8), w=300),
    cap('Role tags', row(tag('Member', 'neutral'), tag('Trainer'), tag('Admin'), gap=8), w=260),
    w=1600, h=700), row_=1)

# ---- night mode (People app follows the root data-sleep flip)
P('P16-Trainer-Clients-Night.dc.html', 'People · Clients · Trainer · night', pph('trainer', *trainer_screen()[:3], mood='sky'), row_=1)
P('P16-Admin-Users-Night.dc.html', 'People · Users · Admin · night', pph('admin', *admin_screen()[:5], mood='sky'), row_=1)
P('P16-Member-Me-Night.dc.html', 'People · Me · Member · night', pph('member', pbrand('member'), *me_overview()[:3], h=1060, mood='sky'), h=1060, row_=1)

# ============================================================== sheets (row 2)
def two_btns(a='Cancel', b='Save', dis=False, bk='pri'):
    return row(btn(a, 'sec', style='flex: 1'), btn(b, bk, dis=dis, style='flex: 1'), gap=10)


def add_client_sheet(error=False):
    return sheet('Add client', field(ph='First name', value='Anna'), field(ph='Last name', value='Shevchenko'), field(ph='Username', value='anna', state='err' if error else 'focus'),
                 row(span(ico('warn', 16), 'c-bad'), txt('That username is already taken.', 't-s c-bad'), gap=6) if error else '',
                 h=440 if not error else 470, close=False, footer=two_btns())


P('P16-Trainer-AddClient.dc.html', 'Add client sheet · Trainer', pph('trainer', *trainer_screen()[:3], overlay=add_client_sheet()), row_=2)
P('P16-Trainer-AddClient-Error.dc.html', 'Add client sheet · error · Trainer', pph('trainer', *trainer_screen()[:3], overlay=add_client_sheet(True)), row_=2)


def link_line(qr=False, copied=False):
    return col(lbl('Invite link'), card(row(span(ico('external', 16), 'c-dim'), txt('spotter.app/#/join/9f3a-c21e-77bd', 't-s num', 'flex: 1; min-width: 0; overflow: hidden; white-space: nowrap'), gap=8), style='padding: 12px 14px'),
               row(btn('Copied' if copied else 'Copy', 'pri', 'check' if copied else 'note', sm=True, style='flex: 1'), btn('QR', 'sec', 'qr', sm=True, style='flex: 1') if qr is not None else '', gap=8), gap=8)


def cells(items):
    return grid(*[card(lbl(l), txt(v, 't-s'), gap=4, style='padding: 10px 12px') for l, v in items], cols=len(items), gap=8)


def created_head(name):
    return col(row(span(ico('check', 18), 'c-ok'), txt('Account created', 't-h3 c-ok'), gap=6), txt(f'{name} is ready to claim', 't-h2'), gap=6)


P('P16-Trainer-Invite.dc.html', 'Invite link sheet · Trainer', pph('trainer', *trainer_screen()[:3], overlay=sheet(None, created_head('Anna'),
    txt('Send this link to your client. They set their own password during onboarding.', 't-s'), link_line(qr=None),
    cells([('Expires', 'Expires 5 Oct · 7 days'), ('Uses', 'Single use')]), h=520, footer=btn('Done', 'pri', full=True))), row_=2)


def role_card(icon, name, hint, on=False):
    return card(row(tile(icon, 'brass' if on else 'neutral'), col(txt(name, 't-h3'), txt(hint, 't-m'), gap=1, style='flex: 1'), span(ico('check', 18), 'c-brass') if on else '', gap=12),
                tone='glass' if on else '', style='padding: 10px 12px')


def pick_row(name, sub, ch=None, on=False, trail=''):
    return card(row(avatar(ch, 34) if ch else '', col(txt(name, 't-h3'), txt(sub, 't-m'), gap=1, style='flex: 1'), trail, gap=12), tone='glass' if on else '', style='padding: 10px 12px')


P('P16-Admin-NewMember.dc.html', 'New member sheet · Admin', pph('admin', *admin_screen()[:4], h=1000, overlay=sheet('New member',
    field(ph='First name', value='Iryna'), field(ph='Last name', value='Bondar'), field(ph='Username', value='iryna', state='focus'),
    lbl('Role'), role_card('me', 'Member', 'Trains. Sees only their own data.', True), role_card('users', 'Trainer', 'Trains, and reads the clients you assign.'),
    role_card('shield', 'Admin', 'Everything, including your own account.'),
    lbl('Assigned trainer'), pick_row('No trainer', 'Only you can see this member’s data'), pick_row('Oleh', '2 clients', 'O', True), pick_row('Mykola', '0 clients', 'M'),
    h=820, close=False, footer=two_btns())), h=1000, row_=2)


def link_sheet(qr=False, copied=False):
    return sheet(None, created_head('Iryna'), txt('Send this link. When they open it they set their own password, add a photo and pick a gym — and the data binds to this account.', 't-s'),
                 link_line(True, copied), card(col(ico('qr', 150, w=1.2), style='align-items: center; padding: 6px'), style='align-self: center; width: 190px') if qr else '',
                 cells([('Expires', 'Expires 5 Oct · 7 days'), ('Uses', 'Single use'), ('Assigned trainer', 'Oleh')]),
                 row(span(ico('info', 16), 'c-dim'), txt('The link carries no password. Until it’s claimed the account holds only the name and trainer you set here.', 't-m', 'flex: 1'), gap=8, align='flex-start'),
                 h=800 if qr else 620, footer=two_btns('Create another', 'Done'))


P('P16-Admin-Link.dc.html', 'Invite link sheet · Admin', pph('admin', *admin_screen()[:4], overlay=link_sheet()), row_=2)
P('P16-Admin-Link-QR.dc.html', 'Invite link sheet · QR shown, copied · Admin', pph('admin', *admin_screen()[:4], overlay=link_sheet(True, True)), row_=2)


def menu_sheet(name='Anna', invited=False, suspended=False):
    items = [li('Open profile', None, tile('external')), li('Change trainer', None, tile('rotate')), li('Edit user details', None, tile('edit'))]
    if not invited:
        items.append(li('Send password reset', None, tile('rotate')))
    else:
        items += [li('New link', None, tile('rotate')), li('Revoke', None, tile('x'))]
    items.append(li('Export their data', None, tile('note')))
    danger = [li('Restore access' if suspended else 'Suspend access', None, tile('cloudoff', 'bad'), tone='bad'), li('Delete member', None, tile('trash', 'bad'), tone='bad')]
    return sheet(None, lbl(name), lst(*items), lst(*danger), h=560 if not invited else 610, close=False)


P('P16-Admin-Menu.dc.html', 'Person menu · active member · Admin', pph('admin', *admin_screen()[:5], overlay=menu_sheet()), row_=2)
P('P16-Admin-Menu-Invited.dc.html', 'Person menu · invited · Admin', pph('admin', *admin_screen()[:5], overlay=menu_sheet('Iryna', invited=True)), row_=2)
P('P16-Admin-Menu-Suspended.dc.html', 'Person menu · suspended · Admin', pph('admin', *admin_screen()[:5], overlay=menu_sheet('Marek', suspended=True)), row_=2)


def assign_trainer_sheet(name='Anna'):
    return sheet(f'Who trains {name}?', txt('A trainer gets read access to sessions, progress and programs — nothing else, and no ability to change them.', 't-s'),
                 pick_row('Oleh', '2 clients', 'O', True), pick_row('Mykola', '0 clients', 'M'), pick_row('No trainer', 'Only you can see this member’s data'),
                 h=520, close=False, footer=two_btns('Cancel', 'Assign'))


P('P16-Admin-AssignTrainer.dc.html', 'Change trainer sheet · Admin (from menu and from profile)', pph('admin', *admin_screen()[:5], overlay=assign_trainer_sheet()), row_=2)
P('P16-Admin-Edit.dc.html', 'Edit user details sheet · Admin', pph('admin', *admin_screen()[:5], overlay=sheet('Edit user details', field(ph='First name', value='Anna'), field(ph='Last name', value='Shevchenko'),
    field(ph='Username', value='anna', state='focus'), h=430, close=False, footer=two_btns())), row_=2)
P('P16-Admin-AssignClients.dc.html', 'Assign clients sheet · Admin (trainer’s profile)', pph('admin', pbrand('admin'), person_top('Oleh'), subtabs(2), *admin_person_settings(True), overlay=sheet('Clients for Oleh',
    txt('Pick the people this trainer should see. A trainer can coach members, admins, or another trainer, but never themselves.', 't-s'),
    pick_row('Anna', 'Oleh', 'A', True, toggle(True)), pick_row('Iryna', 'Oleh', 'I', True, toggle(True)), pick_row('Marek', 'No trainer', 'M', False, toggle(False)), pick_row('Mykola', 'No trainer', 'M', False, toggle(False)),
    h=640, close=False, footer=two_btns('Cancel', 'Assign'))), row_=2)
P('P16-Admin-Delete.dc.html', 'Delete member · typed-name confirm · Admin', pph('admin', *admin_screen()[:5], overlay=dialog('Delete Marek?',
    '0 sessions and 0.0 t of logged volume are deleted with the account. This cannot be undone.' + f'<div style="margin-top: 12px">{field(ph="Type Marek", value="Mar", state="focus")}</div>',
    'Delete', 'Keep', 'dan', top=250)), row_=3)
P('P16-Me-SignOut.dc.html', 'Sign out · confirm (Me)', pph('member', pbrand('member'), me_top(), subtabs(2), *self_settings()[:4],
    overlay=dialog('Sign out?', 'Your log stays on the server and comes back on the next sign-in.', 'Sign out', 'Cancel', 'dan', top=300)), row_=3)
P('P16-Me-SignOut-Queued.dc.html', 'Sign out · changes still queued (Me)', pph('member', pbrand('member'), me_top(), subtabs(2), *self_settings()[:4],
    overlay=dialog('Sign out?', '3 changes are still queued. Signing out discards the local queue — sync first if you want to keep them.', 'Sign out', 'Cancel', 'dan', top=300)), row_=3)

# ============================================================== Gym app · Today by role (TodayView)
def atlas_pic(s=54, temper=3):
    """AtlasFace: the real portrait for the temper (public/atlas/atlas-N.webp)."""
    return img(f'atlas/atlas-{temper}.webp', s, s, r=s // 2, alt='Atlas')


def story(name, ch=None, state='quiet', live=False, alert=False, count=None, s=54):
    """.tcs-item: live = green gradient ring + live dot (overrides recency); fresh = accent ring (< 2 d); quiet = thin grey ring;
    dormant = danger ring + red warning badge. Atlas: portrait, ring in the temper colour when unread, count badge."""
    face = atlas_pic(s) if ch is None else avatar(ch, s)
    tone = {'live': 'ok', 'fresh': 'brass', 'dormant': 'bad', 'atlas': 'atlas', 'quiet': 'neutral'}[state]
    box = ring(100, s + 8, tone, 2.5 if state in ('live', 'fresh', 'atlas') else 2, face)
    b = []
    if count:
        b.append(abs_(tag(count, 'bad'), 'top: -2px; right: -4px'))
    if alert:
        b.append(abs_(tag('', 'bad', 'warn'), 'top: -2px; right: -6px'))
    if live:
        b.append(abs_(row(dot('ok')), 'bottom: 3px; right: 3px'))
    nm = 't-m' if state in ('quiet', 'dormant') else 't-s'
    return col(rel(box, *b), txt(name, nm, 'white-space: nowrap'), gap=6, style='align-items: center; width: 64px')


def strip(lead=True):
    """TrainerClientsStrip (stories): Atlas lead + split, then live first, most recently trained, never last."""
    cl = [story('Anna', 'A', 'live', live=True), story('Oleh', 'O', 'fresh'), story('Iryna', 'I', 'quiet'), story('Marek', 'M', 'dormant', alert=True)]
    return row(story('Atlas', None, 'atlas', count='2') if lead else '', '<div class="vl" style="height: 44px; margin: 9px 2px 0"></div>' if lead else '', *cl, gap=6, align='flex-start')


def atlas_solo():
    """AtlasSoloStrip: the full-width Atlas row when there are no clients (portrait, name · temper, last note, unread count)."""
    return card(row(ring(100, 62, 'atlas', 2.5, atlas_pic(54)), col(row(txt('Atlas', 't-h3'), txt('· Blunt', 't-s'), gap=4), txt('Pull is 30% under push for 3 weeks — add a row set on chest days.', 't-s'), gap=2, style='flex: 1; min-width: 0'),
                    tag('2', 'bad'), gap=12), style='padding: 12px 14px')


P('P16-Today-Trainer.dc.html', 'Gym · Today · Trainer (clients strip only)', gph(gbrand(), strip()), row_=3)
P('P16-Today-Trainer-NoClients.dc.html', 'Gym · Today · Trainer, no clients (Atlas solo)', gph(gbrand(), atlas_solo()), row_=3)
P('P16-Today-Trainer-Night.dc.html', 'Gym · Today · Trainer · night', gph(gbrand(), sleephero(), strip(), mood='sky'), row_=1)


def prog_card():
    return card(row(span(ico('list', 20), 'c-brass', 'padding-top: 2px'), col(lbl('Today · Chest 2', 'brass'), txt('Upper/Lower 4×', 't-h2'), txt('5 of 16 sessions', 't-s'), gap=3, style='flex: 1'),
                    col(txt('31%', 't-h3 c-brass num'), bar(31), gap=6, style='width: 90px'), gap=10, align='flex-start'), tone='glass')


P('P16-Today-Admin.dc.html', 'Gym · Today · Admin (Atlas & clients block = clients strip)', gph(gbrand(), row(lbl('Monday, September 28'), sp(), row(dot('ok'), txt('Synced', 't-m'), gap=6)), strip(), prog_card()), row_=3)


# ---- Client page (overlay from the strip)
def tday(label, node_tone, rows_, last=False):
    nd = col(tile('check', node_tone, s=14), '' if last else '<div class="vl" style="flex: 1; width: 0"></div>', gap=4, style='width: 36px; align-items: center')
    return row(nd, col(lbl(label), lst(*rows_), gap=8, style='flex: 1; min-width: 0; padding-bottom: 6px'), gap=10, align='stretch')


def hrow(time, icon, tone, title, val=None, sub=None):
    t = span(title, 't-b') + (span(f' · {val}', 'c-mut') if val else '')
    return li(t, sub, lead=row(txt(time, 't-m num', 'width: 36px'), tile(icon, tone), gap=8), trail=span(ico('chev', 16), 'c-dim'), style='padding: 8px 12px')


def client_page(live=True, same=True, data=True, hist=True):
    """ClientPage. Loud: the live status (ok) and the 'last time on this day' hero (the page's highlight, accent). Stats = three cells; rest = lists."""
    head = row(ibtn('back', 'Back', 'fill', sm=True), avatar('A', 52), col(txt('Anna', 't-h2'), txt('Last session 26 Sep', 't-s'), gap=3), gap=12) if data else row(ibtn('back', 'Back', 'fill', sm=True))
    out = [head]
    if live:
        out.append(card(row(dot('ok'), col(txt('Training in progress', 't-h3 c-ok'), txt('Details will appear once the session ends.', 't-s'), gap=2, style='flex: 1'), gap=12), tone='ok', style='padding: 13px 15px'))
    if same:
        out.append(card(row(span(ico('history', 16), 'c-brass'), lbl('Last time on this day · Monday', 'brass'), gap=6),
                        row(col(txt('Chest 2', 't-d1'), txt('21 Sep · 6 · 18 sets', 't-s num'), gap=6, style='flex: 1'), span(ico('chev', 22), 'c-brass'), gap=10), tone='hero', gap=12, style='padding: 18px 16px'))
    if data:
        out.append(grid(*[card(txt(v, 't-num num'), txt(l, 't-m'), gap=3, style='padding: 14px 12px') for v, l in [('14', 'Sessions'), ('9.8 t', 'Last 7 days'), ('214', 'Sets')]], cols=3, gap=10))
        out.append(card(row(span(ico('me', 18), 'c-dim'), txt('Full profile', 't-h3', 'flex: 1'), span(ico('external', 16), 'c-dim'), gap=10), style='padding: 13px 14px'))
    out.append(section('Training history'))
    if hist:
        out += [tday('Sat · Sep 26', 'ok', [hrow('07:10', 'moon', 'sleep', 'Sleep', '7:12'), hrow('18:30', 'dumbbell', 'brass', 'Legs 1', sub='1:12 · 16 Sets completed · 7 420 kg')]),
                tday('Thu · Sep 24', 'ok', [hrow('19:05', 'dumbbell', 'brass', 'Pull 1', sub='1:08 · 20 Sets completed · 5 810 kg')]),
                tday('Mon · Sep 21', 'ok', [hrow('18:45', 'dumbbell', 'brass', 'Chest 2', sub='1:05 · 18 Sets completed · 6 240 kg')], last=True)]
    else:
        out.append(txt('No sessions logged yet', 't-s'))
    if data and hist:
        out += [section('Top lifts'), lst(*[li(n, d, trail=txt(v, 't-h3 num')) for n, d, v in [('Bench press', '21 Sep', '62 kg'), ('Squat', '26 Sep', '84 kg'),
                                                                                                 ('Deadlift', '26 Sep', '101 kg'), ('Barbell row', '24 Sep', '55 kg'),
                                                                                                 ('Overhead press', '21 Sep', '38 kg'), ('Lat pulldown', '24 Sep', '4.2 t')]])]
    return out


P('P16-ClientPage.dc.html', 'Client page · live client · Trainer (scroll)', gph(gbrand(), *client_page(), tabs=None, h=1640), h=1640, row_=3)
board('P16-ClientPage-History-Fallback.dc.html', 'Client page · history fallback (no full history from the server)', 900, 460, spec('ClientPage · Training history fallback (sessions grouped by day)',
    cap('hist-tl · summarised sessions', col(tday('28 Sep', 'ok', [li('Chest 2', 'Iron Temple · 6 · 18 sets · 6.2 t<br>Bench press · Incline dumbbell press · Cable fly · Triceps pushdown', trail=span(ico('external', 16), 'c-dim'))]),
                                          tday('26 Sep', 'ok', [li('Legs', 'Iron Temple · 5 · 16 sets · 7.4 t<br>Squat · Romanian deadlift · Leg press', trail=span(ico('external', 16), 'c-dim'))], last=True), gap=0), w=420),
    w=900, h=460), row_=3)
P('P16-ClientPage-Empty.dc.html', 'Client page · no sessions yet · Trainer', gph(gbrand(), *client_page(live=False, same=False, hist=False), tabs=None), row_=3)
P('P16-ClientPage-Loading.dc.html', 'Client page · before data (cache miss)', gph(gbrand(), *client_page(live=False, same=False, data=False, hist=False), tabs=None), row_=3)


# ---- Trainee session (read-only recap)
def srow(idx, reps, kg, kind, rest=None):
    r = row(txt(idx, 't-s num', 'width: 26px'), txt(reps, 't-b num', 'width: 48px'), txt(kg, 't-b num', 'width: 56px'), txt(kind, 't-m'), gap=8)
    return (f'<div class="t-m" style="padding: 4px 16px 0 42px">{rest}</div>' if rest else '') + f'<div style="padding: 6px 16px">{r}</div>'


def ex_card(name, rows_, sides=None):
    head = row(txt(name, 't-h3'), tag(sides, 'neutral') if sides else '', gap=8, style='padding: 12px 16px 4px')
    hdr = row(txt('#', 't-l', 'width: 26px'), txt('Reps', 't-l', 'width: 48px'), txt('Kg', 't-l', 'width: 56px'), gap=8, style='padding: 4px 16px')
    return card(head, hdr, *rows_, pad=False, gap=0, style='padding-bottom: 8px')


def drop_block():
    # 12×25 + 10×20 + 8×15 = 620 kg
    d = col(row(txt('10', 't-s num', 'width: 48px'), txt('20', 't-s num', 'width: 56px'), txt('drop 1', 't-m'), gap=8), row(txt('8', 't-s num', 'width: 48px'), txt('15', 't-s num', 'width: 56px'), txt('drop 2', 't-m'), gap=8), gap=4,
            style='padding: 4px 16px 4px 76px')
    return d + row(txt('3 drops · 30 reps', 't-m'), sp(), txt('620 kg in one set', 't-m'), style='padding: 2px 16px 6px 42px')


P('P16-TraineeSession.dc.html', 'Athlete session · read-only recap · Trainer (scroll)', gph(gbrand(),
    row(ibtn('back', 'Back', 'fill', sm=True), col(txt('Anna', 't-h1'), txt('21 Sep · 18 Sets completed · 6.2 t · 6 exercises · 1:05', 't-s'), gap=2, style='flex: 1'), gap=10, align='flex-start'),
    ex_card('Bench press', [srow('1', '12', '40', 'Warm-up sets'), srow('2', '8', '60', 'working', 'Rest 2:00'), srow('3', '8', '60', 'working', 'Rest 2:10'), srow('4', '6', '55', 'S-D', 'Rest 2:30')]),
    ex_card('Pull-up', [srow('1', '8', 'BW', 'working'), srow('2', '10', '25', '↑ reverse', 'Rest 2:00')]),
    ex_card('Cable fly', [srow('1', '12', '25', 'drop', 'Rest 1:30') + drop_block()]),
    card(row(tag('Superset A'), sp(), txt('3 rounds', 't-m'), gap=8),
         ex_card('Dumbbell curl', [srow('R1', '10', '12', 'working'), srow('R2', '10', '12', 'working', 'Rest 1:00'), srow('R3', '8', '12', 'working', 'Rest 1:00')], '×2 per hand'),
         ex_card('Triceps pushdown', [srow('R1', '12', '30', 'working'), srow('R2', '12', '30', 'working', 'Rest 1:00'), srow('R3', '10', '30', 'working', 'Rest 1:00')]), tone='glass', gap=10),
    card(row(tile('rotate', 'brass', s=16), col(txt('Circuit B', 't-h3'), txt('2 exercises · 3 rounds', 't-m'), gap=1), gap=10),
         *[col(row(tag(f'B{i+1}', 'neutral'), txt(n, 't-b', 'flex: 1'), txt('3/3', 't-m num'), gap=8), grid(*[card(txt(f'R{r+1}', 't-l'), txt(v, 't-s num'), gap=2, style='padding: 6px 8px') for r, v in enumerate(vals)], cols=3, gap=6), gap=6)
           for i, (n, vals) in enumerate([('Push-up', ['15', '12', '10']), ('Dips', ['10', '8', '8'])])], tone='glass', gap=12),
    tabs=None, h=1640), h=1640, row_=3)
board('P16-TraineeSession-States.dc.html', 'Athlete session · loading / error', 900, 360, spec('Athlete session (TraineeSessionView) · states',
    cap('Loading', row(ibtn('back', 'Back', 'fill', sm=True), txt('Anna', 't-h1'), gap=10), txt('…', 't-s'), w=358),
    cap('Error (message from the server)', row(ibtn('back', 'Back', 'fill', sm=True), txt('Anna', 't-h1'), gap=10), txt('permission-denied', 't-s'), w=358), w=900, h=360), row_=3)

# ============================================================== Overview › Programs · coach assign flow
def pg_tile(status, tone, name, meta, members=None):
    right = row(*[avatar(c, 30) for c in members], gap=-6) if members else row(ico('users', 16), txt('Assign', 't-s c-brass'), gap=6)
    return card(row(tag(status, tone)), txt(name, 't-h3'), txt(meta, 't-m'), hl(), right, gap=6)


def programs_coach():
    return [gbrand(), btn('Overview', 'txt', 'back', sm=True, style='align-self: flex-start'), txt('Programs', 't-h1'),
            section('My program'), card(row(tag('Active · week 3 of 8', 'ok'), sp(), txt('Mine', 't-m'), gap=8), txt('Upper/Lower 4×', 't-h3'), txt('8 weeks · 4 days a week', 't-m'), tone='glass', gap=6),
            row(lbl('Created by me'), sp(), tag('3', 'neutral'), style='padding: 0 2px'),
            pg_tile('Active', 'ok', 'Upper/Lower 4×', '8 weeks · 4 days a week', ['A', 'O', 'I']),
            pg_tile('Active', 'ok', 'Full body 3×', 'Ongoing · 3 days a week'),
            pg_tile('Draft', 'neutral', 'Push / Pull / Legs', '6 weeks · 6 days a week'),
            btn('Archived · 1', 'txt', 'layers', sm=True, style='align-self: flex-start'),
            row(btn('Import CSV', 'sec', 'upload', style='flex: 1'), btn('New program', 'pri', 'plus', style='flex: 1'), gap=10)]


P('P16-Programs-Coach.dc.html', 'Overview › Programs · Trainer / Admin (assign on every tile, scroll)', gph(*programs_coach(), tabs='overview', h=1160), h=1160, row_=3)


def member_row(ch, name, hint, on, leaving=False):
    return li(name, hint, avatar(ch, 34), check(on))


P('P16-Programs-Assignees.dc.html', 'Members drawer · assign / unassign a program · Trainer', gph(*programs_coach()[:6], tabs='overview', overlay=sheet(None,
    col(row(tag('Active · 8 weeks', 'ok')), txt('Upper/Lower 4×', 't-h2'), gap=6), search('Search clients'),
    lbl('On this program · 2'), lst(member_row('A', 'Anna', 'week 3 of 8', True), member_row('O', 'Oleh', 'will be removed', False, True)),
    lbl('Other clients'), lst(member_row('I', 'Iryna', 'on Full body 3× · will switch', True), member_row('M', 'Marek', 'no program', False)),
    h=660, close=False, footer=btn('Save <span class="c-ok">+1</span> <span class="c-bad">−1</span>', 'pri', full=True))), row_=3)
P('P16-Programs-Assignees-Empty.dc.html', 'Members drawer · no clients / save failed', gph(*programs_coach()[:6], tabs='overview', overlay=sheet(None,
    col(row(tag('Active · 8 weeks', 'ok')), txt('Upper/Lower 4×', 't-h2'), gap=6), txt('No clients available', 't-s'),
    txt('Couldn’t save — check your connection and try again.', 't-s c-bad'), h=330, close=False, footer=btn('Save', 'pri', full=True, dis=True))), row_=3)
board('P16-Programs-Builder-Menu.dc.html', 'Program builder ⋯ menu · Trainer / Admin', 900, 440, spec('Program builder · ⋯ menu (Assign to members only for trainer / admin)',
    cap('Trainer / Admin · saved active program', lst(li('Assign to members', None, tile('users', 'brass')), li('Duplicate', None, tile('note')), li('Export CSV', None, tile('download')),
        li('Archive', None, tile('layers')), li('Delete', None, tile('trash', 'bad'), tone='bad')), w=358),
    cap('Member · same program', lst(li('Duplicate', None, tile('note')), li('Export CSV', None, tile('download')), li('Archive', None, tile('layers')), li('Delete', None, tile('trash', 'bad'), tone='bad')), w=358),
    w=900, h=440), row_=3)

# ============================================================== components not mounted today + role deltas (spec boards, row 3)
LIVE_LAB = {'live': ('Training now', 'brass', 'c-brass'), 'offline': ('Connection lost', 'bad', 'c-bad'), 'finished': ('Finished', 'ok', 'c-ok')}


def live_big(state='live', first=False):
    """.trlive-hero: live = accent (loud hero), offline = danger wash + muted timer, finished = quiet graphite, ok go-link."""
    lab, tone, cls = LIVE_LAB[state]
    since = 'reconnecting…' if state == 'offline' else 'Started 18:04 · 4 exercises in'
    last = '12 Sets completed · 2.1 t' if state == 'finished' else 'Last <b>Chest 2</b> · 18 Sets completed · 6.2 t · 21 Sep'
    if first:
        last = 'First tracked session'
    go = 'View recap' if state == 'finished' else 'View'
    body = [row(dot(tone), span(f'<b class="{cls}">{lab}</b> · Iron Temple', 't-s'), sp(), ibtn('me', 'Open profile', 'fill', sm=True), gap=8),
            row(avatar('AS', 52), col(txt('Anna Shevchenko', 't-h2'), txt(since, 't-m'), gap=2, style='flex: 1; min-width: 0'), txt('24:18', 't-num num' + (' c-dim' if state == 'offline' else '')), gap=12),
            row(txt(last, 't-s', 'flex: 1'), span(go + ' →', 't-s ' + ('c-ok' if state == 'finished' else 'c-brass')), gap=8)]
    return card(*body, tone={'live': 'hero', 'offline': 'bad', 'finished': ''}[state], gap=14, style='padding: 16px')


def live_row(name, ch, state, t_):
    lab, tone, cls = LIVE_LAB[state]
    return li(name, row(dot(tone), span(f'{lab} · Iron Temple', ''), gap=6), avatar(ch, 34), row(txt(t_, 't-s num' + (' c-dim' if state == 'offline' else '')), ico('chev', 16), gap=6))


board('P16-TrainerLiveBanner.dc.html', 'TrainerLiveBanner (component exists, not mounted in the app)', 1600, 900, spec('TrainerLiveBanner · coach’s live athletes (component in code, currently not rendered by any screen)',
    cap('Live · with “Also training” rows', col(row(lbl('Your athletes'), sp(), row(dot('brass'), txt('3 training now', 't-m c-brass'), gap=6)), live_big('live'), lbl('Also training'),
                                             lst(live_row('Oleh Kovalenko', 'OK', 'live', '41:02'), live_row('Marek Nowak', 'MN', 'offline', '12:40'), live_row('Iryna Bondar', 'IB', 'finished', '1:05:12')), gap=10), w=380),
    cap('Offline (no heartbeat 90 s)', col(row(lbl('Your athletes'), sp(), row(dot('brass'), txt('1 training now', 't-m c-brass'), gap=6)), live_big('offline'), gap=10), w=380),
    cap('Finished (kept 5 min)', col(lbl('Your athletes'), live_big('finished'), gap=10), w=380),
    cap('Live · first tracked session (no last line)', col(lbl('Your athletes'), live_big('live', True), gap=10), w=380),
    w=1600, h=900), row_=3)

board('P16-ClientsStrip-States.dc.html', 'TrainerClientsStrip · every state', 1600, 560, spec('TrainerClientsStrip (Today · Atlas & clients block) · states',
    cap('Stories · Atlas lead, live first, then most recent, never last', strip(), w=420),
    cap('Bubble states', row(story('Live', 'A', 'live', live=True), story('Fresh', 'O', 'fresh'), story('Quiet', 'I', 'quiet'), story('Dormant', 'M', 'dormant', alert=True), story('Atlas', None, 'atlas', count='2'), gap=6, align='flex-start'), w=360),
    cap('No clients · solo (Atlas row)', atlas_solo(), w=380),
    cap('List view (supported by the component; Today passes stories)', col(row(story('Atlas', None, 'atlas', count='2')), lbl('List'), lst(li('Anna', span('Training now', 'c-ok'), avatar('A', 36), chev=True),
                                                                                             li('Oleh', 'Trained today', avatar('O', 36), chev=True), li('Marek', span('Last session 48 d ago', 'c-bad'), avatar('M', 36), chev=True),
                                                                                             li('Iryna', 'No sessions yet', avatar('I', 36), chev=True)), gap=8), w=380),
    w=1600, h=560), row_=3)

P('P16-ProgramAssignDialog.dc.html', 'Assign program sheet (ProgramAssignDialog — in code, not mounted)', gph(*programs_coach()[:6], tabs='overview', overlay=sheet(None,
    col(txt('Assign “Upper/Lower 4×”', 't-h2'), txt('Assigning replaces the member’s active program. Their logged history is untouched, and they can still start off-plan sessions any time.', 't-s'), gap=4),
    row(chip('Anna', True, 'x'), chip('Iryna', True, 'x'), gap=8), search('Search members'),
    lst(li('Anna', 'your client · active program will be replaced', avatar('A', 30), check(True)), li('Oleh', 'your client · active program will be replaced', avatar('O', 30), check(False)),
        li('Iryna', 'your client · active program will be replaced', avatar('I', 30), check(True))),
    col(txt('Start week', 't-s'), field(value='Week 1', trail=ico('down', 16)), gap=6), txt('Starts on Monday, at program week 1.', 't-s'),
    row(span(ico('warn', 16), 'c-brass'), txt('Each member’s current active program will be replaced. Their logged history is untouched.', 't-m', 'flex: 1'), gap=8, align='flex-start'),
    h=790, close=False, footer=two_btns('Cancel', 'Assign to 2'))), row_=3)


def shell_tile(label, desc, current=False):
    return card(row(tile('users', 'neutral'), col(txt(label, 't-h3'), txt(desc, 't-m'), gap=1, style='flex: 1'), tag('Current', 'neutral') if current else ico('chev', 18), gap=12),
                tone='glass' if current else '', style='padding: 12px 14px; width: 358px')


board('P16-Role-Deltas.dc.html', 'Role differences elsewhere in the app', 1600, 560, spec('Where trainer / admin see something a member doesn’t',
    cap('Apps sheet · People tile (label + description by role)', col(shell_tile('Clients', 'Your clients & profile.'), shell_tile('Users', 'Members, trainers & account.'), shell_tile('Me', 'Your profile & account.'),
                                                                   shell_tile('Clients', 'Your clients & profile.', True), gap=8), w=358),
    cap('Overview › Exercises · kicker', col(row(lbl('Trainer'), txt('·', 't-m'), lbl('Admin'), txt('·', 't-m'), lbl('Training'), gap=6), txt('Exercises', 't-h1'), gap=4), w=300),
    cap('Exercise detail · custom exercise (trainer / admin)', btn('Edit exercise', 'sec', 'edit', sm=True), w=260),
    cap('New exercise sheet note · Trainer / Admin', card(txt('This is added to the shared catalogue, so everyone gets it — with these muscles and equipment.', 't-s')), w=360),
    cap('New exercise sheet note · Member', card(txt('Tag the muscles it trains and the equipment it needs.', 't-s')), w=360),
    cap('Desktop Gym rail · Admin only', col(row(ibtn('bell', 'Notifications', 'fill'), ibtn('grid', 'Switch app', 'fill'), col(ibtn('gear', 'Settings', 'pri'), txt('Settings', 't-m'), gap=2, style='align-items: center'), gap=10), gap=8), w=300),
    w=1600, h=560), row_=3)

# ============================================================== desktop (People app on the AppRail)
def desk_trainer():
    """>= 960 px: the client list becomes a 4-col grid where every client card is display:none — only the self card stays;
    the week table appears; the preview aside stays hidden (display:none at every width)."""
    return (trainer_head() + grid(self_card(), '', '', '', cols=4, gap=16) + week_table() +
            txt('Only your clients appear here: created by you or assigned by an admin.', 't-m'))


board('P16-Desktop-Trainer.dc.html', 'Desktop · People · Clients · Trainer', 1440, 900, desktop(desk_trainer(), active='clients', items=NAV['trainer'][:2], mood='art', skin='roster'), row_=4)

DCOLS = 'grid-template-columns: 1.6fr .8fr 1fr 1fr .9fr 1.2fr 28px'


def desk_row(r, me=False):
    ch, n, u, role, tr, last, vol, stt, st, ex = r
    who = row(avatar(ch, 40 if me else 34), col(txt(n, 't-b' if me else 't-s'), txt('@' + u, 't-m'), rereq() if ex else '', gap=1), gap=11)
    cells = [who, row(tag(role, 'neutral' if role == 'Member' else 'brass')), span(tr, 't-m c-mut'), span(last, 't-m c-mut'), span(vol, 't-s num'),
             row(dot(ST[st]), span(stt, 't-m ' + ST_TXT[st]), gap=6), '' if me else ibtn('more', 'Menu', sm=True)]
    inner = ''.join(f'<div style="min-width: 0; display: flex; align-items: center; white-space: nowrap; overflow: hidden">{c}</div>' for c in cells)
    g = f'<div style="display: grid; {DCOLS}; gap: 10px; padding: {"12px" if me else "10px 12px"}; align-items: center">{inner}</div>'
    return card(g, pad=False) if me else hl() + g


def desk_admin():
    head = f'<div style="display: grid; {DCOLS}; gap: 10px; padding: 8px 12px">' + ''.join(span(h, 't-l c-dim') for h in ADMIN_HEAD_COLS) + '<span></span></div>'
    return (admin_head() + row(col(search('Search people'), style='width: 360px'), col(seg(['All', 'Members', 'Trainers', 'Pending'], 0), style='width: 420px'), gap=12) +
            desk_row(('M', 'Mykola', 'mykola', 'Admin', '', '', '18.9 t', 'Active', 'ok', ''), True) +
            card(head, *[desk_row(r) for r in PEOPLE_ROWS], tone='quiet', pad=False, gap=0) + admin_note())


board('P16-Desktop-Admin.dc.html', 'Desktop · People · Users · Admin', 1440, 900, desktop(desk_admin(), active='users', items=NAV['admin'][:2], mood='art', skin='roster'), row_=4)

def desk_me():
    left = col(me_hero(), style='width: 420px')
    right = col(subtabs(0), profile_stats(), style='flex: 1; min-width: 0')
    return me_top() + row(left, right, gap=24, align='flex-start') + row(col(top_ex(), style='flex: 1'), col(gyms_sec(), style='flex: 1'), gap=24, align='flex-start')


board('P16-Desktop-Member-Me.dc.html', 'Desktop · People · Me · Member', 1440, 1300, desktop(desk_me(), active='me', items=NAV['member'][:1], h=1300, mood='art', skin='roster'), row_=4)
print('ok')
