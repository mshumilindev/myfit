# SPO-571: згоди й шаринг за встановленими аддонами, один реєстр категорій (план + risk assessment)

Джерело: спайк `claude/SPO-571-consents-addons-spike-2026-11-20.md`, рішення власника 11.11 і 20.11 («дизайни тут не потрібні»: дизайн-крок пропущено за прямим словом власника; сторінки збираємо лише з наявного kit і наявних екранів).

## Підзадачі й порядок

| # | Підзадача | Залежить |
|---|-----------|----------|
| P1 | Реєстр категорій `legal/categoryRegistry.ts` + guard-тест + правило в `legal-compliance.md` і CLAUDE.md | — |
| P2 | Consents і шторка згод показують лише встановлене (+ядро), лічильник по видимих | P1 |
| P3 | Автовідкликання згоди при видаленні аддона (з логом, ретраєм, скиданням шарингу) | P1, P2 |
| P4 | Окрема сторінка «Шаринг з тренером»; Privacy and sharing = хаб (Згоди / Шаринг / Policy) | P1 |
| P5 | Policy/Terms збираються з розділів встановленого | **заблоковано SPO-452/453 (спайки в Todo)**, не беремо |

## Risk assessment

### Інвентар зачепленого (rg транзитивно по `client/src`)

| Місце | Як зачеплене | Хто читає далі | Ризик | Перевірить |
|-------|--------------|----------------|-------|------------|
| `legal/consents.ts` `HEALTH_FEATURES`, `ConsentKind` | НЕ міняємо (сервер `consentRecordsPure`) | `i18n/legalGate`, `HealthConsentHost`, `consentsModel`, `gateChoices`, `healthFeatures`; тести healthConsent*, store.*, Cycle, Nicotine | R1 | `consentApi.test`, `legalDocs.test`, typecheck |
| `legal/consentsModel.ts` (`HEALTH_KINDS/OPTIONAL_KINDS/countOn`) | видимість за власником | `ConsentsPage`, `PrivacyHub` (лічильник), `consentsPage.test` | R9 | `consentsPage.test` + новий |
| `legal/ConsentsPage.tsx` (`HEALTH_ICON`, рядки) | іконки з реєстру, фільтр рядків | `ConsentsScreen`, `useConsentsPage` | R9,R10 | тести, audit stories |
| `legal/gateChoices.ts` (`HEALTH_LOOK`, `GATE_CHOICES`) | look з реєстру, фільтр шторки | `LegalGatePage`, `healthFeatures`, `signupConsents` | R9 | `LegalGate.test`, `gateDraft.test` |
| `legal/healthFeatures.ts`, `healthConsentActions.ts` | не міняємо; `withdrawHealth` викликає P3 | `HealthWithdrawDialog`, `HealthConsentHost`, `data/healthConsentGate` | R2,R3 | `healthConsentActions.test` |
| `coach/client/shareModel.ts` (`ADDON_OF`, `SHARE_GROUPS`) | `ADDON_OF` береться з реєстру | `SharingList`, `AccessAskForm`, `TrainerSharing`, `stopSharing`, `accessAsk` | R4,R5 | `shareModel.test`, `accessAsk.test`, `AccessAskForm.test` |
| `coach/client/domain.ts` `CATEGORY_UI`, `shareLabels.ts` (`FEATURE_ICON`) | іконки з реєстру | `AccessLogPage`, `SharingList` | R10 | тести |
| `coach/client/screens/TrainerSharing.tsx`, `views/health/HealthPrivacyView.tsx` | P4: сторінка шарингу | `coach/client/lazy`, `ProfileView`, `PrivacyHub` | R8 | ручний прогін + тести |
| `views/ProfileView.tsx` `useConsentsPage`/`PrivacyHub` | хаб з трьох входів | `HealthPrivacyView` | R8 | тести ProfileView |
| `addons/enabledSet.ts` (`disableAddons`/`addonsPref`) | НЕ міняємо; P3 лише підписується (ядро не знає аддонів) | усе | R2,R3 | boundary/exclusion contract |
| `addons/exclusion.ts`, `manifest.ts` | не міняємо | `exclusion.contract.test` | — | тест |
| `functions/src/consentRecords*.ts`, `firestore.rules` | НЕ міняємо (нових kind немає) | клієнт `consentApi` | R1 | sha-маркер SPO-533 |
| `data/dataRegistry`, експорт, каскад видалення | історія згод не змінюється | DSAR | — | guard-тест повноти |
| i18n (5 локалей) | нових рядків мінімум (заголовок сторінки шарингу, текст «очікує синхронізації») | `i18n:check` | R11 | `i18n:check` |
| Legal тексти Policy/Terms | НЕ міняємо в P1–P4 | `legal*.ts` | R6 | не зачеплено, P5 заблоковано |

### Чекліст категорій
- дані/схема/міграції/vault/реєстр R/експорт/видалення: нічого нового не пишемо; `consentRecords` append-only; нових колекцій немає → не зачеплено, бо записи лише через існуючий `recordConsent`.
- формули/моделі: не зачеплено.
- ролі: member (бачить своє), trainer/нутріціолог (читають лише за grant), manager/admin (не міняємо); перевірка R4/R5.
- аддони: зачеплено (власник категорії = аддон, без аддона нічого не видно).
- офлайн/ідемпотентність: P3 (черга ретраїв), запис `withdraw` ідемпотентний (`sendConsentDurably`).
- UI: Consents, шторка, Sharing, хаб; теми, 390/1280, 5 локалей.
- продуктивність/CI: нові тести малі; нових залежностей немає.
- юридичне: нова поведінка = автовідкликання (зафіксувати в реєстрі даних R-рядок consentRecords); Policy/Terms не міняємо (P5).
- збірки: PWA/Storybook (сторі для нових екранів).

### Реєстр ризиків

| # | Ризик | L | I | Мітигація | Виявимо |
|---|-------|---|---|-----------|---------|
| R1 | Новий/перейменований `ConsentKind` зламає сервер | L | H | не додаємо kind; реєстр лише мапить | `consentApi.test`, sha-перевірка |
| R2 | Хибне автовідкликання: префи ще не синхронізовані на новому пристрої → «аддон відсутній» → відкликали чинну згоду | M | H | лише перехід «був встановлений у цій сесії → зник» після готовності префів і записів згод; жодного «звірення при завантаженні» | тест: холодний старт не відкликає; тест: перехід відкликає |
| R3 | Відкликання офлайн не виконується, згода лишається діючою | M | H | маска даних уже ховає дані (fail closed); відкликання в черзі `sendConsentDurably`, повтор при онлайні | тест офлайн→онлайн |
| R4 | Тренер бачить категорію після видалення аддона | M | H | при відкликанні: рівень шарингу → off (`withdrawHealth` вже це робить через `setLevel`) | тест: після видалення рівень off |
| R5 | Cycle колись потрапить у шаринг мовчки | L | H | реєстр: `share: 'none'` обовʼязково явне; guard | guard-тест |
| R9 | Пропущений споживач старих констант | M | M | старі константи лишаються, реєстр їх живить; typecheck | typecheck + тести споживачів |
| R10 | Регрес UI/іконок (Nutrition fork-knife) | M | L | аудит сторі, скріни | audit:stories, скрін localhost |
| R8 | Глибокі посилання/«Назад» шарингу зламаються (P4) | M | M | перелік входів (запит доступу, чат, My trainer) + тест | тести навігації |
| R11 | Нові рядки не в усіх локалях | L | M | i18n-string skill | `i18n:check` |

### План регресії
Базова лінія до змін (на main): `consentsPage.test`, `healthConsent.test`, `healthConsentActions.test`, `LegalGate.test`, `shareModel.test`, `AccessAskForm.test`, `accessAsk.test`, `data/healthConsentGate.test`, `store.healthConsent.test`, `tests/kit-guard.test.ts`. Що не змінюється: ключі `ConsentKind`, формат `recordConsent`, правила `consentRecords`, дані користувачів. Нові тести: guard реєстру; видимість рядків за аддонами; перехід installed→removed відкликає; холодний старт не відкликає; офлайн-черга.

## Рішення людини (прийняті)
Взято за рекомендаціями спайку (A: `policyVersion` не піднімається; B: Cycle `share: none`; C: повні назви з шарингу; D: Nutrition ховаємо, доки апок не встановлено; E: геопошук належить апку `gym`).

## Незалежне рев'ю оцінки (risk-reviewer, 20.11) і що змінилось у плані

| Знахідка | Рішення |
|----------|---------|
| HIGH-1/2: `onAddonsRemoved` порівнює `snapshot()` і спрацьовує на `resetLocalData` (вихід/зміна акаунта) та зміну ролі | P3 **не** підписується на `onAddonsRemoved`. Тригер: (а) явна дія `disableAddons(ids)`; (б) віддалене видалення лише після `whenPrefsLoaded` + серверних згод (не `fromCache`), по збереженому списку `addonsPref.list`, uid незмінний, повторна перевірка перед записом. Тести: вихід, зміна ролі, холодний старт, кеш→сервер |
| HIGH-3: `soon`-аддон (`nutrition`) через `addonAvailable` = base = завжди видимий | Рішення D **переглянуто**: рядки категорій `soon`-власників НЕ ховаємо (інакше пропаде можливість відкликати згоду на функцію, що може працювати). Видимість = `addonAvailable(owner)`; автовідкликання для `soon` немає |
| HIGH-4: відкликання не гарантує, що тренер перестав читати; `sleep`/`availability` не мають згоди | P3: довговічна черга ревоку grant (за зразком `revokeRecord`); при видаленні аддона рівень шарингу його категорії → off незалежно від згоди (`sleep`, `availability`, локальні рівні). Окремий тест офлайн-ревоку |
| MEDIUM-5: вже є `atlas/withdrawOnRemove.ts` (+`reconcileAtlasConsent`) | P3 узагальнює його за реєстром, не дублює; `atlas-history` = `onRemove: 'keep'`; Atlas-тригер теж переводиться на безпечний тригер (гіпотеза про чужий акаунт при виході перевірити тестом) |
| MEDIUM-6: `removalSet('gym')` каскадом | тест пакета; `geo-search` локально вимикається (`setGeoOverride`) разом із записом |
| MEDIUM-7: мульти-пристрій/кеш | `ready` лише за серверним підтвердженням (`confirmed`), не кеш |
| MEDIUM-8: пропущені споживачі | додано в інвентар: `ConsentHistoryPage`, `MyDataScreen`, `pending.ts`, `DevicePage`, `RequestAccessSheet`, `coach/client/data/store.ts`, `LegalGatePage`. Історія згод/експорт показують ВСІ записи; фільтр P2 лише в списку перемикачів. Шторка згод legal gate (signup/оновлення політики) у P2 **не фільтрується** (окреме рішення, див. питання) |
| MEDIUM-9: ролі, A vs правило 11 | питання власнику: автовідкликання змінює опис обробки; чи піднімати `policyVersion` (правило 11 каже оновлювати самому). P5 заблоковано |
| Іконки | Реєстр уніфікує іконку/тон лише для поверхонь згод (шторка + Consents). Таблиці шарингу (`CATEGORY_UI`, `FEATURE_ICON` використовується й у view) не чіпаємо |

## Risk close-out (20.11.2026)

Рішення (власник: «вирішуй як правильно»):
- `policyVersion` не піднімаємо: автовідкликання нічого не збирає, не передає й не додає мету, а лише зменшує обробку; тексти згод не змінені. Підняття змусило б усіх повторно приймати політику без юридичної причини. Розділи Policy/Terms за встановленим робить P5 (SPO-452/453), там і версія.
- Відкликання доступу тренера до sleep лишається best-effort (офлайн або без лінку тренер і так нічого не бачить: рівень Off дублює reconcile при кожному старті, поки аддона немає); окрема черга не потрібна.
- Legacy-функції Atlas (`reconcileAtlasConsent*`, `watchAtlasRemoval`) відключені від рантайму, але мають власні тести (контракти); не видаляємо (інваріант 7), лишаються до окремого рішення.

Фінальний інвентар: прогалини оцінки знайдено 4 (ворота згод, reconcile без guard, owner geo-search, відкликання шарингу на reconcile-шляху); усі закриті кодом і тестами (коміти 623e5ba, c999abc).
Базова лінія: vitest `src/legal`, `src/addons`, `atlasAddon` — зелені; 5 червоних лише через відсутні `public`-ассети в Mac-воркдереві. eslint/prettier/tsc чисті. `deps:check`: єдине порушення (today/registry ↔ widgets/planner) не з цієї задачі. `deadcode` — інформаційний, нові експорти використовуються в тестах.
Лишається: P5 (blocked SPO-452/453), жива перевірка на localhost (потрібен дозвіл на клон власника), `cpd`.

## P5 (20.11.2026): Policy/Terms за встановленим — зроблено

Реалізація: `legal/docScope.ts` (лінза на повний текст), `views/LegalPage.tsx`, `LegalDoc` (`num`, `lens`), спайк і чекліст — `docs/compliance/consent-vs-policy.md`, правило п.13.
Рев'ю `risk-reviewer` (знахідки закриті): (1) лінза не ховає опис збережених даних, строків і згод здоров'я (дані аддонів лишаються в акаунті, Art. 13) — звужуємо лише обробку, що припиняється з аддоном: Atlas AI-чат, шаринг доступності; (2) лінза лише для авторизованого (`currentUid()`), кеш списку аддонів переживає вихід; (3) посилання «see section 6» тепер не веде в приховане; (4) коментар про доступність уточнено.
Докази: vitest `src/legal` + `LegalPage` + `LegalDoc` — 490 зелених; eslint, tsc чисті; хеш/версія беруть повний текст (нових юридичних текстів немає, `policyVersion` не змінено).

## Risk assessment P5 (оформлено 20.11.2026; ПОЯСНЕННЯ: написано після коду, порушення порядку risk-assessment.md, зафіксовано; далі оцінка завжди до коду)

Інвентар споживачів тексту Policy/Terms (`rg` транзитивно):

| місце | як зачеплене | хто читає далі | ризик | що перевіряє |
| --- | --- | --- | --- | --- |
| `views/LegalPage.tsx` | лінза (лише авторизований, зі списку аддонів) | людина | показ не того тексту | `LegalPage.test.tsx` (з аддонами / публічна / відвідувач у попапі) |
| `legal/LegalGatePage.tsx` DocReader (`docOf(id).sections`) | не змінено: повний текст | прийняття при вході | гейт читає звужений текст | `LegalGate.test.tsx` (новий: повний текст при `['gym']`) |
| `legal/signupConsents.ts` + `textHash.ts` (`docPlainText(lg.*)`) | не змінено | запис згоди з хешем | хеш звуженого тексту | `docScope.test.ts` (повний текст = джерело; лінза ніколи не мутує) |
| `legal/trainerTerms.ts` | не змінено, лінза вимкнена для trainer-terms/dpa | згоди тренера | — | `LegalPage.test.tsx` (`!isTrainerDoc`) |
| `AuthShell`, `AuthView`, `LandingDesign`, `PrivacyHub`, `AtlasConsentPrompt`, `HealthConsentHost`, `AgreementBlock` | беруть `lg.*` лише для лейблів/посилань | — | — | `rg`: жодного читання `sections` |
| `components/ui/LegalDoc` (+ stories) | нові `num`, `lens` (необовʼязкові) | `LegalPage` (єдиний споживач) | регрес кіту | `LegalDoc.test.tsx`, stories без змін |
| `PolicyUpdate*`, експорт, видалення | текст не читають | — | — | `rg`: немає споживачів `sections` |

Категорії: дані (нових даних немає, схема/rules/vault/реєстр/експорт/видалення не зачеплені); формули (ні); ролі (лінза однакова для member/trainer/admin/manager; trainer-документи без лінзи); аддони (владельці з `ADDONS`, тест перевіряє); офлайн (лише локальний кеш, без запитів); UI (`LegalDoc` + 1 CSS-правило на токені `--s-2`; 5 локалей: рядки лінзи en/uk/pl, lt/et читають en за наявним правилом); юридичне (нових текстів документів немає → версія не піднімається; питання юристу §5); продуктивність (чистий фільтр на малому масиві).

Реєстр ризиків: R12 хеш/прийняття на звуженому тексті (L/H, мітигація: джерело завжди повний текст; тест гейта й хеша); R13 лінза ховає збережені дані (M/H, закрито за рев'ю: лише обробка, що припиняється; тест); R14 відвідувач бачить лінзу з кешу (M/M, закрито `currentUid()`; тест); R15 зсув індексів рядків у локалях (M/M, тест узгодженості кількості рядків і індексів у en/uk/pl); R16 номери розділів «see section N» (L/M, номери стабільні; тест на p14); R17 регрес `LegalDoc` (L/L, тести кіту).
