import io, os
BASE=os.path.join(os.path.dirname(__file__),'..','src','i18n')
B={
 'en':"""  sleepEditNight: 'Edit night',
  sleepDeleteNight: 'Delete night',
  sleepDeleteConfirm: 'Delete this night? This can\\u2019t be undone.',
""",
 'uk':"""  sleepEditNight: '\\u0420\\u0435\\u0434\\u0430\\u0433\\u0443\\u0432\\u0430\\u0442\\u0438 \\u043d\\u0456\\u0447',
  sleepDeleteNight: '\\u0412\\u0438\\u0434\\u0430\\u043b\\u0438\\u0442\\u0438 \\u043d\\u0456\\u0447',
  sleepDeleteConfirm: '\\u0412\\u0438\\u0434\\u0430\\u043b\\u0438\\u0442\\u0438 \\u0446\\u044e \\u043d\\u0456\\u0447? \\u0426\\u0435 \\u043d\\u0435\\u0437\\u0432\\u043e\\u0440\\u043e\\u0442\\u043d\\u043e.',
""",
 'pl':"""  sleepEditNight: 'Edytuj noc',
  sleepDeleteNight: 'Usu\\u0144 noc',
  sleepDeleteConfirm: 'Usun\\u0105\\u0107 t\\u0119 noc? Tego nie cofniesz.',
""",
 'lt':"""  sleepEditNight: 'Redaguoti nakt\\u012f',
  sleepDeleteNight: 'Trinti nakt\\u012f',
  sleepDeleteConfirm: 'Trinti \\u0161i\\u0105 nakt\\u012f? To nebus galima at\\u0161aukti.',
""",
 'et':"""  sleepEditNight: 'Muuda \\u00f6\\u00f6d',
  sleepDeleteNight: 'Kustuta \\u00f6\\u00f6',
  sleepDeleteConfirm: 'Kustutada see \\u00f6\\u00f6? Seda ei saa tagasi v\\u00f5tta.',
""",
}
for loc,block in B.items():
    path=os.path.join(BASE,loc+'.ts'); s=io.open(path,encoding='utf-8').read()
    if 'sleepEditNight' in s: print(loc,'skip'); continue
    a='\n  sleepTitle:'; assert a in s
    s=s.replace(a,'\n'+block.encode('utf-8').decode('unicode_escape')+a,1)
    io.open(path,'w',encoding='utf-8').write(s); print(loc,'ok')
