#!/usr/bin/env python3
import io, sys, os

BASE = os.path.join(os.path.dirname(__file__), '..', 'src', 'i18n')

BLOCKS = {
    'en': """  sleepAutoDimFoot: 'Auto-dim follows your schedule \\u2014 turn it off any time in Sleep settings.',
  sleepAutoLogOfferTitle: 'Want Spotter to log sleep for you?',
  sleepConfidenceDesc: 'Weeknights vary under \\u00b120 min \\u00b7 weekends run later.',
  sleepAutoEditableNote: 'You can spot and fix any that were off \\u2014 auto-logged nights are flagged',
""",
    'uk': """  sleepAutoDimFoot: '\\u0410\\u0432\\u0442\\u043e\\u0437\\u0430\\u0442\\u0435\\u043c\\u043d\\u0435\\u043d\\u043d\\u044f \\u0439\\u0434\\u0435 \\u0437\\u0430 \\u0442\\u0432\\u043e\\u0457\\u043c \\u0440\\u043e\\u0437\\u043a\\u043b\\u0430\\u0434\\u043e\\u043c \\u2014 \\u0432\\u0438\\u043c\\u043a\\u043d\\u0438 \\u0431\\u0443\\u0434\\u044c-\\u043a\\u043e\\u043b\\u0438 \\u0432 \\u043d\\u0430\\u043b\\u0430\\u0448\\u0442\\u0443\\u0432\\u0430\\u043d\\u043d\\u044f\\u0445 \\u0441\\u043d\\u0443.',
  sleepAutoLogOfferTitle: '\\u0425\\u043e\\u0447\\u0435\\u0448, \\u0449\\u043e\\u0431 Spotter \\u0437\\u0430\\u043f\\u0438\\u0441\\u0443\\u0432\\u0430\\u0432 \\u0441\\u043e\\u043d \\u0437\\u0430 \\u0442\\u0435\\u0431\\u0435?',
  sleepConfidenceDesc: '\\u0411\\u0443\\u0434\\u043d\\u0456 \\u0442\\u0440\\u0438\\u043c\\u0430\\u044e\\u0442\\u044c\\u0441\\u044f \\u0432 \\u043c\\u0435\\u0436\\u0430\\u0445 \\u00b120 \\u0445\\u0432 \\u00b7 \\u0432\\u0438\\u0445\\u0456\\u0434\\u043d\\u0456 \\u0434\\u043e\\u0432\\u0448\\u0456.',
  sleepAutoEditableNote: '\\u041f\\u043e\\u043c\\u0456\\u0442\\u0438\\u0448 \\u0456 \\u0432\\u0438\\u043f\\u0440\\u0430\\u0432\\u0438\\u0448 \\u0431\\u0443\\u0434\\u044c-\\u044f\\u043a\\u0443 \\u043d\\u0435\\u0442\\u043e\\u0447\\u043d\\u0456\\u0441\\u0442\\u044c \\u2014 \\u0430\\u0432\\u0442\\u043e\\u043c\\u0430\\u0442\\u0438\\u0447\\u043d\\u0456 \\u043d\\u043e\\u0447\\u0456 \\u043f\\u043e\\u0437\\u043d\\u0430\\u0447\\u0435\\u043d\\u0456',
""",
    'pl': """  sleepAutoDimFoot: 'Auto-\\u015bciemnianie dzia\\u0142a wed\\u0142ug Twojego planu \\u2014 wy\\u0142\\u0105czysz je w ustawieniach snu.',
  sleepAutoLogOfferTitle: 'Chcesz, \\u017ceby Spotter zapisywa\\u0142 sen za Ciebie?',
  sleepConfidenceDesc: 'Dni robocze trzymaj\\u0105 si\\u0119 w \\u00b120 min \\u00b7 weekendy d\\u0142u\\u017csze.',
  sleepAutoEditableNote: 'Wychwycisz i poprawisz ka\\u017cd\\u0105 nietrafion\\u0105 \\u2014 noce auto s\\u0105 oznaczone',
""",
    'lt': """  sleepAutoDimFoot: 'Automatinis pritemdymas seka tavo tvarkara\\u0161t\\u012f \\u2014 bet kada i\\u0161junk miego nustatymuose.',
  sleepAutoLogOfferTitle: 'Nori, kad \\u201eSpotter\\u201c registruot\\u0173 mieg\\u0105 u\\u017e tave?',
  sleepConfidenceDesc: 'Darbo naktys svyruoja iki \\u00b120 min \\u00b7 savaitgaliai ilgesni.',
  sleepAutoEditableNote: 'Pasteb\\u0117si ir pataisysi bet kuri\\u0105 netiksli\\u0105 \\u2014 automatin\\u0117s naktys pa\\u017eym\\u0117tos',
""",
    'et': """  sleepAutoDimFoot: 'Automaatne tumendus j\\u00e4rgib su ajakava \\u2014 l\\u00fclita see une seadetes millal tahes v\\u00e4lja.',
  sleepAutoLogOfferTitle: 'Kas soovid, et Spotter logiks une sinu eest?',
  sleepConfidenceDesc: 'Argi\\u00f6\\u00f6d p\\u00fcsivad \\u00b120 min piires \\u00b7 n\\u00e4dalavahetused on pikemad.',
  sleepAutoEditableNote: 'M\\u00e4rkad ja parandad iga eksinu \\u2014 automaatsed \\u00f6\\u00f6d on m\\u00e4rgistatud',
""",
}

for loc, block in BLOCKS.items():
    path = os.path.join(BASE, loc + '.ts')
    with io.open(path, encoding='utf-8') as f:
        src = f.read()
    if 'sleepAutoDimFoot:' in src:
        print(loc, 'already has keys, skip')
        continue
    anchor = '\n  sleepTitle:'
    assert anchor in src, (loc, 'no anchor')
    block_dec = block.encode('utf-8').decode('unicode_escape')
    src = src.replace(anchor, '\n' + block_dec + anchor, 1)
    with io.open(path, 'w', encoding='utf-8') as f:
        f.write(src)
    print(loc, 'inserted')