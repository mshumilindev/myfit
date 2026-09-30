"""P14 · Me, settings & shell — 1:1 translation of views/ProfileView.tsx (+ BodyMetrics, AvatarUploader, PhysiquePicker),
views/SettingsView.tsx, views/NotificationsView.tsx, components/ShellLauncher.tsx, views/InstallShortcut.tsx and the App.tsx
shell pieces (brand header, MasteryBadge, LanguageSelector, NoticeStrip, UpdatePlate, SyncBlockedCard, Rail / AppRail).
Every label is an en.ts string; see fidelity/P14.md for the board → source map."""
from kit import *

import glob as _glob, os as _os
for _f in _glob.glob(_os.path.join(OUT, 'P14-*.dc.html')):
    _os.remove(_f)

FLAG = '🇬🇧'
GYM = 'Iron Temple'


# ============================================================== small helpers (compose kit only)
def abs_(inner, css):
    return f'<div style="position: absolute; {css}">{inner}</div>'


def rel(inner, *badges, style=''):
    return f'<div style="position: relative; {style}">{inner}{"".join(badges)}</div>'


def badge(n):
    return tag(n, 'bad')


def mastery(calib=False, s=34):
    """MasteryBadge variant=header: progress ring + rank insignia (calibrating: dim ring + seal)."""
    if calib:
        return ring(0, s, 'neutral', 3, span(ico('shield', 13), 'c-dim'))
    return ring(64, s, 'brass', 3, span(ico('star', 13), 'c-brass'))


def bell(unread=0, sm=True):
    b = ibtn('bell', 'Notifications', 'fill', sm=sm)
    if not unread:
        return b
    return rel(b, abs_(badge('9+' if unread > 9 else str(unread)), 'top: -4px; right: -8px'))


def lang_compact():
    return f'<button class="ib fill sm" aria-label="English">{FLAG}</button>'


def lang_full():
    return chip(f'{FLAG} English {ico("down", 14)}')


def gym_head(unread=3, calib=False):
    """App.tsx .app-brand: spotter · Gym (switcher) · MasteryBadge · bell (+badge) · LanguageSelector compact."""
    return brandbar(row(mastery(calib), bell(unread), lang_compact(), gap=8))


def people_head(role='member', unread=3):
    """RosterApp header: spotter · Me / Clients / Users · bell · LanguageSelector (full)."""
    app = {'member': 'Me', 'trainer': 'Clients', 'admin': 'Users'}[role]
    return brandbar(row(bell(unread), lang_full(), gap=8), app=app)


PEOPLE_NAV = {
    'member': [('me', 'Me', 'me'), ('apps', 'Apps', 'grid')],
    'trainer': [('clients', 'Clients', 'users'), ('me', 'Me', 'me'), ('apps', 'Apps', 'grid')],
    'admin': [('users', 'Users', 'shield'), ('me', 'Me', 'me'), ('apps', 'Apps', 'grid')],
}


def people_phone(*content, role='member', active='me', h=844, overlay='', mood='art', unread=3):
    """RosterApp (People) boards: silver skin; at night mood='moon' (no sky, no SleepHero)."""
    return phone(people_head(role, unread), *content, tabs=(active, PEOPLE_NAV[role]), h=h, overlay=overlay, mood=mood)


def gym_phone(*content, h=844, overlay='', mood='art', tabs=None, night=False, unread=3, top_extra=(), skin=''):
    hero = [sleephero()] if night else []
    return phone(gym_head(unread), *top_extra, *hero, *content, tabs=tabs, h=h, overlay=overlay, mood='sky' if night else mood, skin=skin)


def today_bg():
    """Screen behind the Apps sheet: the Today tab (P01), trimmed."""
    return [row(lbl('Monday, September 28'), sp(), row(dot('ok'), txt('Synced', 't-m'), gap=6), style='padding: 0 2px'),
            card(row(tile('calendar', 'brass'), col(lbl('On your plan today'), txt('Chest 2', 't-h3'), gap=2, style='flex: 1'), ico('chev', 18), gap=12), tone='glass'),
            section('Shortcuts'),
            row(shortcut('Chest 2', 'play', 'brass'), shortcut('Run', 'run', 'sport'), shortcut('Sleep', 'moon', 'sleep'), shortcut('Weigh-in', 'scale'), gap=8),
            section('Body'),
            grid(card(lbl('Readiness'), f'<div class="t-d1 num">82<span class="t-m"> %</span></div>', bar(82, 'ok')),
                 card(lbl('Sleep · last night'), f'<div class="t-d1 num">7<span class="t-m">h</span> 12<span class="t-m">m</span></div>'), cols=2)]


def field_err(msg):
    return row(span(ico('warn', 16), 'c-bad'), txt(msg, 't-s c-bad'), gap=6)


# ============================================================== Profile pieces (ProfileView.tsx order)
def prof_top(name, back=False):
    """profile-top: [back 36px] · kicker Profile · title-26."""
    return row(ibtn('back', 'Back', sm=True) if back else '', col(lbl('Profile'), txt(name, 't-h1'), gap=2), gap=10, style='padding: 2px 2px 0')


def uploader(has=True, remove=True):
    """AvatarUploader compact · idle: 112 px ring (photo or +) with camera badge, then Camera · Library · Remove photo (onb-two row)."""
    face = avatar('M', 112) if has else f'<span class="av" style="width: 112px; height: 112px">{ico("plus", 30)}</span>'
    ring_ = rel(ring(100, 124, 'brass', 3, face), abs_(ibtn('camera', 'Change photo', 'pri', sm=True), 'right: -2px; bottom: 2px'))
    acts = col(row(btn('Camera', 'sec', 'camera', sm=True, style='flex: 1'), btn('Library', 'sec', 'image', sm=True, style='flex: 1'), gap=8),
               btn('Remove photo', 'dan', 'trash', sm=True, full=True) if (has and remove) else '', gap=8, style='align-self: stretch')
    return col(ring_, acts, gap=14, style='align-items: center; align-self: stretch')


def id_fields(first='Mykola', last='', user='mykola', dirty=False, state=''):
    """profile-detail-fields: always rendered when the viewer may edit (no CSS hides them); Cancel/Save disabled until dirty."""
    return col(field('First name', first, state=state), field('Last name', last, 'Last name'), field('Username', user),
               row(btn('Cancel', 'sec', sm=True, dis=not dirty), btn('Save', 'pri', sm=True, dis=not dirty), gap=8), gap=10)


def meta_grid(items):
    """profile-meta-grid: 12 px wrapped meta, neutral-500 — deliberately quiet."""
    return row(*[span(f'{k}: {v}', 't-m') for k, v in items], gap=12, wrap=True, style='row-gap: 6px')


def identity(name, tg, live=False, edit=None, handle_line=None, handle=None, fields=None, meta=()):
    line = row(txt(name, 't-h1'), tag(tg), row(dot('brass'), span('Training now', 't-m c-brass'), gap=6) if live else '', sp(),
               btn(edit, 'txt', style='height: 28px') if edit else '', gap=8)
    parts = [line]
    if handle_line:
        parts.append(txt(handle_line, 't-m'))
    if fields:
        parts.append(fields)
    if handle:
        parts.append(txt(handle, 't-s'))
    parts.append(meta_grid(meta))
    return col(*parts, gap=8)


def hero(avatar_block, ident):
    """profile-hero — the loud block of the profile (e1)."""
    return card(avatar_block, ident, tone='hero', gap=18, style='padding: 18px')


def other_avatar(ch):
    return col(ring(100, 94, 'brass', 3, avatar(ch, 82)), style='align-items: center')


MY_META = [('Joined', '3 Mar'), ('Status', 'Active'), ('Trainer', 'Oleh'), ('First session', '5 Mar'), ('Last session', '28 Sep')]


def stat_cell(icon, v, l, accent=False):
    """profile-stat-cell: 104 px cell, value first (big), label under, small icon plate top-right; accent = brass ring."""
    return card(rel(col(txt(v, 't-num num', 'white-space: nowrap'), txt(l, 't-m'), gap=4), abs_(span(ico(icon, 16), 'c-brass' if accent else 'c-dim'), 'top: 0; right: 0')),
                tone='glass' if accent else '', style='min-height: 92px; padding: 16px')


def stat_group(title, icon, *cells):
    return col(row(span(ico(icon, 14), 'c-dim'), lbl(title), gap=8), grid(*cells, cols=2, gap=8), gap=9)


def stats(live=0):
    act = [stat_cell('calendar', '148', 'Sessions'), stat_cell('progress', '14', '30-day sessions'), stat_cell('rotate', '3.3', 'Per week')]
    if live:
        act.append(stat_cell('play', str(live), 'Live sessions', accent=True))
    return col(stat_group('Activity', 'calendar', *act),
               stat_group('Training load', 'flame', stat_cell('trophy', '612.4 t', 'Lifetime volume'), stat_cell('chart', '71.2 t', '30-day volume'), stat_cell('flame', '16.8 t', '7-day volume')),
               stat_group('Workout structure', 'dumbbell', stat_cell('list', '3 912', 'Sets'), stat_cell('dumbbell', '64', 'exercises'), stat_cell('timer', '172:40', 'Duration'), stat_cell('clock', '540', 'Cardio min')),
               gap=18)


def metric(v, s):
    return col(txt(v, 't-h3 num', 'text-align: right'), txt(s, 't-m', 'text-align: right') if s else '', gap=1)


def top_exercises(empty_=False):
    if empty_:
        return col(lbl('Top exercises'), txt('No training data yet.', 't-m'), gap=8)
    ex = [('Bench press', '38 · 214 sets', '98.2 t', '117 kg e1RM'), ('Squat', '34 · 176 sets', '121.6 t', '163 kg e1RM'),
          ('Deadlift', '22 · 88 sets', '74.9 t', '203 kg e1RM'), ('Pull-up', '30 · 150 sets', '0.0 t', None)]
    return col(lbl('Top exercises'), lst(*[li(n, s, exercise_pic({'Pull-up': 'Pullups'}.get(n, n), 40, 40, 10), metric(v, e)) for n, s, v, e in ex]), gap=8)


def gyms_block(empty_=False):
    if empty_:
        return col(lbl('Gyms'), txt('No gyms saved yet.', 't-m'), gap=8)
    g = lambda n, fav, meta, c: card(row(photo(76, 64, 12), col(row(txt(n, 't-h3'), tag('Favourite') if fav else '', gap=8), txt(meta, 't-m'), txt(c, 't-m num'), gap=3, style='flex: 1; min-width: 0'), gap=12), style='padding: 9px 12px 9px 9px')
    return col(lbl('Gyms'), g(GYM, True, '142 · 598.1 t · 28 Sep', '50.45012, 30.52340'), g('Home', False, '6 · 14.3 t · 2 Aug', '50.44210, 30.49871'), gap=8)


def recent(rows_=4, live_first=False, empty_=False):
    if empty_:
        return col(lbl('Recent sessions'), txt('No training data yet.', 't-m'), gap=8)
    data = [('28 Sep', GYM, '18 · 6.2 t', '0:58 · Bench press, Incline dumbbell press, Cable fly'),
            ('26 Sep', GYM, '22 · 9.8 t', '1:12 · Squat, Romanian deadlift, Leg press'),
            ('24 Sep', GYM, '16 · 5.1 t', '0:51 · Pull-up, Barbell row, Face pull'),
            ('22 Sep', GYM, '20 · 11.4 t', '1:05 · Deadlift, Front squat, Hip thrust'),
            ('19 Sep', '—', '12 · 0.0 t', 'Auto-closed · Push-up, Plank')]
    if live_first:
        data = [('28 Sep', GYM, '12 · 4.8 t', 'Training now · Squat, Leg press')] + data[1:]
    return col(lbl('Recent sessions'), card(*[li(f'{d} · {g}', s, trail=span(v, 't-s num')) for d, g, v, s in data[:rows_]], tone='quiet', pad=False, gap=0), gap=6)


def overview(live=0, trainer_live=False, empty_=False):
    parts = []
    if trainer_live:
        parts.append(col(lbl('Live right now'), card(row(txt('Squat', 't-h3', 'flex: 1'), txt('12 · 4.8 t', 't-m num'), gap=8),
                                                     grid(span('#', 't-m'), span('Sets', 't-m'), span('Lifetime volume', 't-m'), txt('1', 't-num num'), txt('12', 't-num num'), txt('4.8 t', 't-num num'), cols=3, gap=6),
                                                     txt('Updating live · you cannot edit these', 't-m'), tone='glass'), gap=8))
    parts += [stats(live), top_exercises(empty_), gyms_block(empty_), recent(live_first=bool(live), empty_=empty_)]
    return parts


def quiet_rows(*rows_):
    """profile-setting-row: 49 px rows, hairline under each, no surface — settings stay quiet (e4)."""
    return card(*rows_, tone='quiet', pad=False, gap=0)


def srow(title, icon, trail='', tone=None, sub=None):
    return li(title, sub, span(ico(icon, 17), 'c-bad' if tone == 'bad' else 'c-dim'), trail, tone=tone, style='padding-left: 2px; padding-right: 2px; min-height: 49px')


def access_block(rows_=True):
    body = col(card(row(avatar('M', 34), txt('Marek', 't-s'), sp(), txt('Admin · full access', 't-m'), gap=11), style='padding: 9px 11px'),
               card(row(avatar('O', 34), txt('Oleh', 't-s'), sp(), txt('Trainer · reads your sessions', 't-m'), gap=11), style='padding: 9px 11px'), gap=6) if rows_ else txt('Only you can see your data.', 't-m')
    return col(lbl('Who can see your training'), body, gap=8)


def self_settings(signout=True):
    rows_ = quiet_rows(srow('Units', 'scale', seg(['kg', 'lb'])),
                       srow('Week starts on', 'calendar', row(txt('Monday', 't-s'), ico('down', 14), gap=4)),
                       srow('Atlas · Warm', 'chat', ico('chev', 16)),
                       srow('Password', 'lock', ico('chev', 16)))
    out = [col(lbl('Settings'), row(lang_full()), rows_, gap=8)]
    if signout:
        out.append(quiet_rows(srow('Sign out', 'logout', tone='bad')))
    return out


def admin_trainer_section(trainer='Oleh', is_trainer=False, clients=3):
    rows_ = [srow('Assign trainer', 'users', ico('chev', 16), sub=trainer or 'No trainer')]
    if is_trainer:
        rows_.append(srow('Assign clients', 'plus', ico('chev', 16), sub=f'{clients} clients'))
    return col(lbl('Assigned trainer'), quiet_rows(*rows_), gap=6)


def trainer_priv(on=False):
    return quiet_rows(srow('Trainer privileges', 'dumbbell', toggle(on), sub='Grants access to assigned clients and program authoring.'))


def security(err=None, ready=False):
    return card(row(span(ico('shield', 16), 'c-dim'), lbl('Security'), gap=8),
                txt('Change your password with your current password. Admins and trainers do not see it.', 't-m'),
                field('Current password', '••••••••'), field('New password', '•••••••', state='focus' if not err else ''), field('Confirm new password', '•••••••', state='err' if err else ''),
                btn('Cancel', 'sec', full=True), btn('Update password', 'pri', full=True, dis=not ready),
                field_err(err) if err else '', gap=10)


def audit_block(empty_=False):
    body = txt('Only you can see your data.', 't-m') if empty_ else quiet_rows(li('Oleh', 'Trainer · sessions', trail=txt('27 Sep', 't-m')), li('Marek', 'Admin · profile', trail=txt('14 Sep', 't-m')))
    return col(lbl('Who opened this profile'), body, gap=6)


def me_top(role='member', editing=False, err=None, has=True, avatar_block=None, dirty=False, embedded=True):
    rl = {'member': 'member', 'trainer': 'trainer', 'admin': 'admin'}[role]
    meta = list(MY_META)
    if role == 'trainer':
        meta.insert(3, ('Clients', '4'))
    if role != 'member':
        meta[2] = ('Trainer', '—')
    ident = identity('Mykola', 'You', edit=('Done' if editing else 'Edit') if embedded else None, handle_line=f'@mykola · {rl}' if embedded else None,
                     fields=id_fields(first='Mykola K' if dirty else 'Mykola', dirty=dirty), meta=meta)
    out = [prof_top('Mykola', back=not embedded), hero(avatar_block or uploader(has), ident)]
    if err:
        out.append(card(row(span(ico('warn', 18), 'c-bad'), txt(err, 't-s', 'flex: 1'), gap=10), tone='bad', style='padding: 10px 12px'))
    return out


# ============================================================== ROW 0 · main screens
# ---- Me (People app · embedded self profile) per role
for role, h in (('member', 2440), ('trainer', 2460), ('admin', 2440)):
    active = 'me'
    P(f'P14-Me-{role.title()}.dc.html', f'Me · Overview · {role.title()}',
      people_phone(*me_top(role), seg(['Overview', 'Body', 'Settings'], 0), *overview(), role=role, active=active, h=h), h=h, row_=0)

# ---- Body tab (BodyMetricsSection, owner-editable)
def bm_metric(v, unit, label, ro=False):
    val = txt(f'{v}<span class="t-m" style="margin-left: 4px">{unit}</span>', 't-h3 num') if ro else field(None, v, '—', trail=span(unit, 't-m'))
    return col(val, txt(label, 't-m'), gap=4)


def body_section(ro=False, empty_=False, badge_=None):
    head = row(lbl('Body metrics'), sp(), tag(badge_, 'neutral', 'lock') if badge_ else '', gap=8)
    if empty_:
        heroc = empty('No weight entries yet', 'Add your first entry — then the trend and weigh-in reminders appear.', 'scale', None if ro else 'Add weight')
    else:
        heroc = card(lbl('Current weight', 'brass'), f'<div class="t-hero num">82.4<span class="t-m" style="margin-left: 6px">kg</span></div>', txt('28 Sep, 07:40', 't-m'),
                     row(span('−3.1 kg', 't-s c-ok num'), span('·', 't-s c-dim'), span('2.4 kg to goal', 't-s c-mut'), gap=6),
                     '' if ro else btn('Add weight', 'pri', 'plus', style='align-self: flex-start; margin-top: 8px'), tone='hero', gap=4, style='padding: 18px')
    two = grid(card(bm_metric('182', 'cm', 'Height', ro)), card(col(row(txt('—' if empty_ else '24.9', 't-h3 num'), tag('normal', 'ok') if not empty_ else '', gap=8), txt('BMI · approx.', 't-m'), gap=4)), cols=2)
    about = grid(col(lbl('Sex'), seg(['Male', 'Female'], 0), gap=6), col(row(lbl('Birthday'), span('32 yrs', 't-m'), gap=6), field(None, '12 May 1994', trail=ico('calendar', 16)), gap=6), cols=2, gap=12)
    parts = [head, heroc, two, about]
    if not empty_:
        parts.append(card(row(lbl('Weight trend'), sp(), txt('last 8 entries', 't-m')), spark([85.5, 84.9, 84.2, 83.6, 83.1, 82.9, 82.7, 82.4], 322, 96, 'brass'),
                          row(txt('28 Sep, 07:40', 't-m'), sp(), txt('goal 80 kg', 't-m')), gap=8))
        ent = [('28 Sep, 07:40', '82.4 kg', '−0.3 kg', 'ok'), ('21 Sep, 07:35', '82.7 kg', '−0.2 kg', 'ok'), ('14 Sep, 07:50', '82.9 kg', '+0.2 kg', 'mut'), ('7 Sep, 08:05', '82.7 kg', '−0.8 kg', 'ok')]
        parts.append(col(lbl('Recent entries'), quiet_rows(*[li(span(d, 't-s'), None, None, row(span(w, 'num'), span(dl, f't-s num c-{c}', 'width: 58px; text-align: right'), '' if ro else ibtn('edit', 'Edit weight', sm=True), gap=10), style='min-height: 44px; padding-left: 2px; padding-right: 2px') for d, w, dl, c in ent]), gap=6))
    comp = [('16', '%', 'Body fat'), ('38.5', 'kg', 'Muscle'), ('80', 'kg', 'Goal'), ('84', 'cm', 'Waist'), ('104', 'cm', 'Chest'), ('', 'cm', 'Hip')]
    if empty_:
        comp = [('', u, l) for _, u, l in comp]
    parts.append(col(lbl('Composition'), grid(*[card(bm_metric(v or '—', u, l, ro), style='padding: 10px') for v, u, l in comp], cols=3, gap=8), gap=8))
    return parts


P('P14-Me-Body.dc.html', 'Me · Body tab', people_phone(*me_top(), seg(['Overview', 'Body', 'Settings'], 1), *body_section(), h=2420), h=2420, row_=0)

# ---- Settings tab (self)
P('P14-Me-Settings.dc.html', 'Me · Settings tab · Member / Trainer', people_phone(*me_top(), seg(['Overview', 'Body', 'Settings'], 2), access_block(), *self_settings(), audit_block(), h=1840), h=1840, row_=0)
P('P14-Me-Settings-Admin.dc.html', 'Me · Settings tab · Admin', people_phone(*me_top('admin'), seg(['Overview', 'Body', 'Settings'], 2), access_block(False), *self_settings(), admin_trainer_section(None), audit_block(), role='admin', h=1880), h=1880, row_=0)

# ---- Another user's profile (non-embedded: back + fields for admin)
anna_meta = [('Joined', '12 Jan'), ('Status', 'Active'), ('Trainer', 'Oleh'), ('First session', '14 Jan'), ('Last session', '28 Sep')]
admin_ident = identity('Anna', 'Member', fields=id_fields('Anna', 'Shevchuk', 'anna'), meta=anna_meta)
P('P14-Profile-Admin-Overview.dc.html', 'Profile · other user · Admin view · Overview',
  people_phone(prof_top('Anna', back=True), hero(other_avatar('A'), admin_ident), seg(['Overview', 'Body', 'Settings'], 0), *overview(), role='admin', active='users', h=2280), h=2280, row_=0)
P('P14-Profile-Admin-Settings.dc.html', 'Profile · other user · Admin view · Settings',
  people_phone(prof_top('Anna', back=True), hero(other_avatar('A'), admin_ident), seg(['Overview', 'Body', 'Settings'], 2),
               access_block(), admin_trainer_section('Oleh'), trainer_priv(False), role='admin', active='users', h=1240), h=1240, row_=0)
oleh_meta = [('Joined', '2 Feb'), ('Status', 'Active'), ('Trainer', '—'), ('Clients', '3'), ('First session', '4 Feb'), ('Last session', '27 Sep')]
P('P14-Profile-Admin-Trainer.dc.html', 'Profile · a trainer · Admin view · Settings',
  people_phone(prof_top('Oleh', back=True), hero(other_avatar('O'), identity('Oleh', 'Trainer', fields=id_fields('Oleh', 'Hnatiuk', 'oleh'), meta=oleh_meta)),
               seg(['Overview', 'Body', 'Settings'], 2), access_block(False), admin_trainer_section(None, True), trainer_priv(True), role='admin', active='users', h=1300), h=1300, row_=0)
tr_ident = identity('Anna', 'Member', live=True, handle='@anna', meta=anna_meta[:2] + [('Trainer', 'Mykola')] + anna_meta[3:])
P('P14-Profile-Trainer-View.dc.html', 'Profile · client · Trainer view (live)',
  people_phone(prof_top('Anna', back=True), hero(other_avatar('A'), tr_ident), seg(['Overview', 'Body', 'Settings'], 0), *overview(live=1, trainer_live=True),
               role='trainer', active='clients', h=2170), h=2170, row_=0)


# ---- Notifications (Gym overlay: no tab bar)
def nrow(icon, tone, title, sub, time, unread=False, nav=True):
    """notif-row: 42 px kind icon (standard/feat/streak accent · pr/volume ok · trend kcal · challenge/atlas neutral), title, sub, time, caret when linked.
    Unread rows get the faint accent surface + glowing dot; read rows have no surface."""
    r = li(title, sub, tile(icon, tone), row(txt(time, 't-m'), ico('chev', 16) if nav else '', gap=6), style='padding-left: 16px')
    if not unread:
        return r
    return card(rel(r, abs_(dot('brass'), 'left: 5px; top: 50%; margin-top: -4px')), pad=False)


def recap_block():
    head = row(span(ico('spark', 13) + ' Your recaps', 't-l c-brass', 'flex: 1'), btn('See all', 'txt', style='height: 28px'))
    heroc = card(row(span(ico('dumbbell', 14) + ' Monthly recap · ready', 't-l c-brass'), sp(), dot('brass')), txt('September 2026', 't-h1'), txt('Your highest-volume month yet.', 't-b c-brass'),
                 grid(stat('Volume', '85', 't'), stat('Sessions', '16'), stat('PRs', '5'), cols=3), btn('Play your September', 'pri', 'play', full=True),
                 btn('or read the full recap', 'txt', style='align-self: center; height: 28px'), tone='hero', gap=12, style='padding: 18px')
    return col(head, heroc, lst(li('Q3 2026', '38 sessions · 214 t', tile('calendar', 'brass'), ico('play', 22))),
               lst(li('2026', 'Building — 132 sessions so far', tile('clock'))), gap=10)


def notif_head(title='Notifications', back=True, markall=True):
    return row(ibtn('back', 'Back', sm=True) if back else '', txt(title, 't-h1', 'flex: 1'), btn('Mark all read', 'txt', style='height: 32px') if markall else '', gap=10)


def ngroup(label, *rows_):
    return col(lbl(label), col(*rows_, gap=5), gap=8)


FEED = [ngroup('Today', nrow('dumbbell', 'ok', 'Bench press PR', '100 kg · up 2.5 kg', '2h', True),
               nrow('trophy', 'brass', 'Bench press → Int', '100 kg · a new tier', '2h', True),
               nrow('check', 'ok', 'Weekly volume goal met', 'Every muscle in its productive range', '2h', True),
               nrow('flame', 'brass', '7-day streak', 'keep it going', '2h', True, nav=False)),
        ngroup('This week', nrow('target', 'neutral', 'Challenge done: 1,000 Push-up reps', 'you finished it', 'Sat'),
               nrow('progress', 'kcal', 'Volume trending up', 'Higher now than your earlier months — steady overload.', 'Thu')),
        ngroup('Earlier', nrow('star', 'brass', 'Panda', 'achievement unlocked', '12 Sep'), nrow('dumbbell', 'ok', 'Squat PR', '140 kg · up 5 kg', '9 Sep'))]

P('P14-Notifications.dc.html', 'Notifications · Gym overlay', gym_phone(notif_head(), recap_block(), *FEED, h=1480), h=1480, row_=0)


# ---- Apps switcher (ShellLauncher) per role
def shell_tile(icon, tone, name, sub, current=False, locked=False, badge_=None):
    """shell-tile: its own surface, 48 px app plate in the app's gem, 17 px bold name, 12.5 px sub; Current pill or caret; locked = dim, no caret."""
    nm = row(span(name, 't-h3' + (' c-dim' if locked else '')), tag(badge_, 'apex') if badge_ else '', gap=8)
    trail = tag('Current', 'neutral') if current else ('' if locked else span(ico('chev', 16), 'c-dim'))
    body = row(tile(icon, tone, lg=True), col(nm, txt(sub, 't-m'), gap=2, style='flex: 1; min-width: 0'), trail, gap=15)
    return card(body, tone='quiet' if locked else ('glass' if current else ''), style='padding: 15px 16px' + ('; box-shadow: none' if False else ''))


def shell_sheet(role='member', current='gym', nutrition=False, h=700):
    people = {'member': ('Me', 'Your profile & account.'), 'trainer': ('Clients', 'Your clients & profile.'), 'admin': ('Users', 'Members, trainers & account.')}[role]
    tiles = col(shell_tile('dumbbell', 'brass', 'Gym', '4 sessions this week · 12 day streak', current == 'gym'),
                shell_tile('trophy', 'apex', 'Apex', '2 active · 3 new', current == 'apex', badge_='3'),
                shell_tile('flame', 'kcal', 'Nutrition', 'Fuel your training.' if nutrition else span(ico('clock', 12) + ' Coming soon', 'c-dim'), current == 'nutrition', locked=not nutrition),
                shell_tile('users', 'neutral', people[0], people[1], current == 'roster'),
                shell_tile('book', 'learn', 'Learn', 'How-to videos.', current == 'learn'), gap=11)
    foot = col(btn('Sign out', 'dan', 'logout', full=True), txt('One account · one training history', 't-m', 'text-align: center'), gap=16)
    return sheet(None, lbl('Switch app'), tiles, foot, h=h)


for role in ('member', 'trainer', 'admin'):
    P(f'P14-Shell-{role.title()}.dc.html', f'Apps switcher · {role.title()}', gym_phone(*today_bg(), tabs='apps', overlay=shell_sheet(role)), row_=0)

# ---- Settings (admin only; overlay, web — reached from the desktop rail)
def settings_body():
    """settings-view: hist-head (back · title-26 · sub) → Features label → settings-row cards (name, desc, ff-toggle)."""
    frow = lambda n, d, on: card(row(col(txt(n, 't-h3'), txt(d, 't-m'), gap=3, style='flex: 1'), toggle(on), gap=14), style='padding: 16px')
    return [row(ibtn('back', 'Back', sm=True), col(txt('Settings', 't-h1'), txt('Feature flags for this device', 't-m'), gap=4), gap=10),
            col(lbl('Features'), frow('Gym-presence reminders', 'Use location to detect gym visits and suggest logging a session. Off by default.', False),
                frow('Nutrition app', 'Unlock the Nutrition app (КБЖУ tracker) in the app switcher.', True), gap=8)]


P('P14-Settings.dc.html', 'Settings · Admin only (phone, #/settings)', gym_phone(*settings_body()), row_=0)


# ============================================================== ROW 1 · states & night
P('P14-Me-Loading.dc.html', 'Me · loading (ProfileSkeleton)',
  people_phone(prof_top('Profile'),
               card(col(f'<div class="sk" style="width: 96px; height: 96px; align-self: center"></div>',
                        grid(*[f'<div class="sk" style="height: 40px"></div>'] * 3, cols=3, gap=8),
                        f'<div class="sk" style="width: 60%; height: 22px"></div>', *[f'<div class="sk" style="height: 44px"></div>'] * 3, gap=10)),
               f'<div class="sk" style="width: 40%; height: 12px"></div>', f'<div class="sk" style="height: 118px"></div>',
               grid(f'<div class="sk" style="height: 78px"></div>', f'<div class="sk" style="height: 78px"></div>', cols=2),
               f'<div class="sk" style="height: 150px"></div>', h=1030), h=1030, row_=1)


def err_screen(title, body):
    return card(col(tile('warn', 'bad', lg=True), txt(title, 't-h3', 'text-align: center'), txt(body, 't-s', 'text-align: center'), gap=10, style='align-items: center; padding: 22px 8px'), tone='dash')


errs = [('Profile locked', 'Profile locked', 'Direct links work only for the profile owner, an admin, or the assigned trainer.'),
        ('Profile not found', 'Profile not found', 'GET /api/profile/users/u_7f3k2'),
        ('Profile', 'Error', 'GET /api/profile/users/u_7f3k2')]
board('P14-Profile-Errors.dc.html', 'Profile · locked / not found / failed', 390 * 3 + 80, 844,
      row(*[people_phone(prof_top(t_, back=True), err_screen(a, b), role='trainer', active='clients') for t_, a, b in errs], gap=40, align='flex-start'), row_=1)

P('P14-Me-Editing.dc.html', 'Me · details changed (Save enabled, Edit → Done)', people_phone(*me_top(editing=True, dirty=True), seg(['Overview', 'Body', 'Settings'], 0), *overview()[:1], h=1670), h=1670, row_=1)
P('P14-Me-Edit-Error.dc.html', 'Me · editing · save failed', people_phone(*me_top(editing=True, dirty=True, err='Error'), seg(['Overview', 'Body', 'Settings'], 0), h=1200), h=1200, row_=1)
P('P14-Me-Password.dc.html', 'Me · Settings · password editing (mismatch)', people_phone(*me_top(), seg(['Overview', 'Body', 'Settings'], 2), access_block(), *self_settings()[1:],
                                                                                     security('The new passwords do not match.'), audit_block(True), h=2000), h=2000, row_=1)
P('P14-Me-NoPhoto.dc.html', 'Me · no photo, new account (empty lists)', people_phone(*me_top(has=False), seg(['Overview', 'Body', 'Settings'], 0), *overview(empty_=True), h=1780), h=1780, row_=1)
P('P14-Me-Body-Empty.dc.html', 'Me · Body · no weight entries', people_phone(*me_top(), seg(['Overview', 'Body', 'Settings'], 1), *body_section(empty_=True), h=1680), h=1680, row_=1)
P('P14-Profile-Body-ReadOnly.dc.html', 'Profile · client Body · Trainer view (read-only)',
  people_phone(prof_top('Anna', back=True), hero(other_avatar('A'), tr_ident), seg(['Overview', 'Body', 'Settings'], 1), *body_section(ro=True),
               role='trainer', active='clients', h=2000), h=2000, row_=1)

P('P14-Notifications-Empty.dc.html', 'Notifications · empty', gym_phone(notif_head(markall=False),
                                                                         card(col(tile('bell', 'brass', lg=True), txt('No notifications yet', 't-h3', 'text-align: center'),
                                                                                  txt('Milestones, PRs and streaks will show up here as you train.', 't-s', 'text-align: center'), gap=10, style='align-items: center; padding: 26px 10px'), tone='dash')), row_=1)
P('P14-Notifications-Feed.dc.html', 'Notifications · People app Feed tab (Milestones)',
  people_phone(notif_head('Milestones', back=False, markall=True), *FEED, h=1100, role='trainer', active='feed', unread=0), h=1100, row_=1)

P('P14-Shell-Nutrition-On.dc.html', 'Apps switcher · Nutrition flag on (Admin), from People', people_phone(access_block(), role='admin', overlay=shell_sheet('admin', 'roster', True)), row_=1)

# ---- toast holder: NoticeStrip + UpdatePlate over Today; SyncBlockedCard under the header
def notice(icon, text):
    """notice: surface card, accent left bar + accent icon (same family as toast/snackbar/update)."""
    return card(row(span(ico(icon, 17), 'c-brass'), txt(text, 't-s', 'flex: 1'), ibtn('x', 'Dismiss', sm=True), gap=10), style='padding: 6px 6px 6px 14px')


def update_plate():
    return card(row(span(ico('rotate', 17), 'c-brass'), txt('A new version is ready — reload to update', 't-s', 'flex: 1'), btn('Reload', 'txt', sm=True), gap=10), style='padding: 6px 6px 6px 14px')


def sync_blocked():
    return card(row(tile('cloudoff', 'bad'), col(txt('Sync is blocked', 't-h3'), txt('One change was rejected, so nothing after it can sync. Retry it, or discard that one change to let the rest through.', 't-s'), gap=2, style='flex: 1'), gap=12, align='flex-start'),
                card(txt('409 Conflict · POST /api/sync', 't-m num'), style='padding: 8px 10px'),
                row(sp(), btn('Discard change', 'sec', sm=True), btn('Retry', 'pri', sm=True), gap=8), tone='bad', style='padding: 12px 14px')


toasts = abs_(col(notice('layers', 'Oleh assigned you the program “Upper/Lower 4×”.'), notice('shield', 'Your role was changed to trainer.'), update_plate(), gap=8), 'left: 12px; right: 12px; bottom: 92px')
P('P14-Toasts.dc.html', 'NoticeStrip + UpdatePlate (toast holder) over Today', gym_phone(*today_bg(), tabs='today', overlay=toasts), row_=1)
P('P14-SyncBlocked.dc.html', 'SyncBlockedCard under the header', gym_phone(*today_bg(), tabs='today', top_extra=(sync_blocked(),)), row_=1)

# ---- night (live night): moonlit tokens; Gym screens carry the SleepHero band
P('P14-Notifications-Night.dc.html', 'Notifications · night', gym_phone(notif_head(), *FEED[:2], night=True, h=1100), h=1100, row_=1)
P('P14-Shell-Night.dc.html', 'Apps switcher · night', gym_phone(*today_bg(), tabs='apps', night=True, overlay=shell_sheet('member')), row_=1)
P('P14-Settings-Night.dc.html', 'Settings · night (Admin)', gym_phone(*settings_body(), night=True), row_=1)
P('P14-Me-Night.dc.html', 'Me · night (People app: moon, no sky, no SleepHero)', people_phone(*me_top(), seg(['Overview', 'Body', 'Settings'], 0), *overview()[:2], mood='moon', h=1930), h=1930, row_=1)
P('P14-Toasts-Night.dc.html', 'NoticeStrip + UpdatePlate · night', gym_phone(*today_bg()[:3], tabs='today', night=True, overlay=toasts), row_=1)


# ============================================================== ROW 2 · sheets, popovers, avatar states
LANGS = [('🇬🇧', 'English', True), ('🇺🇦', 'Українська', False), ('🇵🇱', 'Polski', False), ('🇱🇹', 'Lietuvių', False), ('🇪🇪', 'Eesti', False)]


def pop(items, pos):
    rows_ = ''.join(li(f'{f} {n}', None, None, ico('check', 16) if on else '', style='min-height: 44px') for f, n, on in items)
    return f'<div class="dialog" style="{pos}; left: auto; width: 210px; padding: 4px 0; gap: 0">{rows_}</div>' if 'left: 16px' not in pos else f'<div class="dialog" style="{pos}; right: auto; width: 210px; padding: 4px 0; gap: 0">{rows_}</div>'


def lang_pop():
    items = [('🇬🇧', 'English', True), ('🇺🇦', 'Українська', False), ('🇵🇱', 'Polski', False), ('🇱🇹', 'Lietuvių', False), ('🇪🇪', 'Eesti', False)]
    return pop(items, 'top: 52px; right: 12px')


P('P14-Language.dc.html', 'LanguageSelector · popover open (Gym header)', gym_phone(*today_bg(), tabs='today', overlay=lang_pop()), row_=2)
P('P14-Language-People.dc.html', 'LanguageSelector · full chip, Settings tab', people_phone(*me_top(), seg(['Overview', 'Body', 'Settings'], 2), access_block(), *self_settings()[1:],
                                                                                            overlay=pop(LANGS, 'top: 1088px; left: 16px'), h=1340), h=1340, row_=2)

crop = col(lbl('Position your photo'), rel(photo(260, 260, 130, ''), style='align-self: center'), txt('Drag the photo to frame it. Use zoom for a tighter crop.', 't-s', 'text-align: center'),
           row(txt('Zoom', 't-s'), col(bar(38, 'brass', 6), style='flex: 1'), gap=12),
           row(btn('Cancel', 'sec', style='flex: 1'), btn('Use photo', 'pri', style='flex: 1'), gap=8), gap=12)
camera = col(lbl('Camera'), photo('100%', 300, 18, 'front camera'), row(btn('Cancel', 'sec', style='flex: 1'), btn('Take photo', 'pri', 'camera', style='flex: 1'), gap=8), gap=12)
err_up = col(uploader(), field_err('Camera did not open. Check browser permission or choose Library.'), gap=10)
for nm, blk, ttl in (('Crop', crop, 'Avatar · position & zoom'), ('Camera', camera, 'Avatar · camera'), ('Error', err_up, 'Avatar · camera unavailable')):
    P(f'P14-Avatar-{nm}.dc.html', ttl, people_phone(prof_top('Mykola'), hero(blk, identity('Mykola', 'You', edit='Edit', handle_line='@mykola · member', meta=MY_META[:2])), h=1000 if nm != 'Error' else 844), h=1000 if nm != 'Error' else 844, row_=2)

wsheet = lambda edit: sheet('Edit weight' if edit else 'Add weight', field('Weight', '82.4' if edit else '', '—', state='focus', trail=span('kg', 't-m')),
                            grid(field('Date', '28 Sep 2026', trail=ico('calendar', 16)), field('Time', '07:40', trail=ico('clock', 16)), cols=2),
                            row(btn('Remove', 'txt', 'trash') if edit else '', btn('Save', 'pri', dis=not edit, style='flex: 1'), gap=10), h=380)
P('P14-Weight-Add.dc.html', 'Body · Add weight sheet', people_phone(*me_top(), seg(['Overview', 'Body', 'Settings'], 1), *body_section()[:2], overlay=wsheet(False)), row_=2)
P('P14-Weight-Edit.dc.html', 'Body · Edit weight sheet', people_phone(*me_top(), seg(['Overview', 'Body', 'Settings'], 1), *body_section()[:2], overlay=wsheet(True)), row_=2)

assign_tr = sheet('Who trains Anna?', txt('A trainer gets read access to sessions, progress and programs — nothing else, and no ability to change them.', 't-s'),
                  lst(li('Oleh', '3 clients', avatar('O', 34), radio(True)), li('Mykola', '0 clients', avatar('M', 34), radio(False)), li('Marek', '0 clients', avatar('M', 34), radio(False)),
                      li('No trainer', "Only you can see this member's data", None, radio(False))), h=560,
                  footer=row(btn('Cancel', 'sec', style='flex: 1'), btn('Assign', 'pri', style='flex: 1'), gap=8))
assign_tr_err = sheet('Who trains Anna?', txt('A trainer gets read access to sessions, progress and programs — nothing else, and no ability to change them.', 't-s'),
                  lst(li('Oleh', '3 clients', avatar('O', 34), radio(False)), li('Mykola', '0 clients', avatar('M', 34), radio(True)), li('Marek', '0 clients', avatar('M', 34), radio(False)),
                      li('No trainer', "Only you can see this member's data", None, radio(False))), field_err('Error'), h=600,
                  footer=row(btn('Cancel', 'sec', style='flex: 1'), btn('Assign', 'pri', style='flex: 1'), gap=8))
P('P14-Assign-Trainer-Error.dc.html', 'Assign trainer sheet · save failed', people_phone(prof_top('Anna', back=True), access_block(), role='admin', active='users', overlay=assign_tr_err), row_=2)
P('P14-Assign-Trainer.dc.html', 'Assign trainer sheet (Admin)', people_phone(prof_top('Anna', back=True), access_block(), role='admin', active='users', overlay=assign_tr), row_=2)
assign_cl = sheet('Clients for Oleh', txt('Pick the people this trainer should see. A trainer can coach members, admins, or another trainer, but never themselves.', 't-s'),
                  lst(li('Anna', 'Oleh', avatar('A', 34), toggle(True)), li('Iryna', 'Oleh', avatar('I', 34), toggle(True)), li('Marek', 'No trainer', avatar('M', 34), toggle(False)),
                      li('Mykola', 'No trainer', avatar('M', 34), toggle(False))), h=580,
                  footer=row(btn('Cancel', 'sec', style='flex: 1'), btn('Assign', 'pri', style='flex: 1'), gap=8))
P('P14-Assign-Clients.dc.html', 'Assign clients sheet (Admin, trainer profile)', people_phone(prof_top('Oleh', back=True), access_block(False), role='admin', active='users', overlay=assign_cl), row_=2)


def phys(sex='male', picked=None, seg_=True, remove=False):
    """PhysiquePicker: real archetype figures (public/physiques/<id>.png, <id>-lit.png for the picked one), 2-col phys-grid."""
    ids = {'male': [('v-taper', 'V-Taper', 'Wide shoulders, tight waist'), ('classic', 'Classic', 'Balanced, symmetrical mass'), ('powerbuilder', 'Powerbuilder', 'Size built on the big lifts'), ('lean-athlete', 'Lean Athlete', 'Conditioned and defined')],
           'female': [('hourglass', 'Hourglass', 'Shoulders & glutes, tight waist'), ('glute-focus', 'Glute Focus', 'Lower-body led'), ('toned-lean', 'Toned & Lean', 'Defined and light'), ('strong-athlete', 'Strong Athlete', 'Built to perform')]}[sex]
    cards = []
    for k, n, b in ids:
        on = picked == k
        fig = img(f'physiques/{k}{"-lit" if on else ""}.png', 86, 200, 0, fit='contain', alt=n)
        cards.append(card(rel(col(fig, style='align-items: center'), abs_(span(ico('check', 18, w=2.4), 'c-brass'), 'top: -2px; right: -2px') if on else ''),
                          txt(n, 't-s' + (' c-brass' if on else ''), 'text-align: center; margin-top: 6px'), txt(b, 't-m', 'text-align: center'),
                          tone='glass' if on else '', gap=2, style='padding: 12px 12px 14px'))
    head = row(ibtn('back', 'Back', sm=True), txt('Physique target', 't-h2', 'flex: 1'), btn('Remove', 'txt', style='height: 32px') if remove else '', gap=8)
    body = [head, txt("Pick the shape you're building toward — it seeds your muscle focus, which you can tune afterwards.", 't-s')]
    if seg_:
        body.append(seg(['Male', 'Female'], 0 if sex == 'male' else 1))
    body.append(grid(*cards, cols=2, gap=11))
    return sheet(None, *body, h=900 if seg_ else 850, footer=btn('Use this target', 'pri', full=True, dis=picked is None))


goals_bg = [header('Goals', back=True), card(lbl('Physique target'), txt('Not set', 't-s'))]
P('P14-Physique.dc.html', 'PhysiquePicker · no sex on account (Goals)', phone(gym_head(), *goals_bg, tabs=None, overlay=phys(), h=960), h=960, row_=2)
P('P14-Physique-Picked.dc.html', 'PhysiquePicker · female account, target set', phone(gym_head(), *goals_bg, tabs=None, overlay=phys('female', 'glute-focus', seg_=False, remove=True), h=960), h=960, row_=2)
P('P14-Physique-Male-Picked.dc.html', 'PhysiquePicker · male, V-Taper picked (lit figure)', phone(gym_head(), *goals_bg, tabs=None, overlay=phys('male', 'v-taper'), h=960), h=960, row_=2)


def install_sheet(mode):
    title, icon, steps = {
        'ios': ('Add to Home Screen', 'phone', [('share', 'Tap Share in the Safari toolbar'), ('plus', 'Scroll and tap “Add to Home Screen”'), ('check', 'Tap Add — Spotter appears on your Home Screen')]),
        'android': ('Install Spotter', 'phone', [('more', 'Tap the browser menu (⋮)'), ('download', 'Tap “Install app” or “Add to Home screen”'), ('check', 'Open Spotter from your app drawer anytime')]),
        'mac': ('Add Spotter to Dock', 'desktop', [('share', 'In Safari: File → Add to Dock'), ('plus', 'Or use Share → Add to Dock')]),
    }[mode]
    st_ = lst(*[li(t_, None, row(span(str(i + 1), 't-h3 num c-brass', 'width: 16px'), tile(ic), gap=8)) for i, (ic, t_) in enumerate(steps)])
    return sheet(None, col(tile(icon, 'brass', lg=True), txt(title, 't-h2', 'text-align: center'), txt('Works offline like a native app.', 't-s', 'text-align: center'), gap=8, style='align-items: center; padding-top: 8px'),
                 st_, btn('Got it', 'pri', full=True), h=480 if mode == 'mac' else 540)


def auth_bg():
    return [row(sp(), lang_full()), col(tile('dumbbell', 'brass', lg=True), txt('Spotter', 't-d1'), txt('Everything you lift, in one place.', 't-s'), gap=10, style='align-items: center; padding-top: 30px'),
            field(None, '', 'Username'), field(None, '', 'Password'), btn('Sign in', 'pri', full=True), btn('Create a shortcut', 'sec', 'phone', full=True)]


for m, nm in (('ios', 'iOS'), ('android', 'Android'), ('mac', 'Mac')):
    P(f'P14-Install-{nm}.dc.html', f'InstallShortcut · guide sheet · {nm}', phone(*auth_bg(), tabs=None, overlay=install_sheet(m)), row_=2)

# ============================================================== ROW 3 · dialogs, header parts, desktop
QUEUE_BODY = '3 changes are still queued. Signing out discards the local queue — sync first if you want to keep them.'
CLEAN_BODY = 'Your log stays on the server and comes back on the next sign-in.'
P('P14-SignOut-Queue.dc.html', 'Sign out? · with queued changes (Apps sheet)', gym_phone(*today_bg(), tabs='apps', overlay=shell_sheet('member') + dialog('Sign out?', QUEUE_BODY, 'Sign out', 'Cancel', top=230)), row_=3)
P('P14-SignOut-Clean.dc.html', 'Sign out? · clean (Me · Settings)', people_phone(*me_top(), seg(['Overview', 'Body', 'Settings'], 2), access_block(), overlay=dialog('Sign out?', CLEAN_BODY, 'Sign out', 'Cancel', top=280)), row_=3)

board('P14-Header-Parts.dc.html', 'Header parts: MasteryBadge, bell, language, notices, update, sync', 1600, 1000, spec('Shell parts',
    cap('App header · Gym', f'<div class="card" style="width: 390px">{gym_head(3)}</div>', f'<div class="card" style="width: 390px">{gym_head(0, calib=True)}</div>'),
    cap('App header · People (role label)', *[f'<div class="card" style="width: 390px">{people_head(r, 3 if r != "admin" else 12)}</div>' for r in ('member', 'trainer', 'admin')]),
    cap('MasteryBadge', row(col(mastery(), txt('header', 't-m'), gap=6, style='align-items: center'), col(mastery(True), txt('calibrating', 't-m'), gap=6, style='align-items: center'),
                            col(ring(64, 38, 'brass', 3, span(ico('star', 16), 'c-brass')), txt('640', 't-s num'), txt('rail', 't-m'), gap=4, style='align-items: center'),
                            col(ring(0, 38, 'neutral', 3, span(ico('shield', 16), 'c-dim')), txt('···', 't-s num'), txt('rail · calibrating', 't-m'), gap=4, style='align-items: center'), gap=22)),
    cap('Notifications bell', row(bell(0), bell(3), bell(12), gap=22)),
    cap('LanguageSelector', row(lang_compact(), lang_full(), gap=16)),
    cap('NoticeStrip · every kind', col(notice('layers', 'Oleh assigned you the program “Upper/Lower 4×”.'), notice('layers', 'Oleh replaced your active program with “Upper/Lower 4×”.'),
                                        notice('shield', 'Your role was changed to trainer.'), notice('dumbbell', 'Oleh is now your trainer.'), notice('dumbbell', 'Your trainer was removed.'),
                                        notice('dumbbell', 'Anna was assigned to you as a client.'), notice('dumbbell', 'Anna is no longer your client.'), notice('dumbbell', 'You have a new notice.'), gap=6, style='width: 390px')),
    cap('UpdatePlate', f'<div style="width: 390px">{update_plate()}</div>'),
    cap('SyncBlockedCard', f'<div style="width: 390px">{sync_blocked()}</div>'),
    w=1600, h=1000), row_=3)


# ---- desktop: App.tsx Rail (admin gets Settings) and RosterApp AppRail
def ri(icon, label='', on=False, badge_=None):
    b = abs_(badge(badge_), 'top: 2px; right: 0') if badge_ else ''
    return f'<button class="ri{" on" if on else ""}" style="position: relative">{ico(icon, 20)}{f"<span>{label}</span>" if label else ""}{b}</button>'


def gym_rail(active='today', admin=False, unread=3):
    nav = ''.join(ri(i, l, k == active) for k, l, i in [('today', 'Today', 'home'), ('overview', 'Overview', 'progress'), ('gyms', 'Gyms', 'pin')])
    foot = (col(ring(64, 38, 'brass', 3, span(ico('star', 16), 'c-brass')), span('640', 't-m num'), gap=2, style='align-items: center') + ri('bell', badge_=str(unread) if unread else None) + ri('grid')
            + (ri('gear', 'Settings') if admin else '') + f'<button class="ri"><span>{FLAG}</span><span>English</span></button>'
            + rel(avatar('M', 36), abs_(dot('ok'), 'right: 0; bottom: 0')))
    return f'<div class="rail">{tile("dumbbell", "brass", lg=True)}{sp(h=10)}{nav}<div style="flex: 1"></div>{foot}</div>'


def people_rail(role='admin', active='me', unread=3):
    items = PEOPLE_NAV[role][:-1]
    nav = ''.join(ri(i, l, k == active) for k, l, i in items)
    foot = ri('bell', badge_=str(unread) if unread else None) + ri('grid') + f'<button class="ri">{FLAG}</button>' + avatar('M', 36)
    return f'<div class="rail">{tile("dumbbell", "brass", lg=True)}{sp(h=10)}{nav}<div style="flex: 1"></div>{foot}</div>'


def dframe(rail_, content, mood='art', h=900, skin=''):
    return f'<div class="scr{mood_cls(mood, skin)}" style="width: 1440px; height: {h}px">{rail_}<div style="position: absolute; left: 76px; right: 0; top: 0; bottom: 0; padding: 28px 40px; display: flex; flex-direction: column; gap: 18px">{content}</div></div>'


board('P14-Desktop-Settings.dc.html', 'Desktop · Settings (Admin rail)', 1440, 900, dframe(gym_rail('today', admin=True), col(*settings_body(), gap=18, style='max-width: 720px')), row_=3)
board('P14-Desktop-Settings-Night.dc.html', 'Desktop · Settings · night', 1440, 900, dframe(gym_rail('today', admin=True), col(sleephero(), *settings_body(), gap=18, style='max-width: 720px'), mood='sky'), row_=3)
board('P14-Desktop-Notifications.dc.html', 'Desktop · Notifications (Member rail)', 1440, 1100,
      desktop(row(col(notif_head(), *FEED, gap=14, style='flex: 1; max-width: 640px'), col(recap_block(), style='width: 380px'), gap=32, align='flex-start'), active='', h=1100), row_=3)
board('P14-Desktop-Me.dc.html', 'Desktop · Me (People app, Admin AppRail)', 1440, 1400,
      desktop(row(col(*me_top('admin'), gap=14, style='width: 420px'), col(seg(['Overview', 'Body', 'Settings'], 0), *overview(), gap=14, style='flex: 1'), gap=32, align='flex-start'),
              active='me', h=1400, items=PEOPLE_NAV['admin'][:-1]), row_=3)
board('P14-Desktop-Me-Night.dc.html', 'Desktop · Me · night (People: moon)', 1440, 900,
      desktop(row(col(*me_top('admin'), gap=14, style='width: 420px'), col(seg(['Overview', 'Body', 'Settings'], 0), *overview()[:1], gap=14, style='flex: 1'), gap=32, align='flex-start'),
              active='me', items=PEOPLE_NAV['admin'][:-1], skin='roster', mood='moon'), row_=3)
board('P14-Desktop-Profile-Overlay.dc.html', 'Desktop · own profile from the Gym rail avatar (overlay, not embedded)', 1440, 1400,
      dframe(gym_rail('today'), row(col(*me_top('member', embedded=False), gap=14, style='width: 420px'),
                                    col(seg(['Overview', 'Body', 'Settings'], 0), *overview(), gap=14, style='flex: 1'), gap=32, align='flex-start'), h=1400), row_=3)
print('ok')
