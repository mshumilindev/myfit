# SPO-397: графік і налаштування сну в акаунт — детальний план

Джерело: спайк SPO-349 (рішення власника 28.10: «на акаунт»), патерн `meta/exercisePrefs` (SPO-385). Дизайну немає: UI не змінюється (ті самі екрани сну, лише значення переживають вихід і новий пристрій). Юридично: дані сну = здоров'я, лише запечатано (`dekEnc`), відкрите тільки `updatedAt`; нових одержувачів немає.

## Що синхронізуємо

`users/{uid}/meta/sleepPrefs` (один запечатаний документ, LWW за одним штампом): `schedule` (SleepSchedule) і `settings` = `autoDim`, `autoLog`, `goalMin`.
Лишається на пристрої (бухгалтерія, не вибір людини): `lastDimDay`, `lastAutoNight`, `skippedAutoSleepDates`, `patternOffer`. Відома межа: на іншому пристрої раніше відкинуту автоніч може бути створено знову; окрема задача, якщо потрібно.

## Трасування (знахідка → код → тест)

| Вимога                                                  | Код                                                                                                                                    | Тест                                                 |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Серверне значення має пріоритет на новому пристрої      | `sleepPrefsSync.reconcileSleepPrefs`                                                                                                   | `sleepPrefsSync.test.ts`                             |
| Міграція з локальних без втрат (акаунт порожній → push) | те саме + `storeAccountDocs.watch`                                                                                                     | `sleepPrefsSync.test.ts`, `store.sleepPrefs.test.ts` |
| Правка → запечатаний запис зі штампом                   | `storeAccountDocs.setSleepPrefs` ← `setSleepSchedule/Settings`                                                                         | `store.sleepPrefs.test.ts`                           |
| Після прийому з акаунта оновити чергу автостарту        | `patchSleepPrefs` викликає `syncSleepAutoQueue`                                                                                        | `store.sleepPrefs.test.ts`                           |
| Rules + шифрування                                      | `firestore.rules` `meta/sleepPrefs`, `META_DOCS`, `STAMPED_DOCS` (vaultIO, vaultMigrate), `encryptedDoc.OPEN_FIELDS`, `SealedMetaName` | `tests/rules/coach.rules.logic.test.ts`              |
| Реєстр даних, ключі, експорт                            | R-рядок, `localKeys.registry` gap→synced (+ `spotter.sleepPrefsAt`), експорт через реєстр                                              | `localKeys.guard.test.ts`, `readSources.test.ts`     |
| Каскад видалення                                        | рекурсивний (`recursiveDelete`), додати в перелік                                                                                      | `tests/coach-server/accountDeletion.test.ts`         |

## Порядок

1. Червоні тести (sync-модуль, store, rules-логіка, каскад, guard).
2. `sleepPrefsSync.ts` (чистий модуль) → `storeAccountDocs.ts` → `store.ts` (setters, deps) → `storeMeta/vaultIO/vaultMigrate/encryptedDoc/firestore.rules`.
3. Реєстри й доки; `legal-compliance.md` чек-лист (реєстр даних, експорт, видалення, строк «до видалення акаунта»; Privacy Policy: категорія «сон» уже є, текст не змінюється — перевірити).
4. Гейт: lint, format, typecheck, `vitest related`, rules-тести (Java), незалежне рев'ю `risk-reviewer` (шифрування + rules).
5. Деплой rules перед клієнтом.

## Ризики

Rules без деплою → записи відхиляються (клієнт мовчить, але кеш лишається): деплоїти rules першими. Гонка двох пристроїв: LWW за штампом, новий штамп при першому злитті.
