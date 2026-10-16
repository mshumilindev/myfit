---
name: i18n-string
description: Use when adding or changing any user-visible text in the client, so it lands in all 5 locales (en, uk, pl, lt, et) and passes the length and parity checks.
---

# Новий рядок у 5 локалях

1. Знайди відповідний словник у `client/src/i18n/` (`en.ts` база; для coach/atlas/cyc/sup — їхні файли `*.en|uk|pl|lt|et.ts`).
2. Додай ключ **одразу в усі п'ять** файлів (en дослівно з макета). Тип `Strings` зробить пропуск помилкою компіляції. Плюрали — локальні хелпери словника; дати й числа — форматери `i18n/index.ts`.
3. У компоненті — лише `t(...)`/словник, жодних літералів, у т.ч. повідомлень про помилки.
4. Довгі слова (pl/lt/et): тримай у бюджеті `tests/i18n-length.test.ts` — скорочуй переклад, бюджет не піднімай.
5. Перевір: `npm run i18n:check`, `npx vitest run tests/i18n.test.ts tests/i18n-length.test.ts`, `cd client && npx vitest run src/i18n`.
