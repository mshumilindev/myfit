# MVP Closure — My Fit

Дата фіксації: 2026-08-13.

## Висновок

MVP можна закривати. Поточний стан продукту вже покриває головний критерій:
користувач може регулярно логувати тренування, бачити прогрес, працювати з
програмами, мати офлайн-доступ до PWA і не втрачати дані під час синку.

Це вже не ранній локальний прототип із `docs/MVP.md`, а робоча
Firestore-native PWA з production hosting, ролями, тренерськими сценаріями,
повною бібліотекою вправ і базовими body metrics. Подальші зміни варто вести
як post-MVP product iterations, а не як “доробити MVP”.

## Що Входить У MVP

### 1. Авторизація і ролі

- Вхід і реєстрація через Firebase Auth bridge.
- Ролі `member`, `trainer`, `admin`.
- Адміни і тренери мають розширені сценарії перегляду/керування.
- Профіль користувача має приватні поля, avatar flow і body metrics gate.

### 2. Today як робочий центр

- Today показує актуальний день, останню активність, статистику і записи.
- Є live workout resume, якщо тренування відкрите.
- Є likely-today підказка на основі історії.
- Є suggest-program banner, коли історії достатньо для побудови програми.
- Є weigh-in reminder на основі звичного часу зважування.

### 3. Логування тренування

- Start session, log past session, finish/reopen/edit finished workout.
- Вправи, сети, warmup/cardio/strength kind.
- Set types, dropsets, duplicate set з повним переносом структури.
- Автоматичний rest timer між сетами.
- Supersets і групування вправ.
- Undo для видалення set/exercise.
- Автозавершення старого open workout.
- Share workout card після finish.

### 4. Прогрес і історія

- Історія тренувань.
- Weekly volume chart, volume totals, streak, PRs.
- Exercise history і records.
- Muscle readouts по тренуваннях і сесіях.
- Дані тренувань достатні для прийняття рішень без ручного аналізу.

### 5. Програми тренувань

- Programs tab для member/trainer/admin.
- Створення і редагування програм.
- 7-slot тижневий план, day names, open-ended programs.
- Program items з sets/reps/equipment/kind без ваги.
- CSV import/export для програм.
- Assignment програм користувачам.
- Member view активної програми.
- Start program day як звичайну workout session.
- Backfill missed program day.
- Suggested program draft з історії.

### 6. Бібліотека вправ

- Основне джерело — повний `free-exercise-db` rich dataset.
- 873 вправи з нормалізованими muscle/equipment/category/level/mechanic/force.
- Локально забандлені зображення вправ.
- Detail page з інструкціями, classification badges і фото.
- Fullscreen image viewer із zoom controls.
- Старий curated/video шар прибраний.
- Custom exercises лишаються тільки для реальних gaps у зовнішній DB.

### 7. Body metrics

- Required height/current weight gate для member.
- Weight history із можливістю періодичного запису.
- BMI і optional composition fields.
- Profile/body section і Today weigh-in reminder.

### 8. Gyms

- Зали користувача.
- Пошук/додавання залів, location/address/meta.
- Presence/reminder основа для “забув залогувати”.
- Gym detail і привʼязка workout до gym.

### 9. Offline/PWA/Deploy

- React/Vite PWA з service worker.
- Firestore offline persistence.
- Production deploy на Firebase Hosting:
  `https://spotter-64c3b.web.app`.
- Local dev workflow через `npm run dev`.
- Production build проходить server/client/desktop.

### 10. UX polish, достатній для MVP

- Mobile-first graphite/brass UI.
- Bottom tabbar / desktop rail.
- Edge swipe back на mobile з обережним gesture lock.
- Мобільні відступи на Programs/Exercises/Exercise details виправлені.
- Всі нові UI-рядки підтримують i18n parity.

## Інваріанти MVP

1. Дані тренувань не губляться.
2. Логування сетів швидке настільки, щоб реально користуватись у залі.
3. Історія тренувань корисна без ручного експорту.
4. Програма тренувань може бути створена, призначена і виконана.
5. Вправи мають нормальні назви, мʼязи, обладнання, інструкції та фото.
6. Продукт працює на телефоні як PWA і деплоїться у production.

У поточному стані всі шість інваріантів виконані.

## Що Свідомо Не Блокує MVP

- Native push notifications.
- Background geolocation.
- Нативний iOS/Android app.
- AI coach / nutrition / автоматичний аналіз фото.
- Повна медична аналітика composition.
- Публічний marketplace програм.
- Автоматичний імпорт з wearables.
- Досконала exercise ontology для всіх edge-case вправ.
- Повний regression e2e на кожен екран.

Це хороші post-MVP напрями, але вони не потрібні, щоб закрити перший продукт.

## Post-MVP Пріоритети

1. **Retention і adherence.** Тонкі нагадування, calendar rhythm, missed-day recovery.
2. **Program intelligence.** Кращі suggestions, auto-adjust volume, deload cues.
3. **Exercise ontology gaps.** Додати custom DB тільки там, де `free-exercise-db`
   реально не має коректної вправи.
4. **Coach workflows.** Коментарі тренера, review queue, порівняння adherence.
5. **Reliability analytics.** Crash/error monitoring, sync health, deployment checks.
6. **Native feel.** Більше gesture polish, install prompts, notification strategy.

## Definition Of Done Для Закриття MVP

- Production build зелений.
- `format:check`, `lint`, `typecheck`, `test:coverage`, `validate-sql` зелені.
- Останній production deploy успішний.
- Дані реального користувача очищені від legacy curated exercise names.
- Непотрібні дизайн-архіви й тимчасові артефакти прибрані з робочої папки.

Стан на 2026-08-13: виконано.
