"""P15 · Auth & onboarding — 1:1 translation of views/AuthView.tsx (S-01), views/OnboardingView.tsx (O-01…O-09: landing,
4 steps, ready, dead link, reset link, skeleton), components/AvatarUploader.tsx (step 2), views/InstallShortcut.tsx and the
member body-metrics gate (components/BodyMetrics.tsx · ProfileCompletionGate, App.tsx needsBodySetup). Copy = en.ts.
See fidelity/P15.md."""
from kit import *

import glob as _glob, os as _os
for _f in _glob.glob(_os.path.join(OUT, 'P15-*.dc.html')):
    _os.remove(_f)

FLAG = '🇬🇧'


def abs_(inner, css):
    return f'<div style="position: absolute; {css}">{inner}</div>'


def rel(inner, *badges, style=''):
    return f'<div style="position: relative; {style}">{inner}{"".join(badges)}</div>'


def lang_full():
    return chip(f'{FLAG} English {ico("down", 14)}')


def field_err(msg):
    return row(span(ico('warn', 16), 'c-bad'), txt(msg, 't-s c-bad'), gap=6)


def mark(s=48):
    """SpotterMark: the real glyph on its light brass plate (public/brand/v2/icon-192.png)."""
    return img('brand/v2/icon-192.png', s, s, 12 if s < 60 else 20, alt='Spotter')


def install_btn():
    return btn('Create a shortcut', 'sec', 'phone', full=True)


def scr(*content, h=844, mood='art', overlay=''):
    return phone(*content, tabs=None, h=h, mood=mood, overlay=overlay)


# ============================================================== AuthView
def auth(state='idle', user='', pw=''):
    parts = [row(sp(), lang_full()),
             col(mark(88), txt('Spotter', 't-d1', 'margin-top: 14px'), txt('Everything you lift, in one place.', 't-s'), gap=6, style='align-items: center; padding: 26px 0 8px')]
    form = []
    if state == 'unreachable':
        parts.append(card(row(span(ico('cloudoff', 18), 'c-bad'), txt("Can't reach the server. The first sign-in needs a connection — offline logging works after that.", 't-s', 'flex: 1'), gap=10, align='flex-start'), tone='danger', style='padding: 12px 14px'))
    form.append(field(None, user, 'Username'))
    form.append(field(None, pw, 'Password', state='err' if state == 'error' else ''))
    if state == 'locked':
        form.append(card(row(span(ico('lock', 18), 'c-bad'), txt('Too many failed attempts. Try again in 15 minutes.', 't-s', 'flex: 1'), txt('14:52', 't-h3 num'), gap=10), tone='danger', style='padding: 10px 12px'))
    if state == 'error':
        form.append(field_err('Wrong username or password'))
    dis = state in ('unreachable', 'locked', 'busy')
    form.append(btn('Signing in…' if state == 'busy' else 'Sign in', 'pri', full=True, dis=dis, style='margin-top: 4px'))
    if state == 'unreachable':
        form.append(btn('Retry', 'sec', 'rotate', full=True, sm=True))
    parts.append(card(*form, tone='hero', gap=12, style='padding: 18px'))
    parts.append(install_btn())
    parts.append(txt('New here? Ask your admin for an invite link.', 't-m', 'text-align: center'))
    return parts


P('P15-Auth.dc.html', 'Sign in', scr(*auth()), row_=0)

# ============================================================== Onboarding
INVITER = 'Marek'
STEPS = ['', 'Who you are', 'Your face', 'Your gym', 'Your body']


def top(back=True):
    return row(ibtn('back', 'Back', 'fill', sm=True) if back else '', sp(), lang_full(), style='min-height: 44px')


def bars(upto):
    return row(*[f'<div style="flex: 1">{bar(100 if i <= upto else 0, "brass", 5)}</div>' for i in range(1, 5)], gap=6)


def rail(step):
    return col(bars(step), row(lbl(f'Step {step} of 4'), sp(), lbl(STEPS[step], 'brass')), gap=8)


def cont(dis=False):
    return btn(f'Continue {ico("chev", 18)}', 'pri', full=True, dis=dis)


def landing():
    return [top(False), sp(h=150), card(mark(48),
                             txt("Four steps and you're lifting.", 't-d1'),
                             txt('Account, photo, gym, body numbers. Under two minutes — then your first real session.', 't-b c-mut'),
                             bars(1),
                             btn(f'Start {ico("chev", 18)}', 'pri', full=True),
                             install_btn(),
                             txt('Link valid until 5 Oct · one use', 't-m', 'text-align: center'),
                             row(avatar('M', 40), txt(f'{INVITER} invited you to Spotter and already set up your profile.', 't-s', 'flex: 1'), gap=12),
                             tone='quiet', gap=16, style='padding: 0 4px')]


P('P15-Onb-Landing.dc.html', 'Onboarding · landing (invite link)', scr(*landing()), row_=0)


def who(first='Mykola', last='', user='mykola', pw='', err=None, prefilled=True, ready=False):
    parts = [rail(1), txt("Let's get your name on the account.", 't-h1'),
             field(None, first, 'First name'), field(None, last, 'Last name'), field(None, user, 'Username'),
             field(None, pw, 'Password (min. 6 characters)', state='err' if err else ('focus' if not pw else ''))]
    if err:
        parts.append(field_err(err))
    if prefilled:
        parts.append(card(row(span(ico('check', 16), 'c-ok'), txt("Name came from your invite — change it if it's wrong", 't-s', 'flex: 1'), gap=8), tone='ok', style='padding: 10px 12px'))
    parts.append(cont(dis=not ready))
    return [top(), card(*parts, tone='quiet', gap=14, style='padding: 8px 4px')]


P('P15-Onb-Who.dc.html', 'Onboarding · step 1 · who you are', scr(*who()), row_=0)


def face(state='idle'):
    parts = [rail(2), txt('A photo, so your trainer knows you.', 't-h1')]
    if state in ('idle', 'error'):
        ring_ = rel(f'<span class="av" style="width: 150px; height: 150px">{ico("plus", 36)}</span>', abs_(ibtn('camera', 'Change photo', 'pri', sm=True), 'right: 2px; bottom: 4px'))
        parts += [col(ring_, style='align-items: center; padding: 6px 0'),
                  row(btn('Camera', 'sec', 'camera', style='flex: 1'), btn('Library', 'sec', 'image', style='flex: 1'), gap=8)]
        if state == 'error':
            parts.append(field_err('JPEG, PNG, HEIC or WebP only'))
        parts += [txt('Cropped to a square, stored on your hub, visible to you, your admin and your trainer.', 't-m', 'text-align: center'),
                  cont(), btn('Skip — use my initials', 'txt', style='align-self: center')]
    elif state == 'crop':
        parts += [lbl('Position your photo'), col(photo(260, 260, 130, ''), style='align-items: center'),
                  txt('Drag the photo to frame it. Use zoom for a tighter crop.', 't-s', 'text-align: center'),
                  row(txt('Zoom', 't-s'), col(bar(42, 'brass', 6), style='flex: 1'), gap=12),
                  row(btn('Cancel', 'sec', style='flex: 1'), btn('Use photo', 'pri', style='flex: 1'), gap=8)]
    elif state == 'camera':
        parts += [lbl('Camera'), photo('100%', 320, 18, 'front camera'),
                  row(btn('Cancel', 'sec', style='flex: 1'), btn('Take photo', 'pri', 'camera', style='flex: 1'), gap=8)]
    elif state == 'toobig':
        ring_ = f'<span class="av" style="width: 150px; height: 150px">{ico("plus", 36)}</span>'
        parts += [col(ring_, style='align-items: center; padding: 6px 0'), row(btn('Camera', 'sec', 'camera', style='flex: 1'), btn('Library', 'sec', 'image', style='flex: 1'), gap=8),
                  field_err("That file is 24 MB. Pick something under 10 MB — it's downscaled to 512 px anyway."),
                  txt('Cropped to a square, stored on your hub, visible to you, your admin and your trainer.', 't-m', 'text-align: center'), cont(), btn('Skip — use my initials', 'txt', style='align-self: center')]
    return [top(), card(*parts, tone='quiet', gap=14, style='padding: 8px 4px')]


P('P15-Onb-Face.dc.html', 'Onboarding · step 2 · your face', scr(*face(), h=900), h=900, row_=0)

GYMS = [('Iron Temple', 'Khreshchatyk 22 · 40 m'), ('Iron Yard', 'Marshala Tymoshenka 4 · 180 m'), ('Kachalka na Peremohy', 'Peremohy 24 · 320 m'), ('Smartass Obolon', 'Prospekt Obolonskyi 1B · 1.4 km')]


def gcard(n, s):
    return card(row(photo(110, 76, 12), col(txt(n, 't-h3'), txt(s, 't-m'), gap=3, style='flex: 1; min-width: 0'), gap=12), style='padding: 8px')


def gskel():
    return card(row('<div class="sk" style="width: 110px; height: 76px"></div>', col('<div class="sk" style="width: 70%; height: 14px"></div>', '<div class="sk" style="width: 50%; height: 10px"></div>', gap=8, style='flex: 1'), gap=12), style='padding: 8px')


def gym(state='nearby', q=''):
    parts = [rail(3), txt('Your gym', 't-h1'), txt('Where do you train?', 't-b c-mut'), search('Search for a gym', q)]
    if state == 'denied':
        parts.append(banner('Safari → aA → Website Settings → Location → Allow. Gyms and visit reminders stay off until then.', None, 'brass', 'pin'))
    if state in ('nearby', 'loading'):
        parts.append(row(ico('target', 16), txt('Within 2 km of you', 't-s'), gap=6))
    if state == 'nearby':
        parts += [gcard(*g) for g in GYMS]
    elif state in ('loading', 'searching'):
        parts += [gskel() for _ in range(3)]
    elif state == 'search':
        parts += [gcard('Iron Temple', 'Khreshchatyk 22 · 40 m'), gcard('Iron Yard', 'Marshala Tymoshenka 4 · 180 m')]
    parts.append(btn("Skip — I'll add it later", 'txt', style='align-self: center'))
    return [top(), card(*parts, tone='quiet', gap=12, style='padding: 8px 4px')]


P('P15-Onb-Gym.dc.html', 'Onboarding · step 3 · your gym (nearby)', scr(*gym(), h=900), h=900, row_=0)


def bmf(label, unit, v='', req=False, state=''):
    return field(label + (' <span class="c-brass">*</span>' if req else ''), v, '—', state=state, trail=span(unit, 't-m'))


def body(filled=False):
    parts = [rail(4), txt('A couple of body numbers', 't-h1'), txt('Height and weight power your BMI and weigh-in trend. The rest is optional.', 't-b c-mut'),
             grid(bmf('Height', 'cm', '182' if filled else '', True, 'focus' if not filled else ''), bmf('Current weight', 'kg', '82.4' if filled else '', True), cols=2),
             grid(bmf('Goal', 'kg', '80' if filled else ''), bmf('Body fat', '%'), cols=2),
             bmf('Muscle', 'kg'), cont(dis=not filled)]
    return [top(), card(*parts, tone='quiet', gap=14, style='padding: 8px 4px')]


P('P15-Onb-Body.dc.html', 'Onboarding · step 4 · your body', scr(*body()), row_=0)


def ready(gym_='Iron Temple'):
    kicker = f'Ready · {gym_}' if gym_ else 'Ready'
    c = card(row(span(ico('check', 16), 'c-ok'), lbl(kicker, 'ok'), gap=6),
             row(avatar('M', 76), col(txt('Mykola', 't-h2'), txt(f'Admin · {INVITER}', 't-s'), gap=2), gap=14),
             txt("You're in. Bar's loaded.", 't-d1'),
             txt(f"You're standing in {gym_} right now. Start the session and your first set is thirty seconds away." if gym_ else 'Start the session and your first set is thirty seconds away.', 't-b c-mut'),
             btn('Start training now', 'pri', 'play', full=True), btn('Just take me to the app', 'txt', style='align-self: center'),
             tone='hero', gap=16, style='padding: 22px 18px')
    bg = abs_(photo(390, 520, 0, ''), 'left: 0; top: 0') if gym_ else ''
    return bg, c


bg, c = ready()
P('P15-Onb-Ready.dc.html', 'Onboarding · ready (gym picked)', f'<div class="scr m-ok" style="width: 390px; height: 844px">{bg}<div class="body" style="position: absolute; left: 0; right: 0; bottom: 0; padding-bottom: 28px">{c}</div></div>', row_=0)


def gate(filled=False):
    return scr(row(tile('dumbbell', 'brass'), txt('Spotter', 't-h3'), gap=10),
               sp(h=40),
               col(tile('scale', 'brass', lg=True), txt("Let's finish your profile", 't-d1'),
                   txt('Two fields left so we can calculate BMI and show your progress. Takes a few seconds.', 't-b c-mut'), gap=14),
               card(field('Height', '182' if filled else '', '178', state='' if filled else 'focus', trail=span('cm', 't-m')),
                    field('Current weight', '82.4' if filled else '', '84.0', trail=span('kg', 't-m')), gap=14),
               sp(h=60),
               btn('Done, enter the app', 'pri', full=True, dis=not filled),
               txt('This is setup continuation, not an error. Your data stays private.', 't-m', 'text-align: center'))


P('P15-Body-Gate.dc.html', 'Member · finish your profile (blocking gate)', gate(), row_=0)

# ============================================================== ROW 1 · states
P('P15-Auth-Error.dc.html', 'Sign in · wrong credentials', scr(*auth('error', 'mykola', '••••••••')), row_=1)
P('P15-Auth-Locked.dc.html', 'Sign in · locked 15 min (429)', scr(*auth('locked', 'mykola', '••••••••'), mood='bad'), row_=1)
P('P15-Auth-Unreachable.dc.html', 'Sign in · server unreachable', scr(*auth('unreachable'), mood='bad'), row_=1)
P('P15-Auth-Busy.dc.html', 'Sign in · signing in', scr(*auth('busy', 'mykola', '••••••••')), row_=1)

sk = lambda w, h_: f'<div class="sk" style="width: {w}; height: {h_}px"></div>'
P('P15-Onb-Skeleton.dc.html', 'Onboarding · invite preview loading', scr(top(False), card(sk('48px', 48), sk('90%', 34), sk('70%', 34), sk('100%', 16), sk('80%', 16), bars(1), sk('100%', 52), sk('50%', 12),
                                                                                       row(sk('40px', 40), col(sk('80%', 12), sk('60%', 12), gap=6, style='flex: 1'), gap=12), tone='glass', gap=14, style='padding: 22px 18px')), row_=1)


def dead(requested=False):
    return scr(sp(h=120), card(tile('warn', 'bad', lg=True), txt('This link is no longer valid.', 't-h1'), txt('Invites expire after 7 days and work once. This one ended 21 Sep.', 't-b c-mut'),
                               btn('Requested — your admin will see it in their people list' if requested else 'Request a new link', 'pri', full=True, dis=requested, style='white-space: normal; height: auto; min-height: 48px; padding: 8px 18px'),
                               btn('I already have an account — sign in', 'txt', style='align-self: center'), gap=14, style='padding: 22px 18px'), mood='bad')


P('P15-Onb-Dead.dc.html', 'Invite link expired / used / revoked', dead(), row_=1)
P('P15-Onb-Dead-Requested.dc.html', 'Invite link dead · new link requested', dead(True), row_=1)
P('P15-Onb-Reset.dc.html', 'Password-reset link (single step)', scr(sp(h=160), card(txt('Who you are', 't-h1'), field(None, '•••••••', 'Password (min. 6 characters)', state='focus'), btn('Save', 'pri', full=True), gap=14, style='padding: 22px 18px')), row_=1)
P('P15-Onb-Reset-Error.dc.html', 'Password-reset link · claim failed', scr(sp(h=160), card(txt('Who you are', 't-h1'), field(None, '•••••••', 'Password (min. 6 characters)'), field_err('Error'), btn('Save', 'pri', full=True), gap=14, style='padding: 22px 18px')), row_=1)
P('P15-Onb-Who-Error.dc.html', 'Step 1 · filled, claim failed (no invite name)', scr(*who('Mykola', '', 'mykola', '•••••••', err='Error', prefilled=False, ready=True)), row_=1)
P('P15-Onb-Who-Empty.dc.html', 'Step 1 · empty (Continue disabled)', scr(*who('', '', '', '', prefilled=False)), row_=1)
P('P15-Onb-Face-Crop.dc.html', 'Step 2 · position & zoom', scr(*face('crop'), h=900), h=900, row_=1)
P('P15-Onb-Face-Camera.dc.html', 'Step 2 · camera', scr(*face('camera')), row_=1)
P('P15-Onb-Face-TooBig.dc.html', 'Step 2 · file too big', scr(*face('toobig'), h=960), h=960, row_=1)
P('P15-Onb-Face-Type.dc.html', 'Step 2 · wrong file type', scr(*face('error'), h=940), h=940, row_=1)
P('P15-Onb-Gym-Loading.dc.html', 'Step 3 · locating / nearby loading', scr(*gym('loading'), h=900), h=900, row_=1)
P('P15-Onb-Gym-Denied.dc.html', 'Step 3 · location refused', scr(*gym('denied')), row_=1)
P('P15-Onb-Gym-Search.dc.html', 'Step 3 · search results', scr(*gym('search', 'iron')), row_=1)
P('P15-Onb-Body-Filled.dc.html', 'Step 4 · required filled', scr(*body(True)), row_=1)
_, c2 = ready(None)
P('P15-Onb-Ready-NoGym.dc.html', 'Onboarding · ready (gym skipped)', scr(sp(h=150), c2, mood='ok'), row_=1)
P('P15-Body-Gate-Filled.dc.html', 'Member gate · both fields filled', gate(True), row_=1)

# ============================================================== ROW 3 · desktop
board('P15-Auth-Desktop.dc.html', 'Sign in · desktop (centred 380 px card; .auth-visual is display:none)', 1440, 900,
      f'<div class="scr m-art" style="width: 1440px; height: 900px; display: flex; justify-content: center; align-items: center; padding-bottom: 100px">'
      f'<div style="width: 380px; display: flex; flex-direction: column; gap: 14px">{"".join(auth())}</div></div>', row_=3)
board('P15-Onb-Desktop.dc.html', 'Onboarding · landing · desktop', 1440, 900,
      f'<div class="scr m-art" style="width: 1440px; height: 900px; padding: 30px 40px; display: flex; flex-direction: column; align-items: center">'
      f'<div style="width: 460px; display: flex; flex-direction: column; gap: 14px">{"".join(landing())}</div></div>', row_=3)
print('ok')
