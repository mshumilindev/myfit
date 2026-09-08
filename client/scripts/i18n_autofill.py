#!/usr/bin/env python3
import io, os
BASE = os.path.join(os.path.dirname(__file__), '..', 'src', 'i18n')

# Each block: raw python-unicode-escaped text; function values kept as functions.
BLOCKS = {
 'en': """  sleepAutoFilledFrom: (wd: string) =>
    `Filled from your ${wd} pattern \\u2014 adjust if it\\u2019s off, and the pattern learns from your fix.`,
  sleepAdjustTimes: 'Adjust times',
  sleepLooksRight: 'Looks right',
""",
 'uk': """  sleepAutoFilledFrom: (wd: string) =>
    `\\u0417\\u0430\\u043f\\u043e\\u0432\\u043d\\u0435\\u043d\\u043e \\u0437 \\u043f\\u0430\\u0442\\u0435\\u0440\\u043d\\u0443 \\u043d\\u0430 ${wd} \\u2014 \\u0432\\u0438\\u043f\\u0440\\u0430\\u0432, \\u044f\\u043a\\u0449\\u043e \\u0449\\u043e\\u0441\\u044c \\u043d\\u0435 \\u0442\\u0430\\u043a; \\u043f\\u0430\\u0442\\u0435\\u0440\\u043d \\u0432\\u0447\\u0438\\u0442\\u044c\\u0441\\u044f \\u043d\\u0430 \\u0432\\u0438\\u043f\\u0440\\u0430\\u0432\\u043b\\u0435\\u043d\\u043d\\u044f\\u0445.`,
  sleepAdjustTimes: '\\u0417\\u043c\\u0456\\u043d\\u0438\\u0442\\u0438 \\u0447\\u0430\\u0441',
  sleepLooksRight: '\\u0412\\u0441\\u0435 \\u0432\\u0456\\u0440\\u043d\\u043e',
""",
 'pl': """  sleepAutoFilledFrom: (wd: string) =>
    `Wype\\u0142nione wg wzorca (${wd}) \\u2014 popraw, je\\u015bli co\\u015b nie gra; wzorzec uczy si\\u0119 z poprawek.`,
  sleepAdjustTimes: 'Zmie\\u0144 godziny',
  sleepLooksRight: 'Wygl\\u0105da dobrze',
""",
 'lt': """  sleepAutoFilledFrom: (wd: string) =>
    `U\\u017epildyta pagal ${wd} ritm\\u0105 \\u2014 pataisyk, jei netikslu; modelis mokosi i\\u0161 taisym\\u0173.`,
  sleepAdjustTimes: 'Keisti laik\\u0105',
  sleepLooksRight: 'Viskas gerai',
""",
 'et': """  sleepAutoFilledFrom: (wd: string) =>
    `T\\u00e4idetud ${wd} mustri j\\u00e4rgi \\u2014 paranda, kui vale; muster \\u00f5pib parandustest.`,
  sleepAdjustTimes: 'Muuda kellaaegu',
  sleepLooksRight: 'K\\u00f5ik \\u00f5ige',
""",
}

for loc, block in BLOCKS.items():
    path = os.path.join(BASE, loc + '.ts')
    s = io.open(path, encoding='utf-8').read()
    if 'sleepAutoFilledFrom' in s:
        print(loc, 'skip'); continue
    anchor = '\n  sleepTitle:'
    assert anchor in s, (loc, 'no anchor')
    block_dec = block.encode('utf-8').decode('unicode_escape')
    s = s.replace(anchor, '\n' + block_dec + anchor, 1)
    io.open(path, 'w', encoding='utf-8').write(s)
    print(loc, 'inserted')