/**
 * Going deeper: each topic can be followed up. "More / детальніше" walks down
 * the layers; "why / чому" gives the reasoning; the chips offer where to go
 * next. When the layers run out, the conversation moves to Gemini (for those
 * who have it) with the whole thread as context — so a topic never dead-ends.
 */

import { MORE_R1 } from './kb/depthR1';
import { MORE_R2 } from './kb/depthR2';
import { MORE_R3 } from './kb/depthR3';

type Pair = [string, string];

export interface Depth {
  /** Deeper layers, in order (en, uk). */
  more: Pair[];
  /** The reasoning behind the first answer. */
  why?: Pair;
  /** Follow-up questions for chips (en, uk). */
  next: Pair[];
}

export const DEPTH: Record<string, Depth> = {
  rest: {
    more: [
      [
        'The numbers: on heavy compounds, 2–3 min rest gives more total reps across sets than 1 min — and total hard reps is what drives growth. Short rest feels harder but builds less.',
        'Цифри: на важких базових 2–3 хв відпочинку дають більше повторів за всі сети, ніж 1 хв, — а саме сума важких повторів веде ріст. Короткий відпочинок здається важчим, але будує менше.',
      ],
      [
        'I adjust your timer by itself: longer after a set close to failure, when the muscle is already tired, after a short night or while you’re ill; shorter for isolation and between superset partners.',
        'Я підлаштовую таймер сам: довше після сету близько до відмови, коли м’яз уже втомлений, після короткої ночі чи під час хвороби; коротше — на ізолюючих і між вправами суперсету.',
      ],
    ],
    why: [
      'Rest lets phosphocreatine refill (~90% in 3 min) and the nervous system recover, so the next set keeps its reps.',
      'Відпочинок відновлює креатинфосфат (~90% за 3 хв) і нервову систему — тож наступний сет не втрачає повторів.',
    ],
    next: [
      ['How long do I actually rest?', 'Скільки я насправді відпочиваю?'],
      ['Can I use supersets to save time?', 'Можна суперсети, щоб зекономити час?'],
      ['What weight next time on bench?', 'Яку вагу ставити на жим наступного разу?'],
    ],
  },
  next_weight: {
    more: [
      [
        'The rule: you work in a rep range. Hit the top of it on every set → weight goes up next time. Miss the bottom twice → stay. Stuck three sessions → back off ~10% and build again.',
        'Правило: працюєш у діапазоні повторів. Дійшов до верху на всіх сетах — наступного разу вага вгору. Двічі не добрав до низу — лишаєшся. Три тренування стоїш — скидаєш ~10% і набираєш знову.',
      ],
      [
        'Why small jumps: +2.5 kg on a 60 kg press is 4% — enough to progress, small enough that the reps survive. Big jumps look brave and stall faster.',
        'Чому маленькі кроки: +2,5 кг на 60 кг жиму — це 4%: досить для прогресу й мало, щоб повтори не обвалились. Великі кроки виглядають сміливо й глухнуть швидше.',
      ],
    ],
    why: [
      'It comes from your last sessions on this lift: the top set, how many reps you got, and whether you hit the range on every set.',
      'Це з твоїх останніх тренувань у цій вправі: найкращий сет, скільки повторів вийшло і чи дійшов ти до діапазону на всіх сетах.',
    ],
    next: [
      ['What is my best on this lift?', 'Мій рекорд у цій вправі?'],
      ['When should I add weight?', 'Коли додавати вагу?'],
      ['What if I am stuck?', 'А якщо застряг?'],
    ],
  },
  reps: {
    more: [
      [
        'Any range from ~5 to 30 reps builds muscle if the last reps are hard. Lower ranges build more strength; higher ranges are easier on joints but burn more.',
        'М’язи ростуть від ~5 до 30 повторів, якщо останні повтори важкі. Нижчі діапазони дають більше сили; вищі — м’якші для суглобів, але сильніше «печуть».',
      ],
      [
        'Practical mix: compounds 5–10, isolation 10–20. Count only reps with good form — a sloppy rep is a free rep for the ego, not for the muscle.',
        'Практично: базові 5–10, ізолюючі 10–20. Рахуй лише повтори з нормальною технікою — кривий повтор тішить его, не м’яз.',
      ],
    ],
    next: [
      ['Should I go to failure?', 'Робити до відмови?'],
      ['What does RPE mean?', 'Що таке RPE?'],
      ['Strength or hypertrophy?', 'Сила чи маса?'],
    ],
  },
  failure: {
    more: [
      [
        'Failure costs recovery: the last rep to failure produces a lot of fatigue for little extra growth. 1–2 reps short gives nearly the same stimulus.',
        'Відмова дорого коштує відновленню: останній повтор до відмови дає багато втоми й мало додаткового росту. За 1–2 повтори до неї — майже той самий стимул.',
      ],
      [
        'Where it’s worth it: last set of an isolation lift, machines, bodyweight work. Where it isn’t: heavy squats, deadlifts, bench without safeties.',
        'Де варто: останній сет ізолюючої, тренажери, власна вага. Де ні: важкі присіди, станова, жим без страховки.',
      ],
    ],
    next: [
      ['What does RPE mean?', 'Що таке RPE?'],
      ['How many reps should I do?', 'Скільки повторів робити?'],
    ],
  },
  warmup: {
    more: [
      [
        'Why ramp sets matter: they groove the movement and prime the nervous system, so the first working set is actually a working set — not a warm-up you count.',
        'Навіщо підвідні сети: вони налаштовують рух і нервову систему, щоб перший робочий сет був справді робочим, а не розминкою, яку ти зараховуєш.',
      ],
      [
        'Keep it short: 5–10 minutes total. Long stretching or high-rep warm-ups only tire you. Later lifts in the session need one light set at most.',
        'Коротко: 5–10 хвилин разом. Довга розтяжка чи багатоповторна розминка лише втомлюють. Наступним вправам — щонайбільше один легкий сет.',
      ],
    ],
    next: [
      ['Warm-up for my bench?', 'Розминка для мого жиму?'],
      ['Should I stretch before lifting?', 'Розтягуватися перед тренуванням?'],
    ],
  },
  protein: {
    more: [
      [
        'Sources that make it easy: meat, fish, eggs, dairy (cottage cheese, Greek yogurt), legumes, tofu, whey. ~30–40 g per meal is a good target.',
        'Джерела, з якими легко: м’ясо, риба, яйця, молочне (сир, грецький йогурт), бобові, тофу, протеїн. ~30–40 г на прийом — добра ціль.',
      ],
      [
        'More than ~2.2 g/kg isn’t harmful for healthy kidneys, it just doesn’t add muscle. Calories matter too — in a deficit, protein protects muscle; in a surplus, it builds it.',
        'Понад ~2,2 г/кг здоровим ниркам не шкодить, просто м’язів не додає. Калорії теж важливі: у дефіциті білок захищає м’язи, у профіциті — будує.',
      ],
    ],
    next: [
      ['When to drink a protein shake?', 'Коли пити протеїн?'],
      ['How to build muscle?', 'Як набрати м’язи?'],
      ['Should I take creatine?', 'Пити креатин?'],
    ],
  },
  supplements: {
    more: [
      [
        'Creatine details: 3–5 g daily, no loading needed, no cycling. Expect 1–2 kg of water weight in the muscle in the first weeks — that’s the point, not fat.',
        'Деталі по креатину: 3–5 г щодня, без завантаження, без циклів. Перші тижні +1–2 кг води в м’язах — це і є ефект, не жир.',
      ],
      [
        'Also backed by evidence: caffeine before training, vitamin D if you’re low, protein powder for convenience. Everything else — BCAAs, “test boosters”, fat burners — skip.',
        'Ще з доказами: кофеїн перед тренуванням, вітамін D, якщо його мало, протеїн для зручності. Решту — BCAA, «бустери тестостерону», жироспалювачі — пропусти.',
      ],
    ],
    next: [
      ['Is coffee before gym ok?', 'Кава перед залом — ок?'],
      ['How much protein do I need?', 'Скільки білка треба?'],
    ],
  },
  plateau: {
    more: [
      [
        'Diagnose first: is it one lift or everything? One lift → technique, rep range or frequency. Everything → sleep, food, stress or too much volume.',
        'Спершу діагноз: застрягла одна вправа чи все? Одна — техніка, діапазон повторів чи частота. Все — сон, їжа, стрес або забагато обсягу.',
      ],
      [
        'Tools that work: change the rep range for 4 weeks (e.g. 8–10 → 4–6), add a second weekly session for that lift, swap to a close variation, take a lighter week.',
        'Робочі інструменти: змінити діапазон на 4 тижні (напр. 8–10 → 4–6), додати друге тренування цієї вправи на тиждень, замінити близьким варіантом, взяти легший тиждень.',
      ],
    ],
    next: [
      ['How am I doing?', 'Як мій прогрес?'],
      ['When is my lighter week?', 'Коли легший тиждень?'],
      ['How did I sleep?', 'Як я спав?'],
    ],
  },
  split_choice: {
    more: [
      [
        'What matters more than the split: each muscle about twice a week, 10–20 hard sets per muscle per week, and a schedule you won’t skip.',
        'Важливіше за спліт: кожен м’яз приблизно двічі на тиждень, 10–20 робочих сетів на м’яз за тиждень і розклад, який ти не пропускатимеш.',
      ],
      [
        'If you miss days often, full body is forgiving — every session covers everything. Body-part splits punish a missed day with a muscle untrained for two weeks.',
        'Якщо часто пропускаєш, «все тіло» прощає — кожне тренування покриває все. Спліт по частинах карає пропуск м’язом, не тренованим два тижні.',
      ],
    ],
    next: [
      ['What is my programme?', 'Яка в мене програма?'],
      ['How many times a week should I train?', 'Скільки разів на тиждень тренуватись?'],
    ],
  },
  deload: {
    more: [
      [
        'A lighter week: same exercises, same weights, about half the sets. You leave the gym fresh — that’s the goal, not a failure.',
        'Легший тиждень: ті самі вправи й ваги, приблизно половина сетів. Виходиш із залу свіжим — це мета, не провал.',
      ],
      [
        'Signs you need one early: weights dropping two sessions in a row, joints aching, sleep getting worse, zero motivation. Then I’ll pull it forward.',
        'Ознаки, що треба раніше: ваги падають два тренування поспіль, ниють суглоби, гіршає сон, нуль мотивації. Тоді я перенесу його раніше.',
      ],
    ],
    next: [
      ['What is my programme?', 'Яка в мене програма?'],
      ['Am I overtraining?', 'Чи не перетренувався я?'],
    ],
  },
  sleep: {
    more: [
      [
        'Under 6 h: strength drops, recovery slows, hunger rises. One bad night is fine; a bad week shows up in the log.',
        'Менше 6 год: сила падає, відновлення гальмує, апетит росте. Одна погана ніч — нічого; поганий тиждень видно в журналі.',
      ],
      [
        'What helps most: the same wake-up time every day (even weekends), light in the morning, no caffeine after lunch, a cool dark room.',
        'Найбільше допомагає: той самий час підйому щодня (і у вихідні), світло вранці, без кави після обіду, прохолодна темна кімната.',
      ],
    ],
    next: [
      ['How to sleep better?', 'Як краще спати?'],
      ['Am I recovered?', 'Я відновився?'],
    ],
  },
  recovery: {
    more: [
      [
        'How I count it: a muscle needs ~48–72 h after a hard session, longer after more sets or failure, shorter for small muscles. Your sleep shifts it too.',
        'Як я рахую: м’язу треба ~48–72 год після важкого тренування, довше після великого обсягу чи відмови, менше — малим м’язам. Сон теж зсуває.',
      ],
      [
        'Training a muscle at 80–90% isn’t harmful — you’ll just be a bit weaker. Below that, train something else and come back.',
        'Тренувати м’яз на 80–90% не шкідливо — просто будеш трохи слабшим. Нижче — тренуй інше й повертайся потім.',
      ],
    ],
    next: [
      ['What should I train today?', 'Що тренувати сьогодні?'],
      ['Should I train when sore?', 'Тренуватись із крепатурою?'],
    ],
  },
  fat_loss: {
    more: [
      [
        'Practically: ~300–500 kcal under maintenance, protein high, keep lifting heavy so the weight lost is fat, not muscle. Steps help more than long cardio.',
        'Практично: ~300–500 ккал нижче підтримки, багато білка, і далі важкі силові — щоб ішов жир, а не м’язи. Кроки допомагають більше, ніж довге кардіо.',
      ],
      [
        'Expect weekly swings of 1–2 kg from water. Judge the trend over 3–4 weeks, not one weigh-in.',
        'Вага щотижня стрибає на 1–2 кг через воду. Оцінюй тенденцію за 3–4 тижні, а не одне зважування.',
      ],
    ],
    next: [
      ['Am I gaining or losing weight?', 'Я набираю чи худну?'],
      ['How much protein do I need?', 'Скільки білка треба?'],
    ],
  },
  muscle_gain_rate: {
    more: [
      [
        'Realistic pace: first year ~0.5–1 kg of muscle a month, then half of that each year after. Faster scale weight is mostly fat.',
        'Реалістично: перший рік ~0,5–1 кг м’язів на місяць, далі щороку вдвічі менше. Швидший ріст ваги — здебільшого жир.',
      ],
      [
        'The order that matters: training hard and consistently → enough protein → a small surplus → sleep. Supplements are the last 1%.',
        'Порядок важливості: важкі й регулярні тренування → достатньо білка → невеликий профіцит → сон. Добавки — останній 1%.',
      ],
    ],
    next: [
      ['How to grow my chest?', 'Як накачати груди?'],
      ['How much protein do I need?', 'Скільки білка треба?'],
    ],
  },
  cardio: {
    more: [
      [
        'Two kinds: easy (you can talk) builds the base and helps recovery; hard intervals build fitness fast but cost recovery like a lifting session.',
        'Два види: легке (можеш говорити) будує базу й допомагає відновленню; інтервали швидко піднімають форму, але вимагають відновлення як силове.',
      ],
      [
        'For lifters: 2–3 easy sessions of 20–40 min a week, legs-friendly (bike, incline walk). Keep intervals away from leg day.',
        'Для силовиків: 2–3 легкі сесії по 20–40 хв на тиждень, м’які для ніг (вело, ходьба під нахилом). Інтервали — подалі від дня ніг.',
      ],
    ],
    next: [
      ['Does cardio kill gains?', 'Кардіо з’їдає м’язи?'],
      ['How much cardio did I do this week?', 'Скільки кардіо цього тижня?'],
    ],
  },
  rpe: {
    more: [
      [
        'Honest RPE takes practice: most people underestimate what’s left by 2–3 reps. Film a set you call RPE 8 and count what you could still do.',
        'Чесний RPE — справа практики: більшість недооцінює запас на 2–3 повтори. Зніми сет, який назвав RPE 8, і порахуй, скільки ще міг.',
      ],
    ],
    next: [
      ['Should I go to failure?', 'Робити до відмови?'],
      ['How many reps should I do?', 'Скільки повторів робити?'],
    ],
  },
  add_weight: {
    more: [
      [
        'If a jump is too big, add reps instead (double progression) or use small plates. Dumbbells jump in 2 kg steps — so go 10 → 12 reps first.',
        'Якщо крок завеликий — додавай повтори (подвійна прогресія) або малі млинці. Гантелі йдуть кроками по 2 кг — спершу 10 → 12 повторів.',
      ],
    ],
    next: [
      ['What weight next time on bench?', 'Яку вагу ставити на жим?'],
      ['What if I am stuck?', 'А якщо застряг?'],
    ],
  },
  strength_vs_size: {
    more: [
      [
        'You don’t have to choose forever: a block of heavier work (4–6 reps) then a block of volume (8–12) — each makes the other work better.',
        'Не обов’язково обирати назавжди: блок важчої роботи (4–6 повторів), потім блок обсягу (8–12) — кожен підсилює інший.',
      ],
    ],
    next: [['What is periodization?', 'Що таке періодизація?']],
  },
  grow_muscle: {
    more: [
      [
        'Three levers per muscle: enough weekly sets (10–20), hitting it twice a week, and exercises that load it in the stretched position. Check the first two in your log.',
        'Три важелі для кожного м’яза: досить сетів на тиждень (10–20), двічі на тиждень і вправи з навантаженням у розтягнутій позиції. Перші два перевір у журналі.',
      ],
      [
        'Put the lagging muscle first in the session while you’re fresh, for 6–8 weeks. It grows when it gets your best effort, not your leftovers.',
        'Став відстаючий м’яз першим у тренуванні, поки ти свіжий, на 6–8 тижнів. Він росте, коли отримує твої найкращі сили, а не залишки.',
      ],
    ],
    next: [
      ['How many sets for this muscle this week?', 'Скільки сетів на цей м’яз цього тижня?'],
      ['What am I neglecting?', 'Що в мене відстає?'],
    ],
  },
  pain: {
    more: [
      [
        'Soreness vs pain: soreness is dull, both sides, peaks 1–2 days after and fades as you warm up. Pain is sharp, one spot, or gets worse under load — that one we don’t train through.',
        'Крепатура чи біль: крепатура тупа, симетрична, найсильніша на 1–2 день і минає з розминкою. Біль — гострий, в одній точці або гіршає під навантаженням — через такий не тренуємо.',
      ],
      [
        'In the Injury screen you rate how it feels; I move you through protect → reintroduce → rebuild → return and cap loads on the affected muscles meanwhile.',
        'У «Травмах» ти відмічаєш самопочуття; я веду тебе через захист → повернення → відбудову → норму й тим часом обмежую навантаження на уражені м’язи.',
      ],
    ],
    next: [
      ['How do I log an injury?', 'Як записати травму?'],
      ['What can I train instead?', 'Що можна тренувати замість?'],
    ],
  },
  sick: {
    more: [
      [
        'Coming back: first session after illness at ~70–80% of normal, a few sets less. If it feels fine, the next one is normal.',
        'Повернення: перше тренування після хвороби — ~70–80% звичайного, на кілька сетів менше. Якщо нормально — наступне вже звичне.',
      ],
    ],
    next: [['Coming back after a break', 'Повернення після перерви']],
  },
  motivation: {
    more: [
      [
        'Motivation follows action, not the other way round. Make the start tiny: shoes on, bag packed, first warm-up set. Nine times out of ten you finish.',
        'Мотивація йде за дією, а не навпаки. Зроби старт крихітним: взувся, сумка, перший розминочний сет. Дев’ять разів із десяти ти доведеш до кінця.',
      ],
    ],
    next: [
      ['How am I doing?', 'Як мій прогрес?'],
      ['What should I train today?', 'Що тренувати сьогодні?'],
    ],
  },
  today: {
    more: [
      [
        'It’s picked from your plan, or from what you usually do on this weekday, skipping muscles that aren’t recovered yet.',
        'Це з твого плану або з того, що ти зазвичай робиш у цей день тижня, пропускаючи м’язи, які ще не відновились.',
      ],
    ],
    next: [
      ['Am I recovered?', 'Я відновився?'],
      ['How long should I rest?', 'Скільки відпочивати?'],
      ['What weight next time on bench?', 'Яку вагу ставити на жим?'],
    ],
  },
  how_am_i_doing: {
    more: [
      [
        'Look at three things in order: are you showing up (sessions/week), are weights or reps creeping up on your main lifts, and is anything stuck. Two out of three is a good month.',
        'Дивись на три речі по черзі: чи ходиш ти (тренувань на тиждень), чи повзуть угору ваги чи повтори в основних вправах, і що застрягло. Два з трьох — добрий місяць.',
      ],
    ],
    next: [
      ['What am I neglecting?', 'Що в мене відстає?'],
      ['I hit a plateau', 'У мене плато'],
      ['How consistent am I?', 'Наскільки я регулярний?'],
    ],
  },
  beginner: {
    more: [
      [
        'Your first 3 months: learn the big lifts with lighter weights, add a little every session, log everything. Beginners progress almost every workout — enjoy it.',
        'Перші 3 місяці: вчи базові вправи з меншими вагами, додавай потроху щотренування, записуй усе. Новачки прогресують майже щотренування — насолоджуйся.',
      ],
    ],
    next: [
      ['Write my programme', 'Напиши мені програму'],
      ['How to squat properly?', 'Як правильно присідати?'],
    ],
  },
};

/** Chips shown when a topic has none of its own. */
export const DEFAULT_NEXT: Pair[] = [
  ['What should I train today?', 'Що тренувати сьогодні?'],
  ['How am I doing?', 'Як мій прогрес?'],
  ['How long should I rest?', 'Скільки відпочивати?'],
];

// Deeper layers written later: appended after the ones above.
for (const r of [MORE_R1, MORE_R2, MORE_R3])
  for (const [id, layers] of Object.entries(r)) {
    const d = (DEPTH[id] ??= { more: [], next: [] });
    d.more = [...d.more, ...layers];
  }
