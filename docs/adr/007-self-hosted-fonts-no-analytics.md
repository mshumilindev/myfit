# ADR 007 — шрифти з власного хостингу, без Firebase Analytics (SPO-287)

**Статус:** прийнято (22.10.2026). Прогалина G8 спайка SPO-252.

## Контекст

Кожен візит тягнув шрифти з `fonts.googleapis.com` / `fonts.gstatic.com` (`index.html` для Kaushan Script; `@import` у `landing-design.css` для Inter Tight, Manrope, JetBrains Mono, Kaushan Script) і ініціалізував `getAnalytics(app)`. Це передавання IP (і ідентифікаторів Analytics) Google без згоди й без правової підстави; банера згоди в дизайні немає (SPO-295 свідомо без аналітики). Правило `legal-compliance.md` п.5: нічого стороннього без згоди й запису в реєстрі.

## Рішення

1. **Analytics вимкнено повністю:** імпорт `firebase/analytics`, ініціалізація, `measurementId` і експорт `analytics` видалені (`logEvent` у коді не було). З CSP прибрано `googletagmanager.com`, `*.google-analytics.com`, `*.analytics.google.com`. Увімкнення колись = окрема згода, ADR і зміна політики.
2. **Шрифти self-host через `@fontsource/<family>`** (пакети вже мають прецедент: `@fontsource/inter`). Лише потрібні гарнітури, ваги (ті, що вантажив старий URL) і підмножини `latin` + `latin-ext` (pl, lt, et) + `cyrillic` (uk); `font-display: swap`. Стек запасних шрифтів у CSS не змінено. З CSP прибрано `fonts.googleapis.com` і `fonts.gstatic.com`.
3. **Розмір PWA.** Kaushan Script (бренд, кожен екран): 2 файли, у precache; прелоад `latin` у `index.html` генерує vite-плагін (хеш в імені). Шрифти лендінга (Inter Tight, Manrope, JetBrains Mono) вантажить лише ледачий чанк лендінга: виключені з precache (`globIgnores`), кешуються при першому використанні наявним `runtimeCaching` (`spotter-assets`, CacheFirst).

## Відхилено

- Копіювати woff2 у `client/public/fonts` вручну: ті самі байти, але без версіонування й хешів, ручне оновлення.
- Варіативні шрифти (`@fontsource-variable`): більші файли для 2–4 ваг, які реально потрібні.
- Залишити Google Fonts + згода: потребує банера й відкладеного завантаження; бренд-шрифт тоді мерехтить; зайва складність заради шрифту.

## Наслідки

Нові залежності: `@fontsource/kaushan-script`, `inter-tight`, `manrope`, `jetbrains-mono` (OFL-шрифти, пакети без коду, лише CSS і woff/woff2). Guard: `tests/no-third-party-fonts-analytics.test.ts`, `tests/firebase-headers.test.ts`.

Доповнення (SPO-344, тема Cyberpunk): `@fontsource/barlow`, `barlow-condensed` (latin + latin-ext) і `fira-sans`, `fira-sans-condensed` (лише cyrillic: у Barlow немає кирилиці, Fira як запасний шрифт стеку дає українським заголовкам ту саму гротескну форму). Імпорти в `main.tsx`; шрифти не в precache PWA (woff2 не входять у типовий glob), тож офлайн до першого завантаження діє запасний стек.
