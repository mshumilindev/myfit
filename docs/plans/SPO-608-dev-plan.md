# SPO-608: Risk assessment і детальний план розробки (27.11.2026)

Статус: дизайн затверджено власником 26.11 (M9–M11/D9–D11 на канвасі). Код не почато. Власник 26.11 22:23: відкриті питання вирішую сам за best practices. Порядок за `work-order.md`: оцінка ризиків → план → розробка (SPO-610–615) → тести (SPO-616) → SPO-617. Одна задача Linear (SPO-608), підзадач немає.

## 0. Рішення по відкритих питаннях (best practices)

| № | Питання | Рішення | Чому |
| --- | --- | --- | --- |
| D1 | Що бачить тренер про результат блоку | Лише читання, у Workouts › розгорнута сесія клієнта (картка `Recap`). На Overview блок рахується як сесія, нової картки немає | Не вводимо нових екранів і категорій; результат блоку = частина запису сесії (нова згода не потрібна) |
| D2 | Cancel/Log на drill-екранах Exercise/Session | Немає: лише Back, Delete, nudge | Дії Cancel/Log належать сету; на drill-екрані нічого не редагується «чернеткою», кожна дія застосовується одразу |
| D3 | Довжина підписів типів сету у 5 локалях | Короткі W, WU, Drop, RD, SD з `aria-label` і підказкою; довжини перевіряє `audit:stories` + `i18n:check`, матрицю не скорочуємо | Інваріант 5 і ADR 004 |
| D4 | `blockV` | Варіант A: rules блокують запис старим клієнтом (як `cycleV`) | Дані тренера не стираємо мовчки (SPO-606 п. 7.1) |
| D5 | Skip в Effort | Немає клітинки Skip; повторний тап по обраному RPE знімає значення; 6–10 + F в сітці | Корінь: 7 рівних колонок `.se-rpe:has(.rpe-f)` |
| D6 | Plate stack | Малюнок дисків виводиться з ваги й грифа, не статичний; рядок лише для штангових (як зараз `isBarbell`) | Без нових даних про диски залу |
| D7 | Виняток nudge-рядка | Рядок «Advanced training» у базовому застосунку — свідомий виняток із `addons.md` (10.11, «без підказок встановити») за прямим рішенням власника | Записати в `addons.md` |
| D8 | Store-kit у шторці застосунку | Дозволено лише для nudge-рядка (`SkRow`), у темному режимі `sk-dark` мапиться на режим застосунку | Інакше новий примітив кіту |

## 1. Інвентар зачепленого (rg 27.11)

| Місце | Як зачеплене | Хто читає далі | Ризик | Що перевірить |
| --- | --- | --- | --- | --- |
| `views/SessionView.tsx` (`opts-sheet`, `SetEditorSheet`, `renderExerciseOptions/SessionOptions`) | Прибираємо `Segmented` табів; Other settings усередині More; drill-екрани Exercise/Session; Set type компактний; plate row | `SessionView.{options,more,circuit,dismiss}.cases.test.tsx`, `tests/ui.test.tsx`, `components/HoldWatchSet.cases.test.tsx` | High | Оновлені cases-тести, e2e, скріни 390/1280 |
| `styles.css` `.opts-*` (34 правила), `.se-rpe*` (8), `redesign.css` | Нові класи шторки, сітка RPE без Skip | Лише SessionView (rg: клас не вживається поза ним) | Medium | `audit:stories`, візуальний прогін 5 локалей |
| `setTypeOf(s)` (45 файлів: store, setMath, volume/втома, Today, Atlas, periodization, playbook, challenges) | **Не змінюємо** значення й семантику; змінюється лише UI вибору | Усі споживачі | Low (інваріант 8) | Існуючі `store.test`, `setTypesApi.test`, `warmupLog.test` зелені без змін |
| `setSDShort` / підписи типів (`i18n/*.ts`, `SessionView.tsx:2390`, `TraineeSessionView.tsx:44`) | Додаємо W/WU/Drop/RD короткі ключі | `TraineeSessionView.cases.test.tsx:174` (порядок підписів) | Medium | `i18n:check`, оновлений assert (не послаблений) |
| `components/PlateSheet.tsx` + рядок plates | Рядок у More лишається, малюнок дисків динамічний | `PlateSheet.cases.test.tsx` | Low | Тест плит |
| UI-кіт: `Segmented`, `ListRow`, `BackButton`, `Banner` | Використовуємо як є; нові примітиви: згортна група (More/Other settings), `PinnedHeader` шторки (за потреби), `BlockBuilder/BlockCard/BlockTimer/BlockReady/BlockResult/BlockActuals` (SPO-610–615) | 82 файли імпортують Segmented/ListRow/BackButton | High (shared kit) | `tests/kit-guard.test.ts`, `hygiene-ratchet`, stories, `docs/UI-KIT.md` |
| Store-kit `SkRow` у шторці (addonStore) | Використання поза стором | `addonStore/*` | Medium | Дев-мапа dark, скрін dark |
| Аддони: `addons/manifest.ts`, `exclusion.ts`, `featureGates.ts`, `useAddonRuntime.ts` | Модуль `time-blocks` ще не існує (rg) → запис у маніфест, exclusion, gate | `exclusion.contract.test`, `boundary.contract.test` | High | Контрактні тести |
| `restTimer.ts` + 6 споживачів, `volume.ts`, `recovery.ts`, `picker.ts`, `sessionBuilder.ts`, `challenges.ts`, Today widgets, `SessionMuscleMap` | Читають conditioning лише через одну обгортку на джерелі | Today/Atlas | High (формули) | Golden-значення без модуля = ±0 |
| `programs/modelTypes.ts` `ProgramItem` (+`block`, `repScheme`), `programCsv.ts`, `trainLikeAPro/entryToProgram.ts` | Необовʼязкові поля | Редактор, сторінка програми, Start, CSV | Medium | Тест «старі програми валідні» |
| `firestore.rules` (`cycleV` аналог `blockV`) | D4 | Старий клієнт | High (rules) | `npm run test:rules` |
| `coach/*` Workouts history, `TraineeSessionView.tsx` | Read-only `Recap` | Тренер | Medium | Coach e2e (`e2e:coach`), `TraineeSessionView.cases.test` |
| Реєстр даних R68, `dataRegistry`, `addonExport`, `deviceWipe`, `recursiveDelete` | Результат блоку | DSAR, видалення | Medium | guard-тест повноти, тест каскаду |
| `docs/UI-KIT.md`, `addons.md` (виняток D7), `docs/compliance/data-registry.md` | Записи | — | Low | `kit-guard` |

## 2. Чекліст категорій

- **Дані:** зачеплено лише для time-blocks (`block`/`repScheme` у запечатаній програмі, результат блоку в запечатаній сесії, R68). Set options: даних немає.
- **Формули (інв. 8):** не змінюємо; conditioning окремий рядок; нейтральне ±0 без модуля. Зачеплено споживачами (див. вище).
- **Ролі:** member редагує; trainer/manager бачать read-only; нутріціолог/admin не зачеплені. Нова згода не потрібна (результат = частина сесії).
- **Аддони:** set-types/effort/equipment/supersets/circuit/time-blocks: усі рядки шторки за гейтами; без аддона рядка немає (виняток лише nudge D7).
- **Офлайн/ідемпотентність:** клієнтські id результату; таймер з timestamps; офлайн норма.
- **UI:** світла/темна/нічна, акценти, 390/1280, 5 локалей, довгі рядки, a11y (фокус drill-екранів, `aria-label` на скороченнях, клавіатура), reduced-motion.
- **Продуктивність:** time-blocks лінивий чанк; шторка не додає ререндерів (мемо); час CI/pre-push міряти до закриття.
- **Юридичне:** R68, Privacy Policy `editorial` (категорія в межах сесій), без нової згоди; `categoryRegistry` — запису не треба (немає окремого consent/sharing).
- **Збірки:** PWA, Storybook (нові сторі), Electron без змін.

## 3. Реєстр ризиків

| № | Ризик | P | I | Мітигація | Як виявимо |
| --- | --- | --- | --- | --- | --- |
| R1 | Прибрання табів ламає наявні cases-тести й e2e (шлях до Exercise/Session) | H | M | Оновити тести під нову навігацію, нічого не скіпати; додати тест «усі колишні дії досяжні» | `SessionView.*.cases.test`, `tests/ui.test.tsx`, `test:e2e` |
| R2 | Скрита дія: функція, яка була на вкладці, стає недосяжною | M | H | Таблиця «колишня дія → нове місце» у плані (п. 5), тест по кожній | Тест-матриця |
| R3 | Зміна Set type UI змінює `setTypeOf`/обсяг/втому | L | H | Не чіпати модель; тести golden без змін | `store.test`, `setTypesApi.test`, Atlas/Today тести |
| R4 | Skip-фікс: повторний тап очищає RPE; авто-оцінка (~RPE) | M | M | Тест: тап на обране = null, збереження без RPE, авто-підказка | Новий тест + 5 локалей скрін |
| R5 | Довгі підписи (uk/pl/lt/et) ламають сітку RPE/чіпів/рядків | H | M | Короткі ключі + `aria-label`; аудит геометрії | `audit:stories` по змінених сторі, 5 локалей |
| R6 | Store-kit у шторці: стилі/dark не збігаються з застосунком | M | M | `sk-dark` ↔ режим застосунку; один компонент `NudgeRow` | Скріни світла/темна/нічна |
| R7 | Нові kit-примітиви дублюють наявне | M | M | Спершу `rg`, перевикористання; запис у UI-KIT.md | `kit-guard`, `hygiene-ratchet` |
| R8 | Plate stack показує неправильні диски | M | L | Виведення з ваги/грифа; unit-тест | Тест розкладу |
| R9 | `blockV`/rules: старий клієнт стирає block | M | H | Варіант A + rules-тест | `test:rules` |
| R10 | Conditioning просочується у LANDMARKS/втому/Today при вимкненому модулі | M | H | Одна обгортка на джерелі; golden ±0 | Тести виключення (`exclusion.contract`, тести споживачів) |
| R11 | Модуль у ядрі імпортується не динамічно (межа) | L | M | Лише `useAddonRuntime` | `boundary.contract.test` |
| R12 | Порушення `addons.md` (nudge) у розрахункових екранах | L | M | Лише базовий застосунок, у шторці сету, рішення D7 записано | Ревʼю + скрін аддон встановлено/ні |
| R13 | Тренер бачить блок без модуля | M | L | Показ як вправи по порядку | Coach тест/скрін |
| R14 | Експорт/видалення не покривають R68 | M | M | Реєстр, `dataRegistry`, каскад | guard-тести |
| R15 | Час CI/pre-push виріс | M | L | Нові сторі шардуються; заміри | Лог CI |

## 4. План регресії

(а) Базова лінія (до змін, зелена): `cd client && npx vitest run src/views/SessionView src/setTypesApi.test.ts src/store.test.ts src/views/TraineeSessionView.cases.test.tsx src/components/PlateSheet.cases.test.tsx src/addons`, `tests/kit-guard.test.ts`, `tests/hygiene-ratchet.guard.test.ts`, `npm run i18n:check`, `typecheck`, `lint`; baseline прогнати перед першим комітом коду й записати результат.
(б) Не змінюється: `setTypeOf`, обсяг, RPE-знижка, таймер відпочинку, LANDMARKS, Today-індекси, Atlas-відповіді.
(в) Нові тести: R1–R5, R8–R10, R13–R14 (див. блок «Тести»).
(г) Браузер: localhost власника кожного кроку (правило 10.11), скріни світла/темна, 390/1280, en+uk.

## 5. Трасування (дизайн → задача → AC)

| Дизайн (дошка) | Задача | Код | AC |
| --- | --- | --- | --- |
| M9/D9 This set (без табів), pinned header/Cancel-Log/сепаратор | SPO-613 (Set options) | `SessionView.tsx` opts-sheet, `styles.css` | AC-S1: усі колишні дії досяжні |
| M9/D9 More + Other settings | SPO-613 | згортна група (kit) | AC-S2 |
| M9/D9 Exercise/Session drill (Back) | SPO-613 | `renderExerciseOptions/SessionOptions` | AC-S3 |
| M7/M8 Effort без Skip | SPO-613 | `.se-rpe` | AC-S4 |
| Set type компактний (W/WU/Drop/RD/SD) | SPO-613 | i18n 5 локалей | AC-S5 |
| Plates рядок + малюнок дисків | SPO-613 | PlateSheet, `PlatesLine` | AC-S6 |
| M10/D10 dark | SPO-613 | `sk-dark` мапа | AC-S7 |
| Builder AMRAP/EMOM/forTime/інтервали (M5/D5) | SPO-610/611 | `timeBlocks/` | AC-B1 |
| Exercise→block flow (M6/D6) | SPO-611 | | AC-B2 |
| Блокова сесія: таймер/Ready/Result (M11) | SPO-612/614 | | AC-B3 |
| Trainer Workouts Recap (M11) | SPO-615 | `coach/*` | AC-B4 |
| Nudge «Advanced training» | SPO-613 | | AC-S8 |

Кожен рядок плану = одиниця прогресу (14 одиниць у цьому плані).

## 6. Порядок і залежності

1. Baseline (зелена) → 2. Skip-фікс + Set type + More/Other settings + drill-екрани (SPO-613, один агент на `SessionView.tsx`/`styles.css`; i18n правлю сам) → 3. kit-шард згортної групи (спершу з сторі, затвердження власником на localhost) → 4. модуль `time-blocks`: маніфест/exclusion/gate/boot (SPO-610) → 5. модель й редактор (SPO-611) → 6. сесійний таймер/результат (SPO-612/614) → 7. coach Recap (SPO-615) → 8. rules `blockV` + R68 + експорт/видалення → 9. тести (SPO-616) → 10. імпорт каталогу (SPO-617). Спільні файли (`styles.css`, i18n, `package.json`) править один.

## 7. Дані, безпека, юридичне

Нових колекцій немає. `block`/`repScheme` у запечатаній програмі; результат у запечатаній сесії (`prepareWrite`/`sealDoc`). R68 у реєстрі, `dataRegistry`, `addonExport`, `deviceWipe`. Privacy Policy: `editorial`, версію не піднімаємо без нової категорії (перевірити чеклист `consent-vs-policy.md` §2). Свідомі винятки (D7, D8) записати в `addons.md` і `docs/UI-KIT.md`.

## 8. i18n

Ключі: Other settings, Exercise, Session, Back-підписи, Set type короткі/повні/hints, Effort hint, Plates, nudge-рядок, блокові рядки. Усі 5 локалей; uk/pl/lt/et юридичного змісту не мають, проте lt/et вичитка носієм бажана для UI.

## 9. Блок «Тести» (матриця SPO-46/51/57–66/206)

Unit: Skip-очищення, plate-розклад, `blockV`, гейт без модуля (нейтральні значення). Інтеграційні (`SessionView.*.cases`): досяжність дій, drill Back, Set type вибір. Rules: `blockV`. Kit: сторі + `kit-guard`. Геометрія: `audit:stories` (en на PR, усі локалі вночі). e2e/coach e2e: сесія з блоком, Recap. Доступність: фокус Back, aria-label скорочень. Продуктивність: час сторі-аудиту.

## 10. Відкриті ризики, що лишаються на ревʼю

Див. §3 R2, R9, R10 (High) — `risk-reviewer` перевіряє оцінку до коду.

## 11. Ревʼю `risk-reviewer` (до коду) і доповнення оцінки

Незалежне ревʼю знайшло прогалини; усі прийняті, місця додано до інвентарю. R68 вільний (rg по `data-registry.md`: останній R67).

**Додаткові зачеплені місця.**
- Коуч-кодек програм: `coach/program/planCodec.ts:243` (`cycleV`), `views/programs/model.ts:99,366`; dataLoss/parity-контракти `coach/data/firestore/{dataLoss.program,dataLoss.shared,dataLoss.editor,parity}.test.ts`, `parity/programGen.ts`, `coach/program/__fixtures__/fixtures.ts`, `AssignmentCard.cycle.test.ts`, `coach/client/Client.stories.tsx`. Потрібен round-trip тест `block` через `sealOrThrow/openSealed`.
- Rules-тести: `tests/rules/adversarial.rules.test.ts:768-809` (5 сценаріїв `cycleV`) → той самий набір для `blockV` + комбінація `blockV`+`cycleV` (`firestore.rules:229-235`).
- Тести/скрипти шторки: `tests/ui.test.tsx:847,857,1068,1084`, `SessionView.options.cases.test.tsx:122-123` (`.opts-title/.opts-sub`), `scripts/visual-qa.mjs:1310,1324`, `stories/chronic/flow.tsx:515`, e2e `session-images`, `offline-session`, `edge-back-swipe`, `layout-shift-screens`, `locale-screens`, `docs/design/brass-glass/src/fidelity/P04.md`.
- `SessionView.tsx` ~3962-4188 (`opts-group-label/opts-move/opts-quick/opts-rows`), ~5665 (`Sheet.opts-sheet`); доля прапора `tabs`; ключі `optsGroupChange/optsGroupLookUp` стають мертвими → видалити з 5 локалей (`deadcode`, `i18n:check`).
- `.rpe-f/.se-rpe` також у `redesign.css`; `hygiene-baseline` лише вниз.
- Споживачі LANDMARKS/навантаження: `fatigue.ts`, `fatigue/MuscleStatePanel.tsx`, `weakpoints.ts`, `personalize.ts`, `ProgressView`, `GoalsView`, `atlas/intents{Base,More}.ts`, `today/widgets/{muscles,training}.tsx`, `loadWindow`; серверні `functions/src/aggregates.ts` (setTypeOf/groupKind).
- Модуль: `sizeEntries.json`, опис+іконка (`addons.md` п.11–12 блокують `cpd`), `weekPreviews`/канвас превʼю, Atlas `addonTopics`, Today registry, сповіщення, ярлики, `overlayBlocked`.

**Нові ризики.** R16 старий PWA читає програму з `block` (NaN/порожній екран) → тест «старий формат читає новий документ». R17 тренерський запис відхилено rules → явна UX-помилка, без вічного pending у офлайн-черзі. R18 старий клієнт пересохраняє сесію й стирає результат блоку → довести, що merge зберігає невідомі поля, або `blockV` для сесій (вирішити в SPO-610 до коду). R19 `aggregates.ts` розходиться з клієнтом → golden-порівняння. R20 мертві i18n-ключі. R21 a11y: тести з `role=tab` переписати на еквівалентні шляхи (не видаляти; зафіксувати кількість `it()` до/після). R22 nudge (D7) суперечить `addons.md` і тесту «без аддона нічого не видно» → виняток у `addons.md` + явний виняток у `exclusion.contract`.

**Рішення власнику (інв. 8, до коду модуля time-blocks).** Як conditioning входить у `loadWindow`/навантаження, якщо він поза LANDMARKS: пропоную окремий доданок «conditioning» у `loadWindow` з нейтральним ±0 без модуля; перевірка golden-тестами. Це не блокує SPO-613 (Set options).

**Таблиця «колишня дія → нове місце» (до коду, R2).** Складається з `SessionView.options.cases` і `more.cases` першим кроком SPO-613 і додається в цей файл; тест на кожен рядок.

**Базова лінія §4(а) розширена:** + `tests/ui.test.tsx`, `tests/rules`, `coach/data/firestore/*`, golden-тести (`loadWindow`, `fatigue`, `volume*`, `recovery`, `picker*`, `sessionBuilder`).

## 12. Нова вимога власника (26.11 22:46): зворотний відлік перед стартом блоку, звуки

Слова власника: «5 секунд перед початком після натискання на Start відлік зворотній на весь екран. оверлей і цифри з анімацією класною якоюсь. і звуки… звук відліку і звук якийсь далі ще може попередження перед фіналом».

**Рішення (best practices, власник делегував відкриті питання):**
- Після Start у `BlockReady` повноекранний оверлей: цифри 5→1, на 0 «GO», далі таймер блоку. Анімація: числівник входить з масштабу ≈1.4→1 із затуханням, кільце-пульс на кожну секунду; `prefers-reduced-motion` — лише fade без масштабу. Тап «Skip» і Back/Esc скасовують старт (нічого не пишемо). `aria-live="assertive"` читає «5, 4, 3, 2, 1, Go».
- Відлік рахується від часової мітки (`startAt = now + 5 с`), а не від інтервалу: екран заблоковано або вкладка у фоні — час блоку не зсувається (як `restTimer`). Wake lock з Start.
- Звуки без нових ассетів і процесорів: WebAudio-синтез у тому ж контексті, що `restTimer.ts` (`primeRestAudio()` викликається в тапі Start — жест користувача, потрібен iOS). Тик щомиті відліку (тони вищають на 3-2-1), довший тон на GO, «попередження перед фіналом» = подвійний тон за 10 с до кінця AMRAP/forTime-капа, тики 3-2-1 і довгий тон наприкінці; EMOM/інтервали: 3-2-1 перед кожною хвилиною/фазою, різні тони для Work і Rest. Haptic через `haptics.ts` (`tick`, `double`, `success`).
- Підпорядковано наявним налаштуванням відпочинку `RestPrefs.sound/vibrate/keepAwake` (нового перемикача в v1 немає): звук вимкнено → лише візуал і вібрація; тихий режим iOS глушить синтез, вібрація й візуал лишаються.
- Новий примітив кіту `BlockCountdown` (overlay, стани 5…1/GO/скасовано, mobile/desktop, токени, `docs/UI-KIT.md`); логіка звуку — чисті функції в `timeBlocks/` + тест на розклад подій (5 тиків + GO; попередження за 10 с; 3-2-1 перед кінцем) і що за вимкненого `sound` аудіо не створюється.
- Дизайн: новий кадр «Ready → Countdown → Timer» (справжній рендер у design-lab, M12/D12) до коду модуля. Ризики: R23 iOS блокує звук без жесту (мітигація: prime у тапі Start), R24 розбіжність таймера при фоновій вкладці (timestamps), R25 акцесібіліті анімації (reduced-motion, aria-live). Одиниця плану: +1 (SPO-611/612), прогрес перераховано: 4 з 15.

## 13. Хід розробки: зміни скоупу й close-out (26.11.2026)

**Реалізовано (докази: vitest `src/timeBlocks` 35+ тестів, SessionView-набір 76 файлів/483 тести, kit-guard, hygiene, stylelint-ratchet, depcruise, tsc, eslint):**
- Модель `Workout.blocks` (запечатується з сесією, `blocksSeal.test.ts` доводить R18/R68), чисті операції `blockOps`, годинник із міток часу.
- UI: Ready / Timer / Ended / Result (+ actuals) / Logged, білдер з класикою (Cindy, Fran, EMOM 10, Tabata), відлік 5-4-3-2-1, звукові сигнали й вібрація, видалення через `ConfirmDialog`.
- Інтеграція: один `<TimeBlocks/>` у `SessionView` (host-слот, `useTimeBlocksHost`); без встановленого модуля нічого не видно, дані лишаються. Сесія з одного залогованого блоку завершується.

**Скоуп відносно плану (оновлено 27.11 за затвердженими дизайнами):**
1. Блок є кроком фокус-потоку (сегмент прогресу, Next, назва на кнопці) і картою в повному списку; вправа переноситься в блок з Undo; рядки учасників із фото й ⓘ.
2. Блоки рівня програми зроблено: `Program.blocks` + маркер `blockV` + правило `keepsBlocks` у `firestore.rules`; слот `dayBlocks` у редакторі програм (власна програма), рядки блоків у плані Today, копіювання блоків дня в сесію при старті дня. Тренерське призначення блоків (planCodec/ProgramLayer/версії) = Фаза 2, питання власнику.
3. Плитка «Time block» у Start-дровері і пункт «Time block» у пікері відкривають білдер. Режим пікера «Block-ready exercises» (каталог придатних вправ, чіпи категорій) ще не зроблено.
4. Рядок Conditioning у Volume, темна тема й кадри M3/M5/M6/M10/M11 лишаються відкритими.

**Додатково зроблено:** read-only `BlockRecap` у `TraineeSessionView` (host-слот, показується лише якщо модуль встановлено в переглядача; сервер `athleteWorkout` уже віддає документ цілком, змін rules/functions немає). Рішення щодо metcon: блоки НЕ входять у силову математику (формули не змінюємо, інваріант 8); `blocksMaths.test.ts` доводить, що підходи й обсяг сесії однакові з блоками й без. Atlas/Today/сповіщення блоки не читають (`rg` по `.blocks`/`WorkoutBlock` поза модулем: лише types, store, SessionView).

**Відкрито (не закрито, Done не ставимо):** опис/About і превʼю-канвас модуля (блокують `cpd`); Linear AC `[x]`; перегляд браузером на localhost зі скріншотами.

ризики: оцінено R1–R25, закрито доказом тестами R16/R18 (round-trip), R3 (гейт вимкнено), решту повʼязано з відкритими пунктами; знайдено по ходу 2 (stylelint у BlockCountdown.css, raw `<button>`), виправлено; прогалин оцінки: 1 (finish-кнопки `entries === 0`, закрито `blockLogged`).
