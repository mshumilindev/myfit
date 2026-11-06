---
name: cpd
description: Use only when the user explicitly says "cpd" — commit, push and deploy with every check green, then verify the live result.
---

# cpd = commit + push + deploy, усе зелене

Запускай **лише на явне прохання**. Закінчується тільки коли все успішно.

1. **Ізоляція:** стан репо (`git status`). Чужі незакомічені зміни (інший чат) не чіпай. Якщо дерево брудне й `pre-push` його не пропустить — працюй у окремому `git worktree` від `HEAD`, переноси лише свої файли, пуш звідти. Додавай файли явно, не `git add -A`.
2. **Гейт локально:** `npm run lint`, `format:check`, `typecheck`, `test:coverage`, `npm run build -w client`; для UI — аудити геометрії по змінених сторі; для rules — `npm run test:rules`. Червоне виправ, не обходь (`--no-verify` заборонено).
3. **Commit:** українською, одна ціль на коміт, з номерами задач (`Фікс SPO-…`); без позасферних файлів (секрети, `.firebaserc` чужі правки, lockfile без причини).
4. **Push:** pre-push hook має пройти. Без force. З Cowork/хмарної сесії (немає токена на Mac-VM) — бандл → `add_repo` push → пуш із хмарного клону, CI/деплой через `gh api`: покроково в `CLAUDE.md` («Як `cpd` робиться з Cowork»).
5. **CI:** дочекайся зеленого (`quality`, `smoke`, `layout` = зведення шардів). Червоний — виправ і повтори; не мержити червоне. Червоний шард аудиту — це знахідка, а не флак: відтвори локально (`npm run audit:stories -- --part i/n --concurrency 5`, CI-склад локалей) і виправ корінь. Бюджет CI ≤7 хв і правила шардингу — `docs/adr/004-sharded-ci.md`; не скорочуй матрицю заради швидкості.
6. **Deploy:** hosting (`firebase deploy --only hosting --project spotter-64c3b` після `npm run build -w client`) і, якщо чіпали `functions/`, `firestore.rules`, `storage.rules`, `firestore.indexes.json` — відповідні цілі. Не пиши в прод-дані.
   - **Функції деплоїмо пакетами (правило власника 03.11.2026, SPO-351):** квота запису 2-го покоління — 60 запитів/60 с на регіон, а `firebase deploy --only functions` оновлює всі ~105 функцій (хеш усієї папки `functions/`) і падає з 429. Тому: `--only functions:a,functions:b,…` лише зачеплені функції (транзитивні імпортери змінених файлів `functions/src`), **не більше 10 за пакет, пауза ≥60 с між пакетами**, невдалі (429) повторювати лише їх; `login`, `authStatus`, `sessionCheck`, `vaultKey` — в останній пакет; після деплою — smoke (публічні виклики дають очікувану помилку, не `internal`/CORS) і логи без `container failed to start`. Голий `--only functions` без списку не запускати.
   - **Маркер версії згод (SPO-533):** після деплою `recordConsent` має існувати анотований тег `recordConsent-deployed/<UTC-час>` з повідомленням `consentRecordsPure sha256: <sha256 файлу functions/src/consentRecordsPure.ts на задеплоєному коміті>`; workflow `Deploy functions` ставить його сам. Деплой з Мака вручну — поставити тег так само (`git tag -a … -m "consentRecordsPure sha256: $(shasum -a 256 functions/src/consentRecordsPure.ts | cut -d' ' -f1)" <sha> && git push origin <тег>`). Workflow `Deploy hosting` падає, якщо хеш цього файлу в збірці інший (клієнт слав би версії, яких сервер ще не знає → 400 stale-version); обхід `skip_consent_guard` лише свідомо.
   - **Порядок:** `firestore.rules`/`firestore.indexes.json` → functions (пакетами) → hosting. Hosting: workflow `Deploy hosting` (`target: test` = spotter-64c3b.web.app, потім `prod` = myspotter.fit, прод за environment `production`).
7. **Перевірка наживо (read-only):** відкрий застосунок, пройди змінені екрани, консоль без помилок; логи функцій без нових помилок.
8. **Linear:** задачі, де всі AC закриті й перевірені наживо → Deployed; решта лишається як є.
9. **Звіт:** що задеплоєно (коміти), результат CI, що перевірено наживо; якщо щось не пройшло — прямо що саме.
