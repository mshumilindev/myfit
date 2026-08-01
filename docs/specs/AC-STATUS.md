# AC status — чесний аудит проти ACCEPTANCE-CRITERIA.md

Легенда: ✅ зроблено · 🟡 частково · ❌ не почато. Станом на поточний прохід.

## 1 · Gym search (SEARCH)

- ✅ AC-SEARCH-02 — 4 провайдери паралельно (Promise.all); google/foursquare skip без ключів
- ✅ AC-SEARCH-03 — чипи провайдерів: pending / answered+лічильник / failed «—»
- ✅ AC-SEARCH-04 — стрім результатів, без переупорядкування (merge in place)
- ✅ AC-SEARCH-05 — дедуп: Левенштейн ≤2 у 60 м або спільний id; джерела тегами (тести є)
- ✅ AC-SEARCH-06 — дебаунс 350 мс + AbortController скасовує попередній
- ✅ AC-SEARCH-07 — скелетон 300 мс–перший результат; спінер лише в чипах
- ✅ AC-SEARCH-10 — провал логується, без тоста; не блокує інших
- ✅ AC-SEARCH-11 — кеш 24 год per (query, ~100 м)
- 🟡 AC-SEARCH-01 — один геозапит на відкритті є, але timeout 15 с (треба 8 с) і немає «nearby до вводу» (Overpass-запит навколо координат ще не роблю)
- 🟡 AC-SEARCH-08 — empty-стан є, але без per-provider «·0» і без пре-заповненої ручної форми з GPS-фіксом
- ❌ AC-SEARCH-09 — десктоп IP-геолокація ±2 км / «add from phone» — не зроблено

## 2 · Gym imagery (IMG-01…12)

- ❌ Усі 12 — не почато (house-graphic генератор, resolution order фото, downscale/encode, серверне сховище /media/gyms, photoSource/photoCachedAt). Це наступний крок.

## 3 · Live-session hero (HERO-01…17)

- ❌ Усі 17 — не почато. Hero-band на кожному екрані з фото/висотами/переходами/rest/offline. Наступний крок (логіка — я, band-візуал — Codex).

## 4 · Regression guards (REG)

- ✅ AC-REG-01 — ghost-row логування, ренумерація
- ✅ AC-REG-02 — undo для зворотного, ConfirmDialog для незворотного
- ✅ AC-REG-04 — офлайн: локальний запис, черга, нейтральні теги
- ✅ AC-REG-05 — кольорова дисципліна (brass/emerald/ruby)
- 🟡 AC-REG-03 — пороги лоадингу (скелетони є; не скрізь суворо 300 мс/2 с)
- 🟡 AC-REG-06 — не кожен список має всі 4 стани (empty/skeleton/filled/failed)

## Підсумок

SEARCH: 8/11 ✅, 2 🟡, 1 ❌ · IMG: 0/12 · HERO: 0/17 · REG: 4/6 ✅.
Тобто «всі AC» НЕ закриті: зроблено пошук (ядро) і регрес-гарди; картинки й hero — попереду.
Блокери: Google Places / Foursquare потребують API-ключів; imagery потребує серверного сховища медіа.
