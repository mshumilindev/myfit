import kit as k
from kit import *

# ---- F1 colour & surfaces
sw = lambda n, c, t='': col(f'<div style="width: 120px; height: 72px; border-radius: 14px; background: {c}; box-shadow: inset 0 0 0 1px rgba(233,234,236,.08)"></div>', txt(n, 't-h3'), txt(t or c, 't-m'), gap=6)
surf = lambda name, tone, note: col(card(txt(name, 't-h3'), txt(note, 't-s'), tone=tone, style='width: 240px; height: 120px'), gap=6)
board('P00-Colors.dc.html', 'Colour, glass & surfaces', 1600, 900, spec('Colour, glass and surfaces',
    cap('Ground', row(sw('Background', '#121316'), sw('Card', 'rgba(31,33,37,.72)', 'card'), sw('Text', '#e9eaec'), sw('Secondary', '#b0b4b8'), sw('Meta', '#90959a'), sw('Hairline', '#3b3f43'), gap=16)),
    cap('Meaning', row(sw('Brass', '#d9a24f', 'action · focus · live'), sw('Emerald', '#4cbe8c', 'success · records'), sw('Ruby', '#e2564f', 'destructive · failure · offline'), sw('Rest', '#33a8e0', 'rest · recovery'), sw('Sleep', '#9d8cf0'), sw('Sport', '#a8dc7c'), sw('Kcal', '#3d84c9'), gap=16)),
    cap('Surfaces — only these six', row(surf('card', '', 'Default container for content'), surf('card.glass', 'glass', 'Brass glass: current / live / primary'), surf('card.ok', 'ok', 'PR, done, healthy'), surf('card.rest', 'rest', 'Rest timer, recovery'), surf('card.sleep', 'sleep', 'Sleep'), surf('card.bad', 'bad', 'Injury, failure, offline'), gap=16)),
    cap('Rule', txt('Brass never fills a surface: it tints glass and outlines actions. One glass card per screen area; everything else is a plain card.', 't-b', 'max-width: 900px')),
), row_=0)

# ---- F2 type
board('P00-Type.dc.html', 'Typography', 1100, 700, spec('Typography · Inter',
    col(txt('Display 34 · 600', 't-d1'), txt('Title 26 · 600', 't-h1'), txt('Heading 20 · 600', 't-h2'), txt('Subheading 16 · 600', 't-h3'), txt('Body 15 · 400 — plain, factual, numbers over adjectives.', 't-b'),
        txt('Secondary 13 · 400', 't-s'), txt('Meta 12 · 400', 't-m'), lbl('Label 10.5 · uppercase · 0.12em'), f'<div class="t-big num">100<span class="t-m" style="font-size: 16px"> kg</span></div>', txt('Numbers use tabular figures everywhere.', 't-s'), gap=14), w=1100, h=700), row_=0)

# ---- F3 buttons, chips, controls
board('P00-Controls.dc.html', 'Buttons, chips, controls', 1600, 1000, spec('Buttons, chips and controls',
    cap('Buttons · 48 / 36', col(row(btn('Start workout', 'pri', 'play'), btn('Save', 'sec'), btn('Mark as PR', 'ok'), btn('Delete', 'dan'), btn('See all', 'txt'), btn('Disabled', 'pri', dis=True), gap=12),
                                  row(btn('Log', 'pri', sm=True), btn('+15 s', 'sec', sm=True), btn('Retry', 'sec', sm=True), btn('Remove', 'dan', sm=True), gap=12), gap=12)),
    cap('Icon buttons', row(ibtn('more', 'More'), ibtn('plus', 'Add', 'fill'), ibtn('play', 'Play', 'pri'), ibtn('x', 'Close', 'fill', sm=True), ibtn('search', 'Search', 'fill', sm=True), gap=12)),
    cap('Chips', row(chip('All', True), chip('Chest'), chip('Back'), chip('Legs'), chip('Filters', icon='filter'), gap=8)),
    cap('Segmented', col(seg(['Timeline', 'Calendar']), seg(['Week', 'Month', 'Year'], 1), gap=10, style='width: 360px')),
    cap('Tags', row(tag('Core'), tag('PR', 'ok', 'trophy'), tag('Failure', 'bad'), tag('Rest', 'rest'), tag('Queued', 'neutral'), tag('Beta', 'brass'), gap=8)),
    cap('Selection', row(toggle(True), toggle(False), check(True), check(False), radio(True), radio(False), gap=16)),
    cap('Stepper', row(stepper('100', 'kg', 'Weight'), stepper('5', 'reps', 'Reps'), gap=24)),
    cap('Fields', col(field('Email', 'mykola@example.com'), field('Password', '••••••••', state='focus'), field('Gym name', '', 'Iron Temple', state='err', err='Name is required'), search('Search exercises'), gap=12, style='width: 360px')),
), row_=0)

# ---- F4 lists, cards, stats
board('P00-Content.dc.html', 'Lists, cards and stats', 1600, 1000, spec('Lists, cards, stats',
    cap('List', lst(li('Iron Temple', 'You are here · 0.2 km', tile('building', 'brass'), tag('Here'), chev=True),
                    li('Sleep', '7 h 12 min · last night', tile('moon', 'sleep'), '<span class="num">82 %</span>', chev=True),
                    li('Notifications', None, tile('bell'), toggle(True)),
                    li('Delete account', None, tile('trash', 'bad'), chev=True, tone='bad')), w=360),
    cap('Stat cards', grid(stat_card('Readiness', '82', '%', '+4', 'ok'), stat_card('Body weight', '82.4', 'kg', '−0.3', 'neutral'), stat_card('Streak', '6', 'weeks', None, glass=True), stat_card('Volume', '6.2', 't', '+8 %', 'ok'), cols=2, style='width: 360px'), w=360),
    cap('Section header', col(section('This week', 'See all'), section('History'), gap=4, style='width: 360px'), w=360),
    cap('Banners', col(banner('Knee injury · day 6', 'Plan adapted: no deep knee flexion', 'bad', 'bandage', 'Open'), banner('Resting today', 'Planned rest day', 'rest', 'moon'), banner('Offline', '3 changes waiting to sync', 'bad', 'cloudoff'), banner('New program ready', 'Upper/Lower 4× from your last 4 weeks', 'brass', 'spark', 'View'), gap=10, style='width: 380px'), w=380),
    cap('Progress', col(bar(64), bar(82, 'ok'), bar(35, 'rest'), row(ring(82, 64, 'ok', 6, '<span class=num style="font-weight:600">82</span>'), ring(52, 64, 'rest', 6, '<span class=num style="font-weight:600;font-size:13px">1:12</span>'), ring(33, 64, 'brass', 6, '<span class=num style="font-weight:600">33%</span>'), gap=14), gap=12, style='width: 300px'), w=300),
    cap('Charts', col(card(spark([90, 92, 91, 95, 96, 97.5, 100], 300, 70, 'brass')), card(bars([4, 6, 5, 7, 3, 8, 6], 300, 90, 'brass', 6, list('MTWTFSS'))), card(heat()), gap=10), w=340),
), row_=0)

# ---- F5 states
board('P00-States.dc.html', 'Empty, loading, failed, offline', 1600, 700, spec('States every list has',
    cap('Filled', lst(li('Chest 2', 'Mon 28 Sep · 58 min · 18 sets', tile('dumbbell', 'brass'), chev=True), li('Run', 'Sun 27 Sep · 5.2 km', tile('run', 'sport'), chev=True)), w=340),
    cap('Skeleton (300 ms – 2 s)', skel_rows(3), w=340),
    cap('Empty', empty('No workouts yet', 'Your first session shows up here.', 'dumbbell', 'Start a workout'), w=340),
    cap('Failed / offline', col(failed(), banner('Offline', 'Saved on this device · 3 queued', 'bad', 'cloudoff'), gap=10), w=380),
    w=1600, h=700), row_=1)

# ---- F6 overlays
ov = lambda content: f'<div class="scr" style="width: 390px; height: 600px; border-radius: 28px">{content}</div>'
board('P00-Overlays.dc.html', 'Sheets, dialogs, snackbars', 1600, 840, spec('Overlays',
    cap('Bottom sheet', ov(sheet('Swap exercise', lst(li('Incline DB press', 'Same muscles · dumbbells', tile('dumbbell'), chev=True), li('Machine chest press', 'Same muscles · machine', tile('dumbbell'), chev=True)), h=360, sub='Bench press is busy'))),
    cap('Dialog · irreversible', ov(dialog('Delete this workout?', 'Chest 2 on 28 Sep with 18 sets will be removed from history and stats. Your PRs from other days stay.', 'Delete', top=170))),
    cap('Snackbar · undo 5 s', ov(snack('Set deleted', 'Undo', 30))),
    cap('Toast / live pill', col(livepill('live'), livepill('rest', time='1:12'), livepill('offline'), livepill('closed'), gap=10, style='width: 360px')),
    w=1600, h=840), row_=1)

# ---- F7 shell
board('P00-Shell.dc.html', 'Shell: header, tab bar, rail', 1600, 900, spec('Shell',
    cap('Brand bar', f'<div class="card" style="width: 390px">{brandbar()}</div>'),
    cap('Screen header', col(f'<div class="card" style="width: 390px">{header("Bench press", action=ibtn("more", "More"))}</div>', f'<div class="card" style="width: 390px; padding-bottom: 12px">{header("Progress", back=False, large=True, sub="Last 12 weeks")}</div>', gap=10)),
    cap('Tab bar', col(*[f'<div style="position: relative; width: 390px; height: 78px; border-radius: 18px; overflow: hidden">{tabbar(t)}</div>' for t in ['today', 'plan', 'progress', 'me']], gap=10)),
    cap('Widgets · sizes', row(widget('S', 'Readiness', f'<div style="margin-top: auto" class="num t-d1">82<span class="t-m"> %</span></div>{bar(82, "ok")}'), shortcut('Run', 'run', 'sport'), shortcut('Chest 2', 'play', 'brass', 'live'), shortcut('Sleep', 'moon', 'sleep', 'done'), gap=12, align='flex-start')),
    w=1600, h=900), row_=1)
print('ok')
