import type { Facet } from './types';
export const MORE_R3: Record<string, [string, string][]> = {
  sets_for_lift: [
    [
      "Hard sets are what count: a set ending 0–3 reps short of failure. Warm-ups and easy sets don't count toward the 3–4, so a session like 2 warm-ups + 3 working sets is exactly right.",
      'Рахуються лише важкі підходи — ті, що закінчуються за 0–3 повтори до відмови. Розминочні й легкі не йдуть у ці 3–4, тож 2 розминочні + 3 робочі — саме те, що треба.',
    ],
    [
      "Common mistake: piling on 6–8 sets of one lift where the last ones are just junk volume. If reps drop by more than 2–3 from set 1 to the last set, you've done enough for that lift today.",
      'Типова помилка — 6–8 підходів однієї вправи, де останні вже «для галочки». Якщо від першого до останнього сету повтори падають більш ніж на 2–3, на сьогодні цієї вправи досить.',
    ],
    [
      'Pro tip: think per muscle per week, not per lift — about 10–20 hard sets per muscle a week. Squats count for quads and glutes, so fewer leg-press sets are needed on top.',
      "Порада: рахуй підходи на м'яз за тиждень, а не на вправу — приблизно 10–20 важких сетів. Присід зараховується і квадрицепсам, і сідницям, тож жиму ногами зверху треба менше.",
    ],
  ],
  day_lookup: [
    [
      "I show the exercises, sets, reps and weights you logged that day. If nothing's logged, it means no session was saved — not that you didn't train.",
      'Я показую вправи, підходи, повтори й ваги, які ти записав того дня. Якщо порожньо — значить, тренування не збережене, а не що ти не тренувався.',
    ],
    [
      'Edge case: a session that ran past midnight is saved on the day it started. Missed logging? Add it afterwards so your stats and recovery stay accurate.',
      'Нюанс: тренування, що перейшло за північ, записується на день, коли почалося. Забув записати — додай пізніше, щоб статистика й відновлення рахувалися правильно.',
    ],
    [
      'Pro tip: before a session, check what you did on the same day last week — matching or beating it is the simplest way to progress.',
      'Порада: перед тренуванням глянь, що робив у цей же день минулого тижня. Повторити або трохи перевершити — найпростіший шлях до прогресу.',
    ],
  ],
  compare_weeks: [
    [
      'Sessions and hard sets are the fairest week-to-week measure. A 10–20% swing is normal noise; a steady drop over 3+ weeks is a trend worth looking at.',
      'Кількість тренувань і важких підходів — найчесніше порівняння тижнів. Коливання на 10–20% — це норма; стабільне падіння 3+ тижні поспіль — вже тенденція.',
    ],
    [
      'Mistake: judging one week in isolation. A deload, a trip or a cold explains a lot — compare against your 4-week average instead.',
      'Помилка — судити по одному тижню. Розвантаження, поїздка чи застуда багато що пояснюють, тож краще порівнюй із середнім за 4 тижні.',
    ],
    [
      "Pro tip: more sets isn't automatically better. If volume went up but your top sets got weaker, you may be doing more than you recover from.",
      'Порада: більше підходів — не завжди краще. Якщо обсяг зріс, а робочі ваги просіли, ти, можливо, робиш більше, ніж встигаєш відновлюватися.',
    ],
  ],
  short_on_time: [
    [
      'Supersets save time by resting one muscle while working another — e.g. bench + row, or split squat + pull-up. Alternate them with 60–90 s between, and 30 min fits 9 hard sets easily.',
      "Суперсети економлять час: один м'яз відпочиває, поки працює інший — наприклад, жим лежачи + тяга, або болгарські випади + підтягування. Чергуй їх із 60–90 с паузи, і за 30 хв влізе 9 важких сетів.",
    ],
    [
      'Mistake: skipping the warm-up to save time. Do 1–2 ramp-up sets of your first lift instead of a long general warm-up — that takes 3–4 minutes, not 15.',
      'Помилка — пропускати розминку заради часу. Замість довгої загальної розминки зроби 1–2 підвідні підходи першої вправи — це 3–4 хвилини, а не 15.',
    ],
    [
      'Pro tip: full-body beats a split when time is short. Three 30-minute full-body sessions a week give most of the results of longer ones.',
      'Порада: коли часу мало, фулбаді краще за спліт. Три тренування по 30 хв на все тіло на тиждень дають більшість результату довгих сесій.',
    ],
  ],
  two_days_row: [
    [
      'Recovery depends on how hard you pushed: sets taken close to failure and lots of eccentric work (slow lowering, lunges, RDLs) need more time. Light technique work barely costs anything.',
      'Відновлення залежить від того, наскільки важко ти працював: підходи близько до відмови й багато негативної фази (повільне опускання, випади, румунська тяга) потребують більше часу. Легка техніка майже нічого не забирає.',
    ],
    [
      "Edge case: you're still sore and a lift feels weak in the warm-up. That's a signal to switch muscle groups today, not to grind through.",
      "Нюанс: якщо м'язи ще болять і вправа на розминці йде важко — це сигнал сьогодні взяти іншу групу, а не продавлювати.",
    ],
    [
      'Pro tip: an upper/lower split lets you train on consecutive days without hitting the same muscles hard twice in 48 h.',
      "Порада: спліт верх/низ дозволяє тренуватися кілька днів поспіль, не навантажуючи ті самі м'язи двічі за 48 годин.",
    ],
  ],
  two_a_day: [
    [
      'The best split is strength first, cardio later, with at least 6 hours between. That gap lets the lift go unhindered and keeps the interference effect small.',
      'Найкраще — силова першою, кардіо пізніше, з перервою хоча б 6 годин. Так силова йде на свіжу голову, а взаємний вплив на результат мінімальний.',
    ],
    [
      'Mistake: doubling sessions without eating more. Two sessions burn more energy — add a proper meal between them with protein and carbs.',
      'Помилка — тренуватися двічі й не доїдати. Дві сесії спалюють більше енергії, тож між ними потрібен повноцінний прийом їжі з білком і вуглеводами.',
    ],
    [
      'Pro tip: short mobility or a 20–30 min walk as the second session helps recovery rather than eating into it.',
      'Порада: коротка мобільність або 20–30 хв прогулянки як друга сесія допомагають відновленню, а не забирають його.',
    ],
  ],
  health_conditions: [
    [
      "The main risk isn't the weight, it's straining with a held breath — that spikes blood pressure. Breathe out through the hard part of each rep and keep sets at 2–3 reps shy of failure.",
      'Головний ризик — не сама вага, а натужування на затриманому диханні, яке різко піднімає тиск. Видихай на найважчій частині повтору й закінчуй підходи за 2–3 повтори до відмови.',
    ],
    [
      'Mistake: starting at the weights you used years ago. Begin at an easy effort for 2–4 weeks and add load slowly; check how you feel the next day, not just during the session.',
      'Помилка — починати з тих ваг, що були колись. Перші 2–4 тижні працюй легко й додавай вагу поступово; оцінюй самопочуття і наступного дня, а не лише на тренуванні.',
    ],
    [
      'Pro tip: tell your doctor the specifics — lifts, frequency, how hard — and ask about your medication and exercise. Some drugs change heart-rate response or balance.',
      'Порада: розкажи лікарю конкретику — які вправи, як часто, наскільки важко — і спитай про свої ліки й навантаження. Деякі препарати впливають на пульс чи рівновагу.',
    ],
  ],
  peds: [
    [
      'Most natural lifters are nowhere near their genetic ceiling. Years of progressive overload, 1.6–2.2 g/kg protein and 7–9 h of sleep keep producing gains long after beginners expect them to stop.',
      'Більшість натуральних атлетів ще дуже далеко від своєї генетичної стелі. Роки прогресії навантаження, 1,6–2,2 г білка на кг і 7–9 годин сну дають результат значно довше, ніж думають новачки.',
    ],
    [
      'Watch out for "legal" alternatives: SARMs and many "test boosters" are unregulated, often mislabelled, and some suppress your own hormones just like steroids do.',
      'Обережно з «легальними» замінниками: SARMs і багато «бустерів тестостерону» ніхто не контролює, склад часто не відповідає етикетці, а деякі пригнічують власні гормони так само, як стероїди.',
    ],
    [
      "Only legit option worth your money: creatine monohydrate, 3–5 g a day. It's safe, cheap and well-studied.",
      'Єдина добавка, яка справді варта грошей, — креатин моногідрат, 3–5 г на день. Безпечний, дешевий і добре досліджений.',
    ],
  ],
  cycle: [
    [
      'Symptoms, not the phase, should steer the session: cramps, fatigue and poor sleep matter more than which week it is. Many women feel strongest in the first half of the cycle, but it varies a lot.',
      'Орієнтуйся на самопочуття, а не на фазу: спазми, втома й поганий сон важать більше, ніж номер тижня. Багато жінок почуваються найсильнішими в першій половині циклу, але в кожної по-своєму.',
    ],
    [
      'Mistake: skipping the whole week by default. Light movement often eases cramps; just drop the load 10–20% or cut a set if you feel off.',
      'Помилка — автоматично пропускати весь тиждень. Легкий рух часто зменшує спазми; просто скинь вагу на 10–20% або зроби на підхід менше, якщо почуваєшся не дуже.',
    ],
    [
      'Pro tip: track your cycle alongside your training for 2–3 months. Patterns show up, and you can plan heavier weeks where you usually feel best.',
      "Порада: 2–3 місяці відмічай цикл поряд із тренуваннями. З'являться закономірності, і важчі тижні можна буде ставити туди, де зазвичай почуваєшся найкраще.",
    ],
  ],
  pregnancy: [
    [
      'The "talk test" is the practical guide: you should be able to speak a sentence during a set. Most women can keep their usual lifts early on, gradually reducing load and range as the bump grows.',
      'Практичний орієнтир — «тест розмови»: під час підходу ти маєш могти сказати речення. На ранніх термінах більшість жінок продовжують звичні вправи, поступово зменшуючи вагу й амплітуду з ростом живота.',
    ],
    [
      'Watch for coning or doming along the midline of your belly during a lift — it means too much abdominal pressure; change the exercise. Stop and seek care with bleeding, fluid loss, dizziness or chest pain.',
      'Стеж, чи не випинається живіт гребенем по центральній лінії під час вправи — це ознака надмірного тиску, зміни вправу. Кровотеча, підтікання рідини, запаморочення чи біль у грудях — зупиняйся й звертайся до лікаря.',
    ],
    [
      'Postpartum, start with breathing and pelvic-floor work and walking; a pelvic-floor physio check before heavy lifting or running is well worth it.',
      "Після пологів починай із дихання, м'язів тазового дна й прогулянок; перед важкими вагами чи бігом варто сходити до фізіотерапевта з тазового дна.",
    ],
  ],
  hr_zones: [
    [
      'Max HR estimate: 208 − 0.7 × age is better than the old 220 − age, but still ±10 beats off for many people. The talk test or nose-breathing is often more reliable than any formula.',
      'Максимальний пульс краще рахувати як 208 − 0,7 × вік, а не старим 220 − вік, але й так похибка буває ±10 ударів. «Тест розмови» або дихання носом часто надійніші за будь-яку формулу.',
    ],
    [
      'Mistake: every cardio session turning into a moderate "grey zone" slog — too hard to recover from, too easy to push fitness much. Keep easy days truly easy.',
      'Помилка — коли кожне кардіо перетворюється на «сіру зону»: важко, щоб легко відновитися, і замало, щоб підтягнути форму. Легкі дні мають бути справді легкими.',
    ],
    [
      "Pro tip: roughly 80% easy, 20% hard across your week's cardio is a well-tested split, and it interferes least with lifting.",
      'Порада: приблизно 80% легкого й 20% інтенсивного кардіо за тиждень — перевірене співвідношення, і воно найменше заважає силовим.',
    ],
  ],
  hiit: [
    [
      "\"Hard\" means 8–9 out of 10 — you couldn't keep it up for more than those 20–30 s. If you could, the interval isn't hard enough; if you can't finish round 6, rest longer.",
      '«Інтенсивно» — це 8–9 з 10: довше за ці 20–30 с ти б не витримав. Якщо міг би — інтервал замало інтенсивний; якщо не можеш закінчити 6-й раунд — збільш відпочинок.',
    ],
    [
      "Mistake: doing HIIT 4–5 times a week for fat loss. It's taxing and eats into lifting recovery; the calorie burn is modest — diet and steps do more.",
      'Помилка — робити HIIT 4–5 разів на тиждень заради схуднення. Це виснажує й забирає відновлення від силових, а калорій спалює небагато — харчування й кроки дають більше.',
    ],
    [
      'Pro tip: sprint-style HIIT on a bike right after upper-body day, or on a rest day, gives the fitness boost without costing leg strength.',
      'Порада: спринтові інтервали на велотренажері одразу після дня верху або в день відпочинку дають приріст витривалості, не забираючи сили ніг.',
    ],
  ],
  running: [
    [
      "Easy pace means conversational — for most people that's 1–2 min per km slower than feels natural. That's where the aerobic base is built with little fatigue.",
      'Легкий темп — це темп, у якому можна розмовляти; для більшості це на 1–2 хв/км повільніше, ніж хочеться бігти. Саме так будується аеробна база з мінімальною втомою.',
    ],
    [
      "Mistake: ramping mileage and squat volume at the same time. Shins, knees and Achilles don't adapt as fast as lungs — grow one at a time.",
      'Помилка — одночасно нарощувати кілометраж і обсяг присідань. Гомілки, коліна й ахілл адаптуються повільніше за легені, тож збільшуй щось одне.',
    ],
    [
      'Pro tip: lifting makes you a better runner — heavy squats, split squats and calf raises improve running economy and cut injury risk.',
      'Порада: силові роблять тебе кращим бігуном — важкі присідання, болгарські випади й підйоми на носки покращують економічність бігу й знижують ризик травм.',
    ],
  ],
  steps: [
    [
      'Walking burns roughly 30–50 kcal per 1,000 steps depending on your size. Going from 4k to 9k steps can be 200–250 kcal a day — as much as a hard cardio session.',
      'Ходьба спалює приблизно 30–50 ккал на 1000 кроків залежно від твоєї ваги. Перейти з 4 тис. на 9 тис. кроків — це 200–250 ккал на день, як повноцінне кардіо.',
    ],
    [
      'Mistake: counting on steps only on gym days. On a diet, steps often quietly drop as energy dips — keep a daily floor, e.g. never below 6k.',
      'Помилка — ходити лише в дні тренувань. На дієті кроки часто непомітно падають разом з енергією, тож тримай мінімум — наприклад, не менше 6 тис. на день.',
    ],
    [
      'Pro tip: a 10-minute walk after meals improves blood sugar and adds 1,000+ steps without any extra planning.',
      'Порада: 10 хвилин прогулянки після їжі покращують рівень цукру й додають понад 1000 кроків без жодного планування.',
    ],
  ],
  posture: [
    [
      'Aim for about 2 sets of pulling for every set of pressing for a few months. Rows, face pulls (15–20 reps) and reverse flys build the upper back that holds shoulders in a neutral spot.',
      'Кілька місяців роби приблизно 2 підходи тяги на кожен підхід жиму. Тяги, фейс-пули (15–20 повторів) і розведення в нахилі будують верх спини, який тримає плечі в нейтральному положенні.',
    ],
    [
      'Mistake: forcing shoulders back all day. Holding any position rigidly tires you out; comfortable variety beats one "perfect" posture. Rounded posture alone isn\'t a cause of pain.',
      'Помилка — весь день силою тягнути плечі назад. Будь-яка скута поза втомлює; зручна різноманітність краща за одну «ідеальну». Сама по собі сутулість не є причиною болю.',
    ],
    [
      'Pro tip: set a reminder to stand or move every 30–45 min at a desk, and do a few doorway chest stretches and band pull-aparts during breaks.',
      'Порада: постав нагадування вставати чи рухатися кожні 30–45 хв за столом, а на перервах роби розтяжку грудей у дверному отворі й розведення з гумою.',
    ],
  ],
  other_sport: [
    [
      "Focus on power and robustness: heavy squats or trap-bar deadlifts for 3–5 reps, jumps or med-ball throws, and single-leg work. Leave 2–3 reps in reserve so you're not wrecked for practice.",
      'Акцент на силу, вибуховість і міцність: важкі присідання чи тяга з трап-грифом на 3–5 повторів, стрибки або кидки медболу, вправи на одну ногу. Залишай 2–3 повтори в запасі, щоб не бути вбитим на тренуванні зі спорту.',
    ],
    [
      'Mistake: training like a bodybuilder — lots of isolation to failure leaves you sore for the sport. Keep soreness low, especially in-season.',
      "Помилка — тренуватися як бодібілдер: купа ізоляції до відмови, а потім м'язи болять на основному спорті. Тримай крепатуру мінімальною, особливо в сезоні.",
    ],
    [
      'Pro tip: off-season build strength with 3 sessions a week; in-season drop to 1–2 short sessions just to keep it — fewer sets, same heavy weights.',
      'Порада: у міжсезоння набирай силу — 3 тренування на тиждень; у сезоні зменш до 1–2 коротких, щоб зберегти: менше підходів, але ті самі важкі ваги.',
    ],
  ],
  home_equipment: [
    [
      'Adjustable dumbbells that go to at least 25–30 kg per hand cover most people for years. An adjustable bench (flat to incline) doubles your exercise options.',
      'Розбірні гантелі хоча б до 25–30 кг на руку більшості вистачає на роки. Регульована лава (від горизонталі до нахилу) подвоює кількість вправ.',
    ],
    [
      "Mistake: buying a cheap rack or bench with a low weight rating. Check the load limit and stability — it's the thing holding the bar over your chest.",
      'Помилка — брати дешеву стійку чи лаву з низьким допустимим навантаженням. Перевір ліміт ваги й стійкість — саме вони тримають гриф над твоїми грудьми.',
    ],
    [
      "Pro tip: buy used plates and dumbbells — iron doesn't wear out, and second-hand is often half the price. Put rubber flooring under anything heavy.",
      'Порада: млинці й гантелі купуй б/в — залізу нічого не буде, а вживане часто вдвічі дешевше. Під усе важке постели гумове покриття.',
    ],
  ],
  what_can_i_ask: [
    [
      'I work best with questions about your own log: progress on a lift, volume per muscle, what to do next session, how a period compares with another. General training, recovery and nutrition questions work too.',
      "Найкраще я відповідаю на питання про твої записи: прогрес у вправі, обсяг на м'яз, що робити наступного разу, порівняння періодів. Загальні питання про тренування, відновлення й харчування теж підходять.",
    ],
    [
      'Tip for better answers: name the lift and the period — "squat since June" beats "how am I doing". Short questions are fine; I don\'t need full sentences.',
      "Щоб відповідь була точнішою, називай вправу й період: «присід з червня» краще, ніж «як у мене справи». Короткі питання — нормально, повні речення не обов'язкові.",
    ],
    [
      "I'm not a doctor: for pain that's sharp, lasting or comes with numbness, I'll point you to one rather than guess.",
      'Я не лікар: якщо біль гострий, не минає або є оніміння, я порекомендую звернутися до спеціаліста, а не гадатиму.',
    ],
  ],
  reminder: [
    [
      "The skip reminder looks at the days you usually train. If you normally lift on Mondays and nothing's logged by evening, you get a nudge.",
      'Нагадування про пропуск орієнтується на дні, коли ти зазвичай тренуєшся. Якщо ти завжди займаєшся в понеділок, а до вечора нічого не записано, прийде нагадування.',
    ],
    [
      "Not getting reminders? Check that notifications are allowed for the app in your phone settings and that battery saver isn't blocking them.",
      'Не приходять нагадування? Перевір, чи дозволені сповіщення для застосунку в налаштуваннях телефона і чи не блокує їх режим економії батареї.',
    ],
    [
      'Pro tip: reminders help, but a fixed slot helps more — same days, same time, gym bag packed the night before.',
      'Порада: нагадування допомагають, але фіксований час допомагає ще більше — ті самі дні, та сама година, сумка зібрана з вечора.',
    ],
  ],
  memory_show: [
    [
      'Useful things to tell me: injuries or lifts that hurt, your goal (strength, size, fat loss), how long a session can be, equipment you have, and exercises you hate. I use them when suggesting workouts and swaps.',
      'Що корисно мені розповісти: травми чи вправи, що болять, твою ціль (сила, маса, схуднення), скільки часу є на тренування, яке є обладнання й які вправи ти терпіти не можеш. Я враховую це, коли підказую тренування й заміни.',
    ],
    [
      "Keep it current: if an injury heals or your goal changes, tell me — otherwise I'll keep working around something that no longer applies.",
      'Оновлюй інформацію: якщо травма минула чи змінилася ціль — скажи мені, інакше я й далі обходитиму те, що вже неактуально.',
    ],
  ],
  range_count: [
    [
      'Only saved sessions and working sets count; warm-ups marked as such are left out. The weekly average is total sessions divided by the number of weeks in the range.',
      'Рахуються лише збережені тренування й робочі підходи; позначені розминочні не входять. Середнє на тиждень — це всі тренування, поділені на кількість тижнів у періоді.',
    ],
    [
      'Edge case: a holiday or illness drags the average down. Look at the typical week too, not just the total.',
      'Нюанс: відпустка чи хвороба тягнуть середнє вниз. Дивися й на типовий тиждень, а не лише на загальну цифру.',
    ],
    [
      'Benchmark: 2–4 sessions a week, sustained for months, is where most steady progress happens.',
      'Орієнтир: 2–4 тренування на тиждень протягом місяців — саме там відбувається більшість стабільного прогресу.',
    ],
  ],
  range_summary: [
    [
      'The summary pulls three things: how often you trained, how much work you did, and whether any bests fell. Those three tell most of the story of a training block.',
      'Підсумок бере три речі: як часто ти тренувався, скільки роботи зробив і чи були нові рекорди. Ці три показники розповідають майже все про тренувальний блок.',
    ],
    [
      '"No new bests" over one month isn\'t a red flag — strength moves in steps. Over 2–3 months with steady training, it\'s worth a look.',
      '«Без нових рекордів» за місяць — не тривожний сигнал, сила росте сходинками. А от якщо так 2–3 місяці при регулярних тренуваннях — варто розібратися.',
    ],
    [
      'Pro tip: check the summary at the end of each month and pick one thing to change for the next — one more session, one lift to push.',
      'Порада: наприкінці кожного місяця дивися підсумок і обирай одну зміну на наступний — ще одне тренування чи одну вправу, яку тиснеш.',
    ],
  ],
  range_lift: [
    [
      'Estimated max is calculated from your best set each session (weight and reps), so an 8-rep set counts, not just heavy singles. It lets sessions with different rep ranges be compared fairly.',
      'Розрахунковий максимум рахується з найкращого підходу кожного тренування (вага й повтори), тож зараховується і сет на 8 повторів, а не лише важкі одиночки. Так можна чесно порівнювати тренування з різною кількістю повторів.',
    ],
    [
      'Edge case: estimates get less accurate above ~10 reps and when sets are far from failure. Treat small changes of 1–2% as noise.',
      'Нюанс: оцінка стає менш точною, якщо повторів більше ~10 або підходи далекі від відмови. Зміни на 1–2% вважай шумом.',
    ],
    [
      'Benchmark: beginners can add a few % a month; after 2–3 years, 5–10% a year on a main lift is solid progress.',
      'Орієнтир: новачки можуть додавати кілька відсотків на місяць; після 2–3 років 5–10% на рік в основній вправі — це добрий прогрес.',
    ],
  ],
  range_muscle: [
    [
      'Sets are counted per target muscle: a bench set counts for chest, a row for back. Compound lifts may also add to helper muscles, so arms often get more work than you think.',
      "Підходи рахуються на цільовий м'яз: жим лежачи — груди, тяга — спина. Базові вправи також навантажують допоміжні м'язи, тож руки часто отримують більше роботи, ніж здається.",
    ],
    [
      'Benchmark: ~10–20 hard sets per muscle per week works for most people. Under ~6 is maintenance territory; well over 20 often outruns recovery.',
      "Орієнтир: ~10–20 важких підходів на м'яз за тиждень підходять більшості. Менше ~6 — це вже радше підтримка; значно більше 20 часто перевищує відновлення.",
    ],
    [
      "Pro tip: if one muscle lags, add 2–4 weekly sets for it and take the same from a muscle that's ahead — total time stays the same.",
      "Порада: якщо якийсь м'яз відстає, додай йому 2–4 підходи на тиждень і стільки ж забери в того, що попереду, — загальний час не зміниться.",
    ],
  ],
  range_bw: [
    [
      "Daily weight swings 1–2 kg from water, salt, carbs and digestion. Use the weekly average: compare this week's average to last week's, not two single weigh-ins.",
      'Вага щодня коливається на 1–2 кг через воду, сіль, вуглеводи й травлення. Дивися на середнє за тиждень і порівнюй його з минулим тижнем, а не два окремі зважування.',
    ],
    [
      'Mistake: weighing at random times. Same conditions every time — morning, after the toilet, before food or drink — make the trend readable.',
      'Помилка — зважуватися коли прийдеться. Однакові умови — зранку, після туалету, до їжі й води — роблять тенденцію зрозумілою.',
    ],
    [
      "Pro tip: pair the scale with strength. Weight dropping while lifts hold means you're losing mostly fat; weight rising with lifts climbing on a bulk is on track.",
      'Порада: дивися на вагу разом із силою. Вага падає, а робочі ваги тримаються — значить, іде переважно жир; на масі вага росте разом із силою — все за планом.',
    ],
  ],
  then_vs_now: [
    [
      'I compare estimated max at both points, which evens out different rep ranges. Anything within ±2% is basically the same strength.',
      'Я порівнюю розрахунковий максимум у двох точках — так вирівнюються різні діапазони повторів. Різниця в межах ±2% — це фактично та сама сила.',
    ],
    [
      'Common reasons for no change: the same weights for months without adding reps, too few sessions, poor sleep, or a calorie deficit. Being on a cut and holding strength is actually a win.',
      'Типові причини застою: ті самі ваги місяцями без додавання повторів, замало тренувань, поганий сон або дефіцит калорій. А якщо ти на сушці й сила тримається — це вже успіх.',
    ],
    [
      'Pro tip: pick one lift and commit to double progression — add reps until the top of the range, then add 2.5 kg. Recheck in 6–8 weeks.',
      'Порада: візьми одну вправу й працюй за подвійною прогресією — додавай повтори до верхньої межі, потім +2,5 кг. Перевір знову через 6–8 тижнів.',
    ],
  ],
  compare_lifts: [
    [
      'Rough ratios for trained lifters: squat ≈ 1.2–1.3× bench, deadlift ≈ 1.2× squat, overhead press ≈ 0.6–0.7× bench. Body proportions shift these by 10–15% either way.',
      'Орієнтовні співвідношення для тренованих: присід ≈ 1,2–1,3 жиму лежачи, станова ≈ 1,2 присіду, жим стоячи ≈ 0,6–0,7 жиму лежачи. Пропорції тіла зсувають це на 10–15% в будь-який бік.',
    ],
    [
      'Mistake: chasing ratios for their own sake. Long arms make bench harder and deadlift easier — a "lagging" lift may just be your build.',
      'Помилка — гнатися за співвідношеннями заради них самих. З довгими руками жим лежачи важчий, а станова легша — «відстала» вправа може бути просто особливістю будови.',
    ],
    [
      'Pro tip: the trend matters more than the ratio. If one lift is flat for 8 weeks while others climb, give it priority: do it first in the session.',
      'Порада: тенденція важливіша за співвідношення. Якщо одна вправа стоїть 8 тижнів, а інші ростуть — дай їй пріоритет: роби її першою на тренуванні.',
    ],
  ],
  why_today: [
    [
      'A muscle counts as recovered roughly 48–72 h after hard work, depending on how many sets you did. Big lower-body days need the longer end.',
      "М'яз вважається відновленим приблизно через 48–72 год після важкої роботи — залежно від кількості підходів. Великим дням на ноги потрібна верхня межа.",
    ],
    [
      'Edge case: you feel beat up even though the muscles are marked recovered — bad sleep or stress counts too. Go lighter or swap the day.',
      "Нюанс: м'язи позначені як відновлені, а ти почуваєшся розбитим — поганий сон і стрес теж впливають. Зроби легше або поміняй день.",
    ],
    [
      'Pro tip: keeping the same weekday pattern makes progress easier to track and the habit easier to keep.',
      'Порада: однаковий розклад по днях тижня полегшує і відстеження прогресу, і дотримання звички.',
    ],
  ],
  why_weight: [
    [
      'This is double progression: work in a rep range like 6–10, add reps at the same weight until you hit the top on all sets, then add the smallest jump (usually 2.5 kg on upper-body lifts, 2.5–5 kg on lower).',
      'Це подвійна прогресія: працюєш у діапазоні, наприклад, 6–10, додаєш повтори з тією ж вагою, поки не виконаєш верхню межу в усіх підходах, потім — мінімальний крок (зазвичай 2,5 кг на верх тіла, 2,5–5 кг на ноги).',
    ],
    [
      'Mistake: jumping weight after one good set. If reps fall to the bottom of the range next time, the jump was too early.',
      'Помилка — піднімати вагу після одного вдалого підходу. Якщо наступного разу повтори падають до нижньої межі — крок був зарано.',
    ],
    [
      'Pro tip: when a jump is too big, use micro-plates (0.5–1.25 kg) or add a rep across sets before moving up.',
      'Порада: якщо крок завеликий — використовуй маленькі млинці (0,5–1,25 кг) або додавай по одному повтору в підходах перед підйомом ваги.',
    ],
  ],
  why_plan: [
    [
      'Building on your existing habits means the plan fits your week from day one — adherence matters more than the "perfect" split.',
      'Коли план спирається на твої звички, він з першого дня вписується в твій тиждень, а дотримання важливіше за «ідеальний» спліт.',
    ],
    [
      'Edge case: if your life changes — new job, more or fewer days — the old pattern stops fitting. Train a few weeks in the new rhythm and the plan follows.',
      'Нюанс: якщо змінюється життя — нова робота, більше чи менше вільних днів — старий шаблон перестає пасувати. Потренуйся кілька тижнів у новому ритмі, і план підлаштується.',
    ],
    [
      'Pro tip: run a plan for at least 6–8 weeks before judging it. Switching every 2 weeks resets progress.',
      'Порада: працюй за планом хоча б 6–8 тижнів, перш ніж оцінювати. Якщо міняти кожні 2 тижні, прогрес щоразу скидається.',
    ],
  ],
  why_lift: [
    [
      'Repeating a lift often makes progress visible: you learn the technique, the numbers become comparable, and small gains show up week to week.',
      'Коли вправа регулярно повторюється, прогрес видно: техніка відточується, цифри можна порівнювати, і навіть невеликий приріст помітний щотижня.',
    ],
    [
      "Edge case: if a lift hurts or you can't do it in your gym, ask for an alternative — a similar movement for the same muscle keeps the plan working.",
      "Нюанс: якщо вправа викликає біль або її нема як зробити у твоєму залі — попроси альтернативу; схожий рух на той самий м'яз збереже логіку плану.",
    ],
    [
      'Pro tip: keep your main lifts for at least 8–12 weeks; rotate accessories more often if you get bored.',
      'Порада: основні вправи тримай хоча б 8–12 тижнів, а допоміжні можна міняти частіше, якщо набридає.',
    ],
  ],
  pain_types: [
    [
      'Normal muscle soreness (DOMS) peaks 24–48 h after training, feels tender to touch and eases as you warm up. Joint pain tends to be pinpoint and often gets worse as you warm up or load it.',
      "Звичайна крепатура найсильніша через 24–48 год після тренування, м'яз болить при натисканні, а під час розминки біль слабшає. Біль у суглобі зазвичай точковий і часто посилюється з розминкою чи навантаженням.",
    ],
    [
      'Use a 0–10 scale: up to 3/10 that settles by the next day is usually OK to train around. Above that, or pain that wakes you up at night, means stop and get it checked.',
      'Користуйся шкалою 0–10: до 3/10, що минає до наступного дня, зазвичай дозволяє тренуватися з обережністю. Більше або біль, що будить уночі, — зупинись і покажися спеціалісту.',
    ],
    [
      "Pro tip: train around it, not through it — swap the painful lift for a variation that doesn't hurt, keep everything else going.",
      'Порада: обходь біль, а не продавлюй його — заміни болючу вправу на варіацію без болю, а решту продовжуй як звичайно.',
    ],
  ],
  ice_heat: [
    [
      'Cold numbs pain and calms swelling short-term; heat relaxes muscle and eases stiffness. Always put a cloth between skin and ice, and never use heat on a fresh, swollen injury.',
      "Холод притуплює біль і ненадовго зменшує набряк; тепло розслабляє м'язи й знімає скутість. Лід клади лише через тканину, а свіжу травму з набряком не грій.",
    ],
    [
      'Mistake: icing sore muscles right after every workout. Regular icing may blunt some of the muscle adaptation you train for — save it for pain relief.',
      "Помилка — прикладати лід до м'язів після кожного тренування. Регулярне охолодження може трохи гальмувати адаптацію, заради якої ти тренуєшся, тож використовуй його лише від болю.",
    ],
    [
      'Pro tip: gentle movement in a pain-free range — walking, easy cycling, light sets — speeds recovery more than either ice or heat.',
      'Порада: легкий рух у безболісній амплітуді — ходьба, спокійний велосипед, легкі підходи — прискорює відновлення більше, ніж лід чи тепло.',
    ],
  ],
  painkillers: [
    [
      'Pain tells you how much load a tissue tolerates today. Masking it lets you push past that limit and can turn a minor niggle into a real injury.',
      'Біль показує, яке навантаження тканина витримує сьогодні. Заглушивши його, легко перейти межу й перетворити дрібницю на серйозну травму.',
    ],
    [
      "Also: regular anti-inflammatories before training can irritate the stomach and strain the kidneys, especially if you're dehydrated. That's a doctor or pharmacist conversation.",
      'До того ж регулярні протизапальні перед тренуваннями можуть подразнювати шлунок і навантажувати нирки, особливо при зневодненні. Це питання до лікаря чи фармацевта.',
    ],
    [
      "Better route: lower the load, change the exercise to a pain-free version and keep training what doesn't hurt.",
      'Кращий шлях: зменшити вагу, замінити вправу на безболісний варіант і тренувати те, що не болить.',
    ],
  ],
  tendon: [
    [
      'Holds work well early: 5 × 30–45 s isometric holds at a moderately heavy load often ease pain within the session. Later, move to slow reps — 3 s up, 3 s down.',
      'На початку добре працюють статичні утримання: 5 × 30–45 с з помірно важкою вагою часто зменшують біль вже під час тренування. Далі переходь на повільні повтори — 3 с вгору, 3 с вниз.',
    ],
    [
      'Mistake: resting completely, then jumping straight back in. Tendons lose load tolerance with rest; also avoid sudden spikes in jumping, sprinting or volume.',
      'Помилка — повністю відпочивати, а потім одразу повертатися на повну. Без навантаження сухожилки гірше його переносять; також уникай різкого збільшення стрибків, спринтів чи обсягу.',
    ],
    [
      "Pro tip: judge by next-morning pain. If it's no worse than usual the day after, the load was fine — keep building.",
      'Порада: орієнтуйся на біль наступного ранку. Якщо не гірше, ніж зазвичай, навантаження підійшло — продовжуй поступово додавати.',
    ],
  ],
  cramps: [
    [
      "Most exercise cramps come from tired muscles misfiring, not from low minerals alone. That's why they hit late in a session or on the last reps of a hard set.",
      "Більшість судом під час тренувань — від утомлених м'язів, що дають збій, а не лише від нестачі мінералів. Тому вони й хапають наприкінці тренування чи на останніх повторах важкого сету.",
    ],
    [
      'Edge case: calf cramps in short-range positions (pointing toes, hamstring curls) are common — adjust the foot position. Frequent cramps at rest, or with swelling, are a doctor visit.',
      'Нюанс: судоми в ікрах у скороченому положенні (носок витягнутий, згинання ніг) — звична річ, зміни положення стопи. Часті судоми в спокої або з набряком — привід піти до лікаря.',
    ],
    [
      'Pro tip: if a muscle cramps often, train it earlier in the session and build its volume gradually.',
      "Порада: якщо якийсь м'яз часто зводить, став його на початок тренування й нарощуй обсяг поступово.",
    ],
  ],
  numbness: [
    [
      'Common gym culprits: a tight grip or bar pressing on the wrist (carpal tunnel area), elbow flexed for long (ulnar nerve — pinky side), or neck and shoulder positions compressing nerves to the arm.',
      "Типові причини в залі: сильний хват чи гриф, що тисне на зап'ясток, довго зігнутий лікоть (ліктьовий нерв — з боку мізинця), або положення шиї й плечей, що стискає нерви руки.",
    ],
    [
      "Quick fixes to try: straps on heavy pulls, a neutral wrist on presses, shorter sets for exercises with bent elbows. If it doesn't change within a couple of weeks, get it assessed.",
      "Що можна спробувати: лямки на важких тягах, рівне зап'ястя в жимах, коротші підходи у вправах із зігнутим ліктем. Якщо за пару тижнів нічого не змінюється — покажися спеціалісту.",
    ],
    [
      'Urgent: sudden numbness on one side of the body, face drooping or slurred speech needs emergency help immediately.',
      'Терміново: раптове оніміння однієї половини тіла, перекошене обличчя чи порушення мови — одразу викликай швидку.',
    ],
  ],
  calories: [
    [
      'Maintenance ≈ bodyweight × 29–33 kcal for active lifters; less if you sit most of the day, more with lots of steps or a physical job. Formulas can be off by 10–15% either way, so treat it as a starting point.',
      'Підтримка ≈ вага тіла × 29–33 ккал для активних; менше, якщо весь день сидиш, більше — при великій кількості кроків чи фізичній роботі. Формули можуть помилятися на 10–15% в обидва боки, тож це лише точка старту.',
    ],
    [
      'Mistake: tracking only weekdays. Weekends often add 500–1,000 kcal and explain why "the numbers don\'t work".',
      'Помилка — рахувати лише будні. Вихідні часто додають 500–1000 ккал і пояснюють, чому «цифри не сходяться».',
    ],
    [
      'Pro tip: weigh foods for 1–2 weeks to calibrate your eye, then you can estimate much more accurately without a scale.',
      'Порада: 1–2 тижні зважуй їжу, щоб навчити око, — потім зможеш точно оцінювати порції й без ваг.',
    ],
  ],
  cut_deficit: [
    [
      'Most of the loss should come from food, not extra cardio: cut 300–500 kcal from meals, keep steps at 7–10k. Hard cardio on top eats into lifting recovery.',
      'Більша частина дефіциту має йти з їжі, а не з додаткового кардіо: зріж 300–500 ккал з раціону, тримай 7–10 тис. кроків. Інтенсивне кардіо зверху забирає відновлення від силових.',
    ],
    [
      'Mistake: cutting harder when the scale stalls for a week. Water can mask fat loss for 1–2 weeks — wait for a 2–3 week trend before dropping calories further.',
      'Помилка — ще більше урізати калорії, коли вага стоїть тиждень. Вода може маскувати втрату жиру 1–2 тижні, тож чекай тенденцію за 2–3 тижні, перш ніж знижувати калорії.',
    ],
    [
      'Pro tip: after 8–12 weeks of dieting, take 1–2 weeks at maintenance. Training quality and hunger usually improve, and the next phase goes easier.',
      'Порада: після 8–12 тижнів сушки зроби 1–2 тижні на підтримці. Зазвичай тренування йдуть краще, голод слабшає, і наступний етап дається легше.',
    ],
  ],
  bulk_surplus: [
    [
      "Muscle grows slowly — maybe 0.5–1 kg a month for a beginner, much less later. Eating far beyond that doesn't build muscle faster; the extra is stored as fat.",
      "М'язи ростуть повільно — у новачка може бути 0,5–1 кг на місяць, далі значно менше. Їсти набагато більше не пришвидшує ріст м'язів — надлишок відкладається в жир.",
    ],
    [
      'Mistake: a "dirty bulk" of junk food. You gain the weight, but a big fat gain means a longer cut later. Keep protein at ~1.6–2.2 g/kg and most food whole.',
      'Помилка — «брудна маса» на фастфуді. Вага росте, але багато жиру означає довшу сушку потім. Тримай білок ~1,6–2,2 г/кг і їж переважно нормальну їжу.',
    ],
    [
      'Pro tip: hard gainer? Add calorie-dense foods — oats, nuts, olive oil, whole milk — rather than forcing bigger plates.',
      'Порада: важко набирати? Додай калорійні продукти — вівсянку, горіхи, оливкову олію, цільне молоко — замість того, щоб впихати більші порції.',
    ],
  ],
  carbs: [
    [
      'Carbs refill muscle glycogen, which fuels sets of 6–15 reps. Low glycogen shows up as fewer reps and a flat pump, not usually lower top strength.',
      "Вуглеводи поповнюють глікоген у м'язах, який живить підходи на 6–15 повторів. Коли глікогену мало, це видно по меншій кількості повторів і слабкому пампу, а не падінням максимальної сили.",
    ],
    [
      "Mistake: cutting carbs and blaming training for feeling weak. If you go low-carb, give it 2–3 weeks to adapt and don't expect peak volume sessions.",
      'Помилка — урізати вуглеводи, а потім дивуватися, чому немає сил на тренуванні. Якщо переходиш на низьковуглеводку — дай 2–3 тижні на адаптацію й не чекай рекордних за обсягом тренувань.',
    ],
    [
      'Pro tip: put 30–50% of your daily carbs in the meals before and after training — rice, potatoes, oats, fruit, bread.',
      'Порада: 30–50% денних вуглеводів став у прийоми їжі до й після тренування — рис, картопля, вівсянка, фрукти, хліб.',
    ],
  ],
  fats: [
    [
      'Going below ~0.5 g/kg for long can hurt hormones and satiety — especially on a cut. Fats also carry vitamins A, D, E and K.',
      'Якщо надовго опуститися нижче ~0,5 г/кг, можуть постраждати гормони й ситість — особливо на сушці. Крім того, з жирами засвоюються вітаміни A, D, E і K.',
    ],
    [
      'Mistake: forgetting fats are calorie-dense. A tablespoon of oil is ~120 kcal, a handful of nuts ~200 — easy to overshoot without noticing.',
      'Помилка — забувати, що жири дуже калорійні. Ложка олії — це ~120 ккал, жменя горіхів — ~200, тож перебрати дуже легко й непомітно.',
    ],
    [
      "Pro tip: measure oil with a spoon instead of pouring. It's the single easiest calorie leak to fix.",
      'Порада: відміряй олію ложкою, а не лий «на око». Це найпростіша діра в калоріях, яку можна закрити.',
    ],
  ],
  pre_meal: [
    [
      'The closer to training, the less fat and fibre: they slow digestion and can sit heavy. 2–3 h out, a full plate is fine; under 1 h, stick to easy carbs.',
      'Чим ближче до тренування, тим менше жиру й клітковини: вони сповільнюють травлення й можуть лежати каменем. За 2–3 год можна повноцінну тарілку; менш ніж за годину — лише легкі вуглеводи.',
    ],
    [
      'Edge case: training first thing in the morning. Fasted is fine for most sessions; if you feel weak, a banana or a glass of juice 15–30 min before helps.',
      'Нюанс: тренування одразу зранку. Натщесерце для більшості тренувань нормально; якщо бракує сил — банан чи склянка соку за 15–30 хв до початку допоможуть.',
    ],
    [
      'Pro tip: if you use caffeine, 3 mg/kg about 30–60 min before is the well-studied dose — and skip it within ~8 h of bedtime.',
      "Порада: якщо п'єш кофеїн, добре досліджена доза — 3 мг/кг приблизно за 30–60 хв до тренування; і не пізніше ніж за ~8 год до сну.",
    ],
  ],
  post_meal: [
    [
      'Protein after training kicks off muscle repair; ~0.3–0.4 g/kg per meal hits the useful dose. Carbs refill glycogen, which matters most if you train again within 24 h.',
      "Білок після тренування запускає відновлення м'язів; ~0,3–0,4 г/кг на прийом — це ефективна доза. Вуглеводи поповнюють глікоген, що важливо передусім, якщо наступне тренування менш ніж через добу.",
    ],
    [
      "Edge case: trained fasted in the morning? Then eat soon after — you've had no protein for many hours, so the window matters more here.",
      'Нюанс: тренувався зранку натщесерце? Тоді поїж невдовзі після — білка не було багато годин, і тут «вікно» справді має значення.',
    ],
    [
      "Pro tip: a normal meal works — chicken with rice, eggs on toast, or a shake with a banana if you're on the go.",
      'Порада: звичайна їжа цілком підходить — курка з рисом, яйця з тостом або протеїновий коктейль з бананом, якщо ти в дорозі.',
    ],
  ],
  meals_count: [
    [
      "Spreading protein over 3–5 meals, 3–5 hours apart, keeps muscle building switched on through the day. It's a small bonus on top of hitting the daily total.",
      "Білок, розподілений на 3–5 прийомів із перервою 3–5 годин, підтримує синтез м'язів протягом дня. Це невеликий бонус до головного — денної норми.",
    ],
    [
      "Edge case: intermittent fasting with 2 meals works if you still hit your protein — it's just harder, so each meal needs ~50+ g.",
      'Нюанс: інтервальне голодування з 2 прийомами їжі працює, якщо ти все одно добираєш білок, — просто це складніше, і кожен прийом має містити ~50+ г.',
    ],
    [
      'Pro tip: pick a number you can keep on your busiest day. Consistency beats the "optimal" count you\'ll drop by Wednesday.',
      'Порада: обери кількість, яку втримаєш навіть у найзавантаженіший день. Стабільність важить більше, ніж «оптимальна» схема, яку кинеш до середи.',
    ],
  ],
  vegan: [
    [
      'Plant proteins have less leucine and are digested a bit less efficiently, which is why the target is higher. Combining sources — grains with legumes, soy, pea-rice blends — fills the gaps.',
      'У рослинних білках менше лейцину, і засвоюються вони трохи гірше, тому й норма вища. Поєднання джерел — крупи з бобовими, соя, суміші горохового й рисового протеїну — закриває ці прогалини.',
    ],
    [
      'Mistake: eating mostly vegetables and grains and falling short on protein. Plan 25–40 g per meal from tofu, tempeh, seitan, lentils or a protein powder.',
      'Помилка — їсти переважно овочі й крупи й недобирати білок. Плануй 25–40 г на прийом із тофу, темпе, сейтану, сочевиці чи протеїну.',
    ],
    [
      "Pro tip: besides B12, check vitamin D, iron, iodine and omega-3 (algae oil) with your doctor — they're the usual gaps on a vegan diet.",
      'Порада: окрім B12, перевір із лікарем вітамін D, залізо, йод і омега-3 (олія з водоростей) — саме їх найчастіше бракує на веганському харчуванні.',
    ],
  ],
  cheat_meal: [
    [
      'Some of the scale jump next day is water and food weight from extra salt and carbs, not fat. It usually drops in 2–3 days.',
      'Частина стрибка ваги наступного дня — це вода й вміст кишечника через сіль і вуглеводи, а не жир. Зазвичай іде за 2–3 дні.',
    ],
    [
      'Mistake: the "cheat day" that turns into a cheat weekend. One meal is fine; a full day at +2,000 kcal can wipe out most of a week\'s deficit.',
      "Помилка — коли «читмил» перетворюється на читвікенд. Один прийом — нормально, а цілий день із +2000 ккал може з'їсти більшість тижневого дефіциту.",
    ],
    [
      'Pro tip: plan it — a social meal or a favourite dish — rather than using it as a reward. Planned treats make diets easier to stick with.',
      'Порада: плануй його — застілля з друзями чи улюблена страва, — а не використовуй як нагороду. Заплановані поблажки допомагають довше триматися раціону.',
    ],
  ],
  sugar: [
    [
      "The problem with sugary foods is that they're easy to overeat and don't fill you up — 500 kcal of sweets vanishes fast, 500 kcal of potatoes doesn't.",
      'Проблема солодкого в тому, що його легко переїсти, а ситості воно не дає: 500 ккал цукерок зникають миттю, а 500 ккал картоплі — ні.',
    ],
    [
      "Watch liquid sugar most: juice, soda and sweet coffee drinks add a lot of calories you don't feel. Water, zero drinks or plain coffee cut that easily.",
      'Найбільше стеж за «рідким» цукром: соки, газовані напої й солодкі кавові напої додають купу калорій, які не відчуваються. Вода, напої без цукру чи звичайна кава легко це вирішують.',
    ],
    [
      'Rule of thumb: keep added sugar under ~10% of calories — for most people roughly 50 g a day.',
      'Орієнтир: доданого цукру — до ~10% калорій, тобто для більшості це приблизно 50 г на день.',
    ],
  ],
  late_eating: [
    [
      '~30–40 g of slow-digesting protein before bed (casein, cottage cheese, Greek yoghurt) supports overnight muscle repair — useful if you train in the evening.',
      "~30–40 г білка з повільним засвоєнням перед сном (казеїн, сир, грецький йогурт) підтримують відновлення м'язів уночі — корисно, якщо тренуєшся ввечері.",
    ],
    [
      'Where late eating backfires: mindless evening snacking on top of a full day, or a heavy, spicy or fatty meal that disturbs sleep or causes reflux.',
      'Коли пізня їжа шкодить: бездумні вечірні перекуси поверх уже повного дня або важка, гостра чи жирна їжа, що заважає сну чи викликає печію.',
    ],
    [
      'Pro tip: finish big meals 2–3 h before bed and keep anything after that small and protein-based.',
      'Порада: великі прийоми їжі закінчуй за 2–3 години до сну, а все, що пізніше, — невелике й білкове.',
    ],
  ],
  electrolytes: [
    [
      "Sodium is the main one lost in sweat — roughly 0.5–1.5 g per litre, varying hugely between people. White salt crust on your clothes after training means you're a salty sweater.",
      'Головне, що виходить із потом, — натрій: приблизно 0,5–1,5 г на літр, і в різних людей дуже по-різному. Білі розводи солі на одязі після тренування — ознака того, що ти втрачаєш багато солі.',
    ],
    [
      'Mistake: drinking huge amounts of plain water in long, hot sessions. Over-drinking without salt can dilute blood sodium — drink to thirst.',
      'Помилка — пити дуже багато чистої води на довгих спекотних тренуваннях. Надлишок води без солі може розбавити натрій у крові, тож пий за відчуттям спраги.',
    ],
    [
      'Pro tip: a simple mix — 500 ml water, a pinch (~1 g) of salt, a splash of juice — covers most needs without pricey powders.',
      'Порада: проста суміш — 500 мл води, дрібка (~1 г) солі й трохи соку — закриває більшість потреб без дорогих порошків.',
    ],
  ],
  fiber: [
    [
      'Fibre slows digestion, which keeps you full longer and smooths blood sugar — very handy on a cut. It also feeds gut bacteria that help overall health.',
      "Клітковина сповільнює травлення, тож ти довше ситий, а цукор у крові рівніший — дуже корисно на сушці. Вона ще й живить кишкові бактерії, що важливо для здоров'я загалом.",
    ],
    [
      'Mistake: jumping from 10 g to 35 g overnight — hello bloating. Add ~5 g a week and drink more water as you go up.',
      'Помилка — різко перескочити з 10 г на 35 г. Привіт, здуття. Додавай ~5 г на тиждень і пий більше води.',
    ],
    [
      'Pro tip: easy wins — oats at breakfast (~4 g), a cup of beans (~12 g), an apple (~4 g), a big handful of veg (~3–5 g).',
      'Порада: прості варіанти — вівсянка на сніданок (~4 г), склянка квасолі (~12 г), яблуко (~4 г), велика жменя овочів (~3–5 г).',
    ],
  ],
};
export const FACETS_R3: Record<string, Partial<Record<Facet, [string, string]>>> = {
  sets_for_lift: {
    how: [
      'Do 1–3 lighter warm-up sets, then 3–4 working sets at the same weight, resting 2–3 min between them on big lifts.',
      'Зроби 1–3 легкі розминочні підходи, потім 3–4 робочі з однаковою вагою, між ними відпочинок 2–3 хв на базових вправах.',
    ],
    when: [
      "Go up to 4–5 sets when you want more volume on a lift you're prioritising; drop to 2 in a deload week or when you're run down.",
      'Піднімай до 4–5 підходів, коли робиш цю вправу пріоритетом; опускай до 2 на розвантажувальному тижні або коли ти вичавлений.',
    ],
    should: [
      "If you're progressing on 3 sets, stay there — more isn't better. Add a set only when progress stalls and recovery is good.",
      'Якщо на 3 підходах є прогрес — лишайся на 3, більше не означає краще. Додавай сет лише коли прогрес став, а відновлення в нормі.',
    ],
  },
  day_lookup: {
    how: [
      'Ask with a day or date — "what did I do on Monday" or "what did I do on 12 March" — and I\'ll pull that session.',
      'Спитай з днем чи датою — «що я робив у понеділок» або «що я робив 12 березня» — і я знайду те тренування.',
    ],
    why: [
      "Looking back is how you pick today's weights: you beat the log, not your memory.",
      "Оглядатися назад потрібно, щоб обрати сьогоднішні ваги: змагаєшся з записами, а не з пам'яттю.",
    ],
  },
  compare_weeks: {
    how: [
      'I count sessions and working sets for each calendar week, Monday to Sunday, and put them side by side.',
      'Я рахую тренування й робочі підходи за кожен календарний тиждень, з понеділка по неділю, і ставлю їх поруч.',
    ],
    should: [
      'Aim for steady weeks, not record weeks. Hitting your usual number of sessions week after week beats one huge week followed by a slump.',
      'Цілься в стабільні тижні, а не рекордні. Регулярно виходити на свою звичну кількість тренувань краще, ніж один шалений тиждень і потім провал.',
    ],
  },
  short_on_time: {
    why: [
      'Most of the gains come from the first few hard sets of big lifts — isolation and extra sets add less per minute.',
      'Основний результат дають перші кілька важких сетів базових вправ, а ізоляція й додаткові підходи дають менше за ту ж хвилину.',
    ],
    when: [
      "Use this on busy days so the week isn't lost. A short session beats a skipped one every time.",
      'Роби так у завантажені дні, щоб тиждень не пропав. Коротке тренування завжди краще за пропущене.',
    ],
  },
  two_days_row: {
    how: [
      'Alternate focus: upper body one day, lower the next; or put heavy work on day 1 and lighter, higher-rep work for the same muscles on day 2.',
      "Чергуй акцент: один день верх, наступний — низ; або на першому дні важка робота, а на другому — легша, багатоповторна на ті самі м'язи.",
    ],
  },
  two_a_day: {
    why: [
      "Total weekly work and recovery drive progress, not session count. Splitting the same work into two sessions only helps if it's easier to fit or you recover better.",
      'Прогрес дають загальний обсяг за тиждень і відновлення, а не кількість сесій. Розбивати ту саму роботу на два заходи варто, лише якщо так простіше вписати в день чи легше відновлюватися.',
    ],
    when: [
      "Worth it when your schedule gives two short windows instead of one long one, or you're adding cardio for a sport.",
      'Має сенс, коли в розкладі є два короткі вікна замість одного довгого або коли додаєш кардіо під свій вид спорту.',
    ],
  },
  health_conditions: {
    why: [
      "Regular strength training improves blood pressure, blood sugar control and joint function for many conditions — that's why doctors usually encourage it, with limits.",
      'Регулярні силові покращують тиск, контроль цукру й роботу суглобів при багатьох станах — тому лікарі зазвичай їх радять, але з обмеженнями.',
    ],
  },
  pregnancy: {
    why: [
      'Staying active in pregnancy is linked to less back pain, better mood and lower risk of gestational diabetes — as long as the pregnancy is uncomplicated.',
      "Активність під час вагітності пов'язана з меншим болем у спині, кращим настроєм і нижчим ризиком гестаційного діабету — якщо вагітність протікає без ускладнень.",
    ],
    how: [
      'Lighter loads, more reps, steady breathing. Swap flat-back work for incline or seated versions and use machines or supported moves as balance changes.',
      'Легші ваги, більше повторів, рівне дихання. Вправи лежачи на спині заміни на похилі чи сидячі варіанти, а коли змінюється баланс — бери тренажери чи вправи з опорою.',
    ],
  },
  hr_zones: {
    when: [
      'Easy zone 2 fits anywhere, even the day after legs. Save higher zones for days away from heavy lower-body lifting.',
      'Легку другу зону можна ставити будь-коли, навіть наступного дня після ніг. Високі зони — у дні подалі від важких тренувань ніг.',
    ],
    should: [
      "You don't need a monitor — the talk test is fine. A chest strap helps if you like data; wrist sensors can lag during intervals.",
      "Пульсометр не обов'язковий, вистачить «тесту розмови». Нагрудний датчик — якщо любиш цифри; браслети на зап'ясті можуть запізнюватися на інтервалах.",
    ],
  },
  hiit: {
    why: [
      'Short hard intervals raise your aerobic capacity (VO2max) in a fraction of the time steady cardio needs.',
      'Короткі інтенсивні інтервали підвищують аеробну потужність (МСК) за значно менший час, ніж рівномірне кардіо.',
    ],
    should: [
      "Good as a time-saver or fitness booster, but build a base of easy cardio first if you're new — and don't let it replace lifting.",
      'Добре, щоб зекономити час чи підтягнути форму, але новачкам спершу потрібна база з легкого кардіо — і заміняти ним силові не варто.',
    ],
  },
  running: {
    why: [
      'Running builds heart and lung fitness, which helps you recover between sets; done mostly easy, it barely touches strength gains.',
      'Біг розвиває серце й легені, що допомагає відновлюватися між підходами; якщо бігати переважно легко, на силу він майже не впливає.',
    ],
  },
  steps: {
    when: [
      'Spread them out: a walk after meals, calls on foot, stairs. A short walk on a rest day also helps sore muscles.',
      'Розподіляй протягом дня: прогулянка після їжі, дзвінки на ходу, сходи. Коротка прогулянка у вихідний від тренувань ще й знімає крепатуру.',
    ],
  },
  posture: {
    why: [
      'Heavy pressing plus long days at a desk shifts the balance toward tight chest and weak upper back. Pulling work and movement restore that balance.',
      'Багато жимів плюс довгі дні за столом зміщують баланс: груди затиснуті, верх спини слабкий. Тяги й рух цей баланс повертають.',
    ],
    should: [
      "Yes, add the pulling, but don't chase a perfect look. If posture comes with pain or numbness, get it checked by a physio.",
      "Так, додай тяги, але не женися за ідеальною картинкою. Якщо з поставою пов'язаний біль чи оніміння — покажися фізіотерапевту.",
    ],
  },
  other_sport: {
    how: [
      'Pick 4–5 lifts: a squat or deadlift, a press, a pull, a single-leg move and a jump or throw. 2–4 sets each, 3–6 reps on the big ones.',
      'Обери 4–5 вправ: присід чи тягу, жим, тягу до себе, вправу на одну ногу й стрибок або кидок. По 2–4 підходи, на базових — 3–6 повторів.',
    ],
  },
  home_equipment: {
    how: [
      'Measure your space and ceiling height first: a rack needs about 2 × 2 m and room for overhead press and pull-ups.',
      'Спершу виміряй приміщення й висоту стелі: для стійки потрібно близько 2 × 2 м і місце для жиму над головою та підтягувань.',
    ],
    should: [
      "Start small and buy what you'll actually use weekly. Add pieces once your training shows what's missing.",
      'Починай з малого й купуй те, чим реально користуватимешся щотижня. Решту докуповуй, коли тренування покажуть, чого бракує.',
    ],
  },
  reminder: {
    why: [
      'Consistency is the biggest driver of progress, and a nudge on a usual day is often enough to get you there.',
      'Регулярність — головний двигун прогресу, а нагадування у звичний день часто якраз і підштовхує дійти до залу.',
    ],
    should: [
      "Keep them on while you're building the habit. Once training is automatic, you'll barely notice them.",
      'Тримай їх увімкненими, поки формується звичка. Коли тренування стануть автоматичними, ти їх майже не помічатимеш.',
    ],
  },
  memory_show: {
    should: [
      "Yes, share what affects your training — the more I know, the fewer generic answers you get. Skip anything you'd rather keep private.",
      'Так, розкажи те, що впливає на тренування, — чим більше я знаю, тим менше загальних відповідей. Те, що хочеш лишити при собі, можна не казати.',
    ],
    when: [
      'Anytime — just say it in chat, like "my left knee hurts on lunges" or "I have 45 minutes max".',
      'Будь-коли — просто напиши в чат, наприклад: «болить ліве коліно на випадах» або «маю максимум 45 хвилин».',
    ],
  },
  range_count: {
    how: [
      'Name the range — "last month", "last 3 months", "since June" — and I count sessions and working sets inside it.',
      'Назви період — «минулий місяць», «останні 3 місяці», «з червня» — і я порахую тренування та робочі підходи в ньому.',
    ],
    why: [
      'Frequency is the first thing to check when progress stalls: fewer sessions usually explains more than any programme detail.',
      'Частота — перше, що варто перевірити, коли прогрес став: менше тренувань зазвичай пояснює більше, ніж будь-які деталі програми.',
    ],
  },
  range_summary: {
    why: [
      'Zooming out shows trends that single sessions hide — consistency, which lifts get attention and which get skipped.',
      'Погляд здалеку показує те, що ховається в окремих тренуваннях: регулярність, яким вправам приділяєш увагу, а які пропускаєш.',
    ],
    when: [
      'Monthly is a good rhythm; every 3 months for the bigger picture, e.g. before changing your programme.',
      'Раз на місяць — хороший ритм; раз на 3 місяці — для загальної картини, наприклад, перед зміною програми.',
    ],
  },
  range_lift: {
    why: [
      'One session can be a good or bad day; a trend over weeks shows whether your programme is actually working.',
      'Одне тренування може бути вдалим чи невдалим; тенденція за тижні показує, чи програма справді працює.',
    ],
    when: [
      'Check a lift every 4–8 weeks — shorter windows are mostly noise.',
      'Перевіряй вправу раз на 4–8 тижнів — коротші періоди здебільшого показують шум.',
    ],
  },
  range_muscle: {
    why: [
      "Weekly hard sets per muscle are one of the best predictors of muscle growth, so it's the number worth keeping an eye on.",
      "Кількість важких підходів на м'яз за тиждень — один із найкращих показників для росту м'язів, тому за цією цифрою варто стежити.",
    ],
    should: [
      "Raise volume slowly — about 2 sets a week at a time — and only if you're recovering well and progress has slowed.",
      'Збільшуй обсяг поступово — приблизно на 2 підходи на тиждень за раз — і лише якщо добре відновлюєшся, а прогрес сповільнився.',
    ],
  },
  range_bw: {
    why: [
      "Bodyweight trend is how you know if calories match your goal — it's the feedback loop for any diet.",
      "Динаміка ваги показує, чи відповідають калорії твоїй цілі, — це зворотний зв'язок для будь-якого харчування.",
    ],
    when: [
      'Weigh 3–7 mornings a week and judge the trend every 2 weeks before changing calories.',
      'Зважуйся 3–7 ранків на тиждень і оцінюй тенденцію раз на 2 тижні, перш ніж міняти калорії.',
    ],
    should: [
      "Log it if you're cutting or bulking. If the scale stresses you out and weight isn't your goal, measurements or photos work too.",
      'Записуй вагу, якщо ти на сушці чи масі. Якщо ваги тебе нервують, а схуднення не ціль — підійдуть заміри чи фото.',
    ],
  },
  then_vs_now: {
    when: [
      'Compare over at least 8–12 weeks; shorter gaps often show nothing even when things are working.',
      'Порівнюй на відрізку хоча б 8–12 тижнів; на коротшому часто не видно змін, навіть коли все працює.',
    ],
    should: [
      'If nothing moved in 3 months, change one variable — more sessions, a rep-range switch, or more food — rather than the whole programme.',
      'Якщо за 3 місяці нічого не зрушило, зміни щось одне — більше тренувань, інший діапазон повторів чи більше їжі, — а не всю програму.',
    ],
  },
  compare_lifts: {
    why: [
      'Comparing lifts spots imbalances early — a big gap can mean one area is undertrained.',
      'Порівняння вправ рано показує дисбаланс: великий розрив може означати, що якусь зону недотреновано.',
    ],
    how: [
      "I use each lift's estimated max, divide one by the other, and look at the % change over the last 8 weeks.",
      'Я беру розрахунковий максимум кожної вправи, ділю один на інший і дивлюся зміну у відсотках за останні 8 тижнів.',
    ],
  },
  why_today: {
    should: [
      "Follow it when you feel ready; if something still aches or you're short on time, swap it — just ask for an alternative.",
      'Дотримуйся, якщо почуваєшся готовим; якщо щось ще болить чи мало часу — заміни, просто попроси альтернативу.',
    ],
  },
  why_weight: {
    should: [
      'Treat it as a guide: if warm-ups feel heavy, drop 5–10%; if the first set flies, add a rep, not a big jump.',
      'Сприймай це як орієнтир: якщо розминка йде важко — скинь 5–10%; якщо перший підхід летить — додай повтор, а не різкий стрибок ваги.',
    ],
  },
  why_plan: {
    should: [
      "Stick with it if it's working; tell me your goal, time limit or injuries and it'll be tailored further.",
      'Якщо працює — тримайся його; розкажи про ціль, обмеження в часі чи травми, і план стане ще точнішим.',
    ],
  },
  why_lift: {
    when: [
      "It stays while you're progressing on it. A long stall or pain is the time to swap it for a variation.",
      'Вправа лишається, поки на ній є прогрес. Довгий застій чи біль — привід замінити її на варіацію.',
    ],
    should: [
      "Keep it if it feels good and moves forward; swap it if it hurts or you really dislike it — there's always another option for the same muscle.",
      "Залиш, якщо вона йде добре й прогресує; заміни, якщо болить чи дуже не подобається — для того ж м'яза завжди є інший варіант.",
    ],
  },
  pain_types: {
    why: [
      'Soreness is your muscles adapting to new work; sharp or joint pain means a structure is irritated — they need different responses.',
      "Крепатура — це адаптація м'язів до нової роботи; гострий біль чи біль у суглобі означає, що щось подразнене, — і реагувати треба по-різному.",
    ],
    how: [
      'Check: where exactly is it, does it change with warm-up, and how bad on 0–10. Muscle, easing, low score — carry on lighter; joint, sharp, rising — stop.',
      "Перевір: де саме болить, чи змінюється після розминки і наскільки сильно за шкалою 0–10. М'яз, слабшає, низька оцінка — продовжуй легше; суглоб, гострий, посилюється — зупинись.",
    ],
  },
  ice_heat: {
    why: [
      "Both mainly change how it feels, not how fast tissue heals — that's why movement stays the real treatment.",
      'І холод, і тепло здебільшого змінюють відчуття, а не швидкість загоєння, — тому справжнє «лікування» все одно рух.',
    ],
    how: [
      'Cold: wrapped ice pack 10–15 min, a few times a day. Heat: warm pack or shower 15–20 min, before training or in the evening.',
      'Холод: лід у тканині 10–15 хв кілька разів на день. Тепло: грілка чи теплий душ 15–20 хв перед тренуванням або ввечері.',
    ],
  },
  painkillers: {
    when: [
      "If you're taking medication prescribed for a condition, follow your doctor's plan — this is about not using pills to push through training pain.",
      'Якщо тобі призначили ліки від конкретної проблеми — дотримуйся схеми лікаря; мова про те, щоб не пити таблетки, аби тренуватися через біль.',
    ],
    how: [
      "Train around pain instead: swap the lift, shorten the range, lighten the weight until it's pain-free or under 3/10.",
      'Натомість обходь біль: заміни вправу, скороти амплітуду, зменш вагу, поки не стане безболісно або не більше 3/10.',
    ],
  },
  tendon: {
    should: [
      "If it hasn't improved after 6–8 weeks of steady loading, or there's swelling or a sudden snap, see a physio or doctor.",
      'Якщо за 6–8 тижнів регулярного навантаження не стало краще, або є набряк чи був раптовий «клацок» — звернися до фізіотерапевта чи лікаря.',
    ],
  },
  cramps: {
    when: [
      "Usually late in long or hot sessions, after new exercises, or when you're short on sleep or fluids.",
      'Зазвичай наприкінці довгих чи спекотних тренувань, після нових вправ або коли бракує сну чи рідини.',
    ],
  },
  numbness: {
    why: [
      "Nerves don't like being squeezed or stretched for long; a grip, an angle or a sustained position can irritate them.",
      'Нерви не люблять тривалого стискання чи розтягування; хват, кут або тривале положення можуть їх подразнювати.',
    ],
    how: [
      'Note which lift, which fingers and how long it lasts — that helps you adjust the setup and helps a doctor if you need one.',
      'Запиши, на якій вправі, які пальці й скільки триває — так легше підлаштувати техніку, а лікарю, якщо знадобиться, буде простіше.',
    ],
  },
  calories: {
    why: [
      "Calories set whether you gain, lose or hold weight; protein and training decide whether that's muscle or fat.",
      "Калорії визначають, набираєш ти, худнеш чи тримаєш вагу; а білок і тренування — чи це буде м'яз, чи жир.",
    ],
    when: [
      'Recheck maintenance after every 3–5 kg change in bodyweight or a big change in daily activity.',
      'Перераховуй підтримку після кожних 3–5 кг зміни ваги або суттєвої зміни щоденної активності.',
    ],
    should: [
      'Tracking helps for a few weeks to learn portions; long-term, many people do fine with consistent meals and a weekly weigh-in trend.',
      'Рахувати калорії корисно кілька тижнів, щоб зрозуміти порції; надовго багатьом вистачає стабільного раціону й контролю ваги щотижня.',
    ],
  },
  cut_deficit: {
    when: [
      'Start from a stable maintenance, not right after a binge week. Cut in a phase where sleep and stress are manageable.',
      'Починай зі стабільної підтримки, а не одразу після тижня переїдання. Сушку плануй на період, коли зі сном і стресом усе більш-менш нормально.',
    ],
  },
  bulk_surplus: {
    how: [
      'Add 200–300 kcal to maintenance — e.g. an extra snack of yoghurt with oats — and check the weekly average weight every 2 weeks.',
      'Додай 200–300 ккал до підтримки — наприклад, перекус з йогурту й вівсянки — і перевіряй середню вагу за тиждень раз на 2 тижні.',
    ],
    when: [
      "Best when you're fairly lean and training consistently; if you're carrying a lot of fat, recomp or a cut first often makes more sense.",
      'Найкраще, коли ти відносно сухий і тренуєшся регулярно; якщо жиру багато, часто розумніше спершу рекомпозиція або сушка.',
    ],
    should: [
      "Bulk only if you're training hard enough to use the extra food — otherwise it's just weight gain.",
      'Набирай масу, лише якщо тренуєшся достатньо важко, щоб використати додаткову їжу, — інакше це просто набір ваги.',
    ],
  },
  carbs: {
    how: [
      'Fill protein and fat targets first, then the remaining calories go to carbs — mostly from grains, potatoes, fruit and legumes.',
      'Спершу закрий норму білка й жирів, а решту калорій віддай вуглеводам — переважно крупи, картопля, фрукти й бобові.',
    ],
  },
  fats: {
    how: [
      'Cook with olive oil, add a handful of nuts or seeds a day, eat eggs and fish regularly; limit fried and processed foods.',
      'Готуй на оливковій олії, додавай жменю горіхів чи насіння щодня, регулярно їж яйця й рибу; менше смаженого й переробленого.',
    ],
    when: [
      'Keep big fatty meals away from right before training — fat slows digestion and can feel heavy.',
      'Не їж щось дуже жирне прямо перед тренуванням — жир сповільнює травлення, і буде відчуття важкості.',
    ],
  },
  pre_meal: {
    how: [
      'Aim for ~20–40 g protein plus 0.5–1 g/kg of carbs in the meal 1–3 h before; keep fat moderate.',
      'У прийомі їжі за 1–3 год до тренування — ~20–40 г білка й 0,5–1 г/кг вуглеводів, жирів помірно.',
    ],
    should: [
      'Not strictly needed if you ate in the last few hours, but training hungry usually means fewer reps.',
      "Якщо їв протягом останніх кількох годин — не обов'язково, але тренування на голодний шлунок зазвичай дає менше повторів.",
    ],
  },
  post_meal: {
    why: [
      'Training breaks muscle down a little; protein supplies the building blocks and carbs refuel for the next session.',
      "Тренування трохи руйнує м'язи; білок дає будівельний матеріал, а вуглеводи — пальне на наступне тренування.",
    ],
    how: [
      "Build the plate: a palm or two of protein, a fist or two of carbs, some veg. A shake counts if a meal isn't possible.",
      'Збери тарілку: одна-дві долоні білка, один-два кулаки вуглеводів і трохи овочів. Коктейль теж підійде, якщо поїсти нормально ніяк.',
    ],
  },
  meals_count: {
    how: [
      'A simple setup: breakfast, lunch, dinner, plus a protein snack like yoghurt or a shake — each with a solid protein source.',
      'Проста схема: сніданок, обід, вечеря плюс білковий перекус на кшталт йогурту чи коктейлю — у кожному прийомі нормальне джерело білка.',
    ],
    when: [
      'Every 3–5 hours while awake works well; one of those meals can land around training.',
      'Кожні 3–5 годин протягом дня — добре працює; один із прийомів можна поставити біля тренування.',
    ],
  },
  vegan: {
    when: [
      'Adjust from the start of a new plant-based phase: bump protein and add B12 and creatine right away rather than waiting for results to slow.',
      'Підлаштовуйся одразу, коли переходиш на рослинне харчування: збільш білок і додай B12 та креатин з перших днів, а не коли прогрес сповільниться.',
    ],
  },
  cheat_meal: {
    when: [
      'Around a social event or once a week or two works for most; put it on a training day if you can.',
      'Більшості підходить під якусь подію або раз на тиждень-два; якщо можеш — став його на тренувальний день.',
    ],
  },
  sugar: {
    why: [
      "Sugar itself doesn't build fat — excess calories do. Whole foods just make it far easier to stay within your calories.",
      'Жир відкладає не цукор сам по собі, а надлишок калорій. Просто з цільною їжею набагато простіше вкладатися в норму.',
    ],
    how: [
      'Pair sweets with a meal instead of snacking on them alone, and buy them in single portions rather than family packs.',
      'Їж солодке разом із прийомом їжі, а не окремим перекусом, і купуй маленькі порції, а не великі упаковки.',
    ],
  },
  late_eating: {
    how: [
      'Keep it simple: a bowl of cottage cheese or yoghurt with berries, or a casein shake, sized at 200–300 kcal.',
      'Не ускладнюй: миска сиру чи йогурту з ягодами або казеїновий коктейль, на 200–300 ккал.',
    ],
    when: [
      "Handy after evening training or when your day's protein fell short — not needed every night.",
      "Доречно після вечірнього тренування або коли за день не добрав білка — не обов'язково щовечора.",
    ],
  },
  electrolytes: {
    when: [
      "During sessions over 90 min, in heat, in two-a-days, or when you're sweating heavily on a low-salt diet.",
      'На тренуваннях довше 90 хв, у спеку, при двох тренуваннях на день або коли сильно пітнієш на малосольному харчуванні.',
    ],
  },
  fiber: {
    when: [
      "Spread it through the day, but keep the meal right before training lower in fibre so it doesn't sit heavy.",
      'Розподіляй протягом дня, але в прийомі їжі перед тренуванням клітковини має бути менше, щоб не було важкості.',
    ],
    should: [
      "Yes, especially if you mostly eat meat, rice and shakes — it's the most common gap in lifters' diets.",
      "Так, особливо якщо ти здебільшого їси м'ясо, рис і коктейлі, — це найчастіша прогалина в раціоні тих, хто тренується.",
    ],
  },
};
