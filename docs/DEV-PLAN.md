# DEV-PLAN — покрокова реалізація MVP (ФЕ + BFF)

Продуктовий скоуп — у [MVP.md](./MVP.md). Тут — інженерні кроки: кожен має
Definition of Done і закінчується зеленим гейтом
([quality-gate.mdc](../.cursor/rules/quality-gate.mdc)). Один крок = один
акуратний коміт (або кілька дрібних), без змішування з наступним.

## Крок 0 — Bootstrap якості (разовий)

```bash
cd gym-tracker
git init && git add -A && git commit -m "chore: базовий стан перед гейтом"
npm install            # ставить eslint/prettier + вмикає .githooks (prepare)
npm run format         # разовий bootstrap-прогін Prettier по репо
npm run lint:fix
npm run lint           # решту помилок — руками
npm run typecheck
git add -A && git commit -m "chore: eslint+prettier+хуки, правила розробки"
```

**DoD:** `lint`, `format:check`, `typecheck` зелені; хуки спрацьовують на
коміт/пуш; правила лежать у `.cursor/rules/`, `CLAUDE.md` у корені.

## Крок 1 — Зелена верифікація наявного коду

```bash
GYM_DATA_DIR=$(mktemp -d) PORT=4499 npm run start -w server &
BASE=http://localhost:4499 node scripts/smoke.mjs
node scripts/validate-sql.mjs
```

**DoD:** смоук — 0 FAIL; validate-sql чистий. Будь-який FAIL лагодиться за
[test-integrity.mdc](../.cursor/rules/test-integrity.mdc) (спершу гіпотеза
«реграсія в коді», не «поганий тест»).

## Крок 2 — Перший реальний запуск (MVP.md, кроки 1–3)

`npm run tray` → акаунт → телефон у домашній мережі → офлайн-тест черги
(авіарежим → підхід → синк).

**DoD:** тренування, записане з телефона офлайн, після синку видно на Маку.

## Крок 3 — Тиждень бойового використання (MVP.md, крок 4)

Логувати кожне тренування; тертя — у `docs/BACKLOG.md` (створити за першим
записом). Код у цей тиждень міняємо лише щоб чинити блокери логування.

**DoD:** 7 днів поспіль без тренування «повз трекер»; беклог тертя існує.

## Крок 4 — Юніт-тести критичної логіки (перший пост-MVP крок)

Vitest на два найризиковіші модулі: `client/src/store.ts` (черга: порядок,
ідемпотентність, state-replace після синку) і серверні правила тренування
(8 год, одне відкрите). Порога покриття поки НЕ вводимо — тільки осмислені
тести. Додати `test` у гейт і pre-push.

**DoD:** `npm test` існує і зелений у гейті; правила черги закріплені тестами.

## Крок 5 — Доступ з-за меж дому (опційно)

Cloudflare Tunnel за `cloudflare/SETUP.md` (потрібен домен).

**DoD:** PWA відкривається по HTTPS з мобільної мережі; смоук проти
production-БД НЕ ганяли (див. test-integrity).

## Далі (поза цим планом)

Нові сервіси («Харчування», «AI-оцінка тіла») — кожен окремим міні-планом за
шаблоном shell'а (два реєстри), зі своїм смоук-розділом. Скоуп затверджується
у MVP.md відповідного сервіса до коду ([agent-approach.mdc](../.cursor/rules/agent-approach.mdc)).
