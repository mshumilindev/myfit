---
name: new-screen-on-kit
description: Use when creating or reshaping a screen/page/section in client/src so it is built from the UI kit (components/ui) with tokens only, a story and no parallel components.
---

# Новий екран на UI-кіті

1. **Знайди аналог:** `rg` по `client/src/components/ui` і `docs/UI-KIT.md` на кожен елемент макета (рядок, пікер, картка, чипи, календар, хедер). Є — використовуй. Макет дає структуру/тексти/стани, вигляд — з кіту.
2. **Бракує примітива/варіанта?** Спершу кіт: новий проп/варіант або примітив у `components/ui/` + `Name.stories.tsx` (усі стани, довгий текст, `LocaleMatrix`). Не локальний CSS екрана, не копія.
3. **Збери екран:** єдиний хедер застосунку (`PageHead`), відступи `--s-*`, кольори/радіуси/шрифти лише токени, жодних сирих hex/px/`!important`/візуальних inline-стилів. Layout — утиліти `ul-/ua-/…`.
4. **Стани:** loading / empty / error / offline явно; дані з кешу, дельти, не блокувати.
5. **i18n:** усі тексти в 5 словників (див. skill `i18n-string`). a11y: роль, label, фокус, контраст.
6. **Сторі сторінки** `Pages/…` з фікстурами з `client/src/stories/`.
7. **Перевір:** `cd client && npx tsc --noEmit`, `npx eslint <файли>`, `npx prettier --check <файли>`, `npx vitest run src/<шлях>` + з кореня `npx vitest run tests/kit-guard.test.ts tests/hygiene-ratchet.guard.test.ts`; геометрія — `audit:*` з `--filter` на свої сторі; скрін 390 і 1280 до/після.
