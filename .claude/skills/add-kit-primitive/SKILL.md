---
name: add-kit-primitive
description: Use when a screen needs a UI element the kit lacks — add a new primitive or variant to components/ui with stories, tests and docs instead of local CSS or a copy.
---

# Новий примітив або варіант у кіті

1. **Не дублюй:** `rg` по `components/ui` та `docs/UI-KIT.md` (Chip, Tag, Card, OptionCard, Ring, Badge…). Достатньо варіанта/пропа наявного — додай його, а не новий компонент. Список дублів-боргів: `tests/hygiene-baseline.json`.
2. **API:** скінченні `variant` / `size` / `tone` / `density` через пропси або `data-*`; slots/`children` замість 20 пропсів; презентаційний — без Firestore, шифрування, роутингу, i18n-провайдера (дані й колбеки через пропси).
3. **Стилі:** `Name.css` поруч; лише токени (`--s-*`, `--r-*`, `--fs-*`, `--z-*`, палітра), логічні властивості (`margin-inline`), без `!important`, без сирих значень.
4. **Стани й a11y:** default / hover / focus / active / disabled / loading / error / empty; роль, label, фокус, контраст, `prefers-reduced-motion`.
5. **Сторі** `Name.stories.tsx` (CSF3, `Kit/<Name>`): усі стани, довгий текст, `LocaleMatrix` для 5 локалей. Тест варіантів `Name.test.tsx`.
6. **Док:** запис у `docs/UI-KIT.md` (призначення, пропси, коли не використовувати).
7. **Перевір:** tsc, eslint, prettier, `npx vitest run tests/kit-guard.test.ts tests/hygiene-ratchet.guard.test.ts` + тест компонента; `audit:stories --filter Kit/<Name>`; скрін 390/1280.
