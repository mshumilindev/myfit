# ADR 003 — dependency-cruiser для меж модулів (SPO-135)

**Статус:** прийнято (16.10.2026)

## Контекст

`client/src` пласкій (сотні файлів у корені), цикли імпортів і витік data-шару в кіт ніхто не міряв. Правило «залежності лише вниз, без циклів, кіт презентаційний» (`.claude/rules/client-architecture.md`) існувало лише текстом.

## Рішення

Dev-залежність `dependency-cruiser` + `.dependency-cruiser.cjs` (правила `no-circular`, `kit-stays-presentational`, `no-test-in-prod`). Наявні порушення заморожені в `.dependency-cruiser-known-violations.json` (ratchet: лише зменшується; `npm run deps:baseline` після виправлення). Крок `npm run deps:check` у CI (job `quality`): нове порушення = червоний.

## Наслідки

- Розмір PWA не змінюється (інструмент лише dev/CI), `npm ci` +≈25 пакетів.
- Baseline: 182 відомі порушення (180 циклів, 2 кіт→data/фічі). Структура за фічами (`features/…`) — окремий проєкт, перевірка меж при цьому вже готова.
- Альтернатива `eslint-plugin-boundaries` відхилена: гірше ловить цикли й не має вбудованого baseline.
