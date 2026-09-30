import json, os, glob, sys
from kit import *

PAGES = [('P00', 'foundations', '00 · Foundations'), ('P01', 'today', '01 · Today & customize'), ('P02', 'widgets', '02 · Widget library'),
         ('P03', 'start', '03 · Start & logging'), ('P04', 'session', '04 · Session'), ('P05', 'summary', '05 · Summary & recap'),
         ('P06', 'history', '06 · History'), ('P07', 'progress', '07 · Progress'), ('P08', 'plan', '08 · Plan & programs'),
         ('P09', 'exercises', '09 · Exercises & Learn'), ('P10', 'health', '10 · Health, sleep, injury'), ('P11', 'gyms', '11 · Gyms'),
         ('P12', 'atlas', '12 · Atlas'), ('P13', 'apex', '13 · Apex & challenges'), ('P14', 'me', '14 · Me & settings'),
         ('P15', 'auth', '15 · Auth & onboarding'), ('P16', 'trainer', '16 · Trainer & admin'), ('P17', 'music', '17 · Music'), ('P18', 'desktop', '18 · Desktop')]

PART = os.environ.get('PART', '1')
SPLIT = {'1': ['P00', 'P01', 'P02', 'P03'], '2': ['P04', 'P05', 'P06'], '3': ['P07', 'P08'], '4': ['P09', 'P10'],
         '5': ['P11', 'P12', 'P13', 'P14'], '6': ['P15', 'P16', 'P17', 'P18']}
PARTNAME = {'1': 'Foundations → Start', '2': 'Session → History', '3': 'Progress → Plan', '4': 'Exercises → Health & sleep',
            '5': 'Gyms → Me', '6': 'Auth → Trainer & admin'}
OTHER = {k: 'The redesign is split into 6 canvases (a canvas loads ~200 boards): ' + ' · '.join(f'{n} {PARTNAME[n]}' for n in PARTNAME) + '.' for k in PARTNAME}
present = [p for p in PAGES if os.path.exists(f'manifests/{p[0]}.json') and p[0] in SPLIT[PART]]
# cover
items = ''.join(card(txt(n, 't-h3'), txt(f'{len(json.load(open(f"manifests/{p}.json")))} artboards', 't-m'), style='width: 250px') for p, _, n in present)
board('Main.dc.html', f'Spotter — Brass Glass · {PART}/6 · {PARTNAME[PART]}', 1600, 900, f'<div class="scr m-art" style="width: 1600px; height: 900px; padding: 70px 80px; display: flex; flex-direction: column; gap: 28px">'
      f'{lbl("Spotter · redesign", "brass")}<div class="t-d1" style="font-size: 56px">Brass glass</div><div class="t-b c-mut" style="max-width: 760px">One kit, every screen, 1:1 with the app: every state, sheet, dialog, role (member · trainer · admin), night mode and sub-app skin. '+OTHER[PART]+'</div>'
      f'<div style="display: flex; flex-wrap: wrap; gap: 14px">{items}</div></div>', prefix='MAIN')

boards = {'Main.dc.html': {'x': 0, 'y': 0, 'w': 1600, 'h': 900, 'title': 'Cover', 'page': 'cover'}}
order = ['Main.dc.html']
notes = {}
for p, pid, name in present:
    man = json.load(open(f'manifests/{p}.json'))
    rows_ = {}
    for m in man:
        rows_.setdefault(m['row'], []).append(m)
    y = 0
    for r in sorted(rows_):
        x = 0; hmax = 0
        for m in rows_[r]:
            boards[m['file']] = {'x': x, 'y': y, 'w': m['w'], 'h': m['h'], 'title': m['title'], 'page': pid}
            order.append(m['file']); x += m['w'] + 80; hmax = max(hmax, m['h'])
        y += hmax + 160
    notes['t_' + pid] = {'x': 0, 'y': -300, 'text': name.split(' · ', 1)[1], 'kind': 'title1', 'maxW': 3000, 'page': pid}

canvas = {'v': 3, 'createdOnFiles': {'v': 1, 'at': '2026-09-29T08:00:00Z'}, 'title': f'Spotter — Brass Glass · {PART}/6 · {PARTNAME[PART]}', 'launch': {'view': 'canvas', 'page': 'cover'},
          'pages': [{'id': 'cover', 'name': 'Cover'}] + [{'id': pid, 'name': n} for _, pid, n in present], 'boards': boards, 'order': order, 'notes': notes, 'designSystems': []}
json.dump(canvas, open('project/canvas.json', 'w'), ensure_ascii=False, indent=1)
print(len(boards), 'boards')
