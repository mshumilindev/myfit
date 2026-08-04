/**
 * Built-in exercise catalog: curated, offline, fully localised (en/uk/pl/lt/et).
 * Search matches any language. History entries always rank above the catalog.
 * Names tuple order: [en, uk, pl, lt, et].
 */
import DB_RAW from './exercises.db.json';
import type { EquipmentId } from './equipment';

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'fullbody'
  | 'cardio';

export interface CatalogExercise {
  id: string;
  muscle: MuscleGroup;
  names: [string, string, string, string, string];
  /** Equipment (free-exercise-db taxonomy); null = unknown/none listed. */
  equipment?: EquipmentId | null;
}

const x = (
  id: string,
  muscle: MuscleGroup,
  en: string,
  uk: string,
  pl: string,
  lt: string,
  et: string,
): CatalogExercise => ({ id, muscle, names: [en, uk, pl, lt, et] });

export const EXERCISE_CATALOG: CatalogExercise[] = [
  // --- Chest ---------------------------------------------------------------
  x(
    'bench-press',
    'chest',
    'Bench Press',
    'Жим штанги лежачи',
    'Wyciskanie sztangi leżąc',
    'Štangos spaudimas gulint',
    'Kangi surumine lamades',
  ),
  x(
    'incline-bench-press',
    'chest',
    'Incline Bench Press',
    'Жим штанги на похилій лаві',
    'Wyciskanie sztangi na ławce skośnej',
    'Spaudimas nuožulniame suole',
    'Kangi surumine kaldpingil',
  ),
  x(
    'decline-bench-press',
    'chest',
    'Decline Bench Press',
    'Жим штанги вниз головою',
    'Wyciskanie sztangi głową w dół',
    'Spaudimas žemyn pasvirusiame suole',
    'Kangi surumine langpingil',
  ),
  x(
    'dumbbell-bench-press',
    'chest',
    'Dumbbell Bench Press',
    'Жим гантелей лежачи',
    'Wyciskanie hantli leżąc',
    'Hantelių spaudimas gulint',
    'Hantlite surumine lamades',
  ),
  x(
    'incline-dumbbell-press',
    'chest',
    'Incline Dumbbell Press',
    'Жим гантелей на похилій лаві',
    'Wyciskanie hantli na ławce skośnej',
    'Hantelių spaudimas nuožulniai',
    'Hantlite surumine kaldpingil',
  ),
  x(
    'dumbbell-fly',
    'chest',
    'Dumbbell Fly',
    'Розведення гантелей лежачи',
    'Rozpiętki z hantlami',
    'Hantelių skėtimas gulint',
    'Hantlite lahtiviimine lamades',
  ),
  x(
    'incline-dumbbell-fly',
    'chest',
    'Incline Dumbbell Fly',
    'Розведення гантелей на похилій лаві',
    'Rozpiętki na ławce skośnej',
    'Hantelių skėtimas nuožulniai',
    'Hantlite lahtiviimine kaldpingil',
  ),
  x(
    'cable-crossover',
    'chest',
    'Cable Crossover',
    'Зведення рук у кросовері',
    'Krzyżowanie linek wyciągu',
    'Trosų sukryžiavimas',
    'Plokitõmbed risti',
  ),
  x(
    'pec-deck',
    'chest',
    'Pec Deck (Machine Fly)',
    'Метелик (тренажер)',
    'Motylek (maszyna)',
    'Peteliškė (treniruoklis)',
    'Liblikas (masin)',
  ),
  x(
    'chest-press-machine',
    'chest',
    'Chest Press Machine',
    'Жим від грудей у тренажері',
    'Wyciskanie na maszynie',
    'Krūtinės spaudimas treniruokliu',
    'Rinnalt surumise masin',
  ),
  x(
    'push-up',
    'chest',
    'Push-Up',
    'Віджимання від підлоги',
    'Pompki',
    'Atsispaudimai',
    'Kätekõverdused',
  ),
  x(
    'weighted-push-up',
    'chest',
    'Weighted Push-Up',
    'Віджимання з обтяженням',
    'Pompki z obciążeniem',
    'Atsispaudimai su svoriu',
    'Kätekõverdused raskusega',
  ),
  x(
    'dips-chest',
    'chest',
    'Chest Dips',
    'Віджимання на брусах (груди)',
    'Dipy na poręczach (klatka)',
    'Atsispaudimai ant lygiagrečių (krūtinė)',
    'Dipid rööbaspuudel (rind)',
  ),
  x(
    'smith-bench-press',
    'chest',
    'Smith Machine Bench Press',
    'Жим лежачи в Сміті',
    'Wyciskanie w maszynie Smitha',
    'Spaudimas Smito treniruoklyje',
    'Surumine Smithi masinas',
  ),
  x(
    'svend-press',
    'chest',
    'Svend Press',
    'Жим Свенда',
    'Wyciskanie Svenda',
    'Svendo spaudimas',
    'Svendi surumine',
  ),
  x(
    'floor-press',
    'chest',
    'Floor Press',
    'Жим з підлоги',
    'Wyciskanie z podłogi',
    'Spaudimas nuo grindų',
    'Põrandalt surumine',
  ),
  x(
    'pullover',
    'chest',
    'Dumbbell Pullover',
    'Пуловер з гантеллю',
    'Przenoszenie hantla za głowę',
    'Hantelio perkėlimas už galvos',
    'Hantli ülekanne pea taha',
  ),

  // --- Back ----------------------------------------------------------------
  x('deadlift', 'back', 'Deadlift', 'Станова тяга', 'Martwy ciąg', 'Mirties trauka', 'Jõutõmme'),
  x(
    'romanian-deadlift',
    'hamstrings',
    'Romanian Deadlift',
    'Румунська тяга',
    'Rumuński martwy ciąg',
    'Rumuniška trauka',
    'Rumeenia jõutõmme',
  ),
  x(
    'sumo-deadlift',
    'back',
    'Sumo Deadlift',
    'Станова тяга сумо',
    'Martwy ciąg sumo',
    'Sumo trauka',
    'Sumo jõutõmme',
  ),
  x(
    'pull-up',
    'back',
    'Pull-Up',
    'Підтягування',
    'Podciąganie nachwytem',
    'Prisitraukimai',
    'Lõuatõmbed',
  ),
  x(
    'chin-up',
    'back',
    'Chin-Up',
    'Підтягування зворотним хватом',
    'Podciąganie podchwytem',
    'Prisitraukimai atvirkštiniu suėmimu',
    'Lõuatõmbed althaardes',
  ),
  x(
    'weighted-pull-up',
    'back',
    'Weighted Pull-Up',
    'Підтягування з обтяженням',
    'Podciąganie z obciążeniem',
    'Prisitraukimai su svoriu',
    'Lõuatõmbed raskusega',
  ),
  x(
    'lat-pulldown',
    'back',
    'Lat Pulldown',
    'Тяга верхнього блока',
    'Ściąganie drążka wyciągu górnego',
    'Viršutinio bloko trauka',
    'Ülalt alla tõmbamine plokil',
  ),
  x(
    'close-grip-pulldown',
    'back',
    'Close-Grip Pulldown',
    'Тяга верхнього блока вузьким хватом',
    'Ściąganie wyciągu wąskim chwytem',
    'Bloko trauka siauru suėmimu',
    'Plokitõmme kitsa haardega',
  ),
  x(
    'barbell-row',
    'back',
    'Barbell Row',
    'Тяга штанги в нахилі',
    'Wiosłowanie sztangą',
    'Štangos trauka pasilenkus',
    'Kangi sõudmine ettekallutatult',
  ),
  x(
    'pendlay-row',
    'back',
    'Pendlay Row',
    'Тяга Пендлея',
    'Wiosłowanie Pendlaya',
    'Pendlay trauka',
    'Pendlay sõudmine',
  ),
  x(
    'dumbbell-row',
    'back',
    'One-Arm Dumbbell Row',
    'Тяга гантелі однією рукою',
    'Wiosłowanie hantlem jednorącz',
    'Hantelio trauka viena ranka',
    'Hantli sõudmine ühe käega',
  ),
  x(
    'seated-cable-row',
    'back',
    'Seated Cable Row',
    'Тяга нижнього блока сидячи',
    'Wiosłowanie na wyciągu siedząc',
    'Apatinio bloko trauka sėdint',
    'Istudes plokitõmme',
  ),
  x(
    't-bar-row',
    'back',
    'T-Bar Row',
    'Тяга Т-грифа',
    'Wiosłowanie sztangą T',
    'T-grifo trauka',
    'T-kangi sõudmine',
  ),
  x(
    'chest-supported-row',
    'back',
    'Chest-Supported Row',
    'Тяга з упором грудьми',
    'Wiosłowanie z podparciem klatki',
    'Trauka atsirėmus krūtine',
    'Sõudmine rinnatoega',
  ),
  x(
    'machine-row',
    'back',
    'Machine Row',
    'Тяга в тренажері',
    'Wiosłowanie na maszynie',
    'Trauka treniruokliu',
    'Sõudmine masinal',
  ),
  x(
    'straight-arm-pulldown',
    'back',
    'Straight-Arm Pulldown',
    'Тяга блока прямими руками',
    'Przyciąganie prostymi rękami',
    'Bloko trauka tiesiomis rankomis',
    'Sirgete kätega plokitõmme',
  ),
  x(
    'rack-pull',
    'back',
    'Rack Pull',
    'Тяга з плінтів',
    'Martwy ciąg ze stojaków',
    'Trauka nuo stovų',
    'Jõutõmme alustelt',
  ),
  x(
    'good-morning',
    'hamstrings',
    'Good Morning',
    'Нахили зі штангою («Доброго ранку»)',
    'Skłony ze sztangą (Good Morning)',
    'Pasilenkimai su štanga (Good Morning)',
    'Kummardused kangiga (Good Morning)',
  ),
  x(
    'back-extension',
    'back',
    'Back Extension',
    'Гіперекстензія',
    'Wznosy tułowia (hiperekstensja)',
    'Hiperekstenzija',
    'Hüperekstensioon',
  ),
  x(
    'shrug',
    'back',
    'Barbell Shrug',
    'Шраги зі штангою',
    'Szrugsy ze sztangą',
    'Pečių gūžčiojimas su štanga',
    'Õlakehitused kangiga',
  ),
  x(
    'dumbbell-shrug',
    'back',
    'Dumbbell Shrug',
    'Шраги з гантелями',
    'Szrugsy z hantlami',
    'Gūžčiojimas su hanteliais',
    'Õlakehitused hantlitega',
  ),
  x(
    'inverted-row',
    'back',
    'Inverted Row',
    'Австралійські підтягування',
    'Wiosłowanie w podporze (australian row)',
    'Atvirkštinė trauka',
    'Ümberpööratud sõudmine',
  ),

  // --- Shoulders -----------------------------------------------------------
  x(
    'overhead-press',
    'shoulders',
    'Overhead Press',
    'Жим штанги стоячи',
    'Wyciskanie żołnierskie (OHP)',
    'Štangos spaudimas stovint',
    'Kangi surumine üles seistes',
  ),
  x(
    'seated-dumbbell-press',
    'shoulders',
    'Seated Dumbbell Press',
    'Жим гантелей сидячи',
    'Wyciskanie hantli siedząc',
    'Hantelių spaudimas sėdint',
    'Hantlite surumine istudes',
  ),
  x(
    'arnold-press',
    'shoulders',
    'Arnold Press',
    'Жим Арнольда',
    'Wyciskanie Arnolda',
    'Arnoldo spaudimas',
    'Arnoldi surumine',
  ),
  x(
    'push-press',
    'shoulders',
    'Push Press',
    'Швунг жимовий',
    'Push press',
    'Push press',
    'Push press',
  ),
  x(
    'lateral-raise',
    'shoulders',
    'Lateral Raise',
    'Махи гантелями в сторони',
    'Wznosy hantli bokiem',
    'Hantelių kėlimas į šonus',
    'Hantlite tõsted kõrvale',
  ),
  x(
    'cable-lateral-raise',
    'shoulders',
    'Cable Lateral Raise',
    'Махи в сторони на блоці',
    'Wznosy bokiem na wyciągu',
    'Kėlimas į šoną ant bloko',
    'Tõsted kõrvale plokil',
  ),
  x(
    'front-raise',
    'shoulders',
    'Front Raise',
    'Підйом гантелей перед собою',
    'Wznosy hantli przodem',
    'Hantelių kėlimas priešais save',
    'Hantlite tõsted ette',
  ),
  x(
    'rear-delt-fly',
    'shoulders',
    'Rear Delt Fly',
    'Розведення на задні дельти',
    'Odwrotne rozpiętki',
    'Užpakalinių deltų skėtimas',
    'Tagumise õlaosa lahtiviimine',
  ),
  x(
    'face-pull',
    'shoulders',
    'Face Pull',
    'Тяга канату до обличчя',
    'Face pull (przyciąganie liny do twarzy)',
    'Virvės trauka į veidą',
    'Trossitõmme näo suunas',
  ),
  x(
    'upright-row',
    'shoulders',
    'Upright Row',
    'Тяга штанги до підборіддя',
    'Podciąganie sztangi wzdłuż tułowia',
    'Štangos trauka iki smakro',
    'Kangitõmme lõuani',
  ),
  x(
    'machine-shoulder-press',
    'shoulders',
    'Machine Shoulder Press',
    'Жим у тренажері на плечі',
    'Wyciskanie na maszynie (barki)',
    'Pečių spaudimas treniruokliu',
    'Õlasurumise masin',
  ),
  x(
    'reverse-pec-deck',
    'shoulders',
    'Reverse Pec Deck',
    'Зворотний метелик',
    'Odwrotny motylek',
    'Atvirkštinė peteliškė',
    'Tagurpidi liblikas',
  ),

  // --- Biceps --------------------------------------------------------------
  x(
    'barbell-curl',
    'biceps',
    'Barbell Curl',
    'Згинання рук зі штангою',
    'Uginanie ramion ze sztangą',
    'Rankų lenkimas su štanga',
    'Kangi biitsepsipainutus',
  ),
  x(
    'ez-bar-curl',
    'biceps',
    'EZ-Bar Curl',
    'Згинання рук з EZ-грифом',
    'Uginanie ze sztangą łamaną',
    'Lenkimas su EZ grifu',
    'EZ-kangi painutus',
  ),
  x(
    'dumbbell-curl',
    'biceps',
    'Dumbbell Curl',
    'Згинання рук з гантелями',
    'Uginanie ramion z hantlami',
    'Rankų lenkimas su hanteliais',
    'Hantlite biitsepsipainutus',
  ),
  x(
    'hammer-curl',
    'biceps',
    'Hammer Curl',
    'Молоткові згинання',
    'Uginanie młotkowe',
    'Plaktukiniai lenkimai',
    'Haamerpainutus',
  ),
  x(
    'incline-curl',
    'biceps',
    'Incline Dumbbell Curl',
    'Згинання на похилій лаві',
    'Uginanie na ławce skośnej',
    'Lenkimas ant nuožulnaus suolo',
    'Painutused kaldpingil',
  ),
  x(
    'preacher-curl',
    'biceps',
    'Preacher Curl',
    'Згинання на лаві Скотта',
    'Uginanie na modlitewniku',
    'Lenkimas ant Skoto suolo',
    'Scotti pingil painutus',
  ),
  x(
    'concentration-curl',
    'biceps',
    'Concentration Curl',
    'Концентроване згинання',
    'Uginanie koncentryczne',
    'Koncentruotas lenkimas',
    'Kontsentreeritud painutus',
  ),
  x(
    'cable-curl',
    'biceps',
    'Cable Curl',
    'Згинання рук на блоці',
    'Uginanie na wyciągu',
    'Lenkimas ant bloko',
    'Plokil painutus',
  ),
  x(
    'spider-curl',
    'biceps',
    'Spider Curl',
    'Павучі згинання',
    'Uginanie spider',
    'Voro lenkimai',
    'Ämblikpainutus',
  ),

  // --- Triceps -------------------------------------------------------------
  x(
    'close-grip-bench',
    'triceps',
    'Close-Grip Bench Press',
    'Жим вузьким хватом',
    'Wyciskanie wąskim chwytem',
    'Spaudimas siauru suėmimu',
    'Kitsa haardega surumine',
  ),
  x(
    'dips-triceps',
    'triceps',
    'Triceps Dips',
    'Віджимання на брусах (трицепс)',
    'Dipy (triceps)',
    'Atsispaudimai ant lygiagrečių (tricepsas)',
    'Dipid (triitseps)',
  ),
  x(
    'bench-dips',
    'triceps',
    'Bench Dips',
    'Зворотні віджимання від лави',
    'Pompki tyłem o ławkę',
    'Atsispaudimai atbulomis nuo suolo',
    'Dipid pingi najal',
  ),
  x(
    'triceps-pushdown',
    'triceps',
    'Triceps Pushdown',
    'Розгинання рук на блоці',
    'Prostowanie ramion na wyciągu',
    'Rankų tiesimas ant bloko',
    'Triitsepsi allasurumine plokil',
  ),
  x(
    'rope-pushdown',
    'triceps',
    'Rope Pushdown',
    'Розгинання з канатом',
    'Prostowanie z liną',
    'Tiesimas su virve',
    'Trossiga allasurumine',
  ),
  x(
    'overhead-triceps-extension',
    'triceps',
    'Overhead Triceps Extension',
    'Французький жим стоячи (з-за голови)',
    'Wyciskanie francuskie zza głowy',
    'Prancūziškas spaudimas virš galvos',
    'Triitsepsi sirutus pea tagant',
  ),
  x(
    'skull-crusher',
    'triceps',
    'Skull Crusher',
    'Французький жим лежачи',
    'Wyciskanie francuskie leżąc',
    'Prancūziškas spaudimas gulint',
    'Prantsuse surumine lamades',
  ),
  x(
    'triceps-kickback',
    'triceps',
    'Triceps Kickback',
    'Розгинання руки в нахилі',
    'Kickback (prostowanie w opadzie)',
    'Rankos tiesimas pasilenkus',
    'Triitsepsi tahatõuge',
  ),

  // --- Forearms ------------------------------------------------------------
  x(
    'wrist-curl',
    'forearms',
    'Wrist Curl',
    'Згинання зап’ясть',
    'Uginanie nadgarstków',
    'Riešų lenkimas',
    'Randmepainutus',
  ),
  x(
    'reverse-curl',
    'forearms',
    'Reverse Curl',
    'Зворотні згинання',
    'Uginanie nachwytem',
    'Atvirkštiniai lenkimai',
    'Painutus pealthaardes',
  ),
  x(
    'farmers-walk',
    'forearms',
    "Farmer's Walk",
    'Прогулянка фермера',
    'Spacer farmera',
    'Ūkininko ėjimas',
    'Talumehe kõnd',
  ),
  x(
    'dead-hang',
    'forearms',
    'Dead Hang',
    'Вис на перекладині',
    'Zwis na drążku',
    'Kabėjimas ant skersinio',
    'Rippumine kangil',
  ),

  // --- Quads / legs --------------------------------------------------------
  x(
    'back-squat',
    'quads',
    'Back Squat',
    'Присідання зі штангою',
    'Przysiad ze sztangą',
    'Pritūpimai su štanga',
    'Kükk kangiga seljal',
  ),
  x(
    'front-squat',
    'quads',
    'Front Squat',
    'Фронтальні присідання',
    'Przysiad przedni',
    'Priekiniai pritūpimai',
    'Eeskükk',
  ),
  x(
    'goblet-squat',
    'quads',
    'Goblet Squat',
    'Гоблет-присідання',
    'Przysiad goblet',
    'Goblet pritūpimai',
    'Pokaalkükk',
  ),
  x(
    'smith-squat',
    'quads',
    'Smith Machine Squat',
    'Присідання в Сміті',
    'Przysiad w Smith machine',
    'Pritūpimai Smito treniruoklyje',
    'Kükk Smithi masinas',
  ),
  x(
    'hack-squat',
    'quads',
    'Hack Squat',
    'Гак-присідання',
    'Hack przysiad',
    'Hack pritūpimai',
    'Hack-kükk',
  ),
  x(
    'leg-press',
    'quads',
    'Leg Press',
    'Жим ногами',
    'Wyciskanie nogami',
    'Kojų spaudimas',
    'Jalapress',
  ),
  x(
    'bulgarian-split-squat',
    'quads',
    'Bulgarian Split Squat',
    'Болгарські випади',
    'Przysiad bułgarski',
    'Bulgariški įtūpstai',
    'Bulgaaria kükk',
  ),
  x('lunge', 'quads', 'Lunge', 'Випади', 'Wykroki', 'Įtūpstai', 'Väljaasted'),
  x(
    'walking-lunge',
    'quads',
    'Walking Lunge',
    'Випади в русі',
    'Wykroki chodzone',
    'Įtūpstai einant',
    'Kõndivad väljaasted',
  ),
  x(
    'reverse-lunge',
    'quads',
    'Reverse Lunge',
    'Зворотні випади',
    'Wykroki w tył',
    'Atbuliniai įtūpstai',
    'Tagurpidi väljaasted',
  ),
  x(
    'step-up',
    'quads',
    'Step-Up',
    'Зашагування на тумбу',
    'Wejścia na skrzynię',
    'Užlipimai ant dėžės',
    'Astumised kastile',
  ),
  x(
    'leg-extension',
    'quads',
    'Leg Extension',
    'Розгинання ніг у тренажері',
    'Prostowanie nóg na maszynie',
    'Kojų tiesimas treniruokliu',
    'Jalasirutus masinal',
  ),
  x(
    'sissy-squat',
    'quads',
    'Sissy Squat',
    'Сісі-присідання',
    'Sissy squat',
    'Sissy pritūpimai',
    'Sissy-kükk',
  ),
  x(
    'box-squat',
    'quads',
    'Box Squat',
    'Присідання на ящик',
    'Przysiad na skrzynię',
    'Pritūpimai ant dėžės',
    'Kükk kastile',
  ),
  x(
    'pause-squat',
    'quads',
    'Pause Squat',
    'Присідання з паузою',
    'Przysiad z pauzą',
    'Pritūpimai su pauze',
    'Pausiga kükk',
  ),
  x(
    'pistol-squat',
    'quads',
    'Pistol Squat',
    'Присідання «пістолетик»',
    'Przysiad na jednej nodze (pistolet)',
    'Pritūpimai ant vienos kojos',
    'Püstolkükk',
  ),

  // --- Hamstrings / glutes -------------------------------------------------
  x(
    'leg-curl',
    'hamstrings',
    'Lying Leg Curl',
    'Згинання ніг лежачи',
    'Uginanie nóg leżąc',
    'Kojų lenkimas gulint',
    'Jalapainutus lamades',
  ),
  x(
    'seated-leg-curl',
    'hamstrings',
    'Seated Leg Curl',
    'Згинання ніг сидячи',
    'Uginanie nóg siedząc',
    'Kojų lenkimas sėdint',
    'Jalapainutus istudes',
  ),
  x(
    'nordic-curl',
    'hamstrings',
    'Nordic Hamstring Curl',
    'Нордичні згинання',
    'Nordic curl',
    'Šiaurietiški lenkimai',
    'Põhjamaine reiepainutus',
  ),
  x(
    'stiff-leg-deadlift',
    'hamstrings',
    'Stiff-Leg Deadlift',
    'Тяга на прямих ногах',
    'Martwy ciąg na prostych nogach',
    'Trauka tiesiomis kojomis',
    'Sirgete jalgadega jõutõmme',
  ),
  x(
    'hip-thrust',
    'glutes',
    'Hip Thrust',
    'Сідничний міст зі штангою',
    'Hip thrust',
    'Klubų kėlimas su štanga',
    'Puusatõste kangiga',
  ),
  x(
    'glute-bridge',
    'glutes',
    'Glute Bridge',
    'Сідничний міст',
    'Mostek biodrowy',
    'Sėdmenų tiltelis',
    'Tuharasild',
  ),
  x(
    'cable-kickback',
    'glutes',
    'Cable Glute Kickback',
    'Відведення ноги назад на блоці',
    'Odwodzenie nogi w tył na wyciągu',
    'Kojos atitraukimas atgal ant bloko',
    'Jala tahatõuge plokil',
  ),
  x(
    'hip-abduction',
    'glutes',
    'Hip Abduction Machine',
    'Розведення ніг у тренажері',
    'Odwodzenie nóg na maszynie',
    'Kojų skėtimas treniruokliu',
    'Puusade eemaldusmasin',
  ),
  x(
    'hip-adduction',
    'glutes',
    'Hip Adduction Machine',
    'Зведення ніг у тренажері',
    'Przywodzenie nóg na maszynie',
    'Kojų suvedimas treniruokliu',
    'Puusade lähendusmasin',
  ),
  x(
    'kettlebell-swing',
    'glutes',
    'Kettlebell Swing',
    'Махи гирею',
    'Wymachy kettlebell',
    'Svarsčio mostai',
    'Sangpommi hood',
  ),

  // --- Calves --------------------------------------------------------------
  x(
    'standing-calf-raise',
    'calves',
    'Standing Calf Raise',
    'Підйоми на носки стоячи',
    'Wspięcia na palce stojąc',
    'Stiebimasis ant pirštų stovint',
    'Säärt tõsted seistes',
  ),
  x(
    'seated-calf-raise',
    'calves',
    'Seated Calf Raise',
    'Підйоми на носки сидячи',
    'Wspięcia na palce siedząc',
    'Stiebimasis sėdint',
    'Sääretõsted istudes',
  ),
  x(
    'calf-press',
    'calves',
    'Calf Press (Leg Press)',
    'Жим носками в платформі',
    'Wspięcia na suwnicy',
    'Blauzdų spaudimas kojų preso',
    'Sääred jalapressil',
  ),

  // --- Core ----------------------------------------------------------------
  x('plank', 'core', 'Plank', 'Планка', 'Deska (plank)', 'Lenta', 'Plank'),
  x(
    'side-plank',
    'core',
    'Side Plank',
    'Бічна планка',
    'Deska boczna',
    'Šoninė lenta',
    'Külgplank',
  ),
  x(
    'crunch',
    'core',
    'Crunch',
    'Скручування',
    'Brzuszki (spięcia)',
    'Susisukimai',
    'Kõhulihaste kripsud',
  ),
  x(
    'cable-crunch',
    'core',
    'Cable Crunch',
    'Скручування на блоці',
    'Spięcia na wyciągu (allahy)',
    'Susisukimai ant bloko',
    'Kripsud plokil',
  ),
  x(
    'sit-up',
    'core',
    'Sit-Up',
    'Підйоми корпусу',
    'Siady z leżenia',
    'Atsisėdimai',
    'Istessetõusud',
  ),
  x(
    'hanging-leg-raise',
    'core',
    'Hanging Leg Raise',
    'Підйоми ніг у висі',
    'Unoszenie nóg w zwisie',
    'Kojų kėlimas kabant',
    'Jalatõsted rippes',
  ),
  x(
    'hanging-knee-raise',
    'core',
    'Hanging Knee Raise',
    'Підйоми колін у висі',
    'Unoszenie kolan w zwisie',
    'Kelių kėlimas kabant',
    'Põlvetõsted rippes',
  ),
  x(
    'leg-raise',
    'core',
    'Lying Leg Raise',
    'Підйоми ніг лежачи',
    'Unoszenie nóg leżąc',
    'Kojų kėlimas gulint',
    'Jalatõsted lamades',
  ),
  x(
    'russian-twist',
    'core',
    'Russian Twist',
    'Скручування сидячи з поворотом',
    'Skręty tułowia (russian twist)',
    'Liemens sukimai sėdint',
    'Keretwistid istudes',
  ),
  x(
    'ab-wheel',
    'core',
    'Ab Wheel Rollout',
    'Ролик для преса',
    'Kółko do brzucha (rollout)',
    'Pilvo ratukas',
    'Kõhurulli rullimine',
  ),
  x(
    'dead-bug',
    'core',
    'Dead Bug',
    'Мертвий жук',
    'Martwy robak (dead bug)',
    'Negyvas vabalas',
    'Surnud putukas',
  ),
  x('bird-dog', 'core', 'Bird Dog', 'Птах-собака', 'Bird dog', 'Paukštis-šuo', 'Linnukoer'),
  x(
    'mountain-climbers',
    'core',
    'Mountain Climbers',
    'Скелелаз',
    'Wspinaczka górska (mountain climbers)',
    'Kalnų kopikas',
    'Mägironija',
  ),
  x(
    'pallof-press',
    'core',
    'Pallof Press',
    'Жим Паллофа',
    'Pallof press',
    'Pallof spaudimas',
    'Pallofi surumine',
  ),
  x(
    'woodchopper',
    'core',
    'Cable Woodchopper',
    'Дроворуб на блоці',
    'Drwal na wyciągu',
    'Medkirtys ant bloko',
    'Puuraiumine plokil',
  ),
  x(
    'hyperextension-oblique',
    'core',
    'Side Bend',
    'Нахили в сторони',
    'Skłony boczne',
    'Lenkimai į šoną',
    'Küljekallutused',
  ),

  // --- Full body / olympic -------------------------------------------------
  x(
    'clean-and-jerk',
    'fullbody',
    'Clean and Jerk',
    'Поштовх',
    'Podrzut',
    'Nutraukimas ir išstūmimas',
    'Rebimine ja tõukamine',
  ),
  x('snatch', 'fullbody', 'Snatch', 'Ривок', 'Rwanie', 'Rovimas', 'Rebimine'),
  x(
    'power-clean',
    'fullbody',
    'Power Clean',
    'Взяття на груди в стійку',
    'Zarzut siłowy',
    'Jėgos užsimetimas',
    'Jõuvõte rinnale',
  ),
  x('thruster', 'fullbody', 'Thruster', 'Трастер', 'Thruster', 'Trasteris', 'Truster'),
  x('burpee', 'fullbody', 'Burpee', 'Берпі', 'Burpees', 'Burpis', 'Burpee'),
  x(
    'turkish-get-up',
    'fullbody',
    'Turkish Get-Up',
    'Турецький підйом',
    'Tureckie wstawanie',
    'Turkiškas atsikėlimas',
    'Türgi ülestõus',
  ),
  x(
    'sled-push',
    'fullbody',
    'Sled Push',
    'Штовхання санчат',
    'Pchanie sań',
    'Rogučių stūmimas',
    'Kelgu lükkamine',
  ),
  x(
    'battle-ropes',
    'fullbody',
    'Battle Ropes',
    'Канати',
    'Liny treningowe',
    'Kovos virvės',
    'Lahingutrossid',
  ),
  x(
    'box-jump',
    'fullbody',
    'Box Jump',
    'Стрибки на тумбу',
    'Wskoki na skrzynię',
    'Šuoliai ant dėžės',
    'Hüpped kastile',
  ),
  x(
    'wall-ball',
    'fullbody',
    'Wall Ball',
    'Кидки м’яча в стіну',
    'Wall ball (rzuty piłką)',
    'Kamuolio metimai į sieną',
    'Palliheited vastu seina',
  ),
  x(
    'medicine-ball-slam',
    'fullbody',
    'Medicine Ball Slam',
    'Кидки медбола в підлогу',
    'Uderzenia piłką lekarską',
    'Medicininio kamuolio metimai',
    'Topispalli löögid',
  ),

  // --- Cardio --------------------------------------------------------------
  x(
    'treadmill-run',
    'cardio',
    'Treadmill Run',
    'Біг на доріжці',
    'Bieg na bieżni',
    'Bėgimas takeliu',
    'Jooks jooksulindil',
  ),
  x(
    'treadmill-walk-incline',
    'cardio',
    'Incline Treadmill Walk',
    'Ходьба в гору на доріжці',
    'Marsz pod górę na bieżni',
    'Ėjimas įkalne takeliu',
    'Kõnd kaldega lindil',
  ),
  x(
    'stationary-bike',
    'cardio',
    'Stationary Bike',
    'Велотренажер',
    'Rower stacjonarny',
    'Dviračio treniruoklis',
    'Veloergomeeter',
  ),
  x(
    'rowing-machine',
    'cardio',
    'Rowing Machine',
    'Гребний тренажер',
    'Ergometr wioślarski',
    'Irklavimo treniruoklis',
    'Sõudeergomeeter',
  ),
  x(
    'elliptical',
    'cardio',
    'Elliptical',
    'Орбітрек',
    'Orbitrek',
    'Elipsinis treniruoklis',
    'Elliptiline trenažöör',
  ),
  x(
    'stair-climber',
    'cardio',
    'Stair Climber',
    'Степер (сходи)',
    'Schodki (stair climber)',
    'Laiptų treniruoklis',
    'Trepironija masin',
  ),
  x('assault-bike', 'cardio', 'Assault Bike', 'Ейр-байк', 'Air bike', 'Oro dviratis', 'Õhuratas'),
  x(
    'ski-erg',
    'cardio',
    'Ski Erg',
    'Скі-ергометр',
    'Ski erg',
    'Slidinėjimo ergometras',
    'Suusaergomeeter',
  ),
  x(
    'bent-over-row',
    'back',
    'Bent-over Row',
    'Тяга в нахилі',
    'Wiosłowanie w opadzie',
    'Trauka pasilenkus',
    'Sõudmine ettekallutatult',
  ),
  x(
    'leg-curl',
    'hamstrings',
    'Leg Curl',
    'Згинання ніг',
    'Uginanie nóg',
    'Kojų lenkimas',
    'Jalgade painutus',
  ),
  x(
    'calf-raise',
    'calves',
    'Calf Raise',
    'Підйоми на носки',
    'Wspięcia na palce',
    'Kėlimasis ant pirštų galų',
    'Päkkadele tõus',
  ),
  x('jump-rope', 'cardio', 'Jump Rope', 'Скакалка', 'Skakanka', 'Šokdynė', 'Hüppenöör'),
];

// --- free-exercise-db import (public domain, 873 entries) -------------------
// Compact rows [name, equipment|null, muscle]. English-only names; the curated
// localized catalog above stays first-class and DB rows fill the long tail.

type DbRow = [string, EquipmentId | null, MuscleGroup];
const DB_ROWS = DB_RAW as DbRow[];

/** Curated EN name (lowercased) → equipment, learned from the DB by name. */
const DB_EQUIP_BY_NAME = new Map<string, EquipmentId | null>(
  DB_ROWS.map((r) => [r[0].toLowerCase(), r[1]]),
);

const EXTRA_EQUIP: Record<string, EquipmentId> = {
  'bent-over-row': 'barbell',
  'leg-curl': 'machine',
  'calf-raise': 'body',
};

const CURATED_EN = new Set(EXERCISE_CATALOG.map((e) => e.names[0].toLowerCase()));

/** Curated entries enriched with equipment where the DB knows the same name. */
export const CURATED: CatalogExercise[] = EXERCISE_CATALOG.map((e) => ({
  ...e,
  equipment:
    e.equipment ?? EXTRA_EQUIP[e.id] ?? DB_EQUIP_BY_NAME.get(e.names[0].toLowerCase()) ?? null,
}));

/** DB rows as catalog entries (EN name in every slot), minus curated dupes. */
const DB_ENTRIES: CatalogExercise[] = DB_ROWS.filter(
  (r) => !CURATED_EN.has(r[0].toLowerCase()),
).map((r, i) => ({
  id: `db-${i}`,
  muscle: r[2],
  names: [r[0], r[0], r[0], r[0], r[0]],
  equipment: r[1],
}));

// --- Muscle metadata (design MG/EQ) -----------------------------------------
// An exercise carries one primary group and any number of secondary ones
// (EQ-4). Secondaries for curated entries are listed explicitly where the
// boards show them; the long tail falls back to movement-pattern keywords.

const SECONDARY_BY_ID: Record<string, MuscleGroup[]> = {
  'bent-over-row': ['biceps'],
  'leg-curl': [],
  'calf-raise': [],
  'back-squat': ['glutes', 'core'],
  'front-squat': ['core'],
  'bulgarian-split-squat': ['glutes'],
  'goblet-squat': ['core'],
  'zercher-squat': ['core', 'back'],
  'hack-squat': ['glutes'],
  'barbell-lunge': ['glutes'],
  'leg-press': ['glutes'],
  'bench-press': ['triceps'],
  'incline-bench-press': ['triceps', 'shoulders'],
  'decline-bench-press': ['triceps'],
  'dumbbell-bench-press': ['triceps'],
  'incline-dumbbell-press': ['triceps', 'shoulders'],
  'romanian-deadlift': ['glutes', 'back'],
  deadlift: ['glutes', 'hamstrings', 'back'],
  'hip-thrust': ['hamstrings'],
};

const SECONDARY_RULES: Array<[RegExp, MuscleGroup, MuscleGroup[]]> = [
  [/squat|lunge|leg press/i, 'quads', ['glutes']],
  [/bench|push-?up|press/i, 'chest', ['triceps']],
  [/row|pull-?up|pulldown|chin/i, 'back', ['biceps']],
  [/deadlift/i, 'hamstrings', ['glutes', 'back']],
  [/deadlift/i, 'back', ['glutes', 'hamstrings']],
  [/overhead|shoulder press|military/i, 'shoulders', ['triceps']],
  [/dip/i, 'triceps', ['chest']],
  [/thrust|bridge/i, 'glutes', ['hamstrings']],
];

/** Secondary muscle groups for a catalog entry (possibly empty). */
export function secondaryMusclesOf(ex: CatalogExercise): MuscleGroup[] {
  const custom = CUSTOM_SECONDARIES(ex.id);
  if (custom) return custom;
  const explicit = SECONDARY_BY_ID[ex.id];
  if (explicit) return explicit;
  for (const [re, primary, secondaries] of SECONDARY_RULES) {
    if (primary === ex.muscle && re.test(ex.names[0])) return secondaries;
  }
  return [];
}

export interface MuscleInfo {
  primary: MuscleGroup;
  secondary: MuscleGroup[];
  equipment: EquipmentId | null;
}

const BY_NAME = new Map<string, CatalogExercise>();
for (const ex of [...CURATED, ...DB_ENTRIES]) {
  for (const n of ex.names) {
    const key = n.trim().toLowerCase();
    if (key && !BY_NAME.has(key)) BY_NAME.set(key, ex);
  }
}

// --- Server catalog: custom exercises authored by admins/trainers -----------
// The hub keeps a shared exercise_catalog table; entries land here on sync
// and win over the built-in lists, so a just-created exercise resolves its
// muscles and equipment immediately on every device.

export interface CustomExercise {
  id: string;
  name: string;
  kind?: string;
  primaryMuscle: MuscleGroup | null;
  secondaryMuscles: MuscleGroup[];
  equipment: string[];
}

const CUSTOM_CACHE_KEY = 'gym.catalog';
const customByName = new Map<string, CustomExercise>();
let customList: CustomExercise[] = [];

export function registerCustomExercises(list: CustomExercise[]): void {
  customList = list;
  customByName.clear();
  for (const e of list) {
    const key = e.name.trim().toLowerCase();
    if (key) customByName.set(key, e);
  }
  try {
    localStorage.setItem(CUSTOM_CACHE_KEY, JSON.stringify(list));
  } catch {
    /* quota */
  }
}

/** Add/replace one entry locally (right after a PUT, before the next sync). */
export function registerCustomExercise(e: CustomExercise): void {
  registerCustomExercises([...customList.filter((x) => x.id !== e.id), e]);
}

export function customExercises(): CustomExercise[] {
  return customList;
}

try {
  const raw = localStorage.getItem(CUSTOM_CACHE_KEY);
  if (raw) {
    const list = JSON.parse(raw) as CustomExercise[];
    if (Array.isArray(list)) registerCustomExercises(list);
  }
} catch {
  /* corrupted cache — server sync repopulates it */
}

function customAsCatalogEntry(e: CustomExercise): CatalogExercise {
  return {
    id: `custom-${e.id}`,
    muscle: e.primaryMuscle ?? 'fullbody',
    names: [e.name, e.name, e.name, e.name, e.name],
    equipment: (e.equipment[0] as EquipmentId | undefined) ?? null,
  };
}

function CUSTOM_SECONDARIES(id: string): MuscleGroup[] | null {
  const raw = id.startsWith('custom-') ? id.slice('custom-'.length) : null;
  const hit = raw ? customList.find((e) => e.id === raw) : undefined;
  return hit ? hit.secondaryMuscles : null;
}

/** Catalog lookup by (any-locale) exercise name; null for unknown names. */
export function muscleInfoByName(name: string): MuscleInfo | null {
  const key = name.trim().toLowerCase();
  const custom = customByName.get(key);
  if (custom && custom.primaryMuscle) {
    return {
      primary: custom.primaryMuscle,
      secondary: custom.secondaryMuscles,
      equipment: (custom.equipment[0] as EquipmentId | undefined) ?? null,
    };
  }
  const ex = BY_NAME.get(key);
  if (!ex) return null;
  return {
    primary: ex.muscle,
    secondary: secondaryMusclesOf(ex),
    equipment: ex.equipment ?? null,
  };
}

/**
 * Case-insensitive search across every locale name (curated first, then the
 * free-exercise-db long tail). `equipment` narrows results to one type.
 */
export function searchCatalog(
  query: string,
  limit = 8,
  equipment?: EquipmentId | null,
  muscle?: MuscleGroup,
): CatalogExercise[] {
  const q = query.trim().toLowerCase();
  if (!q && equipment === undefined && muscle === undefined) return [];
  const custom = customList.map(customAsCatalogEntry);
  // Browsing by filter only (no typed query) draws from the hand-verified
  // curated list + the user's own custom exercises. The free-exercise-db long
  // tail has noisy muscle tags (a power clean listed as "hamstrings"), so it is
  // only reached when the user explicitly types a name to search for.
  const base = q ? [...custom, ...CURATED, ...DB_ENTRIES] : [...custom, ...CURATED];
  let pool =
    equipment === undefined ? base : base.filter((e) => (e.equipment ?? null) === equipment);
  if (muscle !== undefined) {
    pool = pool.filter((e) => e.muscle === muscle || secondaryMusclesOf(e).includes(muscle));
  }
  if (!q) return pool.slice(0, limit);
  const starts: CatalogExercise[] = [];
  const contains: CatalogExercise[] = [];
  for (const ex of pool) {
    const names = ex.names.map((n) => n.toLowerCase());
    if (names.some((n) => n.startsWith(q))) starts.push(ex);
    else if (names.some((n) => n.includes(q))) contains.push(ex);
    if (starts.length >= limit * 2) break;
  }
  return [...starts, ...contains].slice(0, limit);
}
