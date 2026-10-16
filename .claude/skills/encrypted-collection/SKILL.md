---
name: encrypted-collection
description: Use when adding a new user-entered field or Firestore collection so it is encrypted (prepareWrite/sealDoc, or sealOrThrow for coaching data), covered by rules, migration and a round-trip test.
---

# Нова зашифрована колекція/поле

1. Визнач, що відкрите (`OPEN_FIELDS`: id, мітки часу, ключі для запитів/правил) — решта зашифрована.
2. Звичайні дані: `prepareWrite(collection, …)` / `sealDoc` (`vaultIO.ts`). Коучингові колекції (`NEW_COLLECTIONS`): тільки `sealOrThrow`/`openSealed`, ніколи `prepareWrite`.
3. Додай колекцію в `firestore.rules` (ролі, власник, тренер лише за грантом) і тести `tests/rules/` (включно з adversarial).
4. Додай у міграцію `autoMigrate` (`vaultMigrate.ts`); нові поля необов'язкові.
5. Тест round-trip (запис → читання → збіг) і перевірка, що в Firestore немає plaintext.
6. Локальні кеші — лише запечатані (`offline/`, `conditionsCache.ts`). У логи й аналітику вміст не йде.
7. Ризикова зміна → обов'язкове рев'ю субагентом `risk-reviewer`.
