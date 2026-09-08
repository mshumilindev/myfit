#!/usr/bin/env python3
import io, os
BASE = os.path.join(os.path.dirname(__file__), '..', 'src', 'i18n')
BLOCKS = {
 'en': """  sleepAsleepLabel: 'Asleep',
  sleepSinceClock: (clock: string) => `since ${clock}`,
  sleepDiscard: 'Discard sleep',
  sleepDiscardConfirm: 'Discard this sleep? It won\\u2019t be logged.',
""",
 'uk': """  sleepAsleepLabel: '\\u0423\\u0432\\u0456 \\u0441\\u043d\\u0456',
  sleepSinceClock: (clock: string) => `\\u0437 ${clock}`,
  sleepDiscard: '\\u0421\\u043a\\u0430\\u0441\\u0443\\u0432\\u0430\\u0442\\u0438 \\u0441\\u043e\\u043d',
  sleepDiscardConfirm: '\\u0421\\u043a\\u0430\\u0441\\u0443\\u0432\\u0430\\u0442\\u0438 \\u0446\\u0435\\u0439 \\u0441\\u043e\\u043d? \\u0412\\u0456\\u043d \\u043d\\u0435 \\u0437\\u0430\\u043f\\u0438\\u0448\\u0435\\u0442\\u044c\\u0441\\u044f.',
""",
 'pl': """  sleepAsleepLabel: '\\u015apisz',
  sleepSinceClock: (clock: string) => `od ${clock}`,
  sleepDiscard: 'Odrzu\\u0107 sen',
  sleepDiscardConfirm: 'Odrzuci\\u0107 ten sen? Nie zostanie zapisany.',
""",
 'lt': """  sleepAsleepLabel: 'Miegi',
  sleepSinceClock: (clock: string) => `nuo ${clock}`,
  sleepDiscard: 'Atmesti mieg\\u0105',
  sleepDiscardConfirm: 'Atmesti \\u0161\\u012f mieg\\u0105? Jis nebus \\u012fra\\u0161ytas.',
""",
 'et': """  sleepAsleepLabel: 'Magad',
  sleepSinceClock: (clock: string) => `alates ${clock}`,
  sleepDiscard: 'Loobu unest',
  sleepDiscardConfirm: 'Loobuda sellest unest? Seda ei salvestata.',
""",
}
for loc, block in BLOCKS.items():
    path = os.path.join(BASE, loc + '.ts')
    s = io.open(path, encoding='utf-8').read()
    if 'sleepAsleepLabel' in s:
        print(loc, 'skip'); continue
    anchor = '\n  sleepTitle:'
    assert anchor in s, (loc, 'no anchor')
    s = s.replace(anchor, '\n' + block.encode('utf-8').decode('unicode_escape') + anchor, 1)
    io.open(path, 'w', encoding='utf-8').write(s)
    print(loc, 'inserted')