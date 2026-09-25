import type { Facet } from './types';
export const MORE_R1: Record<string, [string, string][]> = {
  best: [
    [
      'Estimated 1RM comes from a formula (Epley/Brzycki-style) applied to your heaviest sets. It’s most accurate for sets of 1–6 reps; a 12-rep set can over- or underestimate your true max by 5–10%.',
      'Розрахунковий 1ПМ береться з формули (на кшталт Еплі чи Бжицкі) за твоїми найважчими підходами. Найточніше він працює для підходів на 1–6 повторень; з підходу на 12 похибка може сягати 5–10% в будь-який бік.',
    ],
    [
      'Don’t compare records across different variations: a paused bench, a close-grip bench and a touch-and-go bench are different lifts. Also, a record set with sloppy depth or a bounce off the chest doesn’t count as progress.',
      'Не порівнюй рекорди між різними варіантами вправи: жим із паузою, вузьким хватом і звичайний — це різні вправи. І рекорд із недосідом чи відбиванням від грудей — це не прогрес.',
    ],
    [
      'Rep PRs matter as much as weight PRs: 80 kg × 8 after months of 80 kg × 6 is real strength gain. Chase a new record in some rep range every few weeks rather than testing a single every session.',
      'Рекорди в повтореннях важать не менше, ніж у вазі: 80 kg × 8 після місяців 80 kg × 6 — це реальний приріст сили. Краще раз на кілька тижнів ставити рекорд у якомусь діапазоні повторень, ніж щотренування перевіряти максимум.',
    ],
  ],
  progress_lift: [
    [
      'Progress is tracked through estimated 1RM, which blends weight and reps, so 80 × 8 and 85 × 6 can show the same strength. Look at the trend over 4–8 weeks — single sessions bounce around by a few percent.',
      'Прогрес видно за розрахунковим 1ПМ, який враховує і вагу, і повторення, тож 80 × 8 і 85 × 6 можуть означати ту саму силу. Дивись на тенденцію за 4–8 тижнів — окремі тренування коливаються на кілька відсотків.',
    ],
    [
      'A flat line isn’t always a plateau: a week of bad sleep, a deload or a switch to a new variation all dent the numbers. Real stalls are 4+ weeks of no change while everything else is steady.',
      'Рівна лінія — не завжди плато: тиждень поганого сну, розвантаження чи нова варіація вправи теж просаджують цифри. Справжній застій — це 4+ тижні без змін, коли все інше стабільне.',
    ],
    [
      'Beginners can add 2.5 kg a session on big lifts; intermediates are doing well with +1–2% a month. Microplates (0.5–1.25 kg) keep progress going when 2.5 kg jumps are too big.',
      'Новачок може додавати 2,5 kg щотренування на базових вправах; для середнього рівня +1–2% на місяць — уже добрий результат. Малі млинці (0,5–1,25 kg) рятують, коли крок 2,5 kg завеликий.',
    ],
  ],
  volume_muscle: [
    [
      'A “hard set” is one taken within about 0–3 reps of failure; warm-ups and easy sets don’t count. Compound lifts count toward several muscles — a bench set counts for chest and partly for triceps and front delts.',
      '«Робочий підхід» — це підхід, де до відмови лишається 0–3 повторення; розминка й легкі сети не рахуються. Базові вправи йдуть у залік кільком м’язам: жим лежачи — грудям, а частково трицепсу й передній дельті.',
    ],
    [
      'More isn’t always better: jumping from 8 to 20 sets a week usually brings soreness, not growth. Add 2–4 sets per muscle every few weeks and see if performance keeps up.',
      'Більше — не завжди краще: стрибок з 8 до 20 підходів на тиждень зазвичай дає крепатуру, а не ріст. Додавай 2–4 підходи на м’яз раз на кілька тижнів і дивись, чи тримаються результати.',
    ],
    [
      'Split a muscle’s weekly sets over 2 sessions — about 5–8 hard sets per muscle per session is where quality tends to drop off.',
      'Розбивай тижневі підходи на м’яз на 2 тренування: приблизно після 5–8 робочих підходів на м’яз за раз якість помітно падає.',
    ],
  ],
  weak: [
    [
      'A lagging muscle here means fewer hard sets than your other muscle groups or below ~8 a week. It’s about training balance, not how the muscle looks.',
      '«Відстає» тут означає, що на м’яз припадає менше робочих підходів, ніж на інші, або менше ~8 на тиждень. Йдеться про баланс тренувань, а не про зовнішній вигляд.',
    ],
    [
      'Small muscles like forearms or rear delts often get enough indirect work from rows and pulls — check whether the lagging muscle actually matters for your goals before adding sets.',
      'Дрібні м’язи — передпліччя, задня дельта — часто отримують достатньо непрямого навантаження з тяг. Перш ніж додавати підходи, подумай, чи цей м’яз справді важливий для твоєї мети.',
    ],
    [
      'Put the weak muscle first in a session for a few weeks: fresh sets get more effort and better technique.',
      'Кілька тижнів став вправу на слабкий м’яз першою в тренуванні: на свіжу голову й сили підходи виходять якісніші.',
    ],
  ],
  tomorrow: [
    [
      'The suggestion is built from your pattern: what you usually train on that weekday and which muscles are due based on recent volume and rest.',
      'Пропозиція будується з твоїх звичок: що ти зазвичай тренуєш у цей день тижня і які м’язи вже відпочили та недобрали об’єму.',
    ],
    [
      'If you trained the same muscles hard today, give them 48 h — shuffle tomorrow’s session so a fresh group goes first.',
      'Якщо сьогодні ти добре навантажив ті самі м’язи, дай їм 48 годин — переставь завтрашнє тренування так, щоб першою йшла свіжа група.',
    ],
    [
      'Plan tomorrow tonight: pick your first lift and target weight so you walk in knowing the first set.',
      'Сплануй завтра ще звечора: обери першу вправу й робочу вагу, щоб у залі одразу знати перший підхід.',
    ],
  ],
  next_session: [
    [
      'Most muscles recover from a hard session in 48–72 h, so 2–4 sessions a week with a day between leaves room to recover.',
      'Більшість м’язів відновлюється після важкого тренування за 48–72 години, тож 2–4 тренування на тиждень із днем між ними дають досить часу на відновлення.',
    ],
    [
      'Training two days in a row is fine if the sessions hit different muscles; it’s the same muscle hard two days running that costs you.',
      'Тренуватися два дні поспіль нормально, якщо працюють різні м’язи. Шкодить саме важке навантаження на той самий м’яз два дні підряд.',
    ],
    [
      'Fix training days in your calendar like appointments — a set schedule beats waiting until you feel like it.',
      'Внеси тренувальні дні в календар, як зустрічі: чіткий графік працює краще, ніж чекати настрою.',
    ],
  ],
  last_session: [
    [
      'The useful numbers are hard sets and top sets: they tell you whether the session was productive. Total time matters less than how much of it was working sets.',
      'Найкорисніші цифри — робочі та топ-підходи: саме вони показують, чи тренування було продуктивним. Загальний час важить менше, ніж скільки з нього пішло на роботу.',
    ],
    [
      'Compare with the same session a week earlier, not with a different type of day — a leg day and an arm day aren’t comparable.',
      'Порівнюй із таким самим тренуванням тиждень тому, а не з іншим типом дня: день ніг і день рук порівнювати немає сенсу.',
    ],
    [
      'Use last session’s top set to set this one’s target: same weight + 1 rep, or +2.5 kg for the same reps.',
      'Бери топ-підхід минулого тренування за орієнтир: та сама вага +1 повторення або +2,5 kg на ту саму кількість.',
    ],
  ],
  week: [
    [
      'Hard sets per week is the best single measure of training dose; sessions and minutes matter less. Around 10–20 hard sets per muscle group per week is the common productive range.',
      'Кількість робочих підходів за тиждень — найкращий показник навантаження; сесії й хвилини важать менше. Типовий продуктивний діапазон — близько 10–20 робочих підходів на м’язову групу на тиждень.',
    ],
    [
      'One light week isn’t a problem — look at 3–4 week averages. Several light weeks in a row are what stall progress.',
      'Один легкий тиждень — не біда, дивись на середнє за 3–4 тижні. Прогрес гальмують кілька легких тижнів поспіль.',
    ],
    [
      'Pick one weekly check-in time — say Sunday evening — to review the week and plan the next.',
      'Обери один час для тижневого підсумку — наприклад, неділю ввечері — щоб переглянути тиждень і спланувати наступний.',
    ],
  ],
  streak: [
    [
      'A streak counts consecutive days with a logged session. Rest days break a daily streak, so for lifting a weekly count is a fairer measure.',
      'Серія рахує дні поспіль із записаним тренуванням. Дні відпочинку її обривають, тож для силових чесніше дивитися на кількість тренувань на тиждень.',
    ],
    [
      'Don’t train through fatigue or pain just to keep a number alive — muscles grow during rest days.',
      'Не тренуйся через втому чи біль лише заради цифри — м’язи ростуть саме в дні відпочинку.',
    ],
    [
      'Set a weekly target, like 3 sessions, and treat hitting it week after week as your real streak.',
      'Постав тижневу ціль, наприклад 3 тренування, і вважай справжньою серією виконання цієї цілі тиждень за тижнем.',
    ],
  ],
  total: [
    [
      'Only logged sessions count. Anything you did before the app or forgot to record isn’t in the total.',
      'Рахуються лише записані тренування. Те, що було до застосунку або що ти забув записати, сюди не входить.',
    ],
    [
      'The total says you show up; it doesn’t say you progress. Pair it with how your main lifts have moved over the same time.',
      'Загальна кількість показує, що ти ходиш, але не що прогресуєш. Дивись на неї разом зі зміною основних вправ за той самий період.',
    ],
    [
      'Around 100 logged sessions is roughly a year of consistent training — a good point to review progress and rethink your programme.',
      'Близько 100 записаних тренувань — це приблизно рік регулярних занять. Гарний момент, щоб підбити підсумки й переглянути програму.',
    ],
  ],
  plan: [
    [
      'A good programme sets exercises, sets, reps and how to progress: e.g. 3 × 6–10, add weight once you hit the top of the range on every set.',
      'Хороша програма задає вправи, підходи, повторення й правило прогресу: наприклад, 3 × 6–10, і додаєш вагу, коли у всіх підходах вийшов верх діапазону.',
    ],
    [
      'Changing programme every week or two hides whether it works. Run one for at least 6–8 weeks before judging it.',
      'Якщо міняти програму кожні тиждень-два, не зрозумієш, чи вона працює. Дай їй щонайменше 6–8 тижнів, перш ніж оцінювати.',
    ],
    [
      'Keep the main lifts stable and rotate accessories every 4–8 weeks — you keep measuring progress without getting bored.',
      'Тримай основні вправи незмінними, а допоміжні міняй раз на 4–8 тижнів. Так і прогрес видно, і не набридає.',
    ],
  ],
  skip: [
    [
      'Missing one session costs almost nothing — muscle and strength hold for 1–2 weeks without training. The real cost is when one skip becomes a habit.',
      'Один пропуск майже нічого не коштує: сила й маса тримаються 1–2 тижні без тренувань. Проблема — коли пропуск стає звичкою.',
    ],
    [
      'Neck-up rule: a runny nose is fine for a light session; fever, chest congestion or body aches mean rest.',
      'Правило «вище шиї»: з нежитем можна легко потренуватися, а з температурою, кашлем у грудях чи ломотою в тілі — відпочивай.',
    ],
    [
      'On low-energy days, do a “minimum session”: the first two lifts, 2 sets each. Most of the time you’ll end up doing more.',
      'У дні без сил роби «мінімальне тренування»: дві перші вправи по 2 підходи. Найчастіше в процесі розійдешся і зробиш більше.',
    ],
  ],
  cooldown: [
    [
      'A cool-down gradually brings heart rate and breathing down; it doesn’t prevent next-day soreness much, but it helps you feel settled and is a good slot for stretching.',
      'Заминка поступово знижує пульс і дихання. Від крепатури наступного дня вона майже не рятує, але допомагає прийти до тями й це зручний час для розтяжки.',
    ],
    [
      'It’s optional after a normal session — skipping it won’t hurt your gains. After hard intervals or very heavy legs, a few easy minutes help avoid dizziness.',
      'Після звичайного тренування заминка необов’язкова — без неї прогрес не постраждає. А от після важких інтервалів чи ніг кілька легких хвилин допоможуть уникнути запаморочення.',
    ],
    [
      'Use the cool-down for 2–3 slow breaths per stretch and 30–60 s holds on your tightest spots — it doubles as mobility work.',
      'Використовуй заминку для розтяжки: 30–60 секунд на найзатиснутіші місця, спокійне глибоке дихання. Це ще й робота над мобільністю.',
    ],
  ],
  bodyweight: [
    [
      'Daily weight swings 1–2 kg from water, salt, carbs and food in the gut, so single weigh-ins mislead. A 7-day average shows the real trend.',
      'Вага щодня коливається на 1–2 kg через воду, сіль, вуглеводи й вміст кишківника, тож окреме зважування вводить в оману. Реальну тенденцію показує середнє за 7 днів.',
    ],
    [
      'Weigh at the same time — morning, after the toilet, before food and drink. Weighing after dinner or a workout adds noise.',
      'Зважуйся завжди однаково: зранку, після туалету, до їжі й води. Ввечері чи після тренування цифри «гуляють».',
    ],
    [
      'For lean gain aim for about +0.25–0.5% bodyweight a week; for fat loss about −0.5–1% a week keeps most of your strength.',
      'Для якісного набору орієнтуйся на +0,25–0,5% ваги тіла на тиждень; для схуднення −0,5–1% на тиждень дозволяє зберегти більшість сили.',
    ],
  ],
  session_length: [
    [
      'Most of a session’s length is rest: 2–3 min between heavy compound sets, 1–2 min for isolation. 15–20 hard sets with proper rest lands around 60–75 min.',
      'Більшість часу тренування — це відпочинок: 2–3 хвилини між важкими базовими підходами, 1–2 хвилини на ізоляції. 15–20 робочих підходів із нормальним відпочинком — це приблизно 60–75 хвилин.',
    ],
    [
      'Past ~90 min quality usually drops; if you’re regularly there, look at phone breaks and long chats between sets.',
      'Після ~90 хвилин якість зазвичай падає. Якщо ти там регулярно, перевір, скільки часу йде на телефон і розмови між підходами.',
    ],
    [
      'Short on time? Superset opposing muscles and keep rest timed — you can fit a full session into 40–45 min.',
      'Мало часу? Роби суперсети на м’язи-антагоністи й засікай відпочинок — повноцінне тренування вміщується у 40–45 хвилин.',
    ],
  ],
  swap: [
    [
      'A good swap trains the same muscle through a similar movement: barbell bench → dumbbell bench or machine press; back squat → hack squat or leg press.',
      'Добра заміна навантажує той самий м’яз схожим рухом: жим штанги лежачи → жим гантелей або в тренажері; присід зі штангою → гак-присід чи жим ногами.',
    ],
    [
      'Expect a different working weight after a swap — don’t chase your old numbers. Give the new lift 1–2 sessions to find its weight.',
      'Після заміни робоча вага буде іншою — не намагайся одразу вийти на старі цифри. Дай новій вправі 1–2 тренування, щоб знайти свою вагу.',
    ],
    [
      'Swap when equipment is busy or something hurts, but keep your main lifts stable for weeks so progress stays measurable.',
      'Міняй, коли снаряд зайнятий чи щось болить, але основні вправи тримай незмінними тижнями, щоб прогрес було видно.',
    ],
  ],
  temper: [
    [
      'Tone only changes how things are said — the advice and numbers stay the same at every setting.',
      'Тон змінює лише манеру — порада й цифри однакові за будь-якого налаштування.',
    ],
    [
      'If a line feels off, change the setting rather than ignoring the coach — you can switch back any time.',
      'Якщо якась фраза не заходить, краще зміни налаштування, ніж ігнорувати тренера. Повернути назад можна будь-коли.',
    ],
  ],
  muscle_last: [
    [
      'Most muscles are ready for another hard session 48–72 h after training; big lower-body days on the longer end, small muscles like arms and calves sooner.',
      'Більшість м’язів готові до нового важкого тренування через 48–72 години. Великі дні ніг — ближче до верхньої межі, дрібні м’язи на кшталт рук і литок — швидше.',
    ],
    [
      'Gaps over 7 days halve your weekly frequency for that muscle; plan it back in so it gets hit about twice a week.',
      'Перерва понад 7 днів удвічі зменшує частоту тренування м’яза. Поверни його в план, щоб навантажувати приблизно двічі на тиждень.',
    ],
    [
      'Compound lifts hit muscles indirectly too — rows train biceps, presses train triceps — so a muscle can be trained more than the date suggests.',
      'Базові вправи навантажують м’язи й опосередковано: тяги — біцепс, жими — трицепс. Тож м’яз може отримувати більше, ніж видно з дати.',
    ],
  ],
  lift_last: [
    [
      'Your last top set is your best starting point today: same weight, try for one more rep.',
      'Останній топ-підхід — найкраща точка старту сьогодні: та сама вага й спроба зробити на повторення більше.',
    ],
    [
      'After a gap over two weeks, start at ~90% of the last top weight — strength returns quickly, and it lowers injury risk.',
      'Після перерви понад два тижні почни з ~90% від останньої робочої ваги: сила швидко повертається, а ризик травми менший.',
    ],
    [
      'For progress, a lift needs to show up at least once a week, ideally twice.',
      'Щоб вправа прогресувала, вона має бути в плані щонайменше раз на тиждень, в ідеалі двічі.',
    ],
  ],
  lift_count: [
    [
      'Frequency counts sessions, not sets. Twice a week with a few hard sets each beats one marathon session for technique and strength.',
      'Частота — це кількість тренувань, а не підходів. Двічі на тиждень по кілька робочих підходів краще для техніки й сили, ніж одне марафонське тренування.',
    ],
    [
      'Doing a lift every session with no variation in load can grind you down — alternate heavy and lighter days.',
      'Якщо робити вправу щотренування з однаковим навантаженням, можна себе «загнати». Чергуй важкі й легші дні.',
    ],
    [
      'For a lift you want to improve, 2–3 exposures a week is the sweet spot — skill work for strength is like practice.',
      'Для вправи, яку хочеш підтягнути, оптимально 2–3 рази на тиждень: сила — це теж навичка, її треба практикувати.',
    ],
  ],
  e1rm: [
    [
      'The estimate uses formulas like Epley (weight × (1 + reps/30)). It’s accurate within a few percent for sets under ~6 reps; higher-rep sets drift more.',
      'Оцінка рахується за формулами на кшталт Еплі: вага × (1 + повторення/30). Для підходів до ~6 повторень похибка кілька відсотків, для багатоповторних — більша.',
    ],
    [
      'A true 1RM is also a skill: without practice with heavy singles, you may fall a few percent short of the estimate. Muscular-endurance types often overestimate.',
      'Справжній 1ПМ — ще й навичка: без практики важких одиночних можна не дотягнути кілька відсотків до оцінки. У витривалих людей формула частіше завищує.',
    ],
    [
      'Use the estimate to set training weights — e.g. 75–85% for sets of 5–8 — instead of testing maxes regularly.',
      'Використовуй оцінку, щоб задавати робочі ваги — наприклад, 75–85% для підходів по 5–8 — замість регулярно перевіряти максимум.',
    ],
  ],
  tonnage: [
    [
      'Tonnage = weight × reps summed over all sets. It’s a rough measure of work, heavily skewed by leg and deadlift sets.',
      'Тоннаж — це вага × повторення, підсумовані за всі підходи. Це груба міра роботи, яку сильно «роздувають» ноги й станова тяга.',
    ],
    [
      'Higher tonnage doesn’t mean more growth: 10 sets of easy reps can beat 5 hard sets on tonnage and lose on results. Hard sets per muscle is the better driver.',
      'Більший тоннаж не означає більший ріст: 10 легких підходів можуть обігнати 5 важких за тоннажем і програти за результатом. Кращий орієнтир — робочі підходи на м’яз.',
    ],
    [
      'Watch tonnage for sudden jumps — a spike of 30%+ week-on-week often precedes excess fatigue.',
      'Стеж за різкими стрибками тоннажу: зростання на 30%+ за тиждень часто передує перевтомі.',
    ],
  ],
  muscle_frequency: [
    [
      'Muscle protein synthesis stays elevated about 24–48 h after training, so hitting a muscle twice a week uses more of that window than once.',
      'Синтез м’язового білка підвищений приблизно 24–48 годин після тренування, тому дві сесії на м’яз за тиждень використовують це вікно краще, ніж одна.',
    ],
    [
      'Frequency mainly helps split your volume: once weekly volume is equal, 2 vs 3 times a week makes little difference.',
      'Частота здебільшого допомагає розподілити об’єм: за однакового тижневого об’єму різниця між 2 і 3 разами на тиждень невелика.',
    ],
    [
      'Can’t get to the gym often? Full-body sessions give every muscle 2–3 hits a week on just 2–3 days.',
      'Не виходить часто ходити в зал? Фулбаді дає кожному м’язу 2–3 навантаження на тиждень лише за 2–3 тренування.',
    ],
  ],
  days_per_week: [
    [
      'Most results come from total weekly hard sets; 3 days is enough to hit every muscle about twice via full-body or upper/lower.',
      'Результат здебільшого залежить від загальної кількості робочих підходів за тиждень. Трьох днів досить, щоб кожен м’яз отримав навантаження двічі — через фулбаді чи верх/низ.',
    ],
    [
      'Going from 3 to 6 days doesn’t double progress — past ~4 days, returns shrink and recovery becomes the limit.',
      'Перехід із 3 на 6 днів не подвоює прогрес: після ~4 днів віддача падає, і відновлення стає обмеженням.',
    ],
    [
      'Pick the number you can keep for months, even in busy weeks — 3 reliable days beat 5 that turn into 2.',
      'Обери стільки днів, скільки зможеш тримати місяцями навіть у завантажені тижні: 3 стабільні дні кращі за 5, які перетворюються на 2.',
    ],
  ],
  prs_today: [
    [
      'A record counts when a set beats your previous best estimated 1RM or rep count at a weight for that lift.',
      'Рекорд зараховується, коли підхід перевищує твій попередній найкращий розрахунковий 1ПМ або кількість повторень із цією вагою у вправі.',
    ],
    [
      'No record isn’t a bad session — records come maybe every few weeks after the first months. Matching last week’s numbers is still progress.',
      'Без рекорду — не означає погане тренування. Після перших місяців рекорди бувають раз на кілька тижнів, а повторити минулотижневі цифри — теж результат.',
    ],
    [
      'Try for rep PRs on your last set of a lift — the weight is already warmed up and you’re less likely to take a heavy risk.',
      'Штурмуй рекорди в повтореннях в останньому підході вправи: вага вже звична, а ризик менший, ніж із важкою одиночкою.',
    ],
  ],
  overtraining: [
    [
      'True overtraining syndrome is rare and takes months of excessive load; what most people hit is short-term fatigue, which clears with a few easier days.',
      'Справжній синдром перетренованості трапляється рідко й потребує місяців надмірного навантаження. Здебільшого люди стикаються з короткочасною втомою, яка минає за кілька легших днів.',
    ],
    [
      'Red flags: lifts dropping for 2+ weeks, poor sleep, low mood, elevated resting heart rate, nagging joint pain. One bad session isn’t one.',
      'Тривожні ознаки: вправи падають понад 2 тижні, поганий сон, пригнічений настрій, підвищений пульс спокою, постійний біль у суглобах. Одне невдале тренування — не ознака.',
    ],
    [
      'Every 4–8 weeks, take a deload: same exercises, about half the sets, lighter weights. It clears fatigue without losing progress.',
      'Кожні 4–8 тижнів роби розвантажувальний тиждень: ті самі вправи, приблизно вдвічі менше підходів і легші ваги. Втома минає, прогрес лишається.',
    ],
  ],
  train_sore: [
    [
      'Soreness (DOMS) peaks 24–72 h after new or harder work and says little about how much you grew. It fades as your body gets used to the exercises.',
      'Крепатура найсильніша через 24–72 години після нового чи важчого навантаження й майже нічого не каже про ріст. Коли тіло звикає до вправ, вона слабшає.',
    ],
    [
      'If soreness changes your technique or range of motion, go lighter or pick another exercise — compensating is how injuries start.',
      'Якщо через крепатуру змінюється техніка чи амплітуда, зменш вагу або заміни вправу: компенсація — типовий шлях до травми.',
    ],
    [
      'Warm up the sore muscle with light sets — soreness often eases a lot after 5–10 minutes of movement.',
      'Розімни м’яз легкими підходами: часто після 5–10 хвилин руху крепатура помітно відпускає.',
    ],
  ],
  weaker_today: [
    [
      'Strength varies 5–10% day to day with sleep, stress, food and time of day — it’s mostly your nervous system, not lost muscle.',
      'Сила коливається на 5–10% день у день залежно від сну, стресу, їжі й часу доби. Це здебільшого нервова система, а не втрачені м’язи.',
    ],
    [
      'Don’t try to force last week’s numbers — grinding reps on a bad day raises injury risk and adds fatigue for next session.',
      'Не вибивай цифри минулого тижня силою: вимучені повторення в поганий день підвищують ризик травми й тягнуть утому на наступне тренування.',
    ],
    [
      'If you’re weaker for 3+ sessions in a row, look at the pattern — it’s a sign to deload or fix sleep and food, not a one-off.',
      'Якщо слабкість тримається 3+ тренування поспіль — це вже закономірність. Час розвантажитися або налагодити сон і харчування.',
    ],
  ],
  exercises_per_session: [
    [
      'Hard sets per muscle matter more than exercise count: 5 exercises × 3 sets gives 15 sets — about what fits into an hour.',
      'Важить не кількість вправ, а робочі підходи на м’яз: 5 вправ × 3 підходи = 15 підходів, якраз стільки вміщується в годину.',
    ],
    [
      'Too many exercises for one muscle in a session (e.g. 4 chest moves) mostly adds fatigue; 1–2 per muscle per session is enough.',
      'Забагато вправ на один м’яз за тренування (наприклад, 4 на груди) переважно додають утому. Досить 1–2 вправ на м’яз за раз.',
    ],
    [
      'Order: heaviest compound → second compound → 2–3 isolation moves. Put what you want to improve most first.',
      'Порядок: найважча базова → друга базова → 2–3 ізолюючі. Першою став вправу, яку найбільше хочеш підтягнути.',
    ],
  ],
  compound_isolation: [
    [
      'Compounds move several joints (hips + knees in squats, shoulder + elbow in presses), so you use more weight and train more muscle per set.',
      'Базові вправи задіюють кілька суглобів — таз і коліна в присіданні, плече й лікоть у жимі — тож вага більша і працює більше м’язів за підхід.',
    ],
    [
      'Compounds alone can leave gaps — side delts, biceps, hamstrings (knee flexion) and calves often need direct work.',
      'Лише базою не обійтися: середня дельта, біцепс, задня поверхня стегна (згинання коліна) й литки часто потребують окремої роботи.',
    ],
    [
      'Isolation is ideal near failure — machines and cables let you push to the last rep safely, which is harder with a heavy squat.',
      'Ізоляцію зручно доводити майже до відмови: у тренажерах і на блоках можна безпечно дотиснути останнє повторення, чого не скажеш про важкий присід.',
    ],
  ],
  machines_free: [
    [
      'Muscle responds to tension, not to the tool — studies show similar growth from machines and free weights when sets are taken close to failure.',
      'М’яз реагує на напругу, а не на снаряд: дослідження показують схожий ріст і з тренажерами, і з вільною вагою, якщо підходи близькі до відмови.',
    ],
    [
      'Strength is specific: if you want a bigger barbell squat, you need to squat with a barbell — leg press gains only partly carry over.',
      'Сила специфічна: хочеш сильніший присід зі штангою — присідай зі штангою. Приріст у жимі ногами переноситься лише частково.',
    ],
    [
      'A practical split: free-weight compounds first while you’re fresh, machines later when stabilisers are tired.',
      'Практичний підхід: вільні ваги на базових вправах на початку, поки свіжий, тренажери — ближче до кінця, коли м’язи-стабілізатори вже втомлені.',
    ],
  ],
  superset: [
    [
      'Antagonist supersets (e.g. bench + row) don’t hurt performance and can cut session time by about a third; same-muscle supersets fatigue faster and cost reps.',
      'Суперсети на м’язи-антагоністи (наприклад, жим + тяга) не шкодять результату й скорочують тренування приблизно на третину. А суперсети на один м’яз швидше втомлюють і «з’їдають» повторення.',
    ],
    [
      'Crowded gym? Pick pairs near each other — hogging two stations at peak hours rarely works.',
      'Людний зал? Обирай пари вправ, що стоять поруч: займати два снаряди в години пік — рідко вдала ідея.',
    ],
    [
      'Rest ~60–90 s between the two exercises and 1.5–2 min after the pair — each muscle still gets 2–3 min before its next set.',
      'Відпочивай ~60–90 секунд між вправами й 1,5–2 хвилини після пари — кожен м’яз все одно має 2–3 хвилини до свого наступного підходу.',
    ],
  ],
  dropset: [
    [
      'Drop sets add extra hard reps in little time — roughly matching the growth of 2–3 normal sets in a fraction of the time, but with more fatigue.',
      'Дроп-сети додають важкі повторення за короткий час — приблизно як 2–3 звичайні підходи, але значно швидше і з більшою втомою.',
    ],
    [
      'Don’t drop-set every exercise — it piles up fatigue and hurts the next session. One or two per workout is plenty.',
      'Не роби дроп-сети в кожній вправі: втома накопичується й шкодить наступному тренуванню. Одного-двох за тренування досить.',
    ],
    [
      'Set up in advance: pin-loaded machines or pre-arranged dumbbells make the drop take seconds, not a minute of plate changes.',
      'Готуйся заздалегідь: у блочних тренажерах чи з наперед розкладеними гантелями перехід займає секунди, а не хвилину перевішування млинців.',
    ],
  ],
  tempo: [
    [
      'Muscle grows from tension close to failure; tempo only matters within ~0.5–6 s per rep. Very slow reps cut the load so much that the stimulus doesn’t improve.',
      'М’яз росте від напруги близько до відмови, а темп важливий лише в межах ~0,5–6 секунд на повторення. Надто повільні повторення так зменшують вагу, що стимул не кращає.',
    ],
    [
      'Dropping the weight fast and bouncing robs tension and is a common cause of elbow, shoulder and knee pain.',
      'Кидати вагу вниз і відбивати її — значить втрачати напругу. Це часта причина болю в ліктях, плечах і колінах.',
    ],
    [
      'A 1–2 s pause at the bottom of bench or squat builds strength out of the hole and exposes technique leaks.',
      'Пауза 1–2 секунди внизу жиму чи присіду розвиває силу в найслабшій точці й висвітлює помилки техніки.',
    ],
  ],
  warmup_sets: [
    [
      'Warm-up sets raise muscle temperature and rehearse the movement pattern. Reps drop as weight rises so you don’t tire before working sets.',
      'Розминкові підходи прогрівають м’язи й «налаштовують» рух. Що більша вага, то менше повторень — щоб не втомитися до робочих підходів.',
    ],
    [
      'Too many high-rep warm-ups (e.g. 3 × 10 at 60%) cost working-set performance. Also, don’t skip them before heavy singles.',
      'Забагато багатоповторних розминкових (скажімо, 3 × 10 з 60%) забирають сили в робочих підходах. І не пропускай розминку перед важкими одиночними.',
    ],
    [
      'Heavier top sets need more steps: for a near-max single add an extra set at ~90–92% × 1.',
      'Що важчий робочий підхід, то більше кроків: перед майже максимальною одиночкою додай ще підхід на ~90–92% × 1.',
    ],
  ],
  stretch_before: [
    [
      'Static holds under ~30–60 s per muscle barely affect strength; long holds (60 s+) can temporarily reduce force by a few percent.',
      'Статичні утримання до ~30–60 секунд на м’яз майже не впливають на силу. Довгі (60+ секунд) можуть тимчасово знизити її на кілька відсотків.',
    ],
    [
      'If a tight spot blocks your range (e.g. ankles in squats), a short targeted stretch before is fine — follow it with warm-up sets.',
      'Якщо щось затиснуте й обмежує амплітуду (наприклад, гомілкостоп у присіді), коротка точкова розтяжка перед тренуванням — нормально. Потім одразу розминкові підходи.',
    ],
    [
      'Dynamic moves: leg swings, arm circles, bodyweight squats, 5 min total. Then ramp up with the lift itself.',
      'Динаміка: махи ногами, кола руками, присідання з власною вагою — усього 5 хвилин. Далі розминайся самою вправою з поступовою вагою.',
    ],
  ],
  mobility: [
    [
      'Mobility improves mainly through increased stretch tolerance and loading at end ranges — muscles adapt to the lengths you train them at.',
      'Мобільність покращується насамперед через кращу переносимість розтягнення й навантаження в крайніх положеннях: м’язи адаптуються до тієї довжини, в якій їх тренуєш.',
    ],
    [
      'Stretching without strength work gives temporary gains; use the new range under load or it tends to go back.',
      'Розтяжка без силової роботи дає тимчасовий ефект. Нову амплітуду треба закріплювати під навантаженням, інакше вона повертається назад.',
    ],
    [
      'Pick 1–2 limiting spots (hips, ankles, T-spine) and work them 3–5 times a week for a few minutes rather than general stretching.',
      'Обери 1–2 обмеження (таз, гомілкостоп, грудний відділ) і працюй з ними 3–5 разів на тиждень по кілька хвилин, а не розтягуй усе підряд.',
    ],
  ],
  abs_daily: [
    [
      'Abs recover like other muscles; daily high-rep crunches mostly add fatigue. Load them — cable crunches, hanging leg raises, ab wheel.',
      'Прес відновлюється, як і інші м’язи. Щоденні багатоповторні скручування переважно дають утому. Навантажуй його вагою: скручування на блоці, підйоми ніг у висі, ролик.',
    ],
    [
      'Squats and deadlifts train the core but don’t fully replace direct ab work for size.',
      'Присід і станова тренують кор, але для росту преса повністю не замінюють пряму роботу на нього.',
    ],
    [
      'Visible abs usually appear around 10–15% body fat for men and 18–22% for women — nutrition drives that more than any ab routine.',
      'Кубики зазвичай видно при 10–15% жиру в чоловіків і 18–22% у жінок. Тут харчування важить більше, ніж будь-яка програма на прес.',
    ],
  ],
  grip: [
    [
      'Grip often fails before your back does on deadlifts and rows; a mixed or hook grip lets you hold more weight without straps.',
      'На становій і тягах хват часто здається раніше за спину. Різнохват або «замок» дозволяють утримати більшу вагу без лямок.',
    ],
    [
      'Mixed grip long-term can create imbalance and puts the supinated arm’s biceps at risk — switch sides between sets.',
      'Постійний різнохват може створити дисбаланс і ризик для біцепса руки з супінованим хватом. Міняй руки між підходами.',
    ],
    [
      'Finish pull days with 2–3 dead hangs or farmer’s holds to failure — 30–60 s — for 2 sessions a week.',
      'Завершуй тягові дні 2–3 висами чи утриманнями гантелей до відмови по 30–60 секунд — двічі на тиждень.',
    ],
  ],
  belt_straps: [
    [
      'A belt gives your abs something to push against, raising intra-abdominal pressure — it typically adds a few percent to squats and deadlifts.',
      'Пояс дає пресу опору, щоб тиснути, і так підвищує внутрішньочеревний тиск. Зазвичай це додає кілька відсотків до присіду й станової.',
    ],
    [
      'Learn to brace without a belt first; wearing it for everything, or cinching it too tight to breathe, defeats the point.',
      'Спершу навчися тримати кор без поясу. Носити його на все підряд чи затягувати так, що не вдихнути, — втрачає сенс.',
    ],
    [
      'Put the belt on for your top sets only; tighten so you can just slip a flat hand between belt and belly.',
      'Одягай пояс лише на важкі робочі підходи й затягуй так, щоб між ним і животом ледь пролазила долоня.',
    ],
  ],
  breathing: [
    [
      'The Valsalva brace (breath in, hold against closed throat) raises intra-abdominal pressure and stiffens the spine — that’s why you’re stronger with a held breath.',
      'Прийом Вальсальви (вдих і затримка при закритій гортані) підвищує тиск у черевній порожнині й робить хребет жорсткішим. Тому із затримкою дихання ти сильніший.',
    ],
    [
      'Breathing into the chest instead of the belly, or exhaling mid-rep, softens the brace. With high blood pressure, avoid long breath holds — breathe out steadily.',
      'Вдих у груди замість живота чи видих посеред повторення розслабляють кор. Якщо в тебе високий тиск, уникай довгих затримок дихання й видихай плавно.',
    ],
    [
      'On sets of 5+, reset your breath at the top of each rep — one breath per rep keeps the brace fresh.',
      'У підходах на 5+ повторень переводь дихання вгорі кожного разу: один вдих на повторення тримає кор у тонусі.',
    ],
  ],
  squat_form: [
    [
      'Hip crease below the top of the knee is parallel. Deeper squats train glutes and quads harder in the stretched position, which is good for growth.',
      'Паралель — це коли згин стегна опускається нижче верху коліна. Глибший присід сильніше навантажує сідниці й квадрицепси в розтягнутому положенні, а це добре для росту.',
    ],
    [
      'Common mistakes: knees caving in, heels lifting, lower back rounding (“butt wink”) at the bottom. If depth causes rounding, go only as deep as you stay neutral.',
      'Типові помилки: коліна завалюються всередину, п’яти відриваються, поперек округлюється внизу. Якщо на глибині спина округлюється, присідай лише до тієї точки, де вона ще нейтральна.',
    ],
    [
      'Squat shoes or small plates under the heels help if ankle mobility limits depth.',
      'Штангетки або невеликі млинці під п’ятами допоможуть, якщо глибину обмежує рухливість гомілкостопу.',
    ],
  ],
  results_time: [
    [
      'Early strength gains (first 4–8 weeks) are mostly the nervous system learning the lifts; muscle growth becomes the main driver after that.',
      'Перші приростання сили (4–8 тижнів) — здебільшого нервова система, яка вчиться рухам. Далі головним чинником стає ріст м’язів.',
    ],
    [
      'Mirror and scale mislead: water and lighting change daily. Use monthly photos, tape measurements and lift numbers.',
      'Дзеркало й ваги оманливі: вода й освітлення щодня різні. Орієнтуйся на щомісячні фото, заміри сантиметром і цифри у вправах.',
    ],
    [
      'A typical beginner can gain roughly 0.5–1 kg of muscle a month in the first year if training and eating well; it slows after.',
      'Новачок за хорошого тренування й харчування може набирати приблизно 0,5–1 kg м’язів на місяць у перший рік. Далі темп сповільнюється.',
    ],
  ],
  myth_bulky: [
    [
      'Building muscle is slow — even with good training, a beginner adds maybe 0.5–1 kg of muscle a month, and women roughly half that due to lower testosterone.',
      'М’язи ростуть повільно: навіть із хорошим тренуванням новачок набирає приблизно 0,5–1 kg м’язів на місяць, а жінки — десь удвічі менше через нижчий тестостерон.',
    ],
    [
      'Feeling “bulky” early is usually water and pump or fat gained from eating more — it’s about nutrition, not lifting.',
      'Відчуття «розкачаності» на початку — це зазвичай вода, «памп» або жир від надлишку їжі. Справа в харчуванні, а не в штанзі.',
    ],
    [
      'If you want a lean, toned look: lift heavy with 6–15 reps and keep calories around maintenance.',
      'Хочеш підтягнутий вигляд без об’єму — тренуйся з вагою на 6–15 повторень і тримай калорійність приблизно на рівні підтримки.',
    ],
  ],
  cardio_gains: [
    [
      'Interference is small with moderate amounts; it mainly shows with lots of running or high-intensity cardio close to lifting sessions.',
      'Конфлікт невеликий за помірного обсягу кардіо. Помітним він стає при великих об’ємах бігу чи інтенсивного кардіо близько до силових тренувань.',
    ],
    [
      'Cycling and rowing interfere less with leg strength than running. Separate hard cardio and leg day by 6+ hours.',
      'Велосипед і гребля заважають силі ніг менше, ніж біг. Між інтенсивним кардіо й днем ніг лишай 6+ годин.',
    ],
    [
      '2–3 × 20–30 min easy cardio a week boosts work capacity so you recover faster between sets.',
      '2–3 рази на тиждень по 20–30 хвилин легкого кардіо підвищують витривалість, і ти швидше відновлюєшся між підходами.',
    ],
  ],
  alcohol: [
    [
      'Heavier drinking (5+ drinks) cuts muscle protein synthesis by up to ~25–35% for the next day and disrupts deep sleep and hormones.',
      'Велика доза алкоголю (5+ порцій) знижує синтез м’язового білка до ~25–35% на наступну добу й порушує глибокий сон та гормони.',
    ],
    [
      'An occasional drink or two won’t erase progress; it’s regular heavy nights that stall it.',
      'Келих-два зрідка прогрес не зітре. Гальмують його регулярні «важкі» вечори.',
    ],
    [
      'If you drink, have a protein-rich meal first, alternate with water, and keep hard sessions away from the next morning.',
      'Якщо п’єш, спершу поїж щось білкове, чергуй алкоголь із водою й не плануй важке тренування на ранок після.',
    ],
  ],
  water: [
    [
      'A rough guide is ~30–40 ml per kg bodyweight a day, plus about 0.5–1 l per hour of sweaty training. Food provides part of that.',
      'Орієнтир — ~30–40 мл на кілограм ваги на день плюс приблизно 0,5–1 л на годину тренування з потом. Частину води дає їжа.',
    ],
    [
      'Chugging a litre right before training just sends you to the toilet; sip through the day and during the session.',
      'Випити літр перед самим тренуванням — значить весь час бігати в туалет. Пий потроху впродовж дня і під час заняття.',
    ],
    [
      'In heat or long sessions, add salt to a meal or use an electrolyte drink — sodium keeps water where you need it.',
      'У спеку чи на довгих тренуваннях досолюй їжу або пий електроліти: натрій допомагає воді затримуватись там, де треба.',
    ],
  ],
  sleep_better: [
    [
      'Most lifters need 7–9 h; under ~6 h cuts strength, recovery and muscle gain in a deficit noticeably.',
      'Більшості тих, хто тренується, потрібно 7–9 годин сну. Менше ~6 годин помітно знижує силу, відновлення й збереження м’язів на дефіциті.',
    ],
    [
      'Common saboteurs: caffeine after lunch, alcohol (helps you fall asleep, wrecks deep sleep), a big meal right before bed, and weekend catch-ups that shift your rhythm.',
      'Типові шкідники: кава після обіду, алкоголь (присипляє, але руйнує глибокий сон), важка їжа перед сном і відсипання на вихідних, яке збиває ритм.',
    ],
    [
      'Keep the bedroom at about 17–19 °C and get daylight within an hour of waking — both anchor your body clock.',
      'Тримай у спальні близько 17–19 °C і виходь на денне світло протягом години після пробудження — це налаштовує внутрішній годинник.',
    ],
  ],
  time_of_day: [
    [
      'Body temperature and nerve function peak in late afternoon, so strength is often a few percent higher then — but your body adapts to whatever time you usually train.',
      'Температура тіла й робота нервової системи пікові пізно вдень, тож сила тоді часто на кілька відсотків вища. Але організм підлаштовується під час, коли ти зазвичай тренуєшся.',
    ],
    [
      'Morning lifters: warm up longer — joints and spine are stiffer after sleep. Late lifters: finish 2–3 h before bed if it affects sleep.',
      'Якщо тренуєшся зранку — розминайся довше, бо після сну суглоби й хребет «дерев’яні». Якщо ввечері — закінчуй за 2–3 години до сну, якщо тренування заважає заснути.',
    ],
    [
      'Stick to one time slot; switching times often costs a little strength while you readjust.',
      'Тримайся одного часу: часті зміни трохи коштують сили, поки організм перелаштовується.',
    ],
  ],
  fasted: [
    [
      'Fasted lifting mostly hurts performance in longer or high-volume sessions, when glycogen runs lower; short heavy sessions are less affected.',
      'Натщесерце силові страждають переважно на довгих чи об’ємних тренуваннях, коли бракує глікогену. Короткі важкі сесії страждають менше.',
    ],
    [
      'If you train fasted, get 20–40 g of protein soon after, and don’t go fasted into a very long session.',
      'Якщо тренуєшся натщесерце, з’їж 20–40 г білка невдовзі після, і не йди голодним на дуже довге тренування.',
    ],
    [
      'If a full meal feels heavy early morning, try something small — a banana or yoghurt 30–60 min before.',
      'Якщо зранку повноцінно їсти важко, спробуй щось невелике — банан чи йогурт за 30–60 хвилин до тренування.',
    ],
  ],
  caffeine: [
    [
      'Caffeine blocks adenosine, lowering perceived effort; that’s why reps feel easier and you can push a few percent more.',
      'Кофеїн блокує аденозин і знижує відчуття зусилля — тому повторення даються легше і можна витиснути на кілька відсотків більше.',
    ],
    [
      'Tolerance builds with daily heavy use; above ~6 mg/kg side effects (jitters, stomach, heart rate) grow without extra benefit. Safe daily ceiling for most adults is about 400 mg.',
      'При щоденному великому споживанні виникає толерантність. Понад ~6 мг/кг побічні ефекти (тремтіння, шлунок, пульс) зростають без додаткової користі. Безпечна добова межа для більшості дорослих — близько 400 мг.',
    ],
    [
      'Save the bigger dose for heavy days and keep a lower daily intake so it still works when it counts.',
      'Бережи більшу дозу для важких днів, а щодня пий менше — тоді кофеїн працюватиме, коли це справді важливо.',
    ],
  ],
};
export const FACETS_R1: Record<string, Partial<Record<Facet, [string, string]>>> = {
  best: {
    why: [
      'Records show whether your training is actually working — if they stop moving for 4–6 weeks, something in the programme, sleep or food needs changing.',
      'Рекорди показують, чи тренування справді працюють. Якщо вони стоять 4–6 тижнів — треба щось міняти: програму, сон або харчування.',
    ],
    when: [
      'A new record usually lands after a lighter week or a good night’s sleep; expect them often in your first year and every few weeks to months later on.',
      'Нові рекорди зазвичай приходять після легшого тижня чи хорошого сну. У перший рік вони бувають часто, далі — раз на кілька тижнів або місяців.',
    ],
    should: [
      'Test a true max only occasionally, with a spotter or safeties; for everyday tracking, rep records at submaximal weights are safer and just as telling.',
      'Справжній максимум перевіряй лише зрідка, зі страхувальником або стопорами. Для щоденного відстеження рекорди в повтореннях на неграничній вазі безпечніші й не менш показові.',
    ],
  },
  progress_lift: {
    why: [
      'Progress slows because the easy adaptations (technique, nerve drive) come first; after that you’re building actual muscle, which is slower.',
      'Прогрес сповільнюється, бо спершу йдуть легкі адаптації — техніка й нервова система. Далі вже нарощуєш саму м’язову масу, а це повільніше.',
    ],
    when: [
      'Check the trend monthly, not after every session — 4 weeks is the shortest window that tells you something.',
      'Оцінюй тенденцію раз на місяць, а не після кожного тренування: 4 тижні — мінімальний проміжок, з якого щось видно.',
    ],
  },
  volume_muscle: {
    when: [
      'Count over a rolling 7 days; if you’re below range by midweek, add a few sets to the next session that hits that muscle.',
      'Рахуй за останні 7 днів. Якщо в середині тижня бракує підходів — додай кілька на наступному тренуванні для цього м’яза.',
    ],
    what: [
      'Weekly volume is the number of hard sets per muscle in a week — the main driver of muscle growth you control directly.',
      'Тижневий об’єм — це кількість робочих підходів на м’яз за тиждень. Це головний чинник росту, яким ти керуєш напряму.',
    ],
  },
  weak: {
    when: [
      'Re-check weak points every 1–2 weeks; one short week can make a muscle look behind when it isn’t.',
      'Переглядай слабкі місця раз на 1–2 тижні: один короткий тиждень може створити враження відставання, якого насправді нема.',
    ],
    what: [
      'A weak point is a muscle that gets noticeably less direct training than the rest — the one that will limit your balance and progress first.',
      'Слабке місце — це м’яз, який отримує помітно менше прямого навантаження, ніж інші. Саме він першим гальмуватиме баланс і прогрес.',
    ],
  },
  tomorrow: {
    why: [
      'A planned session gets done more often and has fewer junk sets than one made up on the spot.',
      'Сплановане тренування частіше таки відбувається і має менше «порожніх» підходів, ніж придумане на ходу.',
    ],
    should: [
      'If you’re under-slept or sore, keep the plan but trim a set per exercise — skipping the whole day is rarely the better call.',
      'Якщо не виспався чи болять м’язи, лиши план, але прибери по одному підходу з вправи. Пропускати цілий день рідко краще.',
    ],
  },
  next_session: {
    why: [
      'Regular spacing keeps weekly volume steady, and steady volume is what drives progress.',
      'Рівномірні проміжки тримають тижневий об’єм стабільним, а саме стабільність дає прогрес.',
    ],
    should: [
      'If more than 4–5 days have passed, just go — start a touch lighter and pick up where you left off.',
      'Якщо минуло більше 4–5 днів — просто йди. Почни трохи легше й продовжуй з того місця, де зупинився.',
    ],
  },
  last_session: {
    why: [
      'Reviewing the last session tells you what weight to start with today, which avoids guessing and wasted sets.',
      'Огляд минулого тренування підказує, з якої ваги почати сьогодні — без гадання й зайвих підходів.',
    ],
    should: [
      'If the last session felt too easy, add a rep or a small weight jump; if it was a grind, repeat it before adding more.',
      'Якщо минулого разу було надто легко — додай повторення або трохи ваги. Якщо ледве витягнув — повтори те саме, перш ніж ускладнювати.',
    ],
  },
  week: {
    why: [
      'Weekly totals smooth out day-to-day noise, so they show whether you’re really on track.',
      'Тижневі підсумки згладжують щоденні коливання й чесніше показують, чи ти на правильному шляху.',
    ],
    should: [
      'If the week came up short, don’t cram it into one huge session — add a set or two to each of the next few workouts.',
      'Якщо тиждень вийшов слабким, не намагайся надолужити все за одне величезне тренування — краще додай по підходу-два до кількох наступних.',
    ],
    when: [
      'Review the week at a fixed time — say Sunday evening — before planning the next one.',
      'Підбивай підсумки тижня в один і той самий час — наприклад, у неділю ввечері — перед плануванням наступного.',
    ],
  },
  streak: {
    why: [
      'Streaks tap into habit: the longer the chain, the harder it feels to break — handy for the first months.',
      'Серія працює на звичку: чим довший ланцюжок, тим менше хочеться його переривати — це допомагає в перші місяці.',
    ],
    should: [
      'Use a streak for motivation, but a rest day to recover always beats a day kept just for the counter.',
      'Серія — хороша мотивація, але день відпочинку для відновлення завжди важливіший за день заради лічильника.',
    ],
  },
  total: {
    why: [
      'Consistency is the biggest predictor of results, and the total count is the plainest measure of it.',
      'Регулярність — найсильніший предиктор результату, а загальна кількість тренувань — найпростіша її міра.',
    ],
  },
  plan: {
    why: [
      'A written plan makes progressive overload deliberate instead of random, and that’s what drives strength and muscle over months.',
      'Записана програма робить прогресію навантаження свідомою, а не випадковою — саме це дає силу й масу на довгій дистанції.',
    ],
    when: [
      'Review the plan every 6–8 weeks or when lifts stall for a month.',
      'Переглядай програму раз на 6–8 тижнів або коли вправи стоять на місці місяць.',
    ],
    should: [
      'If you train 2–3 days a week, a full-body plan usually fits best; at 4+ days, upper/lower or a split works well.',
      'Якщо тренуєшся 2–3 рази на тиждень, найкраще зазвичай підходить фулбаді; якщо 4+ — верх/низ або спліт.',
    ],
  },
  skip: {
    when: [
      'Skip when you’re sick below the neck, injured, or after 2+ nights of very poor sleep — otherwise go and adjust the load.',
      'Пропускай, якщо хворієш «нижче шиї», травмований або дві ночі поспіль майже не спав. В інших випадках іди й просто зменш навантаження.',
    ],
    how: [
      'If you skip, move the session to the next free day rather than dropping it from the week.',
      'Якщо пропускаєш, перенеси тренування на найближчий вільний день, а не викидай його з тижня.',
    ],
  },
  cooldown: {
    when: [
      'Right after your last working set, before you leave the gym.',
      'Одразу після останнього робочого підходу, поки ти ще в залі.',
    ],
    should: [
      'If you’re short on time, drop it — it’s the least essential part of the session.',
      'Якщо мало часу — пропусти: це найменш важлива частина тренування.',
    ],
  },
  bodyweight: {
    why: [
      'Bodyweight trend tells you whether you’re eating for your goal, which explains a lot about how your lifts move.',
      'Динаміка ваги показує, чи їси ти відповідно до мети, — і це багато пояснює в прогресі вправ.',
    ],
    howMuch: [
      'Weigh 3–7 times a week; more data points make the average trustworthy.',
      'Зважуйся 3–7 разів на тиждень: що більше точок, то надійніше середнє.',
    ],
    should: [
      'Judge the weekly average, not a single reading — act only if the trend stays off target for 2–3 weeks.',
      'Оцінюй середнє за тиждень, а не одне зважування. Щось міняй, лише якщо тенденція 2–3 тижні не відповідає меті.',
    ],
  },
  session_length: {
    why: [
      'Length follows from set count and rest; a fixed time budget keeps sessions focused.',
      'Тривалість — наслідок кількості підходів і відпочинку. Фіксований ліміт часу тримає тренування зібраним.',
    ],
    when: [
      'Stop when your planned hard sets are done or quality clearly drops — not when a timer says so.',
      'Завершуй, коли зроблені заплановані робочі підходи або якість явно падає, а не за таймером.',
    ],
  },
  swap: {
    why: [
      'Swapping keeps the muscle getting its sets when equipment is taken or a movement doesn’t suit you.',
      'Заміна дозволяє м’язу отримати свої підходи, навіть коли снаряд зайнятий або рух тобі не підходить.',
    ],
    when: [
      'Swap when the station is busy, a movement causes pain, or a lift hasn’t progressed for 6+ weeks.',
      'Міняй вправу, коли снаряд зайнятий, рух викликає біль або вправа не прогресує понад 6 тижнів.',
    ],
  },
  temper: {
    why: [
      'Some people train better with a push, others with calm support — the setting lets you pick what keeps you coming back.',
      'Комусь краще тренуватися, коли підганяють, комусь — зі спокійною підтримкою. Налаштування дає обрати те, що мотивує саме тебе.',
    ],
    when: [
      'Any time — the change applies to the next message.',
      'Будь-коли — зміна діє з наступного повідомлення.',
    ],
  },
  muscle_last: {
    why: [
      'Knowing when a muscle was last trained tells you if it’s recovered and whether it’s been neglected.',
      'Коли знаєш, коли м’яз тренувався востаннє, розумієш, чи він відновився і чи не закинутий.',
    ],
    should: [
      'If it’s been 3+ days and the muscle isn’t sore, it’s ready — train it.',
      'Якщо минуло 3+ дні й м’яз не болить — він готовий, тренуй.',
    ],
  },
  lift_last: {
    why: [
      'It shows whether the lift is getting enough frequency to progress.',
      'Це показує, чи достатньо часто ти робиш вправу, щоб у ній прогресувати.',
    ],
    should: [
      'If it’s been a while, do one extra warm-up set to re-groove the technique.',
      'Якщо давно не робив — додай ще один розминковий підхід, щоб відновити техніку.',
    ],
  },
  lift_count: {
    why: [
      'More frequent practice improves technique faster, and better technique means more weight moved.',
      'Часта практика швидше вдосконалює техніку, а краща техніка — це більша вага.',
    ],
    should: [
      'If a lift shows up less than once a week, add it to another session if you care about it.',
      'Якщо вправа трапляється рідше ніж раз на тиждень, а вона тобі важлива, — додай її ще в одне тренування.',
    ],
    when: [
      'Space sessions with the same lift at least 48 h apart, especially heavy squats and deadlifts.',
      'Між тренуваннями з тією самою вправою лишай щонайменше 48 годин, особливо для важких присідань і станової.',
    ],
  },
  e1rm: {
    when: [
      'Test a real max rarely — every few months at most — after a lighter week, with a spotter or safeties.',
      'Справжній максимум перевіряй рідко — щонайбільше раз на кілька місяців, після легшого тижня й зі страхувальником або стопорами.',
    ],
    howMuch: [
      'Estimates are usually within ~5% of a real max when based on sets of 3–6 reps.',
      'Якщо оцінка базується на підходах по 3–6 повторень, вона зазвичай відрізняється від реального максимуму не більше ніж на ~5%.',
    ],
  },
  tonnage: {
    why: [
      'It gives a quick overall picture of training load across weeks.',
      'Він дає швидку загальну картину навантаження по тижнях.',
    ],
    when: [
      'Compare tonnage week to week or month to month for the same type of training, not across very different programmes.',
      'Порівнюй тоннаж тиждень до тижня чи місяць до місяця в межах схожих тренувань, а не між зовсім різними програмами.',
    ],
  },
  muscle_frequency: {
    should: [
      'If a muscle gets trained only once a week, split its sets over two days — same volume, better quality.',
      'Якщо м’яз тренується лише раз на тиждень, розділи його підходи на два дні: об’єм той самий, якість краща.',
    ],
    when: [
      'Leave about 48 h between hard sessions for the same muscle.',
      'Між важкими тренуваннями того самого м’яза лишай приблизно 48 годин.',
    ],
  },
  days_per_week: {
    why: [
      'Muscles need training stimulus and rest to adapt; 3–4 days balances the two for most people.',
      'Щоб адаптуватися, м’язам потрібні і стимул, і відпочинок. 3–4 дні — оптимальний баланс для більшості.',
    ],
    when: [
      'Spread sessions out — e.g. Mon/Wed/Fri — rather than bunching them together.',
      'Розподіляй тренування рівномірно — наприклад, пн/ср/пт — а не збивай їх докупи.',
    ],
  },
  prs_today: {
    why: [
      'Records are proof the training works; checking them keeps motivation up.',
      'Рекорди — доказ, що тренування працюють, і вони добре підтримують мотивацію.',
    ],
    should: [
      'Don’t force a record on a tired day — technique breakdown for one extra rep isn’t worth it.',
      'Не вибивай рекорд у день утоми: одне зайве повторення зі зламаною технікою того не варте.',
    ],
    when: [
      'Records usually come at the start of a training block or after a lighter week, when fatigue is low.',
      'Рекорди зазвичай приходять на початку тренувального циклу або після легшого тижня, коли втоми мало.',
    ],
  },
  overtraining: {
    when: [
      'Suspect it when performance falls for 2+ weeks despite normal sleep and food.',
      'Запідозрюй перевтому, коли результати падають понад 2 тижні, попри нормальний сон і харчування.',
    ],
    howMuch: [
      'For most people, over ~20–25 hard sets per muscle a week is where recovery starts to struggle.',
      'Для більшості людей понад ~20–25 робочих підходів на м’яз на тиждень — межа, де відновлення починає не встигати.',
    ],
  },
  train_sore: {
    howMuch: [
      'Mild soreness: train as normal. Moderate: drop 10–20% of load or a set. Severe: rest that muscle a day or two.',
      'Легка крепатура — тренуйся як завжди. Помірна — зменш вагу на 10–20% або прибери підхід. Сильна — дай м’язу день-два відпочинку.',
    ],
  },
  weaker_today: {
    when: [
      'It usually passes in a session or two; if it lasts more than 1–2 weeks, look deeper.',
      'Зазвичай це минає за тренування-два. Якщо триває понад 1–2 тижні — шукай причину глибше.',
    ],
  },
  exercises_per_session: {
    when: [
      'Add an exercise only when you can recover from the current plan and still have time and energy at the end.',
      'Додавай вправу лише тоді, коли відновлюєшся від поточного плану і наприкінці ще лишаються час і сили.',
    ],
  },
  compound_isolation: {
    how: [
      'Roughly 2/3 of your sets on compounds, 1/3 on isolation — adjust toward isolation for lagging small muscles.',
      'Орієнтовно 2/3 підходів — базові, 1/3 — ізоляція. Якщо відстають дрібні м’язи, зміщуй баланс у бік ізоляції.',
    ],
    howMuch: [
      '2–3 compounds and 2–3 isolation moves per session is a solid template.',
      '2–3 базові і 2–3 ізолюючі вправи за тренування — надійний шаблон.',
    ],
  },
  machines_free: {
    when: [
      'Machines shine late in a session, when training alone without a spotter, or when working around an injury.',
      'Тренажери виграють наприкінці тренування, коли тренуєшся без страхувальника або обходиш травму.',
    ],
    what: [
      'Free weights are barbells, dumbbells and kettlebells you stabilise yourself; machines guide the path for you.',
      'Вільна вага — це штанги, гантелі й гирі, які ти стабілізуєш сам; тренажер задає траєкторію за тебе.',
    ],
  },
  superset: {
    when: [
      'When time is tight, or for arms and accessories at the end of a session.',
      'Коли бракує часу або для рук і допоміжних вправ наприкінці тренування.',
    ],
  },
  dropset: {
    why: [
      'They let you add effective volume fast when time is short.',
      'Вони дозволяють швидко додати ефективний об’єм, коли мало часу.',
    ],
    how: [
      'Hit near failure, reduce the weight 20–30% within ~10 s, repeat to near failure; 1–2 drops.',
      'Дійди майже до відмови, за ~10 секунд зменш вагу на 20–30% і знову майже до відмови. 1–2 зниження.',
    ],
  },
  tempo: {
    when: [
      'Use slower, paused reps when learning a lift or fixing technique; use normal controlled tempo for most work sets.',
      'Повільні повторення з паузою — коли вчиш вправу чи виправляєш техніку. Для більшості робочих підходів — звичайний контрольований темп.',
    ],
    what: [
      'Tempo is how fast you lower, pause and lift each rep, often written like 3-1-1 (seconds down, pause, up).',
      'Темп — це швидкість опускання, пауза й підйом у кожному повторенні. Часто записують як 3-1-1 (секунди вниз, пауза, вгору).',
    ],
  },
  warmup_sets: {
    when: [
      'Before the first heavy lift of each session, and before a new movement pattern (e.g. squats after bench).',
      'Перед першою важкою вправою тренування й перед новим типом руху (наприклад, присідом після жиму).',
    ],
  },
  stretch_before: {
    howMuch: [
      'If you do static stretching before, keep it under 30 s per muscle.',
      'Якщо розтягуєшся статично перед тренуванням, тримай до 30 секунд на м’яз.',
    ],
  },
  mobility: {
    should: [
      'If your range is enough for the lifts you do, extra mobility work is optional.',
      'Якщо амплітуди вистачає для твоїх вправ, додаткова робота над мобільністю необов’язкова.',
    ],
  },
  abs_daily: {
    when: [
      'At the end of a session, so a tired core doesn’t compromise heavy squats or deadlifts.',
      'Наприкінці тренування, щоб утомлений кор не заважав у важких присіданнях і станових.',
    ],
  },
  grip: {
    should: [
      'Use straps only for top sets of heavy pulls; train grip through the rest.',
      'Лямки — лише на важкі робочі підходи в тягах. Решту часу тренуй хват без них.',
    ],
  },
  belt_straps: {
    how: [
      'Breathe in, brace your belly out into the belt, then lift; for straps, wrap around the bar opposite to your thumb direction.',
      'Вдихни, напруж живіт і натисни ним у пояс, потім піднімай. Лямки намотуй на гриф у бік, протилежний великому пальцю.',
    ],
  },
  squat_form: {
    when: [
      'Film a set from the side every few weeks, or whenever the weight jumps.',
      'Знімай підхід збоку раз на кілька тижнів або щоразу, коли вага помітно зростає.',
    ],
  },
  results_time: {
    howMuch: [
      'Expect strength up 20–50% on main lifts in the first 6 months of consistent training.',
      'За перші 6 місяців регулярних тренувань сила в основних вправах зазвичай зростає на 20–50%.',
    ],
  },
  myth_bulky: {
    how: [
      'Size tracks with eating in a surplus; at maintenance or a deficit you get stronger and firmer, not bigger.',
      'Об’єм росте, коли їси з профіцитом. На підтримці чи в дефіциті ти стаєш сильнішим і підтягнутішим, а не більшим.',
    ],
  },
  cardio_gains: {
    howMuch: [
      'Around 2–3 moderate sessions of 20–40 min a week won’t hurt strength or muscle.',
      'Близько 2–3 помірних сесій по 20–40 хвилин на тиждень не шкодять ні силі, ні масі.',
    ],
  },
  alcohol: {
    how: [
      'It hurts gains mainly through worse sleep, dehydration and reduced protein synthesis.',
      'Алкоголь шкодить прогресу насамперед через гірший сон, зневоднення й знижений синтез білка.',
    ],
  },
  water: {
    should: [
      'If you sweat heavily or train in heat, weigh before and after — drink ~1.5 l per kg lost.',
      'Якщо сильно пітнієш або тренуєшся в спеку, зважся до й після тренування: на кожен втрачений кілограм випий ~1,5 л.',
    ],
  },
  sleep_better: {
    why: [
      'Most muscle repair and hormone release happen during deep sleep — short sleep means slower progress.',
      'Більша частина відновлення м’язів і викиду гормонів відбувається в глибокому сні. Мало сну — повільніший прогрес.',
    ],
    howMuch: ['Aim for 7–9 h a night.', 'Цілься в 7–9 годин на ніч.'],
  },
  time_of_day: {
    howMuch: [
      'The difference between morning and evening is usually a few percent — much smaller than the effect of consistency.',
      'Різниця між ранком і вечором зазвичай кілька відсотків — значно менше, ніж ефект регулярності.',
    ],
  },
  fasted: {
    howMuch: [
      'A pre-workout meal of ~20–40 g protein and some carbs, 1–3 h before, covers most needs.',
      'Прийом їжі з ~20–40 г білка та вуглеводами за 1–3 години до тренування закриває більшість потреб.',
    ],
  },
  caffeine: {
    how: [
      'Coffee or a caffeine tablet both work; a strong cup is roughly 80–150 mg.',
      'Підійде і кава, і таблетка кофеїну. Міцна чашка кави — це приблизно 80–150 мг.',
    ],
  },
};
