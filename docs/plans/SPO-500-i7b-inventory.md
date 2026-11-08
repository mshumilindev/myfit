# SPO-500 · I7b — інвентар розрахунків, що читають дані add-on-ів

Джерело: читання коду (без запуску тестів), 06.11.2026. Шляхи — відносно `client/src`. Формули не змінюємо (інваріант 8): тут лише карта залежностей.

## Головне

- Звʼязок іде через модульні «мости» `calcMods.ts`, `nicotineApply.ts`, `alcoholApply.ts`, `supplementsApply.ts`: вони читають синглтони стору й повертають нейтральне (×1 / +0), коли даних немає.
- Health-функції (нікотин, алкоголь, добавки, цикл, травми, стани) уже нейтралізує маска згоди `healthMask.ts` (`exposed()` у `store.ts:651`).
- Sleep, Nutrition, Learn, Apex **не маскуються**: дані лишаються в сторі, навіть якщо add-on вимкнено.
- Обмеження здоровʼя навмисно обходять маску (SPO-290): `getStoredLimits()` (`store.ts:676`). Вимкнення Health не повинно це ламати.

## Найризикованіші звʼязки

1. Обмеження Health обходять маску (`progression.ts` `activeEffects`, `healthBuild.ts`, `SessionView` RPE-ліміт, `streak`): при вимкненні Health не можна ні стерти, ні замаскувати ці дані. Поведінку «функція вимкнена, обмеження діє» уже закріплено тестами SPO-290 (`store.healthLimits.test.ts`, 97–160); відкрите лише повторити її для стану «add-on не встановлено», коли цей стан зʼявиться в `exposed()`.
2. Мости `calcMods`/`*Apply` імпортують `store.ts`, а їх імпортують `recovery`, `fatigue`, `progression` (цикл у рантаймі). Прапор «модуль вимкнено» має дійти до `exposed()`/`maskHealth`. Поріг продубльовано в `today/widgets/training.tsx:1165` і `fatigue.ts:82`.
3. Sleep не маскується, а читається в `ProgressView.tsx:349`, `training.tsx:1201`, `SessionView.tsx:1264` (RPE), `mastery.ts:388`. Виклики без юніт-тестів.
4. Підсумок сесії показує картки без перевірки встановлення: `AtlasDebrief` (лише `coach.enabled`), `FuelCard`, `NicotineCard`, `AlcoholCard`, `SupplementsCard` (`SessionView.tsx:4436-4460`).
5. Mastery/Apex у оболонці: `App.tsx:756` рахує `computeMastery` (враховує сон) при кожному старті й пише `setMasterySeenRating`.

## Таблиця

| #     | Розрахунок (файл:рядок)                                                                           | Читає                               | Нейтрально без даних | Тест                   |
| ----- | ------------------------------------------------------------------------------------------------- | ----------------------------------- | -------------------- | ---------------------- |
| 1–4   | `calcMods` readinessMult / sleepNeedExtraMin / deloadMult / progressionMult (`calcMods.ts:32-48`) | нікотин, алкоголь, добавки          | так                  | так                    |
| 5–7   | `recovery.computeReadiness` (`recovery.ts:76,163`), `muscleReadiness` (~25 викликів)              | через 1                             | так                  | так                    |
| 8–9   | `fatigue.levelOf` (`fatigue.ts:82`), дубль `training.levelOfIdx` (`training.tsx:1165`)            | нікотин, алкоголь                   | так                  | так / часткове         |
| 10–12 | `sleepReadinessBias` (`sleep.ts:265`) → `ProgressView.tsx:349`, `training.tsx:1201`               | Sleep                               | так                  | функція так, виклик ні |
| 13    | `progression.nextTarget` → `applyNicotineStep` (`progression.ts:375-396`)                         | нікотин                             | так                  | часткове               |
| 14    | `applyConditionEffects` + `activeEffects` (`progression.ts:365,406`, `App.tsx:680`)               | Health (стани)                      | так                  | так                    |
| 15–18 | `sessionBuilder` (розминка, `ctx.conditions`), `healthBuildCtx`, `picker`, `swaps`                | нікотин, Health                     | так                  | часткове / так         |
| 19–21 | таймер відпочинку, RPE-ліміти, `nicRpeShift` (`SessionView.tsx:2164-2628`, `plan.tsx:2009,2016`)  | нікотин, Health                     | так                  | так / часткове         |
| 22    | `rpe.ts:51` + `SessionView.tsx:1264`                                                              | Sleep                               | так                  | ні                     |
| 23    | `illnessState` (`illness.ts:103`)                                                                 | періоди відпочинку (ядро)           | так                  | так                    |
| 24    | `streakProtectedPredicate` → `computeStreak` (`store.ts:4821`, `streak.ts:33`)                    | Health (травми, реабілітація)       | так                  | так                    |
| 25–26 | `postWorkoutFuel`, `FuelCard`                                                                     | Health (стани), Nutrition-повʼязане | так                  | так                    |
| 27    | `NicotineCard`, `AlcoholCard`, `SupplementsCard` та моделі                                        | Health, `store.sleeps`              | так                  | так                    |
| 28    | `supplementContext` (`supplementsApply.ts:37`)                                                    | ядро → добавки → ядро               | так                  | часткове               |
| 29–30 | `AtlasDebrief` → `atlas/guard.softenReason`                                                       | Atlas (сон, травми)                 | лише `coach.enabled` | ні                     |
| 31–33 | `NextUp`, `startWorkout`/`startActivity` блок за сном, `sleepGuard`                               | Sleep                               | так                  | так / часткове         |
| 34–35 | `mastery.computeMastery` (`mastery.ts:388`), ефект `App.tsx:756`                                  | Mastery читає Sleep                 | так                  | функція так, ефект ні  |
| 36    | цикл: `useCycleTint`, віджет, `CycleSessionNote`                                                  | Health                              | так                  | так                    |
| 37–40 | віджет body, статичний каталог Learn, `ExercisePicker`, `energy`/`dayEnergy`                      | Sleep, Learn, Health                | так                  | так / ні               |

Не повʼязані: `programSuggest`, `starterPlan`, `recaps`, `trends`, `volume`, `setTank`, `weakpoints`, `challenges`, `feats` (перевірено імпорти й ключові слова).

## Прогалини в тестах (закрити першими)

- Виклики `sleepReadinessBias` (ProgressView, `training.tsx`), `rpe.ts` `sleepShortH`, `AtlasDebrief`, ефект Mastery в `App.tsx`.
- «Add-on не встановлено, обмеження Health діють» — після зʼєднання enabledSet з `exposed()`; для «згоди немає» вже покрито `store.healthLimits.test.ts`.

## Відкрите питання власнику

Що показувати в розрахункових екранах, коли модуль вимкнено: ховати блок мовчки (рекомендація плану) чи підказка «додайте Sleep». Стрипінг модуля (I7) не береться, поки його рядки тут не закриті; будь-яка зміна формул — окреме погодження.

## Статус на 08.11.2026

- Закрито тестами «add-on немає = рівно нейтрально, є = модель рухається»: рядки 1–4, 5–7, 9 (нікотин, алкоголь: `addons/models.noAddon.test.ts`), маска Health-функцій і періодів відпочинку (`healthAddons.test.ts`, `addons/restMask.test.ts`), активності й цілі (`activitiesGate.test.ts`, `featureGates.test.ts`). Дані після вимкнення лишаються в сторі (асерт у тесті).
- Sleep стрипається (I8, `store.ts exposed()`): рядки 10–12, 22, 29–30, 34–35 закриті тестами `addons/sleepGate.test.ts` і `addons/sleepModels.noAddon.test.ts` (немає Sleep = нейтрально; Atlas-guard і Mastery читають замасковані ночі).
- Не відкрито, бо модулі ще не стрипаються (I7/I8: Sleep, Learn, Apex, Nutrition, Atlas): рядки 10–12, 22, 29–30, 34–35, 37–40. Тести на них пишуться разом зі стрипінгом кожного модуля; формули не чіпаємо (інваріант 8).
