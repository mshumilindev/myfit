/**
 * More help with the app itself — written from the app's own screens (labels
 * as in i18n en.ts / uk.ts), so Atlas never invents a button:
 *
 *  - how-to topics for the features the first app round didn't cover (starting
 *    a session, auto session, finishing, rest periods, week start, assigning a
 *    program, Apex, Nutrition, Learn, the People side, the Progress lens…),
 *    each with chips to related features;
 *  - "tips": a batch of 4 tips at a time; "more tips" continues where the
 *    last batch stopped — the conversation remembers how many were told
 *    (Convo.appTips), so nothing repeats until every tip has been shown.
 *
 * Phrasings live in kb/appTipsEx.ts (the understanding index only).
 */
import type { Intent, Tr } from './intentKit';
import { ASKS } from './asks';
import { keyGroups } from './intentsExtra';

export interface AppTopic {
  id: string;
  ask: [string, string];
  answer: [string, string];
  /** Related features offered as chips (their canonical questions). */
  chips: string[];
}

export const APP_TOPICS_MORE: AppTopic[] = [
  {
    id: 'app_tips',
    ask: ['Any tips for using the app?', 'Є поради, як користуватися додатком?'],
    // The batch is picked per conversation (withAppTips); this is the first one.
    answer: ['', ''],
    chips: [],
  },
  {
    id: 'app_tour',
    ask: ['How do I use this app?', 'Як користуватися цим додатком?'],
    answer: [
      'Spotter in a nutshell: the bottom bar has Today (your plan, your history and me), Overview (progress, records, programs, goals, playbook, exercises), the “+” in the middle (start a session, an auto session, an activity, sleep and health, or log a past workout), Gyms (your gyms and their equipment) and Apps (Apex, Nutrition, Learn and your profile). Log your sets as you train and I track every lift from them — ask me anything, or ask me for tips.',
      'Spotter коротко: у нижній панелі — «Сьогодні» (план, історія і я), «Огляд» (прогрес, рекорди, програми, цілі, плейбук, вправи), «+» посередині (почати тренування, авто-тренування, активність, сон і здоров’я або записати минуле), «Зали» (твої зали та їхнє обладнання) і «Застосунки» (Apex, «Харчування», «Навчання» і твій профіль). Записуй підходи під час тренування — і я відстежуватиму кожну вправу; питай мене що завгодно або попроси поради.',
    ],
    chips: ['app_tips', 'app_start_session', 'app_log_set'],
  },
  {
    id: 'app_start_session',
    ask: ['How do I start a session?', 'Як почати тренування?'],
    answer: [
      'Tap the “+” in the middle of the bottom bar. The big button on top starts the best fit: “Today in program” if you have an active program, your usual day from the Playbook, or a session “From scratch” (“Or start from scratch” is always there too). Pick your gym if asked, then add exercises and log your sets. The tiles below start an “Auto session”, an “Activity”, “Health” (sleep, rest, injury), “Log past” or a “Home set”.',
      'Натисни «+» посередині нижньої панелі. Велика кнопка вгорі запускає найкраще: «Сьогодні за програмою», якщо є активна програма, твій звичний день із плейбука або тренування «З нуля» (є й «Або почати з нуля»). Якщо спитає — обери зал, далі додавай вправи й записуй підходи. Плитки нижче запускають «Авто-тренування», «Активність», «Здоров’я» (сон, відпочинок, травма), «Минуле» або «Домашній сет».',
    ],
    chips: ['app_log_set', 'app_auto_session', 'app_finish_session'],
  },
  {
    id: 'app_auto_session',
    ask: ['How does the auto session work?', 'Як працює авто-тренування?'],
    answer: [
      'Tap “+” → “Auto session” and I build a full day from your goal and what’s recovered. Go through the steps — goal, what today is for (strength, muscle, endurance and so on), muscles, and the day itself (length, warm-up, cardio, cool-down) — then review it and tap “Start now”, or “Save as a day” to keep it for later.',
      'Натисни «+» → «Авто-тренування» — і я зберу цілий день під твою ціль і відновлення. Пройди кроки — ціль, для чого сьогоднішній день (сила, м’язи, витривалість тощо), м’язи і сам день (тривалість, розминка, кардіо, заминка) — перевір і натисни «Почати» або «Зберегти як день», щоб лишити на потім.',
    ],
    chips: ['app_start_session', 'app_goals', 'today'],
  },
  {
    id: 'app_finish_session',
    ask: ['How do I finish a workout?', 'Як завершити тренування?'],
    answer: [
      'When you’re done, tap “Finish” (the ✓ button) — you’ll get a summary with your volume and any new records, and “Share workout” if you want an image of it. Changed your mind? “Discard session” (the bin icon next to it) throws the session away. A session left open closes by itself after 8 hours and gets a ⚠️ mark.',
      'Коли закінчиш, натисни «Завершити» (кнопка ✓) — побачиш підсумок з обсягом і новими рекордами, а «Поділитися» зробить картинку. Передумав? «Скасувати тренування» (іконка кошика поруч) прибере сесію. Незакрите тренування саме закривається через 8 годин і отримує позначку ⚠️.',
    ],
    chips: ['app_share', 'app_edit_workout', 'app_history'],
  },
  {
    id: 'app_home_set',
    ask: ['How do I log a workout at home?', 'Як записати тренування вдома?'],
    answer: [
      'No gym? Tap “+” → “Home set” to log pull-ups, push-ups, a vacuum hold and similar moves at home — it counts like any other session. You can also add a past home set from “Log past”.',
      'Без залу? Натисни «+» → «Домашній сет», щоб записати підтягування, віджимання, вакуум і схожі вправи вдома, — це рахується як звичайне тренування. Минулий домашній сет можна додати через «Минуле».',
    ],
    chips: ['home', 'app_start_session', 'app_backfill'],
  },
  {
    id: 'app_rest_period',
    ask: [
      'How do I pause training for a vacation or illness?',
      'Як поставити тренування на паузу через відпустку чи хворобу?',
    ],
    answer: [
      'Tap “+” → “Health”. Under “Start a rest period” pick “Active recovery” (light training, reduced targets), “Full rest — no gym” (for example a vacation, with dates) or “Unwell” (sick days — nothing counts as missed and your plan waits), then start it. Your streak and plan respect it, and you can end it early from its card on Today.',
      'Натисни «+» → «Здоров’я». У «Почати період відпочинку» обери «Активне відновлення» (легкі тренування, знижені цілі), «Повний відпочинок — без залу» (наприклад, відпустка, з датами) або «Хворію» (нічого не рахується пропущеним, план чекає) і запусти. Серія й план це враховують, а завершити раніше можна з картки на «Сьогодні».',
    ],
    chips: ['app_injury_log', 'app_streak_rules', 'app_sleep_tracking'],
  },
  {
    id: 'app_week_start',
    ask: ['How do I change which day my week starts on?', 'Як змінити день початку тижня?'],
    answer: [
      'Open Apps (bottom bar) → Me → the “Settings” tab → “Week starts on”, and pick the day. Weekly stats and the program week follow it. Trainers and admins: Apps → Clients or Users → the “Me” tab.',
      'Відкрий «Застосунки» (нижня панель) → «Я» → вкладка «Налаштування» → «Тиждень починається з» і обери день. Тижнева статистика й тиждень програми підлаштуються. Тренерам і адмінам: «Застосунки» → «Клієнти» чи «Користувачі» → вкладка «Я».',
    ],
    chips: ['app_units', 'app_programs', 'app_people'],
  },
  {
    id: 'app_assign_program',
    ask: ['How do I assign a program to a client?', 'Як призначити програму клієнту?'],
    answer: [
      'Trainers: open Overview → Programs and tap “Assign” on the program’s tile (or open the program → “Program options” → “Assign to members”). Pick the clients, choose the “Start week” and confirm. Assigning replaces the client’s active program; their logged history stays. You can also start from a client in your Clients list → “Assign a program”.',
      'Тренерам: відкрий «Огляд» → «Програми» і натисни «Призначити» на плитці програми (або відкрий програму → «Дії з програмою» → «Призначити учасникам»). Обери клієнтів, вкажи «Тиждень старту» і підтверди. Призначення замінює активну програму клієнта, записана історія лишається. Можна почати й з клієнта в списку «Клієнти» → «Призначити програму».',
    ],
    chips: ['app_programs', 'app_trainer', 'app_people'],
  },
  {
    id: 'app_apex',
    ask: ['What is Apex?', 'Що таке Apex?'],
    answer: [
      'Apex is the game side of Spotter: open Apps → Apex. “Home” gives the overview, in “Challenges” you pick one and tap “Start challenge” (you can “Give up” later), “Ranks” rates your lifts against strength standards and “Awards” lists the achievements you’ve unlocked. The bell there opens your milestones feed.',
      'Apex — ігрова частина Spotter: «Застосунки» → Apex. «Головна» дає огляд, у «Челенджі» обери виклик і натисни «Почати челендж» (пізніше можна «Здатися»), «Розряди» оцінюють твої вправи за силовими нормативами, а «Нагороди» показують відкриті досягнення. Дзвіночок там відкриває стрічку віх.',
    ],
    chips: ['app_switch_apps', 'app_streak_rules', 'app_notifications'],
  },
  {
    id: 'app_nutrition',
    ask: ['How does the Nutrition app work?', 'Як працює «Харчування»?'],
    answer: [
      'Open Apps → Nutrition. If the tile says “Coming soon”, it isn’t switched on for your account yet. Inside, “Today” shows the calories and macros you have left, “History” your past days and “Goal” your targets; tap “Add entry” to log a drink, a snack or a meal — search products and dishes, enter it manually or scan a barcode.',
      'Відкрий «Застосунки» → «Харчування». Якщо на плитці «Незабаром», для твого акаунта його ще не ввімкнули. Усередині «Сьогодні» показує, скільки лишилось калорій і БЖВ, «Історія» — минулі дні, «Ціль» — твої норми; «Додати запис» — щоб записати напій, перекус чи страву: пошук продуктів і страв, уручну або скан штрихкоду.',
    ],
    chips: ['calories', 'protein', 'app_switch_apps'],
  },
  {
    id: 'app_learn',
    ask: ['What is the Learn app?', 'Що таке «Навчання»?'],
    answer: [
      'Open Apps → Learn. It has short how-to lessons for every part of Spotter, grouped by topic — basics, logging, cardio and recovery, programs, progress, gyms, Apex and more. Use “Topics” and search to find one, and “Saved” to keep it for later; the videos are still being recorded, so some lessons show “Video coming soon”.',
      'Відкрий «Застосунки» → «Навчання». Там короткі уроки про кожну частину Spotter, згруповані за темами: основи, записи, кардіо й відновлення, програми, прогрес, зали, Apex та інше. «Теми» й пошук допоможуть знайти потрібний, а «Збережені» — повернутися пізніше; відео ще записуються, тож у деяких уроках «Відео незабаром».',
    ],
    chips: ['app_tour', 'app_tips', 'app_switch_apps'],
  },
  {
    id: 'app_people',
    ask: ['Where are my profile and settings?', 'Де мій профіль і налаштування?'],
    answer: [
      'Your account side is under Apps → Me (trainers see Clients, admins Users, each with a “Me” tab). Your profile has “Overview”, “Body” (weight and measurements) and “Settings” (language, units, week start, Atlas, password, sign out). Trainers add clients with “Add client” — the client opens the invite link to join — and see their training read-only.',
      'Акаунт — у «Застосунки» → «Я» (у тренерів «Клієнти», в адмінів «Користувачі», у кожного є вкладка «Я»). У профілі є «Огляд», «Тіло» (вага й заміри) і «Налаштування» (мова, одиниці, початок тижня, Atlas, пароль, вихід). Тренери додають клієнтів через «Додати клієнта» — клієнт відкриває лінк-запрошення — і бачать їхні тренування лише для читання.',
    ],
    chips: ['app_week_start', 'app_bodyweight_log', 'app_trainer'],
  },
  {
    id: 'app_switch_apps',
    ask: ['How do I switch between the apps?', 'Як перемикатися між застосунками?'],
    answer: [
      'Tap “Apps” at the right end of the bottom bar (or “Gym” next to the Spotter logo at the top) to open “Switch app”: Gym (your training), Apex (challenges, ranks, awards), Nutrition, Learn and your profile. It’s one account and one training history across all of them.',
      'Натисни «Застосунки» праворуч у нижній панелі (або «Зал» біля логотипа Spotter угорі) — відкриється «Змінити додаток»: «Зал» (тренування), Apex (челенджі, розряди, нагороди), «Харчування», «Навчання» і твій профіль. Один акаунт і одна історія тренувань для всіх.',
    ],
    chips: ['app_apex', 'app_nutrition', 'app_learn'],
  },
  {
    id: 'app_progress_view',
    ask: ['Where do I see my progress and records?', 'Де подивитися прогрес і рекорди?'],
    answer: [
      'Everything about progress lives in the Overview tab: tiles for progress, Trends, records, your program, Goals, Playbook and Exercises. In progress, switch between “Total”, “By muscle”, “Volume” and “Records” and change the time range; tap an exercise to see its history. Or just ask me — “how is my bench going?”.',
      'Усе про прогрес — у вкладці «Огляд»: плитки прогресу, «Тренди», рекорди, програма, «Цілі», «Плейбук» і «Вправи». У прогресі перемикай «Разом», «За м’язами», «Обʼєм» і «Рекорди» та змінюй період; тапни вправу, щоб побачити її історію. Або просто спитай мене — «як прогресує мій жим?».',
    ],
    chips: ['app_lens', 'progress_lift', 'app_history'],
  },
  {
    id: 'app_lens',
    ask: ['What is the lens in Progress?', 'Що таке «Лінза» в прогресі?'],
    answer: [
      'Open Overview → the progress tile → “Volume”, then tap the view button above the chart to open “Volume view”. Under “Lens” pick “Volume” (sets per muscle vs targets), “Fatigue” (load you’re still carrying) or “Readiness” (what’s recovered to train). In a session, “Today’s readiness” gives the same read for the day.',
      'Відкрий «Огляд» → плитка прогресу → «Обʼєм», потім натисни кнопку вигляду над графіком — відкриється «Вигляд об’єму». У «Лінза» обери «Обʼєм» (підходи на м’яз проти цілей), «Втома» (навантаження, що ще тримається) або «Готовність» (що вже відновилось для тренування). У тренуванні «Готовність на сьогодні» показує те саме для цього дня.',
    ],
    chips: ['app_progress_view', 'recovery', 'volume_muscle'],
  },
];

/** Related features for the app topics of the earlier rounds. */
export const APP_CHIPS: Record<string, string[]> = {
  app_log_set: ['app_rest_timer', 'app_warmup_set', 'app_finish_session'],
  app_rest_timer: ['app_log_set', 'app_notifications', 'rest'],
  app_notifications: ['app_install', 'app_rest_timer', 'reminder'],
  app_injury_log: ['app_rest_period', 'pain', 'return_injury'],
  app_backfill: ['app_edit_workout', 'app_history', 'app_start_session'],
  app_units: ['app_week_start', 'app_language', 'app_people'],
  app_playbook: ['app_start_session', 'app_programs', 'app_auto_session'],
  app_streak_rules: ['app_rest_period', 'streak', 'app_apex'],
  app_sleep_tracking: ['sleep', 'app_rest_period', 'sleep_better'],
  app_programs: ['app_assign_program', 'app_goals', 'app_playbook'],
  app_goals: ['app_auto_session', 'app_programs', 'app_progress_view'],
  app_activity: ['app_home_set', 'app_start_session', 'cardio'],
  app_trainer: ['app_assign_program', 'app_people', 'app_programs'],
  app_bodyweight_log: ['bw_trend', 'app_people', 'k_measurements'],
  app_history: ['app_edit_workout', 'app_progress_view', 'app_backfill'],
  app_gyms: ['app_start_session', 'app_custom_exercise', 'app_tips'],
};

export interface AppTip {
  text: [string, string];
  /** The feature the tip is about (its question becomes a chip). */
  about: string;
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
  },
  {
    text: [
      'Ask me things like “what weight next time on bench?” or “am I recovered?” — I answer from your own log.',
      'Питай мене, наприклад, «яку вагу на жим наступного разу?» чи «я відновився?» — я відповідаю з твого журналу.',
    ],
    about: 'what_can_i_ask',
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
      'The “Apps” button at the bottom switches between Gym, Apex, Nutrition, Learn and your profile.',
      'Кнопка «Застосунки» внизу перемикає між «Зал», Apex, «Харчування», «Навчання» і твоїм профілем.',
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

// Their canonical questions (for chips, "did you mean…" and the topic menu).
// Registered here rather than in asks.ts, which this module imports.
for (const t of APP_TOPICS_MORE) ASKS[t.id] ??= t.ask;

export const TIPS_PER_BATCH = 4;

/** The batch after `told` tips (wraps around once everything was told). */
export function tipBatch(told: number, L: Tr): { text: string; chips: string[]; told: number } {
  const n = APP_TIPS.length;
  const start = told % n;
  const again = told >= n && start === 0;
  const pick = APP_TIPS.slice(start, start + TIPS_PER_BATCH);
  const last = start + pick.length >= n;
  const head =
    start === 0
      ? again
        ? L(
            'That was every tip I have — here they are again from the top:',
            'Це були всі мої поради — ось знову з початку:',
          )
        : L('A few tips for the app:', 'Кілька порад щодо додатка:')
      : L('More tips:', 'Ще поради:');
  const lines = pick.map((t) => `• ${L(t.text[0], t.text[1])}`);
  const tail = last
    ? [
        L(
          'That’s all of them — ask me about any feature for the details.',
          'Це всі — питай мене про будь-яку функцію, щоб дізнатися деталі.',
        ),
      ]
    : [];
  const chips = [
    ...(last ? [] : [L('More tips', 'Ще поради')]),
    ...pick
      .map((t) => ASKS[t.about])
      .filter((a): a is [string, string] => !!a)
      .map((a) => L(a[0], a[1])),
  ].slice(0, 3);
  return { text: [head, ...lines, ...tail].join('\n'), chips, told: told + pick.length };
}

/** "Tips" + something that says "for the app" or "more" ("more tips", "app tips"). */
const TIPS_KEYS = [
  [
    'tips',
    'tip',
    'поради',
    'порад',
    'порадь',
    'лайфхак*',
    'porad*',
    'wskazów*',
    'patarim*',
    'nõuand*',
    'nipid',
  ],
  [
    'app',
    'application',
    'spotter',
    'more',
    'another',
    'додат*',
    'застосун*',
    'апк*',
    'ще',
    'більше',
    'еще',
    'aplikac*',
    'więcej',
    'programėl*',
    'daugiau',
    'äpp*',
    'rakendus*',
    'rohkem',
  ],
];

/** Keywords for app topics whose words other topics also use ("settings" looks like "sets"). */
const APP_KEYS: Record<string, string[][]> = {
  app_tips: TIPS_KEYS,
  app_people: [
    [
      'settings',
      'the settings',
      'my settings',
      'find settings',
      'open settings',
      'app settings',
      'налаштування',
      'налаштувань',
      'де налаштування',
      'знайти налаштування',
      'настройки',
      'ustawienia',
      'ustawień',
      'nustatymai',
      'nustatymus',
      'seaded',
      'seadeid',
      'äpi seaded',
    ],
  ],
};

export const INTENTS_APP_MORE: Intent[] = APP_TOPICS_MORE.map((t) => ({
  id: t.id,
  all: keyGroups(APP_KEYS[t.id] ?? [['__never__']]),
  answer: (_c, _p, L) => (t.id === 'app_tips' ? tipBatch(0, L).text : L(t.answer[0], t.answer[1])),
  // "More" after tips = the next batch (picked in withAppTips).
  more: t.id === 'app_tips' ? (_c, _p, L) => tipBatch(0, L).text : undefined,
  suggest: (L) =>
    t.chips.flatMap((id) => {
      const a = ASKS[id];
      return a ? [L(a[0], a[1])] : [];
    }),
}));

/** Suggestions for the earlier app topics (additive: only where none are set). */
export function appChipsFor(id: string): ((L: Tr) => string[]) | undefined {
  const ids = APP_CHIPS[id];
  if (!ids) return undefined;
  return (L) =>
    ids.flatMap((x) => {
      const a = ASKS[x];
      return a ? [L(a[0], a[1])] : [];
    });
}

interface WithConvo {
  intent: string;
  text: string;
  chips?: string[];
  said?: unknown;
  convo: { appTips?: number };
}

/**
 * Tips go on where the conversation left off; everything else just carries
 * the count along so a later "tips" doesn't start over.
 */
export function withAppTips<A extends WithConvo>(a: A, told: number | undefined, L: Tr): A {
  if (a.intent !== 'app_tips')
    return told === undefined || a.convo.appTips !== undefined
      ? a
      : { ...a, convo: { ...a.convo, appTips: told } };
  const b = tipBatch(told ?? 0, L);
  return {
    ...a,
    text: b.text,
    chips: b.chips,
    said: undefined,
    convo: { ...a.convo, appTips: b.told },
  };
}
