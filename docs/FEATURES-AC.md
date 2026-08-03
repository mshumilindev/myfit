# Фічі та Acceptance Criteria

Цей файл — продуктова карта перевірки MVP і дизайн-версії My Fit. AC тут є
контрактом для smoke, unit/integration та e2e тестів.

## F-01 Auth

**Сценарій:** користувач створює акаунт, входить за email або username, отримує
захищений доступ до сервісів.

**AC**

- Реєстрація вимагає username 2–64 символи, валідний email і пароль 6–72 символи.
- Email нормалізується до lowercase; username зберігається обрізаним.
- Duplicate username або email повертає `409`.
- Login працює за username або email case-insensitive.
- Невірний пароль повертає `401`; багато невдалих спроб повертають `429`.
- Захищені tracker API без Bearer token повертають `401`.
- UI має стани sign in, sign up, validation, submitting, unreachable.

**Статус:** OK. Покрито smoke, unit/integration, e2e.

## F-02 Shell & i18n

**Сценарій:** після входу користувач бачить shell, вкладки
Today/Progress/Programs/Gyms, стан синку й може змінити мову.

**AC**

- Shell запускає sync-loop тільки для авторизованого користувача.
- Bottom tabbar є на mobile shell-екранах; session/dialog screens його не мають.
- Services/Apps тимчасово не рендериться: зараз є тільки Training, тому
  перемикач сервісів не має сенсу.
- Мова перемикається між `en`, `uk`, `pl`, `lt`, зберігається в localStorage і
  ставить `document.documentElement.lang`.
- Offline/queued/synced стани показані як стан, не як помилка.

**Статус:** OK; Language selector лишається як компактний чип на екранах.

## F-03 Workout Session

**Сценарій:** користувач починає тренування, додає вправи й підходи, редагує,
видаляє з undo, завершує або відкриває auto-closed session.

**AC**

- Start створює workout з client UUID і `finishedAt: null`.
- Якщо вже є open workout, новий start auto-closes попередній.
- Open workout старше 8 год auto-finishes на `startedAt + 8h` з `autoFinished`.
- Exercise upsert має name/kind/position, set upsert має reps/weight/warmup/cardio
  metrics/position.
- Вправи можна переставляти drag-and-drop; новий порядок синхронізується через
  idempotent exercise upsert з позиціями `0..n-1`.
- Ghost row префілиться з попереднього top working set для цієї вправи.
- Working set record позначається emerald, warmup не рахується record.
- Delete set/exercise має undo через idempotent restore.
- Finish drops set-less exercises після warning і лишає filled exercises.
- Finished workout можна редагувати.

**Статус:** OK для реалізованого ядра.

## F-04 Offline Queue & Sync

**Сценарій:** усі мутації працюють offline-first і безпечно replay-яться.

**AC**

- Кожна mutation оптимістично міняє local state, додає queue item і викликає sync.
- Replay іде в порядку queue.
- Після успішного replay клієнт робить full state replace зі server state.
- Network/401 failure не губить queue.
- Replay однакових PUT/POST dismiss не створює дублів на сервері.
- Permanent rejected mutation не блокує всю queue; після refetch server truth
  відновлює локальний state.

**Статус:** OK; окремий failed/blocked queue state з S-16 ще не реалізований.

## F-05 Gyms & Presence Reminders

**Сценарій:** користувач додає зал, додаток фіксує presence pings і нагадує про
незалоговане тренування.

**AC**

- Gym upsert вимагає name, lat, lng; radius clamp 30–2000 м.
- Ping для unknown gym повертає `404`.
- Presence записується не частіше раз на 5 хв і тільки коли accuracy <= 500 м.
- Pings групуються у visit; gap >45 хв починає новий visit.
- Visit 1h+ без overlapping workout створює reminder за останній тиждень.
- Overlap зі workout у межах ±30 хв suppresses reminder.
- Dismiss reminder idempotent і працює через offline queue.
- Log retroactively створює workout на час visit.

**Статус:** OK; visit-бари/статистика S-46 ще не реалізовані.

## F-06 Progress & History

**Сценарій:** користувач бачить recent sessions, volume, records та estimated 1RM,
коли даних достатньо.

**AC**

- До 3 finished sessions Progress показує locked empty state.
- Після 3 sessions Progress показує 10 weekly volume bars.
- Week volume рахується за finished sessions.
- Records беруть top working set, warmup ігноруються.
- Estimated 1RM рахується за Epley і округлюється.
- Exercise History показує chart/table, якщо є достатньо точок; інакше empty state.

**Статус:** OK для наявних метрик.

## F-07 PWA & Desktop Tray

**Сценарій:** застосунок збирається як PWA і запускається через Electron tray.

**AC**

- `npm run build` збирає server, client PWA і desktop.
- PWA precache містить app shell; `/api/*` має NetworkOnly.
- Electron tray запускає server через системний Node, poll-ить `/api/health`,
  має quick window, main window, browser open і graceful quit.
- Server data dir і port беруться з config/env, без hardcode в feature коді.

**Статус:** OK; e2e desktop window поки не автоматизований через GUI-boundary.

## F-08 Design System

**Сценарій:** UI відповідає Claude Design graphite/brass системі й локалізується.

**AC**

- Токени живуть у `client/src/styles.css`; компоненти не hardcode-ять hex.
- Brass = action/focus/live; emerald = success/records; ruby = loss/failure/offline.
- Primary buttons outlined, accent не заливає surfaces.
- Mobile screens не мають overlap на 390x844.
- Auth/Today/Session/Progress/Programs/Gyms мають empty/filled/offline/loading states
  відповідно до реалізованої фази.
- Новий UI-рядок додається у всі пʼять локалей.

**Статус:** OK для перевірених screens; Templates, failed queue і повні desktop
двоколонкові layouts лишаються фазовими gaps з `docs/DESIGN.md`.

## F-09 Programs

**Сценарій:** тренер або адмін створює програму з тижнів, семислотових
dateless-днів і prescription items; клієнт бачить активну програму на Today і
стартує день як звичайну сесію з плановими ghost rows.

**AC**

- Trainer/admin можуть створити, редагувати й видалити власну програму.
- Програма має name, weeks, daysPerWeek і 7 Monday-first day slots без дат.
- Prescription item містить sets, reps, equipment і kind
  `strength/cardio/warmup/cooldown`.
- Program item **не має weight/%1RM/RPE**; сервер відкидає weight навіть якщо
  старий клієнт або CSV його надішле.
- Equipment береться з закритого словника, має іконки, searchable multi-select,
  removable chips і common one-tap chips.
- Items у програмі можна переставляти drag-and-drop; порядок зберігається як
  `day + position`.
- День можна скопіювати у будь-який інший slot через `copy day to`.
- Assignment використовує multi-select chips; trainer може призначити програму
  тільки своєму клієнту, admin може призначати будь-кому.
- Member читає тільки свою активну програму через `/api/programs/mine`.
- Today показує active program card із 7-slot week strip, required equipment і
  кнопками старту тільки для запланованих днів.
- Start day створює workout з усіма вправами дня, але не створює logged sets.
  Strength ghost rows беруть reps із програми, weight з історії; якщо історії
  немає, прямий log блокується до введення ваги.
- Live session показує segmented plan progress, `logged / prescribed` на вправі
  і пояснення, що reps йдуть із програми, а weight з історії.

**Статус:** OK для MVP authoring/assignment/start-day за `Programs.zip`.
Залишаються фазовими gaps: повний CSV mapping+preview, backfill missed day зі
`Mark skipped`, equipment mismatch prompt і нотифікації assignment/replaced.

## Матриця Автоперевірок

| Feature                 | Unit/integration | API smoke | E2E                      |
| ----------------------- | ---------------- | --------- | ------------------------ |
| F-01 Auth               | так              | так       | так                      |
| F-02 Shell/i18n         | так              | ні        | так                      |
| F-03 Workout Session    | так              | так       | так                      |
| F-04 Offline Queue/Sync | так              | так       | так                      |
| F-05 Gyms/Reminders     | так              | так       | так                      |
| F-06 Progress/History   | так              | ні        | так                      |
| F-07 PWA/Desktop        | частково         | health    | PWA так, desktop manual  |
| F-08 Design System      | так              | ні        | так                      |
| F-09 Programs           | так              | так       | Today/start day частково |
