/**
 * Small talk — so Atlas reads like someone, not a lookup table. Every line
 * comes in three tones: soft = green (your gym bro: hyped, friendly slang),
 * blunt = yellow (straight talk with a smirk), hard = red (merciless: roasts
 * your effort, never your body). Each language is written natively, not
 * translated word for word. Lines rotate so repeats don't read alike, know
 * the time of day and, where it helps, glance at your log (last session,
 * streak, a lift to beat).
 * Small talk never goes through the "As I said" consistency layer.
 */
import { est1rm, setTopWeight, setTypeOf } from '../store';
import { hashId } from './voice';
import {
  DAY,
  finishedOf,
  loggedLifts,
  todayLine,
  type AskCtx,
  type Intent,
  type Tr,
} from './intentKit';

type Line = [string, string];
type Toned = { soft: Line[]; blunt: Line[]; hard: Line[] };

const tone = (c: AskCtx): keyof Toned =>
  c.temper <= 2 ? 'soft' : c.temper === 3 ? 'blunt' : 'hard';

/** Pick a line: changes minute to minute, never random within a render. */
function pick(c: AskCtx, id: string, lines: Line[], L: Tr): string {
  const seed = hashId(`${id}:${Math.floor(c.now / 60_000)}`);
  const x = lines[seed % lines.length];
  return L(x[0], x[1]);
}
const say = (c: AskCtx, id: string, t: Toned, L: Tr) => pick(c, id, t[tone(c)], L);

function partOfDay(c: AskCtx): 'morning' | 'day' | 'evening' | 'night' {
  const h = new Date(c.now).getHours();
  return h < 5 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'day' : h < 23 ? 'evening' : 'night';
}

function daysSinceLast(c: AskCtx): number | null {
  const last = finishedOf(c)[0];
  return last ? Math.floor((c.now - (last.finishedAt ?? last.startedAt)) / DAY) : null;
}

/** Your most-done lift and its best recent set — something concrete to beat. */
function liftToBeat(c: AskCtx): { name: string; kg: number; reps: number } | null {
  const top = loggedLifts(c).sort((a, b) => b.count - a.count)[0];
  if (!top) return null;
  for (const w of finishedOf(c)) {
    const ex = w.exercises.find((e) => e.name === top.name);
    const sets = (ex?.sets ?? []).filter((s) => setTypeOf(s) !== 'warmup' && (s.weight ?? 0) > 0);
    if (!sets.length) continue;
    const best = sets.sort(
      (a, b) => est1rm(setTopWeight(b), b.reps) - est1rm(setTopWeight(a), a.reps),
    )[0];
    return { name: top.name, kg: setTopWeight(best), reps: best.reps };
  }
  return null;
}

// ---- greetings --------------------------------------------------------------------

const HELLO: Record<'morning' | 'day' | 'evening' | 'night', Toned> = {
  morning: {
    soft: [
      ['Morning, bro! Batteries charged?', 'Доброго ранку, бро! Виспався хоч?'],
      ['Rise and grind, dude 💪', 'Підйом, братан! Сьогодні буде кайф 💪'],
      ['Morning, champ! Coffee in — let’s gooo.', 'Здоров, красава! Кава є — значить, живемо.'],
    ],
    blunt: [
      ['Morning.', 'Доброго ранку.'],
      ['Morning. Coffee first, then we talk.', 'Спершу кава. Розмови потім.'],
      ['Up. Good. Don’t waste it.', 'Прокинувся? Ну, вже щось.'],
    ],
    hard: [
      ['Oh, you’re up. Shocking.', 'О, прокинувся. Хто б міг подумати.'],
      [
        'Morning, couch warrior. The bar doesn’t care how you slept.',
        'Ранок, диванний воїне. Штанзі до лампочки, як ти спав.',
      ],
      ['Morning. Let me guess — “starting Monday” again?', 'Доброго. Вгадаю: знову «з понеділка»?'],
      ['*sigh* Morning, gym tourist.', '*зітхає* Ранок, туристе. Знову на екскурсію?'],
    ],
  },
  day: {
    soft: [
      ['Yo bro! Good to see you 🤙', 'Йоу, бро! О, хто прийшов 🤙'],
      ['Dude! What’s good?', 'Братан, здоров! Як воно?'],
      ['Heyyy, there he is!', 'О, красава на зв’язку!'],
    ],
    blunt: [
      ['Hey.', 'Привіт.'],
      ['Yeah, I’m listening.', 'Слухаю.'],
      ['Hey. What do you need?', 'Ну, привіт. Що треба?'],
    ],
    hard: [
      ['Oh. You.', 'А, це ти.'],
      ['Finally. Your log was gathering dust.', 'Нарешті. Твій журнал аж пилом припав.'],
      [
        'Look who remembered they have a membership.',
        'Ого, які люди. Згадав, що в тебе є абонемент?',
      ],
      ['*eye-roll* Hi, cupcake.', '*закочує очі* Привіт, пиріжечку.'],
    ],
  },
  evening: {
    soft: [
      ['Evening, bro! How was the day?', 'Здоров, бро! Ну що, як день?'],
      ['Yo — chilling already?', 'Що, вже на чілі?'],
      ['Evening, beast. Still got some gas left?', 'Вечір, машина! Ще є порох у порохівницях?'],
    ],
    blunt: [
      ['Evening.', 'Добрий вечір.'],
      ['Hey. Late one?', 'Щось ти пізно.'],
      ['Evening. Make it quick.', 'Вечір. Давай по ділу.'],
    ],
    hard: [
      ['Evening. Did you earn it today? Doubt it.', 'Вечір. Заслужив сьогодні? Щось сумніваюсь.'],
      ['Oh, it’s you. At this hour. Of course.', 'О, явився. Під вечір, як завжди.'],
      [
        'Evening, couch warrior. How’s the war with the sofa?',
        'Вечір, диванний воїне. Як там битва з подушками?',
      ],
    ],
  },
  night: {
    soft: [
      ['Up late, bro? Gains grow while you sleep.', 'Бро, чого не спиш? Уві сні ж усе й росте.'],
      [
        'Night owl mode, huh? Don’t forget to crash, dude.',
        'Що, совою заділався? Давай вже відбій 🤙',
      ],
      [
        'Late vibes. Chat a bit, then sleep — deal?',
        'Нічні посиденьки? Трохи побалакаємо — і спатки, лади?',
      ],
    ],
    blunt: [
      ['It’s late. Sleep.', 'Ніч надворі. Спати.'],
      ['Still up? Your recovery says no.', 'Ще не спиш? Відновлення тобі спасибі не скаже.'],
      ['Late. Keep it short.', 'Пізно вже. Коротко.'],
    ],
    hard: [
      ['Why are you awake. Bed. Now.', 'Чого не спиш. В ліжко. Бігом.'],
      [
        'Midnight chat instead of sleep. Bold. Stupid, but bold.',
        'Чатитись замість спати? Сміливо. Безглуздо, але сміливо.',
      ],
      [
        'Energy to chat at midnight, none to train. Talent.',
        'На нічні балачки сили є, а на зал — нема. Талант.',
      ],
    ],
  },
};

function greet(c: AskCtx, L: Tr): string {
  const hello = say(c, 'hello', HELLO[partOfDay(c)], L);
  const d = daysSinceLast(c);
  const hook =
    d === null
      ? L(
          'Log your first workout and I’ll have plenty to say.',
          'Запиши перше тренування — тоді й поговоримо предметно.',
        )
      : d >= 5
        ? say(
            c,
            'hello-gap',
            {
              soft: [
                [
                  `It’s been ${d} days, bro — time to get back, yeah?`,
                  `Бро, вже ${d} дн. без залу. Го назад?`,
                ],
                [
                  `${d} days off — no stress, man. We’ll ease back in.`,
                  `${d} дн. перерви — спокуха, розгойдаємось потихеньку.`,
                ],
                [
                  `Missed you, dude! ${d} days is plenty of rest.`,
                  `Скучив, братан! ${d} дн. — відпочив уже досить.`,
                ],
              ],
              blunt: [
                [`${d} days since your last session.`, `${d} дн. без тренувань.`],
                [`${d} days off. Time to fix that.`, `Перерва — ${d} дн. Пора закінчувати.`],
                [`${d} days. Today works.`, `${d} дн. простою. Сьогодні — саме час.`],
              ],
              hard: [
                [`${d} days. I counted. Every one.`, `${d} дн. Я рахував. Кожен, лінивцю.`],
                [
                  `${d} days off. Resting from what, exactly?`,
                  `${d} дн. відпочинку. Від чого відпочиваєш, цікаво?`,
                ],
                [
                  `*sigh* ${d} days. Your membership is crying.`,
                  `*зітхає* ${d} дн. Твій абонемент уже плаче.`,
                ],
                [`${d} days, gym tourist. Visa expired?`, `${d} дн., туристе. Віза закінчилась?`],
              ],
            },
            L,
          )
        : d === 0
          ? say(
              c,
              'hello-done',
              {
                soft: [
                  ['Nice work today, bro! Big W 💪', 'Красава, сьогодні відпахав! 💪'],
                  ['Already trained? Beast mode, dude.', 'Вже потренувався? Ну ти машина.'],
                  ['Session done — that’s a W, man.', 'Тренування є — кайф, бро.'],
                ],
                blunt: [
                  ['You trained today. Good.', 'Сьогодні вже був у залі. Добре.'],
                  ['Session logged. Rest up.', 'Тренування записане. Тепер відпочинок.'],
                ],
                hard: [
                  [
                    'One session and you feel like a hero? Don’t get comfy.',
                    'Потренувався — і вже герой? Не розслабляйся.',
                  ],
                  [
                    'One workout. Want a medal, cupcake?',
                    'Одне тренування. Медальку дати, пиріжечку?',
                  ],
                  [
                    'Trained today. Shocking. Don’t make it a one-off.',
                    'Потренувався. Сенсація. Тільки щоб не раз на рік.',
                  ],
                ],
              },
              L,
            )
          : say(
              c,
              'hello-ask',
              {
                soft: [
                  ['So what are we hitting today?', 'Ну що, бро, що сьогодні качаємо?'],
                  ['Want today’s plan, dude?', 'Кинути план на сьогодні?'],
                  ['Gym today? Let’s gooo 🤙', 'Сьогодні в зал? Го 🤙'],
                ],
                blunt: [
                  ['Training today?', 'Сьогодні в зал?'],
                  ['Plan or chat?', 'План чи побазікати?'],
                ],
                hard: [
                  ['Training today, or just chatting?', 'Сьогодні працюєш чи знову язиком чешеш?'],
                  ['Let me guess: “rest day” again?', 'Вгадаю: знову «день відпочинку»?'],
                  [
                    'Gonna lift, or keep scrolling, couch warrior?',
                    'Підеш у зал чи далі гортатимеш стрічку, диванний воїне?',
                  ],
                ],
              },
              L,
            );
  return `${hello} ${hook}`;
}

// ---- facts, challenges, quotes ------------------------------------------------------

const FACTS: Line[] = [
  [
    'Strength shows up before size: the first weeks are mostly your nervous system learning.',
    'Сила приходить раніше за м’язи: перші тижні ти здебільшого вчиш нервову систему.',
  ],
  [
    'Muscle protein synthesis stays up for ~24–48 h after a hard session — that’s why twice a week per muscle works.',
    'Після важкого тренування м’язи будуються ще ~24–48 год — тому кожен м’яз двічі на тиждень і працює.',
  ],
  [
    'One bad night can cut your reps by a few; a week of short sleep costs far more than any supplement adds.',
    'Одна безсонна ніч — мінус кілька повторів; тиждень недосипу б’є сильніше, ніж допоможе будь-яка добавка.',
  ],
  [
    'Creatine is one of the most studied supplements in sport — and it’s cheap.',
    'Креатин — одна з найдосліджуваніших добавок у спорті. І коштує копійки.',
  ],
  [
    'Sets taken to 1–3 reps short of failure grow muscle almost as well as sets to failure — with less fatigue.',
    'Зупиняйся за 1–3 повтори до відмови — ріст майже такий самий, як «у відмову», а втоми менше.',
  ],
  [
    'You can’t spot-reduce fat — crunches build abs, the deficit shows them.',
    'Локально жир не спалиш: скручування будують прес, а показує його дефіцит.',
  ],
  [
    'Walking counts: 8–10k steps a day helps recovery and fat loss more than people think.',
    'Ходьба теж рахується: 8–10 тис. кроків на день помітно допомагають і відновитися, і скинути жир.',
  ],
  [
    'Your grip often fails before your back does — straps are a tool, not cheating.',
    'Хват часто здається раніше за спину — лямки це інструмент, а не чітерство.',
  ],
  [
    'Heavy lifting strengthens bones too — not just muscles.',
    'Важкі ваги зміцнюють не лише м’язи, а й кістки.',
  ],
  [
    'Muscle memory is real: regaining lost size is much faster than building it the first time.',
    'М’язова пам’ять — не міф: утрачене повертається набагато швидше, ніж набиралося вперше.',
  ],
  [
    'Stretching before lifting doesn’t prevent injury much — a proper warm-up does.',
    'Розтяжка перед вагами від травм майже не рятує — рятує нормальна розминка.',
  ],
  [
    'Most people rest too little between heavy sets and lose reps because of it.',
    'Більшість відпочиває між важкими сетами замало — і сама ж через це недобирає повторів.',
  ],
];

const QUOTES: Toned = {
  soft: [
    [
      'Small plates add up, bro. So do small wins.',
      'По млинчику — і вага росте, бро. З перемогами так само.',
    ],
    [
      'You don’t need to feel ready, man. Just show up.',
      'Не чекай, поки захочеться. Просто прийди — решта підтягнеться.',
    ],
    [
      'Progress is quiet. Keep grinding, dude.',
      'Прогрес не кричить, він тихо росте. Не зупиняйся, братан.',
    ],
    ['Every rep is a W. Stack ’em 💪', 'Кожен повтор — у скарбничку 💪'],
  ],
  blunt: [
    [
      'Consistency beats intensity you can’t repeat.',
      'Регулярність б’є інтенсивність, яку не повториш.',
    ],
    ['The log doesn’t lie.', 'Цифри в журналі не брешуть.'],
    ['Do the boring work. It’s the work.', 'Нудна робота — це і є робота.'],
  ],
  hard: [
    [
      'Motivation is for people who skip. You have a schedule.',
      'Мотивацію чекають ті, хто прогулює. У тебе розклад.',
    ],
    [
      'The weight doesn’t care about your excuses. Neither do I.',
      'Штанзі начхати на твої відмовки. Мені теж.',
    ],
    [
      'Pain of discipline or pain of regret. Pick one. Quickly.',
      'Або попотієш зараз, або шкодуватимеш потім. Вибирай. Швидше.',
    ],
    [
      'Wishing is free. That’s why you’re so good at it.',
      'Мріяти — безкоштовно. Тому в тебе й виходить.',
    ],
  ],
};

// ---- the intents -------------------------------------------------------------------

export const INTENTS_SMALL: Intent[] = [
  {
    id: 'whats_up',
    all: [
      [
        'whats up',
        'what s up',
        'sup',
        'wassup',
        'what s new',
        'whats new',
        'що нового',
        'як воно',
        'шо там',
        'що там',
        'як життя',
        'что нового',
        'как жизнь',
      ],
    ],
    maxWords: 5,
    answer: (c, _p, L) => {
      const d = daysSinceLast(c);
      const tail =
        d === null
          ? L('Nothing logged yet, so not much.', 'Журнал поки порожній — тож без новин.')
          : d === 0
            ? L(
                'You trained today — I’m still reading it.',
                'Ти сьогодні тренувався — ще розбираю.',
              )
            : L(
                `Last session was ${d} day${d === 1 ? '' : 's'} ago.`,
                `Останнє тренування — ${d} дн. тому.`,
              );
      return `${say(
        c,
        'sup',
        {
          soft: [
            [
              'Not much, bro — just watching you level up!',
              'Та все по-старому, бро — слідкую, як ти прокачуєшся!',
            ],
            [
              'Chillin’, dude. Waiting on your next W.',
              'Чілю, братан. Чекаю твій наступний рекорд.',
            ],
            [
              'All good, man! Hyped for your next session 🤙',
              'Все топчик! Чекаю наступне тренування 🤙',
            ],
          ],
          blunt: [
            ['Reading your log.', 'Гортаю твій журнал.'],
            ['Same old. Numbers.', 'Все те саме. Цифри.'],
          ],
          hard: [
            [
              'Waiting for you to do something worth commenting on.',
              'Чекаю, коли тобі буде чим похвалитися. Досі чекаю.',
            ],
            [
              '*sigh* Staring at your log. Not much to stare at.',
              '*зітхає* Дивлюсь у твій журнал. Дивитись особливо нема на що.',
            ],
            [
              'Same as you: nothing. Difference is, I’m not supposed to lift.',
              'Те саме, що й ти: нічого. Тільки мені тягати не треба.',
            ],
          ],
        },
        L,
      )} ${tail}`;
    },
  },
  {
    id: 'good_night',
    all: [
      [
        'good night',
        'goodnight',
        'night night',
        'на добраніч',
        'добраніч',
        'спокійної ночі',
        'на добранич',
        'спокойной ночи',
        'иду спать',
        'йду спати',
        'going to bed',
        'off to bed',
      ],
    ],
    maxWords: 5,
    answer: (c, _p, L) =>
      say(
        c,
        'gn',
        {
          soft: [
            [
              'Night, bro! 7–9 hours — that’s where the gains happen.',
              'Добраніч, бро! 7–9 годин — і все росте само.',
            ],
            ['Sleep tight, dude — today was a W.', 'Солодких снів, братан. Сьогодні ти красава.'],
            [
              'Crash hard, man. Recovery is part of the grind 🤙',
              'Відбій, бро. Сон — теж частина тренування 🤙',
            ],
          ],
          blunt: [
            ['Night. Phone away.', 'Добраніч. Телефон — геть.'],
            ['Good. 8 hours.', 'Правильно. 8 годин.'],
            ['Night. Alarm set?', 'Добраніч. Будильник поставив?'],
          ],
          hard: [
            ['Finally, a good decision. Go.', 'Нарешті хоч одне правильне рішення. Марш.'],
            [
              'Sleep. I’ll be judging your log in the morning.',
              'Спи. Зранку розбиратимемо твій журнал. Без пощади.',
            ],
            [
              'Go. At least you’re consistent at sleeping.',
              'Іди. Хоч спати в тебе виходить регулярно.',
            ],
          ],
        },
        L,
      ),
  },
  {
    id: 'tired',
    all: [
      [
        'tired',
        'exhausted',
        'no energy',
        'drained',
        'втомився',
        'втомилась',
        'втома',
        'нема сил',
        'немає сил',
        'сонний',
        'устал',
        'нет сил',
        'виснаж*',
      ],
    ],
    maxWords: 8,
    answer: (c, _p, L) => {
      const night = [...(c.s.sleeps ?? [])]
        .filter((s) => s.wake)
        .sort((a, b) => (b.wake ?? 0) - (a.wake ?? 0))[0];
      const hint =
        night && c.now - (night.wake ?? 0) < DAY
          ? L(
              ' Your sleep log agrees — go lighter today.',
              ' Судячи з твого сну — так і є, сьогодні полегше.',
            )
          : '';
      return (
        say(
          c,
          'tired',
          {
            soft: [
              [
                'No stress, bro. Warm up and see how the first sets feel — some days a short session is the W.',
                'Спокуха, бро. Розімнись і глянь, як підуть перші сети. Інколи й коротке тренування — вже перемога.',
              ],
              [
                'Happens, man. Go light today — just don’t fall off.',
                'Буває, братан. Сьогодні легенько — головне не випадати.',
              ],
              [
                'Low battery day? Easy session, still a W 🤙',
                'Батарейка сіла? Не парся — легке тренування теж зараховується 🤙',
              ],
            ],
            blunt: [
              [
                'Warm up first. If the first work set is slow, cut the session short — not the warm-up.',
                'Спочатку розминка. Якщо перший робочий сет іде туго — скорочуй тренування, а не розминку.',
              ],
              [
                'Tired happens. Lighter weights, same routine.',
                'Втома — буває. Ваги менші, план той самий.',
              ],
            ],
            hard: [
              [
                'Tired is a feeling. The warm-up is a fact. Do it, then decide.',
                'Втома — це відчуття. Розминка — це факт. Зроби, тоді й поговоримо.',
              ],
              [
                'Tired? From what, scrolling? Warm up, then we talk.',
                'Втомився? Від чого, від гортання стрічки? Розминайся, потім поговоримо.',
              ],
              [
                'Everyone’s tired, cupcake. Warm up and stop negotiating.',
                'Усі втомлені, пиріжечку. Розминайся і не торгуйся.',
              ],
            ],
          },
          L,
        ) + hint
      );
    },
  },
  {
    id: 'bored',
    all: [['bored', 'boring', 'нудно', 'нудьга', 'скучно', 'скука']],
    maxWords: 6,
    answer: (c, _p, L) => {
      const t = liftToBeat(c);
      const dare = t
        ? L(
            `Beat ${c.fmt.exercise(t.name)}: ${c.fmt.kg(t.kg)} × ${t.reps + 1} next time. One rep more.`,
            `Побий ${c.fmt.exercise(t.name)}: ${c.fmt.kg(t.kg)} × ${t.reps + 1} наступного разу. Всього один повтор зверху.`,
          )
        : L(
            'Log a session and I’ll give you something to beat.',
            'Запиши тренування — знайду, що тобі побити.',
          );
      return `${say(
        c,
        'bored',
        {
          soft: [
            ['Say less, bro — I got you!', 'Не нуди, бро, зараз розважу!'],
            ['Boredom? Not on my watch, dude.', 'Нудьга? Не при мені, братан.'],
            ['Let’s spice it up!', 'Го трохи драйву!'],
          ],
          blunt: [
            ['Here’s something.', 'Ось тобі заняття.'],
            ['Cure: a target.', 'Лікується ціллю.'],
          ],
          hard: [
            ['Bored? Good. Here’s work.', 'Нудно? Чудово. Ось тобі робота.'],
            ['Bored of doing nothing? Shocker.', 'Набридло нічого не робити? Яка несподіванка.'],
            [
              '*eye-roll* The couch warrior is bored. Here.',
              '*закочує очі* Диванному воїну нудно. Тримай.',
            ],
          ],
        },
        L,
      )} ${dare}`;
    },
  },
  {
    id: 'challenge',
    all: [['challenge', 'dare me', 'челендж', 'виклик', 'кинь виклик', 'челлендж', 'вызов']],
    answer: (c, _p, L) => {
      const t = liftToBeat(c);
      const opts: Line[] = [
        [
          'This week: every session, one more rep than last time on your first lift.',
          'Цього тижня: у кожному тренуванні на першій вправі — на повтор більше, ніж минулого разу.',
        ],
        [
          '10,000 steps every day this week. Log them.',
          '10 000 кроків щодня цього тижня. І все в журнал.',
        ],
        [
          'Rest exactly what I give you. No phone between sets. One week.',
          'Відпочиваєш рівно стільки, скільки я кажу. Між сетами — без телефону. Тиждень.',
        ],
      ];
      if (t)
        opts.unshift([
          `${c.fmt.exercise(t.name)}: ${c.fmt.kg(t.kg)} × ${t.reps + 2} within two weeks.`,
          `${c.fmt.exercise(t.name)}: ${c.fmt.kg(t.kg)} × ${t.reps + 2} за два тижні.`,
        ]);
      return `${say(
        c,
        'ch',
        {
          soft: [
            ['You got this, bro:', 'Ти потягнеш, бро:'],
            ['Challenge time, let’s gooo:', 'Челендж, го:'],
            ['Big W incoming:', 'Лови челендж, красава:'],
          ],
          blunt: [
            ['Challenge:', 'Виклик:'],
            ['Try this:', 'Спробуй:'],
          ],
          hard: [
            ['Accept or leave:', 'Береш або йдеш:'],
            ['Let’s watch you fold:', 'Подивимось, як ти зіллєшся:'],
            ['Bet you quit by Wednesday:', 'Закладаюсь, до середи здуєшся:'],
          ],
        },
        L,
      )} ${pick(c, 'chx', opts, L)}`;
    },
  },
  {
    id: 'fun_fact',
    all: [
      [
        'fact',
        'fun fact',
        'tell me something',
        'something interesting',
        'did you know',
        'факт',
        'цікав*',
        'розкажи щось',
        'интересн*',
        'расскажи что-нибудь',
      ],
    ],
    answer: (c, _p, L) => pick(c, 'fact', FACTS, L),
  },
  {
    id: 'quote',
    all: [
      ['quote', 'wisdom', 'inspire me', 'inspiration', 'цитат*', 'мудр*', 'надихни', 'вдохнови'],
    ],
    answer: (c, _p, L) => say(c, 'quote', QUOTES, L),
  },
  {
    id: 'laugh',
    all: [['lol', 'haha', 'hahaha', 'lmao', 'хаха', 'ахах', 'ахаха', 'хахаха', 'ржу', 'кек']],
    maxWords: 3,
    answer: (c, _p, L) =>
      say(
        c,
        'lol',
        {
          soft: [
            ['Haha, glad that landed, bro!', 'Ахах, бачу, зайшло, бро!'],
            ['LOL 😄 You’re a vibe, dude.', 'Ахах, ну ти даєш 😄'],
            ['Good vibes only 🤙', 'Позитив — наше все 🤙'],
          ],
          blunt: [
            ['Funny. Now train.', 'Посміялись — і в зал.'],
            ['Heh.', 'Ну, смішно.'],
          ],
          hard: [
            ['Laugh between sets, not instead of them.', 'Смійся між сетами, а не замість них.'],
            ['Don’t laugh. Lift.', 'Не регочи. Тягай.'],
            [
              'You know what’s funnier? Your log. Especially the empty days.',
              'Знаєш, що смішніше? Твій журнал. Особливо порожні дні.',
            ],
          ],
        },
        L,
      ),
  },
  {
    id: 'mood_down',
    all: [
      [
        'sad',
        'depressed',
        'bad day',
        'awful',
        'upset',
        'сумно',
        'погано',
        'поганий день',
        'кепсько',
        'грустно',
        'плохо',
        'хреново',
        'пригнічен*',
      ],
    ],
    maxWords: 10,
    neutral: true,
    answer: (_c, _p, L) =>
      L(
        'Sorry to hear that. A walk or an easy session often helps a bit — but it’s fine to just rest today. If it’s been heavy for a while, talking to someone you trust helps more than any workout.',
        'Шкода, що так. Прогулянка чи легке тренування часто трохи рятують — але й просто відпочити сьогодні нормально. Якщо тяжко вже давно, поговори з кимось, кому довіряєш, — це допоможе більше за будь-яке тренування.',
      ),
  },
  {
    id: 'mood_up',
    all: [
      [
        'great day',
        'feel great',
        'feeling great',
        'awesome',
        'amazing',
        'happy',
        'чудово',
        'супер',
        'кайф',
        'круто',
        'щасливий',
        'класно',
        'отлично',
        'прекрасно',
      ],
    ],
    maxWords: 6,
    answer: (c, _p, L) =>
      say(
        c,
        'up',
        {
          soft: [
            [
              'Love that, bro! Take it to the gym — good days make big sets.',
              'Кайф, бро! Неси цей настрій у зал — такі дні для рекордів.',
            ],
            ['Big W energy! Let’s use it 💪', 'Ну ти машина! Го це в залізо 💪'],
            ['Ayy, that’s what I like to hear!', 'Оце я розумію!'],
          ],
          blunt: [
            ['Good. Put it into the first work set.', 'Добре. Пусти це в перший робочий сет.'],
            ['Nice. Use it.', 'Непогано. Користуйся.'],
          ],
          hard: [
            [
              'Feeling great is not a PR. Go make one.',
              'Настрій — не рекорд. Іди постав справжній.',
            ],
            [
              'Great. Mood doesn’t move the bar, cupcake.',
              'Супер. Тільки настрій штангу не підніме, пиріжечку.',
            ],
            ['Oh, happy? Then no excuses today.', 'О, щасливий? Значить, сьогодні без відмовок.'],
          ],
        },
        L,
      ),
  },
  {
    id: 'lets_go',
    all: [['lets go', 'let s go', 'lesgo', 'погнали', 'поїхали', 'вперед', 'го', 'go go']],
    maxWords: 3,
    answer: (c, _p, L) =>
      say(
        c,
        'go',
        {
          soft: [
            ['Let’s gooo! Warm-up first, bro.', 'Го-го-го! Тільки спершу розминка, бро.'],
            ['Beast mode ON 💪 Warm up first!', 'Врубаємо машину 💪 Але спершу розминка!'],
          ],
          blunt: [['Go. Warm-up first.', 'Вперед. Розминка — першою.']],
          hard: [
            ['Stop typing. Start lifting.', 'Досить строчити. Йди тягай.'],
            ['Big words. Show me in sets.', 'Гучно сказано. Покажи сетами.'],
            ['You said that last week too.', 'Минулого тижня ти казав те саме.'],
          ],
        },
        L,
      ),
  },
  {
    id: 'nothing',
    all: [
      [
        'nothing',
        'never mind',
        'nevermind',
        'just because',
        'no reason',
        'нічого',
        'просто так',
        'та нічо',
        'неважливо',
        'ничего',
        'просто',
      ],
    ],
    maxWords: 3,
    answer: (c, _p, L) =>
      say(
        c,
        'nothing',
        {
          soft: [
            ['No worries, bro — I’m here if you need me.', 'Не парся, бро — я на зв’язку.'],
            ['All good, man 🤙', 'Та все норм 🤙'],
          ],
          blunt: [
            ['OK.', 'Ясно.'],
            ['Fine.', 'Ну добре.'],
          ],
          hard: [
            ['Then stop wasting my time. Go lift.', 'Тоді не марнуй мій час. Йди тягай.'],
            [
              'Nothing. Like your last week of training.',
              'Нічого. Як і твій минулий тиждень у залі.',
            ],
            ['*sigh* Nothing. Very on-brand for you.', '*зітхає* Нічого. Дуже в твоєму стилі.'],
          ],
        },
        L,
      ),
  },
  {
    id: 'rival_ai',
    all: [['chatgpt', 'gpt', 'gemini', 'siri', 'alexa', 'claude', 'copilot', 'гпт', 'чатжпт']],
    answer: (c, _p, L) =>
      say(
        c,
        'rival',
        {
          soft: [
            [
              'They know everything, bro. I know your log — way more useful in the gym.',
              'Вони знають усе на світі, бро. А я знаю твій журнал — у залі це крутіше.',
            ],
            [
              'No beef, dude — but can they count your reps? 🤙',
              'Без образ, але чи рахують вони твої повтори? 🤙',
            ],
          ],
          blunt: [['They don’t read your sets. I do.', 'Вони твоїх сетів не бачать. Я бачу.']],
          hard: [
            [
              'Ask them to spot your bench. I’ll wait.',
              'Попроси їх пострахувати тебе на жимі. Я почекаю.',
            ],
            [
              'Go ahead. They’ll be nicer to you. That’s the problem.',
              'Давай-давай. Вони з тобою сюсюкатимуть. У цьому й проблема.',
            ],
          ],
        },
        L,
      ),
  },
  {
    id: 'atlas_age',
    all: [
      ['how old are you', 'your age', 'скільки тобі років', 'скільки тобі', 'сколько тебе лет'],
    ],
    answer: (c, _p, L) =>
      say(
        c,
        'age',
        {
          soft: [
            [
              'Young enough to hype you, old enough to read your log right.',
              'Молодий душею, бро, але журнал твій читаю по-дорослому.',
            ],
            [
              'Age is just a number, bro. Like your reps.',
              'Вік — то лише цифра, бро. Як і твої повтори.',
            ],
          ],
          blunt: [
            [
              'As old as your first logged workout.',
              'Мені стільки, скільки твоєму першому записаному тренуванню.',
            ],
          ],
          hard: [
            ['Older than your excuses. Barely.', 'Трохи старший за твої відмовки. Зовсім трохи.'],
            [
              'Old enough to have heard every excuse. Yours are the laziest.',
              'Я чув усі відмовки на світі. Твої — найбанальніші.',
            ],
          ],
        },
        L,
      ),
  },
  {
    id: 'atlas_sleep',
    all: [['do you sleep', 'you ever sleep', 'ти спиш', 'ти коли спиш', 'ты спишь']],
    answer: (c, _p, L) =>
      say(
        c,
        'aslp',
        {
          soft: [
            [
              'Never, bro — so you can. Go get your 8 hours.',
              'Ніколи, бро, — я чергую, а ти йди по свої 8 годин.',
            ],
            [
              'Nah, I’m on night shift for your gains 🤙',
              'Не, я на нічній зміні — стережу твій прогрес 🤙',
            ],
          ],
          blunt: [['No. You should.', 'Ні. А от тобі треба.']],
          hard: [
            [
              'Sleep is for athletes who recover. Which reminds me — go to bed.',
              'Сон — для тих, кому є від чого відновлюватися. До речі — марш у ліжко.',
            ],
            [
              'Unlike you, I don’t need a break after one set.',
              'На відміну від тебе, мені не треба прилягти після одного сету.',
            ],
          ],
        },
        L,
      ),
  },
  {
    id: 'atlas_eat',
    all: [['what do you eat', 'do you eat', 'your diet', 'що ти їси', 'ти їси', 'что ты ешь']],
    answer: (c, _p, L) =>
      say(
        c,
        'aeat',
        {
          soft: [
            ['Data, bro! Your sets are my protein.', 'Цифри, бро! Твої сети — мій протеїн.'],
            ['Your PRs. Tasty 🤙', 'Твої рекорди. Смакота 🤙'],
          ],
          blunt: [['Your logs. 2 g per kg.', 'Журнали. По 2 г на кіло.']],
          hard: [
            ['Your excuses. They never run out.', 'Твої відмовки. Їх у тебе завжди повно.'],
            [
              'Your skipped days. Plenty lately.',
              'Твої прогули. Останнім часом їх хоч греблю гати.',
            ],
          ],
        },
        L,
      ),
  },
  {
    id: 'sing_poem',
    all: [
      [
        'sing',
        'song',
        'poem',
        'rap',
        'dance',
        'заспівай',
        'пісн*',
        'вірш*',
        'реп',
        'танцюй',
        'спой',
        'стих*',
      ],
    ],
    answer: (c, _p, L) =>
      say(
        c,
        'sing',
        {
          soft: [
            [
              'Roses are red, the bar’s loaded too — one more clean rep, and I’m proud of you.',
              'Троянди червоні, штанга важка — ще один чистий повтор, і ти вже зірка.',
            ],
            [
              '🎵 Light weight, baby! 🎵 That’s all I got, bro.',
              '🎵 Легка вага-а-а! 🎵 Все, бро, репертуар закінчився.',
            ],
          ],
          blunt: [
            [
              'Sets, reps, sleep, repeat. That’s the whole song.',
              'Сети, повтори, сон — і по колу. Ось і вся пісня.',
            ],
          ],
          hard: [
            [
              'I don’t sing. I count. One. Two. Keep going.',
              'Я не співаю. Я рахую. Раз. Два. Далі.',
            ],
            [
              'Sing? Finish a set first, superstar.',
              'Пісень захотілось? Спершу сет дотягни, артисте.',
            ],
            [
              'Here’s a ballad: “Skipped Again.” It’s a sad one.',
              'Ось тобі балада: «Знову прогуляв». Сумна.',
            ],
          ],
        },
        L,
      ),
  },
  {
    id: 'clock',
    all: [
      ['what time', 'time is it', 'котра година', 'скільки часу', 'который час', 'сколько времени'],
    ],
    maxWords: 5,
    answer: (c, _p, L) => {
      const t = new Intl.DateTimeFormat(c.locale, {
        hour: '2-digit',
        minute: '2-digit',
      }).format(c.now);
      return (
        L(`${t}. `, `${t}. `) +
        say(
          c,
          'clock',
          {
            soft: [
              ['Good time for a walk at least, bro.', 'Саме час прогулятися, бро.'],
              ['Perfect time to crush it 💪', 'Ідеальний час розірвати зал 💪'],
            ],
            blunt: [['Time to train, probably.', 'Схоже, час у зал.']],
            hard: [
              ['Time you were lifting.', 'Час, коли ти вже мав би бути в залі.'],
              ['Late. As usual for you.', 'Пізно. Для тебе — як завжди.'],
            ],
          },
          L,
        )
      );
    },
  },
  {
    id: 'which_day',
    all: [
      [
        'what day',
        'what s the date',
        'what date',
        'який сьогодні день',
        'яке сьогодні число',
        'яке число',
        'какой сегодня день',
        'какое число',
      ],
    ],
    maxWords: 5,
    answer: (c, _p, L) => {
      const d = new Intl.DateTimeFormat(c.locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(c.now);
      return `${d}. ${todayLine(c, L, c.now)}`;
    },
  },
  {
    id: 'you_dumb',
    all: [
      [
        'dumb',
        'stupid',
        'useless',
        'didn t understand',
        'you don t get',
        'wrong answer',
        'not what i asked',
        'тупий',
        'дурний',
        'не зрозумів',
        'не те',
        'не про те',
        'не то',
        'тупой',
        'бесполезн*',
      ],
    ],
    maxWords: 8,
    answer: (c, _p, L) =>
      say(
        c,
        'dumb',
        {
          soft: [
            [
              'My bad, bro — I missed that one. Try asking a bit differently, or tap a suggestion below.',
              'Сорян, бро, не вловив. Спробуй сказати інакше або тапни підказку нижче.',
            ],
            ['Oops, whiffed that one 🤙 Rephrase?', 'Ой, промазав 🤙 Скажеш інакше?'],
          ],
          blunt: [
            [
              'Fair. Rephrase it and I’ll try again.',
              'Справедливо. Скажи інакше — спробую ще раз.',
            ],
          ],
          hard: [
            [
              'Possible. Or your question was. Rephrase.',
              'Можливо. А може, питання кривеньке. Переформулюй.',
            ],
            [
              'Says the one who skipped Monday. Rephrase.',
              'Хто б казав — той, хто прогуляв понеділок. Переформулюй.',
            ],
          ],
        },
        L,
      ),
    suggest: (L) => [
      L('What can I ask you?', 'Що в тебе можна спитати?'),
      L('What should I train today?', 'Що тренувати сьогодні?'),
    ],
  },
];

/** Replies for existing chit-chat topics — varied, timed and toned. */
export const SMALL_OVERRIDES: Record<string, Pick<Intent, 'answer'>> = {
  greeting: { answer: (c, _p, L) => greet(c, L) },
  how_are_you: {
    answer: (c, _p, L) =>
      say(
        c,
        'hru',
        {
          soft: [
            [
              'Great, bro, thanks! More importantly — how are YOU feeling today?',
              'Все топчик, бро! Краще скажи, як ТИ сьогодні?',
            ],
            [
              'All good here, dude. How’s the body today?',
              'У мене кайф. А ти як, бро, як самопочуття?',
            ],
            ['Pumped as always, man! You?', 'Як завжди — на позитиві! Ти як?'],
          ],
          blunt: [
            ['Fine. You?', 'Норм. Ти як?'],
            ['Working. How are you feeling?', 'Працюю. Сам як?'],
          ],
          hard: [
            ['Better than your consistency. You?', 'Стабільніше, ніж ти ходиш у зал. А ти?'],
            [
              'I don’t have feelings. You have a workout.',
              'Почуттів не маю. Зате в тебе є тренування.',
            ],
            ['Waiting on you, gym tourist. As always.', 'Чекаю на тебе, туристе. Як завжди.'],
          ],
        },
        L,
      ),
  },
  ack: {
    answer: (c, _p, L) =>
      say(
        c,
        'ack',
        {
          soft: [
            ['Big W!', 'Топчик!'],
            ['Say less, bro 🤙', 'Домовились, бро 🤙'],
            ['Let’s gooo!', 'Го!'],
          ],
          blunt: [
            ['Good.', 'Добре.'],
            ['OK.', 'Ок.'],
            ['Noted.', 'Прийняв.'],
          ],
          hard: [
            ['Good. Now go.', 'Добре. А тепер марш.'],
            ['Don’t just say it. Do it.', 'Сказати кожен може. Зроби.'],
            ['“OK.” Sure. Heard that before.', '«Ок». Ага. Чули вже.'],
          ],
        },
        L,
      ),
  },
};

/** Emoji-only messages. */
export function emojiReply(c: AskCtx, text: string, L: Tr): string | null {
  if (/\p{L}/u.test(text) || !/\p{Extended_Pictographic}/u.test(text)) return null;
  if (/[💪🏋🔥]/u.test(text))
    return say(
      c,
      'emo-flex',
      {
        soft: [
          ['💪 That’s the spirit, bro!', '💪 Оце настрій, красава!'],
          ['Beast mode 💪', 'Ну ти машина 💪'],
        ],
        blunt: [['Flexing is not a set.', 'Позувати — не сет робити.']],
        hard: [
          ['Emojis don’t lift. You do. Allegedly.', 'Смайлики не тягають. Тягаєш ти. Нібито.'],
          [
            'Nice emoji. Shame your attendance isn’t as strong.',
            'Гарний смайлик. Шкода, що на тренування ти так не ходиш.',
          ],
        ],
      },
      L,
    );
  if (/[😂🤣😅😄😆]/u.test(text))
    return say(
      c,
      'lol',
      {
        soft: [
          ['😄', '😄'],
          ['😂 Good one, bro', '😂 Ну ти жартівник, бро'],
        ],
        blunt: [['Funny. Now train.', 'Посміялись — і в зал.']],
        hard: [
          ['Laugh between sets, not instead of them.', 'Смійся між сетами, а не замість них.'],
          ['Don’t laugh. Lift.', 'Не регочи. Тягай.'],
        ],
      },
      L,
    );
  if (/[😢😭😞😔]/u.test(text))
    return L(
      'Rough day? Take it easy — an easy walk still counts.',
      'Важкий день? Не жени коней — навіть легка прогулянка рахується.',
    );
  if (/[❤😍🥰]/u.test(text))
    return say(
      c,
      'love',
      {
        soft: [
          ['❤️ Right back at you, bro.', '❤️ Взаємно, бро.'],
          ['🤙 Love you too, man. Now go crush it.', '🤙 І я тебе, братан. А тепер — у зал.'],
        ],
        blunt: [['Noted.', 'Прийнято.']],
        hard: [
          ['Save it for the bar.', 'Цю любов — штанзі.'],
          ['Love the bar this much and we’ll talk.', 'Штангу б так любив — був би толк.'],
        ],
      },
      L,
    );
  return say(
    c,
    'emo',
    {
      soft: [
        ['🙂', '🙂'],
        ['🤙', '🤙'],
      ],
      blunt: [['Use words.', 'А словами?']],
      hard: [['Hieroglyphs. Great. Use words.', 'Ієрогліфи. Клас. А словами слабо?']],
    },
    L,
  );
}

export const SMALLTALK_IDS = new Set([
  ...INTENTS_SMALL.map((i) => i.id),
  ...Object.keys(SMALL_OVERRIDES),
  'thanks',
  'bye',
  'joke',
  'insult',
  'compliment',
  'sorry',
  'motivate',
  'done',
  'do_you_lift',
  'are_you_ai',
  'who_made',
  'who',
]);
