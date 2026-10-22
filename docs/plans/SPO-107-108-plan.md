# SPO-107 + SPO-108 — Детальний план: один блок шерингу, один вхід у «Privacy and sharing»

Статус: **дизайн намальовано, чекає на затвердження власника** (рішення Q1–Q5 прийняті 2026-10-22) · 2026-10-22 · джерела: Linear SPO-107, SPO-108; код (посилання нижче); `docs/plans/SPO-295-dev-plan.md` (фаза 4: «SPO-107/108 до екрана Sharing»); `claude/SPO-295-legal-ux-designs.md`; `.claude/rules/work-order.md`.
Порядок: спайк → **дизайн** → цей план → розробка. **Код не починати, доки власник не затвердить дизайн-дошки з розділу 8 і цей план.** Цей документ — лише docs.
Задачі: SPO-107 (Medium, Backlog, Client/Mobile/Improvement), SPO-108 (Low, Backlog). SPO-108 незалежна й мала; SPO-107 — основна. Обидві стоять перед N5/Sharing у плані SPO-295.

## 1. Поточний стан (код, файл:рядок)

Екран «Privacy and sharing» = `#/health/privacy` = `client/src/views/health/HealthPrivacyView.tsx`. Він складається з ТРЬОХ незалежних шматків, що живуть у різних моделях даних:

| Шматок | Де | Джерело даних | Рівні |
|---|---|---|---|
| A. Блок тренера «Your trainer» (підсумок-картка `What {first} sees`, рядок тренера, «Share with {first}» — 6 категорій, «Who saw what and when», «Stop sharing with {first}») | `client/src/coach/client/screens/TrainerSharing.tsx:68-259`, вставлений у `HealthPrivacyView.tsx:177-184` через `ClientTrainerSharing` (`coach/client/lazy.tsx:29`) | grants тренера на сервері (`ClientCoachPort.setLevel/revoke`, `coach/client/data/store.ts:136-166`); категорії `SHARE_CATEGORIES = totals, sets, body, sleep, injury, nutrition` (`coach/client/domain.ts:9`); `checkins` — не налаштування | усі 3: `off/effects/full` (`coach/domain/types.ts:8-9`), шторка `LevelSheet` (`TrainerSharing.tsx:262-300`) |
| B. Друга картка-підсумок `What your coach would see` | `HealthPrivacyView.tsx:185-205` (рядки `nicPrivSeeHead`, `hlPrivSumEffects/Full/Rest/None`, `en.ts:1646`, `4908-4911`) | лише чотири локальні категорії | — |
| C. Блок «Coach sharing» (Long-term conditions, Nicotine, Alcohol, Supplements) + нотатка `hlPrivCondNote` | `HealthPrivacyView.tsx:206-220`, дані `categories` у `:111-156`, шторка `:251-279` | локальні налаштування, публікуються в `users/{uid}/meta/coachShare` (`store.ts:3057-3105`, `publishCoachShare`) для будь-якого тренера, не через grants | conditions/nicotine/supplements: `off/effects/full`; **alcohol: лише `off/effects`** (`HealthPrivacyView.tsx:142-143`, тест `HealthPrivacyAlcohol.test.tsx:62`) |
| D. «Your data» (червоні Delete nicotine/alcohol/supplements/cycle) | `HealthPrivacyView.tsx:221-248` | — | поза скоупом |

Підказка-посилання «below»: `shFoot` (`coachClient.en.ts:139-140`: «Conditions, nicotine, alcohol and supplements have their own settings below») під блоком A. Порядок на екрані: A-summary → рядок тренера → 6 категорій → Log + Stop → B-summary → C → D. Тобто «підсумок» двічі, а «Stop sharing» посеред екрана.

Додаткові факти, важливі для злиття:
- Цикл не шариться ніколи (`store.ts:391`: «Never shared»); у шерингу його немає, лише рядок видалення (`:240-247`).
- `sharesNothing/sharedCount/levelsBy` (`coach/client/domain.ts:55-60`) рахують лише 6 grants; чотири локальні в них не входять, тож підсумок A каже «sees nothing», коли шеряться лише здоров'я-категорії (розбіжність, яку злиття має прибрати).
- «Stop sharing» = `store.revoke()` → `revokedConsent()` = `ALL_OFF` (`domain.ts:62-63`, `TrainerSharing.tsx:230-233`); **чотири локальні рівні при цьому не змінюються** і далі йдуть у `meta/coachShare`. Undo: `UndoToast` 8 с (`REVOKE_UNDO_MS`, `TrainerSharing.tsx:236-247`).
- Діалог «Stop sharing»: `ConfirmDialog` в один крок (`TrainerSharing.tsx:221-235`; тест `screens.test.tsx:63-72` клікає `shStop` → `shStopConfirm`). `StepConfirmDialog` (`components/ui/StepConfirmDialog.tsx`, 1–3 кроки, `useStepConfirm`) уже є в кіті; використовується в видаленнях (`legal/*`).
- Прецедент зв'язку з health-гейтом: `legal/healthConsentActions.ts:23-52` (`TRAINER_CATEGORY` injuries→`injury`, nutrition→`nutrition`; відкликання health-згоди викликає `setLevel(category,'off')`).
- Форма одноразового запиту доступу (SPO-99) = `components/ui/InvitePanel.tsx:139-240` + `ConsentLevelPicker` (`components/ui/ConsentControls.tsx:67-113`, `Segmented`, завжди 3 рівні, без обмежень по категорії). Ряд `ConsentRowProps` (`ConsentRow.tsx`) — це перемикач згод (Switch), не рівні.
- Вхід «My trainer» (SPO-108): `coach/client/screens/MyTrainerPage.tsx`: кнопка-око `cc.mtSharing` («Sharing settings») у картці `:100-102` + рядок `cc.mtPrivacy` «Privacy and sharing / Change what {first} sees» `:172-178`; обидва → `onSharing` → `go('#/health/privacy')` (`ClientRoutes.tsx:66,94`). Те саме ще у: `Notice` для `link.migrated` з кнопкою `mtSharing` (`MyTrainerPage.tsx:106-119`); `TrainerUnavailable.tsx:40` (кнопка `mtSharing` у картці legacy-тренера, `data-testid="legacy-trainer-card"`); `ClientChat.tsx:284` (`onSharing={p.onOpenSharing}`, чат-кнопка); `AskCard.tsx:29-33` (`onOpenSharing`, посилання в чаті); `ClientRoutes.tsx:82,111`; `HealthView.tsx:395-410` (рядок «Privacy and sharing» з «Coach: mixed», `hlPrivRow`).
- Обірваний рядок: `MyTrainerPage.tsx:93` `cc.invInviterAt(trainer.org)` = «Personal trainer at ${org}» (`coachClient.en.ts:67`) без перевірки порожнього `org` (`coach/client/data/types.ts:16,40`) → «Personal trainer at ». У `InvitePages.tsx` для `inv.org` перевірка є (`inv.org ? … : …`).
- Тести, що зачіпаються: `coach/client/screens/screens.test.tsx` (56-77 блок тренера; 108-124 `getAllByRole('button',{name:t.mtSharing})` для migrated), `coach/CoachProblemState.test.tsx:67` (`mtSharing` у legacy-картці), `views/health/HealthPrivacyView.test.tsx` (52-147: заголовок, summary, рядки, шторка, delete; 149-190 «Health overview»), `views/health/HealthPrivacyAlcohol.test.tsx` (54-140), `views/health/Conditions.test.tsx`, `nicotine/NicotineProducts.test.tsx`, `supplements/Supplements.test.tsx`, `coach/client/ClientRoutes.test.tsx`/`ClientRoutes.real.test.tsx`/`a11y.test.tsx`, сторі `coach/client/Client.stories.tsx:100-106,132`, `components/ui/ConsentControls.stories.tsx`. **e2e (`tests/e2e/*.e2e.ts`) сьогодні шерингу не торкаються**: «оновити e2e» = додати нові.

## 2. Рішення за власника

Q1–Q5 вирішив власник 2026-10-22 (джерело: Projects `claude/SPO-107-108-owner-decisions-2026-10-22.md`). Нумерований список нижче розкриває їх у деталях.

| # | Питання | Рішення | Чому |
|---|---|---|---|
| Q1 | «Stop sharing» також обнуляє чотири локальні рівні? | **Так.** Одна дія «Зупинити шеринг» вимикає все: шість дозвілів тренера і чотири локальні рівні (усі 10). Двокроковий `StepConfirmDialog`, червона дія. | Інакше людина вважає, що шеринг зупинено, а дані тренеру далі йдуть. Це зміна поведінки: перед релізом потрібне ревʼю ризиків. |
| Q2 | Прибрати «Full» для умов, нікотину, добавок? | **Ні, лишаємо Full.** Без «Full» тільки алкоголь. | Прибирання змінює поведінку й вимагає міграції збережених рівнів; виграшу для приватності немає, рівень вибирає сама людина. |
| Q3 | Чи входять чотири локальні категорії у форму разового запиту SPO-99? | **Ні.** Форма лишається на шести категоріях тренера. | Разовий запит стосується конкретних даних; чутливі локальні категорії людина вмикає лише сама в постійному шерингу. |
| Q4 | Кілька тренерів: команда під одним посиланням чи незалежні? | **Незалежні тренери**, у кожного власні дозволи (10 рівнів на тренера). Спільного командного рівня немає. | Збігається з поточною моделлю доступу й SPO-175; командний рівень можна додати пізніше. |
| Q5 | Харчування в «Body» чи «Lifestyle and health»? | **У «Body».** | Те саме групування, що в застосунку: тіло, сон, харчування разом. |


1. **Рівні.** Один набір `Off / Effects only / Full` для всіх категорій, крім чутливих, де `Full` не пропонується. **Адаптація до реальної моделі (перевірено в коді):** `Full` не пропонується лише там, де його немає зараз — **Alcohol** (`Off / Effects only`). Для Long-term conditions, Nicotine, Supplements `Full` уже існує й має зміст (`cndShareHintFull`, `nicPrivSeeFull`, `supPrivSeeFull`), його прибирання = зміна поведінки й даних (збережений `full` довелося б мігрувати), тому в межах «лише UI, без міграцій» його лишаємо. **Цикл не є категорією шерингу** (ніколи не шариться), тож у списку його немає; рядок видалення циклу лишається в «Your data». Відмінність показуємо без другого блоку: у шторці рівнів для обмеженої категорії лише 2 опції + рядок-пояснення `Full is not offered for {category}` (ключ нижче), у рядку списку підпис не змінюється.
2. **Підсумок** `What your coach would see` перестає бути окремою карткою: він стає **заголовком списку** (header `GroupedList`, живе речення «Training effects only: … · Full details: … · Nothing else» під/над списком не дублюється). Один підсумок рахується з усіх 11 категорій (6 grants + 4 локальні + їх рівні), коректний і коли шеряться лише здоров'я-категорії.
3. **Групування:** `Training` = totals, sets; `Body` = body, sleep, nutrition; `Lifestyle and health` = injury, conditions, nicotine, alcohol, supplements. Кожен рядок: іконка-плитка, назва, підпис «що бачить» (`seesText` / локальні `…PrivSee…`), поточний рівень, шеврон → спільна шторка. Підказка «settings below» (`shFoot`) і `hlPrivCondNote` прибрані.
4. **SPO-108: варіант 1.** Видаляємо кнопку-око «Sharing settings» у картці тренера (`MyTrainerPage.tsx:100-102`); лишається одна головна дія `Chat`. Рядок «Privacy and sharing» (`:172-178`) — єдиний вхід. Кнопка чату (`ClientChat.tsx:284`, `AskCard`) лишається — це не дубль, а контекстний перехід з чату.
5. **«Stop sharing»**: червона дія (`ListRow action tone="danger"`) у вторинній секції внизу разом із «Who saw what and when», через `StepConfirmDialog` у **2 кроки**: крок 1 — що зміниться («{first} більше не бачить нові дані; бачене лишається в записах; чат і нотатки лишаються»), крок 2 — підтвердження «Stop sharing». Кількість кроків відповідає правилу «2–3 кроки, де втрата реальна» з SPO-295 (health-дані: 2).
6. **«Personal trainer at»**: показувати рядок лише коли `org.trim()` непорожній; інакше рядок прихований (без підстановки вигаданого тексту).
7. **«Stop sharing» охоплює все, що показано в списку** (Q1: підтверджено власником; у тікеті не було, випливає з об'єднання): гасить і 6 grants, і 4 локальні рівні; Undo (8 с) відновлює обидва набори. Інакше кнопка «Stop sharing» під єдиним списком, де лишаються рівні, була б брехнею. Це зміна поведінки (не даних/шифрування); обов'язкове рев'ю `risk-reviewer` (розділ 7).
8. **Без тренера** (`link.state==='none'`): блок A, дії Log/Stop і заголовок тренера не показуємо; решта списку (health-категорії) лишається як є, підсумок формулюється без імені («Your coach would see…»). Тіло A уже повертає `null` у цьому стані (`TrainerSharing.tsx:85`), тож це збереження, а не нова логіка. Рядок тренера (`since · N of 6`, Active/Waiting/Not shared) — лишається як перший рядок вторинної секції або в заголовку списку (за дошкою дизайну).

## 3. Зміни за компонентами та файлами

Нових патернів у кіті мінімум: використовуємо `GroupedList`, `ListRow`, `IconTile`, `Sheet`, `OptionCard(Grid)`, `StepConfirmDialog`, `UndoToast`, `Notice`. Нове — один спільний рядок/модель.

1. **Спільна модель категорій** `client/src/coach/client/shareModel.ts` (нова, чиста, без React): `ShareRow { id, group, icon, tone, source: 'grant' | 'local', allowedLevels }`, `SHARE_GROUPS`, `allowedLevels(id)` (alcohol `['off','effects']`, решта `LEVELS`), `buildSummary(grants, locals)` → `{ effects: id[], full: id[] }`, `sharesNothingAll()`. Перенести сюди `levelsBy/sharedCount/sharesNothing` з `coach/client/domain.ts:55-60`, розширивши на локальні (старі експорти лишити тонкими обгортками або видалити разом зі споживачами; `npm run deadcode`).
2. **Єдиний компонент** `client/src/coach/client/screens/SharingList.tsx` (нова): список із групами, заголовком-підсумком і вторинною секцією; приймає `grants`, `locals`, `onPick(row, level)`; шторка `LevelSheet` (перенести з `TrainerSharing.tsx:262-300`) отримує `levels?: readonly Level[]` і `note?` (пояснення «Full is not offered»). Рядок локальної категорії читає/пише через існуючі `setConditionsShare/setNicotineSharing/setAlcoholSharing/setSupplementSharing` (`store.ts:3091,3327,3418,3575`), grant-рядок — через `store.setLevel`. Дані й ключі шифрування не змінюються.
3. **Узгодження з формою запиту доступу (SPO-99):** `ConsentLevelPicker` (`ConsentControls.tsx:67`) отримує необов'язкове `allowed?: ConsentLevelId[]` у `ConsentPickerRow` (приховує/вимикає `Full`), джерело істини — `shareModel.allowedLevels`. Рядки форми `InvitePanel.tsx:139` будуються з тієї ж моделі (labels категорій — ті самі ключі). Повний «один компонент рядка» для сторінки (ListRow+шеврон) і форми (Segmented) неможливий без зміни патерну: спільні — **модель, ключі i18n і правило дозволених рівнів**, а не DOM (див. питання Q2).
4. **`HealthPrivacyView.tsx`**: прибрати B (`:185-205`) і C (`:206-220`) та шторку `:251-279`, `sentence/listNodes` (`:67-98`, перенести у `SharingList`/спільний утиліт-файл), `categories`/`label`/`names` (`:111-166`); лишити `PageHead`, `SharingList`, «Your data» (D) і діалоги видалення. Файл суттєво скорочується.
5. **`TrainerSharing.tsx`**: стає «ліниво завантаженою» обгорткою над `SharingList` (зберегти `lazy.tsx` і фічефлаг `useClientCoachEnabled`; без флага блок тренера не показується, але список локальних категорій показується завжди — тому `HealthPrivacyView` має рендерити `SharingList` сам, а `TrainerSharing` лише постачає grants/дії; уточнити під час реалізації, не змінюючи поведінку флага). Видалити `Card` підсумку (`:96-122`), `shFoot`.
6. **`MyTrainerPage.tsx`**: видалити `Button` `mtSharing` у `cc-hero-b` (`:100-102`); рядок `:93` — умовний рендер за `trainer.org.trim()`. Перевірити CSS `cc-hero-b` (одна кнопка: ширина/вирівнювання — через кіт, без оверрайдів).
7. **Інші входи (аудит AC SPO-108):** `TrainerUnavailable.tsx:40` — це єдина дія legacy-картки без рядка в списку: лишається (немає дубля); `MyTrainerPage` migrated-`Notice` (`:106-119`) має кнопку `mtSharing` при рядку `mtPrivacy` нижче → прибрати кнопку з Notice, текст нотатки `mtMigratedNote` лишити (рядок-вхід нижче). Профіль/`HealthView.tsx:395-410` — один рядок, дубля немає. Чат: `ClientChat.tsx:284`/`AskCard` — лишаються.
8. **Stop sharing:** новий `StopSharingDialog` на `StepConfirmDialog` (2 кроки, `progressLabel`), у вторинній секції; `store.revoke()` розширити викликом локальних `set…(... 'off')` та відкладеним відновленням при Undo (зберегти попередні локальні рівні в `undo.previous`, `coach/client/data/store.ts:155-165,closeUndo`). Прецедент: `healthConsentActions.ts:stopTrainerShare`.

## 4. i18n (en, uk, pl, lt, et — усі п'ять одразу)

Нові/змінені ключі (`coachClient.*.ts`, паритет перевіряє `coachClient.test.ts`, `npm run i18n:check`, бюджети довжини `tests/i18n-length.test.ts` — переклади скорочувати, бюджет не піднімати):
- Групи: `shGroupTraining` «Training», `shGroupBody` «Body», `shGroupLifestyle` «Lifestyle and health».
- Заголовок-підсумок: перевикористати `hlPrivSumEffects/Full/Rest/None` (`en.ts:4908-4911`) + варіант з ім'ям `shSees(first)`; ключ для режиму без тренера `shSeesNoTrainer`.
- Обмежений рівень: `shFullNotOffered: (cat) => 'Full is not offered for {cat}.'`.
- Stop sharing 2 кроки: `shStopStep1Title/Body`, `shStopStep2Title/Body`, `shStopConfirm` (є), `shKeep` (є), `shStopProgress: (i, n) => 'Step {i} of {n}'`.
- Видалити після рефакторингу: `shFoot`, `mtSharing` (якщо жоден споживач не лишився; `TrainerUnavailable` ще використовує — тоді лишається), `hlPrivCondNote`, `nicPrivSeeHead` (якщо немає споживачів), `shYourTrainer` — за результатом `rg`.
- Локальні категорії беруть підписи з наявних ключів (`cndShareHint*`, `nicPrivSee*`, `alcPrivSeeEffects`, `supPrivSee*`); у `coach` назви — `catTitle`.
- Тексти макетів з дизайн-лабораторії — джерело правди після затвердження; машинні uk/pl/lt/et позначити у `legal/pending.ts`-стилі «needs review» лише для нових рядків.

## 5. Взаємодія зі згодами та health-гейтом (SPO-290, healthConsent)

- Рядок категорії, чия health-функція вимкнена (`healthSnapshot().on[feature] === false`, `data/healthConsentGate.ts`): injury↔`injuries`, nutrition↔`nutrition`, conditions↔`chronic`, nicotine/alcohol/supplements↔однойменні. Стан: рівень НЕ показуємо (стор віддає порожній вигляд, `healthMask.ts`), значення рядка — «Feature is off»; тап відкриває `openHealthPrompt(feature)`, а не шторку рівнів (не можна «поділитися» тим, чого не збираємо). У підсумку такі категорії не рахуються.
- Поки згоди невідомі (`ready === false`) — fail closed: рядки health-категорій у skeleton/disabled, підсумок не показує їх (як `publishCoachShare` не публікує, `store.ts:3057`).
- Відкликання health-згоди й надалі гасить grant (`stopTrainerShare`); новий список лише відображає (рівень → Off) без нового запису.
- Запис у `consentLog` (історія згод на доступ тренера) — той самий `setLevel`; нових `consentRecords` не вводимо (`Q: чи потрібен окремий запис для 4 локальних`, див. розділ 9).
- Реєстр даних/політика: змін обробки немає (лише UI + гасіння локальних рівнів при Stop sharing) → D1/D3/D8/D19 без змін; перевірити `tests/compliance-sync.guard.test.ts`. Якщо рішення 7 схвалене, у `docs/compliance/data-registry.md` уточнити, що «Stop sharing» гасить і `meta/coachShare`.
- Shape даних і rules не змінюються (`firestore.rules`, `meta/coachShare`, grants).

## 6. Тести

Підзадача Linear «Тести: SPO-107/108 — злитий блок шерингу та вхід My trainer» (за матрицею SPO-46/51/57–66/206).

**Unit/компонентні (оновити):**
- `screens.test.tsx:56-77`: Stop sharing — тепер 2 кроки (`shStopStep…`), Undo відновлює grants і локальні; `:108-124` migrated: кнопка `mtSharing` лише в `Notice` більше немає → клікаємо рядок `mtPrivacy`; додати «картка тренера має рівно одну кнопку Chat».
- `CoachProblemState.test.tsx:67`: legacy-картка лишає `mtSharing` (дубля немає) — тест лишається, додати коментар-обґрунтування.
- `HealthPrivacyView.test.tsx` і `HealthPrivacyAlcohol.test.tsx`: summary тепер заголовок списку (немає окремої `Card`), групи Training/Body/Lifestyle, alcohol-шторка 2 опції + пояснення, `conditions` carry note прибрано (оновити тест «override note» на рядок без підказки), health-overview тести (`:149-190`) без змін.
- Нові: `shareModel.test.ts` (allowedLevels, buildSummary для 11 категорій, «only local shared» ≠ «nothing»), `MyTrainerPage` (org порожній → немає «Personal trainer at»; org є → є), `SharingList.test.tsx` (gate off → «Feature is off» + prompt; no-trainer; waiting; none), `ConsentLevelPicker` з `allowed`, інваріант «Stop sharing гасить усе», `a11y.test.tsx` (імена `aria-label` рядків, фокус, шторка).
- Сторі: `Client.stories.tsx` (TrainerSharing → SharingList сторі: active/waiting/none/no-trainer/gate-off/alcohol-sheet/stop-step1/2), `ConsentControls.stories.tsx` (allowed). Аудит `npm run audit:stories` по змінених сторі.
- Guard: `tests/kit-guard.test.ts`, `hygiene-ratchet.guard.test.ts` (файли ≤600 рядків — `HealthPrivacyView` зменшується), `npm run deadcode`, `npm run deps:check`, `i18n:check`.

**e2e (нові, Playwright; сьогодні шерингу не покривають):** `tests/e2e/privacy-sharing.e2e.ts` — клієнт з тренером: (1) My trainer має один вхід у Privacy and sharing і одну дію Chat; (2) змінити рівень у кожній із трьох груп → підсумок оновився одразу; (3) alcohol: у шторці немає Full; (4) Stop sharing: крок 1 → крок 2 → підсумок «sees nothing» → Undo повертає; (5) health-функція вимкнена → рядок «Feature is off». Матриця: ширини **320 / 390 / 1440** × локалі **en, uk, pl, lt, et** (повна матриця у нічному/ручному `layout`; у PR — en, push у main — en,uk,pl, ADR 004), сценарії «один тренер» і «команда» (`useClientTeam`; Q4). Додати `privacy-sharing` до `audit:*` геометрії (без горизонтального скролу, зони торкання ≥44 px, рядок не обрізається у pl/lt/et).
- Перевірка в браузері зі скріншотами по кожному AC обох задач (skill `verify-in-browser`).

**Швидкість (гейт DoD):** нові unit-тести — у наявні vitest-файли/пулі; новий e2e — у наявний job `e2e` (не окремий послідовний крок); геометричний аудит — у шардований `layout` (`--part/--out`), не нова послідовна перевірка. Очікування: pre-push ≤ 2 хв, CI ≤ 5 хв (job ≤ 4 хв), нова перевірка в pre-push ≤ 30 с (лише `shareModel`/`SharingList` unit); матрицю не скорочувати. У звіті рядок «швидкість».

## 7. Ризики

1. **Stop sharing і локальні рівні** (рішення 7): зміна поведінки на межі приватності; Undo має відновити обидва набори, офлайн-черга не губить; `risk-reviewer` обов'язково. Якщо власник відхилить — кнопка має чесно називатись «Stop sharing with trainer» і підсумок мусить показувати, що локальні категорії лишились (дизайн-розвилка, Q1).
2. Дві моделі даних під одним списком: помилка запису grant не повинна відкочувати локальні й навпаки; оптимістичне оновлення `store.setLevel` (`:136-153`) vs синхронні локальні сеттери.
3. Фічефлаг `useClientCoachEnabled` вимкнений → не показуємо grant-рядки, локальні лишаються (не зламати користувачів без тренера).
4. Довжина текстів pl/lt/et (підпис + рівень + шеврон у 320 px): бюджети `i18n-length`, рядок із двома рядками підпису допустимий лише в межах 44px мінімуму висоти.
5. Скорочення `HealthPrivacyView` зачепить тести health-хабів (nicotine/alcohol/supplements): виконати `rg` споживачів `hlPriv*`, `nicPrivShare`.
6. Гонка з SPO-295 N5 (сторінка «Sharing» у My data, `AreaPage.tsx`): її тексти мають посилатися на новий список; не зливати в одному PR.
7. Тренерська сторона: `Client360Overview` (`ConsentChips`) показує лише 6 grants + локальні через `coachShare` — розбіжність мови (рівні/групи) між клієнтом і тренером; дизайн-нотатка для People (розділ 8), реалізація — окремо.

## 8. DESIGN BRIEF — дошки для дизайн-лабораторії (`client/design-lab/variants/…`, реальні рендери сторінок і кіту)

Правило: справжні сторінки (`HealthPrivacyView`, `MyTrainerPage`) + кіт; нове без аналога (`SharingList`, шторка з обмеженням) — спершу шард кіту, потім вбудовування. Ширини: телефон 390 (+ 320 для найвужчих станів), десктоп 1440. Мова en (+ uk та pl як стрес довжини для дошки 1).

**Дошка 1 — Privacy and sharing, об'єднаний блок (бік члена/клієнта).** Стани:
a) active, тренер, змішані рівні (Training: Full/Full; Body: Effects/Off/Off; Lifestyle: Off/Effects/Off/Off/Effects), заголовок-підсумок «Training: Full… · Effects only… · Nothing else», вторинна секція (рядок «Who saw what and when» + червоний «Stop sharing»);
b) waiting (Notice + підсумок «will see once sharing is on»);
c) none/revoked (Notice «Start sharing», підсумок «sees nothing», без Stop sharing);
d) no trainer (без імені, без Log/Stop);
e) health-функція вимкнена (рядок «Feature is off» + тап → prompt);
f) шторка рівнів: 3 опції (звичайна категорія) і 2 опції + «Full is not offered» (Alcohol);
g) 320 px і pl (найдовші підписи) для a;
h) skeleton/loading (`SkeletonRows`).
Показати: порядок груп, чи підсумок над списком (як header), позиція «Your data» (червоні Delete…) нижче вторинної секції.

**Дошка 2 — «Stop sharing»: підтвердження у 2 кроки (`StepConfirmDialog`).** Крок 1, крок 2, Undo-тост «Sharing stopped» + стан після (підсумок «sees nothing», усі рівні Off). Телефон і десктоп; варіант тексту «що саме вимикається» перелічує групи (з рішенням 7) — і альтернатива, якщо власник відхилить рішення 7 (Q1).

**Дошка 3 — My trainer, один вхід (SPO-108).** Картка тренера з однією дією Chat; рядок «Privacy and sharing / Change what {first} sees» у списку; стани: звичайний, migrated (Notice без кнопки), без залу (`org` порожній — рядок «Personal trainer at» відсутній), org є, кілька тренерів/команда, тренер без чату, legacy-картка (`TrainerUnavailable`) з її єдиною кнопкою.

**Дошка 4 — Тренерська сторона, примітка (People view).** Лише нотатка/макет-накладка: як `Client360Overview` (`ConsentChips`) відображає ті самі групи та 11 категорій і «Full is not offered»; People-додаток у лабораторії не рендериться (B4 у SPO-295) — дошка малюється на member Today з підписом, реалізація тренерського боку не входить у SPO-107/108.

**Дошка 5 — Форма запиту доступу (SPO-99), узгодження.** Те саме правило рівнів (Alcohol без Full) у `ConsentLevelPicker`; без нових екранів — лише стан «обмежена категорія».

Критерії затвердження дизайну: власник підтверджує групування, місце підсумку та текст Stop sharing (Q1–Q5 вже вирішені).

**Статус дизайну: намальовано, чекає на затвердження власника (2026-10-22).** Дошки в канвасі «Spotter legal UX» (https://claude.ai/artifact/67U6cetincVsaQWJQ9APMt), реальні сторінки й кіт у лабораторії; десктоп 1280 і телефон 390:

| Дошка | Назва в канвасі | Що показує |
|---|---|---|
| 43 | Privacy and sharing: one list for all ten settings | один блок: some / nothing / all, один підсумок, три групи, «Who saw what and when» + червоний Stop sharing, «Your data» внизу, «Feature is off» |
| 44 | Several trainers and the level sheet | перемикач тренерів (незалежні дозволи), шторка рівнів на 3 опції і на 2 (Alcohol, «Full is not offered») |
| 45 | Stop sharing: two steps | крок 1, крок 2, стан після з Undo-тостом |
| 46 | My trainer: one way into sharing | поточна сторінка для порівняння; одна дія Chat; без `org`; migrated без кнопки |
| 47 | Request form: six categories (SPO-99) | форма запиту на шести категоріях, без змін поведінки |
| 48 | Trainer side (People): note | лише текст: ті самі групи й 10 категорій на боці тренера |

Допущення дизайну, які власник може змінити: рядок вимкненої функції має підпис «Feature is off» + «Not collected, so nothing to share» (чернетка тексту); три рядки ефектів кроку 1 і текст кроку 2 «Stop sharing» — чернетки англійською; форма SPO-99 у дошці без категорії «Check-in answers» (у поточному коді історій їх сім), бо Q3 каже «шість». Дошка 48 не малює сторону тренера (People не рендериться в лабораторії).

## 9. Питання власнику: закриті 2026-10-22

Усі п'ять питань закрито, відповіді в таблиці розділу 2 (Q1–Q5). Відкритих питань немає. Лишається затвердити дизайн-дошки (нижче) і цей план.

Наслідки для реалізації:
- Q1: дизайн дошки 45 малює кроки «усі 10 вимикаються»; альтернативу «лише гранти» прибрано.
- Q2: `Full` лишається для conditions/nicotine/supplements; обмеження тільки для alcohol (дошка 44, листок рівнів).
- Q3: `ConsentLevelPicker.allowed` та зміни `InvitePanel` для SPO-99 **не потрібні**: форма вже на шести категоріях (дошка 47). Етап 5 у розділі 10 скасовано, лишається лише перевірка, що форма не отримала локальних категорій.
- Q4: у блоці шерингу вибір тренера (дошка 44), 10 рівнів на тренера; жодного спільного командного рівня.
- Q5: `nutrition` у групі Body (дошки 43, 44).

## 10. Порядок і критерії готовності

| Етап | Що | Блокує | Критерій готовності | Перевірка |
|---|---|---|---|---|
| 0 | Затвердження дошок 43–48 (дизайн-лабораторія) і цього плану | усе | Q1–Q5 вже вирішені; лишається затвердити дизайн | коментар у SPO-107 |
| 1 (SPO-108, паралельно, окремий агент: `MyTrainerPage.tsx`, `ClientRoutes`-тести, i18n лише видалення) | один вхід, `org` умовно | — | AC SPO-108 [x]: один вхід, одна дія Chat, стани, 320/390/1440 × 5 локалей, інші входи перевірені, e2e оновлені | браузер зі скріншотами, тести |
| 2 | `shareModel.ts` + unit | 3 | модель покрита тестами | vitest |
| 3 | `SharingList` + шторка + перенесення з `HealthPrivacyView`/`TrainerSharing` (один агент; спільні файли i18n і `styles` править один) | 4 | AC SPO-107: один блок, однакові рівні, один підсумок, поведінка збережена | сторі + браузер |
| 4 | Stop sharing 2 кроки + розширений revoke/undo | рев'ю | `risk-reviewer` без зауважень | тести + рев'ю |
| 5 | ~~`ConsentLevelPicker.allowed` + `InvitePanel`~~ скасовано (Q3): форма SPO-99 лишається на шести категоріях | — | AC «узгоджено з SPO-99»: форма не отримала локальних категорій | сторі, тест |
| 6 | e2e + геометричні аудити, швидкість | закриття | матриця пройдена; рядок «швидкість» | CI |

Спільні файли (`coachClient.*.ts`, `en.ts`, `styles.css`) змінює один виконавець. cpd — лише на прохання. Кожен AC обох задач закривається з доказом (`work-issue`); AC не змінюємо.

## 11. Трасування (скорочено)

| Джерело | Дошка | Задача | AC |
|---|---|---|---|
| SPO-107 «два блоки → один» | 1 | SPO-107 | усі категорії в одному блоці, без «below» |
| SPO-107 відкрите питання про рівні | 1f | SPO-107 | однаково для всіх; обмеження alcohol показано без другого блоку |
| SPO-107 «підсумок» | 1a–d | SPO-107 | один підсумок для всіх категорій |
| SPO-107 «Who saw / Stop sharing — вторинна секція, деструктивна» | 1, 2 | SPO-107 | поведінка збережена; Stop sharing червоний, 2 кроки |
| SPO-107 «спільний компонент з SPO-99» | 5 | SPO-107 | `ConsentLevelPicker.allowed` + спільна модель |
| SPO-108 варіант 1 | 3 | SPO-108 | один вхід, одна дія Chat |
| SPO-108 «Personal trainer at» | 3 | SPO-108 | рядок прихований без залу |
| Власник 21.10 (SPO-295 B4: немає дошки Stop sharing) | 2, 4 | SPO-107 | дошки намальовані до коду |
