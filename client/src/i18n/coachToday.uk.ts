/** Coach Today + Decision strings (Ukrainian). See `coachToday.en.ts`. */
import type { TodayStrings } from './coachToday.en';
import { plural } from './coachPlural';

const P = (n: number, one: string, few: string, many: string) =>
  plural('uk', n, { one, few, many, other: many });

export const todayUk: TodayStrings = {
  queueTitle: 'Агенда',
  queueLoading: 'Завантаження',
  needDecision: (n) =>
    P(n, '{n} потребує рішення', '{n} потребують рішення', '{n} потребують рішення'),
  requestsToAnswer: (n) =>
    P(
      n,
      '{n} запит чекає відповіді',
      '{n} запити чекають відповіді',
      '{n} запитів чекають відповіді',
    ),
  byPriority: 'За пріоритетом',
  byStage: 'За етапом',
  viewLabel: 'Вигляд',
  allSignals: 'Усі сигнали',
  allDecisions: 'Усі рішення',
  liveCount: (n) => `${n} наживо`,

  sectionRequests: 'Запити на перенесення',
  sectionNeeds: 'Потребує рішення',
  sectionWatch: 'Тримайте в полі зору',
  moreInDigest: (n) => `Ще ${n} у дайджесті`,
  hideDigest: 'Сховати елементи дайджесту',
  digestNote: 'Дайджест — ранкове зведення всього, чого тут не видно.',

  stageSignal: 'Сигнал',
  stageEvidence: 'Докази',
  stageDecided: 'Вирішено',
  stageMeasuring: 'Вимірюємо',
  stageResult: 'Результат',
  stageBoard: 'Дошка етапів, прокрутіть, щоб побачити більше',
  stageFold: (l: string, folded: boolean) => (folded ? `Показати: ${l}` : `Згорнути: ${l}`),
  stageEmpty: 'Тут порожньо',
  stageOpen: (name, stage) => `${name}, ${stage}`,
  boardSummary: (improved, total, pct, measuring, kg, days) =>
    `${improved} із ${total} рішень покращили результат (${pct}%), ${measuring} ще вимірюємо. «Покращено» означає, що вправа піднялась щонайменше на ${kg} кг розрахункового 1ПМ або клієнт повернувся до плану протягом ${days} днів.`,
  close: 'Закрити',
  drawerTitle: 'Рішення',

  urgent: 'Терміново',
  watch: 'Увага',
  good: 'Добре',
  decided: 'Вирішено',
  waiting: 'Очікуємо',
  measuring: 'Вимірюємо',
  improved: 'Покращено',
  noChange: 'Без чіткої зміни',
  declined: 'Погіршено',
  confidence: (l): string =>
    l === 'high'
      ? 'Упевненість висока'
      : l === 'medium'
        ? 'Упевненість середня'
        : 'Упевненість низька',
  tagNew: 'Нове',

  askMove: (name) => `${name} просить перенести заняття`,
  waitingFor: (name) => `Чекаємо на відповідь: ${name}`,
  askedMove: (manager, name) => `${manager} надсилає запит ${name}: перенести тренування`,
  needsAnswer: 'Потрібна ваша відповідь',
  moveFrom: 'Із',
  moveTo: 'На',
  accept: 'Прийняти',
  decline: 'Відхилити',
  proposeAnother: 'Запропонувати інший час',
  cancelRequest: 'Скасувати запит',
  acceptFor: (name) => `Прийняти перенесення для ${name}`,
  declineFor: (name) => `Відхилити перенесення для ${name}`,
  proposeFor: (name) => `Запропонувати інший час: ${name}`,
  cancelFor: (name) => `Скасувати запит до ${name}`,
  requestAccepted: (name) => `Прийнято. ${name} отримує новий час у чаті.`,
  requestDeclined: (name) => `Відхилено. ${name} отримує повідомлення в чаті.`,
  requestCancelled: (name) => `Запит до ${name} скасовано.`,
  requestFailed: 'Не вдалося надіслати відповідь. Запит лишається в списку, спробуйте ще раз.',

  messageTo: (name) => `Написати: ${name}`,
  seeEvidence: 'Докази й варіанти',
  otherOptions: (n) => P(n, '{n} інший варіант', '{n} інші варіанти', '{n} інших варіантів'),
  moreOptions: 'Варіанти',
  programWeek: (program, week) => `${program} · тиждень ${week}`,
  heroLabel: (what) => `${what}, розр. 1ПМ`,
  heroSets: (what) => `${what}, підходів на тиждень`,
  heroDays: 'Днів від останнього заняття',
  heroNoChange: (weeks) =>
    P(weeks, 'без змін {n} тиждень', 'без змін {n} тижні', 'без змін {n} тижнів'),
  heroSetsVs: (chronic) => `зазвичай ${chronic}`,
  effectLine: (text, days) => (days == null ? text : `${text} Перевіримо знову через ${days} дн.`),

  allClearTitle: 'Рішень, що чекають, немає',
  allClearBody: (requests, measuring, days) => {
    const parts: string[] = [];
    if (requests > 0)
      parts.push(
        P(
          requests,
          'Один запит чекає вашої відповіді вище.',
          `${requests} запити чекають вашої відповіді вище.`,
          `${requests} запитів чекають вашої відповіді вище.`,
        ),
      );
    if (measuring > 0)
      parts.push(
        P(
          measuring,
          `${measuring} рішення ще вимірюється, результат буде протягом ${days} днів.`,
          `${measuring} рішення ще вимірюються, результат буде протягом ${days} днів.`,
          `${measuring} рішень ще вимірюються, результат буде протягом ${days} днів.`,
        ),
      );
    return parts.length ? parts.join(' ') : 'Сьогодні нічого не потребує вас. Решта в дайджесті.';
  },
  seeBoard: 'Відкрити дошку',
  nothingTitle: 'Сьогодні нічого не потребує вас',
  nothingBody: 'Решта в дайджесті.',
  updatedAt: (t) => `Оновлено ${t}`,
  staleRefreshing: (t) => `Оновлено ${t}, оновлюємо`,
  offlineNote: 'Немає мережі. Зміни синхронізуються, коли вона з’явиться.',
  offlineUpdated: (t) =>
    `Немає мережі. Показано дані за ${t}. Зміни синхронізуються, коли вона з’явиться.`,
  unsynced: (n) =>
    P(
      n,
      '{n} зміна чекає синхронізації',
      '{n} зміни чекають синхронізації',
      '{n} змін чекають синхронізації',
    ),
  retry: 'Повторити',
  errorTitle: 'Не вдалося завантажити «Агенду»',
  errorBody:
    'Перевірте з’єднання й спробуйте ще раз. Нічого не втрачено: ваші зміни збережено на цьому пристрої.',
  tryAgain: 'Спробувати ще раз',
  forbiddenTitle: 'Немає доступу до даних тренера',
  forbiddenBody:
    'Ваш обліковий запис ще не може читати дані клієнтів. Зверніться до адміністратора.',
  vaultLockedTitle: 'Ваші дані заблоковано',
  vaultLockedBody: 'Розблокуйте сховище й спробуйте ще раз.',
  notFoundTitle: 'Цього сигналу вже немає',
  notFoundBody: 'Його вирішено, відкладено або відхилено. В «Агенді» є те, що відкрито зараз.',
  backToAgenda: 'Назад до «Агенди»',
  weekBriefsTitle: 'У вас мало клієнтів, тому черги немає',
  weekBriefsBody: 'Якщо клієнтів менше 8, екран «Тиждень» показує кожного одним рядком.',

  backLabel: 'Агенда',
  decChoose: 'Оберіть, що робити',
  decNext: 'Що буде далі',
  decSuggested: 'Рекомендовано',
  decChosen: 'Обрано',
  decRecord: 'Записати рішення',
  decWait: 'Зачекати тиждень',
  decDismiss: 'Відхилити сигнал',
  decWhy: 'Чому відхиляєте?',
  decPickOne: 'Оберіть одне.',
  decReasonNotUseful: 'Нічого корисного',
  decReasonHandled: 'Уже вирішено',
  decReasonWrong: 'Хибні дані',
  decDismissConfirm: 'Відхилити з причиною',
  decPickReason: 'Оберіть причину, щоб відхилити.',
  decOptionsLabel: 'Варіанти',
  nextProgram: 'Програма',
  nextResult: 'Перевірка результату',
  nextSees: (name) => `${name} бачить`,
  nextSeesBody: 'Нову версію програми в застосунку.',
  nextNothingChanges: 'У програмі нічого не змінюється.',
  nextMessage: (name) => `Повідомлення для ${name}`,
  nextMessageSent: (name) => `Повідомлення надіслано: ${name}`,
  nextMessageNote: 'Надсилається разом із рішенням. Можна відредагувати.',
  nextMessageEdit: 'Редагувати повідомлення',
  nextMessageDone: 'Готово',
  nextNoChat: (name) =>
    `${name} користується лише програмою: чату немає, повідомлення не надсилається.`,
  messageField: (name) => `Повідомлення для ${name}`,
  resultStep: (days, kg) =>
    `Через ${days} дн. Покращенням вважається, лише якщо розрахунковий 1ПМ зміниться на ${kg} кг або більше.`,
  resultStepRhythm: (days) =>
    `Через ${days} дн. Покращенням вважається, якщо занять на тиждень стане щонайменше на 1 більше.`,
  resultStepSpike: (days) =>
    `Через ${days} дн. Покращенням вважається, якщо тижневі підходи повернуться до звичного діапазону.`,
  waitStep: (date) => `Повернемо це ${date}, якщо докази не посиляться раніше.`,
  recordedTitle: (option, name) =>
    name ? `Записано: ${option}. ${name} отримує повідомлення.` : `Записано: ${option}.`,
  recordedSub: (days, date) =>
    days == null || date == null
      ? 'Вимірювати нічого.'
      : `Перевіримо результат через ${days} дн. (${date}).`,
  recordedAria: 'Рішення записано',
  undoText: 'Рішення записано',
  undoLabel: 'Скасувати',
  undoAria: 'Скасувати запис цього рішення',
  snoozedTitle: 'Чекаємо тиждень',
  snoozedBody: (date) => `Повернемо це ${date}.`,
  dismissedTitle: 'Сигнал відхилено',
  dismissedBody: 'Він прихований на 30 днів, якщо докази не посиляться.',
  dismissedWrongData: 'Позначено як хибні дані. Перевірте дані клієнта в профілі.',
  acknowledge: 'Зрозуміло',
  recording: 'Записуємо',
  openProfile: (name) => `Профіль: ${name}`,
  noOptionsTitle: 'У програмі нічого змінювати',
  noOptionsBody: 'Це для інформації. Можна зачекати тиждень або відхилити.',

  evTitle: 'Докази',
  evDate: 'Дата',
  evSets: 'Підходи (кг × повт.)',
  evWeek: 'Тиждень',
  evValue: 'Розр. 1ПМ',
  evValueSets: 'Підходи',
  evValueSessions: 'Заняття',
  evTable: 'Таблиця доказів',
  evChartAria: (what, from, to, unit) => `${what}: від ${from} до ${to} ${unit}`,
  evChartUnit: 'Розрахунковий 1ПМ, кг',
  evChartUnitSets: 'Підходів на тиждень',
  evChartUnitSessions: 'Занять на тиждень',
  evWeeksAgo: (n) => P(n, '{n} тиждень тому', '{n} тижні тому', '{n} тижнів тому'),
  evThisWeek: 'Цей тиждень',
  evNoData: 'Занять поки замало (потрібно 3)',
  evNeedsFull: 'Докази по підходах потребують рівня «Повний»',
  evLocked: (name, what) => `${name} не ділиться: ${what}.`,
  evAsk: 'Попросити поділитися',
  evAskFor: (what) => `Попросити поділитися: ${what}`,
  evSimilar: (n, total) => `У ${n} із ${total} ваших схожих рішень це допомогло.`,
  evShares: (name, list) => `${name} ділиться: ${list}. Читання фіксується, і ${name} його бачить.`,
  evSharesNothing: (name) =>
    `${name} поки нічим не ділиться. Читання фіксується, і ${name} його бачить.`,
  evMachine: (from, to) => `Розр. 1ПМ від ${from} до ${to} кг після зміни`,
  evFactChange: (a, b) => `${a} → ${b}`,
  cat: {
    totals: 'підсумки занять',
    sets: 'підходи та ваги',
    body: 'вагу тіла',
    sleep: 'сон',
    injury: 'травми',
    nutrition: 'харчування',
    checkins: 'відповіді на опитування',
  },

  sigStallTitle: (ex, weeks) =>
    `${ex}: без зростання ${P(weeks, '{n} тиждень', '{n} тижні', '{n} тижнів')}`,
  sigStallBody: (e1rm, weeks) =>
    `Розрахунковий 1ПМ тримається на ${e1rm} кг ${P(weeks, '{n} тиждень', '{n} тижні', '{n} тижнів')} за стабільного обсягу. Та сама вправа, те саме обладнання.`,
  sigStallLine: (ex, e1rm, weeks) =>
    `${ex}, розр. 1ПМ ${e1rm} кг · без змін ${P(weeks, '{n} тиждень', '{n} тижні', '{n} тижнів')}`,
  sigMachineTitle: 'Схоже на застій, але це інший тренажер',
  sigMachineBody: (ex, from, to) =>
    `${ex}: розр. 1ПМ змінився з ${from} на ${to} кг після зміни тренажера. Значення непорівнянні, тож це не застій.`,
  sigMachineLine: (ex, to) => `${ex} · розр. 1ПМ ${to} кг на новому тренажері`,
  sigRhythmIdleTitle: (days) => `Немає занять ${P(days, '{n} день', '{n} дні', '{n} днів')}`,
  sigRhythmLowTitle: 'Менше половини запланованих занять',
  sigRhythmBody: (low, idle) =>
    idle != null && idle > 7
      ? `Останнє заняття було ${P(idle, '{n} день', '{n} дні', '{n} днів')} тому, хоча цього тижня заплановані заняття.`
      : `Менше половини запланованих занять виконано в кожному з останніх ${low} тижнів.`,
  sigRhythmLine: (idle) =>
    idle != null
      ? `Останнє заняття ${P(idle, '{n} день', '{n} дні', '{n} днів')} тому`
      : 'Нижче плану 2 тижні',
  sigSpikeTitle: (muscle, pct) => `${muscle}: обсяг +${pct}% за тиждень`,
  sigSpikeBody: (muscle, sets, chronic) =>
    `${sets} підходів на тиждень для ${muscle} проти ${chronic} зазвичай за останні 4 тижні.`,
  sigSpikeLine: (muscle, sets, pct) => `${muscle}, ${sets} підходів · +${pct}%`,
  sigReadyTitle: (ex) => `Час додати вагу: ${ex}`,
  sigReadyBody: (n, rpe) =>
    `Останні ${n} заняття були з RPE ${rpe} або нижче, усі повторення виконано.`,
  sigReadyLine: (ex, rpe) => `${ex} · RPE ${rpe} або нижче`,
  sigPrTitle: (ex, e1rm) => `Новий рекорд: ${ex} ${e1rm} кг`,
  sigPrBody: (gain, prev) =>
    `Розрахунковий 1ПМ більший на ${gain} кг за попередній найкращий (${prev} кг).`,
  sigPrLine: (ex, gain) => `${ex} · +${gain} кг`,
  sigInjuryTitle: (ex) => `${ex} суперечить обмеженню`,
  sigInjuryBody: (restriction, n) =>
    restriction
      ? `У програмі ${P(n, '{n} вправа', '{n} вправи', '{n} вправ')}, які обмеження забороняє: ${restriction}.`
      : `У програмі ${P(n, '{n} вправа', '{n} вправи', '{n} вправ')}, які виключає травма.`,
  sigInjuryLine: (n) => `Конфлікт · ${P(n, '{n} вправа', '{n} вправи', '{n} вправ')}`,
  sigNoSetsTitle: 'Лише підсумки, без підходів',
  sigNoSetsBody: 'Заняття видно, підходи й ваги — ні. Усе гаразд.',
  sigNoSetsLine: (done) => (done == null ? 'Лише підсумки' : `Занять минулого тижня: ${done}`),
  sigNoDataTitle: 'Занять не записано',
  sigNoDataBody: 'Клієнт веде журнал у застосунку, але за останні 4 тижні немає жодного заняття.',
  sigNoDataLine: 'Нічого за 4 тижні',

  optVariation: 'Додати варіацію + 1 підхід',
  optDeload: 'Розвантажувальний тиждень',
  optStep: 'Додати 2,5 кг',
  optSwap: 'Замінити вправу',
  optLighter: 'Два легші тижні',
  optWait: 'Зачекати тиждень',
  optDismiss: 'Відхилити сигнал',
  opSets: (ex, from, to) => `${ex}: від ${from} до ${to} підходів.`,
  opAdd: (ex, sets, reps) => `Додає ${sets} × ${reps}: ${ex}.`,
  opWeight: (ex, from, to) => `${ex}: від ${from} до ${to} кг.`,
  opWeightUp: (ex, kg) => `${ex}: +${kg} кг.`,
  opDeload: (pct, weeks) =>
    `На ${pct}% менший обсяг ${P(weeks, '{n} тиждень', '{n} тижні', '{n} тижнів')}.`,
  opSwap: (from, to) => `Замінює ${from} на ${to}.`,
  opAltSafe: 'безпечну за обмеженнями альтернативу',
  opMessageDraft: (name, kind) => {
    switch (kind) {
      case 'stall':
        return `Привіт, ${name}! Невелике запитання: як ти спиш і їси цього тижня? Вага в цій вправі не росте вже місяць. Програму трохи змінено.`;
      case 'spike':
        return `Привіт, ${name}! Минулий тиждень був значно навантажливішим за звичайний. Цей тиждень навмисно полегшено, тож не поспішай.`;
      case 'rhythm':
        return `Привіт, ${name}! Останнім часом занять стало менше. Наступні два тижні зроблено легшими. Скажи, що заважає.`;
      case 'injury':
        return `Привіт, ${name}! Вправу замінено, яка не підходить під твоє обмеження. Напиши, якщо щось досі болить.`;
      case 'ready':
        return `Привіт, ${name}! Останні заняття були легкими, тож ваги трохи додано. Розкажи, як відчуття.`;
      default:
        return `Привіт, ${name}! Твою програму оновлено. Розкажи, як відчуття.`;
    }
  },

  resultLine: (result, before, after) =>
    before != null && after != null ? `${result} · розр. 1ПМ від ${before} до ${after} кг` : result,
  measuringDay: (day, total) => `Вимірюємо: день ${day} із ${total}`,
  waitUntil: (date) => `Повернемо ${date}`,
  decisionTitle: (ops) => ops,

  liveTitle: 'Тренуються зараз',
  liveSummary: (live, offline, finished) =>
    `${live} наживо · ${offline} без мережі · ${finished} завершили`,
  liveNow: 'Наживо',
  liveOffline: 'Без мережі',
  liveFinished: 'Завершили',
  liveSinceLine: (time, gym) => `${gym} · з ${time}`,
  liveLost: 'Зв’язок втрачено, перепідключення',
  liveFinishedLine: (sets, tonnes, gym) => `${sets} підходів · ${tonnes} т · ${gym}`,
  liveStatusNow: 'Тренується',
  liveStatusOffline: 'Без мережі, пауза',
  liveStatusDone: 'Завершено',
  liveLastSeen: (s) => `Востаннє ${s} с тому`,
  liveNone: 'Зараз ніхто не тренується.',
  liveClosedAria: (n) => `${n} наживо, відкрити список`,
  livePrivacy:
    'Ви бачите, хто тренується і як довго. Підходи й ваги лишаються в клієнта до кінця заняття.',
  liveMinutes: (m) =>
    m >= 60 ? `${Math.floor(m / 60)} год ${String(m % 60).padStart(2, '0')} хв` : `${m} хв`,
};
