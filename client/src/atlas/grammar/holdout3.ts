/**
 * Third HELD-OUT set (blind): written and annotated BEFORE the robustness
 * round, scored once, never tuned on. Same format and guidelines as gold.ts.
 *
 * Deliberately hard: long compound-complex sentences, run-ons without
 * punctuation, relative clauses without "that", reported speech, modal chains,
 * questions without "?", passives, perfective futures, converbs/participles,
 * impersonal constructions and word numerals with units.
 *
 * Extra annotation conventions used here (consistent with gold.ts):
 *  - Modal chains pass through to the lexical verb; a modal perfect
 *    ("should have been able to lift", "could have avoided", "must have
 *    pulled", "would have done") is past. "used to", "be supposed to" and
 *    "be able to" pass through like modals; phase/control verbs (try, start,
 *    почати, keep) do not.
 *  - Eventive passive → the lexical verb ("I was told" → tell); a stative
 *    participle after a copula ("the gym was closed", "buvo uždaryta") → be.
 *  - Converb / participle phrases (виконуючи…, zrobiwszy…, darydamas…, tehes…,
 *    "having slept…", "after finishing…") are not clauses.
 *  - Impersonal predicates: a dative (or "у мене"/"mul") experiencer makes the
 *    subject that person; without one the subject is none/0. Ukrainian -но/-то
 *    forms are past, subject none.
 *  - Counterfactual conditionals ("якби знав, не зірвав би") are past.
 *  - Estonian has no morphological future: a present form about tomorrow is
 *    'present' (as in gold.ts).
 *  - "kui" = temporal for habitual "when", conditional for a one-off "if".
 *
 * BLIND RESULT (first and only run before any change, % correct, 2026-09-28,
 * analyser at commit 4e6fe22; overall 88.8 % of non-lang fields):
 *
 * | field        | en (80) | uk (80) | ru+ (40) | pl (35) | lt (35) | et (30) |
 * |--------------|---------|---------|----------|---------|---------|---------|
 * | lang         | 100.0   | 100.0   | 97.5     | 100.0   | 100.0   | 100.0   |
 * | type         | 92.5    | 86.3    | 95.0     | 97.1    | 85.7    | 96.7    |
 * | questionKind | 91.3    | 88.8    | 95.0     | 97.1    | 85.7    | 100.0   |
 * | whWord       | 96.3    | 90.0    | 92.5     | 100.0   | 94.3    | 96.7    |
 * | clauses      | 71.3    | 70.0    | 85.0     | 85.7    | 77.1    | 73.3    |
 * | pred         | 72.5    | 76.3    | 90.0     | 88.6    | 60.0    | 73.3    |
 * | subject      | 87.5    | 86.3    | 92.5     | 80.0    | 71.4    | 86.7    |
 * | tense        | 86.3    | 87.5    | 90.0     | 80.0    | 65.7    | 76.7    |
 * | negation     | 98.8    | 96.3    | 100.0    | 100.0   | 94.3    | 96.7    |
 * | person       | 87.5    | 86.3    | 92.5     | 80.0    | 71.4    | 86.7    |
 * | quantities   | 100.0   | 98.8    | 97.5     | 97.1    | 88.6    | 96.7    |
 * | timeRef      | 100.0   | 100.0   | 100.0    | 97.1    | 100.0   | 100.0   |
 *
 * After this run the set was used for error analysis (general mechanisms
 * only, no per-sentence rules), so later numbers on it are no longer blind.
 *
 * Two labels were corrected after the blind run (both annotation slips, not
 * analyser behaviour; the blind table above still counts them as errors):
 *  - "do you remember what i squatted last week": q/yesno → q/wh/what — gold.ts
 *    labels an embedded wh inside a yes/no request as wh ("Can you explain why…").
 *  - "…слишком лёгкая": lemma лёгкий → легкий — lemmas are ё-folded everywhere.
 */
import type { GoldRow } from './gold';

export const HOLDOUT3: GoldRow[] = [
  // ───────────────────────── English (80) ─────────────────────────
  [
    'en',
    'i should have been able to lift more today but my grip gave out',
    's | main,coord | lift user past - 1 | | today',
  ],
  [
    'en',
    'The plan you made for me last week was way too easy',
    's | main,sub:rel | be other past - 3 | | last_week',
  ],
  [
    'en',
    'what weight should i start with for incline press',
    'q/wh/what | main | start user present - 1 | |',
  ],
  [
    'en',
    'My coach said I was rounding my back on every rep',
    's | main,sub:comp | say other past - 3 | |',
  ],
  [
    'en',
    'I was told to rest for two weeks after the surgery',
    's | main | tell user past - 1 | 2 week |',
  ],
  [
    'en',
    'can you check whether my squat depth is ok',
    'q/yesno | main,sub:comp | check atlas present - 2 | |',
  ],
  [
    'en',
    'Doing squats with a bad knee is probably not smart',
    's | main | be other present + 3 | |',
  ],
  [
    'en',
    'After finishing my last set I felt dizzy and had to sit down',
    's | main | feel user past - 1 | |',
  ],
  [
    'en',
    'Could I have avoided this injury if I had warmed up properly?',
    'q/yesno | main,sub:cond | avoid user past - 1 | |',
  ],
  [
    'en',
    "I'd have done more reps if the spotter hadn't left",
    's | main,sub:cond | do user past - 1 | |',
  ],
  [
    'en',
    'Tell me which muscles the deadlift works',
    'c//which | main,sub:comp | tell atlas none - 2 | |',
  ],
  [
    'en',
    'how many calories did i burn on my run yesterday',
    'q/wh/how_many | main | burn user past - 1 | | yesterday',
  ],
  [
    'en',
    'The gym was closed so I trained at home for 40 minutes',
    's | main,coord | be other past - 3 | 40 min |',
  ],
  [
    'en',
    "If I'm not sore the next day does that mean the workout was useless",
    'q/yesno | sub:cond,main,sub:comp | mean other present - 3 | |',
  ],
  [
    'en',
    'Why do my wrists hurt every time I do front squats',
    'q/wh/why | main,sub:temp | hurt other present - 3 | |',
  ],
  [
    'en',
    'I have been trying to hit 140 kg on deadlift for months',
    's | main | try user past - 1 | 140 kg |',
  ],
  [
    'en',
    'Me and my girlfriend ran 10 km this morning',
    's | main | run user past - 1 | 10 km | this_morning',
  ],
  [
    'en',
    "Is it true that you can't build muscle after 40",
    'q/yesno | main,sub:comp | be other present - 3 | |',
  ],
  [
    'en',
    "Please don't schedule leg day on Friday because I play football",
    'c | main,sub:caus | schedule atlas none + 2 | | fri',
  ],
  [
    'en',
    'Would it be better to split upper and lower body or do full body three times a week',
    'q/choice | main | be other present - 3 | 3 time |',
  ],
  [
    'en',
    "I got injured last month and I'm still not able to run",
    's | main,coord | injure user past - 1 | | last_month',
  ],
  [
    'en',
    'Show me what I lifted on Monday',
    'c//what | main,sub:comp | show atlas none - 2 | | mon',
  ],
  [
    'en',
    'The shoes I bought yesterday are killing my feet',
    's | main,sub:rel | kill other present - 3 | | yesterday',
  ],
  [
    'en',
    'why does everyone say you should never train on an empty stomach',
    'q/wh/why | main,sub:comp | say other present - 3 | |',
  ],
  [
    'en',
    "You keep forgetting that I can't do overhead work",
    's | main,sub:comp | keep atlas present - 2 | |',
  ],
  [
    'en',
    'Having slept only four hours, I decided to skip the gym',
    's | main | decide user past - 1 | 4 h |',
  ],
  [
    'en',
    "I'm supposed to deload this week, right?",
    'q/tag | main | deload user present - 1 | | this_week',
  ],
  [
    'en',
    'How long will it take me to recover from a hamstring strain',
    'q/wh/how_long | main | take other future - 3 | |',
  ],
  [
    'en',
    'We should probably add more mobility work, what do you think',
    'q/wh/what | main,coord | add user present - 1 | |',
  ],
  [
    'en',
    'I benched 225 lbs for 3 sets of 5 on Tuesday',
    's | main | bench user past - 1 | 225 lb, 3 set, 5 rep | tue',
  ],
  [
    'en',
    'Nobody told me that creatine makes you retain water',
    's | main,sub:comp | tell other past + 3 | |',
  ],
  [
    'en',
    "Let's not do cardio today my legs are cooked",
    'c | main,coord | do user none + 1 | | today',
  ],
  [
    'en',
    'Has my resting heart rate gone down since I started running',
    'q/yesno | main,sub:temp | go other past - 3 | |',
  ],
  [
    'en',
    "I can't decide whether to cut or bulk",
    's | main,sub:comp | decide user present + 1 | |',
  ],
  [
    'en',
    'Every time I try to do pistol squats I fall over',
    's | sub:temp,main | fall user present - 1 | |',
  ],
  [
    'en',
    'My physio who treated my shoulder recommended band pull aparts',
    's | main,sub:rel | recommend other past - 3 | |',
  ],
  [
    'en',
    'Is 2 grams of protein per kilo too much',
    'q/yesno | main | be other present - 3 | 2 g |',
  ],
  ['en', 'Remind me to stretch after every session', 'c | main | remind atlas none - 2 | |'],
  [
    'en',
    'whats better for fat loss running or cycling',
    'q/wh/what | main | be other present - 3 | |',
  ],
  [
    'en',
    'I wish I had started lifting ten years ago',
    's | main,sub:comp | wish user present - 1 | 10 year |',
  ],
  [
    'en',
    'You were supposed to count my swim yesterday',
    's | main | count atlas past - 2 | | yesterday',
  ],
  [
    'en',
    "Don't you think five days a week is too much for a beginner",
    'q/yesno | main,sub:comp | think atlas present + 2 | 5 day |',
  ],
  [
    'en',
    'I ran my first half marathon in 1 hour 52 minutes',
    's | main | run user past - 1 | 1 h, 52 min |',
  ],
  ['en', "It's been three weeks since my last workout", 's | main | be other past - 3 | 3 week |'],
  [
    'en',
    'My knee gets swollen after long runs, should I see a doctor',
    'q/yesno | main,coord | get other present - 3 | |',
  ],
  [
    'en',
    "How do I know if I'm overtraining",
    'q/wh/how | main,sub:comp | know user present - 1 | |',
  ],
  [
    'en',
    'The trainer showed me how to brace properly',
    's//how | main,sub:comp | show other past - 3 | |',
  ],
  [
    'en',
    "I'm gonna try the program you suggested starting next week",
    's | main,sub:rel | try user future - 1 | | next_week',
  ],
  [
    'en',
    "Why wasn't my run from this morning saved",
    'q/wh/why | main | save other past + 3 | | this_morning',
  ],
  [
    'en',
    'I used to squat 150 but now I can barely do 100',
    's | main,coord | squat user past - 1 | | now',
  ],
  [
    'en',
    'Give me a quick core workout I can do in 15 minutes',
    'c | main,sub:rel | give atlas none - 2 | 15 min |',
  ],
  [
    'en',
    "I've never been able to feel my lats during pull ups",
    's | main | feel user past + 1 | |',
  ],
  [
    'en',
    'According to my friend stretching before running is useless',
    's | main | be other present - 3 | |',
  ],
  [
    'en',
    'Should I take creatine before or after training',
    'q/choice | main | take user present - 1 | |',
  ],
  [
    'en',
    "I think the reason my bench stalled is that I don't sleep enough",
    's | main,sub:comp,sub:rel,sub:comp | think user present - 1 | |',
  ],
  [
    'en',
    'She told me she would never go back to that gym',
    's | main,sub:comp | tell other past - 3 | |',
  ],
  [
    'en',
    "Could you make tomorrow's session a bit lighter",
    'q/yesno | main | make atlas present - 2 | | tomorrow',
  ],
  ['en', 'How often do you update my max', 'q/wh/how_often | main | update atlas present - 2 | |'],
  [
    'en',
    'My back was hurting all day so I skipped deadlifts',
    's | main,coord | hurt other past - 3 | |',
  ],
  ['en', 'I was able to do 12 pull ups in a row today', 's | main | do user past - 1 | | today'],
  ['en', 'where can i find my workout history', 'q/wh/where | main | find user present - 1 | |'],
  [
    'en',
    "If you had told me earlier I wouldn't have signed up for the marathon",
    's | sub:cond,main | sign user past + 1 | |',
  ],
  [
    'en',
    "What's the point of tracking steps if you don't count them",
    'q/wh/what | main,sub:cond | be other present - 3 | |',
  ],
  [
    'en',
    "I'll be doing a 5 day split starting in January",
    's | main | do user future - 1 | 5 day |',
  ],
  [
    'en',
    'Is it normal to feel nauseous after heavy leg day',
    'q/yesno | main | be other present - 3 | |',
  ],
  ['en', 'I need you to stop suggesting burpees', 's | main | need user present - 1 | |'],
  [
    'en',
    'Coming back from vacation my strength dropped a lot',
    's | main | drop other past - 3 | |',
  ],
  [
    'en',
    'do you remember what i squatted last week',
    'q/wh/what | main,sub:comp | remember atlas present - 2 | | last_week',
  ],
  [
    'en',
    'The weights were being hogged by some guy for 30 minutes',
    's | main | hog other past - 3 | 30 min |',
  ],
  [
    'en',
    'I lost 3 kg in 2 weeks is that too fast',
    'q/yesno | main,coord | lose user past - 1 | 3 kg, 2 week |',
  ],
  [
    'en',
    'Which exercise should replace dips if my shoulder clicks',
    'q/wh/which | main,sub:cond | replace other present - 3 | |',
  ],
  [
    'en',
    "Honestly I don't care about abs I just want to be strong",
    's | main,coord | care user present + 1 | |',
  ],
  [
    'en',
    'My friend who does crossfit says my program is boring',
    's | main,sub:rel,sub:comp | say other present - 3 | |',
  ],
  [
    'en',
    "How come I'm gaining weight even though I eat less",
    'q/wh/why | main,sub:conc | gain user present - 1 | |',
  ],
  [
    'en',
    'Log a 45 minute swim for yesterday',
    'c | main | log atlas none - 2 | 45 min | yesterday',
  ],
  ['en', 'I must have pulled something in my lower back', 's | main | pull user past - 1 | |'],
  [
    'en',
    "Tomorrow I'm going to test my deadlift max",
    's | main | test user future - 1 | | tomorrow',
  ],
  [
    'en',
    "Can't sleep after evening workouts any tips",
    'q/yesno | main | sleep user present + 1 | |',
  ],
  ['en', 'Why are my calves always so tight', 'q/wh/why | main | be other present - 3 | |'],
  [
    'en',
    'After I did the warm up you gave me my hips felt much looser',
    's | sub:temp,sub:rel,main | feel other past - 3 | |',
  ],

  // ───────────────────────── Ukrainian (80) ─────────────────────────
  [
    'uk',
    'вчора так і не зміг дожати останнє повторення бо руки вже не слухались',
    's | main,sub:caus | дожати user past + 1 | | yesterday',
  ],
  [
    'uk',
    'Програма, яку ти склав минулого тижня, мені не підходить',
    's | main,sub:rel | підходити other present + 3 | | last_week',
  ],
  ['uk', 'Мені болить, коли присідаю глибоко', 's | main,sub:temp | боліти user present - 1 | |'],
  [
    'uk',
    "Треба було розім'ятися краще, тепер тягне поперек",
    "s | main,coord | розім'ятися none past - 0 | |",
  ],
  [
    'uk',
    'Завтра зроблю легке кардіо і трохи розтяжки',
    's | main | зробити user future - 1 | | tomorrow',
  ],
  [
    'uk',
    'Коли я присідаю зі штангою, в мене хрустить коліно, це погано?',
    'q/yesno | sub:temp,main,coord | хрустіти other present - 3 | |',
  ],
  [
    'uk',
    'Виконуючи тягу в нахилі, я відчуваю біль у попереку',
    's | main | відчувати user present - 1 | |',
  ],
  [
    'uk',
    'Скільки підходів мені можна робити на спину після травми',
    'q/wh/how_many | main | робити user present - 1 | |',
  ],
  [
    'uk',
    'Не знаю, що робити, бо тренер у відпустці',
    's//what | main,sub:comp,sub:caus | знати user present + 1 | |',
  ],
  [
    'uk',
    'Ти казав, що мені треба більше спати, але я не можу заснути раніше',
    's | main,sub:comp,coord | казати atlas past - 2 | |',
  ],
  [
    'uk',
    'Мені набридло, що ти не рахуєш велосипед',
    's | main,sub:comp | набриднути user past - 1 | |',
  ],
  [
    'uk',
    'Зробивши три підходи, я зрозумів, що вага замала',
    's | main,sub:comp | зрозуміти user past - 1 | 3 set |',
  ],
  [
    'uk',
    'чи можна пити каву перед тренуванням якщо тиск високий',
    'q/yesno | main,sub:cond | пити none present - 0 | |',
  ],
  [
    'uk',
    'Запиши, що я сьогодні пробіг 7 км за 40 хвилин',
    'c | main,sub:comp | записати atlas none - 2 | 7 km, 40 min | today',
  ],
  ['uk', 'Поки ти думав, я вже зробив розминку', 's | sub:temp,main | зробити user past - 1 | |'],
  [
    'uk',
    'Мені не хочеться йти в зал, коли надворі дощ',
    's | main,sub:temp | йти user present + 1 | |',
  ],
  [
    'uk',
    'Скажи чесно чи я не перестараюсь якщо тренуватимусь щодня',
    'c | main,sub:comp,sub:cond | сказати atlas none - 2 | |',
  ],
  [
    'uk',
    'Я присідаю вже пів року, а прогресу майже немає',
    's | main,coord | присідати user present - 1 | 0.5 year |',
  ],
  [
    'uk',
    'Наступного тижня почну ходити на плавання двічі на тиждень',
    's | main | почати user future - 1 | 2 time | next_week',
  ],
  ['uk', 'Навіщо ти додав ще день ніг', 'q/wh/why | main | додати atlas past - 2 | |'],
  [
    'uk',
    'Коли болить плече, краще взагалі не робити жими над головою?',
    'q/yesno | sub:temp,main | робити none present + 0 | |',
  ],
  [
    'uk',
    'Я б хотів схуднути на 10 кг до весілля',
    's | main | схуднути user present - 1 | 10 kg |',
  ],
  [
    'uk',
    'Поясни, будь ласка, чому після бігу в мене німіють пальці на ногах',
    'c//why | main,sub:comp | пояснити atlas none - 2 | |',
  ],
  [
    'uk',
    'Лікар сказав, що з грижею не можна робити станову',
    's | main,sub:comp | сказати other past - 3 | |',
  ],
  [
    'uk',
    'Я не розумію, як ти рахуєш калорії',
    's//how | main,sub:comp | розуміти user present + 1 | |',
  ],
  [
    'uk',
    'Хлопець, з яким я тренуюсь, жме 120 на 5',
    's | main,sub:rel | жати other present - 3 | 120 kg, 5 rep |',
  ],
  [
    'uk',
    'Скільки часу займе відновлення після розтягнення',
    'q/wh/how_long | main | зайняти other future - 3 | |',
  ],
  [
    'uk',
    'Сьогодні ледве доповз до залу але потренувався непогано',
    's | main | доповзти user past - 1 | | today',
  ],
  [
    'uk',
    'Перестань нагадувати мені про воду кожні дві години',
    'c | main | перестати atlas none - 2 | 2 h |',
  ],
  [
    'uk',
    'Якщо я завтра не встану о шостій, перенеси тренування на вечір',
    'c | sub:cond,main | перенести atlas none - 2 | | tomorrow',
  ],
  [
    'uk',
    'Ти можеш порахувати, скільки я підняв за весь тиждень?',
    'q/wh/how_much | main,sub:comp | порахувати atlas present - 2 | |',
  ],
  [
    'uk',
    'Скільки я маю пити води, якщо важу 90 кг',
    'q/wh/how_much | main,sub:cond | пити user present - 1 | 90 kg |',
  ],
  [
    'uk',
    'Я вже тиждень не можу нормально спати через біль у плечі',
    's | main | спати user present + 1 | |',
  ],
  [
    'uk',
    'Мене турбує, що пульс на розминці вже 150',
    's | main,sub:comp | турбувати other present - 3 | |',
  ],
  [
    'uk',
    'Давай наступного тижня спробуємо 5х5',
    'c | main | спробувати user none - 1 | 5 set, 5 rep | next_week',
  ],
  [
    'uk',
    'Я поспішаю, дай щось на 20 хвилин',
    'c | main,coord | поспішати user present - 1 | 20 min |',
  ],
  [
    'uk',
    'Якби я знав це раніше, не зірвав би спину',
    's | sub:cond,main | зірвати user past + 1 | |',
  ],
  [
    'uk',
    'Коли ти нарешті навчишся рахувати мої кроки',
    'q/wh/when | main | навчитися atlas future - 2 | |',
  ],
  [
    'uk',
    'Жим лежачи в мене стоїть на місці вже два місяці',
    's | main | стояти other present - 3 | 2 month |',
  ],
  ['uk', "Розминаючись, я потягнув м'яз стегна", 's | main | потягнути user past - 1 | |'],
  [
    'uk',
    "Порадь, що з'їсти після вечірнього тренування, щоб не набрати жиру",
    'c//what | main,sub:comp,sub:purp | порадити atlas none - 2 | |',
  ],
  ['uk', 'Мені треба схуднути на 5 кг до травня', 's | main | схуднути user present - 1 | 5 kg |'],
  [
    'uk',
    'Чому, коли я біжу, в мене колить у боці',
    'q/wh/why | main,sub:temp | колоти user present - 1 | |',
  ],
  [
    'uk',
    "Я займаюся з понеділка по п'ятницю, а на вихідних відпочиваю",
    's | main | займатися user present - 1 | | mon',
  ],
  ['uk', 'Було важко, але я дотягнув до кінця', 's | main,coord | важко none past - 0 | |'],
  ['uk', 'Хто тобі дозволив міняти мою програму', 'q/wh/who | main | дозволити other past - 3 | |'],
  [
    'uk',
    'Мабуть, я занадто рано повернувся до бігу після травми',
    's | main | повернутися user past - 1 | |',
  ],
  [
    'uk',
    'Зроби мені план на 4 тижні, щоб я підготувався до змагань',
    'c | main,sub:purp | зробити atlas none - 2 | 4 week |',
  ],
  ['uk', 'У мене сьогодні день ніг чи спини', 'q/choice | main | - other present - 3 | | today'],
  [
    'uk',
    'Я набрав 3 кг за місяць, але штани досі налазять',
    's | main,coord | набрати user past - 1 | 3 kg |',
  ],
  [
    'uk',
    'Порахуй, скільки калорій я спалю, якщо пробіжу 10 км',
    'c//how_many | main,sub:comp,sub:cond | порахувати atlas none - 2 | 10 km |',
  ],
  [
    'uk',
    'Тренування, пропущене через хворобу, треба відпрацювати?',
    'q/yesno | main | відпрацювати none present - 0 | |',
  ],
  ['uk', 'Чи можна мені бігати з плоскостопістю', 'q/yesno | main | бігати user present - 1 | |'],
  [
    'uk',
    'Сусід по залу каже, що я неправильно тримаю гриф',
    's | main,sub:comp | казати other present - 3 | |',
  ],
  [
    'uk',
    'Скільки ваги я підняв сумарно за вчорашнє тренування',
    'q/wh/how_much | main | підняти user past - 1 | | yesterday',
  ],
  ['uk', 'Якщо чесно, мені вже набрид цей зал', 's | main | набриднути other past - 3 | |'],
  [
    'uk',
    'Дай знати, коли можна буде знову бігати',
    'c//when | main,sub:comp | дати atlas none - 2 | |',
  ],
  [
    'uk',
    'Чому мою вчорашню пробіжку не зараховано',
    'q/wh/why | main | зарахувати none past + 0 | | yesterday',
  ],
  [
    'uk',
    'Я пробіг двадцять один кілометр і майже не втомився',
    's | main | пробігти user past - 1 | 21 km |',
  ],
  [
    'uk',
    'Вчора ввечері я плавав півтори години',
    's | main | плавати user past - 1 | 1.5 h | yesterday',
  ],
  [
    'uk',
    'Ти мені так і не відповів, чому не зарахувалась пробіжка',
    's//why | main,sub:comp | відповісти atlas past + 2 | |',
  ],
  [
    'uk',
    'Поки не пройде коліно, робитиму тільки верх',
    's | sub:temp,main | робити user future - 1 | |',
  ],
  [
    'uk',
    'Чи варто брати пояс, коли присідаєш понад 100 кг',
    'q/yesno | main,sub:temp | брати none present - 0 | 100 kg |',
  ],
  [
    'uk',
    'Мені здається, ти неправильно порахував мої підходи',
    's | main,sub:comp | здаватися user present - 1 | |',
  ],
  [
    'uk',
    'Я стала сильнішою, відколи почала тренуватися з тобою',
    's | main,sub:temp | стати user past - 1 | |',
  ],
  [
    'uk',
    'Що мені робити, якщо судома хапає посеред ночі',
    'q/wh/what | main,sub:cond | робити user none - 1 | |',
  ],
  [
    'uk',
    "Хоча я їм багато білка, м'язи майже не ростуть",
    's | sub:conc,main | рости other present + 3 | |',
  ],
  [
    'uk',
    'Відпочинь сьогодні, а завтра зробимо груди',
    'c | main,coord | відпочити atlas none - 2 | | today',
  ],
  [
    'uk',
    'Я ненавиджу, коли хтось займає тренажер і сидить у телефоні',
    's | main,sub:temp | ненавидіти user present - 1 | |',
  ],
  ['uk', 'Я думав, що ти вже записав мою пробіжку', 's | main,sub:comp | думати user past - 1 | |'],
  [
    'uk',
    'Після того як я почав пити креатин, вага пішла вгору',
    's | sub:temp,main | піти other past - 3 | |',
  ],
  [
    'uk',
    'Скинь мені вправи на прес, які можна робити вдома',
    'c | main,sub:rel | скинути atlas none - 2 | |',
  ],
  [
    'uk',
    'За останній місяць я жодного разу не пропустив тренування',
    's | main | пропустити user past + 1 | |',
  ],
  [
    'uk',
    'Навіщо мені рахувати кроки, якщо я й так багато ходжу',
    'q/wh/why | main,sub:cond | рахувати user none - 1 | |',
  ],
  [
    'uk',
    'Тренуватимуся тричі на тиждень по годині',
    's | main | тренуватися user future - 1 | 3 time |',
  ],
  [
    'uk',
    'Моя дівчина хоче, щоб ми разом ходили на йогу',
    's | main,sub:comp | хотіти other present - 3 | |',
  ],
  [
    'uk',
    'Не можу зрозуміти, чому вага стоїть, хоча я на дефіциті',
    's//why | main,sub:comp,sub:conc | зрозуміти user present + 1 | |',
  ],
  [
    'uk',
    'ти рахуєш присідання без ваги як тренування чи ні',
    'q/yesno | main | рахувати atlas present - 2 | |',
  ],
  [
    'uk',
    'Я хочу підсушитися за 6 тижнів до відпустки',
    's | main | підсушитися user present - 1 | 6 week |',
  ],
  ['uk', 'Коли я востаннє робив тягу', 'q/wh/when | main | робити user past - 1 | |'],

  // ─────────────── Russian / surzhyk / transliteration (40) ───────────────
  [
    'ru',
    'Вчера не смог доделать тренировку, потому что закружилась голова',
    's | main,sub:caus | доделать user past + 1 | | yesterday',
  ],
  [
    'ru',
    'Сколько мне нужно спать, чтобы восстанавливаться',
    'q/wh/how_much | main,sub:purp | спать user present - 1 | |',
  ],
  ['ru', 'Мне больно после бега', 's | main | больно user present - 1 | |'],
  [
    'ru',
    'Если завтра пойдёт дождь, я побегаю на дорожке',
    's | sub:cond,main | побегать user future - 1 | | tomorrow',
  ],
  [
    'ru',
    'Программа, которую ты мне дал, слишком лёгкая',
    's | main,sub:rel | легкий other present - 3 | |',
  ],
  ['ru', 'Я уже месяц хожу в зал, а вес не уходит', 's | main,coord | ходить user present - 1 | |'],
  [
    'ru',
    'Подскажи, как правильно дышать при жиме',
    'c//how | main,sub:comp | подсказать atlas none - 2 | |',
  ],
  [
    'ru',
    'Почему ты не засчитал мою вчерашнюю пробежку',
    'q/wh/why | main | засчитать atlas past + 2 | | yesterday',
  ],
  [
    'ru',
    'Сделаю 4 подхода по 8 и пойду домой',
    's | main | сделать user future - 1 | 4 set, 8 rep |',
  ],
  ['ru', 'Можно ли качать пресс каждый день', 'q/yesno | main | качать none present - 0 | |'],
  [
    'ru',
    'Тренер говорит, что я слишком быстро опускаю штангу',
    's | main,sub:comp | говорить other present - 3 | |',
  ],
  [
    'ru',
    'Мне надоело, что ты всё время советуешь отдыхать',
    's | main,sub:comp | надоесть user past - 1 | |',
  ],
  [
    'ru',
    'Выполняя становую, я почувствовал резкую боль в спине',
    's | main | почувствовать user past - 1 | |',
  ],
  [
    'ru',
    'Когда ты начнёшь учитывать мои тренировки на велосипеде',
    'q/wh/when | main | начать atlas future - 2 | |',
  ],
  [
    'ru',
    'Я пробежал полтора километра за 7 минут',
    's | main | пробежать user past - 1 | 1.5 km, 7 min |',
  ],
  [
    'ru',
    'Нам с другом надо подготовиться к забегу за 2 месяца',
    's | main | подготовиться user present - 1 | 2 month |',
  ],
  [
    'sz',
    'шо мені робить якщо болить колєно після присіда',
    'q/wh/what | main,sub:cond | робити user none - 1 | |',
  ],
  [
    'sz',
    'я вчора так накачався шо сьодні руки не розгинаються',
    's | main,sub:res | накачатися user past - 1 | | yesterday',
  ],
  [
    'sz',
    'короче тренер сказав шо мені нада більше їсти',
    's | main,sub:comp | сказати other past - 3 | |',
  ],
  [
    'sz',
    'чого ти вообще не порахував мою пробіжку',
    'q/wh/why | main | порахувати atlas past + 2 | |',
  ],
  ['sz', 'сьогодні буду качать спину і біцуху', 's | main | качати user future - 1 | | today'],
  ['sz', 'мені нада скинуть кіла 4 до літа', 's | main | скинути user present - 1 | 4 kg |'],
  [
    'sz',
    'шо лучше робить спочатку кардіо чи желєзо',
    'q/wh/what | main | робити none present - 0 | |',
  ],
  [
    'sz',
    'я канєшно розумію шо треба відпочивати але не можу сидіти вдома',
    's | main,sub:comp | розуміти user present - 1 | |',
  ],
  [
    'sz',
    'скільки раз в тиждень нада бігать шоб схуднуть',
    'q/wh/how_many | main,sub:purp | бігати none present - 0 | |',
  ],
  ['sz', 'вобщем пропустив тиждень бо болів', 's | main,sub:caus | пропустити user past - 1 | |'],
  ['uk-tr', 'chomu meni bolyt pislia prysidan', 'q/wh/why | main | боліти user present - 1 | |'],
  ['uk-tr', 'zavtra zroblyu legke kardio', 's | main | зробити user future - 1 | | tomorrow'],
  ['uk-tr', 'skilky treba pyty vody na den', 'q/wh/how_much | main | пити none present - 0 | |'],
  [
    'uk-tr',
    'ya vchora probig 10 km i duzhe vtomyvsia',
    's | main | пробігти user past - 1 | 10 km | yesterday',
  ],
  [
    'uk-tr',
    'pokazhy yak robyty yagodychnyj mist',
    'c//how | main,sub:comp | показати atlas none - 2 | |',
  ],
  ['uk-tr', 'ty ne zarakhuvav moie trenuvannia', 's | main | зарахувати atlas past + 2 | |'],
  [
    'uk-tr',
    'yakshcho bolyt spyna, shcho robyty',
    'q/wh/what | sub:cond,main | робити none none - 0 | |',
  ],
  [
    'uk-tr',
    'chy mozhna trenuvatys pislia shcheplennia',
    'q/yesno | main | тренуватися none present - 0 | |',
  ],
  [
    'ru-tr',
    'pochemu u menya bolit plecho posle zhima',
    'q/wh/why | main | болеть other present - 3 | |',
  ],
  ['ru-tr', 'zavtra budu delat nogi', 's | main | делать user future - 1 | | tomorrow'],
  ['ru-tr', 'skolko podhodov delat na grud', 'q/wh/how_many | main | делать none none - 0 | |'],
  ['ru-tr', 'ya vchera probezhal 5 km', 's | main | пробежать user past - 1 | 5 km | yesterday'],
  ['ru-tr', 'ty ne zapisal moyu trenirovku', 's | main | записать atlas past + 2 | |'],
  ['ru-tr', 'mne nuzhno bolshe belka', 's | main | нужно user present - 1 | |'],

  // ───────────────────────── Polish (35) ─────────────────────────
  [
    'pl',
    'Wczoraj nie mogłem zrobić ostatniej serii, bo bolały mnie plecy',
    's | main,sub:caus | zrobić user past + 1 | | yesterday',
  ],
  [
    'pl',
    'Jutro zrobię trening nóg i trochę cardio',
    's | main | zrobić user future - 1 | | tomorrow',
  ],
  ['pl', 'Plan, który mi dałeś, jest za łatwy', 's | main,sub:rel | być other present - 3 | |'],
  [
    'pl',
    'Ile powinienem jeść białka, żeby urosnąć',
    'q/wh/how_much | main,sub:purp | jeść user present - 1 | |',
  ],
  [
    'pl',
    'Kiedy biegam dłużej niż godzinę, bolą mnie kolana',
    's | sub:temp,main | boleć other present - 3 | |',
  ],
  ['pl', 'Czy mogę pić kawę przed treningiem', 'q/yesno | main | pić user present - 1 | |'],
  ['pl', 'Będę trenować cztery razy w tygodniu', 's | main | trenować user future - 1 | 4 time |'],
  [
    'pl',
    'Nie wiem, dlaczego moja waga stoi w miejscu',
    's//why | main,sub:comp | wiedzieć user present + 1 | |',
  ],
  [
    'pl',
    'Trener powiedział, że powinienem więcej spać',
    's | main,sub:comp | powiedzieć other past - 3 | |',
  ],
  [
    'pl',
    'Pokaż mi, ile przebiegłem w tym tygodniu',
    'c//how_much | main,sub:comp | pokazać atlas none - 2 | | this_week',
  ],
  ['pl', 'Dlaczego nie zapisałeś mojego treningu', 'q/wh/why | main | zapisać atlas past + 2 | |'],
  [
    'pl',
    'Robiąc martwy ciąg, poczułem ból w dolnej części pleców',
    's | main | poczuć user past - 1 | |',
  ],
  ['pl', 'Przebiegłam 10 km w 55 minut', 's | main | przebiec user past - 1 | 10 km, 55 min |'],
  [
    'pl',
    'Jeśli jutro będzie padać, pójdę na siłownię zamiast biegać',
    's | sub:cond,main | pójść user future - 1 | | tomorrow',
  ],
  ['pl', 'Muszę schudnąć 8 kg do wakacji', 's | main | schudnąć user present - 1 | 8 kg |'],
  [
    'pl',
    'Co mam zrobić, jeśli boli mnie bark po wyciskaniu',
    'q/wh/what | main,sub:cond | zrobić user present - 1 | |',
  ],
  [
    'pl',
    'Mój kolega, który trenuje od lat, mówi, że robię to źle',
    's | main,sub:rel,sub:comp | mówić other present - 3 | |',
  ],
  ['pl', 'Zrób mi plan na 6 tygodni', 'c | main | zrobić atlas none - 2 | 6 week |'],
  [
    'pl',
    'Czy to normalne, że po treningu drżą mi ręce',
    'q/yesno | main,sub:comp | normalny other present - 3 | |',
  ],
  [
    'pl',
    'Jak długo mam odpoczywać między seriami',
    'q/wh/how_long | main | odpoczywać user present - 1 | |',
  ],
  [
    'pl',
    'Wczoraj zrobiłem przysiad 100 kg na 5 powtórzeń',
    's | main | zrobić user past - 1 | 100 kg, 5 rep | yesterday',
  ],
  ['pl', 'Nie mam dziś siły na trening', 's | main | mieć user present + 1 | | today'],
  [
    'pl',
    'Kiedy w końcu zaczniesz liczyć moje kroki',
    'q/wh/when | main | zacząć atlas future - 2 | |',
  ],
  [
    'pl',
    'Chciałbym zacząć biegać, ale nie wiem od czego zacząć',
    's//what | main,sub:comp | zacząć user present - 1 | |',
  ],
  [
    'pl',
    'Boli mnie łokieć, kiedy robię podciąganie',
    's | main,sub:temp | boleć other present - 3 | |',
  ],
  [
    'pl',
    'Ćwiczę od dwóch lat i dalej nie umiem zrobić pompki na jednej ręce',
    's | main | ćwiczyć user present - 1 | 2 year |',
  ],
  [
    'pl',
    'Ile kalorii spaliłem podczas wczorajszego biegu',
    'q/wh/how_many | main | spalić user past - 1 | | yesterday',
  ],
  [
    'pl',
    'Czy lepiej trenować rano czy wieczorem',
    'q/choice | main | trenować none present - 0 | |',
  ],
  ['pl', 'Nie rób mi więcej dni cardio', 'c | main | robić atlas none + 2 | |'],
  ['pl', 'Po treningu zawsze jestem głodny jak wilk', 's | main | być user present - 1 | |'],
  [
    'pl',
    'Myślę, że przetrenowałem się w tym tygodniu',
    's | main,sub:comp | myśleć user present - 1 | | this_week',
  ],
  ['pl', 'Gdzie mogę zobaczyć moje rekordy', 'q/wh/where | main | zobaczyć user present - 1 | |'],
  [
    'pl',
    'Siłownia była zamknięta, więc pobiegałem w parku',
    's | main,coord | być other past - 3 | |',
  ],
  [
    'pl',
    'Za tydzień startuję w półmaratonie i trochę się stresuję',
    's | main | startować user present - 1 | |',
  ],
  [
    'pl',
    'Mam trenować jutro czy odpocząć',
    'q/choice | main | trenować user present - 1 | | tomorrow',
  ],

  // ───────────────────────── Lithuanian (35) ─────────────────────────
  [
    'lt',
    'Vakar negalėjau užbaigti treniruotės, nes skaudėjo nugarą',
    's | main,sub:caus | užbaigti user past + 1 | | yesterday',
  ],
  ['lt', 'Rytoj bėgsiu 10 km', 's | main | bėgti user future - 1 | 10 km | tomorrow'],
  ['lt', 'Planas, kurį man davei, per lengvas', 's | main,sub:rel | lengvas other present - 3 | |'],
  [
    'lt',
    'Kiek baltymų turiu valgyti per dieną',
    'q/wh/how_much | main | valgyti user present - 1 | |',
  ],
  [
    'lt',
    'Kai bėgu ilgiau nei valandą, man skauda kelius',
    's | sub:temp,main | skaudėti user present - 1 | |',
  ],
  ['lt', 'Ar galiu gerti kavą prieš treniruotę', 'q/yesno | main | gerti user present - 1 | |'],
  [
    'lt',
    'Treniruosiuosi keturis kartus per savaitę',
    's | main | treniruotis user future - 1 | 4 time |',
  ],
  [
    'lt',
    'Nežinau, kodėl mano svoris nekrenta',
    's//why | main,sub:comp | žinoti user present + 1 | |',
  ],
  [
    'lt',
    'Treneris sakė, kad turėčiau daugiau miegoti',
    's | main,sub:comp | sakyti other past - 3 | |',
  ],
  [
    'lt',
    'Parodyk, kiek nubėgau šią savaitę',
    'c//how_much | main,sub:comp | parodyti atlas none - 2 | | this_week',
  ],
  ['lt', 'Kodėl neužskaitei mano bėgimo', 'q/wh/why | main | užskaityti atlas past + 2 | |'],
  [
    'lt',
    'Darydamas mirties trauką, pajutau skausmą apatinėje nugaros dalyje',
    's | main | pajusti user past - 1 | |',
  ],
  ['lt', 'Nubėgau 5 km per 25 minutes', 's | main | nubėgti user past - 1 | 5 km, 25 min |'],
  [
    'lt',
    'Jei rytoj lis, eisiu į sporto salę',
    's | sub:cond,main | eiti user future - 1 | | tomorrow',
  ],
  ['lt', 'Man reikia numesti 6 kg iki vasaros', 's | main | numesti user present - 1 | 6 kg |'],
  [
    'lt',
    'Ką man daryti, jei skauda petį po spaudimo',
    'q/wh/what | main,sub:cond | daryti user none - 1 | |',
  ],
  [
    'lt',
    'Mano draugas, kuris sportuoja jau penkerius metus, sako, kad darau klaidą',
    's | main,sub:rel,sub:comp | sakyti other present - 3 | 5 year |',
  ],
  ['lt', 'Sudaryk man planą trims savaitėms', 'c | main | sudaryti atlas none - 2 | 3 week |'],
  [
    'lt',
    'Ar normalu, kad po treniruotės dreba rankos',
    'q/yesno | main,sub:comp | normalu other present - 3 | |',
  ],
  ['lt', 'Kiek laiko ilsėtis tarp serijų', 'q/wh/how_long | main | ilsėtis none none - 0 | |'],
  ['lt', 'Šiandien neturiu jėgų treniruotis', 's | main | turėti user present + 1 | | today'],
  [
    'lt',
    'Kada pagaliau pradėsi skaičiuoti mano žingsnius',
    'q/wh/when | main | pradėti atlas future - 2 | |',
  ],
  [
    'lt',
    'Norėčiau pradėti bėgioti, bet nežinau nuo ko pradėti',
    's//what | main,sub:comp | pradėti user present - 1 | |',
  ],
  [
    'lt',
    'Man skauda alkūnę, kai darau prisitraukimus',
    's | main,sub:temp | skaudėti user present - 1 | |',
  ],
  [
    'lt',
    'Sportuoju dvejus metus, o vis dar negaliu prisitraukti',
    's | main | sportuoti user present - 1 | 2 year |',
  ],
  [
    'lt',
    'Kiek kalorijų sudeginau vakar bėgdamas',
    'q/wh/how_many | main | sudeginti user past - 1 | | yesterday',
  ],
  ['lt', 'Geriau treniruotis ryte ar vakare', 'q/choice | main | treniruotis none present - 0 | |'],
  ['lt', 'Neduok man daugiau poilsio dienų', 'c | main | duoti atlas none + 2 | |'],
  ['lt', 'Po treniruotės visada būnu labai alkanas', 's | main | būti user present - 1 | |'],
  [
    'lt',
    'Manau, kad šią savaitę persitreniravau',
    's | main,sub:comp | manyti user present - 1 | | this_week',
  ],
  ['lt', 'Kur galiu pamatyti savo rekordus', 'q/wh/where | main | pamatyti user present - 1 | |'],
  ['lt', 'Salė buvo uždaryta, todėl bėgiojau parke', 's | main,coord | būti other past - 3 | |'],
  [
    'lt',
    'Ar turėčiau imti diržą, kai spaudžiu virš 100 kg',
    'q/yesno | main,sub:temp | imti user present - 1 | 100 kg |',
  ],
  [
    'lt',
    'Rytoj ilsėsiuosi, nes vakar nubėgau pusmaratonį',
    's | main,sub:caus | ilsėtis user future - 1 | | tomorrow',
  ],
  ['lt', 'Tu vėl pamiršai mano plaukimą', 's | main | pamiršti atlas past - 2 | |'],

  // ───────────────────────── Estonian (30) ─────────────────────────
  [
    'et',
    'Eile ei suutnud ma viimast seeriat lõpetada, sest selg valutas',
    's | main,sub:caus | lõpetama user past + 1 | | yesterday',
  ],
  ['et', 'Homme jooksen 10 km', 's | main | jooksma user present - 1 | 10 km | tomorrow'],
  [
    'et',
    'Plaan, mille sa mulle andsid, on liiga kerge',
    's | main,sub:rel | olema other present - 3 | |',
  ],
  [
    'et',
    'Kui palju valku ma peaksin päevas sööma',
    'q/wh/how_much | main | sööma user present - 1 | |',
  ],
  [
    'et',
    'Kui ma jooksen üle tunni, valutavad põlved',
    's | sub:temp,main | valutama other present - 3 | |',
  ],
  ['et', 'Kas ma võin enne trenni kohvi juua', 'q/yesno | main | jooma user present - 1 | |'],
  ['et', 'Ma treenin neli korda nädalas', 's | main | treenima user present - 1 | 4 time |'],
  [
    'et',
    'Ma ei tea, miks mu kaal ei lange',
    's//why | main,sub:comp | teadma user present + 1 | |',
  ],
  [
    'et',
    'Treener ütles, et ma peaksin rohkem magama',
    's | main,sub:comp | ütlema other past - 3 | |',
  ],
  [
    'et',
    'Näita, kui palju ma sel nädalal jooksin',
    'c//how_much | main,sub:comp | näitama atlas none - 2 | | this_week',
  ],
  ['et', 'Miks sa mu jooksu kirja ei pannud', 'q/wh/why | main | panema atlas past + 2 | |'],
  ['et', 'Jõutõmmet tehes tundsin teravat valu alaseljas', 's | main | tundma user past - 1 | |'],
  ['et', 'Jooksin 5 km 27 minutiga', 's | main | jooksma user past - 1 | 5 km, 27 min |'],
  [
    'et',
    'Kui homme sajab, lähen jõusaali',
    's | sub:cond,main | minema user present - 1 | | tomorrow',
  ],
  ['et', 'Mul on vaja suveks 5 kg alla võtta', 's | main | võtma user present - 1 | 5 kg |'],
  [
    'et',
    'Mida ma peaksin tegema, kui õlg valutab',
    'q/wh/what | main,sub:cond | tegema user present - 1 | |',
  ],
  [
    'et',
    'Mu sõber, kes käib jõusaalis juba aastaid, ütleb, et ma teen valesti',
    's | main,sub:rel,sub:comp | ütlema other present - 3 | |',
  ],
  ['et', 'Koosta mulle kolmenädalane plaan', 'c | main | koostama atlas none - 2 | |'],
  [
    'et',
    'Kas on normaalne, et pärast trenni käed värisevad',
    'q/yesno | main,sub:comp | olema other present - 3 | |',
  ],
  ['et', 'Kui kaua seeriate vahel puhata', 'q/wh/how_long | main | puhkama none none - 0 | |'],
  ['et', 'Täna pole mul jõudu trenni teha', 's | main | olema user present + 1 | | today'],
  ['et', 'Millal sa mu plaani uuendad', 'q/wh/when | main | uuendama atlas present - 2 | |'],
  [
    'et',
    'Tahaksin hakata jooksma, kuid ma ei tea, kust alustada',
    's//where | main,coord,sub:comp | hakkama user present - 1 | |',
  ],
  [
    'et',
    'Küünarnukk valutab, kui ma lõuga tõmban',
    's | main,sub:temp | valutama other present - 3 | |',
  ],
  [
    'et',
    'Käin jõusaalis kaks aastat ja ikka ei suuda lõuga tõmmata',
    's | main | käima user present - 1 | 2 year |',
  ],
  [
    'et',
    'Mitu kalorit ma eile jooksuga põletasin',
    'q/wh/how_many | main | põletama user past - 1 | | yesterday',
  ],
  [
    'et',
    'Kas parem on trenni teha hommikul või õhtul',
    'q/choice | main | olema other present - 3 | |',
  ],
  ['et', 'Ära anna mulle rohkem puhkepäevi', 'c | main | andma atlas none + 2 | |'],
  ['et', 'Pärast trenni olen alati väga näljane', 's | main | olema user present - 1 | |'],
  [
    'et',
    'Arvan, et ületreenisin sel nädalal',
    's | main,sub:comp | arvama user present - 1 | | this_week',
  ],
];
