# Аудит покриття тестами (SPO-48, етап 0 плану SPO-46)

Дата виміру: 2026-10-18, коміт `42aa8d7` (= origin/main). Джерело чисел: повний прогін `client/` з `--coverage` (v8, `include: src/**`), `coverage-summary.json`; 528 файлів тестів, 5 786 тестів, усі зелені, ~25 хв. Окремий прогін кореня (`npm run test:coverage`) виміряно в цьому ж аудиті. Мета SPO-46: statements/lines/functions 90%+, branches 80%+ (цифри ітеративно уточнюються після кожної партії).

## 1. Підсумок

| Метрика    | Покрито / всього | Зараз      | Ціль | Бракує (одиниць) |
| ---------- | ---------------- | ---------- | ---- | ---------------- |
| statements | 49 610 / 80 372  | **61.72%** | 90%  | 22 725           |
| branches   | 37 665 / 64 485  | **58.4%**  | 80%  | 13 923           |
| functions  | 15 673 / 30 347  | **51.64%** | 90%  | 11 639           |
| lines      | 42 604 / 68 526  | **62.17%** | 90%  | 19 069           |

Файлів у звіті: 1 327 (з них 175 без жодного виконуваного statement: типи, реекспорти). Файлів із **0% покриття** (є що виконувати, нічого не виконується): **87** (5 881 statements, 7,3% усього коду), список у розділі 4.

Важливо: тести з `tests/` (кореневий набір: `recaps`, `programCsv`, `programSeed`, `store`, `weekStart` тощо) у цей звіт **не входять** (окремий vitest-проєкт), тому, наприклад, `recaps.ts` має тут 1,8%, хоча перевіряється з `tests/recaps.test.ts`. Це дає завищений розрив для кількох файлів; точну картину дасть єдина метрика після етапу 2 (перенесення або об'єднання наборів).

## 2. По верхніх каталогах `client/src`

| Каталог          | Statements | Branches | Functions | Lines | Не покрито statements |
| ---------------- | ---------- | -------- | --------- | ----- | --------------------- |
| `today`          | 31.3%      | 19.9%    | 15.3%     | 32.7% | 7 143                 |
| `views`          | 36.1%      | 31.2%    | 30.4%     | 36.9% | 6 786                 |
| `i18n`           | 52.9%      | 34.9%    | 51.1%     | 52.1% | 4 148                 |
| `(файли кореня)` | 71.8%      | 64.8%    | 66.9%     | 75.1% | 3 774                 |
| `components`     | 47.9%      | 54.6%    | 46.7%     | 49.6% | 3 398                 |
| `coach`          | 84.2%      | 77.9%    | 78.4%     | 86.1% | 1 939                 |
| `data`           | 30.1%      | 29.9%    | 42.1%     | 29.9% | 1 387                 |
| `atlas`          | 92.9%      | 88.8%    | 93.2%     | 93.7% | 912                   |
| `nutrition`      | 20.7%      | 13.5%    | 17.3%     | 22.7% | 627                   |
| `stories`        | 25.6%      | 14.3%    | 24.0%     | 27.2% | 247                   |
| `tools`          | 84.4%      | 78.9%    | 77.4%     | 86.3% | 221                   |
| `learn`          | 54.6%      | 53.5%    | 43.1%     | 58.2% | 93                    |
| `offline`        | 79.6%      | 91.7%    | 66.4%     | 85.3% | 65                    |
| `coachCrypto`    | 93.7%      | 90.0%    | 100.0%    | 99.0% | 15                    |
| `cycle`          | 98.0%      | 89.6%    | 93.9%     | 99.3% | 4                     |
| `brand`          | 85.7%      | 78.6%    | 87.5%     | 86.7% | 3                     |

Читається так: `today/` і `views/` разом дають 13 929 з 30 762 непокритих statements (45%); `i18n/` + `today/**/*.strings.ts` (статичні словники) ще ~6 800 (див. розділ 6). Добре покриті: `atlas` 93%, `coachCrypto` 94%, `cycle` 98%, `offline` 80%, `coach` 84%, `tools` 84%.

## 3. 40 файлів із найбільшою кількістю непокритих statements

Разом 17 186 з 30 762 (56% розриву).

| #   | Файл                                  | Statements | Не покрито |
| --- | ------------------------------------- | ---------- | ---------- |
| 1   | `views/SessionView.tsx`               | 24.33%     | 1 583      |
| 2   | `store.ts`                            | 58.77%     | 1 306      |
| 3   | `i18n/uk.ts`                          | 6.39%      | 834        |
| 4   | `i18n/pl.ts`                          | 4.98%      | 820        |
| 5   | `i18n/lt.ts`                          | 4.87%      | 819        |
| 6   | `i18n/et.ts`                          | 3.63%      | 796        |
| 7   | `today/widgets/muscles.tsx`           | 28.26%     | 571        |
| 8   | `i18n/en.ts`                          | 32.44%     | 558        |
| 9   | `views/CoachView.tsx`                 | 0%         | 545        |
| 10  | `today/widgets/strength.tsx`          | 36.34%     | 536        |
| 11  | `today/widgets/plan.tsx`              | 35.38%     | 526        |
| 12  | `data/shareCard.ts`                   | 0.97%      | 507        |
| 13  | `App.tsx`                             | 51.85%     | 455        |
| 14  | `data/gymProviders.ts`                | 15.2%      | 396        |
| 15  | `today/widgets/strength.strings.ts`   | 1.74%      | 395        |
| 16  | `today/widgets/muscles.strings.ts`    | 2.51%      | 387        |
| 17  | `views/ProgressView.tsx`              | 0%         | 382        |
| 18  | `today/widgets/fun.tsx`               | 43.89%     | 354        |
| 19  | `today/widgets/learnatlas.tsx`        | 31.31%     | 329        |
| 20  | `views/TodayView.tsx`                 | 41.98%     | 315        |
| 21  | `today/widgets/plan.strings.ts`       | 2.83%      | 308        |
| 22  | `today/widgets/training.tsx`          | 42.52%     | 300        |
| 23  | `today/widgets/discover.tsx`          | 47.6%      | 284        |
| 24  | `today/widgets/cardio.tsx`            | 37.26%     | 271        |
| 25  | `today/widgets/training.strings.ts`   | 2.61%      | 261        |
| 26  | `views/AdminView.tsx`                 | 0%         | 255        |
| 27  | `today/widgets/fun.strings.ts`        | 4.19%      | 251        |
| 28  | `views/GymsView.tsx`                  | 0%         | 247        |
| 29  | `nutrition/addflow.tsx`               | 7.31%      | 228        |
| 30  | `views/SleepView.tsx`                 | 0%         | 227        |
| 31  | `components/SpotterSky.tsx`           | 1.73%      | 226        |
| 32  | `challenges.ts`                       | 31.4%      | 225        |
| 33  | `recaps.ts`                           | 1.76%      | 223        |
| 34  | `today/widgets/learnatlas.strings.ts` | 3.87%      | 223        |
| 35  | `components/ExerciseGallery.tsx`      | 0%         | 220        |
| 36  | `views/OnboardingView.tsx`            | 0%         | 214        |
| 37  | `views/ProfileView.tsx`               | 20%        | 212        |
| 38  | `today/widgets/body.strings.ts`       | 3.22%      | 210        |
| 39  | `today/widgets/apex.strings.ts`       | 5.79%      | 195        |
| 40  | `today/widgets/bodyplus.tsx`          | 49.86%     | 192        |

## 4. 87 файлів із 0% покриття

Класи: **чиста логіка/адаптер** (unit), **React-вʼю** (RTL-рендер), **точка входу/склейка** (smoke), **story/dev** (рішення власника). Опис береться з першого коментаря файлу.

Розподіл: точка входу/склейка — 8 файлів / 277 statements; чиста логіка/адаптер — 8 файлів / 216 statements; story/dev — 11 файлів / 310 statements; React-вʼю — 60 файлів / 5 078 statements.

### `views` (27 файлів, 3 386 statements)

| Файл                                | Statements | Клас      | Що це / як тестувати                                                                                                                                                                                                                      |
| ----------------------------------- | ---------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `views/CoachView.tsx`               | 545        | React-вʼю | Atlas — the coach screen (#/coach). First visit: a short setup (temper → the Merciless fine print → only the d…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |
| `views/ProgressView.tsx`            | 382        | React-вʼю | Progress — design S-34…S-36 + MG-3/MG-4 (by muscle, enriched detail). RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів.                                            |
| `views/AdminView.tsx`               | 255        | React-вʼю | Admin — design AD-01…AD-06. People table, invites, assignments. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів.                                                  |
| `views/GymsView.tsx`                | 247        | React-вʼю | Gyms — design S-41…S-48. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів.                                                                                         |
| `views/SleepView.tsx`               | 227        | React-вʼю | Sleep overlay — routes between the live night flow (night hub → honest wake → logged card) and, when awake, th…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |
| `views/OnboardingView.tsx`          | 214        | React-вʼю | Onboarding — design O-01…O-09. Steps end inside a live session. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів.                                                  |
| `views/SessionBuilderView.tsx`      | 171        | React-вʼю | Session Builder wizard. It opens on step 1 and walks the whole flow — physique goal (only if unset), intent, m…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |
| `views/InjuryView.tsx`              | 145        | React-вʼю | InjuryView — the Injury & Rehab ("Comeback") flow, built to match the design file "Spotter - Injury Rehab Full…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |
| `views/ExerciseDetailView.tsx`      | 133        | React-вʼю | Exercise detail (design RICH / SPARSE; MEDIA-1…5). The page reads the full record and degrades gracefully. A b…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |
| `views/ActivityView.tsx`            | 127        | React-вʼю | Activity page (design feature 6, ACT-2/3): a first-class screen, not a sheet. You land here after picking a ty…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |
| `views/ChallengesView.tsx`          | 123        | React-вʼю | Challenges — the hub you start goals from and track them in. Everything is local and derived (see challenges.t…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |
| `views/GymDetailView.tsx`           | 107        | React-вʼю | Gym detail — design G-06. Works for a saved gym OR an unsaved search result (candidate): shows photo/hours/ma…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів.  |
| `views/EquipmentDetailView.tsx`     | 101        | React-вʼю | EquipmentDetailView — the machine/equipment detail (design "My Fit · Machine Details", MD-02…MD-04). Behind ev…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |
| `views/TrainerView.tsx`             | 101        | React-вʼю | Trainer — design TR-01…TR-04. Assigned clients only, read-only. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів.                                                  |
| `views/ExerciseHistoryView.tsx`     | 75         | React-вʼю | Exercise history — design S-32/S-33 + EQ-3 (muscles, equipment, gyms). RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів.                                           |
| `views/ApexHome.tsx`                | 71         | React-вʼю | Apex — Home / Overview. The glanceable landing for the gamification app: active challenge (ring), current stre…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |
| `views/PlaybookView.tsx`            | 57         | React-вʼю | Playbook — routines LEARNED from real history (see playbook.ts). A peer tab of Programs/Exercises, and the pro…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |
| `views/programs/AssigneesSheet.tsx` | 57         | React-вʼю | Members drawer (design m12): tap a program's avatars (or "Assign") and the assignment opens straight away — wh…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |
| `views/TraineeSessionView.tsx`      | 56         | React-вʼю | Read-only session recap of a coached athlete's workout, for a trainer/admin. The athlete's workouts aren't cli…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |
| `views/MuscleHistoryView.tsx`       | 55         | React-вʼю | Muscle history — direct drilldown from muscle chips across the app. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів.                                              |
| `views/GoalsView.tsx`               | 35         | React-вʼю | Goals ("My Fit") — the fourth peer tab of Programs/Playbook/Exercises. Programs say WHAT you train; Goals say…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів.  |
| `views/FocusEditor.tsx`             | 32         | React-вʼю | Focus editor (Goals · design GL-03): set each fine muscle to grow / hold / ease for the current block. A live…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів.  |
| `views/PhysiquePicker.tsx`          | 31         | React-вʼю | Physique picker (Goals · design GL-02/02b). Sex-aware archetype cards — each previews its shape on the muscle…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів.  |
| `views/ProgramAssignDialog.tsx`     | 28         | React-вʼю | Assign a program to members (PG-03): searchable multi-select, start point, replace warning. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів.                      |
| `views/SettingsView.tsx`            | 8          | React-вʼю | App settings — admin only, web only. Toggles for feature flags; everything defaults off. Reached from the desk…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |
| `views/ExerciseLibraryView.tsx`     | 2          | React-вʼю | Exercises tab (design LIB-1/LIB-2, AC-LIBTAB). A peer tab of Programs — it shares the `programs-page` chrome a…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |
| `views/recap/RecapHead.tsx`         | 1          | React-вʼю | Header of the scrolling recap: back, title, and the story / share actions. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів.                                       |

### `components` (26 файлів, 1 410 statements)

| Файл                               | Statements | Клас      | Що це / як тестувати                                                                                                                                                                                                                      |
| ---------------------------------- | ---------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/ExerciseGallery.tsx`   | 220        | React-вʼю | Exercise gallery (design LIB-1 phone list, LIB-2 web filter-rail + grid). Web is a left filter rail (muscle gr…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |
| `components/AvatarUploader.tsx`    | 181        | React-вʼю | Reusable avatar add/edit pattern from onboarding: source choice, circular crop with zoom, then authenticated u…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |
| `components/EquipmentBoard.tsx`    | 134        | React-вʼю | EquipmentBoard — the per-gym inventory board ("My Fit · Machine Details" MD-01). Tick the equipment a gym has,…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |
| `components/BodyMetrics.tsx`       | 118        | React-вʼю | Body-metrics block for the profile page (AC Body metrics §2/§8). Owner-editable: weigh-in hero, height + calcu…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |
| `components/FeatsView.tsx`         | 92         | React-вʼю | Feats tab (in Progress): achievements across many axes, derived from history. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів.                                    |
| `components/SessionMuscleMap.tsx`  | 76         | React-вʼю | Session muscle map — a full-body, colour-coded picture of where each muscle stands this week (today's sets inc…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |
| `components/TimelineRange.tsx`     | 76         | React-вʼю | TimelineRange (design 06) — pick an activity's start and end on a day timeline instead of separate Start + Dur…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |
| `components/RecapBlock.tsx`        | 67         | React-вʼю | Recap entry block for Notifications (design RC-01/01b/01e): a "Your recaps" shelf pinned above the alert strea…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |
| `components/TrendsView.tsx`        | 56         | React-вʼю | Trends / Analysis tab: curated insight cards, three across per row. Card shapes: balance · muscle-list · hori…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів.  |
| `components/TrainerLiveBanner.tsx` | 52         | React-вʼю | Coach's live-athlete banner (Today). While an athlete this trainer coaches is training, their session shows he…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |
| `components/BandLibraryCard.tsx`   | 48         | React-вʼю | Band library editor (Load-entry C-5): a colour → estimated-kg map, set once per gym and reused by every band e…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |
| `components/StatShareSheet.tsx`    | 41         | React-вʼю | Share bottom sheet for the Apex stat cards (awards · standards). Mirrors the workout/recap share sheet: a live…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |
| `components/PhotoSlider.tsx`       | 32         | React-вʼю | Full-screen photo slider — an exercise's frames (start → end of the movement) swiped horizontally with scroll-…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |
| `components/HomeMovePicker.tsx`    | 31         | React-вʼю | Add / replace a move in a home set session (design "Home set" · Add move): only home moves — your own and Spot…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |
| `components/EffortGauge.tsx`       | 30         | React-вʼю | EffortGauge — the semicircular effort dial (design 03), colour-graded by level: the arc runs green → amber → r…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |
| `components/StandardsView.tsx`     | 30         | React-вʼю | Standards (Заліки) sub-tab: your lifts vs rank norms + strength levels. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів.                                          |
| `components/FixSheet.tsx`          | 29         | React-вʼю | Fix-it suggestion sheet (design FIX-2/3): pick a lagging muscle, get real exercises that hit it and that your…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів.  |
| `components/ChatChart.tsx`         | 28         | React-вʼю | A small line chart inside an Atlas chat bubble: title, first → last value, and a sparkline with the min/max ma…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |
| `components/AmenitiesCard.tsx`     | 22         | React-вʼю | Gym amenities editor: toggle what this gym really has; detected ones are hinted. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів.                                 |
| `components/MuscleStatePanel.tsx`  | 18         | React-вʼю | A muscle's state right now, shown inside the muscle drawer when a chip is tapped in the live session: the read…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |
| `components/SleepHero.tsx`         | 13         | React-вʼю | Sleep hero — the sleep counterpart to the live-session hero (LiveHero). While a night is live but you're off t…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |
| `components/AtlasNotesPanel.tsx`   | 6          | React-вʼю | Progress → Atlas: his latest notes (newest first) above the trend cards — the same trends, now with a coach's…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів.  |
| `components/SessionEnergy.tsx`     | 4          | React-вʼю | Per-session energy (feature 6). One number — the MET-based kcal estimate for a single workout (session wall-cl…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |
| `components/PeriodEditSheet.tsx`   | 3          | React-вʼю | The Health edit form (dates, kind, name, delete) in a drawer — opened from a History row so a logged illness…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів.   |
| `components/Switcher.tsx`          | 2          | React-вʼю | Switcher — a segmented control with a sliding pill thumb (not tabs). The highlight animates between N equal sl…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |
| `components/LavaBackground.tsx`    | 1          | React-вʼю | The app's ambient background: three soft glows that drift like a lava lamp. At rest they sit exactly where the…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |

### `coach` (10 файлів, 340 statements)

| Файл                                    | Statements | Клас                 | Що це / як тестувати                                                                                                                                                                                                                                                  |
| --------------------------------------- | ---------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `coach/data/firestore/install.ts`       | 147        | точка входу/склейка  | Selects the real adapters. This runs whenever the backend mode is `firestore` (the default outside tests and S…. Тонка склейка: smoke-тест монтування/реєстрації з фейковими портами; реекспорт покривається імпортом.                                                |
| `coach/data/firestore/bootstrap.ts`     | 57         | точка входу/склейка  | The one real caller of `installFirestoreCoach` / `installFirestoreClient`. Loaded lazily (dynamic import) only…. Тонка склейка: smoke-тест монтування/реєстрації з фейковими портами; реекспорт покривається імпортом.                                                |
| `coach/client/ClientBridge.tsx`         | 42         | точка входу/склейка  | Renders nothing. While the `coach` flag is on it keeps the eager parts of the real app up to date: the unread…. Тонка склейка: smoke-тест монтування/реєстрації з фейковими портами; реекспорт покривається імпортом.                                                 |
| `coach/schedule/ScheduleStoryFrame.tsx` | 25         | story/dev            | Stories: the real shell around a schedule route with a chosen schedule port (the world is the lab fixtures). T…. Story- або dev-допоміжний код: окремі тести не потрібні; покривається прогоном Storybook. Рішення власника: тримати в метриці чи винести (розділ 6). |
| `coach/program/storyKit.tsx`            | 22         | story/dev            | Three rows of the Oleh draft are "just the exercise": no sets, no targets (editor-bare-rows, diagnostics-bare)…. Story- або dev-допоміжний код: окремі тести не потрібні; покривається прогоном Storybook. Рішення власника: тримати в метриці чи винести (розділ 6). |
| `coach/share/ShareStoryFrame.tsx`       | 16         | story/dev            | Lower one category of Oleh (c1) in the share source. Story- або dev-допоміжний код: окремі тести не потрібні; покривається прогоном Storybook. Рішення власника: тримати в метриці чи винести (розділ 6).                                                             |
| `coach/domain/index.ts`                 | 12         | точка входу/склейка  | —. Тонка склейка: smoke-тест монтування/реєстрації з фейковими портами; реекспорт покривається імпортом.                                                                                                                                                              |
| `coach/schedule/GroupMoveSummary.tsx`   | 12         | React-вʼю            | Trainer-only summary of a whole-session move: how many attendees said yes, who is still waiting, who declined…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів.                              |
| `coach/data/firestoreConversations.ts`  | 6          | чиста логіка/адаптер | Firestore adapter for the unread map. Query shape is fixed by the rules (`trainerId == uid && active == true`)…. Unit без DOM: вхід-вихід, межі, помилки; зовнішнє (Firestore, window.ai, мережа) через порт-фейк.                                                    |
| `coach/data/firestore/deltaCache.ts`    | 1          | чиста логіка/адаптер | The previous raw `coachRead` answer of one client (workouts for totals / sets), kept between refreshes in the…. Unit без DOM: вхід-вихід, межі, помилки; зовнішнє (Firestore, window.ai, мережа) через порт-фейк.                                                     |

### `today` (4 файлів, 230 statements)

| Файл                            | Statements | Клас      | Що це / як тестувати                                                                                                                                                                                                                                                 |
| ------------------------------- | ---------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `today/HistoryCalendar.tsx`     | 154        | React-вʼю | History on Today (design K2 mobile / K3 desktop): the header with the Timeline · Calendar toggle, and the Cale…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів.                            |
| `today/CoreConfigSheet.tsx`     | 52         | React-вʼю | Settings of one core block (design B6 "Program & week", A2 "Atlas & clients", plus Nudges and History). Every…. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів.                             |
| `today/WidgetLibrary.tsx`       | 13         | story/dev | Widget library (internal): every registered widget in S · M · L · XL and every XS shortcut — the code twin of…. Story- або dev-допоміжний код: окремі тести не потрібні; покривається прогоном Storybook. Рішення власника: тримати в метриці чи винести (розділ 6). |
| `today/WidgetLibraryScreen.tsx` | 11         | story/dev | Dev-only screen at #/widgets: the widget library on the real account data. Story- або dev-допоміжний код: окремі тести не потрібні; покривається прогоном Storybook. Рішення власника: тримати в метриці чи винести (розділ 6).                                      |

### `stories` (6 файлів, 223 statements)

| Файл                                  | Statements | Клас      | Що це / як тестувати                                                                                                                                                                                                                                                  |
| ------------------------------------- | ---------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stories/bannerStudy/BannerStudy.tsx` | 155        | story/dev | —. Story- або dev-допоміжний код: окремі тести не потрібні; покривається прогоном Storybook. Рішення власника: тримати в метриці чи винести (розділ 6).                                                                                                               |
| `stories/cycle/CycleStudy.tsx`        | 51         | story/dev | Cycle concept study (docs: «Цикл — концепція для Spotter»). Real kit components with demo data; no store, no w…. Story- або dev-допоміжний код: окремі тести не потрібні; покривається прогоном Storybook. Рішення власника: тримати в метриці чи винести (розділ 6). |
| `stories/coachStoryKit.tsx`           | 8          | story/dev | Stories: the real shell (rail / tab bar by window width) around one route, with a chosen world port. `port` is…. Story- або dev-допоміжний код: окремі тести не потрібні; покривається прогоном Storybook. Рішення власника: тримати в метриці чи винести (розділ 6). |
| `stories/LocaleMatrix.tsx`            | 4          | story/dev | Renders the same primitive once per locale with that locale's real strings — the long-text check (pl / lt / e…. Story- або dev-допоміжний код: окремі тести не потрібні; покривається прогоном Storybook. Рішення власника: тримати в метриці чи винести (розділ 6).  |
| `stories/bannerStudy/data.ts`         | 4          | story/dev | Ukrainian editorial fixtures for a design study, not production UI strings. Story- або dev-допоміжний код: окремі тести не потрібні; покривається прогоном Storybook. Рішення власника: тримати в метриці чи винести (розділ 6).                                      |
| `stories/PageFrame.tsx`               | 1          | story/dev | Full-height column like the app shell's main area, so `.screen` pages lay out (and scroll) exactly as in the…. Story- або dev-допоміжний код: окремі тести не потрібні; покривається прогоном Storybook. Рішення власника: тримати в метриці чи винести (розділ 6).   |

### `atlas` (3 файлів, 124 statements)

| Файл                       | Statements | Клас                 | Що це / як тестувати                                                                                                                                                                                                   |
| -------------------------- | ---------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `atlas/actions.ts`         | 70         | чиста логіка/адаптер | Doing what Atlas offered in chat — always after the athlete tapped "Do it". Each action returns the line Atlas…. Unit без DOM: вхід-вихід, межі, помилки; зовнішнє (Firestore, window.ai, мережа) через порт-фейк.     |
| `atlas/puter.ts`           | 52         | чиста логіка/адаптер | The spare engine: when Gemini's free quota for the day is used up, Atlas can talk through Puter.js (https://do…. Unit без DOM: вхід-вихід, межі, помилки; зовнішнє (Firestore, window.ai, мережа) через порт-фейк.     |
| `atlas/retrieve.worker.ts` | 2          | точка входу/склейка  | Builds Atlas's understanding index off the main thread — it takes a few seconds on a phone and would otherwise…. Тонка склейка: smoke-тест монтування/реєстрації з фейковими портами; реекспорт покривається імпортом. |

### `nutrition` (2 файлів, 57 statements)

| Файл                     | Statements | Клас                 | Що це / як тестувати                                                                                                                                                                                               |
| ------------------------ | ---------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `nutrition/ai.ts`        | 36         | чиста логіка/адаптер | On-device dish estimation via Chrome's built-in AI (Gemini Nano / Prompt API). Free, local, no API key, no tok…. Unit без DOM: вхід-вихід, межі, помилки; зовнішнє (Firestore, window.ai, мережа) через порт-фейк. |
| `nutrition/AuthView.tsx` | 21         | React-вʼю            | —. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів.                                                                                        |

### `tools` (3 файлів, 43 statements)

| Файл                                             | Statements | Клас      | Що це / як тестувати                                                                                                                                                                                                       |
| ------------------------------------------------ | ---------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools/programEditor/ui/panes/LibraryPanes.tsx`  | 21         | React-вʼю | —. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів.                                                                                                |
| `tools/programEditor/ui/panes/SwapPairPanes.tsx` | 19         | React-вʼю | —. RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів.                                                                                                |
| `tools/programEditor/ui/ChangeList.tsx`          | 3          | React-вʼю | What changed between two versions of a program, one line each (the version row of the info band). RTL: рендер зі store-фікстурою, ключові взаємодії, порожній/офлайн-стан; вʼю без логіки лишається на партію компонентів. |

### `(файли кореня)` (5 файлів, 37 statements)

| Файл               | Statements | Клас                 | Що це / як тестувати                                                                                                                                                                                                   |
| ------------------ | ---------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `conditionText.ts` | 16         | чиста логіка/адаптер | Human wording for the effects of long-term conditions (shared by the session, detail and coach views). Unit без DOM: вхід-вихід, межі, помилки; зовнішнє (Firestore, window.ai, мережа) через порт-фейк.               |
| `main.tsx`         | 15         | точка входу/склейка  | Older versions kept readable copies of callable reads in localStorage: remove them on the first run. Тонка склейка: smoke-тест монтування/реєстрації з фейковими портами; реекспорт покривається імпортом.             |
| `name.ts`          | 4          | чиста логіка/адаптер | —. Unit без DOM: вхід-вихід, межі, помилки; зовнішнє (Firestore, window.ai, мережа) через порт-фейк.                                                                                                                   |
| `LearnApp.tsx`     | 1          | точка входу/склейка  | Learn — how-to videos, integrated into the Spotter suite. The module lives under ./learn (its own gem-accented…. Тонка склейка: smoke-тест монтування/реєстрації з фейковими портами; реекспорт покривається імпортом. |
| `NutritionApp.tsx` | 1          | точка входу/склейка  | Nutrition — the food/КБЖУ app, integrated into the Spotter suite. The whole thing (its own lazurite kit, store…. Тонка склейка: smoke-тест монтування/реєстрації з фейковими портами; реекспорт покривається імпортом. |

### `data` (1 файлів, 31 statements)

| Файл                  | Statements | Клас                 | Що це / як тестувати                                                                                                                                                                                               |
| --------------------- | ---------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `data/programDays.ts` | 31         | чиста логіка/адаптер | Per-day program status + outlook (AC-PROG-10, AC-PLAN-11). Pure functions so the member program detail and a n…. Unit без DOM: вхід-вихід, межі, помилки; зовнішнє (Firestore, window.ai, мережа) через порт-фейк. |

## 5. Пропонований поділ на 12 партій (за цінністю й ризиком)

Порядок: спершу чиста логіка й моделі (дешево, висока цінність, регрес-тести моделей за `models-and-formulas.md`), далі сховища й крипто (ризикове: незалежне рев'ю), адаптери, Coach, віджети Today, сесія, екрани, компоненти; остання партія — словники (за рішенням власника). Оцінка = непокриті statements у базі, за якою партія закриває свою частину; фактично для 90% по групі потрібно покрити приблизно 90% її statements, не всі непокриті. Кожна партія = один коміт, `include` групи + поріг у `coverage-thresholds.json`.

| Партія                                         | Зміст                                                                                                                                                                        | Файлів | Не покрито |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- |
| B1 Чиста логіка й моделі                       | Чиста логіка кореня й data (прогресія, рекапи, виклики, тренди, досягнення, майстерність, таймер відпочинку, CSV/програми)                                                   | 90     | 2 228      |
| B2 Store, vault, крипто, офлайн (ризикова)     | Store, vault, sync, офлайн (ризикова група: шифрування — незалежне рев'ю)                                                                                                    | 25     | 1 779      |
| B3 Data-адаптери й Atlas                       | Data-адаптери й Atlas-логіка поза чистими модулями (shareCard, gymProviders, Atlas actions/flows/chat/puter/query/intents, nutrition off/calc/ai)                            | 73     | 1 976      |
| B4 Coach: дані й адаптери                      | Coach: дані, firestore-адаптери, сховища, домен (без React)                                                                                                                  | 113    | 1 153      |
| B5 Coach: React                                | Coach: React-екрани й компоненти (client, schedule, share, program)                                                                                                          | 71     | 786        |
| B6 Today-віджети I                             | Today-віджети I: muscles, strength, plan                                                                                                                                     | 3      | 1 633      |
| B7 Today-віджети II + Today                    | Today-віджети II та екран Today (fun, learnatlas, training, discover, cardio, bodyplus, apex, calendar, body, TodayCustomize, HistoryCalendar, AtlasClientsBlock, TodayView) | 23     | 3 054      |
| B8 SessionView і сесійні компоненти            | SessionView та сесійні компоненти (найбільший файл; тримати поріг по групі, не по файлу)                                                                                     | 16     | 2 830      |
| B9 Екрани учасника                             | Екрани учасника: Progress, Sleep, Gyms, Onboarding, Injury, Activity, Challenges, Profile та ін.                                                                             | 81     | 3 643      |
| B10 Екрани тренера/адміна, редактор програм    | Екрани тренера й адміна + програмний редактор (CoachView, AdminView, TrainerView, tools/)                                                                                    | 26     | 1 122      |
| B11 Компоненти, App, stories                   | Компоненти (RTL): решта components/, App.tsx, main.tsx, stories/                                                                                                             | 105    | 3 754      |
| B12 Словники (статичні дані; рішення власника) | `i18n/*.ts` та `today/widgets/*.strings.ts`, `i18n/{cyc,sup,coachShare,coachToday,atlas}.*.ts`                                                                               | 45     | 6 804      |

Сума: 30 762 = весь непокритий код (30 762).

Деталізація файлів по партіях (в порядку спадання непокритих; B12 див. розділ 6):

**B1. Чиста логіка й моделі** (90 файлів, 2 228 не покрито)

`challenges.ts` 225, `recaps.ts` 223, `data/programCsv.ts` 177, `trends.ts` 123, `notifications.ts` 121, `motion.ts` 104, `feats.ts` 95, `mastery.ts` 86, `restTimer.ts` 72, `data/programMine.ts` 70, `today/calendarData.ts` 65, `data/exercises.ts` 59, `picker.ts` 55, `data/programSeed.ts` 51, `standards.ts` 45, `today/strings.ts` 39, `volume.ts` 37, `data/flags.ts` 34, `fixit.ts` 31, `data/programDays.ts` 31, `edgeSwipeBack.ts` 29, `data/equipmentCatalog.ts` 28, `cycleCache.ts` 23, `usePwaInstall.ts` 22, `playbook.ts` 19, … ще 65 дрібніших

**B2. Store, vault, крипто, офлайн (ризикова)** (25 файлів, 1 779 не покрито)

`store.ts` 1306, `nutrition/store.ts` 65, `vaultIO.ts` 64, `push.ts` 62, `offline/sealedLocal.ts` 43, `api.ts` 39, `avatarStore.ts` 38, `pwaUpdate.ts` 36, `nutrition/auth.ts` 25, `offline/offlineCache.ts` 20, `autoVault.ts` 18, `deviceWipe.ts` 18, `i18n/index.ts` 11, `firebase.ts` 8, `coachCrypto/sealOrThrow.ts` 7, `coachCrypto/envelope.ts` 3, `accountOverrides.ts` 2, `vaultCrypto.ts` 2, `vaultMigrate.ts` 2, `vaultShare.ts` 2, `coachCrypto/conversationKey.ts` 2, `coachCrypto/signingPins.ts` 2, `offline/snapshot.ts` 2, `vaultGrants.ts` 1, `coachCrypto/newCollections.ts` 1

**B3. Data-адаптери й Atlas** (73 файлів, 1 976 не покрито)

`data/shareCard.ts` 507, `data/gymProviders.ts` 396, `atlas/flows.ts` 130, `atlas/intents.ts` 87, `atlas/actions.ts` 70, `atlas/chat.ts` 55, `atlas/puter.ts` 52, `nutrition/off.ts` 52, `atlas/query.ts` 50, `atlas/grammar/lang/en.ts` 39, `nutrition/calc.ts` 39, `atlas/grammar/clauses.ts` 36, `nutrition/ai.ts` 36, `atlas/grammar/lang/slav.ts` 26, `atlas/memory.ts` 24, `atlas/noteSeen.ts` 22, `atlas/chatLog.ts` 21, `atlas/schedule.ts` 21, `data/daySuggest.ts` 20, `atlas/intentsFifth.ts` 18, `atlas/grammar/parse.ts` 16, `atlas/translate.ts` 14, `atlas/compose.ts` 13, `atlas/notes.ts` 13, `atlas/understand.ts` 12, … ще 48 дрібніших

**B4. Coach: дані й адаптери** (113 файлів, 1 153 не покрито)

`coach/data/firestore/install.ts` 147, `coach/data/firestore/worldPort.ts` 67, `coach/data/firestore/bootstrap.ts` 57, `coach/client/data/chatStore.ts` 42, `coach/data/firestore/clientPort.ts` 42, `coach/data/firestore/firebaseFs.ts` 36, `coach/schedule/scheduleStore.ts` 34, `coach/data/firestore/signerStore.ts` 32, `coach/program/draftStore.ts` 28, `coach/schedule/model.ts` 28, `coach/data/unavailable.ts` 25, `coach/data/firestore/ringBook.ts` 23, `coach/data/firestore/programPort.ts` 20, `coach/data/firestore/parity/harness.ts` 19, `coach/chat/cachedPort.ts` 18, `coach/schedule/view.ts` 17, `coach/screens/format.ts` 17, `coach/security/trustStore.ts` 17, `coach/share/search.ts` 17, `coach/chat/chatDrafts.ts` 16, `coach/client/data/useClientChat.ts` 16, `coach/data/firestore/keyRing.ts` 16, `coach/data/backend.ts` 14, `coach/data/firestore/chatPort.ts` 14, `coach/data/firestore/memoryFs.ts` 14, … ще 88 дрібніших

**B5. Coach: React** (71 файлів, 786 не покрито)

`coach/share/LibraryPeek.tsx` 59, `coach/threadExtras.tsx` 44, `coach/client/ClientBridge.tsx` 42, `coach/client/ClientExtras.tsx` 38, `coach/client/screens/ClientSchedule.tsx` 37, `coach/client/screens/ClientChat.tsx` 33, `coach/schedule/RescheduleForm.tsx` 33, `coach/schedule/CalendarSettingsForm.tsx` 28, `coach/schedule/ScheduleStoryFrame.tsx` 25, `coach/share/SharePicker.tsx` 25, `coach/client/screens/InvitePages.tsx` 24, `coach/program/EditorScreen.tsx` 23, `coach/client/ClientRoutes.tsx` 22, `coach/program/storyKit.tsx` 22, `coach/screens/Client360Screen.tsx` 21, `coach/screens/RosterScreen.tsx` 18, `coach/notes/NotesPanel.tsx` 16, `coach/share/ShareStoryFrame.tsx` 16, `coach/schedule/SessionInspector.tsx` 15, `coach/screens/Client360Strength.tsx` 14, `coach/client/screens/TrainerSharing.tsx` 12, `coach/schedule/GroupMoveSummary.tsx` 12, `coach/schedule/ScheduleScreen.tsx` 12, `coach/CoachScreens.tsx` 10, `coach/schedule/WeekGrid.tsx` 10, … ще 46 дрібніших

**B6. Today-віджети I** (3 файлів, 1 633 не покрито)

`today/widgets/muscles.tsx` 571, `today/widgets/strength.tsx` 536, `today/widgets/plan.tsx` 526

**B7. Today-віджети II + Today** (23 файлів, 3 054 не покрито)

`today/widgets/fun.tsx` 354, `today/widgets/learnatlas.tsx` 329, `views/TodayView.tsx` 315, `today/widgets/training.tsx` 300, `today/widgets/discover.tsx` 284, `today/widgets/cardio.tsx` 271, `today/widgets/bodyplus.tsx` 192, `today/TodayCustomize.tsx` 190, `today/AtlasClientsBlock.tsx` 181, `today/widgets/apex.tsx` 175, `today/HistoryCalendar.tsx` 154, `today/widgets/calendar.tsx` 93, `today/widgets/body.tsx` 81, `today/CoreConfigSheet.tsx` 52, `today/shortcuts.tsx` 18, `today/layout.ts` 15, `today/WidgetLibrary.tsx` 13, `today/WidgetLibraryScreen.tsx` 11, `today/widgets/cycle.tsx` 10, `today/widgets/format.ts` 9, `today/CustomSectionView.tsx` 5, `today/clientRoster.ts` 1, `today/myTrainer.ts` 1

**B8. SessionView і сесійні компоненти** (16 файлів, 2 830 не покрито)

`views/SessionView.tsx` 1583, `components/ExerciseGallery.tsx` 220, `views/SessionBuilderView.tsx` 171, `views/ExerciseDetailView.tsx` 133, `components/ExercisePicker.tsx` 126, `components/StartSheet.tsx` 115, `components/SessionMuscleMap.tsx` 76, `components/SessionStartCoach.tsx` 76, `views/ExerciseHistoryView.tsx` 75, `components/EquipmentPickerSheet.tsx` 65, `components/PlateSheet.tsx` 57, `views/TraineeSessionView.tsx` 56, `components/HoldWatchSet.tsx` 41, `components/EffortGauge.tsx` 30, `components/SessionEnergy.tsx` 4, `views/ExerciseLibraryView.tsx` 2

**B9. Екрани учасника** (81 файлів, 3 643 не покрито)

`views/ProgressView.tsx` 382, `views/GymsView.tsx` 247, `views/SleepView.tsx` 227, `views/OnboardingView.tsx` 214, `views/ProfileView.tsx` 212, `views/RecapView.tsx` 173, `views/MasteryView.tsx` 151, `views/InjuryView.tsx` 145, `views/LogActivityView.tsx` 136, `views/ActivityView.tsx` 127, `views/ChallengesView.tsx` 123, `views/GymDetailView.tsx` 107, `views/EquipmentDetailView.tsx` 101, `views/programs/ProgramPage.tsx` 100, `views/ProgramsView.tsx` 86, `views/ApexHome.tsx` 71, `views/NotificationsView.tsx` 67, `learn/App.tsx` 61, `views/PlaybookView.tsx` 57, `views/health/HealthForm.tsx` 57, `views/programs/AssigneesSheet.tsx` 57, `views/MuscleHistoryView.tsx` 55, `views/ProgramCsvDialog.tsx` 52, `views/OverviewView.tsx` 41, `views/health/BodyMapPicker.tsx` 36, … ще 56 дрібніших

**B10. Екрани тренера/адміна, редактор програм** (26 файлів, 1 122 не покрито)

`views/CoachView.tsx` 545, `views/AdminView.tsx` 255, `views/TrainerView.tsx` 101, `tools/programEditor/ui/ProgramEditor.tsx` 51, `tools/programEditor/ui/panes/RowPane.tsx` 29, `tools/programEditor/ui/panes/LibraryPanes.tsx` 21, `tools/programEditor/ui/panes/SwapPairPanes.tsx` 19, `tools/programEditor/ui/panes/DayPanes.tsx` 17, `tools/programEditor/model/ops.ts` 14, `tools/programEditor/ui/CheckReport.tsx` 11, `tools/programEditor/ui/WeekCanvas.tsx` 8, `tools/programEditor/stories/demoHost.tsx` 7, `tools/programEditor/check/engine.ts` 6, `tools/programEditor/ui/Panes.tsx` 6, `tools/programEditor/ui/panes/ActivityPanes.tsx` 6, `tools/programEditor/stories/HostPair.tsx` 4, `tools/programEditor/ui/DayCard.tsx` 4, `tools/programEditor/ui/panes/AddPane.tsx` 4, `tools/programEditor/model/diff.ts` 3, `tools/programEditor/ui/ChangeList.tsx` 3, `tools/programEditor/model/doc.ts` 2, `tools/programEditor/ui/panes/WarmupPane.tsx` 2, `tools/programEditor/model/pipeline.ts` 1, `tools/programEditor/ui/text.ts` 1, `tools/programEditor/ui/panes/ExerciseAsClient.tsx` 1, … ще 1 дрібніших

**B11. Компоненти, App, stories** (105 файлів, 3 754 не покрито)

`App.tsx` 455, `nutrition/addflow.tsx` 228, `components/SpotterSky.tsx` 226, `components/AvatarUploader.tsx` 181, `components/PickerFields.tsx` 174, `components/SleepAutomation.tsx` 159, `stories/bannerStudy/BannerStudy.tsx` 155, `components/EquipmentBoard.tsx` 134, `components/Muscle.tsx` 123, `components/BodyMetrics.tsx` 118, `nutrition/views.tsx` 98, `components/FeatsView.tsx` 92, `components/GymPicker.tsx` 92, `components/TimelineRange.tsx` 76, `components/HistoryTimeline.tsx` 71, `components/GymKit.tsx` 67, `components/RecapBlock.tsx` 67, `components/RouteMap.tsx` 61, `components/TrendsView.tsx` 56, `components/ui/overlays/useSheetGesture.ts` 54, `components/TrainerLiveBanner.tsx` 52, `components/DayHistorySheet.tsx` 51, `components/ui/AnatomyTurntable.tsx` 51, `stories/cycle/CycleStudy.tsx` 51, `components/BandLibraryCard.tsx` 48, … ще 80 дрібніших

## 6. Питання про словники i18n (рішення власника, не приймається в цьому аудиті)

Словники — статичні об'єкти рядків і невеликі функції-плюралі; «покриття» їх рахується лише за тим, що тест випадково імпортував. Якість тримають `npm run i18n:check`, `tests/i18n.test.ts` (паритет ключів), `tests/i18n-length.test.ts`, `kit-guard`, а не покриття рядків.

- П'ять основних словників `i18n/{en,uk,pl,lt,et}.ts`: **3 827** непокритих statements (uk 834, pl 820, lt 819, et 796, en 558). Разом із додатковими (`i18n/{cyc,sup,coachShare,coachToday,atlas}.*`, `coachClient/Live/Programs/Safe`) та **11 файлами `today/widgets/*.strings.ts`** (2 667): **45 файлів, 6 804** непокритих, це **30% розриву до цілі 90%** (22 725 для statements). У плані SPO-46 згадано ~4 700 (4 148 — вся `i18n/`; без `today/**/*.strings.ts`).

| Варіант                               | Statements зараз         | Бракує до 90% | Бракує до 80% (для порівняння) | Що змінюється                                                                                                                                                                                                                                                                                                  |
| ------------------------------------- | ------------------------ | ------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Лишити в метриці**               | 61.72%                   | 22 725        | 14 688                         | Нічого не виключаємо; словники піднімаємо тестами «усі ключі всіх локалей прочитано» (рядки у словнику — це `Object` літерали, тож один тест-обхід усіх ключів і викликів плюралів закриває більшість; сенс як перевірки — паритет, а не логіка). Поріг лишається чесним.                                      |
| **B. Виключити лише файли словників** | 66.67% (метрика без них) | 16 769        | 9 581                          | Нова `exclude` — **лише** з записом у Linear і вашим рішенням (правило SPO-47). Решта цілі лишається 90%; словники стережуть `i18n:check` і паритет-тести. Ризик: у файл словника можна покласти логіку, і вона випаде з метрики; запобіжник — окремий guard «у словниках лише літерали та плюральні функції». |

Метрики без 45 файлів словників: statements 66.67%, branches 59.38%, functions 63.85%, lines 68.13%. Тільки п'ять основних: statements 64.61%.

Вибір за власником. Для довідки: A не створює прецеденту `exclude`, але вимагає ~6 800 statements «тестів на літерали»; B економить цю роботу, але відкриває прецедент `exclude`.

## 7. Що насправді перевіряють нинішні гейти

### Кореневий `vitest.config.ts`

- `include` (тести): `tests/**/*.test.{ts,tsx}` — 28 файлів: `tests/store.test.ts`, `ui`, `i18n*`, `kit-guard`, `hygiene-ratchet`, `coach-server/*` (6, імпортують `functions/src`), `rules/*` (5 файлів, див. нижче), `server-api`, `vault-server`, `sleep-auto-server`, `recaps`, `programCsv`, `programSeed` тощо.
- `coverage.include` (що міряється): **лише 4 файли** — `client/src/i18n/index.ts`, `server/src/{auth,gyms,workouts}.ts` (останні три — легасі). Пороги 90/70/90/90.
- Фактично (прогін `npm run test:coverage`, 72 с на цій машині): 27 файлів passed, 1 skipped (`coach.rules.test.ts`, 70 тестів skipped); statements **91,34%**, branches **79,52%**, functions **96,66%**, lines **94,44%** — гейт зелений, але міряє 439 statements із 80 372 (0,5% коду продукту).

### `client/vitest.config.ts`

- `include` тестів: `src/**/*.test.{ts,tsx}` — **528 файлів, 5 786 тестів**.
- `coverage.include`: `src/i18n/**`, `src/data/**`; пороги 80/80/80/80.
- Цей гейт **ніде не запускається** (див. нижче), а за вимірами цього аудиту він був би **червоним**: для файлів цих каталогів з повного прогону `i18n/**`+`data/**` = (4 652 + 597) / (8 800 + 1 984) = **48,7%** statements (i18n 52,9%, data 30,1%), тобто нижче 80. Поріг — вимога без підтвердження; етап 2 має або піднести покриття цих каталогів, або чесно виставити поріг (але знижувати заборонено), тому в `coverage-thresholds.json` він записаний «як є», а реальна цифра — у `client_full_baseline`.

### Як запускається CI (`.github/workflows/ci.yml`)

- Джоб `tests` («Unit tests + coverage gate»): `npm ci`, `npm ci --prefix functions`, `npm run test:coverage` = кореневий `vitest run --coverage`. Це **усі 28 файлів `tests/`**, жодного з `client/src/**/*.test.*`.
- **Клієнтські 528 файлів у CI не запускаються взагалі** — ні з покриттям, ні без (`client/package.json` має `test`/`test:coverage`, але CI їх не викликає; `workspaces` не запускають `test`). Те ж у pre-push: `npm run test:coverage` — теж кореневий. Stop-hook Claude Code запускає лише `kit-guard`, `hygiene-ratchet`, `i18n-length`. Локально клієнтські тести запускають вручну (`cd client && npx vitest run src/<шлях>`).
- Інші джоби: `lint`, `format`, `types` (tsc, `deps:check`, validate-sql, `npm audit`), `build`, `security` (Semgrep), `smoke` (API на SQLite), `storybook` + `layout-shard` (геометрія в Playwright/Chromium на Storybook) + `layout`. Жоден не запускає unit-тести клієнта, rules на емуляторі чи `tests/e2e`.
- Звіт покриття: джоб `tests` вивантажує артефакт `client/coverage` з `if-no-files-found: ignore`; кореневий прогін пише в `./coverage`, тож артефакт фактично порожній (немає summary в UI).
- `functions/` (Cloud Functions): власних тестів немає; перевіряються лише через `tests/coach-server/*`, а їхнє покриття не міряється (поза `coverage.include`).

### Rules-тести

- `tests/rules/` — 5 файлів. `rulesEngine`, `coach.rules.logic`, `storage.rules.logic`, `adversarial.rules` ганяються в CI у джобі `tests` через **власний інтерпретатор правил** (`tests/rules/engine`) — без емулятора.
- `tests/rules/coach.rules.test.ts` (справжній Firestore Emulator) — при відсутності `FIRESTORE_EMULATOR_HOST` **SKIPPED** (70 тестів skipped у прогоні вище). `npm run test:rules` (`firebase emulators:exec …`) **у CI не запускається ніде** (`docs/RULES-AUDIT.md`: «test:rules на емуляторі в CI — немає, SPO-138»; `docs/COACH-STATUS.md`: «Never run yet»). У цьому середовищі спроба `npm run test:rules` теж не пройшла: `firebase: not found` (`firebase-tools` не в `devDependencies`, Java є). Отже, «rules на емуляторі» — реально не підтверджені жодним прогоном. Покриття rules по гілках не міряється.

### E2E

- Playwright: `tests/e2e/*.e2e.ts` (7 файлів `*.e2e.ts`: coach-smoke, coach-a11y, my-fit, offline-startup, edge-back-swipe, layout-shift-screens, today-layout-shift; плюс helpers), проєкти `mobile-chromium` і `coach-390/768/1024/1440`. **У CI не запускаються** (Playwright у CI використовується лише для аудитів геометрії Storybook). Покриття e2e не міряється. За вашою вказівкою e2e в цьому аудиті не запускалися, статус «зелено/червоно» невідомий.

## 8. Висновки для етапів 1-3

1. Єдина реально працююча «стіна» — кореневий гейт на 4 файли (0,5% коду). Клієнтські 5 786 тестів у CI не біжать, тож будь-яка регресія в них невидима до ручного запуску.
2. Етап 2 (CI) має першим запустити `client` тести з покриттям у шардах (повний прогін ~25 хв → ≥6 шардів, щоб вкластися в ≤5 хв за ADR 004) і зводити summary (як `scripts/audit-merge.mjs`); без цього `client_full_baseline` лишається ручною цифрою.
3. Поріг `client/vitest.config.ts` (80) зараз недосяжний на своїх каталогах (48,7%): перший же запуск у CI буде червоним; потрібне рішення власника: або спершу партії B1/B3 і рішення по B12 (для `data/` та `i18n/`), або явна зміна політики; звужувати `include` чи знижувати 80 гард не дозволить.
4. Гард `npm run coverage:guard` (SPO-47) фіксує підлогу з цього аудиту і не дозволяє ні знизити, ні звузити `include`, ні додати `exclude`.
