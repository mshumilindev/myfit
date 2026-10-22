# План: картинки вправ — WebP на Hosting

Статус: **варіант «Cloud Storage» відхилено власником** (передчасно). Квота Hosting вирішується лімітом релізів = 5 + переходом на WebP. Варіант Storage лишається задокументованим майбутнім кроком (нижче).

## Що зроблено

- `client/public/exercise-img/**/*.jpg` (1746 файлів, 98 MB) → `.webp` (q78, ширина ≤ 1200, ті самі базові імена): 92.9 MB → 57.0 MB (≈ 0.61).
- Скрипт `scripts/convert-exercise-img-webp.mjs` (sharp; ідемпотентний, пропускає наявні .webp, 4 паралельно, `--budget-ms`, код виходу 2 = продовжити повторним запуском).
- Шляхи в `client/src/data/exercises.rich.json` (`/exercise-img/<id>/<n>.webp`, 1746 замін); `exerciseImageOverrides.json` = `{}`.
- JPG-оригінали винесені з `client/public` у git-ignored `client/_to_delete/exercise-img-jpg/` (не потрапляють у dist; історія git теж їх зберігає).
- SW: правило `spotter-img` (same-origin, SWR) вже матчить `.webp`.
- Два великі JPG спорядження (`equipment/m-shoulder-press`, `m-biceps-curl`) вже переведені на `.webp`.

## Лишилося / застереження

- `scripts/build-exercise-data.mjs` при повторному запуску знову створить `.jpg` і запише `.jpg`-шляхи в JSON — після нього запускати конвертер і замінювати шляхи.
- `scripts/exercise-images/config.ts` (`referenceImages`) і `tests/exercise-images/pipeline.test.ts` припускають `.jpg`-референси в `exercise-img/` — для генерації картинок брати оригінали з `_to_delete/exercise-img-jpg/`.
- `scripts/fetch-equipment-images.mjs` поверне `.jpg` для двох файлів спорядження.

## Майбутній крок (не робимо зараз): Cloud Storage

Якщо Hosting знову впреться в ліміт: файли в `gs://<bucket>/exercise-img/…`, URL через `firebasestorage.googleapis.com/v0/b/<bucket>/o/…?alt=media` (правило `storage.rules` public read для `exercise-img/**`, не `allUsers` на весь бакет), один хелпер URL із `VITE_EXERCISE_IMG_BASE`, виключення `dist/exercise-img` плагіном Vite, runtime-кеш Workbox для іншого хосту, upload-скрипт; порядок деплою: rules → upload → verify → hosting. Перша реалізація збережена в `client/_to_delete/storage-move/` (хелпер, плагін, upload-скрипт, тести).

## Деплой (власник)

`deploy-hosting.command` (лише він) на test → перевірка → prod. Жодних кроків зі Storage.
