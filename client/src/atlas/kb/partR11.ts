/**
 * Round 11: how people TELL things (statements, not questions), negations,
 * gym slang and "which is better" wordings — the gaps an evaluation run
 * showed (eval/corpus.ts). Written as new phrasings, never copies of the
 * exam's messages.
 */
export const KB_R11: Record<string, { ex: string[]; exUk: string[] }> = {
  comeback: {
    ex: [
      "haven't trained in weeks, where do i pick up",
      'been off the gym for a while now',
      'took a month off lifting, how do i restart',
      'skipped the gym for two weeks straight',
      'back to lifting after a long pause',
      'i fell off the wagon for a few weeks',
    ],
    exUk: [
      'давно не був у залі, з чого почати знову',
      'два тижні не тренувався взагалі',
      'місяць пропустила тренування',
      'після довгої паузи повертаюсь у зал',
      'довго не ходив на тренування, як втягнутись',
      'випав з режиму на кілька тижнів',
    ],
  },
  home: {
    ex: [
      'gym is shut, what can i do at home',
      "can't get to the gym today, home workout?",
      'no gym access this week',
      'my gym is under renovation, how do i train',
    ],
    exUk: [
      'зал не працює, що робити вдома',
      'не можу потрапити в зал сьогодні',
      'зал на ремонті, як тренуватись',
      'сьогодні без залу, що можна вдома',
    ],
  },
  train_sore: {
    ex: [
      'is doms normal',
      'why am i so sore two days later',
      "everything aches from yesterday's session",
      'sore all over after training, still lift?',
    ],
    exUk: [
      'крепатура це нормально',
      'після тренування все тіло ломить',
      'мʼязи ниють на другий день, тренуватись?',
      'все тіло болить після залу, це нормально',
    ],
  },
  fat_loss: {
    ex: [
      'is lifting or running better to lose fat',
      'weights vs cardio for burning fat',
      'to drop body fat should i run or lift',
    ],
    exUk: [
      'для спалення жиру краще біг чи зал',
      'силові чи кардіо щоб скинути вагу',
      'щоб схуднути краще бігати чи тягати залізо',
    ],
  },
  pre_meal: {
    ex: [
      'how long to wait after a meal before lifting',
      'can i train right after dinner',
      'is it bad to lift on a full stomach',
    ],
    exUk: [
      'скільки чекати після їжі перед залом',
      'можна тренуватись одразу після обіду',
      'погано тренуватись на повний шлунок?',
    ],
  },
  bench_alone: {
    ex: [
      'no one to spot me on bench',
      'training alone, how do i bench safely',
      'bench press without a partner',
    ],
    exUk: [
      'нема кому страхувати на жимі',
      'тренуюсь сам, як безпечно жати лежачи',
      'жим лежачи без напарника',
    ],
  },
  motivation: {
    ex: [
      'not in the mood to train',
      'zero drive to lift today',
      'just not into it today',
      "don't feel like going to the gym",
    ],
    exUk: [
      'не в настрої тренуватись',
      'ліньки йти в зал',
      'сьогодні взагалі не хочеться',
      'немає бажання йти на тренування',
    ],
  },
  tired: {
    ex: [
      'dead tired after work, should i go',
      'wiped out, gym or not',
      'completely drained after my shift',
    ],
    exUk: [
      'вбитий після роботи, чи йти в зал',
      'сил нуль після роботи',
      'дуже втомився після зміни',
    ],
  },
  rest_day: {
    ex: ['do i need days off', 'how many rest days per week', 'is it ok to have no rest days'],
    exUk: [
      'чи треба вихідні від залу',
      'скільки днів відпочинку на тиждень',
      'чи можна взагалі без днів відпочинку',
    ],
  },
  fasted: {
    ex: ['training during a fast', 'lifting while fasting', 'gym during lent or ramadan'],
    exUk: ['тренування під час посту', 'чи можна качатись у піст', 'зал коли постишся'],
  },
  running: {
    ex: [
      'does running hurt leg gains',
      'will jogging ruin my squat',
      'does running eat my leg muscle',
    ],
    exUk: ['біг шкодить ногам?', 'чи заважає біг набирати ноги', 'від бігу ноги не будуть рости?'],
  },
  recovery: {
    ex: ['have my muscles recovered', 'am i fresh enough to lift again', 'recovery status'],
    exUk: [
      'як там відновлення',
      'чи мʼязи вже відновились',
      'как там восстановление',
      'я восстановился?',
      'мышцы восстановились?',
    ],
  },
  progress_lift: {
    ex: [
      'is my squat moving up',
      'is my bench getting better or not',
      'are my deadlift numbers going up',
    ],
    exUk: ['чи рухається мій жим вгору', 'присід росте чи стоїть', 'станова йде вгору чи ні'],
  },
  next_weight: {
    ex: [
      'how heavy tomorrow on deadlift',
      'what should i load on squat next session',
      'what do i put on the bar for bench next time',
    ],
    exUk: [
      'скільки ставити на станову завтра',
      'яку вагу чіпляти на присід наступного разу',
      'скільки повісити на жим завтра',
    ],
  },
  supplements: {
    ex: [
      'creatine side effects',
      'is creatine safe for kidneys',
      'creatine did nothing for me',
      'is creatine a scam',
    ],
    exUk: ['креатин не діє', 'креатин безпечний?', 'креатин шкодить нирках?', 'креатин це розвод?'],
  },
  alcohol: {
    ex: [
      'does beer ruin gains',
      'can i drink and still build muscle',
      'how bad is alcohol for muscle growth',
    ],
    exUk: [
      'алкоголь заважає росту мʼязів',
      'пиво шкодить прогресу в залі',
      'чи можна пити і качатись',
    ],
  },
  strength_ratio: {
    ex: [
      'how strong is my deadlift relative to bodyweight',
      'is my squat strong for my size',
      'bench to bodyweight ratio',
    ],
    exUk: [
      'скільки мій жим від власної ваги',
      'чи сильна моя станова для моєї ваги',
      'присід відносно ваги тіла',
    ],
  },
  bw_trend: {
    ex: ['is my weight going down', 'am i getting heavier', 'which way is my weight moving'],
    exUk: ['моя вага падає чи росте', 'я поправляюсь?', 'куди йде моя вага'],
  },
  today: {
    ex: [
      "what's today's session",
      'what are we hitting today',
      'what muscles today',
      "what's the plan for today at the gym",
    ],
    exUk: [
      'що по плану сьогодні',
      'що в нас сьогодні в залі',
      'які мʼязи сьогодні',
      'що качаємо сьогодні',
    ],
  },
  sleep: {
    ex: ['barely slept last night', 'slept only 5 hours', 'terrible sleep last night'],
    exUk: ['мало спав', 'не виспався', 'спав всього 5 годин', 'погано спала вночі'],
  },
  short_on_time: {
    ex: ["i don't have much time today", 'in a rush today, short session', 'only 20 min free'],
    exUk: ['мало часу сьогодні', 'поспішаю, треба швидке тренування', 'є тільки 20 хвилин'],
  },
  k_core_stability: {
    ex: ['good ab exercises', 'best exercises for abs', 'which core moves are worth doing'],
    exUk: ['найкращі вправи на прес', 'які вправи на кор робити', 'гарні вправи на корпус'],
  },
  strength_vs_size: {
    ex: [
      'is 5x5 better than 3x12 for size',
      'low reps heavy or high reps light',
      'heavy triples or sets of ten',
    ],
    exUk: [
      'що краще 5 по 5 чи 4 по 12',
      'важко і мало повторів чи легше і багато',
      'трійки чи десятки',
    ],
  },
  pain_types: {
    ex: ['how do i tell good pain from bad pain', 'is this pain an injury or just soreness'],
    exUk: ['як відрізнити біль від травми і крепатуру', 'це травма чи просто забиті мʼязи'],
  },
  weaker_today: {
    ex: ['why do i feel weak in the gym today', 'lifts feel heavy today, why'],
    exUk: ['чому сьогодні все таке важке', 'чому я сьогодні слабкий у залі'],
  },
};
