# Команда тренера і роль Manager — spec

Задача: SPO-196 (епік), SPO-260 · Статус: у роботі · Автор/дата: власник + Claude, 20.10.2026

## Мета і контекст

Тренер може додати **менеджера** (адмін-помічник): менеджер бачить розклад усіх тренерів команди, переносить (запитом), скасовує й відмічає done/missed сесії, запрошує клієнтів і просить видалити клієнта; чатів і чутливих даних не бачить. Менеджер додає в команду лише тренерів, тренер лише менеджерів. Пуш і закріплений сервісний чат «Spotter» збирають усе, що треба зробити.

Дизайн: Design-артефакт (68 бордів, `https://claude.ai/artifact/TH5sbNzxmV7QfLFY3b13bo`), еталон для Storybook. Ключове рішення: `docs/adr/005-team-manager-key-delegation.md`. Поле рішень: Project «Spotter» → `SPO-197-key-delegation-decision.md`, `SPO-196-dev-plan.md`.

## Поза скоупом

- Спільний чат менеджер↔тренер, чат менеджера з клієнтами (менеджер **не пише**).
- Кілька команд на тренера; ієрархія вищих ролей; оплата/тарифи команди.
- Доступ менеджера до тренувань, здоров'я, харчування, нотаток, плану, live.
- Нові UI-примітиви (усе з наявного кіту).

## AC

- [ ] AC1 — `users/{uid}.role` приймає `manager`; менеджер не має прав тренера · доказ: rules-тести
- [ ] AC2 — модель `teams/{trainerUid}` + `members`, `teamInvites`, `teamRequests`; менеджер читає лише розклад і запити своєї команди, нічого з `notes|plan|chat|live|health|nutrition|body`; не пише `coaching` · доказ: rules-тести (емулятор)
- [ ] AC3 — функції `teamInvite/Accept/Decline/Revoke/RemoveMember/Leave/Clients`, `clientRemovalRequest/Respond`, `teamSetActivityScope`, `inviteClientForTrainer`; `rescheduleCreate` приймає `from:'manager'` · доказ: тести функцій
- [ ] AC4 — делегація підключів `schedule|requests` клієнтським пристроєм; видалення = rules одразу + ротація епохи при відкритті клієнтом · доказ: crypto-тести (ADR 005)
- [ ] AC5 — UI Team (тренер/менеджер, desktop+phone), додавання/приймання/видалення/вихід · доказ: сторі, скріни, e2e
- [ ] AC6 — розклад менеджера: фільтр Trainer, move=запит (`RescheduleForm`), cancel, mark done/missed · доказ: сторі, e2e
- [ ] AC7 — клієнти менеджера, обрізана картка, запрошення, запит на видалення; стан «Waiting for client's app» · доказ: сторі, e2e
- [ ] AC8 — Agenda тренера: «Team requests», схвалення видалення клієнта · доказ: сторі, e2e
- [ ] AC9 — журнал `teams/{uid}/activity` (метадані), тренер усе, менеджер своє або все за `activityScope` · доказ: rules-тести, e2e
- [ ] AC10 — Spotter = вигляд над `users/{uid}/notices`, закріплений у всіх застосунках, read-only, кнопки дій · доказ: сторі, e2e
- [ ] AC11 — push без вмісту (`coach-request|team|reminder`), налаштування, планові нагадування · доказ: тести `pushPolicy`, scheduler-тести
- [ ] AC12 — UI клієнта: запит від команди, «Olena's team», «Who saw your data» зі записами менеджера · доказ: сторі, e2e
- [ ] AC13 — 5 локалей, `i18n:check`; `kit-guard`, `audit:stories`, геометрія зелені · доказ: CI

## Підхід

Найближчі аналоги: `coachInvite/Accept/End` (`functions/src/coach/handlers.ts`, `service.ts`), `conversationKey.ts` + `keyRing.ts` (ключі за призначенням), `users/{uid}/notices`, `pushPolicy.ts`. Рекомендація — повторити ці патерни, нових примітивів немає. Нове: делегація ключів клієнтом (ADR 005). Альтернативи (тренер делегує; спільний командний ключ; серверне шифрування Spotter) відхилені в ADR.

## Вплив

- **UI-кіт:** `PageHead`, `GroupedList/ListRow`, `Sheet`, `Select`, `Switch`, `Tag`, `Notice`, `DataTable`, `ConfirmEffectsDialog`, `RequestCard`, `ScheduleScreen`, `RosterScreen`, `InvitePanel`, `AccessLogPage`. Нових примітивів немає; сторі на кожен екран (SPO-262).
- **Дані й безпека:** нові колекції у rules + тести; ключі не extractable на боці тренера/менеджера; журнал і notices — тільки метадані. Незалежне рев'ю (SPO-267).
- **i18n:** нові рядки одразу в 5 локалях. **Offline:** запис менеджера через офлайн-чергу як у тренера. **A11y:** діалоги/Sheet/Switch з aria.

## План тестів (red/green)

Спершу падають rules-тести (менеджер читає/пише лише дозволене), crypto-тест делегації, тести функцій. Потім сторі + `audit:stories`, e2e (`e2e:coach`), перевірка в браузері на тестових акаунтах (desktop 1360, phone 390) зі скріншотами.

## Реліз і відкат

Фіча-флаг `teamManager` (SPO-266): UI й функції за флагом, rules безпечні без флагу. Відкат — вимкнення флагу; дані не втрачаються.

## Партії (малі, кожна = один коміт)

1. spec+ADR (SPO-260) → AC-контракт
2. Прототип крипто-делегації тестом (SPO-197)
3. Модель даних + rules + тести (SPO-198)
4. Крипто-делегація (SPO-261)
5. Functions (SPO-199) · фікстури/сторі (SPO-262)
6. UI Team → розклад → клієнти (SPO-200/201/202)
7. Видалення/вихід, запити (SPO-239, SPO-204)
8. Журнал і `activityScope` (SPO-203, SPO-238)
9. Spotter, push, scheduler (SPO-236/237/264/265)
10. UI клієнта (SPO-205) · i18n (SPO-263)
11. QA (SPO-206), рев'ю (SPO-267), rollout (SPO-266)

## Відкриті питання

- `needsMark` для «сесія без відмітки»: булів прапорець від пристрою чи `endAt` не в шифрі (SPO-265; рішає Claude при реалізації, власник бачить у ADR).
