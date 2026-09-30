# Chronic conditions — постійні особливості здоров'я, які додаток враховує скрізь

Статус: план, код ще не писався. Мова: документи укр., код англ.

## 1. Проблема

Зараз у додатку є два види «здоров'я», обидва тимчасові:

- **Unwell** (`RestPeriod{mode:'illness'}` + `illness.ts`) — хвороба минає, є план повернення;
- **Injury** (`injury.ts`, `Injury`) — травма проходить стадії `protect → reintroduce → rebuild → return` і закривається (`healedDay`).

Немає місця для того, що **не минає**: серце, біль після операції, хронічний біль коліна без діагнозу, проблеми зі спиною, астма, гіпертонія тощо. Таких станів може бути **кілька одночасно**, вони мають діяти **завжди**, а не «доки не одужаю».

Крім того, зараз обмеження здоров'я доходять лише до одного споживача: `buildDay` (автоскладання дня) через `protectedMuscles`/`loadCaps`, і все це **по м'язах**. Ні `SessionView`, ні пікер, ні заміни, ні прогресія, ні плейбук, ні Atlas про травми не знають. Для хронічних станів цього замало: спина і присід — це про **рух і осьове навантаження**, серце — про **інтенсивність і затримку дихання**, а не про м'яз.

## 2. Принципи

1. **Один модуль — одне джерело правди:** чистий `client/src/conditions.ts`. Усі споживачі читають лише його (`conditionLimits`, `exerciseFlags`). Жодної логіки станів у компонентах.
2. **Приватність за замовчуванням** (розділ 6): лише власник; не потрапляє в тренерський payload, шеринг, нотифікації, пуші, агрегати; у зовнішні LLM — лише знеособлені обмеження.
3. **Не медична порада.** Додаток м'яко попереджає й пропонує безпечніше; не ставить діагнозів і не блокує. Тренування можна почати завжди. Підказка «порадься з лікарем» — у довідці, не в кожному екрані.
4. **Не набридати:** одне м'яке позначення там, де воно доречне, а не банер на кожному екрані. Жодного банера на Today (стан постійний). Позначаємо _ефекти_ («обережно з осьовим навантаженням»), а не діагноз.
5. **Без нових kit-примітивів і екранів**, де можна: `Banner`, `Card`, `Sheet`, `PresetChips`, `Segmented`, `Tag`, `IconTile`, `ListRow`. Якщо чогось бракує — спершу kit + story, лише токени.
6. **Адитивні дані:** нова колекція, нові опційні поля; старе не мігрується руйнівно; Injury-система лишається як є.
7. **Флаг:** `conditions` у `data/flags.ts` (за замовчуванням вимкнено), поки не пройде перевірку.
8. **Пороги — таблиці в одному місці**, легко правити, без вбитих чисел у логіці.
9. **Не видаляти наявну функціональність.**

## 3. Модель даних

```ts
export type ConditionCategory =
  | 'cardio' // серце, тиск, аритмія
  | 'respiratory' // астма, ХОЗЛ
  | 'spine' // спина: шийний / грудний / поперековий відділ, грижі, сколіоз, після операції
  | 'joint' // коліна, плечі, стегна, зап'ястя, лікті, стопи
  | 'neuro' // нервова система, нейропатія, запаморочення
  | 'metabolic' // діабет, щитовидна
  | 'postop' // стан після операції (з областю)
  | 'pain' // хронічний біль без діагнозу
  | 'other'; // власний варіант

export interface ChronicCondition {
  id: string;
  key: string; // ключ із каталогу або 'custom'
  label?: string; // власна назва (для custom / «не діагностовано»)
  region?: BodyRegion; // для spine/joint/postop/pain: де саме
  side?: 'left' | 'right' | 'both';
  severity: 1 | 2 | 3; // 1 обережно, 2 помітно обмежує, 3 сильно обмежує
  note?: string; // приватна нотатка (лише локально/власнику)
  createdAt: number;
  archivedAt?: number; // «більше не актуально» — не видаляємо, а архівуємо
}
```

Похідні (не зберігаються): `ConditionLimits`, `ExerciseFlag`, підказки.

### 3.1. База станів (каталог)

Файл `data/conditionCatalog.ts` (курований, як `subregionTags.json`): масив записів `{key, category, regions?, defaultSeverity, effects}`, де `effects` — **декларативні обмеження**, а не код:

- `avoidMuscles` / `capMuscles` (0..1) — сумісно з наявним `loadCaps`;
- `avoidPatterns` — `squat | hinge | press-overhead | pull-vertical | jump | twist | flexion…` (мапиться через наявний `patternOf`);
- `spine: 'axial' | 'shear' | 'flexion' | 'extension'`, `impact`, `overhead`, `valsalva` — прапори ризику вправ;
- `intensity: { rpeMax, noFailure, noMaxEffort, noBreathHold }`;
- `rest: { addSec, floorSec }`;
- `volumeScale` (0..1), `progression: { stepScale, noAutoIncrease }`;
- `cardio: { maxIntensity: 'light'|'moderate'|'vigorous', noHIIT, noPlyo }`;
- `hint` — ключ i18n короткої поради.

Приклади категорій каталогу (не вичерпно, ~50–70 записів): серцево-судинні (гіпертонія, аритмія, після інфаркту, вада серця, кардіостимулятор), дихальні (астма, ХОЗЛ), хребет (шийний/грудний/поперековий біль, грижа диска, протрузія, сколіоз, стеноз, стан після операції на хребті, спондилолістез), суглоби (коліно: хондромаляція, артроз, після ACL/меніска; плече: імпінджмент, нестабільність; стегно; зап'ястя/карпальний тунель; лікті — епікондиліт; стопа/гомілка), нервова система (нейропатія, запаморочення/вестибулярні), метаболічні (діабет, щитовидна), вагітність/післяпологовий (окремо, як «стан», не хвороба), пошкодження після операції (будь-яка область), **«хронічний біль без діагнозу» (регіон + вага)** і **«Інше» (власна назва + область + вага)**.

Кожен запис має розумні дефолти; користувач лише обирає стан, область і вагу — не конструює правила.

### 3.2. Ефекти складаються, а не перезаписуються

Кілька станів одночасно → `conditionLimits(conditions)` бере **найсуворіше** значення (min для кап-ів, max для `addSec`, об'єднання `avoid*`/прапорів), а причини накопичує списком, щоб підказка могла пояснити «через що».

## 3a. Що вже є і використовується

- `injury.ts`: `BODY_PARTS` (частина тіла → м'язи), `protectedMuscles`, `loadCaps`, `activeInjuries`; `types.ts:Injury`; колекція `users/{uid}/injuries` (owner-only, тренер не читає), `localStorage spotter.injuries`.
- `illness.ts`: `illnessState()` → `caps.{volume,rpeMax,restAddSec}`, `rpeCut`. Застосовується лише частково (`rpeCut` в `rpeCtxFor`, `restAddSec` як булеве в `planRest`; `caps.volume` лише текстом у StartSheet/Today).
- `sessionBuilder.ts`: `BuildContext{protectedMuscles, loadCaps, avoid}`; `patternOf`; `rankExercisesForMuscle`; вага × кап тільки для `loadType==='weight'`.
- `data/exercises.ts`: `RichExercise` (force, mechanic, category, primary/secondary muscles) — **немає** патернів руху, осьового навантаження, ударності, overhead, Valsalva. Шаблон оверлея — `subregionTags.json` (+ `subRegionsById/ByName`).
- `atlas/guard.ts` `softenReason` (`injury|illness|sleep|comeback`), `atlas/safety.ts` (regex-мережа безпеки, 5 мов), `atlas/chatFacts.ts`.
- Heart-rate зон у додатку **немає** (лише RPE і % e1RM) — серцеві обмеження виражаємо через RPE-стелю, «без відмови», відпочинок, а не через ЧСС.

## 4. Один модуль — усі наслідки

### 4.1. Нове ядро

```ts
conditionLimits(conditions): {
  muscleCaps: Map<MuscleGroup, number>;   // 0..1
  avoidPatterns: Set<Pattern>;
  rpeMax?: number; noFailure: boolean; noMaxEffort: boolean; noBreathHold: boolean;
  restAddSec: number; restFloorSec?: number;
  volumeScale: number; stepScale: number; noAutoIncrease: boolean;
  cardioMax?: 'light'|'moderate'|'vigorous';
  reasons: { key: string; label: string }[];
}
exerciseFlags(name, limits): { level: 'ok'|'info'|'caution'|'avoid'; reasons: string[]; cap?: number; saferHint?: string };
```

Оверлей вправ: `data/exerciseRisk.json` (id → `{joints[], spine, impact, overhead, valsalva, cardioDemand}`) + евристики за категорією/м'язами/патерном/ключовими словами в назві, щоб не тегувати вручну всі ~870; ревʼю-лист, як для sub-region. Кастомні вправи: опційне `CustomExercise.risk?` + поле в редакторі. Пошук за назвою — наявний `richExerciseByName`/`muscleInfoByName`.

Один хелпер `healthBuildCtx(store)` збирає injuries + conditions (+ illness) для **усіх** викликів `buildDay` — щоб не пропустити жодного (їх п'ять+: `plan.tsx`, `fun.tsx`, `SessionBuilderView`, `atlas/actions.ts`, `atlas/useTodayPlan.ts`, а також `atlas/plan.ts`).

### 4.2. Таблиця споживачів

| Область               | Файли                                                                                                                                                                                    | Що робимо                                                                                                                                                            |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Автоскладання дня     | `sessionBuilder.ts` (`BuildContext`, `rankExercisesForMuscle`, `INTENT_SPEC`, ваги, розминка)                                                                                            | Виключає `avoid`-вправи, штрафує `caution`, вага × кап (розширити й на не-`weight` типи), `volumeScale`, RPE-стеля в інтенті, довша/м'якша розминка для cardio/spine |
| Прогресія             | `progression.ts` (`nextTarget`, `ProgOpts`)                                                                                                                                              | `stepScale`/`noAutoIncrease` для конкретної вправи; це найчастіше викликаний вузол (≈10 місць)                                                                       |
| RPE                   | `rpe.ts` (`RpeContext`, `readinessFactor`), `SessionView.rpeCtxFor`                                                                                                                      | `conditionCut`/`rpeMax` як ще одна частина readiness; єдине місце інʼєкції — `rpeCtxFor`                                                                             |
| Відпочинок            | `restTimer.ts` (`RestInputs`, `RestReason`)                                                                                                                                              | `conditionRestSec`, підлога, новий reason-chip                                                                                                                       |
| Відмова/failure       | `failure.ts`                                                                                                                                                                             | Не пропонувати failure-полум'я для обмежених м'язів / при `noFailure`                                                                                                |
| Втома / відновлення   | `fatigue.ts` (`landmarks`), `recovery.ts` (множник `base`), `stimulus.ts` (`plateau`)                                                                                                    | `conditionAdjustLandmarks` поруч із `focusAdjustLandmarks`; нижчий MRV/плато для обмеженої області; повільніше відновлення                                           |
| Обʼєм / цілі          | `volume.ts`, `personalize.ts`, `goals.ts`                                                                                                                                                | Ті ж `landmarks`; «ease»-емфаза вже існує — використати                                                                                                              |
| Слабкі місця / fix-it | `weakpoints.ts`, `fixit.ts`                                                                                                                                                              | Не пропонувати «підтягнути» обмежену область                                                                                                                         |
| Підбір вправ          | `picker.ts` (`buildPickItems`, `suggest`), `swaps.ts`, `starterPlan.ts`, `nextUp.ts`, `activitySuggest.ts`, `homeSets.ts`, `today/widgets/discover.tsx`                                  | Єдиний предикат `exerciseFlags`; у `swaps` — фільтр/штраф + чип «безпечніша заміна»; у пікері — бейдж, опція «сховати небажані»                                      |
| Плейбук               | `playbook.ts`, `store.startPlay`, `PlaybookView`                                                                                                                                         | Позначати плеї з обмеженими вправами; кап `topWeight`; нудж «замінити»                                                                                               |
| Сесія                 | `SessionView.tsx` (картка вправи, рядок підходу), `HoldWatchSet`, `HomeSetSheet`                                                                                                         | Малий `Tag` на вправі з причиною; кап цільової ваги; підказка «безпечніша заміна» → існуючий свап-шит                                                                |
| Старт сесії           | `SessionStartCoach.tsx`                                                                                                                                                                  | Один рядок «Пам'ятай про: …» (без повторів на кожному екрані)                                                                                                        |
| Деталь вправи         | `ExerciseDetailView`, `ExerciseLibraryView`, `ExerciseGallery`, `searchCatalog`                                                                                                          | Банер-ефект «Обережно: осьове навантаження»; фільтр у пошуку                                                                                                         |
| Програми              | `DayEditor`, `ProgramBuilder`, `ProgramAssignDialog`, `programs/*`                                                                                                                       | Чіп прапора біля вправи в редакторі; **оцінка на пристрої атлета** при перегляді/старті (тренер не бачить умов)                                                      |
| Старт / Today         | `StartSheet.tsx`, `TodayView`, `plan.tsx`, `muscles.tsx`, `body.tsx`, `bodyplus.tsx`                                                                                                     | Тихий чіп/позначка лише коли запланований день торкається обмеження; **без банера**                                                                                  |
| Календар / історія    | `calendarData.ts`, `HistoryTimeline`, `DayHistorySheet`                                                                                                                                  | Хронічні стани **не** є періодами дня; за замовчуванням не показувати                                                                                                |
| Тренди / нотифікації  | `trends.ts`, `notifications.ts`, `challenges.ts`, `mastery.ts`, `standards.ts`, `feats.ts`                                                                                               | Поради не штовхають до обмеженої області; челенджі з важкими/обмеженими вправами вимкнути/замінити; mastery/standards не карають за обмежені ліфти (опція `opts`)    |
| Кардіо                | `cardio.ts`, `LogActivityView`                                                                                                                                                           | Стеля інтенсивності, без HIIT/plyo за `cardioMax`                                                                                                                    |
| Atlas                 | `atlas/guard.ts` (`softenReason` + новий `'chronic'`), `style.ts` (спокійна подача), `chatFacts.ts`, `memoryPlan.ts`, `notes/debrief`, `intentsFourth` («health & safety»), `compose.ts` | Відповіді «чи можна присідати?» враховують обмеження; тон м'якший; нові intent id — у regex «plain-spoken»                                                           |
| Health                | `HealthView`, `HealthForm`, `parts.tsx` (тон `chronic`)                                                                                                                                  | Вхід у стани (розділ 5)                                                                                                                                              |
| Профіль / онбординг   | `ProfileView`, `OnboardingView`                                                                                                                                                          | Приватна секція; необовʼязковий крок                                                                                                                                 |
| Скидання              | `store.resetLocalData`                                                                                                                                                                   | Додати ключ (інакше дані переживуть вихід)                                                                                                                           |

Помічені прогалини поза станами (побічний виграш): `caps.volume` з illness ніде не застосовується до `buildDay`; ті ж хуки цього плану можна підключити до нього.

## 5. Entry points

1. **Основний вхід — `Health` → «Постійні особливості»** (секція/список на `HealthView`): додати, змінити вагу, архівувати («більше не актуально»), видалити (через confirm). Форма — існуючий `Sheet` + `PresetChips`/`Segmented`.
2. **Профіль** — секція «Health conditions» (приватна): лише посилання на ту саму шторку, без дублювання екранів.
3. **Онбординг** — необовʼязковий крок «Чи є щось, під що варто підлаштуватись?» (можна пропустити; вбудовується в крок body).
4. **Atlas**: «у мене болять коліна постійно» → пропозиція додати стан (лише після «Do it»).
5. **Контекстно:** з картки вправи «Це мені шкодить» → швидке додавання/позначка обмеження.
6. **Флаг:** `conditions` — device-scoped спочатку.

Пошук у базі: текстовий фільтр по каталогу + групи за категоріями; для «недіагностованого болю» — вибір області й ваги без діагнозу.

## 6. Приватність

- **Зберігання:** `users/{uid}/conditions/{id}` з правилом `allow read, write: if isSelf(userId)` (як `injuries`); `localStorage spotter.conditions`; додати в `resetLocalData`; `recursiveDelete` акаунта покриває колекцію автоматично.
- **Тренери/адміни:** не додавати колекцію в `functions/src/profile.ts` (`fullProfilePayload`), `trainer.ts`, `admin.ts`; тест-охоронець, що payload ніколи не читає `conditions`. Не класти в `meta/body` чи в профільний документ.
- **Клієнт-режим:** як і для injuries — у клієнтських переглядах умови ігноруються (той же патерн, що `restPeriodsOverride`).
- **Виключені поверхні:** `StatShareSheet`/`shareCard`, `notifications.ts` (тексти без назв станів), пуш-outbox, `challenges/feats/leaderboards/apex` (`aggregates.ts`), `trainerLive`, експорти. Показуємо _ефекти_ («обережно з осьовим»), не діагноз, у всьому, що може бачити інша людина.
- **Atlas / LLM:** Gemini (Firebase AI Logic) і fallback Puter отримують `factsJson` + історію чату **за межі пристрою**. Політика: у `factsJson` — **тільки знеособлений об'єкт обмежень** (`{avoidLoading:[…], intensityCap, noMaxEffort, noBreathHold}`), без назв діагнозів, нотаток чи областей-міток; історію чату перед відправкою санітизувати; окремий явний перемикач «Дозволити Atlas AI знати про це» (за замовчуванням вимкнено). Детерміновані інтенти (без LLM) можуть використовувати повну деталь на пристрої. Системний промпт: «respect FACTS.constraints».
- **Пристрій:** plaintext у localStorage — ризик спільного пристрою; шифрування (WebCrypto) — за межами цього плану, зафіксовано як відкрите питання.
- **Документація й код:** особисті медичні приклади користувача **не** потрапляють у репозиторій, доки, тести, фікстури, сторібуки — лише вигадані узагальнені.

## 7. Прибирання

- Один `healthBuildCtx` замість п'яти ручних збірок injury-контексту.
- Розширити `injury`-споживачів, що зараз ігнорують `loadCaps` (прогресія, свапи, пікер, плейбук), на спільний предикат — тобто ліквідуємо прогалину для травм теж.
- Не дублювати `BODY_PARTS`: каталог станів посилається на нього.
- Оновити `docs/FEATURES-AC.md`, `docs/specs/AC-STATUS.md`, `docs/UI-KIT.md` (якщо зʼявляться kit-компоненти).

## 8. Етапи

1. **Модель і ядро:** типи, `conditionCatalog.ts`, `conditions.ts`, `exerciseRisk.json` + евристики, тести (табличні: стани × вправи, накладання кількох станів). Правила Firestore, `resetLocalData`, тест-охоронець тренерського payload. Без UI.
2. **Дані та вхід:** store (`localStorage`+Firestore+listener), секція в Health/Profile, форма-шторка, i18n 5 мов, флаг.
3. **Генерація:** `healthBuildCtx`, `sessionBuilder`, `progression`, `rpe`, `restTimer`, `failure`, `fatigue/recovery/volume`.
4. **Вибір вправ:** `picker`, `swaps` («безпечніша заміна»), `weakpoints/fixit`, `starterPlan`, `nextUp`, `playbook`.
5. **Сесія та деталі:** тег на вправі, рядок у `SessionStartCoach`, `ExerciseDetailView`, `DayEditor`, `StartSheet`, Today-чіп.
6. **Аналітика:** тренди, нотифікації, челенджі, mastery/standards, кардіо.
7. **Atlas:** `guard`, `chatFacts` (знеособлені обмеження), інтенти, нотатки, тести приватності (`factsJson` без лейблів).
8. **Онбординг**, документація, фінальна перевірка приватності.

Кожен етап: `tsc`, `eslint`, `prettier`, тести, перевірка в браузері на **тестових** станах (лише мої, після — видаляються; дані користувача не чіпаємо).

## 9. Рішення (30.09)

1. Вхід: **Start-шторка → плитка Health → сторінка Health** (окремого пункта меню немає) і секція в Профілі. На Today — без плашки, лише іконка щита (без тексту) біля календаря, що веде на стани.
2. Atlas: обмеження (знеособлені ефекти) завжди в контексті; **настрій Atlas не змінюється** — у `softenReason` нового `'chronic'` немає.
3. Ручний вибір вправ ніколи не блокується; людина ухвалює остаточне рішення. Виключення `avoid`-вправ лише з автоскладання.
4. Без пульсу (ЧСС-зон немає): RPE-стеля, «без відмови», затримка дихання. **Налаштувань Rest у проєкті немає, тому відпочинок як ефект не робимо** (прибрано `rest` з моделі та екранів).
5. Mastery/standards не карають за обмежені ліфти.
6. **Каталог великий і повний**; ручного створення стану немає. «Хронічний біль без діагнозу» — записи каталогу по областях.
7. **Шифрування** на пристрої і в БД (E2E, recovery key). Сервер не читає стани; Atlas і генерація працюють на пристрої; у LLM лише знеособлені ефекти.
8. **Ділення з тренером:** загальний дефолт для всіх («Нічого» за замовчуванням / «Лише ефекти» / «Повністю») і окреме налаштування кожного стану («Default / Off / Effects / Full»). «Лише ефекти» = без назви й нотаток. Нотатки не діляться ніколи.
9. **Дизайн зведений (без варіантів)**, усе з реального uikit і реальних екранів (полотно «Chronic conditions: one flow»):
   - Health: блок «Long-term conditions» **перед History**.
   - Додавання: за замовчуванням **List** (пошук + категорії), альтернатива **Body map** з шарами Bones / Muscles / Organs (BodyParts3D, CC BY 4.0, рендер у `public/anatomy`).
   - Налаштування стану: ступінь + перемикачі ефектів (Loads, Exercises, Effort, Breathing), coach sharing.
   - Видалення лише через `ConfirmDialog` (danger); **Archive не робимо** — замість шторки кнопка «Delete condition» у картці стану.
   - У сесії/історії/пікері/програмі — малі `Tag` (Careful / Avoid / Adapted) і один `Notice`; нічого не блокується.
10. Тон `chronic` (steel blue) і kit-примітив `AnatomyMap` уже в kit (не закомічено).

## 10. Відкриті питання

1. Втрата ключа: що робимо, якщо recovery key втрачено (очистка станів і повторне введення)?
2. `Banner` не має тону `chronic` (зараз `rest`): додати тон чи не використовувати банер.
3. Джерело каталогу (класифікатори, локалізація на 5 мов, рецензія фахівця).
4. Hit-testing на мапі (тап по тілу) — окремий етап після списку областей.
5. Екран Profile у полотні відсутній (ProfileView вимагає мережі) — домалювати перед етапом 2.

## 11. План розробки (поетапно)

Кожен етап: `tsc`, `eslint`, `prettier`, тести, флаг `conditions` (вимкнено), лише вигадані тестові стани.

1. **Модель і ядро (без UI):** типи, `conditionCatalog.ts` (великий каталог), `conditions.ts` (`conditionLimits`, `exerciseFlags`), `exerciseRisk`, табличні тести; правила Firestore, `resetLocalData`, тест-охоронець тренерського payload.
2. **Шифрування і зберігання:** WebCrypto, recovery key, `localStorage` + Firestore, listener.
3. **Health і додавання:** блок на Health перед History, List, деталь, видалення через confirm, coach sharing; потім Body map.
4. **Генерація:** `healthBuildCtx`, builder, progression, rpe, failure, fatigue.
5. **Вибір вправ:** picker, swaps, playbook; прапори в сесії, програмі, історії.
6. **Atlas, онбординг, Profile, щит на Today.**
7. **Docs, `UI-KIT.md`, фінальна перевірка приватності.**

## 12. Уточнення (30.09, пізніше)

- **Body map → вкладка «Other».** Шари Bones / Muscles / Organs + вкладка Other: усе, що не прив'язане до частини тіла (нервова система, кровообіг, вагітність, метаболізм, системні тощо). Правило в коді: `isOtherTab(c)` (region `whole` або категорія neuro/cardio/respiratory/metabolic/pregnancy/other); тест гарантує, що кожен стан каталогу досяжний з карти або з Other.
- **Тимчасові стани** (вагітність, відновлення після операцій): дата початку + орієнтовний кінець. Кінець підставляється з типової тривалості (`TEMPORARY` у `conditions.ts`), користувач може змінити. Для вагітності триместр визначається сам за датою початку (`pregnancyKeyAt`). Стан неактивний до початку й після кінця (ефекти зникають, у списку лишається «Завершено» з пропозицією продовжити/видалити). Показуємо «день N з M».
- Модель: `ChronicCondition.startedAt?`, `endsAt?`.
- Дизайн: додати на полотно Other-вкладку Body map і блок «Початок / Тривалість» у Set up для тимчасових (на реальних екранах + kit).

## 14. Automatic keys (supersedes the recovery-key parts of §13)

Decision: nothing for the user to save, type or pass around. Encryption is against third parties (database viewers, leaked backups), not against the operator.

- **Key source.** Callable `vaultKey` (functions/src/vault.ts) returns the signed-in account's own data key: `HKDF-SHA256(VAULT_MASTER, salt=uid)`. The master lives only in Secret Manager; nothing is stored in Firestore, so a database dump or backup is ciphertext only. The master can be replaced by Cloud KMS without client changes.
- **Device.** The fresh key is held in memory (extractable, so it can be granted to a coach); a non-extractable copy is cached in IndexedDB so the app starts offline. Sign-out forgets both.
- **Migration.** Existing plaintext is sealed once in the background (idempotent, verified by a round-trip before each write, marker per account). No backup step or button.
- **Coach.** Unchanged: ECDH grants are created and revoked automatically when the coach assignment changes.
- **Interception.** TLS plus Firebase Auth ID token; the key is never written to logs or storage on the server. Recommended: enable App Check on the callable.
- **Ops.** `firebase functions:secrets:set VAULT_MASTER` (32+ random bytes, base64), deploy `functions` and `firestore.rules`. Rotating the master makes existing sealed data unreadable, so it needs a re-key job first.
- **UI.** Profile → Settings shows a status row only ("Encrypted" / "getting ready"). The recovery-key screens and strings were removed; `vault.ts` (recovery-key vault) is now unused.
- **Limit.** Anyone with access to both the Secret Manager secret and the database can decrypt; that is the accepted trade-off of a zero-friction model.
