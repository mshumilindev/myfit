"""P12 · Atlas — 1:1 translation of the Atlas coach (views/CoachView.tsx: CoachSetup, DataStep, CoachThread, PlanCard,
CoachSettingsSheet), components/AtlasFace.tsx (face + TemperHeat), AtlasStrip.tsx, AtlasNotesPanel.tsx, AtlasDebrief.tsx,
ChatChart.tsx, atlas/{welcome,chips,notes,style,safety}.ts. Copy = en.ts `atlas*` strings and atlas.en.ts phrase book
(Blunt temper unless a board is about another). See fidelity/P12.md for the board → source map."""
from kit import *

import glob as _glob, os as _os
for _f in _glob.glob(_os.path.join(OUT, 'P12-*.dc.html')):
    _os.remove(_f)

# ============================================================== temper data (atlas/types TEMPERS = 1 · 3 · 5)
TT = {1: 'ok', 3: 'brass', 5: 'atlas'}                    # TEMPER_COLOR: green · yellow · red (red = Atlas coral)
CT = {1: 'ok', 3: 'glass', 5: 'atlas'}                    # card tone tinted in the temper colour (.atl-temper.on, unread bubble)


def portrait(t=3, s=40):
    """AtlasFace: public/atlas/atlas-{temper}.webp, round."""
    return img(f'atlas/atlas-{t}.webp', s, s, r=s // 2, alt='Atlas')

NAME = {1: 'Warm', 3: 'Blunt', 5: 'Merciless'}            # atlasTemper
TAGL = {1: 'your gym bro', 3: 'straight talk, no fluff', 5: 'roasts every lazy set'}   # atlasTemperTag
QUOTE = {1: '“Yo bro, 12 sets in 50 min — beast mode! Now go eat.”',
         3: '“You rushed your rest. That cost you set three.”',
         5: '“Eight sets? I’ve seen warm-ups with more ambition. Your mom does that before coffee.”'}

WELCOME3 = ('Atlas. 86 workouts in your log — I’ve read them. Ask me how Bench press is going, what to train today, why something’s stuck, '
            'or how to do an exercise right. Something hurts — tell me and we’ll sort it out. Forgot an exercise’s name — describe it and I’ll find it. '
            'I’m not a doctor — on pain, medication or health conditions the final word is your doctor’s.')
START_CHIPS = ['What should I train today?', 'How am I doing?', 'How long should I rest?']


# ============================================================== atoms (compose kit only)
def face(t=3, s=40):
    """AtlasFace: the portrait, ring in the temper colour."""
    return ring(100, s + 8, TT[t], 2 if s < 60 else 3, portrait(t, s))


def theat(t=3):
    """TemperHeat: three bars (green · yellow · red, 8/13/18 px) lit up to the temper."""
    cells = [col(bar(100 if k <= t else 0, TT[k], h), style='width: 5px') for k, h in ((1, 8), (3, 13), (5, 18))]
    return row(*cells, gap=3, align='flex-end')


def hl():
    return '<div class="hl"></div>'


def abs_(inner, css):
    return f'<div style="position: absolute; {css}">{inner}</div>'


def bubble(text, t=3, time=None, extra='', unread=False, s=28):
    """Bubble: face 28 + atl-bubble (text · chart · time)."""
    foot = row(dot(TT[t]) if unread else '', sp(), txt(time, 't-m num'), gap=6) if time else ''
    b = card(txt(text, 't-b'), extra, foot, tone=CT[t] if unread else '', style='padding: 10px 14px', gap=6)
    return row(face(t, s), col(b, style='flex: 1; min-width: 0'), gap=8, align='flex-end', style='padding-right: 28px')


def me(text, time='14:02'):
    """atl-me: your message, right."""
    return row(sp(), card(txt(text, 't-b'), row(sp(), txt(time, 't-m num')), style='padding: 10px 14px; max-width: 280px', gap=4))


def replies(*items, on=None):
    """atl-suggest / atl-replies: chips under the bubble."""
    return row(*[chip(x, i == on) for i, x in enumerate(items)], gap=8, wrap=True, style='padding-left: 42px')


def rate():
    """atl-rate: 👍 Helpful · 👎 Not what I asked."""
    return row(ibtn('check', 'Helpful', 'fill', sm=True), ibtn('thumbdown', 'Not what I asked', 'fill', sm=True), gap=6, style='padding-left: 42px')


def day(label):
    return row(sp(), lbl(label), sp(), style='padding: 4px 0')


def newmark(n=2):
    return row('<div class="hl" style="flex: 1"></div>', tag(f'{n} new', 'brass'), '<div class="hl" style="flex: 1"></div>', gap=8)


def notice(text):
    return card(txt(text, 't-s', 'text-align: center'), tone='dash', style='padding: 10px 14px')


def typing(t=3):
    dots = row(dot('neutral'), dot('neutral'), dot('neutral'), gap=5, style='height: 22px')
    return row(face(t, 28), card(dots, style='padding: 8px 14px'), sp(), gap=8, align='flex-end')


def chat_chart(title='Bench press · est. 1RM', a='112 kg', b='117 kg', vals=(112, 112.5, 113, 114, 113.5, 115, 116, 117), d0='17 Aug', d1='28 Sep'):
    """ChatChart: figcaption (title · first → last), sparkline with dots, date axis."""
    return col(row(txt(title, 't-s', 'flex: 1'), txt(f'{a} → {b}', 't-s c-brass num'), gap=8),
               spark(list(vals), 240, 64, 'brass'), row(txt(d0, 't-m'), sp(), txt(d1, 't-m')), gap=6,
               style='padding: 8px 0 2px')


def thead(t=3, role='extra coach', soft=False):
    """atl-head: back · face 38 (opens portrait) · Atlas · temper / role · TemperHeat · settings."""
    sub = role + (' · softer today' if soft else '')
    return row(ibtn('back', 'Back'), face(t, 38),
               col(row(span('Atlas', 't-h3'), span(f'· {NAME[t]}', 't-s'), gap=6), txt(sub, 't-m'), gap=1, style='flex: 1; min-width: 0'),
               theat(t), ibtn('sliders', 'Atlas settings', 'fill', sm=True), gap=8, style='height: 60px; padding: 0 8px 0 4px')


def composer(ph='Ask Atlas about your training…', value='', can_send=False):
    send = ibtn('up', 'Send', 'pri' if can_send else 'fill')
    return row(col(field(value=value, ph=ph), style='flex: 1; min-width: 0'), send, gap=8)


def dock(inner):
    return abs_(inner, 'left: 16px; right: 16px; bottom: 18px')


def brand():
    return brandbar()


def coach_phone(*feed, t=3, role='extra coach', soft=False, h=844, overlay='', mood='art', comp=None, top=''):
    """The coach overlay: app brand header (App.tsx renders it over every overlay) · atl-head · feed · composer. No tab bar."""
    body = [brand()]
    if mood == 'sky':
        body.append(sleephero())
    body += [thead(t, role, soft), *feed, sp(h=70)]
    return phone(*body, tabs=None, h=h, overlay=dock(comp or composer()) + overlay, mood=mood, top=top)


def setup_phone(*content, h=844, overlay=''):
    """CoachSetup: app brand · atl-top back · step body."""
    return phone(brand(), row(ibtn('back', 'Back'), style='height: 44px; margin: -6px 0 0 -8px'), *content, tabs=None, h=h, overlay=overlay)


def cta(t_, kind='pri'):
    return btn(t_, kind, full=True)


# ============================================================== notes (atlas.en.ts · Blunt)
N_INTRO = 'Atlas. Read your 86 sessions. I’ll call it like I see it on every workout from here.'
N_SESSION = '18 sets, 58 min. Fine.'
N_PR = 'Bench press 100 kg. A record. Do it again and I’ll believe it.'
N_STALL = 'Squat: 140 kg, 3 times in a row. Stuck. Add a rep.'
N_REST = 'You rested 1:12. It should’ve been 2:30. That’s the whole story.'
N_IMB = 'Chest: 14 sets. Back: 8. Fix it.'
N_STREAK = '6 weeks in a row. Keep it.'
N_BW = 'Bodyweight 82.4 kg, −0.4% over 2 weeks.'


def feed_extra():
    return [day('Yesterday'), bubble(N_SESSION, time='19:48'), bubble(N_STALL, time='19:48'), bubble(N_REST, time='19:49'),
            day('Today'), newmark(2), bubble(N_PR, time='09:12', unread=True), bubble(N_IMB, time='09:12', unread=True)]


# ============================================================== ROW 0 · setup flow
P('P12-Setup-Meet.dc.html', 'Atlas setup · meet', setup_phone(
    col(face(3, 128), txt('Atlas', 't-d1'), txt('One coach who reads every set you log. You choose his temper — from warm to merciless.', 't-b c-mut', 'text-align: center; max-width: 300px'),
        row(face(1, 40), face(3, 40), face(5, 40), gap=12, justify='center'), gap=14, style='align-items: center; padding-top: 60px'),
    sp(h=40), cta('Choose his temper'), cta('Not now', 'sec')), row_=0)


def temper_row(i, on):
    return card(row(col(bar(100, TT[i], 44), style='width: 4px'), face(i, 40),
                    col(row(span(NAME[i], 't-h3'), theat(i), gap=8), txt(TAGL[i], 't-s'), txt(QUOTE[i], 't-m'), gap=3, style='flex: 1; min-width: 0'),
                    radio(on), gap=12, align='flex-start'), tone=CT[i] if on else '', style='padding: 12px 14px')


def temper_step(sel=3):
    return setup_phone(txt('Atlas’s temper', 't-h1'), txt('Same coach, same brain — different mouth.', 't-s'),
                       col(*[temper_row(i, i == sel) for i in (1, 3, 5)], gap=10), sp(h=6), cta(f'Train with {NAME[sel]} Atlas'))


P('P12-Setup-Temper.dc.html', 'Atlas setup · temper', temper_step(3), row_=0)


def rule(label, sub, on, locked=False):
    return li(label, sub, None, row(ico('lock', 16) if locked else '', toggle(on), gap=8))


P('P12-Setup-Fine.dc.html', 'Atlas setup · Merciless fine print', setup_phone(
    col(face(5, 84), txt('He will be rude.', 't-h1', 'text-align: center'),
        txt('Merciless Atlas roasts lazy sets, short rest and skipped days — hard, on the edge of bullying. That’s the point. He never touches your body, and backs off when you’re hurt or ill.', 't-s', 'text-align: center'),
        gap=12, style='align-items: center; padding-top: 8px'),
    lst(rule('“Your mom” jokes', 'The classics', True), rule('Swearing', 'Proper swearing, no slurs', False)),
    sp(h=20), cta('I can take it'), cta('Pick a softer temper', 'sec')), row_=0)


def role_card(title, sub, on, dis=False):
    return card(txt(title, 't-h3' + (' c-dim' if dis else '')), txt(sub, 't-s'), tone=CT[3] if on else ('dash' if dis else ''), style='padding: 14px 16px', gap=4)


def role_step(human=False):
    return setup_phone(sp(h=6), bubble('Am I running your programme — or are you keeping someone else and letting me watch?'),
                       role_card('Main coach', 'You have a coach — he runs the programme, so Atlas can only be the extra coach.' if human else 'Atlas writes the programme and rewrites it every Sunday.', not human, dis=human),
                       role_card('Extra coach', 'Keep your coach or your own plan. Atlas only watches, grades and comments.', human),
                       sp(h=6), cta('Next'))


P('P12-Setup-Role.dc.html', 'Atlas setup · role', role_step(False), row_=0)


def kv(rows_):
    return lst(*[li(k, None, None, span(v, 'c-bad' if v == 'missing' else 'num')) for k, v in rows_])


KV = [('Sessions', '86'), ('Bodyweight', '82.4 kg'), ('Sex', 'missing'), ('Year of birth', 'missing'), ('Height', 'missing')]


def data_step(ask, rows_=KV):
    return setup_phone(sp(h=4), bubble('Here is what I know — and what the app never got told:'), kv(rows_), *ask,
                       txt('Skip anything — Atlas plans with what he has.', 't-m', 'text-align: center'), cta('Next'), h=900)


P('P12-Setup-Data.dc.html', 'Atlas setup · what I know · sex', data_step(
    [bubble('Sex. It shifts the strength standards, nothing else.'), replies('Male', 'Female', 'Skip')]), row_=0, h=900)

P('P12-Setup-Push.dc.html', 'Atlas setup · notifications', setup_phone(
    col(face(3, 96), txt('Let Atlas reach you', 't-h1', 'text-align: center'),
        txt('Skipped days, the Sunday review, the end of rest. Nothing else. Change it any time.', 't-b c-mut', 'text-align: center; max-width: 300px'),
        gap=14, style='align-items: center; padding-top: 70px'),
    sp(h=60), cta('Turn on notifications'), cta('Not now', 'sec')), row_=0)

# ============================================================== ROW 0 · thread
P('P12-Thread.dc.html', 'Atlas chat · notes feed · extra coach', coach_phone(*feed_extra(), h=880), row_=0, h=880)

P('P12-Welcome.dc.html', 'Atlas chat · empty chat welcome', coach_phone(
    day('Today'), bubble(N_INTRO, time='08:02'), bubble(WELCOME3), replies(*START_CHIPS),
    comp=composer(value='How is my bench going?', can_send=True), h=900), row_=0, h=900)


def plan_card(week=2, of=4, days=4, deload=False, done=False):
    """PlanCard: kicker · block bar · weekdays · meta + Rewrite / Start a new block."""
    kick = 'BLOCK DONE' if done else f'BLOCK · WEEK {week} OF {of} · {days} DAYS' + (' · LIGHTER WEEK' if deload else '')
    segs = row(*[col(bar(100 if (done or i + 1 < week) else (100 if i + 1 == week else 0), 'ok' if (done or i + 1 < week) else 'brass', 5), style='flex: 1') for i in range(of)], gap=5)
    DAYS = [('Mon', 'Upper body', 'Chest · Back · Shoulders · Triceps', True), ('Tue', 'Lower body', 'Quads · Hamstrings · Glutes · Calves', False),
            ('Thu', 'Upper body', 'Back · Chest · Biceps · Shoulders', False), ('Sat', 'Lower body', 'Hamstrings · Quads · Glutes · Core', False)]
    rows_ = [li(span(n, 't-h3'), m, span(wd, 't-s num', 'width: 34px'), tag('Today', 'brass') if today else '') for wd, n, m, today in DAYS]
    meta = row(txt('~60 min a session · warm-up first', 't-s', 'flex: 1'), btn('Start a new block' if done else 'Rewrite', 'txt', sm=True, style='height: 32px'), gap=8)
    return card(lbl(kick, 'brass'), segs, lst(*rows_), meta, tone='hero', gap=10)


P('P12-Thread-Main.dc.html', 'Atlas chat · main coach · programme', coach_phone(
    plan_card(), *feed_extra(), role='main coach', h=1200), row_=0, h=1200)

# answer with chart + rating + follow-up chips
P('P12-Answer.dc.html', 'Atlas chat · answer · chart · rating · follow-ups', coach_phone(
    day('Today'), bubble(N_PR, time='09:12'), me('How is my Bench press going?', '14:02'),
    bubble('Bench press: est. 1RM 112 → 117 kg over 6 weeks, top set 100 kg × 5 today. It moves.', time='14:02', extra=chat_chart()),
    rate(), replies('Bench press: what weight next time?', 'Bench press: technique tips?', 'Bench press: warm-up sets?'),
    comp=composer(value='', can_send=False), h=900), row_=0, h=900)

# ============================================================== ROW 1 · setup states
P('P12-Setup-Temper-Merciless.dc.html', 'Atlas setup · temper · Merciless picked', temper_step(5), row_=1)

years = row(chip('', icon='back'), *[chip(str(y)) for y in (1994, 1995, 1996, 1997, 1998)], chip('', icon='chev'), gap=6, wrap=True, style='padding-left: 42px')
P('P12-Setup-Data-Birth.dc.html', 'Atlas setup · what I know · year of birth', data_step(
    [bubble('Year of birth. Recovery depends on it.'), years, replies('Skip')], rows_=[('Sessions', '86'), ('Bodyweight', '82.4 kg'), ('Sex', 'Male'), ('Year of birth', 'missing'), ('Height', 'missing')]), row_=1, h=900)

hstep = row(chip('−'), span('178 cm', 't-h2 num'), chip('+'), gap=14, style='padding-left: 42px')
P('P12-Setup-Data-Height.dc.html', 'Atlas setup · what I know · height', data_step(
    [bubble('Height, in centimetres.'), hstep, replies('Save', 'Skip', on=0)], rows_=[('Sessions', '86'), ('Bodyweight', '82.4 kg'), ('Sex', 'Male'), ('Year of birth', '1996'), ('Height', 'missing')]), row_=1, h=900)

P('P12-Setup-Data-Complete.dc.html', 'Atlas setup · what I know · nothing missing', data_step(
    [], rows_=[('Sessions', '86'), ('Bodyweight', '82.4 kg'), ('Sex', 'Male'), ('Year of birth', '1996'), ('Height', '178 cm')]), row_=1, h=900)

P('P12-Setup-Role-HumanCoach.dc.html', 'Atlas setup · role · you have a coach', role_step(True), row_=1)

P('P12-Setup-Push-Install.dc.html', 'Atlas setup · notifications · iPhone needs install', setup_phone(
    col(face(3, 96), txt('Let Atlas reach you', 't-h1', 'text-align: center'),
        txt('Skipped days, the Sunday review, the end of rest. Nothing else. Change it any time.', 't-b c-mut', 'text-align: center; max-width: 300px'),
        txt('Add Spotter to your Home Screen first (Share → Add to Home Screen) — iPhone only allows notifications there.', 't-s', 'text-align: center; max-width: 310px'),
        gap=14, style='align-items: center; padding-top: 60px'),
    sp(h=50), cta('Not now', 'sec')), row_=1)

P('P12-Setup-Push-Denied.dc.html', 'Atlas setup · notifications · blocked', setup_phone(
    col(face(3, 96), txt('Let Atlas reach you', 't-h1', 'text-align: center'),
        txt('Skipped days, the Sunday review, the end of rest. Nothing else. Change it any time.', 't-b c-mut', 'text-align: center; max-width: 300px'),
        txt('Notifications are blocked for Spotter. Allow them in the phone’s settings.', 't-s c-bad', 'text-align: center; max-width: 310px'),
        gap=14, style='align-items: center; padding-top: 60px'),
    sp(h=50), cta('Turn on notifications'), cta('Not now', 'sec')), row_=1)

# ============================================================== ROW 1 · thread states
P('P12-Thread-Typing.dc.html', 'Atlas chat · thinking, then typing', coach_phone(
    day('Today'), bubble(N_IMB, time='09:12'), me('What should I train today?', '14:05'), typing(),
    me('And tomorrow?', '14:06'),
    row(face(3, 28), card(txt('Tomorrow is Lower body: squat first, then', 't-b'), style='padding: 10px 14px'), sp(), gap=8, align='flex-end', style='padding-right: 28px'),
    comp=composer(value='', can_send=False), h=844), row_=1)

P('P12-Action.dc.html', 'Atlas chat · proposed action · Do it / Cancel', coach_phone(
    day('Today'), me('Start today’s workout for me', '14:10'),
    bubble('Upper body is on the plan today: bench, row, overhead press, pull-ups, triceps — about 60 min. Start it?', time='14:10'),
    replies('Do it', 'Cancel', on=0),
    h=844), row_=1)

P('P12-DidYouMean.dc.html', 'Atlas chat · did you mean · rated down', coach_phone(
    day('Today'), me('how heavy tmrw', '14:12'),
    bubble('Not sure I got that. Did you mean:', time='14:12'), replies('Bench press: what weight next time?', 'What should I train tomorrow?', 'How long should I rest?'),
    me('Bench press: what weight next time?', '14:12'),
    bubble('Bench press: 100 kg × 5 went clean. Next time 102.5 kg × 5.', time='14:12'),
    bubble('Got it — not that. Which one did you mean?', time='14:13'), replies('What should I train tomorrow?', 'My 1RM on Bench press?'),
    h=1000), row_=1, h=1000)

P('P12-Puter.dc.html', 'Atlas chat · Gemini out · Puter offer', coach_phone(
    day('Today'), me('Is it fine to train chest two days in a row?', '15:20'),
    bubble('Gemini is out for today. I can keep talking through Puter — it runs on your own free Puter account, so it costs you nothing and the app nothing. One sign-in.', time='15:20'),
    replies('Use Puter', 'Not now', on=0),
    notice('Gemini’s free limit is used up. Until 02:00 Atlas answers from his own knowledge — or through Puter, on your own free Puter account.'),
    h=900), row_=1, h=900)

P('P12-OffTopic.dc.html', 'Atlas chat · off-topic guard · blocked', coach_phone(
    day('Today'), me('Who won the match yesterday?', '14:01'),
    bubble('Not talking about that. I’m a coach. ChatGPT is for that. Again — and it’s a 30-minute block.', time='14:01'),
    me('Any good films this week?', '14:03'),
    bubble('Second warning. Training only. The rest — ChatGPT. Third time — 30-minute block.', time='14:03'),
    me('What’s the weather tomorrow?', '14:05'),
    bubble('Third time. Blocked for 30 minutes, until 14:35.', time='14:05'),
    me('ok, what about bench?', '14:08'),
    bubble('Atlas is quiet until 14:35 — three times the talk wasn’t about training. If it’s something serious with your health or something hurts, write — that I always answer.', time='14:08'),
    comp=composer(ph='Atlas is quiet until 14:35…'), h=1180), row_=1, h=1180)

P('P12-Safety.dc.html', 'Atlas chat · safety net (every temper, plain)', coach_phone(
    day('Today'), me('Chest pain and I can’t catch my breath on the stairs', '18:40'),
    bubble('Stop training right now. Chest pain or pressure — especially with shortness of breath, sweating, nausea, or pain spreading to the arm, neck or jaw — needs a doctor immediately: call emergency services (112 / 911). Don\'t "push through" or drive yourself.', time='18:40'),
    me('I hate my body', '21:15'),
    bubble('That sounds heavy, and I’m not going to joke about it. How you look doesn’t decide your worth — and for the record, you keep showing up, which is the hard part. If these thoughts stick around, it’s worth talking to someone you trust or a professional. Want to focus on something that makes you feel strong?', time='21:15'),
    replies('What are my best lifts?', 'How do I lose fat safely?'),
    t=5, h=1100), row_=1, h=1100)

P('P12-Thread-Softened.dc.html', 'Atlas chat · Merciless, softer today (injury)', coach_phone(
    day('Today'), bubble('18 sets, 58 min. Fine.', t=3, time='19:48'), bubble('5 h of sleep. Lighter today.', t=3, time='07:30', unread=True),
    t=3, soft=True, h=844), row_=1)

P('P12-Thread-Night.dc.html', 'Atlas chat · night mode', coach_phone(*feed_extra(), mood='sky', h=960), row_=1, h=960)

P('P12-Thread-Older.dc.html', 'Atlas chat · older messages load on scroll up', coach_phone(
    skel_rows(2), day('Fri, 25 Sep'), bubble(N_STREAK, time='20:10'), bubble(N_BW, time='20:10'), *feed_extra()[:4], h=920), row_=1, h=920)

# ============================================================== ROW 1 · spec boards
def reply_state(label, *inner):
    return cap(label, *inner, w=340)


board('P12-Reply-States.dc.html', 'Atlas reply states', 1600, 1000, spec('Atlas chat · every reply state (CoachThread)',
    reply_state('Thinking (pending “…”)', typing()),
    reply_state('Streaming (atl-caret)', row(face(3, 28), card(txt('Squat first, then', 't-b'), style='padding: 10px 14px'), sp(), gap=8, align='flex-end')),
    reply_state('Offline', bubble('No connection. Train now, talk later.', time='14:20')),
    reply_state('Daily cap', bubble('That’s enough talk for today. The bar is waiting.', time='14:20')),
    reply_state('Blocked topic', bubble('Let’s keep this about your training.', time='14:20')),
    reply_state('Error', bubble('I can’t answer that right now. Try again in a minute.', time='14:20')),
    reply_state('Local base: unknown (no chat access)', bubble('That one’s outside what I know yet. Ask me about your training: what to do today, rest, the next weight, records, recovery, sleep, your programme.', time='14:20'),
                replies(*START_CHIPS)),
    reply_state('Rated down, nothing close', bubble('Noted — I won\'t answer that this way again. Try asking in other words.', time='14:21')),
    reply_state('Puter failed', bubble('Couldn\'t reach Puter — I\'ll answer from my own knowledge.', time='14:22')),
    reply_state('Language offer (typed in Ukrainian)', bubble('Switch the app language to Українська? I understand you either way — I just answer in the app’s language.', time='14:23'),
                replies('🇺🇦 Українська', 'No, keep it')),
    reply_state('Language switched', bubble('Done — English from here on.', time='14:23')),
    reply_state('Notice (quota)', notice('Gemini’s free limit is used up. Until 02:00 Atlas answers from his own knowledge — or through Puter, on your own free Puter account.')),
    w=1600, h=1000), row_=1)


def temper_col(t):
    return cap(f'{NAME[t]} · {TAGL[t]}', card(row(face(t, 64), col(row(span(NAME[t], 't-h2'), theat(t), gap=10), txt(TAGL[t], 't-s'), gap=4), gap=14),
                                         txt(QUOTE[t], 't-s'), tone='glass' if t == 3 else ''),
               lbl('Intro note'), bubble({1: 'Yo, what’s up! Atlas here. Went through your 86 sessions — I got you on every one from now. Let’s gooo!',
                                          3: N_INTRO,
                                          5: 'I read your 86 sessions. Had a good laugh. I’ll be here for every workout now — you’ll regret that.'}[t], t=t, time='08:02'),
               lbl('Session note'), bubble({1: 'Let’s go! 18 sets in 58 min — that’s how it’s done, bro. Now eat and chill.', 3: N_SESSION,
                                            5: '18 sets. You call that a workout? I’ve seen warm-ups with more ambition.'}[t], t=t, time='19:48'),
               lbl('Record'), bubble({1: 'LET’S GOOO! Bench press 100 kg × 5 — new PR! You beast!', 3: N_PR,
                                      5: 'Bench press, 100 kg × 5. A “record”. After 97.5 kg, the bar was on the floor.'}[t], t=t, time='19:48'),
               lbl('Welcome (empty chat)'), bubble({1: 'Yo, bro! I’m Atlas — your coach in your pocket. Went through your 86 workouts, so I know what you’ve got going. …',
                                                    3: 'Atlas. 86 workouts in your log — I’ve read them. …',
                                                    5: 'Oh, you found the chat. I’ve seen all 86 of your workouts. All of them. Let’s talk. …'}[t], t=t),
               w=440)


board('P12-Tempers.dc.html', 'Atlas tempers · voice', 1600, 980, spec('Three tempers — same facts, different mouth (atlas.en.ts · welcome.ts)',
    temper_col(1), temper_col(3), temper_col(5),
    cap('“Your mom” lines (Merciless + switch on)', bubble('18 sets. Your mom does more on a Sunday between loads of laundry.', t=5, time='19:48'), w=440),
    cap('Pain, injury, the body — always plain', bubble('Stop the set and sit or lie down with your legs up until it passes; sip water and eat something if you haven\'t …', t=5, time='18:41'), w=440),
    w=1600, h=980), row_=1)

board('P12-Plan-States.dc.html', 'Atlas programme card states', 1600, 640, spec('PlanCard (role = main coach)',
    cap('No programme yet', col(bubble('I’ll write your programme: your days, your length, a lighter last week. Ready?'), replies('Write my programme', on=0), gap=8), w=340),
    cap('Block running · week 2 of 4', plan_card(), w=340),
    cap('Last week · lighter', plan_card(4, 4, deload=True), w=340),
    cap('Block done', plan_card(done=True), w=340),
    w=1600, h=640), row_=1)

# ============================================================== ROW 2 · sheets & overlays
def settings_sheet(sel=3, human=False, dirty=False):
    temps = lst(*[li(span(NAME[i], 't-h3'), TAGL[i], face(i, 56), radio(i == sel), style='min-height: 76px') for i in (1, 3, 5)])
    hard = sel == 5
    rules = lst(rule('Main coach', 'You already have a coach — he runs the plan' if human else 'Atlas writes the programme and rewrites it every Sunday.', False, locked=human),
                rule('“Your mom” jokes', 'The classics' if hard else 'Merciless only', hard, locked=not hard),
                rule('Swearing', 'Proper swearing, no slurs' if hard else 'Merciless only', False, locked=not hard))
    pair = grid(btn('Clear chat', 'sec', 'trash', full=True), btn('Turn Atlas off', 'dan', 'logout', full=True), cols=2, gap=8)
    return sheet('Atlas settings', temps, rules, pair, h=790, footer=btn('Save', 'pri', full=True, dis=not dirty))


P('P12-Settings.dc.html', 'Atlas settings', coach_phone(*feed_extra()[:4], overlay=settings_sheet()), row_=2)
P('P12-Settings-Merciless.dc.html', 'Atlas settings · Merciless picked (dirty)', coach_phone(*feed_extra()[:4], overlay=settings_sheet(5, dirty=True)), row_=2)
P('P12-Settings-HumanCoach.dc.html', 'Atlas settings · you have a coach (locked)', coach_phone(*feed_extra()[:4], overlay=settings_sheet(3, human=True)), row_=2)


def confirm_sheet(title, body, primary):
    return sheet(title, txt(body, 't-b c-mut'), h=300, footer=row(btn('Cancel', 'sec', full=True), btn(primary, 'dan', full=True), gap=8))


P('P12-Confirm-Clear.dc.html', 'Clear the chat?', coach_phone(*feed_extra()[:4], overlay=confirm_sheet(
    'Clear the chat?', 'The whole conversation and his notes so far disappear. Your log and what he remembers about you stay.', 'Clear chat')), row_=2)
P('P12-Confirm-Off.dc.html', 'Turn Atlas off?', coach_phone(*feed_extra()[:4], overlay=confirm_sheet(
    'Turn Atlas off?', 'He stops commenting and the plan is no longer his. Your log, chat and what he remembers stay — turn him back on any time.', 'Turn Atlas off')), row_=2)

P('P12-Consent.dc.html', 'Chat with Atlas · consent', coach_phone(
    day('Today'), bubble(N_PR, time='09:12'), me('Is it fine to train chest two days in a row?', '15:20'),
    overlay=sheet('Chat with Atlas', txt("To answer free-form questions, Atlas sends a short training summary (recent sessions, your plan, sleep hours) to Google Gemini — and, once Gemini's free daily limit is used up, to Puter (puter.com) through your own Puter account. No name, email, birth date or photos. On free tiers these services may use requests to improve their models. The notes, debriefs and pushes work without this.", 't-b c-mut'),
                  h=440, footer=row(btn('Not now', 'sec', full=True), btn('Agree and send', 'pri', full=True), gap=8))), row_=2)

portrait_ov = ('<div class="scrim"></div><div class="scrim"></div>'
            + abs_(col(img('atlas/atlas-3-full.webp', 300, 360, r=24, alt='Atlas'), row(span('Atlas', 't-h2'), span('· Blunt', 't-b c-mut'), gap=6), gap=18, style='align-items: center'), 'left: 45px; top: 220px')
            + abs_(ibtn('x', 'Back', 'fill'), 'right: 16px; top: 64px'))
P('P12-Portrait.dc.html', 'Atlas portrait (tap the face)', coach_phone(*feed_extra()[:4], overlay=portrait_ov), row_=2)

# ============================================================== ROW 3 · components on other screens + desktop
def strip_solo(on=True, unread=2, t=3, line=N_IMB):
    """AtlasSoloStrip: face 54 · Atlas · temper · latest note | invite; count or caret."""
    name = row(span('Atlas', 't-h3'), span(f'· {NAME[t]}', 't-s') if on else '', gap=6)
    right = tag(str(unread) if unread <= 9 else '9+', 'bad') if (on and unread) else ico('chev', 18)
    return card(row(ring(100, 60, TT[t], 2.5, portrait(t, 54)) if (on and unread) else col(portrait(t if on else 3, 54), style='width: 60px; height: 60px; align-items: center; justify-content: center'),
                    col(name, txt(line if on else 'A coach who reads every set. You pick how harsh.', 't-s'), gap=2, style='flex: 1; min-width: 0'), right, gap=12),
                style='padding: 12px 14px')


def story_item(unread=2, t=3, off=False):
    badge = abs_(tag(str(unread) if unread <= 9 else '9+', 'bad'), 'top: -2px; right: -4px') if unread else ''
    inner = ring(100, 62, TT[t], 2.5, portrait(t, 54)) if (unread or off) else col(portrait(t, 54), style='width: 62px; height: 62px; align-items: center; justify-content: center')
    return col(f'<div style="position: relative">{inner}{badge}</div>', txt('Atlas', 't-m'), gap=5, style='align-items: center; width: 64px')


def clients():
    return [col(avatar(c, 54), txt(n, 't-m'), gap=5, style='align-items: center; width: 64px') for n, c in (('Anna', 'A'), ('Oleh', 'O'), ('Iryna', 'I'))]


def debrief(t=3, mute=False, texts=(N_SESSION, N_PR)):
    return col(*[bubble(x, t=t) for x in texts], replies(*(['Mute for today'] if mute else []), 'Open Atlas', on=1 if mute else 0), gap=8)


def notes_panel(empty=False):
    items = [bubble('No notes yet — train, and I’ll have something to say.')] if empty else [bubble(x) for x in (N_IMB, N_PR, N_REST, N_STALL, N_SESSION, N_STREAK)]
    return col(*items, lbl('The numbers'), gap=8)


board('P12-Components.dc.html', 'Atlas on other screens', 1600, 820, spec('Atlas outside the chat — AtlasStrip · AtlasDebrief · session plan card · ChatChart',
    cap('Today · solo strip · unread', strip_solo(), w=360),
    cap('Today · solo strip · all read', strip_solo(unread=0, line=N_IMB), w=360),
    cap('Today · solo strip · 9+ unread', strip_solo(unread=12), w=360),
    cap('Today · Atlas off → invite', strip_solo(on=False), w=360),
    cap('Today · with clients (story item + split)', row(story_item(2), '<div class="vl" style="height: 44px; margin-top: 9px"></div>', *clients(), gap=8, align='flex-start'), w=360),
    cap('Today · story item · all read / 9+ / Atlas off (invite ring)', row(story_item(0), story_item(12), story_item(0, off=True), gap=12, align='flex-start'), w=360),
    cap('Session summary · AtlasDebrief (Blunt)', debrief(), w=360),
    cap('AtlasDebrief · temper 4–5 adds Mute for today', debrief(5, True, ('18 sets. You call that a workout? I’ve seen warm-ups with more ambition.',)), w=360),
    cap('Session start · Atlas’s plan card', card(row(face(3, 36), col(lbl('ATLAS’S PLAN FOR TODAY', 'brass'), txt('Upper body', 't-h3'), txt('~60 min · 5 lifts', 't-m'), gap=2, style='flex: 1'),
                                                    btn('Start', 'pri', 'play', sm=True), gap=12), tone='glass', style='padding: 12px 14px'), w=360),
    cap('ChatChart (inside a bubble)', card(chat_chart(), style='padding: 10px 14px'), w=360),
    w=1600, h=820), row_=3)

P('P12-Progress-Notes.dc.html', 'Overview › Atlas · notes above the trends', phone(
    brand(), row(ibtn('back', 'Overview'), gap=4, style='margin: -6px 0 0 -8px'), txt('Atlas', 't-h1'), notes_panel(), tabs='overview', h=844), row_=3)
P('P12-Progress-Notes-Empty.dc.html', 'Overview › Atlas · no notes yet', phone(
    brand(), row(ibtn('back', 'Overview'), gap=4, style='margin: -6px 0 0 -8px'), txt('Atlas', 't-h1'), notes_panel(True), tabs='overview'), row_=3)

dt = row(col(thead(3, 'main coach'), plan_card(), *feed_extra(), sp(h=10),
             composer(), gap=12, style='width: 720px'), gap=24)
board('P12-Desktop.dc.html', 'Atlas chat · desktop', 1440, 1060, desktop(dt, 'today', h=1060), row_=3)
print('ok')
