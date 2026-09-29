# Spotter — Brass Glass: план редизайну (тема під прапорцем)

Оновлено: 29.09.2026 · Автор: Mykola
Жива версія: Claude Doc «Spotter — Brass Glass: план редизайну» (https://claude.ai/code/artifact/ba13ce89-ef5c-4688-b7cc-0c1efc34aa15)
Статус дизайну: `claude/brass-glass-redesign.md` (проєкт) · дизайни в репо: `gym-tracker/docs/design/brass-glass/`

## TL;DR

Робимо Brass Glass як **окрему тему** Spotter, увімкнену прапорцем `brassGlass` у Settings (адмін, desktop rail). Основний графітовий дизайн не змінюється: з вимкненим прапорцем застосунок виглядає і працює як зараз.

Тема — це CSS-шар `glass.css` на root-класі `html.theme-glass`, за тим самим механізмом, що `.theme-apex` / `.theme-learn`. Дизайн у канвах — 1:1 переклад поточного застосунку, тож 80–90 % роботи — токени й поверхні, а не новий markup. Markup чіпаємо лише там, де дизайн змінює ієрархію (hero/quiet-картки, full-bleed LiveHero, скляна таббар з FAB, латунні sheets).

Два жорсткі правила: **все через UI kit** (тема стилізує тільки примітиви `components/ui/`, щоб правка в одному місці міняла весь застосунок) і **функціональність виграє в дизайну** (ніщо, що зараз працює, не зникає, навіть якщо борд це пропустив).

Музика (канва Music V2, план `spotter-music-plan.md`) у цей план **не входить**: вона окрема фіча зі своїм планом, а тема має бути готова до неї.

Обсяг: 758 бордів, 16 сторінок застосунку + kit. Порядок: kit і shell → Today, Widgets → Start, Session, Summary → History, Progress, Plan → Exercises, Health → Gyms, Atlas, Apex, Me → Auth, Trainer / roles → desktop і night. Кожен етап — окремий PR під прапорцем, з Storybook-сторі та скріншот-тестами в обох темах.

## Що вже є

Дизайн лежить у репо: `gym-tracker/docs/design/brass-glass/` — 758 бордів у `boards/*.dc.html`, рендери в `previews/*.webp`, індекс `INDEX.md`, правила `src/KIT_RULES.md`, генератори `src/pNN_*.py` на спільному `src/kit.py`, і мапи «борд → файл у коді» в `src/fidelity/PNN.md`. Той самий стиль — у канві Music V2 (`docs/design/spotter-music/`), звідки він і пішов.

| Сторінка | Область                     | Бордів | Канва                                                            |
| -------- | --------------------------- | ------ | ---------------------------------------------------------------- |
| P00      | Foundations (kit)           | 7      | [канва 1](https://claude.ai/artifact/VaC5Zcs8WMPESB62XruLZh)     |
| P01      | Today                       | 47     | канва 1                                                          |
| P02      | Widgets                     | 15     | канва 1                                                          |
| P03      | Start workout               | 56     | канва 1                                                          |
| P04      | Session                     | 80     | [канва 2](https://claude.ai/artifact/FmkZi76U1vBSeM6YvZk58o)     |
| P05      | Summary                     | 13     | канва 2                                                          |
| P06      | History                     | 23     | канва 2                                                          |
| P07      | Progress                    | 37     | [канва 3](https://claude.ai/artifact/JzobQyBmgJwUxq5QPoTDGS)     |
| P08      | Plan                        | 64     | канва 3                                                          |
| P09      | Exercises & Learn           | 58     | [канва 4](https://claude.ai/artifact/MVKBaL1Xp4waX2U9hKh8KG)     |
| P10      | Health, sleep, injury       | 92     | канва 4                                                          |
| P11      | Gyms                        | 33     | [канва 5](https://claude.ai/artifact/5YM7e7Bp46rv3RJ6GHhXBm)     |
| P12      | Atlas                       | 40     | канва 5                                                          |
| P13      | Apex                        | 35     | канва 5                                                          |
| P14      | Me / Settings               | 58     | канва 5                                                          |
| P15      | Auth & onboarding           | 31     | [канва 6](https://claude.ai/artifact/6r3fPtTcV7SKhAFjNRrmDi)     |
| P16      | Trainer / roles             | 69     | канва 6                                                          |
| —        | Music V2 (не в цьому плані) | —      | [канва Music](https://claude.ai/artifact/FBbRifvxyDihKjD2HcFsCf) |

У коді вже є все, на що тема лягає: токени `:root` у `client/src/styles.css` (ramps, сімейства tint/text/line, `--glass-*`), UI kit у `client/src/components/ui/` (Button, Card, Chip, GroupedList, Segmented, Switch, Widget, StatStrip, StoryBubble…) зі Storybook, `tones.ts`/`tones.css`, механізм re-skin через root-клас (`.theme-apex`, `.theme-roster`, `.theme-learn`, `.theme-nutrition`) і прапорці `client/src/data/flags.ts` з перемикачами у `SettingsView` (адмін, desktop rail, `#/settings`).

Чого ще нема: P17 (порт Music у тему) і окрема сторінка P18 Desktop — desktop-борди розкидані по сторінках.

## Принципи

**1. Все через UI kit — головне правило.** Тема Brass Glass стилізує тільки примітиви з `client/src/components/ui/` і токени. Жодна сторінка не отримує власних glass-правил: якщо екран досі малює кнопку, картку, рядок чи чип власним класом (`.program-*`, `.mst-*`, `.session-*`, `.rx .btn.*` і т. д.), спочатку цей елемент переводиться на примітив kit, і лише тоді він «отримує» тему. Мета: правка в одному місці (токен або `Button.css`) міняє весь застосунок, а не одну кнопку на одній сторінці. Це ті самі чотири правила з `docs/UI-KIT.md`, але тепер вони блокуючі для кожного PR редизайну.

Що це означає на практиці:

- У `glass.css` дозволені лише селектори токенів (`html.theme-glass { --… }`) і класів примітивів kit (`.uik-card`, `.uik-btn`…) та shell (`.tabbar`, `.rail`, `.app-brand`, `.sheet`, `.dialog`). Селектор з префіксом сторінки — помилка лінту.
- Кожен елемент з `kit.py` (дизайну) має рівно один примітив у `components/ui/` (таблиця в розділі Kit). Чого в kit нема — додаємо в kit, не в сторінку.
- Ієрархія (hero / glass / card / quiet) — це проп примітива (`<Card emphasis="hero">`), а не локальний CSS.
- Кожен примітив має Storybook-сторі в обох темах (global toolbar «Theme: Graphite / Brass Glass»). Сторінка вважається переведеною, коли в ній не лишилось візуальних класів і inline-стилів поза kit.

**2. Функціональність виграє в дизайну.** Ніщо з того, що зараз працює в застосунку, не зникає. Дизайн — 1:1 переклад коду (ті самі екрани, стани, рядки `en.ts`, ролі), але якщо борд не врахував кнопку, стан, гілку чи налаштування, яке є в коді, — елемент лишається і малюється найближчим kit-примітивом, а розбіжність йде у відкриті питання і в `fidelity/PNN.md`. І навпаки: елемент з борду, якого нема в коді (напр. поле Target у rest на P04), не додається без окремого рішення. Перевірка — в QA: перед мержем сторінки звіряємо список елементів з коду (не з борду) і ганяємо наявні Playwright e2e в обох темах.

**3. Окрема тема, не заміна.** Графітовий дизайн лишається default. З вимкненим прапорцем — нуль візуальних змін (скріншот-тести це перевіряють). Міграція сторінки на kit допускає лише піксельно нейтральні зміни в графіті.

**4. Один прапорець.** `brassGlass` у `FEATURE_FLAGS`, перемикач у Settings на desktop rail (адмін), default OFF, localStorage `gym.flags`. Сторінки мігрують поетапно під ним; немігрована сторінка з увімкненим прапорцем отримує токен-рівень (фон, скло на kit-примітивах) і може виглядати змішано — це ок.

**5. Без Music.** Mini-player, Now Playing, Live Activity, музичні віджети та Insights не входять. Коли тема готова, Music будується на тих самих примітивах без окремого стилю.

## Механізм теми

Тема — один прапорець, один root-клас, один CSS-файл. Сторінки про тему не знають: вони рендерять примітиви kit, а примітиви читають токени.

| Шар       | Файл                                            | Що робимо                                                                                                                                                                                                                                                                                                      |
| --------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Прапорець | `client/src/data/flags.ts`                      | `FEATURE_FLAGS` += `{ id: 'brassGlass' }`; рядки `flagBrassGlass` / `flagBrassGlassDesc` у 5 локалях; перемикач з'являється в `SettingsView` автоматично                                                                                                                                                       |
| Root-клас | `client/src/App.tsx`                            | `useFlag('brassGlass')` → effect додає/знімає `theme-glass` на `document.documentElement`, як зараз `.theme-apex`. Скини саб-апів і `data-sleep='night'` працюють поверх                                                                                                                                       |
| Токени    | `client/src/glass.css` (новий)                  | `html.theme-glass { … }` перевизначає `--color-bg` (#121316), `--color-surface` → `rgba(31,33,37,.72)`, `--glass-tint/-specular/-float`, `--glass-brass-*`, радіуси (card 18, hero 24, sheet 26, pill 999), тіні, глоу. Додає нові токени `--mood-*` (art / rest / sleep / ok / bad / night) і `--emph-hero-*` |
| Порядок   | `client/src/main.tsx`, `.storybook/preview.tsx` | `import './glass.css'` після `redesign.css`; у Storybook — global toolbar `theme` з декоратором, що ставить клас на `<html>`                                                                                                                                                                                   |
| Kit       | `components/ui/*.css`                           | Примітиви читають лише токени. Де токена не вистачає (напр. скляна кнопка-пігулка з inset-кільцем замість залитої) — блок `html.theme-glass .uik-btn--primary { … }` у тому ж `Button.css`, не в `glass.css`                                                                                                   |
| Shell     | `App.tsx`, `styles.css`/`redesign.css`          | Tabbar: скло з blur і латунним FAB замість залитого; rail 76 px з підсвіченим активним; brand bar; `Sheet`/`Dialog`/`Snackbar` з `ui.tsx` — латунне скло. Фон екрана — `data-mood` на `.screen` (art за замовчуванням)                                                                                         |

Що змінюється в markup (і тільки це):

1. Заміна локальних елементів на примітиви kit (принцип 1). Це основна робота на кожній сторінці.
2. Пропи ієрархії: `emphasis="hero" | "glass" | "card" | "quiet"` на `Card` там, де борд позначає e1/e2/e4. У графіті ці пропи мапляться на наявні вигляди (hero → accent glass, quiet → без картки), тож пікселі не міняються.
3. `data-mood` на екранах з не-default настроєм (rest, sleep, ok для PR, bad для травм, night для lock).
4. Нові примітиви kit, яких ще нема (розділ Kit).

Що не змінюється: роутинг, стор, дані, рядки i18n, Firestore, Electron-трей (`desktop/`).

## Kit: дизайн → примітиви застосунку

Кожна функція `src/kit.py` (нею намальовані всі 758 бордів) має рівно один примітив у `client/src/components/ui/`. Це й є список робіт етапу 0. Примітиви з `ui.tsx` (Sheet, Dialog, Snackbar, EmptyState, скелетони) переїжджають у `components/ui/` зі сторі.

| Дизайн (kit.py)                                    | Примітив у kit                                                                                 | Стан                    | Що додати                                                                            |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------ |
| `card(tone, hero/glass/quiet)`                     | `Card`                                                                                         | є                       | проп `emphasis` (hero · glass · card · quiet), тони всіх сімейств                    |
| `btn`, `ibtn`                                      | `Button`, `IconButton`                                                                         | є                       | варіанти pri · sec · ok · dan · text, розміри 48/36; поглинає `.btn*` і `.rx .btn.*` |
| `chip`, `chips`, `tag`                             | `Chip`/`ChipGroup`, `PresetChips`, **`Tag`**                                                   | є / новий               | `Tag` 22 px з тоном (PR, F, kind)                                                    |
| `seg`                                              | `Segmented`                                                                                    | є                       | —                                                                                    |
| `toggle`, `check`, `radio`                         | `Switch`, **`Checkbox`**, **`Radio`**                                                          | є / нові                | —                                                                                    |
| `field`, `search`, `timein`, `timerange`           | **`Field`/`Input`**, `SearchField`, **`TimeInput`**, **`TimeRange`**                           | нові / є                | стани focus/err, типований час                                                       |
| `stepper` (well)                                   | **`NumberStepper`**                                                                            | новий                   | well-степпер 32/36 px, один на всю сесію, план, health                               |
| `lst`, `li`                                        | `GroupedList`, `ListRow`, `ListPanel`                                                          | є                       | —                                                                                    |
| `section`, `lbl`                                   | **`SectionLabel`**                                                                             | новий                   | капс-лейбл 10.5 px + дія праворуч                                                    |
| `tile`, `avatar`, `atlas_face`                     | `IconTile`, **`Avatar`**, `StoryBubble`                                                        | є / новий               | —                                                                                    |
| `bar`, `ring`, `spark`, `bars`, `heat`, `week`     | **`ProgressBar`**, **`Ring`**, **`Sparkline`**, **`BarChart`**, **`Heatmap`**, **`WeekStrip`** | нові                    | всі читають `--t-*` тони                                                             |
| `stat`, `stat_card`                                | `StatStrip`, **`StatTile`**                                                                    | є / новий               | —                                                                                    |
| `banner`, `empty`, `skel_rows`, `failed`           | `Banner`, **`EmptyState`**, **`Skeleton`**, **`FailedState`**                                  | є / перенести з ui.tsx  | offline-банер як тон                                                                 |
| `setrow`, `exercise_card`, `rest_card`, `setentry` | **`SetRow`**, **`ExerciseCard`**, **`RestCard`**, **`SetEntry`**                               | нові (сесійні)          | `SetEntry` = e1 сесії: wells, Log, drops                                             |
| `livehero`, `livepill`, `sleephero`                | **`LiveHero`**, **`LivePill`**, **`SleepHero`**                                                | є як компоненти → в kit | 72 px session · compact · today 148 px                                               |
| `barbell`, `plates_legend`, `gauge`, `swatch`      | **`Barbell`**, **`Gauge`**, **`Swatch`**                                                       | нові                    | кольори з plates.ts / loads.ts                                                       |
| `bodymap`, `bodypair`                              | `Muscle.tsx` → **`BodyMap`**                                                                   | перенести               | paint-зони under/productive/high/over                                                |
| `header`, `brandbar`, `tabbar`, `rail`, `desktop`  | **`Header`**, **`BrandBar`**, **`TabBar`**, **`Rail`**                                         | винести з App.tsx       | shell — єдине місце, де тема міняє форму (скляний FAB)                               |
| `sheet`, `dialog`, `snack`                         | `Sheet`, `Dialog`, `Snackbar`                                                                  | ui.tsx → kit            | латунне скло в темі                                                                  |
| `widget`, `shortcut`                               | `Widget`, `ShortcutTile`, `WidgetGrid`                                                         | є                       | —                                                                                    |
| `phone(mood=)`                                     | **`Screen`** з `data-mood`                                                                     | новий                   | art · rest · sleep · ok · bad · night                                                |
| `miniplayer`                                       | —                                                                                              | Music, не в плані       | —                                                                                    |

Типографіка з P00-Type (`t-d1` 34, `t-h1` 26, `t-h2` 20, `t-h3` 16, `t-b` 15, `t-s` 13, `t-m` 12, `t-l` 10.5 caps, `t-num` 28, `t-hero` 56) стає набором токенів `--type-*` у `styles.css`, а не класами на сторінках. Шрифт Inter вже є (`--font`).

Правило для нових примітивів: спершу в графіті (піксель-нейтрально до того, що зараз малює сторінка), потім блок `html.theme-glass` у тому ж CSS-файлі, сторі в обох темах, `kit.test.ts` зелений.

## Етапи міграції

| Фаза                                    | Що входить                                                                                                                                                             | Ворота                                                          |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 0 · Фундамент                           | прапорець, `glass.css`, токени, всі нові примітиви з таблиці Kit (P00, 7 бордів), Sheet/Dialog/Snackbar у kit, TabBar/Rail/BrandBar винесені з App.tsx, Storybook-тема | сторі всіх примітивів в обох темах; графітні скріншоти без змін |
| 1 · Today + Widgets (P01, P02)          | 62 борди: Today, Customize, Atlas і clients, бібліотека віджетів 111 × S/M/L/XL, 46 шорткатів                                                                          | у `today/` нема візуальних класів поза kit                      |
| 2 · Start → Session → Summary (P03–P05) | 149 бордів: SetEntry, LiveHero, RestCard, Barbell, Gauge, TimeInput — найбільше нових примітивів                                                                       | жива сесія від старту до самарі в темі, Playwright e2e зелений  |
| 3 · History, Progress, Plan (P06–P08)   | 124 борди: Timeline, MonthGrid, BarChart, Sparkline, Heatmap; редактор програм на kit                                                                                  | `programs.css` зведено до layout-only                           |
| 4 · Exercises і Learn, Health (P09–P10) | 150 бордів: BodyMap, TimeRange, сімейства illness/injury/active/rest/sleep; Learn у скіні rubellite                                                                    | кольорові сімейства збігаються 1:1 з `tones.ts`                 |
| 5 · Gyms, Atlas, Apex, Me (P11–P14)     | 166 бордів: Apex у скіні amethyst, чат Atlas, Mastery, Recaps, Settings з прапорцями                                                                                   | скіни саб-апів — лише підміна accent-ramp                       |
| 6 · Auth, Trainer / roles (P15–P16)     | 100 бордів: People у скіні silver, ролі member / trainer / admin, TraineeSessionView, AdminView                                                                        | всі 758 бордів мають екран у темі                               |
| 7 · Desktop, night, прибирання          | desktop-борди з усіх сторінок, moonlit-палітра + SleepHero, видалення мертвих класів у `styles.css`; рішення про default; потім Music (P17)                            | —                                                               |

Фаза 0 — блокуюча: без повного kit жодна сторінка не мігрує. Далі порядок йде за частотою вживання і за тим, скільки нових примітивів сторінка дає наступним (Session дає найбільше). Фази 3–6 незалежні одна від одної і можуть йти паралельно після фази 2. Кожна фаза закривається чеклістом із розділу QA і оновленням `fidelity/PNN.md` колонкою «done».

## Сторінки P01–P16

Для кожної сторінки борди вже змаплені на код у `src/fidelity/PNN.md` — це готовий чекліст для PR. Колонка «Локальні класи» — скільки власних CSS-класів сторінка має в `styles.css` зараз; це груба міра роботи з переведення на kit.

| Сторінка              | Бордів | Джерела в коді (client/src)                                                                                                                                                                             | Локальні класи                 | Що міняється крім стилю                                                                                                          |
| --------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| P01 Today             | 47     | `views/TodayView.tsx`, `today/*`, `components/NudgeStack, AtlasStrip, HistoryTimeline, DayHistorySheet, SleepAutomation, LiveHero, Readiness`                                                           | `today.css`                    | Program-картка = `Card emphasis="hero"`; Atlas-рядок без картки; шорткати скляні плитки; ролі member/trainer/admin               |
| P02 Widgets           | 15     | `today/widgets/*`, `today/shortcuts.tsx`, `components/ui/Widget, WidgetGrid, ShortcutTile`                                                                                                              | —                              | 111 віджетів через `Widget` без локальних стилів; сторі в обох темах                                                             |
| P03 Start             | 56     | `components/StartSheet, GymPicker, SessionStartCoach`, `views/LogActivityView.tsx`, `views/logActivity/*`, `views/SessionBuilderView.tsx`                                                               | `LogActivity.css`, `sbw-*` 46  | Start sheet з notched tabbar → скляний FAB; wizard кроки на `Segmented`/`OptionCard`                                             |
| P04 Session           | 80     | `views/SessionView.tsx` + все, що він монтує (ExercisePicker, PlateCalc, RestSheet, MuscleInfoDrawer, CircuitBlock, AddExerciseSheet…)                                                                  | `session-*` 26, `focus-*` 17   | `SetEntry` e1, `LiveHero` 72 px full-bleed, `RestCard` e2, `ExerciseCard` quiet; set-type кольори → тони; `data-mood="ok"` на PR |
| P05 Summary           | 13     | `SessionView` summary, `ShareSheet`, `components/AtlasDebrief`, `views/sessionSummary/NextUp`, `RecapBlock`                                                                                             | —                              | Самарі = hero з `t-hero`; share-картка в темі                                                                                    |
| P06 History           | 23     | `views/HistoryListView.tsx`, `components/HistoryTimeline`, `SessionView` past-mode, `views/ExerciseHistoryView, MuscleHistoryView`                                                                      | `hist-*` 29                    | `Timeline` kit; past-hero; редактор часу через `TimeInput`                                                                       |
| P07 Progress          | 37     | `views/OverviewView, ProgressView, GoalsView, FocusEditor, MasteryView`, `components/TrendsView, StatShareSheet, BodyMetrics, PhotoSlider`                                                              | `prog-*` 116, `mst-*` 114      | графіки → `BarChart`/`Sparkline`/`Ring`; Mastery ladder з kit                                                                    |
| P08 Plan              | 64     | `views/ProgramsView, PlaybookView`, `views/programs/*` (ProgramBuilder, DayEditor, AssigneesSheet, pieces), `ProgramCsvDialog, ProgramAssignDialog`, `ExercisePicker`                                   | `programs.css`, `program-*` 79 | `pieces.tsx` (Stepper, ToggleRow, IconButton…) замінюється на kit-примітиви                                                      |
| P09 Exercises і Learn | 58     | `views/ExerciseLibraryView, ExerciseDetailView, EquipmentDetailView`, `components/ExerciseGallery, EquipmentBoard, EquipmentPickerSheet, BandLibraryCard, CardioMachineList`, `LearnApp.tsx`, `learn/*` | `ex-*` 160, `learn.css`        | фото вправ без рамок-карток; Learn — скін rubellite поверх теми                                                                  |
| P10 Health            | 92     | `views/HealthView, SleepView, InjuryView`, `views/health/*`, `components/SleepAutomation, SleepHero, MoonGlyph, Readiness, MuscleStatePanel, FixSheet`                                                  | `Health.css`, `sleep-*` 72     | `TimeRange` з типованим часом; `BodyMap` для травм; `data-mood` rest/sleep/bad                                                   |
| P11 Gyms              | 33     | `views/GymsView, GymDetailView`, `components/GymKit, GymThumb, GymPicker, RouteMap, EquipmentBoard`, `gymEvidence.ts`                                                                                   | `gym-*` 26                     | фото залів — єдиний дозволений placeholder (runtime)                                                                             |
| P12 Atlas             | 40     | `views/CoachView.tsx` (CoachSetup, DataStep, CoachThread, PlanCard, CoachSettingsSheet, Bubble), `components/AtlasFace, AtlasStrip, AtlasNotesPanel, AtlasDebrief, ChatChart`                           | чат-класи                      | бальбашки чату = новий примітив `Bubble`; тон atlas (корал)                                                                      |
| P13 Apex              | 35     | `views/ApexApp, ApexHome, ChallengesView, NotificationsView`, `components/StandardsView, FeatsView, StatShareSheet, AppRail`                                                                            | `apex-*` 11                    | скін amethyst = підміна accent-ramp, без окремих правил                                                                          |
| P14 Me / Settings     | 58     | `views/ProfileView, PhysiquePicker, SettingsView, NotificationsView, InstallShortcut, RosterApp`, `components/BodyMetrics, AvatarUploader, ShellLauncher, AppRail`                                      | `prof-*` 42                    | Settings — `GroupedList` + `Switch`; сам перемикач `brassGlass` тут                                                              |
| P15 Auth              | 31     | `views/AuthView, OnboardingView` (AvatarStep, GymStep, BodyStep), `InstallShortcut`, `ProfileCompletionGate`, `App.tsx` join-token                                                                      | `onb-*` 33, `auth-*` 7         | онбординг — перше, що бачить новий користувач у темі                                                                             |
| P16 Trainer / roles   | 69     | `views/TrainerView, ClientPage, TraineeSessionView, AdminView, RosterApp`, `ProgramAssignDialog`                                                                                                        | розкидані                      | скін silver; одна компонента на роль, без дублів                                                                                 |

Правило для PR сторінки: відкрити `fidelity/PNN.md`, пройти борди ряд за рядом (0 main · 1 states · 2 sheets · 3 dialogs/desktop), для кожного елемента назвати kit-примітив, замінити локальні класи, видалити мертвий CSS зі `styles.css`, додати скріншоти 390/1280 в обох темах.

## Night mode, скіни саб-апів, desktop

Усі три — шари над темою, і всі три працюють через підміну токенів, а не через окремі правила на сторінках.

- **Night mode.** Зараз `:root[data-sleep='night']` міняє палітру і малює Spotter Sky. У темі те саме: блок `html.theme-glass[data-sleep='night']` у `glass.css` перевизначає токени на moonlit-палітру (`kit.py nightify`), `SleepHero` стоїть над кожним екраном крім Sleep. Саб-апи вночі — лише палітра, без Sky і SleepHero (як у `App.tsx` зараз).
- **Скіни.** `.theme-apex` (amethyst), `.theme-roster` (silver), `.theme-learn` (rubellite), `.theme-nutrition` (lazurite) вже підмінюють `--color-accent-*`. У темі скло та глоу теж мають читати accent через `color-mix()`, тоді скіни отримують глас-вигляд безкоштовно (`kit.py reskin` робить саме це). Жодних захардкоджених латунних rgba в kit — лише `var(--color-accent-*)`.
- **Desktop.** Окремої сторінки P18 нема, desktop-борди лежать у рядку 3 кожної сторінки (`*-Desktop*.dc.html`). Оскільки сторінки на kit, desktop — це `Rail` 76 px + права панель Start/detail; перевіряється скріншотами 1280 у кожному PR, а фаза 7 — фінальний прохід. Electron-трей (`desktop/`) лише відкриває веб і не змінюється.
- **PWA / браузер.** `backdrop-filter` і `color-mix()` є в Safari 16.4+ / Chrome 111+; для старіших — fallback-фон без blur у тих самих токенах (`@supports`).

## QA і ворота кожного PR

Мерж сторінки — лише коли всі пункти зелені.

- [ ] **Нічого не зникло.** Список елементів береться з коду сторінки (кожна кнопка, стан, гілка `role ===`, sheet, dialog), не з борду; кожен відмічений у `fidelity/PNN.md`. Наявні Playwright e2e (`tests/`) ганяються двічі — з прапорцем і без (`gym.flags` у localStorage ставиться в fixture).
- [ ] **Графіт без змін.** Скріншот-тести 390 і 1280 з вимкненим прапорцем піксельно збігаються з main (допуск — антиаліасинг).
- [ ] **Тільки kit.** Лінт (новий скрипт у `scripts/`): у `views/`, `components/` (поза `components/ui/`) і `today/` цієї сторінки — жодного hex/rgba, `border-radius`, `box-shadow`, `background` у CSS і inline `style`; у `glass.css` — жодного селектора з префіксом сторінки. `kit.test.ts`: у кожного примітива є сторі і блок `html.theme-glass`.
- [ ] **Storybook в обох темах.** Toolbar Theme × Locale × Viewport; сторі сторінки (вже є для Health, LogActivity, Today widgets) додаються для кожної мігрованої сторінки з усіма станами (filled · empty · loading · failed · offline · night · ролі).
- [ ] **Порівняння з бордом.** Скріншот у темі поруч із `previews/PNN-*.webp` у PR; відхилення або виправлене, або записане як «функціональність виграла».
- [ ] **Кольорові сімейства.** Тон елемента в темі = тон у графіті (illness amber, injury coral, active teal, rest sky, sleep violet, sport lime, kcal blue, apex, learn, atlas; зони under/productive/high/over). Контраст тексту на склі ≥ 4.5:1 (перевірка в сторі P00-Colors).
- [ ] **Зелений CI.** tsc, eslint, prettier, vitest, `npm run build-storybook`, Playwright.
- [ ] **Запис у проєкт.** Оновлення `docs/UI-KIT.md` (нові примітиви) і `fidelity/PNN.md` (колонка done).

## Ризики і відкриті питання

Ризики:

- **Обсяг міграції на kit.** `styles.css` — 38 900 рядків, сотні локальних класів (`ex-*` 160, `prog-*` 116, `mst-*` 114). Це головна робота, а не сама тема. Захист: піксельні скріншоти графіту в кожному PR, малі PR (один екран або один примітив).
- **Втрата функціональності під час заміни компонентів.** Захист: чекліст з коду + e2e в обох темах (принцип 2).
- **Продуктивність.** `backdrop-filter: blur` на багатьох картках і радіальні глоу можуть гальмувати скрол на старших iPhone. Захист: blur лише на shell (tabbar, sheet, dialog), картки — градієнт без blur (так у `kit.py`); перевірка на реальному телефоні у фазі 1.
- **Дві теми надовго.** Кожна нова фіча має працювати в обох. Захист: фічі будуються лише з kit, тоді друга тема безкоштовна; рішення про default — у фазі 7.
- **Прапорець у localStorage.** Не синхронізується між пристроями і вмикається лише адміном на desktop. Для тесту на телефоні — ввімкнути в desktop-браузері того ж телефона або через `#/settings` (адмін). Якщо треба друзям — перенести прапорець у `users/{uid}/meta/prefs`, як `todayLayout`.

Відкриті питання (рішення власника):

- [ ] P04: поле rest **Target** є на бордах, нема в коді — за принципом 2 не додаємо, поки не вирішено окремо.
- [ ] Illness pill: teal у `redesign.css` vs amber на бордах — який правильний (сімейство illness в `tones.ts` — amber).
- [ ] Баги в коді, знайдені під час дизайну: «100 kg kg», «legs sets» з малої — правимо окремим PR до теми.
- [ ] Чи вмикати прапорець пристроєм чи профілем (див. ризик про localStorage).
- [ ] Назва в Settings: «Brass Glass theme» чи «New design»; переклади uk/pl/lt/et.
- [ ] Коли портувати Music (P17) — після фази 2 або після 7.

## Джерела і файли

- Дизайн: `gym-tracker/docs/design/brass-glass/` — `README.md`, `INDEX.md`, `src/KIT_RULES.md`, `src/kit.py`, `src/fidelity/P01–P16.md`, `previews/`, `boards/`.
- Канви: 1 Foundations → Start, 2 Session → History, 3 Progress → Plan, 4 Exercises → Health, 5 Gyms → Me, 6 Auth → Trainer (посилання в таблиці вище); Music V2 — лише як джерело стилю.
- Код: `client/src/styles.css` (:root, `.theme-*`), `client/src/redesign.css`, `client/src/data/flags.ts`, `client/src/views/SettingsView.tsx`, `client/src/App.tsx` (theme-класи, shell), `client/src/components/ui/*`, `client/src/ui.tsx`, `client/.storybook/preview.tsx`.
- Правила kit: `docs/UI-KIT.md`, `docs/UI-REFACTOR-PLAN.md`, `docs/DESIGN.md`.
- Суміжні рішення в проєкті: `claude/brass-glass-redesign.md` (статус дизайну), `claude/today-configurator-decisions.md`, `claude/spotter-music-plan.md` (окремо, не в цьому плані).
