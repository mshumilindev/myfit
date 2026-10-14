# Коучинг: справжній бекенд, правила Firestore, розгортання

Стан: 2026-10-14 правила перевірено на справжньому Firestore Emulator: 54/54 тести пройшли. Серверні контракти також перевірено локально; ручний сценарій із двома production-акаунтами залишається окремою перевіркою.

## 1. Емулятор правил

1. Java 21+ (firebase-tools 14+ вимагає). macOS: `brew install openjdk@21`, далі `export JAVA_HOME="$(/usr/libexec/java_home -v 21)"`. Перевірка: `java -version`.
2. У корені репозиторію: `npm ci` (змінить lock-файл; `firebase` уже є залежністю клієнта).
3. Запуск: `npm run test:rules` (це `firebase emulators:exec --only firestore --project demo-spotter "vitest run --config vitest.rules.config.ts"`). Перший запуск качає jar у `~/.cache/firebase/emulators`.
4. Очікування: усі кейси `tests/rules/coach.rules.test.ts` зелені (49 з ітерації 8 і один новий: «a whole program fits a plan / version document»). Без `FIRESTORE_EMULATOR_HOST` файл показує один SKIPPED тест, а не зелений.
5. Якщо кейс падає: це помилка правила або очікування в тесті (набір писали наосліп). Виправляти `firestore.rules` чи кейс. Винятки: кейси «query shapes the real adapters run» — там міняється запит в адаптері, бо правила не можуть довести list-запит по `schedules`, `messages`, `liveSessions`, `programs`.

## 2. Розгортання

1. Секрети (ніколи в репозиторії):
   - `firebase functions:secrets:set COACH_PEPPER` — щонайменше 32 випадкових байти в base64 (`openssl rand -base64 48`).
   - `firebase functions:secrets:set COACH_SIGNING_KEY` — приватний ключ Ed25519 у PEM (`openssl genpkey -algorithm ED25519`).
2. `cd functions && npm install && npm run build && cd ..`, далі `firebase deploy --only functions,firestore:rules,firestore:indexes`.
   Функції коучингу: `coachInvite`, `coachInviteRevoke`, `coachInvitePreview`, `coachAccept`, `coachDecline`, `coachEnd`, `setCoachingMode`, `setConsent`, `coachMyLink`, `coachRead`, `coachLogRead`, `coachClients`, `coachChatReset`, `rescheduleCreate`, `rescheduleRespond`, `publishPlanVersion`, `coachPublishSignKey`, `coachKeySign`; тригери `onCoachMessageCreated`, `onCoachMessageUpdated`, `onCoachConversationWritten`, `onCoachKeyWritten`; планова `coachSweep`.
3. Публікація `config/coachSigning`: увійти тренером або адміном і відкрити Coach з увімкненим бекендом. Перший виклик `coachKeySign` записує `config/coachSigning` (`kid`, `pub`, `alg: 'Ed25519'`); клієнти беруть звідти ключ для перевірки. Поки документа немає, клієнт відмовляється загортати ключ для тренера (безпечна відмова).
4. Увімкнення: глобальний прапорець `coach` у `config/flags` (пише адмін). Збірка клієнта: production і прев'ю без змінної = справжній бекенд; `npm run dev` без змінної = **auto** (ітерація 24): спершу справжній бекенд; обмежений (таймаут, кеш 5 хв для успіху / 20 с для помилки) probe одного читального callable `coachMyLink` (`client/src/coach/data/probe.ts`) вирішує до встановлення адаптерів. Немає входу або probe провалився = kit-стан помилки з причиною і (лише dev) «Use demo data»; демо і справжні дані ніколи не змішуються. `VITE_COACH_BACKEND=firestore` пропускає probe. Фікстури: `VITE_COACH_BACKEND=fixtures`.
5. Димовий тест двома акаунтами (тренер і учасник): запрошення, прийняття, повідомлення, розклад, запит на перенесення, редагування програми та «Надіслати». У консолі Firebase `conversations`, `schedules`, `plans`, `plans/*/versions` мають містити лише відкриті поля та `enc`, без імен, текстів чи вправ.

## 3. Програмний шар (`plans`)

- Ключ: підключ `plan` з ключа розмови (HKDF), AAD = `cid | epoch | id | автор | час | клас` (`planCodec.ts`).
  - `plans/{clientId}`: клас `plan`, id = clientId, автор = trainerId, час = 0 (функція публікації змінює `liveVersion`, `rev`, `updatedAt`, тому вони не входять в AAD).
  - `plans/{clientId}/versions/{n}`: клас `planVersion`, id = `clientId:n`, час = `createdAt` (незмінний за правилами). Версія містить усю програму, дні з тренером, diff і підсумок. Чернетка (`state: 'draft'`) недоступна клієнту за правилами.
- Розмір: плани й версії до 180 000 байт корисного навантаження (`PLAN_MAX_BYTES`), правила `sealedCkPlan` пропускають до 250 000 base64-символів. Решта колекцій лишається на 8 000 байт / 11 000 символів.
- Тренер: `data/firestore/programPort.ts` (збереження чернетки однією транзакцією з перевіркою `rev`; «Надіслати» = збереження, виклик `publishPlanVersion`, оновлення зашифрованого overlay плану). Учасник: `data/firestore/clientProgram.ts` читає лише живу версію й будує `ProgramLayer`.
- `cancelGroup` (переніс усієї групи): скасовує лише відкриті запити; прийняті відповіді не скасовуються автоматично.

## 4. Відомі прогалини

- Правила Firestore: 54/54 перевірки на емуляторі пройшли 2026-10-14 (див. розділ 1).
- Тригери, функції та `firebaseFs.ts` не пробувались на живому проєкті.
- `programs/{programId}` (виконувана програма для старту тренування) адаптером планів не створюється; `publishPlanVersion` вказує `assignments/{clientId}` на `prg-{clientId}`.
- Документ розкладу (`schedules`) досі обмежений 8 000 байт корисного навантаження й 11 000 символів у правилах; великий розклад з багатьма винятками не збережеться (треба той самий підхід, що для планів).

## 5. Клієнт: режими, безпека, очищення (ітерація 14)

- `VITE_COACH_BACKEND`: `firestore` (справжні адаптери), `off` = «Coach is not configured», жодних клієнтів; не задано = `firestore` (у dev: auto-probe, ітерація 24, див. розділ 7). Демо-даних у застосунку немає взагалі (ітерація 25, розділ 8); скріншоти Playwright збираються окремим `client/vite.config.qa.ts`.
- `VITE_APP_ORIGIN` — походження для посилань-запрошень (`coach/inviteLink.ts`).
- Блокування екрана за бездіяльності прибрано (iteration 18, див. `COACH-SERVER-SECURITY.md`); експорт, завершення співпраці та відкликання доступу, як і раніше, вимагають повторної автентифікації.
- Код безпеки (security code) показується в діалозі; зміна ключа показує банер.
- Очищення пристрою (`deviceWipe.ts`): при виході — одразу плюс перезавантаження; при завершенні співпраці — відкладено до наступного старту і лише без незавершених записів. Чистяться sealed-сховище, ключі розмов, кеші та IndexedDB.
- Тихі години: `users/{uid}/push/{device}.quiet` і `tz`; сервер має ставити тег `coach-chat`. SW лише приглушує (на iOS пуш має бути видимим).
- Єдиний автор живої сесії: при встановленому Coach-бекенді старий запис присутності вимкнено (`setLegacyLiveWriter`).

## 6. Який бекенд обирає клієнт, і старий тренер (`users.trainerId`) (ітерація 21)

- (ітерація 21, змінено в ітераціях 23 і 25: розділи 7 і 8) `VITE_COACH_BACKEND` не задано = справжній бекенд скрізь; у `npm run dev` спершу probe. Проєкт Firebase зашитий у застосунок, тож бекенд завжди «налаштований».
  Тестові дублі (`__fixtures__`) лише у Vitest, Storybook і QA-збірці (розділ 8). `off` = «Coach не налаштовано».
  Один перемикач `coachBackendMode()` для клієнтського екрана «Мій тренер» і для дашборду тренера. Демо-банера більше немає; порти за замовчуванням «unavailable» (помилка, не вигадані люди), а невдале встановлення адаптерів показує помилку з «Спробувати ще раз».
- Картка тренера на Today береться зі старого `profileMe` (`users.trainerId`). Раніше тап відкривав екрани на фікстурах. Тепер клієнтський порт один раз за
  сесію викликає `coachAdoptLegacy`: сервер створює `coaching/{me}` (режим `app`, усі рівні згоди `off`, `migratedFrom: 'legacy-trainerId'`), а клієнт
  запускає обмін ключами. На «Мій тренер» видно примітку «нічого не передається, доки ви не оберете» з кнопкою до налаштувань доступу.
  Це та сама логіка, що й адмінський бекфіл `coachMigrateLegacy`, лише для власного запису викликача.
- Розгортання: `firebase deploy --only functions:coachAdoptLegacy` (або всі функції). Старий сервер відповідає `unimplemented`: клієнт показує «Тренера ще немає» і пробує знову в наступній сесії.
- Не перевірено на живому проєкті: сама функція у Firestore і екрани з реальним акаунтом (пісочниця не має доступу до Firebase). Перевірено: in-memory сервер, `memoryFs`, правила через інтерпретатор.

## 7. Чому «нічого не працює» зі справжнім бекендом, і чекліст розгортання (ітерація 23)

**English, short.** Since iteration 21 `npm run dev` ran the REAL backend by default. The coach collections, rules, indexes, callables and secrets were never
deployed to the live project `spotter-64c3b` (they only ever ran against in-memory fakes), so the first load failed: the trainer's `coachClients` callable
answers not-found/internal (Today: "Could not load"), and on the client the first snapshot never completes (an endless skeleton). From iteration 23: dev defaults to
the demo, every first load is bounded (8 s) and ends in a plain error (offline / not deployed / denied / too slow / unknown) with Retry, in dev with a hint and
"Use demo data". The sandbox cannot reach Firebase, so WHICH of the items below is missing on the live project is **not verified**; the checklist is exact.

### 7.1 Що потрібно на сервері для першого завантаження

| Хто                                     | Що читає/викликає при старті                                                                                                                                                                                          | Потрібно на сервері                                                                                                                                                                                                               |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Усі (обидві ролі)                       | `vaultKey` (сховище ключів), `coachPublishSignKey` / `coachKeySign` (підпис ключа тренера), `config/flags`                                                                                                            | функції `vaultKey`, `coachPublishSignKey`, `coachKeySign`; секрети `VAULT_MASTER`, `COACH_SIGNING_KEY`; правила `config`, `coachKeys`, `signKeys`                                                                                 |
| Тренер: Today                           | `coachClients`, `coachRead` (на кожного клієнта); `users/{uid}/decisions`, `users/{uid}/meta/signalState`, `programs` (authorId), `assignments/{id}`; `schedules/{id}`, `conversations` (trainerId + active + lastAt) | функції `coachClients`, `coachRead`; секрет `COACH_PEPPER`; правила `users/*/decisions`, `meta/signalState`, `programs`, `assignments`, `schedules`, `conversations`; індекс `conversations (trainerId, active, lastAt desc)`     |
| Тренер: чат, розклад, нотатки, програма | `conversations/*/messages`, `notes`, `requests`, `keyring`, `plans`, `plans/*/versions`, `liveSessions`                                                                                                               | правила цих колекцій; індекси `messages`, `notes`, `requests`, `decisions`, `clientNotes` з `firestore.indexes.json`; функції `rescheduleCreate`, `rescheduleRespond`, `publishPlanVersion`, `coachChatReset`; тригери `onCoach*` |
| Клієнт: «Мій тренер»                    | `coaching/{me}`, `plans/{me}`, `users/{me}/notices`, `users/{me}/grants/*`, `meta/selfCoach`; `coachAdoptLegacy` (старий `users.trainerId`), `coachMyLink`, `programAck`                                              | функції `coachAdoptLegacy`, `coachMyLink`, `programAck`, `coachAccept`, `coachDecline`, `setConsent`, `coachEnd`, `coachLogRead`; правила `coaching`, `users/*/grants`, `plans`, `notices`                                        |
| Запрошення                              | `coachInvite`, `coachInviteRevoke`, `coachInvitePreview`; посилання `<APP_ORIGIN>/#/invite/<token>`                                                                                                                   | функції; параметр `APP_ORIGIN` (за замовчуванням hosting-origin)                                                                                                                                                                  |
| Прапорець                               | `config/flags` має `coach: true`                                                                                                                                                                                      | запис адміна                                                                                                                                                                                                                      |

### 7.2 Команди (по порядку)

```sh
firebase use spotter-64c3b
# 1. Секрети (один раз; не в репозиторії)
openssl rand -base64 48 | firebase functions:secrets:set COACH_PEPPER
openssl genpkey -algorithm ED25519 | firebase functions:secrets:set COACH_SIGNING_KEY
firebase functions:secrets:access VAULT_MASTER >/dev/null   # має існувати (сховище)
# 2. Параметри (functions/.env.spotter-64c3b), за потреби
#    APP_ORIGIN=https://spotter-64c3b.web.app
#    COACH_ENFORCE_APPCHECK=false      # true лише коли клієнт має VITE_RECAPTCHA_ENTERPRISE_KEY і консоль показує перевірений трафік
# 3. Збірка і розгортання правил, індексів і функцій
(cd functions && npm install && npm run build)
firebase deploy --only firestore:rules,firestore:indexes,functions
# 4. Індекси будуються хвилини; перевірити стан
firebase firestore:indexes
# 5. Перевірка, що функції існують (мають бути всі з розділу 2 і coachAdoptLegacy, programAck, coachExport, coachMigrateLegacy, coachLogRead)
firebase functions:list | grep -E "coach|program|vaultKey|reschedule|publishPlanVersion"
# 6. Прапорець coach: адмін пише config/flags { coach: true } (консоль Firestore або застосунок)
# 7. Закріплення підпису: увійти тренером/адміном, відкрити Coach один раз. coachKeySign створює config/coachSigning { kid, pub, alg: 'Ed25519' }
#    (закріпити pin: перевірити в консолі, що kid/pub збігаються з ключем COACH_SIGNING_KEY; змінювати його = зламати довіру клієнтів)
```

Ознаки в браузері (консоль, вкладка Network): `coachClients` 404/`functions/not-found` або CORS без відповіді = функції не розгорнуто; `permission-denied` = правила не розгорнуто
або `COACH_ENFORCE_APPCHECK=true` без токена App Check; `functions/internal` = секрет `COACH_PEPPER`/`COACH_SIGNING_KEY` не задано; «The query requires an index» з посиланням = індекс ще не створено.

### 7.3 Нові виклики ітерації 22-23

- `programAck` (`{ version }`, клієнт повідомляє, що відкрив живу версію програми): сервер у транзакції пише сповіщення `users/{trainer}/notices/pa-{client}` (`kind: 'program-seen'`, лише версія і час, ідемпотентно); вкладка «Програма» тренера показує «Переглянув Oleh». Без функції клієнтський виклик мовчки не виконується.
- `coachAdoptLegacy` (клієнт з `users.trainerId`): створює `coaching/{me}` (режим `app`, згода `off`, `migratedFrom: 'legacy-trainerId'`). Без неї картка старого тренера не відкриває реальні екрани (клієнт тепер показує картку тренера зі спокійною приміткою).
  Обидві входять до `firebase deploy --only functions`; окремо: `firebase deploy --only functions:programAck,functions:coachAdoptLegacy`.

### 7.4 Режими клієнта (ітерація 23)

|                                | `npm run dev`                                                                                                    | production / прев'ю |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------- |
| не задано                      | **auto**: справжній бекенд після успішного probe, інакше стан помилки з «Спробувати ще раз» (без демо)           | справжній бекенд    |
| `VITE_COACH_BACKEND=firestore` | справжній бекенд                                                                                                 | справжній бекенд    |
| помилка справжнього бекенду    | помилка з «Спробувати ще раз», без демо (кнопку «Use demo data» і localStorage-перемикач прибрано в ітерації 25) | те саме             |

Стани помилки (одна мова для тренера і клієнта): завантаження (скелетон до 8 с) -> `offline` «Немає з'єднання», `not-deployed` «Сервіс Coach ще недоступний у цьому проєкті»,
`denied` «Coach недоступний для цього акаунта», `timeout` «Coach відповідає надто довго», `unknown`. Клієнт зі старим тренером бачить картку тренера з спокійною приміткою (не порожній скелетон).

## 8. Демо-даних у застосунку немає (ітерація 25)

**English, short.** The product (dev server, preview, production) contains no sample data and no switch to get it: no `fixtures` mode, no "Use demo data" button, no DEMO banner, no
"sample workspace" in the roster, no localStorage override, no demo clock. Coach is the real backend; when it cannot serve a screen the person sees the kit error state
(offline / not deployed / denied / too slow / unknown) with Retry. The probe of iteration 24 stays (dev, `VITE_COACH_BACKEND` unset).

- Код тестових дублів лежить лише в каталогах `__fixtures__` (`data/__fixtures__`, `chat/`, `schedule/`, `notes/`, `program/`, `share/`, `screens/live/`, `client/data/`, `security/`) і в `*.stories.tsx` / `*StoryFrame` / `storyKit` / `storyPorts`.
- Двері для них одні: `coach/data/testHooks.ts`. Він читає `globalThis.__SPOTTER_COACH_TEST__` лише коли `import.meta.env.MODE === 'test'` або `VITE_COACH_TEST_HOOKS === '1'`. У будь-якій збірці застосунку це константа `undefined`, гілка вирізається, і жоден модуль `__fixtures__` не імпортується (guard у `tests/kit-guard.test.ts`).
  `coach/__fixtures__/register.ts` кладе туди фабрики портів; його імпортують лише `src/coach/__fixtures__/setup.ts` (Vitest), `.storybook/preview.tsx` і `qaEntry.ts` (QA-збірка). Сеттер `setCoachBackendMode` живе в `register.ts`, у збірці застосунку його немає.
- QA / скріншоти: `cd client && npx vite build --config vite.config.qa.ts --outDir ../_shots/iter25/qa --emptyOutDir` (визначає `VITE_COACH_TEST_HOOKS=1` і вантажить `qaEntry.ts` перед застосунком). Ця конфігурація не входить у `npm run build`.
- Доказ: `vite build` у тимчасовий каталог і `grep -rlF` по `dist` для `Oleh`, `Iryna`, `Taras Rudenko`, `Iron Yard`, `FitHub`, `Use demo data`, `__SPOTTER_COACH_TEST__`, `spotter.coachBackend`: 0 збігів.
- Порти за замовчуванням (`data/unavailable.ts`): world, chat, live, share, program, schedule, notes, client, clientChat, trust; кожен лише повідомляє `unavailable`. Шлюз `coachAdapter(name, unavailable)` у `backend.ts`.
