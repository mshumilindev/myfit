#!/usr/bin/env python3
import io, os
BASE = os.path.join(os.path.dirname(__file__), 'client', 'src', 'i18n')
# sleepWokeAtLabel — inserted before sleepTitle anchor
LABEL = {
 'en': "  sleepWokeAtLabel: 'Woke at',\n",
 'uk': "  sleepWokeAtLabel: '\\u041f\\u0440\\u043e\\u043a\\u0438\\u043d\\u0443\\u0432\\u0441\\u044f \\u043e',\n",
 'pl': "  sleepWokeAtLabel: 'Pobudka o',\n",
 'lt': "  sleepWokeAtLabel: 'Pabudai',\n",
 'et': "  sleepWokeAtLabel: '\\u00c4rkasid kell',\n",
}
# updated auto-log description (now the app fully manages the night)
AUTOLOG = {
 'en': ("  sleepAutoLogDesc: 'Fill each night from your weekday pattern.',",
        "  sleepAutoLogDesc: 'Start and end each night on its own, from your schedule or weekday pattern.',"),
 'uk': ("  sleepAutoLogDesc: '\\u0417\\u0430\\u043f\\u043e\\u0432\\u043d\\u044e\\u0432\\u0430\\u0442\\u0438 \\u043a\\u043e\\u0436\\u043d\\u0443 \\u043d\\u0456\\u0447 \\u0437\\u0430 \\u0442\\u0432\\u043e\\u0457\\u043c \\u0442\\u0438\\u0436\\u043d\\u0435\\u0432\\u0438\\u043c \\u0440\\u0438\\u0442\\u043c\\u043e\\u043c.',",
        "  sleepAutoLogDesc: '\\u0421\\u0430\\u043c \\u043f\\u043e\\u0447\\u0438\\u043d\\u0430\\u0442\\u0438 \\u0439 \\u0437\\u0430\\u0432\\u0435\\u0440\\u0448\\u0443\\u0432\\u0430\\u0442\\u0438 \\u043a\\u043e\\u0436\\u043d\\u0443 \\u043d\\u0456\\u0447 \\u2014 \\u0437\\u0430 \\u0433\\u0440\\u0430\\u0444\\u0456\\u043a\\u043e\\u043c \\u0430\\u0431\\u043e \\u0442\\u0438\\u0436\\u043d\\u0435\\u0432\\u0438\\u043c \\u0440\\u0438\\u0442\\u043c\\u043e\\u043c.',"),
 'pl': ("  sleepAutoLogDesc: 'Wype\\u0142niaj ka\\u017cd\\u0105 noc wed\\u0142ug tygodniowego rytmu.',",
        "  sleepAutoLogDesc: 'Sam zaczynaj i ko\\u0144cz ka\\u017cd\\u0105 noc \\u2014 wed\\u0142ug harmonogramu lub tygodniowego rytmu.',"),
 'lt': ("  sleepAutoLogDesc: 'U\\u017epildyti kiekvien\\u0105 nakt\\u012f pagal savait\\u0117s ritm\\u0105.',",
        "  sleepAutoLogDesc: 'Pati prad\\u0117ti ir baigti kiekvien\\u0105 nakt\\u012f \\u2014 pagal grafik\\u0105 ar savait\\u0117s ritm\\u0105.',"),
 'et': ("  sleepAutoLogDesc: 'T\\u00e4ida iga \\u00f6\\u00f6 n\\u00e4dalamustri j\\u00e4rgi.',",
        "  sleepAutoLogDesc: 'Alusta ja l\\u00f5peta iga \\u00f6\\u00f6 ise \\u2014 ajakava v\\u00f5i n\\u00e4dalamustri j\\u00e4rgi.',"),
}
for loc in LABEL:
    p=os.path.join(BASE,loc+'.ts')
    s=io.open(p,encoding='utf-8').read()
    if 'sleepWokeAtLabel' not in s:
        anchor='\n  sleepTitle:'
        assert anchor in s,(loc,'anchor')
        s=s.replace(anchor,'\n'+LABEL[loc].encode('utf-8').decode('unicode_escape')+anchor,1)
    old,new=AUTOLOG[loc]
    old=old.encode('utf-8').decode('unicode_escape'); new=new.encode('utf-8').decode('unicode_escape')
    assert old in s,(loc,'autolog old missing')
    s=s.replace(old,new,1)
    io.open(p,'w',encoding='utf-8').write(s)
    print(loc,'ok')
