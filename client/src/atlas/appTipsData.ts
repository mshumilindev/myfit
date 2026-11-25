/** The app tips (data only; told by appTips.ts). */

export interface AppTip {
  text: [string, string];
  /** The feature the tip is about (its question becomes a chip). */
  about: string;
  /** The add-on the tip is about. While it is off the tip is told in its `plain` form, or not at all when there is none. */
  addon?: string;
  plain?: [string, string];
}

/** Most useful first; told four at a time. */
export const APP_TIPS: AppTip[] = [
  {
    text: [
      'Tap the “+” in the middle of the bottom bar to start anything: a session, an auto-built day, an activity, sleep or a past workout.',
      'Натисни «+» посередині нижньої панелі, щоб почати будь-що: тренування, авто-день, активність, сон чи минуле тренування.',
    ],
    about: 'app_start_session',
  },
  {
    text: [
      'In a session, set the weight and reps on the card and tap “Log” — the rest timer starts on its own.',
      'У тренуванні вистав вагу й повтори на картці та натисни «Запис» — таймер відпочинку стартує сам.',
    ],
    about: 'app_log_set',
  },
  {
    text: [
      '“Auto session” builds a whole day from your goal and what’s recovered — review it and tap “Start now”.',
      '«Авто-тренування» збирає цілий день під твою ціль і відновлення — перевір і натисни «Почати».',
    ],
    about: 'app_auto_session',
    addon: 'readiness',
    plain: [
      '“Auto session” builds a whole day from your goal — review it and tap “Start now”.',
      '«Авто-тренування» збирає цілий день під твою ціль — перевір і натисни «Почати».',
    ],
  },
  {
    text: [
      'Ask me things like “what weight next time on bench?” or “am I recovered?” — I answer from your own log.',
      'Питай мене, наприклад, «яку вагу на жим наступного разу?» чи «я відновився?» — я відповідаю з твого журналу.',
    ],
    about: 'what_can_i_ask',
    addon: 'readiness',
    plain: [
      'Ask me things like “what weight next time on bench?” — I answer from your own log.',
      'Питай мене, наприклад, «яку вагу на жим наступного разу?» — я відповідаю з твого журналу.',
    ],
  },
  {
    text: [
      'Tap the rest ring to change the rest target and the alerts; it’s remembered for each exercise.',
      'Тапни коло відпочинку, щоб змінити ціль відпочинку й сигнали; воно запам’ятовується для кожної вправи.',
    ],
    about: 'app_rest_timer',
  },
  {
    text: [
      'Tap a set to mark it as a warm-up or a dropset, or flag it “To failure” — warm-ups don’t count as working sets.',
      'Тапни підхід, щоб позначити його як розминку чи дроп-сет або «До відмови», — розминка не рахується як робочий підхід.',
    ],
    about: 'app_warmup_set',
    addon: 'set-types',
    plain: [
      'Tap a set to mark it as a warm-up or flag it “To failure” — warm-ups don’t count as working sets.',
      'Тапни підхід, щоб позначити його як розминку чи «До відмови», — розминка не рахується як робочий підхід.',
    ],
  },
  {
    text: [
      'Forgot to log a workout? “+” → “Log past” adds it with its date and time.',
      'Забув записати тренування? «+» → «Минуле» додасть його з датою й часом.',
    ],
    about: 'app_backfill',
  },
  {
    text: [
      'Runs, rides, yoga or dance go under “+” → “Activity” — I count them in your weekly load.',
      'Біг, велосипед, йога чи танці — через «+» → «Активність», і я врахую їх у тижневому навантаженні.',
    ],
    about: 'app_activity',
  },
  {
    text: [
      'The Overview tab keeps your progress, trends, records, program, goals, playbook and exercise library in one place.',
      'Вкладка «Огляд» тримає прогрес, тренди, рекорди, програму, цілі, плейбук і бібліотеку вправ в одному місці.',
    ],
    about: 'app_progress_view',
  },
  {
    text: [
      'In progress → “Volume”, open the view options to switch the lens between Volume, Fatigue and Readiness.',
      'У прогресі → «Обʼєм» відкрий вигляд, щоб перемкнути лінзу між «Обʼєм», «Втома» і «Готовність».',
    ],
    about: 'app_lens',
    addon: 'fatigue',
    plain: [
      'In progress → “Volume”, open the view options to change how the volume is shown.',
      'У прогресі → «Обʼєм» відкрий вигляд, щоб змінити, як показано обʼєм.',
    ],
  },
  {
    text: [
      'In Overview → Goals choose which muscles to grow, hold or ease — auto-built days give the grow muscles extra work.',
      'В «Огляд» → «Цілі» обери, які м’язи рости, тримати чи зменшити, — авто-дні дають м’язам на ріст більше роботи.',
    ],
    about: 'app_goals',
  },
  {
    text: [
      'Build your own week in Overview → Programs → “New program” and “Activate” it — the “+” button will then offer today’s day.',
      'Склади свій тиждень в «Огляд» → «Програми» → «Нова програма» і «Активуй» його — тоді кнопка «+» пропонуватиме сьогоднішній день.',
    ],
    about: 'app_programs',
  },
  {
    text: [
      'Log sleep with “+” → “Health” → “Start sleep”, or set a sleep schedule with auto-log in “Sleep details”.',
      'Записуй сон через «+» → «Здоров’я» → «Почати сон» або задай графік сну з авто-логом у «Деталі сну».',
    ],
    about: 'app_sleep_tracking',
  },
  {
    text: [
      'Going on vacation or feeling ill? “+” → “Health” → start a rest period so your streak and plan pause properly.',
      'Їдеш у відпустку чи захворів? «+» → «Здоров’я» → почни період відпочинку, щоб серія й план правильно стали на паузу.',
    ],
    about: 'app_rest_period',
  },
  {
    text: [
      'Hurt something? “+” → “Health” → “Injury & rehab” sets up a staged comeback plan.',
      'Щось травмував? «+» → «Здоров’я» → «Травма і реабілітація» налаштує поетапний план повернення.',
    ],
    about: 'app_injury_log',
  },
  {
    text: [
      'No gym today? “+” → “Home set” logs pull-ups, push-ups or a vacuum at home.',
      'Сьогодні без залу? «+» → «Домашній сет» запише підтягування, віджимання чи вакуум удома.',
    ],
    about: 'app_home_set',
  },
  {
    text: [
      'Group two exercises with “Superset with…” in the exercise menu.',
      'Обʼєднай дві вправи через «Суперсет із…» в меню вправи.',
    ],
    about: 'app_superset',
    addon: 'supersets',
  },
  {
    text: [
      'The Playbook learns your usual days from your log, so a typical session restarts in one tap.',
      'Плейбук вивчає твої звичні дні з журналу, тож типове тренування запускається одним дотиком.',
    ],
    about: 'app_playbook',
  },
  {
    text: [
      'Add your gym in the Gyms tab and tick its equipment, so I know what kit you have there.',
      'Додай свій зал у вкладці «Зали» і познач його обладнання, щоб я знав, що там є.',
    ],
    about: 'app_gyms',
    addon: 'equipment',
    plain: ['Add your gym in the Gyms tab.', 'Додай свій зал у вкладці «Зали».'],
  },
  {
    text: [
      'Your week can start on any day: Apps → Me → Settings → “Week starts on”.',
      'Тиждень може починатися з будь-якого дня: «Застосунки» → «Я» → «Налаштування» → «Тиждень починається з».',
    ],
    about: 'app_week_start',
  },
  {
    text: [
      'Switch between kg and lb in Apps → Me → Settings → “Units”.',
      'Кілограми чи фунти — у «Застосунки» → «Я» → «Налаштування» → «Одиниці».',
    ],
    about: 'app_units',
  },
  {
    text: [
      'The bell at the top collects your records, streaks and recaps; turn on push when I ask, so rest alerts reach you in the background.',
      'Дзвіночок угорі збирає рекорди, серії й підсумки; увімкни пуші, коли я запитаю, щоб сигнали відпочинку приходили й у фоні.',
    ],
    about: 'app_notifications',
  },
  {
    text: [
      'After a session, “Share workout” turns it into a Story or Square image.',
      'Після тренування «Поділитися» зробить із нього картинку для сторіс чи квадрат.',
    ],
    about: 'app_share',
  },
  {
    text: [
      '“More” → “Apps” at the bottom switches between Gym, Apex, Nutrition, Learn and your profile.',
      '«Ще» → «Застосунки» внизу перемикає між «Зал», Apex, «Харчування», «Навчання» і твоїм профілем.',
    ],
    about: 'app_switch_apps',
  },
  {
    text: [
      'Open Apps → Apex for challenges, strength ranks and awards.',
      'Відкрий «Застосунки» → Apex — там челенджі, силові розряди й нагороди.',
    ],
    about: 'app_apex',
  },
  {
    text: [
      'Apps → Learn lists how-to lessons for every part of Spotter (the videos are on their way).',
      '«Застосунки» → «Навчання» — уроки про кожну частину Spotter (відео вже в дорозі).',
    ],
    about: 'app_learn',
  },
  {
    text: [
      'Add Spotter to your home screen — it opens full-screen, works offline and can send notifications.',
      'Додай Spotter на головний екран — він відкриватиметься на весь екран, працюватиме офлайн і зможе надсилати сповіщення.',
    ],
    about: 'app_install',
  },
  {
    text: [
      'Trainers: add a client with “Add client” (they get an invite link) and assign a program from the program’s tile.',
      'Тренерам: додайте клієнта через «Додати клієнта» (він отримає лінк-запрошення) і призначте програму з плитки програми.',
    ],
    about: 'app_assign_program',
  },
];
