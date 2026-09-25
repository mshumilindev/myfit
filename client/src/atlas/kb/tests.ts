/** Held-out phrasings per topic — never used for matching, only to measure understanding. */
export const KB_TESTS: Record<string, { test: string[]; testUk: string[] }> = {
  pain: {
    test: [
      'my shoulder is killing me after pressing',
      'got a sore knee, can i still squat',
      "back hurts since yesterday's deadlift",
    ],
    testUk: [
      'після станової болить поперек',
      'плече болить, чи можна жати',
      'щось потягнув у коліні на присіді',
    ],
  },
  rest: {
    test: [
      'how many seconds between sets of curls',
      'is two minutes of rest too much',
      "what's a good break between squat sets",
    ],
    testUk: [
      'скільки чекати перед наступним сетом',
      'хвилина відпочинку між сетами — це мало?',
      'який відпочинок між підходами на базі',
    ],
  },
  next_weight: {
    test: [
      'how heavy on bench this time',
      'what should the bar weigh for my next squat',
      'time to bump up my deadlift weight?',
    ],
    testUk: [
      'скільки навішувати на жим сьогодні',
      'яку вагу брати на станову наступного тренування',
      'вже можна накинути на присід?',
    ],
  },
  best: {
    test: ["highest weight i've done on squat", "what's my bench pb", 'list my top lifts'],
    testUk: ['скільки найбільше я жав лежачи', 'мій найкращий присід', 'рекорди по становій'],
  },
  progress_lift: {
    test: [
      'is my bench trending up',
      'how far has my deadlift come',
      "squat hasn't budged in weeks",
    ],
    testUk: [
      'чи є зрушення на жимі лежачи',
      'як змінилася моя станова',
      'присід топчеться на місці',
    ],
  },
  volume_muscle: {
    test: [
      "what's my weekly set count for chest",
      'have i done enough back work this week',
      'how many hard sets did quads get',
    ],
    testUk: [
      'скільки робочих сетів отримали груди',
      'чи вистачає обсягу на спину',
      'скільки підходів на ноги цього тижня',
    ],
  },
  weak: {
    test: [
      'what have i been ignoring lately',
      'which muscle is getting left out',
      'where am i unbalanced',
    ],
    testUk: ['що я останнім часом ігнорую', 'який м’яз у мене в загоні', 'де в мене перекіс'],
  },
  recovery: {
    test: [
      'are my arms good to go again',
      "what's recovered enough to train today",
      'my hamstrings still feel beat up',
    ],
    testUk: [
      'руки вже готові до тренування?',
      'що вже можна тренувати, що відновилось',
      'задня поверхня досі забита',
    ],
  },
  today: {
    test: [
      "what's on the menu at the gym today",
      'what am i hitting this afternoon',
      'workout for today please',
    ],
    testUk: [
      'що в мене сьогодні в залі',
      'яку частину тіла сьогодні робити',
      'дай план тренування на зараз',
    ],
  },
  tomorrow: {
    test: [
      'anything planned for tomorrow',
      "what's the session tomorrow morning",
      'gym tomorrow or day off',
    ],
    testUk: ['що на завтра заплановано', 'завтра зранку що тренувати', 'завтра в зал чи вихідний'],
  },
  next_session: {
    test: [
      "what's up next on my schedule",
      'which day do i hit the gym again',
      'next scheduled session',
    ],
    testUk: [
      'наступне заняття за планом',
      'в який день я знову йду в зал',
      'коли наступна тренька',
    ],
  },
  last_session: {
    test: [
      'remind me what i did in my previous gym visit',
      "what happened in yesterday's workout",
      'breakdown of my most recent session',
    ],
    testUk: [
      'нагадай, що я робив минулого разу',
      'що було на вчорашньому тренуванні',
      'розклади моє попереднє заняття',
    ],
  },
  week: {
    test: ['sum up my last seven days', 'how active was i this week', 'give me the weekly numbers'],
    testUk: [
      'підсумуй мої останні сім днів',
      'наскільки активним був тиждень',
      'дай цифри за тиждень',
    ],
  },
  streak: {
    test: [
      'how long has my run of days been',
      'what number is my streak at',
      'is the chain still going',
    ],
    testUk: ['скільки вже днів моя серія', 'серія не зламалась?', 'яке зараз число в серії'],
  },
  total: {
    test: [
      'how many sessions have i ever recorded',
      'total times at the gym since day one',
      'overall workout tally',
    ],
    testUk: [
      'скільки тренувань я записав за весь час',
      'загальний підсумок тренувань',
      'скільки разів я був у залі від початку',
    ],
  },
  sleep: {
    test: [
      'what was my sleep like recently',
      'hours of sleep last night',
      'do i get enough rest at night',
    ],
    testUk: [
      'скільки годин я проспав учора',
      'як у мене зі сном останнім часом',
      'чи вистачає мені сну',
    ],
  },
  deload: {
    test: [
      'is a recovery week coming up',
      'should this week be light',
      "what's the point of backing off for a week",
    ],
    testUk: ['скоро легкий тиждень?', 'мені зараз розвантажитись', 'який сенс у легшому тижні'],
  },
  plan: {
    test: ["what's my routine", 'lay out my training week', 'build me a routine'],
    testUk: ['яка в мене схема тренувань', 'розпиши мій тиждень тренувань', 'зроби мені програму'],
  },
  skip: {
    test: [
      'do i really have to go today',
      'thinking of bailing on the gym tonight',
      'is a missed session a big deal',
    ],
    testUk: [
      'мені обов’язково сьогодні йти?',
      'думаю пропустити зал увечері',
      'нічого страшного, якщо пропущу раз?',
    ],
  },
  motivation: {
    test: [
      "can't get myself off the couch",
      "i really can't be bothered to lift",
      'where do i find the drive to train',
    ],
    testUk: [
      'не можу змусити себе встати з дивана',
      'геть не хочеться качатись',
      'де брати мотивацію на тренування',
    ],
  },
  warmup: {
    test: [
      'what do i do before my first working set',
      'is a quick jog enough to warm up',
      'how to get warm before lifting',
    ],
    testUk: [
      'що робити перед першим робочим сетом',
      'чи вистачить пробіжки як розминки',
      'як підготуватись до тренування',
    ],
  },
  cooldown: {
    test: [
      'what should i do once i finish lifting',
      'is a cool down a waste of time',
      'post-workout stretching routine',
    ],
    testUk: [
      'що робити, коли закінчив тренування',
      'заминка — це марна трата часу?',
      'розтяжка в кінці тренування',
    ],
  },
  cardio: {
    test: [
      'where does cardio fit in my week',
      'jogging after weights ok?',
      'will the treadmill hurt my strength',
    ],
    testUk: [
      'куди вставити кардіо в тиждень',
      'пробіжка після силового — нормально?',
      'бігова доріжка не заважає силі?',
    ],
  },
  reps: {
    test: [
      "what's the ideal number of reps",
      'should my sets be heavy triples or sets of ten',
      'reps to build size',
    ],
    testUk: [
      'яка ідеальна кількість повторів',
      'роблю по 5 чи по 12 повторів?',
      'скільки повторів, щоб рости',
    ],
  },
  failure: {
    test: [
      'do my sets have to be all-out',
      "should i grind until i can't lift anymore",
      'is max effort every set smart',
    ],
    testUk: [
      'треба викладатись до кінця в кожному сеті?',
      'тиснути, поки вже не можу?',
      'чи варто кожен сет до упору',
    ],
  },
  bodyweight: {
    test: [
      'what does the scale say',
      'what was my most recent weight entry',
      'how many kilos am i',
    ],
    testUk: [
      'що показували ваги останнього разу',
      'скільки кілограмів я зараз',
      'моє останнє зважування яке',
    ],
  },
  session_length: {
    test: [
      'how many minutes do i usually train',
      "what's the right length for a gym session",
      'am i spending too long at the gym',
    ],
    testUk: [
      'скільки хвилин я зазвичай тренуюсь',
      'яка правильна тривалість заняття',
      'чи не задовго я сиджу в залі',
    ],
  },
  swap: {
    test: [
      'change bench to something else',
      'the rack is busy, give me another lift',
      'switch out deadlifts today',
    ],
    testUk: [
      'поміняй жим на щось інше',
      'стійка зайнята, дай іншу вправу',
      'сьогодні без станової, заміни',
    ],
  },
  technique: {
    test: [
      'what cues should i use on the bench',
      'am i doing the squat right',
      'teach me the deadlift',
    ],
    testUk: [
      'на що звертати увагу в жимі лежачи',
      'чи правильно я присідаю',
      'навчи мене становій',
    ],
  },
  protein: {
    test: [
      'grams of protein i should hit daily',
      "what's my protein target",
      'eating enough to grow?',
    ],
    testUk: [
      'яка моя норма білка',
      'скільки протеїну вживати щодня',
      'чи достатньо я їм для росту',
    ],
  },
  supplements: {
    test: ['is creatine worth taking', 'what supps do you recommend', 'creatine dose?'],
    testUk: ['яку дозу креатину брати', 'чи є сенс у добавках', 'що з спортпиту варто брати'],
  },
  temper: {
    test: ["you're kind of a jerk", 'tone it down please', 'why are you so aggressive'],
    testUk: ['ти зі мною надто різкий', 'можеш бути лагіднішим', 'чого ти такий злий на мене'],
  },
  who: {
    test: ["what's your job here", 'what are you good for', 'who am i talking to'],
    testUk: ['з ким я розмовляю', 'чим ти можеш бути корисним', 'що ти за бот'],
  },
  thanks: {
    test: ['thanks a bunch', 'appreciate it, thanks', 'thank you kindly'],
    testUk: ['красно дякую', 'дякую велике', 'ну дякую'],
  },
  greeting: {
    test: ['hey there coach', 'good afternoon', 'hello hello'],
    testUk: ['привітики', 'вітаю, тренере', 'доброго дня'],
  },
  ack: {
    test: ['okie', 'gotcha', 'all right'],
    testUk: ['ага, ясно', 'окей, зрозумів', 'угу'],
  },
  muscle_last: {
    test: [
      'how long ago was my last chest day',
      'last session that hit my back',
      'when did my shoulders last get trained',
    ],
    testUk: [
      'як давно я робив груди',
      'останнє тренування на спину коли було',
      'скільки днів тому були плечі',
    ],
  },
  lift_last: {
    test: [
      'how long ago did i squat',
      'when was bench last in my workouts',
      'last session with deadlifts',
    ],
    testUk: [
      'як давно я присідав',
      'коли востаннє був жим лежачи',
      'останнє тренування зі становою',
    ],
  },
  lift_count: {
    test: [
      'how often has squat shown up in my workouts',
      "number of times i've deadlifted",
      'how frequently am i benching lately',
    ],
    testUk: [
      'як часто в мене буває присід',
      'скільки разів я тягнув станову',
      'як регулярно я жму останнім часом',
    ],
  },
  e1rm: {
    test: [
      'what would my bench single be',
      'project my max squat',
      "what's my max for one rep on deadlift",
    ],
    testUk: [
      'скільки я підніму в становій на один раз',
      'оціни мій максимум у жимі',
      'прогноз максимуму на присід',
    ],
  },
  tonnage: {
    test: [
      'how much total load did i move recently',
      'kilograms lifted this week in total',
      'my workload in tons',
    ],
    testUk: [
      'скільки загалом кілограмів я підняв нещодавно',
      'сумарна вага за тиждень',
      'моє навантаження в тоннах',
    ],
  },
  muscle_frequency: {
    test: [
      'how many days a week does chest get hit',
      "what's my back training frequency",
      'should legs be twice weekly',
    ],
    testUk: [
      'скільки днів на тиждень у мене груди',
      'з якою частотою я треную спину',
      'ноги двічі на тиждень — треба?',
    ],
  },
  days_per_week: {
    test: [
      "what's a good weekly training frequency",
      'how many days should i be lifting',
      'is six gym days a week too many',
    ],
    testUk: [
      'яка нормальна частота тренувань на тиждень',
      'скільки днів мені варто тренуватись',
      'шість днів у залі — забагато?',
    ],
  },
  how_am_i_doing: {
    test: [
      'grade my last few weeks',
      "be honest, how's my training",
      'quick check-in on my progress',
    ],
    testUk: [
      'постав мені оцінку за останні тижні',
      'чесно, як мої тренування',
      'короткий огляд мого прогресу',
    ],
  },
  prs_today: {
    test: [
      'did i beat anything this workout',
      "any new bests from today's session",
      'pr count for today',
    ],
    testUk: [
      'я сьогодні щось побив?',
      'нові найкращі результати сьогодні',
      'скільки рекордів за це тренування',
    ],
  },
  plateau: {
    test: [
      'been stuck at the same weights forever',
      'how do i get unstuck',
      'progress has flatlined',
    ],
    testUk: ['вже давно на тих самих вагах', 'як зрушити з мертвої точки', 'прогрес зупинився'],
  },
  injury_status: {
    test: [
      'where does my injury stand right now',
      'rehab stage check please',
      'is my hamstring still flagged as injured',
    ],
    testUk: [
      'де я зараз по реабілітації',
      'на якій фазі моя травма стегна',
      'чи ще числиться травма плеча',
    ],
  },
  overtraining: {
    test: [
      'is my body telling me i do too much',
      'could all this volume be hurting my progress',
      'overtrained or just lazy',
    ],
    testUk: [
      'може я занадто багато тренуюсь',
      'в мене вже перевантаження від обсягу?',
      'як не допустити вигорання в залі',
    ],
  },
  train_sore: {
    test: [
      'hamstrings still aching from monday, can i train legs',
      'is it fine to go to the gym with doms',
      'sore quads today, squat or skip',
    ],
    testUk: [
      'ще тягне м’язи після тренування, можна знов',
      'з болючими після вчора ногами в зал нормально?',
      'крепатура в спині, тягти сьогодні чи ні',
    ],
  },
  weaker_today: {
    test: [
      'today my deadlift felt like double the weight',
      'why am i so weak this session',
      'my strength vanished today',
    ],
    testUk: [
      'сьогодні жим як ніколи важкий, в чому справа',
      'чого я такий слабкий цього разу',
      'куди поділась сила сьогодні',
    ],
  },
  split_choice: {
    test: [
      'i can train four times a week, what split',
      'is a bro split outdated',
      'whole body sessions or split routine',
    ],
    testUk: [
      'маю 4 дні, як розбити тренування',
      'чи варто робити по групі м’язів на день',
      'все тіло щоразу чи розділяти',
    ],
  },
  exercises_per_session: {
    test: [
      "what's a good exercise count for a session",
      'am i doing too many exercises each workout',
      'how many exercises would you put in a leg day',
    ],
    testUk: [
      'скільки вправ оптимально на одне заняття',
      'в мене забагато вправ у тренуванні?',
      'скільки вправ ставити на день ніг',
    ],
  },
  compound_isolation: {
    test: [
      'are single-joint moves worth doing',
      'which gives more gains, bench or flyes',
      'is it ok to skip isolation entirely',
    ],
    testUk: [
      'чи є сенс в односуглобових вправах',
      'що більше дає, жим чи розведення',
      'можна взагалі без ізолюючих?',
    ],
  },
  machines_free: {
    test: [
      'is the leg press as good as squatting',
      'do i lose anything training only on machines',
      'cable and machine work versus barbells',
    ],
    testUk: [
      'жим ногами не гірше за присід?',
      'що втрачаю, якщо тільки тренажери',
      'блоки й тренажери проти штанги',
    ],
  },
  superset: {
    test: [
      'pairing two exercises without rest, good idea?',
      'is supersetting curls with pushdowns effective',
      'should i do my accessories as circuits',
    ],
    testUk: [
      'дві вправи без паузи між ними — ок?',
      'біцепс і трицепс підряд без відпочинку — ефективно?',
      'допоміжні вправи колом робити?',
    ],
  },
  dropset: {
    test: [
      'lowering the weight mid-set to squeeze out more reps',
      'is it smart to drop set my lateral raises',
      'how big should each drop be',
    ],
    testUk: [
      'зменшити вагу посеред підходу і дожати ще — це що',
      'дропсет на махах гантелями має сенс?',
      'наскільки легше брати на кожному скиданні',
    ],
  },
  rpe: {
    test: [
      'how do i know what my rir was',
      'what does an rpe of 7 feel like',
      'should i log effort for every set',
    ],
    testUk: [
      'як визначити, скільки повторів лишилось',
      'rpe 7 — це наскільки важко',
      'чи ставити оцінку зусилля кожному підходу',
    ],
  },
  tempo: {
    test: [
      'should the lowering phase be slow',
      'does rep speed matter for growth',
      'is lifting slowly on purpose useful',
    ],
    testUk: [
      'опускати треба повільно?',
      'чи важить швидкість повтору для росту',
      'навмисно повільно піднімати має сенс?',
    ],
  },
  warmup_sets: {
    test: [
      'how should i build up before my top set',
      "what's the ramp before a heavy bench",
      'do isolation exercises need warmup sets',
    ],
    testUk: [
      'як вийти на робочу вагу у присіді',
      'скільки підходів до робочого на жимі',
      'ізолюючим вправам потрібні підвідні?',
    ],
  },
  stretch_before: {
    test: [
      'is holding stretches pre-lift a mistake',
      'do i stretch before i train legs',
      'static stretch then squat, fine?',
    ],
    testUk: [
      'тягнутись статично до силового — помилка?',
      'розтяжка до дня ніг потрібна?',
      'спочатку потягнутись, а тоді присідати — ок?',
    ],
  },
  mobility: {
    test: [
      'my ankles limit my squat depth, how to fix',
      'how do lifters stay flexible',
      'stiff shoulders when pressing overhead',
    ],
    testUk: [
      'як розробити кульшові суглоби',
      'як атлетам залишатися гнучкими',
      'плечі не пускають жати над головою',
    ],
  },
  abs_daily: {
    test: [
      'is daily core work necessary',
      'how do people get six packs',
      'should abs be trained heavy',
    ],
    testUk: [
      'треба щодня робити вправи на кор?',
      'як отримати шість кубиків',
      'прес треба качати з вагою?',
    ],
  },
  grip: {
    test: [
      'the bar rolls out of my fingers on heavy pulls',
      'what builds hand strength for lifting',
      'grip limits my rows, fix?',
    ],
    testUk: [
      'пальці розтискаються на важкій тязі',
      'як зробити сильніші кисті для залу',
      'на тягах підводить хватка, що робити',
    ],
  },
  belt_straps: {
    test: [
      'is a weightlifting belt necessary',
      'do straps make my grip weaker',
      'when do you put the belt on',
    ],
    testUk: [
      'атлетичний пояс обов’язковий?',
      'від лямок хват слабшає?',
      'на якій вазі вдягати пояс',
    ],
  },
  breathing: {
    test: [
      'when do i breathe out on a squat',
      'how do powerlifters brace',
      'breathing on each rep of deadlift',
    ],
    testUk: [
      'коли видихати на присіді',
      'як пауерліфтери тримають корпус',
      'як дихати на кожному повторі станової',
    ],
  },
  squat_form: {
    test: [
      'is parallel deep enough for squats',
      'my knees shoot forward when i squat, bad?',
      'what should the bottom of a squat look like',
    ],
    testUk: [
      'паралелі достатньо для присіду?',
      'коліна їдуть вперед, коли присідаю — це погано?',
      'як має виглядати нижня точка присіду',
    ],
  },
  results_time: {
    test: [
      'how soon does lifting pay off',
      "i've trained 6 weeks, when do changes show",
      'roughly when will i look different',
    ],
    testUk: [
      'як скоро окупиться зал',
      'півтора місяця тренуюсь, коли зміни',
      'приблизно коли я виглядатиму інакше',
    ],
  },
  muscle_gain_rate: {
    test: [
      "what's the fastest natural way to add muscle",
      'how much size can i add in a year',
      'hardgainer, how do i grow',
    ],
    testUk: [
      'як природно наростити м’язи швидше',
      'скільки маси реально додати за рік',
      'не можу набрати, як рости',
    ],
  },
  fat_loss: {
    test: [
      'how do i drop body fat',
      'can crunches remove my belly',
      'getting leaner while keeping strength',
    ],
    testUk: [
      'як зменшити відсоток жиру',
      'скручування приберуть живіт?',
      'як підсушитись і не втратити силу',
    ],
  },
  myth_bulky: {
    test: [
      'can lifting make me look manly',
      'i only want to firm up, not grow',
      "are women's muscles going to get massive from weights",
    ],
    testUk: [
      'штанга зробить мене мужньою на вигляд?',
      'хочу лише підтягнути тіло, а не рости',
      'в жінки від ваг м’язи стануть масивні?',
    ],
  },
  cardio_gains: {
    test: [
      'is jogging going to cost me muscle',
      'can i keep cardio in while bulking',
      'does endurance work cancel out lifting',
    ],
    testUk: [
      'від пробіжок втрачу м’язи?',
      'можна лишити кардіо на масонаборі?',
      'витривалість зводить нанівець силові?',
    ],
  },
  sick: {
    test: [
      'stuffy nose today, can i still squat',
      'caught the flu, what about my training',
      'how do i log being ill',
    ],
    testUk: [
      'закладений ніс, можна присідати',
      'підхопив грип, що з тренуваннями',
      'як відмітити, що я хворію',
    ],
  },
  alcohol: {
    test: [
      "big night out, what should today's session look like",
      'will a few drinks wreck my progress',
      'morning after beers, safe to deadlift?',
    ],
    testUk: [
      'після гулянки що робити з тренуванням',
      'кілька келихів зіпсують прогрес?',
      'зранку після пива можна станову?',
    ],
  },
  water: {
    test: [
      "what's a good daily water target for someone who lifts",
      'can low water intake make me weaker',
      'should i carry a bottle to the gym',
    ],
    testUk: [
      'яка норма води для тих, хто качається',
      'від нестачі води слабшаєш?',
      'брати пляшку води в зал?',
    ],
  },
  sleep_better: {
    test: [
      'lying awake for hours, help',
      'what helps me get deeper sleep',
      'late gym sessions ruin my sleep',
    ],
    testUk: [
      'годинами не можу заснути, допоможи',
      'що допоможе спати глибше',
      'пізні тренування псують мені сон',
    ],
  },
  time_of_day: {
    test: [
      'am i better off lifting before work or after',
      'does a morning session cost strength',
      'is there an ideal hour for training',
    ],
    testUk: [
      'краще до роботи чи після неї в зал',
      'ранкове тренування забирає силу?',
      'є ідеальна година для тренувань?',
    ],
  },
  fasted: {
    test: [
      'lifting first thing with no food, fine?',
      'do i burn more fat training before breakfast',
      'can i squat heavy while fasting',
    ],
    testUk: [
      'одразу після пробудження без їжі тягати — ок?',
      'до сніданку тренування спалює більше?',
      'важкий присід на голодний — можна?',
    ],
  },
  caffeine: {
    test: [
      'is a cup of coffee a decent pre-workout',
      'how early before lifting should i have caffeine',
      'caffeine dose for training',
    ],
    testUk: [
      'чашка кави — нормальний передтрен?',
      'за скільки до тренування пити каву',
      'яка доза кофеїну для тренування',
    ],
  },
  protein_timing: {
    test: [
      'do i have to chug whey straight after training',
      'is the post-workout window real',
      'should my shake be pre or post',
    ],
    testUk: [
      'треба одразу після залу випивати протеїн?',
      'вікно після тренування — правда?',
      'шейк пити до залу чи після',
    ],
  },
  travel: {
    test: [
      'keeping gains during a work trip',
      'what can i do in my hotel without weights',
      'two weeks at the beach, will i shrink',
    ],
    testUk: [
      'як не втратити форму у відрядженні',
      'що можна робити в готелі без ваг',
      'два тижні на морі — здуюсь?',
    ],
  },
  home: {
    test: [
      'stuck at home, how do i keep training',
      "what's a good equipment-free routine",
      'how can push-ups get harder over time',
    ],
    testUk: [
      'сиджу вдома, як тренуватись далі',
      'добра програма без жодного інвентарю',
      'як ускладнювати віджимання з часом',
    ],
  },
  comeback: {
    test: [
      'how do i restart after three months off',
      'back in the gym after summer, what weight',
      'will my strength return quickly after a layoff',
    ],
    testUk: [
      'як відновити тренування після трьох місяців',
      'після літа знову в зал, з якої ваги',
      'сила швидко повернеться після простою?',
    ],
  },
  rest_day: {
    test: [
      'ideas for an off day between sessions',
      'is a long walk fine on a recovery day',
      'do i just sit around on rest days',
    ],
    testUk: [
      'ідеї на день між тренуваннями',
      'довга прогулянка у вихідний — ок?',
      'у вихідний просто лежати на дивані?',
    ],
  },
  beginner: {
    test: [
      'total beginner, give me a starting plan',
      'what should someone new to lifting focus on',
      'first week at the gym, what exercises',
    ],
    testUk: [
      'зовсім початківець, дай план старту',
      'на чому зосередитись новачку в залі',
      'перший тиждень у залі, які вправи',
    ],
  },
  shoes: {
    test: [
      'is it bad to squat in running trainers',
      "what's the best footwear for deadlifting",
      'are heeled lifting shoes necessary',
    ],
    testUk: [
      'присідати в бігових кросах — погано?',
      'яке взуття найкраще для станової',
      'штангетки з підбором обов’язкові?',
    ],
  },
  app_log_set: {
    test: [
      'how do i put in the set i just finished',
      'where do reps and kilos go in the app',
      'whats the button to save a set',
    ],
    testUk: [
      'як занести щойно зроблений підхід',
      'куди писати кілограми й повтори',
      'яка кнопка зберігає сет',
    ],
  },
  app_rest_timer: {
    test: [
      'can i make the rest countdown longer',
      'my timer is silent, how do i fix the sound',
      'change the alert when rest ends',
    ],
    testUk: [
      'як зробити довший відлік відпочинку',
      'таймер мовчить, як увімкнути звук',
      'як змінити сигнал кінця відпочинку',
    ],
  },
  app_notifications: {
    test: [
      'my iphone never shows alerts from spotter',
      'how can i get pushes from this app',
      'where do i allow notifications',
    ],
    testUk: [
      'айфон не показує жодних сповіщень від spotter',
      'як мені отримувати пуші',
      'де дозволити нотифікації',
    ],
  },
  app_turn_off: {
    test: [
      'i want to switch this coach off',
      'where do i disable atlas completely',
      'how can i make the ai go away',
    ],
    testUk: [
      'хочу вимкнути цього тренера',
      'де повністю відключити атлас',
      'як прибрати цього бота',
    ],
  },
  app_role: {
    test: [
      'my trainer already programs for me, can you just give feedback',
      'how do i let you write my workouts',
      'main or extra coach, which are you',
    ],
    testUk: [
      'мені вже пише програму тренер, можеш лише коментувати',
      'як зробити щоб ти складав мені тренування',
      'ти основний чи додатковий',
    ],
  },
  app_injury_log: {
    test: [
      'where do i put that my elbow is hurt',
      'can the app know about my injured ankle',
      'how to register an injury',
    ],
    testUk: [
      'куди вписати що в мене болить лікоть після травми',
      'як дати додатку знати про травму щиколотки',
      'як зареєструвати травму',
    ],
  },
  are_you_ai: {
    test: ['is a human answering me', 'are you some kind of program', 'real person or machine'],
    testUk: ['мені відповідає людина', 'ти якась програма', 'ти живий тренер чи машина'],
  },
  who_made: {
    test: ['who is your developer', 'why the name atlas', 'who put you together'],
    testUk: ['хто твій розробник', 'чого ти атлас', 'хто тебе зібрав'],
  },
  motivate: {
    test: ['talk me into going today', 'i need someone to push me', 'pump me up'],
    testUk: ['переконай мене піти сьогодні', 'мені треба щоб хтось підштовхнув', 'заряди мене'],
  },
  joke: {
    test: ['got anything funny for me', 'hit me with a joke', 'any jokes about lifting'],
    testUk: ['маєш щось смішне', 'давай жарт', 'є анекдоти про штангу'],
  },
  insult: {
    test: ['fuck this', 'i hate you so much', 'just shut up already'],
    testUk: ['та пішов ти', 'ненавиджу, заткнися', 'відвали від мене'],
  },
  done: {
    test: ['just wrapped up my workout', 'finished today', 'session complete'],
    testUk: ['щойно закінчив тренування', 'на сьогодні все зробив', 'тренування готове'],
  },
  bye: {
    test: ['alright, see you', 'leaving now, bye', 'talk to you later'],
    testUk: ['ну давай, до зустрічі', 'я пішов, бувай', 'поговоримо пізніше'],
  },
  how_are_you: {
    test: ['hows everything with you', 'how is atlas today', 'doing ok'],
    testUk: ['як ти там', 'як у тебе день', 'в тебе все норм'],
  },
  heaviest: {
    test: [
      'which exercise have i loaded the most on',
      'the most kilos i ever lifted',
      'whats the heaviest set in my history',
    ],
    testUk: [
      'де в мене найбільші кілограми',
      'скільки найбільше я колись підняв',
      'найважчий сет в історії',
    ],
  },
  favourite_lift: {
    test: [
      'which lift appears most in my workouts',
      'what are my go to exercises',
      'top three exercises i do',
    ],
    testUk: [
      'яка вправа найчастіше в моїх тренуваннях',
      'мої основні вправи за кількістю',
      'топ три вправи які я роблю',
    ],
  },
  consistency: {
    test: [
      'have i been training steadily',
      'how many good weeks have i had recently',
      'is my attendance regular',
    ],
    testUk: [
      'чи я тренуюся стабільно',
      'скільки нормальних тижнів у мене було останнім часом',
      'як часто я не пропускаю',
    ],
  },
  best_weekday: {
    test: [
      'which weekdays do i lift on most',
      "what's my usual gym day",
      'do i mostly train on weekends',
    ],
    testUk: [
      'по яких днях я найчастіше в залі',
      'мій звичайний день для тренування',
      'я здебільшого тренуюсь на вихідних',
    ],
  },
  rest_actual: {
    test: [
      'what were my real breaks last workout',
      'how much time passes between my sets',
      'check how long i rest in practice',
    ],
    testUk: [
      'які в мене були реальні перерви минулого разу',
      'скільки часу минає між моїми сетами',
      'перевір скільки я відпочиваю на практиці',
    ],
  },
  warmup_habit: {
    test: [
      'have i been doing my warm ups',
      'judging by my log do i warm up',
      'am i lazy with warm ups',
    ],
    testUk: [
      'чи я роблю свої розминки',
      'по журналу видно що я розминаюсь',
      'я лінуюсь з розминкою',
    ],
  },
  cardio_done: {
    test: [
      'how much moving did i do these 7 days',
      'total cardio minutes for the week',
      'am i close to 150 minutes this week',
    ],
    testUk: [
      'скільки я рухався за ці 7 днів',
      'сума хвилин кардіо за тиждень',
      'чи я близько до 150 хвилин цього тижня',
    ],
  },
  my_gym: {
    test: [
      'where do most of my workouts happen',
      'which of my gyms is the main one',
      'how many gyms are saved in the app',
    ],
    testUk: [
      'де проходить більшість моїх тренувань',
      'який з моїх залів головний',
      'скільки залів збережено в додатку',
    ],
  },
  my_goal: {
    test: [
      'what am i aiming for right now',
      'which goal is set in my profile',
      'where can i pick a goal',
    ],
    testUk: ['на що я зараз націлений', 'яка ціль стоїть у профілі', 'де вибрати ціль'],
  },
  bw_trend: {
    test: [
      'has my scale weight gone up lately',
      'am i getting lighter',
      'which way is my weight heading',
    ],
    testUk: ['моя вага останнім часом збільшилась', 'я стаю легшим', 'куди йде моя вага'],
  },
  strength_ratio: {
    test: [
      'is my squat any good',
      'how does my deadlift compare to my bodyweight',
      'is my bench considered strong',
    ],
    testUk: [
      'мій присід взагалі нормальний',
      'як моя станова відносно ваги тіла',
      'мій жим вважається сильним',
    ],
  },
  month: {
    test: [
      'how busy was i in the gym this month',
      'count my workouts for the month',
      'sets and sessions so far this month',
    ],
    testUk: [
      'скільки я наробив у залі за цей місяць',
      'порахуй тренування за місяць',
      'сети й тренування з початку місяця',
    ],
  },
  longest_session: {
    test: [
      'which workout lasted the longest',
      'fastest session i ever finished',
      'my record for workout length',
    ],
    testUk: [
      'яке тренування тривало найдовше',
      'найшвидше завершене тренування',
      'мій рекорд тривалості тренування',
    ],
  },
  grow_muscle: {
    test: [
      'what should i do for bigger delts',
      'how can i build my glutes',
      'my back is lagging, how do i grow it',
    ],
    testUk: [
      'що робити щоб дельти стали більші',
      'як наростити сідниці',
      'спина відстає, як її накачати',
    ],
  },
  arms: {
    test: [
      "what's the plan for bigger arms",
      'i want thicker arms, where do i start',
      'arms stuck at the same size',
    ],
    testUk: ['який план для великих рук', 'хочу товщі руки, з чого почати', 'руки стоять на місці'],
  },
  add_weight: {
    test: [
      'what jump should i use on overhead press',
      'i hit 12 reps on every set, time to go heavier?',
      'how do i decide to put more weight on',
    ],
    testUk: [
      'який крок брати на армійському жимі',
      'зробив 12 на всіх сетах, пора важче',
      'як вирішити що час ставити більше',
    ],
  },
  strength_vs_size: {
    test: [
      'is it better to lift heavy or do more reps for muscle',
      'power training vs bodybuilding reps',
      'which builds more muscle, 5 reps or 12',
    ],
    testUk: [
      'краще важко чи багато повторів для м’язів',
      'силові повтори проти бодібілдерських',
      'що більше качає, 5 повторів чи 12',
    ],
  },
  periodization: {
    test: [
      'how are training blocks supposed to work',
      'explain mesocycles to me',
      'how long is one cycle in my plan',
    ],
    testUk: [
      'як мають працювати тренувальні блоки',
      'поясни мені мезоцикли',
      'скільки триває один цикл у моєму плані',
    ],
  },
  unilateral: {
    test: [
      'my right arm lifts more than my left',
      'what helps with a side to side strength gap',
      'is single side training useful',
    ],
    testUk: [
      'права рука піднімає більше ніж ліва',
      'що допоможе з різницею сили між сторонами',
      'чи корисні вправи на одну сторону',
    ],
  },
  pullup_zero: {
    test: [
      'how do i go from zero to one pull up',
      'my first chin up seems impossible',
      'what to train when pull ups are too hard',
    ],
    testUk: [
      'як перейти від нуля до одного підтягування',
      'перше підтягування здається нереальним',
      'що тренувати якщо підтягування поки не виходять',
    ],
  },
  squat_vs_press: {
    test: [
      'is the leg press machine enough instead of squatting',
      'squats or the sled for leg size',
      'do i have to barbell squat or is leg press fine',
    ],
    testUk: [
      'тренажера для жиму ногами досить замість присіду',
      'присід чи платформа для об’єму ніг',
      'обов’язково присідати зі штангою чи можна жим ногами',
    ],
  },
  incline_flat: {
    test: [
      'which bench angle hits the upper pecs',
      'do i pick flat or incline pressing',
      'my clavicular chest needs work, what press',
    ],
    testUk: [
      'який кут лави для верхніх грудних',
      'обрати горизонтальний чи похилий жим',
      'верх грудей слабкий, який жим робити',
    ],
  },
  foam_roll: {
    test: [
      'is a massage gun useful for lifting',
      'worth rolling out before squats',
      'does rolling my back do anything',
    ],
    testUk: [
      'масажний пістолет корисний для залу',
      'чи варто покатати ролик перед присідом',
      'ролик для спини щось дає',
    ],
  },
  sauna_cold: {
    test: [
      'is a cold plunge bad for gains',
      'can i hit the sauna right after a session',
      'ice water after training, yes or no',
    ],
    testUk: [
      'крижана купіль шкодить росту',
      'можна в сауну одразу після тренування',
      'холодна вода після залу, так чи ні',
    ],
  },
  nap: {
    test: [
      'is dozing off in the afternoon good for me',
      "what's the ideal nap length",
      'slept badly, should i nap before the gym',
    ],
    testUk: [
      'чи корисно задрімати по обіді',
      'яка ідеальна тривалість денного сну',
      'погано спав, поспати перед залом',
    ],
  },
  stress: {
    test: [
      'stressful week, do i keep lifting',
      "is it ok to work out when i'm overwhelmed",
      'does stress hurt my gains',
    ],
    testUk: [
      'стресовий тиждень, продовжувати тренування',
      'можна тренуватися коли все навалилось',
      'стрес шкодить прогресу',
    ],
  },
  bench_alone: {
    test: [
      'nobody to spot me, how do i bench heavy',
      "what if the bar pins me when i'm alone",
      'safe way to squat solo',
    ],
    testUk: [
      'нема кому підстрахувати, як жати важко',
      'що як штанга придавить а я сам',
      'як безпечно присідати одному',
    ],
  },
  age: {
    test: [
      "i'm in my fifties, can i still build muscle",
      'is lifting worth starting at 48',
      'how do older lifters need to train differently',
    ],
    testUk: [
      'мені за п’ятдесят, ще можна наростити м’язи',
      'чи є сенс починати в 48',
      'чим тренування старших відрізняються',
    ],
  },
  gym_anxiety: {
    test: [
      'the gym intimidates me',
      "i'm worried people will laugh at me lifting",
      'how do i feel less awkward among gym regulars',
    ],
    testUk: [
      'зал мене лякає',
      'боюсь що з мене сміятимуться',
      'як не почуватися ніяково серед постійних відвідувачів',
    ],
  },
  app_backfill: {
    test: [
      'how do i put in a workout i did two days ago',
      'missed logging saturday, can i add it',
      'enter a session with an earlier date',
    ],
    testUk: [
      'як внести тренування позавчора',
      'не записав суботу, можна додати',
      'внести тренування з ранішою датою',
    ],
  },
  app_units: {
    test: [
      'i want lb instead of kilos',
      'can one exercise use different units',
      'where do i change kg',
    ],
    testUk: [
      'хочу фунти замість кілограмів',
      'чи може одна вправа мати інші одиниці',
      'де змінити кг',
    ],
  },
  app_language: {
    test: [
      'how can i get the interface in english',
      'i need the app in ukrainian',
      'where do i pick a language',
    ],
    testUk: [
      'як зробити інтерфейс англійською',
      'мені потрібен додаток українською',
      'де вибрати мову',
    ],
  },
  app_delete: {
    test: [
      'how do i get rid of a set i entered wrong',
      "erase yesterday's workout",
      "take an exercise out of today's session",
    ],
    testUk: [
      'як позбутися неправильно внесеного сету',
      'стерти вчорашнє тренування',
      'прибрати вправу з сьогоднішнього тренування',
    ],
  },
  app_playbook: {
    test: [
      'can i repeat my usual leg day with one tap',
      'how does the app know my regular workouts',
      'where are workout templates',
    ],
    testUk: [
      'можна запустити звичний день ніг одним тапом',
      'звідки додаток знає мої звичні тренування',
      'де шаблони тренувань',
    ],
  },
  app_streak_rules: {
    test: [
      'if i take a planned break does my streak end',
      'do logged activities keep my streak alive',
      'what exactly keeps the streak going',
    ],
    testUk: [
      'якщо запланована перерва, серія обірветься',
      'записані активності зберігають серію',
      'що саме підтримує серію',
    ],
  },
  app_sleep_tracking: {
    test: [
      'can sleep be recorded without me pressing anything',
      "last night's sleep is wrong, how to change it",
      'how does sleep logging work here',
    ],
    testUk: [
      'сон може записуватися без натискань',
      'сон за минулу ніч неправильний, як змінити',
      'як тут працює запис сну',
    ],
  },
  do_you_lift: {
    test: ['do you ever work out yourself', "what's your bench", 'bro do you lift'],
    testUk: ['ти сам тренуєшся', 'який у тебе жим', 'а ти в зал ходиш'],
  },
  compliment: {
    test: ["you're a legend", "honestly the best coach i've had", "atlas you're great"],
    testUk: ['ти легенда', 'чесно найкращий тренер', 'атлас ти чудовий'],
  },
  sorry: {
    test: ['apologies for missing my session', 'oops my fault', 'forgive me for skipping'],
    testUk: ['перепрошую що пропустив тренування', 'ой, моя провина', 'пробач що прогуляв'],
  },
  plate_math: {
    test: [
      'what goes on each side if i want 100 kg',
      'break down 125 kg into plates',
      'which plates for a 150 kg squat',
    ],
    testUk: [
      'що вішати з боків для 100 кг',
      'розкинь 125 кг по млинцях',
      'які млинці на присід 150 кг',
    ],
  },
  reps_at_weight: {
    test: [
      'what can i rep on bench with 80 kg',
      'at 120 kg squat how many would i get',
      'how many times can i pull 150 kg deadlift',
    ],
    testUk: [
      'скільки разів підніму 80 кг на жимі лежачи',
      'присід 120 — на скільки повторів мене вистачить',
      'скільки повторів у становій із 150 кг вийде',
    ],
  },
  percent_max: {
    test: [
      'work out 70 percent on bench for me',
      'what should 80% on squat be',
      'deadlift at 85 percent is how many kg',
    ],
    testUk: [
      'скільки кг це 70% на жимі',
      'яка вага на 80 відсотків у присіді',
      'станова на 85% — це скільки',
    ],
  },
  warmup_lift: {
    test: [
      "what's my warmup before bench today",
      'steps up to work weight on squat',
      'deadlift ramp up sets please',
    ],
    testUk: [
      'як мені розім’ятись до жиму',
      'драбинка підвідних на присід',
      'розминочні підходи для станової',
    ],
  },
  exercise_muscles: {
    test: [
      'what are pull-ups good for muscle wise',
      'which muscles does squatting build',
      'bench press targets which muscles',
    ],
    testUk: [
      'які м’язи розвиває станова тяга',
      'підтягування — яка група м’язів',
      'що навантажує жим над головою',
    ],
  },
  alternatives: {
    test: [
      'what could i do in place of deadlifts',
      'bench press substitute at a home gym',
      'is there another option than squats',
    ],
    testUk: [
      'що є натомість присіду',
      'чим підмінити станову тягу',
      'інший варіант замість жиму лежачи',
    ],
  },
  sets_for_lift: {
    test: [
      "what's a good set count for bench",
      'how many rounds of squats should i do',
      'sets per workout for deadlift?',
    ],
    testUk: [
      'яка оптимальна кількість сетів на присід',
      'скільки мені підходів на жим лежачи',
      'станова — скільки робочих сетів',
    ],
  },
  day_lookup: {
    test: [
      "what was monday's training",
      'which lifts did i do wednesday',
      'friday session, what was in it',
    ],
    testUk: [
      'яке тренування було в понеділок',
      'що в мене було в середу в залі',
      'що я качав у пятницю',
    ],
  },
  compare_weeks: {
    test: [
      "how's this week stacking up against last week",
      'did i do less than the week before',
      'this week compared to last, sets and sessions',
    ],
    testUk: [
      'як цей тиждень виглядає проти минулого',
      'я зробив менше ніж попереднім тижнем?',
      'порівняння: цей тиждень і минулого тижня',
    ],
  },
  short_on_time: {
    test: [
      "got half an hour, what's the plan",
      'busy day, only 20 minutes to lift',
      'need a quick one, 35 minutes',
    ],
    testUk: [
      'маю пів години, що встигну',
      'зайнятий день, лише 20 хвилин',
      'треба швиденько, хвилин 35',
    ],
  },
  two_days_row: {
    test: [
      'is lifting on consecutive days a problem',
      'can i do chest today and chest tomorrow',
      'daily gym sessions, is that fine',
    ],
    testUk: [
      'чи нормально качатися щодня',
      'сьогодні груди і завтра груди — можна?',
      'підряд два дні тренування — не шкідливо?',
    ],
  },
  two_a_day: {
    test: [
      'is doing two workouts in one day smart',
      'am i overdoing it with morning and night sessions',
      'double sessions daily, yes or no',
    ],
    testUk: [
      'два заняття за день — розумно?',
      'вранці й ввечері в залі — не перебір?',
      'дві сесії на день, так чи ні',
    ],
  },
  health_conditions: {
    test: [
      'is lifting safe if my blood pressure is high',
      'diabetic, can i train heavy',
      'gym ok for someone with asthma?',
    ],
    testUk: [
      'з підвищеним тиском у зал можна?',
      'я діабетик, можна важкі тренування',
      'астматику можна силові?',
    ],
  },
  peds: {
    test: [
      'would sarms help me grow faster',
      'thinking about juicing, thoughts',
      'is a test cycle a good idea',
    ],
    testUk: ['а на стероїдах швидше буде?', 'думаю про курс тестостерону', 'хімія варта того?'],
  },
  cycle: {
    test: [
      "is gym ok when i'm on my period",
      'does the menstrual phase change how much i can lift',
      'training while having period cramps',
    ],
    testUk: [
      'можна в зал на місячних?',
      'чи змінюється сила від фази циклу',
      'тренуватись коли спазми від місячних',
    ],
  },
  pregnancy: {
    test: [
      'safe exercises while expecting a baby',
      'how soon after delivery can i train',
      'pregnant and want to keep squatting',
    ],
    testUk: [
      'що можна робити в залі при вагітності',
      'як скоро після пологів тренуватися',
      'вагітна і хочу далі присідати',
    ],
  },
  hr_zones: {
    test: [
      'what bpm counts as zone two',
      'is conversational pace cardio the same as zone 2',
      'how hard should easy cardio feel heart rate wise',
    ],
    testUk: [
      'скільки ударів це зона два',
      'кардіо в розмовному темпі — це зона 2?',
      'який пульс тримати на легкому кардіо',
    ],
  },
  hiit: {
    test: [
      "what's a good interval workout",
      'how many hiit sessions a week with lifting',
      'is tabata enough cardio',
    ],
    testUk: [
      'яке інтервальне тренування добре',
      'скільки разів на тиждень hiit, якщо качаюсь',
      'табати вистачить як кардіо?',
    ],
  },
  running: {
    test: [
      'is jogging compatible with building muscle',
      'half marathon prep and still lifting',
      'running on the same day as squats',
    ],
    testUk: [
      'біг заважає набирати м’язи?',
      'готуюсь до напівмарафону і ходжу в зал',
      'бігати в той же день що й присід',
    ],
  },
  steps: {
    test: [
      "what's a good daily walking target",
      'do steps matter if i lift',
      'will walking more help me cut',
    ],
    testUk: [
      'яка норма кроків на день',
      'чи важливі кроки, якщо я качаюсь',
      'більше ходити допоможе на сушці?',
    ],
  },
  posture: {
    test: [
      'my shoulders roll forward, what should i train',
      'how do i stop hunching',
      'best lifts for better posture',
    ],
    testUk: [
      'плечі завалюються вперед, що тренувати',
      'як перестати сутулитися',
      'які вправи найкращі для рівної спини',
    ],
  },
  other_sport: {
    test: [
      'i do muay thai, should i also lift',
      'gym plan for a football season',
      'does weight training help swimming',
    ],
    testUk: [
      'я займаюсь боксом, чи треба зал',
      'план силових на футбольний сезон',
      'силові допомагають у плаванні?',
    ],
  },
  home_equipment: {
    test: [
      'first purchases for training at home',
      'cheap home gym setup ideas',
      'what gear should i get for my garage',
    ],
    testUk: [
      'що першим купити для дому',
      'бюджетний домашній зал — що брати',
      'яке залізо купити в гараж',
    ],
  },
  what_can_i_ask: {
    test: [
      'what are you good for',
      'help me figure out what to ask',
      'what sort of stuff can you answer',
    ],
    testUk: ['а що ти взагалі знаєш', 'підкажи, що в тебе питати', 'на які питання ти відповідаєш'],
  },
  reminder: {
    test: [
      'ping me before my next workout',
      'can you nudge me to train',
      "alert me when it's gym time",
    ],
    testUk: [
      'нагадуй мені про зал',
      'можеш мене штурхати, щоб тренувався',
      'постав нагадайку на завтра',
    ],
  },
  memory_show: {
    test: [
      'what have you learned about me',
      "what's in your memory about me",
      'remind me what you know about me',
    ],
    testUk: [
      'що ти вже дізнався про мене',
      'що в твоїй пам’яті про мене',
      'нагадай, що ти про мене знаєш',
    ],
  },
  memory_forget: {
    test: [
      'delete what you know about me',
      'reset your memory of me',
      'clear my info please, forget all',
    ],
    testUk: [
      'видали все, що знаєш про мене, забудь',
      'скинь пам’ять про мене, зітри все',
      'забудь, будь ласка, це все',
    ],
  },
  act_rest: {
    test: [
      'rest 3 minutes on bench from now',
      'set squat rest time to 150 seconds',
      'change pull-up rest to 2:00',
    ],
    testUk: [
      'постав на жимі лежачи паузу 3 хв',
      'зроби на присіді відпочинок 150 секунд',
      'встанови відпочинок 2 хвилини на підтягуваннях',
    ],
  },
  act_swap: {
    test: [
      'put dumbbell press in place of bench',
      'i want leg press rather than squats in my plan',
      'change pull-ups over to lat pulldown',
    ],
    testUk: [
      'постав жим гантелей замість жиму лежачи',
      'хочу жим ногами замість присіду в плані',
      'поміняй підтягування на тягу верхнього блоку',
    ],
  },
  act_avoid: {
    test: [
      'take squats out of my plan',
      'stop giving me deadlifts in the program',
      'never schedule bench press again',
    ],
    testUk: [
      'вийми присід із плану',
      'більше не давай мені станову',
      'виключи жим лежачи з мого плану назавжди',
    ],
  },
  act_move: {
    test: [
      'can you push legs to thursday',
      'move my pull day over to saturday',
      "put today's workout on friday instead, move it",
    ],
    testUk: [
      'перенеси день ніг на четвер',
      'пересунь тягу на суботу',
      'перенеси сьогоднішнє на пятницю',
    ],
  },
  act_start: {
    test: ['fire up a workout', "let's begin the training", "open and start today's session"],
    testUk: [
      'запускай тренування, почати',
      'давай почнемо тренування',
      'стартуй сьогоднішнє заняття',
    ],
  },
  act_temper: {
    test: [
      'go easier on me tone wise, be gentler',
      'turn up the strictness, be ruder',
      'switch to blunt mode',
    ],
    testUk: ['говори зі мною м’якше', 'будь нещадним', 'перейди на прямий тон'],
  },
  act_mute: {
    test: [
      'turn off notifications for today',
      'stop messaging me today, mute',
      'hush the pushes today',
    ],
    testUk: [
      'сьогодні без сповіщень, вимкни',
      'не надсилай мені пуші сьогодні',
      'помовч до завтра, сьогодні',
    ],
  },
  act_bodyweight: {
    test: [
      'just weighed myself, 83 kg',
      'scale says i weigh 76',
      'bodyweight today, my weight is 91 kg',
    ],
    testUk: ['щойно зважився, 83 кг', 'ваги показують, я важу 76', 'моя вага зранку 91 кг'],
  },
  range_count: {
    test: [
      'count my workouts over the last 2 months',
      'how many times have i lifted since september',
      'total sessions in the past 4 weeks, how many',
    ],
    testUk: [
      'порахуй мої тренування за останні 2 місяці',
      'скільки разів я качався з вересня',
      'скільки всього занять за останні 4 тижні',
    ],
  },
  range_summary: {
    test: [
      'sum up my training over the last 2 months',
      'how did september go in the gym',
      'rundown of the past 4 weeks',
    ],
    testUk: [
      'підсумуй мої тренування за останні 2 місяці',
      'як у мене пройшов вересень',
      'коротко про останні 4 тижні',
    ],
  },
  range_lift: {
    test: [
      'bench trend over the past 2 months',
      'has my deadlift improved since july',
      'squat numbers this month vs start of month',
    ],
    testUk: [
      'як ішов жим за останні 2 місяці',
      'станова покращилась з липня?',
      'присід цього місяця — яка динаміка',
    ],
  },
  range_muscle: {
    test: [
      'chest set count over the past 2 months',
      'how much back work since september',
      'leg volume in the last 3 weeks',
    ],
    testUk: [
      'кількість сетів на груди за останні 2 місяці',
      'скільки роботи на спину з вересня',
      'обсяг ніг за останні 3 тижні',
    ],
  },
  range_bw: {
    test: [
      'has my bodyweight moved since july',
      'weight over the past 2 months',
      'how much did the scale change this month',
    ],
    testUk: [
      'чи змінилась вага з липня',
      'моя вага за останні 2 місяці',
      'наскільки змінилися ваги цього місяця',
    ],
  },
  then_vs_now: {
    test: [
      'how do i stack up now versus 2 months ago',
      'any stronger than i was 6 months ago',
      'me today compared with a year ago',
    ],
    testUk: [
      'як я зараз проти 2 місяців тому',
      'чи став сильнішим ніж пів року тому',
      'я сьогодні і рік тому — порівняй',
    ],
  },
  compare_lifts: {
    test: [
      'how does my squat stack up to my deadlift',
      'bench or squat, which is behind',
      'deadlift relative to squat, is it normal',
    ],
    testUk: [
      'як мій присід відносно станової',
      'жим чи присід — що позаду',
      'станова відносно присіду — нормально?',
    ],
  },
  why_today: {
    test: [
      "what's the reason for today's workout",
      'why is legs on the menu today',
      "how come today's session looks like this",
    ],
    testUk: [
      'з якої причини сьогодні таке тренування',
      'чому сьогодні в плані ноги',
      'навіщо сьогодні саме ця сесія',
    ],
  },
  why_weight: {
    test: [
      "what's the reason my bench number went down",
      'why the jump in squat weight',
      'why am i stuck on the same deadlift weight',
    ],
    testUk: [
      'з якої причини на жимі менша вага',
      'чому стрибнула вага в присіді',
      'чому в становій та сама вага',
    ],
  },
  why_plan: {
    test: [
      "what's the logic behind my program",
      'why is my week split like this',
      'reasoning for my schedule',
    ],
    testUk: [
      'яка логіка моєї програми',
      'чому мій тиждень розбитий саме так',
      'чим обґрунтований мій розклад, чому',
    ],
  },
  why_lift: {
    test: [
      "what's the point of squats in my plan",
      'why did you include deadlift in my program',
      'reason for bench press in the plan',
    ],
    testUk: [
      'який сенс присіду в моєму плані',
      'чому ти включив станову в програму',
      'навіщо в плані жим лежачи',
    ],
  },
  technique_lift: {
    test: [
      'how do i bench without hurting my shoulders',
      'squat technique breakdown',
      'what are the key cues for a conventional deadlift',
    ],
    testUk: [
      'розкажи як правильно робити жим лежачи',
      'техніка присідань зі штангою',
      'як тягнути станову, щоб не зірвати спину',
    ],
  },
  pain_types: {
    test: [
      'is this pain normal or am i injured',
      'sharp twinge in my hip on the leg press',
      'burning in the muscle vs pain in the joint',
    ],
    testUk: [
      'який біль означає травму',
      'різкий біль у стегні на жимі ногами',
      'болить тупо, чи можна тренуватися',
    ],
  },
  return_injury: {
    test: [
      'back from an injury, how heavy should i go',
      "what's the plan for returning after i hurt my back",
      'is it too early to lift again after my injury',
    ],
    testUk: [
      'як правильно відновлюватись у залі після травми',
      'коли вже можна тренуватися після травми ноги',
      'яку вагу брати після перерви через травму',
    ],
  },
  ice_heat: {
    test: [
      'is ice or heat better for a pulled muscle',
      'should i put something cold on my shoulder',
      'does heat help with muscle stiffness',
    ],
    testUk: [
      'що краще при болю — холод чи грілка',
      'прикласти щось холодне на плече',
      'чи допомагає тепло від скутості м’язів',
    ],
  },
  painkillers: {
    test: [
      'is lifting on ibuprofen a bad idea',
      'should i numb the pain with pills and train',
      'which pain meds are fine for gym people',
    ],
    testUk: [
      'чи нормально качатися під ібупрофеном',
      'заглушити біль таблеткою і тренуватися',
      'які знеболювальні можна тим, хто тренується',
    ],
  },
  tendon: {
    test: [
      'what should i do about a painful tendon',
      'elbow tendon hurts when i do pull-ups',
      'is rest good for tendinitis',
    ],
    testUk: [
      'що робити з болем у сухожиллі',
      'на підтягуваннях болить сухожилля в лікті',
      'при тендиніті краще відпочити',
    ],
  },
  cramps: {
    test: [
      'keep getting leg cramps at the gym',
      'what do i do when a muscle seizes up mid set',
      'cramps every leg day, why',
    ],
    testUk: [
      'постійно зводить ноги в залі',
      'що робити, коли м’яз зводить посеред підходу',
      'чому кожне тренування ніг судоми',
    ],
  },
  numbness: {
    test: [
      'fingers tingle when i hold the bar',
      'leg goes numb during deadlifts',
      'should i worry about pins and needles in my hand',
    ],
    testUk: [
      'поколюють пальці, коли тримаю гриф',
      'нога німіє на становій',
      'чи страшно, що мурашки в руці',
    ],
  },
  calories: {
    test: [
      'how much energy should i be eating a day',
      'what calorie number should i aim for',
      'figure out how many calories i burn',
    ],
    testUk: [
      'скільки ккал мені потрібно при моїй вазі',
      'яку кількість калорій мені ставити ціллю',
      'скільки я маю з’їдати калорій щодня',
    ],
  },
  cut_deficit: {
    test: [
      'what calorie deficit is sensible',
      'how quickly can i drop fat safely',
      'is losing 2 kg a week too fast',
    ],
    testUk: [
      'який дефіцит калорій розумний',
      'як швидко можна безпечно скидати жир',
      'мінус 2 кг на тиждень це не забагато',
    ],
  },
  bulk_surplus: {
    test: [
      'how much extra should i eat to gain muscle',
      "what's the right weight gain rate for bulking",
      'does dirty bulking build more muscle',
    ],
    testUk: [
      'скільки їсти зверху, щоб набирати м’язи',
      'який нормальний темп набору ваги',
      'на брудному наборі м’язів більше',
    ],
  },
  carbs: {
    test: [
      "what's a good daily carb target",
      'do i need carbs to build muscle',
      'is cutting out bread and rice a good idea',
    ],
    testUk: [
      'яка норма вуглеводів для того, хто качається',
      'чи потрібні вуглеводи для росту м’язів',
      'відмовитися від хліба й рису — хороша ідея',
    ],
  },
  fats: {
    test: [
      "what's the right amount of fat in my diet",
      'should i supplement omega 3',
      'which fats are good for me',
    ],
    testUk: [
      'яка нормальна кількість жирів у раціоні',
      'чи додавати омегу як добавку',
      'які жири мені їсти',
    ],
  },
  pre_meal: {
    test: [
      "what's a good meal before lifting weights",
      'should i have a snack before my session',
      'timing of food before training',
    ],
    testUk: [
      'яка їжа найкраща перед силовим',
      'чи перекусити перед тренуванням',
      'коли краще їсти до тренування',
    ],
  },
  post_meal: {
    test: [
      "what's a good recovery meal",
      'do i have to eat right after lifting',
      'best thing to eat once i finish training',
    ],
    testUk: [
      'яка їжа найкраща для відновлення після залу',
      'чи обов’язково їсти одразу після тренування',
      'що краще з’їсти, як закінчив тренуватися',
    ],
  },
  meals_count: {
    test: [
      "what's the ideal number of meals per day",
      'is eating twice a day bad for gains',
      'do i have to eat six times daily',
    ],
    testUk: [
      'яка ідеальна кількість прийомів їжі',
      'їсти двічі на день погано для м’язів',
      'чи обов’язково їсти шість разів на день',
    ],
  },
  vegan: {
    test: [
      'is it possible to get strong on a plant diet',
      'what should a vegetarian lifter eat',
      'no meat, how do i build muscle',
    ],
    testUk: [
      'чи реально стати сильним на рослинному харчуванні',
      'що їсти вегетаріанцю, який тренується',
      'без м’яса як набрати м’язи',
    ],
  },
  cheat_meal: {
    test: [
      'went overboard on pizza last night',
      'do cheat meals ruin a cut',
      'i ate junk all weekend, what now',
    ],
    testUk: ['учора переїв піци', 'читміли зіпсують сушку', 'усі вихідні їв фастфуд, що тепер'],
  },
  sugar: {
    test: [
      'will eating candy stop my progress',
      'is it fine to have a dessert every day',
      'do i need to go sugar free to get lean',
    ],
    testUk: [
      'цукерки зупинять мій прогрес',
      'чи нормально щодня їсти десерт',
      'треба зовсім без цукру, щоб підсушитися',
    ],
  },
  late_eating: {
    test: [
      'will a late dinner ruin my cut',
      'is it ok to eat at 11 pm',
      'bedtime snack good or bad',
    ],
    testUk: [
      'пізня вечеря зіпсує сушку',
      'чи можна поїсти об 11 вечора',
      'перекус перед сном — добре чи погано',
    ],
  },
  electrolytes: {
    test: [
      'is it worth drinking electrolytes in the gym',
      'should i salt my water on hot days',
      'do lifters need extra magnesium',
    ],
    testUk: [
      'чи варто пити електроліти в залі',
      'солити воду в спекотні дні',
      'чи треба додатковий магній тим, хто тренується',
    ],
  },
  fiber: {
    test: [
      'are vegetables important for lifters',
      "what's a good daily fiber target",
      'how do i get more fibre in my diet',
    ],
    testUk: [
      'чи важливі овочі для тих, хто качається',
      'яка денна ціль по клітковині',
      'як додати більше клітковини в раціон',
    ],
  },
  whats_up: {
    test: ['yo, anything happening', "what's new atlas", "sup, what's going on"],
    testUk: ['ну що там нового', 'як життя молоде', 'шо там у тебе чувати'],
  },
  good_night: {
    test: ['alright, bed time, good night', "i'm heading off to sleep", 'nighty night'],
    testUk: ['все, лягаю, на добраніч', 'піду посплю, добраніч', 'спокійної ночі, атлас'],
  },
  tired: {
    test: [
      'i have no energy at all today',
      'feeling totally worn out',
      'so tired i can barely move',
    ],
    testUk: [
      'взагалі немає сил сьогодні',
      'почуваюся геть виснаженим',
      'така втома, що ледве рухаюсь',
    ],
  },
  bored: {
    test: ["ugh i'm so bored right now", 'the gym is boring me', 'boredom is killing me'],
    testUk: ['ох, як мені нудно', 'зал набрид, нудьга', 'нудьга мене вбиває'],
  },
  challenge: {
    test: [
      'got a challenge for me',
      'come on, challenge me this week',
      'what should my next challenge be',
    ],
    testUk: [
      'є для мене якийсь виклик',
      'давай челендж на цей тиждень',
      'який наступний челендж мені взяти',
    ],
  },
  fun_fact: {
    test: [
      'hit me with a random fact',
      'know any cool facts',
      'tell me something neat about training',
    ],
    testUk: [
      'кинь якийсь цікавий факт',
      'знаєш якісь цікаві факти',
      'розкажи щось цікаве про тренування',
    ],
  },
  quote: {
    test: ['drop a quote for me', 'got any wise words', 'something inspiring please'],
    testUk: ['скинь якусь цитату', 'маєш мудрі слова для мене', 'щось надихаюче, будь ласка'],
  },
  laugh: {
    test: ['haha that got me', 'lmaooo', 'lol nice one'],
    testUk: ['ахахах', 'хаха, прикольно', 'ржака'],
  },
  mood_down: {
    test: [
      'today has been really hard for me',
      "i'm not doing well emotionally",
      'feeling kind of hopeless',
    ],
    testUk: ['сьогодні на душі дуже важко', 'мені емоційно погано', 'якось усе безнадійно'],
  },
  mood_up: {
    test: ["i'm in such a good mood", 'today feels amazing', 'feeling on fire today'],
    testUk: ['у мене такий гарний настрій', 'сьогодні просто чудово', 'почуваюся на всі сто'],
  },
  lets_go: {
    test: ["alright let's do it", "let's goooo", 'ok go go go'],
    testUk: ['ну все, поїхали', 'погналиии', 'давай, вперед'],
  },
  nothing: {
    test: ['eh, nothing', 'forget i said anything', 'no reason really'],
    testUk: ['та нічого, забий', 'забудь, що я писав', 'та просто так'],
  },
  rival_ai: {
    test: [
      'is gpt smarter than you',
      'chatgpt gave me a different plan',
      'why should i use you instead of gemini',
    ],
    testUk: ['гпт розумніший чи ти', 'chatgpt дав мені інший план', 'навіщо ти, якщо є gemini'],
  },
  atlas_age: {
    test: ['so how old are you actually', "what's atlas's age", 'how many years old are you'],
    testUk: [
      'а скільки тобі насправді років',
      'скільки років тобі, атласе',
      'ти взагалі давно існуєш',
    ],
  },
  atlas_sleep: {
    test: ['do bots like you ever sleep', 'are you awake 24/7', "don't you need to rest"],
    testUk: ['а боти взагалі сплять', 'ти не спиш цілодобово', 'тобі не треба відпочивати'],
  },
  atlas_eat: {
    test: ["so what's on your menu", 'does atlas ever get hungry', 'what food do you like'],
    testUk: ['а що в тебе в меню', 'атлас буває голодний', 'яку їжу ти любиш'],
  },
  sing_poem: {
    test: ['can you make up a little song', 'rap for me', 'give me a poem about deadlifts'],
    testUk: ['склади пісеньку', 'зачитай мені реп', 'вірш про станову'],
  },
  clock: {
    test: ['hey, what time is it', 'do you have the time', "what's the clock say"],
    testUk: ['слухай, котра година', 'а скільки зараз часу', 'скажи, котра година'],
  },
  which_day: {
    test: ['remind me what the date is', 'what weekday is it', "what's today"],
    testUk: ['нагадай, яке сьогодні число', 'який сьогодні день тижня', 'а яке зараз число'],
  },
  you_dumb: {
    test: [
      "that's not the answer to my question",
      "you clearly didn't get what i said",
      'useless reply',
    ],
    testUk: [
      'це не відповідь на моє питання',
      'ти явно не зрозумів, що я написав',
      'безглузда відповідь',
    ],
  },
};
