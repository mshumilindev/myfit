# D12: Реєстр трекерів, SDK, шрифтів, CDN

Статус: чернетка v1 · 2026-10-22 · інженерний документ, не юридична консультація. Пов'язано: `processors.md` (D4). Зміна: у тому ж PR, що додає/видаляє SDK, шрифт, CDN, зовнішній скрипт (правило 5 `legal-compliance.md`).

**Cookies:** власних cookie застосунок не ставить (стан: `localStorage`/IndexedDB, див. R48–R51 у `data-registry.md`); сторонні cookie ставить сервіс Google reCAPTCHA (Analytics видалено, SPO-287): повний перелік cookie unknown, перевірити браузером перед публікацією.

## Сторонні запити за візит (без входу, до будь-якої згоди)

| Ресурс                                                                        | Хост                                                                                                           | Що передається                                                                                            | Перед згодою?                                            | Статус                                                                                                                                                                               |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Google Fonts: Kaushan Script (`client/index.html`, `preconnect` + stylesheet) | `fonts.googleapis.com`, `fonts.gstatic.com`                                                                    | IP, User-Agent, Referer                                                                                   | **так**                                                  | **видалено (SPO-287, ADR 007)**: шрифти self-hosted через `@fontsource`, `index.html` і CSP очищені. Запис лишено як історію; guard `no-third-party-fonts-analytics` тримає заборону |
| Firebase Analytics (`getAnalytics`, `client/src/firebase.ts`)                 | `*.google-analytics.com`, `*.analytics.google.com`, `*.googletagmanager.com`, `www.googletagmanager.com`       | ідентифікатор клієнта, події SDK (`logEvent` у коді не знайдено; автоматичні події SDK не перевірено), IP | так (ініціалізується, якщо `isSupported`)                | **видалено повністю (SPO-287, ADR 007)**: `getAnalytics` прибрано з `client/src/firebase.ts`, CSP очищено; банера аналітики немає свідомо                                            |
| reCAPTCHA Enterprise / App Check                                              | `www.google.com/recaptcha/`, `www.gstatic.com/recaptcha/`, `recaptcha.google.com`                              | сигнали браузера, IP                                                                                      | так (безпека, L): `{{ЮРИСТ}}`                            | лишається; D4                                                                                                                                                                        |
| Firebase SDK (Firestore, Auth, Functions, Storage)                            | `*.googleapis.com`, `*.cloudfunctions.net`, `*.run.app`, `*.firebaseio.com`, `*.firebaseapp.com` (iframe auth) | дані застосунку + IP                                                                                      | після входу (Firestore); `*.firebaseapp.com` у frame-src | лишається; D4                                                                                                                                                                        |

## Запити за ознакою згоди

| Ресурс                                                          | Хост                                                | Умова                                    | Статус                       |
| --------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------- | ---------------------------- |
| Leaflet JS/CSS (CDN)                                            | `unpkg.com` (`https://unpkg.com/leaflet@1.9.4/...`) | `geo-search`                             | лишається; self-host unknown |
| OSM tiles, Photon, Overpass, Nominatim, OSRM, Wikidata, Commons | див. `processors.md`                                | `geo-search`                             | лишається                    |
| Puter.js                                                        | `js.puter.com/v2/`                                  | `atlas-puter`                            | лишається                    |
| Gemini (Firebase AI Logic)                                      | `*.googleapis.com`                                  | `atlas-ai`                               | лишається                    |
| Open Food Facts                                                 | `world.openfoodfacts.org`                           | функція харчування (окремої згоди немає) | лишається; unknown/lawyer    |

## CSP (`firebase.json`)

Дозволені джерела = ті самі хости; `img-src https:` та `media-src https:` ширші за потреби (відомий борг). Запис про нові хости в CSP без рядка тут провалює guard-тест.

## Не знайдено / не використовується

Реклама, SDK профілювання, пікселі, session replay, error-tracking (Sentry тощо): у коді не знайдено; нові = червона лінія 5.
