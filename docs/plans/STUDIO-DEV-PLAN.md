# Studio: план і стан до релізу (оновлено 08.11.2026)

Джерела: `claude/CLEAR-theme-decisions.md`, `docs/ADD-A-THEME.md`, статус `claude/STUDIO-status-2026-11-08.md`.

## Стан за кроками ADD-A-THEME

| Крок | Стан |
|---|---|
| 1 Файл теми, реєстр | Готово (`studio.css`, `primitives.studio.css`, запис у `registry.ts`, `since 2026-11-09`) |
| 2 Токени, світлий режим, 9 акцентів | Готово (генератор `studio-gen.mjs`, акценти окремими файлами `_studio.axes.*.css`) |
| 3 Гарди contract, contrast, studio, hygiene | Зелені |
| 4 Storybook, аудити | Кіт: ThemeSwatch, WaterProgress, ProgramProgress; `audit:stories`, `audit:theme-swap` 0 проблем; `lint:css` без нових порушень |
| 5 Перемикання додатків (Tidal) | Готово, `theme-switch` guard зелений |
| 6 Перехід між екранами | Не потрібен (`--route-tail: 0`) |
| 7 Налаштування теми | Готово: сторінка, шестерня в Themes, картки-запрошення, діалог виходу без Save |
| Фон Waves, Start-ореол, вода на Today | Готово |

## Лишилось (поза можливостями середовища розробки)

1. Заміри продуктивності Tidal, Waves, води на слабких Android і старих iOS; за результатом — деградація за часом кадру.
2. Піксельний аудит з еталоном main (`audit:pixels --dir shots-ref`, потім `--ref`).
3. Рядок Themes у More іде з гілкою add-ons; після нього прибрати окремий рядок «Налаштування теми».
4. Перейменування гілки `design/clear-theme` і файлу `CLEAR-THEME.md` (у коді `cl-*` немає).
5. Задачі в Linear (ліміт безкоштовних задач).
6. Огляд власником на пристрої → staging → production. Порядок злиття: add-ons → Themes у More → Studio.

## Прийняті рішення

- Atlas лишає власні кольори.
- Session лишає сегменти плану; вода лише на картці програми Today.
- Вихід зі сторінки налаштувань зі змінами: діалог; без змін — одразу.
- Tidal fallback: кросфейд при reduced-motion/reduced-transparency; інше після замірів.
- Режим (Авто/Світла/Темна) зберігається на пристрої (`gym.modePref`), результат light/dark синхронізується як `gym.mode`.

## Не реалізовано свідомо

- Випадкові додаткові хвилі Tidal на JS; розмиття через CSS `backdrop-filter` замість знімка DOM.
- Картка-запрошення без прев'ю теми (потрібна візуальна ідея).
