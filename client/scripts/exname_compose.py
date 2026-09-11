# -*- coding: utf-8 -*-
"""Idiomatic exercise-name localizer. English stays canonical; we produce
uk/pl/lt/et where we can do so *idiomatically*, else leave None (app shows English)."""
import json, re, collections, sys

import os
_here=os.path.dirname(os.path.abspath(__file__))
_rich=json.load(open(os.path.join(_here,'..','src','data','exercises.rich.json')))
EX=[{'id':e['id'],'name':e['name']} for e in _rich]

# ---------------- multiword normalisation ----------------
MULTI = {
 'One-Arm':'ONEARM','One Arm':'ONEARM','Single-Arm':'ONEARM','Single Arm':'ONEARM',
 'Two-Arm':'TWOARM','Two Arm':'TWOARM','Two-Dumbbell':'TWOARM',
 'One-Legged':'ONELEG','One-Leg':'ONELEG','Single-Leg':'ONELEG','Single Leg':'ONELEG','One Leg':'ONELEG',
 'Close-Grip':'CLOSEGRIP','Close Grip':'CLOSEGRIP','Wide-Grip':'WIDEGRIP','Wide Grip':'WIDEGRIP',
 'Medium-Grip':'MEDGRIP','Medium Grip':'MEDGRIP','Reverse-Grip':'REVGRIP','Reverse Grip':'REVGRIP',
 'Bent-Over':'BENTOVER','Bent Over':'BENTOVER',
 'Rear Delt':'REARDELT','Rear-Delt':'REARDELT','Rear Deltoid':'REARDELT',
 'EZ-Bar':'EZBAR','EZ Bar':'EZBAR','T-Bar':'TBAR','V-Bar':'VBAR',
 'Palms-Up':'PALMSUP','Palms Up':'PALMSUP','Palms-Down':'PALMSDOWN','Palms Down':'PALMSDOWN',
 'Straight-Arm':'STRAIGHTARM','Straight Arm':'STRAIGHTARM',
}
def premark(name):
    s=name.replace(' - ',' ')  # "Press - Medium Grip" -> flat
    for k,v in MULTI.items():
        s=re.sub(r'\b'+re.escape(k)+r'\b', v, s)
    return s

# attachment / generic tokens we can safely drop without changing meaning
IGNORE={'Rope','Handle','Attachment','Chains','Chain','Bar'}
# named / positional modifiers we render explicitly per base
MODS={'Preacher':'preacher','Concentration':'concentration','Military':'military',
 'Upright':'upright','Spider':'spider','Drag':'drag','Sumo':'sumo','Zottman':'zottman',
 'Arnold':'arnold','Pallof':'pallof','Back':'back'}

EQUIP={'Barbell':'barbell','Dumbbell':'dumbbell','Cable':'cable','Kettlebell':'kettlebell',
 'Machine':'machine','Smith':'smith','Band':'band','Bands':'band','EZBAR':'ezbar','TBAR':'tbar',
 'Lever':'machine','Leverage':'machine','Plate':'plate'}
POS={'Standing':'standing','Seated':'seated','Lying':'lying','Incline':'incline','Decline':'decline',
 'Kneeling':'kneeling','BENTOVER':'bentover','Prone':'prone','Supine':'supine','Flat':'flat',
 'Floor':'floor','Overhead':'overhead','Bent':'bentover','Bench':'bench'}
GRIP={'CLOSEGRIP':'close','WIDEGRIP':'wide','MEDGRIP':'medium','REVGRIP':'reverse','Reverse':'reverse',
 'Hammer':'hammer','Pronated':'pronated','Supinated':'supinated','PALMSUP':'supinated',
 'PALMSDOWN':'pronated','Neutral':'neutral','STRAIGHTARM':'straightarm'}
LAT={'ONEARM':'onearm','TWOARM':'twoarm','ONELEG':'oneleg','Alternating':'alt','Alternate':'alt'}
REGION={'Chest':'chest','Shoulder':'shoulder','Front':'front','Side':'side','Lateral':'lateral',
 'REARDELT':'reardelt','Leg':'leg','Legs':'leg','Calf':'calf','Wrist':'wrist','Hip':'hip',
 'Glute':'glute','Bicep':'bicep','Biceps':'bicep','Tricep':'tricep','Triceps':'tricep',
 'Neck':'neck','Oblique':'oblique','Ab':'ab','Rear':'rear','Quad':'quad','Hamstring':'hamstring'}
BASE={'Press':'press','Presses':'press','Curl':'curl','Curls':'curl','Row':'row','Rows':'row',
 'Raise':'raise','Raises':'raise','Squat':'squat','Squats':'squat','Deadlift':'deadlift',
 'Extension':'extension','Extensions':'extension','Fly':'fly','Flyes':'fly','Flye':'fly',
 'Pulldown':'pulldown','Pushdown':'pushdown','Lunge':'lunge','Lunges':'lunge','Shrug':'shrug',
 'Shrugs':'shrug','Crunch':'crunch','Crunches':'crunch','Pullover':'pullover','Crossover':'crossover',
 'Kickback':'kickback','Thrust':'thrust','Bridge':'bridge'}
FILLER={'with','With','the','The','a','A','an','An'}

def parse(name):
    toks=premark(name).split()
    c={'equip':None,'pos':None,'grip':None,'lat':None,'region':[],'base':None,'mods':[],'unknown':[]}
    # base = last classifiable base token
    bidx=None
    for i in range(len(toks)-1,-1,-1):
        if toks[i] in BASE:
            c['base']=BASE[toks[i]]; bidx=i; break
    if c['base'] is None:
        return None
    for i,t in enumerate(toks):
        if i==bidx: continue
        if t in IGNORE: continue
        # A recognized modifier whose slot is already filled is a redundant
        # qualifier (e.g. "Incline Bench Press" — Bench after Incline): drop it
        # rather than bail to English. Only a genuinely unknown token (or a
        # second base word = a risky combo) forces the English fallback.
        if t in MODS: c['mods'].append(MODS[t])
        elif t in EQUIP: (c.__setitem__('equip', EQUIP[t]) if c['equip'] is None else None)
        elif t in POS: (c.__setitem__('pos', POS[t]) if c['pos'] is None else None)
        elif t in GRIP: (c.__setitem__('grip', GRIP[t]) if c['grip'] is None else None)
        elif t in LAT: (c.__setitem__('lat', LAT[t]) if c['lat'] is None else None)
        elif t in REGION: c['region'].append(REGION[t])
        elif t in BASE: c['unknown'].append(t)   # a second base word = combo -> risky
        elif t in FILLER: pass
        else: c['unknown'].append(t)
    if c['unknown']:
        return None
    return c

# =======================================================================
#  UKRAINIAN
# =======================================================================
EQ_UK={'barbell':('штанги','зі штангою'),'dumbbell':('гантелей','з гантелями'),
 'cable':('блоку','на блоці'),'kettlebell':('гирі','з гирею'),'machine':('','у тренажері'),
 'smith':('','у Сміті'),'band':('','з еспандером'),'ezbar':('EZ-штанги','з EZ-штангою'),
 'tbar':('','на Т-грифі'),'plate':('','з диском')}
EQ_UK_ONE={'dumbbell':('гантелі','з гантеллю')}
POS_UK={'standing':'стоячи','seated':'сидячи','lying':'лежачи','incline':'на похилій лаві',
 'decline':'на негативній лаві','kneeling':'стоячи на колінах','bentover':'в нахилі',
 'prone':'лежачи на животі','supine':'лежачи на спині','flat':'на горизонтальній лаві',
 'floor':'з підлоги','overhead':'над головою','bench':'лежачи'}
GRIP_UK={'close':'вузьким хватом','wide':'широким хватом','medium':'середнім хватом',
 'reverse':'зворотним хватом','hammer':'нейтральним хватом','pronated':'прямим хватом',
 'supinated':'зворотним хватом','neutral':'нейтральним хватом','straightarm':'прямими руками'}
LAT_UK={'onearm':'однією рукою','twoarm':'двома руками','oneleg':'на одній нозі','alt':'поперемінно'}

def eq_uk(c, case):  # case: 'gen' or 'instr'
    e=c['equip']
    if not e: return ''
    if c['lat']=='onearm' and e in EQ_UK_ONE:
        return EQ_UK_ONE[e][0 if case=='gen' else 1]
    return EQ_UK[e][0 if case=='gen' else 1]

# For "Жим" the equipment reads best genitive for free weights, prepositional
# for the fixed-path machines (на блоці / у тренажері / у Сміті).
def eq_press_uk(c):
    e=c['equip']
    if e in ('cable','machine','smith','tbar','band','plate'): return eq_uk(c,'instr')
    return eq_uk(c,'gen')

# For "Розведення" (fly) — dumbbells read genitive ("гантелей"), cable prepositional.
def eq_fly_uk(c):
    e=c['equip']
    if e in ('cable','machine','smith','band'): return eq_uk(c,'instr')
    return eq_uk(c,'gen')

def join(*parts):
    return re.sub(r'\s+',' ',' '.join(p for p in parts if p)).strip()

def render_uk(c):
    b=c['base']; regs=set(c['region']); reg=c['region'][0] if c['region'] else None
    mods=set(c['mods'])
    reardelt = 'reardelt' in regs or ('rear' in regs and 'lateral' in regs)
    if c['grip']=='reverse' and b=='fly': reardelt=True
    pos=POS_UK.get(c['pos'],'') ; grip=GRIP_UK.get(c['grip'],''); lat=LAT_UK.get(c['lat'],'')
    # mods we know how to render; anything else -> bail to English for safety
    handled=set()
    if mods - {'preacher','concentration','military','upright','sumo','back'}:
        return None
    if b=='press':
        if 'military' in mods: return join('Армійський жим', eq_press_uk(c), pos, lat)
        if reg=='leg': return join('Жим ногами', pos, lat)
        if reg=='shoulder' or c['pos']=='overhead':
            return join('Жим', eq_press_uk(c), 'над головою', grip, lat)
        return join('Жим', eq_press_uk(c), pos, grip, lat)
    if b=='curl':
        if reg=='wrist': return join('Згинання зап’ясть', eq_uk(c,'instr'), pos, lat)
        if reg=='leg': return join('Згинання ніг', pos, lat)
        scott=' на лаві Скотта' if 'preacher' in mods else ''
        head='Концентрований підйом' if 'concentration' in mods else 'Підйом'
        eqg=eq_uk(c,'gen')
        if eqg: return join(head, eqg, 'на біцепс'+scott, grip, pos, lat)
        eqi=eq_uk(c,'instr')
        if eqi: return join('Згинання рук', eqi, 'на біцепс'+scott, grip, pos, lat)
        return join('Згинання рук на біцепс'+scott, grip, pos, lat)
    if b=='row':
        if 'upright' in mods: return join('Тяга', eq_uk(c,'gen') or eq_uk(c,'instr'), 'до підборіддя', grip, lat)
        return join('Тяга', eq_uk(c,'gen') or eq_uk(c,'instr'), pos or ('в нахилі' if not c['pos'] and c['equip']=='barbell' else ''), grip, lat)
    if b=='raise':
        if reardelt:
            return join('Розведення', eq_fly_uk(c), 'в нахилі', lat)
        if 'calf' in regs:
            return join('Підйом на носки', eq_uk(c,'instr'), pos, lat)
        if 'lateral' in regs or 'side' in regs:
            return join('Махи', eq_uk(c,'instr'), 'в сторони', pos, lat)
        if 'front' in regs:
            return join('Махи', eq_uk(c,'instr'), 'перед собою', pos, lat)
        return join('Підйом', eq_uk(c,'gen') or eq_uk(c,'instr'), pos, lat)
    if b=='squat':
        return join('Присідання', eq_uk(c,'instr'), pos, ('сумо' if 'sumo' in mods else ''), lat)
    if b=='deadlift':
        return join('Станова тяга', eq_uk(c,'instr'), ('сумо' if 'sumo' in mods else ''), lat)
    if b=='extension':
        if 'back' in mods: return join('Гіперекстензія', pos, lat)
        if reg=='leg': return join('Розгинання ніг', pos, lat)
        if reg in ('tricep',None): return join('Розгинання рук на трицепс', eq_uk(c,'instr'), pos, grip, lat)
        return join('Розгинання', eq_uk(c,'instr'), pos, lat)
    if b=='fly':
        if reardelt: return join('Розведення', eq_fly_uk(c), 'в нахилі', lat)
        if c['equip']=='cable': return join('Зведення рук у кросовері', pos, lat)
        return join('Розведення', eq_fly_uk(c), pos, lat)
    if b=='pulldown':
        return join('Тяга верхнього блоку', grip, lat)
    if b=='pushdown':
        return join('Розгинання рук на блоці', grip, lat)
    if b=='lunge':
        return join('Випади', eq_uk(c,'instr'), pos, lat)
    if b=='shrug':
        return join('Шраги', eq_uk(c,'instr'), pos, lat)
    if b=='crunch':
        extra='на блоці' if c['equip']=='cable' else ('у тренажері' if c['equip']=='machine' else '')
        return join('Скручування', extra, pos, lat)
    if b=='pullover':
        return join('Пуловер', eq_uk(c,'instr'), pos, lat)
    if b=='crossover':
        return join('Зведення рук у кросовері', pos, lat)
    if b=='kickback':
        return join('Розгинання руки в нахилі', eq_uk(c,'instr'), lat)
    if b=='thrust':
        return join('Підйом таза', eq_uk(c,'instr'), lat)
    if b=='bridge':
        return join('Ягодичний міст', eq_uk(c,'instr'), lat)
    return None

# Bodypart genitive forms for stretches ("Розтяжка [gen]").
BODYPART_UK={'Chest':'грудей','Hamstring':'задньої поверхні стегна','Hamstrings':'задньої поверхні стегна',
 'Quad':'квадрицепса','Quads':'квадрицепса','Quadriceps':'квадрицепса','Shoulder':'плечей','Shoulders':'плечей',
 'Triceps':'трицепса','Tricep':'трицепса','Biceps':'біцепса','Bicep':'біцепса','Back':'спини',
 'Lat':'найширших м’язів','Lats':'найширших м’язів','Calf':'литок','Calves':'литок','Neck':'шиї',
 'Hip':'стегон','Hips':'стегон','Groin':'привідних м’язів','Glute':'сідниць','Glutes':'сідниць',
 'Adductor':'привідних м’язів','Abductor':'відвідних м’язів','Forearm':'передпліч','Forearms':'передпліч',
 'Wrist':'зап’ясть','Wrists':'зап’ясть','Ankle':'гомілковостопа','Spine':'хребта','Ab':'преса',
 'Abdominal':'преса','Oblique':'косих м’язів','Obliques':'косих м’язів','Trap':'трапецій','Traps':'трапецій',
 'Chest':'грудей','Arm':'рук','Arms':'рук','Leg':'ніг','Legs':'ніг','Thigh':'стегна'}
STRETCH_POS_UK={'Standing':'стоячи','Seated':'сидячи','Lying':'лежачи','Kneeling':'стоячи на колінах',
 'Side':'вбік','Front':'','Prone':'лежачи на животі','Supine':'лежачи на спині'}

def stretch_uk(name):
    toks=name.split()
    if toks[-1]!='Stretch': return None
    body=toks[:-1]
    parts=[]; pos=''
    for t in body:
        if t in BODYPART_UK: parts.append(BODYPART_UK[t])
        elif t in STRETCH_POS_UK: pos=STRETCH_POS_UK[t] or pos
        elif t in FILLER or t in ('To','and','And','On','on','Over'): return None  # too phrasey
        else: return None
    if not parts: return None
    # de-dup while keeping order
    seen=set(); bp=[p for p in parts if not (p in seen or seen.add(p))]
    return join('Розтяжка', ' '.join(bp), pos)

OVER_UK={
 'Bench Press':'Жим лежачи','Barbell Bench Press':'Жим штанги лежачи',
 'Dumbbell Bench Press':'Жим гантелей лежачи','Push-Up':'Віджимання','Pushups':'Віджимання',
 'Pull-Up':'Підтягування','Chin-Up':'Підтягування зворотним хватом',
 'Leg Press':'Жим ногами','Leg Extension':'Розгинання ніг','Leg Curl':'Згинання ніг лежачи',
 'Lat Pulldown':'Тяга верхнього блоку','Face Pull':'Тяга до обличчя','Arnold Press':'Жим Арнольда',
 'Plank':'Планка','Front Squat':'Фронтальні присідання','Hack Squat':'Гакк-присідання',
 'Romanian Deadlift':'Румунська станова тяга','Sumo Deadlift':'Станова тяга сумо',
 'Pushups':'Віджимання','Push-Ups':'Віджимання','Wide-Grip Pushup':'Віджимання широким хватом',
 'Pull-Up':'Підтягування','Pullups':'Підтягування','Pull Ups':'Підтягування',
 'Weighted Pull Ups':'Підтягування з обтяженням','Wide-Grip Pull-Up':'Підтягування широким хватом',
 'Chin-Up':'Підтягування зворотним хватом','Chinup':'Підтягування зворотним хватом',
 'Dips':'Віджимання на брусах','Dip':'Віджимання на брусах','Chest Dip':'Віджимання на брусах',
 'Bench Dips':'Віджимання від лави','Plank':'Планка','Side Plank':'Бічна планка',
 'Crunch':'Скручування','Bicycle Crunch':'Скручування «велосипед»','Sit-Up':'Підйом тулуба',
 'Hanging Leg Raise':'Підйом ніг у висі','Hanging Knee Raise':'Підйом колін у висі',
 'Hyperextension':'Гіперекстензія','Back Extension':'Гіперекстензія','Russian Twist':'Російські скручування',
 'Good Morning':'Нахили зі штангою («гуд монінг»)','Farmers Walk':'Прогулянка фермера',
 'Overhead Squat':'Присідання зі штангою над головою','Split Squat':'Спліт-присідання',
 'Bulgarian Split Squat':'Болгарські спліт-присідання','Goblet Squat':'Присідання з гантеллю (goblet)',
 'Box Squat':'Присідання в ящик','Pistol Squat':'Присідання «пістолетик»',
 'Stiff-Legged Deadlift':'Станова тяга на прямих ногах','Stiff Leg Deadlift':'Станова тяга на прямих ногах',
 'Calf Raise':'Підйом на носки','Standing Calf Raise':'Підйом на носки стоячи',
 'Seated Calf Raise':'Підйом на носки сидячи',
}

def localize_uk(name, c):
    if name in OVER_UK: return OVER_UK[name]
    st=stretch_uk(name)
    if st: return st
    if c is None: return None
    return render_uk(c)

# =======================================================================
#  POLISH
# =======================================================================
EQ_PL={'barbell':('sztangi','ze sztangą'),'dumbbell':('hantli','z hantlami'),
 'cable':('wyciągu','na wyciągu'),'kettlebell':('kettlebella','z kettlebellem'),
 'machine':('','na maszynie'),'smith':('','w suwnicy Smitha'),'band':('','z gumą'),
 'ezbar':('sztangi łamanej','ze sztangą łamaną'),'tbar':('','na drążku T'),'plate':('','z talerzem')}
EQ_PL_ONE={'dumbbell':('hantla','hantlą')}
POS_PL={'standing':'stojąc','seated':'siedząc','lying':'leżąc','incline':'na ławce skośnej',
 'decline':'na ławce ujemnej','kneeling':'klęcząc','bentover':'w opadzie','prone':'leżąc na brzuchu',
 'supine':'leżąc na plecach','flat':'na ławce płaskiej','floor':'z podłogi','overhead':'nad głową','bench':'leżąc'}
GRIP_PL={'close':'wąskim chwytem','wide':'szerokim chwytem','medium':'średnim chwytem',
 'reverse':'nachwytem','hammer':'chwytem młotkowym','pronated':'nachwytem','supinated':'podchwytem',
 'neutral':'chwytem neutralnym','straightarm':'z wyprostowanymi ramionami'}
LAT_PL={'onearm':'jednorącz','twoarm':'oburącz','oneleg':'na jednej nodze','alt':'naprzemiennie'}
BODYPART_PL={'Chest':'klatki piersiowej','Hamstring':'mięśni dwugłowych uda','Hamstrings':'mięśni dwugłowych uda',
 'Quad':'mięśnia czworogłowego uda','Quads':'mięśni czworogłowych uda','Quadriceps':'mięśni czworogłowych uda',
 'Shoulder':'barków','Shoulders':'barków','Triceps':'tricepsa','Tricep':'tricepsa','Biceps':'bicepsa','Bicep':'bicepsa',
 'Back':'pleców','Lat':'najszerszych grzbietu','Lats':'najszerszych grzbietu','Calf':'łydek','Calves':'łydek',
 'Neck':'szyi','Hip':'bioder','Hips':'bioder','Groin':'pachwiny','Glute':'pośladków','Glutes':'pośladków',
 'Adductor':'przywodzicieli','Abductor':'odwodzicieli','Forearm':'przedramion','Forearms':'przedramion',
 'Wrist':'nadgarstków','Wrists':'nadgarstków','Ankle':'kostki','Spine':'kręgosłupa','Ab':'brzucha',
 'Abdominal':'brzucha','Oblique':'mięśni skośnych','Obliques':'mięśni skośnych','Trap':'czworobocznych',
 'Traps':'czworobocznych','Arm':'ramion','Arms':'ramion','Leg':'nóg','Legs':'nóg','Thigh':'uda'}
STRETCH_POS_PL={'Standing':'stojąc','Seated':'siedząc','Lying':'leżąc','Kneeling':'klęcząc',
 'Side':'w bok','Front':'','Prone':'leżąc na brzuchu','Supine':'leżąc na plecach'}

def eq_pl(c, case):
    e=c['equip']
    if not e: return ''
    if c['lat']=='onearm' and e in EQ_PL_ONE: return EQ_PL_ONE[e][0 if case=='gen' else 1]
    return EQ_PL[e][0 if case=='gen' else 1]
def eq_press_pl(c):
    return eq_pl(c,'gen') if c['equip'] in ('barbell','dumbbell','kettlebell','ezbar') else eq_pl(c,'instr')
def eq_fly_pl(c):
    return eq_pl(c,'instr') if c['equip'] in ('cable','machine','smith','band') else eq_pl(c,'instr')

def stretch_pl(name):
    toks=name.split()
    if toks[-1]!='Stretch': return None
    parts=[]; pos=''
    for t in toks[:-1]:
        if t in BODYPART_PL: parts.append(BODYPART_PL[t])
        elif t in STRETCH_POS_PL: pos=STRETCH_POS_PL[t] or pos
        else: return None
    if not parts: return None
    seen=set(); bp=[p for p in parts if not (p in seen or seen.add(p))]
    return join('Rozciąganie', ' '.join(bp), pos)

def render_pl(c):
    b=c['base']; regs=set(c['region']); mods=set(c['mods'])
    reardelt='reardelt' in regs or ('rear' in regs and 'lateral' in regs)
    if c['grip']=='reverse' and b=='fly': reardelt=True
    pos=POS_PL.get(c['pos'],''); grip=GRIP_PL.get(c['grip'],''); lat=LAT_PL.get(c['lat'],'')
    if mods - {'preacher','concentration','military','upright','sumo','back'}: return None
    if b=='press':
        if 'military' in mods: return join('Wyciskanie żołnierskie', eq_press_pl(c), pos, lat)
        if 'leg' in regs: return join('Wyciskanie nogami', pos, lat)
        if 'shoulder' in regs or c['pos']=='overhead': return join('Wyciskanie', eq_press_pl(c), 'nad głowę', grip, lat)
        return join('Wyciskanie', eq_press_pl(c), pos, grip, lat)
    if b=='curl':
        if 'wrist' in regs: return join('Uginanie nadgarstków', eq_pl(c,'instr'), pos, lat)
        if 'leg' in regs: return join('Uginanie nóg', pos, lat)
        mod=' na modlitewniku' if 'preacher' in mods else ''
        head='Uginanie ramion (koncentr.)' if 'concentration' in mods else 'Uginanie ramion'
        return join(head+mod, eq_pl(c,'instr') or '', grip, pos, lat)
    if b=='row':
        if 'upright' in mods: return join('Podciąganie', eq_pl(c,'gen') or eq_pl(c,'instr'), 'wzdłuż tułowia', grip, lat)
        return join('Wiosłowanie', eq_pl(c,'instr'), pos or ('w opadzie' if not c['pos'] and c['equip']=='barbell' else ''), grip, lat)
    if b=='raise':
        if reardelt: return join('Rozpiętki', eq_fly_pl(c), 'w opadzie', lat)
        if 'calf' in regs: return join('Wspięcia na palce', eq_pl(c,'instr'), pos, lat)
        if 'lateral' in regs or 'side' in regs: return join('Wznosy', eq_pl(c,'instr'), 'bokiem', pos, lat)
        if 'front' in regs: return join('Wznosy', eq_pl(c,'instr'), 'w przód', pos, lat)
        return join('Wznosy', eq_pl(c,'instr'), pos, lat)
    if b=='squat':
        return join('Przysiad', eq_pl(c,'instr'), pos, ('sumo' if 'sumo' in mods else ''), lat)
    if b=='deadlift':
        return join('Martwy ciąg', eq_pl(c,'instr'), ('sumo' if 'sumo' in mods else ''), lat)
    if b=='extension':
        if 'back' in mods: return join('Hiperekstensja', pos, lat)
        if 'leg' in regs: return join('Prostowanie nóg', pos, lat)
        if 'tricep' in regs or not regs: return join('Prostowanie ramion', eq_pl(c,'instr'), pos, grip, lat)
        return join('Prostowanie', eq_pl(c,'instr'), pos, lat)
    if b=='fly':
        if reardelt: return join('Rozpiętki', eq_fly_pl(c), 'w opadzie', lat)
        if c['equip']=='cable': return join('Krzyżowanie linek wyciągu', pos, lat)
        return join('Rozpiętki', eq_pl(c,'instr'), pos, lat)
    if b=='pulldown': return join('Ściąganie drążka wyciągu górnego', grip, lat)
    if b=='pushdown': return join('Prostowanie ramion na wyciągu', grip, lat)
    if b=='lunge': return join('Wykroki', eq_pl(c,'instr'), pos, lat)
    if b=='shrug': return join('Wzruszanie ramion', eq_pl(c,'instr'), pos, lat)
    if b=='crunch':
        extra='na wyciągu' if c['equip']=='cable' else ('na maszynie' if c['equip']=='machine' else '')
        return join('Spięcia brzucha', extra, pos, lat)
    if b=='pullover': return join('Pullover', eq_pl(c,'instr'), pos, lat)
    if b=='crossover': return join('Krzyżowanie linek wyciągu', pos, lat)
    if b=='kickback': return join('Prostowanie ramienia w opadzie', eq_pl(c,'instr'), lat)
    if b=='thrust': return join('Unoszenie bioder', eq_pl(c,'instr'), lat)
    if b=='bridge': return join('Mostek biodrowy', eq_pl(c,'instr'), lat)
    return None

OVER_PL={
 'Bench Press':'Wyciskanie leżąc','Barbell Bench Press':'Wyciskanie sztangi na ławce',
 'Dumbbell Bench Press':'Wyciskanie hantli na ławce','Push-Up':'Pompki','Pushups':'Pompki','Push-Ups':'Pompki',
 'Pull-Up':'Podciąganie','Pullups':'Podciąganie','Pull Ups':'Podciąganie','Weighted Pull Ups':'Podciąganie z obciążeniem',
 'Chin-Up':'Podciąganie podchwytem','Dips':'Pompki na poręczach','Dip':'Pompki na poręczach','Chest Dip':'Pompki na poręczach',
 'Bench Dips':'Pompki na ławce','Plank':'Deska','Side Plank':'Deska bokiem','Sit-Up':'Brzuszki (unoszenie tułowia)',
 'Russian Twist':'Rosyjski skręt','Hanging Leg Raise':'Unoszenie nóg w zwisie','Hanging Knee Raise':'Unoszenie kolan w zwisie',
 'Hyperextension':'Hiperekstensja','Back Extension':'Hiperekstensja','Good Morning':'Skłony „dzień dobry”',
 'Farmers Walk':'Marsz farmera','Front Squat':'Przysiad przedni','Hack Squat':'Hack przysiad',
 'Overhead Squat':'Przysiad ze sztangą nad głową','Split Squat':'Przysiad w wykroku','Bulgarian Split Squat':'Bułgarski przysiad',
 'Goblet Squat':'Przysiad goblet','Box Squat':'Przysiad na skrzynię','Pistol Squat':'Przysiad pistolet',
 'Romanian Deadlift':'Rumuński martwy ciąg','Sumo Deadlift':'Martwy ciąg sumo',
 'Stiff-Legged Deadlift':'Martwy ciąg na prostych nogach','Stiff Leg Deadlift':'Martwy ciąg na prostych nogach',
 'Leg Press':'Wyciskanie nogami','Leg Extension':'Prostowanie nóg','Leg Curl':'Uginanie nóg leżąc','Seated Leg Curl':'Uginanie nóg siedząc',
 'Lat Pulldown':'Ściąganie drążka wyciągu górnego','Face Pull':'Przyciąganie do twarzy','Arnold Press':'Wyciskanie Arnolda',
 'Calf Raise':'Wspięcia na palce','Standing Calf Raise':'Wspięcia na palce stojąc','Seated Calf Raise':'Wspięcia na palce siedząc',
}

def localize_pl(name, c):
    if name in OVER_PL: return OVER_PL[name]
    st=stretch_pl(name)
    if st: return st
    if c is None: return None
    return render_pl(c)

def cap(s):
    s=s.strip()
    return s[:1].upper()+s[1:] if s else s

# =======================================================================
#  LITHUANIAN  (genitive modifier precedes the noun: "Štangos spaudimas")
# =======================================================================
GENSET={'barbell','dumbbell','kettlebell','ezbar'}
EQ_LT={'barbell':{'gen':'štangos','instr':'su štanga'},
 'dumbbell':{'gen':'hantelių','instr':'su hanteliais','gen1':'hantelio','instr1':'su hanteliu'},
 'cable':{'gen':'bloko','instr':'prie bloko'},'kettlebell':{'gen':'svarsčio','instr':'su svarsčiu'},
 'machine':{'gen':'','instr':'treniruokliu'},'smith':{'gen':'','instr':'Smito treniruoklyje'},
 'ezbar':{'gen':'lenktos štangos','instr':'su lenkta štanga'},'band':{'gen':'','instr':'su guma'},
 'plate':{'gen':'','instr':'su svoriu'},'tbar':{'gen':'','instr':'su T grifu'}}
POS_LT={'standing':'stovint','seated':'sėdint','lying':'gulint','incline':'ant pakrypusio suolo',
 'decline':'ant nuožulnaus suolo','kneeling':'klūpint','bentover':'pasilenkus','prone':'gulint ant pilvo',
 'supine':'gulint ant nugaros','flat':'ant horizontalaus suolo','floor':'nuo grindų','overhead':'virš galvos','bench':'gulint'}
GRIP_LT={'close':'siauru griebimu','wide':'plačiu griebimu','medium':'vidutiniu griebimu','reverse':'viršutiniu griebimu',
 'hammer':'neutraliu griebimu','pronated':'viršutiniu griebimu','supinated':'apatiniu griebimu','neutral':'neutraliu griebimu',
 'straightarm':'tiesiomis rankomis'}
LAT_LT={'onearm':'viena ranka','twoarm':'abiem rankomis','oneleg':'ant vienos kojos','alt':'pakaitomis'}
BODYPART_LT={'Chest':'krūtinės','Hamstring':'užpakalinių šlaunies raumenų','Hamstrings':'užpakalinių šlaunies raumenų',
 'Quad':'keturgalvio šlaunies raumens','Quads':'keturgalvių šlaunies raumenų','Quadriceps':'keturgalvio šlaunies raumens',
 'Shoulder':'pečių','Shoulders':'pečių','Triceps':'tricepso','Tricep':'tricepso','Biceps':'bicepso','Bicep':'bicepso',
 'Back':'nugaros','Lat':'plačiausiojo nugaros raumens','Lats':'plačiausiojo nugaros raumens','Calf':'blauzdų','Calves':'blauzdų',
 'Neck':'kaklo','Hip':'klubų','Hips':'klubų','Groin':'kirkšnies','Glute':'sėdmenų','Glutes':'sėdmenų',
 'Adductor':'pritraukiamųjų raumenų','Abductor':'atitraukiamųjų raumenų','Forearm':'dilbių','Forearms':'dilbių',
 'Wrist':'riešų','Wrists':'riešų','Ankle':'kulkšnies','Spine':'stuburo','Ab':'pilvo','Abdominal':'pilvo',
 'Oblique':'šoninių pilvo raumenų','Obliques':'šoninių pilvo raumenų','Trap':'trapecinių raumenų','Traps':'trapecinių raumenų',
 'Arm':'rankų','Arms':'rankų','Leg':'kojų','Legs':'kojų','Thigh':'šlaunų'}
STRETCH_POS_LT={'Standing':'stovint','Seated':'sėdint','Lying':'gulint','Kneeling':'klūpint',
 'Side':'į šoną','Front':'','Prone':'gulint ant pilvo','Supine':'gulint ant nugaros'}

def eqhead_lt(c, head):
    e=c['equip']
    if not e: return head
    d=EQ_LT[e]
    if e in GENSET:
        g=d.get('gen1',d['gen']) if (c['lat']=='onearm' and 'gen1' in d) else d['gen']
        return join(g, head)
    i=d.get('instr1',d['instr']) if (c['lat']=='onearm' and 'instr1' in d) else d['instr']
    return join(head, i)

def stretch_lt(name):
    toks=name.split()
    if toks[-1]!='Stretch': return None
    parts=[]; pos=''
    for t in toks[:-1]:
        if t in BODYPART_LT: parts.append(BODYPART_LT[t])
        elif t in STRETCH_POS_LT: pos=STRETCH_POS_LT[t] or pos
        else: return None
    if not parts: return None
    seen=set(); bp=[p for p in parts if not (p in seen or seen.add(p))]
    return cap(join(' '.join(bp), 'tempimas', pos))

def render_lt(c):
    b=c['base']; regs=set(c['region']); mods=set(c['mods'])
    reardelt='reardelt' in regs or ('rear' in regs and 'lateral' in regs)
    if c['grip']=='reverse' and b=='fly': reardelt=True
    pos=POS_LT.get(c['pos'],''); grip=GRIP_LT.get(c['grip'],''); lat=LAT_LT.get(c['lat'],'')
    if mods - {'preacher','concentration','military','upright','sumo','back'}: return None
    R=None
    if b=='press':
        if 'military' in mods: R=join(eqhead_lt(c,'kariškas spaudimas'), pos, lat)
        elif 'leg' in regs: R=join('kojų spaudimas', pos, lat)
        elif 'shoulder' in regs or c['pos']=='overhead': R=join(eqhead_lt(c,'spaudimas'), 'virš galvos', grip, lat)
        else: R=join(eqhead_lt(c,'spaudimas'), pos, grip, lat)
    elif b=='curl':
        if 'wrist' in regs: R=join(eqhead_lt(c,'riešų lenkimas'), pos, lat)
        elif 'leg' in regs: R=join('kojų lenkimas', pos, lat)
        else:
            mod=' ant Skoto suolo' if 'preacher' in mods else ''
            R=join(eqhead_lt(c,'bicepso lenkimas'+mod), grip, pos, lat)
    elif b=='row':
        if 'upright' in mods: R=join(eqhead_lt(c,'traukimas'), 'prie smakro', grip, lat)
        else: R=join(eqhead_lt(c,'traukimas'), pos or ('pasilenkus' if not c['pos'] and c['equip']=='barbell' else ''), grip, lat)
    elif b=='raise':
        if reardelt: R=join(eqhead_lt(c,'rankų skėtimas'), 'pasilenkus', lat)
        elif 'calf' in regs: R=join('stotis ant pirštų galų', pos, lat)
        elif 'lateral' in regs or 'side' in regs: R=join('rankų kėlimas į šonus', c['equip'] and EQ_LT[c['equip']]['instr'] or '', pos, lat)
        elif 'front' in regs: R=join('rankų kėlimas į priekį', c['equip'] and EQ_LT[c['equip']]['instr'] or '', pos, lat)
        else: R=join(eqhead_lt(c,'kėlimas'), pos, lat)
    elif b=='squat':
        R=join(eqhead_lt(c,'pritūpimai'), pos, ('sumo' if 'sumo' in mods else ''), lat)
    elif b=='deadlift':
        R=join(('sumo ' if 'sumo' in mods else '')+'mirties trauka', (EQ_LT[c['equip']]['instr'] if c['equip'] and c['equip'] not in GENSET else ''), lat)
        if c['equip'] in GENSET: R=join(EQ_LT[c['equip']]['gen'],('sumo ' if 'sumo' in mods else '')+'mirties trauka', lat)
    elif b=='extension':
        if 'back' in mods: R=join('nugaros tiesimas', pos, lat)
        elif 'leg' in regs: R=join('kojų tiesimas', pos, lat)
        elif 'tricep' in regs or not regs: R=join(eqhead_lt(c,'tricepso tiesimas'), pos, grip, lat)
        else: R=join(eqhead_lt(c,'tiesimas'), pos, lat)
    elif b=='fly':
        if reardelt: R=join(eqhead_lt(c,'rankų skėtimas'), 'pasilenkus', lat)
        elif c['equip']=='cable': R=join('rankų suvedimas kroseryje', pos, lat)
        else: R=join(eqhead_lt(c,'rankų skėtimas'), pos, lat)
    elif b=='pulldown': R=join('viršutinio bloko traukimas', grip, lat)
    elif b=='pushdown': R=join('rankų tiesimas prie bloko', grip, lat)
    elif b=='lunge': R=join(eqhead_lt(c,'išpuoliai'), pos, lat)
    elif b=='shrug': R=join(eqhead_lt(c,'pečių gūžčiojimas'), pos, lat)
    elif b=='crunch':
        extra='prie bloko' if c['equip']=='cable' else ('treniruokliu' if c['equip']=='machine' else '')
        R=join('atsilenkimai', extra, pos, lat)
    elif b=='pullover': R=join(eqhead_lt(c,'pullover'), pos, lat)
    elif b=='crossover': R=join('rankų suvedimas kroseryje', pos, lat)
    elif b=='kickback': R=join('tricepso atmetimas pasilenkus', lat)
    elif b=='thrust': R=join(eqhead_lt(c,'klubų kėlimas'), lat)
    elif b=='bridge': R=join(eqhead_lt(c,'tiltas'), lat)
    return cap(R) if R else None

OVER_LT={
 'Bench Press':'Spaudimas gulint','Barbell Bench Press':'Štangos spaudimas gulint',
 'Dumbbell Bench Press':'Hantelių spaudimas gulint','Push-Up':'Atsispaudimai','Pushups':'Atsispaudimai','Push-Ups':'Atsispaudimai',
 'Pull-Up':'Prisitraukimai','Pullups':'Prisitraukimai','Pull Ups':'Prisitraukimai','Weighted Pull Ups':'Prisitraukimai su svoriu',
 'Chin-Up':'Prisitraukimai apatiniu griebimu','Dips':'Atsispaudimai ant lygiagrečių','Dip':'Atsispaudimai ant lygiagrečių',
 'Chest Dip':'Atsispaudimai ant lygiagrečių','Bench Dips':'Atsispaudimai nuo suoliuko','Plank':'Lenta','Side Plank':'Šoninė lenta',
 'Sit-Up':'Liemens kėlimas','Russian Twist':'Rusiški sukimai','Hanging Leg Raise':'Kojų kėlimas kabant',
 'Hanging Knee Raise':'Kelių kėlimas kabant','Hyperextension':'Hiperekstenzija','Back Extension':'Nugaros tiesimas',
 'Good Morning':'Pasilenkimai su štanga („good morning“)','Farmers Walk':'Ūkininko ėjimas','Front Squat':'Priekiniai pritūpimai',
 'Hack Squat':'Hack pritūpimai','Overhead Squat':'Pritūpimai su štanga virš galvos','Split Squat':'Išpuolio pritūpimai',
 'Bulgarian Split Squat':'Bulgariški pritūpimai','Goblet Squat':'Goblet pritūpimai','Box Squat':'Pritūpimai ant dėžės',
 'Pistol Squat':'Pistoleto pritūpimai','Romanian Deadlift':'Rumuniška mirties trauka','Sumo Deadlift':'Sumo mirties trauka',
 'Stiff-Legged Deadlift':'Mirties trauka tiesiomis kojomis','Stiff Leg Deadlift':'Mirties trauka tiesiomis kojomis',
 'Leg Press':'Kojų spaudimas','Leg Extension':'Kojų tiesimas','Leg Curl':'Kojų lenkimas gulint','Seated Leg Curl':'Kojų lenkimas sėdint',
 'Lat Pulldown':'Viršutinio bloko traukimas','Face Pull':'Traukimas prie veido','Arnold Press':'Arnoldo spaudimas',
 'Calf Raise':'Stotis ant pirštų galų','Standing Calf Raise':'Stotis ant pirštų galų stovint','Seated Calf Raise':'Blauzdų kėlimas sėdint',
}

def localize_lt(name, c):
    if name in OVER_LT: return OVER_LT[name]
    st=stretch_lt(name)
    if st: return st
    if c is None: return None
    return render_lt(c)

# =======================================================================
#  ESTONIAN  (genitive modifier precedes the noun: "Kangi surumine")
# =======================================================================
EQ_ET={'barbell':{'gen':'kangi','instr':'kangiga'},
 'dumbbell':{'gen':'hantlite','instr':'hantlitega','gen1':'hantli','instr1':'hantliga'},
 'cable':{'gen':'kaabli','instr':'kaabliga'},'kettlebell':{'gen':'kettlebelli','instr':'kettlebelliga'},
 'machine':{'gen':'','instr':'masinal'},'smith':{'gen':'','instr':'Smithi masinas'},
 'ezbar':{'gen':'kõverkangi','instr':'kõverkangiga'},'band':{'gen':'','instr':'kummiga'},
 'plate':{'gen':'','instr':'kettaga'},'tbar':{'gen':'','instr':'T-kangiga'}}
POS_ET={'standing':'seistes','seated':'istudes','lying':'lamades','incline':'kaldpingil','decline':'langpingil',
 'kneeling':'põlvitades','bentover':'kummardudes','prone':'kõhuli','supine':'selili','flat':'sirgel pingil',
 'floor':'põrandalt','overhead':'pea kohal','bench':'lamades'}
GRIP_ET={'close':'kitsa haardega','wide':'laia haardega','medium':'keskmise haardega','reverse':'pöördhaardega',
 'hammer':'haamerhaardega','pronated':'pealthaardega','supinated':'althaardega','neutral':'neutraalhaardega',
 'straightarm':'sirgete kätega'}
LAT_ET={'onearm':'ühe käega','twoarm':'kahe käega','oneleg':'ühel jalal','alt':'vaheldumisi'}
BODYPART_ET={'Chest':'rinnalihaste','Hamstring':'reie tagakülje','Hamstrings':'reie tagakülje',
 'Quad':'reie nelipealihase','Quads':'reie nelipealihaste','Quadriceps':'reie nelipealihase','Shoulder':'õlgade','Shoulders':'õlgade',
 'Triceps':'triitsepsi','Tricep':'triitsepsi','Biceps':'biitsepsi','Bicep':'biitsepsi','Back':'selja',
 'Lat':'selja laiima lihase','Lats':'selja laiima lihase','Calf':'säärte','Calves':'säärte','Neck':'kaela',
 'Hip':'puusade','Hips':'puusade','Groin':'kubeme','Glute':'tuharate','Glutes':'tuharate',
 'Adductor':'lähendajalihaste','Abductor':'eemaldajalihaste','Forearm':'küünarvarte','Forearms':'küünarvarte',
 'Wrist':'randmete','Wrists':'randmete','Ankle':'hüppeliigese','Spine':'selgroo','Ab':'kõhulihaste','Abdominal':'kõhulihaste',
 'Oblique':'kõhu külglihaste','Obliques':'kõhu külglihaste','Trap':'trapetslihaste','Traps':'trapetslihaste',
 'Arm':'käte','Arms':'käte','Leg':'jalgade','Legs':'jalgade','Thigh':'reie'}
STRETCH_POS_ET={'Standing':'seistes','Seated':'istudes','Lying':'lamades','Kneeling':'põlvitades',
 'Side':'küljele','Front':'','Prone':'kõhuli','Supine':'selili'}

def eqhead_et(c, head):
    e=c['equip']
    if not e: return head
    d=EQ_ET[e]
    if e in GENSET:
        g=d.get('gen1',d['gen']) if (c['lat']=='onearm' and 'gen1' in d) else d['gen']
        return join(g, head)
    i=d.get('instr1',d['instr']) if (c['lat']=='onearm' and 'instr1' in d) else d['instr']
    return join(head, i)

def stretch_et(name):
    toks=name.split()
    if toks[-1]!='Stretch': return None
    parts=[]; pos=''
    for t in toks[:-1]:
        if t in BODYPART_ET: parts.append(BODYPART_ET[t])
        elif t in STRETCH_POS_ET: pos=STRETCH_POS_ET[t] or pos
        else: return None
    if not parts: return None
    seen=set(); bp=[p for p in parts if not (p in seen or seen.add(p))]
    return cap(join(' '.join(bp), 'venitus', pos))

def render_et(c):
    b=c['base']; regs=set(c['region']); mods=set(c['mods'])
    reardelt='reardelt' in regs or ('rear' in regs and 'lateral' in regs)
    if c['grip']=='reverse' and b=='fly': reardelt=True
    pos=POS_ET.get(c['pos'],''); grip=GRIP_ET.get(c['grip'],''); lat=LAT_ET.get(c['lat'],'')
    if mods - {'preacher','concentration','military','upright','sumo','back'}: return None
    R=None
    if b=='press':
        if 'military' in mods: R=join(eqhead_et(c,'püstisurumine'), pos, lat)
        elif 'leg' in regs: R=join('jalgade surumine', pos, lat)
        elif 'shoulder' in regs or c['pos']=='overhead': R=join(eqhead_et(c,'surumine'), 'pea kohal', grip, lat)
        else: R=join(eqhead_et(c,'surumine'), pos, grip, lat)
    elif b=='curl':
        if 'wrist' in regs: R=join(eqhead_et(c,'randmete painutus'), pos, lat)
        elif 'leg' in regs: R=join('jalgade painutus', pos, lat)
        else:
            mod=' Scotti pingil' if 'preacher' in mods else ''
            R=join(eqhead_et(c,'biitsepsi kõverdus'+mod), grip, pos, lat)
    elif b=='row':
        if 'upright' in mods: R=join(eqhead_et(c,'püsttõmme'), grip, lat)
        else: R=join(eqhead_et(c,'tõmme'), pos or ('kummardudes' if not c['pos'] and c['equip']=='barbell' else ''), grip, lat)
    elif b=='raise':
        if reardelt: R=join(eqhead_et(c,'tagatõsted'), 'kummardudes', lat)
        elif 'calf' in regs: R=join('sääretõsted', (EQ_ET[c['equip']]['instr'] if c['equip'] and c['equip'] not in GENSET else ''), pos, lat) if c['equip'] not in GENSET else join(EQ_ET[c['equip']]['gen'] if c['equip'] else '','sääretõsted', pos, lat)
        elif 'lateral' in regs or 'side' in regs: R=join('külgtõsted', (EQ_ET[c['equip']]['instr'] if c['equip'] else ''), pos, lat)
        elif 'front' in regs: R=join('esitõsted', (EQ_ET[c['equip']]['instr'] if c['equip'] else ''), pos, lat)
        else: R=join(eqhead_et(c,'tõsted'), pos, lat)
    elif b=='squat':
        R=join(eqhead_et(c,'kükk'), pos, ('sumo' if 'sumo' in mods else ''), lat)
    elif b=='deadlift':
        if c['equip'] in GENSET: R=join(EQ_ET[c['equip']]['gen'], ('sumo ' if 'sumo' in mods else '')+'jõutõmme', lat)
        else: R=join(('sumo ' if 'sumo' in mods else '')+'jõutõmme', (EQ_ET[c['equip']]['instr'] if c['equip'] else ''), lat)
    elif b=='extension':
        if 'back' in mods: R=join('seljasirutus', pos, lat)
        elif 'leg' in regs: R=join('jalgade sirutus', pos, lat)
        elif 'tricep' in regs or not regs: R=join(eqhead_et(c,'triitsepsi sirutus'), pos, grip, lat)
        else: R=join(eqhead_et(c,'sirutus'), pos, lat)
    elif b=='fly':
        if reardelt: R=join(eqhead_et(c,'tagalengud'), 'kummardudes', lat)
        elif c['equip']=='cable': R=join('kaabli ristamine', pos, lat)
        else: R=join(eqhead_et(c,'lengud'), pos, lat)
    elif b=='pulldown': R=join('ülatõmme', grip, lat)
    elif b=='pushdown': R=join('triitsepsi allasurumine', grip, lat)
    elif b=='lunge': R=join(eqhead_et(c,'väljaasted'), pos, lat)
    elif b=='shrug': R=join(eqhead_et(c,'õlakehitused'), pos, lat)
    elif b=='crunch':
        extra='kaabliga' if c['equip']=='cable' else ('masinal' if c['equip']=='machine' else '')
        R=join('kõhulihaste kõverdused', extra, pos, lat)
    elif b=='pullover': R=join(eqhead_et(c,'pullover'), pos, lat)
    elif b=='crossover': R=join('kaabli ristamine', pos, lat)
    elif b=='kickback': R=join('triitsepsi tahatõmme', lat)
    elif b=='thrust': R=join(eqhead_et(c,'puusatõuge'), lat)
    elif b=='bridge': R=join(eqhead_et(c,'sild'), lat)
    return cap(R) if R else None

OVER_ET={
 'Bench Press':'Lamades surumine','Barbell Bench Press':'Kangi surumine lamades',
 'Dumbbell Bench Press':'Hantlite surumine lamades','Push-Up':'Kätekõverdused','Pushups':'Kätekõverdused','Push-Ups':'Kätekõverdused',
 'Pull-Up':'Lõuatõmbed','Pullups':'Lõuatõmbed','Pull Ups':'Lõuatõmbed','Weighted Pull Ups':'Lõuatõmbed lisaraskusega',
 'Chin-Up':'Lõuatõmbed althaardega','Dips':'Rööbaskätekõverdused','Dip':'Rööbaskätekõverdused','Chest Dip':'Rööbaskätekõverdused',
 'Bench Dips':'Kätekõverdused pingilt','Plank':'Plank','Side Plank':'Külgplank','Sit-Up':'Kõhutõus',
 'Russian Twist':'Vene keerutus','Hanging Leg Raise':'Jalgade tõste rippes','Hanging Knee Raise':'Põlvede tõste rippes',
 'Hyperextension':'Hüperekstensioon','Back Extension':'Seljasirutus','Good Morning':'Kummardused kangiga („good morning“)',
 'Farmers Walk':'Farmeri kõnd','Front Squat':'Esikükk','Hack Squat':'Hack-kükk','Overhead Squat':'Kükk kangiga pea kohal',
 'Split Squat':'Väljaastekükk','Bulgarian Split Squat':'Bulgaaria kükk','Goblet Squat':'Goblet-kükk','Box Squat':'Kükk kastile',
 'Pistol Squat':'Püstolkükk','Romanian Deadlift':'Rumeenia jõutõmme','Sumo Deadlift':'Sumo jõutõmme',
 'Stiff-Legged Deadlift':'Jõutõmme sirgete jalgadega','Stiff Leg Deadlift':'Jõutõmme sirgete jalgadega',
 'Leg Press':'Jalgade surumine','Leg Extension':'Jalgade sirutus','Leg Curl':'Jalgade painutus lamades','Seated Leg Curl':'Jalgade painutus istudes',
 'Lat Pulldown':'Ülatõmme','Face Pull':'Tõmme näo poole','Arnold Press':'Arnoldi surumine',
 'Calf Raise':'Sääretõsted','Standing Calf Raise':'Sääretõsted seistes','Seated Calf Raise':'Sääretõsted istudes',
}

def localize_et(name, c):
    if name in OVER_ET: return OVER_ET[name]
    st=stretch_et(name)
    if st: return st
    if c is None: return None
    return render_et(c)

# ---- late additions: cheap classifier wins + common overrides ----
IGNORE |= {'Lat','Bodyweight'}
OVER_UK.update({
 'Mountain Climber':'Скелелаз','Mountain Climbers':'Скелелаз','Box Jump':'Застрибування на тумбу',
 'Wall Sit':'Присід біля стіни','Kettlebell Swing':'Махи гирею','Kettlebell Swings':'Махи гирею',
 'Jumping Jack':'Стрибки «джампінг-джек»','Jumping Jacks':'Стрибки «джампінг-джек»','Burpee':'Бьорпі','Burpees':'Бьорпі',
 'Clean':'Взяття на груди','Power Clean':'Силове взяття на груди','Hang Clean':'Взяття на груди з вису',
 'Snatch':'Ривок','Bicycle Crunch':'Скручування «велосипед»','Reverse Crunch':'Зворотні скручування',
 'Glute Bridge':'Ягодичний міст','Hip Thrust':'Підйом таза','Barbell Hip Thrust':'Підйом таза зі штангою',
 'Incline Bench Press':'Жим лежачи на похилій лаві','Decline Bench Press':'Жим лежачи на негативній лаві',
 'Close-Grip Bench Press':'Жим лежачи вузьким хватом','Concentration Curl':'Концентрований підйом на біцепс',
})
OVER_PL.update({
 'Mountain Climber':'Wspinaczka','Mountain Climbers':'Wspinaczka','Box Jump':'Wskok na skrzynię',
 'Wall Sit':'Krzesełko','Kettlebell Swing':'Wymach kettlebell','Kettlebell Swings':'Wymachy kettlebell',
 'Jumping Jack':'Pajacyki','Jumping Jacks':'Pajacyki','Burpee':'Burpee','Burpees':'Burpee',
 'Clean':'Zarzut','Power Clean':'Zarzut siłowy','Hang Clean':'Zarzut z zawieszenia',
 'Snatch':'Rwanie','Bicycle Crunch':'Rowerek','Reverse Crunch':'Spięcia odwrotne',
 'Glute Bridge':'Mostek biodrowy','Hip Thrust':'Unoszenie bioder','Barbell Hip Thrust':'Unoszenie bioder ze sztangą',
 'Incline Bench Press':'Wyciskanie na ławce skośnej','Decline Bench Press':'Wyciskanie na ławce ujemnej',
 'Close-Grip Bench Press':'Wyciskanie wąskim chwytem','Concentration Curl':'Uginanie ramion w podporze (koncentr.)',
})
OVER_LT.update({
 'Mountain Climber':'Alpinistas','Mountain Climbers':'Alpinistas','Box Jump':'Šuolis ant dėžės',
 'Wall Sit':'Sėdėjimas prie sienos','Kettlebell Swing':'Svarsčio siūbavimas','Kettlebell Swings':'Svarsčio siūbavimas',
 'Jumping Jack':'Šokinėjimas žvaigždute','Jumping Jacks':'Šokinėjimas žvaigždute','Burpee':'Burpee','Burpees':'Burpee',
 'Clean':'Vertimas į krūtinę','Power Clean':'Galios vertimas','Hang Clean':'Vertimas iš pakabos',
 'Snatch':'Rovimas','Bicycle Crunch':'Dviratuko atsilenkimai','Reverse Crunch':'Atvirkštiniai atsilenkimai',
 'Glute Bridge':'Sėdmenų tiltas','Hip Thrust':'Klubų kėlimas','Barbell Hip Thrust':'Klubų kėlimas su štanga',
 'Incline Bench Press':'Spaudimas ant pakrypusio suolo','Decline Bench Press':'Spaudimas ant nuožulnaus suolo',
 'Close-Grip Bench Press':'Spaudimas siauru griebimu','Concentration Curl':'Koncentruotas bicepso lenkimas',
})
OVER_ET.update({
 'Mountain Climber':'Mägironija','Mountain Climbers':'Mägironija','Box Jump':'Kastile hüpe',
 'Wall Sit':'Seinatool','Kettlebell Swing':'Kettlebelli hoog','Kettlebell Swings':'Kettlebelli hoog',
 'Jumping Jack':'Haaratõmbe-hüpped','Jumping Jacks':'Haaratõmbe-hüpped','Burpee':'Burpee','Burpees':'Burpee',
 'Clean':'Rinnalevõte','Power Clean':'Jõurinnalevõte','Hang Clean':'Rinnalevõte rippest',
 'Snatch':'Rebimine','Bicycle Crunch':'Jalgratta kõverdus','Reverse Crunch':'Pöördkõverdus',
 'Glute Bridge':'Tuharasild','Hip Thrust':'Puusatõuge','Barbell Hip Thrust':'Puusatõuge kangiga',
 'Incline Bench Press':'Kaldpingil surumine','Decline Bench Press':'Langpingil surumine',
 'Close-Grip Bench Press':'Kitsa haardega surumine','Concentration Curl':'Kontsentreeritud biitsepsi kõverdus',
})


# --- curated common accessories (bodyweight, cable & named curls) ----------
OVER_UK.update({
 'Barbell Ab Rollout':'Розкатування зі штангою','Barbell Ab Rollout - On Knees':'Розкатування зі штангою з колін',
 'Ab Roller':'Розкатування на ролику для преса','Drag Curl':'Драг-згинання на біцепс',
 'High Cable Curls':'Згинання на біцепс на верхньому блоці','Spider Curl':'Спайдер-згинання на біцепс',
 'Zottman Curl':'Згинання Зоттмана','Incline Push-Up':'Віджимання від піднятої опори',
 'Decline Push-Up':'Віджимання з піднятими ногами','Push-Up Wide':'Віджимання широким хватом',
 'Handstand Push-Ups':'Віджимання в стійці на руках','Muscle Up':'Вихід силою',
 'Ring Dips':'Віджимання на кільцях','Inverted Row':'Австралійські підтягування',
 'Scapular Pull-Up':'Лопаткові підтягування','Plyo Push-up':'Пліометричні віджимання',
 'Clock Push-Up':'Віджимання «годинник»',
})
OVER_PL.update({
 'Barbell Ab Rollout':'Rollout ze sztangą','Barbell Ab Rollout - On Knees':'Rollout ze sztangą z kolan',
 'Ab Roller':'Rollout na kółku do brzucha','Drag Curl':'Uginanie ramion (drag)',
 'High Cable Curls':'Uginanie ramion na górnym wyciągu','Spider Curl':'Uginanie ramion (spider)',
 'Zottman Curl':'Uginanie Zottmana','Incline Push-Up':'Pompki z rękami na podwyższeniu',
 'Decline Push-Up':'Pompki z nogami na podwyższeniu','Push-Up Wide':'Pompki szerokim rozstawem rąk',
 'Handstand Push-Ups':'Pompki w staniu na rękach','Muscle Up':'Muscle up',
 'Ring Dips':'Pompki na kółkach gimnastycznych','Inverted Row':'Wiosłowanie australijskie',
 'Scapular Pull-Up':'Podciąganie łopatkowe','Plyo Push-up':'Pompki pliometryczne',
 'Clock Push-Up':'Pompki zegarowe',
})
OVER_LT.update({
 'Barbell Ab Rollout':'Rollout su štanga','Barbell Ab Rollout - On Knees':'Rollout su štanga nuo kelių',
 'Ab Roller':'Pilvo ratukas','Drag Curl':'Bicepso lenkimas (drag)',
 'High Cable Curls':'Bicepso lenkimas prie viršutinio bloko','Spider Curl':'Bicepso lenkimas (spider)',
 'Zottman Curl':'Zottmano lenkimas','Incline Push-Up':'Atsispaudimai nuo paaukštinimo',
 'Decline Push-Up':'Atsispaudimai su pakeltomis kojomis','Push-Up Wide':'Atsispaudimai plačiu rankų mostu',
 'Handstand Push-Ups':'Atsispaudimai stovint ant rankų','Muscle Up':'Muscle up',
 'Ring Dips':'Atsispaudimai ant žiedų','Inverted Row':'Australiški prisitraukimai',
 'Scapular Pull-Up':'Menčių prisitraukimai','Plyo Push-up':'Pliometriniai atsispaudimai',
})
OVER_ET.update({
 'Barbell Ab Rollout':'Rollout kangiga','Barbell Ab Rollout - On Knees':'Rollout kangiga põlvedelt',
 'Ab Roller':'Kõharull','Drag Curl':'Biitsepsi kõverdus (drag)',
 'High Cable Curls':'Biitsepsi kõverdus ülemiselt plokilt','Spider Curl':'Biitsepsi kõverdus (spider)',
 'Zottman Curl':'Zottmani kõverdus','Incline Push-Up':'Kätekõverdused kõrgemalt toelt',
 'Decline Push-Up':'Kätekõverdused tõstetud jalgadega','Push-Up Wide':'Laia haardega kätekõverdused',
 'Handstand Push-Ups':'Kätekõverdused käteseisus','Muscle Up':'Muscle up',
 'Ring Dips':'Rõngastel kätekõverdused','Inverted Row':'Horisontaalsed lõuatõmbed',
 'Scapular Pull-Up':'Abaluu lõuatõmbed','Plyo Push-up':'Plüomeetrilised kätekõverdused',
})

# ---------------- run: build all four + JSON ----------------
LOCS={'uk':localize_uk,'pl':localize_pl,'lt':localize_lt,'et':localize_et}
out={}; cov={k:0 for k in LOCS}
for e in EX:
    c=parse(e['name'])
    entry={}
    for k,fn in LOCS.items():
        v=fn(e['name'], c)
        if v and v.strip() and v.strip()!=e['name']:
            entry[k]=v.strip(); cov[k]+=1
    if entry:
        out[e['name']]=entry   # keyed by canonical English name for runtime lookup
n=len(EX)
print("coverage:", {k:f"{cov[k]}/{n} ({round(cov[k]/n*100)}%)" for k in LOCS})
json.dump(out, open('exerciseNames.generated.json','w'), ensure_ascii=False,
          indent=0, sort_keys=True)
print("names with >=1 localization:", len(out))
