---
name: cpd
description: Use only when the user explicitly says "cpd" — commit, push and deploy with every check green, then verify the live result.
---

# cpd = commit + push + deploy, усе зелене

Запускай **лише на явне прохання**. Закінчується тільки коли все успішно.

1. **Ізоляція:** стан репо (`git status`). Чужі незакомічені зміни (інший чат) не чіпай. Якщо дерево брудне й `pre-push` його не пропустить — працюй у окремому `git worktree` від `HEAD`, переноси лише свої файли, пуш звідти. Додавай файли явно, не `git add -A`.
2. **Гейт локально:** `npm run lint`, `format:check`, `typecheck`, `test:coverage`, `node scripts/validate-sql.mjs`, `npm run build -w client`; для UI — аудити геометрії по змінених сторі; для rules — `npm run test:rules`. Червоне виправ, не обходь (`--no-verify` заборонено).
3. **Commit:** українською, одна ціль на коміт, з номерами задач (`Фікс SPO-…`); без позасферних файлів (секрети, `.firebaserc` чужі правки, lockfile без причини).
4. **Push:** pre-push hook має пройти. Без force.
5. **CI:** дочекайся зеленого (`quality`, `smoke`, `layout` = зведення шардів). Червоний — виправ і повтори; не мержити червоне. Червоний шард аудиту — це знахідка, а не флак: відтвори локально (`npm run audit:stories -- --part i/n --concurrency 5`, CI-склад локалей) і виправ корінь. Бюджет CI ≤5 хв і правила шардингу — `docs/adr/004-sharded-ci.md`; не скорочуй матрицю заради швидкості.
6. **Deploy:** hosting (`firebase deploy --only hosting --project spotter-64c3b` після `npm run build -w client`) і, якщо чіпали `functions/`, `firestore.rules`, `storage.rules`, `firestore.indexes.json` — відповідні цілі. Не пиши в прод-дані.
7. **Перевірка наживо (read-only):** відкрий застосунок, пройди змінені екрани, консоль без помилок; логи функцій без нових помилок.
8. **Linear:** задачі, де всі AC закриті й перевірені наживо → Deployed; решта лишається як є.
9. **Звіт:** що задеплоєно (коміти), результат CI, що перевірено наживо; якщо щось не пройшло — прямо що саме.
