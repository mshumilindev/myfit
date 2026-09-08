#!/usr/bin/env python3
import io, os
BASE = os.path.join(os.path.dirname(__file__), '..', 'src', 'i18n')
BLOCKS = {
 'en': """  sleepBackfillHint: 'Missed logging live? Add the night by hand \\u2014 roughly is fine, you can fix it later.',
  sleepDurationLabel: 'Duration',
  sleepNightOf: (d: string) => `Night of ${d}`,
  sleepLastNightTag: 'last night',
""",
 'uk': """  sleepBackfillHint: '\\u041d\\u0435 \\u0437\\u0430\\u043b\\u043e\\u0433\\u0443\\u0432\\u0430\\u0432 \\u043d\\u0430\\u0436\\u0438\\u0432\\u043e? \\u0414\\u043e\\u0434\\u0430\\u0439 \\u043d\\u0456\\u0447 \\u0432\\u0440\\u0443\\u0447\\u043d\\u0443 \\u2014 \\u043f\\u0440\\u0438\\u0431\\u043b\\u0438\\u0437\\u043d\\u043e \\u0442\\u0435\\u0436 \\u043e\\u043a, \\u043f\\u043e\\u0442\\u0456\\u043c \\u0432\\u0438\\u043f\\u0440\\u0430\\u0432\\u0438\\u0448.',
  sleepDurationLabel: '\\u0422\\u0440\\u0438\\u0432\\u0430\\u043b\\u0456\\u0441\\u0442\\u044c',
  sleepNightOf: (d: string) => `\\u041d\\u0456\\u0447 \\u043d\\u0430 ${d}`,
  sleepLastNightTag: '\\u043c\\u0438\\u043d\\u0443\\u043b\\u0430 \\u043d\\u0456\\u0447',
""",
 'pl': """  sleepBackfillHint: 'Nie zapisa\\u0142e\\u015b na \\u017cywo? Dodaj noc r\\u0119cznie \\u2014 orientacyjnie te\\u017c OK, potem poprawisz.',
  sleepDurationLabel: 'Czas trwania',
  sleepNightOf: (d: string) => `Noc z ${d}`,
  sleepLastNightTag: 'ostatnia noc',
""",
 'lt': """  sleepBackfillHint: 'Nepa\\u017eym\\u0117jai gyvai? Prid\\u0117k nakt\\u012f ranka \\u2014 apytiksliai irgi tinka, v\\u0117liau pataisysi.',
  sleepDurationLabel: 'Trukm\\u0117',
  sleepNightOf: (d: string) => `Naktis i\\u0161 ${d}`,
  sleepLastNightTag: 'pra\\u0117jusi naktis',
""",
 'et': """  sleepBackfillHint: 'Ei j\\u00f5udnud reaalajas? Lisa \\u00f6\\u00f6 k\\u00e4sitsi \\u2014 ligikaudu sobib ka, hiljem parandad.',
  sleepDurationLabel: 'Kestus',
  sleepNightOf: (d: string) => `\\u00d6\\u00f6: ${d}`,
  sleepLastNightTag: 'eelmine \\u00f6\\u00f6',
""",
}
for loc, block in BLOCKS.items():
    path = os.path.join(BASE, loc + '.ts')
    s = io.open(path, encoding='utf-8').read()
    if 'sleepBackfillHint' in s:
        print(loc, 'skip'); continue
    anchor = '\n  sleepTitle:'
    assert anchor in s, (loc, 'no anchor')
    s = s.replace(anchor, '\n' + block.encode('utf-8').decode('unicode_escape') + anchor, 1)
    io.open(path, 'w', encoding='utf-8').write(s)
    print(loc, 'inserted')