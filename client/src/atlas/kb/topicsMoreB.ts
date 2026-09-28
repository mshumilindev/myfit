import type { MoreTopic } from './topicsMore';

/** Diet phases, cardio, mobility, kit, gym life, special groups, mindset, measuring, symptoms (part 2 of 2). */
export const MORE_B: MoreTopic[] = [
  // ---- diet phases ----
  {
    id: 'k_reverse_diet',
    ask: ['What is reverse dieting after a cut?', 'Що таке реверсивна дієта після сушки?'],
    answer: [
      'Reverse dieting means raising calories gradually after a diet instead of jumping straight back to your old eating. You can add roughly 100–200 kcal a week, or go straight to your new maintenance if you’re mentally done with dieting — both work; the slow way mainly helps you control appetite and limit fat regain. Expect 1–2 kg back on the scale from food and water in your gut and muscles; that’s not fat.',
      'Реверсивна дієта — це поступове підвищення калорій після дієти замість різкого повернення до старого харчування. Можна додавати приблизно 100–200 ккал на тиждень або одразу перейти на нову підтримку, якщо морально вже втомився від дієти — обидва способи працюють; повільний здебільшого допомагає контролювати апетит і менше набрати жиру. Очікуй плюс 1–2 кг на вагах через їжу та воду в кишечнику й м’язах — це не жир.',
    ],
    more: [
      [
        'Your new maintenance is a bit lower than before the diet because you weigh less; find it by watching your weekly average weight for 2–3 weeks.',
        'Нова підтримка трохи нижча, ніж до дієти, бо ти важиш менше; знайди її, спостерігаючи середню вагу за тиждень протягом двох-трьох тижнів.',
      ],
    ],
    facets: {},
    chips: ['calories', 'k_diet_break', 'k_scale_fluctuations'],
  },
  {
    id: 'k_diet_break',
    ask: [
      'Should I take a diet break or a refeed during a cut?',
      'Чи робити перерву в дієті або рефід на сушці?',
    ],
    answer: [
      'On longer cuts it’s a good idea. A diet break is 1–2 weeks of eating at maintenance every 6–12 weeks of dieting; a refeed is one or two higher-carb days a week. They don’t magically “reset your metabolism”, but they ease hunger, bring back energy for training and make the diet easier to stick with. The whole cut just takes a bit longer — that’s the trade.',
      'На довгій сушці — хороша ідея. Перерва в дієті — 1–2 тижні харчування на рівні підтримки кожні 6–12 тижнів дієти; рефід — один-два дні на тиждень з більшою кількістю вуглеводів. Вони не «перезавантажують метаболізм» чарівним чином, але зменшують голод, повертають сили на тренуваннях і допомагають витримати дієту. Уся сушка просто триває трохи довше — така ціна.',
    ],
    more: [
      [
        'Keep protein the same on break days and add the extra calories mostly as carbs.',
        'У дні перерви білок лишай тим самим, а додаткові калорії додавай переважно вуглеводами.',
      ],
    ],
    facets: {},
    chips: ['cut_deficit', 'k_reverse_diet', 'k_mini_cut'],
  },
  {
    id: 'k_scale_fluctuations',
    ask: ['Why does my weight jump up and down every day?', 'Чому моя вага щодня скаче?'],
    answer: [
      'Daily swings of 0.5–2 kg are normal and are mostly water: salt, carbs, a big meal, hard training, stress, poor sleep, the menstrual cycle and what’s still in your gut all shift it. Weigh yourself in the morning after the toilet and before food, and look at the weekly average rather than any single day. If the weekly average moves the way you want over 2–3 weeks, you’re on track.',
      'Щоденні коливання на 0,5–2 кг — норма, і це переважно вода: сіль, вуглеводи, велика вечеря, важке тренування, стрес, поганий сон, менструальний цикл і вміст кишечника — все це її зсуває. Зважуйся зранку після туалету, до їжі, і дивись на середнє за тиждень, а не на окремий день. Якщо середня вага за 2–3 тижні рухається в потрібному напрямку — все йде як слід.',
    ],
    more: [
      [
        'After starting a new program or creatine the scale often goes up 1–2 kg from water in the muscles — that’s a good sign, not fat.',
        'Після нової програми чи початку креатину вага часто росте на 1–2 кг через воду в м’язах — це хороший знак, а не жир.',
      ],
    ],
    facets: {},
    chips: ['bw_trend', 'k_body_fat', 'k_recomp'],
  },
  {
    id: 'k_keto',
    ask: ['Is keto good for lifting?', 'Чи підходить кето для силових тренувань?'],
    answer: [
      'You can build strength and some muscle on keto, but it’s no advantage for lifting. Carbs fuel hard sets, so most people feel flatter in higher-rep, high-volume work, especially in the first 2–4 weeks. Keto can work for fat loss if it helps you eat less, but so does any diet you can stick to — keep protein high either way.',
      'На кето можна набирати силу і трохи м’язів, але для силових це не перевага. Вуглеводи — паливо для важких підходів, тож більшість людей почуваються «пласкими» в багатоповторній та об’ємній роботі, особливо перші 2–4 тижні. Для схуднення кето спрацює, якщо допомагає їсти менше, але так само працює будь-яка дієта, яку можеш витримати, — білок у будь-якому разі тримай високим.',
    ],
    more: [
      [
        'If you try it, add salt and fluids from the start — the “keto flu” is largely lost sodium and water.',
        'Якщо пробуєш — одразу додавай сіль і рідину: «кето-грип» здебільшого через втрату натрію й води.',
      ],
    ],
    facets: {},
    chips: ['carbs', 'fat_loss', 'k_intermittent_fasting'],
  },
  {
    id: 'k_intermittent_fasting',
    ask: [
      'Is intermittent fasting good for building muscle?',
      'Чи підходить інтервальне голодування для набору м’язів?',
    ],
    answer: [
      'Intermittent fasting (like 16:8) is simply a way to fit your calories into a shorter window. For fat loss it works as well as other diets when calories and protein are the same. For building muscle it’s slightly less ideal, because fitting enough protein into 2–3 meals is harder — if you use it, have at least two solid protein meals and try to train close to your eating window.',
      'Інтервальне голодування (наприклад, 16:8) — це просто спосіб вмістити калорії в коротше вікно. Для схуднення воно працює не гірше за інші дієти, якщо калорії й білок однакові. Для набору м’язів воно трохи менш ідеальне, бо вмістити достатньо білка у 2–3 прийоми їжі складніше — якщо практикуєш, май принаймні два добрі білкові прийоми їжі й тренуйся ближче до свого вікна харчування.',
    ],
    more: [
      [
        'Training fasted in the morning is fine for most people; eat a protein-rich meal soon after.',
        'Тренування натщесерце зранку для більшості нормальні; після нього скоро з’їж щось білкове.',
      ],
    ],
    facets: {},
    chips: ['fasted', 'meals_count', 'k_keto'],
  },
  {
    id: 'k_teen_supplements',
    ask: [
      'Should a teenager take protein or creatine?',
      'Чи варто підлітку приймати протеїн або креатин?',
    ],
    answer: [
      'For teens, food comes first: regular meals with protein (meat, fish, eggs, dairy, beans), enough total calories, fruit, vegetables and sleep drive growth far more than any product. Protein powder is just food and is fine for filling gaps. Creatine looks safe in the studies we have, but most experts suggest under-18s use it only with a parent and a doctor involved; avoid pre-workouts, fat burners and “test boosters” completely.',
      'Для підлітків спершу їжа: регулярні прийоми з білком (м’ясо, риба, яйця, молочне, бобові), достатньо калорій, фрукти, овочі та сон дають ріст значно більше, ніж будь-які добавки. Протеїн — просто їжа, ним можна закривати прогалини. Креатин, судячи з наявних досліджень, безпечний, але більшість фахівців радять до 18 років приймати його лише за участі батьків і лікаря; передтренувальні комплекси, жироспалювачі й «бустери тестостерону» — повністю уникати.',
    ],
    more: [
      [
        'The biggest gains for a teen come from learning good technique with light-to-moderate weights and training consistently for years.',
        'Найбільше підлітку дає вивчення доброї техніки з легкими й помірними вагами та регулярні тренування роками.',
      ],
    ],
    facets: {},
    chips: ['k_teen_lifting', 'protein', 'supplements'],
  },

  // ---- cardio ----
  {
    id: 'k_vo2max',
    ask: ['How do I improve my VO2max?', 'Як покращити VO2max?'],
    answer: [
      'VO2max is the most oxygen your body can use — one of the strongest predictors of long-term health. Build a base of easy zone 2 work (2–3 sessions of 30–60 minutes a week), then add one session of hard intervals, like 4 × 4 minutes at about 85–95% of your max heart rate with 3 easy minutes between them. It improves within weeks in untrained people and keeps improving with consistency.',
      'VO2max — це максимум кисню, який тіло може використати, один із найсильніших показників довгострокового здоров’я. Спершу база легкої роботи в зоні 2 (2–3 сесії по 30–60 хвилин на тиждень), потім додай одну сесію важких інтервалів, наприклад 4 × 4 хвилини приблизно на 85–95% максимального пульсу з 3 легкими хвилинами між ними. У нетренованих людей він росте вже за кілька тижнів і продовжує рости за регулярності.',
    ],
    more: [
      [
        'Do the hard intervals on a bike, rower or incline treadmill if running beats up your legs before squat day.',
        'Роби важкі інтервали на велосипеді, гребному тренажері чи похилій доріжці, якщо біг перед днем присідань надто б’є по ногах.',
      ],
    ],
    facets: {},
    chips: ['hr_zones', 'hiit', 'cardio_gains'],
  },
  {
    id: 'k_incline_walk',
    ask: [
      'Is incline treadmill walking good cardio?',
      'Чи хороше кардіо — ходьба на доріжці під нахилом?',
    ],
    answer: [
      'Yes — walking on an incline (like the popular 12% incline at 5 km/h for 30 minutes) raises your heart rate into a good zone 2 range with very little impact, so it barely interferes with leg training. It’s a great option for supporting fat loss and heart health. Don’t hold the handrails — it cuts the work a lot; lower the incline instead, and build up gradually if your calves or shins get sore.',
      'Так — ходьба під нахилом (як-от популярний варіант: нахил 12%, 5 км/год, 30 хвилин) виводить пульс у хорошу зону 2 з дуже малим ударним навантаженням, тож майже не заважає тренуванням ніг. Це чудовий варіант для підтримки схуднення і здоров’я серця. Не тримайся за поручні — це сильно зменшує роботу; краще зменш нахил і нарощуй поступово, якщо болять литки чи гомілки.',
    ],
    more: [
      [
        'The stair climber works similarly and is a bit harder; both fit well after a lifting session or on rest days.',
        'Степер працює схоже й трохи важчий; обидва добре підходять після силового або в дні відпочинку.',
      ],
    ],
    facets: {},
    chips: ['hr_zones', 'steps', 'k_cardio_order'],
  },
  {
    id: 'k_rowing_machine',
    ask: [
      'How do I use the rowing machine properly?',
      'Як правильно гребти на гребному тренажері?',
    ],
    answer: [
      'The order is legs, back, arms on the drive, and arms, back, legs on the way back. Push hard with your legs first (about 60% of the power), then lean back slightly and pull the handle to your lower ribs; return by straightening your arms, hinging forward, and only then bending your knees. Keep the damper around 3–5 — higher isn’t more useful — and aim for about 20–30 strokes per minute for steady work.',
      'Порядок: ноги, спина, руки — у тязі, і руки, спина, ноги — при поверненні. Спершу потужно відштовхнись ногами (близько 60% сили), потім трохи відхились корпусом і тягни ручку до нижніх ребер; повертайся, випрямивши руки, нахилившись уперед, і лише тоді згинай коліна. Тримай демпфер приблизно на 3–5 — вищий не робить тренування кориснішим — і для рівномірної роботи роби близько 20–30 гребків на хвилину.',
    ],
    more: [
      [
        'Rowing is a great low-impact, full-body option for intervals, like 8 × 250 m hard with a minute easy between them.',
        'Веслування — чудовий неударний варіант для всього тіла під інтервали, наприклад 8 × 250 м інтенсивно з хвилиною легко між ними.',
      ],
    ],
    facets: {},
    chips: ['hiit', 'k_vo2max', 'cardio'],
  },
  {
    id: 'k_jump_rope',
    ask: ['Is jumping rope good cardio?', 'Чи хороше кардіо — скакалка?'],
    answer: [
      'Yes — skipping is cheap, portable and great for conditioning, coordination and springy calves and ankles (useful for running and jumping). It’s high-impact, so build up: start with 10–20 rounds of 30 seconds on and 30 seconds off, jumping low on the balls of your feet and turning the rope with your wrists. Use a firm surface with a little give and good shoes, and back off if your shins or Achilles get sore.',
      'Так — скакалка дешева, завжди з собою і чудова для витривалості, координації та пружності литок і гомілкостопів (корисно для бігу й стрибків). Це ударне навантаження, тож нарощуй поступово: почни з 10–20 раундів по 30 секунд роботи й 30 секунд відпочинку, стрибай невисоко на передній частині стопи, обертаючи скакалку зап’ястями. Обирай тверду поверхню з невеликою амортизацією і добре взуття, а якщо заболять гомілки чи ахілл — зменш навантаження.',
    ],
    more: [
      [
        'Ten minutes of rope makes a great warm-up or finisher; the length is right when the handles reach your armpits while you stand on the middle.',
        'Десять хвилин зі скакалкою — чудова розминка або фінішер; довжина правильна, коли ручки дістають до пахв, якщо стати на середину скакалки.',
      ],
    ],
    facets: {},
    chips: ['hiit', 'travel', 'k_calisthenics'],
  },

  // ---- mobility ----
  {
    id: 'k_thoracic',
    ask: [
      'How do I improve upper-back (thoracic) mobility?',
      'Як покращити рухливість грудного відділу?',
    ],
    answer: [
      'A stiff upper back limits overhead pressing, front squats and posture. Two or three simple drills before training work well: extensions over a foam roller (a few spots between the shoulder blades), open-book rotations lying on your side and thread-the-needle rotations on all fours, 8–10 slow reps each. Then use that range under load — strict overhead presses and rows help you keep it.',
      'Скутий грудний відділ обмежує жими над головою, фронтальні присідання й поставу. Перед тренуванням добре працюють дві-три прості вправи: розгинання на ролику (кілька точок між лопатками), «відкрита книга» лежачи на боці та скручування «нитка в голку» стоячи на четвереньках, по 8–10 повільних повторів. А потім використовуй цю амплітуду під навантаженням — суворі жими над головою та тяги допомагають її зберегти.',
    ],
    more: [
      [
        'If raising your arms overhead pinches the shoulder, check with a physio rather than forcing the range.',
        'Якщо при підйомі рук над головою защемлює плече — порадься з фізіотерапевтом, а не форсуй амплітуду.',
      ],
    ],
    facets: {},
    chips: ['posture', 'k_ohp_lean', 'k_shoulder_warmup'],
  },
  {
    id: 'k_hip_flexors',
    ask: ['How do I fix tight hip flexors?', 'Що робити із затиснутими згиначами стегна?'],
    answer: [
      'Hip flexors often feel tight from long sitting, but that feeling doesn’t always mean they’re short. A half-kneeling stretch with the back leg’s glute squeezed and the pelvis tucked (30–60 seconds, 2–3 times per side) usually helps, and so does strengthening the hip flexors and glutes with lunges and hanging knee raises. Break up long sitting every 30–60 minutes — that matters more than any stretch.',
      'Згиначі стегна часто здаються затиснутими через довге сидіння, але це відчуття не завжди означає, що вони вкорочені. Зазвичай допомагає розтяжка в напівстійці на коліні з напруженою сідницею задньої ноги й підкрученим тазом (30–60 секунд, 2–3 рази на кожен бік), а також зміцнення згиначів і сідниць — випади, підйоми колін у висі. Переривай довге сидіння кожні 30–60 хвилин — це важить більше за будь-яку розтяжку.',
    ],
    more: [
      [
        'If the front of your hip pinches in deep squats, try a slightly wider stance with the toes turned out, and get it checked if it doesn’t ease.',
        'Якщо в глибокому присіді защемлює спереду стегна, спробуй трохи ширшу постановку з розвернутими носками, а якщо не минає — покажися спеціалісту.',
      ],
    ],
    facets: {},
    chips: ['mobility', 'posture', 'k_hamstring_flex'],
  },
  {
    id: 'k_hamstring_flex',
    ask: [
      'My hamstrings are tight and I can’t touch my toes — what helps?',
      'Затиснуті задні м’язи стегна, не дістаю до пальців ніг — що допоможе?',
    ],
    answer: [
      'Regular stretching works: 2–4 sets of 30–60 seconds on most days increases your range within weeks, mostly because your nervous system gets used to the stretch. Loaded stretching works just as well — Romanian deadlifts and good mornings through a full range build flexibility and strength together. Tight hamstrings usually aren’t the cause of back pain, and you don’t need to touch your toes to lift well.',
      'Регулярна розтяжка працює: 2–4 підходи по 30–60 секунд більшість днів збільшують амплітуду вже за кілька тижнів — переважно тому, що нервова система звикає до розтягнення. Розтяжка з вагою працює не гірше — румунська тяга й гуд морнінг на повну амплітуду розвивають гнучкість і силу водночас. Затиснуті задні м’язи стегна зазвичай не є причиною болю в спині, а щоб добре тренуватися, не обов’язково діставати до пальців.',
    ],
    more: [
      [
        'Stretch after training or in the evening; a few gentle reps in the warm-up are fine, but long holds right before heavy lifting can slightly reduce strength.',
        'Розтягуйся після тренування чи ввечері; кілька легких повторів у розминці — нормально, а довгі утримання прямо перед важкою роботою можуть трохи знизити силу.',
      ],
    ],
    facets: {},
    chips: ['k_rdl', 'stretch_before', 'mobility'],
  },
  {
    id: 'k_shoulder_warmup',
    ask: ['How should I warm up my shoulders before pressing?', 'Як розім’яти плечі перед жимом?'],
    answer: [
      'Five minutes is enough: arm circles and band pull-aparts (2 × 15), band pass-throughs or wall slides (1 × 10), external rotations with a light band (1 × 15 per side), then scapular push-ups (1 × 10). After that, do your pressing warm-up sets with the empty bar and gradually heavier loads. The goal is to feel warm and move freely, not to tire out the small muscles.',
      'П’яти хвилин достатньо: кола руками й розведення резинки (2 × 15), «викрути» з резинкою або ковзання руками по стіні (1 × 10), зовнішня ротація з легкою резинкою (1 × 15 на кожну руку), потім віджимання лопатками (1 × 10). Після цього — розминочні підходи жиму з пустим грифом і поступово важчою вагою. Мета — зігрітися й вільно рухатися, а не втомити дрібні м’язи.',
    ],
    more: [
      [
        'If a shoulder feels cranky, add an extra light set or two of the press itself rather than more stretching.',
        'Якщо плече «вередує», краще додай один-два легкі підходи самого жиму, ніж більше розтяжки.',
      ],
    ],
    facets: {},
    chips: ['warmup_sets', 'k_rotator_cuff', 'k_face_pull'],
  },
  {
    id: 'k_wrist_mobility',
    ask: [
      'My wrists hurt on bench or front squats — what can I do?',
      'Болять зап’ястя на жимі або фронтальних присіданнях — що робити?',
    ],
    answer: [
      'When pressing, keep the bar low in your palm over the forearm bones rather than letting the wrist bend back — squeeze hard and think “knuckles to the ceiling”. Wrist wraps help on heavy sets. In front squats it’s usually tight lats and triceps, not the wrists: use a wider grip, fewer fingers on the bar or straps as handles. Daily wrist circles and gentle loaded stretches help; sharp or lasting pain deserves a check.',
      'У жимі тримай гриф низько в долоні над кістками передпліччя, а не дозволяй зап’ястю загинатися назад — міцно стискай гриф і думай «кісточки пальців до стелі». На важких підходах допомагають бинти на зап’ястя. У фронтальному присіді зазвичай винні затиснуті широчайші й трицепси, а не зап’ястя: ширший хват, менше пальців на грифі або лямки як ручки. Щоденні обертання зап’ястями й легка розтяжка з навантаженням допомагають; гострий або тривалий біль варто показати лікарю.',
    ],
    more: [
      [
        'Push-ups on your fists or on dumbbells keep the wrist straight if the floor position hurts.',
        'Віджимання на кулаках або гантелях тримають зап’ястя рівним, якщо на підлозі болить.',
      ],
    ],
    facets: {},
    chips: ['k_sleeves_wraps', 'k_front_squat', 'pain'],
  },
  {
    id: 'k_yoga',
    ask: ['Is yoga good for lifters?', 'Чи корисна йога для тих, хто тягає залізо?'],
    answer: [
      'Yes — yoga adds mobility, body awareness, breathing control and a calm way to recover, and 1–2 classes a week fit easily around lifting. Gentle or restorative styles work as active recovery; hot or power yoga is a real training load, so don’t put it right before a heavy leg or pressing day. It won’t replace strength training for building muscle or bone.',
      'Так — йога додає рухливості, відчуття тіла, контролю дихання і спокійного відновлення, а 1–2 заняття на тиждень легко вписати в силові. М’які чи відновлювальні стилі працюють як активне відновлення; гаряча чи силова йога — це справжнє навантаження, тож не став її прямо перед важким днем ніг чи жимів. Силових для росту м’язів і кісток вона не замінить.',
    ],
    more: [
      [
        'If you log yoga as an activity, I count it in your weekly load and recovery.',
        'Якщо записуєш йогу як активність, я враховую її в тижневому навантаженні й відновленні.',
      ],
    ],
    facets: {},
    chips: ['mobility', 'rest_day', 'app_activity'],
  },
  {
    id: 'k_pilates',
    ask: ['Is Pilates good alongside lifting?', 'Чи корисний пілатес разом із силовими?'],
    answer: [
      'Pilates is good for core control, posture, mobility and rehab-style strength, and it pairs well with lifting — 1–2 sessions a week make a nice addition. It usually doesn’t load muscles and bones heavily enough to replace progressive strength training for size, strength or bone density. Reformer classes are harder than mat classes, so treat them as a light-to-moderate training day.',
      'Пілатес добре розвиває контроль корпусу, поставу, рухливість і «реабілітаційну» силу та гарно поєднується із залізом — 1–2 заняття на тиждень будуть приємним доповненням. Зазвичай він не навантажує м’язи й кістки настільки, щоб замінити прогресивні силові для об’єму, сили чи щільності кісток. Заняття на реформері важчі за заняття на килимку, тож вважай їх легким або помірним тренувальним днем.',
    ],
    more: [
      [
        'After pregnancy or with back problems, a qualified Pilates instructor can be a great bridge back to lifting.',
        'Після вагітності чи з проблемами спини кваліфікований інструктор пілатесу може стати чудовим містком назад до силових.',
      ],
    ],
    facets: {},
    chips: ['k_core_stability', 'k_postpartum', 'k_yoga'],
  },

  // ---- kit ----
  {
    id: 'k_gloves',
    ask: ['Should I wear gym gloves?', 'Чи варто тренуватися в рукавичках?'],
    answer: [
      'You don’t need them. Gloves make the handle thicker, which can make gripping harder, and they don’t really prevent calluses — holding the bar correctly does. If you like them for comfort or hygiene, that’s fine. For heavy pulling, chalk and straps are more useful; for rough hands, file calluses down and moisturise.',
      'Вони не потрібні. Рукавички роблять ручку товщою, через що хват може бути важчим, і насправді не рятують від мозолів — рятує правильний хват грифа. Якщо тобі в них комфортніше чи гігієнічніше — будь ласка. Для важких тяг корисніші магнезія й лямки; якщо руки грубі — підпилюй мозолі й зволожуй шкіру.',
    ],
    more: [
      [
        'Hold the bar low in the fingers, near where they join the palm, not in the middle of the palm — the skin folds less and tears less.',
        'Тримай гриф низько на пальцях, біля основи, а не посеред долоні — шкіра менше збирається в складки й рідше рветься.',
      ],
    ],
    facets: {},
    chips: ['k_chalk', 'belt_straps', 'grip'],
  },
  {
    id: 'k_bar_weight',
    ask: ['How much does the barbell weigh?', 'Скільки важить гриф штанги?'],
    answer: [
      'A standard Olympic barbell weighs 20 kg (about 45 lb) and is 2.2 m long; the women’s Olympic bar is 15 kg. Technique bars can be 5–10 kg, EZ curl bars usually 7–10 kg, and the fixed barbells on racks are marked with their total. Smith machine bars vary a lot — often they’re counterbalanced — so check the label or ask the staff, and count it the same way every time.',
      'Стандартний олімпійський гриф важить 20 кг і має довжину 2,2 м; жіночий олімпійський — 15 кг. Технічні грифи бувають по 5–10 кг, EZ-грифи зазвичай 7–10 кг, а на готових штангах у стійках указана загальна вага. Гриф у Сміті дуже різний — часто він має противагу, — тож глянь на наклейку чи спитай у персоналу і рахуй вагу завжди однаково.',
    ],
    more: [
      [
        'Collars weigh little (spring clips almost nothing, competition collars 2.5 kg each) — use them on every working set.',
        'Замки важать мало (пружинні майже нічого, змагальні — по 2,5 кг) — став їх на кожен робочий підхід.',
      ],
    ],
    facets: {},
    chips: ['plate_math', 'k_smith_machine', 'app_units'],
  },
  {
    id: 'k_weight_vest',
    ask: [
      'Is training with a weighted vest worth it?',
      'Чи варто тренуватися з обважнювальним жилетом?',
    ],
    answer: [
      'A weighted vest is a simple way to progress bodyweight moves — push-ups, pull-ups, dips, lunges, step-ups — and to make walking or hiking more demanding. Start at about 5–10% of your bodyweight, wear it snug, and add weight in small steps. Skip running and jumping in it unless you’re well used to impact, and be careful if you have neck or back problems.',
      'Жилет — простий спосіб прогресувати у вправах з власною вагою — віджиманнях, підтягуваннях, брусах, випадах, зашагуваннях — і зробити ходьбу чи походи важчими. Почни приблизно з 5–10% від своєї ваги, одягай щільно і додавай вагу маленькими кроками. Не бігай і не стрибай у ньому, якщо не звик до ударного навантаження, і будь обережним, якщо є проблеми із шиєю чи спиною.',
    ],
    more: [
      [
        'For older adults, a vest on walks and stairs is a nice way to load the bones safely.',
        'Для людей старшого віку жилет під час прогулянок і ходьби сходами — гарний спосіб безпечно навантажити кістки.',
      ],
    ],
    facets: {},
    chips: ['k_calisthenics', 'home_equipment', 'k_osteoporosis'],
  },

  // ---- gym life ----
  {
    id: 'k_spotting_others',
    ask: [
      'How do I spot someone on the bench press?',
      'Як правильно страхувати когось на жимі лежачи?',
    ],
    answer: [
      'Ask first: how many reps, whether they want a hand-off and when to help (“only if the bar stops”). Stand close behind their head with your feet planted and your hands in an alternating grip just under the bar, and follow it down and up without touching. If the bar stalls, help with just enough force to keep it moving and guide it back to the hooks. For squats, stand behind with your arms under their armpits — or better, use the safety pins.',
      'Спершу домовся: скільки повторів, чи потрібна допомога зі зняттям і коли допомагати («лише якщо гриф зупиниться»). Стань близько за головою, стопи впевнено на підлозі, руки різнохватом одразу під грифом, і супроводжуй його вниз і вгору, не торкаючись. Якщо гриф зупинився — допомагай рівно настільки, щоб він рухався далі, і доведи його до стійок. У присіданнях стій позаду з руками під пахвами атлета — а краще використовуй страхувальні упори.',
    ],
    more: [
      [
        'A spotter shouldn’t touch the bar on a good rep — a helped rep is a failed rep, and that’s the end of the set.',
        'Страхувальник не має торкатися грифа на вдалому повторі — повтор із допомогою означає невдалий повтор, і на цьому підхід закінчено.',
      ],
    ],
    facets: {},
    chips: ['bench_alone', 'k_bail_squat', 'k_etiquette'],
  },
  {
    id: 'k_busy_gym',
    ask: [
      'The gym is packed and my equipment is taken — what do I do?',
      'Зал переповнений і потрібний тренажер зайнятий — що робити?',
    ],
    answer: [
      'Ask to work in — alternating sets with someone is normal gym etiquette. Otherwise switch to a similar exercise for the same muscle: dumbbells instead of a barbell, a different machine, or change the order and come back later. Supersets of two exercises next to each other save space and time. If it’s always busy, try training at quieter hours — early morning, midday or late evening.',
      'Спитай, чи можна працювати по черзі — чергувати підходи з кимось у залі це нормальний етикет. Інакше заміни вправу на схожу на той самий м’яз: гантелі замість штанги, інший тренажер, або зміни порядок і повернись пізніше. Суперсети з двох вправ поруч економлять місце й час. Якщо в залі завжди людно — спробуй тренуватися в тихіші години: рано вранці, в обід або пізно ввечері.',
    ],
    more: [
      [
        'Ask me for an alternative to the exercise — for example “alternative to leg press” — and I’ll suggest one.',
        'Спитай мене про заміну вправи — наприклад, «чим замінити жим ногами» — і я підкажу.',
      ],
    ],
    facets: {},
    chips: ['alternatives', 'superset', 'k_etiquette'],
  },
  {
    id: 'k_gym_bag',
    ask: ['What should I bring to the gym?', 'Що брати з собою в зал?'],
    answer: [
      'The basics: a water bottle, a small towel, flat-soled or lifting shoes, a lock for the locker, headphones and your phone to log sets. Useful extras as you progress: chalk, lifting straps, a belt, wrist wraps or knee sleeves, a resistance band for warm-ups, and a snack or shake for afterwards. Keep it simple — a bag you actually pack beats the perfect kit.',
      'Основне: пляшка води, невеликий рушник, взуття з пласкою підошвою або штангетки, замок для шафки, навушники й телефон, щоб записувати підходи. Корисне згодом: магнезія, лямки, пояс, бинти на зап’ястя чи наколінники, резинка для розминки і перекус або шейк на потім. Не ускладнюй — сумка, яку ти реально збираєш, краща за ідеальний набір.',
    ],
    more: [
      [
        'Flip-flops for the shower and a spare shirt make early-morning or after-work sessions much easier.',
        'Шльопанці для душу й запасна футболка дуже полегшують ранкові тренування чи тренування після роботи.',
      ],
    ],
    facets: {},
    chips: ['shoes', 'k_chalk', 'belt_straps'],
  },
  {
    id: 'k_film_form',
    ask: ['How do I film myself to check my form?', 'Як знімати себе, щоб перевірити техніку?'],
    answer: [
      'Set the phone at about hip height, 2–4 metres away. For squats and deadlifts, film from the side at a slight angle so you can see the bar path, back angle and depth; for the bench, from the side near your feet or from behind your head. Film a working set, not just the warm-up, and watch it in slow motion. Ask first if other people will be in the shot.',
      'Постав телефон приблизно на рівні таза, за 2–4 метри. Для присідань і станової знімай збоку під невеликим кутом, щоб бачити траєкторію грифа, нахил спини й глибину; для жиму — збоку біля ніг або з-за голови. Знімай робочий підхід, а не лише розминку, і дивись у сповільненому режимі. Якщо в кадрі будуть інші люди — спершу спитай дозволу.',
    ],
    more: [
      [
        'Compare the video with a few good reference lifts — fixing one thing at a time is easier than fixing five.',
        'Порівняй відео з кількома хорошими прикладами — виправляти одну річ за раз легше, ніж п’ять одразу.',
      ],
    ],
    facets: {},
    chips: ['technique', 'k_etiquette', 'k_personal_trainer'],
  },
  {
    id: 'k_calisthenics',
    ask: [
      'How do I progress with bodyweight exercises?',
      'Як прогресувати у вправах з власною вагою?',
    ],
    answer: [
      'Make each exercise harder in steps instead of just adding reps forever: push-ups, then feet elevated, then archer push-ups; rows under a table, then feet elevated; squats, then split squats, Bulgarian split squats and pistols. Work in the 5–20 rep range close to failure, slow down the lowering, add pauses, and use a backpack, bands or a vest when a move gets easy. That builds muscle just as well as weights.',
      'Ускладнюй кожну вправу сходинками, а не лише додавай повтори безкінечно: віджимання, потім ноги на підвищенні, потім «лучник»; тяга під столом, потім ноги на підвищенні; присідання, потім спліт-присід, болгарські випади й «пістолетик». Працюй у діапазоні 5–20 повторів близько до відмови, сповільнюй опускання, додавай паузи, а коли вправа стає легкою — рюкзак, резинку чи жилет. Так м’язи ростуть не гірше, ніж із залізом.',
    ],
    more: [
      [
        'A pull-up bar in a doorway is the single best investment for training at home — it covers the back and biceps, which are hard to hit otherwise.',
        'Турнік у дверному отворі — найкраща інвестиція для домашніх тренувань: він закриває спину й біцепс, які інакше важко навантажити.',
      ],
    ],
    facets: {},
    chips: ['home', 'k_pistol_squat', 'k_pushup_progression'],
  },

  // ---- women and older lifters ----
  {
    id: 'k_menopause',
    ask: ['How should I train during menopause?', 'Як тренуватися в менопаузі?'],
    answer: [
      'Strength training becomes more important, not less: falling oestrogen speeds up the loss of muscle and bone, and lifting is one of the best tools against both. Aim for 2–3 full-body sessions a week with gradually heavier loads, some impact like brisk walking, stairs or small jumps if your joints tolerate it, and enough protein (around 1.2–1.6 g per kg). Sleep problems and hot flushes can affect recovery — go easier on bad days, and talk to your doctor about symptoms and bone density.',
      'Силові стають важливішими, а не навпаки: падіння естрогену пришвидшує втрату м’язів і кісткової тканини, а залізо — один із найкращих засобів проти обох. Орієнтуйся на 2–3 тренування на все тіло на тиждень з поступово важчою вагою, трохи ударного навантаження — швидка ходьба, сходи чи невеликі стрибки, якщо суглоби дозволяють, — і достатньо білка (приблизно 1,2–1,6 г на кг). Проблеми зі сном і припливи можуть впливати на відновлення — на поганих днях зменшуй навантаження, а про симптоми й щільність кісток поговори з лікарем.',
    ],
    more: [
      [
        'Pelvic-floor symptoms like leaking during lifts are common and treatable — a pelvic-health physio can help.',
        'Симптоми тазового дна, як-от підтікання під час вправ, поширені й піддаються лікуванню — допоможе фізіотерапевт з тазового здоров’я.',
      ],
    ],
    facets: {},
    chips: ['k_osteoporosis', 'k_pelvic_floor', 'k_women_training'],
  },
  {
    id: 'k_postpartum',
    ask: [
      'When can I lift again after giving birth?',
      'Коли можна повернутися до тренувань після пологів?',
    ],
    answer: [
      'Get the go-ahead from your doctor or midwife first — usually around the six-week check, later after a C-section or complications. Start with breathing, pelvic-floor and deep-core work, walking and light bodyweight moves, then build up over several months; a check with a pelvic-health physio is ideal. Signs to back off: leaking, heaviness or dragging in the pelvis, doming of the belly, pain or more bleeding.',
      'Спершу отримай дозвіл від лікаря чи акушерки — зазвичай приблизно на огляді через шість тижнів, після кесаревого чи ускладнень — пізніше. Почни з дихання, вправ для тазового дна й глибоких м’язів корпусу, ходьби й легких вправ з власною вагою, а далі нарощуй протягом кількох місяців; ідеально — огляд у фізіотерапевта з тазового здоров’я. Ознаки, що треба зменшити навантаження: підтікання, відчуття тяжкості чи тиску в тазі, «гребінь» на животі, біль або посилення кровотечі.',
    ],
    more: [
      [
        'Running and jumping usually come back last — often not before about 3 months, and only once the pelvic floor handles lighter impact well.',
        'Біг і стрибки зазвичай повертаються останніми — часто не раніше ніж приблизно через 3 місяці і лише коли тазове дно добре витримує легші удари.',
      ],
    ],
    facets: {},
    chips: ['k_pelvic_floor', 'pregnancy', 'k_core_stability'],
  },
  {
    id: 'k_pelvic_floor',
    ask: [
      'I leak a little when I lift or jump — is that normal?',
      'У мене трохи підтікає під час вправ чи стрибків — це нормально?',
    ],
    answer: [
      'It’s common — especially after pregnancy, in menopause and in heavy lifters — but it isn’t something you just have to live with. A pelvic-health physiotherapist can assess you and give you a plan, and it usually improves a lot. Meanwhile: breathe out on the effort instead of holding your breath hard, go a bit lighter on the moves that trigger it, and empty your bladder before training.',
      'Таке трапляється часто — особливо після вагітності, в менопаузі та в тих, хто піднімає важкі ваги, — але з цим не обов’язково миритися. Фізіотерапевт з тазового здоров’я оцінить стан і дасть план, і зазвичай стає значно краще. А поки що: видихай на зусиллі замість сильної затримки дихання, трохи зменш вагу у вправах, які це викликають, і перед тренуванням спорожнюй сечовий міхур.',
    ],
    more: [
      [
        'Pelvic-floor training isn’t only squeezing — it’s also learning to relax, and to coordinate with your breathing and bracing.',
        'Тренування тазового дна — це не лише стискання, а й уміння розслаблятися та поєднувати його з диханням і напругою корпусу.',
      ],
    ],
    facets: {},
    chips: ['k_postpartum', 'breathing', 'k_menopause'],
  },
  {
    id: 'k_osteoporosis',
    ask: [
      'Is lifting safe with osteoporosis or low bone density?',
      'Чи безпечні силові при остеопорозі або низькій щільності кісток?',
    ],
    answer: [
      'For most people, yes — and supervised, progressive strength and impact training is one of the few things shown to improve bone density. Start with guidance from a physio or doctor, focus on good technique in squats, deadlift variations, presses and rows, and increase the loads gradually. Be careful with loaded forward bending and twisting of the spine (heavy sit-ups, toe touches) and with fall risk; balance work is part of the plan.',
      'Для більшості — так, а прогресивні силові та ударні навантаження під наглядом — одні з небагатьох способів, які доведено покращують щільність кісток. Почни з порад фізіотерапевта чи лікаря, зосередься на правильній техніці присідань, варіантів станової, жимів і тяг і поступово збільшуй вагу. Будь обережним із нахилами вперед і скручуваннями хребта під вагою (важкі скручування на прес, торкання пальців ніг) і з ризиком падінь; вправи на рівновагу — частина плану.',
    ],
    more: [
      [
        'Protein, calcium and vitamin D matter too; your doctor may also discuss medication depending on your fracture risk.',
        'Білок, кальцій і вітамін D теж важливі; лікар може також обговорити ліки залежно від ризику переломів.',
      ],
    ],
    facets: {},
    chips: ['k_older_lifter', 'k_vitamin_d', 'k_menopause'],
  },
  {
    id: 'k_arthritis',
    ask: ['Can I lift weights with arthritis?', 'Чи можна займатися силовими при артрозі?'],
    answer: [
      'Usually yes, and it tends to help: stronger muscles around a joint reduce pain and improve function in knee and hip osteoarthritis. Pick ranges and exercises that feel ok — pain up to about 3–4 out of 10 that settles within 24 hours is generally acceptable. Warm up well, progress slowly and swap exercises that flare the joint; during a flare-up of inflammatory arthritis, ease off and follow your rheumatologist’s advice.',
      'Зазвичай так, і це допомагає: сильніші м’язи навколо суглоба зменшують біль і покращують функцію при артрозі коліна й кульшового суглоба. Обирай амплітуду й вправи, які переносяться нормально — біль приблизно до 3–4 з 10, що минає протягом 24 годин, загалом допустимий. Добре розминайся, прогресуй повільно й замінюй вправи, які загострюють біль; під час загострення запального артриту зменш навантаження і дотримуйся порад ревматолога.',
    ],
    more: [
      [
        'Cycling, swimming and water exercise are joint-friendly cardio options alongside lifting.',
        'Велосипед, плавання та вправи у воді — дружні до суглобів варіанти кардіо на додачу до силових.',
      ],
    ],
    facets: {},
    chips: ['health_conditions', 'k_older_lifter', 'k_joint_supplements'],
  },

  // ---- mindset ----
  {
    id: 'k_habit',
    ask: ['How do I make the gym a habit?', 'Як зробити спортзал звичкою?'],
    answer: [
      'Make it easy and fixed: pick specific days and times, put them in your calendar and pack your bag the night before. Start smaller than you think — two 45-minute sessions a week that you never miss beat five that you quit after a month. Track what you do (every logged session counts), and on low-motivation days commit to just the warm-up; most of the time you’ll finish the session.',
      'Зроби це простим і фіксованим: обери конкретні дні й години, внеси їх у календар і збирай сумку з вечора. Почни з меншого, ніж здається: два тренування по 45 хвилин на тиждень, які ти не пропускаєш, кращі за п’ять, які кинеш через місяць. Записуй, що робиш (кожне записане тренування рахується), а в дні без мотивації пообіцяй собі лише розминку — найчастіше ти доробиш усе тренування.',
    ],
    more: [
      [
        'Tie it to something you already do — straight from work, or right after the school run — so it doesn’t rely on willpower.',
        'Прив’яжи тренування до того, що ти вже й так робиш, — одразу після роботи чи після того, як відвіз дітей, — щоб не покладатися на силу волі.',
      ],
    ],
    facets: {},
    chips: ['motivation', 'streak', 'days_per_week'],
  },
  {
    id: 'k_program_boredom',
    ask: [
      'I’m bored of my workouts — should I change everything?',
      'Мені набридли тренування — змінити все?',
    ],
    answer: [
      'Keep the core, change the details. Boredom is real and it hurts consistency, but switching everything often resets your progress. Keep your main lifts and swap the variations and accessories every 4–8 weeks — a different squat or press variation, new rep ranges, a new challenge like a 5 km time or a pull-up goal. Adding a sport or a class once a week can freshen things up too.',
      'Основу залиш, змінюй деталі. Нудьга — це реально, і вона шкодить регулярності, але повна зміна всього часто обнуляє прогрес. Залиш основні вправи, а варіації й допоміжні вправи міняй кожні 4–8 тижнів — інший варіант присіду чи жиму, нові діапазони повторів, новий виклик на кшталт часу на 5 км чи мети в підтягуваннях. Додати раз на тиждень спорт чи групове заняття теж освіжає.',
    ],
    more: [
      [
        'Set a small target for the next block — a number to beat keeps training interesting.',
        'Постав невелику ціль на наступний блок — цифра, яку треба перевершити, тримає інтерес.',
      ],
    ],
    facets: {},
    chips: ['k_program_hopping', 'motivation', 'k_habit'],
  },
  {
    id: 'k_comparison',
    ask: [
      'I keep comparing myself to others at the gym and online',
      'Я постійно порівнюю себе з іншими в залі та в мережі',
    ],
    answer: [
      'Almost everyone does, and it’s rarely a fair comparison: different genetics, training age, lighting, angles, editing — and sometimes drugs. The only useful comparison is you now versus you a few months ago: your logged lifts, measurements and photos. Mute accounts that make you feel worse, and follow people whose training you can actually learn from.',
      'Так роблять майже всі, і це рідко чесне порівняння: різна генетика, стаж, світло, ракурси, обробка — а інколи й фармакологія. Єдине корисне порівняння — ти зараз проти тебе кілька місяців тому: записані ваги, заміри й фото. Заглуши акаунти, після яких почуваєшся гірше, і підпишись на людей, у яких реально можна чогось навчитися.',
    ],
    more: [
      [
        'Ask me “am I stronger than 3 months ago” — your own numbers are the best antidote.',
        'Спитай мене «чи я сильніший, ніж 3 місяці тому» — твої власні цифри найкращі ліки.',
      ],
    ],
    facets: {},
    chips: ['then_vs_now', 'k_progress_photos', 'gym_anxiety'],
  },
  {
    id: 'k_psych_up',
    ask: [
      'How do I get mentally ready for a heavy lift?',
      'Як психологічно налаштуватися на важкий підхід?',
    ],
    answer: [
      'Build a short routine and use it on every heavy set: the same setup steps, a big breath and brace, and one simple cue like “chest up” or “push the floor”. Picture the rep going up smoothly a few seconds before you walk to the bar. Getting hyped can help a little on a max attempt, but calm focus works better for most sets — save the adrenaline for rare days.',
      'Створи короткий ритуал і використовуй його на кожному важкому підході: однакові кроки налаштування, глибокий вдих і напруга, одна проста підказка на кшталт «груди вгору» чи «відштовхни підлогу». За кілька секунд до підходу уяви, як повтор плавно йде вгору. «Завестися» трохи допомагає на спробі максимуму, але для більшості підходів краще спокій і зосередженість — адреналін бережи на рідкісні дні.',
    ],
    more: [
      [
        'Music, a fixed warm-up order and the same belt and shoe routine all become triggers that tell your body it’s time.',
        'Музика, сталий порядок розминки й однаковий ритуал з поясом і взуттям перетворюються на сигнали, що тілу пора.',
      ],
    ],
    facets: {},
    chips: ['k_fear_heavy', 'k_test_max', 'breathing'],
  },
  {
    id: 'k_fear_heavy',
    ask: [
      'I’m scared of heavy weights — how do I get over it?',
      'Я боюся важких ваг — як це подолати?',
    ],
    answer: [
      'Make failing safe first: set the safety pins or straps in the rack, learn to bail a squat and to lower a bench onto the pins, or use a spotter. Then build confidence gradually — heavy walkouts or holds, singles at 85–90%, and small jumps you know you can make. The fear usually drops quickly once you’ve failed a rep safely and seen that nothing bad happens.',
      'Спершу зроби провал безпечним: встанови страхувальні упори чи ремені в рамі, навчися скидати присід і опускати штангу в жимі на упори або працюй зі страхувальником. Далі нарощуй впевненість поступово — важкі виходи зі стійок або утримання, одиночні на 85–90% і маленькі кроки ваги, які ти точно візьмеш. Страх зазвичай швидко минає, коли ти раз безпечно провалив повтор і побачив, що нічого страшного не сталося.',
    ],
    more: [
      [
        'Film it — heavy reps often look much more controlled than they feel.',
        'Зніми на відео — важкі повтори часто виглядають значно контрольованіше, ніж відчуваються.',
      ],
    ],
    facets: {},
    chips: ['k_bail_squat', 'bench_alone', 'k_psych_up'],
  },
  {
    id: 'k_dance',
    ask: ['I dance — how do I combine it with lifting?', 'Я танцюю — як поєднати це з силовими?'],
    answer: [
      'Dance and lifting go well together: strength work improves jumps, landings, stability and injury resistance, and dance brings mobility and conditioning. Two or three strength sessions a week are plenty — focus on legs and hips (squats, lunges, hinges), calves and ankles, core and upper back. Keep heavy leg work away from intense rehearsals or shows, and in busy dance weeks shorten your lifting rather than skipping it.',
      'Танці й силові добре поєднуються: силова робота покращує стрибки, приземлення, стабільність і захист від травм, а танці додають рухливості та витривалості. Двох-трьох силових тренувань на тиждень достатньо — акцент на ноги й таз (присідання, випади, тяги), литки й гомілкостопи, корпус і верх спини. Важкі ноги став подалі від інтенсивних репетицій чи виступів, а в насичені танцювальні тижні скорочуй силові, а не пропускай.',
    ],
    more: [
      [
        'Tell me after a long dance session — I count it in your load so the next leg day fits.',
        'Розкажи мені після довгого заняття танцями — я врахую це в навантаженні, щоб наступний день ніг вписався.',
      ],
    ],
    facets: {},
    chips: ['other_sport', 'k_plyometrics', 'app_activity'],
  },

  // ---- measuring progress ----
  {
    id: 'k_progress_photos',
    ask: ['How do I take good progress photos?', 'Як правильно робити фото прогресу?'],
    answer: [
      'Consistency is everything: the same place, the same light, the same time of day (morning, before food), the same distance and camera height, and the same clothes. Take front, side and back shots, relaxed and one flexed, every 2–4 weeks. Compare them side by side over months — day-to-day photos mostly show changes in water and lighting.',
      'Головне — однаковість: те саме місце, те саме світло, той самий час (зранку, до їжі), та сама відстань і висота камери, той самий одяг. Фото спереду, збоку й зі спини — розслаблено і одне з напругою — кожні 2–4 тижні. Порівнюй поруч за місяці: фото день у день показують переважно воду й освітлення.',
    ],
    more: [
      [
        'Photos plus a few tape measurements tell you more than the scale alone, especially on a recomp.',
        'Фото разом із кількома замірами стрічкою скажуть більше, ніж самі ваги, особливо при рекомпозиції.',
      ],
    ],
    facets: {},
    chips: ['k_measurements', 'k_recomp', 'k_scale_fluctuations'],
  },
  {
    id: 'k_measurements',
    ask: ['What body measurements should I track?', 'Які заміри тіла варто відстежувати?'],
    answer: [
      'The useful basics: waist at the navel, hips at the widest point, chest, upper arm (relaxed or flexed, but always the same) and mid-thigh. Measure in the morning before eating, with the tape snug but not pressing, and take each measurement twice. Once every 2–4 weeks is enough; the waist is the best simple sign of fat loss, and the arms and thighs of muscle gain.',
      'Корисний мінімум: талія на рівні пупка, стегна в найширшому місці, груди, плече (розслаблене чи напружене — завжди однаково) і середина стегна. Міряй зранку до їжі, стрічку тримай щільно, але не стискаючи, і кожен замір роби двічі. Раз на 2–4 тижні достатньо; талія — найкращий простий показник втрати жиру, а руки й стегна — набору м’язів.',
    ],
    more: [
      [
        'You can keep them in your profile under Body — I use your weight trend when we talk about progress.',
        'Їх можна зберігати в профілі в розділі «Тіло» — я використовую тренд ваги, коли говоримо про прогрес.',
      ],
    ],
    facets: {},
    chips: ['app_bodyweight_log', 'k_progress_photos', 'k_body_fat'],
  },
  {
    id: 'k_body_fat',
    ask: ['How do I measure my body fat percentage?', 'Як виміряти відсоток жиру в тілі?'],
    answer: [
      'Every method is off by a few percent. Home smart scales (bioimpedance) swing with hydration, so only trust their trend; calipers are decent in experienced hands; a DEXA scan is the most detailed but still not perfect. For most people, the waist measurement, photos and how clothes fit are just as useful, and free. As a rough guide, about 10–20% is lean to healthy for men and about 18–30% for women.',
      'У кожного методу похибка в кілька відсотків. Домашні «розумні» ваги (біоімпеданс) скачуть залежно від води, тож дивись лише на тренд; каліпер у досвідчених руках дає непоганий результат; DEXA найдетальніший, але теж не ідеальний. Для більшості людей обхват талії, фото й те, як сидить одяг, не менш корисні й безкоштовні. Орієнтовно: приблизно 10–20% — підтягнуто-здорово для чоловіків і приблизно 18–30% — для жінок.',
    ],
    more: [
      [
        'Measure the same way under the same conditions every time — the direction of change matters more than the exact number.',
        'Міряй щоразу однаково й в однакових умовах — напрямок змін важить більше, ніж точна цифра.',
      ],
    ],
    facets: {},
    chips: ['k_measurements', 'k_recomp', 'k_bmi'],
  },
  {
    id: 'k_bmi',
    ask: ['Is BMI accurate for people who lift?', 'Чи точний ІМТ для тих, хто тренується?'],
    answer: [
      'BMI (weight divided by height squared) is a quick screening tool for large groups, but it can’t tell muscle from fat — so muscular people often land in the “overweight” range while being lean. Your waist (under about half your height is a good sign), body-fat estimates and health markers like blood pressure tell you more. For most people who don’t lift, BMI is still a reasonable rough guide.',
      'ІМТ (вага, поділена на зріст у квадраті) — швидкий скринінговий інструмент для великих груп, але він не відрізняє м’язи від жиру, тож м’язисті люди часто потрапляють у «надмірну вагу», будучи підтягнутими. Обхват талії (менше приблизно половини зросту — добрий знак), оцінка відсотка жиру й показники здоров’я, як-от тиск, кажуть більше. Для більшості людей, які не тренуються, ІМТ залишається непоганим грубим орієнтиром.',
    ],
    more: [
      [
        'If your BMI says overweight but your waist is small and you lift, you’re very likely fine.',
        'Якщо ІМТ показує надмірну вагу, але талія невелика і ти тренуєшся, найімовірніше, все гаразд.',
      ],
    ],
    facets: {},
    chips: ['k_body_fat', 'bodyweight', 'k_measurements'],
  },
  {
    id: 'k_recomp',
    ask: [
      'Can I lose fat and build muscle at the same time?',
      'Чи можна одночасно скидати жир і набирати м’язи?',
    ],
    answer: [
      'Yes — that’s body recomposition, and it works best for beginners, people coming back after a break and those with more body fat. Eat around maintenance or in a small deficit (about 200–300 kcal), keep protein high (1.6–2.2 g per kg), lift with progressive overload and sleep well. The scale may barely move, so track your waist, photos and strength; lean, experienced lifters usually do better with separate bulking and cutting phases.',
      'Так — це рекомпозиція тіла, і найкраще вона працює в новачків, у тих, хто повертається після перерви, і в людей з більшим відсотком жиру. Їж на рівні підтримки або з невеликим дефіцитом (приблизно 200–300 ккал), тримай білок високим (1,6–2,2 г на кг), тренуйся з прогресією навантаження і добре спи. Вага може майже не змінюватися, тож стеж за талією, фото й силою; підтягнутим досвідченим атлетам зазвичай краще чергувати окремі фази набору і сушки.',
    ],
    more: [
      [
        'Skinny-fat? Recomp is usually the right call: lift hard, eat at maintenance with plenty of protein, and give it 3–6 months.',
        'Худий, але з жирком («скінні-фет»)? Рекомпозиція зазвичай правильний вибір: тренуйся важко, їж на рівні підтримки з великою кількістю білка і дай цьому 3–6 місяців.',
      ],
    ],
    facets: {},
    chips: ['protein', 'k_progress_photos', 'cut_deficit'],
  },
  {
    id: 'k_mini_cut',
    ask: ['What is a mini-cut?', 'Що таке міні-сушка?'],
    answer: [
      'A mini-cut is a short, aggressive fat-loss phase — usually 3–6 weeks at a fairly big deficit (around 500–750 kcal, about 0.7–1% of bodyweight a week) — often used in the middle of a long bulk to trim fat before carrying on. Keep protein high and keep lifting heavy to hold on to muscle; trim some volume if recovery suffers. When it ends, go straight back to maintenance or a small surplus.',
      'Міні-сушка — коротка агресивна фаза спалювання жиру, зазвичай 3–6 тижнів з досить великим дефіцитом (приблизно 500–750 ккал, близько 0,7–1% ваги на тиждень), яку часто роблять посеред тривалого набору, щоб прибрати жир перед продовженням. Тримай білок високим і продовжуй тренуватися важко, щоб зберегти м’язи; якщо відновлення страждає — трохи скороти обсяг. Після завершення одразу повертайся на підтримку або невеликий профіцит.',
    ],
    more: [
      [
        'It works because it’s short — hunger and fatigue don’t have time to build up; if you need longer than about 6 weeks, switch to a normal, moderate cut.',
        'Вона працює, бо коротка — голод і втома не встигають накопичитися; якщо потрібно довше приблизно 6 тижнів — переходь на звичайну помірну сушку.',
      ],
    ],
    facets: {},
    chips: ['cut_deficit', 'bulk_surplus', 'k_diet_break'],
  },

  // ---- other activities ----
  {
    id: 'k_climbing',
    ask: ['How do I combine climbing with lifting?', 'Як поєднати скелелазіння з силовими?'],
    answer: [
      'They complement each other well. Climbing hammers the fingers, forearms and pulling muscles, so in the gym focus on what climbing doesn’t train: legs, pressing (push-ups, overhead press, dips), shoulder external rotation and core — two sessions a week is plenty. Keep heavy pulling and grip work away from hard climbing days, because finger tendons recover more slowly than muscles.',
      'Вони добре доповнюють одне одного. Скелелазіння сильно навантажує пальці, передпліччя й тягові м’язи, тож у залі роби акцент на те, чого воно не тренує: ноги, жими (віджимання, жим над головою, бруси), зовнішню ротацію плеча і корпус — двох тренувань на тиждень цілком досить. Важкі тяги й роботу на хват став подалі від важких днів лазіння, бо сухожилля пальців відновлюються повільніше за м’язи.',
    ],
    more: [
      [
        'Work for the opposing muscles, like push-ups and face pulls, helps keep a climber’s shoulders balanced and healthy.',
        'Робота на м’язи-антагоністи, як-от віджимання й тяга канату до обличчя, допомагає тримати плечі скелелаза збалансованими й здоровими.',
      ],
    ],
    facets: {},
    chips: ['other_sport', 'k_face_pull', 'tendon'],
  },

  // ---- anatomy ----
  {
    id: 'k_muscle_fibers',
    ask: [
      'What are fast-twitch and slow-twitch muscle fibres?',
      'Що таке швидкі й повільні м’язові волокна?',
    ],
    answer: [
      'Slow-twitch (type I) fibres resist fatigue and do endurance work; fast-twitch (type II) fibres produce more force and speed and grow more easily. Every muscle has a mix, and your genetics set the ratio — sprinters tend to have more fast-twitch, marathoners more slow-twitch. In practice you don’t need to train the fibre types separately: sets taken close to failure recruit both, whether the weight is heavy or light.',
      'Повільні (тип I) волокна витривалі й працюють у тривалій роботі; швидкі (тип II) дають більше сили й швидкості і легше ростуть. У кожному м’язі є суміш, а співвідношення задає генетика — у спринтерів зазвичай більше швидких, у марафонців — повільних. На практиці тренувати волокна окремо не треба: підходи близько до відмови задіюють обидва типи — хоч з важкою, хоч з легкою вагою.',
    ],
    more: [
      [
        'That’s why a wide rep range (about 5–30) builds muscle as long as the effort is high enough.',
        'Саме тому широкий діапазон повторів (приблизно 5–30) будує м’язи, якщо зусилля достатньо високе.',
      ],
    ],
    facets: {},
    chips: ['reps', 'strength_vs_size', 'failure'],
  },
  {
    id: 'k_rotator_cuff',
    ask: [
      'What is the rotator cuff and should I train it?',
      'Що таке ротаторна манжета і чи треба її тренувати?',
    ],
    answer: [
      'The rotator cuff is four small muscles around the shoulder blade that keep the ball of the shoulder centred in its socket while the big muscles move the arm. Heavy pressing and pulling train it somewhat, but 2 sets of 12–20 light external rotations (band or cable) and face pulls 2–3 times a week are cheap insurance, especially if you bench a lot or play overhead sports. Pain at night or when raising your arm to the side deserves a check.',
      'Ротаторна манжета — це чотири невеликі м’язи навколо лопатки, які тримають голівку плечової кістки по центру суглоба, поки великі м’язи рухають рукою. Важкі жими й тяги частково її тренують, але 2 підходи по 12–20 легких зовнішніх ротацій (з резинкою чи в блоці) і тяга канату до обличчя 2–3 рази на тиждень — дешева страховка, особливо якщо ти багато жмеш або займаєшся видами спорту з рухами над головою. Біль уночі чи при відведенні руки в сторону варто показати лікарю.',
    ],
    more: [
      [
        'Keep these light — the goal is control and endurance, not heavy weights.',
        'Роби це легко — мета в контролі й витривалості, а не у великих вагах.',
      ],
    ],
    facets: {},
    chips: ['k_face_pull', 'k_shoulder_warmup', 'pain'],
  },
  {
    id: 'k_delt_heads',
    ask: ['How do I train all three heads of the shoulders?', 'Як тренувати всі три пучки дельт?'],
    answer: [
      'The front delts get plenty of work from bench and overhead presses — most people don’t need extra front raises. The side delts give the shoulders width: lateral raises (dumbbell, cable or machine) 2–3 times a week. The rear delts respond to rear-delt flyes, face pulls and wide-grip rows. A good weekly target is roughly 8–16 sets for the side and rear delts combined, on top of your pressing.',
      'Передні дельти отримують багато роботи від жиму лежачи й над головою — більшості не потрібні окремі підйоми перед собою. Середні дельти дають ширину плечей: махи в сторони (гантелі, блок чи тренажер) 2–3 рази на тиждень. Задні дельти реагують на розведення в нахилі, тягу канату до обличчя й тяги широким хватом. Хороша тижнева ціль — приблизно 8–16 підходів на середні й задні дельти разом, окрім жимів.',
    ],
    more: [
      [
        'Side and rear delts recover quickly and respond well to higher reps (12–20).',
        'Середні й задні дельти швидко відновлюються і добре відгукуються на більше повторів (12–20).',
      ],
    ],
    facets: {},
    chips: ['k_lateral_raise', 'k_face_pull', 'grow_muscle'],
  },

  // ---- common mistakes ----
  {
    id: 'k_ego_lifting',
    ask: ['What is ego lifting and why is it bad?', 'Що таке его-ліфтинг і чим він поганий?'],
    answer: [
      'Ego lifting is picking weights to impress rather than to train: half reps, bouncing, heavy swinging, or grinding out reps with broken form. It shifts the work away from the target muscle, stalls your progress and raises injury risk. Choose loads you can control through the full range with 1–3 reps left, add weight only when the reps are clean, and let your log — not the plates — show your progress.',
      'Его-ліфтинг — це вибір ваги, щоб вразити, а не щоб тренуватися: половинчасті повтори, відскоки, розгойдування, видавлювання повторів зі зламаною технікою. Робота зміщується з цільового м’яза, прогрес стоїть, а ризик травми росте. Обирай вагу, яку контролюєш на повну амплітуду з 1–3 повторами в запасі, додавай лише коли повтори чисті, і нехай прогрес показує журнал, а не млинці.',
    ],
    more: [
      [
        'A quick check: film a set — if the rep looks different from your warm-ups, the weight is too heavy for now.',
        'Швидка перевірка: зніми підхід — якщо повтор виглядає інакше, ніж на розминці, вага поки що завелика.',
      ],
    ],
    facets: {},
    chips: ['k_film_form', 'add_weight', 'k_partial_reps'],
  },
  {
    id: 'k_skip_legs',
    ask: ['Do I really need to train legs?', 'Чи справді треба тренувати ноги?'],
    answer: [
      'Yes, if you want a balanced, strong, athletic body. Legs are about half your muscle mass: training them builds overall strength, bone density, work capacity and a physique that doesn’t look top-heavy, and it helps in sport and everyday life. If heavy squats aren’t your thing, the leg press, lunges, split squats, hip thrusts and leg curls still do the job — two sessions a week is plenty.',
      'Так, якщо хочеш збалансоване, сильне й атлетичне тіло. Ноги — це приблизно половина м’язової маси: їх тренування будує загальну силу, щільність кісток, витривалість і фігуру без «перекосу» догори, а ще допомагає в спорті й у житті. Якщо важкі присідання не твоє — жим ногами, випади, спліт-присідання, ягідний місток і згинання ніг теж працюють; двох тренувань на тиждень цілком досить.',
    ],
    more: [
      [
        'Leg training doesn’t “release hormones” that grow your arms — but it does make you stronger and more capable everywhere.',
        'Тренування ніг не «викидає гормонів», які ростять руки, — але робить тебе сильнішим і витривалішим у всьому.',
      ],
    ],
    facets: {},
    chips: ['squat_vs_press', 'k_bulgarian_split', 'split_choice'],
  },

  // ---- what the body does ----
  {
    id: 'k_nausea',
    ask: ['Why do I feel sick during hard workouts?', 'Чому мене нудить під час важких тренувань?'],
    answer: [
      'Common causes: training too soon after a big meal or on a completely empty stomach, too little fluid, going from zero to very hard without a warm-up, or very intense leg or conditioning work with short rests. Eat a light meal 1–3 hours before, sip water, build up the intensity and take longer rests on brutal sets. Stop and get help if the nausea comes with chest pain, shortness of breath, fainting or confusion.',
      'Типові причини: тренування надто скоро після великого прийому їжі або повністю на голодний шлунок, мало рідини, різкий старт на високій інтенсивності без розминки чи дуже інтенсивна робота на ноги або кардіо з коротким відпочинком. Легко поїж за 1–3 години до тренування, пий воду потроху, нарощуй інтенсивність поступово і відпочивай довше на жорстких підходах. Зупинись і звернись по допомогу, якщо нудота супроводжується болем у грудях, задишкою, непритомністю чи сплутаністю.',
    ],
    more: [
      [
        'Sitting or lying down for a few minutes with your legs up and breathing slowly usually settles it.',
        'Зазвичай допомагає посидіти чи полежати кілька хвилин з піднятими ногами й повільно подихати.',
      ],
    ],
    facets: {},
    chips: ['pre_meal', 'water', 'k_gassed'],
  },
  {
    id: 'k_shaking',
    ask: ['Why do my muscles shake during a set?', 'Чому м’язи тремтять під час підходу?'],
    answer: [
      'Shaking is normal with new exercises, heavy loads or near failure: your nervous system is still learning to coordinate the muscle fibres, and tired fibres drop in and out. It fades as you get stronger and more practised. If it’s so strong that you lose control of the weight, go lighter; low blood sugar or too much caffeine can also add to it.',
      'Тремтіння — нормально в нових вправах, з важкою вагою чи близько до відмови: нервова система ще вчиться узгоджувати м’язові волокна, а втомлені волокна то вмикаються, то вимикаються. Воно минає, коли стаєш сильнішим і вправнішим. Якщо тремтіння таке сильне, що втрачаєш контроль над вагою, — бери легшу; його також посилюють низький цукор у крові чи забагато кофеїну.',
    ],
    more: [
      [
        'Shaking at rest, or shaking with weakness or numbness, is something to check with a doctor.',
        'Тремтіння у спокої або разом зі слабкістю чи онімінням варто перевірити в лікаря.',
      ],
    ],
    facets: {},
    chips: ['failure', 'caffeine', 'k_eccentrics'],
  },
  {
    id: 'k_joint_clicking',
    ask: [
      'My joints click and pop when I lift — is that bad?',
      'Суглоби клацають і хрустять, коли тренуюся, — це погано?',
    ],
    answer: [
      'Painless clicking or cracking is very common and usually harmless — gas bubbles in the joint fluid or tendons sliding over bone. Knee cracking in particular isn’t linked to arthritis. Worry only if it comes with pain, swelling, locking, the joint giving way or a feeling that something catches — then get it checked and adjust the exercise in the meantime.',
      'Клацання чи хрускіт без болю трапляються дуже часто і зазвичай нешкідливі — це бульбашки газу в суглобовій рідині або сухожилля, що ковзають по кістці. Хрускіт у колінах, зокрема, не пов’язаний з артрозом. Хвилюватися варто лише тоді, коли він супроводжується болем, набряком, блокуванням, підгинанням або відчуттям, що щось «чіпляється», — тоді покажися спеціалісту, а вправу тим часом зміни.',
    ],
    more: [
      [
        'A good warm-up often quiets the noises down during the session.',
        'Хороша розминка часто вгамовує ці звуки вже під час тренування.',
      ],
    ],
    facets: {},
    chips: ['pain', 'warmup', 'k_arthritis'],
  },
  {
    id: 'k_stretch_marks',
    ask: ['Will I get stretch marks from bulking?', 'Чи з’являться розтяжки від набору маси?'],
    answer: [
      'You might — fast growth of muscle or fat stretches the skin faster than it adapts, often on the shoulders, chest, arms and thighs, and genetics decide a lot. Gaining slowly (about 0.5–1 kg a month for most people) lowers the risk. Creams have little evidence behind them; fresh red marks fade to silvery lines over months, and a dermatologist can help if they bother you.',
      'Можуть — швидкий ріст м’язів чи жиру розтягує шкіру швидше, ніж вона адаптується, часто на плечах, грудях, руках і стегнах, а багато вирішує генетика. Повільний набір ваги (приблизно 0,5–1 кг на місяць для більшості) знижує ризик. Докази для кремів слабкі; нові червоні смуги за місяці світлішають до сріблястих, а якщо вони турбують — допоможе дерматолог.',
    ],
    more: [
      [
        'For many lifters they’re a normal sign of growth, not a health problem.',
        'Для багатьох атлетів це нормальний слід росту, а не проблема здоров’я.',
      ],
    ],
    facets: {},
    chips: ['bulk_surplus', 'muscle_gain_rate', 'k_recomp'],
  },
];
