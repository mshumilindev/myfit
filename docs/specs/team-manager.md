# Команда тренера і роль Manager — spec

Задача: SPO-196 (епік), SPO-260 · Статус: **чернетка, очікує погодження користувача** (код більшості AC вже в main, див. «Статус AC») · Автор/дата: власник + Claude, 20–21.10.2026

## Мета і контекст

Тренер може додати **менеджера** (адмін-помічника): менеджер бачить розклад клієнтів усіх тренерів команди, переносить сесії (запитом), скасовує, відмічає done/missed, запрошує клієнтів і просить видалити клієнта. Чатів, нотаток, плану, live, здоров'я й харчування менеджер не бачить і не пише. Тренер видаляє менеджера, будь-хто може піти сам. Закріплений read-only сервісний чат **Spotter** і push без вмісту збирають усе, що треба зробити.

Рішення власника: **фіча-флага `teamManager` немає.** Доступ визначає роль і членство в команді (rules + функції), а не прапорець. Усі пункти про флаг у SPO-266 мають статус N/A.

Дизайн: Design-артефакт (68 бордів, `https://claude.ai/artifact/TH5sbNzxmV7QfLFY3b13bo`). Ключове рішення: `docs/adr/005-team-manager-key-delegation.md`. Вихідні документи (Project «Spotter»): `SPO-197-key-delegation-decision.md`, `SPO-196-dev-plan.md`, `SPO-194-manager-design-audit.md`.

## Поза скоупом

- Спільний чат менеджер↔тренер і чат менеджера з клієнтами (менеджер **не пише**).
- Роль `owner` як окрема роль (власник команди = тренер, чий uid є `teamId`); кілька команд на тренера; ієрархія вищих ролей; оплата/тарифи команди.
- Доступ менеджера до тренувань, здоров'я, харчування, нотаток, плану, live, чату.
- Нові UI-примітиви (усе з наявного кіту).
- Легасі `server/` і `desktop/` не чіпаємо.
- Мейл-розсилка запрошень (запрошення = посилання; пошта лише підпис і прив'язка до підтвердженого e-mail).

## Ролі й права

Ролі в `users/{uid}.role`: `member | trainer | admin | manager`. Роль потрапляє в custom claim `role` токена (`mintToken`); менеджерський токен видає `teamAccept`. Усі привілеї рахуються з **живого** `users/{uid}` (stale-claim guard у rules: `isManager()` вимагає, щоб документ теж казав `manager`). `isCoachRole()` і `isTrainerOrAdmin()` для менеджера **false**: менеджер не тренер. Команда: `teams/{teamId}`, `teamId` = uid тренера-власника; `users/{uid}.teamId` вказує учасника на команду (немає = тренер володіє власною).

| Дія                                                  | Власник-тренер                                            | Тренер-учасник                                             | Менеджер                                           | Клієнт                                          |
| ---------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------- |
| Бачити склад команди                                 | так                                                       | так                                                        | так                                                | список менеджерів своєї команди (для делегації) |
| Додати менеджера                                     | так (`teamInvite`, лише власник)                          | ні (`owner-only`)                                          | ні                                                 | ні                                              |
| Додати тренера                                       | так                                                       | так                                                        | так                                                | ні                                              |
| Видалити учасника                                    | так, лише менеджера (`teamRemoveMember`, `managers-only`) | ні                                                         | ні                                                 | ні                                              |
| Вийти з команди                                      | n/a                                                       | так (`teamLeave`)                                          | так                                                | n/a                                             |
| Розклад клієнтів команди                             | свої                                                      | свої                                                       | усіх клієнтів команди (sealed, підключ `schedule`) | свій                                            |
| Перенос сесії                                        | пряма зміна                                               | пряма зміна                                                | лише запит `from:'manager'`                        | відповідає на запит                             |
| Скасувати, done/missed                               | так                                                       | так                                                        | так (запис у журнал через `teamLogActivity`)       | свої                                            |
| Запит на видалення клієнта                           | схвалює для своїх клієнтів (`clientRemovalRespond`)       | схвалює лише для своїх клієнтів (`not-your-client` інакше) | створює/скасовує                                   | не знає про запит                               |
| Запросити клієнта                                    | так                                                       | так                                                        | `inviteClientForTrainer` (звичайне app-запрошення) | n/a                                             |
| Чат, нотатки, план, live, здоров'я, харчування, тіло | за згодою клієнта                                         | те саме                                                    | **ні**                                             | свої                                            |
| Журнал активності                                    | усе                                                       | своє (записи з `actorUid == uid`)                          | своє, або все за `activityScope=='all'`            | бачить дії менеджерів у «Who saw your data»     |
| Змінити `activityScope`                              | так (`teamSetActivityScope`)                              | ні                                                         | ні                                                 | ні                                              |
| Spotter                                              | так                                                       | так                                                        | так                                                | так                                             |

## Модель даних

Усі нові колекції пише лише сервер (Admin SDK); клієнтські `write` у rules = `false`, крім вказаного.

| Шлях                                           | Зміст                                                                                                                                | Читає                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `teams/{teamId}`                               | документ команди; створюється ледачо (`ensureTeam`) при першому запрошенні                                                           | власник, активні учасники                                                                    |
| `teams/{teamId}/members/{uid}`                 | `{ uid, role: trainer\|manager, status: active\|removed, owner?, addedAt, addedBy, removedAt? }` (ім'я резолвиться окремо, `nameOf`) | власник, сам учасник, активні учасники, активні клієнти команди (щоб знати, кому делегувати) |
| `teams/{teamId}/acl/{uid}`                     | `{ activityScope: 'own'\|'all' }`                                                                                                    | власник і сам учасник                                                                        |
| `teams/{teamId}/activity/{id}`                 | `{ actorUid, role, kind, clientId?, refId?, status?, ts }`, **без шифрованого змісту**                                               | див. «Журнал»                                                                                |
| `teamInvites/{token}`                          | запрошення-посилання (`#/invite/<token>`), TTL 7 днів, до 20 відкритих, до 10 менеджерів                                             | автор і власник команди                                                                      |
| `teamRequests/rm-<id>`                         | запит менеджера на видалення клієнта                                                                                                 | автор і тренер клієнта                                                                       |
| `conversations/{cid}/delegations/{managerUid}` | `{ epoch, fp, schedule: Wrap, requests: Wrap, at }`, пише лише **клієнт**                                                            | менеджер (свій документ, лише поточна епоха) і клієнт                                        |
| `users/{uid}/notices/{id}`                     | Spotter-повідомлення, лише метадані; клієнт може лише ставити `readAt`                                                               | власник                                                                                      |
| `users/{uid}.teamId`, `.role`                  | членство й роль                                                                                                                      | сам користувач                                                                               |
| `coaching/{clientId}/schedules/{clientId}`     | sealed розклад + відкрите `updatedBy` і `timing` (лише моменти)                                                                      | клієнт, тренер, менеджер команди                                                             |

Ліміти й форма полів задані в `functions/src/coach/team.ts` і `firestore.rules`; спека їх не дублює.

## AC (кожен — одна перевірювана умова; `[x]` лише з доказом)

- [ ] AC1 — `users/{uid}.role` приймає `manager`; менеджер не має прав тренера · доказ: `tests/rules/team.rules.logic.test.ts` (зелений 21.10), емулятор не запускався
- [ ] AC2 — модель `teams/{teamId}` + `members` + `acl` + `activity`, `teamInvites`, `teamRequests`; менеджер читає лише розклад і запити своєї команди, нічого з `notes|plan|chat|live|health|nutrition|body`; не пише `coaching` · доказ: rules-тести (емулятор, Java 21)
- [ ] AC3 — функції з розділу «Функції» + `rescheduleCreate` з `from:'manager'` · доказ: `tests/coach-server/team*.test.ts`
- [ ] AC4 — делегація підключів `schedule|requests` клієнтським пристроєм; видалення = rules одразу + ротація епохи · доказ: `client/src/coachCrypto`, `delegationPublisher.test.ts`, `managerRings.test.ts` (зелені 21.10)
- [ ] AC5 — UI Team (тренер/менеджер, desktop+phone): додати/прийняти/видалити/вийти · доказ: сторі, скріни, e2e
- [ ] AC6 — розклад менеджера: фільтр Trainer, move = запит, cancel, mark done/missed · доказ: сторі, e2e
- [ ] AC7 — клієнти менеджера, обрізана картка, запрошення, запит на видалення; стан «Waiting for client's app» · доказ: сторі, e2e
- [ ] AC8 — Agenda тренера: «Team requests», схвалення видалення · доказ: сторі, e2e
- [ ] AC9 — журнал `teams/{uid}/activity`: тренер усе, менеджер своє або все за `activityScope`; ретеншн 90 днів · доказ: rules-тести, e2e
- [ ] AC10 — Spotter = вигляд над `users/{uid}/notices`, закріплений, read-only, кнопки дій · доказ: сторі, e2e
- [ ] AC11 — push без вмісту (`coach-request|team|reminder`), налаштування, планові нагадування · доказ: `pushPolicy.test.ts`, `reminders.test.ts`
- [ ] AC12 — UI клієнта: запит від команди, «Your trainer's team», «Who saw your data» зі записами менеджера · доказ: сторі, e2e
- [ ] AC13 — 5 локалей, `i18n:check`; `kit-guard`, `audit:stories`, геометрія зелені · доказ: CI
- [ ] AC14 — rollout без флага: ролі й rules як єдині ворота, ледача команда без міграції даних, порядок розгортання, відкат · доказ: чек-лист нижче, прогнаний на staging

Фіча-флаг `teamManager` **N/A** (рішення власника): окремого AC на флаг немає.

## Потік ключів (ADR 005)

1. Менеджер має пару ключів `coachKeys/{uid}`, підписану сервером у `teamAccept`; приватна половина в vault менеджера.
2. Пристрій **клієнта** при відкритті застосунку (`delegationPublisher`, цикл ringBook, ідемпотентний) бере список активних менеджерів команди свого тренера (`teamManagersForClient`), перевіряє підпис їхнього ключа й публікує `delegations/{managerUid}` для **поточної епохи**: підключі лише `schedule` і `requests`, AAD `deleg|1|cid|epoch|purpose|managerFp`.
3. Менеджер відкриває делегацію (`managerRings`), отримує non-extractable ключі двох призначень; `chat|notes|plan|live` недоступні (`bad-purpose`).
4. Видалення менеджера: rules і `teamRemoveMember` закривають читання одразу, делегації видаляються, на розмовах клієнтів ставиться `rotateDue`; клієнт ротує епоху при наступному відкритті. Вихід тренера: делегації його менеджерів видаляються.
5. Поки клієнт не відкрив застосунок, менеджер бачить «Waiting for client's app» (не помилка).

## Функції (`functions/src/coach/handlers.ts`)

| Група            | Функції                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Команда          | `teamInvite`, `teamInviteRevoke`, `teamInvitePreview`, `teamAccept`, `teamDecline`, `teamRemoveMember`, `teamLeave`, `teamRead`, `teamSetActivityScope` |
| Клієнти          | `teamClients`, `inviteClientForTrainer`, `teamManagersForClient`, `teamForClient`                                                                       |
| Запити           | `clientRemovalCreate`, `clientRemovalCancel`, `clientRemovalRespond`, `teamRequests`; `rescheduleCreate` приймає `from:'manager'`                       |
| Журнал і Spotter | `teamLogActivity`, `teamActivity`, `teamNotices`, `teamNoticesRead`                                                                                     |
| Планові          | `coachReminders` (кожні 15 хв), `coachSweep` (щогодини: завершення запитів, ретеншн журналу, прапорці ротації)                                          |

Кожна функція перечитує роль і статус з Firestore (`run(req, roles, …)`); доступні ролі задані на виклик.

## Rules

Нові гілки не відкривають нічого старим ролям. Менеджер: читає й пише лише `schedules/{clientId}` і запити клієнтів своєї команди, під поточною епохою ключа, з truthful `updatedBy`; не читає `notes|plan|chat|live|health|nutrition|body`; `coaching` не пише. Докази: `tests/rules/team.rules.logic.test.ts` (інтерпретатор rules без емулятора), `tests/rules/coach.rules.logic.test.ts`; на емуляторі (`npm run test:rules`, потрібна Java 21) ще не запускалось.

## Події, notices, push

- Spotter = вигляд над `users/{uid}/notices`. Сервер пише метадані: `kind`, `actorUid`, `clientId`, `refId`, `status`, `ts`, `detail` (ім'я). Часи сесій рендеряться локально з розшифрованого розкладу за `refId`. Види: `move-request`, `move-cancel`, `removal-request`, `removal-cancelled`, `removal-answer`, `unmarked`, `member-added`, `client-invite` та ін. (точний перелік у `team.ts`, `service.ts`, `reminders.ts`).
- Push **без вмісту** (`pushPolicy.ts`): теги `coach-request`, `coach-team`, `coach-reminder`, `coach-sync` (тихий); категорії, які користувач вмикає: chat, requests, team, reminders. Тихі години застосовуються лише до чату (`coach-chat`) і нагадувань.
- Нагадування (SPO-265): клієнту за 18 год до сесії, тренеру й менеджерам через 2 год після завершення, якщо не відмічено. Сервер бачить лише відкрите `timing` (до 12 моментів на список), без залу, програми й нотаток. Це свідомий компроміс (ADR 005, доповнення).

## Журнал

`teams/{teamId}/activity/{id}`, метадані, ретеншн 90 днів. Читають: власник усе; учасник записи з `actorUid == uid`, а при `acl.activityScope == 'all'` усі. Змінює `activityScope` лише власник. Дії менеджера над даними клієнта дзеркаляться в `users/{clientId}/audit` (`via: manager`), клієнт бачить їх у «Who saw your data». Зашифровані дії менеджера (done/missed/cancel/edit) сервер не бачить, їх повідомляє пристрій менеджера через `teamLogActivity` (дозволені `REPORTED_KINDS`).

## UX-стани

- **Waiting for client's app** (`mcWaiting`): клієнт ще не відкривав застосунок після додавання менеджера; делегації немає; картка клієнта без розкладу, у команді рядок «N clients have not opened Spotter since you joined»; тихий `sync`-push прискорює, але не гарантує.
- **Read-only Spotter**: у закріпленому чаті немає поля вводу; відповіді лише кнопками дій (ті самі функції, що й Agenda).
- Менеджер без доступу до чату/нотаток бачить обрізану картку клієнта, не порожнечу з помилкою.
- Офлайн: запис розкладу менеджера йде в офлайн-чергу як у тренера; відсутність мережі не помилка.
- Стани завантаження/порожньо/помилка для Team, Clients, Schedule, Activity, Roles, Spotter, Agenda «Team requests», «Your trainer's team» у клієнта: сторі кожного (SPO-262).

## i18n: ключі й глосарій (5 локалей)

Усі рядки команди в `client/src/i18n/coachTeam.{en,uk,pl,lt,et}.ts` (однакова кількість ключів у кожній локалі, паритет перевіряє `i18n:check`), доступ через `useTeamT()` → `tm.<ключ>`. Префікси: `tm*` Team, `mc*` клієнти менеджера, `tr*` запити, `sp*` Spotter. Переклади нижче взято з файлів, не вигадано.

| Поняття (ключ)                         | en                       | uk                            | pl                           | lt                           | et                           |
| -------------------------------------- | ------------------------ | ----------------------------- | ---------------------------- | ---------------------------- | ---------------------------- |
| Team (`tmTitle`)                       | Team                     | Команда                       | Zespół                       | Komanda                      | Meeskond                     |
| Trainer (`tmRoleTrainer`)              | Trainer                  | Тренер                        | Trener                       | Treneris                     | Treener                      |
| Manager (`tmRoleManager`)              | Manager                  | Менеджер                      | Menedżer                     | Vadybininkas                 | Haldur                       |
| Spotter (`spTitle`)                    | Spotter                  | Spotter                       | Spotter                      | Spotter                      | Spotter                      |
| Waiting for client's app (`mcWaiting`) | Waiting for client’s app | Чекаємо на застосунок клієнта | Czekamy na aplikację klienta | Laukiama kliento programėlės | Ootame kliendi rakendust     |
| See all team activity (`tmSeeAll`)     | See all team activity    | Бачити всю активність команди | Widzi całą aktywność zespołu | Matyti visą komandos veiklą  | Näeb kogu meeskonna tegevust |
| Request removal (`mcRequestRemoval`)   | Request removal          | Попросити видалити            | Poproś o usunięcie           | Prašyti pašalinti            | Palu eemaldada               |
| Approve removal (`trApprove`)          | Approve removal          | Схвалити видалення            | Zatwierdź usunięcie          | Patvirtinti pašalinimą       | Kinnita eemaldamine          |

Примітка: `tmSeeAll` у pl/lt/et сформульовано від третьої особи («Widzi…», «Matyti…», «Näeb…»), як підпис перемикача активності учасника; uk/en нейтральні. Переклади lt/et потребують перевірки носієм. Нові рядки додаються в усі п'ять файлів одразу (`npm run i18n:check`, бюджети довжини `tests/i18n-length.test.ts` не піднімаємо).

## Нефункційні вимоги

E2EE-інваріант зберігається (сервер не читає розклад); офлайн-first; ідемпотентність (клієнтські id, детерміновані id notices); 5 локалей одразу; a11y (діалоги, Sheet, Switch з aria); CI ≤5 хв (ADR 004), нові перевірки окремими job; нових залежностей і примітивів кіту немає; прод-дані лише для читання.

## Підхід

Найближчі аналоги: `coachInvite/Accept/End` (`functions/src/coach/service.ts`), `conversationKey.ts` + `keyRing.ts` (ключі за призначенням), `users/{uid}/notices`, `pushPolicy.ts`. Рекомендація: повторити ці патерни; нових примітивів кіту й залежностей немає. Новий патерн один: делегація підключів пристроєм клієнта (ADR 005). Альтернативи (тренер делегує; спільний командний ключ; серверне шифрування Spotter; серверне читання розкладу) відхилені в ADR зі ціною.

## Вплив

- **UI-кіт:** `PageHead`, `GroupedList/ListRow`, `Sheet`, `Select`, `Switch`, `Tag`, `Notice`, `DataTable`, `ConfirmEffectsDialog`, `RequestCard`, `ScheduleScreen`, `RosterScreen`, `InvitePanel`, `AccessLogPage`. Нових примітивів немає (запису в `docs/UI-KIT.md` не потрібно); сторі на кожен екран (SPO-262).
- **Дані й безпека:** нові колекції у rules + тести; ключі non-extractable на боці тренера й менеджера; журнал і notices лише метадані; відкритий `timing` обмежений rules. Прийнятий ризик: компрометація ключа підпису сервера дозволяє додати фальшивого менеджера (пом'якшення поза релізом: відбиток менеджера клієнту, co-sign власника).
- **i18n:** словники `client/src/i18n/coachTeam.{en,uk,pl,lt,et}.ts` (`useTeamT`); пари з `coach.*` не змішуємо. **Offline:** запис менеджера через офлайн-чергу. **A11y:** діалоги/Sheet/Switch з aria.

## План тестів (red/green)

Rules-тести (менеджер читає/пише лише дозволене), crypto-тест делегації (інша розмова/епоха/призначення/ключ відхиляються; видалений менеджер не читає нові записи), тести функцій (`tests/coach-server`), далі сторі + `audit:stories`, `e2e:coach`, перевірка в браузері на синтетичних акаунтах (desktop 1360, phone 390) зі скріншотами. Незалежне рев'ю безпеки (SPO-267).

## Реліз і відкат (SPO-266)

Флага немає. Безпека релізу забезпечена тим, що нові гілки rules відкривають щось лише користувачам з роллю `manager` та активним членством, а ролі `manager` ні в кого немає, поки власник команди не надішле запрошення й людина його не прийме. Команда створюється ледачо (`ensureTeam`, `myTeam`): окремої міграції наявних тренерів немає, повторний виклик безпечний. Spotter: це вигляд над наявними `notices`, окремих записів для наявних користувачів не створюємо.

**Порядок розгортання:**

1. Перед релізом: `npm run lint`, `format:check`, `typecheck`, `test:coverage`, `npm run test:rules` (емулятор, Java 21), `i18n:check`, `deadcode`, `kit-guard`, `audit:stories`, `deps:check`, `npm audit`.
2. Індекси, `firestore.rules`, потім `functions` (hosting не чіпаємо). Старий клієнт працює: нові гілки йому нічого не відкривають і не вимагають.
3. Клієнт (hosting). Індекси (`firestore.indexes.json`, на момент написання ще незакомічені в робочому дереві: `activity` по `actorUid`+`ts`, collection group `requests` по `status`+`createdAt`, field override `push.tz`) деплоїмо **першими** разом з rules і чекаємо кінця побудови, до функцій, які їх використовують; на staging перевірити відсутність помилок індексу.
4. Перевірка на staging з синтетичними акаунтами (власник, тренер-учасник, менеджер, клієнт): запрошення за посиланням, прийняття, делегація після відкриття застосунку клієнтом, «Waiting for client's app», запит на видалення, схвалення, видалення менеджера, ротація епохи, Spotter і push, журнал з `activityScope`. Прод лише читання.
5. Відкат: функції й rules відкочуються окремо; дані (`teams/*`, `delegations`) не торкаються `coaching/*`; видалення команди не торкається клієнтів.

**Перевірено / не перевірено (станом на 21.10.2026):** перевірено unit-тестами: rules-логіка (інтерпретатор), крипто-делегація, більшість `tests/coach-server`. Не перевірено: rules на емуляторі, e2e, браузерний прогін зі скріншотами, живий push, lt/et носієм, незалежне рев'ю безпеки (SPO-267), порівняння з бордами.

**Інструкція для користувачів (зроблено 22.10):** 6 уроків у «Навчанні» (`client/src/learn/catalog.ts`, переклади 4 мов у `catalog.team.i18n.ts`; відео ще не записані, показується «coming soon»): team-add-manager, team-manager-access, team-waiting, team-remove, team-spotter (тренерам), team-privacy (усім). Початковий перелік тем (5 локалей): як додати менеджера (одна кнопка «Add a team member», посилання, 7 днів); що бачить і чого не бачить менеджер; чому «Waiting for client's app» і що робити; як видалити менеджера/вийти; як менеджер просить видалити клієнта (запит тренеру, клієнт не знає); що таке Spotter; що бачить клієнт у «Who saw your data»; політика приватності: сервер бачить час найближчих занять, але не їх вміст.

## Партії (малі, кожна = один коміт)

1. spec + ADR (SPO-260) → AC-контракт
2. Прототип крипто-делегації тестом (SPO-197)
3. Модель даних + rules + тести (SPO-198)
4. Крипто-делегація (SPO-261)
5. Functions (SPO-199) · фікстури/сторі (SPO-262)
6. UI Team → розклад → клієнти (SPO-200/201/202)
7. Видалення/вихід, запити (SPO-239, SPO-204)
8. Журнал і `activityScope` (SPO-203, SPO-238)
9. Spotter, push, scheduler (SPO-236/237/264/265)
10. UI клієнта (SPO-205) · i18n (SPO-263)
11. QA (SPO-206), рев'ю (SPO-267), rollout (SPO-266)

## Посилання команди без акаунта (SPO-284)

Рішення власника: у Spotter немає самореєстрації, акаунт створює тренер/адмін, тому посилання команди акаунт не створює. Людина без сесії бачить на екрані входу примітку: хто запросив і в якій ролі (`teamInvitePublic`: лише `role` і справжнє ім'я запрошувача, без username, e-mail, uid, термінів; будь-яке закрите/невідоме/зіпсоване посилання відповідає однаково `not-found:no-invite`), і підказку «акаунт створює тренер». Після входу посилання лишається в адресі й веде на Join the team. Ризик: виклик без авторизації й ліміту; `maxInstances: 10`, токен 128 біт, зловживання коштує лише читань; App Check — окремий рішення (`COACH_ENFORCE_APPCHECK`).

## Відкриті питання

- Погодження spec користувачем (блокує закриття SPO-260).
- Розбіжності з бордом: рейка менеджера Schedule/Clients/Team (на борді Clients домашній); D29 показує 9 ready, фікстури 11 (власник, до QA SPO-206).
- lt/et переклад потребує перевірки носієм.
