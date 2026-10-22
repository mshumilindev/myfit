---
description: Легасі server/ (Express+SQLite) і desktop/ — що з ними робити
paths:
  - 'server/**'
  - 'desktop/**'
  - 'scripts/smoke.mjs'
  - 'scripts/validate-sql.mjs'
---

# Легасі: `server/` і `desktop/`

- Клієнт їх не імпортує і не викликає (`api.ts` — Firebase Auth + `callFn`); `firebase.json` деплоїть лише hosting і functions. Але `server/` ще в workspaces, `typecheck`, build і CI-джобі `smoke`, є `tests/server-api.test.ts`.
- Нових фіч тут не робимо. Не копіюй звідси патерни (SQLite, JWT, bcrypt, Express) у продукт.
- Правку тут робимо лише якщо вона потрібна CI або видаленню. Видалення каталогів — окрема задача (SPO-125 фаза 3), з прибиранням CI-джоба `smoke`, `validate-sql`, workspaces і тестів.
- `smoke.mjs` запускати тільки на тимчасовій БД: `GYM_DATA_DIR=$(mktemp -d) PORT=4499 …` — він реєструє акаунт і пише дані.
