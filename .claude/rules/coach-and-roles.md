---
description: Коуч-застосунок, ролі, доступи, приватність клієнта
paths:
  - 'client/src/coach/**'
  - 'client/src/coachCrypto/**'
  - 'functions/src/coach/**'
  - 'tests/coach-server/**'
  - 'docs/COACH-*.md'
---

# Coach і ролі

- Coach — desktop-first, але працює й на мобільному (390/768/1024/1440 у `e2e:coach`). Власних Drawer/Switch/Chip/ListRow/Segmented у coach немає — кіт (`kit-guard`).
- Доступ тренера до даних клієнта — лише за явною згодою клієнта (грант + приватність), на рівні `firestore.rules` і функцій, а не лише в UI. Відсутній доступ показуємо зрозуміло, не «порожнім».
- Дані коучингу — тільки `sealOrThrow`/`openSealed` (див. `security-and-data.md`).
- Тренер = trainer **або** admin (admin має ті самі права). Зміни ролей/доступів — з rules-тестами.
- Роль `manager` (команда тренера, SPO-196, `docs/adr/005-team-manager-key-delegation.md`) — не тренер: `isCoachRole()`/`isTrainerOrAdmin()` для неї false; доступ лише до розкладу й запитів клієнтів своєї команди (підключі `schedule|requests`, делегує пристрій клієнта), без чату, нотаток, плану, live. Привілей = claim **і** живий `users/{uid}.role`, плюс активне членство `teams/{teamId}/members/{uid}`. Фіча-флага немає.
- Деталі бекенду й безпеки: `docs/COACH-BACKEND.md`, `docs/COACH-SERVER-SECURITY.md`, `docs/COACH-STATUS.md`.
