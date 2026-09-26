/** Held-out phrasings of the newer topics — tests only, never used for matching. */
export const NEW_TOPICS_TESTS: Record<string, { test: string[]; testUk: string[] }> = {
  k_bench_arch: {
    test: [
      'is it fine to keep a little curve in my back while benching',
      'do i flatten my spine on the bench or not',
      "my coach says arch, my friend says dont, who's right about bench",
      'how much should my back lift off the pad on bench',
    ],
    testUk: [
      'як правильно вигинати спину під час жиму',
      'чи нормально, що поперек не торкається лавки на жимі',
      'прогинатись на жимі — добре чи погано для спини',
      'який прогин робити, якщо жму на груди',
    ],
  },
  k_deadlift_rounding: {
    test: [
      'how do i stop turning into a question mark on pulls',
      'my lumbar goes round when i pull from the floor',
      'any drills so my spine stays neutral pulling heavy',
      'saw my deadlift video and my back looks curved, bad?',
    ],
    testUk: [
      'на відео побачив, що на тязі в мене горб — що робити',
      'як тягнути з підлоги, щоб поперек не згинався',
      'які вправи допоможуть тримати спину на становій',
      'на тязі спина перестає бути рівною — це небезпечно?',
    ],
  },
  k_knees_cave: {
    test: [
      'on the way up from a squat my knees kind of wobble toward each other',
      'how do i fix my knee angle when squatting heavy',
      'my knees point at each other at the bottom, is that a problem',
      'any cues so my knees stay over my toes',
    ],
    testUk: [
      'коли встаю з присіду, коліна тягне одне до одного',
      'як зробити, щоб коліна не падали всередину',
      'у присіді коліна дивляться одне на одного — це проблема?',
      'яка підказка, щоб коліна йшли по лінії стоп',
    ],
  },
  k_butt_wink: {
    test: [
      'at the very bottom of my squat my hips curl under, problem?',
      'does my lower back rounding at depth matter if its light weight',
      'someone told me i have butt wink, what does that mean',
      'how deep should i go if my pelvis starts tucking',
    ],
    testUk: [
      'у самому низу присіду таз заходить під себе — це погано?',
      'мені сказали, що в мене «батвінк», що це',
      'наскільки глибоко сідати, якщо таз починає підкручуватись',
      'поперек внизу присіду трохи згинається — чи варто переживати',
    ],
  },
  k_ohp_lean: {
    test: [
      'when i press overhead standing i basically do a backbend',
      'is my overhead press form wrong if my back curves a lot',
      'tips to keep my torso upright pressing a barbell over my head',
      "why does ohp feel like it's in my lower back",
    ],
    testUk: [
      'жму над головою і майже роблю місток — що не так',
      'як тримати корпус рівно, коли жму штангу стоячи',
      'армійський жим відчуваю попереком, а не плечима',
      'що підказати собі, щоб не відкидатися назад на жимі стоячи',
    ],
  },
  k_sumo_conventional: {
    test: [
      'wide stance or narrow stance pulling from the floor',
      'does it matter which deadlift variation i do for my main lift',
      'people at my gym say sumo is fake, is it',
      'how do i know if sumo suits me better',
    ],
    testUk: [
      'з широкими ногами тягнути чи з вузькими',
      'у залі кажуть, що сумо — це не станова, правда?',
      'як зрозуміти, що мені краще тягнути сумо',
      'класика чи сумо — що обрати як основну тягу',
    ],
  },
  k_row_lower_back: {
    test: [
      'whenever i do bent rows my lumbar area burns more than my lats',
      'any rowing variation that spares the lower back',
      'is it normal that rows fatigue my spinal erectors so much',
      'rows after deadlifts wreck my back, what now',
    ],
    testUk: [
      'коли роблю тягу в нахилі, горить поперек, а не спина',
      'яка тяга для спини щадить поперек',
      'чи нормально, що від тяги в нахилі так втомлюються розгиначі',
      'після станової тяга в нахилі добиває спину — що робити',
    ],
  },
  k_sleeves_wraps: {
    test: [
      'are those neoprene knee things people squat in useful',
      'my wrists feel wobbly under a heavy bench, what gear helps',
      'is it worth spending money on sleeves as a beginner',
      'should i wrap wrists for heavy pressing or tough it out',
    ],
    testUk: [
      'ті неопренові штуки на коліна, в яких присідають, — вони щось дають?',
      'на важкому жимі хитаються зап’ястя, що з екіпіровки допоможе',
      'новачку є сенс витрачатися на наколінники?',
      'мотати кисті на важкому жимі чи обходитися без цього',
    ],
  },
  k_chalk: {
    test: [
      'sweaty palms ruin my heavy pulls, what helps',
      'that white powder lifters use, should i get some',
      'is liquid chalk as good as the regular stuff',
      'does chalk actually make a difference on pull ups',
    ],
    testUk: [
      'долоні мокрі й зриваю важкі тяги — що допоможе',
      'той білий порошок, що в залі на руки, мені теж треба?',
      'рідка магнезія працює так само, як звичайна?',
      'чи реально магнезія допомагає на турніку',
    ],
  },
  k_smith_machine: {
    test: [
      'that bar on rails thing, is it a waste of time',
      'is squatting on a guided barbell okay for building legs',
      'can the smith replace a regular barbell for me',
      'people laugh at smith squats, should i care',
    ],
    testUk: [
      'той гриф на рейках — це марна трата часу?',
      'присідати з напрямною штангою нормально для ніг?',
      'чи може Сміт замінити мені звичайну штангу',
      'з присіду в Сміті сміються — варто зважати?',
    ],
  },
  k_test_max: {
    test: [
      'i want to see how much i can lift for one rep, whats the process',
      'planning a heavy single on squat saturday, how to approach it',
      'is it smart to go for a one rep max without anyone around',
      'how do lifters work up to a max attempt',
    ],
    testUk: [
      'хочу дізнатися, скільки підніму на один раз — як це зробити',
      'у суботу піду на важкий одиночний у присіді, як підійти',
      'чи розумно йти на максимум, коли поруч нікого',
      'як правильно виходити на граничну вагу',
    ],
  },
  k_shift_work: {
    test: [
      'my roster flips between days and nights, how should my workouts fit',
      'is lifting at 3am after work a bad idea',
      'i do 12s at the hospital, realistic gym plan?',
      'when is the best moment to lift if i sleep 9am to 4pm',
    ],
    testUk: [
      'у мене то денні, то нічні зміни — як вписати тренування',
      'тренуватися о третій ночі після роботи — погана ідея?',
      'чергую по 12 годин, який реальний план для залу',
      'сплю з 9 ранку до 4 дня — коли краще тренуватися',
    ],
  },
  k_maintenance: {
    test: [
      'work is swamped for 2 months, whats the least i can do in the gym',
      'if i only lift on sundays will my muscles shrink',
      'how do i hold onto strength during a hectic stretch',
      "what's a bare-bones routine that keeps what i built",
    ],
    testUk: [
      'два місяці аврал на роботі — скільки мінімум треба в залі',
      'якщо качатимусь тільки в неділю, м’язи зменшаться?',
      'як не розгубити силу в шалений період',
      'яка найпростіша програма, щоб зберегти набране',
    ],
  },
  k_holidays: {
    test: [
      'end of year parties every weekend, how do i keep my routine',
      'is it ok to just eat and relax over new year',
      'my gym has limited hours over the break, what should i do',
      'i overate at christmas, how do i get back on track',
    ],
    testUk: [
      'кінець року — корпоративи щовихідних, як не зірвати режим',
      'можна на Новий рік просто їсти й відпочивати?',
      'у свята зал працює скорочено — що робити з тренуваннями',
      'переїв на Різдво, як повернутися в колію',
    ],
  },
  k_heat: {
    test: [
      'its like 38 degrees out, should i still go lift',
      'my workouts feel terrible every july, why',
      "what's the smart way to exercise during a heatwave",
      'how do i avoid overheating in a stuffy gym',
    ],
    testUk: [
      'надворі +38, чи йти сьогодні в зал',
      'кожного липня тренування йдуть жахливо — чому',
      'як розумно тренуватися під час спеки',
      'як не перегрітися в задушливому залі',
    ],
  },
  k_teen_lifting: {
    test: [
      'my 14 year old nephew wants a gym membership, good idea?',
      "can heavy weights hurt a kid who's still growing",
      'whats a safe routine for a high schooler starting out',
      'im in 9th grade, is it too early to start lifting',
    ],
    testUk: [
      'племінник у 14 хоче абонемент у зал — це добра ідея?',
      'чи може важка вага зашкодити дитині, яка ще росте',
      'яка безпечна програма для старшокласника-початківця',
      'я у 9 класі, не зарано мені в тренажерку?',
    ],
  },
  k_older_lifter: {
    test: [
      'hitting my late 40s, what should i do different in the gym',
      "my recovery isn't what it was at 30, how do i plan around it",
      'is heavy squatting still smart at 62',
      'how do people keep lifting well into their 70s',
    ],
    testUk: [
      'мені під 50 — що змінити в тренуваннях',
      'відновлююсь уже не так, як у 30, як це врахувати',
      'чи розумно важко присідати в 62',
      'як люди продовжують тренуватися й у 70',
    ],
  },
  k_women_training: {
    test: [
      'as a woman, do i need a separate kind of routine',
      'my trainer gave me pink dumbbells, should i go heavier',
      'is a regular strength program fine for a female beginner',
      'do females progress differently in the gym',
    ],
    testUk: [
      'я жінка — мені потрібна якась окрема програма?',
      'тренер дав мені рожеві гантельки, може, брати важче',
      'чи підійде звичайна силова програма дівчині-новачку',
      'чи прогресують жінки в залі інакше',
    ],
  },
  k_pushup_progression: {
    test: [
      "my chest hits the floor and i can't push back up, where do i start",
      'whats the step by step to doing real pushups',
      'i want to do push ups for my fitness test in 2 months',
      'total beginner, push-ups feel impossible',
    ],
    testUk: [
      'опускаюсь на підлогу і не можу піднятися — з чого почати',
      'покроково: як дійти до справжніх віджимань',
      'за 2 місяці тест, треба віджиматися — як підготуватися',
      'я зовсім новачок, віджимання здаються неможливими',
    ],
  },
  k_etiquette: {
    test: [
      'what are the dos and donts at a new gym',
      'a guy leaves his plates on the bar every time, is that normal',
      "how do i ask to jump in between someone's sets without being awkward",
      'am i supposed to clean the bench after i use it',
    ],
    testUk: [
      'що можна і чого не можна робити в новому залі',
      'хлопець завжди лишає млинці на штанзі — це нормально?',
      'як попроситися між чужими підходами і не бути дивним',
      'чи треба витирати лавку після себе',
    ],
  },
  k_beta_alanine: {
    test: [
      'the supplement that makes your skin prickle, does it actually help',
      'worth buying beta alanine for circuit training',
      'how long before beta alanine starts working',
      'is beta alanine useful if i mostly lift heavy for 5 reps',
    ],
    testUk: [
      'та добавка, від якої поколює шкіра, — вона щось дає?',
      'чи варто купувати бета-аланін для кругових тренувань',
      'через скільки бета-аланін починає діяти',
      'чи є сенс у бета-аланіні, якщо я роблю важкі підходи по 5',
    ],
  },
  k_fish_oil: {
    test: [
      'i never eat salmon or sardines, should i supplement omegas',
      'do those big fish oil capsules do anything for gains',
      'is omega 3 one of the supplements actually worth it',
      'how do i pick a decent omega-3 product',
    ],
    testUk: [
      'я взагалі не їм лосось чи сардини — може, пити омегу',
      'ті великі капсули риб’ячого жиру щось дають для м’язів?',
      'омега-3 — це з тих добавок, які справді варті грошей?',
      'як вибрати нормальну омегу-3',
    ],
  },
  k_preworkout: {
    test: [
      'those scoops everyone drinks before the gym, do they help',
      'is a preworkout better than a double espresso',
      'my friend swears by preworkout, should i buy one',
      'what should i look for on a preworkout label',
    ],
    testUk: [
      'ті порошки, які всі п’ють перед залом, — вони працюють?',
      'передтрен кращий за подвійне еспресо?',
      'друг клянеться, що передтрен топ, — купувати?',
      'на що дивитися в складі передтрену',
    ],
  },
  k_bcaa: {
    test: [
      'those branched chain amino drinks, worth it if i eat plenty of protein',
      'the guy at the supplement store pushed bcaas on me, do i need them',
      'is sipping aminos during my workout doing anything',
      'should i replace my whey with bcaas',
    ],
    testUk: [
      'ті амінокислоти з розгалуженим ланцюгом — є сенс, якщо білка вистачає?',
      'у спортхарчі наполягали на BCAA — мені воно треба?',
      'чи є користь пити аміно під час тренування',
      'замінити протеїн на BCAA — нормальна ідея?',
    ],
  },
  k_core_stability: {
    test: [
      'how do i make my midsection stronger for heavy lifts',
      'what should i do for abs besides situps',
      'my trunk feels weak when i brace, which exercises help',
      'is holding a plank for 5 minutes a good goal',
    ],
    testUk: [
      'як зробити корпус сильнішим для важких вправ',
      'що робити на прес, крім підйомів тулуба',
      'корпус слабкий, коли напружуюсь, — які вправи допоможуть',
      'стояти в планці 5 хвилин — гарна ціль?',
    ],
  },
  k_ankle_mobility: {
    test: [
      'i end up on my toes at the bottom of a squat, why',
      'stiff ankles are ruining my squat, what drills help',
      'is it ok to squat with a little wedge under my heels',
      'how do i know if my ankles limit my depth',
    ],
    testUk: [
      'внизу присіду я опиняюсь на носках — чому',
      'скуті щиколотки псують присід — які вправи допоможуть',
      'чи нормально присідати з клином під п’ятами',
      'як зрозуміти, що глибину обмежує саме гомілкостоп',
    ],
  },
  k_gassed: {
    test: [
      'my legs could keep going but my lungs quit first',
      "how do i get fitter so circuits don't destroy me",
      'i play five a side and die after ten minutes, what training helps',
      'huffing and puffing after every set is that normal',
    ],
    testUk: [
      'ноги ще можуть, а легені вже здаються',
      'як стати витривалішим, щоб кола мене не вбивали',
      'граю в міні-футбол і через 10 хвилин нема сил — що тренувати',
      'після кожного підходу пихчу, як паротяг, — це нормально?',
    ],
  },
  k_sticking_point: {
    test: [
      'the bar just stops about 10cm above my chest every time',
      'my squat dies right as i come up from the bottom, what accessories',
      'deadlift comes off the floor fine then i cant finish it',
      'is there a way to target the weakest part of my press',
    ],
    testUk: [
      'штанга щоразу зупиняється сантиметрів за 10 над грудьми',
      'присід «вмирає» одразу після низу — які допоміжні робити',
      'станова від підлоги йде нормально, а завершити не можу',
      'як прицільно підтягнути найслабшу ділянку жиму',
    ],
  },
  k_more_pullups: {
    test: [
      'i can do a few chin ups but i want double digits',
      "what's a good routine to boost my bar reps for a fitness test",
      'been stuck at 8 pullups for months, ideas',
      'should i hit pullups daily to get better at them',
    ],
    testUk: [
      'кілька разів підтягуюсь, а хочу двозначне число',
      'яка програма, щоб підтягуватися більше до нормативу',
      'кілька місяців стою на 8 підтягуваннях — що робити',
      'чи варто підтягуватися щодня, щоб стало краще',
    ],
  },
  k_mind_muscle: {
    test: [
      'back workouts just leave my forearms fried, never my back',
      'whenever i bench, my front delts take over completely',
      "is it a problem if i can't sense my glutes during hip thrusts",
      'how do i get the right muscle to do the work',
    ],
    testUk: [
      'після тренування спини забиті лише передпліччя, а спина — ні',
      'на жимі лежачи все забирають передні дельти',
      'це проблема, якщо на ягодичному мості не відчуваю сідниць?',
      'як змусити працювати потрібний м’яз',
    ],
  },
  k_partial_reps: {
    test: [
      'do i gain more doing only the bottom part of a rep',
      'a guy at my gym does tiny reps with huge weight, does that work',
      'is cutting the range short a mistake if i want size',
      'whats the deal with lengthened partials i keep hearing about',
    ],
    testUk: [
      'чи більше росту, якщо робити лише нижню частину повтору',
      'хлопець у залі робить короткі повтори з величезною вагою — це працює?',
      'обрізати амплітуду — помилка, якщо хочу маси?',
      'що це за «часткові в розтягненні», про які всі говорять',
    ],
  },
  k_bands: {
    test: [
      'can stretchy bands actually give me real gains',
      'i only have a set of loop bands at home, enough to grow?',
      'worth packing bands for a 3 week trip',
      'how do i make band workouts harder over time',
    ],
    testUk: [
      'чи справді можна набрати м’язи з резинками',
      'вдома є лише набір петель — цього вистачить для росту?',
      'чи варто брати резинки в поїздку на 3 тижні',
      'як ускладнювати тренування з петлями з часом',
    ],
  },
  k_kettlebell_swing: {
    test: [
      'whats the right way to swing a kettlebell without wrecking my back',
      'should the bell be pushed up by my shoulders or hips',
      'i got a 16kg kettlebell, how do i start swinging it',
      'my swings look like a squat, is that wrong',
    ],
    testUk: [
      'як махати гирею так, щоб не зірвати спину',
      'гирю піднімають плечима чи тазом?',
      'купив гирю 16 кг — як почати робити махи',
      'мої махи схожі на присід — це неправильно?',
    ],
  },
  k_program_hopping: {
    test: [
      'my body feels used to my routine, time for something new?',
      "i've done five programs this year and made no progress, why",
      'do pros really keep changing their workouts to keep muscles guessing',
      'is it bad to stay on the same plan for half a year',
    ],
    testUk: [
      'здається, тіло звикло до тренувань — час на щось нове?',
      'цього року спробував п’ять програм і без прогресу — чому',
      'профі справді постійно міняють тренування, щоб м’язи не звикали?',
      'погано сидіти на одній програмі пів року?',
    ],
  },
  k_cardio_order: {
    test: [
      'i do 30 mins on the bike and then lift, is that the wrong way round',
      'want to lose fat and keep strength, which comes first in a session',
      'is it better to jog in the morning and lift at night',
      'does running before squats make them worse',
    ],
    testUk: [
      '30 хвилин велотренажера, а потім залізо — це неправильний порядок?',
      'хочу схуднути й зберегти силу — що робити першим',
      'краще бігати зранку, а залізо ввечері?',
      'чи погіршує біг перед присідом сам присід',
    ],
  },
  k_exercise_order: {
    test: [
      'does it matter if i start my session with curls',
      'how do i sequence the lifts in my leg day',
      'i always run out of energy for squats because i do them last, should i move them',
      'which comes first, the heavy stuff or the pump work',
    ],
    testUk: [
      'чи важливо, якщо починаю тренування з біцепса',
      'як вибудувати послідовність вправ на ноги',
      'присід стоїть останнім і на нього вже нема сил — переставити?',
      'що першим: важке чи вправи на памп',
    ],
  },
  k_imbalance: {
    test: [
      'the bar always ends up lopsided when i press',
      'my left quad is noticeably smaller, what should i do',
      'how do i even out my arms',
      'i lean to my right coming out of a squat, why',
    ],
    testUk: [
      'на жимі штанга завжди перекошується',
      'лівий квадрицепс помітно менший — що робити',
      'як вирівняти руки за розміром і силою',
      'виходячи з присіду, я завалююсь управо — чому',
    ],
  },
  k_knees_over_toes: {
    test: [
      'my old pe teacher said never let knees pass your toes, still true',
      'is it normal that my knees end up far in front of my feet in a squat',
      'do i need to push my hips back so my knees stay behind my feet',
      'is knee travel on lunges gonna mess up my knees',
    ],
    testUk: [
      'фізрук казав, що коліна ніколи не мають виходити за носки, — це досі так?',
      'нормально, що в присіді коліна далеко попереду стоп?',
      'чи треба відводити таз назад, щоб коліна лишалися над стопами',
      'якщо на випадах коліно виходить уперед, це зашкодить колінам?',
    ],
  },
  k_bail_squat: {
    test: [
      "what's the plan if i sink a heavy squat and can't stand up",
      'where do i put the rack pins so they catch me',
      'i train alone in my garage, how do i squat heavy without getting pinned',
      'is dumping the bar backwards dangerous',
    ],
    testUk: [
      'який план, якщо сів з важкою вагою і не можу встати',
      'на яку висоту ставити упори, щоб вони підхопили',
      'тренуюсь сам у гаражі — як присідати важко і не опинитися під штангою',
      'скидати штангу назад зі спини небезпечно?',
    ],
  },
  k_personal_trainer: {
    test: [
      'is paying someone to coach me in the gym a good use of money',
      'how can i tell if a trainer actually knows their stuff',
      "i've lifted 2 years alone, would a coach help me now",
      'few sessions with a pro just to learn form, smart?',
    ],
    testUk: [
      'чи варто платити комусь, щоб тренував мене в залі',
      'як зрозуміти, що тренер справді знається на справі',
      'два роки тренуюсь сам — тренер зараз допоможе?',
      'взяти кілька занять із профі лише для техніки — розумно?',
    ],
  },
};
