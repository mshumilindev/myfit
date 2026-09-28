import type { MoreTopic } from './topicsMore';

/** Programming methods, lift variations, recovery, supplements (part 1 of 2). */
export const MORE_A: MoreTopic[] = [
  // ---- programming ----
  {
    id: 'k_amrap',
    ask: ['What is an AMRAP set?', 'Що таке підхід AMRAP?'],
    answer: [
      'AMRAP means “as many reps as possible” with a set weight — usually stopping with 0–1 good reps left, not grinding ugly reps. It’s a handy way to test progress (more reps at the same weight means you got stronger) and to autoregulate: programs like 5/3/1 use a last AMRAP set to set next week’s weights. Keep it to one AMRAP set per lift per session, and skip it on days you feel beaten up.',
      'AMRAP — це «стільки повторів, скільки зможеш» із заданою вагою, зазвичай до 0–1 повтору в запасі, без брудних повторів. Це зручний спосіб перевірити прогрес (більше повторів з тією ж вагою — ти став сильнішим) і регулювати навантаження: програми на кшталт 5/3/1 за останнім AMRAP-підходом визначають ваги на наступний тиждень. Роби один AMRAP на вправу за тренування і пропускай його, коли почуваєшся розбитим.',
    ],
    more: [
      [
        'On heavy compound lifts stop when the bar slows down a lot or form breaks — that’s your AMRAP, even if you could force one more.',
        'На важких базових вправах зупиняйся, коли штанга помітно сповільнюється або ламається техніка — це і є твій AMRAP, навіть якщо ще один можна було б видавити.',
      ],
    ],
    facets: {},
    chips: ['k_531', 'failure', 'k_top_backoff'],
  },
  {
    id: 'k_emom',
    ask: ['What is EMOM training?', 'Що таке тренування EMOM?'],
    answer: [
      'EMOM means “every minute on the minute”: start a set at the top of each minute and rest for whatever time is left. It keeps the pace honest and the session dense — for example 10 minutes of 3 fairly heavy squats, or 12 minutes alternating push-ups and rows. Pick a load you could do for about twice the reps, and if you start missing the minute, cut the reps rather than the rest.',
      'EMOM — «кожну хвилину на початку хвилини»: на початку кожної хвилини робиш підхід, а решту часу відпочиваєш. Так темп чесний, а тренування щільне — наприклад, 10 хвилин по 3 досить важкі присідання або 12 хвилин по черзі віджимання й тяга. Бери вагу, з якою міг би зробити приблизно вдвічі більше повторів, а якщо не встигаєш у хвилину — зменшуй повтори, а не відпочинок.',
    ],
    more: [
      [
        'EMOMs are great for technique practice with moderate weight, for conditioning finishers and for getting lots of quality work into a short session.',
        'EMOM добре підходить для відпрацювання техніки з помірною вагою, для кондиційних фінішерів і щоб набрати багато якісної роботи за коротке тренування.',
      ],
    ],
    facets: {},
    chips: ['k_circuit_training', 'short_on_time', 'k_amrap'],
  },
  {
    id: 'k_cluster_sets',
    ask: ['What are cluster sets?', 'Що таке кластерні підходи?'],
    answer: [
      'A cluster set splits one set into mini-sets with short breaks: for example 5 × 2 reps with 15–30 seconds between them instead of 10 reps in a row. The short pauses let you keep bar speed and form with heavier loads, so you get more quality reps near your top weights. They suit strength and power work; for muscle growth, normal sets taken close to failure work just as well and are simpler.',
      'Кластерний підхід — це один підхід, розбитий на міні-підходи з короткими паузами: наприклад, 5 × 2 повтори з відпочинком 15–30 секунд замість 10 повторів поспіль. Короткі паузи дають змогу тримати швидкість і техніку з більшою вагою, тож ти робиш більше якісних повторів біля своїх максимальних ваг. Це для сили й потужності; для росту м’язів звичайні підходи близько до відмови працюють не гірше і простіші.',
    ],
    more: [
      [
        'Rack the bar or set the dumbbells down during the pause, and brace again before every mini-set.',
        'Під час паузи став штангу на стійки або опускай гантелі і перед кожним міні-підходом заново напружуй корпус.',
      ],
    ],
    facets: {},
    chips: ['k_rest_pause', 'strength_vs_size', 'k_top_backoff'],
  },
  {
    id: 'k_rest_pause',
    ask: ['How do rest-pause sets work?', 'Як працюють підходи рест-пауза?'],
    answer: [
      'Rest-pause: do a set close to failure, rest 10–20 seconds, squeeze out a few more reps, and repeat that once or twice. It packs a lot of effort into little time, which makes it useful for isolation and machine exercises when you’re short on time. Use it sparingly — on the last set of one or two exercises — and avoid it on heavy barbell squats and deadlifts, where fatigue wrecks form.',
      'Рест-пауза: робиш підхід близько до відмови, відпочиваєш 10–20 секунд, дотискаєш ще кілька повторів і повторюєш це раз чи двічі. Так багато зусилля вміщується в мало часу, тож це зручно для ізолюючих вправ і тренажерів, коли часу мало. Використовуй помірно — на останньому підході однієї-двох вправ — і не роби цього у важких присіданнях і станових зі штангою, де втома ламає техніку.',
    ],
    more: [
      [
        'A simple version: pick a weight for about 10 reps, do 10, then mini-sets of 3–4 reps with 15 seconds of rest until you can’t get 2.',
        'Простий варіант: вага приблизно на 10 повторів, робиш 10, далі міні-підходи по 3–4 повтори з відпочинком 15 секунд, поки не зможеш зробити 2.',
      ],
    ],
    facets: {},
    chips: ['k_myo_reps', 'dropset', 'failure'],
  },
  {
    id: 'k_myo_reps',
    ask: ['What are myo-reps?', 'Що таке міо-повтори?'],
    answer: [
      'Myo-reps are a rest-pause style: one activation set of about 12–20 reps close to failure, then several mini-sets of 3–5 reps with only 3–5 deep breaths between them. Most of the reps are hard, “effective” reps, so you get growth similar to 3 normal sets in a fraction of the time. They work best on isolation and machine lifts — curls, lateral raises, leg extensions, cable work.',
      'Міо-повтори — різновид рест-паузи: один активаційний підхід приблизно на 12–20 повторів близько до відмови, далі кілька міні-підходів по 3–5 повторів лише з 3–5 глибокими вдихами між ними. Більшість повторів важкі й «ефективні», тож ріст схожий на 3 звичайні підходи за значно менший час. Найкраще це працює в ізолюючих вправах і тренажерах — згинання, махи в сторони, розгинання ніг, блоки.',
    ],
    more: [
      [
        'Stop the mini-sets when you can’t hit the target reps anymore; one or two myo-rep sets per exercise is plenty.',
        'Зупиняй міні-підходи, коли вже не виходить цільова кількість повторів; одного-двох міо-підходів на вправу цілком достатньо.',
      ],
    ],
    facets: {},
    chips: ['k_rest_pause', 'short_on_time', 'dropset'],
  },
  {
    id: 'k_double_progression',
    ask: ['What is double progression?', 'Що таке подвійна прогресія?'],
    answer: [
      'Double progression means you progress reps first, then weight: pick a rep range like 8–12, keep the same weight until you hit 12 on all sets, then add a small jump and start back at 8. It’s the simplest reliable way to keep progressing on dumbbell, machine and isolation exercises, where the weight jumps are big compared with the load. Log every set so you know exactly what to beat next time.',
      'Подвійна прогресія — спершу ростуть повтори, потім вага: обираєш діапазон, скажімо 8–12, тримаєш ту саму вагу, поки не зробиш 12 у всіх підходах, тоді додаєш невеликий крок і знову починаєш з 8. Це найпростіший надійний спосіб прогресувати в гантелях, тренажерах та ізолюючих вправах, де крок ваги великий відносно навантаження. Записуй кожен підхід, щоб точно знати, що перевершити наступного разу.',
    ],
    more: [
      [
        'If the new weight drops you below the bottom of the range, use a smaller jump or stay with the old weight for one more session.',
        'Якщо з новою вагою ти випадаєш нижче діапазону, бери менший крок або потренуйся з попередньою вагою ще одне тренування.',
      ],
    ],
    facets: {},
    chips: ['add_weight', 'plateau', 'k_top_backoff'],
  },
  {
    id: 'k_taper',
    ask: [
      'How do I taper before a meet or a max test?',
      'Як зробити підводку перед змаганнями або тестом максимуму?',
    ],
    answer: [
      'A taper cuts fatigue while keeping strength: in the last 1–2 weeks drop your volume by roughly 40–60% but keep the intensity — a few heavy singles or doubles at 85–90% — so you stay sharp. The final 2–3 days are very light or off. Don’t try anything new in that window: same technique, same food, same sleep routine.',
      'Підводка знімає втому, зберігаючи силу: за останні 1–2 тижні скороти обсяг приблизно на 40–60%, але залиш інтенсивність — кілька важких одиночних чи подвійних повторів на 85–90%, щоб лишатися «гострим». Останні 2–3 дні — дуже легко або відпочинок. У цей період нічого нового: та сама техніка, та сама їжа, той самий режим сну.',
    ],
    more: [
      [
        'A common plan: two weeks out a normal heavy week with fewer sets, one week out singles at opener weight, then rest or mobility only for the last two days.',
        'Типова схема: за два тижні — звичайний важкий тиждень з меншою кількістю підходів, за тиждень — одиночні повтори на вазі першої спроби, останні два дні — лише відпочинок або мобільність.',
      ],
    ],
    facets: {},
    chips: ['k_test_max', 'deload', 'periodization'],
  },
  {
    id: 'k_top_backoff',
    ask: ['What is a top set with back-off sets?', 'Що таке топ-сет і підходи зі зниженою вагою?'],
    answer: [
      'You work up to one heavy “top set” — for example 1 × 5 at a hard but clean effort — then drop the weight about 10–15% for 2–4 “back-off” sets of the same or slightly more reps. The top set drives strength and shows your progress; the back-off sets add quality volume without the fatigue of doing every set at the top weight. When the top set gets easier at the same effort, raise it next session.',
      'Ти виходиш на один важкий «топ-сет» — наприклад, 1 × 5 з важким, але чистим зусиллям — а потім знижуєш вагу приблизно на 10–15% і робиш 2–4 підходи «бек-оф» з тією ж або трохи більшою кількістю повторів. Топ-сет дає силу й показує прогрес, а бек-оф підходи додають якісного обсягу без втоми від роботи всіх підходів на максимальній вазі. Коли топ-сет стає легшим при тому ж зусиллі — піднімай його наступного разу.',
    ],
    more: [
      [
        'Rate the top set with RPE: at 8 (two reps left) keep the weight, at 9.5 hold it next time, at 7 you can add.',
        'Оцінюй топ-сет за RPE: на 8 (два повтори в запасі) тримай вагу, на 9,5 наступного разу не додавай, на 7 — можна додати.',
      ],
    ],
    facets: {},
    chips: ['rpe', 'k_amrap', 'k_double_progression'],
  },
  {
    id: 'k_paused_reps',
    ask: ['Are paused reps worth doing?', 'Чи варто робити повтори з паузою?'],
    answer: [
      'Yes — pausing for 1–3 seconds at the hardest point (the bottom of a squat, on the chest in a bench, just off the floor in a deadlift) kills the bounce, builds strength where you’re weakest and forces you to stay tight. Use about 10–20% less weight than for normal reps. They’re great as a secondary variation or as technique practice in the warm-up.',
      'Так — пауза на 1–3 секунди в найважчій точці (внизу присіду, на грудях у жимі, трохи над підлогою в становій) прибирає відскок, розвиває силу там, де ти найслабший, і змушує тримати напругу. Бери приблизно на 10–20% меншу вагу, ніж для звичайних повторів. Вони чудово підходять як допоміжний варіант вправи або як відпрацювання техніки в розминці.',
    ],
    more: [
      [
        'Stay tight during the pause — don’t relax at the bottom of a squat or sink the bar into your chest; the pause should look like a freeze-frame.',
        'Під час паузи тримай напругу — не розслабляйся внизу присіду й не «топи» штангу в груди; пауза має виглядати як стоп-кадр.',
      ],
    ],
    facets: {},
    chips: ['k_sticking_point', 'tempo', 'k_eccentrics'],
  },
  {
    id: 'k_eccentrics',
    ask: ['Do negatives (eccentric reps) build muscle?', 'Чи будують м’язи негативні повтори?'],
    answer: [
      'The lowering (eccentric) part of a rep is a strong growth signal, and you’re about 20–40% stronger lowering a weight than lifting it. Controlling the descent for 2–3 seconds on normal reps already gets most of the benefit. Supramaximal negatives (heavier than you can lift, with a spotter) cause a lot of soreness — use them rarely, for example to build up to your first pull-up or dip.',
      'Фаза опускання (ексцентрика) — сильний сигнал до росту, і в ній ти приблизно на 20–40% сильніший, ніж у підйомі. Контрольоване опускання 2–3 секунди у звичайних повторах уже дає більшу частину користі. Надважкі негативи (вага більша, ніж можеш підняти, зі страхувальником) дають сильну крепатуру — використовуй їх рідко, наприклад, щоб вийти на перше підтягування чи віджимання на брусах.',
    ],
    more: [
      [
        'Eccentric-focused work is also a classic tool in tendon rehab, but then it’s done light and slow under a physio’s plan.',
        'Ексцентрична робота — також класичний інструмент у реабілітації сухожиль, але тоді її роблять легко й повільно за планом фізіотерапевта.',
      ],
    ],
    facets: {},
    chips: ['tempo', 'pullup_zero', 'k_paused_reps'],
  },
  {
    id: 'k_volume_landmarks',
    ask: ['What are MEV and MRV?', 'Що таке MEV і MRV?'],
    answer: [
      'They’re volume landmarks: MEV (minimum effective volume) is the fewest hard sets per muscle per week that still make it grow, MRV (maximum recoverable volume) is the most you can recover from. Most people grow well somewhere around 10–20 hard sets per muscle per week, starting nearer the low end and adding sets over a block. When performance drops and soreness lingers, you’ve passed your MRV — time to deload.',
      'Це орієнтири обсягу: MEV (мінімальний ефективний обсяг) — найменше важких підходів на м’яз за тиждень, які ще дають ріст, MRV (максимальний відновлюваний обсяг) — найбільше, від чого ти встигаєш відновитися. Більшість людей добре ростуть десь у межах 10–20 важких підходів на м’яз за тиждень, починаючи ближче до нижньої межі й додаючи підходи протягом блоку. Коли результати падають, а крепатура не минає — ти за межею MRV, час на розвантаження.',
    ],
    more: [
      [
        'These numbers are individual and shift with sleep, stress and diet — use them as a starting point, then watch your own progress.',
        'Ці цифри індивідуальні й залежать від сну, стресу та харчування — сприймай їх як відправну точку і стеж за власним прогресом.',
      ],
    ],
    facets: {},
    chips: ['volume_muscle', 'deload', 'overtraining'],
  },
  {
    id: 'k_bfr',
    ask: [
      'Does blood flow restriction training work?',
      'Чи працює тренування з обмеженням кровотоку (BFR)?',
    ],
    answer: [
      'BFR (occlusion) training uses a cuff or band high on the arm or thigh to partly slow the blood flowing back from the limb, so very light weights (20–30% of your max) for high reps (often 30, 15, 15, 15) still build muscle. It’s useful when you can’t load heavy — rehab, sore joints, deloads. Wraps should feel tight but not painful (about 7 out of 10 on the legs, less on the arms), with no numbness or tingling; avoid it with clotting problems, high blood pressure or pregnancy unless a doctor says it’s ok.',
      'BFR-тренування (оклюзійне) — це манжета чи джгут у верхній частині руки або стегна, які частково сповільнюють відтік крові від кінцівки, тож навіть дуже легка вага (20–30% від максимуму) на багато повторів (часто 30, 15, 15, 15) будує м’язи. Це корисно, коли не можна вантажити важко — реабілітація, болючі суглоби, розвантаження. Затягувати туго, але не до болю (приблизно 7 з 10 на ногах, слабше на руках), без оніміння й поколювання; уникай цього при проблемах зі згортанням крові, високому тиску чи вагітності, якщо лікар не дозволив.',
    ],
    more: [
      [
        'Rest only 30–60 seconds between BFR sets and release the cuff right after the exercise; one or two exercises per session is enough.',
        'Відпочивай лише 30–60 секунд між BFR-підходами і знімай манжету одразу після вправи; однієї-двох вправ за тренування достатньо.',
      ],
    ],
    facets: {},
    chips: ['return_injury', 'health_conditions', 'k_myo_reps'],
  },
  {
    id: 'k_5x5',
    ask: ['Is a 5×5 program good?', 'Чи хороша програма 5×5?'],
    answer: [
      'Yes, 5×5 programs (like StrongLifts or Madcow-style plans) are a solid start for beginners: a few big lifts, three days a week, a little more weight every session. Strength climbs fast in the first months. Their limits: little arm, shoulder and upper-back isolation work, and progress stalls once the linear jumps run out — then switch to weekly progression or a more varied program.',
      'Так, програми 5×5 (як StrongLifts або в стилі Madcow) — хороший старт для новачків: кілька базових вправ, три дні на тиждень, трохи більше ваги щотренування. Перші місяці сила росте швидко. Обмеження: мало ізолюючої роботи на руки, плечі й верх спини, а прогрес зупиняється, коли лінійні кроки вичерпуються — тоді переходь на тижневу прогресію або різноманітнішу програму.',
    ],
    more: [
      [
        'Add 2–3 sets of pull-ups or rows, curls and lateral raises at the end, and drop the weight by 10% when you miss the same weight twice.',
        'Додай у кінці 2–3 підходи підтягувань або тяги, згинань на біцепс і махів у сторони, а якщо двічі не взяв ту саму вагу — скинь 10%.',
      ],
    ],
    facets: {},
    chips: ['k_531', 'beginner', 'split_choice'],
  },
  {
    id: 'k_531',
    ask: ['How does 5/3/1 work?', 'Як працює програма 5/3/1?'],
    answer: [
      '5/3/1 (by Jim Wendler) runs in 4-week cycles built on a “training max” set at about 90% of your real max: week one sets of 5, week two sets of 3, week three a 5/3/1 wave, week four a deload. The last set each week is an AMRAP, and after each cycle you add about 2.5 kg to the upper-body and 5 kg to the lower-body training maxes. It’s slow and steady — built for lifters who can no longer add weight every session.',
      '5/3/1 (Джим Вендлер) — це 4-тижневі цикли від «тренувального максимуму», який дорівнює приблизно 90% реального: перший тиждень підходи по 5, другий — по 3, третій — хвиля 5/3/1, четвертий — розвантаження. Останній підхід щотижня — AMRAP, а після кожного циклу додаєш приблизно 2,5 кг до тренувальних максимумів на верх тіла і 5 кг — на ноги. Повільно, але надійно — програма для тих, хто вже не може додавати вагу щотренування.',
    ],
    more: [
      [
        'Pair the main lift with assistance work — for example “Boring But Big”, 5 × 10 at 50–60% — and keep the training max honest rather than ego-high.',
        'Поєднуй основну вправу з допоміжною роботою — наприклад, «Boring But Big», 5 × 10 на 50–60% — і став тренувальний максимум чесно, без его.',
      ],
    ],
    facets: {},
    chips: ['k_amrap', 'k_5x5', 'periodization'],
  },
  {
    id: 'k_circuit_training',
    ask: ['Is circuit training good?', 'Чи добре кругове тренування?'],
    answer: [
      'Circuits — several exercises back to back with little rest — are great for conditioning, for supporting fat loss and for getting a full-body session done in 20–30 minutes. They build some muscle for beginners, but with short rests fatigue limits the loads, so for maximum strength and size normal sets with proper rest still win. A good mix: strength work first, then a 10-minute circuit as a finisher.',
      'Кругові тренування — кілька вправ поспіль з мінімальним відпочинком — чудові для витривалості, підтримки схуднення і щоб устигнути все тіло за 20–30 хвилин. Новачкам вони дають трохи м’язів, але через короткий відпочинок втома обмежує ваги, тож для максимальної сили й об’єму звичайні підходи з нормальним відпочинком усе ж кращі. Гарне поєднання: спершу силова робота, а кругове на 10 хвилин — як фінішер.',
    ],
    more: [
      [
        'Alternate body regions (legs, push, pull, core) so one muscle rests while another works, and keep the loads moderate so form stays clean when you’re breathing hard.',
        'Чергуй частини тіла (ноги, жим, тяга, прес), щоб один м’яз відпочивав, поки працює інший, і тримай помірні ваги, щоб техніка лишалась чистою, навіть коли задихаєшся.',
      ],
    ],
    facets: {},
    chips: ['k_emom', 'hiit', 'short_on_time'],
  },
  {
    id: 'k_plyometrics',
    ask: [
      'Should I do plyometrics like box jumps?',
      'Чи варто робити пліометрику, як-от стрибки на тумбу?',
    ],
    answer: [
      'Plyometrics — jumps, bounds, medicine-ball throws — train speed and power and help athletes and anyone who wants to stay springy. Keep the volume low (around 20–60 quality contacts per session), do them fresh at the start of a workout, and land softly with your knees tracking over your toes. For box jumps the goal is jump height, not box height — step down instead of jumping down to spare your Achilles and knees.',
      'Пліометрика — стрибки, багатоскоки, кидки медболу — розвиває швидкість і потужність, допомагає спортсменам і всім, хто хоче лишатися «пружним». Обсяг тримай невеликим (приблизно 20–60 якісних контактів за тренування), роби її свіжим на початку тренування і приземляйся м’яко, коліна по лінії носків. У стрибках на тумбу мета — висота стрибка, а не тумби: спускайся кроком, а не стрибком, щоб берегти ахілл і коліна.',
    ],
    more: [
      [
        'Start with low hops and jumps onto a low box for a few weeks before depth jumps, and skip them while any tendon in your legs is irritated.',
        'Кілька тижнів починай з невисоких підскоків і стрибків на низьку тумбу, перш ніж переходити до глибинних стрибків, і пропускай їх, поки подразнене будь-яке сухожилля ніг.',
      ],
    ],
    facets: {},
    chips: ['other_sport', 'running', 'warmup'],
  },

  // ---- lifts and variations ----
  {
    id: 'k_front_squat',
    ask: ['How do I front squat properly?', 'Як правильно робити фронтальний присід?'],
    answer: [
      'Rest the bar on your front delts, close to your throat, with the elbows high and pointing forward — the hands only balance it (a clean grip with two or three fingers, crossed arms, or straps looped around the bar). Stay upright, brace hard and sit straight down between your heels; the moment the elbows drop, the bar rolls forward. It’s great for the quads and upper back and easier on the lower back than a back squat, with loads usually around 80–85% of it.',
      'Поклади гриф на передні дельти, ближче до горла, лікті високо й уперед — кисті лише втримують рівновагу (хват «на взяття» двома-трьома пальцями, схрещені руки або лямки навколо грифа). Тримай корпус вертикально, міцно напружся і сідай прямо вниз між п’ятами; щойно лікті опускаються — гриф котиться вперед. Це чудово для квадрицепсів і верху спини, м’якше для попереку, ніж присід зі штангою на спині, а ваги зазвичай близько 80–85% від нього.',
    ],
    more: [
      [
        'If your wrists hurt in the clean grip, use straps looped around the bar as handles or the cross-arm grip while you work on wrist and lat mobility.',
        'Якщо в хваті «на взяття» болять зап’ястя, використовуй лямки, накинуті на гриф, як ручки, або схрещений хват, паралельно працюючи над рухливістю зап’ясть і широчайших.',
      ],
    ],
    facets: {},
    chips: ['squat_form', 'k_wrist_mobility', 'k_high_low_bar'],
  },
  {
    id: 'k_hip_thrust',
    ask: ['How do I do hip thrusts correctly?', 'Як правильно робити ягідний місток зі штангою?'],
    answer: [
      'Set your upper back (just below the shoulder blades) on a bench, the bar padded over your hips, feet flat about hip-width apart so your shins are vertical at the top. Tuck your chin and ribs, drive through your heels and finish by squeezing the glutes — not by arching your lower back. Pause for a second at the top; if you feel it mostly in the hamstrings, bring your feet closer, and if in the quads, move them further out.',
      'Упрись верхом спини (трохи нижче лопаток) у лавку, гриф із м’якою накладкою на тазі, стопи рівно на ширині таза, щоб угорі гомілки були вертикальні. Підборіддя й ребра «вниз», тисни п’ятами і завершуй рух стисненням сідниць, а не прогином у попереку. Затримайся на секунду вгорі; якщо відчуваєш переважно задню поверхню стегна — постав стопи ближче, якщо квадрицепси — далі.',
    ],
    more: [
      [
        'Hip thrusts are one of the best glute builders because the glutes are loaded hardest at full hip extension; 3–4 sets of 8–15 twice a week works well.',
        'Ягідний місток — одна з найкращих вправ для сідниць, бо навантаження максимальне саме в повному розгинанні стегна; 3–4 підходи по 8–15 двічі на тиждень працюють добре.',
      ],
    ],
    facets: {},
    chips: ['grow_muscle', 'k_rdl', 'k_bulgarian_split'],
  },
  {
    id: 'k_rdl',
    ask: ['How do I do a Romanian deadlift?', 'Як робити румунську тягу?'],
    answer: [
      'Start standing with the bar and soft knees, then push your hips straight back while the bar slides down your thighs close to your legs. Keep your back neutral and lats tight, and go down until you feel a strong hamstring stretch — usually around mid-shin — then drive your hips forward to stand. It’s a hip hinge, not a squat: the knee angle barely changes.',
      'Починай стоячи зі штангою, коліна трохи зігнуті, і відводь таз прямо назад, а гриф ковзає вниз по стегнах близько до ніг. Спина нейтральна, широчайші напружені; опускайся, поки не відчуєш сильне розтягнення задньої поверхні стегна — зазвичай десь до середини гомілки — і виводь таз уперед, щоб піднятися. Це рух тазом, а не присід: кут у колінах майже не змінюється.',
    ],
    more: [
      [
        'Great for the hamstrings and glutes; use straps if your grip limits you, and keep the reps controlled (6–12) rather than bouncing out of the bottom.',
        'Чудово для задньої поверхні стегна й сідниць; якщо підводить хват — використовуй лямки, а повтори роби контрольовано (6–12), без відскоку знизу.',
      ],
    ],
    facets: {},
    chips: ['k_deadlift_rounding', 'k_good_morning', 'k_hamstring_flex'],
  },
  {
    id: 'k_bulgarian_split',
    ask: ['How do I do Bulgarian split squats?', 'Як робити болгарські випади?'],
    answer: [
      'Put your rear foot laces-down on a bench and step the front foot far enough forward that you can drop straight down with the front heel planted. Lower until the back knee nearly touches the floor, then drive up through the whole front foot. A longer stance and a slight forward lean hit the glutes more; a shorter stance and an upright torso hit the quads more.',
      'Постав задню стопу підйомом на лавку, а передню винеси вперед так, щоб опускатися прямо вниз, не відриваючи передньої п’яти. Опускайся, доки заднє коліно майже не торкнеться підлоги, і піднімайся, тиснучи всією передньою стопою. Ширший крок і легкий нахил уперед більше навантажують сідниці, коротший крок і рівний корпус — квадрицепси.',
    ],
    more: [
      [
        'Balance is tough at first — hold a rack or bench with one hand, start with bodyweight or light dumbbells, and do your weaker leg first.',
        'Спершу важко тримати рівновагу — тримайся рукою за раму чи лавку, починай із власною вагою або легкими гантелями і першою роби слабшу ногу.',
      ],
    ],
    facets: {},
    chips: ['k_lunges', 'unilateral', 'k_hip_thrust'],
  },
  {
    id: 'k_lunges',
    ask: ['How do I do lunges without knee pain?', 'Як робити випади, щоб не боліли коліна?'],
    answer: [
      'Take a step long enough that both knees bend to about 90° at the bottom, and keep the front knee tracking over the middle toes with the whole front foot on the floor. Reverse lunges (stepping back) are the easiest on the knees and the best place to start; walking lunges are harder on balance and breathing. If a knee aches, shorten the depth, slow down and try reverse lunges or split squats.',
      'Роби крок такої довжини, щоб унизу обидва коліна згиналися приблизно на 90°, переднє коліно йшло по лінії середніх пальців, а вся передня стопа стояла на підлозі. Зворотні випади (крок назад) найм’якші для колін — з них і варто починати; випади в русі складніші для рівноваги й дихання. Якщо ниє коліно — зменш глибину, сповільнись і спробуй зворотні випади або спліт-присід.',
    ],
    more: [
      [
        'Knees going past the toes is fine if it feels fine; pain is the signal to change something, not the angle itself.',
        'Коліна за носками — це нормально, якщо немає дискомфорту; сигнал щось змінити — біль, а не сам кут.',
      ],
    ],
    facets: {},
    chips: ['k_bulgarian_split', 'k_knees_over_toes', 'pain'],
  },
  {
    id: 'k_dips',
    ask: ['Are dips bad for the shoulders?', 'Чи шкідливі віджимання на брусах для плечей?'],
    answer: [
      'Dips are a great chest and triceps builder and fine for most shoulders if you control the depth. Go down until your upper arms are about parallel to the floor or slightly below, keep the shoulders down and back (no shrugging toward the ears) and don’t bounce at the bottom. Leaning forward works more chest, staying upright more triceps; if the front of your shoulder hurts, shorten the range or switch to close-grip push-ups or presses.',
      'Віджимання на брусах — чудова вправа для грудей і трицепсів і нормальна для більшості плечей, якщо контролювати глибину. Опускайся, поки плечі не будуть приблизно паралельні підлозі або трохи нижче, тримай плечі внизу й відведеними назад (не підтягуй до вух) і не відскакуй знизу. Нахил уперед більше навантажує груди, вертикальне положення — трицепси; якщо болить передня частина плеча — зменш амплітуду або заміни на віджимання вузьким хватом чи жими.',
    ],
    more: [
      [
        'Can’t do one yet? Start with slow negatives, band-assisted dips or bench dips with bent knees, then add weight on a belt once you can do 12–15 clean reps.',
        'Ще не виходить жодного? Почни з повільних негативів, віджимань з резинкою або від лавки зі зігнутими ногами, а коли зробиш 12–15 чистих повторів — додавай вагу на поясі.',
      ],
    ],
    facets: {},
    chips: ['k_eccentrics', 'k_rotator_cuff', 'alternatives'],
  },
  {
    id: 'k_face_pull',
    ask: ['How do I do face pulls and why?', 'Як робити тягу канату до обличчя і навіщо?'],
    answer: [
      'Face pulls train the rear delts and the muscles that rotate the shoulder outward — good for shoulder health and posture, especially if you press a lot. Set a rope at about forehead height, pull toward your face with the elbows high and finish with your hands beside your ears, thumbs pointing back. Go light and controlled: 2–3 sets of 12–20 reps, 2–3 times a week.',
      'Тяга канату до обличчя тренує задні дельти й м’язи, які розвертають плече назовні, — корисно для здоров’я плечей і постави, особливо якщо ти багато жмеш. Встанови канат приблизно на рівні лоба, тягни до обличчя з високими ліктями і закінчуй рух із кистями біля вух, великі пальці дивляться назад. Легко й контрольовано: 2–3 підходи по 12–20 повторів 2–3 рази на тиждень.',
    ],
    more: [
      [
        'No cable? A band anchored at head height or rear-delt flyes with light dumbbells do a similar job.',
        'Немає блока? Схожу роботу зроблять резинка, закріплена на рівні голови, або розведення на задні дельти з легкими гантелями.',
      ],
    ],
    facets: {},
    chips: ['k_rotator_cuff', 'posture', 'k_delt_heads'],
  },
  {
    id: 'k_lateral_raise',
    ask: ['How do I do lateral raises properly?', 'Як правильно робити махи в сторони?'],
    answer: [
      'Use light dumbbells, a slight forward lean and a small bend in the elbows, and raise your arms out to the side until they’re about shoulder height — lead with the elbows, not the hands. Think “push the dumbbells out to the walls” rather than up, keep the traps relaxed and lower slowly. Swinging heavy weights mostly trains momentum and traps; strict sets of 10–20 grow the side delts best.',
      'Бери легкі гантелі, трохи нахились уперед і злегка зігни лікті, піднімай руки в сторони приблизно до рівня плечей — першими йдуть лікті, а не кисті. Думай «відштовхни гантелі до стін», а не вгору, тримай трапеції розслабленими й опускай повільно. Розгойдування важких гантелей тренує здебільшого інерцію і трапеції; суворі підходи по 10–20 найкраще ростять середні дельти.',
    ],
    more: [
      [
        'Cable or machine lateral raises keep tension at the bottom too — a nice variation; side delts recover fast, so 2–4 sessions a week is fine.',
        'Махи в кросовері або тренажері тримають напругу й унизу — гарний варіант; середні дельти швидко відновлюються, тож 2–4 рази на тиждень — нормально.',
      ],
    ],
    facets: {},
    chips: ['k_delt_heads', 'grow_muscle', 'k_mind_muscle'],
  },
  {
    id: 'k_chinup_vs_pullup',
    ask: [
      'Chin-ups or pull-ups — what’s the difference?',
      'Підтягування прямим чи зворотним хватом — у чому різниця?',
    ],
    answer: [
      'Chin-ups (palms facing you) bring in more biceps and are usually a bit easier; pull-ups (palms facing away) lean more on the lats and upper back. Both are excellent back builders, so pick the one that feels better on your elbows and shoulders, or alternate them. A neutral grip (palms facing each other) is often the most joint-friendly of all.',
      'Зворотний хват (долоні до себе) сильніше підключає біцепс і зазвичай трохи легший; прямий хват (долоні від себе) більше навантажує широчайші й верх спини. Обидва — чудові вправи для спини, тож обирай той, що комфортніший для ліктів і плечей, або чергуй. Нейтральний хват (долоні одна до одної) часто найм’якший для суглобів.',
    ],
    more: [
      [
        'Grip width matters less than full range: start from a dead hang with your shoulders set and pull until your chin clears the bar.',
        'Ширина хвату важить менше, ніж повна амплітуда: починай з повного вису з зібраними плечима й тягнись, доки підборіддя не пройде гриф.',
      ],
    ],
    facets: {},
    chips: ['k_more_pullups', 'pullup_zero', 'exercise_muscles'],
  },
  {
    id: 'k_bench_grip',
    ask: ['How wide should my bench press grip be?', 'Який має бути хват у жимі лежачи?'],
    answer: [
      'A good default is a grip where your forearms are vertical when the bar touches your chest — for most people the index or middle finger around the rings on the bar. Wider shortens the range and uses more chest but stresses the shoulders more; narrower uses more triceps. Tuck the elbows about 45–70° from your body rather than flaring them straight out, and keep the bar over your wrists, not bent back.',
      'Хороша відправна точка — хват, при якому передпліччя вертикальні, коли гриф торкається грудей; для більшості це вказівний або середній палець біля кілець на грифі. Ширший хват скорочує амплітуду й більше задіює груди, але сильніше навантажує плечі; вужчий — більше трицепс. Лікті тримай під кутом приблизно 45–70° до тулуба, а не розводь у сторони, а гриф — над зап’ястям, не завалюючи його назад.',
    ],
    more: [
      [
        'Squeeze the bar hard and think of “bending” it to engage the lats; if your shoulders ache, try a slightly narrower grip and more elbow tuck.',
        'Міцно стискай гриф і думай, що «згинаєш» його, щоб підключити широчайші; якщо ниють плечі — спробуй трохи вужчий хват і сильніше притисни лікті.',
      ],
    ],
    facets: {},
    chips: ['k_bench_arch', 'k_leg_drive', 'technique_lift'],
  },
  {
    id: 'k_leg_drive',
    ask: ['What is leg drive on the bench press?', 'Що таке робота ногами в жимі лежачи?'],
    answer: [
      'Leg drive is pushing your feet into the floor to create full-body tension and to drive yourself back along the bench toward your head — not lifting your hips. Plant your feet firmly (flat or on the toes, whichever lets you push hardest), squeeze your glutes and keep them on the bench. Done right, it stabilises your upper back and can add a few kilos to your press.',
      'Робота ногами — це упор стопами в підлогу, щоб створити напругу всього тіла й ніби зсунути себе по лавці до голови, а не підйом таза. Постав стопи міцно (на всю стопу чи на носки — як тобі найлегше тиснути), напруж сідниці й тримай їх на лавці. Якщо робити правильно, вона стабілізує верх спини й може додати кілька кілограмів до жиму.',
    ],
    more: [
      [
        'Set your feet before you unrack and push as the bar leaves your chest; if your hips pop up, push more backward than upward.',
        'Постав ноги до зняття штанги і тисни ними, коли гриф іде від грудей; якщо таз відривається — тисни більше назад, ніж угору.',
      ],
    ],
    facets: {},
    chips: ['k_bench_arch', 'k_bench_grip', 'bench_alone'],
  },
  {
    id: 'k_high_low_bar',
    ask: ['High-bar or low-bar squat?', 'Присід з високим чи низьким положенням грифа?'],
    answer: [
      'High-bar sits on top of the traps: a more upright torso, more knee bend and more quads — a natural fit for most people and for Olympic lifting. Low-bar sits a few centimetres lower, on the rear delts: more forward lean and hip hinge, more glutes and hamstrings, and usually a bit more weight moved — popular in powerlifting. Both are good; pick the one that feels comfortable on your shoulders and elbows and stick with it for a while.',
      'Високий гриф лежить на трапеціях: корпус вертикальніший, коліна згинаються більше, більше квадрицепсів — це природно для більшості людей і для важкої атлетики. Низький гриф — на кілька сантиметрів нижче, на задніх дельтах: більший нахил уперед і рух тазом, більше сідниць і задньої поверхні стегна, зазвичай трохи більша вага — популярно в пауерліфтингу. Обидва варіанти хороші; обери той, що зручний для плечей і ліктів, і тримайся його якийсь час.',
    ],
    more: [
      [
        'Low-bar needs good shoulder mobility; if your elbows or wrists hurt, widen your grip and keep the wrists straight.',
        'Для низького грифа потрібна хороша рухливість плечей; якщо болять лікті чи зап’ястя — ширше хват і рівні зап’ястя.',
      ],
    ],
    facets: {},
    chips: ['squat_form', 'k_front_squat', 'k_butt_wink'],
  },
  {
    id: 'k_good_morning',
    ask: ['Are good mornings a good exercise?', 'Чи хороша вправа «гуд морнінг»?'],
    answer: [
      'Yes — good mornings (bar on your back, hinging forward with soft knees) strengthen the hamstrings, glutes and spinal erectors and carry over well to squats and deadlifts. Start very light, keep your back neutral and only go as low as you can without rounding, usually until your torso is near parallel to the floor. They’re an accessory: 3 sets of 8–12 with moderate weight, not a lift to max out on.',
      'Так — гуд морнінг (гриф на спині, нахил уперед зі злегка зігнутими колінами) зміцнює задню поверхню стегна, сідниці й розгиначі спини і добре переноситься на присідання та станову. Починай з дуже легкої ваги, тримай спину нейтральною й опускайся лише настільки, наскільки можеш без округлення, зазвичай майже до паралелі корпусу з підлогою. Це допоміжна вправа: 3 підходи по 8–12 з помірною вагою, а не вправа на максимум.',
    ],
    more: [
      [
        'If your lower back is sensitive, start with Romanian deadlifts or back extensions instead and add good mornings later.',
        'Якщо поперек чутливий, почни з румунської тяги або гіперекстензій, а гуд морнінг додай пізніше.',
      ],
    ],
    facets: {},
    chips: ['k_rdl', 'k_core_stability', 'k_row_lower_back'],
  },
  {
    id: 'k_farmer_carry',
    ask: ['Are farmer’s carries worth doing?', 'Чи варто робити прогулянку фермера?'],
    answer: [
      'Very much — carrying heavy dumbbells, kettlebells or handles over a distance trains your grip, traps, core and conditioning all at once, with low injury risk. Stand tall, shoulders down, short quick steps; 3–4 walks of 20–40 metres (or 30–45 seconds) with a heavy load is plenty. One-hand suitcase carries add a strong challenge for the core against bending sideways.',
      'Ще й як — перенесення важких гантелей, гир або спецручок на відстань одночасно тренує хват, трапеції, корпус і витривалість з невисоким ризиком травми. Стій рівно, плечі вниз, короткі швидкі кроки; 3–4 проходи по 20–40 метрів (або 30–45 секунд) з важкою вагою цілком достатньо. Перенесення ваги в одній руці («валіза») додає сильне навантаження на корпус проти бокового нахилу.',
    ],
    more: [
      [
        'Put them at the end of a session — a tired grip before deadlifts or rows is a bad trade.',
        'Став їх у кінець тренування — втомлений хват перед становою чи тягами поганий обмін.',
      ],
    ],
    facets: {},
    chips: ['grip', 'k_core_stability', 'k_circuit_training'],
  },
  {
    id: 'k_calves',
    ask: ['My calves won’t grow — what do I do?', 'Литки не ростуть — що робити?'],
    answer: [
      'Calves respond to the same things as other muscles — they just get ignored or trained with bouncy half reps. Use the full range: a deep stretch with a 1–2 second pause at the bottom, then all the way up onto your toes. Do 10–15 hard sets a week split between standing (straight-knee) and seated (bent-knee) raises, 8–20 reps, 2–3 times a week, and expect slower progress than elsewhere — genetics play a big role.',
      'Литки реагують на те саме, що й інші м’язи, — просто їх ігнорують або тренують пружними половинчастими повторами. Працюй на повну амплітуду: глибоке розтягнення з паузою 1–2 секунди внизу, а потім до кінця на носки. Роби 10–15 важких підходів на тиждень — підйоми стоячи (прямі коліна) і сидячи (зігнуті коліна), по 8–20 повторів 2–3 рази на тиждень — і будь готовий, що прогрес повільніший, ніж в інших м’язах: генетика тут важить багато.',
    ],
    more: [
      [
        'The stretched position seems to drive most of the growth for calves, so don’t cut the bottom — even partial reps in the deep stretch work.',
        'Схоже, для литок найважливіше розтягнене положення, тож не обрізай низ — навіть часткові повтори в глибокому розтягненні працюють.',
      ],
    ],
    facets: {},
    chips: ['grow_muscle', 'k_partial_reps', 'muscle_frequency'],
  },
  {
    id: 'k_trap_bar',
    ask: [
      'Is the trap bar deadlift as good as a regular deadlift?',
      'Чи трап-гриф такий самий добрий, як звичайна станова?',
    ],
    answer: [
      'For most people, yes. The trap (hex) bar keeps the weight in line with your body, so you stay more upright, use more quads and put less stress on your lower back, and most lifters handle a bit more weight on it. It’s a great main pull for beginners, athletes and anyone with a sensitive back. If you want to compete in powerlifting you’ll need the straight bar eventually; otherwise choose the one you can train hard and consistently.',
      'Для більшості — так. Трап-гриф (шестикутний) тримає вагу на одній лінії з тілом, тож ти стоїш вертикальніше, більше працюють квадрицепси, менше навантаження на поперек, і зазвичай ваги трохи більші. Це чудова основна тяга для новачків, спортсменів і всіх, у кого чутлива спина. Якщо хочеш виступати в пауерліфтингу, колись знадобиться прямий гриф; інакше обирай той, з яким можеш тренуватися важко й регулярно.',
    ],
    more: [
      [
        'Use the high handles to shorten the range while you learn; stand in the centre and push the floor away just like in a normal deadlift.',
        'Поки вчишся, бери високі ручки, щоб скоротити амплітуду; стань по центру й відштовхуй підлогу, як у звичайній становій.',
      ],
    ],
    facets: {},
    chips: ['k_sumo_conventional', 'k_deadlift_rounding', 'technique_lift'],
  },
  {
    id: 'k_nordic_curl',
    ask: ['Are Nordic hamstring curls worth it?', 'Чи варто робити нордичні згинання?'],
    answer: [
      'Yes — Nordic curls are one of the best-researched ways to lower the risk of hamstring strains, especially for sprinters and team-sport players. Anchor your heels, keep a straight line from knees to head and lower yourself as slowly as you can, catching yourself with your hands. Start with 2 sets of 3–5 reps once or twice a week; they cause a lot of soreness at first, so build up slowly.',
      'Так — нордичні згинання одна з найкраще досліджених вправ для зниження ризику травм задньої поверхні стегна, особливо для спринтерів і командних видів спорту. Зафіксуй п’яти, тримай тіло прямою лінією від колін до голови й опускайся якомога повільніше, ловлячи себе руками. Почни з 2 підходів по 3–5 повторів раз-два на тиждень; спершу вони дають сильну крепатуру, тож нарощуй поступово.',
    ],
    more: [
      [
        'A band around your chest anchored behind you, or a shorter range, makes them easier until you can control the whole way down.',
        'Резинка на грудях, закріплена позаду, або коротша амплітуда полегшують вправу, поки не зможеш контролювати весь спуск.',
      ],
    ],
    facets: {},
    chips: ['k_hamstring_flex', 'k_rdl', 'other_sport'],
  },
  {
    id: 'k_pistol_squat',
    ask: ['How do I learn a pistol squat?', 'Як навчитися присідати «пістолетиком»?'],
    answer: [
      'A pistol squat needs leg strength, balance and ankle mobility. Build up with box pistols (sit down to a bench on one leg and stand back up), lowering the box over time, and hold a door frame or suspension straps for balance. A counterweight helps — holding a light plate out in front makes the bottom easier; practise 3 sets of 3–6 per leg a few times a week.',
      'Для «пістолетика» потрібні сила ніг, рівновага й рухливість гомілкостопу. Нарощуй через присідання на одній нозі до лавки (сідаєш і встаєш), поступово знижуючи висоту, і тримайся за одвірок чи петлі TRX для рівноваги. Противага допомагає — легкий млинець у витягнутих руках полегшує нижню точку; тренуй 3 підходи по 3–6 на кожну ногу кілька разів на тиждень.',
    ],
    more: [
      [
        'If your heel lifts, put a small plate under it or work on ankle mobility; Bulgarian split squats build the strength part in the meantime.',
        'Якщо п’ята відривається — підклади під неї невеликий млинець або працюй над рухливістю гомілкостопу; силу тим часом добре будують болгарські випади.',
      ],
    ],
    facets: {},
    chips: ['k_ankle_mobility', 'k_calisthenics', 'k_bulgarian_split'],
  },

  // ---- recovery ----
  {
    id: 'k_no_soreness',
    ask: [
      'I’m not sore anymore — is my training still working?',
      'Мене більше не крепатурить — тренування ще працює?',
    ],
    answer: [
      'Yes — soreness is a poor sign of a good workout. It mostly shows up with new exercises, more volume or long eccentrics, and it fades as your body adapts, while growth carries on. Judge your training by progress instead: more reps or weight over the weeks, measurements and photos. Chasing soreness usually just means more fatigue and slower recovery.',
      'Так — крепатура погано показує якість тренування. Вона з’являється переважно від нових вправ, більшого обсягу чи довгих ексцентрик і зникає, коли тіло адаптується, а ріст триває. Оцінюй тренування за прогресом: більше повторів чи ваги за тижні, заміри та фото. Гонитва за крепатурою зазвичай означає лише більше втоми й повільніше відновлення.',
    ],
    more: [
      [
        'Some mild soreness after a hard session is normal; soreness lasting more than 4–5 days means the dose was too big.',
        'Легка крепатура після важкого тренування — це нормально; якщо вона тримається понад 4–5 днів, доза була завелика.',
      ],
    ],
    facets: {},
    chips: ['train_sore', 'results_time', 'k_progress_photos'],
  },
  {
    id: 'k_massage_gun',
    ask: ['Are massage guns worth it?', 'Чи варто купувати масажний пістолет?'],
    answer: [
      'Massage guns can ease the feeling of tightness and soreness for a while and are a nice warm-up or cool-down tool — much like foam rolling. They don’t speed up real tissue recovery much or “flush out” lactic acid; sleep, food and sensible volume do the heavy lifting. Use 30–90 seconds per muscle at a comfortable pressure, and keep them off bones, joints, the front of the neck and any fresh injury or bruise.',
      'Масажний пістолет може на якийсь час зменшити відчуття скутості й крепатури, це приємний інструмент для розминки чи заминки — схоже на ролик. Справжнє відновлення тканин він суттєво не пришвидшує і молочну кислоту не «виганяє»; основну роботу роблять сон, їжа і розумний обсяг. 30–90 секунд на м’яз із комфортним тиском, не працюй по кістках, суглобах, передній частині шиї та свіжих травмах чи синцях.',
    ],
    more: [
      [
        'If it helps you feel ready and move better, it’s worth it; if not, a foam roller does the same job for less money.',
        'Якщо з ним ти почуваєшся готовим і рухаєшся краще — він того вартий; якщо ні, ролик робить те саме дешевше.',
      ],
    ],
    facets: {},
    chips: ['foam_roll', 'recovery', 'k_no_soreness'],
  },
  {
    id: 'k_wearables',
    ask: [
      'Should I trust my watch’s HRV and recovery score?',
      'Чи довіряти HRV і оцінці відновлення з годинника?',
    ],
    answer: [
      'Use them as trends, not verdicts. HRV and resting heart rate from a watch or ring are fairly reliable over weeks: HRV trending down and resting heart rate up for several days usually means stress, poor sleep, illness or too much training. A single low morning score doesn’t mean you can’t train — warm up and see how the weights move. The calorie-burn numbers are the least accurate part and often overestimate exercise calories.',
      'Сприймай їх як тренди, а не вироки. HRV і пульс спокою з годинника чи кільця досить надійні на відрізку тижнів: якщо кілька днів HRV падає, а пульс спокою росте, це зазвичай стрес, поганий сон, хвороба чи забагато тренувань. Одна низька ранкова оцінка не означає, що тренуватися не можна — розімнись і подивись, як ідуть ваги. Найменш точна частина — спалені калорії, вони часто завищені.',
    ],
    more: [
      [
        'Measure at the same time each morning, compare with your own baseline, and ignore day-to-day noise of a few points.',
        'Вимірюй щоранку в той самий час, порівнюй зі своїм власним рівнем і не зважай на щоденні коливання в кілька пунктів.',
      ],
    ],
    facets: {},
    chips: ['recovery', 'sleep', 'hr_zones'],
  },
  {
    id: 'k_cns_fatigue',
    ask: ['Is CNS fatigue real?', 'Чи існує втома ЦНС?'],
    answer: [
      'Mostly it’s an overused term. Heavy lifting does cause short-lived fatigue that clears within hours to a day or two; the idea that a heavy deadlift “fries your nervous system” for a week isn’t well supported. When you feel flat for days, it’s usually built-up muscle and joint fatigue, poor sleep, stress or too little food — so the fix is the same: manage volume, sleep, eat, and deload when performance keeps dropping.',
      'Здебільшого це надто вживаний термін. Важкі ваги справді дають короткочасну втому, яка минає за години чи день-два; ідея, що важка станова «спалює нервову систему» на тиждень, погано підтверджена. Коли ти кілька днів «пласкі», причина зазвичай у накопиченій втомі м’язів і суглобів, поганому сні, стресі чи нестачі їжі — тож і рішення те саме: керуй обсягом, спи, їж і роби розвантаження, коли результати постійно падають.',
    ],
    more: [
      [
        'Very heavy singles and max-effort sessions do feel draining, which is why most programs keep them rare and short.',
        'Дуже важкі одиночні повтори і тренування на максимум справді виснажують, тому більшість програм роблять їх рідкісними й короткими.',
      ],
    ],
    facets: {},
    chips: ['overtraining', 'deload', 'weaker_today'],
  },
  {
    id: 'k_detraining',
    ask: [
      'How fast do I lose muscle if I stop training?',
      'Як швидко я втрачу м’язи, якщо перестану тренуватися?',
    ],
    answer: [
      'Slower than you think. Two or three weeks off cost very little muscle — you may look flatter because of less water and glycogen, but that comes back within days. Strength drops a bit faster than size after about 3–4 weeks, and after months off, “muscle memory” helps you regain it much faster than it took to build. Even one or two short sessions a week keep most of what you have.',
      'Повільніше, ніж здається. Два-три тижні перерви майже не забирають м’язів — ти можеш виглядати «пласкішим» через менше води й глікогену, але це повертається за кілька днів. Сила падає трохи швидше за об’єм приблизно після трьох-чотирьох тижнів, а після місяців перерви «м’язова пам’ять» допомагає відновитися значно швидше, ніж ти будував. Навіть одне-два короткі тренування на тиждень зберігають більшість.',
    ],
    more: [
      [
        'Keep protein high and stay active during the break; when you return, start at about 70–80% of your old weights and build back over a few weeks.',
        'Під час перерви тримай високий білок і лишайся активним; після повернення починай приблизно з 70–80% колишніх ваг і нарощуй кілька тижнів.',
      ],
    ],
    facets: {},
    chips: ['comeback', 'k_maintenance', 'travel'],
  },
  {
    id: 'k_joint_supplements',
    ask: [
      'Do joint supplements like glucosamine or collagen work?',
      'Чи працюють добавки для суглобів — глюкозамін, колаген?',
    ],
    answer: [
      'The evidence is weak. Glucosamine and chondroitin show small or no effects for most people; collagen (10–15 g with some vitamin C about an hour before training) has some early evidence for tendons, but it isn’t magic. What reliably helps joints is sensible loading — gradual progression, good technique, strong muscles around the joint — plus sleep and a healthy body weight. Joint pain that keeps coming back deserves a check with a doctor or physio rather than a new supplement.',
      'Доказів мало. Глюкозамін і хондроїтин для більшості людей дають малий ефект або жодного; для колагену (10–15 г із вітаміном C приблизно за годину до тренування) є перші дані щодо сухожиль, але це не чарівна пігулка. Суглобам надійно допомагає розумне навантаження — поступова прогресія, добра техніка, сильні м’язи навколо суглоба — а також сон і здорова вага. Якщо суглоб болить знову й знову, варто показатися лікарю чи фізіотерапевту, а не шукати нову добавку.',
    ],
    more: [
      [
        'Fish oil may slightly ease joint stiffness for some people; check with a doctor if you take blood thinners.',
        'Риб’ячий жир може трохи зменшити скутість суглобів у деяких людей; порадься з лікарем, якщо приймаєш препарати, що розріджують кров.',
      ],
    ],
    facets: {},
    chips: ['tendon', 'k_fish_oil', 'k_arthritis'],
  },

  // ---- food and supplements ----
  {
    id: 'k_creatine_myths',
    ask: [
      'Does creatine cause hair loss, bloating or kidney problems?',
      'Чи креатин викликає випадіння волосся, набряки або проблеми з нирками?',
    ],
    answer: [
      'Creatine monohydrate is one of the most studied supplements and is safe for healthy people at 3–5 g a day. It adds water inside the muscles (often 1–2 kg on the scale), not the puffy bloating under the skin people fear. The hair-loss worry comes from a single small study that hasn’t been repeated, and it doesn’t harm healthy kidneys — it can raise the creatinine marker in blood tests, so tell your doctor you take it, and if you have kidney disease, ask first.',
      'Креатин моногідрат — одна з найкраще досліджених добавок і безпечний для здорових людей у дозі 3–5 г на день. Він додає воду всередині м’язів (часто 1–2 кг на вагах), а не набряклість під шкірою, якої всі бояться. Страх випадіння волосся походить з одного невеликого дослідження, яке не повторили, а здоровим ниркам він не шкодить — може підвищувати показник креатиніну в аналізах, тож скажи лікарю, що приймаєш, а якщо є хвороба нирок — спершу порадься.',
    ],
    more: [
      [
        'No loading phase needed: 3–5 g daily at any time of day fills the muscles in 3–4 weeks; loading with 20 g a day for 5–7 days just gets there faster.',
        'Фаза завантаження не потрібна: 3–5 г щодня в будь-який час насичують м’язи за 3–4 тижні; завантаження по 20 г на день протягом 5–7 днів лише пришвидшує це.',
      ],
    ],
    facets: {},
    chips: ['supplements', 'k_protein_powder', 'water'],
  },
  {
    id: 'k_protein_powder',
    ask: ['Which protein powder should I buy?', 'Який протеїн купити?'],
    answer: [
      'Protein powder is just convenient food — use it if it helps you hit your daily protein. Whey concentrate is cheap and effective; whey isolate has less lactose if dairy bothers you; for plant-based, choose a pea and rice blend. Pick a brand with third-party testing (like Informed Sport), check that one scoop gives about 20–25 g of protein, and choose a flavour you’ll actually drink.',
      'Протеїн — це просто зручна їжа: пий його, якщо він допомагає добрати денну норму білка. Концентрат сироваткового білка дешевий і ефективний; ізолят містить менше лактози, якщо молочне погано заходить; із рослинних обирай суміш гороху й рису. Бери бренд із незалежним тестуванням (наприклад, Informed Sport), перевір, що одна порція дає близько 20–25 г білка, і обирай смак, який реально питимеш.',
    ],
    more: [
      [
        'Casein digests slowly and suits the evening, but your total daily protein matters far more than the type.',
        'Казеїн засвоюється повільно й підходить на вечір, але загальний білок за день важить значно більше за тип.',
      ],
    ],
    facets: {},
    chips: ['protein', 'protein_timing', 'k_protein_per_meal'],
  },
  {
    id: 'k_protein_per_meal',
    ask: [
      'How much protein can my body absorb in one meal?',
      'Скільки білка засвоюється за один прийом їжі?',
    ],
    answer: [
      'You absorb practically all of it — the “30 grams per meal” limit is a myth. Bigger servings simply take longer to digest and are still used for building and repair. For convenience and appetite, spreading protein over 3–5 meals of roughly 0.4 g per kg of bodyweight each works well, but hitting your daily total is what counts most.',
      'Засвоюється практично весь — обмеження «30 грамів за прийом» це міф. Більша порція просто довше перетравлюється і все одно йде на побудову та відновлення. Для зручності й апетиту добре розподіляти білок на 3–5 прийомів приблизно по 0,4 г на кг ваги, але найбільше важить денна сума.',
    ],
    more: [
      [
        'A meal with 20–40 g of protein within a few hours of training is a sensible habit, not a strict window.',
        'Прийом їжі з 20–40 г білка протягом кількох годин після тренування — розумна звичка, а не жорстке вікно.',
      ],
    ],
    facets: {},
    chips: ['protein', 'protein_timing', 'meals_count'],
  },
  {
    id: 'k_intra_workout',
    ask: ['Should I drink something during my workout?', 'Чи треба щось пити під час тренування?'],
    answer: [
      'Water is enough for most sessions under about 60–75 minutes. For long or very hard sessions, a drink with carbs (about 30–60 g per hour) and a bit of sodium can help you keep your performance up, especially if you trained fasted or sweat a lot. Intra-workout BCAAs or EAAs add little if you eat enough protein during the day.',
      'Для більшості тренувань до 60–75 хвилин вистачає води. Для довгих або дуже важких сесій напій із вуглеводами (приблизно 30–60 г на годину) і трохи натрію допоможе тримати працездатність, особливо якщо тренуєшся натщесерце чи сильно пітнієш. BCAA чи EAA під час тренування мало що додають, якщо за день ти їси достатньо білка.',
    ],
    more: [
      [
        'Sip regularly rather than chugging, and weigh yourself before and after a long session: each kilo lost is roughly a litre to replace.',
        'Пий потроху регулярно, а не залпом, і зважся до і після довгого тренування: кожен втрачений кілограм — це приблизно літр, який треба відновити.',
      ],
    ],
    facets: {},
    chips: ['water', 'electrolytes', 'k_bcaa'],
  },
  {
    id: 'k_vitamin_d',
    ask: ['Should I take vitamin D?', 'Чи варто приймати вітамін D?'],
    answer: [
      'If you live far from the equator, spend little time in the sun or it’s winter, there’s a good chance your level is low, and low vitamin D is linked to worse bone health and immunity. A common safe dose is 1000–2000 IU a day, but the best move is a blood test so you know your level. It won’t boost your strength if your level is already fine, and very high doses without testing can do harm.',
      'Якщо живеш далеко від екватора, мало буваєш на сонці або зараз зима, дуже ймовірно, що рівень знижений, а низький вітамін D пов’язують з гіршим здоров’ям кісток та імунітетом. Поширена безпечна доза — 1000–2000 МО на день, але найкраще зробити аналіз крові, щоб знати свій рівень. Силу він не підвищить, якщо рівень і так нормальний, а дуже великі дози без аналізів можуть зашкодити.',
    ],
    more: [
      [
        'Take it with a meal that has some fat in it for better absorption.',
        'Приймай його під час їжі, де є трохи жиру, — так він краще засвоюється.',
      ],
    ],
    facets: {},
    chips: ['supplements', 'k_magnesium', 'k_osteoporosis'],
  },
  {
    id: 'k_magnesium',
    ask: ['Does magnesium help with sleep or cramps?', 'Чи допомагає магній зі сном або судомами?'],
    answer: [
      'Magnesium helps if you’re actually low — common when you eat few nuts, seeds, greens and whole grains, or sweat heavily. For sleep the evidence is modest, mostly in older adults or people with low intake; for exercise cramps it’s weak. If you try it, 200–400 mg of glycinate or citrate in the evening is typical; oxide is poorly absorbed and more likely to upset your stomach. Skip it with kidney disease unless your doctor agrees.',
      'Магній допомагає, якщо його справді бракує — таке часто буває, коли мало горіхів, насіння, зелені й цільнозернових, або при сильному потовиділенні. Для сну докази помірні, переважно в людей старшого віку чи з низьким споживанням; для судом під час тренувань — слабкі. Якщо хочеш спробувати, типово 200–400 мг гліцинату чи цитрату ввечері; оксид засвоюється погано й частіше подразнює шлунок. При хворобах нирок — лише з дозволу лікаря.',
    ],
    more: [
      [
        'Food first: a handful of pumpkin seeds or almonds, dark chocolate, beans and leafy greens cover a lot of your daily need.',
        'Спершу їжа: жменя гарбузового насіння чи мигдалю, чорний шоколад, бобові та листова зелень покривають значну частину денної потреби.',
      ],
    ],
    facets: {},
    chips: ['sleep_better', 'cramps', 'k_vitamin_d'],
  },
  {
    id: 'k_test_boosters',
    ask: ['Do testosterone boosters work?', 'Чи працюють бустери тестостерону?'],
    answer: [
      'Over-the-counter “test boosters” (tribulus, fenugreek, D-aspartic acid and the like) don’t meaningfully raise testosterone or muscle growth in healthy men. Ashwagandha may slightly lower stress and improve sleep, which can help training indirectly. The real levers are sleep, enough calories and fat, a healthy body-fat level and lifting; if you have symptoms of low testosterone, get a blood test from a doctor instead of buying pills.',
      'Безрецептурні «бустери тестостерону» (трибулус, пажитник, D-аспарагінова кислота тощо) суттєво не підвищують тестостерон чи ріст м’язів у здорових чоловіків. Ашваганда може трохи знизити стрес і покращити сон, що непрямо допомагає тренуванням. Справжні важелі — сон, достатньо калорій і жирів, здоровий відсоток жиру та силові; якщо є симптоми низького тестостерону — здай аналіз у лікаря, а не купуй пігулки.',
    ],
    more: [
      [
        'Some “boosters” turn out to be contaminated with banned substances — another reason to skip them if you compete or get tested.',
        'Деякі «бустери» бувають забруднені забороненими речовинами — ще одна причина їх уникати, якщо виступаєш або тебе тестують.',
      ],
    ],
    facets: {},
    chips: ['peds', 'supplements', 'sleep_better'],
  },
  {
    id: 'k_fat_burners',
    ask: ['Do fat burner pills work?', 'Чи працюють жироспалювачі?'],
    answer: [
      'Not in any way that matters. Most fat burners are mainly caffeine plus extras; at best they add a few dozen burned calories a day and slightly blunt your appetite. Some have caused liver damage or heart problems, or contained banned stimulants. A moderate calorie deficit, plenty of protein, lifting and daily steps do the actual work — spend the money on good food instead.',
      'Ні в тому сенсі, який має значення. Більшість жироспалювачів — це переважно кофеїн плюс домішки; у кращому разі вони додають кілька десятків спалених калорій на день і трохи притлумлюють апетит. Деякі спричиняли ураження печінки чи проблеми із серцем або містили заборонені стимулятори. Реальну роботу роблять помірний дефіцит калорій, багато білка, силові й щоденні кроки — краще витрать гроші на добру їжу.',
    ],
    more: [
      [
        'If you have heart or blood-pressure problems, avoid stimulant products entirely.',
        'Якщо є проблеми із серцем чи тиском — повністю уникай стимуляторів.',
      ],
    ],
    facets: {},
    chips: ['fat_loss', 'cut_deficit', 'steps'],
  },
];
