import type { Facet } from './types';
export interface NewTopic {
  id: string;
  ask: [string, string];
  answer: [string, string];
  more: [string, string][];
  facets: Partial<Record<Facet, [string, string]>>;
}
/** Answers only — the phrasings live in topicsNewEx.ts (they feed the understanding index, not the chat bundle). */
export const NEW_TOPICS: NewTopic[] = [
  {
    id: 'k_bench_arch',
    ask: [
      'Should I arch my back on bench press?',
      'Чи треба робити прогин у спині на жимі лежачи?',
    ],
    answer: [
      'A moderate arch is normal and useful: it keeps your shoulder blades pinned, shortens the bar path a little and puts the shoulders in a safer position. Keep your glutes on the bench and your feet planted, and build the arch from your upper back rather than cranking the lower back. If it feels pinchy in the lower back, flatten it out a bit — a small arch is still an arch.',
      'Помірний прогин — це нормально і навіть корисно: лопатки зафіксовані, амплітуда трохи коротша, а плечі в безпечнішому положенні. Сідниці тримай на лавці, ноги впирай у підлогу, а прогин формуй переважно грудним відділом, а не поперекою. Якщо в попереку тисне — зменш прогин, навіть невеликий уже працює.',
    ],
    more: [
      [
        'For bodybuilding-style benching a slight arch plus retracted shoulder blades is plenty; the big powerlifting arch mainly exists to shorten range under competition rules.',
        'Для жиму «на м’язи» достатньо легкого прогину і зведених лопаток; великий пауерліфтерський прогин потрібен переважно для того, щоб скоротити амплітуду за правилами змагань.',
      ],
      [
        'Set it up in order: squeeze the shoulder blades together and down, lift the chest towards the bar, then drive the feet into the floor so the tension carries through the whole set.',
        'Налаштовуйся по черзі: зведи й опусти лопатки, підніми груди до грифа, потім упрись ногами в підлогу — так напруга тримається весь підхід.',
      ],
    ],
    facets: {
      why: [
        'An arch keeps the shoulder blades locked and the chest high, which gives you a stable base and takes stress off the front of the shoulder.',
        'Прогин тримає лопатки зафіксованими, а груди високо — це стабільна опора і менше навантаження на передню частину плеча.',
      ],
      how: [
        'Pull the shoulder blades back and down, lift your chest, tuck your feet under or plant them flat, and keep your glutes touching the bench.',
        'Зведи й опусти лопатки, підніми груди, постав ноги під себе або рівно на підлогу і не відривай сідниці від лавки.',
      ],
      should: [
        'Yes, a moderate one. If you have lower-back discomfort, keep it small and focus on the upper-back position instead.',
        'Так, помірний. Якщо є дискомфорт у попереку — роби менший прогин і зосередься на положенні лопаток.',
      ],
    },
  },
  {
    id: 'k_deadlift_rounding',
    ask: [
      'My back rounds on deadlifts — how do I fix it?',
      'У мене круглиться спина на становій — як виправити?',
    ],
    answer: [
      "A little upper-back rounding under heavy load is common, but if your lower back visibly flexes, the weight is probably too heavy for your current position. Drop the load 10–20%, take the slack out of the bar before it leaves the floor, brace hard and think of pushing the floor away rather than yanking. Filming from the side is the easiest way to see what's really happening; if it causes pain, stop and get it checked.",
      'Невелике округлення грудного відділу під великою вагою трапляється часто, але якщо помітно круглиться поперек — вага, найімовірніше, завелика для твоєї нинішньої позиції. Скинь 10–20%, перед відривом «вибери слабину» грифа, напружся корпусом і думай, що відштовхуєш підлогу, а не смикаєш штангу. Найпростіше побачити, що відбувається, — зняти себе збоку; якщо з’являється біль, зупинись і покажися спеціалісту.',
    ],
    more: [
      [
        'Common causes: starting with hips too low or too high, the bar drifting away from the shins, not bracing before the pull, and simply chasing weight too fast.',
        'Типові причини: таз занадто низько або високо на старті, гриф відходить від гомілок, немає напруги корпусу перед тягою і надто швидке нарощування ваги.',
      ],
      [
        'Useful fixes: paused deadlifts just off the floor, Romanian deadlifts to learn the hinge, and block pulls or a trap bar while you build the position.',
        'Що допомагає: станова з паузою трохи над підлогою, румунська тяга для відчуття руху тазом і тяга з плінтів або трап-гриф, поки відпрацьовуєш позицію.',
      ],
    ],
    facets: {
      why: [
        'Usually the load outruns your ability to hold position — weak bracing, poor setup or the bar drifting forward.',
        'Зазвичай вага випереджає здатність тримати позицію: слабке напруження корпусу, поганий старт або гриф відходить вперед.',
      ],
      how: [
        "Lighter weight, bar over mid-foot, lats tight ('bend the bar'), big breath and brace, pull the slack out, then push the floor away.",
        'Менша вага, гриф над серединою стопи, широчайші напружені («зігни гриф»), глибокий вдих і напруга, вибери слабину — і відштовхуй підлогу.',
      ],
      should: [
        "You should stop a set when the lower back starts to round noticeably — that rep isn't worth it.",
        'Варто зупиняти підхід, коли поперек помітно круглиться, — такий повтор не вартий ризику.',
      ],
    },
  },
  {
    id: 'k_knees_cave',
    ask: [
      'My knees cave in when I squat — what do I do?',
      'У мене коліна зводяться всередину при присіданні — що робити?',
    ],
    answer: [
      "Knees drifting inwards (valgus) is common, especially on the way up from the bottom or when the weight gets heavy. Cue 'spread the floor' or push the knees out in line with your toes, try a slightly wider stance with toes turned out 15–30°, and drop the weight until you can keep the line. A little inward movement at max effort isn't automatically dangerous, but if it comes with knee pain, get it assessed.",
      'Зведення колін (вальгус) трапляється часто — особливо на підйомі з низу або коли вага важка. Думай «розсунь підлогу» чи виводь коліна по лінії носків, спробуй трохи ширшу постановку з розвернутими на 15–30° стопами і зменш вагу, поки не тримаєш лінію. Невелике зведення на максимальному зусиллі не обов’язково небезпечне, але якщо болять коліна — покажися спеціалісту.',
    ],
    more: [
      [
        "Often it's a strength or habit issue rather than 'weak glutes' alone: adductors and glutes both work hard out of the hole, and technique practice with lighter loads fixes a lot.",
        'Часто це питання сили й звички, а не лише «слабких сідниць»: з низу сильно працюють і привідні, і сідничні м’язи, а практика техніки з меншою вагою виправляє багато чого.',
      ],
      [
        'Helpful drills: goblet squats with a pause at the bottom, tempo squats, and light band-around-the-knees squats as a reminder — not as a permanent crutch.',
        'Корисні вправи: гоблет-присід із паузою внизу, присід у повільному темпі й легкий присід із мінібендом на колінах як нагадування — але не постійна милиця.',
      ],
    ],
    facets: {
      why: [
        "It usually happens when the load is near your limit, stance or foot position doesn't suit you, or ankle mobility limits depth.",
        'Зазвичай це відбувається, коли вага близька до межі, постановка ніг тобі не підходить або обмежена рухливість гомілкостопу.',
      ],
      how: [
        'Screw the feet into the floor, keep the whole foot planted, knees track over the toes, and practice with a pause at the bottom.',
        '«Вкрути» стопи в підлогу, тримай усю стопу на підлозі, коліна йдуть по лінії носків, відпрацьовуй присід із паузою внизу.',
      ],
      should: [
        'Should you worry? Occasional slight caving on a grinder is normal; consistent caving on easy reps is worth fixing.',
        'Чи хвилюватися? Легке зведення на найважчому повторі — нормально; постійне зведення навіть на легких повторах варто виправити.',
      ],
    },
  },
  {
    id: 'k_butt_wink',
    ask: [
      'What is butt wink and should I worry about it?',
      'Що таке «підкручування таза» внизу присіду і чи варто хвилюватися?',
    ],
    answer: [
      "Butt wink is the pelvis tucking under and the lower back rounding a bit at the very bottom of a deep squat. A small amount is normal and harmless for most people, especially without heavy load. If it's large, happens under heavy weight or comes with discomfort, squat to just above the point where it starts, check ankle mobility and stance width, and keep your brace tight at the bottom.",
      'Це коли внизу глибокого присіду таз підкручується, а поперек трохи округлюється. Невелике підкручування — нормальне й нешкідливе для більшості людей, особливо без великої ваги. Якщо воно сильне, з’являється під важкою вагою або дає дискомфорт — присідай трохи вище точки, де воно починається, перевір рухливість гомілкостопу й ширину постановки і тримай напругу корпусу внизу.',
    ],
    more: [
      [
        'Anatomy matters: hip socket depth and orientation differ between people, so a wider stance with toes out often gives more room before the pelvis tucks.',
        'Анатомія має значення: глибина й орієнтація кульшових западин у всіх різні, тож ширша постановка з розвернутими стопами часто дає більше простору до підкручування.',
      ],
      [
        'Heeled shoes or small plates under the heels can help if ankle dorsiflexion is the limiter; goblet squats are a good place to find your depth.',
        'Взуття з підбором або невеликі млинці під п’ятами допоможуть, якщо обмежує гомілкостоп; гоблет-присід — гарний спосіб знайти свою глибину.',
      ],
    ],
    facets: {
      what: [
        "It's posterior pelvic tilt at the bottom of a squat — the tailbone tucks under and the lower back loses a bit of its arch.",
        'Це задній нахил таза внизу присіду: куприк підгортається, і поперек трохи втрачає природний прогин.',
      ],
      should: [
        'A little, unloaded or light: no. A lot, under heavy load or with pain: squat slightly higher and work on position.',
        'Трохи і з легкою вагою — ні. Сильно, під важкою вагою або з болем — присідай трохи вище і працюй над позицією.',
      ],
      how: [
        'Film from the side, find where the tuck starts, stop just above it, and test a wider stance or heel elevation.',
        'Зніми себе збоку, знайди, де починається підкручування, зупиняйся трохи вище і спробуй ширшу постановку або підняті п’яти.',
      ],
    },
  },
  {
    id: 'k_ohp_lean',
    ask: [
      'I lean back too much on overhead press — how do I fix it?',
      'Я сильно відхиляюся назад на армійському жимі — як виправити?',
    ],
    answer: [
      "Some lean is needed to get your head out of the bar's path, but a big lower-back arch means you're turning it into an incline press. Squeeze your glutes and brace your abs hard, keep your ribs down, and move your head back briefly then 'through the window' once the bar passes your forehead. If you can't hold the position, drop the weight; tight shoulders or lats can also force the lean, so work on overhead mobility too.",
      'Невеликий нахил потрібен, щоб прибрати голову з траєкторії грифа, але сильний прогин у попереку перетворює вправу на жим під кутом. Стисни сідниці, сильно напруж прес, тримай ребра «опущеними», а голову ненадовго відведи назад і «просунь у вікно», щойно гриф пройде лоб. Якщо позиція не тримається — зменш вагу; також відхилення можуть спричиняти скуті плечі чи широчайші, тож попрацюй над рухливістю над головою.',
    ],
    more: [
      [
        'A slightly narrower grip with forearms vertical and the bar starting on the upper chest gives a straighter path and less need to lean.',
        'Трохи вужчий хват із вертикальними передпліччями і стартом грифа на верхній частині грудей дає пряміший шлях і меншу потребу відхилятися.',
      ],
      [
        'Seated or half-kneeling dumbbell presses are great for teaching a stacked ribcage, because leaning back is harder to cheat.',
        'Жим гантелей сидячи або з одного коліна добре вчить тримати ребра над тазом, бо відхилитися там складніше.',
      ],
    ],
    facets: {
      why: [
        "Usually the load is too heavy, the glutes and abs aren't braced, or shoulder mobility is limited.",
        'Зазвичай вага завелика, сідниці й прес не напружені або обмежена рухливість плечей.',
      ],
      how: [
        'Glutes tight, ribs down, bar close to the face, head back then forward under the bar at lockout.',
        'Сідниці напружені, ребра опущені, гриф близько до обличчя, голова назад, а на вершині — вперед під гриф.',
      ],
      should: [
        'A small lean is fine; a big lower-back hyperextension under load is worth fixing.',
        'Невеликий нахил — нормально; сильний прогин попереку під вагою варто виправити.',
      ],
    },
  },
  {
    id: 'k_sumo_conventional',
    ask: ['Sumo or conventional deadlift?', 'Станова сумо чи класика?'],
    answer: [
      "Neither is 'cheating' or strictly better — pick the one that fits your build and lets you hold a good position. Sumo keeps the torso more upright and loads the quads and adductors more; conventional loads the hamstrings and back more. Try both for a few weeks with moderate weights and keep the one where you feel stronger and more comfortable.",
      'Жоден варіант не є «читингом» і не кращий сам по собі — обирай той, що пасує твоїй статурі й дає тримати правильну позицію. Сумо дозволяє тримати корпус вертикальніше і більше навантажує квадрицепси й привідні; класика більше навантажує задню поверхню стегна і спину. Спробуй обидва по кілька тижнів з помірною вагою і залиш той, у якому почуваєшся сильнішим і зручніше.',
    ],
    more: [
      [
        "Long arms and a shorter torso often suit conventional; people with a longer torso or good hip mobility often find sumo easier — but it's a tendency, not a rule.",
        'Довгі руки й коротший корпус часто пасують класиці; людям із довшим корпусом або хорошою рухливістю тазостегнових часто легше в сумо — але це тенденція, а не правило.',
      ],
      [
        'You can keep the other style as an accessory: many sumo pullers use conventional or Romanian deadlifts to build the back, and vice versa.',
        'Інший стиль можна лишити як допоміжну вправу: багато «сумоїстів» роблять класику або румунську тягу для спини, і навпаки.',
      ],
    ],
    facets: {
      should: [
        'Choose by comfort and position, not by what others say. If you compete, both are legal.',
        'Обирай за комфортом і позицією, а не за чужою думкою. На змаганнях дозволені обидва стилі.',
      ],
      why: [
        'Different stances change the leverages: sumo shortens the range and keeps you upright, conventional puts more work on the posterior chain.',
        'Постановка змінює важелі: сумо коротшає амплітуду й тримає корпус вертикальніше, класика більше навантажує задній ланцюг.',
      ],
      how: [
        'For sumo: wide stance, shins close to vertical, knees out, grip inside the legs. For conventional: hip-width stance, grip just outside the shins.',
        'Сумо: широка постановка, гомілки майже вертикальні, коліна назовні, хват між ногами. Класика: ноги на ширині таза, хват одразу за гомілками.',
      ],
    },
  },
  {
    id: 'k_row_lower_back',
    ask: [
      'My lower back gets tired from barbell rows — what should I change?',
      'Від тяги штанги в нахилі втомлюється поперек — що змінити?',
    ],
    answer: [
      "Bent-over rows do load the lower back isometrically, so some fatigue is expected, but it shouldn't be the limiter. Lighten the weight, stop jerking the bar with your hips, and brace hard while keeping a fixed torso angle. If your back still gives out first, switch to chest-supported rows, seal rows or one-arm dumbbell rows — they train the upper back just as well without the lower-back cost.",
      'Тяга в нахилі справді статично навантажує поперек, тож певна втома очікувана, але вона не має бути обмежувачем. Зменш вагу, не смикай штангу тазом і тримай корпус напруженим під сталим кутом. Якщо спина все одно здається першою — переходь на тягу з упором грудьми, тягу лежачи на лавці або тягу гантелі однією рукою: вони так само добре тренують верх спини без навантаження на поперек.',
    ],
    more: [
      [
        'If you deadlift and squat in the same session, rows at the end add up — scheduling rows on a different day or picking a supported variation helps recovery.',
        'Якщо станова і присід в тому ж тренуванні, тяга наприкінці додає навантаження — постав тягу в інший день або обери варіант з упором, це полегшить відновлення.',
      ],
      [
        'A Pendlay-style row (bar returns to the floor each rep) gives the lower back a short break between reps.',
        'Тяга Пендлі (штанга щоразу повертається на підлогу) дає попереку коротку паузу між повторами.',
      ],
    ],
    facets: {
      why: [
        'Your spinal erectors hold you in the hinge for the whole set, and heavy loads or body English make that much harder.',
        'Розгиначі спини тримають тебе в нахилі весь підхід, а велика вага чи розгойдування роблять це значно важчим.',
      ],
      how: [
        'Hinge to about 30–45°, brace, pull the bar to the lower ribs, no hip swing. Or use a bench for chest support.',
        'Нахил приблизно 30–45°, напруга корпусу, тягни гриф до нижніх ребер, без ривка тазом. Або спирайся грудьми на лавку.',
      ],
      should: [
        "If rows always hurt your lower back, you should swap them — there's nothing special you'd lose.",
        'Якщо тяга постійно болить у попереку — варто її замінити, нічого унікального ти не втратиш.',
      ],
    },
  },
  {
    id: 'k_sleeves_wraps',
    ask: ['Do I need knee sleeves or wrist wraps?', 'Чи потрібні наколінники або кистьові бинти?'],
    answer: [
      "Neither is required. Knee sleeves keep the knees warm and can make squats feel more comfortable; wrist wraps support the wrist on heavy pressing if your wrists bend back or ache. They're worth using if they help you feel better on heavy sets, but they don't replace good technique or sensible loading — and persistent joint pain is something to get checked, not just wrap up.",
      'Жодне з цього не обов’язкове. Наколінники зігрівають коліна і можуть зробити присід комфортнішим; кистьові бинти підтримують зап’ястя на важких жимах, якщо кисть заламується чи ниє. Користуватися варто, якщо з ними тобі краще на важких підходах, але вони не замінюють техніку й розумну вагу — а постійний біль у суглобах треба перевірити, а не просто замотати.',
    ],
    more: [
      [
        "Sleeves (neoprene, 5–7 mm) are for warmth and comfort; stiff knee wraps are a powerlifting tool that adds rebound and aren't needed for general training.",
        'Наколінники (неопрен 5–7 мм) дають тепло й комфорт; жорсткі бинти на коліна — інструмент пауерліфтингу для «відскоку», у звичайному тренуванні вони не потрібні.',
      ],
      [
        'For wrists, first try keeping the bar low in the palm over the forearm; if they still hurt, wraps on top sets only is a reasonable approach.',
        'Для зап’ясть спершу спробуй тримати гриф нижче в долоні, над передпліччям; якщо все одно болить — бинти лише на важких підходах цілком розумно.',
      ],
    ],
    facets: {
      should: [
        'Use them if they help your comfort on heavy work; skip them for warm-ups and light sets.',
        'Користуйся, якщо вони додають комфорту на важких підходах; на розминці й легких підходах вони не потрібні.',
      ],
      when: [
        'Typically on top sets of squats (sleeves) and heavy bench or overhead press (wrist wraps).',
        'Зазвичай на робочих підходах присіду (наколінники) та важкому жимі лежачи чи над головою (бинти на кисті).',
      ],
      why: [
        'Sleeves add warmth and compression; wraps limit the wrist bending back under load.',
        'Наколінники дають тепло й компресію; бинти обмежують заламування кисті під вагою.',
      ],
    },
  },
  {
    id: 'k_chalk',
    ask: ['Should I use chalk?', 'Чи варто користуватися магнезією?'],
    answer: [
      "Chalk (magnesium carbonate) dries sweat and improves friction, so it's one of the cheapest ways to hold heavier deadlifts, rows and pull-ups. Use it on the palms and fingers for heavy pulling; it also helps the bar stay put on your back for squats. If your gym bans loose chalk, a chalk ball or liquid chalk makes far less mess.",
      'Магнезія (карбонат магнію) висушує піт і збільшує тертя, тож це один із найдешевших способів утримати важчу станову, тяги й підтягування. Наноси на долоні й пальці перед важкими тягами; вона також допомагає штанзі не ковзати по спині на присіді. Якщо в залі заборонена розсипна магнезія — мішечок-кулька або рідка магнезія майже не смітять.',
    ],
    more: [
      [
        "Chalk doesn't train your grip — it just removes slippage. Pair it with some no-chalk, no-strap grip work if grip is a weakness.",
        'Магнезія не тренує хват — вона лише прибирає ковзання. Якщо хват слабкий, додай окрему роботу на хват без магнезії й лямок.',
      ],
      [
        'Wash or moisturise afterwards if your hands crack; chalk dries skin, and calluses tearing is more about how you hold the bar than chalk itself.',
        'Після тренування мий руки й користуйся кремом, якщо шкіра тріскається: магнезія сушить шкіру, а зривання мозолів більше залежить від того, як тримаєш гриф.',
      ],
    ],
    facets: {
      should: [
        'Yes for heavy pulls and pull-ups if slipping is an issue; skip it for machines and light work.',
        'Так — для важких тяг і підтягувань, якщо руки ковзають; для тренажерів і легкої роботи вона не потрібна.',
      ],
      how: [
        'A thin layer on the palms and the inside of the fingers; tap off the excess. Liquid chalk goes on first and dries in a minute.',
        'Тонкий шар на долоні й внутрішній бік пальців, надлишок струси. Рідку магнезію наносять заздалегідь, вона висихає за хвилину.',
      ],
      when: [
        'On working sets of deadlifts, rows, pull-ups, kettlebell work and heavy squats.',
        'На робочих підходах станової, тяг, підтягувань, гирьових вправ і важкого присіду.',
      ],
    },
  },
  {
    id: 'k_smith_machine',
    ask: ['Is the Smith machine bad?', 'Чи погана машина Сміта?'],
    answer: [
      "No — it's just a different tool. The fixed bar path means less balance demand, which makes it handy for hypertrophy work, learning a movement, or training safely without a spotter. The trade-off is that it doesn't train stabilising and bar-path control like free weights, and weights don't transfer one-to-one, so use it for what it's good at and set your feet where the fixed path feels natural.",
      'Ні — це просто інший інструмент. Фіксована траєкторія зменшує вимоги до балансу, тож машина зручна для роботи на м’язи, освоєння руху чи тренування без страхувальника. Мінус у тому, що вона не тренує стабілізацію й контроль траєкторії, як вільна вага, і ваги не переносяться один в один — тож використовуй її там, де вона доречна, і став ноги так, щоб фіксована траєкторія була природною.',
    ],
    more: [
      [
        'Great Smith uses: split squats, incline press, calf raises, and squats with feet slightly forward to bias the quads.',
        'Вдалі вправи в Сміті: болгарські присідання, жим під кутом, підйоми на носки і присід із ногами трохи вперед для акценту на квадрицепс.',
      ],
      [
        'Many Smith bars are counterbalanced, so the bar may weigh less than 20 kg — log it consistently rather than comparing with your barbell numbers.',
        'Гриф у багатьох машинах Сміта врівноважений і може важити менше за 20 кг — записуй вагу послідовно й не порівнюй з вільною штангою.',
      ],
    ],
    facets: {
      should: [
        'Use it if it fits your goal — muscle growth, safety when alone, or working around balance limits.',
        'Використовуй, якщо це відповідає меті: ріст м’язів, безпека без страхувальника чи обхід обмежень із балансом.',
      ],
      why: [
        "The rails remove balance and let you focus on the target muscle; that's also why strength transfers less to free-weight lifts.",
        'Напрямні прибирають потребу в балансі й дозволяють зосередитися на цільовому м’язі — через це ж сила гірше переноситься на вільну вагу.',
      ],
      how: [
        'Set the safety stops, find a foot position where the path feels natural, and progress it like any other exercise.',
        'Постав обмежувачі, знайди положення ніг, у якому траєкторія природна, і прогресуй, як у будь-якій іншій вправі.',
      ],
    },
  },
  {
    id: 'k_test_max',
    ask: [
      'How do I test my one-rep max safely?',
      'Як безпечно перевірити свій одноповторний максимум?',
    ],
    answer: [
      "Test after a few lighter days, not at the end of a hard block. Warm up with gradually heavier singles (roughly 50%, 70%, 80%, 90% of your expected max), then take 1–3 attempts in small jumps with 3–5 minutes' rest. Use safety pins or a spotter, stop when the bar speed slows to a grind or form breaks, and remember an estimated max from a solid set of 3–5 is often just as useful and much less risky.",
      'Перевіряй після кількох легших днів, а не наприкінці важкого блоку. Розминайся поодинокими повторами з поступовим зростанням ваги (приблизно 50%, 70%, 80%, 90% від очікуваного максимуму), далі 1–3 спроби з невеликим кроком і відпочинком 3–5 хвилин. Став страхувальні упори або клич страхувальника, зупиняйся, коли штанга йде дуже повільно або ламається техніка, і пам’ятай: розрахунковий максимум із якісного підходу на 3–5 повторів часто так само корисний і значно безпечніший.',
    ],
    more: [
      [
        "Pick your first attempt as something you'd be confident hitting on a bad day; the second is a small PR or near it; a third only if the second moved well.",
        'Першу спробу бери таку, яку впевнено піднімеш навіть у поганий день; друга — невеликий рекорд або близько до нього; третя — тільки якщо друга пішла легко.',
      ],
      [
        'Beginners gain little from testing true maxes — their strength is rising every week anyway, and technique under max load is still unreliable.',
        'Новачкам тестування справжнього максимуму дає мало: сила й так росте щотижня, а техніка під граничною вагою ще нестабільна.',
      ],
    ],
    facets: {
      how: [
        'Rested, warmed up with singles, small jumps, 3–5 min rest, safeties set, stop at the first grinder.',
        'Відпочилим, після розминки одиночними, з невеликим кроком, 3–5 хв відпочинку, зі страховкою, зупинка на першому дуже важкому повторі.',
      ],
      when: [
        'Every 8–16 weeks at most, typically after a deload or at the end of a peaking block.',
        'Не частіше ніж раз на 8–16 тижнів, зазвичай після розвантаження або в кінці пікового блоку.',
      ],
      should: [
        'Only if you actually need the number; an estimated max from reps is fine for setting training weights.',
        'Тільки якщо число справді потрібне; для розрахунку робочих ваг вистачить оцінки з повторів.',
      ],
    },
  },
  {
    id: 'k_shift_work',
    ask: [
      'How do I train around shift work or night shifts?',
      'Як тренуватися при змінному графіку чи нічних змінах?',
    ],
    answer: [
      "Anchor training to your sleep, not the clock: train after your main sleep block, when you're most awake, rather than straight after a long night shift. Keep a flexible plan — for example 3 full-body sessions you can do on any day — and on rough days do a shorter version instead of skipping entirely. Protect sleep with a dark, quiet room and consistent caffeine cut-off, because recovery is usually the real bottleneck.",
      'Прив’язуй тренування до сну, а не до годинника: тренуйся після основного сну, коли найбільш бадьорий, а не одразу після довгої нічної зміни. Тримай гнучкий план — наприклад, 3 тренування на все тіло, які можна зробити в будь-який день, — а в тяжкі дні роби скорочену версію замість пропуску. Бережи сон: темна тиха кімната й сталий час останньої кави, бо саме відновлення зазвичай найслабша ланка.',
    ],
    more: [
      [
        'Rotating shifts are harder than fixed nights; on changeover days, a light session or a walk is often a better choice than a heavy one.',
        'Ротаційний графік важчий за постійні нічні; у дні переходу між змінами легке тренування чи прогулянка часто кращі за важке.',
      ],
      [
        'Expect performance to wobble with sleep debt — autoregulate with RPE rather than forcing fixed numbers.',
        'Будь готовий, що результати гулятимуть через недосип — регулюй навантаження за RPE, а не тисни фіксовані цифри.',
      ],
    ],
    facets: {
      when: [
        'Ideally a few hours after waking from your main sleep; avoid hard training right before you need to sleep.',
        'Найкраще через кілька годин після пробудження з основного сну; уникай важкого тренування просто перед сном.',
      ],
      how: [
        'Use a flexible full-body plan, keep sessions 45–60 minutes, and scale down on low-sleep days.',
        'Гнучка програма на все тіло, тренування по 45–60 хвилин і менший обсяг у дні, коли мало спав.',
      ],
      should: [
        'You should prioritise consistency over perfect timing — two or three sessions a week still build progress.',
        'Регулярність важливіша за ідеальний час — два-три тренування на тиждень теж дають прогрес.',
      ],
    },
  },
  {
    id: 'k_maintenance',
    ask: [
      "What's the minimum training to keep my gains?",
      'Який мінімум тренувань, щоб не втратити результат?',
    ],
    answer: [
      "Less than you'd think: research suggests you can maintain strength and muscle for months with about a third of your usual volume, as long as you keep the intensity — heavy-ish sets taken close to failure. In practice, one or two full-body sessions a week with 1–3 hard sets per major muscle group holds most of your progress. Keep protein high and it's even easier.",
      'Менше, ніж здається: дослідження показують, що силу й м’язи можна утримувати місяцями приблизно з третиною звичного обсягу, якщо зберігати інтенсивність — досить важкі підходи близько до відмови. На практиці одне-два тренування на все тіло на тиждень по 1–3 важкі підходи на кожну велику групу утримують більшість прогресу. А з достатнім білком — ще легше.',
    ],
    more: [
      [
        'A sample 30-minute maintenance session: squat or leg press, a press, a row or pull-up, and a hinge — 2–3 hard sets each.',
        'Приклад підтримувального тренування на 30 хвилин: присід або жим ногами, жим, тяга чи підтягування і тяга з нахилом — по 2–3 важкі підходи.',
      ],
      [
        "Strength fades slower than your 'pump' and size appearance; some visual flatness in the first week or two is mostly water and glycogen.",
        'Сила зникає повільніше, ніж «наповненість» м’язів; легка «пласкість» у перші тиждень-два — це переважно вода й глікоген.',
      ],
    ],
    facets: {
      howMuch: [
        'Roughly 1–2 sessions a week, a few hard sets per muscle group, keeping loads heavy.',
        'Приблизно 1–2 тренування на тиждень, кілька важких підходів на групу м’язів, вагу не знижувати.',
      ],
      when: [
        'Useful in busy periods, exams, travel, a new baby, or while focusing on another sport.',
        'Корисно в завантажені періоди: сесія, відрядження, народження дитини чи фокус на іншому спорті.',
      ],
      why: [
        'Maintaining needs a much smaller stimulus than building — intensity is the part you must keep.',
        'Для підтримки потрібен значно менший стимул, ніж для росту, — головне зберегти інтенсивність.',
      ],
    },
  },
  {
    id: 'k_holidays',
    ask: [
      'How do I handle training and eating over the holidays?',
      'Як тренуватися й харчуватися у свята?',
    ],
    answer: [
      "Aim to maintain, not to be perfect. Plan short sessions around the busiest days (even 2 full-body workouts in a week is great), stay active with walks, and keep protein at each meal so the extra food works partly in your favour. One or two big dinners won't undo months of work — the scale jump afterwards is mostly water and food, and it settles within days.",
      'Мета — втримати форму, а не бути ідеальним. Сплануй короткі тренування навколо найзайнятіших днів (навіть 2 тренування на все тіло за тиждень — це чудово), рухайся й гуляй і тримай білок у кожному прийомі їжі, щоб зайва їжа частково працювала на тебе. Одна-дві великі вечері не зруйнують місяці роботи — стрибок на вагах після них переважно вода і їжа, і за кілька днів він зникає.',
    ],
    more: [
      [
        'If the gym is closed, a quick bodyweight circuit (squats, push-ups, lunges, rows with a backpack) keeps the habit alive.',
        'Якщо зал зачинений, коротке коло з власною вагою (присідання, віджимання, випади, тяга рюкзака) допоможе не втратити звичку.',
      ],
      [
        'A planned week off over the holidays can double as a deload — many people come back feeling stronger.',
        'Запланований тиждень без залу у свята може стати розвантаженням — багато хто повертається навіть сильнішим.',
      ],
    ],
    facets: {
      how: [
        "Short sessions, daily walks, protein first at meals, and don't try to 'earn' food with punishing workouts.",
        'Короткі тренування, щоденні прогулянки, спершу білок у тарілці — і не треба «відпрацьовувати» їжу виснажливими тренуваннями.',
      ],
      should: [
        "It's fine to enjoy the food — just return to your normal routine right after.",
        'Насолоджуватися святковою їжею — нормально; просто одразу після свят повертайся до звичного режиму.',
      ],
      why: [
        'Consistency across the year matters far more than a few days of overeating.',
        'Регулярність протягом року важить значно більше, ніж кілька днів переїдання.',
      ],
    },
  },
  {
    id: 'k_heat',
    ask: ['How should I train in hot weather?', 'Як тренуватися в спеку?'],
    answer: [
      "Heat raises heart rate and makes everything feel harder, so expect slightly lower performance and adjust by effort, not by fixed numbers. Train in the cooler part of the day, drink before you're thirsty, add electrolytes on long sweaty sessions, and extend rest periods. Stop and cool down if you feel dizzy, nauseous, confused or stop sweating — those are warning signs of heat illness and need attention.",
      'Спека підвищує пульс і робить усе важчим, тож очікуй трохи нижчих результатів і орієнтуйся на відчуття зусилля, а не на фіксовані цифри. Тренуйся в прохолоднішу частину дня, пий до того, як захочеш пити, додавай електроліти на довгих пітливих тренуваннях і відпочивай довше між підходами. Якщо паморочиться, нудить, плутаються думки або перестаєш пітніти — зупинись і охолонь: це тривожні ознаки теплового удару, які потребують уваги.',
    ],
    more: [
      [
        'Heat acclimatisation takes about 1–2 weeks of regular exposure; performance improves as your body adapts.',
        'Адаптація до спеки займає приблизно 1–2 тижні регулярного перебування в ній; з часом результати покращуються.',
      ],
      [
        'Weigh yourself before and after a long session: roughly 1–1.5 litres of fluid for each kilogram lost is a practical rehydration target.',
        'Зважся до і після довгого тренування: приблизно 1–1,5 літра рідини на кожен втрачений кілограм — практичний орієнтир для відновлення.',
      ],
    ],
    facets: {
      how: [
        'Cooler hours, lighter clothes, more water and electrolytes, longer rests, and lower targets by RPE.',
        'Прохолодніші години, легкий одяг, більше води й електролітів, довший відпочинок і нижчі цілі за RPE.',
      ],
      when: [
        'Early morning or evening, or indoors with air conditioning on very hot days.',
        'Рано-вранці чи ввечері, а в дуже спекотні дні — у приміщенні з кондиціонером.',
      ],
      should: [
        'Should you skip? On extreme days, move the session indoors or make it lighter rather than pushing through.',
        'Чи пропускати? В екстремальну спеку перенеси тренування в приміщення або зроби його легшим, а не тисни через силу.',
      ],
    },
  },
  {
    id: 'k_teen_lifting',
    ask: ['Is lifting weights safe for teenagers?', 'Чи безпечно підліткам тренуватися з вагами?'],
    answer: [
      "Yes — supervised strength training is considered safe and beneficial for teenagers, and it doesn't stunt growth; that's a myth. The priorities are learning technique with light loads, progressing gradually, avoiding max-out attempts early on, and having a qualified coach or experienced adult supervise. Sleep and enough food matter a lot at this age, and any pain around joints or growth plates should be checked by a doctor rather than trained through.",
      'Так — силові тренування під наглядом вважаються безпечними й корисними для підлітків, і ріст вони не зупиняють: це міф. Головне — вчити техніку з невеликою вагою, прогресувати поступово, не йти на максимуми на початку і тренуватися під наглядом кваліфікованого тренера чи досвідченого дорослого. У цьому віці дуже важливі сон і достатнє харчування, а будь-який біль біля суглобів чи зон росту варто показати лікарю, а не терпіти.',
    ],
    more: [
      [
        'A good start: 2–3 full-body sessions a week, bodyweight basics plus goblet squats, dumbbell presses, rows and hinges, 8–15 controlled reps.',
        'Гарний старт: 2–3 тренування на все тіло на тиждень, базові вправи з власною вагою плюс гоблет-присід, жим гантелей, тяги й нахили, 8–15 контрольованих повторів.',
      ],
      [
        'Supplements beyond food and maybe protein powder are rarely needed for teens; pre-workouts and fat burners are best avoided.',
        'Добавки, крім звичайної їжі й хіба що протеїну, підліткам рідко потрібні; передтренувальних комплексів і жироспалювачів краще уникати.',
      ],
    ],
    facets: {
      should: [
        'Yes, with supervision and a focus on technique before load.',
        'Так — під наглядом і з фокусом на техніці, а не на вазі.',
      ],
      when: [
        'Kids can start bodyweight and technique work early; heavier loading comes gradually once form is consistent.',
        'Діти можуть починати з вправ із власною вагою й техніки; більша вага додається поступово, коли техніка стабільна.',
      ],
      why: [
        'Strength training builds bone density, coordination and injury resilience for sports.',
        'Силові тренування зміцнюють кістки, розвивають координацію і знижують ризик травм у спорті.',
      ],
    },
  },
  {
    id: 'k_older_lifter',
    ask: ['How should I adjust training as I get older?', 'Як змінювати тренування з віком?'],
    answer: [
      "Keep lifting — strength training is one of the best things you can do for muscle, bone and independence as you age. The main adjustments are longer warm-ups, a bit more recovery between hard sessions, slightly higher rep ranges or fewer all-out heavy singles, and choosing exercise variations that feel good on your joints. Progress may be slower, but it's still very real; if you have heart, joint or other health conditions, check with your doctor about any limits.",
      'Продовжуй тренуватися — силові тренування одні з найкращих речей для м’язів, кісток і самостійності з віком. Основні зміни: довша розминка, трохи більше відновлення між важкими тренуваннями, дещо більше повторів або менше граничних одиночних підходів і вибір варіантів вправ, які комфортні для суглобів. Прогрес може бути повільнішим, але він цілком реальний; якщо є проблеми із серцем, суглобами чи інші хронічні стани — уточни в лікаря можливі обмеження.',
    ],
    more: [
      [
        'Power and balance decline faster than strength, so add some faster-intent lifting (e.g. brisk step-ups, light jumps if appropriate) and single-leg work.',
        'Потужність і рівновага знижуються швидше за силу, тож додай вправи з наміром рухатися швидко (наприклад, енергійні заходи на платформу, легкі стрибки, якщо доречно) і роботу на одну ногу.',
      ],
      [
        'Protein needs tend to rise with age — spreading about 25–40 g across 3–4 meals helps preserve muscle.',
        'З віком потреба в білку зростає — 25–40 г у 3–4 прийоми їжі допомагають зберегти м’язи.',
      ],
    ],
    facets: {
      how: [
        'Longer warm-ups, joint-friendly variations, a mix of rep ranges, and a day of rest between hard sessions for the same muscles.',
        'Довша розминка, варіанти вправ, що щадять суглоби, різні діапазони повторів і день відпочинку між важкими тренуваннями тих самих м’язів.',
      ],
      why: [
        'Recovery slows with age and connective tissue adapts more slowly, but muscle still responds well to training.',
        'Відновлення з віком сповільнюється, а сполучна тканина адаптується повільніше, але м’язи й далі добре відповідають на тренування.',
      ],
      should: [
        "You should keep training heavy enough to be challenging — very light 'toning' work leaves a lot of benefit on the table.",
        'Варто тренуватися з достатньо складною вагою — надто легка робота «для тонусу» дає значно менше користі.',
      ],
    },
  },
  {
    id: 'k_women_training',
    ask: [
      'Should women train differently from men?',
      'Чи мають жінки тренуватися інакше, ніж чоловіки?',
    ],
    answer: [
      "Mostly no — the same principles work: progressive overload, enough volume, good technique and adequate protein. Women often recover a bit faster between sets and can handle similar or slightly higher volume relative to their strength, and starting upper-body strength is usually lower, so upper-body progress may take a little more patience. Lifting heavy won't make you 'bulky' by accident; build your plan around your goals rather than a 'women's version' of training.",
      'Здебільшого ні — працюють ті самі принципи: прогресивне навантаження, достатній обсяг, правильна техніка і достатньо білка. Жінки часто трохи швидше відновлюються між підходами і можуть витримувати схожий або навіть трохи більший обсяг відносно своєї сили, а стартова сила верху тіла зазвичай нижча, тож тут прогрес може потребувати трохи більше терпіння. Випадково «перекачатися» від важких ваг не вийде; будуй план під свої цілі, а не під «жіночу версію» тренувань.',
    ],
    more: [
      [
        "Don't skip upper body and pulling work — rows, presses and pull-up progressions build strength that helps posture and everyday tasks.",
        'Не пропускай верх тіла і тяги — тяги, жими і прогресії до підтягувань дають силу, яка допомагає поставі й повсякденним справам.',
      ],
      [
        'Energy and strength can vary across the month for some women; adjusting load by feel on those days is fine, and the separate cycle topic covers that.',
        'У деяких жінок енергія й сила змінюються протягом місяця; у такі дні нормально коригувати вагу за самопочуттям — детальніше про це в темі про цикл.',
      ],
    ],
    facets: {
      should: [
        'Train for your goal — strength, muscle, fitness — with the same core principles as anyone else.',
        'Тренуйся під свою мету — силу, м’язи, витривалість — за тими ж базовими принципами, що й усі.',
      ],
      why: [
        'Muscle responds to training the same way in both sexes in relative terms; differences are mostly in starting point and absolute numbers.',
        'У відносних показниках м’язи відповідають на тренування однаково в обох статей; різниця переважно в стартовій точці та абсолютних цифрах.',
      ],
      how: [
        'Full programme covering legs, glutes, back, chest and shoulders, progressing weights steadily and eating enough protein.',
        'Повноцінна програма на ноги, сідниці, спину, груди й плечі, поступове збільшення ваги і достатньо білка.',
      ],
    },
  },
  {
    id: 'k_pushup_progression',
    ask: [
      "I can't do a push-up — how do I build up to one?",
      'Не можу віджатися — як до цього дійти?',
    ],
    answer: [
      'Start with a version you can do for 8–12 clean reps: wall or high-bench push-ups, then gradually lower the surface (bench, box, step) until you reach the floor. Keep a straight line from head to heels, hands just outside shoulder width, elbows at about 45°. Add slow lowering (3–5 seconds) and practise 2–4 times a week, and most people get their first full push-up within a few weeks to a couple of months.',
      'Почни з варіанту, який можеш зробити на 8–12 чистих повторів: віджимання від стіни або високої лавки, потім поступово опускай опору (лавка, ящик, сходинка), поки не дійдеш до підлоги. Тіло — рівна лінія від голови до п’ят, руки трохи ширше плечей, лікті приблизно під 45°. Додай повільне опускання (3–5 секунд) і практикуй 2–4 рази на тиждень — більшість людей роблять перше повне віджимання за кілька тижнів або пару місяців.',
    ],
    more: [
      [
        'Knee push-ups are fine, but incline push-ups usually transfer better because they keep the full-body plank position.',
        'Віджимання з колін — нормально, але віджимання від опори зазвичай краще переносяться на повні, бо зберігають позицію планки всього тіла.',
      ],
      [
        'Supporting work: bench or dumbbell press, planks, and triceps work all help; the core often fails before the chest does.',
        'Допоміжні вправи: жим лежачи чи гантелей, планка, робота на трицепс; часто першим здається корпус, а не груди.',
      ],
    ],
    facets: {
      how: [
        'Incline push-ups progressing lower, slow negatives, straight body line, 2–4 sessions a week.',
        'Віджимання від опори з поступовим зниженням, повільні негативи, рівне тіло, 2–4 рази на тиждень.',
      ],
      when: [
        'Move to a lower surface once you can do about 12 good reps at the current height.',
        'Переходь до нижчої опори, коли робиш приблизно 12 якісних повторів на поточній висоті.',
      ],
      why: [
        'Push-ups need chest, shoulder and triceps strength plus a strong plank — incline versions build both in proportion.',
        'Для віджимань потрібна сила грудей, плечей, трицепсів і міцна планка — віджимання від опори розвивають усе це пропорційно.',
      ],
    },
  },
  {
    id: 'k_etiquette',
    ask: ["What's the basic gym etiquette?", 'Які основні правила поведінки в залі?'],
    answer: [
      "Re-rack your weights and unload bars, wipe down benches and machines, and don't hog equipment with your phone between sets. If someone's using something you need, ask 'how many sets left?' or whether you can work in; most people are happy to share. Give lifters space in front of mirrors and racks, don't curl in the squat rack when it's busy, and keep advice to yourself unless someone asks or is about to get hurt.",
      'Розбирай штангу й повертай гантелі та млинці на місце, протирай лавки й тренажери і не займай обладнання, сидячи в телефоні між підходами. Якщо тобі потрібне те, що вже хтось використовує, запитай «скільки підходів лишилось?» або чи можна чергуватися — більшість людей охоче діляться. Не стій перед людиною біля дзеркала чи рами, не роби біцепс у силовій рамі, коли людно, і не давай порад без запиту — хіба що людина ось-ось травмується.',
    ],
    more: [
      [
        'Working in: alternate sets with someone on the same machine or rack — adjust the pin or plates back if you change them.',
        'Чергування: ви по черзі робите підходи на одному тренажері чи рамі — якщо змінюєш вагу чи налаштування, поверни як було.',
      ],
      [
        'Dropping deadlifts from the top is usually frowned upon outside of lifting platforms; control the bar down and use bumper plates when available.',
        'Кидати штангу зверху на становій зазвичай не вітається поза помостом; опускай контрольовано і, де є, використовуй бамперні млинці.',
      ],
    ],
    facets: {
      how: [
        'Re-rack, wipe down, share, give space, keep noise and phone calls reasonable.',
        'Прибирай за собою, протирай, ділись обладнанням, давай простір, не шуми й не розмовляй голосно по телефону.',
      ],
      should: [
        'You should ask before taking weights or equipment near someone — it may be part of their set-up.',
        'Варто запитати, перш ніж брати вагу чи обладнання біля когось, — це може бути частиною їхнього тренування.',
      ],
      what: [
        "Key unwritten rules: put stuff back, don't block the dumbbell rack, don't hover, and wait your turn politely.",
        'Головні неписані правила: повертай на місце, не заступай стійку з гантелями, не стій над душею і ввічливо чекай черги.',
      ],
    },
  },
  {
    id: 'k_beta_alanine',
    ask: ['Is beta-alanine worth taking?', 'Чи варто приймати бета-аланін?'],
    answer: [
      'Beta-alanine has decent evidence for efforts lasting roughly 1–4 minutes — high-rep sets, circuits, rowing or sprint intervals — by buffering acid build-up in muscle. For classic heavy lifting in low rep ranges the benefit is small. It works by saturation over weeks (commonly 3–6 g a day, split into doses), not as a pre-workout kick; the tingling it causes is harmless but split doses reduce it.',
      'Бета-аланін має непогану доказову базу для навантажень тривалістю приблизно 1–4 хвилини — багатоповторні підходи, кола, веслування чи спринтові інтервали — бо допомагає м’язам буферизувати закислення. Для класичних важких підходів на мало повторів користь невелика. Він діє через накопичення протягом тижнів (зазвичай 3–6 г на день, розділені на кілька прийомів), а не як разовий «заряд» перед тренуванням; поколювання від нього нешкідливе, а дрібніші дози його зменшують.',
    ],
    more: [
      [
        "It raises muscle carnosine over about 4+ weeks, so timing on the day doesn't matter much — consistency does.",
        'Він підвищує рівень карнозину в м’язах приблизно за 4+ тижні, тож час прийому протягом дня майже не важливий — важлива регулярність.',
      ],
      [
        "If budget is limited, creatine, protein and caffeine have stronger and broader evidence for lifters; beta-alanine is a 'nice to have'.",
        'Якщо бюджет обмежений, креатин, білок і кофеїн мають сильнішу й ширшу доказову базу для атлетів; бета-аланін — «приємний бонус».',
      ],
    ],
    facets: {
      should: [
        'Worth considering if you do lots of high-rep, circuit or conditioning work; optional for pure strength training.',
        'Варто розглянути, якщо багато багатоповторної, кругової чи функціональної роботи; для чистої сили — необов’язково.',
      ],
      howMuch: [
        'Commonly 3.2–6.4 g daily in 2–4 smaller doses, taken for at least 4 weeks.',
        'Зазвичай 3,2–6,4 г на день у 2–4 невеликих прийоми, щонайменше 4 тижні.',
      ],
      why: [
        'It increases carnosine, which buffers acidity during hard 1–4 minute efforts.',
        'Він підвищує рівень карнозину, який буферизує закислення під час інтенсивних зусиль на 1–4 хвилини.',
      ],
    },
  },
  {
    id: 'k_fish_oil',
    ask: ['Should I take fish oil or omega-3?', 'Чи варто приймати риб’ячий жир або омега-3?'],
    answer: [
      "If you rarely eat oily fish (salmon, sardines, mackerel, herring), an omega-3 supplement with EPA and DHA is a reasonable way to cover general health needs. For lifting specifically, the evidence for extra muscle or strength is weak and mixed — it's not a performance supplement. Look at the EPA+DHA amount on the label rather than the total 'fish oil' figure, and check with your doctor if you take blood thinners or have a medical condition.",
      'Якщо ти рідко їси жирну рибу (лосось, сардини, скумбрію, оселедець), омега-3 з EPA і DHA — розумний спосіб покрити загальні потреби для здоров’я. Щодо саме силових результатів доказів мало, і вони суперечливі — це не добавка для продуктивності. Дивись на етикетці кількість EPA+DHA, а не загальну цифру «риб’ячого жиру», і порадься з лікарем, якщо приймаєш препарати для розрідження крові чи маєш хронічні захворювання.',
    ],
    more: [
      [
        'Two portions of oily fish a week gives a similar intake; algae oil is an option for vegetarians and vegans.',
        'Дві порції жирної риби на тиждень дають схожу кількість; для вегетаріанців і веганів є варіант з олії водоростей.',
      ],
      [
        "Claims about big reductions in muscle soreness are based on small studies with inconsistent results — don't expect a noticeable recovery boost.",
        'Твердження про сильне зменшення крепатури ґрунтуються на невеликих дослідженнях із суперечливими результатами — помітного прискорення відновлення не чекай.',
      ],
    ],
    facets: {
      should: [
        'Reasonable if your diet lacks oily fish; not necessary if you eat it regularly.',
        'Має сенс, якщо в раціоні мало жирної риби; не обов’язково, якщо регулярно її їси.',
      ],
      howMuch: [
        'Common intakes are around 250–500 mg EPA+DHA a day for general health; higher amounts should be discussed with a doctor.',
        'Звичайні дози — приблизно 250–500 мг EPA+DHA на день для загального здоров’я; більші дози варто обговорити з лікарем.',
      ],
      when: [
        "With a meal that contains fat — it's better absorbed and causes fewer fishy burps.",
        'З їжею, що містить жири: так краще засвоюється і менше «рибної» відрижки.',
      ],
    },
  },
  {
    id: 'k_preworkout',
    ask: ['Are pre-workout supplements worth it?', 'Чи варто брати передтренувальні комплекси?'],
    answer: [
      "Most pre-workouts work mainly because of caffeine, often combined with citrulline and beta-alanine; the rest is frequently underdosed or unproven. If you want one, check the label for the actual caffeine amount and avoid 'proprietary blends' that hide doses. A coffee or caffeine tablet 30–60 minutes before training gives most of the effect for less money — and avoid stacking it with energy drinks or late sessions that wreck your sleep.",
      'Більшість передтренувальних комплексів діють переважно завдяки кофеїну, часто разом із цитруліном і бета-аланіном; решта інгредієнтів часто в замалих дозах або без доказів. Якщо хочеш такий комплекс — дивись на етикетці точну кількість кофеїну й уникай «пропрієтарних сумішей», де дози приховані. Кава чи таблетка кофеїну за 30–60 хвилин до тренування дає більшість ефекту дешевше — і не поєднуй це з енергетиками чи пізніми тренуваннями, що зіпсують сон.',
    ],
    more: [
      [
        "Citrulline malate (about 6–8 g) has some evidence for a few extra reps in high-rep sets; the 'pump' ingredients don't build extra muscle on their own.",
        'Цитрулін малат (приблизно 6–8 г) має певні докази на кілька додаткових повторів у багатоповторних підходах; інгредієнти «для пампу» самі по собі м’язів не додають.',
      ],
      [
        'Tolerance builds quickly; cycling off or saving it for hard sessions keeps it effective. People with heart conditions or high blood pressure should check with a doctor first.',
        'Звикання виникає швидко; перерви або використання лише перед важкими тренуваннями зберігають ефект. Людям із проблемами серця чи тиском варто спершу порадитися з лікарем.',
      ],
    ],
    facets: {
      should: [
        'Optional. Useful for some people on low-energy days, but not needed to make progress.',
        'Необов’язково. Комусь допомагає в дні з низькою енергією, але для прогресу не потрібно.',
      ],
      what: [
        'Mostly caffeine, often citrulline, beta-alanine, sometimes taurine or tyrosine — check the doses on the label.',
        'Здебільшого кофеїн, часто цитрулін, бета-аланін, іноді таурин чи тирозин — перевіряй дози на етикетці.',
      ],
      when: [
        'About 30–60 minutes before training, and not within roughly 6–8 hours of bedtime.',
        'Приблизно за 30–60 хвилин до тренування і не пізніше ніж за 6–8 годин до сну.',
      ],
    },
  },
  {
    id: 'k_bcaa',
    ask: ['Are BCAAs worth taking?', 'Чи варто приймати BCAA?'],
    answer: [
      'For most people, no. If you already eat enough protein (roughly 1.6–2.2 g per kg of bodyweight a day), BCAAs add essentially nothing, because every protein-rich meal already contains them. A whey shake or a meal with complete protein is a better and cheaper option; BCAAs only make limited sense in niche cases like very low protein intake while training fasted.',
      'Для більшості людей — ні. Якщо ти й так їси достатньо білка (приблизно 1,6–2,2 г на кг ваги на день), BCAA практично нічого не додають, бо кожен білковий прийом їжі вже їх містить. Порція сироваткового протеїну або їжа з повноцінним білком — кращий і дешевший варіант; BCAA мають хоч якийсь сенс лише в рідкісних випадках, наприклад при дуже низькому білку й тренуваннях натщесерце.',
    ],
    more: [
      [
        "Muscle building needs all essential amino acids; BCAAs alone signal growth but can't sustain it without the rest.",
        'Для росту м’язів потрібні всі незамінні амінокислоти; самі BCAA дають сигнал до росту, але без решти не можуть його підтримати.',
      ],
      [
        'EAA products are a step better than BCAAs, but still usually inferior value to whole protein or whey.',
        'Комплекси EAA трохи кращі за BCAA, але зазвичай все одно програють за співвідношенням ціни й користі звичайному білку чи сироватці.',
      ],
    ],
    facets: {
      should: [
        'Skip them if your daily protein is adequate — spend the money on food or protein powder.',
        'Якщо білка вистачає, можна не брати — краще витратити гроші на їжу чи протеїн.',
      ],
      why: [
        'Complete protein already contains BCAAs plus the other essential amino acids muscle needs.',
        'Повноцінний білок уже містить BCAA і решту незамінних амінокислот, потрібних м’язам.',
      ],
      when: [
        'Only in edge cases, like long fasted sessions with low overall protein intake.',
        'Лише у крайніх випадках, як-от довгі тренування натщесерце при низькому загальному білку.',
      ],
    },
  },
  {
    id: 'k_core_stability',
    ask: [
      'What are the best core exercises beyond crunches?',
      'Які найкращі вправи на кор, окрім скручувань?',
    ],
    answer: [
      "The core's main job in lifting is resisting movement, so train it that way: planks and side planks, dead bugs, Pallof presses, loaded carries and ab-wheel rollouts. Add some flexion work (hanging leg raises, cable crunches) if you want visible abs to grow. Heavy squats and deadlifts already train the core a lot, so 2–3 focused sessions of 3–6 hard sets a week is plenty for most people.",
      'Головна робота кору в силових — протидіяти руху, тож і тренувати його варто так: планки й бічні планки, «мертвий жук», жим Паллофа, прогулянки з вагою і ролик для преса. Додай вправи на згинання (підйоми ніг у висі, скручування на блоці), якщо хочеш збільшити м’язи преса. Важкі присідання й станова вже добре навантажують кор, тож більшості людей вистачає 2–3 цільових тренувань по 3–6 важких підходів на тиждень.',
    ],
    more: [
      [
        'Progress core work like any lift: longer holds only go so far, so add load (weighted planks, heavier carries) or harder leverage (rollouts from standing).',
        'Прогресуй у вправах на кор, як і в будь-яких інших: довше тримати планку можна лише до певної межі, далі додавай вагу (планка з вагою, важчі прогулянки) або складніший важіль (ролик зі стійки).',
      ],
      [
        'Anti-rotation and anti-lateral-flexion (Pallof, suitcase carry, side plank) are the parts most programmes miss.',
        'Протидія скручуванню й бічному нахилу (Паллоф, прогулянка з вагою в одній руці, бічна планка) — те, що найчастіше випадає з програм.',
      ],
    ],
    facets: {
      how: [
        'Mix anti-extension (plank, rollout), anti-rotation (Pallof), anti-lateral (side plank, suitcase carry) and some flexion.',
        'Поєднуй протидію розгинанню (планка, ролик), скручуванню (Паллоф), бічному нахилу (бічна планка, прогулянка з вагою в одній руці) і трохи згинання.',
      ],
      why: [
        'A strong, stiff trunk transfers force between legs and arms and lets you brace harder under heavy loads.',
        'Міцний, жорсткий корпус передає силу між ногами й руками і дає краще напружитися під важкою вагою.',
      ],
      howMuch: [
        'About 3–6 hard sets, 2–3 times a week, on top of your main lifts.',
        'Приблизно 3–6 важких підходів 2–3 рази на тиждень на додачу до основних вправ.',
      ],
    },
  },
  {
    id: 'k_ankle_mobility',
    ask: [
      'My heels come up when I squat — how do I fix my ankle mobility?',
      'Під час присіду відриваються п’яти — як покращити рухливість гомілкостопу?',
    ],
    answer: [
      'Heels lifting usually means limited ankle dorsiflexion (knee travelling forward over the toes), sometimes combined with a narrow stance or shifting weight forward. Quick fixes: squat in lifting shoes with a raised heel or put small plates under your heels, widen your stance and turn the toes out a bit. Longer term, do knee-to-wall ankle stretches, calf stretches and goblet squats with a pause at the bottom a few times a week.',
      'Відрив п’ят зазвичай означає обмежене тильне згинання гомілкостопу (коліно не може вийти вперед над носком), іноді разом із вузькою постановкою чи перенесенням ваги на носки. Швидкі рішення: присідай у штангетках із підбором або підклади під п’яти невеликі млинці, постав ноги ширше й трохи розверни носки. У довгостроковій перспективі кілька разів на тиждень роби розтяжку гомілкостопу «коліно до стіни», розтяжку литок і гоблет-присідання з паузою внизу.',
    ],
    more: [
      [
        "Test it: kneel facing a wall, foot about 10 cm away; if your knee can't touch the wall without the heel lifting, dorsiflexion is limited.",
        'Перевір: стань на одне коліно обличчям до стіни, стопа приблизно за 10 см; якщо коліно не торкається стіни без відриву п’яти — тильне згинання обмежене.',
      ],
      [
        "Elevating the heels isn't cheating — it's a legitimate way to squat more upright and bias the quads while mobility improves.",
        'Підняті п’яти — не читинг, а нормальний спосіб присідати з вертикальнішим корпусом і акцентом на квадрицепс, поки рухливість покращується.',
      ],
    ],
    facets: {
      why: [
        "If the ankle can't bend enough, the body compensates by lifting the heels or leaning the torso forward.",
        'Якщо гомілкостоп недостатньо згинається, тіло компенсує відривом п’ят або нахилом корпусу вперед.',
      ],
      how: [
        'Heel elevation now; knee-to-wall and calf stretches plus paused goblet squats for lasting change.',
        'Зараз — підняті п’яти; для тривалого результату — «коліно до стіни», розтяжка литок і гоблет-присід із паузою.',
      ],
      when: [
        'Mobility drills work well as part of the warm-up before squatting and on off days.',
        'Вправи на рухливість добре робити в розминці перед присідом і в дні відпочинку.',
      ],
    },
  },
  {
    id: 'k_gassed',
    ask: [
      'I get out of breath during sets — how do I build work capacity?',
      'Задихаюсь під час підходів — як покращити витривалість?',
    ],
    answer: [
      'Getting winded on high-rep squats or circuits usually means your aerobic base is lagging behind your strength. Add 2–3 sessions a week of easy cardio (20–40 minutes where you can still talk), plus one shorter harder session like intervals or sled pushes; within 4–8 weeks sets feel noticeably easier. In the meantime, rest a bit longer, breathe steadily between reps, and if breathlessness comes with chest pain, dizziness or feels out of proportion, see a doctor.',
      'Якщо задихаєшся на багатоповторних присіданнях чи колах, зазвичай аеробна база відстає від сили. Додай 2–3 легкі кардіо-сесії на тиждень (20–40 хвилин у темпі, коли можеш говорити) плюс одну коротшу інтенсивну — інтервали чи штовхання саней; за 4–8 тижнів підходи стануть помітно легшими. А поки відпочивай трохи довше, рівно дихай між повторами, і якщо задишка супроводжується болем у грудях, запамороченням або здається непропорційною — звернись до лікаря.',
    ],
    more: [
      [
        'Density work helps too: keep the weight moderate and gradually shorten rest periods, or do circuits of 3–4 exercises back to back.',
        'Допомагає й робота на щільність: помірна вага і поступове скорочення відпочинку або кола з 3–4 вправ без пауз.',
      ],
      [
        'Conditioning for a sport should mirror it: short repeated bursts for team sports, longer steady efforts for endurance events.',
        'Функціональна підготовка до спорту має його імітувати: короткі повторювані ривки для командних видів, довші рівномірні зусилля для витривалості.',
      ],
    ],
    facets: {
      why: [
        "Strength and aerobic fitness are separate qualities; lifting alone doesn't build much aerobic capacity.",
        'Сила й аеробна витривалість — різні якості; саме лише залізо аеробну базу майже не розвиває.',
      ],
      how: [
        'Easy steady cardio 2–3× a week, one interval session, and gradually denser lifting circuits.',
        'Легке рівномірне кардіо 2–3 рази на тиждень, одне інтервальне тренування і поступово щільніші кола з вагами.',
      ],
      when: [
        "Put hard conditioning after lifting or on separate days so it doesn't eat into your strength work.",
        'Інтенсивну функціональну роботу став після силових або в окремі дні, щоб вона не заважала силовим.',
      ],
    },
  },
  {
    id: 'k_sticking_point',
    ask: [
      'I always fail at the same point in a lift — how do I fix a sticking point?',
      'Завжди «застрягаю» в одній точці вправи — як це виправити?',
    ],
    answer: [
      "First check that technique isn't the real issue — a bar path drifting or losing tightness often creates the 'sticking point'. Then train that range: pauses just at or below the sticking point, tempo reps, and variations that emphasise it (e.g. paused or spoto bench for off-the-chest, pin presses or close-grip bench for lockout, paused squats out of the hole). Strengthening the muscles that limit that range, not only the full lift, is what moves it.",
      'Спершу перевір, чи проблема не в техніці: траєкторія, що «попливла», або втрата напруги часто й створюють точку застою. Потім тренуй саме цю ділянку: паузи в точці застою або трохи нижче, повтори в повільному темпі й варіанти, що її підкреслюють (наприклад, жим із паузою на грудях для низу, жим від упорів чи вузьким хватом для дотиску, присід із паузою внизу). Рухає застій зміцнення м’язів, які обмежують саме цю ділянку, а не лише повна вправа.',
    ],
    more: [
      [
        'Rough guide: bench off the chest — pecs/front delts; lockout — triceps. Squat out of the hole — quads/adductors; mid-range forward lean — upper back and quads. Deadlift off the floor — quads and position; at the knees/lockout — glutes and back.',
        'Приблизно: жим із грудей — груди й передня дельта; дотиск — трицепс. Присід із низу — квадрицепс і привідні; нахил вперед посередині — верх спини й квадрицепс. Станова з підлоги — квадрицепс і позиція; біля колін і вгорі — сідниці та спина.',
      ],
      [
        "Run a specific variation for 4–8 weeks and retest the main lift; don't change everything at once or you won't know what helped.",
        'Роби конкретний варіант 4–8 тижнів і перевір основну вправу знову; не змінюй усе одразу, бо не зрозумієш, що допомогло.',
      ],
    ],
    facets: {
      why: [
        'Leverages are worst at a particular joint angle, and whatever muscle is weakest there decides whether you make the rep.',
        'На певному куті в суглобі важелі найгірші, і найслабший м’яз у цьому положенні вирішує, чи піднімеш вагу.',
      ],
      how: [
        'Film the lift, find where the bar slows, add paused or partial variations at that range for a training block.',
        'Зніми вправу, знайди, де штанга гальмує, і додай на цей блок варіанти з паузою чи частковою амплітудою в цій ділянці.',
      ],
      what: [
        'A sticking point is the part of the range where bar speed drops the most and reps fail.',
        'Точка застою — ділянка амплітуди, де швидкість штанги падає найбільше і де зриваються повтори.',
      ],
    },
  },
  {
    id: 'k_more_pullups',
    ask: ['How do I increase my pull-up reps?', 'Як збільшити кількість підтягувань?'],
    answer: [
      "Train pull-ups often with plenty of submaximal volume: for example, 3–4 days a week doing sets of about half your max (grease the groove) or a fixed total like 3× your max per session. Add weighted pull-ups or slow negatives once you can do 8–10, and support them with rows and lat pulldowns. Losing some body fat also helps a lot, since you're lifting your whole body.",
      'Підтягуйся часто й з великим обсягом без відмови: наприклад, 3–4 дні на тиждень підходи приблизно на половину свого максимуму (метод «змащування шаблону») або фіксована сума повторів, скажімо втричі більша за твій максимум за тренування. Коли робиш 8–10, додай підтягування з вагою чи повільні негативи, а також тяги в нахилі й тягу верхнього блока. Зменшення жиру теж дуже допомагає — ти ж піднімаєш усе тіло.',
    ],
    more: [
      [
        'A simple plan: if your max is 6, do sets of 3–4 spread through the day or session totalling 20, and add a couple of reps to the total each week.',
        'Простий план: якщо максимум 6 — роби підходи по 3–4 протягом дня чи тренування в сумі 20 повторів і щотижня додавай пару повторів до суми.',
      ],
      [
        'Full range matters — dead hang to chin over bar — so your number reflects real progress, not shorter reps.',
        'Важлива повна амплітуда — з повного вису до підборіддя над перекладиною — тоді цифра відображає реальний прогрес, а не коротші повтори.',
      ],
    ],
    facets: {
      how: [
        'Frequent submax sets, a weekly rep total that grows, then add weight or negatives; build lats and grip with rows.',
        'Часті підходи без відмови, тижнева сума повторів, яка росте, далі вага чи негативи; розвивай широчайші й хват тягами.',
      ],
      howMuch: [
        'Around 3–4 short pull-up sessions a week works well for most people.',
        'Більшості людей добре підходить 3–4 короткі сесії підтягувань на тиждень.',
      ],
      why: [
        'Pull-ups are a skill as well as strength — frequent practice improves both.',
        'Підтягування — це і навичка, і сила; часта практика розвиває обидва.',
      ],
    },
  },
  {
    id: 'k_mind_muscle',
    ask: [
      "I don't feel the target muscle working — how do I fix that?",
      'Не відчуваю, як працює цільовий м’яз, — що робити?',
    ],
    answer: [
      "Feeling a muscle isn't required for it to grow, but if something else is clearly taking over, it's worth adjusting. Lower the weight, slow the lowering phase, pause in the stretched and contracted positions, and focus on the movement the muscle does (e.g. for lats, drive the elbows down to the hips rather than 'pull with the hands'). Small set-up tweaks — grip width, seat height, torso angle — often matter more than willpower.",
      'Відчувати м’яз не обов’язково для його росту, але якщо явно працює щось інше — варто скоригувати. Зменш вагу, повільніше опускай, роби паузу в розтягнутому і скороченому положеннях і думай про рух, який виконує м’яз (наприклад, для широчайших — веди лікті вниз до стегон, а не «тягни руками»). Дрібні зміни налаштувань — ширина хвату, висота сидіння, кут корпусу — часто важать більше, ніж зусилля волі.',
    ],
    more: [
      [
        'Research shows an internal focus on the muscle can slightly increase its activation at moderate loads, but with heavy loads an external focus (move the bar) is better for performance.',
        'Дослідження показують, що зосередженість на м’язі може трохи збільшити його активацію з помірною вагою, але з важкою вагою для результату краще зовнішній фокус (рухати штангу).',
      ],
      [
        "A quick pre-activation set or touching the muscle during the set helps some people; so does a light 'feeler' set with a 2-second squeeze.",
        'Декому допомагає коротка активаційна вправа або дотик до м’яза під час підходу; також легкий «відчувальний» підхід із 2-секундним стисканням.',
      ],
    ],
    facets: {
      how: [
        'Lighter load, slower eccentric, pauses, and cues about the joint action the muscle performs.',
        'Менша вага, повільніша негативна фаза, паузи і підказки про рух у суглобі, який робить цей м’яз.',
      ],
      should: [
        "Don't obsess over it — if the muscle is sore or growing and your numbers go up, it's working.",
        'Не зациклюйся — якщо м’яз росте, болить після тренувань і вага в вправі зростає, він працює.',
      ],
      why: [
        'Other muscles take over when the load is too heavy or the set-up puts them in a better position.',
        'Інші м’язи перебирають роботу, коли вага завелика або налаштування дає їм вигідніше положення.',
      ],
    },
  },
  {
    id: 'k_partial_reps',
    ask: ['Full range of motion or partial reps?', 'Повна амплітуда чи часткові повтори?'],
    answer: [
      "Default to full range of motion — it builds muscle and strength across the whole movement and is easier to track honestly. Partials have a place: lengthened partials (the bottom half, where the muscle is stretched) look about as good as or even better than full reps for growth in recent studies, and top-range partials can help overload a lockout. What to avoid is ego-driven half reps with a weight you can't control through the range you're training for.",
      'За замовчуванням — повна амплітуда: вона розвиває м’язи й силу в усьому діапазоні руху і дає чесно відстежувати прогрес. Часткові повтори теж мають місце: за новими дослідженнями, часткові в розтягнутій позиції (нижня половина руху) для росту м’язів не гірші, а іноді й кращі за повні, а часткові у верхній частині допомагають перевантажити дотиск. Уникати варто «его-напівповторів» із вагою, яку не контролюєш у потрібній амплітуді.',
    ],
    more: [
      [
        "A practical use: finish a set of full reps with a few lengthened partials once you can't complete another full rep.",
        'Практичний варіант: після повних повторів, коли вже не виходить ще один, додай кілька часткових у розтягнутій позиції.',
      ],
      [
        'Range can be adjusted around pain or mobility limits temporarily — a shorter pain-free range beats not training at all.',
        'Амплітуду можна тимчасово скоротити через біль чи обмежену рухливість — коротша безболісна амплітуда краща, ніж зовсім не тренуватися.',
      ],
    ],
    facets: {
      should: [
        'Mostly full range; use partials deliberately, not to lift heavier numbers.',
        'Переважно повна амплітуда; часткові — свідомо, а не заради більших цифр.',
      ],
      why: [
        'Training at long muscle lengths seems to be a strong growth stimulus, which is why the stretched part of the range matters most.',
        'Робота в розтягнутому положенні м’яза, схоже, — сильний стимул росту, тому нижня частина амплітуди найважливіша.',
      ],
      when: [
        'Partials fit at the end of a set, for lockout work, or temporarily around an injury.',
        'Часткові доречні наприкінці підходу, для роботи над дотиском або тимчасово через травму.',
      ],
    },
  },
  {
    id: 'k_bands',
    ask: [
      'Are resistance bands effective for building muscle?',
      'Чи ефективні гумові петлі (еспандери) для набору м’язів?',
    ],
    answer: [
      "Yes, bands can build muscle as long as sets are taken close to failure — muscles respond to effort, not the source of resistance. Their limitation is that tension is low at the start of the range and high at the end, and it's harder to progress precisely, so they shine for home training, travel, warm-ups and accessory work. Use heavier bands, more reps, slower tempos or double them up to keep progressing.",
      'Так, петлі можуть наростити м’язи, якщо підходи доводити близько до відмови: м’язи реагують на зусилля, а не на джерело опору. Обмеження в тому, що на початку руху натяг малий, а в кінці великий, і точно прогресувати складніше, тож вони найкращі для домашніх тренувань, поїздок, розминки й допоміжних вправ. Щоб прогресувати, бери щільніші петлі, роби більше повторів, повільніший темп або складай дві петлі разом.',
    ],
    more: [
      [
        'Bands pair well with free weights: band-resisted push-ups, band pull-aparts for the upper back, and band-assisted pull-ups.',
        'Петлі добре поєднуються з вільною вагою: віджимання з петлею, розведення петлі для верху спини, підтягування з петлею для полегшення.',
      ],
      [
        'Anchor them safely and check for nicks or tears — a snapping band can hurt, especially near the face.',
        'Надійно закріплюй петлі й перевіряй на надриви: петля, що лопнула, може травмувати, особливо біля обличчя.',
      ],
    ],
    facets: {
      should: [
        'Great if you train at home or travel; in a gym, weights are usually easier to progress.',
        'Чудово, якщо тренуєшся вдома чи в поїздках; у залі з вагами прогресувати зазвичай простіше.',
      ],
      how: [
        'Pick a band that makes 10–30 reps hard, go close to failure, and move up in band tension over time.',
        'Обирай петлю, з якою 10–30 повторів важкі, доводь близько до відмови і з часом переходь на щільніші.',
      ],
      why: [
        'Muscle growth depends on effort and tension near failure, which bands can provide.',
        'Ріст м’язів залежить від зусилля й натягу близько до відмови, а петлі можуть це дати.',
      ],
    },
  },
  {
    id: 'k_kettlebell_swing',
    ask: ['How do I do a kettlebell swing properly?', 'Як правильно робити махи гирею?'],
    answer: [
      'A swing is a hip hinge, not a squat or a front raise: hike the bell back between your legs like a football snap, then snap the hips forward and squeeze the glutes so the bell floats to about chest height. Your arms stay relaxed like ropes, your back stays neutral and your shins stay fairly vertical. Start with a moderate bell (often 12–16 kg for women, 16–24 kg for men) and sets of 10–20 crisp reps.',
      'Мах — це рух тазом (шарнір), а не присід і не підйом рук: закинь гирю назад між ніг, ніби пас у регбі, потім різко виштовхни таз уперед і стисни сідниці, щоб гиря «злетіла» приблизно до рівня грудей. Руки розслаблені, як мотузки, спина рівна, гомілки майже вертикальні. Почни з помірної гирі (часто 12–16 кг для жінок, 16–24 кг для чоловіків) і підходів по 10–20 чітких повторів.',
    ],
    more: [
      [
        'Common faults: squatting the swing, lifting with the shoulders, leaning back at the top and letting the bell drag you forward at the bottom.',
        'Типові помилки: присідати замість нахилу, піднімати гирю плечима, відхилятися назад угорі і дозволяти гирі тягнути тебе вперед унизу.',
      ],
      [
        'Swings are excellent conditioning: e.g. 10 swings every minute for 10 minutes builds work capacity without much joint stress.',
        'Махи — чудова функціональна вправа: наприклад, 10 махів щохвилини протягом 10 хвилин розвивають витривалість без великого навантаження на суглоби.',
      ],
    ],
    facets: {
      how: [
        'Hinge, hike the bell back high between the thighs, drive the hips through, stand tall with glutes locked, let it fall and repeat.',
        'Нахил, закинь гирю високо між стегнами, виштовхни таз, стань рівно зі стиснутими сідницями, дай гирі впасти й повтори.',
      ],
      why: [
        'It trains the glutes, hamstrings and back explosively and doubles as conditioning.',
        'Вони вибухово тренують сідниці, задню поверхню стегна і спину і водночас розвивають витривалість.',
      ],
      should: [
        "If it hurts your lower back, you're probably squatting or leaning back — film it or get it checked by a coach.",
        'Якщо болить поперек, найімовірніше, ти присідаєш або відхиляєшся назад — зніми себе на відео або покажи тренеру.',
      ],
    },
  },
  {
    id: 'k_program_hopping',
    ask: [
      "Should I switch programs often to 'confuse' my muscles?",
      'Чи треба часто міняти програму, щоб «шокувати» м’язи?',
    ],
    answer: [
      "No — 'muscle confusion' isn't how progress works. Muscles grow from progressive overload on movements you repeat long enough to get better at, so frequent switching mostly resets your learning and makes progress hard to measure. Stick with a sensible programme for at least 8–12 weeks while weights or reps keep going up; change individual exercises when they stall, cause discomfort or bore you enough to hurt consistency.",
      'Ні — «шок для м’язів» не працює так, як кажуть. М’язи ростуть від прогресивного навантаження у вправах, які повторюєш достатньо довго, щоб у них покращуватися, тож часта зміна переважно обнуляє навчання і не дає виміряти прогрес. Тримайся нормальної програми щонайменше 8–12 тижнів, поки вага чи повтори ростуть; окремі вправи міняй, коли вони застоялися, дають дискомфорт або набридли настільки, що страждає регулярність.',
    ],
    more: [
      [
        'Some variety is useful: rotating similar variations (e.g. back squat → safety bar squat) every block keeps joints happy without losing progress.',
        'Трохи різноманіття корисно: чергування схожих варіантів (наприклад, присід зі штангою → присід зі спеціальним грифом) кожного блоку береже суглоби без втрати прогресу.',
      ],
      [
        'Signs a programme has run its course: several weeks without progress despite good sleep and food, or constant aches from the same lifts.',
        'Ознаки, що програма вичерпалася: кілька тижнів без прогресу попри нормальний сон і харчування або постійний дискомфорт від тих самих вправ.',
      ],
    ],
    facets: {
      should: [
        "Stay the course for 2–3 months unless something clearly isn't working.",
        'Тримайся програми 2–3 місяці, якщо щось явно не працює.',
      ],
      why: [
        'Repeating movements lets you get stronger at them and track overload accurately.',
        'Повторення вправ дає ставати в них сильнішим і точно відстежувати прогрес навантаження.',
      ],
      when: [
        'Change when progress stalls for several weeks, a lift causes pain, or your goal changes.',
        'Міняй, коли прогрес стоїть кілька тижнів, вправа дає біль або змінюється мета.',
      ],
    },
  },
  {
    id: 'k_cardio_order',
    ask: ['Should I do cardio before or after weights?', 'Кардіо робити до чи після силового?'],
    answer: [
      'If strength or muscle is your priority, lift first and do cardio after (or on a separate day), because hard cardio beforehand drains the energy you need for heavy sets. A 5–10 minute easy cardio warm-up before lifting is fine and even helpful. If endurance is your main goal, flip the order, and when possible separate hard cardio and leg training by several hours.',
      'Якщо пріоритет — сила чи м’язи, спершу залізо, а кардіо після (або в окремий день), бо інтенсивне кардіо перед силовими забирає енергію, потрібну для важких підходів. 5–10 хвилин легкого кардіо як розминка перед залізом — нормально й навіть корисно. Якщо головна мета — витривалість, поміняй порядок, а по можливості розводь інтенсивне кардіо й тренування ніг на кілька годин.',
    ],
    more: [
      [
        'Low-intensity cardio like walking or easy cycling barely interferes with lifting, even on the same day.',
        'Низькоінтенсивне кардіо, як-от ходьба чи легкий велосипед, майже не заважає силовим навіть того ж дня.',
      ],
      [
        'Cycling tends to interfere less with leg strength than running, because it has less impact and eccentric stress.',
        'Велосипед зазвичай менше заважає силі ніг, ніж біг, бо в ньому менше ударного й ексцентричного навантаження.',
      ],
    ],
    facets: {
      when: [
        'After lifting, on separate days, or at least a few hours apart if both are hard.',
        'Після силового, в окремі дні або принаймні з перервою в кілька годин, якщо обидва тренування важкі.',
      ],
      why: [
        'Fatigue from hard cardio lowers the quality of heavy sets that follow.',
        'Втома від інтенсивного кардіо знижує якість важких підходів після нього.',
      ],
      should: [
        'Light cardio before as a warm-up is fine; save hard intervals for after.',
        'Легке кардіо перед як розминка — нормально; інтенсивні інтервали залиш на потім.',
      ],
    },
  },
  {
    id: 'k_exercise_order',
    ask: ['What order should I do exercises in?', 'У якому порядку робити вправи?'],
    answer: [
      "Put the most important and most demanding lifts first while you're fresh — usually big compound lifts like squats, deadlifts, presses and rows — then move to smaller accessory and isolation work. Within that, prioritise whatever you most want to improve: a lagging muscle or lift can go first. Core and very fatiguing finishers generally go last so they don't compromise heavy sets.",
      'Найважливіші й найважчі вправи роби першими, поки свіжий, — зазвичай це великі базові вправи: присід, станова, жими, тяги, — а потім переходь до допоміжних та ізолюючих. У межах цього пріоритет має те, що найбільше хочеш покращити: відстаючий м’яз чи вправу можна поставити першою. Прес і дуже виснажливі «добивання» зазвичай ставлять наприкінці, щоб не зіпсувати важкі підходи.',
    ],
    more: [
      [
        'Pre-exhaust (isolation before compound) is an option to bias a muscle, but it lowers the load you can use on the compound lift.',
        'Попереднє втомлення (ізоляція перед базою) — спосіб акцентувати м’яз, але воно знижує вагу, з якою зможеш працювати в базовій вправі.',
      ],
      [
        'Alternating non-competing exercises (e.g. a press with a row) saves time without much performance cost.',
        'Чергування вправ, що не конкурують (наприклад, жим і тяга), економить час майже без втрати продуктивності.',
      ],
    ],
    facets: {
      how: [
        'Heavy compounds → secondary compounds → isolation → core/finishers.',
        'Важкі базові → допоміжні багатосуглобові → ізолюючі → прес і «добивання».',
      ],
      why: [
        'Fatigue accumulates across a session, so the lifts done first get your best effort and technique.',
        'Втома накопичується протягом тренування, тож перші вправи отримують найкраще зусилля й техніку.',
      ],
      should: [
        "Put your priority lift first even if it's not the biggest one.",
        'Став пріоритетну вправу першою, навіть якщо вона не найважча.',
      ],
    },
  },
  {
    id: 'k_imbalance',
    ask: [
      'One side is stronger than the other — how do I fix it?',
      'Одна сторона сильніша за іншу — як це виправити?',
    ],
    answer: [
      'Small side-to-side differences (roughly up to 10%) are normal. To even things out, add unilateral work — dumbbell presses, one-arm rows, split squats, single-leg RDLs — start each set with the weaker side and match its reps on the stronger side. With barbell lifts, check your setup (grip, foot position, centred under the bar); if the imbalance is sudden, painful or linked to an old injury, get it assessed by a physio.',
      'Невелика різниця між сторонами (приблизно до 10%) — норма. Щоб вирівняти, додай вправи на одну кінцівку — жим гантелей, тягу однією рукою, болгарські присідання, румунську тягу на одній нозі; починай кожен підхід зі слабшої сторони і роби сильною стороною стільки ж повторів. У вправах зі штангою перевір налаштування (хват, постановку ніг, чи стоїш по центру під грифом); якщо дисбаланс раптовий, болючий чи пов’язаний зі старою травмою — покажися фізіотерапевту.',
    ],
    more: [
      [
        "Don't add lots of extra sets only to the weak side for long — matching volume and letting the weaker side catch up is usually enough.",
        'Не варто довго додавати багато підходів лише слабшій стороні — зазвичай достатньо однакового обсягу, і слабша сторона наздоганяє.',
      ],
      [
        'Visible size differences often look bigger than they are; measure (tape, photos in the same light) before changing your plan.',
        'Видима різниця в розмірі часто здається більшою, ніж є; поміряй (сантиметром, фото в однаковому світлі), перш ніж змінювати план.',
      ],
    ],
    facets: {
      how: [
        'Unilateral exercises, weaker side first, match reps, and film barbell lifts from the front for shifting.',
        'Вправи на одну кінцівку, спершу слабша сторона, однакові повтори, а вправи зі штангою знімай спереду, щоб помітити зміщення.',
      ],
      why: [
        'Everyone has a dominant side; habits, sports and old injuries amplify the difference.',
        'У всіх є домінантна сторона; звички, спорт і старі травми збільшують різницю.',
      ],
      should: [
        'You should see a professional if the imbalance comes with pain, numbness or a recent injury.',
        'Варто звернутися до фахівця, якщо дисбаланс супроводжується болем, онімінням або недавньою травмою.',
      ],
    },
  },
  {
    id: 'k_knees_over_toes',
    ask: [
      'Is it bad if my knees go past my toes when squatting?',
      'Чи погано, якщо коліна виходять за носки при присіданні?',
    ],
    answer: [
      "No — for most people it's normal and necessary. Your knees need to travel forward to squat deep with an upright torso, and trying to keep them behind the toes just shifts stress to the hips and lower back. What matters more is keeping the whole foot on the floor and the knees tracking in line with the toes; if you have knee pain, reduce depth or load and have it assessed.",
      'Ні — для більшості людей це нормально й необхідно. Щоб присісти глибоко з вертикальним корпусом, коліна мають виходити вперед, а спроба тримати їх позаду носків лише переносить навантаження на таз і поперек. Важливіше, щоб уся стопа стояла на підлозі, а коліна йшли по лінії носків; якщо болять коліна — зменш глибину чи вагу і покажися фахівцю.',
    ],
    more: [
      [
        'How far the knees travel depends on your limb lengths and ankle mobility — long thighs usually mean more forward knee travel.',
        'Наскільки коліна виходять уперед, залежить від пропорцій і рухливості гомілкостопу — довгі стегна зазвичай означають більший вихід колін.',
      ],
      [
        'Knee-dominant exercises like split squats and step-downs, done gradually, can make the knees more resilient rather than less.',
        'Вправи з акцентом на коліна — болгарські присідання, спуски зі сходинки, — якщо навантаження зростає поступово, роблять коліна витривалішими, а не слабшими.',
      ],
    ],
    facets: {
      why: [
        'Forward knee travel lets you stay balanced over mid-foot with a more upright back.',
        'Вихід колін уперед дає тримати баланс над серединою стопи з вертикальнішою спиною.',
      ],
      should: [
        "Let the knees go where they naturally go, as long as the heel stays down and it's pain-free.",
        'Дозволь колінам іти туди, куди вони йдуть природно, якщо п’ята на підлозі і немає болю.',
      ],
      what: [
        "It's an old rule of thumb, not a safety law — studies show restricting knee travel increases hip and back stress.",
        'Це старе емпіричне правило, а не закон безпеки: дослідження показують, що обмеження руху колін збільшує навантаження на таз і спину.',
      ],
    },
  },
  {
    id: 'k_bail_squat',
    ask: [
      'How do I bail out of a failed squat safely?',
      'Як безпечно скинути штангу, якщо не встаю з присіду?',
    ],
    answer: [
      'The best bail is the one you set up before the set: squat inside a power rack with the safety pins or straps just below your bottom position, so you can simply sit down and let the bar rest on them. Without safeties, the back-bail is to let go of the bar and push your hips forward so it rolls off your back behind you — practise it with an empty bar first. Never try to squat heavy alone in the open without safeties.',
      'Найкращий спосіб скинути штангу — той, який підготував до підходу: присідай у силовій рамі з упорами чи ременями трохи нижче своєї нижньої точки, тоді просто опускаєшся і кладеш гриф на них. Без упорів штангу скидають назад: відпускаєш гриф і подаєш таз уперед, щоб штанга скотилася зі спини позаду — спершу потренуйся з порожнім грифом. Ніколи не присідай із великою вагою сам без страховки.',
    ],
    more: [
      [
        'With a spotter, agree beforehand: one spotter stands behind and hugs the torso, or two spotters take the bar ends; they should know when to step in.',
        'Зі страхувальником домовтеся заздалегідь: один стоїть позаду і страхує корпус, або двоє беруть кінці грифа; вони мають знати, коли втручатися.',
      ],
      [
        "Leave collars off on a bench press you might need to tilt out of, but keep them on for squats in a rack so plates don't slide.",
        'На жимі лежачи без страхувальника замки часто не ставлять, щоб можна було нахилити гриф, але на присіді в рамі замки мають бути, щоб млинці не зсувалися.',
      ],
    ],
    facets: {
      how: [
        'Set safeties just under your depth, practise dropping to them with light weight, and bail by sitting down onto them.',
        'Постав упори трохи нижче своєї глибини, потренуйся опускати на них легку вагу, а при невдачі просто сідай і клади гриф на упори.',
      ],
      should: [
        'Always use safeties or a competent spotter for heavy squats.',
        'Завжди використовуй упори або досвідченого страхувальника на важких присіданнях.',
      ],
      when: [
        "Bail as soon as the bar stops moving up or your back starts rounding — don't grind into a bad position.",
        'Скидай, щойно штанга перестала йти вгору або почала круглитися спина, — не дотискай у поганій позиції.',
      ],
    },
  },
  {
    id: 'k_personal_trainer',
    ask: ['Is a personal trainer worth it?', 'Чи варто брати персонального тренера?'],
    answer: [
      "A good coach is most worth it at the start (to learn technique and build habits), when you're stuck, returning from injury, or need accountability. Even a few sessions to learn the main lifts can save months of trial and error. Look for relevant qualifications, a plan that tracks your progress, and someone who explains the 'why' — not just someone who counts reps.",
      'Хороший тренер найбільше виправданий на початку (вивчити техніку й сформувати звички), коли застряг, повертаєшся після травми або потребуєш зовнішньої дисципліни. Навіть кілька занять, щоб поставити техніку основних вправ, можуть зекономити місяці спроб і помилок. Шукай людину з профільною кваліфікацією, яка веде план і відстежує твій прогрес і пояснює «чому», а не просто рахує повтори.',
    ],
    more: [
      [
        'Cheaper options: online coaching with video form checks, small-group training, or a few one-off technique sessions.',
        'Дешевші варіанти: онлайн-тренер із розбором відео техніки, заняття в малих групах або кілька разових занять на техніку.',
      ],
      [
        "Red flags: selling you supplements hard, the same workout for every client, crushing you every session 'to feel it', or dismissing pain.",
        'Тривожні знаки: агресивно продає добавки, однакове тренування для всіх, «вбиває» тебе щоразу «щоб відчув» або ігнорує біль.',
      ],
    ],
    facets: {
      should: [
        "Worth it if you're new, stuck or need accountability and it fits your budget; not essential if you train consistently and learn well on your own.",
        'Варто, якщо ти новачок, застряг чи потребуєш дисципліни і бюджет дозволяє; не обов’язково, якщо регулярно тренуєшся і добре вчишся сам.',
      ],
      how: [
        'Ask about their qualifications, how they program and track progress, and book a trial session first.',
        'Запитай про кваліфікацію, як будують програму й відстежують прогрес, і спершу запишись на пробне заняття.',
      ],
      why: [
        'Real-time feedback on technique and a plan tailored to you speeds up learning and reduces injury risk.',
        'Зворотний зв’язок щодо техніки в реальному часі та індивідуальний план пришвидшують навчання і знижують ризик травм.',
      ],
    },
  },
];
