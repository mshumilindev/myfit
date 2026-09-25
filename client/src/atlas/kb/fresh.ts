/** A second held-out set, written blind (never used for matching or tuning) — the honest check. */
export const KB_FRESH: Record<string, { test: string[]; testUk: string[] }> = {
  pain: {
    test: [
      'getting a weird pinch in my elbow every time i do curls, what now',
      'something in my wrist clicks and aches, should i stop?',
      'hurt myself at the gym today, what should i do',
    ],
    testUk: [
      'тягне щось у лівому боці спини після тренування, що робити',
      'плече ниє вже третій день, продовжувати чи ні?',
      'шось хрустнуло в коліні і тепер болить',
      'у меня болит локоть после жима, что делать',
    ],
  },
  best: {
    test: [
      'list all my PRs',
      'what records have i set so far',
      'which of my lifts are all-time bests',
    ],
    testUk: [
      'які в мене особисті рекорди по вправах',
      'покажи мої пр',
      'чи побив я якийсь рекорд останнім часом?',
      'мои лучшие результаты по упражнениям',
    ],
  },
  weak: {
    test: [
      'where am i falling behind in my training',
      'what body part needs more attention based on my logs',
      "which area should i prioritise, what's lagging",
    ],
    testUk: [
      'на що мені варто звернути увагу, що слабке',
      "яка група м'язів у мене найгірше прокачана",
      "чого мені не вистачає в тренуваннях по м'язах",
      'какие у меня отстающие мышцы',
    ],
  },
  tomorrow: {
    test: [
      "what's on the plan for tomorrow",
      'am i hitting the gym tmrw or resting',
      'whats scheduled for me the next day',
    ],
    testUk: [
      'шо в мене по плану на завтра',
      'завтра треба йти в зал чи ні',
      'яка програма на завтрашній день',
      'что у меня завтра по тренировке',
    ],
  },
  week: {
    test: [
      'give me a recap of the last 7 days',
      'did i train enough these past few days this week',
      'how did this week go for me at the gym',
    ],
    testUk: [
      'розкажи як я цього тижня потренувався',
      'як у мене йшли справи в залі за ці 7 днів',
      'огляд мого тижня будь ласка',
      'как прошла моя неделя в зале',
    ],
  },
  sleep: {
    test: [
      'was my sleep enough last night?',
      'show me my sleep stats',
      'how many hours am i sleeping on average lately',
    ],
    testUk: [
      'скільки годин я сплю в середньому',
      'чи достатньо я висипаюсь останнім часом',
      'покажи дані про мій сон',
      'сколько я спал сегодня ночью',
    ],
  },
  skip: {
    test: [
      'really not feeling it today, is it fine to miss one session',
      "would it hurt my progress to bail on today's workout",
      'im tired, can i just not go today',
    ],
    testUk: [
      'немає сил, нічого страшного якщо сьогодні не піду?',
      'можна один раз не прийти на тренування?',
      'сьогодні лінь, пропущу — це критично?',
      'можно сегодня не идти в зал',
    ],
  },
  cooldown: {
    test: [
      'what should i do right at the end of my session to wind down',
      'is it worth spending 10 min cooling down after weights',
      'can i just leave after my last set or should i do something',
    ],
    testUk: [
      'що робити в кінці тренування щоб відновитись, заминка треба?',
      'після останнього підходу одразу йти додому чи щось ще робити',
      'потрібна розтяжка в кінці тренування?',
      'нужна ли заминка после зала',
    ],
  },
  failure: {
    test: [
      "should every set be taken until i literally can't do another rep",
      'how close to failure should i be going',
      'is going all out to the last rep necessary for growth',
    ],
    testUk: [
      'чи треба доводити кожен підхід до повного відказу',
      'наскільки близько до відмови працювати',
      'роблю до останнього повтору поки не впаду, це правильно?',
      'нужно ли работать до отказа',
    ],
  },
  swap: {
    test: [
      'the leg press is always taken, what else can i do',
      "don't like lunges, can i change them to another exercise",
      'is there an alternative to pull ups in my program',
    ],
    testUk: [
      'тренажер зайнятий, на що можна поміняти вправу',
      'не подобаються випади, чим їх замінити',
      'можна поміняти одну вправу в програмі на іншу?',
      'чем заменить подтягивания',
    ],
  },
  supplements: {
    test: [
      'is it worth buying creatine monohydrate',
      'any supplements actually worth the money?',
      'do i have to load creatine first',
    ],
    testUk: [
      'чи є сенс купувати креатин',
      'що з спортпіту реально працює',
      'креатин треба пити з загрузкою?',
      'какие добавки стоит принимать новичку',
    ],
  },
  thanks: {
    test: ['ty!', 'appreciate it man', 'cheers, that helped'],
    testUk: ['дякс', 'спасибі велике', 'дякую, допоміг', 'спасибо большое'],
  },
  muscle_last: {
    test: [
      'how long has it been since my last arm day',
      "when's the last time i worked my back",
      'how many days since i trained glutes',
    ],
    testUk: [
      'скільки днів тому я робив груди',
      'коли в мене останній раз були біцепси',
      'давно я не качав спину? коли було востаннє',
      'когда я последний раз делал ноги',
    ],
  },
  e1rm: {
    test: [
      'based on my sets what would my max squat be',
      'calculate my theoretical 1 rep max for bench',
      "if i did 100x5 what's my projected max",
    ],
    testUk: [
      'який в мене орієнтовний 1ПМ у присіді',
      'якщо я жму 80 на 6, скільки я пожму на раз',
      'прикинь мій максимум на один повтор у становій',
      'посчитай мой одноповторный максимум в жиме',
    ],
  },
  days_per_week: {
    test: [
      'is 3 times a week enough or should i go more',
      "what's the ideal gym frequency per week",
      'should i be lifting every day or like 4 days',
    ],
    testUk: [
      'скільки разів на тиждень оптимально ходити в зал',
      '3 тренування на тиждень це норм чи мало?',
      'чи можна тренуватися кожен день чи краще 4 рази',
      'сколько раз в неделю нужно ходить в зал',
    ],
  },
  plateau: {
    test: [
      "my bench hasn't moved in like 2 months",
      'weights stopped going up, what should i change',
      "feel like i'm stagnating, same numbers every week",
    ],
    testUk: [
      'вага на жимі стоїть на місці вже місяць',
      'не можу додати ні кіло, що змінити',
      'топчусь на місці з результатами, допоможи',
      'застрял на одном весе уже давно',
    ],
  },
  train_sore: {
    test: [
      'my chest is still aching from monday, can i hit it again',
      'legs are super sore, go to the gym anyway?',
      'is working out on sore muscles a bad idea',
    ],
    testUk: [
      'все тіло болить після вчорашнього, йти сьогодні чи ні',
      'груди ще не відійшли від минулого тренування, можна знову?',
      'з крепатурою в зал — нормально?',
      'крепатура после вчерашнего, можно тренироваться?',
    ],
  },
  exercises_per_session: {
    test: [
      'how many different exercises should one workout have',
      'im doing like 10 movements per session, is that overkill',
      'whats a good number of exercises for a single gym day',
    ],
    testUk: [
      'скільки різних вправ ставити в одне тренування',
      'роблю 10 вправ за раз, це забагато?',
      'яка оптимальна кількість вправ на одне заняття',
      'сколько упражнений делать за тренировку',
    ],
  },
  superset: {
    test: [
      'is it a good idea to pair two exercises back to back without rest',
      'can i superset biceps and triceps',
      'do supersets save time without losing gains',
    ],
    testUk: [
      'чи можна робити дві вправи підряд без відпочинку, суперсетом',
      'суперсет на біцепс і трицепс — ок?',
      'суперсети економлять час але не шкодять росту?',
      'есть смысл делать суперсеты',
    ],
  },
  tempo: {
    test: [
      'should i pause at the bottom and go slow on the way down',
      'how many seconds should each rep take',
      'does controlling the negative matter for growth',
    ],
    testUk: [
      'скільки секунд має тривати один повтор',
      'чи треба повільно опускати штангу',
      'роблю повтори швидко, це погано?',
      'в каком темпе делать повторения',
    ],
  },
  mobility: {
    test: [
      "i'm super stiff, can't even touch my toes, how to fix",
      'tight ankles stop me from squatting low, what helps',
      'what should i do to loosen up tight shoulders overhead',
    ],
    testUk: [
      "я дуже задерев'янілий, як розробити суглоби",
      'не можу підняти руки над головою рівно, погана рухливість плечей',
      'що робити щоб розтягнути затиснуті гомілкостопи',
      'как улучшить гибкость и подвижность суставов',
    ],
  },
  belt_straps: {
    test: [
      'at what weight should i start wearing a belt',
      'is it ok to use straps for rows and deadlifts',
      'should i buy a lifting belt as a beginner',
    ],
    testUk: [
      'з якої ваги починати тягнути в поясі',
      'кистьові лямки на тязі — це ок?',
      'чи варто купувати атлетичний пояс новачку',
      'нужен ли пояс для приседа',
    ],
  },
  results_time: {
    test: [
      'been going 3 weeks and nothing changed, when does it start showing',
      'how many months before people notice a difference',
      'realistically when will my body start changing',
    ],
    testUk: [
      'ходжу місяць а змін нуль, коли буде видно',
      'через скільки місяців буде помітний результат',
      'скільки треба тренуватись щоб тіло змінилось',
      'когда уже будет видно результат',
    ],
  },
  myth_bulky: {
    test: [
      'i want to tone up not bulk up, will weights make me huge',
      'scared heavy lifting will make my legs too big',
      'does lifting make women look manly',
    ],
    testUk: [
      'боюсь що від штанги стану масивною',
      'хочу підтягнути тіло, а не накачатись, ваги не зроблять мене великою?',
      'від присідань ноги стануть величезні?',
      'я не стану слишком перекачанной от железа?',
    ],
  },
  alcohol: {
    test: [
      'how bad are a few beers for muscle growth',
      'drank a lot last night, is it smart to lift today',
      'does wine on the weekend ruin my progress',
    ],
    testUk: [
      "чи сильно пиво заважає росту м'язів",
      'перебрав вчора, в зал сьогодні варто?',
      'випити на вихідних зіпсує прогрес?',
      'бодун, идти на тренировку или нет',
    ],
  },
  time_of_day: {
    test: [
      'does it matter what time i work out',
      'is lifting at 6am worse than after work',
      'should i train before work or late at night',
    ],
    testUk: [
      'чи є різниця о котрій годині тренуватися',
      'краще качатись до роботи чи після',
      'тренування пізно ввечері це погано?',
      'когда лучше заниматься утром или вечером',
    ],
  },
  protein_timing: {
    test: [
      'does it matter when i have my whey',
      'should i drink a shake as soon as i finish lifting',
      'is protein before bed useful',
    ],
    testUk: [
      'о котрій пити протеїновий коктейль',
      'протеїн треба пити одразу після тренування чи можна пізніше',
      'чи варто пити казеїн або протеїн перед сном',
      'когда лучше пить протеин',
    ],
  },
  comeback: {
    test: [
      'took the summer off, how do i ease back in',
      'was sick for 2 weeks, should i drop my weights',
      'starting again after a year away from lifting',
    ],
    testUk: [
      'не був у залі пів року, як правильно почати знову',
      'після відпустки повертаюсь, з якими вагами працювати',
      'хворів два тижні, скидати вагу чи ні',
      'вернулся после долгого перерыва, с чего начинать',
    ],
  },
  shoes: {
    test: [
      'are my nikes fine for lifting or should i get flat shoes',
      'what footwear is best for deadlifts',
      'can i squat in converse',
    ],
    testUk: [
      'які кросівки краще для залу',
      'чи можна присідати в кедах',
      "у м'яких кросах тягнути станову норм?",
      'в какой обуви приседать',
    ],
  },
  app_notifications: {
    test: [
      'the app never pings me, how do i get alerts',
      'where do i allow notifications for this app',
      'push alerts stopped coming on android',
    ],
    testUk: [
      'додаток мені нічого не надсилає, як ввімкнути пуші',
      'де дозволити сповіщення від застосунку',
      'перестали приходити пуш-повідомлення',
      'как включить уведомления в приложении',
    ],
  },
  app_injury_log: {
    test: [
      'where can i mark that i have a sore knee in the app',
      'is there a way to note an injury so workouts adjust',
      'want to register my back injury in the app',
    ],
    testUk: [
      'де в застосунку вказати що в мене травма',
      'як позначити травму коліна, щоб програма врахувала',
      'хочу внести в додаток пошкодження плеча',
      'как добавить травму в приложении',
    ],
  },
  motivate: {
    test: [
      'zero motivation today, say something',
      'hype me up before my workout',
      "i'm feeling lazy, convince me to train",
    ],
    testUk: [
      'нема ніякого бажання, скажи щось надихаюче',
      'потрібен пинок щоб піти в зал',
      'заряди мене перед тренуванням',
      'мотивируй меня пожалуйста',
    ],
  },
  done: {
    test: ['just finished my workout', 'all done for today', 'workout complete'],
    testUk: [
      'все, відтренувався',
      'тренування виконано',
      'я все зробив на сьогодні',
      'всё, потренил',
    ],
  },
  heaviest: {
    test: [
      "what's the most weight i've ever moved",
      "biggest number i've put on the bar",
      "out of everything, what's the heaviest thing i lifted",
    ],
    testUk: [
      'яку максимальну вагу я коли-небудь піднімав',
      'найважче що я взагалі тягав',
      'скільки кг була моя найбільша вага на штанзі',
      'какой самый большой вес я поднимал',
    ],
  },
  best_weekday: {
    test: [
      'what day of the week do i work out most often',
      'am i more of a monday or weekend lifter',
      'which weekdays show up most in my history',
    ],
    testUk: [
      'в який день тижня я найчастіше буваю в залі',
      'по яким дням в мене зазвичай тренування',
      'я більше тренуюсь в будні чи вихідні',
      'в какие дни недели я чаще всего тренируюсь',
    ],
  },
  cardio_done: {
    test: [
      'how many runs did i log this week',
      'total cardio time for the last 7 days',
      'did i do any cardio this week',
    ],
    testUk: [
      'скільки я набігав цього тижня',
      'чи було в мене кардіо на цьому тижні',
      'скільки хвилин активності я зробив за тиждень',
      'сколько кардио у меня было на этой неделе',
    ],
  },
  bw_trend: {
    test: [
      'is my weight going up or down',
      'has the scale been moving lately',
      'am i putting on or dropping pounds',
    ],
    testUk: [
      'як змінюється моя вага останнім часом',
      'я поправляюсь чи скидаю',
      'що там з моєю вагою, росте?',
      'я набираю или теряю вес',
    ],
  },
  longest_session: {
    test: [
      "what's the longest i've ever spent in the gym in one go",
      'which workout took me the most time',
      'how long was my quickest session',
    ],
    testUk: [
      'яке тренування в мене тривало найбільше часу',
      'найдовше я сидів у залі скільки',
      'яке було моє найшвидше тренування',
      'самая долгая моя тренировка',
    ],
  },
  add_weight: {
    test: [
      'hit all my reps, time to go heavier?',
      "how do i know it's time to bump the weight up",
      'should i jump 2.5 or 5 kg next session',
    ],
    testUk: [
      'зробив всі повтори, вже час додавати кг?',
      'як зрозуміти що пора збільшувати вагу',
      'на скільки кілограм підвищувати наступного разу',
      'когда повышать рабочий вес',
    ],
  },
  unilateral: {
    test: [
      'my right side does all the work, how do i even it out',
      'is it worth doing single arm dumbbell stuff',
      'bulgarian split squats worth it for balance between legs?',
    ],
    testUk: [
      'права рука помітно сильніша, як вирівняти',
      'чи є сенс робити вправи на одну ногу',
      'одна сторона тіла відстає, що робити',
      'одна нога слабее другой, как исправить',
    ],
  },
  incline_flat: {
    test: [
      'which bench angle is best for chest growth',
      'should i prioritise incline press over regular bench',
      'my upper chest is flat, what bench should i do',
    ],
    testUk: [
      'який жим краще для грудей, на похилій лаві чи на рівній',
      'верх грудей не росте, похилий жим допоможе?',
      'варто робити похилий замість звичайного жиму лежачи?',
      'наклонный или горизонтальный жим что лучше',
    ],
  },
  nap: {
    test: [
      'is a 20 minute nap after lunch worth it',
      'can a daytime snooze help me recover',
      'napping in the afternoon, good or bad for gains',
    ],
    testUk: [
      'чи корисно подрімати після обіду',
      "денний сон допомагає м'язам відновлюватись?",
      'скільки хвилин спати вдень щоб не бути розбитим',
      'стоит ли спать днем для восстановления',
    ],
  },
  age: {
    test: [
      "i'm 55, can i still build muscle",
      "never lifted and i'm almost 50, is it worth starting",
      "is there an age where starting weights doesn't make sense",
    ],
    testUk: [
      'мені 52, ще є сенс іти в зал?',
      'в 60 років можна починати силові?',
      'чи не запізно мені в мої 48 почати качатися',
      'мне 50 лет, не поздно начинать тренироваться?',
    ],
  },
  app_units: {
    test: [
      'the app shows kilos, i want lb',
      'where do i change kg to lbs',
      'how to set weight units in settings',
    ],
    testUk: [
      'як поміняти кг на lb в додатку',
      'де в налаштуваннях одиниці виміру ваги',
      'хочу щоб вага показувалась у фунтах',
      'как поменять единицы на килограммы',
    ],
  },
  app_playbook: {
    test: [
      'what does the playbook section do',
      'how do i reuse a saved workout plan',
      'can i create my own template and run it',
    ],
    testUk: [
      'для чого розділ плейбук',
      'як зберегти своє тренування як шаблон',
      'як користуватись шаблонами в застосунку',
      'что такое плейбук в приложении',
    ],
  },
  do_you_lift: {
    test: [
      'bro do you ever hit the gym yourself',
      'whats your bench lol',
      'have you ever lifted a weight',
    ],
    testUk: [
      'а ти сам ходиш качатись?',
      'скільки ти жмеш?',
      'ти хоч раз тренувався?',
      'а ты сам качаешься?',
    ],
  },
  plate_math: {
    test: [
      'how to get 90kg on a 20kg bar',
      'what do i put on each side for 115',
      'which plates make 75 kg',
    ],
    testUk: [
      'як набрати 110 кг на грифі',
      'шо повісити з кожної сторони на сотку',
      'які блини треба щоб вийшло 95 кг',
      'какие блины повесить на 130 кг',
    ],
  },
  warmup_lift: {
    test: [
      'what should my warm up sets look like before heavy squats',
      'my working deadlift is 150, how do i build up to it',
      'how many warmup sets before bench',
    ],
    testUk: [
      'скільки розминочних підходів перед робочою вагою в присіді',
      'робоча на жимі 90, як до неї розігрітись',
      'як розігріватись перед важкою становою',
      'как разминаться перед жимом лежа',
    ],
  },
  sets_for_lift: {
    test: [
      'how many working sets for overhead press',
      'is 3 sets of bench enough',
      'how many sets should i do on rows',
    ],
    testUk: [
      'скільки робочих підходів на жим стоячи',
      '3 підходи присіду вистачить?',
      'скільки сетів тяги штанги в нахилі робити',
      'сколько подходов делать на жим лежа',
    ],
  },
  short_on_time: {
    test: [
      'running late, only 25 min for the gym, what do i do',
      'got a tiny window today, quick session ideas?',
      'need to be in and out in half an hour',
    ],
    testUk: [
      'встигаю в зал лише на пів години, що робити',
      'дуже мало часу сьогодні, дай коротке тренування',
      'є 15 хвилин, що встигну',
      'у меня только полчаса, что сделать',
    ],
  },
  health_conditions: {
    test: [
      'my doctor says my blood pressure is high, can i still lift heavy',
      "i'm type 1 diabetic, anything to watch out for at the gym",
      'is weight training ok with a heart condition',
    ],
    testUk: [
      'в мене підвищений тиск, чи можна тягати важке',
      'маю цукровий діабет, як безпечно тренуватись',
      'з астмою можна робити силові?',
      'у меня гипертония, можно ли в зал',
    ],
  },
  pregnancy: {
    test: [
      "i'm 20 weeks pregnant, can i keep lifting",
      'what exercises are safe when expecting',
      'just had a baby, when can i go back to the gym',
    ],
    testUk: [
      'я вагітна, можна продовжувати ходити в зал?',
      'які вправи безпечні на другому триместрі',
      'коли після пологів можна повертатись до силових',
      'беременна, можно ли тренироваться',
    ],
  },
  running: {
    test: [
      'will jogging kill my gains',
      'i want to do a half marathon and still lift, how',
      'should i run on leg days or separate days',
    ],
    testUk: [
      "чи шкодить біг набору м'язів",
      'хочу бігати і ходити в зал одночасно, як скласти',
      'бігати в день ніг чи окремо',
      'можно ли совмещать бег и тренажерку',
    ],
  },
  other_sport: {
    test: [
      'i play basketball, what should my gym work look like',
      'how to lift weights for mma',
      'strength program for a volleyball player',
    ],
    testUk: [
      'граю у волейбол, які вправи в залі робити',
      'як тренуватися в залі якщо займаюсь боротьбою',
      'силова для баскетболіста',
      'как качаться футболисту',
    ],
  },
  reminder: {
    test: [
      'ping me tomorrow morning about my workout',
      'can you nudge me to go lift later today',
      'set an alarm for gym at 7',
    ],
    testUk: [
      'нагадай завтра зранку що треба в зал',
      'можеш мені нагадати про тренування ввечері',
      'постав нагадувалку на 19:00 на зал',
      'напомни мне завтра про тренировку',
    ],
  },
  act_rest: {
    test: [
      'change my rest between squat sets to 150 seconds',
      'i want 2 min rest on rows',
      'make the timer 3 min for bench',
    ],
    testUk: [
      'зміни паузу між підходами присіду на 2.5 хв',
      'хочу відпочинок 2 хвилини на тязі',
      'таймер відпочинку на жимі постав на 3 хвилини',
      'поставь отдых на становой 3 минуты',
    ],
  },
  act_move: {
    test: [
      'push my leg day to wednesday',
      "can you shift today's session to sunday",
      'switch back day to monday instead',
    ],
    testUk: [
      'переклади тренування ніг на середу',
      'сьогодні не можу, зсунь тренування на неділю',
      'поміняй день спини на понеділок',
      'перенеси тренировку на пятницу',
    ],
  },
  act_mute: {
    test: ['stop messaging me today', 'no more notifications for today pls', "don't bug me today"],
    testUk: [
      'сьогодні без повідомлень будь ласка',
      'не турбуй мене сьогодні',
      'вимкни мені нотифікації на сьогодні',
      'не присылай сегодня уведомления',
    ],
  },
  range_summary: {
    test: [
      'how did my training go in august',
      'show me what i did over the past 2 months',
      'overview of my workouts since january',
    ],
    testUk: [
      'як я тренувався у серпні',
      'покажи що я робив за останні два місяці',
      'звіт по тренуваннях з початку року',
      'итоги тренировок за прошлый месяц',
    ],
  },
  range_bw: {
    test: [
      'what was my weight doing in july',
      'bodyweight changes over the past 90 days',
      'how much did i weigh since the start of the year',
    ],
    testUk: [
      'як змінювалась моя вага в липні',
      'покажи вагу тіла за останні 4 тижні',
      'скільки я важив з початку року по тепер',
      'мой вес за последние два месяца',
    ],
  },
  why_today: {
    test: [
      'why did you give me arms today',
      "what's the reason for today's session",
      'why shoulders again today',
    ],
    testUk: [
      'чого сьогодні саме руки',
      'навіщо мені сьогодні таке тренування',
      'поясни чому на сьогодні плечі',
      'почему сегодня такая тренировка',
    ],
  },
  why_lift: {
    test: [
      "what's the point of romanian deadlifts in my program",
      'why do i have lunges in my routine',
      'why did you add dips to my plan',
    ],
    testUk: [
      'навіщо в програмі румунська тяга',
      'для чого мені в плані випади',
      'чому в програмі є віджимання на брусах',
      'зачем в программе жим стоя',
    ],
  },
  return_injury: {
    test: [
      'my knee has healed, how do i ease back into squats',
      'tore my hamstring 6 weeks ago, when can i deadlift again',
      'coming back from a wrist injury, how light should i start',
    ],
    testUk: [
      'після розтягнення коліна коли можна знову присідати',
      'спина вже не болить після травми, як повертатись до станової',
      'з якою вагою починати після травми плеча',
      'после травмы спины когда можно снова в зал',
    ],
  },
  tendon: {
    test: [
      'the tendon above my elbow flares up after curls',
      'achilles is sore and stiff in the mornings',
      'tennis elbow from lifting, what helps',
    ],
    testUk: [
      'запалення сухожилля ліктя від тренувань, що робити',
      'ахіллове сухожилля болить вранці',
      'тендиніт плеча, як лікувати',
      'болит сухожилие под коленом',
    ],
  },
  calories: {
    test: [
      'how much should i eat per day to build muscle',
      "what's my daily calorie target",
      'how many kcal to cut fat',
    ],
    testUk: [
      "скільки калорій з'їдати щоб набрати масу",
      'яка моя норма калорій на день',
      'скільки ккал треба для сушки',
      'сколько калорий мне нужно в день',
    ],
  },
  carbs: {
    test: [
      'how many grams of carbohydrates per day for a lifter',
      'is keto bad for gym performance',
      'should i cut out bread and rice',
    ],
    testUk: [
      'скільки грам вуглеводів потрібно на день',
      'кето шкодить тренуванням?',
      'чи треба відмовитись від хліба і макаронів',
      'сколько углеводов есть в день',
    ],
  },
  post_meal: {
    test: [
      'best food to eat right after lifting',
      'what should my meal after gym look like',
      'is a banana and shake good after training',
    ],
    testUk: [
      "що краще з'їсти після залу",
      'який прийом їжі після тренування',
      'банан з протеїном після тренування норм?',
      'что покушать после тренировки',
    ],
  },
  cheat_meal: {
    test: [
      'went overboard at a birthday party, is my progress ruined',
      'can i have one junk meal a week',
      'ate a whole pizza and ice cream, how bad is that',
    ],
    testUk: [
      "з'їв бургер і торт, я все зіпсував?",
      'можна раз на тиждень їсти що хочу',
      'зірвався на солодке, що тепер',
      'можно ли читмил раз в неделю',
    ],
  },
  electrolytes: {
    test: [
      'should i drink something with salt when training hard',
      'is magnesium worth taking for cramps',
      'do sports drinks with electrolytes help',
    ],
    testUk: [
      'чи треба пити воду з сіллю під час тренування',
      'чи варто пити магній від судом',
      'ізотонік з електролітами допомагає?',
      'нужны ли электролиты при тренировках',
    ],
  },
  good_night: {
    test: ['off to sleep, night', 'gn', 'sleep time, see ya tomorrow'],
    testUk: ['все, пішов спати', 'бажаю доброї ночі', 'добрих снів', 'спокойной ночи'],
  },
  challenge: {
    test: [
      'got any challenge for me?',
      'give me something hard to try this week',
      'i want a fitness challenge',
    ],
    testUk: [
      'придумай мені якийсь челендж',
      'дай завдання на тиждень посложніше',
      'хочу якийсь виклик',
      'дай мне челлендж',
    ],
  },
  laugh: { test: ['hahahaha', 'lolol', 'lmfao'], testUk: ['ахахах', 'хахах', 'ххаха', 'ржу'] },
  lets_go: {
    test: ['lesss goooo', "let's do this", "let's gooo"],
    testUk: ['погнааали', 'ну що, поїхали', 'го го го', 'ну шо, го'],
  },
  atlas_age: {
    test: ['how long have you existed', 'what year were you born', 'atlas how old r u'],
    testUk: [
      'а тобі скільки років?',
      'атлас, ти старий чи молодий',
      'коли тебе створили',
      'сколько тебе лет',
    ],
  },
  sing_poem: {
    test: ['can you write me a little verse', 'drop a rap about leg day', 'sing a song for me'],
    testUk: [
      'напиши вірш про зал',
      'можеш щось заспівати',
      'зачитай реп про присід',
      'напиши стих',
    ],
  },
  you_dumb: {
    test: ["wow you're so dumb", "that's not what i asked, useless", 'you make no sense'],
    testUk: ['ти нічого не розумієш', 'ну ти й тупенький', 'це не те що я питав', 'ты тупой бот'],
  },
  k_knees_cave: {
    test: [
      'when i come up from a squat my knees collapse in',
      'my knees knock together at the bottom of squats, is that bad',
      'how to keep knees out when squatting',
    ],
    testUk: [
      'на підйомі з присіду коліна заходять всередину',
      'коліна зводяться докупи на присіді, це погано?',
      'як тримати коліна назовні при присіданні',
      'колени заваливаются внутрь на приседе',
    ],
  },
  k_sumo_conventional: {
    test: [
      'wide stance or regular deadlift for me',
      'i have long legs, sumo or conventional',
      'does sumo count as a real deadlift',
    ],
    testUk: [
      'тягнути становою широкою постановкою чи звичайною',
      'в мене довгі ноги, сумо чи класика краще',
      'сумо — це нечесна станова?',
      'сумо или классика что выбрать',
    ],
  },
  k_chalk: {
    test: [
      'my grip slips on deadlifts, would chalk help',
      'is using chalk better than lifting straps',
      'does liquid chalk work as well as the powder',
    ],
    testUk: [
      'руки ковзають на грифі, магнезія допоможе?',
      'що краще, магнезія чи кистьові лямки',
      'варто брати рідку магнезію чи порошок',
      'магнезия нужна для становой?',
    ],
  },
  k_shift_work: {
    test: [
      'i work nights, when should i go lift',
      'my shifts rotate every week, how do i keep a gym routine',
      'is it ok to train right after a 12 hour night shift',
    ],
    testUk: [
      'працюю в нічну зміну, коли краще тренуватись',
      'графік добу через три, як тренуватися',
      'змінна робота, як не збитись з тренувань',
      'работаю по сменам, как планировать тренировки',
    ],
  },
  k_heat: {
    test: [
      "it's 35 degrees in my gym, how do i train",
      "any tips for lifting when it's really hot outside",
      'how to not overheat during summer workouts',
    ],
    testUk: [
      'в залі страшна жара, як тренуватися',
      'на вулиці +35, чи варто йти тренуватись',
      'як не перегрітись на тренуванні влітку',
      'как тренироваться в жару',
    ],
  },
  k_women_training: {
    test: [
      'does a female body need a different program than a male one',
      'should my girlfriend follow the same program as me',
      'is there a special way women should lift',
    ],
    testUk: [
      'чи відрізняються тренування жінок від чоловіків',
      'дружина може займатись по моїй програмі?',
      'жінкам треба якось інакше тренуватись?',
      'женщинам нужно тренироваться по-другому?',
    ],
  },
  k_beta_alanine: {
    test: [
      'my pre workout has beta alanine and my face tingles',
      'is beta alanine actually useful',
      'how much beta alanine should i take',
    ],
    testUk: [
      'від передтрену з бета-аланіном свербить шкіра, це норм?',
      'чи є користь від бета аланіну',
      'скільки бета-аланіну приймати',
      'бета аланин стоит брать?',
    ],
  },
  k_bcaa: {
    test: [
      'is it worth buying amino acids like bcaa',
      'should i sip bcaas between sets',
      'bcaa or protein powder, which is better',
    ],
    testUk: [
      'чи є сенс в амінокислотах BCAA',
      'бцаа чи протеїн що краще брати',
      'пити BCAA між підходами треба?',
      'нужны ли бцаа',
    ],
  },
  k_gassed: {
    test: [
      "i'm completely winded after a set of 15 squats",
      'my breathing gives out before my muscles do',
      'how do i build stamina for high rep sets',
    ],
    testUk: [
      'після підходу на 15 повторів не можу віддихатись',
      "дихалка здається раніше ніж м'язи",
      'як підтягнути витривалість щоб не задихатись у підходах',
      'задыхаюсь во время подходов',
    ],
  },
  k_mind_muscle: {
    test: [
      'rows only hit my biceps, not my back',
      'how do i actually feel my glutes working',
      "my shoulders take over on chest press, can't feel pecs",
    ],
    testUk: [
      'на тязі до пояса працюють тільки біцепси',
      'не відчуваю сідниці у вправах',
      "як навчитись відчувати м'яз, який тренуєш",
      'не чувствую спину на тягах',
    ],
  },
  k_kettlebell_swing: {
    test: [
      'is my kettlebell swing supposed to be a squat or a hinge',
      'how high should the bell go on swings',
      'tips for proper kb swings',
    ],
    testUk: [
      'як правильно робити свінг з гирею',
      'до якої висоти махати гирю',
      'махи гирею присідати чи нахилятися',
      'как правильно делать махи гирей',
    ],
  },
  k_exercise_order: {
    test: [
      'should i do bench before or after flyes',
      'does it matter which exercise i do first',
      'big lifts first or small ones',
    ],
    testUk: [
      'жим робити до чи після розводки',
      'чи важливо з якої вправи починати тренування',
      'спочатку важкі вправи чи легкі',
      'в каком порядке ставить упражнения',
    ],
  },
  k_bail_squat: {
    test: [
      'i train alone, what if i get stuck at the bottom of a squat',
      'how do i dump the bar safely if i fail a squat',
      'what height should the safety bars be in the rack',
    ],
    testUk: [
      'присідаю без страхувальника, що робити якщо не встану',
      'як правильно скинути штангу назад якщо застряг у присіді',
      'на яку висоту ставити страховочні упори в рамі',
      'как сбросить штангу если не встаю с приседа',
    ],
  },
  rest: {
    test: [
      'whats the ideal break between my working sets for hypertrophy?',
      'do i need like 3 min between heavy sets or is 1 min fine',
      'i keep waiting forever between sets, how much is optimal',
    ],
    testUk: [
      'скільки треба сидіти між сетами щоб встигнути відновитись?',
      'між підходами роблю 1 хв, цього мало чи норм?',
      'сколько отдыхать между подходами если работаю на массу',
      'яку паузу давати між важкими підходами станової',
    ],
  },
  progress_lift: {
    test: [
      'is my bench actually going up or am i stuck',
      'any gains on squats lately?',
      'tell me how my deadlift numbers are trending',
    ],
    testUk: [
      'мій жим лежачи взагалі росте чи я на місці?',
      'покажи як в мене справи з присідом, є рух вперед?',
      'станова тяга в мене росте чи стоїть?',
      'як там мій жим, додаю чи ні',
    ],
  },
  recovery: {
    test: [
      "did my body bounce back from yesterday's leg day?",
      'is it safe to hit back again or is it still recovering',
      'which muscle groups have had enough rest by now',
    ],
    testUk: [
      'після вчорашнього тренування я вже відійшов чи ще ні?',
      'спина вже готова до нового навантаження?',
      'які групи м’язів вже можна знову навантажувати',
      'мои плечи уже восстановились?',
    ],
  },
  next_session: {
    test: [
      'what workout is planned for me next?',
      'whats on the schedule after today',
      'which day am i supposed to go to the gym again',
    ],
    testUk: [
      'що в мене по плану далі?',
      'на який день запланована наступна тренька',
      'коли мені знову в зал за розкладом?',
      'какая следующая тренировка у меня',
    ],
  },
  streak: {
    test: [
      'how many days straight have i been training?',
      'is my streak still alive',
      'whats my current run of workouts without missing',
    ],
    testUk: [
      'скільки днів підряд я вже не пропускаю?',
      'моя серія ще тримається?',
      'покажи мою поточну серію тренувань',
      'скока дней подряд я тренируюсь',
    ],
  },
  deload: {
    test: [
      'i feel beat up every week, is it time for a lighter week?',
      'how often should i take an easy week',
      "when's the next light week in my plan",
    ],
    testUk: [
      'коли в мене буде легкий тиждень зі зниженою вагою?',
      'накопичилась втома, може пора розвантажитись?',
      'навіщо взагалі робити розгрузку',
      'когда у меня разгрузочная неделя',
    ],
  },
  motivation: {
    test: [
      'cant make myself go to the gym lately, any tips?',
      'i keep skipping workouts, how do i get my drive back',
      'zero desire to lift anymore',
    ],
    testUk: [
      'вже тиждень не можу себе змусити піти на тренування',
      'зовсім пропало бажання качатись, що робити',
      'як себе замотивувати ходити в зал?',
      'не хочется вообще идти в зал, ленюсь',
    ],
  },
  cardio: {
    test: [
      'how many minutes of cardio per week is enough',
      'should i add running or cycling to my lifting plan',
      'best time to do cardio, same day as weights?',
    ],
    testUk: [
      'скільки разів на тиждень треба бігати, якщо я качаюсь?',
      'велотренажер після залу — нормально?',
      'яке кардіо краще додати до силових',
      'скільки хвилин кардіо в тиждень треба',
    ],
  },
  bodyweight: {
    test: [
      'what was my weight at the last check-in?',
      'show me my current weight',
      'how much do i weigh right now according to the app',
    ],
    testUk: [
      'яка в мене зараз вага за записами?',
      'скільки я важив при останньому зважуванні?',
      'покажи мою поточну масу тіла',
      'сколько я вешу сейчас',
    ],
  },
  technique: {
    test: [
      'can you look at my form and tell me if its ok?',
      'how can i tell if im doing an exercise wrong',
      'i want feedback on my technique, how do i get it',
    ],
    testUk: [
      'як зрозуміти, що я правильно виконую вправу?',
      'можеш оцінити мою техніку?',
      'як самому перевірити, чи нема помилок у техніці',
      'как проверить правильная ли у меня техника',
    ],
  },
  temper: {
    test: [
      "tone it down a bit please, you're too strict",
      'can you talk to me more gently',
      'stop being so mean to me',
    ],
    testUk: [
      'можеш говорити зі мною не так суворо?',
      'ти якийсь злий, будь м’якшим',
      'як зробити щоб ти був добрішим до мене',
      'че ты такой грубый, полегче',
    ],
  },
  greeting: {
    test: ['yo', 'good morning atlas', 'hi there coach'],
    testUk: ['добрий день', 'хай', 'доброго ранку, атлас', 'прівєт'],
  },
  lift_last: {
    test: [
      'how long ago was my last squat session?',
      'when was the last time i did pullups',
      'last day i trained deadlift?',
    ],
    testUk: [
      'коли останній раз я присідав зі штангою?',
      'скільки днів тому був мій останній жим лежачи',
      'коли я востаннє робив підтягування',
      'когда последний раз делал становую',
    ],
  },
  tonnage: {
    test: [
      'whats my total volume in kg for this week',
      'how many tons did i move in total last month?',
      'sum of all weight i lifted this week',
    ],
    testUk: [
      'скільки всього кілограмів я перетягав за тиждень?',
      'який у мене сумарний об’єм за місяць у кг',
      'скільки тон заліза я підняв цього тижня',
      'сколько всего кг поднял за неделю',
    ],
  },
  how_am_i_doing: {
    test: [
      'be honest, how is my training going overall?',
      'what do you think of my workouts so far',
      'am i doing well in general?',
    ],
    testUk: [
      'як загалом в мене справи з тренуваннями?',
      'чесно скажи, я добре тренуюсь?',
      'що скажеш про мої тренування останнім часом',
      'как у меня вообще дела с тренировками',
    ],
  },
  injury_status: {
    test: [
      'how far along is my knee rehab?',
      'update on my injury recovery please',
      'which phase of the rehab am i in now',
    ],
    testUk: [
      'як просувається відновлення після травми коліна?',
      'яка фаза реабілітації в мене зараз',
      'що там з моєю травмою плеча, скоро поверну навантаження?',
      'на каком я этапе восстановления после травмы',
    ],
  },
  weaker_today: {
    test: [
      "couldn't hit my usual reps today, what's going on?",
      'why does everything feel so heavy this session',
      'my strength is way down today, why',
    ],
    testUk: [
      'сьогодні навіть звичну вагу не можу підняти, чому?',
      'чого я сьогодні такий дохлий у залі',
      'звичайна робоча вага сьогодні здається дуже важкою, в чому причина?',
      'почему сегодня силы нету совсем',
    ],
  },
  compound_isolation: {
    test: [
      'should my program be mostly big multi-joint lifts or single-joint stuff?',
      'is it worth doing bicep curls or only big lifts',
      'are basic lifts enough without isolation work',
    ],
    testUk: [
      'чи можна тренуватись тільки базою без ізоляції?',
      'що краще для росту — багатосуглобові вправи чи ізолюючі?',
      'навіщо потрібні ізолюючі вправи, якщо є база',
      'база или изоляция что важнее',
    ],
  },
  dropset: {
    test: [
      'what does it mean to strip weight and keep repping?',
      'do drop sets actually help growth',
      'how to use drop sets on curls',
    ],
    testUk: [
      'як правильно робити дропсет на біцепс?',
      'скидати вагу і продовжувати підхід — це що за метод?',
      'дропсети реально дають ріст?',
      'дропсеты это как делать',
    ],
  },
  warmup_sets: {
    test: [
      'what should my warmup sets look like before a heavy bench?',
      'how many light sets before my working weight',
      'how do i build up to a heavy deadlift without wasting energy',
    ],
    testUk: [
      'скільки легких підходів робити перед робочою вагою?',
      'як розім’ятись підходами перед важким жимом',
      'з якої ваги починати розминочні сети на присід',
      'сколько разминочных подходов перед рабочим',
    ],
  },
  abs_daily: {
    test: [
      'is it bad to do ab workouts every single day?',
      'how many times a week should i hit abs',
      'want visible abs, do i train them daily?',
    ],
    testUk: [
      'чи нормально тренувати прес кожного дня?',
      'скільки разів на тиждень качати прес',
      'хочу кубики, треба прес щодня робити?',
      'можно качать пресс каждый день',
    ],
  },
  breathing: {
    test: [
      'should i hold my breath during heavy squats?',
      'when do i inhale and exhale on a rep',
      'how to brace my core properly before lifting',
    ],
    testUk: [
      'коли вдихати, а коли видихати під час повтору?',
      'чи треба затримувати дихання на важкій становій?',
      'як правильно набирати повітря перед підходом',
      'как дышать при жиме лежа',
    ],
  },
  muscle_gain_rate: {
    test: [
      'how many kg of muscle is realistic in a year?',
      'im skinny and want to get bigger, where to start',
      "what's the fastest realistic way to gain mass",
    ],
    testUk: [
      'я худий, як набрати м’язову масу?',
      'скільки реально можна набрати м’язів за рік?',
      'що робити щоб швидше набирати масу',
      'как быстро набрать мышечную массу',
    ],
  },
  cardio_gains: {
    test: [
      'will cardio make me lose muscle while bulking?',
      'does running eat my gains',
      'worried cardio burns my muscle, true?',
    ],
    testUk: [
      'чи втрачу я м’язи, якщо буду бігати?',
      'кардіо заважає набирати масу?',
      'боюсь що біг спалить мої м’язи, це правда?',
      'кардио сжигает мышцы или нет',
    ],
  },
  water: {
    test: [
      'how many liters of water per day should i drink?',
      'do i need extra water when i work out',
      'is 1.5 l of water a day enough for me',
    ],
    testUk: [
      'скільки літрів води на день треба пити?',
      'п’ю мало води, це впливає на тренування?',
      'скільки пити води в день тренування',
      'сколько воды пить в день',
    ],
  },
  fasted: {
    test: [
      'is it bad to lift first thing in the morning without eating?',
      'can i hit the gym on an empty stomach',
      'should i eat before my morning workout or go fasted',
    ],
    testUk: [
      'можна йти в зал зранку не поївши?',
      'тренуватись на голодний шлунок — нормально?',
      'кардіо натщесерце краще спалює жир?',
      'можно тренироваться натощак утром',
    ],
  },
  travel: {
    test: [
      'going abroad for two weeks, how do i keep training?',
      'no gym where im traveling, what workout can i do',
      'how to not lose progress on a trip',
    ],
    testUk: [
      'їду в поїздку на тиждень, як не закинути тренування?',
      'що робити з тренуваннями, якщо в готелі нема залу',
      'я у відпустці, як потренуватись без залу',
      'как тренироваться в командировке',
    ],
  },
  rest_day: {
    test: [
      "what's good to do on days off from lifting?",
      'should i just chill on my off day or do something light',
      'is it ok to go for a walk or swim on rest days',
    ],
    testUk: [
      'чим займатись у день без тренування?',
      'у вихідний від залу краще лежати чи щось робити?',
      'можна поплавати в день відпочинку?',
      'что делать в день отдыха от зала',
    ],
  },
  app_log_set: {
    test: [
      'where do i type in the weight and reps i did?',
      'how to add a set to my workout',
      'how do i save my reps in the app',
    ],
    testUk: [
      'куди вписувати вагу і кількість повторень?',
      'як додати підхід у тренування в додатку',
      'як внести сет, який я щойно зробив',
      'как записать подход в приложении',
    ],
  },
  app_turn_off: {
    test: [
      'how can i disable you?',
      'i want to switch off the ai coach',
      'where to turn off the chatbot',
    ],
    testUk: [
      'як відключити тебе в додатку?',
      'де вимикається ші-тренер',
      'хочу прибрати чат-тренера, як?',
      'как тебя отключить',
    ],
  },
  are_you_ai: {
    test: [
      'is this a human replying or a program?',
      'are you a real coach or a chatbot',
      'wait, is there a person behind this?',
    ],
    testUk: [
      'ти справжній тренер чи програма?',
      'зі мною зараз людина переписується?',
      'ти робот чи ні?',
      'ты нейросеть?',
    ],
  },
  joke: {
    test: ['say something funny about leg day', 'cheer me up with a joke', 'know any good jokes?'],
    testUk: [
      'пожартуй щось',
      'розкажи анекдот про качків',
      'хочу посміятись, жартани',
      'расскажи анекдот',
    ],
  },
  bye: {
    test: ['gotta go, bye', 'ok thanks, cya', 'good night atlas'],
    testUk: ['ну все, бувай', 'до побачення', 'на добраніч', 'пока'],
  },
  favourite_lift: {
    test: [
      'which lift shows up the most in my logs?',
      'what exercise have i done more than any other',
      "what's my go-to exercise based on history",
    ],
    testUk: [
      'яку вправу я роблю частіше за все?',
      'що в моїх тренуваннях зустрічається найбільше',
      'яка вправа в мене в топі по кількості',
      'какое упражнение я делаю чаще всего',
    ],
  },
  rest_actual: {
    test: [
      'how long were my breaks between sets last workout?',
      'on average how much time do i spend resting between sets',
      'do i rest too long? what do my logs show',
    ],
    testUk: [
      'скільки в середньому тривають мої паузи між підходами?',
      'я занадто довго відпочиваю між сетами за даними?',
      'покажи мій реальний час відпочинку',
      'сколько я на самом деле отдыхаю между подходами',
    ],
  },
  my_gym: {
    test: [
      'where do i usually work out?',
      'show my saved gyms',
      'which gym location have i logged the most',
    ],
    testUk: [
      'в який зал я ходжу найчастіше?',
      'які зали в мене додані?',
      'де я зазвичай тренуюсь',
      'в каком зале я тренируюсь',
    ],
  },
  strength_ratio: {
    test: [
      'is a 140 squat good at 75kg bodyweight?',
      'how does my bench compare for someone my size',
      'am i strong for my weight or weak',
    ],
    testUk: [
      'жму 90 при вазі 80, це нормально?',
      'наскільки я сильний відносно своєї ваги?',
      'моя станова хороша чи слабка для мого веса',
      '100 кг присед при весе 70 это хорошо?',
    ],
  },
  grow_muscle: {
    test: [
      'my arms are skinny, how do i make them bigger?',
      'legs lagging behind, how to grow quads',
      'cant get my back wider, advice?',
    ],
    testUk: [
      'як збільшити біцепс, руки не ростуть?',
      'груди відстають, що робити',
      'як наростити сідниці',
      'как накачать широкую спину',
    ],
  },
  strength_vs_size: {
    test: [
      'i want to be strong not just big, how is training different?',
      'powerlifting style or bodybuilding style for me?',
      'do low reps build size or only strength',
    ],
    testUk: [
      'що краще тренувати — силу чи об’єм м’язів?',
      'в чому різниця між силовим тренінгом і на гіпертрофію?',
      'мало повторів з великою вагою — це на силу чи на масу?',
      'на силу или на массу лучше тренироваться',
    ],
  },
  pullup_zero: {
    test: [
      "can't even do one chin up, help",
      'how do i go from 0 to 1 pullup',
      'i just hang on the bar and cant pull myself up',
    ],
    testUk: [
      'вишу на турніку і не можу підтягнутись',
      'як навчитись підтягуватись з нуля?',
      'жодного підтягування не виходить, що робити',
      'не могу подтянуться ни разу',
    ],
  },
  foam_roll: {
    test: [
      'is rolling on a foam roller worth it?',
      'do massage guns actually help recovery',
      'should i roll out before lifting',
    ],
    testUk: [
      'є сенс купувати масажний ролик?',
      'мфр після тренування реально допомагає?',
      'масажний пістолет для відновлення корисний?',
      'роллить мышцы перед тренировкой надо?',
    ],
  },
  stress: {
    test: [
      'work is killing me, should i still go lift?',
      'super stressed this week, train or skip?',
      'can working out help my stress levels',
    ],
    testUk: [
      'на роботі жесть, чи варто йти тренуватись?',
      'у мене нерви, краще пропустити зал?',
      'спорт допомагає зняти стрес?',
      'у меня стресс, стоит ли тренироваться',
    ],
  },
  gym_anxiety: {
    test: [
      'i feel like everyone is judging me at the gym',
      'too shy to use the free weights area',
      'nervous about going to the gym for the first time',
    ],
    testUk: [
      'соромлюсь підходити до штанги, бо там качки',
      'мені незручно, що в залі на мене дивляться',
      'боюсь вперше йти в спортзал',
      'стесняюсь ходить в зал',
    ],
  },
  app_language: {
    test: [
      'can i use the app in ukrainian?',
      'the app is in the wrong language, how to fix',
      'where is the language setting',
    ],
    testUk: [
      'де в налаштуваннях поміняти мову?',
      'можна зробити додаток англійською?',
      'як поставити українську мову',
      'как поменять язык в приложении',
    ],
  },
  app_streak_rules: {
    test: [
      'does skipping a day reset my streak?',
      'how is the streak calculated',
      'what do i need to do to keep the streak going',
    ],
    testUk: [
      'що потрібно робити, щоб серія не згоріла?',
      'якщо пропущу день, серія обнулиться?',
      'за якими правилами рахується серія',
      'как считается серия в приложении',
    ],
  },
  compliment: {
    test: ["you're a legend", "thanks atlas, you're amazing", 'best coach ever'],
    testUk: ['ти супер', 'дякую, ти топ', 'ти просто красава', 'лучший тренер'],
  },
  reps_at_weight: {
    test: [
      'if i put 70 on bench how many reps could i get?',
      'how many times can i squat 120',
      'estimate my reps with 150 on deadlift',
    ],
    testUk: [
      'на скільки разів я зможу пожати 85?',
      'скільки повторень вийде в присіді з 110 кг',
      'з 60 кг жим стоячи скільки раз зроблю',
      'сколько раз я пожму 100',
    ],
  },
  exercise_muscles: {
    test: [
      'which muscles do lunges hit?',
      'what does the overhead press train',
      'dips work what muscles?',
    ],
    testUk: [
      'що працює в румунській тязі?',
      'які м’язи навантажує жим ногами',
      'віджимання на брусах — на що вони?',
      'какие мышцы работают в тяге верхнего блока',
    ],
  },
  day_lookup: {
    test: [
      'what did i train last friday?',
      'show me my saturday workout',
      'what exercises did i do the day before yesterday',
    ],
    testUk: [
      'що я тренував у п’ятницю?',
      'яке тренування було в мене в неділю',
      'що я робив позавчора в залі',
      'что я делал в субботу',
    ],
  },
  two_days_row: {
    test: [
      'is lifting on back-to-back days bad?',
      'can i hit the gym today if i trained yesterday',
      'ok to train chest two days straight?',
    ],
    testUk: [
      'вчора тренувався, можна сьогодні знову?',
      'нормально ходити в зал без перерви два дні?',
      'можна одну групу м’язів два дні підряд?',
      'можно тренироваться каждый день без выходных',
    ],
  },
  peds: {
    test: [
      'thinking about starting a cycle, thoughts?',
      'is taking test worth it for a natty',
      'are anabolics dangerous',
    ],
    testUk: [
      'чи варто сідати на курс анаболіків?',
      'що думаєш про тестостерон для набору?',
      'сарми шкідливі?',
      'хочу попробовать стероиды, что скажешь',
    ],
  },
  hr_zones: {
    test: [
      'what bpm should my cardio be at?',
      'how do i calculate my heart rate zones',
      'is low intensity zone 2 worth it',
    ],
    testUk: [
      'який пульс тримати на кардіо?',
      'як порахувати свої пульсові зони',
      'що дає тренування в другій зоні пульсу',
      'какой пульс должен быть на кардио',
    ],
  },
  steps: {
    test: [
      'do i really need 10k steps daily?',
      'how much walking per day is good',
      'should i track my steps to lose fat',
    ],
    testUk: [
      'скільки треба проходити кроків за день?',
      'чи обов’язково 10 тисяч кроків?',
      'ходьба допоможе скинути жир?',
      'сколько шагов в день нужно',
    ],
  },
  home_equipment: {
    test: [
      'want to train at home, what gear should i get?',
      "budget home gym, what's worth buying first",
      'adjustable dumbbells or kettlebells for home?',
    ],
    testUk: [
      'хочу займатись вдома, що з інвентарю взяти?',
      'який мінімум обладнання купити для дому',
      'варто купити штангу і стійки додому?',
      'что купить для тренировок дома',
    ],
  },
  memory_show: {
    test: [
      'what info have you saved about me?',
      'show everything you remember',
      'what do you have stored on me',
    ],
    testUk: [
      'які дані ти про мене зберіг?',
      'що ти запам’ятав про мене?',
      'покажи, що ти знаєш про мене',
      'что ты обо мне помнишь',
    ],
  },
  act_swap: {
    test: [
      'replace pullups with lat pulldown',
      'switch lunges to bulgarian split squats please',
      'put incline dumbbell press instead of incline bench',
    ],
    testUk: [
      'заміни підтягування на тягу верхнього блоку',
      'поміняй випади на болгарські присідання',
      'замість жиму стоячи постав жим гантелей сидячи',
      'замени приседания на хакк',
    ],
  },
  act_start: {
    test: ['ok im at the gym, start it', "kick off today's workout", 'start session now'],
    testUk: [
      'я в залі, запускай тренування',
      'поїхали, починаємо сьогоднішню',
      'стартуємо тренування',
      'начни тренировку',
    ],
  },
  act_bodyweight: {
    test: ['weighed in at 77.3 this morning', 'log my weight 84kg', "today's weight 63.8"],
    testUk: [
      'сьогодні ваги показали 79,4',
      'запиши мою вагу 86 кг',
      'зранку було 71 кг',
      'вес сегодня 88 кг',
    ],
  },
  range_lift: {
    test: [
      'show my squat progress over the last 2 months',
      'deadlift best since january?',
      "how's my bench changed since spring",
    ],
    testUk: [
      'як змінився мій присід з січня?',
      'прогрес станової за останні 8 тижнів',
      'найкращий жим лежачи за цей місяць',
      'покажи прогресс жима с мая',
    ],
  },
  then_vs_now: {
    test: [
      'am i stronger now than at the start of the year?',
      'compare my lifts today vs 4 months ago',
      'did i get weaker since last summer',
    ],
    testUk: [
      'я зараз сильніший, ніж пів року тому?',
      'порівняй мої результати зараз і два місяці тому',
      'чи я ослаб порівняно з минулим роком',
      'я сильнее чем 3 месяца назад?',
    ],
  },
  why_weight: {
    test: [
      'why did you give me 60 on bench today?',
      'how come the squat weight increased this session',
      'why did you lower my deadlift weight',
    ],
    testUk: [
      'чому ти поставив мені таку вагу на присід?',
      'з чого раптом вага на жимі менша?',
      'чому на становій стало більше кг ніж минулого разу',
      'почему такой вес в жиме сегодня',
    ],
  },
  technique_lift: {
    test: [
      'how do i do a proper overhead press?',
      'correct form for barbell rows?',
      'squat form tips please',
    ],
    testUk: [
      'як правильно робити жим стоячи?',
      'техніка тяги штанги в нахилі',
      'підкажи як правильно тягнути станову',
      'как правильно делать жим лежа',
    ],
  },
  ice_heat: {
    test: [
      'sprained ankle, ice it or warm it?',
      'should i put heat on my sore back',
      'cold pack or warm compress after tweaking my shoulder',
    ],
    testUk: [
      'підвернув ногу, прикладати холод чи грілку?',
      'болить спина, краще гріти чи охолоджувати?',
      'лід на плече після тренування допоможе?',
      'лёд или тепло на ушиб',
    ],
  },
  cramps: {
    test: [
      'my foot cramps up during squats, why?',
      'keep getting muscle spasms mid set',
      'calf locked up on leg press, whats causing it',
    ],
    testUk: [
      'зводить ногу під час тренування, що робити?',
      'чого мене судомить посеред підходу',
      'на згинаннях ніг зводить задню поверхню стегна',
      'судороги в икрах на тренировке',
    ],
  },
  cut_deficit: {
    test: [
      'how many calories below maintenance should i eat to lose fat?',
      'how much weight per week is safe to drop',
      'is 500 kcal deficit enough',
    ],
    testUk: [
      'на скільки калорій урізати раціон для сушки?',
      'який безпечний темп схуднення на тиждень?',
      'дефіцит 500 ккал — нормально?',
      'какой дефицит калорий нужен чтобы похудеть',
    ],
  },
  fats: {
    test: [
      'how many grams of fat per day do i need?',
      'is eating lots of fat bad for gains',
      'whats the right amount of fats in my diet',
    ],
    testUk: [
      'скільки грамів жирів на день мені треба?',
      'можна їсти багато жирів на масі?',
      'яка норма жиру в раціоні',
      'сколько жиров в день есть',
    ],
  },
  meals_count: {
    test: [
      'is it better to eat 3 times or 5 times a day?',
      'does meal frequency matter for muscle',
      'how many times should i eat daily',
    ],
    testUk: [
      'скільки разів треба їсти протягом дня?',
      'краще їсти часто маленькими порціями чи рідше?',
      'два прийоми їжі на день вистачить?',
      'сколько раз в день нужно есть',
    ],
  },
  sugar: {
    test: [
      'can i have dessert and still get lean?',
      'does sugar ruin muscle growth',
      'should i quit sweets completely',
    ],
    testUk: [
      'можна їсти цукерки на сушці?',
      'солодке заважає набирати м’язи?',
      'треба повністю відмовитись від цукру?',
      'сахар вреден для похудения?',
    ],
  },
  fiber: {
    test: [
      'whats the daily fiber target?',
      'i barely eat vegetables, does it matter',
      'do i need fiber for gains',
    ],
    testUk: [
      'скільки грамів клітковини на день треба?',
      'майже не їм овочів — це проблема?',
      'навіщо потрібна клітковина',
      'сколько клетчатки нужно в день',
    ],
  },
  tired: {
    test: ['totally wiped out', "i'm beat", 'feeling so worn out right now'],
    testUk: ['я дуже втомлений', 'виснажений повністю', 'сил зовсім немає', 'я устал'],
  },
  fun_fact: {
    test: [
      'got an interesting fact for me?',
      'share some random fitness trivia',
      'tell me something i dont know',
    ],
    testUk: [
      'розкажи щось цікаве про спорт',
      'дай якийсь рандомний факт',
      'здивуй мене фактом',
      'расскажи интересный факт',
    ],
  },
  mood_down: {
    test: ['feeling really down today', 'everything sucks', "i'm not ok today"],
    testUk: ['мені дуже сумно сьогодні', 'все погано', 'настрій на нулі', 'мне грустно'],
  },
  nothing: {
    test: ['forget it', 'nah nothing', 'doesnt matter'],
    testUk: ['та нічого', 'забудь', 'не зважай', 'ничего'],
  },
  atlas_sleep: {
    test: ['do you ever rest?', 'are you awake 24/7?', "don't you ever get tired?"],
    testUk: [
      'а ти коли-небудь спиш?',
      'ти працюєш цілодобово?',
      'ти не спиш взагалі?',
      'ты спишь когда нибудь',
    ],
  },
  clock: {
    test: ['whats the time rn', 'can you tell me the time', 'time now?'],
    testUk: ['скільки зараз часу?', 'котра година зараз', 'підкажи час', 'сколько времени'],
  },
  k_bench_arch: {
    test: [
      'do i need a big back arch when benching?',
      'is it ok to arch on bench or should my back be flat',
      'arching on bench press safe for my spine?',
    ],
    testUk: [
      'чи прогинати поперек коли жму лежачи?',
      'жати з плоскою спиною чи з мостом?',
      'місток на жимі лежачи — це нормально?',
      'нужен ли прогиб в жиме лежа',
    ],
  },
  k_butt_wink: {
    test: [
      'my lower back rounds at the bottom of my squat, is that bad?',
      'hips tuck under when i go deep, how to stop it',
      'is a little pelvic tilt at squat depth dangerous',
    ],
    testUk: [
      'внизу присіду таз підвертається, це небезпечно?',
      'поперек заокруглюється, коли глибоко сідаю',
      'як прибрати підкручування таза в присіді',
      'таз подкручивается внизу приседа',
    ],
  },
  k_row_lower_back: {
    test: [
      'my lower back is fried after bent-over rows, what am i doing wrong?',
      'barbell rows wreck my lower back, fix?',
      'how to stop lower back fatigue on rows',
    ],
    testUk: [
      'після тяги в нахилі болить поперек, що не так?',
      'на тязі штанги поперек забивається раніше спини',
      'як робити тягу в нахилі, щоб не вантажити поперек',
      'поясница устаёт от тяги в наклоне',
    ],
  },
  k_smith_machine: {
    test: [
      'is squatting in the smith machine a waste of time?',
      'smith machine bench or free bar, which is better',
      'why do people hate the smith machine',
    ],
    testUk: [
      'чи є сенс жати в машині Сміта?',
      'Сміт гірший за вільну штангу?',
      'присідати в тренажері Сміта — це погано?',
      'машина смита это норм или нет',
    ],
  },
  k_maintenance: {
    test: [
      'only have time for 1 workout a week, will i keep my muscle?',
      'how do i hold on to my gains during exams',
      'whats the least amount of training to not go backwards',
    ],
    testUk: [
      'мало часу, скільки мінімум тренуватись щоб не злити форму?',
      'одного тренування на тиждень вистачить, щоб зберегти м’язи?',
      'як підтримувати результат, коли зовсім нема часу',
      'как сохранить мышцы если тренироваться раз в неделю',
    ],
  },
  k_teen_lifting: {
    test: [
      'im 13, is it ok to lift weights?',
      'will squats make me shorter if im still growing',
      'safe age to start the gym?',
    ],
    testUk: [
      'мені 15, чи можна вже ходити в тренажерку?',
      'штанга зупиняє ріст у підлітків?',
      'з якого віку можна працювати з вагами',
      'мне 14 можно ли качаться',
    ],
  },
  k_pushup_progression: {
    test: [
      "can't do even one proper push up, where do i start?",
      'how to progress to full push ups from zero',
      'push ups from knees first or wall push ups?',
    ],
    testUk: [
      'жодного разу не можу віджатись від підлоги',
      'як навчитись віджиматися з нуля?',
      'почати з віджимань від стіни чи з колін?',
      'не могу отжаться ни разу что делать',
    ],
  },
  k_fish_oil: {
    test: [
      'is omega 3 worth buying for gym people?',
      'do fish oil capsules help muscle',
      'should i add fish oil to my supplements',
    ],
    testUk: [
      'чи треба пити омегу-3, якщо я тренуюсь?',
      'капсули риб’ячого жиру — є від них толк?',
      'омега 3 допомагає м’язам?',
      'рыбий жир пить стоит?',
    ],
  },
  k_core_stability: {
    test: [
      'what should i do for core besides situps?',
      'good exercises to make my core stronger for squats',
      'planks enough or do i need more core work',
    ],
    testUk: [
      'що робити на кор, крім скручувань?',
      'які вправи зміцнять корпус для важких присідань?',
      'чи достатньо тільки планки для кору',
      'лучшие упражнения на кор',
    ],
  },
  k_sticking_point: {
    test: [
      'my bench always dies right off the chest',
      'squat stalls at the same spot every heavy set, fix?',
      'cant lock out my deadlift, how to get past that point',
    ],
    testUk: [
      'жим завжди застрягає на одній висоті, що робити?',
      'на присіді постійно зупиняюсь на півдорозі вгору',
      'не можу дотягнути станову у верхній точці',
      'застреваю в середине жима как пробить',
    ],
  },
  k_partial_reps: {
    test: [
      'are half reps useless?',
      'should i always go full rom or partials are fine',
      'do partial reps in the stretch build muscle',
    ],
    testUk: [
      'чи треба завжди робити в повну амплітуду?',
      'неповні повтори дають ріст чи ні?',
      'роблю жим на половину амплітуди, це погано?',
      'частичные повторения работают?',
    ],
  },
  k_program_hopping: {
    test: [
      'do i need to switch my routine every few weeks?',
      'is muscle confusion a real thing',
      'keep changing programs, is that why no progress?',
    ],
    testUk: [
      'як часто треба змінювати програму тренувань?',
      'чи правда, що м’язи звикають і треба їх шокувати?',
      'кожен місяць міняю програму, це погано?',
      'нужно ли часто менять программу',
    ],
  },
  k_imbalance: {
    test: [
      'my right side is way stronger, how do i even it out?',
      'left leg weaker than right, what to do',
      'one bicep bigger than the other, fix?',
    ],
    testUk: [
      'права рука сильніша за ліву, як вирівняти?',
      'одна нога слабша, що з цим робити',
      'одна сторона грудей більша, як виправити',
      'одна сторона сильнее другой что делать',
    ],
  },
  k_personal_trainer: {
    test: [
      'should i pay for a coach or train alone?',
      'is hiring a pt a waste of money',
      'online coaching vs in person trainer?',
    ],
    testUk: [
      'чи є сенс платити персональному тренеру?',
      'мені потрібен особистий тренер чи сам впораюсь?',
      'як знайти нормального тренера в залі',
      'стоит ли брать персоналку',
    ],
  },
  next_weight: {
    test: [
      'hit 80kg for 3x8 on bench last time, go up or stay?',
      'squats felt easy at 100, how much do i load on thursday',
      'what should my deadlift working weight be next session',
    ],
    testUk: [
      'минулого разу жав 70 на 3 по 8, скільки вішати зараз?',
      'на наступному тренуванні присід — яку вагу брати?',
      'підкажи робочу вагу на тягу штанги в нахилі наступного разу',
      'какой вес ставить на жим в след раз?',
    ],
  },
  volume_muscle: {
    test: [
      'am i doing enough sets for my back weekly',
      'count my shoulder sets for the week',
      'is 10 sets a week enough for biceps',
    ],
    testUk: [
      'скільки робочих підходів на плечі я набрав за тиждень?',
      'чи вистачає мені сетів на ноги на тиждень',
      'порахуй мої підходи на біцепс за цей тиждень',
      'сколько подходов на спину я сделал на этой неделе',
    ],
  },
  today: {
    test: [
      'gym in an hour, which day is it on my plan?',
      'ok im here, what are we hitting',
      'legs or upper today?',
    ],
    testUk: [
      'вже в залі, яке сьогодні тренування за планом?',
      'що в мене на сьогодні по програмі',
      'сьогодні ноги чи верх?',
      'шо сьогодня качаєм?',
    ],
  },
  last_session: {
    test: [
      'recap my previous workout',
      "how did monday's session go",
      'remind me what i lifted last time i was in',
    ],
    testUk: [
      'нагадай, що було на попередньому тренуванні',
      'як я відпрацював минулого разу?',
      'які вправи та ваги були в останньому тренуванні',
      'шо я там робив прошлий раз',
    ],
  },
  total: {
    test: [
      'whats my lifetime workout count',
      'how many trainings have i logged since i started using the app',
      'total gym visits ever?',
    ],
    testUk: [
      'скільки тренувань я вже записав з самого початку',
      'яка в мене загальна кількість відвідувань залу',
      'скільки всього було сесій за весь час у додатку?',
      'сколько всего я уже натренил',
    ],
  },
  plan: {
    test: [
      'remind me what my weekly routine looks like',
      'which program am i on right now',
      'list the days of my current plan',
    ],
    testUk: [
      'нагадай, за якою програмою я зараз займаюсь',
      'що в мене по днях у програмі?',
      'покажи розпис моїх тренувань на тиждень',
      'какая у меня сейчас програма',
    ],
  },
  warmup: {
    test: [
      "what's a good warmup before heavy squats",
      'how many warm up sets before my working weight',
      'is 5 min on the bike enough to warm up',
    ],
    testUk: [
      'як розігрітися перед важким жимом',
      'скільки розминочних підходів робити до робочої ваги',
      '5 хвилин на велотренажері достатньо для розминки?',
      'как нормально размяться перед залом',
    ],
  },
  reps: {
    test: [
      'should i go heavy for 5 or light for 15',
      'best number of reps to build size',
      'is 3 reps enough per set or too low',
    ],
    testUk: [
      'краще важко на 5 разів чи легко на 15?',
      'по скільки разів робити, щоб набрати масу',
      'в якому діапазоні повторень працювати на силу',
      'скока раз в подходе делать',
    ],
  },
  session_length: {
    test: [
      'is 2 hours in the gym too long',
      "my sessions take forever, what's the ideal time",
      'how many minutes do i usually spend training',
    ],
    testUk: [
      '2 години в залі це забагато?',
      'скільки хвилин у середньому триває моє тренування',
      'яка оптимальна тривалість одного тренування',
      'сколько по времени должна длится треня',
    ],
  },
  protein: {
    test: [
      'i weigh 80kg, how many grams of protein daily',
      'is 100g of protein enough for me',
      'do i need protein shakes to hit my protein',
    ],
    testUk: [
      'важу 75 кг, скільки грамів білка на день треба',
      '100 грам протеїну на день вистачить?',
      "яка норма білка для набору м'язів",
      'скок белка надо в день',
    ],
  },
  who: {
    test: ['what exactly are you', 'are you a bot or a real person', 'introduce yourself'],
    testUk: ['а ти взагалі хто такий?', 'ти бот чи людина?', 'розкажи про себе', 'ты кто вообще'],
  },
  ack: {
    test: ['alright', 'cool, understood', 'sure thing'],
    testUk: ['зрозумів', 'ясно', 'ну добре, домовились', 'понял'],
  },
  lift_count: {
    test: [
      'how many times did i bench last month',
      'count my deadlift sessions',
      'how regularly do i do pull ups',
    ],
    testUk: [
      'скільки разів я робив жим лежачи минулого місяця',
      'як часто в мене в тренуваннях станова тяга?',
      'порахуй, скільки сесій я присідав',
      'сколько раз я делал становую',
    ],
  },
  muscle_frequency: {
    test: [
      'is hitting chest once a week enough',
      'how many days a week should legs be trained',
      'do i work my back often enough',
    ],
    testUk: [
      'груди раз на тиждень — цього достатньо?',
      'скільки разів на тиждень качати ноги',
      'чи я достатньо часто треную спину?',
      'как часто качать плечи',
    ],
  },
  prs_today: {
    test: [
      'did i beat any personal bests just now',
      'was today a pr day?',
      'any new maxes from this workout',
    ],
    testUk: [
      'я сьогодні побив якийсь особистий рекорд?',
      'чи були нові максимуми на цьому тренуванні',
      'сьогодні є пр?',
      'рекорды сегодня были?',
    ],
  },
  overtraining: {
    test: [
      'training 6 days a week and constantly exhausted, too much?',
      'my lifts are going down and i feel drained all the time',
      "signs i'm overdoing it in the gym",
    ],
    testUk: [
      'тренуюсь 6 разів на тиждень і постійно без сил, це забагато?',
      'сили падають, сплю погано, може я перегнув з навантаженням',
      'які ознаки перетренованості',
      'кажется я перетренился',
    ],
  },
  split_choice: {
    test: [
      'upper/lower vs push pull legs for 3 days?',
      'i can train 5 days, what split works best',
      'should a beginner do full body or bro split',
    ],
    testUk: [
      'маю 3 дні на тиждень — фулбаді чи верх-низ?',
      'який спліт краще на 5 тренувань на тиждень',
      'пуш пул легс чи верх низ, що вибрати',
      'какой сплит лучше для набора',
    ],
  },
  machines_free: {
    test: [
      'is the smith machine as good as a barbell',
      'are dumbbells better than cable machines for growth',
      'only use machines at my gym, is that bad',
    ],
    testUk: [
      'чи гірший смітт за звичайну штангу?',
      'гантелі чи тренажери, що краще для масу',
      'займаюсь тільки на тренажерах, це погано?',
      'тренажеры или свободные веса что лучше',
    ],
  },
  rpe: {
    test: [
      'what does rpe 8 mean',
      'my app says leave 2 in the tank, what does that mean',
      'explain rpe vs rir',
    ],
    testUk: [
      'що означає rpe 8?',
      'що значить залишити 2 повтори в запасі',
      'поясни різницю між rpe і rir',
      'шо такое рпе',
    ],
  },
  stretch_before: {
    test: [
      'is it ok to do static stretches before deadlifts',
      'should i hold stretches before my workout or skip them',
      'does stretching before lifting make you weaker',
    ],
    testUk: [
      'статичну розтяжку до тренування робити чи ні?',
      'чи послаблює розтяжка перед силовими',
      'тягнутися перед присідом чи вже після залу',
      'растяжка перед тренировкой нужна?',
    ],
  },
  grip: {
    test: [
      'bar keeps slipping out of my hands on deadlift',
      'should i use straps or train my grip',
      'how do i get stronger hands for pulling',
    ],
    testUk: [
      'штанга вислизає з рук на тязі',
      'лямки використовувати чи качати хват?',
      'як натренувати хват для підтягувань',
      'хват слабый как укрепить',
    ],
  },
  squat_form: {
    test: [
      'is half squatting ok or do i need to go deep',
      'my knees collapse inward when i stand up from a squat',
      'how low do i go in a back squat',
    ],
    testUk: [
      'напівприсід це нормально чи треба глибше?',
      'коліна заходять всередину, коли встаю з присіду',
      'до якої глибини опускатися в присіді зі штангою',
      'колени сводятся в приседе что делать',
    ],
  },
  fat_loss: {
    test: [
      'want to drop 10kg, where do i start',
      'best way to cut body fat without losing muscle',
      'how do i get rid of my belly',
    ],
    testUk: [
      'хочу скинути 10 кг, з чого почати?',
      'як позбутися живота',
      "як сушитися і не втратити м'язи",
      'как похудеть быстро',
    ],
  },
  sick: {
    test: [
      'got a sore throat, skip the gym today?',
      'is it ok to lift with a runny nose',
      'just getting over flu, when can i go back to training',
    ],
    testUk: [
      'болить горло, пропустити зал?',
      'соплі, можна йти на тренування?',
      'після грипу коли можна повертатись у зал',
      'заболел, можно на треню?',
    ],
  },
  sleep_better: {
    test: [
      'i wake up at 3am every night, help',
      'how do i fall asleep faster',
      'my sleep is terrible lately, any advice',
    ],
    testUk: [
      'прокидаюсь посеред ночі і не можу заснути',
      'як швидше засинати',
      'останнім часом погано сплю, що робити?',
      'как наладить сон',
    ],
  },
  caffeine: {
    test: [
      'is a double espresso before lifting a good idea',
      'how long before training should i drink coffee',
      'is caffeine bad for gains',
    ],
    testUk: [
      'подвійне еспресо перед тренуванням — ок?',
      'за скільки до залу пити каву',
      'кофеїн шкодить результатам?',
      'кофе перед треней норм?',
    ],
  },
  home: {
    test: [
      'only have a pair of dumbbells at home, can i still grow',
      "can't get to the gym, what do i do at home",
      'is push ups and squats at home enough',
    ],
    testUk: [
      'маю вдома тільки гантелі, можна прогресувати?',
      'не можу ходити в зал, як займатися вдома',
      'віджимань і присідань вдома вистачить?',
      'можно ли качаться дома без железа',
    ],
  },
  beginner: {
    test: [
      "never lifted before, what's my first step",
      'total newbie here, how should my first weeks look',
      'first time in a gym, kinda lost',
    ],
    testUk: [
      'ніколи не займався, з чого стартувати?',
      'вперше прийшов у зал, що робити',
      'перший місяць у залі, як тренуватись новачку',
      'я новичок, с чего начинать',
    ],
  },
  app_rest_timer: {
    test: [
      'can i turn off the rest timer',
      "rest timer doesn't make any sound",
      'make rest 90 seconds between sets',
    ],
    testUk: [
      'як вимкнути таймер відпочинку?',
      'таймер відпочинку не пищить',
      'зроби відпочинок 90 секунд між підходами',
      'где настроить таймер отдыха',
    ],
  },
  app_role: {
    test: [
      'i already train with a pt, do i still need you',
      'will you replace my trainer',
      "can you work alongside my coach's program",
    ],
    testUk: [
      'я займаюсь з персональним тренером, ти мені тоді навіщо?',
      'ти замінюєш тренера чи доповнюєш?',
      'чи можеш допомагати, якщо програму мені дає тренер',
      'у меня есть тренер, а ты тогда кто',
    ],
  },
  who_made: {
    test: ['which company is behind you', "who's your developer", 'who programmed this bot'],
    testUk: [
      'яка компанія тебе зробила?',
      'хто твій розробник',
      'хто придумав цього бота',
      'кто тебя разработал',
    ],
  },
  insult: {
    test: ["you're useless", 'dumb bot', 'go to hell'],
    testUk: ['ти тупий', 'дурний бот', 'йди ти', 'ты бесполезный'],
  },
  how_are_you: {
    test: ['how you doing atlas', 'you good?', "how's your day been"],
    testUk: ['як ти там?', 'як твій день', 'як настрій?', 'как дела'],
  },
  consistency: {
    test: [
      'have i been skipping a lot lately',
      'how steady has my gym attendance been',
      'am i sticking to my schedule',
    ],
    testUk: [
      'я часто пропускаю тренування?',
      'чи стабільно я ходжу в зал останнім часом',
      'чи дотримуюсь я графіку',
      'регулярно ли я хожу',
    ],
  },
  warmup_habit: {
    test: [
      'looking at my logs, do i do warm up sets',
      'how often do i skip warming up',
      'check if i warm up before my working sets',
    ],
    testUk: [
      'подивись у записах, чи я роблю розминочні підходи',
      'як часто я пропускаю розминку?',
      'чи вистачає мені розминки за моїми тренуваннями',
      'я вообще разминаюсь судя по логам?',
    ],
  },
  my_goal: {
    test: [
      "remind me what i'm working towards",
      'what target did i put in the app',
      'is my goal set to bulk or cut',
    ],
    testUk: [
      'нагадай, до чого я йду',
      'яку мету я вказав у додатку?',
      'в мене стоїть набір маси чи схуднення?',
      'какая у меня цель стоит',
    ],
  },
  month: {
    test: [
      "how's my september looking",
      'sessions so far in the current month',
      "recap of this month's training",
    ],
    testUk: [
      'скільки разів я був у залі в цьому місяці',
      'як в мене вересень по тренуваннях',
      'підсумуй поточний місяць',
      'сколько трень в этом месяце',
    ],
  },
  arms: {
    test: [
      'biceps stuck at 35cm for a year',
      "what's the best way to make my arms thicker",
      'curls every day but arms still skinny',
    ],
    testUk: [
      'біцепс рік стоїть на місці',
      'як накачати здоровенні руки',
      'качаю біцуху, а руки все одно худі',
      'как накачать руки',
    ],
  },
  periodization: {
    test: [
      "what's the difference between linear and block periodization",
      'explain macrocycle and microcycle',
      'do i need to cycle heavy and light phases',
    ],
    testUk: [
      'в чому різниця між лінійною і блоковою періодизацією',
      'поясни, що таке макроцикл і мікроцикл',
      'чи треба чергувати важкі й легкі фази тренувань',
      'что такое периодизация',
    ],
  },
  squat_vs_press: {
    test: [
      'my back hurts on squats, is leg press enough for legs',
      'will leg press build legs as well as back squats',
      'do i even need barbell squats if i leg press',
    ],
    testUk: [
      'спина болить від присіду, жиму ногами вистачить для ніг?',
      'чи накачаю ноги тільки на жимі платформою',
      'присідання зі штангою або платформа — що обрати',
      'жим ногами вместо приседа норм?',
    ],
  },
  sauna_cold: {
    test: [
      'does sitting in the sauna help recovery',
      'ice bath right after lifting, good or bad',
      'is cold water immersion bad for hypertrophy',
    ],
    testUk: [
      'чи допомагає сауна відновитися після залу',
      'занурюватися в холодну воду після тренування — корисно?',
      'баня після силового нормально?',
      'ледяная ванна после трени вредна?',
    ],
  },
  bench_alone: {
    test: [
      'no one around to spot me, how do i bench heavy',
      'what do i do if i get stuck under the bar alone',
      'should i use safety pins when benching solo',
    ],
    testUk: [
      'ніхто не страхує, як жати важко безпечно?',
      'застряг під штангою сам, що робити',
      'чи треба ставити страхувальні упори, якщо жму один',
      'жму один без страховки, опасно?',
    ],
  },
  app_backfill: {
    test: [
      "didn't record tuesday's workout, can i add it now",
      'how do i enter a session with an earlier date',
      'trained last week but never logged it',
    ],
    testUk: [
      'не записав тренування у вівторок, можна додати зараз?',
      'як внести тренування минулою датою',
      'тренувався тиждень тому, але не зафіксував',
      'забыл записать треню, как добавить',
    ],
  },
  app_delete: {
    test: [
      'logged the wrong exercise, how to get rid of it',
      'accidentally added an extra set, remove it',
      'how to erase a whole workout from history',
    ],
    testUk: [
      'записав не ту вправу, як її прибрати?',
      'випадково додав зайвий підхід, як стерти',
      'як видалити все тренування з історії',
      'как удалить подход',
    ],
  },
  app_sleep_tracking: {
    test: [
      'can i log how many hours i slept',
      'does the app sync sleep from my watch',
      'where do i put in my sleep',
    ],
    testUk: [
      'де вносити години сну в додатку?',
      'чи підтягує додаток сон з годинника',
      'можна записати, скільки я спав?',
      'как трекать сон в приложении',
    ],
  },
  sorry: {
    test: ['sorry for being rude', 'oops, my fault', "apologies, didn't mean that"],
    testUk: ['вибач, був неправий', 'вибачай, погарячкував', 'сорян', 'извини'],
  },
  percent_max: {
    test: [
      "my squat max is 140, what's 85%",
      'give me 65 percent of my deadlift 1rm',
      'calc 90% of my ohp max',
    ],
    testUk: [
      'максимум у присіді 120, скільки це 85%?',
      'порахуй 65 відсотків від мого максимуму в становій',
      '90% від мого жиму стоячи це скільки',
      'сколько будет 80 процентов от моего жима',
    ],
  },
  alternatives: {
    test: [
      'my gym has no leg press, what else can i do',
      'shoulder hurts on dips, what can replace them',
      'swap for barbell rows?',
    ],
    testUk: [
      'у залі немає жиму ногами, чим замінити?',
      'плече болить на брусах, що робити натомість',
      'заміна для тяги штанги в нахилі?',
      'чем заменить выпады',
    ],
  },
  compare_weeks: {
    test: [
      'was this week better than the one before',
      'did my volume go up compared to last week',
      'week over week how am i doing',
    ],
    testUk: [
      'цей тиждень був кращий за попередній?',
      'обсяг зріс порівняно з минулим тижнем?',
      'як я цього тижня відносно попереднього',
      'сравни эту неделю с прошлой',
    ],
  },
  two_a_day: {
    test: [
      'thinking of hitting the gym morning and evening, bad idea?',
      'can i split my workout into two sessions in one day',
      'gym at 7am and again at 6pm, too much?',
    ],
    testUk: [
      'хочу ходити в зал зранку і ввечері, це ок?',
      'чи можна розбити тренування на два за день',
      'дві тренки за день не забагато?',
      'два раза в день тренироваться можно?',
    ],
  },
  cycle: {
    test: [
      'feel weak the week before my period, should i lift lighter',
      'does my luteal phase affect strength',
      'how to adjust training during pms',
    ],
    testUk: [
      'перед місячними немає сил, зменшувати ваги?',
      'як лютеїнова фаза впливає на тренування',
      'чи можна присідати під час менструації',
      'как тренироваться во время месячных',
    ],
  },
  hiit: {
    test: [
      'are sprint intervals better than steady cardio',
      'how long should a hiit session be',
      'tabata worth doing?',
    ],
    testUk: [
      'спринти інтервалами краще за звичайне кардіо?',
      'скільки має тривати hiit тренування',
      'табата варта того?',
      'хиит полезно?',
    ],
  },
  posture: {
    test: [
      'my shoulders roll forward all the time',
      'how to fix forward head posture',
      'sitting all day ruined my posture, what exercises',
    ],
    testUk: [
      'плечі постійно завалені вперед, як виправити',
      'голова висунута вперед, що робити',
      'сиджу цілий день і сутулюсь, які вправи допоможуть',
      'как исправить осанку',
    ],
  },
  what_can_i_ask: {
    test: [
      'what kind of questions do you answer',
      'show me example questions',
      'what topics can i ask about',
    ],
    testUk: [
      'які питання тобі можна ставити?',
      'дай кілька прикладів, що спитати',
      'про що з тобою можна поговорити',
      'что у тебя можно спросить',
    ],
  },
  memory_forget: {
    test: [
      'delete my data from your memory',
      "don't remember what i just said",
      'reset what you know about me',
    ],
    testUk: [
      "видали з пам'яті все про мене",
      "не запам'ятовуй те, що я щойно сказав",
      'скинь все, що ти про мене знаєш',
      'забудь про меня всё',
    ],
  },
  act_avoid: {
    test: [
      'take dips out of my program',
      "i don't want lunges in my workouts anymore",
      'stop putting leg extensions in my plan',
    ],
    testUk: [
      'прибери бруси з моєї програми',
      'не хочу більше випадів у тренуваннях',
      'перестань ставити мені розгинання ніг',
      'убери становую из плана',
    ],
  },
  act_temper: {
    test: ['stop being so harsh', 'go easier on me', 'push me harder, be strict'],
    testUk: [
      'не будь таким суворим',
      "говори зі мною м'якше",
      'будь суворішим, жени мене',
      'будь помягче',
    ],
  },
  range_count: {
    test: [
      'how many times did i train in august',
      'sessions in the last 6 weeks',
      'how many workouts since january',
    ],
    testUk: [
      'скільки тренувань було в серпні?',
      'скільки разів я тренувався за останні півроку',
      'скільки тренувань з початку року',
      'сколько трень было в прошлом месяце',
    ],
  },
  range_muscle: {
    test: [
      'how many chest sets did i do in august',
      'total sets for legs over the last 2 months',
      'back volume since january',
    ],
    testUk: [
      'скільки підходів на груди було в серпні?',
      'обсяг на ноги за останні два місяці',
      'скільки сетів на спину з початку року',
      'сколько подходов на плечи за прошлый месяц',
    ],
  },
  compare_lifts: {
    test: [
      'is my bench weak compared to my squat',
      'which of my big lifts is lagging',
      'how does my ohp stack up against my bench',
    ],
    testUk: [
      'жим лежачи відстає від присіду?',
      'яка з базових вправ у мене відстає',
      'як мій жим стоячи співвідноситься з жимом лежачи',
      'становая сильнее приседа у меня?',
    ],
  },
  why_plan: {
    test: [
      'why did you give me this program',
      "what's the reasoning behind my schedule",
      'why am i doing legs twice',
    ],
    testUk: [
      'чому ти склав мені саме таку програму?',
      'яка логіка мого плану',
      'чому в мене ноги двічі на тиждень',
      'почему у меня такая программа',
    ],
  },
  pain_types: {
    test: [
      'how do i tell normal soreness from an injury',
      'dull ache in my shoulder vs sharp pain, which is worse',
      'sharp pinch in my lower back during deadlifts, is that normal',
    ],
    testUk: [
      'як зрозуміти, крепатура це чи травма',
      'ниючий біль у плечі і різкий — яка різниця?',
      'різкий прострел у попереку на тязі, це нормально?',
      'острая боль или просто мышцы забиты',
    ],
  },
  painkillers: {
    test: [
      'can i pop an advil and still lift',
      'is it bad to train on painkillers',
      'took pills for my back, ok to go to the gym',
    ],
    testUk: [
      'випив нурофен, можна в зал?',
      'тренуватися на знеболювальних шкідливо?',
      'прийняв таблетку від болю в спині, можна тренуватись',
      'можно на обезболе тренироваться',
    ],
  },
  numbness: {
    test: [
      'fingers get tingly during pull ups',
      'my arm goes numb after overhead press',
      'feet go numb on the leg press',
    ],
    testUk: [
      'пальці поколює під час підтягувань',
      'рука німіє після жиму над головою',
      'німіють ступні на жимі ногами',
      'немеет рука после тренировки',
    ],
  },
  bulk_surplus: {
    test: [
      'how many extra calories a day to gain muscle',
      'how much weight per month should i gain on a bulk',
      'is a 500 kcal surplus too much',
    ],
    testUk: [
      'скільки калорій зверху додавати на набір',
      'скільки кг на місяць нормально набирати на масі',
      'профіцит 500 ккал — це не забагато?',
      'какой профицит нужен на массу',
    ],
  },
  pre_meal: {
    test: [
      'best food before an evening workout',
      'is it ok to lift on an empty stomach',
      'how long after eating can i train',
    ],
    testUk: [
      "що краще з'їсти перед вечірнім тренуванням",
      'можна тренуватися на голодний шлунок?',
      'через скільки після їжі йти в зал',
      'что покушать перед треней',
    ],
  },
  vegan: {
    test: [
      "i don't eat meat, can i still get big",
      'how do vegans get enough protein for lifting',
      'is tofu and lentils enough protein to grow',
    ],
    testUk: [
      "не їм м'яса, чи вийде набрати м'язи?",
      'як веганам добрати білок для залу',
      "тофу і сочевиці вистачить для росту м'язів?",
      'я вегетарианец, можно накачаться?',
    ],
  },
  late_eating: {
    test: [
      "i'm hungry at 11pm, is it bad to eat",
      'do calories count more at night',
      'eating after 8pm ruins my diet?',
    ],
    testUk: [
      'голодний об 11 вечора, можна поїсти?',
      'чи правда, що після 18:00 їсти не можна',
      'їжа перед сном заважає схуднути?',
      'поздно кушать вредно?',
    ],
  },
  whats_up: {
    test: ['yo whats good', 'anything new?', 'hey whats happening'],
    testUk: ['шо нового?', 'шо як?', 'що новенького', 'чё там'],
  },
  bored: {
    test: ['ugh so bored rn', 'nothing to do, bored', 'gym feels boring lately'],
    testUk: ['мені так нудно', 'нема чого робити, нудьгую', 'зал уже набрид, нудно', 'скучно'],
  },
  quote: {
    test: [
      'say something motivating',
      'need some words of wisdom',
      'hit me with an inspiring line',
    ],
    testUk: [
      'скажи щось мотивуюче',
      'дай якусь цитату для натхнення',
      'потрібні мудрі слова',
      'дай цитатку',
    ],
  },
  mood_up: {
    test: ['best mood ever today', 'feeling on top of the world', 'life is good rn'],
    testUk: [
      'в мене сьогодні класний настрій',
      'почуваюсь просто чудово',
      'життя прекрасне',
      'настроение огонь',
    ],
  },
  rival_ai: {
    test: [
      'is chatgpt smarter than you',
      'claude gave me a different answer',
      'why would i use you over gpt',
    ],
    testUk: [
      'чатгпт розумніший за тебе?',
      'гемені відповів по-іншому',
      'нащо ти мені, якщо є чатгпт',
      'ты лучше чем chatgpt?',
    ],
  },
  atlas_eat: {
    test: ['do bots eat anything', "what's your favourite meal", 'do you ever get hungry'],
    testUk: [
      'а ти взагалі щось їси?',
      'яка твоя улюблена страва',
      'ти буваєш голодним?',
      'что ты ешь',
    ],
  },
  which_day: {
    test: ["what's today's date", 'which day of the week is it', 'is it monday or tuesday today'],
    testUk: [
      'яка сьогодні дата?',
      'сьогодні понеділок чи вівторок?',
      'підкажи, яке сьогодні число',
      'какой сегодня день',
    ],
  },
  k_deadlift_rounding: {
    test: [
      'lower back curves like a cat on my deadlift',
      'how do i keep a neutral spine when pulling from the floor',
      'my spine flexes on heavy pulls, is that dangerous',
    ],
    testUk: [
      'на тязі з підлоги спина горбиться',
      'як тримати спину рівно на становій',
      'поперек круглиться на важких тягах, це небезпечно?',
      'спина круглая на становой как исправить',
    ],
  },
  k_ohp_lean: {
    test: [
      'my lower back arches a lot when i press overhead',
      'standing press feels like a standing incline bench',
      'how to keep my torso upright on overhead press',
    ],
    testUk: [
      'сильно прогинаюсь у попереку, коли жму над головою',
      'на жимі стоячи корпус завалюється назад',
      'як тримати тулуб рівно на армійському',
      'на армейском жиме прогибаюсь назад',
    ],
  },
  k_sleeves_wraps: {
    test: [
      'are knee sleeves necessary for heavy squats',
      'should i buy wrist wraps for pressing',
      'do sleeves actually protect your knees',
    ],
    testUk: [
      'чи потрібні наколінники на важкі присідання',
      "купувати бинти на зап'ястя для жиму?",
      'наколінники реально захищають коліна?',
      'нужны ли кистевые бинты',
    ],
  },
  k_test_max: {
    test: [
      'how do i work up to a single rep max',
      'how often should i test my 1 rep max',
      'safe way to find my max bench',
    ],
    testUk: [
      'як правильно підійти до максимуму на один раз',
      'як часто перевіряти одноповторний максимум',
      'як безпечно дізнатися свій максимум у жимі',
      'как проверить свой максимум',
    ],
  },
  k_holidays: {
    test: [
      'going home for christmas, how do i keep training',
      'ate way too much over new year, did i lose my gains',
      'how to not fall off during the holiday season',
    ],
    testUk: [
      'їду додому на різдво, як не закинути тренування',
      "об'ївся на новий рік, все пропало?",
      'як не зірватися з режиму на святах',
      'как тренироваться на праздниках',
    ],
  },
  k_older_lifter: {
    test: [
      "i'm 55, should i train differently now",
      'how should a 65 year old lift weights',
      'does recovery change with age, how to adjust',
    ],
    testUk: [
      'мені 55, чи треба тренуватись по-іншому?',
      'як тренуватися людині в 65 років',
      'з віком відновлення гірше, як змінити тренування',
      'мне 50, как тренироваться',
    ],
  },
  k_etiquette: {
    test: [
      'is it rude to leave weights on the bar',
      'how do i politely ask to share a machine',
      'do i have to wipe down the bench after use',
    ],
    testUk: [
      'чи нормально залишати млинці на штанзі?',
      'як ввічливо попросити позайматися на тренажері разом',
      'треба протирати лавку після себе?',
      'какие правила поведения в зале',
    ],
  },
  k_preworkout: {
    test: [
      'should i start taking pre workout',
      'is c4 or any preworkout actually worth the money',
      'do pre workouts do anything',
    ],
    testUk: [
      'чи варто починати пити передтренік',
      'передтренувальні комплекси взагалі працюють?',
      'який передтрен кращий, чи він потрібен',
      'предтрен стоит брать?',
    ],
  },
  k_ankle_mobility: {
    test: [
      'my heels lift off the floor at the bottom of my squat',
      'ankles too stiff to squat deep',
      'should i put plates under my heels when squatting',
    ],
    testUk: [
      "в нижній точці присіду п'яти відриваються від підлоги",
      'гомілкостоп не гнеться, не можу глибоко присісти',
      "чи підкладати млинці під п'яти в присіді",
      'пятки отрываются в приседе',
    ],
  },
  k_more_pullups: {
    test: [
      'can only do 3 pull ups, how do i get to 10',
      'plateaued on chin ups, how to progress',
      'how do i get better at pull ups',
    ],
    testUk: [
      'можу підтягнутись лише 3 рази, як дійти до 10',
      'застряг на підтягуваннях, як прогресувати',
      'як навчитися підтягуватись більше',
      'как увеличить количество подтягиваний',
    ],
  },
  k_bands: {
    test: [
      'can resistance bands replace dumbbells',
      'do elastic bands actually build muscle',
      'is a band workout as good as lifting',
    ],
    testUk: [
      'резинки можуть замінити гантелі?',
      "чи ростуть м'язи від еспандерів",
      'тренування з гумками таке ж ефективне як з вагами?',
      'резинки для тренировок эффективны?',
    ],
  },
  k_cardio_order: {
    test: [
      'do i run before or after lifting',
      'should the bike go at the start or end of my workout',
      'does cardio before weights kill my strength',
    ],
    testUk: [
      'бігати до силового чи після?',
      'велотренажер на початку чи в кінці тренування',
      'кардіо перед вагами зменшує силу?',
      'кардио до или после железа',
    ],
  },
  k_knees_over_toes: {
    test: [
      'my coach says never let knees pass toes, is that true',
      'are knees going over toes dangerous',
      'knees past toes on lunges ok?',
    ],
    testUk: [
      'тренер каже, що коліна не можна виносити за носки — це правда?',
      'коліна за пальцями ніг — небезпечно?',
      'на випадах коліно виходить за носок, це ок?',
      'колени за носки это вредно?',
    ],
  },
};
