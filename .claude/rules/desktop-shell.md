---
description: desktop/ — Electron-оболонка (macOS DMG, Windows EXE, трей); без продуктового коду
paths:
  - 'desktop/**'
  - '.github/workflows/desktop-*.yml'
---

# `desktop/`: тонка Electron-оболонка

- `desktop/` — **жива**: з неї збираються macOS DMG і Windows EXE (`desktop-dmg.yml`, `desktop-exe.yml`, `desktop-release.yml`, `electron-builder.yml`), є трей, `electron-updater`. Рішення: `docs/adr/009-desktop-shell-electron-updater.md`.
- Оболонка відкриває **хостований** веб-застосунок. Продуктового коду тут немає: розробка йде лише в React-вебі/PWA (`client/`), оболонка підхоплює зміни автоматично.
- Нових фіч у `desktop/` не додаємо без потреби платформи (трей, оновлення, нативні сповіщення, вікно). Усе, що можна зробити у вебі, робимо у вебі.
- Легасі `server/` (Express+SQLite) видалено (SPO-139); не повертати SQLite, JWT, bcrypt, Express у продукт.
